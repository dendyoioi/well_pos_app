# PROMPT 12.4.4 — ENUM ROLLBACK CATALOG IDENTITY HARDENING

## Execution Stage

Prompt 12.4.4 — Enum Rollback Catalog Identity Hardening

## Preceding Gate

Prompt 12.4.3 was reviewed as:

**BLOCKED / OWNER REVIEW REQUIRED**

The remaining concern is narrow:

> Rollback currently relies on registry provenance plus the enum object name, but must also verify that the current PostgreSQL catalog object is still the expected enum before issuing DROP TYPE.

This prompt addresses ONLY that rollback catalog-identity issue.

---

# 1. OBJECTIVE

Harden enum rollback so that an enum is dropped only when ALL required evidence agrees:

```text
REGISTRY PROVENANCE
+
CATALOG OBJECT IDENTITY
+
ENUM TYPE
+
EXACT TARGET ENUM CONTRACT
+
ROLLBACK AUTHORIZATION
=
DROP AUTHORIZED
```

If any evidence is missing, contradictory, or unexpected:

```text
FAIL CLOSED
```

The rollback MUST prefer a safe abort over a potentially destructive DROP.

---

# 2. AUTHORITATIVE SOURCES

Use:

1. `/docs/04_TARGET_DATABASE_SCHEMA(3).md`
2. `/docs/validation/10_PROMPT_12_4_2_ENUM_CONTRACT_ROLLBACK_REPORT.md`
3. `/docs/validation/10_PROMPT_12_4_3_ENUM_OWNERSHIP_PROVENANCE_REPORT.md`
4. `/docs/validation/10_PROMPT_12_4_3_ENUM_OWNERSHIP_MATRIX.md`
5. Current `migration(8).sql`
6. Current `rollback(7).sql`
7. Existing enum validation tests

Do not change the Target Database Schema Revision 4 enum vocabulary or ordering.

---

# 3. SCOPE

ONLY modify:

- enum rollback catalog identity verification;
- enum rollback authorization;
- enum-specific validation;
- enum-specific tests;
- enum rollback documentation/inventory.

Do NOT modify:

- Product / ProductVariant / InventoryItem;
- InventoryBalance / InventoryLedger;
- Recipe / RecipeItem;
- Modifiers;
- Order / Payment / Refund;
- tenant architecture;
- User Model B;
- stock migration;
- Backfill;
- Dual-write;
- Cutover;
- Contract;
- Prompt 13.

Do not redesign the migration architecture.

---

# 4. EXISTING ROLLBACK AUTHORIZATION

Retain the Prompt 12.4.3 triple-proof requirement:

```text
registry.created_by_migration = true
AND
registry.ownership = 'CREATED_BY_PROMPT_12_4_2'
AND
registry.rollback_action = 'DROP'
```

This remains necessary.

It is NOT sufficient by itself.

---

# 5. REQUIRED CATALOG IDENTITY VALIDATION

Before executing:

```sql
DROP TYPE <enum>
```

rollback MUST verify the current PostgreSQL catalog object.

At minimum inspect:

- `pg_type`
- `pg_namespace`
- `pg_enum`

The validation MUST establish:

### A. Object exists

If registry says the enum is migration-owned but the catalog object is absent:

```text
FAIL CLOSED
```

Never use:

```sql
DROP TYPE IF EXISTS
```

as a mechanism that hides this contradiction.

---

### B. Object is actually an enum

Verify:

```text
pg_type.typtype = 'e'
```

If an object with the expected name exists but is not an enum:

```text
FAIL CLOSED
```

Do NOT drop it.

---

### C. Expected namespace

The target enum must be in the expected PostgreSQL namespace.

For the current Target Schema Revision 4 implementation, verify the expected schema explicitly rather than accepting any object with the same name.

If namespace does not match:

```text
FAIL CLOSED
```

---

### D. Exact enum definition

Retrieve labels using:

```sql
pg_enum.enumlabel
ORDER BY pg_enum.enumsortorder
```

Compare the complete ordered label array against the exact Target Database Schema Revision 4 enum contract.

Required:

```text
actual_labels IS NOT DISTINCT FROM target_labels
```

Do not use:

- subset;
- superset;
- label-count-only;
- unordered set comparison.

If labels differ:

```text
FAIL CLOSED
```

Do NOT drop the enum.

---

# 6. OBJECT IDENTITY / PROVENANCE

The registry proves migration provenance.

The catalog validation proves current object compatibility.

The rollback decision requires BOTH.

Do not attempt to reconstruct historical identity using:

- object name alone;
- timestamp alone;
- OID alone;
- exact label match alone.

If PostgreSQL object identity metadata is recorded by the existing migration and can be safely compared, use it.

If no persistent catalog identity is available across the migration lifecycle, do NOT invent one.

Instead, require the combined invariant:

```text
registry provenance
+
expected namespace
+
enum type identity
+
exact ordered enum contract
```

before DROP.

---

# 7. NO `DROP TYPE IF EXISTS` FOR AUTHORIZATION

Remove the use of:

```sql
DROP TYPE IF EXISTS
```

for migration-owned enum rollback where it can mask:

```text
registry says owned
but catalog object is absent
```

Required behavior:

```text
catalog missing
→ RAISE EXCEPTION
→ transaction abort
→ zero destructive rollback for that enum
```

Only issue an unconditional `DROP TYPE` after all validation passes.

---

# 8. PRE-EXISTING ENUMS

If registry says:

```text
created_by_migration = false
ownership = PRE_EXISTING_EXACT_COMPATIBLE_REUSED
rollback_action = PRESERVE
```

then:

```text
DO NOT DROP
```

No catalog identity validation is allowed to convert a pre-existing enum into an owned enum.

It remains preserved.

---

# 9. MISSING / CONTRADICTORY STATES

Rollback MUST fail closed for:

### R-01
Registry says owned, catalog enum missing.

Expected:

```text
FAIL CLOSED
```

### R-02
Registry says owned, object exists but is not enum.

Expected:

```text
FAIL CLOSED
```

### R-03
Registry says owned, enum namespace incorrect.

Expected:

```text
FAIL CLOSED
```

### R-04
Registry says owned, enum labels differ from Target Revision 4.

Expected:

```text
FAIL CLOSED
```

### R-05
Registry says owned, registry triple-proof incomplete.

Expected:

```text
FAIL CLOSED
```

### R-06
Registry says pre-existing.

Expected:

```text
PRESERVE
```

### R-07
Registry missing.

Expected:

```text
FAIL CLOSED
```

Do not silently repair any of these states.

---

# 10. TRANSACTION SAFETY

Catalog identity validation MUST occur before the corresponding DROP.

If any enum fails validation:

```text
RAISE EXCEPTION
```

and the rollback transaction must abort according to the existing transaction model.

Do not continue dropping other enums after a failed identity check if doing so would violate the existing all-or-nothing rollback semantics.

Do not create a partial destructive rollback.

---

# 11. TARGET ENUM CONTRACT SOURCE

Do not duplicate an inconsistent second enum vocabulary.

The rollback validation must use the same authoritative Target Revision 4 enum contract established by Prompt 12.4.2.

If the current rollback artifact contains a hardcoded enum contract:

- verify it exactly matches the authoritative 20-enum contract;
- if duplicated, ensure there is one authoritative generated representation;
- any mismatch is:

```text
BLOCKED / OWNER REVIEW REQUIRED
```

Do not silently modify the target schema.

---

# 12. REQUIRED TEST MATRIX

Add/update at least these tests.

## R-01
Owned enum exists and is exact target enum.

Expected:

```text
DROP AUTHORIZED
```

## R-02
Owned enum missing.

Expected:

```text
FAIL CLOSED
ZERO DROP
```

## R-03
Owned name exists but object is not enum.

Expected:

```text
FAIL CLOSED
ZERO DROP
```

## R-04
Owned enum exists in wrong namespace.

Expected:

```text
FAIL CLOSED
ZERO DROP
```

## R-05
Owned enum has missing label.

Expected:

```text
FAIL CLOSED
ZERO DROP
```

## R-06
Owned enum has extra label.

Expected:

```text
FAIL CLOSED
ZERO DROP
```

## R-07
Owned enum has reordered labels.

Expected:

```text
FAIL CLOSED
ZERO DROP
```

## R-08
Owned enum has completely different vocabulary.

Expected:

```text
FAIL CLOSED
ZERO DROP
```

## R-09
Owned enum has exact labels but registry triple-proof is incomplete.

Expected:

```text
FAIL CLOSED
ZERO DROP
```

## R-10
Pre-existing exact enum.

Expected:

```text
PRESERVE
```

## R-11
Missing registry.

Expected:

```text
FAIL CLOSED
ZERO DROP
```

## R-12
Static scan detects:

```text
DROP TYPE IF EXISTS
```

in the migration-owned enum rollback authorization path.

Expected:

```text
FAIL
```

## R-13
Static scan confirms exact ordered label comparison.

Expected:

```text
PASS
```

## R-14
Static scan confirms every migration-owned enum has catalog identity validation.

Expected:

```text
PASS
```

## R-15
Rollback after safe migration rerun.

Expected:

```text
OWNED ENUM STILL DROPPED ONLY AFTER IDENTITY VALIDATION
```

---

# 13. REQUIRED STATIC SCAN

Scan migration and rollback artifacts for:

- `DROP TYPE IF EXISTS`;
- unconditional `DROP TYPE`;
- enum name-only authorization;
- missing `pg_type.typtype = 'e'`;
- missing namespace verification;
- missing `pg_enum` ordered-label verification;
- subset/superset compatibility;
- label-count-only comparison;
- unordered label comparison;
- rollback DROP without registry triple-proof.

Any unsafe occurrence MUST be removed or proven unreachable by executable validation.

Documentation alone is insufficient.

---

# 14. REQUIRED VALIDATION REPORT

Create/update:

```text
/docs/validation/10_PROMPT_12_4_4_ENUM_ROLLBACK_CATALOG_IDENTITY_REPORT.md
```

Must include:

1. execution stage;
2. preceding gate;
3. rollback authorization invariant;
4. catalog identity checks;
5. namespace check;
6. enum type check;
7. exact label check;
8. registry provenance check;
9. missing/contradictory handling;
10. test matrix;
11. static scan;
12. actual migration artifact reference;
13. actual rollback artifact reference;
14. unresolved issues;
15. final gate.

Do not claim catalog identity validation is complete without executable evidence.

---

# 15. REQUIRED VALIDATION MATRIX

Create/update:

```text
/docs/validation/10_PROMPT_12_4_4_ENUM_ROLLBACK_CATALOG_IDENTITY_MATRIX.md
```

For all 20 target enums include:

| Enum | Registry Ownership | Catalog Exists | Catalog Type | Namespace | Exact Labels | Rollback Decision | Evidence |
|---|---|---|---|---|---|---|---|

Do not invent live catalog state.

Use:

```text
NOT VERIFIED
```

where runtime evidence is unavailable.

---

# 16. NO TARGET SCHEMA MODIFICATION

Do not modify:

```text
/docs/04_TARGET_DATABASE_SCHEMA(3).md
```

Target Database Schema Revision 4 remains authoritative.

---

# 17. VALIDATION ENVIRONMENT

A disposable isolated LOCAL PostgreSQL database is permitted only for validation.

DO NOT execute against:

- production;
- staging;
- shared development.

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

# 18. NO NEXT PHASE

DO NOT start:

- Backfill
- Dual-write
- Cutover
- Contract
- Prompt 13

This prompt is the final micro-hardening step for the enum rollback identity issue.

---

# 19. FINAL GATE

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

- rollback can DROP a missing catalog object;
- `DROP TYPE IF EXISTS` can mask registry/catalog contradiction;
- object is not verified as enum;
- namespace is not verified;
- exact ordered labels are not verified;
- registry triple-proof is incomplete;
- pre-existing enum can be dropped;
- any owned enum lacks catalog identity validation;
- any test is missing or fails;
- static scan finds unsafe authorization;
- evidence is only documentary and not executable;
- required runtime evidence is unavailable.

At completion, return the final gate and STOP.

Do not start Prompt 13.
