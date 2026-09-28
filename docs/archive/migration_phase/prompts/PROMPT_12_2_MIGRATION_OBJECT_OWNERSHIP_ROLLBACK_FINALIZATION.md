# PROMPT 12.2 — MIGRATION OBJECT OWNERSHIP & ROLLBACK FINALIZATION

**Project:** Well POS Multi-Tenant SaaS Platform  
**Execution Stage:** Prompt 12.2 — Final Migration Artifact Safety Correction  
**Preceding Gate:** Prompt 12.1 = `BLOCKED / OWNER REVIEW REQUIRED`  
**Purpose:** Finalize object ownership, fail-closed preflight behavior, and rollback safety before any real database migration is considered.

---

# 1. MISSION

Read and execute this prompt as a **NARROW ARTIFACT-LEVEL CORRECTION + REVALIDATION**.

The current blocker is:

> Prompt 12 migration artifacts use `IF NOT EXISTS` for object creation while rollback can still remove an object that was pre-existing or merely reused.

Prompt 12.2 must resolve this ownership problem without changing the locked Target Database Schema Revision 4.

This prompt is NOT permission to execute the migration.

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
- invent target schema fields;
- invent target enums;
- invent business rules;
- silently change approved ADR decisions.

A disposable isolated LOCAL database is allowed only for validation.

If a local database is used, explicitly identify it as disposable/local and report exactly what was executed.

---

# 3. SOURCE OF TRUTH

Use this hierarchy:

1. Existing source code + current schema
2. Approved ADR-001 through ADR-005
3. Locked Target Database Schema Revision 4
4. Prompt 11.3 Migration Readiness Report
5. Prompt 12 Owner Review
6. Prompt 12.1 Final Artifact Revalidation
7. This Prompt 12.2

If an artifact conflicts with Revision 4:

CORRECT THE ARTIFACT.

Do NOT modify Revision 4 to fit the artifact.

---

# 4. ROOT PROBLEM TO SOLVE

Current unsafe pattern:

```sql
CREATE TABLE IF NOT EXISTS ...
ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...
CREATE TYPE ...
```

combined with:

```sql
DROP TABLE IF EXISTS ...
DROP COLUMN IF EXISTS ...
DROP TYPE IF EXISTS ...
```

is insufficient because:

```text
OBJECT ABSENT
    ↓
Prompt 12 creates it
    ↓
rollback may safely remove it

OBJECT ALREADY EXISTS
    ↓
IF NOT EXISTS causes reuse / skip
    ↓
Prompt 12 did NOT create it
    ↓
rollback MUST NOT remove it
```

Prompt 12.2 must make this distinction deterministic.

---

# 5. REQUIRED STRATEGY — FAIL CLOSED ON UNKNOWN OWNERSHIP

For every object that Prompt 12 migration creates or alters, establish one of these states:

```text
CREATED_BY_PROMPT_12
PRE_EXISTING_COMPATIBLE_REUSED
PRE_EXISTING_INCOMPATIBLE
UNKNOWN
```

Required behavior:

### CREATED_BY_PROMPT_12

Migration may create/alter it.

Rollback may remove only the portion proven to have been created by Prompt 12.

### PRE_EXISTING_COMPATIBLE_REUSED

Migration may reuse it only if compatibility is explicitly verified.

Rollback MUST preserve it.

### PRE_EXISTING_INCOMPATIBLE

Migration must abort before mutation.

### UNKNOWN

Migration must abort before mutation.

There must be no silent fallback.

---

# 6. OBJECT CLASSES THAT MUST BE COVERED

Apply the ownership model to ALL objects touched by:

- `migration.sql`
- `rollback.sql`

At minimum:

### ENUM / TYPE

- all target enums
- legacy/reused enums
- enum labels altered by Prompt 12

### TABLE

- every newly created target table
- every legacy table touched by ALTER TABLE

### COLUMN

- every column added to legacy tables
- every column added to target tables if applicable

### INDEX

- every new index
- every unique index
- every partial unique index

### CONSTRAINT / FOREIGN KEY

- every foreign key added by Prompt 12
- every unique/check constraint created by Prompt 12

### EXTENSIONS / OTHER DATABASE OBJECTS

If migration touches any other PostgreSQL object, include it in the ownership inventory.

---

# 7. REQUIRED MIGRATION PREFLIGHT

Before any schema mutation, migration.sql must perform a deterministic preflight.

The preflight must inspect actual PostgreSQL catalog state:

- `pg_class`
- `pg_attribute`
- `pg_type`
- `pg_enum`
- `pg_indexes`
- relevant information-schema/catalog metadata

The exact catalog mechanism may follow PostgreSQL best practice.

The critical rule is:

> No ambiguous existing object may be silently reused.

For each object:

```text
ABSENT
  → eligible for creation

PRESENT + EXACTLY COMPATIBLE
  → explicitly classified as REUSED

PRESENT + INCOMPATIBLE
  → RAISE EXCEPTION

PRESENT + OWNERSHIP UNKNOWN
  → RAISE EXCEPTION
```

---

# 8. IMPORTANT: DO NOT USE `IF NOT EXISTS` AS THE OWNERSHIP MECHANISM

Do NOT claim the problem is solved merely by:

```sql
CREATE TABLE IF NOT EXISTS
```

or:

```sql
ADD COLUMN IF NOT EXISTS
```

Those statements may still hide an existing object.

If `IF NOT EXISTS` remains for idempotent syntax, it must only be used AFTER an explicit preflight has established that the object is compatible and intentionally reusable.

Prefer deterministic preflight + explicit create/alter behavior.

---

# 9. COLUMN OWNERSHIP

This is especially important for legacy tables.

For every Prompt 12 transition column such as:

- `users.user_code`
- `users.pin_hash`
- `products.type`
- `outlets.code`
- `orders.order_status`
- `orders.order_type`
- `orders.paid_amount`
- `orders.change_amount`
- `order_items.product_variant_id`
- etc.

the migration must distinguish:

```text
column absent
    → Prompt 12 may create it

column exists
    → inspect exact type/nullability/default/enum/FK semantics
       ↓
    compatible?
       ├── YES → classify PRE_EXISTING_COMPATIBLE_REUSED
       └── NO  → abort
```

Rollback must not drop a pre-existing compatible column.

---

# 10. INDEX OWNERSHIP

Do the same for indexes.

For every index:

- detect existing index;
- compare definition;
- if absent → Prompt 12 owns creation;
- if exact compatible definition exists → reused;
- if same name but incompatible definition → abort;
- if equivalent definition exists under a different name → do not silently create/drop; classify and document the situation.

Rollback may drop only indexes proven to have been created by Prompt 12.

---

# 11. FOREIGN KEY / CONSTRAINT OWNERSHIP

For every new FK or constraint:

1. inspect existing catalog state;
2. determine whether an equivalent constraint already exists;
3. if equivalent and intentionally reusable:
   - preserve it on rollback;
4. if conflicting:
   - abort;
5. if created by Prompt 12:
   - rollback may remove it.

Do not use a name-only check as the sole compatibility proof.

---

# 12. ENUM OWNERSHIP

Preserve the Prompt 12.1 enum safety correction.

For every enum:

### Case A — absent

Create exact Revision 4 enum.

Ownership:

```text
CREATED_BY_PROMPT_12
```

Rollback may remove it only if no Prompt 12-created object still depends on it.

### Case B — existing and exact-compatible

Reuse.

Ownership:

```text
PRE_EXISTING_COMPATIBLE_REUSED
```

Rollback MUST NOT drop it.

### Case C — existing but incompatible

Abort before mutation.

### Case D — ownership unknown

Abort.

Do not silently merge vocabularies.

---

# 13. ROLLBACK FINALIZATION

Rewrite rollback.sql so that it is an explicit inverse of what Prompt 12 actually created.

Rollback must satisfy:

```text
Prompt 12-created object
        ↓
may be removed

Pre-existing object
        ↓
MUST be preserved

Reused compatible object
        ↓
MUST be preserved

Unknown ownership
        ↓
MUST NOT be dropped
```

Do not rely solely on:

```sql
DROP ... IF EXISTS
```

for safety.

If deterministic ownership cannot be guaranteed by the migration itself, rollback must fail closed rather than guessing.

---

# 14. ROLLBACK ORDER

Respect PostgreSQL dependency order.

Where applicable:

1. dependent foreign keys/constraints
2. indexes
3. dependent tables
4. columns created by Prompt 12
5. newly created enum/type objects

Never drop a type while a pre-existing object depends on it.

Never use `CASCADE` as a shortcut if it can remove an object not owned by Prompt 12.

If `CASCADE` is necessary, prove the dependency set is entirely Prompt 12-owned.

Otherwise:

```text
BLOCKED / OWNER REVIEW REQUIRED
```

---

# 15. OBJECT OWNERSHIP INVENTORY

Create/update:

```text
/docs/validation/10_PROMPT_12_2_OBJECT_OWNERSHIP_INVENTORY.md
```

It must contain one row for every object touched.

Required columns:

| Object | Type | Pre-existing | Compatibility | Ownership | Migration Action | Rollback Action | Verification |
|---|---|---:|---|---|---|---|---|

Allowed Ownership values:

```text
CREATED_BY_PROMPT_12
PRE_EXISTING_COMPATIBLE_REUSED
PRE_EXISTING_INCOMPATIBLE
UNKNOWN
```

Any `UNKNOWN` object blocks readiness.

---

# 16. REQUIRED SAFETY TESTS

Create/update static or isolated-local tests for:

### Test A — absent object

Expected:

```text
created
ownership = CREATED_BY_PROMPT_12
rollback = removable
```

### Test B — compatible pre-existing object

Expected:

```text
reused
ownership = PRE_EXISTING_COMPATIBLE_REUSED
rollback = preserved
```

### Test C — incompatible pre-existing object

Expected:

```text
migration aborts
no schema mutation
```

### Test D — same object name, different definition

Expected:

```text
migration aborts
```

### Test E — equivalent index under different name

Expected:

```text
no silent destruction
no blind reuse
explicit classification / owner review if ambiguous
```

### Test F — pre-existing enum

Expected:

```text
compatible → reuse + preserve on rollback
incompatible → abort
```

### Test G — rollback

Expected:

```text
Prompt 12-created objects → removable
pre-existing objects → preserved
reused objects → preserved
unknown objects → never dropped
```

### Test H — legacy tables

Verify:

```text
users
products
orders
order_items
payments
outlets
tenants
stock_movements
outlet_products
```

are never dropped by Prompt 12 rollback.

---

# 17. REQUIRED REVALIDATION OF ALL ARTIFACTS

Review and correct, where necessary:

1. `migration.sql`
2. `rollback.sql`
3. `schema.prisma`
4. `10_PROMPT_12_SCHEMA_DIFF.md`
5. `10_PROMPT_12_EXPAND_PLAN.md`
6. `10_PROMPT_12_BACKFILL_DESIGN.md`
7. `10_PROMPT_12_RECONCILIATION_PLAN.md`
8. `10_PROMPT_12_EXECUTION_GUARDRAILS.md`
9. `10_PROMPT_12_CORRECTION_REVALIDATION.md`
10. `10_PROMPT_12_1_FINAL_ARTIFACT_REVALIDATION.md`
11. migration safety tests
12. backfill scaffolding
13. reconciliation scripts

Do not merely modify the report.

Executable artifacts must actually match the ownership model.

---

# 18. STATIC SAFETY SCAN

Run a destructive-operation scan against migration and rollback artifacts.

At minimum search for:

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

Every match must be classified as:

```text
SAFE
JUSTIFIED
BLOCKED
OWNER REVIEW REQUIRED
```

Do not automatically classify these keywords as safe or unsafe without reviewing their context.

---

# 19. LOCAL VALIDATION

A disposable isolated LOCAL PostgreSQL database may be used.

Recommended test matrix:

```text
Scenario 1:
Clean database
→ migration
→ inspect
→ rollback

Scenario 2:
Pre-existing compatible enum
→ migration
→ rollback
→ enum preserved

Scenario 3:
Pre-existing incompatible enum
→ migration
→ expected abort
→ verify no mutation

Scenario 4:
Pre-existing compatible table/object
→ migration
→ verify reused
→ rollback
→ verify preserved

Scenario 5:
Pre-existing incompatible table/object
→ migration
→ expected abort

Scenario 6:
Equivalent pre-existing index
→ migration
→ verify no destructive replacement
```

If these tests are not executed, mark:

```text
NOT VERIFIED
```

Do not claim PASS.

---

# 20. REQUIRED FINAL REPORT

Create:

```text
/docs/validation/10_PROMPT_12_2_FINAL_REVALIDATION.md
```

It must contain:

1. Previous Prompt 12.1 gate
2. Root cause
3. Correction strategy
4. Object ownership model
5. Migration preflight
6. Rollback strategy
7. Object ownership inventory reference
8. Safety tests
9. Local validation, if any
10. Static scan results
11. Remaining blockers
12. Final gate

Use only:

```text
PASS
BLOCKED
OWNER REVIEW REQUIRED
NOT VERIFIED
NOT APPLICABLE
```

---

# 21. FINAL GATE

Return exactly one:

```text
READY FOR OWNER REVIEW
```

or:

```text
BLOCKED / OWNER REVIEW REQUIRED
```

`READY FOR OWNER REVIEW` means:

> The Prompt 12 migration artifacts have a deterministic ownership model and rollback behavior and are ready for Project Owner inspection.

It does NOT mean:

- migration approved;
- staging approved;
- production approved;
- migration executed;
- backfill executed;
- dual-write executed;
- cutover approved;
- contract approved.

If any object remains ambiguous or any rollback path can remove a pre-existing/reused object:

```text
BLOCKED / OWNER REVIEW REQUIRED
```

---

# 22. FINAL RESPONSE

Return:

1. Final gate
2. Root cause corrected
3. Corrections performed
4. Exact artifact paths
5. Object ownership summary
6. Static safety scan
7. Validation performed + results
8. Remaining blockers/risks
9. Explicit confirmation:

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
