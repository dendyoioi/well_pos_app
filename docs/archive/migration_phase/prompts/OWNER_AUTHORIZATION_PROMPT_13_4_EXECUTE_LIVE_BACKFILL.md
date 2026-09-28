# OWNER AUTHORIZATION — EXECUTE LIVE BACKFILL MIGRATION

## DOCUMENT CONTROL

**Authorization Stage:** Prompt 13.4 — Live Backfill Migration Execution  
**Parent Gate:** Prompt 13.3B & 13.3C — Backfill Engine Refactor, ACID Safety Contract & Owner Authorization Package  
**Authorization Date:** September 21, 2026  
**Decision Authority:** Project Owner  
**Status:** APPROVED / BINDING FOR PROMPT 13.4  
**Authorized Environment:** `pos_db` on `localhost:5432`  
**Execution Entrypoint:** `server/src/migrations/backfill/index.ts --execute`  
**Reconciliation Entrypoint:** `server/src/migrations/reconciliation/reconcile_all.ts`  
**Execution Scope:** LIVE BACKFILL & POST-BACKFILL RECONCILIATION ONLY  

---

# 1. OWNER AUTHORIZATION SUMMARY

Menindaklanjuti penyelesaian dan hasil audit menyeluruh atas:
- **Prompt 13.3:** Rekonsiliasi Desain Backfill, isolasi blocker arsitektur, dan perumusan keputusan;
- **OD-13.3-01 (Option A):** Otorisasi entri kalibrasi pembukaan `InventoryLedger` untuk saldo awal;
- **OD-13.3-02 (Option A):** Otorisasi refaktor *backfill workers* ke *parameterized raw SQL*;
- **OD-13.3-03 (Option A):** Otorisasi penanganan kredensial PIN-less user (`pin_hash = NULL`, zero synthetic fields);
- **Prompt 13.3B:** Keberhasilan refaktor kode sumber pekerja migrasi dan perbaikan checker rekonsiliasi;
- **Prompt 13.3C:** Keberhasilan pengujian transaksi ACID per tenant batch, pembuktian rollback atomik saat failure-injection, sanitasi credential logging, dan redaksi plaintext PIN;

Project Owner dengan ini menerbitkan **OTORISASI RESMI EKSEKUSI LIVE BACKFILL (`OAUTH-13.4-01`)** pada basis data produksi `pos_db`.

Status teknis:
> **READY FOR LIVE BACKFILL EXECUTION**

Dokumen ini adalah mandat resmi dan mengikat bagi Antigravity (*Implementation Agent*) untuk mengeksekusi Backfill langsung pada `pos_db`.

---

# 2. OWNER DECISION

## OAUTH-13.4-01 — LIVE BACKFILL EXECUTION
**STATUS: APPROVED**

Antigravity diotorisasi secara resmi untuk mengeksekusi script Backfill langsung:
```bash
cd /Users/dendyaditya/Projects/pos_project/pos_apps/server
DATABASE_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}?schema=public" npx tsx src/migrations/backfill/index.ts --execute
```
terhadap basis data `pos_db` pada `localhost:5432` dengan mengikuti seluruh protokol keamanan dan tahapan sekuensial yang diwajibkan di bawah ini.

---

# 3. MANDATORY PRE-EXECUTION PREREQUISITES

Sebelum perintah `--execute` dijalankan, Antigravity **WAJIB** mengeksekusi dan membuktikan keberhasilan 4 langkah prasyarat berikut:

### 3.1 Quiescence Confirmation
Pastikan aplikasi tetap dalam status **OFFLINE**. Buktikan 0 koneksi klien aktif ke `pos_db`:
```sql
SELECT count(*) FROM pg_stat_activity WHERE datname = 'pos_db' AND pid <> pg_backend_pid();
```
*Syarat:* Hasil harus tepat `0`. Jika `> 0`, HENTIKAN EKSEKUSI.

### 3.2 Target Tables Zero Baseline Check
Pastikan seluruh 18 tabel target dalam kondisi steril (tepat 0 baris data):
```sql
SELECT 'storage_locations' as tbl, count(*) from storage_locations
UNION ALL SELECT 'inventory_items', count(*) from inventory_items
UNION ALL SELECT 'product_variants', count(*) from product_variants
UNION ALL SELECT 'inventory_balances', count(*) from inventory_balances
UNION ALL SELECT 'inventory_ledgers', count(*) from inventory_ledgers
UNION ALL SELECT 'payment_transactions', count(*) from payment_transactions
UNION ALL SELECT 'legacy_stock_movements', count(*) from legacy_stock_movements;
```
*Syarat:* Seluruh tabel target harus bernilai `0`.

### 3.3 Physical Pre-Flight Backup
Buat salinan biner (*custom-format binary dump*) dari `pos_db` sebelum mutasi:
```bash
mkdir -p server/backups
PGPASSWORD="${PGPASSWORD}" pg_dump -U "${PGUSER}" -h "${PGHOST}" -p "${PGPORT}" -F c -b -v \
  -f "server/backups/pos_db_pre_backfill_$(date +%Y%m%d_%H%M%S).dump" "${PGDATABASE}"
```
*Syarat:* File dump harus terbentuk dengan ukuran valid (> 0 bytes).

### 3.4 Isolated Sandbox Restore Verification
Buktikan integritas file backup dengan melakukan uji coba *restore* ke database sementara (*disposable sandbox*, DILARANG me-restore di atas `pos_db`):
```bash
PGPASSWORD="${PGPASSWORD}" dropdb -U "${PGUSER}" -h "${PGHOST}" -p "${PGPORT}" --if-exists pos_restore_sandbox
PGPASSWORD="${PGPASSWORD}" createdb -U "${PGUSER}" -h "${PGHOST}" -p "${PGPORT}" pos_restore_sandbox
PGPASSWORD="${PGPASSWORD}" pg_restore -U "${PGUSER}" -h "${PGHOST}" -p "${PGPORT}" -d pos_restore_sandbox -v \
  "$(ls -t server/backups/pos_db_pre_backfill_*.dump | head -n 1)"
PGPASSWORD="${PGPASSWORD}" dropdb -U "${PGUSER}" -h "${PGHOST}" -p "${PGPORT}" pos_restore_sandbox
```
*Syarat:* Restore uji coba harus selesai tanpa error fatal, dan sandbox harus langsung dibersihkan.

---

# 4. AUTHORIZED EXECUTION CONTRACT

Antigravity mengeksekusi:
```bash
npx tsx src/migrations/backfill/index.ts --execute
```

### 4.1 Invariant Mutasi Fisik yang Diharapkan (Deterministic Inventory)
Setelah eksekusi selesai, mutasi data harus tepat sesuai tabel inventaris mutasi deterministik berikut:

| Worker | Target Table | Operasi | Target Baris Diharapkan | Keterangan & Invariant |
| :--- | :--- | :--- | :--- | :--- |
| `01_tenant_audit` | - | Read-only Audit | 0 mutasi | 7 tabel legacy bebas NULL tenant_id |
| `02_storage_locations` | `storage_locations` | `INSERT` | **2 baris** | 1 storefront default per outlet legacy |
| `03_inventory_items` | `inventory_items` | `INSERT` | **1 baris** | Item logistik untuk Kopi Susu Gula Aren |
| `04_product_variants` | `product_variants` | `INSERT` | **1 baris** | Varian komersial default (SKU: `KOP-001`) |
| `05_inventory_balances` | `inventory_balances` | `INSERT` | **2 baris** | Saldo fisik unbatched (Pusat: 50, Cabang: 25) |
| `06_inventory_ledger_baseline` | `inventory_ledgers` | `INSERT` | **2 baris** | Saldo pembukaan kalibrasi (OD-13.3-01 Option A) |
| `07_user_model_b` | `users` | `UPDATE` | **2 baris** | `user_code` terisi, legacy PIN di-hash Bcrypt (OD-13.3-03) |
| `08_order_items` | `order_items` | `UPDATE` | **0 baris** | Baseline pos_db saat ini memiliki 0 order_items aktif |
| `09_payment_transactions` | `payment_transactions` | `INSERT` | **0 baris** | Baseline pos_db saat ini memiliki 0 payments aktif |
| `10_archive_stock_movements` | `legacy_stock_movements`| `INSERT` | **2 baris** | Arsip read-only mutasi legacy (ODR-05) |
| **TOTAL MUTASI** | — | — | **12 baris** | **10 Target Inserts + 2 Legacy User Updates** |

### 4.2 Invariant Tabel Legacy Terlindungi
18 tabel legacy yang dilindungi:
`categories`, `customers`, `hold_orders`, `order_items`, `orders`, `outlet_products`, `outlets`, `payments`, `platform_users`, `products`, `saas_invoices`, `saas_payments`, `shifts`, `stock_movements`, `subscription_plans`, `tenant_subscriptions`, `tenants`, `users`.
- **Wajib mempertahankan tepat 17 baris data asli.**
- Dilarang keras melakukan DELETE, TRUNCATE, atau DROP pada tabel manapun.
- Tabel `users` hanya diperbolehkan menerima update pada transition columns (`user_code`, `pin_hash`, `updated_at`).

---

# 5. STRICT STOP CONDITIONS & FAIL-CLOSED PROTOCOL

Eksekusi **WAJIB SEGERA DIBATALKAN** dan dilaporkan kepada Project Owner apabila:
1. Terjadi exception unhandled atau SQL error pada worker manapun saat eksekusi live. (Sistem harus membiarkan `prisma.$transaction` mengeksekusi `ROLLBACK` atomik).
2. Jumlah baris yang tercipta pada tabel target menyimpang dari angka 10 baris baru.
3. Terjadi koneksi aplikasi tidak terduga ke `pos_db` selama jendela migrasi.
4. Terjadi kehilangan baris data legacy.

*Aturan Recovery:* Jika terjadi kegagalan fatal, DILARANG menjalankan perintah destruktif DROP database secara otomatis. Seluruh proses pemulihan harus melalui instruksi bencana terkendali (*disaster recovery*) dari Project Owner.

---

# 6. MANDATORY POST-EXECUTION RECONCILIATION

Segera setelah eksekusi Backfill selesai, Antigravity **WAJIB** menjalankan suite rekonsiliasi kesetaraan data penuh:

```bash
cd /Users/dendyaditya/Projects/pos_project/pos_apps/server
DATABASE_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}?schema=public" npx tsx src/migrations/reconciliation/reconcile_all.ts
```

### Standar Kelulusan Parity (Zero Tolerance):
- **Tenant Boundary Integrity:** 0 diskrepansi (0 cross-tenant linkage, 0 NULL tenant_id).
- **Product Variant Coverage:** 0 diskrepansi (100% produk legacy memiliki default varian).
- **Inventory Physical Baseline:** 0 diskrepansi (sum `inventory_balances` = sum `outlet_products` = 75.000).
- **Ledger Audit Integrity:** 0 diskrepansi ($\text{balance} = \sum \text{deltas}$ pada `inventory_ledgers`).
- **User Model B Credentials:** 0 diskrepansi (100% user aktif memiliki `user_code`, legacy PIN berformat Bcrypt valid, PIN-less user mempertahankan `pin_hash = NULL`).
- **Sales & Payment Parity:** 0 diskrepansi.

---

# 7. DELIVERABLES & REPORTING REQUIREMENT

Antigravity harus menyusun laporan eksekusi resmi pada file:
```text
docs/validation/19_PROMPT_13_4_LIVE_BACKFILL_EXECUTION_REPORT.md
```

Laporan wajib memuat:
1. Bukti timestamp dan ukuran file backup fisik pre-flight beserta bukti verifikasi restore sandbox.
2. Log eksekusi terminal lengkap dari `backfill/index.ts --execute`.
3. Tabel hitungan fisik baris data riil pasca-eksekusi (membuktikan 10 baris target + 17 baris legacy utuh).
4. Log eksekusi terminal lengkap dari `reconcile_all.ts` yang menunjukkan **100% Parity Achieved (0 Discrepancies)**.
5. Konfirmasi tidak adanya regenerasi Prisma client (`node_modules/@prisma/client` tidak berubah).
6. Deklarasi Final Gate:
   ```text
   FINAL GATE: READY FOR POST-BACKFILL RECONCILIATION REVIEW & DUAL-WRITE AUTHORIZATION PLANNING
   ```

Setelah laporan dibuat, **BERHENTI DAN SERAHKAN KEPADA PROJECT OWNER UNTUK DIAUDIT.**
Dilarang lanjut ke tahap Dual-Write atau tahap berikutnya tanpa persetujuan tertulis Project Owner.
