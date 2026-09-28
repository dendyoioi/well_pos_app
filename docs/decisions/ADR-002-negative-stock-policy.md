# ADR-002 — Negative Stock Policy

## Status

APPROVED — OWNER DECISION RECORDED

## Context

Pada implementasi POS saat ini (`order.controller.ts:checkoutOrder`), pengecekan stok dilakukan sebelum transaksi checkout dimulai. Namun karena menggunakan *blind decrement*, sistem masih memiliki celah terjadinya stok negatif jika dua kasir melakukan checkout paralel.

Dalam merancang Inventory Engine baru untuk platform SaaS multi-vertikal, terdapat perbedaan kebutuhan operasional fundamental antara industri **Retail**, **Food & Beverage (F&B)**, **Services**, dan **Gudang Logistik (Warehouse)** terkait perlakuan terhadap stok yang berada di bawah nol (*negative stock*).

Dokumen validasi konsistensi skema (`05_SCHEMA_CONSISTENCY_VALIDATION.md`, Bab 12 ADR-VAL-01) mengonfirmasi bahwa memasang hard database constraint `CHECK (quantity_on_hand >= 0)` secara universal di PostgreSQL akan mematikan operasional restoran F&B saat nota belanja bahan baku telat diinput admin toko.

## Problem

Apa kebijakan bisnis (*business policy*) dan mekanisme penegakan data (*enforcement mechanisms*) yang diterapkan saat transaksi penjualan atau mutasi persediaan menyebabkan saldo fisik (`quantityOnHand`) berada di bawah nol ($< 0$)?

Bagaimana menyusun hierarki aturan yang jelas tanpa membuat banyak rule engine yang saling bertabrakan, serta bagaimana memastikan setiap kejadian stok negatif diperlakukan sebagai **pengecualian operasional (*operational exception*)**, bukan kondisi normal, dan tetap dapat diaudit sepenuhnya?

## Decision Drivers

1. **Kelancaran Operasional F&B & Services:** Tamu restoran yang memesan kopi tidak boleh ditolak hanya karena keterlambatan administratif input surat jalan biji kopi pagi hari.
2. **Keamanan Aset Retail & Gudang:** Mencegah penjualan barang retail yang tidak ada fisiknya di rak toko dan mencegah pengiriman barang fiktif antar-gudang.
3. **Auditability & Reconciliation:** Setiap kejadian stok minus harus tercatat lengkap dengan identitas pelaku, waktu presisi, transaksi asal, dan status rekonsiliasinya.
4. **Fleksibilitas Database:** Menghindari hard database constraint yang kaku pada level DDL PostgreSQL yang dapat memblokir mutasi operasional yang sah.
5. **Kebersihan Hierarki Aturan:** Menetapkan satu alur evaluasi kebijakan yang jelas (Tenant $\rightarrow$ Location $\rightarrow$ Item) tanpa menciptakan rule engine yang membingungkan pengembang.

## Options Considered

### Option A: Never Allow Negative Stock (Hard Database Constraint)
* **Description:** Menambahkan constraint `CHECK (quantity_on_hand >= 0)` pada PostgreSQL.
* **Advantages:** Integritas akuntansi murni terjamin secara matematis di level kernel database.
* **Disadvantages:** Mematikan alur operasional dapur F&B dan peracikan menu saat terjadi keterlambatan pencatatan PO supplier.
* **Impact:** Ditolak karena tidak realistis untuk F&B.

### Option B: Context-Driven Negative Stock Policy with Clear Hierarchy (Approved by Owner)
* **Description:** Tidak memasang hard database CHECK constraint di PostgreSQL. Menggunakan kebijakan berbasis konteks dengan hierarki kebijakan yang jelas:
  $$\text{Tenant Policy} \longrightarrow \text{Location Override} \longrightarrow \text{Item Override}$$
  Stok negatif diperlakukan sebagai pengecualian operasional (*operational exception*) yang sepenuhnya tercatat di audit trail.
* **Advantages:** Menjaga kelancaran antrian kasir F&B dan pemakaian bahan servis, sambil tetap menegakkan disiplin stok non-negatif pada toko retail dan gudang pusat.
* **Disadvantages:** Penegakan aturan dilakukan pada Service Layer dan memerlukan antarmuka monitoring rekonsiliasi.
* **Impact:** Solusi bisnis paling seimbang dan realistis.

### Option C: Tenant-Level Only Toggle
* **Description:** Cukup 1 boolean di level Tenant (`Tenant.allowNegativeStock`).
* **Advantages:** Sangat sederhana.
* **Disadvantages:** Kurang granular untuk merchant bertipe *hybrid* (toko yang memiliki toko oleh-oleh retail di depan dan kafe/bakery di belakang).
* **Impact:** Terlalu umum.

## Decision

**Project Owner Decision Recorded: ADOPT OPTION B (CONTEXT-DRIVEN NEGATIVE STOCK POLICY).**

Secara eksplisit ditetapkan:
1. **Tidak Ada Hard Database CHECK Constraint Global:** Tabel `inventory_balances` **DILARANG** dipasangi constraint `CHECK (quantity_on_hand >= 0)` secara universal di level DDL database agar tidak memblokir operasional F&B.
2. **Perlakuan Berdasarkan Vertikal / Konteks:**
   * **Retail (Barang Jadi):** Secara normal **DILARANG STOK NEGATIF**. Kasir diblokir jika saldo tidak mencukupi (dapat di-override hanya dengan otorisasi supervisor).
   * **Warehouse (Gudang Distribusi):** Secara normal **DILARANG KERAS STOK NEGATIF** pada mutasi pengiriman antar cabang / surat jalan.
   * **F&B (Dapur & Bar):** **DITOLERANSI STOK NEGATIF** ketika dibutuhkan secara operasional agar pesanan tamu tetap dapat diproses.
   * **Services (Bahan Habis Pakai / Consumables):** **DITOLERANSI STOK NEGATIF** jika diizinkan secara eksplisit pada item bersangkutan.
3. **Negative Stock Bukan Kondisi Target:** Stok minus diperlakukan sebagai **pengecualian operasional (*operational exception*)**, bukan alur kerja normal.
4. **Hierarki Evaluasi Kebijakan (Policy Hierarchy):**
   * Default aturan ditentukan oleh kebijakan tingkat Tenant (`Tenant.negativeStockPolicy`).
   * Dapat ditimpa (*override*) oleh tipe lokasi penyimpanan (`StorageLocation.type`, misal: lokasi `KITCHEN` menimpa aturan default menjadi toleran).
   * Dapat ditimpa (*override*) pada tingkat item tertentu (`InventoryItem.allowNegativeStock`, misal: es batu curah boleh minus, daging wagyu premium dilarang minus).
5. **Kewajiban Audit Trail Mutlak:**
   Setiap mutasi yang menghasilkan saldo negatif wajib mencatat metadata audit lengkap:
   * Aktor/User pelaksana (`createdBy`).
   * Transaksi sumber (`referenceType`, `referenceId`).
   * Lokasi penyimpanan (`storageLocationId`).
   * Item inventori (`inventoryItemId`).
   * Kuantitas mutasi (`quantityDelta`).
   * Saldo akhir sesaat setelah mutasi (`balanceAfter < 0`).
   * Timestamp waktu presisi (`createdAt`).
   * Status rekonsiliasi (*unreconciled exception* hingga barang masuk baru diinput).

## Specific Business Policy Summary

```text
Decision:           CONTEXT-DRIVEN NEGATIVE STOCK POLICY
Scope:              Platform-Wide Inventory Engine
Allowed:            Dapur F&B (Kitchen/Bar), Consumables Servis, dan Item bertanda khusus.
Not Allowed:        Barang Jadi Retail Standar dan Gudang Pusat (Warehouse Outbound).
Override:           Supervisor PIN Authorization pada Kasir Retail.
Audit Requirement:  Ledger mencatat isNegativeBalance: true; Dashboard menampilkan 
                    widget "Unreconciled Negative Stock".
Impact on Balance:  Kolom quantityOnHand bertipe Decimal(12, 3) dapat bernilai negatif.
Impact on Checkout: Retail checkout memeriksa saldo (hard stop jika minus tanpa PIN); 
                    F&B checkout memproses pesanan instan.
```

## Consequences

### Positive
* Menghilangkan risiko macetnya antrian tamu restoran F&B akibat kendala administrasi stok sistem.
* Melindungi aset barang berharga pada toko retail dan gudang distribusi dari kehilangan fisik.
* Memberikan kepastian audit dan visibilitas kepada pemilik toko mengenai bahan apa saja yang saat ini minus dan perlu segera diinput nota belanjanya.

### Negative
* Valuasi HPP rata-rata berjalan (*Moving Average*) memerlukan fungsi rekonsiliasi saat penerimaan barang baru masuk ke posisi saldo negatif.

### Risks
* Jika pemilik toko mengabaikan dashboard peringatan stok minus, laporan nilai aset persediaan akan mengalami deviasi dari fisik riil. (Mitigasi: Notifikasi otomatis berkala pada aplikasi mobile owner).

## Impact on Existing POS

* Mengganti pengecekan `if (outletStock.stock < item.quantity) return res.status(400)` yang kaku di `order.controller.ts` dengan pemanggilan fungsi evaluasi kebijakan konteks di `InventoryDomainService`.

## Impact on Target Architecture

* Memantapkan arsitektur inventori yang fleksibel dan adaptif terhadap multi-vertikal bisnis.

## Impact on Database Schema

* `model Tenant`: Menambahkan `negativeStockPolicy Enum @default(RETAIL_STRICT)`.
* `model StorageLocation`: Menambahkan `allowNegativeStock Boolean? @map("allow_negative_stock")`.
* `model InventoryItem`: Menambahkan `allowNegativeStock Boolean? @map("allow_negative_stock")`.
* `model InventoryLedger`: Menambahkan `isNegativeBalance Boolean @default(false) @map("is_negative_balance")`.
* DILARANG menambahkan SQL CHECK constraint non-negatif pada `inventory_balances`.

## Impact on Migration

* Migrasi aman dan non-breaking.

## Open Questions / Open Implementation Details

* `[OPEN IMPLEMENTATION DETAIL]` Rumus matematis penyesuaian HPP Moving Average saat penerimaan barang baru masuk ke saldo yang sedang negatif (*Variance Cost Adjustment*).
* `[OPEN IMPLEMENTATION DETAIL]` Ambang batas minus maksimal (*negative stock ceiling*, misal: maksimal minus 50 kg sebelum kasir F&B wajib konfirmasi).

## Owner Decision Required

*Status: Keputusan Project Owner telah dicatat dan disetujui (Decision B).*
