# WELL POS — PROJECT CONTEXT

## 1. Project Identity

**Project:** Well POS  
**Repository:** `pos_apps`  
**Business direction:** Multi-tenant SaaS Point of Sale platform

Well POS is an existing POS application that is approximately 70% complete. The current system is primarily oriented toward Retail. The project goal is to evolve it into a unified multi-tenant cloud POS platform supporting:

- Retail
- Food & Beverage (F&B)
- Services

The project must evolve incrementally and preserve existing investment. A full rewrite is not the objective.

---

## 2. Current System

The existing application already contains substantial functionality, including:

- Authentication
- Role-based access
- Cashier PIN
- Device pairing
- JWT-based sessions
- Tenant/subscription foundations
- Superadmin portal
- Product/catalog
- Barcode/SKU
- Category
- Checkout
- Split payment
- Cash and QRIS
- Hold order
- Tax/service charge
- Cashier shifts
- Open/X/Z shift operations
- Multi-outlet
- Central warehouse concept
- Stock in/out
- Stock opname
- Stock transfer
- Low-stock monitoring
- CRM/customer management
- Gross profit/HPP reporting

The current inventory model is primarily based on outlet/product stock and historical stock movements.

The current Product model is serving multiple conceptual purposes:

1. Commercial catalog item
2. Sellable item
3. Inventory-linked item

The target architecture separates these concerns.

---

## 3. Technology Stack

Known technology stack:

- Frontend: React
- TypeScript
- Vite
- Tailwind CSS
- Backend: Node.js / Express
- ORM: Prisma
- Database: PostgreSQL
- Testing/load testing includes Locust
- Development and infrastructure may use Docker/Portainer/AWS/Cloudflare depending on environment

The exact versions and implementation details must always be verified against the repository rather than assumed from this document.

---

## 4. Target Product Architecture

The target is **one unified platform**, not three separate applications.

Conceptual architecture:

```text
                    WELL POS SaaS
                         |
        +----------------+----------------+
        |                |                |
      CORE           COMMERCE         INVENTORY
        |                |                |
        +----------------+----------------+
                         |
             +-----------+-----------+
             |           |           |
           RETAIL       F&B       SERVICES
```

### Core Platform

Shared platform capabilities:

- Tenant
- Platform/User
- Outlet
- Shift
- CRM
- Authentication/RBAC
- Payment infrastructure
- SaaS/subscription foundations

### Commerce

Universal commercial layer:

- Category
- Product
- ProductVariant
- Price
- Product types

### Inventory Engine

Shared physical inventory capabilities:

- InventoryItem
- StorageLocation
- InventoryBalance
- InventoryLedger
- InventoryBatch
- UnitOfMeasure
- UnitConversion
- Stock movements
- Recipes/BOM where applicable
- Inventory policies

### Retail

Retail-specific workflows such as:

- Barcode selling
- Packaged goods
- Standard stock-controlled sales
- Purchasing/receiving workflows

### F&B

F&B-specific capabilities such as:

- Recipes/BOM
- Ingredients
- Modifiers
- Kitchen-oriented workflow
- Table/order concepts where required
- Configurable stock deduction timing

### Services

Services is a future vertical extension inside the same platform.

Phase 1 contract:

- `ProductType.SERVICE_LABOR`
- Service products do not inherently represent physical stock
- Optional consumable relationships can use the shared inventory/recipe architecture where appropriate

Full Services capabilities are deferred, including:

- ServiceDefinition
- Appointment
- WorkOrder
- StaffAssignment
- ServiceMaterialUsage
- StaffCommission

---

## 5. Product vs InventoryItem

This is a foundational architectural distinction.

### Product

Represents the commercial/sellable concept.

Examples:

- Aqua 600ml
- Es Kopi Susu
- Haircut 60 Minutes

### InventoryItem

Represents the physical/logistical/costed inventory concept.

Examples:

- Aqua bottle
- Coffee beans
- Milk
- Shampoo

Typical relationships:

```text
Retail:
Product / ProductVariant
        |
        v
InventoryItem
```

```text
F&B:
Product
   |
 Recipe
   |
 RecipeItem
   |
InventoryItem
```

```text
Services:
SERVICE_LABOR Product
        |
 optional consumables
        |
  InventoryItem
```

This separation is required to avoid forcing every commercial product to behave as a physical stock item.

---

## 6. Tenant Isolation

Well POS uses a shared database/shared schema SaaS architecture.

Tenant isolation is a security-critical architectural requirement.

The approved Phase-1 direction is:

- Direct `tenantId NOT NULL` on tenant-owned operational/domain child tables where required
- Service/application-layer tenant enforcement
- Explicit cross-tenant reference validation
- No static/default tenant fallback
- PostgreSQL RLS prepared as future defense-in-depth, not required as a Phase-1 prerequisite

Tenant isolation must be treated as a structural requirement, not merely a UI/filtering concern.

---

## 7. Inventory Principles

Inventory is treated as a domain with:

- Physical stock
- Immutable movement history
- Balance state
- Cost/HPP
- Storage locations
- Optional batch dimensions
- UOM
- Negative-stock policy

The target architecture uses an immutable inventory movement ledger.

Do not describe the inventory movement ledger as double-entry accounting unless actual accounting debit/credit entries exist.

Inventory balance and ledger operations must account for transactional concurrency.

---

## 8. Approved UOM and Packaging Principle

The canonical inventory UOM belongs to `InventoryItem`.

The canonical UOM is the selected standard unit used to record inventory. It is **not necessarily the smallest indivisible unit**.

Examples:

- Coffee beans → GRAM
- Rice → KG
- Eggs → PCS

Physical UOM conversion is distinct from commercial packaging.

Commercial packaging may use:

```text
ProductVariant.inventoryQuantityMultiplier
```

Example:

```text
Aqua bottle = multiplier 1
Aqua carton of 24 = multiplier 24
```

Purchasing UOM conversion is conceptually separate from commercial selling packaging.

---

## 9. Approved Batch/Lot Principle

Batch is a stock dimension, not merely ledger metadata.

Target architecture:

```text
InventoryItem 1:N InventoryBatch
```

For non-batched inventory:

```text
InventoryItem + StorageLocation
```

For batched inventory:

```text
InventoryItem + StorageLocation + InventoryBatch
```

`InventoryBatch` is present in the initial target architecture as an optional capability.

Advanced features such as:

- FEFO
- product recall workflow
- advanced shelf-life analytics

are deferred.

---

## 10. Approved Negative Stock Principle

Negative stock uses a context-driven policy.

Policy hierarchy:

```text
Tenant Policy
      ↓
Location Override
      ↓
Item Override
```

General intent:

- Retail standard goods: normally non-negative
- Warehouse outbound: normally non-negative
- F&B kitchen/bar: negative may be tolerated where operationally necessary
- Services consumables: negative may be tolerated when explicitly allowed

Negative stock is an operational exception, not the target state.

Every negative-stock event must remain auditable.

Do not use a universal database CHECK constraint that prohibits negative stock.

---

## 11. Approved Services Boundary

Services remains inside the unified platform.

Phase 1 supports:

```text
ProductType.SERVICE_LABOR
```

Full service workflow is deferred.

Avoid polluting generic Core entities with service-specific fields. A temporary optional hook may exist only where explicitly justified; richer service staff assignment should eventually live in the Services extension.

---

## 12. Order / Payment / Inventory Lifecycle

These are related but distinct concepts.

Do not collapse:

- Order status
- Payment status
- Inventory status/movement

into one state machine.

The architecture must be capable of representing cases such as:

- unpaid order
- partially paid order
- paid order
- cancelled order
- refunded order
- inventory deducted at a configurable business event

Inventory deduction timing is a domain decision and may vary by vertical/use case, such as:

- ON_PAYMENT
- ON_ORDER_CONFIRM
- ON_KITCHEN_DISPATCH
- ON_WORK_ORDER_FINISH

The exact Phase-1 implementation must be established in the relevant RFC/schema work.

---

## 13. Migration Strategy

The project follows a controlled evolutionary migration:

```text
EXPAND
   ↓
BACKFILL
   ↓
DUAL-WRITE
   ↓
VALIDATE / RECONCILE
   ↓
CUTOVER
   ↓
CONTRACT / REMOVE LEGACY
```

Do not perform destructive replacement before reconciliation.

Every migration stage should have explicit validation gates.

Dual-write logic should be centralized in a domain/application service rather than scattered across controllers.

---

## 14. Source-of-Truth Hierarchy

When resolving conflicts:

1. Existing source code and actual database/schema
2. Approved Architecture Decisions
3. Approved Data Architecture
4. Approved Migration Design
5. Prompt/task instruction
6. AI-generated inference

Do not invent behavior that conflicts with the repository or approved decisions.

When evidence is insufficient, mark the item as an open decision or implementation detail.

---

## 15. AI Agent Roles

### Human / Project Owner

Owns business and architecture decisions.

### Antigravity

Primary implementation and architecture agent.

Responsibilities:

- Repository analysis
- Architecture analysis
- Documentation
- Schema design
- Implementation
- Migration
- Testing
- Validation

Must follow controlled task scope.

### Codex

Second pair of eyes / reviewer.

Responsibilities:

- Review architecture
- Review implementation
- Detect inconsistencies
- Identify risks
- Validate against `/docs`

Codex should not independently rewrite architecture or code unless explicitly assigned to do so.

---

## 16. Documentation Workflow

The project follows:

```text
READ
  ↓
UNDERSTAND
  ↓
ANALYZE
  ↓
REPORT
  ↓
REVIEW
  ↓
APPROVE
  ↓
IMPLEMENT
  ↓
TEST
```

Architecture documentation must precede implementation where a change affects domain boundaries, data ownership, or migration strategy.

---

## 17. Current Approved Architecture Decisions

### ADR-001 — Tenant Boundary Enforcement

**Approved decision:** Option B

- Direct `tenantId NOT NULL`
- Service-layer enforcement
- Cross-tenant reference validation
- Remove static tenant fallback
- RLS later as defense-in-depth

### ADR-002 — Negative Stock Policy

**Approved decision:** Option B

Context-driven policy with:

```text
Tenant → Location → Item
```

Negative stock is an operational exception.

### ADR-003 — UOM vs Packaging

**Approved decision:** Option A

Strict separation:

```text
Physical Inventory UOM
≠
Purchasing UOM Conversion
≠
Commercial Packaging
```

Commercial packaging uses `inventoryQuantityMultiplier`.

### ADR-004 — Inventory Batch/Lot

**Approved decision:** Option B

`InventoryBatch` is an optional stock dimension in the initial target architecture.

### ADR-005 — Services Module Boundary

**Approved decision:** Option B

Stable Services architecture contract now; full Services domain later.

---

## 18. Current Project Gate

The five architecture ADRs have been approved by the Project Owner.

The next controlled stage is:

```text
ADR APPROVED
     ↓
RFC REVISION
     ↓
TARGET DATABASE SCHEMA REVISION
     ↓
SCHEMA CONSISTENCY VALIDATION #2
     ↓
IMPLEMENTATION GATE
     ↓
IMPLEMENTATION
```

Do not skip the validation gate.

---

## 19. Critical Known Risks to Preserve

The following issues have been identified and must not be forgotten during future design work:

- Tenant boundary enforcement
- Cross-tenant foreign-key/reference validation
- Nullable tenant ownership in legacy schema
- Static default tenant fallback
- Concurrent stock deduction / overselling
- Inventory balance and ledger concurrency
- Idempotency for payment/checkout retry
- Order status vs payment status separation
- Refund/RefundItem modeling
- Product vs InventoryItem separation
- ProductVariant packaging multiplier
- UOM conversion correctness
- Batch-aware inventory balance
- Negative-stock reconciliation
- Recipe/BOM architecture
- Relational modifier architecture
- StorageLocation
- Purchase Order / Goods Receipt / supplier flows
- Services boundary
- Dual-write divergence
- Migration reconciliation gates

---

## 20. Documentation Rule

`/docs` is the canonical project knowledge base.

Future agents should read the relevant `/docs` files before making architectural or implementation changes.

Do not rely on chat history as the sole source of project decisions.
