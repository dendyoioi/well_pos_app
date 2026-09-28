# Prompt 12.5-C: Enum Baseline & Target Contract Reconciliation

**Execution Stage:** Prompt 12.5-C — Enum Baseline & Target Contract Reconciliation  
**Environment Evaluated:** REAL `pos_db` (`postgres://postgres:postgres@localhost:5432/pos_db`)  
**Mode:** Strictly Read-Only / Evidence Reconciliation Only / Zero Database Mutation  
**Date:** 2026-09-20  
**Preceding Gate:** Prompt 12.5 = BLOCKED / OWNER REVIEW REQUIRED  

---

## 1. Executive Summary

This artifact performs a rigorous, evidence-grounded reconciliation of historical documentation discrepancies identified during the Prompt 12.5 review.

Specifically, it reconciles:
1. The **`TenantStatus` baseline discrepancy** between earlier documentation mentioning `INACTIVE` vs the actual PostgreSQL catalog containing `['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'PENDING']`.
2. The **`InvoiceStatus` vs `SubscriptionInvoiceStatus` discrepancy** where stale/foreign billing nomenclature was mistakenly introduced into analysis text, whereas canonical Target Database Schema Revision 4 defines `enum InvoiceStatus { DRAFT, UNPAID, PAID, VOID }`.
3. The strict demarcation between **Exact Vocabulary Matches**, **Mapping Candidates (Requiring Owner Decision)**, and **Approved Migration Mappings**.

Zero database mutations (DDL or DML) were executed. Canonical Target Database Schema Revision 4 remains 100% untouched.

---

## 2. Previous Prompt 12.5 Blocker Context

During Prompt 12.5 review, two primary documentation anomalies were flagged:
- **Discrepancy A (`TenantStatus`):** Some narrative text in Prompt 12.5 asserted that the legacy catalog contained `ACTIVE, SUSPENDED, INACTIVE, TRIAL, PENDING`, conflicting with `10_PROMPT_12_4_2_ENUM_CONTRACT_INVENTORY.md` which recorded `TRIAL, ACTIVE, SUSPENDED, CANCELLED, PENDING`.
- **Discrepancy B (`InvoiceStatus`):** Section 2.3 of `11_PROMPT_12_5_ENUM_DATA_DISTRIBUTION.md` introduced `SubscriptionInvoiceStatus (DRAFT, OPEN, PAID, VOID, UNCOLLECTIBLE)`, which contradicted canonical Target Revision 4 (`ARCH-2026-09-DB-SCHEMA-04:878`) specifying `enum InvoiceStatus { DRAFT, UNPAID, PAID, VOID }`.

Prompt 12.5-C resolves both discrepancies by establishing the live PostgreSQL catalog of `pos_db` and the canonical Target Revision 4 specification as the authoritative ground truth.

---

## 3. Authoritative Source Hierarchy

All reconciliation in this document strictly adheres to the mandated hierarchy:
1. **Tier 1 (Catalog & Source Ground Truth):** Existing source code + live PostgreSQL catalog queries from real `pos_db` (`pg_type`, `pg_enum`, `information_schema.columns`).
2. **Tier 2 (Canonical Target Architecture):** Approved Target Database Schema Revision 4 (`ARCH-2026-09-DB-SCHEMA-04`) in `docs/architecture/04_TARGET_DATABASE_SCHEMA.md`.
3. **Tier 3 (Architecture Decisions):** Approved ADRs (ADR-001 through ADR-005).
4. **Tier 4 (Validated Historical Artifacts):** Prior validated migration artifacts (`10_PROMPT_12_4_2_ENUM_CONTRACT_INVENTORY.md`, etc.).
5. **Tier 5 (Intermediate Analysis):** Prompt 12.5 narrative artifacts.
6. **Tier 6 (Generated Analysis):** Unverified assistant inferences.

---

## 4. Live PostgreSQL Baseline Ground Truth (`pos_db`)

Extracted via direct `psql` query against `pos_db` (`SELECT t.typname, e.enumlabel, e.enumsortorder FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public'`):

| Enum Type | Exact Ordered Labels in `pos_db` | Count | Backing Table.Column | Default Constraint | Nullable | Live Rows |
| :--- | :--- | :-: | :--- | :--- | :-: | :-: |
| `PlatformRole` | `SUPER_ADMIN` (1), `SUPPORT_AGENT` (2), `FINANCE_ADMIN` (3) | 3 | `platform_users.role` | `'SUPER_ADMIN'::"PlatformRole"` | `NO` | 1 (`SUPER_ADMIN`) |
| `TenantStatus` | `TRIAL` (1), `ACTIVE` (2), `SUSPENDED` (3), `CANCELLED` (4), `PENDING` (5) | 5 | `tenants.status` | `'TRIAL'::"TenantStatus"` | `NO` | 1 (`TRIAL`) |
| `InvoiceStatus` | `UNPAID` (1), `PAID` (2), `CANCELLED` (3), `EXPIRED` (4) | 4 | `saas_invoices.status` | `'UNPAID'::"InvoiceStatus"` | `NO` | 0 |
| `Role` | `ADMIN` (1), `SUPERVISOR` (2), `WAREHOUSE` (3), `CASHIER` (4) | 4 | `users.role` | `'CASHIER'::"Role"` | `NO` | 2 (`ADMIN`: 1, `CASHIER`: 1) |
| `StockMovementType` | `PURCHASE_IN` (1), `SALE_OUT` (2), `DAMAGE_OUT` (3), `TRANSFER_IN` (4), `TRANSFER_OUT` (5), `ADJUSTMENT` (6) | 6 | `stock_movements.type` | None | `NO` | 2 (`ADJUSTMENT`: 2) |
| `PaymentStatus` | `PAID` (1), `CANCELLED` (2), `REFUNDED` (3) | 3 | `orders.payment_status` | `'PAID'::"PaymentStatus"` | `NO` | 0 |
| `PaymentMethod` | `CASH` (1), `QRIS` (2) | 2 | `payments.method` | None | `NO` | 0 |
| `PaymentTxStatus` | `SUCCESS` (1), `PENDING` (2), `FAILED` (3) | 3 | `payments.status` | `'SUCCESS'::"PaymentTxStatus"` | `NO` | 0 |

- Total enum types audited: **8**
- Total enum labels across 8 types in `pos_db`: **30**
- Total live database rows across all 8 enum columns: **6**
- Total NULL occurrences: **0**

---

## 5. `TenantStatus` Reconciliation

### 5.1 The Discrepancy
Earlier documentation exhibited conflicting representations:
- **Claim A (Erroneous):** Legacy catalog contains `ACTIVE, SUSPENDED, INACTIVE, TRIAL, PENDING`.
- **Claim B (Factual):** Legacy catalog contains `TRIAL, ACTIVE, SUSPENDED, CANCELLED, PENDING`.

### 5.2 Authoritative Evidence from `pos_db`
A direct catalog query confirms:
```sql
SELECT enumlabel, enumsortorder 
FROM pg_enum 
WHERE enumtypid = 'public."TenantStatus"'::regtype 
ORDER BY enumsortorder;
```
Result:
1. `TRIAL`
2. `ACTIVE`
3. `SUSPENDED`
4. `CANCELLED`
5. `PENDING`

### 5.3 Provenance & Resolution of `INACTIVE`
- `INACTIVE` **does not exist** in `pos_db` `pg_enum`.
- `INACTIVE` **does not exist** in `server/prisma/schema.prisma`.
- `INACTIVE` **does not exist** in any controller, service, or frontend file across the repository.
- `INACTIVE` was mistakenly imported into the Prompt 12.5 prompt draft text from an obsolete pre-audit scratchpad.
- **Resolution:** The claim that `INACTIVE` is a legacy enum label is formally retracted. The factual legacy baseline is `['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'PENDING']`.

### 5.4 Comparison with Target Revision 4
- Target Revision 4 (`04_TARGET_DATABASE_SCHEMA.md:859`): `['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED']`.
- **Finding:** The first 4 labels (`TRIAL`, `ACTIVE`, `SUSPENDED`, `CANCELLED`) are **100% EXACT MATCHES**.
- The sole divergence is the legacy label `PENDING`, which is used in `server/src/controllers/saas.controller.ts:110` during merchant registration.
- Currently, 0 rows in `pos_db` hold `PENDING` (the 1 existing tenant `Ura Coffee` is in `TRIAL`).

---

## 6. `InvoiceStatus` Reconciliation

### 6.1 The Discrepancy
- **Claim A (Erroneous):** Target Revision 4 defines `SubscriptionInvoiceStatus` (`DRAFT`, `OPEN`, `PAID`, `VOID`, `UNCOLLECTIBLE`).
- **Claim B (Factual):** Target Revision 4 defines `enum InvoiceStatus { DRAFT, UNPAID, PAID, VOID }`.

### 6.2 Authoritative Evidence from Target Revision 4
Direct inspection of `docs/architecture/04_TARGET_DATABASE_SCHEMA.md` lines 878-883 confirms:
```prisma
enum InvoiceStatus {
  DRAFT
  UNPAID
  PAID
  VOID
}
```
Inspection of `server/prisma/schema.prisma` lines 774-779 also confirms:
```prisma
enum InvoiceStatus {
  DRAFT
  UNPAID
  PAID
  VOID
}
```

### 6.3 Provenance & Resolution of `SubscriptionInvoiceStatus`
- The name `SubscriptionInvoiceStatus` and labels `OPEN`, `UNCOLLECTIBLE` do not exist in Target Database Schema Revision 4, nor in the Prisma schema.
- They originated in `11_PROMPT_12_5_ENUM_DATA_DISTRIBUTION.md` as an inadvertent conceptual borrowing from standard Stripe billing terminology.
- **Resolution:** The term `SubscriptionInvoiceStatus` is declared stale and foreign. The canonical Target Revision 4 enum name is `InvoiceStatus` with exact labels `['DRAFT', 'UNPAID', 'PAID', 'VOID']`.
- Live `pos_db` legacy `InvoiceStatus` catalog contains `['UNPAID', 'PAID', 'CANCELLED', 'EXPIRED']`.
- Live row count in `saas_invoices`: **0 rows**.

---

## 7. Target Contract Verification Ground Truth

The canonical enum specifications from `04_TARGET_DATABASE_SCHEMA.md:850-1005` are:

```prisma
enum PlatformRole {
  SUPER_ADMIN
  SUPPORT
  BILLING
}

enum TenantStatus {
  TRIAL
  ACTIVE
  SUSPENDED
  CANCELLED
}

enum InvoiceStatus {
  DRAFT
  UNPAID
  PAID
  VOID
}

enum Role {
  OWNER
  ADMIN
  SUPERVISOR
  CASHIER
  KITCHEN
  WAITER
}

enum StockMovementType {
  SALE
  PURCHASE
  TRANSFER_IN
  TRANSFER_OUT
  OPNAME_ADJUSTMENT
  RETURN
  WASTE
  VOID
  PRODUCTION_CONSUMPTION
  PRODUCTION_OUTPUT
}

enum OrderStatus {
  DRAFT
  CONFIRMED
  IN_PROGRESS
  READY
  COMPLETED
  CANCELLED
  VOIDED
}

enum PaymentStatus {
  UNPAID
  PARTIALLY_PAID
  PAID
  PARTIALLY_REFUNDED
  REFUNDED
}

enum PaymentMethod {
  CASH
  QRIS
  CREDIT_CARD
  DEBIT_CARD
  BANK_TRANSFER
  EWALLET
  VOUCHER
}

enum PaymentTxStatus {
  PENDING
  CAPTURED
  FAILED
  REFUNDED
  VOIDED
}
```

---

## 8. Application Dependency Reconciliation

Live code dependency audit confirms two critical application couplings:

1. **`Role.WAREHOUSE` Application Coupling:**
   - `client/src/pages/DashboardPage.tsx:112`: Role check for `WAREHOUSE`.
   - `client/src/pages/admin/UsersView.tsx:157`: Explicit option `{ value: 'WAREHOUSE', label: 'Staf Gudang (Stok & Mutasi)' }`.
   - `client/src/types/auth.ts:5`: `export type Role = 'ADMIN' | 'CASHIER' | 'WAREHOUSE';`.
   - `pos_db` catalog: `Role` has `ADMIN`, `SUPERVISOR`, `WAREHOUSE`, `CASHIER`.
   - **Target Revision 4:** Has `OWNER`, `ADMIN`, `SUPERVISOR`, `CASHIER`, `KITCHEN`, `WAITER` (omits `WAREHOUSE`).
   - **Status:** Critical application dependency. Must remain documented as a blocker until Owner renders a decision.

2. **`TenantStatus.PENDING` Application Coupling:**
   - `server/src/controllers/saas.controller.ts:110`: Actively writes `status: TenantStatus.PENDING || 'PENDING'` during merchant self-registration.
   - `client/src/pages/superadmin/SuperadminDashboardPage.tsx`: Manages tenant verification queue on `PENDING`.
   - `pos_db` catalog: `TenantStatus` contains `PENDING` at sort order 5.
   - **Target Revision 4:** Omits `PENDING` (tenants start in `TRIAL`).
   - **Status:** Active application dependency. Requires Owner decision on merchant onboarding lifecycle.

---

## 9. Artifact Provenance & Conflict Resolution Matrix

| Discrepancy | Source Claiming Discrepancy | Live / Canonical Source | Factual Reality | Resolution |
| :--- | :--- | :--- | :--- | :--- |
| `TenantStatus` includes `INACTIVE` | `PROMPT_12_5_ENUM_VOCABULARY_MIGRATION_STRATEGY_DATA_DEPENDENCY_REVIEW.md:71`, `11_PROMPT_12_5_ENUM_VOCABULARY_ANALYSIS.md:23` | `pos_db` `pg_enum`, `server/prisma/schema.prisma` | Catalog contains `TRIAL, ACTIVE, SUSPENDED, CANCELLED, PENDING`. `INACTIVE` does not exist anywhere. | Retract `INACTIVE`. Document `pos_db` catalog truth: `TRIAL, ACTIVE, SUSPENDED, CANCELLED, PENDING`. |
| `SubscriptionInvoiceStatus` as target enum | `11_PROMPT_12_5_ENUM_DATA_DISTRIBUTION.md:103` | `04_TARGET_DATABASE_SCHEMA.md:878`, `server/prisma/schema.prisma:774` | Target enum is `InvoiceStatus` with labels `DRAFT, UNPAID, PAID, VOID`. `SubscriptionInvoiceStatus` does not exist. | Retract `SubscriptionInvoiceStatus` as stale/foreign terminology. Re-anchor to canonical `InvoiceStatus`. |
| `Role.SUPERVISOR` legacy existence | Omitted from some legacy enum listings | `pos_db` `pg_enum` (`Role|SUPERVISOR|2`) | `SUPERVISOR` is pre-existing in `pos_db` at sort order 2. | Record `SUPERVISOR` as an EXACT match between `pos_db` and Target Rev 4. |
| `PaymentStatus.UNPAID` legacy catalog | Assumed present in legacy catalog | `pos_db` `pg_enum` (`PaymentStatus` has only `PAID, CANCELLED, REFUNDED`) | Legacy catalog has only 3 labels (`PAID, CANCELLED, REFUNDED`). `UNPAID` is additive in Target Rev 4. | Document exact 3-label legacy catalog baseline. |

---

## 10. Exact vs Semantic Mapping Classification

In accordance with Section 3.3 of Prompt 12.5-C, all mappings are strictly categorized:

| Legacy Label (`pos_db`) | Target Label (Rev 4) | Classification | Governance Status |
| :--- | :--- | :--- | :--- |
| `PlatformRole.SUPER_ADMIN` | `PlatformRole.SUPER_ADMIN` | `EXACT` | Automatic / Verified |
| `PlatformRole.SUPPORT_AGENT` | `PlatformRole.SUPPORT` | `MAPPING CANDIDATE` | **OWNER DECISION REQUIRED** |
| `PlatformRole.FINANCE_ADMIN` | `PlatformRole.BILLING` | `MAPPING CANDIDATE` | **OWNER DECISION REQUIRED** |
| `TenantStatus.TRIAL` | `TenantStatus.TRIAL` | `EXACT` | Automatic / Verified |
| `TenantStatus.ACTIVE` | `TenantStatus.ACTIVE` | `EXACT` | Automatic / Verified |
| `TenantStatus.SUSPENDED` | `TenantStatus.SUSPENDED` | `EXACT` | Automatic / Verified |
| `TenantStatus.CANCELLED` | `TenantStatus.CANCELLED` | `EXACT` | Automatic / Verified |
| `TenantStatus.PENDING` | *Undetermined* | `MAPPING CANDIDATE` | **OWNER DECISION REQUIRED** |
| `InvoiceStatus.UNPAID` | `InvoiceStatus.UNPAID` | `EXACT` | Automatic / Verified |
| `InvoiceStatus.PAID` | `InvoiceStatus.PAID` | `EXACT` | Automatic / Verified |
| `InvoiceStatus.CANCELLED` | `InvoiceStatus.VOID` | `MAPPING CANDIDATE` | **OWNER DECISION REQUIRED** |
| `InvoiceStatus.EXPIRED` | `InvoiceStatus.VOID` | `MAPPING CANDIDATE` | **OWNER DECISION REQUIRED** |
| `Role.ADMIN` | `Role.ADMIN` | `EXACT` | Automatic / Verified |
| `Role.SUPERVISOR` | `Role.SUPERVISOR` | `EXACT` | Automatic / Verified |
| `Role.CASHIER` | `Role.CASHIER` | `EXACT` | Automatic / Verified |
| `Role.WAREHOUSE` | *None* | `LEGACY UNMAPPED` | **OWNER DECISION REQUIRED** |
| `StockMovementType.TRANSFER_IN`| `StockMovementType.TRANSFER_IN` | `EXACT` | Automatic / Verified |
| `StockMovementType.TRANSFER_OUT`| `StockMovementType.TRANSFER_OUT`| `EXACT` | Automatic / Verified |
| `StockMovementType.PURCHASE_IN`| `StockMovementType.PURCHASE` | `MAPPING CANDIDATE` | Technical transform / Requires Review |
| `StockMovementType.SALE_OUT` | `StockMovementType.SALE` | `MAPPING CANDIDATE` | Technical transform / Requires Review |
| `StockMovementType.DAMAGE_OUT` | `StockMovementType.WASTE` | `MAPPING CANDIDATE` | Technical transform / Requires Review |
| `StockMovementType.ADJUSTMENT` | `StockMovementType.OPNAME_ADJUSTMENT` | `MAPPING CANDIDATE` | Technical transform / Requires Review |
| `PaymentStatus.PAID` | `PaymentStatus.PAID` | `EXACT` | Automatic / Verified |
| `PaymentStatus.REFUNDED` | `PaymentStatus.REFUNDED` | `EXACT` | Automatic / Verified |
| `PaymentStatus.CANCELLED` | `OrderStatus.CANCELLED` | `DECOUPLED CANDIDATE` | Architecture Review |
| `PaymentMethod.CASH` | `PaymentMethod.CASH` | `EXACT` | Automatic / Verified |
| `PaymentMethod.QRIS` | `PaymentMethod.QRIS` | `EXACT` | Automatic / Verified |
| `PaymentTxStatus.PENDING` | `PaymentTxStatus.PENDING` | `EXACT` | Automatic / Verified |
| `PaymentTxStatus.FAILED` | `PaymentTxStatus.FAILED` | `EXACT` | Automatic / Verified |
| `PaymentTxStatus.SUCCESS` | `PaymentTxStatus.CAPTURED` | `MAPPING CANDIDATE` | **OWNER DECISION REQUIRED** |

---

## 11. Unresolved Owner Decisions

The following items remain strictly **OPEN** awaiting Project Owner determination:
- **ODR-01:** PlatformRole rename (`SUPPORT_AGENT`→`SUPPORT`, `FINANCE_ADMIN`→`BILLING`).
- **ODR-02:** TenantStatus onboarding lifecycle (`PENDING` vs direct `TRIAL`).
- **ODR-03:** InvoiceStatus settlement mapping (`CANCELLED` / `EXPIRED` → `VOID`).
- **ODR-04:** Role domain definition: Addition of `WAREHOUSE` to Target Revision 4 `Role` to preserve frontend UI.
- **ODR-05:** StockMovement historical record backfill into `inventory_ledgers`.
- **ODR-06:** PaymentTxStatus transaction ledger standardization (`SUCCESS` → `CAPTURED`).

---

## 12. Migration Implications

1. **No Data Loss on Live Rows:**
   - Real `pos_db` contains only 6 enum-backed rows:
     - 1 `platform_users` (`SUPER_ADMIN` — `EXACT`)
     - 1 `tenants` (`TRIAL` — `EXACT`)
     - 2 `users` (`ADMIN`, `CASHIER` — `EXACT`)
     - 2 `stock_movements` (`ADJUSTMENT` with positive deltas +50, +100 — maps to `OPNAME_ADJUSTMENT`)
2. **Zero Rows in Risky Legacy States:**
   - No rows hold `PENDING`, `WAREHOUSE`, `CANCELLED`, `EXPIRED`, `UNPAID`, or `FAILED`.
3. **Application Decoupling is the Primary Workstream:**
   - Code adjustments (frontend role selectors, onboarding signup endpoint) represent the real implementation boundary, rather than complex database row transformations.

---

## 13. Explicit Non-Actions

During Prompt 12.5-C execution:
- **NO** DDL was executed against `pos_db`.
- **NO** DML was executed against `pos_db`.
- **NO** enum types were created, dropped, or altered.
- **NO** Prisma schema changes were made.
- **NO** migration SQL files were modified.
- **NO** Target Database Schema Revision 4 changes were made.
- **NO** ODR decisions were made on behalf of the Owner.
- **NO** migration phases (Expand, Backfill, Dual-Write, Cutover, Contract) were executed.
- Prompt 13 was **NOT** authorized.

---

## 14. Final Gate Verdict

```text
PROMPT 12.5-C FINAL GATE
=========================

C-01 No Database Mutation: PASS
C-02 TenantStatus Ground Truth: PASS
C-03 InvoiceStatus Ground Truth: PASS
C-04 Target Contract Ground Truth: PASS
C-05 No Silent Reconciliation: PASS
C-06 Mapping Separation: PASS
C-07 Application Coupling: PASS
C-08 Evidence Reproducibility: PASS
C-09 Canonical Contract Preservation: PASS
C-10 Owner Decision Separation: PASS
C-11 No Prompt 13 Authorization: PASS
C-12 Internal Consistency: PASS

FINAL GATE:
READY FOR OWNER REVIEW
```
