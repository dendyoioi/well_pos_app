# EPIC-12: LOCAL PRE-RELEASE SANDBOX ENVIRONMENT, MASTER SEEDER & INTERACTIVE SIMULATORS
## Lingkungan Sandbox Lokal Mandiri, Master Seeder Multi-Role, & Simulator Perangkat POS

**Epic ID**: `EPIC-12`  
**Status**: **COMPLETED ✅**  
**Prioritas**: **P1 — CRITICAL FOR PRE-RELEASE & UAT VALIDATION**  
**Target Komponen**: `pos_apps/server`, `pos_apps/client`, & `docs`  
**Dokumen Induk**: [`docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md`](file:///Users/dendyaditya/Projects/pos_project/docs/epics/00_EPIC_REGISTRY_AND_PROJECT_MEMORY.md)  
**Dokumen Arsitektur Rujukan**: `docs/00_PROJECT_CONTEXT.md`  

---

### 1. DESKRIPSI & TUJUAN BISNIS
Menyediakan lingkungan operasional lokal yang mandiri (*self-contained local sandbox environment*) untuk kebutuhan pengujian **Pre-Release**, UAT (User Acceptance Testing), dan demonstrasi menyeluruh (*end-to-end*) bagi tim internal dan pemangku kepentingan tanpa ketergantungan pada layanan cloud berbayar atau perangkat keras fisik.

Tujuan **EPIC-12** adalah:
1. **Master Sandbox Seeder**: Menyiapkan data toko realistis (Multi-role login: SuperAdmin, Owner, Kasir, Gudang; menu ritel & F&B dengan resep pemotongan bahan baku; multi-cabang; member loyalty; dan voucher promo).
2. **Interactive UI Simulators**: Menyediakan pratinjau dan simulasi interaktif di antarmuka kasir untuk pembayaran QRIS, cetak struk thermal virtual beserta simulasi buka laci uang (*cash drawer kick*), serta pratinjau struk WhatsApp/Email.
3. **Unified Runner & Sandbox Reset**: Memungkinkan developer atau tester menjalankan backend, frontend, dan database dengan satu perintah ringkas serta kemampuan mengembalikan data demo ke kondisi awal secara instan.
4. **Automated Verification & Playbook**: Menyusun contract test otomatis untuk validasi sandbox (`test_epic12_sandbox_validation.ts`) dan dokumen panduan langkah pengujian manual (`docs/SANDBOX_PLAYBOOK.md`).

---

### 2. BREAKDOWN SPRINT TASK (SPRINT WORK PLAN)

- [x] **Sprint 12.1: Master Sandbox Seeder Engine (COMPLETED ✅)**
  - Buat script `pos_apps/server/prisma/seed.sandbox.ts`.
  - Provisioning akun per role:
    * `superadmin@wellpos.id` (Platform SuperAdmin)
    * `owner@uracoffee.id` (Owner Merchant)
    * `kasir@uracoffee.id` (Kasir dengan PIN 123456)
    * `gudang@uracoffee.id` (Staff Gudang)
    * `supervisor@uracoffee.id` (Supervisor Toko)
  - Provisioning data operasional:
    * 2 Cabang (Outlet Utama & Outlet Express) + 1 Central Warehouse.
    * Master bahan baku (`inventory_items`) & master menu komersial (`products`, `product_variants`).
    * Resep F&B bertingkat (`recipes`, `recipe_items`) dan Topping Modifiers.
    * Saldo persediaan awal di gudang dan outlet.
    * Database member pelanggan (`customers`) dengan saldo poin loyalty & voucher promo aktif.
    * Sesi shift kasir terbuka aktif (`shifts`) siap transaksi checkout.

- [x] **Sprint 12.2: Interactive Payment & Hardware Simulators di Frontend (COMPLETED ✅)**
  - **Payment Sandbox Modal**: Modal QRIS interaktif di `PosTerminalView.tsx` dengan tombol *"Simulasi Pembayaran Berhasil"* yang memicu konfirmasi pembayaran instan.
  - **Virtual Thermal Printer Modal**: Komponen pratinjau struk kasir 58mm & 80mm lengkap dengan animasi visual *"Laci Kasir Terbuka"* (`cash drawer kick`).
  - **Digital Receipt Preview**: Pop-up pratinjau pesan WhatsApp & email struk belanja tanpa perlu membuka tab luar atau nomor telepon aktif.

- [x] **Sprint 12.3: One-Command Unified Runner & Sandbox Reset (COMPLETED ✅)**
  - Konfigurasi root runner (skrip NPM atau `run-sandbox.sh`) untuk menjalankan backend API (port 5001) dan frontend client (port 5173) secara bersamaan.
  - Skrip reset instan: `npm run seed:sandbox` untuk membersihkan dan mengembalikan data demo ke kondisi steril kapan saja.

- [x] **Sprint 12.4: Automated Contract Test & Sandbox Playbook (COMPLETED ✅)**
  - Buat automated verification suite: `pos_apps/server/src/migrations/contract/test_epic12_sandbox_validation.ts` (5/5 modules pass 100%).
  - Buat panduan manual komprehensif: `docs/SANDBOX_PLAYBOOK.md` berisi kredensial akun, navigasi rute modal (`#landing`, `#pos`, `#superadmin`), dan 5 skenario uji coba mandiri.

---

### 3. KRITERIA PENERIMAAN (ACCEPTANCE CRITERIA)
1. Perintah peluncuran lokal dapat dijalankan dengan lancar tanpa error dependensi. [TERPENUHI ✅]
2. Seluruh akun (SuperAdmin, Owner, Kasir, Gudang) dapat login ke sistem dengan kredensial sandbox. [TERPENUHI ✅]
3. Kasir dapat melakukan checkout menu kopi F&B, dan stok bahan baku (biji kopi, susu, cup) otomatis berkurang di database. [TERPENUHI ✅]
4. Pembayaran via QRIS dan Cash dapat disimulasikan sukses tanpa gateway nyata. [TERPENUHI ✅]
5. Struk virtual thermal dan pratinjau pesan digital muncul secara presisi. [TERPENUHI ✅]
6. Suite pengujian `test_epic12_sandbox_validation.ts` lulus 100% dengan zero regression pada Epic 1 s.d 11. [TERPENUHI ✅]

