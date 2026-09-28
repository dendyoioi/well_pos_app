-- Phase 17: Contract / Remove Legacy DDL
-- Project: Well POS Multi-Tenant SaaS
-- Executed on: 2026-09-21
-- Verified with: backups/pos_db_pre_contract_20260921_194502.dump

-- 1. Drop Legacy Tables
DROP TABLE IF EXISTS "outlet_products" CASCADE;
DROP TABLE IF EXISTS "stock_movements" CASCADE;
DROP TABLE IF EXISTS "payments" CASCADE;

-- 2. Drop Legacy Columns on order_items
ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "order_items_product_id_fkey";
ALTER TABLE "order_items" DROP COLUMN IF EXISTS "product_id";

-- 3. Drop Legacy Columns on products
ALTER TABLE "products" DROP COLUMN IF EXISTS "stock";
ALTER TABLE "products" DROP COLUMN IF EXISTS "min_stock_alert";
ALTER TABLE "products" DROP COLUMN IF EXISTS "cost_price";
ALTER TABLE "products" DROP COLUMN IF EXISTS "barcode";
ALTER TABLE "products" DROP COLUMN IF EXISTS "base_price";

-- 4. Drop Legacy Column on users
ALTER TABLE "users" DROP COLUMN IF EXISTS "pin";
