# WELL POS — QA COVERAGE AND TRACEABILITY MATRIX
## Mapping Requirements, Architecture Decisions, Risks & Evidence Types

> **Phase**: Test Design & Business Rule Validation (Antigravity Prompt 2)  
> **Repository**: `/Users/dendyaditya/Projects/pos_project`  
> **Date**: 12 Oktober 2026  
> **Execution Status**: `NOT RUN` (Design Phase Only)  

---

### 1. MATRIKS KETERLACAKAN TEST CASE (REQUIREMENTS TRACEABILITY)

| Test ID | Aturan Bisnis / Epic Rujukan | Modul & Peran | Risiko Terkait | Bukti yang Dihasilkan |
| :--- | :--- | :--- | :--- | :--- |
| **TC-AUTH-001** | `EPIC-10`, `EPIC-18` (SuperAdmin Governance) | Portal SaaS (`SUPERADMIN`) | `RSK-01` (Tenant Isolation) | Screenshot Dashboard Superadmin |
| **TC-AUTH-002** | `EPIC-14`, `EPIC-16` (Backoffice Redesign) | Login (`OWNER`) | Akses Ilegal | Screenshot Ringkasan Bisnis |
| **TC-SHIFT-001** | `EPIC-05`, `EPIC-12` (Shift Opening) | Shift Kasir (`CASHIER`) | Saldo Laci Kas | Screenshot Kasir Shift Aktif |
| **TC-POS-001** | `EPIC-05`, `EPIC-06`, `EPIC-22` (BOM & Queue) | POS Kasir (`CASHIER`) | Keranjang Transaksi | Screenshot Modal Sukses & Antrean |
| **TC-INV-001** | `ADR-002`, `EPIC-06`, `EPIC-21` (BOM Deduction) | Kartu Stok (`OWNER`) | `RSK-04` (Stok Drift) | Log Entri Mutasi Stok Prisma |
| **TC-POS-002** | `EPIC-23`, `AGENTS.md #14` (Anti-Falsifikasi) | POS Kasir (`CASHIER`) | `RSK-02` (Falsifikasi QRIS) | Screenshot Modal QRIS Simulator |
| **TC-VOID-001** | `EPIC-24` (Transaction Void & PIN Approval) | Transaksi (`SUPERVISOR`)| `RSK-04` (Stok Drift) | Screenshot Slip Void & Badge |
| **TC-SHIFT-002** | `AGENTS.md #15` (Lock on Unpaid Orders) | Shift Kasir (`CASHIER`) | `RSK-03` (Unpaid Remaining)| Screenshot Modal Penolakan Tutup |
| **TC-SHIFT-003** | `AGENTS.md #13` (Pure Summary Z-Report) | Shift Kasir (`CASHIER`) | `RSK-06` (Paper Waste) | Screenshot Slip Z-Report Murni |
| **TC-REP-001** | `EPIC-09` (Financial Analytics & Real HPP) | Laporan (`OWNER`) | Laba Rugi Keliru | Screenshot Laporan & Berkas CSV |

---

### 2. CAKUPAN PERAN PENGGUNA (ROLE COVERAGE SUMMARY)

| Peran Pengguna | Test Case Terpetakan | Status Cakupan Uji |
| :--- | :--- | :---: |
| **`SUPERADMIN`** | `TC-AUTH-001`, Onboarding governance | Tercover Penuh (`100%`) |
| **`OWNER`** | `TC-AUTH-002`, `TC-INV-001`, `TC-REP-001` | Tercover Penuh (`100%`) |
| **`SUPERVISOR`** | `TC-VOID-001`, Otorisasi pembatalan transaksi | Tercover Penuh (`100%`) |
| **`CASHIER`** | `TC-SHIFT-001`, `TC-POS-001`, `TC-POS-002`, `TC-SHIFT-002`, `TC-SHIFT-003` | Tercover Penuh (`100%`) |
| **`WAREHOUSE`** | `TC-INV-001` (Verifikasi mutasi kartu stok) | Tercover Fungsional (`100%`) |
| **`KITCHEN`** | Tiket KDS Dapur (Efek turunan dari `TC-POS-001`) | Tercover Fungsional (`100%`) |

---

### 3. CAKUPAN ATURAN KHUSUS WORKSPACE (`AGENTS.md`)

| Aturan Kanonikal di `AGENTS.md` | Test Case Validasi | Status Desain |
| :--- | :--- | :---: |
| **Poin 1**: Vanilla CSS (Anti-Tailwind injection di custom UI) | `VIS-01` s.d `VIS-13` (Inspeksi styling konsisten) | Validated |
| **Poin 2**: Zero Stacked Modals Policy | `VIS-05`, `VIS-09`, `VIS-11` (Buka sheet tunggal) | Validated |
| **Poin 8**: Playwright Testing Lokal via `NODE_PATH=./pos_apps/node_modules` | Seluruh script otomasi test lokal | Validated |
| **Poin 10**: Pola Kanonikal Modal Form Responsif PWA (Sticky Footer) | `VIS-05`, `VIS-11` (Mobile 375x812 safe-area) | Validated |
| **Poin 12**: Standar Terminologi Toko & Outlet (Anti-Gerai/Cabang) | Seluruh view dan label teks | Validated |
| **Poin 13**: Kebijakan Rekapan Murni Slip X/Z-Report (Zero Transaction List) | `TC-SHIFT-003`, `VIS-12` | Validated |
| **Poin 14**: Integritas Metode Pembayaran & Anti-Falsifikasi Status QRIS | `TC-POS-002`, Metrik Kasir | Validated |
| **Poin 15**: Integritas Tutup Shift (Lock on Unpaid Orders) & Visibilitas Kasir | `TC-SHIFT-002` | Validated |
| **Poin 16**: Kebijakan Zero Redundant Refresh Button | `VIS-01` s.d `VIS-13` | Validated |
