-- =============================================================================
-- PROMPT 13.2B: DEDICATED ENUM VOCABULARY ROLLBACK SCRIPT
-- Authoritative Design: /docs/validation/15_PROMPT_13_2B_ENUM_VOCABULARY_TRANSITION_DESIGN_REV2.md
-- Purpose: Safely and deterministically restore the 7 PostgreSQL enums to their
--          exact pre-transition legacy prototype vocabulary, subject to strict
--          fail-closed data state preconditions.
-- =============================================================================

SET statement_timeout = '60s';
SET lock_timeout = '10s';

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. ROLLBACK PRECONDITION ASSERTIONS (FAIL-CLOSED)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_cnt INT;
BEGIN
    -- 1.1 Expand target tables must NOT exist (Expand must have been rolled back first)
    SELECT count(*) INTO v_cnt 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('inventory_ledgers', 'payment_transactions', 'inventory_items', 'product_variants');
    IF v_cnt > 0 THEN
        RAISE EXCEPTION 'ROLLBACK ABORTED: % Expand target tables exist. Expand must be rolled back before enum rollback.', v_cnt;
    END IF;

    -- 1.2 Transition registry must exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_prompt_13_2b_enum_transition_registry') THEN
        RAISE EXCEPTION 'ROLLBACK ABORTED: "_prompt_13_2b_enum_transition_registry" does not exist. Cannot confirm transition provenance.';
    END IF;

    -- 1.3 Data precondition: No target-only roles in users
    SELECT count(*) INTO v_cnt FROM "users" WHERE "role"::text IN ('OWNER', 'KITCHEN', 'WAITER');
    IF v_cnt > 0 THEN
        RAISE EXCEPTION 'ROLLBACK ABORTED: % users have target-only roles (OWNER/KITCHEN/WAITER) which cannot be reverse mapped.', v_cnt;
    END IF;

    -- 1.4 Data precondition: No target-only movement types in stock_movements
    SELECT count(*) INTO v_cnt FROM "stock_movements" WHERE "type"::text IN ('RETURN', 'VOID', 'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT');
    IF v_cnt > 0 THEN
        RAISE EXCEPTION 'ROLLBACK ABORTED: % stock movements have target-only types which cannot be reverse mapped.', v_cnt;
    END IF;

    -- 1.5 Data precondition: No target-only payment methods in payments
    SELECT count(*) INTO v_cnt FROM "payments" WHERE "method"::text IN ('CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'EWALLET', 'VOUCHER');
    IF v_cnt > 0 THEN
        RAISE EXCEPTION 'ROLLBACK ABORTED: % payments have target-only methods which cannot be reverse mapped.', v_cnt;
    END IF;

    -- 1.6 Data precondition: No target-only tx statuses in payments
    SELECT count(*) INTO v_cnt FROM "payments" WHERE "status"::text IN ('REFUNDED', 'VOIDED');
    IF v_cnt > 0 THEN
        RAISE EXCEPTION 'ROLLBACK ABORTED: % payments have target-only statuses which cannot be reverse mapped.', v_cnt;
    END IF;

    -- 1.7 Data precondition: No target-only invoice statuses in saas_invoices
    SELECT count(*) INTO v_cnt FROM "saas_invoices" WHERE "status"::text IN ('DRAFT', 'VOID');
    IF v_cnt > 0 THEN
        RAISE EXCEPTION 'ROLLBACK ABORTED: % saas_invoices have target-only statuses which cannot be reverse mapped.', v_cnt;
    END IF;

    -- 1.8 Data precondition: No target-only payment statuses in orders
    SELECT count(*) INTO v_cnt FROM "orders" WHERE "payment_status"::text IN ('UNPAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED');
    IF v_cnt > 0 THEN
        RAISE EXCEPTION 'ROLLBACK ABORTED: % orders have target-only payment statuses which cannot be reverse mapped.', v_cnt;
    END IF;

    RAISE NOTICE 'ROLLBACK PRECONDITIONS PASSED: No target-only data conflicts detected.';
END $$;

-- -----------------------------------------------------------------------------
-- 2. REVERT 7 ENUMS TO LEGACY VOCABULARY VIA TYPE-SWAP
-- -----------------------------------------------------------------------------

-- 2.1 PlatformRole (SUPER_ADMIN, SUPPORT, BILLING -> SUPER_ADMIN, SUPPORT_AGENT, FINANCE_ADMIN)
DO $$
BEGIN
    CREATE TYPE "PlatformRole_legacy" AS ENUM ('SUPER_ADMIN', 'SUPPORT_AGENT', 'FINANCE_ADMIN');

    ALTER TABLE "platform_users" ALTER COLUMN "role" DROP DEFAULT;

    ALTER TABLE "platform_users" 
    ALTER COLUMN "role" TYPE "PlatformRole_legacy" 
    USING (
        CASE "role"::text
            WHEN 'SUPER_ADMIN' THEN 'SUPER_ADMIN'::"PlatformRole_legacy"
            WHEN 'SUPPORT' THEN 'SUPPORT_AGENT'::"PlatformRole_legacy"
            WHEN 'BILLING' THEN 'FINANCE_ADMIN'::"PlatformRole_legacy"
            ELSE 'SUPER_ADMIN'::"PlatformRole_legacy"
        END
    );

    ALTER TABLE "platform_users" ALTER COLUMN "role" SET DEFAULT 'SUPER_ADMIN'::"PlatformRole_legacy";

    DROP TYPE "PlatformRole";
    ALTER TYPE "PlatformRole_legacy" RENAME TO "PlatformRole";
    RAISE NOTICE 'PlatformRole rolled back to legacy vocabulary.';
END $$;

-- 2.2 Role (Target 7 labels -> Legacy 4 labels)
DO $$
BEGIN
    CREATE TYPE "Role_legacy" AS ENUM ('ADMIN', 'SUPERVISOR', 'WAREHOUSE', 'CASHIER');

    ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;

    ALTER TABLE "users" 
    ALTER COLUMN "role" TYPE "Role_legacy" 
    USING (
        CASE "role"::text
            WHEN 'ADMIN' THEN 'ADMIN'::"Role_legacy"
            WHEN 'SUPERVISOR' THEN 'SUPERVISOR'::"Role_legacy"
            WHEN 'WAREHOUSE' THEN 'WAREHOUSE'::"Role_legacy"
            WHEN 'CASHIER' THEN 'CASHIER'::"Role_legacy"
            ELSE 'CASHIER'::"Role_legacy"
        END
    );

    ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CASHIER'::"Role_legacy";

    DROP TYPE "Role";
    ALTER TYPE "Role_legacy" RENAME TO "Role";
    RAISE NOTICE 'Role rolled back to legacy vocabulary.';
END $$;

-- 2.3 StockMovementType (Target 10 labels -> Legacy 6 labels)
DO $$
BEGIN
    CREATE TYPE "StockMovementType_legacy" AS ENUM (
        'PURCHASE_IN', 'SALE_OUT', 'DAMAGE_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT'
    );

    ALTER TABLE "stock_movements" 
    ALTER COLUMN "type" TYPE "StockMovementType_legacy" 
    USING (
        CASE "type"::text
            WHEN 'PURCHASE' THEN 'PURCHASE_IN'::"StockMovementType_legacy"
            WHEN 'SALE' THEN 'SALE_OUT'::"StockMovementType_legacy"
            WHEN 'WASTE' THEN 'DAMAGE_OUT'::"StockMovementType_legacy"
            WHEN 'TRANSFER_IN' THEN 'TRANSFER_IN'::"StockMovementType_legacy"
            WHEN 'TRANSFER_OUT' THEN 'TRANSFER_OUT'::"StockMovementType_legacy"
            WHEN 'OPNAME_ADJUSTMENT' THEN 'ADJUSTMENT'::"StockMovementType_legacy"
            ELSE 'ADJUSTMENT'::"StockMovementType_legacy"
        END
    );

    DROP TYPE "StockMovementType";
    ALTER TYPE "StockMovementType_legacy" RENAME TO "StockMovementType";
    RAISE NOTICE 'StockMovementType rolled back to legacy vocabulary.';
END $$;

-- 2.4 InvoiceStatus (Target 4 labels -> Legacy 4 labels)
DO $$
BEGIN
    CREATE TYPE "InvoiceStatus_legacy" AS ENUM ('UNPAID', 'PAID', 'CANCELLED', 'EXPIRED');

    ALTER TABLE "saas_invoices" ALTER COLUMN "status" DROP DEFAULT;

    ALTER TABLE "saas_invoices" 
    ALTER COLUMN "status" TYPE "InvoiceStatus_legacy" 
    USING (
        CASE "status"::text
            WHEN 'UNPAID' THEN 'UNPAID'::"InvoiceStatus_legacy"
            WHEN 'PAID' THEN 'PAID'::"InvoiceStatus_legacy"
            WHEN 'VOID' THEN 'CANCELLED'::"InvoiceStatus_legacy"
            ELSE 'UNPAID'::"InvoiceStatus_legacy"
        END
    );

    ALTER TABLE "saas_invoices" ALTER COLUMN "status" SET DEFAULT 'UNPAID'::"InvoiceStatus_legacy";

    DROP TYPE "InvoiceStatus";
    ALTER TYPE "InvoiceStatus_legacy" RENAME TO "InvoiceStatus";
    RAISE NOTICE 'InvoiceStatus rolled back to legacy vocabulary.';
END $$;

-- 2.5 PaymentStatus (Target 5 labels -> Legacy 3 labels)
DO $$
BEGIN
    CREATE TYPE "PaymentStatus_legacy" AS ENUM ('PAID', 'CANCELLED', 'REFUNDED');

    ALTER TABLE "orders" ALTER COLUMN "payment_status" DROP DEFAULT;

    ALTER TABLE "orders" 
    ALTER COLUMN "payment_status" TYPE "PaymentStatus_legacy" 
    USING (
        CASE "payment_status"::text
            WHEN 'PAID' THEN 'PAID'::"PaymentStatus_legacy"
            WHEN 'REFUNDED' THEN 'REFUNDED'::"PaymentStatus_legacy"
            ELSE 'PAID'::"PaymentStatus_legacy"
        END
    );

    ALTER TABLE "orders" ALTER COLUMN "payment_status" SET DEFAULT 'PAID'::"PaymentStatus_legacy";

    DROP TYPE "PaymentStatus";
    ALTER TYPE "PaymentStatus_legacy" RENAME TO "PaymentStatus";
    RAISE NOTICE 'PaymentStatus rolled back to legacy vocabulary.';
END $$;

-- 2.6 PaymentMethod (Target 7 labels -> Legacy 2 labels)
DO $$
BEGIN
    CREATE TYPE "PaymentMethod_legacy" AS ENUM ('CASH', 'QRIS');

    ALTER TABLE "payments" 
    ALTER COLUMN "method" TYPE "PaymentMethod_legacy" 
    USING (
        CASE "method"::text
            WHEN 'CASH' THEN 'CASH'::"PaymentMethod_legacy"
            WHEN 'QRIS' THEN 'QRIS'::"PaymentMethod_legacy"
            ELSE 'CASH'::"PaymentMethod_legacy"
        END
    );

    DROP TYPE "PaymentMethod";
    ALTER TYPE "PaymentMethod_legacy" RENAME TO "PaymentMethod";
    RAISE NOTICE 'PaymentMethod rolled back to legacy vocabulary.';
END $$;

-- 2.7 PaymentTxStatus (Target 5 labels -> Legacy 3 labels)
DO $$
BEGIN
    CREATE TYPE "PaymentTxStatus_legacy" AS ENUM ('SUCCESS', 'PENDING', 'FAILED');

    ALTER TABLE "payments" ALTER COLUMN "status" DROP DEFAULT;

    ALTER TABLE "payments" 
    ALTER COLUMN "status" TYPE "PaymentTxStatus_legacy" 
    USING (
        CASE "status"::text
            WHEN 'CAPTURED' THEN 'SUCCESS'::"PaymentTxStatus_legacy"
            WHEN 'PENDING' THEN 'PENDING'::"PaymentTxStatus_legacy"
            WHEN 'FAILED' THEN 'FAILED'::"PaymentTxStatus_legacy"
            ELSE 'PENDING'::"PaymentTxStatus_legacy"
        END
    );

    ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'SUCCESS'::"PaymentTxStatus_legacy";

    DROP TYPE "PaymentTxStatus";
    ALTER TYPE "PaymentTxStatus_legacy" RENAME TO "PaymentTxStatus";
    RAISE NOTICE 'PaymentTxStatus rolled back to legacy vocabulary.';
END $$;

-- -----------------------------------------------------------------------------
-- 3. REGISTRY CLEANUP
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS "_prompt_13_2b_enum_transition_registry";

DELETE FROM "_prompt_12_ownership_registry" WHERE "object_type" = 'TYPE';
DELETE FROM "_prompt_12_ownership_registry" WHERE "object_type" = 'REGISTRY' AND "object_name" = '_prompt_12_ownership_registry';

-- Drop _prompt_12_ownership_registry if it is now completely empty
DO $$
DECLARE
    v_cnt INT;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '_prompt_12_ownership_registry') THEN
        SELECT count(*) INTO v_cnt FROM "_prompt_12_ownership_registry";
        IF v_cnt = 0 THEN
            DROP TABLE "_prompt_12_ownership_registry";
            RAISE NOTICE 'Dropped empty "_prompt_12_ownership_registry".';
        END IF;
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. POST-ROLLBACK AUDIT
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_actual_labels TEXT[];
    v_cnt INT;
    v_rec RECORD;
    v_total_rows INT := 0;
BEGIN
    -- Verify legacy labels restored
    SELECT array_agg(enumlabel ORDER BY enumsortorder) INTO v_actual_labels FROM pg_enum WHERE enumtypid = 'public."PlatformRole"'::regtype;
    IF v_actual_labels != ARRAY['SUPER_ADMIN', 'SUPPORT_AGENT', 'FINANCE_ADMIN'] THEN
        RAISE EXCEPTION 'PlatformRole rollback audit failed: %', v_actual_labels;
    END IF;

    SELECT array_agg(enumlabel ORDER BY enumsortorder) INTO v_actual_labels FROM pg_enum WHERE enumtypid = 'public."Role"'::regtype;
    IF v_actual_labels != ARRAY['ADMIN', 'SUPERVISOR', 'WAREHOUSE', 'CASHIER'] THEN
        RAISE EXCEPTION 'Role rollback audit failed: %', v_actual_labels;
    END IF;

    SELECT array_agg(enumlabel ORDER BY enumsortorder) INTO v_actual_labels FROM pg_enum WHERE enumtypid = 'public."StockMovementType"'::regtype;
    IF v_actual_labels != ARRAY['PURCHASE_IN', 'SALE_OUT', 'DAMAGE_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT'] THEN
        RAISE EXCEPTION 'StockMovementType rollback audit failed: %', v_actual_labels;
    END IF;

    -- Verify stock_movements mapped back to ADJUSTMENT
    SELECT count(*) INTO v_cnt FROM "stock_movements" WHERE "type" = 'ADJUSTMENT';
    IF v_cnt != 2 THEN
        RAISE EXCEPTION 'stock_movements rollback data mapping failed: expected 2 rows with ADJUSTMENT, found %', v_cnt;
    END IF;

    -- Verify 17 total rows preserved
    FOR v_rec IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' LOOP
        EXECUTE format('SELECT count(*) FROM %I', v_rec.table_name) INTO v_cnt;
        v_total_rows := v_total_rows + v_cnt;
    END LOOP;
    IF v_total_rows != 17 THEN
        RAISE EXCEPTION 'Total row count changed! Expected 17, found %', v_total_rows;
    END IF;

    RAISE NOTICE 'POST-ROLLBACK AUDIT COMPLETE: All enums restored to legacy prototype; 17 data rows verified.';
END $$;

COMMIT;
