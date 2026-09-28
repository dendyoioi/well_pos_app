# PROMPT 11.2 — FINAL MIGRATION READINESS GATE CORRECTION

## Well POS SaaS Platform
### Final Correction & Revalidation of Migration Readiness Report

**Execution mode:** STRICT READ-ONLY  
**Purpose:** Final correction of `/docs/validation/09_MIGRATION_READINESS_REPORT.md` before any decision to proceed to Prompt 12.

---

# 1. OBJECTIVE

Execute a final, narrow correction and gate revalidation of the Prompt 11.1 migration readiness report.

This prompt is **NOT** an architecture redesign.

This prompt is **NOT** a migration implementation.

This prompt exists only to remove remaining inconsistencies and unsupported assumptions identified during Project Owner review of the Prompt 11.1 report.

The canonical report to update is:

```text
/docs/validation/09_MIGRATION_READINESS_REPORT.md
```

The canonical task specification is this file:

```text
/docs/prompts/PROMPT_11_2_FINAL_MIGRATION_READINESS_GATE_CORRECTION.md
```

---

# 2. SOURCE-OF-TRUTH HIERARCHY

Use the following hierarchy:

1. Existing source code + existing database/schema evidence
2. Approved Architecture Decisions ADR-001 through ADR-005
3. Approved Data Architecture RFC Revision 4
4. Approved Target Database Schema Revision 4
5. Prompt 11 Migration Readiness Review
6. Prompt 11.1 Migration Readiness Correction
7. This Prompt 11.2

Do not silently override a higher-level source.

Do not introduce new architecture decisions through this prompt.

---

# 3. REQUIRED INPUTS TO READ

Before correction, READ:

```text
/docs/prompts/PROMPT_11_MIGRATION_READINESS_REVIEW.md
/docs/prompts/PROMPT_11_1_MIGRATION_READINESS_CORRECTION.md

/docs/architecture/03_DATA_ARCHITECTURE_RFC.md
/docs/architecture/04_TARGET_DATABASE_SCHEMA.md

/docs/decisions/ADR-001-tenant-boundary-enforcement.md
/docs/decisions/ADR-002-negative-stock-policy.md
/docs/decisions/ADR-003-uom-vs-packaging.md
/docs/decisions/ADR-004-inventory-batch-lot.md
/docs/decisions/ADR-005-services-module-boundary.md

/docs/validation/09_MIGRATION_READINESS_REPORT.md

server/prisma/schema.prisma
```

Also inspect the relevant existing source code needed to verify:

- legacy User / PIN representation
- legacy Product SKU / Barcode location
- legacy Order payment status
- legacy inventory structure
- existing tenant fallback behavior
- existing StockMovement structure

---

# 4. HARD CONSTRAINTS

## DO NOT

- modify `server/prisma/schema.prisma`
- modify application code
- modify controllers
- modify routes
- modify middleware
- modify frontend
- create migrations
- execute migrations
- execute `prisma migrate`
- execute `prisma db push`
- perform backfill
- perform dual-write
- modify production/shared database
- create Prompt 12
- create or modify any architecture decision
- add new models or fields to Revision 4
- invent live database counts
- invent data quality results
- approve unresolved business decisions as if they were architecture decisions

## ONLY MODIFY

```text
/docs/validation/09_MIGRATION_READINESS_REPORT.md
```

After completing the correction and revalidation:

**STOP.**

---

# 5. REQUIRED CORRECTIONS

Apply all six corrections below.

---

## C-01 — Remove Unsupported `InventoryBalance.isNegativeBalance`

The Prompt 11.1 report currently refers to setting:

```text
InventoryBalance.isNegativeBalance = true
```

This field is NOT part of Target Database Schema Revision 4.

Do not introduce or imply such a field.

Correct the report to use the approved architecture:

- `InventoryBalance.quantityOnHand`
- `InventoryBalance.quantityReserved`
- `InventoryItem.allowNegativeStock`
- the approved negative-stock policy and context hierarchy from ADR-002

If legacy stock is negative:

1. report the condition as a migration/data-readiness issue;
2. determine whether the negative quantity is permitted by the approved negative-stock policy;
3. preserve the actual quantity during calibration where architecturally permitted;
4. do not invent a target `isNegativeBalance` field.

The report must not suggest schema modification to accommodate this.

---

# 6. C-02 — Correct Plaintext PIN Verification

The Prompt 11.1 report currently uses a query equivalent to:

```sql
SELECT count(*)
FROM users
WHERE is_active = true
  AND pin IS NULL;
```

This does NOT verify plaintext-PIN coverage.

Correct the migration readiness description.

The report must distinguish at least:

### Case A — Legacy PIN exists

```text
users.pin IS NOT NULL
```

The legacy plaintext PIN requires transformation into:

```text
User.pinHash
```

using the approved password/PIN hashing approach.

### Case B — Legacy PIN is NULL

The user requires credential provisioning/reset according to the migration procedure.

### Case C — Target pinHash exists

The migration result must verify that:

```text
pinHash IS NOT NULL
```

for active users who are expected to authenticate through PIN.

Do not claim that `pin IS NULL` is a proxy for plaintext-PIN coverage.

If the actual legacy PIN representation cannot be verified from source/schema evidence, state:

```text
LEGACY PIN REPRESENTATION NOT VERIFIED
```

Do not invent a data count.

---

# 7. C-03 — Correct SKU / Barcode Duplicate Verification

The Prompt 11.1 report currently contains duplicate checks against legacy `products.sku`.

Reconcile this with Target Revision 4.

Target architecture:

```text
Product
   1:N
ProductVariant
   N:1
InventoryItem
```

SKU and barcode belong to:

```text
ProductVariant.sku
ProductVariant.barcode
```

Therefore:

### Legacy verification

Inspect the actual legacy Product schema and determine where SKU and Barcode reside.

### Target verification

After conceptual Product → ProductVariant mapping, validate:

```text
tenantId + sku
tenantId + barcode
```

according to the exact unique constraints defined by Revision 4.

The report must not imply that the target uniqueness constraint belongs to `Product`.

Do not add uniqueness constraints beyond Revision 4.

---

# 8. C-04 — Strengthen Dimensional Inventory Reconciliation

The Prompt 11.1 report improved reconciliation, but final wording/query logic must explicitly preserve tenant boundaries.

Inventory reconciliation must be conceptually evaluated at:

```text
tenantId
+ outlet / StorageLocation
+ InventoryItem
+ batch / lot where applicable
+ UOM / conversion context where applicable
```

Where the legacy source uses:

```text
outlet_products
```

the mapping must explicitly resolve:

```text
legacy outlet
    ->
target StorageLocation
    ->
target InventoryBalance
    ->
target InventoryItem
```

The reconciliation must never rely on global aggregate stock totals.

A mismatch in one tenant/location/item must not be masked by an opposite mismatch elsewhere.

Also verify that the reconciliation logic respects:

```text
ProductVariant.inventoryQuantityMultiplier
```

where that multiplier is relevant to the transaction/commercial-to-inventory conversion.

Do not redefine the physical stock baseline.

---

# 9. C-05 — Remove Unapproved Business Decisions from the Gate

Prompt 11.1 currently lists open questions including:

```text
purge parked orders older than 24 hours
```

and a specific sequential user-code format such as:

```text
KSR-001
SPV-001
ADM-001
```

These are not approved architecture decisions.

Correct the report so they are explicitly classified as:

```text
OWNER DECISION REQUIRED
```

unless existing approved project documentation already establishes them.

Do not silently turn either item into a migration requirement.

### Parked Orders

The report may describe the technical mapping:

```text
HoldOrder -> Order
```

but retention/purge policy must remain an Owner decision unless already approved elsewhere.

### User Code

The report may require:

```text
unique userCode within tenant
```

because that is part of Revision 4.

However, the exact generation format must not be presented as approved unless explicitly documented by the Owner.

---

# 10. C-06 — Revalidate the Gate After Corrections

After applying C-01 through C-05, re-evaluate the migration readiness gate.

Use exactly one of:

```text
GO
GO WITH CONDITIONS
NO-GO
```

Do not change the architecture merely to obtain a different gate.

The gate must reflect:

- target architecture correctness
- current source compatibility
- migration mapping confidence
- known application cutover risks
- live-data verification status
- unresolved Owner decisions
- migration prerequisites

If live data is unavailable, retain explicit wording:

```text
LIVE DATA COUNTS NOT VERIFIED
```

Do not convert "not verified" into "clean".

---

# 11. IMPORTANT DISTINCTIONS

The corrected report MUST continue to distinguish:

## Architecture Invariant

Example:

```text
Product 1:N ProductVariant N:1 InventoryItem
```

## Legacy Backfill Mapping

Example:

```text
one legacy Product
    ->
one default ProductVariant
    ->
one InventoryItem
```

The latter is a migration strategy, not a target cardinality restriction.

---

## Target Schema Risk

Example:

```text
tenantId NOT NULL
```

versus:

## Current Application / Cutover Risk

Example:

```text
toko-maju-jaya fallback
findFirst()
```

Do not merge these categories.

---

## Data Verification Status

Use explicit states such as:

```text
VERIFIED
NOT VERIFIED
NOT APPLICABLE
BLOCKED BY ACCESS
```

Never invent counts.

---

# 12. REQUIRED REPORT CHANGES

Update:

```text
/docs/validation/09_MIGRATION_READINESS_REPORT.md
```

The report should preserve the existing structure and evidence unless a correction requires changing it.

At minimum, update:

- Executive Summary if affected
- Review Corrections Applied
- Pre-Migration Data Verification Checklist
- Product / Variant / Inventory Assessment
- Dimensional Reconciliation Plan
- Open Architectural Questions
- Migration Readiness Gate Verdict

Add a correction entry section or rows:

```text
C-01
C-02
C-03
C-04
C-05
C-06
```

Do not rewrite unrelated sections merely for stylistic reasons.

---

# 13. FINAL VALIDATION CHECKLIST

Before reporting completion, verify:

- [ ] No reference to `InventoryBalance.isNegativeBalance`
- [ ] Negative stock policy references `InventoryItem.allowNegativeStock` / ADR-002
- [ ] PIN verification does not use `pin IS NULL` as plaintext-PIN coverage
- [ ] Legacy PIN presence and target `pinHash` readiness are distinguished
- [ ] SKU/Barcode target uniqueness is validated on `ProductVariant`
- [ ] Inventory reconciliation includes `tenantId`
- [ ] Inventory reconciliation is dimensional, not global
- [ ] Batch/UOM/multiplier considerations are preserved where applicable
- [ ] Parked-order retention is not silently decided
- [ ] UserCode format is not silently approved
- [ ] Live data counts remain explicitly unverified if access is unavailable
- [ ] No schema changes
- [ ] No application changes
- [ ] No migration execution
- [ ] No backfill
- [ ] No dual-write
- [ ] No Prompt 12 created
- [ ] Final gate is exactly GO / GO WITH CONDITIONS / NO-GO

---

# 14. REPORT FORMAT

At the end of the execution, provide:

```text
PROMPT 11.2 RESULT
-------------------

Corrections Applied:
C-01: ...
C-02: ...
C-03: ...
C-04: ...
C-05: ...
C-06: ...

Live Data Status:
...

Final Migration Readiness Gate:
GO / GO WITH CONDITIONS / NO-GO

Reason:
...

STOP.
```

Do not generate Prompt 12.

Do not execute migration work.

---

# 15. STOP CONDITION

After:

1. reading the required sources,
2. applying C-01 through C-05,
3. revalidating C-06,
4. updating `/docs/validation/09_MIGRATION_READINESS_REPORT.md`,
5. reporting the final gate,

**STOP.**

The Project Owner will independently review the final gate before any Prompt 12 is authorized.
