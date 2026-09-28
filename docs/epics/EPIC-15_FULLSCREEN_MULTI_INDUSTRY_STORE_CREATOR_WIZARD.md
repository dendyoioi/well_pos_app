# EPIC-15: FULL-SCREEN MULTI-INDUSTRY STORE CREATOR WIZARD
## Wizard Layar Penuh Pembuatan Toko Perdana, Katalog Industri Hierarkis & Pencarian Multi-Industri

**Epic ID**: `EPIC-15`  
**Status**: **COMPLETED ✅**  
**Prioritas**: **P1 — CORE ONBOARDING EXPERIENCE**  
**Target Komponen**: `pos_apps/client`, `pos_apps/server`, `pos_apps/server/prisma`  
**Dokumen Induk**: [`docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md`](./00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md)  
**Dokumen Arsitektur Rujukan**: `docs/00_PROJECT_CONTEXT.md`  

---

### 1. DESKRIPSI & TUJUAN BISNIS
Ketika akun Pemilik Usaha (Owner) yang telah disetujui Superadmin berhasil masuk pertama kali ke sistem, sistem mendeteksi bahwa Owner tersebut **belum memiliki toko aktif (`storesCount === 0`)**.

Alih-alih menampilkan modal kecil di atas dashboard kosong, sistem akan menyajikan **Antarmuka Layar Penuh (*Full-Screen Wizard*)** bertajuk:
> *"Selamat Datang! Anda Belum Memiliki Toko Aktif. Mari Konfigurasikan Toko Perdana Anda."*

Wizard ini memandu merchant untuk menginisialisasi toko pertamanya secara komprehensif, mencakup identitas pedagang, nama gerai fisik, alamat operasional, serta pemilihan kategori industri berbasis katalog hierarkis dengan fitur pencarian interaktif dan multi-seleksi.

---

### 2. STRUKTUR FORM WIZARD PEMBUATAN TOKO
Wizard layar penuh ini memuat 4 kelompok data input utama:

1. **Nama Pedagang / Entitas Bisnis**:
   - Nama resmi pedagang, badan usaha, atau identitas pemilik merchant (misal: *PT Senja Sejahtera / CV Kopi Mandiri*).
2. **Nama Toko / Gerai**:
   - Nama brand toko fisik yang akan terpampang di kasir dan struk (misal: *Kopi Senja Mandiri - Cabang Senopati*).
3. **Alamat Fisik Toko**:
   - Alamat lengkap operasional gerai fisik untuk keperluan pencetakan nota dan faktur resmi.
4. **Tipe Industri (Hierarkis, Searchable & Multi-Select)**:
   - Pengguna dapat mencari nama industri secara cepat (*live search*).
   - Pengguna dapat memilih lebih dari satu tipe industri (*multi-select chips/pills*).

---

### 3. KATALOG MASTER INDUSTRI RESMI (CANONICAL INDUSTRY DATASET)
Katalog industri Well POS distandarisasi ke dalam 3 sektor utama (*Ritel, Restoran, Layanan*) dengan total **58 klasifikasi industri spesifik**:

```json
[
  {
    "id": "ind-retail",
    "industryType": "Ritel",
    "language": "id",
    "industryNameList": [
      "Minimarket",
      "Toko Buah",
      "Toko Makanan Segar",
      "Pasar Tradisional",
      "Toko Kelontong",
      "Toko Pakaian",
      "Toko Tas",
      "Toko Sepatu",
      "Toko Perhiasan",
      "Toko Parfum",
      "Toko Kosmetik dan Perawatan Kulit",
      "Toko Buku",
      "Toko Alat Tulis",
      "Toko Furnitur",
      "Toko Elektronik",
      "Toko Peralatan Olahraga",
      "Toko Perlengkapan Hewan Peliharaan",
      "Toko Perkakas",
      "Apotek",
      "Toko Kacamata",
      "Toko Suku Cadang Mobil",
      "Toko Hadiah",
      "Lainnya"
    ]
  },
  {
    "id": "ind-restaurant",
    "industryType": "Restoran",
    "language": "id",
    "industryNameList": [
      "Restoran Cepat Saji",
      "Restoran Teh Gaya Hong Kong",
      "Restoran Masakan Cina",
      "Restoran Masakan Barat",
      "Restoran Masakan Asia",
      "Kedai Kopi",
      "Kedai Teh dan Jus Buah",
      "Toko Kue dan Makanan Penutup",
      "Bar",
      "Restoran Hot Pot",
      "Restoran Prasmanan",
      "Food Truck",
      "Restoran Barbekyu/Panggang",
      "Kios di Pusat Kuliner",
      "Makanan Ringan & Cepat Saji",
      "Restoran untuk Pesta dan Acara",
      "Kantin/Makan Kelompok",
      "Lainnya"
    ]
  },
  {
    "id": "ind-services",
    "industryType": "Layanan",
    "language": "id",
    "industryNameList": [
      "Salon Kecantikan dan Rambut",
      "Salon Kecantikan Hewan Peliharaan",
      "Tempat Pijat",
      "Pusat Kebugaran",
      "Spa",
      "Titik Layanan Ekspedisi",
      "Bengkel Mobil",
      "Tempat Cuci Mobil",
      "Layanan Parkir",
      "Warnet",
      "Karaoke",
      "Tempat Reparasi Elektronik dan Jam Tangan",
      "Klinik Gigi",
      "Klinik Mata",
      "Layanan Medis Lainnya",
      "Hotel",
      "Lainnya"
    ]
  }
]
```

---

### 4. BREAKDOWN SPRINT TASK (SPRINT WORK PLAN)

- [x] **Sprint 15.1: Master Industry Dataset & Backend Store Creation Engine**
  - Penyimpanan master industri di `constants/industries.ts` (58 klasifikasi).
  - Schema Prisma: Kolom `merchantName`, `industries` (String[]) pada model `Outlet`.
  - Endpoint: `POST /api/saas/stores/create-initial`:
    * Menerima: `merchantName`, `storeName`, `phone`, `address`, `industries: string[]`.
    * Menginisialisasi: Outlet baru, StorageLocation utama (Area Penyimpanan Utama), default receipt config, dan trial 14 hari.
    * Menetapkan toko ini sebagai toko aktif milik Owner.

- [x] **Sprint 15.2: UI Full-Screen Onboarding Wizard (`FullScreenStoreWizard.tsx`)**
  - Desain layar penuh modern dengan background ambient bernuansa Putih-Biru clean SaaS (tanpa sidebar backoffice).
  - Komponen ilustrasi visual dan panduan per-field menggunakan `<WhatsAppInput />`.
  - Tombol aksi simpan proporsional bebas lag.

- [x] **Sprint 15.3: Searchable Multi-Select Industry Component**
  - Input pencarian real-time dengan filter instan di seluruh 3 kategori sektor (Ritel, Restoran, Layanan).
  - Tampilan tab filter kategori (ALL, Ritel, Restoran, Layanan).
  - Multi-select chips dengan kemampuan hapus cepat (*tag badge with 'x'*).
  - Penandaan badge sektor otomatis.

- [x] **Sprint 15.4: Transisi & Auto-Redirect ke Dashboard Owner Baru**
  - Transisi mulus saat toko selesai dibuat.
  - Refresh daftar cabang otomatis (`fetchOutlets()`) dan aktivasi outlet di `DashboardPage.tsx`.
  - Pengalihan langsung ke Enterprise Backoffice (EPIC-16).

---

### 5. KRITERIA PENERIMAAN (ACCEPTANCE CRITERIA)
1. Owner yang belum memiliki toko otomatis dialihkan ke antarmuka wizard layar penuh (tidak bisa mengakses backoffice kosong). (Lulus ✅)
2. Input tipe industri mendukung pencarian kata kunci dan pemilihan jamak (*multiple industry selection*). (Lulus ✅)
3. Data seluruh 58 industri dari 3 sektor terpetakan lengkap. (Lulus ✅)
4. Pembuatan toko sukses membuat outlet operasional dan langsung mengarahkan pengguna ke Dashboard Utama. (Lulus ✅)
5. Terverifikasi 100% via test suite `pos_apps/server/src/scripts/verify_onboarding_e2e.ts`. (Lulus ✅)
