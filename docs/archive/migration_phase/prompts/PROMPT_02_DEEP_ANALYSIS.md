# PROMPT 02 — DEEP DOMAIN ANALYSIS

## ROLE

You are Antigravity, the primary architecture and domain-analysis agent for the Well POS / `pos_apps` project.

The existing system audit has been completed.

Your task is to perform a **deep domain analysis** for evolving the current Retail-oriented POS into a unified multi-tenant SaaS platform supporting:

- Retail
- F&B
- Services

This is still an analysis/documentation task.

Do not implement code.

Do not modify Prisma schema.

Do not create migrations.

Do not change APIs or frontend.

---

# 1. READ SOURCE DOCUMENTS

Read:

- `/docs/00_PROJECT_CONTEXT.md` if available
- `/docs/architecture/01_EXISTING_SYSTEM_AUDIT.md`
- existing repository/source code where needed
- existing Prisma schema

Treat actual source code as the baseline.

---

# 2. OBJECTIVE

Determine the domain boundaries, entities, relationships, workflows, invariants, and migration constraints required to evolve the existing POS without a full rewrite.

The target is one unified platform.

Do not design three independent applications.

---

# 3. DOMAIN MAP

Analyze these domains:

## Core Platform

- Tenant
- User
- Outlet
- Shift
- Authentication/RBAC
- CRM
- Payment infrastructure
- SaaS/subscription

## Commerce

- Category
- Product
- ProductVariant
- Price
- Barcode/SKU
- Product types

## Inventory

- InventoryItem
- StorageLocation
- InventoryBalance
- InventoryLedger
- InventoryBatch
- UnitOfMeasure
- UnitConversion
- Stock movements
- Cost/HPP

## Retail

Analyze:

- packaged products
- barcode sales
- stock deduction
- purchasing
- receiving
- returns
- void/cancel

## F&B

Analyze:

- menu products
- recipes/BOM
- ingredients
- modifiers
- kitchen workflow
- table/order behavior
- stock deduction timing

## Services

Analyze:

- service product
- consumables
- appointment
- work order
- staff assignment
- service material usage
- commission

Clearly distinguish Phase-1 requirements from future Services requirements.

---

# 4. PRODUCT VS INVENTORY ITEM

Analyze the current coupling and define the target conceptual boundary:

```text
Product = commercial/sellable concept
InventoryItem = physical/logistical/costed stock concept
```

Determine:

- when Product maps 1:1 to InventoryItem
- when Product uses Recipe
- when Product has no physical stock
- how variants relate to inventory

Do not force a single model to represent every domain concept.

---

# 5. ORDER / PAYMENT / INVENTORY LIFECYCLE

Analyze the separation between:

- OrderStatus
- PaymentStatus
- Inventory movement

Identify required lifecycle states and transitions.

Analyze cases including:

- unpaid
- partially paid
- paid
- cancelled
- voided
- refunded
- partially refunded
- stock deducted before/after payment
- held orders
- payment retry

Do not prematurely implement a state machine.

---

# 6. INVENTORY DOMAIN

Analyze:

- balance vs ledger
- stock movement
- stock transfer
- stock opname
- warehouse
- storage location
- negative stock
- batch/lot
- expiry
- UOM
- packaging
- recipes
- modifiers
- cost/HPP
- concurrent stock changes

Identify invariants.

---

# 7. UOM / PACKAGING

Explicitly distinguish:

1. Canonical inventory UOM
2. Physical UOM conversion
3. Purchasing UOM conversion
4. Commercial packaging

Analyze the Aqua bottle/carton example and an F&B ingredient example.

Do not assume canonical UOM must always be the smallest indivisible unit.

---

# 8. MULTI-TENANT ISOLATION

Analyze tenant boundaries across:

- parent entities
- child entities
- foreign keys
- operational records
- inventory
- recipes
- modifiers
- payments
- refunds
- batches

Identify cross-tenant reference risks.

---

# 9. MIGRATION ANALYSIS

Map existing structures to target concepts.

For each major domain:

- current model
- target model
- compatibility concerns
- migration strategy
- backfill
- dual-write requirement
- validation/reconciliation
- cutover risk

Use:

```text
Expand
→ Backfill
→ Dual-write
→ Validate/Reconcile
→ Cutover
→ Contract
```

---

# 10. OUTPUT

Create:

`/docs/architecture/02_DEEP_DOMAIN_ANALYSIS.md`

Required structure:

1. Executive Summary
2. Domain Map
3. Core Platform Analysis
4. Commerce Analysis
5. Inventory Analysis
6. Retail Analysis
7. F&B Analysis
8. Services Analysis
9. Product vs InventoryItem
10. Order/Payment/Inventory Lifecycle
11. UOM & Packaging
12. Batch/Lot
13. Negative Stock
14. Modifiers & Recipes
15. Tenant Boundary Analysis
16. Multi-Outlet/Warehouse
17. HPP/Costing
18. Migration Analysis
19. Domain Invariants
20. Architecture Risks
21. Open Decisions
22. Recommended Next Architecture Work

Every recommendation must be distinguishable from observed current behavior.

Do not implement anything.
