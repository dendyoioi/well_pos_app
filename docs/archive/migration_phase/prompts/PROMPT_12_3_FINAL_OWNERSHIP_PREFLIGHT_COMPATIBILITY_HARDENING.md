# PROMPT 12.3 — FINAL OWNERSHIP PREFLIGHT & COMPATIBILITY HARDENING

**Project:** Well POS Multi-Tenant SaaS Platform  
**Execution Stage:** Prompt 12.3 — Final Migration Artifact Safety Correction  
**Preceding Gate:** Prompt 12.2 = `BLOCKED / OWNER REVIEW REQUIRED`  
**Purpose:** Narrowly close the remaining executable-artifact blockers in Prompt 12.2 without redesigning the locked Target Database Schema Revision 4.

---

# 1. MISSION

Read and execute this prompt as a **NARROW FINAL CORRECTION + REVALIDATION**.

Prompt 12.2 established the ownership-registry concept and fail-closed direction, but Owner Review identified four remaining technical gaps:

1. Ownership registry lifecycle is itself not safely owned.
2. Existing tables can be classified as compatible without full structural compatibility verification.
3. Existing indexes are not fully preflighted for ownership/definition compatibility.
4. Existing columns are not fully preflighted for type/nullability/default/precision/scale semantics.

There is also one test/documentation inconsistency:

5. Prompt 12.2 reports validation of 10 legacy tables while the protected legacy inventory contains 18 legacy tables.

Prompt 12.3 must correct these issues only.

---

# 2. ABSOLUTE SAFETY RULES

DO NOT:

- run migration against staging;
- run migration against production;
- run `prisma migrate deploy`;
- run `prisma db push` against staging/production;
- execute Backfill;
- execute Dual-Write;
- execute Cutover;
- execute Contract;
- DROP legacy production tables;
- DROP legacy production columns;
- TRUNCATE;
- DELETE production data;
- start Prompt 13;
- modify Target Database Schema Revision 4;
- modify approved ADR decisions;
- invent schema fields;
- invent enums;
- redesign the migration architecture.

A disposable isolated LOCAL PostgreSQL database is allowed only for validation.

If used, explicitly identify it as disposable/local and report exactly what was executed.

---

# 3. SOURCE OF TRUTH

Use this hierarchy:

1. Existing source code + current schema
2. Approved ADR-001 through ADR-005
3. Locked Target Database Schema Revision 4
4. Prompt 11.3 Migration Readiness Report
5. Prompt 12 Owner Review
6. Prompt 12.1 Final Artifact Revalidation
7. Prompt 12.2 Final Revalidation + Object Ownership Inventory
8. This Prompt 12.3

If any generated artifact conflicts with Revision 4:

CORRECT THE ARTIFACT.

Do NOT modify Revision 4.

---

# 4. REQUIRED CORRECTIONS

Prompt 12.3 MUST close exactly these areas:

## C-01 — OWNERSHIP REGISTRY LIFECYCLE

The `_prompt_12_ownership_registry` is itself a database object.

It MUST NOT be blindly created with `CREATE TABLE IF NOT EXISTS` and later blindly dropped.

Required behavior:

### Registry absent

```text
ABSENT
→ Prompt 12 creates registry
→ ownership = CREATED_BY_PROMPT_12
→ rollback may remove registry at the very end
```

### Registry already exists

The migration MUST inspect and verify the registry structure before using it.

If exact-compatible:

```text
PRE_EXISTING_COMPATIBLE_REUSED
→ preserve on rollback
```

If incompatible:

```text
PRE_EXISTING_INCOMPATIBLE
→ abort before mutation
```

If ownership cannot be established:

```text
UNKNOWN
→ abort before mutation
```

The registry MUST NOT be allowed to become an ownership loophole.

Rollback must remove the registry ONLY if Prompt 12 itself created it.

Do not solve this by simply hardcoding a DROP at the end.

---

# 5. C-02 — FULL TARGET TABLE COMPATIBILITY

For every target table that already exists before Prompt 12:

DO NOT automatically classify it as compatible merely because the table name exists.

Perform a structural compatibility check sufficient to prove the target schema contract.

At minimum inspect:

- table existence
- required columns
- column data types
- nullability
- defaults where target requires them
- generated/identity behavior where applicable
- primary key
- unique constraints
- relevant foreign keys
- relevant check constraints
- relevant enum types
- relevant precision/scale
- target table-specific structural requirements

For example, an existing:

```text
inventory_items
```

must not be classified compatible merely because:

```text
pg_class.relname = 'inventory_items'
```

If the required Revision 4 structure is not proven:

```text
PRE_EXISTING_INCOMPATIBLE
or
UNKNOWN
```

and migration MUST abort before mutation.

Do not create a false positive compatibility classification.

---

# 6. C-03 — FULL COLUMN COMPATIBILITY

For every transition column already present on a legacy table, verify the relevant target contract.

At minimum compare:

- PostgreSQL data type
- enum type where applicable
- nullable / NOT NULL
- default expression where applicable
- numeric precision
- numeric scale
- character length where applicable
- generated/identity semantics where applicable

Examples:

```text
NUMERIC(15,2) NULL
```

must not be considered equivalent to:

```text
NUMERIC(10,0) NOT NULL
```

just because both report `udt_name = numeric`.

For enum columns:

- verify actual enum type
- verify allowed target vocabulary

For nullable target fields:

- do not incorrectly require NOT NULL

For target-required fields:

- do not accept nullable/incompatible definitions.

If compatibility cannot be proven:

```text
ABORT BEFORE MUTATION
```

---

# 7. C-04 — FULL INDEX COMPATIBILITY & OWNERSHIP

For every Prompt 12 index:

Inspect `pg_indexes` or equivalent PostgreSQL catalog metadata.

Determine:

### Case A — index absent

```text
CREATED_BY_PROMPT_12
→ create
```

### Case B — same name + exact compatible definition

```text
PRE_EXISTING_COMPATIBLE_REUSED
→ preserve on rollback
```

### Case C — same name + incompatible definition

```text
PRE_EXISTING_INCOMPATIBLE
→ abort
```

### Case D — equivalent definition under different name

Do NOT silently drop, rename, replace, or assume ownership.

Explicitly classify:

```text
PRE_EXISTING_COMPATIBLE_REUSED
```

only if equivalence is actually proven and the migration can safely avoid creating a duplicate.

Otherwise:

```text
UNKNOWN
→ abort
```

Compare the actual index definition, not merely index name.

Where relevant, verify:

- uniqueness
- indexed columns/order
- predicate for partial index
- expression
- included columns
- access method where material.

---

# 8. C-05 — FOREIGN KEY / CONSTRAINT COMPATIBILITY

Where Prompt 12 adds constraints/FKs to objects that may already exist:

- inspect actual catalog definitions;
- compare target semantics;
- reuse only if equivalent;
- abort on conflict;
- preserve reused constraints during rollback.

Do not use constraint name alone as proof.

If the current migration does not touch an existing constraint, document:

```text
NOT APPLICABLE
```

rather than inventing additional migration behavior.

---

# 9. C-06 — PROTECTED LEGACY TABLE TEST COVERAGE

Prompt 12.2 had an inconsistency:

- protected legacy inventory = 18 tables;
- one rollback test claimed only 10 legacy tables were verified.

Correct this.

The final validation MUST explicitly test or otherwise prove protection for all 18 protected legacy tables:

```text
tenants
outlets
users
products
categories
customers
orders
order_items
payments
shifts
subscription_plans
tenant_subscriptions
saas_invoices
saas_payments
platform_users
outlet_products
stock_movements
hold_orders
```

Expected:

```text
ALL 18 PRESERVED
```

No legacy table may be dropped, truncated, or deleted by Prompt 12 rollback.

---

# 10. OWNERSHIP REGISTRY SEMANTICS

The registry must distinguish:

```text
CREATED_BY_PROMPT_12
PRE_EXISTING_COMPATIBLE_REUSED
```

at minimum.

If useful, it may also retain:

```text
PRE_EXISTING_INCOMPATIBLE
UNKNOWN
```

for audit/reporting, but incompatible/unknown states must cause fail-closed behavior before mutation.

The registry must not falsely claim an object is `CREATED_BY_PROMPT_12`.

---

# 11. ROLLBACK RULES

Rollback must continue to obey:

```text
Prompt 12-created object
→ may remove

Pre-existing compatible object
→ MUST preserve

Pre-existing incompatible object
→ migration never proceeds

Unknown
→ migration never proceeds
```

For each rollback action, ownership must be deterministically established.

Do not rely on:

```sql
DROP ... IF EXISTS
```

as proof of ownership.

Do not use `CASCADE` for table rollback.

If an object cannot be safely attributed:

```text
BLOCKED / OWNER REVIEW REQUIRED
```

---

# 12. REQUIRED OBJECT OWNERSHIP INVENTORY UPDATE

Update:

```text
/docs/validation/10_PROMPT_12_2_OBJECT_OWNERSHIP_INVENTORY.md
```

or create a clearly versioned Prompt 12.3 inventory if repository convention requires it.

The inventory must explicitly document:

1. registry ownership;
2. table structural compatibility method;
3. column compatibility method;
4. index compatibility method;
5. constraint/FK compatibility method where applicable;
6. all 18 protected legacy tables;
7. no unknown objects.

If an object is not actually inspected by executable preflight, do not claim it was.

---

# 13. REQUIRED FINAL REVALIDATION REPORT

Create:

```text
/docs/validation/10_PROMPT_12_3_FINAL_REVALIDATION.md
```

It must contain:

## A. Previous gate

```text
Prompt 12.2 = BLOCKED / OWNER REVIEW REQUIRED
```

## B. Corrections

List C-01 through C-06.

## C. Executable artifact changes

List exact files changed.

## D. Ownership model

Explain registry, tables, columns, indexes, constraints.

## E. Compatibility validation

Explain exactly what catalog attributes are compared.

## F. Rollback validation

Explain exactly why pre-existing objects cannot be removed.

## G. Protected legacy tables

Show all 18 and their validation status.

## H. Safety tests

Include actual test results.

## I. Static scan

Review:

```text
DROP TABLE
DROP COLUMN
DROP TYPE
DROP INDEX
TRUNCATE
DELETE
CASCADE
IF EXISTS
IF NOT EXISTS
```

Every occurrence must be classified by context.

## J. Remaining risks

Only factual, verified risks.

## K. Final gate

Exactly:

```text
READY FOR OWNER REVIEW
```

or:

```text
BLOCKED / OWNER REVIEW REQUIRED
```

---

# 14. REQUIRED LOCAL TEST MATRIX

If disposable PostgreSQL is available, execute:

### Test 1 — Clean legacy database

Expected:

```text
migration succeeds
objects created
ownership recorded
rollback succeeds
created objects removed
legacy objects preserved
```

### Test 2 — Existing compatible registry

Expected:

```text
registry reused
registry preserved on rollback
```

### Test 3 — Existing incompatible registry

Expected:

```text
migration aborts before mutation
```

### Test 4 — Existing compatible target table

Expected:

```text
compatibility verified structurally
reused
preserved on rollback
```

### Test 5 — Existing incompatible target table

Expected:

```text
migration aborts before mutation
```

### Test 6 — Existing compatible column

Expected:

```text
reused
preserved
```

### Test 7 — Existing incompatible column

Expected:

```text
migration aborts
```

### Test 8 — Existing compatible index

Expected:

```text
reused/preserved
```

### Test 9 — Existing incompatible index

Expected:

```text
migration aborts
```

### Test 10 — Equivalent index under different name

Expected:

```text
explicit classification
no destructive replacement
```

### Test 11 — Rollback protection

Verify all 18 legacy tables remain.

### Test 12 — Pre-existing compatible enums

Expected:

```text
reused
preserved
```

### Test 13 — Incompatible enum

Expected:

```text
abort before mutation
```

If a scenario cannot be executed:

```text
NOT VERIFIED
```

Do not claim PASS.

---

# 15. STATIC VALIDATION

Run repository-appropriate checks such as:

- Prisma schema validation;
- TypeScript validation/typecheck;
- migration safety test;
- ownership preflight test;
- rollback safety test;
- destructive-operation scan.

Do not claim a check was run if it was not.

---

# 16. IMPORTANT: DO NOT OVER-CORRECT

Prompt 12.3 must NOT:

- redesign schema;
- change Product/Variant/Inventory architecture;
- change inventory ledger semantics;
- change UOM architecture;
- change tenant isolation architecture;
- add UserOutletAssignment;
- add synthetic PIN reset fields;
- introduce accounting double-entry;
- change OrderStatus/PaymentStatus semantics;
- start Backfill;
- start Dual-Write;
- start Cutover;
- start Contract.

This is an artifact safety correction only.

---

# 17. FINAL GATE DEFINITION

`READY FOR OWNER REVIEW` means:

> The executable Prompt 12 migration and rollback artifacts have a deterministic ownership model, full relevant compatibility preflight, and verified rollback preservation behavior, and are ready for Project Owner inspection.

It does NOT authorize:

- staging migration;
- production migration;
- backfill;
- dual-write;
- cutover;
- contract;
- Prompt 13.

If any of C-01 through C-06 remains unresolved:

```text
BLOCKED / OWNER REVIEW REQUIRED
```

---

# 18. FINAL RESPONSE

Return:

1. Final gate
2. C-01 through C-06 status
3. Exact files changed
4. Ownership registry behavior
5. Table/column/index compatibility behavior
6. Constraint/FK behavior
7. 18 legacy table protection result
8. Safety test results
9. Static validation results
10. Remaining risks
11. Explicit confirmation:

```text
NO STAGING/PRODUCTION MIGRATION EXECUTED
NO BACKFILL EXECUTED
NO DUAL-WRITE EXECUTED
NO CUTOVER EXECUTED
NO CONTRACT EXECUTED
PROMPT 13 NOT STARTED
```

Then STOP.

Do not continue automatically to another prompt.
