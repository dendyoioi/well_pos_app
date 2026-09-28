# PROMPT 15.2 — READ SURFACE INVENTORY & APPLICATION DEBT REMEDIATION (R-09)

## 0. CONTEXT & LIFECYCLE POSITION

**Migration Lifecycle State:**
```text
  [ EXPAND ]     ===>  COMPLETED (100% Schema Ready — Prompt 13.2)
  [ BACKFILL ]   ===>  COMPLETED (100% Historical Parity — Prompt 13.4)
  [ DUAL-WRITE ] ===>  COMPLETED (100% Live Parity Verified — OAUTH-14.4-01)
  [ STAGE 15.1 ] ===>  COMPLETED (Dual-Run Soak & Concurrency 100% Verified)
  [ STAGE 15.2 ] ===>  CURRENT PHASE: READ SURFACE INVENTORY & DEBT REMEDIATION (R-09)
  [ CUTOVER ]    ===>  PENDING (Target Phase 16)
  [ CONTRACT ]   ===>  PENDING (Target Phase 17)
```

### Pemberitahuan Pelaksanaan Stage 15.1:
Stage 15.1 (**Dual-Run Soak Testing & Concurrency Parity Audit**) telah berhasil dieksekusi dan diverifikasi pada basis data aktif `pos_db`:
- **Harness:** `pos_apps/server/src/migrations/dual_write/soak_concurrency_dual_run.ts`
- **Laporan Validasi:** `docs/validation/24_PROMPT_15_1_DUAL_RUN_STABILIZATION_REPORT.md`
- **Hasil:**
  - 15 transaksi paralel pada stok 10 unit memicu mutex row-locking `SELECT ... FOR UPDATE` (10 sukses, 5 ditolak terkendali sesuai ADR-002, 0 overselling).
  - Multi-item checkout split payment (Cash + QRIS), inter-outlet transfer (`transferStock`), dan opname adjustment terbukti 100% selaras.
  - Audit 14 suite rekonsiliasi membuktikan **100.00% paritas matematis (0 diskrepansi)** dengan latensi p95 sebesar 82.58 ms.

Kini sistem melangkah ke **STAGE 15.2: READ SURFACE INVENTORY & APPLICATION DEBT REMEDIATION (R-09)**.

---

## 1. OBJECTIVES

Antigravity (*Implementation Agent*) ditugaskan untuk menjalankan audit dan perbaikan teknis pada dua area kritis:

### 1.1 Remediasi Utang Aplikasi (Remediation of Cutover Debt R-09)
Sesuai temuan `docs/validation/09_MIGRATION_READINESS_REPORT.md` Section 7.2:
1. **Eliminasi Fallback Tenant Otomatis (`saas.middleware.ts:11-55`):**
   - Hapus fallback ke tenant default (`'toko-maju-jaya'` atau `prisma.tenant.findFirst()`).
   - Request yang tidak menyertakan identitas tenant yang valid (baik via JWT `req.user.tenantId`, header `x-tenant-id`, atau query param) wajib ditolak dengan **`401 Unauthorized`** (atau `400 Bad Request` jika dalam konteks endpoint publik tertentu).
2. **Eliminasi Kueri Cabang Global Tak-Terlingkup (`prisma.outlet.findFirst()`):**
   - Audit seluruh kontroler (misal: `order.controller.ts`, `product.controller.ts`, `shift.controller.ts`).
   - Hapus pemanggilan `prisma.outlet.findFirst()` tanpa filter `where: { tenantId }`. Seluruh resolusi cabang wajib terikat secara ketat pada `req.tenantId` aktif.

### 1.2 Audit Permukaan Baca (Read Surface Inventory)
Saat ini seluruh mutasi telah menulis ganda ke dua skema, namun endpoint pembacaan data (`GET`) masih membaca langsung dari tabel legacy (`products`, `outlet_products`, `orders`).
Lakukan inventarisasi dan audit terhadap seluruh endpoint pembacaan di `pos_apps/server/src/controllers/`:
- **Katalog:** `GET /api/products`, `GET /api/products/:id`, `GET /api/categories`
- **Persediaan:** `GET /api/inventory`, `GET /api/inventory/movements`, `GET /api/inventory/low-stock`
- **Penjualan:** `GET /api/orders`, `GET /api/orders/:id`
- **Laporan:** `GET /api/reports/sales`, `GET /api/reports/profit-loss`, `GET /api/reports/stock`

Untuk setiap endpoint:
- Dokumentasikan kueri legacy yang sedang aktif.
- Rancang padanan kueri target pembacaan (*Target Schema Query Mapping*) dari `product_variants`, `inventory_balances`, `inventory_items`, `payment_transactions`, dan `storage_locations`.
- Rancang antarmuka **Target Read Adapters** (misal di bawah `src/services/read_adapters/`) yang dapat diaktifkan menggunakan feature flag (`READ_FROM_TARGET=true`) saat Cutover (Fase 16) tanpa merusak routing controller eksisting.

---

## 2. HARD SAFETY BOUNDARIES

Selama Stage 15.2:
- **DILARANG:**
  - Melakukan operasi DDL destruktif (`DROP TABLE`, `DROP COLUMN`, `TRUNCATE`).
  - Menjalankan `npx prisma generate` yang menimpa `@prisma/client`.
  - Memutus atau menonaktifkan lapisan Dual-Write yang sedang aktif.
  - Mengubah logika bisnis kalkulasi laporan tanpa persetujuan Project Owner.
- **DIIZINKAN:**
  - Merefaktor `saas.middleware.ts` untuk menghapus fallback R-09 secara aman.
  - Memperbaiki kueri `prisma.outlet.findFirst()` agar selalu terlingkup `where: { tenantId }`.
  - Menulis dokumen audit permukaan baca dan rancangan adapter baca.
  - Menjalankan unit tests / endpoint tests untuk memverifikasi proteksi multi-tenant 401.

---

## 3. DELIVERABLES REQUIRED

1. **Kode Perbaikan Utang Aplikasi:**  
   Refaktor pada `pos_apps/server/src/middlewares/saas.middleware.ts` dan kontroler terkait untuk menutup kerentanan R-09.
2. **Dokumen Inventori & Desain Read Surface:**  
   `docs/architecture/06_READ_SURFACE_INVENTORY_AND_TARGET_ADAPTERS.md`
3. **Laporan Validasi Resmi:**  
   `docs/validation/25_PROMPT_15_2_READ_SURFACE_AND_DEBT_REMEDIATION_REPORT.md`

### Final Gate Declaration:
```text
FINAL GATE: STAGE 15.2 DEBT REMEDIATION & READ INVENTORY COMPLETED — READY FOR STAGE 15.3 CUTOVER RUNBOOK
```
