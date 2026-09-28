# ARCHITECTURE DECISION GATE REPORT
**Document Reference:** [`/docs/validation/06_ARCHITECTURE_DECISION_GATE_REPORT.md`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/docs/validation/06_ARCHITECTURE_DECISION_GATE_REPORT.md)  
**Classification:** ARCHITECTURE DECISION GATE REPORT (PRE-IMPLEMENTATION PHASE)  
**Target Milestone:** Database Architecture Sign-Off & Schema Revision Readiness  
**Author:** Principal Software Architect, Lead Database Architect & POS Domain Architect  
**Date:** September 19, 2026  
**Status:** GATE OPEN (Awaiting Project Owner Sign-Off)  

---

## 1. Executive Summary

Dokumen ini merupakan laporan resmi dari **Architecture Decision Gate (Gerbang Keputusan Arsitektur)** yang memproses seluruh temuan evaluasi kritis dari berkas validasi konsistensi skema sebelumnya (`05_SCHEMA_CONSISTENCY_VALIDATION.md`).

Sebagai tindak lanjut, telah dirumuskan **lima Architecture Decision Records (ADR)** formal yang diisolasi di dalam direktori kanonikal `/docs/decisions/`:
1. `ADR-001-tenant-boundary-enforcement.md` (Strategi Pengamanan Batas Data Multi-Tenant)
2. `ADR-002-negative-stock-policy.md` (Kebijakan Transaksi pada Saldo Persediaan Negatif)
3. `ADR-003-uom-vs-packaging.md` (Pemisahan Satuan Fisika UOM vs Kemasan Komersial Retail)
4. `ADR-004-inventory-batch-lot.md` (Pemodelan Nomor Batch & Tanggal Kadaluarsa FEFO)
5. `ADR-005-services-module-boundary.md` (Batas Domain & Kontrak Arsitektur Modul Jasa)

Seluruh ADR berstatus **`PROPOSED`** dan **TIDAK DISETUJUI SECARA SEPIHAK** oleh tim arsitek, melainkan disajikan secara objektif dan transparan beserta trade-off teknis, dampak operasional, dan konsekuensi migrasinya untuk diputuskan oleh **Project Owner**.

Implementasi kode aplikasi, perubahan skema Prisma riil di proyek, maupun eksekusi migrasi database tetap berada dalam kondisi **`BLOCKED`** hingga seluruh ADR disetujui dan draf skema basis data target (`04_TARGET_DATABASE_SCHEMA.md`) direvisi sesuai keputusan tersebut.

---

## 2. ADR Inventory

| ADR Identifier | Judul & Topik Keputusan | Status Dokumen | Rekomendasi Tim Arsitek | Owner Decision Required? |
| :--- | :--- | :---: | :--- | :---: |
| **ADR-001** | **Tenant Boundary Enforcement** | `PROPOSED` | **Option B (Direct `tenantId NOT NULL` pada seluruh tabel operasional anak)** pada Phase 1, dan evaluasi **Option D (PostgreSQL RLS)** pada Phase 2. | **YA (Wajib Disetujui)** |
| **ADR-002** | **Negative Stock Policy** | `PROPOSED` | **Option D (Granular Context-Driven):** Retail ketat non-negatif; Dapur F&B dan material servis toleran negatif dengan audit warning log. | **YA (Wajib Disetujui)** |
| **ADR-003** | **UOM vs Packaging Architecture** | `PROPOSED` | **Option B:** Satuan fisika murni dikelola `UnitOfMeasure`, sedangkan kemasan grosir/eceran retail menggunakan `inventoryQuantityMultiplier` pada `ProductVariant`. | **YA (Wajib Disetujui)** |
| **ADR-004** | **Inventory Batch / Lot & Expiry** | `PROPOSED` | **Pola Bertahap:** Catat batch & expiry di baris `InventoryLedger` pada Phase 1, hadirkan model formal `InventoryBatch` pada Phase 7 saat modul Farmasi/FMCG diluncurkan. | **YA (Wajib Disetujui)** |
| **ADR-005** | **Services Module Boundary** | `PROPOSED` | **Option B (Stable Contract Now, Deferred Features Later):** Tanamkan enum `SERVICE_LABOR` dan penugasan staf pada Core sekarang; tunda modul reservasi/work order ke Phase 7/9. | **YA (Wajib Disetujui)** |

---

## 3. Conflicts With Existing Architecture (`03_DATA_ARCHITECTURE_RFC.md`)

Berdasarkan formulasi kelima ADR, ditemukan beberapa hal yang perlu disinkronkan kembali pada dokumen RFC arsitektur data awal:

| ADR | Bagian RFC Terkait | Sifat Konflik / Ketidaksesuaian | Rekomendasi Revisi RFC |
| :--- | :--- | :--- | :--- |
| **ADR-001** | RFC Bab 16 (Multi-Tenant Data Ownership) | RFC Bab 16 menyarankan direct `tenantId` pada sebagian tabel namun diagram konseptual Bab 5 masih menggambarkan entitas anak (`RecipeItem`, `OrderItem`) mewarisi tenant via parent tanpa foreign key guard. | Perbarui diagram ERD Bab 5 RFC untuk secara eksplisit menampilkan atribut `tenantId` di seluruh entitas anak operasional. |
| **ADR-002** | RFC Bab 25 (Open Questions: Allow Negative Stock) | Masalah stok negatif pada RFC masih berstatus *Open Question* tanpa kepastian arsitektur pengerjaan. | RFC Bab 25 dapat diperbarui dengan merujuk pada konsensus ADR-002 (kebijakan berbasis konteks lokasi & vertikal). |
| **ADR-003** | RFC Bab 7 (Unit of Measure & Conversion) | RFC Bab 7 mencampuradukkan konversi matematis universal (Kg ke Gram) dengan kemasan komoditas dagang (Dus ke Botol) pada satu bab konversi UOM. | Klarifikasi Bab 7 RFC dengan membedakan *Physical UOM Math* dari *Commercial Packaging Multiplier*. |
| **ADR-004** | RFC Bab 18 (Retail Batch/Serial) | RFC Bab 18 menyebutkan pelacakan batch ditunda (*LATER*), namun tidak memberikan kepastian bagaimana nomor batch dicatat saat barang masuk PO. | Sinkronkan Bab 18 RFC dengan ADR-004: pencatatan batch diizinkan masuk ke `InventoryLedger` sebagai metadata transisi. |
| **ADR-005** | RFC Bab 3 & Bab 17 (Services Module) | RFC menetapkan Services sebagai salah satu dari 3 modul pilar, tetapi belum memisahkan antara kontrak skema transaksi dengan modul pengerjaan fisik. | Definisikan secara tegas bahwa kontrak transaksi komersial jasa didukung sejak awal melalui `ProductType: SERVICE_LABOR`. |

---

## 4. Conflicts With Target Schema (`04_TARGET_DATABASE_SCHEMA.md`)

Evaluasi kelima ADR ini mempertegas ketidaksesuaian (*mismatches*) teknis yang ada di dalam draf skema basis data Bab 32 Dokumen 04:

| ADR | Elemen Skema Dokumen 04 | Konflik Teknis Konkret | Tindakan Koreksi yang Wajib Dilakukan pada Skema |
| :--- | :--- | :--- | :--- |
| **ADR-001** | `model OrderItem`, `model RecipeItem`, `model ModifierItem`, `model ModifierRecipeEffect` | Entitas-entitas anak ini pada draf skema Bab 32 **TIDAK MEMILIKI kolom `tenantId`**, membuka celah peretasan foreign key silang antar-penyewa. | Tambahkan `tenantId String @map("tenant_id")` dan relasi foreign key ke `Tenant` pada model-model tersebut. |
| **ADR-002** | Rekomendasi Bab 25: `CHECK (quantity_on_hand >= 0)` | Jika dipasang sebagai hard constraint DDL PostgreSQL, operasional dapur restoran F&B akan macet total saat stok bahan baku habis di sistem komputer. | Hapus usulan hard database constraint `CHECK (quantity_on_hand >= 0)` pada tabel `inventory_balances`. Tegakkan aturan di level Service Layer / Trigger bersyarat. |
| **ADR-003** | `model UnitConversion` & `model ProductVariant` | `model UnitConversion` memiliki kolom `inventoryItemId` tanpa unique constraint; `ProductVariant` tidak memiliki pengali kemasan dus/botol. | 1. Hapus `inventoryItemId` dari `UnitConversion`, jadikan murni master konversi fisika internasional dengan `@@unique([tenantId, fromUomId, toUomId])`.<br>2. Tambahkan `inventoryQuantityMultiplier Decimal @default(1.000) @db.Decimal(12, 3)` pada `ProductVariant`. |
| **ADR-004** | `model InventoryLedger` & `model InventoryItem` | `InventoryItem.isBatched` ada, namun `InventoryLedger` tidak memiliki kolom untuk mencatat nomor batch supplier dan tanggal kadaluarsa. | Tambahkan kolom nullable `batchNumber String? @map("batch_number")` dan `expiryDate DateTime? @map("expiry_date")` pada `model InventoryLedger`. |
| **ADR-005** | `model OrderItem` & Ketiadaan Ekstensi Services | Draf skema Bab 32 tidak memiliki penanda staf pelaksana servis pada pesanan, dan tidak ada draf model ekstensi jasa. | 1. Tambahkan `assignedStaffUserId String? @map("assigned_staff_user_id")` pada `model OrderItem`.<br>2. Cantumkan draf model ekstensi `WorkOrder` dan `ServiceMaterialUsage` sebagai modul terpisah. |

---

## 5. Decisions Requiring Owner Input

Berikut adalah rangkuman keputusan strategis yang secara langsung membutuhkan pilihan dan persetujuan tertulis dari **Project Owner**:

### Keputusan 1: Penetapan Kebijakan Stok Negatif (ADR-002)
* **Konteks:** Apakah kasir diizinkan memproses penjualan jika stok di komputer tercatat 0 atau minus?
* **Pilihan A (Strict Zero-Tolerance):** Transaksi dibatalkan mutlak oleh sistem. (Aman untuk retail; memicu keributan antrian pada restoran F&B jika staf telat input nota belanja).
* **Pilihan B (Context-Driven - Rekomendasi Arsitek):** Retail dilarang stok minus (butuh otorisasi supervisor); Dapur restoran F&B diizinkan stok minus sementara dengan indikator audit warning untuk di-reconcile kemudian.
* **Pilihan C (Tenant Toggle):** Cukup sediakan satu tombol on/off di pengaturan profil toko.

### Keputusan 2: Waktu Peluncuran Fitur Batch & Expiry Tracking (ADR-004)
* **Konteks:** Kapan pelacakan nomor batch dan auto-FEFO wajib diaktifkan penuh di sistem?
* **Pilihan A (Pola Bertahap - Rekomendasi Arsitek):** Catat nomor batch di kartu stok mutasi pada Phase 1; bangun tabel formal `InventoryBatch` dan algoritma FEFO pada Phase 7 saat modul Apotek/FMCG diluncurkan.
* **Pilihan B (Full Batch Entity Sekarang):** Wajibkan tabel `InventoryBatch` sejak awal peluncuran Core Inventory. (Konsekuensi: waktu rilis Phase 1 mundur 3 minggu).

### Keputusan 3: Strategi Penegakan Isolasi Multi-Tenant (ADR-001)
* **Konteks:** Bagaimana cara kita melindungi data antar penyewa agar tidak bocor?
* **Pilihan A (Option B Prisma-Native - Rekomendasi Arsitek):** Wajibkan `tenantId NOT NULL` pada seluruh tabel operasional anak, dan validasi relasi silang di backend Service Layer. Aktifkan PostgreSQL RLS di fase berikutnya setelah connection pooling matang.
* **Pilihan B (Aktifkan RLS PostgreSQL Sejak Hari Pertama):** Wajibkan konfigurasi PostgreSQL Row-Level Security dan session variable `SET LOCAL` sejak migrasi skema pertama.

---

## 6. Recommended Next Steps

Urutan langkah kerja terstruktur yang direkomendasikan setelah laporan ini diserahkan:

```text
+-----------------------------------------------------------------------------------+
|                        RECOMMENDED EXECUTION SEQUENCE                             |
+-----------------------------------------------------------------------------------+
| STEP 1: OWNER REVIEW & SIGN-OFF                                                   |
| Project Owner membaca ADR-001 s/d ADR-005 dan memberikan persetujuan resmi.       |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| STEP 2: REVISION OF 04_TARGET_DATABASE_SCHEMA.MD                                  |
| Mengoreksi draf skema Prisma target (Bab 32) berdasarkan hasil ADR:               |
| - Menambahkan model RefundItem & IdempotencyKey yang sempat hilang.               |
| - Menambahkan tenantId NOT NULL pada entitas anak (OrderItem, RecipeItem, dll).   |
| - Menambahkan inventoryQuantityMultiplier pada ProductVariant.                    |
| - Menyesuaikan model konversi satuan UOM.                                         |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| STEP 3: RELEASE OF THE IMPLEMENTATION GATE                                        |
| Status gerbang beralih dari BLOCKED menjadi APPROVED FOR IMPLEMENTATION.          |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| STEP 4: PHASE 0 EXECUTION (SECURITY HARDENING)                                    |
| Mulai eksekusi teknis tahap 1: menghapus fallback static tenant di middleware,    |
| mengisi tenantId yang kosong pada database eksisting, dan memasang constraint.   |
+-----------------------------------------------------------------------------------+
```

---

## 7. Architecture Decision Gate Verdict

```text
================================================================================
                           ARCHITECTURE DECISION GATE
================================================================================

Status: OPEN (Awaiting Review)

Implementation remains BLOCKED until:
1. ADR-001 (Tenant Boundary Enforcement) is formally approved.
2. ADR-002 (Negative Stock Policy) is formally approved.
3. ADR-003 (UOM vs Packaging Architecture) is formally approved.
4. ADR-004 (Inventory Batch / Lot Tracking) is formally approved.
5. ADR-005 (Services Module Boundary) is formally approved.
6. Target Prisma schema draft in 04_TARGET_DATABASE_SCHEMA.md is revised to 
   incorporate the missing models (RefundItem, IdempotencyKey) and composite 
   tenant guards.

================================================================================
```

Laporan lengkap tersimpan permanen di: [`/docs/validation/06_ARCHITECTURE_DECISION_GATE_REPORT.md`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/docs/validation/06_ARCHITECTURE_DECISION_GATE_REPORT.md).  
Seluruh berkas ADR tersimpan di: [`/docs/decisions/`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/docs/decisions/).
