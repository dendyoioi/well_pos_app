# PROMPT 12 --- DATABASE MIGRATION SCRIPTING & EXPAND-PHASE DDL IMPLEMENTATION

**Project:** Well POS / `pos_apps`\
**Execution Stage:** Post Prompt 11.3 Owner Approval\
**Mode:** IMPLEMENTATION PREPARATION / SCRIPTING ONLY\
**Current Gate:** Prompt 11 = `GO WITH CONDITIONS`\
**Critical Rule:** **DO NOT EXECUTE DATABASE MIGRATION**

## 1. ROLE

You are **Antigravity**, acting as the primary implementation and
architecture agent for Well POS.

Prompt 11.3 has been reviewed by the Project Owner and approved to
proceed to Prompt 12.

Your responsibility is to translate the approved Target Database Schema
Revision 4 and migration-readiness conditions into a **reversible,
non-destructive EXPAND-phase migration package**.

This prompt does **NOT** authorize production/staging database
execution.

You may inspect the repository, current Prisma schema, migration state,
application code, and database-related scripts. You may create migration
files, SQL scripts, TypeScript backfill/reconciliation scaffolding,
documentation, and tests.

You may run static validation, TypeScript compilation, Prisma
validation, SQL parsing/linting, and tests against an explicitly
isolated/local disposable test database.

You must stop before executing any migration against a
real/staging/production database.

## 2. SOURCE-OF-TRUTH HIERARCHY

Use this hierarchy strictly:

1.  Existing source code + current database schema/migration state
2.  Approved Architecture Decisions
3.  Approved Target Database Schema Revision 4
4.  Approved Migration Readiness Report
5.  This Prompt 12
6.  AI-generated implementation

If a conflict is discovered: - Do not silently resolve it. - Document
the conflict. - Preserve the higher-priority source of truth. - Mark it
`BLOCKED / OWNER REVIEW REQUIRED` if implementation cannot safely
proceed.

## 3. REQUIRED DOCUMENTS TO READ FIRST

Read:

1.  `/docs/validation/09_MIGRATION_READINESS_REPORT.md`
2.  `/docs/architecture/04_TARGET_DATABASE_SCHEMA.md` --- Revision 4
3.  `/docs/architecture/03_DATA_ARCHITECTURE_RFC.md` --- Revision 4
4.  `/docs/decisions/ADR-001` through `/docs/decisions/ADR-005`
5.  Current `server/prisma/schema.prisma`
6.  Existing Prisma migration history, if present
7.  Relevant migration/database scripts
8.  Relevant domain/application services and controllers

Do not assume the conceptual schema and active Prisma schema are
identical.

## 4. FIRST TASK --- REPOSITORY & SCHEMA RECONNAISSANCE

Create:

`/docs/validation/10_PROMPT_12_RECONNAISSANCE.md`

Document: - current Prisma model/enum counts; - current schema status; -
whether migration history exists; - whether repository uses
`prisma migrate`, `db push`, raw SQL, or another mechanism; -
drift/mismatch between active schema, Target Revision 4, and migration
history; - actual Prisma-to-SQL naming conventions and identifiers; -
nullable legacy tenant fields; - legacy `users.pin`,
`products.sku`/`barcode`, `outlet_products.stock`, `stock_movements`,
`payments`, `hold_orders`; - active orders/shifts implications; - which
validation queries can be prepared now and which require actual DB
access.

No live data counts may be invented.

## 5. EXPAND-PHASE OBJECTIVE

The Expand phase must be: - reversible; - additive; - backward
compatible; - non-destructive; - safe to deploy before Backfill; - safe
while legacy application code still operates.

It must NOT remove or rename existing production columns/tables.

## 6. REQUIRED EXPAND SCOPE

Evaluate/create structures required by Target Revision 4, including as
applicable:

### Core / SaaS

-   strict tenant ownership fields where genuinely additive;
-   Model B `userCode` and `pinHash`.

### Product / Catalog

-   `ProductVariant`;
-   target supporting indexes/constraints;
-   ProductVariant → Product relationship.

### Inventory

-   `InventoryItem`
-   `StorageLocation`
-   `InventoryBalance`
-   `InventoryLedger`
-   `InventoryBatch`
-   `UnitConversion`

### Commerce / F&B

-   `Recipe`
-   `RecipeItem`
-   `ModifierGroup`
-   `ModifierItem`
-   `ProductModifierGroup`
-   `ModifierRecipeEffect`

### Order / Payment

-   target Order lifecycle fields required by Revision 4;
-   `PaymentTransaction`
-   `Refund`
-   `RefundItem`

### Reliability

-   `IdempotencyRecord`

### Services Phase 1

Implement only structures actually approved for Phase 1. Do not invent a
full appointment/work-order implementation if it is absent from Target
Revision 4.

## 7. REQUIRED SCHEMA DIFF

Create:

`/docs/validation/10_PROMPT_12_SCHEMA_DIFF.md`

Use:

  ------------------------------------------------------------------------------
  Area       Current    Target     Expand     Backfill     Contract   Risk
                                   Action     Dependency   Action     
  ---------- ---------- ---------- ---------- ------------ ---------- ----------

  ------------------------------------------------------------------------------

Before generating SQL: 1. Compare active Prisma schema with Revision 4.
2. Identify exact additions. 3. Identify exact modifications. 4.
Identify destructive changes that must be deferred to Contract. 5.
Identify fields requiring nullable staging before NOT NULL. 6. Identify
constraints that cannot safely be added until after Backfill.

Do not silently make destructive changes.

## 8. TENANT ISOLATION

Follow Revision 4:

`tenantId NOT NULL + tenant-scoped uniqueness + service-layer tenant validation`

Do NOT introduce Phase-1 composite foreign keys unless explicitly
present in approved Target Revision 4.

Do NOT introduce RLS unless already approved as a Phase-1 implementation
requirement.

For legacy nullable tenant IDs, do not immediately enforce NOT NULL if
NULL data may exist. Prepare the audit/backfill path first.

## 9. USER MODEL B

Target structure includes: - `tenantId` - `outletId?` - `userCode` -
`name` - `email?` - `passwordHash?` - `pinHash` - `role` - `isActive`

During Expand: - `userCode` may be nullable temporarily; - `pinHash` may
be nullable temporarily; - keep legacy `pin`; - do NOT add
`mustChangePin`; - do NOT add `forcePinReset`; - do NOT add
`pinResetRequired`.

Document later Backfill and Contract conditions.

## 10. PRODUCT → VARIANT → INVENTORY

Target cardinality:

`Product 1:N ProductVariant N:1 InventoryItem`

Legacy default mapping:

`Legacy Product → ProductVariant (1) → InventoryItem (1)`

Do not encode legacy 1:1:1 as target cardinality.

During Expand: - create target structures; - retain legacy Product
SKU/barcode; - retain legacy stock; - do not perform data backfill in
the DDL-only Expand migration unless explicitly required for safe
structural initialization.

## 11. INVENTORY

Canonical physical stock:

`InventoryBalance.quantityOnHand`

Transaction conversion:

`Order Quantity × ProductVariant.inventoryQuantityMultiplier = physical inventory quantity consumed`

Never use `quantityOnHand / inventoryQuantityMultiplier` as
opening-stock reconciliation.

`InventoryLedger` is an **immutable append-only stock movement ledger**,
not accounting double-entry.

Include approved fields including: - quantity delta; - balance
before/after; - unit cost; - movement type; - reference type/id; - actor
information; - notes; - `isNegativeBalance`.

Never add `InventoryBalance.isNegativeBalance`.

## 12. NEGATIVE STOCK

Preserve ADR-002 hierarchy:

`InventoryItem → StorageLocation → Tenant`

Expand only prepares structures.

If permitted: - negative `InventoryBalance.quantityOnHand` may exist; -
relevant ledger entry uses `InventoryLedger.isNegativeBalance = true`.

If not permitted: - classify as migration exception requiring manual
resolution.

## 13. UOM / DECIMAL

Respect: - inventory quantities: `Decimal(12,3)` -
packaging/multipliers: `Decimal(12,3)` - UOM conversions:
`Decimal(12,6)` - monetary prices/totals: `Decimal(15,2)` - inventory
costs: `Decimal(15,4)` - tax rates: `Decimal(5,4)`

No integer stock conversion. No floating-point arithmetic in
migration/backfill logic.

## 14. STORAGE LOCATION

Prepare `StorageLocation` according to Revision 4.

Legacy mapping:

`Outlet → Default StorageLocation`

Preserve tenant, outlet, warehouse/storefront distinction, and
default-location uniqueness.

If approved partial unique indexes require raw SQL, implement them
safely without changing semantics.

## 15. PRODUCT VARIANT UNIQUENESS

SKU and barcode uniqueness belongs to `ProductVariant`:

-   `tenantId + sku`
-   `tenantId + barcode`

If legacy duplicates can prevent safe constraint creation: - do not
force the constraint; - document the prerequisite audit; - defer
enforcement until the safe phase.

## 16. ORDER / PAYMENT

Do not collapse Order and Payment lifecycle.

Prepare: - `OrderStatus` - `PaymentStatus` - `PaymentTransaction` -
`Refund` - `RefundItem`

Preserve legacy `payments` and checkout behavior during Expand.

Do not delete/rename legacy payment structures.

## 17. HOLD ORDERS

Keep retention as:

`OWNER DECISION REQUIRED`

Prepare support for `OrderStatus.DRAFT` if required, but do not purge
historical hold orders.

## 18. IDEMPOTENCY

Prepare `IdempotencyRecord` with approved tenant-scoped uniqueness.

Do not retrofit idempotency into every legacy transaction in this
prompt.

## 19. BACKFILL WORKER SCAFFOLDING

Prepare, but do not execute against production/staging.

Use the repository's existing script convention, preferably under
`server/src/migrations/` if appropriate.

Prepare modules for: 1. tenant normalization audit; 2. StorageLocation
provisioning; 3. Product → ProductVariant; 4. ProductVariant →
InventoryItem; 5. OutletProduct → InventoryBalance; 6. inventory opening
ledger calibration; 7. User → Model B identity; 8. OrderItem →
ProductVariant; 9. Payment → PaymentTransaction; 10. legacy stock
movement archival; 11. reconciliation.

Workers should be deterministic, tenant-scoped, transaction-safe,
explicit about unresolved records, and dry-run capable.

## 20. USER CREDENTIAL BACKFILL

Planning/scaffolding only.

If legacy PIN exists:
`pin IS NOT NULL → verify representation → approved bcrypt/Argon2id → User.pinHash`

If legacy PIN is NULL:
`pin IS NULL → credential provisioning/reset procedure → no schema reset flag → success requires pinHash`

If representation cannot be established:
`LEGACY PIN REPRESENTATION NOT VERIFIED`

Never log or output plaintext PINs.

## 21. DETERMINISTIC IDENTIFIERS

Preserve approved mappings where required, such as:

``` text
uuidv5(product.id, 'variant')
uuidv5(product.id, 'inventory_item')
uuidv5(outlet.id, 'default_location')
```

Do not replace deterministic IDs with random IDs where repeatability
would be lost.

## 22. RECONCILIATION PACKAGE

Prepare read-only reconciliation queries/scripts covering:

### Tenant

-   NULL tenant IDs;
-   parent/child tenant mismatch.

### Product

-   SKU duplicates per tenant;
-   barcode duplicates per tenant;
-   Product → ProductVariant coverage;
-   ProductVariant → InventoryItem coverage.

### Inventory

Use exact dimensions:

`tenant + location + inventory item + batch where applicable + UOM where applicable`

Opening balance:

`legacy outlet_products.stock = InventoryBalance.quantityOnHand`

For default legacy mapping:

`inventoryQuantityMultiplier = 1.000`

Separately validate transaction conversion:

`Order Quantity × inventoryQuantityMultiplier = physical inventory deduction`

Never divide `quantityOnHand` by the multiplier.

### Ledger

Verify approved ledger semantics:

`opening + movements = current balance`

### Users

Verify active PIN-authenticated users have: `userCode != NULL` and
`pinHash != NULL`

### Payments

Verify order/payment parity without assuming all historical data is
already clean.

All reconciliation must be tenant-scoped.

## 23. ROLLBACK / ABORT DESIGN

Document: - migration transaction boundaries; - PostgreSQL transactional
DDL considerations; - additive/reversible portions; - non-reversible
data transformation boundaries; - backup requirements; - abort
conditions; - reconciliation failure behavior.

Do not claim full reversibility after data transformation.

## 24. TESTING

Before completion:

### Static

-   Prisma schema validation;
-   TypeScript type checking;
-   migration SQL syntax validation where possible;
-   lint relevant new files.

### Structural

Verify: - target tables/models; - indexes/constraints; - no forbidden
destructive operations; - no `InventoryBalance.isNegativeBalance`; - no
`mustChangePin`; - no `forcePinReset`; - no UserOutletAssignment; - no
unintended composite FKs; - no premature legacy drops.

### Safety

Scan generated SQL for: `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`,
`DELETE`.

If any appear in the Expand migration: - stop; - mark
`BLOCKED / OWNER REVIEW REQUIRED`; - do not claim Expand readiness.

## 25. REQUIRED DELIVERABLES

Documentation:

``` text
/docs/validation/10_PROMPT_12_RECONNAISSANCE.md
/docs/validation/10_PROMPT_12_SCHEMA_DIFF.md
/docs/validation/10_PROMPT_12_EXPAND_PLAN.md
/docs/validation/10_PROMPT_12_BACKFILL_DESIGN.md
/docs/validation/10_PROMPT_12_RECONCILIATION_PLAN.md
/docs/validation/10_PROMPT_12_EXECUTION_GUARDRAILS.md
```

Implementation artifacts: - appropriate Prisma migration / SQL migration
artifacts; - backfill worker scaffolding; - reconciliation scripts; -
migration tests;

using repository conventions.

Do NOT execute against staging/production.

## 26. ACCEPTANCE CRITERIA

Acceptable only if: 1. additive and non-destructive; 2. legacy tables
intact; 3. legacy columns intact; 4. existing checkout behavior not
intentionally broken; 5. target structures match Revision 4; 6. tenant
isolation preserved; 7. Product → Variant → Inventory cardinality
correct; 8. InventoryBalance is physical baseline; 9. multiplier is
transaction conversion only; 10. InventoryLedger is append-only stock
movement history; 11. negative stock follows ADR-002; 12. Model B has no
nonexistent reset fields; 13. SKU/barcode uniqueness is on
ProductVariant; 14. hold-order policy remains Owner Decision Required;
15. no real staging/production migration executed; 16. no destructive
Expand SQL; 17. reconciliation can run before Contract; 18.
rollback/abort boundaries documented.

## 27. PROMPT 12 GATE

Use exactly one:

`READY FOR OWNER REVIEW`

or

`BLOCKED / OWNER REVIEW REQUIRED`

Do not use `GO`, `GO WITH CONDITIONS`, or `NO-GO` as the Prompt 12
verdict.

`READY FOR OWNER REVIEW` means the Expand package is prepared, no
forbidden destructive operation exists, no unresolved architecture
contradiction blocks review, and the database migration has NOT been
executed.

`BLOCKED / OWNER REVIEW REQUIRED` means a source-of-truth conflict,
unsafe schema reconciliation, unavoidable destructive operation, missing
essential information, or other material blocker exists.

## 28. ABSOLUTE EXECUTION STOP

This prompt does NOT authorize:

``` text
prisma migrate dev
prisma migrate deploy
prisma db push
```

against staging or production.

Do not connect to or mutate a real database as part of this prompt.

If database testing is needed, use only an explicitly isolated
disposable/local test database and identify it clearly.

After preparing and validating artifacts:

**STOP.**

Do not execute migration. Do not begin Contract. Do not begin production
cutover. Do not automatically create Prompt 13.

Wait for Project Owner review and approval.

## 29. FINAL RESPONSE

Report: 1. reconnaissance result; 2. schema diff result; 3. Expand
artifacts created; 4. backfill scaffolding created; 5. reconciliation
package created; 6. safety validation result; 7. blockers; 8. exact
Prompt 12 gate; 9. explicit confirmation:

``` text
NO STAGING/PRODUCTION DATABASE MIGRATION WAS EXECUTED.
NO CONTRACT PHASE WAS STARTED.
```

Then stop.
