# EPIC-22: Smart Calling Queue Numbering & Flexible Store Toggle
## Standardisasi Nomor Antrean Panggilan Cepat Kasir F&B & Pengaturan Fleksibel per Outlet

---

## 1. DESKRIPSI & LATAR BELAKANG BISNIS (EXECUTIVE SUMMARY)
Pada industri F&B umum (kafe, kedai kopi, restoran cepat saji, food court), nomor faktur transaksi kasir (`INV-20260930-0042`) terlalu panjang untuk diucapkan oleh staf atau diingat oleh pelanggan. Mewajibkan kasir mengetik nama pelanggan atau nomor meja di setiap transaksi counter/takeaway memperlambat antrean kasir di jam sibuk (*rush hour*).

EPIC-22 menghadirkan **Nomor Antrean / Nomor Panggilan Pesanan (*Calling Queue Number*)** yang bekerja secara otomatis, singkat (contoh: `#01`, `#02`, `#15`), dan dapat diatur aktif/nonaktif secara fleksibel oleh pemilik toko (*owner*).

---

## 2. SPESIFIKASI ARSITEKTUR & PENOMORAN
1. **Aturan Penomoran (Daily Auto-Reset per Outlet)**:
   - Dihitung secara otomatis di backend: `SELECT (COALESCE(MAX(queue_number), 0) + 1)::int FROM "orders" WHERE tenant_id = $1 AND outlet_id = $2 AND created_at >= [start_of_today]`.
   - Me-reset ke nomor 1 setiap hari baru (pukul 00:00).
   - Menghindari kerancuan pesanan lintas shift kasir (*cross-shift safety*).
2. **Pemisahan Peran Identitas Pesanan**:
   - `invoiceNumber`: Bukti transaksi finansial dan pajak (`INV-...`).
   - `queueNumber`: Nomor urut antrean panggilan cepat lisan kasir/barista (`#01`).
   - `tableNumber`: Posisi fisik meja/akrilik jika pesanan makan di tempat (*Dine-in*).
3. **Pengaturan Fleksibel Toko (Store Configuration)**:
   - Tersimpan di `outlets.receipt_config.showQueueNumber` (Boolean, default: `true`).
   - Pemilik toko dapat mengaktifkan atau menonaktifkan fitur ini melalui menu **Format Struk Kasir Thermal** di Backoffice.

---

## 3. TITIK SENTUH VISUAL & OUTPUT
1. **Layar Sukses Kasir (`OrderSuccessModal.tsx`)**:
   - Menampilkan badge raksasa `NOMOR ANTREAN: #01` di bagian header modal transaksi sukses.
   - Kasir dapat langsung menyebut nomor panggilan kepada pelanggan tanpa menunggu kertas struk keluar.
2. **Struk Thermal Kasir (58mm / 80mm)**:
   - Kotak bergaris putus-putus tebal dengan teks `NOMOR ANTRIAN` dan angka besar tepat di bawah header toko.
3. **Generator Dokumen PDF (`receiptPdf.ts`)**:
   - Menghasilkan blok persegi putus-putus dengan teks nomor antrean besar saat dicetak/diunduh sebagai PDF.
4. **Pesan Struk WhatsApp Digital**:
   - Baris khusus `*NOMOR ANTRIAN : #01*` tertera di pesan digital tanda terima WhatsApp.
5. **Daftar Tagihan Meja / Open Tabs (`OpenTabsModal.tsx` & `OrderCartSidebar.tsx`)**:
   - Menampilkan chip badge `#01` bernuansa amber di samping nama pelanggan atau nomor meja.

---

## 4. STATUS IMPLEMENTASI & VERIFIKASI
- **Database Schema**: Kolom `queue_number INTEGER` pada tabel `orders` ditambahkan via DDL non-destruktif dan tercermin di `schema.prisma`.
- **Backend Build**: `pos_apps/server` terverifikasi kompilasi TypeScript bersih (`npm run build`, Exit code 0).
- **Frontend Build**: `pos_apps/client` terverifikasi build Vite bundle (`npm run build`, Exit code 0).
- **Status Akhir**: **SELESAI 100% (COMPLETED ✅)**.
