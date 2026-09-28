# EPIC-19: BUKU MENU QR DIGITAL, SELF-ORDERING MEJA & MANAJEMEN MEJA RESTO
## Spesifikasi Modul Pemesanan Meja Mandiri F&B (Mekari POS Model)

**Status**: COMPLETED ✅  
**Terakhir Diperbarui**: 22 September 2026  
**Dokumen Terkait**: [`docs/00_PROJECT_CONTEXT.md`](../00_PROJECT_CONTEXT.md), [`00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md`](./00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md)

---

### 1. RINGKASAN EKSEKUTIF & LATAR BELAKANG
Pada industri Food & Beverage (F&B) modern (kafe, restoran cepat saji, resto kasual), kecepatan pemesanan dan efisiensi tenaga pramusaji (*waiter*) sangat ditentukan oleh kemudahan tamu dalam mengakses menu makanan/minuman dan memesan langsung dari meja tanpa harus menunggu kasir atau pelayan menghampiri.

Mengadopsi pola operasional terbaik seperti pada **Mekari POS**, modul **Buku Menu QR (Self-Ordering)** hadir untuk memfasilitasi tamu memindai QR code unik di meja mereka, membuka katalog digital interaktif, memilih varian/opsi sajian, mencantumkan catatan pesanan khusus, dan langsung mengirimkan pesanan ke dapur/barista resto dengan kebijakan pembayaran fleksibel (*Bayar di Kasir / Pay at Cashier*).

---

### 2. ARSITEKTUR & KOMPONEN TEKNIS

#### A. Backend Engine (`pos_apps/server`)
1. **Layanan Terisolasi Multi-Tenant** (`src/services/qr_menu.service.ts`):
   - Penyimpanan data meja (`QrTable`) dan preferensi operasional (`QrMenuSettings`) terisolasi per tenant dan outlet.
   - Auto-seed 5 meja awal untuk outlet baru agar pedagang dapat langsung mencoba sistem tanpa setup yang berbelit.
   - Endpoint katalog publik tamu (`GET /api/qr-menu/public/:outletId`) mengekspos produk aktif, kategori, varian harga, serta identitas outlet dan meja.
   - Endpoint order submission publik (`POST /api/qr-menu/public/order`) memasukkan pesanan ke tabel kanonikal `orders` dan `order_items` dengan `channel = 'QR_MENU'`, `payment_status = 'UNPAID'`, dan otomatis mengasosiasikan akun penanggung jawab toko (`cashierId`) sehingga integritas relasi foreign key database Prisma terjaga 100%.
   - Live kitchen orders feed (`GET /api/qr-menu/orders`) dengan pembaruan status alur dapur (`CONFIRMED` ➔ `IN_PROGRESS` ➔ `READY` ➔ `COMPLETED`).
2. **Controller & Routing** (`qr_menu.controller.ts` & `qr_menu.routes.ts`):
   - Proteksi rute backoffice meja, pengaturan, dan live orders menggunakan `authenticateToken` & `tenantBoundaryMiddleware`.
   - Pembebasan otentikasi untuk rute publik tamu (`/public/:outletId` dan `/public/order`).

#### B. Frontend Backoffice & Printing Engine (`pos_apps/client`)
1. **Manajemen Meja & Cetak QR Meja** (`src/pages/QrTablesView.tsx`):
   - Grid kartu meja interaktif dengan badge status keterisian (`TERSEDIA` / `DIGUNAKAN` / `DIPESAN`).
   - Filter zona/section (Indoor, Outdoor, Lantai 2, VIP).
   - In-page form tambah meja baru (Zero Stacked Modals).
   - Modal pratinjau Tent Card meja tunggal bergaya akrilik elegan (Nomor Meja besar, QR code, nama outlet, petunjuk pemindaian).
   - Lembar cetak massal (*Print Sheet*) teroptimasi kertas A4 dengan aturan CSS `@media print` untuk mencetak seluruh nomor meja sekaligus.
2. **Pengaturan Buku Menu QR** (`src/pages/QrMenuSettingsView.tsx`):
   - Simulator live interaktif bilah atas buku menu tamu (*Live Mobile Viewport Preview*).
   - Toggle switch independen aktivasi fitur *Self-Ordering* (Pemesanan Mandiri vs Katalog View-Only).
   - Kustomisasi pesan ucapan sambutan pelanggan di banner aplikasi (Judul & Sub-judul).
   - **Opsi Aktif/Nonaktif Fasilitas Wi-Fi Tamu**: Sakelar mandiri untuk menampilkan atau menyembunyikan info Wi-Fi (SSID & Password dengan tombol intip/salin cepat) di buku menu tamu.
   - **Opsi Aktif/Nonaktif Estimasi Waktu Saji Dapur**: Sakelar mandiri untuk menampilkan atau menyembunyikan estimasi menit saji, dilengkapi tombol preset cepat (10m, 15m, 20m, 30m, 45m) serta input angka kustom.
   - Kebijakan pembayaran kasir (*Pay at Cashier*) yang transparan.
3. **Feed Pesanan Meja Masuk / Kitchen Display** (`src/pages/QrLiveOrdersView.tsx`):
   - Pembaruan otomatis setiap 10 detik dengan opsi refresh manual.
   - Filter kartu pesanan berdasarkan status (`Semua`, `Baru Masuk`, `Diproses`, `Siap Saji`, `Selesai`).
   - Rincian item pesanan, varian rasa, harga, dan catatan khusus dari tamu.
   - Tombol aksi transisi dapur bertahap: "Terima & Masak" ➔ "Pesanan Siap Saji" ➔ "Selesai / Diantar".
   - Tombol pintasan langsung ke pembayaran kasir POS untuk menuntaskan tagihan meja.

#### C. Antarmuka Publik Tamu Resto (`src/pages/CustomerQrMenuView.tsx`)
1. **Mobile-First Client Experience**:
   - Diarahkan melalui URL hash: `#menu?outletId=<OUTLET_ID>&table=<NO_MEJA>` (dapat diakses dari browser smartphone mana pun tanpa otentikasi staf).
   - Hero header elegan dengan badge nomor meja aktif, nama resto, alamat, dan kartu info Wi-Fi yang dapat disalin dengan satu sentuhan.
   - Pencarian menu instan & filter pills horizontal kategori hidangan.
   - Modal bottom-sheet pemilihan varian produk, kuantitas, dan textarea catatan koki/barista.
   - Floating cart bar interaktif di bawah layar yang menampilkan jumlah item dan total subtotal harga.
   - Slide-over order summary sheet dengan input nama pemesan dan nomor WhatsApp pelanggan (opsional).
   - Layar sukses pemesanan (*Order Success Screen*) yang menampilkan ID Pesanan, instruksi pembayaran di kasir, dan ringkasan sajian yang sedang dimasak oleh dapur.

---

### 3. VERIFIKASI & ACCEPTANCE CRITERIA
- [x] Pelanggan dapat memindai QR meja dan langsung membuka halaman menu tanpa error login 401.
- [x] Pesanan yang dikirim oleh pelanggan masuk ke database dengan `channel: QR_MENU` dan status `UNPAID`.
- [x] Dashboard Owner dan Kasir menampilkan feed pesanan meja secara real-time pada tab `qr_live_orders`.
- [x] Owner dapat mencetak tent card meja satuan maupun massal dengan QR code tajam dan tata letak presisi.
- [x] Build verifikasi `pos_apps/server` (tsc) dan `pos_apps/client` (tsc -b && vite build) lulus 100% dengan **Exit Code 0**.
