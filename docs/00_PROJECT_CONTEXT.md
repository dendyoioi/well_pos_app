# WELL POS — CANONICAL PROJECT CONTEXT & ARCHITECTURAL MEMORY
> **Status**: 100% Roadmap Completed (EPIC-01 through EPIC-21 COMPLETED ✅)  
> **Terakhir Diperbarui**: 25 September 2026  
> **Target Pengguna Dokumen**: AI Coding Assistant (Antigravity), Tech Lead, Developer, DevOps  
> **Lokasi Repository**: `/Users/dendyaditya/Projects/pos_project`  
> **Master Project Memory**: [`docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md`](./epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md)  
> **Master Documentation Index**: [`docs/README.md`](./README.md)  

---

## 1. IDENTITAS & STATUS SISTEM (PROJECT IDENTITY & STATE)

- **Nama Produk**: **Well POS**
- **Format Bisnis**: Multi-Tenant SaaS Point of Sale, Inventory Ledger & Supply Chain Platform
- **Vertikal yang Didukung**:
  1. **Retail** (Packaged goods, barcode scan, varian kemasan/karton, SKU unik).
  2. **Food & Beverage / F&B** (Resep/BOM, pemotongan bahan baku otomatis, modifiers/topping berbayar & gratis, Kitchen Display System).
  3. **Services** (`ProductType.SERVICE_LABOR`, non-stock billing dengan opsi pemakaian bahan baku/consumables).
- **Status Migrasi Data**: **100% CUTOVER TO TARGET SCHEMA (`TARGET_ONLY`)**.
  - Seluruh tabel legacy lama monolith (`outlet_products`, `stock_movements`, `payments`) telah didekomisioning secara aman pada EPIC-04.
  - Arus baca dan tulis 100% berjalan di atas skema target ternormalisasi penuh (kini telah berkembang menjadi 40 model Prisma aktif mencakup CRM, PO, SaaS billing, dan catalog scoping).
- **Status Roadmap Epics**: **EPIC-01 s.d EPIC-21 SELESAI (100% COMPLETED ✅)**.

---

## 2. STACK TEKNOLOGI KANONIKAL (CANONICAL TECH STACK)

### Backend (`pos_apps/server`)
- **Runtime**: Node.js 20 LTS (Alpine Linux di container)
- **Framework Web**: Express.js 4.21
- **Bahasa**: TypeScript 5.6
- **Database**: PostgreSQL 16
- **ORM & Data Access**: Prisma ORM 5.22 (`prisma/schema.prisma`)
- **In-Memory Cache**: Redis 7 Alpine dengan graceful in-memory Map fallback (`cache.service.ts`)
- **Keamanan Kernel**: PostgreSQL Row-Level Security (RLS) via role non-superuser `pos_app` dan `tenant_isolation_policy`
- **Keamanan HTTP**: OWASP Security Headers, sliding-window Rate Limiting (`security.middleware.ts`), JWT Sessions, bcryptjs
- **Containerization**: Multi-stage `Dockerfile` (dist runner non-root `USER node`)

### Frontend (`pos_apps/client`)
- **Framework**: React 19 (SPA)
- **Tooling**: Vite 8.3 + TypeScript
- **Styling**: Vanilla CSS (Desain Kurasi Modern `index.css` bernuansa Clean White-Blue)
- **Icon Pack**: Lucide React
- **PDF & Receipt Rendering**: jsPDF 4.2, html2canvas, DOMPurify
- **Web Server / Reverse Proxy**: Nginx Alpine (`nginx.conf` dengan gzip, SPA routing fallback `try_files`, dan static cache)

### Orkestrasi Produksi
- **Docker Compose**: `docker-compose.prod.yml`
  - `pos_postgres` (PostgreSQL 16 Alpine + healthcheck)
  - `pos_redis` (Redis 7 Alpine + persistence)
  - `pos_server` (API service port 5001)
  - `pos_client` (Nginx Web host port 80)

---

## 3. MASTER TOPOLOGI BASIS DATA (TARGET DATABASE MODELS)

Basis data `pos_db` menggunakan skema relasional terpadu yang memisahkan ranah **Core, Commerce, Inventory, dan SaaS**:

```text
                           [ PlatformUser ] (SuperAdmin)
                                  │
      ┌───────────────────────────┴───────────────────────────┐
      │                                                       │
 [ SubscriptionPlan ] ─── 1:N ─── [ TenantSubscription ]     [ SaaSInvoice ] ─── [ SaaSPayment ]
                                           │
                                     [ Tenant ]
                                           │
   ┌───────────────────────┬───────────────┴───────────────┬────────────────────────┐
   ▼                       ▼                               ▼                        ▼
[ Outlets ]            [ Users ]                      [ Customers ]           [ Promotions ]
   │                       │                               │                        │
   │               (Roles: ADMIN, CASHIER,         (Tiers: BRONZE,          (Discount, Voucher,
   │                SUPERVISOR, WAREHOUSE)          SILVER, GOLD)            Point Redemption)
   │
   ├───────────────────────────────┐
   ▼                               ▼
[ StorageLocations ]      [ Cashier Shifts ]
   │                               │
   │ (Default, Bar, Kitchen)       │ (Open, Close, Cash In/Out,
   │                               │  X/Z Report, Audit Over/Short)
   │                               │
   │                               ▼
   │                        [ Orders ] ─── 1:N ─── [ OrderItems ]
   │                               │                      │
   │                               ├─ [ Payments ]        └─ [ ModifierItems ]
   │                               └─ [ Refunds ]
   ▼
[ InventoryBalances ] ◄──── [ InventoryLedgers ] (Immutable History)
   ▲                               ▲
   │                               │
   ├─ [ PurchaseOrders ]           ├─ [ StockTransfers ] (Request ➔ Dispatch ➔ Receive)
   │       └── [ POItems ]         │       └── [ TransferItems ]
   │                               │
[ InventoryItems ] (Bahan Baku / Raw Stock / Fisik)
   ▲
   │ 1:N
[ RecipeItems ] ◄─── [ Recipes ] (BOM)
                        ▲
                        │ 1:1
[ Products ] ─── 1:N ─── [ ProductVariants ] (SKU, Packaging Multiplier)
      │
      └─── N:M ─── [ ModifierGroups ] ─── 1:N ─── [ ModifierItems ]
```

### Aturan Domain Kunci (Approved Principles):
1. **Product vs InventoryItem** (ADR-003 & ADR-005):
   - `Product` = Item komersial/jual (menu makanan, minuman, barang kemasan, jasa).
   - `InventoryItem` = Item fisik/bahan baku yang disimpan dan dihitung HPP-nya (biji kopi, susu, cup, gula).
2. **Packaging Multiplier** (`ProductVariant.inventoryQuantityMultiplier`):
   - 1 Botol = multiplier 1.0; 1 Dus (isi 24) = multiplier 24.0 (memotong 24 unit InventoryItem dari 1 SKU dus).
3. **Resep Bertingkat (F&B BOM)**:
   - Menu komposit memotong bahan baku via `recipes` + `recipe_items`.
   - Modifiers (misal: "Extra Oatmilk +5000") memotong tambahan bahan baku via `modifier_recipe_effects`.
4. **Moving Average Cost (COGS / HPP)**:
   - Setiap transaksi *Goods Receiving* dari supplier menghitung ulang harga pokok rata-rata persediaan secara real-time.
   - Penjualan kasir langsung menghitung laba kotor bersih: `Net Sales - COGS = Gross Profit`.

---

## 4. ARSITEKTUR KEAMANAN ROW-LEVEL SECURITY (RLS)

Sesuai amanat kepatuhan multi-tenant enterprise (EPIC-11), isolasi tenant ditegakkan di dua lapisan:
1. **Application Layer**: Validasi `tenantId` eksplisit di setiap service dan Prisma query.
2. **Kernel Database Layer**: PostgreSQL Row-Level Security (RLS) via [`rls.service.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/services/rls.service.ts):
   - Semua tabel ber-tenant diberi `ENABLE ROW LEVEL SECURITY` dan `FORCE ROW LEVEL SECURITY`.
   - Policy:
     ```sql
     CREATE POLICY tenant_isolation_policy ON "<table_name>"
     FOR ALL USING (
       current_setting('app.is_super_admin', true) = 'true'
       OR current_setting('app.bypass_rls', true) = 'on'
       OR (
         NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
         AND tenant_id = current_setting('app.current_tenant_id', true)
       )
     );
     ```
   - Setiap transaksi tenant dijalankan dengan role non-superuser `pos_app` (`SET LOCAL ROLE pos_app;`) dan `SELECT set_config('app.current_tenant_id', $1, true)`.
   - Otomatis reset saat transaksi selesai, menjamin connection pooling bebas kontaminasi.

---

## 5. REKAPITULASI ROADMAP EPIC (EPIC-01 s.d EPIC-21)

| Epic | Judul & Ruang Lingkup | Deliverables Kunci & Artefak | Status |
| :--- | :--- | :--- | :---: |
| **EPIC-01** | System Audit & Multi-Tenant RFC | Audit monolith ritel lama, dekomposisi domain, isolasi tenant data (ADR-001). | **COMPLETED ✅** |
| **EPIC-02** | Target Database Schema & ADRs | 18 tabel target, UOM kanonikal (ADR-003), Negative stock (ADR-002), Batch/lot (ADR-004). | **COMPLETED ✅** |
| **EPIC-03** | Zero-Downtime Data Migration | Fase 12 Expand, Fase 13 Backfill, Fase 14 Dual-Write, Fase 15 Reconcile. Zero drift. | **COMPLETED ✅** |
| **EPIC-04** | Cutover & Legacy Decommission | Cutover 100% ke `TARGET_ONLY`, drop tabel legacy (`outlet_products`, `stock_movements`, `payments`). | **COMPLETED ✅** |
| **EPIC-05** | Frontend Client & Core POS | Kasir `PosTerminalView.tsx`, Varian produk, Struk nota, Shift kasir (X/Z Report). | **COMPLETED ✅** |
| **EPIC-06** | F&B Engine (Recipes/Modifiers) | Resep minuman/makanan, modifier topping, pemotongan stok bahan baku, KDS state. | **COMPLETED ✅** |
| **EPIC-07** | Supply Chain & Purchasing | PO Supplier, Goods Receipt (Moving Average Cost), Transfer antar-outlet. | **COMPLETED ✅** |
| **EPIC-08** | CRM, Loyalty & Promotions | Database pelanggan, poin & tier membership, voucher promo checkout, WhatsApp link. | **COMPLETED ✅** |
| **EPIC-09** | Financial Analytics & BI | Laba kotor real-time (COGS), audit selisih kas (*over/short*), Pareto best-seller, CSV export. | **COMPLETED ✅** |
| **EPIC-10** | SaaS SuperAdmin & Billing | Portal SuperAdmin (`SuperadminDashboardPage.tsx`), invoice langganan, auto-suspend lisensi. | **COMPLETED ✅** |
| **EPIC-11** | Production Hardening & DevOps | PostgreSQL RLS, Redis Cache-Aside, OWASP Headers, Auth Rate Limiting, Docker Compose. | **COMPLETED ✅** |
| **EPIC-12** | Local Sandbox & Simulators | Master Seeder 5 role, simulator QRIS & printer thermal, suite runner terpadu (`test:sandbox`). | **COMPLETED ✅** |
| **EPIC-13** | Frontend Re-Architecture & Modern UI/UX | Re-desain menyeluruh antarmuka: Landing page kelas dunia, POS modular, dan backoffice terpadu. | **COMPLETED ✅** |
| **EPIC-14** | Decoupled Owner Identity & Split Reg | Registrasi mandiri murni 5 field akun Owner (0 toko di awal), status tenant `PENDING`. | **COMPLETED ✅** |
| **EPIC-15** | Full-Screen Store Creator Wizard | Layar penuh wizard pembuatan toko pertama saat `outlets === 0`, 58 katalog multi-industri. | **COMPLETED ✅** |
| **EPIC-16** | Enterprise Backoffice Redesign | Sidebar bertingkat 8 rumpun modul, layout putih-biru, KPI ringkasan & analitik bisnis. | **COMPLETED ✅** |
| **EPIC-17** | Multi-Store Hierarchy & Per-Store SaaS | Struktur pohon 1-Owner-N-Toko, paket SaaS granular per toko fisik, delegasi akses. | **COMPLETED ✅** |
| **EPIC-18** | Superadmin Onboarding & Governance | Triage funnel pendaftar, verifikasi WhatsApp, tombol Approve/Reject, kaskade nonaktif. | **COMPLETED ✅** |
| **EPIC-19** | Buku Menu QR & Self-Ordering | Menu publik mobile-first, tent card generator QR meja resto, live feed pesanan dapur, pratinjau mode merchant. | **COMPLETED ✅** |
| **EPIC-20** | Kanal Penjualan & Mitra Online | Manajemen kanal kustom toko & mitra pesan-antar online (GoFood, GrabFood, ShopeeFood, Maxim), input kontekstual kasir (Meja vs ID Driver), omset per kanal di laporan keuangan. | **COMPLETED ✅** |
| **EPIC-21** | Multi-Outlet Catalog & Warehouse Routing | Isolasi katalog menu & resep BOM per jenis toko, tautan dinamis gudang pasokan (`warehouseId`), pemotongan bahan baku kasir otomatis langsung di gudang (*Direct Backflush*), visibilitas multi-gudang, dan alokasi transfer stok terpadu. | **COMPLETED ✅** |

---

## 6. PETA BERKAS KANONIKAL REPOSITORY (CODEBASE MAP)

### Backend Services & Routers (`pos_apps/server/src`)
- **Entrypoint**: `index.ts` (Express app, port 5001, security middlewares, route mounting).
- **Core Middlewares**:
  - `middlewares/auth.middleware.ts`: JWT verification, tenant context, multi-role RBAC.
  - `middlewares/security.middleware.ts`: OWASP security headers, sliding-window rate limiters.
  - `middlewares/subscriptionCheck.middleware.ts`: Interseptor lisensi toko (block 403 `SUBSCRIPTION_LOCKED` jika expired/suspended).
  - `middlewares/saas.middleware.ts`: Validasi status tenant (`ACTIVE` vs `PENDING` vs `SUSPENDED`).
- **Domain Services**:
  - `services/rls.service.ts`: PostgreSQL RLS enabler, role switcher `pos_app`, session context manager.
  - `services/cache.service.ts`: Cache-aside engine, prefix invalidator, metrics reporter.
  - `services/billing.service.ts`: SaaS invoice generation, payment webhook processor, subscription updater.
  - `services/licenseWorker.service.ts`: Worker otomasi siklus lisensi (Trial ➔ Active ➔ Grace ➔ Suspended).
  - `services/analytics.service.ts`: Kalkulasi laba kotor, HPP rata-rata bergerak (*moving average*), rekap penjualan.
  - `services/qr_menu.service.ts`: Manajemen meja resto, konfigurasi menu QR publik, live feed pesanan masuk.
  - `services/loyalty.service.ts`: Poin loyalitas pelanggan & perhitungan tier membership.
  - `services/promotion.service.ts`: Kalkulasi diskon promo kupon & validasi checkout.
  - `services/purchasing.service.ts`: Purchase order supplier & update HPP moving average saat penerimaan barang.
  - `services/stock_transfer.service.ts`: Mutasi & alokasi transfer stok antar outlet/gudang.
  - `services/mail.service.ts`: Layanan notifikasi email transaksional & invoice SaaS.
  - `services/role.service.ts`: Manajemen matriks izin RBAC per role pengguna.
  - `services/dual_write/sales.dual_write.service.ts`: Mesin ACID checkout, mutasi stok, open tab, dan dynamic warehouse backflushing.
  - `services/read_adapters/`: Adapter pembacaan terisolasi (`catalog.read_adapter.ts`, `inventory.read_adapter.ts`, `order.read_adapter.ts`, `report.read_adapter.ts`).
- **Controllers Kunci**:
  - `controllers/auth.controller.ts`: Login password bcrypt (Owner/Admin), login PIN kasir bcrypt, get profile, pair device terminal.
  - `controllers/saas.controller.ts`: Pendaftaran mandiri (`registerClient`), setup awal toko (`createInitialStore`), onboarding, status lisensi langganan live (`getSubscriptionStatus`), top-up saldo token kuota mandiri (`topUpSubscriptionTokens`), verifikasi kupon promo B2B (`validateTenantPromoCode`), dan riwayat faktur digital tenant (`getSubscriptionInvoices`).
  - `controllers/platform.controller.ts`: Kontrol Superadmin (triage pendaftar, verifikasi nomor WA, setujui/tolak status tenant, impersonasi toko, buku besar billing & mutasi token `/api/platform/invoices`, manajemen staf platform RBAC `/api/platform/users`, dan promo SaaS B2B voucher engine `/api/platform/promos`).
  - `controllers/outlet.controller.ts`: Manajemen outlet toko & gudang, alokasi pasokan `warehouseId`, konfigurasi kanal & pajak PB1/service charge.
  - `controllers/product.controller.ts` & `controllers/category.controller.ts`: CRUD master katalog produk, kategori, varian, dan scoping `outlet_products`.
  - `controllers/inventory.controller.ts`: Saldo stok fisik, opname, kartu mutasi, dan alokasi stok gudang.
  - `controllers/recipe.controller.ts` & `controllers/modifier.controller.ts`: Takaran resep F&B BOM, modifiers/topping, dan kalkulasi HPP.
  - `controllers/qr_menu.controller.ts`: Public catalog endpoint, meja QR, checkout pesanan self-ordering meja.
  - `controllers/supplier.controller.ts` & `controllers/purchase_order.controller.ts`: CRUD pemasok/vendor & siklus PO.
  - `controllers/stock_transfer.controller.ts`: Mutasi pemindahan barang antar cabang & dari gudang pusat.
  - `controllers/promotion.controller.ts`: CRUD voucher promo kupon & diskon.
  - `controllers/order.controller.ts`: Riwayat transaksi, open tab meja terisi, cetak ulang struk, void order.
  - `controllers/shift.controller.ts`: Buka/tutup shift kasir, laporan X/Z report, selisih kas (*cash over/short*).
  - `controllers/customer.controller.ts`: CRM member & rekap saldo poin loyalitas.
  - `controllers/report.controller.ts`: Laporan finansial, P&L, analisis performa menu & HPP.
  - `controllers/user.controller.ts`: Manajemen staf, akun kasir/gudang/spv, dan rotasi PIN.
- **API Routes**:
  - `/api/health`, `/api/auth`, `/api/saas`, `/api/platform`, `/api/outlets`, `/api/categories`, `/api/products`, `/api/recipes`, `/api/modifiers`, `/api/inventory`, `/api/suppliers`, `/api/purchasing/orders`, `/api/transfers`, `/api/promotions`, `/api/orders`, `/api/customers`, `/api/shifts`, `/api/reports`, `/api/users`, `/api/qr-menu`.

### Frontend Client Pages & Components (`pos_apps/client/src`)
- **Main Shell**: `App.tsx` (Routing modal hash `#landing`, `#pos` / `#login`, `#superadmin`, `#qr-menu`, context validator).
- **Core SaaS & Autentikasi**:
  - `pages/SaasLandingPage.tsx`: Halaman depan publik SaaS, tabel komparasi paket, modal pendaftaran mandiri 5-field (`#register`).
  - `pages/SuperadminDashboardPage.tsx`: Control tower SuperAdmin platform modular 5-Tab:
    1. **Tab 1: Manajemen Merchant & Saldo Token**: Triage status, pemantauan sirkulasi token Pay-As-You-Go, accordion toko fisik & gudang, serta modal top-up kuota dengan kalkulator diskon kupon promo.
    2. **Tab 2: Master Paket Kuota Fleksibel**: Matriks komparasi fitur F&B, tarif per order, limit cabang/kasir.
    3. **Tab 3: Riwayat Billing & Invoicing (Ledger)**: Audit mutasi kas masuk, pelacakan faktur setup fee & top-up token, serta pratinjau faktur digital sah elektronik (Tax Invoice Preview).
    4. **Tab 4: Tim Staff Platform (RBAC)**: Tata kelola wewenang staf internal Well POS HQ (`SUPER_ADMIN`, `BILLING`, `SUPPORT`) dengan proteksi root SuperAdmin.
    5. **Tab 5: Master Promo SaaS (B2B Voucher Engine)**: Penerbitan kupon diskon onboarding & bonus token transaksi level platform.
  - `pages/LoginPage.tsx`: Dual-login (Login kasir dengan ID Toko + PIN Kasir Bcrypt & Login Backoffice Owner via Email + Password Bcrypt).
  - `pages/DashboardPage.tsx`: Gatekeeper onboarding toko (jika `outlets.length === 0` tampilkan `FullScreenStoreWizard`, jika toko ada masuk ke `BackofficeLayout`), auto-redirect tab kasir ke tab inventori saat masuk mode gudang.
  - `components/saas/FullScreenStoreWizard.tsx`: Wizard layar penuh onboarding toko perdana dengan master 58 klasifikasi sub-industri (Ritel, F&B, Jasa).
  - `components/saas/BackofficeLayout.tsx`: Shell Backoffice Owner dengan navigasi accordion 8 rumpun modul, outlet switcher, dan Mode Khusus Gudang (*Dedicated Warehouse Mode*).
  - `pages/BillingTokensView.tsx`: Halaman monitoring kuota token Pay-As-You-Go mandiri milik Pemilik Toko (`ADMIN` & `OWNER`), live quota meter (order tersisa & progress bar), status paket lisensi, rincian konsumsi order per gerai fisik/gudang, modal top-up kuota dengan kupon promo diskon live, dan modal faktur digital resmi (Official Tax Invoice) ber-NITKU kanonikal.
- **Modul Operasional & Backoffice Merchant**:
  - `pages/PosTerminalView.tsx`: Terminal Kasir POS modular (keranjang, multi-tender, cetak struk virtual, cash drawer kick).
  - `pages/OutletsView.tsx`: Manajemen unit outlet toko & gudang pusat, alokasi pasokan `warehouseId`, konfigurasi pajak PB1 & kanal.
  - `pages/ProductsView.tsx`: Manajemen katalog produk master, varian, dan tombol *"Ambil dari Master Katalog"* untuk toko cabang.
  - `pages/CategoriesView.tsx`: Manajemen kategori produk hirarkis terisolasi per toko.
  - `pages/InventoryView.tsx`: Inventori terpadu (Tab Bahan Baku F&B, Tab Produk Jadi Retail, Tab Kelola Gudang & Kartu Riwayat Mutasi Stok, dan dialog alokasi transfer stok gudang).
  - `pages/RecipesView.tsx`: Visual Bill of Materials (BOM) & formula resep minuman/makanan olahan F&B terisolasi per toko aktif.
  - `pages/ModifiersView.tsx`: Manajemen grup modifier / topping berbayar & gratis.
  - `pages/SuppliersView.tsx`: Manajemen pemasok / vendor bahan baku mentah (kontak WA, termin tempo).
  - `pages/PromotionsView.tsx`: Manajemen voucher diskon persen/nominal & kuota penggunaan.
  - `pages/OrdersView.tsx`: Riwayat transaksi penjualan, open tabs meja terisi, cetak ulang struk, dan pembatalan (*void*).
  - `pages/CustomersView.tsx`: CRM database pelanggan, tier loyalitas member, dan saldo poin reward.
  - `pages/FinancialReportView.tsx`: Laporan Penjualan & Finansial (omset bersih, arus kas tunai/QRIS, PB1 & service charge, kontribusi kanal penjualan, dan rincian transaksi harian).
  - `pages/ProductAnalyticsView.tsx`: Analisis Menu & HPP (peringkat menu terlaris Pareto, kontribusi laba kotor & margin per resep produk, modal bahan baku COGS, dan analisis slow-moving/dead stock).
  - `pages/ShiftsAuditView.tsx`: Audit rekap shift kasir, rekonsiliasi kas (X/Z Report) & deteksi selisih kas.
  - `pages/UsersView.tsx` & `pages/StaffRolesView.tsx`: Manajemen staf toko & matriks perizinan hak akses multi-role.
  - `pages/ReceiptSettingsView.tsx`: Kustomisasi format struk kasir (58mm/80mm, kop toko, footer) & live thermal preview.
  - `pages/TaxesSettingsView.tsx`: Konfigurasi Pajak Daerah Restoran (PB1 10%), Service Charge, dan Biaya Kemasan Takeaway.
  - `pages/SalesChannelsSettingsView.tsx`: Manajemen kanal penjualan langsung & mitra online delivery (GoFood, GrabFood, ShopeeFood, Maxim), RBAC hak akses, dan zero stacked modals.
  - `pages/PaymentSettingsView.tsx`: Konfigurasi metode pembayaran toko, dropzone upload QRIS statis cabang, NMID nasional, bank penerbit, dan live preview kartu QRIS.
- **Modul Self-Ordering Meja Resto (EPIC-19)**:
  - `pages/CustomerQrMenuView.tsx`: Antarmuka pemesanan meja publik tamu ramah sentuhan ponsel dengan mode pratinjau merchant.
  - `pages/QrTablesView.tsx`: Tata letak meja resto, generator kartu meja cetak QR, dan tombol cepat pratinjau menu tamu.
  - `pages/QrLiveOrdersView.tsx`: Live feed pesanan dapur masuk dari self-ordering QR meja secara real-time.
  - `pages/QrMenuSettingsView.tsx`: Pengaturan nama kafe, logo, banner, dan instruksi bayar di kasir.

## 7. ARSITEKTUR AUTENTIKASI, ONBOARDING & TATA KELOLA MULTI-TOKO

### 7.0 Kesepakatan Terminologi & Glosarium Kanonikal
1. **Calon Tenant**: Pengguna yang telah melakukan registrasi mandiri akun tetapi belum disetujui (*unapproved / PENDING*) oleh Platform SuperAdmin.
2. **Tenant**: Pengguna/entitas bisnis yang telah melakukan registrasi dan telah disetujui (*approved / ACTIVE*) oleh Platform SuperAdmin.
3. **Tenant Owner**: Pengguna yang mendaftar di awal; secara otomatis menjadi pemilik utama bisnis (*Role: ADMIN*, `outletId: null`, wewenang penuh atas seluruh operasional bisnis dan backoffice).
4. **Outlet Toko**: Unit fisik toko / gerai usaha yang dibuat dan dimiliki oleh Tenant Owner. **Catatan Standar**: Repositori ini secara kanonikal menggunakan istilah **Outlet Toko** atau **Toko** (istilah *"cabang"* ditiadakan/dihapus agar selaras dengan arsitektur multi-store).

### 7.1 Alur Pendaftaran Mandiri & Onboarding Ter-decoupling (Decoupled Split Registration Flow)
Sesuai rancangan arsitektur modern (EPIC-14, EPIC-15, dan EPIC-18), pendaftaran identitas pemilik usaha (*Owner Identity*) terpisah penuh dari pembuatan toko (*Store/Outlet*):

```text
1. [Landing Page (#register)]
   └── Input 5 Field: Nama Depan, Nama Belakang, WhatsApp (+628...), Email, Password
   └── Endpoint: POST /api/saas/register
   └── Database: Buat Tenant (status: PENDING) & User Owner (Role: ADMIN, outletId: null)
   └── Zero Stores: Belum ada toko fisik/outlet yang dibuat di tahap pendaftaran awal.

2. [Login Guard (State: PENDING)]
   └── Jika calon owner mencoba login: HTTP 403 TENANT_PENDING_APPROVAL
   └── Frontend menampilkan kartu peninjauan akun yang informatif dan ramah.

3. [SuperAdmin Control Tower Triage (EPIC-18)]
   └── Superadmin melihat funnel: "Menunggu Approval"
   └── Aksi: Periksa rincian pendaftar, verifikasi nomor WhatsApp langsung.
   └── Keputusan: APPROVE (status tenant -> ACTIVE) atau REJECT.

4. [First Login & 0-Store Gatekeeper (EPIC-15)]
   └── Owner yang telah ACTIVE login dengan Email & Password.
   └── DashboardPage mendeteksi: `outlets.length === 0`.
   └── Sistem langsung memicu `FullScreenStoreWizard.tsx` (layar penuh, anti-popup bertumpuk).

5. [Pembuatan Toko Perdana & Alokasi Trial (EPIC-15 & EPIC-17)]
   └── Input Toko: Nama Pedagang/Brand, Nama Toko Pertama, Nomor WA Toko, Alamat Fisik.
   └── Multi-Industri: Master 58 sub-industri hierarkis (Ritel, Restoran/F&B, Layanan) berfitur live search & multi-select chips.
   └── Endpoint: POST /api/saas/stores/create-initial
   └── Sistem membuat: Outlet (status: isActive true, trial 14 hari), StorageLocation default.

6. [Enterprise Merchant Backoffice (EPIC-16)]
   └── Owner dialihkan ke `BackofficeLayout.tsx` (Sidebar bertingkat 8 rumpun modul & Multi-Outlet Switcher).
```

### 7.2 Arsitektur Autentikasi & IAM (Identity and Access Management)
Well POS menerapkan arsitektur kredensial multi-tier yang terpisah sesuai ranah operasional:

1. **Platform SuperAdmin**:
   - Entitas: `PlatformUser`
   - Endpoint: `POST /api/platform/auth/login`
   - Kredensial: Email + Password Hash Bcrypt.
   - Wewenang: Pengawasan multi-tenant global, persetujuan pendaftar, suspensi lisensi, dan mode audit/impersonasi toko klien.
2. **Merchant Owner & Backoffice Admin**:
   - Entitas: `User` (Role: `ADMIN` / `SUPERVISOR`)
   - Endpoint: `POST /api/auth/login`
   - Kredensial: Email + `passwordHash` Bcrypt (`outletId: null` untuk Owner akun pusat).
   - Akses: Backoffice manajemen katalog, inventory, pembelian, laporan finansial, dan pengaturan cabang.
3. **Kasir POS & Staf Outlet**:
   - Entitas: `User` (Role: `CASHIER`, terikat ke `outletId` spesifik).
   - Kredensial: PIN numerik 4-6 digit yang di-hash dengan Bcrypt (`pinHash`).
   - Terminal Device Pairing (`POST /api/auth/device/pair`):
     - Mesin kasir fisik dihubungkan menggunakan Identitas Toko (Slug/Tenant ID) dan diotorisasi dengan PIN Admin/Supervisor.
     - Konteks tersimpan aman di `localStorage` perangkat (`pairedDeviceContext`: tenantId, outletId, outletName).
     - Kasir login cepat menggunakan PIN pada terminal yang telah terhubung (`POST /api/auth/login-pin`).
### 7.3 Tata Kelola Akses & Peran Staf (Granular Functional RBAC)
Well POS menerapkan sistem hak akses berbasis domain fungsional operasional nyata (bukan pemisahan hardware channel perangkat ala Mekari):

1. **5 Domain Wewenang Sistem**:
   - `REGISTER_SALES` (Kasir & POS): Buka/Tutup Shift, Checkout Bayar, Hold Order, Diskon, Void/Refund, Buka Laci Kas, Cetak/Kirim Nota WA.
   - `CATALOG_RECIPES` (Menu & Resep): Katalog Menu, Edit Produk & Harga, Racikan Takaran BOM & HPP Pokok, Modifiers/Topping.
   - `INVENTORY_STOCK` (Inventori & Gudang): Saldo Stok Fisik, Penerimaan Pembelian PO, Penyesuaian/Opname, Transfer Cabang.
   - `REPORTS_FINANCIAL` (Laporan & Finansial): X-Report Shift Berjalan, Z-Report Tutup Shift, Tren Penjualan & Produk Terlaris, Laba Rugi P&L.
   - `SETTINGS_GOVERNANCE` (Tata Kelola & Toko): Akun & PIN Staf, Pengaturan Hak Akses, Pajak PB1 & Service Charge, Konfigurasi Printer Thermal.

2. **5 Peran Default Baku (F&B Standard Roles)**:
   - **Pemilik Usaha (Owner)**: Akses penuh 100% ke seluruh modul dan toleransi diskon tak terbatas.
   - **Supervisor / Manajer Toko**: Otorisasi operasional harian, void, penyesuaian stok, laporan shift, printer (Maks diskon: 30% / Rp 250.000).
   - **Kasir Toko (Cashier)**: Transaksi penjualan, hold order, rekap kas shift pribadi, X-report (Maks diskon: 10% / Rp 50.000).
   - **Staf Gudang (Warehouse)**: Fokus persediaan bahan baku, PO supplier, opname fisik, dan mutasi antar cabang.
   - **Barista & Kru Dapur (Kitchen)**: Tiket antrean pesanan dapur, monitoring resep/bahan, dan status hold order.

3. **Batas Toleransi Diskon Kasir (Financial Guardrails)**:
   - Setiap peran memiliki batas wewenang diskon transaksi (per nota) dan diskon produk (per item menu).
   - Jika diskon melebihi toleransi di kasir POS, sistem kasir secara otomatis meminta otorisasi PIN Supervisor.

### 7.4 Mekanisme Operasional Kasir: Shift Guard, Hold Orders & Open Tab (Bayar Nanti)
1. **Shift Guard Enforcement**:
   - Kasir wajib memiliki shift kerja berstatus `OPEN` sebelum dapat menambahkan item ke keranjang (`cart`), melakukan penahanan pesanan (`hold`), maupun checkout.
   - Peringatan banner visual langsung hadir di keranjang belanja dengan aksi cepat satu-klik buka shift.
2. **Scoping Modul Tahan Pesanan (Hold Orders)**:
   - Hold Order wajib mengikat `outletId` toko fisik aktif agar pesanan tersimpan sesuai gerai kasir bertugas (bukan terlempar ke gudang/outlet default).
   - Seluruh notifikasi sukses/gagal di kasir menggunakan in-app banner elegan tanpa popup dialog `window.alert()`.
3. **Dual-Action Checkout (Bayar Langsung vs Bayar Belakangan / Open Tab)**:
   - **Bayar Langsung (Tender Langsung)**: Membuka modal multi-tender (Cash, QRIS, Kartu Debit/Kredit) dan langsung menghasilkan transaksi `PAID` / `COMPLETED`.
   - **Simpan & Kirim Dapur (Bayar Nanti / Open Tab)**: Khusus pesanan Dine In (makan di tempat dengan meja), kasir dapat mengirim pesanan ke dapur dengan status `paymentStatus: 'UNPAID'` via `POST /api/orders/open-tab`.
   - **Pelunasan Meja Terisi**: Kasir dapat memantau seluruh meja belum lunas lewat modal `OpenTabsModal` ("Tagihan Meja"), menarik kembali pesanan ke kasir (menambah item menu), atau langsung menyelesaikan pembayaran (`existingOrderId` via `salesDualWriteService.processCheckout`).

4. **Pengeluaran Kasir Dinamis & Petty Cash Laci (Kas Masuk / Kas Keluar)**:
   - Kasir yang diberikan izin oleh Owner (`canCashOut: true` atau memiliki peran Owner/Admin/Supervisor) dapat mencatat mutasi kas operasional (`CashMovement`) langsung dari laci kasir saat shift berjalan (contoh: iuran lingkungan/sampah, belanja darurat toko seperti es batu/gas, ongkir kurir, dsb).
   - Pengaturan hak akses kasir dikelola secara granular oleh Owner di Backoffice Manajemen Staf (`UsersView.tsx` toggle *Izinkan Pengeluaran Kasir*).
   - Seluruh mutasi kas secara otomatis memperhitungkan saldo laci kasir:
     $$\text{Estimasi Kas Akhir} = \text{Modal Awal} + \text{Penjualan Tunai} + \text{Total Kas Masuk} - \text{Total Kas Keluar}$$
   - Laporan berjalan (X-Report) dan rekonsiliasi tutup shift (Z-Report) menyajikan rincian pengeluaran kasir per kategori & keterangan, mengeliminasi selisih kas fiktif (*phantom cash discrepancies*).

### 7.5 Arsitektur Alokasi Menu Multi-Outlet & Routing Bahan Baku Gudang (EPIC-21)
Pemisahan domain data operasional antara **Tingkat Tenant (Master Pusat)** dan **Tingkat Outlet (Toko Aktif)**:

1. **Prinsip Scoping Antarmuka & Data**:
   - **Pengaturan Umum (Tenant-wide / Pusat)**: Profil Legalitas Usaha, Paket Langganan SaaS, Manajemen Outlet Toko, Master Gudang Logistik Pusat, Master Staf Global, dan Master Katalog Produk Tenant.
   - **Pengaturan Khusus (Outlet-scoped / Toko Aktif)**: Daftar Menu yang dijual di gerai tersebut, Kategori Menu aktif, Saldo Fisik Bahan Baku di gerai tersebut, Format Struk Kasir & Hotline, Pajak PB1 & Service Charge, Metode Pembayaran QRIS/EDC, serta Shift Kasir.

2. **Skema Alokasi Menu (`outlet_products`)**:
   - Produk master tenant dialokasikan ke unit toko fisik via tabel pivot `outlet_products` (`outlet_id`, `product_id`, `is_available`, `price_override`).
   - Query `GET /api/products?outletId=...` otomatis menyaring hanya produk yang terhubung dengan `outletId` toko aktif.
   - Tombol Backoffice *"Ambil dari Master Katalog"* memfasilitasi penambahan menu master ke gerai lain secara modular tanpa duplikasi data master.

3. **Logika Pengurangan Bahan Baku Gudang Fleksibel (Dynamic Warehouse Backflush)**:
   - Setiap outlet toko memiliki `warehouseId` (Gudang Sumber Pasokan Utama).
   - Penjualan menu yang dipasok dari gudang secara otomatis memotong saldo bahan baku mentah (`inventory_balances`) di Gudang Sumber Pasokan yang ditunjuk secara real-time via resep BOM (*Backflush*), dan mencatat mutasi keluar pada buku besar kartu stok (`inventory_ledgers`).

4. **Mode Khusus Gudang (*Dedicated Warehouse Mode*)**:
   - Jika switcher header beralih ke entitas Gudang (`isWarehouse: true`), sidebar Backoffice menyembunyikan modul kasir/toko (POS, QR Meja, Laporan Penjualan Kasir, PB1, Struk, Voucher Promosi, Mitra Ojol) dan beralih ke 4 domain logistik murni:
     1. *Logistik & Persediaan* (`inventory`, `stock_movements`)
     2. *Pengadaan & Vendor* (`suppliers`, `purchasing/orders`)
     3. *Formula & Standar* (`recipes`, `products`)
     4. *Manajemen Gudang* (`staff_users`, `outlets`)
   - Tombol kanan atas *"Buka Kasir POS"* otomatis digantikan oleh tombol *"🏪 Kembali ke Toko"*.
   - Guard navigasi otomatis mengalihkan tab kasir/toko ke tab `inventory` (*Persediaan Stok Bahan*) jika pengguna berpindah ke konteks gudang.

5. **Universal Stock Allocation & Transfer Engine (`StockTransferModal.tsx` & Backend)**:
   - Dukungan alokasi transfer stok antar-gudang dan ke outlet toko dalam dua moda: *"Bahan Baku / Resep BOM"* dan *"Produk Jadi Retail"*.
   - Row-level locking `FOR UPDATE` yang mencegah race condition dan deadlock pada saldo persediaan fisik.

6. **Pemisahan Fungsional Laporan Penjualan vs Analisis Menu & HPP**:
   - **Laporan Penjualan & Finansial (`FinancialReportView.tsx`)**: Fokus pada omset kotor/bersih, arus kas riil tunai vs QRIS, setoran pajak PB1 daerah, service charge, kontribusi per kanal penjualan langsung & mitra delivery online, serta rincian transaksi nota.
   - **Analisis Menu & HPP (`ProductAnalyticsView.tsx`)**: Fokus pada intelijen bisnis dan HPP: ranking produk terlaris Pareto (Top 10), kontribusi margin laba kotor per resep produk olahan F&B, modal bahan baku pokok (COGS), dan deteksi menu slow-moving/dead-stock.

---

## 8. SUITE PENGUJIAN OTOMATIS (CANONICAL TEST SUITES)

Seluruh logika bisnis, arsitektur, dan flow onboarding diverifikasi oleh suite pengujian otomatis mandiri:

```bash
# Direktori Kerja: pos_apps/server

# 1. Verifikasi Onboarding End-to-End Multi-Store (EPIC-14 s.d EPIC-18)
npx ts-node src/scripts/verify_onboarding_e2e.ts

# 2. Verifikasi Kontrak Sandbox Lokal & Master Seeder (EPIC-12)
npm run test:sandbox

# 3. Verifikasi Hardening Produksi, RLS, Cache & Security Headers (EPIC-11)
npx ts-node src/migrations/contract/test_epic11_production_hardening.ts

# 4. Verifikasi Siklus SaaS, SuperAdmin & Billing Lifecycle (EPIC-10)
npx ts-node src/migrations/contract/test_epic10_saas_lifecycle.ts

# 5. Verifikasi Analitik Keuangan, COGS/HPP & Ekspor Laporan (EPIC-09)
npx ts-node src/migrations/contract/test_epic09_financial_analytics.ts

# 6. Verifikasi CRM Pelanggan, Loyalty Points & Mesin Promo (EPIC-08)
npx ts-node src/migrations/contract/test_epic08_crm_loyalty_promo.ts

# 7. Verifikasi Resep F&B, Modifiers & Pemotongan Bahan Baku (EPIC-06)
npx ts-node src/migrations/contract/test_epic06_fnb_workflow.ts

# 8. Kompilasi TypeScript Bebas Error (Server & Client)
npm run build # di pos_apps/server (tsc)
npm run build # di pos_apps/client (vite build)
```

---

## 9. CATATAN KEKURANGAN EKSISTING & TECHNICAL DEBT (GAP ANALYSIS)

Berikut adalah catatan hal-hal yang **masih disimulasikan / belum terhubung ke provider pihak ketiga** sebelum peluncuran produksi komersial:

| Area | Kondisi Eksisting Saat Ini | Kebutuhan Nyata di Lapangan (Gap) |
| :--- | :--- | :--- |
| **Printer Kasir** | Menggunakan dialog browser `window.print()` dan canvas PDF. | Perlu driver **Web Bluetooth / USB ESC/POS binary** tanpa dialog browser, auto-cutter paper, dan trigger buka laci kasir (*cash drawer kick*). |
| **Barcode Scanner** | Hanya merespons text field input aktif. | Perlu global keyboard wedge listener (< 50ms keystroke gap) agar scan barcode fisik langsung masuk keranjang belanja dari layar mana pun. |
| **Payment Gateway** | Webhook simulator & URL pembayaran mock (`simulator.controller.ts`). | Perlu integrasi API credentials live Midtrans / Xendit dengan validasi tanda tangan kriptografi (`Signature Key`). |
| **WhatsApp Gateway** | Menggunakan URL link manual `api.whatsapp.com/send?...`. | Perlu engine otomatis via provider WhatsApp Gateway resmi (Fonnte/Waba/Twilio) agar OTP dan digital receipt terkirim di background. |
| **Email SMTP** | Mock transporter nodemailer (output terminal). | Perlu koneksi ke relay SMTP produksi (Resend, SendGrid, Mailgun, atau AWS SES) untuk notifikasi tagihan dan invoice. |
| **UI Resep & KDS** | UI Resep (`RecipesView.tsx`) & Live Orders Dapur (`QrLiveOrdersView.tsx`) telah aktif di Backoffice. | Opsional: Penambahan mode layar sentuh terisolasi khusus *Station KDS Dapur* (Kitchen Display Station) tanpa akses navigasi backoffice. |
| **UI Purchasing PO** | Modul Pemasok (`SuppliersView.tsx`) aktif; Backend API PO & Transfer siap. | Perlu tab formulir Purchase Order supplier dan penerimaan surat jalan barang masuk langsung di UI. |
| **Offline-First** | Kasir membutuhkan koneksi HTTP server aktif. | Perlu IndexedDB queue + Service Worker (PWA) agar kasir tetap bisa checkout saat internet toko offline dan auto-sync saat online. |
| **Infrastruktur Cloud** | Redis berjalan dengan fallback in-memory Map. | Memerlukan dedicated managed Redis cluster saat horizontal scaling multi-container. |

---

## 10. ATURAN PENERUSAN KONTEKS & STANDAR DESAIN KANONIKAL (CONTEXT PROTOCOL & CODE STANDARDS)

Setiap pengembang dan AI Coding Assistant wajib mematuhi panduan baku berikut:

1. **Sumber Kebenaran Tertinggi (*Single Source of Truth*) & Navigasi Dokumen**:
   - Jika terdapat perbedaan antara ingatan obrolan dan dokumen, rujuk dokumen ini (`docs/00_PROJECT_CONTEXT.md`) dan kode aktif di `pos_apps/server` serta `pos_apps/client`.
   - **Protokol Pemisahan Peran Dokumen**:
     - Gunakan [`docs/00_PROJECT_CONTEXT.md`](./00_PROJECT_CONTEXT.md) sebagai panduan *arsitektur teknis, tech stack, skema basis data target (40 model Prisma aktif), keamanan Postgres RLS, dan standar implementasi kode*.
     - Gunakan [`docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md`](./epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md) sebagai panduan *riwayat deliverable bisnis (EPIC-01 s.d EPIC-21), file-file modul yang terpasang, dan roadmap tahapan rilis mendatang*.
     - Gunakan [`docs/README.md`](./README.md) sebagai peta navigasi seluruh folder dokumentasi.
     - Gunakan [`docs/decisions/ADR-*.md`](./decisions/) (ADR-001 s.d ADR-007) sebagai referensi keputusan arsitektur strategis (Multi-tenant, Negative Stock, UOM vs Packaging, Batch Lot, Domain Boundaries, Decoupled Onboarding, dan **Security Hardening Tenant Isolation**).
     - Folder `docs/archive/migration_phase/` bersifat *read-only audit trail* dari fase transisi skema database masa lalu.
2. **Integritas Skema Basis Data (40 Model Prisma Aktif)**:
   - **Dekomisioning Tabel Legacy Monolith**: Jangan pernah membuat query yang merujuk kembali ke tabel lama pra-migrasi (`stock_movements`, `payments`, atau skema kolom lama yang telah di-drop pada EPIC-04).
   - **Tabel Pivot Baru `outlet_products` (EPIC-21)**: Tabel `outlet_products` (`OutletProduct`) yang aktif saat ini adalah tabel pivot baru ternormalisasi untuk scoping katalog per unit toko fisik (`outlet_id`, `product_id`, `is_available`, `price_override`).
   - Skema basis data saat ini terdiri dari **40 model Prisma aktif** yang mencakup multi-tenant SaaS, master katalog, persediaan multi-gudang, formula resep F&B BOM, transaksi penjualan, rantai pasok/PO vendor, CRM & promosi, dan self-ordering meja QR.
3. **Penegakan Tenant Boundary (Diperbarui: ADR-007 — 2026-09-25)**:
   - Setiap endpoint dan service baru wajib menyertakan validasi `tenantId`. Untuk transaksi kritis data tenant, gunakan selalu `rlsService.withTenantContext`.
   - **R-10 — Canonical Tenant Resolution Order (WAJIB)**: Urutan resolusi di semua controller: `tenantId = req.user?.tenantId || req.tenantId`. Jika masih kosong → **return HTTP 401**. Dilarang keras melanjutkan dengan `prisma.tenant.findFirst()`.
   - **R-11 — DILARANG `req.query.tenantId` sebagai Auth Context**: Query param `?tenantId=` adalah user input yang bisa di-inject untuk bypass isolasi tenant.
   - **R-12 — JWT Secret Production-Grade**: Minimum 64-byte entropy. Generate: `openssl rand -hex 64`. Jangan commit ke Git.
   - **R-13 — CORS Whitelist via Env**: `cors()` tanpa config dilarang. Gunakan `CLIENT_ORIGIN` env var.
   - **R-14 — PENDING Tenant Guard**: Semua endpoint mutation wajib cek `tenant.status !== 'PENDING'` → return 403 jika PENDING.
4. **Standarisasi Mutlak Input WhatsApp (`WhatsAppInput`)**:
   - Seluruh input nomor telepon/WhatsApp di seluruh platform **WAJIB** menggunakan `<WhatsAppInput />` (`src/components/ui/WhatsAppInput.tsx`) dengan format kanonikal `+628...` dan badge bendera `🇮🇩 +62`.
   - Dilarang keras menggunakan `<input type="tel">` manual biasa.
   - Utilitas sanitasi kanonikal: `formatIndonesianWhatsApp()`, `validateIndonesianWhatsApp()` (`src/utils/phone.ts`).
5. **Standarisasi Format Angka & Mata Uang Otomatis (`CurrencyInput`)**:
   - Seluruh input angka mata uang (harga produk, modal kasir, diskon, pembayaran tender kasir) **wajib otomatis berpemisah ribuan titik (.) saat diketik secara langsung** (cth: `1000` -> `1.000`, `1000000` -> `1.000.000`).
   - Komponen kanonikal: `<CurrencyInput />` (`src/components/ui/CurrencyInput.tsx`).
   - Utilitas kanonikal: `formatThousands()`, `formatRupiah()`, `parseFormattedNumber()` (`src/utils/currency.ts`).
6. **Standarisasi Tema Visual (Well POS Clean White-Blue)**:
   - Seluruh antarmuka Backoffice Merchant, Landing Page, dan Setup Wizard wajib menggunakan palet **Putih-Biru** (`bg-slate-50`, kartu `bg-white`, teks `text-slate-900`, aksen `blue-600` / `blue-950`). Dilarang menggunakan tema gelap pekat (dark mode) pada alur merchant.
   - Seluruh tombol aksi utama harus berukuran proporsional (dilarang membuat tombol raksasa yang memenuhi layar secara tidak wajar).
7. **Zero Stacked Modals (Anti-Popup Bertumpuk)**:
   - Dilarang membuat modal popup bertumpuk di atas modal popup lain.
   - Daftar toko owner di Superadmin wajib menggunakan **Inline Expandable Row (Accordion Sub-Baris)** di dalam tabel. Aksi Kelola Langganan ditaruh per toko dan membukanya sebagai modal tunggal (*single modal*).
8. **Decoupled Multi-Store Hierarchy & Siklus Hidup Akun Owner vs Toko**:
   - Struktur hirarki 1-Owner-ke-N-Toko. Registrasi pendaftaran awal murni membuat akun Owner & Tenant (0 toko fisik dibuat saat registrasi).
   - Status akun owner biner (`ACTIVE` / `INACTIVE`). Masa uji coba (*Trial 14 Hari*) murni di level unit toko fisik (`Outlet`).
   - Kaskade Nonaktif: Jika akun owner `INACTIVE`, seluruh toko di bawahnya otomatis `INACTIVE`.
   - Metrik "Toko Fisik Aktif" di Superadmin hanya menghitung outlet yang `isActive: true` DAN status parent tenant adalah `ACTIVE` atau `TRIAL`.
9. **Master Testbed Data Status (5 Skenario UAT)**:
   - Seeder: `npm run db:seed:testbed` (`pos_apps/server/prisma/seed.testbed_statuses.ts`):
     1. Budi Santoso (`PENDING APPROVAL`, 0 Toko)
     2. Siti Rahmawati (`ACTIVE`, 0 Toko - Pengujian Wizard Toko Baru)
     3. Dendy Aditya (`ACTIVE`, 1 Toko Trial Aktif - Kopi Senja)
     4. Hendrawan Pratama (`ACTIVE`, 3 Toko Aktif - Pratama Group Multi-Store)
     5. Reza Mahendra (`INACTIVE`, 2 Toko Nonaktif Kaskade - GadgetZone).
10. **Verifikasi Wajib Sebelum Selesai**:
    - Setiap penambahan fitur wajib diuji dengan `npm run build` di server dan client, serta memastikan suite `verify_onboarding_e2e.ts` dan `test:sandbox` tetap berstatus EXIT 0.
11. **Kebijakan Bebas Pop-Up Browser Native (Zero Native Pop-Up Policy & DialogContext)**:
    - Dilarang keras menggunakan pop-up bawaan browser (`window.alert`, `window.confirm`, `alert()`, `confirm()`).
    - Seluruh dialog konfirmasi, peringatan sistem, dan notifikasi wajib menggunakan hook kanonikal `useDialog()` dari `src/context/DialogContext.tsx`:
      - `await dialog.confirm({ title, message, variant, confirmText, cancelText })`: Menghasilkan Promise biner (`true` / `false`) dengan modal berdesain elegan, rounded-3xl, dan backdrop blur.
      - `await dialog.alert({ title, message, variant, confirmText })`: Peringatan modal tunggal elegan tanpa tombol batal.
      - `dialog.toast(message, 'success' | 'error' | 'info')`: Notifikasi toast melayang di pojok kanan atas untuk umpan balik instan tanpa memblokir layar.
      - Terdapat *Safety-Net Global Interceptor* di `DialogContext` yang secara otomatis mengalihkan `window.alert` tak terduga ke modal elegan.
12. **Standarisasi Format Nomor ID Staf & Petugas POS (`userCode`)**:
    - **Format Wajib**: Numerik murni 5-digit (`/^\d{5}$/`) untuk seluruh tingkatan akun dan peran dalam organisasi tenant.
    - **Tujuan Operasional**: Menjamin kemudahan input pada *virtual numpad* layar sentuh terminal kasir POS saat login cepat menggunakan ID Staf + PIN 6-digit, serta otorisasi *pairing* perangkat kasir (`/api/auth/pair-device`) dan *bypass supervisor/void*.
    - **Struktur Hirarki Awalan (Prefix)**:
      - `00001` - `09999`: Owner / Pemilik Utama Bisnis (Default pendaftaran SaaS: `00001`).
      - `10001` - `19999`: Kasir Operasional Toko (`Role.CASHIER`).
      - `20001` - `29999`: Supervisor & Manajer Toko (`Role.SUPERVISOR`).
      - `30001` - `39999`: Staf Gudang & Logistik (`Role.WAREHOUSE`).
      - `90001` - `99999`: Administrator Sistem & Manajer Eksekutif Khusus (`Role.ADMIN`).
    - Dilarang keras menggunakan format alfanumerik bebas (seperti `USR-OWNER-01`) pada akun operasional aktif.
13. **Batasan Metode Pembayaran Tahap Awal (Murni Tunai & QRIS Statis)**:
    - **Kesepakatan Arsitektural**: Pada tahap awal pengembangan (*initial development milestone*), metode pembayaran aktif kasir POS, antarmuka checkout, pelaporan backoffice, dan generator simulasi transaksi disepakati secara ketat HANYA **Tunai (CASH)** dan **QRIS Statis**.
    - **Rasional & Konteks**: Sistem saat ini belum diintegrasikan dengan Payment Gateway dinamis (Midtrans/Xendit) maupun terminal EDC perbankan (Debit/Kredit).
    - **Konsekuensi Implementasi**:
      - Dilarang memunculkan opsi tender Kartu Kredit (`CREDIT_CARD`), Kartu Debit (`DEBIT_CARD`), atau Transfer Bank (`BANK_TRANSFER`) pada alur kasir aktif maupun tabel laporan/filter pembayaran.
      - Seluruh seeder transaksi dummy gerai F&B wajib 100% menggunakan `PaymentMethod.CASH` atau `PaymentMethod.QRIS`.
      - Integrasi payment gateway lainnya (QRIS dinamis, Virtual Account, EDC) baru akan dieksekusi pada fase roadmap berikutnya setelah fondasi operasional kasir & laporan tuntas terverifikasi.
14. **Standar Paging Tabel Kanonikal (`TablePagination`)**:
    - Seluruh tabel data (Backoffice Toko, F&B, Gudang, hingga Superadmin Platform) wajib menggunakan komponen kanonikal `<TablePagination />`.
    - Aturan Paging:
      - Default baris per halaman: **10** (`pageSize = 10`).
      - Opsi ukuran halaman: **10 / 25 / 50 / 100**.
      - Wajib menampilkan indikator rentang data aktif: `Menampilkan X - Y dari Z [item]`.
      - Tombol navigasi: *Sebelumnya*, nomor halaman aktif dengan highlight biru tajam, dan *Selanjutnya*.
      - Auto-reset ke halaman 1 saat user mengubah kata kunci pencarian atau filter status.
15. **Protokol Pengujian Browser Playwright Lokal**:
    - Browser testing Playwright telah terkonfigurasi dan terpasang secara lokal pada environment pengguna.
    - AI Agent dan Developer dilarang bergantung pada subagent yang mendownload driver Playwright secara remote dari CDN eksternal yang rentan kendala jaringan/404; seluruh pengujian browser wajib dijalankan via CLI/runner lokal.
16. **Protokol Early Warning Migrasi Database & Cloud Deployment**:
    - **Wajib DDL Sync Supabase**: Render CI/CD tidak menjalankan DDL migrasi otomatis. Setiap perubahan skema Prisma wajib dipatch ke Supabase via `DIRECT_URL` (Port 5432) sebelum kode di-push.
    - **Dual Port Supabase**: Gunakan Port 6543 (PgBouncer) untuk query runtime aplikasi, dan Port 5432 (Direct) untuk DDL/migrasi.
    - **Vercel Main-Branch Rule**: Fitur produksi hanya akan live di `well-pos-app.vercel.app` jika branch `dev` telah di-merge ke branch `main`.
17. **Standar UX Mobile & Smartphone Portrait 6,8 Inci (`BackofficeLayout` & Handheld)**:
    - **Viewport Target**: Viewport 390px s.d 430px CSS width (aspek rasio 19.5:9 s.d 20:9), touch-first 44x44px target sentuh.
    - **Off-Canvas Mobile Drawer**: Di `<BackofficeLayout />`, sidebar otomatis beralih menjadi sliding drawer dengan hamburger trigger di topbar pada layar `< 768px`, mencakup seluruh 8 grup menu toko maupun mode gudang logistik.
    - **Ergonomic Bottom Navigation Bar**: Menyediakan 5 akses cepat di area jangkauan jempol (*Prime Thumb Zone*): Kasir (`pos`), Ringkasan (`overview`), Pesanan (`orders`), Stok (`inventory`), dan Menu (`drawer`).
    - **Zero Stacked/Colliding Bars**: Bottom Nav Bar otomatis disembunyikan saat kasir POS aktif (`activeTab === 'pos'`) agar tidak menabrak sticky cart bar milik `<PosMobileView />`.
    - **Edge-to-Edge POS Canvas**: Container `<BackofficeLayout />` menerapkan padding `p-0` pada tab `pos` di mobile untuk memaksimalkan ruang vertikal kasir handheld tanpa double scrollbars.
18. **Standar Ergonomi Modal & Checkout Layar Handheld Smartphone 6,8 Inci**:
    - **Bottom-Sheet Dialogs**: Seluruh modal pada tampilan mobile (`<Modal />`, `<PaymentModal />`, `<OrderSuccessModal />`, `<ProductModifierModal />`, `<StartShiftModal />`, `<CloseShiftModal />`, `<ConfirmModal />`) wajib menggunakan pola *bottom-sheet* (`items-end sm:items-center`, `p-0 sm:p-4`, `rounded-t-3xl sm:rounded-3xl`, `max-h-[92vh] sm:max-h-[95vh]`).
    - **Sticky Action Footer di Prime Thumb Zone**: Tombol aksi utama (seperti *Selesaikan & Cetak*, *Masuk Keranjang*, *Transaksi Baru*, konfirmasi/tutup shift) dilarang diletakkan di dalam kontainer yang ter-scroll (*overflow-y-auto*). Tombol aksi wajib berada pada footer tetap (`shrink-0 border-t border-slate-200 bg-white p-3.5 sm:p-5`) di luar area scroll, sehingga kasir tidak perlu scroll ke bawah layar secara manual untuk menyelesaikan pembayaran atau konfirmasi.
    - **Responsive QRIS & Receipt Preview**: Gambar barcode QRIS toko dan kertas struk termal disesuaikan skalanya secara proporsional agar tidak memakan seluruh ketinggian layar ponsel portrait, dengan `overscroll-contain` untuk kenyamanan sentuhan satu jempol.
19. **Standar Hybrid Table/Card View & Data Table Ergonomics Smartphone 6,8 Inci**:
    - **Pola Hybrid Table/Card**: Seluruh tabel data backoffice dengan banyak kolom (`OrdersView`, `ProductsView`, `CustomersView`, `ShiftsAuditView`) wajib menggunakan pola *Hybrid*: pada desktop tetap menggunakan tabel lengkap (`hidden md:block`), sedangkan pada smartphone portrait otomatis beralih menjadi **Card List View vertikal** (`block md:hidden`). Hal ini meniadakan keharusan scrolling horizontal yang melelahkan bagi pengguna satu tangan.
    - **Komponen Kanonikal `TablePagination` Mobile**: Pada layar smartphone portrait (< 640px), kontrol baris per halaman dan informasi rentang data diringkas di baris atas tanpa wrapping berantakan. Navigasi nomor halaman disederhanakan menjadi kontrol sentuh ergonomis `[ < Sebelumnya ]` `Hal X / Y` `[ Selanjutnya > ]` dengan target sentuh $\ge 36\text{px}$ dan *zero horizontal overflow*.
    - **Floating Bulk Action Bar Clearance**: Setiap bilah aksi massal melayang (*floating bottom bar*) wajib menerapkan offset vertikal `bottom-20 sm:bottom-6` agar tidak tertutup atau menabrak Bottom Navigation Bar Backoffice (`h-16`).
20. **Standar Laporan Keuangan, Grafik Analitik & Data Harian Layar Smartphone 6,8 Inci**:
    - **Pola Hybrid Laporan Finansial (`FinancialReportView`)**: Tabel rincian harian 6 kolom di desktop beralih menjadi **Mobile Daily Trend Card List** pada smartphone, menampilkan tanggal, jumlah faktur berhasil, omset bersih tebal, serta mini-grid komparasi arus kas Tunai (Cash) vs Non-Tunai (QRIS).
    - **Pola Hybrid Analitik Produk & HPP (`ProductAnalyticsView`)**: Leaderboard 7 kolom menu terlaris beralih menjadi kartu menu bernomor peringkat (🥇, 🥈, 🥉, #X), total omset, serta grid mini perbandingan Modal (COGS/HPP) vs Laba Bersih & Persentase Margin. Tabel Slow-Moving & Dead Stock beralih menjadi kartu peringatan modal mengendap beraksen amber/rose.
    - **Ergonomi Toolbar & Grafik Analitik (`BusinessSummaryView`)**:
      - Tombol aksi ekspor CSV dan cetak laporan dirancang fleksibel penuh (`w-full sm:w-auto`, `flex-1 sm:flex-initial`) untuk sentuhan satu jempol.
      - Diagram Donut Chart metode pembayaran otomatis beralih ke orientasi vertikal (`flex-col sm:flex-row`) pada layar ponsel portrait agar grafik lingkaran dan daftar nominal rupiah metode bayar tidak berdesakan secara horizontal.
21. **Standar Pengaturan Toko & Modul Meja QR Layar Smartphone 6,8 Inci (`ReceiptSettings`, `PaymentSettings`, `SalesChannelsSettings`, `QrTablesView`, `QrLiveOrdersView`)**:
    - **Ergonomi Form & Tombol Submit di Prime Thumb Zone**: Pada halaman pengaturan (`ReceiptSettingsView`, `PaymentSettingsView`, `SalesChannelsSettingsView`), seluruh tombol aksi simpan dan submit dirancang membentang penuh di mobile (`w-full sm:w-auto justify-center`) agar langsung dapat ditekan jempol satu tangan tanpa perlu peregangan jari.
    - **Pola Bottom-Sheet Pratinjau QR Tent Card (`QrTablesView`)**: Modal pratinjau dan pencetakan tent card meja QR beralih menjadi dialog *bottom-sheet* ergonomis (`items-end sm:items-center`, `p-0 sm:p-4`, `rounded-t-3xl`, `max-h-[92vh]`). Area kartu tent card dapat di-scroll secara mandiri dengan `overscroll-contain`, sementara tombol *Download SVG / PNG* dan *Tutup* terkunci pada sticky bottom bar di luar scroll.
    - **Responsive Live Kitchen Feed (`QrLiveOrdersView`)**: Feed pesanan meja self-ordering tertata dalam kartu 1-kolom compact di smartphone, dengan status badge yang jelas dan tombol pembaruan status dapur (*Terima*, *Masak*, *Selesai*) yang memenuhi target sentuh minimum $\ge 40\text{px}$.

---

## 11. PROTOKOL INFRASTRUKTUR CLOUD & EARLY WARNING SYSTEM (RENDER, SUPABASE, VERCEL)

Topologi server aktif saat ini menggunakan arsitektur *Zero-Cost Bootstrap Multi-Cloud*:

| Komponen | Platform & Region | Spesifikasi / Konfigurasi | Batasan Kritis (*Hard Limits*) & Early Warning |
| :--- | :--- | :--- | :--- |
| **Frontend SPA** | **Vercel** *(Global/SG)* | React 19 + Vite (`well-pos-app.vercel.app`) | • Auto-deploy hanya aktif untuk branch **`main`**.<br>• Perubahan di branch `dev` tidak akan tampil di domain utama sebelum di-merge.<br>• Caching browser agresif pada smartphone kasir: butuh hard reload jika update baru dirilis. |
| **Backend API** | **Render** *(Singapore)* | Node 20 + Express (`wellpos-api-dev.onrender.com`) | • **Cold Start (~50s)** jika idle 15 menit. Dicegah dengan GitHub Actions cron pinger tiap 10 menit.<br>• **Batas 750 jam/bulan per akun**: Jangan jalankan web service gratis lain di akun Render yang sama.<br>• **RAM 512 MB & Ephemeral Disk**: Hindari query tanpa paging dan dilarang simpan upload permanen di disk lokal. |
| **Database** | **Supabase** *(AWS SG)* | PostgreSQL 16 Managed (Port 6543 / 5432) | • **Inactivity Pausing**: Database akan tidur jika tidak ada query selama 7 hari berturut-turut (restore manual via Supabase Dashboard).<br>• **Render Tidak Menjalankan Migrasi**: Skema baru di `schema.prisma` wajib dipatch manual ke Supabase via Port 5432.<br>• Port 6543 (PgBouncer) menolak query DDL (`CREATE TYPE`, `ALTER TABLE`). |
| **Keep-Alive Bot** | **GitHub Actions** | Workflow `.github/workflows/keep_alive.yml` | Pinger cron tiap 10 menit ke `/api/health` Render agar container backend tidak tidur. |

---

## 12. ROADMAP PRODUK & TAHAPAN PENGEMBANGAN BERIKUTNYA

Rencana pengembangan sprint produk berikutnya (Fase 2 WhatsApp Gateway, Fase 3 Midtrans QRIS/VA, Fase 4 Perangkat Keras Thermal ESC/POS) dikelola secara terpusat pada dokumen:
👉 [`docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md`](./epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md#upcoming-roadmap)
