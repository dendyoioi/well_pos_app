# EPIC-25: Automated WhatsApp Gateway & Digital Receipt Engine (Fonnte API)

**Dokumen Terkait**:
- [`docs/00_PROJECT_CONTEXT.md`](../00_PROJECT_CONTEXT.md)
- [`docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md`](./00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md)
- Service: [`pos_apps/server/src/services/whatsapp.service.ts`](../../pos_apps/server/src/services/whatsapp.service.ts)
- Controller: [`pos_apps/server/src/controllers/order.controller.ts`](../../pos_apps/server/src/controllers/order.controller.ts) & [`platform.controller.ts`](../../pos_apps/server/src/controllers/platform.controller.ts)
- Frontend: [`OrderSuccessModal.tsx`](../../pos_apps/client/src/components/OrderSuccessModal.tsx), [`ReceiptSettingsView.tsx`](../../pos_apps/client/src/pages/ReceiptSettingsView.tsx), [`SuperadminDashboardPage.tsx`](../../pos_apps/client/src/pages/SuperadminDashboardPage.tsx)

---

## 1. Latar Belakang & Nilai Bisnis
Sebelumnya, pengiriman bukti pembayaran (struk belanja) via WhatsApp bergantung pada pembukaan aplikasi WhatsApp secara manual melalui skema deep link browser (`wa.me` / `api.whatsapp.com/send`). Alur ini memperlambat antrean kasir, mengharuskan perangkat kasir membuka tab baru WhatsApp Web, serta tidak memungkinkan pengiriman struk otomatis di latar belakang saat checkout.

**EPIC-25** menghadirkan integrasi WhatsApp Gateway resmi berbasis **Fonnte API** (`https://api.fonnte.com/send`) dengan arsitektur **Multi-Level Key Resolution** dan **Sandbox Simulator Fallback**:
1. **Otomasi Pengiriman Kasir**: Struk belanja langsung terkirim otomatis di background saat checkout jika nomor WhatsApp pelanggan tersedia dan fitur auto-send diaktifkan.
2. **Pemicu Manual Kasir (1-Click Dispatch)**: Kasir dapat memicu pengiriman ulang instan via gateway langsung dari `OrderSuccessModal.tsx` tanpa membuka WhatsApp Web, lengkap dengan status feedback real-time.
3. **Hierarki Token Multi-Level**:
   - **Tingkat Toko (Merchant)**: Merchant dapat memasukkan token Fonnte pribadi di menu Backoffice Format Struk agar kuota terpotong dari akun mereka sendiri.
   - **Tingkat Platform (Superadmin)**: Jika merchant tidak memiliki token, sistem otomatis fallback menggunakan token gateway platform yang dikelola Superadmin.
   - **Tingkat Sandbox (Simulator)**: Jika tidak ada token yang terpasang sama sekali, sistem secara cerdas beralih ke Mode Simulator tanpa menimbulkan crash atau error pada transaksi.
4. **Pemberitahuan Format Struk Rapi**: Pesan terformat standar WhatsApp markdown (`*bold*`, monospace) mencantumkan nomor antrean, nama toko, daftar item, subtotal, diskon promo, tukar poin loyalitas, PPN, grand total, dan rincian tender pembayaran.

---

## 2. Arsitektur Teknis & Endpoint API

### 2.1 Backend Routing & Services
- **Backend Service**: `whatsapp.service.ts`
  - Normalisasi nomor telepon Indonesia (`+628...` -> `628...`, `08...` -> `628...`).
  - Resolusi token hirarkis: Toko -> Platform (`data/platform_whatsapp_config.json`) -> Simulator Sandbox.
  - Builder teks struk kanonikal WhatsApp.
  - Driver Fonnte API via Node 20 Native `fetch`.
  - Pengecekan perangkat / uji coba koneksi gateway.
- **Order Controller & Routes**:
  - Auto-send di background saat `POST /api/orders/checkout`.
  - Manual trigger: `POST /api/orders/:id/send-whatsapp` (Body: `{ phone?: string }`).
- **Platform Controller & Routes**:
  - `GET /api/platform/whatsapp/settings` (Superadmin only).
  - `PUT /api/platform/whatsapp/settings` (Superadmin only).
  - `POST /api/platform/whatsapp/test` (Superadmin test dispatch).
- **Outlet Controller**:
  - Menerima konfigurasi `receiptConfig.whatsappConfig` (enabled, provider, usePlatformFallback, apiKey, senderNumber).

### 2.2 Frontend Experience & Responsive Architecture
- **Kasir Modal Sukses (`OrderSuccessModal.tsx`) — Zero Stacked Modals**:
  - Tombol WhatsApp beralih ke sub-view WhatsApp secara inline di dalam modal card yang sama (tidak membuka modal di atas modal / bebas benturan header dan tombol `X`).
  - **Scrollable Chat Container (`min-h-0 overflow-y-auto`)**: Layout chat bubble struk dibungkus container elastis dengan header dan action panel terkunci (`shrink-0`), menjamin nota belanja sepanjang apa pun tidak akan mendorong header atau tombol keluar layar (*zero layout clipping*).
  - **Pemisahan Peran Kasir vs Owner (Role Boundary Principle)**:
    - **Kasir (`OrderSuccessModal.tsx`)**: Mengutamakan kecepatan antrean kasir dengan *zero cognitive overhead*. Tidak dibebani panduan teknis API atau tutorial pihak ketiga. Kasir disajikan tombol aksi cepat: **`[Buka wa.me]`** (membuka WhatsApp kasir dengan nota lengkap siap kirim) dan **`[Salin Teks]`**, atau **`[⚡ Kirim Otomatis via Gateway (Fonnte)]`** jika gateway telah diaktifkan oleh Owner.
    - **Owner (`ReceiptSettingsView.tsx` - Format Struk Bagian 7)**: Tempat kanonikal panduan aktivasi WhatsApp Gateway. Saat Owner memilih tab *Token Pribadi (Fonnte)*, sistem menampilkan panduan 5-langkah lengkap (pendaftaran akun di fonnte.com, scan QR perangkat nomor toko, salin API token, simpan konfigurasi, dan verifikasi otomatisasi kasir).
  - **Responsive & PWA Friendly**: Didesain proporsional untuk smartphone Android, iPhone iOS (Safari notch & home indicator), tablet kasir, dan mode PWA Standalone.
- **Pengaturan Struk Toko (`ReceiptSettingsView.tsx`)**:
  - Sakelar 7: Pengiriman Struk Otomatis via WhatsApp Gateway.
  - Pilihan sumber kuota: Gateway Platform vs Token Pribadi Fonnte lengkap dengan Card Panduan Aktivasi Owner.
- **Superadmin Control Tower (`SuperadminDashboardPage.tsx`)**:
  - Modul 7: **WhatsApp Gateway** (icon `MessageSquare`).
  - Pengaturan token platform, toggle aktif/nonaktif, toggle izin fallback tenant.
  - Kartu pengujian (Test Dispatch) ke nomor WhatsApp langsung.

---

## 3. Checklist Kriteria Penerimaan (Acceptance Criteria)
- [x] Backend service mendukung Fonnte REST API dengan header `Authorization: token`.
- [x] Nomor telepon otomatis dinormalisasi ke format `628xxxxxxxxxx`.
- [x] Background auto-dispatch saat checkout berjalan non-blocking (tidak memperlambat response checkout kasir).
- [x] Endpoint manual kasir `POST /api/orders/:id/send-whatsapp` mengembalikan status terkirim / simulasi dengan payload order ID.
- [x] Pengaturan outlet `receiptConfig.whatsappConfig` tersimpan aman di database PostgreSQL.
- [x] Superadmin dapat mengelola konfigurasi platform gateway dan melakukan test dispatch.
- [x] Mode Simulator Sandbox aktif otomatis jika API token belum dikonfigurasi, memastikan environment lokal/staging tetap stabil.
- [x] TypeScript build frontend & backend lulus tanpa error (`Exit code 0`).
