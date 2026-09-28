# Template Formulir & Dokumen Pendukung Onboarding Klien

Dokumen ini berisi format dokumen siap pakai yang bisa langsung disalin atau dibagikan kepada klien baru.

---

## 1. Formulir Profil Usaha Klien (Client Intake Form)

Bagikan form ini kepada klien sebelum instalasi dilakukan:

```markdown
### FORMULIR DATA KLIEN BARU (POS SYSTEM)

1. DATA BISNIS & OUTLET
- Nama Usaha / Brand       : _________________________________________
- Nama Pemilik / PIC       : _________________________________________
- Nomor WhatsApp / HP      : _________________________________________
- Email Akun Utama (Owner) : _________________________________________
- Alamat Outlet 1          : _________________________________________
- No. Telp Outlet 1        : _________________________________________
*(Jika memiliki lebih dari 1 cabang, lampirkan daftar cabang tambahan)*

2. PENGATURAN KASIR & PAJAK
- Terapkan Pajak (PPN)?    : [ ] Ya (___ %)    [ ] Tidak
- Service Charge?          : [ ] Ya (___ %)    [ ] Tidak
- Pesan Kaki Struk         : "Terima kasih atas kunjungan Anda! Follow IG @tokokami"

3. PERANGKAT KERAS (HARDWARE)
- Perangkat Kasir          : [ ] PC Desktop Windows   [ ] Laptop   [ ] Mac
- Printer Struk Kasir      : [ ] Thermal 58mm         [ ] Thermal 80mm
- Koneksi Printer          : [ ] USB Cable            [ ] Bluetooth   [ ] LAN / Wi-Fi
- Barcode Scanner          : [ ] Ada (USB)            [ ] Belum Ada

4. METODE PEMBAYARAN
- Tunai (Cash)             : [ ] Ya
- QRIS                     : [ ] Ya (Stiker Statis / Dinamis)
```

---

## 2. Format Template Impor Katalog Produk (CSV / Excel)

Format kolom tabel untuk diisi oleh klien agar katalog produk dapat langsung diunggah:

| barcode | sku | nama_produk | kategori | harga_modal | harga_jual | stok_awal | min_stok | satuan |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 8992761011234 | IND-001 | Indomie Goreng Spesial | Makanan | 2800 | 3500 | 120 | 20 | Pcs |
| 8991389223344 | AQU-600 | Aqua Air Mineral 600ml | Minuman | 2500 | 4000 | 72 | 12 | Botol |
| 8997213456789 | MIN-002 | Minyak Goreng 1L | Sembako | 14000 | 16500 | 30 | 5 | Pouch |

> [!NOTE]
> Format CSV:
> ```csv
> barcode,sku,nama_produk,kategori,harga_modal,harga_jual,stok_awal,min_stok,satuan
> 8992761011234,IND-001,Indomie Goreng Spesial,Makanan,2800,3500,120,20,Pcs
> 8991389223344,AQU-600,Aqua Air Mineral 600ml,Minuman,2500,4000,72,12,Botol
> ```

---

## 3. Lembar Panduan Singkat Kasir (Cashier 1-Page Cheat Sheet)

*Cetak lembar ini dan tempelkan di dekat monitor kasir:*

```text
===========================================================
               PANDUAN CEPAT KASIR (SOP KASIR)
===========================================================

1. AWAL KERJA (BUKA SHIFT)
   - Login dengan akun kasir Anda.
   - Masukkan nominal "Modal Awal" (uang kecil di laci).
   - Klik "Buka Shift".

2. TRANSAKSI PENJUALAN
   - Scan barcode barang dengan scanner, ATAU
   - Tekan F2 / ketik nama barang di kolom pencarian.
   - Tambah jumlah barang dengan tombol (+) atau edit angka.
   - Jika ada diskon, masukkan diskon di keranjang.

3. PEMBAYARAN
   - Tekan F4 atau klik tombol "Bayar".
   - Jika TUNAI: Masukkan nominal uang yang diterima pelanggan.
     (Sistem akan otomatis menghitung uang kembalian).
   - Jika QRIS: Tunjukkan kode QRIS ke pembeli dan pastikan
     notifikasi pembayaran sukses sebelum menyerahkan struk.
   - Klik "Selesaikan Transaksi". Struk akan tercetak otomatis.

4. VOID / BATAL TRANSAKSI
   - Jika pelanggan membatalkan barang yang sudah diinput,
     panggil Supervisor untuk memasukkan PIN otorisasi.

5. AKHIR KERJA (TUTUP SHIFT / Z-REPORT)
   - Klik menu "Tutup Shift".
   - Hitung seluruh uang tunai fisik yang ada di laci kasir.
   - Masukkan nominal uang fisik ke dalam sistem.
   - Klik "Konfirmasi Tutup Shift".
   - Struk Rekap Shift (Z-Report) akan tercetak.
   - Serahkan uang tunai & struk rekap kepada Supervisor/Owner.
===========================================================
```
