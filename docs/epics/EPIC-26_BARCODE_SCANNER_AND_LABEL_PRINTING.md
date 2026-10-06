# EPIC-26: RETAIL SPEED, LIVE CAMERA BARCODE SCANNER & SHELF LABEL PRINTING ENGINE

## 📋 IKHTISAR MODUL (EXECUTIVE SUMMARY)
Modul ini menghadirkan kemampuan akselerasi transaksi kasir ritel, minimarket, toko kelontong, butik, dan apotek melalui:
1. **Pemindai Barcode Kamera HP Langsung (Live Camera Barcode Scanner)**: Memanfaatkan kamera smartphone atau webcam laptop kasir secara real-time via WebRTC dan engine ZXing untuk membaca seluruh format barcode 1D (EAN-13, EAN-8, UPC, Code 128, Code 39) serta QR Code 2D, lalu otomatis menambahkan produk ke keranjang belanja POS seketika tanpa perlu perangkat keras scanner USB fisik.
2. **Generator & Cetak Label Barcode / Stiker Rak Produk (Shelf Price Tag & Barcode Labeler)**: Menghasilkan label stiker produk berbasis vektor SVG murni (300+ DPI) dengan berbagai ukuran standar printer label thermal ($40\times 30\text{mm}$, $30\times 20\text{mm}$, $50\times 30\text{mm}$, dan lembaran kertas A4 grid), lengkap dengan Nama Toko, Nama Produk/Varian, Kode SKU/Barcode, dan Harga Jual Rupiah tebal.

---

## 🎯 SCOPE & FITUR UTAMA

### 1. Live Camera Barcode Scanner (`BarcodeCameraScannerModal.tsx`)
- **Akses Cepat**: Tersedia di bar pencarian POS Mobile (`PosMobileView`) dan POS Desktop (`PosHeader` & catalog search).
- **Format Barcode Didukung**: EAN-13, EAN-8, UPC-A, UPC-E, CODE-128, CODE-39, QR_CODE.
- **Audio & Haptic Feedback**: Suara *beep* sintetis Web Audio API dan getaran mikro ponsel saat barcode berhasil terdeteksi.
- **Auto-Add ke Keranjang**: Otomatis mencocokkan barcode hasil scan ke SKU atau barcode produk pada katalog toko aktif, lalu langsung menambahkan 1 kuantitas ke keranjang belanja kasir.
- **Continuous Scan Mode**: Kasir dapat memindai produk berturut-turut tanpa harus menutup kamera bolak-balik.
- **Kontrol Kamera**: Pilihan kamera belakang/depan (*facingMode: environment*) dan tombol senter (*torch toggle*) untuk kondisi toko redup.

### 2. Generator & Cetak Label Stiker Produk (`ProductBarcodeLabelsModal.tsx`)
- **Titik Akses**: Menu Backoffice *Katalog Produk* (`ProductsView.tsx`) melalui tombol *"Cetak Label Barcode"*.
- **Pilihan Produk Fleksibel**: Dapat memilih 1 produk spesifik, beberapa produk pilihan, atau seluruh katalog.
- **Jumlah Salinan per Item**: Pengaturan kuantitas stiker yang ingin dicetak per barang.
- **Pilihan Template Ukuran**:
  - `40x30mm` — Standar printer label thermal (Xprinter / Blueprint / Panda).
  - `30x20mm` — Ukuran compact untuk kosmetik, aksesoris, perhiasan.
  - `50x30mm` — Ukuran label rak supermarket (*price tag* etalase).
  - `A4 Grid` — Kertas stiker HVS / Tom & Jerry untuk printer kantor biasa.
- **Kustomisasi Elemen Label**: Toggle Nama Toko, Nama Produk, Varian, SKU, dan Harga Jual Rupiah.
- **Rendering Vektor SVG Murni**: Barcode dirender dengan garis vektor SVG tajam agar mudah terbaca oleh mesin pemindai fisik mana pun.
- **Cetak Presisi**: Menggunakan stylesheet `@media print` khusus ukuran millimeter per halaman (*page-break-inside: avoid*).

---

## 🧪 CHECKLIST ACCEPTANCE CRITERIA
- [x] Kasir di HP/Desktop dapat menekan ikon barcode kamera di POS dan kamera aktif tanpa error.
- [x] Scan barcode produk fisik langsung memasukkan item ke keranjang belanja POS kasir (termasuk varian produk).
- [x] Peringatan toast & audio chime jelas jika barcode tidak ditemukan di database produk toko aktif.
- [x] Pemilik toko dapat membuka modal Cetak Label dari halaman Katalog Produk (Toolbar utama, checklist massal, dan aksi per baris).
- [x] Dialog cetak menampilkan label barcode presisi sesuai ukuran mm yang dipilih (40x30, 30x20, 50x30, 60x40 shelf talker, dan A4 grid).
- [x] Seluruh kode lolos typecheck `npm run build` (Exit code 0 pada client dan server).

---

## 📌 STATUS IMPLEMENTASI (COMPLETED ✅)
- **Komponen Utama**:
  - `pos_apps/client/src/components/pos/BarcodeCameraScannerModal.tsx`: Pemindai kamera WebRTC + ZXing multi-format 1D & 2D QR.
  - `pos_apps/client/src/components/BarcodeRenderer.tsx`: Generator barcode SVG vektor tajam dengan JsBarcode.
  - `pos_apps/client/src/components/ProductBarcodeLabelsModal.tsx`: Studio konfigurasi & pratinjau cetak label multi-template dengan pencetakan terisolasi via iframe.
  - `pos_apps/client/src/components/pos/PosMobileView.tsx`: Tombol pemicu scanner kamera di search bar mobile.
  - `pos_apps/client/src/components/pos/CategoryFilterPills.tsx`: Tombol pemicu scanner kamera di action bar desktop.
  - `pos_apps/client/src/pages/PosTerminalView.tsx`: Integrasi handler scan barcode & modal kamera.
  - `pos_apps/client/src/pages/ProductsView.tsx`: Tombol cetak label di toolbar atas, floating bulk bar, dan baris produk.
