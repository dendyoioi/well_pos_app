# WELL POS — PANDUAN LENGKAP SALES DEMO & BAHAN MARKETING KIT
## *Master Playbook Presentasi Fitur, Unique Selling Points (USP), & Bukti Keandalan Sistem*

> **Dokumen Resmi**: Pegangan lengkap pemilik platform, tim sales, dan product marketing untuk menyusun materi promosi (*pitch deck*, brosur, landing page, video demo, dan proposal penawaran B2B) kepada calon merchant / tenant F&B dan Ritel di Indonesia.

---

## 🎯 1. EXECUTIVE SUMMARY & TARGET PASAR

**Well POS** adalah platform SaaS Kasir Modern (*Point of Sale*), Manajemen Rantai Pasok (*Supply Chain*), dan Akuntansi Laba Rugi Real-Time berbasis Web & PWA (*Progressive Web App*).

### 👥 Profil Calon Penyewa (*Target Personas*):
1. **Pemilik Kafe & Kedai Kopi (Coffee Shop / Artisan Roastery)**:
   - *Titik Sakit (Pain Points)*: Bahan baku susu/biji kopi sering bocor, HPP tidak terhitung presisi, pesanan meja ramai saat *peak hours*.
2. **Restoran & Rumah Makan (Casual Dining & Fast Food)**:
   - *Titik Sakit*: Tamu meminta pisah tagihan meja (*split bill*), antrean kasir panjang, stok menu habis mendadak di dapur.
3. **Toko Ritel & Minimarket Modern**:
   - *Titik Sakit*: Modal awal mahal untuk membeli scanner barcode laser dan mesin kasir konvensional.
4. **Bisnis Multi-Toko / Multi-Outlet**:
   - *Titik Sakit*: Sulit memantau kas di berbagai cabang yang berbeda zona waktu (WIB, WITA, WIT), kebocoran uang kasir di akhir shift.

---

## 💎 2. LIMA NILAI JUAL UTAMA (THE 5 CORE USPs)
*Berdasarkan 5 Fondasi Rekayasa Kualitas & Pengujian Otomasi Terverifikasi*

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        5 PILAR KEUNGGULAN WELL POS                     │
├───────────────────┬───────────────────┬────────────────────────────────┤
│ 1. ANTI-KEBOCORAN │ 2. ZERO-HARDWARE  │ 3. DISIPLIN STAF               │
│    BAHAN BAKU     │    INVESTMENT     │    & MULTI-TIMEZONE            │
│  Resep BOM potong │ Scan via kamera HP│ Absensi PIN staf mandiri,      │
│  stok gramatur cup│ cetak label rak   │ sinkron WIB/WITA/WIT otomatis  │
├───────────────────┴───────────────────┴────────────────────────────────┤
│ 4. FLEKSIBILITAS TRANSAKSI            │ 5. REKONSILIASI KAS AKURAT     │
│  Split bill meja, multi-tender tunai  │ Blind close shift, deteksi     │
│  + QRIS, dan buku piutang kasbon CRM  │ selisih laci kas, Z-Report     │
└───────────────────────────────────────┴────────────────────────────────┘
```

---

## 🎬 3. MODUL DEMO & PANDUAN PITCHING PER FITUR (STEP-BY-STEP)

---

### ☕ PILAR 1: Resep BOM F&B & Pemotongan Stok Otomatis (*EPIC-06*)

#### A. Cerita Masalah (*Problem Narrative*):
> *"Banyak pemilik kafe rugi bukan karena sepi pelanggan, tapi karena bahan baku bocor di bar! Barista menuang susu berlebih atau cup terbuang tanpa tercatat. Di akhir bulan, laba kotor di Excel meleset jauh dari kenyataan."*

#### B. Solusi Well POS:
* **Formula Resep Presisi (BOM)**: Setiap menu dikaitkan dengan bahan baku mentah (misal: 1 cup Kopi Susu Aren memotong **18g Biji Kopi**, **120ml Fresh Milk**, **20ml Gula Aren**, dan **1 Paper Cup**).
* **Live HPP Calculation**: Begitu resep diinput, sistem langsung menghitung estimasi HPP (contoh: Rp 8.400) dan margin keuntungan (61.8%).
* **Pemotongan Otomatis Seketika**: Saat kasir menyelesaikan transaksi, persediaan fisik di toko langsung terpotong akurat tanpa input manual.

#### C. Skrip Pitching Sales (*Demo Script*):
> *"Bapak/Ibu tidak perlu lagi mencatat pemakaian bahan di buku tulis. Coba perhatikan layar kasir ini: stok biji kopi di sistem ada 1.000 gram. Begitu kasir menjual 2 cup Kopi Susu Aren, stok biji kopi langsung berkurang 36 gram menjadi 964 gram. Stok selalu sinkron, anti-curang, dan HPP tercatat otomatis!"*

#### D. Bukti Artefak Visual & Pengujian:
* **Spesifikasi Uji**: [`scripts/test_fnb_recipes_deduction_visual.js`](file:///Users/dendyaditya/Projects/pos_project/scripts/test_fnb_recipes_deduction_visual.js) (`npm run test:visual:recipes`).
* **Artefak Screenshot**: `docs/artifacts/visual_fnb_recipes/happy_path/` (Pendaftaran Bahan -> Hubungkan Resep -> Pemotongan Kasir).

---

### 📷 PILAR 2: Live Camera Barcode Scanner & Cetak Label Rak (*EPIC-26*)

#### A. Cerita Masalah (*Problem Narrative*):
> *"Memulai toko ritel biasanya terbentur biaya beli alat scanner laser mahal (jutaan rupiah per kasir) dan kerepotan mendesain label harga di rak toko."*

#### B. Solusi Well POS:
* **Pemindai Kamera Bawaan (WebRTC + ZXing)**: Menggunakan kamera smartphone atau laptop untuk memindai barcode 1D (EAN-13, Code 128) dan 2D (QR Code) secepat kilat dengan audio chime & getar.
* **Studio Label Rak Vektor SVG**: Menghasilkan stiker label harga dan rak tajam untuk printer thermal mini (40x30mm) maupun kertas kantor A4 grid tanpa blur.

#### C. Skrip Pitching Sales (*Demo Script*):
> *"Buka toko baru tanpa keluar modal jutaan rupiah untuk scanner barcode. Cukup arahkan kamera smartphone kasir ke barcode produk, sistem langsung mendeteksi dan memasukkan barang ke keranjang belanja. Mau cetak label rak? Cukup 1-klik dari Backoffice!"*

---

### ⏰ PILAR 3: Absensi Staf Mandiri, Toleransi Kehadiran & Multi-Timezone (*EPIC-28*)

#### A. Cerita Masalah (*Problem Narrative*):
> *"Mesin absensi fingerprint sering rusak atau terpisah dari sistem POS. Jam operasional kasir sering terlambat buka toko tanpa alasan yang jelas, dan pemilik bisnis multi-cabang pusing mengatur perbedaan jam antara Jakarta, Bali, dan Jayapura."*

#### B. Solusi Well POS:
* **Absensi Terpisah dari Shift (Decoupled)**: Staf dapur, barista, dan kasir clock-in mandiri menggunakan PIN 4-6 digit langsung di terminal POS tanpa mengganggu pembukuan kas laci.
* **Toleransi Keterlambatan Otomatis**: Jika staf datang melewati jam standar + toleransi (misal 15 menit), sistem otomatis menetapkan status `LATE` dan meminta alasan keterlambatan.
* **Zero-Config 3 Zona Waktu (WIB, WITA, WIT)**: Deteksi otomatis waktu lokal perangkat sehingga laporan kehadiran dan laporan penjualan tidak pernah kacau karena selisih jam server.

#### C. Skrip Pitching Sales (*Demo Script*):
> *"Seluruh staf toko Anda bisa absensi di satu tablet kasir bersama cukup dengan memasukkan PIN masing-masing. Terlambat 10 menit? Sistem otomatis mencatat menit keterlambatan dan alasannya. Jika Anda punya toko di Jakarta dan Bali, laporan jam kerja masing-masing toko otomatis menyesuaikan waktu lokal!"*

---

### 💳 PILAR 4: Split Bill, Multi-Tender (Tunai + QRIS), & Siklus Piutang Kasbon (*EPIC-27*)

#### A. Cerita Masalah (*Problem Narrative*):
> *"Pelanggan rombongan kafe sering minta 'pisah bon' (split bill) atau bayar sebagian tunai dan sisanya QRIS. Banyak kafe juga punya pelanggan tetap atau kantor tetangga yang kasbon, tapi catatannya tercecer di nota kertas dan lupa ditagih."*

#### B. Solusi Well POS:
* **Pecah Tagihan Fleksibel (`SplitBillModal`)**: Pilihan Bagi Rata (*Equal Split*) hingga 10 orang atau Bagi per Item Menu (*Split by Item*).
* **Multi-Tender Payment**: Pembayaran gabungan porsi tunai fisik dan non-tunai (QRIS Dinamis) dalam satu transaksi checkout yang sah.
* **Buku Kasbon & Penagihan WhatsApp 1-Klik**: Pencatatan kasbon pelanggan CRM berjatuh tempo (+7, +14, +30 hari), modal pelunasan bertahap/lunas, dan tombol kirim invoice ramah via WhatsApp.
* **Proteksi Uang Kurang (Anti-Underpaid)**: Tombol bayar terkunci otomatis dengan peringatan selisih merah jika kasir menerima uang kurang dari nilai porsi split.

#### C. Skrip Pitching Sales (*Demo Script*):
> *"Rombongan 4 orang mau bayar patungan? Buka fitur Split Bill, pilih bagi rata, dan masing-masing bisa bayar pakai metode berbeda—orang pertama tunai, orang kedua QRIS. Ada pelanggan VIP mau kasbon? Catat atas nama beliau dengan jatuh tempo 7 hari. Begitu jatuh tempo, kirim pengingat ramah lewat WhatsApp dengan 1-klik!"*

#### D. Bukti Artefak Visual & Pengujian:
* **Berkas BDD**: [`features/split_bill_and_customer_debt.feature`](file:///Users/dendyaditya/Projects/pos_project/features/split_bill_and_customer_debt.feature).
* **Runner**: `npm run test:visual:split-debt`.
* **Artefak Screenshot**: `docs/artifacts/visual_split_debt/` (`happy_path/01-05`, `sad_path/01-06`, `bad_path/01`).

---

### 🔒 PILAR 5: Rekonsiliasi Finansial Laci Kas (End of Shift), Z-Report & Audit Selisih (*EPIC-05*)

#### A. Cerita Masalah (*Problem Narrative*):
> *"Kebocoran uang tunai kasir paling sering terjadi saat pergantian shift. Jika kasir tahu angka ekspektasi sistem sebelum menghitung uang fisik, mereka bisa menyamarkan uang yang hilang atau menyisihkan kelebihan uang."*

#### B. Solusi Well POS:
* **Hitung Uang Kas Laci Buta (*Blind Close Shift Policy*)**: Kasir wajib menghitung uang fisik di laci dan memasukkan angka riil. Sistem menyembunyikan angka target sampai kasir menekan tombol konfirmasi.
* **Kalkulator Lembar Pecahan Uang**: Fitur pembantu hitung per lembar pecahan (Rp 100rb, Rp 50rb, koin) untuk mempermudah kasir menghitung cepat tanpa kalkulator luar.
* **Deteksi Selisih Riil (Cocok / Kurang / Lebih)**: Deteksi otomatis selisih kas fisik terhadap modal awal, penjualan tunai, dan pelunasan kasbon. Jika ada minus, sistem mewajibkan catatan serah terima.
* **Slip Z-Report Termal Resmi**: Pratinjau struk rekapitulasi shift yang mencantumkan modal awal, omzet per kanal, mutasi kasir, dan selisih kas.
* **Audit Trail di Backoffice Owner**: Pemilik dapat memantau riwayat seluruh shift toko dengan indikator warna status (`SEIMBANG`, `KURANG`, `LEBIH`).

#### C. Skrip Pitching Sales (*Demo Script*):
> *"Saat toko tutup, kasir menghitung uang fisik di laci. Jika ada uang tercecer Rp 20.000, sistem langsung mengunci selisih defisit tersebut, mencatat catatan serah terima kasir, dan mencetaknya di Z-Report. Pemilik toko bisa melihat riwayat selisih kas ini langsung dari HP kapan saja!"*

#### D. Bukti Artefak Visual & Pengujian:
* **Berkas BDD**: [`features/end_of_shift_and_financial_audit.feature`](file:///Users/dendyaditya/Projects/pos_project/features/end_of_shift_and_financial_audit.feature).
* **Runner**: `npm run test:visual:shift-audit`.
* **Artefak Screenshot**: `docs/artifacts/visual_shift_audit/` (`happy_path/01-05`, `sad_path/01-06`, `bad_path/01`).

---

## 📊 4. MATRIKS PERBANDINGAN KOMPETITOR (COMPETITIVE ADVANTAGE)

| Kriteria Evaluasi | POS Tradisional / Kompetitor | **Well POS Platform** |
| :--- | :--- | :--- |
| **Biaya Perangkat Keras** | Wajib beli mesin khusus (Rp 5jt - 15jt) | **Rp 0** (Gunakan HP, tablet, laptop apa saja via PWA) |
| **Resep F&B & Stok Mentah** | Terbatas atau berbayar mahal di paket add-on | **Termasuk (BOM otomatis potong stok & HPP live)** |
| **Scanner Barcode** | Wajib beli alat scanner USB/Bluetooth eksternal | **Bawaan kamera HP/Laptop + Audio Feedback** |
| **Split Bill & Multi-Tender** | Ribet, sering error saat bagi rata | **Mulus (Equal Split, by-item, Tunai + QRIS)** |
| **Buku Kasbon CRM** | Manual nota kertas, rawan lupa ditagih | **Buku Piutang Terintegrasi + Penagihan WhatsApp** |
| **Tutup Shift Kasir** | Kasir bisa mengarang angka hitungan | **Blind Cash Count + Z-Report + Audit Discrepancy** |
| **Multi-Timezone (WIB/WITA/WIT)** | Terikat waktu server pusat (Jakarta) | **100% Zero-Config sinkron ke timezone toko lokal** |

---

## 🛠️ 5. PANDUAN QUICK-START DEMO SANDBOX (3 MENIT PITCH)

Bagi tim sales/marketing yang ingin menjalankan live demo instan di hadapan klien:

1. **Jalankan Sandbox**:
   ```bash
   ./run-sandbox.sh
   ```
2. **Kredensial Demo Aktif**:
   * **Portal Pemilik / Kasir**: `owner@uracoffee.id` / `Owner123!` (Toko: Ura Coffee - Flagship Kemang)
   * **Portal SuperAdmin HQ**: `superadmin@wellpos.id` / `SuperAdmin123!`
3. **Alur Demo Cepat 3 Menit**:
   * **Menit 1**: Masuk POS ➔ Tambah menu Kopi Susu Aren ➔ Perlihatkan resep BOM & margin ➔ Checkout Split Bill.
   * **Menit 2**: Pilih member "Budi Santoso" ➔ Catat Kasbon ➔ Buka Backoffice CRM dan perlihatkan buku kasbon & tombol WhatsApp.
   * **Menit 3**: Klik Tutup Shift ➔ Perlihatkan kalkulator lembar uang ➔ Selesaikan Z-Report ➔ Buka Laporan Audit Shift.

---

## 🏆 KESIMPULAN PRODUK
Platform **Well POS** dirancang untuk memberi ketenangan pikiran (*peace of mind*) kepada pengusaha: **stok bahan aman, uang kas tidak bocor, staf terpantau tertib, dan keputusan bisnis didasarkan pada data laba riil**.
