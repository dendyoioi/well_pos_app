# 14_PROMPT_13_1A_BLOCKER_ANALYSIS_OWNER_DECISION.md
## Blocker Analysis & Owner Decision Packet: `order_items` Precision & Recovery Readiness

### 1. Document Control & Metadata
- **Stage**: Prompt 13.1A — Blocker Analysis & Owner Decision Packet
- **Parent Stage**: Prompt 13.1 — Runtime Migration Preflight & Execution Readiness
- **Next Stage**: Prompt 13.1B — Authorized Blocker Resolution, Backup & Re-Preflight (Pending Owner Decision)
- **Date**: September 20, 2026
- **Lead System**: Lead Database & Systems Architect + Migration Safety Lead (Antigravity)
- **Mode**: Strictly Read-Only Analysis (Zero DDL, Zero DML, Zero Database Mutation, Zero Schema Changes)
- **Gate Status**: **`BLOCKED / OWNER REVIEW REQUIRED`**

---

### 2. Executive Summary
Following the execution of Prompt 13.1 (Runtime Migration Preflight), the environment was evaluated as `BLOCKED / OWNER REVIEW REQUIRED` due to two specific conditions:
1. **Blocker A**: An active compatibility exception in `migration.sql` Section 1.3 triggered by a numeric precision mismatch between pre-existing legacy columns in `order_items` (`cost_price` and `discount_amount` at `numeric(12, 2)`) and the migration's strict preflight assertion (`numeric(15, 4)` and `numeric(15, 2)`).
2. **Blocker B**: The absence of a physical database backup snapshot (`pg_dump`), which is required by `10_PROMPT_12_EXECUTION_GUARDRAILS.md` before live migration execution.

This document presents the detailed architectural and data-safety analysis of both blockers, evaluates all viable resolution options, establishes the critical safety sequencing rule, and presents the formal **Owner Decision Packet** for explicit Project Owner authorization.

---

### 3. Blocker A Evidence — `order_items` Numeric Precision Mismatch

#### 3.1 Live Catalog Observation in `pos_db`
Direct query of `information_schema.columns` for `order_items`:
```sql
SELECT column_name, data_type, udt_name, numeric_precision, numeric_scale, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'order_items' 
  AND column_name IN ('cost_price', 'discount_amount');
```
**Observed Result**:
```text
   column_name   | data_type | udt_name | numeric_precision | numeric_scale | is_nullable | column_default 
-----------------+-----------+----------+-------------------+---------------+-------------+----------------
 cost_price      | numeric   | numeric  |                12 |             2 | NO          | 
 discount_amount | numeric   | numeric  |                12 |             2 | NO          | 0
(2 rows)
```
- Total rows currently in `order_items`: **0 rows**.
- Legacy schema origin: `order_items` was originally defined during prototype development with 2 decimal places for financial amounts.

#### 3.2 Executable Migration Contract in `migration.sql`
In `migration.sql` lines 648–650 (Section 1.3 Preflight Table):
```sql
('order_items', 'cost_price', 'numeric', NULL, 15, 4, '0', 'NO'),
('order_items', 'discount_amount', 'numeric', NULL, 15, 2, '0', 'NO'),
```
In `migration.sql` lines 671–675 (Strict Precision Assertion Loop):
```sql
IF v_col.expected_prec IS NOT NULL AND (v_actual_prec != v_col.expected_prec OR v_actual_scale != v_col.expected_scale) THEN
    RAISE EXCEPTION 'COLUMN COMPATIBILITY VIOLATION: Numeric column "%.%" has precision (%,%), expected (%,%). Migration aborted.',
        v_col.table_name, v_col.column_name, v_actual_prec, v_actual_scale, v_col.expected_prec, v_col.expected_scale;
END IF;
```
In `migration.sql` lines 1162–1163 (Section 3 Additive Column Statement):
```sql
ADD COLUMN IF NOT EXISTS "cost_price" DECIMAL(15, 4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "discount_amount" DECIMAL(15, 2) DEFAULT 0,
```

#### 3.3 Root Cause of Blocker A
1. `migration.sql` treated `cost_price` and `discount_amount` as transition columns to be added additively with `ADD COLUMN IF NOT EXISTS`.
2. However, because both columns already pre-exist in the legacy prototype table `order_items`, Section 1.3 subjects them to pre-existing column compatibility verification.
3. The verification routine requires exact precision and scale equivalence (`v_actual_prec == expected_prec` and `v_actual_scale == expected_scale`).
4. Because `v_actual_prec = 12` and `v_actual_scale = 2`, while `expected_prec = 15` and `expected_scale = 4` (for `cost_price`), Section 1.3 throws an unhandled exception:
   `COLUMN COMPATIBILITY VIOLATION: Numeric column "order_items.cost_price" has precision (12,2), expected (15,4). Migration aborted.`
5. As a result, `migration.sql` cannot execute to completion against `pos_db` in its current state.

---

### 4. Blocker B Evidence — Physical Recovery & Backup Readiness

#### 4.1 Current Repository & Filesystem Inspection
- A recursive search of the workspace (`find /Users/dendyaditya/Projects/pos_project -name "*backup*" -o -name "*.dump" -o -name "*.tar" -o -name "*pos_db*.sql"`) located zero physical database backup archives.
- No automated backup cron or snapshot hook is currently active in the local PostgreSQL instance.

#### 4.2 Governance Invariant
- Under `10_PROMPT_12_EXECUTION_GUARDRAILS.md` (Section 4, Rule 1):
  > *"Prior to executing any DDL or backfill against staging or production, a physical snapshot (`pg_dump` or cloud storage backup) must be taken and verified."*
- Under Prompt 13.1 (Section 15):
  > *"A rollback SQL script is not a substitute for database backup/recovery capability. If a backup cannot be verified, report as NOT VERIFIED / BLOCKER."*

---

### 5. Source Comparison & Contract Alignment

| Contract Layer | Source Reference | `order_items.cost_price` | `order_items.discount_amount` | Alignment Status |
| :--- | :--- | :--- | :--- | :--- |
| **Physical DB (`pos_db`)** | `information_schema.columns` | `numeric(12, 2) NOT NULL` | `numeric(12, 2) NOT NULL DEFAULT 0` | **DIVERGENT (Legacy)** |
| **Target Schema Rev 4** | `04_TARGET_DATABASE_SCHEMA.md` L751–752 | `Decimal(15, 4) DEFAULT 0` | `Decimal(15, 2) DEFAULT 0` | **CANONICAL TARGET** |
| **Prisma Schema** | `schema.prisma` L646–647 | `@db.Decimal(15, 4) DEFAULT 0` | `@db.Decimal(15, 2) DEFAULT 0` | **CANONICAL TARGET** |
| **Migration DDL (Preflight)** | `migration.sql` L648–649 | `expected: (15, 4)` | `expected: (15, 2)` | Matches Target Contract |
| **Migration DDL (Execution)** | `migration.sql` L1162–1163 | `DECIMAL(15, 4) DEFAULT 0` | `DECIMAL(15, 2) DEFAULT 0` | Matches Target Contract |

**Semantic Purpose of Precision (15, 4)**:
In retail/F&B systems supporting fractional units, recipe ingredient consumption, and batch costing, `cost_price` requires 4 decimal places (e.g. IDR per gram or milliliter) to prevent rounding errors across high-volume sales. In contrast, `discount_amount` is a discrete currency deduction, appropriately sized at 2 decimal places.

---

### 6. Treatment Options Analysis for Blocker A

#### OPTION A: Relax `migration.sql` Preflight Assertion to Accept Legacy `(12, 2)`
- **Mechanism**: Edit `migration.sql` lines 648–649 to set `expected_prec = 12` and `expected_scale = 2`.
- **Pros**:
  - Requires zero DDL mutation on `pos_db` prior to Expand.
- **Cons**:
  - **Severe Schema Drift**: In Section 3, `ADD COLUMN IF NOT EXISTS "cost_price" DECIMAL(15, 4)` is a NO-OP because the column already exists. The column remains physically `numeric(12, 2)`.
  - **Prisma & Target Incompatibility**: Prisma expects `@db.Decimal(15, 4)`. Writes with 4 decimal places will fail or be truncated by PostgreSQL.
  - **Reopens Migration Testing**: Modifying `migration.sql` invalidates previous verification evidence and requires re-running static safety AST scans.

#### OPTION B (RECOMMENDED): Align Legacy Column Precision via Pre-Migration DDL
- **Mechanism**: Execute a targeted, lossless ALTER TABLE statement against `pos_db` prior to running Expand:
  ```sql
  ALTER TABLE "order_items" 
    ALTER COLUMN "cost_price" TYPE NUMERIC(15, 4),
    ALTER COLUMN "cost_price" SET DEFAULT 0,
    ALTER COLUMN "discount_amount" TYPE NUMERIC(15, 2),
    ALTER COLUMN "discount_amount" SET DEFAULT 0;
  ```
- **Technical Safety Evaluation**:
  1. **Zero Data Loss**: Widening precision from 12 → 15 and scale from 2 → 4 is completely non-destructive and mathematically lossless in PostgreSQL.
  2. **Zero Row Impact**: Table `order_items` currently contains **0 data rows**. There is zero data to convert, lock, or migrate.
  3. **100% Target Contract Harmony**: Post-alter, `pos_db` physically satisfies Target Database Schema Revision 4 and Prisma `@db.Decimal(15, 4)` specifications.
  4. **Clean Expand Preflight**: Section 1.3 will find exact precision `(15, 4)` and `(15, 2)`, register them as compatible, and proceed without exception.
  5. **Zero `migration.sql` Mutation**: `migration.sql` remains completely untouched, preserving all Prompt 12.6-E test suites and checksums.

#### OPTION C: Recreate Unpopulated Legacy Table `order_items`
- **Mechanism**: Drop and recreate `order_items` with Target Schema Revision 4 column types.
- **Cons**: Unnecessarily destructive; violates the non-destructive baseline principle. Not recommended.

---

### 7. Critical Safety Sequencing Rule

> **MANDATORY SAFETY INVARIANT**:
> If the Project Owner authorizes **Option B** (pre-migration live schema alignment), **Blocker B (Physical Backup) MUST BE COMPLETED AND VERIFIED FIRST** before any ALTER TABLE statement is executed against `pos_db`.

Under no circumstances will a live DDL mutation be performed without an existing, validated physical backup archive.

```text
EXECUTION ORDER:
1. Physical Backup Creation (`pg_dump -Fc`)
   ↓
2. Physical Backup Verification (`pg_restore --list`)
   ↓
3. Live Column Alignment (Option B: ALTER TABLE order_items ...)
   ↓
4. Re-run Prompt 13.1 Preflight & Verify Full Compatibility
```

---

### 8. Physical Backup Specification (Blocker B Resolution)

To satisfy Blocker B, the backup procedure in Stage B (Prompt 13.1B) must execute:
1. **Command**:
   ```bash
   mkdir -p /Users/dendyaditya/Projects/pos_project/pos_apps/server/backups
   pg_dump -Fc -h localhost -U postgres -d pos_db > /Users/dendyaditya/Projects/pos_project/pos_apps/server/backups/pos_db_pre_expand_$(date +%Y%m%d_%H%M%S).dump
   ```
2. **Verification Checkpoints**:
   - Exit code must be `0`.
   - File size must be greater than 0 bytes.
   - Archive table of contents must be inspectable via `pg_restore --list <backup_file>`.
   - Archive must confirm presence of all 18 base tables and data rows.

---

### 9. OWNER DECISION PACKET

The Project Owner is formally requested to authorize decisions on the two items below:

---

#### OWNER DECISION ITEM 1: ODR-13.1A-01 (`order_items` Precision Treatment)

- **Context**: `order_items.cost_price` and `discount_amount` currently exist in `pos_db` as `numeric(12, 2)` (with 0 rows), whereas `migration.sql` preflight asserts `numeric(15, 4)` and `numeric(15, 2)`.
- **Options**:
  - **`OPTION B` (Architect Recommended)**: Perform pre-migration column widening in `pos_db` to `numeric(15, 4)` and `numeric(15, 2)` with default 0. This preserves Target Schema compliance, matches Prisma, avoids modifying `migration.sql`, and is 100% lossless on the 0 existing rows.
  - **`OPTION A`**: Modify `migration.sql` preflight to accept `numeric(12, 2)`. (Results in permanent schema drift against Prisma and Target Schema).
- **Scope of Change (if Option B authorized)**:
  - Single DDL execution: `ALTER TABLE "order_items" ALTER COLUMN "cost_price" TYPE NUMERIC(15, 4), ALTER COLUMN "cost_price" SET DEFAULT 0, ALTER COLUMN "discount_amount" TYPE NUMERIC(15, 2), ALTER COLUMN "discount_amount" SET DEFAULT 0;`
  - Zero changes to `migration.sql` or `rollback.sql`.

---

#### OWNER DECISION ITEM 2: ODR-13.1A-02 (Physical Backup Authorization & Sequencing)

- **Context**: `10_PROMPT_12_EXECUTION_GUARDRAILS.md` requires a verified physical backup before live migration or schema modification.
- **Decision Required**:
  - Authorize creation and verification of a full custom-format physical backup (`pg_dump -Fc`) in `server/backups/`.
  - Ratify the mandatory sequencing rule: **Physical backup must be created and verified BEFORE Option B live column alignment is executed**.

---

### 10. Explicit Non-Execution Statement
During Prompt 13.1A:
- Zero DDL statements were executed against `pos_db`.
- Zero DML statements were executed against `pos_db`.
- `pos_db` remains 100% untouched (18 base tables, 17 data rows).
- No backup file was created.
- `migration.sql` and `rollback.sql` remain unaltered.
- Expand migration and Prompt 13.2 have NOT been executed.

---

### 11. Final Gate Verdict
## **BLOCKED / OWNER REVIEW REQUIRED**
*(Awaiting explicit Owner Decision on ODR-13.1A-01 and ODR-13.1A-02 before proceeding to Prompt 13.1B.)*
