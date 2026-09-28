# PROMPT_06 — Architecture Decision Gate

## Purpose

This is an **Architecture Decision Gate**, not an implementation task.

The purpose is to convert the unresolved architectural findings from:

```text
/docs/validation/05_SCHEMA_CONSISTENCY_VALIDATION.md
```

into explicit, reviewable Architecture Decision Records (ADRs).

The project owner must be able to review each decision independently before the target database schema is revised.

---

# 1. Required Source Documents

Read these documents first:

```text
/docs/00_PROJECT_CONTEXT.md

/docs/architecture/01_EXISTING_SYSTEM_AUDIT.md
/docs/architecture/02_DEEP_DOMAIN_ANALYSIS.md
/docs/architecture/03_DATA_ARCHITECTURE_RFC.md
/docs/architecture/04_TARGET_DATABASE_SCHEMA.md

/docs/validation/05_SCHEMA_CONSISTENCY_VALIDATION.md
```

Also inspect the current source code and Prisma schema where necessary to verify current-state assumptions.

The validation report is an input to this task, not an automatic source of truth for architectural decisions.

Do not silently accept recommendations from the validation report.

---

# 2. Documentation Structure

Verify that:

```text
/docs
├── architecture/
├── decisions/
├── validation/
└── prompts/
```

exist.

Do not delete or overwrite existing ADRs.

If an ADR already exists for one of the topics below, inspect it and update only if explicitly appropriate.

---

# 3. Decisions Required

Create or update five ADRs.

## ADR-001 — Tenant Boundary Enforcement

Question:

How should tenant ownership be enforced for operational child entities and cross-tenant foreign-key relationships?

Evaluate at minimum:

### Option A

Parent inheritance only.

### Option B

Direct `tenantId` on operational child tables plus tenant-aware constraints.

### Option C

Direct `tenantId` plus composite foreign keys where required.

### Option D

Combination of B/C plus PostgreSQL Row-Level Security as defense-in-depth.

Evaluate:

* security;
* database integrity;
* Prisma compatibility;
* query complexity;
* reporting;
* migration complexity;
* performance;
* background jobs;
* impersonation;
* operational safety.

Do not claim that one option "completely eliminates" risk unless the actual mechanism proves that claim.

The ADR must explicitly distinguish:

```text
Application-level tenant validation
Database-level tenant integrity
Database-level RLS
```

---

# 4. ADR-002 — Negative Stock Policy

Determine the actual business policy for inventory below zero.

Evaluate:

### Option A

Never allow negative stock.

### Option B

Allow negative stock with audit/warning.

### Option C

Allow negative stock based on tenant configuration.

### Option D

Allow negative stock based on vertical/module/item/outlet policy.

Do not automatically accept the validation report's recommendation.

Analyze separately:

```text
Retail
F&B
Services
Warehouse
```

Explain operational consequences.

The final ADR must contain:

```text
Decision:
Scope:
Allowed:
Not Allowed:
Override:
Audit Requirement:
Impact on InventoryBalance:
Impact on Checkout:
```

If owner input is required, clearly mark:

```text
OWNER DECISION REQUIRED
```

Do not make the owner's business decision.

---

# 5. ADR-003 — UOM vs Packaging

Resolve the architectural distinction between:

```text
UnitOfMeasure
UnitConversion
ProductVariant
InventoryItem
Packaging
```

Use real examples:

```text
Aqua 600ml Satuan
Aqua 600ml Dus

1 Dus = 24 Botol
```

and:

```text
Coffee
1 kg = 1000 g
```

Determine whether the system needs separate concepts for:

```text
Global UOM conversion
```

versus:

```text
Item/Product-specific packaging conversion
```

Evaluate:

* Retail;
* wholesale;
* F&B recipes;
* purchasing;
* sales;
* inventory;
* pricing;
* variants;
* stock deduction.

Do not automatically accept:

```text
ProductVariant.inventoryQuantityMultiplier
```

if a more coherent packaging/UOM model is required.

The ADR must explicitly define the canonical inventory quantity and how sales/purchase quantities are converted to it.

---

# 6. ADR-004 — Inventory Batch / Lot

Resolve how batch/lot and expiry should be modeled.

Evaluate:

### Option A

Store batch information directly on InventoryLedger.

### Option B

Create InventoryBatch / Lot entity.

### Option C

Create a more general stock-dimension model.

Determine:

```text
Batch identity
Expiry
Quantity
Location
Cost
Receipt
Transfer
Sale
Return
Adjustment
FEFO
```

Do not assume that batch/expiry belongs directly on the ledger.

Explain the relationship between:

```text
InventoryItem
InventoryBatch
InventoryBalance
InventoryLedger
```

Also determine whether batch/lot is:

```text
Required
Optional
Vertical-specific
Tenant-configurable
```

---

# 7. ADR-005 — Services Module Boundary

Determine the appropriate architectural boundary for Services.

The target platform supports:

```text
Retail
F&B
Services
```

but Services does not necessarily need to be implemented in the current phase.

Define what belongs to:

```text
Core
Commerce
Inventory
Services Vertical
```

Evaluate:

```text
ServiceDefinition
Appointment
WorkOrder
ServiceMaterialUsage
StaffAssignment
StaffCommission
Order
OrderItem
Payment
Inventory
```

The goal is to create a stable architecture contract without prematurely implementing the entire Services module.

Clearly distinguish:

```text
Architecture contract
```

from:

```text
Implementation scope
```

---

# 8. ADR Format

Every ADR must use this structure:

```markdown
# ADR-XXX — Title

## Status

PROPOSED

## Context

## Problem

## Decision Drivers

## Options Considered

### Option A

Description:
Advantages:
Disadvantages:
Impact:

### Option B

Description:
Advantages:
Disadvantages:
Impact:

## Decision

## Consequences

### Positive

### Negative

### Risks

## Impact on Existing POS

## Impact on Target Architecture

## Impact on Database Schema

## Impact on Migration

## Open Questions

## Owner Decision Required
```

Do not mark an ADR as APPROVED.

All newly created ADRs must initially have:

```text
Status: PROPOSED
```

The project owner will approve them separately.

---

# 9. Architecture Consistency Check

After creating the five ADRs, check whether they conflict with:

```text
03_DATA_ARCHITECTURE_RFC.md
04_TARGET_DATABASE_SCHEMA.md
```

Create a matrix:

| Decision | RFC Conflict | Target Schema Conflict | Required Revision |
| -------- | ------------ | ---------------------- | ----------------- |

Do not modify the RFC or target schema during this task.

---

# 10. Required Decision Report

Create:

```text
/docs/validation/06_ARCHITECTURE_DECISION_GATE_REPORT.md
```

The report must contain:

## 1. Executive Summary

## 2. ADR Inventory

| ADR | Topic | Status | Owner Decision Required |
| --- | ----- | ------ | ----------------------- |

## 3. Conflicts With Existing Architecture

## 4. Conflicts With Target Schema

## 5. Decisions Requiring Owner Input

## 6. Recommended Next Step

The report must NOT contain an implementation plan that modifies code.

---

# 11. Restrictions

During this task:

DO NOT:

* modify application source code;
* modify Prisma schema;
* create migrations;
* modify production database;
* modify production data;
* implement InventoryDomainService;
* implement IdempotencyKey;
* implement RefundItem;
* modify API behavior;
* automatically approve ADRs;
* silently change the architecture documents.

DO:

* inspect;
* analyze;
* compare;
* document;
* identify trade-offs;
* create proposed ADRs;
* identify conflicts;
* clearly mark owner decisions.

---

# 12. Final Gate

End the report with:

```text
ARCHITECTURE DECISION GATE

Status: OPEN

Implementation remains BLOCKED until:
1. ADR-001 is approved
2. ADR-002 is approved
3. ADR-003 is approved
4. ADR-004 is approved
5. ADR-005 is approved
6. Any resulting architecture/schema conflicts are resolved
```

Do not proceed to implementation.

The next implementation phase will only begin after the project owner reviews and approves the required ADRs.
