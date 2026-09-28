# PROMPT 12.1 — FINAL ARTIFACT SAFETY CORRECTION & REVALIDATION

**Project:** Well POS Multi-Tenant SaaS Platform  
**Execution Stage:** Prompt 12.1 — Final Artifact Safety Correction  
**Preceding Gate:** Prompt 12 Correction & Revalidation = `READY FOR OWNER REVIEW`  
**Purpose:** Final narrow correction of Prompt 12 implementation artifacts before Project Owner re-review.

---

## 1. MISSION

Read and execute this prompt as a **FINAL ARTIFACT-LEVEL CORRECTION + REVALIDATION**.

This is NOT a database migration.

The purpose is to correct only the remaining issues identified during Project Owner review of the Prompt 12 package:

1. Enum collision / compatibility safety
2. Order status consistency
3. Rollback safety and ownership of created objects
4. Static revalidation of the corrected package

Do not redesign Target Database Schema Revision 4.

---

## 2. ABSOLUTE SAFETY RULES

DO NOT:

- run migration against staging;
- run migration against production;
- run `prisma migrate deploy`;
- run `prisma db push` against staging/production;
- execute Backfill;
- execute Dual-Write;
- execute Cutover;
- execute Contract;
- drop legacy production tables;
- drop legacy production columns;
- truncate;
- delete production data;
- start Prompt 13;
- modify the locked Target Database Schema Revision 4;
- invent new target fields, enums, relationships, or business rules.

A disposable isolated LOCAL database is permitted only if genuinely required for syntax/behavior validation. If used, explicitly identify it and ensure it is not staging or production.

---

## 3. SOURCE OF TRUTH

Use this hierarchy:

1. Existing source code + current database/schema
2. Approved ADR-001 through ADR-005
3. Approved Target Database Schema Revision 4
4. Approved Prompt 11.3 Migration Readiness Report
5. Prompt 12 Owner Review
6. Prompt 12 Correction & Revalidation
7. This Prompt 12.1

If an artifact conflicts with Revision 4, correct the artifact.

Do not change Revision 4 to fit an artifact.

---

# 4. REQUIRED CORRECTION A — ENUM COLLISION & COMPATIBILITY SAFETY

## Problem

The current Expand migration uses an `IF NOT EXISTS` / `ALTER TYPE ... ADD VALUE IF NOT EXISTS` strategy.

That is insufficient by itself because an existing PostgreSQL enum with the same type name may have incompatible labels.

Example:

```text
Existing legacy enum:
PaymentStatus
  PAID
  CANCELLED
  REFUNDED

Target enum:
PaymentStatus
  UNPAID
  PARTIALLY_PAID
  PAID
  PARTIALLY_REFUNDED
  REFUNDED
```

Do NOT silently merge these vocabularies.

## Required behavior

For every target enum whose PostgreSQL type name may already exist:

1. Detect whether the type exists.
2. If it does not exist:
   - create the exact Revision 4 enum.
3. If it exists:
   - inspect its existing labels.
   - verify compatibility with the locked Revision 4 vocabulary.
4. If existing labels are incompatible:
   - ABORT the migration artifact execution path before destructive or ambiguous changes.
   - emit a clear error explaining the enum collision.
   - do not silently add target labels to an incompatible enum.
5. If existing labels are compatible:
   - allow only the deterministic additive operation required by the target.
   - document exactly what compatibility means.
6. Never silently delete or rename legacy enum labels during Expand.

The corrected artifact must be deterministic and fail-safe.

### Important

Do not solve this by merely doing:

```sql
IF NOT EXISTS (...)
CREATE TYPE ...
```

followed by:

```sql
ALTER TYPE ... ADD VALUE IF NOT EXISTS ...
```

unless the artifact first proves that the existing enum is compatible.

If PostgreSQL transaction limitations make an exact compatibility-safe enum migration impractical, the migration must **fail closed** and require Owner Review rather than silently proceeding.

---

# 5. REQUIRED CORRECTION B — ORDER STATUS CONSISTENCY

The current Prompt 12 artifacts contain an inconsistency around the default `order_status`.

One artifact/document states:

```text
DEFAULT 'COMPLETED'
```

while the current migration artifact has been observed using:

```text
DEFAULT 'CONFIRMED'
```

This must be resolved against the exact locked Target Database Schema Revision 4.

## Required work

Inspect:

- `server/prisma/schema.prisma`
- `migration.sql`
- Schema Diff
- Expand Plan
- Backfill Design
- Reconciliation Plan
- any relevant migration tests

Then select the value that is actually specified by Target Database Schema Revision 4.

Do NOT choose based on preference.

After determining the Revision 4 value:

- make Prisma schema consistent;
- make migration.sql consistent;
- make rollback consistent;
- make Schema Diff consistent;
- make Expand Plan consistent;
- make Backfill Design consistent;
- make reconciliation/tests consistent where applicable.

There must be exactly one authoritative target meaning.

### Legacy payment-status transition

Do not silently reinterpret legacy values.

Document the mapping from the actual legacy enum/value set to the target `OrderStatus` and `PaymentStatus`.

If an actual legacy value cannot be mapped deterministically:

```text
BLOCKED / OWNER REVIEW REQUIRED
```

must be the result.

---

# 6. REQUIRED CORRECTION C — ROLLBACK SAFETY

## Problem

The current rollback artifact uses patterns such as:

```sql
DROP TABLE IF EXISTS ...
DROP TYPE IF EXISTS ...
```

This is not sufficient protection if an object already existed before Prompt 12.

Rollback must not accidentally destroy a legacy object.

## Required rollback model

The Expand migration must be able to establish which objects it actually created.

For every newly created object:

- enum/type
- table
- index
- foreign key
- transition column

the rollback must only remove objects that were created by this Expand migration.

### Required behavior

If a target object already exists before migration:

- do not assume ownership;
- do not blindly drop it during rollback;
- either:
  1. fail closed before mutation, or
  2. use an explicit deterministic ownership/preflight mechanism.

The safest acceptable pattern is:

```text
PRE-FLIGHT
    ↓
object absent?
    ├── YES → migration may create it
    └── NO  → verify exact compatibility/ownership
                 ├── compatible + explicitly reusable
                 │      → document as reused, do NOT drop on rollback
                 └── incompatible/unknown
                        → ABORT
```

Rollback must distinguish:

```text
CREATED BY THIS MIGRATION
```

from:

```text
PRE-EXISTING / REUSED
```

A rollback must NEVER blindly drop a pre-existing object.

### Legacy columns

Do not use rollback to remove unrelated legacy columns that existed before Prompt 12.

Prompt 12 is Expand.

If a column was created by Prompt 12, rollback may remove that newly-created column only if its ownership is deterministically established.

---

# 7. REQUIRED CORRECTION D — EXPAND/ROLLBACK OBJECT INVENTORY

Create or update an explicit machine-readable or clearly structured inventory containing:

| Object | Type | Pre-existing? | Created by Prompt 12? | Reused? | Rollback Action |
|---|---|---:|---:|---:|---|
| ... | ENUM/TABLE/INDEX/COLUMN | ... | ... | ... | ... |

This inventory must cover all objects touched by:

- `migration.sql`
- `rollback.sql`

It must identify any object that cannot be proven safe.

If an object cannot be classified safely:

```text
OWNER REVIEW REQUIRED
```

---

# 8. REQUIRED CORRECTION E — STATIC SAFETY TESTS

Add/update safety validation for at least:

### Enum tests

- existing incompatible enum causes abort;
- existing compatible enum is handled deterministically;
- no silent enum vocabulary merge;
- no invented enum values;
- Revision 4 enum labels remain exact.

### Order tests

- Prisma target default matches migration default;
- Expand Plan matches migration;
- Backfill mapping matches target enums;
- legacy payment status mapping is explicit.

### Rollback tests

- rollback does not blindly drop pre-existing enums;
- rollback does not blindly drop pre-existing tables;
- rollback does not blindly remove unrelated legacy columns;
- created-vs-reused ownership is explicit;
- destructive rollback is blocked when ownership is unknown.

---

# 9. REQUIRED CORRECTION F — REVALIDATE ALL EXISTING PROMPT 12 ARTIFACTS

Recheck at minimum:

1. `migration.sql`
2. `rollback.sql`
3. `schema.prisma`
4. `10_PROMPT_12_SCHEMA_DIFF.md`
5. `10_PROMPT_12_EXPAND_PLAN.md`
6. `10_PROMPT_12_BACKFILL_DESIGN.md`
7. `10_PROMPT_12_RECONCILIATION_PLAN.md`
8. `10_PROMPT_12_EXECUTION_GUARDRAILS.md`
9. Prompt 12 correction/revalidation report
10. migration safety tests
11. backfill scaffolding
12. reconciliation scripts

Do not merely update documentation.

The executable artifacts and tests must actually be consistent.

---

# 10. REQUIRED VALIDATION

Allowed:

- Prisma schema validation
- TypeScript typecheck
- SQL syntax validation
- lint
- static analysis
- migration artifact inspection
- destructive-operation scan
- enum consistency scan
- unit/static tests
- disposable isolated LOCAL database testing, if necessary

Not allowed:

- staging migration
- production migration
- production backfill
- dual-write
- cutover
- contract

Do not claim validation that was not actually performed.

---

# 11. REQUIRED NEW DOCUMENT

Create:

```text
/docs/validation/10_PROMPT_12_1_FINAL_ARTIFACT_REVALIDATION.md
```

It must contain:

1. Previous Prompt 12.0 gate
2. Finding A — enum collision safety
3. Finding B — order status consistency
4. Finding C — rollback safety
5. Finding D — object ownership inventory
6. Finding E — static safety tests
7. Artifact/path changed
8. Validation performed
9. Validation result
10. Remaining blockers/risks
11. Final gate

Use only these status values:

```text
PASS
BLOCKED
OWNER REVIEW REQUIRED
NOT VERIFIED
NOT APPLICABLE
```

---

# 12. FINAL GATE

Return exactly one of:

```text
READY FOR OWNER REVIEW
```

or:

```text
BLOCKED / OWNER REVIEW REQUIRED
```

`READY FOR OWNER REVIEW` means only:

> Prompt 12.1 artifacts have been corrected and are ready for Project Owner inspection.

It does NOT mean:

- database migration approved;
- staging migration approved;
- production migration approved;
- migration executed;
- backfill executed;
- dual-write approved;
- cutover approved;
- contract approved.

If any unresolved blocker remains, return:

```text
BLOCKED / OWNER REVIEW REQUIRED
```

---

# 13. FINAL RESPONSE FORMAT

Return:

1. Final gate
2. Short summary of corrections
3. Exact artifact inventory/path list
4. Validation performed + results
5. Remaining risks/blockers
6. Explicit confirmation:

```text
NO STAGING/PRODUCTION MIGRATION EXECUTED
NO BACKFILL EXECUTED
NO DUAL-WRITE EXECUTED
NO CUTOVER EXECUTED
NO CONTRACT EXECUTED
PROMPT 13 NOT STARTED
```

Then STOP.

Do not automatically continue to Prompt 13.
