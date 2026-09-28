# Fitur Lanjutan Kasir & Optimasi Engine Struk Well POS
## Hold Order, Split Payment, Struk WhatsApp/Thermal, & Offline Queue

Dokumen ini melengkapi kapabilitas operasional terminal kasir Well POS dengan 4 fitur bernilai tinggi:

---

## 1. Fitur Tahan / Simpan Pesanan (Hold / Park Order)

### Logika & Alur Penggunaan:
1. Kasir sedang menginput barang belanjaan pelanggan di terminal kasir.
2. Pelanggan meminta izin mengambil barang tambahan di rak toko.
3. Kasir menekan tombol **"Tahan Pesanan" (F8 / Hold Order)**:
   * State keranjang saat ini disimpan ke memori lokal / tabel draft (`hold_orders`).
   * Layar kasir kembali bersih (kosong) dan kasir langsung dapat melayani antrean pelanggan berikutnya.
4. Ketika pelanggan kembali, kasir membuka menu **"Daftar Pesanan Tertahan" (Pending Orders)**:
   * Menampilkan daftar pesanan tertahan lengkap dengan waktu penahanan dan ringkasan isi item.
   * Kasir memilih pesanan tersebut -> Seluruh item otomatis kembali masuk ke keranjang belanja kasir.

---

## 2. Pembayaran Campuran / Terpisah (Split / Multi-Tender Payment)

### Logika & Alur Penggunaan:
1. Di layar popup pembayaran (F4), kasir dapat memilih metode pembayaran **Campuran (Split Payment)**.
2. Contoh skenario transaksi Rp 100.000:
   * Pembayaran 1: **Tunai** = Rp 60.000 (Diterima: Rp 100.000, Kembalian tunai dihitung).
   * Pembayaran 2: **QRIS** = Rp 40.000 (Sisa tagihan).
3. Tabel `payments` menyimpan multi-records untuk 1 `order_id`:
   * Record 1: Method = CASH, Amount = 60000
   * Record 2: Method = QRIS, Amount = 40000
4. Pada struk fisik maupun digital, rincian pembayaran ganda tercetak rapi:
   ```text
   Subtotal          : Rp 100.000
   ------------------------------
   Bayar (Tunai)     : Rp  60.000
   Bayar (QRIS)      : Rp  40.000
   Kembalian         : Rp       0
   ```

---

## 3. Optimasi Engine Cetak Struk (Thermal 58/80mm, PDF, & WhatsApp)

### 3.1 Cetak Struk Fisik Thermal (58mm & 80mm)
* **Auto-Cut & Drawer Trigger**: Mendukung pengiriman kode karakter ESC/POS standar untuk membuka laci kasir otomatis (*cash drawer kick-out*).
* **Format CSS Print Terisolasi**:
  * Lebar 58mm: Font ukuran 11px, margin 0, lebar maksimal 32 karakter per baris.
  * Lebar 80mm: Font ukuran 13px, margin 0, lebar maksimal 48 karakter per baris.
  * Tombol **"Test Print"** di pengaturan struk untuk memvalidasi posisi teks, garis pembatas titik-titik, dan logo toko sebelum digunakan melayani pelanggan.

### 3.2 Struk Digital via WhatsApp (WhatsApp Receipt Share)
* Setelah transaksi selesai, di samping tombol cetak thermal disediakan tombol **"Kirim ke WhatsApp"**.
* Format link otomatis:
  `https://wa.me/628123456789?text=Terima+kasih+telah+berbelanja+di+Toko+Maju+Jaya!+Berikut+adalah+struk+digital+Anda:+https://app.wellpos.id/receipt/INV-20260901-001`
* Halaman struk digital publik yang responsif ramah smartphone pelanggan.

---

## 4. Ketahanan Jaringan (Offline Queue Fallback)

### Mekanisme Perlindungan Jaringan:
* Menggunakan **IndexedDB / LocalStorage** di browser kasir.
* Jika tombol bayar ditekan saat koneksi internet terputus (*offline/intermittent*):
  1. Sistem memberikan status transaksi `PENDING_SYNC` secara lokal.
  2. Struk kasir tetap dapat dicetak secara offline.
  3. Indikator sinyal di pojok kasir berubah warna menjadi oranye (*"1 Transaksi Tertahan di Lokal"*).
  4. Begitu koneksi internet pulih, worker di browser otomatis menyinkronkan (*sync*) transaksi tersebut ke server database tanpa ada data yang hilang.
