# EPIC-13: TOTAL FRONTEND RE-ARCHITECTURE & MODERN UI/UX OVERHAUL
## Perombakan Menyeluruh Antarmuka Pengguna: Landing Page, SuperAdmin Control Tower, POS Terminal & Merchant Backoffice

**Epic ID**: `EPIC-13`  
**Status**: **COMPLETED ✅**  
**Prioritas**: **P1 — CRITICAL FOR PRODUCT EXPERIENCE & COMMERCIAL SUCCESS**  
**Target Komponen**: `pos_apps/client` & `docs`  
**Dokumen Induk**: [`docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md`](file:///Users/dendyaditya/Projects/pos_project/docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md)  
**Dokumen Arsitektur Rujukan**: `docs/00_PROJECT_CONTEXT.md`  

---

### 1. DESKRIPSI & TUJUAN BISNIS
Menyelaraskan seluruh antarmuka pengguna (*User Interface & User Experience*) aplikasi Well POS dengan arsitektur backend 18 tabel target yang telah berhasil dibangun pada EPIC-01 s.d EPIC-12. 

Selama proses migrasi arsitektural sebelumnya, backend telah bertransformasi menjadi platform POS & Supply Chain multi-tenant tingkat lanjut (pemisahan Produk vs Bahan Baku, Resep BOM bertingkat, Gudang Distribusi Pusat, Moving Average Cost HPP, CRM Loyalty Ledger, dan PostgreSQL RLS). Namun, sebagian antarmuka frontend masih mempertahankan pola lama (seperti komponen monolitik, asumsi stok tunggal tanpa lokasi penyimpanan, dan landing page generik).

Tujuan **EPIC-13** adalah:
1. **Design System & Visual Excellence**: Menerapkan sistem desain modern berstandar industri dengan palet warna terkurasi (*Deep Navy, Slate Surface, Emerald Accent*), tipografi tajam, micro-animations, dan tata letak responsif (*mobile, tablet, desktop*).
2. **World-Class SaaS Landing Page**: Membangun landing page publik interaktif yang memperlihatkan keunggulan nyata Well POS (Dual Engine F&B + Ritel, Multi-Cabang, kalkulator paket harga, dan pendaftaran mandiri calon merchant yang mulus).
3. **Control Tower SuperAdmin Platform**: Menyediakan portal pemantauan eksekutif untuk mengelola tenant, memantau siklus hidup langganan (Trial, Active, Suspended), metrik MRR, inspeksi toko (impersonation), dan audit keamanan.
4. **Next-Gen POS Terminal**: Memecah monolith antarmuka kasir (`PosTerminalView.tsx` >100KB) menjadi komponen-komponen modular berkecepatan tinggi, ramah sentuhan (*touch-friendly*), dengan kalkulasi modifier resep real-time, multi-tender payment sheet, dan audit shift X/Z.
5. **Modern Merchant Backoffice**: Menyajikan dasbor manajemen toko yang intuitif untuk pembuatan resep BOM, perpindahan stok gudang-ke-cabang (Transfer Stok), audit selisih kas, dan laporan laba kotor real-time.

---

### 2. BREAKDOWN SPRINT TASK (SPRINT WORK PLAN)

- [x] **Sprint 13.1: Design System, Layout Architecture & Navigation Shell**
  - Implementasi Design System terpadu di `src/components/ui` (`Button`, `Card`, `Badge`, `Modal`, `Input`, `Tabs`, `StatCard`).
  - Integrasi tipografi Google Fonts (*Plus Jakarta Sans / Inter*) dan palet warna harmonis di `index.css`.
  - Penataan ulang arsitektur routing & navigation shell di `App.tsx` (Portal Switcher: Landing, Superadmin, POS, Backoffice).

- [x] **Sprint 13.2: World-Class SaaS Landing Page (`SaasLandingPage.tsx`)**
  - Hero Section dinamis dengan mockup POS interaktif dan CTA peluncuran sandbox instan.
  - Showcase fitur arsitektur nyata: Dual-Engine F&B (BOM) & Ritel, Logistik Gudang Pusat, dan Laba Kotor Real-time.
  - Tabel perbandingan paket fitur transparan (Free vs Pro Bisnis vs Enterprise).
  - Alur registrasi merchant mandiri yang modern, tervalidasi nomor WhatsApp Indonesia (+62), dan terhubung langsung ke onboarding toko.

- [x] **Sprint 13.3: Executive SuperAdmin Platform Portal (`SuperadminDashboardPage.tsx`)**
  - Executive KPI Cards: Total Tenant Aktif, Total Outlet, Estimasi MRR, dan Distribusi Paket.
  - Tenant Lifecycle Management: Filter, pencarian, perpanjangan masa aktif, dan kontrol suspend/active.
  - 1-Click Impersonation: Akses inspeksi toko klien dengan floating control bar.
  - Security & Health Audit: Status PostgreSQL Row-Level Security (RLS) dan telemetry platform.

- [x] **Sprint 13.4: Next-Gen Modular POS Terminal (`PosTerminalView.tsx`)**
  - Dekomposisi file monolitik menjadi sub-komponen terisolasi:
    * `PosHeader`: Outlet aktif, modal awal kasir, indikator shift, dan tombol X-Report.
    * `CategoryPills` & `ProductCatalogGrid`: Tampilan kartu menu ramah sentuhan, badge varian, dan stok kasir real-time.
    * `ModifierSelectionModal`: Bottom-sheet pilihan topping/resep dengan kalkulasi harga dinamis.
    * `OrderCartSidebar`: Ringkasan pesanan, selector member loyalty, input voucher promo, dan rincian diskon.
    * `PaymentModalSheet`: Pembayaran Tunai (denominasi cepat & kembalian), QRIS Sandbox simulator (timer 15:00 & callback instan), dan Split Payment.
    * `ShiftClosureModal`: Tutup shift kasir dengan *blind cash count* dan penerbitan Z-Report.

- [x] **Sprint 13.5: Comprehensive Merchant Backoffice Overhaul**
  - **Katalog & Resep F&B (`ProductsView.tsx`)**: Visual recipe builder memetakan bahan baku per varian menu.
  - **Logistik & Pergudangan (`InventoryView.tsx`)**: Pemisahan fisik stok toko vs gudang cadangan, alur transfer stok cabang (Request -> Dispatch -> Receive), dan kartu mutasi stok (Ledgers).
  - **Finansial & HPP (`FinancialReportView.tsx`)**: Laporan laba kotor real-time berbasis moving average cost, audit selisih kas (*over/short*), dan top seller.
  - **CRM & Promosi (`CustomersView.tsx`)**: Membership tier, buku besar poin reward, dan builder voucher diskon.
  - **Konfigurasi Cabang & Hardware (`OutletsView.tsx`)**: Pengaturan printer struk 58mm/80mm, kop/footer struk, dan biaya layanan.

---

### 3. KRITERIA PENERIMAAN (ACCEPTANCE CRITERIA)
1. **Zero Regression**: Seluruh 5 modul automated contract test (`npm run test:sandbox`) tetap lulus 100%.
2. **Clean Build**: Perintah `npm run build:client` dan `npm run build:server` berjalan tanpa error TypeScript.
3. **Visual Excellence**: Seluruh halaman memiliki estetika modern, responsif, kontras warna yang nyaman, dan tidak ada lagi layout usang/tumpang-tindih.
4. **Architectural Alignment**: Tidak ada lagi asumsi data legacy di antarmuka (seperti input saldo tanpa storage location atau produk tanpa varian/resep).
5. **Modular Codebase**: Tidak ada file komponen tunggal yang melebihi 40KB di sisi frontend kasir.
