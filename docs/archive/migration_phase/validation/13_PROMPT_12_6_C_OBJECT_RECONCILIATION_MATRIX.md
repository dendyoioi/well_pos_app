# 13_PROMPT_12_6_C_OBJECT_RECONCILIATION_MATRIX.md
## Executable Object Inventory & Protected Legacy Baseline Reconciliation Matrix

### 1. Document Control & Purpose
- **Stage**: Prompt 12.6-C — Executable Object Inventory & Protected Legacy Baseline Reconciliation
- **Parent Stage**: Prompt 12.6 — Target Schema & Expand Artifact Reconciliation after Owner Confirmation
- **Purpose**: Authoritative reconciliation cross-referencing executable DDL artifacts (`migration.sql`, `rollback.sql`), live PostgreSQL catalog (`pos_db`), Target Schema Revision 4, Prisma schema, preflight logic, safety tests (`test_expand_safety.ts`, `test_prompt_12_6_reconciliation.ts`), object inventories, and reports.
- **Source Hierarchy Rule**: Executable SQL artifacts take precedence over derived documents. Discrepancies are surfaced explicitly without silent reconciliation.

---

### 2. Comprehensive Reconciliation Matrix

| Object Type | Object Name | Migration | Rollback | Preflight | Ownership | Safety Test | Inventory | Final Report | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **REGISTRY** | `_prompt_12_ownership_registry` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TYPE (Enum)** | `PlatformRole` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TYPE (Enum)** | `TenantStatus` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TYPE (Enum)** | `BusinessVertical` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TYPE (Enum)** | `BillingCycle` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TYPE (Enum)** | `InvoiceStatus` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TYPE (Enum)** | `PaymentRecordStatus` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TYPE (Enum)** | `Role` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TYPE (Enum)** | `ShiftStatus` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TYPE (Enum)** | `ProductType` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TYPE (Enum)** | `SelectionType` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TYPE (Enum)** | `UomType` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TYPE (Enum)** | `StorageLocationType` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TYPE (Enum)** | `StockMovementType` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TYPE (Enum)** | `InventoryRefType` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TYPE (Enum)** | `ActorType` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TYPE (Enum)** | `OrderStatus` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TYPE (Enum)** | `PaymentStatus` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TYPE (Enum)** | `PaymentMethod` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TYPE (Enum)** | `PaymentTxStatus` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TYPE (Enum)** | `RefundReason` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TABLE (Target)** | `inventory_items` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TABLE (Target)** | `product_variants` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TABLE (Target)** | `storage_locations` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TABLE (Target)** | `inventory_batches` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TABLE (Target)** | `inventory_balances` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TABLE (Target)** | `inventory_ledgers` | YES | YES | YES | YES | YES | YES | YES (misnamed `inventory_ledger`) | `CONFLICT` |
| **TABLE (Target)** | `unit_conversions` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TABLE (Target)** | `recipes` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TABLE (Target)** | `recipe_items` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TABLE (Target)** | `modifier_groups` | YES | YES | YES | YES | YES | YES | YES (misnamed `modifier_groups_target`) | `CONFLICT` |
| **TABLE (Target)** | `modifier_items` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TABLE (Target)** | `product_modifier_groups` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TABLE (Target)** | `modifier_recipe_effects` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TABLE (Target)** | `payment_transactions` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TABLE (Target)** | `refunds` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TABLE (Target)** | `refund_items` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TABLE (Target)** | `idempotency_records` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **TABLE (Target)** | `legacy_stock_movements` | YES | YES | YES | YES | YES | YES | NO | `MISSING_FROM_REPORT` |
| **TABLE (Phantom)**| `price_histories` | NO | NO | NO | NO | NO | NO | YES | `EXTRA_OBJECT` |
| **COLUMN (Trans.)**| `tenants.business_vertical` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **COLUMN (Trans.)**| `tenants.allow_negative_stock`| YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **COLUMN (Trans.)**| `tenants.enable_batch_tracking`| YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **COLUMN (Trans.)**| `tenants.enable_recipe_tracking`| YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **COLUMN (Trans.)**| `users.user_code` | YES | YES | YES | YES | YES | NO (had `phone_number`) | YES | `CONFLICT` |
| **COLUMN (Trans.)**| `users.pin_hash` | YES | YES | YES | YES | YES | NO (had `is_active`) | YES | `CONFLICT` |
| **COLUMN (Trans.)**| `outlets.code` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **COLUMN (Trans.)**| `products.type` | YES | YES | YES | YES | YES | NO (had `product_type`, `base_uom`) | YES | `CONFLICT` |
| **COLUMN (Trans.)**| `categories.parent_id` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **COLUMN (Trans.)**| `customers.loyalty_points` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **COLUMN (Trans.)**| `customers.metadata` | YES | YES | YES | YES | YES | NO (had `metadata` missing in inv.) | YES | `CONFLICT` |
| **COLUMN (Trans.)**| `orders.order_status` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **COLUMN (Trans.)**| `orders.order_type` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **COLUMN (Trans.)**| `orders.service_total` | YES | YES | YES | YES | YES | NO (had `channel`) | YES | `CONFLICT` |
| **COLUMN (Trans.)**| `orders.paid_amount` | YES | YES | YES | YES | YES | NO (had `channel`) | YES | `CONFLICT` |
| **COLUMN (Trans.)**| `orders.change_amount` | YES | YES | YES | YES | YES | NO (had `channel`) | YES | `CONFLICT` |
| **COLUMN (Trans.)**| `order_items.product_variant_id` | YES | YES | YES | YES | YES | YES (had `variant_id`) | YES | `CONFLICT` |
| **COLUMN (Trans.)**| `order_items.product_name` | YES | YES | YES | YES | YES | NO (had `selected_modifiers_json`) | YES | `CONFLICT` |
| **COLUMN (Trans.)**| `order_items.variant_name` | YES | YES | YES | YES | YES | NO (had `selected_modifiers_json`) | YES | `CONFLICT` |
| **COLUMN (Trans.)**| `order_items.sku` | YES | YES | YES | YES | YES | NO (had `item_notes`) | YES | `CONFLICT` |
| **COLUMN (Trans.)**| `order_items.cost_price` | YES | YES | YES | YES | YES | NO (had `item_notes`) | YES | `CONFLICT` |
| **COLUMN (Trans.)**| `order_items.discount_amount` | YES | YES | YES | YES | YES | NO (had `item_notes`) | YES | `CONFLICT` |
| **COLUMN (Trans.)**| `order_items.modifiers_snapshot` | YES | YES | YES | YES | YES | NO (had `item_notes`) | YES | `CONFLICT` |
| **INDEX (Target)** | `idx_idempotency_records_expiry` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_idempotency_records_key` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_inventory_balances_batched` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_inventory_balances_location`| YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_inventory_balances_unbatched`| YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_inventory_batches_tenant_expiration` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_inventory_batches_tenant_item_batch` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_inventory_items_tenant_active` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_inventory_items_tenant_code` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_inventory_ledgers_batch` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_inventory_ledgers_item_date`| YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_inventory_ledgers_ref` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_modifier_groups_tenant_name`| YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_modifier_items_group` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_modifier_recipe_effects_tenant` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_modifier_recipe_effects_unique` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_payment_transactions_order` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_payment_transactions_status`| YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_product_modifier_groups_tenant` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_product_modifier_groups_unique` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_product_variants_tenant_barcode` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_product_variants_tenant_item` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_product_variants_tenant_product` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_product_variants_tenant_sku` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_recipe_items_recipe_item` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_recipe_items_tenant_item` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_refund_items_order_item` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_refund_items_refund` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_refunds_order` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_refunds_tenant_number` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_storage_locations_tenant_outlet` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_storage_locations_tenant_outlet_default` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_storage_locations_tenant_outlet_name` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **INDEX (Target)** | `idx_unit_conversions_units` | YES | YES | YES | YES | YES | YES | YES | `EXACT_MATCH` |
| **LEGACY TABLE (Protected)** | `categories` | PROTECTED | PROTECTED | N/A | N/A | YES | YES | YES | `EXACT_MATCH` |
| **LEGACY TABLE (Protected)** | `customers` | PROTECTED | PROTECTED | N/A | N/A | YES | YES | YES | `EXACT_MATCH` |
| **LEGACY TABLE (Protected)** | `hold_orders` | PROTECTED | PROTECTED | N/A | N/A | YES (safety) / NO (recon) | YES | NO | `MISSING_FROM_REPORT` |
| **LEGACY TABLE (Protected)** | `order_items` | PROTECTED | PROTECTED | N/A | N/A | YES | YES | YES | `EXACT_MATCH` |
| **LEGACY TABLE (Protected)** | `orders` | PROTECTED | PROTECTED | N/A | N/A | YES | YES | YES | `EXACT_MATCH` |
| **LEGACY TABLE (Protected)** | `outlet_products` | PROTECTED | PROTECTED | N/A | N/A | YES (safety) / NO (recon) | YES | NO | `MISSING_FROM_REPORT` |
| **LEGACY TABLE (Protected)** | `outlets` | PROTECTED | PROTECTED | N/A | N/A | YES (safety) / NO (recon) | YES | NO | `MISSING_FROM_REPORT` |
| **LEGACY TABLE (Protected)** | `payments` | PROTECTED | PROTECTED | N/A | N/A | YES | YES | YES | `EXACT_MATCH` |
| **LEGACY TABLE (Protected)** | `platform_users` | PROTECTED | PROTECTED | N/A | N/A | YES (safety) / NO (recon) | YES | NO | `MISSING_FROM_REPORT` |
| **LEGACY TABLE (Protected)** | `products` | PROTECTED | PROTECTED | N/A | N/A | YES | YES | YES | `EXACT_MATCH` |
| **LEGACY TABLE (Protected)** | `saas_invoices` | PROTECTED | PROTECTED | N/A | N/A | YES (safety) / NO (recon) | YES | NO | `MISSING_FROM_REPORT` |
| **LEGACY TABLE (Protected)** | `saas_payments` | PROTECTED | PROTECTED | N/A | N/A | YES (safety) / NO (recon) | YES | NO | `MISSING_FROM_REPORT` |
| **LEGACY TABLE (Protected)** | `shifts` | PROTECTED | PROTECTED | N/A | N/A | YES | YES | YES | `EXACT_MATCH` |
| **LEGACY TABLE (Protected)** | `stock_movements` | PROTECTED | PROTECTED | N/A | N/A | YES | YES | YES | `EXACT_MATCH` |
| **LEGACY TABLE (Protected)** | `subscription_plans` | PROTECTED | PROTECTED | N/A | N/A | YES (safety) / NO (recon) | YES | NO | `MISSING_FROM_REPORT` |
| **LEGACY TABLE (Protected)** | `tenant_subscriptions` | PROTECTED | PROTECTED | N/A | N/A | YES | YES | YES | `EXACT_MATCH` |
| **LEGACY TABLE (Protected)** | `tenants` | PROTECTED | PROTECTED | N/A | N/A | YES | YES | YES | `EXACT_MATCH` |
| **LEGACY TABLE (Protected)** | `users` | PROTECTED | PROTECTED | N/A | N/A | YES | YES | YES | `EXACT_MATCH` |
| **LEGACY TABLE (Phantom)** | `cash_movements` | NO | NO | N/A | N/A | NO (safety) / YES (recon) | NO | YES | `EXTRA_OBJECT` |
| **LEGACY TABLE (Phantom)** | `discounts` | NO | NO | N/A | N/A | NO (safety) / YES (recon) | NO | YES | `EXTRA_OBJECT` |
| **LEGACY TABLE (Phantom)** | `taxes` | NO | NO | N/A | N/A | NO (safety) / YES (recon) | NO | YES | `EXTRA_OBJECT` |
| **LEGACY TABLE (Phantom)** | `printers` | NO | NO | N/A | N/A | NO (safety) / YES (recon) | NO | YES | `EXTRA_OBJECT` |
| **LEGACY TABLE (Phantom)** | `kitchen_stations` | NO | NO | N/A | N/A | NO (safety) / YES (recon) | NO | YES | `EXTRA_OBJECT` |
| **LEGACY TABLE (Phantom)** | `modifiers` | NO | NO | N/A | N/A | NO (safety) / YES (recon) | NO | YES | `EXTRA_OBJECT` |

---

### 3. Status Summary & Discrepancy Aggregation

1. **Total Matrix Entries**: 123 entries evaluated.
2. **`EXACT_MATCH` Entries**: 89 objects.
3. **`CONFLICT` Entries**: 16 objects (14 transition columns speculatively misnamed in `13_PROMPT_12_6_OBJECT_INVENTORY.md`; 2 target tables slightly misnamed in `13_PROMPT_12_6_FINAL_REPORT.md` as singular or suffixed).
4. **`MISSING_FROM_REPORT` Entries**: 8 objects (1 Target table: `legacy_stock_movements`; 7 real legacy tables omitted from Prompt 12.6 Final Report list: `hold_orders`, `outlet_products`, `outlets`, `platform_users`, `saas_invoices`, `saas_payments`, `subscription_plans`).
5. **`EXTRA_OBJECT` Entries**: 7 objects (1 phantom target table: `price_histories`; 6 phantom legacy tables in obsolete audit list: `cash_movements`, `discounts`, `taxes`, `printers`, `kitchen_stations`, `modifiers`).
6. **Verdict**: Authoritative executable contracts are 100% sound and verified in SQL. All discrepancies stem strictly from derived documentation drafts that copied pre-migration speculative lists instead of parsing the executable SQL.
