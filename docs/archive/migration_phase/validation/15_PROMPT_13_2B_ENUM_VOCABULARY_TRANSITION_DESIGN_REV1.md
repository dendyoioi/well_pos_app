# 15_PROMPT_13_2B_ENUM_VOCABULARY_TRANSITION_DESIGN_REV1.md
## Enum Vocabulary Transition Design — Revision 1 (Safety Hardened)

### 1. Executive Summary & Changelog (What was Corrected)
This document provides **Revision 1** of the architectural design for the dedicated pre-Expand migration stage: **Prompt 13.2B — Enum Vocabulary Transition**. 

Following technical review of the initial design ([`docs/validation/15_PROMPT_13_2B_ENUM_VOCABULARY_TRANSITION_DESIGN.md`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/docs/validation/15_PROMPT_13_2B_ENUM_VOCABULARY_TRANSITION_DESIGN.md)), five critical gaps were identified and resolved in Revision 1:

1. **Elimination of Fake / Lossy Rollback Inverses**: 
   - *Previous Gap*: The initial draft suggested simplistic reverse mappings (e.g. `VOID` → `CANCELLED`, `DRAFT` → `UNPAID`) without addressing the fact that `VOID` collapses both legacy `CANCELLED` and `EXPIRED`, making reverse mapping lossy and non-deterministic.
   - *Revision 1 Correction*: Explicitly classifies all 7 incompatible enums into **Strictly Invertible Bijections** vs **Conditionally Invertible Injections**. Mandates fail-closed rollback preconditions that halt rollback if target-only values exist.
2. **Hardened Ownership Provenance Semantics**:
   - *Previous Gap*: Blindly marking physically recreated enums as `created_by_migration = false` in `_prompt_12_ownership_registry` confused Prompt 12 provenance with Prompt 13.2B provenance.
   - *Revision 1 Correction*: Formulates a dual-registry model. Introduces a dedicated transition log `_prompt_13_2b_enum_transition_registry` to record physical recreation history, while establishing exact `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` provenance in `_prompt_12_ownership_registry` to satisfy the frozen Expand contract.
3. **Application Deployment & Quiescence Sequencing**:
   - *Previous Gap*: Sequencing lacked explicit controls on how to prevent running application code from writing legacy enum labels during the transition window.
   - *Revision 1 Correction*: Establishes an exact 6-window deployment protocol: Application Quiescence → Snapshot → Enum Transition → Expand Migration → Prisma Client Sync → Application Restart.
4. **Fail-Closed Rollback Preconditions**:
   - *Previous Gap*: The rollback DDL lacked data guards.
   - *Revision 1 Correction*: Designed strict pre-rollback assertion checks across all affected legacy columns and verifies that Expand target tables are dropped before enum rollback is permitted.
5. **Multi-Stage Recovery Sequencing**:
   - *Previous Gap*: Failure states between Expand and Enum Transition were not formally modeled.
   - *Revision 1 Correction*: Formulates exhaustive recovery runbooks across 5 failure scenarios (A through E) and defines physical backup as the final immutable recovery mechanism.

**Strict Governance Guardrail**: This document is **READ-ONLY DESIGN ONLY**. Zero DDL or DML was executed against `pos_db`.

---

### 2. Source-of-Truth Review
- **`ARCH-2026-09-DB-SCHEMA-04`**: Authoritative specification for all 20 target enums.
- **`server/prisma/schema.prisma`**: Target Prisma schema (currently aligned with Revision 4, diverged from `pos_db`).
- **`migration.sql`**: Frozen Expand migration DDL (enforces exact equality at line 183 and rule P-05 at line 199).
- **`rollback.sql`**: Frozen Expand rollback DDL (drops target tables, preserves pre-existing enums).
- **`ODR-01..ODR-06`**: Upheld 100% without modification.

---

### 3. Finding 1: Rollback Invertibility & Lossy Mapping Analysis

A rollback is **truly invertible** if and only if the forward mapping $f: \text{Legacy} \to \text{Target}$ has a unique inverse $f^{-1}: \text{Target} \to \text{Legacy}$ such that $f^{-1}(f(x)) = x$ for all active values.

#### Detailed Enum-by-Enum Invertibility Evaluation:

| Enum Name | Forward Mapping Nature | Lossy Elements | Current Live Data Status | Rollback Invertibility Rating |
| :--- | :--- | :--- | :---: | :---: |
| **`PlatformRole`** | **Strict Bijection** (1:1) | None | 1 row (`SUPER_ADMIN`) | **TRULY INVERTIBLE** |
| **`Role`** | **Injective Superset** (1:1 for existing) | `OWNER`, `KITCHEN`, `WAITER` have no legacy inverse | 2 rows (`ADMIN`, `CASHIER`) | **CONDITIONALLY INVERTIBLE** (Requires guard) |
| **`StockMovementType`** | **Injective Mapping** (1:1 for existing) | `RETURN`, `VOID`, `PROD_*` have no legacy inverse | 2 rows (`ADJUSTMENT`) | **CONDITIONALLY INVERTIBLE** (Requires guard) |
| **`PaymentMethod`** | **Injective Superset** (1:1 for existing) | 5 appended methods have no legacy inverse | 0 rows | **CONDITIONALLY INVERTIBLE** (Requires guard) |
| **`PaymentTxStatus`** | **Injective Mapping** (1:1 for existing) | `REFUNDED`, `VOIDED` have no legacy inverse | 0 rows | **CONDITIONALLY INVERTIBLE** (Requires guard) |
| **`InvoiceStatus`** | **Surjective / Lossy** (Many-to-1) | `CANCELLED` & `EXPIRED` both map to `VOID`; `DRAFT` has no inverse | 0 rows | **LOSSY — CONDITIONALLY INVERTIBLE** |
| **`PaymentStatus`** | **Lossy / Restructured** | `CANCELLED` is dropped; `UNPAID`, `PARTIALLY_*` have no inverse | 0 rows | **LOSSY — CONDITIONALLY INVERTIBLE** |

#### Invertibility Analysis Summary:
1. **`PlatformRole`**: `SUPER_ADMIN` $\leftrightarrow$ `SUPER_ADMIN`, `SUPPORT_AGENT` $\leftrightarrow$ `SUPPORT`, `FINANCE_ADMIN` $\leftrightarrow$ `BILLING`. 100% reversible under all circumstances.
2. **`Role`, `PaymentMethod`, `StockMovementType`, `PaymentTxStatus`**: For all existing live rows in `pos_db`, the inverse is exact. However, if new application writes introduce target-only labels (e.g. a user assigned `OWNER` or a movement recorded as `RETURN`), rollback cannot uniquely map them to legacy labels.
3. **`InvoiceStatus` & `PaymentStatus`**: Forward mapping is structurally lossy. `CANCELLED` and `EXPIRED` collapse into `VOID`. In reverse, `VOID` cannot determine whether the invoice was originally `CANCELLED` or `EXPIRED`. 
   - *Why it is currently safe*: `saas_invoices` and `orders` currently have **0 rows** in `pos_db`.
   - *Precondition Invariant*: Rollback is safe **if and only if** zero rows contain target-only values (`DRAFT`, `VOID`, `UNPAID`, `PARTIALLY_PAID`, `PARTIALLY_REFUNDED`).

---

### 4. Finding 2: Ownership Semantics & Dual-Registry Architecture

#### The Provenance Dilemma:
When Prompt 13.2B performs a Type Swap in PostgreSQL, it physically drops the old PostgreSQL types and creates new PostgreSQL types. 
- If we mark them as `created_by_migration = true` in `_prompt_12_ownership_registry`, Expand rollback (`rollback.sql`) would attempt to `DROP` them, destroying the legacy tables' column bindings!
- If we introduce a new ownership state like `TRANSITIONED_BY_PROMPT_13_2B` into `_prompt_12_ownership_registry`, the frozen `migration.sql` line 153 will reject it:
  `REGISTRY OWNERSHIP CONTRADICTION: Expected CREATED_BY_PROMPT_12_4_2 or PRE_EXISTING_EXACT_COMPATIBLE_REUSED`.

#### The Architectural Solution: Dual-Registry Model
We strictly separate **Transition Audit Provenance** from **Expand Contract Provenance**:

```text
+-------------------------------------------------------------------------------+
| REGISTRY 1: _prompt_13_2b_enum_transition_registry (Transition Audit Log)     |
+-------------------------------------------------------------------------------+
| Records physical execution of Prompt 13.2B:                                  |
| - enum_name              : 'PlatformRole', 'StockMovementType', ...           |
| - physical_action        : 'RECREATED_VIA_TYPE_SWAP'                          |
| - original_labels        : ARRAY['PURCHASE_IN', 'SALE_OUT', ...]              |
| - target_labels          : ARRAY['SALE', 'PURCHASE', ...]                     |
| - executed_by            : 'PROMPT_13_2B'                                     |
| - transition_timestamp   : CURRENT_TIMESTAMP                                  |
+-------------------------------------------------------------------------------+
                                      │
                                      ▼
+-------------------------------------------------------------------------------+
| REGISTRY 2: _prompt_12_ownership_registry (Expand Contract Provenance)        |
+-------------------------------------------------------------------------------+
| Records baseline status as viewed by Expand:                                  |
| - object_name            : 'StockMovementType', 'PlatformRole', ...           |
| - ownership              : 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED'             |
| - compatibility_state    : 'EXACT_COMPATIBLE'                                 |
| - created_by_migration   : false                                              |
| - rollback_action        : 'PRESERVE'                                         |
+-------------------------------------------------------------------------------+
```

#### Why This is Authoritative & Safe:
1. From the perspective of **Expand (`migration.sql`)**, these 10 enums pre-exist its execution, match Target Revision 4 exactly, and must be **preserved** on Expand rollback.
2. From the perspective of **Prompt 13.2B**, the physical mutation history is formally captured in `_prompt_13_2b_enum_transition_registry`, enabling deterministic rollback by `rollback_prompt_13_2b_enum_vocabulary.sql`.

---

### 5. Finding 3: Application Deployment & Quiescence Sequencing

To prevent running application code from attempting to write legacy enum labels to the database during or immediately after transition, an exact 6-window sequence is required:

```text
================================================================================
EXACT APPLICATION & MIGRATION DEPLOYMENT TIMELINE
================================================================================
[WINDOW 1: MAINTENANCE FREEZE]
  1.1 Gracefully shut down backend service (kill port 5001).
  1.2 Reject incoming API requests with 503 Service Unavailable at reverse proxy.
  1.3 Confirm pg_stat_activity shows 0 active client connections to pos_db.

[WINDOW 2: PRE-TRANSITION SNAPSHOT]
  2.1 Execute pg_dump -Fc -d pos_db -f server/backups/pos_db_pre_enum_transition.dump
  2.2 Verify backup TOC via pg_restore --list (verify exit code 0).
  2.3 Record SHA-256 checksum in execution evidence.

[WINDOW 3: PROMPT 13.2B ENUM TRANSITION]
  3.1 Execute prompt_13_2b_enum_vocabulary_alignment.sql in a single transaction.
  3.2 Inspect pg_enum to verify all 10 enums match Target Revision 4.
  3.3 Verify 17 data rows mapped correctly.

[WINDOW 4: PROMPT 13.2 EXPAND RETRY]
  4.1 Execute migration.sql (20260919000000_expand_phase_ddl) under OAUTH-13.2-01.
  4.2 Expand verifies 10 pre-existing enums, creates 10 new enums, 18 target tables.
  4.3 Run test_prompt_12_6_reconciliation.ts (verify 102/102 PASS).
  4.4 Run test_expand_safety.ts (verify 0 violations).

[WINDOW 5: APPLICATION CODE & PRISMA SYNCHRONIZATION]
  5.1 Deploy updated backend source code containing Target Revision 4 enum models.
  5.2 Execute npx prisma generate inside /server directory.
  5.3 Verify TypeScript compilation (npx tsc --noEmit).

[WINDOW 6: SERVICE RESTORATION]
  6.1 Start backend application service on port 5001.
  6.2 Execute health-check probe (/health, /api/auth/status).
  6.3 Remove maintenance freeze; resume production routing.
================================================================================
```

---

### 6. Finding 4: Fail-Closed Rollback Preconditions

The rollback script `rollback_prompt_13_2b_enum_vocabulary.sql` must enforce strict pre-flight assertions before performing any DDL:

```sql
-- =============================================================================
-- ROLLBACK PRECONDITION ASSERTIONS (FAIL-CLOSED)
-- =============================================================================
DO $$
DECLARE
    v_cnt INT;
BEGIN
    -- 1. ASSERTION: Expand target tables MUST NOT exist!
    -- Target tables like inventory_ledgers depend on StockMovementType.
    SELECT count(*) INTO v_cnt 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('inventory_ledgers', 'payment_transactions', 'inventory_items');
    
    IF v_cnt > 0 THEN
        RAISE EXCEPTION 'ROLLBACK PRECONDITION VIOLATION: % Expand target tables exist. Expand must be rolled back before enum transition rollback is permitted.', v_cnt;
    END IF;

    -- 2. ASSERTION: users table must not contain target-only roles
    SELECT count(*) INTO v_cnt FROM "users" WHERE "role"::text IN ('OWNER', 'KITCHEN', 'WAITER');
    IF v_cnt > 0 THEN
        RAISE EXCEPTION 'ROLLBACK PRECONDITION VIOLATION: users table contains % rows with target-only roles (OWNER, KITCHEN, WAITER). Cannot reverse without data loss.', v_cnt;
    END IF;

    -- 3. ASSERTION: stock_movements must not contain target-only movement types
    SELECT count(*) INTO v_cnt FROM "stock_movements" 
    WHERE "type"::text IN ('RETURN', 'VOID', 'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT');
    IF v_cnt > 0 THEN
        RAISE EXCEPTION 'ROLLBACK PRECONDITION VIOLATION: stock_movements contains % rows with target-only types (RETURN, VOID, PROD_*). Cannot reverse without data loss.', v_cnt;
    END IF;

    -- 4. ASSERTION: payments must not contain target-only payment methods
    SELECT count(*) INTO v_cnt FROM "payments" 
    WHERE "method"::text IN ('CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'EWALLET', 'VOUCHER');
    IF v_cnt > 0 THEN
        RAISE EXCEPTION 'ROLLBACK PRECONDITION VIOLATION: payments contains % rows with target-only payment methods. Cannot reverse without data loss.', v_cnt;
    END IF;

    -- 5. ASSERTION: payments must not contain target-only tx statuses
    SELECT count(*) INTO v_cnt FROM "payments" WHERE "status"::text IN ('REFUNDED', 'VOIDED');
    IF v_cnt > 0 THEN
        RAISE EXCEPTION 'ROLLBACK PRECONDITION VIOLATION: payments contains % rows with target-only statuses (REFUNDED, VOIDED). Cannot reverse without data loss.', v_cnt;
    END IF;

    -- 6. ASSERTION: orders must not contain target-only payment statuses
    SELECT count(*) INTO v_cnt FROM "orders" 
    WHERE "payment_status"::text IN ('UNPAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED');
    IF v_cnt > 0 THEN
        RAISE EXCEPTION 'ROLLBACK PRECONDITION VIOLATION: orders contains % rows with target-only payment statuses. Cannot reverse without data loss.', v_cnt;
    END IF;

    -- 7. ASSERTION: saas_invoices must not contain target-only invoice statuses
    SELECT count(*) INTO v_cnt FROM "saas_invoices" WHERE "status"::text IN ('DRAFT', 'VOID');
    IF v_cnt > 0 THEN
        RAISE EXCEPTION 'ROLLBACK PRECONDITION VIOLATION: saas_invoices contains % rows with target-only invoice statuses. Cannot reverse without data loss.', v_cnt;
    END IF;

    RAISE NOTICE 'ALL ROLLBACK PRECONDITIONS PASSED. Reversing enum vocabulary transition is safe.';
END $$;
```

---

### 7. Finding 5: Multi-Stage Recovery Runbooks

The lifecycle involves two independent migration layers:
- **Layer 1**: Prompt 13.2B (Enum Vocabulary Transition)
- **Layer 2**: Prompt 13.2 (Expand Phase DDL)

#### Recovery Runbooks Across All 5 Scenarios:

```text
+----------------------------------------------------------------------------------------------------+
| SCENARIO A: ENUM TRANSITION (PROMPT 13.2B) FAILS DURING EXECUTION                                  |
+----------------------------------------------------------------------------------------------------+
| Database State      : Unchanged. Transaction aborts and rolls back automatically.                  |
| Registry State      : Absent (rolled back).                                                        |
| Target Tables       : 0.                                                                           |
| Action Required     : Inspect error trace; fix migration DDL; zero cleanup needed.                 |
+----------------------------------------------------------------------------------------------------+

+----------------------------------------------------------------------------------------------------+
| SCENARIO B: ENUM TRANSITION SUCCEEDS, BUT EXPAND (PROMPT 13.2) LATER FAILS                         |
+----------------------------------------------------------------------------------------------------+
| Database State      : Layer 1 (Enum Transition) committed; Layer 2 (Expand) rolled back cleanly.   |
| Registry State      : _prompt_13_2b_enum_transition_registry exists;                                |
|                       _prompt_12_ownership_registry contains 10 pre-existing enums.                |
| Target Tables       : 0 (Expand rolled back).                                                      |
| Recovery Options    :                                                                              |
|   Option B1 (Fix & Retry): Fix Expand blocker and rerun migration.sql.                             |
|   Option B2 (Revert to Baseline): Run rollback_prompt_13_2b_enum_vocabulary.sql. Preconditions will  |
|                                  pass because 0 target rows were added. Baseline 100% restored.    |
|   Option B3 (Disaster Restore): pg_restore from pos_db_pre_enum_transition.dump.                   |
+----------------------------------------------------------------------------------------------------+

+----------------------------------------------------------------------------------------------------+
| SCENARIO C: ENUM TRANSITION SUCCEEDS, EXPAND SUCCEEDS                                              |
+----------------------------------------------------------------------------------------------------+
| Database State      : Fully expanded. 18 legacy tables + 18 target tables + 23 transition columns. |
| Registry State      : Both registries active and synchronized.                                     |
| Action Required     : Proceed to Window 5 (Prisma Client generation & application restart).        |
+----------------------------------------------------------------------------------------------------+

+----------------------------------------------------------------------------------------------------+
| SCENARIO D: BOTH SUCCEEDED, THEN FULL ROLLBACK IS ORDERED                                          |
+----------------------------------------------------------------------------------------------------+
| Rollback Ordering   : STRICT REVERSE ORDER:                                                        |
|   Step 1: Execute server/prisma/migrations/20260919000000_expand_phase_ddl/rollback.sql           |
|           -> Drops 18 target tables, 23 transition cols, drops 10 Expand-created enums,            |
|              preserves the 10 pre-existing enums.                                                  |
|   Step 2: Verify Expand rollback succeeded (0 target tables exist).                                |
|   Step 3: Run rollback preconditions on rollback_prompt_13_2b_enum_vocabulary.sql.                 |
|   Step 4: Execute rollback_prompt_13_2b_enum_vocabulary.sql.                                       |
|           -> Restores legacy PostgreSQL enum types and data values.                                |
|           -> Drops _prompt_13_2b_enum_transition_registry.                                         |
| Final State         : Exact pre-13.2B baseline restored with zero residual objects.                |
+----------------------------------------------------------------------------------------------------+

+----------------------------------------------------------------------------------------------------+
| SCENARIO E: EXPAND ROLLBACK EXECUTED, BUT ENUM ROLLBACK NOT EXECUTED                               |
+----------------------------------------------------------------------------------------------------+
| Database State      : 18 legacy tables intact, zero target tables, but enums are Target Revision 4.|
| Stability           : Structurally valid and stable if application code is target-compatible.      |
| Action Required     : Either leave in target vocabulary for subsequent Expand attempts, or execute|
|                       Step 4 from Scenario D to complete full reversion to prototype baseline.    |
+----------------------------------------------------------------------------------------------------+
```

---

### 8. Physical Backup as Final Safety Mechanism

Physical backup is **mandatory and non-negotiable**:
- If a multi-stage rollback is interrupted by a hardware failure, network disconnection, or corrupted catalog state, the physical dump taken in Window 2 ([`server/backups/pos_db_pre_enum_transition_<timestamp>.dump`](file:///Users/dendyaditya/Projects/pos_project/pos_apps/server/backups/)) serves as the definitive point-in-time recovery source.
- Verified restore command:
  ```bash
  dropdb -h localhost -U postgres pos_db
  createdb -h localhost -U postgres pos_db
  pg_restore -h localhost -U postgres -d pos_db -v server/backups/pos_db_pre_enum_transition_<timestamp>.dump
  ```

---

### 9. Required Owner Decisions (Ratification Packet)

```text
================================================================================
OWNER DECISION RATIFICATION PACKET — PROMPT 13.2B (REV 1)
================================================================================
[ODR-13.2B-01] Enum Transition Authorization:
  -> Authorize dedicated pre-Expand migration stage (Prompt 13.2B).
  -> Method: Transactional Type-Swap Pattern for 7 incompatible enums.

[ODR-13.2B-02] Live Data Mapping Ratification:
  -> Ratify exact data transformations:
     - stock_movements.type: 'ADJUSTMENT' -> 'OPNAME_ADJUSTMENT'
     - platform_users.role: 'SUPER_ADMIN' -> 'SUPER_ADMIN'
     - users.role: 'ADMIN' -> 'ADMIN', 'CASHIER' -> 'CASHIER'

[ODR-13.2B-03] Dual-Registry & Provenance Architecture:
  -> Authorize creating _prompt_13_2b_enum_transition_registry for transition audit.
  -> Authorize seeding _prompt_12_ownership_registry with PRE_EXISTING_EXACT_COMPATIBLE_REUSED
     and rollback_action = 'PRESERVE' to satisfy the frozen Expand contract.

[ODR-13.2B-04] Fail-Closed Rollback Preconditions:
  -> Ratify fail-closed preconditions halting rollback if target-only values exist.
  -> Ratify requirement that Expand must be rolled back before enum transition rollback.
================================================================================
```

---

### 10. Database Safety Attestation
Physical PostgreSQL database `pos_db`:
- Evaluated strictly read-only during Prompt 13.2B-REV1.
- Live DDL executed: **0**.
- Live DML executed: **0**.
- Data rows modified or deleted: **0** (total rows remains exactly 17).
- Total base tables: **18**.
- Zero partial objects or enums altered.

---

### 11. Final Gate

All 5 findings have been answered exhaustively, consistently, and without ambiguity:

## **READY FOR OWNER DECISION**

*(The revised design provides deterministic rollback invertibility analysis, fail-closed rollback preconditions, a dual-registry ownership model, exact application deployment sequencing, and comprehensive 5-scenario multi-stage recovery runbooks. Zero database mutations were performed. Awaiting explicit Project Owner review and ratification of ODR-13.2B-01 through ODR-13.2B-04.)*

---

### 12. Explicit Confirmation: STOP
**Zero database mutations were performed against `pos_db` during Prompt 13.2B-REV1.** No DDL, no DML, no enum alteration, no migration retry, no Expand execution, no Prisma regeneration, and no application restarts occurred. Execution has halted completely.
