# WELL POS — MASTER EPIC REGISTRY & PROJECT MEMORY
## Canonical Ledger of Work History, Architecture Milestones, and End-to-End Product Roadmap

**Dokumen Rujukan Utama**: `docs/00_PROJECT_CONTEXT.md`  
**Basis Data**: PostgreSQL `pos_db` (40 Model Prisma Aktif Ternormalisasi Penuh)  
**Terakhir Diperbarui**: 01 Oktober 2026  
**Status Keseluruhan**: **EPIC-01 s.d EPIC-24 SELESAI 100% (COMPLETED ✅)**  

---

### 1. TUJUAN DOKUMEN (PURPOSE OF MEMORY REGISTRY)
Dokumen ini berfungsi sebagai **memori kerja permanen (*persistent cognitive memory*)** untuk AI Agent (Antigravity) dan tim pengembang. Setiap fase, keputusan arsitektur (ADR), eksekusi migrasi, dan rencana sprint terekam secara terpusat di sini agar kelanjutan pengerjaan produk Well POS selalu memiliki konteks utuh, presisi, dan konsisten dari waktu ke waktu sampai seluruh produk rilis ke pasar.

---

### 2. MASTER EPIC REGISTRY (END-TO-END PRODUCT ROADMAP)

Produk Well POS memiliki total **24 Epic** yang mencakup seluruh siklus hidup pengembangan dari fondasi arsitektur hingga peluncuran SaaS produksi, sandbox lokal, modernisasi antarmuka pengguna, tata kelola multi-toko, kanal penjualan mitra online, alokasi katalog multi-outlet serta pembatalan transaksi dengan approval PIN supervisor:

| Epic ID | Judul Epic | Status | Tahapan / Milestone | Fokus & Nilai Bisnis Utama |
| :--- | :--- | :---: | :--- | :--- |
| **EPIC-01** | **System Audit, Multi-Tenant RFC & Domain Analysis** | **COMPLETED ✅** | Prompts 01 - 03<br/>`docs/architecture/01-03` | Audit aplikasi eksisting (70% ritel), dekomposisi Product vs InventoryItem, isolasi tenant. |
| **EPIC-02** | **Target Database Schema & Architectural Decisions** | **COMPLETED ✅** | Prompts 04 - 11<br/>ADR-001 s.d ADR-005 | Perancangan 18 tabel target, penetapan UOM, Negative Stock, Batch Lot, dan Prisma Schema. |
| **EPIC-03** | **Zero-Downtime Data Migration (Expand, Backfill, Dual-Write)** | **COMPLETED ✅** | Fase 12, 13, 14, 15<br/>`docs/validation/10-27` | Eksekusi Expand DDL, Backfill historis (paritas 100%), Dual-Write Services, dan Dual-Run Soak Test. |
| **EPIC-04** | **Production Traffic Cutover & Legacy Contract (Decommissioning)** | **COMPLETED ✅** | Fase 16 & 17<br/>`docs/validation/28-29` | Pengalihan 100% arus baca/tulis (`TARGET_ONLY`), Drop tabel legacy (`outlet_products`, `stock_movements`, `payments`) & kolom usang. |
| **EPIC-05** | **Frontend Client Integration & Core POS Cashier Experience** | **COMPLETED ✅** | Sprint 5.1 s.d 5.6<br/>[`EPIC-05.md`](./EPIC-05_FRONTEND_CLIENT_INTEGRATION_AND_POS_EXPERIENCE.md) | Penyelarasan UI Kasir & Backoffice (`pos_apps/client`) dengan API target baru (Varian, Stok Multi-Outlet, Checkout Target, Struk Thermal, Shift X/Z). |
| **EPIC-06** | **F&B Multi-Vertical Engine (Recipes / BOM, Modifiers & Kitchen Workflow)** | **COMPLETED ✅** | Sprint 6.1 s.d 6.7<br/>[`EPIC-06.md`](./EPIC-06_FNB_RECIPES_MODIFIERS_AND_KITCHEN_ENGINE.md) | Manajemen resep minuman/makanan, pemotongan bahan baku otomatis (*inventory items*), topping/modifiers terhubung ke bahan baku (BOM modifier), Kitchen Display System (KDS), serta Ekspor & Impor Massal Katalog Produk (CSV/Excel). |
| **EPIC-07** | **Supply Chain Logistics, Central Warehouse & Purchasing (PO & Receiving)** | **COMPLETED ✅** | Sprint 7.1 s.d 7.9<br/>[`EPIC-07.md`](./EPIC-07_SUPPLY_CHAIN_LOGISTICS_AND_PURCHASING.md) | Purchase Order (PO) ke supplier, Goods Receiving dengan Moving Average Cost real-time, transfer stok multi-cabang (dispatch/receive), peringatan kedaluwarsa batch/lot, antarmuka Backoffice PO & Transfer Cabang, widget peringatan kadaluarsa, dan Unified Bulk Stock Workspace (Opname, Stok Masuk, Stok Keluar, Transfer Antar Cabang). |
| **EPIC-08** | **CRM, Customer Loyalty, Discounts & Promotion Engine** | **COMPLETED ✅** | Sprint 8.1 s.d 8.5<br/>[`EPIC-08.md`](./EPIC-08_CRM_LOYALTY_AND_PROMOTIONS_ENGINE.md) | Program poin reward pelanggan, tier membership, voucher promo (nominal/persen), buy-X-get-Y, dan kirim struk WhatsApp/Email. |
| **EPIC-09** | **Financial Analytics, Real-Time COGS/HPP & Business Intelligence** | **COMPLETED ✅** | Sprint 9.1 s.d 9.10<br/>[`EPIC-09.md`](./EPIC-09_FINANCIAL_ANALYTICS_AND_COGS_HPP.md) | Laporan laba kotor & laba bersih operasional (Gross Profit - Kas OPEX Shift), kurva visual tren penjualan/HPP Native SVG, Smart BI Insights (Peak Hours & Margin Health), audit selisih kas kasir (*over/short*), top 10 best-seller, dan ekspor CSV UTF-8 BOM. |
| **EPIC-10** | **SaaS Management Platform, SuperAdmin Portal & Automated Billing Lifecycle** | **COMPLETED ✅** | Sprint 10.1 s.d 10.4<br/>[`EPIC-10.md`](./EPIC-10_SAAS_SUPERADMIN_AND_BILLING_LIFECYCLE.md) | Portal SuperAdmin (`admin.wellpos.id`), self-service tenant onboarding, billing gateway (Midtrans/Xendit), auto-suspend tenant telat bayar. |
| **EPIC-11** | **Production Hardening, PostgreSQL RLS Security, Redis & Cloudflare DevOps** | **COMPLETED ✅** | Sprint 11.1 s.d 11.4<br/>[`EPIC-11.md`](./EPIC-11_PRODUCTION_HARDENING_RLS_AND_DEVOPS.md) | Pertahanan berlapis PostgreSQL Row-Level Security (RLS), Docker production multi-stage, Redis catalog cache, rate limiting & SSL/WAF. |
| **EPIC-12** | **Local Pre-Release Sandbox, Master Seeder & Interactive Simulators** | **COMPLETED ✅** | Sprint 12.1 s.d 12.4<br/>[`EPIC-12.md`](./EPIC-12_LOCAL_PRE_RELEASE_SANDBOX.md) | Lingkungan sandbox lokal mandiri, Master Seeder multi-role, simulator pembayaran QRIS, virtual printer thermal & cash drawer kick, runner terpadu. |
| **EPIC-13** | **Total Frontend Re-Architecture & Modern UI/UX Overhaul** | **COMPLETED ✅** | Sprint 13.1 s.d 13.5<br/>[`EPIC-13.md`](./EPIC-13_TOTAL_FRONTEND_RE_ARCHITECTURE_AND_UI_UX_OVERHAUL.md) | Perombakan total antarmuka pengguna: Landing page berstandar dunia, Control tower SuperAdmin, Terminal POS modular, dan Backoffice F&B/Ritel modern. |
| **EPIC-14** | **Decoupled Owner Identity, Split-Registration & SuperAdmin Approval** | **COMPLETED ✅** | Sprint 14.1 s.d 14.4<br/>[`EPIC-14.md`](./EPIC-14_DECOUPLED_OWNER_IDENTITY_AND_SPLIT_REGISTRATION.md) | Pendaftaran mandiri murni identitas Owner (Nama Depan/Belakang, WA, Email, Password, Konfirmasi) tanpa toko, approval owner di Superadmin. |
| **EPIC-15** | **Full-Screen Multi-Industry Store Creator Wizard** | **COMPLETED ✅** | Sprint 15.1 s.d 15.4<br/>[`EPIC-15.md`](./EPIC-15_FULLSCREEN_MULTI_INDUSTRY_STORE_CREATOR_WIZARD.md) | Layar penuh onboarding toko perdana ("Belum Punya Toko"), Nama Pedagang, Nama Toko, No WA Toko, Alamat, dan 58 sub-industri searchable multi-select bernuansa Putih-Biru. |
| **EPIC-16** | **Enterprise Owner Backoffice Redesign (Well POS Clean UI)** | **COMPLETED ✅** | Sprint 16.1 s.d 16.4<br/>[`EPIC-16.md`](./EPIC-16_ENTERPRISE_OWNER_BACKOFFICE_REDESIGN.md) | Dasbor Owner berstandar enterprise: Sidebar accordion bertingkat 8 rumpun modul, Filter bar analitis, 3 KPI ringkasan, dan 4 panel rincian visual. |
| **EPIC-17** | **Multi-Store Hierarchy & Per-Store SaaS Subscriptions** | **COMPLETED ✅** | Sprint 17.1 s.d 17.4<br/>[`EPIC-17.md`](./EPIC-17_MULTI_STORE_HIERARCHY_AND_PER_STORE_SUBSCRIPTIONS.md) | Pohon kepemilikan 1-Owner-ke-N-Toko, daftar toko per owner di SuperAdmin, dan manajemen paket bisnis SaaS granular per unit toko. |
| **EPIC-18** | **SuperAdmin Onboarding Lifecycle, Store Governance & Triage Funnel** | **COMPLETED ✅** | Sprint 18.1 s.d 18.4<br/>[`EPIC-18.md`](./EPIC-18_SUPERADMIN_ONBOARDING_LIFECYCLE_AND_STORE_GOVERNANCE.md) | Siklus persetujuan akun owner, segmented triage filter pills, inline expandable sub-baris toko (zero stacked popups), kaskade nonaktif, dan metrik akurat. |
| **EPIC-19** | **Buku Menu QR Digital, Self-Ordering Meja & Manajemen Meja Resto** | **COMPLETED ✅** | Sprint 19.1 s.d 19.4<br/>[`EPIC-19.md`](./EPIC-19_QR_MENU_AND_CUSTOMER_SELF_ORDERING.md) | Self-ordering via pemindaian QR meja resto, menu publik mobile-first, tent card print engine, live kitchen feed & pay at cashier. |
| **EPIC-20** | **Kanal Penjualan & Mitra Online Delivery Terpadu** | **COMPLETED ✅** | Sprint 20.1 s.d 20.4<br/>[`EPIC-20.md`](./EPIC-20_SALES_CHANNELS_AND_ONLINE_DELIVERY_PLATFORMS.md) | Kustomisasi kanal penjualan langsung & mitra online (GoFood, GrabFood, ShopeeFood, Maxim), pemisahan kontekstual input kasir (Meja vs ID Pesanan Driver), dan rincian omset per kanal di laporan keuangan. |
| **EPIC-21** | **Multi-Outlet Catalog Isolation, Warehouse Backflushing & Stock Allocation** | **COMPLETED ✅** | Fase 1 s.d 4<br/>[`EPIC-21.md`](./EPIC-21_MULTI_OUTLET_CATALOG_AND_WAREHOUSE_BOM.md) | Isolasi menu/kategori & resep BOM per jenis toko, resolusi dinamis gudang pasokan (`warehouseId`), direct backflushing kasir otomatis ke gudang, dan dashboard visibilitas multi-gudang serta alokasi transfer stok terpadu. |
| **EPIC-22** | **Smart Calling Queue Numbering & Flexible Store Toggle** | **COMPLETED ✅** | Fase 1<br/>[`EPIC-22.md`](./EPIC-22_CALLING_QUEUE_NUMBERING.md) | Standardisasi nomor antrean panggilan cepat lisan kasir F&B (`#01`, `#02`), reset harian otomatis per outlet, cetak thermal/PDF, teks WA, dan sakelar on/off fleksibel di menu format struk Backoffice. |
| **EPIC-23** | **Pakasir.com Payment Gateway Integration (Direct QRIS & Webhook)** | **COMPLETED ✅** | Fase 1 s.d 4<br/>[`EPIC-23.md`](./EPIC-23_PAKASIR_PAYMENT_GATEWAY_INTEGRATION.md) | Integrasi gateway pembayaran Pakasir API v2, pembayaran aktivasi pendaftaran awal tenant Rp 99.000 + 100 bonus token, top-up kuota token pay-as-you-go, direct QRIS modal, polling status live, webhook secret guard, tarif dinamis Rp 69/token, batas minimal 250 token, sakelar QRIS Superadmin, dan eliminasi transfer manual. |
| **EPIC-24** | **Transaction Void & Supervisor/Owner PIN Approval Engine** | **COMPLETED ✅** | Fase 1<br/>[`EPIC-24.md`](./EPIC-24_TRANSACTION_VOID_AND_SUPERVISOR_APPROVAL.md) | Pembatalan resmi transaksi kasir (Full & Partial Item Void), otorisasi PIN 6-digit Supervisor/Owner, pemulihan stok inventaris atomik (movement_type VOID), slip cetak bukti fisik void dengan signature block Kasir & Spv, audit retur (refunds), isolasi omset kas shift, dan pemulihan kuota token SaaS. |

---

### 3. CHRONOLOGICAL WORK HISTORY (REKAM JEJAK KINERJA LENGKAP)

```text
================================================================================
                      WELL POS EVOLUTIONARY MILESTONES
================================================================================
[2026-09-01 s.d 2026-09-10] FONDASI ARSITEKTUR & DESAIN SKEMA TARGET (EPIC-01 & EPIC-02)
  ├── Penerbitan ADR-001: Penegakan Batas Multi-Tenant (Tenant Boundary Isolation).
  ├── Penerbitan ADR-002: Kebijakan Stok Negatif Kontekstual Berbasis Lokasi/Item.
  ├── Penerbitan ADR-003: Pemisahan UOM Kanonikal vs Multiplier Kemasan Komersial.
  ├── Penerbitan ADR-004: Dimensi Batch & Lot Opsional pada Persediaan Fisik.
  └── Penerbitan ADR-005: Pemisahan Domain Core, Commerce, Inventory, dan Services.

[2026-09-12 s.d 2026-09-16] EXPAND & BACKFILL PHASE (EPIC-03)
  ├── Fase 12 (Expand): Penambahan 18 tabel target beriringan dengan skema lama.
  ├── Fase 13 (Backfill): Migrasi saldo historis, pemetaan SKU ke ProductVariants & InventoryItems.
  └── Verifikasi Paritas: 14/14 Reconciliation Test Suites PASSED (100.00% Zero Drift).

[2026-09-17 s.d 2026-09-20] DUAL-WRITE & STABILIZATION (EPIC-03)
  ├── Fase 14 (Dual-Write): Service terpusat menyinkronkan penulisan kasir ke skema lama & baru.
  ├── Fase 15 (Reconciliation & Read Adapters): Implementasi adapter pembacaan skema target.
  └── Rehearsal Cutover: Simulasi failover dan reversibilitas darurat (Reverse Reconcile 39 ms).

[2026-09-21] PRODUCTION CUTOVER & CONTRACT PHASE (EPIC-04)
  ├── Fase 16 (Cutover): Pengalihan 100% lalu lintas produksi (`READ_FROM_TARGET=true`, `WRITE_MODE=TARGET_ONLY`).
  ├── Fase 17 (Contract): Cold Backup biner (124 KB), penghapusan tabel legacy:
  │   - DROP TABLE "outlet_products" CASCADE;
  │   - DROP TABLE "stock_movements" CASCADE;
  │   - DROP TABLE "payments" CASCADE;
  │   - DROP COLUMN: order_items.product_id, users.pin, products(stock, cost_price, barcode, base_price).
  └── Verifikasi Kontrak: 5/5 Test Suites PASSED (Checkout 201 Created, Laporan 200 OK, PIN Bcrypt 200 OK).

[2026-09-21 s.d 2026-09-22] PENYELESAIAN PRODUK HINGGA TUNTAS 100% (EPIC-05 s.d EPIC-12)
  ├── EPIC-05: Penyelarasan Frontend Client UI (Kasir POS, Varian, Multi-Tender, Struk, Shift) ➔ SELESAI 100% (COMPLETED ✅)
  ├── EPIC-06: Modul F&B (Resep BOM, Modifiers, Pemotongan Stok Bahan Baku, KOT Dapur) ➔ SELESAI 100% (COMPLETED ✅)
  ├── EPIC-07: Modul Rantai Pasok (Central Warehouse, PO, Moving Avg Cost, Transfer Stok, Expiry Alerts) ➔ SELESAI 100% (COMPLETED ✅)
  ├── EPIC-08: Modul CRM & Loyalty (Poin, Tiering, Voucher Promo, Digital Struk WhatsApp) ➔ SELESAI 100% (COMPLETED ✅)
  ├── EPIC-09: Modul Finansial & HPP (Laba Kotor, Rekap Selisih Kas, BI Dashboard) ➔ SELESAI 100% (COMPLETED ✅)
  ├── EPIC-10: Modul SaaS Management (Portal SuperAdmin, Otomasi Billing Langganan) ➔ SELESAI 100% (COMPLETED ✅)
  ├── EPIC-11: Hardening Produksi & DevOps (PostgreSQL RLS, Docker, Redis, Cloudflare) ➔ SELESAI 100% (COMPLETED ✅)
  ├── EPIC-12: Local Pre-Release Sandbox (Master Seeder, QRIS/Hardware Simulators, Runner, Playbook) ➔ SELESAI 100% (COMPLETED ✅)
  └── EPIC-13: Total Frontend Re-Architecture & Modern UI/UX Overhaul (Landing, SuperAdmin, POS, Backoffice) ➔ SELESAI 100% (COMPLETED ✅)

[2026-09-28] FITUR ENHANCEMENT: STOCK OPNAME MASSAL (BULK PHYSICAL COUNT ADJUSTMENT)
  ├── Backend Transaction Engine: POST /api/inventory/bulk-adjustment (Prisma transaction atomik, UUID Session Audit).
  ├── Target Dual-Write & Ledger: Pencatatan mutasi OPNAME_ADJUSTMENT ke inventory_ledgers & inventory_balances.
  ├── Frontend Full-Screen Workspace: FullScreenBulkOpnameModal.tsx (Clean White-Blue, zero stacked modals).
  └── Fitur Unggulan: Samakan semua dengan sistem, kalkulasi delta (+/-) real-time, estimasi dampak finansial HPP, dan filter selisih.

[2026-09-28] LIVE CLOUD DEPLOYMENT: VERCEL + RENDER + SUPABASE (ZERO-COST BOOTSTRAP STACK)
  ├── Frontend Web (SPA): Live di Vercel (https://well-pos-app.vercel.app) tracking branch main (dev for preview).
  ├── Backend API Engine: Live di Render Singapore (https://wellpos-api-dev.onrender.com) auto-deploy via GitHub.
  ├── Database Cloud: PostgreSQL 16 Managed di Supabase Singapore (ap-southeast-1) terhubung via connection pooler (port 6543) & direct (port 5432).
  ├── Reverse-Proxy /api: Terintegrasi via Vercel rewrites (zero CORS configuration).
  ├── Bot Keep-Alive: GitHub Actions cron (.github/workflows/keep_alive.yml) ping Render tiap 10 menit untuk mencegah cold start.
  └── ⚠️ Early Warning System & Hard Limits:
      1. Supabase DDL: Render TIDAK menjalankan migrasi DDL otomatis. Setiap migrasi schema.prisma WAJIB di-patch via Port 5432 sebelum deploy.
      2. Supabase Inactivity: Database auto-pause jika tidak ada query 7 hari (restore via Supabase Dashboard).
      3. Render 750h Limit: Maksimal 750 jam/bulan per akun. Jangan pasang service web gratis lain di akun yang sama.
      4. Vercel Production Rule: Perubahan hanya aktif di well-pos-app.vercel.app setelah di-merge ke branch main.
[2026-09-29] OPTIMALISASI UX SMARTPHONE PORTRAIT 6,8 INCI (FASE 1: NAVIGATION SHELL & ONBOARDING)
  ├── Responsive Backoffice Shell: BackofficeLayout.tsx dilengkapi Hamburger Menu Trigger, Off-Canvas Sliding Drawer (8 grup menu + mode gudang), dan Ergonomic Bottom Navigation Bar (Prime Thumb Zone: Kasir, Ringkasan, Pesanan, Stok, Menu).
  ├── Zero Collision & Edge-to-Edge: Auto-hide Bottom Bar saat kasir POS aktif (activeTab === 'pos') dan container padding p-0 agar PosMobileView mengisi layar penuh tanpa margin mubazir.
  ├── Responsive Store Switcher & Topbar: Penyesuaian layout header atas agar zero-clipping pada layar HP 390px - 430px (avatar, lock PIN, logout tetap kompak).
  ├── Setup Wizard Mobile Polish: FullScreenStoreWizard.tsx dioptimalkan untuk pengisian satu tangan dengan scrolling sector tabs yang mulus.
  └── Verifikasi Sistem: Exit code 0 pada build pos_apps/client dan pos_apps/server.

[2026-09-29] OPTIMALISASI UX SMARTPHONE PORTRAIT 6,8 INCI (FASE 2: KASIR, MODALS & CHECKOUT)
  ├── Ergonomic PosMobileView: Bottom-sheet keranjang belanja melayang, badge total item & nominal, sticky thumb action bar (bottom-6).
  ├── Modern Bottom-Sheet Dialogs: Transformasi 7 modal utama (Modal, PaymentModal, OrderSuccessModal, ProductModifierModal, StartShiftModal, CloseShiftModal, ConfirmModal) ke pola bottom-sheet (items-end sm:items-center, p-0 sm:p-4, rounded-t-3xl, max-h-[92vh]).
  ├── Sticky Action Footer di Prime Thumb Zone: Tombol aksi utama (Bayar, Konfirmasi, Selesaikan & Cetak) dipisahkan dari scrollable body agar tidak perlu scrolling manual.
  └── QRIS & Thermal Struk Adaptif: Barcode QRIS & pratinjau struk termal discale proporsional dengan overscroll-contain.

[2026-09-29] OPTIMALISASI UX SMARTPHONE PORTRAIT 6,8 INCI (FASE 3: HYBRID TABLE/CARD & PAGING KANONIKAL)
  ├── Canonical TablePagination Mobile: Paging 2-baris rapi (Baris 1: kontrol baris per halaman & rentang data; Baris 2: tombol navigasi [ < Sebelumnya ] Hal X / Y [ Selanjutnya > ]) dengan target sentuh >= 36px dan zero horizontal overflow.
  ├── Hybrid Card List View: Transformasi 4 modul tabel backoffice (OrdersView, ProductsView, CustomersView, ShiftsAuditView) menjadi kartu vertikal komprehensif pada layar < 768px.
  └── Floating Action Bar Clearance: Clearance bottom-20 sm:bottom-6 pada bilah aksi massal produk agar tidak menabrak Bottom Nav Bar.

[2026-09-29] OPTIMALISASI UX SMARTPHONE PORTRAIT 6,8 INCI (FASE 4: LAPORAN FINANSIAL, ANALITIK PRODUK & RINGKASAN BISNIS)
  ├── Hybrid Financial Daily Trend: Rincian omset harian menjadi kartu vertikal dengan komparasi Tunai vs QRIS dan AOV.
  ├── Hybrid Leaderboard & Dead Stock: Kartu peringkat menu terlaris bernomor (🥇, 🥈, 🥉), metrik COGS vs Laba Bersih, serta kartu peringatan stok lambat bergerak.
  └── Ergonomic Business Analytics: Donut chart metode pembayaran beralih ke flex-col, tombol ekspor & cetak flex-wrap w-full, dan grafik bar/tren scroll horizontal lancar.

[2026-09-29] OPTIMALISASI UX SMARTPHONE PORTRAIT 6,8 INCI (FASE 5 & AUDIT UI MENYELURUH: PENGATURAN TOKO & QR MEJA)
  ├── Full-Width Submit Action: ReceiptSettingsView, PaymentSettingsView, dan SalesChannelsSettingsView menerapkan tombol aksi w-full sm:w-auto di area jempol.
  ├── Bottom-Sheet QR Tent Card Preview: QrTablesView modal pratinjau tent card diubah menjadi bottom-sheet dengan sticky action bar (Download SVG/PNG).
  ├── Kitchen Feed Compact: QrLiveOrdersView feed dapur responsif 1-kolom dengan status badge jelas dan target sentuh >= 40px.
  └── 🏆 AUDIT UI MENYELURUH FASE 1 - FASE 5:
      • Viewport Target 390px - 430px (rasio 19.5:9 s.d 20:9): LULUS 100% (Zero clipping & zero horizontal scroll).
      • Prime Thumb Zone & Touch Targets (min 44x44px): LULUS 100%.
      • Zero Stacked Modals & Bottom-Sheet Standard: LULUS 100%.
      • Visual Contrast & WCAG AA Accessibility: LULUS 100% (Clean White-Blue theme).
      • Build Check: Exit code 0 (pos_apps/client & pos_apps/server).

[2026-09-29] OPTIMALISASI UX SMARTPHONE PORTRAIT 6,8 INCI (HALAMAN OWNER & SUPERADMIN SAAS PORTAL)
  ├── Bagian 1: Backoffice Merchant Owner:
  │   - BillingTokensView.tsx: Header tombol w-full sm:w-auto, Hybrid Invoice Table/Card View (hidden md:block & block md:hidden), Modal Top-Up & Invoice Detail menjadi bottom-sheet dengan sticky action footer.
  │   - OutletsView.tsx & SupervisorFeesModal.tsx: Tombol tambah outlet responsif, Modal Kelola Toko & Biaya Supervisor menjadi bottom-sheet dialogs yang nyaman disentuh satu tangan.
  │   - UsersView.tsx: Header staf responsif, Hybrid Staff Table/Card View menampilkan avatar, PIN status badge, hak petty cash out, dan tombol aksi ubah/hapus.
  └── Bagian 2: Superadmin Platform SaaS Portal (SuperadminDashboardPage.tsx):
      - Horizontal Scrollable Carousel Navigation (Merchants, Paket, Billing, Staff Platform, Promo B2B) dengan no-scrollbar dan sticky UX.
      - Hybrid Merchant View: Desktop Table (hidden lg:block) & Mobile Merchant Cards (block lg:hidden) dengan kuota token bar, accordion gerai fisik inline tanpa popup bertumpuk, email/phone, serta toolbar aksi lengkap (Setujui/Tolak, Inspeksi Impersonate, Top-Up, Reset Password, Freeze).
      - TablePagination Kanonikal terintegrasi mulus di kedua breakpoint.

[2026-09-29] AUDIT & PERBAIKAN STABILITAS KASIR HANDHELD / MOBILE POS TERMINAL
  ├── 1. Pencegahan Keyboard Virtual Pop-up Otomatis (PaymentModal.tsx):
  │   - Menghilangkan autoFocus paksa pada input tunai saat modal pembayaran dibuka di perangkat mobile.
  │   - Mencegah keyboard software menutupi tombol bayar & nominal pas, menjaga ruang pandang layar ponsel tetap optimal.
  ├── 2. Stabilisasi Alur Tahan Pesanan (Hold Order Flow):
  │   - Penanganan rincian biaya on-demand packaging, promosi aktif, serta pemulihan keranjang kasir (pull order) yang presisi.
  │   - Integrasi notifikasi kanonikal dialog.toast dan dialog.alert saat penahanan antrean berhasil atau gagal.
  ├── 3. Resolusi Tombol "Kirim Dapur" pada Tampilan Handheld (PosMobileView.tsx & PosTerminalView.tsx):
  │   - Masalah: Drawer keranjang tertutup seketika dan tidak ada feedback visual karena scanMessage hanya di-render di desktop jika nomor meja/nama pelanggan belum diisi.
  │   - Solusi: Drawer tetap dibuka, pemilih meja otomatis digelar (tablePickerOpen = true), dan modal dialog.alert muncul memandu kasir memilih meja dalam 1 sentuhan.
  │   - Feedback Sukses/Error: Penyelarasan notifikasi simpan tagihan meja ke dialog.toast (sukses) dan dialog.alert (peringatan/error).
  └── 4. Relaksasi Validasi Zod Backend (order.controller.ts):
      - Relaksasi openTabSchema untuk field customerId, shiftId, dan outletId menjadi .optional().nullable() untuk mencegah penolakan HTTP 400 saat dikirim string kosong atau ID non-UUID dari antarmuka web/mobile.
===============================================================
```

---

### 4. DETAIL DESKRIPSI EPIC RENCANA PENGEMBANGAN (EPIC-06 s.d EPIC-11)

#### ☕ EPIC-06: F&B Multi-Vertical Engine (Recipes / BOM, Modifiers & Kitchen)
- **Tujuan**: Memungkinkan kafe, restoran, dan gerai FnB menggunakan Well POS untuk memotong stok bahan baku mentah secara otomatis saat menu terjual.
- **Fitur Utama**:
  - `recipes` & `recipe_items`: Menghubungkan `ProductVariant` ke beberapa `InventoryItem` (misal: 1 Es Kopi Susu memotong 18gr Biji Kopi, 120ml Susu UHT, 1 Cup 16oz, 1 Straw).
  - `product_modifier_groups` & `product_modifiers`: Pilihan level gula (Normal, Less, No Sugar), jenis susu (Oatmilk +Rp 7.000), topping (Boba +Rp 4.000).
  - Waktu Pemotongan Stok Dinamis: Opsi potong stok saat order terkonfirmasi (*kitchen dispatch*) atau saat bayar kasir.
  - Tiket Pesanan Dapur: Cetak struk pesanan terpisah untuk Kitchen / Bar.

#### 🚚 EPIC-07: Supply Chain Logistics, Central Warehouse & Purchasing (PO)
- **Tujuan**: Mengelola rantai pasokan toko multi-cabang dari pembelian supplier hingga gudang pusat.
- **Fitur Utama**:
  - Purchase Order (PO): Buat PO ke supplier, cetak surat pesanan.
  - Goods Receiving: Input penerimaan barang fisik di gudang dengan validasi faktur supplier dan pembaruan `average_cost`.
  - Transfer Stok Antar-Outlet: Alur *Request ➔ Approval ➔ Dispatch ➔ Receive* dengan pencatatan mutasi otomatis di `inventory_ledgers`.
  - Batch & Lot Tracking: Pencatatan nomor batch dan tanggal kedaluwarsa (*expiry date*) untuk barang konsumsi/farmasi dengan alert dini.

#### 🎁 EPIC-08: CRM, Customer Loyalty, Discounts & Promotion Engine
- **Tujuan**: Meningkatkan retensi pelanggan toko melalui program promosi dan keanggotaan modern.
- **Fitur Utama**:
  - Konfigurasi Granular Per-Outlet: Saklar aktif/nonaktif program loyalitas diatur per cabang toko (`outlets.loyalty_config`). Default nonaktif agar netral untuk tenant yang tidak menginginkan program poin.
  - Customer Database & Tiering: Profil pelanggan, riwayat belanja, akumulasi poin, badge tier keanggotaan (Bronze, Silver, Gold, Platinum), mutasi buku besar poin (`CustomerPointLedger`), dan form penyesuaian poin manual.
  - Tiers & Rewards POS: Slider/input penukaran poin langsung di kasir (1 Poin = Rp 100), terkunci otomatis jika outlet mematikan fitur loyalitas.
  - Promo Engine: Master voucher diskon persen/nominal, kuota pemakaian, batas minimal belanja, tombol saklar toggle cepat aktif/nonaktif, dan modal audit riwayat pemakaian voucher (`usages` log).
  - Struk Digital: Pengiriman otomatis invoice PDF struk via Email dan integrasi WhatsApp gateway dengan rincian poin diperoleh dan poin ditukarkan.

#### 📊 EPIC-09: Financial Analytics, Real-Time COGS/HPP & Business Intelligence
- **Tujuan**: Memberikan visibilitas finansial dan profitabilitas bisnis pemilik toko secara mendalam.
- **Fitur Utama**:
  - COGS / HPP Otomatis: Perhitungan margin keuntungan bersih per item menggunakan nilai persediaan rata-rata bergerak (*moving average cost*).
  - Laporan Kasir & Audit Selisih Kas: Rekapitulasi shift kasir (X/Z Report), pencatatan uang fisik vs sistem, grafik selisih harian.
  - Best-Seller & Dead-Stock Matrix: Analisis barang paling laris vs barang lambat laku (*slow-moving*).
  - Ekspor Multi-Format: Ekspor laporan laba rugi dan penjualan ke Excel (XLSX), CSV, dan PDF.

#### 🏢 EPIC-10: SaaS Management Platform, SuperAdmin Portal & Automated Billing
- **Tujuan**: Mengoperasikan Well POS sebagai bisnis SaaS komersial multi-tenant mandiri.
- **Fitur Utama**:
  - Portal SuperAdmin (`SuperadminDashboardPage.tsx`): Dasbor pemantauan seluruh tenant klien, MRR (Monthly Recurring Revenue), dan status lisensi toko.
  - Registrasi & Onboarding Mandiri Klien: Pendaftaran identitas Owner ter-decoupling (EPIC-14), persetujuan Superadmin (EPIC-18), dan inisialisasi toko perdana via Full-Screen Multi-Industry Wizard (EPIC-15).
  - Billing Gateway Integration: Integrasi otomatis pembayaran invoice langganan via Midtrans / Xendit (VA, QRIS, Kartu Kredit).
  - Siklus Lisensi Otomatis: Trial 14 Hari per unit toko ➔ Tagihan Invoice H-3 ➔ Grace Period 3 Hari ➔ Auto-Suspend toko jika menunggak.

#### 🛡️ EPIC-11: Production Hardening, PostgreSQL RLS, Redis & Cloudflare DevOps
- **Tujuan**: Menjamin skalabilitas tinggi, keamanan data mutlak, dan kesiapan rilis produksi global.
- **Fitur Utama**:
  - PostgreSQL Row-Level Security (RLS): Penerapan kebijakan RLS di level kernel database sebagai perlindungan berlapis terhadap kebocoran data antar-tenant.
  - Docker Production Multi-Stage: Containerization teroptimasi untuk server dan client dengan footprint memori minimal.
  - Redis Caching Layer: Caching katalog produk dan data lisensi tenant untuk respons sub-millisecond.
  - Reverse Proxy, SSL & CDN: Konfigurasi Nginx / Cloudflare dengan Web Application Firewall (WAF) dan rate limiting perlindungan DDoS.

#### 🧪 EPIC-12: Local Pre-Release Sandbox, Master Seeder & Interactive Simulators
- **Tujuan**: Menyediakan lingkungan lokal siap pakai tanpa friksi untuk pengujian UAT, demo, dan verifikasi pra-rilis tanpa ketergantungan perangkat keras fisik atau cloud berbayar.
- **Fitur Utama**:
  - Master Sandbox Seeder (`prisma/seed.sandbox.ts`): Provisioning multi-role (SuperAdmin, Owner, Kasir, Gudang, Supervisor), multi-cabang + gudang pusat, menu F&B/Ritel, resep BOM bertingkat, modifier, saldo stok, member loyalty, promo voucher, dan shift kasir aktif.
  - Interactive Frontend Simulators: Sandbox QRIS simulator dengan live countdown & instan callback, virtual cash drawer kick dengan visual open & audio relay tone, pratinjau struk WhatsApp & email.
  - One-Command Unified Runner & Reset: Skrip `./run-sandbox.sh` & `npm run dev:sandbox` dengan graceful process shutdown, serta reset instan via `npm run seed:sandbox`.
  - Verification & Playbook: Suite contract test otomatis `npm run test:sandbox` (5/5 lulus 100%) dan panduan manual `docs/SANDBOX_PLAYBOOK.md`.

#### 🎨 EPIC-13: Total Frontend Re-Architecture & Modern UI/UX Overhaul
- **Tujuan**: Membangun kembali seluruh antarmuka pengguna Well POS (Landing Page, SuperAdmin Control Tower, POS Terminal, dan Merchant Backoffice) agar memiliki standar visual berkelas dunia (*rich aesthetics*) dan selaras 100% dengan kapabilitas backend 18 tabel target.
- **Fitur Utama**:
  - Design System Modern (`src/components/ui`): Google Fonts *Plus Jakarta Sans/Inter*, palet warna harmonis Deep Navy & Emerald, micro-animations, glassmorphism.
  - World-Class SaaS Landing Page: Hero interaktif dengan live mockup, showcase fitur riil (BOM Recipes, Central Warehouse, Dynamic QRIS, Moving Avg COGS), kalkulator harga transparan, pendaftaran mandiri cepat.
  - Control Tower SuperAdmin: Executive KPI Cards (MRR, Tenant Status, Outlets), Tenant Lifecycle manager (Trial, Active, Suspended), 1-Click Impersonation audit, dan pemantau keamanan RLS.
  - Next-Gen Modular POS Terminal: Dekomposisi monolith >100KB menjadi sub-komponen terisolasi (Header, Kategori, Menu Card, Modifier Modal, Sidebar Cart, Multi-Tender Sheet, Z-Report Close Shift).
  - Modern Merchant Backoffice: Visual BOM recipe builder, mutasi stok multi-lokasi (toko vs gudang), laporan finansial HPP moving average, dan CRM loyalty points ledger.

#### 👤 EPIC-14: Decoupled Owner Identity, Split-Registration & SuperAdmin Approval
- **Tujuan**: Memisahkan siklus hidup pendaftaran Akun Pemilik Usaha (Owner) dari pembuatan Toko/Outlet.
- **Fitur Utama**:
  - Form Pendaftaran 5 Field: Nama Depan & Belakang, Nomor WhatsApp Indonesia (+62), Email, Password, dan Konfirmasi Password.
  - Approval Per-Owner di SuperAdmin: SuperAdmin menyetujui calon pemilik bisnis sebelum toko dibuat.
  - Login Guard: Owner berstatus `PENDING_APPROVAL` dicegah login hingga disetujui Superadmin.

#### 🏪 EPIC-15: Full-Screen Multi-Industry Store Creator Wizard
- **Tujuan**: Menyajikan antarmuka layar penuh (*Full-Screen Wizard*) bagi Owner yang baru masuk dan belum memiliki toko aktif (`storesCount === 0`).
- **Fitur Utama**:
  - Input Komprehensif: Nama Pedagang, Nama Toko, Alamat Fisik Toko.
  - Master Dataset Industri Hierarkis (Ritel, Restoran, Layanan) dengan 58 klasifikasi sub-industri resmi.
  - Live Searchable & Multi-Select Industry Chips.
  - Auto-Redirect ke Dashboard Backoffice setelah toko berhasil dibuat.

#### 📊 EPIC-16: Enterprise Owner Backoffice Redesign (Well POS Clean UI)
- **Tujuan**: Merombak total antarmuka Dasbor Owner Backoffice menyerupai standar enterprise modern bernuansa putih-biru yang bersih dan terstruktur.
- **Fitur Utama**:
  - Header Bar: Logo Well POS, Selektor Toko Aktif bertingkat (`F&B Kopi Senja Mandiri ⌵`), Bantuan, Bahasa, Notifikasi, Status Paket (*Free Trial*).
  - Sidebar Navigasi Bertingkat (Collapsible Accordion): Produk, Stok, Promosi, Pesanan, Laporan (Ringkasan Bisnis), Integrasi, Staf, Pengaturan Toko.
  - Halaman Utama Ringkasan Bisnis: Tab Data vs Grafik, Filter Operasional/Pembayaran/Produk, Date Range Picker, 3 Kartu KPI (Pembayaran Diterima, Volume Pesanan, Laba Kotor), dan 4 Panel Breakdown Analitis (Jenis Pesanan, Penjualan Produk, Diskon & Pembulatan, Metode Bayar).

#### 🏢 EPIC-17: Multi-Store Hierarchy & Per-Store SaaS Subscriptions
- **Tujuan**: Menghubungkan 1 Akun Pemilik ke banyak Toko (1-Owner-ke-N-Toko) dan memberikan wewenang SuperAdmin untuk mengelola paket SaaS granular per toko.
- **Fitur Utama**:
  - Struktur Hirarki Tree View di SuperAdmin: Owner A ➔ [Toko 1, Toko 2, Toko 3].
  - Manajemen Paket SaaS Granular Per Toko: Set paket Free / Starter / Pro / Enterprise mandiri per unit toko.
#### 🛡️ EPIC-18: SuperAdmin Onboarding Lifecycle, Store Governance & Triage Funnel
- **Tujuan**: Memberikan kontrol menyeluruh bagi tim operasional Superadmin dalam memverifikasi, menyetujui (*approve*), atau menolak (*reject*) pendaftar akun pemilik baru, memisahkan tata kelola akun pemilik dari unit toko fisik, serta mengelompokkan tenant berdasarkan tahapan aktivasi toko fisik (*onboarding funnel triage*).
- **Fitur Utama**:
  - Dual-Action Governance: Peninjauan profil pendaftar (`Eye`) dan tindakan persetujuan (`CheckCircle2`) atau penolakan (`XCircle`) sebelum akun dapat mengakses platform.
  - Bilah Filter Segmented Triage: Filter instan `Semua`, `Menunggu Approval`, `Belum Buat Toko`, `Toko Aktif`, dan `Dibekukan`.
  - Binary Owner Status & Store Cascade: Status akun owner murni `ACTIVE`/`INACTIVE`. Jika owner `INACTIVE`, semua gerai di bawahnya otomatis `INACTIVE`. Masa uji coba (*Trial*) dialokasikan murni pada level toko.
  - Granular Per-Store Management & Actions: Pembersihan kolom paket toko dari tabel utama, penambahan tooltip interaktif, pemindahan aksi Kelola Langganan & Mode Inspeksi ke level toko fisik, serta aksi baru *"Lihat Toko Owner"* (`Store`/`Building2`) untuk mengelola seluruh gerai milik owner.
  - Comprehensive Dummy Testbed: Dataset seed 5 variasi skenario status riil untuk pengujian menyeluruh.
  - Direct WhatsApp Verification: Integrasi pesan cepat untuk konfirmasi keabsahan nomor telepon calon pemilik.

#### 📱 EPIC-19: Buku Menu QR Digital, Self-Ordering Meja & Manajemen Meja Resto
- **Status**: **COMPLETED ✅**
- **Dokumen Teknis**: [`EPIC-19_QR_MENU_AND_CUSTOMER_SELF_ORDERING.md`](./EPIC-19_QR_MENU_AND_CUSTOMER_SELF_ORDERING.md)
- **Tujuan**: Memungkinkan tamu/pelanggan restoran memesan menu langsung dari meja makan menggunakan smartphone dengan memindai kode QR tanpa perlu memanggil pelayan.
- **Fitur Utama**:
  - `CustomerQrMenuView.tsx`: Antarmuka katalog menu publik tamu mobile-first, cart belanja interaktif, catatan instruksi menu, dan checkout pesanan self-ordering meja.
  - `QrTablesView.tsx`: Manajemen denah tata letak meja resto, status ketersediaan meja, dan mesin cetak tent card QR meja dengan URL publik otomatis.
  - `QrLiveOrdersView.tsx`: Papan monitor pesanan dapur live feed yang menerima tiket antrean pesanan tamu secara real-time.
  - `QrMenuSettingsView.tsx`: Kustomisasi branding resto (nama resto, logo, banner promo, dan instruksi alur kasir).

#### 🛵 EPIC-20: Kanal Penjualan Langsung & Mitra Online Delivery Terpadu
- **Status**: **COMPLETED ✅**
- **Dokumen Teknis**: [`EPIC-20_SALES_CHANNELS_AND_ONLINE_DELIVERY_PLATFORMS.md`](./EPIC-20_SALES_CHANNELS_AND_ONLINE_DELIVERY_PLATFORMS.md)
- **Tujuan**: Mengintegrasikan seluruh saluran penjualan toko fisik (Dine In, Take Away, Kurir Toko) dan agregator online (GoFood, GrabFood, ShopeeFood, Maxim) dalam satu antarmuka kasir dan pelaporan terpadu.
- **Fitur Utama**:
  - `SalesChannelsSettingsView.tsx`: Konfigurasi aktivasi kanal kustom per outlet toko fisik, penamaan kanal, dan penentuan grup kanal (OFFLINE_DIRECT vs ONLINE_DELIVERY).
  - Kasir POS Berbasis Konteks: Header POS memisahkan pil kanal langsung dan dropdown mitra online. Keranjang kasir secara kontekstual beralih dari pemilih meja (Dine In) ke kartu input ID Pesanan Driver Online (e.g. #GF-402).
  - Laporan Finansial Multi-Kanal: Analisis kontribusi omset per kanal penjualan pada `FinancialReportView` dan pemisahan transaksi di ekspor CSV.

#### 🎯 EPIC-21: Multi-Outlet Catalog Allocation, Scoped Menus & Dynamic Warehouse Backflush BOM Routing
- **Status**: **COMPLETED ✅ (Fase 1 s.d 4 Selesai 100%)**
- **Dokumen Teknis**: [`EPIC-21_MULTI_OUTLET_CATALOG_AND_WAREHOUSE_BOM.md`](./EPIC-21_MULTI_OUTLET_CATALOG_AND_WAREHOUSE_BOM.md)
- **Tujuan**: Memisahkan secara tegas Pengaturan Umum (Level Tenant / Master Pusat) dengan Pengaturan Khusus (Level Outlet Toko Aktif), mengalokasikan menu master secara spesifik per outlet, menyediakan mesin pemotongan bahan baku fleksibel (*Backflush*) ke gudang pasokan, serta antarmuka khusus mode gudang logistik.
- **Fitur Utama**:
  - **Fase 1 (Isolasi Menu & Kategori per Toko Aktif) - SELESAI ✅**:
    - Skema tabel relasi `outlet_products` (`outlet_id`, `product_id`, `is_available`, `price_override`).
    - Penyaringan scoped query `GET /api/products?outletId=...` sehingga saat toko aktif dipilih, daftar menu dan kategori yang muncul **hanya produk yang dialokasikan ke toko tersebut**.
    - Tombol *"Ambil dari Master Katalog"* di Backoffice untuk menghubungkan produk master tenant ke outlet tertentu (`AssignCatalogProductModal.tsx`).
  - **Fase 2 (Isolasi Bahan Baku & Resep BOM per Toko Aktif) - SELESAI ✅**:
    - Scoping `GET /api/recipes?outletId=...` menyaring resep dari menu yang aktif di gerai tersebut.
    - Scoping `GET /api/recipes/inventory-items?outletId=...` menyaring bahan baku resep dan saldo stok fisik toko vs saldo gudang pasokan pusat (`warehouseStock` & `warehouseName`).
    - Dropdown pemilihan *"Gudang Sumber Pasokan (Backflush Warehouse)"* di form outlet toko (`OutletsView.tsx`) dan badge pasokan pada kartu toko.
    - Dataset seeder Ura Corporation: Gudang Pusat (`WH-01`), 3 resep BOM lengkap, dan isolasi saldo stok bahan baku 3 toko.
  - **Fase 3 (Mesin Pemotongan Stok Fleksibel / Dynamic Warehouse Backflush) - SELESAI ✅**:
    - Eksekusi transaksi penjualan kasir di gerai toko (`sales.dual_write.service.ts`) secara otomatis memotong saldo bahan baku resep BOM langsung di Gudang Sumber Pasokan yang ditunjuk (`outlet.warehouseId`) dalam satu transaksi database atomik (ACID).
    - Mutasi kartu stok tercatat rapi di gudang dengan catatan audit sumber pesanan toko kasir.
  - **Fase 4 (Multi-Warehouse Visibility & Stock Allocation Engine) - SELESAI ✅**:
    - Tab "Kelola Gudang & Stok Master" di `InventoryView.tsx` menampilkan statistik persediaan bahan baku dan produk retail per gudang secara live.
    - Dialog *"📋 Pantau & Alokasikan Stok Bahan Baku"* dan mesin transfer antar-lokasi (`StockTransferModal.tsx`) dengan row-level locking `FOR UPDATE`.
  - **Mode Khusus Gudang (*Dedicated Warehouse Mode*) - SELESAI ✅**:
    - Otomasi penyederhanaan antarmuka Backoffice saat Owner memilih Gudang: menyembunyikan modul kasir/toko dan menyajikan 4 domain logistik murni (Persediaan & Stok, Pengadaan & Vendor, Formula Resep, Operasional Gudang).
    - Header dinamis dengan tombol aksi *"🏪 Kembali ke Toko"* dan auto-redirect tab kasir ke tab inventori.
  - **Pemisahan Fungsional Laporan Penjualan vs Analisis Menu & HPP - SELESAI ✅**:
    - Pemisahan tegas antara Laporan Penjualan Finansial (`FinancialReportView.tsx` - omset, tunai/QRIS, PB1, fee kanal) dan Analisis Performa Menu/HPP (`ProductAnalyticsView.tsx` - Pareto top 10, margin resep BOM, COGS modal bahan, slow-moving).

#### 🔢 EPIC-22: Calling Queue Numbering & Flexible Store Toggle
- **Tujuan**: Menghadirkan nomor antrean panggilan cepat lisan (`#01`, `#02`) untuk pesanan kasir F&B dengan reset harian otomatis per outlet dan sakelar fleksibel di Backoffice.
- **Status**: **COMPLETED ✅**
- **Dokumentasi**: [`docs/epics/EPIC-22_CALLING_QUEUE_NUMBERING.md`](./EPIC-22_CALLING_QUEUE_NUMBERING.md)

#### 💳 EPIC-23: Pakasir.com Payment Gateway Integration (Direct QRIS & Webhook)
- **Tujuan**: Integrasi gateway pembayaran Pakasir API v2 untuk aktivasi pendaftaran awal tenant Rp 99.000 + 100 token gratis, top-up kuota token pay-as-you-go dinamis Rp 69/token, minimal 250 token, modal QRIS dinamis, webhook verification, dan sakelar QRIS Superadmin.
- **Status**: **COMPLETED ✅**
- **Dokumentasi**: [`docs/epics/EPIC-23_PAKASIR_PAYMENT_GATEWAY_INTEGRATION.md`](./EPIC-23_PAKASIR_PAYMENT_GATEWAY_INTEGRATION.md)

#### 🚫 EPIC-24: Transaction Void & Supervisor/Owner PIN Approval Engine
- **Tujuan**: Pembatalan resmi transaksi kasir (Full & Partial Item Void) dengan otorisasi PIN 6-digit Supervisor/Owner, pemulihan stok bahan & ritel atomik (movement_type VOID), slip fisik bukti void dengan signature block Kasir & Spv untuk laci kasir, pencatatan audit retur refunds, isolasi omset kas shift, dan pemulihan kuota token SaaS.
- **Status**: **COMPLETED ✅**
- **Dokumentasi**: [`docs/epics/EPIC-24_TRANSACTION_VOID_AND_SUPERVISOR_APPROVAL.md`](./EPIC-24_TRANSACTION_VOID_AND_SUPERVISOR_APPROVAL.md)

---

### 5. STRATEGI PENYELESAIAN PRODUK (EXECUTION PHASING)

1. **Fondasi Arsitektur & Database**: **EPIC-01** s.d **EPIC-04** (Domain Model, ADR, Zero-Downtime Migration, Cutover) ✅
2. **Mesin Bisnis & Logistik Inti**: **EPIC-05** s.d **EPIC-09** (POS, F&B Recipes, Supply Chain, CRM Loyalty, Financial COGS) ✅
3. **SaaS Platform & Hardening DevOps**: **EPIC-10** s.d **EPIC-12** (SuperAdmin, Hardening RLS, Local Sandbox & Simulators) ✅
4. **Fase Pengalaman Pengguna Berkelas Dunia**: **EPIC-13** (Total Frontend Re-Architecture & Modern UI/UX Overhaul) ✅
5. **Arsitektur Multi-Toko & Onboarding Enterprise**: **EPIC-14** s.d **EPIC-18** (Decoupled Owner, Full-Screen Industry Wizard, Enterprise Backoffice, Per-Store Subscriptions, Superadmin Governance & Triage) ✅
6. **Buku Menu QR Digital & Self-Ordering Meja**: **EPIC-19** (COMPLETED & HARDENED ✅)
7. **Sales Channels & Online Delivery Platforms**: **EPIC-20** (COMPLETED ✅)
8. **Multi-Outlet Menu Allocation, Warehouse Routing & SaaS Token Billing**: **EPIC-21** (COMPLETED ✅)
9. **Calling Queue Numbering & Format Struk**: **EPIC-22** (COMPLETED ✅)
10. **Pakasir Payment Gateway & SaaS Pay-As-You-Go Billing**: **EPIC-23** (COMPLETED ✅)
11. **Transaction Void & Supervisor/Owner PIN Approval Engine**: **EPIC-24** (COMPLETED ✅)

---

### 6. CANONICAL PRODUCT RULES, DESIGN SYSTEM & OPERATIONAL MEMORY (GOLDEN DIRECTIVES)
> **PANDUAN MUTLAK UNTUK AI ASSISTANT & DEVELOPER DI SELURUH CONVERSATION BARU**:
> Setiap kali melanjutkan pekerjaan atau menerima perintah pada conversation baru, jadikan aturan-aturan di bawah ini sebagai prinsip arsitektur dan standar desain mutlak yang tidak boleh dilanggar:

#### 📱 RULE 1: Standarisasi Input Nomor HP / WhatsApp (`WhatsAppInput`)
1. **Wajib Menggunakan Komponen Kanonikal**:
   - Seluruh input nomor HP / WhatsApp di platform (pendaftaran owner, wizard buat toko baru, tambah cabang toko, profil pelanggan CRM, dan modal onboarding) **WAJIB menggunakan `<WhatsAppInput />`** dari `src/components/ui/WhatsAppInput.tsx`.
   - **Dilarang keras** menggunakan `<input type="tel">` manual tanpa standar platform.
2. **Format Standar Kanonikal**:
   - Format penyimpanan dan pengiriman data: **`+628...`** (angka saja setelah tanda plus, maksimal 13 digit setelah +62).
   - Sanitasi otomatis: Semua karakter selain angka (spasi, tanda hubung, huruf) otomatis dibersihkan. Awalan `08...` atau `628...` otomatis distandardisasi menjadi `+628...`.
3. **Tampilan Visual Seragam**:
   - Fixed badge bendera **`🇮🇩 +62`** di sisi kiri field.
   - Atribut input: `type="tel" inputMode="numeric" maxLength={13}`.
   - Helper text standar: *"Ketik angka setelah +62 (diawali angka 8, maksimal 13 digit)"* atau konteks spesifik toko.

#### 🎨 RULE 2: Standarisasi Desain & Tema (Well POS Clean White-Blue)
1. **Palet Warna Putih-Biru (Modern Clean SaaS)**:
   - Seluruh antarmuka Backoffice Merchant, Landing Page, dan Setup Wizard **WAJIB menggunakan palet Putih-Biru**.
   - **Latar Belakang**: `bg-slate-50`.
   - **Kartu & Kontainer**: `bg-white`, border halus `border-slate-200`, bayangan lembut `shadow-xl shadow-slate-200/60` atau `shadow-sm`.
   - **Tipografi**: Kontras tinggi, teks utama `text-slate-900`, teks pendukung `text-slate-600`, teks keterangan `text-slate-500`.
   - **Aksen & Branding**: Biru modern (`bg-blue-600 hover:bg-blue-700`, `text-blue-600`, focus ring `focus:ring-blue-100 focus:border-blue-600`).
   - **Badges & Tags**: `bg-blue-50 text-blue-700 border border-blue-200`.
   - **Larangan Dark Mode**: Dilarang menggunakan tema gelap pekat (`bg-slate-950` / `bg-black`) untuk alur merchant, wizard, dan backoffice, kecuali jika secara eksplisit diminta untuk layar Terminal Kasir POS (`PosTerminalView`).
2. **Proporsionalitas Elemen & Tombol Aksi**:
   - **Dilarang membuat tombol raksasa** (*no oversized full-width buttons*) yang mendominasi tinggi layar secara canggung.
   - Tombol aksi utama (seperti *Buka Dashboard Operasional*, *Simpan Cabang*) harus berukuran proporsional (`px-6 py-2.5 sm:py-3`, `rounded-xl`, `text-sm font-semibold`, dengan bayangan proporsional).

#### 🏢 RULE 3: Decoupled Multi-Store Hierarchy & Siklus Hidup Akun Owner vs Toko Fisik
1. **Hierarki 1-ke-N (1-Owner-ke-N-Toko)**:
   - 1 Akun Pemilik Usaha (Owner) menaungi 1 Tenant, dan 1 Tenant dapat memiliki **banyak Toko Fisik / Gerai (`Outlet`)**.
2. **Pendaftaran Mandiri Murni (Decoupled Split Registration)**:
   - Pendaftaran awal di Landing Page murni mendaftarkan akun Owner (`User` dengan `role: ADMIN`) dan Tenant berstatus `PENDING`.
   - **0 toko fisik dibuat saat registrasi**. Calon owner tidak boleh dibebani pembuatan toko sebelum disetujui.
   - Owner dicegah masuk (`HTTP 403`) hingga akun disetujui Superadmin.
3. **Pemisahan Status Owner vs Status Toko**:
   - **Status Akun Owner**: Murni biner (`ACTIVE` / `INACTIVE`) + status onboarding `PENDING`.
   - **Masa Uji Coba (Trial 14 Hari)**: Murni dialokasikan pada level unit toko fisik (`Outlet`), **BUKAN** pada level akun owner.
   - **Aturan Kaskade Nonaktif**: Jika status akun owner disetel menjadi `INACTIVE` atau `SUSPENDED`, maka **SELURUH toko fisik di bawah owner tersebut otomatis nonaktif (`isActive = false`)** dan tidak dapat bertransaksi.
4. **Metrik "Toko Fisik Aktif"**:
   - Di backend (`platform.controller.ts`) dan frontend, kartu metrik Toko Fisik Aktif murni menghitung toko fisik yang `isActive: true` **DAN** parent tenant-nya berstatus aktif (`ACTIVE` atau `TRIAL`).

#### 🚫 RULE 4: Zero Stacked Modals (Anti-Popup Bertumpuk) & Inline Accordion Sub-Baris
1. **Larangan Keras Modal Bertumpuk**:
   - Dilarang keras membuka modal popup di atas modal popup lain (*stacked modals with dual backdrops*).
2. **Inline Expandable Row (Sub-Baris Tabel)**:
   - Aksi "Lihat Toko Fisik" di Superadmin ditampilkan secara **Inline Expandable Row (Accordion Sub-Baris)** langsung di bawah baris owner bersangkutan pada tabel.
   - Menampilkan seluruh gerai fisik lengkap dengan badge paket (`⭐ PRO`, `STARTER`, `FREE`), badge status (`AKTIF`, `INAKTIF`, `TRIAL 14H`), kategori industri, dan alamat.
3. **Aksi Kelola Langganan Per Toko**:
   - Tombol **⚡ Kelola Langganan Toko** ditaruh di level unit gerai toko fisik (bukan level owner).
   - Membuka Modal Langganan secara tunggal (*single modal*) bebas tumpukan, dengan judul toko yang jelas.
4. **Pembersihan Dashboard Superadmin**:
   - Kolom "Paket Toko" dihapus dari tabel utama owner.
   - Banner teknis RLS (*PostgreSQL Multi-Tenant Security & RLS Isolation*) dihapus dari dasbor operasional Superadmin agar antarmuka bersih dan fokus.
   - Seluruh ikon aksi operasional wajib memiliki tooltip penjelas.

#### 🧙 RULE 5: Wizard Layar Penuh Toko Pertama (`FullScreenStoreWizard`)
1. **Pemicu Tampilan**:
   - Otomatis aktif saat akun owner yang disetujui login pertama kali dan sistem mendeteksi `outlets.length === 0`.
2. **5 Input Standar**:
   1. **Nama Pedagang / Merchant**: Nama Badan Usaha, PT, CV, atau Brand Utama.
   2. **Nama Toko / Outlet Pertama**: Nama gerai fisik pertama yang tertera di struk.
   3. **No. HP / WhatsApp Toko**: Menggunakan `<WhatsAppInput />` standar `🇮🇩 +62`.
   4. **Alamat Lengkap Toko**: Lokasi operasional gerai fisik.
   5. **Tipe Industri Usaha**: Searchable multi-select dengan 58 sub-industri resmi dari 3 sektor (Ritel, Restoran, Layanan).
3. **Hasil Pembuatan**:
   - Memanggil `POST /api/saas/stores/create-initial`.
   - Mengisi otomatis `businessVertical`, membuat gudang default (`StorageLocation`), menghubungkan owner ke outlet, dan mengarahkan ke dashboard backoffice.

#### 🧪 RULE 6: Master Testbed Skenario Data (5 Skenario UAT Mandiri)
Disediakan melalui seeder `npm run db:seed:testbed` (`pos_apps/server/prisma/seed.testbed_statuses.ts`):
1. **Budi Santoso** (`budi.santoso@kulinerjogja.com`): `PENDING APPROVAL`, 0 Toko.
2. **Siti Rahmawati** (`siti.rahmawati@fashionboutique.id`): `ACTIVE`, 0 Toko (Siap menguji FullScreenStoreWizard).
3. **Dendy Aditya** (`dendy@kopisenja.com`): `ACTIVE`, 1 Toko Trial Aktif (Kopi Senja).
4. **Hendrawan Pratama** (`hendra@pratamagroup.id`): `ACTIVE`, 3 Toko Aktif Multi-Store (Pratama Mart, Pratama Bakery, Pratama Vape).
5. **Reza Mahendra** (`reza@gadgetzone.com`): `INACTIVE`, 2 Toko Nonaktif Kaskade (GadgetZone).
- **Kredensial Superadmin**: `admin@wellpos.com` / `SuperAdmin123!`.
- **Kredensial Owner/Staff**: `<email>` / `Password123!`.

#### 🌐 RULE 7: Alokasi Port & Health Check
- **Backend Express REST API**: Port `5001` (`/api/health`).
- **Frontend React Vite SPA**: Port `5173`.
- **PostgreSQL Database**: Port `5432` (`pos_db`).

#### 💰 RULE 8: Format Angka & Mata Uang Otomatis (Live Thousands Separator `1.000`)
1. **Standar Penulisan Angka & Mata Uang Indonesia**:
   - **Pemisah ribuan menggunakan Titik (`.`)**, BUKAN koma (`,`).
   - **Pemisah desimal menggunakan Koma (`,`)**, BUKAN titik.
2. **Perilaku Live Auto-Format**:
   - Pada seluruh kolom input nominal uang, harga produk, modal kasir (*starting cash*), nominal diskon, dan tender pembayaran, angka **wajib terformat secara otomatis saat diketik (*live typing*)**:
     - Pengguna mengetik `1000` ➔ Otomatis berubah menjadi `1.000`
     - Pengguna mengetik `50000` ➔ Otomatis berubah menjadi `50.000`
     - Pengguna mengetik `1250000` ➔ Otomatis berubah menjadi `1.250.000`
3. **Komponen & Utilitas Kanonikal**:
   - **Komponen Input Wajib**: `<CurrencyInput />` (`src/components/ui/CurrencyInput.tsx`). Dilengkapi prefix `Rp`, sanitasi numerik otomatis, dan pemisah ribuan dinamis.
   - **Utilitas Resmi**: `formatThousands()`, `formatRupiah()`, dan `parseFormattedNumber()` dari `src/utils/currency.ts`.

---

<a id="upcoming-roadmap"></a>
### 7. TAHAPAN PENGEMBANGAN BERIKUTNYA (NEXT DEVELOPMENT PHASES & ADJUSTMENT ROADMAP)

Berdasarkan fondasi arsitektur dan aturan desain yang telah dikunci di atas, berikut adalah tahapan konkret untuk pengerjaan/adjustment berikutnya:

```text
================================================================================
                    WELL POS NEXT ADJUSTMENT & DEVELOPMENT PIPELINE
================================================================================
PHASE 1: PERVASIVE CURRENCY INPUT ADOPTION (UI/UX HARDENING) ➔ COMPLETED ✅
  ├── Mengganti seluruh input harga/nominal di modal kasir & backoffice menggunakan <CurrencyInput />:
  │   ├── Form Tambah/Edit Produk (HPP & Harga Jual Standar) [ProductModal.tsx] ✅
  │   ├── Opsi Varian & Modifier Price Delta (+Rp) [ProductModal.tsx] ✅
  │   ├── Modal Mulai Shift Kasir (Starting Cash Float) [StartShiftModal.tsx] ✅
  │   ├── Modal Tutup Shift Kasir (Hitungan Fisik Laci Kasir / Actual Cash) [CloseShiftModal.tsx] ✅
  │   ├── Input Tender Pembayaran Kasir POS (Uang Tunai Diterima) [PaymentModal.tsx] ✅
  │   ├── Input Split Tender Kasir (Porsi Tunai & Uang Fisik Diterima) [PaymentModal.tsx] ✅
  │   ├── Modal Tarif Biaya Tetap / Packaging On-Demand [SupervisorFeesModal.tsx] ✅
  │   └── Modal Pembaruan HPP pada Riwayat Stok Masuk / PO [StockMovementModal.tsx] ✅
  └── Seluruh input angka mata uang otomatis berpemisah ribuan titik ("1.000") saat diketik live.

PHASE 1.5: F&B BACKOFFICE NAVIGATION & INFORMATION ARCHITECTURE (MEKARI POS MODEL) ➔ COMPLETED ✅
  ├── Menyelaraskan 9 kelompok modul F&B di BackofficeLayout.tsx & DashboardPage.tsx:
  │   ├── 1. Ringkasan Bisnis (Dashboard KPI)
  │   ├── 2. Menu & Produk (Daftar Menu, Kategori, Modifiers, Resep BOM)
  │   ├── 3. Buku Menu QR (Meja & Cetak QR, Pengaturan Menu, Pesanan Masuk)
  │   ├── 4. Bahan Baku & Stok (Stok Mentah, Mutasi Stok, Pemasok)
  │   ├── 5. Riwayat Transaksi (Daftar Order Kasir)
  │   ├── 6. Laporan & Keuangan (Laporan Penjualan, Shift X/Z, Analisa HPP)
  │   ├── 7. Promosi & Diskon (Diskon Kasir & Voucher)
  │   ├── 8. Manajemen Staf (Kelola Staf, Akses & Peran Granular RBAC)
  │   └── 9. Pengaturan Resto & Outlet (Struk Kasir, Pajak PB1, Profil Cabang)
  └── Implementasi ModulePlaceholderView.tsx (guided clean state, zero dummy alerts).

PHASE 1.6: MANAJEMEN STAF & AKSES PERAN GRANULAR RBAC (MEKARI POS MODEL) ➔ COMPLETED ✅
  ├── Backend Multi-Tenant Role Engine (role.service.ts & user.controller.ts):
  │   ├── Role CRUD terisolasi per-tenant dengan fallback peran sistem kanonikal (Admin, Supervisor, Kasir, Gudang, Barista, Waiter)
  │   ├── Dukungan userCode 5-digit angka pada model User (Prisma user_code) & PIN 4-6 digit cepat
  │   └── Endpoint RESTful: GET/POST/PUT/DELETE /api/users/roles & integrasi userCode di /api/users
  ├── Frontend Granular Role Management (StaffRolesView.tsx):
  │   ├── Full-Page Form Tambah/Ubah Peran (Zero Stacked Modals Policy)
  │   ├── Tree checklist fungsional multi-channel (WEB, POS, HANDHELD, IOS) dengan tombol "Pilih Semua"
  │   └── Batasan Izin Bisnis: Diskon Pesanan & Produk Didiskon (Maksimal % dan batas nominal Rp dengan <CurrencyInput />)
  └── Frontend Form Staf Terintegrasi (UsersView.tsx):
      ├── Full-Page Form Tambah/Ubah Staf dengan Breadcrumb trail `Staf / Tambah Staf`
      ├── Generator ID Staf otomatis 5-digit acak dengan tombol `[Buat]`
      ├── Pilihan Akun Login (Email), Kata Sandi, PIN 4-6 digit cepat, Dropdown Peran + tombol `+ Tambah`
      └── Pengaturan Lanjutan: Penugasan Cabang / Outlet toko dan Switch Status Akun Aktif/Nonaktif.

PHASE 1.7: MODUL BUKU MENU QR & SELF-ORDERING MEJA (MEKARI POS MODEL) ➔ COMPLETED ✅
  ├── Backend Multi-Tenant QR Engine (qr_menu.service.ts, qr_menu.controller.ts, qr_menu.routes.ts):
  │   ├── Penyimpanan data meja & pengaturan QR terisolasi per tenant/outlet (auto-seed 5 meja awal)
  │   ├── Endpoint publik tamu (/api/qr-menu/public/:outletId & /api/qr-menu/public/order)
  │   ├── Otomasi order submission ke tabel orders & order_items dengan channel = 'QR_MENU' & payment_status = 'UNPAID'
  │   └── Live kitchen orders feed dengan transisi alur dapur (CONFIRMED -> IN_PROGRESS -> READY -> COMPLETED)
  ├── Frontend Backoffice & Tent Card Engine (pos_apps/client):
  │   ├── Meja & Cetak QR (QrTablesView.tsx): Grid kartu meja, filter zona, modal tent card akrilik, dan cetak massal A4
  │   ├── Pengaturan Buku Menu QR (QrMenuSettingsView.tsx): Switch self-ordering, ucapan sambutan, info Wi-Fi, dan waktu saji
  │   └── Feed Pesanan Masuk (QrLiveOrdersView.tsx): Auto-refresh 10s, filter status pesanan, rincian menu, dan pintasan bayar kasir
  └── Frontend Publik Mobile-First Tamu Resto (CustomerQrMenuView.tsx):
      ├── Rute hash mandiri (#menu?outletId=...&table=...) tanpa login staf
      ├── Katalog produk, filter kategori, pemilihan varian produk, kuantitas & catatan khusus koki
      └── Floating cart bar, checkout sheet, dan layar sukses transaksi instruksi bayar di kasir.

PHASE 1.8: PEMURNIAN MODUL MENU & PRODUK F&B (MEKARI POS MODEL) ➔ COMPLETED ✅
  ├── Backend F&B Catalog & Recipe Engine (pos_apps/server):
  │   ├── Auto-seed bahan baku mentah standar kafe/resto (RAW-COFFEE-01, RAW-MILK-01, RAW-OATMILK-01, PKG-CUP-16, dll)
  │   ├── Endpoint GET /api/recipes/inventory-items untuk selector takaran racikan bahan baku mentah
  │   ├── CRUD Kategori Menu terisolasi per tenant (category.controller.ts)
  │   └── CRUD Modifier Groups, Items, dan Product Links (modifier.controller.ts)
  ├── Frontend Backoffice F&B Pages (pos_apps/client):
  │   ├── Kategori Menu (CategoriesView.tsx): In-page form, slug otomatis, KPI cards, dan sinkronisasi kasir/QR menu
  │   ├── Modifier & Topping (ModifiersView.tsx): Opsi Single/Multiple, required flag, baris dinamis opsi via <CurrencyInput />
  │   └── Resep & Bahan Baku BOM (RecipesView.tsx): Bill of Materials takaran bahan, live HPP calculator, perbandingan margin laba kotor
  └── Integrasi Dashboard Navigation (DashboardPage.tsx):
      └── Mengganti ModulePlaceholderView pada tab categories, modifiers, recipes dengan antarmuka produksi fungsional.

PHASE 1.9: AUDIT, ELIMINASI KONTRADIKSI & INTEGRASI MEJA QR KE KASIR ➔ COMPLETED ✅
  ├── Relational Modifier Binding & Read Adapter (pos_apps/server):
  │   ├── Join relasional product_modifier_groups pada getProducts & getProductById di catalog.read_adapter.ts
  │   └── DTO produk otomatis melampirkan modifiers terpusat beserta opsi harga varian
  ├── Eliminasi Kontradiksi Modal Produk & Kategori (pos_apps/client):
  │   ├── ProductModal.tsx: Mengganti builder modifier JSON lokal dengan multi-select grup modifier relasional terpusat via api.linkProductModifiers
  │   ├── Segmented toggle eksplisit "Menu Olahan Dapur F&B (Made-to-Order)" vs "Barang Ritel Kemasan Fisik"
  │   └── Zero Stacked Modals: Menghapus CategoryModal popup di ProductsView.tsx dan menghubungkan tombol langsung ke tab CategoriesView
  ├── Integrasi Meja & Tarik Order QR di Kasir POS (pos_apps/client):
  │   ├── Penambahan channel resmi QR_MENU pada OrderChannel & PosHeader
  │   ├── Selector Nomor Meja otomatis dari api.getQrTables saat kasir memilih channel Dine In / QR Menu
  │   ├── Tombol live badge "Pesanan QR Meja (N)" di topbar kasir untuk melihat pesanan meja pending
  │   └── 1-klik Tarik Pesanan Meja QR (Pull to Cashier) langsung memuat item pesanan, nomor meja, dan nama pelanggan ke keranjang kasir untuk pelunasan pembayaran
  └── Integrasi Dashboard Navigation (DashboardPage.tsx):
      └── Handler onOpenInPos dari QrLiveOrdersView langsung mengarahkan dan mengisi keranjang POS kasir.

PHASE 1.10: SINKRONISASI STOK BAHAN BAKU F&B & ELIMINASI AMBIL DARI KATALOG ➔ COMPLETED ✅
  ├── Eliminasi Kontradiksi Katalog Produk (pos_apps/client):
  │   ├── Menghapus tombol & modal usang "Ambil dari Katalog" di ProductsView.tsx untuk menghilangkan kebingungan merchant.
  │   └── Produk langsung dikelola mandiri atau dimuat otomatis dari seed industri onboarding toko.
  ├── Sinkronisasi Bahan Baku F&B di Inventory & Resep (pos_apps/server & client):
  │   ├── Penghitungan saldo stok fisik per outlet pada master bahan baku (getInventoryItemsForRecipe) via inventory_balances.
  │   ├── Endpoint pendaftaran bahan baku baru (POST /api/recipes/inventory-items) dengan auto-generate kode RAW-XXX & saldo awal.
  │   ├── Adaptor mutasi stok (recordStockIn & recordStockAdjustment) dan kartu mutasi (read_adapters/inventory.read_adapter.ts) kini mendukung pencatatan bahan baku mentah (inventoryItemId) dengan label PURCHASE / OPNAME_ADJUSTMENT.
  │   ├── Antarmuka Tab Navigasi Terpadu di InventoryView.tsx: Tab "Bahan Baku Mentah F&B (8 bahan mentah)", Tab "Produk Jadi Retail", dan Tab "Kelola Gudang".
  │   └── Komponen CreateIngredientModal.tsx & penyelarasan StockMovementModal.tsx dengan input rupiah terstandarisasi (<CurrencyInput />).

PHASE 1.11: HARDENING OTORISASI ROLE OWNER & STOK PRODUK OLAHAN COMPOSITE F&B ➔ COMPLETED ✅
  ├── Otorisasi Backoffice Role OWNER (pos_apps/client):
  │   ├── Penambahan enum OWNER pada UserRole (types/auth.ts) dan pemetaan ROLE_TABS di DashboardPage.tsx.
  │   ├── Mengeliminasi bug auto-redirect kuncian #pos sehingga Owner dapat leluasa membuka seluruh 16 modul Backoffice.
  │   └── Penyetelan default tab awal login Owner ke 'overview' (Ringkasan Bisnis).
  ├── Resolusi Stok Produk Olahan Dapur F&B Composite (pos_apps/server & client):
  │   ├── Penambahan field productType & hasStock pada DTO read-adapter katalog backend (catalog.read_adapter.ts).
  │   ├── Query produk olahan (COMPOSITE / memiliki resep) secara cerdas disetel Made-to-Order (stock: 99999, hasStock: false) tanpa terblokir stok ritel 0.
  │   ├── ProductCatalogGrid.tsx menampilkan badge hijau "Tersedia (Olahan F&B)" dan PosTerminalView.tsx mengizinkan penambahan item ke keranjang.
  │   └── Sinkronisasi panduan manual operasional sandbox di docs/SANDBOX_PLAYBOOK.md (Bahan Baku & Stok, Resep BOM, dan Pairing Kasir ID Toko + PIN).

PHASE 1.12: MODUL PRODUK JADI, PRATINJAU GUEST QR MENU & ELIMINASI TOTAL PLACEHOLDER TAHAP 4 ➔ COMPLETED ✅
  ├── Fase 1: Perbaikan Tabel & Mutasi "Produk Jadi (Retail)" di InventoryView.tsx:
  │   ├── Sub-view switcher pada tab Produk Jadi (Katalog Inventori vs Kartu Riwayat Mutasi).
  │   ├── Tabel simetris berdesain rapi: Thumbnail produk, SKU/Barcode, Kategori, Stok Fisik, Status (Aman/Menipis/Habis), HPP rata-rata, Nilai Aset Stok, Harga Jual, dan Aksi Cepat (+ Masuk, - Rusak, Opname).
  │   └── Kalkulasi nilai aset stok non-negatif terhindar dari NaN/minus.
  ├── Fase 2: Pembukaan Pratinjau "Tampilan Menu Tamu" (Customer Self-Ordering QR):
  │   ├── Sub-menu mandiri 'qr_guest_menu' di BackofficeLayout & DashboardPage dengan simulator ponsel interaktif serta opsi buka tab baru.
  │   ├── Tombol cepat "Pratinjau Menu Tamu" pada header meja dan "Buka Menu" pada tiap kartu meja di QrTablesView.tsx.
  │   └── Top notification banner "Mode Pratinjau Toko [Kembali ke Backoffice]" pada CustomerQrMenuView.tsx agar merchant tidak tersesat.
  ├── Fase 3: Penggantian Penuh Seluruh Placeholder "Tahap 4" dengan Halaman Aktif Fungsional:
  │   ├── Riwayat Mutasi Stok (stock_movements): Dialihkan langsung ke InventoryView dengan tab Produk Jadi dan sub-view Kartu Mutasi aktif.
  │   ├── Manajemen Pemasok (SuppliersView.tsx): CRUD vendor/pemasok bahan baku lengkap dengan kontak WhatsApp, termin pembayaran, filter status, dan modal konfirmasi hapus.
  │   ├── Program Promosi & Kupon (PromotionsView.tsx): CRUD voucher diskon persentase/nominal, kuota pemakaian, minimum transaksi, copy code button, dan validasi periode aktif.
  │   ├── Menu Terlaris & Analitik (product_analytics): Terintegrasi langsung dengan FinancialReportView (rekap laba kotor, HPP, performa produk terlaris).
  │   ├── Pengaturan Struk Kasir (ReceiptSettingsView.tsx): Pilihan ukuran kertas (58mm/80mm), teks footer kustom, alamat/telepon kop struk, serta live simulation thermal receipt box.
  │   └── Pajak Restoran PB1 & Layanan (TaxesSettingsView.tsx): Konfigurasi PB1 10%, service charge, biaya kemasan, edukasi regulasi Bapenda, dan integrasi modal SupervisorFeesModal.

PHASE 1.13: KANAL PENJUALAN & MITRA ONLINE DELIVERY TERPADU (EPIC-20) ➔ COMPLETED ✅
  ├── Konfigurasi Skema Basis Data & Prisma ORM:
  │   ├── Penambahan kolom JSONB `outlets.channels_config` untuk menyimpan konfigurasi kanal kustom per toko fisik.
  │   ├── Penambahan kolom relasional kanonikal `orders.channel` dan `orders.table_number` pada Prisma schema.
  │   └── Standarisasi struktur SalesChannelConfig (id, code, name, group: OFFLINE_DIRECT | ONLINE_DELIVERY, isActive, requiresTable, requiresOnlineOrderId).
  ├── Backend Controller, Validasi RBAC & Dual-Write Hardening:
  │   ├── Endpoint `PUT /api/outlets/:id/channels` dengan otorisasi Role.OWNER, Role.ADMIN, dan Role.SUPERVISOR (toggle operasional).
  │   ├── Penanganan `onlineOrderId` pada checkoutSchema (`order.controller.ts`) dengan pemformatan otomatis `[${channel} #${onlineOrderId}]`.
  │   ├── Resolusi konflik duplikasi primary key pada varian produk olahan F&B (`sales.dual_write.service.ts`).
  │   └── Agregasi omset per kanal `channelSales` pada `report.read_adapter.ts` dan integrasi ke `GET /api/reports/financial`.
  ├── Frontend Backoffice & Terminal Kasir POS (pos_apps/client):
  │   ├── Halaman baru `SalesChannelsSettingsView.tsx` di bawah rumpun Pengaturan Resto (`settings_channels`) dengan gaya Deep Navy Button dan zero stacked modals.
  │   ├── POS Header (`PosHeader.tsx`): Pemisahan pil kanal langsung toko (Dine In, Take Away, Kurir Toko) dan dropdown elegan Mitra Online Delivery (GoFood, GrabFood, ShopeeFood, Maxim, dll).
  │   ├── Order Cart Sidebar (`OrderCartSidebar.tsx`): Pemisahan kontekstual cerdas — Dine In menampilkan pemilih meja resto; Mitra Online Delivery otomatis menyembunyikan meja dan menampilkan kartu input ID Pesanan Driver Online (e.g. #GF-402).
  │   └── Laporan Finansial (`FinancialReportView.tsx`): Tabel dan kartu ringkasan kontribusi omset per kanal penjualan serta integrasi ke ekspor CSV.

PHASE 1.14: FONDASI OPERASIONAL KASIR, SHIFT GUARD & OPEN TAB BILLING (FASE 1 & FASE 2) ➔ COMPLETED ✅
  ├── Fase 1: Fondasi Kasir, Shift Guard & Quick Fixes:
  │   ├── Perbaikan Dropdown Mitra Online: Penyesuaian container dropdown di `PosHeader.tsx` (posisi right-aligned, lebar terkalibrasi w-64, truncate teks panjang dan chip badge tidak terpotong).
  │   ├── Penegakan Shift Guard: Kasir wajib membuka shift terlebih dahulu sebelum memasukkan produk ke keranjang, menahan pesanan (hold), atau checkout; visual banner peringatan shift tertutup langsung di dalam keranjang belanja.
  │   ├── Perbaikan Modul Tahan Pesanan (Hold Orders): Penyertaan `outletId` toko aktif secara otomatis agar tidak keliru tersimpan di outlet default (warehouse), serta penyeragaman payload response backend (`items: h.cart_items`).
  │   └── Eliminasi Alert Browser: Penggantian `window.alert(...)` bawaan peramban dengan pesan konfirmasi elegan in-app banner.
  ├── Fase 2: Mekanisme Bayar Langsung vs Bayar Belakangan (Open Tab Meja Terisi):
  │   ├── Dual-Action Checkout pada Keranjang Kasir: Tombol aksi ganda "Bayar Langsung (Rp ...)" (modal tender pembayaran seketika) vs "Simpan & Kirim Dapur (Bayar Nanti)" khusus Dine In.
  │   ├── Penyimpanan Tagihan Meja Terbuka (Open Tab): Endpoint `POST /api/orders/open-tab` menyimpan pesanan dengan status `UNPAID` dan `IN_PROGRESS` terasosiasi dengan nomor meja dan nama tamu.
  │   ├── Modal Tagihan Meja Terbuka (`OpenTabsModal.tsx`): Menampilkan daftar meja terisi dengan durasi waktu tunggu, filter pencarian meja/nama tamu, opsi tarik pesanan ke kasir (tambah pesanan), batalkan meja, dan pelunasan seketika.
  │   ├── Tombol Status "Tagihan Meja (N)" di POS Header: Memberikan indikator live jumlah meja aktif yang belum lunas.
  │   ├── Pelunasan Transaksional Atomik (`sales.dual_write.service.ts`): Penyelesaian Open Tab dengan parameter `existingOrderId` yang memperbarui status transaksi menjadi `PAID` / `COMPLETED`, mencatat multi-tender pembayaran dan mutasi persediaan secara atomik.
  │   ├── Perbaikan Tarik Tagihan Meja & Pesanan QR Meja: Resolusi data tanpa items, pemisahan filter o.channel = 'QR_MENU' vs o.channel != 'QR_MENU', null-check toLowerCase(), dan seeder 2 open tabs + 1 pesanan QR siap uji.
  │   ├── Dukungan Pesanan Tambahan via Kasir (Simpan ke Tagihan yang Sama): Dukungan `existingOrderId` pada `POST /api/orders/open-tab` yang meng-update tagihan meja yang sedang aktif (menambah item & kalkulasi ulang total tanpa membuat order baru) serta tombol Batal Tarik (kembalikan ke antrean).
  │   ├── Proteksi Meja Terisi (Anti-Konflik): Meja dengan tagihan aktif otomatis berstatus Terisi dan tidak bisa dipilih untuk order baru (dengan tombol cepat "Tarik Tagihan"), serta validasi penolakan di backend jika ada usaha membuat order baru pada meja terisi.
  │   └── Optimalisasi Layout POS: Katalog 6-grid proporsional, floating popover pemilih meja (zero vertical space penalty), dan penggantian icon $ ke kartu kredit (CreditCard).

PHASE 1.15: PENGATURAN PAJAK RESTORAN (PB1/PBJT), BIAYA LAYANAN, UNPAIRING KASIR, DATA HYGIENE & ZERO JAVASCRIPT POPUP ➔ COMPLETED ✅
  ├── Pemisahan Tegas Pajak Daerah vs Biaya Operasional vs Kemasan Kasir (TaxesSettingsView.tsx & SupervisorFeesModal.tsx):
  │   ├── Tab 1 (Pajak Daerah PB1 / PBJT Makanan & Minuman): Sesuai UU No. 1/2022 HKPD (maks 10%), titipan resmi Bapenda (bukan omzet resto), quick presets 10%, 11%, 5%, 0%, dan pemilihan cakupan kanal.
  │   ├── Tab 2 (Biaya Operasional & Kurir): Service charge, ongkir toko, platform fee sebagai penutup biaya operasional resto dengan toggle in-page & form tambah tanpa modal bertumpuk.
  │   ├── Tab 3 (Kemasan & Wadah Kasir): On-demand packaging dengan input nominal terstandarisasi (<CurrencyInput />), pin Akses Cepat Kasir (⭐ maks 4 item untuk checkout cepat).
  │   └── Tab 4 (Simulasi Struk Kasir / Live POS Calculator): Simulasi interaktif struk POS kasir dengan pemisahan akuntansi usaha (Omzet Resto vs Titipan Pajak Pemda).
  ├── Penataan Alur Kasir & Device Pairing:
  │   ├── Penambahan modal unpairing perangkat kasir dengan konfirmasi aman.
  │   ├── Dropdown nama kasir yang ringkas & elegan saat membuka terminal (menggantikan listing terbuka yang memakan tempat).
  │   └── Tombol tutup (close icon) pada banner notifikasi sistem kasir.
  ├── Perbaikan Proporsi Angka & Mata Uang POS:
  │   └── Kalibrasi format mata uang pada kartu katalog produk agar proporsional dan tidak terpisah meski nominal mencapai ratusan ribu/jutaan.
  ├── Pembersihan Data Transaksi & Uji Coba (Data Hygiene):
  │   ├── Pembersihan data transaksi dummy & riwayat shift lama, mempertahankan akun pengujian Owner (Dimas Prabowo) & Kasir (Rere).
  │   ├── Penambahan katalog produk lebih dari 5 item per kategori yang terhubung dengan saldo persediaan fisik & resep BOM.
  │   └── Pelengkapan foto produk dummy realistis untuk seluruh katalog menu POS.
  └── Eliminasi Menyeluruh Browser Popup (Zero Native Alert Policy):
      └── Seluruh pemanggilan `window.alert`, `window.confirm`, dan `window.prompt` digantikan dengan antarmuka modal in-app dan toast elegan dari `DialogContext`.

PHASE 1.16: METODE PEMBAYARAN & UPLOAD QRIS STATIS CABANG ➔ COMPLETED ✅
  ├── Konfigurasi Skema Basis Data & Backend Controller:
  │   ├── Penambahan kolom JSONB `payment_config` pada tabel `outlets` serta sinkronisasi ke Prisma schema.
  │   ├── Endpoint `PUT /api/outlets/:id/payment-config` dengan otorisasi Role.OWNER, Role.ADMIN, dan Role.SUPERVISOR.
  │   └── Standarisasi DTO PaymentConfig & QrisConfig (imageUrl, nmid, merchantName, bankName, isActive).
  ├── Backoffice Management View (PaymentSettingsView.tsx):
  │   ├── Sub-menu baru "Metode Pembayaran & QRIS" di bawah kelompok Pengaturan Resto (`settings_payment`).
  │   ├── Dropzone berkas gambar QRIS statis (PNG, JPG, WebP) dengan konversi otomatis ke Base64 Data URL dan tombol Hapus/Ganti.
  │   ├── Opsi "Pasang Contoh Barcode QRIS Demo" untuk kemudahan pengujian instan (zero blocker).
  │   ├── Input NMID nasional, nama merchant akun QRIS, dan pilihan bank/PJP penerbit (BCA, Mandiri, BRI, GoPay, ShopeePay, dll).
  │   └── Kartu live preview interaktif kartu QRIS seperti yang akan dilihat oleh kasir dan pelanggan di kasir POS.
  └── Integrasi Terminal Kasir POS (PaymentModal.tsx & PosTerminalView.tsx):
      ├── Penyerahan prop outlet aktif ke PaymentModal.
      ├── Tab pembayaran QRIS menampilkan barcode gambar QRIS nyata milik toko, NMID resmi, nama toko, dan nominal total belanja.
      └── Mempertahankan simulator UAT sandbox (`⚡ Simulasikan Pembayaran QRIS Sukses`) untuk kemudahan testing tanpa transfer uang nyata.

PHASE 1.17: MULTI-OUTLET CATALOG ALLOCATION, SCOPED MENUS, DYNAMIC WAREHOUSE BACKFLUSH & DEDICATED WAREHOUSE MODE (EPIC-21) ➔ COMPLETED ✅
  ├── Fase 1: Isolasi Menu & Kategori per Outlet Toko:
  │   ├── Skema basis data: Tabel pivot `outlet_products` (`outlet_id`, `product_id`, `is_available`, `price_override`).
  │   ├── Read Adapter Scoping (`catalog.read_adapter.ts`): Filter produk & kategori aktif hanya yang terhubung dengan `outletId` toko aktif.
  │   ├── Product Controller: Pembuatan produk otomatis mengikat ke toko aktif; endpoint `getAvailableProductsForOutlet` dan `assignProductsToOutlet`.
  │   └── Backoffice UI: Tombol "Ambil dari Master Katalog" (`AssignCatalogProductModal.tsx`) di `ProductsView.tsx` dan live refresh menu saat switch toko.
  ├── Fase 2: Isolasi Bahan Baku & Resep BOM Toko:
  │   ├── Scoping `GET /api/recipes`: Resep difilter per toko aktif (`productVariant.product.outletProducts.some(...)`).
  │   ├── Scoping `GET /api/recipes/inventory-items`: Bahan baku difilter per toko aktif, diperkaya metadata stok gudang (`warehouseStock`, `warehouseName`).
  │   ├── Form Outlet Toko (`OutletsView.tsx`): Dropdown pemilihan "Gudang Sumber Pasokan (Backflush Warehouse)" dan badge pasokan pada kartu outlet.
  │   └── Seeder Ura Corporation: Gudang Pusat (`WH-01`), 3 outlet toko (`OUT-01`, `OUT-02`, `OUT-03`), 3 resep BOM F&B, dan isolasi saldo persediaan.
  ├── Fase 3: Dynamic Warehouse Routing & Auto-Backflushing Kasir:
  │   ├── Mesin Backflush Cerdas (`sales.dual_write.service.ts`): Menyelesaikan `warehouseStorageLocationId` dari `outlet.warehouseId`.
  │   ├── Pemotongan bahan baku resep BOM otomatis dialihkan ke gudang pasokan dalam satu transaksi ACID atomik.
  │   └── Kartu stok (`inventory_ledgers`) otomatis mencatat mutasi pengeluaran barang (`SALE`, `ORDER`) di gudang pasokan dengan log audit lengkap.
  ├── Fase 4: Multi-Warehouse Visibility & Stock Allocation Dashboard:
  │   ├── Dashboard Gudang (`InventoryView.tsx`): Tab "Kelola Gudang & Stok Master" mengkalkulasi saldo fisik, SKU aktif, dan nilai total aset persediaan secara live.
  │   ├── Modal "📋 Pantau & Alokasikan Stok Bahan Baku": Rincian saldo fisik, HPP rata-rata, dan tombol cepat "⇄ Alokasikan".
  │   └── Universal Stock Allocation Engine (`StockTransferModal.tsx`): Alokasi stok transfer bahan baku dan produk retail dengan row-level locking `FOR UPDATE`.
  ├── Mode Khusus Gudang (Dedicated Warehouse Mode) pada Backoffice:
  │   ├── Switcher Header Dinamis: Ketika entitas Gudang dipilih, header menampilkan ikon `Warehouse` dan label badge "Gudang". Tombol kasir hijau otomatis diganti tombol "🏪 Kembali ke Toko".
  │   ├── Sidebar Khusus Logistik: Menyembunyikan menu kasir/toko (POS, Meja QR, PB1, Struk, Voucher, Ojol) dan hanya menampilkan 4 domain logistik (Persediaan & Stok, Pengadaan & Vendor, Formula Resep & Standar, Operasional Gudang).
  │   └── Navigasi Safeguard (`DashboardPage.tsx`): Auto-redirect pengguna dari tab kasir/toko ke tab `inventory` (*Persediaan Stok Bahan Gudang*) saat berpindah ke mode gudang.
  └── Spesialisasi & Pemisahan Laporan Finansial vs Analisis Menu & HPP:
      ├── Laporan Penjualan & Finansial (`FinancialReportView.tsx`): Omset kotor/bersih, arus kas riil tunai vs QRIS, PB1 daerah, service charge, kontribusi kanal penjualan, dan rincian transaksi nota.
      └── Analisis Menu & HPP (`ProductAnalyticsView.tsx`): Analisis intelijen bisnis, ranking Pareto menu terlaris (Top 10), kontribusi margin & laba kotor per resep produk olahan, modal bahan baku pokok (COGS), dan deteksi slow-moving stock.
  └── Standarisasi Format ID Staf & Petugas POS 5-Digit Numerik (userCode):
      ├── Menyeragamkan seluruh ID Staf ke format numerik murni 5-digit (`/^\d{5}$/`) demi kompatibilitas virtual numpad layar sentuh terminal kasir POS.
      ├── Hirarki Alokasi: `0000x` (Owner/Admin), `1000x` (Kasir), `2000x` (Supervisor), `3000x` (Gudang).
      ├── Akun Owner terdaftar & seeder Ura Corp dimigrasikan dari format teks `#USR-OWNER-01` menjadi format kanonikal `#00001`.
      └── Pembaruan generator otomatis `generateRandomStaffId` pada `UsersView.tsx` untuk mengalokasikan nomor urut sesuai peran secara cerdas.
  └── Standarisasi Metode Pembayaran Tahap Awal (Murni Tunai & QRIS Statis):
      ├── Kesepakatan Produk: Pada milestone rilis awal ini, operasional kasir dan pelaporan transaksi disepakati secara ketat HANYA mendukung Tunai (CASH) dan QRIS Statis.
      ├── Penegasan Lingkup: Belum adanya integrasi ke Payment Gateway perbankan (EDC kartu kredit/debit) maupun transfer bank virtual account.
      ├── Isolasi Data: Seeder transaksi dummy dan pelaporan omset gerai F&B dibersihkan dari metode kartu & transfer bank (100% arus kas murni CASH dan QRIS).
      └── Integrasi Payment Gateway dinamis (Midtrans/Xendit) diposisikan di PHASE 3 Roadmap Produk.
  └── Penyelarasan Terminal Kasir POS & Stabilisasi Engine Buku Menu QR Meja (OPSI A):
      ├── Status Menu Siap Saji: Seluruh 18 produk F&B (Ura Coffee, Bakery, Fried Chicken) distandardisasi bertipe 'COMPOSITE' sehingga tidak lagi terjebak status "HABIS (Stok: 0)". Status kasir & QR kini hijau "Siap Saji" (Ready to Serve) secara konsisten.
      ├── Isolasi Pills Kategori Kasir POS (`PosTerminalView.tsx`): Pemanggilan `api.getCategories(outletId)` memastikan pills kategori di layar kasir murni menyaring kategori milik gerai terpilih (e.g. Ura Coffee hanya menampilkan "Coffee & Beverages").
      ├── Perbaikan Kritis Checkout Meja QR (`qr_menu.service.ts`): Memperbaiki query DDL `INSERT INTO "order_items"` yang sebelumnya error 500 karena kolom usang (`product_id`, `created_at`, `updated_at`). Sekarang 100% selaras dengan skema target PostgreSQL dan otomatis meresolusi `product_variant_id`.
      ├── Isolasi Menu Publik Tamu QR (`qr_menu.service.ts`): Menambahkan join `outlet_products` pada `getPublicMenu` sehingga smartphone tamu yang memindai QR meja di Ura Coffee Kemang hanya menampilkan 6 menu minuman kopi, tanpa bercampur dengan menu toko roti atau ayam goreng.
      ├── Pembersihan Header Kasir POS (`BackofficeLayout.tsx`): Menyembunyikan tombol redundant "Buka Kasir POS" saat pengguna sedang berada di dalam tab terminal kasir (`activeTab === 'pos'`).
      ├── Auto-Reset Status Meja Dinamis & Real-time: Meja yang dipesan via QR otomatis bertransisi menjadi `OCCUPIED`. Begitu tagihan dilunasi oleh kasir POS (`checkoutOrder`) atau dibatalkan (`cancelOpenTab`), sistem otomatis memverifikasi order UNPAID aktif dan me-release status meja kembali menjadi `AVAILABLE`. Polling `getTables` juga melakukan rekonsiliasi status meja secara berkala.
      ├── Notifikasi Melodik Pesanan QR Meja (Web Audio Synthesizer): Penambahan efek suara chime 2-nada (D5 -> A5) tanpa dependensi aset file saat kasir menerima pesanan QR meja baru secara real-time.
      └── Visualisasi HPP Belum Ada Resep (`ProductsView.tsx`): Menu `COMPOSITE` yang belum memiliki formula resep BOM menampilkan badge kuning informatif `Belum Ada Resep` dengan keterangan `HPP: Rp 0` dan `Margin: -`, memudahkan owner/supervisor mengidentifikasi menu yang perlu dirawat formulanya.

PHASE 1.18: AUDIT KEAMANAN MENYELURUH, ELIMINASI TENANT FALLBACK & ADR-007 ➔ COMPLETED ✅
  ├── Audit Menyeluruh Multi-Tenancy & Zero Fallback Enforcement:
  │   ├── Eliminasi Total Hardcoded Tenant Fallback: Menghapus seluruh fallback dummy string ('toko-maju-jaya', dll) pada 12 controller backend, menggantinya dengan penegakan otentikasi req.user.tenantId (HTTP 401/403).
  │   ├── Isolasi Database & Row-Level Security: Pembersihan query findFirst/findMany tanpa filter tenantId, pengikatan filter tenant wajib pada level Prisma ORM dan rlsService.
  │   ├── Sanitasi Endpoint Publik: Menjamin rute publik (QR Menu Publik, Onboarding Owner) terisolasi tanpa membocorkan data tenant privat.
  │   ├── Dokumen Keputusan Arsitektur: Penerbitan ADR-007 (Penghapusan Tenant Fallback & Penguatan Keamanan Multi-Tenancy) di docs/decisions/ADR-007-security-hardening-tenant-isolation.md.
  │   └── Standarisasi Aturan Koding Keamanan: Penambahan aturan R-10 s.d R-14 pada docs/00_PROJECT_CONTEXT.md.

PHASE 2 (BACKLOG / PARKED): REAL-TIME WHATSAPP GATEWAY & NOTIFICATION PROVIDER
  ├── [DITUNDA] Integrasi WhatsApp Gateway (Fonnte / Waba / Twilio) diparkir sementara ke backlog.

PHASE 3 (BACKLOG / PARKED): PRODUCTION PAYMENT GATEWAY INTEGRATION (DYNAMIC QRIS & VA)
  ├── [DITUNDA] Integrasi Midtrans / Xendit diparkir sementara ke backlog.

PHASE 4 (BACKLOG / PARKED): HARDWARE PERIPHERALS & ESC/POS THERMAL INTEGRATION
  ├── [DITUNDA] Integrasi direct thermal printer WebUSB / Bluetooth diparkir sementara ke backlog.

================================================================================
                    FOKUS AKTIF UTAMA SAAT INI (ACTIVE CORE FOCUS)
================================================================================
FOKUS 1: INTEGRITAS CORE SYSTEM, AKURASI TRANSAKSI & PENYELARASAN ZONA WAKTU (PARITAS 100%) ➔ COMPLETED ✅
  ├── Prioritas 1: Security & Stability Audit Fixes (S1 s.d S5, B2, B3, B4) ➔ SELESAI ✅:
  │   ├── S1: Rate limiting pada endpoint publik QR Menu (`qrOrderRateLimiter`, 10 req/menit per IP) di `qr_menu.routes.ts`.
  │   ├── S2: Penghentian polling background saat tab diminimalkan (Page Visibility API) di `PosTerminalView.tsx`.
  │   ├── S3: Pembatasan role kasir pada endpoint pairing (`getPairedOutletCashiers`) mengecualikan akun non-kasir (WAREHOUSE).
  │   ├── B2: Penegakan role guard khusus SUPERVISOR untuk pembatalan tagihan meja terbuka (`cancelOpenTab`) di `order.controller.ts`.
  │   ├── B3: Penegakan isolasi tenant pada penghapusan draft pesanan tertahan (`deleteHoldOrder`) di `order.controller.ts`.
  │   └── B4: Penegakan kepemilikan cabang toko (`outletBelongsToTenant`) pada katalog produk (`getProducts` & `getProductById`) mencegah kebocoran data lintas-outlet.
  ├── Prioritas 2: Penyelarasan Zona Waktu WIB UTC+7 (`toWibDateStr`) ➔ SELESAI ✅:
  │   ├── Pembuatan helper kanonikal `toWibDateStr(d)` di `date.utils.ts` untuk konversi tanggal WIB (+07:00) yang tahan terhadap eksekusi server UTC.
  │   ├── Penyelarasan pengelompokan `dateKey` pada `analytics.service.ts` dan `report.read_adapter.ts`.
  │   ├── Penyelarasan format nomor faktur invoice `INV/YYYYMMDD/...` pada `order.controller.ts` agar tanggal struk tengah malam tetap akurat dalam WIB.
  │   └── Penyelarasan batas tanggal awal (00:00:00 WIB) dan akhir hari (23:59:59 WIB) pada `resolveDateRange`.
  └── Prioritas 3: End-to-End Automated Smoke Test Suite (`npm run test:smoke`) ➔ SELESAI 100% (27/27 PASS) ✅:
      ├── Flow 1: Registrasi Mandiri Owner ➔ Guard Tolak Login PENDING ➔ Approval SuperAdmin ➔ Login Owner ➔ Pembuatan Toko Perdana ➔ Pendaftaran Kasir ➔ Pairing Terminal Kasir.
      ├── Flow 2: Kasir PIN Login ➔ Checkout Tunai ➔ Pemotongan Bahan Baku Resep BOM Otomatis (18g Kopi) ➔ Checkout QRIS Non-Tunai.
      ├── Flow 3: Laporan Finansial Real-Time Backoffice Owner (Format WIB konsisten) ➔ Laporan Rekapitulasi Shift Kasir.
      ├── Flow 4: Multi-Outlet & Cross-Tenant Security Isolation (Guard cancel tab SPV HTTP 403, penolakan akses produk lintas-tenant HTTP 403).
      └── Flow 5: Self-Ordering QR Menu Pelanggan (Tanpa Login) ➔ Live QR Orders Feed ➔ Dapur update status IN_PROGRESS ➔ Pelunasan di Terminal Kasir POS ➔ Verifikasi status database PAID.
================================================================================
FOKUS 2: PEROMBAKAN UI/UX MENU BAHAN BAKU & STOK SERTA VALIDASI SIMULASI MERCHANT (COMPLETED ✅)
  ├── Prioritas 1: Modernisasi Antarmuka Menu Bahan Baku & Stok (`InventoryView.tsx`) ➔ SELESAI 3 TAHAP ✅:
  │   ├── Tahap 1: Tab Bahan Baku Mentah Dapur (`INGREDIENTS`)
  │   │   ├── 3 KPI Summary Cards interaktif: Total Bahan, Stok Kritis/Menipis, dan Estimasi Nilai Aset Bahan HPP.
  │   │   ├── Quick Filter Status Chips (`Semua Bahan`, `⚠️ Menipis`, `❌ Habis (0)`, `✅ Stok Aman`).
  │   │   └── Tabel Bahan Baku lapang: Integrasi Nama + Kode SKU + Satuan, visual status dot indikator, HPP rata-rata, estimasi nilai, dan quick action buttons (Stok Masuk & Opname).
  │   ├── Tahap 2: Tab Produk Jadi Retail & Audit Riwayat Mutasi (`PRODUCTS`)
  │   │   ├── 4 KPI Summary Cards produk: Total SKU, Fisik Unit, Stok Menipis, dan Nilai Aset Modal.
  │   │   ├── Sub-view Toggle Pill (`Daftar Stok Produk Jadi` vs `Riwayat Kartu Stok`).
  │   │   ├── Filter Kategori & Status Stok Produk Ritel dengan quick transfer modal integration.
  │   │   └── Tabel Audit Kartu Mutasi Stok: Format waktu WIB, badge tipe mutasi kontras, dan font-mono tebal.
  │   └── Tahap 3: Tab Kelola Gudang & Lokasi Stok (`WAREHOUSES`)
  │       ├── Banner edukasi arsitektur rantai pasok terpadu (Vendor ➔ Gudang Pusat ➔ Outlet Toko Kasir).
  │       ├── 3 Global Warehouse Summary Cards: Fasilitas Pergudangan, Fisik Persediaan di Gudang, dan Total Nilai Aset Gudang.
  │       ├── Kartu Fasilitas Gudang Interaktif: Badge `⭐ Gudang Utama Pusat` vs `Gudang Logistik`, metrik 3-kolom (SKU, Fisik, Nilai Aset), dan tombol aksi hierarkis (`📋 Pantau & Alokasikan Stok`, `+ Terima PO`, `⇄ Kirim ke Toko`).
  │       └── Modal Pantauan Stok Bahan Baku Gudang dengan aksi transfer per item langsung ke cabang kasir.
  └── Prioritas 2: Eksekusi Live Merchant Simulation & System Health Audit (25 September 2026) ➔ SELESAI 100% ✅:
      ├── Eksekusi otomatis via Google Chrome for Testing lokal (macOS arm64) pada sandbox aktif `http://localhost:5173`.
      ├── Pembuktian 7 langkah operasional hulu-ke-hilir:
      │   1. Saldo awal Biji Kopi di Backoffice: 8.000 GRAM (Nilai: Rp 2.000.000).
      │   2. Inspeksi Tab Gudang & Rantai Pasok baru.
      │   3. Penegakan Financial Guard: Kasir terkunci status `• Shift Tutup` hingga modal awal kasir Rp 200.000 dibuka.
      │   4. Pemesanan menu komersial + modifier kustomisasi rasa (Kopi Susu Aren Ura & Butter Croissant).
      │   5. Checkout tunai instan via keyboard Enter (Grand Total tagihan Rp 54.050 termasuk PPN & service charge).
      │   6. Penerbitan struk thermal resmi faktur `#INV/20260925/UC-/0001` & sinyal pulsa 24V laci kasir.
      │   7. Pembuktian Mutlak Auto-Deduct Resep BOM: Stok biji kopi terpotong tepat 18 gram (8.000 gr ➔ 7.982 gr, nilai aset turun ke Rp 1.995.500).
      │   8. Laporan Finansial Backoffice Real-Time: Omset Rp 54.050 tercatat seketika, arus kas laci 100% tunai, dan rekonsiliasi kas tervalidasi 100%.
      └── Laporan lengkap & 8 screenshot bukti visual tersimpan di `live_merchant_simulation_report.md`.
================================================================================
FOKUS 3: MODERNISASI CONTROL TOWER SUPERADMIN SAAS BERBASIS ENTERPRISE-LITE F&B (COMPLETED ✅)
  ├── Model Bisnis: F&B Pay-As-You-Go Kuota Token Tanpa Hangus + Onboarding Setup Fee Rp 199.000 (One-Time).
  ├── Tahap 1: Header Control Tower & Dynamic KPI Metrics ➔ SELESAI ✅:
  │   ├── Banner status platform & badge arsitektur `ENTERPRISE-LITE F&B • TOKEN SYSTEM`.
  │   └── 4 Dynamic KPI Cards: Pendapatan Setup Fee Terkumpul, Total Kuota Token Beredar, Laju Konsumsi Token / Order, dan Gerai F&B Beroperasi.
  ├── Tahap 2: Redesain Tabel Tenant & Accordion Multi-Toko F&B ➔ SELESAI ✅:
  │   ├── Tabel 6-Kolom: Penambahan kolom khusus "Saldo Kuota Token (Pay-As-You-Go)" dengan visual progress bar pemakaian, status badge (Aman / Menipis / Habis), total transaksi terbakar, dan tag "Tanpa Hangus".
  │   ├── Kolom Profil & Usaha: Integrasi badge status onboarding fee "Setup Fee Lunas (Rp 199rb)".
  │   ├── Multi-Outlet Accordion (Inline Zero-Stacked Modals): Sub-baris gerai fisik terperinci dengan badge mode toko ("🍽️ Gerai Kasir F&B" vs "🏭 Gudang Bahan Baku"), indikator Token Fleksibel, dan aksi per gerai.
  │   ├── Quick Action: Tombol "+ Isi Kuota" langsung pada baris merchant aktif.
  │   └── Penyelarasan Backend: Pemilihan kolom `isWarehouse: true` pada query `getPlatformTenants` dan `getPlatformTenantDetail` di `platform.controller.ts`.
  └── Tahap 3: Master Kelola Paket Fleksibel & Modal Top-Up Token Transaksi ➔ SELESAI ✅:
      ├── Tab Switcher Terpadu: Pemisahan mulus antara "Manajemen Merchant & Kuota Token" dan "Master Paket Kuota Fleksibel (Enterprise-Lite F&B)".
      ├── Master Paket Kuota Fleksibel: Katalog paket token (Starter Trial 500, Enterprise-Lite Starter 1.000, Growth 2.000, Scale 5.000) dengan metrik biaya per order, limit outlet/kasir, dan Matriks Komparasi Fitur F&B mendalam.
      ├── Modernisasi Modal Top-Up Token Transaksi:
      │   ├── 2 Mode Pengisian: "Pilihan Paket Instan" vs "Kustom Jumlah Token" (input bebas kuota token + chips cepat +500 s.d +10.000).
      │   ├── Live Cost Calculator: Estimasi biaya pengisian otomatis (@ Rp 110/order).
      │   ├── Toggle "Masa Aktif Tanpa Hangus" (Never Expire) aktif secara default dengan opsi durasi opsional.
      │   ├── Integrasi Metode Pembayaran (Transfer Bank BCA/Mandiri, Midtrans QRIS/VA, Bonus Admin) & Memo Referensi.
      │   └── Live Projection Box: Perhitungan otomatis proyeksi saldo baru real-time (e.g. 1.996 + 5.000 ➔ 6.996 Token).
      └── Penyelarasan Backend: Pembaruan endpoint `updateTenantSubscription` di `platform.controller.ts` untuk menangani `neverExpires` (`expiresAt: null`), `tokenAmount`, dan catatan invoice admin.
  └── Tahap 4 (Opsi A): Riwayat Billing & Invoicing, RBAC Tim Staf, dan Promo SaaS Platform (COMPLETED ✅):
      ├── 1. Riwayat Billing, Invoicing & Mutasi Token (Buku Besar Keuangan Platform):
      │   ├── Schema DB: Ekstensi tabel `SaaSInvoice` dengan kolom `tokenAmount`, `notes`, `promoCode`, dan `discountAmount`.
      │   ├── 4 Finansial KPI Cards: Total Kas Masuk Lunas (IDR), Total Token Diterbitkan, Faktur Menunggu Bayar, dan Rata-rata Nilai Faktur (ARPU).
      │   ├── Audit Ledger & Filtering: Filter cepat status faktur (`Semua`, `✔ Lunas`, `⏳ Belum Lunas`) dan pencarian nomor faktur `INV-...` / merchant.
      │   ├── Tombol aksi cepat verifikasi bukti pembayaran manual dan pencetakan faktur digital sah elektronik (Tax Invoice Preview).
      │   └── Otomasi Backend: Pencatatan invoice otomatis saat persetujuan tenant (`INV-SETUP-XXXX`, Rp 199.000) dan top-up token (`INV-TOKEN-XXXX`).
      ├── 2. Manajemen Tim Staf Platform (RBAC Control Tower):
      │   ├── Tabel Staf Platform: Daftar nama, email, role, avatar, dan tanggal pendaftaran akun staf internal Well POS HQ.
      │   ├── 3 Pilar Wewenang RBAC: `SUPER_ADMIN` (akses menyeluruh), `BILLING` (verifikasi pembayaran & voucher), dan `SUPPORT` (reset sandi & bantuan toko).
      │   ├── Root SuperAdmin Guard: Proteksi akun root `superadmin@wellpos.id` dari aksi penghapusan tidak sengaja.
      │   └── Modal Tambah Staf Baru: Form input kredensial dan role staf internal.
      ├── 3. Manajemen Promo SaaS Platform (B2B Voucher Engine):
      │   ├── Model DB: Pembuatan tabel `SaaSPromo` untuk manajemen kupon diskon & bonus token transaksi level B2B (HQ ke Merchant).
      │   ├── Katalog Voucher Interaktif: Kartu kupon dengan tombol salin cepat, badge status dinamis (Aktif, Kedaluwarsa, Kuota Habis), toggle aktif/nonaktif, dan hapus.
      │   ├── 3 Tipe Promo B2B: `DISCOUNT_PERCENT` (persentase + plafon maks), `DISCOUNT_FIXED` (potongan rupiah langsung), dan `BONUS_TOKENS` (ekstra kuota token).
      │   ├── Modal Buat Promo: Form penerbitan kupon dengan batas minimum belanja, kuota pemakaian, dan tanggal validitas.
      │   └── Integrasi Modal Top-Up Token: Selector kupon promo B2B dinamis yang menghitung live discount dan proyeksi penambahan saldo token secara seketika.
  └── Tahap 5: Audit Faktur Digital & Modul Pemilik Toko (Backoffice Owner Quota & Billing Self-Service) (COMPLETED ✅):
      ├── 1. Audit & Perbaikan Tuntas Query Invoice Platform & Tenant:
      │   ├── Penyelarasan Relasi DB: Pembaruan query Prisma `saaSInvoice.findMany` di `platform.controller.ts` dan `billing.service.ts` untuk menyertakan `tenant.users`.
      │   ├── Eliminasi Placeholder Klien: Data faktur digital kini memetakan nama bisnis nyata (`businessName` / `name`), nama pemilik asli (`owner.name`), email, dan nomor telepon tanpa pernah jatuh ke fallback generic.
      │   └── NITKU Resmi & Kop Dokumen: Faktur digital mencantumkan identitas resmi Well POS Platform HQ dengan format NITKU kanonikal `3313122505910002000000 • Indonesia` dan disclaimer `Electronic Receipt & Tax Verification`.
      ├── 2. Modul Backoffice Owner (Paket & Kuota Token Transaksi):
      │   ├── Komponen `BillingTokensView.tsx`: Halaman monitoring kuota transaksi mandiri milik pemilik toko (`ADMIN` & `OWNER`).
      │   ├── Live Quota Meter: Tampilan sisa kuota pesanan aktif (`Order Tersisa`), progress bar pemakaian, biaya per transaksi (Rp 110), masa berlaku tanpa batas hangus, dan breakdown konsumsi order per gerai fisik/gudang.
      │   ├── Profil Lisensi Merchant: Kartu status paket aktif (`Enterprise-Lite Growth`), nama toko, dan data pemilik terverifikasi.
      │   ├── Akses Terpadu Navbar & Sidebar: Badge interaktif `Paket & Kuota` di header dan menu khusus `Paket & Kuota Token` dengan tag `Pay-As-You-Go` di sidebar.
      │   └── Riwayat Faktur Tenant: Tabel daftar faktur digital mandiri tenant dengan status pembayaran dan tombol cetak/lihat faktur sah.
      ├── 3. Alur Mandiri Top-Up Token & Voucher Promo B2B:
      │   ├── Endpoint Backend Baru: `POST /api/saas/subscription/top-up` dan `GET /api/saas/promos/validate` dengan otentikasi JWT dan isolasi tenant.
      │   ├── Modal Top-Up Token Terintegrasi: Pilihan paket instan (+1.000, +2.000, +5.000) atau kustom, kalkulator biaya seketika, dan selector metode bayar (Transfer Manual / QRIS).
      │   ├── Verifikasi Kupon Promo Live: Validasi kode promo B2B seketika (e.g. `HEMAT50K`), pemotongan nominal harga langsung pada invoice modal, dan penambahan kuota token instan.
      │   └── Penerbitan Faktur Otomatis: Faktur digital `INV-TOKEN/...` langsung diterbitkan dan otomatis ditampilkan ke layar pemilik toko saat transaksi diselesaikan.
      ├── 4. Standardisasi Tema Putih-Biru Faktur Resmi & Pengelolaan QRIS Statis Platform HQ (COMPLETED ✅):
      │   ├── Penyelarasan Tema Faktur Digital: Transformasi 100% modal faktur resmi (`selectedInvoiceModal`) dari tema hitam gelap menjadi tema Clean White-Blue (putih bersih, teks kontras tajam, badge status resmi hijau, kop Well POS biru platform, dan tombol cetak elegan).
      │   ├── Konsistensi Tombol & Aksen Modal: Standardisasi seluruh tombol aksi modal isi ulang (tombol 'Terapkan' voucher dan 'Beli & Aktifkan Kuota Sekarang') serta header & sidebar badge ke palet Clean Blue (`bg-blue-900 hover:bg-blue-800`).
      │   ├── Engine Pengelolaan QRIS Statis Platform: Penyediaan backend JSON storage `platform_payment_config.json`, endpoint Superadmin `GET/PUT /api/platform/payment-config`, dan endpoint owner `GET /api/saas/payment-config` untuk mengelola data rekening bank dan QRIS statis sementara sebelum payment gateway otomatis aktif.
      │   ├── UI Manajemen Superadmin: Modal 'Pengaturan QRIS & Rekening Platform HQ' pada tab BILLING Control Tower Superadmin untuk memperbarui nama merchant, NMID, nomor rekening, URL barcode QRIS, dan panduan transfer secara real-time.
      │   └── Kartu Interaktif QRIS Statis Owner: Tampilan barcode QRIS resmi berstandar nasional lengkap dengan NMID, panduan pembayaran via m-banking/e-wallet, dan nominal tagihan pas saat metode QRIS dipilih pada modal isi ulang saldo token.
================================================================================
FOKUS 4: SANITASI MULTI-TENANCY & INISIALISASI TENANT BARU (COMPLETED ✅)
  ├── 1. Penanganan Nomor Meja QR Bersih (Zero Auto-Seeded Tables):
  │   ├── Eliminasi auto-seed 5 meja default di `qr_menu.service.ts` saat `getTables` dipanggil.
  │   ├── Pembersihan 5 meja sisa pada berkas `qr_menu_tables.json` untuk tenant baru.
  │   └── Verifikasi visual: Tenant baru memulai dengan 0 meja (Clean Empty State).
  ├── 2. Tampilan Kategori Menu Baru Dinamis & Penegakan Rute Auth:
  │   ├── Penambahan middleware `authenticate` pada rute `GET /api/categories` di `category.routes.ts` untuk memblokir kebocoran data kategori lintas-tenant.
  │   ├── Isolasi filter ketat `userTenantId` pada `category.controller.ts` dan `catalog.read_adapter.ts`.
  │   ├── Penghapusan hard filter `WHERE EXISTS` pada pembacaan master kategori backoffice, sehingga kategori baru dengan 0 menu produk (seperti `MENU TAHU`) tampil seketika di backoffice.
  │   └── Penambahan opsi `hasProductsOnly=true` khusus untuk tab menu kasir POS (`PosTerminalView.tsx`).
  ├── 3. Kanal Penjualan & Mitra Online Delivery Fleksibel:
  │   ├── Standardisasi default `DEFAULT_SALES_CHANNELS` di `types/outlet.ts`: Mitra online (`GOFOOD`, `GRABFOOD`, `SHOPEEFOOD`) dan `DELIVERY` default non-aktif (`isActive: false`), hanya Dine In & Take Away yang aktif.
  │   ├── Penambahan tombol edit (ikon pensil) pada seluruh kartu kanal di `SalesChannelsSettingsView.tsx`.
  │   └── Penyediaan Modal Ubah Pengaturan Kanal (Zero Stacked Modals) untuk kustomisasi nama, label/badge, warna indikator, dan opsi wajib ID pesanan online driver.
  └── 4. Standarisasi Pengaturan Pajak & Biaya Bawaan (Default Unconfigured):
      ├── Penyesuaian `DEFAULT_OUTLET_FEES` di `types/outlet.ts`: Seluruh biaya dan pajak (PB1 10%, Biaya Layanan 5%, Ongkir, Kemasan) berstatus default non-aktif (`isActive: false`).
      ├── Penyelarasan `outlet.controller.ts` saat pembuatan outlet baru tanpa feesConfig agar tidak menyuntikkan pajak aktif secara sepihak.
      └── Verifikasi kartu metrik dan switch pada `TaxesSettingsView.tsx`: Menampilkan status `0% (Non-aktif)` dan `Status Pajak Kasir: NON-AKTIF (Bebas Pajak)` untuk toko baru.
================================================================================
FOKUS 5: PENGELUARAN KASIR DINAMIS & PETTY CASH LACI (COMPLETED ✅)
  ├── 1. Skema Database & Permission Model Granular:
  │   ├── Kolom Baru `users.can_cash_out` (Boolean @default(false)): Kontrol izin per kasir dari Backoffice Staf.
  │   ├── Model Baru `CashMovement`: Tipe `CASH_OUT` / `CASH_IN` terikat dengan Shift, Outlet, Tenant, dan User kasir pencatat.
  │   ├── Enum & Parameterized DDL: Ditambahkan secara aman ke DB PostgreSQL lokal tanpa menghapus tabel riwayat.
  │   └── Dual-Write Support: Penyelarasan `UserDualWriteService` dan permission controller.
  ├── 2. Backend Shift & Financial Reconciliation Engine:
  │   ├── Endpoint `POST /api/shifts/cash-movement`: Validasi shift aktif, izin kasir (`canCashOut` / `sales_cash_expense`), dan pencatatan mutasi kas laci.
  │   ├── Endpoint `GET /api/shifts/cash-movements`: Mengambil riwayat mutasi kas pada shift aktif.
  │   └── Integrasi Formula Kas Laci pada Shift, X-Report, dan Z-Report:
  │       Expected Cash = Modal Awal + Penjualan Tunai + Kas Masuk - Kas Keluar.
  ├── 3. Antarmuka Backoffice Manajemen Staf (UsersView.tsx):
  │   ├── Toggle switch dinamis "Izinkan Pengeluaran Kasir (Kas Keluar / Petty Cash)" di form tambah/edit staf.
  │   └── Badge status "Bisa Kas Keluar" pada tabel staf untuk staf yang diberikan izin.
  └── 4. Antarmuka Kasir POS Terminal & Laporan Slip:
      ├── Modal Kas Keluar / Kas Masuk (`CashExpenseModal.tsx`): Kategori pengeluaran (Iuran Lingkungan/Sampah, Belanja Darurat Toko, Ongkir Kurir, Operasional Lainnya), input rupiah terformat `<CurrencyInput />`, catatan wajib, dan tabel riwayat pengeluaran shift aktif.
      ├── Tombol "Kas Keluar" di header kasir (`PosHeader.tsx`): Tampil kondisional hanya untuk pengguna dengan hak akses (`OWNER`, `ADMIN`, `SUPERVISOR`, atau `canCashOut === true`).
      ├── Pembaruan Slip X-Report (`XReportModal.tsx`): Menampilkan rincian baris (+) Kas Masuk, (-) Pengeluaran Kasir, dan estimasi kas di laci.
      └── Pembaruan Slip Z-Report (`CloseShiftModal.tsx`): Rekonsiliasi kas laci memperhitungkan pengeluaran kasir, menampilkan rincian beban operasional, dan menghitung selisih kas fisik secara akurat.
================================================================================
FOKUS 6: ANTARMUKA HANDHELD MOBILE POS (SMARTPHONE 6.8" PORTRAIT) (COMPLETED ✅)
  ├── 1. Deteksi Adaptif & Sakelar Mode Layar (Auto + Manual Toggle):
  │   ├── Auto-detect: Layar smartphone (`width < 768px`) otomatis beralih ke layout Handheld.
  │   └── Manual Toggle: Tombol "Mode HP" di header desktop dan tombol "Beralih ke Desktop" di menu hamburger mobile.
  ├── 2. Komponen Dedicated Handheld (`PosMobileView.tsx`):
  │   ├── Sticky Top Navigation: Header ringkas nama outlet, indikator shift dot, pill kanal pesanan (Dine In / Takeaway / Ojol), dan hamburger menu.
  │   ├── Carousel Kategori Geser (Swipeable): Pill kategori horizontal dengan badge jumlah produk.
  │   ├── Grid Produk 2 Kolom Ramah Jempol (Thumb-Friendly): Kartu compact, badge kuantitas keranjang (`2x`), harga tebal, dan tombol `+` responsif.
  │   ├── Floating Action Cart Bar: Menempel di bawah saat ada pesanan (`X Item Dipilih | Rp Total -> [Periksa Pesanan]`).
  │   └── Interactive Bottom Sheet Drawer: Geser naik dari bawah untuk cek pesanan, stepper kuantitas, catatan meja/pelanggan, voucher diskon, dan tombol bayar instan.
  └── 3. Quick Action Drawer Kasir Mobile:
      ├── Akses satu-klik Buka/Tutup Shift, X-Report, dan Kas Keluar / Petty Cash langsung dari smartphone.
      └── Integrasi counter antrean (Hold Orders, Tagihan Meja Terisi, dan Pesanan QR).
================================================================================
```

### 📱 MILESTONE PENGEMBANGAN UX/UI SMARTPHONE 6,8 INCI PORTRAIT (~390px - 430px)

```text
================================================================================
MILESTONE: TAMPILAN RESPONSIVE SMARTPHONE 6,8 INCI PORTRAIT
Status: FASE 1, FASE 2, FASE 3, & FASE 4 SELESAI (100% BUILD SUCCESS ✅)
================================================================================
[FASE 1: NAVIGASI SHELL, BACKOFFICE & ONBOARDING] - SELESAI ✅
• Off-Canvas Mobile Drawer: Mengganti sidebar kaku di mobile dengan sliding drawer bersih.
• Ergonomic Bottom Navigation Bar: 5 akses cepat (Kasir, Ringkasan, Pesanan, Stok, Menu).
• Auto-Hide Bottom Bar: Tersembunyi otomatis saat tab kasir POS aktif agar tidak menabrak cart bar.
• Edge-to-Edge Canvas: Padding p-0 pada tab kasir di mobile untuk memaksimalkan ruang vertikal.
• Responsive Store Wizard: Sektor tab ritel/resto/layanan dengan scrolling horizontal lancar.

[FASE 2: LAYAR KASIR POS & MODALS PEMBAYARAN] - SELESAI ✅
• Ergonomic Bottom Sheet Modals:
  - Seluruh modal kasir beralih ke pola bottom-sheet di mobile (`items-end sm:items-center`, `rounded-t-3xl sm:rounded-3xl`, `max-h-[92vh] sm:max-h-[95vh]`).
• Sticky Action Footer (Prime Thumb Zone):
  - `PaymentModal.tsx`: Tombol aksi "Batal" dan "Selesaikan & Cetak" dipindahkan ke luar scrollable body menjadi footer sticky (`shrink-0 border-t bg-white`). Kasir tidak perlu lagi scroll vertikal untuk menyelesaikan transaksi.
  - Sizing QRIS & Uang Cepat dioptimalkan secara proporsional agar tidak memakan seluruh ketinggian layar ponsel portrait.
• Canonical `Modal.tsx` & Dialog Pendukung:
  - `Modal.tsx`: Seluruh modal kanonikal aplikasi otomatis mendukung bottom-sheet ergonomis.
  - `OrderSuccessModal.tsx`: Kertas struk termal dibuat independen scrollable (`flex-1 overscroll-contain`) sementara aksi Cetak/PDF/WA/Email dan "Transaksi Baru" tetap menempel di jangkauan jempol.
  - `ProductModifierModal.tsx`, `StartShiftModal.tsx`, `CloseShiftModal.tsx`, `ConfirmModal.tsx`: Seluruh alur shift dan opsi produk telah dioptimasi untuk sentuhan satu tangan (touch-target >= 44x44px).

[FASE 3: TABEL DATA BACKOFFICE & ERGONOMI CARD VIEW (6,8 INCI)] - SELESAI ✅
• Canonical `TablePagination.tsx`:
  - Kontrol baris per halaman dan info rentang data ditempatkan di baris atas tanpa wrapping berantakan.
  - Navigasi halaman mobile disederhanakan menjadi tombol sentuh jempol `[ < Sebelumnya ]` `Hal X / Y` `[ Selanjutnya > ]` dengan touch target >= 36px dan Zero Horizontal Overflow.
  - Navigasi nomor pill lengkap (`1 2 3 ...`) tetap aktif di tablet/desktop (>= sm).
• Hybrid Table/Card View (`OrdersView.tsx`):
  - Tabel 8 kolom aktif di desktop (`hidden md:block`), smartphone beralih menjadi Mobile Order Card List (`block md:hidden`).
  - Kartu pesanan menampilkan No. Faktur (mono bold), status waktu, channel badge, metode bayar (Tunai/QRIS), total nominal tebal, serta tombol aksi `+ Susulan` & `Lihat Struk`.
• Hybrid Table/Card View (`ProductsView.tsx`):
  - Tabel 9 kolom dibungkus ke `hidden md:block`.
  - Mobile Card List (`block md:hidden`): multi-select checkbox, avatar produk, status aktif/nonaktif, badge kategori & SKU, grid harga modal & harga jual, stok fisik, serta tombol aksi Power, Edit, Hapus.
  - Floating Bulk Action Bar diberikan safe clearance `bottom-20 sm:bottom-6` agar tidak menabrak Bottom Navigation Bar Backoffice.
• Hybrid Table/Card View (`CustomersView.tsx`):
  - Tabel 6 kolom dibungkus ke `hidden md:block`.
  - Mobile Card List (`block md:hidden`): avatar inisial, status VIP, kode member, tautan langsung *Chat WA*, frekuensi belanja & akumulasi transaksi, serta tombol Detail, Edit, Hapus.
• Hybrid Table/Card View (`ShiftsAuditView.tsx`):
  - Tabel 7 kolom dibungkus ke `hidden md:block`.
  - Mobile Card List (`block md:hidden`): kasir, nama outlet, status shift aktif/selesai, rentang jam kerja, mini-card 3 metrik (Modal Awal, Uang Fisik, Selisih Kas berwarna), serta tombol aksi "Lihat Rincian Audit".

[FASE 4: LAPORAN KEUANGAN, GRAFIK ANALITIK & DATA HARIAN (6,8 INCI)] - SELESAI ✅
• Hybrid Table/Card View Laporan Finansial (`FinancialReportView.tsx`):
  - Tabel 6 kolom rincian harian di desktop dibungkus ke `hidden md:block`.
  - Mobile Daily Card List (`block md:hidden`): tanggal lengkap, badge total faktur transaksi, omset bersih tebal, serta grid 2 kolom arus kas Tunai vs QRIS & rata-rata nilai belanja (AOV).
  - Header tombol "Cetak" & "Ekspor CSV" responsif penuh (`w-full sm:w-auto`, `flex-1 sm:flex-initial`).
• Hybrid Leaderboard Menu & Dead Stock (`ProductAnalyticsView.tsx`):
  - Leaderboard menu terlaris 7 kolom beralih ke Mobile Top Card List (`block md:hidden`) dengan badge peringkat (🥇, 🥈, 🥉, #X), nama menu, SKU, kategori, qty terjual, total omset, serta grid perbandingan Modal HPP vs Laba Bersih & Margin.
  - Tabel Slow-Moving & Dead Stock beralih ke Mobile Card List (`block md:hidden`) dengan indikator sisa stok fisik dan nominal modal mengendap beraksen rose tebal.
  - Header aksi dan toolbar periode kustom dibuat ramah sentuhan satu tangan.
• Ergonomi Ringkasan Bisnis & Grafik (`BusinessSummaryView.tsx`):
  - Header subtab Data vs Statistik Grafik dan tombol aksi dibuat flex-wrap responsif tanpa tabrakan.
  - Diagram Donut Chart metode bayar bertumpuk vertikal pada mobile portrait (`flex-col sm:flex-row`) agar diagram dan rincian rupiah metode bayar tidak saling berdesakan.
  - Grafik batang kurva MiniBarChart dibungkus overflow horizontal lembut (`overflow-x-auto`) menjaga integritas tampilan ponsel 19.5:9 s.d 20:9.

[FASE 5: DETAIL TRANSAKSI MODERN, RESTRIKSI SUSULAN DINE-IN & ICON ACTIONS] - SELESAI ✅
• Dedicated Order Detail View (`<OrderDetailModal />`):
  - Rincian komprehensif transaksi: Invoice header dengan quick copy, badge status (PAID/VOID), waktu WIB, kasir, pelanggan, meja/antrean, tabel item lengkap (nama, varian, SKU, qty, harga satuan, diskon item, subtotal).
  - Ringkasan finansial (Subtotal, Diskon Promo, Biaya Layanan, Pajak PB1, Grand Total) & informasi pembayaran (Metode, Uang Bayar, Kembalian, Ref QRIS).
  - Zero Stacked Modals: tombol navigasi cepat "Lihat Struk", "+ Susulan", dan "Void" yang menutup modal detail sebelum membuka modal aksi berikutnya.
• Restriksi Pesanan Susulan (`+ Susulan`):
  - Hanya dapat diaktifkan pada transaksi berstatus `channel === 'DINE_IN'` dan tidak dibatalkan (`orderStatus !== 'VOIDED'`). Tombol susulan otomatis disembunyikan untuk pesanan Takeaway, Delivery, Online Platforms, ataupun invoice yang berstatus VOID.
  - POS Terminal otomatis mengunci channel ke Dine In, mengisi nomor meja asal, dan menampilkan banner konfirmasi mode susulan di atas workspace.
• Label & Watermark Menu Tambahan / Susulan di Struk:
  - Pada preview struk termal (`OrderSuccessModal.tsx`) dan cetak PDF termal 58mm/80mm (`receiptPdf.ts`), transaksi susulan otomatis dicap dengan label tebal `*** MENU TAMBAHAN / SUSULAN ***` beserta nomor faktur referensi asal.
• Icon-Only Action Buttons with Tooltips (`OrdersView.tsx`):
  - Tombol aksi pada tabel desktop dan kartu mobile beralih menjadi icon-only yang rapi dan seragam (Eye: Detail, Printer: Struk, UtensilsCrossed: Susulan, Ban: Void) dengan tooltip `title` informatif.
• Default Filter Periode Tanggal Harian (`today`):
  - Seluruh modul laporan dan riwayat transaksi (`OrdersView`, `FinancialReportView`, `ProductAnalyticsView`, `BusinessSummaryView`) kini menggunakan default filter tanggal `today` (Hari Ini) alih-alih per bulan atau 30 hari.

[FASE 6: NOTIFIKASI TERPUSAT DARI SUPERADMIN & PEMBERSIHAN HEADER BACKOFFICE] - SELESAI ✅
• Pembersihan Header Backoffice Merchant (`BackofficeLayout.tsx`):
  - Penghapusan icon bantuan (?) dan toggle bilingual (🌐 Indonesia) dari header merchant Backoffice untuk tampilan yang lebih bersih, fokus, dan rapi.
• Arsitektur Notifikasi Terpusat Superadmin:
  - Notifikasi sistem dialokasikan khusus dan resmi hanya bersumber dari Superadmin Platform (pengumuman pemeliharaan server, pembaruan aplikasi, peringatan sistem, atau info penting).
• Pengelolaan Notifikasi di Superadmin Dashboard (`SuperadminDashboardPage.tsx`):
  - Tab baru "Pusat Notifikasi & Broadcast" dengan ringkasan 4 metrik (Total Notifikasi, Info Pemeliharaan, Broadcast Semua Toko, Khusus Tenant).
  - Form modal penerbitan notifikasi baru: judul, tipe pesan (`MAINTENANCE`, `INFO`, `WARNING`, `UPDATE`), target distribusi (Broadcast ke Seluruh Mitra vs Khusus Tenant Tertentu), pemilihan toko tenant via dropdown, isi pesan rincian, dan batas kedaluwarsa opsional.
  - Tabel dan kartu daftar notifikasi dengan filter tipe, target, pencarian judul/pesan/toko, hapus notifikasi, serta paging kanonikal `<TablePagination />`.
• Antarmuka Lonceng Notifikasi Toko Merchant (`BackofficeLayout.tsx`):
  - Popover dropdown interaktif saat icon lonceng diklik, menampilkan daftar pengumuman resmi yang relevan bagi tenant aktif (`target === 'ALL'` atau `targetTenantId === tenantId`).
  - Indikator dot merah (unread pulse) yang otomatis sinkron dengan local storage saat pesan ditandai telah dibaca ("Tandai Dibaca").
  - Badge visual kategori bernuansa ramah WCAG AA (🔧 Maintenance, ⚠️ Peringatan, 🚀 Pembaruan Fitur, ℹ️ Info Resmi).
• API & Penyimpanan ACID Non-Blocking:
  - Endpoint Superadmin: `GET /api/platform/notifications`, `POST /api/platform/notifications`, `DELETE /api/platform/notifications/:id`.
  - Endpoint Merchant: `GET /api/saas/notifications` (terproteksi context tenant).
  - Penyimpanan data pada `pos_apps/server/data/platform_notifications.json` menjamin zero DDL pooler lock, zero downtime, dan konsistensi antar-lingkungan dev/Render/Vercel.

[FASE 7: PENCABUTAN SESI PERANGKAT INSTAN / FORCE LOGOUT KASIR (IAM & MULTI-TENANT)] - SELESAI ✅
• Mekanisme Token Versioning Database (`token_version`):
  - Kolom `token_version` (INTEGER NOT NULL DEFAULT 1) pada tabel `users`.
  - Terdaftar di `SchemaPatcher` (`20261002_03_users_token_version`) untuk auto-migration idempotent di Render & Supabase.
• Penerbitan Token & Enforcement di JWT Auth Middleware:
  - Token JWT (`loginWithPassword`, `loginWithPin`, `pairCashierDevice`) menyematkan klaim `tokenVersion`.
  - `auth.middleware.ts` memeriksa `decoded.tokenVersion < user.tokenVersion`. Jika terdeteksi stale, request langsung ditolak dengan HTTP 401 dan `code: 'SESSION_REVOKED'`.
• Endpoint Backend Pencabutan Sesi (`user.controller.ts` & `user.routes.ts`):
  - `POST /api/users/:id/revoke-session`: Memutus sesi tablet/perangkat staf tertentu secara instan.
  - `POST /api/users/revoke-all-sessions`: Memutus sesi seluruh perangkat kasir & staf di toko (default `excludeCurrent: true` agar sesi pemanggil tetap aktif).
  - Otomasi kenaikan `token_version` pada `userDualWriteService.updateUser` saat password/PIN diubah atau staf dinonaktifkan (`isActive: false`).
• Antarmuka Pengguna & Intersepsi Klien (`UsersView.tsx`, `api.ts`, `App.tsx`):
  - Tombol aksi per baris tabel desktop & kartu mobile kasir: "Cabut Sesi (Force Logout)" dengan dialog konfirmasi kanonikal (`useDialog().confirm`).
  - Tombol aksi toolbar utama: "Cabut Semua Sesi Kasir" untuk evakuasi keamanan toko secara serentak.
  - Interceptor respons global pada `api.ts` menangkap HTTP 401 `code === 'SESSION_REVOKED'`, membersihkan sesi lokal, dan memicu event `auth:session_revoked`.
  - `App.tsx` merespons event dengan menampilkan pesan informatif dan mengarahkan pengguna kembali ke layar login kasir.

[FASE 8: PENUTUPAN TUNTAS 100% KANAL PENJUALAN & MITRA ONLINE DELIVERY (EPIC-20)] - SELESAI ✅
• Integrasi Penuh Kasir Smartphone Handheld (`PosMobileView.tsx` & `PosTerminalView.tsx`):
  - Penggantian kanal hardcoded dengan resolusi saluran dinamis (`activeChannels`) dari outlet config.
  - Penambahan input kontekstual `ID Driver / No. Pesanan Online` (`onlineOrderId`) pada mobile drawer cart kasir.
  - Tombol toggle saluran di header bar mobile kini dapat beralih ke seluruh kanal aktif (Dine In, Take Away, GoFood, GrabFood, ShopeeFood, Maxim, Kurir Internal).
• Penyempurnaan Struk Fisik Kasir (`receiptPdf.ts`):
  - Pencetakan otomatis Nomor Meja untuk Dine In (`Meja: ...`).
  - Pencetakan otomatis ID Pesanan Driver Mitra Online (`ID Driver/Order: #...`) untuk verifikasi driver ojek online.
• Keamanan Skema & Migrasi Cloud (`schema_patcher.ts`):
  - Pendaftaran patch `20261002_04_outlets_channels_config` untuk penjaminan kolom `channels_config JSONB` di Render dan Supabase.
• Hasil Uji Verifikasi Sistem:
  - Exit code 0 pada `pos_apps/client` dan `pos_apps/server`.

[FASE 9: PENUTUPAN TUNTAS 100% LAPORAN FINANSIAL, REAL-TIME COGS/HPP & AUDIT SHIFT (EPIC-09)] - SELESAI ✅
• Integrasi Metrik HPP & Laba Kotor Terpadu (`FinancialReportView.tsx`):
  - Penambahan 2 Kartu KPI baru sehingga menjadi 6 Executive Cards: Total Omset Bersih, Total HPP / Modal Pokok (`totalCOGS`), Laba Kotor / Gross Profit (`grossProfit`) beserta persentase margin laba kotor (`grossProfitMargin%`), Total Faktur Transaksi, Total Pajak & Service Charge, serta Total Diskon Promosi.
  - Penambahan kolom "Total HPP" dan "Laba Kotor" pada rincian tren harian (*Daily Trends Breakdown*) di Desktop Table View maupun Mobile Card List View.
  - Pembaruan ekspor CSV Finansial dengan header UTF-8 BOM (`\uFEFF`) yang menyertakan baris HPP, Laba Kotor, dan Gross Margin % untuk kompatibilitas mutlak Microsoft Excel.
• Peningkatan Komprehensif Audit & Rekapitulasi Shift Kasir (`ShiftsAuditView.tsx`):
  - Penambahan prop `activeOutlet?: Outlet | null` untuk isolasi audit per toko dan penanganan mode gudang.
  - Integrasi API `GET /api/reports/shifts` (`getShiftDiscrepanciesReport`) dengan fallback anggun ke `getShiftHistory`.
  - Filter rentang periode preset (Hari Ini, 7 Hari, 30 Hari, Bulan Ini, Kustom) yang sinkron dengan paging kanonikal `<TablePagination />` (10 / 25 / 50 / 100 baris).
  - 4 Kartu KPI Ringkasan Audit Kasir: Total Sesi Diaudit, Sesi Seimbang / Sesuai (Rp 0), Sesi Selisih Kurang (Shortage) beserta akumulasi nominal minus, dan Net Selisih Kasir (Net Variance).
  - Status selisih kas cerdas (`SEIMBANG`, `LEBIH`, `KURANG`, `AKTIF`) pada tabel desktop dan kartu smartphone handheld.
  - Ekspor CSV audit shift kasir berformat UTF-8 BOM (`\uFEFF`) yang mencakup rincian kas diharapkan, kas fisik aktual, selisih kas, dan status per kasir.
• Standarisasi Ekspor CSV Analisis Menu & Dead Stock (`ProductAnalyticsView.tsx`):
  - Penerapan UTF-8 BOM (`\uFEFF`) dan Blob URL pada ekspor CSV leaderboard produk terlaris dan barang lambat laku (*dead-stock*).
• Client-Side API Expansion (`services/api.ts`):
  - Penambahan wrapper method `getShiftDiscrepanciesReport`, `getProductPerformanceReport`, `getDeadStockReport`, dan `exportAnalyticsReport`.
• Hasil Uji Verifikasi Sistem:
  - Exit code 0 pada `pos_apps/client` dan `pos_apps/server`.

[FASE 10: PENUNTASAN 100% INFRASTRUKTUR HYBRID, POOLER-SAFE RLS & DECOMMISSIONING SCAFFOLDING (EPIC-11 & ADR-008)] - SELESAI ✅
• Perilisan Keputusan Arsitektur Strategis ADR-008 (`docs/decisions/ADR-008-free-tier-infrastructure-and-evolution-strategy.md`):
  - Dokumentasi resmi kesepakatan pola infrastruktur adaptif: operasional 100% stabil, zero-cost, dan bebas crash di Render Free Tier & Supabase PgBouncer (Port 6543).
  - Penyusunan Playbook panduan langkah-demi-langkah jika di masa depan berpindah ke Dedicated PostgreSQL / VPS / AWS RDS / GCP Cloud SQL (zero application rework).
• Arsitektur Universal Hybrid Cache (`pos_apps/server/src/services/cache.service.ts`):
  - Sistem dual-driver: Otomatis mendeteksi ketersediaan `REDIS_URL` untuk dedicated cluster atau fallback ke Node.js In-Memory `Map` teroptimasi dengan TTL dan prefix invalidation (`delByPrefix`).
  - Metrik performa cache menyertakan label driver aktif (`driver: 'IN_MEMORY' | 'REDIS'`).
• PgBouncer Pooler-Safe Context Manager (`pos_apps/server/src/services/rls.service.ts`):
  - Penyempurnaan `withTenantContext`, `withSuperAdminContext`, dan `withBypassRLS` agar aman dari potensi *connection state leakage* PgBouncer Supabase saat transaction pooler aktif.
  - Penambahan indikator runtime `getEnforcementMode()` (`APPLICATION_DEFENSE_IN_DEPTH` vs `KERNEL_HARDENED`).
• Konsolidasi Target Domain Sales Engine (`pos_apps/server/src/services/dual_write/sales.dual_write.service.ts`):
  - Penyelarasan dokumentasi dan arsitektur penulisan kasir murni ke skema target (`orders`, `order_items`, `payment_transactions`, `inventory_balances`, `inventory_ledgers`).
• Hasil Uji Verifikasi Sistem:
  - Exit code 0 pada `pos_apps/client` dan `pos_apps/server`.
================================================================================
```



