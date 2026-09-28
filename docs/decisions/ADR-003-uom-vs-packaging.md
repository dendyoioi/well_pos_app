# ADR-003 — Unit of Measure (UOM) vs Packaging Architecture

## Status

APPROVED — OWNER DECISION RECORDED

## Context

Sistem POS eksisting hanya memiliki satu kolom string tunggal `Product.unit @default("Pcs")` dan seluruh kolom kuantitas bertipe data integer `Int`.

Dalam mentransformasi sistem menjadi multi-vertikal (Retail, F&B, Services), arsitektur harus mampu menangani dua dimensi kuantitas yang secara fundamental berbeda:
1. **Physical Inventory UOM (Satuan Ukur Persediaan Fisik):**  
   Satuan yang digunakan untuk pencatatan stok fisik di gudang, perhitungan akuntansi biaya, dan takaran bahan baku resep dapur (misalnya: `KG`, `GRAM`, `LITER`, `ML`, `PCS`).
2. **Commercial Packaging (Kemasan Komersial Penjualan):**  
   Satuan atau kemasan yang digunakan saat produk ditawarkan dan dijual kepada konsumen di kasir toko (misalnya: "Aqua Botol = 1 PCS", "Aqua Dus = 24 PCS").

Pada laporan validasi konsistensi skema (`05_SCHEMA_CONSISTENCY_VALIDATION.md`, temuan H-03 dan H-05), diidentifikasi adanya risiko ambiguitas di mana konversi fisika murni dicampuradukkan dengan kemasan dagang di dalam satu tabel konversi, sementara varian retail kemasan grosir tidak memiliki mekanisme pengali pemotongan stok.

## Problem

Bagaimana membedakan secara arsitektural antara **Satuan Ukur Persediaan Fisik (Physical Inventory UOM)**, **Konversi Pembelian Supplier (Purchasing UOM Conversion)**, dan **Kemasan Komersial Penjualan (Commercial Packaging)**?

Secara spesifik:
1. Bagaimana mendefinisikan satuan kanonikal persediaan pada entitas `InventoryItem` tanpa membatasi bahwa satuan dasar harus selalu "unit terkecil di dunia"?
2. Bagaimana varian kemasan grosir retail ("Aqua Dus" vs "Aqua Botol") memotong persediaan fisik secara otomatis dan instan di kasir tanpa memaksa toko retail membuat resep olahan (*BOM*)?
3. Bagaimana menjaga agar pengali kemasan penjualan (*Commercial Packaging Multiplier*) tidak rancu dengan konversi UOM fisik (*Physical UOM Conversion*)?

## Decision Drivers

1. **Pemisahan Konseptual yang Bersih:**  
   * Satuan Fisik Persediaan $\neq$ Kemasan Penjualan Komersial $\neq$ Konversi Pembelian Supplier.
2. **Kecepatan Checkout Kasir Retail:**  
   Pemindaian barcode "Aqua Dus" di kasir harus memotong 24 botol seketika dengan operasi aritmatika sederhana tanpa melakukan JOIN ke tabel resep.
3. **Pencegahan Error Floating-Point:**  
   Perhitungan persediaan dan konversi UOM tidak boleh mengalami masalah pembulatan ($0.9999999$).
4. **Fleksibilitas Purchasing vs Sales:**  
   Toko dapat membeli dalam kemasan supplier (misal: 1 Sak Kopi = 50 Kg), menyimpannya dalam UOM kanonikal inventori (50.000 Gram), dan menjualnya dalam cangkir saji atau botol eceran.

## Definisi Kuantitas Persediaan Kanonikal (Canonical Inventory UOM)

> **Prinsip Logistik Terpilih:**  
> `InventoryItem` memiliki **Satuan Ukur Kanonikal (*Canonical Inventory UOM*)** yang dipilih dan ditetapkan khusus untuk item persediaan tersebut.  
> Satuan kanonikal **TIDAK HARUS selalu menjadi "satuan terkecil yang tak terbagi di dunia"**, melainkan satuan standar yang disepakati untuk pencatatan buku besar persediaan item tersebut (misal: Biji kopi kanonikal = `GRAM`, Beras karungan kanonikal = `KG`, Telur ayam kanonikal = `BUTIR` atau `KG`).

Seluruh saldo fisik di `InventoryBalance` dan mutasi di `InventoryLedger` **HANYA DAN SELALU DICATAT DALAM CANONICAL INVENTORY UOM** milik item tersebut.

---

## Options Considered

### Option A: Strict Separation of Physical UOM and Commercial Packaging Multiplier (Approved by Owner)
* **Description:**  
  1. **Physical Inventory UOM:** Dikelola oleh `InventoryItem.baseUomId` dan tabel standar fisika `UnitOfMeasure` & `UnitConversion`. Ini murni untuk kalkulasi fisik stok dan konversi UOM standar (misal: KG $\leftrightarrow$ GRAM, LITER $\leftrightarrow$ ML).
  2. **Purchasing UOM Conversion:** Dikelola terpisah melalui konfigurasi pembelian supplier (`InventoryItem.purchaseUomId` dan faktor konversinya ke Canonical UOM).
  3. **Commercial Packaging:** Dikelola pada layer komersial menggunakan kolom `ProductVariant.inventoryQuantityMultiplier`. Multiplier ini merepresentasikan **berapa banyak Canonical Inventory Quantity yang dikonsumsi oleh satu unit kemasan komersial yang dijual**.
* **Advantages:**
  * Memisahkan domain fisika murni dari domain kemasan komersial secara elegan.
  * Kasir retail menjual "Aqua Dus" secara instan tanpa perlu tabel resep: $\text{Base Qty Deducted} = \text{Order Qty} \times \text{Multiplier}$.
  * Tidak ada keharusan mengonversi barang jadi retail menjadi formula racikan dapur.
* **Disadvantages:**
  * Membutuhkan pemahaman tim pengembang bahwa `inventoryQuantityMultiplier` adalah logika kemasan komersial, bukan konversi fisika UOM.
* **Impact:** Solusi arsitektur paling kokoh, efisien, dan bersih.

### Option B: Universal Single Conversion Table (Draf Awal Dokumen 04)
* **Description:** Mencampur konversi fisika dan kemasan barang ke tabel tunggal `UnitConversion` via nullable `inventoryItemId`.
* **Disadvantages:** Mencampuradukkan matematika universal dengan komoditas dagang, memicu ambiguitas arah konversi, dan tidak memiliki unique constraint yang aman.
* **Impact:** Ditolak karena menimbulkan temuan H-03 dan H-05 pada audit validasi.

---

## Decision

**Project Owner Decision Recorded: ADOPT OPTION A (STRICT DISTINCTION OF PHYSICAL UOM VS COMMERCIAL PACKAGING).**

Secara eksplisit ditetapkan:
1. **Pemisahan Konseptual Mutlak:**
   * **Physical Inventory UOM:** Digunakan untuk stok fisik gudang dan kalkulasi buku besar persediaan (`KG`, `GRAM`, `LITER`, `ML`, `PCS`). `InventoryItem` memegang kepemilikan atas **Canonical Inventory UOM** yang dipilih.
   * **Commercial Packaging:** Digunakan untuk merepresentasikan bagaimana produk ditawarkan dan dijual ke konsumen (misal: Botol = 1 PCS, Dus = 24 PCS).
2. **Karakteristik Pengali Kemasan Komersial (`ProductVariant.inventoryQuantityMultiplier`):**
   * Wajib bernilai positif ($> 0$).
   * Menggunakan tipe data presisi desimal: `Decimal(12, 3)`.
   * Merepresentasikan secara langsung berapa kuantitas stok kanonikal yang dikonsumsi saat 1 unit varian terjual:
     $$\text{Canonical Stock Deducted} = \text{OrderItem.quantity} \times \text{ProductVariant.inventoryQuantityMultiplier}$$
3. **Pemisahan Konversi Pembelian (Purchasing UOM):**
   * Konversi pembelian dari supplier (Purchasing UOM) dikelola secara terpisah dari kemasan penjualan komersial (Selling Packaging).
   * Nilai pembelian dikonversikan ke Canonical UOM saat penerimaan barang (*Purchase Receipt*).

---

## Specific Business Case Mapping

### Kasus 1: Retail Kemasan Eceran vs Grosir ("Aqua 600ml")
* **`InventoryItem` (Canonical Stock):**
  * Nama: "Air Mineral Botol 600ml"
  * Canonical UOM: `PCS` (Botol)
  * Saldo Fisik di Gudang: `240 PCS`
* **`ProductVariant` (Commercial Units):**
  * Varian 1 (Eceran): "Aqua 600ml Satuan" -> Barcode: `8992753001` -> Multiplier: `1.000` -> **Memotong: 1 PCS**.
  * Varian 2 (Karton Dus): "Aqua 600ml Dus (Isi 24)" -> Barcode: `8992753024` -> Multiplier: `24.000` -> **Memotong: 24 PCS**.

### Kasus 2: F&B Recipe Bahan Baku ("Biji Kopi Arabica")
* **`InventoryItem` (Canonical Stock):**
  * Nama: "Biji Kopi Arabica Gayo"
  * Canonical UOM: `GRAM`
* **Pembelian dari Supplier (Purchasing Conversion):**
  * Supplier mengirim: `5 KG`.
  * Konversi UOM Fisika ($1\text{ KG} = 1.000\text{ GRAM}$): Masuk ke persediaan $+5.000\text{ GRAM}$.
* **Penjualan Kasir F&B ("Es Kopi Susu"):**
  * Varian komersial tidak menggunakan multiplier langsung, melainkan terhubung ke `Recipe` (BOM):
    Resep memotong $-18\text{ GRAM}$ Biji Kopi per porsi.

---

## Consequences

### Positive
* Menghilangkan kerumitan toko retail yang menjual barang per-dus/per-slop tanpa memaksa mereka membuat resep olahan.
* Menjamin presisi matematis dan integritas persediaan di seluruh industri (Retail, F&B, Services).
* Menjaga relasi database tetap ramping dan memiliki performa kueri kasir yang sangat tinggi.

### Negative
* Admin toko harus memahami perbedaan antara satuan stok fisik barang dengan satuan kemasan jualan saat mendaftarkan varian baru.

### Risks
* Kesalahan input angka pengali (misal: terisi 0 atau 240 bukan 24). (Mitigasi: Pasang validasi backend `multiplier > 0` dan konfirmasi modal di UI).

## Impact on Existing POS

* Seluruh produk retail lama saat dimigrasikan otomatis mendapatkan `inventoryQuantityMultiplier = 1.000` secara aman.

## Impact on Target Architecture

* Memperjelas batas domain secara definitif: UOM adalah entitas fisik persediaan, Multiplier adalah atribut kemasan varian penjualan komersial.

## Impact on Database Schema

* `model ProductVariant`: Menambahkan `inventoryQuantityMultiplier Decimal @default(1.000) @db.Decimal(12, 3) @map("inventory_quantity_multiplier")`.
* `model UnitConversion`: Menghapus kolom `inventoryItemId` (karena kemasan ditangani oleh varian), dan menambahkan constraint unik `@@unique([tenantId, fromUomId, toUomId])`.

## Impact on Migration

* Sangat aman dan 100% kompatibel ke belakang.

## Open Questions / Open Implementation Details

* `[OPEN IMPLEMENTATION DETAIL]` Format penamaan otomatis nama varian di UI saat admin menginput multiplier kemasan (misal: auto-generate suffix `(Isi 24)`).
* `[OPEN IMPLEMENTATION DETAIL]` Validasi pembulatan harga beli rata-rata (*average cost*) saat pembelian barang dalam satuan Purchasing UOM dikonversi ke Canonical UOM.

## Owner Decision Required

*Status: Keputusan Project Owner telah dicatat dan disetujui (Decision A).*
