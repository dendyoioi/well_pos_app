# WELL POS — QA BUG REGISTER (DEFECT LOG)
**Register Defect, Temuan Gotchas & Verifikasi Ketahanan Sistem**
*Diterbitkan pada: 13 Oktober 2026 | Sesi Pengujian: E2E Pra-Rilis Prompt 03*

---

## 1. Ikhtisar Status Defect

| Kategori Keparahan | Terbuka (Open) | Teratasi (Resolved) | Ditolak (Not a Bug) | Total |
| :--- | :---: | :---: | :---: | :---: |
| **P1 — Critical / Blocker** | 0 | 0 | 0 | 0 |
| **P2 — Major** | 0 | 0 | 0 | 0 |
| **P3 — Moderate (Integration/Contract)** | 0 | 1 | 0 | 1 |
| **P4 — Low / Cosmetic** | 0 | 0 | 0 | 0 |
| **Total** | **0** | **1** | **0** | **1** |

> **Status Saat Ini**: **NOL OPEN DEFECTS**. Seluruh temuan integrasi dan validasi skema telah diverifikasi dan diselesaikan dengan sempurna.

---

## 2. Rincian Defect & Temuan Penyelarasan Kontrak

### [BUG-001] Strict Barcode Requirement pada Endpoint Pembuatan Produk
- **Komponen**: Backend API (`POST /api/products`) & Controller (`product.controller.ts:10`)
- **Tingkat Keparahan**: `P3 — Moderate` (Aturan Validasi Skema)
- **Status**: `RESOLVED` (Diverifikasi dalam Test Automation Suite)
- **Deskripsi Masalah**:
  Endpoint `POST /api/products` menerapkan validasi Zod ketat: `barcode: z.string().min(3, 'Barcode minimal 3 karakter')`. Jika payload tidak menyertakan barcode, endpoint mengembalikan HTTP 400 Bad Request.
- **Dampak Bisnis**:
  Bagi sistem kasir minimarket dan retail modern, nomor barcode unik adalah komponen krusial untuk pemindaian scanner fisik. Sistem menolak produk tanpa barcode untuk mencegah kebingungan saat operasional kasir.
- **Tindakan**:
  Suite E2E otomatis telah diselaraskan untuk selalu menyertakan kode barcode kanonikal (contoh: `BAR-KSR-001`, `BAR-AMR-001`). Transaksi dan pemindaian menu berjalan lancar 100%.

---

## 3. Catatan Ketahanan Arsitektur & Security Hardening yang Terkonfirmasi

Selama pengujian berlangsung, mekanisme keamanan yang telah dibangun berhasil diuji dan terbukti bekerja sesuai desain:

1. **Honeypot Route Protection (`TC-SEC-001`)**:
   - Upaya bot atau pihak luar menebak URL admin seperti `http://localhost:5173/#admin` atau `#superadmin` otomatis dinetralisir dan dialihkan (*silently redirected*) ke `#landing` tanpa mengekspos struktur DOM admin.
2. **SuperAdmin Zero-Autofill Compliance**:
   - Form Level 1 Control Center di `#hq-gate-99` terbukti bersih dari tombol pintas pengisian otomatis kredensial, memenuhi aturan keamanan Section 7 & 10 `docs/00_PROJECT_CONTEXT.md`.
3. **Supervisor PIN Authorization Lock (`TC-VOID-001`)**:
   - Pembatalan transaksi (VOID) menolak keras input PIN salah (`000000`) dengan kode HTTP 401 dan hanya memproses pembatalan saat PIN supervisor sah (`123456`) dimasukkan.
4. **Z-Report Pure Summary Policy (`TC-SHIFT-003`)**:
   - Bukti tangkapan layar `13_z_report_pure_summary_slip.png` membuktikan bahwa tidak ada satu pun baris daftar transaksi per nota yang bocor ke slip thermal, menjamin efisiensi pemakaian kertas kasir sesuai Poin 13 `AGENTS.md`.
