# Prompt 12.5: Owner Decision Register

**Environment Evaluated:** REAL `pos_db` (`postgres://postgres:postgres@localhost:5432/pos_db`)  
**Scope:** Strictly Read-Only / Zero Mutation  
**Timestamp:** 2026-09-20  
**Target Specification:** Target Database Schema Revision 4 (`ARCH-2026-09-DB-SCHEMA-04`) in `/docs/architecture/04_TARGET_DATABASE_SCHEMA.md`  
**Status:** Awaiting Architecture Owner Review  

---

## 1. Purpose & Scope

This register documents architectural, domain, and product decisions that cannot and must not be made autonomously by the AI assistant. Each item represents a semantic divergence between the legacy production implementation and Target Database Schema Revision 4.

No DDL, data mutation, or cutover may occur for these enums until the Owner renders a formal determination for each item.

---

## 2. Decision Register Table

| Decision ID | Enum / Domain | Current Legacy State | Target Rev 4 State | Core Dilemma / Architectural Conflict | Options for Owner | Recommended Option |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ODR-01** | `PlatformRole` | `SUPPORT_AGENT`, `FINANCE_ADMIN` (0 rows in db, present in code) | `SUPPORT`, `BILLING` | Nomenclature mismatch. Does `BILLING` have narrower scope than `FINANCE_ADMIN`? Does `SUPPORT` retain full platform support capabilities? | **A.** Accept rename (`SUPPORT_AGENT`→`SUPPORT`, `FINANCE_ADMIN`→`BILLING`).<br>**B.** Keep legacy labels in Target Revision 4.<br>**C.** Deprecate granular platform roles and retain only `SUPER_ADMIN`. | **Option A** (Accept rename; update Prisma and platform-auth middleware). |
| **ODR-02** | `TenantStatus` | `PENDING` (0 rows in db, generated in `saas.controller.ts:110`) | No `PENDING` label; uses `TRIAL`, `ACTIVE`, `SUSPENDED`, `CANCELLED` | Self-service signup generates `PENDING` awaiting approval. In Rev 4, tenants immediately begin in `TRIAL`. Eliminating `PENDING` requires altering the merchant onboarding lifecycle. | **A.** Add `PENDING` to Revision 4 `TenantStatus` enum.<br>**B.** Eliminate `PENDING` and set new signups directly to `TRIAL`.<br>**C.** Model pending verification via a separate boolean flag (e.g. `is_verified`). | **Option B** (New signups enter `TRIAL` directly, simplifying the onboarding funnel). |
| **ODR-03** | `InvoiceStatus` | `CANCELLED`, `EXPIRED` (0 rows in db) | `DRAFT`, `UNPAID`, `PAID`, `VOID` | In legacy invoicing, an invoice could be `CANCELLED` or `EXPIRED`. Rev 4 uses `DRAFT`, `UNPAID`, `PAID`, `VOID`. | **A.** Map `CANCELLED` and `EXPIRED` → `VOID`.<br>**B.** Add `CANCELLED` and `EXPIRED` to Target Rev 4 `InvoiceStatus`.<br>**C.** Retain legacy labels in a separate legacy archive table. | **Option A** (Map to `VOID` following standard accounting practices). |
| **ODR-04** | `Role` | `WAREHOUSE` (0 rows in db, active in frontend UI) | `OWNER`, `ADMIN`, `SUPERVISOR`, `CASHIER`, `KITCHEN`, `WAITER` | Target Revision 4 omitted `WAREHOUSE`. The frontend specifically features "Staf Gudang (Stok & Mutasi)" with dedicated permissions for inventory mutation. | **A.** Add `WAREHOUSE` back into Target Revision 4 `Role`.<br>**B.** Map warehouse staff to `ADMIN` (violates least privilege).<br>**C.** Deprecate `WAREHOUSE` and move inventory permissions into a granular RBAC table. | **Option A** (Add `WAREHOUSE` to Target Revision 4 `Role` to prevent breaking existing warehouse UI). |
| **ODR-05** | `StockMovementType` | `ADJUSTMENT` (2 rows in `pos_db`), `PURCHASE_IN`, `SALE_OUT`, `DAMAGE_OUT`, `TRANSFER_IN`, `TRANSFER_OUT` | `SALE`, `PURCHASE`, `TRANSFER_IN`, `TRANSFER_OUT`, `OPNAME_ADJUSTMENT`, `RETURN`, `WASTE`, `VOID`, `PRODUCTION_CONSUMPTION`, `PRODUCTION_OUTPUT` in `inventory_ledgers` | Legacy `stock_movements` is replaced by double-entry `inventory_ledgers`. How should historical stock movements (the 2 opening balance adjustments in `pos_db`) be preserved? | **A.** Migrate historical movements into `inventory_ledgers` (convert `ADJUSTMENT` to `OPNAME_ADJUSTMENT` with positive `quantityDelta`).<br>**B.** Retain `stock_movements` as read-only legacy archive table and start `inventory_ledgers` fresh.<br>**C.** Discard legacy stock movement history. | **Option A** (Backfill into `inventory_ledgers` as `OPNAME_ADJUSTMENT` with baseline provenance). |
| **ODR-06** | `PaymentTxStatus` | `SUCCESS` (0 rows in db, used in checkout code) | `PENDING`, `CAPTURED`, `FAILED`, `REFUNDED`, `VOIDED` | In digital payments, `CAPTURED` is standard. For physical cash transactions, does the payment transaction record use `CAPTURED`? | **A.** Treat legacy `SUCCESS` as `CAPTURED` for all payment transactions.<br>**B.** Introduce `SETTLED` or `COMPLETED` for non-card transactions.<br>**C.** Separate gateway transactions from physical cash logs. | **Option A** (Standardize on `CAPTURED` across all tender types in the transaction ledger). |

---

## 3. Deep Dive on Critical Decisions

### 3.1 ODR-04: Treatment of `Role.WAREHOUSE`
- **Frontend Evidence:** `client/src/pages/DashboardPage.tsx:112`, `client/src/pages/admin/UsersView.tsx:157`, `client/src/types/auth.ts:5` explicitly define `WAREHOUSE` as:
  ```ts
  { value: 'WAREHOUSE', label: 'Staf Gudang (Stok & Mutasi)' }
  ```
- **Backend Evidence:** In `server/prisma/schema.prisma:175`, `Role` has `ADMIN`, `CASHIER`, `WAREHOUSE`.
- **Target Rev 4 Discrepancy:** `docs/architecture/04_TARGET_DATABASE_SCHEMA.md:891` lists:
  ```prisma
  enum Role {
    OWNER
    ADMIN
    SUPERVISOR
    CASHIER
    KITCHEN
    WAITER
  }
  ```
- **Technical Risk:** If `WAREHOUSE` is omitted during enum migration, existing frontend code rendering user management options will fail or trigger enum validation errors when selecting warehouse staff.
- **Action Required:** Architecture Owner must approve adding `WAREHOUSE` to Revision 4 `Role` or approve removing warehouse functionality from the frontend.

### 3.2 ODR-02: Treatment of `TenantStatus.PENDING`
- **Application Evidence:** `server/src/controllers/saas.controller.ts:110` writes:
  ```ts
  status: TenantStatus.PENDING || 'PENDING'
  ```
- **Target Rev 4 Discrepancy:** `docs/architecture/04_TARGET_DATABASE_SCHEMA.md:859` lists:
  ```prisma
  enum TenantStatus {
    TRIAL
    ACTIVE
    SUSPENDED
    CANCELLED
  }
  ```
- **Technical Risk:** Merchant signup endpoint will fail with a PostgreSQL enum violation if it attempts to write `'PENDING'` into a column typed by Target Revision 4 `TenantStatus`.
- **Action Required:** Architecture Owner must decide whether new tenants start in `TRIAL` directly upon signup or whether `PENDING` must be retained in `TenantStatus`.

---

## 4. Next Steps & Prerequisites

1. Present this register to the Architecture Owner.
2. Record the Owner's binding determinations in the architecture decision log.
3. Incorporate approved decisions into the forthcoming Prompt 13 (Expand Phase DDL) preparation.
4. **NO CODE OR SCHEMA MUTATION IS PERMITTED PRIOR TO OWNER APPROVAL.**
