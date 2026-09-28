# EPIC-06: F&B MULTI-VERTICAL ENGINE (RECIPES / BOM, MODIFIERS & KITCHEN WORKFLOW)
## Ekstensi Vertikal Bisnis F&B (Kafe, Restoran, FnB) pada Platform Terpadu Well POS

**Epic ID**: `EPIC-06`  
**Status**: **COMPLETED / FULLY VERIFIED (100% DONE)**  
**Prioritas**: **P2 — HIGH (EXPANSION TO RESTAURANTS & CAFES)**  
**Target Komponen**: `pos_apps/server` & `pos_apps/client`  
**Dokumen Induk**: [`docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md`](file:///Users/dendyaditya/Projects/pos_project/docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md)  
**Dokumen Arsitektur Rujukan**: `docs/00_PROJECT_CONTEXT.md` (Section 4 & 5)  

---

### 1. DESKRIPSI & TUJUAN BISNIS
Pada bisnis F&B (kafe/restoran), produk komersial yang dijual (misal: *Es Kopi Susu Aren*) bukanlah barang persediaan fisik yang disimpan di rak seperti ritel, melainkan hasil olahan dari beberapa bahan baku (*raw ingredients*): biji kopi, susu UHT, sirup aren, cup plastik, dan sedotan.

Tujuan **EPIC-06** adalah:
1. Memungkinkan tenant F&B mengonfigurasi **Resep & Komposisi Bahan (*Bill of Materials / BOM*)** per varian produk.
2. Memotong stok bahan baku fisik (`inventory_items`) secara otomatis melalui tabel mutasi persediaan (`inventory_ledgers`) saat pesanan terjadi.
3. Mendukung **Group Modifiers / Topping / Add-ons** (misal: level gula, ekstra shot espresso, ganti susu oat).
4. Menyediakan alur pemisahan tiket pesanan kasir vs dapur/bar (*Kitchen Ticket Printing / Kitchen Display*).

---

### 2. STRUKTUR MODEL DATABASE TARGET
Skema basis data target 18 tabel Well POS telah siap dan terverifikasi secara penuh:
- `recipes` & `recipe_items`: Menghubungkan `product_variants` ke `inventory_items` dengan jumlah bahan baku (`quantity`) dan `cost_ratio`.
- `modifier_groups`, `modifier_items`, `product_modifier_groups`, & `modifier_recipe_effects`: Pilihan opsi kustom pesanan dengan penyesuaian harga (`price_adjustment`) dan penyesuaian bahan baku tambahan (`quantity_delta`).
- `orders` & `order_items`: Menyimpan `order_type` (`DINE_IN`, `TAKEAWAY`), `table_number`, `notes`, serta `modifiers_snapshot` (JSONB) sebagai riwayat pesanan yang tidak dapat berubah (*immutable*).

---

### 3. STATUS SPRINT TASK (100% COMPLETED)

- [x] **Task 6.1: Recipe Management API (CRUD & COGS Estimation)**
  - REST Controller: `recipe.controller.ts` & Routes: `recipe.routes.ts` (`/api/recipes`).
  - Endpoint: `GET /api/recipes`, `GET /api/recipes/variant/:variantId` (dengan kalkulasi estimasi HPP/COGS otomatis), `POST /api/recipes` (atomic BOM sync), `DELETE /api/recipes/:id`.
- [x] **Task 6.2: Modifier Groups & Custom Options API**
  - REST Controller: `modifier.controller.ts` & Routes: `modifier.routes.ts` (`/api/modifiers`).
  - Endpoint: `GET /api/modifiers`, `POST /api/modifiers` (mendukung `modifier_recipe_effects`), `POST /api/modifiers/link-product`, `DELETE /api/modifiers/:id`.
- [x] **Task 6.3: Automated Recipe Stock Deduction Engine**
  - Intersepsi Checkout pada `sales.dual_write.service.ts`:
    - Mengidentifikasi resep aktif per varian produk. Jika terdapat resep, bypass pemotongan barang jadi dan lakukan pemotongan pada tiap bahan baku di `inventory_balances` secara atomik dengan audit `inventory_ledgers` bertipe `SALE` dan referensi `ORDER`.
    - Mengidentifikasi efek modifikasi (`modifier_recipe_effects`) dan memotong/menyesuaikan persediaan bahan tambahan sesuai kuantitas pesanan.
    - Fallback ke pemotongan ritel standar untuk produk non-resep.
- [x] **Task 6.4: Table Management & Kitchen Order Ticket (KOT)**
  - Dukungan atribut `orderType` (`DINE_IN`, `TAKEAWAY`, `DELIVERY`), `tableNumber`, dan `notes` pada checkout.
  - Endpoint `GET /api/orders/:id/kitchen-ticket`: Mengembalikan tiket pesanan dapur dengan detail meja, nama produk, catatan pesanan khusus, dan snapshot modifier terpakai.
- [x] **Task 6.5: Automated Contract & Integration Verification**
  - Script pengujian: `server/src/migrations/contract/test_epic06_fnb_workflow.ts`.
  - Berhasil memvalidasi pemotongan stok bahan baku (kopi 72g & susu 360ml), pencatatan ledger, snapshot modifier, serta endpoint REST API dengan hasil 100% PASS.
- [x] **Task 6.6: Target Schema Contract Alignment for Product Edit & Modifiers Linking**
  - Mengatasi kendala edit produk saat menghubungkan modifier pada `ProductModal.tsx` & `product.controller.ts`.
  - Memperbarui query verifikasi barcode (`existingRows`) dan `prodRows` agar melakukan JOIN ke `product_variants` & `inventory_items` alih-alih merujuk ke kolom lama pada tabel `products`.
  - Melonggarkan skema validasi `linkProductModifierSchema` untuk mengizinkan array kosong `[]` (unlinking semua modifier dari produk).
  - Melindungi integritas validasi `updateProductSchema` dengan dukungan field opsional yang bersifat nullable (`description`, `imageUrl`, dll.).
