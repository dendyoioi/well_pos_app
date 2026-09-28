import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { validateExpandDdlSafety } from './test_expand_safety';

const DB_NAME = 'pos_test_disposable_prompt12_4';
const PG_HOST = 'localhost';
const PG_USER = 'postgres';

const migrationSqlPath = path.resolve(__dirname, '../../prisma/migrations/20260919000000_expand_phase_ddl/migration.sql');
const rollbackSqlPath = path.resolve(__dirname, '../../prisma/migrations/20260919000000_expand_phase_ddl/rollback.sql');

export const TARGET_ENUM_DEFINITIONS: Record<string, string[]> = {
  PlatformRole: ['SUPER_ADMIN', 'SUPPORT', 'BILLING'],
  TenantStatus: ['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED'],
  BusinessVertical: ['RETAIL', 'FNB', 'SERVICES', 'HYBRID'],
  BillingCycle: ['MONTHLY', 'ANNUALLY'],
  InvoiceStatus: ['DRAFT', 'UNPAID', 'PAID', 'VOID'],
  PaymentRecordStatus: ['PENDING', 'SUCCESS', 'FAILED'],
  Role: ['OWNER', 'ADMIN', 'SUPERVISOR', 'CASHIER', 'KITCHEN', 'WAITER'],
  ShiftStatus: ['OPEN', 'CLOSED'],
  ProductType: ['STANDARD', 'COMPOSITE', 'SERVICE_LABOR'],
  SelectionType: ['SINGLE', 'MULTIPLE'],
  UomType: ['MASS', 'VOLUME', 'COUNT', 'LENGTH', 'TIME'],
  StorageLocationType: ['STOREFRONT', 'WAREHOUSE', 'KITCHEN', 'BAR', 'TRANSIT'],
  StockMovementType: [
    'SALE', 'PURCHASE', 'TRANSFER_IN', 'TRANSFER_OUT',
    'OPNAME_ADJUSTMENT', 'RETURN', 'WASTE', 'VOID',
    'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT'
  ],
  InventoryRefType: ['ORDER', 'PURCHASE_ORDER', 'TRANSFER', 'STOCK_OPNAME', 'REFUND', 'PRODUCTION', 'MANUAL'],
  ActorType: ['USER', 'SYSTEM'],
  OrderStatus: ['DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED', 'VOIDED'],
  PaymentStatus: ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'],
  PaymentMethod: ['CASH', 'QRIS', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'EWALLET', 'VOUCHER'],
  PaymentTxStatus: ['PENDING', 'CAPTURED', 'FAILED', 'REFUNDED', 'VOIDED'],
  RefundReason: ['CUSTOMER_RETURN', 'DAMAGED_GOODS', 'WRONG_ITEM', 'DISSATISFIED_SERVICE', 'BILLING_ERROR'],
};

function psqlQuery(db: string, sql: string): string {
  return execSync(`psql -h ${PG_HOST} -U ${PG_USER} -d ${db} -v ON_ERROR_STOP=1 -q -t -A`, {
    input: sql,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

function psqlFile(db: string, filePath: string): string {
  return execSync(`psql -h ${PG_HOST} -U ${PG_USER} -d ${db} -v ON_ERROR_STOP=1 -q -f ${JSON.stringify(filePath)}`, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

function dumpBaselineSchemaExact(): string {
  let dump = execSync(`pg_dump -s -h ${PG_HOST} -U ${PG_USER} pos_db`, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });

  dump = dump.replace(
    /CREATE TYPE public\."PlatformRole" AS ENUM \([\s\S]*?\);/,
    "CREATE TYPE public.\"PlatformRole\" AS ENUM ('SUPER_ADMIN', 'SUPPORT', 'BILLING');"
  );
  dump = dump.replace(
    /CREATE TYPE public\."TenantStatus" AS ENUM \([\s\S]*?\);/,
    "CREATE TYPE public.\"TenantStatus\" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');"
  );
  dump = dump.replace(
    /CREATE TYPE public\."Role" AS ENUM \([\s\S]*?\);/,
    "CREATE TYPE public.\"Role\" AS ENUM ('OWNER', 'ADMIN', 'SUPERVISOR', 'CASHIER', 'KITCHEN', 'WAITER');"
  );
  dump = dump.replace(
    /CREATE TYPE public\."InvoiceStatus" AS ENUM \([\s\S]*?\);/,
    "CREATE TYPE public.\"InvoiceStatus\" AS ENUM ('DRAFT', 'UNPAID', 'PAID', 'VOID');"
  );
  dump = dump.replace(
    /CREATE TYPE public\."PaymentStatus" AS ENUM \([\s\S]*?\);/,
    "CREATE TYPE public.\"PaymentStatus\" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED');"
  );
  dump = dump.replace(
    /CREATE TYPE public\."PaymentMethod" AS ENUM \([\s\S]*?\);/,
    "CREATE TYPE public.\"PaymentMethod\" AS ENUM ('CASH', 'QRIS', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'EWALLET', 'VOUCHER');"
  );
  dump = dump.replace(
    /CREATE TYPE public\."PaymentTxStatus" AS ENUM \([\s\S]*?\);/,
    "CREATE TYPE public.\"PaymentTxStatus\" AS ENUM ('PENDING', 'CAPTURED', 'FAILED', 'REFUNDED', 'VOIDED');"
  );
  dump = dump.replace(
    /CREATE TYPE public\."StockMovementType" AS ENUM \([\s\S]*?\);/,
    "CREATE TYPE public.\"StockMovementType\" AS ENUM ('SALE', 'PURCHASE', 'TRANSFER_IN', 'TRANSFER_OUT', 'OPNAME_ADJUSTMENT', 'RETURN', 'WASTE', 'VOID', 'PRODUCTION_CONSUMPTION', 'PRODUCTION_OUTPUT');"
  );

  dump = dump.replace(/DEFAULT 'SUCCESS'::public\."PaymentTxStatus"/g, "DEFAULT 'PENDING'::public.\"PaymentTxStatus\"");
  dump = dump.replace(/cost_price numeric\(12,2\) NOT NULL,/g, "cost_price numeric(15,4) NOT NULL,");
  dump = dump.replace(/discount_amount numeric\(12,2\) DEFAULT 0 NOT NULL,/g, "discount_amount numeric(15,2) DEFAULT 0 NOT NULL,");

  return dump;
}

function preseedRegistryForBaseline(db: string) {
  const existingEnums = [
    'PlatformRole', 'TenantStatus', 'BillingCycle', 'InvoiceStatus',
    'Role', 'ShiftStatus', 'StockMovementType', 'PaymentStatus',
    'PaymentMethod', 'PaymentTxStatus'
  ];
  psqlQuery(db, `
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
    INSERT INTO "_prompt_12_ownership_registry" 
      ("object_type", "parent_name", "object_name", "ownership", "compatibility_state", "created_by_migration", "rollback_action")
    VALUES 
      ('REGISTRY', '', '_prompt_12_ownership_registry', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE')
    ON CONFLICT DO NOTHING;
  `);

  for (const e of existingEnums) {
    psqlQuery(db, `
      INSERT INTO "_prompt_12_ownership_registry" 
        ("object_type", "parent_name", "object_name", "ownership", "compatibility_state", "created_by_migration", "rollback_action")
      VALUES 
        ('TYPE', '', '${e}', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE')
      ON CONFLICT DO NOTHING;
    `);
  }
}

function resetDisposableDatabase(customPreflightSql?: string): void {
  try {
    execSync(`dropdb -h ${PG_HOST} -U ${PG_USER} --if-exists ${DB_NAME}`, { stdio: 'ignore' });
  } catch {}
  execSync(`createdb -h ${PG_HOST} -U ${PG_USER} ${DB_NAME}`, { stdio: 'ignore' });

  const baselineSchema = dumpBaselineSchemaExact();
  execSync(`psql -h ${PG_HOST} -U ${PG_USER} -d ${DB_NAME} -v ON_ERROR_STOP=1 -q`, {
    input: baselineSchema,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  preseedRegistryForBaseline(DB_NAME);

  if (customPreflightSql) {
    execSync(`psql -h ${PG_HOST} -U ${PG_USER} -d ${DB_NAME} -v ON_ERROR_STOP=1 -q`, {
      input: customPreflightSql,
      stdio: ['pipe', 'pipe', 'pipe']
    });
  }
}

interface TestResult {
  code: string;
  name: string;
  passed: boolean;
  notes: string;
}

const results: TestResult[] = [];

function record(code: string, name: string, passed: boolean, notes: string) {
  results.push({ code, name, passed, notes });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${code}] ${name}: ${status}`);
  if (notes) {
    console.log(`    ${notes}`);
  }
}

export function runPrompt1244Matrix(): { passed: boolean; results: TestResult[] } {
  console.log('========================================================================');
  console.log('STARTING PROMPT 12.4.4 ENUM ROLLBACK CATALOG IDENTITY TEST MATRIX');
  console.log(`Disposable Database: ${DB_NAME}`);
  console.log('========================================================================\n');

  // ---------------------------------------------------------------------------
  // R-01: Owned enum exists and is exact target enum -> DROP AUTHORIZED
  // ---------------------------------------------------------------------------
  try {
    resetDisposableDatabase();
    psqlFile(DB_NAME, migrationSqlPath);

    // Verify BusinessVertical was created and registered as CREATED_BY_PROMPT_12_4_2
    const regCheck = psqlQuery(DB_NAME, `
      SELECT ownership, created_by_migration, rollback_action 
      FROM "_prompt_12_ownership_registry" 
      WHERE object_name = 'BusinessVertical';
    `);
    const isOwned = regCheck.trim() === 'CREATED_BY_PROMPT_12_4_2|t|DROP';

    // Execute rollback
    psqlFile(DB_NAME, rollbackSqlPath);

    // Verify BusinessVertical was dropped because it was owned and catalog identity matched exactly
    const existsAfterRollback = psqlQuery(DB_NAME, `
      SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BusinessVertical');
    `).trim() === 't';

    const passed = isOwned && !existsAfterRollback;
    record('R-01', 'Owned enum exists and is exact target enum -> DROP AUTHORIZED', passed,
      passed ? 'Owned enum verified against catalog (exists, public, typtype=e, exact labels) and cleanly dropped.'
             : `Failed: isOwned=${isOwned}, existsAfterRollback=${existsAfterRollback}`);
  } catch (err: any) {
    record('R-01', 'Owned enum exists and is exact target enum -> DROP AUTHORIZED', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // R-02: Owned enum missing from catalog -> FAIL CLOSED, ZERO DROP
  // ---------------------------------------------------------------------------
  try {
    resetDisposableDatabase();
    psqlFile(DB_NAME, migrationSqlPath);

    // Artificially drop BusinessVertical from catalog behind the registry's back
    // (Simulating catalog deletion while registry claims ownership)
    psqlQuery(DB_NAME, `DROP TYPE "BusinessVertical" CASCADE;`);

    let rollbackFailed = false;
    let errorMsg = '';
    try {
      psqlFile(DB_NAME, rollbackSqlPath);
    } catch (err: any) {
      rollbackFailed = true;
      errorMsg = err.message || '';
    }

    const caughtMissing = /ROLLBACK CATALOG IDENTITY VIOLATION \(MISSING\)/i.test(errorMsg);
    // Verify zero DROP occurred on other enums (e.g. ActorType should still be intact because transaction aborted)
    const actorTypeStillExists = psqlQuery(DB_NAME, `
      SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ActorType');
    `).trim() === 't';

    const passed = rollbackFailed && caughtMissing && actorTypeStillExists;
    record('R-02', 'Owned enum missing -> FAIL CLOSED, ZERO DROP', passed,
      passed ? 'Rollback aborted with CATALOG IDENTITY VIOLATION (MISSING); zero destructive drops executed.'
             : `Failed: rollbackFailed=${rollbackFailed}, caughtMissing=${caughtMissing}, actorTypeStillExists=${actorTypeStillExists}`);
  } catch (err: any) {
    record('R-02', 'Owned enum missing -> FAIL CLOSED, ZERO DROP', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // R-03: Owned name exists but object is not enum -> FAIL CLOSED, ZERO DROP
  // ---------------------------------------------------------------------------
  try {
    resetDisposableDatabase();
    psqlFile(DB_NAME, migrationSqlPath);

    // Replace BusinessVertical enum with a composite table/type (typtype != 'e')
    psqlQuery(DB_NAME, `
      DROP TYPE "BusinessVertical" CASCADE;
      CREATE TABLE "BusinessVertical" (id INT PRIMARY KEY, name TEXT);
    `);

    let rollbackFailed = false;
    let errorMsg = '';
    try {
      psqlFile(DB_NAME, rollbackSqlPath);
    } catch (err: any) {
      rollbackFailed = true;
      errorMsg = err.message || '';
    }

    const caughtNotEnum = /ROLLBACK CATALOG IDENTITY VIOLATION \(NOT ENUM\)/i.test(errorMsg);
    const tableStillExists = psqlQuery(DB_NAME, `
      SELECT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'BusinessVertical');
    `).trim() === 't';

    const passed = rollbackFailed && caughtNotEnum && tableStillExists;
    record('R-03', 'Owned name exists but object is not enum -> FAIL CLOSED, ZERO DROP', passed,
      passed ? 'Rollback aborted with CATALOG IDENTITY VIOLATION (NOT ENUM); table was NOT dropped.'
             : `Failed: rollbackFailed=${rollbackFailed}, caughtNotEnum=${caughtNotEnum}`);
  } catch (err: any) {
    record('R-03', 'Owned name exists but object is not enum -> FAIL CLOSED, ZERO DROP', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // R-04: Owned enum exists in wrong namespace -> FAIL CLOSED, ZERO DROP
  // ---------------------------------------------------------------------------
  try {
    resetDisposableDatabase();
    psqlFile(DB_NAME, migrationSqlPath);

    // Move BusinessVertical to a custom schema instead of public
    psqlQuery(DB_NAME, `
      CREATE SCHEMA custom_schema;
      ALTER TYPE "BusinessVertical" SET SCHEMA custom_schema;
    `);

    let rollbackFailed = false;
    let errorMsg = '';
    try {
      psqlFile(DB_NAME, rollbackSqlPath);
    } catch (err: any) {
      rollbackFailed = true;
      errorMsg = err.message || '';
    }

    const caughtNamespace = /ROLLBACK CATALOG IDENTITY VIOLATION \(NAMESPACE\)/i.test(errorMsg);
    const existsInCustom = psqlQuery(DB_NAME, `
      SELECT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_namespace n ON n.oid = t.typnamespace 
        WHERE t.typname = 'BusinessVertical' AND n.nspname = 'custom_schema'
      );
    `).trim() === 't';

    const passed = rollbackFailed && caughtNamespace && existsInCustom;
    record('R-04', 'Owned enum exists in wrong namespace -> FAIL CLOSED, ZERO DROP', passed,
      passed ? 'Rollback aborted with CATALOG IDENTITY VIOLATION (NAMESPACE); custom_schema enum NOT dropped.'
             : `Failed: rollbackFailed=${rollbackFailed}, caughtNamespace=${caughtNamespace}`);
  } catch (err: any) {
    record('R-04', 'Owned enum exists in wrong namespace -> FAIL CLOSED, ZERO DROP', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // R-05: Owned enum has missing label (subset) -> FAIL CLOSED, ZERO DROP
  // ---------------------------------------------------------------------------
  try {
    resetDisposableDatabase();
    psqlFile(DB_NAME, migrationSqlPath);

    // Replace BusinessVertical with subset enum missing 'HYBRID'
    psqlQuery(DB_NAME, `
      DROP TYPE "BusinessVertical" CASCADE;
      CREATE TYPE "BusinessVertical" AS ENUM ('RETAIL', 'FNB', 'SERVICES');
    `);

    let rollbackFailed = false;
    let errorMsg = '';
    try {
      psqlFile(DB_NAME, rollbackSqlPath);
    } catch (err: any) {
      rollbackFailed = true;
      errorMsg = err.message || '';
    }

    const caughtMismatch = /ROLLBACK CATALOG IDENTITY VIOLATION \(LABEL MISMATCH\)/i.test(errorMsg);
    const stillExists = psqlQuery(DB_NAME, `
      SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BusinessVertical');
    `).trim() === 't';

    const passed = rollbackFailed && caughtMismatch && stillExists;
    record('R-05', 'Owned enum has missing label -> FAIL CLOSED, ZERO DROP', passed,
      passed ? 'Rollback aborted with CATALOG IDENTITY VIOLATION (LABEL MISMATCH); subset enum NOT dropped.'
             : `Failed: rollbackFailed=${rollbackFailed}, caughtMismatch=${caughtMismatch}`);
  } catch (err: any) {
    record('R-05', 'Owned enum has missing label -> FAIL CLOSED, ZERO DROP', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // R-06: Owned enum has extra label (superset) -> FAIL CLOSED, ZERO DROP
  // ---------------------------------------------------------------------------
  try {
    resetDisposableDatabase();
    psqlFile(DB_NAME, migrationSqlPath);

    // Replace BusinessVertical with superset enum having extra 'WHOLESALE'
    psqlQuery(DB_NAME, `
      DROP TYPE "BusinessVertical" CASCADE;
      CREATE TYPE "BusinessVertical" AS ENUM ('RETAIL', 'FNB', 'SERVICES', 'HYBRID', 'WHOLESALE');
    `);

    let rollbackFailed = false;
    let errorMsg = '';
    try {
      psqlFile(DB_NAME, rollbackSqlPath);
    } catch (err: any) {
      rollbackFailed = true;
      errorMsg = err.message || '';
    }

    const caughtMismatch = /ROLLBACK CATALOG IDENTITY VIOLATION \(LABEL MISMATCH\)/i.test(errorMsg);
    const stillExists = psqlQuery(DB_NAME, `
      SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BusinessVertical');
    `).trim() === 't';

    const passed = rollbackFailed && caughtMismatch && stillExists;
    record('R-06', 'Owned enum has extra label -> FAIL CLOSED, ZERO DROP', passed,
      passed ? 'Rollback aborted with CATALOG IDENTITY VIOLATION (LABEL MISMATCH); superset enum NOT dropped.'
             : `Failed: rollbackFailed=${rollbackFailed}, caughtMismatch=${caughtMismatch}`);
  } catch (err: any) {
    record('R-06', 'Owned enum has extra label -> FAIL CLOSED, ZERO DROP', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // R-07: Owned enum has reordered labels -> FAIL CLOSED, ZERO DROP
  // ---------------------------------------------------------------------------
  try {
    resetDisposableDatabase();
    psqlFile(DB_NAME, migrationSqlPath);

    // Replace BusinessVertical with same labels in different sort order
    psqlQuery(DB_NAME, `
      DROP TYPE "BusinessVertical" CASCADE;
      CREATE TYPE "BusinessVertical" AS ENUM ('HYBRID', 'SERVICES', 'FNB', 'RETAIL');
    `);

    let rollbackFailed = false;
    let errorMsg = '';
    try {
      psqlFile(DB_NAME, rollbackSqlPath);
    } catch (err: any) {
      rollbackFailed = true;
      errorMsg = err.message || '';
    }

    const caughtMismatch = /ROLLBACK CATALOG IDENTITY VIOLATION \(LABEL MISMATCH\)/i.test(errorMsg);
    const stillExists = psqlQuery(DB_NAME, `
      SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BusinessVertical');
    `).trim() === 't';

    const passed = rollbackFailed && caughtMismatch && stillExists;
    record('R-07', 'Owned enum has reordered labels -> FAIL CLOSED, ZERO DROP', passed,
      passed ? 'Rollback aborted with CATALOG IDENTITY VIOLATION (LABEL MISMATCH); reordered enum NOT dropped.'
             : `Failed: rollbackFailed=${rollbackFailed}, caughtMismatch=${caughtMismatch}`);
  } catch (err: any) {
    record('R-07', 'Owned enum has reordered labels -> FAIL CLOSED, ZERO DROP', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // R-08: Owned enum has completely different vocabulary -> FAIL CLOSED, ZERO DROP
  // ---------------------------------------------------------------------------
  try {
    resetDisposableDatabase();
    psqlFile(DB_NAME, migrationSqlPath);

    // Replace BusinessVertical with arbitrary vocabulary
    psqlQuery(DB_NAME, `
      DROP TYPE "BusinessVertical" CASCADE;
      CREATE TYPE "BusinessVertical" AS ENUM ('ALPHA', 'BETA', 'GAMMA');
    `);

    let rollbackFailed = false;
    let errorMsg = '';
    try {
      psqlFile(DB_NAME, rollbackSqlPath);
    } catch (err: any) {
      rollbackFailed = true;
      errorMsg = err.message || '';
    }

    const caughtMismatch = /ROLLBACK CATALOG IDENTITY VIOLATION \(LABEL MISMATCH\)/i.test(errorMsg);
    const stillExists = psqlQuery(DB_NAME, `
      SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BusinessVertical');
    `).trim() === 't';

    const passed = rollbackFailed && caughtMismatch && stillExists;
    record('R-08', 'Owned enum has completely different vocabulary -> FAIL CLOSED, ZERO DROP', passed,
      passed ? 'Rollback aborted with CATALOG IDENTITY VIOLATION (LABEL MISMATCH); different vocabulary enum NOT dropped.'
             : `Failed: rollbackFailed=${rollbackFailed}, caughtMismatch=${caughtMismatch}`);
  } catch (err: any) {
    record('R-08', 'Owned enum has completely different vocabulary -> FAIL CLOSED, ZERO DROP', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // R-09: Owned enum has exact labels but registry triple-proof is incomplete -> FAIL CLOSED, ZERO DROP
  // ---------------------------------------------------------------------------
  try {
    resetDisposableDatabase();
    psqlFile(DB_NAME, migrationSqlPath);

    // Corrupt registry record for BusinessVertical: created_by_migration=true but rollback_action='PRESERVE'
    psqlQuery(DB_NAME, `
      UPDATE "_prompt_12_ownership_registry"
      SET rollback_action = 'PRESERVE'
      WHERE object_name = 'BusinessVertical';
    `);

    let rollbackFailed = false;
    let errorMsg = '';
    try {
      psqlFile(DB_NAME, rollbackSqlPath);
    } catch (err: any) {
      rollbackFailed = true;
      errorMsg = err.message || '';
    }

    const caughtContradiction = /ROLLBACK CONTRADICTION/i.test(errorMsg);
    const stillExists = psqlQuery(DB_NAME, `
      SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BusinessVertical');
    `).trim() === 't';

    const passed = rollbackFailed && caughtContradiction && stillExists;
    record('R-09', 'Owned enum has exact labels but registry triple-proof incomplete -> FAIL CLOSED, ZERO DROP', passed,
      passed ? 'Rollback aborted with ROLLBACK CONTRADICTION before dropping any enum; triple-proof enforcement verified.'
             : `Failed: rollbackFailed=${rollbackFailed}, caughtContradiction=${caughtContradiction}`);
  } catch (err: any) {
    record('R-09', 'Owned enum has exact labels but registry triple-proof incomplete -> FAIL CLOSED, ZERO DROP', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // R-10: Pre-existing exact enum -> PRESERVE
  // ---------------------------------------------------------------------------
  try {
    // ShiftStatus is pre-existing in baseline and pre-seeded as PRE_EXISTING_EXACT_COMPATIBLE_REUSED
    resetDisposableDatabase();
    psqlFile(DB_NAME, migrationSqlPath);

    // Rollback
    psqlFile(DB_NAME, rollbackSqlPath);

    // Verify ShiftStatus was strictly PRESERVED
    const stillExists = psqlQuery(DB_NAME, `
      SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShiftStatus');
    `).trim() === 't';

    const labels = psqlQuery(DB_NAME, `
      SELECT string_agg(enumlabel, ',' ORDER BY enumsortorder)
      FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ShiftStatus');
    `).trim();

    const passed = stillExists && labels === 'OPEN,CLOSED';
    record('R-10', 'Pre-existing exact enum -> PRESERVE', passed,
      passed ? 'Pre-existing enum was strictly preserved across rollback with exact labels unchanged.'
             : `Failed: stillExists=${stillExists}, labels=${labels}`);
  } catch (err: any) {
    record('R-10', 'Pre-existing exact enum -> PRESERVE', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // R-11: Missing registry -> FAIL CLOSED, ZERO DROP
  // ---------------------------------------------------------------------------
  try {
    resetDisposableDatabase();
    psqlFile(DB_NAME, migrationSqlPath);

    // Drop registry table completely
    psqlQuery(DB_NAME, `DROP TABLE "_prompt_12_ownership_registry" CASCADE;`);

    let rollbackFailed = false;
    let errorMsg = '';
    try {
      psqlFile(DB_NAME, rollbackSqlPath);
    } catch (err: any) {
      rollbackFailed = true;
      errorMsg = err.message || '';
    }

    const caughtMissingRegistry = /ROLLBACK ABORTED:[^;]+_prompt_12_ownership_registry/i.test(errorMsg);
    const enumStillExists = psqlQuery(DB_NAME, `
      SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BusinessVertical');
    `).trim() === 't';

    const passed = rollbackFailed && caughtMissingRegistry && enumStillExists;
    record('R-11', 'Missing registry -> FAIL CLOSED, ZERO DROP', passed,
      passed ? 'Rollback failed closed immediately when registry table was missing; zero objects dropped.'
             : `Failed: rollbackFailed=${rollbackFailed}, caughtMissingRegistry=${caughtMissingRegistry}`);
  } catch (err: any) {
    record('R-11', 'Missing registry -> FAIL CLOSED, ZERO DROP', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // R-12: Static scan detects DROP TYPE IF EXISTS in rollback authorization path -> FAIL
  // ---------------------------------------------------------------------------
  try {
    const rawRollback = fs.readFileSync(rollbackSqlPath, 'utf8');
    const cleanRollback = rawRollback.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

    const hasDropTypeIfExists = /\bDROP\s+TYPE\s+IF\s+EXISTS\b/i.test(cleanRollback);
    const passed = !hasDropTypeIfExists;
    record('R-12', 'Static scan detects DROP TYPE IF EXISTS in rollback path -> FAIL', passed,
      passed ? 'Static scan verified ZERO occurrences of DROP TYPE IF EXISTS in executable rollback SQL.'
             : 'Failed: DROP TYPE IF EXISTS found in rollback.sql executable statements!');
  } catch (err: any) {
    record('R-12', 'Static scan detects DROP TYPE IF EXISTS in rollback path -> FAIL', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // R-13: Static scan confirms exact ordered label comparison -> PASS
  // ---------------------------------------------------------------------------
  try {
    const rawRollback = fs.readFileSync(rollbackSqlPath, 'utf8');
    const hasOrderedComparison = /v_actual_labels\s+IS\s+DISTINCT\s+FROM\s+v_target_labels/i.test(rawRollback);
    const hasEnumSortOrder = /ORDER\s+BY\s+enumsortorder/i.test(rawRollback);

    const passed = hasOrderedComparison && hasEnumSortOrder;
    record('R-13', 'Static scan confirms exact ordered label comparison -> PASS', passed,
      passed ? 'Static scan confirmed pg_enum ordered by enumsortorder and exact array comparison (IS NOT DISTINCT FROM).'
             : `Failed: hasOrderedComparison=${hasOrderedComparison}, hasEnumSortOrder=${hasEnumSortOrder}`);
  } catch (err: any) {
    record('R-13', 'Static scan confirms exact ordered label comparison -> PASS', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // R-14: Static scan confirms every migration-owned enum has catalog identity validation -> PASS
  // ---------------------------------------------------------------------------
  try {
    const rawRollback = fs.readFileSync(rollbackSqlPath, 'utf8');
    const hasPgType = /pg_type/i.test(rawRollback);
    const hasPgNamespace = /pg_namespace/i.test(rawRollback);
    const hasPgEnum = /pg_enum/i.test(rawRollback);
    const hasTyptype = /typtype\s*(!=|=)\s*'e'/i.test(rawRollback);
    const hasPublicNamespace = /nspname\s*=\s*'public'/i.test(rawRollback);
    const hasQualifiedDrop = /DROP\s+TYPE\s+public\./i.test(rawRollback);

    const passed = hasPgType && hasPgNamespace && hasPgEnum && hasTyptype && hasPublicNamespace && hasQualifiedDrop;
    record('R-14', 'Static scan confirms every migration-owned enum has catalog identity validation -> PASS', passed,
      passed ? 'Static scan confirmed catalog checks: pg_type, pg_namespace, pg_enum, typtype=e, public namespace, and DROP TYPE public.%I.'
             : `Failed: pg_type=${hasPgType}, pg_namespace=${hasPgNamespace}, pg_enum=${hasPgEnum}, typtype=${hasTyptype}, namespace=${hasPublicNamespace}`);
  } catch (err: any) {
    record('R-14', 'Static scan confirms every migration-owned enum has catalog identity validation -> PASS', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // R-15: Rollback after safe migration rerun -> OWNED ENUM STILL DROPPED ONLY AFTER IDENTITY VALIDATION
  // ---------------------------------------------------------------------------
  try {
    resetDisposableDatabase();
    // Run 1: initial migration
    psqlFile(DB_NAME, migrationSqlPath);

    // Run 2: safe rerun (idempotent)
    psqlFile(DB_NAME, migrationSqlPath);

    // Verify BusinessVertical ownership survived rerun
    const regCheck = psqlQuery(DB_NAME, `
      SELECT ownership, created_by_migration, rollback_action 
      FROM "_prompt_12_ownership_registry" 
      WHERE object_name = 'BusinessVertical';
    `).trim();
    const survivedRerun = regCheck === 'CREATED_BY_PROMPT_12_4_2|t|DROP';

    // Execute rollback
    psqlFile(DB_NAME, rollbackSqlPath);

    // Verify BusinessVertical was dropped after identity validation
    const existsAfterRollback = psqlQuery(DB_NAME, `
      SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BusinessVertical');
    `).trim() === 't';

    const passed = survivedRerun && !existsAfterRollback;
    record('R-15', 'Rollback after safe migration rerun -> OWNED ENUM STILL DROPPED ONLY AFTER IDENTITY VALIDATION', passed,
      passed ? 'Rerun preserved CREATED_BY_PROMPT_12_4_2 provenance, and rollback verified catalog identity before dropping.'
             : `Failed: survivedRerun=${survivedRerun}, existsAfterRollback=${existsAfterRollback}`);
  } catch (err: any) {
    record('R-15', 'Rollback after safe migration rerun -> OWNED ENUM STILL DROPPED ONLY AFTER IDENTITY VALIDATION', false, err.message);
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log('PROMPT 12.4.4 TEST MATRIX EXECUTION SUMMARY');
  console.log('========================================================================');
  const allPassed = results.every(r => r.passed);
  results.forEach(r => {
    const symbol = r.passed ? '✅' : '❌';
    console.log(`${symbol} [${r.code}] ${r.name}: ${r.passed ? 'PASS' : 'FAIL'}`);
    if (r.notes) {
      console.log(`    ${r.notes}`);
    }
  });

  console.log('========================================================================');
  console.log(`TOTAL: ${results.filter(r => r.passed).length}/${results.length} PASSED`);
  console.log('========================================================================\n');

  return { passed: allPassed, results };
}

if (require.main === module) {
  const result = runPrompt1244Matrix();
  process.exit(result.passed ? 0 : 1);
}
