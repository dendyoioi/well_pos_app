# Prompt 12.5: Real Database Enum Data Distribution Report

**Environment Evaluated:** REAL `pos_db` (`postgres://postgres:postgres@localhost:5432/pos_db`)  
**Scope:** Strictly Read-Only / Zero Mutation  
**Timestamp:** 2026-09-20  
**Evidence Source:** Live PostgreSQL system catalog and table queries executed directly against real `pos_db`  

---

## 1. Executive Summary

This artifact records the exhaustive data distribution for all 8 legacy enum-backed columns across the 7 legacy tables currently residing in the real `pos_db` PostgreSQL database.

| Column | Enum Type | Total Rows | NULL Count | Distinct Values Present in Database | Unpopulated Enum Labels in Database |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `platform_users.role` | `"PlatformRole"` | 1 | 0 | `SUPER_ADMIN` (1) | `SUPPORT_AGENT`, `FINANCE_ADMIN` |
| `tenants.status` | `"TenantStatus"` | 1 | 0 | `TRIAL` (1) | `ACTIVE`, `SUSPENDED`, `INACTIVE`, `PENDING` |
| `saas_invoices.status` | `"InvoiceStatus"` | 0 | 0 | None (table empty) | `UNPAID`, `PAID`, `CANCELLED`, `EXPIRED` |
| `users.role` | `"Role"` | 2 | 0 | `ADMIN` (1), `CASHIER` (1) | `WAREHOUSE` |
| `stock_movements.type` | `"StockMovementType"` | 2 | 0 | `ADJUSTMENT` (2) | `PURCHASE_IN`, `SALE_OUT`, `DAMAGE_OUT`, `TRANSFER_IN`, `TRANSFER_OUT` |
| `orders.payment_status` | `"PaymentStatus"` | 0 | 0 | None (table empty) | `PAID`, `UNPAID`, `CANCELLED`, `REFUNDED` |
| `payments.method` | `"PaymentMethod"` | 0 | 0 | None (table empty) | `CASH`, `QRIS` |
| `payments.status` | `"PaymentTxStatus"` | 0 | 0 | None (table empty) | `SUCCESS`, `PENDING`, `FAILED` |

Total rows across all 8 enum-backed columns: **6 rows**.  
Total NULL occurrences across all enum-backed columns: **0**.

---

## 2. Detailed Data Distribution Per Enum-Backed Column

### 2.1 `platform_users.role` (`PlatformRole`)

- **Table:** `public.platform_users`
- **Column:** `role`
- **Catalog Type:** `USER-DEFINED` (`public."PlatformRole"`)
- **Nullability:** `NOT NULL`
- **Default Value:** None
- **Total Records:** 1
- **NULL Count:** 0

#### Value Breakdown:
| Enum Value | Row Count | Percentage | Sample Records / Identifiers | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `SUPER_ADMIN` | 1 | 100.0% | `id='clxx_superadmin_01'`, `email='admin@pos.local'` | Root platform administrator |
| `SUPPORT_AGENT` | 0 | 0.0% | None | Not yet instantiated in database |
| `FINANCE_ADMIN` | 0 | 0.0% | None | Not yet instantiated in database |

#### Analysis:
- The single platform user in the database is the initial superadmin.
- While `SUPPORT_AGENT` and `FINANCE_ADMIN` are empty in data, they exist in `server/prisma/schema.prisma` and controller logic.
- Target Revision 4 replaces these with `SUPPORT` and `BILLING`. Because row count is 0, no live data transformation is required for the two diverging labels, but application code alignment is required.

---

### 2.2 `tenants.status` (`TenantStatus`)

- **Table:** `public.tenants`
- **Column:** `status`
- **Catalog Type:** `USER-DEFINED` (`public."TenantStatus"`)
- **Nullability:** `NOT NULL`
- **Default Value:** `'TRIAL'::"TenantStatus"`
- **Total Records:** 1
- **NULL Count:** 0

#### Value Breakdown:
| Enum Value | Row Count | Percentage | Sample Records / Identifiers | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `TRIAL` | 1 | 100.0% | `id='cm0l5m...'`, `name='Ura Coffee'`, `slug='ura-coffee'` | Active tenant in trial period |
| `ACTIVE` | 0 | 0.0% | None | Paid active tenant |
| `SUSPENDED` | 0 | 0.0% | None | Non-payment or policy suspension |
| `INACTIVE` | 0 | 0.0% | None | Soft-disabled tenant |
| `PENDING` | 0 | 0.0% | None | Generated in code during registration |

#### Analysis:
- Only 1 tenant exists (`Ura Coffee`) in state `TRIAL`.
- `TRIAL` is an exact match with Target Revision 4 `TenantStatus.TRIAL`.
- `PENDING` is actively produced by `server/src/controllers/saas.controller.ts:110` (`status: TenantStatus.PENDING || 'PENDING'`) when public merchants register via the signup endpoint. While no rows currently sit in `PENDING` in the database, ongoing registration traffic could create `PENDING` rows unless migrated or redirected.

---

### 2.3 `saas_invoices.status` (`InvoiceStatus`)

- **Table:** `public.saas_invoices`
- **Column:** `status`
- **Catalog Type:** `USER-DEFINED` (`public."InvoiceStatus"`)
- **Nullability:** `NOT NULL`
- **Default Value:** `'UNPAID'::"InvoiceStatus"`
- **Total Records:** 0
- **NULL Count:** 0

#### Value Breakdown:
| Enum Value | Row Count | Percentage | Notes |
| :--- | :--- | :--- | :--- |
| `UNPAID` | 0 | 0.0% | Default invoice state |
| `PAID` | 0 | 0.0% | Settled invoice |
| `CANCELLED` | 0 | 0.0% | Voided / cancelled invoice |
| `EXPIRED` | 0 | 0.0% | Timed out invoice |

#### Analysis:
- Table is completely unpopulated in `pos_db`.
- No controller currently performs writes or reads against `saas_invoices`.
- Target Revision 4 defines `SubscriptionInvoiceStatus` (`DRAFT`, `OPEN`, `PAID`, `VOID`, `UNCOLLECTIBLE`).
- Because 0 rows exist, migration risk for existing data is LOW (no live rows to convert).

---

### 2.4 `users.role` (`Role`)

- **Table:** `public.users`
- **Column:** `role`
- **Catalog Type:** `USER-DEFINED` (`public."Role"`)
- **Nullability:** `NOT NULL`
- **Default Value:** `'CASHIER'::"Role"`
- **Total Records:** 2
- **NULL Count:** 0

#### Value Breakdown:
| Enum Value | Row Count | Percentage | Sample Records / Identifiers | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `ADMIN` | 1 | 50.0% | `id='cm0l5m..._admin'`, `name='Rudra'`, `email='admin@uracoffee.com'` | Tenant administrator |
| `CASHIER` | 1 | 50.0% | `id='cm0l5m..._cashier'`, `name='Dian Anjani'` | Cashier staff |
| `WAREHOUSE` | 0 | 0.0% | None | Not yet assigned to a user |

#### Tenant Distribution:
- All 2 users belong to tenant `Ura Coffee`.

#### Analysis:
- Live rows contain only `ADMIN` and `CASHIER`, both of which are EXACT matches in Target Revision 4 `Role` (`OWNER`, `ADMIN`, `CASHIER`, `KITCHEN`, `WAITER`).
- `WAREHOUSE` has 0 rows in `pos_db`.
- Crucially, however, `WAREHOUSE` is deeply wired into frontend UI (`DashboardPage.tsx`, `UsersView.tsx`, `auth.ts`) as a first-class staff role ("Staf Gudang (Stok & Mutasi)").
- Therefore, although zero database rows currently hold `WAREHOUSE`, removing or re-mapping `WAREHOUSE` without owner consent would break frontend role selectors and permission checks.

---

### 2.5 `stock_movements.type` (`StockMovementType`)

- **Table:** `public.stock_movements`
- **Column:** `type`
- **Catalog Type:** `USER-DEFINED` (`public."StockMovementType"`)
- **Nullability:** `NOT NULL`
- **Default Value:** None
- **Total Records:** 2
- **NULL Count:** 0

#### Value Breakdown:
| Enum Value | Row Count | Percentage | Sample Records / Identifiers | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `ADJUSTMENT` | 2 | 100.0% | `id='cm0l5m..._sm1'`, `id='cm0l5m..._sm2'` | Initial opening balances for Store and Warehouse outlets |
| `PURCHASE_IN` | 0 | 0.0% | None | Receiving stock |
| `SALE_OUT` | 0 | 0.0% | None | Depleted upon order |
| `DAMAGE_OUT` | 0 | 0.0% | None | Stock loss/waste |
| `TRANSFER_IN` | 0 | 0.0% | None | Inter-outlet transfer in |
| `TRANSFER_OUT` | 0 | 0.0% | None | Inter-outlet transfer out |

#### Tenant Distribution:
- Both movements belong to tenant `Ura Coffee`.
- Movement 1: Product `Coffee Beans 1kg`, Outlet: `Store`, Type: `ADJUSTMENT`, Quantity: `+50`.
- Movement 2: Product `Coffee Beans 1kg`, Outlet: `Warehouse`, Type: `ADJUSTMENT`, Quantity: `+100`.

#### Analysis:
- Real database contains 2 historical records, both using `ADJUSTMENT`.
- Target Revision 4 replaces `stock_movements` with `inventory_ledgers` and uses `InventoryLedgerEntryType` (`PURCHASE_RECEIPT`, `SALE`, `ADJUSTMENT_INCREASE`, `ADJUSTMENT_DECREASE`, `TRANSFER_OUT`, `TRANSFER_IN`, `WASTE_SPOILAGE`, `STOCKTAKE_RECONCILIATION`, `RETURN_RESTOCK`).
- The 2 `ADJUSTMENT` records are positive adjustments (+50, +100). In Target Revision 4 semantics, these correspond to `ADJUSTMENT_INCREASE`.
- Legacy labels `PURCHASE_IN`, `SALE_OUT`, `DAMAGE_OUT`, `TRANSFER_IN`, `TRANSFER_OUT` have 0 rows in the database, but active application code in `inventory.controller.ts` and `order.controller.ts` creates them during business flows.

---

### 2.6 `orders.payment_status` (`PaymentStatus`)

- **Table:** `public.orders`
- **Column:** `payment_status`
- **Catalog Type:** `USER-DEFINED` (`public."PaymentStatus"`)
- **Nullability:** `NOT NULL`
- **Default Value:** `'PAID'::"PaymentStatus"`
- **Total Records:** 0
- **NULL Count:** 0

#### Value Breakdown:
| Enum Value | Row Count | Percentage | Notes |
| :--- | :--- | :--- | :--- |
| `PAID` | 0 | 0.0% | Completed order payment |
| `UNPAID` | 0 | 0.0% | Open / unpaid order |
| `CANCELLED` | 0 | 0.0% | Cancelled order |
| `REFUNDED` | 0 | 0.0% | Refunded payment |

#### Analysis:
- Table is completely empty in `pos_db` (0 orders).
- In the legacy schema, `orders.payment_status` conflated order fulfillment status and payment settlement status.
- In Target Revision 4, `orders.order_status` (`OrderStatus`: `DRAFT`, `CONFIRMED`, `PREPARING`, `READY`, `COMPLETED`, `CANCELLED`, `VOID`) is decoupled from `orders.payment_status` (`PaymentStatus`: `PENDING`, `AUTHORIZED`, `PARTIALLY_PAID`, `PAID`, `PARTIALLY_REFUNDED`, `REFUNDED`, `FAILED`, `CANCELLED`).
- Because 0 rows exist, there is no risk of live data truncation or data corruption during schema expansion.

---

### 2.7 `payments.method` (`PaymentMethod`)

- **Table:** `public.payments`
- **Column:** `method`
- **Catalog Type:** `USER-DEFINED` (`public."PaymentMethod"`)
- **Nullability:** `NOT NULL`
- **Default Value:** None
- **Total Records:** 0
- **NULL Count:** 0

#### Value Breakdown:
| Enum Value | Row Count | Percentage | Notes |
| :--- | :--- | :--- | :--- |
| `CASH` | 0 | 0.0% | Physical cash |
| `QRIS` | 0 | 0.0% | Indonesian standardized QR code |

#### Analysis:
- Table is unpopulated in `pos_db` (0 payments).
- Target Revision 4 `PaymentMethod` contains: `CASH`, `QRIS`, `CREDIT_CARD`, `DEBIT_CARD`, `BANK_TRANSFER`, `EWALLET`, `VOUCHER`.
- The two legacy methods (`CASH` and `QRIS`) are EXACT subsets of Target Revision 4.
- Zero rows exist in the database, eliminating immediate backfill data risks.

---

### 2.8 `payments.status` (`PaymentTxStatus`)

- **Table:** `public.payments`
- **Column:** `status`
- **Catalog Type:** `USER-DEFINED` (`public."PaymentTxStatus"`)
- **Nullability:** `NOT NULL`
- **Default Value:** `'SUCCESS'::"PaymentTxStatus"`
- **Total Records:** 0
- **NULL Count:** 0

#### Value Breakdown:
| Enum Value | Row Count | Percentage | Notes |
| :--- | :--- | :--- | :--- |
| `SUCCESS` | 0 | 0.0% | Legacy terminal settlement status |
| `PENDING` | 0 | 0.0% | Transaction initiated / awaiting response |
| `FAILED` | 0 | 0.0% | Gateway or payment failure |

#### Analysis:
- Table is unpopulated in `pos_db` (0 payments).
- Target Revision 4 replaces `payments.status` with `payment_transactions.status` typed by `PaymentTransactionStatus` (`PENDING`, `AUTHORIZED`, `CAPTURED`, `FAILED`, `CANCELLED`, `REFUNDED`).
- Legacy `SUCCESS` corresponds semantically to `CAPTURED` for completed transactions, but requires owner sign-off.
- Zero rows exist in the database.

---

## 3. Data Integrity & Anomaly Checks

1. **Orphan / Invalid Text Values:**
   - Because all 8 columns in PostgreSQL are enforced by native `USER-DEFINED` enum catalog types, no text values outside the defined enum domains exist.
2. **Nullable Infiltration:**
   - None of the 8 columns are nullable (`is_nullable = 'NO'`).
   - All columns have 0 NULL values.
3. **Archived / Inactive Data:**
   - Neither `platform_users`, `tenants`, `users`, nor `stock_movements` currently utilize a `deleted_at` or soft-delete column in the legacy schema.
   - All 6 rows present in the database represent active live data.
