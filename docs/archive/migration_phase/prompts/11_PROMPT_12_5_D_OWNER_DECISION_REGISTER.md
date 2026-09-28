# Prompt 12.5-D: Owner Decision Register

**Document ID:** ARCH-2026-09-OWNER-DECISION-REGISTER-12-5-D  
**Execution Stage:** Prompt 12.5-D  
**Date:** 2026-09-20  
**Status:** OWNER DECISION REGISTER — DRAFT FOR FINAL OWNER REVIEW  
**Scope:** Consolidation of Owner decisions from ODR-01 through ODR-06  
**Database Mutation:** NONE  
**Migration Execution:** NONE  
**Prompt 13 Authorization:** NONE

---

## 1. Purpose

This document formally consolidates the Owner decisions made during the Prompt 12.5 review concerning the six open Owner Decision Requests (ODRs).

It is the canonical decision register for the decisions recorded here.

This document does not implement any schema, migration, application, or data changes. It records decisions only.

---

## 2. Important New Baseline: Current Data Is Prototype / Dummy Data

The Owner has explicitly confirmed that the current database data is still prototype/dummy example data and may be discarded or reset.

Therefore:

- Current rows are NOT treated as production business history.
- Existing dummy data does NOT create a requirement for historical preservation.
- Dummy records may be deleted/reset when an authorized implementation/reset phase is reached.
- Existing code and schema investment should still be preserved where it represents valid business capability or useful implementation.
- Incorrect prototype architecture may be refactored rather than preserved solely for backward compatibility.
- This does NOT authorize immediate deletion or database mutation.
- This does NOT authorize skipping migration safety, validation, or implementation gates.

> **Preserve valid product capability and architecture investment; do not preserve prototype data or prototype defects merely for compatibility.**

---

## 3. Owner Decision Summary

| ODR | Decision | Status |
|---|---|---|
| ODR-01 | Canonical PlatformRole = SUPER_ADMIN, SUPPORT, BILLING | APPROVED |
| ODR-02 | Merchant registration enters PENDING, then Superadmin review, then TRIAL | APPROVED |
| ODR-03 | Invoice lifecycle = DRAFT, UNPAID, PAID, VOID; Phase 1 payment review is manual | APPROVED |
| ODR-04 | WAREHOUSE remains an official role | APPROVED |
| ODR-05 | Dummy legacy stock movements are not historically migrated; inventory starts clean | APPROVED |
| ODR-06 | PaymentTxStatus = PENDING, CAPTURED, FAILED, REFUNDED, VOIDED; Phase 1 verification is manual | APPROVED |

---

## 4. ODR-01 — PlatformRole Vocabulary

### Decision

Use the canonical platform roles:

```text
SUPER_ADMIN
SUPPORT
BILLING
```

Legacy prototype terminology:

```text
SUPPORT_AGENT
FINANCE_ADMIN
```

is not preserved for compatibility.

### Owner Decision

```text
SUPPORT_AGENT  -> SUPPORT
FINANCE_ADMIN  -> BILLING
```

### Business Rationale

The platform should use concise canonical terminology consistently across the SaaS platform.

The current database contains only the prototype `SUPER_ADMIN` role; there are no current production records requiring preservation of the two legacy names.

### Architecture Consequence

The canonical terminology must be consistent across:

- PostgreSQL enum
- Prisma schema
- backend authorization
- middleware
- controllers/services
- frontend types
- frontend authorization
- seed/test fixtures
- documentation

No compatibility alias is required for prototype data.

### Migration Consequence

No historical data mapping is required for `SUPPORT_AGENT` or `FINANCE_ADMIN`.

Existing dummy data may be reset.

---

## 5. ODR-02 — Tenant Onboarding Lifecycle

### Decision

Merchant registration must use an approval workflow:

```text
MERCHANT REGISTER
       ↓
    PENDING
       ↓
SUPERADMIN REVIEW
       ↓
     TRIAL
       ↓
    ACTIVE
```

The Owner explicitly selected the PENDING workflow.

### Owner Decision

`TenantStatus.PENDING` remains part of the canonical target contract.

### Business Rationale

New merchants must pass a manual Superadmin review before entering the trial lifecycle.

### Architecture Consequence

Target tenant status vocabulary must include:

```text
TRIAL
ACTIVE
SUSPENDED
CANCELLED
PENDING
```

The application onboarding flow must remain consistent with this lifecycle.

### Migration Consequence

Current dummy data does not require historical PENDING migration.

The implementation must ensure new registration creates PENDING and the approval action transitions the tenant to TRIAL.

---

## 6. ODR-03 — InvoiceStatus and Phase 1 SaaS Payment Model

### Decision

Canonical invoice status:

```text
DRAFT
UNPAID
PAID
VOID
```

Legacy prototype states:

```text
CANCELLED
EXPIRED
```

are not retained as separate target invoice statuses.

For target semantic mapping:

```text
CANCELLED -> VOID
EXPIRED   -> VOID
```

These mappings apply to legacy/prototype vocabulary only. No current historical production rows require conversion.

### Phase 1 Payment Model

The initial SaaS billing/payment implementation will NOT integrate a payment gateway.

Supported payment methods for Phase 1:

- Manual bank transfer
- QRIS

Payment verification is manual.

Conceptual flow:

```text
Invoice
   ↓
UNPAID
   ↓
Merchant pays
   ↓
Manual review
   ↓
Approved
   ↓
PAID
```

If an invoice is intentionally cancelled:

```text
UNPAID
   ↓
VOID
```

with an appropriate cancellation reason/note recorded by the future billing implementation.

### Important Boundary

`InvoiceStatus` describes invoice lifecycle state.

Cancellation reason/note is separate information and is NOT defined as a new enum in this register.

### Architecture Consequence

The billing implementation must not assume automatic payment gateway confirmation in Phase 1.

`PAID` must result from an authorized manual verification workflow.

### Migration Consequence

Current invoice data is dummy/prototype data and may be reset.

No historical invoice preservation is required.

---

## 7. ODR-04 — WAREHOUSE Role

### Decision

`WAREHOUSE` remains an official canonical application role.

Target role vocabulary becomes:

```text
OWNER
ADMIN
SUPERVISOR
WAREHOUSE
CASHIER
KITCHEN
WAITER
```

### Business Rationale

Warehouse/inventory operations represent a distinct job function from cashier, kitchen, and waiter responsibilities.

The role should remain available even when an individual tenant does not use it.

### Architecture Consequence

The existing role-based authorization model remains valid for Phase 1.

`WAREHOUSE` must remain consistent across:

- database enum
- Prisma schema
- backend RBAC
- frontend role types
- user management
- inventory-related authorization
- dashboard authorization

This decision does NOT introduce a new permission-based authorization architecture.

### Migration Consequence

Current dummy users do not require WAREHOUSE migration.

Existing prototype UI/capability may be refactored and aligned to the canonical role.

---

## 8. ODR-05 — Legacy StockMovement Historical Treatment

### Decision

Current legacy `stock_movements` data is prototype/dummy data and is NOT required to be historically migrated into `InventoryLedger`.

The legacy dummy records may be discarded/reset during an authorized reset/initialization phase.

### Canonical Inventory Principle

The target architecture starts clean:

```text
InventoryItem
      ↓
StorageLocation
      ↓
InventoryBalance
      ↓
Opening Stock
      ↓
InventoryLedger
```

`InventoryLedger` becomes the canonical immutable append-only inventory movement history for the new system.

### Important Decision

Do NOT perform historical backfill of the current dummy `stock_movements` into `InventoryLedger`.

Therefore, current prototype mappings such as:

```text
ADJUSTMENT -> OPNAME_ADJUSTMENT
PURCHASE_IN -> PURCHASE
SALE_OUT -> SALE
DAMAGE_OUT -> WASTE
```

are NOT required as historical data migration operations for the current dummy prototype dataset.

They may remain useful as vocabulary/domain analysis, but they are not approved historical backfill rules for the current prototype dataset.

### Opening Balance

When the canonical inventory system is initialized, opening physical stock becomes the starting inventory baseline.

The exact opening-balance transaction/reference design remains an implementation design item and must follow the approved target schema and migration plan.

### Architecture Consequence

Do not weaken the target InventoryLedger contract to accommodate prototype StockMovement history.

Do not invent historical balanceBefore/balanceAfter, unit cost, location, batch, or semantic movement meaning merely to preserve dummy rows.

### Migration Consequence

The transition can use a clean inventory initialization rather than historical StockMovement reconstruction.

This does NOT authorize immediate deletion. Reset/discard must occur only during an explicitly authorized implementation/reset phase.

---

## 9. ODR-06 — Payment Transaction Status

### Decision

Canonical payment transaction status:

```text
PENDING
CAPTURED
FAILED
REFUNDED
VOIDED
```

Legacy prototype `SUCCESS` is not retained.

Because current payment data is dummy/prototype data, no historical `SUCCESS -> CAPTURED` migration is required.

### Phase 1 Payment Flow

There is no payment gateway integration in Phase 1.

Payment methods:

```text
BANK TRANSFER
QRIS
```

Verification:

```text
MANUAL
```

Conceptual transaction lifecycle:

```text
Payment submitted
       ↓
    PENDING
       ↓
Manual verification
       ↓
    CAPTURED
```

`CAPTURED` represents a payment transaction that has been accepted/confirmed by the authorized manual review process.

### Architecture Consequence

`PaymentTxStatus` remains separate from `OrderStatus` and `PaymentStatus`.

The architecture must not implement automatic gateway/webhook assumptions before gateway integration is introduced.

Future gateway integration can transition a transaction to the same canonical `CAPTURED` state through an automated mechanism.

### Migration Consequence

No historical payment transaction migration is required for current dummy data.

The legacy `SUCCESS` vocabulary can be removed/refactored from the canonical implementation.

---

## 10. Consolidated Architecture Consequences

### Platform Roles

```text
SUPER_ADMIN
SUPPORT
BILLING
```

### Tenant Lifecycle

```text
PENDING
   ↓
TRIAL
   ↓
ACTIVE

with:
SUSPENDED
CANCELLED
```

### Tenant Billing Invoice

```text
DRAFT
UNPAID
PAID
VOID
```

### Application Roles

```text
OWNER
ADMIN
SUPERVISOR
WAREHOUSE
CASHIER
KITCHEN
WAITER
```

### Payment Transaction

```text
PENDING
CAPTURED
FAILED
REFUNDED
VOIDED
```

### Inventory History

```text
InventoryLedger = canonical
```

Legacy prototype StockMovement history:

```text
not required for historical migration
```

---

## 11. Prototype Data Policy

The following principle is now an explicit Owner decision:

> Current database contents are prototype/dummy example data and may be discarded/reset.

### Preserve

- Valid product/business concepts
- Useful existing implementation
- Existing capabilities that remain part of the target
- Relevant UI/UX investment
- Reusable infrastructure and code where architecturally sound

### Do not preserve merely for compatibility

- Dummy rows
- Prototype enum vocabulary
- Incorrect legacy architecture
- Prototype-only workarounds
- Legacy data structures that conflict with approved target architecture

---

## 12. What This Register Does NOT Authorize

This register does NOT authorize:

- DDL execution
- DML execution
- database reset
- dummy data deletion
- Prisma migration execution
- Backfill
- Dual-write
- Cutover
- Contract phase
- production deployment
- staging migration
- automatic payment gateway integration
- Prompt 13

All such actions remain subject to their own implementation and validation gates.

---

## 13. Required Follow-up Work After Owner Approval

Once this register is formally approved, implementation preparation must reconcile the approved decisions with:

1. Target Database Schema Revision 4
2. Prisma schema
3. Existing application enums/types
4. Backend RBAC
5. Tenant onboarding flow
6. SaaS billing/payment workflow
7. Inventory architecture
8. Migration scripts and reset/initialization strategy
9. Validation/reconciliation artifacts

In particular, the following contracts require formal update/reconciliation:

- `TenantStatus` must include `PENDING`.
- `Role` must include `WAREHOUSE`.
- Phase 1 billing/payment workflow must reflect manual verification.
- Inventory historical backfill must not be designed around current dummy `stock_movements`.
- Canonical PlatformRole vocabulary must be `SUPER_ADMIN`, `SUPPORT`, `BILLING`.

These changes must be implemented only after the appropriate next-stage authorization.

---

## 14. Final Gate

```text
PROMPT 12.5-D
==============================

Purpose:
Owner Decision Consolidation

Database Mutation:
NONE

Migration Execution:
NONE

Implementation:
NONE

Prompt 13:
NOT AUTHORIZED

ODR-01:
APPROVED

ODR-02:
APPROVED

ODR-03:
APPROVED

ODR-04:
APPROVED

ODR-05:
APPROVED

ODR-06:
APPROVED

FINAL STATUS:
READY FOR OWNER FINAL REVIEW
```

---

## 15. Owner Confirmation

This document becomes the canonical Owner Decision Register only after explicit Owner confirmation.

Until then, all decisions remain recorded as decisions from the current review session and no implementation action is authorized.
