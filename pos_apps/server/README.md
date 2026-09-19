# POS Backend Server API (Sprint 1)

Backend REST API untuk aplikasi Kasir / Point of Sale (POS) Multi-Outlet berbasis **Node.js (TypeScript)**, **Express**, dan **Prisma ORM** dengan database **PostgreSQL**.

---

## 🛠️ Tech Stack
- **Runtime**: Node.js v20+ / TypeScript
- **Framework**: Express.js
- **ORM**: Prisma ORM v5
- **Database**: PostgreSQL 16
- **Keamanan**: bcryptjs (hashing kata sandi)

---

## 🚀 Panduan Menjalankan Sistem

### 1. Jalankan Database PostgreSQL
Pilih salah satu metode berikut:

#### Opsi A: Menggunakan Docker Compose (Paling Mudah)
Dari root direktori project (`pos_project/`), jalankan:
```bash
docker compose up -d
```

#### Opsi B: Menggunakan PostgreSQL Lokal (Homebrew / Postgres.app)
Pastikan PostgreSQL aktif di port `5432` dengan database `pos_db` atau sesuaikan string koneksi di file `.env`.
Contoh jika menggunakan database lokal:
```bash
# Pastikan database pos_db sudah dibuat:
createdb pos_db
```

---

### 2. Instalasi Dependensi Backend
Masuk ke folder `pos_apps/server`:
```bash
cd pos_apps/server
npm install
```

---

### 3. Konfigurasi Environment (`.env`)
File `.env` sudah disediakan secara otomatis dengan nilai default:
```env
PORT=5001
DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/pos_db?schema=public"
JWT_SECRET="rahasia_super_aman_pos_12345"
```
*(Sesuaikan username & password jika Anda menggunakan instalasi postgres lokal tanpa docker)*.

---

### 4. Sinkronisasi Skema Database & Seeding Data Awal
Jalankan perintah berikut secara berurutan:

```bash
# 1. Sinkronkan skema Prisma ke PostgreSQL (otomatis membuat semua tabel & relasi)
npx prisma db push

# 2. Masukkan data awal (Outlet, 4 Akun Demo, Kategori, Produk Sampel & Stok)
npm run seed
```

Setelah `npm run seed` selesai, Anda akan melihat log konfirmasi bahwa data awal berhasil diisi ke database.

---

### 5. Menjalankan Server Backend
```bash
npm run dev
```
Server akan aktif di **`http://localhost:5001`**.

Uji endpoint health check di browser atau curl:
```bash
curl http://localhost:5001/api/health
```
Output:
```json
{
  "status": "ok",
  "message": "POS API Server & Database berjalan normal",
  "timestamp": "2026-09-15T...",
  "uptime": 1.25
}
```

---

## 📊 Melihat Data di DBeaver

1. Buka aplikasi **DBeaver**.
2. Klik **New Database Connection** -> Pilih **PostgreSQL**.
3. Masukkan parameter koneksi:
   - **Host**: `localhost`
   - **Port**: `5432`
   - **Database**: `pos_db`
   - **Username**: `postgres`
   - **Password**: `postgres123`
4. Klik **Test Connection**, lalu **Finish**.
5. Buka navigasi:
   `pos_db` > `Databases` > `pos_db` > `Schemas` > `public` > `Tables`.
6. Klik dua kali pada tabel berikut untuk melihat datanya langsung:
   - `outlets`: Cabang toko utama.
   - `users`: 4 akun uji coba (Admin, SPV, Gudang, Kasir).
   - `categories`: Kategori Minuman, Makanan, Snack & Sembako.
   - `products`: Katalog produk sampel lengkap dengan Barcode & HPP.
   - `outlet_products`: Stok riil di cabang toko.
   - `stock_movements`: Kartu stok mutasi masuk awal.

---

## 🔑 Akun Demo untuk Uji Coba

| Role | Email | Password | PIN | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@pos.com` | `admin123` | `111111` | Owner / Pemilik Toko (Akses Penuh) |
| **SUPERVISOR** | `spv@pos.com` | `spv123` | `222222` | Otorisasi Diskon / Void / Verifikasi Kasir |
| **WAREHOUSE** | `gudang@pos.com` | `gudang123` | `333333` | Kelola Stok Masuk & Keluar |
| **CASHIER** | `kasir@pos.com` | `kasir123` | `444444` | Buka Shift, Transaksi, Cetak Struk |

---

## 💻 Script Tersedia

- `npm run dev` : Menjalankan server dalam mode watch (auto reload menggunakan `tsx`)
- `npm run build` : Mengompilasi kode TypeScript ke JavaScript di folder `dist/`
- `npm start` : Menjalankan server hasil kompilasi produksi
- `npm run seed` : Menjalankan skrip pengisian data awal
- `npm run db:push` : Mendorong perubahan skema Prisma ke database
- `npm run db:studio` : Membuka GUI Prisma Studio di browser (`http://localhost:5555`)
