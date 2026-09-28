# OWNER AUTHORIZATION — EXECUTE EXPAND MIGRATION

## DOCUMENT CONTROL

**Authorization Stage:** Prompt 13.2 — Expand Migration Execution  
**Parent Gate:** Prompt 13.1-F — Canonical Final Report Reconciliation  
**Authorization Date:** September 20, 2026  
**Decision Authority:** Project Owner  
**Status:** APPROVED / BINDING FOR PROMPT 13.2  
**Authorized Environment:** `pos_db` on `localhost:5432`  
**Migration:** `20260919000000_expand_phase_ddl`  
**Execution Scope:** EXPAND ONLY

---

# 1. OWNER AUTHORIZATION SUMMARY

Following completion and review of:

- Prompt 12.6-E — Final Artifact & Gate Consistency Correction;
- Prompt 13.1 — Runtime Migration Preflight;
- Prompt 13.1A — Blocker Analysis & Owner Decision;
- ODR-13.1A-01 — Option B `order_items` precision alignment;
- ODR-13.1A-02 — Physical backup authorization and sequencing;
- Prompt 13.1B — Authorized Blocker Resolution & Re-Preflight;
- Prompt 13.1B-E — Full Re-Preflight Evidence Closure;
- Prompt 13.1-F — Canonical Final Report Reconciliation;

the Project Owner authorizes **EXECUTION OF THE EXPAND MIGRATION ONLY**, subject to every constraint and gate in this authorization.

Prompt 13.1 established the technical state:

> **READY FOR EXPAND EXECUTION**

This document converts that technical readiness into explicit **Owner Authorization to execute Expand**.

---

# 2. OWNER DECISION

## OAUTH-13.2-01 — EXPAND EXECUTION

**APPROVED**

Antigravity is explicitly authorized to execute:

`server/prisma/migrations/20260919000000_expand_phase_ddl/migration.sql`

against:

`pos_db`

using the already-verified target database connection and execution environment.

---

# 3. AUTHORIZED SCOPE

The authorization covers ONLY the approved Expand migration contract.

The Expand phase is limited to:

- creation of approved target enum structures according to ownership-safe logic;
- creation of approved target core tables;
- addition of approved transition columns;
- creation of approved target indexes;
- creation of approved foreign keys;
- creation/use of ownership registry required by the migration;
- execution of the approved Expand preflight/assertion logic;
- recording execution evidence;
- post-Expand structural validation.

The authorized target contract remains the previously reconciled Prompt 12.6 contract.

Expected target object baseline:

- Ownership Registry: 1
- Custom Enums: 20 target contract definitions
- Target Core Tables: 18
- Transition Columns: 23
- Target Indexes: 34
- Target Foreign Keys: 40
- Transition Foreign Keys: 2
- Protected Legacy Tables: 18

---

# 4. PROTECTED LEGACY BASELINE

The following 18 tables are explicitly protected and must remain intact:

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

No protected legacy table may be dropped, truncated, or destructively altered by the Expand execution.

---

# 5. PRE-EXECUTION CONDITIONS

Before executing Expand, Antigravity MUST re-verify:

### Database identity

- database = `pos_db`;
- host = `localhost`;
- port = `5432`;
- schema = `public`;
- intended execution role = `postgres`.

### Current readiness

- Prompt 13.1 final gate = `READY FOR EXPAND EXECUTION`;
- Prompt 13.1-F canonical report = `COMPLETE, CLOSED & RATIFIED`;
- no unresolved execution-blocking condition has appeared since the last preflight.

### Backup

Verified physical backup must still exist and be accessible:

`server/backups/pos_db_pre_expand_20260920_135400.dump`

Do not assume its availability.
Verify its existence before migration execution.

### Application quiescence

Confirm the execution window remains quiescent according to the approved migration runbook.

### Live database baseline

At minimum confirm:

- 18 protected legacy tables exist;
- target tables are not already present;
- ownership registry is absent before Expand;
- `_prisma_migrations` remains absent unless the execution mechanism itself intentionally creates migration metadata;
- live enum state remains as expected;
- no unexpected schema drift exists.

If any precondition differs materially from the approved preflight baseline:

**STOP — OWNER REVIEW REQUIRED**

Do not continue based on assumption.

---

# 6. EXECUTION SAFETY SETTINGS

For the migration execution session, apply the approved deterministic timeout policy where supported:

```sql
SET lock_timeout = '5s';
SET statement_timeout = '60s';
```

Do not silently change timeout policy to allow indefinite waiting.

If the migration requires different settings due to a documented technical necessity, STOP and request Owner Review before proceeding.

---

# 7. ENUM EXECUTION RULE

The live database currently contains:

### Exact-compatible pre-existing enums

- `BillingCycle`
- `ShiftStatus`
- `TenantStatus`

### Pre-existing incompatible enums

- `PlatformRole`
- `InvoiceStatus`
- `Role`
- `StockMovementType`
- `PaymentStatus`
- `PaymentMethod`
- `PaymentTxStatus`

These live enums are NOT authorized for ad-hoc manual alteration under this Owner Authorization.

Antigravity must execute only the ownership-safe logic already contained in the approved migration artifact.

Do not:

- add enum labels manually;
- rename enum labels manually;
- drop live enum types;
- recreate incompatible live enums outside the migration contract.

Any unexpected enum condition must fail closed.

---

# 8. MIGRATION ARTIFACT INTEGRITY

The Owner authorizes execution of the already-approved `migration.sql`.

Do NOT modify `migration.sql` immediately before execution to "fix" a runtime error.

Do NOT modify `rollback.sql` as part of execution unless a separate Owner Authorization is issued.

The executable migration contract is frozen at execution time.

If the migration fails because the executable artifact and live state disagree:

**STOP — RECORD FAILURE — OWNER REVIEW REQUIRED**

Do not hot-edit the migration and rerun against the live database without a new explicit authorization.

---

# 9. EXECUTION PROTOCOL

Use:

```text
READ FINAL AUTHORIZATION
    ↓
VERIFY PRECONDITIONS
    ↓
VERIFY BACKUP
    ↓
VERIFY LIVE BASELINE
    ↓
SET EXECUTION SAFETY SETTINGS
    ↓
EXECUTE EXPAND MIGRATION
    ↓
CAPTURE ACTUAL OUTPUT
    ↓
VERIFY COMMIT / ROLLBACK RESULT
    ↓
POST-EXPAND STRUCTURAL VALIDATION
    ↓
REPORT
    ↓
GATE
    ↓
STOP
```

The execution must be one controlled migration event.

---

# 10. FAILURE HANDLING

If the Expand migration raises an error:

1. capture the exact error;
2. capture migration progress/output where available;
3. determine whether the transaction rolled back;
4. inspect the resulting database state read-only;
5. compare actual state with pre-Expand baseline;
6. determine whether the migration artifact's transaction semantics protected the database;
7. STOP.

Do NOT automatically:

- rerun;
- partially repair;
- manually drop objects;
- manually recreate objects;
- alter the migration;
- execute rollback.

Rollback is governed by the already-approved rollback strategy and requires separate operational authorization unless the migration runbook explicitly authorizes it.

---

# 11. POST-EXPAND VALIDATION

Immediately after successful Expand execution, validate:

## Target objects

Confirm:

- 20 target enum contract definitions are present/handled according to ownership-safe rules;
- 18 target core tables are present;
- 23 transition columns are present and correct;
- 34 target indexes are present;
- 40 target foreign keys are present;
- 2 transition foreign keys are present;
- ownership registry is present and correctly populated.

## Legacy protection

Confirm all 18 protected legacy tables remain present.

No destructive change is permitted.

## Existing data

Confirm legacy baseline data remains preserved.

At minimum compare:

- total legacy row counts;
- critical table row counts;
- `order_items` remains 0 rows unless an unrelated authorized process changed it;
- no legacy data was deleted or truncated.

## Schema consistency

Validate:

- Target Schema Revision 4 alignment;
- Prisma schema alignment;
- migration object inventory alignment;
- enum ownership/protection alignment;
- rollback inventory alignment.

---

# 12. REQUIRED TESTS AFTER EXPAND

Run the authorized validation relevant to the Expand execution.

At minimum:

- `test_prompt_12_6_reconciliation.ts`
- `test_expand_safety.ts`

Run any additional post-Expand structural/reconciliation tests already defined by the migration runbook.

Do not modify tests to force a PASS.

Report actual observed results.

---

# 13. IMPORTANT DATA BOUNDARY

This authorization DOES NOT authorize:

- Backfill;
- data transformation;
- user PIN hashing;
- `user_code` population;
- Product → ProductVariant → InventoryItem data migration;
- OutletProduct → InventoryBalance backfill;
- stock opening balance population;
- any business-data conversion;
- Dual-write;
- Cutover;
- Contract/legacy retirement.

Those are future stages and require separate authorization.

Therefore after Expand:

```text
LEGACY DATA
    +
NEW TARGET STRUCTURES
```

is the expected conceptual state.

---

# 14. APPLICATION BOUNDARY

Do NOT change application read/write behavior as part of Expand.

Do NOT activate:

- new inventory write path;
- new payment write path;
- new order fulfillment path;
- dual-write;
- target-only read path;
- cutover routing.

The application remains on the existing behavioral path until separately authorized.

---

# 15. DATABASE SAFETY ATTESTATION

After execution, report actual facts:

- whether Expand executed;
- start/end time;
- migration result;
- commit/rollback state;
- exact target objects created;
- exact transition columns added;
- exact indexes/FKs created;
- legacy rows preserved;
- live enums altered or not;
- any errors;
- any unexpected changes.

Do not state "zero mutation" after this stage.

Expand is intentionally authorized to mutate schema.

---

# 16. EVIDENCE REQUIREMENTS

Capture:

- exact command executed;
- exact working directory;
- target database identity;
- migration directory;
- migration filename;
- execution timestamp;
- exit code;
- relevant stdout/stderr;
- pre/post structural checks;
- test outputs;
- final database baseline;
- backup reference.

Evidence must be sufficient for another reviewer to reconstruct what happened.

---

# 17. REQUIRED ARTIFACTS

After execution, create:

`/docs/validation/15_PROMPT_13_2_EXPAND_EXECUTION_EVIDENCE.md`

`/docs/validation/15_PROMPT_13_2_EXPAND_EXECUTION_FINAL_REPORT.md`

Do not create Backfill artifacts in this authorization.

---

# 18. FINAL GATE AFTER EXPAND

Possible outcomes:

## EXPAND EXECUTION — PASS

Only if:

- migration committed successfully;
- target objects match contract;
- legacy tables remain protected;
- legacy data remains intact;
- no unexpected schema drift exists;
- post-Expand validation passes;
- no unexplained errors remain.

## EXPAND EXECUTION — BLOCKED / OWNER REVIEW REQUIRED

If:

- migration failed;
- rollback state is uncertain;
- unexpected objects exist;
- legacy objects were affected unexpectedly;
- data integrity is uncertain;
- post-Expand validation fails;
- evidence is insufficient.

Do not interpret a partial migration as success.

---

# 19. STOP CONDITION

Regardless of result:

**STOP after Expand validation and final report.**

Do NOT proceed automatically to:

- Backfill;
- Dual-write;
- Cutover;
- Contract;
- Prompt 14+;
- any other migration phase.

The next stage requires a separate Owner Authorization.

---

# 20. OWNER AUTHORIZATION RECORD

| Authorization ID | Decision | Status |
|---|---|---|
| OAUTH-13.2-01 | Execute approved Expand migration against `pos_db` | **APPROVED** |

### Authorized execution target

`pos_db` — localhost:5432 — PostgreSQL 14.23

### Authorized migration

`20260919000000_expand_phase_ddl`

### Authorized phase

**EXPAND ONLY**

### Explicitly NOT authorized

- Backfill
- Dual-write
- Cutover
- Contract
- Prompt 14+
- ad-hoc migration fixes
- unrelated application/database changes

---

# 21. FINAL OWNER INSTRUCTION

The Project Owner explicitly authorizes Antigravity to execute the approved Expand migration under the exact scope and guardrails above.

After successful or failed Expand validation:

**STOP AND REPORT.**

No subsequent migration phase is authorized by this document.
