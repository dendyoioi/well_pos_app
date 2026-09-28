# Dokumen Perencanaan Produk Awal (Initial Product Plan - ARCHIVED)

> **Status**: **ARCHIVED & HISTORICAL BLUEPRINT**  
> Dokumen-dokumen di bawah ini merupakan cetak biru (*blueprint*) awal saat Well POS pertama kali dikonseptualisasikan. Untuk arsitektur aktif, skema database 18 tabel target, dan standar koding sistem terkini, silakan merujuk ke [`docs/00_PROJECT_CONTEXT.md`](../../00_PROJECT_CONTEXT.md) dan [`docs/README.md`](../../README.md).

---

## 1. Dua Pilar Sistem Well POS

Well POS terbagi menjadi dua sistem independen:
1. **Well POS SaaS Management Platform**:
   * Sistem internal untuk tim pengembang/pemilik Well POS (Superadmin).
   * Mengelola seluruh klien (tenant), paket langganan (Trial, Starter, Pro, Enterprise), tagihan invoice berlangganan (Billing/Payment), dan monitoring lisensi toko aktif/terkunci.
2. **Well POS Merchant & Cashier System**:
   * Sistem yang digunakan oleh klien (pemilik toko & kasir).
   * Meliputi **Back-office** (kelola cabang, katalog barang, stok masuk/keluar, rekap shift, laporan laba rugi) dan **Layar Kasir POS** (scan barcode, keranjang, bayar tunai/QRIS, cetak struk 58/80mm, hold order, split payment).

---

## 2. Daftar Dokumen Lengkap

1. [**01_PRD_Product_Requirements_Document.md**](./01_PRD_Product_Requirements_Document.md)
   * Spesifikasi kebutuhan produk POS lengkap (Kasir, Scan Barcode, Diskon, PPN, Pembayaran Tunai & QRIS).
2. [**02_System_Architecture_and_Database_Design.md**](./02_System_Architecture_and_Database_Design.md)
   * Arsitektur sistem (React/Vite, Node.js/Express, Prisma, PostgreSQL).
   * Desain ERD basis data relasional.
3. [**03_Local_Setup_and_DBeaver_Guide.md**](./03_Local_Setup_and_DBeaver_Guide.md)
   * Panduan lokal untuk menjalankan PostgreSQL & menghubungkan ke DBeaver.
4. [**04_Implementation_Roadmap.md**](./04_Implementation_Roadmap.md)
   * Pembagian tahapan teknis pengembangan (Sprint 1 sampai Sprint 5).
5. [**05_SaaS_Client_Onboarding_Flow.md**](./05_SaaS_Client_Onboarding_Flow.md)
   * Alur pendaftaran mandiri (*Self-Service Registration*) calon klien & Onboarding Wizard 4 langkah.
6. [**06_Client_Intake_and_Import_Template.md**](./06_Client_Intake_and_Import_Template.md)
   * Format template file Excel/CSV impor produk massal & Lembar panduan cepat SOP kasir.
7. [**07_Well_POS_SaaS_vs_POS_Architecture_and_RBAC.md**](./07_Well_POS_SaaS_vs_POS_Architecture_and_RBAC.md)
   * Pemisahan Sistem SaaS vs Sistem POS Merchant, Dual-Layer RBAC, Billing Lifecycle, dan Tenant License Middleware.
8. [**08_Advanced_POS_Features_and_Print_Engine.md**](./08_Advanced_POS_Features_and_Print_Engine.md)
   * Fitur lanjutan kasir: Tahan pesanan (Hold Order), pembayaran campuran (Split Payment Tunai+QRIS), engine cetak struk thermal (58/80mm), kirim struk WhatsApp, dan ketahanan jaringan (Offline Queue).
