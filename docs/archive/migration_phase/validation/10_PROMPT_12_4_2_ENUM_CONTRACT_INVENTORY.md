# 10_PROMPT_12_4_2_ENUM_CONTRACT_INVENTORY.md
## Target Database Schema Revision 4 Enum Inventory & Ownership State

### 1. Execution Stage
- **Stage**: Prompt 12.4.2 — Final Enum Contract & Rollback Hardening
- **Authoritative Target Schema**: `/docs/architecture/04_TARGET_DATABASE_SCHEMA.md` (`ARCH-2026-09-DB-SCHEMA-04`)
- **Inspection Basis**: Live PostgreSQL catalog analysis (`pg_type`, `pg_enum`) and executable DDL artifacts (`migration.sql`, `rollback.sql`).

---

### 2. Complete 20-Enum Contract & Ownership Matrix

| Enum Name | Target Schema Rev 4 Labels (Exact Ordered) | Existing Baseline Labels (`pos_db`) | Comparison Result | Ownership State | Rollback Action | Evidence / Reference |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `PlatformRole` | `['SUPER_ADMIN', 'SUPPORT', 'BILLING']` (3) | `['SUPER_ADMIN', 'SUPPORT_AGENT', 'FINANCE_ADMIN']` (3) | `INCOMPATIBLE` (Vocabulary mismatch: SUPPORT_AGENT, FINANCE_ADMIN) | `PRE_EXISTING_INCOMPATIBLE` | `N/A (FAILS CLOSED)` | Schema Rev 4: line 853; `migration.sql` line 12; `pg_enum` |
| `TenantStatus` | `['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED']` (4) | `['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'PENDING']` (5) | `INCOMPATIBLE` (Superset: extra label `PENDING`) | `PRE_EXISTING_INCOMPATIBLE` | `N/A (FAILS CLOSED)` | Schema Rev 4: line 859; `migration.sql` line 13; `pg_enum` |
| `BusinessVertical` | `['RETAIL', 'FNB', 'SERVICES', 'HYBRID']` (4) | Absent (`NULL`) | `ABSENT` (New type required) | `CREATED_BY_PROMPT_12_4_2` | `DROP TYPE IF EXISTS "BusinessVertical"` | Schema Rev 4: line 866; `migration.sql` line 14; `pg_enum` |
| `BillingCycle` | `['MONTHLY', 'ANNUALLY']` (2) | `['MONTHLY', 'ANNUALLY']` (2) | `EXACT_MATCH` (Exact label sequence) | `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` | `PRESERVE (NO ACTION)` | Schema Rev 4: line 873; `migration.sql` line 15; `pg_enum` |
| `InvoiceStatus` | `['DRAFT', 'UNPAID', 'PAID', 'VOID']` (4) | `['UNPAID', 'PAID', 'CANCELLED', 'EXPIRED']` (4) | `INCOMPATIBLE` (Vocabulary mismatch: CANCELLED, EXPIRED vs DRAFT, VOID) | `PRE_EXISTING_INCOMPATIBLE` | `N/A (FAILS CLOSED)` | Schema Rev 4: line 878; `migration.sql` line 16; `pg_enum` |
| `PaymentRecordStatus` | `['PENDING', 'SUCCESS', 'FAILED']` (3) | Absent (`NULL`) | `ABSENT` (New type required) | `CREATED_BY_PROMPT_12_4_2` | `DROP TYPE IF EXISTS "PaymentRecordStatus"` | Schema Rev 4: line 885; `migration.sql` line 17; `pg_enum` |
| `Role` | `['OWNER', 'ADMIN', 'SUPERVISOR', 'CASHIER', 'KITCHEN', 'WAITER']` (6) | `['ADMIN', 'SUPERVISOR', 'WAREHOUSE', 'CASHIER']` (4) | `INCOMPATIBLE` (Missing: OWNER, KITCHEN, WAITER; Extra: WAREHOUSE) | `PRE_EXISTING_INCOMPATIBLE` | `N/A (FAILS CLOSED)` | Schema Rev 4: line 891; `migration.sql` line 18; `pg_enum` |
| `ShiftStatus` | `['OPEN', 'CLOSED']` (2) | `['OPEN', 'CLOSED']` (2) | `EXACT_MATCH` (Exact label sequence) | `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` | `PRESERVE (NO ACTION)` | Schema Rev 4: line 900; `migration.sql` line 19; `pg_enum` |
| `ProductType` | `['STANDARD', 'COMPOSITE', 'SERVICE_LABOR']` (3) | Absent (`NULL`) | `ABSENT` (New type required) | `CREATED_BY_PROMPT_12_4_2` | `DROP TYPE IF EXISTS "ProductType"` | Schema Rev 4: line 905; `migration.sql` line 20; `pg_enum` |
| `SelectionType` | `['SINGLE', 'MULTIPLE']` (2) | Absent (`NULL`) | `ABSENT` (New type required) | `CREATED_BY_PROMPT_12_4_2` | `DROP TYPE IF EXISTS "SelectionType"` | Schema Rev 4: line 911; `migration.sql` line 21; `pg_enum` |
| `UomType` | `['MASS', 'VOLUME', 'COUNT', 'LENGTH', 'TIME']` (5) | Absent (`NULL`) | `ABSENT` (New type required) | `CREATED_BY_PROMPT_12_4_2` | `DROP TYPE IF EXISTS "UomType"` | Schema Rev 4: line 916; `migration.sql` line 22; `pg_enum` |
| `StorageLocationType` | `['STOREFRONT', 'WAREHOUSE', 'KITCHEN', 'BAR', 'TRANSIT']` (5) | Absent (`NULL`) | `ABSENT` (New type required) | `CREATED_BY_PROMPT_12_4_2` | `DROP TYPE IF EXISTS "StorageLocationType"` | Schema Rev 4: line 924; `migration.sql` line 23; `pg_enum` |
| `StockMovementType` | `['SALE', 'PURCHASE', 'TRANSFER_IN', 'TRANSFER_OUT', 'OPNAME_ADJUSTMENT', 'RETURN', 'WASTE', 'VOID', 'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT']` (10) | `['PURCHASE_IN', 'SALE_OUT', 'DAMAGE_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT']` (6) | `INCOMPATIBLE` (Legacy prototype vocabulary drift) | `PRE_EXISTING_INCOMPATIBLE` | `N/A (FAILS CLOSED)` | Schema Rev 4: line 932; `migration.sql` line 24; `pg_enum` |
| `InventoryRefType` | `['ORDER', 'PURCHASE_ORDER', 'TRANSFER', 'STOCK_OPNAME', 'REFUND', 'PRODUCTION', 'MANUAL']` (7) | Absent (`NULL`) | `ABSENT` (New type required) | `CREATED_BY_PROMPT_12_4_2` | `DROP TYPE IF EXISTS "InventoryRefType"` | Schema Rev 4: line 945; `migration.sql` line 25; `pg_enum` |
| `ActorType` | `['USER', 'SYSTEM']` (2) | Absent (`NULL`) | `ABSENT` (New type required) | `CREATED_BY_PROMPT_12_4_2` | `DROP TYPE IF EXISTS "ActorType"` | Schema Rev 4: line 955; `migration.sql` line 26; `pg_enum` |
| `OrderStatus` | `['DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED', 'VOIDED']` (7) | Absent (`NULL`) (Legacy `orders.order_status` was `VARCHAR(50)`) | `ABSENT` (New type required) | `CREATED_BY_PROMPT_12_4_2` | `DROP TYPE IF EXISTS "OrderStatus"` | Schema Rev 4: line 960; `migration.sql` line 27; `pg_enum` |
| `PaymentStatus` | `['UNPAID', 'PARTIALLY_PAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED']` (5) | `['PAID', 'CANCELLED', 'REFUNDED']` (3) | `INCOMPATIBLE` (Missing: UNPAID, PARTIALLY_PAID, PARTIALLY_REFUNDED; Extra: CANCELLED) | `PRE_EXISTING_INCOMPATIBLE` | `N/A (FAILS CLOSED)` | Schema Rev 4: line 970; `migration.sql` line 28; `pg_enum` |
| `PaymentMethod` | `['CASH', 'QRIS', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'EWALLET', 'VOUCHER']` (7) | `['CASH', 'QRIS']` (2) | `INCOMPATIBLE` (Missing 5 labels: CREDIT_CARD, DEBIT_CARD, BANK_TRANSFER, EWALLET, VOUCHER) | `PRE_EXISTING_INCOMPATIBLE` | `N/A (FAILS CLOSED)` | Schema Rev 4: line 978; `migration.sql` line 29; `pg_enum` |
| `PaymentTxStatus` | `['PENDING', 'CAPTURED', 'FAILED', 'REFUNDED', 'VOIDED']` (5) | `['SUCCESS', 'PENDING', 'FAILED']` (3) | `INCOMPATIBLE` (Missing: CAPTURED, REFUNDED, VOIDED; Extra: SUCCESS) | `PRE_EXISTING_INCOMPATIBLE` | `N/A (FAILS CLOSED)` | Schema Rev 4: line 988; `migration.sql` line 30; `pg_enum` |
| `RefundReason` | `['CUSTOMER_RETURN', 'DAMAGED_GOODS', 'WRONG_ITEM', 'DISSATISFIED_SERVICE', 'BILLING_ERROR']` (5) | Absent (`NULL`) | `ABSENT` (New type required) | `CREATED_BY_PROMPT_12_4_2` | `DROP TYPE IF EXISTS "RefundReason"` | Schema Rev 4: line 996; `migration.sql` line 31; `pg_enum` |

---

### 3. Verification Summary
- **Total Target Enums**: 20
- **Total Absent (New Types Created)**: 10 (`BusinessVertical`, `PaymentRecordStatus`, `ProductType`, `SelectionType`, `UomType`, `StorageLocationType`, `InventoryRefType`, `ActorType`, `OrderStatus`, `RefundReason`)
- **Total Exact Matches (Reused & Preserved)**: 2 (`BillingCycle`, `ShiftStatus`)
- **Total Incompatible Pre-Existing Types (Fail-Closed Abort)**: 8 (`PlatformRole`, `TenantStatus`, `InvoiceStatus`, `Role`, `StockMovementType`, `PaymentStatus`, `PaymentMethod`, `PaymentTxStatus`)
- **Unknown / Uncovered**: 0 (`ZERO UNKNOWN`, `ZERO UNCOVERED`)
