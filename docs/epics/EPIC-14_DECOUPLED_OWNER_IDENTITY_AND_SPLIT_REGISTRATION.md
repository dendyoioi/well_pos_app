# EPIC-14: DECOUPLED OWNER IDENTITY, SPLIT-REGISTRATION & SUPERADMIN APPROVAL
## Pemisahan Identitas Pemilik Usaha, Pendaftaran Mandiri Tanpa Toko & Siklus Persetujuan SuperAdmin

**Epic ID**: `EPIC-14`  
**Status**: **COMPLETED ✅**  
**Prioritas**: **P1 — CRITICAL ARCHITECTURE PIVOT**  
**Target Komponen**: `pos_apps/server`, `pos_apps/client`, `pos_apps/server/prisma`  
**Dokumen Induk**: [`docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md`](./00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md)  
**Dokumen Arsitektur Rujukan**: `docs/00_PROJECT_CONTEXT.md`  

---

### 1. DESKRIPSI & LATAR BELAKANG ARSITEKTUR
Pada arsitektur registrasi sebelumnya, proses pendaftaran merchant (`POST /api/saas/register`) secara monolitik membuat **3 entitas sekaligus**: Tenant (Bisnis), User (Owner), dan Outlet (Toko Utama). Akibatnya:
1. Pemilik bisnis terpaksa menentukan nama toko di awal sebelum akunnya disetujui.
2. Tidak mendukung paradigma modern di mana **1 Akun Pemilik (Owner Profile)** dapat memiliki banyak toko independen (*Multi-Store/Multi-Brand Architecture*).
3. Superadmin menyetujui "Tenant" yang sudah terikat toko default, bukan menyetujui identitas "Pemilik Akun".

**Tujuan EPIC-14** adalah memisahkan siklus hidup (*decouple*) pendaftaran Akun Pemilik Usaha dari pembuatan Toko:
1. Calon pemilik bisnis mendaftar secara bersih sebagai identitas individual (*Owner Account*).
2. Superadmin meninjau dan menyetujui identitas Akun Pemilik (*Approve Owner*).
3. Akun pemilik yang disetujui dapat masuk ke platform, dan belum memiliki toko sama sekali (`storesCount === 0`).

---

### 2. FORM PENDAFTARAN PUBLIK (SPLIT-REGISTRATION)
Formulir registrasi baru pada antarmuka publik (`pos_apps/client/src/pages/SaasLandingPage.tsx`) disederhanakan menjadi **5 field**:
1. **Nama Lengkap Pemilik**:
   - Terdiri dari 2 sub-input: **Nama Depan** (*First Name*) dan **Nama Belakang** (*Last Name*).
2. **Nomor HP / WhatsApp**:
   - Menggunakan format standar Indonesia (`+628...`), wajib angka, batasan 9 s.d. 13 digit setelah `+62`.
3. **Alamat Email**:
   - Email bisnis unik aktif calon pemilik (digunakan sebagai kredensial login utama).
4. **Kata Sandi (Password)**:
   - Minimal 6 karakter aman.
5. **Konfirmasi Kata Sandi**:
   - Validasi pencocokan kesamaan kata sandi (*Password confirmation match*).

> **Catatan Arsitektur**: Pada form ini, **TIDAK ADA** input Nama Toko, Alamat Toko, ataupun PIN Kasir. Toko akan dibuat terpisah setelah akun disetujui Superadmin.

---

### 3. SIKLUS PERSETUJUAN SUPERADMIN (OWNER APPROVAL LIFECYCLE)
1. **Status Pendaftaran Awal**:
   - Akun Owner yang baru mendaftar memiliki status verifikasi `PENDING_APPROVAL` (di backend: `tenant.status = PENDING`).
   - Jika calon pemilik mencoba login sebelum disetujui, sistem menampilkan banner informatif:
     `"Akun Anda sedang dalam tahap peninjauan oleh tim SuperAdmin. Anda akan menerima notifikasi begitu akun Anda diaktifkan."`
2. **Portal SuperAdmin Control Tower**:
   - Tab khusus **"Antrean Persetujuan Owner"**:
     - Menampilkan daftar pendaftar baru: Nama Lengkap, Email, Nomor WhatsApp, Tanggal Daftar.
     - Tombol Aksi: **Setujui Akun (Approve)** dan **Tolak (Reject)**.
   - Begitu disetujui, status akun berubah menjadi `ACTIVE` dan Owner dapat login secara resmi.

---

### 4. BREAKDOWN SPRINT TASK (SPRINT WORK PLAN)

- [x] **Sprint 14.1: Prisma Schema & Decoupled Domain Migration**
  - Pemisahan model atau relasi antara `User` (Owner), `Merchant/Tenant`, dan `Outlet/Store`.
  - Penambahan kolom `firstName`, `lastName`, dan status persetujuan akun (`status: TenantStatus.PENDING`).
  - Pembaruan skrip migrasi tanpa mengganggu relasi 18 tabel target yang sudah berjalan.

- [x] **Sprint 14.2: Backend Authentication & Registration API Refactoring**
  - Endpoint `POST /api/saas/register` dengan validasi Zod ketat (*first name, last name, phone WA, email, password, confirmPassword*).
  - Penegakan filter login di `POST /api/auth/login`: Mencegah login akun berstatus `PENDING` (403 `TENANT_PENDING_APPROVAL`).
  - Endpoint SuperAdmin di `platform.controller.ts` untuk inspect detail dan approve/reject tenant status.

- [x] **Sprint 14.3: Frontend Landing Page Registration Redesign**
  - Pembaruan modal pendaftaran di `SaasLandingPage.tsx` sesuai 5 field spesifikasi baru menggunakan `<WhatsAppInput />`.
  - Validasi real-time untuk kesesuaian konfirmasi password dan format WhatsApp.
  - Tampilan *Success State*: Pesan jelas bahwa pendaftaran berhasil diajukan dan sedang menunggu review Superadmin.

- [x] **Sprint 14.4: SuperAdmin Approval View Integration**
  - Modul peninjauan calon owner di `SuperadminDashboardPage.tsx`.
  - Tombol 1-klik approval/reject dengan feedback visual instan.

---

### 5. KRITERIA PENERIMAAN (ACCEPTANCE CRITERIA)
1. Pendaftaran berhasil menyimpan akun calon owner tanpa membuat toko/outlet otomatis. (Lulus ✅)
2. Login dicegah jika akun owner belum di-approve oleh Superadmin. (Lulus ✅)
3. Superadmin dapat melihat data pendaftar (nama depan, nama belakang, email, WhatsApp) dan melakukan approval. (Lulus ✅)
4. Setelah diapprove, owner dapat login dan diarahkan ke kondisi belum memiliki toko. (Lulus ✅)
5. Terverifikasi 100% via test suite `pos_apps/server/src/scripts/verify_onboarding_e2e.ts`. (Lulus ✅)
