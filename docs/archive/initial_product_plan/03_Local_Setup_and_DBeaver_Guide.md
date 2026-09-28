# Panduan Menjalankan Aplikasi & Database Lokal (Untuk Pemula)
## Disertai Panduan Koneksi ke DBeaver

Dokumen ini dibuat khusus agar Anda dapat menjalankan database dan aplikasi di komputer Anda (Mac / Windows) langkah demi langkah, serta melihat data secara visual di **DBeaver**.

---

## 1. Menjalankan Database PostgreSQL di Komputer Lokal

Ada **2 cara mudah** untuk menjalankan PostgreSQL di lokal. Anda bisa memilih cara yang paling nyaman:

### Opsi A: Menggunakan Docker (Paling Bersih & Direkomendasikan)
Jika Anda sudah memiliki **Docker Desktop**:
1. Di dalam project ini sudah disiapkan file `docker-compose.yml`.
2. Buka Terminal di VS Code / Antigravity IDE, lalu jalankan:
   ```bash
   docker compose up -d
   ```
3. Database PostgreSQL Anda langsung aktif di latar belakang (background) pada port `5432`.

### Opsi B: Menggunakan Postgres App / Postgres Langsung (Tanpa Docker)
Jika Anda di Mac:
1. Unduh aplikasi gratis [Postgres.app](https://postgresapp.com/) lalu buka dan klik **Initialize / Start**.
2. Secara default database akan aktif di `localhost:5432` dengan user bawaan komputer Anda.

---

## 2. Cara Menghubungkan DBeaver ke Database Lokal

Setelah database berjalan, ikuti langkah berikut untuk menghubungkan **DBeaver**:

1. Buka aplikasi **DBeaver** di komputer Anda.
2. Klik menu **Database** > **New Database Connection** (atau ikon colokan listrik berwarna hijau di pojok kiri atas).
3. Pilih driver **PostgreSQL**, lalu klik **Next**.
4. Masukkan parameter koneksi berikut (sesuai konfigurasi file `.env` project):
   * **Host**: `localhost`
   * **Port**: `5432`
   * **Database**: `pos_db`
   * **Username**: `postgres`
   * **Password**: `postgres123`
5. Klik tombol **Test Connection** di kiri bawah.
   * *Catatan:* Jika DBeaver meminta mengunduh driver PostgreSQL (*Download driver files*), klik **Download** (hanya sekali di awal).
   * Jika muncul tulisan **"Connected"** berwarna hijau, berarti koneksi sukses!
6. Klik **Finish**.
7. Di panel sebelah kiri DBeaver, buka folder:
   `pos_db` > `Databases` > `pos_db` > `Schemas` > `public` > `Tables`.
   Di sini Anda bisa melihat semua tabel: `orders`, `products`, `users`, `shifts`, dan klik dua kali untuk melihat isi datanya seperti Excel!

---

## 3. Cara Menjalankan Backend & Frontend

### Langkah 1: Pengaturan File Konfigurasi (.env)
Di folder backend (`pos_apps/server`), buat file `.env` (atau salin dari `.env.example`):
```env
PORT=5000
DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/pos_db?schema=public"
JWT_SECRET="rahasia_super_aman_pos_12345"

# Konfigurasi Pengiriman Email Struk (Opsional untuk testing, bisa pakai akun Gmail / Ethereal)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="tokoanda@gmail.com"
SMTP_PASS="password_aplikasi"
```

### Langkah 2: Migrasi Skema Database & Data Awal (Seeding)
Jalankan perintah ini di terminal folder backend:
```bash
# 1. Masuk ke folder server
cd pos_apps/server

# 2. Install dependensi
npm install

# 3. Buat tabel otomatis di database menggunakan Prisma
npx prisma db push

# 4. Masukkan data awal (Outlet, User kasir/admin, Kategori, & Produk contoh)
npm run seed
```
> [!NOTE]
> Setelah menjalankan `npm run seed`, Anda bisa me-refresh DBeaver (tekan F5). Anda akan langsung melihat data user dan produk sampel sudah terisi rapi di dalam tabel!

### Langkah 3: Menjalankan Server Backend
```bash
npm run dev
```
Backend akan aktif di: `http://localhost:5000`

### Langkah 4: Menjalankan Aplikasi Kasir (Frontend)
Buka tab terminal baru:
```bash
# 1. Masuk ke folder client
cd pos_apps/client

# 2. Install dependensi
npm install

# 3. Jalankan aplikasi frontend
npm run dev
```
Buka browser Anda dan kunjungi: **`http://localhost:5173`** (atau port yang muncul di terminal).

---

## 4. Akun Login Bawaan untuk Uji Coba (Default Credentials)

Saat Anda menjalankan `npm run seed`, sistem otomatis membuatkan 4 akun dengan hak akses berbeda untuk verifikasi:

| Role | Email | Password | Kegunaan Uji Coba |
| :--- | :--- | :--- | :--- |
| **Owner / Admin** | `admin@pos.com` | `admin123` | Mengakses dashboard owner, kelola cabang/outlet, laporan laba rugi. |
| **Supervisor** | `spv@pos.com` | `spv123` | Otorisasi diskon besar, void transaksi, verifikasi Z-Report. |
| **Gudang** | `gudang@pos.com` | `gudang123` | Kelola stok masuk (PO) dan stok keluar barang rusak. |
| **Kasir** | `kasir@pos.com` | `kasir123` | Buka shift modal kasir, scan produk, terima pembayaran kas/QRIS, cetak struk. |

---

## 5. Cara Verifikasi Sistem Berjalan dengan Benar

1. **Tes Buka Shift Kasir**:
   * Login sebagai `kasir@pos.com`.
   * Sistem akan meminta input modal awal laci (misal: Rp 200.000).
   * Verifikasi status shift di DBeaver pada tabel `shifts` (status: `OPEN`).
2. **Tes Transaksi POS**:
   * Klik atau cari produk "Kopi Susu" atau scan barcode contoh.
   * Coba diskon dan pilih pembayaran Tunai (masukkan uang Rp 50.000).
   * Klik Bayar -> Layar struk muncul otomatis untuk dicetak (58mm/80mm).
   * Periksa tabel `orders` dan `order_items` di DBeaver untuk memastikan transaksi tersimpan.
3. **Tes Potong Stok Otomatis**:
   * Periksa kolom `stock` di tabel `outlet_products` pada DBeaver sebelum dan sesudah transaksi; pastikan stok berkurang sesuai jumlah yang dibeli.
4. **Tes Tutup Shift (Z-Report)**:
   * Kasir mengklik tombol "Tutup Shift", input uang fisik di kasir.
   * Sistem menampilkan rekap pendapatan tunai & QRIS serta selisih uang.
