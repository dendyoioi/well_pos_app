# ADR-001 — Tenant Boundary Enforcement

## Status

APPROVED — OWNER DECISION RECORDED

## Context

Platform Well POS sedang berevolusi dari sistem POS retail tunggal menjadi sistem Multi-Tenant Software-as-a-Service (SaaS) yang melayani ratusan hingga ribuan penyewa (*tenants*) dalam satu basis data terpadu (*Shared Database, Shared Schema*).

Berdasarkan audit skema Prisma eksisting (`schema.prisma`), ditemukan bahwa kolom `tenantId` pada sejumlah entitas merchant bernilai *nullable* (seperti pada `Outlet`, `User`, `Category`, `Product`, `Order`, `Shift`). Selain itu, middleware `saas.middleware.ts` memiliki celah *fallback* statis string `'toko-maju-jaya'` jika header `x-tenant-id` tidak dikirim.

Lebih jauh lagi, laporan konsistensi skema (`05_SCHEMA_CONSISTENCY_VALIDATION.md`, temuan C-01 dan C-04) mengungkap bahwa entitas anak seperti `OrderItem`, `RecipeItem`, `ModifierItem`, dan `ModifierRecipeEffect` tidak memiliki kolom `tenantId` mandiri, dan relasi foreign key-nya ke entitas induk maupun entitas lain (misalnya `inventoryItemId`) hanya mengandalkan pencocokan UUID global tunggal tanpa memvalidasi kepemilikan tenant.

## Problem

Bagaimana kepemilikan tenant (*tenant ownership*) harus ditegakkan pada entitas anak operasional dan bagaimana mencegah relasi foreign key silang antar-tenant (*cross-tenant foreign-key reference*) agar tidak terjadi kebocoran data (*data leakage*) atau manipulasi inventori antar-penyewa?

Secara teknis, terdapat tiga lapisan pertahanan yang dievaluasi:
1. **Application-level tenant validation:** Pengecekan di layer controller/service kode Node.js/Express.
2. **Database-level tenant integrity:** Constraint relational (Foreign Key, Unique Composite, NOT NULL) pada PostgreSQL.
3. **Database-level Row-Level Security (RLS):** Kebijakan isolasi pada level kernel PostgreSQL menggunakan session variables.

Kelemahan kritis: Penambahan kolom `tenantId` saja tidak otomatis mencegah record milik Tenant A mereferensikan parent/resource milik Tenant B jika foreign key hanya mencocokkan UUID secara parsial.

## Decision Drivers

1. **Security & Absolute Data Isolation:** Menjamin operational data tidak pernah bocor atau tertukar lintas tenant.
2. **Eliminasi Fallback Statis:** Membuang total perilaku default tenant yang membahayakan keamanan.
3. **Prisma ORM Compatibility:** Memastikan solusi dapat dimodelkan dan dimigrasikan dengan andal melalui Prisma tanpa dependensi rapuh.
4. **Performa Query & Reporting:** Menghindari keharusan melakukan multi-table JOIN hanya untuk memfilter hak akses tenant pada tabel transaksi berukuran jutaan baris.
5. **Pragmatisme Implementasi Phase 1:** Membedakan antara kebutuhan fondasi rilis awal yang wajib ada versus mekanisme *defense-in-depth* lanjutan.

## Options Considered

### Option A: Parent Inheritance Only (Relying on Parent Relational Chain)
* **Description:** Entitas anak tidak diberi kolom `tenantId`. Kepemilikan tenant diwarisi dari entitas induk (`Order`, `Recipe`, `ModifierGroup`).
* **Advantages:** Skema normal murni, hemat sedikit storage.
* **Disadvantages:** Kueri reporting sangat lambat (wajib JOIN bertingkat), zero database defense, risiko tinggi kelalaian developer saat menulis kueri langsung.
* **Impact:** Ditolak karena membuka celah keamanan struktural.

### Option B: Direct `tenantId NOT NULL` on Operational Child Tables + Service-Layer Enforcement
* **Description:** Setiap tabel operasional anak didenormalisasi dengan menyertakan kolom `tenantId UUID NOT NULL`. Penegakan integritas relasi foreign key silang (cross-tenant reference validation) dilakukan secara wajib di domain/service layer sebelum transaksi di-commit ke database.
* **Advantages:** 100% kompatibel dengan Prisma, performa kueri analitik dan indeks komposit sangat cepat, menyiapkan partisi tabel masa depan.
* **Disadvantages:** Penegakan anti-cross-reference tetap membutuhkan disiplin ketat pada layer service.
* **Impact:** Fondasi terbaik untuk Phase 1.

### Option C: Direct `tenantId` + Composite Foreign Keys on Database Level
* **Description:** Pasangan komposit `(tenant_id, foreign_id)` ditegakkan langsung via SQL foreign key constraint di PostgreSQL.
* **Advantages:** Enforced mutlak di level DDL database.
* **Disadvantages:** Prisma ORM mewajibkan `@unique` buatan pada target referensi, memicu duplikasi constraint dan friksi tinggi pada Prisma migration engine.
* **Impact:** Terlalu kaku untuk tahap evolusi saat ini.

### Option D: Combination of Option B + PostgreSQL Row-Level Security (RLS) as Defense-in-Depth
* **Description:** Menggabungkan Option B dengan native PostgreSQL RLS via `SET LOCAL app.current_tenant_id`.
* **Advantages:** Perlindungan lapis ganda di tingkat kernel database.
* **Disadvantages:** Kompleksitas koneksi pooling (PgBouncer) dan penanganan background jobs.
* **Impact:** Solusi masa depan yang sangat baik, namun berisiko menunda rilis jika diwajibkan di Phase 1.

## Decision

**Project Owner Decision Recorded: ADOPT OPTION B DENGAN PERSIAPAN OPTION D UNTUK FASE LANJUTAN.**

Secara eksplisit diputuskan:
1. **Direct `tenantId NOT NULL`:** Diterapkan pada seluruh tabel anak operasional dan domain yang dimiliki tenant (`OrderItem`, `RecipeItem`, `ModifierGroup`, `ModifierItem`, `ModifierRecipeEffect`, `PaymentTransaction`, `Refund`, `RefundItem`, `InventoryBatch`, dll).
2. **Penghapusan Fallback Statis:** Seluruh kode fallback `'toko-maju-jaya'` pada `saas.middleware.ts` dihapus total. Request tanpa tenant context yang valid ditolak dengan HTTP 401/403.
3. **Backend Service-Layer Tenant Enforcement:** Penegakan batas tenant dikontrol di Application/Service Layer. Kolom `tenantId` langsung saja TIDAK CUKUP; service layer **wajib memvalidasi secara eksplisit bahwa entitas yang direferensikan (misal `inventoryItemId` dalam resep) benar-benar dimiliki oleh tenant yang sama**.
4. **PostgreSQL RLS sebagai Defense-in-Depth Masa Depan:** Arsitektur dipersiapkan agar kompatibel dengan RLS, namun **RLS BUKAN prasyarat implementasi Phase 1**.

## Consequences

### Positive
* Menjamin tidak ada record anak yang "mengambang" tanpa kejelasan kepemilikan tenant.
* Kueri pelaporan kasir, ringkasan shift, dan audit stok dapat langsung memfilter `WHERE tenant_id = :tenantId` secara instan.
* Skema 100% kompatibel dengan Prisma ORM migration workflow.
* Menutup celah keamanan default tenant yang ada di kode saat ini.

### Negative
* Sedikit peningkatan ukuran disk akibat penambahan kolom `tenant_id` pada baris tabel transaksi berdensitas tinggi (`order_items`).
* Service layer wajib mengimplementasikan fungsi validasi cross-tenant sebelum menulis relasi.

### Risks
* Jika developer baru membuat endpoint tanpa melalui centralized service validator, risiko referensi silang dapat muncul kembali. (Mitigasi: Wajibkan Prisma Client Extension / Middleware guard).

## Impact on Existing POS

* **Middleware:** `saas.middleware.ts` dibersihkan dari fallback hardcoded.
* **Controllers:** Seluruh operasi insert pada entitas anak wajib menyertakan `tenantId` dari request context.

## Impact on Target Architecture

* Memantapkan prinsip *Explicit Tenant Boundary* di seluruh layer (skema database dan service layer).
* Menyelaraskan temuan C-01 dan C-04 dari laporan validasi konsistensi skema.

## Impact on Database Schema

* Seluruh model anak di skema Prisma target wajib memuat:
  ```prisma
  tenantId String @map("tenant_id")
  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  ```
* Indeks komposit tenant diterapkan pada tabel operasional: `@@index([tenantId, createdAt])`.

## Impact on Migration

* Migrasi Phase 0 wajib menyertakan script backfill data historis: mengisi nilai `tenant_id` pada tabel anak yang sudah ada sebelum mengaktifkan constraint `NOT NULL`.

## Open Questions / Open Implementation Details

* `[OPEN IMPLEMENTATION DETAIL]` Standarisasi mekanisme context propagation pada asynchronous background worker (apakah via job payload metadata atau context storage).
* `[OPEN IMPLEMENTATION DETAIL]` Desain spesifik Prisma Client Extension / Middleware untuk otomatis menginjeksi `where: { tenantId }` pada seluruh kueri query-builder.

## Owner Decision Required

*Status: Keputusan Project Owner telah dicatat dan disetujui (Decision A).*
