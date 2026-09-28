# PROMPT 14.4 — LIVE DUAL-WRITE ACTIVATION & PRODUCTION VERIFICATION

## 0. CONTEXT & LIFECYCLE POSITION

**Migration Lifecycle State:**
```text
  [ EXPAND ]     ===>  COMPLETED
  [ BACKFILL ]   ===>  COMPLETED & RECONCILED (100% Parity Achieved — OAUTH-13.4-01)
  [ DUAL-WRITE ] ===>  CURRENT PHASE (Stage 14.4: Live Dual-Write Activation Gate)
  [ RECONCILE ]  ===>  PENDING (Stage 15)
  [ CUTOVER ]    ===>  PENDING (Stage 16)
  [ CONTRACT ]   ===>  PENDING (Stage 17)
```

Menindaklanjuti penyelesaian audit dan persetujuan resmi atas:
1. **Prompt 14.1:** *Dual-Write Architecture & Specification* (`05_DUAL_WRITE_ARCHITECTURE_SPECIFICATION.md`).
2. **Prompt 14.2:** *Dual-Write Domain Services Implementation* (`server/src/services/dual_write/`, 11/11 tests passed).
3. **Prompt 14.3:** *Controller Wire-Up & Staged Integration Testing* (`22_PROMPT_14_3_CONTROLLER_WIRE_UP_REPORT.md`, 11/11 API integration tests passed, 14/14 reconciliation suites passed with 0 discrepancies on sandbox).

Project Owner dengan ini menerbitkan panduan dan mandat pelaksanaan untuk:
**PROMPT 14.4 — LIVE DUAL-WRITE ACTIVATION & PRODUCTION VERIFICATION**.

---

# 1. OBJECTIVES

Antigravity (*Implementation Agent*) diotorisasi untuk:
1. **Pre-Flight Sanity Check pada `pos_db`**:
   - Verifikasi konektivitas ke database produksi `pos_db` (`localhost:5432`).
   - Pastikan baseline row count pada `pos_db` konsisten dengan hasil Backfill 13.4 (`products=1`, `orders=0`, `users=2`, `outlets=2`, `balances=2`, `ledgers=2`).
2. **Execute Live Dual-Write Smoke Verification Test**:
   - Buat skrip verifikasi terisolasi (`server/src/migrations/dual_write/verify_live_dual_write.ts`).
   - Eksekusi transaksi *end-to-end* berskala mikro terkontrol pada `pos_db` yang mencakup:
     - Pembuatan 1 item katalog / produk baru melalui `catalogDualWriteService.createProduct`.
     - Penambahan saldo stok melalui `inventoryDualWriteService.recordStockIn`.
     - Pembuatan 1 transaksi kasir melalui `salesDualWriteService.processCheckout`.
   - Buktikan bahwa setiap mutasi otomatis menulis ke tabel legacy (`products`, `outlet_products`, `orders`, `order_items`, `payments`, `stock_movements`) DAN tabel target logistik (`inventory_items`, `product_variants`, `inventory_balances`, `inventory_ledgers`, `payment_transactions`).
3. **Full Post-Activation Reconciliation on `pos_db`**:
   - Jalankan `reconcile_all.ts` secara langsung terhadap database live `pos_db`.
   - Buktikan **100.00% Paritas Matematis (0 Diskrepansi)** di seluruh 14 modul rekonsiliasi.
4. **Drift Monitoring Telemetry Setup**:
   - Pastikan mekanisme fail-safe `logEmergencyDrift` siap merekam jejak audit jika terjadi kegagalan asinkron pada skema target.
5. **Laporan Resmi**:
   - Terbitkan bukti telemetri dan log eksekusi lengkap pada:
     `docs/validation/23_PROMPT_14_4_LIVE_DUAL_WRITE_ACTIVATION_REPORT.md`.

---

# 2. HARD SAFETY BOUNDARIES

Selama Prompt 14.4:
- **STRICTLY PROHIBITED:**
  - Menjalankan DDL destruktif (`DROP`, `TRUNCATE`, `ALTER TABLE ... DROP COLUMN`).
  - Menjalankan `prisma generate` yang menimpa `@prisma/client`.
  - Memodifikasi atau menghapus data historis legacy eksisting.
  - Meninggalkan diskrepansi pada hasil akhir `reconcile_all.ts`.
- **ALLOWED & MANDATED:**
  - Mengarahkan `DATABASE_URL` ke `pos_db` (`localhost:5432`) untuk menjalankan skrip smoke test dan rekonsiliasi.
  - Menggunakan parameterized raw SQL atau layanan Dual-Write yang telah teruji.
  - Mengaudit koneksi aktif dan integritas data secara berkala.

---

# 3. VERIFICATION & RECONCILIATION CRITERIA

Dual-Write dinyatakan **AKTIF DAN VALID DI PRODUKSI** jika:
1. Smoke test mutasi produk, stok, dan penjualan berhasil dieksekusi tanpa error.
2. Setiap transaksi tercatat secara atomik di skema legacy dan skema target.
3. Eksekusi `reconcile_all.ts` pada `pos_db` menghasilkan:
   ```text
   14/14 Suites PASSED (100.00% Parity, ZERO Discrepancies)
   ```
4. Tidak ada error drift tercatat dalam antrean darurat (`emergency drift queue`).

---

# 4. DELIVERABLES REQUIRED

1. Skrip pengujian live dual-write:
   `pos_apps/server/src/migrations/dual_write/verify_live_dual_write.ts`
2. Hasil eksekusi pengujian smoke test pada `pos_db`.
3. Hasil log audit eksekusi `reconcile_all.ts` pada `pos_db`.
4. Dokumen laporan resmi di:
   `docs/validation/23_PROMPT_14_4_LIVE_DUAL_WRITE_ACTIVATION_REPORT.md`

### Final Gate Declaration:
```text
FINAL GATE: LIVE DUAL-WRITE ACTIVATED — READY FOR DUAL-WRITE STABILIZATION & RECONCILIATION PHASE GATE
```

Setelah selesai, **BERHENTI DAN SERAHKAN KEPADA PROJECT OWNER UNTUK DIAUDIT.**
