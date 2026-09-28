# PROMPT 12.4.3 — ENUM OWNERSHIP PROVENANCE & RERUN HARDENING

## Execution Stage

Prompt 12.4.3 — Enum Ownership Provenance & Rerun Hardening

## Preceding Gate

Prompt 12.4.2 was reviewed as:

**BLOCKED / OWNER REVIEW REQUIRED**

Reason identified during owner review:

> Enum contract and fail-closed compatibility are hardened, but registry ownership provenance can be overwritten on rerun when an enum created by this migration is later observed as an exact-compatible pre-existing enum.

This prompt addresses ONLY that provenance/rerun issue.

---

# 1. OBJECTIVE

Harden enum ownership so that:

1. ownership represents historical provenance, not merely current catalog state;
2. an enum created by this migration remains migration-owned across safe reruns;
3. a genuinely pre-existing enum remains pre-existing;
4. rerun behavior cannot silently convert:
   - `OWNED` → `PRE_EXISTING`;
5. rollback can reliably determine which enums this migration is authorized to drop;
6. registry/object mismatches fail closed;
7. stale, missing, or contradictory ownership records cannot cause destructive rollback;
8. exact enum contract validation from Prompt 12.4.2 remains unchanged.

The invariant is:

```text
ENUM CATALOG STATE
+
ENUM OWNERSHIP PROVENANCE
+
REGISTRY
+
ROLLBACK AUTHORIZATION
=
CONSISTENT AND FAIL-CLOSED
```

---

# 2. AUTHORITATIVE SOURCES

Use these as authoritative:

1. `/docs/04_TARGET_DATABASE_SCHEMA(3).md`
2. `/docs/validation/10_PROMPT_12_4_2_ENUM_CONTRACT_ROLLBACK_REPORT.md`
3. `/docs/validation/10_PROMPT_12_4_2_ENUM_CONTRACT_INVENTORY.md`
4. Current executable migration SQL from Prompt 12.4.2
5. Current rollback SQL from Prompt 12.4.2
6. Current enum ownership registry definition
7. Existing Prompt 12.4.2 enum tests

Do not redesign Target Database Schema Revision 4.

Do not weaken exact enum comparison.

---

# 3. SCOPE

This prompt is ONLY for:

- enum ownership provenance;
- registry lifecycle;
- rerun semantics;
- rollback authorization;
- enum-specific ownership validation;
- enum-specific tests;
- related validation/inventory documentation.

DO NOT modify:

- Product / ProductVariant / InventoryItem architecture;
- InventoryBalance / InventoryLedger;
- Recipe / RecipeItem;
- Modifiers;
- Orders / Payments / Refunds;
- tenant architecture;
- User Model B;
- stock migration;
- Backfill;
- Dual-write;
- Cutover;
- Contract;
- Prompt 13.

Do not alter the Target Schema Revision 4 enum vocabulary.

---

# 4. CORE OWNERSHIP PRINCIPLE

Ownership MUST represent provenance.

The following distinction is mandatory:

### A. Migration-owned

The migration itself created the enum in the current migration lifecycle.

Required semantics:

```text
ownership = CREATED_BY_PROMPT_12_4_2
created_by_migration = true
rollback_action = DROP
```

This state MUST survive a safe rerun.

### B. Pre-existing

The enum existed before this migration created it.

Required semantics:

```text
ownership = PRE_EXISTING_EXACT_COMPATIBLE_REUSED
created_by_migration = false
rollback_action = PRESERVE
```

This state MUST survive a safe rerun.

### C. Incompatible

Existing enum differs from Target Schema Revision 4.

Required:

```text
FAIL CLOSED
```

### D. Unknown / contradictory

The migration cannot prove provenance or registry state is contradictory.

Required:

```text
FAIL CLOSED
```

---

# 5. CRITICAL RERUN INVARIANT

A rerun MUST NOT infer ownership solely from:

```text
enum currently exists
```

or:

```text
enum currently matches target
```

Exact compatibility establishes schema compatibility.

It does NOT establish historical ownership.

Therefore:

```text
EXACT_MATCH != PRE_EXISTING
```

Exact match only means the enum definition is compatible with Target Schema Revision 4.

Ownership must be resolved separately.

---

# 6. REQUIRED OWNERSHIP RESOLUTION

For every target enum, ownership resolution MUST follow this precedence.

## Case 1 — Registry proves this migration created it

If the registry already contains:

```text
object_type = TYPE
object_name = <enum>
created_by_migration = true
ownership = CREATED_BY_PROMPT_12_4_2
rollback_action = DROP
```

then:

```text
ownership remains CREATED_BY_PROMPT_12_4_2
```

provided the current catalog object is still the expected enum type and exact target definition.

DO NOT downgrade it to pre-existing merely because the enum now exists.

---

## Case 2 — Registry proves it was pre-existing

If registry contains:

```text
created_by_migration = false
ownership = PRE_EXISTING_EXACT_COMPATIBLE_REUSED
rollback_action = PRESERVE
```

then ownership remains pre-existing, provided:

- object is still an enum;
- exact target contract still matches;
- registry record is internally consistent.

---

## Case 3 — No registry record and enum exists

If the enum exists but there is no ownership record, the migration MUST NOT infer that it is pre-existing.

Required state:

```text
UNKNOWN / UNVERIFIED
```

and:

```text
FAIL CLOSED
```

Do not silently insert:

```text
PRE_EXISTING_EXACT_COMPATIBLE_REUSED
```

based solely on catalog existence.

This rule is critical for safe rollback.

---

## Case 4 — Registry says migration-owned but enum is absent

This is contradictory.

Required:

```text
FAIL CLOSED
```

Do not recreate the enum automatically.

Do not silently repair the registry.

The owner must review the state.

---

## Case 5 — Registry says pre-existing but enum is absent

This is also contradictory.

Required:

```text
FAIL CLOSED
```

Do not silently recreate or rewrite the registry.

---

## Case 6 — Registry state is malformed

Examples:

- `created_by_migration = true` but `rollback_action = PRESERVE`;
- `created_by_migration = false` but `rollback_action = DROP`;
- ownership value does not match lifecycle state;
- duplicate contradictory registry rows;
- unexpected ownership value.

Required:

```text
FAIL CLOSED
```

---

# 7. FIRST-RUN SEMANTICS

When migration runs for the first time:

## Enum absent

Action:

1. create exact Target Revision 4 enum;
2. register:

```text
ownership = CREATED_BY_PROMPT_12_4_2
created_by_migration = true
rollback_action = DROP
```

## Enum exists

Action:

1. inspect exact catalog definition;
2. if exact-compatible, it MAY be reused ONLY if provenance is established safely;
3. if provenance cannot be established, classify as:

```text
UNKNOWN / UNVERIFIED
```

and fail closed.

Do not convert existence into ownership.

---

# 8. RERUN SEMANTICS

A rerun is valid only when the registry and catalog state remain consistent.

### Scenario A

```text
Registry: CREATED_BY_PROMPT_12_4_2
Catalog: exact target enum exists
```

Expected:

```text
REUSE
OWNERSHIP PRESERVED
NO REGISTRY DOWNGRADE
```

### Scenario B

```text
Registry: PRE_EXISTING_EXACT_COMPATIBLE_REUSED
Catalog: exact target enum exists
```

Expected:

```text
REUSE
OWNERSHIP PRESERVED
```

### Scenario C

```text
Registry: missing
Catalog: exact enum exists
```

Expected:

```text
FAIL CLOSED
```

### Scenario D

```text
Registry: CREATED_BY_PROMPT_12_4_2
Catalog: enum missing
```

Expected:

```text
FAIL CLOSED
```

### Scenario E

```text
Registry: PRE_EXISTING_EXACT_COMPATIBLE_REUSED
Catalog: enum missing
```

Expected:

```text
FAIL CLOSED
```

### Scenario F

```text
Registry: ownership contradictory
Catalog: exact enum exists
```

Expected:

```text
FAIL CLOSED
```

---

# 9. REGISTRY UPSERT SAFETY

Remove any registry operation that can silently change provenance from:

```text
CREATED_BY_PROMPT_12_4_2
```

to:

```text
PRE_EXISTING_EXACT_COMPATIBLE_REUSED
```

on rerun.

Do NOT use an unconditional `ON CONFLICT DO UPDATE` that overwrites ownership fields.

If an upsert is required, it must preserve established provenance.

Preferred semantics:

```text
existing provenance is immutable
```

except through an explicit owner-authorized correction process outside this migration.

The migration itself MUST NOT silently rewrite ownership history.

---

# 10. REGISTRY AS ROLLBACK AUTHORIZATION

The registry is not merely informational.

For enum rollback:

```text
registry.created_by_migration = true
AND
registry.ownership = CREATED_BY_PROMPT_12_4_2
AND
registry.rollback_action = DROP
```

must all be true before DROP is authorized.

A catalog existence check alone is insufficient.

A matching enum definition alone is insufficient.

An enum name alone is insufficient.

---

# 11. ROLLBACK CONTRADICTION HANDLING

Before dropping any enum, rollback MUST validate the registry record.

If:

```text
created_by_migration = true
```

but ownership is not the expected migration-owned value:

```text
FAIL CLOSED
```

If:

```text
rollback_action = DROP
```

but `created_by_migration = false`:

```text
FAIL CLOSED
```

If the registry row is absent:

```text
DO NOT DROP
```

If the enum exists but registry cannot prove migration ownership:

```text
DO NOT DROP
```

This is mandatory.

Rollback must prefer:

```text
SAFE ABORT
```

over:

```text
POTENTIALLY DESTRUCTIVE GUESS
```

---

# 12. NO OWNERSHIP RECONSTRUCTION

Do not reconstruct historical ownership from:

- current enum existence;
- enum exact-match status;
- enum creation timestamp;
- object name;
- current schema state;
- PostgreSQL OID alone;
- migration filename alone.

These may be useful evidence, but MUST NOT silently establish rollback ownership.

The ownership registry is the authoritative provenance record for this migration lifecycle.

---

# 13. OWNERSHIP REGISTRY LIFECYCLE

The registry itself must be handled safely.

Do not:

```sql
DROP TABLE "_prompt_12_ownership_registry"
```

as an unconditional rollback action.

Do not destroy the registry before all ownership-dependent rollback operations have completed.

Rollback ordering must be:

1. validate registry;
2. use registry to determine owned objects;
3. rollback dependent migration-owned objects;
4. rollback migration-owned enums;
5. preserve pre-existing enums;
6. only then handle registry cleanup if and only if the registry itself is migration-owned and safe to remove.

If registry ownership cannot be established, do not destroy it.

---

# 14. TEST MATRIX

Add/update tests for all of the following.

## P-01
First run, enum absent.

Expected:

```text
CREATE
OWNED
DROP AUTHORIZED
```

## P-02
First run, enum exists exact-compatible and provenance is explicitly established as pre-existing.

Expected:

```text
REUSE
PRE_EXISTING
PRESERVE
```

## P-03
Rerun after migration created enum.

Expected:

```text
OWNED REMAINS OWNED
```

This is the primary regression test.

## P-04
Rerun after pre-existing exact enum reuse.

Expected:

```text
PRE_EXISTING REMAINS PRE_EXISTING
```

## P-05
Registry missing, enum exists exact-compatible.

Expected:

```text
FAIL CLOSED
```

## P-06
Registry says migration-owned, enum missing.

Expected:

```text
FAIL CLOSED
```

## P-07
Registry says pre-existing, enum missing.

Expected:

```text
FAIL CLOSED
```

## P-08
Registry ownership/drop contradiction.

Expected:

```text
FAIL CLOSED
```

## P-09
Registry ownership/preserve contradiction.

Expected:

```text
FAIL CLOSED
```

## P-10
Registry contains unexpected ownership value.

Expected:

```text
FAIL CLOSED
```

## P-11
Rerun must not execute:

```text
UPDATE ownership FROM OWNED TO PRE_EXISTING
```

Expected:

```text
PASS
```

## P-12
Rollback after migration-created enum.

Expected:

```text
DROP OWNED ENUM
```

## P-13
Rollback after pre-existing enum reuse.

Expected:

```text
PRESERVE ENUM
```

## P-14
Rollback with missing registry.

Expected:

```text
DO NOT DROP
FAIL CLOSED
```

## P-15
Rollback with contradictory registry.

Expected:

```text
DO NOT DROP
FAIL CLOSED
```

## P-16
Static scan detects unsafe ownership overwrite.

Expected:

```text
FAIL
```

---

# 15. STATIC SCAN REQUIREMENTS

Scan migration and rollback artifacts for:

- unconditional registry ownership overwrite;
- `ON CONFLICT DO UPDATE` changing provenance;
- ownership downgrade from migration-owned to pre-existing;
- DROP TYPE without registry authorization;
- DROP TYPE based only on enum existence;
- automatic reconstruction of ownership;
- registry deletion before ownership-dependent rollback;
- silent repair of missing/contradictory registry records.

Any occurrence must either be removed or proven safe by executable logic.

Documentation alone is insufficient.

---

# 16. REQUIRED VALIDATION REPORT

Create/update:

```text
/docs/validation/10_PROMPT_12_4_3_ENUM_OWNERSHIP_PROVENANCE_REPORT.md
```

The report MUST contain:

1. execution stage;
2. preceding gate;
3. ownership model;
4. first-run semantics;
5. rerun semantics;
6. registry lifecycle;
7. rollback authorization;
8. contradiction handling;
9. ownership provenance matrix;
10. test matrix;
11. static scan result;
12. actual migration artifact reference;
13. actual rollback artifact reference;
14. unresolved issues;
15. final gate.

Do not claim ownership is verified merely because enum definitions match.

---

# 17. REQUIRED OWNERSHIP MATRIX

Create/update:

```text
/docs/validation/10_PROMPT_12_4_3_ENUM_OWNERSHIP_MATRIX.md
```

For every 20 target enums include:

| Enum | Catalog State | Registry State | Ownership | Rerun Behavior | Rollback | Evidence |
|---|---|---|---|---|---|---|

Possible catalog/registry states:

```text
ABSENT
EXACT
INCOMPATIBLE
UNKNOWN
CONTRADICTORY
```

Possible ownership:

```text
CREATED_BY_PROMPT_12_4_2
PRE_EXISTING_EXACT_COMPATIBLE_REUSED
UNKNOWN / UNVERIFIED
FAIL CLOSED
```

Do not invent runtime state.

---

# 18. VALIDATION ENVIRONMENT

A disposable isolated LOCAL PostgreSQL database is permitted.

Use it only to validate:

- first-run creation;
- exact pre-existing reuse;
- rerun;
- rollback;
- registry contradiction;
- missing registry;
- missing enum;
- ownership preservation.

DO NOT execute against:

- production;
- staging;
- shared development database.

Do not run:

```text
prisma migrate deploy
```

against staging/production.

Do not run:

```text
prisma db push
```

against staging/production.

---

# 19. TARGET SCHEMA PROTECTION

Do not modify:

```text
/docs/04_TARGET_DATABASE_SCHEMA(3).md
```

Target Database Schema Revision 4 remains authoritative.

Do not alter enum labels or ordering to make tests pass.

If an executable artifact disagrees with the target, correct the executable artifact.

---

# 20. NO NEXT PHASE

DO NOT start:

- Backfill
- Dual-write
- Cutover
- Contract
- Prompt 13

This prompt ends at the ownership/rerun gate.

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

The result MUST be:

```text
BLOCKED / OWNER REVIEW REQUIRED
```

if ANY of the following remains:

- rerun can downgrade migration-owned provenance;
- registry can silently overwrite ownership;
- ownership is inferred from catalog existence alone;
- rollback can drop an enum without registry proof;
- missing registry does not fail closed;
- missing enum with owned registry does not fail closed;
- contradictory registry state does not fail closed;
- registry lifecycle can destroy provenance before rollback completes;
- ownership matrix has unknown/uncovered enums;
- tests do not prove ownership survives rerun;
- static scan finds unsafe ownership overwrite;
- any required evidence is unavailable.

At completion, return the final gate and STOP.

Do not start Prompt 13.
