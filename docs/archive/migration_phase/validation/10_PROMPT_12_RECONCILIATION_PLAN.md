# 10 — PROMPT 12 DIMENSIONAL RECONCILIATION & PARITY TEST SUITE SPECIFICATION

**Project:** Well POS Multi-Tenant SaaS Platform  
**Document ID:** `DOC-VAL-10-PROMPT-12-RECONCILIATION-PLAN`  
**Execution Stage:** Prompt 12 — Database Migration Scripting & Expand-Phase DDL Implementation  
**Preceding Gate:** Prompt 11.3 = `GO WITH CONDITIONS` (Project Owner Approved)  
**Date:** September 19, 2026  
**Status:** **AUTHORITATIVE RECONCILIATION TEST SPECIFICATION — READ-ONLY / AUDIT PLAN**  
**Live Data Status:** `LIVE DATA COUNTS NOT VERIFIED — LIVE DATA ACCESS NOT AVAILABLE`

---

## 1. Objectives of Dimensional Reconciliation

The Dimensional Reconciliation Suite is the quality gate that verifies mathematical and structural parity between legacy source data and the migrated target schema. It must pass with **Zero Variance (0 Tolerance)** before the Project Owner authorizes the Contract phase or production cutover.

### Invariants:
1. **Tenant-Scoped Execution:** Every query enforces strict tenant isolation (`WHERE tenant_id = :tenantId`).
2. **Exact Dimensional Granularity:** Inventory is reconciled across `tenantId` $\times$ `storageLocationId` $\times$ `inventoryItemId`.
3. **Canonical Physical Stock Baseline (C-04):** `InventoryBalance.quantityOnHand` is the canonical baseline. Opening stock equality strictly tests `legacy outlet_products.stock = InventoryBalance.quantityOnHand`.
4. **Multiplier Separation (C-04):** The variant field `inventoryQuantityMultiplier` applies strictly to transaction deductions (`Order Qty × multiplier = physical deduction`). Physical stock is **NEVER** divided by the multiplier.
5. **Ledger Equality:** Total quantity on hand in `InventoryBalance` must exactly equal the sum of all `InventoryLedger.quantityDelta` entries for that dimension.

---

## 2. Parity Verification Test Suite

### 2.1 Test Suite 1: Tenant Boundary & Integrity

#### Query 1.1: NULL Tenant Detection
*Objective:* Verify zero records exist with `tenant_id IS NULL` across all operational tables.
```sql
SELECT 'outlets' AS table_name, count(*) AS null_count FROM outlets WHERE tenant_id IS NULL
UNION ALL
SELECT 'users', count(*) FROM users WHERE tenant_id IS NULL
UNION ALL
SELECT 'categories', count(*) FROM categories WHERE tenant_id IS NULL
UNION ALL
SELECT 'products', count(*) FROM products WHERE tenant_id IS NULL
UNION ALL
SELECT 'orders', count(*) FROM orders WHERE tenant_id IS NULL
UNION ALL
SELECT 'shifts', count(*) FROM shifts WHERE tenant_id IS NULL
UNION ALL
SELECT 'customers', count(*) FROM customers WHERE tenant_id IS NULL;
```
*Passing Criteria:* `null_count = 0` across all rows.

#### Query 1.2: Cross-Tenant Parent/Child Reference Audit
*Objective:* Verify no child record references a parent belonging to a different tenant.
```sql
SELECT count(*) AS cross_tenant_order_items
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE oi.tenant_id != o.tenant_id;
```
*Passing Criteria:* `cross_tenant_order_items = 0`.

---

### 2.2 Test Suite 2: Catalog & Variant Coverage

#### Query 2.1: 100% Product $\to$ ProductVariant Coverage
*Objective:* Verify every active legacy product has an associated `ProductVariant`.
```sql
SELECT p.tenant_id, p.id AS product_id, p.name
FROM products p
LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.tenant_id = p.tenant_id
WHERE pv.id IS NULL;
```
*Passing Criteria:* Exactly 0 rows returned.

#### Query 2.2: ProductVariant Coverage (B-02 Aware)
*Objective:* Verify every standard retail `ProductVariant` points to a valid `InventoryItem` (while recipes and service labor may have NULL).
```sql
SELECT pv.tenant_id, pv.id AS variant_id, pv.sku, p.type
FROM product_variants pv
JOIN products p ON p.id = pv.product_id
LEFT JOIN inventory_items ii ON ii.id = pv.inventory_item_id AND ii.tenant_id = pv.tenant_id
WHERE p.type = 'STANDARD' AND (pv.inventory_item_id IS NULL OR ii.id IS NULL);
```
*Passing Criteria:* Exactly 0 rows returned for standard retail products.

#### Query 2.3: Tenant-Scoped SKU & Barcode Uniqueness
*Objective:* Confirm zero duplicate SKUs or Barcodes within any tenant.
```sql
SELECT tenant_id, sku, count(*) AS duplicate_count
FROM product_variants
WHERE sku IS NOT NULL AND sku != ''
GROUP BY tenant_id, sku
HAVING count(*) > 1;

SELECT tenant_id, barcode, count(*) AS duplicate_count
FROM product_variants
WHERE barcode IS NOT NULL AND barcode != ''
GROUP BY tenant_id, barcode
HAVING count(*) > 1;
```
*Passing Criteria:* Exactly 0 rows returned.

---

### 2.3 Test Suite 3: Canonical Physical Inventory Parity (C-04, H-01, H-02)

#### Query 3.1: Physical Opening Stock Equality & Missing Balance Detection
*Objective:* Confirm exact equality between legacy `outlet_products.stock` and target `InventoryBalance.quantityOnHand`, and detect any missing balance rows (H-01).
```sql
SELECT 
    op.tenant_id,
    op.outlet_id,
    op.product_id,
    op.stock AS legacy_stock,
    ib.quantity_on_hand AS target_quantity_on_hand,
    COALESCE(op.stock - ib.quantity_on_hand, op.stock) AS discrepancy,
    CASE 
        WHEN ib.id IS NULL THEN 'MISSING_BALANCE_ROW'
        WHEN op.stock != ib.quantity_on_hand THEN 'QUANTITY_MISMATCH'
        ELSE 'OK'
    END AS error_type
FROM outlet_products op
JOIN products p ON p.id = op.product_id
JOIN product_variants pv ON pv.product_id = p.id AND pv.tenant_id = op.tenant_id
JOIN inventory_items ii ON ii.id = pv.inventory_item_id AND ii.tenant_id = op.tenant_id
JOIN storage_locations sl ON sl.outlet_id = op.outlet_id AND sl.is_default = true AND sl.tenant_id = op.tenant_id
LEFT JOIN inventory_balances ib 
    ON ib.inventory_item_id = ii.id 
    AND ib.storage_location_id = sl.id 
    AND ib.tenant_id = op.tenant_id
    AND ib.inventory_batch_id IS NULL
WHERE ib.id IS NULL OR op.stock != ib.quantity_on_hand;
```
*Passing Criteria:* Exactly 0 rows returned (Zero missing balance rows, Zero Discrepancy across all outlets, items, and tenants).

#### Query 3.2: Transaction Conversion Multiplier Sanity Check
*Objective:* Verify that all multipliers are strictly positive (`multiplier > 0`).
```sql
SELECT id, tenant_id, sku, inventory_quantity_multiplier
FROM product_variants
WHERE inventory_quantity_multiplier <= 0;
```
*Passing Criteria:* Exactly 0 rows returned.

---

### 2.4 Test Suite 4: Immutable Append-Only Ledger Integrity (Batch-Aware H-02)

#### Query 4.1: Batch-Aware Balance vs Ledger Sum Equality
*Objective:* Verify that across all 4 dimensions (tenant + item + storage location + batch), current balance equals the exact sum of all ledger movements.
```sql
SELECT 
    ib.tenant_id,
    ib.inventory_item_id,
    ib.storage_location_id,
    ib.inventory_batch_id,
    ib.quantity_on_hand,
    COALESCE(SUM(il.quantity_delta), 0) AS total_ledger_deltas,
    (ib.quantity_on_hand - COALESCE(SUM(il.quantity_delta), 0)) AS drift
FROM inventory_balances ib
LEFT JOIN inventory_ledgers il 
    ON il.inventory_item_id = ib.inventory_item_id 
    AND il.storage_location_id = ib.storage_location_id 
    AND il.tenant_id = ib.tenant_id
    AND (il.inventory_batch_id = ib.inventory_batch_id OR (il.inventory_batch_id IS NULL AND ib.inventory_batch_id IS NULL))
GROUP BY ib.tenant_id, ib.inventory_item_id, ib.storage_location_id, ib.inventory_batch_id, ib.quantity_on_hand
HAVING ib.quantity_on_hand != COALESCE(SUM(il.quantity_delta), 0);
```
*Passing Criteria:* Exactly 0 rows returned.

---

### 2.5 Test Suite 5: User Model B Identity & Credentials (C-02)

#### Query 5.1: Active Users Credential Coverage
*Objective:* Confirm 100% of active users have non-null `userCode` and `pinHash`.
```sql
SELECT id, tenant_id, name, email, user_code, pin_hash
FROM users
WHERE is_active = true AND (user_code IS NULL OR pin_hash IS NULL);
```
*Passing Criteria:* Exactly 0 rows returned.

#### Query 5.2: User Code Uniqueness per Tenant
*Objective:* Confirm zero duplicate user codes within any tenant.
```sql
SELECT tenant_id, user_code, count(*) AS duplicate_count
FROM users
WHERE user_code IS NOT NULL
GROUP BY tenant_id, user_code
HAVING count(*) > 1;
```
*Passing Criteria:* Exactly 0 rows returned.

---

### 2.6 Test Suite 6: Sales & Multi-Tender Payment Parity

#### Query 6.1: OrderItem $\to$ ProductVariant Resolution
*Objective:* Confirm 100% of historical order items possess a valid `product_variant_id`.
```sql
SELECT count(*) AS unmapped_order_items
FROM order_items
WHERE product_variant_id IS NULL;
```
*Passing Criteria:* `unmapped_order_items = 0`.

#### Query 6.2: Paid Orders vs Payment Transactions Parity
*Objective:* Verify that for all paid orders, the captured payment transaction amount equals the order total.
```sql
SELECT 
    o.tenant_id,
    o.id AS order_id,
    o.invoice_number,
    o.total_amount,
    COALESCE(SUM(pt.amount), 0) AS total_captured,
    (o.total_amount - COALESCE(SUM(pt.amount), 0)) AS payment_drift
FROM orders o
LEFT JOIN payment_transactions pt 
    ON pt.order_id = o.id 
    AND pt.tenant_id = o.tenant_id 
    AND pt.status = 'CAPTURED'
WHERE o.payment_status = 'PAID'
GROUP BY o.tenant_id, o.id, o.invoice_number, o.total_amount
HAVING o.total_amount != COALESCE(SUM(pt.amount), 0);
```
*Passing Criteria:* Exactly 0 rows returned.

#### Query 6.3: OrderStatus & PaymentStatus Decoupling Consistency (Correction B)
*Objective:* Verify that historical orders have consistent decoupled status (`order_status` and `payment_status`), and that no invalid cross-state combinations exist.
```sql
SELECT tenant_id, id AS order_id, order_status, payment_status, count(*)
FROM orders
WHERE (payment_status = 'PAID' AND order_status NOT IN ('COMPLETED', 'PROCESSING', 'CONFIRMED'))
   OR (payment_status = 'CANCELLED' AND order_status != 'CANCELLED')
GROUP BY tenant_id, id, order_status, payment_status;
```
*Passing Criteria:* Exactly 0 rows returned.

---

## 3. Automated Reconciliation Runner Interface

The reconciliation suite is packaged into an automated TypeScript runner:
`pos_apps/server/src/migrations/reconciliation/reconcile_all.ts`

- Supports `--tenant=<id>` for targeted tenant validation.
- Emits structured JSON summary and human-readable terminal matrix.
- Exit code 0 indicates 100% PASS across all parity suites; exit code 1 blocks progression to the Contract phase.

---
*End of Prompt 12 Reconciliation Plan.*
