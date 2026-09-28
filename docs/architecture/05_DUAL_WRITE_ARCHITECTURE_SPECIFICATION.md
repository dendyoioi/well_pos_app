# 05 — DUAL-WRITE ARCHITECTURE & SERVICE BOUNDARY SPECIFICATION

**Document Version:** `1.0.0-PROMPT-14.1-SPEC`  
**Date:** 2026-09-21  
**Author:** Antigravity (*Architecture & Implementation Agent*)  
**Status:** PROPOSED — PENDING PROJECT OWNER REVIEW & STRATEGY SELECTION  
**Lifecycle State:**
```text
  [ EXPAND ]     ===>  COMPLETED
  [ BACKFILL ]   ===>  COMPLETED & RECONCILED (100% Parity Achieved — OAUTH-13.4-01)
  [ DUAL-WRITE ] ===>  CURRENT PHASE (Architecture & Specification Gate)
  [ RECONCILE ]  ===>  PENDING
  [ CUTOVER ]    ===>  PENDING
  [ CONTRACT ]   ===>  PENDING
```

---

## 1. PENDAHULUAN & TUJUAN ARSITEKTURAL

### 1.1 Latar Belakang
Pada tahap sebelumnya (**Prompt 13.4**), Live Backfill dan rekonsiliasi dimensional penuh telah berhasil dieksekusi pada database operasional `pos_db` dengan **100% kesetaraan (zero discrepancy)** pada 14 suite pengujian. Seluruh data historis dan relasional dari 18 tabel legacy telah terpetakan secara deterministik ke dalam skema target (18 tabel target inti).

Kini sistem memasuki **FASE DUAL-WRITE**. Pada fase ini, aplikasi akan melayani transaksi baru yang masuk melalui endpoint API publik. Setiap mutasi data yang terjadi harus dituliskan secara simultan ke:
1. **Skema Legacy:** Menjaga kestabilan operasional kasir, pelaporan POS eksisting, dan kompatibilitas runtime saat ini.
2. **Skema Target:** Menjamin skema baru terus terisi secara mutakhir, konsisten, dan siap untuk fase Cutover di masa mendatang tanpa memerlukan backfill ulang.

### 1.2 Prinsip Arsitektur Utama
Sesuai dengan mandat direktif `docs/00_PROJECT_CONTEXT.md` (Baris 440) dan `docs/decisions/ADR-005-services-module-boundary.md`:
> *"Dual-write logic should be centralized in a domain/application service rather than scattered across controllers."*

Dokumen ini mendefinisikan batas modul (*module boundary*), kontrak antarmuka (*interface contract*), semantik konkurensi persediaan, dan matriks trade-off konsistensi penanganan kegagalan (*failure handling*) tanpa melakukan modifikasi kode runtime pada Prompt 14.1.

---

## 2. AUDIT TITIK MUTASI KONTROLER (MUTATION INVENTORY)

Audit komprehensif dilakukan terhadap seluruh kontroler aktif di `pos_apps/server/src/controllers/`. Ditemukan 11 titik mutasi state kritis yang wajib didukung oleh lapisan Dual-Write:

```text
+------------------------------------------------------------------------------------------------------+
|                                   CONTROLLER MUTATION AUDIT MATRIX                                  |
+--------------------------+-----------------------+--------------------+------------------------------+
| Controller File          | Endpoint Route        | HTTP Method & Op   | Domain Entity                |
+--------------------------+-----------------------+--------------------+------------------------------+
| product.controller.ts    | /api/products         | POST (Create)      | Product, OutletProduct, Mov  |
| product.controller.ts    | /api/products/:id     | PUT (Update)       | Product                      |
| product.controller.ts    | /api/products/:id     | DELETE (Delete)    | Product, OutletProduct       |
| product.controller.ts    | /api/products/bulk    | POST (Bulk Action) | Product                      |
| product.controller.ts    | /api/products/assign  | POST (Assign)      | OutletProduct                |
| category.controller.ts   | /api/categories*      | POST/PUT/DELETE    | Category (Shared)            |
| inventory.controller.ts  | /api/inventory/in     | POST (Stock In)    | OutletProduct, StockMovement |
| inventory.controller.ts  | /api/inventory/out    | POST (Stock Out)   | OutletProduct, StockMovement |
| inventory.controller.ts  | /api/inventory/adjust | POST (Opname)      | OutletProduct, StockMovement |
| inventory.controller.ts  | /api/inventory/trans  | POST (Transfer)    | OutletProduct, StockMovement |
| order.controller.ts      | /api/orders/checkout  | POST (Checkout)    | Order, OrderItem, Pay, Stock |
| user.controller.ts       | /api/users            | POST (Create User) | User (Model B Credentials)   |
| user.controller.ts       | /api/users/:id        | PUT (Update User)  | User (Model B Credentials)   |
| outlet.controller.ts     | /api/outlets          | POST (Create)      | Outlet -> StorageLocation    |
+--------------------------+-----------------------+--------------------+------------------------------+
```

### 2.1 Domain Katalog: `product.controller.ts` & `category.controller.ts`

#### 2.1.1 `POST /api/products` (`createProduct`)
- **Mutasi Legacy:**
  1. `tx.product.create`: Menulis baris master produk baru ke tabel `products`.
  2. `tx.outletProduct.create`: Menulis baris alokasi cabang ke `outlet_products` (`stock = initialStock`).
  3. `tx.stockMovement.create` (*kondisional jika initialStock > 0*): Menulis catatan kartu stok `stock_movements` bertipe `PURCHASE_IN`.
- **Target Schema Mutations:**
  1. `inventory_items`: Membuat item inventori fisik kanonikal.
     - `id`: `uuidv5("inventory_item:" + product.id, NS_WELL_POS)`
     - `tenant_id`: `product.tenantId`
     - `item_code`: `product.sku + "-INV"`
     - `name`: `product.name`
     - `canonical_uom`: `product.unit` (misal: "Pcs", "Cup")
     - `average_cost`: `product.costPrice`
     - `is_batched`: `false`
     - `is_active`: `true`
  2. `product_variants`: Membuat varian komersial default (1:1 produk retail).
     - `id`: `uuidv5("variant_default:" + product.id, NS_WELL_POS)`
     - `tenant_id`: `product.tenantId`
     - `product_id`: `product.id`
     - `inventory_item_id`: `inventory_item.id`
     - `name`: `"Default"`
     - `sku`: `product.sku`
     - `barcode`: `product.barcode`
     - `retail_price`: `product.basePrice`
     - `inventory_quantity_multiplier`: `1.000` (per ADR-003)
     - `is_active`: `true`
  3. `inventory_balances`: Membuat saldo inventori pada lokasi penyimpanan default cabang.
     - `storage_location_id`: `uuidv5("storage_location:default:" + targetOutletId, NS_WELL_POS)`
     - `quantity_on_hand`: `initialStock`
     - `quantity_reserved`: `0.000`
  4. `inventory_ledgers` (*jika initialStock > 0*): Menulis catatan mutasi audit buku besar.
     - `movement_type`: `'PURCHASE_RECEIPT'`
     - `reference_type`: `'STOCK_OPNAME'`
     - `reference_id`: `product.id`
     - `quantity_delta`: `initialStock`
     - `balance_before`: `0.000`
     - `balance_after`: `initialStock`
     - `unit_cost`: `product.costPrice`
     - `notes`: `'Saldo stok awal pembuatan produk'`

#### 2.1.2 `PUT /api/products/:id` (`updateProduct`)
- **Mutasi Legacy:** `tx.product.update` (nama, barcode, SKU, harga beli, harga jual, UOM, status aktif).
- **Target Schema Mutations:**
  1. `inventory_items`:
     - Update `name = product.name`
     - Update `canonical_uom = product.unit`
     - Update `average_cost = product.costPrice`
     - Update `is_active = product.isActive`
  2. `product_variants`:
     - Update `sku = product.sku`
     - Update `barcode = product.barcode`
     - Update `retail_price = product.basePrice`
     - Update `is_active = product.isActive`

#### 2.1.3 `DELETE /api/products/:id` (`deleteProduct`)
- **Mutasi Legacy:** Soft-delete (`isActive = false`) atau hard delete jika tidak ada histori penjualan.
- **Target Schema Mutations:**
  - Soft-delete: Menandai `inventory_items.is_active = false` dan `product_variants.is_active = false`.
  - Hard-delete: Menghapus baris terkait di `product_variants`, `inventory_balances`, dan `inventory_items` hanya jika saldo stok 0 dan tidak memiliki entri di `inventory_ledgers`.

---

### 2.2 Domain Persediaan: `inventory.controller.ts`

#### 2.2.1 `POST /api/inventory/stock-in` (`recordStockIn`)
- **Mutasi Legacy:**
  - `outlet_products.upsert`: `stock = stock + quantity`
  - `product.update`: `costPrice = newCostPrice` (jika ada revisi HPP)
  - `stock_movements.create`: tipe `PURCHASE_IN`
- **Target Schema Mutations:**
  - `inventory_balances`:
    $$\text{quantity\_on\_hand} = \text{quantity\_on\_hand} + \text{quantity}$$
  - `inventory_items`: Update `average_cost = newCostPrice` (jika diberikan).
  - `inventory_ledgers`: Append baris baru:
    - `movement_type`: `'PURCHASE_RECEIPT'`
    - `reference_type`: `'PURCHASE_ORDER'`
    - `reference_id`: `poNumber || 'STOCK-IN'`
    - `quantity_delta`: `+quantity`
    - `balance_before`: Saldo fisik sesaat sebelum mutasi
    - `balance_after`: Saldo fisik sesaat setelah mutasi
    - `unit_cost`: `newCostPrice || currentAverageCost`
    - `actor_type`: `'USER'`
    - `actor_user_id`: `userId`
    - `notes`: `finalNotes`

#### 2.2.2 `POST /api/inventory/stock-out` (`recordStockOut`)
- **Mutasi Legacy:**
  - `outlet_products.update`: `stock = stock - quantity`
  - `stock_movements.create`: tipe `DAMAGE_OUT` (quantity: `-quantity`)
- **Target Schema Mutations:**
  - `inventory_balances`:
    $$\text{quantity\_on\_hand} = \text{quantity\_on\_hand} - \text{quantity}$$
  - `inventory_ledgers`: Append baris baru:
    - `movement_type`: `'DAMAGE_DISPOSAL'`
    - `reference_type`: `'INTERNAL_TRANSFER'`
    - `reference_id`: `'MANUAL-STOCK-OUT'`
    - `quantity_delta`: `-quantity`
    - `balance_before`: Saldo fisik sesaat sebelum mutasi
    - `balance_after`: Saldo fisik sesaat setelah mutasi
    - `actor_user_id`: `userId`
    - `notes`: `notes`

#### 2.2.3 `POST /api/inventory/adjustment` (`recordStockAdjustment`)
- **Mutasi Legacy:**
  - `outlet_products.upsert`: `stock = actualStock`
  - `stock_movements.create`: tipe `ADJUSTMENT` (`quantity = actualStock - currentStock`)
- **Target Schema Mutations:**
  - `inventory_balances`: Update `quantity_on_hand = actualStock`
  - `inventory_ledgers`: Append baris baru:
    - `movement_type`: `'OPNAME_ADJUSTMENT'`
    - `reference_type`: `'STOCK_OPNAME'`
    - `reference_id`: `'OPNAME-' + Date.now()`
    - `quantity_delta`: `actualStock - balanceBefore`
    - `balance_before`: `balanceBefore`
    - `balance_after`: `actualStock`
    - `notes`: `notes`

#### 2.2.4 `POST /api/inventory/transfer` (`transferStock`)
- **Mutasi Legacy:**
  - Pengurangan stok cabang asal (`outlet_products.stock -= quantity`) & penambahan stok cabang tujuan (`outlet_products.stock += quantity`).
  - 2 catatan `stock_movements` (TRANSFER_OUT dan TRANSFER_IN).
- **Target Schema Mutations:**
  - Pengurangan `inventory_balances` pada lokasi asal & penambahan `inventory_balances` pada lokasi tujuan.
  - 2 entri `inventory_ledgers`:
    1. Lokasi asal: `movement_type = 'TRANSFER_OUT'`, `quantity_delta = -quantity`
    2. Lokasi tujuan: `movement_type = 'TRANSFER_IN'`, `quantity_delta = +quantity`

---

### 2.3 Domain Penjualan & Transaksi: `order.controller.ts`

#### 2.3.1 `POST /api/orders/checkout` (`checkoutOrder`)
Merupakan alur mutasi paling kritis di seluruh sistem:
- **Mutasi Legacy:**
  1. `orders.create`: Membuat order penjualan (invoice number, subtotal, grand total, payment status PAID).
  2. `order_items.create`: Rincian item order (`productId`, `quantity`, `unitPrice`, `costPrice`, `subtotal`).
  3. `payments.create`: Catatan pembayaran transaksi (Cash, QRIS, Split Payment).
  4. `outlet_products.update`: Pemotongan stok kasir (`stock = stock - item.quantity`).
  5. `stock_movements.create`: Kartu stok penjualan kasir bertipe `SALE_OUT`.
  6. `customer.update` (*opsional*): Inkrementasi `visitCount` dan `totalSpent`.
- **Target Schema Mutations:**
  1. `order_items.product_variant_id`:
     - Pada skema target, `order_items` memiliki foreign key ke `product_variants`.
     - Dual-write **wajib mengisi** `order_items.product_variant_id = variant.id` (menggunakan default variant `uuidv5("variant_default:" + item.productId, NS_WELL_POS)`).
  2. `payment_transactions`:
     - Setiap baris pembayaran di legacy `payments` dipetakan ke tabel buku besar pembayaran `payment_transactions`:
       - `id`: `uuidv5("payment_tx:" + payment.id, NS_WELL_POS)` atau nanoid
       - `tenant_id`: `tenantId`
       - `order_id`: `order.id`
       - `payment_method`: `payment.method`
       - `amount`: `payment.amountPaid`
       - `status`: `'COMPLETED'`
       - `reference_number`: `payment.qrisReference || null`
       - `created_at`: waktu transaksi
  3. Pemotongan Inventori Target & Multiplier (ADR-003):
     - Dapatkan pengali kemasan komersial:
       $$\text{deductQty} = \text{item.quantity} \times \text{ProductVariant.inventoryQuantityMultiplier}$$
     - Potong saldo fisik pada `inventory_balances`:
       $$\text{quantity\_on\_hand} = \text{quantity\_on\_hand} - \text{deductQty}$$
  4. Append Mutasi Audit Buku Besar `inventory_ledgers`:
     - `movement_type`: `'SALE'`
     - `reference_type`: `'SALES_ORDER'`
     - `reference_id`: `order.id`
     - `quantity_delta`: `-\text{deductQty}`
     - `balance_before`: Saldo fisik sebelum pemotongan
     - `balance_after`: Saldo fisik setelah pemotongan
     - `actor_type`: `'USER'`
     - `actor_user_id`: `cashierId`
     - `notes`: `'Penjualan kasir faktur: ' + invoiceNumber`

---

### 2.4 Domain Manajemen Pengguna: `user.controller.ts` & `auth.controller.ts`

#### 2.4.1 `POST /api/users` (`createUser`)
- **Mutasi Legacy:** `users.create` (`name`, `email`, `passwordHash`, `pin`, `role`, `outletId`, `tenantId`).
- **Target Schema Mutations (Model B Credentials):**
  - Mengalokasikan `user_code`:
    - Format standar: `USR-` + 6 karakter uppercase deterministik dari hash ID user atau sequence (misal: `USR-KASIR2`).
    - Khusus role OWNER baseline: `USR-OWNER1`.
  - Mengisi `pin_hash`:
    - Jika `pin` diberikan (`LEGACY_PIN_PRESENT`): `pin_hash = await bcrypt.hash(pin, 10)` (format valid Bcrypt `$2a$`).
    - Jika `pin` tidak ada / null (`LEGACY_PIN_NULL`): `pin_hash = NULL` (Sesuai keputusan **OD-13.3-03 Invariant** — nol flag sintetis).

#### 2.4.2 `PUT /api/users/:id` (`updateUser`)
- **Mutasi Legacy:** `users.update` (nama, email, role, pin, outletId, isActive).
- **Target Schema Mutations:**
  - Jika PIN diubah dan memiliki nilai: `pin_hash = await bcrypt.hash(pin, 10)`.
  - Jika PIN dihapus/dikosongkan: `pin_hash = NULL`.

---

### 2.5 Domain Outlet Cabang: `outlet.controller.ts`

#### 2.5.1 `POST /api/outlets` (`createOutlet`)
- **Mutasi Legacy:** `outlets.create` (`name`, `address`, `phone`, `isWarehouse`, `feesConfig`, `tenantId`).
- **Target Schema Mutations:**
  - Pada skema target, setiap cabang fisik wajib memiliki minimal satu **Storage Location** default bertipe `STOREFRONT` (atau `WAREHOUSE` jika cabang bertindak sebagai gudang pusat):
    - `id`: `uuidv5("storage_location:default:" + outlet.id, NS_WELL_POS)`
    - `tenant_id`: `outlet.tenantId`
    - `outlet_id`: `outlet.id`
    - `name`: `(outlet.isWarehouse ? "Warehouse - " : "Storefront - ") + outlet.name`
    - `type`: `outlet.isWarehouse ? "WAREHOUSE" : "STOREFRONT"`
    - `is_default`: `true`
    - `is_active`: `true`

---

## 3. DESAIN LAPISAN LAYANAN DOMAIN TERPUSAT (CENTRALIZED DOMAIN SERVICES)

### 3.1 Struktur Direktori Layanan
Seluruh logika Dual-Write dikonsolidasikan di bawah direktori `pos_apps/server/src/services/dual_write/`:

```text
pos_apps/server/src/services/dual_write/
├── index.ts                         # Export barrel & dependency injection container
├── base.dual_write.service.ts       # Base class penyedia helper SQL & UUIDv5 generator
├── catalog.dual_write.service.ts    # CatalogDualWriteService
├── inventory.dual_write.service.ts  # InventoryDualWriteService
├── sales.dual_write.service.ts      # SalesDualWriteService
├── user.dual_write.service.ts       # UserDualWriteService
├── location.dual_write.service.ts   # LocationDualWriteService
└── types.ts                         # Tipe payload, DTO, dan parameter interface
```

### 3.2 Kontrak Interface & Spesifikasi Service

```typescript
// types.ts
export interface DualWriteContext {
  tx: any; // Prisma Transaction Client ($transaction)
  tenantId: string;
  actorUserId?: string;
}

export interface DualWriteResult<T> {
  legacyData: T;
  targetSynced: boolean;
  targetRecordsAffected: number;
}
```

#### 3.2.1 `CatalogDualWriteService`
```typescript
export interface CreateProductDTO {
  barcode: string;
  sku: string;
  name: string;
  categoryId: string;
  costPrice: number;
  basePrice: number;
  unit: string;
  description?: string;
  imageUrl?: string;
  initialStock: number;
  minStockAlert: number;
  outletId: string;
}

export class CatalogDualWriteService extends BaseDualWriteService {
  /**
   * Menjalankan mutasi ganda pembuatan produk, default variant, 
   * item inventori kanonikal, dan saldo awal stok.
   */
  async createProduct(dto: CreateProductDTO, ctx: DualWriteContext): Promise<DualWriteResult<any>>;

  /**
   * Menjalankan sinkronisasi pembaruan atribut produk dan varian target.
   */
  async updateProduct(productId: string, dto: Partial<CreateProductDTO>, ctx: DualWriteContext): Promise<DualWriteResult<any>>;

  /**
   * Menghapus atau menonaktifkan produk beserta varian dan item inventori terkait.
   */
  async deleteProduct(productId: string, ctx: DualWriteContext): Promise<DualWriteResult<any>>;
}
```

#### 3.2.2 `InventoryDualWriteService`
```typescript
export interface StockMutationDTO {
  outletId: string;
  productId: string;
  quantity: number;
  notes?: string;
  poNumber?: string;
  supplierName?: string;
  newCostPrice?: number;
}

export class InventoryDualWriteService extends BaseDualWriteService {
  /**
   * Menambah stok di outlet_products dan inventory_balances, 
   * serta mencatat mutasi di stock_movements dan inventory_ledgers.
   */
  async recordStockIn(dto: StockMutationDTO, ctx: DualWriteContext): Promise<DualWriteResult<any>>;

  /**
   * Mengurangi stok di outlet_products dan inventory_balances,
   * menegakkan kebijakan ADR-002 (Negative Stock Policy).
   */
  async recordStockOut(dto: StockMutationDTO, ctx: DualWriteContext): Promise<DualWriteResult<any>>;

  /**
   * Melakukan stock opname fisik toko, mengalibrasi saldo,
   * dan mencatat selisih di buku besar persediaan.
   */
  async recordStockAdjustment(dto: { outletId: string; productId: string; actualStock: number; notes: string }, ctx: DualWriteContext): Promise<DualWriteResult<any>>;

  /**
   * Memindahkan stok antar-cabang dengan atomisitas ganda.
   */
  async transferStock(dto: { sourceOutletId: string; targetOutletId: string; productId: string; quantity: number; notes?: string }, ctx: DualWriteContext): Promise<DualWriteResult<any>>;
}
```

#### 3.2.3 `SalesDualWriteService`
```typescript
export interface CheckoutOrderDTO {
  targetOutletId: string;
  cashierId: string;
  invoiceNumber: string;
  channel: string;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  shiftId?: string | null;
  items: Array<{
    productId: string;
    quantity: number;
    costPrice: number;
    unitPrice: number;
    discountAmount: number;
    subtotal: number;
  }>;
  payments: Array<{
    method: string;
    amountPaid: number;
    changeGiven: number;
    qrisReference?: string | null;
  }>;
  subtotal: number;
  globalDiscount: number;
  taxAmount: number;
  serviceCharge: number;
  grandTotal: number;
  totalCost: number;
}

export class SalesDualWriteService extends BaseDualWriteService {
  /**
   * Menjalankan atomic checkout: Order, OrderItem (termasuk product_variant_id),
   * Payments & PaymentTransactions, pemotongan stok dengan packaging multiplier,
   * serta pencatatan audit buku besar inventori.
   */
  async processCheckout(dto: CheckoutOrderDTO, ctx: DualWriteContext): Promise<DualWriteResult<any>>;
}
```

#### 3.2.4 `UserDualWriteService`
```typescript
export interface CreateUserDTO {
  name: string;
  email: string;
  passwordHash: string;
  pin?: string | null;
  role: string;
  outletId?: string | null;
}

export class UserDualWriteService extends BaseDualWriteService {
  /**
   * Membuat pengguna baru, mengalokasikan user_code deterministik,
   * dan meng-hash PIN menjadi Bcrypt pin_hash (Model B).
   */
  async createUser(dto: CreateUserDTO, ctx: DualWriteContext): Promise<DualWriteResult<any>>;

  /**
   * Memperbarui pengguna dan menyinkronkan perubahan PIN ke pin_hash.
   */
  async updateUser(userId: string, dto: Partial<CreateUserDTO>, ctx: DualWriteContext): Promise<DualWriteResult<any>>;
}
```

#### 3.2.5 `LocationDualWriteService`
```typescript
export class LocationDualWriteService extends BaseDualWriteService {
  /**
   * Membuat outlet cabang dan menginisialisasi Storage Location default.
   */
  async createOutlet(dto: { name: string; address?: string; phone?: string; isWarehouse: boolean; feesConfig: any }, ctx: DualWriteContext): Promise<DualWriteResult<any>>;
}
```

### 3.3 Integrasi Minimal Disrupsi pada Kontroler
Kontroler tidak lagi melakukan interaksi Prisma langsung secara berserakan, melainkan mendelegasikan transaksi ke Domain Service.

**Contoh Refaktor `checkoutOrder`:**
```typescript
// Controller tetap menangani HTTP parsing, Zod validation, dan respons JSON
export const checkoutOrder = async (req: Request, res: Response) => {
  try {
    const parseResult = checkoutSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ status: 'error', errors: parseResult.error.flatten().fieldErrors });
    }
    
    // Siapkan DTO...
    const result = await prisma.$transaction(async (tx) => {
      return await salesDualWriteService.processCheckout(dto, {
        tx,
        tenantId: req.user.tenantId,
        actorUserId: req.user.id
      });
    });

    return res.status(201).json({ status: 'success', data: result.legacyData });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};
```

---

## 4. ANALISIS POLA KONSISTENSI & PENANGANAN KEGAGALAN (TRADE-OFF MATRIX)

Ketika aplikasi menulis ke dua representasi skema secara bersamaan, arsitektur harus memilih strategi penanganan kegagalan (*failure handling strategy*) saat mutasi ke skema target mengalami kendala.

```text
+-----------------------------------------------------------------------------------------------------------------+
|                                 CONSISTENCY & FAILURE HANDLING TRADE-OFF MATRIX                                 |
+------------------------------+----------------------------------------+-----------------------------------------+
| Dimensi Evaluasi             | Pola A: Synchronous Strict ACID        | Pola B: Fail-Safe with Drift Outbox     |
+------------------------------+----------------------------------------+-----------------------------------------+
| Mekanisme Transaksi          | Single PostgreSQL Transaction (`tx`)   | Legacy commits first; Target caught     |
| Konsistensi Data             | Strong Consistency (Zero Drift, 100%)  | Eventual Consistency (Lag & Drift Risk) |
| Ketersediaan Kasir (SLA)     | Risiko: Bug target memblokir kasir     | Aman: Kasir tidak pernah terblokir      |
| Kompleksitas Arsitektur      | Sederhana (Tanpa antrean / background) | Tinggi (Butuh Outbox table & Worker)    |
| Overhead Database            | 1x Roundtrip Transaksi                 | 2x Write (Transaksi + Log Outbox)       |
| Kemudahan Audit & Debug      | Langsung (Rollback instan jika error)  | Rumit (Pelacakan status sinkronisasi)   |
| Kesiapan Cutover             | Instan (Data selalu 100% paritas)      | Tertunda sampai Outbox drain 100%       |
+------------------------------+----------------------------------------+-----------------------------------------+
```

### 4.1 Detail Pola A: Transaksi Tunggal Atomik (Strict Synchronous ACID)
- **Cara Kerja:**
  Mutasi legacy dan mutasi target dijalankan di dalam blok `prisma.$transaction(async (tx) => { ... })` yang sama.
  ```text
  [ Client Request ]
         │
         ▼
  BEGIN TRANSACTION (PostgreSQL)
  ├── 1. Write Legacy Tables (e.g. orders, outlet_products)
  └── 2. Write Target Tables (e.g. order_items.variant, inventory_balances, ledgers)
         │
    [Success?] ── Yes ──► COMMIT TRANSACTION (Both saved)
         │
         No (Error thrown)
         │
         ▼
  ROLLBACK TRANSACTION (Zero partial rows, zero divergence)
  ```
- **Keuntungan:**
  1. **Zero Data Divergence Guarantee:** Tidak akan pernah terjadi kondisi di mana stok legacy berkurang tetapi saldo target tidak berkurang. Paritas 100% yang telah dicapai pada Prompt 13.4 selalu terjaga setiap detik.
  2. **Tanpa Infrastruktur Tambahan:** Tidak membutuhkan worker background, antrean pesan, redis, atau cron scheduler untuk replay data.
  3. **Integritas Finansial & Audit:** Kegagalan langsung terdeteksi saat itu juga (*fail-fast*), mencegah data korup tersimpan di sistem.
- **Kelemahan:**
  Jika terdapat cacat kode (*bug*) yang belum terdeteksi pada SQL target, transaksi penjualan kasir akan gagal dan memunculkan error 500 ke kasir.

### 4.2 Detail Pola B: Fail-Safe Dual-Write dengan Drift Outbox Queue
- **Cara Kerja:**
  Mutasi legacy dijalankan dan di-commit terlebih dahulu. Mutasi target dijalankan di dalam blok `try / catch`. Jika mutasi target gagal:
  1. Transaksi legacy tetap dipertahankan (*commit*).
  2. Payload mutasi target disimpan ke dalam tabel antrean `dual_write_drift_queue` (atau audit log) dengan status `PENDING_RETRY`.
  3. Background worker membaca antrean dan melakukan *replay* secara periodik.
- **Keuntungan:**
  Kasir toko tidak akan pernah terblokir untuk melayani antrean pelanggan di jam sibuk meskipun skema target mengalami kendala.
- **Kelemahan:**
  1. Terjadinya drift data persediaan: Selama antrean belum terproses, query ke skema target akan menghasilkan angka saldo yang salah (*stale*).
  2. Kompleksitas *out-of-order execution*: Jika transaksi B di-replay sebelum transaksi A pada produk yang sama, urutan buku besar (*inventory ledgers*) akan terdistorsi.
  3. Risiko penumpukan antrean gagal yang membutuhkan intervensi manual developer.

### 4.3 Rekomendasi Teknis untuk Project Owner
Kami merekomendasikan **Pola Bertingkat Berbasis Sensitivitas Operasional (Tiered Strategy)**:
1. **Tier 1 (Sales / Kasir POS Checkout): Pola A dengan Validasi Komprehensif di Tahap Pengujian.**  
   Karena target tables telah lolos verifikasi determinisme 100% pada Prompt 13.4, logika mutasi target untuk penjualan kasir sangat deterministik dan aman. Namun, jika Project Owner menghendaki proteksi mutlak terhadap antrean kasir, dapat dipasang *Emergency Drift Logger* khusus endpoint checkout.
2. **Tier 2 (Admin Catalog, Inventory Adjustment, IAM Staff): Wajib Pola A (Strict ACID).**  
   Untuk penambahan produk, penyesuaian stok opname, dan pembuatan user, tidak ada tekanan antrean pelanggan. Integritas data wajib 100% mutlak dan fail-closed.

---

## 5. KONKURENSI STOK & MULTIPLIER

### 5.1 Semantik Locking & Atomisitas pada Penjualan Paralel
Masalah klasik POS multi-kasir adalah dua kasir menjual produk yang sama secara bersamaan (*concurrent checkout*).

#### Alur Penanganan Konkurensi Target:
Untuk menghindari *lost update*, `InventoryDualWriteService` menggunakan semantik penguncian baris eksplisit (*row-level locking*):
```sql
-- Kunci baris saldo inventori cabang untuk menghindari race condition
SELECT id, quantity_on_hand, quantity_reserved
FROM inventory_balances
WHERE tenant_id = $1 AND storage_location_id = $2 AND inventory_item_id = $3
FOR UPDATE;
```
Setelah baris terkunci:
1. Catat `balance_before = quantity_on_hand`.
2. Validasi kebijakan stok negatif (ADR-002).
3. Hitung saldo baru:
   $$\text{balance\_after} = \text{balance\_before} - \text{deductQty}$$
4. Update saldo:
   ```sql
   UPDATE inventory_balances
   SET quantity_on_hand = $1, updated_at = CURRENT_TIMESTAMP
   WHERE id = $2;
   ```
5. Emit baris ke `inventory_ledgers` dengan `balance_before` dan `balance_after` yang terbukti matematis presisi tanpa selisih pembulatan.

### 5.2 Penegakan ADR-002: Kebijakan Stok Negatif (Context-Driven Negative Stock)
Sesuai ketetapan ADR-002, tabel `inventory_balances` **tidak dipasangi hard database check constraint** `CHECK (quantity_on_hand >= 0)` agar tidak memblokir operasional F&B. Penegakan dilakukan pada Service Layer dengan hierarki evaluasi berikut:

```text
Hierarki Evaluasi:
[ Tenant Policy ] ──► [ Storage Location Override ] ──► [ Inventory Item Override ]
```

1. **Evaluasi Aturan:**
   - Ambil `tenant.negativeStockPolicy` (Default: `STRICT_PROHIBIT` untuk Retail).
   - Periksa `storage_locations.type`: Jika bertipe `KITCHEN` atau `BAR`, aturan beralih menjadi `ALLOW_NEGATIVE`.
   - Periksa `inventory_items.allow_negative_stock`: Jika bernilai `true`, item diizinkan minus.
2. **Eksekusi Penolakan (Retail):**
   Jika hasil evaluasi adalah `STRICT_PROHIBIT` dan $\text{balance\_after} < 0$:
   - Transaksi dibatalkan seketika dengan pesan: `Stok tidak mencukupi untuk transaksi retail ini`.
3. **Eksekusi Pengecualian Operasional (F&B / Kitchen):**
   Jika hasil evaluasi mengizinkan minus:
   - Saldo fisik diizinkan berada di bawah nol ($\text{balance\_after} < 0$).
   - Kolom `inventory_ledgers.is_negative_balance` diset `true`.
   - Mutasi diberi catatan: `[OPERATIONAL_EXCEPTION: NEGATIVE_STOCK_ALLOWED]`.

### 5.3 Penegakan ADR-003: Packaging Multiplier
Sesuai ADR-003, sistem membedakan secara tegas antara **Satuan Ukur Persediaan Fisik (Canonical Inventory UOM)** dan **Kemasan Komersial Penjualan (Commercial Packaging)**:
- Kasir memindai 1 Dus Minuman Kemasan (`OrderItem.quantity = 1`).
- Varian produk memiliki `ProductVariant.inventoryQuantityMultiplier = 24.000` (1 Dus = 24 Botol Kanonikal).
- Lapisan Dual-Write menghitung konsumsi persediaan:
  $$\text{Deducted Canonical Qty} = 1 \times 24.000 = 24.000\text{ Botol}$$
- Saldo fisik `inventory_balances.quantity_on_hand` dipotong tepat 24 unit kanonikal, sementara pada invoice penjualan kasir tetap tercetak 1 Dus.

---

## 6. EVALUASI TEKNOLOGI DATA ACCESS: PARAMETERIZED RAW SQL VS SECONDARY PRISMA CLIENT

Selama fase transisi Dual-Write, skema target belum menjadi klien runtime utama aplikasi karena `prisma generate` yang menimpa klien eksisting dilarang keras demi menjaga kompatibilitas controller lama.

```text
+---------------------------------------------------------------------------------------------------------------+
|                                  DATA ACCESS TECHNOLOGY COMPARISON MATRIX                                     |
+-----------------------------+---------------------------------------+-----------------------------------------+
| Kriteria Evaluasi           | Parameterized Raw SQL ($executeRaw)   | Isolated Secondary Prisma Client        |
+-----------------------------+---------------------------------------+-----------------------------------------+
| Kompatibilitas Transaksi    | 100% Native di dalam `prisma.$tx`     | Sangat sulit berbagi transaksi aktif    |
| Stabilitas Runtime Eksisting| Terjamin 100% (Tanpa regenerate)      | Risiko konflik file build/types         |
| Overhead Memori & Engine    | 0 KB (Menggunakan connection pool ada)| Menambah 1 instance Prisma Query Engine |
| Type Safety Target Tables   | Manual via TypeScript DTO/Interfaces  | Otomatis via Prisma Type Generation     |
| Keamanan SQL Injection      | 100% Aman (Parameterized `$1, $2`)    | 100% Aman                               |
| Bukti Keberhasilan          | Terbukti di Prompt 13.3B & 13.4       | Belum pernah diuji di codebase ini      |
+-----------------------------+---------------------------------------+-----------------------------------------+
```

### 6.1 Analisis & Rationale Pemilihan
1. **Partisipasi Transaksi Atomik:**
   Kelemahan paling fatal dari secondary Prisma Client adalah ketidakmampuannya untuk bergabung ke dalam transaksi PostgreSQL yang sama yang sedang dikelola oleh primary Prisma Client (`tx`). Jika primary menulis tabel legacy dan secondary menulis tabel target, mutasi akan berjalan di dua koneksi database terpisah, sehingga atomisitas transaksi rollback tidak dapat dijamin.
2. **Keandalan Parameterized Raw SQL:**
   Metode Parameterized Raw SQL (`$executeRawUnsafe(sql, ...params)` dan `$queryRawUnsafe(sql, ...params)`) telah terbukti 100% stabil, zero-error, dan zero-leak pada seluruh pengujian determinisme dan live backfill Prompt 13.3B, 13.3C, dan 13.4.

### 6.2 Keputusan Rekomendasi
Mengadopsi **Parameterized Raw SQL yang dibungkus rapi di dalam helper `BaseDualWriteService`**.  
Dengan pendekatan ini:
- Seluruh query target menggunakan parameterized binding `$1, $2, ...` yang kebal SQL injection.
- Menggunakan koneksi transaksi `tx` yang sama persis dengan mutasi legacy.
- Tidak menyentuh `@prisma/client` runtime sedikit pun (`prisma generate` tetap tidak dijalankan).

---

## 7. STRATEGI VERIFIKASI & MONITORING PARITAS

### 7.1 Strategi Pengujian Otomatis
Sebelum Dual-Write diaktifkan di level controller:
1. **Unit Tests (`src/services/dual_write/__tests__/`):**
   - Menguji setiap metode service secara terisolasi.
   - Memverifikasi bahwa setiap panggilan service menghasilkan SQL target yang valid dan parameter binding yang presisi.
2. **Integration Tests pada Sandbox Terisolasi:**
   - Menjalankan simulasi mutasi paralel pada database sandbox (bukan `pos_db`).
   - Memastikan bahwa 1 mutasi legacy menghasilkan tepat 1 mutasi target yang setara.

### 7.2 Monitoring Paritas Berkelanjutan (Continuous Reconciliation)
Selama fase Dual-Write berjalan:
- Skrip rekonsiliasi yang telah teruji (`src/migrations/reconciliation/reconcile_all.ts`) akan dijalankan secara berkala (misal: setiap pergantian shift atau harian) untuk mengaudit:
  1. Kesetaraan stok fisik: `outlet_products.stock == inventory_balances.quantity_on_hand`.
  2. Integritas buku besar: `quantity_on_hand == sum(inventory_ledgers.quantity_delta)`.
  3. Cakupan varian dan kredensial user Model B.
- Setiap anomali akan langsung memicu peringatan dini sebelum sistem melangkah ke fase **Cutover**.

---

## 8. KESIMPULAN & TAHAP SELANJUTNYA

Dokumen spesifikasi ini telah merinci secara komprehensif seluruh kebutuhan arsitektur Dual-Write untuk Well POS. Tidak ada modifikasi kode runtime, skema database, atau klien Prisma yang dijalankan pada Prompt 14.1.

Dokumen ini diserahkan kepada **Project Owner** untuk:
1. Meninjau inventori mutasi domain.
2. Memilih preferensi strategi konsistensi transaksi (Pola A vs Pola B vs Tiered).
3. Memberikan otorisasi untuk implementasi kode layanan domain terpusat pada Prompt 14.2.
