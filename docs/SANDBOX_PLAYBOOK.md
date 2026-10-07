# WELL POS — LOCAL PRE-RELEASE SANDBOX PLAYBOOK
## Panduan Lengkap Uji Coba Mandiri (UAT & Demo Zero-Friction)

**Dokumen Versi**: 1.0.0 (Pre-Release Ready)  
**Epic Terkait**: [`EPIC-12: Local Pre-Release Sandbox Environment`](file:///Users/dendyaditya/Projects/pos_project/docs/epics/EPIC-12_LOCAL_PRE_RELEASE_SANDBOX.md)  
**Dokumen Arsitektur Rujukan**: [`docs/00_PROJECT_CONTEXT.md`](file:///Users/dendyaditya/Projects/pos_project/docs/00_PROJECT_CONTEXT.md)

---

### 1. RINGKASAN & FILOSOFI ZERO-FRICTION
Lingkungan **Local Sandbox** Well POS dirancang agar developer, QA/tester, product manager, maupun pemangku kepentingan bisnis dapat menjalankan dan mengevaluasi seluruh kapabilitas sistem Well POS secara lokal tanpa:
* Ketergantungan akun cloud payment gateway berbayar (Midtrans/Xendit nyata).
* Ketergantungan perangkat keras fisik (printer thermal ESC/POS atau laci kasir 24V nyata).
* Kebutuhan input data awal yang membosankan (katalog, bahan baku, resep BOM, dan member sudah terpasang otomatis).

---

### 2. CARA MENJALANKAN SANDBOX

#### A. Menjalankan Seluruh Sistem (One-Command Unified Runner)
Jalankan perintah berikut di root folder project:
```bash
./run-sandbox.sh
```
*atau via npm:*
```bash
npm run dev:sandbox
```
Perintah ini akan secara otomatis:
1. Memeriksa koneksi database PostgreSQL lokal.
2. Menjalankan Backend API server di port `http://localhost:5001`.
3. Menjalankan Frontend client Vite di port `http://localhost:5173`.
4. Menyediakan *graceful shutdown* (menekan `Ctrl+C` akan menghentikan kedua proses secara bersih).

#### B. Reset Database Sandbox ke Kondisi Steril (Tenant Operasional Ura Coffee)
Kapan pun data transaksi demo ingin dikembalikan ke kondisi awal yang bersih dan operasional:
```bash
npm run seed:sandbox
```

#### C. Reset Database untuk Testbed Status Multi-Tenant SuperAdmin (EPIC-18)
Kapan pun ingin menguji 5 siklus status akun SaaS (Pending approval, Active fresh 0-toko, Active operasional, Expired, Suspended):
```bash
npm run seed:testbed
```

#### D. Validasi Otomatis Integritas Sandbox (Contract Test)
Untuk memastikan seluruh modul sandbox berfungsi 100% tanpa regresi:
```bash
npm run test:sandbox
```

#### F. Visual Regression Testing — Tenant Onboarding & POS Lifecycle (3 Jalur FSM)
Untuk memvalidasi antarmuka visual onboarding tenant, approval superadmin, pairing kasir, dan PWA:
```bash
npm run test:visual
```

#### G. Visual Regression Testing — Resep F&B (BOM) & Pemotongan Stok Otomatis (3 Jalur FSM)
Untuk memvalidasi racik formula resep bahan baku, live HPP, order kasir tablet, verifikasi matematika saldo stok terpotong, empty state, dan validasi takaran:
```bash
npm run test:visual:recipes
```

#### H. BDD Visual Regression Testing — Siklus Shift Kasir, Petty Cash & Rekonsiliasi Z-Report (Gherkin Syntax)
Untuk memvalidasi pembukaan shift modal awal, pencatatan kas masuk / kas keluar petty cash, kalkulator pecahan uang kertas/koin (*cash denomination counter*), toleransi selisih fisik, dan proteksi shift terkunci:
```bash
npm run test:visual:shift
```

---

### 3. DAFTAR KREDENSIAL LOGIN MULTI-ROLE

#### A. Kredensial Tenant Operasional: Ura Coffee & Roastery (`ura-coffee`)
*(Dihasilkan otomatis saat menjalankan `npm run seed:sandbox`)*

| Peran (Role) | Kredensial Login | Metode Masuk | Cakupan Akses & Outlet Default |
| :--- | :--- | :--- | :--- |
| **Platform SuperAdmin** | Email: `superadmin@wellpos.id`<br/>Password: `SuperAdmin123!` | Tab Login Backoffice (`#superadmin`) | Seluruh Tenant SaaS, Billing, Aktivasi Toko |
| **Merchant Owner** | Email: `owner@uracoffee.id`<br/>Password: `Owner123!`<br/>PIN Otorisasi: **`123456`** | Tab Login Backoffice (`#login`) atau Hubungkan Kasir POS | Akses Penuh Merchant, Backoffice, HPP, Resep, Stok, Otorisasi Pairing Kasir (`#dashboard`) |
| **Kasir Toko (Cashier)** | Nama: **Rian Kasir Kemang**<br/>ID Toko: **`ura-coffee`**<br/>PIN Kasir: **`123456`** | **Metode A (Quick Switch)**: Klik tombol hijau *"Buka Kasir POS"* di header Backoffice Owner.<br/>**Metode B (Terminal Kasir)**: Di layar login pilih tab **Kasir POS**, masukkan ID Toko `ura-coffee`, lalu ketik PIN `123456`. | Terminal POS Kasir, Buka/Tutup Shift (`OUT-01` Flagship Kemang) (`#pos`) |
| **Kepala Gudang** | Email: `gudang@uracoffee.id`<br/>Password: `Gudang123!` | Tab Login Backoffice (`#login`) | Bahan Baku & Stok, Transfer Stok (`WH-01` Central Warehouse) |
| **Supervisor Toko** | Email: `supervisor@uracoffee.id`<br/>Password: `Spv123!` | Tab Login Backoffice (`#login`) | Otorisasi Void/Refund, Audit Kasir (`OUT-01` Flagship Kemang) |

#### B. Kredensial Testbed 5 Status SuperAdmin (EPIC-18)
*(Dihasilkan otomatis saat menjalankan `npm run seed:testbed`)*

| Status Tenant | Nama Entitas & Pemilik | Email Login | Password | Tujuan Pengujian |
| :--- | :--- | :--- | :--- | :--- |
| **SuperAdmin** | Super Admin Well POS | `admin@wellpos.com` | `SuperAdmin123!` | Pengujian verifikasi tenant di `#superadmin` |
| **PENDING** | Kuliner Jogja (Budi Santoso) | `budi.santoso@kulinerjogja.com` | `Password123!` | Uji guard penolakan login (HTTP 403 `TENANT_PENDING_APPROVAL`) |
| **ACTIVE (0 Toko)** | Butik Siti (Siti Rahmawati) | `siti.rahmawati@butiksiti.com` | `Password123!` | Uji peluncuran otomatis `FullScreenStoreWizard` (58 industri) |
| **ACTIVE (Normal)** | Kedai Kopi Hendra (Hendra P.) | `hendra.pratama@kedaikopihendra.com` | `Password123!` | Uji operasional dashboard normal |
| **EXPIRED** | Salon Dewi (Dewi Sartika) | `dewi.sartika@saloncantikdewi.com` | `Password123!` | Uji penanganan masa aktif langganan habis |
| **SUSPENDED** | Bengkel Barokah (Ahmad Fauzi) | `ahmad.fauzi@bengkelbarokah.com` | `Password123!` | Uji pemblokiran tenant karena pelanggaran |

---

### 4. PANDUAN RUTE & ANTARMUKA UTAMA

Buka browser di `http://localhost:5173`:
* **`http://localhost:5173/#landing`** : Landing page interaktif Well POS SaaS, paket langganan, dan formulir pendaftaran tenant baru (5 field).
* **`http://localhost:5173/#dashboard`** : Portal Backoffice Merchant Owner (`BackofficeLayout`), navigasi multi-outlet, ringkasan bisnis, katalog, dan stok.
* **`http://localhost:5173/#pos`** : Terminal Kasir POS (`PosTerminalView`), katalog menu F&B/Ritel, simulasi QRIS/Tunai, dan struk virtual.
* **`http://localhost:5173/#superadmin`** : Portal SuperAdmin SaaS Platform (`SuperAdminDashboardPage`) untuk verifikasi WhatsApp, aktivasi tenant, dan kelola lisensi.

---

### 5. MASTER DATA DUMMY: 5 MENU, 2 KATEGORI & BAHAN BAKU TERKAIT

Untuk mempermudah simulasi operasional nyata F&B (Cafe & Bakery), sandbox telah dilengkapi secara terstruktur dengan **2 Kategori Menu**, **5 Produk Olahan F&B (Resep BOM)**, dan **9 Bahan Baku Mentah Terkait** dengan saldo persediaan fisik di cabang & gudang pusat:

#### A. Rincian 2 Kategori & 5 Menu Produk F&B

| No | Kategori | Nama Menu Produk | Kode SKU | Harga Jual | Resep Bahan Baku (BOM) | Estimasi HPP | Margin Laba |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **Coffee & Espresso** | **Kopi Susu Aren Ura** | `FNB-KPS-001` | Rp 22.000 | • 18g Biji Kopi<br/>• 120ml Fresh Milk<br/>• 20ml Gula Aren<br/>• 1 pcs Paper Cup | Rp 8.400 | **61.8%** |
| 2 | **Coffee & Espresso** | **Caramel Macchiato** | `FNB-CMM-001` | Rp 26.000 | • 18g Biji Kopi<br/>• 140ml Fresh Milk<br/>• 25ml Sirup Karamel<br/>• 1 pcs Paper Cup | Rp 9.225 | **64.5%** |
| 3 | **Coffee & Espresso** | **Americano Signature** | `FNB-AMC-001` | Rp 18.000 | • 18g Biji Kopi<br/>• 1 pcs Paper Cup | Rp 5.300 | **70.6%** |
| 4 | **Tea & Bakery** | **Earl Grey Milk Tea** | `FNB-EGT-001` | Rp 20.000 | • 10g Daun Teh Earl Grey<br/>• 100ml Fresh Milk<br/>• 15ml Gula Aren<br/>• 1 pcs Paper Cup | Rp 6.325 | **68.4%** |
| 5 | **Tea & Bakery** | **Butter Croissant Warm** | `FNB-CRS-001` | Rp 25.000 | • 1 pcs Dough Croissant<br/>• 1 pcs Pastry Bag | Rp 12.500 | **50.0%** |

#### B. Rincian 9 Bahan Baku Mentah Terkait (Inventory Items) & Saldo Stok

| No | Kode Bahan | Nama Bahan Baku | UOM | Harga Beli / HPP | Stok Outlet Kemang (`OUT-01`) | Stok Gudang Pusat (`WH-01`) |
| :-: | :--- | :--- | :---: | :--- | :--- | :--- |
| 1 | `RAW-BEANS` | Biji Kopi Arabika House Blend | GRAM | Rp 250 / gr | **8.000 GRAM** (8 kg) | 50.000 GRAM (50 kg) |
| 2 | `RAW-MILK` | Susu Fresh Milk Pasteurisasi | ML | Rp 20 / ml | **15.000 ML** (15 L) | 100.000 ML (100 L) |
| 3 | `RAW-AREN` | Sirup Gula Aren Organik | ML | Rp 35 / ml | **5.000 ML** (5 L) | 30.000 ML (30 L) |
| 4 | `RAW-CARAMEL` | Sirup Karamel Artisan | ML | Rp 45 / ml | **3.000 ML** (3 L) | 15.000 ML (15 L) |
| 5 | `RAW-TEA` | Daun Teh Earl Grey Premium | GRAM | Rp 300 / gr | **3.000 GRAM** (3 kg) | 10.000 GRAM (10 kg) |
| 6 | `RAW-CROISSANT` | Dough Butter Croissant Ready-to-Bake | PCS | Rp 12.000 / pcs | **60 PCS** | 300 PCS |
| 7 | `RAW-CUP` | Paper Cup 12oz Cold/Hot | PCS | Rp 800 / cup | **1.000 PCS** | 5.000 PCS |
| 8 | `RAW-BAG` | Kantong Kertas Pastry Bag | PCS | Rp 500 / bag | **500 PCS** | 2.000 PCS |
| 9 | `RAW-OAT` | Oat Milk Barista Edition | ML | Rp 45 / ml | **4.000 ML** (4 L) | 25.000 ML (25 L) |

---

### 6. PANDUAN PENGUJIAN MANUAL OPERASIONAL (STEP-BY-STEP)

Gunakan alur berikut untuk menguji siklus operasional kasir, verifikasi resep BOM, dan pemotongan stok otomatis secara visual:

#### Langkah 1: Pengecekan Saldo Awal Bahan Baku di Backoffice Owner
1. Buka browser di **`http://localhost:5173/#login`**.
2. Login sebagai Merchant Owner:
   * Email: **`owner@uracoffee.id`**
   * Password: **`Owner123!`**
3. Masuk ke halaman **Stok Bahan Baku**:
   * Pada sidebar kiri, buka rumpun menu **Bahan Baku & Stok** -> klik submenu **Stok Bahan Baku**.
   * Pastikan memilih outlet **Ura Coffee - Flagship Kemang**.
   * Pada tab **🌿 Bahan Baku Mentah F&B (Raw Materials)**, perhatikan saldo awal:
     - *Biji Kopi Arabika*: **8.000 GRAM**
     - *Susu Fresh Milk*: **15.000 ML**
     - *Sirup Gula Aren*: **5.000 ML**
     - *Dough Butter Croissant*: **60 PCS**
     - *Paper Cup 12oz*: **1.000 PCS**
     - *Kantong Kertas Pastry Bag*: **500 PCS**
4. Buka menu resep:
   * Pada sidebar kiri, buka rumpun menu **Menu & Produk** -> klik submenu **Resep & Bahan (BOM)**:
   * Periksa kalkulator HPP pada 5 menu terdaftar (*Kopi Susu Aren Ura*, *Caramel Macchiato*, *Americano Signature*, *Earl Grey Milk Tea*, *Butter Croissant Warm*). Seluruh takaran resep dan margin laba tampil lengkap.

#### Langkah 2: Transaksi Penjualan F&B di Terminal Kasir POS
Ada 2 cara mudah untuk masuk ke Terminal Kasir:
* **Cara A (Langsung dari Backoffice Owner)**: Klik tombol hijau **"Buka Kasir POS"** pada header atas Backoffice. Kasir langsung terbuka seketika dengan sesi aktif.
* **Cara B (Device Kasir / Tab Baru)**: Buka browser di **`http://localhost:5173/#pos`** (atau pilih tab **Kasir POS** pada halaman login), masukkan **ID Toko**: **`ura-coffee`**, lalu ketik PIN: **`123456`**.

Alur Transaksi:
1. Terminal kasir langsung menampilkan 2 tab kategori yang bersih:
   * Tab **Coffee & Espresso**: menampilkan *Kopi Susu Aren Ura*, *Caramel Macchiato*, dan *Americano Signature* dengan badge hijau **"Tersedia (Olahan F&B)"**.
   * Tab **Tea & Bakery**: menampilkan *Earl Grey Milk Tea* dan *Butter Croissant Warm* dengan badge hijau **"Tersedia (Olahan F&B)"**.
2. **Pilih Pesanan**:
   * Klik 1x **Kopi Susu Aren Ura** (Rp 22.000) -> Klik **"Tambah ke Pesanan"**.
   * Klik 1x **Butter Croissant Warm** (Rp 25.000) -> Klik **"Tambah ke Pesanan"**.
   * *Subtotal di Keranjang*: **Rp 47.000**.
3. Klik tombol biru **"Bayar (Rp 47.000)"**.
4. Pilih metode pembayaran **CASH (Tunai)**:
   * Masukkan uang diterima: **Rp 50.000** (Kembalian terhitung otomatis: Rp 3.000).
   * Klik **"Selesaikan Pembayaran"**.
5. Transaksi berhasil! Muncul struk digital belanja dan indikator pembukaan laci kasir (*Virtual Cash Drawer Kick*).

#### Langkah 3: Verifikasi Pengurangan Stok Bahan Baku Otomatis
1. Kembali ke Backoffice Owner di **`http://localhost:5173/#dashboard`** (atau klik menu navigasi Backoffice).
2. Buka rumpun menu **Bahan Baku & Stok** -> klik submenu **Stok Bahan Baku** (Tab *Bahan Baku Mentah F&B*):
   * Periksa saldo terbaru di Outlet Kemang:
     - *Biji Kopi Arabika*: Berkurang dari 8.000g menjadi **7.982 GRAM** (-18g).
     - *Susu Fresh Milk*: Berkurang dari 15.000ml menjadi **14.880 ML** (-120ml).
     - *Sirup Gula Aren*: Berkurang dari 5.000ml menjadi **4.980 ML** (-20ml).
     - *Paper Cup 12oz*: Berkurang dari 1.000 pcs menjadi **999 PCS** (-1 pcs).
     - *Dough Butter Croissant*: Berkurang dari 60 pcs menjadi **59 PCS** (-1 pcs).
     - *Kantong Kertas Pastry Bag*: Berkurang dari 500 pcs menjadi **499 PCS** (-1 pcs).
     - *Sirup Karamel & Daun Teh*: Saldo tetap utuh karena tidak dipesan.
3. Buka submenu **Riwayat Mutasi Stok** (pada rumpun menu **Bahan Baku & Stok**):
   * Tercatat log mutasi `PENJUALAN KASIR (POS)` dengan delta minus sesuai takaran resep dan nomor referensi invoice yang baru saja dicetak.

---

### 7. SKENARIO PENGUJIAN LANJUTAN LAINNYA

#### Skenario 1: Transaksi dengan Modifier Topping (Oat Milk & Extra Shot)
**Tujuan**: Menguji pemotongan bahan baku subtitusi/tambahan saat pelanggan meminta kustomisasi minuman.
1. Di POS Kasir, klik **Kopi Susu Aren Ura**.
2. Pada modal modifier, pilih **"Ganti Oat Milk" (+Rp 7.000)** dan **"Extra Espresso Shot" (+Rp 5.000)**.
3. Selesaikan pembayaran.
4. Di Backoffice, verifikasi bahwa *Biji Kopi* terpotong `18g + 9g = 27g`, *Fresh Milk* tidak terpotong (0 ml), dan *Oat Milk* terpotong `120ml`.

---

#### Skenario 2: Simulasi Pembayaran QRIS & Virtual Hardware (Cash Drawer Kick)
**Tujuan**: Menguji simulator pembayaran QRIS tanpa payment gateway nyata serta simulator laci uang & struk virtual.

1. **Uji Coba Pembayaran QRIS**:
   * Pada keranjang belanja, pilih metode pembayaran **QRIS Dinamis**.
   * Perhatikan header dialog menampilkan label **"⚡ SANDBOX QRIS SIMULATOR"** dan hitung mundur timer (15:00 menit).
   * Klik tombol kuning: **"⚡ Simulasikan Pembayaran QRIS Sukses"**.
   * Tombol akan menampilkan status verifikasi sesaat (600ms), lalu otomatis menyelesaikan transaksi dengan referensi RRN sandbox acak (`SANDBOX-QRIS-...`).
2. **Uji Coba Laci Kasir (Cash Drawer Kick)**:
   * Buat transaksi kedua dengan memilih metode pembayaran **CASH (Tunai)**.
   * Masukkan uang diterima (misal: Rp 50.000). Klik **Selesaikan Pembayaran**.
   * Pada modal sukses transaksi, perhatikan bar **Virtual Cash Drawer Simulator**:
     - Status berubah menjadi **"TERBUKA (KICK)"** dengan warna hijau menyala.
     - Suara tone kick laci uang (Web Audio API) berbunyi menandakan sinyal 24V relay terkirim.
     - Tester dapat mengklik tombol manual **"🔔 Uji Buka Laci (Kick Signal 24V)"** kapan saja.
3. **Uji Coba Struk Virtual & Digital Preview**:
   * Klik **"Cetak Struk (Virtual)"** untuk melihat pratinjau struk thermal 58mm/80mm monospaced.
   * Klik **"Kirim WhatsApp"** untuk membuka pop-up simulasi pesan WhatsApp berisi struk belanja rapi dengan tombol *"Salin Teks Struk"*.
   * Klik **"Kirim Email"** untuk membuka pratinjau email tagihan HTML bergaya modern.

---

#### Skenario 4: Simulasi Tagihan Meja (Open Tabs) & Pesanan Mandiri Tamu (QR Orders)
**Tujuan**: Menguji penarikan pesanan terbuka (dine-in bayar nanti) dan pesanan mandiri tamu dari meja ke terminal kasir.

1. **Tagihan Meja (Open Tabs)**:
   * Pada header POS kasir, perhatikan indikator badge **"Tagihan Meja (2)"**.
   * Klik tombol tersebut untuk membuka modal **Daftar Tagihan Meja Terbuka**.
   * Anda akan melihat 2 tagihan aktif yang telah disiapkan seeder:
     - **Meja 02 (Indoor)**: Tamu *Dimas & Sarah* (Total: Rp 75.900) berisi *2x Kopi Susu Aren Ura* (catatan: Less sugar, es sedikit) dan *1x Butter Croissant Warm* (catatan: Hangatkan 30 detik).
     - **Meja 05 (Outdoor)**: Tamu *Komunitas Sepeda* (Total: Rp 79.200) berisi *2x Caramel Macchiato* dan *1x Earl Grey Milk Tea*.
   * Klik **"Tarik ke Kasir"** pada Meja 02.
   * **Hasil**: Seluruh item pesanan (Kopi Susu dan Croissant) langsung masuk secara utuh ke keranjang belanja kasir lengkap beserta harga, kuantitas, catatan varian, nomor meja, dan nama pemesan. Kasir dapat menambah item tambahan atau langsung memproses pelunasan.

2. **Pesanan QR Meja (Customer Self-Ordering) & Pesanan Tambahan via Kasir**:
   * Pada header POS kasir, perhatikan indikator badge **"Pesanan QR (1)"**.
   * Klik tombol tersebut untuk membuka modal **Daftar Pesanan QR Masuk**.
   * Anda akan melihat pesanan mandiri tamu:
     - **Meja 01 (Indoor)**: Tamu *Andi Saputra* (`081298765432`) dengan total Rp 47.300 berisi *1x Americano Signature* (catatan: Hot, no sugar) dan *1x Butter Croissant Warm* (catatan: Hangatkan).
   * Klik **"Tarik ke Kasir"**.
   * **Hasil**:
     - Item masuk ke keranjang kasir lengkap dengan nomor meja "01" dan nama tamu.
     - Muncul banner informatif: `[🍽️ Meja 01 • Pesanan QR • #INV/...]` dengan tombol `[↩️ Batal Tarik]`.
   * **Skenario Tamu Tambah Pesanan via Kasir**:
     - Kasir mengklik menu tambahan di katalog (misal: tambah 1x *Kopi Susu Aren Ura*).
     - Tombol aksi bawah menampilkan opsi:
       - **Pelunasan Meja**: Langsung tender pembayaran tunai/QRIS.
       - **Perbarui Tagihan Meja (Simpan ke Dapur)**: Menyimpan pesanan tambahan ke tagihan Meja 01 yang sama tanpa membuat order baru.
     - Klik **"Perbarui Tagihan Meja (Simpan ke Dapur)"** ➔ Tagihan Meja 01 ter-update dengan 3 item dan total baru!
   * **Skenario Batal Tarik (Kembalikan ke Antrean)**:
     - Jika kasir salah tarik atau tamu batal menambah pesanan di kasir, klik **"↩️ Batal Tarik"**.
     - Keranjang kasir dikosongkan dan pesanan tetap aman di antrean meja tanpa perubahan data.

3. **Proteksi Meja Terisi (Anti-Konflik Tagihan Meja)**:
   * Pada pemilih meja di keranjang kasir (`Pilih Meja ▾`), perhatikan kartu meja:
     - Meja kosong diberi badge hijau `Kosong` dan dapat dipilih untuk pesanan baru.
     - Meja yang sedang memiliki tagihan aktif (Meja 01, Meja 02, Meja 05) diberi badge oranye `Terisi` beserta nama pemesan & nominal tagihan, dan **tidak bisa dipilih** untuk transaksi baru dari nol.
     - Sedia tombol cepat `Tarik Tagihan ➔` untuk langsung membuka/melayani meja tersebut.
   * Di sisi backend, jika ada request membuka meja baru yang sedang terisi, API otomatis menolak dengan pesan validasi ramah: *"Meja X saat ini sedang aktif digunakan..."*.

---

#### Skenario 5: Simulasi Pajak PB1 & Perbedaan Biaya 4 Saluran Penjualan
**Tujuan**: Menguji fleksibilitas penghitungan pajak dan biaya otomatis per kanal langsung dari header kasir.

1. **Kanal 1: Makan di Tempat (*Dine In*)**:
   * Klik pil **"🍽️ Makan di Tempat"** di header kasir. Masukkan produk (misal: *Kopi Susu Aren Ura* Rp 22.000).
   * Perhatikan rincian tagihan kasir:
     - **Subtotal**: Rp 22.000
     - **PPN / PB1 Pajak Restoran (10%)**: Rp 2.200
     - **Biaya Layanan Meja (5%)**: Rp 1.100
     - **Total Tagihan**: Rp 25.300
2. **Kanal 2: Bawa Pulang (*Take Away*)**:
   * Ganti pil ke **"🛍️ Bawa Pulang"**.
   * Perhatikan perubahan live rincian:
     - Biaya Layanan Meja (5%) otomatis **hilang (Rp 0)** karena pelanggan tidak memakai meja resto.
     - Kasir dapat mengklik tombol **"Kemasan"** untuk menambahkan Box Kemasan (+Rp 2.000) atau Paperbag (+Rp 3.000) sesuai permintaan pelanggan.
3. **Kanal 3: Kurir Internal Toko (*In-House Delivery*)**:
   * Ganti pil ke **"🛵 Kurir Toko"**.
   * Perhatikan rincian tagihan:
     - Layanan meja 0%.
     - Otomatis ditambahkan **Ongkir Kurir Toko**: Tetap Rp 10.000.
4. **Kanal 4: Mitra Online Delivery (*GoFood / GrabFood / ShopeeFood*)**:
   * Buka dropdown **"Mitra Online ▾"** dan pilih salah satu (misal: *GoFood*).
   * Muncul field input khusus **ID Pesanan Online** (misal masukkan `#GF-108`).
   * Perhatikan rincian tagihan otomatis menyertakan **Biaya Platform Online** (+Rp 3.000).

---

#### Skenario 6: Simulasi Voucher Promo & Split Bill Interaktif Kasir (Fase 3)
**Tujuan**: Menguji validasi minimal belanja kupon promosi dan fitur pemecahan tagihan di kasir.

1. **Penggunaan Kupon Promo Toko**:
   * Masukkan menu hingga subtotal mencapai Rp 30.000 atau lebih (misal: 2x *Americano Signature* = Rp 36.000).
   * Di bar diskon keranjang kasir, klik tombol **"🎟️ Voucher"**.
   * Modal **Voucher & Promo Kasir** akan terbuka menampilkan voucher aktif:
     - **`KOPIASIK10`**: Diskon 10% (Min. Belanja Rp 30.000) ➔ Status: *Tersedia & Dapat Digunakan*.
     - **`HEMAT5RB`**: Potongan Rp 5.000 (Min. Belanja Rp 20.000) ➔ Status: *Tersedia & Dapat Digunakan*.
   * Klik **"Gunakan"** pada `KOPIASIK10`.
   * **Hasil**: Muncul pill hijau `KOPIASIK10 (Diskon 10%)` di keranjang, dan total tagihan langsung terpotong Rp 3.600 secara transparan. Kasir dapat melepas kupon dengan tombol `✕`.
   * **Uji Proteksi Minimal Belanja**: Jika keranjang dikurangi di bawah Rp 30.000, sistem menampilkan peringatan selisih belanja yang harus ditambah untuk memakai voucher tersebut.
2. **Pengujian Split Bill (Pecah Tagihan)**:
   * Klik tombol **"Split Bill"** di keranjang kasir.
   * **Opsi A: Bagi Sama Rata (*Equal Split*)**:
     - Pilih jumlah orang (misal 3 orang).
     - Sistem langsung membagi tagihan secara presisi per orang lengkap dengan tombol pembayaran bertahap (*Tamu #1, Tamu #2, Tamu #3*).
   * **Opsi B: Pilih per Menu (*Item Split*)**:
     - Kasir mencentang menu mana saja yang hendak dibayar di kloter pertama.
     - Sistem menghitung subtotal pilihan dan mengarahkan ke pembayaran kloter 1.

---

#### Skenario 3: Audit Shift Kasir (X-Report & Z-Report)
**Tujuan**: Menguji pencatatan rekonsiliasi kas kasir dan deteksi selisih kas (*cash over/short*).

1. Di menu navigasi samping POS, buka menu **Shift Kasir**.
2. Klik tombol **"Cetak X-Report"** untuk melihat ringkasan penjualan sementara di tengah jam operasional tanpa menutup shift.
3. Klik tombol **"Tutup Shift Kasir"**.
4. Lakukan *Blind Cash Count*:
   * Masukkan jumlah fisik uang tunai di laci (misal: masukkan nilai sesuai perhitungan atau sengaja lebih/kurang Rp 5.000).
5. Klik **"Konfirmasi Penutupan Shift"**.
6. Sistem akan menerbitkan **Z-Report Final** yang merinci:
   * Total penjualan tunai & non-tunai (QRIS).
   * Selisih kas (*Variance/Discrepancy*).
   * Status shift berubah menjadi `CLOSED`.

---

#### Skenario 4: Login SuperAdmin Platform & Pengelolaan Tenant SaaS
**Tujuan**: Menguji dashboard multi-tenant untuk manajemen paket lisensi dan audit sistem.

1. Buka `http://localhost:5173/#superadmin`.
2. Login dengan akun Platform SuperAdmin:
   * Email: **`superadmin@wellpos.id`**
   * Password: **`SuperAdmin123!`**
3. Masuk ke halaman **Ringkasan Platform**:
   * Lihat metrik global: Total Tenant Aktif, Total Outlet Terdaftar, Estimasi MRR (Monthly Recurring Revenue).
4. Masuk ke tab **Manajemen Tenant**:
   * Temukan tenant **"Ura Coffee & Roastery"** (`ura-coffee`).
   * Verifikasi status langganan: Paket **PRO**, masa aktif aktif, kuota outlet 3/5.
   * Lakukan simulasi pergantian status atau perpanjangan masa aktif langganan.

---

#### Skenario 5: Laporan Finansial HPP & Laba Kotor Real-Time
**Tujuan**: Memvalidasi akurasi perhitungan HPP (*Cost of Goods Sold*) berbasis Moving Average per transaksi.

1. Login sebagai Merchant Owner:
   * Email: **`owner@uracoffee.id`**
   * Password: **`Owner123!`**
2. Buka menu **Laporan Finansial & Profitabilitas**:
   * Evaluasi metrik **Laba Kotor (Gross Profit)**:
     $$\text{Gross Profit} = \text{Harga Jual} - \text{HPP Bahan Baku (BOM)}$$
   * Periksa rincian per cup *Kopi Susu Aren Ura*:
     - Harga jual: Rp 22.000
     - HPP Bahan (Biji kopi Rp 250/g × 18g + Susu Rp 20/ml × 120ml + Gula Aren Rp 35/ml × 20ml + Paper cup Rp 600) = Rp 8.200.
     - Margin kotor terhitung akurat (~Rp 13.800 / ~62.7%).
3. Buka menu **Laporan Stok Multi-Cabang**:
   * Lihat persebaran stok antara *Flagship Kemang*, *Sudirman Express*, dan *Central Warehouse*.

---

#### Skenario 6: Registrasi Tenant Baru, Guard Status PENDING, & FullScreenStoreWizard (EPIC-14 s.d 17)
**Tujuan**: Menguji siklus onboarding mandiri modern, verifikasi WhatsApp SuperAdmin, dan panduan pembuatan toko pertama (58 sub-industri).

1. **Registrasi Publik Mandiri**:
   * Buka `http://localhost:5173/#landing` dan klik tombol **"Coba Gratis 14 Hari"** / **"Daftar Sekarang"**.
   * Lengkapi formulir pendaftaran (5 field):
     - Nama Depan: `Andi`
     - Nama Belakang: `Wijaya`
     - No. WhatsApp: `081234567890` (otomatis terformat `+6281234567890`)
     - Email: `andi@kopinusantara.id`
     - Password: `Password123!`
   * Klik **"Daftar Sekarang"** -> Sistem membuat `Tenant` berstatus `PENDING` (tanpa outlet dan tanpa trial langsung aktif).
2. **Uji Penolakan Login (Pending Guard 403)**:
   * Buka halaman login di `http://localhost:5173/#login`.
   * Coba login menggunakan akun `andi@kopinusantara.id`.
   * Sistem akan menolak login dengan HTTP 403 (`TENANT_PENDING_APPROVAL`) dan memunculkan notifikasi bahwa akun sedang ditinjau tim Well POS.
3. **Verifikasi & Aktivasi oleh SuperAdmin**:
   * Login sebagai SuperAdmin di `http://localhost:5173/#superadmin` (`superadmin@wellpos.id` / `SuperAdmin123!`).
   * Pada tab **Daftar Tenant**, temukan tenant baru `andi@kopinusantara.id` dengan status **PENDING**.
   * Klik tombol **"Hubungi via WhatsApp"** untuk verifikasi nomor.
   * Klik tombol aksi **"Setujui & Aktifkan (ACTIVE)"** -> Status tenant berubah menjadi `ACTIVE`.
4. **First-Login Owner & Peluncuran Store Wizard**:
   * Kembali ke `http://localhost:5173/#login` dan login kembali sebagai `andi@kopinusantara.id`.
   * Karena akun baru memiliki 0 outlet, sistem secara otomatis meluncurkan **`FullScreenStoreWizard`** (tanpa modal bertumpuk).
   * Pilih kelompok industri:
     - **F&B**: Coffee Shop, Restoran, Bakery, Food Truck, dll.
     - **Ritel**: Minimarket, Butik Pakaian, Toko Kosmetik, Pet Shop, dll.
     - **Jasa**: Barbershop, Salon, Laundry, Cuci Mobil, Car Wash, dll.
   * Lengkapi detail toko (Nama Toko, Alamat, No. Telepon Outlet).
   * Klik **"Simpan & Buka Toko Pertama"** -> Sistem secara atomik membuat outlet pertama, mengaktifkan masa trial 14 hari, dan langsung mengarahkan Owner ke antarmuka modern **`BackofficeLayout`** (`#dashboard`).

---

#### Skenario 7: Uji Coba Buku Menu QR Meja & Self-Ordering Tamu (EPIC-19)
**Tujuan**: Menguji alur pemesanan mandiri oleh tamu via QR Meja, pratinjau merchant anti-tersesat, dan pesanan real-time ke dapur.

1. **Akses Pratinjau Menu Tamu dari Backoffice**:
   * Login sebagai Merchant Owner (`owner@uracoffee.id` / `Owner123!`).
   * Buka sub-menu **Buku Menu Tamu (QR)** di bawah grup *Menu & Meja QR*.
   * Sistem menyajikan **Simulator Ponsel Tamu Interaktif** dengan pratinjau live layout mobile.
   * Perhatikan banner kuning atas: *"Mode Pratinjau Toko [← Kembali ke Backoffice]"* yang memastikan merchant tidak terjebak di halaman pelanggan.
   * Klik tombol **"Buka Layar Penuh di Tab Baru"** untuk mensimulasikan pemindaian kamera HP tamu secara utuh.
2. **Pemesanan Mandiri Tamu (Self-Ordering)**:
   * Pilih kategori menu, tambahkan *Kopi Susu Aren Ura*, pilih varian & modifier topping.
   * Buka keranjang pesanan, masukkan Nama Tamu (misal: *"Dendy"*), pilih Meja (misal: *"Meja 03"*), lalu klik **"Kirim Pesanan ke Dapur"**.
   * Sistem menerbitkan kode pesanan dan instruksi bayar di kasir POS.
3. **Penerimaan Pesanan di Dapur & Kasir**:
   * Buka menu **Pesanan Masuk (Live)** di Backoffice atau Terminal Kasir POS.
   * Pesanan meja tamu muncul secara instan dengan status siap diproses dapur atau dibayar di kasir.

---

#### Skenario 8: Manajemen Pemasok, Promosi, Struk Thermal & Pajak PB1 (Fase 1.12)
**Tujuan**: Memvalidasi seluruh modul Backoffice baru yang menggantikan placeholder Tahap 4.

1. **Uji Manajemen Pemasok (`suppliers`)**:
   * Buka menu **Pemasok / Vendor** di Backoffice.
   * Klik **+ Tambah Pemasok Baru**, masukkan Nama Vendor (misal: *PT Java Kopi Makmur*), nomor WhatsApp, dan termin tempo 14 hari.
   * Simpan dan verifikasi vendor baru muncul di daftar serta dapat difilter statusnya.
2. **Uji Program Promosi & Kupon (`promotions`)**:
   * Buka menu **Program Promosi** di Backoffice.
   * Klik **+ Buat Program Diskon / Voucher Baru**.
   * Buat voucher diskon persentase (15%) dengan kode `DISKON15` dan batas kuota 100 kali pakai.
   * Uji tombol **Salin Kode** kupon untuk dibagikan ke media sosial / WhatsApp pelanggan.
3. **Uji Format Struk Thermal Kasir (`settings_receipt`)**:
   * Buka menu **Format Struk Kasir** di Backoffice.
   * Pilih lebar kertas struk: **58mm** atau **80mm**.
   * Ketik pesan footer kustom (misal: *"Terima kasih telah berkunjung ke Ura Coffee!"*).
   * Perhatikan kotak simulator thermal receipt sebelah kanan langsung meng-update pratinjau font monospaced secara live.
4. **Uji Pajak Restoran Daerah PB1 & Service Charge (`settings_taxes`)**:
   * Buka menu **Pajak & Biaya Layanan** di Backoffice.
   * Verifikasi ringkasan 3 kartu: Tarif PB1 10%, Biaya Layanan, dan Kemasan Takeaway.
   * Klik tombol **Atur Tarif Pajak & Biaya** untuk mengedit komponen biaya kasir secara aman via `<SupervisorFeesModal />`.

---

#### Skenario 9: Uji Laporan Finansial, Analisis Menu & HPP, serta Audit Shift Sebulan Penuh (September 2026)
**Tujuan**: Menguji seluruh visualisasi grafik omset harian, P&L, ranking menu Pareto, margin laba resep, dan rekonsiliasi kas kasir dengan data transaksi realistis 1 bulan penuh.

1. **Membuat Data Simulasi Transaksi 1 Bulan**:
   ```bash
   cd pos_apps/server
   npm run seed:transactions -- --days=25
   ```
   * Menghasilkan ~1.347 transaksi realistis dari tanggal 1 s.d. 25 September 2026 di 3 outlet Ura Corporation.
   * Mencakup variasi transaksi Dine In (dengan PB1 10% & Service 5%), Takeaway, dan Ojol (GoFood & GrabFood).
   * Menghasilkan 150 sesi shift kasir dengan rekonsiliasi kas (ada shift pas, dan ada variasi selisih kas kecil untuk menguji deteksi audit).
   * Mengurangi stok bahan baku di gudang logistik melalui pemotongan resep BOM (backflush).

2. **Memverifikasi di Backoffice Merchant**:
   * Buka Backoffice di **`http://localhost:5173`** (Login: `owner@uracorporation.com` / `Owner123!`).
   * **Laporan Finansial** (`FinancialReportView.tsx`):
     * Pilih filter periode "Bulan Ini" atau "30 Hari Terakhir".
     * Periksa kartu KPI: Omset Kotor (~Rp 53,6 Juta), Diskon (~Rp 1 Juta), Omset Bersih (~Rp 52,6 Juta), PB1 (~Rp 5,2 Juta), Service Charge (~Rp 1,3 Juta), dan Arus Kas Masuk (~Rp 59,1 Juta).
     * Periksa grafik tren harian serta rincian kas tunai vs QRIS di tabel tanggal.
   * **Analisis Menu & HPP** (`ProductAnalyticsView.tsx`):
     * Periksa ranking menu terlaris Pareto (Top 10), margin keuntungan kotor per olahan resep (53% s.d 63%), dan kontribusi kategori produk.
   * **Audit Shift Kasir** (`ShiftsAuditView.tsx`):
     * Periksa daftar shift kasir. Sistem mendeteksi status `MATCH` (selisih Rp 0), `SHORT` (kasir kurang setor Rp 5.000 pada 2 September), dan `OVER` (kasir lebih setor Rp 2.000 pada 3 September).

3. **Mekanisme Rollback Instan (Zero Dirty State)**:
   * Jika ingin menghapus seluruh data simulasi transaksi September dan mengembalikan database ke kondisi bersih:
     ```bash
     cd pos_apps/server
     npm run seed:transactions:clean
     ```

---

#### Skenario 10: Pengelolaan Kuota Token Transaksi, Promo Top-up, QRIS Statis Platform & Faktur Pajak Resmi (EPIC-21)
**Tujuan**: Menguji siklus hidup kuota pesanan Pay-As-You-Go per tenant, pemotongan kuota real-time per transaksi kasir/QR, pemanfaatan voucher diskon top-up, pembayaran via QRIS Statis Platform yang dikelola SuperAdmin, dan penerbitan Faktur Digital Pajak resmi.

1. **Pemantauan Kuota di Backoffice Owner**:
   * Login sebagai Merchant Owner (`owner@uracoffee.id` / `Owner123!`).
   * Perhatikan indikator badge **`[⚡ Kuota Token: ...]`** di Navbar atas dan menu **`[⚡ Paket & Kuota]`** berlabel **`[🪙 Token]`** pada sidebar.
   * Masuk ke halaman **Paket & Kuota**:
     - Evaluasi metrik: Sisa Saldo Token Order, Estimasi Hari Habis, dan Efisiensi Konsumsi.
     - Periksa tabel **Penggunaan Token per Gerai**: Hanya menampilkan gerai kasir aktif (Kemang & Sudirman). Unit Gudang Logistik/Pasokan disaring otomatis keluar dari penghitungan.
2. **Simulasi Top-Up Kuota & Penggunaan Kupon Promo**:
   * Klik tombol **"+ Top-Up Kuota Token"**.
   * Pilih paket kuota (misal: *Paket Starter 1.000 Order* - Rp 99.000).
   * Pilih metode pembayaran: **"QRIS Statis HQ"**.
   * Sistem menampilkan QR Code QRIS Statis Platform yang proporsional beserta petunjuk transfer m-Banking / dompet digital.
   * Masukkan kupon promosi: **`HEMAT50K`** ➔ Klik **"Terapkan"**.
   * Rincian tagihan terpotong Rp 50.000 secara otomatis dan transparan.
   * Klik tombol **"Beli Kuota Sekarang"** (layout tombol selalu tampil utuh di bagian bawah modal tanpa terpotong).
3. **Penerbitan & Pratinjau Faktur Digital Pajak Resmi**:
   * Setelah transaksi top-up dikonfirmasi, sistem langsung memunculkan **Modal Faktur Digital Pajak Resmi** berlatar Clean White-Blue.
   * Verifikasi kelengkapan faktur:
     - Kop resmi platform: *Well POS Platform & Cloud Services* dengan NITKU nasional (`3313122505910002000000 • Indonesia`).
     - Badge status pembayaran: **LUNAS (PAID)** dengan aksen hijau modern.
     - Nomor faktur unik: `INV/TOKEN/...`.
     - Tombol aksi: **"Cetak Faktur PDF"** dan **"Tutup"**.
4. **Pengelolaan QRIS Statis di SuperAdmin Control Tower**:
   * Buka portal SuperAdmin di `http://localhost:5173/#superadmin` (`superadmin@wellpos.id` / `SuperAdmin123!`).
   * Buka tab **Riwayat Billing & Invoicing**.
   * Klik tombol **"Kelola QRIS & Rekening Platform"**:
     - Admin dapat memperbarui nama bank, nomor rekening, nama pemilik rekening, serta gambar/string QRIS Statis platform.
     - Klik **"Simpan Pengaturan Pembayaran"** ➔ Konfigurasi langsung terpropagasi ke seluruh tenant merchant saat mereka membuka modal top-up.

---

#### Skenario 11: Otomasi BDD Split Bill, Multi-Tender & Siklus Piutang Kasbon CRM (Langkah 4)
**Tujuan**: Menguji implementasi formal BDD Gherkin (dwibahasa ID & EN) untuk fitur pemecahan tagihan meja (`SplitBillModal`), pelunasan multi-tender (Tunai + QRIS), pencatatan piutang kasbon pelanggan (`CUSTOMER_DEBT`), dan penagihan pelunasan di Backoffice CRM dengan proteksi 3 jalur pengujian (*Happy, Sad, Bad Path*).

* **Berkas Spesifikasi BDD**:
  - `features/split_bill_and_customer_debt.feature` (Bahasa Indonesia)
  - `features/split_bill_and_customer_debt.en.feature` (English)

1. **Jalankan Otomasi E2E Visual Playwright**:
   ```bash
   npm run test:visual:split-debt
   ```
2. **Cakupan 3 Jalur Pengujian BDD Gherkin**:
   * 🟢 **Happy Path**:
     - Kasir membuka modal pecah tagihan meja (`SplitBillModal`), memilih mode Bagi Rata (2 orang), lalu menyelesaikan pembayaran porsi pertama dengan metode **Multi-Tender** (Tunai Rp 25.000 + QRIS Dinamis Rp 25.600) -> Transaksi sukses berstatus `PAID`.
   * 🟡 **Sad Path**:
     - Kasir memilih metode **Kasbon (DEBT)** tanpa memilih pelanggan -> Tombol submit terkunci (*disabled*) dengan tooltip peringatan.
     - Kasir memilih pelanggan **Budi Santoso**, mengatur jatuh tempo +7 hari -> Checkout sukses berstatus `UNPAID`.
     - Owner membuka Backoffice CRM **Buku Kasbon & Piutang** (`?tab=customers&subtab=debts`), membuka modal pelunasan, memilih bayar lunas 100% -> Status piutang berhasil diperbarui menjadi `LUNAS / PAID`.
   * 🔴 **Bad Path**:
     - Kasir memilih metode **Multi-Tender**, memasukkan porsi tunai Rp 25.000, namun nominal uang fisik yang diterima kasir hanya Rp 10.000 (< Rp 25.000) -> Sistem menampilkan warning merah selisih `- Rp 15.000` dan mengunci tombol bayar untuk mencegah manipulasi selisih kas.
3. **Artefak Screenshot Visual Tersimpan**:
   * Seluruh bukti tangkapan layar responsif otomatis tersimpan rapi di:  
     `docs/artifacts/visual_split_debt/` (`happy_path/01-05`, `sad_path/01-06`, `bad_path/01`).

---

#### Skenario 12: Otomasi BDD End of Shift, Z-Report & Audit Selisih Kas Laci (Langkah 5)
**Tujuan**: Menguji siklus penutupan shift kasir (*CloseShiftModal*), kalkulator pecahan uang, rekonsiliasi kas fisik buta (*Blind Cash Count*), penerbitan struk resmi Z-Report, serta pencatatan audit log selisih kasir di Backoffice Owner (`?tab=shifts`).

* **Berkas Spesifikasi BDD**:
  - `features/end_of_shift_and_financial_audit.feature` (Bahasa Indonesia)
  - `features/end_of_shift_and_financial_audit.en.feature` (English)
* **Panduan Sales/Marketing Terkait**:
  - `docs/MARKETING_KIT_SALES_PLAYBOOK.md` (Pilar 5: Rekonsiliasi Finansial Laci Kas & Audit Kasir).

1. **Jalankan Otomasi E2E Visual Playwright**:
   ```bash
   npm run test:visual:shift-audit
   ```
2. **Cakupan 3 Jalur Pengujian BDD Gherkin**:
   * 🟢 **Happy Path**:
     - Kasir membuka modal tutup shift, memasukkan uang fisik laci pas dengan nilai sistem (Expected Cash).
     - Status selisih menampilkan badge hijau *"Status Kas: COCOK (PAS)"*, menekan tombol kunci shift, slip Z-Report resmi terbit, dan sesi shift di Backoffice Shifts Audit tercatat berstatus `SEIMBANG (Rp 0)`.
   * 🟡 **Sad Path**:
     - Kasir memasukkan uang fisik kurang Rp 20.000 dari ekspektasi sistem.
     - Sistem menampilkan peringatan merah *"Status Kas: KURANG (DEFISIT)"* sebesar `-Rp 20.000`, kasir mengisi catatan serah terima wajib, slip Z-Report mencatat defisit beserta catatan, dan Backoffice Shifts Audit menandai baris sesi dengan status `KURANG (SHORT)`.
   * 🔴 **Bad Path**:
     - Pengujian proteksi terhadap request uang fisik negatif (`actualCash: -50000`) ditolak tegas oleh sistem dengan status HTTP 400 Bad Request (*"Validasi uang fisik gagal"*).
3. **Artefak Screenshot Visual Tersimpan**:
   * Seluruh bukti tangkapan layar responsif otomatis tersimpan rapi di:  
     `docs/artifacts/visual_shift_audit/` (`happy_path/01-05`, `sad_path/01-06`, `bad_path/01`).

---

### 8. TROUBLESHOOTING & FAQ

* **Q: Port 5001 atau 5173 bentrok/sedang digunakan aplikasi lain?**  
  *Solusi*: Jalankan `lsof -ti:5001,5173 | xargs kill -9` sebelum menjalankan `./run-sandbox.sh`.
* **Q: Kasir tidak bisa transaksi karena shift belum dibuka?**  
  *Solusi*: Jalankan `npm run seed:sandbox`. Seeder sandbox secara default otomatis membuka sesi shift kasir dengan modal Rp 200.000 siap checkout.
* **Q: Ingin menambahkan menu produk baru dengan resep custom?**  
  *Solusi*: Masuk ke Backoffice Owner di menu *Katalog Produk* atau tambahkan definisi resep di `pos_apps/server/prisma/seed.sandbox.ts`.
* **Q: Database Supabase error 500 atau kolom tidak ditemukan setelah push kode baru?**  
  *Solusi*: Render hanya menjalankan `prisma generate`, bukan migrasi DDL otomatis. Jalankan patch DDL langsung ke Supabase via `DIRECT_URL` (Port 5432) atau `npx prisma db push`.
* **Q: Server remote lambat saat pertama kali diakses setelah lama idle?**  
  *Solusi*: Ini adalah *cold start* Render Free Tier (~50 detik). Sistem sudah dilengkapi GitHub Actions keep-alive setiap 10 menit, namun jika job GitHub tertunda, beri jeda 30-50 detik pada request pertama.
* **Q: Perubahan kode terbaru tidak muncul di domain Vercel (well-pos-app.vercel.app)?**  
  *Solusi*: Vercel Production hanya mendeploy commit dari branch `main`. Pastikan branch `dev` telah di-merge ke `main` dan di-push ke GitHub (`git checkout main && git merge dev && git push origin main`).
* **Q: Database Supabase tidak bisa diakses sama sekali (Connection Refused)?**  
  *Solusi*: Proyek Supabase free tier tidur jika 7 hari tidak aktif. Masuk ke [Supabase Dashboard](https://supabase.com/dashboard) dan klik tombol "Restore project".
