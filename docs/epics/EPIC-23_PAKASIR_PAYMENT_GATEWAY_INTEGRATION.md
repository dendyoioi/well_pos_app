# EPIC-23: Integrasi Payment Gateway Pakasir.com (Direct QRIS & Webhook)
## Pembayaran Pendaftaran Awal Tenant & Top-Up Kuota Token Pesanan (Pay-As-You-Go)

**Dokumen Rujukan**: [`docs/00_PROJECT_CONTEXT.md`](../00_PROJECT_CONTEXT.md)  
**Dokumen Terkait**: [`EPIC-10_SAAS_SUPERADMIN_AND_BILLING_LIFECYCLE.md`](./EPIC-10_SAAS_SUPERADMIN_AND_BILLING_LIFECYCLE.md), [`EPIC-14_DECOUPLED_OWNER_IDENTITY_AND_SPLIT_REGISTRATION.md`](./EPIC-14_DECOUPLED_OWNER_IDENTITY_AND_SPLIT_REGISTRATION.md)  
**Status**: **COMPLETED (100% Selesai & Teruji di Mode Sandbox) ✅**  
**Terakhir Diperbarui**: 30 September 2026  

---

### 1. RINGKASAN & NILAI BISNIS (EXECUTIVE SUMMARY)

EPIC-23 menghubungkan sistem SaaS Well POS dengan **Payment Gateway Pakasir.com (API v2)** untuk mengotomatiskan penerimaan pembayaran secara non-tunai (khususnya **Direct QRIS** dinamis & Webhook callback).

Fitur ini mencakup 2 skenario bisnis utama:
1. **Pendaftaran Awal & Approval Super Admin (Rp 99.000 + 100 Bonus Token)**:
   * Calon pemilik bisnis mendaftar secara mandiri di Landing Page dan akun berstatus `PENDING` ("Menunggu Approval Super Admin").
   * Ketika Super Admin menyetujui (approve) akun di portal Superadmin:
     * Invoice aktivasi resmi sebesar **Rp 99.000** tercatat lunas (`PAID`) dengan nomor `INV-REG-...`.
     * Calon pemilik langsung memperoleh **100 Bonus Token Transaksi** yang siap dipakai saat toko dibuka.
     * Status `Tenant` otomatis berubah menjadi `ACTIVE`.
     * `TenantSubscription` langsung aktif (periode 30 hari).
2. **Top-Up Kuota Token Pesanan via Pakasir.com (Direct QRIS & Webhook)**:
   * Tenant aktif dapat melakukan pembelian kuota pesanan tambahan dari menu Backoffice **"Paket & Kuota"** (`BillingTokensView.tsx`).
   * Pembayaran diproses dengan menerbitkan invoice `UNPAID` dan menampilkan kode **Direct QRIS Pakasir** beserta batas kedaluwarsa.
   * Auto-polling status dan Webhook Pakasir otomatis memperbarui kuota token begitu transaksi berstatus `completed`.
   * Dilengkapi tombol simulator sandbox untuk uji coba instan.

---

### 2. KREDENSIAL & SPESIFIKASI TEKNIS PAKASIR API v2

* **Slug Proyek**: `wellposdev`
* **API Key**: `vDSvureIrzkKGjuzmIwu2GJwutMMzdNj`
* **Webhook Secret**: `a5da553214d1f9e9b072b429f076a0b7`
* **Base URL**: `https://app.pakasir.com`

#### Endpoints Kanonikal Terpasang:
| Endpoint POS | Metode | Deskripsi | Target Pakasir v2 |
| :--- | :---: | :--- | :--- |
| `/api/saas/register` | `POST` | Pendaftaran akun baru $\rightarrow$ terbitkan invoice `INV-REG-...` (Rp 99.000) & request Direct QRIS | `POST /api/v2/create-transaction/{slug}/{order_id}` |
| `/api/saas/subscription/top-up` | `POST` | Top-up kuota token $\rightarrow$ terbitkan invoice `INV-TOKEN-...` & request Direct QRIS | `POST /api/v2/create-transaction/{slug}/{order_id}` |
| `/api/saas/pakasir/webhook` | `POST` | Menerima callback HTTP POST saat pembayaran `completed`, verifikasi header `X-Secret` | Webhook resmi Pakasir |
| `/api/saas/pakasir/status/:invoiceNumber` | `GET` | Polling real-time status pembayaran oleh modal QRIS frontend (auto-sinkronisasi ke Pakasir) | `GET /api/v2/transaction-status/{slug}/{txn_id}` |
| `/api/saas/pakasir/simulate-sandbox-pay` | `POST` | Simulator instan pembayaran sandbox untuk pengujian lokal tanpa transfer dana nyata | Internal testing runner |

---

### 3. PERUBAHAN SKEMA BASIS DATA & MIGRATION PATCH

Telah didaftarkan migrasi aman pada `src/migrations/schema_patcher.ts` (`20260930_02_saas_invoices_pakasir`):
```sql
ALTER TABLE "saas_invoices" 
  ADD COLUMN IF NOT EXISTS "qr_string" TEXT,
  ADD COLUMN IF NOT EXISTS "external_txn_id" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "payment_gateway" VARCHAR(50) DEFAULT 'PAKASIR';
```

---

### 4. KOMPONEN ANTARMUKA (ZERO STACKED MODALS & CLEAN UX)

1. **`PakasirDirectQrisModal.tsx`**:
   * Menampilkan nominal tagihan yang tajam, badge kuota token, kode QRIS resolusi tinggi (via SVG/PNG QR Generator kanonikal), dan batas kedaluwarsa.
   * Dilengkapi indikator detak live polling (setiap 4 detik) dan tombol bantuan *⚡ Simulasi Bayar QRIS (Sandbox Test)*.
   * State sukses menampilkan selebrasi centang hijau dan tombol navigasi langsung.
2. **Penyelarasan `SaasLandingPage.tsx`**:
   * Modal pendaftaran otomatis beralih ke Direct QRIS tanpa modal bertumpuk.
3. **Penyelarasan `BillingTokensView.tsx`**:
   * Metode pembayaran default diarahkan ke QRIS Pakasir.
   * Menampilkan QRIS dinamis per transaksi invoice.

---

### 5. HASIL VERIFIKASI & PENGUJIAN

* **TypeScript Compilation**: `npm run build` berhasil (Exit Code 0) di `pos_apps/server` dan `pos_apps/client`.
* **Automated Integration Test**: `pos_apps/server/src/scripts/test_pakasir_integration.ts` lulus 100% mencakup:
  1. Validasi komunikasi API Pakasir v2.
  2. Guard keamanan Webhook Secret (`X-Secret`).
  3. Pelunasan transaksi pendaftaran & aktivasi otomatis tenant `PENDING` $\rightarrow$ `ACTIVE`.
  4. Akumulasi kuota token (100 token pendaftaran + 2.000 token top-up = 2.100 token).
  5. Idempotensi webhook terhadap pengiriman notifikasi ganda.

---

### 6. PENGELOLAAN TARIF TOKEN, BATAS MINIMUM & KONTROL QRIS SUPERADMIN (DYNAMIC CONFIG)

Pembaruan arsitektur pada konfigurasi SaaS platform (`platform_payment_config.json`):
1. **Harga Acuan Dinamis**:
   * Default tarif acuan ditetapkan **Rp 69 / token** (dapat diubah dinamis kapan saja oleh Superadmin).
2. **Batas Minimal Pembelian**:
   * Minimum order ditetapkan **250 token** ($250 \times \text{Rp } 69 = \text{Rp } 17.250$).
   * Paket kuota preset default disesuaikan:
     * **Starter**: +250 Token (Rp 17.250)
     * **Basic**: +1.000 Token (Rp 69.000)
     * **Pro (Populer)**: +2.500 Token (Rp 172.500)
     * **Enterprise**: +5.000 Token (Rp 345.000)
3. **Eksklusivitas QRIS & Eliminasi Transfer Manual**:
   * Opsi Transfer Manual ke rekening bank ditiadakan secara permanen dari modal Top-Up Owner (`BillingTokensView.tsx`).
   * Tersedia sakelar Superadmin **Aktifkan / Nonaktifkan QRIS** (`qrisEnabled`). Jika dinonaktifkan, modal sisi Owner secara otomatis menampilkan status pemeliharaan dan menonaktifkan proses *checkout*.
4. **Voucher Diskon B2B (`SaaSPromo`)**:
   * Terintegrasi penuh dengan kalkulasi dinamis (`tokenAmount * tokenPrice`).
   * Superadmin dapat menerbitkan voucher persentase diskon, potongan nominal rupiah, maupun bonus kuota token secara mandiri dari tab **PROMOS**.

---

### 7. PENGELOLAAN KATALOG PAKET KUOTA PAY-AS-YOU-GO AKTIF (CUSTOM NAMING & PACKAGES)

Fitur pengelolaan katalog mandiri oleh Superadmin pada Tab **PLANS** (`SuperadminDashboardPage.tsx`):
1. **Penamaan Paket Sendiri (*Custom Naming*)**:
   * Superadmin bebas memberi nama paket kustom (contoh: *"Starter 250"*, *"Paket Usaha Siap Cuan"*, *"Paket Ramadhan Berkah"*, *"Paket Warkop Mantap"*).
2. **Fleksibilitas Kuota & Harga**:
   * Superadmin dapat menentukan jumlah kuota token secara bebas (misal 250, 1.000, 2.500, 5.000, 10.000, dst.).
   * Opsi penentuan harga:
     * **Kalkulasi Otomatis**: $\text{Token} \times \text{Tarif Dasar Platform (Rp 69/token)}$.
     * **Harga Kustom / Promo**: Superadmin dapat mengunci nominal harga khusus (misal diskon bundling khusus).
3. **Badge & Penanda Populer**:
   * Kolom badge kustom (misal *"⭐ Paling Diminati"*, *"Diskon 10%"*, *"Trial Ramah"*, *"Rekomendasi"*).
   * Tombol *highlight* paket populer dengan aksen visual gradien dan elevasi bayangan halus.
4. **Sinkronisasi Otomatis ke Backoffice Owner**:
   * Setiap kali Superadmin menambah, mengubah, atau menghapus paket, data otomatis tersimpan di `platform_payment_config.json` via endpoint `api.updatePlatformPaymentSettings()`.
   * Pilihan paket pada modal Top-Up Kuota Owner (`BillingTokensView.tsx`) langsung menampilkan nama kustom, badge, dan harga terbaru secara *real-time*.


