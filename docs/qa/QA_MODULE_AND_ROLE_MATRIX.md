# WELL POS — QA MODULE AND ROLE MATRIX
## Role-Based Access Control (RBAC), Permission Matrix & Feature Boundaries

> **Audit Type**: Strict Read-Only Discovery Audit (Antigravity Prompt 1)  
> **Repository**: `/Users/dendyaditya/Projects/pos_project`  
> **Audit Date**: 12 Oktober 2026  
> **Status**: COMPLETED ✅  

---

### 1. DEFINISI ROLE KANONIKAL SISTEM

Well POS mengimplementasikan 7 peran pengguna yang terisolasi secara ketat di tingkat UI (`ROLE_TABS` di [`DashboardPage.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/DashboardPage.tsx)) dan otorisasi API backend (`auth.middleware.ts`):

1. **`SUPERADMIN`**: Pengelola platform Well POS SaaS (Portal `#hq-gate-99`). Mengaudit tenant, verifikasi pendaftaran owner, manajemen paket langganan, dan pemeliharaan platform.
2. **`OWNER`**: Pemilik merchant/bisnis. Memiliki kendali penuh 100% atas seluruh toko fisik, gudang, resep rahasia HPP, laporan finansial, kasbon, tim staf, dan langganan token.
3. **`ADMIN`**: Administrator operasional toko. Memiliki hak setara owner kecuali pembatalan akun bisnis dan mutasi super-kritis.
4. **`SUPERVISOR`**: Pengawas operasional harian. Memegang PIN supervisor untuk otorisasi pembatalan transaksi (VOID), pembukaan laci darurat, serta audit selisih kas fisik shift kasir.
5. **`CASHIER`**: Staf kasir garda depan. Hanya mengakses Terminal Kasir POS, pencatatan transaksi nota, penerimaan pembayaran multi-tender, absensi staf, dan tutup shift kasir.
6. **`WAREHOUSE`**: Staf logistik pergudangan. Terisolasi ketat di rantai pasok (Bahan Baku, Multi-Gudang, Kartu Stok Mutasi, PO, Transfer Stok Antar-Cabang). Tidak memiliki akses ke omset kasir, rekening bank, atau laba rugi bisnis.
7. **`KITCHEN`**: Staf dapur/koki. Terisolasi ketat di Kitchen Display System (`qr_orders` KDS). Hanya melihat antrean tiket masak pesanan masuk, formula resep masakan, dan tombol tandai hidangan siap saji.

---

### 2. MATRIKS HAK AKSES PERAN & MODUL (RBAC MATRIX)

Keterangan simbol:
- **`CRUD`**: Akses penuh (Create, Read, Update, Delete).
- **`RO`**: Akses baca saja (Read Only).
- **`SPEC`**: Akses bersyarat khusus (misal: Otorisasi PIN / Approval).
- **`—`**: Ditolak / Tidak memiliki akses (Blocked).

| Rumpun Modul | Modul Fitur | `SUPERADMIN` | `OWNER` | `ADMIN` | `SUPERVISOR` | `CASHIER` | `WAREHOUSE` | `KITCHEN` | Bukti Kode |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Platform SaaS** | Tenant Governance & Approval | `CRUD` | — | — | — | — | — | — | [`platform.routes.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/routes/platform.routes.ts) |
| | Token Pakasir & Billing | `CRUD` | `CRUD` | `CRUD` | — | — | — | — | [`saas.routes.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/routes/saas.routes.ts) |
| **Kasir & Transaksi** | Terminal POS (`pos`) | — | `CRUD` | `CRUD` | `CRUD` | `CRUD` | — | — | [`PosTerminalView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/PosTerminalView.tsx) |
| | Riwayat Nota (`orders`) | — | `CRUD` | `CRUD` | `CRUD` | `RO` | — | — | [`OrdersView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/OrdersView.tsx) |
| | Pembatalan Nota (VOID Order) | — | `SPEC` (PIN) | `SPEC` (PIN)| `SPEC` (PIN)| — | — | — | [`EPIC-24`](file:///Users/dendyaditya/Projects/pos_project/docs/epics/EPIC-24_TRANSACTION_VOID_AND_SUPERVISOR_APPROVAL.md) |
| | Shift Kasir (X/Z Report) | — | `CRUD` | `CRUD` | `CRUD` | `SPEC` (Own) | — | — | [`ShiftsAuditView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/ShiftsAuditView.tsx) |
| | KDS Dapur (`qr_orders`) | — | `CRUD` | `CRUD` | `CRUD` | `RO` | — | `CRUD` | [`QrLiveOrdersView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/QrLiveOrdersView.tsx) |
| **Katalog & Resep** | Produk & Varian (`products`) | — | `CRUD` | `CRUD` | `RO` | — | `RO` | — | [`ProductsView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/ProductsView.tsx) |
| | Kategori Menu (`categories`) | — | `CRUD` | `CRUD` | `RO` | — | — | — | [`CategoriesView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/CategoriesView.tsx) |
| | Topping & Add-ons (`modifiers`)| — | `CRUD` | `CRUD` | `RO` | — | — | — | [`ModifiersView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/ModifiersView.tsx) |
| | Formula BOM Resep (`recipes`) | — | `CRUD` | `CRUD` | `RO` | — | `RO` | `RO` | [`RecipesView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/RecipesView.tsx) |
| **Rantai Pasok** | Saldo Bahan Baku (`inventory`) | — | `CRUD` | `CRUD` | `RO` | — | `CRUD` | — | [`InventoryView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/InventoryView.tsx) |
| | Multi-Gudang (`warehouses`) | — | `CRUD` | `CRUD` | `RO` | — | `CRUD` | — | [`WarehousesView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/WarehousesView.tsx) |
| | Log Mutasi Stok (`stock_mov`) | — | `RO` | `RO` | `RO` | — | `RO` | — | [`StockMovementsView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/StockMovementsView.tsx) |
| | Purchase Orders (`purchasing`) | — | `CRUD` | `CRUD` | `RO` | — | `CRUD` | — | [`PurchaseOrdersView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/PurchaseOrdersView.tsx) |
| | Transfer Antar-Toko (`transfers`)| — | `CRUD` | `CRUD` | `RO` | — | `CRUD` | — | [`StockTransfersView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/StockTransfersView.tsx) |
| | Direktori Pemasok (`suppliers`) | — | `CRUD` | `CRUD` | `RO` | — | `CRUD` | — | [`SuppliersView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/SuppliersView.tsx) |
| **CRM & Keuangan** | Pelanggan & Kasbon (`customers`) | — | `CRUD` | `CRUD` | `CRUD` | `SPEC` (Kasbon)| — | — | [`CustomersView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/CustomersView.tsx) |
| | Promosi & Kupon (`promotions`) | — | `CRUD` | `CRUD` | `RO` | — | — | — | [`PromotionsView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/PromotionsView.tsx) |
| | Laba Rugi & HPP (`reports`) | — | `CRUD` | `CRUD` | `RO` | — | — | — | [`FinancialReportView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/FinancialReportView.tsx) |
| | Top Produk (`product_analytics`)| — | `CRUD` | `CRUD` | `RO` | — | — | — | [`ProductAnalyticsView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/ProductAnalyticsView.tsx) |
| **SDM & Toko** | Kelola Staf & PIN (`users`) | — | `CRUD` | `CRUD` | — | — | — | — | [`UsersView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/UsersView.tsx) |
| | Absensi Jam Kerja Staf | — | `CRUD` | `CRUD` | `RO` | `SPEC` (Own) | `SPEC` (Own)| `SPEC` (Own)| [`StaffAttendanceModal.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/pos/StaffAttendanceModal.tsx) |
| | Pengaturan Toko & Pajak | — | `CRUD` | `CRUD` | — | — | — | — | [`OutletsView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/OutletsView.tsx) |

---

### 3. ALUR KERJA BISNIS UTAMA (CORE END-TO-END WORKFLOWS)

1. **Alur Transaksi Kasir F&B Standar**:
   - `Buka Shift (Modal Kas)` ➔ `Pilih Produk & Varian` ➔ `Pilih Modifier/Topping` ➔ `Pilih Metode Bayar (Tunai/QRIS/Split)` ➔ `Input Uang Diterima & Kembalian` ➔ `Audio Chime Sukses` ➔ `Cetak Struk Thermal` ➔ `Otomatis Kurangi Saldo Stok Bahan Baku (BOM)` ➔ `Kirim Tiket Masak ke KDS Dapur`.
2. **Alur Pelanggan Kasbon (Piutang)**:
   - `Kasir Checkout` ➔ `Pilih Metode Bayar Kasbon` ➔ `Pilih Member Customer` ➔ `Tentukan Jatuh Tempo (+7/14/30 hari)` ➔ `Pesanan Selesai (Status: Belum Lunas)` ➔ `Customer Bayar Cicilan di Kasir / Backoffice` ➔ `Mutasi Uang Masuk Laci Kasir (DEBT_REPAYMENT)` ➔ `Saldo Kasbon Terpotong`.
3. **Alur Pembatalan Transaksi (VOID) Terotorisasi**:
   - `Kasir / Spv Buka Riwayat Transaksi` ➔ `Klik Void Transaksi` ➔ `Muncul Modal Otorisasi PIN` ➔ `Supervisor / Owner Masukkan PIN 6 Digit` ➔ `Pilih Alasan Pembatalan (Salah Input / Pelanggan Batal / Rusak)` ➔ `Sistem Rollback Saldo Stok Bahan Baku Otomatis` ➔ `Cetak Slip Fisik Bukti Void dengan Tanda Tangan Kasir & Spv` ➔ `Omset Shift Terkoreksi`.
4. **Alur Tutup Shift Kasir (Z-Report Lock Proteksi)**:
   - `Kasir Klik Tutup Shift` ➔ `Sistem Periksa Tagihan Menggantung (Open Tab / Unpaid)` ➔ `Jika Ada Unpaid: Ditolak Keras (Lock Unpaid Orders)` ➔ `Jika Bersih: Kasir Hitung Fisik Kas Laci (Kalkulator Pecahan)` ➔ `Sistem Bandingkan Kas Sistem vs Kas Fisik` ➔ `Cetak Slip Z-Report Murni Rekapitulasi (Tanpa Rincian Invoice)`.
