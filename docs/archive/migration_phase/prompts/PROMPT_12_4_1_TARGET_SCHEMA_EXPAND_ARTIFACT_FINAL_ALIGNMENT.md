# PROMPT 12.4.1 --- TARGET SCHEMA ↔ EXPAND ARTIFACT FINAL ALIGNMENT

## Status

**NEXT EXECUTION STAGE: Prompt 12.4.1**

Preceding gate:

**BLOCKED / OWNER REVIEW REQUIRED**

Reason for this narrow correction stage:

The executable Expand migration artifact is internally more complete
than previous revisions, but the latest owner review found substantive
mismatches between the actual `migration(6).sql` target objects and the
authoritative **Target Database Schema Revision 4**.

This prompt exists only to align the executable Expand artifact to the
already-approved Target Schema Revision 4.

------------------------------------------------------------------------

# 1. AUTHORITATIVE SOURCES

Use the following hierarchy:

1.  Existing source code + existing database structure
2.  **Target Database Schema Revision 4**
3.  Approved Architecture Decisions
4.  Approved migration/readiness documents
5.  This prompt

The authoritative target schema is:

`/docs/04_TARGET_DATABASE_SCHEMA(3).md`

Document:

`ARCH-2026-09-DB-SCHEMA-04`

Do **NOT** redesign or reinterpret Target Schema Revision 4.

The migration must be corrected to match the target schema, not the
reverse.

------------------------------------------------------------------------

# 2. PRIMARY OBJECTIVE

Perform a final executable-artifact alignment between:

-   Target Schema Revision 4
-   actual `migration(6).sql`
-   preflight logic
-   ownership registry
-   rollback logic
-   object inventory
-   schema-contract tests
-   validation/revalidation reports

The required invariant is:

``` text
TARGET SCHEMA REVISION 4
=
ACTUAL MIGRATION OBJECT CONTRACT
=
PREFLIGHT CONTRACT
=
OWNERSHIP CONTRACT
=
ROLLBACK CONTRACT
=
DOCUMENTED OBJECT INVENTORY
=
SCHEMA CONTRACT TESTS
```

Any mismatch means the final gate remains:

**BLOCKED / OWNER REVIEW REQUIRED**

------------------------------------------------------------------------

# 3. STRICT SCOPE

This prompt is ONLY for final Expand-artifact contract alignment.

Allowed:

-   inspect Target Schema Revision 4
-   inspect actual migration SQL
-   inspect preflight SQL
-   inspect ownership registry
-   inspect rollback logic
-   inspect object inventory
-   inspect schema-contract tests
-   correct migration DDL
-   correct preflight expectations
-   correct ownership inventory
-   correct rollback ownership
-   correct tests
-   regenerate validation/reconciliation documentation
-   validate using a disposable isolated LOCAL PostgreSQL database if
    needed

Not allowed:

-   redesign Target Schema Revision 4
-   change approved ADR decisions
-   introduce new architecture
-   execute staging migration
-   execute production migration
-   execute Backfill
-   execute Dual-write
-   execute Cutover
-   execute Contract
-   start Prompt 13
-   modify legacy business behavior
-   perform destructive migration
-   perform live-data migration

------------------------------------------------------------------------

# 4. KNOWN TARGET-CONTRACT MISMATCHES

The following mismatches were identified during owner review.

Treat these as concrete correction targets, then independently compare
ALL 18 target tables against Revision 4 so that no additional mismatch
is missed.

## 4.1 RecipeItem

Target Revision 4 requires:

-   `id`
-   `tenant_id`
-   `recipe_id`
-   `inventory_item_id`
-   `quantity Decimal(12,3)`
-   `cost_ratio Decimal(5,4) DEFAULT 1.000`
-   `created_at`
-   `updated_at`

Target constraints/indexes include:

-   unique `(recipe_id, inventory_item_id)`
-   index `(tenant_id, inventory_item_id)`

Current migration was observed to contain:

-   extra `uom`
-   missing `cost_ratio`
-   missing `updated_at`
-   index structure not identical to target

Correct the migration and all dependent
preflight/ownership/inventory/test definitions.

Do NOT retain `uom` merely because it is convenient.

------------------------------------------------------------------------

## 4.2 ModifierGroup

Target Revision 4 requires:

-   no `is_active`
-   index `(tenant_id, name)`

Current migration was observed to contain:

-   extra `is_active`
-   index only on `tenant_id`

Correct to the target contract.

------------------------------------------------------------------------

## 4.3 ModifierItem

Target Revision 4 requires:

-   `is_default BOOLEAN DEFAULT false`
-   no `is_active`

Current migration was observed to contain:

-   extra `is_active`
-   missing `is_default`

Correct to the target contract.

------------------------------------------------------------------------

## 4.4 ProductModifierGroup

Target Revision 4 requires:

-   `created_at`

Current migration was observed to omit `created_at`.

Correct the migration and all dependent contract artifacts.

------------------------------------------------------------------------

## 4.5 ModifierRecipeEffect

Target Revision 4 requires:

-   `quantity_delta Decimal(12,3)`
-   `created_at`
-   no `uom`

Current migration was observed to contain:

-   extra `uom`
-   missing `created_at`

Correct to the target contract.

------------------------------------------------------------------------

## 4.6 ProductVariant barcode uniqueness

Target Prisma contract:

``` text
@@unique([tenantId, barcode])
```

Current migration was observed to use:

``` sql
CREATE UNIQUE INDEX ... (tenant_id, barcode)
WHERE barcode IS NOT NULL
```

For this stage, substantive index-definition equality is required.

Do not assume that practical PostgreSQL NULL behavior makes a partial
index contractually equivalent.

Either:

-   make the migration exactly represent the approved Target Schema
    Revision 4 semantics, or
-   if the target schema's generated PostgreSQL semantics require a
    specific equivalent representation, document and prove that
    equivalence explicitly.

Do not silently alter the target schema.

------------------------------------------------------------------------

## 4.7 InventoryBatch cost_price

Target Revision 4:

``` text
cost_price Decimal(15,4)
```

with no default specified.

Current migration was observed to add:

``` text
DEFAULT 0
```

Correct the migration to match the target contract.

------------------------------------------------------------------------

## 4.8 InventoryLedger unit_cost

Target Revision 4:

``` text
unit_cost Decimal(15,4)
```

with no default specified.

Current migration was observed to add:

``` text
DEFAULT 0
```

Correct the migration to match the target contract.

------------------------------------------------------------------------

# 5. FULL TABLE-BY-TABLE CONTRACT CHECK

Do NOT limit correction to the known mismatches above.

Perform a complete comparison for all 18 target tables:

1.  `inventory_items`
2.  `product_variants`
3.  `storage_locations`
4.  `inventory_batches`
5.  `inventory_balances`
6.  `inventory_ledgers`
7.  `unit_conversions`
8.  `recipes`
9.  `recipe_items`
10. `modifier_groups`
11. `modifier_items`
12. `product_modifier_groups`
13. `modifier_recipe_effects`
14. `payment_transactions`
15. `refunds`
16. `refund_items`
17. `idempotency_records`
18. `legacy_stock_movements`

For every table compare:

-   table name
-   every column
-   column order where relevant to the artifact contract
-   PostgreSQL type
-   enum/UDT
-   nullability
-   default expression
-   precision
-   scale
-   generated/identity behavior
-   primary key
-   unique constraints
-   foreign keys
-   FK actions
-   check constraints
-   indexes
-   index uniqueness
-   index predicate
-   index columns/order
-   relevant index expressions
-   target partial-index semantics where applicable

No subset-only validation is acceptable.

------------------------------------------------------------------------

# 6. INDEX CONTRACT

Every migration-created index must have an explicit contract.

Do NOT validate by:

-   count only
-   name only
-   table only
-   uniqueness only

Validate the complete definition using PostgreSQL metadata such as:

-   `pg_class`
-   `pg_index`
-   `pg_attribute`
-   `pg_indexes`
-   `pg_get_indexdef(...)`

The final inventory must reconcile every actual migration-created index.

There must be no:

-   undocumented index
-   unowned index
-   un-preflighted index
-   unverified index
-   rollback-uncontrolled owned index

------------------------------------------------------------------------

# 7. FOREIGN KEY / CONSTRAINT CONTRACT

Account for every FK and constraint actually touched or created by the
migration.

At minimum verify:

-   target-table FKs
-   transition-column FKs
-   unique constraints
-   primary keys
-   check constraints
-   delete/update actions
-   constraint ownership

Known transition FKs include:

-   `categories.parent_id -> categories.id ON DELETE SET NULL`
-   `order_items.product_variant_id -> product_variants.id ON DELETE RESTRICT`

Do not introduce unsupported composite tenant FKs.

Target Schema Revision 4 explicitly uses:

-   direct tenantId NOT NULL
-   service-layer tenant validation
-   RLS as future hardening

------------------------------------------------------------------------

# 8. TENANT ISOLATION CONTRACT

Do not alter the approved tenant architecture.

Operational/domain records must use direct tenant ownership according to
Target Schema Revision 4.

Do NOT introduce:

-   UserOutletAssignment
-   composite tenant FKs
-   synthetic tenant ownership mechanisms

unless they already exist in the authoritative target schema.

Phase 1 User model remains:

-   tenant-scoped `userCode`
-   internal UUID
-   optional email
-   required `pinHash`
-   nullable `outletId` for tenant-wide authority
-   non-null outlet assignment for branch-restricted staff

------------------------------------------------------------------------

# 9. INVENTORY CONTRACT

Preserve the approved inventory semantics.

## Physical stock baseline

``` text
InventoryBalance.quantityOnHand
```

is the canonical physical stock quantity.

Do NOT introduce:

``` text
InventoryBalance.isNegativeBalance
```

Negative stock state remains governed by:

-   `InventoryItem.allowNegativeStock`
-   `StorageLocation.allowNegativeStock`
-   approved policy hierarchy
-   actual `quantityOnHand`

`InventoryLedger.isNegativeBalance` remains valid because it exists in
Target Schema Revision 4.

------------------------------------------------------------------------

# 10. PRODUCT / VARIANT / INVENTORY CONTRACT

Preserve:

``` text
Product
  1:N
ProductVariant
  N:1
InventoryItem
```

This is target architecture.

Do not describe this as a target `1:1:1` structure.

The legacy migration may use a deterministic initial mapping where one
legacy Product becomes:

``` text
Product + ProductVariant + InventoryItem
```

with:

``` text
inventoryQuantityMultiplier = 1.000
```

This is a migration mapping, not the target cardinality.

------------------------------------------------------------------------

# 11. RECIPE / MODIFIER CONTRACT

Preserve Target Schema Revision 4 exactly.

Recipe:

-   belongs to ProductVariant
-   one Recipe per ProductVariant
-   RecipeItem references InventoryItem
-   RecipeItem uses `quantity` and `costRatio`

Modifiers are relational:

-   ModifierGroup
-   ModifierItem
-   ProductModifierGroup
-   ModifierRecipeEffect

Do not add convenience fields that are absent from target schema.

------------------------------------------------------------------------

# 12. ORDER / PAYMENT CONTRACT

Preserve:

``` text
OrderStatus
!=
PaymentStatus
```

Order target lifecycle includes:

-   DRAFT
-   CONFIRMED
-   IN_PROGRESS
-   READY
-   COMPLETED
-   CANCELLED
-   VOIDED

Payment target lifecycle includes:

-   UNPAID
-   PARTIALLY_PAID
-   PAID
-   PARTIALLY_REFUNDED
-   REFUNDED

PaymentTransaction remains a separate transaction record.

Do not redesign these enums in this prompt.

------------------------------------------------------------------------

# 13. LEGACY TABLE PROTECTION

All 18 legacy tables must remain protected.

The migration must not:

-   drop them
-   rename them
-   alter them destructively
-   reinterpret them as owned target objects

Transition-column additions must remain explicitly accounted for.

Any transition-column FK must be included in:

-   preflight
-   ownership
-   inventory
-   rollback
-   verification

------------------------------------------------------------------------

# 14. OWNERSHIP REGISTRY

The ownership registry must itself have a valid lifecycle.

Do not use:

``` sql
CREATE TABLE IF NOT EXISTS
```

as a substitute for contract verification.

If the registry already exists:

-   verify complete structure
-   verify ownership semantics
-   verify it is compatible
-   do not blindly drop it

If the registry is created by this migration:

-   register only objects actually owned by this migration
-   rollback must remove only objects owned by this migration

No object may be simultaneously:

-   pre-existing and migration-owned without explicit contract
-   migration-created but unregistered
-   registered but not actually created/touched
-   rollback-targeted without ownership proof

------------------------------------------------------------------------

# 15. OBJECT INVENTORY

Regenerate the object inventory from the corrected executable migration.

The inventory must be derived from the actual migration artifact, not
manually guessed.

Required reconciliation:

``` text
Actual SQL objects
        |
        v
Preflight objects
        |
        v
Ownership objects
        |
        v
Rollback objects
        |
        v
Documented inventory
        |
        v
Target schema contract
```

Any difference must be explicitly resolved.

Do not use a headline count as proof of equality.

If hierarchical counting is used, clearly distinguish:

-   top-level migration objects
-   nested table columns
-   constraints
-   indexes
-   FKs

Avoid ambiguous statements such as:

`96 touched objects`

unless the counting methodology is explicitly defined and reconciled.

------------------------------------------------------------------------

# 16. TEST REQUIREMENTS

Re-run and update the existing validation suite.

At minimum include tests for:

1.  exact target enum labels
2.  target table existence
3.  complete target table column contract
4.  nullability/default contract
5.  decimal precision/scale
6.  PK contract
7.  unique constraint contract
8.  complete FK contract
9.  FK actions
10. complete index definition
11. partial-index predicate contract
12. transition-column contract
13. transition FK contract
14. legacy-table preservation
15. ownership registry contract
16. rollback ownership safety
17. static forbidden-pattern scan
18. migration object reconciliation
19. target-schema-to-migration contract equality

All tests must pass before the final gate can be READY.

------------------------------------------------------------------------

# 17. STATIC SCAN

The final artifact must remain free of prohibited migration behavior,
including:

-   destructive legacy table drops
-   destructive legacy table renames
-   staging/production execution commands
-   `prisma migrate deploy` against staging/production
-   `prisma db push` against staging/production
-   Backfill execution
-   Dual-write execution
-   Cutover execution
-   Contract execution
-   Prompt 13 execution

`CREATE TABLE IF NOT EXISTS` may only remain where a prior complete
compatibility preflight makes it safe and where it does not replace
ownership verification.

------------------------------------------------------------------------

# 18. VALIDATION ENVIRONMENT

A disposable isolated LOCAL PostgreSQL database may be used.

It must not be:

-   staging
-   production
-   any shared environment

If the environment cannot validate a specific condition, report:

**NOT VERIFIED**

Do not convert lack of access into a passing result.

------------------------------------------------------------------------

# 19. REQUIRED DOCUMENTATION REGENERATION

After correcting the executable artifacts, regenerate/update the
relevant Prompt 12.4 documentation so it reflects the actual final
migration.

At minimum:

-   final revalidation report
-   object reconciliation report
-   ownership inventory
-   schema-contract test evidence
-   final artifact inventory

All documents must describe the same final artifact.

Do not edit reports merely to make an incorrect migration appear
compliant.

------------------------------------------------------------------------

# 20. ROLLBACK SAFETY

Rollback must be ownership-based.

For every object rollback attempts to remove:

``` text
ownership == MIGRATION_OWNED
```

must be proven.

Rollback must not drop:

-   pre-existing target tables
-   pre-existing indexes
-   pre-existing constraints
-   legacy tables
-   objects owned by another migration/process

No blind cleanup is acceptable.

------------------------------------------------------------------------

# 21. FINAL GATE

Return exactly one of the following:

### READY FOR OWNER REVIEW

Only if:

-   all target tables exactly match Revision 4
-   all target columns match
-   all defaults match
-   all nullability matches
-   all precision/scale match
-   all PK/unique/FK/check constraints match
-   all index definitions match
-   all transition columns/FKs are accounted for
-   all legacy tables are protected
-   ownership is complete
-   preflight is complete
-   rollback is ownership-safe
-   object inventory is reconciled
-   all validation tests pass
-   static scan passes
-   no staging/production migration executed
-   no Backfill/Dual-write/Cutover/Contract executed
-   no Prompt 13 started

OR:

### BLOCKED / OWNER REVIEW REQUIRED

If ANY contract mismatch, unknown object, unverified ownership,
incomplete rollback control, failed test, or unverified critical
condition remains.

Do not downgrade a mismatch to a warning merely to reach READY.

------------------------------------------------------------------------

# 22. STOP CONDITION

After returning the final gate:

**STOP.**

Do not:

-   start Prompt 13
-   execute Backfill
-   execute Dual-write
-   execute Cutover
-   execute Contract
-   execute staging migration
-   execute production migration

This prompt is complete only when the Expand artifact contract has been
revalidated against Target Schema Revision 4.
