# WELL POS — QA TEST CASES SPECIFICATION
## Comprehensive End-to-End, Functional, Security & Visual Test Cases Matrix

> **Phase**: Test Design & Business Rule Validation (Antigravity Prompt 2)  
> **Repository**: `/Users/dendyaditya/Projects/pos_project`  
> **Date**: 12 Oktober 2026  
> **Execution Status**: `NOT RUN` (Design Phase Only)  

---

### 1. DAFTAR TEST CASE RESMI (TEST SUITE SPECIFICATION)

#### TC-AUTH-001: Autentikasi Superadmin via Secret URL & Guard Honeypot
- **Module**: SaaS Platform Governance (`SuperadminDashboardPage.tsx`)
- **User Role**: `SUPERADMIN`
- **Priority**: `P0` (Release Blocker — Keamanan platform)
- **Test Type**: Security / Functional & Visual
- **Preconditions**: Aplikasi berjalan di `http://localhost:5173`, akun default superadmin aktif di seeder.
- **Test Data**: URL `#hq-gate-99`, Kredensial `superadmin@wellpos.id` / `SuperAdmin123!`.
- **Step-by-step Actions**:
  1. Akses `http://localhost:5173/#admin` dan `http://localhost:5173/#superadmin`.
  2. Verifikasi honeypot mengalihkan URL ke `/#landing`.
  3. Akses `http://localhost:5173/#hq-gate-99`.
  4. Klik tombol "Gunakan Akun Default Superadmin" atau input email & password.
  5. Klik "Masuk ke Portal Platform".
- **Expected UI Result**: Portal Control Tower SuperAdmin terbuka menampilkan metrik tenant, tanpa kebocoran di URL publik biasa.
- **Expected Business Result**: Sesi SuperAdmin tervalidasi dengan token JWT platform khusus.
- **Expected Persisted Result**: API `POST /api/platform/auth/login` menghasilkan HTTP 200 dan token sesi JWT.
- **Cleanup Requirements**: Logout dan bersihkan `localStorage`.
- **Evidence Requirements**: Screenshot dashboard superadmin & HTTP status log.
- **Execution Status**: `NOT RUN`

---

#### TC-AUTH-002: Autentikasi Merchant Owner & Buka Backoffice Terpadu
- **Module**: Authentication & Navigation (`LoginPage.tsx`, `DashboardPage.tsx`)
- **User Role**: `OWNER`
- **Priority**: `P0` (Alur Utama Bisnis)
- **Test Type**: Functional & Visual
- **Preconditions**: Tenant Ura Coffee aktif dalam database sandbox.
- **Test Data**: Email `owner@uracoffee.id`, Password `Owner123!`.
- **Step-by-step Actions**:
  1. Buka `http://localhost:5173/#login`.
  2. Pilih tab "Pemilik / Backoffice".
  3. Input email dan password.
  4. Klik tombol "Masuk ke Backoffice".
- **Expected UI Result**: Halaman `DashboardPage` terbuka dengan salam selamat datang, sidebar accordion 8 rumpun modul, dan badge outlet aktif.
- **Expected Business Result**: Owner memiliki akses 100% ke seluruh menu (Overview, Produk, Resep BOM, Stok, PO, Laporan Finansial).
- **Expected Persisted Result**: Token JWT tersimpan di `wellpos_platform_auth_token` dengan `user.role === 'OWNER'`.
- **Cleanup Requirements**: None.
- **Evidence Requirements**: Screenshot Ringkasan Bisnis Backoffice Owner.
- **Execution Status**: `NOT RUN`

---

#### TC-SHIFT-001: Buka Shift Kasir dengan Modal Awal Kas Laci
- **Module**: Kasir & Manajemen Shift (`PosTerminalView.tsx`, `ShiftsAuditView.tsx`)
- **User Role**: `CASHIER`
- **Priority**: `P0` (Prasyarat Integritas Kas Kasir)
- **Test Type**: Functional & State Transition
- **Preconditions**: Shift kasir toko `ura-coffee` outlet `Kemang (OUT-01)` sedang dalam status tertutup (`CLOSED`).
- **Test Data**: Modal Kas Awal: Rp 100.000.
- **Step-by-step Actions**:
  1. Buka Terminal Kasir POS (`http://localhost:5173/#pos`).
  2. Dialog "Buka Shift Kasir" muncul secara otomatis.
  3. Masukkan nominal kas awal modal laci: `100000` via `<CurrencyInput />`.
  4. Klik tombol "Mulai Shift Kasir".
- **Expected UI Result**: Modal buka shift tertutup, terminal kasir aktif terbuka penuh menampilkan katalog produk, tombol "Tutup Shift" muncul di header.
- **Expected Business Result**: Record shift berstatus `OPEN` dibuat di database dengan saldo kas awal tercatat Rp 100.000.
- **Expected Persisted Result**: Record baru di tabel Prisma `Shift` (`status = OPEN`, `openingCash = 100000`).
- **Cleanup Requirements**: Selesaikan transaksi dan tutup shift di akhir pengujian.
- **Evidence Requirements**: Screenshot Terminal Kasir dalam kondisi shift aktif.
- **Execution Status**: `NOT RUN`

---

#### TC-POS-001: Checkout Transaksi Kasir F&B dengan Resep BOM, Modifier & Tunai
- **Module**: Terminal Kasir POS (`PosTerminalView.tsx`)
- **User Role**: `CASHIER`
- **Priority**: `P0` (Alur Penjualan Paling Kritis)
- **Test Type**: Functional, Visual, dan Audio Synthetic
- **Preconditions**: Shift aktif, produk F&B "Es Kopi Susu Gula Aren" memiliki resep BOM (Kopi 18g, Susu 120ml, Cup 1pcs) dan modifier "Extra Shot (+Kopi 9g, Rp 5.000)".
- **Test Data**: 1x Es Kopi Susu Gula Aren (Rp 22.000) + Modifier Extra Shot (Rp 5.000) = Subtotal Rp 27.000. Bayar Tunai: Rp 50.000.
- **Step-by-step Actions**:
  1. Klik kartu produk "Es Kopi Susu Gula Aren".
  2. Pada modal varian/modifier, centang opsi "Extra Shot (+Rp 5.000)".
  3. Klik "Tambahkan ke Pesanan".
  4. Klik tombol "Bayar Pesanan (Rp 27.000)".
  5. Pilih metode pembayaran "Tunai (Cash)".
  6. Masukkan uang diterima Rp 50.000.
  7. Periksa kalkulasi kembalian: Rp 23.000.
  8. Klik "Selesaikan Transaksi".
- **Expected UI Result**: Audio chime sukses berbunyi (`playCashierSuccess`), dialog sukses pembayaran muncul menampilkan kembalian Rp 23.000 dan nomor antrean panggilan (misal `#01`).
- **Expected Business Result**: Transaksi lunas (`PAID`), nota kasir tercatat, pesanan masuk ke antrean KDS Dapur.
- **Expected Persisted Result**: Record `Order` (`total = 27000`, `paymentStatus = PAID`), `PaymentTransaction` (`amount = 27000`, `method = CASH`).
- **Cleanup Requirements**: None.
- **Evidence Requirements**: Screenshot modal sukses pembayaran & nomor antrean.
- **Execution Status**: `NOT RUN`

---

#### TC-INV-001: Verifikasi Pemotongan Saldo Stok Bahan Baku Otomatis (BOM Deduction)
- **Module**: Inventory Ledger & BOM Engine (`InventoryView.tsx`, `RecipesView.tsx`)
- **User Role**: `OWNER` / `WAREHOUSE`
- **Priority**: `P0` (Integritas HPP & Persediaan Bahan Baku)
- **Test Type**: Business Logic & Data Persistence Verification
- **Preconditions**: Transaksi TC-POS-001 telah berhasil diselesaikan.
- **Test Data**: Biji Kopi Espresso (terpotong 18g + 9g = 27g), Susu Fresh Milk (terpotong 120ml), Paper Cup (terpotong 1 pcs).
- **Step-by-step Actions**:
  1. Buka Backoffice Owner tab "Bahan Baku & Stok" (`#dashboard` tab `inventory`).
  2. Buka kartu stok mutasi ("Log Mutasi Stok").
  3. Filter transaksi penjualan terbaru.
- **Expected UI Result**: Nilai saldo stok berkurang sesuai formula resep BOM.
- **Expected Business Result**: Kartu stok mencatat entri mutasi tipe `SALE` dengan referensi order ID terkait.
- **Expected Persisted Result**: Record di tabel Prisma `InventoryLedger` (`movementType = SALE`, `quantity = -27` untuk Biji Kopi).
- **Cleanup Requirements**: None.
- **Evidence Requirements**: Log baris mutasi stok bahan baku.
- **Execution Status**: `NOT RUN`

---

#### TC-POS-002: Transaksi Pembayaran Non-Tunai QRIS Simulator & Anti-Falsifikasi
- **Module**: Terminal Kasir POS & Gateway Pembayaran (`PosTerminalView.tsx`)
- **User Role**: `CASHIER`
- **Priority**: `P0` (Kepatuhan Aturan Anti-Falsifikasi QRIS - AGENTS.md Poin 14)
- **Test Type**: Functional & Visual
- **Preconditions**: Shift kasir aktif.
- **Test Data**: 1x Americano (Rp 18.000), Metode: QRIS.
- **Step-by-step Actions**:
  1. Tambah 1x Americano ke keranjang kasir.
  2. Klik "Bayar Pesanan" ➔ Pilih metode "QRIS".
  3. Modal QRIS Simulator muncul menampilkan QR Code dinamis dan nominal Rp 18.000.
  4. Klik tombol "Simulasikan Pembayaran Berhasil".
- **Expected UI Result**: Status pembayaran otomatis terverifikasi lunas, audio chime sukses kasir berbunyi, badge transaksi berstatus "QRIS" warna biru/hijau.
- **Expected Business Result**: Omset QRIS bertambah tepat Rp 18.000 pada rekapan kasir.
- **Expected Persisted Result**: Record `PaymentTransaction` (`method = QRIS`, `amount = 18000`, `status = SUCCESS`).
- **Cleanup Requirements**: None.
- **Evidence Requirements**: Screenshot modal simulasi QRIS & badge pembayaran nota.
- **Execution Status**: `NOT RUN`

---

#### TC-VOID-001: Pembatalan Transaksi (VOID) dengan Otorisasi PIN Supervisor & Rollback Stok
- **Module**: Riwayat Transaksi & Void Engine (`OrdersView.tsx`)
- **User Role**: `SUPERVISOR` / `OWNER`
- **Priority**: `P0` (Integritas Pembatalan Finansial - EPIC-24)
- **Test Type**: Security, Financial Integrity & State Transition
- **Preconditions**: Terdapat transaksi yang telah lunas (misal TC-POS-002).
- **Test Data**: PIN Supervisor: `123456`, Alasan: "Pelanggan Salah Pesan".
- **Step-by-step Actions**:
  1. Buka menu "Riwayat Transaksi" (`orders`).
  2. Pilih transaksi terakhir, klik tombol "Batalkan Transaksi (VOID)".
  3. Modal verifikasi PIN Supervisor/Owner muncul.
  4. Masukkan PIN yang salah `000000` (Verifikasi proteksi PIN salah: harus ditolak).
  5. Masukkan PIN yang benar `123456`.
  6. Pilih alasan pembatalan dan konfirmasi.
- **Expected UI Result**: Transaksi berubah status menjadi `VOIDED` dengan badge merah, tombol "Cetak Slip Bukti Void" aktif dengan blok tanda tangan Kasir & Spv.
- **Expected Business Result**: Saldo stok bahan baku Americano dipulihkan secara atomik (tipe `VOID`), omset kasir terkoreksi.
- **Expected Persisted Result**: Record `Order` (`status = VOIDED`), record `InventoryLedger` (`movementType = VOID`, kuantitas positif).
- **Cleanup Requirements**: None.
- **Evidence Requirements**: Screenshot slip void dan badge status VOIDED.
- **Execution Status**: `NOT RUN`

---

#### TC-SHIFT-002: Proteksi Tutup Shift pada Tagihan Menggantung (Lock on Unpaid Orders)
- **Module**: Kasir Shift Lifecycle (`PosTerminalView.tsx`, `ShiftsAuditView.tsx`)
- **User Role**: `CASHIER`
- **Priority**: `P0` (Kepatuhan Integritas Tutup Shift - AGENTS.md Poin 15)
- **Test Type**: Negative Test & Guard Assertion
- **Preconditions**: Shift kasir aktif dan kasir menyimpan 1 transaksi Open Tab / Belum Bayar (`UNPAID`).
- **Test Data**: 1x Pesanan Meja 05 (Status: `UNPAID`).
- **Step-by-step Actions**:
  1. Buat pesanan baru, pilih opsi "Simpan Tagihan (Open Tab)" tanpa pembayaran.
  2. Kasir mencoba mengklik tombol "Tutup Shift".
- **Expected UI Result**: Sistem memblokir penutupan shift, menampilkan alert/toast peringatan merah: "Tidak dapat menutup shift! Masih terdapat tagihan yang belum lunas (Open Tab)", dan menampilkan nomor nota invoice terkait.
- **Expected Business Result**: API backend menolak request penutupan shift dengan status `HTTP 400 UNPAID_ORDERS_REMAINING`. Shift tetap berstatus `OPEN`.
- **Expected Persisted Result**: Record `Shift` tidak berubah (`status` tetap `OPEN`).
- **Cleanup Requirements**: Lunasi tagihan Open Tab tersebut sebelum melanjutkan ke TC-SHIFT-003.
- **Evidence Requirements**: Screenshot modal penolakan tutup shift.
- **Execution Status**: `NOT RUN`

---

#### TC-SHIFT-003: Tutup Shift Kasir, Kalkulator Pecahan Uang & Pure Summary Z-Report
- **Module**: Shift Closing & Z-Report (`PosTerminalView.tsx`, `ShiftsAuditView.tsx`)
- **User Role**: `CASHIER`
- **Priority**: `P0` (Kepatuhan Rekapan Murni Slip - AGENTS.md Poin 13)
- **Test Type**: Financial Audit & Visual Verification
- **Preconditions**: Seluruh tagihan pesanan telah lunas atau di-void (Zero Unpaid Orders).
- **Test Data**: Kas fisik dihitung: Pecahan Rp 100.000 x 1, Rp 50.000 x 1, Rp 20.000 x 1, dll.
- **Step-by-step Actions**:
  1. Klik tombol "Tutup Shift".
  2. Buka kalkulator pecahan uang (*denomination counter*), masukkan jumlah lembar fisik uang.
  3. Periksa rekonsiliasi selisih kas fisik vs kas sistem (Selisih Rp 0 / Toleransi Wajar).
  4. Klik tombol "Konfirmasi Tutup Shift".
  5. Pratinjau slip cetak Z-Report muncul.
- **Expected UI Result**: Slip Z-Report tampil bersih hanya memuat **rekapitulasi finansial murni** (Modal Kas Awal, Penerimaan Tunai, Penerimaan QRIS, Pelunasan Kasbon, Petty Cash, Total Kas Sistem, Kas Fisik, dan Selisih Kas). **TIDAK MERENDER DAFTAR ITEM TRANSAKSI PER NOTA**.
- **Expected Business Result**: Shift resmi ditutup (`CLOSED`), kasir diarahkan kembali ke layar awal atau modal ringkasan akhir.
- **Expected Persisted Result**: Record `Shift` (`status = CLOSED`, `closedAt` terisi, `actualEndingCash` terisi).
- **Cleanup Requirements**: None.
- **Evidence Requirements**: Screenshot slip Z-Report murni tanpa baris transaksi invoice.
- **Execution Status**: `NOT RUN`

---

#### TC-REP-001: Laporan Laba Rugi, HPP Riil & Ekspor CSV UTF-8 BOM
- **Module**: Laporan Finansial Backoffice (`FinancialReportView.tsx`)
- **User Role**: `OWNER`
- **Priority**: `P1` (Analitika Eksekutif)
- **Test Type**: Financial Calculation & Data Export
- **Preconditions**: Shift telah ditutup dan transaksi telah terbukukan.
- **Test Data**: Rentang tanggal "Hari Ini".
- **Step-by-step Actions**:
  1. Login sebagai Owner, buka tab "Laporan" (`#dashboard` tab `reports`).
  2. Periksa metrik Total Omset Penjualan, Total HPP Bahan Baku, Laba Kotor, dan Laba Bersih Operasional.
  3. Periksa kurva tren visual SVG laba kotor.
  4. Klik tombol "Ekspor CSV".
- **Expected UI Result**: Angka finansial konsisten dengan mutasi nota, file CSV terunduh secara bersih dengan header kolom standar.
- **Expected Business Result**: Laba kotor = Omset Bersih - HPP Bahan Baku Riil.
- **Expected Persisted Result**: Berkas CSV ber-encoding UTF-8 dengan BOM marker agar angka ribuan terbuka rapi di Microsoft Excel.
- **Cleanup Requirements**: None.
- **Evidence Requirements**: Screenshot dasbor laporan finansial.
- **Execution Status**: `NOT RUN`
