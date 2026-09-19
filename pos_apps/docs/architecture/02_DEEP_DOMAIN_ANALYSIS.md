# DEEP DOMAIN ANALYSIS
## Inventory, Order, Stock & Multi-Tenant Architecture
**Platform Target:** Multi-Tenant SaaS POS Platform (Retail, F&B, Services)  
**Status Audit:** Read-Only Source Code Deep Analysis  
**File:** `DEEP_DOMAIN_ANALYSIS_INVENTORY_ORDER.md`  

---

## Executive Summary

Analisis mendalam ini membedah implementasi aktual kode sumber Well POS untuk memetakan batasan arsitektur (*architectural constraints*), keterikatan antar-domain (*coupling*), dan titik rawan integritas data (*data consistency & security risks*). 

### Temuan Inti Arsitektur Aktual:
1. **Entitas `Product` Saat Ini Bersifat "Tiga-dalam-Satu" (Tri-Role):**  
   Model `Product` di database secara serentak berperan sebagai *Catalog Item* (display, foto, nama), *Sellable Item* (harga jual, barcode checkout), dan *Inventory Item* (HPP, stok). Ini sangat cocok untuk retail sederhana, namun menjadi penghambat utama (*major architectural blocker*) untuk F&B (di mana barang yang dijual adalah menu, sedangkan yang dihitung stoknya adalah biji kopi/susu) dan Services (di mana layanan jasa tidak memiliki stok fisik).
2. **Kopling Monolitik Order-Payment-Inventory:**  
   Pada `order.controller.ts:checkoutOrder`, pencatatan penjualan, pembuatan pembayaran, dan pemotongan saldo stok cabang dieksekusi dalam **satu transaksi database tunggal**. Sistem tidak memiliki siklus hidup pesanan (*Order State Machine*); sebuah `Order` hanya memiliki `paymentStatus` yang langsung bernilai `PAID`. Hal ini menghalangi alur F&B (*Pesan Meja → Kirim Dapur → Bayar Belakangan*) dan Services (*Reservasi → DP → Pengerjaan → Pelunasan*).
3. **Kuantitas Integer Tanpa Konversi Satuan:**  
   Seluruh field kuantitas (`stock`, `quantity`) bertipe data `Int`. Sistem tidak dapat menerima angka desimal (misal `0.5 Kg` atau `1.5 Jam`) dan tidak memiliki tabel konversi satuan (misal `1 Box = 24 Pcs`).
4. **Resep (BOM) & Varian Belum Berada di Database:**  
   Fitur kustomisasi produk (modifiers) saat ini disimpan sebagai string JSON di dalam kolom teks `Product.description`. Tabel `ProductVariant` dan `Recipe` tidak ada di database.
5. **Celah Concurrency & Isolasi Tenant:**  
   Pengecekan kecukupan stok dilakukan sebelum transaksi database dimulai dan pemotongan stok menggunakan *blind decrement*, sehingga berpotensi menyebabkan *overselling* (stok minus) pada skenario dua kasir checkout bersamaan. Selain itu, sebagian besar entitas data memiliki kolom `tenantId` yang *nullable* dan controller mengandalkan fallback manual.

---

## 1. Current Product Domain

### 1.1 Product Identity: Catalog vs Sellable vs Inventory Item
* **Klasifikasi:** `[RISK]` / `[PARTIAL]`
* **Temuan:** Model `Product` saat ini memadukan ketiga konsep dalam satu baris tabel database:
  * **Sebagai Catalog Item:** Memiliki `name`, `categoryId`, `description`, `imageUrl`, `isActive`.
  * **Sebagai Sellable Item:** Memiliki `barcode`, `sku`, `basePrice`, `unit`.
  * **Sebagai Inventory Item:** Memiliki `costPrice` (HPP), dan terhubung ke `outlet_products.stock`.
* **Evidence:**  
  * `server/prisma/schema.prisma:284-310`:
    ```prisma
    model Product {
      id          String   @id @default(uuid())
      tenantId    String?  @map("tenant_id")
      categoryId  String   @map("category_id")
      barcode     String
      sku         String
      name        String
      costPrice   Decimal  @db.Decimal(12, 2) @map("cost_price")
      basePrice   Decimal  @db.Decimal(12, 2) @map("base_price")
      unit        String   @default("Pcs")
      ...
    }
    ```
* **Dampak Vertikal:**
  * **Retail:** Berjalan mulus untuk barang jadi (misal: Sabun, Baju, Minuman Kemasan).
  * **F&B:** Gagal memfasilitasi "Es Kopi Susu" sebagai produk jual yang bahannya (biji kopi, susu, cup) dipotong dari inventori terpisah.
  * **Services:** Gagal memfasilitasi "Jasa Potong Rambut" yang tidak memiliki stok barang fisik, kecuali menggunakan trik bypass metadata.

### 1.2 Product Ownership
* **Klasifikasi:** `[EXISTING]`
* **Temuan:** `Product` dimiliki oleh `Tenant` (Tenant-Owned), bukan Outlet-Owned dan bukan Global Catalog:
  * Satu master produk dibuat di tingkat Tenant.
  * Produk tersebut kemudian dialokasikan ke cabang-cabang melalui tabel penghubung `OutletProduct`.
  * Barcode dan SKU diproteksi unik hanya di tingkat tenant: `@@unique([tenantId, barcode])` dan `@@unique([tenantId, sku])`.
* **Evidence:**  
  * `server/prisma/schema.prisma:307-308`:
    ```prisma
    @@unique([tenantId, barcode])
    @@unique([tenantId, sku])
    ```
  * `server/src/controllers/product.controller.ts:819-854` (`assignProductsToOutlet`): Menghubungkan produk master tenant ke cabang yang dipilih.

### 1.3 Product Pricing Flow & Snapshot
* **Klasifikasi:** `[EXISTING]`
* **Temuan:** Terdapat mekanisme harga berjenjang (Tiered Pricing) dengan fallback:
  1. Master produk memiliki `Product.basePrice`.
  2. Cabang dapat menetapkan harga khusus di `OutletProduct.price`. Jika bernilai `null`, cabang otomatis mengikuti `basePrice`.
  3. Saat transaksi checkout, harga yang dipilih dicatat permanen (*snapshot*) ke dalam `OrderItem.unitPrice`. Perubahan harga master di kemudian hari tidak akan merusak faktur lama.
* **Flow Aktual:**
  ```text
  Product.basePrice (Master Default)
          ↓ (jika OutletProduct.price != null)
  OutletProduct.price (Harga Khusus Cabang)
          ↓ (Checkout Order)
  OrderItem.unitPrice (Harga Snapshot Transaksi)
  ```
* **Evidence:**  
  * `server/src/controllers/order.controller.ts:233-248`:
    ```typescript
    const outletStock = p.outletProducts[0];
    const unitPrice = outletStock?.price ? Number(outletStock.price) : Number(p.basePrice);
    ...
    return {
      productId: item.productId,
      quantity: item.quantity,
      costPrice,
      unitPrice,
      discountAmount: itemDiscount,
      subtotal: itemSubtotal,
    };
    ```

### 1.4 Product Cost / HPP (Cost of Goods Sold)
* **Klasifikasi:** `[PARTIAL]`
* **Temuan:** Sistem menggunakan metode **Fixed Replacement Cost (Harga Beli Terakhir)**, bukan FIFO, bukan Moving Average, dan bukan Weighted Average:
  * Master produk memiliki `Product.costPrice`.
  * Ketika dilakukan penerimaan stok dari supplier (`recordStockIn`), jika pengguna mengisi `newCostPrice`, nilai `Product.costPrice` langsung ditimpa (*overwritten*).
  * Saat checkout, nilai `costPrice` saat itu di-snapshot ke `OrderItem.costPrice` dan dijumlahkan ke `Order.totalCost`.
  * Nilai HPP pada laporan keuangan (`report.controller.ts`) murni merupakan agregasi statis dari `Order.totalCost`.
* **Evidence:**  
  * `server/src/controllers/inventory.controller.ts:93-98`:
    ```typescript
    if (newCostPrice !== undefined && newCostPrice >= 0) {
      await tx.product.update({
        where: { id: productId },
        data: { costPrice: newCostPrice },
      });
    }
    ```
  * `server/src/controllers/order.controller.ts:339`:
    ```typescript
    totalCost, // totalCost += costPrice * item.quantity;
    ```

### 1.5 Product Variant vs Modifier vs Description JSON
* **Klasifikasi:** `[GAP]` (Variant) & `[RISK]` (Modifier via Description)
* **Temuan Aktual:**
  * **Product Variant (Matrix SKU Ukuran/Warna):** `NOT IMPLEMENTED / NOT FOUND`. Tidak ada entitas `ProductVariant` di skema Prisma maupun tabel database.
  * **Product Modifier (Opsi Makanan/Minuman):** Diimplementasikan secara parsial di frontend. Metadata modifier disimpan ke database dengan cara **meng-encode objek JSON ke kolom teks `Product.description`**.
  * **Product Description JSON Parsing:** Saat produk dibaca melalui API, jika deskripsi diawali karakter `{`, frontend mem-parsing JSON tersebut untuk mengekstrak array `modifiers` dan boolean `hasStock`.
* **Evidence:**  
  * `client/src/components/ProductModal.tsx:448-459`:
    ```typescript
    let finalDescription = description.trim();
    const metadata: any = { text: description.trim(), hasStock };
    if (modifiers.length > 0) metadata.modifiers = modifiers;
    if (!hasStock || modifiers.length > 0) finalDescription = JSON.stringify(metadata);
    ```
  * `client/src/services/api.ts:208-223`:
    ```typescript
    if (p.description && p.description.startsWith('{')) {
      const parsed = JSON.parse(p.description);
      return {
        ...p,
        description: parsed.text !== undefined ? parsed.text : p.description,
        modifiers: Array.isArray(parsed.modifiers) ? parsed.modifiers : undefined,
      };
    }
    ```
* **Risiko Arsitektur:**  
  Menyimpan modifier di string deskripsi membuat database PostgreSQL tidak dapat melakukan indexing, validasi integritas skema, pencarian query SQL, maupun pemotongan stok bahan baku terkait modifier tersebut.

---

## 2. Current Inventory Domain

### 2.1 Lifecycle Persediaan Barang
* **Klasifikasi:** `[EXISTING]` (Retail Basics) & `[GAP]` (Purchasing & Production)
* **Matriks Event Inventori:**

| Inventory Event | Implemented | Endpoint / Source | Stock Effect | Ledger Created | Database Atomic |
| :--- | :---: | :--- | :---: | :---: | :---: |
| **Initial Stock** | Ya | `POST /api/products` | `+initialStock` | Ya (`PURCHASE_IN`) | Ya (`$transaction`) |
| **Catalog Assignment** | Ya | `POST /api/products/assign-to-outlet` | `=initialStock` | **TIDAK** `[BUG/RISK]` | Ya (`$transaction`) |
| **Purchase In (Penerimaan PO)** | Ya | `POST /api/inventory/stock-in` | `+quantity` | Ya (`PURCHASE_IN`) | Ya (`$transaction`) |
| **Damage Out (Barang Rusak)** | Ya | `POST /api/inventory/stock-out` | `-quantity` | Ya (`DAMAGE_OUT`) | Ya (`$transaction`) |
| **Stock Opname (Adjustment)** | Ya | `POST /api/inventory/adjustment` | `=actualStock` | Ya (`ADJUSTMENT`) | Ya (`$transaction`) |
| **Transfer Antar Cabang** | Ya | `POST /api/inventory/transfer` | Asal `-qty`, Tujuan `+qty` | Ya (`TRANSFER_OUT` & `IN`) | Ya (`$transaction`) |
| **Sale Out (Penjualan Kasir)** | Ya | `POST /api/orders/checkout` | `-quantity` | Ya (`SALE_OUT`) | Ya (`$transaction`) |
| **Purchase Order (PO Formal)** | Tidak | N/A (Hanya field string `poNumber`) | - | - | - |
| **Sales Return / Void** | Tidak | `NOT IMPLEMENTED / NOT FOUND` | - | - | - |
| **Ingredient Consumption** | Tidak | `NOT IMPLEMENTED / NOT FOUND` | - | - | - |

---

## 3. Stock Balance vs Stock Ledger

### 3.1 Lokasi Penyimpanan Angka Stok (State Column)
Angka stok fisik saat ini disimpan sebagai integer skalar pada model `OutletProduct`:
* **Tabel:** `outlet_products`
* **Kolom:** `stock Int @default(0)`
* **Compound Key:** `@@unique([outletId, productId])`

### 3.2 Lokasi Histori Pergerakan Stok (Audit Ledger)
Histori transaksi mutasi disimpan pada model `StockMovement`:
* **Tabel:** `stock_movements`
* **Kolom Kunci:** `id`, `outletId`, `productId`, `userId`, `type` (`StockMovementType`), `quantity` (positif untuk masuk, negatif untuk keluar), `notes`, `createdAt`.

### 3.3 Daftar Seluruh Titik Modifikasi Kolom `stock` di Kode Sumber
Berikut adalah **seluruh 6 titik** di mana kolom `stock` diubah di server:
1. `server/src/controllers/product.controller.ts:314` (`createProduct`): `stock: initialStock` saat produk pertama kali dibuat.
2. `server/src/controllers/product.controller.ts:842` (`assignProductsToOutlet`): `stock: item.initialStock` saat katalog di-assign ke cabang. **(PERINGATAN: Titik ini TIDAK membuat entri di `StockMovement`!)**
3. `server/src/controllers/inventory.controller.ts:81` (`recordStockIn`): `stock: { increment: quantity }`.
4. `server/src/controllers/inventory.controller.ts:187` (`recordStockOut`): `stock: { decrement: quantity }`.
5. `server/src/controllers/inventory.controller.ts:268` (`recordStockAdjustment`): `stock: actualStock` (Stock Opname).
6. `server/src/controllers/inventory.controller.ts:483, 496` (`transferStock`): Asal `decrement: quantity`, Tujuan `increment: quantity`.
7. `server/src/controllers/order.controller.ts:380` (`checkoutOrder`): `stock: { decrement: item.quantity }`.

### 3.4 Evaluasi: Apakah `StockMovement` Merupakan Full Ledger?
* **Kesimpulan:** `StockMovement` saat ini masih berstatus **Operational Audit Log**, **bukan Accounting Double-Entry Inventory Ledger**.
* **Alasan Teknis:**
  1. `StockMovement` tidak mencatat `balanceBefore` maupun `balanceAfter`.
  2. `StockMovement` tidak mencatat nilai valuasi finansial (`costPrice` atau nilai total rupiah saat mutasi terjadi).
  3. Terdapat celah bypass di `assignProductsToOutlet` di mana stok diubah tanpa entri ledger.

---

## 4. Warehouse vs Outlet

### 4.1 Implementasi Aktual `Outlet.isWarehouse`
* **Klasifikasi:** `[EXISTING]` (Konsep dasar) & `[RISK]` (Logic coupling)
* **Temuan:** Gudang bukan merupakan entitas tabel terpisah (`Warehouse`), melainkan entitas `Outlet` dengan kolom boolean `isWarehouse: Boolean @default(false)`.
* **Evidence:**
  * `server/prisma/schema.prisma:222`:
    ```prisma
    isWarehouse Boolean @default(false) @map("is_warehouse")
    ```
  * `server/src/controllers/product.controller.ts:52-70`:
    ```typescript
    const currentOutlet = await prisma.outlet.findUnique({
      where: { id: targetOutletId },
      select: { id: true, isWarehouse: true, warehouseId: true, tenantId: true },
    });
    // Jika outlet adalah toko retail, cari gudang pusat terkait untuk menampilkan warehouseStock
    ```
* **Konsekuensi Arsitektur:**
  * **Sisi Positif:** Sangat hemat tabel. Alokasi stok, mutasi stok masuk, dan kartu stok gudang menggunakan tabel yang persis sama (`outlet_products` dan `stock_movements`).
  * **Sisi Negatif & Risiko:**
    1. Endpoint `order.controller.ts:checkoutOrder` **tidak memblokir transaksi penjualan pada outlet yang `isWarehouse: true`**. Jika kasir menembak API dengan ID gudang, order kasir di gudang tetap diproses. Pemblokiran hanya terjadi di level antarmuka UI.
    2. Model ini tidak memiliki struktur hierarki penyimpanan internal seperti:
       ```text
       Warehouse → Zone / Aisle → Rack → Bin
       ```
    3. Untuk kebutuhan pergudangan multi-tier atau retail besar, model flag boolean ini tidak memadai tanpa entitas Storage Location.

---

## 5. Current Order Domain & State Machine

### 5.1 Siklus Hidup Pesanan (Order Lifecycle)
* **Klasifikasi:** `[RISK]` (Tightly Coupled Lifecycle)
* **Temuan:** Model `Order` **tidak memiliki kolom `status` atau `orderStatus`**. Status yang ada hanyalah `paymentStatus: PaymentStatus`:
  * `enum PaymentStatus { PAID, CANCELLED, REFUNDED }`
* **Evidence:**
  * `server/prisma/schema.prisma:377-408`:
    ```prisma
    model Order {
      id             String        @id @default(uuid())
      invoiceNumber  String        @unique
      ...
      paymentStatus  PaymentStatus @default(PAID) @map("payment_status")
    }
    ```
  * `server/src/controllers/order.controller.ts:340`:
    ```typescript
    paymentStatus: PaymentStatus.PAID, // Hardcoded saat order dibuat!
    ```
* **Kesimpulan State Machine:**
  ```text
  [Checkout Request] ─── (Validasi Pembayaran Lunas) ───► [Order Created: PAID]
  ```
  Tidak ada status transisi seperti:
  * `DRAFT`
  * `PENDING_PAYMENT`
  * `PROCESSING_KITCHEN`
  * `READY`
  * `COMPLETED`

### 5.2 Hold Order: Mengapa Terpisah?
* **Temuan:** Pesanan yang ditunda (*parked/held order*) tidak menggunakan tabel `Order`, melainkan disimpan ke tabel terpisah `HoldOrder` (`server/prisma/schema.prisma:448`).
* **Karakteristik:** `HoldOrder` menyimpan keranjang belanja sebagai snapshot JSON mentah di kolom `cartItems: Json`. Hold order **tidak memotong stok, tidak memvalidasi stok, dan tidak membuat record `Order`**. Ketika dipanggil kembali oleh kasir, baris `HoldOrder` dihapus dari database.

---

## 6. Payment Domain

### 6.1 Pemisahan Order vs Payment
* **Klasifikasi:** `[PARTIAL]`
* **Temuan:** Secara skema database, `Payment` adalah entitas relasional terpisah (`1 Order : N Payment`), sehingga mendukung **Split Payment** (kombinasi Tunai dan QRIS pada satu struk belanja).
* **Evidence:**
  * `server/prisma/schema.prisma:431-444`:
    ```prisma
    model Payment {
      id            String          @id @default(uuid())
      orderId       String          @map("order_id")
      method        PaymentMethod   // CASH | QRIS
      amountPaid    Decimal         @db.Decimal(12, 2)
      changeGiven   Decimal         @default(0)
      qrisReference String?
      status        PaymentTxStatus @default(SUCCESS)
    }
    ```
* **Keterbatasan Arsitektur:**  
  Meskipun tabelnya terpisah, controller `order.controller.ts:checkoutOrder` mensyaratkan pembayaran **wajib lunas saat pembuatan Order**. Sistem tidak mengizinkan `POST /api/orders` tanpa menyertakan objek `payment` atau array `payments` yang totalnya `>= grandTotal`. Dengan demikian, domain Payment belum independen sebagai layanan settlement tersendiri.

---

## 7. Stock Deduction Lifecycle

### 7.1 Waktu Tepat Pengurangan Stok
* **Temuan:** Stok berkurang **pada saat transaksi pembayaran berhasil diverifikasi di dalam database transaction checkout** (`order.controller.ts:370-394`).
* **Trace:**
  ```text
  1. Tambah Produk ke Keranjang (Frontend)  ──► Stok TIDAK berkurang
  2. Tahan Pesanan / Hold Order (Frontend)   ──► Stok TIDAK berkurang
  3. Buka Modal Bayar (Frontend)             ──► Stok TIDAK berkurang
  4. Klik "Selesaikan Pembayaran"            ──► Request POST /api/orders/checkout
  5. Validasi Stok Server                    ──► Cek OutletProduct.stock >= qty
  6. Prisma Transaction Executed             ──► STOK BERKURANG (decrement) &
                                                 Kartu Stok SALE_OUT dibuat
  ```

### 7.2 Analisis Dampak Antar-Industri:

```text
[RETAIL]
Kasir Scan Barang ──► Bayar di Tempat ──► Stok Terpotong
(Sangat cocok dengan arsitektur saat ini)

[F&B RESTORAN]
Tamu Duduk ──► Pesan Makanan ──► Masuk Dapur ──► Makan ──► Bayar Nanti
(TIDAK BISA: Jika stok/bahan baru dipotong saat bayar, ada risiko bahan di dapur
sudah habis dipakai tetapi sistem tidak mencatat pemakaian saat masak!)

[SERVICES / BENGKEL / SALON]
Pelanggan Booking ──► Bayar DP ──► Pengerjaan Servis ──► Selesai & Pelunasan
(TIDAK BISA: Jika order langsung memotong stok di muka, sparepart fisik belum tentu
terpasang sebelum inspeksi mekanik selesai)
```

---

## 8. Order–Inventory Coupling

### 8.1 Tight Coupling di Kode Sumber
* **Evidence:** `server/src/controllers/order.controller.ts:371-394`:
  ```typescript
  // Di dalam prisma.$transaction checkoutOrder:
  for (const item of preparedOrderItems) {
    await tx.outletProduct.update({
      where: { outletId_productId: { outletId: targetOutletId!, productId: item.productId } },
      data: { stock: { decrement: item.quantity } },
    });

    await tx.stockMovement.create({
      data: {
        outletId: targetOutletId!,
        productId: item.productId,
        userId: cashierId,
        type: StockMovementType.SALE_OUT,
        quantity: -item.quantity,
        notes: `Penjualan kasir faktur: ${invoiceNumber}`,
      },
    });
  }
  ```
* **Analisis:**  
  `order.controller.ts` memanipulasi tabel inventori secara langsung. Order domain mengetahui tabel `outlet_products` dan `stock_movements`.
* **Arsitektur Target yang Direkomendasikan:**  
  Dekopling domain menggunakan *Domain Service Layer* atau *Event Pattern*:
  ```text
  Order Domain (Checkout / Order State Change)
          ↓ (Trigger Event / Service Call: emit 'OrderPlaced' atau deductStock())
  Inventory Domain (Inventory Service)
          ↓
  Stock Allocation / Deduct & Stock Ledger Entry
  ```

---

## 9. Multi-Tenant Isolation & Leakage Risk

### 9.1 Matriks Kepemilikan Tenant (Tenant Ownership Audit)

| Entitas | Relasi Tenant | Kolom Database | Tingkat Keamanan | Risiko Kebocoran Data (*Leak Risk*) |
| :--- | :--- | :--- | :---: | :--- |
| **Tenant** | Primary Root | `id` | Aman | Tidak ada |
| **PlatformUser**| Global SaaS | Tanpa `tenantId` | Aman | Mengelola seluruh tenant (Level 1) |
| **Outlet** | Langsung | `tenantId String?` | **RISK** | `Nullable` di DB. Filter bergantung pada `where: { tenantId }`. |
| **User** | Langsung | `tenantId String?` | **RISK** | `Nullable` di DB. Staf bisa tidak terikat tenant jika disengaja. |
| **Category** | Langsung | `tenantId String?` | **PARTIAL** | Unique constraint `@@unique([tenantId, name])`. |
| **Product** | Langsung | `tenantId String?` | **PARTIAL** | Unique constraint `@@unique([tenantId, barcode])` & SKU. |
| **OutletProduct**| Tidak Langsung | Via `outletId` | **RISK** | Tidak punya kolom `tenantId` langsung. Kebocoran outlet membocorkan stok. |
| **StockMovement**| Tidak Langsung | Via `outletId` | **RISK** | Tidak punya kolom `tenantId` langsung. Filter kartu stok via relasi `outlet`. |
| **Order** | Langsung | `tenantId String?` | **RISK** | `Nullable` di DB. Di `order.controller.ts:423`, jika `userTenantId` kosong, filter diabaikan! |
| **OrderItem** | Tidak Langsung | Via `orderId` | Aman | Terikat kuat ke parent Order (`Cascade`). |
| **Customer** | Langsung | `tenantId String?` | **PARTIAL** | Di controller diproteksi `if (!tenantId) return 400`. |
| **Shift** | Langsung | `tenantId String?` | **RISK** | `Nullable` di DB. |

### 9.2 Titik Lemah Context Resolver (`saas.middleware.ts`)
* **Evidence:** `server/src/middlewares/saas.middleware.ts:41-48`:
  ```typescript
  let resolvedTenantId =
    req.user?.tenantId ||
    (req.headers['x-tenant-id'] as string) ||
    (req.query.tenantId as string);

  if (!resolvedTenantId) {
    resolvedTenantId = await getDefaultTenantId(); // Fallback ke 'toko-maju-jaya'!
  }
  ```
* **Risiko:**  
  Jika sebuah request API tidak terautentikasi dengan benar, middleware menerima `x-tenant-id` dari header client atau bahkan query parameter yang bisa dimanipulasi oleh penyerang, atau jatuh ke tenant default.

---

## 10. Concurrency & Idempotency

### 10.1 Concurrency & Race Condition pada Stok
* **Skenario:**  
  * Produk X memiliki sisa stok = 1 di Cabang Menteng.
  * Kasir A dan Kasir B menekan tombol Bayar untuk 1 Produk X pada detik yang sama.
* **Analisis Eksekusi Kode:**
  1. Kasir A dan Kasir B mengeksekusi `order.controller.ts:218`:
     `const stock = p?.outletProducts[0]?.stock ?? 0;` (Keduanya membaca nilai 1).
  2. Keduanya lolos dari validasi `if (stock < item.quantity)`.
  3. Keduanya masuk ke `prisma.$transaction`.
  4. Transaksi Kasir A menjalankan: `stock: { decrement: 1 }` → Stok menjadi 0.
  5. Transaksi Kasir B menjalankan: `stock: { decrement: 1 }` → Stok menjadi **-1**!
* **Kesimpulan:**  
  **Sistem saat ini rentan terhadap Overselling (Stok Negatif)** karena validasi stok dilakukan di memori aplikasi di luar transaction update, dan database PostgreSQL tidak memiliki constraint `CHECK (stock >= 0)`.

### 10.2 Ketiadaan Idempotency Key
* **Skenario:** Jaringan internet toko mengalami timeout saat tombol "Bayar" diklik. Kasir menekan tombol "Bayar" untuk kedua kalinya.
* **Hasil Aktual:**  
  Server akan mengeksekusi dua kali request `POST /api/orders/checkout`. Akibatnya:
  * 2 Faktur Penjualan (`Order`) terbit dengan nomor berbeda.
  * 2 Pembayaran tercatat.
  * Stok produk terpotong dua kali.

---

## 11. F&B Compatibility Analysis

### 11.1 Pengujian Skenario Nyata: Menu "Es Kopi Susu"
Untuk menjual 1 Cup Es Kopi Susu, operasional kafe membutuhkan:
* 18 gram Biji Kopi Espresso
* 150 ml Susu Fresh Milk
* 15 gram Gula Aren cair
* 1 pcs Cup & Tutup

### 11.2 Evaluasi Kompatibilitas dengan Arsitektur Saat Ini:
1. **Apakah ada entitas Resep (Recipe / Bill of Materials)?**  
   `NOT IMPLEMENTED / NOT FOUND`. Tidak ada tabel yang menghubungkan 1 Menu Produk ke N Bahan Baku.
2. **Apakah ada kemampuan konversi satuan (Unit Conversion)?**  
   `NOT IMPLEMENTED / NOT FOUND`. Stok kopi disimpan dalam karung/kg, sedangkan pemakaian resep dalam gram. Sistem saat ini hanya mendukung single string `unit: "Pcs"` dan kuantitas integer `Int`.
3. **Hasil:**  
   Jika sistem dipaksakan untuk F&B saat ini tanpa refactoring, kasir hanya bisa menjual "Es Kopi Susu" sebagai produk jadi (stok cup kopi berkurang 1), sementara stok susu dan biji kopi di gudang tidak akan pernah berkurang secara otomatis.

---

## 12. Services Compatibility Analysis

### 12.1 Pengujian Skenario Nyata: "Car Wash Premium" / "Potong Rambut"
* **Kebutuhan Bisnis:**
  * Penjadwalan jam layanan (*Booking / Appointment Slot*).
  * Penugasan staf pengerjaan (*Stylist / Barber / Mechanic*).
  * Pembayaran uang muka (DP 50%) dan pelunasan setelah pengerjaan selesai.
  * Perhitungan komisi pegawai (misal: 20% dari nilai jasa untuk terapis).

### 12.2 Evaluasi Kompatibilitas dengan Arsitektur Saat Ini:
1. **Order Model:** Tidak bisa menampung status "Sedang Dikerjakan" atau pelunasan terpisah (harus langsung lunas).
2. **Komisi Staf:** Model `User` hanya memiliki role `ADMIN`, `SUPERVISOR`, `WAREHOUSE`, `CASHIER`. Tidak ada entitas komisi karyawan.
3. **Booking:** Tidak ada kalender atau slot waktu di database.

---

## 13. Variant vs Modifier vs Recipe Analysis

Untuk mencegah salah kaprah arsitektur (*architectural confusion*), berikut adalah pemisahan konsep yang tegas:

```text
┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐
│     PRODUCT VARIANT     │  │    PRODUCT MODIFIER     │  │      RECIPE / BOM       │
├─────────────────────────┤  ├─────────────────────────┤  ├─────────────────────────┤
│ • Matrix SKU terpisah   │  │ • Pilihan kustomisasi   │  │ • Bahan baku pembuatan  │
│ • Beda ukuran / warna   │  │ • Suhu: Panas / Dingin  │  │ • 18g Kopi, 150ml Susu  │
│ • Memiliki stok fisik   │  │ • Manis: Normal / Less  │  │ • Tidak dijual langsung │
│ • Contoh: Kaos Polos S, │  │ • Topping: +Boba (+3rb) │  │ • Dipotong di balik layar│
│   M, L, XL              │  │ • Bisa mengubah harga   │  │   saat menu disiapkan   │
└─────────────────────────┘  └─────────────────────────┘  └─────────────────────────┘
```

* **Kondisi Arsitektur Saat Ini:**  
  Ketiga konsep ini belum memiliki model relasional di database. Varian sama sekali belum ada, modifier terselip di dalam teks JSON deskripsi, dan resep belum tersedia.

---

## 14. Product vs Inventory Item (The Fundamental Separation)

Pemisahan arsitektur paling strategis untuk mengubah sistem ini menjadi platform multi-vertikal adalah **membedakan antara apa yang dijual dengan apa yang disimpan di gudang**:

```text
┌──────────────────────────────────────┐       ┌──────────────────────────────────────┐
│        PRODUCT (SELLABLE ITEM)       │       │            INVENTORY ITEM            │
├──────────────────────────────────────┤       ├──────────────────────────────────────┤
│ • Apa yang dilihat kasir & pelanggan │       │ • Apa yang dihitung di kartu stok    │
│ • Memiliki harga jual (Price)        │       │ • Memiliki harga modal (Cost/HPP)    │
│ • Barcode untuk pemindaian kasir     │       │ • Satuan dasar (Gram, ml, Pcs)       │
│ • Kategori menu / display            │       │ • Ambang batas minimum stok (Alert)  │
│ • Bisa berupa: Barang, Menu, Jasa    │       │ • Vendor / Supplier pemasok          │
└──────────────────────────────────────┘       └──────────────────────────────────────┘
                   │                                              ▲
                   │                                              │
                   └─────────────── [ LINKAGE ] ──────────────────┘
```

### Studi Kasus 3 Vertikal:

#### 1. Retail: Aqua 600ml
* **Product:** "Aqua 600ml" (Harga Jual: Rp 4.000)
* **Linkage:** 1 : 1 Direct Mapping.
* **Inventory Item:** "Aqua 600ml" (Stok terpotong 1 botol).

#### 2. F&B: Es Kopi Susu
* **Product:** "Es Kopi Susu" (Harga Jual: Rp 20.000)
* **Linkage:** 1 : N Recipe BOM Mapping.
* **Inventory Items Terpotong:**
  * Biji Kopi: -18 gram
  * Susu: -150 ml
  * Cup Plastik: -1 pcs

#### 3. Services: Car Wash Premium
* **Product:** "Paket Cuci Mobil Premium" (Harga Jual: Rp 50.000)
* **Linkage:** 1 : 0 (Pure Service) ATAU 1 : N Material Mapping.
* **Inventory Items:** Tidak ada stok jasa terpotong, HANYA memotong bahan pembantu (misal: Sabun Shampo Mobil: -50 ml, Wax: -20 gram).

---

## 15. Current Core vs Vertical Boundaries

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          WELL POS SAAS PLATFORM CORE                            │
│  [Tenant Management]   [Platform Users / Superadmin]   [Multi-Outlet / Branch]  │
│  [User & RBAC]         [Shift Management (X/Z Report)]  [Customer CRM Basic]     │
│  [Dynamic Tax & Fees]  [Cash & QRIS Payment Engine]     [Receipt PDF 58/80mm]   │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                 ┌───────────────────────┼───────────────────────┐
                 ▼                       ▼                       ▼
      ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
      │    RETAIL ENGINE    │ │     F&B ENGINE      │ │   SERVICES ENGINE   │
      ├─────────────────────┤ ├─────────────────────┤ ├─────────────────────┤
      │ • Barcode Scan [OK] │ │ • Table Layout [UI] │ │ • Appointments [GAP]│
      │ • SKU Catalog  [OK] │ │ • Hold Meja    [OK] │ │ • Technician    [GAP]│
      │ • Central WH   [OK] │ │ • Modifiers    [PT] │ │ • Commissions   [GAP]│
      │ • Transfer Stk [OK] │ │ • KDS Dapur    [GAP]│ │ • Work Orders   [GAP]│
      │ • Stock Opname [OK] │ │ • Recipe BOM   [GAP]│ │ • Time Slots    [GAP]│
      │ • 1:1 Stock    [OK] │ │ • Split Bill   [GAP]│ │ • Material Usage[GAP]│
      └─────────────────────┘ └─────────────────────┘ └─────────────────────┘
        [Status: ~90% Ready]    [Status: ~25% Ready]    [Status: ~10% Ready]
```

---

## 16. Proposed Target Conceptual Domain Model

*(Conceptual architecture only — no Prisma code modification)*

```text
TENANT (Organization Boundary)
  │
  ├── PLATFORM SUBSCRIPTION (Plan, Invoice, License Status)
  ├── USERS (Roles: Admin, Supervisor, Cashier, Warehouse, Staff/Technician)
  ├── OUTLETS (Store Locations & Warehouses)
  ├── CUSTOMERS (CRM, Member, Loyalty)
  │
  ├── CATALOG DOMAIN (Sellable Items)
  │     ├── Categories
  │     ├── Products (Name, Display, Unit Price, Type: RETAIL | FNB | SERVICE)
  │     ├── Product Variants (Size, Color, Variant SKU)
  │     └── Product Modifiers (Options, Add-ons, Extra Price)
  │
  ├── INVENTORY DOMAIN (Stock Keeping)
  │     ├── Inventory Items (Raw Materials & Finished Goods, Cost Price, Base Unit)
  │     ├── Stock Balances (Per Outlet, Per Item)
  │     ├── Stock Ledger (Double-entry movement with Balance After & Cost Snapshot)
  │     ├── Stock Transfers & Stock Opname
  │     └── Recipes / Bill of Materials (ProductVariant ──► N InventoryItems)
  │
  ├── SALES & ORDER DOMAIN (Transaction Processing)
  │     ├── Orders (State: DRAFT -> OPEN/PENDING -> COMPLETED -> CANCELLED/VOID)
  │     ├── Order Items (Snapshot Price, Snapshot Cost, Selected Modifiers)
  │     ├── Order Channels (Dine In, Takeaway, Delivery, Online)
  │     └── Payments (Settlement: Cash, QRIS, Card, Multi-tender, Refund)
  │
  └── VERTICAL PLUGINS (Optional Modules per Business Type)
        ├── F&B: Dining Tables, Table Sessions, Kitchen Display Tickets
        └── SERVICES: Appointments, Service Work Orders, Employee Commission Logs
```

---

## 17. Recommended Domain Boundaries

### Core Platform Domain (Wajib bagi Seluruh Tenant)
* Tenant & Subscription Management
* User Identity & Branch Assignment
* Sesi Kasir & Shift Cash Balancing
* Customer CRM
* Engine Transaksi Penjualan Dasar (Order & Payment)
* Pelaporan Finansial

### Inventory Engine Domain (Core Reusable Engine)
* Master Inventory Items & Satuan Dasar (Base Unit)
* Gudang & Saldo Stok Cabang
* Double-entry Stock Ledger
* Mutasi Transfer & Penyesuaian Fisik

### Vertical Extensions (Modul Terisolasi)
* **Retail Extension:** Pemindai Barcode, Matrix Varian SKU, Cetak Label Barcode.
* **F&B Extension:** Denah Meja & Meja Aktif, Tiket Dapur (KDS), Resep Pemotongan Bahan Baku.
* **Services Extension:** Kalender Booking, Formulir SPK Pengerjaan Servis, Pelacak Komisi Staf.

---

## 18. Pragmatic Migration Strategy

Karena sistem saat ini sudah sekitar 70% matang dan beroperasi dengan baik untuk retail, **dilarang melakukan *full rewrite***. Migrasi harus dilakukan secara bertahap (*incremental strangler pattern*):

```text
Tahap 1: Hardening & Keamanan Core (Tidak Mengubah Alur Bisnis)
    ├── Pasang Idempotency Key pada Checkout
    ├── Kunci Validasi Concurrency Stok (Cegah Stok Minus)
    └── Perketat Tenant Isolation (Wajibkan tenantId NOT NULL pada tabel operasional)
    
Tahap 2: Dekopling Order State Machine & Pembayaran
    ├── Tambahkan status pada Order (DRAFT, COMPLETED, VOID)
    ├── Pisahkan pembuatan Order dari kewajiban langsung bayar lunas
    └── Sediakan endpoint pelunasan terpisah (Membuka jalan untuk F&B dan DP Jasa)

Tahap 3: Pemisahan Product & Relasi Varian/Modifier Formal
    ├── Buat tabel relasional resmi untuk ProductModifier (Hapus trik JSON description)
    └── Buat tabel relasional ProductVariant untuk SKU Matrix

Tahap 4: Penguatan Inventory Engine & Konversi Satuan
    ├── Ubah quantity/stock menjadi Decimal(12, 3) untuk mendukung Gram / Liter
    ├── Tambahkan balanceAfter pada kartu stok StockMovement
    └── Implementasikan tabel Recipe (BOM) untuk pemotongan bahan baku F&B

Tahap 5: Peluncuran Modul Vertikal F&B & Services
    ├── Modul F&B: Table Floor Plan & Kitchen Display System
    └── Modul Services: Booking Calendar & Komisi Karyawan
```

---

## 19. Architectural Risks Summary

1. **Risiko Integritas Stok (Race Condition):**  
   Pemeriksaan stok di luar transaksi Prisma memungkinkan terjadinya stok negatif ketika dua kasir melakukan checkout produk yang sama secara simultan.
2. **Risiko Kebocoran Data Antar-Tenant (Data Leak):**  
   Kolom `tenantId` yang nullable pada tabel operasional dan ketiadaan Prisma extension untuk isolasi otomatis menimbulkan risiko human-error di mana developer baru lupa memfilter `where: { tenantId }`.
3. **Risiko Kerapuhan Skema Modifiers:**  
   Penyimpanan opsi kustomisasi produk di string `Product.description` merupakan *technical debt* yang akan pecah saat sistem mencoba melakukan kalkulasi HPP atau pengurangan stok bahan baku otomatis.
4. **Ketiadaan Mekanisme Void & Refund:**  
   Tidak adanya fitur pembatalan transaksi resmi membuat kartu stok dan laporan kasir tidak dapat dikoreksi secara akuntabel jika kasir salah menginput transaksi.

---

## 20. Open Questions (Business & Technical)

### Technical Questions:
1. Apakah sistem akan mendukung transaksi offline (*Offline-First PWA / Local SQLite Sync*) jika koneksi internet toko terputus saat jam sibuk kasir?
2. Apakah struktur database akan tetap dipertahankan pada model *Single Database - Shared Schema* dengan penguatan Row-Level Security, atau ada rencana migrasi ke *Separate Schema per Tenant*?

### Business / Product Questions:
1. Di antara **F&B** (Resto/Kafe) dan **Services** (Salon/Bengkel/Klinik), segmen mana yang menjadi prioritas komersial Well POS dalam 3–6 bulan ke depan?
2. Bagaimana model penetapan harga SaaS: Apakah modul F&B (Meja & Resep) dan modul Jasa (Booking & Komisi) akan dijual sebagai biaya lisensi tambahan (*Add-on Subscription*), atau sudah termasuk dalam paket Pro?

---

## 21. Recommended Next Steps

1. **Langkah 1 (Audit Data Sealing):** Memperbaiki inkonsistensi pencatatan kartu stok pada fungsi `assignProductsToOutlet` dan mengunci isolasi `tenantId`.
2. **Langkah 2 (Desain Spesifikasi Domain):** Menyusun dokumen spesifikasi arsitektur data (*Data Architecture RFC*) untuk:
   * Pemisahan `Product` vs `InventoryItem`
   * Relasi formal `Recipe` (BOM) & konversi satuan desimal
   * Siklus hidup `Order` multi-status (*Open Bill*)
3. **Langkah 3 (Review Pemangku Kepentingan):** Memvalidasi prioritas modul vertikal bersama tim produk sebelum memulai refactoring bertahap.
