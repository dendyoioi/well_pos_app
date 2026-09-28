# ADR-005 — Services Module Boundary & Contract Architecture

## Status

APPROVED — OWNER DECISION RECORDED

## Context

Visi jangka panjang Well POS adalah menjadi platform SaaS POS terpadu yang melayani tiga pilar vertikal: **Retail**, **Food & Beverage (F&B)**, dan **Services (Jasa)**.

Saat ini, sistem yang telah berjalan ~70% berfokus pada alur perdagangan fisik (Retail POS). Berdasarkan evaluasi laporan konsistensi skema (`05_SCHEMA_CONSISTENCY_VALIDATION.md`), draf skema Prisma target sebelumnya sama sekali tidak memuat model untuk vertikal Services.

Membangun seluruh modul Services (sistem reservasi kalender, surat perintah kerja teknisi, perhitungan komisi berjenjang) secara bersamaan pada Phase 1 akan memecah fokus rekayasa, menunda rilis Core Inventory dan F&B, serta menimbulkan risiko *over-engineering* sebelum ada basis pengguna jasa yang terbukti.

Namun di sisi lain, mengisolasi Services ke aplikasi/microservice terpisah melanggar prinsip utama sistem: satu platform SaaS terpadu (*Unified Platform*).

## Problem

Bagaimana merumuskan **Batas Arsitektural (*Architectural Boundary*)** dan **Kontrak Data (*Data Contract*)** untuk industri Services pada arsitektur target tanpa mengimplementasikan seluruh fiturnya secara prematur di Phase 1?

Secara spesifik:
1. Bagaimana Core Sales Engine dan Commerce Catalog mendukung produk berjenis jasa hari ini tanpa merusak alur kasir retail?
2. Bagaimana memperlakukan konsumsi bahan habis pakai (*Consumable Materials*) pada jasa tanpa menambah tabel khusus yang berlebihan di awal?
3. Di mana batas antara entitas Core yang generik dengan entitas spesifik Services, guna menghindari pencemaran kolom-kolom spesifik jasa (*field pollution*) ke dalam tabel transaksi umum?

## Decision Drivers

1. **Unified Platform, No Microservices:**  
   Services adalah modul vertikal masa depan yang menjadi bagian dari arsitektur terpadu Well POS, bukan aplikasi atau microservice terpisah.
2. **Katalog Siap Jasa di Phase 1:**  
   Merchant retail atau F&B saat ini harus bisa menjual produk jasa (misal: jasa perbaikan ringan, ongkos kirim, jasa bungkus kado) tanpa memotong stok fisik.
3. **Pencegahan Polusi Kolom pada Core Entities:**  
   Menghindari penempatan kolom-kolom spesifik servis secara langsung di dalam entitas transaksi generik seperti `Order` atau `OrderItem`.
4. **Tahapan Implementasi Berorientasi Bisnis (*Lean Scope*):**  
   Fokus Phase 1 adalah keamanan tenant, akurasi desimal inventori, varian, dan modul F&B; modul Services yang kaya fitur ditunda ke fase rilis khusus.

---

## Pembagian Batas Domain (Domain Boundary Allocation)

```text
+-----------------------------------------------------------------------------------+
|                        DOMAIN BOUNDARY ALLOCATION MATRIX                          |
+-----------------------------------------------------------------------------------+
| CORE PLATFORM                                                                     |
| - Tenant, User (Staff), Outlet, Shift Kasir, Customer CRM, Payment Engine.        |
+-----------------------------------------------------------------------------------+
| COMMERCE & CATALOG ENGINE (Universal across Retail, F&B, Services)                |
| - Category: Kategori jasa (misal: "Hair Treatment", "Cuci Mobil", "Service Rem"). |
| - Product: Item jasa komersial (productType: SERVICE_LABOR).                      |
| - ProductVariant: Pilihan durasi / spesifikasi jasa (misal: "Pijat 60m" vs "90m").|
| - Price: Harga jual jasa master dan override cabang.                              |
+-----------------------------------------------------------------------------------+
| INVENTORY ENGINE (Shared Logistics)                                               |
| - InventoryItem: Bahan habis pakai (Shampoo, Minyak Rem, Krim Creambath).         |
| - InventoryBalance & Ledger: Pengurangan stok bahan saat jasa selesai.            |
| - Optional Consumable Relations: Melalui arsitektur resep / BOM standar.          |
+-----------------------------------------------------------------------------------+
| SERVICES VERTICAL EXTENSION (Deferred to Future Phase)                            |
| - ServiceDefinition: Durasi pengerjaan, buffer time, kualifikasi teknisi.         |
| - Appointment / Booking: Jadwal reservasi jam dan pemilihan slot terapis/kursi.   |
| - WorkOrder: Tiket pengerjaan fisik bengkel/salon (Queued -> In-Progress).        |
| - StaffAssignment: Penugasan terapis/teknisi multi-staf per baris pengerjaan.    |
| - ServiceMaterialUsage: Pencatatan konsumsi riil bahan di luar estimasi.         |
| - StaffCommission: Perhitungan bagi hasil / insentif staf per pekerjaan tuntas.   |
+-----------------------------------------------------------------------------------+
```

---

## Options Considered

### Option A: Fully Implement Services Schema & Features in Phase 1
* **Description:** Menambahkan seluruh tabel `appointments`, `work_orders`, `staff_commissions`, dan `service_material_usages` ke skema basis data sejak Phase 1.
* **Disadvantages:** **Ditolak oleh Project Owner.** Menambah beban pengujian, memperpanjang waktu rilis, dan menimbulkan risiko *premature optimization*.

### Option B: Stable Architecture Contract Now, Deferred Implementation Later (Approved by Owner)
* **Description:**  
  Menetapkan **Kontrak Arsitektur Inti** pada skema basis data Phase 1 sehingga entitas komersial dan penjualan siap menerima transaksi jasa kapan saja tanpa mengubah tabel inti. Seluruh domain lengkap vertikal Services (WorkOrder, Appointment, Commission) ditunda ke fase ekspansi lanjutan.
* **Advantages:**
  * Fokus rekayasa Phase 1 tetap terjaga untuk menuntaskan Core Inventory dan F&B.
  * Merchant dapat menjual produk jasa hari ini langsung dari kasir POS.
  * Struktur basis data masa depan siap menerima ekstensi vertikal Services secara *non-destructive*.
* **Impact:** Pendekatan arsitektur perangkat lunak yang paling disiplin, efisien, dan terukur.

### Option C: Separate Microservice / Independent Database
* **Description:** Membangun aplikasi dan database terpisah khusus Services.
* **Disadvantages:** **Ditolak secara tegas.** Melanggar prinsip *Unified Platform*.

---

## Decision

**Project Owner Decision Recorded: ADOPT OPTION B (STABLE ARCHITECTURE CONTRACT IN PHASE 1, DEFERRED FULL SERVICES DOMAIN).**

Secara eksplisit diputuskan:
1. **Services Tetap Bagian dari Platform Terpadu:** Modul Services adalah ekstensi vertikal masa depan di dalam basis data dan arsitektur terpadu Well POS (TIDAK menjadi microservice terpisah).
2. **Dukungan Phase 1 pada Core Architecture:**
   * Menambahkan nilai enum `SERVICE_LABOR` pada `ProductType`.
   * Produk bertipe `SERVICE_LABOR` secara default **tidak merepresentasikan stok fisik inventori** (di-bypass dari pemblokiran saldo stok kasir).
   * Hubungan bahan habis pakai opsional (*Optional Consumables*) dapat memanfaatkan arsitektur resep / BOM yang sudah ada pada Core Inventory jika memiliki takaran tetap (misal: 1 porsi cuci mobil mengonsumsi 100ml sampo).
3. **Penundaan Domain Lengkap Services (*Deferred Scope*):**
   Seluruh kapabilitas berikut **DITUNDA dari implementasi Phase 1**:
   * `ServiceDefinition` (Spesifikasi durasi dan skill staf)
   * `Appointment` (Kalender booking jadwal & reservasi)
   * `WorkOrder` (Surat perintah kerja operasional)
   * `StaffAssignment` (Alokasi staf multi-teknisi)
   * `ServiceMaterialUsage` (Pencatatan konsumsi bahan riil teknisi)
   * `StaffCommission` (Kalkulasi sistem komisi staf)
4. **Kebijakan Kolom Generik Core (Prinsip Anti-Pollution):**
   * Tim arsitektur **wajib berhati-hati** memasukkan kolom spesifik jasa ke dalam entitas generik Core.
   * Kolom `assignedStaffUserId` pada `OrderItem` yang sempat diusulkan pada laporan sebelumnya **dicatat sebagai opsi sementara (*optional hook*)**, dan untuk alur kerja servis yang lebih kaya di masa depan, sistem **lebih mengutamakan entitas `StaffAssignment` di dalam modul ekstensi Services**.

---

## Consequences

### Positive
* Memberikan kepastian kontrak arsitektur yang aman untuk jangka panjang tanpa membebani jadwal rilis rintisan.
* Toko retail dan restoran eksisting dapat langsung menjual item jasa (seperti biaya kirim, jasa perbaikan ringan, jasa sablon baju) secara mulus di kasir hari ini.
* Menjaga tabel inti `Order` dan `OrderItem` tetap bersih dari tumpukan kolom-kolom vertikal jasa yang belum tentu dipakai semua tenant.

### Negative
* Merchant jenis salon kecantikan atau bengkel mobil yang membutuhkan alur booking waktu reservasi belum dapat dilayani pada rilis Phase 1.

### Risks
* Kebutuhan integrasi bahan habis pakai yang dinamis (teknisi memakai 2 botol pelumas dari yang semula diestimasi 1 botol) harus menunggu antarmuka work order di fase lanjutan.

## Impact on Existing POS

* **Zero Breaking Change:** Memberikan kemampuan baru pada kasir POS untuk menambahkan produk jasa tanpa hambatan stok.

## Impact on Target Architecture

* Memperjelas pemisahan antara *Core Sales Contract* dengan *Vertical Workflows Extension*.

## Impact on Database Schema

* **Phase 1 Schema:**
  * Tambahkan enum `SERVICE_LABOR` pada `ProductType`.
  * Opsional: Kolom `assignedStaffUserId String?` pada `model OrderItem` (diberi tanda sebagai transisi ringan).
* **Future Phase Schema (Extension Layer):**
  * Penambahan model terisolasi: `WorkOrder`, `StaffAssignment`, `ServiceMaterialUsage`.

## Impact on Migration

* Migrasi berjalan 100% aditif dan non-destructive.

## Open Questions / Open Implementation Details

* `[OPEN IMPLEMENTATION DETAIL]` Validasi apakah `assignedStaffUserId` pada `OrderItem` akan dipertahankan di skema Phase 1 atau sepenuhnya dialihkan ke entitas `StaffAssignment` saat modul Services dibangun.
* `[OPEN IMPLEMENTATION DETAIL]` Alur integrasi deposit/uang muka pemesanan jasa dengan siklus hidup pembayaran `PaymentStatus.PARTIALLY_PAID`.

## Owner Decision Required

*Status: Keputusan Project Owner telah dicatat dan disetujui (Decision B).*
