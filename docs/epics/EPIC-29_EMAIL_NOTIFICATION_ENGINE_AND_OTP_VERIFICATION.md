# EPIC-29: EMAIL NOTIFICATION ENGINE, ANTI-DUMMY PROTECTION & REGISTRATION OTP VERIFICATION
## Arsitektur Notifikasi Email Transaksional, Proteksi Email Palsu, dan Verifikasi OTP Pendaftaran SaaS

---

### 1. RINGKASAN EKSEKUTIF (EXECUTIVE SUMMARY)

**EPIC-29** mengimplementasikan fondasi sistem notifikasi email transaksional untuk platform **Well POS**, dengan fokus utama pada keamanan pendaftaran akun pemilik (*Self-Service Sign Up*), perlindungan terhadap serangan email bot/dummy (*anti-disposable email*), dan otomatisasi pengiriman faktur aktivasi serta tanda terima pembayaran resmi (*Official Welcome & Receipt Email*).

Sebelumnya, calon pengguna dapat memasukkan sembarang email fiktif di form pendaftaran, membayar via gateway Pakasir, namun tidak dapat dihubungi untuk pemulihan kata sandi, faktur langganan, maupun pengumuman operasional penting. Dengan EPIC-29, email calon pemilik **wajib diverifikasi menggunakan kode OTP 6-digit** sebelum transaksi akun/pembayaran dapat diterbitkan.

---

### 2. KOMPONEN UTAMA & SPESIFIKASI ARSITEKTUR

#### A. Proteksi Domain Email Disposable (Anti-Dummy Validator)
- **Lokasi**: [`pos_apps/server/src/utils/disposableEmailValidator.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/utils/disposableEmailValidator.ts)
- **Karakteristik**:
  - Memuat *in-memory Set* dari 3.000+ domain email sekali pakai (*temporary/disposable*) terpopuler dunia (seperti `mailinator.com`, `tempmail.com`, `guerrillamail.com`, `10minutemail.com`, `yopmail.com`, `sharklasers.com`, dll).
  - Validasi sintaks ketat sesuai RFC 5322.
  - Memblokir email dummy baik di frontend (`SaasLandingPage.tsx`) dengan *instant badge warning* maupun di backend controller sebelum OTP dikirimkan.

#### B. Model Database & Auto-Schema Patcher
- **Model Prisma**: `EmailVerification` pada tabel PostgreSQL `email_verifications`.
- **Kolom**:
  - `id` (UUID Primary Key)
  - `email` (VARCHAR 255)
  - `otp_hash` (TEXT, Bcrypt Hash dari 6 digit angka OTP)
  - `expires_at` (TIMESTAMP, masa berlaku 10 menit)
  - `is_verified` (BOOLEAN, default `false`)
  - `verified_at` (TIMESTAMP, waktu verifikasi berhasil)
  - `attempts` (INTEGER, proteksi brute-force maksimal 5x percobaan)
  - `created_at` (TIMESTAMP)
- **Patch DDL Idempotent**: Terdaftar di [`pos_apps/server/src/migrations/schema_patcher.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/migrations/schema_patcher.ts) dengan ID `20261013_01_email_verifications`.

#### C. Layanan Pengiriman Email Transaksional (Nodemailer Service)
- **Lokasi**: [`pos_apps/server/src/services/mail.service.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/services/mail.service.ts)
- **Fitur Transporter**:
  - Mendukung konfigurasi SMTP kustom via environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`).
#### C. Layanan Pengiriman Email Transaksional (Nodemailer & Resend Engine)
- **Lokasi**: [`pos_apps/server/src/services/mail.service.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/services/mail.service.ts)
- **Fitur Transporter & Multi-Provider Relay**:
  - Integrasi native Resend REST API (HTTPS port 443) untuk pengiriman instan anti-port blocking.
  - SMTP Relay fallback via `smtp.resend.com` (SSL Port 465 / TLS Port 587).
  - Fallback otomatis ke akun Ethereal / konsol lokal saat kredensial production belum dipasang.
- **Enam Template Email Kanonikal**:
  1. `sendVerificationOtpEmail`: Kode OTP 6-digit pendaftaran akun dari `noreply@wellpos.id` (Security).
  2. `sendWelcomeAndReceiptEmail`: Kartu sambutan resmi & bukti bayar pendaftaran dari `billing@wellpos.id` (Billing).
  3. `sendTokenTopUpInvoiceEmail`: Bukti pembayaran & penambahan kuota token transaksi resmi dari `billing@wellpos.id` (Billing).
  4. `sendPasswordResetOtpEmail`: Kode OTP 6-digit pemulihan kata sandi akun dari `noreply@wellpos.id` (Security).
  5. `sendPasswordChangedNotificationEmail`: Notifikasi konfirmasi pengubahan kata sandi & penarikan sesi login aktif dari `noreply@wellpos.id` (Security).
  6. `sendPlatformBroadcastEmail`: Surat pengumuman resmi platform / pemeliharaan sistem dari `noreply@wellpos.id` (System) dengan `helpcare@wellpos.id` sebagai kanal balasan bantuan.

#### D. Integrasi Billing & Webhook Faktur Token (Modul 2)
- **Lokasi Layanan**: [`pos_apps/server/src/services/billing.service.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/services/billing.service.ts) & [`pos_apps/server/src/controllers/saas.controller.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/controllers/saas.controller.ts)
- **Pemicu Pengiriman Otomatis (`billing@wellpos.id`)**:
  - **Webhook Pakasir Settlement**: Saat webhook QRIS Pakasir tiba dan invoice `INV-TOKEN-*` berstatus settlement/completed, kuota token aktif di DB dan bukti faktur resmi otomatis dikirim ke email pemilik akun (`ADMIN`).
  - **Verifikasi Manual Superadmin**: Saat Superadmin memvalidasi pembayaran transfer manual untuk invoice token, email bukti pembayaran otomatis dikirim ke email pemilik akun.
  - **Top-Up Gratis (100% Promo Code)**: Saat top-up token menggunakan kode promo diskon 100% (bebas biaya), faktur lunas dan bukti aktivasi token langsung dikirim ke email pemilik akun.

#### E. Siaran Notifikasi & Pemeliharaan Sistem Superadmin (Modul 3)
- **Lokasi Layanan**: [`pos_apps/server/src/controllers/platform.controller.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/controllers/platform.controller.ts) & [`pos_apps/client/src/pages/SuperadminDashboardPage.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/SuperadminDashboardPage.tsx)
- **Fitur Siaran Email Resmi (`noreply@wellpos.id`)**:
  - Modal pengumuman platform Superadmin dilengkapi opsi checkbox: *"Kirimkan juga sebagai Siaran Email Resmi (Broadcast) ke Pemilik Toko"*.
  - Mendukung 4 jenis pengumuman dengan tema header dan badge khusus:
    - `MAINTENANCE`: Latar cokelat tua / emas (#78350f / #f59e0b) untuk jadwal pemeliharaan server & down time.
    - `WARNING`: Latar merah marun (#881337 / #f43f5e) untuk peringatan keamanan & operasional penting.
    - `UPDATE`: Latar zamrud tua (#064e3b / #10b981) untuk rilis fitur baru & changelog aplikasi.
    - `INFO`: Latar biru laut tua (#1e3a8a / #3b82f6) untuk pengumuman umum manajemen.
  - Target seleksi distribusi: Semua pemilik toko aktif (`target: 'ALL'`) atau toko spesifik (`target: 'SPECIFIC'`).

#### F. Endpoints API SaaS & Autentikasi
- `POST /api/saas/otp/send`: Memvalidasi email, memeriksa duplikasi akun, membatasi rate-limit (60s cooldown), dan mengirimkan 6 digit OTP pendaftaran.
- `POST /api/saas/otp/verify`: Mencocokkan input OTP pendaftaran dengan hash di DB, menghitung percobaan (*attempts*), dan menetapkan status `isVerified = true`.
- `POST /api/saas/register`: Mengharuskan verifikasi email aktif dalam 60 menit terakhir sebelum mengizinkan pembuatan tenant & faktur QRIS Pakasir.
- `POST /api/auth/password/reset/request`: Meminta OTP 6-digit pemulihan kata sandi dengan proteksi OWASP anti-enumerasi email dan cooldown 60 detik.
- `POST /api/auth/password/reset/confirm`: Memverifikasi kode OTP, memperbarui `passwordHash`, dan menginkremen `tokenVersion` untuk mencabut seluruh sesi login lama secara otomatis.
- `POST /api/platform/notifications`: Menerbitkan pengumuman platform, menyiarkan ke lonceng notifikasi Backoffice, dan menyiarkan email broadcast jika `sendEmailBroadcast: true`.

#### G. Antarmuka Form Pendaftaran, Pemulihan Akun & Superadmin (Client PWA)
- **Lokasi Form Pendaftaran**: [`pos_apps/client/src/pages/SaasLandingPage.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/SaasLandingPage.tsx)
  - Tombol **"Kirim OTP"** / **"Kirim Ulang (Xs)"** dengan timer hitung mundur 60 detik.
  - Kotak verifikasi OTP 6 digit monospaced angka besar dengan tombol **"Verifikasi OTP"**.
  - Badge sukses: `✓ Terverifikasi` warna hijau zamrud (*emerald*) yang mengunci input email agar tidak tertukar.
- **Lokasi Portal Pemilik / Login**: [`pos_apps/client/src/pages/LoginPage.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/LoginPage.tsx)
  - Tombol **"Lupa kata sandi?"** pada tab Portal Pemilik.
  - Alur 2-Langkah terintegrasi di dalam satu kontainer (Zero Stacked Modals):
    - **Langkah 1**: Input email & tombol Kirim Kode OTP dengan cooldown 60 detik.
    - **Langkah 2**: Input OTP 6-digit monospaced, Kata Sandi Baru (dengan toggle lihat/sembunyikan), dan Konfirmasi Kata Sandi.
    - Notifikasi sukses berwarna emerald dengan auto-prefill email ke formulir login.
- **Lokasi Portal Superadmin**: [`pos_apps/client/src/pages/SuperadminDashboardPage.tsx`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/client/src/pages/SuperadminDashboardPage.tsx)
  - Checkbox toggle siaran email resmi di modal notifikasi dengan indikator target toko.

---

### 3. PENGUJIAN END-TO-END (VERIFICATION RESULTS)

1. **Test E2E Registrasi OTP**: [`pos_apps/server/src/scripts/test_email_otp_e2e.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/scripts/test_email_otp_e2e.ts)
   - Status: **PASSED (100% 6/6 Disposable Domains Blocked, OTP Lifecycle Verified)**.
2. **Test E2E Reset Password**: [`pos_apps/server/src/scripts/test_password_reset_e2e.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/scripts/test_password_reset_e2e.ts)
   - Status: **PASSED (100% Disposable Blocked, Wrong OTP Attempts Throttled, Password Hash & TokenVersion Updated)**.
3. **Test E2E Faktur Top-Up Token**: [`pos_apps/server/src/scripts/test_token_topup_email_e2e.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/scripts/test_token_topup_email_e2e.ts)
   - Status: **PASSED (100% Faktur Top-Up Terkirim via billing@wellpos.id, Webhook Pakasir Settlement & DB Cleanup Verified)**.
4. **Test E2E Broadcast Superadmin**: [`pos_apps/server/src/scripts/test_platform_broadcast_email_e2e.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/scripts/test_platform_broadcast_email_e2e.ts)
   - Status: **PASSED (100% Siaran Maintenance & Rilis Update Terkirim via noreply@wellpos.id)**.
5. **Test Live Resend In-Inbox**: [`pos_apps/server/src/scripts/test_live_resend.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/scripts/test_live_resend.ts)
   - Status: **PASSED (Delivered to real recipient inbox via Resend Tokyo REST API)**.
6. **Build Server**: `tsc` exit code 0.
7. **Build Client**: `tsc -b && vite build` exit code 0.


