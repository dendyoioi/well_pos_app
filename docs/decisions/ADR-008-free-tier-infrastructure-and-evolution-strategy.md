# ADR-008: ARSITEKTUR INFRASTRUKTUR HYBRID FREE-TIER & STRATEGI EVOLUSI KE HOSTING DEDICATED

**Status**: **ACCEPTED & ACTIVE ✅**  
**Tanggal Keputusan**: 2026-10-02  
**Target Komponen**: `pos_apps/server`, Database PostgreSQL (Supabase / Dedicated), Caching (In-Memory / Redis), & Deployment Pipelines  
**Dokumen Terkait**:  
- [`docs/00_PROJECT_CONTEXT.md`](file:///Users/dendyaditya/Projects/pos_project/docs/00_PROJECT_CONTEXT.md) (Section 3, 4 & 7)  
- [`docs/decisions/ADR-001-tenant-boundary-enforcement.md`](file:///Users/dendyaditya/Projects/pos_project/docs/decisions/ADR-001-tenant-boundary-enforcement.md)  
- [`docs/decisions/ADR-007-security-hardening-tenant-isolation.md`](file:///Users/dendyaditya/Projects/pos_project/docs/decisions/ADR-007-security-hardening-tenant-isolation.md)  
- [`docs/epics/EPIC-11_PRODUCTION_HARDENING_RLS_AND_DEVOPS.md`](file:///Users/dendyaditya/Projects/pos_project/docs/epics/EPIC-11_PRODUCTION_HARDENING_RLS_AND_DEVOPS.md)  

---

## 1. KONTEKS & LATAR BELAKANG (CONTEXT)

Well POS dirancang sebagai platform POS & Manajemen Rantai Pasok multi-tenant komersial berstandar enterprise. Pada fase inisiasi dan evaluasi produk (*bootstrap phase*), aplikasi di-deploy pada stack infrastruktur tanpa biaya (*zero-cost infrastructure*):
1. **Frontend**: Vercel Free Tier (Single Page Application, HTTPS, Edge CDN).
2. **Backend**: Render Free Tier Web Service (Node.js/Express, batas 750 jam/bulan, cold start 50 detik).
3. **Database**: Supabase Free Tier PostgreSQL 16 (AWS Singapore, 500 MB database, connection pooler PgBouncer port 6543).
4. **Caching & Queue**: Fallback Node.js in-memory `Map` (tanpa Redis cluster terpisah).

Meskipun konfigurasi ini sangat hemat biaya untuk tahap validasi produk, tim menghadapi **batasan teknis khas lingkungan PaaS/Serverless gratis**:
- PgBouncer Transaction Mode (Port 6543) menolak DDL (`ALTER TABLE`, `CREATE TYPE`) dan membatasi perintah manipulasi session state seperti `SET LOCAL ROLE pos_app`.
- Caching berbasis in-memory tidak tersinkronisasi lintas multi-kontainer jika aplikasi di-scale secara horizontal.
- Layanan gratis Render dapat mengalami *idle sleep* jika tidak diping secara berkala.

**Kebutuhan Bisnis**: Pemilik sistem membutuhkan arsitektur yang **100% tuntas dan stabil di infrastruktur gratis saat ini**, namun **fleksibel** untuk langsung ditingkatkan ke dedicated cloud/hosting lain di masa depan tanpa perombakan kode (*zero application rework*).

---

## 2. KEPUTUSAN ARSITEKTUR (DECISION)

Kami memutuskan untuk mengimplementasikan **Pola Adaptor Hybrid Bertingkat (*Hybrid Progressive Adapter Pattern*)**:

### A. Dual-Mode PostgreSQL & Pooler-Safe RLS
1. **Mode Free-Tier (Saat Ini — Supabase PgBouncer Port 6543)**:
   - **Garis Pertahanan 1 (Enforced 100%)**: Validasi `tenantId` wajib di lapisan aplikasi/service layer (`WHERE tenant_id = $1` dan JWT Auth).
   - **Garis Pertahanan 2 (Defensive Context)**: Fungsi `withTenantContext` di [`rls.service.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/services/rls.service.ts) membungkus `SET LOCAL ROLE` dan `set_config('app.current_tenant_id', ...)` dengan blok aman (`try/catch`) agar transaksi kasir tidak pernah crash akibat penolakan PgBouncer transaction pooler.
2. **Mode Dedicated / Self-Hosted (Masa Depan — Direct Port 5432 / AWS RDS / GCP Cloud SQL)**:
   - Mengaktifkan penegakan isolasi kernel database murni (`KERNEL_HARDENED`), di mana role `pos_app` membatasi superuser dan kebijakan RLS PostgreSQL ditegakkan secara absolut.

### B. Universal Hybrid Cache Adapter
1. **Engine Dual-Driver** di [`cache.service.ts`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/services/cache.service.ts):
   - **Driver IN_MEMORY (Default)**: Menggunakan Node.js `Map` berkinerja tinggi (< 1ms latensi) dengan TTL auto-cleanup dan cache-aside invalidation (`delByPrefix`).
   - **Driver REDIS (Siap Pakai)**: Otomatis aktif saat variabel lingkungan `REDIS_URL` diisi pada hosting baru.
   - Booting logger secara transparan mencetak: `[CacheService] 🟢 Running in Optimized Free-Tier Mode` atau `[CacheService] ⚡ Configured for External REDIS cluster`.

### C. Konsolidasi Target Domain Service (Pembersihan Dual-Write Scaffolding)
1. Seluruh operasi checkout kasir dan pemotongan inventaris telah 100% beralih ke skema target (`orders`, `order_items`, `payment_transactions`, `inventory_balances`, `inventory_ledgers`).
2. Scaffolding legacy dan tabel lama (`outlet_products`, `stock_movements`, `payments`) telah sepenuhnya di-retire. [`SalesDualWriteService`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/src/services/dual_write/sales.dual_write.service.ts) difungsikan sebagai **Unified Sales & Inventory Transaction Engine** yang stabil.

---

## 3. PANDUAN LANGKAH UPGRADE KE HOSTING BARU (MIGRATION PLAYBOOK)

Jika di masa mendatang aplikasi dipindahkan ke infrastruktur berbayar atau hosting mandiri (misal: VPS Ubuntu, DigitalOcean Droplet, AWS ECS/RDS, GCP Cloud Run), tim pengembang/DevOps cukup menjalankan panduan berikut:

### Langkah 1: Database PostgreSQL Dedicated
1. Ubah `DATABASE_URL` pada `.env` menjadi connection string PostgreSQL direct (port 5432):
   ```env
   DATABASE_URL="postgresql://pos_user:password@your-db-host:5432/pos_db?sslmode=require"
   ```
2. Jalankan penegakan RLS kernel penuh:
   ```bash
   npm run db:remote:sql -- "SELECT 1;" # pastikan koneksi
   # Jalankan rlsService.enableTenantRLS() untuk mengaktifkan FORCE ROW LEVEL SECURITY
   ```

### Langkah 2: Penyambungan Redis Eksternal (Cluster Cache)
1. Buat instance Redis (misal: Upstash Redis Free/Pay-as-you-go atau AWS ElastiCache).
2. Tambahkan variabel lingkungan `REDIS_URL` di server hosting:
   ```env
   REDIS_URL="redis://default:token@your-redis-host:6379"
   ```
3. Restart server backend. CacheService otomatis beralih dari in-memory ke cluster Redis tanpa mengubah sebaris pun kode logika POS.

### Langkah 3: Eksekusi Migrasi DDL Otomatis
1. Pada hosting dedicated yang terhubung langsung ke Port 5432, migrasi DDL dapat dijalankan saat deploy container:
   ```bash
   npx prisma migrate deploy
   ```
2. Skrip `SchemaPatcher` tetap dapat beroperasi secara idempotent sebagai proteksi ganda.

---

## 4. KONSEKUENSI & DAMPAK (CONSEQUENCES)

### Dampak Positif (Keuntungan):
1. **Zero-Cost Sustainability**: Sistem 100% fungsional, stabil, dan aman di hosting gratisan Render & Supabase tanpa tagihan kartu kredit.
2. **Resilience**: Transaksi kasir tidak rentan gagal akibat keterbatasan konfigurasi pooler database cloud.
3. **Seamless Portability**: Kode aplikasi tidak terkunci (*vendor lock-in*) pada batasan Render atau Supabase.

### Catatan Pengawasan (Monitoring):
1. Selama di tier gratis Render, batas kuota bulanan 750 jam tetap dipantau oleh bot pinger GitHub Actions (`keep_alive.yml`).
2. Inactivity pause Supabase (7 hari tanpa kueri) tetap dicegah oleh transaksi reguler atau query keep-alive.
