# PROMPT 12.4 — FINAL MIGRATION OBJECT INVENTORY & CONTRACT ALIGNMENT

**Project:** Well POS Multi-Tenant SaaS Platform  
**Execution Stage:** Prompt 12.4 — Final Expand Artifact Contract Alignment  
**Preceding Gate:** Prompt 12.3 = `BLOCKED / OWNER REVIEW REQUIRED`  
**Purpose:** Final, narrow executable-artifact correction. Align the complete actual migration object set, ownership inventory, preflight checks, and rollback behavior before any real database migration.

---

# 1. MISSION

Prompt 12.4 is NOT a database redesign.

It exists only to close the remaining executable-artifact gaps identified during Owner Review of Prompt 12.3:

1. Complete target-table structural contract validation.
2. Complete transition-column semantic validation, including nullability and defaults where applicable.
3. Complete index definition validation for EVERY index actually created/touched by migration.sql.
4. Reconcile the actual migration object inventory against:
   - ownership registry;
   - preflight;
   - rollback;
   - documentation.
5. Eliminate any discrepancy between the reported number of indexes and the actual migration.
6. Ensure every object touched by Prompt 12 has deterministic ownership or is explicitly fail-closed.
7. Ensure rollback can only remove objects actually created by Prompt 12.

Do not introduce new architecture.

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
6. Prompt 12.1 Final Revalidation
7. Prompt 12.2 Final Revalidation + Object Ownership Inventory
8. Prompt 12.3 Final Revalidation + Object Ownership Inventory
9. This Prompt 12.4

If any generated artifact conflicts with Revision 4:

CORRECT THE ARTIFACT.

Never modify Revision 4 to accommodate an artifact.

---

# 4. CORE INVARIANT

The following sets MUST reconcile exactly:

```text
ACTUAL MIGRATION OBJECTS
        =
PREFLIGHT-CHECKED OBJECTS
        =
OWNERSHIP-REGISTERED OBJECTS
        =
ROLLBACK-CONTROLLED OBJECTS
        =
DOCUMENTED OBJECT INVENTORY
```

No hidden objects.

No undocumented objects.

No object may be created by migration.sql without deterministic ownership.

No object may be removed by rollback.sql without deterministic ownership.

---

# 5. REQUIRED OBJECT DISCOVERY

Do not rely only on manually maintained lists.

Build or execute a deterministic discovery step over `migration.sql` and/or the isolated local PostgreSQL database to identify every object Prompt 12 creates or alters.

At minimum classify:

### TYPES / ENUMS

Every `CREATE TYPE`.

### TABLES

Every `CREATE TABLE`.

### COLUMNS

Every `ALTER TABLE ... ADD COLUMN`.

### INDEXES

Every:

```sql
CREATE INDEX
CREATE UNIQUE INDEX
CREATE INDEX IF NOT EXISTS
CREATE UNIQUE INDEX IF NOT EXISTS
```

### CONSTRAINTS / FOREIGN KEYS

Every:

```sql
PRIMARY KEY
UNIQUE
FOREIGN KEY
CHECK
```

created or altered by Prompt 12.

### OTHER OBJECTS

Any sequence, function, trigger, extension, view, materialized view, schema, or other PostgreSQL object touched by migration.

If any object category is not touched:

```text
NOT APPLICABLE
```

Do not invent objects.

---

# 6. OBJECT COUNT RECONCILIATION

The previous Prompt 12.3 artifacts reported:

- 20 enums
- 18 target tables
- 23 transition columns
- 18 target indexes
- 18 legacy tables
- 1 registry

while the actual migration was observed to contain more index creation statements.

Prompt 12.4 MUST determine the exact actual number.

Do not assume 18.

Do not assume 34.

Calculate from the executable artifact.

Produce:

```text
Actual migration object count
Preflight object count
Ownership registry count
Rollback-controlled object count
Documentation inventory count
```

For each category:

```text
MATCH
```

or:

```text
MISMATCH
```

Any mismatch blocks readiness.

---

# 7. TARGET TABLE CONTRACT — FULL STRUCTURAL VALIDATION

For every target table that already exists before migration, validate the complete Revision 4 contract relevant to that table.

At minimum compare:

- table existence;
- exact required column set;
- unexpected columns only if they affect compatibility;
- column data type;
- enum type;
- nullability;
- default expression where target defines one;
- numeric precision;
- numeric scale;
- character length;
- primary key;
- unique constraints;
- relevant foreign keys;
- relevant check constraints;
- generated/identity behavior where applicable.

Do not accept:

```text
table exists
+ PK exists
+ subset of columns match
= compatible
```

Compatibility must represent the actual target contract.

If a pre-existing target table has an incompatible structure:

```text
RAISE EXCEPTION
ABORT BEFORE MUTATION
```

If the contract cannot be proven:

```text
UNKNOWN
ABORT BEFORE MUTATION
```

---

# 8. TARGET TABLE CONTRACT SOURCE

Do not invent the expected table contract manually from memory.

Derive expected target definitions from:

```text
04_TARGET_DATABASE_SCHEMA(3).md
```

and, where applicable, the generated:

```text
schema.prisma
```

The migration must not silently redefine the target contract.

---

# 9. TRANSITION COLUMN SEMANTIC VALIDATION

For EVERY transition column touched by Prompt 12:

Compare actual vs target:

- PostgreSQL type;
- enum type;
- nullable / NOT NULL;
- default expression;
- numeric precision;
- numeric scale;
- character length;
- generated/identity semantics where applicable.

Examples:

```text
NUMERIC(15,2) NULL
```

is not equivalent to:

```text
NUMERIC(10,0) NOT NULL
```

Do not merely inspect `udt_name`.

If target has a required default such as:

```text
order_status DEFAULT 'CONFIRMED'
```

an incompatible existing default must cause:

```text
ABORT BEFORE MUTATION
```

If target intentionally has no default, do not invent one.

---

# 10. INDEX CONTRACT — EVERY ACTUAL INDEX

For EVERY index actually created/touched by migration.sql:

Validate:

- index name;
- target relation/table;
- uniqueness;
- indexed columns and order;
- expression indexes where applicable;
- predicate for partial indexes;
- included columns where applicable;
- access method where relevant.

Use PostgreSQL catalog data such as:

- `pg_class`
- `pg_index`
- `pg_attribute`
- `pg_indexes`
- `pg_get_indexdef()`

Do not use only:

```text
index name
+
is_unique
+
table name
```

as the compatibility test.

For existing index:

### Exact equivalent

```text
PRE_EXISTING_COMPATIBLE_REUSED
```

### Same name but different definition

```text
PRE_EXISTING_INCOMPATIBLE
→ abort
```

### Equivalent definition under another name

Do not silently replace it.

If migration can safely reuse it:

```text
PRE_EXISTING_COMPATIBLE_REUSED
```

Otherwise:

```text
UNKNOWN
→ abort
```

---

# 11. INDEX INVENTORY MUST MATCH EXECUTABLE MIGRATION

Every actual index creation statement must have exactly one corresponding ownership/preflight/rollback policy.

Example:

```text
migration.sql
   ↓
idx_A
   ↓
preflight idx_A
   ↓
ownership idx_A
   ↓
rollback policy idx_A
   ↓
inventory idx_A
```

No exception.

If migration creates 34 indexes, inventory must account for all 34.

If migration creates 18, inventory must account for all 18.

The number must come from executable reality.

---

# 12. ROLLBACK OWNERSHIP

For every object rollback can remove:

```text
ownership = CREATED_BY_PROMPT_12
```

must be proven.

Rollback MUST NOT use object existence alone as permission to drop.

For every dynamic rollback statement, establish:

```text
object exists
AND
ownership registry says CREATED_BY_PROMPT_12
AND
object belongs to Prompt 12 object class
```

Otherwise:

```text
DO NOT DROP
```

For indexes automatically removed with Prompt 12-created tables, explicitly document this dependency.

Do not claim separate index rollback ownership unless it is actually registered.

---

# 13. LEGACY TABLE PROTECTION

The 18 legacy tables remain strictly protected:

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

Prompt 12.4 must continue to verify:

```text
DROP TABLE
TRUNCATE
DELETE
```

cannot destroy legacy baseline data.

Transition columns may be removed only when they were created by Prompt 12.

---

# 14. CONSTRAINT / FK RECONCILIATION

Discover all constraints/FKs actually created by migration.sql.

For each:

- include in object inventory;
- determine ownership;
- validate target semantics;
- establish rollback behavior.

If constraints are created as part of a target table creation and cannot exist independently, document the dependency.

If existing constraints are reused, preserve them.

If an existing constraint conflicts with target semantics:

```text
ABORT BEFORE MUTATION
```

---

# 15. OWNERSHIP REGISTRY

The registry must itself be governed by the same invariant.

If registry absent:

```text
CREATE
ownership = CREATED_BY_PROMPT_12
```

If registry exists:

```text
validate complete registry contract
```

Compatible:

```text
PRE_EXISTING_COMPATIBLE_REUSED
```

Incompatible:

```text
ABORT
```

Rollback:

```text
DROP registry ONLY if CREATED_BY_PROMPT_12
```

The registry must not be used as an authority to delete an object whose actual database identity/definition no longer matches the recorded ownership.

Where practical, ownership records should contain enough identifying information to prevent stale ownership from causing destructive rollback.

---

# 16. OWNERSHIP INVENTORY UPDATE

Update:

```text
/docs/validation/10_PROMPT_12_4_OBJECT_OWNERSHIP_INVENTORY.md
```

The inventory MUST be generated/reconciled from executable reality.

Required columns:

| Object | Type | Source Statement | Pre-existing | Compatibility Method | Ownership | Preflight Check | Rollback Action | Verification |
|---|---|---|---:|---|---|---|---|---|

Include every touched object.

Do not exclude indexes.

Do not exclude constraints.

Do not exclude the ownership registry.

Do not count protected legacy tables as Prompt 12-created objects, but list them in a separate protected section.

---

# 17. REQUIRED OBJECT RECONCILIATION REPORT

Create:

```text
/docs/validation/10_PROMPT_12_4_OBJECT_RECONCILIATION.md
```

Include:

```text
CATEGORY
ACTUAL
PREFLIGHT
OWNERSHIP
ROLLBACK
DOCUMENTED
STATUS
```

For example:

```text
ENUM
20
20
20
20
20
MATCH

TABLE
19
19
19
19
19
MATCH

COLUMN
23
23
23
23
23
MATCH

INDEX
??
??
??
??
??
MATCH / MISMATCH
```

Do not fill `??` from previous reports.

Calculate it.

---

# 18. REQUIRED TEST MATRIX

Run against a disposable isolated LOCAL PostgreSQL database where possible.

### Test 1 — Clean legacy database

Migration:

```text
PASS
```

Rollback:

```text
PASS
```

18 legacy tables remain.

### Test 2 — Compatible registry

Expected:

```text
reuse
preserve
```

### Test 3 — Incompatible registry

Expected:

```text
abort before mutation
```

### Test 4 — Incompatible target table column

Expected:

```text
abort before mutation
```

### Test 5 — Missing target table contract field

Expected:

```text
abort before mutation
```

### Test 6 — Nullability mismatch

Expected:

```text
abort before mutation
```

### Test 7 — Default mismatch

Expected:

```text
abort before mutation
```

### Test 8 — Numeric precision/scale mismatch

Expected:

```text
abort before mutation
```

### Test 9 — Existing index exact match

Expected:

```text
reuse + preserve
```

### Test 10 — Existing index same name but different definition

Expected:

```text
abort
```

### Test 11 — Existing equivalent index under different name

Expected:

```text
explicit classification
no destructive replacement
```

### Test 12 — All actual migration indexes inventoried

Expected:

```text
100% coverage
```

### Test 13 — Rollback

Expected:

```text
only Prompt 12-created objects removed
all pre-existing objects preserved
```

### Test 14 — All 18 legacy tables

Expected:

```text
18/18 preserved
```

If any scenario cannot be executed:

```text
NOT VERIFIED
```

Never claim PASS.

---

# 19. STATIC SAFETY SCAN

Scan executable artifacts for:

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

Every occurrence must have a contextual classification:

```text
SAFE
JUSTIFIED
BLOCKED
OWNER REVIEW REQUIRED
```

Also specifically verify:

```text
No DROP TABLE ... CASCADE
No TRUNCATE
No production DELETE
No legacy table DROP
```

---

# 20. ARTIFACT CONSISTENCY CHECK

Review:

1. migration.sql
2. rollback.sql
3. schema.prisma
4. Prompt 12 schema diff
5. Expand plan
6. Backfill design
7. Reconciliation plan
8. Execution guardrails
9. Prompt 12.1 report
10. Prompt 12.2 report
11. Prompt 12.3 report
12. Prompt 12.3 ownership inventory
13. Prompt 12.4 ownership inventory
14. safety tests

Where documentation conflicts with executable artifacts:

```text
EXECUTABLE ARTIFACT = ACTUAL
DOCUMENTATION = MUST BE CORRECTED
```

Do not leave conflicting counts.

---

# 21. IMPORTANT: NO SCOPE CREEP

Prompt 12.4 MUST NOT:

- change Product/Variant/Inventory architecture;
- change inventory ledger semantics;
- change UOM architecture;
- change tenant isolation;
- add UserOutletAssignment;
- add PIN reset fields;
- change OrderStatus/PaymentStatus;
- execute Backfill;
- execute Dual-Write;
- execute Cutover;
- execute Contract;
- start Prompt 13.

This is only final Expand artifact contract alignment.

---

# 22. FINAL REPORT

Create:

```text
/docs/validation/10_PROMPT_12_4_FINAL_REVALIDATION.md
```

Include:

1. Previous gate
2. Remaining blockers from Prompt 12.3
3. Corrections performed
4. Actual object discovery
5. Object count reconciliation
6. Full target table contract validation
7. Full column semantic validation
8. Full index definition validation
9. Constraint/FK inventory
10. Ownership registry validation
11. Rollback validation
12. 18 legacy table protection
13. Test matrix
14. Static scan
15. Remaining risks
16. Final gate

Allowed final gate:

```text
READY FOR OWNER REVIEW
```

or:

```text
BLOCKED / OWNER REVIEW REQUIRED
```

---

# 23. FINAL GATE DEFINITION

`READY FOR OWNER REVIEW` means:

> The executable migration, preflight, ownership registry, rollback, object inventory, and validation evidence are internally consistent and every actual migration object has deterministic ownership and compatibility handling.

It does NOT authorize:

- staging migration;
- production migration;
- Backfill;
- Dual-Write;
- Cutover;
- Contract;
- Prompt 13.

Any mismatch in:

```text
actual objects
vs
preflight
vs
ownership
vs
rollback
vs
documentation
```

means:

```text
BLOCKED / OWNER REVIEW REQUIRED
```

---

# 24. FINAL RESPONSE

Return:

1. Final gate
2. Actual object counts by category
3. Reconciliation result
4. C-01 through C-06 status
5. Exact files changed
6. Full table compatibility result
7. Full column semantic result
8. Full index coverage result
9. Constraint/FK result
10. Ownership registry result
11. Rollback result
12. 18 legacy table protection result
13. Test matrix results
14. Static scan results
15. Remaining risks
16. Explicit confirmation:

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
