# PROMPT 09.1 — SCHEMA DESIGN CORRECTION AND FINAL REVIEW

## Role

You are **Antigravity**, the primary architecture and implementation agent for the Well POS / `pos_apps` project.

At this stage you are acting **ONLY as a Database Architect / Schema Reviewer**.

Your task is to correct and finalize the target database schema design proposal based on the approved architecture decisions and the findings from the previous schema design review.

---

# 1. OBJECTIVE

Review and revise:

`/docs/architecture/04_TARGET_DATABASE_SCHEMA.md`

from its current Revision 2 into **Revision 3**.

The goal is to produce a schema design that is internally consistent, explicitly distinguishes database-enforced guarantees from service-enforced guarantees, and is sufficiently precise to become the basis for a later Prisma implementation.

This is still a **DESIGN + REVIEW stage**.

---

# 2. ABSOLUTE RULE — NO IMPLEMENTATION

Do NOT:

- modify `prisma/schema.prisma`
- create or modify Prisma migrations
- modify application source code
- modify API handlers
- modify services
- modify controllers
- modify repositories
- modify seed files
- modify database structure
- execute database migrations
- create SQL migration files
- implement RLS
- implement triggers
- implement inventory locking
- implement idempotency
- implement dual-write
- change existing application behavior

You may write SQL examples **inside the design document only** when needed to explain a future constraint or migration strategy.

You may update ONLY:

`/docs/architecture/04_TARGET_DATABASE_SCHEMA.md`

If another document requires correction, record the issue in the schema review section rather than modifying that document.

After completing Revision 3, STOP and wait for human review.

---

# 3. SOURCE-OF-TRUTH HIERARCHY

Use this order of authority:

1. Existing source code + existing database/schema
2. Approved Architecture Decisions
3. Approved Data Architecture RFC
4. Approved Migration Design, if present
5. This prompt
6. Your own implementation assumptions

Do not silently override an approved decision.

If two sources conflict:

- identify the conflict
- explain it
- follow the higher-level source
- record the discrepancy

---

# 4. REQUIRED INPUTS

Read completely:

### Existing architecture

- `/docs/00_PROJECT_CONTEXT.md`
- `/docs/architecture/01_EXISTING_SYSTEM_AUDIT.md`
- `/docs/architecture/02_DEEP_DOMAIN_ANALYSIS.md`
- `/docs/architecture/03_DATA_ARCHITECTURE_RFC.md`

### Approved decisions

- `/docs/decisions/ADR-001-tenant-boundary-enforcement.md`
- `/docs/decisions/ADR-002-negative-stock-policy.md`
- `/docs/decisions/ADR-003-uom-vs-packaging.md`
- `/docs/decisions/ADR-004-inventory-batch-lot.md`
- `/docs/decisions/ADR-005-services-module-boundary.md`

### Current target schema proposal

- `/docs/architecture/04_TARGET_DATABASE_SCHEMA.md`

### Previous review

- `/docs/validation/05_SCHEMA_CONSISTENCY_VALIDATION_REPORT.md`
- `/docs/validation/06_ARCHITECTURE_DECISION_GATE_REPORT.md`

Also inspect the actual current Prisma schema and relevant application code for consistency, but DO NOT modify them.

---

# 5. APPROVED ARCHITECTURE DECISIONS

Treat these as binding:

## Tenant isolation

Owner approved:

**1A — Direct tenantId NOT NULL + Service Layer enforcement; RLS later.**

Therefore:

- tenant-owned operational/domain tables should carry `tenantId`
- tenant equality across references must be explicitly enforced
- static/default tenant fallback must not be part of target architecture
- application/domain service validation is required
- RLS is future defense-in-depth, not Phase 1 implementation

Do not describe a normal UUID FK as automatically tenant-safe.

---

## Negative stock

Owner approved:

**2B — Context-driven negative stock.**

Use the approved policy hierarchy and distinguish:

- tenant default
- location override
- item override
- vertical defaults

Retail/warehouse behavior must remain strict according to the approved architecture.

F&B/service consumables may support controlled negative stock according to policy.

Negative stock is an operational exception and must remain auditable.

---

## UOM vs Packaging

Owner approved:

**3A — Strict separation of:**

1. physical canonical UOM
2. purchasing UOM / conversion
3. commercial packaging

Do not collapse these concepts.

`ProductVariant.inventoryQuantityMultiplier` represents commercial transaction-to-inventory conversion where applicable.

It must NOT redefine the physical baseline of the InventoryItem.

---

## Batch/Lot

Owner approved:

**4B — InventoryBatch is an optional stock dimension from the initial target architecture.**

Advanced FEFO/recall workflows may be deferred.

Batch-aware balances and ledger records must be designed consistently.

---

## Services

Owner approved:

**5B — SERVICE_LABOR now; full Services workflow later.**

The initial architecture supports service products/labor without forcing booking/work-order/commission entities into the core.

Service-only products do not require stock.

Consumable service materials may use the existing inventory/recipe architecture.

---

## User identity

Owner approved:

**Model B — tenant-scoped userCode + PIN.**

Therefore:

- `User.id` is an internal UUID
- `userCode` is tenant-scoped
- PIN is stored as a hash
- email is optional
- email uniqueness must be tenant-scoped if enforced
- `PlatformUser` remains separate from tenant `User`

---

# 6. REQUIRED CORRECTIONS

Revision 3 MUST explicitly resolve the following.

---

## C1 — Tenant-safe FK strategy

The current Revision 2 incorrectly implies that standard foreign keys plus service validation make relationships "tenant-safe".

Correct this distinction.

For each important relationship, classify enforcement as:

- DB-enforced tenant isolation
- Service-enforced tenant isolation
- Both
- Not tenant-owned / global reference

At minimum review:

- Order → Outlet
- Order → User
- OrderItem → Order
- OrderItem → ProductVariant
- ProductVariant → Product
- ProductVariant → InventoryItem
- Recipe → ProductVariant
- RecipeItem → Recipe
- RecipeItem → InventoryItem
- ModifierGroup → Tenant
- ModifierItem → ModifierGroup
- ProductModifierGroup → Product/ProductVariant
- ModifierRecipeEffect → ModifierItem / InventoryItem
- PaymentTransaction → Order
- Refund → Order
- RefundItem → Refund / OrderItem / InventoryItem
- InventoryBalance → InventoryItem / StorageLocation / InventoryBatch
- InventoryLedger → InventoryItem / StorageLocation / InventoryBatch
- InventoryBatch → InventoryItem
- User → Outlet
- StorageLocation → Outlet

Evaluate whether critical composite tenant-aware foreign keys are appropriate.

Do NOT automatically add composite FKs everywhere.

Instead explain:

- where ordinary FK + service validation is acceptable
- where DB-level tenant equality is materially important
- what a future composite FK or trigger/RLS strategy would provide

The relationship matrix must not label a relationship "DB tenant-safe" merely because both tables contain `tenantId`.

---

# 7. C2 — User.outletId SEMANTICS

The current proposal uses nullable:

`User.outletId`

Clarify its exact meaning.

If retained:

- `NULL` must have a precise authorization meaning
- it must not simply mean "unknown"
- tenant equality must be enforced
- explain whether NULL means tenant-wide access
- explain which roles may have NULL
- explain whether cashier users require an outlet
- explain whether multi-outlet users are supported

Do NOT invent a full `UserOutlet` access-control system.

If a future `UserOutlet` table is required, mark it explicitly as future scope.

---

# 8. C3 — quantityReserved SEMANTICS

The current `InventoryBalance.quantityReserved` is ambiguous.

Resolve this.

For Phase 1, choose and document one of:

### Option A
No reservation workflow exists.

`quantityReserved` remains future-ready and must stay `0`.

OR

### Option B
A defined reservation workflow exists.

If choosing B, specify:

- reservation entity/state
- reserve event
- release event
- fulfillment behavior
- concurrency behavior
- cancellation behavior

Do not invent a reservation subsystem unless supported by the architecture.

The likely Phase 1 choice should be Option A unless existing architecture explicitly requires reservations.

---

# 9. C4 — INVENTORY LEDGER IMMUTABILITY

Correct the phrase "DB-enforced immutable" unless actual database privileges/triggers guarantee it.

Distinguish:

### Application/service invariant

The application provides no update/delete operation.

### Database enforcement

A database trigger, privilege restriction, or other DB mechanism prevents UPDATE/DELETE.

Phase 1 may use application/service-level append-only behavior if that is the approved approach.

Do not claim stronger guarantees than the design actually provides.

Also explain whether corrections are made through compensating ledger entries rather than mutation.

---

# 10. C5 — DELETE / CASCADE POLICY

Review every important relation involving:

- Product
- ProductVariant
- Recipe
- RecipeItem
- ModifierGroup
- ModifierItem
- Order
- OrderItem
- PaymentTransaction
- Refund
- InventoryItem
- InventoryBatch
- InventoryBalance
- InventoryLedger
- User
- Customer
- Outlet
- StorageLocation

Classify delete behavior:

- RESTRICT
- CASCADE
- SET NULL
- Soft delete / inactive

Historical transactional records must not disappear simply because a master record is deactivated or removed.

Where appropriate, prefer inactive/archival semantics over physical deletion.

Do not blindly eliminate every cascade; explain why each cascade is safe or unsafe.

---

# 11. C6 — CATEGORY NULLABLE UNIQUE

Review:

`@@unique([tenantId, parentId, name])`

Because PostgreSQL NULL semantics may allow multiple rows where `parentId IS NULL`, determine the intended rule for root categories.

If root category names must be unique per tenant, specify the appropriate PostgreSQL constraint/index strategy.

If duplicates are intentionally allowed, state that explicitly.

Do not leave the ambiguity unresolved.

---

# 12. C7 — UNIT CONVERSION SCOPE

The current design makes `UnitConversion` global.

Determine whether this is intentional platform reference data.

Document:

- whether UOM codes are global
- whether conversions are global
- whether tenants may customize conversions
- whether tenant-specific UOMs are future scope
- how this interacts with the approved separation between physical conversion and commercial packaging

Do not add tenant-specific UOM infrastructure unless justified.

---

# 13. C8 — PAYMENT TRANSACTION LIFECYCLE

Review the current default:

`PaymentTransaction.status = CAPTURED`

against the architecture's separation of:

- OrderStatus
- PaymentStatus
- PaymentTransaction lifecycle

Determine the correct Phase 1 lifecycle.

Consider states such as:

- PENDING
- AUTHORIZED
- CAPTURED
- FAILED
- VOIDED
- REFUNDED

Do not add unnecessary payment complexity.

But the design must support:

- cash payment
- QRIS/payment gateway
- retries
- failed payments
- multiple payment transactions
- refunds

Ensure the order's `PaymentStatus` is not confused with individual transaction status.

If current Retail checkout explicitly creates a completed payment, document how it reaches CAPTURED without making CAPTURED the unsafe universal default.

---

# 14. ADDITIONAL REQUIRED CHECK — INVENTORY BALANCE ↔ LEDGER RELATION

Inspect the current schema proposal carefully.

If the relationship matrix says:

`InventoryBalance → InventoryLedger`

via `(locationId, itemId, batchId)`

but there is no actual FK representing that relationship, correct the documentation.

Determine whether:

### Option A
There is intentionally no direct FK.

InventoryBalance is the current-state projection and InventoryLedger is the immutable event/history stream. They share dimensions but are not parent-child records.

OR

### Option B
A real FK is justified.

Do not add one merely to make the matrix look complete.

The final relationship matrix must describe actual schema relationships, not conceptual associations as if they were FKs.

---

# 15. ADDITIONAL REQUIRED CHECK — PRODUCTVARIANT ↔ INVENTORYITEM CARDINALITY

Review the current relationship:

`ProductVariant.inventoryItemId`

Determine whether multiple ProductVariants may intentionally reference the same InventoryItem.

This matters for:

- Single vs carton packaging
- bottle vs case
- commercial variants
- `inventoryQuantityMultiplier`

If many variants may share one InventoryItem, document this explicitly.

Ensure the multiplier is interpreted as a transaction conversion factor and does not create conflicting physical stock baselines.

---

# 16. ADDITIONAL REQUIRED CHECK — PRODUCT / PRODUCTVARIANT / MODIFIERS

Verify whether modifiers attach to:

- Product
- ProductVariant
- both

Use the RFC as the authority.

If the current schema differs from the RFC, flag the discrepancy and resolve it explicitly.

Do not silently choose a model.

---

# 17. ORDER LIFECYCLE CHECK

Verify:

- OrderStatus
- PaymentStatus
- PaymentTransaction.status
- Refund
- RefundItem
- void/cancel behavior
- stock deduction trigger

Confirm that:

`OrderStatus != PaymentStatus != PaymentTransaction.status`

and that the configured inventory deduction trigger is compatible with the lifecycle.

Review the current default:

`OrderStatus = CONFIRMED`

and determine whether that is consistent with the RFC and existing Retail behavior.

If not, document the discrepancy and propose the smallest architectural correction.

---

# 18. INVENTORY CONCURRENCY CHECK

Review the proposed balance update strategy.

It must protect:

- onHand
- balanceBefore
- balanceAfter

against concurrent operations.

Confirm that the target design uses an atomic transaction strategy such as:

1. begin transaction
2. ensure balance row exists
3. lock balance row
4. read current quantity
5. validate negative-stock policy
6. calculate new quantity
7. append ledger movement
8. update balance
9. commit

Do not implement this.

Document it as the target invariant.

---

# 19. BATCH-AWARE BALANCE CHECK

Confirm that:

- non-batch stock has one balance dimension per tenant + inventory item + location
- batch-tracked stock has one balance dimension per tenant + inventory item + location + batch
- batch ownership matches inventory item
- batch belongs to the same tenant
- a batch cannot be used with an unrelated InventoryItem

Review PostgreSQL unique-index behavior with nullable `batchId`.

If partial unique indexes are required, document the exact conceptual constraint and its future migration strategy.

---

# 20. HISTORICAL SNAPSHOT CHECK

Confirm historical records preserve important values.

At minimum review:

- OrderItem.costPrice
- OrderItem.productName snapshot
- OrderItem SKU snapshot if applicable
- Payment amounts
- Refund amounts
- InventoryLedger.unitCost

Explain which master-data changes must NOT rewrite historical transactions.

---

# 21. SERVICES PHASE 1 CHECK

Confirm:

`SERVICE_LABOR`

is supported in the target Product/ProductVariant model.

Clarify:

- service-only product does not require InventoryItem
- service consumables may use Recipe → InventoryItem
- booking/work order/commission remain future extension
- no service-specific fields are forced into Core unless approved

---

# 22. DECIMAL / QUANTITY CHECK

Review all quantity and monetary fields.

Classify:

- stock quantities
- UOM conversion quantities
- multipliers
- prices
- costs
- taxes
- payment amounts

Ensure integer stock is not accidentally retained where decimal quantity is required.

Do not arbitrarily choose precision without domain justification.

---

# 23. TENANT-SCOPED UNIQUENESS CHECK

Review all unique constraints.

At minimum:

- User.userCode
- User.email
- Outlet.code
- Product.sku
- ProductVariant.sku
- ProductVariant.barcode
- Order.invoiceNumber
- Refund.refundNumber
- IdempotencyRecord(operationType + key)
- InventoryItem.itemCode
- InventoryBatch(batchNumber)
- Category(name + parent)

No tenant-owned business identifier should accidentally become globally unique unless explicitly justified.

---

# 24. SCENARIO VALIDATION

Re-run the design mentally against at least:

### Scenario A — Retail checkout
Product → ProductVariant → InventoryItem → InventoryBalance → Order → PaymentTransaction → Ledger

### Scenario B — F&B recipe sale
ProductVariant → Recipe → RecipeItem → InventoryItem → Ledger

### Scenario C — Modifier replacement
ModifierItem → ModifierRecipeEffect → target InventoryItem

### Scenario D — Multi-tenant isolation
Tenant A cannot reference Tenant B's:

- Product
- InventoryItem
- Outlet
- User
- Recipe
- Modifier
- Order
- Payment
- InventoryBatch

### Scenario E — Concurrent stock deduction
Two cashiers attempt to consume the same stock simultaneously.

### Scenario F — Payment retry
Initial payment fails; second transaction succeeds.

### Scenario G — Partial refund
One OrderItem is partially refunded and restock behavior is represented correctly.

### Scenario H — Batch-tracked item
Two batches of the same InventoryItem exist at the same StorageLocation.

### Scenario I — Service-only sale
SERVICE_LABOR product is sold without physical stock.

### Scenario J — Packaging variant
Two ProductVariants share one InventoryItem with different inventoryQuantityMultiplier values.

For every scenario:

`PASS / FAIL / NEEDS DECISION`

with a short explanation.

---

# 25. REQUIRED DOCUMENT STRUCTURE FOR REVISION 3

Update `/docs/architecture/04_TARGET_DATABASE_SCHEMA.md`.

Keep the existing useful sections where possible.

The revised document must contain:

1. Document metadata
2. Scope
3. Architecture principles
4. Entity inventory
5. Full target entity definitions
6. Tenant isolation strategy
7. Tenant-safe relationship enforcement matrix
8. User identity and outlet semantics
9. Product / ProductVariant / InventoryItem model
10. UOM and packaging model
11. InventoryBatch
12. InventoryBalance
13. InventoryLedger
14. Inventory concurrency model
15. Recipe model
16. Modifier model
17. Order lifecycle
18. Payment lifecycle
19. Refund model
20. Idempotency
21. Negative stock policy
22. Services Phase 1
23. Historical snapshot policy
24. Delete/cascade policy
25. Unique constraint strategy
26. Decimal/quantity strategy
27. Legacy mapping
28. Migration considerations
29. Prisma/PostgreSQL implementation considerations
30. Scenario validation
31. Open decisions / unresolved issues
32. Revision history
33. Final schema design status

---

# 26. IMPORTANT WRITING RULE

Do not claim:

- "DB-enforced" when it is only service validation
- "tenant-safe FK" when tenant equality is not actually enforced
- "immutable at DB level" when only application code prevents mutation
- "FK relationship" when the schema only has a conceptual association
- "unique" when PostgreSQL NULL semantics undermine the intended constraint

Be precise.

---

# 27. FINAL STATUS

At the end, explicitly state one of:

### READY FOR OWNER APPROVAL

or

### NOT READY — OWNER DECISION REQUIRED

or

### NOT READY — DESIGN CORRECTIONS REQUIRED

If there are unresolved architectural decisions, list them clearly.

Do not implement anything after writing Revision 3.

---

# 28. STOP CONDITION

After producing Revision 3:

1. save the document
2. summarize the corrections
3. list unresolved decisions
4. state whether the schema is ready for owner approval
5. STOP

Do NOT proceed to:

- Prisma schema implementation
- migration generation
- coding
- tests against the real DB
- data migration
- dual-write

Human/project-owner review must happen first.

---

## END OF PROMPT
