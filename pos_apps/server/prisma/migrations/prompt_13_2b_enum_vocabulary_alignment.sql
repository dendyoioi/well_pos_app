-- =============================================================================
-- PROMPT 13.2B: ENUM VOCABULARY ALIGNMENT MIGRATION
-- Stage: Pre-Expand Dedicated DDL
-- Authoritative Design: /docs/validation/15_PROMPT_13_2B_ENUM_VOCABULARY_TRANSITION_DESIGN_REV2.md
-- Purpose: Safely align the 7 incompatible PostgreSQL enums to Target Schema Revision 4
--          using the transactional Type-Swap pattern, while preserving live data
--          and establishing dual-registry provenance for the frozen Expand contract.
-- =============================================================================

SET statement_timeout = '60s';
SET lock_timeout = '10s';

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. PRE-EXECUTION INVARIANT ASSERTIONS (FAIL-CLOSED)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_dbname TEXT;
    v_tbl_count INT;
    v_row_count INT;
    v_target_tbl_count INT;
    v_r RECORD;
    v_total_rows INT := 0;
BEGIN
    -- 1.1 Verify database identity
    SELECT current_database() INTO v_dbname;
    IF v_dbname != 'pos_db' AND v_dbname NOT LIKE 'pos_db_%' THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: Execution attempted on unexpected database "%". Aborting.', v_dbname;
    END IF;

    -- 1.2 Verify Expand target tables are strictly absent
    SELECT count(*) INTO v_target_tbl_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('inventory_ledgers', 'payment_transactions', 'inventory_items', 'product_variants');
    IF v_target_tbl_count > 0 THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: % Expand target tables already exist. Aborting.', v_target_tbl_count;
    END IF;

    -- 1.3 Verify exactly 18 protected legacy base tables exist
    SELECT count(*) INTO v_tbl_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      AND table_name IN (
        'categories', 'customers', 'hold_orders', 'order_items', 'orders',
        'outlet_products', 'outlets', 'payments', 'platform_users', 'products',
        'saas_invoices', 'saas_payments', 'shifts', 'stock_movements',
        'subscription_plans', 'tenant_subscriptions', 'tenants', 'users'
      );
    IF v_tbl_count != 18 THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: Expected exactly 18 protected legacy tables, found %. Aborting.', v_tbl_count;
    END IF;

    -- 1.4 Verify exact row count is 17 across all tables
    FOR v_r IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' LOOP
        EXECUTE format('SELECT count(*) FROM %I', v_r.table_name) INTO v_row_count;
        v_total_rows := v_total_rows + v_row_count;
    END LOOP;
    IF v_total_rows != 17 THEN
        RAISE EXCEPTION 'PRE-CHECK FAILED: Expected exactly 17 total live rows, found %. Aborting.', v_total_rows;
    END IF;

    RAISE NOTICE 'PRE-CHECK PASSED: Database "%" verified with 18 protected tables and 17 live rows.', v_dbname;
END $$;

-- -----------------------------------------------------------------------------
-- 2. DUAL REGISTRY INITIALIZATION (ODR-13.2B-03)
-- -----------------------------------------------------------------------------

-- Registry 1: Transition Audit Log
CREATE TABLE IF NOT EXISTS "_prompt_13_2b_enum_transition_registry" (
    "enum_name" VARCHAR(100) PRIMARY KEY,
    "physical_action" VARCHAR(50) NOT NULL,
    "original_labels" TEXT[] NOT NULL,
    "target_labels" TEXT[] NOT NULL,
    "affected_tables" TEXT[] NOT NULL,
    "affected_columns" TEXT[] NOT NULL,
    "executed_by" VARCHAR(50) NOT NULL DEFAULT 'PROMPT_13_2B',
    "transition_timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Registry 2: Expand Contract Ownership Registry
CREATE TABLE IF NOT EXISTS "_prompt_12_ownership_registry" (
    "object_type" VARCHAR(50) NOT NULL,
    "parent_name" VARCHAR(100) NOT NULL DEFAULT '',
    "object_name" VARCHAR(100) NOT NULL,
    "ownership" VARCHAR(50) NOT NULL,
    "compatibility_state" VARCHAR(50) NOT NULL DEFAULT 'EXACT_COMPATIBLE',
    "created_by_migration" BOOLEAN NOT NULL DEFAULT true,
    "rollback_action" VARCHAR(50) NOT NULL DEFAULT 'DROP',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("object_type", "object_name", "parent_name")
);

-- Register the registry itself if not already recorded
INSERT INTO "_prompt_12_ownership_registry" 
    ("object_type", "parent_name", "object_name", "ownership", "compatibility_state", "created_by_migration", "rollback_action")
VALUES 
    ('REGISTRY', '', '_prompt_12_ownership_registry', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE')
ON CONFLICT ("object_type", "object_name", "parent_name") DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. VERIFY & REGISTER THE 3 EXACT-COMPATIBLE ENUMS
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_labels TEXT[];
BEGIN
    -- 3.1 BillingCycle
    SELECT array_agg(enumlabel ORDER BY enumsortorder) INTO v_labels
    FROM pg_enum WHERE enumtypid = 'public."BillingCycle"'::regtype;
    IF v_labels != ARRAY['MONTHLY', 'ANNUALLY'] THEN
        RAISE EXCEPTION 'BillingCycle labels drift detected: %', v_labels;
    END IF;
    INSERT INTO "_prompt_13_2b_enum_transition_registry" 
        ("enum_name", "physical_action", "original_labels", "target_labels", "affected_tables", "affected_columns")
    VALUES 
        ('BillingCycle', 'VERIFIED_EXACT_COMPATIBLE', v_labels, v_labels, ARRAY['subscription_plans'], ARRAY['billing_cycle'])
    ON CONFLICT ("enum_name") DO UPDATE SET "physical_action" = EXCLUDED."physical_action";

    -- 3.2 ShiftStatus
    SELECT array_agg(enumlabel ORDER BY enumsortorder) INTO v_labels
    FROM pg_enum WHERE enumtypid = 'public."ShiftStatus"'::regtype;
    IF v_labels != ARRAY['OPEN', 'CLOSED'] THEN
        RAISE EXCEPTION 'ShiftStatus labels drift detected: %', v_labels;
    END IF;
    INSERT INTO "_prompt_13_2b_enum_transition_registry" 
        ("enum_name", "physical_action", "original_labels", "target_labels", "affected_tables", "affected_columns")
    VALUES 
        ('ShiftStatus', 'VERIFIED_EXACT_COMPATIBLE', v_labels, v_labels, ARRAY['shifts'], ARRAY['status'])
    ON CONFLICT ("enum_name") DO UPDATE SET "physical_action" = EXCLUDED."physical_action";

    -- 3.3 TenantStatus
    SELECT array_agg(enumlabel ORDER BY enumsortorder) INTO v_labels
    FROM pg_enum WHERE enumtypid = 'public."TenantStatus"'::regtype;
    IF v_labels != ARRAY['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'PENDING'] THEN
        RAISE EXCEPTION 'TenantStatus labels drift detected: %', v_labels;
    END IF;
    INSERT INTO "_prompt_13_2b_enum_transition_registry" 
        ("enum_name", "physical_action", "original_labels", "target_labels", "affected_tables", "affected_columns")
    VALUES 
        ('TenantStatus', 'VERIFIED_EXACT_COMPATIBLE', v_labels, v_labels, ARRAY['tenants', 'tenant_subscriptions'], ARRAY['status', 'status'])
    ON CONFLICT ("enum_name") DO UPDATE SET "physical_action" = EXCLUDED."physical_action";

    -- Seed into _prompt_12_ownership_registry
    INSERT INTO "_prompt_12_ownership_registry" 
        ("object_type", "parent_name", "object_name", "ownership", "compatibility_state", "created_by_migration", "rollback_action")
    VALUES 
        ('TYPE', '', 'BillingCycle', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE'),
        ('TYPE', '', 'ShiftStatus', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE'),
        ('TYPE', '', 'TenantStatus', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE')
    ON CONFLICT ("object_type", "object_name", "parent_name") DO UPDATE 
    SET "ownership" = EXCLUDED."ownership", "compatibility_state" = EXCLUDED."compatibility_state", "rollback_action" = EXCLUDED."rollback_action";

    RAISE NOTICE 'EXACT-COMPATIBLE ENUMS: BillingCycle, ShiftStatus, TenantStatus verified and registered.';
END $$;

-- -----------------------------------------------------------------------------
-- 4. TYPE-SWAP TRANSITION FOR THE 7 INCOMPATIBLE ENUMS
-- -----------------------------------------------------------------------------

-- -----------------------------------------------------------------------------
-- 4.1 PlatformRole (SUPER_ADMIN, SUPPORT_AGENT, FINANCE_ADMIN -> SUPER_ADMIN, SUPPORT, BILLING)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_orig TEXT[];
    v_target TEXT[] := ARRAY['SUPER_ADMIN', 'SUPPORT', 'BILLING'];
BEGIN
    SELECT array_agg(enumlabel ORDER BY enumsortorder) INTO v_orig
    FROM pg_enum WHERE enumtypid = 'public."PlatformRole"'::regtype;

    CREATE TYPE "PlatformRole_target" AS ENUM ('SUPER_ADMIN', 'SUPPORT', 'BILLING');

    ALTER TABLE "platform_users" ALTER COLUMN "role" DROP DEFAULT;

    ALTER TABLE "platform_users" 
    ALTER COLUMN "role" TYPE "PlatformRole_target" 
    USING (
        CASE "role"::text
            WHEN 'SUPER_ADMIN' THEN 'SUPER_ADMIN'::"PlatformRole_target"
            WHEN 'SUPPORT_AGENT' THEN 'SUPPORT'::"PlatformRole_target"
            WHEN 'FINANCE_ADMIN' THEN 'BILLING'::"PlatformRole_target"
            ELSE 'SUPPORT'::"PlatformRole_target"
        END
    );

    ALTER TABLE "platform_users" ALTER COLUMN "role" SET DEFAULT 'SUPPORT'::"PlatformRole_target";

    DROP TYPE "PlatformRole";
    ALTER TYPE "PlatformRole_target" RENAME TO "PlatformRole";

    INSERT INTO "_prompt_13_2b_enum_transition_registry" 
        ("enum_name", "physical_action", "original_labels", "target_labels", "affected_tables", "affected_columns")
    VALUES 
        ('PlatformRole', 'RECREATED_VIA_TYPE_SWAP', v_orig, v_target, ARRAY['platform_users'], ARRAY['role']);

    INSERT INTO "_prompt_12_ownership_registry" 
        ("object_type", "parent_name", "object_name", "ownership", "compatibility_state", "created_by_migration", "rollback_action")
    VALUES 
        ('TYPE', '', 'PlatformRole', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE')
    ON CONFLICT ("object_type", "object_name", "parent_name") DO UPDATE 
    SET "ownership" = EXCLUDED."ownership", "compatibility_state" = EXCLUDED."compatibility_state", "rollback_action" = EXCLUDED."rollback_action";

    RAISE NOTICE 'PlatformRole successfully transitioned via Type-Swap.';
END $$;

-- -----------------------------------------------------------------------------
-- 4.2 Role (ADMIN, SUPERVISOR, WAREHOUSE, CASHIER -> +OWNER, +KITCHEN, +WAITER)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_orig TEXT[];
    v_target TEXT[] := ARRAY['OWNER', 'ADMIN', 'SUPERVISOR', 'WAREHOUSE', 'CASHIER', 'KITCHEN', 'WAITER'];
BEGIN
    SELECT array_agg(enumlabel ORDER BY enumsortorder) INTO v_orig
    FROM pg_enum WHERE enumtypid = 'public."Role"'::regtype;

    CREATE TYPE "Role_target" AS ENUM ('OWNER', 'ADMIN', 'SUPERVISOR', 'WAREHOUSE', 'CASHIER', 'KITCHEN', 'WAITER');

    ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;

    ALTER TABLE "users" 
    ALTER COLUMN "role" TYPE "Role_target" 
    USING (
        CASE "role"::text
            WHEN 'ADMIN' THEN 'ADMIN'::"Role_target"
            WHEN 'SUPERVISOR' THEN 'SUPERVISOR'::"Role_target"
            WHEN 'WAREHOUSE' THEN 'WAREHOUSE'::"Role_target"
            WHEN 'CASHIER' THEN 'CASHIER'::"Role_target"
            ELSE 'CASHIER'::"Role_target"
        END
    );

    ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CASHIER'::"Role_target";

    DROP TYPE "Role";
    ALTER TYPE "Role_target" RENAME TO "Role";

    INSERT INTO "_prompt_13_2b_enum_transition_registry" 
        ("enum_name", "physical_action", "original_labels", "target_labels", "affected_tables", "affected_columns")
    VALUES 
        ('Role', 'RECREATED_VIA_TYPE_SWAP', v_orig, v_target, ARRAY['users'], ARRAY['role']);

    INSERT INTO "_prompt_12_ownership_registry" 
        ("object_type", "parent_name", "object_name", "ownership", "compatibility_state", "created_by_migration", "rollback_action")
    VALUES 
        ('TYPE', '', 'Role', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE')
    ON CONFLICT ("object_type", "object_name", "parent_name") DO UPDATE 
    SET "ownership" = EXCLUDED."ownership", "compatibility_state" = EXCLUDED."compatibility_state", "rollback_action" = EXCLUDED."rollback_action";

    RAISE NOTICE 'Role successfully transitioned via Type-Swap.';
END $$;

-- -----------------------------------------------------------------------------
-- 4.3 StockMovementType (Legacy -> Target Revision 4 vocabulary)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_orig TEXT[];
    v_target TEXT[] := ARRAY['SALE', 'PURCHASE', 'TRANSFER_IN', 'TRANSFER_OUT', 'OPNAME_ADJUSTMENT', 'RETURN', 'WASTE', 'VOID', 'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT'];
BEGIN
    SELECT array_agg(enumlabel ORDER BY enumsortorder) INTO v_orig
    FROM pg_enum WHERE enumtypid = 'public."StockMovementType"'::regtype;

    CREATE TYPE "StockMovementType_target" AS ENUM (
        'SALE', 'PURCHASE', 'TRANSFER_IN', 'TRANSFER_OUT', 'OPNAME_ADJUSTMENT', 
        'RETURN', 'WASTE', 'VOID', 'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT'
    );

    ALTER TABLE "stock_movements" 
    ALTER COLUMN "type" TYPE "StockMovementType_target" 
    USING (
        CASE "type"::text
            WHEN 'PURCHASE_IN' THEN 'PURCHASE'::"StockMovementType_target"
            WHEN 'SALE_OUT' THEN 'SALE'::"StockMovementType_target"
            WHEN 'DAMAGE_OUT' THEN 'WASTE'::"StockMovementType_target"
            WHEN 'TRANSFER_IN' THEN 'TRANSFER_IN'::"StockMovementType_target"
            WHEN 'TRANSFER_OUT' THEN 'TRANSFER_OUT'::"StockMovementType_target"
            WHEN 'ADJUSTMENT' THEN 'OPNAME_ADJUSTMENT'::"StockMovementType_target"
            ELSE 'OPNAME_ADJUSTMENT'::"StockMovementType_target"
        END
    );

    DROP TYPE "StockMovementType";
    ALTER TYPE "StockMovementType_target" RENAME TO "StockMovementType";

    INSERT INTO "_prompt_13_2b_enum_transition_registry" 
        ("enum_name", "physical_action", "original_labels", "target_labels", "affected_tables", "affected_columns")
    VALUES 
        ('StockMovementType', 'RECREATED_VIA_TYPE_SWAP', v_orig, v_target, ARRAY['stock_movements'], ARRAY['type']);

    INSERT INTO "_prompt_12_ownership_registry" 
        ("object_type", "parent_name", "object_name", "ownership", "compatibility_state", "created_by_migration", "rollback_action")
    VALUES 
        ('TYPE', '', 'StockMovementType', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE')
    ON CONFLICT ("object_type", "object_name", "parent_name") DO UPDATE 
    SET "ownership" = EXCLUDED."ownership", "compatibility_state" = EXCLUDED."compatibility_state", "rollback_action" = EXCLUDED."rollback_action";

    RAISE NOTICE 'StockMovementType successfully transitioned via Type-Swap.';
END $$;

-- -----------------------------------------------------------------------------
-- 4.4 InvoiceStatus (UNPAID, PAID, CANCELLED, EXPIRED -> DRAFT, UNPAID, PAID, VOID)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_orig TEXT[];
    v_target TEXT[] := ARRAY['DRAFT', 'UNPAID', 'PAID', 'VOID'];
BEGIN
    SELECT array_agg(enumlabel ORDER BY enumsortorder) INTO v_orig
    FROM pg_enum WHERE enumtypid = 'public."InvoiceStatus"'::regtype;

    CREATE TYPE "InvoiceStatus_target" AS ENUM ('DRAFT', 'UNPAID', 'PAID', 'VOID');

    ALTER TABLE "saas_invoices" ALTER COLUMN "status" DROP DEFAULT;

    ALTER TABLE "saas_invoices" 
    ALTER COLUMN "status" TYPE "InvoiceStatus_target" 
    USING (
        CASE "status"::text
            WHEN 'UNPAID' THEN 'UNPAID'::"InvoiceStatus_target"
            WHEN 'PAID' THEN 'PAID'::"InvoiceStatus_target"
            WHEN 'CANCELLED' THEN 'VOID'::"InvoiceStatus_target"
            WHEN 'EXPIRED' THEN 'VOID'::"InvoiceStatus_target"
            ELSE 'UNPAID'::"InvoiceStatus_target"
        END
    );

    ALTER TABLE "saas_invoices" ALTER COLUMN "status" SET DEFAULT 'UNPAID'::"InvoiceStatus_target";

    DROP TYPE "InvoiceStatus";
    ALTER TYPE "InvoiceStatus_target" RENAME TO "InvoiceStatus";

    INSERT INTO "_prompt_13_2b_enum_transition_registry" 
        ("enum_name", "physical_action", "original_labels", "target_labels", "affected_tables", "affected_columns")
    VALUES 
        ('InvoiceStatus', 'RECREATED_VIA_TYPE_SWAP', v_orig, v_target, ARRAY['saas_invoices'], ARRAY['status']);

    INSERT INTO "_prompt_12_ownership_registry" 
        ("object_type", "parent_name", "object_name", "ownership", "compatibility_state", "created_by_migration", "rollback_action")
    VALUES 
        ('TYPE', '', 'InvoiceStatus', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE')
    ON CONFLICT ("object_type", "object_name", "parent_name") DO UPDATE 
    SET "ownership" = EXCLUDED."ownership", "compatibility_state" = EXCLUDED."compatibility_state", "rollback_action" = EXCLUDED."rollback_action";

    RAISE NOTICE 'InvoiceStatus successfully transitioned via Type-Swap.';
END $$;

-- -----------------------------------------------------------------------------
-- 4.5 PaymentStatus (PAID, CANCELLED, REFUNDED -> UNPAID, PARTIALLY_PAID, PAID, PARTIALLY_REFUNDED, REFUNDED)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_orig TEXT[];
    v_target TEXT[] := ARRAY['UNPAID', 'PARTIALLY_PAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'];
BEGIN
    SELECT array_agg(enumlabel ORDER BY enumsortorder) INTO v_orig
    FROM pg_enum WHERE enumtypid = 'public."PaymentStatus"'::regtype;

    CREATE TYPE "PaymentStatus_target" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED');

    ALTER TABLE "orders" ALTER COLUMN "payment_status" DROP DEFAULT;

    ALTER TABLE "orders" 
    ALTER COLUMN "payment_status" TYPE "PaymentStatus_target" 
    USING (
        CASE "payment_status"::text
            WHEN 'PAID' THEN 'PAID'::"PaymentStatus_target"
            WHEN 'REFUNDED' THEN 'REFUNDED'::"PaymentStatus_target"
            WHEN 'CANCELLED' THEN 'UNPAID'::"PaymentStatus_target"
            ELSE 'UNPAID'::"PaymentStatus_target"
        END
    );

    ALTER TABLE "orders" ALTER COLUMN "payment_status" SET DEFAULT 'UNPAID'::"PaymentStatus_target";

    DROP TYPE "PaymentStatus";
    ALTER TYPE "PaymentStatus_target" RENAME TO "PaymentStatus";

    INSERT INTO "_prompt_13_2b_enum_transition_registry" 
        ("enum_name", "physical_action", "original_labels", "target_labels", "affected_tables", "affected_columns")
    VALUES 
        ('PaymentStatus', 'RECREATED_VIA_TYPE_SWAP', v_orig, v_target, ARRAY['orders'], ARRAY['payment_status']);

    INSERT INTO "_prompt_12_ownership_registry" 
        ("object_type", "parent_name", "object_name", "ownership", "compatibility_state", "created_by_migration", "rollback_action")
    VALUES 
        ('TYPE', '', 'PaymentStatus', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE')
    ON CONFLICT ("object_type", "object_name", "parent_name") DO UPDATE 
    SET "ownership" = EXCLUDED."ownership", "compatibility_state" = EXCLUDED."compatibility_state", "rollback_action" = EXCLUDED."rollback_action";

    RAISE NOTICE 'PaymentStatus successfully transitioned via Type-Swap.';
END $$;

-- -----------------------------------------------------------------------------
-- 4.6 PaymentMethod (CASH, QRIS -> +CREDIT_CARD, +DEBIT_CARD, +BANK_TRANSFER, +EWALLET, +VOUCHER)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_orig TEXT[];
    v_target TEXT[] := ARRAY['CASH', 'QRIS', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'EWALLET', 'VOUCHER'];
BEGIN
    SELECT array_agg(enumlabel ORDER BY enumsortorder) INTO v_orig
    FROM pg_enum WHERE enumtypid = 'public."PaymentMethod"'::regtype;

    CREATE TYPE "PaymentMethod_target" AS ENUM ('CASH', 'QRIS', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'EWALLET', 'VOUCHER');

    ALTER TABLE "payments" 
    ALTER COLUMN "method" TYPE "PaymentMethod_target" 
    USING (
        CASE "method"::text
            WHEN 'CASH' THEN 'CASH'::"PaymentMethod_target"
            WHEN 'QRIS' THEN 'QRIS'::"PaymentMethod_target"
            ELSE 'CASH'::"PaymentMethod_target"
        END
    );

    DROP TYPE "PaymentMethod";
    ALTER TYPE "PaymentMethod_target" RENAME TO "PaymentMethod";

    INSERT INTO "_prompt_13_2b_enum_transition_registry" 
        ("enum_name", "physical_action", "original_labels", "target_labels", "affected_tables", "affected_columns")
    VALUES 
        ('PaymentMethod', 'RECREATED_VIA_TYPE_SWAP', v_orig, v_target, ARRAY['payments'], ARRAY['method']);

    INSERT INTO "_prompt_12_ownership_registry" 
        ("object_type", "parent_name", "object_name", "ownership", "compatibility_state", "created_by_migration", "rollback_action")
    VALUES 
        ('TYPE', '', 'PaymentMethod', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE')
    ON CONFLICT ("object_type", "object_name", "parent_name") DO UPDATE 
    SET "ownership" = EXCLUDED."ownership", "compatibility_state" = EXCLUDED."compatibility_state", "rollback_action" = EXCLUDED."rollback_action";

    RAISE NOTICE 'PaymentMethod successfully transitioned via Type-Swap.';
END $$;

-- -----------------------------------------------------------------------------
-- 4.7 PaymentTxStatus (SUCCESS, PENDING, FAILED -> PENDING, CAPTURED, FAILED, REFUNDED, VOIDED) [ODR-06]
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_orig TEXT[];
    v_target TEXT[] := ARRAY['PENDING', 'CAPTURED', 'FAILED', 'REFUNDED', 'VOIDED'];
BEGIN
    SELECT array_agg(enumlabel ORDER BY enumsortorder) INTO v_orig
    FROM pg_enum WHERE enumtypid = 'public."PaymentTxStatus"'::regtype;

    CREATE TYPE "PaymentTxStatus_target" AS ENUM ('PENDING', 'CAPTURED', 'FAILED', 'REFUNDED', 'VOIDED');

    ALTER TABLE "payments" ALTER COLUMN "status" DROP DEFAULT;

    ALTER TABLE "payments" 
    ALTER COLUMN "status" TYPE "PaymentTxStatus_target" 
    USING (
        CASE "status"::text
            WHEN 'SUCCESS' THEN 'CAPTURED'::"PaymentTxStatus_target"
            WHEN 'PENDING' THEN 'PENDING'::"PaymentTxStatus_target"
            WHEN 'FAILED' THEN 'FAILED'::"PaymentTxStatus_target"
            ELSE 'PENDING'::"PaymentTxStatus_target"
        END
    );

    ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"PaymentTxStatus_target";

    DROP TYPE "PaymentTxStatus";
    ALTER TYPE "PaymentTxStatus_target" RENAME TO "PaymentTxStatus";

    INSERT INTO "_prompt_13_2b_enum_transition_registry" 
        ("enum_name", "physical_action", "original_labels", "target_labels", "affected_tables", "affected_columns")
    VALUES 
        ('PaymentTxStatus', 'RECREATED_VIA_TYPE_SWAP', v_orig, v_target, ARRAY['payments'], ARRAY['status']);

    INSERT INTO "_prompt_12_ownership_registry" 
        ("object_type", "parent_name", "object_name", "ownership", "compatibility_state", "created_by_migration", "rollback_action")
    VALUES 
        ('TYPE', '', 'PaymentTxStatus', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE')
    ON CONFLICT ("object_type", "object_name", "parent_name") DO UPDATE 
    SET "ownership" = EXCLUDED."ownership", "compatibility_state" = EXCLUDED."compatibility_state", "rollback_action" = EXCLUDED."rollback_action";

    RAISE NOTICE 'PaymentTxStatus successfully transitioned via Type-Swap.';
END $$;

-- -----------------------------------------------------------------------------
-- 5. POST-TRANSITION INTEGRITY AUDIT (FAIL-CLOSED)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_actual_labels TEXT[];
    v_cnt INT;
    v_rec RECORD;
    v_total_rows INT := 0;
BEGIN
    -- 5.1 Audit all 10 enum labels in pg_enum
    SELECT array_agg(enumlabel ORDER BY enumsortorder) INTO v_actual_labels FROM pg_enum WHERE enumtypid = 'public."PlatformRole"'::regtype;
    IF v_actual_labels != ARRAY['SUPER_ADMIN', 'SUPPORT', 'BILLING'] THEN
        RAISE EXCEPTION 'PlatformRole post-audit failed: %', v_actual_labels;
    END IF;

    SELECT array_agg(enumlabel ORDER BY enumsortorder) INTO v_actual_labels FROM pg_enum WHERE enumtypid = 'public."Role"'::regtype;
    IF v_actual_labels != ARRAY['OWNER', 'ADMIN', 'SUPERVISOR', 'WAREHOUSE', 'CASHIER', 'KITCHEN', 'WAITER'] THEN
        RAISE EXCEPTION 'Role post-audit failed: %', v_actual_labels;
    END IF;

    SELECT array_agg(enumlabel ORDER BY enumsortorder) INTO v_actual_labels FROM pg_enum WHERE enumtypid = 'public."StockMovementType"'::regtype;
    IF v_actual_labels != ARRAY['SALE', 'PURCHASE', 'TRANSFER_IN', 'TRANSFER_OUT', 'OPNAME_ADJUSTMENT', 'RETURN', 'WASTE', 'VOID', 'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT'] THEN
        RAISE EXCEPTION 'StockMovementType post-audit failed: %', v_actual_labels;
    END IF;

    SELECT array_agg(enumlabel ORDER BY enumsortorder) INTO v_actual_labels FROM pg_enum WHERE enumtypid = 'public."InvoiceStatus"'::regtype;
    IF v_actual_labels != ARRAY['DRAFT', 'UNPAID', 'PAID', 'VOID'] THEN
        RAISE EXCEPTION 'InvoiceStatus post-audit failed: %', v_actual_labels;
    END IF;

    SELECT array_agg(enumlabel ORDER BY enumsortorder) INTO v_actual_labels FROM pg_enum WHERE enumtypid = 'public."PaymentStatus"'::regtype;
    IF v_actual_labels != ARRAY['UNPAID', 'PARTIALLY_PAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] THEN
        RAISE EXCEPTION 'PaymentStatus post-audit failed: %', v_actual_labels;
    END IF;

    SELECT array_agg(enumlabel ORDER BY enumsortorder) INTO v_actual_labels FROM pg_enum WHERE enumtypid = 'public."PaymentMethod"'::regtype;
    IF v_actual_labels != ARRAY['CASH', 'QRIS', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'EWALLET', 'VOUCHER'] THEN
        RAISE EXCEPTION 'PaymentMethod post-audit failed: %', v_actual_labels;
    END IF;

    SELECT array_agg(enumlabel ORDER BY enumsortorder) INTO v_actual_labels FROM pg_enum WHERE enumtypid = 'public."PaymentTxStatus"'::regtype;
    IF v_actual_labels != ARRAY['PENDING', 'CAPTURED', 'FAILED', 'REFUNDED', 'VOIDED'] THEN
        RAISE EXCEPTION 'PaymentTxStatus post-audit failed: %', v_actual_labels;
    END IF;

    -- 5.2 Verify live data values mapped correctly
    SELECT count(*) INTO v_cnt FROM "stock_movements" WHERE "type" = 'OPNAME_ADJUSTMENT';
    IF v_cnt != 2 THEN
        RAISE EXCEPTION 'stock_movements data mapping failed: expected 2 rows with OPNAME_ADJUSTMENT, found %', v_cnt;
    END IF;

    SELECT count(*) INTO v_cnt FROM "platform_users" WHERE "role" = 'SUPER_ADMIN';
    IF v_cnt != 1 THEN
        RAISE EXCEPTION 'platform_users data mapping failed: expected 1 row with SUPER_ADMIN, found %', v_cnt;
    END IF;

    SELECT count(*) INTO v_cnt FROM "users" WHERE "role" IN ('ADMIN', 'CASHIER');
    IF v_cnt != 2 THEN
        RAISE EXCEPTION 'users data mapping failed: expected 2 rows with ADMIN/CASHIER, found %', v_cnt;
    END IF;

    -- 5.3 Verify total database rows remained exactly 17
    FOR v_rec IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                 AND table_name NOT IN ('_prompt_12_ownership_registry', '_prompt_13_2b_enum_transition_registry') LOOP
        EXECUTE format('SELECT count(*) FROM %I', v_rec.table_name) INTO v_cnt;
        v_total_rows := v_total_rows + v_cnt;
    END LOOP;
    IF v_total_rows != 17 THEN
        RAISE EXCEPTION 'Total row count changed! Expected 17, found %', v_total_rows;
    END IF;

    -- 5.4 Verify exactly 10 enum entries in _prompt_12_ownership_registry
    SELECT count(*) INTO v_cnt FROM "_prompt_12_ownership_registry" WHERE "object_type" = 'TYPE';
    IF v_cnt != 10 THEN
        RAISE EXCEPTION 'Expected 10 TYPE entries in _prompt_12_ownership_registry, found %', v_cnt;
    END IF;

    -- 5.5 Verify exactly 10 enum entries in _prompt_13_2b_enum_transition_registry
    SELECT count(*) INTO v_cnt FROM "_prompt_13_2b_enum_transition_registry";
    IF v_cnt != 10 THEN
        RAISE EXCEPTION 'Expected 10 entries in _prompt_13_2b_enum_transition_registry, found %', v_cnt;
    END IF;

    RAISE NOTICE 'POST-AUDIT COMPLETE: All 10 enums match Target Revision 4; 17 data rows verified; registry fully synchronized.';
END $$;

COMMIT;
