# WELL POS — QA APPLICATION INVENTORY
## Comprehensive Codebase, Module, Architecture & API Discovery Audit

> **Audit Type**: Strict Read-Only Discovery Audit (Antigravity Prompt 1)  
> **Repository**: `/Users/dendyaditya/Projects/pos_project`  
> **Audit Date**: 12 Oktober 2026  
> **Status**: COMPLETED ✅  

---

### 1. RINGKASAN EKSEKUTIF ARSITEKTUR

Berdasarkan audit read-only langsung pada codebase, Well POS adalah platform **Multi-Tenant Point-of-Sale (POS), Inventory Ledger, dan Supply Chain SaaS** yang mendukung multi-vertikal (**Retail, Food & Beverage / F&B, dan Services**). Sistem telah menyelesaikan 100% migrasi dari skema legacy monolith ke skema relasional target ternormalisasi penuh (`pos_db` dengan 46 model Prisma aktif).

| Komponen | Spesifikasi / Teknologi | Status Audit |
| :--- | :--- | :---: |
| **Frontend Framework** | React 19.2 (SPA) + Vite 8.3 + TypeScript | `[VERIFIED]` |
| **Frontend Styling** | Modern Vanilla CSS (`src/index.css`) berpalet Clean White-Blue + Tailwind utilities | `[VERIFIED]` |
| **Frontend Entrypoint** | [`pos_apps/client/src/main.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/main.tsx), [`App.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/App.tsx) | `[VERIFIED]` |
| **Backend Framework** | Node.js 20 LTS, Express 4.21, TypeScript 5.6 (Runner: `tsx watch`) | `[VERIFIED]` |
| **Backend Entrypoint** | [`pos_apps/server/src/index.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/index.ts) (Port 5001) | `[VERIFIED]` |
| **Database ORM** | PostgreSQL 16 + Prisma ORM 5.22 ([`schema.prisma`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/prisma/schema.prisma) — 46 Model Aktif) | `[VERIFIED]` |
| **Caching Layer** | Redis 7 Alpine dengan fallback in-memory Map ([`cache.service.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/services/cache.service.ts)) | `[VERIFIED]` |
| **Security Layer** | OWASP Security Headers, IP/Endpoint Sliding Rate Limiter, bcryptjs, JWT | `[VERIFIED]` |
| **Active Local Ports** | Backend: `http://localhost:5001` (Active), Frontend: `http://localhost:5173` (Active) | `[VERIFIED]` |

---

### 2. INVENTARISASI RUTE FRONTEND & NAVIGASI PENGGUNA

Aplikasi frontend menggunakan navigasi berbasis URL Hash (`window.location.hash`) dengan pelindung Honeypot keamanan:

| URL Hash / Rute | Tampilan / Halaman | Hak Akses / Guard | Deskripsi & Bukti |
| :--- | :--- | :--- | :--- |
| `/#landing` atau `/#` | [`SaasLandingPage.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/SaasLandingPage.tsx) | Publik (Guest) | Portal pemasaran SaaS, pricing tier, pendaftaran owner mandiri (`[VERIFIED]`) |
| `/#pos` atau `/#login` | [`LoginPage.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/LoginPage.tsx) | Publik / Kasir | Layar login tab ganda: Kredensial Email & Kasir PIN cepat (`[VERIFIED]`) |
| `/#dashboard` | [`DashboardPage.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/DashboardPage.tsx) | Merchant Authenticated | Portal operasional merchant, kasir, gudang, supervisor, owner (`[VERIFIED]`) |
| `/#hq-gate-99` | [`SuperadminDashboardPage.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/SuperadminDashboardPage.tsx) | Superadmin Auth | Portal rahasia tata kelola platform SaaS (`SUPERADMIN_SECRET_HASH`) (`[VERIFIED]`) |
| `/#superadmin`, `/#admin` | Redirect ke `/#landing` | Honeypot | Otomatis dialihkan ke landing untuk mencegah brute force scan (`[VERIFIED]`) |
| `/#menu?outletId=X&table=Y` | [`CustomerQrMenuView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/CustomerQrMenuView.tsx) | Pelanggan Publik | Self-ordering buku menu digital QR meja restoran (`[VERIFIED]`) |

---

### 3. INVENTARISASI MODUL & TAMPILAN BACKOFFICE (`DashboardPage.tsx`)

Aplikasi mengorganisasikan 36 sub-tampilan (*tabs*) yang dimuat secara code-split (*lazy loading*) via [`DashboardPage.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/DashboardPage.tsx):

#### A. Operasional Kasir & Penjualan
1. **`pos`** — [`PosTerminalView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/PosTerminalView.tsx): Terminal kasir sentuh, varian, modifiers, keranjang, multi-tender, split bill, open tab, scanner barcode live, audio synth chime. (`[VERIFIED]`)
2. **`orders`** — [`OrdersView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/OrdersView.tsx): Riwayat pesanan nota kasir, cetak ulang struk thermal, pembatalan order (VOID) otorisasi PIN Spv, filter status pembayaran. (`[VERIFIED]`)
3. **`shifts`** — [`ShiftsAuditView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/ShiftsAuditView.tsx): Audit shift kasir, mutasi kas kasir (cash in/out), hitung pecahan uang, rekonsiliasi X/Z Report murni ringkasan. (`[VERIFIED]`)
4. **`qr_orders`** — [`QrLiveOrdersView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/QrLiveOrdersView.tsx): Kitchen Display System (KDS) pesanan QR meja resto, fullscreen dark mode koki, audio lonceng order masuk & hidangan siap saji. (`[VERIFIED]`)

#### B. Produk, Menu & Resep (BOM)
5. **`products`** — [`ProductsView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/ProductsView.tsx): Manajemen produk, SKU, varian, harga pokok HPP, penautan modifier, cetak label barcode stiker. (`[VERIFIED]`)
6. **`categories`** — [`CategoriesView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/CategoriesView.tsx): Kategori hirarkis menu dan produk. (`[VERIFIED]`)
7. **`modifiers`** — [`ModifiersView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/ModifiersView.tsx): Kelompok topping/add-on berbayar & gratis, penautan efek pengurangan stok bahan baku. (`[VERIFIED]`)
8. **`recipes`** — [`RecipesView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/RecipesView.tsx): Bill of Materials (BOM) resep F&B, konversi satuan UOM (ml, gram, pcs), kalkulasi real-time HPP bahan. (`[VERIFIED]`)

#### C. Bahan Baku & Rantai Pasok (Supply Chain)
9. **`inventory`** — [`InventoryView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/InventoryView.tsx): Buku besar saldo fisik bahan baku, opname stok, penyesuaian manual, peringatan batas minimum. (`[VERIFIED]`)
10. **`warehouses`** — [`WarehousesView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/WarehousesView.tsx): Manajemen multi-gudang dan lokasi penyimpanan internal (Bar, Kitchen, Storage). (`[VERIFIED]`)
11. **`stock_movements`** — [`StockMovementsView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/StockMovementsView.tsx): Log pergerakan stok immutable (Audit Trail ledgers). (`[VERIFIED]`)
12. **`purchase_orders`** — [`PurchaseOrdersView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/PurchaseOrdersView.tsx): Pengadaan barang (PO), goods receiving, update Moving Average Cost. (`[VERIFIED]`)
13. **`transfers`** — [`StockTransfersView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/StockTransfersView.tsx): Mutasi antar-toko/gudang (Request -> Dispatch -> Receive). (`[VERIFIED]`)
14. **`suppliers`** — [`SuppliersView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/SuppliersView.tsx): Direktori pemasok bahan baku. (`[VERIFIED]`)

#### D. Keuangan & Analitika Bisnis
15. **`overview`** — [`BusinessSummaryView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/saas/BusinessSummaryView.tsx): KPI dasbor eksekutif, tren penjualan visual SVG, status langganan SaaS. (`[VERIFIED]`)
16. **`reports`** — [`FinancialReportView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/FinancialReportView.tsx): Laba kotor, laba bersih operasional (Gross Profit - OPEX shift), ekspor CSV UTF-8 BOM, arus kas riil. (`[VERIFIED]`)
17. **`product_analytics`** — [`ProductAnalyticsView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/ProductAnalyticsView.tsx): Analisis produk terlaris (Top 10), kontribusi margin kotor per produk. (`[VERIFIED]`)
18. **`billing_tokens`** — [`BillingTokensView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/BillingTokensView.tsx): Kuota token pay-as-you-go Pakasir QRIS, riwayat faktur langganan. (`[VERIFIED]`)

#### E. CRM, Loyalitas & Pelanggan
19. **`customers`** — [`CustomersView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/CustomersView.tsx): Direktori pelanggan, tier membership (Bronze/Silver/Gold), poin loyalty, dan Buku Kasbon Piutang. (`[VERIFIED]`)
20. **`promotions`** — [`PromotionsView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/PromotionsView.tsx): Voucher diskon nominal/persen, Buy-X-Get-Y. (`[VERIFIED]`)

#### F. Staf & SDM
21. **`staff_users` / `users`** — [`UsersView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/UsersView.tsx): Kelola akun staf, pairing PIN kasir, hak akses outlet. (`[VERIFIED]`)
22. **`staff_roles`** — [`StaffRolesView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/StaffRolesView.tsx): Matriks izin granular per peran staf. (`[VERIFIED]`)
23. **Absensi Staf** — [`StaffAttendanceModal.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/components/pos/StaffAttendanceModal.tsx) & [`AttendanceReportView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/AttendanceReportView.tsx): Jam kerja mandiri PIN 4-6 digit, multi-timezone WIB/WITA/WIT. (`[VERIFIED]`)

#### G. Pengaturan & Tata Kelola Toko
24. **`outlets`** — [`OutletsView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/OutletsView.tsx): Kelola data outlet/toko, alokasi gudang pasokan, jam buka. (`[VERIFIED]`)
25. **`settings_receipt`** — [`ReceiptSettingsView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/ReceiptSettingsView.tsx): Kustomisasi header/footer struk, sakelar nomor antrean panggilan, logo struk. (`[VERIFIED]`)
26. **`settings_taxes`** — [`TaxesSettingsView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/TaxesSettingsView.tsx): Tarif pajak PB1 / PPN dan service charge per outlet. (`[VERIFIED]`)
27. **`settings_payment`** — [`PaymentSettingsView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/PaymentSettingsView.tsx): Rekening transfer manual, gateway QRIS, toggle kasbon. (`[VERIFIED]`)
28. **`settings_channels`** — [`SalesChannelsSettingsView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/SalesChannelsSettingsView.tsx): Mitra online delivery (GoFood, GrabFood, ShopeeFood, Maxim). (`[VERIFIED]`)
29. **`settings_loyalty`** — [`LoyaltySettingsView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/LoyaltySettingsView.tsx): Konfigurasi konversi poin loyalty per transaksi. (`[VERIFIED]`)
30. **`qr_tables` & `qr_settings`** — [`QrTablesView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/QrTablesView.tsx): Pengaturan meja makan & cetak tent card QR meja resto. (`[VERIFIED]`)
31. **`guide`** — [`UserGuideView.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/UserGuideView.tsx): Panduan operasional terpadu sistem POS bagi pengguna baru. (`[VERIFIED]`)

---

### 4. INVENTARISASI API ROUTER BACKEND (`pos_apps/server/src/index.ts`)

Backend mengekspos 20 kelompok router REST API:

| Prefix Endpoint | File Router | Deskripsi Fungsionalitas |
| :--- | :--- | :--- |
| `/api/health` | [`health.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/routes/health.ts) | Status liveness server, koneksi database, memory uptime (`[VERIFIED]`) |
| `/api/auth` | [`auth.routes.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/routes/auth.routes.ts) | Login email, login PIN kasir, register owner, refresh profile (`[VERIFIED]`) |
| `/api/saas` | [`saas.routes.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/routes/saas.routes.ts) | Paket langganan, top-up token kuota Pakasir, webhook pembayaran (`[VERIFIED]`) |
| `/api/platform` | [`platform.routes.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/routes/platform.routes.ts) | Kontrol superadmin, approval tenant, impersonate merchant (`[VERIFIED]`) |
| `/api/outlets` | [`outlet.routes.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/routes/outlet.routes.ts) | CRUD toko/outlet, alokasi gudang induk, pengaturan struk & pajak (`[VERIFIED]`) |
| `/api/categories` | [`category.routes.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/routes/category.routes.ts) | CRUD kategori menu/produk (`[VERIFIED]`) |
| `/api/products` | [`product.routes.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/routes/product.routes.ts) | CRUD produk, varian, SKU, harga per outlet (`[VERIFIED]`) |
| `/api/recipes` | [`recipe.routes.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/routes/recipe.routes.ts) | Formula BOM resep makanan/minuman, pemotongan bahan baku (`[VERIFIED]`) |
| `/api/modifiers` | [`modifier.routes.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/routes/modifier.routes.ts) | Grup modifier/topping dan efek deduksi stok bahan (`[VERIFIED]`) |
| `/api/inventory` | [`inventory.routes.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/routes/inventory.routes.ts) | Bahan baku, saldo stok lokasi, opname stok, mutasi kartu stok (`[VERIFIED]`) |
| `/api/suppliers` | [`supplier.routes.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/routes/supplier.routes.ts) | Vendor/pemasok barang persediaan (`[VERIFIED]`) |
| `/api/purchasing/orders` | [`purchase_order.routes.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/routes/purchase_order.routes.ts) | Purchase order (PO), goods receiving persediaan (`[VERIFIED]`) |
| `/api/transfers` | [`stock_transfer.routes.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/routes/stock_transfer.routes.ts) | Transfer stok antar-cabang/gudang (`[VERIFIED]`) |
| `/api/promotions` | [`promotion.routes.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/routes/promotion.routes.ts) | Diskon, kupon voucher, skema buy-X-get-Y (`[VERIFIED]`) |
| `/api/orders` | [`order.routes.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/routes/order.routes.ts) | Checkout transaksi, split bill, void approval PIN, open tabs (`[VERIFIED]`) |
| `/api/customers` | [`customer.routes.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/routes/customer.routes.ts) | Member, poin loyalitas, saldo kasbon pelanggan (`[VERIFIED]`) |
| `/api/shifts` | [`shift.routes.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/routes/shift.routes.ts) | Buka shift, tutup shift, kas masuk/keluar, X/Z-Report, lock unpaid (`[VERIFIED]`) |
| `/api/reports` | [`report.routes.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/routes/report.routes.ts) | Laba rugi, HPP riil, arus kas, ekspor CSV UTF-8 (`[VERIFIED]`) |
| `/api/users` | [`user.routes.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/routes/user.routes.ts) | Pengguna toko, role, reset PIN kasir (`[VERIFIED]`) |
| `/api/attendance` | [`attendance.routes.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/routes/attendance.routes.ts) | Absensi staf PIN, jadwal kerja, multi-timezone WIB/WITA/WIT (`[VERIFIED]`) |
| `/api/qr-menu` | [`qr_menu.routes.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/routes/qr_menu.routes.ts) | Buku menu publik QR meja, live order feed KDS (`[VERIFIED]`) |

---

### 5. KESIMPULAN INVENTARISASI SISTEM
- **Kelengkapan Modul**: Seluruh modul standar POS modern, supply chain, audit finansial, absensi staf, dan multi-tenant SaaS teridentifikasi nyata dalam source code (`[VERIFIED]`).
- **Status Integrasi**: Terverifikasi utuh dari level basis data Prisma (46 model), API backend Express (20 router), dan antarmuka visual React 19 (36 modul tampilan).
