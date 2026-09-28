# PROMPT 08.1 — RFC REVISION 3 CORRECTIONS

## ROLE

You are Antigravity, the primary architecture agent for the Well POS / `pos_apps` project.

The Project Owner has reviewed:

`/docs/architecture/03_DATA_ARCHITECTURE_RFC.md`

Current version:

`Revision 2`

The RFC already incorporates the five approved ADR decisions:

- ADR-001 — Tenant Boundary Enforcement → Owner decision 1A
- ADR-002 — Negative Stock Policy → Owner decision 2B
- ADR-003 — UOM vs Packaging → Owner decision 3A
- ADR-004 — Inventory Batch/Lot → Owner decision 4B
- ADR-005 — Services Module Boundary → Owner decision 5B

The RFC is architecturally strong, but the Project Owner identified several ambiguities that must be resolved before target database schema design.

Your task is to produce **RFC Revision 3** by correcting ONLY the issues specified in this prompt.

This is a **documentation and architecture correction task only**.

DO NOT:

- modify source code
- modify Prisma schema
- create migrations
- execute database migrations
- modify the database
- implement APIs
- implement services
- modify frontend/backend code
- create production code

---

# 1. SOURCE OF TRUTH

Use this hierarchy:

1. Existing source code and actual current database/schema
2. `/docs/00_PROJECT_CONTEXT.md`
3. `/docs/architecture/01_EXISTING_SYSTEM_AUDIT.md`
4. `/docs/architecture/02_DEEP_DOMAIN_ANALYSIS.md`
5. Approved ADRs in `/docs/decisions/`
6. Current `/docs/architecture/03_DATA_ARCHITECTURE_RFC.md`
7. This prompt

The five approved ADR decisions remain binding.

Do not introduce unrelated architecture decisions.

Where this prompt identifies an ambiguity but does not determine the final answer, document the unresolved point explicitly rather than inventing a decision.

---

# 2. PRIMARY OBJECTIVE

Update:

`/docs/architecture/03_DATA_ARCHITECTURE_RFC.md`

from Revision 2 to Revision 3.

The revised RFC must remove the nine identified ambiguities below.

The goal is to make the RFC safe to use as the input for:

`PROMPT 09 — TARGET DATABASE SCHEMA REVISION`

---

# 3. CORRECTION #1 — PRODUCTVARIANT ↔ RECIPE OWNERSHIP

## Problem

The current RFC contains two potentially conflicting concepts:

1. `ProductVariant` may link to a `Recipe`.
2. `Recipe` may link to `Product` or `ProductVariant`.

This creates ambiguity about recipe ownership.

## Required correction

Define one clear Phase-1 canonical relationship.

The RFC must explicitly answer:

- Does a Recipe belong to Product?
- Does a Recipe belong to ProductVariant?
- Can a Recipe belong to either?
- Can a Product have multiple variants with different recipes?

Do not leave the schema designer to infer this.

## Design constraint

The architecture must support legitimate F&B cases such as:

```text
Burger
 ├── Regular
 │      └── Recipe A
 └── Large
        └── Recipe B
```

if variant-specific recipes are required by the domain.

If the architecture instead chooses Product-level recipes, explicitly explain how variant-specific ingredient quantities are handled.

Choose the model based on the existing project analysis and approved architecture.

Do not introduce unnecessary recipe complexity or full enterprise BOM versioning.

## Required output

Add an explicit subsection:

`### Recipe Ownership Rule`

It must state the canonical Phase-1 relationship and its invariants.

---

# 4. CORRECTION #2 — PRODUCT SKU VS PRODUCTVARIANT SKU

## Problem

The current RFC describes `ProductVariant.sku` as a commercial identifier but the uniqueness table also lists `Product.sku`.

This is ambiguous.

## Required correction

Use the existing system evidence to determine which entity is the canonical owner of:

- SKU
- barcode

Then explicitly distinguish:

```text
Product
vs
ProductVariant
```

for commercial identification.

The RFC must state:

- whether Product has a SKU
- whether ProductVariant has a SKU
- whether both can have identifiers
- which identifier is used at checkout
- which identifier is scanned by barcode
- uniqueness scope

Do not simply duplicate SKU fields without a clear semantic reason.

If legacy `Product.sku` must temporarily remain for compatibility, distinguish:

```text
Legacy identifier
vs
Target canonical identifier
```

rather than treating both as equally authoritative.

## Required output

Update:

- Product / Commerce section
- ProductVariant section
- Tenant-Scoped Uniqueness section
- Legacy Mapping section

so they are internally consistent.

---

# 5. CORRECTION #3 — SERVICE_LABOR MIGRATION / INVENTORY REQUIREMENT

## Problem

The current reconciliation gate says:

> 100% of active Product rows must possess an active ProductVariant and corresponding InventoryItem.

This conflicts with:

```text
ProductType.SERVICE_LABOR
```

because Services do not inherently represent physical stock.

## Required correction

Change the migration/reconciliation rule so that:

### Physical-stock products

Require:

```text
Product
→ ProductVariant
→ InventoryItem
```

where the target business behavior requires physical stock.

### SERVICE_LABOR

Require:

```text
Product
→ ProductVariant
→ NO mandatory InventoryItem
```

unless the specific service has explicitly configured consumables.

Do not create fake InventoryItems solely to satisfy migration parity.

## Required output

Update:

- Legacy Mapping
- Migration Strategy
- Reconciliation Gates
- Services Boundary

The catalog completeness gate must distinguish stock-controlled and non-stock service products.

---

# 6. CORRECTION #4 — BATCH-AWARE INVENTORYBALANCE UNIQUENESS

## Problem

The RFC correctly defines two stock dimensions:

```text
Non-batched:
Tenant + Item + Location

Batched:
Tenant + Item + Location + Batch
```

However, the database uniqueness behavior for nullable `inventoryBatchId` is not sufficiently specified.

## Required correction

Define the architectural uniqueness invariant explicitly.

The RFC must ensure:

### Non-batched

Only one balance exists for:

```text
tenantId + inventoryItemId + storageLocationId
```

when no batch is used.

### Batched

Only one balance exists for:

```text
tenantId + inventoryItemId + storageLocationId + inventoryBatchId
```

for a specific batch.

The RFC must explicitly call out PostgreSQL nullable-unique behavior as a schema-design concern.

Do NOT prescribe an implementation mechanism unless it is already supported by the approved architecture.

Acceptable examples to discuss as schema-design options include:

- partial unique index
- normalized stock-dimension representation
- another PostgreSQL-safe uniqueness mechanism

But do not silently choose one if that choice belongs to Prompt 09.

## Required output

Add:

`### Balance Uniqueness Invariant`

and mark the exact database mechanism as:

`[OPEN SCHEMA IMPLEMENTATION DETAIL]`

unless it can be safely determined from the existing architecture.

---

# 7. CORRECTION #5 — INVENTORYBATCH.initialQuantity

## Problem

The current RFC contains:

```text
InventoryBatch.initialQuantity
```

This risks creating a third source of truth alongside:

```text
InventoryBalance
InventoryLedger
```

## Required correction

Clarify that:

```text
InventoryBatch
=
batch identity / metadata

InventoryBalance
=
current stock state

InventoryLedger
=
immutable stock movement history
```

If `initialQuantity` is retained, it must NOT be treated as current stock or as an independent stock source of truth.

Prefer removing `initialQuantity` from the target conceptual model unless there is a documented audit/business requirement for it.

If retained, explicitly define its semantic purpose and relationship to the initial ledger event.

Do not make InventoryBatch a stock balance container.

## Required output

Update the InventoryBatch section and remove any implication that:

```text
InventoryBatch.initialQuantity
```

is authoritative inventory.

---

# 8. CORRECTION #6 — NEGATIVE STOCK: VERTICAL DEFAULT VS EFFECTIVE POLICY

## Problem

The current RFC says:

```text
F&B → ALLOW_NEGATIVE = true
Services → ALLOW_NEGATIVE = true
```

This can be interpreted as an unconditional vertical rule.

That is inconsistent with the approved context-driven hierarchy.

## Required correction

The RFC must clearly distinguish:

### Vertical default

A vertical may define an operational default.

Example:

```text
F&B → default may allow negative for kitchen/bar consumables
Services → default may allow negative for consumables
```

### Effective policy

Actual permission must be evaluated through:

```text
Tenant Policy
      ↓
Location Override
      ↓
Item Override
```

Therefore:

> F&B does NOT automatically mean negative stock is always allowed.

A Retail tenant may choose a different policy.

An F&B tenant may also configure strict stock.

The vertical is contextual guidance/default behavior, not a parallel policy engine.

## Required output

Rewrite the negative-stock matrix and surrounding explanation so there is no contradiction.

---

# 9. CORRECTION #7 — STOCK DEDUCTION TRIGGER MUST BE CONFIGURABLE

## Problem

The current RFC presents fixed vertical behavior:

```text
Retail → CONFIRMED / Checkout
F&B → CONFIRMED or Preparation
Services → COMPLETED
```

This leaves the schema/application designer with ambiguity.

## Required correction

Preserve the architectural concept of configurable deduction triggers.

Recognized trigger options:

```text
ON_PAYMENT
ON_ORDER_CONFIRM
ON_KITCHEN_DISPATCH
ON_WORK_ORDER_FINISH
```

Verticals may provide defaults, but the effective behavior must not be hard-coded solely by vertical.

The RFC should define the conceptual precedence.

For example:

```text
Platform / Vertical Default
        ↓
Tenant Configuration
        ↓
Operational Context
```

Do NOT invent an additional Product-level trigger override unless the existing architecture requires it.

The RFC must also explain that Services Phase 1 has no full WorkOrder implementation, so `ON_WORK_ORDER_FINISH` remains a future-capable trigger rather than an immediate Phase-1 workflow requirement.

## Required output

Replace the fixed trigger table with:

- recognized trigger model
- vertical defaults
- tenant configurability
- deferred triggers
- implementation detail markers where necessary

---

# 10. CORRECTION #8 — USER EMAIL / IDENTITY SCOPE

## Problem

The current RFC declares:

```text
User.email = Global Platform
```

This is a significant authentication architecture decision.

## Required correction

Inspect the existing authentication and user model before deciding.

Determine whether the existing system conceptually treats:

```text
email
```

as:

A. global platform identity

or

B. tenant-scoped user identity

or

C. global identity + tenant memberships

Do not guess.

Use repository evidence.

Then update the RFC consistently.

## Important

If the evidence is insufficient to safely choose between these models, DO NOT invent the answer.

Instead write:

`[OPEN ARCHITECTURE DECISION — USER IDENTITY SCOPE]`

and explain exactly why schema design should not proceed until this is resolved.

Do not silently choose a new identity architecture merely to close the RFC.

---

# 11. CORRECTION #9 — BATCH-AWARE RECONCILIATION

## Problem

The current reconciliation gate uses:

```text
SUM(OutletProduct.stock)
=
SUM(InventoryBalance.quantityOnHand)
```

But target inventory may be batch-dimensional.

## Required correction

Define reconciliation at the appropriate dimensions.

For legacy stock that has no batch dimension:

```text
Legacy:
Tenant + Outlet + Product

Target:
Aggregate InventoryBalance across all batches
for the equivalent Tenant + Location + InventoryItem dimension
```

For a target item that is batch-tracked:

```text
SUM(all relevant batch balances)
+
non-batch balance where applicable according to the migration rule
```

must reconcile to the legacy quantity represented by the migration.

The RFC must avoid comparing one legacy quantity directly against a single arbitrary batch row.

Also define that reconciliation must account for:

- Product → Variant mapping
- Variant → InventoryItem mapping
- unit conversion where applicable
- decimal precision
- excluded SERVICE_LABOR products

Do not invent a detailed reconciliation algorithm beyond the architecture level.

---

# 12. CROSS-SECTION CONSISTENCY CHECK

After applying the nine corrections, review the entire RFC for internal consistency.

At minimum verify:

## Product

Product semantics match ProductVariant semantics.

## ProductVariant

SKU/barcode/packaging/inventory relationship is consistent.

## Recipe

Recipe ownership is consistent with ProductVariant behavior.

## Services

SERVICE_LABOR does not require physical InventoryItem.

## InventoryBatch

Batch is metadata + stock dimension, not a balance source.

## InventoryBalance

Uniqueness correctly represents batch/non-batch dimensions.

## Negative Stock

Vertical defaults do not override Tenant → Location → Item policy hierarchy.

## Stock Deduction

Vertical defaults do not become hard-coded global behavior.

## User Identity

Uniqueness scope is evidence-based or explicitly left open.

## Reconciliation

Legacy-to-target parity handles variants, batches, units, and service products.

---

# 13. DO NOT CHANGE THESE APPROVED DECISIONS

The following remain unchanged:

### ADR-001

```text
Direct tenantId NOT NULL
+
Service-Layer Enforcement
+
Cross-Tenant Reference Validation
+
RLS Future Defense-in-Depth
```

### ADR-002

```text
Context-Driven Negative Stock
Tenant → Location → Item
```

### ADR-003

```text
Canonical Inventory UOM
≠
Physical UOM Conversion
≠
Purchasing UOM Conversion
≠
Commercial Packaging
```

### ADR-004

```text
InventoryBatch
=
Optional Stock Dimension from Initial Architecture
```

### ADR-005

```text
SERVICE_LABOR now
Full Services workflow later
Unified platform
```

Do not reopen these decisions.

---

# 14. RFC STATUS

Change the document version to:

`Revision 3`

Keep:

`Status: RFC REVISION — OWNER ADRs INCORPORATED`

Do NOT claim final implementation approval.

After correction, the RFC may state:

`READY FOR PROMPT 09 — TARGET DATABASE SCHEMA REVISION`

ONLY IF:

- no unresolved issue blocks schema design
- or any remaining open item is explicitly marked and does not prevent safe schema design

If User Identity Scope remains unresolved and materially affects the target schema, the RFC must say:

`NOT READY — USER IDENTITY SCOPE REQUIRES OWNER DECISION`

Do not hide this behind an "implementation detail" label.

---

# 15. REQUIRED FINAL REPORT

After updating the RFC, provide:

## A. Revision Summary

For each correction:

```text
C-01 ProductVariant ↔ Recipe
C-02 Product SKU ↔ Variant SKU
C-03 SERVICE_LABOR migration
C-04 Batch-aware balance uniqueness
C-05 InventoryBatch.initialQuantity
C-06 Negative stock vertical defaults
C-07 Configurable stock deduction trigger
C-08 User identity/email scope
C-09 Batch-aware reconciliation
```

For each:

- status
- what changed
- whether closed or open

## B. Cross-ADR Consistency

```text
ADR-001 → CONSISTENT / ISSUE
ADR-002 → CONSISTENT / ISSUE
ADR-003 → CONSISTENT / ISSUE
ADR-004 → CONSISTENT / ISSUE
ADR-005 → CONSISTENT / ISSUE
```

## C. Remaining Open Items

List only genuine unresolved items.

Do not create new owner decisions.

## D. Schema Readiness

Answer:

> Is RFC Revision 3 sufficiently precise for Prompt 09 — Target Database Schema Revision?

Return exactly one of:

```text
READY FOR PROMPT 09
```

or

```text
NOT READY — OWNER DECISION REQUIRED
```

with explanation.

---

# 16. STRICT SCOPE

This task ends after RFC Revision 3 and the report are produced.

DO NOT:

- edit Prisma schema
- create migration
- modify database
- modify backend
- modify frontend
- implement InventoryDomainService
- implement tenant isolation
- implement idempotency
- implement batch logic
- implement payment logic

The next stage is separately authorized.
