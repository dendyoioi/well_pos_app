# ADR-006 — Decoupled SaaS Onboarding, Registration Guard & Zero-Store Gatekeeper Architecture

## Status

APPROVED — OWNER DECISION RECORDED & IMPLEMENTED (EPIC-14 s.d EPIC-18)

## Context

Pada konsepsi awal SaaS Well POS, registrasi merchant dilakukan secara monolitik dan instan: formulir publik langsung membuat entitas `Tenant` aktif, akun `User`, entitas `Outlet` default, paket langganan, dan masa percobaan (trial) dalam satu kali pemanggilan API (`POST /api/saas/register`).

Seiring bertumbuhnya kebutuhan keamanan platform, pencegahan spam pendaftaran fiktif (*sybil attack / trial abuse*), serta perlunya verifikasi calon mitra bisnis via WhatsApp, alur registrasi monolitik tersebut menimbulkan beberapa masalah kritis:
1. **Penyalahgunaan Akun & Sampah Database:** Siapa pun dapat mendaftar dengan email sembarangan dan langsung membebani database dengan outlet, gudang, dan sesi shift dummy.
2. **Ketiadaan Verifikasi Bisnis:** Platform SuperAdmin tidak memiliki mekanisme verifikasi nomor kontak pemilik toko (WhatsApp) sebelum memberikan akses backoffice.
3. **Pengalaman Pengguna yang Kaku:** Alur monolitik lama memaksa pemilik toko mengisi seluruh konfigurasi toko, jenis industri, dan alamat di formulir awal pendaftaran, yang meningkatkan *drop-off rate* pendaftaran publik.

## Problem

Bagaimana merancang arsitektur pendaftaran mandiri (*self-service registration*) yang:
1. Meminimalkan friksi pada landing page publik (*zero-friction lead capture*).
2. Memisahkan secara tegas (*decoupled*) antara siklus pembuatan akun legal tenant, verifikasi platform oleh SuperAdmin, dan inisialisasi outlet pertama oleh pemilik toko.
3. Menjamin bahwa pemilik toko yang belum disetujui atau belum memiliki toko fisik tidak dapat masuk ke sistem POS operasional maupun backoffice umum (*zero-store state handling*).

## Decision Drivers

1. **Keamanan & Verifikasi Kontak Valid:** Wajib menggunakan format nomor WhatsApp standar internasional Indonesia (`+628...`) yang dapat diverifikasi oleh tim SuperAdmin sebelum akun aktif.
2. **Zero-Friction Conversion:** Formulir pendaftaran publik hanya meminta data esensial (5 field).
3. **Pemisahan Tanggung Jawab (Separation of Concerns):** Registrasi Tenant $\neq$ Approval Platform $\neq$ Pembuatan Toko/Outlet.
4. **State Machine yang Deterministik:** Siklus hidup tenant (`PENDING` $\rightarrow$ `ACTIVE` $\rightarrow$ `EXPIRED` / `SUSPENDED`) ditegakkan di backend via middleware dan HTTP status code standar.
5. **Katalog Industri Komprehensif:** Onboarding toko pertama harus mampu mengakomodasi keunikan vertikal bisnis Indonesia (Retail, F&B, Services) dengan cakupan luas (58 sub-industri).
6. **Zero Stacked Modals:** UI onboarding tidak boleh menggunakan modal bertumpuk yang membingungkan pengguna di layar kecil/tablet.

---

## Options Considered

### Option A: Monolithic Registration with Immediate Store Creation (Legacy Pattern)
* **Description:** Formulir pendaftaran publik langsung membuat Tenant `ACTIVE`, Outlet default, dan langsung login ke dashboard.
* **Disadvantages:** Rawan pendaftaran fiktif (*trial abuse*), tidak ada pintu gerbang verifikasi WhatsApp, dan data outlet awal seringkali tidak akurat karena diisi terburu-buru.
* **Impact:** Ditolak.

### Option B: Email-Verification Link Only (Traditional SaaS)
* **Description:** Pengguna harus mengklik tautan verifikasi di email sebelum akun aktif, lalu diarahkan ke wizard toko.
* **Disadvantages:** Sering tersangkut di folder spam email, tidak memberikan akses kontak langsung tim sales/support Well POS via WhatsApp ke pemilik bisnis UMKM.
* **Impact:** Ditolak karena kurang adaptif untuk pasar Indonesia yang *WhatsApp-first*.

### Option C: Decoupled 3-Stage Onboarding with SuperAdmin WhatsApp Gatekeeper & Zero-Store Full-Screen Wizard (Approved by Owner)
* **Description:**
  1. **Stage 1 (Lead Capture):** Pendaftaran publik hanya 5 field esensial. Membuat `Tenant` berstatus `PENDING` dan `User` (`Role: ADMIN`, `outletId: null`, 0 outlet).
  2. **Stage 2 (Platform Review & WhatsApp Verification):** Percobaan login oleh tenant pending ditolak dengan HTTP 403 `TENANT_PENDING_APPROVAL`. Superadmin meninjau akun di `#superadmin`, menghubungi via WhatsApp, lalu menyetujui (`status: ACTIVE`).
  3. **Stage 3 (Zero-Store Gatekeeper & FullScreenStoreWizard):** Saat pertama kali login, sistem mendeteksi `outlets.length === 0` dan meluncurkan antarmuka imersif satu layar (`FullScreenStoreWizard`) untuk memilih dari 58 sub-industri, mengisi nama & alamat toko, dan mengaktifkan masa trial 14 hari sebelum diarahkan ke `BackofficeLayout`.
* **Advantages:** Paling aman dari bot/spam, menjamin nomor WhatsApp tervalidasi, konversi pendaftaran tinggi, dan pengalaman onboarding sangat terarah.
* **Impact:** Solusi terbaik dan disetujui penuh oleh Project Owner.

---

## Decision

**Project Owner Decision Recorded: ADOPT OPTION C (DECOUPLED 3-STAGE ONBOARDING & ZERO-STORE WIZARD).**

Secara eksplisit ditetapkan:

1. **Spesifikasi Payload Registrasi Publik (`POST /api/saas/register`):**
   * Menerima tepat 5 field: `firstName`, `lastName`, `phone`, `email`, `password`.
   * Nilai `phone` wajib divalidasi dan dinormalisasi menjadi format standar `+628...` (menggunakan komponen `<WhatsAppInput />` di frontend dan validator Zod di backend).
   * Membuat entitas `Tenant` dengan `status = TenantStatus.PENDING`.
   * Membuat entitas `User` pemilik dengan `role = Role.ADMIN` dan `outletId = null`.
   * **DILARANG** membuat `Outlet`, `StorageLocation`, atau `Shift` pada tahap ini.

2. **Penegakan Login Guard (Backend & Frontend):**
   * Endpoint `POST /api/auth/login` memeriksa status tenant:
     - Jika `Tenant.status === PENDING`: Kembalikan response HTTP 403 Forbidden dengan payload terstruktur:
       ```json
       {
         "success": false,
         "code": "TENANT_PENDING_APPROVAL",
         "message": "Pendaftaran akun Anda sedang ditinjau oleh tim Well POS...",
         "tenantStatus": "PENDING"
       }
       ```
     - Jika `Tenant.status === SUSPENDED`: Kembalikan HTTP 403 `TENANT_SUSPENDED`.
     - Jika `Tenant.status === EXPIRED`: Izinkan login terbatas hanya ke billing portal.

3. **SuperAdmin WhatsApp Verification Portal (`#superadmin`):**
   * Platform SuperAdmin memiliki tabel daftar tenant lengkap dengan badge status (`PENDING`, `ACTIVE`, `EXPIRED`, `SUSPENDED`).
   * Tombol *deep-link* langsung: `https://wa.me/<cleaned_phone>?text=Halo%20...` untuk verifikasi instan.
   * Tombol aksi satu-klik: `PATCH /api/platform/tenants/:id/status` dengan payload `{ status: "ACTIVE" }` untuk menyetujui tenant.

4. **Zero-Store Gatekeeper & `FullScreenStoreWizard`:**
   * Di frontend (`DashboardPage.tsx`), saat user berhasil login dan token valid, sistem memeriksa array `user.outlets`:
     - Jika `outlets.length === 0`: Blokir akses ke sidebar navigasi dan tampilkan komponen `FullScreenStoreWizard.tsx`.
     - Menghadirkan seleksi taksonomi 58 sub-industri (3 kelompok besar: Food & Beverage, Ritel & Dagang, Jasa & Layanan).
     - Formulir meminta nama toko, alamat, dan nomor kontak outlet.
   * Endpoint `POST /api/saas/stores/create-initial`:
     - Membuat `Outlet` pertama milik tenant.
     - Membuat lokasi penyimpanan utama (`StorageLocation` tipe `DEFAULT_STORE`).
     - Mengaitkan `user.outletId = outlet.id`.
     - Mengaktifkan masa percobaan (trial) 14 hari pada langganan tenant (`trialEndsAt = NOW() + 14 DAYS`).
     - Mengembalikan sesi auth yang sudah terasosiasi dengan outlet aktif, lalu merender antarmuka `BackofficeLayout`.

5. **Kebijakan UI/UX Desain Antarmuka:**
   * **Zero Stacked Modals:** Pembuatan toko pertama dan pengaturan master dilakukan dalam layout layar penuh (*full-screen wizard view*), bukan di dalam pop-up modal bertumpuk.
   * **Komponen Input Kanonikal:** Wajib menggunakan `<WhatsAppInput />` untuk nomor telepon dan `<CurrencyInput />` untuk seluruh input moneter (format titik ribuan langsung di UI, transmisi `number` murni ke API).

---

## Consequences

### Positive
* Menutup celah pendaftaran bot dan penyalahgunaan kuota sandbox/trial secara permanen.
* Setiap tenant aktif di database dipastikan memiliki nomor kontak pemilik yang valid untuk kebutuhan *customer success* dan penagihan.
* Pemilik toko baru mendapatkan pengalaman yang personal sesuai kategori bisnisnya (katalog ritel vs menu F&B).
* UI bersih, responsif, dan tidak ada bug modal bertumpuk (*z-index conflict*).

### Negative
* Ada jeda waktu (*latency*) antara calon merchant mendaftar hingga disetujui oleh SuperAdmin (di sandbox/dev, diatasi dengan akun seeder instan `seed.testbed_statuses.ts`).

### Risks & Mitigations
* **Risiko:** Calon merchant frustrasi jika approval SuperAdmin lambat.  
  **Mitigasi:** Integrasi otomatisasi notifikasi WhatsApp ke tim operasional Well POS pada Fase 2 (akan datang).

---

## Impact on Codebase

* **Database Schema (`schema.prisma`):** Kolom `phone` pada `Tenant` dan `User`, relasi `Tenant.status` enum (`PENDING`, `ACTIVE`, `SUSPENDED`, `EXPIRED`).
* **Backend Controllers:**
  * `saas.controller.ts`: `registerTenant` (5 field murni, 0 store) dan `createInitialStore` (gatekeeper outlet pertama).
  * `auth.controller.ts`: Evaluasi `TENANT_PENDING_APPROVAL` (HTTP 403).
  * `platform.controller.ts`: Approval status tenant oleh SuperAdmin.
* **Frontend Components:**
  * `SaasLandingPage.tsx`: Formulir registrasi 5 field.
  * `FullScreenStoreWizard.tsx`: Wizard interaktif 58 sub-industri.
  * `BackofficeLayout.tsx`: Kerangka backoffice terpadu dengan outlet switcher.
  * `WhatsAppInput.tsx`: Komponen input no HP otomatis `+628...`.
