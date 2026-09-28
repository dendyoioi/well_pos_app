# PROMPT_13_3_BACKFILL_RECONCILIATION_AND_EXECUTION_READINESS.md

## Prompt 13.3 — Backfill Reconciliation & Execution Readiness

### 1. Stage / Scope

**Stage:** Prompt 13.3  
**Mode:** READ-ONLY RECONNAISSANCE / RECONCILIATION / DESIGN  
**Target Database:** `pos_db`  
**Purpose:** Reconcile the authoritative Backfill Design against the now-live post-Expand database before any Backfill execution.

This prompt does NOT authorize Backfill execution.

### 2. Current Lifecycle Position

The migration lifecycle is now:

```text
Prompt 13.2B
ENUM TRANSITION
        ↓
SUCCESS / VALIDATED
        ↓
Prompt 13.2C
EXPAND RETRY
        ↓
SUCCESS / VALIDATED
        ↓
>>> CURRENT STAGE: PROMPT 13.3 <<<
        ↓
BACKFILL EXECUTION
        ↓
DUAL-WRITE
        ↓
RECONCILIATION / CUTOVER
```

Prompt 13.2C successfully created the Expand schema and preserved the 18 legacy tables / 17 legacy rows.

Application remains OFFLINE.

### 3. Source of Truth

Inspect and reconcile:

1. `/docs/architecture/04_TARGET_DATABASE_SCHEMA.md`
2. `/docs/validation/10_PROMPT_12_BACKFILL_DESIGN.md` (authoritative historical Backfill Design)
3. `/docs/validation/09_MIGRATION_READINESS_REPORT.md`
4. `/docs/validation/15_PROMPT_13_2B_ENUM_TRANSITION_EXECUTION_FINAL_REPORT.md`
5. `/docs/validation/15_PROMPT_13_2C_EXPAND_RETRY_EXECUTION_FINAL_REPORT.md`
6. `/docs/validation/15_PROMPT_13_2C_EXPAND_RETRY_EXECUTION_EVIDENCE.md`
7. `/server/prisma/schema.prisma`
8. All actual post-Expand target tables and constraints in `pos_db`
9. Existing Backfill scaffolding / scripts under `/server/src/migrations/`
10. Existing reconciliation scripts and tests

Source-of-truth hierarchy:

```text
Actual source code + live pos_db
        ↓
Target Schema Revision 4
        ↓
Approved architecture / owner decisions
        ↓
Approved Backfill Design
        ↓
Generated scaffolding
```

Do not silently preserve an outdated Backfill assumption when it conflicts with the actual target schema.

### 4. Absolute Prohibitions

DO NOT:

- execute Backfill;
- update/insert/delete target or legacy business data;
- reset / truncate / delete;
- run Backfill workers;
- run `--dry-run` if implementation would mutate anything indirectly;
- start Dual-write;
- start Cutover;
- start Contract;
- modify application source;
- restart application;
- run `prisma generate`;
- modify Expand migration or rollback;
- alter enums;
- create ad-hoc schema objects.

Read-only SQL inspection is allowed.

Disposable database testing is allowed only if isolated and clearly identified.

### 5. Phase 1 — Re-Inventory the Post-Expand Database

Read-only verify:

- database identity;
- PostgreSQL version;
- application quiescence;
- 18 protected legacy tables;
- 18 target core tables;
- 20 total custom enums;
- 23 transition columns;
- 34 target indexes;
- 42 total expected FKs (40 core + 2 transition);
- ownership registry;
- enum transition registry;
- total legacy rows;
- target table current row counts.

Produce an authoritative post-Expand baseline.

### 6. Phase 2 — Backfill Source / Target Mapping

Analyze every planned Backfill mapping from the historical design.

Minimum mappings:

```text
Legacy Product
    → Target Product / ProductVariant / InventoryItem

Legacy Outlet
    → Target StorageLocation

Legacy OutletProduct.stock
    → Target InventoryBalance.quantityOnHand

Legacy Category
    → Target Category transition fields where applicable

Legacy User
    → Target User Model B transition fields

Legacy Order / OrderItem
    → Target order transition columns / ProductVariant references

Legacy Payment
    → Target PaymentTransaction

Legacy StockMovement
    → DO NOT treat prototype stock_movements as historical inventory ledger.
      Follow ODR-05: legacy history is not historically backfilled.
```

For every mapping:

- identify source table;
- identify target table;
- identify target primary key strategy;
- identify deterministic ID strategy;
- identify tenant scope;
- identify outlet/location scope;
- identify uniqueness constraints;
- identify nullable/default behavior;
- identify transformation rules;
- identify source rows;
- identify target rows already present;
- identify collision risks.

### 7. Phase 3 — Deterministic ID Verification

Audit the existing UUIDv5 strategy from the Backfill Design.

Verify that deterministic IDs:

- are stable;
- are tenant-safe;
- cannot collide across entity types;
- do not collide with existing target rows;
- preserve repeatability across reruns.

Test proposed namespaces / names against actual current target primary keys.

Do not create rows.

### 8. Phase 4 — Inventory Backfill Reconciliation

This is the highest-risk portion.

Verify:

#### Product → ProductVariant → InventoryItem

Confirm the approved target cardinality:

```text
Product 1:N ProductVariant
ProductVariant N:1 InventoryItem
```

For current legacy data, determine whether default mapping is:

```text
1 legacy Product
→ 1 default ProductVariant
→ 1 InventoryItem
```

Confirm SKU/barcode placement:

- ProductVariant owns SKU/barcode.
- InventoryItem owns itemCode.
- No collision-prone fallback may be accepted.

#### Opening Stock

Confirm:

```text
Legacy outlet_products.stock
→ InventoryBalance.quantityOnHand
```

Do NOT divide opening physical stock by
`inventoryQuantityMultiplier`.

Multiplier applies only to transaction conversion.

#### Inventory Ledger

Under ODR-05:

```text
legacy stock_movements history
≠
historical InventoryLedger backfill
```

The approved strategy is clean inventory initialization / opening balance at go-live.

Identify exactly how the Backfill implementation must handle
`inventory_ledgers` without violating ODR-05.

### 9. Phase 5 — Tenant / Location / Batch Dimensions

Verify reconciliation uses:

```text
tenant
+ inventoryItem
+ storageLocation
+ inventoryBatch
```

where batch dimension is applicable.

Do not reconcile only by:
```text
tenant + inventoryItem + location
```
when the batch dimension exists.

Verify:

- default StorageLocation per outlet;
- warehouse semantics (`Outlet.isWarehouse`);
- batch tracking flags;
- target InventoryBalance uniqueness;
- target StorageLocation uniqueness;
- target InventoryBatch uniqueness.

### 10. Phase 6 — Negative Stock Policy

Verify target hierarchy:

```text
Tenant
   ↓ override
StorageLocation
   ↓ override
InventoryItem
```

Do not collapse nullable overrides to hard-coded false unless the
approved target contract requires it.

Determine exact Backfill initialization semantics for:

- `Tenant.allowNegativeStock`
- `StorageLocation.allowNegativeStock`
- `InventoryItem.allowNegativeStock`

Do not change schema in this prompt.

### 11. Phase 7 — User Model B

Verify historical User → target User Model B mapping:

Required target concepts:

- tenantId
- optional outletId
- userCode
- optional email
- pinHash
- role

Verify:

- deterministic userCode rules;
- uniqueness within tenant;
- outletId nullability semantics;
- PIN hashing / provisioning requirements;
- legacy plaintext / missing PIN handling;
- no invented `mustChangePin` field;
- no invented `UserOutlet` table for Phase 1.

If any user cannot be deterministically provisioned, classify it as a blocker.

### 12. Phase 8 — Order / Payment Backfill Applicability

Determine whether actual post-Expand legacy rows require mapping for:

- orders;
- order_items;
- payments;
- saas_invoices.

Current baseline is only 17 rows, so inspect actual counts and values.

Verify:

- OrderStatus mapping;
- PaymentStatus mapping;
- PaymentTransaction mapping;
- historical payment semantics;
- no accidental reuse of legacy `payments` as target transaction ledger;
- target `OrderItem.costPrice` historical snapshot integrity;
- target `product_variant_id` transition FK.

### 13. Phase 9 — Modifier / Recipe / Service Implications

Determine whether current legacy data requires any Backfill into:

- ModifierGroup
- ModifierItem
- ProductModifierGroup
- Recipe
- RecipeItem

For current legacy data, distinguish:

```text
No source data
vs
Source data exists but mapping incomplete
vs
Source data maps deterministically
```

Do not invent recipes/modifiers merely to populate empty target tables.

### 14. Phase 10 — Batch / UOM / Packaging

Verify target separation:

```text
Physical Inventory UOM
Purchasing UOM
Commercial Packaging
```

Confirm that current Backfill Design does not collapse these concepts.

Verify:

- canonicalUom;
- purchaseUom;
- UnitConversion;
- ProductVariant.inventoryQuantityMultiplier;
- InventoryBatch when applicable.

### 15. Phase 11 — Backfill Idempotency / Concurrency

Review the historical Backfill worker design for:

- tenant-scoped transactions;
- deterministic UUIDs;
- upsert strategy;
- unique constraints;
- repeatability;
- rerun after partial failure;
- transaction boundaries;
- concurrent execution hazards.

Do not implement.

Determine exact invariant required for rerunning Backfill safely.

### 16. Phase 12 — Reconciliation Requirements

Define mandatory zero-tolerance reconciliation after Backfill.

At minimum:

#### Entity reconciliation
```text
Legacy Product ↔ ProductVariant ↔ InventoryItem
Legacy Outlet ↔ StorageLocation
Legacy OutletProduct ↔ InventoryBalance
Legacy User ↔ User
```

#### Inventory reconciliation
```text
tenant
+ location
+ item
+ batch
+ UOM
```

#### Financial / Order reconciliation
```text
orders
order_items
payments
payment_transactions
```

#### Count / sum reconciliation
- source row counts;
- target row counts;
- source quantities;
- target quantities;
- unmapped IDs;
- duplicate IDs;
- orphan references.

Any unexplained discrepancy is a blocker.

### 17. Phase 13 — Dry-Run Design

Determine whether the existing Backfill scaffolding can support a
true read-only `--dry-run`.

Dry-run MUST NOT modify:

- legacy tables;
- target tables;
- registry tables;
- migration metadata.

If current implementation does not satisfy this, identify exact
changes needed before execution.

### 18. Phase 14 — Application Boundary

Application remains:

```text
OFFLINE
```

Do not modify or restart it.

Backfill must be designed to run independently of application runtime
until the later Dual-write / Cutover stage.

### 19. Phase 15 — Owner Decisions Required

Identify only decisions that are genuinely unresolved.

Do not invent new decisions when existing approved architecture already
answers the issue.

For every required decision, provide:

- exact question;
- current evidence;
- available options;
- impact;
- affected artifact;
- whether live DDL/DML would be involved.

### 20. Required Output

Create:

```text
/docs/validation/16_PROMPT_13_3_BACKFILL_RECONCILIATION_AND_EXECUTION_READINESS.md
```

Sections:

1. Executive Summary
2. Current Post-Expand Baseline
3. Files / Artifacts Inspected
4. Legacy-to-Target Mapping Matrix
5. Product / Variant / Inventory Reconciliation
6. Outlet / StorageLocation Reconciliation
7. Opening Stock / InventoryLedger Policy
8. Tenant / Batch / UOM / Negative Stock Reconciliation
9. User Model B Reconciliation
10. Order / Payment Reconciliation
11. Recipe / Modifier / Services Reconciliation
12. Deterministic ID / Idempotency Review
13. Dry-Run Safety Review
14. Reconciliation / Invariant Checklist
15. Exact Blockers
16. Owner Decisions Required
17. Final Gate

### 21. Final Gate

Use exactly one:

```text
READY FOR OWNER DECISION
```

or:

```text
BLOCKED / OWNER REVIEW REQUIRED
```

Do NOT use a READY gate to imply that Backfill execution is authorized.

### 22. Mandatory Stop

After the report is created:

STOP.

Do not execute Backfill.

Do not write target data.

Do not run `--dry-run` if it is not proven read-only.

Do not begin Dual-write, Cutover, Contract, or Prompt 14+.

END OF PROMPT 13.3
