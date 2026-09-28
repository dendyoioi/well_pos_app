# EPIC-16: ENTERPRISE OWNER BACKOFFICE REDESIGN
## Perombakan Total Antarmuka Dasbor Pemilik Usaha: Navigasi Bertingkat, Ringkasan Bisnis & Panel Analisis Visual

**Epic ID**: `EPIC-16`  
**Status**: **COMPLETED ✅**  
**Prioritas**: **P1 — FLAGSHIP PRODUCT EXPERIENCE (WELL POS CLEAN UI)**  
**Target Komponen**: `pos_apps/client/src/pages/DashboardPage.tsx`, `BackofficeLayout.tsx`, `BusinessSummaryView.tsx`  
**Dokumen Induk**: [`docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md`](./00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md)  
**Dokumen Arsitektur Rujukan**: `docs/00_PROJECT_CONTEXT.md`  

---

### 1. DESKRIPSI & TUJUAN BISNIS
Setelah proses pembuatan toko perdana selesai (EPIC-15), Pemilik Usaha (Owner) langsung diarahkan ke **Dashboard Backoffice Tingkat Enterprise** yang baru. Antarmuka ini dirancang presisi mengikuti standar platform point-of-sale modern kelas dunia berbalut tema putih-biru yang bersih dan elegan:
1. **Navigasi Bersih & Terstruktur**: Sidebar bertingkat (*hierarchical accordion*) yang mengelompokkan modul operasional secara rapi tanpa membebani layar.
2. **Multi-Store Header Control**: Header atas yang memungkinkan perpindahan toko secara instan dengan indikator status paket langganan aktif.
3. **Pusat Analisis Finansial Terintegrasi**: Halaman utama "Ringkasan Bisnis" yang menyajikan tab perbandingan data vs grafik, filter multidimensi (saluran pesanan, jenis layanan, rentang waktu), KPI ringkasan, dan 4 panel rincian visual.

---

### 2. ARSITEKTUR KOMPONEN ANTARMUKA (VISUAL BLUEPRINT)

#### A. Header Bar Atas (Global Navigation Header)
- **Kiri**:
  - Logo Resmi Well POS.
  - Dropdown Selektor Toko Aktif dengan penanda sektor (misal: `F&B Kopi Senja Mandiri ⌵`).
- **Kanan**:
  - Icon Bantuan / Support Center (🎧).
  - Selektor Bahasa (🌐 `Indonesia ⌵`).
  - Lonceng Notifikasi Transaksi / Sistem (🔔 `Pusat Notifikasi`).
  - Badge Status Paket Langganan Toko (misal: `Free Trial` / `Pro Business`).
  - Foto Profil / Avatar Owner dengan dropdown akun & logout.

#### B. Sidebar Navigasi Bertingkat (Collapsible Accordion Sidebar)
Mengakomodasi 8 rumpun modul utama dengan sub-menu lengkap:
1. **Produk ⌵**:
   - Produk
   - Menu
   - Koleksi
   - Atribut
2. **Stok ⌵**:
   - Gudang
   - Stok
3. **Promosi ⌵**:
   - Diskon Produk
   - Daftar Diskon Produk
4. **Pesanan ⌵**:
   - Pesanan
5. **Laporan ⌵** *(Halaman Aktif Default)*:
   - **Ringkasan Bisnis** *(Primary View)*
   - Statistik Penjualan
   - Diskon
   - Shift
6. **Integrasi ⌵**:
   - Jurnal
7. **Staf ⌵**:
   - Staf
   - Akses & Peran
   - Langganan
8. **Pengaturan Toko ⌵**:
   - Pembayaran & Biaya
   - Template Struk
   - Manajemen Perangkat
   - Pengaturan Toko

---

### 3. TATA LETAK HALAMAN "RINGKASAN BISNIS" (MAIN VIEW)
Halaman Ringkasan Bisnis memuat elemen-elemen berikut:

1. **Tab Mode Tampilan**:
   - `Data` (Tabel ringkasan & kartu komparasi angka)
   - `Statistik Grafik` (Visualisasi kurva/bar chart)
2. **Kategori Filter Cepat**:
   - Tombol Pill: `Operasional` | `Pembayaran` | `Produk`
3. **Baris Filter Waktu & Saluran**:
   - Dropdown `Saluran Pesanan ⌵` (Semua / Kasir POS / GrabFood / GoFood / Online Store)
   - Dropdown `Jenis Layanan ⌵` (Dine-in / Take Away / Delivery)
   - Date Range Picker kalender (misal: `2026-09-16 s.d 2026-09-22 📅`)
   - Radio selector: `◉ 24 Jam` | `○ Pilih Tanggal`
4. **Tiga Kartu KPI Utama**:
   - **Pembayaran diterima (Rp)**: Total omset bersih uang masuk + persentase pertumbuhan.
   - **Volume pesanan**: Jumlah total transaksi yang berhasil.
   - **Laba kotor (Rp)**: Pendapatan dikurangi HPP/COGS aktual (*Moving Average Cost*).
5. **Empat Panel Rincian Analisis (2x2 Grid Layout)**:
   - **Panel 1**: *Rincian jenis pesanan* (Tabel pendapatan berdasarkan Dine-in vs Take Away vs Delivery).
   - **Panel 2**: *Rincian Penjualan Produk* (Breakdown kontribusi produk terlaris terhadap omset).
   - **Panel 3**: *Komposisi diskon dan jumlah pembulatan* (Total potongan promo & pembulatan kasir).
   - **Panel 4**: *Perincian jumlah yang dibayarkan* (Distribusi metode bayar: Tunai, QRIS, Kartu Debit, Transfer).

---

### 4. BREAKDOWN SPRINT TASK (SPRINT WORK PLAN)

- [x] **Sprint 16.1: Layout Shell & Enterprise Sidebar Engine**
  - Implementasi komponen `BackofficeLayout` dengan state aktif bertingkat dan persistensi collapse.
  - Integrasi icon set minimalis elegan (Lucide-React).
  - Header multi-outlet switcher dengan badge paket langganan.

- [x] **Sprint 16.2: Filter Bar & Date Range Controller**
  - Komponen date picker rentang tanggal (*DateRangePicker*).
  - Selector saluran pesanan dan jenis layanan.
  - Toggle 24 jam vs kustom tanggal dengan pembaruan parameter query real-time.

- [x] **Sprint 16.3: Executive Metric Cards & Backend Analytics Integration**
  - Penyelarasan endpoint analitik `GET /api/reports/business-summary` dengan parameter filter toko, rentang tanggal, dan saluran.
  - Kartu metrik: Pembayaran diterima, Volume pesanan, Laba kotor dengan tooltip penjelasan HPP.

- [x] **Sprint 16.4: Empat Kartu Analisis Rincian & Empty State Design**
  - Desain 4 panel grid dengan empty-state ilustratif ramah pengguna (*"Belum ada data"*).
  - Tampilan visual saat data terisi (grafik bar / list persentase kontribusi omset).
  - Tab switcher `Data` vs `Statistik Grafik`.

---

### 5. KRITERIA PENERIMAAN (ACCEPTANCE CRITERIA)
1. Desain antarmuka backoffice presisi menyerupai referensi screenshot (*pixel-perfect structure*).
2. Seluruh menu sidebar bertingkat dapat dibuka/tutup secara mulus (*collapsible accordion*).
3. Switcher toko di header secara instan memperbarui konteks data toko yang sedang aktif.
4. Filter saluran pesanan, layanan, dan rentang tanggal terhubung dinamis ke laporan ringkasan bisnis.
