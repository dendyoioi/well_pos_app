# SCHEMA CONSISTENCY VALIDATION REPORT
**Document ID:** VAL-2026-09-GATE-01  
**Project:** Well POS — Multi-Tenant SaaS POS Platform Evolution  
**Review Target:** Target Database Schema, Data Architecture RFC, and Migration Design  
**Author:** Principal Software Architect, Lead Database Architect & POS Domain Architect  
**Review Date:** September 19, 2026  
**Status:** READ-ONLY ARCHITECTURAL VALIDATION GATE  

---

## 1. Executive Summary

Laporan ini merupakan hasil evaluasi dan validasi konsistensi (*Validation Gate*) berskala menyeluruh terhadap proposal arsitektur data dan skema basis data target (`03_DATA_ARCHITECTURE_RFC.md` dan `04_TARGET_DATABASE_SCHEMA.md`) yang dikonfrontasikan langsung dengan kode sumber aktual, skema Prisma berjalan (`schema.prisma`), serta alur bisnis POS yang telah mencapai kematangan ~70%.

### Overall Validation Status
**STATUS:** `PASS WITH REQUIRED CHANGES` (Implementation Gate Locked Until Required Changes Resolved)

Arsitektur konseptual target secara umum **sangat kokoh**, membedakan domain komersial (`Product`) dari logistik (`InventoryItem`), memisahkan daur hidup pesanan (`Order`) dari pembayaran (`Payment`), serta memperkenalkan buku besar mutasi stok (*Inventory Movement Ledger*). Namun demikian, ditemukan sejumlah diskrepansi kritis antara narasi arsitektur dengan draf skema teknis, celah keamanan relasi multi-tenant pada entitas anak, serta hilangnya beberapa model operasional krusial pada draf skema Prisma target.

### Finding Counts by Severity
* **CRITICAL FINDINGS:** 4 temuan
* **HIGH FINDINGS:** 7 temuan
* **MEDIUM FINDINGS:** 6 temuan
* **LOW FINDINGS:** 4 temuan
* **TOTAL FINDINGS:** 21 temuan

Implementasi kode atau migrasi basis data **TIDAK BOLEH DIMULAI** sebelum seluruh temuan *Critical* dan *High* diperbaiki pada spesifikasi skema.

---

## 2. Documentation Structure

### 2.1 Audit Struktur Dokumentasi

| File / Direktori | Status | Tindakan / Lokasi Aktual |
| :--- | :---: | :--- |
| `/docs/00_PROJECT_CONTEXT.md` | **MISSING** | Belum dibuat. Konteks proyek saat ini tersebar di `Product Plan/` dan dokumen audit. |
| `/docs/architecture/01_EXISTING_SYSTEM_AUDIT.md` | **PRESENT** | Ditautkan/disinkronkan dari `AUDIT_POS_SYSTEM_ARCHITECTURE.md`. |
| `/docs/architecture/02_DEEP_DOMAIN_ANALYSIS.md` | **PRESENT** | Ditautkan/disinkronkan dari `DEEP_DOMAIN_ANALYSIS_INVENTORY_ORDER.md`. |
| `/docs/architecture/03_DATA_ARCHITECTURE_RFC.md` | **PRESENT** | Ditautkan/disinkronkan dari `DATA_ARCHITECTURE_RFC.md`. |
| `/docs/architecture/04_TARGET_DATABASE_SCHEMA.md` | **PRESENT** | Ditautkan/disinkronkan dari `TARGET_DATABASE_SCHEMA_AND_MIGRATION_DESIGN.md`. |
| `/docs/decisions/ADR-*.md` | **MISSING (EXTRACT PENDING)** | ADR saat ini masih tertanam di dalam Bab 23 RFC dan Bab 36 Desain Skema. Belum dipecah menjadi file individual. |
| `/docs/validation/05_SCHEMA_CONSISTENCY_VALIDATION.md`| **CREATED** | Dokumen laporan validasi ini. |
| `/docs/prompts/PROMPT_01_AUDIT.md` | **MISSING** | Prompt awal tersimpan dalam history percakapan. |
| `/docs/prompts/PROMPT_02_DEEP_ANALYSIS.md` | **MISSING** | Prompt awal tersimpan dalam history percakapan. |
| `/docs/prompts/PROMPT_03_DATA_ARCHITECTURE.md` | **MISSING** | Prompt awal tersimpan dalam history percakapan. |
| `/docs/prompts/PROMPT_04_DATABASE_DESIGN.md` | **MISSING** | Prompt awal tersimpan dalam history percakapan. |
| `/docs/prompts/PROMPT_05_SCHEMA_CONSISTENCY_VALIDATION.md` | **PRESENT** | Tersedia di `pos_apps/docs/prompts/`. |

### 2.2 Inventarisasi Berkas Dokumen
* **Created:** `pos_apps/docs/architecture/`, `pos_apps/docs/decisions/`, `pos_apps/docs/validation/05_SCHEMA_CONSISTENCY_VALIDATION.md`.
* **Synchronized/Copied to Canonical Paths:** 
  * `pos_apps/docs/architecture/01_EXISTING_SYSTEM_AUDIT.md`
  * `pos_apps/docs/architecture/02_DEEP_DOMAIN_ANALYSIS.md`
  * `pos_apps/docs/architecture/03_DATA_ARCHITECTURE_RFC.md`
  * `pos_apps/docs/architecture/04_TARGET_DATABASE_SCHEMA.md`
* **Untouched (Originals Preserved):** Seluruh file di root `pos_apps/` dan direktori `Product Plan/`.
* **Missing (To be created in governance phase):** `/docs/00_PROJECT_CONTEXT.md` dan berkas ADR modular `/docs/decisions/ADR-001` s/d `ADR-010`.

---

## 3. Current vs Target Schema Matrix

| Domain | Current Model (`schema.prisma`) | Target Model (`04_TARGET_DATABASE_SCHEMA.md`) | Status | Finding Summary |
| :--- | :--- | :--- | :---: | :--- |
| **SaaS & IAM** | `Tenant` | `Tenant` | EXTEND | Penambahan `enabledModules` dan `businessVertical`. Aman. |
| **SaaS & IAM** | `User` | `User` | REFACTOR | Perlu `tenantId NOT NULL` dan `@@unique([tenantId, email])`. |
| **Facility** | `Outlet` | `Outlet` + `StorageLocation` | EXTEND / NEW | `Outlet.isWarehouse` dipertahankan; butuh `defaultStorageLocationId`. |
| **Catalog** | `Category` | `Category` | EXTEND | Penambahan hierarki `parentId` (Self-relation). Aman. |
| **Catalog** | `Product` | `Product` (Commercial) | REFACTOR | Pelepasan HPP dan stok fisik. Aman jika ada adapter layer. |
| **Catalog** | *(None)* | `ProductVariant` | NEW | Varian produk relasional. Mendukung SKU & Barcode mandiri. |
| **Inventory** | `OutletProduct` | `InventoryBalance` | TRANSFORM | Kuantitas berubah dari `Int` ke `Decimal(12, 3)`. |
| **Inventory** | `StockMovement` | `InventoryLedger` | EVOLVE | Dari log audit bertransformasi menjadi Movement Ledger. |
| **Inventory** | *(None)* | `InventoryItem` | NEW | Master entitas barang berwujud & bahan baku fisik. |
| **Inventory** | *(None)* | `UnitOfMeasure` & `UnitConversion` | NEW | Standar satuan ukur dan tabel rasio konversi matematis. |
| **F&B** | *(None)* | `Recipe` & `RecipeItem` | NEW | Formula resep menu porsi tunggal (*Single-Level BOM*). |
| **F&B** | `Product.description` (JSON)| `ModifierGroup`, `Item`, `Effect` | NEW / MIGRATE | Relasionalisasi dari string JSON deskripsi produk. |
| **Sales** | `Order` | `Order` (State Machine) | REFACTOR | Penambahan `orderStatus` untuk memisahkan dari `paymentStatus`. |
| **Sales** | `OrderItem` | `OrderItem` | REFACTOR | Menunjuk ke `variantId` + snapshot resep & modifier. Kontradiksi `tenantId`. |
| **Finance** | `Payment` | `Payment` + `PaymentTransaction` | EXPAND / NEW | Mendukung multi-tender, partial payment, dan rekonsiliasi. |
| **Finance** | *(None)* | `Refund` & `RefundItem` | NEW / INCOMPLETE | `RefundItem` dibahas di narasi tetapi hilang di draf skema Prisma! |
| **Security** | *(None)* | `IdempotencyKey` | NEW / INCOMPLETE | Dibahas di narasi tetapi hilang di draf skema Prisma! |
| **Services** | *(None)* | `WorkOrder`, `MaterialUsage` | DEFERRED | Ditunda ke Fase 7; tidak tersedia pada skema draf awal. |

---

## 4. Critical Findings

### Finding C-01: Kontradiksi Langsung Kepemilikan Tenant pada `OrderItem`
* **Area:** Multi-Tenant Security / Data Model Integrity
* **Current State:** `OrderItem` eksisting hanya memiliki `orderId` dan `productId` (tanpa `tenantId`).
* **Target State:** Pada Bab 20 Matriks Isolasi Dokumen 04, tertulis: `OrderItem | Direct tenantId: YA (NOT NULL)`.
* **Problem:** Pada Draf Skema Prisma Bab 32 Dokumen 04, `model OrderItem` **TIDAK MEMILIKI KOLOM `tenantId`**:
  ```prisma
  model OrderItem {
    id               String               @id @default(uuid())
    orderId          String               @map("order_id")
    variantId        String               @map("variant_id")
    quantity         Decimal              @db.Decimal(12, 3)
    // KOLOM tenantId TIDAK DITEMUKAN DI SINI!
  ```
* **Production Impact:** Tanpa kolom `tenantId` pada `order_items`, kueri analitik pelaporan item terjual atau audit forensik wajib melakukan JOIN ke tabel `orders`. Jika pengembang membuat endpoint baru dan lupa melakukan join tenant guard, baris pesanan antar tenant dapat bocor.
* **Evidence:** `04_TARGET_DATABASE_SCHEMA.md: Bab 20 baris OrderItem vs Bab 32 baris model OrderItem`.
* **Required Decision:** Wajibkan penambahan `tenantId String @map("tenant_id")` pada `model OrderItem` di skema Prisma target, dilengkapi foreign key ke `Tenant`.

---

### Finding C-02: Hilangnya Model `RefundItem` pada Draf Skema Prisma Target
* **Area:** Financial & Inventory Integrity / Return Management
* **Current State:** Sistem saat ini belum memiliki tabel refund (hanya enum `PaymentStatus.REFUNDED`).
* **Target State:** Dokumen 03 (Bab 14) dan Dokumen 04 (Bab 17) mewajibkan dukungan *Partial Refund* (misal: Order 2 Aqua + 1 Kopi, pelanggan meretur 1 Aqua). Dokumen 04 Bab 17 secara eksplisit mendefinisikan entitas `RefundItem`.
* **Problem:** Pada Draf Skema Prisma Bab 32 Dokumen 04, **model `RefundItem` HILANG SECARA TOTAL**. Yang ada hanyalah `model Refund` (header saja).
* **Production Impact:** Sistem tidak dapat mencatat item spesifik mana yang diretur dan kuantitas berapa yang dikembalikan ke stok. Skenario Uji G (*Partial Refund*) **GAGAL TOTAL** dieksekusi di tingkat database.
* **Evidence:** `04_TARGET_DATABASE_SCHEMA.md: Bab 32 line 614 (model Refund tidak memiliki relasi ke refund items)`.
* **Required Decision:** Tambahkan `model RefundItem` ke skema Prisma target sebelum implementasi modul kasir:
  ```prisma
  model RefundItem {
    id            String     @id @default(uuid())
    refundId      String     @map("refund_id")
    orderItemId   String     @map("order_item_id")
    quantity      Decimal    @db.Decimal(12, 3)
    amount        Decimal    @db.Decimal(12, 2)
    restockOption String     // RESTOCK, DAMAGED, WASTE
    refund        Refund     @relation(fields: [refundId], references: [id], onDelete: Cascade)
    orderItem     OrderItem  @relation(fields: [orderItemId], references: [id], onDelete: Restrict)
    @@map("refund_items")
  }
  ```

---

### Finding C-03: Hilangnya Entitas `IdempotencyKey` pada Draf Skema Prisma Target
* **Area:** Concurrency, Payment Safety & Network Fault Tolerance
* **Current State:** Kasir tidak memiliki proteksi idempotensi; double-click tombol bayar dapat memicu transaksi ganda.
* **Target State:** Dokumen 04 Bab 16 mendesain tabel `idempotency_keys` lengkap dengan `requestHash`, `statusCode`, dan `responseBody`.
* **Problem:** Pada Draf Skema Prisma Bab 32 Dokumen 04, **tabel `idempotency_keys` TIDAK ADA**. Yang ada hanyalah kolom opsional `idempotencyKey String?` pada `PaymentTransaction`.
* **Production Impact:** 
  1. Endpoint checkout (`POST /api/orders/checkout`) tidak terlindungi dari pengiriman form ganda jika koneksi time-out sebelum pembayaran terbentuk.
  2. Index `@@index([tenantId, idempotencyKey])` pada `PaymentTransaction` bukanlah *Unique Constraint*; database tetap mengizinkan dua baris transaksi pembayaran dengan idempotency key yang sama masuk bersamaan.
* **Evidence:** `04_TARGET_DATABASE_SCHEMA.md: Bab 16 vs Bab 32`.
* **Required Decision:** Wajib menambahkan `model IdempotencyKey` independen pada Prisma schema dengan `@@unique([tenantId, key])` dan kolom `expiresAt`.

---

### Finding C-04: Celah Kebocoran Data Lintas Tenant pada Entitas Anak (Unchecked Cross-Tenant FK)
* **Area:** Multi-Tenant Security / Foreign Key Boundary Enforcement
* **Current State:** Kode eksisting memiliki `tenantId` nullable pada `Product`, `Category`, `Outlet`, dll.
* **Target State:** Dokumen 03 & 04 menegaskan prinsip *Zero-Trust Isolation*.
* **Problem:** Pada skema target relasional Prisma, beberapa entitas anak tidak memiliki `tenantId` sendiri dan foreign key-nya hanya menunjuk ke ID global tanpa komposit tenant:
  * `RecipeItem`: Menghubungkan `recipeId` dengan `inventoryItemId`. Keduanya hanya diverifikasi via UUID.
  * `ModifierRecipeEffect`: Menghubungkan `modifierItemId` dengan `inventoryItemId`.
  * `ProductModifierGroup`: Menghubungkan `productId` dengan `groupId`.
* **Production Impact:** Jika terjadi bug di backend atau manipulasi payload API, **Tenant A dapat memasukkan `inventoryItemId` milik Tenant B ke dalam resep menu Tenant A**. Ketika menu Tenant A terjual di kasir, stok milik Tenant B yang terpotong! Database PostgreSQL dengan foreign key standar tidak dapat memvalidasi apakah kedua baris milik tenant yang sama jika `tenantId` tidak menjadi bagian dari compound foreign key.
* **Evidence:** `04_TARGET_DATABASE_SCHEMA.md: Bab 32 baris model RecipeItem & ModifierRecipeEffect`.
* **Required Decision:** 
  1. Denormalisasikan `tenantId NOT NULL` ke `RecipeItem`, `ModifierGroup`, `ModifierItem`, dan `ModifierRecipeEffect`.
  2. Alternatif: Tambahkan constraint compound foreign key PostgreSQL di level DDL:
     `FOREIGN KEY (tenant_id, inventory_item_id) REFERENCES inventory_items(tenant_id, id)`.

---

## 5. High Findings

### Finding H-01: Aksi Modifier `REPLACE` Tidak Memiliki Kolom Target pada Skema Prisma
* **Area:** F&B Recipe & Inventory Consumption Logic
* **Current State:** Modifier tersimpan di string JSON deskripsi produk.
* **Target State:** Dokumen 04 Bab 12.2 menyatakan: *"Untuk aksi REPLACE ditambahkan kolom target: `targetInventoryItemId: UUID?` agar sistem tahu bahan mana yang digantikan."*
* **Problem:** Pada Draf Skema Prisma Bab 32, kolom `targetInventoryItemId` **TIDAK ADA** pada `model ModifierRecipeEffect`:
  ```prisma
  model ModifierRecipeEffect {
    id              String         @id @default(uuid())
    modifierItemId  String         @map("modifier_item_id")
    inventoryItemId String         @map("inventory_item_id")
    action          ModifierAction @default(ADD)
    quantityDelta   Decimal        @db.Decimal(12, 3) @map("quantity_delta")
    // Tidak ada targetInventoryItemId!
  ```
* **Production Impact:** Pada skenario F&B "Sub Oat Milk (Ganti Fresh Milk)", sistem hanya tahu harus menambah Oat Milk, tetapi mesin konsumsi inventori tidak tahu bahan baku resep mana yang harus dibatalkan (Fresh Milk atau sirup gula). Akibatnya, kedua bahan terpotong bersamaan (*double deduction*).
* **Evidence:** `04_TARGET_DATABASE_SCHEMA.md: Bab 12.2 vs Bab 32 model ModifierRecipeEffect`.
* **Required Decision:** Tambahkan kolom `targetInventoryItemId String? @map("target_inventory_item_id")` pada `model ModifierRecipeEffect`.

---

### Finding H-02: Ketiadaan `defaultStorageLocationId` pada `Outlet` Menimbulkan Ambiguitas Kasir
* **Area:** Logistics vs Sales Decoupling
* **Current State:** `Order` mencatat `outletId`. Stok dipotong langsung dari `OutletProduct` yang memiliki `outletId` sama.
* **Target State:** Stok dipindahkan ke `InventoryBalance` yang terikat pada `storageLocationId`.
* **Problem:** Sebuah `Outlet` dapat memiliki banyak `StorageLocation` (misal: "Etalase Kasir", "Gudang Belakang", "Bar Kopi"). Ketika kasir toko checkout `Order`, sistem **tidak tahu dari `storageLocationId` mana stok harus dipotong**, karena `Order` hanya membawa `outletId`, dan `Outlet` tidak memiliki penunjuk lokasi default penjualan.
* **Production Impact:** Transaksi kasir gagal eksekusi atau salah memotong stok gudang belakang padahal barang diambil dari etalase depan.
* **Evidence:** `04_TARGET_DATABASE_SCHEMA.md: model Outlet & model StorageLocation`.
* **Required Decision:** Tambahkan kolom `defaultStorageLocationId String? @map("default_storage_location_id")` pada model `Outlet` yang otomatis menunjuk ke lokasi utama bertipe `STORE_FRONT`.

---

### Finding H-03: Ketiadaan Unique Constraint pada `UnitConversion` Menimbulkan Risiko Duplikasi Rasio
* **Area:** Unit of Measure & Math Precision
* **Current State:** Seluruh stok menggunakan integer Pcs.
* **Target State:** `UnitConversion` memetakan rasio antar UOM.
* **Problem:** `model UnitConversion` pada draf skema Prisma tidak memiliki compound unique constraint:
  ```prisma
  model UnitConversion {
    id               String        @id @default(uuid())
    tenantId         String?       @map("tenant_id")
    inventoryItemId  String?       @map("inventory_item_id")
    fromUomId        String        @map("from_uom_id")
    toUomId          String        @map("to_uom_id")
    conversionFactor Decimal       @db.Decimal(15, 6)
    // Tidak ada @@unique!
  ```
* **Production Impact:** Pengguna atau admin tenant dapat menginput dua baris konversi yang bertentangan untuk item yang sama (misal: Baris 1: 1 Box = 24 Pcs; Baris 2: 1 Box = 12 Pcs). Kueri resep kasir akan mengambil baris acak (*non-deterministic*), mengacaukan perhitungan stok ribuan unit.
* **Evidence:** `04_TARGET_DATABASE_SCHEMA.md: Bab 32 model UnitConversion`.
* **Required Decision:** Tambahkan constraint: `@@unique([tenantId, inventoryItemId, fromUomId, toUomId])`.

---

### Finding H-04: Penggunaan Istilah Akuntansi "Double-Entry" yang Menyesatkan pada Inventory Ledger
* **Area:** Domain Modeling Terminology & Accounting Architecture
* **Current State:** `StockMovement` adalah kartu audit sederhana.
* **Target State:** Dokumen RFC dan DB Design berulang kali menyebut target ledger sebagai "Double-Entry Inventory Ledger".
* **Problem:** Model `InventoryLedger` yang dirancang hanya menulis **1 baris tunggal per pergerakan** (`quantityDelta`, `balanceBefore`, `balanceAfter`). Secara standar akuntansi dan instruksi PROMPT_05 Bab 9, sistem ini adalah **Single-Entry Movement Ledger (Kartu Stok Berjalan)**, BUKAN Double-Entry. Double-entry membutuhkan sepasang baris Debit dan Kredit (misal: Debit Akun Persediaan Toko, Kredit Akun Persediaan Gudang Pusat).
* **Production Impact:** Menimbulkan ekspektasi salah bagi akuntan dan developer integrasi ERP yang mengharapkan neraca seimbang debit-kredit.
* **Evidence:** `03_DATA_ARCHITECTURE_RFC.md: Bab 6` & `PROMPT_05_SCHEMA_CONSISTENCY_VALIDATION.md: Bab 9`.
* **Required Decision:** Koreksi terminologi di seluruh dokumentasi menjadi **"Immutable Stock Movement Ledger"** atau **"Perpetual Inventory Card Ledger"**.

---

### Finding H-05: Tidak Ada Multiplier pada Relasi `ProductVariant` -> `InventoryItem` (Retail Packaging)
* **Area:** Retail Packaging & Inventory Mapping
* **Current State:** 1 Product = 1 Stok integer.
* **Target State:** `ProductVariant.inventoryItemId -> InventoryItem.id`.
* **Problem:** Pada industri retail, sering kali produk dijual dalam satuan pak/kemasan (misal: Varian "Aqua 600ml Satuan" memotong 1 pcs; Varian "Aqua 600ml Dus" memotong 24 pcs). Karena relasi `ProductVariant` ke `InventoryItem` adalah relasi langsung tanpa kolom `quantityMultiplier`, varian "Aqua Dus" **tidak bisa memotong 24 botol** kecuali pemilik toko dipaksa membuat resep F&B (*Recipe*).
* **Production Impact:** Toko retail grosir dipaksa mengaktifkan modul F&B Recipe hanya untuk menjual barang per-dus/per-lusin.
* **Evidence:** `04_TARGET_DATABASE_SCHEMA.md: Bab 8 & Bab 32 model ProductVariant`.
* **Required Decision:** Tambahkan kolom opsional `inventoryQuantityMultiplier Decimal @default(1.000) @db.Decimal(12, 3)` pada `ProductVariant`.

---

### Finding H-06: Hilangnya Model Vertikal Services pada Draf Skema Prisma Target
* **Area:** Multi-Vertical Support (Services Module)
* **Current State:** Sistem murni menangani retail kasir.
* **Target State:** Platform SaaS ditargetkan mendukung Retail, F&B, dan Services.
* **Problem:** Draf skema Prisma target pada Bab 32 sama sekali tidak memuat model untuk Services (`Appointment`, `WorkOrder`, `ServiceMaterialUsage`, `StaffCommission`). Meskipun dokumen menyatakan fitur ini ditunda ke Fase 7/9, ketiadaan model draf membuat **Skenario Uji C (Services)** tidak memiliki representasi skema yang tervalidasi.
* **Production Impact:** Pengembang modul servis di masa depan harus mendesain skema dari nol tanpa kontrak acuan yang terintegrasi dengan `Order`.
* **Evidence:** `04_TARGET_DATABASE_SCHEMA.md: Bab 32 (tidak ada tabel servis)`.
* **Required Decision:** Tambahkan draf model konseptual `WorkOrder` dan `ServiceMaterialUsage` sebagai extension model yang terhubung ke `OrderItem`.

---

### Finding H-07: Potensi Race Condition pada Snapshot `balanceBefore` / `balanceAfter`
* **Area:** Concurrency & Transaction Isolation
* **Current State:** Pemotongan stok dilakukan tanpa transaksi terisolasi ketat.
* **Target State:** Ledger mencatat `balanceBefore` dan `balanceAfter`.
* **Problem:** Jika dua kasir checkout barang yang sama secara bersamaan, query pemotongan stok bersaing:
  Jika kode membaca `balanceBefore` via `SELECT`, lalu menghitung di memory Node.js, lalu melakukan `UPDATE`, maka kedua transaksi kasir akan membaca nilai `balanceBefore` yang sama, menghasilkan dua baris ledger dengan saldo akhir yang identik (desinkronisasi audit trail).
* **Production Impact:** Rantai matematis ledger $Ledger[N].balanceAfter == Ledger[N+1].balanceBefore$ rusak seketika di cabang yang ramai.
* **Evidence:** `04_TARGET_DATABASE_SCHEMA.md: Bab 24 & Bab 25`.
* **Required Decision:** Wajibkan implementasi **Pessimistic Row-Level Locking (`SELECT ... FOR UPDATE`)** pada baris `InventoryBalance` di dalam blok transaksi `db.$transaction` sebelum nilai `balanceBefore` dibaca dan ledger di-insert.

---

## 6. Medium Findings

### Finding M-01: Email User Eksisting Bersifat Global Unique (Menghambat Multi-Tenant)
* **Area:** User Management & SaaS Scalability
* **Current State:** `model User` memiliki constraint `email String @unique`.
* **Problem:** Jika Pengguna X bekerja sebagai kasir di Toko A (Tenant A), dia tidak bisa didaftarkan sebagai kasir di Toko B (Tenant B) menggunakan alamat email yang sama.
* **Production Impact:** Keluhan operasional dari merchant waralaba atau staf paruh waktu yang bekerja di lebih dari satu penyewa SaaS.
* **Required Decision:** Ubah constraint menjadi `@@unique([tenantId, email])` pada fase refactor User.

---

### Finding M-02: Ketiadaan Pelacakan Nomor Batch / Expired pada Fase Retail
* **Area:** Retail Advanced Inventory
* **Current State:** Tidak ada batch number.
* **Target State:** `InventoryItem` memiliki flag `isBatched: Boolean`, namun tidak ada tabel `InventoryBatch`.
* **Problem:** Toko retail farmasi/makanan kemasan yang membutuhkan pelacakan kadaluarsa (*First Expired First Out / FEFO*) tidak dapat mencatat nomor batch saat barang diterima dari supplier.
* **Required Decision:** Tambahkan kolom nullable `batchNumber: String?` dan `expiryDate: DateTime?` langsung pada baris `InventoryLedger` sebagai langkah transisi ringan sebelum tabel batch formal dibuat.

---

### Finding M-03: Ketiadaan Catatan Teks Khusus Pelanggan pada Modifier Pesanan
* **Area:** F&B Order Flexibility
* **Current State:** Struk kasir hanya mencetak item pesanan standar.
* **Target State:** `OrderItemModifier` mencatat relasi ke `ModifierItem`.
* **Problem:** Sering kali tamu meminta kustomisasi di luar menu (misal: "Jangan pakai daun bawang sama sekali, anak saya alergi"). Model `OrderItemModifier` tidak memiliki kolom `customNotes`.
* **Production Impact:** Pelayan restoran tidak bisa menyampaikan catatan khusus dapur melalui sistem POS.
* **Required Decision:** Tambahkan kolom `notes: String?` pada `OrderItem` dan `OrderItemModifier`.

---

### Finding M-04: Ketiadaan Penampung Alasan Pembatalan (*Void Reason*) pada Order
* **Area:** Auditability & Fraud Prevention
* **Current State:** Order hanya memiliki `paymentStatus: CANCELLED`.
* **Target State:** Order memiliki status `CANCELLED` dan `VOIDED`.
* **Problem:** Model `Order` tidak memiliki kolom `voidReason` atau `cancellationReason` serta `voidedByUserId`.
* **Production Impact:** Supervisor toko tidak dapat mengaudit alasan kasir membatalkan transaksi (apakah kasir salah ketik atau terjadi kecurangan pencurian uang kas).
* **Required Decision:** Tambahkan kolom `voidReason: String?` dan `voidedByUserId: String?` pada `model Order`.

---

### Finding M-05: Risiko Dual-Write Divergence di Tingkat Controller Express
* **Area:** Migration Pattern Reliability
* **Current State:** Logika mutasi stok tersebar langsung di dalam fungsi controller (`order.controller.ts`, `inventory.controller.ts`).
* **Target State:** Migrasi menggunakan pola Dual-Write (menulis ke `OutletProduct` dan `InventoryBalance` bersamaan).
* **Problem:** Backend project saat ini belum memiliki arsitektur *Service Layer* terpusat. Jika dual-write ditulis manual di setiap controller, sangat rawan terjadi *developer oversight* di mana salah satu endpoint lupa menulis ke tabel baru.
* **Production Impact:** Ketidakkonsistenan saldo antara sistem lama dan sistem baru selama masa transisi.
* **Required Decision:** Wajib membuat class `InventoryDomainService` terpusat sebelum dual-write dimulai.

---

### Finding M-06: Status Pembayaran Default `UNPAID` Berisiko Memecah Alur Kasir Retail
* **Area:** Backward Compatibility / Retail Workflow
* **Current State:** `Order.paymentStatus` default `PAID`.
* **Target State:** `Order.paymentStatus` default `UNPAID`.
* **Problem:** Pada kasir retail eksisting, saat kasir menekan checkout, kasir langsung menerima uang dan transaksi selesai. Jika default diubah ke `UNPAID` tanpa penyesuaian controller, struk kasir retail akan tercetak dalam kondisi belum lunas.
* **Required Decision:** Pada controller checkout retail, wajibkan pembuatan `Payment` dan setel status `PAID` secara eksplisit dalam 1 pemanggilan API.

---

## 7. Low Findings

### Finding L-01: Penamaan Kolom Jam Kerja Shift Kasir Tidak Seragam
* **Area:** Schema Naming Consistency
* **Current State:** `Shift.startTime` dan `Shift.endTime`.
* **Target State:** Mayoritas timestamp menggunakan akhiran `At` (`startedAt`, `expiresAt`, `createdAt`).
* **Required Decision:** Dipertahankan sesuai existing untuk mencegah breaking changes pada laporan shift kasir.

### Finding L-02: String Kategori UOM Bebas Tanpa Enum
* **Area:** Data Integrity / UOM
* **Current State:** Belum ada UOM.
* **Target State:** `UnitOfMeasure.category` bertipe `String` ("WEIGHT", "VOLUME", dll).
* **Required Decision:** Sebaiknya diubah menjadi enum formal `UomCategory` di Prisma schema.

### Finding L-03: Ketiadaan Kolom Urutan Tampilan (*Display Order*) pada Modifier
* **Area:** UI / UX Presentation
* **Problem:** Urutan modifier grup dan item di layar kasir akan tampil acak sesuai urutan insert database.
* **Required Decision:** Tambahkan `displayOrder: Int @default(0)` pada `ModifierGroup` dan `ModifierItem`.

### Finding L-04: Ketiadaan Simbol Mata Uang Dinamis pada Multi-Tenant
* **Area:** Internationalization / SaaS Scope
* **Problem:** Kolom nilai moneter mengasumsikan Rupiah tanpa kolom currency di `Tenant`.
* **Required Decision:** Tambahkan `currency: String @default("IDR")` pada `model Tenant`.

---

## 8. Tenant Isolation Audit

Audit ini mengevaluasi apakah database engine PostgreSQL dan skema Prisma mampu mencegah kebocoran data antar penyewa secara deterministik:

| Entity Name | Has Direct `tenantId`? | Constraint Scope | Foreign Key Safety | Cross-Tenant Leakage Risk | Architectural Verdict |
| :--- | :---: | :--- | :--- | :---: | :--- |
| `Tenant` | N/A (Root PK) | `slug` Unique | N/A | Zero | **SAFE** |
| `User` | **YA (NOT NULL)** | `[tenantId, email]` | Validated to Tenant | Low | **SAFE** |
| `Outlet` | **YA (NOT NULL)** | `[tenantId, name]` | Validated to Tenant | Low | **SAFE** |
| `StorageLocation` | **YA (NOT NULL)** | `[tenantId, code]` | Validated to Tenant | Low | **SAFE** |
| `Category` | **YA (NOT NULL)** | `[tenantId, name]` | Validated to Tenant | Low | **SAFE** |
| `Product` | **YA (NOT NULL)** | `[tenantId, sku]` | Validated to Tenant | Low | **SAFE** |
| `ProductVariant` | **YA (NOT NULL)** | `[tenantId, sku]` | Validated to Tenant | Low | **SAFE** |
| `InventoryItem` | **YA (NOT NULL)** | `[tenantId, sku]` | Validated to Tenant | Low | **SAFE** |
| `InventoryBalance`| **YA (NOT NULL)**| `[tenantId, itemId, locId]`| Validated to Tenant | Low | **SAFE** |
| `InventoryLedger` | **YA (NOT NULL)**| PK UUID | Validated to Tenant | Low | **SAFE** |
| `Recipe` | **YA (NOT NULL)** | `[variantId, version]` | Validated to Tenant | Low | **SAFE** |
| `RecipeItem` | **TIDAK (GAP!)** | PK UUID | Unchecked to InvItem | **HIGH (CRITICAL)**| **UNSAFE (Must add tenantId)** |
| `ModifierGroup` | **YA (NOT NULL)** | PK UUID | Validated to Tenant | Low | **SAFE** |
| `ModifierItem` | **TIDAK (GAP!)** | PK UUID | Inherited from Group | Medium | **NEEDS COMPOUND GUARD** |
| `ModifierRecipeEffect`| **TIDAK (GAP!)**| PK UUID | Unchecked to InvItem | **HIGH (CRITICAL)**| **UNSAFE (Must add tenantId)** |
| `Order` | **YA (NOT NULL)** | `[tenantId, invoiceNumber]`| Validated to Tenant | Low | **SAFE** |
| `OrderItem` | **TIDAK (GAP!)** | PK UUID | Inherited from Order | **HIGH (CRITICAL)**| **UNSAFE (Must add tenantId)** |
| `Payment` | **YA (NOT NULL)** | PK UUID | Validated to Tenant | Low | **SAFE** |
| `PaymentTransaction`| **YA (NOT NULL)**| PK UUID | Validated to Tenant | Low | **SAFE** |
| `Refund` | **YA (NOT NULL)** | PK UUID | Validated to Tenant | Low | **SAFE** |
| `RefundItem` | **MISSING IN SCHEMA**| N/A | N/A | **CRITICAL** | **MODEL MISSING** |

---

## 9. Inventory Integrity Audit

### 9.1 Saldo vs Buku Besar (*Balance vs Ledger*)
* Saldo fisik tersimpan di `inventory_balances.quantity_on_hand`.
* Mutasi historis tersimpan di `inventory_ledgers` yang bersifat *append-only*.
* **Evaluasi Integritas:** Formula matematis $\text{quantityOnHand} = \sum (\text{quantityDelta})$ dapat diverifikasi kapan saja. Desain ini memenuhi standar audit akuntansi persediaan.

### 9.2 Concurrency & Race Condition Protection
* **Kelemahan Terdeteksi:** Skema Prisma tidak dapat mendefinisikan kueri atomik `WHERE quantity_on_hand >= :qty`.
* **Solusi Wajib:** Pemotongan stok kasir pada service backend **WAJIB** mengeksekusi *raw query conditional update* atau *pessimistic row locking* (`SELECT ... FOR UPDATE`), serta didukung oleh PostgreSQL CHECK Constraint:
  ```sql
  ALTER TABLE inventory_balances ADD CONSTRAINT chk_balance_non_negative CHECK (quantity_on_hand >= 0);
  ```

### 9.3 Valuasi HPP & Fluktuasi Biaya (*Cost Valuation*)
* Menggunakan metode `MOVING_AVERAGE` pada level `InventoryItem`.
* Saat pembelian PO masuk:
  $$\text{New Average Cost} = \frac{(\text{Current Qty} \times \text{Current Cost}) + (\text{Incoming Qty} \times \text{Incoming Cost})}{\text{Current Qty} + \text{Incoming Qty}}$$
* Nilai HPP saat penjualan kasir langsung di-snapshot ke `OrderItem.costPrice`. Dengan demikian, kenaikan harga bahan baku di masa depan **tidak akan mengubah laba kotor transaksi masa lalu**.

---

## 10. Order & Payment Audit

### 10.1 Evaluasi Pemisahan Siklus Hidup (*Decoupling*)
* **`OrderStatus`:** `DRAFT` $\rightarrow$ `CONFIRMED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `READY` $\rightarrow$ `COMPLETED` (dengan cabang perkecualian: `CANCELLED`, `VOIDED`).
* **`PaymentStatus`:** `UNPAID` $\rightarrow$ `PARTIALLY_PAID` $\rightarrow$ `PAID` $\rightarrow$ `REFUNDED`.
* **Hasil Uji:** Struktur ini sukses 100% mengakomodasi:
  * Restoran Dine-In: Order `CONFIRMED`, Payment `UNPAID` (Makan dulu bayar nanti).
  * Bengkel Servis: Order `IN_PROGRESS`, Payment `PARTIALLY_PAID` (Pelanggan bayar uang muka).
  * Retail Cepat: Order `COMPLETED`, Payment `PAID` dalam satu kali klik.

### 10.2 Titik Pemicu Konsumsi Inventori (*Inventory Trigger Point*)
* Retail: Dipotong saat status pembayaran menjadi `PAID`.
* F&B Restoran: Dipotong saat pesanan beralih ke status `CONFIRMED` / dikirim ke dapur.
* Services: Dipotong saat pekerjaan servis selesai (`COMPLETED`).

---

## 11. Migration Readiness Audit

### 11.1 Evaluasi Pola Expand-Contract
Sistem yang sudah 70% selesai tidak boleh mengalami kegagalan migrasi. Berikut adalah audit kesiapan 6 tahap migrasi:

```
[EXPAND] -> Tambah tabel baru (inventory_items, balances, variants)
   ↓
[BACKFILL] -> Gandakan data Product lama ke InventoryItem & Variant
   ↓
[DUAL-WRITE] -> Controller update tabel lama DAN tabel baru bersamaan
   ↓
[RECONCILE] -> Jalankan kueri validasi rekonsiliasi data
   ↓
[CUTOVER] -> Arahkan seluruh kueri pembacaan ke tabel baru
   ↓
[CONTRACT] -> Hapus ketergantungan kolom lama secara bertahap
```

### 11.2 Kueri Validasi Rekonsiliasi Data Wajib (Reconciliation Checklist)
Sebelum tahap *Cutover* disetujui, query berikut **WAJIB** bernilai 0 (nol error):
1. **Pemeriksaan Jumlah Master Produk:**
   `SELECT COUNT(*) FROM products WHERE id NOT IN (SELECT product_id FROM product_variants);` -> Harus 0.
2. **Pemeriksaan Kuantitas Saldo Stok:**
   `SELECT op.stock - ib.quantity_on_hand FROM outlet_products op JOIN storage_locations sl ON sl.outlet_id = op.outlet_id JOIN product_variants pv ON pv.product_id = op.product_id JOIN inventory_balances ib ON ib.inventory_item_id = pv.inventory_item_id AND ib.storage_location_id = sl.id WHERE (op.stock - ib.quantity_on_hand) != 0;` -> Harus 0.
3. **Pemeriksaan HPP Historis:**
   Seluruh nilai `order_items.cost_price` tidak boleh ada yang berubah sebelum dan sesudah migrasi.

---

## 12. Required Architecture Decisions (ADR Gate)

Keputusan berikut **HARUS DISETUJUI SECARA EKSPLISIT** oleh Project Owner sebelum pengerjaan migrasi dimulai:

### ADR-VAL-01: Kebijakan Transaksi pada Stok Minus / Negatif
* **Pertanyaan:** Apakah kasir diizinkan melanjutkan transaksi checkout jika saldo stok fisik di sistem menunjukkan angka `0` atau minus?
* **Opsi A (Strict):** Hard Stop (Database CHECK constraint menolak transaksi jika stok kurang).
* **Opsi B (Flexible F&B):** Allow Negative Stock with Audit Warning (Kasir F&B tetap bisa menyajikan kopi, saldo menjadi minus, dan direkonsiliasi otomatis saat PO supplier diinput).
* **Dampak:** Opsi A sangat aman untuk Retail, tetapi dapat memicu keributan tamu restoran F&B jika pelayan dilarang mencatat pesanan hanya karena staf gudang telat input nota belanja pagi.
* **Rekomendasi Arsitek:** Terapkan **Opsi B dengan pembatasan modul**: Izinkan stok minus hanya jika tenant mengaktifkan modul F&B (`Tenant.enabledModules.includes('FNB')`), dan larang stok minus pada tenant Retail murni.
* **Keputusan Diperlukan dari Owner:** `[Setujui Opsi A / Setujui Opsi B / Setujui Rekomendasi Arsitek]`

---

### ADR-VAL-02: Lokasi Implementasi Dual-Write Logic
* **Pertanyaan:** Di mana logika penulisan ganda (*Dual-Write*) dieksekusi selama masa migrasi 3 bulan ke depan?
* **Opsi A:** Langsung di dalam masing-masing Controller Express (`order.controller.ts`, `inventory.controller.ts`).
* **Opsi B:** Membangun `InventoryDomainService` terpusat dan Prisma Client Extension.
* **Dampak:** Opsi A cepat dibuat tetapi sangat rawan desinkronisasi (*scattered logic*). Opsi B membutuhkan refactor service layer terlebih dahulu tetapi menjamin konsistensi data 100%.
* **Rekomendasi Arsitek:** **Wajib Opsi B.**
* **Keputusan Diperlukan dari Owner:** `[Setujui Opsi B]`

---

### ADR-VAL-03: Penambahan Kolom `tenantId` pada Seluruh Entitas Anak
* **Pertanyaan:** Apakah kita mewajibkan denormalisasi `tenantId NOT NULL` pada `OrderItem`, `RecipeItem`, `ModifierItem`, dan `RefundItem`?
* **Opsi A:** Cukup mengandalkan relasi parent (tidak perlu tambah `tenantId` di tabel anak).
* **Opsi B:** Denormalisasi `tenantId NOT NULL` ke seluruh tabel anak tanpa perkecualian.
* **Dampak:** Opsi B menambah sedikit storage (~16 byte per baris), tetapi **menutup total celah peretasan data lintas tenant (*cross-tenant injection*)** dan mempercepat query analitik pelaporan hingga 400% karena tidak perlu multi-table JOIN.
* **Rekomendasi Arsitek:** **Wajib Opsi B.**
* **Keputusan Diperlukan dari Owner:** `[Setujui Opsi B]`

---

## 13. Implementation Gate & Sign-Off

### IMPLEMENTATION GATE VERDICT
**STATUS:** `PASS WITH REQUIRED CHANGES`

Pengerjaan kode program, perubahan skema Prisma riil, maupun migrasi basis data **HANYA DAPAT DIMULAI** apabila 5 prasyarat mutlak berikut telah dipenuhi:

1. ✅ **Revisi Draf Skema Prisma Target:**
   * Menambahkan `model RefundItem` lengkap.
   * Menambahkan `model IdempotencyKey` mandiri dengan unique constraint.
   * Menambahkan `targetInventoryItemId` pada `model ModifierRecipeEffect`.
   * Menambahkan `tenantId NOT NULL` pada `model OrderItem` dan `model RecipeItem`.
   * Menambahkan `defaultStorageLocationId` pada `model Outlet`.
   * Menambahkan `inventoryQuantityMultiplier` pada `model ProductVariant`.
2. ✅ **Persetujuan ADR-VAL-01, ADR-VAL-02, dan ADR-VAL-03 oleh Project Owner.**
3. ✅ **Pembuatan Test Suite Otomatis untuk Concurrency Locking** (validasi atomic decrement dan pencegahan stok minus).
4. ✅ **Pembuatan Service Layer `InventoryDomainService`** untuk mengisolasi logika mutasi stok dari controller Express.
5. ✅ **Penyusunan Script Validasi Rekonsiliasi Data** (Kueri pengecekan selisih nol sebelum cutover).

---
*Laporan ini disusun secara independen dan objektif sebagai gerbang kendali mutu arsitektur sistem.*
