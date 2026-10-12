# WELL POS — QA ENVIRONMENT AND TOOLING
## Browser Automation Capabilities, Local Test Harness & Execution Infrastructure

> **Audit Type**: Strict Read-Only Discovery Audit (Antigravity Prompt 1)  
> **Repository**: `/Users/dendyaditya/Projects/pos_project`  
> **Audit Date**: 12 Oktober 2026  
> **Status**: COMPLETED ✅  

---

### 1. STATUS LINGKUNGAN PENGUJIAN AKTIF (LIVE ENVIRONMENT)

Audit mendeteksi bahwa kedua layanan utama Well POS **saat ini sedang berjalan aktif (*LIVE*)** di komputer pengguna:

| Layanan | URL Akses | Port | PID Proses | Respon Status Liveness | Klasifikasi |
| :--- | :--- | :---: | :---: | :--- | :---: |
| **Backend REST API** | `http://localhost:5001` | 5001 | 78008 | `200 OK` (`{"status":"ok","message":"POS API Server & Database berjalan normal"}`) | `[VERIFIED]` |
| **Frontend Web Client** | `http://localhost:5173` | 5173 | 2220 | `200 OK` (Vite SPA HTML Server) | `[VERIFIED]` |
| **PostgreSQL Database** | `localhost:5432` / `pos_db` | 5432 | Native Service | Terkoneksi via Prisma ORM 5.22 | `[VERIFIED]` |

---

### 2. AUDIT PERANGKAT PENGUJIAN BROWSER (BROWSER TESTING TOOLCHAIN)

Audit memverifikasi kapabilitas browser automation yang sebenarnya tersedia di lingkungan Antigravity pengguna:

| Perangkat / Tooling | Lokasi Instalasi / Mekanisme | Status & Versi | Kapabilitas Uji |
| :--- | :--- | :---: | :--- |
| **Playwright Node.js** | [`pos_apps/node_modules/playwright`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/node_modules/playwright) | `[VERIFIED]` Tersedia | Eksekusi script otomasi browser headless/headed secara lokal tanpa dependensi cloud eksternal. |
| **Chromium Browser Binary** | Local Browser Cache macOS | `[VERIFIED]` v153.0.8010.12 | Peluncuran browser berhasil 100% tanpa error binary missing. |
| **Antigravity Browser Subagent** | Native Antigravity IDE Agent Tool (`browser_subagent`) | `[VERIFIED]` Tersedia | Navigasi interaktif, tangkapan layar WebP, pembacaan live DOM, inspeksi elemen UI. |
| **Tangkapan Layar (Screenshots)** | Playwright API `page.screenshot({ path })` | `[VERIFIED]` Tersedia | Menghasilkan tangkapan layar PNG/WebP beresolusi tinggi (Desktop 1440x900, Tablet 1024x768, Mobile 375x812). |
| **Inspeksi Console Error** | `page.on('console', msg => ...)` | `[VERIFIED]` Tersedia | Menangkap seluruh error JavaScript runtime, warning, dan uncaught exceptions. |
| **Inspeksi Jaringan (Network Traces)** | `page.on('request', ...)`, `page.on('response', ...)` | `[VERIFIED]` Tersedia | Memvalidasi status HTTP 200, 201, 400, dan payload JSON request/response API. |

---

### 3. PROTOKOL EKSEKUSI SCRIPT TESTING LOKAL

Sesuai aturan kanonikal **Poin 8 di `AGENTS.md`**, seluruh pengujian Playwright wajib dijalankan menggunakan runtime lokal:

```bash
# Pola eksekusi kanonikal script visual testing
NODE_PATH=./pos_apps/node_modules node scripts/<nama_script>.js
```

Contoh script uji visual yang telah siap di repository:
1. `npm run test:visual` ➔ `scripts/test_tenant_journey_visual_paths.js` (Onboarding & POS)
2. `npm run test:visual:recipes` ➔ `scripts/test_fnb_recipes_deduction_visual.js` (BOM & Resep F&B)
3. `npm run test:visual:shift` ➔ `scripts/test_end_of_shift_financial_audit_bdd_visual.js` (Shift Kasir & Z-Report)
4. `npm run test:visual:split-debt` ➔ `scripts/test_split_debt_bdd_visual.js` (Split Payment & Kasbon)

---

### 4. SUITE PENGUJIAN KONTRAK & INTEGRITAS API BACKEND

Backend di `pos_apps/server` memiliki suite pengujian fungsional kontrak yang dapat dijalankan secara cepat via `tsx`:

```bash
npm run test:smoke       # 30/30 Smoke E2E test suites (Owner, Kasir, Checkout, BOM, QR Menu)
npm run test:sandbox     # Validasi idempotensi seeder, IAM multi-role, topologi gudang
npm run test:operations  # Validasi operasional inventaris, purchase order, dan mutasi
npm run test:financial   # Validasi rekonsiliasi arus kas, HPP riil, dan integritas finansial
npm run test:supplychain # Validasi transfer antar-cabang dan moving average cost
npm run test:offline     # Validasi ketahanan offline-first queue & idempotency UUID
```

---

### 5. PERSYARATAN & PRASYARAT SEBELUM PROMPT 02 & PROMPT 03

Sebelum melangkah ke tahap eksekusi pengujian browser (Prompt 03):
1. **Penyusunan Test Design (Prompt 02)**: Wajib menyusun matriks test case P0 s.d P3 dengan skenario input, expected result, dan kriteria assertion eksplisit tanpa mengubah aplikasi.
2. **Kondisi Steril Database**: Menjalankan `npm run seed:sandbox` untuk memastikan data pengujian tenant Ura Coffee berada pada kondisi awal yang diketahui (*clean baseline*).
3. **Penyimpanan Artefak Tangkapan Layar**: Seluruh tangkapan layar disimpan ke folder artefak sesi Antigravity atau direktori QA terisolasi.
