# PROMPT 07 — APPLY OWNER ARCHITECTURE DECISIONS TO ADRs

## ROLE

You are Antigravity, the primary implementation and architecture agent for the Well POS / `pos_apps` project.

You must now apply the explicit Project Owner architecture decisions to the five existing ADRs.

This is an **architecture/documentation revision task only**.

DO NOT write application code.

DO NOT modify Prisma schema.

DO NOT create or run database migrations.

DO NOT modify API contracts.

DO NOT modify frontend/backend implementation.

DO NOT perform implementation work.

---

# 1. SOURCE OF TRUTH

Use the following hierarchy:

1. Existing source code and current database/schema
2. Existing approved architecture analysis
3. Existing data architecture RFC
4. Existing migration design
5. Existing validation reports
6. The explicit Project Owner decisions in this prompt
7. AI inference

Where this prompt conflicts with an older PROPOSED ADR, this prompt represents the new explicit Project Owner decision.

Do not silently introduce additional architectural decisions.

If a consequence of a decision is not fully specified, document it as an open implementation/design point rather than inventing a solution.

---

# 2. PROJECT OWNER DECISIONS

The Project Owner explicitly approves the following combination:

## ADR-001 — Tenant Boundary Enforcement

**Decision: A**

Adopt:

* `tenantId NOT NULL` on tenant-owned child operational/domain tables where required.
* Backend/service-layer tenant enforcement.
* Explicit cross-tenant reference validation.
* Remove the existing fallback/default-tenant behavior.
* Prepare architecture for PostgreSQL RLS as a future defense-in-depth phase.
* RLS is NOT a Phase-1 implementation requirement.

Important:

Direct `tenantId` columns alone are NOT sufficient.

The architecture must explicitly prevent a record belonging to Tenant A from referencing a parent/resource belonging to Tenant B.

Preserve this as a required service/domain validation rule.

---

## ADR-002 — Negative Stock Policy

**Decision: B**

Use a context-driven negative-stock policy.

Required conceptual behavior:

### Retail

Physical retail goods should normally enforce non-negative stock.

### Warehouse

Warehouse stock should not normally become negative.

### F&B

Kitchen/production/service-consumable inventory may tolerate negative stock when operationally necessary.

### Services

Consumable inventory may tolerate negative stock where explicitly permitted.

Negative stock must be treated as an operational exception, not as an ordinary target state.

The policy should support:

* tenant-level policy
* location-level override where appropriate
* item-level override where necessary

Avoid creating multiple independent rule engines for vertical, tenant, and location.

Prefer a clear policy hierarchy.

Every negative-stock event must remain auditable, including:

* actor
* source transaction
* location
* item
* quantity
* resulting balance
* timestamp
* reconciliation status where applicable

Do not add a hard database CHECK constraint that universally prohibits negative stock.

---

## ADR-003 — UOM vs Packaging

**Decision: A**

Maintain a clear distinction between:

### Physical Inventory UOM

Used for physical stock and inventory calculations.

Examples:

* KG
* GRAM
* LITER
* ML
* PCS

`InventoryItem` owns the canonical inventory UOM.

Do NOT describe the canonical/base UOM as necessarily the "smallest indivisible unit."

It is the canonical UOM selected for the inventory item.

### Commercial Packaging

Used to represent how a product is sold.

Example:

* Aqua bottle = 1 PCS
* Aqua carton = 24 PCS

Use `ProductVariant.inventoryQuantityMultiplier` for commercial packaging where appropriate.

The multiplier:

* must be positive
* must have domain-appropriate precision
* represents how much canonical inventory quantity one commercial unit consumes

Important distinction:

Commercial packaging multiplier is NOT the same concept as physical UOM conversion.

Purchasing UOM conversion must remain conceptually separate from commercial selling-packaging.

---

## ADR-004 — Inventory Batch/Lot

**Decision: B**

Do NOT defer the entire batch concept until Phase 7.

Instead:

Introduce `InventoryBatch` as an optional stock dimension from the initial target architecture.

Conceptually:

`InventoryItem 1:N InventoryBatch`

A batch should belong to the appropriate tenant/item context and support at minimum:

* batch/lot identifier
* expiry date where applicable
* inventory item relationship

For non-batched items:

Stock remains:

`InventoryItem + StorageLocation`

For batched items:

Stock becomes:

`InventoryItem + StorageLocation + InventoryBatch`

The architecture must therefore acknowledge batch-aware inventory balance.

Advanced capabilities such as:

* FEFO
* advanced recall
* sophisticated batch analytics
* advanced traceability workflows

may remain deferred to later phases.

Do NOT reduce batch to merely metadata attached to an inventory ledger entry.

Batch is a stock dimension.

---

## ADR-005 — Services Module Boundary

**Decision: B**

Keep Services as a first-class future vertical extension, but do not implement the full Services domain in Phase 1.

Phase 1 architecture should support:

* `ProductType.SERVICE_LABOR`
* service products that do not themselves represent physical inventory
* optional consumable relationships through the inventory/recipe architecture where appropriate

Defer the full Services domain implementation, including:

* ServiceDefinition
* Appointment
* WorkOrder
* StaffAssignment
* ServiceMaterialUsage
* StaffCommission
* advanced service scheduling

Do not create a separate microservice.

Services remains part of the unified Well POS architecture.

Be cautious about putting service-specific fields directly into generic Core entities.

If `assignedStaffUserId` on `OrderItem` is retained in the ADR, clearly mark it as optional and subject to later domain validation. Prefer future `StaffAssignment` within the Services extension for richer service workflows.

---

# 3. CROSS-ADR CONSISTENCY REQUIREMENTS

While revising the ADRs, explicitly ensure consistency between the decisions.

## Tenant × Batch

`InventoryBatch` must be tenant-owned and cannot be referenced across tenants.

## Negative Stock × Batch

If a batched item allows negative stock, the policy must operate against the appropriate batch-aware stock dimension.

Do not accidentally allow negative stock against the aggregate item balance while the actual operational balance is batch-specific.

## UOM × Batch

Batch quantities must use the canonical UOM of the associated `InventoryItem`.

## UOM × Packaging

`inventoryQuantityMultiplier` is commercial packaging logic.

Do not use it as a replacement for physical UOM conversion.

## Services × Inventory

`SERVICE_LABOR` itself does not imply physical stock.

Service consumables may consume `InventoryItem` stock through the appropriate future/current inventory mechanisms.

## Tenant × All Operational Children

Tenant-owned operational records must have a reliable tenant boundary.

Do not rely solely on parent inheritance if that creates cross-tenant FK ambiguity.

---

# 4. REQUIRED ADR REVISIONS

Revise these files:

```text
/docs/decisions/ADR-001-tenant-boundary-enforcement.md
/docs/decisions/ADR-002-negative-stock-policy.md
/docs/decisions/ADR-003-uom-vs-packaging.md
/docs/decisions/ADR-004-inventory-batch-lot.md
/docs/decisions/ADR-005-services-module-boundary.md
```

Each ADR must:

1. Preserve its original purpose and useful analysis.
2. Record the Project Owner decision.
3. Clearly distinguish:

   * Context
   * Problem
   * Options
   * Decision
   * Consequences
   * Constraints
   * Deferred work
   * Open questions
4. Remove ambiguity where the Owner decision resolves it.
5. Do not silently add unrelated architectural decisions.
6. Mark implementation details that still require RFC/schema design as pending.

---

# 5. STATUS

After applying these decisions:

Change the five ADRs from:

`PROPOSED`

to:

`APPROVED — OWNER DECISION RECORDED`

Only where the decision has actually been resolved.

If an ADR still contains unresolved sub-decisions that materially affect implementation, explicitly mark those sub-decisions as:

`OPEN IMPLEMENTATION DETAIL`

Do not invent an answer simply to make the ADR appear completely closed.

---

# 6. IMPORTANT CORRECTIONS FROM VALIDATION

Ensure the revised ADRs preserve these previously identified corrections:

### Tenant isolation

Direct tenantId plus service-layer enforcement is required.

RLS is future defense-in-depth, not the Phase-1 prerequisite.

### Inventory terminology

Do not call the stock movement structure "double-entry accounting" unless actual accounting debit/credit entries exist.

Use terminology such as:

* Inventory Ledger
* Stock Movement Ledger
* Immutable Inventory Movement

as appropriate.

### Inventory concurrency

Where balances and ledger entries depend on previous balances, the future implementation must account for transactional concurrency and row locking.

This remains an implementation/RFC concern, not something to code now.

### Payment lifecycle

Do not resolve payment lifecycle architecture inside these ADR revisions unless directly required by one of the five decisions.

### Refund

Do not omit the previously identified need for `RefundItem` in the later schema revision.

This is a downstream schema requirement, not a reason to expand these ADRs unnecessarily.

---

# 7. DOCUMENTATION ONLY

Allowed:

* modify the five ADR markdown files
* update references to their status
* clarify architectural consequences
* update cross-references between ADRs

Not allowed:

* source-code changes
* Prisma schema changes
* migration files
* database changes
* API implementation
* frontend implementation
* tests
* generated seed data
* production configuration changes

---

# 8. REQUIRED OUTPUT

After revision, provide a concise report:

## ADR Revision Summary

For each ADR:

* ADR ID
* Previous status
* New status
* Owner decision applied
* Key changes
* Remaining open implementation details

Then provide:

## Cross-ADR Consistency Check

Explicitly verify:

* Tenant isolation ↔ Batch
* Negative stock ↔ Batch
* UOM ↔ Packaging
* UOM ↔ Batch
* Services ↔ Inventory
* Services ↔ Core
* Tenant isolation ↔ operational child records

Then provide:

## Implementation Gate

State whether the documentation layer is ready for the next stage.

Expected result:

`ADR LAYER APPROVED — READY FOR RFC REVISION`

This does NOT authorize schema or code implementation.

The next stage will be a separate controlled task to revise:

```text
/docs/architecture/03_DATA_ARCHITECTURE_RFC.md
/docs/architecture/04_TARGET_DATABASE_SCHEMA.md
```

and then perform another validation gate.

Do not proceed to that stage automatically.
