# EPIC-09: FINANCIAL ANALYTICS, REAL-TIME COGS/HPP & BUSINESS INTELLIGENCE
## Laporan Keuangan Toko, Laba Kotor, Analisis HPP Otomatis, & Dashboard Eksekutif

**Epic ID**: `EPIC-09`  
**Status**: **COMPLETED ✅**  
**Prioritas**: **P3 — MEDIUM (FINANCIAL CLARITY & DECISION MAKING)**  
**Target Komponen**: `pos_apps/server` & `pos_apps/client`  
**Dokumen Induk**: [`docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md`](file:///Users/dendyaditya/Projects/pos_project/docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md)  
**Dokumen Arsitektur Rujukan**: `docs/00_PROJECT_CONTEXT.md` (Section 2 & 7)  

---

### 1. DESKRIPSI & TUJUAN BISNIS
Memberikan laporan performa bisnis yang transparan dan akurat bagi pemilik toko (*merchant owner*), mulai dari omzet penjualan kotor, diskon yang diberikan, potongan pajak/service charge, hingga perhitungan otomatis harga pokok penjualan (HPP / COGS) dan laba kotor (*Gross Profit*).

Tujuan **EPIC-09** adalah:
1. **Laba Rugi Otomatis (P&L)**:
   $$\text{Net Revenue} = \text{Gross Sales} - \text{Discounts}$$
   $$\text{Gross Profit} = \text{Net Revenue} - \text{COGS / HPP}$$
   $$\text{Gross Profit Margin} = \left( \frac{\text{Gross Profit}}{\text{Net Revenue}} \right) \times 100\%$$
2. **Rekapitulasi Arus Kas Harian**: Pembagian arus kas masuk berdasarkan tender (`CASH`, `QRIS`, `TRANSFER`, dll.).
3. **Audit Selisih Kas Kasir (*Cash Discrepancy*)**: Monitoring selisih uang fisik laci kasir vs pencatatan sistem dari seluruh Z-Report shift (`MATCH`, `SHORTAGE`, `SURPLUS`).
4. **Analisis Produk Terlaris (*Pareto / 80-20 Rule*)**: Top produk berdasarkan kuantitas, kontribusi revenue, dan kontribusi profit, serta deteksi barang mati (*dead-stock*) beserta valuasi modal kerja macet (*frozen capital*).
5. **Ekspor Laporan**: Dukungan ekspor data ke format CSV dengan UTF-8 BOM (`\uFEFF`) yang kompatibel langsung dengan Microsoft Excel & Google Sheets.

---

### 2. SPRINT EXECUTION RECORD & TASKS

- [x] **Task 9.1: Real-Time Gross Profit & COGS Calculator**
  - Mengambil snapshot `costPrice` dari `order_items` yang diisi saat checkout atau fallback ke `inventory_items.average_cost`.
  - Menghitung real-time revenue kotor, diskon, omzet bersih, total HPP/COGS, laba kotor, dan persentase gross profit margin.
  - Pembagian arus kas masuk terkelompok berdasarkan tipe tender pembayaran.
- [x] **Task 9.2: Cashier Discrepancy & Shift Audit Dashboard**
  - Rekapitulasi shift kasir: Tanggal buka/tutup, Kas Awal, Kas Diharapkan, Kas Fisik Aktual, dan Selisih (*Difference / Variance*).
  - Klasifikasi status selisih: `MATCH` (selisih 0), `SHORTAGE` (minus / kas fisik kurang), `SURPLUS` (kas fisik lebih).
  - Perhitungan agregat total kas diharapkan, kas aktual, dan net variance.
- [x] **Task 9.3: Sales Performance & Product Matrix BI Charts**
  - Matriks performa produk: Kuantitas terjual, total revenue, total COGS, total laba kotor, dan profit margin per produk.
  - Sorting fleksibel: `volume` (terlaris), `revenue` (penyumbang omzet terbesar), atau `profit` (penyumbang margin tertinggi).
  - Deteksi Dead-Stock: Identifikasi produk aktif yang memiliki stok berjalan tetapi nol penjualan selama periode evaluasi (default 30 hari), beserta kalkulasi modal kerja tertahan (*frozen capital*).
- [x] **Task 9.4: Multi-Format Data Export Engine**
  - Endpoint download ekspor CSV streaming dengan header `\uFEFF` (UTF-8 BOM) untuk kompatibilitas Excel Indonesia.
  - Mendukung tipe ekspor: `pnl`, `products`, `shifts`, `deadstock`.
- [x] **Task 9.5: Frontend Financial & Real-Time COGS Dashboard Integration**
  - Visualisasi 6 KPI Cards terpadu di `FinancialReportView.tsx`: Total Omset Bersih, Total HPP / Modal Pokok (`totalCOGS`), Laba Kotor / Gross Profit (`grossProfit`) beserta badge margin %, Total Faktur Transaksi, Total Pajak PPN & Service, serta Total Diskon Promosi.
  - Breakdown tren harian (Daily Trends) kini menyertakan kolom HPP dan Laba Kotor baik pada Desktop Table View maupun Mobile Card List View.
  - Ekspor CSV Finansial terpadu dengan UTF-8 BOM (`\uFEFF`) yang mencakup rincian HPP, Laba Kotor, dan persentase Gross Profit Margin.
- [x] **Task 9.6: Frontend Cashier Shift & Discrepancy Audit View**
  - Integrasi API `GET /api/reports/shifts` pada `ShiftsAuditView.tsx` dengan filter periode preset (Hari Ini, 7 Hari, 30 Hari, Bulan Ini, Kustom) dan penyaringan outlet aktif.
  - 4 Kartu KPI Ringkasan Audit Kasir: Total Sesi Diaudit, Kas Seimbang / Sesuai (Rp 0), Kas Kurang (Shortage) beserta akumulasi nominal minus, dan Net Selisih Kas (Net Variance).
  - Status selisih kas cerdas (`SEIMBANG`, `LEBIH`, `KURANG`, `AKTIF`) pada tabel desktop dan kartu smartphone handheld.
  - Ekspor CSV audit shift kasir berformat UTF-8 BOM (`\uFEFF`).
- [x] **Task 9.7: Product Matrix & Dead-Stock CSV UTF-8 BOM Standard**
  - Standarisasi ekspor CSV pada `ProductAnalyticsView.tsx` menggunakan UTF-8 BOM (`\uFEFF`) dan Blob URL untuk kompatibilitas mutlak Microsoft Excel dan spreadsheet modern tanpa karakter rusak.
- [x] **Task 9.8: Net Operating Profit Engine (Gross Profit - Kas OPEX Shift)**
  - Mengintegrasikan pengeluaran kas kecil laci kasir (`cash_movements` tipe `CASH_OUT`) ke dalam pembukuan laba rugi.
  - Menghasilkan perhitungan real-time Laba Bersih Operasional (*Net Operating Profit*) dan Marjin Bersih (*Net Profit Margin %*).
- [x] **Task 9.9: Visual Trendline Chart (Native SVG Omzet vs HPP vs Laba Kotor)**
  - Komponen `<SalesProfitTrendChart />` Native SVG ultra-cepat tanpa dependensi library eksternal yang berat.
  - Mendukung visualisasi Batang (Bar) dan Garis/Area (Line) dengan interactive floating tooltip.
- [x] **Task 9.10: Executive BI Smart Insights Panel**
  - Deteksi otomatis jam tersibuk toko (*Peak Sales Hours*), rata-rata keranjang belanja (*Average Basket Size / AOV*), menu andalan margin tinggi (*Champion*), dan status kesehatan marjin toko (*Health Status*).
- **Status Akhir: 100% COMPLETED (GAP: 0%)**

---

### 3. ARSITEKTUR TEKNIS & API ENDPOINTS

#### Controller & Services:
- `pos_apps/server/src/services/analytics.service.ts`: Engine kalkulasi analitik keuangan, Pareto produk, selisih kas kasir, dead-stock inventory, dan generator CSV.
- `pos_apps/server/src/controllers/report.controller.ts`: Handler HTTP request, date parsing (UTC boundary resolution), validasi tenant, dan file streaming.
- `pos_apps/server/src/routes/report.routes.ts`: Router REST API terproteksi `authMiddleware`.

#### API Endpoints:
1. `GET /api/reports/financial/summary?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&outletId=UUID`
   - Response: `grossSales`, `discounts`, `netRevenue`, `cogs`, `grossProfit`, `grossProfitMarginPercentage`, `tenderBreakdown`.
2. `GET /api/reports/shifts/discrepancies?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&outletId=UUID`
   - Response: `shifts`, `summary` (`totalExpectedCash`, `totalActualCash`, `netVariance`, `matchCount`, `shortageCount`, `surplusCount`).
3. `GET /api/reports/products/performance?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&sortBy=volume|revenue|profit&limit=10`
   - Response: `products` (termasuk sku, name, category, totalQuantity, totalRevenue, totalCost, grossProfit, profitMarginPercentage).
4. `GET /api/reports/inventory/dead-stock?days=30&outletId=UUID`
   - Response: `summary` (`totalDeadItems`, `totalFrozenCapital`), `deadStockItems`.
5. `GET /api/reports/export?type=pnl|products|shifts|deadstock&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
   - Response: File attachment `text/csv; charset=utf-8` dengan filename bertanggal.

---

### 4. HASIL VERIFIKASI PENGUJIAN OTOMATIS

File uji: `pos_apps/server/src/migrations/contract/test_epic09_financial_analytics.ts`

```text
===============================================================
EPIC-09 VERIFICATION SUITE: FINANCIAL ANALYTICS & COGS/HPP
===============================================================

[1/7] Resolving Active Tenant, Outlet & Cashier Context...
  Tenant: Ura Coffee (1b29b1a6-898b-4aab-bbda-76db544c4a8f)
  Outlet: Gudang Utama - Toko Utama - Ura Coffee (f1d3b250-4d75-40a3-99f3-a831263a0635)
  Cashier: Rudra (e2dce666-fe56-4b47-a39f-9ca911528fef)

[2/7] Seeding Baseline Test Data: Products, Costs & Inventory...
  ✅ High Margin Product: Espresso Gold (Harga: Rp 30.000, HPP: Rp 10.000)
  ✅ Low Margin Product: Pastry Butter (Harga: Rp 25.000, HPP: Rp 20.000)
  ✅ Dead-Stock Product: Specialty Tea Leaf (Harga: Rp 40.000, HPP: Rp 15.000, Stok: 20)

[3/7] Generating Paid Sales Orders with COGS & Tenders...
  ✅ Order 1 (CASH): Inv INV/EPIC09/1, Subtotal Rp 60.000, HPP Rp 20.000, Diskon Rp 5.000 -> Net: Rp 55.000
  ✅ Order 2 (QRIS): Inv INV/EPIC09/2, Subtotal Rp 50.000, HPP Rp 40.000, Diskon Rp 0 -> Net: Rp 50.000

[4/7] Generating Cashier Shifts with Discrepancies...
  ✅ Shift 1 (Balanced): Kas Diharapkan Rp 150.000, Aktual Rp 150.000 (Selisih: Rp 0)
  ✅ Shift 2 (Shortage): Kas Diharapkan Rp 200.000, Aktual Rp 190.000 (Selisih: -Rp 10.000)
  ✅ Shift 3 (Surplus): Kas Diharapkan Rp 100.000, Aktual Rp 105.000 (Selisih: +Rp 5.000)

[5/7] Verifying Real-Time Financial P&L Analytics Engine...
  Gross Sales   : Rp 110.000
  Discounts     : Rp 5.000
  Net Revenue   : Rp 105.000
  COGS / HPP    : Rp 60.000
  Gross Profit  : Rp 45.000
  Margin %      : 42.86%
  Tender CASH   : Rp 55.000
  Tender QRIS   : Rp 50.000
  ✅ P&L & Tender calculations matched mathematically!

[6/7] Verifying Cashier Shift Audit & Discrepancy Dashboard...
  Expected Cash : Rp 450.000
  Actual Cash   : Rp 445.000
  Net Variance  : -Rp 5.000
  Status Counts : Match: 1, Shortage: 1, Surplus: 1
  ✅ Shift audit & discrepancy detection verified!

[7/7] Verifying Product Matrix & Dead-Stock Intelligence Engine...
  ✅ Top Revenue Product : Espresso Gold (Revenue: Rp 60.000, Laba: Rp 40.000, Margin: 66.67%)
  ✅ Dead-Stock Detection: Specialty Tea Leaf terdeteksi sebagai dead-stock (Modal Tertahan: Rp 300.000)
  ✅ CSV Export verified: UTF-8 BOM present, Header & Rows valid!

===============================================================
🎉 EPIC-09 VERIFICATION COMPLETE: ALL 7/7 MODULES PASSED!
===============================================================
```
