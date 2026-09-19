# PROMPT 04 — TARGET DATABASE SCHEMA & MIGRATION DESIGN

## ROLE

You are Antigravity, the primary architecture agent for Well POS / `pos_apps`.

The project already has:

- an existing-system audit
- deep domain analysis
- a data architecture RFC
- approved architecture decisions where available

Your task is to produce the **target database schema design and migration design**.

This remains a controlled architecture/documentation task unless the prompt explicitly authorizes implementation.

Do not modify application code.

Do not modify the actual Prisma schema.

Do not create or execute database migrations.

---

# 1. READ FIRST

Read:

- `/docs/00_PROJECT_CONTEXT.md`
- `/docs/architecture/01_EXISTING_SYSTEM_AUDIT.md`
- `/docs/architecture/02_DEEP_DOMAIN_ANALYSIS.md`
- `/docs/architecture/03_DATA_ARCHITECTURE_RFC.md`
- all approved ADRs in `/docs/decisions/`
- actual current Prisma schema

Approved ADR decisions are binding.

---

# 2. OBJECTIVE

Design the target PostgreSQL/Prisma data model for the unified Well POS SaaS platform.

The target must support:

- multi-tenancy
- multi-outlet
- warehouse
- Retail
- F&B
- Services
- physical inventory
- recipes
- modifiers
- packaging
- UOM
- batch/lot
- payments
- refunds
- auditability
- future extensibility

while preserving compatibility with the existing system during migration.

---

# 3. TARGET SCHEMA PRINCIPLES

## Tenant

Tenant-owned records must have a reliable tenant boundary.

Where direct `tenantId` is required:

- make it NOT NULL
- add appropriate tenant indexes
- validate cross-tenant references

Do not rely on a static default tenant.

## Product / InventoryItem

Keep separate concepts:

```text
Product = commercial
InventoryItem = physical/logistical/costed
```

Retail may be 1:1.

F&B may use Product → Recipe → InventoryItem.

Services may use SERVICE_LABOR with optional consumables.

---

# 4. INVENTORY SCHEMA

Design:

- InventoryItem
- StorageLocation
- InventoryBalance
- InventoryLedger
- InventoryBatch
- UnitOfMeasure
- UnitConversion

The ledger should be append-oriented and auditable.

Do not label it double-entry accounting unless accounting entries are modeled.

Inventory balance must support transactional concurrency.

---

# 5. BATCH SCHEMA

Use:

```text
InventoryItem 1:N InventoryBatch
```

For non-batched items:

```text
Item + Location
```

For batched items:

```text
Item + Location + Batch
```

The schema must explicitly address the uniqueness behavior of nullable batch dimensions in PostgreSQL.

Do not reduce batch to text metadata on ledger entries.

Advanced FEFO/recall can remain deferred.

---

# 6. UOM / PACKAGING SCHEMA

Define:

- UnitOfMeasure
- UnitConversion
- canonical inventory UOM
- purchasing conversion
- commercial packaging

Commercial packaging should use:

```text
ProductVariant.inventoryQuantityMultiplier
```

The multiplier must:

- be positive
- use suitable decimal precision
- represent canonical inventory quantity consumed per commercial unit

Do not mix physical UOM conversion with commercial packaging.

---

# 7. PRODUCT VARIANT

Design ProductVariant for:

- SKU
- barcode
- price relationship
- product relationship
- inventory relationship
- commercial packaging
- inventory quantity multiplier

Consider whether one ProductVariant can map to one InventoryItem and what happens when packaging or inventory relationships differ.

Do not silently introduce a many-to-many relationship unless justified.

---

# 8. RECIPES

Design:

- Recipe
- RecipeItem

RecipeItem must support:

- tenant isolation
- InventoryItem reference
- quantity
- canonical UOM
- appropriate constraints

Prevent cross-tenant recipe → inventory references.

Consider future recipe versioning without over-engineering Phase 1.

---

# 9. MODIFIERS

Design relational modifier structures where inventory behavior matters.

Potential concepts:

- ModifierGroup
- ModifierItem
- ProductModifierGroup
- ModifierRecipeEffect

If a modifier changes inventory consumption, the schema must identify the affected InventoryItem.

Avoid storing critical inventory relationships only inside arbitrary JSON.

---

# 10. ORDER / PAYMENT / REFUND

Keep separate:

- Order
- OrderItem
- PaymentTransaction
- Refund
- RefundItem

Do not collapse order status and payment status.

Historical financial/inventory values that must remain stable should be snapshotted where appropriate, including historical cost/HPP on OrderItem if required by the architecture.

Payment lifecycle should not default to an inappropriate final state merely because the current Retail flow assumes immediate payment. The application flow should explicitly create the appropriate state.

---

# 11. IDEMPOTENCY

Design an idempotency structure for operations such as:

- checkout
- payment
- webhook
- stock mutation

Consider:

- tenant scope
- idempotency key
- operation type
- request fingerprint where appropriate
- result/reference
- uniqueness
- retention

Do not implement it here.

---

# 12. NEGATIVE STOCK

The target schema must support negative balances where policy allows them.

Do not add a universal:

```sql
CHECK (quantity_on_hand >= 0)
```

constraint.

The schema should support audit metadata such as:

- isNegativeBalance
- actor
- source reference
- location
- item
- batch where applicable
- timestamp
- reconciliation state where required

---

# 13. CONCURRENCY

Document the implementation requirement for:

- transaction boundaries
- row-level locking
- balanceBefore
- quantityDelta
- balanceAfter
- ledger append

Do not claim that a simple application pre-check is sufficient.

---

# 14. SERVICES

Phase 1 schema should support:

```text
ProductType.SERVICE_LABOR
```

but should NOT unnecessarily implement the full Services module.

Future concepts may include:

- ServiceDefinition
- Appointment
- WorkOrder
- StaffAssignment
- ServiceMaterialUsage
- StaffCommission

Keep these as future extension boundaries unless the approved architecture explicitly requires otherwise.

Avoid contaminating generic Core tables with service-specific fields.

---

# 15. TENANT-SCOPED UNIQUENESS

Review every unique constraint.

Ask:

- Is this globally unique?
- Should it be tenant-scoped?
- Is it branch-scoped?
- Is it a human-facing identifier?

Pay special attention to:

- invoice number
- SKU
- barcode
- email
- external reference
- idempotency key

Do not make human/business identifiers globally unique merely because UUIDs are global.

---

# 16. PRECISION

Use domain-appropriate Decimal types for:

- inventory quantity
- cost
- price where required
- multiplier
- conversion factor

Do not blindly use integer quantities for the new inventory engine.

Document precision/scale choices and their rationale.

---

# 17. MIGRATION DESIGN

For each major legacy model/field, define:

- source
- target
- transformation
- backfill
- dual-write
- validation
- cutover
- legacy retirement

Use:

```text
EXPAND
→ BACKFILL
→ DUAL-WRITE
→ VALIDATE / RECONCILE
→ CUTOVER
→ CONTRACT
```

Include reconciliation gates.

Do not perform destructive migration until the new model is proven consistent.

---

# 18. OUTPUT

Create/update:

`/docs/architecture/04_TARGET_DATABASE_SCHEMA.md`

Required sections:

1. Status
2. Target Schema Overview
3. Tenant Model
4. User / RBAC
5. Outlet / StorageLocation
6. Commerce
7. ProductVariant
8. InventoryItem
9. InventoryBalance
10. InventoryLedger
11. InventoryBatch
12. UOM
13. Recipe/BOM
14. Modifiers
15. Order
16. Payment
17. Refund
18. Idempotency
19. Shift
20. CRM
21. Services Contract
22. Constraints & Indexes
23. Tenant-Scoped Uniqueness
24. Decimal Precision
25. Concurrency Requirements
26. Migration Mapping
27. Backfill
28. Dual-Write
29. Reconciliation
30. Cutover
31. Legacy Contract
32. Risks
33. Open Implementation Details
34. Schema Readiness

Include conceptual ER relationships and Prisma-oriented model definitions where useful, but keep this document a design artifact, not the actual schema file.

---

# 19. IMPLEMENTATION GATE

End the document with:

## Target Schema Readiness

State:

- what is fully defined
- what remains open
- what must be validated before implementation
- whether the design is ready for schema consistency validation

Do not implement code, schema, or migration.

The next step after this document is a separate validation gate.
