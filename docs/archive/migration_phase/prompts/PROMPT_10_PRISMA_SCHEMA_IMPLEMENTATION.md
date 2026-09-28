# PROMPT 10 — PRISMA SCHEMA IMPLEMENTATION

## Role

You are **Antigravity**, the primary implementation and architecture agent for the Well POS / `pos_apps` project.

The project has completed its architecture and target database design phase.

The following document is now the authoritative database architecture baseline:

- `/docs/architecture/04_TARGET_DATABASE_SCHEMA.md`
- Revision 4 — `ARCH-2026-09-DB-SCHEMA-04`
- Status: READY FOR OWNER APPROVAL / Architecture Locked

Supporting authoritative documents:

- `/docs/00_PROJECT_CONTEXT.md`
- `/docs/architecture/01_EXISTING_SYSTEM_AUDIT.md`
- `/docs/architecture/02_DEEP_DOMAIN_ANALYSIS.md`
- `/docs/architecture/03_DATA_ARCHITECTURE_RFC.md`
- `/docs/validation/05_SCHEMA_CONSISTENCY_VALIDATION_REPORT.md`
- `/docs/validation/06_ARCHITECTURE_DECISION_GATE_REPORT.md`
- `/docs/decisions/ADR-001-tenant-boundary-enforcement.md`
- `/docs/decisions/ADR-002-negative-stock-policy.md`
- `/docs/decisions/ADR-003-uom-vs-packaging.md`
- `/docs/decisions/ADR-004-inventory-batch-lot.md`
- `/docs/decisions/ADR-005-services-module-boundary.md`

---

# 1. PRIMARY OBJECTIVE

Implement the **Revision 4 target database design into the project's Prisma schema**.

The scope of this task is intentionally narrow:

> Translate the approved Revision 4 database design into `prisma/schema.prisma` (or the project's actual Prisma schema location), validate it, and STOP.

This is a **schema implementation task only**.

---

# 2. ABSOLUTE RULES

## DO NOT

Do not:

- redesign the architecture;
- introduce new domain concepts;
- remove approved Revision 4 concepts;
- modify business logic;
- modify controllers;
- modify routes;
- modify services;
- modify frontend code;
- modify API contracts;
- modify authentication behavior;
- modify inventory behavior;
- modify checkout behavior;
- perform production database changes;
- run destructive database commands;
- run `prisma db push` against a real/shared/production database;
- run `prisma migrate deploy` against a real/shared/production database;
- create application migrations as part of this task;
- perform data backfills;
- perform dual-write;
- perform cutover;
- silently "fix" architecture decisions.

If an implementation detail appears impossible or contradictory, **STOP and REPORT it** rather than inventing a new architecture.

---

# 3. SOURCE-OF-TRUTH HIERARCHY

Use this hierarchy when resolving implementation questions:

1. Existing source code and current database/schema
2. Approved Architecture Decisions / ADRs
3. `03_DATA_ARCHITECTURE_RFC.md` Revision 4
4. `04_TARGET_DATABASE_SCHEMA.md` Revision 4
5. This prompt
6. General Prisma knowledge

However:

- Do not use existing implementation as justification for violating the approved target architecture.
- Existing schema/code is the migration baseline, not the target architecture.
- Where the target design explicitly supersedes an existing structure, implement the target structure.
- Where Revision 4 is ambiguous, STOP and report the ambiguity.

---

# 4. PRE-IMPLEMENTATION READ

Before editing anything:

1. Inspect repository structure.
2. Locate the actual Prisma schema file.
3. Inspect the existing `schema.prisma`.
4. Inspect `package.json`.
5. Inspect Prisma configuration if present.
6. Inspect existing database/migration directories.
7. Read the authoritative Revision 4 target schema completely.
8. Read the relevant ADRs and RFC sections.
9. Identify differences between current Prisma schema and target Revision 4.

Do not start editing before this comparison is complete.

---

# 5. IMPLEMENTATION SCOPE

Implement all approved Revision 4 target models and enums.

The target currently defines:

### 31 Prisma models

1. PlatformUser
2. Tenant
3. SubscriptionPlan
4. TenantSubscription
5. SaaSInvoice
6. SaaSPayment
7. User
8. Outlet
9. Shift
10. Customer
11. Category
12. Product
13. ProductVariant
14. UnitConversion
15. StorageLocation
16. InventoryItem
17. InventoryBatch
18. InventoryBalance
19. InventoryLedger
20. Recipe
21. RecipeItem
22. ModifierGroup
23. ModifierItem
24. ProductModifierGroup
25. ModifierRecipeEffect
26. Order
27. OrderItem
28. PaymentTransaction
29. Refund
30. RefundItem
31. IdempotencyRecord

### Target enums

Implement every enum specified by Revision 4, preserving names and values exactly unless Prisma requires a mechanically equivalent representation.

Pay particular attention to:

- User / Role
- ProductType
- OrderStatus
- PaymentStatus
- PaymentTxStatus
- PaymentMethod
- RefundReason
- StockMovementType
- InventoryRefType
- ActorType
- ShiftStatus
- StorageLocationType
- SelectionType
- UomType
- PlatformRole
- TenantStatus
- BusinessVertical
- BillingCycle
- InvoiceStatus
- PaymentRecordStatus

---

# 6. CRITICAL MODEL REQUIREMENTS

## 6.1 Tenant Isolation

All tenant-owned models must have:

```prisma
tenantId String
```

and the corresponding database mapping:

```prisma
@map("tenant_id")
```

Do not make approved tenant-owned `tenantId` fields nullable.

Do not restore any static/default tenant fallback.

Remember:

- Prisma FK relations alone do NOT enforce tenant equality.
- Tenant equality remains a mandatory service-layer invariant.
- Do not invent composite FK architecture beyond what Revision 4 specifies.

---

## 6.2 User Model B

Implement:

- internal UUID `id`;
- `tenantId`;
- `userCode`;
- `pinHash`;
- optional email;
- optional password hash;
- role;
- optional `outletId`.

Preserve:

```text
tenant + userCode = unique
tenant + email = unique
```

Preserve the semantics:

- `outletId != NULL` → outlet-restricted user;
- `outletId == NULL` → tenant-wide authority.

Do not introduce `UserOutlet` in this phase.

---

## 6.3 Product / ProductVariant / InventoryItem

Preserve the architectural separation:

```text
Product
  ↓
ProductVariant
  ↓
InventoryItem
```

but allow the approved N:1 relationship:

```text
many ProductVariant → one InventoryItem
```

Implement:

```text
inventoryQuantityMultiplier Decimal(12,3)
```

with the approved default.

Do not collapse Product, ProductVariant and InventoryItem back into one model.

---

## 6.4 Recipe

Recipe belongs to exactly one ProductVariant.

Preserve:

```text
ProductVariant 1 : 1 Recipe
Recipe 1 : N RecipeItem
```

RecipeItem references InventoryItem.

---

## 6.5 Modifiers

Implement the relational modifier architecture:

```text
ModifierGroup
  ↓
ModifierItem

Product
  ↓
ProductModifierGroup
  ↓
ModifierGroup

ModifierItem
  ↓
ModifierRecipeEffect
  ↓
InventoryItem
```

Do not revert modifiers to JSON-only storage.

---

## 6.6 Inventory

Implement:

- StorageLocation
- InventoryItem
- InventoryBatch
- InventoryBalance
- InventoryLedger

Preserve:

```text
InventoryBalance.quantityOnHand Decimal(12,3)
InventoryBalance.quantityReserved Decimal(12,3)
```

Preserve optional batch dimension.

InventoryBalance must support the two approved uniqueness dimensions:

### Unbatched

```text
tenant + inventoryItem + storageLocation
```

when `inventoryBatchId IS NULL`.

### Batched

```text
tenant + inventoryItem + storageLocation + inventoryBatch
```

when `inventoryBatchId IS NOT NULL`.

Prisma's normal `@@unique` syntax is insufficient for the partial-index requirement.

Therefore:

- model the fields and ordinary indexes in Prisma;
- document the required PostgreSQL partial unique indexes;
- DO NOT create a migration in this task.

Required future migration indexes include:

```text
uq_category_root
uq_storage_location_default
uq_inv_balance_unbatched
uq_inv_balance_batched
```

---

# 7. INVENTORY LEDGER

Implement InventoryLedger as an append-only historical model.

Required fields include:

- tenantId
- inventoryItemId
- storageLocationId
- optional inventoryBatchId
- quantityDelta
- balanceBefore
- balanceAfter
- unitCost
- movementType
- referenceType
- referenceId
- actorType
- optional actorUserId
- isNegativeBalance
- notes
- createdAt

Preserve:

```text
InventoryBatch → InventoryLedger = RESTRICT
User → InventoryLedger = RESTRICT
InventoryItem → InventoryLedger = RESTRICT
StorageLocation → InventoryLedger = RESTRICT
```

Do not implement database triggers for immutability in this task.

---

# 8. ORDER / PAYMENT / REFUND

Preserve the independent lifecycle:

```text
OrderStatus
PaymentStatus
```

Do not collapse them.

Order must retain historical order items.

OrderItem must retain historical snapshots:

- productName
- variantName
- sku
- quantity
- unitPrice
- costPrice
- discountAmount
- subtotal
- modifiersSnapshot

PaymentTransaction must support multiple payment records per order.

Default payment transaction state:

```text
PENDING
```

Refund must have:

```text
Refund
RefundItem
```

and preserve the approved cumulative refund invariant at service level:

```text
sum(refunded quantity) <= original sold quantity
```

Do not attempt to enforce this invariant with a simple Prisma CHECK constraint.

---

# 9. IDEMPOTENCY

Implement:

```text
IdempotencyRecord
```

with the approved tenant-scoped uniqueness:

```text
tenantId + operationType + idempotencyKey
```

This is required for:

- checkout retry;
- payment retry;
- webhook retry;
- stock adjustment retry.

---

# 10. DELETE POLICIES

Implement the Revision 4 delete policies exactly.

Especially:

### RESTRICT historical/audit relations

- ProductVariant → OrderItem
- InventoryItem → InventoryBalance
- InventoryItem → InventoryLedger
- InventoryBatch → InventoryBalance
- InventoryBatch → InventoryLedger
- Order → PaymentTransaction
- Order → Refund
- PaymentTransaction → Refund
- OrderItem → RefundItem
- User → Order
- User → Shift
- User → InventoryLedger
- Outlet → operational children

### Composition cascades

- Product → ProductVariant
- ProductVariant → Recipe
- Recipe → RecipeItem
- ModifierGroup → ModifierItem
- Product → ProductModifierGroup
- ModifierItem → ModifierRecipeEffect
- Refund → RefundItem
- Order → OrderItem where explicitly approved

Do not introduce cascade behavior merely to make Prisma validation easier.

---

# 11. DECIMAL PRECISION

Preserve the approved precision:

```text
Inventory quantity       Decimal(12,3)
Packaging multiplier     Decimal(12,3)
UOM conversion factor    Decimal(12,6)
Prices/totals             Decimal(15,2)
Inventory unit costs      Decimal(15,4)
Tax rates                 Decimal(5,4)
```

Do not silently change precision.

---

# 12. CATEGORY / DEFAULT LOCATION / PARTIAL INDEXES

The following are PostgreSQL-level invariants and cannot be represented completely by ordinary Prisma `@@unique` declarations:

### Category root uniqueness

Only one category with the same:

```text
tenantId + name
```

when:

```text
parentId IS NULL
```

### StorageLocation default

Only one:

```text
isDefault = true
```

per:

```text
tenantId + outletId
```

### InventoryBalance

Use the two partial uniqueness rules defined by Revision 4.

Do not fake these with an incorrect nullable `@@unique`.

Document them clearly in comments if necessary.

---

# 13. SERVICES PHASE 1

Implement only the approved Phase 1 Services boundary.

`ProductType.SERVICE_LABOR` must work without:

- InventoryItem
- Recipe

A service-only order must therefore be representable without inventory movement.

Do NOT create:

- ServiceDefinition
- Appointment
- WorkOrder
- StaffAssignment
- ServiceMaterialUsage
- StaffCommission

Those remain deferred.

---

# 14. MIGRATION SAFETY

This task is NOT the migration task.

You may:

- edit `schema.prisma`;
- run Prisma schema validation;
- run Prisma formatting;
- run safe local/static checks;
- generate Prisma client if it is safe and does not modify a real database.

You must NOT:

- create migration files;
- apply migrations;
- run `db push` against shared/production databases;
- modify existing production data.

If a local disposable database is required for validation, explicitly report that dependency before using it.

---

# 15. VALIDATION REQUIRED

After implementation, validate at minimum:

### Structural

- Prisma schema parses.
- Prisma schema validates.
- Prisma formatting succeeds.
- All 31 models exist.
- All target enums exist.
- Relations resolve.
- Relation names are unambiguous.
- Delete actions match Revision 4.

### Architectural

Verify:

- tenantId coverage;
- Model B User;
- Product / ProductVariant / InventoryItem separation;
- N:1 ProductVariant → InventoryItem;
- Recipe ownership;
- Modifier relations;
- InventoryBatch;
- InventoryBalance dimensions;
- InventoryLedger;
- Order/payment separation;
- Refund/RefundItem;
- IdempotencyRecord;
- SERVICE_LABOR boundary.

### Mechanical

Check for:

- accidental nullable tenantId;
- accidental global unique constraints where tenant-scoped uniqueness is required;
- missing indexes;
- incorrect `onDelete`;
- missing relation backreferences;
- duplicated relation names;
- enum/value mismatches;
- Decimal precision mismatches.

---

# 16. REQUIRED REPORT

After implementation and validation, produce a concise implementation report.

The report must contain:

## A. Files changed

List every changed file.

## B. Models implemented

Confirm all 31 models.

## C. Enums implemented

Confirm all target enums.

## D. Important constraints

Confirm:

- tenant-scoped uniqueness;
- partial-index requirements;
- delete policies;
- Decimal precision;
- relation cardinalities.

## E. Validation result

Report exact commands/checks executed and their results.

## F. Deviations

If anything could not be implemented exactly, list:

```text
Deviation
Reason
Impact
Recommended next action
```

Do not silently resolve deviations.

## G. Migration readiness

State:

```text
READY FOR MIGRATION DESIGN
```

only if the Prisma schema implementation is structurally valid and no unresolved design deviation remains.

Otherwise state:

```text
BLOCKED — DESIGN/IMPLEMENTATION ISSUE REQUIRES REVIEW
```

---

# 17. STOP CONDITION

When the Prisma schema implementation and validation are complete:

**STOP.**

Do not proceed to:

- migration design;
- migration creation;
- database migration;
- domain service implementation;
- dual-write;
- reconciliation;
- cutover.

Those are separate controlled phases.

---

# FINAL DIRECTIVE

Implement **only** the approved Revision 4 database schema into Prisma.

Preserve the architecture.

Do not redesign.

Do not touch business logic.

Do not migrate the database.

Validate thoroughly.

Report exactly what happened.

Then STOP.
