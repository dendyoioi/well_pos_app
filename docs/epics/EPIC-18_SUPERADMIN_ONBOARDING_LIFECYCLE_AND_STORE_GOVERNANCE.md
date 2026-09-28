# EPIC-18: SUPERADMIN ONBOARDING LIFECYCLE, STORE GOVERNANCE & TRIAGE FUNNEL
## Siklus Hidup Persetujuan Akun Pemilik, Triase Pendaftaran, dan Pemantauan Toko Multi-Industri pada Portal Superadmin

**Epic ID**: `EPIC-18`  
**Status**: **COMPLETED ✅**  
**Prioritas**: **P1 — CRITICAL SAAS GOVERNANCE & OPERATIONS**  
**Target Komponen**: `pos_apps/client/src/pages/SuperadminDashboardPage.tsx`, `pos_apps/server/src/controllers/platform.controller.ts`  
**Dokumen Induk**: [`docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md`](./00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md)  
**Dokumen Terkait**: [`EPIC-14.md`](./EPIC-14_DECOUPLED_OWNER_IDENTITY_AND_SPLIT_REGISTRATION.md), [`EPIC-15.md`](./EPIC-15_FULLSCREEN_MULTI_INDUSTRY_STORE_CREATOR_WIZARD.md), [`EPIC-17.md`](./EPIC-17_MULTI_STORE_HIERARCHY_AND_PER_STORE_SUBSCRIPTIONS.md)  

---

### 1. DESKRIPSI & LATAR BELAKANG ARSITEKTUR

Dengan diterapkannya arsitektur pendaftaran baru pada Well POS:
1. **Pendaftaran Mandiri 5-Field (EPIC-14)**: Calon pemilik usaha mendaftar murni sebagai identitas individu (*Owner Identity*) tanpa membuat toko di awal. Akun berstatus `PENDING` dan dicegah masuk ke sistem hingga disetujui Superadmin.
2. **Full-Screen Multi-Industry Wizard (EPIC-15)**: Toko fisik perdana baru dibuat saat Owner pertama kali login ke Backoffice dan mengisi Nama Pedagang, Nama Toko, Alamat, serta memilih multi-industri dari 58 klasifikasi sektor usaha.

**Permasalahan yang Diatasi oleh EPIC-18**:
Portal Superadmin sebelumnya dirancang dengan asumsi bahwa setiap pendaftar langsung memiliki toko dan cabang. Ketika alur diubah menjadi *decoupled onboarding*, beberapa kesenjangan muncul:
- Superadmin hanya memiliki tombol *"Setujui Akun"* tanpa kemampuan memeriksa rincian pendaftar terlebih dahulu (*inspection before approval*).
- Tidak ada mekanisme untuk menolak (*reject*) atau membatalkan pendaftaran yang mencurigakan, fiktif, atau nomor WhatsApp tidak aktif.
- Superadmin tidak dapat membedakan mana owner yang **sudah disetujui tapi belum login/membuat toko** vs mana yang **tokonya sudah aktif beroperasi**.
- Modal rincian tenant (*detail drawer*) menampilkan data dummy usang seperti subdomain kosong, omset Rp 0, dan tombol impersonasi pada tenant yang belum memiliki toko.

---

### 2. TUJUAN & NILAI BISNIS UTAMA

1. **Dual-Action Governance (Persetujuan & Penolakan Terverifikasi)**:
   - Memberikan wewenang penuh bagi Superadmin untuk meninjau data pendaftar (Nama Lengkap, WhatsApp, Email, Waktu Registrasi) dan mengambil keputusan: **Setujui (Approve)** atau **Tolak (Reject)** dengan alasan yang jelas.
2. **Onboarding Funnel & Segmented Filter Triage**:
   - Memfasilitasi tim operasional dengan bilah filter cepat (*segmented triage tabs*):
     - `Semua Tenant`
     - `Menunggu Approval` (Pendaftar baru yang butuh verifikasi)
     - `Belum Buat Toko` (Owner disetujui namun belum menyelesaikan wizard setup)
     - `Toko Aktif` (Tenant yang gerai fisiknya sudah beroperasi)
     - `Dibekukan / Ditolak`
3. **Contextual Tenant & Store Detail Modal**:
   - Modal detail yang adaptif:
     - Jika status `PENDING`: Menampilkan kartu pendaftar baru, peringatan belum disetujui, dan tombol aksi Approval/Tolak langsung di dalam modal.
     - Jika `0 Outlet`: Menampilkan kartu informatif bahwa gerai belum dibuat (tahap wizard).
     - Jika `>= 1 Outlet`: Menampilkan identitas gerai lengkap dengan legal merchant, alamat, nomor telepon, dan chip warna 58 sub-industri.
4. **Direct Engagement via WhatsApp**:
   - Tautan terintegrasi `wa.me/` dengan pesan ramah otomatis untuk memverifikasi keabsahan nomor pemilik sebelum persetujuan diberikan.

---

### 3. BREAKDOWN SPRINT TASK (SPRINT WORK PLAN)

#### 📋 Sprint 18.1: Decoupled Owner Inspection & Dual-Action Governance
- [x] **Aksi pada Baris Akun Pending**:
  - Tombol **Lihat Detail Pendaftar (`Eye`)**: Mengizinkan Superadmin membuka modal profil sebelum mengambil tindakan.
  - Tombol **Tolak Pendaftaran (`XCircle`)**: Menampilkan modal konfirmasi dengan alasan penolakan, mengubah status tenant menjadi `CANCELLED`.
  - Tombol **Setujui Akun Owner (`CheckCircle2`)**: Memberikan persetujuan aktif (`ACTIVE`), mengaktifkan trial 14 hari, dan mengirimkan email notifikasi.

#### 📋 Sprint 18.2: Dynamic Store Onboarding Funnel & Segmented Triage Pills
- [x] **Bilah Filter Tab Cepat (Segmented Triage Pills)**:
  - `Semua (Total Count)`
  - `⏳ Menunggu Approval (Pending Count)`
  - `⚠️ Belum Buat Toko (Active 0 Outlet Count)`
  - `🏪 Toko Aktif (Active with Outlets Count)`
  - `🚫 Inactive (Nonaktif Count)`
- [x] **Penyelarasan Sinkronisasi Status Dropdown & Pencarian**:
  - Dukungan filter gabungan antara tab segmen dengan pencarian teks nama, email, atau nomor HP.

#### 📋 Sprint 18.3: Contextual Tenant Drawer & Multi-Industry Badges
- [x] Tampilan adaptif tenant detail modal berdasarkan status tenant dan jumlah toko.
- [x] Integrasi chip 58 sub-industri resmi dengan pemetaan sektor Ritel, Restoran, dan Layanan.

#### 📋 Sprint 18.4: Direct WhatsApp Deep-Link Verification
- [x] Tombol verifikasi WhatsApp langsung `wa.me/` dengan pre-filled message dinamis.

#### 📋 Sprint 18.5: Decoupled Store Hierarchy Governance, Inline Sub-Baris & Zero Stacked Modals
- [x] **Penyederhanaan Status Akun Pemilik (Owner Binary State)**:
  - Status Akun Owner murni: `ACTIVE` atau `INACTIVE` (ditambah status registrasi awal `PENDING`).
  - Masa Uji Coba (*Trial 14 Hari*) dicabut dari Akun Owner dan dialokasikan murni pada unit Toko Fisik.
  - **Aturan Kaskade**: Jika status Akun Owner disetel `INACTIVE` (dibekukan/dinonaktifkan), maka seluruh toko fisik milik owner tersebut secara otomatis berstatus `INACTIVE` dan tidak dapat diakses kasir.
- [x] **Pembersihan Kolom Tabel Utama Superadmin**:
  - Kolom *"Paket Toko"* dihapus sepenuhnya dari tabel ringkasan akun owner.
  - Banner teknis RLS (*PostgreSQL Multi-Tenant Security & RLS Isolation*) dihapus seutuhnya.
  - Tabel utama fokus pada: `Nama Pemilik (Owner)`, `Kontak (Email & WhatsApp)`, `Status Toko Fisik`, `Status Akun`, dan `Aksi Operasional`.
- [x] **Refaktor Aksi Operasional dengan Tooltip & Pemisahan Konteks**:
  - Seluruh tombol aksi operasional dilengkapi tooltip penjelas visual yang jelas dan responsif.
  - Aksi **Kelola Langganan** dan **Mode Inspeksi (Impersonasi)** dipindahkan murni ke level toko fisik.
- [x] **Desain Baru: Inline Expandable Accordion Sub-Baris (Zero Stacked Popups)**:
  - Menggantikan modal popup daftar toko dengan **sub-baris tabel inline (`<tr>`)**.
  - Bebas tumpukan pop-up saat mengklik **⚡ Kelola Langganan Toko**.
- [x] **Koreksi Kartu Metrik "Toko Fisik Aktif"**:
  - Dihitung secara presisi: hanya outlet dengan `isActive: true` **DAN** owner berstatus `ACTIVE` atau `TRIAL` (tepat 4 toko aktif pada testbed).
- [x] **Penyediaan Dummy Testbed Komprehensif (Seluruh Status)**:
  - Menyediakan dataset seed terverifikasi (`seed.testbed_statuses.ts`) yang mencakup 5 spektrum status nyata:
    1. `Owner PENDING`: Calon owner baru terdaftar, 0 toko fisik, menunggu approval/reject (Budi Santoso).
    2. `Owner ACTIVE (Fresh)`: Owner aktif disetujui, 0 toko fisik, siap menguji wizard setup (Siti Rahmawati).
    3. `Owner ACTIVE (Single Store - TRIAL)`: 1 toko fisik aktif masa uji coba 14 hari paket PRO (Dendy Aditya).
    4. `Owner ACTIVE (Multi-Store - Mix Status)`: 3 toko fisik aktif (Hendrawan Pratama).
    5. `Owner INACTIVE (Cascade Freeze)`: Owner dibekukan oleh superadmin, seluruh gerai otomatis INACTIVE (Reza Mahendra).

---

### 4. KRITERIA PENERIMAAN (ACCEPTANCE CRITERIA)

1. Superadmin dapat melihat status akun owner murni sebagai `ACTIVE` atau `INACTIVE` (atau `PENDING`), tanpa badge trial di level owner.
2. Menonaktifkan akun owner otomatis menginaktifkan seluruh operasional toko di bawahnya.
3. Kolom paket toko tidak lagi muncul di tabel ringkasan utama owner.
4. Setiap icon aksi operasional memiliki tooltip penjelas yang informatif saat disentuh kursor.
5. Tombol *"Lihat Toko Owner"* membuka daftar seluruh gerai fisik milik owner dengan informasi status (`TRIAL`, `ACTIVE`, `EXPIRED`, `INACTIVE`), paket toko, aksi langganan toko, dan aksi inspeksi toko.
6. Tersedia seeder data dummy komprehensif mencakup 5 variasi status akun dan toko untuk diuji satu per satu oleh pengguna.
7. Semua perubahan lulus verifikasi TypeScript dan build client/server tanpa regresi.

---

### 5. DOKUMEN & KOMPONEN TERDAMPAK

- Frontend: [`pos_apps/client/src/pages/SuperadminDashboardPage.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/SuperadminDashboardPage.tsx)
- Backend: [`pos_apps/server/src/controllers/platform.controller.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/controllers/platform.controller.ts)
- Seeder: [`pos_apps/server/prisma/seed.sandbox.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/prisma/seed.sandbox.ts) / script dummy testbed
- Master Registry: [`docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md`](file:///Users/dendyaditya/Projects/pos_project/docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md)
