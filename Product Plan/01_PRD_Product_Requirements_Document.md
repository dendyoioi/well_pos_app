# Product Requirements Document (PRD)
## Multi-Purpose Point of Sale (POS) & Retail Management System

---

## 1. Ringkasan Produk (Executive Summary)
Aplikasi **POS (Point of Sale) Multi-Purpose** ini dirancang untuk operasional kasir berbasis desktop/web browser (Windows & Mac) untuk kebutuhan ritel, minimarket, dan toko umum. Sistem beroperasi secara **Online-Only** dengan arsitektur multi-outlet yang tersentralisasi di cloud. 

Sistem ini menggabungkan:
1. **Frontend Kasir Cepat & Responsif**: Mendukung pencarian produk, scan barcode, diskon, pajak, service charge, dan metode bayar Tunai & QRIS.
2. **Manajemen Struk Fleksibel**: Cetak thermal printer (58mm & 80mm via Web USB/Bluetooth/Browser Print), ekspor PDF, dan pengiriman struk digital via Email.
3. **Manajemen Inventori**: Pelacakan stok masuk (stock-in), stok keluar (stock-out), dan penyesuaian stok antar-outlet.
4. **Shift & Rekap Kasir (X/Z Report)**: Buka shift, pencatatan kas modal awal, kas akhir, selisih kas, dan laporan akuntansi ringkas (pendapatan, COGS/HPP, laba kotor).
5. **Multi-Role & Multi-Outlet**: Akses berjenjang untuk Kasir, Supervisor, Gudang, dan Owner/Admin.

---

## 2. Pengguna & Hak Akses (User Roles & Permissions)

| Role | Tanggung Jawab Utama | Batasan Akses |
| :--- | :--- | :--- |
| **Owner / Admin** | Pemilik bisnis / Superadmin | Akses penuh: manajemen outlet, tambah user, laporan finansial, ubah harga, hapus data. |
| **Supervisor** | Kepala toko / Manager cabang | Menyetujui void/batal transaksi, edit diskon khusus, verifikasi tutup shift (Z-Report), audit kas. |
| **Gudang (Warehouse)** | Pengelola persediaan barang | Input stok masuk (*purchase order*), stok opname, mutasi antar cabang, retur barang. |
| **Kasir (Cashier)** | Petugas kasir di outlet | Input transaksi penjualan, buka/tutup shift (X-Report), cetak struk, terima uang tunai/QRIS. |

---

## 3. Rincian Modul & Kebutuhan Fungsional (Core Modules)

### 3.1 Modul Kasir & Transaksi Penjualan (POS Checkout)
* **Katalog & Pemilihan Item**:
  * Tampilan grid kartu produk dengan gambar & list table ringkas.
  * Pencarian instan (nama produk, SKU, kategori).
  * Input otomatis via Barcode Scanner (USB keyboard emulation).
* **Keranjang Belanja**:
  * Pengaturan jumlah (quantity), catatan per item (notes).
  * Diskon per item (nominal / persen) dan diskon global pada subtotal.
  * Kalkulasi otomatis Pajak (PPN misal 11%) dan Service Charge (opsional, jika diterapkan).
* **Pembayaran**:
  * **Tunai (Cash)**: Input nominal diterima, tombol cepat uang pas (Rp 10.000, 20.000, 50.000, 100.000), perhitungan otomatis kembalian (*change*).
  * **QRIS**: Menampilkan QR code dinamis atau referensi QRIS statis outlet, konfirmasi status bayar.
* **Void & Pembatalan Item**: Membutuhkan PIN / otorisasi Supervisor jika transaksi sudah berjalan atau item dihapus.

---

### 3.2 Modul Struk & Dokumen Transaksi (Receipt Management)
* **Cetak Thermal Printer**:
  * Pilihan format lebar kertas: **58mm** (32 karakter/baris) dan **80mm** (42-48 karakter/baris).
  * Konten struk: Nama outlet, alamat, nomor telepon, no. invoice, tanggal & jam, nama kasir, daftar item + harga, subtotal, diskon, pajak, total, metode bayar, uang diterima & kembalian, serta pesan kaki (*footer note*).
  * Opsi driver: Browser Print Dialog, Web USB / Web Bluetooth (ESC/POS commands).
* **Ekspor & Kirim Digital**:
  * Unduh struk dalam format **PDF**.
  * Kirim struk ke **Email** pelanggan dengan template HTML profesional.

---

### 3.3 Modul Inventori & Multi-Outlet (Inventory Management)
* **Multi-Outlet**:
  * Satu master akun dapat memiliki banyak outlet/cabang.
  * Harga jual dan stok dapat diatur spesifik per outlet.
* **Manajemen Stok**:
  * **Stok Masuk (Stock In)**: Penerimaan barang dari supplier / pembelian.
  * **Stok Keluar (Stock Out)**: Pengurangan stok non-penjualan (barang rusak/expired, penggunaan internal).
  * **Stok Opname**: Penyesuaian fisik berkala dengan riwayat catatan selisih (*variance log*).
  * **Alert Stok Minimum**: Notifikasi jika stok mendekati batas minimum (*low stock alert*).

---

### 3.4 Modul Kasir Shift & Laporan Kas (Cash Management)
* **Alur Buka Shift (Start Shift)**:
  * Kasir memasukkan modal awal kas (*starting cash / cash float*).
* **Laporan Selama Shift (X-Report)**:
  * Melihat ringkasan penjualan sementara tanpa menutup sesi kasir.
* **Tutup Shift (End Shift / Z-Report)**:
  * Kasir menghitung uang fisik di laci kas (*cash count*).
  * Sistem menghitung selisih (*over/short*).
  * Cetak slip rekap shift kasir ke printer thermal.

---

### 3.5 Modul Laporan Finansial & Akuntansi Sederhana
* **Laporan Penjualan**: Filter berdasarkan tanggal, outlet, kasir, dan metode pembayaran.
* **Laporan Produk Terlaris**: Top 10 barang paling laku dan barang dengan margin tertinggi.
* **Laporan Akuntansi Sederhana**:
  * **Pendapatan Bersih (Net Revenue)**: Total penjualan kotor - diskon.
  * **HPP / COGS (Cost of Goods Sold)**: Total harga modal barang yang terjual.
  * **Laba Kotor (Gross Profit)**: Pendapatan Bersih - HPP.
  * **Rekap Arus Kas (Cash Flow Summary)**: Total kas masuk tunai vs QRIS vs kas keluar penyesuaian.

---

## 4. Kebutuhan Non-Fungsional (Non-Functional Requirements)

1. **Kecepatan Transaksi**: Waktu render pencarian item < 100ms; proses submit transaksi < 1 detik.
2. **Keamanan & Autentikasi**:
   * JWT (JSON Web Token) dengan refresh token atau HTTP-only Secure Cookies.
   * Password hashing dengan bcrypt/Argon2.
   * Role-based access control (RBAC) pada setiap endpoint API.
3. **Kompatibilitas Layar**:
   * Dioptimasi untuk layar Desktop PC (resolusi 1366x768 ke atas, 1920x1080 Full HD).
   * Tata letak intuitif kasir minimarket: Keranjang di sisi kanan/kiri yang selalu terlihat (*sticky*), tombol aksi besar dan ramah klik/touchscreen.
4. **Dukungan Keyboard Shortcuts**:
   * `F2`: Fokus pencarian / barcode.
   * `F4`: Buka dialog pembayaran.
   * `F9`: Batal transaksi.
   * `Enter`: Selesaikan transaksi tunai pas.
