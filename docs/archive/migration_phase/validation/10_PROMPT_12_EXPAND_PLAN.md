# 10 — PROMPT 12 EXPAND-PHASE DDL IMPLEMENTATION PLAN

**Project:** Well POS Multi-Tenant SaaS Platform  
**Document ID:** `DOC-VAL-10-PROMPT-12-EXPAND-PLAN`  
**Execution Stage:** Prompt 12 — Database Migration Scripting & Expand-Phase DDL Implementation  
**Preceding Gate:** Prompt 11.3 = `GO WITH CONDITIONS` (Project Owner Approved)  
**Date:** September 19, 2026  
**Status:** **AUTHORITATIVE EXPAND EXECUTION BLUEPRINT — NON-DESTRUCTIVE DDL ONLY**  
**Live Data Status:** `LIVE DATA COUNTS NOT VERIFIED — LIVE DATA ACCESS NOT AVAILABLE`

---

## 1. Architectural Mission of the Expand Phase

The Expand Phase represents the first physical deployment step in the database schema evolution from prototype to Target Database Schema Revision 4. Its guiding principle is **Strict Additive Backward Compatibility**:

1. **Zero Destructive Actions:** Absolutely NO `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or `DELETE` statements.
2. **Zero Breaking Constraints on Legacy Data:** No `NOT NULL` constraints applied to existing legacy columns that may contain `NULL` data.
3. **Preservation of Existing Application Traffic:** The running Node.js / Express application and React POS frontend can continue executing transactions, querying legacy tables, and checking out orders without interruption.
4. **PostgreSQL Transactional Safety:** All DDL commands execute within an atomic transaction block (`BEGIN ... COMMIT`). If any statement encounters an error, the database engine rolls back all changes, leaving the database in its exact pre-migration state.
5. **Instant Reversibility:** A companion down-migration script (`01_expand_phase_down.sql`) is provided to drop only the newly created tables, columns, and types if an immediate abort is triggered before backfill begins.

---

## 2. PostgreSQL DDL Artifact Specification

The authoritative DDL script is authored in:
`pos_apps/server/prisma/migrations/20260919000000_expand_phase_ddl/migration.sql`

### 2.1 Enumerations Created
The following PostgreSQL custom ENUM types are created:
1. `PlatformRole` (`SUPER_ADMIN`, `SUPPORT`, `BILLING`)
2. `TenantStatus` (`TRIAL`, `ACTIVE`, `SUSPENDED`, `CANCELLED`)
3. `BusinessVertical` (`RETAIL`, `FNB`, `SERVICES`, `HYBRID`)
4. `BillingCycle` (`MONTHLY`, `ANNUALLY`)
5. `InvoiceStatus` (`DRAFT`, `UNPAID`, `PAID`, `VOID`)
6. `PaymentRecordStatus` (`PENDING`, `SUCCESS`, `FAILED`)
7. `Role` (`OWNER`, `ADMIN`, `SUPERVISOR`, `CASHIER`, `KITCHEN`, `WAITER`)
8. `ShiftStatus` (`OPEN`, `CLOSED`)
9. `ProductType` (`STANDARD`, `COMPOSITE`, `SERVICE_LABOR`)
10. `SelectionType` (`SINGLE`, `MULTIPLE`)
11. `UomType` (`MASS`, `VOLUME`, `COUNT`, `LENGTH`, `TIME`)
12. `StorageLocationType` (`STOREFRONT`, `WAREHOUSE`, `KITCHEN`, `BAR`, `TRANSIT`)
13. `StockMovementType` (`SALE`, `PURCHASE`, `TRANSFER_IN`, `TRANSFER_OUT`, `OPNAME_ADJUSTMENT`, `RETURN`, `WASTE`, `VOID`, `PRODUCTION_CONSUMPTION`, `PRODUCTION_OUTPUT`)
14. `InventoryRefType` (`ORDER`, `PURCHASE_ORDER`, `TRANSFER`, `STOCK_OPNAME`, `REFUND`, `PRODUCTION`, `MANUAL`)
15. `ActorType` (`USER`, `SYSTEM`)
16. `OrderStatus` (`DRAFT`, `CONFIRMED`, `IN_PROGRESS`, `READY`, `COMPLETED`, `CANCELLED`, `VOIDED`)
17. `PaymentStatus` (`UNPAID`, `PARTIALLY_PAID`, `PAID`, `PARTIALLY_REFUNDED`, `REFUNDED`)
18. `PaymentMethod` (`CASH`, `QRIS`, `CREDIT_CARD`, `DEBIT_CARD`, `BANK_TRANSFER`, `EWALLET`, `VOUCHER`)
19. `PaymentTxStatus` (`PENDING`, `CAPTURED`, `FAILED`, `REFUNDED`, `VOIDED`)
20. `RefundReason` (`CUSTOMER_RETURN`, `DAMAGED_GOODS`, `WRONG_ITEM`, `DISSATISFIED_SERVICE`, `BILLING_ERROR`)

### 2.2 New Tables Created (Additive)
The following 18 tables are created with full tenant scoping, primary keys, and foreign keys:
1. `product_variants` (Commercial SKU/barcode entity)
2. `unit_conversions` (Physical UOM conversion matrix)
3. `storage_locations` (Multi-location storage areas)
4. `inventory_items` (Master logistical raw materials)
5. `inventory_batches` (Lot and expiry tracking)
6. `inventory_balances` (Current stock state projection per stock dimension)
7. `inventory_ledgers` (Immutable append-only stock movement log)
8. `recipes` (BOM headers)
9. `recipe_items` (BOM ingredient consumption rows)
10. `modifier_groups` (Option groups for toppings, sizes, adjustments)
11. `modifier_items` (Individual modifier choices)
12. `product_modifier_groups` (Catalog linkage to modifier groups)
13. `modifier_recipe_effects` (Ingredient deduction deltas for modifiers)
14. `payment_transactions` (Multi-tender payment ledger)
15. `refunds` (Formal refund ledger)
16. `refund_items` (Granular refund line items)
17. `idempotency_records` (Network deduplication table)
18. `legacy_stock_movements` (Read-only historical movement archive)

### 2.3 Nullable Transition Columns Added to Legacy Tables
The following columns are added to existing operational tables with `NULL` or safe defaults:
- **`tenants`:** (B-03, H-06: Locked Revision 4 fields only; no unapproved convenience columns)
  - `business_vertical BusinessVertical DEFAULT 'RETAIL'`
  - `allow_negative_stock BOOLEAN DEFAULT false`
  - `enable_batch_tracking BOOLEAN DEFAULT false`
  - `enable_recipe_tracking BOOLEAN DEFAULT false`
- **`users`:**
  - `user_code VARCHAR(50) NULL` (Temporarily nullable; will be populated by Model B worker)
  - `pin_hash VARCHAR(255) NULL` (Temporarily nullable; will be populated by PIN hashing worker)
  - *(Legacy `pin` retained untouched; no synthetic `mustChangePin` or `forcePinReset` columns added)*
- **`outlets`:** (H-06: Locked Revision 4 fields only)
  - `code VARCHAR(50) NULL`
- **`products`:**
  - `type ProductType DEFAULT 'STANDARD'`
  - *(Legacy `base_price`, `cost_price`, `unit`, `sku`, `barcode` retained untouched)*
- **`orders`:** (Correction B: Synchronized with Target Database Schema Revision 4)
  - `order_status OrderStatus DEFAULT 'CONFIRMED'`
  - `order_type VARCHAR(50) DEFAULT 'DINE_IN'`
  - `service_total DECIMAL(15, 2) DEFAULT 0`
  - `paid_amount DECIMAL(15, 2) DEFAULT 0`
  - `change_amount DECIMAL(15, 2) DEFAULT 0`
  - *(Legacy `payment_status` retained untouched)*
- **`order_items`:**
  - `product_variant_id TEXT NULL` (Temporarily nullable; foreign key to `product_variants(id)`)
  - `product_name TEXT NULL`
  - `variant_name TEXT NULL`
  - `sku TEXT NULL`
  - `cost_price DECIMAL(15, 4) DEFAULT 0`
  - `discount_amount DECIMAL(15, 2) DEFAULT 0`
  - `modifiers_snapshot JSONB NULL`
  - *(Legacy `product_id` foreign key retained untouched)*
- **`customers`:**
  - `loyalty_points INT DEFAULT 0`
  - `metadata JSONB NULL`
- **`categories`:**
  - `parent_id TEXT NULL REFERENCES categories(id) ON DELETE SET NULL`

### 2.4 Critical Target Constraints & Partial Indexes
1. **Single Default Storage Location per Outlet:**
   ```sql
   CREATE UNIQUE INDEX idx_storage_locations_tenant_outlet_default
   ON storage_locations (tenant_id, outlet_id)
   WHERE is_default = true;
   ```
2. **ProductVariant Uniqueness:**
   ```sql
   CREATE UNIQUE INDEX idx_product_variants_tenant_sku ON product_variants (tenant_id, sku);
   CREATE UNIQUE INDEX idx_product_variants_tenant_barcode ON product_variants (tenant_id, barcode);
   ```
3. **InventoryItem Code Uniqueness:**
   ```sql
   CREATE UNIQUE INDEX idx_inventory_items_tenant_code ON inventory_items (tenant_id, item_code);
   ```
4. **InventoryBalance Dimensional Uniqueness:**
   ```sql
   CREATE UNIQUE INDEX idx_inventory_balances_dimension ON inventory_balances (tenant_id, inventory_item_id, storage_location_id);
   ```
5. **Idempotency Uniqueness:**
   ```sql
   CREATE UNIQUE INDEX idx_idempotency_tenant_op_key ON idempotency_records (tenant_id, operation_type, idempotency_key);
   ```

---

## 3. Atomic Execution Boundaries & Safety Guardrails

- The entire DDL is wrapped in a single transaction:
  ```sql
  BEGIN;
  -- DDL Statements
  COMMIT;
  ```
- If any error occurs during DDL execution, PostgreSQL automatically performs an atomic rollback.
- Because no data is altered, deleted, or constrained with immediate `NOT NULL`, running the Expand migration introduces zero risk of production data loss or application downtime.

---
*End of Prompt 12 Expand Plan.*
