# PROMPT 12.6-E — FINAL ARTIFACT & GATE CONSISTENCY CORRECTION

## ROLE

You are **Antigravity**, acting as **Lead Database & Systems Architect**.

---

## CONTEXT

Prompt 12.6-D has been completed and owner-authorized.

Prompt 12.6-D established:

- `test_prompt_12_6_reconciliation.ts` uses the authoritative 18 protected legacy tables.
- `test_prompt_12_6_reconciliation.ts` = **102/102 PASS**.
- `test_expand_safety.ts` = **PASS with 0 violations**.
- No mutation was performed against real `pos_db`.
- ODR-01 through ODR-06 remain binding.

---

## OBJECTIVE

Perform the **FINAL ARTIFACT & GATE CONSISTENCY CORRECTION** for Prompt 12.6.

This prompt is an **artifact reconciliation and validation task only**.

### STRICTLY PROHIBITED

DO NOT:

- execute the Expand migration;
- execute rollback;
- perform Backfill;
- implement Dual-write;
- perform Cutover;
- perform Contract phase;
- start Prompt 13;
- mutate staging, production, or real `pos_db`;
- reset, delete, or truncate prototype data.

---

# SOURCE-OF-TRUTH HIERARCHY

Use this hierarchy when resolving discrepancies:

1. Executable `migration.sql`
2. Executable `rollback.sql`
3. Approved Target Database Schema
4. Prisma schema
5. Application enum/RBAC contract
6. Owner Decisions ODR-01 through ODR-06
7. Existing validation/test evidence
8. Existing generated documentation

### IMPORTANT

Do **not** modify executable migration, rollback, or schema artifacts merely to make documentation agree.

If documentation conflicts with executable/approved sources, correct the documentation — not the executable contract — unless a separate explicit owner authorization exists.

---

# REQUIRED CORRECTIONS

## 1. `price_histories`

Confirm from executable artifacts and Target Schema whether `price_histories` exists.

### Expected result

`price_histories` is:

- NOT a Phase 1 target;
- a documentation artifact/error from the previous Prompt 12.6 report;
- NOT to be created.

Do not add it to migration or schema.

---

## 2. Target table naming

Re-derive the exact executable identifiers.

### Expected exact executable identifiers

- `inventory_ledgers`
- `modifier_groups`
- `legacy_stock_movements`

### Do NOT use

- `inventory_ledger`
- `modifier_groups_target`
- `price_histories`

`legacy_stock_movements` is an additive transition/archive mechanism and is **not** the canonical InventoryLedger.

The canonical inventory movement ledger remains `inventory_ledgers`.

---

## 3. Protected legacy baseline

The authoritative protected legacy baseline is **exactly these 18 tables**:

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

There must be:

- no phantom table;
- no omitted table;
- no substitution by similarly named speculative tables.

---

## 4. Object counts

Re-derive these counts from the actual executable artifacts.

Do NOT blindly trust previous reports.

Expected counts:

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

If actual counts differ from these expected values:

1. investigate the difference;
2. identify the source of truth;
3. report the exact discrepancy;
4. FAIL-CLOSED unless the difference is demonstrably a documentation-only error that can be safely corrected.

---

# 5. Validation

Execute the relevant validation tests that are authorized by the existing Prompt 12.6 workflow.

Expected:

- `test_prompt_12_6_reconciliation.ts` → **102/102 PASS**
- `test_expand_safety.ts` → **PASS, 0 violations**

If the actual result differs:

- report the exact result;
- do not reinterpret failure as success;
- do not modify tests merely to obtain a PASS;
- FAIL-CLOSED.

The tests must validate the actual contract, not be weakened to match documentation.

---

# 6. Enum status — CRITICAL DISTINCTION

Do NOT collapse these two concepts.

## A. Target Contract Reconciliation

This means:

> Target Schema ↔ Prisma ↔ Application enum/RBAC ↔ migration ↔ rollback

This may be **PASS** if the artifacts are internally consistent.

## B. Live Legacy Enum Compatibility

This means:

> Actual enum vocabulary currently present in real `pos_db`

Known incompatible pre-existing enums remain **FAIL-CLOSED** until a separately authorized migration strategy exists.

Do NOT:

- alter live enum vocabulary;
- migrate live enum types;
- claim that incompatible live enums have already been migrated;
- describe target-contract consistency as proof that live database enums are already compatible.

The final report must explicitly show the distinction.

---

# 7. Database safety

Verify and document that:

- `pos_db` remains unchanged;
- no migration was executed;
- no rollback was executed;
- no DDL was executed against real `pos_db`;
- no DML was executed against real `pos_db`;
- no reset occurred;
- no Backfill occurred;
- no Dual-write occurred;
- no Cutover occurred;
- Prompt 13 was NOT started.

Do not claim "unchanged" without evidence.

Where possible, use actual read-only inspection evidence and existing validation evidence.

---

# 8. Review all 9 mandatory Prompt 12.6 artifacts

Review each of these:

1. `/docs/validation/13_PROMPT_12_6_TARGET_SCHEMA_RECONCILIATION.md`
2. `/docs/validation/13_PROMPT_12_6_PRISMA_CONTRACT_RECONCILIATION.md`
3. `/docs/validation/13_PROMPT_12_6_APP_ENUM_RBAC_RECONCILIATION.md`
4. `/docs/validation/13_PROMPT_12_6_EXPAND_CONTRACT_RECONCILIATION.md`
5. `/docs/validation/13_PROMPT_12_6_ROLLBACK_CONTRACT_RECONCILIATION.md`
6. `/docs/validation/13_PROMPT_12_6_OBJECT_INVENTORY.md`
7. `/docs/validation/13_PROMPT_12_6_ENUM_CONTRACT_INVENTORY.md`
8. `/docs/validation/13_PROMPT_12_6_VALIDATION_EVIDENCE.md`
9. `/docs/validation/13_PROMPT_12_6_FINAL_REPORT.md`

Identify every:

- stale statement;
- contradictory statement;
- phantom object;
- missing object;
- ambiguous naming;
- incorrect count;
- incorrect enum status;
- incorrect gate statement;
- unsupported claim.

Do not silently ignore discrepancies.

Do not silently change executable artifacts.

Correct documentation only where authorized by this prompt and the established source-of-truth hierarchy.

---

# 9. Regenerate the canonical Prompt 12.6 Final Report

Regenerate:

`/docs/validation/13_PROMPT_12_6_FINAL_REPORT.md`

The regenerated report MUST:

### NOT claim

- "100% synchronized" if live enum compatibility remains incompatible;
- that legacy enums have already been migrated;
- that Prompt 13 has started;
- that Expand/Backfill/Dual-write/Cutover has occurred.

### MUST explicitly state

**Target Contract Reconciliation = PASS**

and separately:

**Live Legacy Enum Compatibility = FAIL-CLOSED**

if the known incompatible live enums remain unchanged.

The report must include:

- exact 18 protected legacy tables;
- exact executable target object names;
- actual object counts;
- validation test results;
- database safety evidence;
- enum reconciliation;
- remaining blockers/risks;
- explicit statement that Prompt 13 has NOT started.

---

# 10. Required new evidence artifacts

Create/update:

`/docs/validation/13_PROMPT_12_6_E_VALIDATION_EVIDENCE.md`

and

`/docs/validation/13_PROMPT_12_6_E_FINAL_REPORT.md`

These artifacts must contain evidence of the actual work performed.

Include:

- commands actually executed;
- files actually inspected;
- source comparisons;
- target object comparison;
- protected legacy comparison;
- object/count reconciliation;
- enum reconciliation;
- validation test results;
- database safety evidence;
- exact discrepancies found;
- exact corrections made;
- exact remaining blockers.

### Evidence integrity rule

Never claim:

- a command was executed when it was not;
- a file was inspected when it was not;
- a test passed when it was not;
- the database was unchanged without evidence;
- an artifact was corrected when it was not.

---

# 11. Final gate

Declare:

## READY FOR PROMPT 13

ONLY if:

- all Prompt 12.6 artifact inconsistencies have been resolved;
- mandatory validation passes;
- object names are consistent;
- protected legacy baseline is exactly 18;
- counts are reconciled;
- enum status is accurately separated between target contract and live legacy compatibility;
- no unsupported synchronization claim remains;
- database safety is verified;
- Prompt 13 has not been executed.

Otherwise declare:

## BLOCKED / OWNER REVIEW REQUIRED

FAIL-CLOSED.

### IMPORTANT

Even if the result is:

**READY FOR PROMPT 13**

STOP immediately.

Do NOT:

- execute Expand;
- execute Backfill;
- implement Dual-write;
- perform Cutover;
- begin Contract;
- execute Prompt 13.

The next action must be separately authorized by the owner.

---

# FINAL OUTPUT FORMAT

Return the final result using exactly these sections:

1. **Executive Summary**
2. **Files Inspected**
3. **Files Modified**
4. **Exact Discrepancies**
5. **Exact Corrections**
6. **Object / Count Reconciliation**
7. **Enum Reconciliation**
8. **Test Results**
9. **Database Safety Evidence**
10. **Remaining Risks / Blockers**
11. **Final Gate**
12. **Explicit Confirmation Prompt 13 NOT Executed**

Be precise.

Do not infer execution.

Do not claim success without evidence.

FAIL-CLOSED whenever evidence is insufficient.
