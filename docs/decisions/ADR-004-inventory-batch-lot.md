# ADR-004 — Inventory Batch / Lot and Expiry Tracking Architecture

## Status

APPROVED — OWNER DECISION RECORDED

## Context

Sistem inventori POS eksisting mencatat mutasi stok secara flat tanpa nomor batch atau tanggal kadaluarsa (*expiration date*).

Pada draf arsitektur database awal, terdapat perbedaan pandangan apakah pemodelan batch harus ditunda hingga fase lanjutan (Phase 7) dengan hanya menaruh metadata di ledger, ataukah harus diakui sebagai dimensi persediaan resmi sejak awal.

Industri tertentu yang menjadi target ekspansi SaaS Well POS—khususnya **Retail Farmasi/Apotek**, **Makanan & Minuman Kemasan (FMCG)**, **Kosmetik**, serta **Bahan Baku F&B Kritis (Dairy / Daging Segar)**—membutuhkan pelacakan nomor batch (*Lot Number*) dan pemantauan tanggal kadaluarsa (*Expiry Date*) sebagai bagian integral dari saldo persediaan.

## Problem

Bagaimana nomor batch (*Lot Number*) dan tanggal kadaluarsa (*Expiry Date*) harus dimodelkan di dalam arsitektur basis data target?

Secara spesifik:
1. Apakah nomor batch hanya diperlakukan sebagai metadata teks pada baris mutasi ledger (sebagaimana usulan draf awal), ataukah sebagai **Dimensi Persediaan Resmi (*Stock Dimension*)**?
2. Bagaimana struktur saldo fisik persediaan (`InventoryBalance`) membedakan antara item non-batched dan item batched?
3. Bagaimana menjaga agar sistem tidak mengalami *over-engineering* fitur lanjutan (seperti auto-FEFO, recall tracking) sebelum modul farmasi/FMCG diluncurkan secara komersial?

## Decision Drivers

1. **Batch is a Stock Dimension, Not Merely Log Metadata:**  
   Mengetahui "pernah ada barang Batch X masuk bulan lalu" tidak sama dengan mengetahui **"saat ini ada berapa botol Batch X yang masih tersisa di rak toko"**. Pelacakan fisik riil membutuhkan dimensi persediaan.
2. **Kesesuaian dengan Tenant Non-Batched:**  
   Toko baju retail atau restoran cepat saji yang tidak membutuhkan batch tidak boleh terbebani oleh kewajiban menginput nomor batch saat checkout kasir.
3. **Pragmatisme Eksekusi:**  
   Struktur data batch harus hadir sejak fondasi awal arsitektur, namun kapabilitas lanjutan (algoritma auto-FEFO, analitik canggih, alur *product recall* otomatis) dapat ditunda ke fase berikutnya.

---

## Options Considered

### Option A: Metadata Ledger Entry Only (Deferred Batch Model)
* **Description:** Tidak ada tabel batch; nomor batch dan tanggal expired hanya dicatat sebagai string opsional pada baris `InventoryLedger`.
* **Disadvantages:** **Ditolak oleh Project Owner.** Reduksi batch menjadi sekadar metadata ledger menyebabkan sistem tidak memiliki saldo fisik per-batch, membuat audit sisa stok kadaluarsa tidak dapat dilakukan secara deterministik.

### Option B: `InventoryBatch` as an Optional Stock Dimension in Initial Target Architecture (Approved by Owner)
* **Description:**  
  Menghadirkan entitas formal **`InventoryBatch`** sejak awal arsitektur target sebagai dimensi persediaan opsional:
  $$\text{InventoryItem } 1 : N \text{ InventoryBatch}$$
  * Untuk barang non-batched: Dimensi saldo persediaan = $\text{InventoryItem} + \text{StorageLocation}$.
  * Untuk barang batched: Dimensi saldo persediaan = $\text{InventoryItem} + \text{StorageLocation} + \text{InventoryBatch}$.
  Arsitektur secara sadar mengakui keberadaan *Batch-Aware Inventory Balance*.
* **Advantages:**
  * Struktur data masa depan stabil; tidak memerlukan perombakan skema tabel saldo persediaan secara radikal di kemudian hari.
  * Mengetahui sisa stok riil per nomor batch di setiap lokasi fisik.
  * Fitur lanjutan (FEFO otomatis, laporan recall) dapat dibangun di atas struktur data yang sudah siap tanpa migrasi DDL ulang.
* **Disadvantages:**
  * Mengharuskan skema `InventoryBalance` mendukung dimensi batch (kolom nullable `inventoryBatchId`).

---

## Decision

**Project Owner Decision Recorded: ADOPT OPTION B (INVENTORY BATCH AS OPTIONAL STOCK DIMENSION).**

Secara eksplisit diputuskan:
1. **Bukan Sekadar Metadata Ledger:** Nomor batch dan tanggal kadaluarsa **TIDAK BOLEH** direduksi hanya menjadi teks pada catatan ledger. **Batch diakui secara resmi sebagai Dimensi Persediaan (*Stock Dimension*)**.
2. **Keberadaan Entitas `InventoryBatch`:**
   Entitas `InventoryBatch` dihadirkan di dalam arsitektur target sejak awal dengan relasi konseptual:
   $$\text{InventoryItem } 1 : N \text{ InventoryBatch}$$
   Model ini memiliki atribut minimal:
   * `id`: UUID (PK)
   * `tenantId`: UUID (NOT NULL - Tenant-Owned)
   * `inventoryItemId`: UUID (FK ke `InventoryItem`)
   * `batchNumber`: String (Nomor Lot / Batch produksi)
   * `expiryDate`: DateTime? (Tanggal kadaluarsa jika berlaku)
   * `isActive`: Boolean
3. **Batch-Aware Inventory Balance:**
   * Untuk barang non-batched (`isBatched = false`):
     Stok fisik direpresentasikan oleh:
     $$\mathbf{Stock} = \text{InventoryItem} + \text{StorageLocation}$$
   * Untuk barang batched (`isBatched = true`):
     Stok fisik direpresentasikan oleh:
     $$\mathbf{Stock} = \text{InventoryItem} + \text{StorageLocation} + \text{InventoryBatch}$$
4. **Penundaan Fitur Lanjutan (*Deferred Capabilities*):**
   Kapabilitas canggih seperti algoritma alokasi otomatis **FEFO (First Expired First Out)**, antarmuka manajemen penarikan produk cacat (*Product Recall Workflows*), dan analitik umur simpan (*Shelf-Life Analytics*) **DITUNDA ke fase lanjutan**.
5. **Kuantitas Mengikuti Canonical UOM:**
   Kuantitas pada batch **wajib menggunakan Canonical Inventory UOM** dari `InventoryItem` terkait (sesuai ketetapan ADR-003).
6. **Kebijakan Stok Negatif pada Batched Items:**
   Jika suatu item batched diizinkan mengalami stok negatif (merujuk ADR-002), kebijakan stok negatif harus beroperasi terhadap dimensi stok batch yang bersangkutan.

---

## Relational Architecture Map

```text
+-----------------------------------------------------------------------------------+
|                     BATCH-AWARE INVENTORY ARCHITECTURE MAP                        |
+-----------------------------------------------------------------------------------+
|  INVENTORY ITEM (Master Barang, misal: "Vaksin / Susu Pasteurisasi")              |
|  - tenantId: UUID | isBatched: true | canonicalUomId: UUID                        |
+-----------------------------------------------------------------------------------+
                                         | 1:N
                                         v
|  INVENTORY BATCH (Kelompok Produksi Spesifik)                                     |
|  - id: UUID | tenantId: UUID | inventoryItemId: UUID                              |
|  - batchNumber: "LOT-2026-X1" | expiryDate: "2027-01-15"                          |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
|  INVENTORY BALANCE (Batch-Aware Physical Balance)                                 |
|  - tenantId: UUID | storageLocationId: UUID                                       |
|  - inventoryItemId: UUID | batchId: UUID? (Null untuk non-batched)                |
|  - quantityOnHand: Decimal(12, 3) [Dalam Canonical UOM]                           |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
|  INVENTORY LEDGER (Audit Trail Mutasi)                                            |
|  - tenantId: UUID | inventoryItemId: UUID | batchId: UUID?                        |
|  - quantityDelta: Decimal(12, 3) | referenceType: ... | referenceId: ...          |
+-----------------------------------------------------------------------------------+
```

---

## Consequences

### Positive
* Menjawab kebutuhan industri farmasi, makanan segar, dan kosmetik secara struktural sejak hari pertama desain skema.
* Mengeliminasi kebutuhan migrasi skema tabel saldo persediaan di masa depan saat modul FMCG/Apotek diluncurkan.
* Memberikan kepastian posisi sisa stok riil per nomor batch di setiap lokasi penyimpanan.

### Negative
* `InventoryBalance` memiliki relasi opsional ke `InventoryBatch`, membutuhkan indeks komposit berlingkup batch yang aman di PostgreSQL (`[tenantId, inventoryItemId, storageLocationId, batchId]`).

### Risks
* Pada item batched, jika kasir salah memilih batch saat checkout, saldo fisik per-batch dapat mengalami selisih antar-batch meskipun saldo total item tetap seimbang.

## Impact on Existing POS

* **Zero Impact:** Toko retail pakaian atau kelontong reguler memiliki `isBatched = false`, sehingga kolom `batchId` pada saldo bernilai NULL dan sistem bertransaksi normal seperti biasa.

## Impact on Target Architecture

* Memperluas Core Inventory Engine agar memiliki kapabilitas multi-dimensi stok tanpa merusak alur barang non-batched.

## Impact on Database Schema

* Tambahkan `model InventoryBatch` di skema Prisma target.
* Tambahkan `batchId String? @map("batch_id")` pada `model InventoryBalance` dan `model InventoryLedger`.
* Compound unique constraint pada `InventoryBalance` disesuaikan untuk mendukung dimensi batch nullable.

## Impact on Migration

* Sangat aman dan murni aditif. Seluruh saldo persediaan yang dimigrasikan dari `OutletProduct` lama otomatis memiliki `batchId = NULL`.

## Open Questions / Open Implementation Details

* `[OPEN IMPLEMENTATION DETAIL]` Penanganan PostgreSQL Unique Constraint pada kolom nullable `batchId` pada `InventoryBalance` (menggunakan PostgreSQL 15 `NULLS NOT DISTINCT` atau indeks unik parsial).
* `[OPEN IMPLEMENTATION DETAIL]` Strategi alokasi batch default pada saat kasir memindai barcode master item yang berstatus batched (apakah membuka modal pemilih batch atau auto-select batch terlama).

## Owner Decision Required

*Status: Keputusan Project Owner telah dicatat dan disetujui (Decision B).*
