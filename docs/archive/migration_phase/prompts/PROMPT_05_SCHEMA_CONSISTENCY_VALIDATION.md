# PROMPT_05 --- Schema Consistency Validation

## Purpose

This task is a **read-only architecture and schema validation gate**
before any implementation work.

The goal is to validate whether the proposed target database
architecture and migration design are internally consistent, complete
enough to implement safely, and aligned with the existing POS system.

**Do not implement, migrate, modify, delete, or rewrite application code
or database schema during this task.**

------------------------------------------------------------------------

# 1. Role

Act as a **Principal Software Architect + Database Architect + POS
Domain Architect**.

You are reviewing an existing POS system that is approximately 70%
complete and is being evolved into a multi-tenant SaaS POS platform
supporting:

-   Retail
-   F&B
-   Services

The project must preserve the existing investment and active Retail
cashier functionality.

The preferred migration strategy is:

> Expand → Backfill → Dual-write → Validate → Cutover → Contract

A full rewrite is explicitly out of scope.

------------------------------------------------------------------------

# 2. Source-of-Truth Documents

Before performing any validation, read the following documents in this
order.

``` text
/docs/00_PROJECT_CONTEXT.md

/docs/architecture/01_EXISTING_SYSTEM_AUDIT.md
/docs/architecture/02_DEEP_DOMAIN_ANALYSIS.md
/docs/architecture/03_DATA_ARCHITECTURE_RFC.md
/docs/architecture/04_TARGET_DATABASE_SCHEMA.md
```

Also inspect the actual source code and current Prisma/database schema.

### Important

The documents describe the intended architecture, but the **actual
source code and current database/schema are authoritative for the
CURRENT STATE**.

Do not assume that a document is identical to the current
implementation.

Do not silently fix contradictions.

Report contradictions explicitly.

------------------------------------------------------------------------

# 3. Documentation Structure Check

Before schema validation, inspect the `/docs` directory.

The expected structure is:

``` text
/docs
├── 00_PROJECT_CONTEXT.md
│
├── architecture/
│   ├── 01_EXISTING_SYSTEM_AUDIT.md
│   ├── 02_DEEP_DOMAIN_ANALYSIS.md
│   ├── 03_DATA_ARCHITECTURE_RFC.md
│   └── 04_TARGET_DATABASE_SCHEMA.md
│
├── decisions/
│   ├── ADR-001-product-vs-inventory.md
│   ├── ADR-002-order-payment-separation.md
│   ├── ADR-003-inventory-ledger.md
│   └── ...
│
├── validation/
│   └── 05_SCHEMA_CONSISTENCY_VALIDATION.md
│
└── prompts/
    ├── PROMPT_01_AUDIT.md
    ├── PROMPT_02_DEEP_ANALYSIS.md
    ├── PROMPT_03_DATA_ARCHITECTURE.md
    ├── PROMPT_04_DATABASE_DESIGN.md
    └── PROMPT_05_SCHEMA_CONSISTENCY_VALIDATION.md
```

## Documentation rules

You MAY:

-   create missing directories;
-   identify incorrectly located architecture documents;
-   safely move/rename documents when necessary to match the structure;
-   report missing documents.

You MUST NOT:

-   overwrite an existing document without explicit authorization;
-   delete documents;
-   rewrite architecture decisions;
-   invent missing ADRs;
-   modify source code;
-   modify `schema.prisma`;
-   create database migrations;
-   execute destructive database operations.

If moving files is not safely possible, **report the required move
instead of improvising**.

At the end, report the actual documentation tree and every file that
was:

-   created
-   moved
-   renamed
-   already present
-   missing
-   left untouched

------------------------------------------------------------------------

# 4. Primary Objective

Validate the proposed target database design against:

1.  Existing implementation
2.  Existing Prisma schema
3.  Existing business flows
4.  Data Architecture RFC
5.  Target Database Schema & Migration Design

The validation must answer:

> "If we implement the target schema exactly as currently designed, what
> inconsistencies, ambiguities, missing constraints, migration risks,
> and domain problems could cause production issues?"

Do not solve the problems during this task.

First identify them.

------------------------------------------------------------------------

# 5. Validation Principles

Apply these principles throughout the review.

## 5.1 Preserve existing investment

The target architecture must allow incremental migration.

Flag any proposal that implicitly requires:

-   full rewrite;
-   simultaneous frontend/backend replacement;
-   destructive schema replacement;
-   breaking existing cashier flows without a compatibility layer.

## 5.2 Strict tenant isolation

Validate that tenant ownership is explicit and enforceable.

Check:

-   `tenantId`
-   nullable vs NOT NULL
-   composite unique constraints
-   foreign keys
-   child-table ownership
-   cross-tenant references
-   API tenant resolution
-   hardcoded/default tenant fallback
-   impersonation behavior
-   background jobs/workers
-   reporting queries

Pay special attention to the principle:

> Operational data must never accidentally cross tenant boundaries.

## 5.3 Product ≠ InventoryItem

Validate that the target model correctly separates:

``` text
Product
= commercial/sellable catalog concept

InventoryItem
= physical/logistical/costed stock concept
```

Test the model against:

### Retail

``` text
Aqua 600ml
Product → Variant → InventoryItem
```

### F&B

``` text
Es Kopi Susu
Product → Variant
                 ↓
               Recipe
              ↙  ↓  ↘
         Coffee Milk Sugar
```

### Services

``` text
Service
Product/Service Definition
        ↓
Optional consumable materials
```

Flag any relationship that creates ambiguity between sellable products,
inventory, ingredients, packaging, or consumables.

------------------------------------------------------------------------

# 6. Product & Variant Validation

Validate:

-   Product
-   ProductVariant
-   SKU
-   barcode
-   price
-   category
-   active/inactive state
-   tenant ownership
-   outlet-specific pricing
-   variant-to-inventory relationship

Specifically determine whether:

``` text
ProductVariant → InventoryItem
```

is intended to be:

-   1:1
-   N:1
-   1:N

Do not assume.

Compare the actual Prisma relations with the documented business intent.

Flag whether the model supports:

-   normal Retail products;
-   size/color variants;
-   packaging variants;
-   bundles;
-   F&B products;
-   Services;
-   shared inventory;
-   products with no inventory.

------------------------------------------------------------------------

# 7. Tenant-Scoped Relationship Validation

Perform a detailed relational audit.

For every operational child entity, determine:

1.  Does it have `tenantId`?
2.  If not, is tenant ownership safely inherited through a parent?
3.  Can the database enforce that relationship?
4.  Can an API accidentally connect records from different tenants?
5.  Does the unique constraint include tenant scope where required?

Pay particular attention to the following entities:

``` text
ProductModifierGroup
OrderItem
OrderItemModifier
RecipeItem
ModifierItem
ModifierRecipeEffect
Payment
Refund
RefundItem
UnitConversion
```

Do not merely say "tenant is inherited."

Explain whether the database actually prevents invalid cross-tenant
references.

------------------------------------------------------------------------

# 8. Order Lifecycle Validation

Validate separation between:

``` text
OrderStatus
PaymentStatus
InventoryStatus / inventory effects
```

The intended order lifecycle is approximately:

``` text
DRAFT
  ↓
CONFIRMED
  ↓
IN_PROGRESS
  ↓
READY
  ↓
COMPLETED
```

with:

``` text
CANCELLED
VOIDED
```

as appropriate terminal/exception states.

Payment lifecycle:

``` text
UNPAID
↓
PARTIALLY_PAID
↓
PAID
↓
REFUNDED / CHARGEBACK
```

Validate whether the schema actually supports:

-   unpaid orders;
-   partial payment;
-   deposits/DP;
-   open bills;
-   multiple tenders;
-   payment retries;
-   refunds;
-   voids;
-   cancellations;
-   F&B orders that remain open;
-   Service appointments/work orders that are not immediately paid.

Flag any default such as:

``` text
paymentStatus = PAID
```

if it undermines the target lifecycle.

------------------------------------------------------------------------

# 9. Inventory Architecture Validation

Validate the separation of:

``` text
InventoryItem
InventoryBalance
InventoryLedger
StorageLocation
```

## InventoryBalance

Check:

-   tenant scope
-   inventory item
-   location
-   quantity precision
-   reserved quantity
-   available quantity
-   uniqueness
-   concurrency

## InventoryLedger

The intended model is an:

> Immutable Inventory Movement Ledger

Do NOT describe it as "double-entry" unless there are actually paired
accounting entries.

Validate:

-   append-only behavior;
-   quantityDelta;
-   balanceBefore;
-   balanceAfter;
-   unitCost;
-   totalCost;
-   referenceType;
-   referenceId;
-   createdBy;
-   createdAt;
-   tenant scope.

## Concurrency

Determine whether stock mutation guarantees:

``` text
read current balance
→ calculate new balance
→ update balance
→ insert ledger
```

inside one atomic database transaction with appropriate
locking/serialization.

Flag designs where `balanceBefore` or `balanceAfter` can become
inconsistent under concurrent cashiers.

------------------------------------------------------------------------

# 10. UOM / Precision Validation

Validate:

-   UnitOfMeasure
-   UnitConversion
-   base UOM
-   purchase UOM
-   sales UOM
-   recipe UOM
-   inventory quantity precision
-   cost precision
-   price precision

The target design currently proposes decimal quantities.

Do not blindly accept one precision for every domain.

Determine whether the chosen precision is sufficient for:

-   Retail units
-   weight
-   volume
-   F&B recipes
-   Services consumables
-   packaging conversions

Also determine whether `UnitConversion` represents:

1.  global UOM conversion, or
2.  item-specific packaging conversion.

If these are different concepts, flag the ambiguity.

------------------------------------------------------------------------

# 11. Recipe / BOM Validation

Validate:

``` text
Recipe
RecipeItem
InventoryItem
ProductVariant
```

The intended F&B relationship is:

``` text
ProductVariant
      ↓
    Recipe
      ↓
 RecipeItem
      ↓
InventoryItem
```

Validate:

-   one active recipe;
-   recipe versioning;
-   effective dates;
-   ingredient quantity;
-   ingredient UOM;
-   wastage;
-   HPP;
-   historical cost;
-   recipe changes after previous sales.

Determine whether historical OrderItem cost remains stable after a
recipe changes.

------------------------------------------------------------------------

# 12. Modifier Validation

Validate the relational modifier design.

Expected concepts include:

``` text
ModifierGroup
Modifier
ProductModifierGroup
ModifierItem
ModifierRecipeEffect
```

Validate:

-   tenant ownership;
-   product assignment;
-   price effect;
-   inventory effect;
-   ADD;
-   SUBTRACT;
-   REPLACE;
-   ordering;
-   required/optional modifiers;
-   historical order snapshots.

For:

``` text
REPLACE
```

explicitly determine:

> What exactly is removed and what exactly is added?

Do not leave this as an implicit JSON behavior.

------------------------------------------------------------------------

# 13. Payment / Refund Validation

Validate separation between:

``` text
Order
Payment
PaymentTransaction
Refund
RefundItem
Settlement
```

Check whether the proposed design supports:

-   multiple payments per order;
-   multiple payment methods;
-   partial payment;
-   payment retry;
-   payment gateway reference;
-   webhook/idempotency;
-   refunds;
-   partial refunds;
-   refund item quantities;
-   refund-to-stock;
-   refund-to-damaged;
-   historical payment records.

Flag incomplete relationships, especially if `RefundItem` is discussed
in documentation but missing from the actual target schema.

------------------------------------------------------------------------

# 14. Idempotency Validation

Inspect checkout/payment operations for idempotency.

Determine whether the design protects against:

``` text
double click
network retry
frontend retry
gateway retry
webhook retry
cashier retry
```

Look for an idempotency key or equivalent unique business reference.

Do not accept "frontend prevents double click" as sufficient protection.

------------------------------------------------------------------------

# 15. Warehouse / Outlet / Storage Validation

The current system represents a warehouse using:

``` text
Outlet.isWarehouse
```

Validate the target abstraction:

``` text
StorageLocation
```

Determine whether it can safely represent:

-   retail outlet;
-   warehouse;
-   central warehouse;
-   stock room;
-   shelf/bin;
-   service inventory location.

Flag any ambiguity in the transition from Outlet-based inventory to
StorageLocation-based inventory.

------------------------------------------------------------------------

# 16. Historical Data / HPP Validation

Validate historical integrity.

The target design expects historical OrderItem cost to be snapshotted.

Check whether historical reporting remains correct when:

-   product price changes;
-   inventory cost changes;
-   recipe changes;
-   modifiers change;
-   stock is adjusted;
-   inventory is transferred;
-   refunds occur.

Specifically verify that historical gross profit cannot silently change
because current HPP is recalculated.

------------------------------------------------------------------------

# 17. Migration Validation

Do not only validate the final schema.

Validate the migration path.

Expected pattern:

``` text
EXPAND
↓
BACKFILL
↓
DUAL-WRITE
↓
VALIDATE
↓
CUTOVER
↓
CONTRACT
```

For each migration phase, identify:

-   source;
-   target;
-   transformation;
-   validation query/check;
-   rollback strategy;
-   reconciliation;
-   zero/low downtime concern;
-   data loss risk.

At minimum, reconciliation should cover:

``` text
row counts
tenant counts
outlet counts
product counts
inventory quantities
inventory values
order counts
payment totals
historical HPP
ledger totals
```

Flag any migration step that cannot be objectively validated.

------------------------------------------------------------------------

# 18. Dual-Write Validation

If dual-write is required, determine where it should live.

Preferred principle:

``` text
Domain/Application Service
        ↓
Legacy Model
        +
Target Model
```

Avoid scattered dual-write logic across many controllers.

Flag any design where dual-write can easily diverge between endpoints.

------------------------------------------------------------------------

# 19. API Compatibility Validation

Validate that the target schema can be introduced without unnecessarily
breaking existing frontend clients.

Check:

-   existing endpoints;
-   response shapes;
-   IDs;
-   product references;
-   order references;
-   payment references;
-   inventory endpoints;
-   cashier workflows.

Determine where an adapter/compatibility layer is needed.

------------------------------------------------------------------------

# 20. Required Test Scenarios

Validate the schema against these scenarios.

## Scenario A --- Retail

``` text
Create Aqua 600ml
Assign barcode
Set price
Receive stock
Sell 1 unit
Refund 1 unit
Check stock
Check historical HPP
```

## Scenario B --- F&B

``` text
Create Es Kopi Susu
Create recipe
Coffee = 18g
Milk = 100ml
Sugar = 10g
Sell 2 cups
Consume ingredients
Check remaining inventory
Change recipe
Sell again
Verify historical HPP
```

## Scenario C --- Service

``` text
Create haircut service
Create appointment
Assign staff
Create work order
Use shampoo as consumable
Complete service
Apply payment
Calculate staff commission
```

## Scenario D --- Multi-Tenant Isolation

``` text
Tenant A product
Tenant B product

Tenant A must never be able to:
- read Tenant B product
- modify Tenant B product
- sell Tenant B product
- reference Tenant B inventory
- reference Tenant B payment
```

## Scenario E --- Concurrent Stock Sale

``` text
Stock = 1

Cashier A sells 1
Cashier B sells 1 simultaneously

Expected:
only one successful stock deduction
```

## Scenario F --- Payment Retry

``` text
Same checkout request submitted twice

Expected:
one business transaction
one effective payment
no duplicated stock deduction
```

## Scenario G --- Partial Refund

``` text
Order contains:
Aqua x2
Coffee x1

Refund:
Aqua x1

Expected:
only one Aqua returned/restocked
Coffee unchanged
historical order remains auditable
```

------------------------------------------------------------------------

# 21. Severity Classification

Every finding must be classified:

### CRITICAL

Can cause:

-   cross-tenant data leakage;
-   financial corruption;
-   duplicate payment;
-   duplicate stock deduction;
-   irreversible data loss;
-   broken migration of production data.

### HIGH

Can cause:

-   major domain inconsistency;
-   incorrect inventory;
-   incorrect HPP;
-   broken F&B/Services flow;
-   production failures during migration.

### MEDIUM

Important architectural weakness that should be fixed before the related
module is implemented.

### LOW

Minor improvement, naming issue, documentation issue, or future
optimization.

------------------------------------------------------------------------

# 22. Required Output

Produce a report:

``` text
SCHEMA CONSISTENCY VALIDATION REPORT
```

with exactly these sections:

## 1. Executive Summary

State:

-   overall validation status;
-   number of Critical findings;
-   number of High findings;
-   number of Medium findings;
-   number of Low findings.

Do NOT give a subjective "score."

Use one of:

``` text
PASS
PASS WITH REQUIRED CHANGES
BLOCKED
```

Only use `PASS` if no Critical/High issue remains.

------------------------------------------------------------------------

## 2. Documentation Structure

Report:

-   expected structure;
-   actual structure;
-   missing files;
-   misplaced files;
-   files moved/created;
-   files intentionally untouched.

------------------------------------------------------------------------

## 3. Current vs Target Schema Matrix

Use:

  Domain   Current   Target   Status   Finding
  -------- --------- -------- -------- ---------

------------------------------------------------------------------------

## 4. Critical Findings

For every Critical finding:

``` text
ID:
Area:
Current State:
Target State:
Problem:
Production Impact:
Evidence:
Required Decision:
```

------------------------------------------------------------------------

## 5. High Findings

Same structure.

------------------------------------------------------------------------

## 6. Medium Findings

Same structure.

------------------------------------------------------------------------

## 7. Low Findings

Same structure.

------------------------------------------------------------------------

## 8. Tenant Isolation Audit

Provide a table:

  ---------------------------------------------------------------------------
  Entity      tenantId    Constraint   FK Safety   Cross-Tenant   Status
                                                   Risk           
  ----------- ----------- ------------ ----------- -------------- -----------

  ---------------------------------------------------------------------------

------------------------------------------------------------------------

## 9. Inventory Integrity Audit

Cover:

-   balance;
-   ledger;
-   concurrency;
-   cost;
-   UOM;
-   transfer;
-   refund;
-   waste;
-   adjustment.

------------------------------------------------------------------------

## 10. Order / Payment Audit

Cover:

-   OrderStatus;
-   PaymentStatus;
-   PaymentTransaction;
-   Refund;
-   Idempotency;
-   inventory trigger.

------------------------------------------------------------------------

## 11. Migration Readiness Audit

Cover:

-   expand;
-   backfill;
-   dual-write;
-   reconciliation;
-   cutover;
-   rollback;
-   contract.

------------------------------------------------------------------------

## 12. Required Architecture Decisions

List only decisions that must be explicitly approved before
implementation.

Do not decide on behalf of the project owner.

Example:

``` text
ADR-XXX:
Question:
Options:
Impact of each option:
Current recommendation from existing docs:
Decision required from project owner:
```

If the existing documents already contain a decision, report it as an
existing decision rather than reopening it unnecessarily.

------------------------------------------------------------------------

## 13. Implementation Gate

End with:

``` text
IMPLEMENTATION GATE

Status: PASS / PASS WITH REQUIRED CHANGES / BLOCKED

Implementation may begin only when:
1. ...
2. ...
3. ...
```

Do not implement anything as part of this task.

------------------------------------------------------------------------

# 23. Important Restrictions

During this task:

### DO NOT

-   rewrite Prisma schema;
-   create migrations;
-   alter database;
-   alter production data;
-   refactor backend;
-   refactor frontend;
-   change API contracts;
-   "fix" findings automatically;
-   invent missing business rules;
-   silently resolve architectural contradictions.

### DO

-   inspect;
-   compare;
-   validate;
-   trace relationships;
-   identify risks;
-   identify contradictions;
-   propose decision options;
-   provide evidence;
-   stop at the implementation gate.

------------------------------------------------------------------------

# 24. Final Instruction

This is a **validation gate, not an implementation task**.

The quality of the output is more important than speed.

If the architecture is inconsistent, say so clearly.

If the documents contradict the actual code, identify the contradiction.

If a requirement is ambiguous, identify the ambiguity.

If a database constraint is insufficient to guarantee the stated
business rule, explicitly explain why.

Do not assume that application-level validation is sufficient when a
database constraint is required for data integrity.

Do not assume that a migration is safe merely because it can technically
execute.

The final output must allow the project owner to make explicit
architecture decisions before implementation begins.
