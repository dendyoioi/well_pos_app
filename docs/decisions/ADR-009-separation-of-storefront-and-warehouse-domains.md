# ADR-009: Pemisahan Domain Toko Penjualan (POS) dan Gudang Logistik (Inventory)

## Status
**ACCEPTED** (2026-10-09)

## Konteks & Latar Belakang (Context)
Pada arsitektur basis data relasional Well POS, entitas fisik/operasional (Toko dan Gudang) disimpan pada tabel yang sama, yaitu `outlets`, dengan penanda boolean `is_warehouse`.

Pada iterasi awal, modal *Kelola Toko* (`OutletsView.tsx`) menggabungkan kedua jenis entitas ini secara berdampingan dengan selektor segmented *"Toko Kasir (POS)"* versus *"Gudang Logistik"*. Pada proses edit toko, formulir ini memunculkan risiko kebingungan kognitif (*cognitive ambiguity*):
1. Pengguna khawatir bahwa mengubah pengaturan toko atau mengklik simpan dapat mengonversi toko penjualan menjadi gudang secara tidak sengaja (*type mutation*).
2. Jika toko penjualan yang memiliki transaksi aktif dan shift kasir berubah fungsi menjadi gudang, kasir akan kehilangan akses penjualan POS.
3. Sebaliknya, jika gudang logistik yang sedang menyuplai toko-toko cabang berubah menjadi toko biasa, rantai pasok otomatis (*auto-backflush*) akan terputus.
4. Tim operasional kasir (manajer toko) dan tim logistik (purchasing/gudang pusat) memiliki alur kerja (*role-based workflow*) yang terpisah secara alami.

## Keputusan (Decision)
Kami memutuskan untuk **memisahkan secara tegas domain navigasi dan antarmuka (Information Architecture & UI/UX)** antara Toko Penjualan dan Gudang Logistik tanpa mengubah skema basis data (*zero database schema modification*):

1. **Domain Toko Penjualan (POS)**:
   - Dikelola secara murni di menu **Pengaturan Resto & Outlet $\rightarrow$ Profil & Outlet Toko** (`OutletsView.tsx`).
   - Layar ini hanya menampilkan dan mengelola toko-toko fisik/ritel (`is_warehouse: false`).
   - Formulir Tambah & Edit Toko murni untuk toko kasir, dengan tipe entitas terkunci permanen.
   - Pilihan relasi rantai pasok disajikan melalui dropdown ramah: *"Gudang Sumber Pasokan (Backflush Warehouse): [Pilih Gudang Pusat / Toko Mandiri]"*.

2. **Domain Gudang Logistik (Supply Chain & Inventory)**:
   - Dikelola secara mandiri di grup menu **Bahan Baku & Stok $\rightarrow$ Kelola Gudang** (`WarehousesView.tsx`).
   - Layar ini khusus menampilkan daftar gudang logistik (`is_warehouse: true`), metrik toko cabang yang disuplai, dan tombol aksi *"Buka Mode Gudang"*.
   - Formulir Tambah & Edit Gudang murni untuk fasilitas logistik tanpa beban fitur kasir/meja/struk.

3. **Backend Guardrails Terpadu (`outlet.controller.ts`)**:
   - Gudang logistik murni dipaksa memiliki `warehouseId = null`.
   - Pencegahan referensi diri sendiri (*Anti Self-Referencing Guard*): Toko dilarang memilih dirinya sendiri sebagai gudang pasokan.
   - Validasi integritas target gudang: Target harus berstatus `is_warehouse: true`, aktif, dan milik tenant yang sama.

## Konsekuensi (Consequences)
### Positif
- **Zero Confusion**: Pengguna tidak lagi bingung apakah toko mereka berubah menjadi gudang saat diedit.
- **Mental Model Alami**: Sesuai dengan pembagian tugas nyata di lapangan (Kasir/Manajer Toko vs Staf Gudang/Logistik).
- **Data Integrity**: Menjamin shift kasir POS dan rantai pasok bahan baku aman dari salah konfigurasi.
- **Zero DB Migration**: Menggunakan skema Prisma eksisting tanpa perlu menambah kolom atau tabel baru.

### Netral / Pertimbangan
- Terdapat 2 halaman UI terpisah (`OutletsView.tsx` dan `WarehousesView.tsx`), keduanya terhubung ke endpoint `/api/outlets` dengan parameter filter kontekstual.
