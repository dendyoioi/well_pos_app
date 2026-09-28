# PROMPT 09.2 — FINAL SCHEMA CONSISTENCY GATE

## Role

You are **Antigravity**, the primary architecture and implementation agent for the Well POS / `pos_apps` project.

At this stage you are acting **ONLY as a Database Architect / Final Schema Reviewer**.

The purpose of this task is to perform the final consistency gate on:

`/docs/architecture/04_TARGET_DATABASE_SCHEMA.md`

The current document is Revision 3.

Your task is to correct only the remaining consistency and invariant issues and produce **Revision 4 — Candidate Final Schema Design**.

This is still a **DESIGN + REVIEW stage**.

---

# 1. ABSOLUTE RULE — NO IMPLEMENTATION

Do NOT:

- modify `prisma/schema.prisma`
- create or modify Prisma migrations
- modify application source code
- modify API handlers
- modify services
- modify controllers
- modify repositories
- modify seed files
- modify the real database
- execute database migrations
- implement RLS
- implement database triggers
- implement inventory locking
- implement idempotency
- implement dual-write
- implement any application behavior

You may include SQL examples inside the architecture document when explaining a future constraint/index/migration.

You may update ONLY:

`/docs/architecture/04_TARGET_DATABASE_SCHEMA.md`

Do not modify the RFC or ADRs.

After Revision 4 is complete, STOP.

---

# 2. SOURCE-OF-TRUTH HIERARCHY

Use:

1. Existing source code + existing database/schema
2. Approved ADRs
3. Approved Data Architecture RFC Revision 4
4. Existing target schema Revision 3
5. This prompt
6. Your own assumptions

If sources conflict:

- identify the conflict
- do not silently resolve it
- follow the higher-authority source
- record the discrepancy if necessary

---

# 3. REQUIRED INPUTS

Read:

- `/docs/00_PROJECT_CONTEXT.md`
- `/docs/architecture/01_EXISTING_SYSTEM_AUDIT.md`
- `/docs/architecture/02_DEEP_DOMAIN_ANALYSIS.md`
- `/docs/architecture/03_DATA_ARCHITECTURE_RFC.md`
- `/docs/architecture/04_TARGET_DATABASE_SCHEMA.md`
- `/docs/decisions/ADR-001-tenant-boundary-enforcement.md`
- `/docs/decisions/ADR-002-negative-stock-policy.md`
- `/docs/decisions/ADR-003-uom-vs-packaging.md`
- `/docs/decisions/ADR-004-inventory-batch-lot.md`
- `/docs/decisions/ADR-005-services-module-boundary.md`
- `/docs/validation/05_SCHEMA_CONSISTENCY_VALIDATION_REPORT.md`
- `/docs/validation/06_ARCHITECTURE_DECISION_GATE_REPORT.md`

Inspect actual current Prisma schema/code where necessary, but DO NOT modify it.

---

# 4. OBJECTIVE

Revision 3 is architecturally strong, but the final gate must resolve the remaining consistency issues below.

Do NOT redesign the architecture.

Make the smallest corrections necessary to make the document internally precise and implementation-ready.

---

# 5. FINAL CORRECTIONS

## F1 — Correct entity count

Revision 3 states that the target schema contains 26 entities, but the Prisma DSL contains 31 models.

Recount the actual target models.

The document must use one consistent number.

Include a clear distinction, if useful, between:

- target Prisma models/entities
- conceptual domain modules/boundaries

Do not hide or remove models merely to preserve the old number.

---

## F2 — Tenant Isolation Terminology

Preserve the approved architecture:

**Direct `tenantId NOT NULL` + Service Layer enforcement; RLS later.**

The final document must distinguish:

### DB structural enforcement

Examples:

- `tenantId NOT NULL`
- FK existence
- tenant-scoped unique constraints
- foreign-key referential integrity

### Service-level tenant enforcement

Examples:

- verifying child tenant equals referenced entity tenant
- verifying outlet belongs to tenant
- validating user belongs to tenant
- repository filtering by tenant

### Future DB hardening

Examples:

- PostgreSQL RLS
- composite tenant-aware FKs where justified
- triggers/privileges where justified

Do NOT describe ordinary UUID FKs as tenant-safe.

Do NOT describe `tenantId NOT NULL` by itself as proof that cross-tenant references are impossible.

Update the relationship matrix accordingly.

---

# 6. USER ↔ OUTLET TENANT INVARIANT

Keep the Phase 1 model:

- `User.outletId` nullable
- `NULL` = tenant-wide authority
- non-NULL = branch-restricted staff
- future `UserOutlet` is deferred

Add an explicit invariant:

`User.outletId != NULL`
→ referenced Outlet MUST belong to the same tenant.

Also clarify:

- tenant-wide users can select an active outlet context
- branch-restricted users cannot operate outside their assigned outlet
- authorization must validate both tenant and outlet context

Do not create `UserOutlet` now.

---

# 7. INVENTORY BATCH DELETE POLICY

Review the current:

`InventoryLedger.inventoryBatchId -> InventoryBatch.onDelete = SetNull`

against the purpose of an immutable inventory audit trail.

Determine whether the target architecture should instead use:

`RESTRICT`

so a historical batch identity cannot disappear while ledger history remains.

Use the existing architecture and audit requirements as authority.

If you retain `SET NULL`, provide a strong documented reason.

If changing to `RESTRICT`, explain that batches are deactivated/retained rather than physically deleted when historical ledger references exist.

Do not implement the change in `schema.prisma`; only document it.

---

# 8. REFUND OVER-REFUND INVARIANT

Add a domain invariant preventing:

`SUM(RefundItem.quantity for one OrderItem) > OrderItem.quantity`

Also address monetary amount where appropriate.

Clarify that:

- a refund can be partial
- multiple refunds may exist
- cumulative refunded quantity/amount cannot exceed the original refundable quantity/amount
- service/application layer validates this
- refund processing should be idempotent

Do not invent an accounting subsystem.

---

# 9. INVENTORY LEDGER REFERENCE TYPE CONSISTENCY

Audit every reference to `InventoryRefType` and `StockMovementType`.

Resolve terminology inconsistencies such as:

`OPNAME`

vs

`STOCK_OPNAME_ADJUSTMENT`

Use one coherent vocabulary.

Clearly distinguish:

### Movement type

What physically happened:

- SALE
- PURCHASE
- TRANSFER_IN
- TRANSFER_OUT
- OPNAME_ADJUSTMENT
- RETURN
- WASTE
- VOID
- etc.

### Reference type

What business object caused the movement:

- ORDER
- PURCHASE_ORDER
- TRANSFER
- STOCK_OPNAME
- REFUND
- etc.

Do not mix these two concepts.

If exact enum values are already defined by the RFC, preserve them.

---

# 10. DELETE / CASCADE FINAL REVIEW

Audit all `onDelete` behavior in the proposed schema.

Particularly review:

- Product → ProductVariant
- ProductVariant → Recipe
- Recipe → RecipeItem
- ModifierGroup → ModifierItem
- Product → ProductModifierGroup
- ModifierGroup → ProductModifierGroup
- Order → OrderItem
- Refund → RefundItem
- PaymentTransaction → Refund
- InventoryItem → InventoryBatch
- InventoryBatch → InventoryBalance
- InventoryBatch → InventoryLedger
- User → operational records
- Outlet → operational records

Classify each as:

- CASCADE
- RESTRICT
- SET NULL
- Soft delete / inactive

Principle:

Historical transaction records must survive master-data lifecycle changes.

Master records should generally be deactivated rather than physically deleted once referenced by historical data.

Do not blindly remove all cascades.

Explain why each remaining cascade is safe.

---

# 11. PRODUCT / VARIANT / MODIFIER CONSISTENCY

Revision 3 says:

`ProductModifierGroup → Product`

Verify this against the approved RFC.

If the RFC defines modifier attachment at Product level, retain it.

If the RFC defines Variant level, correct it.

If both are supported, document the inheritance/precedence semantics.

Do not silently choose.

Also ensure the relationship matrix, entity definitions, and narrative all agree.

---

# 12. PRODUCTVARIANT → INVENTORYITEM CARDINALITY

Retain the intended:

**N : 1**

relationship if supported by the architecture.

Explicitly document:

Example:

- ProductVariant "Bottle" → InventoryItem "Aqua 600ml", multiplier 1
- ProductVariant "Carton 24" → same InventoryItem, multiplier 24

The multiplier affects transaction stock consumption:

`canonical quantity = order quantity × multiplier`

It does not create a second physical stock baseline.

Ensure no schema constraint accidentally turns this into 1:1.

---

# 13. INVENTORY BALANCE DIMENSION INVARIANTS

Keep:

### Non-batched

`tenant + inventoryItem + storageLocation + batch=NULL`

### Batched

`tenant + inventoryItem + storageLocation + batch`

Ensure:

- batch belongs to same tenant
- batch belongs to the same InventoryItem
- StorageLocation belongs to same tenant
- InventoryBalance tenant equals all referenced tenant-owned records

Document that Phase 1 cross-tenant equality is service-enforced unless a specific DB composite constraint is actually designed.

---

# 14. CATEGORY ROOT UNIQUENESS

Verify:

`@@unique([tenantId, parentId, name])`

and the partial unique index strategy for root categories.

If root category names must be unique per tenant:

```sql
CREATE UNIQUE INDEX ...
ON categories (tenant_id, name)
WHERE parent_id IS NULL;
```

For child categories, preserve uniqueness by:

`tenant + parent + name`

Make sure the final design does not accidentally create contradictory uniqueness rules.

---

# 15. PAYMENT LIFECYCLE FINAL CHECK

Verify:

- `Order.paymentStatus`
- `PaymentTransaction.status`
- `Refund`

are separate concepts.

The target should support:

- cash captured immediately
- QRIS/gateway pending
- gateway failure
- retry with another transaction
- successful capture
- refund

If the existing Retail checkout completes synchronously, document that the service explicitly creates a `CAPTURED` transaction rather than relying on a universal CAPTURED database default.

Do not overengineer gateway behavior.

---

# 16. ORDER STATUS FINAL CHECK

Review:

`OrderStatus = CONFIRMED`

against RFC Revision 4 and current Retail behavior.

If consistent, retain it.

If inconsistent, document the discrepancy and make the smallest correction.

Do not invent additional order states without architectural support.

---

# 17. QUANTITY / MONEY PRECISION FINAL CHECK

Review every:

- Decimal quantity
- price
- cost
- payment amount
- tax
- discount
- multiplier
- conversion factor

Ensure the precision is internally consistent and domain-appropriate.

Do not change precision arbitrarily.

Document rounding expectations where needed.

---

# 18. HISTORICAL SNAPSHOT FINAL CHECK

Verify historical preservation for:

- OrderItem.productName
- OrderItem.variantName
- OrderItem.sku
- OrderItem.quantity
- OrderItem.unitPrice
- OrderItem.costPrice
- OrderItem.modifiersSnapshot
- PaymentTransaction.amount
- Refund.amount
- InventoryLedger.unitCost

Master-data changes must not rewrite historical transaction snapshots.

---

# 19. SERVICES FINAL CHECK

Verify:

`SERVICE_LABOR`

can exist without:

- InventoryItem
- Recipe
- booking/work-order infrastructure

while still allowing service consumables through Recipe → InventoryItem.

Keep the full Services workflow deferred.

---

# 20. IDEMPOTENCY FINAL CHECK

Verify:

`tenantId + operationType + idempotencyKey`

is unique.

Document intended use for:

- checkout retry
- payment capture retry
- gateway webhook retry
- stock adjustment retry

Ensure idempotency records do not cross tenant boundaries.

---

# 21. FINAL SCENARIO MATRIX

Re-run these scenarios and mark:

`PASS / FAIL / NEEDS DECISION`

### A — Retail checkout
ProductVariant → InventoryItem → Balance → Order → Payment → Ledger

### B — F&B recipe
ProductVariant → Recipe → RecipeItem → InventoryItem → Ledger

### C — Modifier inventory effect
ModifierItem → ModifierRecipeEffect → InventoryItem

### D — Cross-tenant isolation
Tenant A cannot reference Tenant B entities.

### E — Concurrent stock deduction
Two simultaneous deductions cannot corrupt balanceBefore/balanceAfter.

### F — Payment retry
Failed payment followed by successful payment.

### G — Partial refund
Partial refund followed by another partial refund without exceeding original quantity/amount.

### H — Batch stock
Two batches coexist correctly at one location.

### I — Service-only sale
SERVICE_LABOR without physical inventory.

### J — Packaging variants
Two ProductVariants share one InventoryItem with different multipliers.

### K — Category hierarchy
Root and child category uniqueness behave as intended.

### L — User outlet authorization
Branch-restricted user cannot operate another outlet; tenant-wide user can select an authorized outlet.

---

# 22. FINAL ENTITY / RELATION CONSISTENCY CHECK

Before declaring readiness, verify:

- every entity in the entity inventory exists in the DSL
- every DSL model appears in the entity inventory
- every listed relation exists in the DSL
- every claimed FK actually exists
- every claimed unique constraint actually exists or is explicitly planned as raw SQL
- every enum used in DSL is defined/documented
- every relation name is internally consistent
- no relation is described as an FK if it is only conceptual
- no tenant-owned business identifier is accidentally globally unique
- no historical record is accidentally deleted by master-data cascade
- no contradictory semantics exist between DSL, matrix, narrative, and scenario validation

---

# 23. REVISION HISTORY

Add Revision 4 to the document revision history.

Summarize:

- entity count correction
- tenant enforcement terminology correction
- User.outletId invariant
- batch deletion policy
- refund cumulative invariant
- inventory movement/reference terminology
- delete/cascade clarification
- modifier attachment consistency
- final scenario validation
- final relationship consistency

---

# 24. FINAL STATUS

At the end of the document use exactly one:

### READY FOR OWNER APPROVAL

if all issues are resolved and no material architectural decision remains.

OR

### NOT READY — OWNER DECISION REQUIRED

if a genuine business/architecture choice remains.

OR

### NOT READY — DESIGN CORRECTIONS REQUIRED

if internal inconsistencies remain.

Do not claim "final" merely because the document is complete.

---

# 25. STOP CONDITION

After Revision 4:

1. Save `/docs/architecture/04_TARGET_DATABASE_SCHEMA.md`
2. Summarize corrections
3. List any unresolved decisions
4. Report scenario results
5. State final status
6. STOP

Do NOT proceed to Prisma implementation.

Do NOT create migrations.

Do NOT modify application code.

Human/project-owner approval must happen before implementation.

---

## END OF PROMPT
