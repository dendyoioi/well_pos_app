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

## 🗺️ II. ROADMAP EKSEKUSI BERTAHAP (FASE 0 S.D. FASE 11)

| Fase | Modul Sasaran | Ruang Lingkup & Elemen Terkandung | Status |
| :---: | :--- | :--- | :---: |
| **FASE 0** | **Kerangka Besar (*Global Shell & Foundations*)** | • Top Header Bar ([BackofficeLayout.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/saas/BackofficeLayout.tsx))<br>• Mobile Drawer & Desktop Sidebar<br>• PWA Bottom Nav & Safe Areas<br>• Relokasi Floating Guide Widget ([FloatingGuideWidget.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/ui/FloatingGuideWidget.tsx))<br>• Fondasi Komponen: [Button.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/ui/Button.tsx), [ActionBar.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/ui/ActionBar.tsx)<br>• Toast System ([DialogContext.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/context/DialogContext.tsx)) | **AKTIF** |
| **FASE 1** | **Katalog Menu & Produk** | • [ProductsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/ProductsView.tsx) (Hero, Toolbar Opsi B, Carousel Kategori, Grid)<br>• `ProductModal`, `AssignCatalogProductModal`, `FullScreenProductImportModal`, `ProductBarcodeLabelsModal`<br>• [CategoriesView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/CategoriesView.tsx) & `CategoryModal`<br>• [ModifiersView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/ModifiersView.tsx) (Topping & Varian)<br>• [RecipesView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/RecipesView.tsx) (Formula BOM & Kalkulator HPP) | Menunggu Fase 0 |
| **FASE 2** | **Terminal Mesin Kasir (POS)** | • [PosTerminalView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/PosTerminalView.tsx) & [PosMobileView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/pos/PosMobileView.tsx)<br>• Cart Drawer & Numpad Kasir<br>• `PaymentModal` (Tunai pecahan cepat, QRIS, EDC, Split, Kasbon)<br>• `ProductModifierModal`, `StartShiftModal`, `CloseShiftModal`<br>• `VoidOrderModal`, `CashExpenseModal`, `ThermalReceiptPreview` | Menunggu Fase 1 |
| **FASE 3** | **Riwayat Transaksi Penjualan** | • [OrdersView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/OrdersView.tsx) (Toolbar Ekspor Excel/PDF/WA, Filter Saluran/Kasir)<br>• Sub-tab Faktur Penjualan vs Rekap Item Menu<br>• `OrderDetailModal` (Rincian nota & cetak ulang) | Menunggu Fase 2 |
| **FASE 4** | **Persediaan, Bahan Baku & Stok** | • [InventoryView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/InventoryView.tsx) (Filter stok menipis, tombol opname)<br>• `FullScreenBulkOpnameModal` & `StockMovementModal`<br>• [WarehousesView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/WarehousesView.tsx) (Gudang logistik)<br>• [PurchaseOrdersView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/PurchaseOrdersView.tsx) & [StockTransfersView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/StockTransfersView.tsx)<br>• [StockMovementsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/StockMovementsView.tsx) & [SuppliersView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/SuppliersView.tsx) | Menunggu Fase 3 |
| **FASE 5** | **Buku Menu QR (Self-Ordering Meja)** | • [QrTablesView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/QrTablesView.tsx) (Daftar meja & cetak stiker QR)<br>• [QrMenuSettingsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/QrMenuSettingsView.tsx) (Branding & kebijakan order)<br>• [QrLiveOrdersView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/QrLiveOrdersView.tsx) (Antrean order live dapur)<br>• [CustomerQrMenuView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/CustomerQrMenuView.tsx) (Tampilan menu tamu mobile) | Menunggu Fase 4 |
| **FASE 6** | **Ringkasan Bisnis & Kuota Token** | • [BusinessSummaryView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/saas/BusinessSummaryView.tsx) (Kartu omset, grafik tren, jam ramai)<br>• [BillingTokensView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/BillingTokensView.tsx) (Kuota token AI & langganan) | Menunggu Fase 5 |
| **FASE 7** | **Laporan & Audit Keuangan** | • [FinancialReportView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/FinancialReportView.tsx) (Laba rugi kotor/bersih, arus kas)<br>• [ShiftsAuditView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/ShiftsAuditView.tsx) (Audit selisih laci kasir X/Z)<br>• [ProductAnalyticsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/ProductAnalyticsView.tsx) (Matriks menu terlaris) | Menunggu Fase 6 |
| **FASE 8** | **Promosi, Diskon & Voucher** | • [PromotionsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/PromotionsView.tsx) (Diskon persentase, nominal, voucher belanja) | Menunggu Fase 7 |
| **FASE 9** | **Pelanggan, CRM & Kasbon** | • [CustomersView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/CustomersView.tsx) (Buku member loyalitas, riwayat kasbon)<br>• `CustomerDebtsTab` & Modal pelunasan piutang | Menunggu Fase 8 |
| **FASE 10** | **Manajemen Staf & Absensi** | • [UsersView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/UsersView.tsx) & [attendance](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/attendance) (Akun staf, PIN, absensi)<br>• [StaffRolesView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/StaffRolesView.tsx) (Hierarki hak akses RBAC) | Menunggu Fase 9 |
| **FASE 11** | **Pengaturan Toko & Resto** | • [ReceiptSettingsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/ReceiptSettingsView.tsx) (Struk kasir & printer Bluetooth)<br>• [TaxesSettingsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/TaxesSettingsView.tsx) (Pajak PB1 & biaya resto)<br>• [PaymentSettingsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/PaymentSettingsView.tsx) (QRIS statis & EDC)<br>• [SalesChannelsSettingsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/SalesChannelsSettingsView.tsx) (Mitra online delivery)<br>• [LoyaltySettingsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/LoyaltySettingsView.tsx) & [OutletsView.tsx](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/OutletsView.tsx) | Menunggu Fase 10 |

---

*Dokumen ini dibuat otomatis dan terikat sebagai standar QA & UI/UX Well POS.*
