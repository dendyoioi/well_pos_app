# PROMPT 03 — DATA ARCHITECTURE RFC

## ROLE

You are Antigravity, the primary architecture agent for Well POS / `pos_apps`.

The existing-system audit and deep domain analysis are available.

Your task is to transform the domain analysis into a **data architecture RFC** for the target unified multi-tenant SaaS POS.

This task is architecture/documentation only.

Do not implement application code.

Do not modify the actual Prisma schema.

Do not create database migrations.

Do not modify production database structures.

---

# 1. READ FIRST

Read:

- `/docs/00_PROJECT_CONTEXT.md`
- `/docs/architecture/01_EXISTING_SYSTEM_AUDIT.md`
- `/docs/architecture/02_DEEP_DOMAIN_ANALYSIS.md`
- actual current Prisma schema

If later approved ADRs already exist, read them and treat approved decisions as binding.

---

# 2. TARGET PRINCIPLE

Design one unified data architecture supporting:

- Retail
- F&B
- Services

with shared:

- Core Platform
- Commerce
- Inventory

and vertical extensions.

Do not create three disconnected schemas.

---

# 3. FOUNDATIONAL DATA DECISIONS TO ANALYZE

The RFC must explicitly address:

## Tenant Isolation

- tenant ownership
- tenantId
- child operational records
- cross-tenant references
- service-layer enforcement
- future RLS

## Product vs InventoryItem

Separate:

- commercial catalog
- sellable product
- physical inventory
- recipe ingredients

## ProductVariant

Analyze:

- barcode
- SKU
- pricing
- commercial packaging
- inventory relationship
- `inventoryQuantityMultiplier`

## Inventory

Define:

- InventoryItem
- StorageLocation
- InventoryBalance
- InventoryLedger
- stock movement
- warehouse/outlet relationship

Use an immutable inventory movement ledger.

Do not call it double-entry accounting unless accounting entries actually exist.

## Batch

Treat InventoryBatch as an optional stock dimension.

Non-batched:

```text
Item + Location
```

Batched:

```text
Item + Location + Batch
```

Advanced FEFO/recall may be deferred.

## UOM

Separate:

- Canonical Inventory UOM
- Physical UOM conversion
- Purchasing UOM conversion
- Commercial packaging

Canonical UOM is not necessarily the smallest unit.

## Negative Stock

Use context-driven policy:

```text
Tenant
→ Location
→ Item
```

Negative stock is an operational exception.

## Order / Payment

Keep:

- OrderStatus
- PaymentStatus
- Inventory movement

conceptually separate.

## Refund

Include refund domain requirements and refund-item granularity where needed.

## Idempotency

Analyze idempotency requirements for:

- checkout
- payment
- webhook
- stock mutation

## Recipes

Define:

- Recipe
- RecipeItem
- inventory ingredient relationship
- version/effective-date considerations where necessary

## Modifiers

Define relational modifier concepts instead of embedding critical inventory behavior inside arbitrary JSON.

Consider:

- ModifierGroup
- ModifierItem
- ProductModifierGroup
- modifier inventory effects

## Services

Define the architectural contract for:

- SERVICE_LABOR
- optional consumables

while deferring the full Services workflow.

---

# 4. CONCURRENCY

The RFC must explicitly define how inventory balance and ledger updates remain consistent under concurrent transactions.

Address:

- transaction boundaries
- row locking
- balance calculation
- ledger append
- race conditions
- overselling
- retry behavior

Do not implement it here.

---

# 5. DATA INVARIANTS

For each important domain, document invariants such as:

- tenant ownership
- foreign-key ownership
- quantity precision
- multiplier > 0
- batch belongs to same tenant/item
- balance uniqueness
- immutable ledger
- refund consistency
- payment/order consistency

---

# 6. MIGRATION ARCHITECTURE

Define the migration strategy:

```text
EXPAND
→ BACKFILL
→ DUAL-WRITE
→ VALIDATE / RECONCILE
→ CUTOVER
→ CONTRACT
```

For each stage identify:

- data changes
- compatibility requirements
- validation
- rollback considerations
- reconciliation gate

Dual-write must be designed around a centralized domain/application service.

---

# 7. LEGACY COMPATIBILITY

Explicitly analyze how current structures such as:

- Product
- OutletProduct
- StockMovement
- Order
- OrderItem
- Payment
- Shift

map into the target architecture.

Do not delete legacy structures merely because a new structure is cleaner.

---

# 8. OUTPUT

Create/update:

`/docs/architecture/03_DATA_ARCHITECTURE_RFC.md`

Required sections:

1. Status
2. Executive Summary
3. Goals
4. Non-Goals
5. Architectural Principles
6. Domain Boundaries
7. Tenant Architecture
8. Commerce Data Architecture
9. Inventory Data Architecture
10. Retail Data Architecture
11. F&B Data Architecture
12. Services Data Architecture
13. Order/Payment/Refund
14. ProductVariant & Packaging
15. UOM
16. Batch/Lot
17. Recipe/BOM
18. Modifiers
19. Inventory Concurrency
20. Idempotency
21. Data Invariants
22. Legacy Mapping
23. Migration Strategy
24. Reconciliation Gates
25. Risks
26. Open Decisions
27. Schema Design Readiness

Clearly label:

- Approved decision
- Proposed architecture
- Open implementation detail

Do not treat unapproved AI assumptions as final decisions.

---

# 9. GATE

The RFC is not implementation authorization.

End with:

## RFC Readiness

State whether the data architecture is sufficiently defined for target database schema design.

Do not modify Prisma or code.
