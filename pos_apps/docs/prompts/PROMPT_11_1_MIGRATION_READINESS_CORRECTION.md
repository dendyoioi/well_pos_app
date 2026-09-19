# PROMPT 11.1 — MIGRATION READINESS REPORT CORRECTION & GATE REVALIDATION

## Role

You are **Antigravity**, the primary implementation and architecture agent for Well POS.

Prompt 11 has been executed and produced:

`/docs/validation/09_MIGRATION_READINESS_REPORT.md`

The report returned:

`GO WITH CONDITIONS`

The Project Owner has reviewed the report and found several inconsistencies between the report and the already architecture-locked Revision 4 design.

This task is a **READ-ONLY CORRECTION / REVALIDATION TASK**.

The purpose is NOT to redesign the architecture and NOT to generate migration scripts.

Your job is to:

1. Re-read the authoritative architecture.
2. Re-check the Prompt 11 report against the locked target.
3. Correct the migration-readiness analysis where it contradicts the approved architecture.
4. Separate architecture facts from legacy migration strategy.
5. Strengthen the readiness gate using evidence from the actual repository/current schema.
6. Produce a corrected migration readiness report.
7. STOP.

---

# 1. SOURCE-OF-TRUTH HIERARCHY

Use this exact hierarchy:

1. Existing source code + existing database/schema/migrations
2. Approved ADR-001 through ADR-005
3. Approved Data Architecture RFC Revision 4
4. Approved Target Database Schema Revision 4
5. Prompt 11
6. This correction prompt

Important:

- Existing source code/database is authoritative for CURRENT STATE.
- Revision 4 is authoritative for TARGET ARCHITECTURE.
- Do not alter the target architecture to make migration easier.
- Do not invent target models, relations, or constraints.
- If current-state evidence is unavailable, report that limitation explicitly.

---

# 2. STRICT READ-ONLY RULE

DO NOT:

- create or apply migrations;
- modify `server/prisma/schema.prisma`;
- modify application code;
- modify controllers;
- modify routes;
- modify services;
- modify frontend;
- modify production/shared database;
- run `prisma migrate dev`;
- run `prisma migrate deploy`;
- run `prisma db push`;
- perform backfill;
- perform dual-write;
- alter existing data;
- implement tenant enforcement;
- implement InventoryDomainService;
- proceed to Prompt 12.

Safe read-only inspection is allowed.

After the corrected report is produced:

**STOP.**

---

# 3. KNOWN REVIEW FINDINGS FROM PROMPT 11

The Project Owner's review identified the following issues that MUST be revalidated and corrected.

## R-01 — UserOutletAssignment Must NOT Be Introduced

The Prompt 11 report incorrectly mapped:

```text
users → User + UserOutletAssignment
```

and included `UserOutletAssignment` in the proposed migration.

This conflicts with Revision 4.

Phase 1 uses:

```text
User
  └── outletId?
```

Semantics:

```text
outletId != NULL
→ outlet-restricted user

outletId == NULL
→ tenant-wide authority
```

Do NOT introduce:

- UserOutletAssignment
- UserOutlet
- membership tables

unless they already exist in the CURRENT system and are being assessed purely as legacy structures.

If a legacy assignment structure exists, it may be documented as CURRENT STATE only.

The TARGET Phase 1 model remains `User.outletId`.

---

# 4. R-02 — Do Not Claim Composite Tenant FKs Unless They Exist in Revision 4

The previous report incorrectly stated that Revision 4 uses tenant-composite foreign keys such as:

```text
(tenantId, outletId)
(tenantId, variantId)
```

Do NOT repeat this as a target architecture claim unless the exact target schema actually contains it.

Revision 4's tenant isolation architecture is:

```text
direct tenantId NOT NULL
+
tenant-scoped uniqueness where required
+
explicit service-layer tenant validation
```

Standard FK relations alone do not prove tenant equality.

The corrected report MUST distinguish:

### Database structural ownership

```text
tenantId NOT NULL
```

from:

### Application/service invariant

```text
referenced record must belong to the same tenant
```

Do not invent composite FK architecture.

If a composite FK is only a conceptual validation idea, label it as such and do not present it as an implemented target constraint.

---

# 5. R-03 — Separate TARGET CARDINALITY From LEGACY BACKFILL MAPPING

The previous report described:

```text
Product → ProductVariant → InventoryItem
```

as a "1:1:1 strategy".

This wording is dangerous.

The TARGET architecture is:

```text
Product
  ↓ 1:N
ProductVariant
  ↓ N:1
InventoryItem
```

Multiple ProductVariants may share one InventoryItem.

For LEGACY migration, it is acceptable to propose:

```text
Legacy Product
    ↓
one ProductVariant
    ↓
one InventoryItem
```

because legacy products did not have variants.

The corrected report MUST explicitly label this as:

`LEGACY BACKFILL MAPPING — NOT TARGET CARDINALITY`

Do not change target architecture.

---

# 6. R-04 — Correct InventoryLedger Terminology

Do NOT call the target `InventoryLedger`:

- double-entry accounting ledger;
- financial double-entry ledger;
- GL ledger.

The approved concept is:

```text
IMMUTABLE APPEND-ONLY STOCK MOVEMENT LEDGER
```

It records stock movement and historical inventory state.

There are no accounting debit/credit journal entries in this target model.

Correct all terminology in the migration-readiness report.

---

# 7. R-05 — Reassess Legacy stock_movements → InventoryLedger

The previous report treated:

```text
stock_movements → InventoryLedger
```

too directly.

Reassess whether each legacy stock movement contains sufficient information to reconstruct:

- tenant;
- inventory item;
- storage location;
- batch, if applicable;
- signed quantity delta;
- unit cost;
- reference type/reference;
- actor;
- historical sequence;
- balanceBefore/balanceAfter.

Do NOT assume historical legacy movements can safely become target ledger rows.

Classify the legacy stock movement migration as one of:

- fully mappable;
- partially mappable;
- archive-only;
- requires transformation;
- unresolved.

If the legacy movement data cannot safely reconstruct target ledger invariants, recommend:

```text
legacy stock movement archive
+
target opening-balance calibration
```

rather than inventing historical ledger values.

This is a migration decision, not a target architecture change.

---

# 8. R-06 — Strengthen Inventory Reconciliation

The previous report used a global stock sum:

```text
SUM(legacy stock)
=
SUM(target stock)
```

This is insufficient.

A corrected reconciliation MUST preserve at least these dimensions:

```text
tenant
+
legacy outlet → target storage location
+
legacy product → target inventory item
```

Where applicable, also include:

```text
batch
+
UOM conversion
+
inventoryQuantityMultiplier
```

The reconciliation must detect cases where:

```text
Outlet A = 10
Outlet B = 20
```

is incorrectly migrated as:

```text
Outlet A = 20
Outlet B = 10
```

even though the global total remains 30.

Define reconciliation at the appropriate dimensional grain.

For batch-tracked target items:

```text
legacy quantity
=
aggregate target balance across the relevant batch dimension
```

according to the approved migration rule.

Do not invent detailed FEFO or batch allocation logic.

---

# 9. R-07 — Verify Actual Legacy Order Status Values

Do not assume that legacy order status values are only:

```text
PAID
CANCELLED
HOLD
```

Inspect the actual schema/source code/migration history available in the repository.

Produce a mapping table:

| Legacy status | Target OrderStatus | Target PaymentStatus | Evidence | Risk |
|---|---|---|---|---|

Every known legacy status must be mapped.

If a status is unknown, NULL, or unsupported:

```text
classify as DATA TRANSFORMATION REQUIRED
```

or:

```text
MANUAL MAPPING REQUIRED
```

Do not silently invent a mapping.

---

# 10. R-08 — Verify ACTUAL CURRENT-STATE DATA READINESS

This is a major correction.

Prompt 11 must distinguish:

```text
ARCHITECTURAL RISK
```

from:

```text
ACTUAL DATA CONDITION
```

For every critical migration prerequisite, report one of:

- VERIFIED — actual count/result available;
- NOT VERIFIED — repository/schema evidence exists but live data was unavailable;
- NOT APPLICABLE;
- BLOCKED BY ACCESS.

At minimum assess:

### Tenant integrity

- NULL tenantId by tenant-owned legacy table;
- cross-tenant parent/child mismatch;
- orphan tenant references.

### Product

- active products;
- products without SKU;
- duplicate SKU within tenant;
- duplicate barcode within tenant;
- products without category where category is required;
- orphan product references.

### Inventory

- orphan `outlet_products`;
- negative stock;
- stock per outlet/product;
- duplicate outlet/product stock rows;
- orphan stock movements;
- stock movement/product mismatches.

### Orders

- orphan order items;
- invalid product references;
- NULL/unknown order statuses;
- orders without tenant/outlet where required;
- duplicate invoice numbers within tenant.

### Payments

- orphan payment rows;
- payment/order tenant mismatch;
- payment totals vs order totals;
- unknown payment methods/statuses.

### Users

- NULL tenantId;
- duplicate tenant + userCode if applicable;
- duplicate tenant + email;
- NULL/duplicate outlet references;
- plaintext PIN coverage;
- inactive users with missing credentials.

If live database access is not available, explicitly state:

```text
LIVE DATA COUNTS NOT VERIFIED
```

Do NOT invent counts.

---

# 11. R-09 — Tenant Fallbacks Are CURRENT APPLICATION RISK, Not TARGET SCHEMA

The report correctly identified legacy fallback behavior such as:

```text
toko-maju-jaya
prisma.tenant.findFirst()
prisma.outlet.findFirst()
```

Retain these findings.

But classify them correctly:

```text
CURRENT APPLICATION / CUTOVER RISK
```

not as a defect in the Revision 4 target schema.

Explain:

```text
Target architecture is locked.
Legacy application behavior must be removed before safe cutover.
```

Do not modify the code during this task.

---

# 12. R-10 — Separate Architecture Conditions From Migration Preconditions

The corrected report MUST separate:

## Already-locked architecture invariants

Examples:

- strict tenantId ownership;
- Model B User;
- Product / Variant / Inventory separation;
- InventoryBatch optional dimension;
- immutable inventory movement ledger;
- staged migration lifecycle.

from:

## Actual migration prerequisites

Examples:

- tenant NULL cleanup;
- SKU collision resolution;
- orphan cleanup;
- product mapping;
- legacy order status mapping;
- inventory reconciliation;
- payment reconciliation;
- active-shift handling.

Do not present an architecture invariant as though it was newly discovered by Prompt 11.

---

# 13. R-11 — Reassess the READINESS GATE

After correcting all findings, produce exactly one:

```text
GO
GO WITH CONDITIONS
NO-GO
```

Use these definitions:

### GO

Use only if:

- target architecture is consistent;
- current-state compatibility is sufficiently understood;
- no unresolved prerequisite prevents generation of the migration plan;
- unknowns are implementation details rather than blockers.

### GO WITH CONDITIONS

Use when:

- migration planning can continue;
- but explicit prerequisites/data-cleanup/owner decisions must be resolved before execution.

### NO-GO

Use only when:

- a target architecture contradiction exists;
- critical current-state mapping is impossible;
- essential evidence is unavailable and blocks safe migration planning;
- or an unresolved business/architecture decision prevents migration design.

Do NOT choose a gate merely because the migration itself is complex.

---

# 14. REQUIRED CORRECTED REPORT

Update:

```text
/docs/validation/09_MIGRATION_READINESS_REPORT.md
```

The corrected report must retain the original required sections:

1. Executive Summary
2. Scope & Read-Only Guarantee
3. Existing Schema Inventory
4. Existing → Target Table Mapping
5. Existing → Target Data Mapping
6. Tenant Isolation Assessment
7. Product/Variant/Inventory Assessment
8. Order/Payment/Refund Assessment
9. User/Auth Assessment
10. Risk Classification
11. Backfill Design
12. Migration Sequence
13. Reconciliation Plan
14. Rollback/Abort Conditions
15. Migration Readiness Gate
16. Open Questions
17. Recommended Next Prompt

Add a new section immediately after Executive Summary:

## Review Corrections Applied

List:

```text
R-01 UserOutletAssignment
R-02 Composite tenant FK claim
R-03 Legacy 1:1:1 vs target cardinality
R-04 InventoryLedger terminology
R-05 stock_movements mapping
R-06 dimensional inventory reconciliation
R-07 actual order status mapping
R-08 actual data readiness evidence
R-09 tenant fallback classification
R-10 architecture invariant vs migration prerequisite
```

For each:

- previous report statement;
- correction;
- evidence;
- impact on readiness gate.

---

# 15. IMPORTANT — DO NOT SILENTLY INVENT DATA

If live database data cannot be inspected safely, do NOT invent:

- row counts;
- collision counts;
- NULL counts;
- orphan counts;
- reconciliation results.

Use:

```text
NOT VERIFIED — LIVE DATA ACCESS NOT AVAILABLE
```

and explain what must be checked during the next authorized phase.

---

# 16. IMPORTANT — DO NOT CREATE PROMPT 12

Even if the corrected gate is:

```text
GO
```

DO NOT:

- create Prompt 12;
- generate migration SQL;
- create migration files;
- modify Prisma schema;
- modify application code.

The only output artifact is the corrected:

```text
/docs/validation/09_MIGRATION_READINESS_REPORT.md
```

plus console summary.

---

# 17. FINAL OUTPUT

At the end of your console response provide:

```text
PROMPT 11.1 CORRECTION COMPLETE

Gate:
[GO / GO WITH CONDITIONS / NO-GO]

Architecture consistency:
[PASS / ISSUE]

Current-state evidence:
[SUFFICIENT / PARTIAL / INSUFFICIENT]

Critical unresolved items:
[list]

Prompt 12:
[NOT AUTHORIZED — STOP]
```

Then STOP.

# END OF PROMPT 11.1
