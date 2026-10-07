# WELL POS — SPESIFIKASI ARSITEKTUR STATE MACHINE & REKAYASA KUALITAS ALUR
## Pemetaan Lengkap Finite State Machine (FSM): Happy Path, Sad Path, Bad Path, Empty State & Error Notification Matrix

Dokumen ini adalah **spesifikasi kanonikal arsitektur transisi keadaan (*state machine*)** untuk seluruh alur utama platform **Well POS**, mulai dari *Onboarding Tenant*, *Store Setup Wizard*, *Manajemen Shift Kasir*, *Transaksi Checkout & Pembayaran*, *Otorisasi Keamanan Void*, hingga *Pelaporan Finansial*.

---

## 🗺️ PETA GLOBAL: LIFECYCLE STATE MACHINE UTAMA

Diagram Mermaid di bawah memetakan siklus hidup (*lifecycle*) end-to-end dari seorang tenant baru hingga menjalankan operasional kasir harian:

```mermaid
stateDiagram-v2
    [*] --> UNREGISTERED: Akses Landing Page

    state "FASE 1: TENANT ONBOARDING" as FASE1 {
        UNREGISTERED --> REGISTRATION_FORM_ACTIVE: Klik "Daftar Sekarang"
        REGISTRATION_FORM_ACTIVE --> REGISTRATION_SUBMITTED: Submit 5-Field Valid [Happy]
        REGISTRATION_FORM_ACTIVE --> REGISTRATION_FORM_ACTIVE: Email Duplikat / WA Invalid [Sad]
        REGISTRATION_SUBMITTED --> PENDING_APPROVAL: Menunggu Triage Superadmin
        PENDING_APPROVAL --> ACTIVE_APPROVED: Superadmin Klik "Setujui" [Happy]
        PENDING_APPROVAL --> REGISTRATION_REJECTED: Superadmin Klik "Tolak" [Bad]
        REGISTRATION_REJECTED --> [*]: Akun Ditangguhkan
        ACTIVE_APPROVED --> OWNER_AUTHENTICATED: Login Portal Pemilik [Happy]
        ACTIVE_APPROVED --> ACTIVE_APPROVED: Password Salah [Sad]
    }

    state "FASE 2: SETUP TOKO PERDANA" as FASE2 {
        OWNER_AUTHENTICATED --> STORE_EMPTY: Deteksi outlets.length === 0 [Empty State]
        STORE_EMPTY --> STORE_WIZARD_ACTIVE: Launch FullScreenStoreWizard
        STORE_WIZARD_ACTIVE --> STORE_WIZARD_ACTIVE: Field Wajib Kosong [Sad]
        STORE_WIZARD_ACTIVE --> STORE_READY: Submit Profil Toko & Industri [Happy]
        STORE_WIZARD_ACTIVE --> STORE_WIZARD_ACTIVE: Network Timeout [Bad / Retry]
    }

    state "FASE 3: KATALOG & MASTER DATA" as FASE3 {
        STORE_READY --> CATALOG_EMPTY: Masuk Backoffice [Empty State]
        CATALOG_EMPTY --> CREATING_CATEGORY_PRODUCT: Tambah Kategori & Produk
        CREATING_CATEGORY_PRODUCT --> CREATING_CATEGORY_PRODUCT: SKU Duplikat / Harga Minus [Sad]
        CREATING_CATEGORY_PRODUCT --> CATALOG_POPULATED: Produk Aktif & Stok Tersedia [Happy]
    }

    state "FASE 4: SHIFT KASIR (POS)" as FASE4 {
        CATALOG_POPULATED --> SHIFT_CLOSED: Buka Terminal Kasir [Empty State]
        SHIFT_CLOSED --> SHIFT_OPENING: Klik Buka Shift
        SHIFT_OPENING --> SHIFT_OPENING: Modal Awal Negatif [Sad]
        SHIFT_OPENING --> SHIFT_ACTIVE: Input Modal Awal Valid [Happy]
    }

    state "FASE 5: TRANSAKSI & CHECKOUT" as FASE5 {
        SHIFT_ACTIVE --> CART_EMPTY: Inisialisasi Keranjang [Empty State]
        CART_EMPTY --> CART_HOLDING_ITEMS: Pilih Produk
        CART_HOLDING_ITEMS --> CART_HOLDING_ITEMS: Stok Habis / Melebihi Batas [Sad]
        CART_HOLDING_ITEMS --> PAYMENT_SELECTION: Klik Bayar
        PAYMENT_SELECTION --> CASH_PROCESSING: Pilih Tunai
        PAYMENT_SELECTION --> QRIS_PROCESSING: Pilih QRIS
        CASH_PROCESSING --> CASH_PROCESSING: Uang Kurang dari Total [Sad]
        CASH_PROCESSING --> ORDER_COMPLETED: Uang Pas / Lebih [Happy]
        QRIS_PROCESSING --> ORDER_COMPLETED: QRIS Terbayar [Happy]
        ORDER_COMPLETED --> RECEIPT_PRINTED_OR_SENT: Cetak Struk / Kirim WhatsApp
    }

    state "FASE 6: TUTUP SHIFT & AUDIT" as FASE6 {
        RECEIPT_PRINTED_OR_SENT --> SHIFT_CLOSING_BLIND: Klik Tutup Shift Kasir
        SHIFT_CLOSING_BLIND --> SHIFT_BALANCED: Uang Fisik Klop (Selisih Rp 0) [Happy]
        SHIFT_CLOSING_BLIND --> SHIFT_DISCREPANCY: Selisih Fisik (+Over / -Short) [Sad]
        SHIFT_DISCREPANCY --> SHIFT_TERMINATED: Wajib Catat Alasan Selisih
        SHIFT_BALANCED --> SHIFT_TERMINATED: Pengesahan & Cetak Z-Report [Happy]
        SHIFT_TERMINATED --> FINANCIAL_REPORTING: Data Sinkron ke Backoffice
    }

    FINANCIAL_REPORTING --> [*]: Owner Memantau Laba Kotor & HPP
```

---

## 🔬 PEMETAAN 3 JALUR (*HAPPY, SAD, BAD PATH*) PER SUB-STATE MACHINE

### 1. Sub-Machine: Tenant Lifecycle & Onboarding

| Parameter | Spesifikasi Teknis |
| :--- | :--- |
| **Model DB Terkait** | Prisma `Tenant`, `User` |
| **Initial State** | `UNREGISTERED` |
| **Terminal State** | `OWNER_AUTHENTICATED` (atau `REGISTRATION_REJECTED`) |

#### Matriks Jalur (Paths):
* 🟢 **Happy Path**:
  1. `UNREGISTERED` $\rightarrow$ User mengisi form 5 field (Nama Depan, Belakang, WhatsApp, Email, Password).
  2. Sistem menormalkan telepon ke format `+628...` via `<WhatsAppInput />`.
  3. `REGISTRATION_SUBMITTED`: Data tersimpan dengan `tenant.status = 'PENDING'`.
  4. Superadmin membuka `#superadmin` $\rightarrow$ Menu Merchant $\rightarrow$ Klik **"Setujui"**.
  5. `ACTIVE_APPROVED`: Status berubah menjadi `'ACTIVE'`.
  6. Owner login di `#login` tab Portal Pemilik $\rightarrow$ `OWNER_AUTHENTICATED`.
* 🟡 **Sad Path (Recoverable)**:
  1. **Email Duplikat**: User memasukkan email yang sudah terdaftar.  
     *Response*: HTTP 400 Bad Request.  
     *UI Notification*: `dialog.alert({ title: 'Pendaftaran Gagal', message: 'Email sudah terdaftar. Silakan gunakan email lain atau masuk ke akun Anda.', variant: 'warning' })`.  
     *Recovery*: Form tetap terisi kecuali password, user mengganti alamat email.
  2. **Format Telepon Kurang Digit**: User memasukkan hanya 7 digit angka.  
     *UI Notification*: Inline badge merah *"Nomor WhatsApp minimal 9 digit"*. Tombol submit dinonaktifkan (`disabled`).
  3. **Password Mismatch**: Konfirmasi password berbeda dengan kata sandi utama.  
     *UI Notification*: Inline helper text *"Konfirmasi password tidak cocok"*.
* 🔴 **Bad Path (Unrecoverable / Hard Rejection)**:
  1. **Pendaftaran Ditolak Superadmin**: Superadmin mendeteksi data spam/tidak valid $\rightarrow$ Klik **"Tolak"** dengan alasan.  
     *State*: `REGISTRATION_REJECTED` (`tenant.status = 'SUSPENDED'`).  
     *UI Notification saat login*: `dialog.alert({ title: 'Akses Ditolak', message: 'Pendaftaran akun Anda ditolak atau akun dinonaktifkan oleh administrator. Hubungi tim bantuan.', variant: 'danger' })`.
  2. **Brute Force Login**: Memasukkan kata sandi salah berulang kali.  
     *UI Notification*: `dialog.alert({ title: 'Login Gagal', message: 'Email atau kata sandi yang Anda masukkan tidak sesuai.', variant: 'danger' })`.

---

### 2. Sub-Machine: First Store Setup Wizard (`FullScreenStoreWizard`)

| Parameter | Spesifikasi Teknis |
| :--- | :--- |
| **Model DB Terkait** | Prisma `Outlet` (Relasi 1:N dengan `Tenant`) |
| **Trigger Kondisi** | `user.role === 'OWNER' && user.outlets.length === 0` |
| **Terminal State** | `STORE_READY` |

#### Matriks Jalur (Paths):
* 🟢 **Happy Path**:
  1. `STORE_EMPTY`: Sistem mendeteksi toko belum ada, meluncurkan antarmuka layar penuh tanpa navbar distraktif.
  2. User memasukkan: Nama Pedagang (`Kopi Nusantara Group`), Nama Toko Pertama (`Kopi Nusantara - Outlet Malioboro`), No WA Toko (`+6281234567890`), Alamat (`Jl. Malioboro No. 45`), dan memilih chip industri `Kedai Kopi / Coffee Shop`.
  3. Klik tombol **"Selesaikan & Masuk ke Backoffice"**.
  4. Backend mengeksekusi `POST /api/outlets` $\rightarrow$ Toko dibuat dengan setting default struk & pajak.
  5. `STORE_READY`: Redirect otomatis ke Backoffice Dashboard dengan active outlet terpilih.
* 🟡 **Sad Path (Recoverable)**:
  1. **Field Wajib Belum Lengkap**: User langsung klik tombol simpan tanpa memilih industri atau mengisi alamat.  
     *UI Notification*: Banner peringatan oranye di header form: *"Harap lengkapi nama toko, nomor telepon, dan pilih minimal 1 kategori industri."*
  2. **Pencarian Chip Industri Nihil**: User mengetik industri antah berantah di search bar (misal: "Pesawat Terbang").  
     *Empty State UI*: Container chips menampilkan pesan: *"Tidak ada industri yang cocok dengan pencarian 'Pesawat Terbang'."* dengan tombol *"Gunakan Kategori Umum"*.
* 🔴 **Bad Path (Network Failure)**:
  1. **Koneksi Terputus saat Submit**: Server timeout saat menyimpan ke database.  
     *UI Notification*: `dialog.alert({ title: 'Gagal Menyimpan Toko', message: 'Terjadi kendala koneksi saat membuat toko perdana. Silakan coba klik simpan kembali.', variant: 'danger' })`.  
     *Safe State*: State form tidak di-reset, user tidak perlu mengetik ulang data dari awal.

---

### 3. Sub-Machine: Master Katalog & Persediaan (`CatalogMachine`)

```mermaid
stateDiagram-v2
    [*] --> CATALOG_EMPTY: Toko Baru Tanpa Produk

    state CATALOG_EMPTY {
        [*] --> RENDER_EMPTY_UI: products.length === 0
        RENDER_EMPTY_UI --> CTA_CLICKED: Klik "Tambah Produk Pertama"
    }

    CATALOG_EMPTY --> CATEGORY_SETUP: Buka Kategori Menu
    CATEGORY_SETUP --> PRODUCT_FORM_ACTIVE: Tambah Item Baru

    state PRODUCT_FORM_ACTIVE {
        [*] --> VALIDATING_FIELDS
        VALIDATING_FIELDS --> REJECT_NEGATIVE: Harga < 0 [Sad]
        VALIDATING_FIELDS --> REJECT_DUPLICATE_SKU: SKU Kembar [Sad]
        VALIDATING_FIELDS --> FIELD_VALIDATED: Input Sesuai Aturan [Happy]
    }

    PRODUCT_FORM_ACTIVE --> PRODUCT_SAVED: POST /api/products Berhasil
    PRODUCT_SAVED --> READY_FOR_SALE: Status Produk ACTIVE & Stok Tersedia
    READY_FOR_SALE --> [*]
```

#### Empty State & Error Notification Check:
* **Empty State Katalog**:  
  Saat `products.length === 0`: Menampilkan ilustrasi keranjang belanja kosong berlatar abu-abu lembut dengan teks *"Belum Ada Produk Terdaftar"*, deskripsi *"Katalog toko Anda masih kosong. Buat kategori menu dan daftarkan produk pertama untuk mulai berjualan di kasir"*, serta tombol aksi utama `+ Tambah Produk Baru`.
* **Sad Path Notifikasi**:
  * Harga Jual < 0: `<CurrencyInput />` memblokir input minus secara preventif. Jika di-bypass via API: `dialog.alert({ title: 'Harga Tidak Valid', message: 'Harga jual produk tidak boleh bernilai kurang dari Rp 0', variant: 'warning' })`.
  * Duplikasi Barcode: `dialog.alert({ title: 'Barcode Duplikat', message: 'Barcode telah digunakan oleh produk lain dalam toko ini.', variant: 'warning' })`.

---

### 4. Sub-Machine: Manajemen Shift Kasir (`ShiftMachine`)

```mermaid
stateDiagram-v2
    [*] --> SHIFT_CLOSED: Terminal Kasir Dibuka

    state SHIFT_CLOSED {
        [*] --> BLOCKED_POS_INTERACTION: Layar Transaksi Terkunci
        BLOCKED_POS_INTERACTION --> OPEN_SHIFT_MODAL: Klik "Buka Shift Kasir"
    }

    state OPEN_SHIFT_MODAL {
        [*] --> INPUT_STARTING_CASH
        INPUT_STARTING_CASH --> REJECT_MINUS_CASH: Modal Awal < 0 [Sad]
        INPUT_STARTING_CASH --> START_SHIFT_SUCCESS: Modal Awal >= 0 [Happy]
    }

    OPEN_SHIFT_MODAL --> SHIFT_ACTIVE: POST /api/shifts/start

    state SHIFT_ACTIVE {
        [*] --> ACCEPTING_TRANSACTIONS: Kasir Menjual Item
        ACCEPTING_TRANSACTIONS --> CLOSE_SHIFT_REQUESTED: Klik "Tutup Shift"
    }

    SHIFT_ACTIVE --> BLIND_COUNT_MODAL: Buka CloseShiftModal

    state BLIND_COUNT_MODAL {
        [*] --> INPUT_ACTUAL_CASH: Kasir Input Uang Fisik Laci
        INPUT_ACTUAL_CASH --> CALC_DISCREPANCY: diff = actual - expected
        CALC_DISCREPANCY --> ZERO_DIFF: diff === 0 (Klop) [Happy]
        CALC_DISCREPANCY --> WARN_DIFF: diff !== 0 (Selisih) [Sad]
        WARN_DIFF --> REQUIRE_AUDIT_NOTES: Wajib Isi Catatan Alasan
    }

    BLIND_COUNT_MODAL --> SHIFT_SETTLED: POST /api/shifts/close
    SHIFT_SETTLED --> Z_REPORT_PREVIEW: Render Printable Z-Report
    Z_REPORT_PREVIEW --> SHIFT_CLOSED: Transaksi Selesai & Kasir Logout
```

#### Empty State, Discrepancy & Error Checks:
* **Empty State Shift**:  
  Saat kasir mencoba memilih produk di katalog ketika shift belum dimulai:  
  *Banner/Toast*: `⚠️ Shift kasir belum dibuka! Buka shift kasir terlebih dahulu untuk mulai transaksi.`  
  *Aksi Otomatis*: Sistem langsung meluncurkan modal `StartShiftModal` di atas layar kasir.
* **Sad Path (Selisih Kas Fisik / Discrepancy)**:  
  Jika uang fisik yang dihitung kasir tidak cocok dengan ekspektasi sistem (`actualCash !== expectedCash`):  
  *UI Banner*: Muncul kotak kuning-oranye berlatar lembut di dalam `CloseShiftModal`:  
  *"Terdapat selisih kas sebesar Rp X (+Lebih / -Kurang). Supervisor dan Kasir wajib memverifikasi nota transaksi fisik dan mencatat alasan selisih pada kolom catatan sebelum menutup kasir."*  
  *Catatan Audit*: Kolom input textarea `Catatan Rekonsiliasi Kasir` berubah menjadi *required*.
* **Bad Path (Input Fisik Negatif)**:  
  Jika kasir memasukkan angka negatif:  
  *Error Message*: *"Nominal uang fisik tidak boleh negatif"*. Tombol submit diblokir.

---

### 5. Sub-Machine: Keranjang & Transaksi Kasir (`PosCheckoutMachine`)

```mermaid
stateDiagram-v2
    [*] --> CART_EMPTY: Inisialisasi Terminal

    state CART_EMPTY {
        [*] --> RENDER_EMPTY_CART_UI: Keranjang Kosong
        RENDER_EMPTY_CART_UI --> ATTEMPT_CHECKOUT: Klik Bayar [Sad]
        ATTEMPT_CHECKOUT --> ALERT_EMPTY_CART: dialog.toast('Keranjang belanja masih kosong!', 'error')
    }

    CART_EMPTY --> CART_HOLDING_ITEMS: Klik Item Katalog [Happy]

    state CART_HOLDING_ITEMS {
        [*] --> CHECK_STOCK
        CHECK_STOCK --> ALERT_OUT_OF_STOCK: stock <= 0 [Sad]
        CHECK_STOCK --> ALERT_MAX_STOCK: qty > stock [Sad]
        CHECK_STOCK --> ITEM_INSERTED: stock cukup [Happy]
    }

    CART_HOLDING_ITEMS --> PAYMENT_MODAL: Klik "Bayar (F9)"

    state PAYMENT_MODAL {
        [*] --> SELECT_METHOD
        SELECT_METHOD --> CASH_FLOW: Metode TUNAI
        SELECT_METHOD --> QRIS_FLOW: Metode QRIS
        SELECT_METHOD --> DEBT_FLOW: Metode KASBON

        state CASH_FLOW {
            [*] --> CHECK_TENDERED
            CHECK_TENDERED --> CASH_INSUFFICIENT: amountPaid < grandTotal [Sad]
            CHECK_TENDERED --> CASH_SUFFICIENT: amountPaid >= grandTotal [Happy]
        }

        state DEBT_FLOW {
            [*] --> CHECK_CUSTOMER_SELECTED
            CHECK_CUSTOMER_SELECTED --> REJECT_ANONYMOUS: customerId null [Sad]
            CHECK_CUSTOMER_SELECTED --> ACCEPT_DEBT: customer terdaftar [Happy]
        }
    }

    PAYMENT_MODAL --> TRANSACTION_SUCCESS: POST /api/orders
    TRANSACTION_SUCCESS --> RECEIPT_MODAL: Tampilkan Struk Thermal / WA
    RECEIPT_MODAL --> CART_EMPTY: Reset Keranjang & Siap Order Berikutnya
```

#### Empty State & Error Notification Check:
* **Empty State Keranjang**:  
  Saat `cart.length === 0`: Panel kanan menampilkan ikon belanja abu-abu, teks *"Keranjang Belanja Kosong"*, *"Pilih produk di katalog atau scan barcode untuk menambahkan pesanan."*, dan tombol Bayar disabled berwarna abu-abu redup.
* **Sad Path (Stok Habis / Out-of-Stock)**:  
  *Trigger*: Kasir menekan produk non-composite dengan stok 0.  
  *UI Alert*: `dialog.alert({ title: 'Stok Produk Habis', message: 'Stok "[Nama Produk]" saat ini habis (0)!', variant: 'warning' })`.
* **Sad Path (Uang Tunai Kurang)**:  
  *Trigger*: Nominal uang diterima lebih kecil dari grand total.  
  *UI State*: Label peringatan merah *"Uang diterima kurang Rp [Kekurangan]"*. Tombol *"Selesaikan Pembayaran"* dinonaktifkan (`disabled`).
* **Sad Path (Kasbon Tanpa Pelanggan Terdaftar)**:  
  *Trigger*: Kasir memilih metode kasbon tetapi transaksi anonim (tanpa nama pelanggan).  
  *UI State*: Tombol terblokir dengan peringatan *"Pilih pelanggan terdaftar terlebih dahulu untuk transaksi piutang/kasbon"*.

---

### 6. Sub-Machine: Keamanan Transaksi & Otorisasi PIN Supervisor (`VoidMachine`)

```mermaid
stateDiagram-v2
    [*] --> ORDER_ACTIVE: Transaksi Telah Selesai (PAID)

    ORDER_ACTIVE --> VOID_REQUESTED: Kasir Klik "Batalkan Pesanan (Void)"

    state VOID_MODAL {
        [*] --> CHECK_USER_ROLE
        CHECK_USER_ROLE --> PRIVILEGED: Role OWNER / ADMIN / SUPERVISOR
        CHECK_USER_ROLE --> RESTRICTED: Role CASHIER

        state RESTRICTED {
            [*] --> REQUIRE_SPV_PIN: Wajib Input 6-Digit PIN Supervisor
            REQUIRE_SPV_PIN --> VALIDATE_PIN
            VALIDATE_PIN --> REJECT_WRONG_PIN: PIN Salah / Invalid [Bad]
            VALIDATE_PIN --> APPROVE_PIN: PIN Cocok [Happy]
        }
    }

    VOID_MODAL --> EXECUTE_VOID: POST /api/orders/:id/void
    EXECUTE_VOID --> ORDER_VOIDED: Stok Dikembalikan & Kas Laci Dikoreksi
    ORDER_VOIDED --> [*]
```

#### Bad Path & Security Alert Check:
* **Bad Path (Kasir Mencoba Void Tanpa Izin)**:  
  *Trigger*: Kasir memasukkan PIN sembarangan atau PIN kasirnya sendiri.  
  *UI Error*: Kotak peringatan merah di dalam `VoidOrderModal`: *"PIN Supervisor tidak valid atau tidak memiliki wewenang pembatalan transaksi."*  
  *Security Log*: Percobaan gagal dicatat pada audit log. Transaksi tetap berstatus `PAID` dan uang kas tidak boleh berkurang.
* **Happy Path (Supervisor Hadir Memasukkan PIN)**:  
  *Outcome*: Transaksi diberi stempel `VOIDED` dengan coretan visual di riwayat pesanan, stok bahan baku/produk otomatis di-rollback bertambah ke stok gudang/toko, dan slip retur dapat dicetak.

---

### 7. Sub-Machine: Menu Tamu Mandiri QR Meja (`QrMenuMachine`)

| Parameter | Spesifikasi Teknis |
| :--- | :--- |
| **Model DB Terkait** | Prisma `Outlet`, `Product`, `QrTable`, `Order` |
| **Entry Point** | Public Web URL `http://localhost:5173/#menu?outletId=...&table=...` |
| **Terminal State** | `QR_ORDER_SUBMITTED` |

#### Matriks Jalur (Paths):
* 🟢 **Happy Path**:
  1. Tamu memindai QR Code di meja 04 $\rightarrow$ Menu digital terbuka lengkap dengan nama toko & nomor meja.
  2. Tamu memilih menu, menentukan varian rasa/topping, dan mengisi catatan pesanan.
  3. Buka keranjang meja $\rightarrow$ Isi nama pemesan *"Dimas"* dan no WhatsApp `081298765432`.
  4. Klik **"Kirim Pesanan ke Dapur / Kasir"**.
  5. Pesanan diterima secara real-time pada modul POS Kasir (`QrLiveOrdersView`) dengan status `UNPAID` (Open Tab) siap diproses dapur.
* 🟡 **Sad Path (Recoverable)**:
  1. **Nama Tamu Belum Diisi**: Tamu menekan tombol konfirmasi tanpa mengisi nama.  
     *UI Notification*: `dialog.alert({ title: 'Nama Wajib Diisi', message: 'Isi nama untuk melihat contoh tampilan konfirmasi.', variant: 'warning' })`.
  2. **Varian Wajib Belum Dipilih**: Tamu memilih produk dengan modifier grup berstatus *required* (misal: Level Pedas) tanpa memilih opsi.  
     *UI State*: Modal kustomisasi menampilkan badge merah *"Pilih minimal 1 opsi untuk melanjutkan"*. Tombol *"Tambah ke Pesanan"* dinonaktifkan.
* 🔴 **Bad Path (Meja Tidak Ditemukan / QR Invalid)**:
  1. Tamu mengakses URL dengan ID meja fiktif.  
     *UI Empty / Error State*: Layar menampilkan ikon peringatan *"Meja Tidak Ditemukan. Silakan hubungi staf pelayan atau minta QR code meja yang aktif."*

---

### 8. Sub-Machine: Laporan Finansial & Analisis Bisnis (`ReportingMachine`)

| Parameter | Spesifikasi Teknis |
| :--- | :--- |
| **Model DB Terkait** | Agregasi Prisma `Order`, `OrderItem`, `Shift`, `ProductCost` |
| **Initial State** | `REPORT_FILTER_SELECT` |
| **Terminal State** | `REPORT_DISPLAYED` |

#### Matriks Jalur (Paths):
* 🟢 **Happy Path**:
  1. Pemilik memilih filter rentang tanggal (misal: "Hari Ini" atau "Bulan Ini").
  2. Sistem menghitung total penjualan kotor, diskon, omzet bersih, HPP riil bahan baku, dan laba kotor.
  3. `REPORT_DISPLAYED`: Tampil kartu ringkasan omzet, grafik tren penjualan, breakdown metode bayar, dan tabel produk terlaris.
* 🟡 **Sad Path (Empty State - Belum Ada Penjualan)**:
  1. Pemilik memilih rentang tanggal baru buka di mana belum ada satupun transaksi selesai.  
     *Empty State UI*: Kartu statistik menampilkan nominal `Rp 0`. Grafik menampilkan placeholder flat dengan pesan bersahabat: *"Belum ada transaksi penjualan pada rentang tanggal yang dipilih. Mulai operasional kasir untuk melihat pertumbuhan omzet bisnis Anda."*
* 🔴 **Bad Path (Network Failure / Cold Start)**:
  1. Koneksi API lambat atau cold start backend.  
     *UI State*: Skeleton loading animasi shimmer ditampilkan. Jika terjadi timeout, muncul banner: *"Gagal memuat laporan finansial. Periksa koneksi internet Anda."* dengan tombol **"Muat Ulang Data"**.

---

## 📋 TABEL REFERENSI KANONIKAL ERROR NOTIFICATION & EMPTY STATE

Berikut adalah inventaris lengkap seluruh pesan notifikasi, toast, dan komponen *empty state* yang telah distandarisasi di Well POS:

| Modul / Domain | Skenario Alur | Jenis Tampilan | Teks Notifikasi / Tampilan Persis | Aksi Pemulihan (Recovery) |
| :--- | :--- | :--- | :--- | :--- |
| **Registrasi** | Email sudah terdaftar | Dialog Alert (Warning) | `"Email sudah terdaftar. Silakan gunakan email lain atau masuk ke akun Anda."` | Fokuskan kursor ke input email bisnis |
| **Registrasi** | Password mismatch | Inline Helper Text | `"Konfirmasi password tidak cocok"` | Blokir tombol submit hingga password identik |
| **Superadmin** | Menolak akun pendaftar | Modal Konfirmasi | `"Apakah Anda yakin ingin menolak pendaftaran akun [Nama]?"` | Simpan alasan penolakan & ubah status ke SUSPENDED |
| **Store Wizard** | Toko belum ada | Full-Screen Wizard | Layar penuh wizard onboarding toko perdana | Pandu pemilik mengisi identitas toko & industri |
| **Store Wizard** | Kategori industri nihil | Empty State Container | `"Tidak ada industri yang cocok dengan pencarian \"[Keyword]\"."` | Tampilkan tombol fallback industri umum |
| **Katalog** | Belum ada produk | Empty State Card | `"Belum Ada Produk Terdaftar. Katalog toko Anda masih kosong."` | Klik tombol `+ Tambah Produk Baru` |
| **Katalog** | Stok habis saat dipilih | Dialog Alert (Warning) | `"Stok Produk Habis: Stok \"[Nama Produk]\" saat ini habis (0)!"` | Batalkan penambahan item ke keranjang |
| **Katalog** | Qty melebihi stok | Dialog Alert (Warning) | `"Batas Stok Tercapai: Jumlah pesanan melebihi stok tersedia ([Stock])!"` | Kunci kuantitas keranjang pada angka stok maksimal |
| **POS Shift** | Transaksi sebelum buka shift | Toast / Alert (Warning) | `"⚠️ Shift kasir belum dibuka! Buka shift kasir terlebih dahulu untuk mulai transaksi."` | Luncurkan otomatis `StartShiftModal` |
| **POS Shift** | Modal awal negatif | Dialog Alert (Warning) | `"Modal awal tidak boleh bernilai negatif"` | Koreksi nilai input menjadi minimal Rp 0 |
| **POS Shift** | Selisih kas saat tutup shift | Warning Banner (Amber) | `"Perhatian: Terdapat selisih kas sebesar Rp X. Masukkan catatan penjelasan sebelum tutup shift."` | Wajibkan kasir mengisi catatan audit rekonsiliasi |
| **POS Kasir** | Keranjang belanja kosong | Dialog Toast (Error) | `"Keranjang belanja masih kosong!"` | Tombol bayar disabled |
| **POS Kasir** | Uang tunai kurang | Live Validation Banner | `"Uang yang diterima kurang Rp [Selisih]"` | Tombol submit pembayaran disabled |
| **POS Kasir** | Kasbon tanpa pelanggan | Disabled Button Tooltip | `"Pilih pelanggan terdaftar terlebih dahulu untuk transaksi kasbon"` | Buka modal picker pelanggan |
| **Keamanan Void** | PIN Supervisor salah | Modal Alert (Danger) | `"PIN Supervisor salah atau tidak memiliki wewenang pembatalan transaksi."` | Batalkan aksi void & catat percobaan gagal di log |
| **Menu QR Tamu** | Tamu belum isi nama | Dialog Alert (Warning) | `"Nama Wajib Diisi: Isi nama untuk melihat contoh tampilan konfirmasi."` | Fokuskan kursor ke input nama tamu |
| **Laporan** | Tidak ada data di tanggal filter | Friendly Empty State | `"Belum ada transaksi pada rentang tanggal ini."` | Tampilkan saran ubah filter kalender |

---

## 🛠️ INTEGRASI DENGAN ALUR PENGUJIAN OTOMATIS & PLAYWRIGHT

Seluruh matriks keadaan di atas telah dipetakan ke dalam spesifikasi **Page Object Model (POM)**:
1. `LandingPage.js`: Menguji Happy Path registrasi & Sad Path email duplikat.
2. `SuperadminPage.js`: Menguji Happy Path approval & Bad Path penolakan merchant.
3. `StoreWizardPage.js`: Menguji Happy Path pembuatan toko & Sad Path validasi form.
4. `PosTerminalPage.js`: Menguji Sad Path shift terkunci, Sad Path keranjang kosong, Happy Path tunai/QRIS, serta Sad Path selisih kas tutup shift.
5. `CustomerQrPage.js`: Menguji Happy Path pemesanan meja & Sad Path form nama kosong.

> **Visual Explorer**: Anda dapat membuka visualizer interaktif arsitektur state machine ini secara langsung di browser Anda melalui berkas:  
> [`docs/artifacts/state_machine_interactive.html`](file:///Users/dendyaditya/Projects/pos_project/docs/artifacts/state_machine_interactive.html).
