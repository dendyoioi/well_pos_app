# STANDAR KANONIKAL UI/UX DESIGN SYSTEM & ROADMAP PENATAAN SISTEM (WELL POS)

Dokumen ini adalah acuan resmi (*single source of truth*) untuk standarisasi seluruh antarmuka pengguna (UI/UX) di aplikasi Well POS (Backoffice Pemilik, Mesin Kasir POS, dan PWA Mobile).

---

## 🎨 I. TOKENS & ATURAN BAKU KOMPONEN UI (*DESIGN SYSTEM RULES*)

### 1. Standar Tombol Kanonikal (`<Button />`)

Semua tombol di aplikasi wajib mengacu pada dimensi, tinggi (*height*), dan tipografi yang seragam:

| Ukuran (`size`) | Dimensi & Tinggi | Tipografi & Radius | Penggunaan Rekomendasi |
| :--- | :--- | :--- | :--- |
| **`sm` (Kompak)** | Tinggi `h-[34px]`<br>`px-3 py-1.5 gap-1.5` | `text-xs font-semibold`<br>`rounded-lg` | Aksi baris tabel, filter kecil, pill badge interaktif |
| **`md` (Default)** | Tinggi `h-10` (40px)<br>`px-4 py-2.5 gap-2` | `text-xs sm:text-sm font-bold`<br>`rounded-xl` | Toolbar halaman, form input, modal footer standar |
| **`lg` (Kasir / CTA)** | Tinggi `h-12` (48px)<br>`px-5 py-3 gap-2.5` | `text-sm sm:text-base font-black`<br>`rounded-2xl` | Tombol Bayar / Checkout kasir, tombol submit utama wizard |

#### Standar Varian Warna (`variant`):
- **`primary`**: `bg-blue-900 hover:bg-blue-800 text-white shadow-sm border border-blue-800` (Hanya 1 aksi primer per halaman/modal).
- **`secondary`**: `bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200`
- **`outline`**: `bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs`
- **`danger`**: `bg-rose-600 hover:bg-rose-700 text-white shadow-sm border border-rose-700`
- **`danger-outline`**: `bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200`
- **`success`**: `bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm border border-emerald-700`
- **`excel`**: `bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs`
- **`whatsapp`**: `bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-500/20 border border-emerald-600`
- **`ghost`**: `bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900`

#### Properti Responsif Tombol:
- `fullWidthOnMobile?: boolean`: Di layar mobile (`< 640px`) otomatis melebar 100% (`w-full sm:w-auto`), menjaga kenyamanan sentuhan ibu jari (*thumb-friendly*).

---

### 2. Standar Toolbar Aksi Responsif (*Action Toolbar - Option B*)

Untuk menghindari tombol berantakan dan terbelah menjadi baris-baris canggung di layar HP/PWA:

```text
DESKTOP (≥ 640px):
[ 🔍 Cari nama menu, SKU...                               ]   [ 📁 Alat & Pengaturan v ]   [ + Tambah Produk ]

MOBILE / PWA (< 640px):
Baris 1: [ 🔍 Cari nama menu, SKU, barcode...                                 ]
Baris 2: [ 📁 Alat & Pengaturan v ]           [ + Tambah Produk (Primary CTA) ]
```

* **Kebijakan Zero Redundant Refresh Button**: **DILARANG** memasang tombol "refresh / muat ulang" tersendiri yang tidak perlu di samping search bar atau header halaman. Aplikasi telah memiliki alur sinkronisasi data otomatis saat halaman/tab dibuka serta dukungan gestur global Pull-to-Refresh di smartphone (`<PullToRefresh />`). Tombol refresh terpisah hanya mempersempit ruang pencarian dan mengotori visual (*visual clutter*).
* **Aturan Baris 1**: Kolom pencarian mengambil lebar bersih penuh 100% tanpa gangguan tombol refresh.
* **Aturan Baris 2**:
  * Tombol Aksi Utama (`+ Tambah ...`) selalu berada di sebelah kanan dengan visual paling menonjol.
  * Tombol Pendukung (*Secondary tools*, seperti Ambil dari Master, Kelola Kategori, Ekspor/Impor CSV, Cetak Label) disatukan secara elegan ke dalam satu dropdown menu kompak: **`Alat & Pengaturan v`**.

---

### 3. Standar Hero Banner (Ringkasan Halaman)

* **Desktop**: Banner lebar dengan gradient biru gelap, judul, deskripsi, dan 4 kartu metrik informatif.
* **Mobile / PWA**:
  * Kartu metrik dibuat **kompak (*compact padding*)** atau dapat **diciutkan (*collapsible*)** agar tidak menyita >40% tinggi layar HP.
  * Konten penting (pencarian, filter, dan tabel data) harus langsung terlihat di atas lipatan layar (*above the fold*).

---

### 4. Standar Modal & Form Pop-up

Mengacu pada *binding rules* Well POS:
* **Mobile**: Otomatis menjadi *Bottom-Sheet* (`items-end p-0 rounded-t-3xl max-h-[92dvh]`).
* **Desktop**: Dialog di tengah layar (`items-center p-4 rounded-3xl max-h-[90vh]`).
* **Scrollable Body**: Kontainer form `flex-1 overflow-y-auto overscroll-contain`.
* **Sticky Action Footer**: Tombol Batal & Simpan **WAJIB** berada di footer terpisah dengan bantalan `safe-area-inset-bottom` iPhone (`pb-[max(1rem,env(safe-area-inset-bottom))]`).
* **Zero Stacked Modals**: Dilarang menampilkan modal di atas modal lain.

---

### 5. Standar Notifikasi & Toast Feedback

* **Lokasi Kanonikal**: Melayang di **atas tengah layar (*top-center*)** (`fixed top-4 inset-x-0 mx-auto z-[99999] max-w-md w-full px-4`).
* **Non-Blocking**: Auto-dismiss dalam 4 detik, memiliki tombol tutup `X`, dan transisi slide-down halus.
* **Zero Layout Shift**: Dilarang memasang banner error/sukses statis di dalam alur DOM yang mendorong tabel/kartu ke bawah secara mengejutkan saat pesan muncul.

---

### 6. Standar Safe Area & Navigasi PWA

* **Bottom Navigation**: Wajib menyertakan bantalan `ios-safe-bottom` (`paddingBottom: max(6px, env(safe-area-inset-bottom, 0px))`).
* **Main Content Padding**: Kontainer konten utama wajib memiliki `pb-28 sm:pb-8` pada mode tampilan mobile agar baris tabel atau pagination terakhir tidak tertutup navigasi bawah.
* **Floating Guide Widget**: Pada layar HP, widget panduan melayang tidak boleh menghalangi tombol carousel filter, pagination tabel, atau tombol checkout kasir. Pengguna mobile juga dapat mengakses panduan langsung melalui ikon di Top Header Bar.

---

### 7. Standar Komponen Kanonikal `<ToggleSwitch />`

* **Struktur Baku**: Track kapsul `rounded-full` (`h-6 w-11`) dengan knob bola bulat putih bersih (`h-5 w-5 rounded-full bg-white shadow-md`) yang bergeser mulus (*smooth transition slide* `translate-x-5` saat aktif).
* **Warna Status**: Biru tua solid saat aktif (`bg-blue-900`) dan abu-abu netral saat nonaktif (`bg-slate-300`).
* **Larangan Keras**: Dilarang menggunakan raw icon SVG mentah (`<ToggleRight />` / `<ToggleLeft />`) di form pengaturan atau form modifier karena merender pill datar tanpa knob yang membingungkan pengguna.

---

### 8. Standar Baris Kategori Menu (*Dedicated Full-Width Category Carousel*)

* **Baris Mandiri 100% (Full-Width)**: Kategori menu adalah hierarki produk utama dan **WAJIB** berada di baris tersendiri yang membentang 100% selebar container. Dilarang menggabungkan Kategori dengan Status Filter dalam satu baris horizontal yang sempit karena akan menghimpit dan memotong pills kategori di tepi layar.
* **Pemisahan Baris Filter**: Baris atas khusus untuk status operasional (`Semua Status`, `Hanya Aktif`, `Hanya Nonaktif`) dan filter tipe produk (`Semua`, `Olahan F&B`, `Ritel Fisik`). Baris bawah khusus untuk navigasi Kategori.
* **Styling Pill Kategori**:
  * Tinggi seragam `h-9 px-3.5 rounded-xl` dengan tipografi tegas `text-xs sm:text-sm font-bold`.
  * Counter badge rapi di samping teks: `Semua Kategori (8)`, `Bakery & Pastry (0)`, dsb.
  * Navigasi scroll horizontal touch (`.no-scrollbar`) dengan tombol panah navigasi kiri/kanan (`ChevronLeft`/`ChevronRight`) yang mengapung anggun jika kategori melebihi lebar layar.
* **Larangan Tombol Shortcut Terselip**: Dilarang keras menaruh tombol aksi/shortcut seperti `+ Kategori` di barisan pill filter kategori. Akses pengelolaan kategori berada di menu sidebar atau dropdown `Alat & Berkas`.

---

### 9. Standar Terminal Mesin Kasir (POS) & Feedback Visual Kartu Produk

* **Visual Feedback Keranjang Real-Time**:
  * Ketika kasir menambahkan produk ke keranjang, kartu produk di katalog (baik mode Desktop Grid, Compact List, maupun Mobile Handheld) **WAJIB** menampilkan badge kuantitas aktif `{inCartQty}x` di pojok kiri atas foto serta highlight border biru `border-blue-900 ring-2 ring-blue-900/15`.
  * Kasir dapat melihat secara instan berapa porsi/unit item yang telah masuk keranjang tanpa harus bolak-balik memeriksa sidebar nota.
* **Full-Width Category Carousel pada POS Desktop & Mobile**:
  * Menggunakan standar carousel mandiri yang membentang 100% selebar container.
  * Dilengkapi tombol geser `ChevronLeft` dan `ChevronRight` yang mengapung anggun dengan gradient mask.
  * Dilengkapi badge counter jumlah produk per kategori (`Semua (X)`, `{Kategori} (Y)`).
  * Toolbar atas terpadu dengan tinggi seragam `h-10` (40px) mencakup input pencarian barcode/nama, tombol kamera barcode, dan toggle Grid/List.
  * Active Filter Feedback Bar menampilkan chip kata kunci pencarian dan filter kategori aktif serta tombol "Reset Filter".
* **Standar Footer Aksi Kasir & Touch Targets**:
  * Tombol checkout dan pelunasan kasir pada `PaymentModal` dan `OrderCartSidebar` menggunakan tinggi kanonikal `h-12` (48px) untuk memberikan touch target prima (*Prime Thumb Zone*) yang nyaman ditekan pada tablet layar sentuh dan smartphone PWA.
  * Tombol aksi modal modifier (`ProductModifierModal`) diseragamkan pada tinggi `h-11` (44px).
  * Seluruh modal transaksi wajib menyertakan bantalan safe-area iPhone: `pb-[max(0.875rem,env(safe-area-inset-bottom))]`.
* **Zero Redundant Refresh Buttons di Terminal POS**:
  * Tidak ada tombol refresh mandiri di POS Header, katalog produk, maupun header modal `XReportModal`. Data shift dan transaksi dimuat ulang secara otomatis dan reaktif saat modal dibuka.

### 10. Standar Riwayat Transaksi & Audit Penjualan

* **Zero Redundant Refresh Button**:
  * Tombol reload manual ("Segarkan" / `<RefreshCw />`) telah dihapus secara menyeluruh dari header view `OrdersView.tsx` dan `PaymentItemsAuditView.tsx`.
  * Data riwayat transaksi memuat ulang secara otomatis saat filter periode/saluran/kasir berganti, setelah pembatalan pesanan (Void), atau melalui navigasi tab.
* **Standar 4 Metric Cards Simetris & Proporsional**:
  * Seluruh 4 kartu metrik transaksi (`Faktur Lunas`, `Total Omset`, `Tunai/Cash`, `Non-Tunai`) wajib memiliki struktur visual, tinggi kontainer, padding, dan hierarki tipografi yang 100% seragam.
  * Hero value pada kartu finansial secara konsisten berupa angka nominal Rupiah besar (`text-2xl font-black font-mono tracking-tight`), didampingi badge status yang sejajar di header kartu dan footer informatif pembanding (nota tercatat, rata-rata AOV, dan jumlah transaksi).
* **Standar Anti-Wrap Kolom Rupiah (Kapasitas Ratusan Juta Rupiah)**:
  * Kolom `Subtotal` (`min-w-[150px]`) dan `Total Bayar` (`min-w-[160px]`) pada tabel desktop wajib menggunakan `whitespace-nowrap font-mono text-xs text-right`.
  * Dilarang keras membiarkan simbol `Rp` terpisah atau kena enter ke baris baru saat menampilkan nominal ratusan juta hingga miliaran rupiah (contoh: `Rp 850.500.000` wajib dalam satu baris bersih).
  * Tabel diberikan lebar dasar aman `min-w-[1050px]` dengan kontainer pembungkus `overflow-x-auto`.
* **Keseragaman Font Size Antar Baris Tabel**:
  * Seluruh baris tabel (dari baris pertama nomor faktur terpanjang hingga baris terakhir) wajib menggunakan ukuran font kanonikal `text-xs` yang seragam. Dilarang mencampur `sm:text-sm` pada kolom tertentu yang menyebabkan tinggi baris melonjak atau ukuran teks tampak berbeda.
  * Kolom nomor invoice diberi `min-w-[210px] whitespace-nowrap text-xs font-mono font-bold` agar invoice tes panjang sekalipun tidak wrap 2 baris atau merusak tinggi baris pertama.
* **Standar Header Action Bar & Eliminasi Tombol Duplikat**:
  * Tombol aksi tingkat atas (`Ringkasan WA`, `Ekspor Faktur (Excel)`, dan `Cetak Faktur (PDF)`) **hanya muncul pada sub-tab Faktur Penjualan** dengan pembungkus `flex-nowrap whitespace-nowrap` agar tetap dalam satu baris bersih di desktop.
  * Pada sub-tab **Rekap Item per Pembayaran**, tombol-tombol atas disembunyikan karena ekspor tabel menu (`Excel` dan `PDF`) telah terintegrasi langsung di toolbar tabel menu per metode pembayaran. Ini menghilangkan redundansi dan mencegah tombol atas terpecah menjadi 2 baris canggung.
* **Integritas Ikon Kartu Metode Pembayaran (Anti-Disappearing Icon)**:
  * Ketika kartu metode pembayaran dipilih (`isSelected === true`), ikon kartu wajib menerima styling `text-white` secara eksplisit pada kontainer `bg-blue-900`. Dilarang membiarkan class `text-blue-900` menimpa ikon saat kontainer berwarna biru gelap. Saat tidak terpilih, ikon menggunakan kontras pastel terkurasi (`bg-emerald-50 text-emerald-700`, `bg-indigo-50 text-indigo-700`, `bg-blue-50 text-blue-900`).
* **Standar Filter Toolbar Global**:
  * Kontainer filter Saluran (`select`), Kasir (`select`), dan Periode/Tanggal (`Calendar dropdown button`) diseragamkan pada ketinggian `h-10` (40px) dengan padding proporsional `px-3`, mencegah tampilan bertumpuk canggung atau text clipping pada layar mobile dan tablet.
* **Search Bar & Tombol Aksi Baris Transaksi**:
  * Input pencarian invoice/pelanggan dan tombol "Cari" diseragamkan pada ketinggian `h-10` (40px).
  * Tombol aksi per baris transaksi (`Detail Transaksi` `<Eye />`, `Cetak Struk` `<Printer />`, `Susulan` `<UtensilsCrossed />`, `Void` `<Ban />`) diseragamkan menjadi kotak proporsional `w-9 h-9` beradius `rounded-xl` baik pada tampilan Desktop Table maupun Mobile Card List View.
* **Standar Modal Detail & Pembatalan (Void)**:
  * Tombol-tombol aksi di sticky footer `OrderDetailModal` (`Lihat Struk`, `+ Susulan`, `Void`, `Tutup`) dan modal WhatsApp diseragamkan pada ketinggian `h-10` (40px) dengan padding touch-target nyaman dan bantalan `safe-area-inset-bottom`.
  * Modal audit pembatalan (`VoidOrderModal` dan `VoidOrderItemModal`) menerapkan standar modal mobile bottom sheet dengan sticky action footer terpisah.

### 11. Standar Persediaan, Bahan Baku & Stok (Tahap 4.1)

* **Proporsionalitas KPI Cards & Font Finansial**:
  * Nilai Aset Stok (HPP) baik pada tab Bahan Baku maupun Produk Jadi menggunakan font numerik terkurasi `font-mono tracking-tight font-black` untuk mengakomodasi nilai persediaan ratusan juta hingga miliaran rupiah tanpa clipping.
  * Kartu KPI status stok terhubung langsung secara interaktif dengan filter tabel.
* **Standar Anti-Wrap & Kapasitas Finansial Tabel Persediaan**:
  * Tabel Bahan Baku (`min-w-[1050px]`) dan Tabel Produk Jadi (`min-w-[1100px]`) memastikan seluruh kolom memiliki ruang yang cukup pada viewport desktop.
  * Kolom finansial HPP, Estimasi Nilai, dan Harga Jual menggunakan `whitespace-nowrap font-mono text-xs text-right` sehingga nominal Rupiah ratusan juta tidak patah ke baris baru.
* **Keseragaman Font Size Seluruh Baris**:
  * Nama produk dan bahan baku, SKU, status, unit, serta sel numerik diseragamkan pada ukuran `text-xs` yang konsisten dari baris pertama hingga baris terakhir.
* **Standarisasi Tombol Aksi Mutasi**:
  * Tombol aksi mutasi cepat (`Stok Masuk`, `Transfer Toko`, `Stok Rusak`, `Stock Opname`) diseragamkan ukurannya menjadi `w-8 h-8 rounded-lg` dengan tooltip informatif dan micro-interactions hover yang presisi.
* **Tabel Audit Trail Mutasi Stok (Kartu Stok)**:
  * Tabel kartu stok diberikan `min-w-[1000px]` dengan format waktu, tipe mutasi, kuantitas `font-mono font-bold text-xs`, serta penyeragaman font petugas dan catatan.
* **Standarisasi Simetris Header Toolbar Tab Bahan Baku & Produk Jadi**:
  * Kedua tab (Bahan Baku & Produk Jadi) menerapkan susunan tombol aksi header yang 100% identik dan simetris:
    1. Tombol Sekunder Outline: `[Lembar Kerja Massal]` (`border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold`) dengan ikon biru `<ClipboardCheck />`.
    2. Tombol Primer Biru: `[+ Tambah ... Baru]` (`bg-blue-900 hover:bg-blue-800 text-white font-bold`) dengan ikon `<Plus />`.
  * Menghilangkan kapsul 4 pill tombol manual (`Stok Masuk`, `Transfer`, `Stok Rusak`, `Opname`) dari header Produk Jadi karena redundan; keempat aksi mutasi tersebut telah tersedia secara langsung per item di setiap baris tabel serta terintegrasi secara komprehensif pada `Lembar Kerja Massal`.
* **Zero Redundant Refresh Button**:
  * Tidak ada tombol refresh mandiri terpisah. Seluruh data persediaan memuat ulang secara otomatis setelah mutasi stok berhasil.

### 12. Standar Pengadaan Barang (PO) & Penerimaan Supplier (Tahap 4.2)

* **Zero Redundant Refresh Button**:
  * Tombol reload manual (`<RefreshCw />`) telah dihapus secara tuntas dari header utama [`PurchaseOrdersView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/PurchaseOrdersView.tsx).
  * Data PO memuat ulang secara otomatis dan reaktif saat status, pemasok, outlet/gudang, atau pencarian berganti, serta setelah aksi pembuatan PO, penerimaan fisik barang, atau pembatalan PO berhasil.
* **Standar 5 KPI Metric Cards**:
  * Seluruh nilai numerik pada kartu metrik (`Total PO`, `Draf PO`, `Menunggu Kirim`, `Selesai Diterima`) menggunakan `font-mono text-2xl font-black`.
  * Nilai total estimasi belanja PO (`Total Nilai PO`) menggunakan `text-xl font-black font-mono tracking-tight` agar nominal ratusan juta rupiah tetap proporsional tanpa clipping.
* **Standarisasi Filter Toolbar & Input Search**:
  * Input pencarian dan 3 dropdown filter (`Status`, `Pemasok`, `Toko / Gudang`) diseragamkan pada ketinggian kanonikal `h-10` (40px) dengan font tebal terkurasi.
* **Standar Anti-Wrap & Kapasitas Finansial Tabel PO**:
  * Tabel PO diberikan lebar dasar aman `min-w-[1050px]` dengan kontainer `overflow-x-auto`.
  * Kolom `Total Nilai` PO menggunakan `whitespace-nowrap font-mono text-xs font-extrabold text-right` sehingga nominal Rupiah ratusan juta tidak patah ke baris baru.
  * Nomor PO menggunakan `font-mono font-extrabold text-xs text-blue-950 whitespace-nowrap`.
* **Standarisasi Tombol Aksi Baris PO**:
  * Tombol `Lihat Detail PO` distandarisasi ke ukuran kotak presisi `w-8 h-8 rounded-xl` (`<Eye />`).
  * Tombol aksi status (`Kirim` `<Send />` dan `Terima` `<Package />`) diseragamkan ke ketinggian `h-8 px-3 rounded-xl font-bold text-xs`.
### 13. Standar Transfer Antar Toko & Gudang (Tahap 4.3)

* **Zero Redundant Refresh Button (Rule 16 AGENTS.md)**:
  * Tombol reload manual (`<RefreshCw />`) telah dihapus secara tuntas dari header utama [`StockTransfersView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/StockTransfersView.tsx).
  * Data transfer memuat ulang secara otomatis dan reaktif saat arah pengiriman, status, atau kata kunci pencarian berubah, serta setelah aksi pembuatan draf transfer, pengiriman (dispatch), atau penerimaan barang berhasil.
* **Standar 4 KPI Metric Cards**:
  * Nilai kuantitas pada kartu metrik (`Total Transfer`, `Dalam Perjalanan`, `Selesai Diterima`, `Draf Siap Kirim`) diseragamkan ke `font-mono text-2xl font-black`.
  * Subtitle kartu diselaraskan (`text-[11px] text-blue-700` dll.) dengan state klik aktif yang stabil dan tidak menyebabkan ikon menghilang.
* **Standarisasi Filter Toolbar & Input Search**:
  * Input pencarian dan 2 dropdown filter (`Arah Transfer` & `Status`) diseragamkan pada ketinggian kanonikal `h-10` (40px) dengan font tebal terkurasi `rounded-xl text-xs font-bold`.
* **Standar Anti-Wrap & Lebar Tabel Transfer Antar Toko**:
  * Tabel transfer diberikan batas lebar aman `min-w-[1050px]` dengan kontainer `overflow-x-auto`.
  * Nomor transfer menggunakan `font-mono font-extrabold text-xs text-blue-950 whitespace-nowrap`.
  * Tanggal transaksi dan catatan pengiriman/tiba menggunakan `whitespace-nowrap text-[11px] text-slate-400`.
  * Terminologi lokasi kanonikal mematuhi Rule 12 (`Toko / Gudang Asal` & `Toko / Gudang Tujuan`).
* **Standarisasi Tombol Aksi Baris Transfer**:
  * Tombol `Lihat Rincian Item` distandarisasi ke ukuran kotak presisi `w-8 h-8 rounded-xl` (`<Eye />`).
  * Tombol aksi operasional (`Kirim` `<Send />` dan `Terima` `<Package />`) diseragamkan ke ketinggian `h-8 px-3 rounded-xl font-bold text-xs`.
* **Standar Modal Aksi (Buat Transfer & Detail Transfer)**:
  * Tombol-tombol di footer aksi modal diseragamkan pada ketinggian `h-10 px-4/px-5 rounded-xl font-bold text-xs`.
  * Komponen [`StockTransferModal.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/StockTransferModal.tsx) juga telah distandarisasi tombol footernya ke `h-10`.

### 14. Standar Mutasi Stok & Pemasok Bahan Baku (Tahap 4.4)

* **Zero Redundant Refresh Button (Rule 16 AGENTS.md)**:
  * Tombol reload manual (`<RefreshCw />`) telah dihapus secara tuntas dari header utama [`StockMovementsView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/StockMovementsView.tsx) dan [`SuppliersView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/SuppliersView.tsx).
  * Data termutakhirkan secara otomatis saat filter lokasi, jenis mutasi, periode, atau status diubah, serta setelah aksi pendaftaran atau pembaruan pemasok berhasil.
* **Standarisasi KPI & Summary Cards**:
  * Angka kuantitas pada 4 kartu mutasi stok (`Total Mutasi`, `Stok Masuk`, `Stok Keluar`, `Opname & Koreksi`) dan 3 kartu pemasok (`Total Pemasok`, `Pemasok Aktif`, `Rata-rata Tempo Bayar`) diformat seragam dengan `font-mono text-2xl font-black`.
* **Standarisasi Toolbar & Filter Bar**:
  * Input pencarian dan seluruh dropdown filter (`Lokasi Toko / Gudang`, `Tipe Mutasi`, `Periode`, `Status`) diseragamkan pada ketinggian `h-10` (40px) beradius `rounded-xl` dengan font tebal terkurasi `text-xs font-bold`.
  * Tombol aksi primer (`Tambah Pemasok` dan `Ekspor CSV`) distandarisasi pada ketinggian `h-10 px-4 rounded-xl`.
* **Standar Anti-Wrap Tabel Data**:
  * Tabel Kartu Mutasi Stok dan Tabel Pemasok diberikan batas lebar aman `min-w-[1050px]` dengan kontainer scroll horizontal.
  * Nomor kode pemasok, angka pergerakan stok, dan saldo stok sebelum ➔ sesudah menggunakan tipografi `font-mono`.
  * Tombol aksi per baris pemasok (`Edit` & `Hapus`) diseragamkan ke ukuran kotak presisi `w-8 h-8 rounded-xl`.
* **Standar Modal Form Pemasok**:
  * Menggunakan `<WhatsAppInput />` untuk nomor telepon PIC (Rule 5).
  * Tombol aksi di footer form modal diseragamkan pada ketinggian `h-10` (`Batal` `h-10 px-4` + `Simpan Pemasok` `h-10 px-5`).

### 15. Standar Kelola Gudang Logistik & Multi-Outlet (Tahap 4.5)

* **Kesesuaian Palet Warna Kanonikal Well POS (Navy Blue Brand Palette)**:
  * Aksen fokus, badge gudang pusat (`text-blue-900 bg-blue-50 border border-blue-200`), dan ring indikator sesi aktif diseragamkan dengan nada biru navy identitas Well POS.
* **Standarisasi Menyeluruh Dropdown Select & Chevron Proporsional di Seluruh Fase 4**:
  * Seluruh elemen `<select>` di Fase 4 (meliputi filter toolbar, form modal pembuatan PO, transfer antar outlet/gudang, penambahan bahan baku, kartu mutasi stok, hingga modal opname massal layar penuh) telah distandarisasi 100%.
  * Dropdown native browser/OS dihilangkan menggunakan `appearance-none` berpasangan dengan custom ikon Lucide `<ChevronDown />` (ukuran `w-4 h-4` atau `w-3.5 h-3.5`) dengan padding teks kanan proporsional (`pr-9` / `pr-8`), sehingga seluruh dropdown sejajar rapi, proporsional, dan elegan di desktop maupun PWA mobile.
  * Modul-modul yang diaudit dan diseragamkan:
    - [`WarehousesView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/WarehousesView.tsx) (Filter status gudang)
    - [`PurchaseOrdersView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/PurchaseOrdersView.tsx) (Filter status, supplier, outlet, select modal PO & baris item)
    - [`StockTransfersView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/StockTransfersView.tsx) (Filter arah & status, select modal transfer asal/tujuan & item)
    - [`SuppliersView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/SuppliersView.tsx) (Filter status vendor)
    - [`CreateIngredientModal.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/modals/CreateIngredientModal.tsx) (Dropdown Satuan UOM)
    - [`StockTransferModal.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/StockTransferModal.tsx) (Select outlet asal, outlet tujuan, bahan baku mentah, & produk retail)
    - [`StockMovementModal.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/StockMovementModal.tsx) (Select lokasi outlet/gudang & produk retail)
    - [`FullScreenBulkOpnameModal.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/FullScreenBulkOpnameModal.tsx) (Dropdown alasan umum, rute transfer asal/tujuan, filter kategori produk, serta alasan spesifik per baris di tabel desktop & mobile card)
    - [`RecipesView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/RecipesView.tsx) (Dropdown pemilihan bahan baku resep BOM)
* **Ergonomi Responsif & PWA Mobile**:
  * Padding bawah kontainer utama menggunakan `pb-28 sm:pb-12` untuk menjamin seluruh data tabel dan pagination tidak tertutup oleh PWA Bottom Navigation Bar pada smartphone kasir/owner.
  * Tombol header "+ Tambah Gudang Baru" dan tombol card footer adaptif `w-full sm:w-auto` untuk memastikan tap target nyaman di layar sentuh mobile.
  * Sticky Action Footer modal dioptimalkan dengan tinggi sentuh `h-11 sm:h-10` dan bantalan safe-area iPhone (`pb-[max(1rem,env(safe-area-inset-bottom))]`).
* **Zero Redundant Refresh Button (Rule 16 AGENTS.md)**:
  * Tidak ada tombol refresh redundan pada [`WarehousesView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/WarehousesView.tsx). Data reaktif ter-refresh otomatis saat status filter atau pencarian diubah serta setelah gudang baru dibuat atau diedit.
* **Standarisasi 3 KPI Summary Cards Simetris**:
  * 3 kartu metrik (*Gudang Logistik Aktif*, *Toko / Outlet Terhubung*, dan *Status Mode Sesi*) diformat seragam dengan tipografi kanonikal `font-mono text-2xl font-black` serta indikator mode sesi gudang aktif yang jelas.
* **Toggle Mode Tampilan Adaptif**:
  * Disediakan toggle tampilan adaptif: **Grid Kartu** (`<LayoutGrid />`) dan **Tabel Ringkas Kanonikal** (`<List />`) dengan tombol switch `h-9 rounded-xl`.

### 16. Standar Manajemen Meja & Cetak QR Digital Resto (Tahap 5.1)

* **Zero Redundant Refresh Button (Rule 16 AGENTS.md)**:
  * Tombol reload manual (`<RefreshCw />`) telah dihapus secara tuntas dari toolbar filter [`QrTablesView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/QrTablesView.tsx). Data termutakhirkan secara otomatis saat outlet atau zona difilter serta setelah meja berhasil ditambahkan, diubah, atau dihapus.
* **Standarisasi 4 KPI Summary Cards**:
  * Angka kuantitas pada 4 kartu ringkasan meja (*Total Meja*, *Meja Kosong*, *Sedang Terisi*, dan *Dipesan / Reserved*) diformat seragam menggunakan `font-mono text-2xl font-black`.
* **Standarisasi Toolbar & Search Bar**:
  * Kolom pencarian nomor meja dan tombol filter zona/area (*Semua Zona*, *Indoor*, *Outdoor*, dsb.) diseragamkan pada ketinggian `h-10` (40px) beradius `rounded-xl` dengan font tebal `text-xs font-bold`.
  * Tombol aksi header (*Pratinjau Menu Tamu*, *Cetak Semua Meja*, dan *+ Tambah Meja*) distandarisasi pada ketinggian `h-10` dengan palet warna Navy Blue kanonikal (`bg-blue-900 hover:bg-blue-950`).
* **Standarisasi Dropdown Select & Form Meja (In-Page Form)**:
  * Dropdown pemilihan zona meja dan status meja menggunakan `appearance-none` berpasangan dengan custom ikon Lucide `<ChevronDown />` dan padding kanan teratur `pr-9`, berdimensi `h-10 rounded-xl`.
  * Tombol footer form aksi (*Batal* dan *Simpan Meja*) diseragamkan pada ketinggian `h-10 px-5 / px-6 rounded-xl`.
* **Ergonomi Responsif & PWA Mobile**:
  * Kontainer utama diberikan bantalan bawah `pb-28 sm:pb-12` agar kartu meja dan baris pagination tidak tertutup oleh PWA Bottom Navigation Bar di layar sentuh mobile.
  * Kartu meja grid dilengkapi aksi cepat status (*Kosongkan* / *Isi* `h-7 px-2.5 rounded-lg`), tombol aksi (*Tent Card*, *Salin Link*, *Buka Menu* `h-7.5 rounded-xl`), serta tombol edit & hapus presisi `w-8 h-8 rounded-xl`.

---

## 🗺️ II. ROADMAP EKSEKUSI BERTAHAP (FASE 0 S.D. FASE 11)

| Fase | Modul Sasaran | Ruang Lingkup & Elemen Terkandung | Status |
| :---: | :--- | :--- | :--- : |
| **FASE 0** | **Kerangka Besar (*Global Shell & Foundations*)** | • Top Header Bar ([BackofficeLayout.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/saas/BackofficeLayout.tsx))<br>• Mobile Drawer & Desktop Sidebar<br>• PWA Bottom Nav & Safe Areas<br>• Relokasi Floating Guide Widget ([FloatingGuideWidget.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/ui/FloatingGuideWidget.tsx))<br>• Fondasi Komponen: [Button.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/ui/Button.tsx), [ActionBar.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/ui/ActionBar.tsx)<br>• Toast System ([DialogContext.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/context/DialogContext.tsx)) | **SELESAI** |
| **FASE 1** | **Katalog Menu & Produk** | • [ProductsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/ProductsView.tsx) (Hero compact, Toolbar Opsi B, Carousel Kategori no-scrollbar, Grid)<br>• `ProductModal`, `AssignCatalogProductModal`, `FullScreenProductImportModal`, `ProductBarcodeLabelsModal`<br>• [CategoriesView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/CategoriesView.tsx) & `CategoryModal`<br>• [ModifiersView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/ModifiersView.tsx) (Topping & Varian, Button standar)<br>• [RecipesView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/RecipesView.tsx) (Formula BOM & Kalkulator HPP, Button standar)<br>• Zero Redundant Refresh Button di seluruh modul | **SELESAI** |
| **FASE 2** | **Terminal Mesin Kasir (POS)** | • [PosTerminalView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/PosTerminalView.tsx) & [PosMobileView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/pos/PosMobileView.tsx)<br>• Cart Drawer & Numpad Kasir<br>• `CategoryFilterPills.tsx` (Full-width carousel & count badge)<br>• `ProductCatalogGrid.tsx` (Real-time in-cart quantity indicator)<br>• `PaymentModal` (Pecahan uang pas, QRIS, Split, Kasbon, seragam `h-12`)<br>• `ProductModifierModal` (Tinggi seragam `h-11`) & KDS Kitchen Ticket<br>• `StartShiftModal`, `CloseShiftModal`, `CashExpenseModal`<br>• `XReportModal` (Zero redundant refresh button) | **SELESAI** |
| **FASE 3** | **Riwayat Transaksi Penjualan** | • [OrdersView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/OrdersView.tsx) (Toolbar Ekspor Excel/PDF/WA `h-10`, Filter Saluran/Kasir `h-10`, Action Row `w-9 h-9`, Zero Redundant Refresh Button)<br>• Sub-tab Faktur Penjualan vs Rekap Item Menu ([PaymentItemsAuditView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/PaymentItemsAuditView.tsx), Zero Redundant Refresh Button, Search & Export `h-10`)<br>• [OrderDetailModal.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/OrderDetailModal.tsx) (Footer button `h-10`), [VoidOrderModal.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/VoidOrderModal.tsx) & `VoidOrderItemModal.tsx` | **SELESAI** |
| **FASE 4** | **Persediaan, Bahan Baku & Stok** | • [InventoryView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/InventoryView.tsx) (Tahap 4.1 Selesai: Bahan Baku, Produk Jadi, Kartu Mutasi, Anti-wrap Rp, Font text-xs, Action w-8 h-8)<br>• `FullScreenBulkOpnameModal` & `StockMovementModal`<br>• [PurchaseOrdersView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/PurchaseOrdersView.tsx) (Tahap 4.2 Selesai: Zero Refresh Button, KPI font-mono, Toolbar h-10, Tabel PO min-w 1050px, Action w-8 h-8)<br>• [StockTransfersView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/StockTransfersView.tsx) (Tahap 4.3 Selesai: Zero Refresh Button, KPI font-mono, Toolbar h-10, Tabel Transfer min-w 1050px, Action w-8 h-8)<br>• [StockMovementsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/StockMovementsView.tsx) & [SuppliersView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/SuppliersView.tsx) (Tahap 4.4 Selesai: Zero Refresh Button, KPI font-mono, Toolbar h-10, Tabel min-w 1050px, Action w-8 h-8)<br>• [WarehousesView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/WarehousesView.tsx) (Tahap 4.5 Selesai: 3 KPI font-mono, Search & Filter h-10, View Mode Grid/Tabel, Action w-8 h-8 & h-8 px-3)<br>• **Standarisasi Seluruh Dropdown Fase 4 Selesai (Appearance-none + ChevronDown proporsional & Navy Blue Palette)** | **SELESAI** |
| **FASE 5** | **Buku Menu QR (Self-Ordering Meja)** | • [QrTablesView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/QrTablesView.tsx) (**Tahap 5.1 Selesai**: Zero Refresh Button, 4 KPI font-mono, Toolbar & Filter h-10, Form select appearance-none & ChevronDown, PWA spacing pb-28, Action w-8 h-8 & h-7.5)<br>• [QrMenuSettingsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/QrMenuSettingsView.tsx) (**Tahap 5.2 Selesai**: Navy Blue theme, Input & Preset h-10/h-9, Focus rings, PWA spacing pb-28, Submit button h-11/h-10)<br>• [QrLiveOrdersView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/QrLiveOrdersView.tsx) (**Tahap 5.3 Selesai**: Zero Refresh Button, Live Feed pulse badge, 4 KPI font-mono, Search & Filter tabs h-10, Action buttons h-10 rounded-xl)<br>• [CustomerQrMenuView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/CustomerQrMenuView.tsx) (**Tahap 5.4 Selesai**: Search & Input h-10, Category scroller h-9, Add & Action buttons h-8/h-10/h-12, PWA padding pb-28/pb-16) | **SELESAI** |
| **FASE 6** | **Ringkasan Bisnis & Kuota Token** | • [BusinessSummaryView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/saas/BusinessSummaryView.tsx) (**Tahap 6.1 Selesai**: Zero Refresh Button, Dropdown Saluran/Layanan appearance-none & ChevronDown, Filter Date/Time h-10, Ekspor CSV h-10, 3 KPI font-mono text-2xl/3xl, PWA spacing pb-28/pb-16, Perincian Metode Pembayaran Tunai vs Non-Tunai hierarkis dengan sub-kategori aktif saja, Rekonsiliasi Kas riil memperhitungkan Pengeluaran Kasir / Petty Cash Out & Kas Bersih Operasional)<br>• [BillingTokensView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/BillingTokensView.tsx) (**Tahap 6.2 Selesai**: Zero Refresh Button, Tombol Top-Up h-10 Navy Blue, Saldo Kuota font-mono 3xl/4xl, Sticky Action Footer PWA safe-area, Preset cards & inputs h-10, PWA spacing pb-28/pb-16) | **SELESAI** |
| **FASE 7** | **Laporan & Audit Keuangan** | • [FinancialReportView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/FinancialReportView.tsx) (Laba rugi kotor/bersih, arus kas)<br>• [ShiftsAuditView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/ShiftsAuditView.tsx) (Audit selisih laci kasir X/Z)<br>• [ProductAnalyticsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/ProductAnalyticsView.tsx) (Matriks menu terlaris) | Siap Dikerjakan |
| **FASE 8** | **Promosi, Diskon & Voucher** | • [PromotionsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/PromotionsView.tsx) (Diskon persentase, nominal, voucher belanja) | Menunggu Fase 7 |
| **FASE 9** | **Pelanggan, CRM & Kasbon** | • [CustomersView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/CustomersView.tsx) (Buku member loyalitas, riwayat kasbon)<br>• `CustomerDebtsTab` & Modal pelunasan piutang | Menunggu Fase 8 |
| **FASE 10** | **Manajemen Staf & Absensi** | • [UsersView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/UsersView.tsx) & [attendance](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/attendance) (Akun staf, PIN, absensi)<br>• [StaffRolesView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/StaffRolesView.tsx) (Hierarki hak akses RBAC) | Menunggu Fase 9 |
| **FASE 11** | **Pengaturan Toko & Resto** | • [ReceiptSettingsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/ReceiptSettingsView.tsx) (Struk kasir & printer Bluetooth)<br>• [TaxesSettingsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/TaxesSettingsView.tsx) (Pajak PB1 & biaya resto)<br>• [PaymentSettingsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/PaymentSettingsView.tsx) (QRIS statis & EDC)<br>• [SalesChannelsSettingsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/SalesChannelsSettingsView.tsx) (Mitra online delivery)<br>• [LoyaltySettingsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/LoyaltySettingsView.tsx) & [OutletsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/OutletsView.tsx) | Menunggu Fase 10 |

---

*Dokumen ini dibuat otomatis dan terikat sebagai standar QA & UI/UX Well POS.*
