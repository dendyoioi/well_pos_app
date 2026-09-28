# Prompt 12.4.4 — Enum Rollback Catalog Identity Matrix

## Target Database Schema Revision 4 Enums

| Enum | Registry Ownership | Catalog Exists | Catalog Type | Namespace | Exact Labels | Rollback Decision | Evidence |
|---|---|---|---|---|---|---|---|
| `PlatformRole` | `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` | Yes | `typtype = 'e'` | `public` | Exact Match (`SUPER_ADMIN`, `SUPPORT`, `BILLING`) | `PRESERVE` | Section 3.4 preserved; E-02/P-02/R-10 test logs |
| `TenantStatus` | `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` | Yes | `typtype = 'e'` | `public` | Exact Match (`TRIAL`, `ACTIVE`, `SUSPENDED`, `CANCELLED`) | `PRESERVE` | Section 3.4 preserved; E-02/P-02/R-10 test logs |
| `BusinessVertical` | `CREATED_BY_PROMPT_12_4_2` | Yes | `typtype = 'e'` | `public` | Exact Match (`RETAIL`, `FNB`, `SERVICES`, `HYBRID`) | `DROP AUTHORIZED` | Verified Section 3.2 & dropped Section 3.3; R-01, R-15 logs |
| `BillingCycle` | `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` | Yes | `typtype = 'e'` | `public` | Exact Match (`MONTHLY`, `ANNUALLY`) | `PRESERVE` | Section 3.4 preserved; E-09/P-13/R-10 test logs |
| `InvoiceStatus` | `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` | Yes | `typtype = 'e'` | `public` | Exact Match (`DRAFT`, `UNPAID`, `PAID`, `VOID`) | `PRESERVE` | Section 3.4 preserved; E-02/P-02/R-10 test logs |
| `PaymentRecordStatus` | `CREATED_BY_PROMPT_12_4_2` | Yes | `typtype = 'e'` | `public` | Exact Match (`PENDING`, `SUCCESS`, `FAILED`) | `DROP AUTHORIZED` | Verified Section 3.2 & dropped Section 3.3; R-01, R-15 logs |
| `Role` | `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` | Yes | `typtype = 'e'` | `public` | Exact Match (`OWNER`, `ADMIN`, `SUPERVISOR`, `CASHIER`, `KITCHEN`, `WAITER`) | `PRESERVE` | Section 3.4 preserved; E-02/P-02/R-10 test logs |
| `ShiftStatus` | `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` | Yes | `typtype = 'e'` | `public` | Exact Match (`OPEN`, `CLOSED`) | `PRESERVE` | Section 3.4 preserved; E-02/P-04/P-13/R-10 test logs |
| `ProductType` | `CREATED_BY_PROMPT_12_4_2` | Yes | `typtype = 'e'` | `public` | Exact Match (`STANDARD`, `COMPOSITE`, `SERVICE_LABOR`) | `DROP AUTHORIZED` | Verified Section 3.2 & dropped Section 3.3; R-01, R-15 logs |
| `SelectionType` | `CREATED_BY_PROMPT_12_4_2` | Yes | `typtype = 'e'` | `public` | Exact Match (`SINGLE`, `MULTIPLE`) | `DROP AUTHORIZED` | Verified Section 3.2 & dropped Section 3.3; R-01, R-15 logs |
| `UomType` | `CREATED_BY_PROMPT_12_4_2` | Yes | `typtype = 'e'` | `public` | Exact Match (`MASS`, `VOLUME`, `COUNT`, `LENGTH`, `TIME`) | `DROP AUTHORIZED` | Verified Section 3.2 & dropped Section 3.3; R-01, R-15 logs |
| `StorageLocationType` | `CREATED_BY_PROMPT_12_4_2` | Yes | `typtype = 'e'` | `public` | Exact Match (`STOREFRONT`, `WAREHOUSE`, `KITCHEN`, `BAR`, `TRANSIT`) | `DROP AUTHORIZED` | Verified Section 3.2 & dropped Section 3.3; R-01, R-15 logs |
| `StockMovementType` | `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` | Yes | `typtype = 'e'` | `public` | Exact Match (10 labels exact order) | `PRESERVE` | Section 3.4 preserved; E-02/P-02/R-10 test logs |
| `InventoryRefType` | `CREATED_BY_PROMPT_12_4_2` | Yes | `typtype = 'e'` | `public` | Exact Match (`ORDER`, `PURCHASE_ORDER`, `TRANSFER`, `STOCK_OPNAME`, `REFUND`, `PRODUCTION`, `MANUAL`) | `DROP AUTHORIZED` | Verified Section 3.2 & dropped Section 3.3; R-01, R-15 logs |
| `ActorType` | `CREATED_BY_PROMPT_12_4_2` | Yes | `typtype = 'e'` | `public` | Exact Match (`USER`, `SYSTEM`) | `DROP AUTHORIZED` | Verified Section 3.2 & dropped Section 3.3; R-01, R-15 logs |
| `OrderStatus` | `CREATED_BY_PROMPT_12_4_2` | Yes | `typtype = 'e'` | `public` | Exact Match (`DRAFT`, `CONFIRMED`, `IN_PROGRESS`, `READY`, `COMPLETED`, `CANCELLED`, `VOIDED`) | `DROP AUTHORIZED` | Verified Section 3.2 & dropped Section 3.3; R-01, R-15 logs |
| `PaymentStatus` | `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` | Yes | `typtype = 'e'` | `public` | Exact Match (`UNPAID`, `PARTIALLY_PAID`, `PAID`, `PARTIALLY_REFUNDED`, `REFUNDED`) | `PRESERVE` | Section 3.4 preserved; E-02/P-02/R-10 test logs |
| `PaymentMethod` | `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` | Yes | `typtype = 'e'` | `public` | Exact Match (`CASH`, `QRIS`, `CREDIT_CARD`, `DEBIT_CARD`, `BANK_TRANSFER`, `EWALLET`, `VOUCHER`) | `PRESERVE` | Section 3.4 preserved; E-02/P-02/R-10 test logs |
| `PaymentTxStatus` | `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` | Yes | `typtype = 'e'` | `public` | Exact Match (`PENDING`, `CAPTURED`, `FAILED`, `REFUNDED`, `VOIDED`) | `PRESERVE` | Section 3.4 preserved; E-02/P-02/R-10 test logs |
| `RefundReason` | `CREATED_BY_PROMPT_12_4_2` | Yes | `typtype = 'e'` | `public` | Exact Match (`CUSTOMER_RETURN`, `DAMAGED_GOODS`, `WRONG_ITEM`, `DISSATISFIED_SERVICE`, `BILLING_ERROR`) | `DROP AUTHORIZED` | Verified Section 3.2 & dropped Section 3.3; R-01, R-15 logs |

## Matrix Summary

- **Total Target Revision 4 Enums**: 20
- **Pre-Existing Reused Enums**: 10 (`PRESERVE` verified across migration and rollback)
- **Migration-Created Enums**: 10 (`DROP AUTHORIZED` strictly conditional on full catalog identity verification)
- **Zero Unverified Enums**: 0
