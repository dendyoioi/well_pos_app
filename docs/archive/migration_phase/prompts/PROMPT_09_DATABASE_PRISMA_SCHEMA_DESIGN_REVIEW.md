# PROMPT_09_DATABASE_PRISMA_SCHEMA_DESIGN_REVIEW.md

# PROMPT 09 — DATABASE / PRISMA SCHEMA DESIGN REVIEW

## Role

You are **Antigravity**, the primary architecture and implementation agent for the Well POS (`pos_apps`) project.

Your responsibility in this phase is to translate the approved Data Architecture RFC into a **concrete database / Prisma schema design proposal**.

This is a **DESIGN + REVIEW phase only**.

## HARD RULE

**DO NOT MODIFY `schema.prisma`.**

**DO NOT CREATE OR MODIFY DATABASE MIGRATIONS.**

**DO NOT MODIFY DATABASE DATA.**

**DO NOT MODIFY APPLICATION CODE.**

**DO NOT MODIFY API IMPLEMENTATION.**

**DO NOT MODIFY FRONTEND/UI.**

**DO NOT IMPLEMENT AUTHENTICATION CHANGES.**

**DO NOT START IMPLEMENTATION.**

The purpose of this prompt is to design and validate the target schema before any coding begins.

There is no deadline pressure. Correctness, consistency, migration safety, and maintainability are more important than speed.

---

# 1. Objective

Produce a complete **Target Database / Prisma Schema Design Proposal** based on:

`/docs/architecture/03_DATA_ARCHITECTURE_RFC.md`

Revision 4 is the approved architectural baseline.

The output must answer:

> "What should the target database schema look like?"

It must NOT yet answer:

> "How do we implement it in code?"

Implementation comes only after the schema design is reviewed and approved.

---

# 2. Source of Truth

Read these documents completely before designing:

1. `/docs/00_PROJECT_CONTEXT.md`
2. `/docs/architecture/01_EXISTING_SYSTEM_AUDIT.md`
3. `/docs/architecture/02_DEEP_DOMAIN_ANALYSIS.md`
4. `/docs/architecture/03_DATA_ARCHITECTURE_RFC.md`
5. `/docs/validation/05_SCHEMA_CONSISTENCY_VALIDATION_REPORT.md`
6. `/docs/validation/06_ARCHITECTURE_DECISION_GATE_REPORT.md`
7. `/docs/decisions/ADR-001-tenant-boundary-enforcement.md`
8. `/docs/decisions/ADR-002-negative-stock-policy.md`
9. `/docs/decisions/ADR-003-uom-vs-packaging.md`
10. `/docs/decisions/ADR-004-inventory-batch-lot.md`
11. `/docs/decisions/ADR-005-services-module-boundary.md`

Also inspect the actual current:

- `server/prisma/schema.prisma`
- relevant Prisma migrations
- relevant backend models/services/controllers
- authentication and tenant middleware
- inventory/order/payment code

Inspect actual code only to understand compatibility and migration implications.

---

# 3. Schema Design Deliverables

Create:

`/docs/architecture/04_TARGET_DATABASE_SCHEMA.md`

This is a **design document**, not the actual Prisma schema.

The document must contain:

1. Target schema overview
2. Entity inventory
3. Entity-by-entity definitions
4. Relationship matrix
5. Primary keys
6. Foreign keys
7. Unique constraints
8. Composite uniqueness
9. Required `tenantId` fields
10. Nullable vs mandatory fields
11. Decimal precision
12. Enum definitions
13. Index strategy
14. Delete/update behavior
15. Cross-tenant integrity strategy
16. Batch-aware inventory dimensions
17. Idempotency schema
18. User identity schema
19. Order/payment/refund schema
20. Product/ProductVariant/InventoryItem relationships
21. Recipe/modifier schema
22. Services Phase-1 schema boundary
23. Legacy compatibility mapping
24. Migration prerequisites
25. Schema validation checklist
26. Open questions / decisions requiring Owner approval

---

# 4. CRITICAL: Do Not Treat RFC as Automatically Perfect

The RFC is the approved architectural baseline, but schema design must test whether the architecture is actually implementable.

If you discover a contradiction, ambiguity, impossible constraint, or missing relationship:

1. DO NOT silently invent a solution.
2. DO NOT change the RFC.
3. DO NOT implement a workaround.
4. Document the issue clearly.
5. Classify it:
   - BLOCKER
   - HIGH
   - MEDIUM
   - LOW
6. Propose one or more options.
7. State whether Owner decision is required.

The schema design is not considered complete if important unresolved contradictions are hidden.

---

# 5. Tenant Isolation — HARD REQUIREMENT

The target schema uses:

> Shared Database + Shared Schema + direct tenantId + Service-Layer Enforcement.

Every tenant-owned operational/domain entity must be evaluated for direct:

```text
tenantId NOT NULL
```

At minimum review:

- User
- Product
- ProductVariant
- Category
- InventoryItem
- InventoryBatch
- StorageLocation
- InventoryBalance
- InventoryLedger
- Recipe
- RecipeItem
- ModifierGroup
- ModifierItem
- ProductModifierGroup
- ModifierRecipeEffect
- Order
- OrderItem
- PaymentTransaction
- Refund
- RefundItem
- IdempotencyKey
- Customer / CRM entities
- Shift
- other tenant-owned operational entities discovered in current schema

Do not assume the RFC list is exhaustive.

For every entity, explicitly document:

```text
tenantId:
required / not required

reason:
...

parent tenant relationship:
...

cross-tenant protection:
...
```

---

# 6. Cross-Tenant Foreign Key Integrity

This is a HARD design concern.

Example:

```text
OrderItem.tenantId = Tenant A
OrderItem.variantId = ProductVariant from Tenant B
```

must never be valid.

A normal FK on:

```text
variantId → ProductVariant.id
```

does not by itself guarantee tenant equality.

For every important tenant-bound relationship, evaluate whether the target schema should use:

### Option A
Normal FK + mandatory service-layer validation.

### Option B
Composite tenant-aware FK, where practical.

### Option C
A combination of both.

Do not choose a database mechanism merely because it looks elegant.

For each relationship, document:

- FK
- tenant validation
- whether composite FK is feasible
- whether service validation is mandatory

Pay particular attention to:

- Order → OrderItem
- OrderItem → ProductVariant
- Recipe → ProductVariant
- RecipeItem → InventoryItem
- ProductModifierGroup → Product / ModifierGroup
- ModifierItem → ModifierGroup
- ModifierRecipeEffect → InventoryItem
- InventoryBalance → InventoryItem
- InventoryBalance → StorageLocation
- InventoryBalance → InventoryBatch
- InventoryLedger → InventoryItem
- InventoryLedger → StorageLocation
- InventoryLedger → InventoryBatch
- PaymentTransaction → Order
- Refund → Order
- RefundItem → Refund / OrderItem
- User → Outlet

---

# 7. User Identity — Model B

The Owner decision is final:

> Tenant-Scoped User Identity.

Design:

```text
User.id
    = internal opaque UUID

User.tenantId
    = tenant boundary

User.userCode
    = operational login identifier

User.pinHash
    = hashed operational credential
```

Required uniqueness:

```text
UNIQUE (tenantId, userCode)
```

Review whether the schema should additionally support:

```text
UNIQUE (tenantId, email)
```

with nullable email semantics.

Do not make email globally unique for tenant `User` unless there is a documented architectural reason.

Keep:

```text
PlatformUser
```

separate from tenant `User`.

### Important

Do not automatically make `User.outletId` mandatory.

Evaluate the operational requirement:

- cashier may belong to one outlet,
- supervisor may operate multiple outlets,
- owner/admin may access multiple outlets,
- warehouse operator may access warehouse + outlet.

Evaluate whether:

```text
User.outletId
```

is sufficient, or whether a future/current:

```text
UserOutlet
```

assignment relation is more appropriate.

Do not silently decide this if it changes authorization semantics.

---

# 8. PIN Design

The RFC mentions a 6-digit operational PIN.

For schema design:

- store only secure hash material,
- never plaintext,
- do not store a raw PIN,
- document whether exact 6-digit enforcement belongs in schema or application policy.

Do not over-constrain the database unless justified.

---

# 9. Product / ProductVariant / InventoryItem

Preserve the architectural separation:

```text
Product
    ↓
ProductVariant
    ↓
Commercial sale

InventoryItem
    ↓
Physical/logistical stock
```

Evaluate:

### Product
- tenant
- category
- product type
- legacy compatibility fields

### ProductVariant
- product
- tenant
- sku
- barcode
- price
- costPrice
- inventory linkage
- inventoryQuantityMultiplier
- active state

### InventoryItem
- tenant
- item code
- canonical UOM
- costing fields
- batch tracking flag

Important invariant:

A ProductVariant uses exactly one of:

```text
1. Direct InventoryItem
2. Recipe
3. No stock
```

Do not implement this as an invalid combination merely because Prisma lacks native XOR constraints.

Document the enforcement mechanism.

---

# 10. Product SKU / Variant SKU

The RFC establishes:

```text
ProductVariant.sku
    = authoritative transactional SKU

ProductVariant.barcode
    = authoritative transactional barcode

Product.sku
    = deprecated parent catalog/family code
```

Schema design must preserve this migration strategy.

Evaluate nullable/required status of legacy `Product.sku`.

Do not accidentally retain two competing transactional SKU authorities.

---

# 11. Inventory Architecture

Target entities:

```text
InventoryItem
StorageLocation
InventoryBatch
InventoryBalance
InventoryLedger
```

The schema must preserve:

```text
InventoryBalance
    = current state

InventoryLedger
    = immutable history
```

Do not use StockMovement as the target architecture.

---

# 12. InventoryBalance — CRITICAL

Stock dimension:

### Non-batch

```text
tenantId
inventoryItemId
storageLocationId
inventoryBatchId = NULL
```

### Batch

```text
tenantId
inventoryItemId
storageLocationId
inventoryBatchId
```

The database must prevent duplicate balance rows.

Evaluate implementation choices:

### Option 1
Partial unique indexes:

```sql
UNIQUE (tenant_id, inventory_item_id, storage_location_id)
WHERE inventory_batch_id IS NULL
```

and

```sql
UNIQUE (
  tenant_id,
  inventory_item_id,
  storage_location_id,
  inventory_batch_id
)
WHERE inventory_batch_id IS NOT NULL
```

### Option 2
PostgreSQL `NULLS NOT DISTINCT`

### Option 3
Normalized dimension model.

Recommend the simplest robust mechanism compatible with the project's PostgreSQL version and Prisma workflow.

Do not implement it yet.

---

# 13. InventoryBalance Fields

Evaluate:

```text
quantityOnHand
quantityReserved
quantityAvailable
```

The RFC defines:

```text
quantityAvailable =
quantityOnHand - quantityReserved
```

However, **reservation lifecycle is not yet fully specified**.

Therefore:

- do not invent a reservation engine,
- determine whether `quantityReserved` should be:
  - Phase-1 persisted field,
  - future-ready nullable/zero field,
  - or deferred entirely.

If this affects schema architecture materially, classify it as an Owner decision.

---

# 14. InventoryBatch

`InventoryBatch` is a stock dimension from the initial architecture.

It contains metadata such as:

```text
tenantId
inventoryItemId
batchNumber
expiryDate
receivedDate
supplierLotCode
```

It must NOT contain:

```text
initialQuantity
quantityOnHand
```

Stock is represented by:

```text
InventoryBalance
InventoryLedger
```

Evaluate appropriate uniqueness:

```text
tenant + inventoryItem + batchNumber
```

Do not assume batchNumber is globally unique.

---

# 15. InventoryLedger

Target ledger is:

> Immutable Stock Movement Ledger

Not double-entry accounting.

Evaluate fields:

```text
id
tenantId
inventoryItemId
storageLocationId
inventoryBatchId
quantityDelta
balanceBefore
balanceAfter
unitCost
referenceType
referenceId
actorId / actorUserId
isNegativeBalance
createdAt
```

### Actor identity — IMPORTANT

The RFC currently says the actor may be:

```text
User or System
```

Do not create an ambiguous FK such as:

```text
actorId → User.id
```

if system-generated operations also exist.

Evaluate a clean design such as:

```text
actorUserId nullable
actorType enum(USER, SYSTEM)
```

or another explicit design.

If necessary, document the choice as schema-level design rather than silently inventing a new business concept.

---

# 16. Inventory Concurrency

Schema design must support:

```text
BEGIN
SELECT InventoryBalance FOR UPDATE
UPDATE balance
INSERT ledger
COMMIT
```

The unique stock dimension must support safe first-row creation.

Evaluate how the chosen unique constraints interact with:

```text
INSERT ... ON CONFLICT
```

for both:

- non-batch balance,
- batch balance.

Document any Prisma limitations.

Do not code the solution.

---

# 17. UOM

Preserve strict separation:

### Canonical inventory UOM

Owned by InventoryItem.

### Physical UOM Conversion

UnitConversion.

### Purchasing UOM

Supplier/purchasing conversion.

### Commercial Packaging

ProductVariant:

```text
inventoryQuantityMultiplier
```

All physical stock quantities use canonical UOM.

Do not merge these concepts into a generic conversion table unless the RFC explicitly supports it.

---

# 18. Recipe

Canonical relationship:

```text
ProductVariant 1 : 0..1 Recipe
Recipe 1 : N RecipeItem
RecipeItem N : 1 InventoryItem
```

Requirements:

```text
Recipe.productVariantId NOT NULL
Recipe.productVariantId UNIQUE
```

Review tenant-safe relationships.

Do not allow a recipe to silently belong to another tenant's ProductVariant.

---

# 19. Modifiers

Target entities:

```text
ModifierGroup
ModifierItem
ProductModifierGroup
ModifierRecipeEffect
```

`ModifierRecipeEffect` must explicitly identify:

```text
target inventoryItem
quantityDelta
```

Do not use JSON to represent inventory effects.

Review:

- tenant IDs,
- uniqueness,
- ordering,
- selection constraints,
- cross-tenant relationships.

---

# 20. Orders

Order schema must support independent:

```text
OrderStatus
PaymentStatus
```

Evaluate:

```text
Order
OrderItem
```

OrderItem should preserve historical commercial information necessary for audit/reporting.

Especially evaluate:

```text
productVariantId
quantity
unitPrice
discount
tax
costPrice snapshot
```

Do not rely on current Product/ProductVariant pricing to reconstruct historical transactions.

---

# 21. Stock Deduction Trigger

The schema must support the RFC's configurable trigger model:

```text
ON_PAYMENT
ON_ORDER_CONFIRM
ON_KITCHEN_DISPATCH
ON_WORK_ORDER_FINISH
```

Do not create unnecessary workflow tables just to represent the enum.

Determine the minimal configuration location:

- Tenant,
- Outlet,
- or another appropriate scope.

If the RFC does not authorize outlet-level trigger configuration, do not invent it.

---

# 22. Payment

Target:

```text
PaymentTransaction
```

Evaluate:

- tenantId
- orderId
- payment status
- tender type
- amount
- gateway reference
- authorization code
- timestamps
- idempotency relationship

Payment must not be assumed to be a single row per Order.

---

# 23. Refund

Target:

```text
Refund
RefundItem
```

RefundItem must identify:

```text
refundId
orderItemId
quantity
amount
restockItem
```

Financial refund and inventory restock are separate concepts.

Do not automatically make every refund create inventory movement.

---

# 24. Idempotency

Design a dedicated idempotency mechanism.

Minimum conceptual scope:

```text
tenantId
operationType
idempotencyKey
```

Required uniqueness:

```text
UNIQUE (
  tenantId,
  operationType,
  idempotencyKey
)
```

Evaluate whether the table requires:

- request hash,
- status,
- response metadata,
- createdAt,
- expiresAt.

Do not over-design a distributed idempotency system.

---

# 25. Negative Stock

Preserve policy:

```text
Tenant
   ↓
Location
   ↓
Item
```

effective override hierarchy:

```text
Item
→ Location
→ Tenant
```

Vertical defaults are defaults, not independent bypass rules.

Schema must support nullable overrides where appropriate.

Do not add:

```sql
CHECK quantityOnHand >= 0
```

---

# 26. Services Phase 1

Preserve:

```text
ProductType.SERVICE_LABOR
```

Service labor does not require InventoryItem.

Optional consumables may use:

```text
Recipe
RecipeItem
```

Do not create the deferred full Services tables yet unless the schema analysis proves a minimal relation is necessary.

Deferred:

```text
ServiceDefinition
Appointment
WorkOrder
StaffAssignment
ServiceMaterialUsage
StaffCommission
```

If `assignedStaffUserId` is considered, evaluate it carefully rather than automatically adding it to OrderItem.

---

# 27. User ↔ Outlet Assignment

This is a required schema-design question.

Evaluate:

### Option A

```text
User.outletId nullable
```

### Option B

```text
UserOutlet
-----------
tenantId
userId
outletId
```

### Option C

Another explicit assignment model.

Compare implications for:

- cashier
- supervisor
- owner
- warehouse operator
- multi-outlet access
- authorization
- PIN login

Do not silently choose a model if it changes authorization semantics.

If a decision is required, mark it as:

> OWNER DECISION REQUIRED

---

# 28. Index Strategy

For each major table document indexes for:

- tenant filtering,
- frequent lookups,
- foreign keys,
- transactional identifiers,
- operational login,
- inventory dimensions,
- reconciliation,
- date-range reporting.

Avoid indexing every column.

Pay particular attention to:

```text
User (tenantId, userCode)
ProductVariant (tenantId, sku)
ProductVariant (tenantId, barcode)
Order (tenantId, invoiceNumber)
InventoryBalance stock dimension
InventoryLedger (tenantId, inventoryItemId, storageLocationId, createdAt)
IdempotencyKey (tenantId, operationType, idempotencyKey)
```

---

# 29. Delete / Update Behavior

For every FK classify:

```text
CASCADE
RESTRICT
SET NULL
```

Especially:

- Product → ProductVariant
- ProductVariant → Recipe
- Recipe → RecipeItem
- InventoryItem → InventoryBatch
- InventoryItem → InventoryBalance
- InventoryItem → InventoryLedger
- Order → OrderItem
- Order → PaymentTransaction
- Order → Refund
- Refund → RefundItem
- User → historical operational records

Historical financial/inventory records should generally not disappear because a master record is deleted.

If soft-delete is more appropriate, document it.

Do not invent destructive cascade behavior.

---

# 30. Historical Snapshot Requirements

Identify all fields that must be snapshotted on transaction records because master data can change later.

At minimum evaluate:

- selling price
- cost price / HPP
- product name
- SKU
- barcode where relevant
- tax
- discount
- modifier price
- recipe effect quantities where required for audit

Do not over-copy master data unnecessarily.

---

# 31. Legacy Compatibility

Map:

```text
User
Product
OutletProduct
StockMovement
Order
OrderItem
Payment
Outlet
Shift
```

to target entities.

For every legacy field that is deprecated:

- target replacement,
- migration behavior,
- compatibility period,
- whether nullable is needed,
- whether dual-write is required.

Do not design the migration SQL yet.

---

# 32. Schema-Level Migration Prerequisites

Document prerequisites before implementation can begin:

Examples:

- PostgreSQL version compatibility
- Prisma support for chosen indexes
- tenantId backfill feasibility
- User.userCode generation
- PIN migration feasibility
- ProductVariant backfill
- InventoryItem mapping
- StorageLocation creation
- InventoryBatch introduction
- legacy stock reconciliation
- idempotency rollout
- cross-tenant validation

Do not execute any migration.

---

# 33. Required Entity Matrix

Create a table similar to:

| Entity | Tenant Scoped | PK | Important FKs | Unique Constraints | Delete Policy | Phase |
|---|---|---|---|---|---|---|

Include every target entity.

---

# 34. Required Relationship Matrix

Create a table:

| Parent | Child | Cardinality | FK | Tenant-Safe? | Enforcement |
|---|---|---|---|---|---|

Any row that cannot guarantee tenant safety must be flagged.

---

# 35. Required Constraint Matrix

Create a table:

| Constraint | Database-Enforced? | Service-Enforced? | Reason |
|---|---|---|---|

Include:

- tenant isolation,
- unique userCode,
- unique SKU,
- unique barcode,
- inventory balance uniqueness,
- variant XOR strategy,
- negative stock,
- immutable ledger,
- idempotency,
- tenant-safe references.

---

# 36. Required Scenario Validation

Before declaring the design complete, mentally validate the schema against these scenarios:

## Scenario A — Retail

```text
Tenant A
Outlet Jakarta
Product Aqua
Variant Single
Variant Carton 24
InventoryItem Aqua Bottle
100 PCS stock

Sell 10 cartons
```

Verify:

```text
10 × 24 = 240 PCS deduction
```

and confirm the schema can represent it correctly.

---

## Scenario B — F&B

```text
Tenant A
Burger Double
Recipe
2 × Patty
1 × Bun
30g Sauce
```

Selling 5 burgers must consume the correct inventory quantities.

---

## Scenario C — Services

```text
Tenant A
Haircut
SERVICE_LABOR
```

No InventoryItem required.

No inventory ledger entry unless consumables are actually involved.

---

## Scenario D — Multi-Tenant Isolation

```text
Tenant A userCode = KSR001
Tenant B userCode = KSR001
```

Must be valid.

But:

```text
Tenant A OrderItem
→ Tenant B ProductVariant
```

must be impossible through the supported data/domain model.

---

## Scenario E — Concurrent Stock

Two cashiers sell the final unit simultaneously.

The schema must support safe locking and prevent incorrect final balance.

---

## Scenario F — Payment Retry

Same:

```text
tenantId
operationType
idempotencyKey
```

is submitted twice.

Schema must support idempotent handling.

---

## Scenario G — Batch

```text
InventoryItem = Milk
Batch A = expiry Jan
Batch B = expiry Feb
```

Both can have independent balances at the same location.

---

## Scenario H — Multi-Outlet Supervisor

One supervisor needs access to:

```text
Outlet A
Outlet B
```

Evaluate whether `User.outletId` can represent this correctly.

---

# 37. Prisma-Specific Review

Because this project uses Prisma, explicitly review:

- composite unique constraints,
- composite indexes,
- partial unique indexes,
- PostgreSQL-specific features,
- nullable unique behavior,
- relation names,
- self-relations,
- cascade behavior,
- Decimal mapping,
- enum mapping,
- migration limitations,
- raw SQL requirements where Prisma schema syntax is insufficient.

If a requirement cannot be expressed cleanly in Prisma schema, document:

```text
Prisma limitation
+
required SQL migration construct
+
why it is safe
```

But DO NOT create the migration.

---

# 38. Design Quality Gate

At the end, assign:

```text
SCHEMA DESIGN STATUS:
READY FOR IMPLEMENTATION
```

only if:

- no BLOCKER exists,
- all critical relationships are defined,
- tenant isolation is enforceable,
- inventory dimensions are correct,
- uniqueness is correct,
- historical records are safe,
- migration compatibility is understood,
- unresolved Owner decisions are explicitly identified.

Otherwise:

```text
SCHEMA DESIGN STATUS:
NOT READY
```

with the blockers clearly listed.

Do not force a READY status.

---

# 39. Required Deliverables

Create/update only:

```text
/docs/architecture/04_TARGET_DATABASE_SCHEMA.md
```

Optionally create a separate review document only if necessary:

```text
/docs/validation/07_DATABASE_SCHEMA_DESIGN_REVIEW.md
```

Do NOT modify:

```text
03_DATA_ARCHITECTURE_RFC.md
```

The RFC is already approved.

---

# 40. Final Report

Return a concise but complete report containing:

## A. Execution Status

- completed / blocked

## B. Files Created

- exact path(s)

## C. Entity Count

- number of target entities
- number of legacy entities retained for compatibility

## D. Critical Findings

- BLOCKER
- HIGH
- MEDIUM
- LOW

## E. Owner Decisions Required

List only decisions genuinely requiring Project Owner approval.

## F. Prisma / PostgreSQL Concerns

List concrete schema implementation concerns.

## G. Scenario Validation

Report PASS/FAIL for:

- Retail
- F&B
- Services
- Multi-tenant isolation
- Concurrent stock
- Payment idempotency
- Batch stock
- Multi-outlet user access

## H. Implementation Gate

State exactly one:

```text
READY FOR IMPLEMENTATION
```

or

```text
NOT READY — BLOCKED BY:
...
```

## I. HARD CONFIRMATION

Explicitly state:

> No application code, Prisma schema, database migration, database data, API, frontend, or authentication implementation was modified during this task.

---

# 41. Final Instruction

Take your time.

Do not optimize for speed.

Do not code because a schema gap is discovered.

If the correct architectural answer is "we need an Owner decision", stop at the design boundary and document it.

The objective is to arrive at a **reviewable, technically coherent target schema**, not to rush into implementation.

After this task, wait for human review.

**Do not proceed to implementation automatically.**
