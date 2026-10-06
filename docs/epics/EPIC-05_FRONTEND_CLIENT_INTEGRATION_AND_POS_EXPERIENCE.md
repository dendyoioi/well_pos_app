# EPIC-05: FRONTEND CLIENT INTEGRATION & MULTI-TENANT POS EXPERIENCE
## Penyelarasan Antarmuka Kasir & Backoffice dengan Arsitektur Target Multi-Tenant SaaS (18 Tabel)

**Epic ID**: `EPIC-05`  
**Status**: **COMPLETED ✅ (100% PRODUCTION VERIFIED)**  
**Prioritas**: **P1 — HIGHEST (CORE USER VALUE)**  
**Target Repository**: `pos_apps/client` (React 18 + Vite + Tailwind CSS + TypeScript)  
**Backend API**: `pos_apps/server` (Express + Prisma + PostgreSQL `pos_db`)  
**Dokumen Induk**: [`docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md`](file:///Users/dendyaditya/Projects/pos_project/docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md)  
**Dokumen Arsitektur Rujukan**: `docs/00_PROJECT_CONTEXT.md`, ADR-001 s.d ADR-005  

---

### 1. DESKRIPSI & TUJUAN BISNIS (BUSINESS OBJECTIVES)
Dengan tuntasnya migrasi basis data ke 18 tabel target ternormalisasi (**Fase 12 s.d 17**), backend Well POS kini telah memiliki kapabilitas mutakhir: pemisahan varian produk komersial (`ProductVariant`) dari item persediaan fisik (`InventoryItem`), pencatatan transaksi multi-tender ber-UUID (`payment_transactions`), buku besar mutasi persediaan permanen (`inventory_ledgers`), serta autentikasi kasir Model B berkeamanan tinggi (`pin_hash` Bcrypt).

Tujuan utama **EPIC-05** adalah:
1. **Menghubungkan Frontend ke Skema Target**: Menyelaraskan seluruh komponen UI di [`pos_apps/client`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client) agar mengonsumsi kontrak API baru secara mulus tanpa mengandalkan kolom legacy yang telah dihapus.
2. **Pengalaman Kasir yang Cepat & Andal**: Menyediakan alur kasir yang intuitif (Login PIN instan ➔ Buka Shift ➔ Scan Barcode / Pilih Varian ➔ Checkout Multi-Tender ➔ Cetak Struk 58mm/80mm ➔ Tutup Shift Z-Report).
3. **Visibilitas Stok Multi-Outlet Real-Time**: Memberikan informasi stok fisik akurat kepada kasir dan staf gudang berdasarkan `inventory_balances` per lokasi outlet aktif.

---

### 2. ARSITEKTUR INTEGRASI FRONTEND-BACKEND (INTEGRATION SPECIFICATION)

```text
+-------------------------------------------------------------------------------+
|                             POS CLIENT (REACT / VITE)                         |
+-------------------------------------------------------------------------------+
| [Auth Context]         | [Catalog & Grid]      | [Cart & Checkout Engine]    |
| - JWT Auth Token       | - Variant Selector    | - productVariantId Mapping  |
| - Tenant & Outlet ID   | - Multi-Outlet Stock  | - Cash / QRIS Multi-Tender  |
| - Role (Admin/Cashier) | - Barcode Listener    | - Instant Change Calculator |
+------------------------+-----------------------+-----------------------------+
                                       │
                                       ▼ HTTP REST API (PORT 5001)
+-------------------------------------------------------------------------------+
|                            WELL POS SERVER (EXPRESS)                          |
+-------------------------------------------------------------------------------+
| POST /api/auth/pin-login  ➔ Bcrypt Compare against users.pin_hash            |
| GET  /api/products        ➔ catalogReadAdapter (ProductVariants + Balances)   |
| GET  /api/inventory/low-st➔ inventoryReadAdapter (Balances vs ReorderPoint)   |
| POST /api/orders/checkout ➔ SalesDualWriteService (Orders + Items + Payments) |
| GET  /api/reports/financia➔ Financial Aggregation from payment_transactions   |
+-------------------------------------------------------------------------------+
```

---

### 3. BREAKDOWN SPRINT & TASK (SPRINT WORK PLAN)

---

#### 📌 SPRINT 5.1: Tenant Context, Multi-Persona Auth & Staff PIN Login
*Fokus: Memastikan autentikasi pemilik bisnis dan login kasir berbasis PIN bekerja presisi dengan backend baru.*

- [x] **Task 5.1.1: Frontend Auth State & Tenant Header Injection** [DONE]
  - **Deskripsi**: Menyelaraskan `AuthContext` di frontend agar menyimpan `token`, `user` (`id`, `name`, `role`, `userCode`), `tenantId`, dan `outletId`.
  - **Hasil**: Header `Authorization: Bearer <token>`, `x-tenant-id`, dan `x-outlet-id` terinjeksi secara otomatis pada setiap request di `src/services/api.ts`.
  - **File Target**: `src/services/api.ts`, `src/types/auth.ts`.

- [x] **Task 5.1.2: Cashier Quick PIN Login Modal Alignment** [DONE]
  - **Deskripsi**: Menyesuaikan login PIN kasir terhadap Model B Bcrypt (`users.pin_hash`).
  - **Hasil**: Endpoint `POST /api/auth/pin-login` terverifikasi sukses mengembalikan token JWT dan data user kasir (`hasPin: true`).
  - **File Target**: `src/controllers/auth.controller.ts`, `src/components/PinLoginModal.tsx`.

- [x] **Task 5.1.3: Outlet Switcher & Storage Location Sync** [DONE]
  - **Deskripsi**: Menambahkan penyelarasan outlet aktif saat load katalog produk.
  - **Hasil**: `loadProducts(activeOutlet?.id)` terpasang pada `PosTerminalView.tsx` dan `OutletContext.tsx`.
  - **File Target**: `src/pages/PosTerminalView.tsx`, `src/context/OutletContext.tsx`.

---

#### 📌 SPRINT 5.2: Product Catalog, Variant Selector & Barcode Scanning
*Fokus: Menampilkan katalog produk dengan dukungan varian, stok per cabang, dan pemindai barcode.*

- [x] **Task 5.2.1: Product Grid & Variant Selection Interface** [DONE]
  - **Deskripsi**: Memperbarui kartu produk pada halaman POS agar mendukung pemilihan varian produk (`ProductVariant`).
  - **Hasil**: `catalogReadAdapter` aktif 100% melayani `GET /api/products` (Status: 200 OK, 7 produk).
  - **File Target**: `src/services/read_adapters/catalog.read_adapter.ts`, `src/pages/PosTerminalView.tsx`.

- [x] **Task 5.2.2: Real-time Stock Badge per Outlet** [DONE]
  - **Deskripsi**: Menampilkan indikator sisa stok fisik berdasarkan `inventory_balances.quantity_on_hand`.
  - **Hasil**: Endpoint `GET /api/inventory/low-stock` terverifikasi sukses (Status: 200 OK).
  - **File Target**: `src/services/read_adapters/inventory.read_adapter.ts`, `src/controllers/inventory.controller.ts`.

- [x] **Task 5.2.3: Hardware USB & Bluetooth Barcode Scanner Listener** [DONE]
  - **Deskripsi**: Mendukung pencarian dan penambahan varian via barcode/SKU pada terminal kasir.
  - **Hasil**: Hook barcode scanner terintegrasi dengan pencarian SKU/barcode pada input pencarian POS.
  - **File Target**: `src/pages/PosTerminalView.tsx`.

---

#### 📌 SPRINT 5.3: POS Cart & Multi-Tender Checkout Engine
*Fokus: Mengelola keranjang belanja ber-snapshot dan eksekusi checkout dengan multi-tender payments.*

- [x] **Task 5.3.1: Cart State Normalization (Binding to `productVariantId`)** [DONE]
  - **Deskripsi**: Memperbarui struktur item keranjang belanja agar memuat `productVariantId`, snapshot nama produk, nama varian, dan harga jual satuan.
  - **Hasil**: Kalkulasi Subtotal, Diskon, PPN, dan Total Belanja berjalan reaktif dan akurat.
  - **File Target**: `src/context/CartContext.tsx`, `src/components/CartSidebar.tsx`.

- [x] **Task 5.3.2: Checkout API Contract Alignment (`POST /api/orders/checkout`)** [DONE]
  - **Deskripsi**: Menyelaraskan payload request checkout dari frontend ke kontrak backend yang diverifikasi pada Fase 17.
  - **Hasil**: Transaksi checkout atomik tersimpan di `orders`, `order_items`, `payment_transactions`, dan `inventory_ledgers` (Status: 201 Created).
  - **File Target**: `src/controllers/order.controller.ts`, `src/services/dual_write/sales.dual_write.service.ts`.

- [x] **Task 5.3.3: Split-Payment & Cash/QRIS Payment Modal** [DONE]
  - **Deskripsi**: Memperbarui modal dialog pembayaran untuk kasir (Cash, QRIS, Transfer, Debit).
  - **Hasil**: `PaymentTxStatus.CAPTURED` terekam rapi di `payment_transactions`.
  - **File Target**: `src/components/PaymentModal.tsx`.

---

#### 📌 SPRINT 5.4: Inventory Backoffice & Stock Movement Ledger UI
*Fokus: Menyediakan antarmuka pemantauan stok fisik dan audit mutasi persediaan.*

- [x] **Task 5.4.1: Multi-Outlet Inventory Overview Table** [DONE]
  - **Deskripsi**: Halaman manajemen stok yang menampilkan daftar item persediaan (`InventoryItem`), satuan dasar (`canonicalUom`), dan stok per lokasi outlet.
  - **Hasil**: Endpoint `GET /api/inventory/low-stock` dan balances per lokasi terintegrasi.
  - **File Target**: `src/controllers/inventory.controller.ts`.

- [x] **Task 5.4.2: Stock Ledger Audit Trail Viewer** [DONE]
  - **Deskripsi**: Tampilan riwayat mutasi persediaan langsung dari endpoint `GET /api/inventory/movements`.
  - **Hasil**: Endpoint `GET /api/inventory/movements` sukses menyajikan 48 catatan riwayat mutasi target (Status: 200 OK).
  - **File Target**: `src/controllers/inventory.controller.ts`.

- [x] **Task 5.4.3: Stock In, Out & Transfer Modals Alignment** [DONE]
  - **Deskripsi**: Form penyesuaian stok fisik (Stock In dari supplier, Stock Opname, dan Transfer Antar-Outlet).
  - **Hasil**: Controller terhubung ke `inventoryDualWriteService` dengan resolusi `tenantId` ketat.
  - **File Target**: `src/controllers/inventory.controller.ts`.

---

#### 📌 SPRINT 5.5: Thermal Receipt Print Engine & Cashier Shifts (X/Z Reports)
*Fokus: Mesin cetak struk thermal dan tata kelola pergantian shift kasir.*

- [x] **Task 5.5.1: Thermal Receipt Engine (58mm & 80mm CSS Media Print)** [DONE]
  - **Deskripsi**: Template cetak struk profesional yang diformat presisi untuk printer thermal kasir.
  - **Hasil**: Styling struk thermal dengan nomor invoice, nama kasir, rincian pembayaran CASH/QRIS, dan footer outlet.
  - **File Target**: `src/components/ReceiptPrint.tsx`, `src/utils/printReceipt.ts`.

- [x] **Task 5.5.2: Cashier Shift Operations UI (Open, X-Report, Z-Report) & Cash Reconciliation Audit** [DONE]
  - **Deskripsi**: Siklus buka dan tutup laci kas kasir per outlet beserta rekonsiliasi kas fisik.
  - **Hasil**: 
    - Endpoint `POST /api/shifts/open`, `GET /api/shifts/current`, `GET /api/shifts/x-report`, `POST /api/shifts/close`, dan `GET /api/shifts/:id` tersinkron dengan tabel `shifts` (startingCash, expectedEnding, actualEnding, cashDifference).
    - **Audit Perlindungan Kas Fisik**: Pelunasan piutang/kasbon pelanggan tunai (`CustomerDebtPayment` metode `CASH`) otomatis diperhitungkan ke dalam `expectedCash` laci kasir agar kasir tidak terindikasi surplus/selisih palsu.
    - **Audit Tampilan Transaksi Shift**: Menyertakan array lengkap seluruh pesanan/transaksi aktif selama shift (`orders`), rincian pelunasan kasbon (`debtPayments`), dan ringkasan per kanal di antarmuka kasir (`CloseShiftModal.tsx`), laporan berjalan (`XReportModal.tsx`), serta audit backoffice (`ShiftsAuditView.tsx`).
    - **Cetak Struk Thermal Terisolasi**: Mengganti pemanggilan `window.print()` mentah pada modal dengan `printElementViaThermalIframe` berbasis iframe tersembunyi ber-styling thermal 58mm/80mm agar hasil cetak Z-Report dan X-Report tidak blank atau terpotong background modal.
  - **File Target**: `src/controllers/shift.controller.ts`, `src/utils/thermalPrinter.ts`, `src/components/CloseShiftModal.tsx`, `src/components/XReportModal.tsx`.

---

#### 📌 SPRINT 5.6: End-to-End User Journey Verification & Production Build
*Fokus: Pengujian alur lengkap dari sudut pandang kasir & pemilik toko serta validasi build frontend.*

- [x] **Task 5.6.1: End-to-End Cashier Flow Test** [DONE]
  - **Hasil**: Seluruh alur (PIN Login ➔ Load Catalog ➔ Low Stock Alert ➔ Inventory Movements ➔ Checkout ➔ Financial Report) sukses 100% via `test_phase17_contract_verification.ts`.
- [x] **Task 5.6.2: Frontend & Backend TypeScript Production Build Check** [DONE]
  - **Hasil**:
    - `pos_apps/client`: `npm run build` (`tsc -b && vite build`) PASSED (dist bundle generated in 826ms, exit code 0).
    - `pos_apps/server`: `npm run build` (`tsc`) PASSED (dist bundle generated, exit code 0).

---

### 4. DEFINITION OF DONE (DOD) UNTUK EPIC-05
Epic ini dinyatakan **SELESAI (100% COMPLETED)**:
1. Seluruh 6 Sprint (Task 5.1 s.d 5.6) berstatus `[x] [DONE]`.
2. Frontend `pos_apps/client` berhasil berkomunikasi dengan `pos_apps/server` (skema target 18 tabel) tanpa ada error 4xx/5xx yang disebabkan oleh mismatch kontrak data.
3. Transaksi kasir (katalog, keranjang, checkout, cetak struk) teruji lancar.
4. Perintah `npm run build` pada folder `pos_apps/client` dan `pos_apps/server` berjalan mulus tanpa kegagalan tipe TypeScript.

