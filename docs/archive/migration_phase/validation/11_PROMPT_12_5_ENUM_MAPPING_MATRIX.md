# Prompt 12.5: Enum Mapping Matrix & Semantic Compatibility Analysis

**Environment Evaluated:** REAL `pos_db` (`postgres://postgres:postgres@localhost:5432/pos_db`)  
**Scope:** Strictly Read-Only / Zero Mutation  
**Timestamp:** 2026-09-20  
**Target Specification:** Target Database Schema Revision 4 (`ARCH-2026-09-DB-SCHEMA-04`) in `/docs/architecture/04_TARGET_DATABASE_SCHEMA.md`  

---

## 1. Executive Overview

This artifact provides the formal mapping classification for every enum label across the 8 legacy PostgreSQL enums against the canonical Target Database Schema Revision 4 vocabulary.

Every mapping classification adheres to the 9 canonical categories defined in Prompt 12.5:
1. `EXACT`: Identical label string and semantically equivalent business meaning.
2. `DIRECT_RENAME`: 1-to-1 rename where domain semantics are identical, but label nomenclature changed.
3. `SEMANTIC_TRANSFORM`: Deterministic 1-to-1 transformation with contextual semantics (e.g. status vocabulary upgrade).
4. `SPLIT_REQUIRED`: 1 legacy label splits into 2 or more distinct target labels based on row-level metadata (e.g. direction or delta).
5. `MERGE_REQUIRED`: 2 or more legacy labels collapse into 1 target label.
6. `NO_SAFE_MAPPING`: No logical equivalent in Target Revision 4 without corrupting domain integrity.
7. `TARGET_ADDITIVE_ONLY`: New target label introduced in Revision 4 with no legacy predecessor.
8. `LEGACY_ONLY`: Legacy label present in existing schema/app but absent from Target Revision 4.
9. `REQUIRES_OWNER_DECISION`: Semantic ambiguity or product requirement that cannot be decided purely technically.

---

## 2. Exhaustive Mapping Matrix Per Enum

### 2.1 Enum: `PlatformRole` (Legacy) vs `PlatformRole` (Target Revision 4)

- **Legacy Enum Type:** `public."PlatformRole"` (`SUPER_ADMIN`, `SUPPORT_AGENT`, `FINANCE_ADMIN`)
- **Target Enum Type:** `public."PlatformRole"` (`SUPER_ADMIN`, `SUPPORT`, `BILLING`)

| Legacy Value | Target Value | Classification | Rows in `pos_db` | Semantic Evidence & Transformation Logic |
| :--- | :--- | :--- | :--- | :--- |
| `SUPER_ADMIN` | `SUPER_ADMIN` | `EXACT` | 1 | Identical string and scope across all layers (platform administrator). |
| `SUPPORT_AGENT` | `SUPPORT` | `REQUIRES_OWNER_DECISION` | 0 | Candidate `DIRECT_RENAME`. Target uses shorter nomenclature. Requires owner validation that support scope is identical. |
| `FINANCE_ADMIN` | `BILLING` | `REQUIRES_OWNER_DECISION` | 0 | Candidate `DIRECT_RENAME`. Target broadens or alters scope to subscription billing. Requires owner validation. |
| *None* | `SUPPORT` | `TARGET_ADDITIVE_ONLY` | - | New target label in Revision 4. |
| *None* | `BILLING` | `TARGET_ADDITIVE_ONLY` | - | New target label in Revision 4. |

---

### 2.2 Enum: `TenantStatus` (Legacy) vs `TenantStatus` (Target Revision 4)

- **Legacy Enum Type:** `public."TenantStatus"` (`ACTIVE`, `SUSPENDED`, `INACTIVE`, `TRIAL`, `PENDING`)
- **Target Enum Type:** `public."TenantStatus"` (`TRIAL`, `ACTIVE`, `SUSPENDED`, `CANCELLED`)

| Legacy Value | Target Value | Classification | Rows in `pos_db` | Semantic Evidence & Transformation Logic |
| :--- | :--- | :--- | :--- | :--- |
| `TRIAL` | `TRIAL` | `EXACT` | 1 | Identical string and semantics. Represents evaluation period. |
| `ACTIVE` | `ACTIVE` | `EXACT` | 0 | Identical string and semantics. Represents paid active tenant. |
| `SUSPENDED` | `SUSPENDED` | `EXACT` | 0 | Identical string and semantics. Represents suspended tenant due to non-payment or policy. |
| `INACTIVE` | `CANCELLED` | `REQUIRES_OWNER_DECISION` | 0 | Candidate `SEMANTIC_TRANSFORM`. Target does not have `INACTIVE`; it uses `SUSPENDED` and `CANCELLED`. Owner must decide if `INACTIVE` maps to `CANCELLED`. |
| `PENDING` | *Undetermined* | `REQUIRES_OWNER_DECISION` | 0 | Used in signup code (`saas.controller.ts:110`). Target Revision 4 has no `PENDING` (tenants start in `TRIAL`). Owner must decide whether pending signups should directly enter `TRIAL` or require email verification state. |
| *None* | `CANCELLED` | `TARGET_ADDITIVE_ONLY` | - | New target label for terminated subscriptions. |

---

### 2.3 Enum: `InvoiceStatus` (Legacy) vs `InvoiceStatus` (Target Revision 4)

- **Legacy Enum Type:** `public."InvoiceStatus"` (`UNPAID`, `PAID`, `CANCELLED`, `EXPIRED`)
- **Target Enum Type:** `public."InvoiceStatus"` (`DRAFT`, `UNPAID`, `PAID`, `VOID`)

| Legacy Value | Target Value | Classification | Rows in `pos_db` | Semantic Evidence & Transformation Logic |
| :--- | :--- | :--- | :--- | :--- |
| `UNPAID` | `UNPAID` | `EXACT` | 0 | Identical string and semantics. Unsettled invoice. |
| `PAID` | `PAID` | `EXACT` | 0 | Identical string and semantics. Settled invoice. |
| `CANCELLED` | `VOID` | `REQUIRES_OWNER_DECISION` | 0 | Candidate `SEMANTIC_TRANSFORM`. Target uses `VOID` for cancelled/nullified invoices. |
| `EXPIRED` | `VOID` | `REQUIRES_OWNER_DECISION` | 0 | Legacy `EXPIRED` represented an invoice whose payment window elapsed. Owner must decide whether it maps to `VOID`. |
| *None* | `DRAFT` | `TARGET_ADDITIVE_ONLY` | - | New target label for invoices being prepared. |
| *None* | `VOID` | `TARGET_ADDITIVE_ONLY` | - | New target label for voided invoices. |

---

### 2.4 Enum: `Role` (Legacy) vs `Role` (Target Revision 4)

- **Legacy Enum Type:** `public."Role"` (`ADMIN`, `CASHIER`, `WAREHOUSE`)
- **Target Enum Type:** `public."Role"` (`OWNER`, `ADMIN`, `SUPERVISOR`, `CASHIER`, `KITCHEN`, `WAITER`)

| Legacy Value | Target Value | Classification | Rows in `pos_db` | Semantic Evidence & Transformation Logic |
| :--- | :--- | :--- | :--- | :--- |
| `ADMIN` | `ADMIN` | `EXACT` | 1 | Identical string and scope. Tenant manager. |
| `CASHIER` | `CASHIER` | `EXACT` | 1 | Identical string and scope. Point-of-sale operator. |
| `WAREHOUSE` | *None* | `REQUIRES_OWNER_DECISION` | 0 | Absent from Target Revision 4 `Role`. Extensively referenced in frontend (`DashboardPage.tsx`, `UsersView.tsx`, `auth.ts`). Converting to `ADMIN` or `CASHIER` violates separation of concerns. Owner must decide whether to add `WAREHOUSE` to Rev 4 or migrate warehouse staff to a separate permission system. |
| *None* | `OWNER` | `TARGET_ADDITIVE_ONLY` | - | New target role for business account proprietor. |
| *None* | `SUPERVISOR` | `TARGET_ADDITIVE_ONLY` | - | New target role for shift / floor supervisor. |
| *None* | `KITCHEN` | `TARGET_ADDITIVE_ONLY` | - | New target role for kitchen display system operators. |
| *None* | `WAITER` | `TARGET_ADDITIVE_ONLY` | - | New target role for table service ordering. |

---

### 2.5 Enum: `StockMovementType` (Legacy) vs `StockMovementType` (Target Revision 4)

- **Legacy Enum Type:** `public."StockMovementType"` (`PURCHASE_IN`, `SALE_OUT`, `DAMAGE_OUT`, `ADJUSTMENT`, `TRANSFER_IN`, `TRANSFER_OUT`)
- **Target Enum Type:** `public."StockMovementType"` (`SALE`, `PURCHASE`, `TRANSFER_IN`, `TRANSFER_OUT`, `OPNAME_ADJUSTMENT`, `RETURN`, `WASTE`, `VOID`, `PRODUCTION_CONSUMPTION`, `PRODUCTION_OUTPUT`)

| Legacy Value | Target Value | Classification | Rows in `pos_db` | Semantic Evidence & Transformation Logic |
| :--- | :--- | :--- | :--- | :--- |
| `PURCHASE_IN` | `PURCHASE` | `SEMANTIC_TRANSFORM` | 0 | Stock received from supplier. Direct rename / semantic transform. |
| `SALE_OUT` | `SALE` | `SEMANTIC_TRANSFORM` | 0 | Stock depleted via sales transaction. Direct rename / semantic transform. |
| `DAMAGE_OUT` | `WASTE` | `SEMANTIC_TRANSFORM` | 0 | Damaged/spoiled goods written off. Direct rename / semantic transform. |
| `ADJUSTMENT` | `OPNAME_ADJUSTMENT` | `SEMANTIC_TRANSFORM` | 2 | Stock adjustment / reconciliation. Both existing rows have positive quantity (+50, +100), recorded with signed quantityDelta in `inventory_ledgers`. |
| `TRANSFER_IN` | `TRANSFER_IN` | `EXACT` | 0 | Inter-outlet receipt. Identical string and semantics. |
| `TRANSFER_OUT` | `TRANSFER_OUT` | `EXACT` | 0 | Inter-outlet dispatch. Identical string and semantics. |
| *None* | `RETURN` | `TARGET_ADDITIVE_ONLY` | - | New target label for customer return restock. |
| *None* | `VOID` | `TARGET_ADDITIVE_ONLY` | - | New target label for voided sales transaction reversal. |
| *None* | `PRODUCTION_CONSUMPTION` | `TARGET_ADDITIVE_ONLY` | - | New target label for raw material consumption in recipe assembly. |
| *None* | `PRODUCTION_OUTPUT` | `TARGET_ADDITIVE_ONLY` | - | New target label for finished goods production output. |

---

### 2.6 Enum: `PaymentStatus` (Legacy) vs `PaymentStatus` (Target Revision 4)

- **Legacy Enum Type:** `public."PaymentStatus"` (`PAID`, `UNPAID`, `CANCELLED`, `REFUNDED`)
- **Target Enum Type:** `public."PaymentStatus"` (`UNPAID`, `PARTIALLY_PAID`, `PAID`, `PARTIALLY_REFUNDED`, `REFUNDED`)

| Legacy Value | Target Value | Classification | Rows in `pos_db` | Semantic Evidence & Transformation Logic |
| :--- | :--- | :--- | :--- | :--- |
| `UNPAID` | `UNPAID` | `EXACT` | 0 | Identical string and semantics. Open unpaid order payment. |
| `PAID` | `PAID` | `EXACT` | 0 | Completed full payment settlement. |
| `REFUNDED` | `REFUNDED` | `EXACT` | 0 | Payment refunded to customer. |
| `CANCELLED` | `OrderStatus.CANCELLED` | `SEMANTIC_TRANSFORM` | 0 | Decoupled from payment status. In Target Revision 4, order cancellation is tracked via `OrderStatus.CANCELLED` / `OrderStatus.VOIDED`. |
| *None* | `PARTIALLY_PAID` | `TARGET_ADDITIVE_ONLY` | - | New target label for split/partial payments. |
| *None* | `PARTIALLY_REFUNDED` | `TARGET_ADDITIVE_ONLY` | - | New target label for partial refunds. |

---

### 2.7 Enum: `PaymentMethod` (Legacy) vs `PaymentMethod` (Target Revision 4)

- **Legacy Enum Type:** `public."PaymentMethod"` (`CASH`, `QRIS`)
- **Target Enum Type:** `public."PaymentMethod"` (`CASH`, `QRIS`, `CREDIT_CARD`, `DEBIT_CARD`, `BANK_TRANSFER`, `EWALLET`, `VOUCHER`)

| Legacy Value | Target Value | Classification | Rows in `pos_db` | Semantic Evidence & Transformation Logic |
| :--- | :--- | :--- | :--- | :--- |
| `CASH` | `CASH` | `EXACT` | 0 | Identical string and semantics. Physical fiat currency. |
| `QRIS` | `QRIS` | `EXACT` | 0 | Identical string and semantics. Standardized Indonesian QR code. |
| *None* | `CREDIT_CARD` | `TARGET_ADDITIVE_ONLY` | - | New payment method. |
| *None* | `DEBIT_CARD` | `TARGET_ADDITIVE_ONLY` | - | New payment method. |
| *None* | `BANK_TRANSFER` | `TARGET_ADDITIVE_ONLY` | - | New payment method. |
| *None* | `EWALLET` | `TARGET_ADDITIVE_ONLY` | - | New payment method. |
| *None* | `VOUCHER` | `TARGET_ADDITIVE_ONLY` | - | New payment method. |

---

### 2.8 Enum: `PaymentTxStatus` (Legacy) vs `PaymentTxStatus` (Target Revision 4)

- **Legacy Enum Type:** `public."PaymentTxStatus"` (`SUCCESS`, `PENDING`, `FAILED`)
- **Target Enum Type:** `public."PaymentTxStatus"` (`PENDING`, `CAPTURED`, `FAILED`, `REFUNDED`, `VOIDED`)

| Legacy Value | Target Value | Classification | Rows in `pos_db` | Semantic Evidence & Transformation Logic |
| :--- | :--- | :--- | :--- | :--- |
| `PENDING` | `PENDING` | `EXACT` | 0 | Identical string and semantics. Awaiting settlement. |
| `FAILED` | `FAILED` | `EXACT` | 0 | Identical string and semantics. Gateway rejected transaction. |
| `SUCCESS` | `CAPTURED` | `REQUIRES_OWNER_DECISION` | 0 | Candidate `SEMANTIC_TRANSFORM`. In standard payment processing (Revision 4), terminal settlement is `CAPTURED`. Owner confirmation required. |
| *None* | `REFUNDED` | `TARGET_ADDITIVE_ONLY` | - | New target label for refunded transactions. |
| *None* | `VOIDED` | `TARGET_ADDITIVE_ONLY` | - | New target label for voided transactions. |

---

## 3. Summary of Classifications Across All Enums

- **Total Legacy Enum Labels Evaluated:** 29 labels across 8 enums
- **EXACT:** 12 labels
- **SEMANTIC_TRANSFORM:** 5 labels
- **SPLIT_REQUIRED:** 0 labels (since `ADJUSTMENT` maps cleanly to `OPNAME_ADJUSTMENT` with sign in `quantityDelta`)
- **MERGE_REQUIRED:** 0 labels
- **NO_SAFE_MAPPING:** 0 labels
- **REQUIRES_OWNER_DECISION:** 12 labels
- **TARGET_ADDITIVE_ONLY:** 20 labels introduced in Target Revision 4
- **Total Rows Impacted in Real `pos_db`:** 6 rows (4 EXACT, 2 SEMANTIC_TRANSFORM)
