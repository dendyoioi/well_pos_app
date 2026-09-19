# PROMPT 11 — DATABASE MIGRATION READINESS & EXISTING SYSTEM COMPATIBILITY REVIEW

## Role

You are **Antigravity**, the primary implementation and architecture agent for Well POS.

Prompt 10 has PASSED:
- Target Database Schema Revision 4 is architecture-locked.
- Prisma schema implementation is complete.
- Prisma structural validation has passed.

Your task now is **NOT to migrate the database**.

Your task is to determine whether the implemented Prisma schema can safely move toward migration against the EXISTING Well POS database, and to identify every compatibility/migration issue before any migration is generated or applied.

---

# 1. SOURCE OF TRUTH

Use this hierarchy:

1. Existing source code + existing database schema/migrations
2. Approved Architecture Decisions ADR-001 through ADR-005
3. Approved Data Architecture RFC Revision 4
4. Approved Target Database Schema Revision 4
5. Prompt 11

Read the relevant project files and repository before analysis.

Do not redesign the architecture.

---

# 2. OBJECTIVE

Perform a **read-only migration readiness and compatibility assessment** between:

```text
CURRENT PRODUCTION/EXISTING SYSTEM
              ↓
      Prisma Schema Revision 4
```

Determine:

1. What existing tables/columns are being replaced, extended, renamed, or removed.
2. Which changes are additive and which are destructive.
3. Existing data compatibility risks.
4. Existing foreign-key/data-integrity risks.
5. Existing tenant-isolation risks.
6. Existing inventory data mapping risks.
7. Existing Product → ProductVariant → InventoryItem mapping risks.
8. Existing Order/OrderItem → new lifecycle mapping risks.
9. Existing payment data mapping risks.
10. Existing user/authentication mapping risks.
11. Existing outlet/shift/customer/category mappings.
12. Existing stock quantity and HPP/cost mapping.
13. Existing data that cannot be mapped automatically.
14. Required backfill transformations.
15. Required migration sequencing.
16. Required reconciliation checks.
17. Required rollback/abort conditions.
18. Whether a migration can be generated safely yet.

---

# 3. STRICT READ-ONLY RULE

This prompt is an ANALYSIS GATE.

DO NOT:

- create migrations
- modify Prisma schema
- modify application code
- modify controllers
- modify routes
- modify frontend
- modify production/shared database
- run `prisma migrate dev`
- run `prisma migrate deploy`
- run `prisma db push`
- run destructive database commands
- perform backfill
- perform dual-write
- alter existing data
- continue to Prompt 12

Safe read-only commands are allowed, including:
- inspect files
- inspect Prisma schema
- inspect existing migration files
- inspect SQL
- inspect package/config
- `prisma validate`
- schema/database metadata inspection that does not mutate data

If a command could modify schema/data, DO NOT run it.

---

# 4. REQUIRED ANALYSIS

## A. EXISTING DATABASE INVENTORY

Identify the actual existing:

- tables
- columns
- primary keys
- foreign keys
- unique constraints
- indexes
- enums
- nullable/non-nullable fields
- default values
- existing migration history

Do not assume the audit document is perfectly identical to the current repository.

Report discrepancies.

---

## B. TABLE MAPPING

Create a complete mapping:

| Existing | Target | Action | Risk |
|---|---|---|---|
| products | products | ALTER/EXTEND | ... |
| ... | ... | ... | ... |

Include:

- retained tables
- renamed tables
- split tables
- merged concepts
- new tables
- removed/deprecated tables

---

## C. DATA MAPPING

For every existing important entity determine:

### Tenant
Existing tenant identity → Target Tenant

### User
Existing user → Target User Model B

Explicitly analyze:

```text
existing login identity
existing email
existing password
existing PIN
existing role
existing outlet/branch
```

Determine whether automatic mapping is safe.

### Product

Determine how existing Product rows become:

```text
Product
   +
ProductVariant
   +
optional InventoryItem
```

Pay special attention to:

- SKU
- barcode
- price
- cost/HPP
- stock
- category
- product type

### Inventory

Map:

```text
existing stock
    ↓
InventoryItem
    ↓
InventoryBalance
    ↓
InventoryLedger
```

Determine whether historical stock movements exist and whether they can become ledger entries.

### Order

Map existing:

```text
Order
OrderItem
Payment
```

to:

```text
Order
OrderItem
PaymentTransaction
Refund
RefundItem
```

Identify information loss.

### Outlet / Shift / Customer / Category

Perform equivalent mapping analysis.

---

# 5. CRITICAL LEGACY RISKS

Explicitly investigate:

### Tenant fallback

Check whether existing code/database still contains any default/static tenant behavior such as:

```text
default tenant
fallback tenant
toko-maju-jaya
```

Report every occurrence.

Do NOT fix it in this prompt.

### Nullable tenantId

Identify legacy tenant-owned records that may lack tenantId.

### Cross-tenant references

Identify possible records where:

```text
child.tenantId != parent.tenantId
```

could exist.

### Global uniqueness

Check existing identifiers such as:

- SKU
- barcode
- invoice number
- user email
- customer phone
- codes

Determine whether current uniqueness conflicts with target tenant-scoped uniqueness.

### Inventory

Check whether current stock is:

- integer
- decimal
- per outlet
- per warehouse
- batch-aware
- ledger-backed

Determine conversion risk.

---

# 6. MIGRATION CLASSIFICATION

Classify every change as:

- SAFE ADDITIVE
- DATA TRANSFORMATION REQUIRED
- MANUAL MAPPING REQUIRED
- HIGH RISK
- BLOCKER

Do not hide uncertainty.

---

# 7. BACKFILL DESIGN

Design the required backfill conceptually only.

For example:

```text
Existing Product
      ↓
Product
      ↓
ProductVariant
      ↓
InventoryItem
```

For every transformation specify:

- source
- target
- transformation
- deterministic rule
- possible ambiguity
- validation required

Do NOT execute the backfill.

---

# 8. MIGRATION ORDER

Propose a safe staged migration sequence.

Use the approved architecture lifecycle:

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
CONTRACT
```

For each stage identify:

- schema changes
- data changes
- application changes
- validation gate
- rollback/abort condition

Do not implement any stage.

---

# 9. RECONCILIATION PLAN

Define exact checks for:

### Tenant
- tenant counts
- tenant-scoped records
- cross-tenant references

### Product
- product count
- variant count
- SKU/barcode uniqueness

### Inventory
- stock totals
- stock per outlet/location
- batch quantities where applicable
- ledger balance vs balance projection

### Sales
- order count
- order total
- order item quantity
- payment total
- refund total

### Users
- user count
- userCode uniqueness
- outlet assignment

### Financial
- payment totals
- refund totals
- outstanding balances

Include acceptable tolerance where relevant.

---

# 10. ROLLBACK / ABORT CONDITIONS

Define hard stop conditions.

Examples:

```text
cross-tenant references > 0
unmapped active products > 0
SKU collisions > 0
inventory reconciliation mismatch
payment reconciliation mismatch
duplicate tenant-scoped identities
```

Do not invent numeric tolerances where exact equality is required.

---

# 11. MIGRATION READINESS GATE

Conclude with exactly one:

```text
GO
GO WITH CONDITIONS
NO-GO
```

Interpretation:

- GO = migration can be generated next.
- GO WITH CONDITIONS = specific prerequisites must be completed first.
- NO-GO = architecture/data issue blocks migration planning.

Do not generate or apply a migration regardless of the result.

---

# 12. REQUIRED REPORT

Produce:

`/docs/validation/09_MIGRATION_READINESS_REPORT.md`

The report must contain:

1. Executive Summary
2. Scope & Read-Only Guarantee
3. Existing Schema Inventory
4. Existing → Target Table Mapping
5. Existing → Target Data Mapping
6. Tenant Isolation Assessment
7. Product/Variant/Inventory Assessment
8. Order/Payment/Refund Assessment
9. User/Auth Assessment
10. Risk Classification
11. Backfill Design
12. Migration Sequence
13. Reconciliation Plan
14. Rollback/Abort Conditions
15. Migration Readiness Gate
16. Open Questions
17. Recommended Next Prompt

Do not create any migration file.

---

# 13. FINAL STOP CONDITION

After generating the report:

STOP.

Do not continue to Prompt 12.

Do not modify application code.

Do not modify Prisma schema.

Do not modify database.

The only intended artifact is:

```text
/docs/validation/09_MIGRATION_READINESS_REPORT.md
```

plus the console/report output.
