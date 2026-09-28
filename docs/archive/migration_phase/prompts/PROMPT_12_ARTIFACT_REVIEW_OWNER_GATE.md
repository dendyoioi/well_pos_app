# PROMPT 12 ARTIFACT REVIEW — OWNER GATE

**Project:** Well POS Multi-Tenant SaaS Platform  
**Review Stage:** Prompt 12 Artifact Review  
**Date:** 19 September 2026  
**Gate:** **BLOCKED / OWNER REVIEW REQUIRED**

## Executive Verdict

The Prompt 12 package is **not ready for approval/execution** as currently produced.

The package has the correct overall migration philosophy — Expand → Backfill → Reconcile, additive DDL, legacy preservation, and no staging/production execution — but the generated SQL and supporting documents contain several **target-schema mismatches** that must be resolved before any database migration is authorized.

## BLOCKER Findings

### B-01 — Expand SQL does not implement the complete Revision 4 inventory dimension

Target Revision 4 requires `inventoryBatchId` on both `InventoryBalance` and `InventoryLedger`, including batch-aware uniqueness and references.

The generated `migration.sql` omits `inventory_batch_id` from both tables.

**Impact:** Batch-aware stock cannot be represented consistently with the locked target architecture.

**Disposition:** BLOCKER.

### B-02 — ProductVariant incorrectly makes InventoryItem mandatory

Target Revision 4 allows three strategies:

1. direct InventoryItem linkage;
2. Recipe linkage;
3. SERVICE_LABOR with no physical inventory.

Therefore `ProductVariant.inventoryItemId` is nullable.

The generated Expand SQL declares:

`inventory_item_id TEXT NOT NULL`

**Impact:** SERVICE_LABOR and recipe-based variants cannot conform to the target schema.

**Disposition:** BLOCKER.

### B-03 — Tenant target fields are wrong/incomplete

Revision 4 requires target Tenant fields including:

- `business_vertical`
- `status`
- `allow_negative_stock`
- `enable_batch_tracking`
- `enable_recipe_tracking`

The generated Expand SQL adds:

- `business_vertical`
- `timezone`
- `currency`
- `settings`
- `address`

but does not add the required `allow_negative_stock`, `enable_batch_tracking`, and `enable_recipe_tracking` target fields.

**Impact:** Negative-stock and batch/recipe feature policy cannot be represented according to Revision 4.

**Disposition:** BLOCKER.

### B-04 — InventoryItem target fields are incomplete

Revision 4 includes:

- `purchase_uom`
- `reorder_point`
- `target_level`
- nullable `allow_negative_stock`
- `is_batched`

The generated SQL only includes `canonical_uom`, `average_cost`, and non-null `allow_negative_stock`.

**Impact:** UOM/purchasing semantics, reorder configuration, batch tracking, and the approved negative-stock hierarchy are not faithfully represented.

**Disposition:** BLOCKER.

### B-05 — StorageLocation negative-stock override has wrong nullability

Revision 4 uses nullable `allowNegativeStock` as an override. The generated SQL makes it `NOT NULL DEFAULT false`.

**Impact:** It collapses the approved inheritance/override hierarchy.

**Disposition:** BLOCKER.

### B-06 — UnitConversion column names do not match Revision 4

Target uses `conversion_factor`; generated SQL creates `multiplier`.

**Impact:** Structural mismatch between migration artifact and Prisma target.

**Disposition:** BLOCKER.

### B-07 — InventoryLedger actor/batch structure is incomplete

Revision 4 requires:

- `inventory_batch_id`
- `actor_user_id`
- `reference_id` as part of the immutable movement record
- actor-user relation with RESTRICT semantics.

Generated SQL instead has `actor_id` and omits `inventory_batch_id` and the explicit actor-user FK.

**Impact:** Ledger schema does not match the approved target.

**Disposition:** BLOCKER.

### B-08 — Legacy enum reuse is unsafe

The generated SQL uses:

`CREATE TYPE ... EXCEPTION WHEN duplicate_object THEN null`

for enum names that overlap legacy enums.

This silently accepts an existing enum without verifying that its labels exactly match Revision 4.

**Impact:** A legacy enum with incompatible values can be silently reused by new target columns.

This is especially dangerous for lifecycle enums such as `OrderStatus`, `PaymentStatus`, `Role`, `ProductType`, and others.

**Disposition:** BLOCKER.

### B-09 — Target enum vocabulary is internally inconsistent with Backfill Design

The generated migration defines:

`StockMovementType.OPNAME_ADJUSTMENT`

but Backfill Design refers to:

`StockMovementType.ADJUSTMENT`

The migration also adds:

`InventoryRefType.SYSTEM_INITIALIZATION`

while the locked Revision 4 vocabulary does not define that value.

**Impact:** Backfill scaffolding cannot run against the generated target enum set without modification.

**Disposition:** BLOCKER.

### B-10 — Payment / Order transition is incomplete

The target `Order` requires target lifecycle fields including `orderStatus`, `paymentStatus`, `orderType`, `paidAmount`, and `changeAmount`.

The generated Expand SQL does not add the target `order_type`.

More importantly, the existing legacy `payment_status` column may use the legacy enum semantics. The Expand package does not provide a safe transition mechanism for changing that semantic contract while retaining backward compatibility.

**Disposition:** BLOCKER until exact legacy enum/column transition is explicitly designed.

## HIGH Findings

### H-01 — Reconciliation query can miss missing InventoryBalance rows

The physical parity query uses a `LEFT JOIN`, but filters only:

`WHERE op.stock != ib.quantity_on_hand`

When `ib` is missing, `ib.quantity_on_hand` is NULL and the comparison is UNKNOWN, so the row is not reported.

The reconciliation therefore can incorrectly pass despite a missing target balance.

**Required invariant:** explicitly detect `ib.id IS NULL OR op.stock != ib.quantity_on_hand`.

### H-02 — Ledger reconciliation ignores batch dimension

The balance-vs-ledger query reconciles only:

`tenant + inventoryItem + storageLocation`

but Revision 4 has a fourth stock dimension:

`inventoryBatchId`.

Batch-specific balances and ledger movements must be reconciled independently.

### H-03 — Backfill opening ledger vocabulary is invalid

Backfill Design specifies:

`movementType = StockMovementType.ADJUSTMENT`

which is not present in the generated enum. This is also inconsistent with the approved Revision 4 vocabulary.

### H-04 — Backfill itemCode fallback is collision-prone

The fallback:

`product.sku || '-INV'`

does not guarantee uniqueness if multiple products have the same/null legacy SKU.

The target requires tenant-scoped unique `InventoryItem.itemCode`.

### H-05 — Backfill negative-stock policy is not fully aligned

The design discusses policy hierarchy but initializes `InventoryItem.allowNegativeStock = false` and `StorageLocation.allowNegativeStock = false`.

Revision 4 defines nullable overrides with inheritance from Tenant → StorageLocation → InventoryItem.

The backfill should preserve/derive policy without collapsing the hierarchy.

### H-06 — Expand artifact adds non-target Tenant/Outlet fields without an approved transition decision

`timezone`, `currency`, `settings`, `address`, latitude/longitude, etc. are not part of the locked Revision 4 target model as currently specified.

These should not be added merely because they are convenient migration fields.

## POSITIVE Findings

The following portions are materially correct:

- Expand is explicitly additive and avoids destructive operations in the forward migration.
- Legacy tables/columns are intentionally retained.
- `InventoryBalance.isNegativeBalance` was correctly NOT introduced.
- `InventoryLedger.isNegativeBalance` is present.
- Physical stock baseline correctly uses `outlet_products.stock = InventoryBalance.quantityOnHand`.
- Multiplier is treated as transaction conversion, not as a divisor of physical opening stock.
- Product → ProductVariant → InventoryItem is treated as a target 1:N/N:1 architecture with legacy 1:1:1 mapping.
- User Model B correctly uses `userCode` + `pinHash` and does not introduce synthetic PIN-reset fields.
- Reconciliation is intended to be zero-tolerance and tenant/dimension aware.
- The package explicitly states that no staging/production migration was executed.

## Gate Decision

**PROMPT 12: BLOCKED / OWNER REVIEW REQUIRED**

Do **not**:

- run the generated migration against staging;
- run it against production;
- run `prisma migrate deploy`;
- run `prisma db push`;
- start Backfill;
- start Dual-Write;
- start Cutover;
- start Contract.

The artifact package needs a correction/reconciliation pass against the exact Revision 4 schema before it can become an approved migration package.

## Recommended Next Gate

Owner review should first approve the finding set above.

Only after that should a narrow correction prompt be issued to Antigravity to:

1. reconcile `migration.sql` with Revision 4;
2. reconcile Backfill Design with actual enum/model vocabulary;
3. repair reconciliation SQL;
4. regenerate/validate rollback;
5. rerun static validation;
6. return a new Prompt 12 gate.

**Prompt 13 must remain STOPPED.**
