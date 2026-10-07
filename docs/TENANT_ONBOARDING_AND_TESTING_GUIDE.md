# WELL POS — PANDUAN LENGKAP PENGUJIAN MANUAL & ALUR DEMO TENANT
## End-to-End User Journey: Dari Registrasi Mandiri, Setup Toko, Operasional Kasir, hingga Analisis Bisnis

Dokumen ini adalah **panduan standar operasional (SOP) pengujian manual** sekaligus **skrip alur presentasi (*sales/marketing demo playbook*)** untuk mendemonstrasikan keunggulan platform **Well POS** kepada calon penyewa (*tenant*) baru, baik segmen F&B (Restoran/Kafe) maupun Ritel.

> 📌 **Dokumen Pendamping Marketing Kit**: Untuk materi presentasi sales komprehensif, 5 Core USPs, pitch script per modul, matriks komparasi kompetitor, dan skrip demo 3 menit, buka [`docs/MARKETING_KIT_SALES_PLAYBOOK.md`](./MARKETING_KIT_SALES_PLAYBOOK.md).

---

## 🗺️ PETA ALUR BESAR (THE 8-STAGE JOURNEY)

```text
[ FASE 1: Registrasi & Aktivasi Akun ]
  └── Pendaftaran Mandiri Owner ➔ Verifikasi SuperAdmin ➔ Login Pemilik ➔ Pembuatan Toko Perdana

[ FASE 2: Pengaturan Toko & Identitas Bisnis ]
  └── Profil Toko ➔ Kustomisasi Format Struk ➔ Pajak PB1/Service Charge ➔ Metode Pembayaran / QRIS

[ FASE 3: Manajemen Katalog & Persediaan ]
  └── Kategori Produk ➔ Master Produk & Varian ➔ Bahan Baku Mentah & Resep BOM (F&B) ➔ Cetak Barcode (Ritel)

[ FASE 4: Tata Kelola Staf & Terminal Kasir ]
  └── Pendaftaran Akun Staf Kasir (PIN) ➔ Pairing Perangkat Kasir (Tablet/PC)

[ FASE 5: Operasional Harian Terminal Kasir (POS) ]
  └── Buka Shift Kasir (Modal Awal) ➔ Transaksi Penjualan ➔ Tunai/QRIS/Ojol ➔ Struk Thermal & Struk WA

[ FASE 6: Fitur Operasional Khusus Kasir ]
  └── QR Menu Self-Ordering Meja ➔ Open Bill/Simpan Pesanan ➔ Kasbon Pelanggan ➔ Void dengan PIN Supervisor

[ FASE 7: Tutup Shift & Rekonsiliasi Kasir ]
  └── Hitung Fisik Kas Laci ➔ Laporan X/Z Shift ➔ Deteksi Selisih Kas (Over/Short) ➔ Tutup Shift

[ FASE 8: Laporan & Analisis Bisnis Pemilik ]
  └── Laporan Omzet & Penjualan ➔ Laporan Laba Kotor & HPP Real-Time ➔ Kartu Stok & Audit Mutasi
```

---

## 🚀 FASE 1: REGISTRASI & AKTIVASI AKUN (ONBOARDING)

*Fase ini memastikan akun pemilik terdaftar bersih dan telah divalidasi oleh sistem/admin.*

### 1.1 Pendaftaran Mandiri Calon Pemilik (User/Owner)
1. Buka antarmuka utama di **`http://localhost:5173/#landing`** (atau klik tautan *"Daftar Sekarang"*).
2. Di modal/halaman registrasi, isi formulir 5 field identitas:
   * **Nama Depan**: `Budi`
   * **Nama Belakang**: `Pratama`
   * **Nomor WhatsApp**: `081234567890` *(sistem otomatis menormalkan ke format `+6281234567890`)*
   * **Email Bisnis**: `budi@kopinusantara.id`
   * **Password**: `Rahasia123!` *(dan konfirmasi password)*
3. Klik tombol **Daftar Akun Baru**.
4. Sistem mencatat tenant dengan status **`PENDING`** (Menunggu Verifikasi).

### 1.2 Verifikasi & Persetujuan oleh Platform SuperAdmin
*(Sementara pembayaran otomatis QRIS Pakasir dapat diverifikasi manual oleh SuperAdmin)*
1. Buka tab baru di browser: **`http://localhost:5173/#superadmin`**.
2. Login menggunakan akun SuperAdmin:
   * **Email**: `superadmin@wellpos.id`
   * **Password**: `SuperAdmin123!`
3. Masuk ke menu **Manajemen Merchant & Saldo Token**.
4. Cari calon merchant atas nama **Budi Pratama** (`budi@kopinusantara.id`) pada filter **Menunggu Approval**.
5. Klik tombol **Setujui / Approval** (Status tenant langsung berubah menjadi **`ACTIVE`**).

### 1.3 Login Pemilik & Pembuatan Toko Perdana (First Store Wizard)
1. Kembali ke halaman login: **`http://localhost:5173/#login`**.
2. Pilih tab **Portal Pemilik**.
3. Masukkan kredensial login:
   * **Email**: `budi@kopinusantara.id`
   * **Password**: `Rahasia123!`
4. Karena akun baru belum memiliki toko fisik (`outlets.length === 0`), sistem secara otomatis meluncurkan antarmuka layar penuh: **`FullScreenStoreWizard`**.
5. Lengkapi formulir pembuatan toko pertama:
   * **Nama Brand/Pedagang**: `Kopi Nusantara Group`
   * **Nama Toko / Outlet Pertama**: `Kopi Nusantara - Outlet Malioboro`
   * **Nomor WhatsApp Toko**: `081234567890`
   * **Alamat Fisik**: `Jl. Malioboro No. 45, Yogyakarta`
   * **Kategori Industri**: Pilih `Kedai Kopi / Coffee Shop` (atau kategori F&B / Ritel yang relevan).
6. Klik tombol **Selesaikan & Masuk ke Backoffice**.
7. Sistem membuat outlet aktif perdana dan langsung mengarahkan pengguna ke **Backoffice Pemilik**.

---

## ⚙️ FASE 2: PENGATURAN TOKO & IDENTITAS BISNIS

*Langkah awal di Backoffice sebelum memulai jualan agar tampilan struk dan kalkulasi harga rapi.*

1. **Pengaturan Format Struk (`#receipt-settings`)**:
   * Masuk ke menu **Pengaturan** ➔ **Format Struk**.
   * Atur **Kop Struk**: Nama Toko, Slogan, Alamat, dan No. Telp/WA Toko.
   * Atur **Footer Struk**: Pesan penutup (contoh: *"Terima kasih atas kunjungan Anda! Follow IG @kopinusantara"*).
   * Atur **Lebar Kertas**: Pilih `58mm` (standar mini thermal) atau `80mm`.
   * Atur **Nomor Antrean (Calling Queue)**: Aktifkan sakelar jika ingin mencetak nomor antrean panggilan kasir (contoh: `#01`, `#02`).
   * Lihat pratinjau live (*live thermal receipt preview*) di sisi kanan layar.
2. **Pengaturan Pajak & Biaya Tambahan (`#taxes-settings`)**:
   * Jika bisnis F&B mengenakan pajak restoran daerah: Aktifkan **PB1 (10%)**.
   * Jika ada biaya layanan: Aktifkan **Service Charge (5%)**.
   * Jika bisnis menerapkan biaya kemasan takeaway: Masukkan nominal (contoh: `Rp 2.000`).
3. **Pengaturan Metode Pembayaran & QRIS (`#payment-settings`)**:
   * Unggah gambar QRIS Statis toko (BCA, Mandiri, Gopay, atau QRIS DANA).
   * Masukkan identitas **NMID** dan Nama Merchant terdaftar.
   * Kasir nantinya dapat langsung menampilkan QRIS ini di layar kasir saat pelanggan memilih pembayaran non-tunai.

---

## 📦 FASE 3: MANAJEMEN KATALOG PRODUK & BAHAN BAKU RESEP

*Membangun master data produk yang akan dijual di kasir.*

### 3.1 Membuat Kategori Produk (`#categories`)
1. Masuk ke menu **Katalog Produk** ➔ **Kategori Produk**.
2. Klik tombol **Tambah Kategori**:
   * Buat Kategori 1: `Kopi & Minuman`
   * Buat Kategori 2: `Makanan & Camilan`

### 3.2 Khusus F&B: Input Bahan Baku Mentah (`#inventory`)
*Fitur unggulan Well POS: pemotongan otomatis bahan mentah dan kalkulasi HPP real-time.*
1. Masuk ke menu **Bahan Baku & Stok** ➔ **Stok Bahan Baku**.
2. Pada tab **🌿 Bahan Baku Mentah (Raw Materials)**, tambahkan bahan:
   * **Bahan 1**: Nama: `Biji Kopi Arabika`, Satuan: `GRAM`, Harga Beli/HPP: `Rp 250 / gr`, Saldo Awal: `5.000 GRAM` (5 kg).
   * **Bahan 2**: Nama: `Susu Fresh Milk`, Satuan: `ML`, Harga Beli/HPP: `Rp 20 / ml`, Saldo Awal: `10.000 ML` (10 liter).
   * **Bahan 3**: Nama: `Paper Cup 12oz`, Satuan: `PCS`, Harga Beli/HPP: `Rp 800 / pcs`, Saldo Awal: `500 PCS`.

### 3.3 Khusus F&B: Membuat Menu & Resep (BOM) (`#products` & `#recipes`)
1. Masuk ke menu **Katalog Produk** ➔ **Daftar Produk** ➔ Klik **Tambah Produk**:
   * **Nama Menu**: `Kopi Susu Gula Aren`
   * **Kategori**: `Kopi & Minuman`
   * **Harga Jual**: `Rp 20.000`
   * **Tipe Produk**: Produk Olahan (F&B Composite).
2. Hubungkan ke **Resep Bahan Baku (BOM)** di menu **Resep**:
   * Masukkan takaran per 1 porsi menu:
     - `18 GRAM` Biji Kopi Arabika
     - `120 ML` Susu Fresh Milk
     - `1 PCS` Paper Cup 12oz
   * *Sistem otomatis menghitung HPP*: `(18 x 250) + (120 x 20) + (1 x 800) = Rp 7.700`.
   * *Estimasi Margin Keuntungan*: **61.5%**!

### 3.4 Khusus Ritel: Produk Jadi, Stok Fisik & Label Barcode
1. Masuk ke menu **Daftar Produk** ➔ Tambah Produk Ritel:
   * **Nama Barang**: `Buku Catatan Agenda A5`
   * **Barcode/SKU**: `899123456789`
   * **Harga Jual**: `Rp 35.000`
   * **Harga Modal (HPP)**: `Rp 20.000`
2. Masukkan **Stok Awal Fisik**: `100 PCS`.
3. Klik tombol **Cetak Label Barcode / Rak**:
   * Pilih format ukuran stiker (misal `40x30 mm` atau `60x40 mm shelf-talker`).
   * Cetak langsung label barcode untuk ditempel di rak display barang dagangan.

---

## 👥 FASE 4: TATA KELOLA STAF & PERANGKAT KASIR (PAIRING)

*Menyiapkan akun kasir dan menghubungkan tablet/laptop kasir ke toko.*

### 4.1 Daftarkan Staf Kasir (`#users`)
1. Di Backoffice Pemilik, buka menu **Kelola Staf** ➔ **Daftar Staf**.
2. Klik tombol **Tambah Staf**:
   * **Nama Lengkap**: `Rian Kasir`
   * **Peran (Role)**: `Kasir (CASHIER)`
   * **Toko Ditugaskan**: `Kopi Nusantara - Outlet Malioboro`
   * **PIN Kasir**: `123456` (6 digit angka rahasia kasir)
3. Simpan data staf kasir.

### 4.2 Menghubungkan Terminal Kasir POS (Pairing Perangkat)
1. Di perangkat kasir (Tablet / PC Kasir / Ponsel):
   * Buka browser di **`http://localhost:5173/#login`**.
   * Pilih tab **Kasir POS**.
2. Masukkan **ID Toko** (atau slug toko) dan klik **Hubungkan Perangkat**.
3. Masukkan PIN Admin/Pemilik untuk mengotorisasi pemasangan perangkat kasir.
4. *(Alternatif untuk Pemilik yang ingin langsung mencoba)*: Di pojok kanan atas header Backoffice Pemilik, cukup klik tombol hijau **"Buka Kasir POS"**.

---

## 💳 FASE 5: OPERASIONAL HARIAN KASIR DI TERMINAL POS (`#pos`)

*Simulasi nyata transaksi penjualan kasir dari buka toko hingga cetak struk.*

### 5.1 Buka Shift Kasir (Open Shift)
1. Di layar Terminal POS, kasir login dengan mengetik PIN Kasir: **`123456`**.
2. Sistem mendeteksi belum ada shift aktif, lalu menampilkan modal **Buka Shift**:
   * Masukkan **Modal Awal Kas (Cash Float)** di laci kasir: `Rp 100.000` (untuk uang kembalian).
   * Klik **Mulai Shift Kasir**.
3. Layar katalog kasir siap melayani transaksi pelanggan.

### 5.2 Melakukan Transaksi Penjualan
1. **Memilih Menu**:
   * Klik produk `Kopi Susu Gula Aren` sebanyak **2 porsi**.
   * Keranjang belanja mencatat total: `2 x Rp 20.000 = Rp 40.000` (ditambah PB1 jika diaktifkan).
2. **Proses Pembayaran (Checkout)**:
   * Klik tombol hijau **Bayar (Rp 40.000)**.
   * Pilih metode pembayaran:
     - **Pilihan A (Tunai / Cash)**: Klik nominal uang yang diterima pelanggan, misalnya `Rp 50.000`. Sistem langsung menampilkan nominal uang kembalian: `Rp 10.000`.
     - **Pilihan B (QRIS)**: Sistem menampilkan kode QRIS dinamis/statis untuk dipindai oleh pelanggan.
     - **Pilihan C (Mitra Online)**: Pilih GoFood / GrabFood / ShopeeFood jika pesanan dari kurir online.
3. **Cetak Struk & Kirim WhatsApp**:
   * Klik **Cetak Struk** (printer thermal berbunyi dan laci kasir terbuka otomatis).
   * Masukkan nomor WhatsApp pelanggan untuk mengirim **Struk Digital Resmi via WhatsApp Gateway**.
   * Transaksi selesai!

### 5.3 Pembuktian Otomasi Pemotongan Bahan Baku (The WOW Factor)
*Tunjukkan ini saat presentasi marketing ke calon tenant:*
1. Transaksi 2 porsi `Kopi Susu Gula Aren` telah berhasil.
2. Kembali ke Backoffice Pemilik ➔ Buka **Bahan Baku & Stok**.
3. Periksa saldo fisik bahan baku:
   * *Biji Kopi*: berkurang otomatis `36 GRAM` (`5.000` ➔ `4.964 GRAM`).
   * *Susu Fresh Milk*: berkurang otomatis `240 ML` (`10.000` ➔ `9.760 ML`).
   * *Paper Cup*: berkurang otomatis `2 PCS` (`500` ➔ `498 PCS`).
4. **Hasil**: Bebas selisih stok, tidak perlu input manual, HPP tercatat otomatis!

---

## 🌟 FASE 6: FITUR OPERASIONAL LANJUTAN KASIR

*Demonstrasikan fitur-fitur berdaya jual tinggi Well POS.*

### 6.1 Buku Menu QR & Self-Ordering Meja Tamu (`#qr-menu`)
1. Di Backoffice, buka menu **Meja & QR Resto**.
2. Cetak kartu meja ber-QR Code untuk **Meja 05**.
3. Tamu memindai QR menggunakan kamera HP (tanpa instal aplikasi apa pun):
   * Tamu melihat katalog menu digital dengan foto resolusi tinggi.
   * Tamu memilih menu, menentukan catatan (contoh: *"Kurangi manis"*), lalu klik **Kirim Pesanan**.
4. Di terminal kasir & layar dapur (*Kitchen Display*): Pesanan Meja 05 langsung berbunyi dan muncul di daftar pesanan masuk (*Live QR Orders Feed*).
5. Tamu menyelesaikan makan dan membayar di kasir saat hendak pulang.

### 6.2 Simpan Pesanan (Open Tab / Bayar Nanti)
1. Pelanggan memesan makanan di kasir namun ingin makan di tempat (*Dine-in*) dan bayar belakangan.
2. Masukkan menu ke keranjang ➔ Klik **Simpan Pesanan / Open Bill** ➔ Masukkan nomor meja.
3. Saat pelanggan ingin menambah menu (pesanan susulan): kasir membuka tab pesanan meja tersebut dan menambah item.
4. Saat pelanggan selesai: kasir memproses pembayaran pelunasan.

### 6.3 Pencatatan Kasbon / Piutang Pelanggan
1. Pelanggan langganan ingin mencatat kasbon:
   * Di kasir, pilih pelanggan terdaftar.
   * Pilih metode pembayaran **Kasbon / Piutang**.
   * Tentukan tanggal jatuh tempo (contoh: `+14 Hari`).
2. Di Backoffice menu **Pelanggan & CRM** ➔ Tab **Kasbon**:
   * Pemilik dapat melihat buku utang pelanggan dan mengirim tagihan ramah dengan 1-klik WhatsApp.
   * Saat pelanggan membayar, kasir memproses pelunasan kasbon dan uang tunai otomatis masuk ke rekonsiliasi kas shift.

### 6.4 Pembatalan Transaksi / Void dengan Otorisasi Supervisor
1. Pelanggan salah memesan atau membatalkan transaksi yang sudah tercetak struk.
2. Kasir klik tombol **Void / Batalkan Pesanan**.
3. Sistem mengunci dan meminta **PIN Supervisor/Owner 6-digit**.
4. Masukkan PIN otorisasi:
   * Transaksi dibatalkan secara sah.
   * Bahan baku/stok produk otomatis dikembalikan (*restocked*).
   * Tercetak slip bukti void fisik dengan kolom tanda tangan kasir dan supervisor.
   * Kasir nakal tidak bisa memanipulasi kas atau mencuri uang penjualan!

---

## 🔒 FASE 7: PENUTUPAN SHIFT & REKONSILIASI KAS (END OF DAY)

*Mencegah kebocoran uang kasir di akhir jam operasional toko.*

1. Kasir menyelesaikan jam kerja dan mengklik tombol **Tutup Shift** di terminal POS.
2. Sistem menampilkan modal **Hitung Uang Kas Fisik di Laci**:
   * Kasir menghitung lembaran uang fisik di laci tanpa diberitahu terlebih dahulu berapa angka di sistem (*Blind Close Shift Policy*).
   * Kasir memasukkan jumlah uang fisik hasil hitungan, misalnya: `Rp 150.000`.
3. Sistem membandingkan:
   * Modal Awal: `Rp 100.000`
   * Total Penjualan Tunai: `Rp 50.000`
   * Total Seharusnya di Laci: `Rp 150.000`
   * Uang Fisik Aktual: `Rp 150.000`
   * **Selisih Kas**: **Rp 0 (PAS / SINKRON)**.
4. Jika kasir memasukkan `Rp 140.000`, sistem mencatat **Selisih Minus (Shortage) Rp 10.000**.
5. Kasir mengklik **Konfirmasi Tutup Shift**.
6. Struk Laporan Rekapitulasi Shift (Z-Report) tercetak otomatis, dan sesi kasir berakhir secara aman.

---

## 📊 FASE 8: LAPORAN & KECERDASAN BISNIS PEMILIK (BUSINESS INTELLIGENCE)

*Bagian paling disukai pemilik usaha saat evaluasi performa bisnis.*

Pemilik usaha membuka Backoffice dari laptop atau smartphone:
1. **Laporan Penjualan & Finansial (`#financial-report`)**:
   * Melihat total omzet kotor, omzet bersih, pajak PB1 terkumpul, dan pemisahan metode pembayaran (Berapa Tunai vs Berapa QRIS vs Berapa Ojol).
2. **Laporan Laba Kotor & HPP Real-Time (`#product-analytics`)**:
   * Melihat **Laba Kotor Bersih** (`Omzet Bersih - HPP Bahan Baku`).
   * Mengetahui menu mana yang menyumbang keuntungan terbesar (*Top Profit Margin*).
   * Mengetahui menu yang paling lambat terjual (*Slow-Moving Analysis*).
3. **Audit Shift Kasir (`#shifts-audit`)**:
   * Meninjau riwayat seluruh shift: siapa kasir yang bertugas, jam buka/tutup, dan apakah ada kasir yang memiliki riwayat uang minus.
4. **Kartu Stok & Buku Mutasi (`#inventory`)**:
   * Menelusuri riwayat mutasi persediaan: bahan masuk dari supplier, bahan keluar dari penjualan kasir, dan penyesuaian opname stok.
5. **Ekspor Laporan**:
   * Seluruh data laporan dapat diunduh dalam format file **Excel / CSV** dengan 1-klik untuk kebutuhan pencatatan akuntansi atau perpajakan.

---

## 💡 TIPS PRESENTASI MARKETING KE CALON TENANT (PITCHING POINTS)

Saat mempresentasikan alur ini ke pemilik kafe, restoran, atau toko ritel, tekankan **4 Nilai Jual Utama (USP)** berikut:

1. **Anti Kebocoran Bahan Baku & Uang Kas**:
   * Resep otomatis memotong gramatur bahan mentah saat kasir menjual menu.
   * Tutup shift dengan hitung kas buta (*blind cash count*) mendeteksi selisih rupiah kasir hingga ke satuan terkecil.
2. **Tanpa Biaya Investasi Perangkat Keras Mahal**:
   * Tidak perlu beli mesin POS ratusan juta rupiah.
   * Cukup gunakan tablet Android, iPad, laptop, atau ponsel yang sudah ada.
   * Mendukung printer thermal Bluetooth murah 58mm/80mm.
3. **Buku Menu QR Meja Modern Tanpa Aplikasi**:
   * Pelanggan tidak perlu download aplikasi atau login.
   * Cukup scan QR meja, pilih menu, dan langsung masuk ke kasir/dapur.
4. **Struk Digital WhatsApp Otomatis**:
   * Hemat kertas struk, lebih ramah lingkungan, sekaligus mengumpulkan database nomor WhatsApp pelanggan secara etis untuk promosi berikutnya.

---

## 🤖 OTOMASI PENGUJIAN VISUAL & RESPONSIF (PLAYWRIGHT LOCAL RUNNER)

Seluruh 8 fase pengujian di atas telah dilengkapi dengan runner otomasi berbasis **Playwright lokal** menggunakan pola **Page Object Model (POM)** dan locator semantik:

### Menjalankan Otomasi Pengujian
```bash
npm run test:visual
```

### Matriks Perangkat Uji Responsif (Pasar UMKM Indonesia)
1. **Android Smartphone (`360 × 800` px)**: Uji form landing page, wizard toko, buku menu QR tamu, dan mode kasir handheld.
2. **Android Tablet Kasir (`1280 × 800` px Landscape)**: Uji terminal kasir meja POS, buka/tutup shift, dan checkout transaksi.
3. **Laptop Pemilik (`1440 × 900` px Desktop)**: Uji kontrol Superadmin, wizard onboarding, katalog produk, dan laporan analitik bisnis.

### Direktori Artefak Tangkapan Layar Otomatis
Hasil pengujian visual langsung menghasilkan screenshot resolusi tinggi yang dapat digunakan sebagai materi presentasi/marketing:
* **`docs/artifacts/visual_journey/android_phone/`**: 6 tangkapan layar mobile & responsif.
* **`docs/artifacts/visual_journey/android_tablet/`**: 5 tangkapan layar kasir tablet meja.
* **`docs/artifacts/visual_journey/desktop/`**: 7 tangkapan layar backoffice & kontrol Superadmin.

---

## 🧭 SPESIFIKASI ARSITEKTUR STATE MACHINE & REKAYASA KUALITAS

Untuk memetakan seluruh kondisi transisi keadaan, penanganan *empty state*, validasi error dialog/toast, serta rute alternatif:
* **Spesifikasi Formal FSM**: Buka dokumen [`docs/STATE_MACHINE_JOURNEY_SPEC.md`](./STATE_MACHINE_JOURNEY_SPEC.md) untuk mempelajari tabel matriks lengkap *Happy Path*, *Sad Path*, dan *Bad Path*.
* **Visualizer Interaktif**: Buka visualizer interaktif di [`docs/artifacts/state_machine_interactive.html`](./artifacts/state_machine_interactive.html) untuk menjelajahi graf keadaan secara visual dan mencoba simulasi interaktif transisi serta pratinjau error notification.

