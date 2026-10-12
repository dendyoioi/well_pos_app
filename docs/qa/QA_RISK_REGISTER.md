# WELL POS — QA RISK REGISTER
## System Failure Modes, Financial Vulnerabilities & Operational Risk Assessment

> **Audit Type**: Strict Read-Only Discovery Audit (Antigravity Prompt 1)  
> **Repository**: `/Users/dendyaditya/Projects/pos_project`  
> **Audit Date**: 12 Oktober 2026  
> **Status**: COMPLETED ✅  

---

### 1. MATRIKS RISIKO KRITIS & KEGAGALAN OPERASIONAL

| ID Risiko | Area Risiko / Titik Kerentanan | Tingkat Keparahan | Probabilitas | Dampak Bisnis / Finansial | Strategi Mitigasi & Validasi |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **RSK-01** | **Kebocoran Data Antar-Tenant (Cross-Tenant Leakage)** | **P0 (Kritis)** | Rendah | Data transaksi, omset, atau pelanggan sebuah toko terbaca oleh toko lain. | Setiap query Prisma wajib memiliki klausa `where: { tenantId }` atau menggunakan middleware RLS ([`security.middleware.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/middlewares/security.middleware.ts)). |
| **RSK-02** | **Falsifikasi Status QRIS pada Pesanan Belum Bayar** | **P0 (Kritis)** | Sedang | Pesanan Open Tab / Unpaid salah dihitung sebagai omset lunas QRIS di kartu metrik kasir. | Dilarang menggunakan ternary biner `method === 'CASH' ? 'Tunai' : 'QRIS'`. Verifikasi `paymentStatus !== 'UNPAID'` dan status non-void sebelum mengakumulasi omset. |
| **RSK-03** | **Tutup Shift Menggantung dengan Tagihan Belum Lunas (Open Tab)** | **P1 (Tinggi)** | Tinggi | Kasir menutup shift saat masih ada meja makan yang belum bayar, menyebabkan hilangnya piutang. | Backend wajib menolak penutupan shift (`HTTP 400 UNPAID_ORDERS_REMAINING`) dan UI kasir menampilkan daftar nomor invoice yang belum lunas. |
| **RSK-04** | **Ketidaksinkronan Rollback Stok saat Transaksi Dibatalkan (VOID)** | **P1 (Tinggi)** | Sedang | Stok bahan baku berkurang ganda atau tidak dipulihkan setelah nota dibatalkan, merusak akurasi HPP. | Pemulihan stok bahan baku BOM wajib berjalan di dalam transaksi database atomik (`prisma.$transaction`) dengan tipe mutasi `VOID`. |
| **RSK-05** | **Duplikasi Transaksi saat Sinkronisasi Antrean Offline (Offline-First)** | **P1 (Tinggi)** | Sedang | Kasir mengalami putus koneksi internet dan mengirimkan nota kasir berkali-kali saat online kembali. | Transaksi lokal wajib menyertakan UUID kanonikal `offlineReferenceId`. Backend memeriksa tabel `IdempotencyRecord` sebelum memproses order. |
| **RSK-06** | **Pemborosan Kertas Struk & Antrean Macet akibat Rincian Slip X/Z** | **P2 (Sedang)** | Tinggi | Mencetak ratusan baris nota per transaksi ke gulungan kertas kasir 58mm/80mm saat tutup shift. | Larangan keras merender daftar item transaksi per nota pada slip cetak X/Z Report (Kebijakan Rekapan Murni *Pure Summary*). |
| **RSK-07** | **Ketidaksesuaian Port Migrasi Cloud (PgBouncer 6543 vs Direct 5432)** | **P2 (Sedang)** | Rendah | Eksekusi DDL remote gagal karena PgBouncer menolak `ALTER TABLE` / `CREATE TYPE`. | Seluruh patch database remote Supabase wajib menggunakan direct port `5432` (`src/migrations/schema_patcher.ts`). |
| **RSK-08** | **Kegagalan Pelunasan Kasbon Masuk ke Laci Kasir (Cash Ledger Drift)** | **P2 (Sedang)** | Rendah | Pelanggan melunasi kasbon tunai tetapi uang tidak tercatat di saldo laci kasir shift aktif. | Pelunasan kasbon wajib memicu mutasi kas `DEBT_REPAYMENT` di tabel `CashMovement` yang terhubung ke `shiftId` aktif. |

---

### 2. AREA HIGH-RISK UNTUK PENGUJIAN REGRESI (REGRESSION TARGETS)

1. **Shift Lifecycle & Cash Reconciliation**:
   - Pembukaan shift (modal kas awal).
   - Mutasi kas masuk (*cash in*) dan kas keluar (*cash out* / petty cash operasional).
   - Rekonsiliasi fisik vs sistem (perhitungan *over/short*).
   - Penguncian penutupan shift jika ada order `UNPAID`.
2. **Formula Resep F&B (BOM) & Deduksi Bahan Baku**:
   - Penjualan kopi susu memotong takaran biji kopi (gram), susu (ml), dan cup (pcs).
   - Penjualan dengan modifier (extra shot espresso) memotong tambahan biji kopi sesuai efek modifier.
   - Pembatalan (VOID) memulihkan saldo bahan baku secara utuh.
3. **Multi-Tender & Split Bill**:
   - Pembayaran sebagian Tunai + sebagian QRIS pada 1 nota.
   - Verifikasi pembagian nominal dan rekonsiliasi total payment.
