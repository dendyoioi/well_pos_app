# EPIC-27: CUSTOMER RECEIVABLES (KASBON & PIUTANG) & REAL-TIME CASH FLOW ANALYTICS ENGINE

## 📋 Ringkasan Eksekutif
Epic ini mengimplementasikan dua kapabilitas esensial bagi merchant UMKM & ritel/F&B:
1. **Pencatatan Kasbon / Piutang Pelanggan (*Customer Receivables / Pay Later*)**:
   - Memungkinkan pelanggan langganan berbelanja dengan skema jatuh tempo yang fleksibel.
   - Dilengkapi kontrol ketat level outlet (*toggle* izin kasbon), validasi wajib data pelanggan terdaftar, penagihan 1-klik via WhatsApp, dan alur pelunasan bertahap/lunas (*debt settlement*).
   - Sinkronisasi otomatis kas pelunasan tunai ke laci kasir (*Cash Movement* `CASH_IN` kategori `DEBT_REPAYMENT`) pada shift kasir aktif.
2. **Laporan Arus Kas Riil (*Cash Flow*) & Visualisasi Performa Toko**:
   - Membedah arus kas riil: Kas Masuk (*Cash Inflow* = Penjualan Tunai + Pelunasan Kasbon + Kas Masuk Laci) versus Kas Keluar (*Cash Outflow* = Biaya Operasional Toko + Refund Tunai) menghasilkan Arus Kas Bersih (*Net Cash Flow*).
   - Visualisasi dinamika omset harian (30 hari terakhir) dan omset bulanan (12 bulan terakhir) via grafik SVG native interaktif yang elegan tanpa pustaka berat eksternal.
   - Rekapitulasi mutasi harian, log pergerakan kas fisik terkini, dan ekspor CSV berstandar UTF-8 BOM untuk Microsoft Excel.

---

## 🏗️ Arsitektur Data & Model Database

### 1. Enum & Model Baru pada `prisma/schema.prisma`
- **Enum `CustomerDebtStatus`**: `UNPAID` | `PARTIAL` | `PAID` | `CANCELLED`.
- **Enum `PaymentMethod`**: Ditambahkan value `CUSTOMER_DEBT`.
- **Model `CustomerDebt`**:
  - Kolom: `id`, `tenantId`, `outletId`, `customerId`, `orderId`, `totalAmount`, `paidAmount`, `remainingAmount`, `dueDate`, `status`, `notes`, `createdAt`, `updatedAt`.
  - Relasi ke: `Tenant`, `Outlet`, `Customer`, `Order`, `CustomerDebtPayment`.
- **Model `CustomerDebtPayment`**:
  - Kolom: `id`, `tenantId`, `debtId`, `outletId`, `cashierId`, `shiftId`, `amount`, `paymentMethod`, `referenceNumber`, `notes`, `paidAt`, `createdAt`.
  - Relasi ke: `Tenant`, `CustomerDebt`, `Outlet`, `User` (kasir), `Shift`.
- **Relasi Balik `Order.customerDebt` & `Customer.debts`**:
  - Relasi 1-ke-1 dari `Order` ke `CustomerDebt`.
  - Relasi 1-ke-N dari `Customer` ke `CustomerDebt`.

### 2. Migrasi Skema Database Idempotent
- Didaftarkan pada array `SCHEMA_PATCHES` di `pos_apps/server/src/migrations/schema_patcher.ts`:  
  Patch `20261006_02_customer_debts_and_payments`.
- Diterapkan langsung ke Supabase PostgreSQL 16 via CLI `npm run db:remote:patch`.

---

## 🔌 Rincian Endpoint Backend API

### 1. Modul Piutang Pelanggan (`/api/customers`)
- `GET /api/customers/debts`:
  - Query parameters: `search`, `status` (`UNPAID`, `PARTIAL`, `PAID`), `customerId`, `outletId`, `page`, `limit`.
  - Output: `data` (daftar piutang), `summary` (`totalDebt`, `totalPaid`, `totalRemaining`, `unpaidCount`), `meta` (paginasi).
- `GET /api/customers/debts/:debtId`:
  - Rincian detail pesanan, nama item, varian, harga, dan histori seluruh pembayaran cicilan/lunas yang masuk.
- `POST /api/customers/debts/:debtId/payments`:
  - Payload: `{ amount, paymentMethod, shiftId, notes, referenceNumber }`.
  - Transaksi atomik:
    1. Validasi saldo sisa piutang.
    2. Pembuatan record `CustomerDebtPayment`.
    3. Update `paidAmount`, `remainingAmount`, dan status (`PAID` / `PARTIAL`) pada `CustomerDebt`.
    4. Update status pembayaran pada `Order` (`PAID` / `PARTIALLY_PAID`).
    5. Pencatatan `PaymentTransaction`.
    6. Jika metode `CASH`, otomatis mencatat `CashMovement` (`CASH_IN` kategori `DEBT_REPAYMENT`) dan memperbarui `expectedEnding` pada kasir `Shift` aktif.

### 2. Modul Laporan Arus Kas & Performa Toko (`/api/reports`)
- `GET /api/reports/cash-flow`:
  - Query parameters: `startDate`, `endDate`, `outletId`.
  - Output:
    - `summary`: `totalCashSales`, `totalDebtRepayments`, `totalManualCashIn`, `totalCashInflow`, `totalCashOut`, `totalRefunds`, `totalCashOutflow`, `netCashFlow`, `outstandingReceivables`, `unpaidReceivablesCount`.
    - `dailyBreakdown`: Rincian harian arus kas masuk, keluar, dan saldo neto per tanggal.
    - `recentMovements`: 30 mutasi pergerakan kas fisik terkini beserta informasi kasir dan shift.
- `GET /api/reports/sales-performance`:
  - Query parameters: `startDate`, `endDate`, `outletId`.
  - Output:
    - `summary`: `totalRevenue`, `totalOrders`, `avgOrderValue`, `bestDay` (`date`, `revenue`).
    - `dailyTrend`: Tren harian 30 hari terakhir.
    - `monthlyTrend`: Tren bulanan 12 bulan terakhir.

---

## 🎨 Implementasi Antarmuka Pengguna (Frontend UI/UX)

1. **Pengaturan Pembayaran Toko (`PaymentSettingsView.tsx`)**:
   - Kartu pengaturan *"Kasbon & Piutang Pelanggan (Pay Later)"*.
   - Toggle aktif/nonaktif izin kasbon per-outlet (default: **Nonaktif**).
   - Dropdown pilihan batas jatuh tempo (+7 hari, +14 hari, +30 hari, atau tanggal fleksibel).
2. **Terminal Kasir POS (`PaymentModal.tsx`)**:
   - Tab metode pembayaran ke-4 *"Kasbon"*, hanya muncul jika diizinkan oleh outlet.
   - Guard visual: Wajib memilih pelanggan terdaftar dengan tombol 1-klik *"Pilih Pelanggan Sekarang"*.
   - Input tanggal jatuh tempo & catatan kasbon kasir.
3. **Buku Kasbon Backoffice (`CustomerDebtsTab.tsx` di `CustomersView.tsx`)**:
   - Subtab di bagian atas *Master Data Pelanggan*: Tab 1 *Direktori & Loyalitas*, Tab 2 *Buku Kasbon & Piutang*.
   - 4 Kartu KPI: Sisa Piutang Aktif, Faktur Menunggak, Piutang Terbayar, Total Transaksi Kasbon.
   - Filter bar pencarian & tombol status: *Semua*, *Belum Lunas*, *Dicicil*, *Lunas*.
   - Tabel kanonikal dengan `<TablePagination />` (10/25/50/100 baris).
   - Tombol penagihan 1-klik WhatsApp dengan pesan tagihan terformat ramah.
   - Modal Rincian Kasbon & Modal Pelunasan Piutang sesuai **Pola Kanonikal Modal Form Responsif PWA (Aturan #10)** & **Zero Stacked Modals (Aturan #2)**.
4. **Laporan Arus Kas Riil & Performa Toko (`CashFlowReportTab.tsx` di `FinancialReportView.tsx`)**:
   - Subtab di bagian atas: Tab 1 *Laba Rugi & Finansial (P&L)*, Tab 2 *Arus Kas Riil & Performa Toko*.
   - 4 Kartu KPI Arus Kas: Total Arus Kas Masuk, Total Arus Kas Keluar, Arus Kas Bersih (Surplus/Defisit), dan Piutang Belum Tertagih.
   - Grafik Tren Performa Penjualan & Omset Toko dengan mode switcher *Harian (30 Hari)* vs *Bulanan (12 Bulan)* berbasis SVG native murni dengan interactive tooltip.
   - Tabel Rekapitulasi Arus Kas Harian & Tabel Riwayat Mutasi Kas Terkini dengan paginasi kanonikal.
   - Ekspor berkas CSV UTF-8 BOM untuk Microsoft Excel.

---

## ✅ Verifikasi & Hasil Pengujian
- **Pemeriksaan Skema Database**: Tabel `customer_debts` dan `customer_debt_payments` aktif di Supabase PostgreSQL 16.
- **Pemeriksaan Build Server**: `npm run build` di `pos_apps/server` $\rightarrow$ **Exit code 0**.
- **Pemeriksaan Build Client**: `npm run build` di `pos_apps/client` $\rightarrow$ **Exit code 0**.
