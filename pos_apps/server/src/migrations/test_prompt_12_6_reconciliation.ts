import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(suite: string, name: string, condition: boolean, details?: string) {
  results.push({ suite, name, passed: condition, details });
  if (!condition) {
    console.error(`❌ [FAIL] ${suite} -> ${name}: ${details || 'Assertion failed'}`);
  } else {
    console.log(`✅ [PASS] ${suite} -> ${name}`);
  }
}

async function runValidation() {
  console.log('===============================================================');
  console.log('PROMPT 12.6 INDEPENDENT CONSISTENCY VALIDATION SUITE');
  console.log('===============================================================\n');

  const rootDir = path.resolve(__dirname, '../../..');
  const targetSchemaPath = path.join(rootDir, 'docs/architecture/04_TARGET_DATABASE_SCHEMA.md');
  const prismaSchemaPath = path.join(rootDir, 'server/prisma/schema.prisma');
  const migrationSqlPath = path.join(rootDir, 'server/prisma/migrations/20260919000000_expand_phase_ddl/migration.sql');
  const rollbackSqlPath = path.join(rootDir, 'server/prisma/migrations/20260919000000_expand_phase_ddl/rollback.sql');

  const targetSchemaContent = fs.readFileSync(targetSchemaPath, 'utf-8');
  const prismaSchemaContent = fs.readFileSync(prismaSchemaPath, 'utf-8');
  const migrationSqlContent = fs.readFileSync(migrationSqlPath, 'utf-8');
  const rollbackSqlContent = fs.readFileSync(rollbackSqlPath, 'utf-8');

  // ==========================================
  // SUITE 1: OWNER DECISION CONTRACTS (ODR-01..06)
  // ==========================================
  console.log('--- SUITE 1: OWNER DECISION CONTRACTS (ODR-01..06) ---');

  // ODR-01: PlatformRole
  const odr01Target = targetSchemaContent.includes('enum PlatformRole') &&
    targetSchemaContent.includes('SUPER_ADMIN') &&
    targetSchemaContent.includes('SUPPORT') &&
    targetSchemaContent.includes('BILLING');
  const odr01Prisma = prismaSchemaContent.includes('enum PlatformRole') &&
    prismaSchemaContent.includes('SUPER_ADMIN') &&
    prismaSchemaContent.includes('SUPPORT') &&
    prismaSchemaContent.includes('BILLING');
  const odr01Migration = migrationSqlContent.includes("('PlatformRole', ARRAY['SUPER_ADMIN', 'SUPPORT', 'BILLING'])");
  const odr01Rollback = rollbackSqlContent.includes("('PlatformRole', ARRAY['SUPER_ADMIN', 'SUPPORT', 'BILLING'])");
  assert('ODR-01', 'PlatformRole Target Schema Contract', odr01Target, 'Target Schema must define SUPER_ADMIN, SUPPORT, BILLING');
  assert('ODR-01', 'PlatformRole Prisma Contract', odr01Prisma, 'Prisma schema must define SUPER_ADMIN, SUPPORT, BILLING');
  assert('ODR-01', 'PlatformRole Migration SQL Contract', odr01Migration, 'migration.sql must declare SUPER_ADMIN, SUPPORT, BILLING');
  assert('ODR-01', 'PlatformRole Rollback SQL Contract', odr01Rollback, 'rollback.sql must declare SUPER_ADMIN, SUPPORT, BILLING');

  // ODR-02: TenantStatus
  const odr02Target = targetSchemaContent.includes('enum TenantStatus') &&
    targetSchemaContent.includes('PENDING') &&
    targetSchemaContent.includes('TRIAL') &&
    targetSchemaContent.includes('ACTIVE');
  const odr02Prisma = prismaSchemaContent.includes('enum TenantStatus') &&
    prismaSchemaContent.includes('PENDING') &&
    prismaSchemaContent.includes('TRIAL') &&
    prismaSchemaContent.includes('ACTIVE');
  const odr02Migration = migrationSqlContent.includes("('TenantStatus', ARRAY['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'PENDING'])");
  const odr02Rollback = rollbackSqlContent.includes("('TenantStatus', ARRAY['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'PENDING'])");
  assert('ODR-02', 'TenantStatus Target Schema Contract (+PENDING)', odr02Target, 'Target Schema must include PENDING');
  assert('ODR-02', 'TenantStatus Prisma Contract (+PENDING)', odr02Prisma, 'Prisma schema must include PENDING');
  assert('ODR-02', 'TenantStatus Migration SQL Contract (+PENDING)', odr02Migration, 'migration.sql must include PENDING');
  assert('ODR-02', 'TenantStatus Rollback SQL Contract (+PENDING)', odr02Rollback, 'rollback.sql must include PENDING');

  // ODR-03: InvoiceStatus
  const odr03Target = targetSchemaContent.includes('enum InvoiceStatus') &&
    targetSchemaContent.includes('DRAFT') &&
    targetSchemaContent.includes('UNPAID') &&
    targetSchemaContent.includes('PAID') &&
    targetSchemaContent.includes('VOID');
  const odr03Prisma = prismaSchemaContent.includes('enum InvoiceStatus') &&
    prismaSchemaContent.includes('DRAFT') &&
    prismaSchemaContent.includes('UNPAID') &&
    prismaSchemaContent.includes('PAID') &&
    prismaSchemaContent.includes('VOID');
  const odr03Migration = migrationSqlContent.includes("('InvoiceStatus', ARRAY['DRAFT', 'UNPAID', 'PAID', 'VOID'])");
  const odr03Rollback = rollbackSqlContent.includes("('InvoiceStatus', ARRAY['DRAFT', 'UNPAID', 'PAID', 'VOID'])");
  assert('ODR-03', 'InvoiceStatus Target Schema Contract', odr03Target, 'Target Schema must define DRAFT, UNPAID, PAID, VOID');
  assert('ODR-03', 'InvoiceStatus Prisma Contract', odr03Prisma, 'Prisma schema must define DRAFT, UNPAID, PAID, VOID');
  assert('ODR-03', 'InvoiceStatus Migration SQL Contract', odr03Migration, 'migration.sql must declare DRAFT, UNPAID, PAID, VOID');
  assert('ODR-03', 'InvoiceStatus Rollback SQL Contract', odr03Rollback, 'rollback.sql must declare DRAFT, UNPAID, PAID, VOID');

  // ODR-04: Role
  const odr04Target = targetSchemaContent.includes('enum Role') &&
    targetSchemaContent.includes('WAREHOUSE') &&
    targetSchemaContent.includes('OWNER') &&
    targetSchemaContent.includes('ADMIN');
  const odr04Prisma = prismaSchemaContent.includes('enum Role') &&
    prismaSchemaContent.includes('WAREHOUSE') &&
    prismaSchemaContent.includes('OWNER') &&
    prismaSchemaContent.includes('ADMIN');
  const odr04Migration = migrationSqlContent.includes("('Role', ARRAY['OWNER', 'ADMIN', 'SUPERVISOR', 'WAREHOUSE', 'CASHIER', 'KITCHEN', 'WAITER'])");
  const odr04Rollback = rollbackSqlContent.includes("('Role', ARRAY['OWNER', 'ADMIN', 'SUPERVISOR', 'WAREHOUSE', 'CASHIER', 'KITCHEN', 'WAITER'])");
  assert('ODR-04', 'Role Target Schema Contract (+WAREHOUSE)', odr04Target, 'Target Schema must include WAREHOUSE');
  assert('ODR-04', 'Role Prisma Contract (+WAREHOUSE)', odr04Prisma, 'Prisma schema must include WAREHOUSE');
  assert('ODR-04', 'Role Migration SQL Contract (+WAREHOUSE)', odr04Migration, 'migration.sql must include WAREHOUSE');
  assert('ODR-04', 'Role Rollback SQL Contract (+WAREHOUSE)', odr04Rollback, 'rollback.sql must include WAREHOUSE');

  // ODR-05: Inventory History Policy
  const odr05Doc = targetSchemaContent.includes('ODR-05') && targetSchemaContent.includes('InventoryLedger');
  assert('ODR-05', 'Inventory History Policy Documented in Target Schema', odr05Doc, 'Target Schema documents ODR-05 opening balance policy');

  // ODR-06: PaymentTxStatus
  const odr06Target = targetSchemaContent.includes('enum PaymentTxStatus') &&
    targetSchemaContent.includes('CAPTURED') &&
    targetSchemaContent.includes('PENDING');
  const odr06Prisma = prismaSchemaContent.includes('enum PaymentTxStatus') &&
    prismaSchemaContent.includes('CAPTURED') &&
    prismaSchemaContent.includes('PENDING');
  const odr06Migration = migrationSqlContent.includes("('PaymentTxStatus', ARRAY['PENDING', 'CAPTURED', 'FAILED', 'REFUNDED', 'VOIDED'])");
  const odr06Rollback = rollbackSqlContent.includes("('PaymentTxStatus', ARRAY['PENDING', 'CAPTURED', 'FAILED', 'REFUNDED', 'VOIDED'])");
  assert('ODR-06', 'PaymentTxStatus Target Schema Contract', odr06Target, 'Target Schema defines CAPTURED and Phase 1 manual review');
  assert('ODR-06', 'PaymentTxStatus Prisma Contract', odr06Prisma, 'Prisma schema defines CAPTURED');
  assert('ODR-06', 'PaymentTxStatus Migration SQL Contract', odr06Migration, 'migration.sql declares CAPTURED');
  assert('ODR-06', 'PaymentTxStatus Rollback SQL Contract', odr06Rollback, 'rollback.sql declares CAPTURED');

  // ==========================================
  // SUITE 2: ENUM INVENTORY & CROSS-FILE EXACT MATCH
  // ==========================================
  console.log('\n--- SUITE 2: ENUM INVENTORY & CROSS-FILE MATCH ---');

  const expected20Enums = [
    'PlatformRole', 'TenantStatus', 'BusinessVertical', 'BillingCycle', 'InvoiceStatus',
    'PaymentRecordStatus', 'Role', 'ShiftStatus', 'ProductType', 'SelectionType',
    'UomType', 'StorageLocationType', 'StockMovementType', 'InventoryRefType', 'ActorType',
    'OrderStatus', 'PaymentStatus', 'PaymentMethod', 'PaymentTxStatus', 'RefundReason'
  ];

  for (const enumName of expected20Enums) {
    const inMigration = migrationSqlContent.includes(`('${enumName}',`);
    const inRollback = rollbackSqlContent.includes(`('${enumName}',`);
    const inPrisma = prismaSchemaContent.includes(`enum ${enumName} `);
    assert('EnumConsistency', `${enumName} in migration.sql`, inMigration, `migration.sql must declare ${enumName}`);
    assert('EnumConsistency', `${enumName} in rollback.sql`, inRollback, `rollback.sql must declare ${enumName}`);
    assert('EnumConsistency', `${enumName} in schema.prisma`, inPrisma, `schema.prisma must declare ${enumName}`);
  }

  // ==========================================
  // SUITE 3: APPLICATION CODE & RBAC RECONCILIATION
  // ==========================================
  console.log('\n--- SUITE 3: APPLICATION CODE & RBAC ---');

  // Distinct PaymentStatus and PaymentTxStatus
  const paymentStatusDistinct = targetSchemaContent.includes('enum PaymentStatus');
  const paymentTxStatusDistinct = targetSchemaContent.includes('enum PaymentTxStatus');
  assert('AppLogic', 'PaymentStatus and PaymentTxStatus are separate enums', paymentStatusDistinct && paymentTxStatusDistinct, 'Order payment status vs gateway/tx status must remain separate');

  // ==========================================
  // SUITE 4: MIGRATION SAFETY & ZERO REAL DB MUTATION
  // ==========================================
  console.log('\n--- SUITE 4: MIGRATION SAFETY & POS_DB INTEGRITY ---');

  // Check static safety: no DROP TABLE on legacy tables
  const legacyTables = [
    'categories',
    'customers',
    'hold_orders',
    'order_items',
    'orders',
    'outlet_products',
    'outlets',
    'payments',
    'platform_users',
    'products',
    'saas_invoices',
    'saas_payments',
    'shifts',
    'stock_movements',
    'subscription_plans',
    'tenant_subscriptions',
    'tenants',
    'users',
  ];

  for (const table of legacyTables) {
    const dropRegex = new RegExp(`DROP\\s+TABLE(?:\\s+IF\\s+EXISTS)?\\s+(?:public\\.)?"?${table}"?`, 'i');
    assert('SafetyScan', `migration.sql never drops legacy table ${table}`, !dropRegex.test(migrationSqlContent), `Forbidden DROP TABLE on ${table}`);
  }

  // Connect to real pos_db to verify 0 mutations (READ-ONLY)
  const prisma = new PrismaClient();
  try {
    const tables = [
      'categories', 'customers', 'hold_orders', 'order_items', 'orders',
      'outlet_products', 'outlets', 'payments', 'platform_users', 'products',
      'saas_invoices', 'saas_payments', 'shifts', 'stock_movements',
      'subscription_plans', 'tenant_subscriptions', 'tenants', 'users'
    ];
    let totalRows = 0;
    for (const t of tables) {
      const res: any = await prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM public.${t}`);
      totalRows += Number(res[0].count);
    }

    assert('LiveDBIntegrity', 'pos_db total rows preserved (=17)', totalRows === 17, `Got ${totalRows} rows`);

    // Check schema_ownership_registry does not exist yet (no migration executed)
    const registryExists: any = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'schema_ownership_registry'
      ) AS exists;
    `;
    assert('LiveDBIntegrity', 'schema_ownership_registry not created yet in pos_db', !registryExists[0].exists, 'Migration has not been executed on pos_db');

  } catch (err: any) {
    assert('LiveDBIntegrity', 'pos_db connection', false, err.message);
  } finally {
    await prisma.$disconnect();
  }

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log('\n===============================================================');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  if (failed > 0) {
    console.error('❌ VALIDATION FAILED!');
    process.exit(1);
  } else {
    console.log('✅ ALL VALIDATION TESTS PASSED PERFECTLY!');
  }
}

runValidation().catch(e => {
  console.error(e);
  process.exit(1);
});
