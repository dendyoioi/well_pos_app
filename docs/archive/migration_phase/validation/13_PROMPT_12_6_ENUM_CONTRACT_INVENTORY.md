# 13_PROMPT_12_6_ENUM_CONTRACT_INVENTORY.md
## Target Database Schema Revision 4 Reconciled Enum Inventory & Ownership State

### 1. Context & Execution Stage
- **Stage**: Prompt 12.6 — Target Schema & Expand Artifact Reconciliation after Owner Confirmation
- **Preceding Milestone**: Prompt 12.5-D Owner Decision Register (ODR-01 through ODR-06) confirmed by Project Owner
- **Authoritative Specification**: `/docs/architecture/04_TARGET_DATABASE_SCHEMA.md` (`ARCH-2026-09-DB-SCHEMA-04`)
- **Live Catalog Source of Truth**: Real `pos_db` PostgreSQL catalog (`pg_type`, `pg_enum`)
- **Executable Migration Artifacts**:
  - `/server/prisma/migrations/20260919000000_expand_phase_ddl/migration.sql`
  - `/server/prisma/migrations/20260919000000_expand_phase_ddl/rollback.sql`

---

### 2. Complete 20-Enum Reconciled Contract & Ownership Matrix

| Enum Name | Target Schema Rev 4 Labels (Exact Ordered) | Existing Baseline Labels (`pos_db`) | Comparison Result | Ownership State | Rollback Action | Evidence / Reference |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `PlatformRole` | `['SUPER_ADMIN', 'SUPPORT', 'BILLING']` (3) | `['SUPER_ADMIN', 'SUPPORT_AGENT', 'FINANCE_ADMIN']` (3) | `INCOMPATIBLE` (Vocabulary mismatch) | `PRE_EXISTING_INCOMPATIBLE` | `PRESERVE (NO ACTION / FAIL-CLOSED ON DROP)` | ODR-01; Schema Rev 4 line 853; `migration.sql` line 12 |
| `TenantStatus` | `['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'PENDING']` (5) | `['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'PENDING']` (5) | `EXACT_MATCH` (Exact 5-label sequence) | `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` | `PRESERVE (NO ACTION)` | ODR-02; Schema Rev 4 line 859; `migration.sql` line 13 |
| `BusinessVertical` | `['RETAIL', 'FNB', 'SERVICES', 'HYBRID']` (4) | Absent (`NULL`) | `ABSENT` (New type required) | `CREATED_BY_PROMPT_12_4_2` | `VERIFIED CATALOG DROP` | Schema Rev 4 line 866; `migration.sql` line 14 |
| `BillingCycle` | `['MONTHLY', 'ANNUALLY']` (2) | `['MONTHLY', 'ANNUALLY']` (2) | `EXACT_MATCH` (Exact 2-label sequence) | `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` | `PRESERVE (NO ACTION)` | Schema Rev 4 line 873; `migration.sql` line 15 |
| `InvoiceStatus` | `['DRAFT', 'UNPAID', 'PAID', 'VOID']` (4) | `['UNPAID', 'PAID', 'CANCELLED', 'EXPIRED']` (4) | `INCOMPATIBLE` (Vocabulary mismatch) | `PRE_EXISTING_INCOMPATIBLE` | `PRESERVE (NO ACTION / FAIL-CLOSED ON DROP)` | ODR-03; Schema Rev 4 line 878; `migration.sql` line 16 |
| `PaymentRecordStatus` | `['PENDING', 'SUCCESS', 'FAILED']` (3) | Absent (`NULL`) | `ABSENT` (New type required) | `CREATED_BY_PROMPT_12_4_2` | `VERIFIED CATALOG DROP` | Schema Rev 4 line 885; `migration.sql` line 17 |
| `Role` | `['OWNER', 'ADMIN', 'SUPERVISOR', 'WAREHOUSE', 'CASHIER', 'KITCHEN', 'WAITER']` (7) | `['ADMIN', 'SUPERVISOR', 'WAREHOUSE', 'CASHIER']` (4) | `INCOMPATIBLE` (Missing: OWNER, KITCHEN, WAITER; WAREHOUSE reconciled) | `PRE_EXISTING_INCOMPATIBLE` | `PRESERVE (NO ACTION / FAIL-CLOSED ON DROP)` | ODR-04; Schema Rev 4 line 891; `migration.sql` line 18 |
| `ShiftStatus` | `['OPEN', 'CLOSED']` (2) | `['OPEN', 'CLOSED']` (2) | `EXACT_MATCH` (Exact 2-label sequence) | `PRE_EXISTING_EXACT_COMPATIBLE_REUSED` | `PRESERVE (NO ACTION)` | Schema Rev 4 line 900; `migration.sql` line 19 |
| `ProductType` | `['STANDARD', 'COMPOSITE', 'SERVICE_LABOR']` (3) | Absent (`NULL`) | `ABSENT` (New type required) | `CREATED_BY_PROMPT_12_4_2` | `VERIFIED CATALOG DROP` | Schema Rev 4 line 905; `migration.sql` line 20 |
| `SelectionType` | `['SINGLE', 'MULTIPLE']` (2) | Absent (`NULL`) | `ABSENT` (New type required) | `CREATED_BY_PROMPT_12_4_2` | `VERIFIED CATALOG DROP` | Schema Rev 4 line 911; `migration.sql` line 21 |
| `UomType` | `['MASS', 'VOLUME', 'COUNT', 'LENGTH', 'TIME']` (5) | Absent (`NULL`) | `ABSENT` (New type required) | `CREATED_BY_PROMPT_12_4_2` | `VERIFIED CATALOG DROP` | Schema Rev 4 line 916; `migration.sql` line 22 |
| `StorageLocationType` | `['STOREFRONT', 'WAREHOUSE', 'KITCHEN', 'BAR', 'TRANSIT']` (5) | Absent (`NULL`) | `ABSENT` (New type required) | `CREATED_BY_PROMPT_12_4_2` | `VERIFIED CATALOG DROP` | Schema Rev 4 line 924; `migration.sql` line 23 |
| `StockMovementType` | `['SALE', 'PURCHASE', 'TRANSFER_IN', 'TRANSFER_OUT', 'OPNAME_ADJUSTMENT', 'RETURN', 'WASTE', 'VOID', 'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT']` (10) | `['PURCHASE_IN', 'SALE_OUT', 'DAMAGE_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT']` (6) | `INCOMPATIBLE` (Legacy prototype vocabulary) | `PRE_EXISTING_INCOMPATIBLE` | `PRESERVE (NO ACTION / FAIL-CLOSED ON DROP)` | ODR-05; Schema Rev 4 line 932; `migration.sql` line 24 |
| `InventoryRefType` | `['ORDER', 'PURCHASE_ORDER', 'TRANSFER', 'STOCK_OPNAME', 'REFUND', 'PRODUCTION', 'MANUAL']` (7) | Absent (`NULL`) | `ABSENT` (New type required) | `CREATED_BY_PROMPT_12_4_2` | `VERIFIED CATALOG DROP` | Schema Rev 4 line 945; `migration.sql` line 25 |
| `ActorType` | `['USER', 'SYSTEM']` (2) | Absent (`NULL`) | `ABSENT` (New type required) | `CREATED_BY_PROMPT_12_4_2` | `VERIFIED CATALOG DROP` | Schema Rev 4 line 955; `migration.sql` line 26 |
| `OrderStatus` | `['DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED', 'VOIDED']` (7) | Absent (`NULL`) (legacy `VARCHAR(50)`) | `ABSENT` (New type required) | `CREATED_BY_PROMPT_12_4_2` | `VERIFIED CATALOG DROP` | Schema Rev 4 line 960; `migration.sql` line 27 |
| `PaymentStatus` | `['UNPAID', 'PARTIALLY_PAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED']` (5) | `['PAID', 'CANCELLED', 'REFUNDED']` (3) | `INCOMPATIBLE` (Missing 3 labels, Extra CANCELLED) | `PRE_EXISTING_INCOMPATIBLE` | `PRESERVE (NO ACTION / FAIL-CLOSED ON DROP)` | Schema Rev 4 line 970; `migration.sql` line 28 |
| `PaymentMethod` | `['CASH', 'QRIS', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'EWALLET', 'VOUCHER']` (7) | `['CASH', 'QRIS']` (2) | `INCOMPATIBLE` (Missing 5 labels) | `PRE_EXISTING_INCOMPATIBLE` | `PRESERVE (NO ACTION / FAIL-CLOSED ON DROP)` | Schema Rev 4 line 978; `migration.sql` line 29 |
| `PaymentTxStatus` | `['PENDING', 'CAPTURED', 'FAILED', 'REFUNDED', 'VOIDED']` (5) | `['SUCCESS', 'PENDING', 'FAILED']` (3) | `INCOMPATIBLE` (Missing 3 labels, Extra SUCCESS) | `PRE_EXISTING_INCOMPATIBLE` | `PRESERVE (NO ACTION / FAIL-CLOSED ON DROP)` | ODR-06; Schema Rev 4 line 988; `migration.sql` line 30 |
| `RefundReason` | `['CUSTOMER_RETURN', 'DAMAGED_GOODS', 'WRONG_ITEM', 'DISSATISFIED_SERVICE', 'BILLING_ERROR']` (5) | Absent (`NULL`) | `ABSENT` (New type required) | `CREATED_BY_PROMPT_12_4_2` | `VERIFIED CATALOG DROP` | Schema Rev 4 line 996; `migration.sql` line 31 |

---

### 3. Key Evolution & Impact of Owner Decisions (ODR-01..06)

1. **`TenantStatus` Transitioned from `INCOMPATIBLE` to `EXACT_MATCH`**:
   - In Prompt 12.4.2/12.4.4, `TenantStatus` was classified as `PRE_EXISTING_INCOMPATIBLE` because Target Schema had only 4 labels (`['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED']`) while `pos_db` had 5 labels (`['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'PENDING']`).
   - Under **ODR-02**, Owner approved `PENDING` as canonical for the registration onboarding flow.
   - Now Target Schema Revision 4, Prisma schema, `migration.sql`, and `rollback.sql` all specify `['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'PENDING']`.
   - **Result**: `TenantStatus` matches the PostgreSQL catalog exactly. It is classified as `PRE_EXISTING_EXACT_COMPATIBLE_REUSED`. Rollback action is `PRESERVE`.

2. **`Role` Alignment (ODR-04)**:
   - Target Schema Revision 4, Prisma schema, `migration.sql`, and `rollback.sql` include `WAREHOUSE` alongside `OWNER, ADMIN, SUPERVISOR, CASHIER, KITCHEN, WAITER` (7 labels total).
   - In `pos_db`, the existing labels are `['ADMIN', 'SUPERVISOR', 'WAREHOUSE', 'CASHIER']` (4 labels).
   - Because `pos_db` is missing `OWNER, KITCHEN, WAITER`, it remains `PRE_EXISTING_INCOMPATIBLE` until future expansion. Crucially, `WAREHOUSE` is preserved and not removed from the target contract. Rollback action is `PRESERVE (FAIL-CLOSED ON DROP)`.

3. **Total Category Counts**:
   - **Total Target Enums**: 20
   - **Exact Matches (`PRE_EXISTING_EXACT_COMPATIBLE_REUSED`)**: 3 (`BillingCycle`, `ShiftStatus`, `TenantStatus`)
   - **Incompatible Pre-Existing Types (`PRE_EXISTING_INCOMPATIBLE`)**: 7 (`PlatformRole`, `InvoiceStatus`, `Role`, `StockMovementType`, `PaymentStatus`, `PaymentMethod`, `PaymentTxStatus`)
   - **New Types Created (`CREATED_BY_PROMPT_12_4_2`)**: 10 (`BusinessVertical`, `PaymentRecordStatus`, `ProductType`, `SelectionType`, `UomType`, `StorageLocationType`, `InventoryRefType`, `ActorType`, `OrderStatus`, `RefundReason`)
   - **Unknown / Uncovered**: 0 (`ZERO UNKNOWN`, `ZERO UNCOVERED`)

---

### 4. Rollback Hardening Invariants (Prompt 12.4.4 Enforced)
For every enum dropped during rollback, the 6-part proof invariant is strictly satisfied:
```text
REGISTRY PROVENANCE (created_by_migration = TRUE)
+
CATALOG OBJECT IDENTITY (oid matching recorded object)
+
ENUM TYPE (pg_type.typtype = 'e')
+
EXPECTED NAMESPACE (pg_namespace.nspname = 'public')
+
EXACT ORDERED TARGET ENUM CONTRACT (labels match temp_target_enums)
+
ROLLBACK AUTHORIZATION (rollback_action = 'DROP')
=
DROP AUTHORIZED
```
No pre-existing enum (`TenantStatus`, `Role`, `PlatformRole`, `InvoiceStatus`, `BillingCycle`, `ShiftStatus`, `StockMovementType`, `PaymentStatus`, `PaymentMethod`, `PaymentTxStatus`) can ever be dropped by rollback.
