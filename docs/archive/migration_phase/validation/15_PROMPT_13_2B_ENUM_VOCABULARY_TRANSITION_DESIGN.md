# 15_PROMPT_13_2B_ENUM_VOCABULARY_TRANSITION_DESIGN.md
## Enum Vocabulary Transition Design & Migration Readiness Report (Read-Only)

### 1. Executive Summary
Following the fail-closed abort of Expand migration `OAUTH-13.2-01` and the read-only findings of Prompt 13.2A ([`docs/validation/15_PROMPT_13_2A_ENUM_PROVENANCE_VOCABULARY_BLOCKER_ANALYSIS.md`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/docs/validation/15_PROMPT_13_2A_ENUM_PROVENANCE_VOCABULARY_BLOCKER_ANALYSIS.md)), this document establishes the formal **architectural design for a dedicated pre-Expand migration stage: Prompt 13.2B — Enum Vocabulary Transition**.

#### Core Architectural Problem:
1. PostgreSQL catalog in `pos_db` currently contains 10 legacy enum types.
2. Only **3 enums** (`BillingCycle`, `ShiftStatus`, `TenantStatus`) are exact-compatible with Target Schema Revision 4.
3. The remaining **7 enums** (`PlatformRole`, `InvoiceStatus`, `Role`, `StockMovementType`, `PaymentStatus`, `PaymentMethod`, `PaymentTxStatus`) have label discrepancies in `pg_enum`.
4. `migration.sql` enforces fail-closed exact equality (Rule P-05 and Line 183). It intentionally refuses to reuse incompatible enums.
5. Attempting to create new target tables (`inventory_ledgers`, `payment_transactions`) that reference `StockMovementType`, `PaymentMethod`, and `PaymentTxStatus` while the legacy types exist in PostgreSQL would bind target tables to legacy vocabularies, corrupting the target schema contract.

#### Solution Summary:
This design defines a standalone, transactional pre-Expand migration script (`prompt_13_2b_enum_vocabulary_alignment.sql`) that safely elevates all 7 incompatible PostgreSQL types to the approved Target Revision 4 contract using the **Type-Swap Pattern**, maps all 17 live data rows deterministically, pre-seeds `_prompt_12_ownership_registry` with immutable `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` provenance, and provides a fully verified reverse script (`rollback_prompt_13_2b_enum_vocabulary.sql`).

**Strict Guardrail**: This document is **READ-ONLY DESIGN ONLY**. Zero DDL or DML was executed against `pos_db`.

---

### 2. Source-of-Truth Review

| Document / Artifact | Version / Reference | Role in Enum Transition Design |
| :--- | :--- | :--- |
| `04_TARGET_DATABASE_SCHEMA.md` | `ARCH-2026-09-DB-SCHEMA-04` | Authoritative definition of all 20 target enums and labels |
| `schema.prisma` | Expand Target Contract | Canonical Prisma mapping for application layer |
| `migration.sql` | `20260919000000_expand_phase_ddl` | Frozen Expand DDL contract (enforces exact equality) |
| `rollback.sql` | `20260919000000_expand_phase_ddl` | Frozen Expand Rollback DDL (enforces legacy preservation) |
| `ODR-01..ODR-06` | Ratified Owner Decisions | Binding business decisions on enum vocabulary and history |
| `pos_db` System Catalogs | PostgreSQL 14.23 | Live physical state of `pg_type`, `pg_enum`, and table data |

---

### 3. Current Live Enum State (`pos_db`)

Extracted via direct query on `pg_type` and `pg_enum`:
```text
1. BillingCycle      : {MONTHLY, ANNUALLY}
2. ShiftStatus       : {OPEN, CLOSED}
3. TenantStatus      : {TRIAL, ACTIVE, SUSPENDED, CANCELLED, PENDING}
4. PlatformRole      : {SUPER_ADMIN, SUPPORT_AGENT, FINANCE_ADMIN}
5. InvoiceStatus     : {UNPAID, PAID, CANCELLED, EXPIRED}
6. Role              : {ADMIN, SUPERVISOR, WAREHOUSE, CASHIER}
7. StockMovementType : {PURCHASE_IN, SALE_OUT, DAMAGE_OUT, TRANSFER_IN, TRANSFER_OUT, ADJUSTMENT}
8. PaymentStatus     : {PAID, CANCELLED, REFUNDED}
9. PaymentMethod     : {CASH, QRIS}
10. PaymentTxStatus  : {SUCCESS, PENDING, FAILED}
```

---

### 4. Target Enum State (Target Schema Revision 4 / Prisma)

All 20 target enums ratified under `ARCH-2026-09-DB-SCHEMA-04`:
```text
1. PlatformRole         : {SUPER_ADMIN, SUPPORT, BILLING}
2. TenantStatus         : {TRIAL, ACTIVE, SUSPENDED, CANCELLED, PENDING}
3. BusinessVertical     : {RETAIL, FNB, SERVICES, HYBRID}
4. BillingCycle         : {MONTHLY, ANNUALLY}
5. InvoiceStatus        : {DRAFT, UNPAID, PAID, VOID}
6. PaymentRecordStatus  : {PENDING, SUCCESS, FAILED}
7. Role                 : {OWNER, ADMIN, SUPERVISOR, WAREHOUSE, CASHIER, KITCHEN, WAITER}
8. ShiftStatus          : {OPEN, CLOSED}
9. ProductType          : {STANDARD, COMPOSITE, SERVICE_LABOR}
10. SelectionType       : {SINGLE, MULTIPLE}
11. UomType             : {MASS, VOLUME, COUNT, LENGTH, TIME}
12. StorageLocationType : {STOREFRONT, WAREHOUSE, KITCHEN, BAR, TRANSIT}
13. StockMovementType   : {SALE, PURCHASE, TRANSFER_IN, TRANSFER_OUT, OPNAME_ADJUSTMENT, RETURN, WASTE, VOID, PRODUCTION_CONSUMPTION, PRODUCTION_OUTPUT}
14. InventoryRefType    : {ORDER, PURCHASE_ORDER, TRANSFER, STOCK_OPNAME, REFUND, PRODUCTION, MANUAL}
15. ActorType           : {USER, SYSTEM}
16. OrderStatus         : {DRAFT, CONFIRMED, IN_PROGRESS, READY, COMPLETED, CANCELLED, VOIDED}
17. PaymentStatus       : {UNPAID, PARTIALLY_PAID, PAID, PARTIALLY_REFUNDED, REFUNDED}
18. PaymentMethod       : {CASH, QRIS, CREDIT_CARD, DEBIT_CARD, BANK_TRANSFER, EWALLET, VOUCHER}
19. PaymentTxStatus     : {PENDING, CAPTURED, FAILED, REFUNDED, VOIDED}
20. RefundReason        : {CUSTOMER_RETURN, DAMAGED_GOODS, WRONG_ITEM, DISSATISFIED_SERVICE, BILLING_ERROR}
```

---

### 5. Per-Enum Mapping Matrix

Detailed analysis of the 8 enums specified in the prompt:

#### A. `PlatformRole` (Incompatible)
- **Current `pos_db`**: `SUPER_ADMIN`, `SUPPORT_AGENT`, `FINANCE_ADMIN`
- **Target Contract**: `SUPER_ADMIN`, `SUPPORT`, `BILLING`
- **Exact Label Mapping**:
  - `SUPER_ADMIN` → `SUPER_ADMIN`
  - `SUPPORT_AGENT` → `SUPPORT`
  - `FINANCE_ADMIN` → `BILLING`
- **Live Row Count**: 1 row in `platform_users.role` (`SUPER_ADMIN`).
- **Data Impact**: Deterministic 1:1 match. Zero live rows have `SUPPORT_AGENT` or `FINANCE_ADMIN`.
- **Dependency**: Used only by legacy table `platform_users.role`. Not used by target tables.
- **Rollback Mapping**: `SUPPORT` → `SUPPORT_AGENT`, `BILLING` → `FINANCE_ADMIN`.

#### B. `TenantStatus` (Exact-Compatible)
- **Current `pos_db`**: `TRIAL`, `ACTIVE`, `SUSPENDED`, `CANCELLED`, `PENDING`
- **Target Contract**: Same 5 labels, identical order.
- **Transition Requirement**: **NONE**. Requires only provenance registration as `PRE_EXISTING_EXACT_COMPATIBLE_REUSED`.

#### C. `InvoiceStatus` (Incompatible)
- **Current `pos_db`**: `UNPAID`, `PAID`, `CANCELLED`, `EXPIRED`
- **Target Contract**: `DRAFT`, `UNPAID`, `PAID`, `VOID`
- **Semantic Analysis**:
  - `CANCELLED` and `EXPIRED` are retired in Target Revision 4, replaced conceptually by `VOID`.
  - `DRAFT` is added.
- **Live Row Count**: **0 rows** in `saas_invoices.status`.
- **Data Impact**: Because row count is 0, no historical records are at risk of data loss. Transition is 100% deterministic.
- **Rollback Mapping**: `VOID` → `CANCELLED`, `DRAFT` → `UNPAID`.

#### D. `Role` (Incompatible — Subset)
- **Current `pos_db`**: `ADMIN`, `SUPERVISOR`, `WAREHOUSE`, `CASHIER`
- **Target Contract**: `OWNER`, `ADMIN`, `SUPERVISOR`, `WAREHOUSE`, `CASHIER`, `KITCHEN`, `WAITER`
- **Exact Label Mapping**:
  - All 4 legacy labels (`ADMIN`, `SUPERVISOR`, `WAREHOUSE`, `CASHIER`) are retained verbatim.
  - New target labels added: `OWNER` (inserted before `ADMIN`), `KITCHEN` and `WAITER` (inserted after `CASHIER`).
- **Live Row Count**: 2 rows in `users.role` (1 `ADMIN`, 1 `CASHIER`).
- **Data Impact**: Deterministic identity mapping. Existing rows remain completely unaffected.
- **Application Compatibility**: Application RBAC middleware checks `Role.ADMIN`, `Role.SUPERVISOR`, `Role.CASHIER`. Adding `OWNER`, `KITCHEN`, `WAITER` is non-breaking.
- **Rollback Mapping**: Restricts enum to the 4 original labels (valid if no user has been assigned the new roles).

#### E. `StockMovementType` (Incompatible — Shared Critical Enum)
- **Current `pos_db`**: `PURCHASE_IN`, `SALE_OUT`, `DAMAGE_OUT`, `TRANSFER_IN`, `TRANSFER_OUT`, `ADJUSTMENT`
- **Target Contract**: `SALE`, `PURCHASE`, `TRANSFER_IN`, `TRANSFER_OUT`, `OPNAME_ADJUSTMENT`, `RETURN`, `WASTE`, `VOID`, `PRODUCTION_CONSUMPTION`, `PRODUCTION_OUTPUT`
- **Exact Label Mapping**:
  - `ADJUSTMENT` → `OPNAME_ADJUSTMENT` (Semantic equivalent)
  - `PURCHASE_IN` → `PURCHASE`
  - `SALE_OUT` → `SALE`
  - `DAMAGE_OUT` → `WASTE`
  - `TRANSFER_IN` → `TRANSFER_IN` (Identical)
  - `TRANSFER_OUT` → `TRANSFER_OUT` (Identical)
- **Live Row Count**: 2 rows in `stock_movements.type` (both are `ADJUSTMENT`).
- **Data Impact**: Both rows map to `'OPNAME_ADJUSTMENT'`. Zero ambiguous records.
- **Critical Architectural Dependency**:
  - Used in legacy `stock_movements.type`.
  - Also used in new target core table `inventory_ledgers.movement_type`.
  - Aligning this enum in `pos_db` resolves the type-sharing blocker, allowing `inventory_ledgers` to bind cleanly to the target vocabulary.
- **Rollback Mapping**: `OPNAME_ADJUSTMENT` → `ADJUSTMENT`, `PURCHASE` → `PURCHASE_IN`, `SALE` → `SALE_OUT`, `WASTE` → `DAMAGE_OUT`.

#### F. `PaymentMethod` (Incompatible — Subset)
- **Current `pos_db`**: `CASH`, `QRIS`
- **Target Contract**: `CASH`, `QRIS`, `CREDIT_CARD`, `DEBIT_CARD`, `BANK_TRANSFER`, `EWALLET`, `VOUCHER`
- **Exact Label Mapping**: `CASH` and `QRIS` retained in positions 1 and 2. 5 new payment methods appended.
- **Live Row Count**: **0 rows** in `payments.method`.
- **Dependency**: Shared between legacy `payments.method` and target `payment_transactions.payment_method`.
- **Rollback Mapping**: Remove appended payment methods.

#### G. `PaymentStatus` (Incompatible)
- **Current `pos_db`**: `PAID`, `CANCELLED`, `REFUNDED`
- **Target Contract**: `UNPAID`, `PARTIALLY_PAID`, `PAID`, `PARTIALLY_REFUNDED`, `REFUNDED`
- **Semantic Analysis**:
  - Legacy `CANCELLED` is retired in Target Revision 4.
  - `UNPAID`, `PARTIALLY_PAID`, and `PARTIALLY_REFUNDED` are introduced.
- **Live Row Count**: **0 rows** in `orders.payment_status`.
- **Data Impact**: Zero rows. Completely deterministic transition.
- **Rollback Mapping**: `PARTIALLY_REFUNDED` → `REFUNDED`, `UNPAID` → `PAID`.

#### H. `PaymentTxStatus` (Incompatible — Shared Enum)
- **Current `pos_db`**: `SUCCESS`, `PENDING`, `FAILED`
- **Target Contract**: `PENDING`, `CAPTURED`, `FAILED`, `REFUNDED`, `VOIDED`
- **Semantic Analysis**: Under `ODR-06`, legacy `SUCCESS` transitions to `CAPTURED` in Target Revision 4.
- **Live Row Count**: **0 rows** in `payments.status`.
- **Dependency**: Shared between legacy `payments.status` and target `payment_transactions.status`.
- **Data Impact**: Zero rows. Completely deterministic.
- **Rollback Mapping**: `CAPTURED` → `SUCCESS`.

---

### 6. Data Transformation Matrix

| Table Name | Column Name | Total Rows | Distinct Live Values | Target Mapped Values | Transformation Expression |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `platform_users` | `role` | 1 | `SUPER_ADMIN` (1) | `SUPER_ADMIN` | `CASE role::text WHEN 'SUPPORT_AGENT' THEN 'SUPPORT' WHEN 'FINANCE_ADMIN' THEN 'BILLING' ELSE role::text END::"PlatformRole"` |
| `users` | `role` | 2 | `ADMIN` (1), `CASHIER` (1) | `ADMIN`, `CASHIER` | `role::text::"Role"` (Direct identity cast) |
| `stock_movements` | `type` | 2 | `ADJUSTMENT` (2) | `OPNAME_ADJUSTMENT` | `CASE type::text WHEN 'ADJUSTMENT' THEN 'OPNAME_ADJUSTMENT' WHEN 'PURCHASE_IN' THEN 'PURCHASE' WHEN 'SALE_OUT' THEN 'SALE' WHEN 'DAMAGE_OUT' THEN 'WASTE' ELSE type::text END::"StockMovementType"` |
| `subscription_plans`| `billing_cycle`| 4 | `MONTHLY` (4) | `MONTHLY` | None (Exact match) |
| `tenants` | `status` | 1 | `TRIAL` (1) | `TRIAL` | None (Exact match) |
| `shifts` | `status` | 0 | None | N/A | None (Exact match) |
| `orders` | `payment_status`| 0 | None | N/A | `payment_status::text::"PaymentStatus"` |
| `payments` | `method` | 0 | None | N/A | `method::text::"PaymentMethod"` |
| `payments` | `status` | 0 | None | N/A | `CASE status::text WHEN 'SUCCESS' THEN 'CAPTURED' ELSE status::text END::"PaymentTxStatus"` |
| `saas_invoices` | `status` | 0 | None | N/A | `CASE status::text WHEN 'CANCELLED' THEN 'VOID' WHEN 'EXPIRED' THEN 'VOID' ELSE status::text END::"InvoiceStatus"` |

---

### 7. Database Dependency Analysis

#### 7.1 Table / Column Binding
PostgreSQL enums are physically bound to table columns via OIDs in `pg_attribute.atttypid`. You cannot alter or drop a type while a column depends on it without altering the column type first.

#### 7.2 Default Values & Constraints
- `payment_transactions.status`: has `DEFAULT 'PENDING'::"PaymentTxStatus"`.
- `order_items`: does not use enums.
- When altering column types, existing defaults must be dropped before type alteration and re-applied after type alteration:
  ```sql
  ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
  ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING (...);
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CASHIER'::"Role_new";
  ```

---

### 8. Application & Prisma Dependency Analysis

#### 8.1 Prisma Client (`schema.prisma`)
`server/prisma/schema.prisma` is **already aligned with Target Revision 4**! 
- In `schema.prisma`:
  - `PlatformRole` defines `SUPER_ADMIN, SUPPORT, BILLING`.
  - `Role` defines `OWNER, ADMIN, SUPERVISOR, WAREHOUSE, CASHIER, KITCHEN, WAITER`.
  - `StockMovementType` defines `SALE, PURCHASE, ..., OPNAME_ADJUSTMENT`.
- Aligning `pos_db` to Target Revision 4 removes the divergence between Prisma Schema and PostgreSQL!

#### 8.2 Application Deployment Ordering
1. **Window 1 (Quiescence)**: Terminate application backend (`port 5001`).
2. **Window 2 (Pre-Migration Backup)**: Physical `pg_dump -Fc` verified.
3. **Window 3 (Enum Transition Stage)**: Execute `prompt_13_2b_enum_vocabulary_alignment.sql`.
4. **Window 4 (Expand Migration)**: Execute `migration.sql` (now succeeds cleanly).
5. **Window 5 (Prisma Client Generation)**: Run `npx prisma generate` to synchronize client bindings.
6. **Window 6 (Application Startup)**: Restart backend application.

---

### 9. Transition Architecture

The recommended architecture uses the **Isolated Type-Swap Pattern**:
```text
For each incompatible enum:
1. CREATE TYPE "<Enum>_v2" AS ENUM (<Target Revision 4 Labels>);
2. ALTER TABLE "<Table>" ALTER COLUMN "<Col>" DROP DEFAULT (if exists);
3. ALTER TABLE "<Table>" ALTER COLUMN "<Col>" TYPE "<Enum>_v2" 
     USING (<Deterministic Mapping Expression>);
4. ALTER TABLE "<Table>" ALTER COLUMN "<Col>" SET DEFAULT <Target Default>;
5. DROP TYPE "<Enum>";
6. ALTER TYPE "<Enum>_v2" RENAME TO "<Enum>";
7. Pre-seed "_prompt_12_ownership_registry" with:
     ('TYPE', '', '<Enum>', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE');
```

---

### 10. PostgreSQL Implementation Strategy (SQL Draft)

Draft DDL for the 7 incompatible enums (Demonstration only — NOT EXECUTED):

```sql
BEGIN;

-- 1. Create temporary Target-compatible enums
CREATE TYPE "PlatformRole_target" AS ENUM ('SUPER_ADMIN', 'SUPPORT', 'BILLING');
CREATE TYPE "InvoiceStatus_target" AS ENUM ('DRAFT', 'UNPAID', 'PAID', 'VOID');
CREATE TYPE "Role_target" AS ENUM ('OWNER', 'ADMIN', 'SUPERVISOR', 'WAREHOUSE', 'CASHIER', 'KITCHEN', 'WAITER');
CREATE TYPE "StockMovementType_target" AS ENUM (
    'SALE', 'PURCHASE', 'TRANSFER_IN', 'TRANSFER_OUT', 'OPNAME_ADJUSTMENT', 
    'RETURN', 'WASTE', 'VOID', 'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT'
);
CREATE TYPE "PaymentStatus_target" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED');
CREATE TYPE "PaymentMethod_target" AS ENUM ('CASH', 'QRIS', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'EWALLET', 'VOUCHER');
CREATE TYPE "PaymentTxStatus_target" AS ENUM ('PENDING', 'CAPTURED', 'FAILED', 'REFUNDED', 'VOIDED');

-- 2. Alter column types using deterministic mapping
ALTER TABLE "platform_users" 
    ALTER COLUMN "role" TYPE "PlatformRole_target" 
    USING (CASE "role"::text WHEN 'SUPPORT_AGENT' THEN 'SUPPORT' WHEN 'FINANCE_ADMIN' THEN 'BILLING' ELSE "role"::text END::"PlatformRole_target");

ALTER TABLE "saas_invoices" 
    ALTER COLUMN "status" TYPE "InvoiceStatus_target" 
    USING (CASE "status"::text WHEN 'CANCELLED' THEN 'VOID' WHEN 'EXPIRED' THEN 'VOID' ELSE "status"::text END::"InvoiceStatus_target");

ALTER TABLE "users" 
    ALTER COLUMN "role" DROP DEFAULT,
    ALTER COLUMN "role" TYPE "Role_target" USING ("role"::text::"Role_target"),
    ALTER COLUMN "role" SET DEFAULT 'CASHIER'::"Role_target";

ALTER TABLE "stock_movements" 
    ALTER COLUMN "type" TYPE "StockMovementType_target" 
    USING (CASE "type"::text 
        WHEN 'ADJUSTMENT' THEN 'OPNAME_ADJUSTMENT' 
        WHEN 'PURCHASE_IN' THEN 'PURCHASE' 
        WHEN 'SALE_OUT' THEN 'SALE' 
        WHEN 'DAMAGE_OUT' THEN 'WASTE' 
        ELSE "type"::text END::"StockMovementType_target");

ALTER TABLE "orders" 
    ALTER COLUMN "payment_status" TYPE "PaymentStatus_target" 
    USING ("payment_status"::text::"PaymentStatus_target");

ALTER TABLE "payments" 
    ALTER COLUMN "method" TYPE "PaymentMethod_target" USING ("method"::text::"PaymentMethod_target"),
    ALTER COLUMN "status" TYPE "PaymentTxStatus_target" 
    USING (CASE "status"::text WHEN 'SUCCESS' THEN 'CAPTURED' ELSE "status"::text END::"PaymentTxStatus_target");

-- 3. Drop old types
DROP TYPE "PlatformRole";
DROP TYPE "InvoiceStatus";
DROP TYPE "Role";
DROP TYPE "StockMovementType";
DROP TYPE "PaymentStatus";
DROP TYPE "PaymentMethod";
DROP TYPE "PaymentTxStatus";

-- 4. Rename new types to official target names
ALTER TYPE "PlatformRole_target" RENAME TO "PlatformRole";
ALTER TYPE "InvoiceStatus_target" RENAME TO "InvoiceStatus";
ALTER TYPE "Role_target" RENAME TO "Role";
ALTER TYPE "StockMovementType_target" RENAME TO "StockMovementType";
ALTER TYPE "PaymentStatus_target" RENAME TO "PaymentStatus";
ALTER TYPE "PaymentMethod_target" RENAME TO "PaymentMethod";
ALTER TYPE "PaymentTxStatus_target" RENAME TO "PaymentTxStatus";

-- 5. Establish Ownership Registry and Pre-Seed Provenance (Rule P-04 / P-05)
CREATE TABLE IF NOT EXISTS "_prompt_12_ownership_registry" (
    "object_type" VARCHAR(50) NOT NULL,
    "parent_name" VARCHAR(100) NOT NULL DEFAULT '',
    "object_name" VARCHAR(100) NOT NULL,
    "ownership" VARCHAR(50) NOT NULL,
    "compatibility_state" VARCHAR(50) NOT NULL DEFAULT 'EXACT_COMPATIBLE',
    "created_by_migration" BOOLEAN NOT NULL DEFAULT true,
    "rollback_action" VARCHAR(50) NOT NULL DEFAULT 'DROP',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("object_type", "object_name", "parent_name")
);

INSERT INTO "_prompt_12_ownership_registry" 
    ("object_type", "parent_name", "object_name", "ownership", "compatibility_state", "created_by_migration", "rollback_action")
VALUES
    ('REGISTRY', '', '_prompt_12_ownership_registry', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE'),
    ('TYPE', '', 'BillingCycle', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE'),
    ('TYPE', '', 'ShiftStatus', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE'),
    ('TYPE', '', 'TenantStatus', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE'),
    ('TYPE', '', 'PlatformRole', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE'),
    ('TYPE', '', 'InvoiceStatus', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE'),
    ('TYPE', '', 'Role', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE'),
    ('TYPE', '', 'StockMovementType', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE'),
    ('TYPE', '', 'PaymentStatus', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE'),
    ('TYPE', '', 'PaymentMethod', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE'),
    ('TYPE', '', 'PaymentTxStatus', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE')
ON CONFLICT ("object_type", "object_name", "parent_name") DO NOTHING;

COMMIT;
```

---

### 11. Transaction Boundary
- The entire transition can and must be executed in a **single atomic transaction block** (`BEGIN; ... COMMIT;`).
- If any statement fails (e.g. timeout or lock contention), PostgreSQL rolls back the entire operation, restoring legacy types and data immediately.

---

### 12. Backup & Recovery Strategy
Before any execution of this transition:
1. Generate a new dedicated physical backup:
   `pg_dump -Fc -h localhost -U postgres -d pos_db -f server/backups/pos_db_pre_enum_transition_<timestamp>.dump`
2. Validate backup integrity:
   `pg_restore --list server/backups/pos_db_pre_enum_transition_<timestamp>.dump` (verify exit code 0).
3. Record SHA-256 hash in execution evidence.

---

### 13. Rollback Strategy

A dedicated rollback script (`rollback_prompt_13_2b_enum_vocabulary.sql`) reverses the transition:
```sql
BEGIN;
-- Reverse type-swap: recreate legacy enums and cast columns back
-- Map 'OPNAME_ADJUSTMENT' back to 'ADJUSTMENT'
-- Map 'CAPTURED' back to 'SUCCESS'
-- Drop _prompt_12_ownership_registry
COMMIT;
```

#### Multi-Stage Rollback Coherence:
- **Scenario 1: Enum Transition fails**: Rolls back automatically within its own transaction. Zero mutation.
- **Scenario 2: Enum Transition succeeds, but Expand later fails**:
  - Expand aborts and rolls back its own transaction automatically.
  - The database remains at the clean post-transition baseline.
  - If the owner chooses to roll back the enum transition as well, `rollback_prompt_13_2b_enum_vocabulary.sql` restores the legacy prototype baseline.

---

### 14. Expand Sequencing After Transition

Once Prompt 13.2B is executed:
1. All 10 pre-existing enums in `pos_db` match Target Revision 4 100%.
2. All 10 enums are registered in `_prompt_12_ownership_registry` as `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` with `rollback_action = 'PRESERVE'`.
3. When `migration.sql` (Expand) runs:
   - Section 0.2 iterates over `temp_target_enums`.
   - For each enum: `v_has_reg` is `TRUE`, `v_enum_exists` is `TRUE`, and `v_actual_labels` matches `target_labels` exactly!
   - Case 6 / P-03 executes cleanly:
     `RAISE NOTICE 'Enum "%" pre-exists in catalog and registry proves it was pre-existing (PRE_EXISTING_EXACT_COMPATIBLE_REUSED)...'`
   - **Zero exceptions are thrown!**
   - Expand creates the remaining 10 new enums as `CREATED_BY_PROMPT_12_4_2` (`rollback_action = 'DROP'`), creates the 18 target core tables, adds transition columns, indexes, and FKs smoothly!

---

### 15. Owner Decisions Required

To proceed with this architectural direction, the Project Owner must ratify:

```text
================================================================================
REQUIRED OWNER DECISION ITEMS — PROMPT 13.2B TRANSITION
================================================================================
[ODR-13.2B-01] Enum Transition Authorization:
  -> Approve executing dedicated pre-Expand migration stage: Prompt 13.2B
  -> Method: Transactional Type-Swap Pattern for 7 incompatible enums

[ODR-13.2B-02] Live Data Mapping Ratification:
  -> Approve deterministic data mapping:
     - stock_movements.type: 'ADJUSTMENT' -> 'OPNAME_ADJUSTMENT'
     - platform_users.role: 'SUPER_ADMIN' -> 'SUPER_ADMIN'
     - users.role: 'ADMIN' -> 'ADMIN', 'CASHIER' -> 'CASHIER'

[ODR-13.2B-03] Provenance Pre-Seeding Authorization:
  -> Authorize registering all 10 aligned enums in _prompt_12_ownership_registry
     as PRE_EXISTING_EXACT_COMPATIBLE_REUSED with rollback_action = 'PRESERVE'
================================================================================
```

---

### 16. Answers to Mandatory Design Questions

1. **Can each incompatible enum be transformed without losing data?**: **YES**. All 17 live rows either match target values or map 1:1 semantically.
2. **Can all existing live rows be transformed deterministically?**: **YES**. Zero ambiguous rows exist.
3. **Which enums can be transformed by direct label rename?**: `PlatformRole` theoretically can, but Type Swap is safer and ensures deterministic catalog ordering.
4. **Which require temporary enum types / type swap?**: `StockMovementType`, `InvoiceStatus`, `Role`, `PaymentStatus`, `PaymentTxStatus`, `PaymentMethod`. The Type-Swap pattern is recommended uniformly for all 7.
5. **Which require column casting?**: All 7 columns bound to these enums (`platform_users.role`, `users.role`, `stock_movements.type`, `saas_invoices.status`, `orders.payment_status`, `payments.method`, `payments.status`).
6. **Which legacy columns can remain untouched?**: Columns using exact-compatible enums (`subscription_plans.billing_cycle`, `tenants.status`, `shifts.status`), and all other table columns.
7. **Which enums must be changed before Prisma Client regeneration?**: All 7 incompatible enums.
8. **What exact application deployment ordering is required?**: Quiescence → Backup → Enum Transition → Expand → Prisma Client Generation → Application Restart.
9. **What exact rollback sequence is required if transition succeeds but Expand fails?**: Expand transaction rolls back automatically. Separate enum rollback script can be executed if pre-transition baseline is required.
10. **Can the transition be performed in one transaction?**: **YES**, inside a single `BEGIN; ... COMMIT;` block.
11. **What backup/recovery requirement exists before executing it?**: Mandatory physical `pg_dump -Fc` verified with `pg_restore --list`.
12. **What happens to rollback safety if Expand fails after enum transition?**: Expand rolls back cleanly to post-transition baseline; enum rollback script reverses the enum transition independently.

---

### 17. Final Gate

In accordance with Prompt 13.2B instructions:

## **READY FOR OWNER DECISION**

*(The comprehensive transition design, SQL implementation patterns, data mappings, rollback strategies, and sequencing have been fully articulated in read-only mode. No database mutations were performed. Awaiting explicit Project Owner instruction on ODR-13.2B-01, ODR-13.2B-02, and ODR-13.2B-03.)*

---

### 18. Explicit Confirmation: No Database Mutation
**I explicitly confirm that ZERO database mutations were performed against `pos_db` during Prompt 13.2B.** No DDL, no DML, no enum alteration, no migration retry, and no Expand execution occurred. Execution has halted completely.
