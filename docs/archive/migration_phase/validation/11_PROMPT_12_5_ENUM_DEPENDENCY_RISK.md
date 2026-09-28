# Prompt 12.5: Enum Dependency Risk Analysis

**Environment Evaluated:** REAL `pos_db` (`postgres://postgres:postgres@localhost:5432/pos_db`)  
**Scope:** Strictly Read-Only / Zero Mutation  
**Timestamp:** 2026-09-20  

---

## 1. Risk Evaluation Framework

Every legacy enum is evaluated across six rigorous risk dimensions:
- **A. Data Risk:** Loss of precision, truncation, or forced conversion of existing values.
- **B. Semantic Risk:** Misinterpreting business meaning (e.g. conflating void vs draft, or collapsing payment status into order status).
- **C. Referential Risk:** Foreign key constraints, default expressions, or table integrity checks impacted.
- **D. Application Risk:** Breakage of frontend views, backend controllers, middleware guards, or API contracts.
- **E. Historical/Audit Risk:** Corruption of legal, financial, or ledger audit trails.
- **F. Migration Sequencing Risk:** Dependencies requiring staged transitional representation prior to Target Revision 4 cutover.

Risk Severities: `LOW` | `MEDIUM` | `HIGH` | `BLOCKER`.

---

## 2. Risk Matrix Per Enum

### 2.1 `PlatformRole`

| Risk Dimension | Level | Evidence & Rationale |
| :--- | :--- | :--- |
| **A. Data Risk** | `LOW` | `pos_db` has exactly 1 row (`SUPER_ADMIN`). No rows exist for `SUPPORT_AGENT` or `FINANCE_ADMIN`. |
| **B. Semantic Risk** | `MEDIUM` | `SUPPORT` in Rev 4 may have different permissions than legacy `SUPPORT_AGENT`. `BILLING` in Rev 4 implies subscription invoice handling rather than general platform finance. |
| **C. Referential Risk** | `LOW` | Column `platform_users.role` has no default constraint and is not referenced in foreign keys. |
| **D. Application Risk** | `HIGH` | Backend code (`auth.controller.ts`, `platform-auth.middleware.ts`) and Prisma client reference `PlatformRole.SUPER_ADMIN`, `SUPPORT_AGENT`, and `FINANCE_ADMIN`. Altering the type without code cutover breaks TypeScript builds and authentication guards. |
| **E. Historical/Audit Risk** | `LOW` | No historical audit log table tracks platform role mutations in the legacy schema. |
| **F. Migration Sequencing Risk** | `MEDIUM` | Requires dual-write or code adapter if platform users are ever assigned support or billing roles prior to full cutover. |

---

### 2.2 `TenantStatus`

| Risk Dimension | Level | Evidence & Rationale |
| :--- | :--- | :--- |
| **A. Data Risk** | `LOW` | `pos_db` has exactly 1 row (`TRIAL`). No rows currently exist in `PENDING`, `INACTIVE`, `ACTIVE`, or `SUSPENDED`. |
| **B. Semantic Risk** | `HIGH` | `PENDING` is actively generated during public merchant signup (`saas.controller.ts:110`). Target Revision 4 has no `PENDING` state (all tenants start in `TRIAL`). If signup traffic runs while target enums are applied without application code coordination, signups will fail. |
| **C. Referential Risk** | `MEDIUM` | Column `tenants.status` has a default clause `'TRIAL'::"TenantStatus"`. Dropping or changing the enum requires dropping the default constraint first. |
| **D. Application Risk** | `HIGH` | `SuperadminDashboardPage.tsx` explicitly filters and approves `PENDING` tenants. Removing `PENDING` without updating the frontend merchant approval workflow will break the superadmin approval queue. |
| **E. Historical/Audit Risk** | `LOW` | Single active tenant (`Ura Coffee`) remains in `TRIAL`. |
| **F. Migration Sequencing Risk** | `HIGH` | The merchant onboarding lifecycle must be reconciled with product ownership before `TenantStatus` can be cut over. |

---

### 2.3 `InvoiceStatus`

| Risk Dimension | Level | Evidence & Rationale |
| :--- | :--- | :--- |
| **A. Data Risk** | `LOW` | `pos_db` table `saas_invoices` has 0 rows. Zero data to lose. |
| **B. Semantic Risk** | `MEDIUM` | Mapping legacy `CANCELLED` to `VOID` and `EXPIRED` to `UNCOLLECTIBLE` involves accounting distinctions (tax implications of voided invoices vs bad debt). |
| **C. Referential Risk** | `LOW` | Column `saas_invoices.status` has default `'UNPAID'::"InvoiceStatus"`. |
| **D. Application Risk** | `LOW` | No active controller currently performs queries against `saas_invoices`. |
| **E. Historical/Audit Risk** | `LOW` | No legacy invoice history exists in database. |
| **F. Migration Sequencing Risk** | `LOW` | Table can be replaced or migrated to `subscription_invoices` cleanly since no rows exist. |

---

### 2.4 `Role`

| Risk Dimension | Level | Evidence & Rationale |
| :--- | :--- | :--- |
| **A. Data Risk** | `LOW` | `pos_db` has 2 rows: 1 `ADMIN` and 1 `CASHIER`. Zero rows exist with `WAREHOUSE`. |
| **B. Semantic Risk** | `HIGH` | Target Revision 4 completely removes `WAREHOUSE` from `Role`, introducing `OWNER`, `KITCHEN`, and `WAITER`. Conflating warehouse duties with admin or cashier would violate least-privilege security. |
| **C. Referential Risk** | `MEDIUM` | Column `users.role` has default `'CASHIER'::"Role"`. |
| **D. Application Risk** | `BLOCKER` | Frontend UI (`DashboardPage.tsx`, `UsersView.tsx`, `auth.ts`) explicitly exposes "Staf Gudang (Stok & Mutasi)" (`WAREHOUSE`). Removing `WAREHOUSE` from `Role` without owner decision and frontend redesign will break staff role management and permission gates in the app. |
| **E. Historical/Audit Risk** | `LOW` | The 2 existing users (`Rudra` and `Dian Anjani`) are `ADMIN` and `CASHIER`, both preserved in Target Revision 4. |
| **F. Migration Sequencing Risk** | `HIGH` | Requires product decision on warehouse staff permissions prior to schema cutover. |

---

### 2.5 `StockMovementType`

| Risk Dimension | Level | Evidence & Rationale |
| :--- | :--- | :--- |
| **A. Data Risk** | `MEDIUM` | `pos_db` has 2 rows of `ADJUSTMENT`. If converted improperly, the distinction between increase and decrease would be lost. However, since quantities are +50 and +100, both are positive adjustments (`ADJUSTMENT_INCREASE`). |
| **B. Semantic Risk** | `HIGH` | Target Revision 4 deprecates `stock_movements` in favor of double-entry `inventory_ledgers` with `InventoryLedgerEntryType`. Direct enum replacement is invalid because the target schema redesigns the entire inventory tracking domain. |
| **C. Referential Risk** | `MEDIUM` | Foreign keys link `stock_movements` to `products` and `outlets`. |
| **D. Application Risk** | `HIGH` | Multiple controllers (`inventory.controller.ts`, `product.controller.ts`, `order.controller.ts`) create stock movements. Changing the enum without rewriting inventory business logic causes runtime exceptions during checkout and stock updates. |
| **E. Historical/Audit Risk** | `HIGH` | Inventory audit trails must preserve exact provenance. Converting or archiving `stock_movements` requires explicit ledger reconciliation so historical opening balances match closing ledger balances. |
| **F. Migration Sequencing Risk** | `HIGH` | Requires a transitional backfill strategy from `stock_movements` to `inventory_ledgers` during Expand/Backfill phases. |

---

### 2.6 `PaymentStatus`

| Risk Dimension | Level | Evidence & Rationale |
| :--- | :--- | :--- |
| **A. Data Risk** | `LOW` | `pos_db` table `orders` has 0 rows. Zero data to lose. |
| **B. Semantic Risk** | `HIGH` | In legacy schema, `orders.payment_status` conflated order fulfillment and payment status. In Target Revision 4, `OrderStatus` is strictly separated from `PaymentStatus`. Collapsing them would corrupt the state machine. |
| **C. Referential Risk** | `MEDIUM` | Default clause `'PAID'::"PaymentStatus"` exists on `orders.payment_status`. |
| **D. Application Risk** | `HIGH` | Order processing code in `order.controller.ts` writes `'PAID'` to `orders.payment_status`. Target schema moves payments to child `payments` / `payment_transactions` entities. |
| **E. Historical/Audit Risk** | `LOW` | No legacy orders exist in `pos_db`. |
| **F. Migration Sequencing Risk** | `MEDIUM` | Clean separation between order lifecycle and payment lifecycle must be implemented in application logic. |

---

### 2.7 `PaymentMethod`

| Risk Dimension | Level | Evidence & Rationale |
| :--- | :--- | :--- |
| **A. Data Risk** | `LOW` | `pos_db` table `payments` has 0 rows. |
| **B. Semantic Risk** | `LOW` | Target Revision 4 contains `CASH` and `QRIS` as exact matches, plus 5 additive methods. |
| **C. Referential Risk** | `LOW` | Column `payments.method` has no default constraint. |
| **D. Application Risk** | `MEDIUM` | Payment UI and controllers only know about `CASH` and `QRIS`. Additional methods require frontend gateway UI components. |
| **E. Historical/Audit Risk** | `LOW` | No legacy payments exist in database. |
| **F. Migration Sequencing Risk** | `LOW` | Additive enum evolution is backward-compatible. |

---

### 2.8 `PaymentTxStatus`

| Risk Dimension | Level | Evidence & Rationale |
| :--- | :--- | :--- |
| **A. Data Risk** | `LOW` | `pos_db` table `payments` has 0 rows. |
| **B. Semantic Risk** | `MEDIUM` | Legacy `SUCCESS` vs target `CAPTURED`. For card and QRIS payments, `CAPTURED` is standard; for cash payments, owner decision is needed whether cash payments produce a `PaymentTransaction` with status `CAPTURED`. |
| **C. Referential Risk** | `LOW` | Default clause `'SUCCESS'::"PaymentTxStatus"`. |
| **D. Application Risk** | `MEDIUM` | Checkout flow in `order.controller.ts` sets `status: 'SUCCESS'`. Application must be updated to write `CAPTURED`. |
| **E. Historical/Audit Risk** | `LOW` | Zero rows in database. |
| **F. Migration Sequencing Risk** | `LOW` | No existing records to backfill. |

---

## 3. Comprehensive Risk Summary

| Enum Name | Data Risk | Semantic Risk | Referential Risk | Application Risk | Historical/Audit Risk | Sequencing Risk | Overall Severity |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `PlatformRole` | LOW | MEDIUM | LOW | HIGH | LOW | MEDIUM | **MEDIUM** |
| `TenantStatus` | LOW | HIGH | MEDIUM | HIGH | LOW | HIGH | **HIGH** |
| `InvoiceStatus` | LOW | MEDIUM | LOW | LOW | LOW | LOW | **LOW** |
| `Role` | LOW | HIGH | MEDIUM | **BLOCKER** | LOW | HIGH | **BLOCKER** |
| `StockMovementType` | MEDIUM | HIGH | MEDIUM | HIGH | HIGH | HIGH | **HIGH** |
| `PaymentStatus` | LOW | HIGH | MEDIUM | HIGH | LOW | MEDIUM | **MEDIUM** |
| `PaymentMethod` | LOW | LOW | LOW | MEDIUM | LOW | LOW | **LOW** |
| `PaymentTxStatus` | LOW | MEDIUM | LOW | MEDIUM | LOW | LOW | **LOW** |

### Critical Path Blockers & Dependencies:
1. **`Role.WAREHOUSE`**: Cannot proceed with enum cutover until Owner decides how warehouse staff permissions and frontend UI will be handled.
2. **`TenantStatus.PENDING`**: Requires business rule decision on merchant onboarding flow.
3. **`StockMovementType`**: Requires architectural alignment on historical legacy data archival vs migration into the new `inventory_ledgers` table.
