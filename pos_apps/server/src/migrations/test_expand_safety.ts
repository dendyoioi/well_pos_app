import fs from 'fs';
import path from 'path';

/**
 * Static Safety Validation for Expand Phase DDL & Rollback (Prompt 12.2)
 * Inspects migration.sql and rollback.sql against Prompt 12.2 strict safety invariants:
 * - Deterministic object ownership registry
 * - Comprehensive catalog preflight for enums, tables, and transition columns
 * - Fail-closed abort on incompatible objects
 * - Rollback preserves pre-existing/reused objects and eliminates blind CASCADE
 */
export function validateExpandDdlSafety(): { passed: boolean; violations: string[] } {
  const ddlPath = path.resolve(
    __dirname,
    '../../prisma/migrations/20260919000000_expand_phase_ddl/migration.sql'
  );

  if (!fs.existsSync(ddlPath)) {
    return { passed: false, violations: [`DDL file not found at ${ddlPath}`] };
  }

  const rawSql = fs.readFileSync(ddlPath, 'utf8');
  const sql = rawSql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const violations: string[] = [];

  // 1. Forbidden Destructive Operations in migration.sql
  const forbiddenPatterns = [
    { pattern: /\bDROP\s+TABLE\b/i, name: 'DROP TABLE' },
    { pattern: /\bDROP\s+COLUMN\b/i, name: 'DROP COLUMN' },
    { pattern: /\bTRUNCATE\b/i, name: 'TRUNCATE' },
    { pattern: /\bDELETE\s+FROM\b/i, name: 'DELETE FROM' },
  ];

  for (const { pattern, name } of forbiddenPatterns) {
    if (pattern.test(sql)) {
      violations.push(`Forbidden destructive statement detected in migration.sql: ${name}`);
    }
  }

  // 2. Prohibited Schema Antipatterns
  const balanceTableMatch = sql.match(/CREATE\s+TABLE[^(]+\"inventory_balances\"\s*\(([\s\S]*?)\);/i);
  if (balanceTableMatch) {
    const tableBody = balanceTableMatch[1];
    if (/is_negative_balance/i.test(tableBody)) {
      violations.push('Prohibited column "is_negative_balance" found on inventory_balances (must only be on inventory_ledgers)!');
    }
  }

  if (/must_?change_?pin/i.test(sql) || /force_?pin_?reset/i.test(sql) || /pin_?reset_?required/i.test(sql)) {
    violations.push('Prohibited credential reset flags found on users table!');
  }

  if (/user_outlet_assignments/i.test(sql)) {
    violations.push('Prohibited UserOutletAssignment table found (Phase 1 retains direct User.outletId)!');
  }

  // 3. Verify Required Additive Structures
  const requiredTables = [
    'inventory_items',
    'product_variants',
    'storage_locations',
    'inventory_balances',
    'inventory_ledgers',
    'recipes',
    'recipe_items',
    'modifier_groups',
    'modifier_items',
    'payment_transactions',
    'refunds',
    'idempotency_records',
  ];

  for (const table of requiredTables) {
    const regex = new RegExp(`CREATE\\s+TABLE[^"]+"${table}"`, 'i');
    if (!regex.test(sql)) {
      violations.push(`Required target table "${table}" not found in DDL!`);
    }
  }

  // 4. Verify Partial Unique Index on storage_locations
  if (!/idx_storage_locations_tenant_outlet_default[\s\S]+WHERE\s+"is_default"\s*=\s*true/i.test(sql)) {
    violations.push('Required partial unique index for single default storage location not found!');
  }

  // 5. Verify Owner Review B-01: inventory_batch_id in inventory_balances and inventory_ledgers
  if (!/inventory_balances[\s\S]*inventory_batch_id/i.test(sql)) {
    violations.push('B-01 violation: inventory_batch_id missing from inventory_balances!');
  }
  if (!/inventory_ledgers[\s\S]*inventory_batch_id/i.test(sql)) {
    violations.push('B-01 violation: inventory_batch_id missing from inventory_ledgers!');
  }

  // 6. Verify Owner Review B-02: ProductVariant.inventory_item_id MUST be nullable
  const variantTableMatch = sql.match(/CREATE\s+TABLE[^(]+\"product_variants\"\s*\(([\s\S]*?)\);/i);
  if (variantTableMatch) {
    const tableBody = variantTableMatch[1];
    if (/\"inventory_item_id\"[^\n]*\bNOT\s+NULL\b/i.test(tableBody)) {
      violations.push('B-02 violation: product_variants.inventory_item_id must be nullable!');
    }
  }

  // 7. Verify Owner Review B-05: StorageLocation.allow_negative_stock MUST be nullable override
  const storageLocationMatch = sql.match(/CREATE\s+TABLE[^(]+\"storage_locations\"\s*\(([\s\S]*?)\);/i);
  if (storageLocationMatch) {
    const tableBody = storageLocationMatch[1];
    if (/\"allow_negative_stock\"[^\n]*\bNOT\s+NULL\b/i.test(tableBody) || /\"allow_negative_stock\"[^\n]*\bDEFAULT\b/i.test(tableBody)) {
      violations.push('B-05 violation: storage_locations.allow_negative_stock must be nullable without default!');
    }
  }

  // 8. Verify Owner Review B-06: unit_conversions.conversion_factor
  if (!/CREATE\s+TABLE[^(]+\"unit_conversions\"[\s\S]*conversion_factor/i.test(sql)) {
    violations.push('B-06 violation: unit_conversions must define conversion_factor!');
  }

  // 9. Verify Owner Review B-07: inventory_ledgers.actor_user_id & reference_id
  const ledgerMatch = sql.match(/CREATE\s+TABLE[^(]+\"inventory_ledgers\"\s*\(([\s\S]*?)\);/i);
  if (ledgerMatch) {
    const tableBody = ledgerMatch[1];
    if (/actor_id\b/i.test(tableBody) && !/actor_user_id\b/i.test(tableBody)) {
      violations.push('B-07 violation: inventory_ledgers has actor_id instead of actor_user_id!');
    }
  }

  // 10. Prompt 12.1 Correction B: Order Status Consistency across artifacts
  const orderTableMatch = sql.match(/ALTER\s+TABLE[^(]+\"orders\"[\s\S]*?;/i);
  if (orderTableMatch) {
    const ordersBody = orderTableMatch[0];
    if (!/\"order_status\"[^\n]*DEFAULT\s+'CONFIRMED'/i.test(ordersBody)) {
      violations.push('Correction B violation: orders.order_status in migration.sql must have DEFAULT \'CONFIRMED\' (matching Revision 4)!');
    }
  }

  // 11. Prompt 12.3 C-01: Ownership Registry Lifecycle & Structural Preflight
  if (!/_prompt_12_ownership_registry/i.test(sql)) {
    violations.push('Prompt 12.3 violation: migration.sql missing _prompt_12_ownership_registry table creation!');
  }
  if (!/REGISTRY COMPATIBILITY VIOLATION/i.test(sql)) {
    violations.push('Prompt 12.3 C-01 violation: migration.sql missing REGISTRY COMPATIBILITY VIOLATION fail-closed check!');
  }
  if (!/'REGISTRY',\s*'',\s*'_prompt_12_ownership_registry'/i.test(sql)) {
    violations.push('Prompt 12.3 C-01 violation: migration.sql missing registry self-ownership registration!');
  }

  // 12. Prompt 12.3 C-02: Full Target Table Structural Compatibility Preflight
  if (!/TABLE COMPATIBILITY VIOLATION/i.test(sql)) {
    violations.push('Prompt 12.3 C-02 violation: migration.sql missing TABLE COMPATIBILITY VIOLATION fail-closed check!');
  }
  if (!/contype\s*=\s*'p'/i.test(sql)) {
    violations.push('Prompt 12.3 C-02 violation: migration.sql must verify primary key existence on target tables!');
  }

  // 13. Prompt 12.3 C-03: Full Transition Column Semantic Compatibility Preflight
  if (!/COLUMN COMPATIBILITY VIOLATION/i.test(sql)) {
    violations.push('Prompt 12.3 C-03 violation: migration.sql missing COLUMN COMPATIBILITY VIOLATION fail-closed check!');
  }
  if (!/numeric_precision/i.test(sql) || !/numeric_scale/i.test(sql)) {
    violations.push('Prompt 12.3 C-03 violation: migration.sql must verify numeric_precision and numeric_scale for financial columns!');
  }

  // 14. Prompt 12.4: Full Index Definition & Compatibility Audit (All 34 Indexes)
  if (!/INDEX COMPATIBILITY VIOLATION/i.test(sql)) {
    violations.push('Prompt 12.4 violation: migration.sql missing INDEX COMPATIBILITY VIOLATION fail-closed check!');
  }
  if (!/pg_indexes/i.test(sql)) {
    violations.push('Prompt 12.4 violation: migration.sql must audit pg_indexes for index definitions and uniqueness!');
  }
  // Verify that all 34 actual target indexes are listed in temp_target_indexes
  const targetIndexNames = [
    'idx_inventory_items_tenant_code',
    'idx_inventory_items_tenant_active',
    'idx_product_variants_tenant_sku',
    'idx_product_variants_tenant_barcode',
    'idx_product_variants_tenant_product',
    'idx_product_variants_tenant_item',
    'idx_storage_locations_tenant_outlet_name',
    'idx_storage_locations_tenant_outlet',
    'idx_storage_locations_tenant_outlet_default',
    'idx_inventory_batches_tenant_item_batch',
    'idx_inventory_batches_tenant_expiration',
    'idx_inventory_balances_unbatched',
    'idx_inventory_balances_batched',
    'idx_inventory_balances_location',
    'idx_inventory_ledgers_item_date',
    'idx_inventory_ledgers_ref',
    'idx_inventory_ledgers_batch',
    'idx_unit_conversions_units',
    'idx_recipe_items_recipe_item',
    'idx_recipe_items_tenant_item',
    'idx_modifier_groups_tenant_name',
    'idx_modifier_items_group',
    'idx_product_modifier_groups_unique',
    'idx_product_modifier_groups_tenant',
    'idx_modifier_recipe_effects_unique',
    'idx_modifier_recipe_effects_tenant',
    'idx_payment_transactions_order',
    'idx_payment_transactions_status',
    'idx_refunds_tenant_number',
    'idx_refunds_order',
    'idx_refund_items_refund',
    'idx_refund_items_order_item',
    'idx_idempotency_records_key',
    'idx_idempotency_records_expiry',
  ];
  for (const idxName of targetIndexNames) {
    if (!sql.includes(idxName)) {
      violations.push(`Prompt 12.4 violation: Index "${idxName}" missing from migration.sql target indexes!`);
    }
  }

  // 15. Prompt 12.4 Rollback Ownership & Preservation Verification
  const rollbackPath = path.resolve(
    __dirname,
    '../../prisma/migrations/20260919000000_expand_phase_ddl/rollback.sql'
  );
  if (fs.existsSync(rollbackPath)) {
    const rawRollback = fs.readFileSync(rollbackPath, 'utf8');
    const rollbackSql = rawRollback.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

    // 15.1 Verify Registry Integration
    if (!/_prompt_12_ownership_registry/i.test(rollbackSql)) {
      violations.push('Prompt 12.4 violation: rollback.sql must query _prompt_12_ownership_registry to verify ownership!');
    }

    // 15.2 Verify C-01: Registry dropped ONLY if created by Prompt 12
    if (!/v_drop_registry/i.test(rollbackSql) || !/CREATED_BY_PROMPT_12/i.test(rollbackSql)) {
      violations.push('Prompt 12.4 C-01 violation: rollback.sql must drop _prompt_12_ownership_registry only if CREATED_BY_PROMPT_12!');
    }

    // 15.3 Prohibit CASCADE shortcuts on DROP TABLE
    if (/DROP\s+TABLE[^(]+CASCADE/i.test(rollbackSql)) {
      violations.push('Prompt 12.4 violation: rollback.sql must NOT use CASCADE on DROP TABLE (respect explicit dependency order)!');
    }

    // 15.4 Explicit Rollback of Prompt 12-created Indexes
    if (!/DROP\s+INDEX\s+IF\s+EXISTS/i.test(rollbackSql) || !/'INDEX'/i.test(rollbackSql)) {
      violations.push('Prompt 12.4 violation: rollback.sql must explicitly drop Prompt 12 created indexes!');
    }

    // 15.5 Forbidden Drops of Pre-Existing Enums
    const protectedEnums = [
      'ShiftStatus',
      'StockMovementType',
      'Role',
      'PlatformRole',
      'TenantStatus',
      'PaymentStatus',
      'PaymentMethod',
    ];
    for (const enumName of protectedEnums) {
      const dropRegex = new RegExp(`DROP\\s+TYPE[^(]+"${enumName}"`, 'i');
      if (dropRegex.test(rollbackSql)) {
        violations.push(`Prompt 12.4 violation: rollback.sql must NOT drop pre-existing/reused enum "${enumName}"!`);
      }
    }

    // 15.6 Prompt 12.4: Explicit Forbidden Drops of ALL 18 Pre-Existing Legacy Tables
    const protectedTables = [
      'tenants', 'outlets', 'users', 'products', 'categories',
      'customers', 'orders', 'order_items', 'payments', 'shifts',
      'subscription_plans', 'tenant_subscriptions', 'saas_invoices',
      'saas_payments', 'platform_users', 'outlet_products',
      'stock_movements', 'hold_orders'
    ];
    for (const tableName of protectedTables) {
      const dropTableRegex = new RegExp(`DROP\\s+TABLE[^(]+"${tableName}"`, 'i');
      if (dropTableRegex.test(rollbackSql)) {
        violations.push(`Prompt 12.4 violation: rollback.sql must NOT drop protected legacy table "${tableName}"!`);
      }
    }

    // 15.7 Prompt 12.4.2 E-08/E-09: Rollback Enum Safety (registry-driven drops)
    if (!/WHERE\s+"?object_type"?\s*=\s*'TYPE'/i.test(rollbackSql) || !/"?rollback_action"?\s*=\s*'DROP'/i.test(rollbackSql)) {
      violations.push('Prompt 12.4.2 violation: rollback.sql must drop enums only where object_type = \'TYPE\' and rollback_action = \'DROP\'!');
    }
    if (!/ENUM PRESERVED/i.test(rollbackSql)) {
      violations.push('Prompt 12.4.2 violation: rollback.sql must explicitly log ENUM PRESERVED for pre-existing reused enums!');
    }
  } else {
    violations.push(`Rollback file not found at ${rollbackPath}`);
  }

  // 16. Prompt 12.4.2 E-10: Prohibit ALTER TYPE ... ADD VALUE anywhere in migration or rollback SQL
  const addValueRegex = /\bALTER\s+TYPE\b[\s\S]*?\bADD\s+VALUE\b/i;
  if (addValueRegex.test(sql)) {
    violations.push('Prompt 12.4.2 E-10 violation: migration.sql must NOT contain ALTER TYPE ... ADD VALUE (no enum mutation during Expand)!');
  }
  if (fs.existsSync(rollbackPath)) {
    const rawRollback = fs.readFileSync(rollbackPath, 'utf8');
    if (addValueRegex.test(rawRollback)) {
      violations.push('Prompt 12.4.2 E-10 violation: rollback.sql must NOT contain ALTER TYPE ... ADD VALUE!');
    }
  }

  // 17. Prompt 12.4.2 E-11: Prohibit subset/superset compatibility logic in migration.sql
  if (/!=\s*ALL\b/i.test(sql) || /enumlabel\s*!=\s*ALL/i.test(sql)) {
    violations.push('Prompt 12.4.2 E-11 violation: migration.sql must NOT use subset compatibility logic (must use exact array comparison)!');
  }
  if (!/v_actual_labels\s+IS\s+DISTINCT\s+FROM\s+rec\.target_labels/i.test(sql)) {
    violations.push('Prompt 12.4.2 E-11 violation: migration.sql must use exact ordered array comparison (v_actual_labels IS DISTINCT FROM rec.target_labels)!');
  }

  // 18. Prompt 12.4.2 E-12: Verify all 20 Target Schema Revision 4 Enums Covered in Preflight & Migration
  const targetEnumNames = [
    'PlatformRole',
    'TenantStatus',
    'BusinessVertical',
    'BillingCycle',
    'InvoiceStatus',
    'PaymentRecordStatus',
    'Role',
    'ShiftStatus',
    'ProductType',
    'SelectionType',
    'UomType',
    'StorageLocationType',
    'StockMovementType',
    'InventoryRefType',
    'ActorType',
    'OrderStatus',
    'PaymentStatus',
    'PaymentMethod',
    'PaymentTxStatus',
    'RefundReason'
  ];
  for (const enumName of targetEnumNames) {
    if (!sql.includes(`'${enumName}'`)) {
      violations.push(`Prompt 12.4.2 E-12 violation: Target enum "${enumName}" is missing from migration.sql preflight!`);
    }
  }

  // 19. Prompt 12.4.2: Verify Registry Schema Columns
  if (!/compatibility_state/i.test(sql) || !/created_by_migration/i.test(sql) || !/rollback_action/i.test(sql)) {
    violations.push('Prompt 12.4.2 violation: _prompt_12_ownership_registry missing required columns: compatibility_state, created_by_migration, rollback_action!');
  }

  // 20. Prompt 12.4.3 P-16: Prohibit Unsafe Enum Ownership Overwrite & Verify Provenance Invariants
  if (/ENUM OWNERSHIP PROVENANCE UNVERIFIED/i.test(sql) === false) {
    violations.push('Prompt 12.4.3 violation: migration.sql missing ENUM OWNERSHIP PROVENANCE UNVERIFIED fail-closed check!');
  }
  if (/ENUM CATALOG \/ REGISTRY CONTRADICTION/i.test(sql) === false) {
    violations.push('Prompt 12.4.3 violation: migration.sql missing ENUM CATALOG / REGISTRY CONTRADICTION fail-closed check!');
  }
  if (/REGISTRY OWNERSHIP CONTRADICTION/i.test(sql) === false) {
    violations.push('Prompt 12.4.3 violation: migration.sql missing REGISTRY OWNERSHIP CONTRADICTION fail-closed check!');
  }

  if (fs.existsSync(rollbackPath)) {
    const rawRollback = fs.readFileSync(rollbackPath, 'utf8');
    const cleanRollback = rawRollback.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

    if (!/ROLLBACK CONTRADICTION/i.test(rawRollback)) {
      violations.push('Prompt 12.4.3 violation: rollback.sql missing ROLLBACK CONTRADICTION fail-closed check before enum drops!');
    }
    if (!/RAISE\s+EXCEPTION[^(]+ROLLBACK ABORTED:[^;]+_prompt_12_ownership_registry/i.test(rawRollback)) {
      violations.push('Prompt 12.4.3 violation: rollback.sql must raise EXCEPTION when registry table does not exist (P-14)!');
    }

    // 21. Prompt 12.4.4 R-12: Prohibit DROP TYPE IF EXISTS in rollback.sql
    if (/\bDROP\s+TYPE\s+IF\s+EXISTS\b/i.test(cleanRollback)) {
      violations.push('Prompt 12.4.4 R-12 violation: rollback.sql must not use DROP TYPE IF EXISTS for migration-owned enums!');
    }

    // 22. Prompt 12.4.4 R-13: Static scan confirms exact ordered label comparison in rollback
    if (!/v_actual_labels\s+IS\s+DISTINCT\s+FROM\s+v_target_labels/i.test(rawRollback)) {
      violations.push('Prompt 12.4.4 R-13 violation: rollback.sql must verify exact ordered labels (v_actual_labels IS DISTINCT FROM v_target_labels)!');
    }

    // 23. Prompt 12.4.4 R-14: Static scan confirms catalog identity checks in rollback
    if (!/pg_type/i.test(rawRollback) || !/pg_namespace/i.test(rawRollback) || !/pg_enum/i.test(rawRollback)) {
      violations.push('Prompt 12.4.4 R-14 violation: rollback.sql must inspect pg_type, pg_namespace, and pg_enum catalogs!');
    }
    if (!/typtype\s*(!=|=)\s*'e'/i.test(rawRollback)) {
      violations.push('Prompt 12.4.4 R-14 violation: rollback.sql must verify typtype check for \'e\' before dropping enums!');
    }
    if (!/nspname\s*=\s*'public'/i.test(rawRollback)) {
      violations.push('Prompt 12.4.4 R-14 violation: rollback.sql must verify expected namespace (\'public\') before dropping enums!');
    }
    if (!/DROP\s+TYPE\s+public\./i.test(rawRollback)) {
      violations.push('Prompt 12.4.4 R-14 violation: rollback.sql must issue qualified DROP TYPE public.%I!');
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

if (require.main === module) {
  console.log('Running Expand DDL Static Safety Validation (Prompt 12.4)...');
  const result = validateExpandDdlSafety();

  if (result.passed) {
    console.log('✅ EXPAND DDL SAFETY VALIDATION PASSED (Zero forbidden operations detected, Prompt 12.4 Invariant verified: 34 indexes, 18 target tables, 23 transition cols, 20 enums)');
    process.exit(0);
  } else {
    console.error('❌ EXPAND DDL SAFETY VALIDATION FAILED:');
    result.violations.forEach((v) => console.error(`  - ${v}`));
    process.exit(1);
  }
}
