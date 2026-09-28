# 10.3 — PROMPT 12.3 OBJECT OWNERSHIP INVENTORY

**Project:** Well POS Multi-Tenant SaaS Platform  
**Document ID:** `DOC-VAL-10-PROMPT-12-3-OBJECT-OWNERSHIP-INVENTORY`  
**Execution Stage:** Prompt 12.3 — Final Ownership Preflight & Compatibility Hardening  
**Preceding Gate:** Prompt 12.2 = `BLOCKED / OWNER REVIEW REQUIRED`  
**Date:** September 19, 2026  
**Status:** **AUTHORITATIVE OBJECT OWNERSHIP MATRIX — ZERO UNKNOWNS (Prompt 12.3 Hardened)**  
**Ownership Categories:**
- `CREATED_BY_PROMPT_12`: Object introduced in Expand phase; eligible for creation and safe inverse rollback.
- `PRE_EXISTING_COMPATIBLE_REUSED`: Object existed prior to Prompt 12; verified compatible by catalog preflight; MUST BE PRESERVED ON ROLLBACK.
- `PRE_EXISTING_INCOMPATIBLE`: Object existed with conflicting vocabulary/structure; causes preflight to FAIL CLOSED (abort before mutation).
- `UNKNOWN`: Ambiguous ownership; strictly FORBIDDEN (zero items).

---

## 1. Complete Object Ownership Matrix (Prompt 12.3 Hardened)

| Object | Type | Pre-existing | Compatibility Method | Ownership | Migration Action | Rollback Action | Catalog Verification |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| **_prompt_12_ownership_registry** | TABLE (Metadata) | CONDITIONALLY | Structural preflight (C-01) | `CREATED_BY_PROMPT_12` or `PRE_EXISTING_COMPATIBLE_REUSED` | Preflight verify column UDTs; create if absent; self-register | Dropped ONLY IF `CREATED_BY_PROMPT_12`; PRESERVED IF reused | `pg_class` + `information_schema.columns` |
| **PlatformRole** | TYPE (Enum) | YES | Vocabulary audit (Correction A) | `PRE_EXISTING_COMPATIBLE_REUSED` | Preflight verify labels + ADD VALUE IF NOT EXISTS | PRESERVED (NO ACTION) | `pg_type` / `pg_enum` |
| **TenantStatus** | TYPE (Enum) | YES | Vocabulary audit (Correction A) | `PRE_EXISTING_COMPATIBLE_REUSED` | Preflight verify labels + ADD VALUE IF NOT EXISTS | PRESERVED (NO ACTION) | `pg_type` / `pg_enum` |
| **BusinessVertical** | TYPE (Enum) | NO | Vocabulary audit (Correction A) | `CREATED_BY_PROMPT_12` | CREATE TYPE | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | Registry check |
| **BillingCycle** | TYPE (Enum) | NO | Vocabulary audit (Correction A) | `CREATED_BY_PROMPT_12` | CREATE TYPE | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | Registry check |
| **InvoiceStatus** | TYPE (Enum) | NO | Vocabulary audit (Correction A) | `CREATED_BY_PROMPT_12` | CREATE TYPE | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | Registry check |
| **PaymentRecordStatus** | TYPE (Enum) | NO | Vocabulary audit (Correction A) | `CREATED_BY_PROMPT_12` | CREATE TYPE | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | Registry check |
| **Role** | TYPE (Enum) | YES | Vocabulary audit (Correction A) | `PRE_EXISTING_COMPATIBLE_REUSED` | Preflight verify labels + ADD VALUE IF NOT EXISTS | PRESERVED (NO ACTION) | `pg_type` / `pg_enum` |
| **ShiftStatus** | TYPE (Enum) | YES | Vocabulary audit (Correction A) | `PRE_EXISTING_COMPATIBLE_REUSED` | Preflight verify labels | PRESERVED (NO ACTION) | `pg_type` / `pg_enum` |
| **ProductType** | TYPE (Enum) | NO | Vocabulary audit (Correction A) | `CREATED_BY_PROMPT_12` | CREATE TYPE | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | Registry check |
| **SelectionType** | TYPE (Enum) | NO | Vocabulary audit (Correction A) | `CREATED_BY_PROMPT_12` | CREATE TYPE | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | Registry check |
| **UomType** | TYPE (Enum) | NO | Vocabulary audit (Correction A) | `CREATED_BY_PROMPT_12` | CREATE TYPE | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | Registry check |
| **StorageLocationType** | TYPE (Enum) | NO | Vocabulary audit (Correction A) | `CREATED_BY_PROMPT_12` | CREATE TYPE | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | Registry check |
| **StockMovementType** | TYPE (Enum) | YES | Vocabulary audit (Correction A) | `PRE_EXISTING_COMPATIBLE_REUSED` | Preflight verify labels + ADD VALUE IF NOT EXISTS | PRESERVED (NO ACTION) | `pg_type` / `pg_enum` |
| **InventoryRefType** | TYPE (Enum) | NO | Vocabulary audit (Correction A) | `CREATED_BY_PROMPT_12` | CREATE TYPE | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | Registry check |
| **ActorType** | TYPE (Enum) | NO | Vocabulary audit (Correction A) | `CREATED_BY_PROMPT_12` | CREATE TYPE | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | Registry check |
| **OrderStatus** | TYPE (Enum) | NO | Vocabulary audit (Correction A) | `CREATED_BY_PROMPT_12` | CREATE TYPE | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | Registry check |
| **PaymentStatus** | TYPE (Enum) | YES | Vocabulary audit (Correction A) | `PRE_EXISTING_COMPATIBLE_REUSED` | Preflight verify labels + ADD VALUE IF NOT EXISTS | PRESERVED (NO ACTION) | `pg_type` / `pg_enum` |
| **PaymentMethod** | TYPE (Enum) | YES | Vocabulary audit (Correction A) | `PRE_EXISTING_COMPATIBLE_REUSED` | Preflight verify labels + ADD VALUE IF NOT EXISTS | PRESERVED (NO ACTION) | `pg_type` / `pg_enum` |
| **PaymentTxStatus** | TYPE (Enum) | NO | Vocabulary audit (Correction A) | `CREATED_BY_PROMPT_12` | CREATE TYPE | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | Registry check |
| **RefundReason** | TYPE (Enum) | NO | Vocabulary audit (Correction A) | `CREATED_BY_PROMPT_12` | CREATE TYPE | DROP TYPE IF EXISTS (if CREATED_BY_PROMPT_12) | Registry check |
| **inventory_items** | TABLE | NO | Structural preflight (C-02) | `CREATED_BY_PROMPT_12` | Preflight PK & required columns + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_class` + `pg_constraint` + `information_schema` |
| **product_variants** | TABLE | NO | Structural preflight (C-02) | `CREATED_BY_PROMPT_12` | Preflight PK & required columns + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_class` + `pg_constraint` + `information_schema` |
| **storage_locations** | TABLE | NO | Structural preflight (C-02) | `CREATED_BY_PROMPT_12` | Preflight PK & required columns + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_class` + `pg_constraint` + `information_schema` |
| **inventory_batches** | TABLE | NO | Structural preflight (C-02) | `CREATED_BY_PROMPT_12` | Preflight PK & required columns + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_class` + `pg_constraint` + `information_schema` |
| **inventory_balances** | TABLE | NO | Structural preflight (C-02) | `CREATED_BY_PROMPT_12` | Preflight PK & required columns + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_class` + `pg_constraint` + `information_schema` |
| **inventory_ledgers** | TABLE | NO | Structural preflight (C-02) | `CREATED_BY_PROMPT_12` | Preflight PK & required columns + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_class` + `pg_constraint` + `information_schema` |
| **unit_conversions** | TABLE | NO | Structural preflight (C-02) | `CREATED_BY_PROMPT_12` | Preflight PK & required columns + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_class` + `pg_constraint` + `information_schema` |
| **recipes** | TABLE | NO | Structural preflight (C-02) | `CREATED_BY_PROMPT_12` | Preflight PK & required columns + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_class` + `pg_constraint` + `information_schema` |
| **recipe_items** | TABLE | NO | Structural preflight (C-02) | `CREATED_BY_PROMPT_12` | Preflight PK & required columns + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_class` + `pg_constraint` + `information_schema` |
| **modifier_groups** | TABLE | NO | Structural preflight (C-02) | `CREATED_BY_PROMPT_12` | Preflight PK & required columns + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_class` + `pg_constraint` + `information_schema` |
| **modifier_items** | TABLE | NO | Structural preflight (C-02) | `CREATED_BY_PROMPT_12` | Preflight PK & required columns + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_class` + `pg_constraint` + `information_schema` |
| **product_modifier_groups** | TABLE | NO | Structural preflight (C-02) | `CREATED_BY_PROMPT_12` | Preflight PK & required columns + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_class` + `pg_constraint` + `information_schema` |
| **modifier_recipe_effects** | TABLE | NO | Structural preflight (C-02) | `CREATED_BY_PROMPT_12` | Preflight PK & required columns + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_class` + `pg_constraint` + `information_schema` |
| **payment_transactions** | TABLE | NO | Structural preflight (C-02) | `CREATED_BY_PROMPT_12` | Preflight PK & required columns + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_class` + `pg_constraint` + `information_schema` |
| **refunds** | TABLE | NO | Structural preflight (C-02) | `CREATED_BY_PROMPT_12` | Preflight PK & required columns + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_class` + `pg_constraint` + `information_schema` |
| **refund_items** | TABLE | NO | Structural preflight (C-02) | `CREATED_BY_PROMPT_12` | Preflight PK & required columns + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_class` + `pg_constraint` + `information_schema` |
| **idempotency_records** | TABLE | NO | Structural preflight (C-02) | `CREATED_BY_PROMPT_12` | Preflight PK & required columns + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_class` + `pg_constraint` + `information_schema` |
| **legacy_stock_movements** | TABLE | NO | Structural preflight (C-02) | `CREATED_BY_PROMPT_12` | Preflight PK & required columns + CREATE TABLE IF NOT EXISTS | DROP TABLE IF EXISTS (if CREATED_BY_PROMPT_12) | `pg_class` + `pg_constraint` + `information_schema` |
| **tenants.business_vertical** | COLUMN | NO | Semantic preflight (C-03) | `CREATED_BY_PROMPT_12` | Preflight UDT & nullable + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **tenants.allow_negative_stock** | COLUMN | NO | Semantic preflight (C-03) | `CREATED_BY_PROMPT_12` | Preflight UDT & nullable + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **tenants.enable_batch_tracking** | COLUMN | NO | Semantic preflight (C-03) | `CREATED_BY_PROMPT_12` | Preflight UDT & nullable + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **tenants.enable_recipe_tracking** | COLUMN | NO | Semantic preflight (C-03) | `CREATED_BY_PROMPT_12` | Preflight UDT & nullable + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **users.user_code** | COLUMN | NO | Semantic preflight (C-03) | `CREATED_BY_PROMPT_12` | Preflight UDT & maxlen + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **users.pin_hash** | COLUMN | NO | Semantic preflight (C-03) | `CREATED_BY_PROMPT_12` | Preflight UDT & maxlen + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **outlets.code** | COLUMN | NO | Semantic preflight (C-03) | `CREATED_BY_PROMPT_12` | Preflight UDT & maxlen + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **products.type** | COLUMN | NO | Semantic preflight (C-03) | `CREATED_BY_PROMPT_12` | Preflight UDT & nullable + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **categories.parent_id** | COLUMN | NO | Semantic preflight (C-03) | `CREATED_BY_PROMPT_12` | Preflight UDT & nullable + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **customers.loyalty_points** | COLUMN | NO | Semantic preflight (C-03) | `CREATED_BY_PROMPT_12` | Preflight UDT & nullable + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **customers.metadata** | COLUMN | NO | Semantic preflight (C-03) | `CREATED_BY_PROMPT_12` | Preflight UDT & nullable + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **orders.order_status** | COLUMN | NO | Semantic preflight (C-03) | `CREATED_BY_PROMPT_12` | Preflight UDT + ADD COLUMN IF NOT EXISTS (DEFAULT 'CONFIRMED') | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **orders.order_type** | COLUMN | NO | Semantic preflight (C-03) | `CREATED_BY_PROMPT_12` | Preflight UDT & maxlen + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **orders.service_total** | COLUMN | NO | Semantic preflight (C-03) | `CREATED_BY_PROMPT_12` | Preflight UDT & precision (15,2) + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **orders.paid_amount** | COLUMN | NO | Semantic preflight (C-03) | `CREATED_BY_PROMPT_12` | Preflight UDT & precision (15,2) + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **orders.change_amount** | COLUMN | NO | Semantic preflight (C-03) | `CREATED_BY_PROMPT_12` | Preflight UDT & precision (15,2) + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **order_items.product_variant_id** | COLUMN | NO | Semantic preflight (C-03) | `CREATED_BY_PROMPT_12` | Preflight UDT & nullable + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **order_items.product_name** | COLUMN | NO | Semantic preflight (C-03) | `CREATED_BY_PROMPT_12` | Preflight UDT & nullable + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **order_items.variant_name** | COLUMN | NO | Semantic preflight (C-03) | `CREATED_BY_PROMPT_12` | Preflight UDT & nullable + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **order_items.sku** | COLUMN | NO | Semantic preflight (C-03) | `CREATED_BY_PROMPT_12` | Preflight UDT & nullable + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **order_items.cost_price** | COLUMN | NO | Semantic preflight (C-03) | `CREATED_BY_PROMPT_12` | Preflight UDT & precision (15,4) + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **order_items.discount_amount** | COLUMN | NO | Semantic preflight (C-03) | `CREATED_BY_PROMPT_12` | Preflight UDT & precision (15,2) + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **order_items.modifiers_snapshot** | COLUMN | NO | Semantic preflight (C-03) | `CREATED_BY_PROMPT_12` | Preflight UDT & nullable + ADD COLUMN IF NOT EXISTS | DROP COLUMN IF EXISTS (if CREATED_BY_PROMPT_12) | `information_schema.columns` |
| **idx_inventory_items_tenant_code** | INDEX | NO | Definition & Uniqueness (C-04) | `CREATED_BY_PROMPT_12` | Preflight uniqueness & table match + CREATE UNIQUE INDEX IF NOT EXISTS | Dropped with table | `pg_indexes` |
| **idx_inventory_items_tenant_active** | INDEX | NO | Definition & Uniqueness (C-04) | `CREATED_BY_PROMPT_12` | Preflight table match + CREATE INDEX IF NOT EXISTS | Dropped with table | `pg_indexes` |
| **idx_product_variants_tenant_sku** | INDEX | NO | Definition & Uniqueness (C-04) | `CREATED_BY_PROMPT_12` | Preflight uniqueness & table match + CREATE UNIQUE INDEX IF NOT EXISTS | Dropped with table | `pg_indexes` |
| **idx_product_variants_tenant_barcode** | INDEX | NO | Definition & Uniqueness (C-04) | `CREATED_BY_PROMPT_12` | Preflight uniqueness & table match + CREATE UNIQUE INDEX IF NOT EXISTS | Dropped with table | `pg_indexes` |
| **idx_product_variants_tenant_product** | INDEX | NO | Definition & Uniqueness (C-04) | `CREATED_BY_PROMPT_12` | Preflight table match + CREATE INDEX IF NOT EXISTS | Dropped with table | `pg_indexes` |
| **idx_product_variants_tenant_item** | INDEX | NO | Definition & Uniqueness (C-04) | `CREATED_BY_PROMPT_12` | Preflight table match + CREATE INDEX IF NOT EXISTS | Dropped with table | `pg_indexes` |
| **idx_storage_locations_tenant_outlet_name** | INDEX | NO | Definition & Uniqueness (C-04) | `CREATED_BY_PROMPT_12` | Preflight uniqueness & table match + CREATE UNIQUE INDEX IF NOT EXISTS | Dropped with table | `pg_indexes` |
| **idx_storage_locations_tenant_outlet** | INDEX | NO | Definition & Uniqueness (C-04) | `CREATED_BY_PROMPT_12` | Preflight table match + CREATE INDEX IF NOT EXISTS | Dropped with table | `pg_indexes` |
| **idx_storage_locations_tenant_outlet_default** | INDEX | NO | Definition & Uniqueness (C-04) | `CREATED_BY_PROMPT_12` | Preflight uniqueness & table match + CREATE UNIQUE INDEX IF NOT EXISTS | Dropped with table | `pg_indexes` |
| **idx_inventory_batches_tenant_item_batch** | INDEX | NO | Definition & Uniqueness (C-04) | `CREATED_BY_PROMPT_12` | Preflight uniqueness & table match + CREATE UNIQUE INDEX IF NOT EXISTS | Dropped with table | `pg_indexes` |
| **idx_inventory_batches_tenant_expiration** | INDEX | NO | Definition & Uniqueness (C-04) | `CREATED_BY_PROMPT_12` | Preflight table match + CREATE INDEX IF NOT EXISTS | Dropped with table | `pg_indexes` |
| **idx_inventory_balances_unbatched** | INDEX | NO | Definition & Uniqueness (C-04) | `CREATED_BY_PROMPT_12` | Preflight uniqueness & table match + CREATE UNIQUE INDEX IF NOT EXISTS | Dropped with table | `pg_indexes` |
| **idx_inventory_balances_batched** | INDEX | NO | Definition & Uniqueness (C-04) | `CREATED_BY_PROMPT_12` | Preflight uniqueness & table match + CREATE UNIQUE INDEX IF NOT EXISTS | Dropped with table | `pg_indexes` |
| **idx_inventory_balances_location** | INDEX | NO | Definition & Uniqueness (C-04) | `CREATED_BY_PROMPT_12` | Preflight table match + CREATE INDEX IF NOT EXISTS | Dropped with table | `pg_indexes` |
| **idx_inventory_ledgers_item_date** | INDEX | NO | Definition & Uniqueness (C-04) | `CREATED_BY_PROMPT_12` | Preflight table match + CREATE INDEX IF NOT EXISTS | Dropped with table | `pg_indexes` |
| **idx_inventory_ledgers_ref** | INDEX | NO | Definition & Uniqueness (C-04) | `CREATED_BY_PROMPT_12` | Preflight table match + CREATE INDEX IF NOT EXISTS | Dropped with table | `pg_indexes` |
| **idx_inventory_ledgers_batch** | INDEX | NO | Definition & Uniqueness (C-04) | `CREATED_BY_PROMPT_12` | Preflight table match + CREATE INDEX IF NOT EXISTS | Dropped with table | `pg_indexes` |
| **idx_unit_conversions_units** | INDEX | NO | Definition & Uniqueness (C-04) | `CREATED_BY_PROMPT_12` | Preflight uniqueness & table match + CREATE UNIQUE INDEX IF NOT EXISTS | Dropped with table | `pg_indexes` |

---

## 2. Protected Pre-Existing Legacy Tables Inventory (18 Tables - 100% Preserved)

Under Prompt 12.3 C-06, all 18 pre-existing legacy tables are explicitly audited and protected. Zero legacy tables are ever dropped, truncated, or modified destructively by rollback.

| # | Legacy Table | Pre-existing | Classification | Migration Action | Rollback Action | Preservation Status |
| :-: | :--- | :---: | :--- | :--- | :--- | :---: |
| 1 | `tenants` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Add additive transition columns | Drop transition columns only | **PRESERVED** |
| 2 | `outlets` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Add additive transition column `code` | Drop transition column only | **PRESERVED** |
| 3 | `users` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Add additive transition columns `user_code`, `pin_hash` | Drop transition columns only | **PRESERVED** |
| 4 | `products` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Add additive transition column `type` | Drop transition column only | **PRESERVED** |
| 5 | `categories` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Add additive transition column `parent_id` | Drop transition column only | **PRESERVED** |
| 6 | `customers` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Add additive transition columns `loyalty_points`, `metadata` | Drop transition columns only | **PRESERVED** |
| 7 | `orders` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Add additive transition columns `order_status`, financial decimals | Drop transition columns only | **PRESERVED** |
| 8 | `order_items` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Add additive transition columns `product_variant_id`, snapshots | Drop transition columns only | **PRESERVED** |
| 9 | `payments` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Untouched in Expand Phase 1 | Preserved untouched | **PRESERVED** |
| 10 | `shifts` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Untouched in Expand Phase 1 | Preserved untouched | **PRESERVED** |
| 11 | `subscription_plans` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Untouched in Expand Phase 1 | Preserved untouched | **PRESERVED** |
| 12 | `tenant_subscriptions`| YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Untouched in Expand Phase 1 | Preserved untouched | **PRESERVED** |
| 13 | `saas_invoices` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Untouched in Expand Phase 1 | Preserved untouched | **PRESERVED** |
| 14 | `saas_payments` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Untouched in Expand Phase 1 | Preserved untouched | **PRESERVED** |
| 15 | `platform_users` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Untouched in Expand Phase 1 | Preserved untouched | **PRESERVED** |
| 16 | `outlet_products` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Untouched in Expand Phase 1 (coexists during Expand) | Preserved untouched | **PRESERVED** |
| 17 | `stock_movements` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Untouched in Expand Phase 1 (coexists during Expand) | Preserved untouched | **PRESERVED** |
| 18 | `hold_orders` | YES | `PRE_EXISTING_COMPATIBLE_REUSED` | Untouched in Expand Phase 1 | Preserved untouched | **PRESERVED** |

---

## 3. Summary & Guarantees

- **Total Objects Audited:** 90 database objects (1 metadata registry, 20 enums, 18 target tables, 23 transition columns, 18 target indexes, 18 legacy tables).
- **Target Tables Structural Compatibility (C-02):** Validated via `contype = 'p'` (primary key existence) and exact `udt_name` matching on required fields.
- **Transition Columns Semantic Compatibility (C-03):** Validated via `information_schema.columns` comparing `udt_name`, `character_maximum_length`, `numeric_precision`, and `numeric_scale`.
- **Index Compatibility & Preservation (C-04):** Validated via `pg_indexes` for uniqueness and table association; custom indexes with different names are never destructively dropped.
- **Constraint / FK Compatibility (C-05):** Validated via PostgreSQL catalog constraints; zero CASCADE shortcuts.
- **All 18 Legacy Tables Protected (C-06):** Verified intact across repeated local migration and rollback cycles.
- **Unknown Objects:** Exactly **0** (Zero).
