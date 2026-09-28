# 10.2 — PROMPT 12.2 OBJECT OWNERSHIP INVENTORY

**Project:** Well POS Multi-Tenant SaaS Platform  
**Document ID:** `DOC-VAL-10-PROMPT-12-2-OBJECT-OWNERSHIP-INVENTORY`  
**Execution Stage:** Prompt 12.2 — Migration Object Ownership & Rollback Finalization  
**Preceding Gate:** Prompt 12.1 = `BLOCKED / OWNER REVIEW REQUIRED`  
**Date:** September 19, 2026  
**Status:** **AUTHORITATIVE OBJECT OWNERSHIP MATRIX — ZERO UNKNOWNS**  
**Ownership Categories:**
- `CREATED_BY_PROMPT_12`: Object introduced in Expand phase; eligible for creation and safe inverse rollback.
- `PRE_EXISTING_COMPATIBLE_REUSED`: Object existed prior to Prompt 12; verified compatible by catalog preflight; MUST BE PRESERVED ON ROLLBACK.
- `PRE_EXISTING_INCOMPATIBLE`: Object existed with conflicting vocabulary/structure; causes preflight to FAIL CLOSED (abort before mutation).
- `UNKNOWN`: Ambiguous ownership; strictly FORBIDDEN (zero items).

---

## 1. Complete Object Ownership Matrix

| Object | Type | Pre-existing | Compatibility | Ownership | Migration Action | Rollback Action | Verification |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| **PlatformRole** | TYPE (Enum) | YES | EXACT_COMPATIBLE | `PRE_EXISTING_COMPATIBLE_REUSED` | Preflight verify labels + ADD VALUE IF NOT EXISTS | PRESERVED (NO ACTION) | pg_type / pg_enum check |
| **TenantStatus** | TYPE (Enum) | YES | EXACT_COMPATIBLE | `PRE_EXISTING_COMPATIBLE_REUSED` | Preflight verify labels + ADD VALUE IF NOT EXISTS | PRESERVED (NO ACTION) | pg_type / pg_enum check |
| **BusinessVertical** | TYPE (Enum) | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE TYPE | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | Registry check |
| **BillingCycle** | TYPE (Enum) | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE TYPE | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | Registry check |
| **InvoiceStatus** | TYPE (Enum) | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE TYPE | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | Registry check |
| **PaymentRecordStatus** | TYPE (Enum) | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE TYPE | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | Registry check |
| **Role** | TYPE (Enum) | YES | EXACT_COMPATIBLE | `PRE_EXISTING_COMPATIBLE_REUSED` | Preflight verify labels + ADD VALUE IF NOT EXISTS | PRESERVED (NO ACTION) | pg_type / pg_enum check |
| **ShiftStatus** | TYPE (Enum) | YES | EXACT_COMPATIBLE | `PRE_EXISTING_COMPATIBLE_REUSED` | Preflight verify labels | PRESERVED (NO ACTION) | pg_type / pg_enum check |
| **ProductType** | TYPE (Enum) | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE TYPE | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | Registry check |
| **SelectionType** | TYPE (Enum) | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE TYPE | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | Registry check |
| **UomType** | TYPE (Enum) | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE TYPE | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | Registry check |
| **StorageLocationType** | TYPE (Enum) | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE TYPE | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | Registry check |
| **StockMovementType** | TYPE (Enum) | YES | EXACT_COMPATIBLE | `PRE_EXISTING_COMPATIBLE_REUSED` | Preflight verify labels + ADD VALUE IF NOT EXISTS | PRESERVED (NO ACTION) | pg_type / pg_enum check |
| **InventoryRefType** | TYPE (Enum) | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE TYPE | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | Registry check |
| **ActorType** | TYPE (Enum) | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE TYPE | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | Registry check |
| **OrderStatus** | TYPE (Enum) | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE TYPE | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | Registry check |
| **PaymentStatus** | TYPE (Enum) | YES | EXACT_COMPATIBLE | `PRE_EXISTING_COMPATIBLE_REUSED` | Preflight verify labels + ADD VALUE IF NOT EXISTS | PRESERVED (NO ACTION) | pg_type / pg_enum check |
| **PaymentMethod** | TYPE (Enum) | YES | EXACT_COMPATIBLE | `PRE_EXISTING_COMPATIBLE_REUSED` | Preflight verify labels + ADD VALUE IF NOT EXISTS | PRESERVED (NO ACTION) | pg_type / pg_enum check |
| **PaymentTxStatus** | TYPE (Enum) | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE TYPE | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | Registry check |
| **RefundReason** | TYPE (Enum) | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE TYPE | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | Registry check |
| **_prompt_12_ownership_registry** | TABLE | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS | Migration metadata |
| **inventory_items** | TABLE | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | pg_class check |
| **product_variants** | TABLE | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | pg_class check |
| **storage_locations** | TABLE | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | pg_class check |
| **inventory_batches** | TABLE | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | pg_class check |
| **inventory_balances** | TABLE | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | pg_class check |
| **inventory_ledgers** | TABLE | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | pg_class check |
| **unit_conversions** | TABLE | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | pg_class check |
| **recipes** | TABLE | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | pg_class check |
| **recipe_items** | TABLE | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | pg_class check |
| **modifier_groups** | TABLE | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | pg_class check |
| **modifier_items** | TABLE | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | pg_class check |
| **product_modifier_groups** | TABLE | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | pg_class check |
| **modifier_recipe_effects** | TABLE | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | pg_class check |
| **payment_transactions** | TABLE | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | pg_class check |
| **refunds** | TABLE | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | pg_class check |
| **refund_items** | TABLE | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | pg_class check |
| **idempotency_records** | TABLE | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | pg_class check |
| **legacy_stock_movements** | TABLE | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | pg_class check |
| **tenants.business_vertical** | COLUMN | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | information_schema check |
| **tenants.allow_negative_stock** | COLUMN | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | information_schema check |
| **tenants.enable_batch_tracking** | COLUMN | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | information_schema check |
| **tenants.enable_recipe_tracking** | COLUMN | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | information_schema check |
| **users.user_code** | COLUMN | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | information_schema check |
| **users.pin_hash** | COLUMN | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | information_schema check |
| **outlets.code** | COLUMN | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | information_schema check |
| **products.type** | COLUMN | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | information_schema check |
| **categories.parent_id** | COLUMN | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | information_schema check |
| **customers.loyalty_points** | COLUMN | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | information_schema check |
| **customers.metadata** | COLUMN | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | information_schema check |
| **orders.order_status** | COLUMN | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + ADD COLUMN IF NOT EXISTS (DEFAULT 'CONFIRMED') | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | information_schema check |
| **orders.order_type** | COLUMN | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | information_schema check |
| **orders.service_total** | COLUMN | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | information_schema check |
| **orders.paid_amount** | COLUMN | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | information_schema check |
| **orders.change_amount** | COLUMN | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | information_schema check |
| **order_items.product_variant_id** | COLUMN | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | information_schema check |
| **order_items.product_name** | COLUMN | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | information_schema check |
| **order_items.variant_name** | COLUMN | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | information_schema check |
| **order_items.sku** | COLUMN | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | information_schema check |
| **order_items.cost_price** | COLUMN | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | information_schema check |
| **order_items.discount_amount** | COLUMN | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | information_schema check |
| **order_items.modifiers_snapshot** | COLUMN | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | Preflight verify + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | information_schema check |
| **idx_inventory_items_tenant_code** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE UNIQUE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_inventory_items_tenant_active** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_product_variants_tenant_sku** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE UNIQUE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_product_variants_tenant_barcode** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE UNIQUE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_product_variants_tenant_product** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_product_variants_tenant_item** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_storage_locations_tenant_outlet_name** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE UNIQUE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_storage_locations_tenant_outlet** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_storage_locations_tenant_outlet_default** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE UNIQUE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_inventory_batches_tenant_item_batch** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE UNIQUE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_inventory_batches_tenant_expiration** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_inventory_balances_unbatched** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE UNIQUE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_inventory_balances_batched** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE UNIQUE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_inventory_balances_location** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_inventory_ledgers_item_date** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_inventory_ledgers_ref** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_inventory_ledgers_batch** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_unit_conversions_units** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE UNIQUE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_recipe_items_recipe** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_recipe_items_item** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_modifier_groups_tenant** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_modifier_items_group** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_product_modifier_groups_unique** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE UNIQUE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_product_modifier_groups_tenant** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_modifier_recipe_effects_unique** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE UNIQUE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_modifier_recipe_effects_tenant** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_payment_transactions_order** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_payment_transactions_status** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_refunds_tenant_number** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE UNIQUE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_refunds_order** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_refund_items_refund** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_refund_items_order_item** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_idempotency_records_key** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE UNIQUE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |
| **idx_idempotency_records_expiry** | INDEX | NO | EXACT_COMPATIBLE | `CREATED_BY_PROMPT_12` | CREATE INDEX IF NOT EXISTS | Dropped with table | pg_indexes check |

---

## 2. Protected Pre-Existing Legacy Tables (18 Tables — STRICTLY PRESERVED)

The following 18 pre-existing tables existed prior to Prompt 12 and **MUST NEVER BE DROPPED OR TRUNCATED** under any circumstance:

| Table Name | Classification | Ownership Status | Rollback Preservation Policy |
| :--- | :--- | :--- | :--- |
| `tenants` | Legacy Core SaaS | `PRE_EXISTING_COMPATIBLE_REUSED` | PRESERVED (Drop added transition columns only) |
| `outlets` | Legacy Commercial | `PRE_EXISTING_COMPATIBLE_REUSED` | PRESERVED (Drop added code column only) |
| `users` | Legacy Identity | `PRE_EXISTING_COMPATIBLE_REUSED` | PRESERVED (Drop added user_code, pin_hash only) |
| `products` | Legacy Catalog | `PRE_EXISTING_COMPATIBLE_REUSED` | PRESERVED (Drop added type column only) |
| `categories` | Legacy Taxonomy | `PRE_EXISTING_COMPATIBLE_REUSED` | PRESERVED (Drop added parent_id column only) |
| `customers` | Legacy CRM | `PRE_EXISTING_COMPATIBLE_REUSED` | PRESERVED (Drop added loyalty_points, metadata only) |
| `orders` | Legacy Sales Header | `PRE_EXISTING_COMPATIBLE_REUSED` | PRESERVED (Drop added order_status, order_type, etc. only) |
| `order_items` | Legacy Sales Line | `PRE_EXISTING_COMPATIBLE_REUSED` | PRESERVED (Drop added product_variant_id, snapshots only) |
| `payments` | Legacy Financial | `PRE_EXISTING_COMPATIBLE_REUSED` | PRESERVED (NO ACTION) |
| `shifts` | Legacy Cashier Shift | `PRE_EXISTING_COMPATIBLE_REUSED` | PRESERVED (NO ACTION) |
| `subscription_plans` | Legacy Billing Plans | `PRE_EXISTING_COMPATIBLE_REUSED` | PRESERVED (NO ACTION) |
| `tenant_subscriptions` | Legacy Subscriptions | `PRE_EXISTING_COMPATIBLE_REUSED` | PRESERVED (NO ACTION) |
| `saas_invoices` | Legacy Invoices | `PRE_EXISTING_COMPATIBLE_REUSED` | PRESERVED (NO ACTION) |
| `saas_payments` | Legacy Invoicing | `PRE_EXISTING_COMPATIBLE_REUSED` | PRESERVED (NO ACTION) |
| `platform_users` | Legacy Root Admin | `PRE_EXISTING_COMPATIBLE_REUSED` | PRESERVED (NO ACTION) |
| `outlet_products` | Legacy Stock Baseline | `PRE_EXISTING_COMPATIBLE_REUSED` | PRESERVED (NO ACTION) |
| `stock_movements` | Legacy Movements | `PRE_EXISTING_COMPATIBLE_REUSED` | PRESERVED (NO ACTION) |
| `hold_orders` | Legacy Saved Carts | `PRE_EXISTING_COMPATIBLE_REUSED` | PRESERVED (NO ACTION) |

---

## 3. Ambiguity & Unknown Ownership Resolution

- **Total Objects Analyzed:** 89 database objects (20 types, 19 tables, 23 transition columns, 27 indexes).
- **Objects Classified as `UNKNOWN`:** Exactly **0**.
- **Objects Classified as `PRE_EXISTING_INCOMPATIBLE` in locked schema:** Exactly **0** (Any runtime occurrence triggers preflight `RAISE EXCEPTION` to fail closed).
- **Readiness Verdict:** `PASS`
