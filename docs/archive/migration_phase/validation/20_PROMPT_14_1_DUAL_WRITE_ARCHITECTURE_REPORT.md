# PROMPT 14.1 — DUAL-WRITE ARCHITECTURE & SERVICE BOUNDARY EVALUATION REPORT

**Document ID:** `VAL-PROMPT-14-1-DUAL-WRITE-ARCH-001`  
**Date:** 2026-09-21T03:13:00+07:00  
**Phase:** Target Schema Expand Phase — Dual-Write Architecture Design & Specification  
**Safety Boundary Status:** STRICTLY READ-ONLY ANALYSIS / ZERO CODE / ZERO DB MUTATIONS / APP OFFLINE  
**Authoritative Specification:** [`docs/architecture/05_DUAL_WRITE_ARCHITECTURE_SPECIFICATION.md`](file:///Users/dendyaditya/Projects/pos_project/docs/architecture/05_DUAL_WRITE_ARCHITECTURE_SPECIFICATION.md)  
**Target Database:** `pos_db` (`localhost:5432` — Pristine / Unmodified)  
**Prisma Runtime Status:** `@prisma/client` timestamp untouched (`Sep 15 13:20`)  
**Final Gate:** `READY FOR PROJECT OWNER REVIEW & DUAL-WRITE STRATEGY SELECTION`

---

## 1. EXECUTIVE SUMMARY

Sesuai dengan mandat resmi **PROMPT 14.1**, Antigravity telah menyelesaikan audit arsitektur mendalam terhadap seluruh kontroler backend aplikasi di `pos_apps/server/src/controllers/` dan menyusun dokumen spesifikasi arsitektur Dual-Write komprehensif pada file [`docs/architecture/05_DUAL_WRITE_ARCHITECTURE_SPECIFICATION.md`](file:///Users/dendyaditya/Projects/pos_project/docs/architecture/05_DUAL_WRITE_ARCHITECTURE_SPECIFICATION.md).

Seluruh kegiatan pada Prompt 14.1 strictly mematuhi batasan keamanan (*hard safety boundaries*):
- **Zero DDL & Zero DML:** Tidak ada query mutasi database yang dieksekusi terhadap `pos_db`.
- **Zero Prisma Generate:** Klien runtime aplikasi tetap utuh bertanggal `Sep 15 13:20`.
- **Zero Code Modification:** Tidak ada kontroler, routes, atau file aplikasi runtime yang diedit.
- **Application Quiescent:** Aplikasi tetap berstatus offline.

---

## 2. RINGKASAN AUDIT TITIK MUTASI KONTROLER (MUTATION INVENTORY)

Audit kode statis memetakan seluruh mutasi pada 5 area kontroler utama ke entitas skema target yang bersesuaian:

| Domain Kontroler | Rute & Operasi | Mutasi Skema Legacy | Entitas Skema Target Terkait | Aturan Transformasi & Pemetaan |
|---|---|---|---|---|
| **Katalog Produk** (`product.controller.ts`) | `POST /api/products` (Create) | `products`, `outlet_products`, `stock_movements` | `inventory_items`, `product_variants`, `inventory_balances`, `inventory_ledgers` | Deterministic UUIDv5 derivasi, default variant creation, UOM kanonikal, ledger opening receipt. |
| **Katalog Produk** (`product.controller.ts`) | `PUT /api/products/:id` (Update) | `products` | `inventory_items`, `product_variants` | Sinkronisasi nama, SKU, barcode, harga retail, dan average cost. |
| **Katalog Produk** (`product.controller.ts`) | `DELETE /api/products/:id` (Delete) | `products`, `outlet_products` | `product_variants`, `inventory_items` | Soft-delete status sinkronisasi (`is_active = false`). |
| **Kategori** (`category.controller.ts`) | `POST/PUT/DELETE /api/categories` | `categories` | `categories` | Shared table ber-tenant boundary, paritas 1:1. |
| **Persediaan** (`inventory.controller.ts`) | `POST /api/inventory/stock-in` | `outlet_products.stock += qty`, `stock_movements` | `inventory_balances`, `inventory_ledgers`, `inventory_items` | Mutasi `PURCHASE_RECEIPT`, kalkulasi `balance_before` & `balance_after`, penyesuaian `average_cost`. |
| **Persediaan** (`inventory.controller.ts`) | `POST /api/inventory/stock-out` | `outlet_products.stock -= qty`, `stock_movements` | `inventory_balances`, `inventory_ledgers` | Penegakan ADR-002 (Negative stock policy), mutasi `DAMAGE_DISPOSAL`. |
| **Persediaan** (`inventory.controller.ts`) | `POST /api/inventory/adjustment` | `outlet_products.stock = actual`, `stock_movements` | `inventory_balances`, `inventory_ledgers` | Stock opname kalibrasi saldo fisik dan pencatatan selisih di `inventory_ledgers`. |
| **Persediaan** (`inventory.controller.ts`) | `POST /api/inventory/transfer` | Pengurangan stok cabang asal & penambahan cabang tujuan | `inventory_balances`, `inventory_ledgers` (x2) | Mutasi atomik ganda: `TRANSFER_OUT` di cabang asal dan `TRANSFER_IN` di cabang tujuan. |
| **Penjualan & Kasir** (`order.controller.ts`) | `POST /api/orders/checkout` | `orders`, `order_items`, `payments`, `outlet_products.stock -= qty`, `stock_movements` | `orders`, `order_items.product_variant_id`, `payment_transactions`, `inventory_balances`, `inventory_ledgers` | Pengisian `product_variant_id`, pembuatan buku besar pembayaran `payment_transactions`, konsumsi persediaan dengan packaging multiplier (ADR-003). |
| **IAM / Staf** (`user.controller.ts`) | `POST /api/users` (Create) | `users` (name, email, pin, role, etc.) | `users` (Model B: `user_code`, `pin_hash`) | Alokasi `user_code` deterministik (`USR-KASIR...` / `USR-OWNER1`), hashing PIN ke Bcrypt (`$2a$`), OD-13.3-03 invariant (PIN-less `pin_hash = NULL`). |
| **IAM / Staf** (`user.controller.ts`) | `PUT /api/users/:id` (Update) | `users` | `users` | Sinkronisasi pembaruan PIN ke `pin_hash`. |
| **Outlet Cabang** (`outlet.controller.ts`) | `POST /api/outlets` (Create) | `outlets` | `storage_locations` | Pembuatan lokasi penyimpanan default (`STOREFRONT` / `WAREHOUSE`) terikat pada cabang baru. |

---

## 3. DESAIN LAPISAN LAYANAN TERPUSAT (CENTRALIZED DOMAIN SERVICES)

Mengikuti arahan arsitektur `docs/00_PROJECT_CONTEXT.md:440` dan `docs/decisions/ADR-005-services-module-boundary.md`, seluruh logika Dual-Write dirancang terpusat di `server/src/services/dual_write/`:

```text
server/src/services/dual_write/
├── index.ts                         # Export barrel & DI container
├── base.dual_write.service.ts       # Shared SQL helpers & UUIDv5 generator
├── catalog.dual_write.service.ts    # CatalogDualWriteService
├── inventory.dual_write.service.ts  # InventoryDualWriteService
├── sales.dual_write.service.ts      # SalesDualWriteService
├── user.dual_write.service.ts       # UserDualWriteService
├── location.dual_write.service.ts   # LocationDualWriteService
└── types.ts                         # Interface context & DTOs
```

### Keuntungan Pendekatan Terpusat:
1. **Pemisahan Tanggung Jawab yang Bersih:** Kontroler hanya berfokus pada validasi skema HTTP (Zod) dan penyusunan response JSON. Logika sinkronisasi data target terenkapsulasi penuh di dalam service.
2. **Kemudahan Pengujian Terisolasi:** Domain service dapat diuji secara unit test tanpa harus memicu middleware Express atau HTTP request mock.
3. **Pemberhentian Non-Destruktif saat Cutover:** Saat sistem siap untuk fase Cutover, kontroler cukup menghentikan pemanggilan blok mutasi legacy di dalam service tanpa perlu merombak ulang controller routing.

---

## 4. EVALUASI MATRIKS KONSISTENSI & PENANGANAN KEGAGALAN (TRADE-OFF ANALYSIS)

| Dimensi Evaluasi | Pola A: Synchronous Strict ACID | Pola B: Fail-Safe with Drift Outbox | Pola Bertingkat (Tiered Recommendation) |
|---|---|---|---|
| **Mekanisme Transaksi** | Transaksi tunggal PostgreSQL (`prisma.$transaction`) | Legacy commit duluan, kegagalan target dicatat ke outbox log | **Checkout:** Pola A + Fallback Drift Logger<br>**Admin/Catalog:** Murni Pola A |
| **Konsistensi Data** | **Strong (Zero Drift, 100% Paritas)** | Eventual (Risiko lag & diskrepansi sementara) | **Strong Consistency Utama** |
| **Ketersediaan Kasir (SLA)** | Jika target error, transaksi kasir gagal | Kasir tidak pernah terblokir | Kasir terlindungi 100% |
| **Kompleksitas Sistem** | **Rendah (Tanpa worker background)** | Tinggi (Perlu tabel outbox, replay worker, dead-letter queue) | Rendah ke Menengah |
| **Integritas Akuntansi & Finansial** | **Tinggi (Fail-closed)** | Rentan out-of-order execution pada stok | Tinggi |

### Rekomendasi Antigravity untuk Project Owner:
Kami merekomendasikan **Pola Bertingkat (Tiered Strategy)**:
1. **Domain Transaksi Kasir (`SalesDualWriteService`):** Gunakan **Pola A sebagai jalur utama**. Karena query target telah tervalidasi 100% deterministik pada Prompt 13.4, risiko kegagalan target hampir nol. Namun, lengkapi blok catch dengan *Emergency Drift Logger* agar jika terjadi kegagalan langka pada skema target, transaksi kasir tetap dapat diselesaikan dengan pencatatan diskrepansi untuk audit.
2. **Domain Master Data (`Catalog`, `Inventory Adjustment`, `User IAM`):** Wajib menggunakan **Pola A (Strict ACID)**. Pada modul backoffice/admin tidak ada tekanan antrean fisik pelanggan, sehingga kegagalan mutasi harus membatalkan transaksi seketika demi menjaga kebersihan data.

---

## 5. KONKURENSI STOK & MULTIPLIER (ADR-002 & ADR-003)

1. **Pencegahan Race Condition:**  
   Pengurangan saldo stok pada `inventory_balances` menggunakan mekanisme penguncian baris eksplisit (`SELECT ... FOR UPDATE` atau `UPDATE ... RETURNING`) di dalam transaksi aktif, menjamin kalkulasi `balance_before` dan `balance_after` pada `inventory_ledgers` selalu akurat dan berurutan secara matematis.
2. **Penegakan ADR-002 (Negative Stock Policy Hierarchy):**  
   Evaluasi hirarkis: `Tenant Policy -> Storage Location Override -> Inventory Item Override`. Pada vertikal Retail, stok negatif dilarang keras. Pada vertikal F&B (dapur/bar) atau item bertanda khusus, stok negatif ditoleransi sebagai pengecualian operasional dengan mencatat flag `is_negative_balance = true` di `inventory_ledgers`.
3. **Penegakan ADR-003 (Commercial Packaging Multiplier):**  
   Penjualan item kemasan grosir (misal: "Aqua Dus") otomatis mengonsumsi stok persediaan kanonikal sebesar $\text{Order Quantity} \times \text{inventoryQuantityMultiplier}$ (misal: $1 \times 24 = 24\text{ botol}$), memisahkan satuan jual dari satuan buku besar inventori.

---

## 6. EVALUASI TEKNOLOGI DATA ACCESS: PARAMETERIZED RAW SQL

Evaluasi terhadap metode akses data skema target selama masa transisi menyimpulkan:
- **Secondary Prisma Client (@prisma/client-target):** **TIDAK DIREKOMENDASIKAN** untuk fase ini karena tidak dapat bergabung ke dalam transaksi interaktif PostgreSQL (`tx`) yang sama dengan klien primary, merusak jaminan atomisitas rollback.
- **Parameterized Raw SQL ($executeRawUnsafe / $queryRawUnsafe):** **DIREKOMENDASIKAN 100%**. Metode ini telah terbukti sangat andal pada Prompt 13.3B dan 13.4, kebal terhadap SQL injection karena menggunakan parameter binding (`$1, $2, ...`), dapat berjalan langsung di dalam transaksi `tx`, dan sama sekali tidak memerlukan `prisma generate` yang berisiko merusak klien runtime aplikasi eksisting.

---

## 7. GUARDRAIL COMPLIANCE MATRIX

| Guardrail / Batasan Keamanan | Status Kepatuhan | Bukti Telemetri / Audit |
|---|---|---|
| **Zero DDL on `pos_db`** | **TERPENUHI (100%)** | Tidak ada DDL yang dijalankan. |
| **Zero DML on `pos_db`** | **TERPENUHI (100%)** | Tidak ada baris yang termutasi pada Prompt 14.1. |
| **Zero Prisma Generate** | **TERPENUHI (100%)** | Klien runtime `@prisma/client/index.js` tetap bertanggal `Sep 15 13:20`. |
| **Zero Code Changes in Controllers** | **TERPENUHI (100%)** | Seluruh controller runtime tetap steril dan tidak dimodifikasi. |
| **Application Quiescent** | **TERPENUHI (100%)** | Server aplikasi tetap offline. |
| **Zero Plaintext Secrets Exposure** | **TERPENUHI (100%)** | Lolos scan keamanan statis tanpa eksposur PIN plaintext. |

---

## 8. FINAL GATE DECLARATION

```text
================================================================================
FINAL GATE: READY FOR PROJECT OWNER REVIEW & DUAL-WRITE STRATEGY SELECTION
================================================================================
```

Spesifikasi arsitektur Dual-Write telah selesai dirancang dan didokumentasikan secara lengkap. Antigravity telah menghentikan eksekusi dan siap menunggu review, audit, serta pemilihan keputusan strategi konsistensi dari Project Owner sebelum melangkah ke implementasi kode pada Prompt 14.2.
