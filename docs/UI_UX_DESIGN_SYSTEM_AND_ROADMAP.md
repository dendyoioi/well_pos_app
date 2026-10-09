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

---

## 🗺️ II. ROADMAP EKSEKUSI BERTAHAP (FASE 0 S.D. FASE 11)

| Fase | Modul Sasaran | Ruang Lingkup & Elemen Terkandung | Status |
| :---: | :--- | :--- | :--- | :---: |
| **FASE 0** | **Kerangka Besar (*Global Shell & Foundations*)** | • Top Header Bar ([BackofficeLayout.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/saas/BackofficeLayout.tsx))<br>• Mobile Drawer & Desktop Sidebar<br>• PWA Bottom Nav & Safe Areas<br>• Relokasi Floating Guide Widget ([FloatingGuideWidget.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/ui/FloatingGuideWidget.tsx))<br>• Fondasi Komponen: [Button.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/ui/Button.tsx), [ActionBar.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/ui/ActionBar.tsx)<br>• Toast System ([DialogContext.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/context/DialogContext.tsx)) | **SELESAI** |
| **FASE 1** | **Katalog Menu & Produk** | • [ProductsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/ProductsView.tsx) (Hero compact, Toolbar Opsi B, Carousel Kategori no-scrollbar, Grid)<br>• `ProductModal`, `AssignCatalogProductModal`, `FullScreenProductImportModal`, `ProductBarcodeLabelsModal`<br>• [CategoriesView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/CategoriesView.tsx) & `CategoryModal`<br>• [ModifiersView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/ModifiersView.tsx) (Topping & Varian, Button standar)<br>• [RecipesView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/RecipesView.tsx) (Formula BOM & Kalkulator HPP, Button standar)<br>• Zero Redundant Refresh Button di seluruh modul | **SELESAI** |
| **FASE 2** | **Terminal Mesin Kasir (POS)** | • [PosTerminalView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/PosTerminalView.tsx) & [PosMobileView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/pos/PosMobileView.tsx)<br>• Cart Drawer & Numpad Kasir<br>• `CategoryFilterPills.tsx` (Full-width carousel & count badge)<br>• `ProductCatalogGrid.tsx` (Real-time in-cart quantity indicator)<br>• `PaymentModal` (Pecahan uang pas, QRIS, Split, Kasbon, seragam `h-12`)<br>• `ProductModifierModal` (Tinggi seragam `h-11`) & KDS Kitchen Ticket<br>• `StartShiftModal`, `CloseShiftModal`, `CashExpenseModal`<br>• `XReportModal` (Zero redundant refresh button) | **SELESAI** |
| **FASE 3** | **Riwayat Transaksi Penjualan** | • [OrdersView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/OrdersView.tsx) (Toolbar Ekspor Excel/PDF/WA `h-10`, Filter Saluran/Kasir `h-10`, Action Row `w-9 h-9`, Zero Redundant Refresh Button)<br>• Sub-tab Faktur Penjualan vs Rekap Item Menu ([PaymentItemsAuditView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/PaymentItemsAuditView.tsx), Zero Redundant Refresh Button, Search & Export `h-10`)<br>• [OrderDetailModal.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/OrderDetailModal.tsx) (Footer button `h-10`), [VoidOrderModal.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/VoidOrderModal.tsx) & `VoidOrderItemModal.tsx` | **SELESAI** |
| **FASE 4** | **Persediaan, Bahan Baku & Stok** | • [InventoryView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/InventoryView.tsx) (Tahap 4.1 Selesai: Bahan Baku, Produk Jadi, Kartu Mutasi, Anti-wrap Rp, Font text-xs, Action w-8 h-8)<br>• `FullScreenBulkOpnameModal` & `StockMovementModal`<br>• [PurchaseOrdersView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/PurchaseOrdersView.tsx) (Tahap 4.2)<br>• [StockTransfersView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/StockTransfersView.tsx) (Tahap 4.3)<br>• [StockMovementsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/StockMovementsView.tsx) & [SuppliersView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/SuppliersView.tsx) (Tahap 4.4)<br>• [WarehousesView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/WarehousesView.tsx) (Tahap 4.5) | **PROSES (4.1 Selesai)** |
| **FASE 5** | **Buku Menu QR (Self-Ordering Meja)** | • [QrTablesView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/QrTablesView.tsx) (Daftar meja & cetak stiker QR)<br>• [QrMenuSettingsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/QrMenuSettingsView.tsx) (Branding & kebijakan order)<br>• [QrLiveOrdersView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/QrLiveOrdersView.tsx) (Antrean order live dapur)<br>• [CustomerQrMenuView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/CustomerQrMenuView.tsx) (Tampilan menu tamu mobile) | Menunggu Fase 4 |
| **FASE 6** | **Ringkasan Bisnis & Kuota Token** | • [BusinessSummaryView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/saas/BusinessSummaryView.tsx) (Kartu omset, grafik tren, jam ramai)<br>• [BillingTokensView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/BillingTokensView.tsx) (Kuota token AI & langganan) | Menunggu Fase 5 |
| **FASE 7** | **Laporan & Audit Keuangan** | • [FinancialReportView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/FinancialReportView.tsx) (Laba rugi kotor/bersih, arus kas)<br>• [ShiftsAuditView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/ShiftsAuditView.tsx) (Audit selisih laci kasir X/Z)<br>• [ProductAnalyticsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/ProductAnalyticsView.tsx) (Matriks menu terlaris) | Menunggu Fase 6 |
| **FASE 8** | **Promosi, Diskon & Voucher** | • [PromotionsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/PromotionsView.tsx) (Diskon persentase, nominal, voucher belanja) | Menunggu Fase 7 |
| **FASE 9** | **Pelanggan, CRM & Kasbon** | • [CustomersView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/CustomersView.tsx) (Buku member loyalitas, riwayat kasbon)<br>• `CustomerDebtsTab` & Modal pelunasan piutang | Menunggu Fase 8 |
| **FASE 10** | **Manajemen Staf & Absensi** | • [UsersView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/UsersView.tsx) & [attendance](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/attendance) (Akun staf, PIN, absensi)<br>• [StaffRolesView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/StaffRolesView.tsx) (Hierarki hak akses RBAC) | Menunggu Fase 9 |
| **FASE 11** | **Pengaturan Toko & Resto** | • [ReceiptSettingsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/ReceiptSettingsView.tsx) (Struk kasir & printer Bluetooth)<br>• [TaxesSettingsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/TaxesSettingsView.tsx) (Pajak PB1 & biaya resto)<br>• [PaymentSettingsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/PaymentSettingsView.tsx) (QRIS statis & EDC)<br>• [SalesChannelsSettingsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/SalesChannelsSettingsView.tsx) (Mitra online delivery)<br>• [LoyaltySettingsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/LoyaltySettingsView.tsx) & [OutletsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/OutletsView.tsx) | Menunggu Fase 10 |

---

*Dokumen ini dibuat otomatis dan terikat sebagai standar QA & UI/UX Well POS.*
