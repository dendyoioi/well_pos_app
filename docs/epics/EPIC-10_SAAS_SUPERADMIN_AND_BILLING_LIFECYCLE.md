# EPIC-10: SAAS MANAGEMENT PLATFORM, SUPERADMIN PORTAL & AUTOMATED BILLING LIFECYCLE
## Portal Pengelola Well POS SaaS, Manajemen Tenant, & Otomasi Langganan Klien

**Epic ID**: `EPIC-10`  
**Status**: **COMPLETED ✅**  
**Prioritas**: **P4 — HIGH COMMERCIAL VALUE (SAAS MONETIZATION)**  
**Target Komponen**: `pos_apps/server` & SuperAdmin UI (`admin.wellpos.id`)  
**Dokumen Induk**: [`docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md`](file:///Users/dendyaditya/Projects/pos_project/docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md)  
**Dokumen Arsitektur Rujukan**: `Product Plan/07_Well_POS_SaaS_vs_POS_Architecture_and_RBAC.md`  

---

### 1. DESKRIPSI & TUJUAN BISNIS
Sebagai platform Multi-Tenant SaaS komersial mandiri, Well POS mengoperasikan backoffice pusat (*SuperAdmin Platform*) untuk memantau ratusan/ribuan gerai toko klien, memantau pendapatan berulang bulanan (*Monthly Recurring Revenue / MRR*), mengelola master paket lisensi, dan mengotomatiskan siklus penagihan dan pemblokiran toko yang menunggak (*Auto-Suspension*).

Tujuan **EPIC-10** adalah:
1. **Portal SuperAdmin (`admin.wellpos.id`)**: Antarmuka terdedikasi bagi tim SuperAdmin internal untuk memantau metrik bisnis SaaS (Total Tenant, Toko Aktif, Toko Ditangguhkan, Total Omzet, Proyeksi MRR), direktori tenant, pengesahan calon merchant (*Approval*), audit/impersonasi toko klien, dan reset kata sandi owner.
2. **Onboarding Mandiri Klien (*Self-Service Registration*)**: Alur registrasi publik bagi calon mitra toko baru dengan inisialisasi master data otomatis (Gudang Utama, Toko Cabang Utama, Akun Owner, Default Kategori/Produk) dan penetapan masa uji coba (*14-day Free Trial*).
3. **Billing Engine & Payment Gateway**:
   - Pembuatan tagihan otomatis (*SaaS Invoices*) perpanjangan/upgrade paket (FREE, PRO, ENTERPRISE).
   - Integrasi webhook payment gateway Midtrans / Xendit (`POST /api/saas/billing/webhook`) dengan pemrosesan idempotency, pembaruan invoice ke `PAID`, pencatatan `saas_payments`, dan aktivasi otomatis `tenant_subscriptions`.
   - Fasilitas verifikasi manual transfer bank oleh SuperAdmin.
4. **Enforcement Siklus Lisensi Otomatis (*License Lifecycle Worker*)**:
   - Transisi siklus: `ACTIVE` ➔ `DUE_NOTICE` (H-3 sebelum habis) ➔ `GRACE_PERIOD` (tenggang 3 hari) ➔ `SUSPENDED` (pemblokiran akses operasional kasir jika belum membayar setelah masa tenggang habis).
   - Middleware `verifyTenantLicense` yang otomatis mengunci kasir dengan error HTTP 403 `SUBSCRIPTION_LOCKED` jika toko bersuspensi.

---

### 2. SPRINT EXECUTION RECORD & TASKS

- [x] **Task 10.1: SuperAdmin Dashboard & Tenant Oversight**
  - Penyelesaian error kolom drift `P2022` pada tabel SaaS (`platform_users`, `subscription_plans`, `tenant_subscriptions`, `saas_invoices`, `saas_payments`, `tenants`) dan regenerasi Prisma Client.
  - Endpoint `GET /api/platform/dashboard`: Menghitung total tenant, tenant aktif, trial, suspended, total outlet, order, dan proyeksi MRR real-time.
  - Endpoint `GET /api/platform/tenants`: Direktori tenant dengan filter status dan pencarian search query.
  - Endpoint `PUT /api/platform/tenants/:id/status`: Approval pendaftaran tenant baru atau suspend tenant secara manual, dilengkapi simulasi pengiriman email konfirmasi ke owner.
  - Endpoint `POST /api/platform/tenants/:id/impersonate`: Audit aman bagi tim support untuk masuk ke dasbor toko mitra.
  - Endpoint `POST /api/platform/tenants/:id/reset-password`: Setel ulang kata sandi owner toko yang lupa sandi.
  - Endpoint `GET /api/platform/plans`: Master paket langganan (FREE, STARTER, PRO, ENTERPRISE).
- [x] **Task 10.2: Self-Service Tenant Onboarding Wizard**
  - Endpoint `POST /api/saas/register`: Pendaftaran publik mandiri mitra toko baru dengan verifikasi keunikan email & slug, hashing password bcrypt, dan pembuatan entitas atomik (Tenant `PENDING`, Gudang Utama, Toko Utama, Akun Owner).
  - Endpoint `POST /api/saas/onboarding`: Wizard penyesuaian detail alamat, nomor telepon, pengaturan struk, dan produk perdana.
  - Endpoint `GET /api/saas/subscription`: Dashboard status lisensi toko bagi pemilik merchant (nama paket, status aktif, sisa hari, kuota outlet/kasir).
- [x] **Task 10.3: Subscription Billing & Payment Gateway Integration**
  - Service `billing.service.ts`:
    - Pembuatan invoice SaaS dengan nomor format `INV-SAAS/YYYYMMDD/XXXX`.
    - Endpoint `POST /api/saas/invoices`: Tenant membuat tagihan untuk perpanjangan / upgrade paket PRO.
    - Endpoint `GET /api/saas/invoices`: Riwayat tagihan toko.
    - Endpoint `POST /api/saas/billing/webhook`: Handler webhook Midtrans / Xendit dengan validasi idempotency, pembaruan status `PAID`, pembuatan entri `saas_payments`, dan perpanjangan `expires_at` pada `tenant_subscriptions` (+30 hari).
    - Endpoint `GET /api/platform/invoices`: Monitoring seluruh invoice SaaS di platform.
    - Endpoint `POST /api/platform/invoices/:id/verify-payment`: Verifikasi manual invoice oleh SuperAdmin.
- [x] **Task 10.4: Automated License Worker (Cron Jobs & Enforcement)**
  - Service `licenseWorker.service.ts`:
    - Engine evaluasi siklus hidup langganan yang dapat dijalankan terjadwal via cron atau dipicu via endpoint `POST /api/platform/subscriptions/evaluate-lifecycle`.
    - Evaluasi bertahap:
      1. `DUE_NOTICE`: Notifikasi peringatan saat sisa masa aktif <= 3 hari.
      2. `GRACE_PERIOD`: Masa tenggang toleransi kasir beroperasi selama 3 hari setelah tanggal berakhir terlewati.
      3. `SUSPENDED`: Pemblokiran otomatis toko dan penonaktifan lisensi jika melewati masa tenggang.
    - Middleware `verifyTenantLicense`: Menolak seluruh transaksi kasir toko bersuspensi dengan HTTP 403 `SUBSCRIPTION_LOCKED`.

---

### 3. ARSITEKTUR TEKNIS & API ENDPOINTS

#### Controller & Services:
- `pos_apps/server/src/services/billing.service.ts`: Service pembuatan invoice, webhook callback gateway, dan audit pembayaran.
- `pos_apps/server/src/services/licenseWorker.service.ts`: Evaluator siklus hidup lisensi toko, masa tenggang, dan suspensi otomatis.
- `pos_apps/server/src/controllers/platform.controller.ts`: Controller API SuperAdmin Platform Level 1 (`/api/platform/*`).
- `pos_apps/server/src/controllers/saas.controller.ts`: Controller API Tenant Onboarding & Merchant Subscription (`/api/saas/*`).

#### REST API Endpoints:
| Method | Endpoint | Hak Akses | Deskripsi |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/platform/auth/login` | Publik | Autentikasi login SuperAdmin platform |
| `GET` | `/api/platform/dashboard` | SuperAdmin | Metrik KPI platform (Tenants, Orders, MRR) |
| `GET` | `/api/platform/tenants` | SuperAdmin | Direktori seluruh tenant toko klien |
| `GET` | `/api/platform/tenants/:id` | SuperAdmin | Rincian detail profil & riwayat transaksi tenant |
| `PUT` | `/api/platform/tenants/:id/status` | SuperAdmin | Approval tenant baru atau ubah status (ACTIVE/SUSPENDED) |
| `PUT` | `/api/platform/tenants/:id/subscription` | SuperAdmin | Penambahan masa aktif lisensi manual |
| `POST` | `/api/platform/tenants/:id/impersonate` | SuperAdmin | Pembuatan token login impersonasi toko |
| `POST` | `/api/platform/tenants/:id/reset-password` | SuperAdmin | Setel ulang kata sandi pemilik toko |
| `GET` | `/api/platform/plans` | SuperAdmin | Master paket langganan SaaS |
| `GET` | `/api/platform/invoices` | SuperAdmin | Seluruh invoice langganan platform |
| `POST` | `/api/platform/invoices/:id/verify-payment` | SuperAdmin | Verifikasi bukti transfer manual |
| `POST` | `/api/platform/subscriptions/evaluate-lifecycle` | SuperAdmin | Manual trigger evaluasi cron lisensi |
| `POST` | `/api/saas/register` | Publik | Registrasi mandiri pemilik toko baru |
| `POST` | `/api/saas/onboarding` | Merchant Owner | Wizard setup outlet, gudang, dan produk awal |
| `GET` | `/api/saas/subscription` | Merchant Owner | Status masa aktif lisensi toko |
| `POST` | `/api/saas/invoices` | Merchant Owner | Pembuatan tagihan langganan baru |
| `GET` | `/api/saas/invoices` | Merchant Owner | Riwayat invoice toko |
| `POST` | `/api/saas/billing/webhook` | Publik (Gateway) | Callback webhook Midtrans / Xendit |

---

### 4. HASIL VERIFIKASI PENGUJIAN OTOMATIS

File uji: `pos_apps/server/src/migrations/contract/test_epic10_saas_lifecycle.ts`

```text
===============================================================
EPIC-10 VERIFICATION SUITE: SAAS SUPERADMIN & BILLING LIFECYCLE
===============================================================

[1/7] Verifying SuperAdmin Platform Authentication...
  ✅ SuperAdmin Token Verified: Superadmin Well POS Platform (superadmin@wellpos.id)
  Role: SUPER_ADMIN | Auth Status: 200 OK

[2/7] Verifying SuperAdmin SaaS Metrics & Plans...
  Total Tenants     : 2
  Active Tenants    : 1
  Trial Tenants     : 0
  Total Outlets     : 4
  Total Orders      : 52
  Projected MRR     : Rp 129.000
  Available Plans   : FREE (Rp 0), STARTER (Rp 99.000), PRO (Rp 129.000), ENTERPRISE (Rp 699.000)
  ✅ SuperAdmin KPI & Master Plans verified!

[3/7] Verifying Self-Service Tenant Onboarding Wizard...
  ✅ Tenant Registered: Kopi Senja Bahagia 2874 (Slug: kopi-senja-bahagia-2874)
     Tenant Status: PENDING (Awaiting SuperAdmin Approval)
     Owner User   : Budi Santoso (owner.senja.2874@kopi.id)
     Default Store: Toko Utama - Kopi Senja Bahagia 2874

[4/7] Verifying SuperAdmin Approval & Impersonation...
  ✅ Tenant Approved by SuperAdmin! Status: ACTIVE
     Simulated Email to Client: "Selamat! Akun Bisnis "Kopi Senja Bahagia 2874" Telah Disetujui & Aktif"
  ✅ Tenant Impersonation Successful! Token issued for: Budi Santoso
     Impersonated By: Superadmin Well POS Platform

[5/7] Verifying SaaS Invoice Generation (Upgrade to PRO)...
  ✅ SaaS Invoice Generated: INV-SAAS/20260921/1277
     Plan: Well POS Pro Bisnis (PRO)
     Amount: Rp 129.000
     Status: UNPAID
     Payment URL: https://checkout.wellpos.id/pay/INV-SAAS/20260921/1277

[6/7] Verifying Payment Gateway Webhook & Auto-Activation...
  ✅ Payment Webhook Processed: Pembayaran sukses, lisensi paket Well POS Pro Bisnis aktif sampai 2026-11-04
     Invoice Status: PAID
     New Expiration: 2026-11-04
  ✅ Idempotency Verified: Invoice INV-SAAS/20260921/1277 sudah dibayar sebelumnya
  ✅ Client License Confirmed: Well POS Pro Bisnis (Active: true, Days Remaining: 44)

[7/7] Verifying Automated License Lifecycle Worker & Auto-Suspension...
  Lifecycle Run 1 (Current Time): 2 Active, 0 Grace, 0 Suspended
  Lifecycle Run 2 (Simulated Future +45 Days):
    Grace Period Count: 2
    ✅ Tenant Kopi Senja Bahagia 2874 entered Grace Period: "Dalam masa tenggang (Grace period hari ke-2)"
  Lifecycle Run 3 (Simulated Future +55 Days):
    Suspended Count: 2
    ✅ Tenant Kopi Senja Bahagia 2874 auto-suspended: "Jatuh tempo terlewati 11 hari (Grace period 3 hari habis)"
    ✅ POS Access Successfully Blocked: HTTP 403 Forbidden [SUBSCRIPTION_LOCKED]
       Message: "Masa aktif Well POS untuk "Kopi Senja Bahagia 2874" telah berakhir atau dibekukan. Silakan lakukan pembayaran tagihan untuk membuka akses operasional kasir."

===============================================================
🎉 EPIC-10 VERIFICATION COMPLETE: ALL 7/7 MODULES PASSED!
===============================================================
```
