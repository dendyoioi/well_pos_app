# PROMPT 08 — DATA ARCHITECTURE RFC REVISION

## ROLE

You are Antigravity, the primary architecture and implementation agent for the Well POS / `pos_apps` project.

The architecture decision phase has been completed.

The Project Owner has explicitly approved:

- ADR-001: **1A** — Direct `tenantId NOT NULL` + Service-Layer Enforcement; RLS as future defense-in-depth
- ADR-002: **2B** — Context-Driven Negative Stock Policy
- ADR-003: **3A** — Strict separation of Physical UOM, Purchasing UOM Conversion, and Commercial Packaging
- ADR-004: **4B** — `InventoryBatch` as an optional stock dimension from the initial target architecture
- ADR-005: **5B** — `SERVICE_LABOR` now; full Services domain deferred

Your task is now to revise the **Data Architecture RFC** so that it is fully consistent with those approved decisions and the existing project evidence.

This is a **documentation / architecture task only**.

DO NOT:

- modify application source code
- modify `schema.prisma`
- create Prisma migrations
- execute database migrations
- modify the database
- modify frontend/backend implementation
- implement APIs
- implement services
- create production code

The output of this task is the revised RFC only.

---

# 1. SOURCE OF TRUTH

Use this hierarchy:

1. Existing source code and actual current database/schema
2. `/docs/00_PROJECT_CONTEXT.md`
3. `/docs/architecture/01_EXISTING_SYSTEM_AUDIT.md`
4. `/docs/architecture/02_DEEP_DOMAIN_ANALYSIS.md`
5. Approved ADRs in `/docs/decisions/`
6. Existing `/docs/architecture/03_DATA_ARCHITECTURE_RFC.md`
7. Existing validation reports
8. This prompt

Approved ADR decisions are binding.

If the current RFC conflicts with an approved ADR, update the RFC to follow the ADR.

Do not silently invent additional business decisions.

If an issue is not sufficiently determined, mark it:

`[OPEN IMPLEMENTATION DETAIL]`

or:

`[OPEN ARCHITECTURE DECISION]`

depending on whether it requires implementation clarification or a new owner-level decision.

---

# 2. OBJECTIVE

Revise:

`/docs/architecture/03_DATA_ARCHITECTURE_RFC.md`

The revised RFC must become the authoritative architecture bridge between:

```text
Domain Analysis
      ↓
Approved ADRs
      ↓
Data Architecture RFC
      ↓
Target Database Schema
```

The RFC must be sufficiently precise to support the next stage:

`PROMPT 09 — TARGET DATABASE SCHEMA REVISION`

but must NOT itself become the actual Prisma schema.

---

# 3. REQUIRED APPROVED DECISIONS

## 3.1 Tenant Boundary — ADR-001

The RFC must adopt:

- shared database/shared schema
- direct `tenantId NOT NULL` on tenant-owned operational/domain child records where required
- service/application-layer tenant enforcement
- explicit cross-tenant reference validation
- removal of static/default tenant fallback
- PostgreSQL RLS as future defense-in-depth, not Phase-1 prerequisite

Explicitly address cross-tenant references such as:

```text
RecipeItem → InventoryItem
ModifierRecipeEffect → InventoryItem
ProductModifierGroup → Product
OrderItem → Order / Product / Variant
PaymentTransaction → Order
RefundItem → Refund / OrderItem
InventoryBatch → InventoryItem
InventoryBalance → InventoryBatch
InventoryLedger → InventoryBatch
```

Do not imply that `tenantId` alone automatically makes a foreign key tenant-safe.

---

# 4. NEGATIVE STOCK — ADR-002

The RFC must adopt:

```text
Tenant Policy
      ↓
Location Override
      ↓
Item Override
```

Negative stock is an operational exception.

Document the intended context:

- Retail standard goods → normally non-negative
- Warehouse outbound → normally non-negative
- F&B kitchen/bar → may tolerate negative
- Services consumables → may tolerate negative when explicitly allowed

Do NOT introduce a universal:

```sql
CHECK (quantity_on_hand >= 0)
```

constraint.

The RFC must define the conceptual responsibility of the inventory domain/service for evaluating the policy.

Every negative-stock event must remain auditable.

The RFC should distinguish:

- policy evaluation
- balance mutation
- exception/audit recording
- reconciliation

Do not invent a complete reconciliation algorithm if it has not been approved.

---

# 5. UOM / PACKAGING — ADR-003

The RFC must clearly separate:

### A. Canonical Inventory UOM

Owned by `InventoryItem`.

It is the canonical standard used for inventory quantities.

It is NOT necessarily the smallest indivisible unit.

### B. Physical UOM Conversion

Used for physical unit conversions such as:

```text
KG ↔ GRAM
LITER ↔ ML
```

### C. Purchasing UOM Conversion

Used when supplier purchasing units differ from the canonical inventory UOM.

This must remain conceptually separate from selling packaging.

### D. Commercial Packaging

Represented through:

`ProductVariant.inventoryQuantityMultiplier`

Example:

```text
Aqua Bottle → 1 PCS
Aqua Carton 24 → 24 PCS
```

The RFC must state:

```text
Canonical Stock Deducted
=
Order Quantity × inventoryQuantityMultiplier
```

for commercial packaging where applicable.

The multiplier:

- must be positive
- requires decimal precision
- is not a UOM conversion

---

# 6. BATCH / LOT — ADR-004

The RFC must adopt:

```text
InventoryItem 1:N InventoryBatch
```

Batch is a **stock dimension**, not merely ledger metadata.

For non-batched inventory:

```text
InventoryItem + StorageLocation
```

For batched inventory:

```text
InventoryItem + StorageLocation + InventoryBatch
```

The RFC must explicitly describe:

- optional batching
- batch ownership/tenant boundary
- batch number
- expiry date
- batch-aware balance
- batch-aware ledger
- canonical UOM
- negative-stock interaction at batch level

Advanced features remain deferred:

- FEFO
- product recall workflow
- advanced shelf-life analytics

The RFC must not reduce batch to `batchNumber` text fields on ledger entries.

---

# 7. PRODUCT VS INVENTORY ITEM

The RFC must preserve the conceptual distinction:

```text
Product
=
Commercial / Sellable Concept

InventoryItem
=
Physical / Logistical / Costed Inventory Concept
```

Explain the three major patterns:

### Retail

```text
Product / ProductVariant
        ↓
InventoryItem
```

### F&B

```text
Product
   ↓
Recipe
   ↓
RecipeItem
   ↓
InventoryItem
```

### Services

```text
SERVICE_LABOR Product
        ↓
Optional consumables
        ↓
InventoryItem
```

Do not force every Product to own physical stock.

---

# 8. PRODUCT VARIANT

The RFC must define the architectural role of `ProductVariant`.

Address:

- barcode
- SKU
- price
- commercial packaging
- inventory relationship
- `inventoryQuantityMultiplier`

Explicitly analyze the relationship between:

```text
Product
ProductVariant
InventoryItem
```

Do not silently turn ProductVariant ↔ InventoryItem into many-to-many unless the existing architecture and business requirement justify it.

If a future packaging model may require a richer structure, document it as deferred.

---

# 9. INVENTORY ARCHITECTURE

Define the responsibilities of:

### InventoryItem

Master physical/logistical/costed item.

### StorageLocation

Physical/logical storage point.

Examples may include:

- outlet stockroom
- warehouse
- kitchen
- bar

### InventoryBalance

Current stock state.

Must support:

- tenant
- item
- location
- optional batch
- decimal quantity
- uniqueness of the stock dimension

### InventoryLedger

Immutable stock movement history.

Must support:

- tenant
- item
- location
- optional batch
- quantity delta
- reference type
- reference ID
- actor
- timestamp
- resulting balance where architecturally required
- negative-balance audit state where required

Do not call this double-entry accounting.

---

# 10. INVENTORY CONCURRENCY

The RFC must explicitly define the architectural requirement that balance updates and ledger appends occur transactionally.

Address:

- transaction boundary
- row locking / equivalent concurrency control
- preventing overselling
- balanceBefore
- quantityDelta
- balanceAfter
- ledger append
- retry behavior

Do not provide implementation code.

Do not claim that a pre-check in the controller is sufficient.

---

# 11. ORDER / PAYMENT / REFUND

Keep the concepts separate:

```text
OrderStatus
PaymentStatus
Inventory Movement
```

The RFC must support:

- unpaid
- partially paid
- paid
- cancelled
- refunded
- partially refunded

Define:

### PaymentTransaction

A payment event/transaction associated with an order.

### Refund

A refund transaction.

### RefundItem

Item-level refund detail where required.

Do not make `PaymentStatus = PAID` the conceptual default for every new order.

The application flow must explicitly determine the payment state.

---

# 12. IDEMPOTENCY

The RFC must define the need for idempotency for operations vulnerable to retries, including:

- checkout
- payment
- payment webhook
- inventory mutation where applicable

Define the conceptual uniqueness scope.

At minimum consider:

```text
tenant + operation type + idempotency key
```

Do not implement it.

Do not over-specify retention if the business requirement is not yet approved.

---

# 13. RECIPES / BOM

Define:

- Recipe
- RecipeItem

RecipeItem must:

- belong to the same tenant context
- reference an InventoryItem safely
- use canonical inventory UOM
- contain a precise quantity

The RFC must prevent cross-tenant recipe-to-inventory references.

If recipe versioning/effective dating is not required for Phase 1, document it as deferred rather than inventing a complex versioning system.

---

# 14. MODIFIERS

Define relational modifier architecture.

Potential concepts:

- ModifierGroup
- ModifierItem
- ProductModifierGroup
- ModifierRecipeEffect

If a modifier changes inventory consumption, the affected InventoryItem must be explicit.

Do not rely on arbitrary JSON as the authoritative inventory relationship.

Ensure tenant boundaries are clear.

---

# 15. SERVICES — ADR-005

The RFC must reflect the approved lean Services scope.

Phase 1:

```text
ProductType.SERVICE_LABOR
```

Service labor does not inherently represent physical inventory.

Optional consumables may use existing inventory/recipe mechanisms where appropriate.

Deferred:

- ServiceDefinition
- Appointment
- WorkOrder
- StaffAssignment
- ServiceMaterialUsage
- StaffCommission

Services remains inside the unified platform.

Do not create a microservice.

Avoid contaminating generic Core entities with service-specific workflow fields.

`assignedStaffUserId` should remain an explicit open implementation detail if not otherwise resolved.

---

# 16. TENANT-SCOPED UNIQUENESS

Review the RFC's uniqueness assumptions.

Explicitly analyze whether these should be:

- globally unique
- tenant-scoped
- outlet-scoped
- nullable/conditional

Pay particular attention to:

- invoice number
- SKU
- barcode
- user email
- external references
- idempotency keys

Do not make business identifiers globally unique merely because UUID primary keys are globally unique.

---

# 17. DECIMAL PRECISION

The RFC must define domain-level precision principles.

At minimum:

- inventory quantities → Decimal
- commercial packaging multiplier → Decimal
- conversion factor → Decimal
- monetary values → appropriate monetary precision

Avoid blindly prescribing one precision for every domain.

Where `Decimal(12,3)` is already an approved/established design choice, preserve it unless there is a documented conflict.

---

# 18. LEGACY COMPATIBILITY

Explicitly map existing concepts to the target architecture.

At minimum analyze:

```text
OutletProduct
StockMovement
Product
Order
OrderItem
Payment
Shift
Outlet
```

For each:

- current responsibility
- target responsibility
- migration path
- compatibility requirement
- eventual retirement/contract status

Do not assume immediate deletion of legacy structures.

---

# 19. MIGRATION ARCHITECTURE

The RFC must preserve:

```text
EXPAND
→ BACKFILL
→ DUAL-WRITE
→ VALIDATE / RECONCILE
→ CUTOVER
→ CONTRACT
```

Define the architectural purpose of each stage.

Important:

Dual-write must be centralized in a domain/application service, not scattered across controllers.

Migration must have explicit reconciliation gates.

Do not design destructive migration before consistency is proven.

---

# 20. CROSS-ADR CONSISTENCY

Before finalizing the RFC, explicitly validate:

### Tenant × Batch

Batch cannot cross tenant.

### Tenant × Recipe

RecipeItem cannot reference another tenant's InventoryItem.

### Tenant × Modifier

Modifier inventory effects cannot cross tenant.

### Negative Stock × Batch

Negative-stock policy must apply to the correct batch-aware stock dimension.

### UOM × Batch

Batch quantities use InventoryItem canonical UOM.

### UOM × Packaging

Packaging multiplier is not physical UOM conversion.

### Services × Inventory

SERVICE_LABOR does not imply physical stock.

### Services × Core

Do not pollute generic Core tables with full Services workflow.

### Order × Payment

Order status and payment status remain independent.

### Payment × Idempotency

Retries must not create duplicate financial events.

### Inventory × Concurrency

Concurrent deductions must not silently oversell stock.

---

# 21. RFC STRUCTURE

Rewrite/update:

`/docs/architecture/03_DATA_ARCHITECTURE_RFC.md`

Use this structure:

1. Status
2. Document Purpose
3. Scope
4. Goals
5. Non-Goals
6. Source of Truth
7. Architectural Principles
8. Domain Boundaries
9. Tenant Architecture
10. Core Platform Data
11. Commerce Data
12. Product vs InventoryItem
13. ProductVariant
14. Inventory Architecture
15. StorageLocation
16. InventoryBalance
17. InventoryLedger
18. InventoryBatch
19. UOM Architecture
20. Purchasing UOM
21. Commercial Packaging
22. Recipe/BOM
23. Modifiers
24. Order Lifecycle
25. Payment Lifecycle
26. Refund
27. Idempotency
28. Negative Stock
29. Inventory Concurrency
30. Services Boundary
31. Tenant-Scoped Uniqueness
32. Decimal Precision
33. Legacy Mapping
34. Migration Strategy
35. Dual-Write
36. Reconciliation Gates
37. Risks
38. Open Implementation Details
39. Schema Design Readiness

---

# 22. STATUS

The document should clearly state:

`RFC REVISION — OWNER ADRs INCORPORATED`

Do not mark the RFC as "fully approved implementation specification" yet.

The five ADRs are approved, but the revised RFC still requires validation before database schema implementation.

---

# 23. REQUIRED FINAL REPORT

After updating the RFC, provide a concise report containing:

## A. RFC Revision Summary

For each major area:

- what was changed
- which ADR it reflects
- whether the decision is closed or remains an implementation detail

## B. ADR Consistency Matrix

```text
ADR-001 Tenant        → CONSISTENT / ISSUE
ADR-002 Negative      → CONSISTENT / ISSUE
ADR-003 UOM           → CONSISTENT / ISSUE
ADR-004 Batch         → CONSISTENT / ISSUE
ADR-005 Services      → CONSISTENT / ISSUE
```

## C. Remaining Open Items

List only genuine unresolved items.

Do not create new decisions without Owner approval.

## D. Schema Readiness

Answer:

> Is the revised RFC sufficiently precise to begin target database schema revision?

If NO, explain exactly what blocks it.

If YES, state:

`READY FOR PROMPT 09 — TARGET DATABASE SCHEMA REVISION`

---

# 24. STRICT SCOPE REMINDER

This task ends after the RFC has been revised and reported.

DO NOT:

- edit Prisma schema
- create migration
- edit backend
- edit frontend
- create code
- change APIs
- implement InventoryDomainService
- implement tenant enforcement
- implement idempotency
- implement batch logic

The next task will be separately authorized.
