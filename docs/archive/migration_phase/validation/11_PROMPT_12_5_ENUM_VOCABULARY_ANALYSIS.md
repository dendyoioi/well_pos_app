# Prompt 12.5: Enum Vocabulary & Semantic Analysis Report

**Environment Evaluated:** REAL `pos_db` (`postgres://postgres:postgres@localhost:5432/pos_db`)  
**Scope:** Strictly Read-Only / Analysis Only / Zero Database Mutation  
**Date:** 2026-09-20  
**Target Specification:** Target Database Schema Revision 4 (`ARCH-2026-09-DB-SCHEMA-04`) in `/docs/architecture/04_TARGET_DATABASE_SCHEMA.md`  

---

## 1. Executive Summary

This report performs an exhaustive, strictly read-only comparative analysis of the 8 PostgreSQL enums present in the live database catalog of `pos_db` against the canonical Target Database Schema Revision 4.

Every finding is grounded in live PostgreSQL catalog queries (`pg_type`, `pg_enum`, `information_schema.columns`) and repository source code. **Zero DDL or DML mutations were executed against `pos_db`.**

---

## 2. Exhaustive Vocabulary Comparison Table

| # | Enum Type Name | Legacy PostgreSQL Catalog Labels (pos_db) | Target Revision 4 Specification Labels | Vocabulary Delta & Nature of Difference |
| :-: | :--- | :--- | :--- | :--- |
| **1** | `PlatformRole` | `SUPER_ADMIN`, `SUPPORT_AGENT`, `FINANCE_ADMIN` (3) | `SUPER_ADMIN`, `SUPPORT`, `BILLING` (3) | Semantic / Nomenclature divergence (`SUPPORT_AGENT` → `SUPPORT`, `FINANCE_ADMIN` → `BILLING`). |
| **2** | `TenantStatus` | `ACTIVE`, `SUSPENDED`, `INACTIVE`, `TRIAL`, `PENDING` (5) | `TRIAL`, `ACTIVE`, `SUSPENDED`, `CANCELLED` (4) | Missing `PENDING` and `INACTIVE` in Target Rev 4; `CANCELLED` is additive in Target Rev 4. |
| **3** | `InvoiceStatus` | `UNPAID`, `PAID`, `CANCELLED`, `EXPIRED` (4) | `DRAFT`, `UNPAID`, `PAID`, `VOID` (4) | Target Rev 4 adds `DRAFT` and `VOID`; legacy has `CANCELLED` and `EXPIRED`. `UNPAID` and `PAID` are EXACT matches. |
| **4** | `Role` | `ADMIN`, `CASHIER`, `WAREHOUSE` (3) | `OWNER`, `ADMIN`, `SUPERVISOR`, `CASHIER`, `KITCHEN`, `WAITER` (6) | Target Rev 4 adds `OWNER`, `SUPERVISOR`, `KITCHEN`, `WAITER`. Target Rev 4 completely omits `WAREHOUSE`. |
| **5** | `StockMovementType` | `PURCHASE_IN`, `SALE_OUT`, `DAMAGE_OUT`, `ADJUSTMENT`, `TRANSFER_IN`, `TRANSFER_OUT` (6) | `SALE`, `PURCHASE`, `TRANSFER_IN`, `TRANSFER_OUT`, `OPNAME_ADJUSTMENT`, `RETURN`, `WASTE`, `VOID`, `PRODUCTION_CONSUMPTION`, `PRODUCTION_OUTPUT` (10) | Target Rev 4 canonical vocabulary: `SALE_OUT`→`SALE`, `PURCHASE_IN`→`PURCHASE`, `DAMAGE_OUT`→`WASTE`, `ADJUSTMENT`→`OPNAME_ADJUSTMENT`. Exact matches: `TRANSFER_IN`, `TRANSFER_OUT`. Target additive: `RETURN`, `VOID`, `PRODUCTION_CONSUMPTION`, `PRODUCTION_OUTPUT`. |
| **6** | `PaymentStatus` | `PAID`, `UNPAID`, `CANCELLED`, `REFUNDED` (4) | `UNPAID`, `PARTIALLY_PAID`, `PAID`, `PARTIALLY_REFUNDED`, `REFUNDED` (5) | Target Rev 4 includes `UNPAID`, `PAID`, `REFUNDED` as EXACT matches, plus additive `PARTIALLY_PAID`, `PARTIALLY_REFUNDED`. Legacy `CANCELLED` is separated into `OrderStatus.CANCELLED`. |
| **7** | `PaymentMethod` | `CASH`, `QRIS` (2) | `CASH`, `QRIS`, `CREDIT_CARD`, `DEBIT_CARD`, `BANK_TRANSFER`, `EWALLET`, `VOUCHER` (7) | Pure additive superset. `CASH` and `QRIS` are 100% exact. 5 additive methods in Target Rev 4. |
| **8** | `PaymentTxStatus` | `SUCCESS`, `PENDING`, `FAILED` (3) | `PENDING`, `CAPTURED`, `FAILED`, `REFUNDED`, `VOIDED` (5) | Exact matches: `PENDING`, `FAILED`. Legacy `SUCCESS` corresponds to `CAPTURED`. Target additive: `REFUNDED`, `VOIDED`. |

---

## 3. Deep Dive Analysis Per Enum

### 3.1 `PlatformRole`
- **Context & Evidence:** Defined in `server/prisma/schema.prisma:10` and used in `platform-auth.middleware.ts`.
- **Target Revision 4:** `04_TARGET_DATABASE_SCHEMA.md:853` defines `PlatformRole` as `SUPER_ADMIN`, `SUPPORT`, `BILLING`.
- **Divergence:**
  - `SUPER_ADMIN`: EXACT match.
  - `SUPPORT_AGENT` vs `SUPPORT`: Nomenclature rename.
  - `FINANCE_ADMIN` vs `BILLING`: Nomenclature rename.
- **Data State:** Only 1 record in `pos_db` (`clxx_superadmin_01`, `role='SUPER_ADMIN'`). 0 records for `SUPPORT_AGENT` or `FINANCE_ADMIN`.
- **Recommendation:** Requires Owner confirmation for nomenclature alignment.

### 3.2 `TenantStatus`
- **Context & Evidence:** `pos_db` table `tenants.status` defaults to `'TRIAL'::"TenantStatus"`.
- **Target Revision 4:** `04_TARGET_DATABASE_SCHEMA.md:859` defines `TenantStatus` as `TRIAL`, `ACTIVE`, `SUSPENDED`, `CANCELLED`.
- **Divergence:**
  - `TRIAL`, `ACTIVE`, `SUSPENDED`: EXACT matches.
  - `INACTIVE`: Absent from Target Rev 4.
  - `PENDING`: Present in legacy catalog and generated in `saas.controller.ts:110` during merchant signup, but absent from Target Rev 4.
  - `CANCELLED`: Additive in Target Rev 4.
- **Data State:** 1 record in `pos_db` (`Ura Coffee`, `status='TRIAL'`). 0 records in `PENDING` or `INACTIVE`.
- **Recommendation:** Owner decision required on merchant signup onboarding lifecycle (`PENDING` vs direct `TRIAL`).

### 3.3 `InvoiceStatus`
- **Context & Evidence:** `pos_db` table `saas_invoices.status` defaults to `'UNPAID'::"InvoiceStatus"`.
- **Target Revision 4:** `04_TARGET_DATABASE_SCHEMA.md:878` defines `InvoiceStatus` as `DRAFT`, `UNPAID`, `PAID`, `VOID`.
- **Divergence:**
  - `UNPAID`, `PAID`: EXACT matches.
  - `CANCELLED`: Corresponds to `VOID`.
  - `EXPIRED`: Legacy concept replaced by invoice lifecycle rules.
  - `DRAFT`: Additive in Target Rev 4.
- **Data State:** 0 records in `pos_db` (table is empty).
- **Recommendation:** Low data risk. Standardize on Target Rev 4 lifecycle.

### 3.4 `Role`
- **Context & Evidence:** `pos_db` table `users.role` defaults to `'CASHIER'::"Role"`.
- **Target Revision 4:** `04_TARGET_DATABASE_SCHEMA.md:891` defines `Role` as `OWNER`, `ADMIN`, `SUPERVISOR`, `CASHIER`, `KITCHEN`, `WAITER`.
- **Divergence:**
  - `ADMIN`, `CASHIER`: EXACT matches.
  - `WAREHOUSE`: Present in legacy catalog and actively used in frontend UI (`DashboardPage.tsx`, `UsersView.tsx`, `auth.ts`), but absent from Target Rev 4.
  - `OWNER`, `SUPERVISOR`, `KITCHEN`, `WAITER`: Additive in Target Rev 4.
- **Data State:** 2 records in `pos_db` (`Rudra` = `ADMIN`, `Dian Anjani` = `CASHIER`). 0 records with `WAREHOUSE`.
- **Recommendation:** CRITICAL BLOCKER / OWNER DECISION REQUIRED. Owner must approve retaining `WAREHOUSE` in Revision 4 or specify migration path for warehouse staff.

### 3.5 `StockMovementType`
- **Context & Evidence:** `pos_db` table `stock_movements.type`.
- **Target Revision 4:** `04_TARGET_DATABASE_SCHEMA.md:932` defines canonical `StockMovementType` as `SALE`, `PURCHASE`, `TRANSFER_IN`, `TRANSFER_OUT`, `OPNAME_ADJUSTMENT`, `RETURN`, `WASTE`, `VOID`, `PRODUCTION_CONSUMPTION`, `PRODUCTION_OUTPUT`.
- **Divergence:**
  - `TRANSFER_IN`, `TRANSFER_OUT`: EXACT matches.
  - `PURCHASE_IN` → `PURCHASE`: DIRECT_RENAME / SEMANTIC_TRANSFORM.
  - `SALE_OUT` → `SALE`: DIRECT_RENAME / SEMANTIC_TRANSFORM.
  - `DAMAGE_OUT` → `WASTE`: DIRECT_RENAME / SEMANTIC_TRANSFORM.
  - `ADJUSTMENT` → `OPNAME_ADJUSTMENT`: SEMANTIC_TRANSFORM.
  - `RETURN`, `VOID`, `PRODUCTION_CONSUMPTION`, `PRODUCTION_OUTPUT`: Target additive.
- **Data State:** 2 records in `pos_db`, both `ADJUSTMENT` (quantities +50 and +100).
- **Recommendation:** Clean semantic mapping to Target Revision 4 canonical vocabulary.

### 3.6 `PaymentStatus`
- **Context & Evidence:** `pos_db` table `orders.payment_status`.
- **Target Revision 4:** `04_TARGET_DATABASE_SCHEMA.md:970` defines `PaymentStatus` as `UNPAID`, `PARTIALLY_PAID`, `PAID`, `PARTIALLY_REFUNDED`, `REFUNDED`.
- **Divergence:**
  - `UNPAID`, `PAID`, `REFUNDED`: EXACT matches.
  - `PARTIALLY_PAID`, `PARTIALLY_REFUNDED`: Additive in Target Rev 4.
  - Legacy `CANCELLED`: Decoupled into `OrderStatus.CANCELLED` / `OrderStatus.VOIDED`.
- **Data State:** 0 records in `pos_db`.
- **Recommendation:** Decouple order status from payment status cleanly.

### 3.7 `PaymentMethod`
- **Context & Evidence:** `pos_db` table `payments.method`.
- **Target Revision 4:** `04_TARGET_DATABASE_SCHEMA.md:978` defines `PaymentMethod` as `CASH`, `QRIS`, `CREDIT_CARD`, `DEBIT_CARD`, `BANK_TRANSFER`, `EWALLET`, `VOUCHER`.
- **Divergence:**
  - `CASH`, `QRIS`: EXACT matches.
  - 5 additive payment methods.
- **Data State:** 0 records in `pos_db`.
- **Recommendation:** Backward-compatible additive expansion.

### 3.8 `PaymentTxStatus`
- **Context & Evidence:** `pos_db` table `payments.status` defaults to `'SUCCESS'::"PaymentTxStatus"`.
- **Target Revision 4:** `04_TARGET_DATABASE_SCHEMA.md:988` defines `PaymentTxStatus` as `PENDING`, `CAPTURED`, `FAILED`, `REFUNDED`, `VOIDED`.
- **Divergence:**
  - `PENDING`, `FAILED`: EXACT matches.
  - `SUCCESS` vs `CAPTURED`: Semantic transform for settled transactions.
  - `REFUNDED`, `VOIDED`: Additive in Target Rev 4.
- **Data State:** 0 records in `pos_db`.
- **Recommendation:** Update application checkout flow to write `CAPTURED`.
