# Prompt 12.6: Target Schema Revision 4 Reconciliation Report

**Document ID:** ARCH-2026-09-TARGET-SCHEMA-RECON-12-6  
**Target Specification:** Target Database Schema Revision 4 (`ARCH-2026-09-DB-SCHEMA-04`) in `/docs/architecture/04_TARGET_DATABASE_SCHEMA.md`  
**Execution Stage:** Prompt 12.6 — Contract Reconciliation After Owner Confirmation  
**Date:** 2026-09-20  
**Status:** RECONCILED & ARCHITECTURE-LOCKED  

---

## 1. Executive Summary

Following the Project Owner's final confirmation of the Owner Decision Register (`ODR-01` through `ODR-06`), the canonical Target Database Schema Revision 4 specification has been formally updated and reconciled.

Prior to Prompt 12.6, two critical discrepancies existed in Target Revision 4:
1. `TenantStatus` omitted `PENDING`, which conflicted with the required merchant onboarding approval flow (`REGISTER -> PENDING -> SUPERADMIN REVIEW -> TRIAL -> ACTIVE`).
2. `Role` omitted `WAREHOUSE`, which conflicted with active frontend UI and staff role management ("Staf Gudang (Stok & Mutasi)").

Both omissions have been corrected directly in `docs/architecture/04_TARGET_DATABASE_SCHEMA.md`. All other canonical target contracts have been strictly preserved.

---

## 2. Exhaustive Enum Contract Reconciliations

### 2.1 `TenantStatus` (ODR-02)
- **Previous Specification (Rev 4 line 859):** `TRIAL, ACTIVE, SUSPENDED, CANCELLED` (4 labels)
- **Reconciled Canonical Target Contract:**
  ```prisma
  enum TenantStatus {
    TRIAL
    ACTIVE
    SUSPENDED
    CANCELLED
    PENDING
  }
  ```
- **Rationale & Architectural Grounding:** Conforms to Owner Decision ODR-02. New merchant self-service registrations enter `PENDING`. Upon Superadmin manual review, the tenant transitions to `TRIAL`. Active paid tenants hold `ACTIVE`. Delinquent or policy violations use `SUSPENDED` or `CANCELLED`.
- **Compatibility Alignment:** The reconciled Target Revision 4 contract is now **100% EXACTLY IDENTICAL** to the live PostgreSQL catalog in `pos_db` (`['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'PENDING']`).

### 2.2 `Role` (ODR-04)
- **Previous Specification (Rev 4 line 891):** `OWNER, ADMIN, SUPERVISOR, CASHIER, KITCHEN, WAITER` (6 labels)
- **Reconciled Canonical Target Contract:**
  ```prisma
  enum Role {
    OWNER
    ADMIN
    SUPERVISOR
    WAREHOUSE
    CASHIER
    KITCHEN
    WAITER
  }
  ```
- **Rationale & Architectural Grounding:** Conforms to Owner Decision ODR-04. Warehouse operations (receiving, stock opname, damage write-off, inter-outlet transfer) represent a distinct job function from cashiers, kitchen staff, and waiters. Retaining `WAREHOUSE` preserves existing frontend role selectors (`DashboardPage.tsx`, `UsersView.tsx`, `types/auth.ts`) without requiring a complex permission refactor in Phase 1.

---

## 3. Preservation of Invariant Target Contracts

The remaining 18 target enums in Target Revision 4 were audited and confirmed unchanged:

| Target Enum Name | Canonical Target Ordered Labels | Status / Notes |
| :--- | :--- | :--- |
| `PlatformRole` | `SUPER_ADMIN, SUPPORT, BILLING` (3) | ODR-01 confirmed. Concise platform role nomenclature. |
| `BusinessVertical` | `RETAIL, FNB, SERVICES, HYBRID` (4) | Multi-vertical SaaS tenant classification. |
| `BillingCycle` | `MONTHLY, ANNUALLY` (2) | SaaS tenant subscription billing intervals. |
| `InvoiceStatus` | `DRAFT, UNPAID, PAID, VOID` (4) | ODR-03 confirmed. Phase 1 manual review flow. Stale `SubscriptionInvoiceStatus` terminology fully rejected. |
| `PaymentRecordStatus`| `PENDING, SUCCESS, FAILED` (3) | Internal operational payment status. |
| `ShiftStatus` | `OPEN, CLOSED` (2) | POS terminal register cash drawer shifts. |
| `ProductType` | `STANDARD, COMPOSITE, SERVICE_LABOR` (3) | Multi-vertical catalog item typing. |
| `SelectionType` | `SINGLE, MULTIPLE` (2) | Modifier group selection constraints. |
| `UomType` | `MASS, VOLUME, COUNT, LENGTH, TIME` (5) | Unit of measurement physical dimensions. |
| `StorageLocationType`| `STOREFRONT, WAREHOUSE, KITCHEN, BAR, TRANSIT` (5) | Physical storage locations within outlets. |
| `StockMovementType` | `SALE, PURCHASE, TRANSFER_IN, TRANSFER_OUT, OPNAME_ADJUSTMENT, RETURN, WASTE, VOID, PRODUCTION_CONSUMPTION, PRODUCTION_OUTPUT` (10) | ODR-05 confirmed. Canonical inventory event types. |
| `InventoryRefType` | `ORDER, PURCHASE_ORDER, TRANSFER, STOCK_OPNAME, REFUND, PRODUCTION, MANUAL` (7) | Business transaction reference linkage. |
| `ActorType` | `USER, SYSTEM` (2) | Action provenance discriminator. |
| `OrderStatus` | `DRAFT, CONFIRMED, IN_PROGRESS, READY, COMPLETED, CANCELLED, VOIDED` (7) | Distinct order fulfillment lifecycle. |
| `PaymentStatus` | `UNPAID, PARTIALLY_PAID, PAID, PARTIALLY_REFUNDED, REFUNDED` (5) | Distinct customer payment settlement state. |
| `PaymentMethod` | `CASH, QRIS, CREDIT_CARD, DEBIT_CARD, BANK_TRANSFER, EWALLET, VOUCHER` (7) | Tender types. |
| `PaymentTxStatus` | `PENDING, CAPTURED, FAILED, REFUNDED, VOIDED` (5) | ODR-06 confirmed. Transaction ledger state. |
| `RefundReason` | `CUSTOMER_RETURN, DAMAGED_GOODS, WRONG_ITEM, DISSATISFIED_SERVICE, BILLING_ERROR` (5) | Audit trail return justification. |

---

## 4. Domain & Model Integrity Verification

1. **Inventory Domain (ODR-05):**
   - Target model `InventoryLedger` (line 551) is verified as an **immutable append-only stock movement ledger** (NOT an accounting double-entry ledger).
   - In accordance with ODR-05, no historical backfill of the 2 dummy prototype `stock_movements` will be performed. The inventory system will initialize cleanly from authorized opening stock events (`OPNAME_ADJUSTMENT`).
2. **Payment Architecture (ODR-03 & ODR-06):**
   - Phase 1 payment model is verified as manual bank transfer / QRIS with manual human review (no payment gateway SDK or automated webhooks in Phase 1).
   - Clean decoupling is preserved: `OrderStatus` != `PaymentStatus` != `PaymentTxStatus`.
3. **Model Invariants:**
   - Model B User Identity remains intact.
   - `InventoryLedger.isNegativeBalance` is present; no `InventoryBalance.isNegativeBalance` exists.
   - No unsupported Phase 2 models (`UserOutletAssignment`, etc.) are introduced.

---

## 5. Verification Verdict

Target Database Schema Revision 4 (`ARCH-2026-09-DB-SCHEMA-04`) is now **100% reconciled and internally consistent** with all confirmed Project Owner decisions.
