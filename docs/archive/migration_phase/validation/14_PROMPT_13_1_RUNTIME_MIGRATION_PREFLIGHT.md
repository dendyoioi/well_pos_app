# 14_PROMPT_13_1_RUNTIME_MIGRATION_PREFLIGHT.md
## Runtime Migration Preflight & Execution Readiness Assessment

### 1. Document Control & Metadata
- **Stage**: Prompt 13.1 — Runtime Migration Preflight & Execution Readiness
- **Parent Stage**: Prompt 12.6-E (`READY FOR PROMPT 13`)
- **Execution Date**: September 20, 2026
- **Lead System**: Lead Database & Systems Architect (Antigravity)
- **Role**: Migration Safety Lead & Runtime Readiness Reviewer
- **Execution Mode**: Strictly Read-Only Diagnostic Preflight (Zero DDL, Zero DML, Zero Database Mutation)
- **Target Database**: `pos_db` on `localhost:5432` (PostgreSQL 14.23 Homebrew)
- **Preflight Gate Verdict**: **`BLOCKED / OWNER REVIEW REQUIRED`**

---

### 2. Executive Summary
Prompt 13.1 performed the comprehensive runtime migration preflight to determine whether the target PostgreSQL database `pos_db` and execution environment are demonstrably prepared for an authorized execution of the Expand migration (`20260919000000_expand_phase_ddl`).

While core infrastructure conditions (superuser privileges, absence of active blocking locks, application server quiescence, and clean absence of target tables) are verified safe, **the preflight identified two critical safety blockers**:

1. **Pre-Existing Column Precision Incompatibility in `order_items` (Verified Hard Blocker)**:
   - In `pos_db`, table `order_items` already possesses columns `cost_price` and `discount_amount`, both created during prototype development as `numeric(12, 2) NOT NULL`.
   - In `migration.sql` Section 1.3 lines 648–649 and 671–675, the preflight verification block explicitly asserts:
     - `order_items.cost_price`: expected precision 15, scale 4.
     - `order_items.discount_amount`: expected precision 15, scale 2.
   - The strict preflight rule (`v_actual_prec != v_col.expected_prec OR v_actual_scale != v_col.expected_scale`) will **immediately throw an exception and abort the migration** upon execution.
2. **Missing Physical Database Backup (Policy Blocker)**:
   - Pursuant to `10_PROMPT_12_EXECUTION_GUARDRAILS.md`, a physical backup snapshot (`pg_dump`) is mandatory prior to live execution.
   - No backup snapshot currently exists on disk.

In accordance with fail-closed operating principles, Prompt 13.1 halts at the preflight gate: **`BLOCKED / OWNER REVIEW REQUIRED`**.

---

### 3. Environment Identity & Connection Preflight
Direct inspection of connection configuration in `server/.env` and live PostgreSQL system catalogs establishes:
- **Connection URL**: `postgresql://postgres:***@localhost:5432/pos_db?schema=public`
- **Host**: `localhost` (resolved to IPv6 `::1`)
- **Port**: `5432`
- **Database Name**: `pos_db`
- **Current Schema**: `public`
- **Database User**: `postgres` (verified as superuser: `rolsuper = true`, `canlogin = true`)
- **PostgreSQL Version**: `PostgreSQL 14.23 (Homebrew) on aarch64-apple-darwin25.6.0`
- **Environment Context**: Local Development / Prototype Staging Database
- **Ambiguity**: None. Target database identity is 100% unambiguous.

---

### 4. Physical Database Baseline & Row Audit
Physical inspection of `pos_db` confirms the exact baseline:
- **Total Base Tables**: **18**
- **Protected Legacy Baseline**: Exactly the 18 ratified legacy tables:
  `categories`, `customers`, `hold_orders`, `order_items`, `orders`, `outlet_products`, `outlets`, `payments`, `platform_users`, `products`, `saas_invoices`, `saas_payments`, `shifts`, `stock_movements`, `subscription_plans`, `tenant_subscriptions`, `tenants`, `users`.
- **Total Data Rows**: Exactly **17 rows** across 10 populated tables:
  1. `categories`: 1 row (`Minuman`)
  2. `outlet_products`: 2 rows (stock: 20 and 80)
  3. `outlets`: 2 rows (`Toko Utama`, `Gudang Utama`)
  4. `platform_users`: 1 row (`superadmin@wellpos.id`)
  5. `products`: 1 row (`Kopi Susu Gula Aren`, SKU: `SKU-595201`, barcode: `8995766976589`)
  6. `stock_movements`: 2 rows (quantities: 20 and 80)
  7. `subscription_plans`: 4 rows
  8. `tenant_subscriptions`: 1 row (`Ura Coffee` on Pro plan)
  9. `tenants`: 1 row (`Ura Coffee`, status: `TRIAL`)
  10. `users`: 2 rows (`rudra@uracoffee.com` [ADMIN], `kasir-1789775595100@1b29b1a6.pos` [CASHIER])
- **Unpopulated Legacy Tables (0 rows)**:
  `customers`, `hold_orders`, `order_items`, `orders`, `payments`, `saas_invoices`, `saas_payments`, `shifts`.
- **Ownership Registry**: `_prompt_12_ownership_registry` does not exist (`NULL`).

---

### 5. Migration History & Schema Drift Preflight
- **Prisma Migration History Table**: `_prisma_migrations` does not exist in `pos_db`.
- **Migration Directory**: `/server/prisma/migrations/` contains exactly one directory: `20260919000000_expand_phase_ddl`.
- **Predecessor Dependencies**: None. This is the initial Expand phase migration.
- **Partially Applied State**: None. No target tables exist, no ownership registry exists.
- **Migration Application Status**: The Expand migration is confirmed **UNAPPLIED**.

---

### 6. Runtime Compatibility & Database Privileges
- **PostgreSQL Version**: 14.23 (fully supports transactional DDL, PL/pgSQL blocks, JSONB, composite types).
- **Core Extensions**: `plpgsql` (version 1.0) is installed and active.
- **Role Privileges**:
  - `has_schema_privilege('postgres', 'public', 'CREATE')`: `true`
  - `has_schema_privilege('postgres', 'public', 'USAGE')`: `true`
  - User `postgres` has full DDL privileges to create tables, enums, indexes, and constraints.
- **Transaction Settings**:
  - `statement_timeout`: 0 (unlimited)
  - `lock_timeout`: 0 (unlimited)
  - `idle_in_transaction_session_timeout`: 0 (unlimited)
  - *Recommendation*: Set explicit `lock_timeout = '5s'` and `statement_timeout = '60s'` when executing the migration to avoid lock-wait stalls.

---

### 7. Locks, Sessions & Background Quiescence
- **Active User Sessions**: 0 (only our diagnostic `psql` connection was active).
- **Long-Running Transactions**: 0.
- **Blocking Locks**: None detected on user catalog tables.
- **Application Server**: Inactive. Port 5001 has no active listener (`lsof -i :5001` returned empty).
- **Quiescence Status**: The database is fully quiescent and idle.

---

### 8. Backup & Recovery Readiness Assessment
- **Physical Snapshot Backup (`pg_dump`)**: **NOT VERIFIED**. No backup archive file was discovered in the repository or local filesystem.
- **Restore Capability**: **NOT VERIFIED**. Without a verified physical snapshot, point-in-time restore cannot be guaranteed.
- **Rollback Script**: **PASS — VERIFIED**. The rollback script `rollback.sql` is present, verified by AST scanners and static tests, and enforces strict non-destructiveness (protecting all 18 legacy tables).
- **Governance Finding**: Under Section 15 of Prompt 13.1 and `10_PROMPT_12_EXECUTION_GUARDRAILS.md`, a rollback script is NOT an acceptable substitute for a verified physical backup. This is classified as a policy blocker.

---

### 9. Migration Applicability & Collision Analysis

#### 9.1 Target Tables Collision Check (18 Tables)
Query for all 18 target core tables (`inventory_items`, `product_variants`, `storage_locations`, `inventory_batches`, `inventory_balances`, `inventory_ledgers`, `unit_conversions`, `recipes`, `recipe_items`, `modifier_groups`, `modifier_items`, `product_modifier_groups`, `modifier_recipe_effects`, `payment_transactions`, `refunds`, `refund_items`, `idempotency_records`, `legacy_stock_movements`):
- **Result**: **0 target tables exist in `pos_db`**. Zero collisions detected.

#### 9.2 Transition Columns Collision & Precision Conflict (23 Columns across 8 Tables)
Preflight inspection of the 23 transition columns defined in Section 3 of `migration.sql`:
- 21 transition columns are completely absent and ready for additive creation.
- **2 transition columns pre-exist in `order_items` in an incompatible form**:
  1. `order_items.cost_price`: Pre-exists as `numeric(12, 2) NOT NULL`. Expected in `migration.sql` lines 648 & 1162 as `numeric(15, 4) DEFAULT 0`.
  2. `order_items.discount_amount`: Pre-exists as `numeric(12, 2) NOT NULL DEFAULT 0`. Expected in `migration.sql` lines 649 & 1163 as `numeric(15, 2) DEFAULT 0`.
- **Failure Path**: Section 1.3 lines 671–675 of `migration.sql` enforces strict precision/scale equivalence. When it inspects `order_items.cost_price`, `(12, 2) != (15, 4)` triggers `RAISE EXCEPTION`, immediately aborting the migration before any schema modifications occur.

#### 9.3 Live Enum State & Protection
Exactly 10 custom enums exist in `pos_db`:
- **3 Exact Compatible Enums (`PRE_EXISTING_EXACT_COMPATIBLE_REUSED`)**:
  - `BillingCycle`: `MONTHLY, ANNUALLY` (2 labels, exact match)
  - `ShiftStatus`: `OPEN, CLOSED` (2 labels, exact match)
  - `TenantStatus`: `TRIAL, ACTIVE, SUSPENDED, CANCELLED, PENDING` (5 labels, exact match)
- **7 Incompatible Enums (`PRE_EXISTING_INCOMPATIBLE`)**:
  - `PlatformRole`, `InvoiceStatus`, `Role`, `StockMovementType`, `PaymentStatus`, `PaymentMethod`, `PaymentTxStatus`.
- **Status**: The Expand migration logic respects these enums by leaving them untouched and registering them as pre-existing objects.

---

### 10. Data & Identity Prerequisites (Model B Readiness)
- **Tenant Integrity**: Single tenant `Ura Coffee` (`1b29b1a6-898b-4aab-bbda-76db544c4a8f`).
- **User Identity (Model B)**:
  - 2 users: `rudra@uracoffee.com` (ADMIN) and cashier `kasir-1789775595100@1b29b1a6.pos`.
  - Both users have plaintext PIN `111111` in legacy column `pin`.
  - Neither user has `user_code` or `pin_hash` yet.
  - Future backfill must hash `111111` using bcrypt and generate deterministic `user_code` values (`USR-0001`, `USR-0002`).
- **Product Catalog**:
  - 1 product (`Kopi Susu Gula Aren`). SKU `SKU-595201` is unique; barcode `8995766976589` is unique.
  - 2 outlet_products mapping cleanly to outlets `7e70990f` and `f1d3b250`.
  - Catalog data is fully deterministic and ready for eventual variant/inventory mapping.
- **Orders / Payments**: 0 rows in prototype database. No legacy order corruption risk.

---

### 11. Preflight Verification Matrix

| Domain | Check Item | Observed Evidence | Status | Impact / Requirement |
| :--- | :--- | :--- | :---: | :--- |
| **Database Identity** | Target Connection | `pos_db` on `localhost:5432`, user `postgres` | **PASS — VERIFIED** | Unambiguous target connection |
| **Database Baseline** | 18 Legacy Tables | All 18 tables present in `pos_db` | **PASS — VERIFIED** | Matches protected legacy baseline |
| **Database Baseline** | Data Row Count | Exactly 17 rows across 10 tables | **PASS — VERIFIED** | Baseline completely pristine |
| **Migration History** | Unapplied Expand | No `_prisma_migrations` or target tables | **PASS — VERIFIED** | Clean unapplied state |
| **PostgreSQL Runtime** | Version 14.23 | Compatible with all target DDL | **PASS — VERIFIED** | Runtime engine fully supported |
| **Role Privileges** | Superuser Access | `rolsuper = true`, `can_create = true` | **PASS — VERIFIED** | Sufficient privileges for DDL |
| **Locks & Activity** | Zero Blocking Locks | 0 active user queries, port 5001 idle | **PASS — VERIFIED** | Full quiescence |
| **Target Tables Collision** | 18 Target Tables | 0 target tables exist in `pos_db` | **PASS — VERIFIED** | Zero object collisions |
| **Transition Columns** | 23 Transition Cols | 21 absent, but 2 pre-exist with incompatible precision | **BLOCKER** | `order_items.cost_price` (12,2) vs (15,4) aborts migration |
| **Live Enums** | 10 Catalog Enums | 3 exact match, 7 incompatible preserved | **PASS — VERIFIED** | Handled fail-closed in DDL |
| **Backup Readiness** | Physical Backup | No physical `pg_dump` file exists | **NOT VERIFIED** | Mandatory backup must be created before execution |
| **Recovery Path** | Rollback Script | `rollback.sql` verified non-destructive | **PASS — VERIFIED** | Rollback path verified |
| **Data Prerequisites** | Tenant / Product / User | 1 tenant, 1 product, 2 users (plaintext PIN) | **PASS — VERIFIED** | Catalog clean; PIN hashing needed in backfill |

---

### 12. Preflight Gate Verdict

Due to the verified precision mismatch on `order_items.cost_price` and the absence of a physical database backup snapshot:

## **BLOCKED / OWNER REVIEW REQUIRED**

### Specific Action Items Required for Resolution:
1. **Resolution of `order_items.cost_price` / `discount_amount` Preflight Conflict**:
   - The Project Owner must decide whether:
     - **Option A**: Adjust `migration.sql` Section 1.3 to classify pre-existing `numeric(12, 2)` columns on `order_items` as acceptable legacy baselines (`expected_prec = 12, expected_scale = 2` for legacy preflight), OR
     - **Option B**: Alter `order_items.cost_price` and `discount_amount` in `pos_db` to `numeric(15, 4)` and `numeric(15, 2)` prior to migration, OR
     - **Option C**: Truncate/align `order_items` schema since `order_items` currently contains 0 data rows.
2. **Execution of Physical Database Backup**:
   - Prior to authorized Expand execution, execute `pg_dump -Fc -h localhost -U postgres -d pos_db > pos_db_pre_expand.dump` and verify its integrity.
