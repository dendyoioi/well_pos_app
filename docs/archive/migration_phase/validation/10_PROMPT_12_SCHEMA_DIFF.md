# 10 — PROMPT 12 SCHEMA DIFF & STRUCTURAL EVOLUTION MATRIX

**Project:** Well POS Multi-Tenant SaaS Platform  
**Document ID:** `DOC-VAL-10-PROMPT-12-SCHEMA-DIFF`  
**Execution Stage:** Prompt 12 — Database Migration Scripting & Expand-Phase DDL Implementation  
**Preceding Gate:** Prompt 11.3 = `GO WITH CONDITIONS` (Project Owner Approved)  
**Date:** September 19, 2026  
**Status:** **AUTHORITATIVE SCHEMA DIFF & PHASE CLASSIFICATION SPECIFICATION**  
**Live Data Status:** `LIVE DATA COUNTS NOT VERIFIED — LIVE DATA ACCESS NOT AVAILABLE`

---

## 1. Structural Evolution Methodology

The evolution from the 18-model prototype database to the 31-model Target Database Schema Revision 4 strictly follows the **Expand-Contract Pattern**:
1. **EXPAND (Additive DDL):** New tables, new nullable transition columns, new types/enums, and non-breaking indexes are created in the database. All existing tables, columns, and constraints remain intact.
2. **BACKFILL (Data Transformation):** Deterministic workers transform and backfill historical data from legacy tables into target structures.
3. **DUAL-WRITE (Application Bridge):** Application writes to both target and legacy structures to verify operational correctness.
4. **VALIDATE (Reconciliation Suite):** Zero-tolerance dimensional parity queries verify data equality across all tenants.
5. **CUTOVER (Traffic Switch):** Read traffic is switched exclusively to target structures.
6. **CONTRACT (Destructive Cleanup):** Deprecated legacy columns and tables are dropped; final `NOT NULL` and strict unique constraints are applied.

---

## 2. Comprehensive Schema Diff Matrix

| Area / Table | Current Prototype Structure | Target Revision 4 Structure | Expand Action | Backfill Dependency | Contract Action | Risk Classification |
|---|---|---|---|---|---|---|
| **Core / Platform** `platform_users` | `id`, `name`, `email`, `passwordHash`, `role` (ADMIN, SUPER_ADMIN), `isActive`, timestamps | Add role `SUPPORT`, `BILLING`, audit fields | Safe Alter: Extend enum `PlatformRole` | None | None | `SAFE ADDITIVE` |
| **Core / Tenant** `tenants` | `id`, `businessName`, `slug`, `phone`, `status`, `trialEndsAt`, timestamps | Target Revision 4: `businessVertical`, `allowNegativeStock`, `enableBatchTracking`, `enableRecipeTracking` (B-03, H-06: no unapproved convenience columns) | Add columns: `business_vertical`, `allow_negative_stock`, `enable_batch_tracking`, `enable_recipe_tracking` | Backfill defaults: `business_vertical = RETAIL`, negative stock = false, batch/recipe = false | Enforce `NOT NULL` on `business_vertical` | `SAFE ADDITIVE` |
| **Core / User** `users` | `id`, `tenantId?`, `outletId?`, `name`, `email`, `passwordHash`, `pin` (plaintext), `role` (OWNER, ADMIN, CASHIER), `isActive` | Model B: `tenantId`, `outletId?`, `userCode`, `name`, `email?`, `passwordHash?`, `pinHash`, `role`, `isActive` | Add nullable columns: `user_code VARCHAR(50)`, `pin_hash VARCHAR(255)`. Retain `pin`, `email`. No synthetic flags (`mustChangePin`, `forcePinReset`). | Worker generates unique `userCode` per tenant; hashes `pin` $\to$ `pinHash` (Case A); flags `pin IS NULL` for operational reset (Case B). | Enforce `NOT NULL` on `tenant_id`, `user_code`, `pin_hash`; apply `@@unique([tenantId, userCode])`; drop `pin` | `HIGH RISK` (Auth & Cashier login) |
| **Core / Outlet** `outlets` | `id`, `tenantId?`, `name`, `address`, `phone`, `isWarehouse`, `receiptHeader`, `receiptFooter`, timestamps | Revision 4: `code VARCHAR(50)`, `tenantId NOT NULL` (H-06: no unapproved coordinates/timezone) | Add nullable column: `code VARCHAR(50)`. | Backfill `code` (`OUT-001`, `OUT-002`). Verify zero NULL `tenant_id`. | Enforce `NOT NULL` on `tenant_id`, `code`; apply `@@unique([tenantId, code])` | `DATA TRANSFORMATION` |
| **Core / Customer** `customers` | `id`, `tenantId?`, `name`, `phone`, `email`, `address`, `totalVisits`, `totalSpent`, timestamps | `tenantId NOT NULL`, `totalSpent Decimal(15,2)`, `loyaltyPoints Int`, `metadata Json?` | Add columns: `loyalty_points INT DEFAULT 0`, `metadata JSONB`. Convert `total_spent` to Decimal. | Audit NULL `tenant_id`. | Enforce `NOT NULL` on `tenant_id` | `SAFE ADDITIVE` |
| **Core / Shift** `shifts` | `id`, `tenantId?`, `outletId?`, `userId`, `startCash`, `endCash`, `systemExpectedCash`, `cashDifference`, `status`, notes, timestamps | `tenantId NOT NULL`, `outletId NOT NULL`, all amounts `Decimal(15,2)` | Modify amounts to `DECIMAL(15,2)` (lossless promotion from Int/Float). | Verify all closed shifts; ensure no active open shifts across cutover. | Enforce `NOT NULL` on `tenant_id`, `outlet_id` | `DATA TRANSFORMATION` |
| **Catalog / Category** `categories` | `id`, `tenantId?`, `name`, `description`, timestamps | `tenantId NOT NULL`, self-referencing `parentId?` for sub-categories | Add nullable column: `parent_id UUID REFERENCES categories(id)`. | Audit NULL `tenant_id`. | Enforce `NOT NULL` on `tenant_id` | `SAFE ADDITIVE` |
| **Catalog / Product** `products` | Monolithic: `id`, `tenantId?`, `categoryId`, `name`, `description`, `basePrice`, `costPrice`, `unit`, `sku`, `barcode`, `imageUrl`, `isActive`, timestamps | Catalog Grouping: `id`, `tenantId NOT NULL`, `categoryId`, `name`, `description`, `imageUrl`, `type ProductType`, `isActive`, timestamps | Add column: `type ProductType DEFAULT 'STANDARD'`. Retain legacy `base_price`, `cost_price`, `unit`, `sku`, `barcode`. | Extract modifiers from `description` JSON. | Drop legacy columns: `base_price`, `cost_price`, `unit`, `sku`, `barcode`. Enforce `NOT NULL` on `tenant_id`. | `BLOCKER` if dropped early |
| **Catalog / Variant** `product_variants` | *(Non-existent)* | Master commercial sellable unit: `id`, `tenantId`, `productId`, `inventoryItemId?` (B-02: nullable for recipes/service labor), `sku`, `barcode`, `name`, `price Decimal(15,2)`, `inventoryQuantityMultiplier Decimal(12,3) = 1.000`, `isActive` | **CREATE TABLE** `product_variants` with nullable `inventory_item_id`, foreign keys, indexes, and unique constraints `@@unique([tenantId, sku])`, `@@unique([tenantId, barcode])`. | Deterministic 1:1 worker: `id = uuidv5(product.id, 'variant')`, copy legacy `sku`, `barcode`, `basePrice`. | Primary target table active. | `HIGH RISK` (Core catalog) |
| **Logistics / Location** `storage_locations` | *(Non-existent; modeled via `Outlet.isWarehouse`)* | Multi-location: `id`, `tenantId`, `outletId`, `name`, `type StorageLocationType`, `isDefault Boolean`, `allowNegativeStock Boolean?` (B-05, H-05: nullable override), `isActive` | **CREATE TABLE** `storage_locations` with nullable `allow_negative_stock` and partial unique index: `CREATE UNIQUE INDEX ... WHERE is_default = true`. | Provision 1 default location per outlet (`uuidv5(outlet.id, 'default_location')`), `allowNegativeStock = null`. | Primary target table active. | `SAFE ADDITIVE` |
| **Logistics / InventoryItem** `inventory_items` | *(Non-existent; merged in `Product`)* | Master logistical raw material: `id`, `tenantId`, `itemCode`, `name`, `canonicalUom`, `purchaseUom?`, `reorderPoint`, `targetLevel`, `averageCost Decimal(15,4)`, `allowNegativeStock Boolean?` (nullable override), `isBatched Boolean`, `isActive` (B-04, H-04, H-05) | **CREATE TABLE** `inventory_items` with full Revision 4 fields and unique index `@@unique([tenantId, itemCode])`. | Deterministic collision-safe worker: `id = uuidv5(product.id, 'inventory_item')`, deterministic `itemCode`, `allowNegativeStock = null`. | Primary target table active. | `HIGH RISK` (Stock baseline) |
| **Logistics / Balance** `inventory_balances` | *(Non-existent; modeled via `outlet_products.stock`)* | Canonical physical stock: `id`, `tenantId`, `inventoryItemId`, `storageLocationId`, `inventoryBatchId?` (B-01), `quantityOnHand Decimal(12,3)`, `quantityReserved Decimal(12,3)` | **CREATE TABLE** `inventory_balances` with nullable `inventory_batch_id` and dual partial unique indexes (unbatched and batched). No `isNegativeBalance` column. | Calibrate `quantityOnHand = Decimal(outlet_products.stock, 3)`, `inventoryBatchId = null`. Apply ADR-002 policy check. | Primary target table active. | `HIGH RISK` (Physical stock) |
| **Logistics / Ledger** `inventory_ledgers` | *(Non-existent; modeled via `stock_movements`)* | Immutable append-only stock movement event log: `id`, `tenantId`, `inventoryItemId`, `storageLocationId`, `inventoryBatchId?`, `movementType`, `referenceType`, `referenceId`, `quantityDelta Decimal(12,3)`, `balanceBefore`, `balanceAfter`, `unitCost`, `actorType`, `actorUserId?` (FK to `users`), `isNegativeBalance Boolean` (B-01, B-07) | **CREATE TABLE** `inventory_ledgers`. Table is strictly append-only, matching Revision 4 naming and foreign keys. | Insert initial calibration rows (`StockMovementType.OPNAME_ADJUSTMENT`, `InventoryRefType.STOCK_OPNAME`). (B-09: No invented enums). | Primary target table active. | `SAFE ADDITIVE` |
| **Logistics / Conversion** `unit_conversions` | *(Non-existent)* | Master UOM conversions: `id`, `fromUom`, `toUom`, `conversionFactor Decimal(12,6)`, `uomType`, `isBase Boolean` (B-06) | **CREATE TABLE** `unit_conversions` matching Revision 4 column names. | Seed standard physical conversion rates (Kg $\to$ Gr, L $\to$ ml). | Primary target table active. | `SAFE ADDITIVE` |
| **Logistics / Batch** `inventory_batches` | *(Non-existent)* | Batch/lot and expiration metadata: `id`, `tenantId`, `inventoryItemId`, `batchNumber`, `expirationDate`, `receivedDate`, `costPrice` | **CREATE TABLE** `inventory_batches`. | None required for legacy retail data. | Primary target table active. | `SAFE ADDITIVE` |
| **Legacy Stock** `outlet_products` | `id`, `outletId`, `productId`, `stock Int`, `minStock Int`, timestamps | Replaced by `InventoryBalance` + `StorageLocation` | Retain active table during Expand, Backfill, and Dual-Write phases. | Legacy stock migrated to `inventory_balances`. Parity verified via Section 13 reconciliation (H-01, H-02). | **DROP TABLE** `outlet_products` in Contract phase. | `BLOCKER` if dropped early |
| **Legacy Movements** `stock_movements` | `id`, `outletId`, `productId`, `type`, `quantity Int`, `notes`, timestamps | Archived into `legacy_stock_movements` | **CREATE TABLE** `legacy_stock_movements` as read-only archive container. Retain active `stock_movements`. | Archive copy executed during Backfill. | **DROP TABLE** `stock_movements` in Contract phase. | `ARCHIVE-ONLY` |
| **F&B / Recipes** `recipes`, `recipe_items` | *(Non-existent)* | Bill of materials: `Recipe` owned by `ProductVariant`; `RecipeItem` points to `InventoryItem` with `quantity Decimal(12,3)` | **CREATE TABLES** `recipes`, `recipe_items` with tenant scoping and constraints. | None required for legacy retail products. | Primary target tables active. | `SAFE ADDITIVE` |
| **F&B / Modifiers** `modifier_groups`, `modifier_items`, `product_modifier_groups`, `modifier_recipe_effects` | *(Non-existent; stored as JSON strings in `Product.description`)* | Relational modifiers with recipe effect linking | **CREATE TABLES** `modifier_groups`, `modifier_items`, `product_modifier_groups`, `modifier_recipe_effects`. | Backfill worker safely parses `Product.description` JSON and normalizes modifier groups and items. | Primary target tables active. | `DATA TRANSFORMATION` |
| **Sales / Order** `orders` | `id`, `tenantId?`, `outletId?`, `userId`, `customerId?`, `invoiceNumber`, `subtotal`, `taxTotal`, `discountTotal`, `serviceTotal`, `totalAmount`, `paymentStatus` (PAID, CANCELLED, REFUNDED), `notes`, timestamps | Decoupled states: `orderStatus OrderStatus @default(CONFIRMED)`, `paymentStatus PaymentStatus @default(UNPAID)`, all amounts `Decimal(15,2)`, `paidAmount`, `changeAmount`, `orderType VARCHAR(50) DEFAULT 'DINE_IN'` | Add nullable/defaulted columns: `order_status "OrderStatus" DEFAULT 'CONFIRMED'`, `paid_amount DECIMAL(15,2) DEFAULT 0`, `change_amount DECIMAL(15,2) DEFAULT 0`, `order_type VARCHAR(50) DEFAULT 'DINE_IN'`. Promote amounts to Decimal. Retain legacy `payment_status`. | Map legacy `payment_status = PAID` $\to$ `orderStatus = COMPLETED`, `paymentStatus = PAID`. | Enforce `NOT NULL` on `tenant_id`, `outlet_id`, `order_status`, `payment_status`; apply `@@unique([tenantId, invoiceNumber])`. | `HIGH RISK` (Sales & Invoicing) |
| **Sales / OrderItem** `order_items` | `id`, `orderId`, `productId`, `quantity Int`, `unitPrice`, `subtotal`, timestamps | Historical snapshot: `id`, `tenantId`, `orderId`, `productVariantId`, `productName`, `variantName`, `sku`, `quantity Decimal(12,3)`, `unitPrice Decimal(15,2)`, `costPrice Decimal(15,4)`, `discountAmount`, `subtotal Decimal(15,2)`, `modifiersSnapshot Json?` | Add nullable column: `product_variant_id UUID REFERENCES product_variants(id)`, `product_name TEXT`, `variant_name TEXT`, `sku TEXT`, `cost_price DECIMAL(15,4)`. Retain `product_id`. | Backfill worker maps `product_variant_id = uuidv5(product_id, 'variant')`, populates snapshot names/SKU from legacy product. | Enforce `NOT NULL` on `tenant_id`, `product_variant_id`, snapshot fields; drop `product_id`. | `HIGH RISK` (Historical sales lines) |
| **Sales / Payment** `payments` | Monolithic: `id`, `orderId`, `paymentMethod` (CASH, QRIS), `amountPaid`, `changeGiven`, timestamps | Replaced by `PaymentTransaction` | Retain active table during Expand, Backfill, and Dual-Write. | Payments transformed into `payment_transactions`. | **DROP TABLE** `payments` in Contract phase. | `DATA TRANSFORMATION` |
| **Sales / Transaction** `payment_transactions` | *(Non-existent)* | Multi-tender transaction ledger: `id`, `tenantId`, `orderId`, `paymentMethod`, `amount Decimal(15,2)`, `referenceNumber`, `gatewayProvider`, `status PaymentTxStatus`, `paidAt` | **CREATE TABLE** `payment_transactions`. | Backfill worker copies legacy `payments` $\to$ `payment_transactions` with status `CAPTURED`. | Primary target table active. | `DATA TRANSFORMATION` |
| **Sales / Refund** `refunds`, `refund_items` | *(Non-existent)* | Granular refund accounting: `Refund` header + `RefundItem` detail with restock flag | **CREATE TABLES** `refunds`, `refund_items`. | Backfill legacy orders with `payment_status = REFUNDED` into formal `Refund` records. | Primary target tables active. | `SAFE ADDITIVE` |
| **Sales / HoldOrder** `hold_orders` | `id`, `tenantId?`, `outletId?`, `userId`, `customerName`, `cartData Json`, notes, timestamps | Mapped to `orders` with `OrderStatus.DRAFT` | Retain active table during Expand. | Retention policy: `[OWNER DECISION REQUIRED]`. If approved, transform cart JSON into `Order` + `OrderItem` rows. | **DROP TABLE** `hold_orders` in Contract phase. | `MANUAL MAPPING` |
| **Reliability / Idempotency** `idempotency_records` | *(Non-existent)* | Deduplication ledger: `id`, `tenantId`, `operationType`, `idempotencyKey`, `requestHash`, `statusCode`, `responseBody`, `expiresAt` | **CREATE TABLE** `idempotency_records` with unique constraint `@@unique([tenantId, operationType, idempotencyKey])`. | None required. | Primary target table active. | `SAFE ADDITIVE` |

---

## 3. Strict Pre-Conditions for Contract Phase Execution

The following destructive changes and constraints **MUST NOT BE INCLUDED IN THE EXPAND PHASE** and are strictly deferred to the Contract Phase:

1. **Deferred NOT NULL Enforcements:**
   - `users.tenant_id`, `users.user_code`, `users.pin_hash`
   - `outlets.tenant_id`, `outlets.code`
   - `categories.tenant_id`
   - `products.tenant_id`
   - `orders.tenant_id`, `orders.outlet_id`, `orders.order_status`, `orders.payment_status`
   - `order_items.tenant_id`, `order_items.product_variant_id`
   - `customers.tenant_id`
   - `shifts.tenant_id`, `shifts.outlet_id`

2. **Deferred Unique Constraints:**
   - `users (tenant_id, user_code)`
   - `outlets (tenant_id, code)`
   - `orders (tenant_id, invoice_number)`

3. **Deferred Column Drops:**
   - `products.base_price`, `products.cost_price`, `products.unit`, `products.sku`, `products.barcode`
   - `users.pin`
   - `order_items.product_id`

4. **Deferred Table Drops:**
   - `outlet_products`
   - `payments`
   - `stock_movements`
   - `hold_orders`

---
*End of Prompt 12 Schema Diff Report.*
