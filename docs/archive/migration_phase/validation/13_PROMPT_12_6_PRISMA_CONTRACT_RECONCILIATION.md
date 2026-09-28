# Prompt 12.6: Prisma Target Contract Reconciliation Report

**Document ID:** VAL-2026-09-PRISMA-RECON-12-6  
**File Under Review:** `/server/prisma/schema.prisma`  
**Target Specification:** Reconciled Target Database Schema Revision 4 (`ARCH-2026-09-DB-SCHEMA-04`)  
**Execution Stage:** Prompt 12.6 — Contract Reconciliation After Owner Confirmation  
**Date:** 2026-09-20  
**Status:** FULLY ALIGNED & VERIFIED  

---

## 1. Executive Summary

This report documents the verification and reconciliation of the Prisma schema (`server/prisma/schema.prisma`) against the confirmed Owner decisions and the canonical Target Database Schema Revision 4.

The Prisma schema serves as the primary application-level contract for the PostgreSQL database. Following the reconciliation in Prompt 12.6:
- `TenantStatus` includes `PENDING` (line 761).
- `Role` includes `WAREHOUSE` (line 792).
- All 20 enums in `schema.prisma` match the canonical Target Revision 4 specification with 100% exactitude in names, labels, and sort orders.
- Model B User identity, entity relationships, constraints, and audit invariants are fully intact.

---

## 2. Exhaustive Enum Verification in `schema.prisma`

| # | Enum Name | Lines in `schema.prisma` | Defined Labels in `schema.prisma` | Match with Target Revision 4 |
| :-: | :--- | :---: | :--- | :---: |
| 1 | `PlatformRole` | 749–753 | `SUPER_ADMIN`, `SUPPORT`, `BILLING` | **100% EXACT** |
| 2 | `TenantStatus` | 755–761 | `TRIAL`, `ACTIVE`, `SUSPENDED`, `CANCELLED`, `PENDING` | **100% EXACT** |
| 3 | `BusinessVertical` | 763–768 | `RETAIL`, `FNB`, `SERVICES`, `HYBRID` | **100% EXACT** |
| 4 | `BillingCycle` | 770–773 | `MONTHLY`, `ANNUALLY` | **100% EXACT** |
| 5 | `InvoiceStatus` | 775–780 | `DRAFT`, `UNPAID`, `PAID`, `VOID` | **100% EXACT** |
| 6 | `PaymentRecordStatus` | 782–786 | `PENDING`, `SUCCESS`, `FAILED` | **100% EXACT** |
| 7 | `Role` | 788–796 | `OWNER`, `ADMIN`, `SUPERVISOR`, `WAREHOUSE`, `CASHIER`, `KITCHEN`, `WAITER` | **100% EXACT** |
| 8 | `ShiftStatus` | 798–801 | `OPEN`, `CLOSED` | **100% EXACT** |
| 9 | `ProductType` | 803–807 | `STANDARD`, `COMPOSITE`, `SERVICE_LABOR` | **100% EXACT** |
| 10 | `SelectionType` | 809–812 | `SINGLE`, `MULTIPLE` | **100% EXACT** |
| 11 | `UomType` | 814–820 | `MASS`, `VOLUME`, `COUNT`, `LENGTH`, `TIME` | **100% EXACT** |
| 12 | `StorageLocationType` | 822–828 | `STOREFRONT`, `WAREHOUSE`, `KITCHEN`, `BAR`, `TRANSIT` | **100% EXACT** |
| 13 | `StockMovementType` | 830–841 | `SALE`, `PURCHASE`, `TRANSFER_IN`, `TRANSFER_OUT`, `OPNAME_ADJUSTMENT`, `RETURN`, `WASTE`, `VOID`, `PRODUCTION_CONSUMPTION`, `PRODUCTION_OUTPUT` | **100% EXACT** |
| 14 | `InventoryRefType` | 843–851 | `ORDER`, `PURCHASE_ORDER`, `TRANSFER`, `STOCK_OPNAME`, `REFUND`, `PRODUCTION`, `MANUAL` | **100% EXACT** |
| 15 | `ActorType` | 853–856 | `USER`, `SYSTEM` | **100% EXACT** |
| 16 | `OrderStatus` | 858–866 | `DRAFT`, `CONFIRMED`, `IN_PROGRESS`, `READY`, `COMPLETED`, `CANCELLED`, `VOIDED` | **100% EXACT** |
| 17 | `PaymentStatus` | 868–874 | `UNPAID`, `PARTIALLY_PAID`, `PAID`, `PARTIALLY_REFUNDED`, `REFUNDED` | **100% EXACT** |
| 18 | `PaymentMethod` | 876–884 | `CASH`, `QRIS`, `CREDIT_CARD`, `DEBIT_CARD`, `BANK_TRANSFER`, `EWALLET`, `VOUCHER` | **100% EXACT** |
| 19 | `PaymentTxStatus` | 886–892 | `PENDING`, `CAPTURED`, `FAILED`, `REFUNDED`, `VOIDED` | **100% EXACT** |
| 20 | `RefundReason` | 894–900 | `CUSTOMER_RETURN`, `DAMAGED_GOODS`, `WRONG_ITEM`, `DISSATISFIED_SERVICE`, `BILLING_ERROR` | **100% EXACT** |

---

## 3. Structural Model & Field Invariant Checks

1. **Model B User Identity:**
   - Model `User` (lines 66–105) maintains tenant-scoped identity with `email` unique within `tenant_id` (`@@unique([tenantId, email])`).
   - Platform users remain segregated in model `PlatformUser` (lines 14–25).
2. **Inventory Domain Fields:**
   - Model `InventoryBalance` (lines 280–305):
     - `quantityOnHand`: Decimal(12, 3), default: 0
     - `quantityReserved`: Decimal(12, 3), default: 0
     - Verified: **NO** `isNegativeBalance` field exists on `InventoryBalance`.
   - Model `InventoryLedger` (lines 307–342):
     - `isNegativeBalance`: Boolean, default: false (Line 324) — **VERIFIED PRESENT**.
     - `quantityDelta`: Decimal(12, 3)
     - `balanceBefore`: Decimal(12, 3)
     - `balanceAfter`: Decimal(12, 3)
     - `unitCost`: Decimal(15, 4)
     - `movementType`: `StockMovementType`
     - `referenceType`: `InventoryRefType`
3. **No Unauthorized Phase 2 Models:**
   - Verified that no `UserOutletAssignment` or unapproved permission-table models exist in `schema.prisma`.
4. **Tenant Default Constraints:**
   - `Tenant.status`: `TenantStatus @default(TRIAL)` (line 39).
   - `User.role`: `Role @default(CASHIER)` (line 78).

---

## 4. Verification Verdict

`server/prisma/schema.prisma` is **100% verified, internally consistent, and fully synchronized** with the reconciled Target Database Schema Revision 4.
