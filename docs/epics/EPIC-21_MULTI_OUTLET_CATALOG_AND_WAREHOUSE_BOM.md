# EPIC-21: Multi-Outlet Catalog Allocation, Scoped Menus & Dynamic Warehouse Backflush BOM Routing

## 📌 Metadata & Status
- **Status**: COMPLETED ✅ (Fase 1 s.d 4 Selesai 100%)
- **Tanggal Mulai**: 25 September 2026
- **Terkait Modul**: Catalog, Inventory, Warehouse, Backoffice Multi-Store Management, POS Checkout
- **Driver Permintaan**: Tenant owner memiliki multi-outlet toko dengan unit bisnis berbeda (misal: Ura Coffee Kemang, Ura Bakery Tebet, Ura Fried Chicken Pancoran). Toko hanya boleh menampilkan menu, kategori, dan stok milik toko tersebut, dengan kemampuan memotong bahan baku secara otomatis (backflush) ke master gudang tenant yang ditunjuk secara fleksibel.

---

## 🎯 4 Fase Pengembangan Roadmap

### Fase 1: Isolasi Menu & Kategori per Outlet Toko (COMPLETED ✅)
1. **Model Relasi Database**:
   - Dibuat tabel `outlet_products` (`id`, `tenant_id`, `outlet_id`, `product_id`, `is_available`, `price_override`, `created_at`, `updated_at`).
   - Indeks unik pada `(outlet_id, product_id)`.
2. **Read Adapter Scoping**:
   - `catalog.read_adapter.ts`:
     - `getProducts`: Memfilter produk menggunakan `EXISTS (SELECT 1 FROM outlet_products op WHERE op.product_id = p.id AND op.outlet_id = $outletId AND op.is_available = true)`.
     - `getCategories`: Memfilter kategori dengan parameter `outletId` sehingga hanya kategori yang memiliki produk aktif di outlet tersebut yang ditampilkan di tab navigasi.
3. **Product Controller**:
   - `createProduct`: Otomatis mengaitkan produk baru ke toko aktif pembuatnya via `outlet_products`.
   - `getAvailableProductsForOutlet`: Mengambil daftar produk master tenant yang belum dialokasikan ke toko aktif.
   - `assignProductsToOutlet`: Mengalokasikan produk master terpilih ke toko aktif dengan override harga opsional.
4. **UI Backoffice**:
   - Halaman `ProductsView.tsx` dilengkapi tombol *"Ambil dari Master Katalog"* (`AssignCatalogProductModal.tsx`).
   - Setiap pergantian outlet toko aktif di switcher header Backoffice langsung menyegarkan menu & tab kategori sesuai toko tersebut.

### Fase 2: Isolasi Bahan Baku & Resep BOM Toko (COMPLETED ✅)
1. **Resep BOM Scoping (`recipe.controller.ts:getRecipes`)**:
   - Menyaring `GET /api/recipes?outletId=...` sehingga saat toko aktif dipilih, daftar resep yang muncul hanya resep dari menu yang aktif dijual di toko tersebut (`productVariant.product.outletProducts.some(...)`).
2. **Bahan Baku Mentah Scoping (`recipe.controller.ts:getInventoryItemsForRecipe`)**:
   - Parameter `outletId` dan `scope` ('outlet' vs 'all').
   - Jika `scope === 'outlet'`, hanya menampilkan bahan baku mentah yang merupakan komponen resep menu aktif toko tersebut atau yang memiliki saldo fisik di toko tersebut.
   - Response diperkaya dengan metadata logistik: `warehouseStock`, `warehouseId`, `warehouseName`, dan `supplySource` ('WAREHOUSE' vs 'OUTLET_LOCAL').
3. **UI Resep & Inventori Scoped**:
   - `RecipesView.tsx`: Filter resep & bahan baku per toko aktif dengan toggle instan *"Bahan Toko"* vs *"Semua Master"*.
   - `InventoryView.tsx`: Tab Bahan Baku menampilkan kolom baru *"Stok Gudang Pasokan"* (lengkap dengan nama gudang pasokan) dan tombol toggle *"Bahan Toko Ini"* vs *"Semua Master Bahan"*.
4. **UI Pemilihan Sumber Pasokan Toko (`OutletsView.tsx`)**:
   - Dropdown *"Gudang Sumber Pasokan (Backflush Warehouse)"* pada Modal Tambah & Edit Toko.
   - Kartu outlet menampilkan status pasokan: `🏭 Suplai: [Nama Gudang] (Auto-Backflush)` atau `Stok Mandiri (Lokal)`.
5. **Seeder Realistis Ura Corporation**:
   - Dibuat `Gudang Logistik Pusat Ura` (`WH-01`).
   - Ketiga toko (`OUT-01`, `OUT-02`, `OUT-03`) ditautkan ke Gudang Pusat via `warehouseId`.
   - 14 item bahan baku terisolasi per jenis gerai dengan resep BOM lengkap.

### Fase 3: Dynamic Warehouse Routing & Auto-Backflushing (COMPLETED ✅)
- **Mesin Backflush Cerdas**: `SalesDualWriteService.processCheckout` di `pos_apps/server/src/services/dual_write/sales.dual_write.service.ts`:
  - Mendeteksi relasi `outlet.warehouseId`. Jika toko disuplai oleh gudang, sistem menyelesaikan `warehouseStorageLocationId` (`type: WAREHOUSE`).
  - Pemotongan bahan baku resep BOM (`targetRawLocId`) otomatis diarahkan ke gudang pasokan tersebut secara atomik dalam 1 database transaction (ACID).
  - Validasi stok negatif kontekstual diperiksa pada storage location gudang terkait.
  - Buku besar kartu stok (`inventory_ledgers`) otomatis mencatat mutasi pengeluaran barang (`SALE`, `ORDER`) di gudang terkait dengan catatan audit: `"BOM Resep: [Menu] (x) via Kasir [Toko] disuplai oleh [Gudang]"`.
- **Hasil Pengujian Simulasi (`test_fase3_checkout.ts`)**:
  - Penjualan 2 cup *Kopi Susu Aren Ura* di kasir Kemang otomatis memotong saldo bahan baku di *Gudang Logistik Pusat Ura* (Biji Kopi -36g, Susu -300ml, Gula Aren -50ml, Cup -2pcs, Sedotan -2pcs).
  - 5 mutasi kartu stok tercatat di Gudang Pusat dengan status SUCCESS.

### Fase 4: Multi-Warehouse Visibility & Stock Allocation Dashboard (COMPLETED ✅)
- **Visibilitas Multi-Gudang Terpadu (`InventoryView.tsx`)**:
  - Tab "Kelola Gudang & Stok Master" mengkalkulasi secara paralel data persediaan bahan baku dan produk retail per gudang (SKU Aktif, Fisik Unit, Nilai Total Aset).
  - Penambahan tombol dan dialog interaktif **"📋 Pantau & Alokasikan Stok Bahan Baku"**:
    - Menampilkan modal detail seluruh bahan baku di gudang tersebut (Kode, Nama, Sisa Stok Fisik, Satuan Kanonikal, Rata-rata Biaya/HPP, Nilai Aset).
    - Dilengkapi pencarian instan dan tombol cepat **"⇄ Alokasikan"** per baris item.
- **Universal Stock Allocation & Transfer Engine (`StockTransferModal.tsx` & Backend)**:
  - Dukungan dua moda transfer: **"🌿 Bahan Baku / Resep BOM"** dan **"📦 Produk Jadi Retail"**.
  - Deteksi otomatis: Jika lokasi asal adalah Gudang (`isWarehouse: true`), sistem langsung memprioritaskan moda Bahan Baku dengan satuan kanonikal (KG, GRAM, LITER, ML, PCS).
  - Backend `transferStock` (`inventory.controller.ts` & `inventory.dual_write.service.ts`) mendukung `inventoryItemId` maupun `productId` dengan mekanisme *row-level locking* `FOR UPDATE` yang mencegah *deadlock* dan konflik index unik PostgreSQL.
- **Hasil Pengujian Simulasi Transfer (`test_fase4_transfer.ts`)**:
  - Alokasi transfer 5.000 GRAM *Biji Kopi Espresso Blend* dari `Gudang Logistik Pusat Ura` ke `Ura Coffee - Kemang`:
    - Stok Gudang: 49.964g ➔ 44.964g (Terpotong -5.000g, tercatat `TRANSFER_OUT`).
    - Stok Toko Kemang: 2.500g ➔ 7.500g (Bertambah +5.000g, tercatat `TRANSFER_IN`).
    - Mutasi kartu stok tercatat rapi di kedua lokasi secara atomik.

---

## 🧪 Hasil Verifikasi & Testing Sandbox (Fase 1, 2, 3, & 4)
- **Tenant**: `Ura Corporation` (`ura-corporation`)
  - **Ura Coffee - Kemang**:
    - Menu: 1 produk (`Kopi Susu Aren Ura`).
    - Resep BOM: 1 resep (`Regular 16oz`, 5 komponen bahan: Biji Kopi, Susu, Gula Aren, Cup, Sedotan).
    - Bahan Baku Toko: 5 bahan spesifik kopi (Bahan bakery & fried chicken **tidak muncul**).
    - Pasokan: `Gudang Logistik Pusat Ura` (Stok gudang terpantau live).
  - **Ura Bakery - Tebet**:
    - Menu: 1 produk (`Butter Croissant Warm`).
    - Resep BOM: 1 resep (`Pcs`, 4 komponen bahan: Tepung Terigu, French Butter, Ragi, Kantong Kertas).
    - Bahan Baku Toko: 4 bahan spesifik bakery.
  - **Ura Fried Chicken - Pancoran**:
    - Menu: 1 produk (`Paket Ura Fried Chicken 1`).
    - Resep BOM: 1 resep (`Paket Lengkap`, 5 komponen bahan: Ayam, Tepung Crispy, Minyak, Beras, Box).
    - Bahan Baku Toko: 5 bahan spesifik fried chicken.
- **Hasil Auto-Backflushing Transaksi Penjualan Kasir (Fase 3)**:
  - Transaksi Kasir Kemang (2 cup Kopi Susu Aren): Biji kopi (50.000g -> 49.964g), Susu (100.000ml -> 99.700ml), Aren (50.000ml -> 49.950ml), Cup (2.500 -> 2.498), Sedotan (5.000 -> 4.998).
  - Ledger Mutasi: 5 baris kartu stok tercatat di Gudang Pusat dengan keterangan audit lengkap.
- **Hasil Alokasi Transfer Stok Gudang ke Toko (Fase 4)**:
  - Transfer 5.000g Biji Kopi: Gudang (49.964g ➔ 44.964g), Toko Kemang (2.500g ➔ 7.500g).
  - Kartu Stok: 2 record mutasi (`TRANSFER_OUT` & `TRANSFER_IN`) tercatat secara atomik.
- **Verifikasi Build**:
  - `pos_apps/server`: TypeScript build exit code 0.
  - `pos_apps/client`: Vite build exit code 0.

---

## 🎨 Penyempurnaan UI/UX: Pemisahan Toko Penjualan vs Gudang di Header Backoffice
- **Latar Belakang**: Pengguna merasa rancu melihat Gudang Pasokan tercantum bersama Toko Penjualan di dropdown switcher header Backoffice, serta menu kasir/toko yang tidak relevan saat membuka gudang.
- **Implementasi (Mode Khusus Gudang / Dedicated Warehouse Mode)**:
  1. **Status Header Dinamis**: Ketika Gudang dipilih, tombol switcher menampilkan ikon `Warehouse` dan badge *"Mode Gudang"*. Tombol kanan header berganti menjadi `🏪 Beralih ke Toko Penjualan` (tombol kasir POS disembunyikan).
  2. **Sidebar Khusus Logistik**: Sidebar secara otomatis menyusut dan hanya menampilkan 4 domain logistik yang relevan:
     - *Logistik & Persediaan* (`inventory`, `stock_movements`)
     - *Pengadaan & Vendor* (`suppliers`)
     - *Formula & Standar* (`recipes`, `products`)
     - *Manajemen Gudang* (`staff_users`, `outlets`)
  3. **Penjaga Tab Otomatis**: Jika pengguna membuka gudang saat berada di tab operasional toko (seperti `pos`, `orders`, `reports`, `promotions`), sistem secara otomatis mengarahkan ke tab `inventory` (*Persediaan Stok Bahan*).
  4. **Jalur Cepat Kembali ke Toko**: Disediakan tombol pintas mencolok di header dan di banner atas sidebar untuk langsung kembali ke Toko Penjualan aktif.

