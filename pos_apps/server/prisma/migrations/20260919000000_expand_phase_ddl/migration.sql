-- ==============================================================================
-- PROMPT 12.3: EXPAND-PHASE REVERSIBLE, NON-DESTRUCTIVE POSTGRESQL DDL
-- Project: Well POS Multi-Tenant SaaS Platform
-- Target Schema Reference: Revision 4 (Architecture-Locked)
-- Safety Invariant: STRICTLY ADDITIVE ONLY (NO DROP TABLE, NO DROP COLUMN, NO TRUNCATE, NO DELETE)
-- Ownership Model: FAIL-CLOSED PREFLIGHT WITH DETERMINISTIC OBJECT OWNERSHIP TRACKING
-- Hardening: C-01 (Registry Ownership), C-02 (Table Structural Compatibility),
--            C-03 (Column Compatibility), C-04 (Index Compatibility),
--            C-05 (Constraint Compatibility), C-06 (18 Legacy Tables Protection)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. MIGRATION OBJECT OWNERSHIP REGISTRY & LIFECYCLE (C-01)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_reg_exists BOOLEAN;
    v_reg_cols_ok BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = '_prompt_12_ownership_registry' AND c.relkind = 'r'
    ) INTO v_reg_exists;

    IF NOT v_reg_exists THEN
        CREATE TABLE "_prompt_12_ownership_registry" (
            "object_type" VARCHAR(50) NOT NULL,    -- 'REGISTRY', 'TYPE', 'TABLE', 'COLUMN', 'INDEX'
            "parent_name" VARCHAR(100) NOT NULL DEFAULT '',
            "object_name" VARCHAR(100) NOT NULL,
            "ownership" VARCHAR(50) NOT NULL,      -- 'CREATED_BY_PROMPT_12_4_2', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED'
            "compatibility_state" VARCHAR(50) NOT NULL DEFAULT 'EXACT_COMPATIBLE',
            "created_by_migration" BOOLEAN NOT NULL DEFAULT true,
            "rollback_action" VARCHAR(50) NOT NULL DEFAULT 'DROP',
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY ("object_type", "object_name", "parent_name")
        );
        INSERT INTO "_prompt_12_ownership_registry" ("object_type", "parent_name", "object_name", "ownership", "compatibility_state", "created_by_migration", "rollback_action")
        VALUES ('REGISTRY', '', '_prompt_12_ownership_registry', 'CREATED_BY_PROMPT_12_4_2', 'NEW_OBJECT', true, 'DROP');
        RAISE NOTICE 'Created "_prompt_12_ownership_registry" (CREATED_BY_PROMPT_12_4_2).';
    ELSE
        -- Ensure required columns exist if pre-existing
        ALTER TABLE "_prompt_12_ownership_registry" ADD COLUMN IF NOT EXISTS "compatibility_state" VARCHAR(50) NOT NULL DEFAULT 'EXACT_COMPATIBLE';
        ALTER TABLE "_prompt_12_ownership_registry" ADD COLUMN IF NOT EXISTS "created_by_migration" BOOLEAN NOT NULL DEFAULT true;
        ALTER TABLE "_prompt_12_ownership_registry" ADD COLUMN IF NOT EXISTS "rollback_action" VARCHAR(50) NOT NULL DEFAULT 'DROP';

        -- Verify structural compatibility of existing registry (C-01)
        SELECT (
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '_prompt_12_ownership_registry' AND column_name = 'object_type' AND udt_name = 'varchar') AND
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '_prompt_12_ownership_registry' AND column_name = 'parent_name' AND udt_name = 'varchar') AND
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '_prompt_12_ownership_registry' AND column_name = 'object_name' AND udt_name = 'varchar') AND
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '_prompt_12_ownership_registry' AND column_name = 'ownership' AND udt_name = 'varchar') AND
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '_prompt_12_ownership_registry' AND column_name = 'compatibility_state' AND udt_name = 'varchar') AND
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '_prompt_12_ownership_registry' AND column_name = 'created_by_migration' AND udt_name = 'bool') AND
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '_prompt_12_ownership_registry' AND column_name = 'rollback_action' AND udt_name = 'varchar') AND
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '_prompt_12_ownership_registry' AND column_name = 'created_at' AND udt_name = 'timestamptz')
        ) INTO v_reg_cols_ok;

        IF NOT v_reg_cols_ok THEN
            RAISE EXCEPTION 'REGISTRY COMPATIBILITY VIOLATION: Existing table "_prompt_12_ownership_registry" has incompatible columns or data types. Migration aborted to fail closed.';
        END IF;

        INSERT INTO "_prompt_12_ownership_registry" ("object_type", "parent_name", "object_name", "ownership", "compatibility_state", "created_by_migration", "rollback_action")
        VALUES ('REGISTRY', '', '_prompt_12_ownership_registry', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE')
        ON CONFLICT DO NOTHING;
        RAISE NOTICE 'Reusing compatible "_prompt_12_ownership_registry" (PRE_EXISTING_EXACT_COMPATIBLE_REUSED).';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 1. DETERMINISTIC PREFLIGHT & OBJECT OWNERSHIP VALIDATION GATE
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    rec RECORD;
    v_incompatible TEXT;
    v_target_tables TEXT[];
    v_tbl TEXT;
    v_col RECORD;
    v_actual_udt TEXT;
    v_actual_maxlen INT;
    v_actual_prec INT;
    v_actual_scale INT;
    v_actual_nullable TEXT;
    v_actual_def TEXT;
    v_req_col RECORD;
    v_pk_cols TEXT[];
    v_idx RECORD;
    v_idx_rec RECORD;
    v_fk_rec RECORD;
    v_actual_fk RECORD;
    v_table_exists BOOLEAN;
BEGIN
    -- -------------------------------------------------------------------------
    -- 1.1 ENUMS AUDIT & PREFLIGHT
    -- -------------------------------------------------------------------------
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

    DECLARE
        v_actual_labels TEXT[];
        v_enum_exists BOOLEAN;
        v_has_reg BOOLEAN;
        v_reg RECORD;
    BEGIN
    FOR rec IN SELECT * FROM temp_target_enums LOOP
        -- 1. Check PostgreSQL catalog existence
        v_enum_exists := EXISTS (SELECT 1 FROM pg_type WHERE typname = rec.enum_name);

        -- 2. Check ownership registry record
        SELECT 
            "ownership",
            "compatibility_state",
            "created_by_migration",
            "rollback_action"
        INTO v_reg
        FROM "_prompt_12_ownership_registry"
        WHERE "object_type" = 'TYPE' 
          AND "parent_name" = '' 
          AND "object_name" = rec.enum_name;

        v_has_reg := FOUND;

        -- 3. Provenance & Re-run Invariant Evaluation (Prompt 12.4.3)
        IF v_has_reg THEN
            -- Case 6: Validate registry internal consistency (P-08, P-09, P-10)
            IF v_reg.ownership NOT IN ('CREATED_BY_PROMPT_12_4_2', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED') THEN
                RAISE EXCEPTION 'REGISTRY OWNERSHIP CONTRADICTION: Enum "%" has invalid or unexpected ownership value "%". Expected CREATED_BY_PROMPT_12_4_2 or PRE_EXISTING_EXACT_COMPATIBLE_REUSED. Migration aborted to fail closed.',
                    rec.enum_name, v_reg.ownership;
            END IF;

            IF v_reg.created_by_migration = true THEN
                IF v_reg.ownership != 'CREATED_BY_PROMPT_12_4_2' OR v_reg.rollback_action != 'DROP' THEN
                    RAISE EXCEPTION 'REGISTRY OWNERSHIP CONTRADICTION: Enum "%" has created_by_migration=true but ownership="%"; rollback_action="%". Must be CREATED_BY_PROMPT_12_4_2 and DROP. Migration aborted to fail closed.',
                        rec.enum_name, v_reg.ownership, v_reg.rollback_action;
                END IF;
            ELSE
                IF v_reg.ownership != 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED' OR v_reg.rollback_action != 'PRESERVE' THEN
                    RAISE EXCEPTION 'REGISTRY OWNERSHIP CONTRADICTION: Enum "%" has created_by_migration=false but ownership="%"; rollback_action="%". Must be PRE_EXISTING_EXACT_COMPATIBLE_REUSED and PRESERVE. Migration aborted to fail closed.',
                        rec.enum_name, v_reg.ownership, v_reg.rollback_action;
                END IF;
            END IF;

            -- Case 4 & Case 5: Registry record exists, but enum is absent from catalog (P-06, P-07)
            IF NOT v_enum_exists THEN
                RAISE EXCEPTION 'ENUM CATALOG / REGISTRY CONTRADICTION: Registry records enum "%" as "%" (created_by_migration=%, rollback_action=%), but the enum does not exist in the PostgreSQL catalog. Silent recreation or repair is prohibited. Owner review required.',
                    rec.enum_name, v_reg.ownership, v_reg.created_by_migration, v_reg.rollback_action;
            END IF;

            -- Enum exists in catalog: verify exact contract definition
            SELECT array_agg(enumlabel ORDER BY enumsortorder)
            INTO v_actual_labels
            FROM pg_enum
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = rec.enum_name);

            IF v_actual_labels IS DISTINCT FROM rec.target_labels THEN
                RAISE EXCEPTION 'ENUM COMPATIBILITY VIOLATION: Existing PostgreSQL enum "%" does not exactly match Target Database Schema Revision 4 contract. Existing labels: %, Target labels: %. Exact equality required; subset, superset, or reordered enums cannot be reused. Migration aborted to fail closed and prevent silent vocabulary corruption. Owner review required.', 
                    rec.enum_name, COALESCE(v_actual_labels::text, '[]'), rec.target_labels::text;
            END IF;

            -- Provenance is strictly preserved! (P-03, P-04, P-11: No update, no downgrade)
            IF v_reg.ownership = 'CREATED_BY_PROMPT_12_4_2' THEN
                RAISE NOTICE 'Enum "%" pre-exists in catalog and registry proves it was created by this migration (CREATED_BY_PROMPT_12_4_2, ownership preserved across rerun).', rec.enum_name;
            ELSE
                RAISE NOTICE 'Enum "%" pre-exists in catalog and registry proves it was pre-existing (PRE_EXISTING_EXACT_COMPATIBLE_REUSED, ownership preserved across rerun).', rec.enum_name;
            END IF;

        ELSE
            -- v_has_reg IS FALSE: No registry record exists for this enum
            IF v_enum_exists THEN
                -- Case 3: Enum exists in catalog, but registry has NO ownership record (P-05)
                -- FAIL CLOSED: Do not infer ownership from existence alone!
                RAISE EXCEPTION 'ENUM OWNERSHIP PROVENANCE UNVERIFIED: Enum "%" exists in PostgreSQL catalog, but has no ownership record in "_prompt_12_ownership_registry". Historical provenance cannot be established from catalog existence alone. Inferred reuse is prohibited to prevent rollback corruption. Migration aborted to fail closed. Owner review required.',
                    rec.enum_name;
            ELSE
                -- Case 1 / Section 7: First run, enum absent (P-01)
                -- 1. Create exact enum
                EXECUTE format('CREATE TYPE %I AS ENUM (%s)', 
                    rec.enum_name, 
                    array_to_string(ARRAY(SELECT quote_literal(l) FROM unnest(rec.target_labels) AS l), ', ')
                );
                
                -- 2. Register ownership as CREATED_BY_PROMPT_12_4_2
                INSERT INTO "_prompt_12_ownership_registry" 
                    ("object_type", "parent_name", "object_name", "ownership", "compatibility_state", "created_by_migration", "rollback_action")
                VALUES 
                    ('TYPE', '', rec.enum_name, 'CREATED_BY_PROMPT_12_4_2', 'NEW_OBJECT', true, 'DROP');

                RAISE NOTICE 'Created enum "%" with exact Revision 4 labels (CREATED_BY_PROMPT_12_4_2).', rec.enum_name;
            END IF;
        END IF;
    END LOOP;
    END;

    -- -------------------------------------------------------------------------
    -- 1.2 FULL TARGET TABLE STRUCTURAL COMPATIBILITY PREFLIGHT (C-02)
    -- -------------------------------------------------------------------------
    v_target_tables := ARRAY[
        'inventory_items', 'product_variants', 'storage_locations', 'inventory_batches',
        'inventory_balances', 'inventory_ledgers', 'unit_conversions', 'recipes',
        'recipe_items', 'modifier_groups', 'modifier_items', 'product_modifier_groups',
        'modifier_recipe_effects', 'payment_transactions', 'refunds', 'refund_items',
        'idempotency_records', 'legacy_stock_movements'
    ];

CREATE TEMP TABLE temp_target_table_columns (
    table_name TEXT,
    col_name TEXT,
    expected_udt TEXT,
    expected_maxlen INT,
    expected_prec INT,
    expected_scale INT,
    expected_def TEXT,
    is_nullable TEXT
) ON COMMIT DROP;

INSERT INTO temp_target_table_columns VALUES
('idempotency_records', 'id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('idempotency_records', 'tenant_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('idempotency_records', 'operation_type', 'varchar', 50, NULL, NULL, NULL, 'NO'),
('idempotency_records', 'idempotency_key', 'varchar', 255, NULL, NULL, NULL, 'NO'),
('idempotency_records', 'request_hash', 'varchar', 64, NULL, NULL, NULL, 'YES'),
('idempotency_records', 'status_code', 'int4', NULL, 32, 0, NULL, 'YES'),
('idempotency_records', 'response_body', 'jsonb', NULL, NULL, NULL, NULL, 'YES'),
('idempotency_records', 'created_at', 'timestamp', NULL, NULL, NULL, 'CURRENT_TIMESTAMP', 'NO'),
('idempotency_records', 'expires_at', 'timestamp', NULL, NULL, NULL, NULL, 'NO'),
('inventory_balances', 'id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('inventory_balances', 'tenant_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('inventory_balances', 'inventory_item_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('inventory_balances', 'storage_location_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('inventory_balances', 'inventory_batch_id', 'text', NULL, NULL, NULL, NULL, 'YES'),
('inventory_balances', 'quantity_on_hand', 'numeric', NULL, 12, 3, '0', 'NO'),
('inventory_balances', 'quantity_reserved', 'numeric', NULL, 12, 3, '0', 'NO'),
('inventory_balances', 'updated_at', 'timestamp', NULL, NULL, NULL, 'CURRENT_TIMESTAMP', 'NO'),
('inventory_batches', 'id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('inventory_batches', 'tenant_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('inventory_batches', 'inventory_item_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('inventory_batches', 'batch_number', 'varchar', 100, NULL, NULL, NULL, 'NO'),
('inventory_batches', 'expiration_date', 'timestamp', NULL, NULL, NULL, NULL, 'YES'),
('inventory_batches', 'received_date', 'timestamp', NULL, NULL, NULL, 'CURRENT_TIMESTAMP', 'NO'),
('inventory_batches', 'cost_price', 'numeric', NULL, 15, 4, NULL, 'NO'),
('inventory_batches', 'is_active', 'bool', NULL, NULL, NULL, 'true', 'NO'),
('inventory_batches', 'created_at', 'timestamp', NULL, NULL, NULL, 'CURRENT_TIMESTAMP', 'NO'),
('inventory_items', 'id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('inventory_items', 'tenant_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('inventory_items', 'item_code', 'varchar', 50, NULL, NULL, NULL, 'NO'),
('inventory_items', 'name', 'varchar', 255, NULL, NULL, NULL, 'NO'),
('inventory_items', 'description', 'text', NULL, NULL, NULL, NULL, 'YES'),
('inventory_items', 'canonical_uom', 'varchar', 20, NULL, NULL, NULL, 'NO'),
('inventory_items', 'purchase_uom', 'varchar', 20, NULL, NULL, NULL, 'YES'),
('inventory_items', 'reorder_point', 'numeric', NULL, 12, 3, '0', 'NO'),
('inventory_items', 'target_level', 'numeric', NULL, 12, 3, '0', 'NO'),
('inventory_items', 'average_cost', 'numeric', NULL, 15, 4, '0', 'NO'),
('inventory_items', 'allow_negative_stock', 'bool', NULL, NULL, NULL, NULL, 'YES'),
('inventory_items', 'is_batched', 'bool', NULL, NULL, NULL, 'false', 'NO'),
('inventory_items', 'is_active', 'bool', NULL, NULL, NULL, 'true', 'NO'),
('inventory_items', 'created_at', 'timestamp', NULL, NULL, NULL, 'CURRENT_TIMESTAMP', 'NO'),
('inventory_items', 'updated_at', 'timestamp', NULL, NULL, NULL, 'CURRENT_TIMESTAMP', 'NO'),
('inventory_ledgers', 'id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('inventory_ledgers', 'tenant_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('inventory_ledgers', 'inventory_item_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('inventory_ledgers', 'storage_location_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('inventory_ledgers', 'inventory_batch_id', 'text', NULL, NULL, NULL, NULL, 'YES'),
('inventory_ledgers', 'quantity_delta', 'numeric', NULL, 12, 3, NULL, 'NO'),
('inventory_ledgers', 'balance_before', 'numeric', NULL, 12, 3, NULL, 'NO'),
('inventory_ledgers', 'balance_after', 'numeric', NULL, 12, 3, NULL, 'NO'),
('inventory_ledgers', 'unit_cost', 'numeric', NULL, 15, 4, NULL, 'NO'),
('inventory_ledgers', 'movement_type', 'StockMovementType', NULL, NULL, NULL, NULL, 'NO'),
('inventory_ledgers', 'reference_type', 'InventoryRefType', NULL, NULL, NULL, NULL, 'NO'),
('inventory_ledgers', 'reference_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('inventory_ledgers', 'actor_type', 'ActorType', NULL, NULL, NULL, '''USER''::"ActorType"', 'NO'),
('inventory_ledgers', 'actor_user_id', 'text', NULL, NULL, NULL, NULL, 'YES'),
('inventory_ledgers', 'is_negative_balance', 'bool', NULL, NULL, NULL, 'false', 'NO'),
('inventory_ledgers', 'notes', 'text', NULL, NULL, NULL, NULL, 'YES'),
('inventory_ledgers', 'created_at', 'timestamp', NULL, NULL, NULL, 'CURRENT_TIMESTAMP', 'NO'),
('legacy_stock_movements', 'id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('legacy_stock_movements', 'outlet_id', 'text', NULL, NULL, NULL, NULL, 'YES'),
('legacy_stock_movements', 'product_id', 'text', NULL, NULL, NULL, NULL, 'YES'),
('legacy_stock_movements', 'type', 'varchar', 50, NULL, NULL, NULL, 'YES'),
('legacy_stock_movements', 'quantity', 'int4', NULL, 32, 0, NULL, 'YES'),
('legacy_stock_movements', 'notes', 'text', NULL, NULL, NULL, NULL, 'YES'),
('legacy_stock_movements', 'created_at', 'timestamp', NULL, NULL, NULL, NULL, 'YES'),
('legacy_stock_movements', 'archived_at', 'timestamp', NULL, NULL, NULL, 'CURRENT_TIMESTAMP', 'NO'),
('modifier_groups', 'id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('modifier_groups', 'tenant_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('modifier_groups', 'name', 'varchar', 100, NULL, NULL, NULL, 'NO'),
('modifier_groups', 'selection_type', 'SelectionType', NULL, NULL, NULL, '''SINGLE''::"SelectionType"', 'NO'),
('modifier_groups', 'min_selection', 'int4', NULL, 32, 0, '0', 'NO'),
('modifier_groups', 'max_selection', 'int4', NULL, 32, 0, '1', 'NO'),
('modifier_groups', 'is_required', 'bool', NULL, NULL, NULL, 'false', 'NO'),
('modifier_groups', 'created_at', 'timestamp', NULL, NULL, NULL, 'CURRENT_TIMESTAMP', 'NO'),
('modifier_groups', 'updated_at', 'timestamp', NULL, NULL, NULL, 'CURRENT_TIMESTAMP', 'NO'),
('modifier_items', 'id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('modifier_items', 'tenant_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('modifier_items', 'modifier_group_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('modifier_items', 'name', 'varchar', 100, NULL, NULL, NULL, 'NO'),
('modifier_items', 'price_adjustment', 'numeric', NULL, 15, 2, '0', 'NO'),
('modifier_items', 'is_default', 'bool', NULL, NULL, NULL, 'false', 'NO'),
('modifier_items', 'created_at', 'timestamp', NULL, NULL, NULL, 'CURRENT_TIMESTAMP', 'NO'),
('modifier_items', 'updated_at', 'timestamp', NULL, NULL, NULL, 'CURRENT_TIMESTAMP', 'NO'),
('modifier_recipe_effects', 'id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('modifier_recipe_effects', 'tenant_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('modifier_recipe_effects', 'modifier_item_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('modifier_recipe_effects', 'inventory_item_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('modifier_recipe_effects', 'quantity_delta', 'numeric', NULL, 12, 3, NULL, 'NO'),
('modifier_recipe_effects', 'created_at', 'timestamp', NULL, NULL, NULL, 'CURRENT_TIMESTAMP', 'NO'),
('payment_transactions', 'id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('payment_transactions', 'tenant_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('payment_transactions', 'order_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('payment_transactions', 'payment_method', 'PaymentMethod', NULL, NULL, NULL, NULL, 'NO'),
('payment_transactions', 'amount', 'numeric', NULL, 15, 2, NULL, 'NO'),
('payment_transactions', 'reference_number', 'varchar', 100, NULL, NULL, NULL, 'YES'),
('payment_transactions', 'gateway_provider', 'varchar', 50, NULL, NULL, NULL, 'YES'),
('payment_transactions', 'status', 'PaymentTxStatus', NULL, NULL, NULL, '''PENDING''::"PaymentTxStatus"', 'NO'),
('payment_transactions', 'metadata', 'jsonb', NULL, NULL, NULL, NULL, 'YES'),
('payment_transactions', 'paid_at', 'timestamp', NULL, NULL, NULL, NULL, 'YES'),
('payment_transactions', 'created_at', 'timestamp', NULL, NULL, NULL, 'CURRENT_TIMESTAMP', 'NO'),
('product_modifier_groups', 'id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('product_modifier_groups', 'tenant_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('product_modifier_groups', 'product_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('product_modifier_groups', 'modifier_group_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('product_modifier_groups', 'sort_order', 'int4', NULL, 32, 0, '0', 'NO'),
('product_modifier_groups', 'created_at', 'timestamp', NULL, NULL, NULL, 'CURRENT_TIMESTAMP', 'NO'),
('product_variants', 'id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('product_variants', 'tenant_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('product_variants', 'product_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('product_variants', 'inventory_item_id', 'text', NULL, NULL, NULL, NULL, 'YES'),
('product_variants', 'sku', 'varchar', 100, NULL, NULL, NULL, 'NO'),
('product_variants', 'barcode', 'varchar', 100, NULL, NULL, NULL, 'YES'),
('product_variants', 'name', 'varchar', 255, NULL, NULL, NULL, 'NO'),
('product_variants', 'price', 'numeric', NULL, 15, 2, NULL, 'NO'),
('product_variants', 'inventory_quantity_multiplier', 'numeric', NULL, 12, 3, '1.000', 'NO'),
('product_variants', 'is_active', 'bool', NULL, NULL, NULL, 'true', 'NO'),
('product_variants', 'created_at', 'timestamp', NULL, NULL, NULL, 'CURRENT_TIMESTAMP', 'NO'),
('product_variants', 'updated_at', 'timestamp', NULL, NULL, NULL, 'CURRENT_TIMESTAMP', 'NO'),
('recipe_items', 'id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('recipe_items', 'tenant_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('recipe_items', 'recipe_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('recipe_items', 'inventory_item_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('recipe_items', 'quantity', 'numeric', NULL, 12, 3, NULL, 'NO'),
('recipe_items', 'cost_ratio', 'numeric', NULL, 5, 4, '1.000', 'NO'),
('recipe_items', 'created_at', 'timestamp', NULL, NULL, NULL, 'CURRENT_TIMESTAMP', 'NO'),
('recipe_items', 'updated_at', 'timestamp', NULL, NULL, NULL, 'CURRENT_TIMESTAMP', 'NO'),
('recipes', 'id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('recipes', 'tenant_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('recipes', 'product_variant_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('recipes', 'instructions', 'text', NULL, NULL, NULL, NULL, 'YES'),
('recipes', 'yield_quantity', 'numeric', NULL, 12, 3, '1.000', 'NO'),
('recipes', 'created_at', 'timestamp', NULL, NULL, NULL, 'CURRENT_TIMESTAMP', 'NO'),
('recipes', 'updated_at', 'timestamp', NULL, NULL, NULL, 'CURRENT_TIMESTAMP', 'NO'),
('refund_items', 'id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('refund_items', 'tenant_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('refund_items', 'refund_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('refund_items', 'order_item_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('refund_items', 'quantity', 'numeric', NULL, 12, 3, NULL, 'NO'),
('refund_items', 'amount', 'numeric', NULL, 15, 2, NULL, 'NO'),
('refund_items', 'restock_item', 'bool', NULL, NULL, NULL, 'true', 'NO'),
('refunds', 'id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('refunds', 'tenant_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('refunds', 'order_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('refunds', 'payment_transaction_id', 'text', NULL, NULL, NULL, NULL, 'YES'),
('refunds', 'refund_number', 'varchar', 100, NULL, NULL, NULL, 'NO'),
('refunds', 'amount', 'numeric', NULL, 15, 2, NULL, 'NO'),
('refunds', 'reason', 'RefundReason', NULL, NULL, NULL, '''CUSTOMER_RETURN''::"RefundReason"', 'NO'),
('refunds', 'notes', 'text', NULL, NULL, NULL, NULL, 'YES'),
('refunds', 'created_at', 'timestamp', NULL, NULL, NULL, 'CURRENT_TIMESTAMP', 'NO'),
('storage_locations', 'id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('storage_locations', 'tenant_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('storage_locations', 'outlet_id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('storage_locations', 'name', 'varchar', 100, NULL, NULL, NULL, 'NO'),
('storage_locations', 'type', 'StorageLocationType', NULL, NULL, NULL, '''STOREFRONT''::"StorageLocationType"', 'NO'),
('storage_locations', 'is_default', 'bool', NULL, NULL, NULL, 'false', 'NO'),
('storage_locations', 'allow_negative_stock', 'bool', NULL, NULL, NULL, NULL, 'YES'),
('storage_locations', 'is_active', 'bool', NULL, NULL, NULL, 'true', 'NO'),
('storage_locations', 'created_at', 'timestamp', NULL, NULL, NULL, 'CURRENT_TIMESTAMP', 'NO'),
('storage_locations', 'updated_at', 'timestamp', NULL, NULL, NULL, 'CURRENT_TIMESTAMP', 'NO'),
('unit_conversions', 'id', 'text', NULL, NULL, NULL, NULL, 'NO'),
('unit_conversions', 'from_uom', 'varchar', 20, NULL, NULL, NULL, 'NO'),
('unit_conversions', 'to_uom', 'varchar', 20, NULL, NULL, NULL, 'NO'),
('unit_conversions', 'conversion_factor', 'numeric', NULL, 12, 6, NULL, 'NO'),
('unit_conversions', 'uom_type', 'UomType', NULL, NULL, NULL, NULL, 'NO'),
('unit_conversions', 'is_base', 'bool', NULL, NULL, NULL, 'false', 'NO');

CREATE TEMP TABLE temp_target_table_fks (
    table_name TEXT,
    foreign_table TEXT,
    local_col TEXT,
    foreign_col TEXT,
    del_type TEXT
) ON COMMIT DROP;

INSERT INTO temp_target_table_fks VALUES
('idempotency_records', 'tenants', 'tenant_id', 'id', 'c'),
('inventory_balances', 'inventory_batches', 'inventory_batch_id', 'id', 'r'),
('inventory_balances', 'inventory_items', 'inventory_item_id', 'id', 'r'),
('inventory_balances', 'storage_locations', 'storage_location_id', 'id', 'r'),
('inventory_balances', 'tenants', 'tenant_id', 'id', 'r'),
('inventory_batches', 'inventory_items', 'inventory_item_id', 'id', 'r'),
('inventory_batches', 'tenants', 'tenant_id', 'id', 'r'),
('inventory_items', 'tenants', 'tenant_id', 'id', 'r'),
('inventory_ledgers', 'users', 'actor_user_id', 'id', 'r'),
('inventory_ledgers', 'inventory_batches', 'inventory_batch_id', 'id', 'r'),
('inventory_ledgers', 'inventory_items', 'inventory_item_id', 'id', 'r'),
('inventory_ledgers', 'storage_locations', 'storage_location_id', 'id', 'r'),
('inventory_ledgers', 'tenants', 'tenant_id', 'id', 'r'),
('modifier_groups', 'tenants', 'tenant_id', 'id', 'r'),
('modifier_items', 'modifier_groups', 'modifier_group_id', 'id', 'c'),
('modifier_items', 'tenants', 'tenant_id', 'id', 'r'),
('modifier_recipe_effects', 'inventory_items', 'inventory_item_id', 'id', 'r'),
('modifier_recipe_effects', 'modifier_items', 'modifier_item_id', 'id', 'c'),
('modifier_recipe_effects', 'tenants', 'tenant_id', 'id', 'r'),
('payment_transactions', 'orders', 'order_id', 'id', 'r'),
('payment_transactions', 'tenants', 'tenant_id', 'id', 'r'),
('product_modifier_groups', 'modifier_groups', 'modifier_group_id', 'id', 'r'),
('product_modifier_groups', 'products', 'product_id', 'id', 'c'),
('product_modifier_groups', 'tenants', 'tenant_id', 'id', 'r'),
('product_variants', 'inventory_items', 'inventory_item_id', 'id', 'r'),
('product_variants', 'products', 'product_id', 'id', 'c'),
('product_variants', 'tenants', 'tenant_id', 'id', 'r'),
('recipe_items', 'inventory_items', 'inventory_item_id', 'id', 'r'),
('recipe_items', 'recipes', 'recipe_id', 'id', 'c'),
('recipe_items', 'tenants', 'tenant_id', 'id', 'r'),
('recipes', 'product_variants', 'product_variant_id', 'id', 'c'),
('recipes', 'tenants', 'tenant_id', 'id', 'r'),
('refund_items', 'order_items', 'order_item_id', 'id', 'r'),
('refund_items', 'refunds', 'refund_id', 'id', 'c'),
('refund_items', 'tenants', 'tenant_id', 'id', 'r'),
('refunds', 'orders', 'order_id', 'id', 'r'),
('refunds', 'payment_transactions', 'payment_transaction_id', 'id', 'r'),
('refunds', 'tenants', 'tenant_id', 'id', 'r'),
('storage_locations', 'outlets', 'outlet_id', 'id', 'r'),
('storage_locations', 'tenants', 'tenant_id', 'id', 'r');

CREATE TEMP TABLE temp_target_indexes (
    table_name TEXT,
    index_name TEXT,
    is_unique BOOLEAN,
    access_method TEXT,
    expected_cols TEXT[],
    expected_predicate TEXT
) ON COMMIT DROP;

INSERT INTO temp_target_indexes VALUES
('idempotency_records', 'idx_idempotency_records_expiry', false, 'btree', ARRAY['tenant_id', 'expires_at'], NULL),
('idempotency_records', 'idx_idempotency_records_key', true, 'btree', ARRAY['tenant_id', 'operation_type', 'idempotency_key'], NULL),
('inventory_balances', 'idx_inventory_balances_batched', true, 'btree', ARRAY['tenant_id', 'inventory_item_id', 'storage_location_id', 'inventory_batch_id'], '(inventory_batch_id IS NOT NULL)'),
('inventory_balances', 'idx_inventory_balances_location', false, 'btree', ARRAY['tenant_id', 'storage_location_id'], NULL),
('inventory_balances', 'idx_inventory_balances_unbatched', true, 'btree', ARRAY['tenant_id', 'inventory_item_id', 'storage_location_id'], '(inventory_batch_id IS NULL)'),
('inventory_batches', 'idx_inventory_batches_tenant_expiration', false, 'btree', ARRAY['tenant_id', 'expiration_date'], NULL),
('inventory_batches', 'idx_inventory_batches_tenant_item_batch', true, 'btree', ARRAY['tenant_id', 'inventory_item_id', 'batch_number'], NULL),
('inventory_items', 'idx_inventory_items_tenant_active', false, 'btree', ARRAY['tenant_id', 'is_active'], NULL),
('inventory_items', 'idx_inventory_items_tenant_code', true, 'btree', ARRAY['tenant_id', 'item_code'], NULL),
('inventory_ledgers', 'idx_inventory_ledgers_batch', false, 'btree', ARRAY['tenant_id', 'inventory_batch_id'], NULL),
('inventory_ledgers', 'idx_inventory_ledgers_item_date', false, 'btree', ARRAY['tenant_id', 'inventory_item_id', 'storage_location_id', 'created_at'], NULL),
('inventory_ledgers', 'idx_inventory_ledgers_ref', false, 'btree', ARRAY['tenant_id', 'reference_type', 'reference_id'], NULL),
('modifier_groups', 'idx_modifier_groups_tenant_name', false, 'btree', ARRAY['tenant_id', 'name'], NULL),
('modifier_items', 'idx_modifier_items_group', false, 'btree', ARRAY['tenant_id', 'modifier_group_id'], NULL),
('modifier_recipe_effects', 'idx_modifier_recipe_effects_tenant', false, 'btree', ARRAY['tenant_id', 'inventory_item_id'], NULL),
('modifier_recipe_effects', 'idx_modifier_recipe_effects_unique', true, 'btree', ARRAY['modifier_item_id', 'inventory_item_id'], NULL),
('payment_transactions', 'idx_payment_transactions_order', false, 'btree', ARRAY['tenant_id', 'order_id'], NULL),
('payment_transactions', 'idx_payment_transactions_status', false, 'btree', ARRAY['tenant_id', 'status'], NULL),
('product_modifier_groups', 'idx_product_modifier_groups_tenant', false, 'btree', ARRAY['tenant_id', 'modifier_group_id'], NULL),
('product_modifier_groups', 'idx_product_modifier_groups_unique', true, 'btree', ARRAY['product_id', 'modifier_group_id'], NULL),
('product_variants', 'idx_product_variants_tenant_barcode', true, 'btree', ARRAY['tenant_id', 'barcode'], NULL),
('product_variants', 'idx_product_variants_tenant_item', false, 'btree', ARRAY['tenant_id', 'inventory_item_id'], NULL),
('product_variants', 'idx_product_variants_tenant_product', false, 'btree', ARRAY['tenant_id', 'product_id'], NULL),
('product_variants', 'idx_product_variants_tenant_sku', true, 'btree', ARRAY['tenant_id', 'sku'], NULL),
('recipe_items', 'idx_recipe_items_recipe_item', true, 'btree', ARRAY['recipe_id', 'inventory_item_id'], NULL),
('recipe_items', 'idx_recipe_items_tenant_item', false, 'btree', ARRAY['tenant_id', 'inventory_item_id'], NULL),
('refund_items', 'idx_refund_items_order_item', false, 'btree', ARRAY['tenant_id', 'order_item_id'], NULL),
('refund_items', 'idx_refund_items_refund', false, 'btree', ARRAY['tenant_id', 'refund_id'], NULL),
('refunds', 'idx_refunds_order', false, 'btree', ARRAY['tenant_id', 'order_id'], NULL),
('refunds', 'idx_refunds_tenant_number', true, 'btree', ARRAY['tenant_id', 'refund_number'], NULL),
('storage_locations', 'idx_storage_locations_tenant_outlet', false, 'btree', ARRAY['tenant_id', 'outlet_id', 'is_default'], NULL),
('storage_locations', 'idx_storage_locations_tenant_outlet_default', true, 'btree', ARRAY['tenant_id', 'outlet_id'], '(is_default = true)'),
('storage_locations', 'idx_storage_locations_tenant_outlet_name', true, 'btree', ARRAY['tenant_id', 'outlet_id', 'name'], NULL),
('unit_conversions', 'idx_unit_conversions_units', true, 'btree', ARRAY['from_uom', 'to_uom'], NULL);


    FOREACH v_tbl IN ARRAY v_target_tables LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_class c 
            JOIN pg_namespace n ON n.oid = c.relnamespace 
            WHERE n.nspname = 'public' AND c.relname = v_tbl AND c.relkind = 'r'
        ) INTO v_table_exists;

        IF v_table_exists THEN
            -- 1. Verify primary key exists and is exactly ['id']
            SELECT array_agg(a.attname::text ORDER BY k.pos)
            INTO v_pk_cols
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace n ON n.oid = rel.relnamespace
            CROSS JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS k(attnum, pos)
            JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum
            WHERE n.nspname = 'public' AND rel.relname = v_tbl AND con.contype = 'p';

            IF v_pk_cols IS NULL OR v_pk_cols != ARRAY['id'] THEN
                RAISE EXCEPTION 'TABLE COMPATIBILITY VIOLATION: Existing table "%" primary key is %, expected [id]. Migration aborted to fail closed.', v_tbl, v_pk_cols;
            END IF;

            -- 2. Verify all required Revision 4 columns exist and match expected types, lengths, precision, scale, nullability, defaults
            FOR v_req_col IN SELECT * FROM temp_target_table_columns WHERE table_name = v_tbl LOOP
                SELECT udt_name, character_maximum_length, numeric_precision, numeric_scale, is_nullable, column_default
                INTO v_actual_udt, v_actual_maxlen, v_actual_prec, v_actual_scale, v_actual_nullable, v_actual_def
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = v_tbl AND column_name = v_req_col.col_name;

                IF v_actual_udt IS NULL THEN
                    RAISE EXCEPTION 'TABLE COMPATIBILITY VIOLATION: Existing table "%" is missing required Revision 4 column "%.%". Migration aborted to fail closed.',
                        v_tbl, v_tbl, v_req_col.col_name;
                END IF;

                IF v_actual_udt != v_req_col.expected_udt THEN
                    RAISE EXCEPTION 'TABLE COMPATIBILITY VIOLATION: Column "%.%" has type "%", expected "%". Migration aborted to fail closed.',
                        v_tbl, v_req_col.col_name, v_actual_udt, v_req_col.expected_udt;
                END IF;

                IF v_actual_nullable != v_req_col.is_nullable THEN
                    RAISE EXCEPTION 'TABLE COMPATIBILITY VIOLATION: Column "%.%" has nullability "%", expected "%". Migration aborted to fail closed.',
                        v_tbl, v_req_col.col_name, v_actual_nullable, v_req_col.is_nullable;
                END IF;

                IF v_req_col.expected_maxlen IS NOT NULL AND v_actual_maxlen IS NOT NULL AND v_actual_maxlen < v_req_col.expected_maxlen THEN
                    RAISE EXCEPTION 'TABLE COMPATIBILITY VIOLATION: Column "%.%" has length %, expected at least %. Migration aborted.',
                        v_tbl, v_req_col.col_name, v_actual_maxlen, v_req_col.expected_maxlen;
                END IF;

                IF v_req_col.expected_prec IS NOT NULL AND (v_actual_prec != v_req_col.expected_prec OR v_actual_scale != v_req_col.expected_scale) THEN
                    RAISE EXCEPTION 'TABLE COMPATIBILITY VIOLATION: Column "%.%" has precision (%,%), expected (%,%). Migration aborted.',
                        v_tbl, v_req_col.col_name, v_actual_prec, v_actual_scale, v_req_col.expected_prec, v_req_col.expected_scale;
                END IF;

                IF v_req_col.expected_def IS NOT NULL AND v_actual_def IS NOT NULL THEN
                    IF v_actual_def NOT ILIKE format('%%%s%%', v_req_col.expected_def) THEN
                        RAISE EXCEPTION 'TABLE COMPATIBILITY VIOLATION: Column "%.%" has default "%", expected default containing "%". Migration aborted to prevent data corruption.',
                            v_tbl, v_req_col.col_name, v_actual_def, v_req_col.expected_def;
                    END IF;
                END IF;
            END LOOP;

            -- 3. Verify all foreign key constraints on existing target table
            FOR v_fk_rec IN SELECT * FROM temp_target_table_fks WHERE table_name = v_tbl LOOP
                SELECT 
                    con.confdeltype,
                    frel.relname AS foreign_table,
                    (SELECT a.attname FROM unnest(con.conkey) k JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k) AS local_col,
                    (SELECT fa.attname FROM unnest(con.confkey) fk JOIN pg_attribute fa ON fa.attrelid = con.confrelid AND fa.attnum = fk) AS foreign_col
                INTO v_actual_fk
                FROM pg_constraint con
                JOIN pg_class rel ON rel.oid = con.conrelid
                JOIN pg_class frel ON frel.oid = con.confrelid
                JOIN pg_namespace n ON n.oid = rel.relnamespace
                WHERE n.nspname = 'public' 
                  AND rel.relname = v_tbl 
                  AND con.contype = 'f'
                  AND (SELECT a.attname FROM unnest(con.conkey) k JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k) = v_fk_rec.local_col;

                IF v_actual_fk.foreign_table IS NULL THEN
                    RAISE EXCEPTION 'TABLE COMPATIBILITY VIOLATION: Existing table "%" is missing foreign key on column "%". Migration aborted.',
                        v_tbl, v_fk_rec.local_col;
                END IF;

                IF v_actual_fk.foreign_table != v_fk_rec.foreign_table OR v_actual_fk.foreign_col != v_fk_rec.foreign_col THEN
                    RAISE EXCEPTION 'TABLE COMPATIBILITY VIOLATION: Table "%" FK on "%" references "%.%", expected "%.%". Migration aborted.',
                        v_tbl, v_fk_rec.local_col, v_actual_fk.foreign_table, v_actual_fk.foreign_col, v_fk_rec.foreign_table, v_fk_rec.foreign_col;
                END IF;

                IF v_actual_fk.confdeltype != v_fk_rec.del_type THEN
                    RAISE EXCEPTION 'TABLE COMPATIBILITY VIOLATION: Table "%" FK on "%" has ON DELETE %, expected %. Migration aborted.',
                        v_tbl, v_fk_rec.local_col, v_actual_fk.confdeltype, v_fk_rec.del_type;
                END IF;
            END LOOP;

            INSERT INTO "_prompt_12_ownership_registry" ("object_type", "parent_name", "object_name", "ownership", "compatibility_state", "created_by_migration", "rollback_action")
            VALUES ('TABLE', '', v_tbl, 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE')
            ON CONFLICT ("object_type", "object_name", "parent_name") DO NOTHING;
            RAISE NOTICE 'Target table "%" pre-exists with verified structural compatibility (PRE_EXISTING_EXACT_COMPATIBLE_REUSED).', v_tbl;
        ELSE
            INSERT INTO "_prompt_12_ownership_registry" ("object_type", "parent_name", "object_name", "ownership", "compatibility_state", "created_by_migration", "rollback_action")
            VALUES ('TABLE', '', v_tbl, 'CREATED_BY_PROMPT_12_4_2', 'NEW_OBJECT', true, 'DROP')
            ON CONFLICT ("object_type", "object_name", "parent_name") DO NOTHING;
            RAISE NOTICE 'Target table "%" is absent (CREATED_BY_PROMPT_12_4_2).', v_tbl;
        END IF;
    END LOOP;

    -- -------------------------------------------------------------------------
    -- 1.3 FULL COLUMN COMPATIBILITY PREFLIGHT (C-03)
    -- -------------------------------------------------------------------------
    CREATE TEMP TABLE temp_transition_cols (
        table_name TEXT,
        column_name TEXT,
        expected_udt TEXT,
        expected_maxlen INT,
        expected_prec INT,
        expected_scale INT,
        expected_def TEXT,
        is_nullable TEXT
    ) ON COMMIT DROP;

    INSERT INTO temp_transition_cols VALUES
    ('tenants', 'business_vertical', 'BusinessVertical', NULL, NULL, NULL, 'RETAIL', 'NO'),
    ('tenants', 'allow_negative_stock', 'bool', NULL, NULL, NULL, 'false', 'NO'),
    ('tenants', 'enable_batch_tracking', 'bool', NULL, NULL, NULL, 'false', 'NO'),
    ('tenants', 'enable_recipe_tracking', 'bool', NULL, NULL, NULL, 'false', 'NO'),
    ('users', 'user_code', 'varchar', 50, NULL, NULL, NULL, 'YES'),
    ('users', 'pin_hash', 'varchar', 255, NULL, NULL, NULL, 'YES'),
    ('outlets', 'code', 'varchar', 50, NULL, NULL, NULL, 'YES'),
    ('products', 'type', 'ProductType', NULL, NULL, NULL, 'STANDARD', 'NO'),
    ('categories', 'parent_id', 'text', NULL, NULL, NULL, NULL, 'YES'),
    ('customers', 'loyalty_points', 'int4', NULL, NULL, NULL, '0', 'NO'),
    ('customers', 'metadata', 'jsonb', NULL, NULL, NULL, '{}', 'NO'),
    ('orders', 'order_status', 'OrderStatus', NULL, NULL, NULL, 'CONFIRMED', 'NO'),
    ('orders', 'order_type', 'varchar', 50, NULL, NULL, 'DINE_IN', 'NO'),
    ('orders', 'service_total', 'numeric', NULL, 15, 2, '0', 'NO'),
    ('orders', 'paid_amount', 'numeric', NULL, 15, 2, '0', 'NO'),
    ('orders', 'change_amount', 'numeric', NULL, 15, 2, '0', 'NO'),
    ('order_items', 'product_variant_id', 'text', NULL, NULL, NULL, NULL, 'YES'),
    ('order_items', 'product_name', 'text', NULL, NULL, NULL, NULL, 'YES'),
    ('order_items', 'variant_name', 'text', NULL, NULL, NULL, NULL, 'YES'),
    ('order_items', 'sku', 'text', NULL, NULL, NULL, NULL, 'YES'),
    ('order_items', 'cost_price', 'numeric', NULL, 15, 4, '0', 'NO'),
    ('order_items', 'discount_amount', 'numeric', NULL, 15, 2, '0', 'NO'),
    ('order_items', 'modifiers_snapshot', 'jsonb', NULL, NULL, NULL, NULL, 'YES');

    FOR v_col IN SELECT * FROM temp_transition_cols LOOP
        SELECT udt_name, character_maximum_length, numeric_precision, numeric_scale, is_nullable, column_default
        INTO v_actual_udt, v_actual_maxlen, v_actual_prec, v_actual_scale, v_actual_nullable, v_actual_def
        FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND table_name = v_col.table_name 
          AND column_name = v_col.column_name;

        IF v_actual_udt IS NOT NULL THEN
            IF v_actual_udt != v_col.expected_udt THEN
                RAISE EXCEPTION 'COLUMN COMPATIBILITY VIOLATION: Column "%.%" has type "%", expected "%". Migration aborted to prevent data corruption.',
                    v_col.table_name, v_col.column_name, v_actual_udt, v_col.expected_udt;
            END IF;

            IF v_col.expected_maxlen IS NOT NULL AND v_actual_maxlen IS NOT NULL AND v_actual_maxlen < v_col.expected_maxlen THEN
                RAISE EXCEPTION 'COLUMN COMPATIBILITY VIOLATION: Column "%.%" has length %, expected at least %. Migration aborted.',
                    v_col.table_name, v_col.column_name, v_actual_maxlen, v_col.expected_maxlen;
            END IF;

            IF v_col.expected_prec IS NOT NULL AND (v_actual_prec != v_col.expected_prec OR v_actual_scale != v_col.expected_scale) THEN
                RAISE EXCEPTION 'COLUMN COMPATIBILITY VIOLATION: Numeric column "%.%" has precision (%,%), expected (%,%). Migration aborted.',
                    v_col.table_name, v_col.column_name, v_actual_prec, v_actual_scale, v_col.expected_prec, v_col.expected_scale;
            END IF;

            IF v_col.expected_def IS NOT NULL AND v_actual_def IS NOT NULL THEN
                IF v_actual_def NOT ILIKE format('%%%s%%', v_col.expected_def) THEN
                    RAISE EXCEPTION 'COLUMN COMPATIBILITY VIOLATION: Column "%.%" has default "%", expected default containing "%". Migration aborted to prevent data corruption.',
                        v_col.table_name, v_col.column_name, v_actual_def, v_col.expected_def;
                END IF;
            END IF;

            -- Verify transition FK constraint if present
            IF v_col.table_name = 'categories' AND v_col.column_name = 'parent_id' THEN
                SELECT con.confdeltype, frel.relname AS foreign_table
                INTO v_actual_fk
                FROM pg_constraint con
                JOIN pg_class rel ON rel.oid = con.conrelid
                JOIN pg_class frel ON frel.oid = con.confrelid
                JOIN pg_namespace n ON n.oid = rel.relnamespace
                WHERE n.nspname = 'public' AND rel.relname = 'categories' AND con.contype = 'f'
                  AND (SELECT a.attname FROM unnest(con.conkey) k JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k) = 'parent_id';

                IF v_actual_fk.foreign_table IS NOT NULL AND (v_actual_fk.foreign_table != 'categories' OR v_actual_fk.confdeltype != 'n') THEN
                    RAISE EXCEPTION 'COLUMN COMPATIBILITY VIOLATION: Column categories.parent_id FK references "%" (ON DELETE %), expected categories (ON DELETE SET NULL).',
                        v_actual_fk.foreign_table, v_actual_fk.confdeltype;
                END IF;
            END IF;

            IF v_col.table_name = 'order_items' AND v_col.column_name = 'product_variant_id' THEN
                SELECT con.confdeltype, frel.relname AS foreign_table
                INTO v_actual_fk
                FROM pg_constraint con
                JOIN pg_class rel ON rel.oid = con.conrelid
                JOIN pg_class frel ON frel.oid = con.confrelid
                JOIN pg_namespace n ON n.oid = rel.relnamespace
                WHERE n.nspname = 'public' AND rel.relname = 'order_items' AND con.contype = 'f'
                  AND (SELECT a.attname FROM unnest(con.conkey) k JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k) = 'product_variant_id';

                IF v_actual_fk.foreign_table IS NOT NULL AND (v_actual_fk.foreign_table != 'product_variants' OR v_actual_fk.confdeltype != 'r') THEN
                    RAISE EXCEPTION 'COLUMN COMPATIBILITY VIOLATION: Column order_items.product_variant_id FK references "%" (ON DELETE %), expected product_variants (ON DELETE RESTRICT).',
                        v_actual_fk.foreign_table, v_actual_fk.confdeltype;
                END IF;
            END IF;

            INSERT INTO "_prompt_12_ownership_registry" ("object_type", "parent_name", "object_name", "ownership", "compatibility_state", "created_by_migration", "rollback_action")
            VALUES ('COLUMN', v_col.table_name, v_col.column_name, 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE')
            ON CONFLICT ("object_type", "object_name", "parent_name") DO NOTHING;
            RAISE NOTICE 'Transition column "%.%" pre-exists with full semantic compatibility (PRE_EXISTING_EXACT_COMPATIBLE_REUSED).', v_col.table_name, v_col.column_name;
        ELSE
            INSERT INTO "_prompt_12_ownership_registry" ("object_type", "parent_name", "object_name", "ownership", "compatibility_state", "created_by_migration", "rollback_action")
            VALUES ('COLUMN', v_col.table_name, v_col.column_name, 'CREATED_BY_PROMPT_12_4_2', 'NEW_OBJECT', true, 'DROP')
            ON CONFLICT ("object_type", "object_name", "parent_name") DO NOTHING;
            RAISE NOTICE 'Transition column "%.%" is absent (CREATED_BY_PROMPT_12_4_2).', v_col.table_name, v_col.column_name;
        END IF;
    END LOOP;

    -- -------------------------------------------------------------------------
    -- 1.4 FULL INDEX COMPATIBILITY & DEFINITION AUDIT (C-04) - ALL 34 INDEXES
    -- -------------------------------------------------------------------------
    -- Audits PostgreSQL catalog (pg_index, pg_class, pg_am, pg_attribute, pg_indexes)
    FOR v_idx IN SELECT * FROM temp_target_indexes LOOP
        SELECT 
            i.relname AS index_name,
            idx.indisunique AS is_unique,
            am.amname AS access_method,
            (SELECT array_agg(a.attname::text ORDER BY k.pos) 
             FROM unnest(idx.indkey) WITH ORDINALITY AS k(attnum, pos) 
             JOIN pg_attribute a ON a.attrelid = idx.indrelid AND a.attnum = k.attnum) AS cols,
            pg_get_expr(idx.indpred, idx.indrelid) AS predicate,
            t.relname AS table_name
        INTO v_idx_rec
        FROM pg_index idx
        JOIN pg_class i ON i.oid = idx.indexrelid
        JOIN pg_class t ON t.oid = idx.indrelid
        JOIN pg_am am ON am.oid = i.relam
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_indexes pgi ON pgi.schemaname = n.nspname AND pgi.tablename = t.relname AND pgi.indexname = i.relname
        WHERE n.nspname = 'public' AND i.relname = v_idx.index_name;

        IF v_idx_rec.index_name IS NOT NULL THEN
            IF v_idx_rec.table_name != v_idx.table_name THEN
                RAISE EXCEPTION 'INDEX COMPATIBILITY VIOLATION: Index "%" is on table "%", expected "%". Migration aborted.',
                    v_idx.index_name, v_idx_rec.table_name, v_idx.table_name;
            END IF;

            IF v_idx_rec.is_unique != v_idx.is_unique THEN
                RAISE EXCEPTION 'INDEX COMPATIBILITY VIOLATION: Index "%" uniqueness is %, expected %. Migration aborted.',
                    v_idx.index_name, v_idx_rec.is_unique, v_idx.is_unique;
            END IF;

            IF v_idx_rec.access_method != v_idx.access_method THEN
                RAISE EXCEPTION 'INDEX COMPATIBILITY VIOLATION: Index "%" access method is "%", expected "%". Migration aborted.',
                    v_idx.index_name, v_idx_rec.access_method, v_idx.access_method;
            END IF;

            IF v_idx_rec.cols != v_idx.expected_cols THEN
                RAISE EXCEPTION 'INDEX COMPATIBILITY VIOLATION: Index "%" columns are %, expected %. Migration aborted.',
                    v_idx.index_name, v_idx_rec.cols, v_idx.expected_cols;
            END IF;

            IF v_idx_rec.predicate IS DISTINCT FROM v_idx.expected_predicate THEN
                RAISE EXCEPTION 'INDEX COMPATIBILITY VIOLATION: Index "%" predicate is "%", expected "%". Migration aborted.',
                    v_idx.index_name, v_idx_rec.predicate, v_idx.expected_predicate;
            END IF;

            INSERT INTO "_prompt_12_ownership_registry" ("object_type", "parent_name", "object_name", "ownership", "compatibility_state", "created_by_migration", "rollback_action")
            VALUES ('INDEX', v_idx.table_name, v_idx.index_name, 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE')
            ON CONFLICT ("object_type", "object_name", "parent_name") DO NOTHING;
            RAISE NOTICE 'Target index "%" pre-exists with verified definition (PRE_EXISTING_EXACT_COMPATIBLE_REUSED).', v_idx.index_name;
        ELSE
            INSERT INTO "_prompt_12_ownership_registry" ("object_type", "parent_name", "object_name", "ownership", "compatibility_state", "created_by_migration", "rollback_action")
            VALUES ('INDEX', v_idx.table_name, v_idx.index_name, 'CREATED_BY_PROMPT_12_4_2', 'NEW_OBJECT', true, 'DROP')
            ON CONFLICT ("object_type", "object_name", "parent_name") DO NOTHING;
            RAISE NOTICE 'Target index "%" is absent (CREATED_BY_PROMPT_12_4_2).', v_idx.index_name;
        END IF;
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 2. CREATE NEW TARGET TABLES (ADDITIVE & OWNERSHIP-VERIFIED)
-- ------------------------------------------------------------------------------

-- Master Logistical Item (Materials / Stock Items) - B-04: Full Revision 4 Fields
CREATE TABLE IF NOT EXISTS "inventory_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
    "item_code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "canonical_uom" VARCHAR(20) NOT NULL,
    "purchase_uom" VARCHAR(20),
    "reorder_point" DECIMAL(12, 3) NOT NULL DEFAULT 0,
    "target_level" DECIMAL(12, 3) NOT NULL DEFAULT 0,
    "average_cost" DECIMAL(15, 4) NOT NULL DEFAULT 0,
    "allow_negative_stock" BOOLEAN, -- B-04 & B-05: Nullable override
    "is_batched" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_inventory_items_tenant_code" 
    ON "inventory_items" ("tenant_id", "item_code");
CREATE INDEX IF NOT EXISTS "idx_inventory_items_tenant_active" 
    ON "inventory_items" ("tenant_id", "is_active");

-- Master Sellable Commercial Unit (Variant) - B-02: Nullable inventory_item_id
CREATE TABLE IF NOT EXISTS "product_variants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
    "product_id" TEXT NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
    "inventory_item_id" TEXT REFERENCES "inventory_items"("id") ON DELETE RESTRICT, -- Nullable for Recipes & Service Labor
    "sku" VARCHAR(100) NOT NULL,
    "barcode" VARCHAR(100),
    "name" VARCHAR(255) NOT NULL,
    "price" DECIMAL(15, 2) NOT NULL,
    "inventory_quantity_multiplier" DECIMAL(12, 3) NOT NULL DEFAULT 1.000,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_product_variants_tenant_sku" 
    ON "product_variants" ("tenant_id", "sku");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_product_variants_tenant_barcode" 
    ON "product_variants" ("tenant_id", "barcode");
CREATE INDEX IF NOT EXISTS "idx_product_variants_tenant_product" 
    ON "product_variants" ("tenant_id", "product_id");
CREATE INDEX IF NOT EXISTS "idx_product_variants_tenant_item" 
    ON "product_variants" ("tenant_id", "inventory_item_id");

-- Physical / Logical Storage Locations - B-05: Nullable allow_negative_stock override
CREATE TABLE IF NOT EXISTS "storage_locations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
    "outlet_id" TEXT NOT NULL REFERENCES "outlets"("id") ON DELETE RESTRICT,
    "name" VARCHAR(100) NOT NULL,
    "type" "StorageLocationType" NOT NULL DEFAULT 'STOREFRONT',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "allow_negative_stock" BOOLEAN, -- B-05: Nullable override
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_storage_locations_tenant_outlet_name" 
    ON "storage_locations" ("tenant_id", "outlet_id", "name");
CREATE INDEX IF NOT EXISTS "idx_storage_locations_tenant_outlet" 
    ON "storage_locations" ("tenant_id", "outlet_id", "is_default");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_storage_locations_tenant_outlet_default" 
    ON "storage_locations" ("tenant_id", "outlet_id") 
    WHERE "is_default" = true;

-- Batch and Lot Tracking
CREATE TABLE IF NOT EXISTS "inventory_batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
    "inventory_item_id" TEXT NOT NULL REFERENCES "inventory_items"("id") ON DELETE RESTRICT,
    "batch_number" VARCHAR(100) NOT NULL,
    "expiration_date" TIMESTAMP(3),
    "received_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cost_price" DECIMAL(15, 4) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_inventory_batches_tenant_item_batch" 
    ON "inventory_batches" ("tenant_id", "inventory_item_id", "batch_number");
CREATE INDEX IF NOT EXISTS "idx_inventory_batches_tenant_expiration" 
    ON "inventory_batches" ("tenant_id", "expiration_date");

-- Canonical Physical Inventory Balance - B-01: inventory_batch_id + batch-aware partial unique indexes
CREATE TABLE IF NOT EXISTS "inventory_balances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
    "inventory_item_id" TEXT NOT NULL REFERENCES "inventory_items"("id") ON DELETE RESTRICT,
    "storage_location_id" TEXT NOT NULL REFERENCES "storage_locations"("id") ON DELETE RESTRICT,
    "inventory_batch_id" TEXT REFERENCES "inventory_batches"("id") ON DELETE RESTRICT, -- B-01: Nullable Batch FK
    "quantity_on_hand" DECIMAL(12, 3) NOT NULL DEFAULT 0,
    "quantity_reserved" DECIMAL(12, 3) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_inventory_balances_unbatched" 
    ON "inventory_balances" ("tenant_id", "inventory_item_id", "storage_location_id") 
    WHERE "inventory_batch_id" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_inventory_balances_batched" 
    ON "inventory_balances" ("tenant_id", "inventory_item_id", "storage_location_id", "inventory_batch_id") 
    WHERE "inventory_batch_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_inventory_balances_location" 
    ON "inventory_balances" ("tenant_id", "storage_location_id");

-- Immutable Append-Only Stock Movement Event Ledger - B-01 & B-07: batch, actor_user_id, reference_id
CREATE TABLE IF NOT EXISTS "inventory_ledgers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
    "inventory_item_id" TEXT NOT NULL REFERENCES "inventory_items"("id") ON DELETE RESTRICT,
    "storage_location_id" TEXT NOT NULL REFERENCES "storage_locations"("id") ON DELETE RESTRICT,
    "inventory_batch_id" TEXT REFERENCES "inventory_batches"("id") ON DELETE RESTRICT, -- B-01 & B-07
    "quantity_delta" DECIMAL(12, 3) NOT NULL,
    "balance_before" DECIMAL(12, 3) NOT NULL,
    "balance_after" DECIMAL(12, 3) NOT NULL,
    "unit_cost" DECIMAL(15, 4) NOT NULL,
    "movement_type" "StockMovementType" NOT NULL,
    "reference_type" "InventoryRefType" NOT NULL,
    "reference_id" TEXT NOT NULL, -- B-07: NOT NULL
    "actor_type" "ActorType" NOT NULL DEFAULT 'USER',
    "actor_user_id" TEXT REFERENCES "users"("id") ON DELETE RESTRICT, -- B-07: actor_user_id with RESTRICT
    "is_negative_balance" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_inventory_ledgers_item_date" 
    ON "inventory_ledgers" ("tenant_id", "inventory_item_id", "storage_location_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_inventory_ledgers_ref" 
    ON "inventory_ledgers" ("tenant_id", "reference_type", "reference_id");
CREATE INDEX IF NOT EXISTS "idx_inventory_ledgers_batch" 
    ON "inventory_ledgers" ("tenant_id", "inventory_batch_id");

-- Global Standard Unit Conversions - B-06: conversion_factor and is_base
CREATE TABLE IF NOT EXISTS "unit_conversions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "from_uom" VARCHAR(20) NOT NULL,
    "to_uom" VARCHAR(20) NOT NULL,
    "conversion_factor" DECIMAL(12, 6) NOT NULL, -- B-06: conversion_factor
    "uom_type" "UomType" NOT NULL,
    "is_base" BOOLEAN NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_unit_conversions_units" 
    ON "unit_conversions" ("from_uom", "to_uom");

-- F&B Recipes (BOM)
CREATE TABLE IF NOT EXISTS "recipes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
    "product_variant_id" TEXT NOT NULL UNIQUE REFERENCES "product_variants"("id") ON DELETE CASCADE,
    "instructions" TEXT,
    "yield_quantity" DECIMAL(12, 3) NOT NULL DEFAULT 1.000,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "recipe_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
    "recipe_id" TEXT NOT NULL REFERENCES "recipes"("id") ON DELETE CASCADE,
    "inventory_item_id" TEXT NOT NULL REFERENCES "inventory_items"("id") ON DELETE RESTRICT,
    "quantity" DECIMAL(12, 3) NOT NULL,
    "cost_ratio" DECIMAL(5, 4) NOT NULL DEFAULT 1.000,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_recipe_items_recipe_item" 
    ON "recipe_items" ("recipe_id", "inventory_item_id");
CREATE INDEX IF NOT EXISTS "idx_recipe_items_tenant_item" 
    ON "recipe_items" ("tenant_id", "inventory_item_id");

-- F&B Modifiers
CREATE TABLE IF NOT EXISTS "modifier_groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
    "name" VARCHAR(100) NOT NULL,
    "selection_type" "SelectionType" NOT NULL DEFAULT 'SINGLE',
    "min_selection" INTEGER NOT NULL DEFAULT 0,
    "max_selection" INTEGER NOT NULL DEFAULT 1,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_modifier_groups_tenant_name" 
    ON "modifier_groups" ("tenant_id", "name");

CREATE TABLE IF NOT EXISTS "modifier_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
    "modifier_group_id" TEXT NOT NULL REFERENCES "modifier_groups"("id") ON DELETE CASCADE,
    "name" VARCHAR(100) NOT NULL,
    "price_adjustment" DECIMAL(15, 2) NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_modifier_items_group" 
    ON "modifier_items" ("tenant_id", "modifier_group_id");

CREATE TABLE IF NOT EXISTS "product_modifier_groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
    "product_id" TEXT NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
    "modifier_group_id" TEXT NOT NULL REFERENCES "modifier_groups"("id") ON DELETE RESTRICT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_product_modifier_groups_unique" 
    ON "product_modifier_groups" ("product_id", "modifier_group_id");
CREATE INDEX IF NOT EXISTS "idx_product_modifier_groups_tenant" 
    ON "product_modifier_groups" ("tenant_id", "modifier_group_id");

CREATE TABLE IF NOT EXISTS "modifier_recipe_effects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
    "modifier_item_id" TEXT NOT NULL REFERENCES "modifier_items"("id") ON DELETE CASCADE,
    "inventory_item_id" TEXT NOT NULL REFERENCES "inventory_items"("id") ON DELETE RESTRICT,
    "quantity_delta" DECIMAL(12, 3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_modifier_recipe_effects_unique" 
    ON "modifier_recipe_effects" ("modifier_item_id", "inventory_item_id");
CREATE INDEX IF NOT EXISTS "idx_modifier_recipe_effects_tenant" 
    ON "modifier_recipe_effects" ("tenant_id", "inventory_item_id");

-- Multi-Tender Payment Transactions
CREATE TABLE IF NOT EXISTS "payment_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
    "order_id" TEXT NOT NULL REFERENCES "orders"("id") ON DELETE RESTRICT,
    "payment_method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(15, 2) NOT NULL,
    "reference_number" VARCHAR(100),
    "gateway_provider" VARCHAR(50),
    "status" "PaymentTxStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_payment_transactions_order" 
    ON "payment_transactions" ("tenant_id", "order_id");
CREATE INDEX IF NOT EXISTS "idx_payment_transactions_status" 
    ON "payment_transactions" ("tenant_id", "status");

-- Formal Refunds
CREATE TABLE IF NOT EXISTS "refunds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
    "order_id" TEXT NOT NULL REFERENCES "orders"("id") ON DELETE RESTRICT,
    "payment_transaction_id" TEXT REFERENCES "payment_transactions"("id") ON DELETE RESTRICT,
    "refund_number" VARCHAR(100) NOT NULL,
    "amount" DECIMAL(15, 2) NOT NULL,
    "reason" "RefundReason" NOT NULL DEFAULT 'CUSTOMER_RETURN',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_refunds_tenant_number" 
    ON "refunds" ("tenant_id", "refund_number");
CREATE INDEX IF NOT EXISTS "idx_refunds_order" 
    ON "refunds" ("tenant_id", "order_id");

CREATE TABLE IF NOT EXISTS "refund_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
    "refund_id" TEXT NOT NULL REFERENCES "refunds"("id") ON DELETE CASCADE,
    "order_item_id" TEXT NOT NULL REFERENCES "order_items"("id") ON DELETE RESTRICT,
    "quantity" DECIMAL(12, 3) NOT NULL,
    "amount" DECIMAL(15, 2) NOT NULL,
    "restock_item" BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS "idx_refund_items_refund" 
    ON "refund_items" ("tenant_id", "refund_id");
CREATE INDEX IF NOT EXISTS "idx_refund_items_order_item" 
    ON "refund_items" ("tenant_id", "order_item_id");

-- Idempotency Records
CREATE TABLE IF NOT EXISTS "idempotency_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "operation_type" VARCHAR(50) NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "request_hash" VARCHAR(64),
    "status_code" INTEGER,
    "response_body" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_idempotency_records_key" 
    ON "idempotency_records" ("tenant_id", "operation_type", "idempotency_key");
CREATE INDEX IF NOT EXISTS "idx_idempotency_records_expiry" 
    ON "idempotency_records" ("tenant_id", "expires_at");

-- Read-Only Historical Movement Archive Container
CREATE TABLE IF NOT EXISTS "legacy_stock_movements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outlet_id" TEXT,
    "product_id" TEXT,
    "type" VARCHAR(50),
    "quantity" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 3. ADD NULLABLE TRANSITION COLUMNS TO LEGACY OPERATIONAL TABLES
-- ------------------------------------------------------------------------------

-- Tenants Extension (B-03 & H-06: strictly Revision 4 fields, no unapproved convenience fields)
ALTER TABLE "tenants" 
    ADD COLUMN IF NOT EXISTS "business_vertical" "BusinessVertical" DEFAULT 'RETAIL',
    ADD COLUMN IF NOT EXISTS "allow_negative_stock" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "enable_batch_tracking" BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS "enable_recipe_tracking" BOOLEAN DEFAULT false;

-- Users Model B Extension (pin preserved, NO mustChangePin or forcePinReset)
ALTER TABLE "users" 
    ADD COLUMN IF NOT EXISTS "user_code" VARCHAR(50),
    ADD COLUMN IF NOT EXISTS "pin_hash" VARCHAR(255);

-- Outlets Extension (H-06: code only, no unapproved latitude/longitude/timezone)
ALTER TABLE "outlets" 
    ADD COLUMN IF NOT EXISTS "code" VARCHAR(50);

-- Products Extension
ALTER TABLE "products" 
    ADD COLUMN IF NOT EXISTS "type" "ProductType" DEFAULT 'STANDARD';

-- Categories Extension
ALTER TABLE "categories" 
    ADD COLUMN IF NOT EXISTS "parent_id" TEXT REFERENCES "categories"("id") ON DELETE SET NULL;

-- Customers Extension
ALTER TABLE "customers" 
    ADD COLUMN IF NOT EXISTS "loyalty_points" INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Orders Extension (B-10: Decoupled lifecycle, order_type added, safe transitions)
ALTER TABLE "orders" 
    ADD COLUMN IF NOT EXISTS "order_status" "OrderStatus" DEFAULT 'CONFIRMED',
    ADD COLUMN IF NOT EXISTS "order_type" VARCHAR(50) DEFAULT 'DINE_IN',
    ADD COLUMN IF NOT EXISTS "service_total" DECIMAL(15, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "paid_amount" DECIMAL(15, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "change_amount" DECIMAL(15, 2) DEFAULT 0;

-- Order Items Extension (Historical Snapshots & Variant Foreign Key)
ALTER TABLE "order_items" 
    ADD COLUMN IF NOT EXISTS "product_variant_id" TEXT REFERENCES "product_variants"("id") ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS "product_name" TEXT,
    ADD COLUMN IF NOT EXISTS "variant_name" TEXT,
    ADD COLUMN IF NOT EXISTS "sku" TEXT,
    ADD COLUMN IF NOT EXISTS "cost_price" DECIMAL(15, 4) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "discount_amount" DECIMAL(15, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "modifiers_snapshot" JSONB;

COMMIT;
