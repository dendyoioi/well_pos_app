# ANTIGRAVITY EXECUTION COMMAND
# PROMPT 12.6-E — FINAL ARTIFACT & GATE CONSISTENCY CORRECTION

## PURPOSE

Execute Prompt 12.6-E using the established staged workflow:

READ → UNDERSTAND → ANALYZE → REPORT → REVIEW/GATE → IMPLEMENT AUTHORIZED CORRECTIONS → TEST/VALIDATE → FINAL REPORT → STOP

Do not skip the analysis/reporting stage.
Do not treat the existence of a prompt as authorization to perform unrelated migration work.

---

# 1. ROLE

You are **Antigravity**, acting as:

**Lead Database & Systems Architect + Migration Safety Lead**

Your responsibility in this task is to reconcile and validate the Prompt 12.6 artifact set and its gate consistency without executing the migration lifecycle.

---

# 2. CONTEXT

Prompt 12.6-D has been completed and owner-authorized.

Prompt 12.6-D established:

- `test_prompt_12_6_reconciliation.ts` was corrected to use the authoritative protected legacy baseline of exactly 18 tables.
- `test_prompt_12_6_reconciliation.ts` = 102/102 PASS.
- `test_expand_safety.ts` = PASS with 0 violations.
- Real `pos_db` was not mutated.
- ODR-01 through ODR-06 are final and binding.
- The target contract and executable artifacts must remain authoritative over stale documentation.

A prior Prompt 12.6 final report is known to contain stale/contradictory statements. Prompt 12.6-E exists specifically to correct those final-artifact and gate-consistency problems.

---

# 3. PRECONDITIONS

Before changing anything:

1. Confirm the repository and migration artifacts are present.
2. Confirm the Prompt 12.6 artifact set is present.
3. Read the canonical Prompt 12.6-E task file:
   `PROMPT_12_6_E_FINAL_ARTIFACT_GATE_CONSISTENCY_CORRECTION.md`
4. Read the relevant Prompt 12.6-C and 12.6-D evidence/report artifacts.
5. Identify the exact current state of:
   - migration.sql
   - rollback.sql
   - Prisma schema
   - application enum/RBAC contract
   - Prompt 12.6 artifacts
   - validation tests
6. Do not modify anything yet.

If a required source is missing or cannot be verified, stop the execution stage and report the gap.

---

# 4. SOURCE-OF-TRUTH HIERARCHY

Use this order:

1. Executable `migration.sql`
2. Executable `rollback.sql`
3. Approved Target Database Schema
4. Prisma target schema
5. Application enum/RBAC contract
6. Owner Decision Register ODR-01..ODR-06
7. Existing validation/test evidence
8. Documentation/artifact reports

When a lower-level document conflicts with a higher-level executable/approved contract:

- do not silently reinterpret the contract;
- do not change executable artifacts merely to satisfy documentation;
- identify the discrepancy;
- correct the documentation when authorized by Prompt 12.6-E.

---

# 5. PHASE 1 — READ

Read, at minimum:

- Prompt 12.6 canonical artifacts
- Prompt 12.6-C artifacts
- Prompt 12.6-D final report
- current migration.sql
- current rollback.sql
- current target Prisma/schema artifacts
- application enum/RBAC definitions
- `test_prompt_12_6_reconciliation.ts`
- `test_expand_safety.ts`

Also inspect the current canonical Target Schema Revision 4 and relevant Owner Decision Register entries.

Do not infer unseen content.

Output internally a source inventory before proceeding.

---

# 6. PHASE 2 — UNDERSTAND

Establish the intended state before making any correction.

Confirm:

## Target contract

- Product → ProductVariant → InventoryItem cardinality
- InventoryLedger is the canonical immutable stock movement ledger
- `legacy_stock_movements` is transition/archive support, not the canonical ledger
- `price_histories` is not a Phase 1 target
- exact target identifiers are:
  - `inventory_ledgers`
  - `modifier_groups`
  - `legacy_stock_movements`

## Legacy baseline

Authoritative protected legacy tables = exactly 18:

1. `categories`
2. `customers`
3. `hold_orders`
4. `order_items`
5. `orders`
6. `outlet_products`
7. `outlets`
8. `payments`
9. `platform_users`
10. `products`
11. `saas_invoices`
12. `saas_payments`
13. `shifts`
14. `stock_movements`
15. `subscription_plans`
16. `tenant_subscriptions`
17. `tenants`
18. `users`

## Object counts

Expected baseline:

| Object | Expected |
|---|---:|
| Ownership Registry | 1 |
| Custom Enums | 20 |
| Target Core Tables | 18 |
| Transition Columns | 23 |
| Target Indexes | 34 |
| Target Foreign Keys | 40 |
| Transition Foreign Keys | 2 |
| Protected Legacy Tables | 18 |

## Enum distinction

Keep these two statuses separate:

### Target Contract Reconciliation

Target Schema ↔ Prisma ↔ Application Contract ↔ Migration ↔ Rollback

### Live Legacy Enum Compatibility

Actual existing enum vocabulary in real `pos_db`

Known incompatible live legacy enums must remain explicitly FAIL-CLOSED unless a separate migration authorization exists.

---

# 7. PHASE 3 — ANALYZE

Perform a read-only comparison first.

Build an evidence-based reconciliation matrix for:

1. Target tables
2. Transition/legacy tables
3. Columns
4. Indexes
5. Foreign keys
6. Enums
7. Ownership registry
8. Application enum/RBAC contract
9. Rollback coverage
10. Validation tests
11. Prior final-report claims

For every discrepancy, record:

- artifact/source;
- expected value;
- observed value;
- discrepancy type;
- authoritative source;
- proposed correction;
- whether correction is authorized by Prompt 12.6-E.

Do not fix anything merely because two documents differ.
First determine which source is authoritative.

---

# 8. PHASE 4 — REPORT FINDINGS BEFORE IMPLEMENTATION

Before modifying artifacts, produce a concise findings report in the execution response containing:

## A. Confirmed facts

## B. Discrepancies

## C. Root causes

## D. Authorized corrections

## E. Non-actionable incompatibilities

## F. Validation plan

If there is an unexpected blocker, STOP here and report it rather than guessing.

If all discrepancies are limited to the documented Prompt 12.6-E corrections, proceed to the authorized implementation stage.

---

# 9. PHASE 5 — IMPLEMENT ONLY AUTHORIZED ARTIFACT CORRECTIONS

Authorized scope:

### 9.1 Documentation consistency

Correct stale/contradictory Prompt 12.6 documentation so that it reflects the executable/approved contract.

### 9.2 Canonical final report

Regenerate/update:

`/docs/validation/13_PROMPT_12_6_FINAL_REPORT.md`

It must not claim:

- 100% synchronization while live legacy enum incompatibilities remain;
- live enum migration has already occurred;
- Expand has been executed;
- Backfill has occurred;
- Dual-write has occurred;
- Cutover has occurred;
- Prompt 13 has started.

It must explicitly distinguish:

**Target Contract Reconciliation = PASS**

from:

**Live Legacy Enum Compatibility = FAIL-CLOSED**

where applicable.

### 9.3 Required new artifacts

Create/update:

`/docs/validation/13_PROMPT_12_6_E_VALIDATION_EVIDENCE.md`

`/docs/validation/13_PROMPT_12_6_E_FINAL_REPORT.md`

### 9.4 Other correction constraints

Do not:

- weaken tests;
- remove safeguards;
- alter the target contract just to make reports pass;
- change live enum types;
- execute migration/reset SQL against real `pos_db`.

---

# 10. PHASE 6 — VALIDATE

Run the authorized validation suite.

Required expected checks:

## Test A

`test_prompt_12_6_reconciliation.ts`

Expected:
**102/102 PASS**

## Test B

`test_expand_safety.ts`

Expected:
**PASS — 0 violations**

Important:

Expected results are NOT evidence.

Only actual command output counts as evidence.

If results differ:

- preserve the actual result;
- investigate;
- report the discrepancy;
- FAIL-CLOSED;
- do not modify tests simply to obtain PASS.

---

# 11. DATABASE SAFETY VALIDATION

Verify and document with evidence that:

- real `pos_db` was not migrated;
- no rollback was executed against real `pos_db`;
- no DDL was executed against real `pos_db`;
- no DML was executed against real `pos_db`;
- no reset/truncate/delete occurred;
- no Backfill occurred;
- no Dual-write occurred;
- no Cutover occurred;
- Prompt 13 was not executed.

Do not state "database unchanged" merely because the intent was read-only.
Use actual evidence available from the workflow.

---

# 12. ENUM RECONCILIATION

Produce a separate reconciliation.

## Target Contract

Verify consistency among:

- Target Schema
- Prisma
- Application enum/RBAC
- migration.sql
- rollback.sql

## Live `pos_db`

Compare the actual existing enum labels.

Known current state from prior evidence includes:

### Exact / compatible examples

- `TenantStatus` target includes `PENDING`
- other exact matches must be verified, not assumed

### Known incompatible live enums from prior analysis

- PlatformRole
- InvoiceStatus
- Role
- StockMovementType
- PaymentStatus
- PaymentMethod
- PaymentTxStatus

Re-verify the actual state before reporting.

Do not alter these live enums in this task.

---

# 13. OBJECT / COUNT RECONCILIATION

Verify, do not assume:

- Ownership Registry = 1
- Custom Enums = 20
- Target Core Tables = 18
- Transition Columns = 23
- Target Indexes = 34
- Target Foreign Keys = 40
- Transition Foreign Keys = 2
- Protected Legacy Tables = 18

Specifically confirm:

### Not Phase 1 target

`price_histories`

### Canonical target names

`inventory_ledgers`
`modifier_groups`

### Transition/archive name

`legacy_stock_movements`

### Canonical protected legacy set

Exactly the 18 tables specified above.

---

# 14. ARTIFACT COMPLETENESS REVIEW

Review all nine mandatory Prompt 12.6 artifacts:

1. `/docs/validation/13_PROMPT_12_6_TARGET_SCHEMA_RECONCILIATION.md`
2. `/docs/validation/13_PROMPT_12_6_PRISMA_CONTRACT_RECONCILIATION.md`
3. `/docs/validation/13_PROMPT_12_6_APP_ENUM_RBAC_RECONCILIATION.md`
4. `/docs/validation/13_PROMPT_12_6_EXPAND_CONTRACT_RECONCILIATION.md`
5. `/docs/validation/13_PROMPT_12_6_ROLLBACK_CONTRACT_RECONCILIATION.md`
6. `/docs/validation/13_PROMPT_12_6_OBJECT_INVENTORY.md`
7. `/docs/validation/13_PROMPT_12_6_ENUM_CONTRACT_INVENTORY.md`
8. `/docs/validation/13_PROMPT_12_6_VALIDATION_EVIDENCE.md`
9. `/docs/validation/13_PROMPT_12_6_FINAL_REPORT.md`

Check for stale claims involving:

- `price_histories`
- `modifier_groups_target`
- `inventory_ledger`
- missing `legacy_stock_movements`
- obsolete/phantom protected legacy tables
- incorrect protected legacy counts
- incorrect enum synchronization statements
- unsupported "100% synchronized" claims

---

# 15. PHASE 7 — FINAL REPORT

Update/create the required Prompt 12.6-E artifacts based strictly on evidence.

The final report must include:

1. Executive Summary
2. Files Inspected
3. Files Modified
4. Exact Discrepancies
5. Exact Corrections
6. Object / Count Reconciliation
7. Enum Reconciliation
8. Test Results
9. Database Safety Evidence
10. Remaining Risks / Blockers
11. Final Gate
12. Explicit Confirmation Prompt 13 NOT Executed

Include actual file names and actual observed values.

---

# 16. PHASE 8 — FINAL GATE REVIEW

Apply this gate literally.

## READY FOR PROMPT 13

Only when all Prompt 12.6 artifact inconsistencies are resolved and required validation/evidence is complete.

AND:

- target contract is internally consistent;
- exact target identifiers are consistent;
- protected legacy baseline is exactly 18;
- counts are reconciled;
- enum status is accurately separated;
- no false synchronization claims remain;
- database safety is verified;
- Prompt 13 has NOT been executed.

Otherwise:

## BLOCKED / OWNER REVIEW REQUIRED

Do not downgrade evidence to obtain READY.

---

# 17. STOP CONDITION

Regardless of gate result:

STOP after Prompt 12.6-E.

Do NOT:

- execute Prompt 13;
- execute migration;
- execute Backfill;
- implement Dual-write;
- Cutover;
- Contract.

The next phase requires explicit owner authorization.

---

# 18. FINAL RESPONSE TO OWNER

Return the result in this exact structure:

## 1. Executive Summary

## 2. Files Inspected

## 3. Files Modified

## 4. Exact Discrepancies

## 5. Exact Corrections

## 6. Object / Count Reconciliation

## 7. Enum Reconciliation

## 8. Test Results

## 9. Database Safety Evidence

## 10. Remaining Risks / Blockers

## 11. Final Gate

## 12. Explicit Confirmation Prompt 13 NOT Executed

For every PASS claim, provide concrete evidence.

For every FAIL/BLOCKED claim, state the exact reason.

Never infer execution from intent.

Never report an expected result as an actual result.

FAIL-CLOSED whenever evidence is insufficient.

---

# 19. OWNER SAFETY PRINCIPLE

This task is a gate correction.

The goal is not to make the project appear ready.
The goal is to establish whether the evidence actually supports readiness.

Therefore:

EVIDENCE > ASSUMPTION

EXECUTABLE CONTRACT > STALE DOCUMENTATION

ACTUAL TEST RESULT > EXPECTED RESULT

OWNER DECISION > AI INFERENCE

FAIL-CLOSED > FALSE POSITIVE
