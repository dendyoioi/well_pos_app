# 10 — PROMPT 12 EXECUTION GUARDRAILS, SAFETY CONTROLS, & ROLLBACK PROTOCOL

**Project:** Well POS Multi-Tenant SaaS Platform  
**Document ID:** `DOC-VAL-10-PROMPT-12-EXECUTION-GUARDRAILS`  
**Execution Stage:** Prompt 12 — Database Migration Scripting & Expand-Phase DDL Implementation  
**Preceding Gate:** Prompt 11.3 = `GO WITH CONDITIONS` (Project Owner Approved)  
**Date:** September 19, 2026  
**Status:** **AUTHORITATIVE SAFETY GUARDRAILS & ROLLBACK PROTOCOL**  
**Live Data Status:** `LIVE DATA COUNTS NOT VERIFIED — LIVE DATA ACCESS NOT AVAILABLE`

---

## 1. Safety Guardrails & Static Inspection Gates

To prevent accidental data corruption, unauthorized production mutations, or premature structural cutover, all migration artifacts must satisfy the following **Automated Safety Guardrails**:

### 1.1 Forbidden Operations Scan (Expand Phase)
The Expand DDL migration script (`pos_apps/server/prisma/migrations/20260919000000_expand_phase_ddl/migration.sql`) is subjected to strict automated scanning. The presence of any of the following triggers an **IMMEDIATE ABORT**:
- `DROP TABLE`
- `DROP COLUMN`
- `TRUNCATE`
- `DELETE FROM`

### 1.2 Prohibited Schema Antipatterns
The schema and generated SQL must NOT contain:
1. `InventoryBalance.isNegativeBalance` (Negative stock flag is restricted strictly to `InventoryLedger.isNegativeBalance`).
2. `mustChangePin`, `forcePinReset`, or `pinResetRequired` on the `User` model (Credential provisioning for `pin IS NULL` users follows approved operational procedures, not synthetic schema flags).
3. `UserOutletAssignment` or multi-outlet join table (Phase 1 retains direct `User.outletId?`).
4. Unintended composite foreign keys on the database level.
5. Premature removal of legacy tables (`outlet_products`, `payments`, `hold_orders`, `stock_movements`) or legacy columns (`products.basePrice`, `products.sku`, `users.pin`).

---

## 2. PostgreSQL Transactional DDL Boundaries

PostgreSQL natively supports **Transactional DDL** for almost all structural modifications (table creation, column additions, index creation).

```sql
BEGIN;

-- 1. Create Enums
-- 2. Create New Tables
-- 3. Add Nullable Transition Columns
-- 4. Create Supporting Indexes & Constraints

COMMIT;
```

### Atomicity Guarantee:
- If a syntax error, lock timeout, or constraint conflict occurs at any point during DDL execution, PostgreSQL issues a complete `ROLLBACK`.
- The database catalog returns 100% intact to its pre-migration state.

---

## 3. Rollback & Abort Protocol by Lifecycle Phase

The ability to roll back changes differs fundamentally between the **Expand DDL Phase** and the **Backfill / Cutover Phases**:

```
+-------------------+------------------------------------+---------------------------------------------+
| Lifecycle Phase   | Reversibility Status               | Rollback Procedure                          |
+-------------------+------------------------------------+---------------------------------------------+
| 1. EXPAND         | 100% REVERSIBLE                    | Execute 01_expand_phase_down.sql            |
|                   | (Zero data loss risk)              | Drops new tables & transition columns only  |
+-------------------+------------------------------------+---------------------------------------------+
| 2. BACKFILL       | LOGICALLY REVERSIBLE               | Truncate target tables; legacy intact       |
|                   | (Data transformation boundary)     | Re-run backfill after bug fix               |
+-------------------+------------------------------------+---------------------------------------------+
| 3. DUAL-WRITE     | OPERATIONALLY REVERSIBLE           | Disable dual-write flags in application     |
|                   | (Legacy tables still receive data) | System continues on legacy tables           |
+-------------------+------------------------------------+---------------------------------------------+
| 4. CUTOVER        | CONTROLLED TRANSITION              | Pre-cutover dry-run & reconciliation test   |
|                   | (Read traffic switched)            | Failover back to legacy readers if < 100%   |
+-------------------+------------------------------------+---------------------------------------------+
| 5. CONTRACT       | IRREVERSIBLE                       | Requires point-in-time database restore     |
|                   | (Legacy tables & columns dropped)  | Only executed after 30-day soak period      |
+-------------------+------------------------------------+---------------------------------------------+
```

### 3.1 Expand Phase Immediate Rollback (`01_expand_phase_down.sql`)
If the Expand DDL needs to be undone prior to backfill:
1. Drop added transition columns: `ALTER TABLE users DROP COLUMN IF EXISTS user_code ...`
2. Drop new tables in reverse dependency order: `DROP TABLE IF EXISTS refund_items, refunds, payment_transactions, inventory_ledgers, inventory_balances, inventory_items, storage_locations, product_variants ...`
3. Drop custom enums: `DROP TYPE IF EXISTS OrderStatus, PaymentStatus, StockMovementType ...`
4. Result: Zero impact on legacy database structure or running POS terminals.

### 3.2 Hard Abort Triggers
Execution must immediately halt and revert if any of the following conditions occur:
1. **Pre-Flight Tenant Leak:** Any unresolved `NULL` `tenant_id` detected on existing active tables.
2. **SKU / Barcode Collision:** Any duplicate SKU or Barcode discovered within any single tenant.
3. **Dimensional Stock Discrepancy:** Any mismatch detected between `outlet_products.stock` and `InventoryBalance.quantityOnHand` during reconciliation.
4. **Cashier Authentication Failure:** Cashier PIN verification failure rate exceeding 1% following Model B switch.
5. **Lock Timeout:** Any DDL statement unable to acquire a lock within 5 seconds during low-traffic maintenance window.

---

## 4. Mandatory Operational Safeguards

1. **Mandatory Full Database Backup:** Prior to executing any DDL or backfill against staging or production, a physical snapshot (`pg_dump` or cloud storage backup) must be taken and verified.
2. **Zero In-Flight Transactions:** All cashier shifts must be closed (Z-Reports submitted) and all parked hold orders resolved before initiating cutover.
3. **Maintenance Window:** Expand DDL and cutover actions must be executed during scheduled, off-peak maintenance hours.

---

## 5. Absolute Execution Stop Confirmation

In strict adherence to the Prompt 12 specifications:

```text
========================================================================================
ABSOLUTE EXECUTION STOP CONFIRMATION:
- NO STAGING OR PRODUCTION DATABASE MIGRATION HAS BEEN EXECUTED.
- NO PRISMA MIGRATE DEV / DEPLOY / DB PUSH WAS EXECUTED AGAINST ANY SHARED DATABASE.
- NO CONTRACT PHASE WAS STARTED.
- ALL ARTIFACTS ARE PREPARED IN AN ADDITIVE, REVERSIBLE, REVIEWABLE STATE.
========================================================================================
```

---
*End of Prompt 12 Execution Guardrails Report.*
