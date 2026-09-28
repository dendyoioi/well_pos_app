# 10.4 — PROMPT 12.4.1 OBJECT OWNERSHIP INVENTORY

**Project:** Well POS Multi-Tenant SaaS Platform  
**Document ID:** `DOC-VAL-10-PROMPT-12-4-OBJECT-OWNERSHIP-INVENTORY`  
**Execution Stage:** Prompt 12.4.1 — Target Schema ↔ Expand Artifact Final Alignment  
**Authoritative Reference:** Target Database Schema Revision 4 (`ARCH-2026-09-DB-SCHEMA-04`)  
**Preceding Gate:** Prompt 12.4 = `BLOCKED / OWNER REVIEW REQUIRED`  
**Date:** September 20, 2026  
**Status:** **AUTHORITATIVE OBJECT OWNERSHIP INVENTORY — ZERO UNKNOWNS (Aligned to Target Schema Revision 4)**  
**Core Invariant:**
```text
TARGET SCHEMA REVISION 4
=
ACTUAL MIGRATION OBJECT CONTRACT
=
PREFLIGHT CONTRACT
=
OWNERSHIP CONTRACT
=
ROLLBACK CONTRACT
=
DOCUMENTED OBJECT INVENTORY
=
SCHEMA CONTRACT TESTS
```

---

## 1. Complete Object Ownership Matrix (96 Touched Migration Objects)

| Object | Type | Source Statement | Pre-existing | Compatibility Method | Ownership | Preflight Check | Rollback Action | Verification |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| **_prompt_12_ownership_registry** | REGISTRY | `CREATE TABLE IF NOT EXISTS "_prompt_12_ownership_registry"` | CONDITIONALLY | Structural column UDT audit | `CREATED_BY_PROMPT_12` or `PRE_EXISTING_COMPATIBLE_REUSED` | Verify column UDTs (object_type, parent_name, object_name, ownership); fail closed on incompatibility | Dropped ONLY IF `CREATED_BY_PROMPT_12`; PRESERVED IF reused | `pg_class` + `information_schema.columns` |
| **PlatformRole** | TYPE (Enum) | `CREATE TYPE "PlatformRole" ...` | YES | Vocabulary audit | `PRE_EXISTING_COMPATIBLE_REUSED` | Verify existing labels subset of Revision 4 (['SUPER_ADMIN', 'SUPPORT', 'BILLING']); fail closed on mismatch | PRESERVED (NO ACTION) | `pg_type` / `pg_enum` |
| **TenantStatus** | TYPE (Enum) | `CREATE TYPE "TenantStatus" ...` | YES | Vocabulary audit | `PRE_EXISTING_COMPATIBLE_REUSED` | Verify existing labels subset of Revision 4 (['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED']); fail closed on mismatch | PRESERVED (NO ACTION) | `pg_type` / `pg_enum` |
| **BusinessVertical** | TYPE (Enum) | `CREATE TYPE "BusinessVertical" ...` | NO | Vocabulary audit | `CREATED_BY_PROMPT_12` | Verify existing labels subset of Revision 4 (['RETAIL', 'FNB', 'SERVICES', 'HYBRID']); fail closed on mismatch | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_type` / `pg_enum` |
| **BillingCycle** | TYPE (Enum) | `CREATE TYPE "BillingCycle" ...` | CONDITIONALLY | Vocabulary audit | `CREATED_BY_PROMPT_12` | Verify existing labels subset of Revision 4 (['MONTHLY', 'ANNUALLY']); fail closed on mismatch | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_type` / `pg_enum` |
| **InvoiceStatus** | TYPE (Enum) | `CREATE TYPE "InvoiceStatus" ...` | CONDITIONALLY | Vocabulary audit | `CREATED_BY_PROMPT_12` | Verify existing labels subset of Revision 4 (['DRAFT', 'UNPAID', 'PAID', 'VOID']); fail closed on mismatch | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_type` / `pg_enum` |
| **PaymentRecordStatus** | TYPE (Enum) | `CREATE TYPE "PaymentRecordStatus" ...` | NO | Vocabulary audit | `CREATED_BY_PROMPT_12` | Verify existing labels subset of Revision 4 (['PENDING', 'SUCCESS', 'FAILED']); fail closed on mismatch | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_type` / `pg_enum` |
| **Role** | TYPE (Enum) | `CREATE TYPE "Role" ...` | YES | Vocabulary audit | `PRE_EXISTING_COMPATIBLE_REUSED` | Verify existing labels subset of Revision 4 (['OWNER', 'ADMIN', 'SUPERVISOR', 'CASHIER', 'KITCHEN', 'WAITER']); fail closed on mismatch | PRESERVED (NO ACTION) | `pg_type` / `pg_enum` |
| **ShiftStatus** | TYPE (Enum) | `CREATE TYPE "ShiftStatus" ...` | YES | Vocabulary audit | `PRE_EXISTING_COMPATIBLE_REUSED` | Verify existing labels subset of Revision 4 (['OPEN', 'CLOSED']); fail closed on mismatch | PRESERVED (NO ACTION) | `pg_type` / `pg_enum` |
| **ProductType** | TYPE (Enum) | `CREATE TYPE "ProductType" ...` | NO | Vocabulary audit | `CREATED_BY_PROMPT_12` | Verify existing labels subset of Revision 4 (['STANDARD', 'COMPOSITE', 'SERVICE_LABOR']); fail closed on mismatch | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_type` / `pg_enum` |
| **SelectionType** | TYPE (Enum) | `CREATE TYPE "SelectionType" ...` | NO | Vocabulary audit | `CREATED_BY_PROMPT_12` | Verify existing labels subset of Revision 4 (['SINGLE', 'MULTIPLE']); fail closed on mismatch | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_type` / `pg_enum` |
| **UomType** | TYPE (Enum) | `CREATE TYPE "UomType" ...` | NO | Vocabulary audit | `CREATED_BY_PROMPT_12` | Verify existing labels subset of Revision 4 (['MASS', 'VOLUME', 'COUNT', 'LENGTH', 'TIME']); fail closed on mismatch | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_type` / `pg_enum` |
| **StorageLocationType** | TYPE (Enum) | `CREATE TYPE "StorageLocationType" ...` | NO | Vocabulary audit | `CREATED_BY_PROMPT_12` | Verify existing labels subset of Revision 4 (['STOREFRONT', 'WAREHOUSE', 'KITCHEN', 'BAR', 'TRANSIT']); fail closed on mismatch | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_type` / `pg_enum` |
| **StockMovementType** | TYPE (Enum) | `CREATE TYPE "StockMovementType" ...` | YES | Vocabulary audit | `PRE_EXISTING_COMPATIBLE_REUSED` | Verify existing labels subset of Revision 4 (['SALE', 'PURCHASE', 'TRANSFER_IN', 'TRANSFER_OUT', 'OPNAME_ADJUSTMENT', 'RETURN', 'WASTE', 'VOID', 'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT']); fail closed on mismatch | PRESERVED (NO ACTION) | `pg_type` / `pg_enum` |
| **InventoryRefType** | TYPE (Enum) | `CREATE TYPE "InventoryRefType" ...` | NO | Vocabulary audit | `CREATED_BY_PROMPT_12` | Verify existing labels subset of Revision 4 (['ORDER', 'PURCHASE_ORDER', 'TRANSFER', 'STOCK_OPNAME', 'REFUND', 'PRODUCTION', 'MANUAL']); fail closed on mismatch | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_type` / `pg_enum` |
| **ActorType** | TYPE (Enum) | `CREATE TYPE "ActorType" ...` | NO | Vocabulary audit | `CREATED_BY_PROMPT_12` | Verify existing labels subset of Revision 4 (['USER', 'SYSTEM']); fail closed on mismatch | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_type` / `pg_enum` |
| **OrderStatus** | TYPE (Enum) | `CREATE TYPE "OrderStatus" ...` | NO | Vocabulary audit | `CREATED_BY_PROMPT_12` | Verify existing labels subset of Revision 4 (['DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED', 'VOIDED']); fail closed on mismatch | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_type` / `pg_enum` |
| **PaymentStatus** | TYPE (Enum) | `CREATE TYPE "PaymentStatus" ...` | YES | Vocabulary audit | `PRE_EXISTING_COMPATIBLE_REUSED` | Verify existing labels subset of Revision 4 (['UNPAID', 'PARTIALLY_PAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED']); fail closed on mismatch | PRESERVED (NO ACTION) | `pg_type` / `pg_enum` |
| **PaymentMethod** | TYPE (Enum) | `CREATE TYPE "PaymentMethod" ...` | YES | Vocabulary audit | `PRE_EXISTING_COMPATIBLE_REUSED` | Verify existing labels subset of Revision 4 (['CASH', 'QRIS', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'EWALLET', 'VOUCHER']); fail closed on mismatch | PRESERVED (NO ACTION) | `pg_type` / `pg_enum` |
| **PaymentTxStatus** | TYPE (Enum) | `CREATE TYPE "PaymentTxStatus" ...` | CONDITIONALLY | Vocabulary audit | `CREATED_BY_PROMPT_12` | Verify existing labels subset of Revision 4 (['PENDING', 'CAPTURED', 'FAILED', 'REFUNDED', 'VOIDED']); fail closed on mismatch | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_type` / `pg_enum` |
| **RefundReason** | TYPE (Enum) | `CREATE TYPE "RefundReason" ...` | NO | Vocabulary audit | `CREATED_BY_PROMPT_12` | Verify existing labels subset of Revision 4 (['CUSTOMER_RETURN', 'DAMAGED_GOODS', 'WRONG_ITEM', 'DISSATISFIED_SERVICE', 'BILLING_ERROR']); fail closed on mismatch | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_type` / `pg_enum` |
| **inventory_items** | TABLE | `CREATE TABLE IF NOT EXISTS "inventory_items"` | NO | Full structural validation | `CREATED_BY_PROMPT_12` | Full Revision 4 contract: PK (`['id']`), all columns, UDTs, precision, scale, nullability, defaults, FKs | DROP TABLE IF EXISTS (strict reverse dependency order, zero CASCADE) | `pg_class` + `pg_constraint` + `information_schema` |
| **product_variants** | TABLE | `CREATE TABLE IF NOT EXISTS "product_variants"` | NO | Full structural validation | `CREATED_BY_PROMPT_12` | Full Revision 4 contract: PK (`['id']`), all columns, UDTs, precision, scale, nullability, defaults, FKs | DROP TABLE IF EXISTS (strict reverse dependency order, zero CASCADE) | `pg_class` + `pg_constraint` + `information_schema` |
| **storage_locations** | TABLE | `CREATE TABLE IF NOT EXISTS "storage_locations"` | NO | Full structural validation | `CREATED_BY_PROMPT_12` | Full Revision 4 contract: PK (`['id']`), all columns, UDTs, precision, scale, nullability, defaults, FKs | DROP TABLE IF EXISTS (strict reverse dependency order, zero CASCADE) | `pg_class` + `pg_constraint` + `information_schema` |
| **inventory_batches** | TABLE | `CREATE TABLE IF NOT EXISTS "inventory_batches"` | NO | Full structural validation | `CREATED_BY_PROMPT_12` | Full Revision 4 contract: PK (`['id']`), all columns, UDTs, precision, scale, nullability, defaults, FKs | DROP TABLE IF EXISTS (strict reverse dependency order, zero CASCADE) | `pg_class` + `pg_constraint` + `information_schema` |
| **inventory_balances** | TABLE | `CREATE TABLE IF NOT EXISTS "inventory_balances"` | NO | Full structural validation | `CREATED_BY_PROMPT_12` | Full Revision 4 contract: PK (`['id']`), all columns, UDTs, precision, scale, nullability, defaults, FKs | DROP TABLE IF EXISTS (strict reverse dependency order, zero CASCADE) | `pg_class` + `pg_constraint` + `information_schema` |
| **inventory_ledgers** | TABLE | `CREATE TABLE IF NOT EXISTS "inventory_ledgers"` | NO | Full structural validation | `CREATED_BY_PROMPT_12` | Full Revision 4 contract: PK (`['id']`), all columns, UDTs, precision, scale, nullability, defaults, FKs | DROP TABLE IF EXISTS (strict reverse dependency order, zero CASCADE) | `pg_class` + `pg_constraint` + `information_schema` |
| **unit_conversions** | TABLE | `CREATE TABLE IF NOT EXISTS "unit_conversions"` | NO | Full structural validation | `CREATED_BY_PROMPT_12` | Full Revision 4 contract: PK (`['id']`), all columns, UDTs, precision, scale, nullability, defaults, FKs | DROP TABLE IF EXISTS (strict reverse dependency order, zero CASCADE) | `pg_class` + `pg_constraint` + `information_schema` |
| **recipes** | TABLE | `CREATE TABLE IF NOT EXISTS "recipes"` | NO | Full structural validation | `CREATED_BY_PROMPT_12` | Full Revision 4 contract: PK (`['id']`), all columns, UDTs, precision, scale, nullability, defaults, FKs | DROP TABLE IF EXISTS (strict reverse dependency order, zero CASCADE) | `pg_class` + `pg_constraint` + `information_schema` |
| **recipe_items** | TABLE | `CREATE TABLE IF NOT EXISTS "recipe_items"` | NO | Full structural validation | `CREATED_BY_PROMPT_12` | Full Revision 4 contract: PK (`['id']`), all columns, UDTs, precision, scale, nullability, defaults, FKs | DROP TABLE IF EXISTS (strict reverse dependency order, zero CASCADE) | `pg_class` + `pg_constraint` + `information_schema` |
| **modifier_groups** | TABLE | `CREATE TABLE IF NOT EXISTS "modifier_groups"` | NO | Full structural validation | `CREATED_BY_PROMPT_12` | Full Revision 4 contract: PK (`['id']`), all columns, UDTs, precision, scale, nullability, defaults, FKs | DROP TABLE IF EXISTS (strict reverse dependency order, zero CASCADE) | `pg_class` + `pg_constraint` + `information_schema` |
| **modifier_items** | TABLE | `CREATE TABLE IF NOT EXISTS "modifier_items"` | NO | Full structural validation | `CREATED_BY_PROMPT_12` | Full Revision 4 contract: PK (`['id']`), all columns, UDTs, precision, scale, nullability, defaults, FKs | DROP TABLE IF EXISTS (strict reverse dependency order, zero CASCADE) | `pg_class` + `pg_constraint` + `information_schema` |
| **product_modifier_groups** | TABLE | `CREATE TABLE IF NOT EXISTS "product_modifier_groups"` | NO | Full structural validation | `CREATED_BY_PROMPT_12` | Full Revision 4 contract: PK (`['id']`), all columns, UDTs, precision, scale, nullability, defaults, FKs | DROP TABLE IF EXISTS (strict reverse dependency order, zero CASCADE) | `pg_class` + `pg_constraint` + `information_schema` |
| **modifier_recipe_effects** | TABLE | `CREATE TABLE IF NOT EXISTS "modifier_recipe_effects"` | NO | Full structural validation | `CREATED_BY_PROMPT_12` | Full Revision 4 contract: PK (`['id']`), all columns, UDTs, precision, scale, nullability, defaults, FKs | DROP TABLE IF EXISTS (strict reverse dependency order, zero CASCADE) | `pg_class` + `pg_constraint` + `information_schema` |
| **payment_transactions** | TABLE | `CREATE TABLE IF NOT EXISTS "payment_transactions"` | NO | Full structural validation | `CREATED_BY_PROMPT_12` | Full Revision 4 contract: PK (`['id']`), all columns, UDTs, precision, scale, nullability, defaults, FKs | DROP TABLE IF EXISTS (strict reverse dependency order, zero CASCADE) | `pg_class` + `pg_constraint` + `information_schema` |
| **refunds** | TABLE | `CREATE TABLE IF NOT EXISTS "refunds"` | NO | Full structural validation | `CREATED_BY_PROMPT_12` | Full Revision 4 contract: PK (`['id']`), all columns, UDTs, precision, scale, nullability, defaults, FKs | DROP TABLE IF EXISTS (strict reverse dependency order, zero CASCADE) | `pg_class` + `pg_constraint` + `information_schema` |
| **refund_items** | TABLE | `CREATE TABLE IF NOT EXISTS "refund_items"` | NO | Full structural validation | `CREATED_BY_PROMPT_12` | Full Revision 4 contract: PK (`['id']`), all columns, UDTs, precision, scale, nullability, defaults, FKs | DROP TABLE IF EXISTS (strict reverse dependency order, zero CASCADE) | `pg_class` + `pg_constraint` + `information_schema` |
| **idempotency_records** | TABLE | `CREATE TABLE IF NOT EXISTS "idempotency_records"` | NO | Full structural validation | `CREATED_BY_PROMPT_12` | Full Revision 4 contract: PK (`['id']`), all columns, UDTs, precision, scale, nullability, defaults, FKs | DROP TABLE IF EXISTS (strict reverse dependency order, zero CASCADE) | `pg_class` + `pg_constraint` + `information_schema` |
| **legacy_stock_movements** | TABLE | `CREATE TABLE IF NOT EXISTS "legacy_stock_movements"` | NO | Full structural validation | `CREATED_BY_PROMPT_12` | Full Revision 4 contract: PK (`['id']`), all columns, UDTs, precision, scale, nullability, defaults, FKs | DROP TABLE IF EXISTS (strict reverse dependency order, zero CASCADE) | `pg_class` + `pg_constraint` + `information_schema` |
| **tenants.business_vertical** | COLUMN | `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "business_vertical"` | NO | Semantic validation | `CREATED_BY_PROMPT_12` | Preflight UDT 'BusinessVertical', nullability 'NO' default 'RETAIL'::"BusinessVertical" | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **tenants.allow_negative_stock** | COLUMN | `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "allow_negative_stock"` | NO | Semantic validation | `CREATED_BY_PROMPT_12` | Preflight UDT 'bool', nullability 'NO' default false | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **tenants.enable_batch_tracking** | COLUMN | `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "enable_batch_tracking"` | NO | Semantic validation | `CREATED_BY_PROMPT_12` | Preflight UDT 'bool', nullability 'NO' default false | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **tenants.enable_recipe_tracking** | COLUMN | `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "enable_recipe_tracking"` | NO | Semantic validation | `CREATED_BY_PROMPT_12` | Preflight UDT 'bool', nullability 'NO' default false | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **users.user_code** | COLUMN | `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "user_code"` | NO | Semantic validation | `CREATED_BY_PROMPT_12` | Preflight UDT 'varchar', nullability 'YES' maxlen 50 | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **users.pin_hash** | COLUMN | `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pin_hash"` | NO | Semantic validation | `CREATED_BY_PROMPT_12` | Preflight UDT 'varchar', nullability 'YES' maxlen 255 | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **outlets.code** | COLUMN | `ALTER TABLE "outlets" ADD COLUMN IF NOT EXISTS "code"` | NO | Semantic validation | `CREATED_BY_PROMPT_12` | Preflight UDT 'varchar', nullability 'YES' maxlen 50 | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **products.type** | COLUMN | `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "type"` | NO | Semantic validation | `CREATED_BY_PROMPT_12` | Preflight UDT 'ProductType', nullability 'NO' default 'STANDARD'::"ProductType" | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **categories.parent_id** | COLUMN | `ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "parent_id"` | NO | Semantic validation | `CREATED_BY_PROMPT_12` | Preflight UDT 'text', nullability 'YES' | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **customers.loyalty_points** | COLUMN | `ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "loyalty_points"` | NO | Semantic validation | `CREATED_BY_PROMPT_12` | Preflight UDT 'int4', nullability 'NO' default 0 | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **customers.metadata** | COLUMN | `ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "metadata"` | NO | Semantic validation | `CREATED_BY_PROMPT_12` | Preflight UDT 'jsonb', nullability 'NO' default '{}'::jsonb | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **orders.order_status** | COLUMN | `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "order_status"` | NO | Semantic validation | `CREATED_BY_PROMPT_12` | Preflight UDT 'OrderStatus', nullability 'NO' default 'CONFIRMED'::"OrderStatus" | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **orders.order_type** | COLUMN | `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "order_type"` | NO | Semantic validation | `CREATED_BY_PROMPT_12` | Preflight UDT 'varchar', nullability 'NO' maxlen 50 default 'DINE_IN'::character varying | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **orders.service_total** | COLUMN | `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "service_total"` | NO | Semantic validation | `CREATED_BY_PROMPT_12` | Preflight UDT 'numeric', nullability 'NO' prec 15, scale 2 default 0 | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **orders.paid_amount** | COLUMN | `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paid_amount"` | NO | Semantic validation | `CREATED_BY_PROMPT_12` | Preflight UDT 'numeric', nullability 'NO' prec 15, scale 2 default 0 | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **orders.change_amount** | COLUMN | `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "change_amount"` | NO | Semantic validation | `CREATED_BY_PROMPT_12` | Preflight UDT 'numeric', nullability 'NO' prec 15, scale 2 default 0 | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **order_items.product_variant_id** | COLUMN | `ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "product_variant_id"` | NO | Semantic validation | `CREATED_BY_PROMPT_12` | Preflight UDT 'text', nullability 'YES' | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **order_items.product_name** | COLUMN | `ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "product_name"` | NO | Semantic validation | `CREATED_BY_PROMPT_12` | Preflight UDT 'text', nullability 'YES' | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **order_items.variant_name** | COLUMN | `ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "variant_name"` | NO | Semantic validation | `CREATED_BY_PROMPT_12` | Preflight UDT 'text', nullability 'YES' | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **order_items.sku** | COLUMN | `ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "sku"` | NO | Semantic validation | `CREATED_BY_PROMPT_12` | Preflight UDT 'text', nullability 'YES' | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **order_items.cost_price** | COLUMN | `ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "cost_price"` | NO | Semantic validation | `CREATED_BY_PROMPT_12` | Preflight UDT 'numeric', nullability 'NO' prec 15, scale 4 default 0 | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **order_items.discount_amount** | COLUMN | `ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "discount_amount"` | NO | Semantic validation | `CREATED_BY_PROMPT_12` | Preflight UDT 'numeric', nullability 'NO' prec 15, scale 2 default 0 | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **order_items.modifiers_snapshot** | COLUMN | `ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "modifiers_snapshot"` | NO | Semantic validation | `CREATED_BY_PROMPT_12` | Preflight UDT 'jsonb', nullability 'YES' | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **idx_idempotency_records_expiry** | INDEX | `CREATE INDEX IF NOT EXISTS "idx_idempotency_records_expiry" ON "idempotency_records" ("tenant_id", "expires_at")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness false, column array [tenant_id, expires_at], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_idempotency_records_key** | INDEX | `CREATE UNIQUE INDEX IF NOT EXISTS "idx_idempotency_records_key" ON "idempotency_records" ("tenant_id", "operation_type", "idempotency_key")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness true, column array [tenant_id, operation_type, idempotency_key], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_inventory_balances_batched** | INDEX | `CREATE UNIQUE INDEX IF NOT EXISTS "idx_inventory_balances_batched" ON "inventory_balances" ("tenant_id", "inventory_item_id", "storage_location_id", "inventory_batch_id") WHERE (inventory_batch_id IS NOT NULL)` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness true, column array [tenant_id, inventory_item_id, storage_location_id, inventory_batch_id], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_inventory_balances_location** | INDEX | `CREATE INDEX IF NOT EXISTS "idx_inventory_balances_location" ON "inventory_balances" ("tenant_id", "storage_location_id")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness false, column array [tenant_id, storage_location_id], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_inventory_balances_unbatched** | INDEX | `CREATE UNIQUE INDEX IF NOT EXISTS "idx_inventory_balances_unbatched" ON "inventory_balances" ("tenant_id", "inventory_item_id", "storage_location_id") WHERE (inventory_batch_id IS NULL)` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness true, column array [tenant_id, inventory_item_id, storage_location_id], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_inventory_batches_tenant_expiration** | INDEX | `CREATE INDEX IF NOT EXISTS "idx_inventory_batches_tenant_expiration" ON "inventory_batches" ("tenant_id", "expiration_date")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness false, column array [tenant_id, expiration_date], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_inventory_batches_tenant_item_batch** | INDEX | `CREATE UNIQUE INDEX IF NOT EXISTS "idx_inventory_batches_tenant_item_batch" ON "inventory_batches" ("tenant_id", "inventory_item_id", "batch_number")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness true, column array [tenant_id, inventory_item_id, batch_number], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_inventory_items_tenant_active** | INDEX | `CREATE INDEX IF NOT EXISTS "idx_inventory_items_tenant_active" ON "inventory_items" ("tenant_id", "is_active")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness false, column array [tenant_id, is_active], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_inventory_items_tenant_code** | INDEX | `CREATE UNIQUE INDEX IF NOT EXISTS "idx_inventory_items_tenant_code" ON "inventory_items" ("tenant_id", "item_code")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness true, column array [tenant_id, item_code], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_inventory_ledgers_batch** | INDEX | `CREATE INDEX IF NOT EXISTS "idx_inventory_ledgers_batch" ON "inventory_ledgers" ("tenant_id", "inventory_batch_id")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness false, column array [tenant_id, inventory_batch_id], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_inventory_ledgers_item_date** | INDEX | `CREATE INDEX IF NOT EXISTS "idx_inventory_ledgers_item_date" ON "inventory_ledgers" ("tenant_id", "inventory_item_id", "storage_location_id", "created_at")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness false, column array [tenant_id, inventory_item_id, storage_location_id, created_at], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_inventory_ledgers_ref** | INDEX | `CREATE INDEX IF NOT EXISTS "idx_inventory_ledgers_ref" ON "inventory_ledgers" ("tenant_id", "reference_type", "reference_id")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness false, column array [tenant_id, reference_type, reference_id], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_modifier_groups_tenant_name** | INDEX | `CREATE INDEX IF NOT EXISTS "idx_modifier_groups_tenant_name" ON "modifier_groups" ("tenant_id", "name")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness false, column array [tenant_id, name], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_modifier_items_group** | INDEX | `CREATE INDEX IF NOT EXISTS "idx_modifier_items_group" ON "modifier_items" ("tenant_id", "modifier_group_id")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness false, column array [tenant_id, modifier_group_id], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_modifier_recipe_effects_tenant** | INDEX | `CREATE INDEX IF NOT EXISTS "idx_modifier_recipe_effects_tenant" ON "modifier_recipe_effects" ("tenant_id", "inventory_item_id")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness false, column array [tenant_id, inventory_item_id], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_modifier_recipe_effects_unique** | INDEX | `CREATE UNIQUE INDEX IF NOT EXISTS "idx_modifier_recipe_effects_unique" ON "modifier_recipe_effects" ("modifier_item_id", "inventory_item_id")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness true, column array [modifier_item_id, inventory_item_id], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_payment_transactions_order** | INDEX | `CREATE INDEX IF NOT EXISTS "idx_payment_transactions_order" ON "payment_transactions" ("tenant_id", "order_id")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness false, column array [tenant_id, order_id], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_payment_transactions_status** | INDEX | `CREATE INDEX IF NOT EXISTS "idx_payment_transactions_status" ON "payment_transactions" ("tenant_id", "status")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness false, column array [tenant_id, status], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_product_modifier_groups_tenant** | INDEX | `CREATE INDEX IF NOT EXISTS "idx_product_modifier_groups_tenant" ON "product_modifier_groups" ("tenant_id", "modifier_group_id")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness false, column array [tenant_id, modifier_group_id], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_product_modifier_groups_unique** | INDEX | `CREATE UNIQUE INDEX IF NOT EXISTS "idx_product_modifier_groups_unique" ON "product_modifier_groups" ("product_id", "modifier_group_id")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness true, column array [product_id, modifier_group_id], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_product_variants_tenant_barcode** | INDEX | `CREATE UNIQUE INDEX IF NOT EXISTS "idx_product_variants_tenant_barcode" ON "product_variants" ("tenant_id", "barcode")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness true, column array [tenant_id, barcode], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_product_variants_tenant_item** | INDEX | `CREATE INDEX IF NOT EXISTS "idx_product_variants_tenant_item" ON "product_variants" ("tenant_id", "inventory_item_id")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness false, column array [tenant_id, inventory_item_id], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_product_variants_tenant_product** | INDEX | `CREATE INDEX IF NOT EXISTS "idx_product_variants_tenant_product" ON "product_variants" ("tenant_id", "product_id")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness false, column array [tenant_id, product_id], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_product_variants_tenant_sku** | INDEX | `CREATE UNIQUE INDEX IF NOT EXISTS "idx_product_variants_tenant_sku" ON "product_variants" ("tenant_id", "sku")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness true, column array [tenant_id, sku], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_recipe_items_recipe_item** | INDEX | `CREATE UNIQUE INDEX IF NOT EXISTS "idx_recipe_items_recipe_item" ON "recipe_items" ("recipe_id", "inventory_item_id")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness true, column array [recipe_id, inventory_item_id], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_recipe_items_tenant_item** | INDEX | `CREATE INDEX IF NOT EXISTS "idx_recipe_items_tenant_item" ON "recipe_items" ("tenant_id", "inventory_item_id")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness false, column array [tenant_id, inventory_item_id], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_refund_items_order_item** | INDEX | `CREATE INDEX IF NOT EXISTS "idx_refund_items_order_item" ON "refund_items" ("tenant_id", "order_item_id")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness false, column array [tenant_id, order_item_id], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_refund_items_refund** | INDEX | `CREATE INDEX IF NOT EXISTS "idx_refund_items_refund" ON "refund_items" ("tenant_id", "refund_id")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness false, column array [tenant_id, refund_id], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_refunds_order** | INDEX | `CREATE INDEX IF NOT EXISTS "idx_refunds_order" ON "refunds" ("tenant_id", "order_id")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness false, column array [tenant_id, order_id], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_refunds_tenant_number** | INDEX | `CREATE UNIQUE INDEX IF NOT EXISTS "idx_refunds_tenant_number" ON "refunds" ("tenant_id", "refund_number")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness true, column array [tenant_id, refund_number], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_storage_locations_tenant_outlet** | INDEX | `CREATE INDEX IF NOT EXISTS "idx_storage_locations_tenant_outlet" ON "storage_locations" ("tenant_id", "outlet_id", "is_default")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness false, column array [tenant_id, outlet_id, is_default], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_storage_locations_tenant_outlet_default** | INDEX | `CREATE UNIQUE INDEX IF NOT EXISTS "idx_storage_locations_tenant_outlet_default" ON "storage_locations" ("tenant_id", "outlet_id") WHERE (is_default = true)` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness true, column array [tenant_id, outlet_id], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_storage_locations_tenant_outlet_name** | INDEX | `CREATE UNIQUE INDEX IF NOT EXISTS "idx_storage_locations_tenant_outlet_name" ON "storage_locations" ("tenant_id", "outlet_id", "name")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness true, column array [tenant_id, outlet_id, name], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |
| **idx_unit_conversions_units** | INDEX | `CREATE UNIQUE INDEX IF NOT EXISTS "idx_unit_conversions_units" ON "unit_conversions" ("from_uom", "to_uom")` | NO | Full definition validation | `CREATED_BY_PROMPT_12` | Complete definition preflight: table, access method 'btree', uniqueness true, column array [from_uom, to_uom], partial predicate | DROP INDEX IF EXISTS (or with owned table) | `pg_indexes` + `pg_index` + Registry |

---

## 2. Full Target Table Structural Contracts (18 Domain Tables, 165 Columns)

Every target table is preflight-checked and validated against its complete schema definition: primary key, all column names, PostgreSQL UDTs, numeric precision/scale, character max length, nullability, and default expressions matching Target Database Schema Revision 4.

### 2.1 `inventory_items` (15 Columns, 1 Foreign Keys)

**Primary Key:** `['id']` (Single-column UUID/Text PK)

| Column | Data Type / UDT | Max Length | Precision | Scale | Nullable | Default Expression |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `id` | `text` | — | — | — | NO | — |
| `tenant_id` | `text` | — | — | — | NO | — |
| `item_code` | `varchar` | 50 | — | — | NO | — |
| `name` | `varchar` | 255 | — | — | NO | — |
| `description` | `text` | — | — | — | YES | — |
| `canonical_uom` | `varchar` | 20 | — | — | NO | — |
| `purchase_uom` | `varchar` | 20 | — | — | YES | — |
| `reorder_point` | `numeric` | — | 12 | 3 | NO | `0` |
| `target_level` | `numeric` | — | 12 | 3 | NO | `0` |
| `average_cost` | `numeric` | — | 15 | 4 | NO | `0` |
| `allow_negative_stock` | `bool` | — | — | — | YES | — |
| `is_batched` | `bool` | — | — | — | NO | `false` |
| `is_active` | `bool` | — | — | — | NO | `true` |
| `created_at` | `timestamp` | — | — | — | NO | `CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp` | — | — | — | NO | `CURRENT_TIMESTAMP` |

**Foreign Keys:**
- `inventory_items_tenant_id_fkey`: (`tenant_id`) -> `tenants`(`id`) ON DELETE RESTRICT

### 2.2 `product_variants` (12 Columns, 3 Foreign Keys)

**Primary Key:** `['id']` (Single-column UUID/Text PK)

| Column | Data Type / UDT | Max Length | Precision | Scale | Nullable | Default Expression |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `id` | `text` | — | — | — | NO | — |
| `tenant_id` | `text` | — | — | — | NO | — |
| `product_id` | `text` | — | — | — | NO | — |
| `inventory_item_id` | `text` | — | — | — | YES | — |
| `sku` | `varchar` | 100 | — | — | NO | — |
| `barcode` | `varchar` | 100 | — | — | YES | — |
| `name` | `varchar` | 255 | — | — | NO | — |
| `price` | `numeric` | — | 15 | 2 | NO | — |
| `inventory_quantity_multiplier` | `numeric` | — | 12 | 3 | NO | `1.000` |
| `is_active` | `bool` | — | — | — | NO | `true` |
| `created_at` | `timestamp` | — | — | — | NO | `CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp` | — | — | — | NO | `CURRENT_TIMESTAMP` |

**Foreign Keys:**
- `product_variants_inventory_item_id_fkey`: (`inventory_item_id`) -> `inventory_items`(`id`) ON DELETE RESTRICT
- `product_variants_product_id_fkey`: (`product_id`) -> `products`(`id`) ON DELETE CASCADE
- `product_variants_tenant_id_fkey`: (`tenant_id`) -> `tenants`(`id`) ON DELETE RESTRICT

### 2.3 `storage_locations` (10 Columns, 2 Foreign Keys)

**Primary Key:** `['id']` (Single-column UUID/Text PK)

| Column | Data Type / UDT | Max Length | Precision | Scale | Nullable | Default Expression |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `id` | `text` | — | — | — | NO | — |
| `tenant_id` | `text` | — | — | — | NO | — |
| `outlet_id` | `text` | — | — | — | NO | — |
| `name` | `varchar` | 100 | — | — | NO | — |
| `type` | `StorageLocationType` | — | — | — | NO | `'STOREFRONT'::"StorageLocationType"` |
| `is_default` | `bool` | — | — | — | NO | `false` |
| `allow_negative_stock` | `bool` | — | — | — | YES | — |
| `is_active` | `bool` | — | — | — | NO | `true` |
| `created_at` | `timestamp` | — | — | — | NO | `CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp` | — | — | — | NO | `CURRENT_TIMESTAMP` |

**Foreign Keys:**
- `storage_locations_outlet_id_fkey`: (`outlet_id`) -> `outlets`(`id`) ON DELETE RESTRICT
- `storage_locations_tenant_id_fkey`: (`tenant_id`) -> `tenants`(`id`) ON DELETE RESTRICT

### 2.4 `inventory_batches` (9 Columns, 2 Foreign Keys)

**Primary Key:** `['id']` (Single-column UUID/Text PK)

| Column | Data Type / UDT | Max Length | Precision | Scale | Nullable | Default Expression |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `id` | `text` | — | — | — | NO | — |
| `tenant_id` | `text` | — | — | — | NO | — |
| `inventory_item_id` | `text` | — | — | — | NO | — |
| `batch_number` | `varchar` | 100 | — | — | NO | — |
| `expiration_date` | `timestamp` | — | — | — | YES | — |
| `received_date` | `timestamp` | — | — | — | NO | `CURRENT_TIMESTAMP` |
| `cost_price` | `numeric` | — | 15 | 4 | NO | — |
| `is_active` | `bool` | — | — | — | NO | `true` |
| `created_at` | `timestamp` | — | — | — | NO | `CURRENT_TIMESTAMP` |

**Foreign Keys:**
- `inventory_batches_inventory_item_id_fkey`: (`inventory_item_id`) -> `inventory_items`(`id`) ON DELETE RESTRICT
- `inventory_batches_tenant_id_fkey`: (`tenant_id`) -> `tenants`(`id`) ON DELETE RESTRICT

### 2.5 `inventory_balances` (8 Columns, 4 Foreign Keys)

**Primary Key:** `['id']` (Single-column UUID/Text PK)

| Column | Data Type / UDT | Max Length | Precision | Scale | Nullable | Default Expression |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `id` | `text` | — | — | — | NO | — |
| `tenant_id` | `text` | — | — | — | NO | — |
| `inventory_item_id` | `text` | — | — | — | NO | — |
| `storage_location_id` | `text` | — | — | — | NO | — |
| `inventory_batch_id` | `text` | — | — | — | YES | — |
| `quantity_on_hand` | `numeric` | — | 12 | 3 | NO | `0` |
| `quantity_reserved` | `numeric` | — | 12 | 3 | NO | `0` |
| `updated_at` | `timestamp` | — | — | — | NO | `CURRENT_TIMESTAMP` |

**Foreign Keys:**
- `inventory_balances_inventory_batch_id_fkey`: (`inventory_batch_id`) -> `inventory_batches`(`id`) ON DELETE RESTRICT
- `inventory_balances_inventory_item_id_fkey`: (`inventory_item_id`) -> `inventory_items`(`id`) ON DELETE RESTRICT
- `inventory_balances_storage_location_id_fkey`: (`storage_location_id`) -> `storage_locations`(`id`) ON DELETE RESTRICT
- `inventory_balances_tenant_id_fkey`: (`tenant_id`) -> `tenants`(`id`) ON DELETE RESTRICT

### 2.6 `inventory_ledgers` (17 Columns, 5 Foreign Keys)

**Primary Key:** `['id']` (Single-column UUID/Text PK)

| Column | Data Type / UDT | Max Length | Precision | Scale | Nullable | Default Expression |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `id` | `text` | — | — | — | NO | — |
| `tenant_id` | `text` | — | — | — | NO | — |
| `inventory_item_id` | `text` | — | — | — | NO | — |
| `storage_location_id` | `text` | — | — | — | NO | — |
| `inventory_batch_id` | `text` | — | — | — | YES | — |
| `quantity_delta` | `numeric` | — | 12 | 3 | NO | — |
| `balance_before` | `numeric` | — | 12 | 3 | NO | — |
| `balance_after` | `numeric` | — | 12 | 3 | NO | — |
| `unit_cost` | `numeric` | — | 15 | 4 | NO | — |
| `movement_type` | `StockMovementType` | — | — | — | NO | — |
| `reference_type` | `InventoryRefType` | — | — | — | NO | — |
| `reference_id` | `text` | — | — | — | NO | — |
| `actor_type` | `ActorType` | — | — | — | NO | `'USER'::"ActorType"` |
| `actor_user_id` | `text` | — | — | — | YES | — |
| `is_negative_balance` | `bool` | — | — | — | NO | `false` |
| `notes` | `text` | — | — | — | YES | — |
| `created_at` | `timestamp` | — | — | — | NO | `CURRENT_TIMESTAMP` |

**Foreign Keys:**
- `inventory_ledgers_actor_user_id_fkey`: (`actor_user_id`) -> `users`(`id`) ON DELETE RESTRICT
- `inventory_ledgers_inventory_batch_id_fkey`: (`inventory_batch_id`) -> `inventory_batches`(`id`) ON DELETE RESTRICT
- `inventory_ledgers_inventory_item_id_fkey`: (`inventory_item_id`) -> `inventory_items`(`id`) ON DELETE RESTRICT
- `inventory_ledgers_storage_location_id_fkey`: (`storage_location_id`) -> `storage_locations`(`id`) ON DELETE RESTRICT
- `inventory_ledgers_tenant_id_fkey`: (`tenant_id`) -> `tenants`(`id`) ON DELETE RESTRICT

### 2.7 `unit_conversions` (6 Columns, 0 Foreign Keys)

**Primary Key:** `['id']` (Single-column UUID/Text PK)

| Column | Data Type / UDT | Max Length | Precision | Scale | Nullable | Default Expression |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `id` | `text` | — | — | — | NO | — |
| `from_uom` | `varchar` | 20 | — | — | NO | — |
| `to_uom` | `varchar` | 20 | — | — | NO | — |
| `conversion_factor` | `numeric` | — | 12 | 6 | NO | — |
| `uom_type` | `UomType` | — | — | — | NO | — |
| `is_base` | `bool` | — | — | — | NO | `false` |

### 2.8 `recipes` (7 Columns, 2 Foreign Keys)

**Primary Key:** `['id']` (Single-column UUID/Text PK)

| Column | Data Type / UDT | Max Length | Precision | Scale | Nullable | Default Expression |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `id` | `text` | — | — | — | NO | — |
| `tenant_id` | `text` | — | — | — | NO | — |
| `product_variant_id` | `text` | — | — | — | NO | — |
| `instructions` | `text` | — | — | — | YES | — |
| `yield_quantity` | `numeric` | — | 12 | 3 | NO | `1.000` |
| `created_at` | `timestamp` | — | — | — | NO | `CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp` | — | — | — | NO | `CURRENT_TIMESTAMP` |

**Foreign Keys:**
- `recipes_product_variant_id_fkey`: (`product_variant_id`) -> `product_variants`(`id`) ON DELETE CASCADE
- `recipes_tenant_id_fkey`: (`tenant_id`) -> `tenants`(`id`) ON DELETE RESTRICT

### 2.9 `recipe_items` (8 Columns, 3 Foreign Keys)

**Primary Key:** `['id']` (Single-column UUID/Text PK)

| Column | Data Type / UDT | Max Length | Precision | Scale | Nullable | Default Expression |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `id` | `text` | — | — | — | NO | — |
| `tenant_id` | `text` | — | — | — | NO | — |
| `recipe_id` | `text` | — | — | — | NO | — |
| `inventory_item_id` | `text` | — | — | — | NO | — |
| `quantity` | `numeric` | — | 12 | 3 | NO | — |
| `cost_ratio` | `numeric` | — | 5 | 4 | NO | `1.000` |
| `created_at` | `timestamp` | — | — | — | NO | `CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp` | — | — | — | NO | `CURRENT_TIMESTAMP` |

**Foreign Keys:**
- `recipe_items_inventory_item_id_fkey`: (`inventory_item_id`) -> `inventory_items`(`id`) ON DELETE RESTRICT
- `recipe_items_recipe_id_fkey`: (`recipe_id`) -> `recipes`(`id`) ON DELETE CASCADE
- `recipe_items_tenant_id_fkey`: (`tenant_id`) -> `tenants`(`id`) ON DELETE RESTRICT

### 2.10 `modifier_groups` (9 Columns, 1 Foreign Keys)

**Primary Key:** `['id']` (Single-column UUID/Text PK)

| Column | Data Type / UDT | Max Length | Precision | Scale | Nullable | Default Expression |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `id` | `text` | — | — | — | NO | — |
| `tenant_id` | `text` | — | — | — | NO | — |
| `name` | `varchar` | 100 | — | — | NO | — |
| `selection_type` | `SelectionType` | — | — | — | NO | `'SINGLE'::"SelectionType"` |
| `min_selection` | `int4` | — | 32 | 0 | NO | `0` |
| `max_selection` | `int4` | — | 32 | 0 | NO | `1` |
| `is_required` | `bool` | — | — | — | NO | `false` |
| `created_at` | `timestamp` | — | — | — | NO | `CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp` | — | — | — | NO | `CURRENT_TIMESTAMP` |

**Foreign Keys:**
- `modifier_groups_tenant_id_fkey`: (`tenant_id`) -> `tenants`(`id`) ON DELETE RESTRICT

### 2.11 `modifier_items` (8 Columns, 2 Foreign Keys)

**Primary Key:** `['id']` (Single-column UUID/Text PK)

| Column | Data Type / UDT | Max Length | Precision | Scale | Nullable | Default Expression |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `id` | `text` | — | — | — | NO | — |
| `tenant_id` | `text` | — | — | — | NO | — |
| `modifier_group_id` | `text` | — | — | — | NO | — |
| `name` | `varchar` | 100 | — | — | NO | — |
| `price_adjustment` | `numeric` | — | 15 | 2 | NO | `0` |
| `is_default` | `bool` | — | — | — | NO | `false` |
| `created_at` | `timestamp` | — | — | — | NO | `CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp` | — | — | — | NO | `CURRENT_TIMESTAMP` |

**Foreign Keys:**
- `modifier_items_modifier_group_id_fkey`: (`modifier_group_id`) -> `modifier_groups`(`id`) ON DELETE CASCADE
- `modifier_items_tenant_id_fkey`: (`tenant_id`) -> `tenants`(`id`) ON DELETE RESTRICT

### 2.12 `product_modifier_groups` (6 Columns, 3 Foreign Keys)

**Primary Key:** `['id']` (Single-column UUID/Text PK)

| Column | Data Type / UDT | Max Length | Precision | Scale | Nullable | Default Expression |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `id` | `text` | — | — | — | NO | — |
| `tenant_id` | `text` | — | — | — | NO | — |
| `product_id` | `text` | — | — | — | NO | — |
| `modifier_group_id` | `text` | — | — | — | NO | — |
| `sort_order` | `int4` | — | 32 | 0 | NO | `0` |
| `created_at` | `timestamp` | — | — | — | NO | `CURRENT_TIMESTAMP` |

**Foreign Keys:**
- `product_modifier_groups_modifier_group_id_fkey`: (`modifier_group_id`) -> `modifier_groups`(`id`) ON DELETE RESTRICT
- `product_modifier_groups_product_id_fkey`: (`product_id`) -> `products`(`id`) ON DELETE CASCADE
- `product_modifier_groups_tenant_id_fkey`: (`tenant_id`) -> `tenants`(`id`) ON DELETE RESTRICT

### 2.13 `modifier_recipe_effects` (6 Columns, 3 Foreign Keys)

**Primary Key:** `['id']` (Single-column UUID/Text PK)

| Column | Data Type / UDT | Max Length | Precision | Scale | Nullable | Default Expression |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `id` | `text` | — | — | — | NO | — |
| `tenant_id` | `text` | — | — | — | NO | — |
| `modifier_item_id` | `text` | — | — | — | NO | — |
| `inventory_item_id` | `text` | — | — | — | NO | — |
| `quantity_delta` | `numeric` | — | 12 | 3 | NO | — |
| `created_at` | `timestamp` | — | — | — | NO | `CURRENT_TIMESTAMP` |

**Foreign Keys:**
- `modifier_recipe_effects_inventory_item_id_fkey`: (`inventory_item_id`) -> `inventory_items`(`id`) ON DELETE RESTRICT
- `modifier_recipe_effects_modifier_item_id_fkey`: (`modifier_item_id`) -> `modifier_items`(`id`) ON DELETE CASCADE
- `modifier_recipe_effects_tenant_id_fkey`: (`tenant_id`) -> `tenants`(`id`) ON DELETE RESTRICT

### 2.14 `payment_transactions` (11 Columns, 2 Foreign Keys)

**Primary Key:** `['id']` (Single-column UUID/Text PK)

| Column | Data Type / UDT | Max Length | Precision | Scale | Nullable | Default Expression |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `id` | `text` | — | — | — | NO | — |
| `tenant_id` | `text` | — | — | — | NO | — |
| `order_id` | `text` | — | — | — | NO | — |
| `payment_method` | `PaymentMethod` | — | — | — | NO | — |
| `amount` | `numeric` | — | 15 | 2 | NO | — |
| `reference_number` | `varchar` | 100 | — | — | YES | — |
| `gateway_provider` | `varchar` | 50 | — | — | YES | — |
| `status` | `PaymentTxStatus` | — | — | — | NO | `'PENDING'::"PaymentTxStatus"` |
| `metadata` | `jsonb` | — | — | — | YES | — |
| `paid_at` | `timestamp` | — | — | — | YES | — |
| `created_at` | `timestamp` | — | — | — | NO | `CURRENT_TIMESTAMP` |

**Foreign Keys:**
- `payment_transactions_order_id_fkey`: (`order_id`) -> `orders`(`id`) ON DELETE RESTRICT
- `payment_transactions_tenant_id_fkey`: (`tenant_id`) -> `tenants`(`id`) ON DELETE RESTRICT

### 2.15 `refunds` (9 Columns, 3 Foreign Keys)

**Primary Key:** `['id']` (Single-column UUID/Text PK)

| Column | Data Type / UDT | Max Length | Precision | Scale | Nullable | Default Expression |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `id` | `text` | — | — | — | NO | — |
| `tenant_id` | `text` | — | — | — | NO | — |
| `order_id` | `text` | — | — | — | NO | — |
| `payment_transaction_id` | `text` | — | — | — | YES | — |
| `refund_number` | `varchar` | 100 | — | — | NO | — |
| `amount` | `numeric` | — | 15 | 2 | NO | — |
| `reason` | `RefundReason` | — | — | — | NO | `'CUSTOMER_RETURN'::"RefundReason"` |
| `notes` | `text` | — | — | — | YES | — |
| `created_at` | `timestamp` | — | — | — | NO | `CURRENT_TIMESTAMP` |

**Foreign Keys:**
- `refunds_order_id_fkey`: (`order_id`) -> `orders`(`id`) ON DELETE RESTRICT
- `refunds_payment_transaction_id_fkey`: (`payment_transaction_id`) -> `payment_transactions`(`id`) ON DELETE RESTRICT
- `refunds_tenant_id_fkey`: (`tenant_id`) -> `tenants`(`id`) ON DELETE RESTRICT

### 2.16 `refund_items` (7 Columns, 3 Foreign Keys)

**Primary Key:** `['id']` (Single-column UUID/Text PK)

| Column | Data Type / UDT | Max Length | Precision | Scale | Nullable | Default Expression |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `id` | `text` | — | — | — | NO | — |
| `tenant_id` | `text` | — | — | — | NO | — |
| `refund_id` | `text` | — | — | — | NO | — |
| `order_item_id` | `text` | — | — | — | NO | — |
| `quantity` | `numeric` | — | 12 | 3 | NO | — |
| `amount` | `numeric` | — | 15 | 2 | NO | — |
| `restock_item` | `bool` | — | — | — | NO | `true` |

**Foreign Keys:**
- `refund_items_order_item_id_fkey`: (`order_item_id`) -> `order_items`(`id`) ON DELETE RESTRICT
- `refund_items_refund_id_fkey`: (`refund_id`) -> `refunds`(`id`) ON DELETE CASCADE
- `refund_items_tenant_id_fkey`: (`tenant_id`) -> `tenants`(`id`) ON DELETE RESTRICT

### 2.17 `idempotency_records` (9 Columns, 1 Foreign Keys)

**Primary Key:** `['id']` (Single-column UUID/Text PK)

| Column | Data Type / UDT | Max Length | Precision | Scale | Nullable | Default Expression |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `id` | `text` | — | — | — | NO | — |
| `tenant_id` | `text` | — | — | — | NO | — |
| `operation_type` | `varchar` | 50 | — | — | NO | — |
| `idempotency_key` | `varchar` | 255 | — | — | NO | — |
| `request_hash` | `varchar` | 64 | — | — | YES | — |
| `status_code` | `int4` | — | 32 | 0 | YES | — |
| `response_body` | `jsonb` | — | — | — | YES | — |
| `created_at` | `timestamp` | — | — | — | NO | `CURRENT_TIMESTAMP` |
| `expires_at` | `timestamp` | — | — | — | NO | — |

**Foreign Keys:**
- `idempotency_records_tenant_id_fkey`: (`tenant_id`) -> `tenants`(`id`) ON DELETE CASCADE

### 2.18 `legacy_stock_movements` (8 Columns, 0 Foreign Keys)

**Primary Key:** `['id']` (Single-column UUID/Text PK)

| Column | Data Type / UDT | Max Length | Precision | Scale | Nullable | Default Expression |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `id` | `text` | — | — | — | NO | — |
| `outlet_id` | `text` | — | — | — | YES | — |
| `product_id` | `text` | — | — | — | YES | — |
| `type` | `varchar` | 50 | — | — | YES | — |
| `quantity` | `int4` | — | 32 | 0 | YES | — |
| `notes` | `text` | — | — | — | YES | — |
| `created_at` | `timestamp` | — | — | — | YES | — |
| `archived_at` | `timestamp` | — | — | — | NO | `CURRENT_TIMESTAMP` |

---

## 3. Transition Columns & Foreign Keys (23 Columns across 8 Tables, 2 Foreign Keys)

Transition columns bridge existing legacy tables to the normalized Target Database Schema Revision 4 domain models during the Expand phase.

| # | Table | Column Name | UDT | Max Length | Precision | Scale | Nullable | Default Expression | FK Target | ON DELETE |
| :-: | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- | :--- | :--- |
| 1 | `tenants` | `business_vertical` | `BusinessVertical` | — | — | — | NO | `'RETAIL'::"BusinessVertical"` | — | — |
| 2 | `tenants` | `allow_negative_stock` | `bool` | — | — | — | NO | `false` | — | — |
| 3 | `tenants` | `enable_batch_tracking` | `bool` | — | — | — | NO | `false` | — | — |
| 4 | `tenants` | `enable_recipe_tracking` | `bool` | — | — | — | NO | `false` | — | — |
| 5 | `users` | `user_code` | `varchar` | 50 | — | — | YES | — | — | — |
| 6 | `users` | `pin_hash` | `varchar` | 255 | — | — | YES | — | — | — |
| 7 | `outlets` | `code` | `varchar` | 50 | — | — | YES | — | — | — |
| 8 | `products` | `type` | `ProductType` | — | — | — | NO | `'STANDARD'::"ProductType"` | — | — |
| 9 | `categories` | `parent_id` | `text` | — | — | — | YES | — | `categories(id)` | SET NULL |
| 10 | `customers` | `loyalty_points` | `int4` | — | — | — | NO | `0` | — | — |
| 11 | `customers` | `metadata` | `jsonb` | — | — | — | NO | `'{}'::jsonb` | — | — |
| 12 | `orders` | `order_status` | `OrderStatus` | — | — | — | NO | `'CONFIRMED'::"OrderStatus"` | — | — |
| 13 | `orders` | `order_type` | `varchar` | 50 | — | — | NO | `'DINE_IN'::character varying` | — | — |
| 14 | `orders` | `service_total` | `numeric` | — | 15 | 2 | NO | `0` | — | — |
| 15 | `orders` | `paid_amount` | `numeric` | — | 15 | 2 | NO | `0` | — | — |
| 16 | `orders` | `change_amount` | `numeric` | — | 15 | 2 | NO | `0` | — | — |
| 17 | `order_items` | `product_variant_id` | `text` | — | — | — | YES | — | `product_variants(id)` | RESTRICT |
| 18 | `order_items` | `product_name` | `text` | — | — | — | YES | — | — | — |
| 19 | `order_items` | `variant_name` | `text` | — | — | — | YES | — | — | — |
| 20 | `order_items` | `sku` | `text` | — | — | — | YES | — | — | — |
| 21 | `order_items` | `cost_price` | `numeric` | — | 15 | 4 | NO | `0` | — | — |
| 22 | `order_items` | `discount_amount` | `numeric` | — | 15 | 2 | NO | `0` | — | — |
| 23 | `order_items` | `modifiers_snapshot` | `jsonb` | — | — | — | YES | — | — | — |

---

## 4. Complete Index Contract Inventory (34 Explicit Indexes)

Every index is validated on all 8 architectural dimensions: parent table, index name, uniqueness, access method, ordered indexed columns, column sequence, expressions, and partial filter predicates.

| # | Index Name | Parent Table | Unique | Method | Ordered Columns | Partial Predicate | Ownership | Catalog Definition |
| :-: | :--- | :--- | :---: | :---: | :--- | :--- | :--- | :--- |
| 1 | `idx_idempotency_records_expiry` | `idempotency_records` | NO | `btree` | `[tenant_id, expires_at]` | — | `CREATED_BY_PROMPT_12` | `CREATE INDEX idx_idempotency_records_expiry ON idempotency_records USING btree (tenant_id, expires_at)` |
| 2 | `idx_idempotency_records_key` | `idempotency_records` | YES | `btree` | `[tenant_id, operation_type, idempotency_key]` | — | `CREATED_BY_PROMPT_12` | `CREATE UNIQUE INDEX idx_idempotency_records_key ON idempotency_records USING btree (tenant_id, operation_type, idempotency_key)` |
| 3 | `idx_inventory_balances_batched` | `inventory_balances` | YES | `btree` | `[tenant_id, inventory_item_id, storage_location_id, inventory_batch_id]` | `(inventory_batch_id IS NOT NULL)` | `CREATED_BY_PROMPT_12` | `CREATE UNIQUE INDEX idx_inventory_balances_batched ON inventory_balances USING btree (tenant_id, inventory_item_id, storage_location_id, inventory_batch_id) WHERE (inventory_batch_id IS NOT NULL)` |
| 4 | `idx_inventory_balances_location` | `inventory_balances` | NO | `btree` | `[tenant_id, storage_location_id]` | — | `CREATED_BY_PROMPT_12` | `CREATE INDEX idx_inventory_balances_location ON inventory_balances USING btree (tenant_id, storage_location_id)` |
| 5 | `idx_inventory_balances_unbatched` | `inventory_balances` | YES | `btree` | `[tenant_id, inventory_item_id, storage_location_id]` | `(inventory_batch_id IS NULL)` | `CREATED_BY_PROMPT_12` | `CREATE UNIQUE INDEX idx_inventory_balances_unbatched ON inventory_balances USING btree (tenant_id, inventory_item_id, storage_location_id) WHERE (inventory_batch_id IS NULL)` |
| 6 | `idx_inventory_batches_tenant_expiration` | `inventory_batches` | NO | `btree` | `[tenant_id, expiration_date]` | — | `CREATED_BY_PROMPT_12` | `CREATE INDEX idx_inventory_batches_tenant_expiration ON inventory_batches USING btree (tenant_id, expiration_date)` |
| 7 | `idx_inventory_batches_tenant_item_batch` | `inventory_batches` | YES | `btree` | `[tenant_id, inventory_item_id, batch_number]` | — | `CREATED_BY_PROMPT_12` | `CREATE UNIQUE INDEX idx_inventory_batches_tenant_item_batch ON inventory_batches USING btree (tenant_id, inventory_item_id, batch_number)` |
| 8 | `idx_inventory_items_tenant_active` | `inventory_items` | NO | `btree` | `[tenant_id, is_active]` | — | `CREATED_BY_PROMPT_12` | `CREATE INDEX idx_inventory_items_tenant_active ON inventory_items USING btree (tenant_id, is_active)` |
| 9 | `idx_inventory_items_tenant_code` | `inventory_items` | YES | `btree` | `[tenant_id, item_code]` | — | `CREATED_BY_PROMPT_12` | `CREATE UNIQUE INDEX idx_inventory_items_tenant_code ON inventory_items USING btree (tenant_id, item_code)` |
| 10 | `idx_inventory_ledgers_batch` | `inventory_ledgers` | NO | `btree` | `[tenant_id, inventory_batch_id]` | — | `CREATED_BY_PROMPT_12` | `CREATE INDEX idx_inventory_ledgers_batch ON inventory_ledgers USING btree (tenant_id, inventory_batch_id)` |
| 11 | `idx_inventory_ledgers_item_date` | `inventory_ledgers` | NO | `btree` | `[tenant_id, inventory_item_id, storage_location_id, created_at]` | — | `CREATED_BY_PROMPT_12` | `CREATE INDEX idx_inventory_ledgers_item_date ON inventory_ledgers USING btree (tenant_id, inventory_item_id, storage_location_id, created_at)` |
| 12 | `idx_inventory_ledgers_ref` | `inventory_ledgers` | NO | `btree` | `[tenant_id, reference_type, reference_id]` | — | `CREATED_BY_PROMPT_12` | `CREATE INDEX idx_inventory_ledgers_ref ON inventory_ledgers USING btree (tenant_id, reference_type, reference_id)` |
| 13 | `idx_modifier_groups_tenant_name` | `modifier_groups` | NO | `btree` | `[tenant_id, name]` | — | `CREATED_BY_PROMPT_12` | `CREATE INDEX idx_modifier_groups_tenant_name ON modifier_groups USING btree (tenant_id, name)` |
| 14 | `idx_modifier_items_group` | `modifier_items` | NO | `btree` | `[tenant_id, modifier_group_id]` | — | `CREATED_BY_PROMPT_12` | `CREATE INDEX idx_modifier_items_group ON modifier_items USING btree (tenant_id, modifier_group_id)` |
| 15 | `idx_modifier_recipe_effects_tenant` | `modifier_recipe_effects` | NO | `btree` | `[tenant_id, inventory_item_id]` | — | `CREATED_BY_PROMPT_12` | `CREATE INDEX idx_modifier_recipe_effects_tenant ON modifier_recipe_effects USING btree (tenant_id, inventory_item_id)` |
| 16 | `idx_modifier_recipe_effects_unique` | `modifier_recipe_effects` | YES | `btree` | `[modifier_item_id, inventory_item_id]` | — | `CREATED_BY_PROMPT_12` | `CREATE UNIQUE INDEX idx_modifier_recipe_effects_unique ON modifier_recipe_effects USING btree (modifier_item_id, inventory_item_id)` |
| 17 | `idx_payment_transactions_order` | `payment_transactions` | NO | `btree` | `[tenant_id, order_id]` | — | `CREATED_BY_PROMPT_12` | `CREATE INDEX idx_payment_transactions_order ON payment_transactions USING btree (tenant_id, order_id)` |
| 18 | `idx_payment_transactions_status` | `payment_transactions` | NO | `btree` | `[tenant_id, status]` | — | `CREATED_BY_PROMPT_12` | `CREATE INDEX idx_payment_transactions_status ON payment_transactions USING btree (tenant_id, status)` |
| 19 | `idx_product_modifier_groups_tenant` | `product_modifier_groups` | NO | `btree` | `[tenant_id, modifier_group_id]` | — | `CREATED_BY_PROMPT_12` | `CREATE INDEX idx_product_modifier_groups_tenant ON product_modifier_groups USING btree (tenant_id, modifier_group_id)` |
| 20 | `idx_product_modifier_groups_unique` | `product_modifier_groups` | YES | `btree` | `[product_id, modifier_group_id]` | — | `CREATED_BY_PROMPT_12` | `CREATE UNIQUE INDEX idx_product_modifier_groups_unique ON product_modifier_groups USING btree (product_id, modifier_group_id)` |
| 21 | `idx_product_variants_tenant_barcode` | `product_variants` | YES | `btree` | `[tenant_id, barcode]` | — | `CREATED_BY_PROMPT_12` | `CREATE UNIQUE INDEX idx_product_variants_tenant_barcode ON product_variants USING btree (tenant_id, barcode)` |
| 22 | `idx_product_variants_tenant_item` | `product_variants` | NO | `btree` | `[tenant_id, inventory_item_id]` | — | `CREATED_BY_PROMPT_12` | `CREATE INDEX idx_product_variants_tenant_item ON product_variants USING btree (tenant_id, inventory_item_id)` |
| 23 | `idx_product_variants_tenant_product` | `product_variants` | NO | `btree` | `[tenant_id, product_id]` | — | `CREATED_BY_PROMPT_12` | `CREATE INDEX idx_product_variants_tenant_product ON product_variants USING btree (tenant_id, product_id)` |
| 24 | `idx_product_variants_tenant_sku` | `product_variants` | YES | `btree` | `[tenant_id, sku]` | — | `CREATED_BY_PROMPT_12` | `CREATE UNIQUE INDEX idx_product_variants_tenant_sku ON product_variants USING btree (tenant_id, sku)` |
| 25 | `idx_recipe_items_recipe_item` | `recipe_items` | YES | `btree` | `[recipe_id, inventory_item_id]` | — | `CREATED_BY_PROMPT_12` | `CREATE UNIQUE INDEX idx_recipe_items_recipe_item ON recipe_items USING btree (recipe_id, inventory_item_id)` |
| 26 | `idx_recipe_items_tenant_item` | `recipe_items` | NO | `btree` | `[tenant_id, inventory_item_id]` | — | `CREATED_BY_PROMPT_12` | `CREATE INDEX idx_recipe_items_tenant_item ON recipe_items USING btree (tenant_id, inventory_item_id)` |
| 27 | `idx_refund_items_order_item` | `refund_items` | NO | `btree` | `[tenant_id, order_item_id]` | — | `CREATED_BY_PROMPT_12` | `CREATE INDEX idx_refund_items_order_item ON refund_items USING btree (tenant_id, order_item_id)` |
| 28 | `idx_refund_items_refund` | `refund_items` | NO | `btree` | `[tenant_id, refund_id]` | — | `CREATED_BY_PROMPT_12` | `CREATE INDEX idx_refund_items_refund ON refund_items USING btree (tenant_id, refund_id)` |
| 29 | `idx_refunds_order` | `refunds` | NO | `btree` | `[tenant_id, order_id]` | — | `CREATED_BY_PROMPT_12` | `CREATE INDEX idx_refunds_order ON refunds USING btree (tenant_id, order_id)` |
| 30 | `idx_refunds_tenant_number` | `refunds` | YES | `btree` | `[tenant_id, refund_number]` | — | `CREATED_BY_PROMPT_12` | `CREATE UNIQUE INDEX idx_refunds_tenant_number ON refunds USING btree (tenant_id, refund_number)` |
| 31 | `idx_storage_locations_tenant_outlet` | `storage_locations` | NO | `btree` | `[tenant_id, outlet_id, is_default]` | — | `CREATED_BY_PROMPT_12` | `CREATE INDEX idx_storage_locations_tenant_outlet ON storage_locations USING btree (tenant_id, outlet_id, is_default)` |
| 32 | `idx_storage_locations_tenant_outlet_default` | `storage_locations` | YES | `btree` | `[tenant_id, outlet_id]` | `(is_default = true)` | `CREATED_BY_PROMPT_12` | `CREATE UNIQUE INDEX idx_storage_locations_tenant_outlet_default ON storage_locations USING btree (tenant_id, outlet_id) WHERE (is_default = true)` |
| 33 | `idx_storage_locations_tenant_outlet_name` | `storage_locations` | YES | `btree` | `[tenant_id, outlet_id, name]` | — | `CREATED_BY_PROMPT_12` | `CREATE UNIQUE INDEX idx_storage_locations_tenant_outlet_name ON storage_locations USING btree (tenant_id, outlet_id, name)` |
| 34 | `idx_unit_conversions_units` | `unit_conversions` | YES | `btree` | `[from_uom, to_uom]` | — | `CREATED_BY_PROMPT_12` | `CREATE UNIQUE INDEX idx_unit_conversions_units ON unit_conversions USING btree (from_uom, to_uom)` |

*(Note: `recipes_product_variant_id_key` is the underlying UNIQUE constraint backing index on `recipes(product_variant_id)`, automatically managed by PostgreSQL constraint semantics).*

---

## 5. Complete Foreign Key / Constraint Accounting (42 Foreign Keys)

The migration defines exactly 42 foreign key constraints:
- **40 Target-Table Foreign Keys:** Owned directly by the 18 target domain tables. When target tables are dropped during rollback, PostgreSQL automatically and cleanly removes these constraints.
- **2 Transition-Column Foreign Keys:** Attached to legacy tables (`categories.parent_id` referencing `categories(id)` ON DELETE SET NULL, and `order_items.product_variant_id` referencing `product_variants(id)` ON DELETE RESTRICT). Verified and preflight-checked in Section 1.3.

| # | Constraint Name | Owning Table | Local Columns | Referenced Table | Referenced Columns | ON DELETE | Lifecycle / Rollback Action |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `idempotency_records_tenant_id_fkey` | `idempotency_records` | `[tenant_id]` | `tenants` | `[id]` | CASCADE | Automatically dropped when target table `idempotency_records` is dropped |
| 2 | `inventory_balances_inventory_batch_id_fkey` | `inventory_balances` | `[inventory_batch_id]` | `inventory_batches` | `[id]` | RESTRICT | Automatically dropped when target table `inventory_balances` is dropped |
| 3 | `inventory_balances_inventory_item_id_fkey` | `inventory_balances` | `[inventory_item_id]` | `inventory_items` | `[id]` | RESTRICT | Automatically dropped when target table `inventory_balances` is dropped |
| 4 | `inventory_balances_storage_location_id_fkey` | `inventory_balances` | `[storage_location_id]` | `storage_locations` | `[id]` | RESTRICT | Automatically dropped when target table `inventory_balances` is dropped |
| 5 | `inventory_balances_tenant_id_fkey` | `inventory_balances` | `[tenant_id]` | `tenants` | `[id]` | RESTRICT | Automatically dropped when target table `inventory_balances` is dropped |
| 6 | `inventory_batches_inventory_item_id_fkey` | `inventory_batches` | `[inventory_item_id]` | `inventory_items` | `[id]` | RESTRICT | Automatically dropped when target table `inventory_batches` is dropped |
| 7 | `inventory_batches_tenant_id_fkey` | `inventory_batches` | `[tenant_id]` | `tenants` | `[id]` | RESTRICT | Automatically dropped when target table `inventory_batches` is dropped |
| 8 | `inventory_items_tenant_id_fkey` | `inventory_items` | `[tenant_id]` | `tenants` | `[id]` | RESTRICT | Automatically dropped when target table `inventory_items` is dropped |
| 9 | `inventory_ledgers_actor_user_id_fkey` | `inventory_ledgers` | `[actor_user_id]` | `users` | `[id]` | RESTRICT | Automatically dropped when target table `inventory_ledgers` is dropped |
| 10 | `inventory_ledgers_inventory_batch_id_fkey` | `inventory_ledgers` | `[inventory_batch_id]` | `inventory_batches` | `[id]` | RESTRICT | Automatically dropped when target table `inventory_ledgers` is dropped |
| 11 | `inventory_ledgers_inventory_item_id_fkey` | `inventory_ledgers` | `[inventory_item_id]` | `inventory_items` | `[id]` | RESTRICT | Automatically dropped when target table `inventory_ledgers` is dropped |
| 12 | `inventory_ledgers_storage_location_id_fkey` | `inventory_ledgers` | `[storage_location_id]` | `storage_locations` | `[id]` | RESTRICT | Automatically dropped when target table `inventory_ledgers` is dropped |
| 13 | `inventory_ledgers_tenant_id_fkey` | `inventory_ledgers` | `[tenant_id]` | `tenants` | `[id]` | RESTRICT | Automatically dropped when target table `inventory_ledgers` is dropped |
| 14 | `modifier_groups_tenant_id_fkey` | `modifier_groups` | `[tenant_id]` | `tenants` | `[id]` | RESTRICT | Automatically dropped when target table `modifier_groups` is dropped |
| 15 | `modifier_items_modifier_group_id_fkey` | `modifier_items` | `[modifier_group_id]` | `modifier_groups` | `[id]` | CASCADE | Automatically dropped when target table `modifier_items` is dropped |
| 16 | `modifier_items_tenant_id_fkey` | `modifier_items` | `[tenant_id]` | `tenants` | `[id]` | RESTRICT | Automatically dropped when target table `modifier_items` is dropped |
| 17 | `modifier_recipe_effects_inventory_item_id_fkey` | `modifier_recipe_effects` | `[inventory_item_id]` | `inventory_items` | `[id]` | RESTRICT | Automatically dropped when target table `modifier_recipe_effects` is dropped |
| 18 | `modifier_recipe_effects_modifier_item_id_fkey` | `modifier_recipe_effects` | `[modifier_item_id]` | `modifier_items` | `[id]` | CASCADE | Automatically dropped when target table `modifier_recipe_effects` is dropped |
| 19 | `modifier_recipe_effects_tenant_id_fkey` | `modifier_recipe_effects` | `[tenant_id]` | `tenants` | `[id]` | RESTRICT | Automatically dropped when target table `modifier_recipe_effects` is dropped |
| 20 | `payment_transactions_order_id_fkey` | `payment_transactions` | `[order_id]` | `orders` | `[id]` | RESTRICT | Automatically dropped when target table `payment_transactions` is dropped |
| 21 | `payment_transactions_tenant_id_fkey` | `payment_transactions` | `[tenant_id]` | `tenants` | `[id]` | RESTRICT | Automatically dropped when target table `payment_transactions` is dropped |
| 22 | `product_modifier_groups_modifier_group_id_fkey` | `product_modifier_groups` | `[modifier_group_id]` | `modifier_groups` | `[id]` | RESTRICT | Automatically dropped when target table `product_modifier_groups` is dropped |
| 23 | `product_modifier_groups_product_id_fkey` | `product_modifier_groups` | `[product_id]` | `products` | `[id]` | CASCADE | Automatically dropped when target table `product_modifier_groups` is dropped |
| 24 | `product_modifier_groups_tenant_id_fkey` | `product_modifier_groups` | `[tenant_id]` | `tenants` | `[id]` | RESTRICT | Automatically dropped when target table `product_modifier_groups` is dropped |
| 25 | `product_variants_inventory_item_id_fkey` | `product_variants` | `[inventory_item_id]` | `inventory_items` | `[id]` | RESTRICT | Automatically dropped when target table `product_variants` is dropped |
| 26 | `product_variants_product_id_fkey` | `product_variants` | `[product_id]` | `products` | `[id]` | CASCADE | Automatically dropped when target table `product_variants` is dropped |
| 27 | `product_variants_tenant_id_fkey` | `product_variants` | `[tenant_id]` | `tenants` | `[id]` | RESTRICT | Automatically dropped when target table `product_variants` is dropped |
| 28 | `recipe_items_inventory_item_id_fkey` | `recipe_items` | `[inventory_item_id]` | `inventory_items` | `[id]` | RESTRICT | Automatically dropped when target table `recipe_items` is dropped |
| 29 | `recipe_items_recipe_id_fkey` | `recipe_items` | `[recipe_id]` | `recipes` | `[id]` | CASCADE | Automatically dropped when target table `recipe_items` is dropped |
| 30 | `recipe_items_tenant_id_fkey` | `recipe_items` | `[tenant_id]` | `tenants` | `[id]` | RESTRICT | Automatically dropped when target table `recipe_items` is dropped |
| 31 | `recipes_product_variant_id_fkey` | `recipes` | `[product_variant_id]` | `product_variants` | `[id]` | CASCADE | Automatically dropped when target table `recipes` is dropped |
| 32 | `recipes_tenant_id_fkey` | `recipes` | `[tenant_id]` | `tenants` | `[id]` | RESTRICT | Automatically dropped when target table `recipes` is dropped |
| 33 | `refund_items_order_item_id_fkey` | `refund_items` | `[order_item_id]` | `order_items` | `[id]` | RESTRICT | Automatically dropped when target table `refund_items` is dropped |
| 34 | `refund_items_refund_id_fkey` | `refund_items` | `[refund_id]` | `refunds` | `[id]` | CASCADE | Automatically dropped when target table `refund_items` is dropped |
| 35 | `refund_items_tenant_id_fkey` | `refund_items` | `[tenant_id]` | `tenants` | `[id]` | RESTRICT | Automatically dropped when target table `refund_items` is dropped |
| 36 | `refunds_order_id_fkey` | `refunds` | `[order_id]` | `orders` | `[id]` | RESTRICT | Automatically dropped when target table `refunds` is dropped |
| 37 | `refunds_payment_transaction_id_fkey` | `refunds` | `[payment_transaction_id]` | `payment_transactions` | `[id]` | RESTRICT | Automatically dropped when target table `refunds` is dropped |
| 38 | `refunds_tenant_id_fkey` | `refunds` | `[tenant_id]` | `tenants` | `[id]` | RESTRICT | Automatically dropped when target table `refunds` is dropped |
| 39 | `storage_locations_outlet_id_fkey` | `storage_locations` | `[outlet_id]` | `outlets` | `[id]` | RESTRICT | Automatically dropped when target table `storage_locations` is dropped |
| 40 | `storage_locations_tenant_id_fkey` | `storage_locations` | `[tenant_id]` | `tenants` | `[id]` | RESTRICT | Automatically dropped when target table `storage_locations` is dropped |
| 41 | `categories_parent_id_fkey` | `categories` | `[parent_id]` | `categories` | `[id]` | SET NULL | Dropped explicitly prior to target table drop or cascade-safe |
| 42 | `order_items_product_variant_id_fkey` | `order_items` | `[product_variant_id]` | `product_variants` | `[id]` | RESTRICT | Dropped explicitly prior to target table drop or cascade-safe |

---

## 6. Protected Pre-Existing Legacy Tables Inventory (18 Tables - 100% Preserved)

Under the Prompt 12.4.1 Invariant, all 18 pre-existing legacy tables are explicitly protected. Zero legacy tables are ever dropped, truncated, or modified destructively by migration or rollback.

| # | Legacy Table | Pre-existing | Classification | Migration Action | Rollback Action | Preservation Status |
| :-: | :--- | :---: | :--- | :--- | :--- | :---: |
| 1 | `tenants` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Add additive transition columns | Drop transition columns only | **PRESERVED (100%)** |
| 2 | `outlets` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Add additive transition column code | Drop transition column only | **PRESERVED (100%)** |
| 3 | `users` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Add additive transition columns user_code, pin_hash | Drop transition columns only | **PRESERVED (100%)** |
| 4 | `products` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Add additive transition column type | Drop transition column only | **PRESERVED (100%)** |
| 5 | `categories` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Add additive transition column parent_id + FK | Drop transition column and FK | **PRESERVED (100%)** |
| 6 | `customers` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Add additive transition columns loyalty_points, metadata | Drop transition columns only | **PRESERVED (100%)** |
| 7 | `orders` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Add additive transition columns order_status, financial decimals | Drop transition columns only | **PRESERVED (100%)** |
| 8 | `order_items` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Add additive transition columns product_variant_id, snapshots + FK | Drop transition columns and FK | **PRESERVED (100%)** |
| 9 | `payments` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Untouched in Expand Phase 1 | Preserved untouched | **PRESERVED (100%)** |
| 10 | `shifts` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Untouched in Expand Phase 1 | Preserved untouched | **PRESERVED (100%)** |
| 11 | `subscription_plans` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Untouched in Expand Phase 1 | Preserved untouched | **PRESERVED (100%)** |
| 12 | `tenant_subscriptions` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Untouched in Expand Phase 1 | Preserved untouched | **PRESERVED (100%)** |
| 13 | `saas_invoices` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Untouched in Expand Phase 1 | Preserved untouched | **PRESERVED (100%)** |
| 14 | `saas_payments` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Untouched in Expand Phase 1 | Preserved untouched | **PRESERVED (100%)** |
| 15 | `platform_users` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Untouched in Expand Phase 1 | Preserved untouched | **PRESERVED (100%)** |
| 16 | `outlet_products` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Untouched in Expand Phase 1 | Preserved untouched | **PRESERVED (100%)** |
| 17 | `stock_movements` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Untouched in Expand Phase 1 | Preserved untouched | **PRESERVED (100%)** |
| 18 | `hold_orders` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Untouched in Expand Phase 1 | Preserved untouched | **PRESERVED (100%)** |

---

## 7. Invariant Summary Totals

```text
ACTUAL MIGRATION OBJECTS TOUCHED: 96
  - 1 Metadata Registry Table (_prompt_12_ownership_registry)
  - 20 ENUM Types (10 Reused + 10 Created)
  - 18 Target Domain Tables (165 total columns, 40 foreign keys)
  - 23 Additive Transition Columns (across 8 legacy tables, 2 foreign keys)
  - 34 Target Indexes (complete definition validated)
PREFLIGHT-CHECKED OBJECTS:         96 (100%)
OWNERSHIP-REGISTERED OBJECTS:       96 (100%)
ROLLBACK-CONTROLLED OBJECTS:       96 (100%)
DOCUMENTED OBJECT INVENTORY:        96 (100%)
TARGET SCHEMA CONTRACT OBJECTS:     96 (100%)
PROTECTED LEGACY TABLES:            18 (100% preserved)
TOTAL SYSTEM OBJECTS AUDITED:      114
UNKNOWN OBJECTS:                     0 (Zero)
```
