# WELL POS — QA END-TO-END WORKFLOW MATRIX
## Lifecycle State Transitions, Multi-Role Handshake & System Continuity

> **Phase**: Test Design & Business Rule Validation (Antigravity Prompt 2)  
> **Repository**: `/Users/dendyaditya/Projects/pos_project`  
> **Date**: 12 Oktober 2026  
> **Execution Status**: `NOT RUN` (Design Phase Only)  

---

### 1. PETA ALUR UTAMA END-TO-END (THE GOLDEN CHAIN)

```text
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ [1] SUPERADMIN  │ ────► │ [2] OWNER SETUP │ ────► │ [3] KASIR BUKA  │
│  Control Tower  │       │  Catalog & BOM  │       │  Shift & Modal  │
└─────────────────┘       └─────────────────┘       └─────────────────┘
                                                             │
                                                             ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ [6] Z-REPORT &  │ ◄──── │ [5] VOID / PIN  │ ◄──── │ [4] PENJUALAN   │
│  Tutup Shift    │       │  Audit & Rollbk │       │  BOM & Multi-Pay│
└─────────────────┘       └─────────────────┘       └─────────────────┘
         │
         ▼
┌─────────────────┐
│ [7] BACKOFFICE  │
│  Laba Rugi & HPP│
└─────────────────┘
```

---

### 2. RINCIAN MODEL TRANSISI STATUS STATE MACHINE

#### ALUR 1: SUPERADMIN PLATFORM GOVERNANCE & AUDIT TENANT
- **Aktor**: `SUPERADMIN` (`superadmin@wellpos.id`)
- **State Awal**: Superadmin belum login, database memuat tenant pending/aktif.
- **Urutan Aksi**:
  1. Navigasi ke URL rahasia `http://localhost:5173/#hq-gate-99`.
  2. Login dengan akun default SuperAdmin.
  3. Masuk ke tab "Daftar Tenant".
  4. Periksa triage status filter pills (Semua, Aktif, Menunggu Persetujuan, Expired).
  5. Buka inline expandable detail toko milik tenant (tanpa popup bertumpuk).
- **State Transisi**:
  - `Guest` ➔ `Authenticated Platform Admin`.
- **Cek Konsistensi Akhir**:
  - Metrik akumulasi total tenant, toko aktif, dan saldo token platform sinkron 1:1.

---

#### ALUR 2: MERCHANT OWNER LOGIN & VERIFIKASI RESEP BOM
- **Aktor**: `OWNER` (`owner@uracoffee.id`)
- **State Awal**: Owner login ke `#login` ➔ dialihkan ke `#dashboard`.
- **Urutan Aksi**:
  1. Buka menu "Resep & Bahan Baku" (`recipes`).
  2. Periksa resep "Es Kopi Susu Gula Aren" (18g Biji Kopi, 120ml Susu, 1 pcs Cup).
  3. Verifikasi perhitungan HPP teoritis per porsi.
  4. Buka menu "Grup Modifier" (`modifiers`) untuk memastikan efek deduksi bahan aktif pada "Extra Shot (+9g Biji Kopi)".
- **State Transisi**:
  - Master data resep terverifikasi valid dan siap dipotong oleh mesin kasir.
- **Cek Konsistensi Akhir**:
  - Formula resep terhubung utuh ke model `InventoryItem`.

---

#### ALUR 3: SHIFT SIKLUS KASIR (OPENING & MODAL KAS)
- **Aktor**: `CASHIER` (`Rian Kasir Kemang`)
- **State Awal**: Outlet `Kemang (OUT-01)` tidak memiliki shift aktif (`Shift.status = CLOSED`).
- **Urutan Aksi**:
  1. Akses Terminal Kasir POS (`/#pos`).
  2. Input modal kas laci awal: Rp 100.000.
  3. Konfirmasi pembukaan shift.
- **State Transisi**:
  - `No Active Shift` ➔ `Shift OPEN (Cash = Rp 100.000)`.
- **Cek Konsistensi Akhir**:
  - Terminal kasir membuka katalog produk dan mengaktifkan keranjang transaksi.

---

#### ALUR 4: TRANSAKSI PENJUALAN MULTI-TENDER & PEMOTONGAN BAHAN BAKU
- **Aktor**: `CASHIER` & `KITCHEN`
- **State Awal**: Keranjang kasir kosong, saldo stok Biji Kopi = $S_0$.
- **Urutan Aksi**:
  1. Kasir input pesanan F&B dengan modifier Extra Shot.
  2. Checkout dengan metode Tunai (atau QRIS simulator).
  3. Audio chime sukses kasir berbunyi.
  4. Struk tercetak memuat Calling Queue Number `#01`.
  5. Layar Dapur KDS menerima tiket baru dan membunyikan bel dapur.
- **State Transisi**:
  - `Cart Empty` ➔ `Cart Populated` ➔ `Order PAID` ➔ `Kitchen Ticket QUEUED`.
  - Saldo Biji Kopi: $S_1 = S_0 - 27\text{g}$.
- **Cek Konsistensi Akhir**:
  - Saldo kas laci bertambah, saldo stok terpotong atomik, omset kasir terakumulasi.

---

#### ALUR 5: AUDIT MUTASI KAS KASIR (PETTY CASH IN & OUT)
- **Aktor**: `CASHIER`
- **State Awal**: Shift sedang berjalan.
- **Urutan Aksi**:
  1. Kasir mencatat uang keluar petty cash Rp 15.000 untuk "Beli Es Batu Tambahan".
  2. Kasir mencatat uang masuk kas petty cash Rp 50.000 untuk "Uang Kembalian Tambahan dari Brankas".
- **State Transisi**:
  - Dua entri `CashMovement` (`CASH_OUT` dan `CASH_IN`) tercatat di database terikat ke `shiftId`.
- **Cek Konsistensi Akhir**:
  - Sistem menyesuaikan kalkulasi ekspektasi kas akhir drawer secara real-time.

---

#### ALUR 6: PROTEKSI UNPAID TAGIHAN & TUTUP SHIFT (Z-REPORT)
- **Aktor**: `CASHIER` & `SUPERVISOR`
- **State Awal**: Kasir ingin menutup shift pada akhir hari kerja.
- **Urutan Aksi**:
  1. Kasir mencoba tutup shift ketika ada pesanan `UNPAID` ➔ **Sistem tolak keras (Lock Unpaid Orders)**.
  2. Kasir melunasi atau membatalkan seluruh pesanan `UNPAID`.
  3. Kasir buka kalkulator pecahan uang, masukkan hitungan lembar kas fisik laci.
  4. Konfirmasi tutup shift ➔ Slip Z-Report dicetak.
- **State Transisi**:
  - `Shift OPEN` ➔ `Shift CLOSED`.
- **Cek Konsistensi Akhir**:
  - Slip Z-Report adalah **Rekapan Murni Ringkasan Finansial** tanpa memuat daftar baris nota per transaksi.

---

#### ALUR 7: REKONSILIASI FINANSIAL OWNER BACKOFFICE
- **Aktor**: `OWNER`
- **State Awal**: Shift kasir telah ditutup.
- **Urutan Aksi**:
  1. Owner membuka tab "Laporan" (`#dashboard` tab `reports`).
  2. Memverifikasi laba kotor: $\text{Omset Bersih} - \text{Total HPP Resep BOM}$.
  3. Memverifikasi laba bersih operasional: $\text{Laba Kotor} - \text{Pengeluaran OPEX Petty Cash Shift}$.
  4. Melakukan ekspor laporan ke berkas CSV UTF-8 BOM.
- **State Transisi**:
  - Laporan operasional hari berjalan tervalidasi dan terdokumentasi permanen.
- **Cek Konsistensi Akhir**:
  - Zero financial drift antara data kasir dan laporan eksekutif owner.
