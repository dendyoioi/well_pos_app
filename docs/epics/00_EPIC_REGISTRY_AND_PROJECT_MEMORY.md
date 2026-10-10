# WELL POS — MASTER EPIC REGISTRY & PROJECT MEMORY
## Canonical Ledger of Work History, Architecture Milestones, and End-to-End Product Roadmap

**Dokumen Rujukan Utama**: `docs/00_PROJECT_CONTEXT.md`  
**Basis Data**: PostgreSQL `pos_db` (40 Model Prisma Aktif Ternormalisasi Penuh)  
**Terakhir Diperbarui**: 06 Oktober 2026  
**Status Keseluruhan**: **EPIC-01 s.d EPIC-28 SELESAI 100% (COMPLETED ✅)**  

---

### 1. TUJUAN DOKUMEN (PURPOSE OF MEMORY REGISTRY)
Dokumen ini berfungsi sebagai **memori kerja permanen (*persistent cognitive memory*)** untuk AI Agent (Antigravity) dan tim pengembang. Setiap fase, keputusan arsitektur (ADR), eksekusi migrasi, dan rencana sprint terekam secara terpusat di sini agar kelanjutan pengerjaan produk Well POS selalu memiliki konteks utuh, presisi, dan konsisten dari waktu ke waktu sampai seluruh produk rilis ke pasar.

---

### 2. MASTER EPIC REGISTRY (END-TO-END PRODUCT ROADMAP)

Produk Well POS memiliki total **28 Epic** yang mencakup seluruh siklus hidup pengembangan dari fondasi arsitektur hingga peluncuran SaaS produksi, sandbox lokal, modernisasi antarmuka pengguna, tata kelola multi-toko, kanal penjualan mitra online, alokasi katalog multi-outlet, pembatalan transaksi dengan approval PIN supervisor, otomasi WhatsApp Gateway, pemindai barcode live & cetak label stiker, pencatatan kasbon piutang pelanggan, serta absensi staf mandiri & multi-timezone otomatis:

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
| **EPIC-25** | **Automated WhatsApp Gateway & Digital Receipt Engine (Fonnte API)** | **COMPLETED ✅** | Fase 1<br/>[`EPIC-25.md`](./EPIC-25_WHATSAPP_GATEWAY_AUTOMATION.md) | Otomasi pengiriman struk via Fonnte API saat checkout & 1-klik manual kasir, arsitektur token multi-level (Toko -> Platform -> Simulator Sandbox), kontrol Backoffice, dan tab Superadmin WhatsApp Gateway. |
| **EPIC-26** | **Retail Speed, Live Camera Barcode Scanner & Shelf Label Printing Engine** | **COMPLETED ✅** | Fase 1<br/>[`EPIC-26.md`](./EPIC-26_BARCODE_SCANNER_AND_LABEL_PRINTING.md) | Pemindai barcode kamera HP langsung di POS (WebRTC + ZXing scanner), auto-add keranjang belanja, generator & cetak stiker label barcode/rak produk (vektor SVG murni multi-ukuran: 40x30, 30x20, 50x30, 60x40 shelf talker, A4 grid). |
| **EPIC-27** | **Customer Receivables (Kasbon & Piutang) & Real-Time Cash Flow Analytics Engine** | **COMPLETED ✅** | Fase 1 s.d 2<br/>[`EPIC-27.md`](./EPIC-27_CUSTOMER_RECEIVABLES_AND_CASH_FLOW_ANALYTICS.md) | Pencatatan kasbon pelanggan di kasir POS dengan toggle outlet (default nonaktif), jatuh tempo fleksibel (+7, +14, +30 hari atau kustom), buku kasbon Backoffice CRM (`CustomerDebtsTab`), penagihan 1-klik WhatsApp, pelunasan bertahap/lunas terintegrasi ke Laci Kasir shift (`DEBT_REPAYMENT`), dan Laporan Arus Kas Riil & Performa Toko (`CashFlowReportTab`) dengan 4 KPI, visualisasi grafik SVG omset harian & bulanan, rekap mutasi harian, dan ekspor CSV UTF-8 BOM. |
| **EPIC-28** | **Staff Attendance (Absensi Mandiri Kasir & Non-Kasir) & Multi-Timezone Otomatis (WIB/WITA/WIT)** | **COMPLETED ✅** | Fase 3<br/>[`EPIC-28.md`](./EPIC-28_STAFF_ATTENDANCE_AND_MULTI_TIMEZONE.md) | Absensi staf mandiri via POS terminal dengan verifikasi PIN 4-6 digit (terpisah dari shift kasir), pengelolaan jadwal jam masuk/pulang & toleransi keterlambatan (grace period), pencatatan alasan keterlambatan & kepatuhan, sinkronisasi otomatis 100% zona waktu (WIB UTC+7, WITA UTC+8, WIT UTC+9) zero-config via `Intl.DateTimeFormat`, modal bottom-sheet PWA kanonikal (`StaffAttendanceModal.tsx`), serta rekapitulasi Backoffice Owner (`AttendanceReportView.tsx`) dengan 5 KPI, filter outlet & tanggal, paging kanonikal `<TablePagination />`, dan ekspor CSV UTF-8 BOM. |

---

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

[2026-10-10] STANDARISASI DESAIN KANONIKAL FASE 6: RINGKASAN BISNIS & KUOTA TOKEN (100% COMPLETED ✅)
  ├── Tahap 6.1 (BusinessSummaryView.tsx): Eliminasi tombol refresh redundan (Rule 16 AGENTS.md), standarisasi subtab Data/Grafik h-10 container & h-8 pills, tombol Buka Kasir h-10 Navy Blue (bg-blue-900 hover:bg-blue-950), Category pills h-10 px-4, Dropdown Saluran & Layanan h-10 rounded-xl dengan appearance-none & ChevronDown proporsional, Date picker trigger & Time mode container h-10 px-3.5, Tombol Ekspor CSV h-10 px-4, 3 KPI cards p-5/p-6 rounded-3xl font-mono text-2xl/3xl font-black, PWA safe padding pb-28 sm:pb-16, Perincian Metode Pembayaran Tunai vs Non-Tunai dengan sub-kategori aktif saja (anti-clutter Rp 0 0% di Tab Data & Donut Chart), Integrasi Petty Cash Out kasir ke Rekonsiliasi Kas (Net Cash Flow operasional & estimasi laba kotor aktual).
  └── Tahap 6.2 (BillingTokensView.tsx): Eliminasi tombol refresh manual (RotateCw), tombol aksi Top-Up kuota token h-10 px-4 Navy Blue (bg-blue-900 hover:bg-blue-950), Saldo kuota token font-mono text-3xl/4xl font-black, kartu profil lisensi & riwayat faktur rounded-3xl shadow-xs, tombol aksi tabel desktop & kartu mobile h-8/h-9, Modal Top-Up token diperlebar proporsional max-w-4xl dengan grid 2-kolom Kupon/QRIS vs Ringkasan Pembelian, sticky action footer PWA safe-area, input kustom & kupon promo h-10 px-3.5 font-mono, modal faktur digital resmi dengan sticky action footer & safe-area, PWA safe padding pb-28 sm:pb-16.

[2026-10-10] STANDARISASI DESAIN KANONIKAL FASE 5: BUKU MENU QR & SELF-ORDERING MEJA (100% COMPLETED ✅)
  ├── Tahap 5.1 (QrTablesView.tsx): Eliminasi tombol refresh mandiri (Rule 16 AGENTS.md), 4 KPI summary cards font-mono font-black, Toolbar & Filter zona h-10, Form modal select appearance-none & custom ChevronDown, PWA bottom clearance pb-28 sm:pb-12, Tombol aksi meja w-8 h-8 & h-7.5.
  ├── Tahap 5.2 (QrMenuSettingsView.tsx): Standarisasi tema Navy Blue (bg-blue-900 hover:bg-blue-950), input teks & Wi-Fi h-10 px-4 rounded-xl, preset saji h-9 px-3.5, input kustom angka durasi saji h-10, tombol simpan pengaturan h-11 sm:h-10 px-6 sm:px-8, PWA spacing pb-28 sm:pb-16.
  ├── Tahap 5.3 (QrLiveOrdersView.tsx): Zero redundant refresh button, live status pulse badge (otomatis 10d), 4 KPI font-mono text-2xl font-black, toolbar search & status tabs h-10 rounded-xl, action buttons KDS (Terima dapur, Siap saji, Buka bayar kasir, Tolak) seragam h-10 rounded-xl.
  └── Tahap 5.4 (CustomerQrMenuView.tsx): Search input h-10, category scroller h-9 px-3.5, tombol tambah menu h-8 px-3.5, item customize notes h-10, checkout inputs h-10, submit kirim dapur h-12 rounded-xl, return button konfirmasi h-11 sm:h-10, PWA safe padding pb-28 sm:pb-16.

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

[2026-10-02] AUDIT UI/UX MENYELURUH & EKSEKUSI PRIORITAS 1 (ZERO STACKED MODALS & INPUT STANDARDIZATION)
  ├── 1. Eliminasi Total Modal Bertumpuk (Zero Stacked Modals Policy):
  │   - PaymentModal.tsx: Mengganti UpgradeModal bertumpuk dengan banner edukasi PRO inline interaktif pada tab SPLIT serta proteksi disable tombol transaksi yang ramah kasir.
  │   - SupervisorFeesModal.tsx: Mengganti ConfirmModal bertumpuk dengan tombol konfirmasi hapus inline ("Hapus? [Ya] [Batal]") pada baris biaya terkait.
  │   - CategoryModal.tsx: Mengganti ConfirmModal bertumpuk dengan konfirmasi baris kategori inline.
  ├── 2. Standardisasi Input Nomor Telepon (<WhatsAppInput />):
  │   - CustomerQrMenuView.tsx: Input WhatsApp tamu meja dinormalisasi otomatis ke format +628... dengan bendera Indonesia.
  │   - SuppliersView.tsx: Input telepon/WhatsApp vendor dinormalisasi otomatis ke format +628...
  │   - InventoryView.tsx: Input nomor telepon PIC fasilitas gudang dinormalisasi otomatis ke format +628...
  ├── 3. Standardisasi Input Mata Uang (<CurrencyInput />):
  │   - SuperadminDashboardPage.tsx: Input nominal potongan diskon (Rp), maksimal diskon (Rp), dan minimal belanja (Rp) menggunakan CurrencyInput berpemisah titik live.
  ├── 4. Penghapusan Hardcoded Fallback Tenant:
  │   - OutletsView.tsx: Mengeliminasi fallback 'ura-coffee' dan menerapkan penanganan kontekstual murni berbasis tenant akun yang login.
  └── 5. Verifikasi Sistem: Exit code 0 pada build pos_apps/client dan pos_apps/server.

[2026-10-05] ENHANCEMENT ONBOARDING DINAMIS & B2B VOUCHER ENGINE REGISTRASI (SAAS PLATFORM)
  ├── 1. Dynamic Onboarding Fee & Registration Bonus Tokens:
  │   - Eliminasi hardcoded Rp 99.000 & 100 token bonus di seluruh backend dan client.
  │   - Konfigurasi terpusat di platform_payment_config.json via Superadmin Dashboard:
  │       • registrationFee: Biaya aktivasi pendaftaran awal (dapat diset Rp 0 untuk promo registrasi gratis).
  │       • registrationBonusTokens: Kuota token awal untuk merchant baru (dapat dikonfigurasi dinamis).
  │   - Public Endpoint: GET /api/saas/public-config untuk konsumsi landing page tanpa token auth JWT.
  ├── 2. B2B Voucher Promo Scope Engine:
  │   - Penambahan kolom scope pada model SaaSPromo (schema.prisma & schema_patcher.ts: 20261005_01_saas_promos_scope).
  │   - Pilihan Scope:
  │       • ALL: Berlaku untuk semua transaksi platform (Registrasi & Top-Up Kuota).
  │       • REGISTRATION: Khusus potongan/diskon pendaftaran awal di landing page.
  │       • TOPUP: Khusus transaksi isi ulang token kuota kasir.
  │   - Public Endpoint Validasi: GET /api/saas/promos/validate-registration?code=...
  │   - Validasi Ketat: Pengecekan status aktif, masa berlaku, limit pemakaian, dan atomic increment usedCount saat registrasi berhasil disubmit.
  ├── 3. Integrasi Pendaftaran Landing Page (SaasLandingPage.tsx):
  │   - Mengambil biaya pendaftaran & bonus token secara live dari public-config.
  │   - Input field kupon promo dengan tombol "Terapkan", validasi live, dan breakdown nominal diskon / harga akhir.
  │   - Mendukung skenario 100% Free Promo / Biaya Rp 0: Status invoice otomatis PAID (paymentGateway: 'PROMO_FREE'), tenant tetap PENDING menunggu persetujuan Superadmin.
  ├── 4. Pelestarian Diskon & Token pada Approval Superadmin (platform.controller.ts):
  │   - Memperbaiki updateTenantStatus agar mempertahankan invoice registrasi yang sudah terbit beserta potongan diskon dan jumlah token bonus yang berhak diterima merchant (tidak ter-reset ke nilai default).
  ├── 5. Superadmin Dashboard UI Enhancement (SuperadminDashboardPage.tsx):
  │   - Modal Pengaturan Platform HQ: Form input Biaya Pendaftaran Awal (menggunakan <CurrencyInput />) dan Bonus Kuota Token Awal.
  │   - Modal Buat Promo B2B: Dropdown pilihan Target Transaksi (Scope) [ALL / REGISTRATION / TOPUP].
  │   - Grid Kartu Promo B2B: Badge indikator Scope (🎯 REGISTRASI, ⚡ TOP-UP, 🌐 SEMUA).
  │   - Metrik setup fee dihitung dinamis mengikuti paymentConfig.registrationFee.
  └── 6. Verifikasi Sistem: Exit code 0 pada build pos_apps/client dan pos_apps/server.

[2026-10-06] PROGRESSIVE WEB APP (PWA) & DIRECT BLUETOOTH THERMAL PRINTING
  ├── 1. PWA Engine & Offline-Ready Assets:
  │   - manifest.webmanifest dengan ikon multi-resolusi (192px, 512px, maskable) & theme-color #0B192C.
  │   - Service Worker (sw.js) untuk caching shell aplikasi dan aset statis.
  │   - Layanan deteksi beforeinstallprompt & hook kanonikal usePwaInstall.ts.
  │   - PwaInstallBanner.tsx kontekstual di sidebar Backoffice (rapi, non-intrusif, zero button clutter).
  ├── 2. Direct Web Bluetooth Thermal ESC/POS (58mm / 80mm):
  │   - bluetoothPrinter.service.ts & useBluetoothPrinter.ts: Komunikasi biner langsung ke printer kasir via Web Bluetooth API.
  │   - Cetak struk belanja 1-klik seketika tanpa membuka pop-up print browser.
  │   - Sinyal elektrik pemicu laci kasir otomatis (pulse ESC/POS 24V).
  └── 3. Verifikasi Sistem: Exit code 0 pada pos_apps/client dan pos_apps/server.

[2026-10-06] OTOMASI WHATSAPP GATEWAY & DIGITAL RECEIPT ENGINE (FONNTE API - EPIC-25)
  ├── 1. Backend WhatsApp Gateway Engine (whatsapp.service.ts):
  │   - Driver Fonnte REST API (https://api.fonnte.com/send) via Node 20 Native fetch.
  │   - Normalisasi nomor telepon otomatis ke standar internasional (628...).
  │   - Arsitektur Token Multi-Level: Toko (Merchant) -> Platform (Superadmin) -> Simulator Sandbox.
  │   - Format struk kanonikal WhatsApp markdown rapi menyertakan nomor antrean (#01), rincian belanja, diskon, poin reward, dan metode bayar.
  ├── 2. Background Auto-Dispatch & Manual Cashier Trigger:
  │   - Pengiriman otomatis di latar belakang saat kasir menyelesaikan checkout (non-blocking).
  │   - Endpoint manual kasir: POST /api/orders/:id/send-whatsapp.
  │   - Endpoint Superadmin: GET/PUT /api/platform/whatsapp/settings & POST /api/platform/whatsapp/test.
  ├── 3. Frontend Cashier & Backoffice Integration (Role Boundary Principle):
  │   - OrderSuccessModal.tsx: Bebas dari panduan teknis API / accordion Fonnte. Kasir difokuskan pada kecepatan checkout: [Buka wa.me] & [Salin Teks] untuk pengiriman langsung, atau [⚡ Kirim Otomatis via Gateway (Fonnte)] jika gateway aktif.
  │   - ReceiptSettingsView.tsx: Bagian 7 konfigurasi WhatsApp Gateway khusus Owner, dilengkapi Card Panduan Aktivasi Fonnte 5-langkah (pendaftaran di fonnte.com, scan QR perangkat, salin API token, dan penyimpanan format struk).
  │   - SuperadminDashboardPage.tsx: Tab navigasi WhatsApp Gateway dengan pengelolaan kredensial platform & kartu uji coba pengiriman (Test Dispatch).
  └── 4. Verifikasi Sistem: Exit code 0 pada pos_apps/client dan pos_apps/server.

[2026-10-06] RETAIL SPEED, LIVE CAMERA BARCODE SCANNER & SHELF LABEL PRINTING (EPIC-26 - FASE 1)
  ├── 1. Live Camera Barcode Scanner Langsung di POS (WebRTC + ZXing Library):
  │   - BarcodeCameraScannerModal.tsx: Pemindai barcode multi-format 1D (EAN-13, EAN-8, UPC, Code 128, Code 39) & 2D (QR Code) via kamera smartphone / webcam.
  │   - Tombol pemicu pemindai kamera terintegrasi di PosMobileView.tsx (samping search input mobile) & CategoryFilterPills.tsx (desktop/tablet).
  │   - Audio chime sintetis via Web Audio API + haptic feedback getar (navigator.vibrate) saat barcode terdeteksi.
  │   - Auto-detection ke produk & varian katalog: Langsung memasukkan produk ke keranjang kasir (auto-add to cart) dengan feedback notifikasi scan banner.
  ├── 2. Vector SVG Barcode & Shelf Label Printing Engine:
  │   - BarcodeRenderer.tsx: Generator barcode SVG tajam berbasis JsBarcode dengan auto-fallback format Code 128 / EAN tanpa blur untuk printer thermal & kertas kantor A4.
  │   - ProductBarcodeLabelsModal.tsx: Studio pratinjau live & konfigurasi cetak stiker label produk/rak.
  │   - Multi-Template Label: Thermal 40x30 mm, 30x20 mm, 50x30 mm, Stiker Rak / Shelf Talker 60x40 mm (harga mencolok), dan Kertas A4 Grid (3x8 = 24 label/lembar).
  │   - Pengaturan cetak dinamis: Tampilkan Nama Toko, Nama Produk, Harga Jual, Teks Barcode, serta penentuan jumlah salinan (copies) per produk atau massal.
  │   - Pencetakan terisolasi via hidden iframe (clean print, tanpa merusak atau membekukan layout aplikasi).
  ├── 3. Integrasi Katalog Produk Backoffice (ProductsView.tsx):
  │   - Tombol "Cetak Label" di Toolbar Utama untuk cetak massal produk katalog.
  │   - Tombol "Cetak Label ({selectedIds.length})" di Floating Bulk Action Bar saat produk di-checklist.
  │   - Tombol aksi barcode per baris tabel & kartu mobile untuk cetak instan 1 produk spesifik.
  └── 4. Verifikasi Sistem: Exit code 0 pada build pos_apps/client dan pos_apps/server.
===============================================================
[2026-10-06] FASE 2: KASBON PIUTANG PELANGGAN & LAPORAN ARUS KAS RIIL (EPIC-27)
  ├── 1. Pencatatan Kasbon Pelanggan di Kasir POS:
  │   - Toggle fleksibel per cabang (outlets.payment_config.enableCustomerDebt, default nonaktif).
  │   - Pembayaran CUSTOMER_DEBT dengan pilihan jatuh tempo (+7, +14, +30 hari atau tanggal kustom).
  ├── 2. Manajemen Buku Kasbon & Penagihan WhatsApp Backoffice CRM:
  │   - CustomerDebtsTab.tsx: 4 KPI kasbon, filter status (UNPAID/PARTIAL/PAID), penagihan 1-klik WhatsApp.
  │   - Modal pelunasan kasbon terintegrasi ke shift laci kasir (DEBT_REPAYMENT).
  ├── 3. Laporan Arus Kas Riil & Performa Toko (CashFlowReportTab.tsx):
  │   - 4 KPI utama: Arus Kas Bersih, Kas Masuk Penjualan, Kas Keluar OPEX, Kasbon Tertagih.
  │   - Kurva visual SVG harian & bulanan, rekapitulasi mutasi, paging kanonikal, ekspor CSV UTF-8 BOM.
  └── 4. Verifikasi Sistem: Exit code 0 pada build pos_apps/client dan pos_apps/server.
===============================================================
[2026-10-06] FASE 3: ABSENSI STAF MANDIRI & MULTI-TIMEZONE OTOMATIS (EPIC-28)
  ├── 1. Pemisahan Absensi Staf vs Shift Kasir (Pilihan 1 - Fully Decoupled):
  │   - Staf non-kasir (barista, koki, waiter, gudang) dan kasir mencatat kehadiran mandiri via tombol [Absensi Staf] di POS terminal.
  │   - Verifikasi PIN 4-6 digit staf per terminal bersama tanpa menyentuh pembukuan laci kasir (Shift).
  ├── 2. Toleransi Keterlambatan (Late Tolerance Grace Period):
  │   - Konfigurasi jam operasional standar (standardClockIn, standardClockOut) & toleransi menit (default 15m) per outlet (outlets.attendance_config).
  │   - Real-time status: Jika clockIn <= jadwal + toleransi -> ON_TIME; jika lewat -> LATE dengan pencatatan lateMinutes dan alasan keterlambatan.
  ├── 3. Sinkronisasi Otomatis 3 Zona Waktu Indonesia (WIB, WITA, WIT 100% Zero-Config):
  │   - Deteksi otomatis timezone perangkat via Intl.DateTimeFormat().resolvedOptions().timeZone di PWA frontend, sinkron hening ke outlets.timezone.
  │   - Standarisasi backend toOutletDateStr, toOutletTimeStr, resolveDateRange di date.utils.ts kebal terhadap server UTC.
  ├── 4. Antarmuka Kasir & Backoffice Owner:
  │   - StaffAttendanceModal.tsx: Pola modal responsif PWA kanonikal (Rule #10) dengan jam digital live, indikator status, form PIN, dan riwayat hari ini.
  │   - AttendanceReportView.tsx di UsersView.tsx: Sub-tab rekapitulasi absensi dengan 5 KPI, filter tanggal & outlet, form pengaturan jadwal, paging kanonikal TablePagination, dan ekspor CSV UTF-8 BOM.
[2026-10-06] PUSAT PANDUAN PENGGUNA (USER GUIDE) BAB 20 S/D BAB 23 & PERLINDUNGAN KONTEKS TOMBOL CEPAT
  ├── 1. Penambahan 4 Bab Panduan Resmi Baru (UserGuideView.tsx):
  │   - Bab 20: Barcode Scanner Kamera & Cetak Label Stiker Rak (Zero-Hardware scanner & generator stiker shelf tag Code128).
  │   - Bab 21: Manajemen Kasbon Piutang Pelanggan & Laporan Arus Kas Riil (Limit kasbon, buku kasbon CRM, pelunasan bon, dan pemisahan arus kas akrual vs riil).
  │   - Bab 22: Absensi Staf Mandiri, Toleransi Kehadiran & Multi-Timezone (Clock In/Out mandiri via PIN, toleransi telat dinamis, dan zona waktu WIB/WITA/WIT).
  │   - Bab 23: Matriks Hak Akses Granular & Keamanan Wewenang Staf (Hierarki wewenang Owner, Admin, Supervisor, Kasir, Gudang, dan otorisasi JWT).
  ├── 2. Solusi Anti-Kehilangan Konteks Navigasi & Tombol Cepat:
  │   - Perlindungan Akses Peran (RBAC Context Guard): Tombol pintas aksi (actionTab) divalidasi via helper isTabAllowedForRole. Jika peran staf aktif (misal Kasir/Gudang) tidak memiliki akses ke tab target, tombol otomatis menampilkan status terkunci (Lock) dan tidak mengeksekusi navigasi terlarang yang memicu auto-redirect paksa ke POS.
  │   - Sinkronisasi Auto-Scroll & Filter Kategori: Jika user melompat ke suatu bab melalui tautan cepat saat filter kategori atau kata kunci pencarian sedang menyembunyikan bab tersebut, sistem otomatis mereset selectedCategory ke 'ALL' dan mengosongkan searchQuery sehingga elemen ter-render sempurna di DOM sebelum scroll dieksekusi.
  ├── 3. Sinkronisasi Widget Panduan Melayang (FloatingGuideWidget.tsx):
  │   - TAB_CONTEXT_MAP terintegrasi penuh untuk tab: customers (Bab 21), reports (Bab 21), staff_users (Bab 22), staff_roles (Bab 23), dan product_analytics.
  │   - Grid Pintasan Cepat 8 Tombol: Label Barcode, Kasbon & CRM, Absensi Staf, Hak Akses RBAC, Printer Bluetooth, Resi WA, App Kasir PWA, dan Pesanan Susulan.
  │   - Indikator total modul terupdate presisi: "Buka Seluruh Panduan (23 Bab Lengkap)".
  └── 4. Verifikasi Sistem: Exit code 0 pada build pos_apps/client dan pos_apps/server.
===============================================================
[2026-10-07] STANDARISASI TERMINOLOGI TOKO & OUTLET (ZERO AMBIGUITY - PEMBERANTASAN ISTILAH GERAI/CABANG)
  ├── 1. Harmonisasi UI & Teks Antarmuka Multi-Modul:
  │   - Eliminasi 100% istilah "gerai" di Superadmin Dashboard, Merchant Backoffice, Wizard Toko, Kasir, dan Seeder.
  │   - Superadmin Dashboard: Penyeragaman label metrik "Toko F&B Aktif", header tabel "Toko / Outlet F&B", tooltip "Lihat & Kelola Toko F&B", serta modal manajemen unit bisnis.
  │   - Merchant Backoffice: Penyeragaman status "Toko Aktif" (OutletsView), "Penggunaan Token per Toko" (BillingTokensView), "Toko Ini" (CategoriesView), dan helper form onboarding "Nama toko / outlet fisik" (FullScreenStoreWizard).
  ├── 2. Pengikatan Aturan Dasar & Project Memory:
  │   - Pencatatan Pantangan Keras #12 di AGENTS.md (Larangan mutlak istilah "gerai" dan "cabang").
  │   - Pencatatan Standar Kanonikal #29 di docs/00_PROJECT_CONTEXT.md.
  │   - Istilah resmi yang sah di platform: "Toko", "Outlet", atau "Toko / Outlet".
[2026-10-07] AUTOMATION VISUAL REGRESSION TESTING (LANGKAH 1: RESEP F&B BOM & PEMOTONGAN STOK OTOMATIS)
  ├── 1. Perancangan Tri-Path Suite & Page Object Model (POM):
  │   - scripts/pom/RecipesPage.js: Modul formula resep, pencarian menu, filter status, form in-page, live HPP card calculation, tambah takaran bahan, dan hapus resep.
  │   - scripts/pom/InventoryPage.js: Modul bahan baku mentah (UOM GRAM/ML/PCS), pendaftaran bahan baru via CreateIngredientModal, dan inspeksi saldo fisik toko.
  │   - scripts/pom/PosTerminalPage.js: Penyempurnaan addProductByName (penanganan otomatis modal modifier) dan checkoutCash (tunai pas + transaksi baru).
  ├── 2. Eksekusi 3 Jalur Pengujian Visual (test_fnb_recipes_deduction_visual.js):
  │   - 🟢 Happy Path: Pendaftaran bahan baku baru (Biji Kopi Gayo 1.000g) -> Hubungkan resep ke Kopi Susu Aren Ura (18g/cup) -> Transaksi kasir 2 cup di tablet -> Verifikasi matematika stok 100% presisi (1.000 - 36 = 964g).
  │   - 🟡 Sad Path: Empty state pencarian menu tanpa resep & penolakan validasi input takaran resep non-positif (0 atau negatif) via HTML5 min="0.001".
  │   - 🔴 Bad Path: Proteksi integritas relasi foreign key (pencegahan penghapusan bahan baku mentah aktif yang terikat resep menu).
  ├── 3. Perbaikan Kritis Mesin Transaksi:
  │   - order.controller.ts: Menghilangkan bug validasi kuantitas produk ganda di keranjang kasir (menggunakan uniqueProductIds dan DISTINCT ON (p.id)).
  │   - PosTerminalPage.js: Mengisolasi input modal awal shift kasir ke form StartShiftModal agar tidak bocor ke field diskon keranjang.
  ├── 4. Verifikasi Stabilitas & Zero Flakiness:
  │   - Eksekusi 5 kali berturut-turut (Run 1 s.d Run 5): LULUS 100% (Exit code 0).
  │   - Artefak visual screenshot tersimpan di: docs/artifacts/visual_fnb_recipes/ (happy_path, sad_path, bad_path).
  │   - Skrip npm kanonikal terdaftar: "npm run test:visual:recipes".
  └── 5. Verifikasi Sistem: Exit code 0 pada build pos_apps/client dan pos_apps/server.
===============================================================
[2026-10-07] OTOMASI PENGUJIAN VISUAL SIKLUS HIDUP SPLIT BILL & KASBON PIUTANG (LANGKAH 2 - POM E2E)
  ├── 1. Desain Page Object Model (POM) Kanonikal:
  │   - scripts/pom/PaymentModalPage.js: Pengendalian modal pembayaran kasir, tab metode, input porsi split tunai + QRIS, konfirmasi QRIS, pemilihan jatuh tempo kasbon (+7 Hari), dan scoped modal dialog selector.
  │   - scripts/pom/CustomerDebtsPage.js: Pengendalian modul Buku Kasbon & Piutang di Backoffice CRM (?tab=customers&subtab=debts), pencarian piutang pelanggan, pembukaan modal pelunasan, input nominal cicilan/metode bayar, dan verifikasi status baris tabel (Dicicil/Lunas).
  │   - scripts/pom/PosTerminalPage.js: Penambahan method selectCustomer(customerName) untuk menghubungkan member CRM walk-in langsung ke keranjang kasir.
  ├── 2. Eksekusi 3 Jalur Pengujian Visual (test_split_debt_lifecycle_visual.js):
  │   - 🟢 Happy Path:
  │     1) Transaksi SPLIT BILL: Pembayaran gabungan Tunai (Rp 20.000) + QRIS Dinamis (Rp 30.600) pada pesanan Kopi Susu Aren Ura -> Konfirmasi QRIS sukses.
  │     2) Transaksi KASBON (CUSTOMER_DEBT): Pesanan Americano Signature (Rp 20.700) dicatat atas nama member "Budi Santoso" dengan jatuh tempo +7 hari.
  │     3) Pelunasan Bertahap di Backoffice: Cicilan pertama Rp 10.000 via Tunai (status berubah PARTIAL/Dicicil, sisa Rp 10.700) -> Pelunasan sisa Rp 10.700 (status berubah PAID/Lunas).
  │   - 🟡 Sad Path: Validasi tombol transaksi Split Bill terkunci (disabled) jika QRIS belum dikonfirmasi kasir; Tombol Catat Kasbon terkunci otomatis jika kasir belum memilih member terdaftar.
  │   - 🔴 Bad Path: Proteksi penolakan request pelunasan piutang dengan nominal 0 atau ID piutang tidak valid (HTTP 401/400).
  ├── 3. Perbaikan Kritis Mesin Transaksi & Sinkronisasi Kasbon:
  │   - order.controller.ts: Menambahkan z.preprocess pada Zod paymentItemSchema untuk normalisasi alias frontend ('DEBT' -> 'CUSTOMER_DEBT', 'TRANSFER' -> 'BANK_TRANSFER'), sehingga transaksi kasbon sukses tersimpan dan terhubung ke buku piutang.
  │   - PosTerminalView.tsx: Meneruskan prop selectedCustomer dan customerName ke komponen <PaymentModal />.
  │   - PaymentModal.tsx & CustomerDebtsTab.tsx: Penyelarasan selector semantik tombol submit, form cicilan, dan status badge.
  ├── 4. Verifikasi Stabilitas & Zero Flakiness (5x Berturut-Turut):
  │   - Eksekusi Run 1 s.d Run 5 berturut-turut: LULUS 100% (Exit code 0).
  │   - Skrip npm kanonikal terdaftar: "npm run test:visual:split-debt".
  │   - Seluruh artefak visual screenshot tersimpan di: docs/artifacts/visual_split_debt/ (happy_path, sad_path, bad_path).
  └── 5. Verifikasi Sistem: Exit code 0 pada build pos_apps/client dan pos_apps/server.
===============================================================
[2026-10-07] FORMAL BDD GHERKIN AUTOMATION: SPLIT BILL, MULTI-TENDER & SIKLUS PIUTANG KASBON (LANGKAH 4)
  ├── 1. Spesifikasi Formal BDD Gherkin Dwibahasa:
  │   - features/split_bill_and_customer_debt.feature: Bahasa Indonesia formal (Fitur, Skenario, Dengan, Ketika, Maka, Dan).
  │   - features/split_bill_and_customer_debt.en.feature: Standard English formal (Feature, Scenario, Given, When, Then, And).
  │   - 3 Skenario Kanonikal:
  │       • 🟢 Happy Path: Pecah tagihan meja (SplitBillModal equal vs by-item) & pelunasan Multi-Tender (Tunai + QRIS Dinamis) berstatus PAID.
  │       • 🟡 Sad Path: Validasi pelanggan wajib saat memilih Kasbon (DEBT), checkout kasbon UNPAID dengan jatuh tempo +7 hari, dan pelunasan penuh di Backoffice Buku Piutang menjadi PAID.
  │       • 🔴 Bad Path: Validasi underpaid split payment (uang tunai Rp 10.000 < porsi Rp 25.000) memblokir submit dengan warning merah "- Rp 15.000".
  ├── 2. Integrasi UI/UX & Perbaikan Penanganan Pointer:
  │   - PosTerminalView.tsx: Memperbaiki handleSplitBill agar membuka setSplitBillModalOpen(true) (sebelumnya langsung ke PaymentModal).
  │   - BackofficeLayout.tsx: Menyembunyikan FloatingGuideWidget secara otomatis saat kasir POS aktif (activeTab !== 'pos') agar tidak memblokir tombol keranjang & Split Bill.
  │   - CustomerDebtsPage.js: Memperbaiki amount input overwrite agar tombol bayar lunas 100% tidak ter-reset ke 0.
  │   - PosTerminalPage.js: Ditambahkan method dismissSuccessModal dan clearCart untuk isolasi state antar skenario.
  ├── 3. Verifikasi Stabilitas & Zero Flakiness (5x Berturut-Turut):
  │   - Eksekusi Run 1 s.d Run 5 berturut-turut: LULUS 100% (Exit code 0).
  │   - Skrip npm kanonikal terdaftar: "npm run test:visual:split-debt".
  │   - Seluruh artefak visual screenshot tersimpan di: docs/artifacts/visual_split_debt/ (happy_path [01-05], sad_path [01-06], bad_path [01]).
  └── 4. Verifikasi Sistem: Exit code 0 pada build pos_apps/client dan pos_apps/server.
===============================================================
[2026-10-07] BDD GHERKIN AUTOMATION: END OF SHIFT, Z-REPORT & AUDIT SELISIH KAS (LANGKAH 5) & MARKETING KIT PLAYBOOK
  ├── 1. Spesifikasi Formal BDD Gherkin Dwibahasa:
  │   - features/end_of_shift_and_financial_audit.feature: Bahasa Indonesia formal (Fitur, Skenario, Dengan, Ketika, Maka, Dan).
  │   - features/end_of_shift_and_financial_audit.en.feature: Standard English formal (Feature, Scenario, Given, When, Then, And).
  │   - 3 Skenario Kanonikal:
  │       • 🟢 Happy Path: Tutup shift kasir dengan kas fisik pas (Expected = Actual), terbit Z-Report termal, status audit SEIMBANG (Rp 0).
  │       • 🟡 Sad Path: Deteksi defisit kas (-Rp 20.000), input catatan wajib serah terima, terbit Z-Report defisit, status audit KURANG (SHORT).
  │       • 🔴 Bad Path: Proteksi penolakan uang fisik negatif (-50000) via HTTP 400 Bad Request ("Validasi uang fisik gagal").
  ├── 2. Publikasi Panduan Marketing Kit & Sales Playbook Komprehensif:
  │   - docs/MARKETING_KIT_SALES_PLAYBOOK.md: Dokumen utuh pegangan materi promosi, 5 Core USPs, pitch scripts, komparasi kompetitor, dan demo sandbox 3 menit.
  ├── 3. Verifikasi Stabilitas & Zero Flakiness (5x Berturut-Turut):
  │   - Eksekusi Run 1 s.d Run 5 berturut-turut: LULUS 100% (Exit code 0).
  │   - Skrip npm kanonikal terdaftar: "npm run test:visual:shift-audit".
  │   - Seluruh artefak visual screenshot tersimpan di: docs/artifacts/visual_shift_audit/ (happy_path [01-05], sad_path [01-03], bad_path [01]).
  └── 4. Verifikasi Sistem: Exit code 0 pada build pos_apps/client dan pos_apps/server.
===============================================================
[2026-10-09] PEMISAHAN DOMAIN TOKO PENJUALAN (POS) DAN GUDANG LOGISTIK (INVENTORY) & ADR-009
  ├── 1. Keputusan Arsitektur & Information Architecture (ADR-009):
  │   - Pemisahan tegas domain Toko Penjualan (Frontline POS) dan Gudang Logistik (Backline Supply Chain).
  │   - Eliminasi kebingungan kognitif toggle "Toko vs Gudang" dan risiko mutasi tipe entitas saat proses edit.
  ├── 2. Halaman Mandiri Kelola Gudang (WarehousesView.tsx):
  │   - Ditempatkan di bawah grup navigasi sidebar: Bahan Baku & Stok -> Kelola Gudang (?tab=warehouses).
  │   - Menampilkan daftar fasilitas gudang logistik (isWarehouse: true), metrik toko cabang yang disuplai, tombol "Buka Mode Gudang", dan form tambah/edit gudang responsif.
  ├── 3. Halaman Terisolasi Toko Penjualan (OutletsView.tsx):
  │   - Ditempatkan murni di bawah: Pengaturan Resto & Outlet -> Profil & Outlet Toko (?tab=outlets).
  │   - Murni untuk toko ritel/kasir (isWarehouse: false) dengan tipe entitas terkunci permanen.
  │   - Form tambah & edit toko menyertakan dropdown sumber pasokan: "Gudang Sumber Pasokan (Backflush Warehouse): [Pilih Gudang / Toko Mandiri]".
  ├── 4. Backend Guardrails & Integritas Rantai Pasok (outlet.controller.ts):
  │   - Gudang logistik dipaksa warehouseId = null.
  │   - Anti Self-Referencing Guard: Toko dilarang menunjuk dirinya sendiri sebagai gudang pasokan.
  │   - Target Warehouse Validation: Memastikan target berstatus isWarehouse: true, aktif, dan milik tenant yang sama.
  ├── 5. Suite Pengujian Regresi Otomatis (test_outlet_warehouse_regression.ts):
  │   - 13/13 skenario uji regresi lulus 100% (Toko Mandiri, Toko Pasokan Gudang, Outlet Gudang, Pemotongan Resep BOM Backflush, Keamanan E.164, Tenant Isolation, Self-Referencing Guard).
  └── 6. Verifikasi Sistem: Exit code 0 pada build pos_apps/client dan pos_apps/server.
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
[FASE 11: PENYELESAIAN AUDIT KESIAPAN UI/UX, ANTI-PATTERNS & PARITAS F&B MODIFIERS QR MENU (PRIORITAS 1 & 2)] - SELESAI ✅
• Evaluasi UI/UX Menyeluruh Seluruh Modul:
  - Analisis 32 client views & modal components di 13 modul fitur, dengan skor rata-rata kesiapan global 91.8% (~92%).
• Eksekusi Tuntas Prioritas 1 (Kepatuhan Anti-Patterns & Standar Arsitektur AGENTS.md):
  - Eliminasi Hardcoded Tenant Fallback (`OutletsView.tsx`): Menghapus fallback `'ura-coffee'`, menggantinya dengan penanganan `storeId || 'BELUM DIATUR'` dan proteksi tombol salin link.
  - Standarisasi Normalisasi WhatsApp `<WhatsAppInput />`: Diterapkan di `CustomerQrMenuView.tsx`, `SuppliersView.tsx`, dan `InventoryView.tsx`.
  - Penegakan Zero Stacked Modals Policy:
    * `PaymentModal.tsx`: Menghapus modal tumpuk `<UpgradeModal />` pada tab SPLIT; menggantinya dengan inline alert card panduan kasir dan tombol nonaktif aman.
    * `SupervisorFeesModal.tsx` & `CategoryModal.tsx`: Mengganti modal tumpuk `<ConfirmModal />` dengan konfirmasi inline aksi langsung pada baris tabel (`Hapus? [Ya] [Batal]`).
  - Standarisasi Input Nominal Rupiah `<CurrencyInput />` (`SuperadminDashboardPage.tsx`): Input diskon nominal Rp, diskon maksimal Rp, dan minimal belanja kini menggunakan pemisah ribuan titik otomatis.
• Eksekusi Tuntas Prioritas 2 (Paritas Topping / Modifiers F&B pada QR Menu Meja Tamu):
  - Backend Relational Modifiers Query (`qr_menu.service.ts`):
    * `getPublicMenu`: Otomatis memuat relasi `productModifierGroup` dengan `modifierGroup.items` untuk seluruh produk katalog aktif pada outlet yang dibuka tamu.
    * `submitOrderSchema` (`qr_menu.controller.ts`) & `submitPublicOrder` (`qr_menu.service.ts`): Menerima snapshot `modifiers`, menghitung subtotal pesanan secara presisi, dan menyimpan `modifiers_snapshot` ke tabel `order_items` sehingga tiket dapur (KOT) dan struk kasir otomatis menampilkan topping yang dipilih tamu.
  - Client-Side Modifiers & Cart Parity (`CustomerQrMenuView.tsx` & `types/qr_menu.ts`):
    * Dukungan `modifiers?: ProductModifierGroup[]` pada produk menu publik.
    * Bottom-sheet / modal kustomisasi produk: Tamu dapat memilih varian dan modifier/topping (SINGLE radio maupun MULTIPLE checkbox) dengan live kalkulasi penyesuaian harga (`priceDelta`), badge wajib/opsional, dan validasi grup required sebelum masuk keranjang.
    * Review Keranjang & Faktur: Setiap item di keranjang menampilkan rincian topping terpilih (misal: `Topping: Boba (+Rp 3.000)`).
• Eksekusi Standarisasi Empty State Kanonikal (Komponen Bersama `<EmptyState />`):
  - Dibuat komponen kanonikal `src/components/ui/EmptyState.tsx` berpalet Clean White-Blue, ikon lembut, judul, deskripsi informatif, serta tombol Call-to-Action (CTA) interaktif.
  - Diintegrasikan serentak ke tabel data utama:
    * `OrdersView.tsx`: Riwayat transaksi kasir kosong.
    * `CustomersView.tsx`: Tabel master pelanggan (dengan tombol CTA "+ Tambah Pelanggan Pertama") serta detail tab histori order & mutasi poin.
    * `SuppliersView.tsx`: Tabel vendor pemasok (dengan tombol CTA "+ Daftarkan Pemasok Pertama").
    * `PurchaseOrdersView.tsx`: Tabel dokumen pengadaan (dengan tombol CTA "+ Buat Purchase Order").
    * `StockTransfersView.tsx`: Tabel transfer antar gerai/gudang (dengan tombol CTA "+ Buat Transfer Stok").
    * `InventoryView.tsx`: Tabel kartu riwayat mutasi stok bahan/produk.
• Eksekusi Tuntas Point 3 (Perceived Speed & Zero Layout Shift via `<TableSkeleton />`):
  - Dibuat komponen kanonikal `src/components/ui/TableSkeleton.tsx` yang mengeksekusi shimmer animation bertingkat untuk elemen `<tbody>` tabel dengan dukungan parameter `rows`, `columns`, `avatarCol`, dan `actionCol`.
  - Mengeliminasi spinner berputar yang menyebabkan layout jump / shift (CLS) saat muat data pada 6 halaman utama:
    * `FinancialReportView.tsx`: Tabel tren penjualan harian (8 kolom) & widget loading awal.
    * `OrdersView.tsx`: Tabel riwayat transaksi desktop (8 kolom) & shimmer card mobile.
    * `CustomersView.tsx`: Tabel member pelanggan (7 kolom) & shimmer card mobile.
    * `SuppliersView.tsx`: Tabel vendor pemasok (8 kolom).
    * `PurchaseOrdersView.tsx`: Tabel dokumen pengadaan PO (7 kolom).
    * `StockTransfersView.tsx`: Tabel mutasi transfer antar cabang/gudang (6 kolom).
    * `InventoryView.tsx`: Tabel bahan baku mentah (7 kolom), stok ritel (7 kolom), dan riwayat kartu mutasi (6 kolom).
• Eksekusi Tuntas Point 4 (Floating Toast Feedback System non-blocking):
  - Modernisasi container `DialogContext.tsx` dengan sistem floating pill di pojok kanan bawah (`bottom-6 right-6`), aksen border tajam per jenis status (`emerald`, `rose`, `blue`), auto-dismiss timer, dan animasi geser halus.
  - Mengganti dialog alert yang menghentikan alur kerja pengguna (*blocking pop-ups*) menjadi toast instan untuk aksi cepat:
    * Salin ID gerai & simpan outlet (`OutletsView.tsx`).
    * Simpan kustomisasi format struk thermal kasir (`ReceiptSettingsView.tsx`).
    * Tambah & edit data pelanggan member (`CustomersView.tsx`).
    * Pendaftaran & pembaruan data vendor pemasok (`SuppliersView.tsx`).
    * Konfirmasi penerimaan fisik barang PO (`PurchaseOrdersView.tsx`).
    * Pengiriman transfer ke kurir & penerimaan mutasi stok di cabang tujuan (`StockTransfersView.tsx`).
• Eksekusi Tuntas Point 5 (Authentic Live Thermal Receipt Visualizer `<ThermalReceiptPreview />`):
  - Dibuat komponen visualizer struk autentik `src/components/ThermalReceiptPreview.tsx` dengan efek gerigi sobek kertas thermal (*sawtooth zigzag pure CSS*), bayangan kertas gulung, tipografi font-monospace kasir, dan penyesuaian lebar nyata:
    * Mode Kertas 58mm (2.25 inci / w-64 ringkas, font 10px).
    * Mode Kertas 80mm (3.125 inci / w-80 lapang, font 11px).
  - Dilengkapi kotak nomor panggilan antrian (#05), rincian pesanan multi-item beserta modifiers, subtotal, pajak resto PB1 10%, pelunasan QRIS LUNAS, catatan kaki dinamis (footer note), dan cap stempel QR verifikasi keaslian nota belanja.
  - Diintegrasikan langsung pada menu pengaturan struk `ReceiptSettingsView.tsx` menggantikan markup statis sebelumnya.
• Hasil Uji Verifikasi Sistem:
  - Exit code 0 pada `pos_apps/client` dan `pos_apps/server`.
================================================================================
```

---

```text
================================================================================
[2026-10-05] INTEGRASI PAKASIR QRIS DINAMIS PADA REGISTRASI AWAL OWNER (SAAS ONBOARDING)
================================================================================
• Backend Dynamic Pakasir Transaction on Registration (`saas.controller.ts`):
  - Saat calon merchant mendaftar di Landing Page (`POST /api/saas/register`) dengan biaya pendaftaran > Rp 0 (atau setelah potongan kupon promo):
    * Otomatis memicu pembuatan transaksi QRIS dinamis via `pakasirService.createTransaction({ orderId: invoiceNumber, amount: finalAmount, method: 'qris' })`.
    * Menyimpan `externalTxnId: qrisData.txnId`, `paymentGateway: 'QRIS_PAKASIR'`, dan `paymentUrl: qrisData.paymentUrl` pada `SaaSInvoice`.
    * Mengembalikan payload respons `data.payment` lengkap (`invoiceNumber`, `amount`, `discountAmount`, `bonusTokens`, `isFree`, `qrString`, `paymentUrl`, `expiredAt`, `isSandbox`).
• Frontend Dynamic QRIS Display & Real-Time Polling (`SaasLandingPage.tsx`):
  - Penyesuaian antarmuka Modal Registrasi (Zero Stacked Modals, auto-adapt `size="lg"`):
    * Menampilkan banner total pembayaran aktivasi dan nomor invoice.
    * Menampilkan barcode QRIS dinamis beresolusi tinggi menggunakan data `qrString` Pakasir.
    * Indikator live status dengan animasi ping: "Menunggu pembayaran via QRIS... (Sistem mengecek otomatis)".
    * Auto-polling status ke `GET /api/saas/pakasir/status/:invoiceNumber` setiap 3.5 detik.
    * Tombol manual "Cek Status Pembayaran Sekarang" (`RefreshCw`).
    * Tombol uji coba pengembang "⚡ Simulasikan Pembayaran Berhasil (Uji Coba Sandbox)" (`api.simulatePakasirSandboxPayment`).
• Auto-Activation on Payment Settlement:
  - Webhook Pakasir / Polling Status secara otomatis memanggil `billingService.processPaymentWebhook`:
    * Mengubah status `SaaSInvoice` menjadi `PAID`.
    * Mengaktifkan akun tenant menjadi `TenantStatus.ACTIVE`.
    * Mengkreditkan kuota token transaksi awal secara instan.
  - Antarmuka Landing Page langsung bertransisi mulus ke tampilan konfirmasi hijau: "Selamat Datang, [Owner]! Pembayaran berhasil dikonfirmasi via QRIS Pakasir. Akun pemilik dan kuota token Anda telah aktif", lengkap dengan tombol langsung "Masuk ke Backoffice / Kasir".
• Hasil Uji Verifikasi Sistem:
  - Exit code 0 pada `pos_apps/client` dan `pos_apps/server`.
================================================================================
```

---

```text
================================================================================
[2026-10-05] DIRECT BLUETOOTH THERMAL PRINTING (WEB BLUETOOTH API & RAW ESC/POS)
================================================================================
• Latar Belakang & Kebutuhan Lapangan (Soloraya / Warung / Resto):
  - Mengeliminasi jeda antrean kasir akibat pop-up print browser bawaan (window.print).
  - Kasir membutuhkan 1-klik langsung cetak ke printer thermal Bluetooth mini (Panda, Goojprt, Iware, MPT-II, RPP02N, Epson, Xprinter) baik format 58mm maupun 80mm.
• Arsitektur Generator ESC/POS Universal (`src/utils/escpos.ts`):
  - Builder biner mentah (Uint8Array) untuk perintah ESC/POS universal:
    * Inisialisasi printer (`ESC @`), perataan teks kiri/tengah/kanan (`ESC a n`), cetak tebal (`ESC E n`).
    * Perbesaran teks 2x/3x (`GS ! n`) untuk nomor antrean (#01) dan nama toko.
    * Pemformatan otomatis 2 kolom sejajar: 32 kolom untuk 58mm dan 48 kolom untuk 80mm.
    * Sinyal pemicu buka laci kasir otomatis (`ESC p 0 25 250`).
    * Pemotongan kertas otomatis (`GS V A n`) untuk printer yang memiliki automatic cutter.
• Web Bluetooth Communication Service (`src/services/bluetoothPrinter.service.ts`):
  - Pemindaian dan pairing nirkabel langsung ke GATT Server printer thermal via Web Bluetooth API.
  - Multi-service UUID resolver mencakup printer standar, Posnet, ISSC Transparent UART, dan printer generic.
  - Safe BLE chunking (100 byte packets dengan delay inter-chunk 20ms) mencegah buffer overflow mikrokontroler printer murah.
• Custom React Hook (`src/hooks/useBluetoothPrinter.ts`):
  - Mengelola status reaktif (`disconnected`, `connecting`, `connected`, `error`), nama perangkat tersimpan, cetak struk pesanan, cetak uji coba, dan pemicu laci kasir.
• Integrasi Antarmuka Kasir & Pengaturan Struk:
  - `ReceiptSettingsView.tsx`: Kartu manajemen printer Bluetooth dengan tombol "Hubungkan Printer Bluetooth", indikator nama perangkat aktif, tombol "Cetak Uji Coba Kertas", dan tombol "Uji Buka Laci Kasir".
  - `OrderSuccessModal.tsx`: Tombol aksi primer "⚡ Cetak Langsung Bluetooth" di atas tombol browser/PDF. Sekali klik langsung mencetak struk thermal ke mesin fisik tanpa dialog perantara, sekaligus menendang laci kasir jika pembayaran tunai.
• Hasil Uji Verifikasi Sistem:
  - Exit code 0 pada `pos_apps/client` dan `pos_apps/server`.
================================================================================
```

---

```text
===============================================================================
[2026-10-06] PROGRESSIVE WEB APP (PWA) & 1-CLICK HOME SCREEN INSTALLATION
===============================================================================
• Latar Belakang & Kebutuhan Lapangan (Soloraya / Warung / Resto / Cafe):
  - Kasir dan staf outlet membutuhkan aplikasi yang terasa seperti aplikasi native Android/iOS/Windows/Mac tanpa navigasi browser, tanpa address bar, serta waktu muat sub-detik melalui cache lokal.
  - Membantu pemilik toko menginstal Well POS ke tablet kasir atau smartphone Android dalam 1 klik tanpa perlu masuk ke Google Play Store atau Apple App Store.
• Standar Web App Manifest (`public/manifest.webmanifest`):
  - Nama aplikasi: "Well POS - Sistem Kasir Modern & Backoffice".
  - Mode tampilan: `display: "standalone"`, `orientation: "any"`.
  - Warna tema: `#0f172a` (Slate-900) dan background `#ffffff`.
  - Icon PWA: Beresolusi tinggi format SVG (`icon-192.svg`, `icon-512.svg`, dan `icon-maskable.svg` dengan safe-zone margin 15%).
  - App Shortcuts: Langsung loncat ke Mesin Kasir (`#pos`), Laporan Penjualan (`#overview`), dan Pengaturan Printer Bluetooth (`#receipt_settings`).
• Service Worker Pintar (`public/sw.js`):
  - Pre-caching file shell statis saat install (`CACHE_NAME: wellpos-shell-v1`).
  - Cache Migration: Pembersihan cache versi lama secara otomatis pada event `activate`.
  - Network-First untuk seluruh `/api/*`: Menjamin transaksi kasir, stok, mutasi ledger, dan saldo tidak pernah stale/basi.
  - Stale-While-Revalidate untuk aset frontend (CSS, JS bundle, icon, font) untuk startup kilat di bawah 300ms.
• Arsitektur Service & Hook React (`pwa.service.ts` & `usePwaInstall.ts`):
  - Mencegat event bawaan `beforeinstallprompt` dan menyimpannya ke singleton service.
  - Deteksi mode tampilan standalone (`window.matchMedia('(display-mode: standalone)')` & `navigator.standalone`).
  - Deteksi perangkat iOS (Safari / iPhone / iPad) untuk menampilkan panduan 3-langkah (Bagikan -> Tambah ke Layar Utama).
• Antarmuka Pengguna & Komponen Kanonikal:
  - `PwaInstallBanner.tsx`: Floating banner di pojok bawah layar dengan animasi slide-in, tombol "Pasang Sekarang", dan opsi "Nanti Saja" (tersimpan di `sessionStorage` per sesi).
  - `PwaInstallButton`: Tombol ringkas `<PwaInstallButton />` yang disematkan secara terpusat dan ergonomis hanya pada bagian bawah menu Sidebar Backoffice (`BackofficeLayout.tsx`), menjaga header dan form pengaturan tetap bersih dan minimalis tanpa banyak tombol bertumpuk.
  - Dialog Interaktif iOS: Modal panduan beranimasi khusus pengguna Safari iOS dengan icon visual tombol Share Apple.
• Hasil Uji Verifikasi Sistem:
```text
===============================================================================
[2026-10-06] WATERMARK STRUK KASIR & NOTA DIGITAL "POWERED BY WELL POS" (OWNER MANAGED)
===============================================================================
• Latar Belakang & Kebutuhan Bisnis:
  - Membantu eksposur brand "Powered by Well POS" secara otomatis di setiap struk belanja, nota digital, cetak thermal, dan pesan WhatsApp yang dikirim ke pelanggan merchant.
  - Memenuhi preferensi fleksibilitas pemilik toko (owner) agar dapat mengaktifkan atau menonaktifkan watermark ini secara mandiri melalui pengaturan Backoffice Toko (default: AKTIF / true).
• Cakupan Implementasi Multi-Saluran (Omni-Channel Receipt Watermark):
  1. Backoffice Form Format Struk (`ReceiptSettingsView.tsx`):
     - Toggle switch mandiri pada Bagian 6: "Watermark Struk ('Powered by Well POS')".
     - Terhubung ke `activeOutlet.receiptConfig.showWatermark` (default `true` / aktif).
     - Live preview real-time pada simulator thermal struk (`ThermalReceiptPreview.tsx`).
  2. Modul POS Layar Kasir (`OrderSuccessModal.tsx`):
     - Menampilkan watermark "Powered by Well POS" di bagian bawah struk on-screen dan dialog print browser (`window.print`).
     - Teks WhatsApp struk otomatis menyertakan `_Powered by Well POS_` jika `showWatermark !== false`.
  3. Dokumen Struk PDF (`receiptPdf.ts`):
     - Generator PDF struk mencetak teks tebal "Powered by Well POS" di akhir dokumen jika `showWatermark !== false`.
  4. Cetak Langsung Bluetooth ESC/POS Thermal (`escpos.ts` & `bluetoothPrinter.service.ts`):
     - Opsi `EscPosOptions.showWatermark` diteruskan ke `buildReceiptEscPos`.
     - Baris 'Powered by Well POS' hanya dicetak ke mikrokontroler printer fisik jika `showWatermark !== false`.
  5. Backend WhatsApp Gateway (`whatsapp.service.ts`):
     - Format teks digital otomatis menyertakan identitas `_Powered by Well POS_` saat pengiriman WhatsApp gateway checkout.
  6. Backend Validasi & Model Data:
     - `outlet.controller.ts`: Menambahkan validasi Zod `showWatermark: z.boolean().optional()` di `receiptConfig`.
     - `saas.controller.ts`: Onboarding toko dan pembuatan cabang baru otomatis menginisialisasi `showWatermark: true`.
```text
===============================================================================
[2026-10-06] OPTIMALISASI MODAL STRUK KASIR & WHATSAPP GATEWAY (RESPONSIVE & PWA)
===============================================================================
• Resolusi Anti-Pattern Zero Stacked Modals (`OrderSuccessModal.tsx`):
  - Mengeliminasi pop-up modal WhatsApp & Email yang sebelumnya bertumpuk di atas modal struk (menghilangkan benturan double close button 'X' dan backdrop ganda).
  - Menggantinya dengan transisi sub-view inline (`modalView: 'RECEIPT' | 'WHATSAPP' | 'EMAIL'`) di dalam kartu modal yang sama.
• Anti-Overflow & Zero Clipping ("Anti-Nabrak ke Atas"):
  - Header dan footer action panel dikunci menggunakan `shrink-0`.
  - Area chat WhatsApp dibungkus container elastis `flex-1 min-h-0 overflow-y-auto`. Seberapa panjang pun daftar belanja struk (bahkan 50+ item), konten akan bergulir mulus di dalam area chat tanpa mendorong header atau tombol keluar layar.
• Tata Kelola WhatsApp Gateway (Manual vs Fonnte API):
  - Jika token belum diaktivasi (Mode Manual): Tombol otomatis via gateway dinonaktifkan dari simulasi palsu. Sistem menampilkan panduan aktivasi Fonnte terintegrasi dan memprioritaskan tombol "Buka wa.me" (langsung membuka WhatsApp kasir dengan pesan terisi penuh) serta "Salin Teks".
  - Jika token Fonnte aktif: Tombol pengiriman otomatis via gateway diaktifkan.
• Hasil Uji Verifikasi Sistem:
  - Exit code 0 pada `npm run build` di `pos_apps/client` dan `pos_apps/server`.
===============================================================================
[2026-10-06] TIMEZONE NORMALIZATION & POSTGRESQL AT TIME ZONE UTC FIX
===============================================================================
• Latar Belakang & Investigasi Bug:
  - Transaksi yang dibuat pada pagi hari (05:00-06:00 WIB = 22:00-23:00 UTC hari sebelumnya) tidak muncul pada filter "Hari Ini" di riwayat pesanan Backoffice.
  - Akar masalah: Kolom `created_at` bertipe `timestamp without time zone`. PostgreSQL memadukan nilai ini dengan timezone session `Asia/Jakarta`, menyebabkan pergeseran 7 jam ke belakang.
• Resolusi Arsitektur (Rule 25):
  - Mengubah seluruh klausa perbandingan SQL raw dari `created_at >= $1` menjadi `created_at >= ($1 AT TIME ZONE 'UTC')` di 6 file backend: `sales.read_adapter.ts`, `report.read_adapter.ts`, `inventory.read_adapter.ts`, `analytics.service.ts`, `order.controller.ts`, dan `sales.dual_write.service.ts`.
  - Berhasil divalidasi: Transaksi pagi hari langsung tampil 100% presisi pada filter tanggal kalender lokal WIB.

===============================================================================
[2026-10-06] KEBIJAKAN INTEGRITAS PESANAN SUSULAN & OPEN TAB
===============================================================================
• Evaluasi Celah Pesanan Susulan:
  - Transaksi yang sudah lunas (`PAID`) merupakan rekonsiliasi fiskal final (*closed accounting record*). Menambahkan item baru ke transaksi yang sudah lunas merusak integritas pembukuan dan memicu anomali pembayaran ganda/terpisah.
• Kebijakan & Penegakan Sistem (Rule & Flow):
  1. Larangan Susulan Transaksi Lunas (`PAID`):
     - Menghapus tombol "Order Susulan" dari `OrderSuccessModal.tsx`.
     - Menyembunyikan tombol "+ Susulan" pada transaksi `PAID` di `OrdersView.tsx` (tabel desktop & kartu mobile) serta di `OrderDetailModal.tsx`.
     - Jika pelanggan yang sudah melunasi tagihannya ingin memesan menu tambahan, kasir membuat transaksi baru secara standar di POS Terminal.
  2. Aksi "+ Susulan" Dikhususkan Eksklusif untuk Meja Aktif Belum Bayar (`UNPAID`):
     - Tombol "+ Susulan" hanya muncul pada pesanan Dine-In dengan `paymentStatus === 'UNPAID'`.
     - Ketika kasir mengklik "+ Susulan", sistem menjalankan alur `handlePullAppendOrder` di `PosTerminalView.tsx`: item sebelumnya dimuat utuh ke keranjang kasir (`cart`), mengikat `activePulledOrder` & `activeOpenTab` (`existingOrderId`), sehingga penambahan menu baru otomatis menyatu ke tagihan meja yang sama tanpa konflik meja terisi (*table occupied conflict*).
===============================================================================
[2026-10-06] EXPANSION PUSAT PANDUAN & SOP OPERASIONAL: 18 BAB INTEGRATIF
===============================================================================
• Latar Belakang & Pembaruan Kebutuhan:
  - Dokumentasi panduan operasional pada `UserGuideView.tsx` dan `FloatingGuideWidget.tsx` diselaraskan penuh dengan seluruh fitur enhancement terbaru.
  - Sesuai prinsip segregasi peran: Keputusan otomatisasi dan konfigurasi gateway berada di ranah Owner/Admin, sedangkan Kasir fokus pada operasional transaksi cepat.
• Penambahan 5 Bab Baru (Total 18 Bab Lengkap):
  1. Bab 14: Printer Kasir Bluetooth Thermal (Web Bluetooth BLE 58mm/80mm ESC/POS, pairing tanpa driver desktop, 1-klik cetak struk kasir).
  2. Bab 15: Integrasi WhatsApp Gateway & Resi Digital (Fonnte) — wewenang otomatisasi di tangan Owner, input nomor di kasir, background non-blocking dispatch, dan fallback wa.me.
  3. Bab 16: Aplikasi Kasir Desktop & Tablet (Progressive Web App / PWA Standalone window tanpa browser address bar, loading instan via Service Worker).
  4. Bab 17: Alur Open Tab Meja & Kebijakan Pesanan Susulan (Anti-Fraud Policy: Meja UNPAID dapat disusul via keranjang kasir, pesanan PAID terkunci total untuk mencegah manipulasi kas fisik laci).
  5. Bab 18: Metode Pembayaran Kasir & Integrasi QRIS / EDC (Pemisahan omzet tunai laci vs non-tunai di laporan Z-Report).
• Sinkronisasi Floating Contextual Guide (`FloatingGuideWidget.tsx`):
  - Memetakan tab `settings_receipt` ke panduan Bluetooth & WA Gateway, dan tab `settings_payment` ke panduan Metode Pembayaran.
• Hasil Uji Verifikasi Sistem:
  - Exit code 0 pada `npm run build` di `pos_apps/client` dan `pos_apps/server`.
===============================================================================
[2026-10-06] POLA KANONIKAL FORM MODAL RESPONSIVE PWA & BACKGROUND PHOTO COMPRESSION
===============================================================================
• Bug 1: Eliminasi Jargon & Statistik Teknis Kompresi Foto dari UI Tenant:
  - Latar Belakang: Tenant/kasir tidak perlu tahu detail teknis kompresi ukuran berkas (misal: "Terkompresi otomatis: 1.2 MB -> 120 KB (-90%)").
  - Keputusan & Penegakan:
    1. Mesin kompresi client-side (`imageCompressor.ts`) TETAP bekerja hening 100% di latar belakang (background) agar database hemat kuota dan terminal kasir cepat memuat katalog.
    2. Seluruh badge persentase/rasio kompresi dihapus dari UI (`ProductModal.tsx`, `PaymentSettingsView.tsx`).
    3. Label status loader disederhanakan dari "Mengompres..." menjadi "Memproses...".
    4. Pesan toast sukses diringkas menjadi "Foto produk / barcode berhasil diunggah" tanpa angka kompresi teknis.

• Bug 2: Pola Kanonikal Modal Form Responsif & Anti-Unscrollable di Mobile / Safari / PWA:
  - Latar Belakang: Form modal seperti Stok Masuk (`StockMovementModal.tsx`), Tutup Shift (`CloseShiftModal.tsx`), dan form lainnya tidak bisa di-scroll di layar HP iPhone / PWA atau tombol submit terdorong ke bawah layar.
  - Akar Masalah:
    1. Tombol Batal & Simpan berada di dalam container scrollable form sehingga terdorong keluar layar saat form panjang.
    2. Modal desktop `items-center` dengan `max-h-[90vh]` tidak adaptif terhadap dynamic viewport (`dvh`) Safari iOS.
    3. Tidak adanya safe-area padding di footer menyebabkan tombol tertutup swipe-bar navigasi iPhone.
  - Aturan Arsitektur UI Wajib (The Modal Canonical Pattern):
    ```tsx
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
        {/* 1. Header (Sticky Top) */}
        <div className="... shrink-0">...</div>

        {/* 2. Form Container */}
        <form onSubmit={...} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable Body */}
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1">
            {/* Input Fields */}
          </div>

          {/* 3. Sticky Action Footer */}
          <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button type="button" onClick={onClose}>Batal</button>
            <button type="submit">Simpan</button>
          </div>
        </form>
      </div>
    </div>
    ```
  - Telah Diimplementasikan & Divalidasi di 22 Komponen Modal:
    `StockMovementModal.tsx`, `ProductModal.tsx`, `CloseShiftModal.tsx`, `StartShiftModal.tsx`, `CashExpenseModal.tsx`, `VoidOrderItemModal.tsx`, `VoidOrderModal.tsx`, `OrderDetailModal.tsx`, `PaymentModal.tsx`, `StockTransferModal.tsx`, `CreateIngredientModal.tsx`, `CategoryModal.tsx`, `ProductModifierModal.tsx`, `ProductBarcodeLabelsModal.tsx`, `AssignCatalogProductModal.tsx`, `OpenTabsModal.tsx`, `SplitBillModal.tsx`, `BarcodeCameraScannerModal.tsx`, serta basis generik `Modal.tsx`.
• Hasil Uji Verifikasi Sistem:
  - Exit code 0 pada `npm run build` di `pos_apps/client` dan `pos_apps/server`.
===============================================================================

===============================================================================
RECORD PEMBARUAN: PENYESUAIAN HAK AKSES & PERAN STAF (GRANULAR RBAC ALIGNMENT)
===============================================================================
• Konteks & Driver:
  - Menyelaraskan seluruh master izin sistem (SYSTEM_PERMISSIONS) dan peran standar bawaan (DEFAULT_FNB_ROLES) terhadap fitur-fitur baru yang telah diimplementasikan pada Fase 1, Fase 2, dan Fase 3.
• Izin Sistem Baru yang Ditambahkan (Backend role.service.ts & Frontend StaffRolesView.tsx):
  1. Kategori Kasir & Penjualan POS (REGISTER_SALES):
     - `sales_cash_expense`: Catat Kas Keluar / Pengeluaran Kasir
     - `sales_customer_debt`: Pemberian Kasbon Pelanggan di Layar Kasir POS (Piutang)
     - `sales_debt_payment`: Terima Setoran Pelunasan Kasbon Pelanggan di Kasir
     - `attendance_clock`: Absensi Mandiri Staf (Clock In & Clock Out via PIN Kasir)
  2. Kategori Menu & Resep (CATALOG_RECIPES):
     - `menu_barcode_labels`: Cetak Label Barcode & Stiker Rak Produk (Shelf Tags)
  3. Kategori Laporan & Finansial (REPORTS_FINANCIAL):
     - `report_cash_flow`: Laporan Arus Kas Riil (Cash Flow Statement & Rekap Kas Bersih)
     - `crm_debt_manage`: Buku Kasbon CRM & Penagihan Piutang (Kirim WhatsApp Pengingat)
  4. Kategori Pengaturan & Tata Kelola (SETTINGS_GOVERNANCE):
     - `attendance_manage`: Rekapitulasi Absensi Seluruh Staf & Pengaturan Jam Kerja Outlet
• Penyelarasan Peran Bawaan Sistem (DEFAULT_FNB_ROLES):
  - `role-owner`: Akses penuh 100% tanpa batas ke seluruh izin sistem (otomatis diproteksi).
  - `role-supervisor`: Diberikan izin operasional lengkap mencakup kasbon, pelunasan kasbon, absensi mandiri, cetak barcode label, laporan arus kas, buku kasbon CRM, dan kelola rekap absensi.
  - `role-cashier`: Diberikan izin kasir inti, kas keluar kasir, transaksi kasbon pelanggan, pelunasan kasbon, dan absensi mandiri staf.
  - `role-warehouse`: Diberikan izin persediaan gudang, cetak barcode stiker rak, dan absensi mandiri staf.
  - `role-barista` (Kitchen): Diberikan izin katalog menu, pantau stok, antrean hold, dan absensi mandiri staf.
  - `role-waiter` (Pramusaji): Diberikan template peran resmi untuk pemesanan meja, antrean hold, katalog menu, dan absensi mandiri staf.
• Sinkronisasi Dashboard & Tipe Frontend:
  - `UserRole` di `types/auth.ts` diperluas menyertakan `'KITCHEN' | 'WAITER'` sesuai enum Prisma `Role`.
  - `DashboardPage.tsx` (`ROLE_TABS` & `DEFAULT_TAB`) disinkronkan untuk peran KITCHEN dan WAITER.
  - `UsersView.tsx` badge peran visual dipercantik untuk kru dapur dan pramusaji.
• Verifikasi Build:
  - Exit code 0 pada `npm run build` di `pos_apps/client` dan `pos_apps/server`.
===============================================================================

===============================================================================
RECORD AUDIT KRUSIAL: PENGUATAN OTORISASI & KEAMANAN API ROUTER-LEVEL (SECURITY HARDENING)
===============================================================================
• Konteks & Driver:
  - Double check mendalam terhadap potensi celah keamanan (bypassing RBAC) di mana token kasir/staf dapat memanggil endpoint mutasi atau analitik backend secara langsung melalui HTTP request.
• 8 Temuan Krusial & Solusi Penguatan yang Telah Diterapkan:
  1. Proteksi Laporan Finansial (report.routes.ts):
     - Masalah: Endpoint `/financial`, `/cash-flow`, `/dead-stock`, `/export` sebelumnya hanya memeriksa `authenticate`. Kasir dapat membaca laba bersih & mengekspor laporan.
     - Solusi: Seluruh rute laporan dikunci ketat dengan `authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR)`.
  2. Proteksi Pengaturan Absensi & Jadwal Kerja (attendance.routes.ts):
     - Masalah: Endpoint `/config`, `/sync-timezone`, `/report` dapat diakses staf non-manajerial.
     - Solusi: Dikunci dengan `authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR)`. Rute kasir tetap dapat mengakses `/today`, `/clock-in`, `/clock-out` dengan PIN staf.
  3. Proteksi Pengaturan Outlet, Saluran & Pajak PB1 (outlet.routes.ts):
     - Masalah: `updateOutletFees`, `updateOutletChannels`, `updateOutletPaymentConfig` tidak memiliki guard peran.
     - Solusi: Dikunci dengan `authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR)`. `createOutlet` dikunci khusus `Role.OWNER, Role.ADMIN`.
  4. Proteksi Mutasi Katalog, Varian & Resep HPP (product, category, modifier, recipe):
     - Masalah: Endpoint `POST/PUT/DELETE` produk, kategori, modifier, dan resep tidak dilindungi di tingkat router.
     - Solusi: Seluruh mutasi dikunci dengan `authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE)`. `GET` tetap terbuka untuk staf kasir agar POS dapat melakukan checkout.
  5. Proteksi Diskon & Promosi (promotion.routes.ts):
     - Masalah: Pembuatan & penghapusan voucher/promosi belum di-guard peran.
     - Solusi: Mutasi dikunci dengan `authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR)`. Validasi voucher tetap terbuka untuk kasir.
  6. Integritas Data Kasbon & Pencegahan Hapus Pelanggan Berhutang (customer.controller.ts & customer.routes.ts):
     - Masalah: Menghapus pelanggan yang memiliki kasbon aktif dapat merusak relasi foreign key atau menghilangkan piutang.
     - Solusi: `DELETE /api/customers/:id` dikunci dengan `authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR)` dan divalidasi tidak boleh menghapus pelanggan yang memiliki riwayat kasbon piutang aktif.
  7. Proteksi Akun Owner Utama (user.controller.ts):
     - Masalah: Potensi penghapusan akun Owner oleh Admin atau perubahan status `role-owner` menjadi tidak aktif via API peran.
     - Solusi: `deleteUser` menolak tegas penghapusan user ber-role `OWNER`. `updateRole` mengunci status `role-owner` agar selalu aktif dan memiliki 100% hak akses.
  8. Privasi Histori Shift Kasir (shift.controller.ts):
     - Masalah: Kasir biasa dapat melihat ringkasan audit selisih kas fisik seluruh kasir lain.
     - Solusi: `getShiftHistory` otomatis men-scope query ke `userId: req.user.id` jika pemanggil bukan Owner/Admin/Supervisor.
• Verifikasi Build:
===============================================================================
[07 OKTOBER 2026] LANDING PAGE OVERHAUL: RESPONSIVE NAV, SCROLL-TO-TOP, DEDICATED PROMO CATALOG & SUPERADMIN PROMO PUBLISHING ENGINE
===============================================================================
• Konteks & Driver:
  - Permintaan perombakan navigasi atas landing page publik Well POS agar pengunjung mudah berpindah antar-section (#tampilan, #fitur, #biaya, #promo, #faq), menu mobile drawer responsif, tombol floating scroll-up, penambahan katalog kode promo publik dari Superadmin, serta penyempurnaan copywriting 6 kartu manfaat yang lebih membumi, to the point, dan profesional.
• Rincian Implementasi:
  1. Skema Database & DDL (schema.prisma & schema_patcher.ts):
     - Menambahkan kolom `isPublished Boolean @default(true) @map("is_published")` dan `description String? @map("description")` pada model `SaaSPromo`.
     - Didaftarkan ke migration patch `20261007_01_saas_promos_is_published` dan dieksekusi idempotent ke PostgreSQL.
  2. Backend Controller & API Routes:
     - Endpoint publik `GET /api/saas/promos/public` (`getPublicPublishedPromos`): mengembalikan voucher aktif yang berstatus `isPublished: true` dan belum kadaluwarsa.
     - Endpoint Superadmin `PATCH /api/platform/promos/:id/toggle-publish` (`togglePublishPlatformPromo`): mengaktifkan/menyembunyikan voucher dari katalog web publik.
     - Pembaruan `createPlatformPromo` untuk menerima `description` dan opsi `isPublished`.
  3. Superadmin Dashboard (`SuperadminDashboardPage.tsx`):
     - Tab `PROMOS`: Ditambahkan badge visual ("PUBLIK WEB" / "TERSEMBUNYI"), preview deskripsi voucher, dan tombol aksi "Web: On / Web: Off".
     - Modal Create Promo: Ditambahkan field input deskripsi/syarat voucher dan checkbox publikasi ke landing page.
  4. Landing Page (`SaasLandingPage.tsx`):
     - Top Navigation Bar: Sticky header dengan link desktop ("Tampilan Kasir", "Fitur Toko", "Biaya & Token", "Promo Spesial", "Tanya Jawab"), tombol aksi CTA, serta mobile hamburger drawer yang responsif dan rapi.
     - Floating Scroll-to-Top: Tombol melayang di sudut kanan bawah (`ChevronUp`) dengan transisi halus saat halaman di-scroll > 300px.
     - Dedicated Promo Catalog Section (`#promo`): Tampilan katalog voucher bergaya tiket kupon modern, filter pill (Semua, Khusus Pendaftaran, Khusus Top-Up), kode voucher box dengan tombol Salin (Copy 1-klik), dan tombol "Gunakan Voucher Ini" yang otomatis membuka modal pendaftaran dengan kupon terisi dan tervalidasi secara instan.
     - Penyempurnaan Copywriting 6 Kartu Manfaat:
       1. "Fleksibel di Tablet Maupun Smartphone" (elegan, tanpa merendahkan perangkat kasir lain)
       2. "Laporan Penjualan & Keuntungan Real-Time" (menggantikan kata kasbon/tagih santun yang tidak membumi)
       3. "Manajemen Stok Otomatis & Resep Bahan Baku" (profesional, menggantikan istilah anti-bocor)
       4. "Mendukung Struk Digital via WhatsApp" (to the point)
       5. "Fitur Absensi & Hak Akses Karyawan" (to the point)
       6. "Buka Cabang Baru & Manajemen Multi-Outlet"
• Verifikasi QA & Browser:
  - Exit code 0 pada `npm run build` di `pos_apps/server` dan `pos_apps/client`.
  - Uji otomatisasi Playwright lokal: Desktop nav, mobile drawer, floating back-to-top, dan auto-fill promo modal pendaftaran berhasil diverifikasi 100%.
===============================================================================
[07 OKTOBER 2026] TENANT ONBOARDING TESTING PLAYBOOK, FINITE STATE MACHINE (FSM) ARCHITECTURE & 3-PATH VISUAL REGRESSION SUITE (POM)
===============================================================================
• Konteks & Driver:
  - Standardisasi panduan pengujian manual end-to-end 8 fase dan skrip demo marketing/sales untuk calon tenant baru (Registrasi, Setup Toko & Struk, Katalog Produk & BOM, Kelola Kasir, Terminal POS & Struk WA, Fitur Khusus QR Meja & Void PIN Spv, Tutup Shift Blind Count, dan Laporan Finansial).
  - Pemetaan kanonikal Finite State Machine (FSM) platform Well POS yang mengklasifikasikan 3 jalur keadaan:
    1. Happy Path: Alur ideal sukses tanpa hambatan (Registrasi -> Approval -> Store Wizard -> POS Shift -> Checkout -> Tutup Shift Seimbang).
    2. Sad Path: Empty states (STORE_EMPTY, CATALOG_EMPTY, SHIFT_CLOSED, CART_EMPTY) dan soft/recoverable errors (Email duplikat, stok habis, uang tunai kurang, selisih kas fisik/discrepancy tutup shift).
    3. Bad Path: Hard rejections (Superadmin tolak pendaftaran status SUSPENDED), security block (Void dengan PIN Supervisor salah), dan auth failure (Password salah).
  - Pembuatan visualizer diagram interaktif mandiri yang dapat dibuka langsung di browser dengan live simulator event.
  - Implementasi automasi Visual Regression Testing berbasis Playwright lokal menggunakan pola Page Object Model (POM), selector semantik, dan matriks responsif UMKM Indonesia (Android Smartphone 360x800, Android Tablet 1280x800, Desktop 1440x900).
• Rincian Artefak & Implementasi:
  1. Dokumentasi Panduan & Arsitektur FSM:
     - `docs/TENANT_ONBOARDING_AND_TESTING_GUIDE.md`: SOP 8 fase pengujian, 4 USP marketing pitch, dan panduan Playwright.
     - `docs/STATE_MACHINE_JOURNEY_SPEC.md`: Matriks FSM 7 sub-machine, diagram Mermaid lengkap, serta tabel referensi kanonikal notifikasi dialog alert dan toast.
     - `docs/artifacts/state_machine_interactive.html`: Visualizer interaktif berbasis HTML/CSS modern (Google Font Inter, glassmorphism, path filter switcher, state inspector drawer, dan live transition simulator).
     - `docs/README.md`: Pendaftaran dokumen baru ke indeks Segitiga Emas (Golden Triangle).
  2. Arsitektur Page Object Model (POM) (`scripts/pom/`):
     - `LandingPage.js`: Formulir 5-field registrasi dan penanganan warning email duplikat.
     - `LoginPage.js`: Dual-tab login (Kasir vs Owner) dan penanganan login invalid.
     - `SuperadminPage.js`: Triage pendaftar, approval, dan penolakan akun (reject tenant) dengan modal-scoped click selector.
     - `StoreWizardPage.js`: Layar penuh FullScreenStoreWizard, input WhatsApp, alamat, dan chips industri.
     - `BackofficePage.js`: Dashboard owner, navigasi tab menu, dan pintasan kasir.
     - `PosTerminalPage.js`: Buka shift modal awal, cart item, checkout tunai/QRIS, tutup shift seimbang & selisih kas fisik.
     - `CustomerQrPage.js`: Self-ordering digital menu meja tamu restoran.
     - `OrdersPage.js`: Riwayat pesanan dan pengujian keamanan void order dengan validasi PIN supervisor.
  3. Master Test Runner & Package Script:
     - `scripts/test_tenant_journey_visual_paths.js`: Runner terpadu mengeksekusi Happy Path, Sad Path, dan Bad Path secara otomatis.
     - `package.json`: Didaftarkan ke perintah `"test:visual"`.
  4. Artefak Tangkapan Layar Visual (`docs/artifacts/visual_journey/`):
     - `happy_path/`: 9 screenshot (Phone, Tablet, Desktop).
     - `sad_path/`: 5 screenshot (Empty states, duplicate email, shift locked, empty cart, insufficient cash, discrepancy).
     - `bad_path/`: 3 screenshot (Superadmin reject, void wrong PIN, auth failure).
• Investigasi & Resolusi Flakiness:
  - Error Awal: Timeout saat Superadmin klik konfirmasi tolak akun karena selector `|Tolak/i` bentrok dengan tombol di baris tabel yang tertutup backdrop modal.
  - Perbaikan: Selector di-scope spesifik ke tombol konfirmasi di dalam modal aktif `modal.getByRole('button', { name: /Ya, Tolak Pendaftaran/i })`.
  - Verifikasi Kestabilan: Pengujian dijalankan ulang sebanyak 5 kali berturut-turut (Run 1 s.d Run 5) dan berhasil 100% tanpa error (Exit code 0 berturut-turut).
• Status Build:
  - `npm run build:client` (tsc -b && vite build) = Exit code 0.
  - `npm run build:server` (tsc) = Exit code 0.
===============================================================================
[07 OKTOBER 2026] BDD / GHERKIN AUTOMATION FRAMEWORK & CASH DENOMINATION COUNTER (CALCULATOR PECAHAN UANG LACI KASIR) IMPLEMENTATION (OPSI A / LANGKAH 3)
===============================================================================
• Konteks & Driver:
  - Permintaan penegasan dan adopsi resmi BDD / Gherkin Syntax (`Feature`, `Scenario`, `Given`, `When`, `Then`, `And`) untuk automation testing sistem Well POS.
  - Eksekusi Roadmap Langkah 3 (Opsi A): Pengujian komprehensif siklus pergantian shift kasir, pencatatan kas masuk / kas keluar (*petty cash*), dan rekonsiliasi kas laci Z-Report.
  - Usulan Solusi Produk (*High-Value Feature*): Penyediaan Kalkulator Denominasi Uang Fisik (*Cash Denomination Counter*) langsung pada modal Tutup Shift (`CloseShiftModal.tsx`) agar kasir tidak perlu menghitung manual di kertas atau kalkulator eksternal.
• Rincian Implementasi Fitur Produk:
  1. Komponen Kalkulator Pecahan Uang Kertas & Koin (`CloseShiftModal.tsx`):
     - Accordion interaktif (*collapsible*) beraksen hijau lembut dengan ringkasan live lembar/keping uang terhitung.
     - 10 Denominasi standar Rupiah Indonesia:
       * Uang Kertas: Rp 100.000, Rp 50.000, Rp 20.000, Rp 10.000, Rp 5.000, Rp 2.000, Rp 1.000.
       * Uang Koin: Rp 500, Rp 200, Rp 100.
     - Kontrol kuantitas instan (+ / - stepper, input langsung angka), tombol cepat (+5 / +10), dan kalkulasi otomatis subtotal per pecahan.
     - Tombol "Reset Hitungan" dan akumulasi nilai rupiah otomatis tersinkronisasi 100% ke input "Total Kas Fisik Sebenarnya".
  2. Perbaikan Penanganan Angka 0 pada `<CurrencyInput />` (`CurrencyInput.tsx`):
     - Mengatasi kendala di mana nilai 0 dianggap string kosong sehingga memicu HTML5 native validation block.
     - Menjamin nominal 0 ditampilkan sebagai angka `"0"` yang sah dan dapat disubmit tanpa error.
  3. Spesifikasi BDD Gherkin Formal (`features/`):
     - `features/shift_reconciliation.feature` (Bahasa Indonesia):
       * Skenario 1 (Happy Path): Pembukaan shift, transaksi tunai, mutasi kas, hitung pecahan uang, rekonsiliasi cocok (selisih Rp 0).
       * Skenario 2 (Sad Path): Toleransi selisih fisik kurang (shortage) / lebih (overage) dengan catatan wajib supervisor.
       * Skenario 3 (Bad Path): Pencegahan transaksi saat shift terkunci (status SHIFT_CLOSED).
     - `features/shift_reconciliation.en.feature` (Standard English Gherkin).
  4. Page Object Model (POM) Modular (`scripts/pom/`):
     - `ShiftModalPage.js`: Abstraksi pembukaan shift, pencatatan kas masuk/keluar, kalkulator pecahan uang, submit Z-report, dan verifikasi status ringkasan laci.
     - `PosTerminalPage.js`: Penambahan metode `dismissSuccessModal` deterministik berbasis `waitFor({ state: 'hidden' })`.
  5. Master Test Runner BDD Visual (`scripts/test_shift_reconciliation_bdd_visual.js`):
     - Didaftarkan ke perintah `"test:visual:shift"` pada `package.json`.
     - Menangkap bukti visual langkah demi langkah di `docs/artifacts/visual_shift_reconciliation/`:
       * `happy_path/`: 8 screenshot (Buka shift -> Kas masuk -> Kas keluar -> Order POS -> Accordion pecahan uang -> Z-Report cocok -> Status shift selesai).
       * `sad_path/`: 4 screenshot (Buka shift -> Uang fisik 0 -> Alert selisih fisik -> Submit dengan catatan investigasi).
       * `bad_path/`: 2 screenshot (Shift terkunci modal awal -> Percobaan klik order diblokir dialog peringatan).
• Verifikasi Kestabilan Zero-Flakiness:
  - Eksekusi pengujian loop otomatis 5 kali berturut-turut:
    `for i in {1..5}; do echo "=== RUN $i ===" && npm run test:visual:shift || exit 1; done`
  - Hasil: RUN 1 s.d RUN 5 LULUS 100% (5/5 PASS, Exit code 0).
===============================================================================
[07 OKTOBER 2026] OFFLINE-FIRST PWA POS CHECKOUT QUEUE & IDEMPOTENCY ENGINE IMPLEMENTATION
===============================================================================
• Konteks & Driver:
  - Mengatasi risiko downtime kasir saat koneksi internet toko mati / tidak stabil (network outage).
  - Kasir POS wajib tetap dapat memproses transaksi checkout tunai (CASH), menerbitkan invoice offline sementara (`INV/OFFLINE/YYYYMMDD/XXXX`), dan mencetak struk fisik thermal langsung ke printer tanpa blocking dialog error.
  - Saat koneksi online pulih kembali, antrean transaksi offline wajib disinkronkan secara otomatis (FIFO background sync) ke server tanpa intervensi manual yang rumit.
  - Perlindungan mutlak dari duplikasi transaksi di server (idempotency guard) jika terjadi retry atau koneksi putus-nyambung.
• Rincian Implementasi Fitur:
  1. Client IndexedDB Storage Engine (`pos_apps/client/src/utils/offlineQueue.ts`):
     - Zero third-party dependency (murni browser native IndexedDB `well_pos_offline_db` versi 1, object store `order_queue`).
     - Menyimpan payload transaksi lengkap: `id` (UUID offline), `invoiceNumber`, `payload` (items, payment, customer, shift, outlet), `offlineReferenceId`, `status` ('PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED'), `retryCount`, `createdAt`.
     - Fungsi utilitas kanonikal: `saveOfflineOrder`, `getPendingOfflineOrders`, `getOfflineQueueCount`, `markOfflineOrderSyncing`, `markOfflineOrderSuccess`, `markOfflineOrderFailed`, `clearSyncedOfflineOrders`.
  2. Backend Idempotency Protection (`pos_apps/server/src/controllers/order.controller.ts`):
     - Skema validasi Zod `checkoutSchema` mendukung `offlineReferenceId: z.string().optional()`.
     - Sebelum membuka Prisma transaction atomik, backend memeriksa apakah pesanan dengan referensi offline tersebut sudah pernah tersimpan sebelumnya (`contains: [OFFLINE_REF:${offlineReferenceId}]`).
     - Jika sudah ada, backend mengembalikan pesanan yang sudah ada (HTTP 200/201) secara idempoten tanpa mengurangi stok berulang atau menduplikasi saldo ledger.
     - Tag idempotensi disematkan aman pada field `notes` dan diekspos pada respon `fullOrder`.
  3. POS Terminal Integration & Status UI Banner (`PosTerminalView.tsx` & `PosMobileView.tsx`):
     - State reaktif: `isOnline`, `pendingOfflineCount`, `isSyncingQueue`.
     - Event listener browser (`window.addEventListener('online')` / `'offline'`) + background timer interval pemantauan 30 detik.
     - Fallback otomatis saat checkout gagal karena network error / offline: menyimpan transaksi ke IndexedDB dan membuka modal sukses struk kasir dengan invoice darurat untuk cetak fisik.
     - Banner indikator visual:
       * Mode Offline: Banner oranye / kuning dengan ikon WiFi Off (`WifiOff`) dan jumlah antrean tertunda.
       * Mode Online dengan Antrean Tertunda: Banner biru / hijau dengan tombol aksi manual "Sinkronkan Sekarang" (`handleSyncOfflineQueue`) dan animasi sinkronisasi background.
  4. Pengujian & Verifikasi Kestabilan:
     - Script verifikasi idempotensi backend: `pos_apps/server/src/scripts/test_offline_idempotency.ts` (PASS, 0 order duplikat saat multiple retry).
     - Verifikasi Smoke Test Suite: 27/27 test suites PASS (100%).
     - Kompilasi TypeScript:
       * `npm run build:client` (tsc -b && vite build) = Exit code 0.
       * `npm run build:server` (tsc) = Exit code 0.
===============================================================================
[07 OKTOBER 2026] COMPREHENSIVE END-TO-END REGRESSION TESTING SUITE (100% PASS)
===============================================================================
• Konteks & Driver:
  - Pelaksanaan audit regresi menyeluruh (*full-spectrum regression testing*) pasca-implementasi Offline-First PWA Queue.
  - Memastikan seluruh modul fungsional, integritas basis data, alur onboarding tenant, F&B BOM, siklus kasbon, dan rekonsiliasi kas shift tidak mengalami regresi.
• Rincian Hasil Eksekusi Regression Test:
  1. Backend API & Core Flows Smoke Test (`npm run test:smoke`):
     - 5 Alur Utama (Registrasi -> Kasir BOM -> Laporan WIB -> Multi-Outlet -> QR Menu).
     - Hasil: 27/27 Test Suites LULUS 100% (PASS).
  2. Epic-12 Local Pre-Release Sandbox Validation (`npm run test:sandbox`):
     - Penyempurnaan urutan cleanup pada `seed.sandbox.ts` untuk relasi `customerDebtPayment`, `customerDebt`, `attendance`, `refundItem`, `refund`, dan `outletProduct`.
     - Konfigurasi default `paymentConfig.customerDebt` pada outlet sandbox.
     - Hasil: 5/5 Modul Sandbox LULUS 100% (PASS).
  3. Offline Checkout Idempotency Verification (`test_offline_idempotency.ts`):
     - Verifikasi pencegahan duplikasi order dan saldo ledger saat sinkronisasi ulang.
     - Hasil: 100% LULUS (PASS).
  4. Visual BDD Regression - Shift Reconciliation & Calculator (`npm run test:visual:shift`):
     - Happy Path (Z-Report Seimbang) + Sad Path (Defisit Kas Fisik) + Bad Path (Validasi Uang Negatif).
     - Hasil: 100% LULUS (PASS).
  5. Visual BDD Regression - F&B Recipes / BOM (`npm run test:visual:recipes`):
     - Happy Path (Formula Resep & Pemotongan Gramasi 100% Presisi) + Sad Path (Empty State) + Bad Path (Foreign Key Integrity).
     - Hasil: 100% LULUS (PASS).
  6. Visual BDD Regression - Split Bill, Multi-Tender & Debt (`npm run test:visual:split-debt`):
     - Happy Path (Pecah Tagihan Meja & Tunai + QRIS) + Sad Path (Kasbon Pelanggan & Pelunasan Backoffice) + Bad Path (Guard Underpaid).
     - Hasil: 100% LULUS (PASS).
  7. Visual BDD Regression - Tenant Journey Lifecycle (`npm run test:visual`):
     - Happy Path (Pendaftaran -> Approval Superadmin -> Store Wizard -> Kasir Tablet -> Z-Report -> Laporan Finansial).
     - Sad Path (6 skenario: email duplikat, empty wizard, shift terkunci, keranjang kosong, uang kurang, selisih shift).
     - Bad Path (3 skenario: reject akun spam, PIN void salah, password salah).
     - Hasil: 3/3 Suite (18 skenario) LULUS 100% (PASS).
  8. Status Kompilasi TypeScript Produksi:
     - `npm run build:client` (tsc -b && vite build) = Exit code 0.
     - `npm run build:server` (tsc) = Exit code 0.
===============================================================================
[07 OKTOBER 2026] SYNCHRONIZATION OF SYSTEM GUIDES & PLAYBOOKS WITH LATEST UPDATES
===============================================================================
• Konteks & Driver:
  - Pemutakhiran seluruh panduan sistem (In-App Guide, Tenant Playbook, Sandbox Guide, dan Project Memory) agar selaras 100% dengan kapabilitas terbaru:
    1. Offline-First PWA Queue & Auto-Sync Idempoten pada Terminal POS Kasir.
    2. Kalkulator Pecahan Uang Tunai (Cash Denomination Counter) pada Modal Buka & Tutup Shift Kasir.
    3. Floating Widget Panduan Sistem Responsif (FloatingGuideWidget) dengan isolasi otentikasi & penyesuaian posisi mobile di atas bottom navigation bar.
    4. Penegakan terminologi kanonikal Toko / Outlet di seluruh panduan manual & otomasi.
• Dokumen & Berkas yang Diselaraskan:
  1. `pos_apps/client/src/pages/UserGuideView.tsx`:
     - Pembaruan Section 9 (Pembukaan & Rekap Tutup Shift Kasir) dengan instruksi Kalkulator Pecahan Uang.
     - Penambahan Section 24: "Operasional Kasir Offline-First & Antrean Sinkronisasi Otomatis" (IndexedDB queue, badge antrean, jaminan idempotensi).
  2. `docs/TENANT_ONBOARDING_AND_TESTING_GUIDE.md`:
     - Pembaruan Fase 5.1 (Buka Shift) & Fase 7 (Tutup Shift) dengan SOP Kalkulator Pecahan Uang.
     - Penambahan Sub-Bab 5.4: Mode Offline-First (Transaksi Tanpa Internet & Sinkronisasi Idempoten Otomatis).
     - Penambahan Sub-Bab 6.5: Widget Panduan Interaktif Sistem Terintegrasi (FloatingGuideWidget).
  3. `docs/SANDBOX_PLAYBOOK.md`:
     - Penambahan Perintah Uji: `npm run test:offline` (`test_offline_idempotency.ts`).
     - Penambahan Skenario 13: Offline-First Terminal Kasir, Local Queue & Idempotent Auto-Sync.
     - Penambahan FAQ terkait penanganan pemadaman internet kasir secara offline-first.
  4. `package.json` (Root & Server):
     - Pendaftaran script kanonikal `npm run test:offline`.
===============================================================================
[07 OKTOBER 2026] PURE FINANCIAL SUMMARY POLICY ON X/Z SLIPS & MEMORY GOVERNANCE
===============================================================================
• Konteks & Driver:
  - User feedback & audit: Slip X-Report ("Laporan Berjalan Kasir") sebelumnya menampilkan rincian "TRANSAKSI TERBARU (10)" yang memboroskan kertas thermal kasir dan menampilkan daftar transaksi yang seharusnya hanya berada di menu audit.
  - Penegakan prinsip arsitektural: Slip X-Report dan Z-Report kasir adalah "Pure Financial Summary" (Rekapitulasi Finansial Murni).
  - Detail transaksi per nota dialokasikan secara eksklusif pada Menu Rekap Shift Kasir (Audit Shift Backoffice) (`ShiftsAuditView.tsx`).
• Tindakan & Perubahan:
  1. `pos_apps/client/src/components/XReportModal.tsx`:
     - Menghapus rendering daftar transaksi terbaru (`recentOrders`) dari slip cetak thermal & modal pratinjau.
     - Slip X-Report kini bersih, ringkas, dan fokus pada posisi laci kas, petty cash, omset penjualan, dan metrik faktur.
  2. `AGENTS.md`:
     - Penambahan Aturan 13 pada Daftar Pantangan Keras (The Anti-Patterns & Gotchas Wall): Kebijakan Rekapan Murni Slip X/Z Report (Pure Summary - Zero Transaction List on Slip).
  3. `docs/00_PROJECT_CONTEXT.md`:
     - Penambahan Aturan 28 pada Standar Koding & UI Kasir.
  4. `pos_apps/server/src/migrations/contract/test_epic_smoke_e2e.ts`:
     - Penambahan verifikasi 3.4 pada alur smoke test untuk menguji endpoint `/api/shifts/x-report` dan menegakkan kontrak pure summary.
===============================================================================
[08 OKTOBER 2026] PENYEMPURNAAN KOMPREHENSIF AUDIT & REKAPITULASI SHIFT KASIR (FASE 1 & 2)
===============================================================================
• Konteks & Driver:
  - User feedback & review visual pada menu "Audit Rekap Shift Kasir" (`ShiftsAuditView.tsx`):
    1. Nama kasir sempat menampilkan fallback teks "Kasir" dan outlet "-".
    2. Dropdown Kasir kosong (hanya "Semua Kasir") dan menimpa baris filter periode pada smartphone.
    3. Kartu KPI Finansial atas tidak muncul untuk akun Kasir karena endpoint analitik `/api/reports/shifts` terproteksi RBAC (Owner/Admin/Supervisor) dan kasir fallback ke `getShiftHistory` yang belum membawa objek `summary`.
    4. Kartu shift mobile kurang informatif (hanya Modal Awal, Uang Fisik, Selisih, tanpa Kas Sistem/Expected Ending).
    5. Toolbar filter periode terpotong/wrapping berantakan pada layar smartphone.
• Solusi & Implementasi Bertahap:
  1. Backend (`pos_apps/server/src/controllers/shift.controller.ts`):
     - Penyediaan alias kanonikal pada response `getShiftHistory`: `cashierName: s.user.name`, `outletName: s.outlet.name`, `expectedEnding: s.expectedEndingCash`, `actualEnding: s.actualEndingCash`, `cashDifference: s.cashDifference`.
     - Dukungan parameter query `startDate` & `endDate` untuk sinkronisasi rentang tanggal dengan backoffice.
  2. Client API & Page Integration (`pos_apps/client/src/services/api.ts` & `DashboardPage.tsx`):
     - Meneruskan parameter date filter pada `getShiftHistory`.
     - Menginjeksi prop `currentUser={user}` ke `<ShiftsAuditView />`.
  3. Frontend Audit UI/UX (`pos_apps/client/src/pages/ShiftsAuditView.tsx`):
     - Normalisasi kanonikal kasir & outlet (`getShiftCashierName`, `getShiftOutletName`).
     - Ekstraksi opsi kasir dinamis dari data shift dengan penanda smart default `[Akun Saya]` untuk akun Kasir.
     - Fallback kalkulasi ringkasan KPI (Total Sesi, Sesi Seimbang, Selisih Kurang, Net Selisih) berbasis client-side data shift jika endpoint analitik report mengembalikan 403 / error.
     - Toolbar periode dibuat horizontal scrollable (`overflow-x-auto scrollbar-none`) dengan pill rounded clean.
     - Toolbar pencarian & dropdown kasir responsif vertikal-ke-horizontal (`flex-col sm:flex-row`).
     - Kartu mobile diperkaya dengan indikator 4-grid: `Modal Awal`, `Kas Sistem`, `Uang Fisik`, dan `Selisih Kas` beserta badge `Akun Saya`.
• Hasil Pengujian Otomatis Playwright:
  - Diverifikasi dengan Playwright (`scripts/test_shifts_audit_verification.js`):
    - Mobile (390x844): `shifts_audit_mobile_full.png` (Exit code 0).
    - Desktop (1280x900): `shifts_audit_desktop_enhanced.png` (Exit code 0).
    - Nama kasir nyata (`Rian Kasir Kemang`, `Fajar Kasir Kemang`, `Siti Kasir Kemang`) dan outlet (`Ura Coffee - Flagship Kemang`) berhasil dirender 100%.
===============================================================================
[09 OKTOBER 2026] PERBAIKAN TOTAL DISTORSI IKON RESPONSIF MOBILE & PWA (ZERO-SQUISHED-ICONS)
===============================================================================
• Konteks & Root Cause:
  - User melaporkan ikon-ikon di header banner, kartu KPI, dan modal dialog tampak "kegencet" / pipih secara vertikal/horizontal saat dibuka pada layar smartphone (portrait 375px - 430px) dan instalasi PWA.
  - Root cause geometris CSS Flexbox: Elemen icon wrapper (`w-12 h-12`, `w-10 h-10`, `w-8 h-8`, dll.) tidak memiliki kelas `shrink-0` (`flex-shrink: 0`), dan container teks saudara tidak memiliki `min-w-0`. Secara default flex items memiliki `flex-shrink: 1`, sehingga saat judul/deskripsi teks panjang mendesak container pada layar sempit, icon wrapper terkompresi secara horizontal menjadi pipih/oval.
• Solusi & Cakupan Implementasi (20+ Berkas Front-End):
  1. Header Banner & KPI Cards Halaman Backoffice:
     - `ShiftsAuditView.tsx` (Banner Audit Shift + 4 KPI Cards Audit).
     - `FinancialReportView.tsx` (Banner Keuangan + 7 KPI Cards Finansial).
     - `ProductAnalyticsView.tsx` (Banner Analitik Produk + 4 KPI Cards).
     - `OutletsView.tsx`, `WarehousesView.tsx`, `CustomersView.tsx`.
     - `InventoryView.tsx`, `CategoriesView.tsx`, `ModifiersView.tsx`, `RecipesView.tsx`.
     - `SuppliersView.tsx`, `PromotionsView.tsx`, `UsersView.tsx`, `StaffRolesView.tsx`.
     - `QrLiveOrdersView.tsx`, `QrTablesView.tsx`, `LoyaltySettingsView.tsx`.
     - `CashFlowReportTab.tsx`, `CustomerDebtsTab.tsx`.
  2. Modal Dialog & Transaksi POS:
     - `CloseShiftModal.tsx`, `StartShiftModal.tsx`, `XReportModal.tsx`, `VoidOrderModal.tsx`.
     - `SupervisorFeesModal.tsx`, `OnDemandFeesPickerModal.tsx`, `KitchenTicketModal.tsx`.
     - `ProductBarcodeLabelsModal.tsx`, `CreateIngredientModal.tsx`, `SplitBillModal.tsx`.
     - `VoucherSelectionModal.tsx`, `AssignCatalogProductModal.tsx`, `FullScreenProductImportModal.tsx`.
     - `PaymentModal.tsx`, `OrderSuccessModal.tsx`, `PakasirDirectQrisModal.tsx`, `ProductModifierModal.tsx`.
  3. Header & Navigasi Global:
     - `BackofficeLayout.tsx` (Logo Toko di mobile/desktop header).
     - `PosHeader.tsx` (Status kasir & shift icon di terminal POS).
• Verifikasi:
  - `npm run build` di `pos_apps/client` berhasil 100% (Exit code 0).
  - `npm run build` di `pos_apps/server` berhasil 100% (Exit code 0).
===============================================================================
[09 OKTOBER 2026] RESOLUSI KONVERSI TIPE PRODUK F&B KE RITEL & ELIMINASI DUMMY STOK 999.999
===============================================================================
• Konteks & Akar Masalah:
  - User melaporkan tidak bisa mengedit produk dari Olahan F&B (Made-to-Order) menjadi Barang Kemasan Ritel Fisik.
  - Saat produk dibuat sebagai F&B, sistem legacy mengisi kuantitas stok dummy sebesar 999.999 pada `outlet_products` dan `inventory_balances` agar kasir tidak terblokir stok.
  - Ketika merchant mencoba mengedit produk ke "Barang Ritel Fisik", endpoint `PUT /api/products/:id` tidak memiliki kolom `type` dan tidak mengalibrasi saldo stok fisik di DB. Front-end `ProductsView.tsx` dan `ProductModal.tsx` memiliki kuncian rapuh `if (stock >= 99999)` yang otomatis memaksa produk terpental kembali menjadi F&B.
• Solusi & Implementasi (Opsi 1 - Pragmatis & Bersih):
  1. Backend (`pos_apps/server`):
     - `createProductSchema` & `updateProductSchema` diperluas menerima `productType` (`STANDARD` | `COMPOSITE`), `hasStock`, `currentStock`, dan `outletId`.
     - `catalogDualWriteService.createProduct`: Produk F&B `COMPOSITE` dibuat dengan stok awal bersih `0` (bukan 999.999). Kolom `products.type` disimpan presisi.
     - `catalogDualWriteService.updateProduct`: Memperbarui kolom `products.type`. Jika beralih ke Ritel Fisik atau menyertakan `currentStock`, sistem mengalibrasi saldo riil di `outlet_products` dan `inventory_balances`, serta mencatat mutasi `OPNAME_ADJUSTMENT` di `inventory_ledgers`.
     - `saas.controller.ts`: Onboarding store template F&B distandardisasi dengan `initialStock: 0`, `productType: 'COMPOSITE'`, `hasStock: false`.
  2. Frontend (`pos_apps/client`):
     - `ProductModal.tsx`: Logika inisialisasi dirombak untuk memprioritaskan `productType` dan `hasStock` dari DTO. Menambahkan input "Saldo Stok Fisik Toko Saat Ini" saat mode Edit beralih ke Ritel Fisik.
     - `ProductsView.tsx`: Kondisi badge tabel desktop dan mobile cards diganti dari `stock >= 99999` menjadi `p.productType === 'COMPOSITE' || p.hasStock === false`.
• Verifikasi & Pengujian:
  - Skrip regression test baru: `pos_apps/server/src/scripts/test_regression_product_type_switch.ts` (100% Pass: Create F&B -> Edit to Retail 35 Pcs -> Edit back to F&B).
  - `npm run build` di `pos_apps/server`: Exit code 0.
  - `npm run build` di `pos_apps/client`: Exit code 0.
===============================================================================
[09 OKTOBER 2026] VERIFIKASI REGRESI INVENTORI/BOM (OPSI B) & SMOKE TEST E2E (OPSI C)
===============================================================================
• Eksekusi Opsi B (Modul Inventori, Resep BOM & Deduksi Stok Kasir):
  1. Re-sync Sandbox Database: `npm run seed:sandbox` dijalankan dengan sukses (100%).
  2. Visual Playwright E2E (`npm run test:visual:recipes`):
     - Happy Path: Pendaftaran bahan baku mentah baru (Biji Kopi Gayo 1.000 GRAM, HPP Rp 250), peracikan formula BOM (18g/cup Kopi Susu Aren Ura), transaksi kasir POS 2 cup tunai uang pas, pemotongan stok bahan baku otomatis terverifikasi 100% presisi matematika (1.000 - 36 = 964g).
     - Sad Path: Validasi empty state katalog resep dan penolakan takaran tak terhingga/nol (min="0.001").
     - Bad Path: Proteksi integritas foreign key (penolakan penghapusan bahan baku aktif yang terikat resep).
     - Hasil: 100% PASS (Exit code 0).
  3. Eliminasi Residu Saldo Fiktif DB:
     - Ditemukan 1 produk warisan pengujian awal ("Meals 1") yang memiliki saldo 999.999.
     - Berhasil dikonversi secara real-time via API `PUT /api/products/:id` menjadi produk ritel dengan saldo stok nyata 50 Pcs.
     - Proteksi ganda ditambahkan pada `catalog.dual_write.service.ts`: auto-reset saldo fiktif >= 999.000 menjadi 0 jika produk disetel sebagai COMPOSITE/hasStock=false.
• Eksekusi Opsi C (End-to-End Smoke Test Suite & Offline Sync):
  1. E2E Smoke Test (`npm run test:smoke`):
     - Lolos 30 dari 30 skenario (100% PASS).
     - FLOW 1 (Registrasi Owner -> Approval Superadmin -> Toko Baru -> Pairing Kasir): Lulus.
     - FLOW 2 (Kasir Checkout Tunai + QRIS & Validasi Potong Stok Resep BOM): Lulus.
     - FLOW 3 (Laporan Finansial WIB Timezone, X-Report Pure Summary, Anti-falsifikasi QRIS, Lock on Unpaid Orders): Lulus.
     - FLOW 4 (Multi-Outlet Isolation & RLS Security): Lulus.
     - FLOW 5 (QR Menu Self-Ordering -> Live Kitchen Feed -> Pelunasan Kasir POS): Lulus.
  2. Offline Sync Idempotency (`npm run test:offline`):
     - Pengujian idempotensi kasir checkout offline sukses tanpa duplikasi invoice (100% PASS).
• Status Akhir Build:
  - `pos_apps/server`: Exit code 0 (TypeScript compile bersih).
  - `pos_apps/client`: Exit code 0 (Vite production build sukses).
===============================================================================
[09 OKTOBER 2026] PENYEMPURNAAN UI/UX KATALOG MENU & ISOLASI DOMAIN BOM BAHAN BAKU
===============================================================================
• 1. Penyempurnaan UI/UX Halaman Daftar Menu (ProductsView.tsx):
  - Penambahan Hero Banner Gradien Mewah dengan chip "Katalog & Manajemen Menu Toko" dan tombol CTA "+ Tambah Produk".
  - Penambahan 4 KPI Cards interaktif: Total Menu, Menu Aktif Kasir, Olahan F&B (BOM), dan Ritel Fisik.
  - Perampingan toolbar dengan Dropdown Popover "Alat & Berkas" (Impor Spreadsheet Excel/CSV, Ekspor CSV, Cetak Label Barcode).
  - Penyatuan Filter Bar: Status ketersediaan (Semua/Aktif/Nonaktif) dan Kategori pills bersatu dalam satu card hemat ruang.
  - Eliminasi sticky overlap: Lebar kolom tabel proporsional (min-w-220px s.d w-32), tidak ada kolom terpotong atau menimpa kolom stok.
  - Format angka ribuan standar Indonesia (.toLocaleString('id-ID')) dan badge pintar "∞ Olahan F&B" untuk menu racikan dapur.
• 2. Isolasi Domain Boundary Menu vs BOM Bahan Baku (Task 6.8):
  - Temuan Masalah: Produk menu jadi (Kopi Susu Aren, Meals 1, Meals 2) sebelumnya bocor ke dropdown pemilihan bahan baku resep BOM & modifier akibat tidak adanya filter relasi pada endpoint GET /api/recipes/inventory-items.
  - Solusi Backend: Menambahkan filter otomatis where: { variants: { none: {} } } (mode raw_only) sehingga hanya bahan baku mentah (biji kopi, susu, sirup, bumbu, daging) dan kemasan (cup, paper bag, box) yang dikembalikan untuk resep dan modifier.
  - Penyelarasan Dual-Write: Produk olahan dapur (COMPOSITE) tidak lagi dibuatkan baris fisik di inventory_items, varian inventoryItemId di-set null karena stoknya dihitung murni dari bahan baku resep.
• 3. Test Suite E2E Playwright (scripts/test_e2e_menu_bom_and_stock_matrix.js):
  - Verifikasi otomatis pada ModifiersView: 0 produk menu bocor, 11 bahan mentah valid tampil (100% PASS).
  - Verifikasi otomatis pada RecipesView: 0 produk menu bocor, 10 bahan mentah valid tampil (100% PASS).
  - Bukti visual tersimpan di:
    • scripts/docs/artifacts/modifiers_bom_dropdown_clean.png
    • scripts/docs/artifacts/recipes_bom_dropdown_clean.png
• 4. Status Build: pos_apps/server dan pos_apps/client EXIT CODE 0.
===============================================================================
```











