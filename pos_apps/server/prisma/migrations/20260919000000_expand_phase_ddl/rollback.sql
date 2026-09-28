-- ==============================================================================
-- PROMPT 12.3: EXPAND-PHASE DETERMINISTIC ROLLBACK DOWN-MIGRATION
-- Project: Well POS Multi-Tenant SaaS Platform
-- Safety Invariant: STRICT INVERSE OF PROMPT 12 CREATIONS ONLY
-- Rule: Pre-existing and reused objects MUST BE PRESERVED. Unknowns MUST NOT be dropped.
--       Zero CASCADE shortcuts that could endanger non-owned objects.
--       Registry lifecycle itself is strictly owned (C-01).
-- ==============================================================================

BEGIN;

DO $$
DECLARE
    rec RECORD;
    v_has_registry BOOLEAN;
    v_drop_registry BOOLEAN := false;
    v_table_order TEXT[];
    v_tbl TEXT;
    v_is_created BOOLEAN;
    v_target_labels TEXT[];
    v_actual_labels TEXT[];
    v_type_rec RECORD;
    v_wrong_nsp TEXT;
BEGIN
    -- Check if Prompt 12 ownership registry exists
    SELECT EXISTS (
        SELECT 1 FROM pg_class c 
        JOIN pg_namespace n ON n.oid = c.relnamespace 
        WHERE n.nspname = 'public' AND c.relname = '_prompt_12_ownership_registry'
    ) INTO v_has_registry;

    IF NOT v_has_registry THEN
        RAISE EXCEPTION 'ROLLBACK ABORTED: Ownership registry "_prompt_12_ownership_registry" does not exist. Cannot verify Prompt 12 ownership. Zero objects dropped to fail closed and prevent accidental data loss.';
    END IF;

    -- Check if registry itself was created by Prompt 12 (C-01)
    SELECT EXISTS (
        SELECT 1 FROM "_prompt_12_ownership_registry"
        WHERE "object_type" = 'REGISTRY'
          AND "object_name" = '_prompt_12_ownership_registry'
          AND ("ownership" IN ('CREATED_BY_PROMPT_12_4_2', 'CREATED_BY_PROMPT_12') OR "rollback_action" = 'DROP')
    ) INTO v_drop_registry;

    -- -------------------------------------------------------------------------
    -- 0. DROP PROMPT 12-CREATED INDEXES
    -- -------------------------------------------------------------------------
    -- Explicitly drop indexes created by Prompt 12.
    -- Ensures indexes created on pre-existing or reused tables are cleanly rolled back,
    -- while pre-existing or reused indexes are strictly preserved.
    FOR rec IN 
        SELECT "parent_name", "object_name" 
        FROM "_prompt_12_ownership_registry"
        WHERE "object_type" = 'INDEX' 
          AND ("ownership" IN ('CREATED_BY_PROMPT_12_4_2', 'CREATED_BY_PROMPT_12') OR "rollback_action" = 'DROP')
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', rec.object_name);
        RAISE NOTICE 'Dropped Prompt 12 index "%" on "%"', rec.object_name, rec.parent_name;
    END LOOP;

    -- -------------------------------------------------------------------------
    -- 1. DROP PROMPT 12-CREATED TRANSITION COLUMNS FROM LEGACY TABLES
    -- -------------------------------------------------------------------------
    -- Only columns proven to have been CREATED_BY_PROMPT_12 are dropped.
    -- Any column classified as PRE_EXISTING_COMPATIBLE_REUSED is strictly preserved.
    FOR rec IN 
        SELECT "parent_name", "object_name" 
        FROM "_prompt_12_ownership_registry"
        WHERE "object_type" = 'COLUMN' 
          AND ("ownership" IN ('CREATED_BY_PROMPT_12_4_2', 'CREATED_BY_PROMPT_12') OR "rollback_action" = 'DROP')
          AND "parent_name" IN ('tenants', 'outlets', 'users', 'products', 'categories', 'customers', 'orders', 'order_items')
    LOOP
        EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS %I', rec.parent_name, rec.object_name);
        RAISE NOTICE 'Dropped Prompt 12 transition column "%.%"', rec.parent_name, rec.object_name;
    END LOOP;

    -- -------------------------------------------------------------------------
    -- 2. DROP PROMPT 12-CREATED NEW TABLES (STRICT REVERSE DEPENDENCY ORDER)
    -- -------------------------------------------------------------------------
    -- Zero CASCADE used. Dependent leaf tables are dropped before parent tables.
    -- Legacy tables (tenants, outlets, users, products, categories, customers, orders,
    -- order_items, payments, shifts, subscription_plans, tenant_subscriptions,
    -- saas_invoices, saas_payments, platform_users, outlet_products, stock_movements,
    -- hold_orders) are NEVER dropped.
    v_table_order := ARRAY[
        'legacy_stock_movements',
        'idempotency_records',
        'refund_items',
        'refunds',
        'payment_transactions',
        'modifier_recipe_effects',
        'product_modifier_groups',
        'modifier_items',
        'modifier_groups',
        'recipe_items',
        'recipes',
        'unit_conversions',
        'inventory_ledgers',
        'inventory_balances',
        'inventory_batches',
        'storage_locations',
        'product_variants',
        'inventory_items'
    ];

    FOREACH v_tbl IN ARRAY v_table_order LOOP
        SELECT EXISTS (
            SELECT 1 FROM "_prompt_12_ownership_registry"
            WHERE "object_type" = 'TABLE' 
              AND "object_name" = v_tbl 
              AND ("ownership" IN ('CREATED_BY_PROMPT_12_4_2', 'CREATED_BY_PROMPT_12') OR "rollback_action" = 'DROP')
        ) INTO v_is_created;

        IF v_is_created THEN
            EXECUTE format('DROP TABLE IF EXISTS %I', v_tbl);
            RAISE NOTICE 'Dropped Prompt 12 table "%"', v_tbl;
        ELSE
            RAISE NOTICE 'Table "%" was not created by Prompt 12 (PRESERVED).', v_tbl;
        END IF;
    END LOOP;

    -- -------------------------------------------------------------------------
    -- 3. DROP PROMPT 12-CREATED CUSTOM ENUM TYPES (OWNERSHIP & CATALOG IDENTITY VERIFIED)
    -- -------------------------------------------------------------------------
    -- Authoritative Target Database Schema Revision 4 Enum Vocabulary & Ordered Contract
    CREATE TEMP TABLE temp_target_enums (
        enum_name TEXT PRIMARY KEY,
        target_labels TEXT[]
    ) ON COMMIT DROP;

    INSERT INTO temp_target_enums (enum_name, target_labels) VALUES
    ('PlatformRole', ARRAY['SUPER_ADMIN', 'SUPPORT', 'BILLING']),
    ('TenantStatus', ARRAY['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'PENDING']),
    ('BusinessVertical', ARRAY['RETAIL', 'FNB', 'SERVICES', 'HYBRID']),
    ('BillingCycle', ARRAY['MONTHLY', 'ANNUALLY']),
    ('InvoiceStatus', ARRAY['DRAFT', 'UNPAID', 'PAID', 'VOID']),
    ('PaymentRecordStatus', ARRAY['PENDING', 'SUCCESS', 'FAILED']),
    ('Role', ARRAY['OWNER', 'ADMIN', 'SUPERVISOR', 'WAREHOUSE', 'CASHIER', 'KITCHEN', 'WAITER']),
    ('ShiftStatus', ARRAY['OPEN', 'CLOSED']),
    ('ProductType', ARRAY['STANDARD', 'COMPOSITE', 'SERVICE_LABOR']),
    ('SelectionType', ARRAY['SINGLE', 'MULTIPLE']),
    ('UomType', ARRAY['MASS', 'VOLUME', 'COUNT', 'LENGTH', 'TIME']),
    ('StorageLocationType', ARRAY['STOREFRONT', 'WAREHOUSE', 'KITCHEN', 'BAR', 'TRANSIT']),
    ('StockMovementType', ARRAY['SALE', 'PURCHASE', 'TRANSFER_IN', 'TRANSFER_OUT', 'OPNAME_ADJUSTMENT', 'RETURN', 'WASTE', 'VOID', 'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT']),
    ('InventoryRefType', ARRAY['ORDER', 'PURCHASE_ORDER', 'TRANSFER', 'STOCK_OPNAME', 'REFUND', 'PRODUCTION', 'MANUAL']),
    ('ActorType', ARRAY['USER', 'SYSTEM']),
    ('OrderStatus', ARRAY['DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED', 'VOIDED']),
    ('PaymentStatus', ARRAY['UNPAID', 'PARTIALLY_PAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED']),
    ('PaymentMethod', ARRAY['CASH', 'QRIS', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'EWALLET', 'VOUCHER']),
    ('PaymentTxStatus', ARRAY['PENDING', 'CAPTURED', 'FAILED', 'REFUNDED', 'VOIDED']),
    ('RefundReason', ARRAY['CUSTOMER_RETURN', 'DAMAGED_GOODS', 'WRONG_ITEM', 'DISSATISFIED_SERVICE', 'BILLING_ERROR']);

    -- 3.1 Registry Contradiction Pre-Check for Custom Enums (Prompt 12.4.3 P-15 / R-09)
    FOR rec IN 
        SELECT "object_name", "ownership", "created_by_migration", "rollback_action"
        FROM "_prompt_12_ownership_registry"
        WHERE "object_type" = 'TYPE'
    LOOP
        IF rec.created_by_migration = true AND (rec.ownership != 'CREATED_BY_PROMPT_12_4_2' OR rec.rollback_action != 'DROP') THEN
            RAISE EXCEPTION 'ROLLBACK CONTRADICTION: Registry record for enum "%" has created_by_migration=true but ownership="%"; rollback_action="%". Must be CREATED_BY_PROMPT_12_4_2 and DROP. Rollback aborted to fail closed.',
                rec.object_name, rec.ownership, rec.rollback_action;
        END IF;

        IF rec.created_by_migration = false AND (rec.ownership != 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED' OR rec.rollback_action != 'PRESERVE') THEN
            RAISE EXCEPTION 'ROLLBACK CONTRADICTION: Registry record for enum "%" has created_by_migration=false but ownership="%"; rollback_action="%". Must be PRE_EXISTING_EXACT_COMPATIBLE_REUSED and PRESERVE. Rollback aborted to fail closed.',
                rec.object_name, rec.ownership, rec.rollback_action;
        END IF;

        IF rec.ownership NOT IN ('CREATED_BY_PROMPT_12_4_2', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED') THEN
            RAISE EXCEPTION 'ROLLBACK CONTRADICTION: Registry record for enum "%" has invalid ownership value "%". Rollback aborted to fail closed.',
                rec.object_name, rec.ownership;
        END IF;
    END LOOP;

    -- 3.2 Pre-Drop PostgreSQL Catalog Identity Verification Gate (Prompt 12.4.4 Section 5, 6, 7)
    -- Verifies: Object exists + Object is enum (typtype=''e'') + Expected namespace (''public'') + Exact ordered labels
    FOR rec IN 
        SELECT "object_name" 
        FROM "_prompt_12_ownership_registry"
        WHERE "object_type" = 'TYPE' 
          AND "created_by_migration" = true
          AND "ownership" = 'CREATED_BY_PROMPT_12_4_2'
          AND "rollback_action" = 'DROP'
    LOOP
        -- Look up expected target labels from authoritative Target Revision 4 contract
        SELECT target_labels INTO v_target_labels
        FROM temp_target_enums
        WHERE enum_name = rec.object_name;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'ROLLBACK CATALOG IDENTITY VIOLATION (UNKNOWN TARGET ENUM): Registry records enum "%" as migration-owned, but it is not in Target Database Schema Revision 4 contract. Rollback aborted to fail closed.',
                rec.object_name;
        END IF;

        -- A & C: Inspect PostgreSQL catalog in expected namespace (''public'')
        SELECT t.oid, t.typtype, n.nspname
        INTO v_type_rec
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = rec.object_name
          AND n.nspname = 'public';

        IF NOT FOUND THEN
            -- Check if object exists in a different namespace (R-04)
            SELECT n.nspname, t.typtype
            INTO v_wrong_nsp, v_type_rec.typtype
            FROM pg_type t
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE t.typname = rec.object_name
            LIMIT 1;

            IF FOUND THEN
                RAISE EXCEPTION 'ROLLBACK CATALOG IDENTITY VIOLATION (NAMESPACE): Registry records enum "%" as migration-owned, but catalog object exists in namespace "%" instead of expected namespace "public". Cannot drop. Rollback aborted to fail closed.',
                    rec.object_name, v_wrong_nsp;
            ELSE
                -- Catalog object is missing (R-02)
                RAISE EXCEPTION 'ROLLBACK CATALOG IDENTITY VIOLATION (MISSING): Registry records enum "%" as migration-owned, but the object does not exist in the PostgreSQL catalog. Cannot drop missing object. Rollback aborted to fail closed.',
                    rec.object_name;
            END IF;
        END IF;

        -- B: Verify catalog object is actually an enum (typtype = ''e'') (R-03)
        IF v_type_rec.typtype != 'e' THEN
            RAISE EXCEPTION 'ROLLBACK CATALOG IDENTITY VIOLATION (NOT ENUM): Catalog object "public"."%" exists but is not an enum (typtype = "%", expected "e"). Cannot drop non-enum object. Rollback aborted to fail closed.',
                rec.object_name, v_type_rec.typtype;
        END IF;

        -- D: Verify exact ordered enum labels match Target Schema Revision 4 (R-05, R-06, R-07, R-08)
        SELECT array_agg(enumlabel ORDER BY enumsortorder)
        INTO v_actual_labels
        FROM pg_enum
        WHERE enumtypid = v_type_rec.oid;

        IF v_actual_labels IS DISTINCT FROM v_target_labels THEN
            RAISE EXCEPTION 'ROLLBACK CATALOG IDENTITY VIOLATION (LABEL MISMATCH): Catalog enum "public"."%" labels (%) do not exactly match Target Database Schema Revision 4 contract (%). Cannot drop altered enum. Rollback aborted to fail closed.',
                rec.object_name, COALESCE(v_actual_labels::text, '[]'), v_target_labels::text;
        END IF;
    END LOOP;

    -- 3.3 Strictly drop ONLY enums with triple proof & catalog identity verified (Prompt 12.4.4 Section 7)
    -- (created_by_migration = true AND ownership = ''CREATED_BY_PROMPT_12_4_2'' AND rollback_action = ''DROP'')
    -- Replaces DROP TYPE IF EXISTS with explicit, verified DROP TYPE public.%I
    FOR rec IN 
        SELECT "object_name" 
        FROM "_prompt_12_ownership_registry"
        WHERE "object_type" = 'TYPE' 
          AND "created_by_migration" = true
          AND "ownership" = 'CREATED_BY_PROMPT_12_4_2'
          AND "rollback_action" = 'DROP'
    LOOP
        EXECUTE format('DROP TYPE public.%I', rec.object_name);
        RAISE NOTICE 'DROP AUTHORIZED: Dropped Prompt 12 enum "public"."%" (Catalog identity and ownership verified).', rec.object_name;
    END LOOP;

    -- 3.4 Log preserved pre-existing enums (Prompt 12.4.4 Section 8 / R-10)
    FOR rec IN 
        SELECT "object_name" 
        FROM "_prompt_12_ownership_registry"
        WHERE "object_type" = 'TYPE' 
          AND "created_by_migration" = false
          AND "ownership" = 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED'
          AND "rollback_action" = 'PRESERVE'
    LOOP
        RAISE NOTICE 'ENUM PRESERVED: Pre-existing enum "%" strictly preserved.', rec.object_name;
    END LOOP;

    -- -------------------------------------------------------------------------
    -- 4. CLEAN UP OWNERSHIP REGISTRY (C-01: ONLY IF CREATED BY PROMPT 12)
    -- -------------------------------------------------------------------------
    IF v_drop_registry THEN
        DROP TABLE IF EXISTS "_prompt_12_ownership_registry";
        RAISE NOTICE 'Prompt 12 ownership registry removed (CREATED_BY_PROMPT_12). Rollback complete.';
    ELSE
        RAISE NOTICE 'Prompt 12 ownership registry was pre-existing (PRESERVED). Rollback complete.';
    END IF;
END $$;

COMMIT;
