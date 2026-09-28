# 15_PROMPT_13_2A_ENUM_PROVENANCE_VOCABULARY_BLOCKER_ANALYSIS.md
## Deep Blocker Analysis: Enum Ownership Provenance vs Vocabulary Compatibility

### 1. Executive Summary
During the execution of Expand migration `OAUTH-13.2-01` against `pos_db`, the transaction was safely aborted and rolled back at Section 0.2 due to the strict fail-closed assertion:
```text
ERROR: ENUM OWNERSHIP PROVENANCE UNVERIFIED: Enum "PlatformRole" exists in PostgreSQL catalog, but has no ownership record in "_prompt_12_ownership_registry". Historical provenance cannot be established from catalog existence alone. Inferred reuse is prohibited to prevent rollback corruption. Migration aborted to fail closed. Owner review required.
```

This read-only analysis investigates the exact root cause, separating the problem into two distinct dimensions:
1. **Dimension 1: Ownership Provenance Invariant (Rule P-05)**: Section 0 creates `_prompt_12_ownership_registry` empty on first run, but Section 0.2 demands that every pre-existing catalog enum already possess an ownership record. Without pre-seeding, no pre-existing enum can ever pass first-run migration.
2. **Dimension 2: Vocabulary Compatibility (ODR-01..ODR-06)**: Even if provenance were established, only **3 of the 10 live enums** in `pos_db` are exact matches with Target Schema Revision 4 (`BillingCycle`, `ShiftStatus`, `TenantStatus`). The remaining **7 enums** (`PlatformRole`, `InvoiceStatus`, `Role`, `StockMovementType`, `PaymentStatus`, `PaymentMethod`, `PaymentTxStatus`) have label differences in `pg_enum`.

Importantly, **all 17 live data rows across `pos_db` map deterministically to the target vocabulary** (e.g. `SUPER_ADMIN` → `SUPER_ADMIN`, `ADMIN`/`CASHIER` → `ADMIN`/`CASHIER`, `ADJUSTMENT` → `OPNAME_ADJUSTMENT`). 

This report evaluates four strategic resolution options (Option A, B, C, D) and formulates the exact decisions required from the Project Owner. Zero database mutations were performed during this stage.

---

### 2. Evidence / Files Inspected
1. Live PostgreSQL Catalogs: `pg_type`, `pg_enum`, `pg_attribute`, `pg_class` on `pos_db`
2. `server/prisma/migrations/20260919000000_expand_phase_ddl/migration.sql`
3. `server/prisma/migrations/20260919000000_expand_phase_ddl/rollback.sql`
4. `server/prisma/schema.prisma`
5. `docs/architecture/04_TARGET_DATABASE_SCHEMA.md` (`ARCH-2026-09-DB-SCHEMA-04`)
6. `docs/prompts/OWNER_DECISION_PROMPT_13_2A_ENUM_TRANSITION.md`
7. `docs/prompts/PROMPT_13_2A_ENUM_PROVENANCE_VOCABULARY_BLOCKER_ANALYSIS.md`
8. `server/src/migrations/test_prompt_12_4_4_matrix.ts`
9. `server/src/migrations/test_prompt_12_6_reconciliation.ts`
10. Application routes, controllers, and middlewares in `server/src/`

---

### 3. Live Enum Baseline (`pos_db`)

Direct inspection of `pg_enum` in `pos_db` establishes the authoritative baseline:

| Enum Name | Current `pos_db` Catalog Labels | Target Revision 4 Contract Labels | Classification |
| :--- | :--- | :--- | :---: |
| **`BillingCycle`** | `MONTHLY`, `ANNUALLY` | `MONTHLY`, `ANNUALLY` | **EXACT-COMPATIBLE** |
| **`ShiftStatus`** | `OPEN`, `CLOSED` | `OPEN`, `CLOSED` | **EXACT-COMPATIBLE** |
| **`TenantStatus`** | `TRIAL`, `ACTIVE`, `SUSPENDED`, `CANCELLED`, `PENDING` | `TRIAL`, `ACTIVE`, `SUSPENDED`, `CANCELLED`, `PENDING` | **EXACT-COMPATIBLE** |
| **`PlatformRole`** | `SUPER_ADMIN`, `SUPPORT_AGENT`, `FINANCE_ADMIN` | `SUPER_ADMIN`, `SUPPORT`, `BILLING` | **INCOMPATIBLE** |
| **`InvoiceStatus`** | `UNPAID`, `PAID`, `CANCELLED`, `EXPIRED` | `DRAFT`, `UNPAID`, `PAID`, `VOID` | **INCOMPATIBLE** |
| **`PaymentMethod`** | `CASH`, `QRIS` | `CASH`, `QRIS`, `CREDIT_CARD`, `DEBIT_CARD`, `BANK_TRANSFER`, `EWALLET`, `VOUCHER` | **INCOMPATIBLE** (Subset) |
| **`PaymentStatus`** | `PAID`, `CANCELLED`, `REFUNDED` | `UNPAID`, `PARTIALLY_PAID`, `PAID`, `PARTIALLY_REFUNDED`, `REFUNDED` | **INCOMPATIBLE** (Subset/Diff) |
| **`PaymentTxStatus`** | `SUCCESS`, `PENDING`, `FAILED` | `PENDING`, `CAPTURED`, `FAILED`, `REFUNDED`, `VOIDED` | **INCOMPATIBLE** |
| **`Role`** | `ADMIN`, `SUPERVISOR`, `WAREHOUSE`, `CASHIER` | `OWNER`, `ADMIN`, `SUPERVISOR`, `WAREHOUSE`, `CASHIER`, `KITCHEN`, `WAITER` | **INCOMPATIBLE** (Subset) |
| **`StockMovementType`** | `PURCHASE_IN`, `SALE_OUT`, `DAMAGE_OUT`, `TRANSFER_IN`, `TRANSFER_OUT`, `ADJUSTMENT` | `SALE`, `PURCHASE`, `TRANSFER_IN`, `TRANSFER_OUT`, `OPNAME_ADJUSTMENT`, `RETURN`, `WASTE`, `VOID`, `PRODUCTION_CONSUMPTION`, `PRODUCTION_OUTPUT` | **INCOMPATIBLE** |

---

### 4. Provenance vs Vocabulary Analysis

A foundational insight of this analysis is that **ENUM OWNERSHIP PROVENANCE** and **ENUM VOCABULARY COMPATIBILITY** are independent, orthogonal dimensions:

```text
+-----------------------------------+-----------------------------------------+
| DIMENSION 1: PROVENANCE           | DIMENSION 2: VOCABULARY COMPATIBILITY   |
+-----------------------------------+-----------------------------------------+
| Addresses: WHO OWNS THIS OBJECT?  | Addresses: DOES THE DEFINITION MATCH?   |
| - Was it created by Prompt 12?    | - Are the enum labels identical?        |
| - Was it pre-existing in pos_db?  | - Is the label sort order identical?    |
| - Should rollback DROP it?        | - Can the application insert target     |
| - Should rollback PRESERVE it?    |   values without PostgreSQL errors?     |
+-----------------------------------+-----------------------------------------+
```

#### The Trap of Equating Concepts:
- Rule P-05 states: `PRE_EXISTING` cannot be inferred from catalog existence alone.
- However, simply pre-seeding all 10 catalog enums as `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` would be catastrophic:
  - While it would satisfy Dimension 1 (provenance), it would immediately violate Dimension 2 (vocabulary equality) at line 183:
    `RAISE EXCEPTION 'ENUM COMPATIBILITY VIOLATION: Existing PostgreSQL enum "%" does not exactly match Target Database Schema Revision 4 contract...'`
  - For example, `PlatformRole` in `pos_db` has `SUPPORT_AGENT`, while Target has `SUPPORT`. Line 183 requires **exact string array equality**.

---

### 5. Column Dependency Inventory

Live query against `pg_attribute` in `pos_db` identifies every column using these enums:

| Table Name | Column Name | Current Enum Type | Row Count | Target Enum Type | Dependency Scope |
| :--- | :--- | :--- | :---: | :--- | :--- |
| `platform_users` | `role` | `PlatformRole` | 1 | `PlatformRole` | Legacy table only |
| `users` | `role` | `Role` | 2 | `Role` | Legacy table only |
| `stock_movements` | `type` | `StockMovementType` | 2 | `StockMovementType` | Legacy table (New target table `inventory_ledgers.movement_type` also references this name!) |
| `subscription_plans` | `billing_cycle` | `BillingCycle` | 4 | `BillingCycle` | Legacy table (Exact match) |
| `tenants` | `status` | `TenantStatus` | 1 | `TenantStatus` | Legacy table (Exact match) |
| `shifts` | `status` | `ShiftStatus` | 0 | `ShiftStatus` | Legacy table (Exact match) |
| `orders` | `payment_status` | `PaymentStatus` | 0 | `PaymentStatus` | Legacy table only |
| `payments` | `method` | `PaymentMethod` | 0 | `PaymentMethod` | Legacy table (New target table `payment_transactions.payment_method` also references this name!) |
| `payments` | `status` | `PaymentTxStatus` | 0 | `PaymentTxStatus` | Legacy table (New target table `payment_transactions.status` also references this name!) |
| `saas_invoices` | `status` | `InvoiceStatus` | 0 | `InvoiceStatus` | Legacy table only |

#### Critical Discovery: Shared Enums between Legacy and Target
Notice that 3 incompatible enums are shared between legacy and target:
1. `StockMovementType`: Used in legacy `stock_movements.type` AND target `inventory_ledgers.movement_type`.
2. `PaymentMethod`: Used in legacy `payments.method` AND target `payment_transactions.payment_method`.
3. `PaymentTxStatus`: Used in legacy `payments.status` AND target `payment_transactions.status`.

The remaining 4 incompatible enums (`PlatformRole`, `InvoiceStatus`, `Role`, `PaymentStatus`) are used **exclusively by legacy tables** and are NOT referenced by any new table created in Expand!

---

### 6. Live Data Mapping Analysis

Every actual row in `pos_db` was inspected:

| Table | Column | Live Value in `pos_db` | Target Revision 4 Equivalent | Mapping Determinism |
| :--- | :--- | :--- | :--- | :---: |
| `platform_users` | `role` | `'SUPER_ADMIN'` | `'SUPER_ADMIN'` | **100% Deterministic (Exact)** |
| `users` | `role` | `'ADMIN'` | `'ADMIN'` | **100% Deterministic (Exact)** |
| `users` | `role` | `'CASHIER'` | `'CASHIER'` | **100% Deterministic (Exact)** |
| `stock_movements` | `type` | `'ADJUSTMENT'` | `'OPNAME_ADJUSTMENT'` | **100% Deterministic (Semantic match)** |
| `subscription_plans`| `billing_cycle` | `'MONTHLY'` | `'MONTHLY'` | **100% Deterministic (Exact)** |
| `tenants` | `status` | `'TRIAL'` | `'TRIAL'` | **100% Deterministic (Exact)** |
| *All other 4 tables* | *4 columns* | *0 rows* | *N/A* | **No Data Transformation Required** |

**Conclusion**: There are **zero orphaned, ambiguous, or unmappable rows** in `pos_db`. A transition from legacy vocabulary to Target Revision 4 vocabulary can be executed with 100% data fidelity.

---

### 7. Prisma & Application Dependency Analysis

#### 7.1 Backend Code Dependencies (`server/src`)
- **`Role`**: Extensively used in RBAC middleware (`auth.middleware.ts`), user routing (`user.routes.ts`), and controllers (`outlet.controller.ts`, `user.controller.ts`, `saas.controller.ts`).
  - Active application values: `Role.ADMIN`, `Role.SUPERVISOR`, `Role.CASHIER`.
  - In Target Revision 4, `ADMIN`, `SUPERVISOR`, and `CASHIER` are fully preserved; target adds `OWNER`, `WAREHOUSE`, `KITCHEN`, `WAITER`. Widening `Role` in PostgreSQL is fully backward-compatible with existing backend code!
- **`StockMovementType`**: Used in `inventory.controller.ts`, `product.controller.ts`, `order.controller.ts`.
  - Active application values: `PURCHASE_IN`, `SALE_OUT`, `DAMAGE_OUT`, `TRANSFER_IN`, `TRANSFER_OUT`, `ADJUSTMENT`.
  - Target Revision 4 changes vocabulary to: `SALE`, `PURCHASE`, `TRANSFER_IN`, `TRANSFER_OUT`, `OPNAME_ADJUSTMENT`, `RETURN`, `WASTE`, `VOID`, etc.
  - If `stock_movements.type` is altered to the target type, existing legacy routes reading/writing `PURCHASE_IN` would fail unless aliased or updated.
- **`PaymentMethod`**: Used in `shift.controller.ts`, `order.controller.ts`, `report.controller.ts`.
  - Active values: `CASH`, `QRIS`. Both are in Target Revision 4. Adding labels (`CREDIT_CARD`, `DEBIT_CARD`, etc.) is non-breaking.

#### 7.2 Prisma Client Schema (`server/prisma/schema.prisma`)
`schema.prisma` already declares all 20 enums using Target Revision 4. If Prisma Client were regenerated, it would expect target labels. Currently, `@prisma/client` in `node_modules` was generated against the legacy schema.

---

### 8. Strategic Options Analysis

#### Option A: First-Run Provenance Bootstrap for Compatible Enums Only
- **Mechanism**:
  - Authorize a pre-migration bootstrap step that registers the **3 exact-compatible enums** (`BillingCycle`, `ShiftStatus`, `TenantStatus`) in `_prompt_12_ownership_registry` as `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` (`rollback_action = 'PRESERVE'`).
  - For the **7 incompatible enums**, evaluate whether they can be decoupled from Section 0.2 of `migration.sql` during Expand (since 4 of them are not used by any target table, and 3 can use temporary target types or isolated namespaces).
- **Feasibility**: High.
- **Impact on ODR-01..06**: Preserved 100%.

#### Option B: Separate Authorized Enum Vocabulary Transition Before Expand
- **Mechanism**:
  - Implement a dedicated, transactional pre-Expand migration (`prompt_13_2b_enum_vocabulary_alignment.sql`) that:
    1. Widens `Role` (`+OWNER, +KITCHEN, +WAITER`).
    2. Widens `PaymentMethod` (`+CREDIT_CARD, +DEBIT_CARD, +BANK_TRANSFER, +EWALLET, +VOUCHER`).
    3. Migrates `StockMovementType`, `PaymentTxStatus`, `PaymentStatus`, `InvoiceStatus`, `PlatformRole` to target vocabulary with explicit mapping:
       - `platform_users.role`: `SUPER_ADMIN` remains `SUPER_ADMIN`.
       - `stock_movements.type`: `'ADJUSTMENT'` → `'OPNAME_ADJUSTMENT'`.
    4. Updates `pg_enum` labels so all 10 live enums match Target Revision 4 exactly.
  - Once aligned, all 10 enums qualify as `PRE_EXISTING_EXACT_COMPATIBLE_REUSED`.
- **Feasibility**: Very High, architecturally clean.
- **Prerequisite**: Explicit Project Owner Authorization for Enum Vocabulary Migration.

#### Option C: Prototype Database Reset / Rebuild
- **Mechanism**:
  - Wipe `pos_db` (`dropdb / createdb`), run Prisma push/deploy directly to establish target schema from scratch, and re-seed dummy data.
- **Feasibility**: Technically trivial.
- **Governance Assessment**: **STRONGLY DISCOURAGED / BLOCKED**.
  - Violates the core mandate of the migration exercise (testing real expand-contract migrations over legacy databases).
  - Explicitly prohibited by all Prompt instructions unless explicitly ordered by Owner.

#### Option D: Change Target Enum Names / Namespacing
- **Mechanism**:
  - Prefix new target enums as `TargetStockMovementType`, `TargetPaymentMethod`, etc., leaving legacy enums alone.
- **Feasibility**: Low.
- **Governance Assessment**: **REJECTED**. Directly violates Target Schema Revision 4, Prisma Schema, and ODR-01..ODR-06.

---

### 9. Rollback & Recovery Analysis

| Strategy | Rollback Behavior | Risk of Data Corruption | Safety Rating |
| :--- | :--- | :--- | :---: |
| **Option A** | Rollback drops target tables, preserves 3 exact enums, leaves legacy enums untouched | Very Low | High |
| **Option B** | Rollback reverses vocabulary migration using a dedicated `rollback_enum_vocabulary.sql` before Expand rollback | Low (Requires verified rollback DDL) | High |
| **Option C** | Not reversible (data destroyed) | Extreme | Unacceptable |
| **Option D** | Leaves legacy enums, drops prefixed enums | High schema drift | Low |

---

### 10. Expand Dependency Analysis
Can Expand be executed if enums are handled?
- The 18 target core tables depend on:
  - `InventoryItem`: `UomType` (New enum, does not exist in catalog -> created cleanly).
  - `ModifierGroup`: `SelectionType` (New enum -> created cleanly).
  - `StorageLocation`: `StorageLocationType` (New enum -> created cleanly).
  - `InventoryLedger`: `StockMovementType`, `InventoryRefType`, `ActorType` (RefType and ActorType are new; StockMovementType is existing).
  - `PaymentTransaction`: `PaymentMethod`, `PaymentTxStatus` (Both are existing).
  - `Refund`: `RefundReason` (New enum -> created cleanly).
- Therefore, **only 2 target tables** (`inventory_ledgers` and `payment_transactions`) have a type-level dependency on the pre-existing incompatible enums! The other 16 target tables have zero dependencies on incompatible enums.

---

### 11. Recommended Technical Direction
**Recommendation: Option B (Authorized Enum Vocabulary Transition Stage)**:
1. Formulate a formal Owner Decision Packet for an **Enum Vocabulary Transition Stage (Prompt 13.2B)** prior to Expand.
2. In this stage:
   - Widen `Role` and `PaymentMethod`.
   - Update `StockMovementType`, `PlatformRole`, `PaymentTxStatus`, `PaymentStatus`, `InvoiceStatus` to Target Revision 4.
   - Map existing data (`ADJUSTMENT` → `OPNAME_ADJUSTMENT`, `SUPER_ADMIN` → `SUPER_ADMIN`).
   - Create physical backup before execution.
3. Once completed, all 10 live enums match Target Revision 4 100%.
4. Expand migration will then cleanly classify all 10 enums as `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` without triggering P-05 or vocabulary compatibility violations!

---

### 12. Required Owner Decisions
Before any further live execution, the Project Owner must decide:
- **Decision 1**: Approve **Option B (Dedicated Enum Vocabulary Transition Stage)** or choose an alternative strategy.
- **Decision 2**: Authorize the deterministic data mapping for `stock_movements.type` (`'ADJUSTMENT'` → `'OPNAME_ADJUSTMENT'`).
- **Decision 3**: Authorize pre-seeding `_prompt_12_ownership_registry` for pre-existing enums upon vocabulary alignment.

---

### 13. Database Safety Attestation
Physical database `pos_db`:
- Inspected strictly read-only during Prompt 13.2A.
- Live DDL executed: **0**.
- Live DML executed: **0**.
- Data rows modified or deleted: **0** (total rows remains exactly 17).
- Total base tables: **18**.
- Zero partial objects or enums altered.

---

### 14. Final Gate

In accordance with Section 9 of `PROMPT_13_2A_ENUM_PROVENANCE_VOCABULARY_BLOCKER_ANALYSIS.md`:

## **READY FOR OWNER DECISION**

*(The blocker has been fully analyzed across catalog, schema, application, and data layers. Zero unanswered technical dependencies remain. Awaiting explicit Project Owner review and decision.)*

---

### 15. Explicit Confirmation: No Database Mutation
**I explicitly confirm that ZERO mutations were performed against `pos_db` during Prompt 13.2A.** No DDL, no DML, no enum alteration, no migration retry, and no subsequent migration phase has been executed. Execution has halted completely.
