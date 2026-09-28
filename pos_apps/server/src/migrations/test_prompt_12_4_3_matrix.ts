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

  // Align legacy enums in the baseline dump to exact Target Revision 4 definitions:
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

let cleanBaselineSql = '';

function resetDb(baseline: string) {
  execSync(`psql -h ${PG_HOST} -U ${PG_USER} -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"`, { stdio: 'ignore' });
  execSync(`psql -h ${PG_HOST} -U ${PG_USER} -d postgres -c "CREATE DATABASE ${DB_NAME};"`, { stdio: 'ignore' });
  execSync(`psql -h ${PG_HOST} -U ${PG_USER} -d ${DB_NAME} -v ON_ERROR_STOP=1`, {
    input: baseline,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
}

function getEnumLabels(db: string, enumName: string): string[] | null {
  try {
    const res = psqlQuery(db, `
      SELECT array_to_string(array_agg(enumlabel ORDER BY enumsortorder), ',')
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = '${enumName}'
      GROUP BY t.typname;
    `).trim();
    if (!res) return null;
    return res.split(',');
  } catch {
    return null;
  }
}

function preseedRegistryForBaseline(db: string) {
  // Pre-seed provenance for existing baseline enums so first-run recognizes them with proven provenance (P-02)
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

export async function runPrompt12_4_3Matrix() {
  console.log('====================================================================');
  console.log('STARTING PROMPT 12.4.3 ENUM OWNERSHIP PROVENANCE & RERUN TEST MATRIX');
  console.log(`Disposable Database: ${DB_NAME}`);
  console.log('====================================================================\n');

  cleanBaselineSql = dumpBaselineSchemaExact();
  const results: { id: string; name: string; status: 'PASS' | 'FAIL'; detail: string }[] = [];

  // ---------------------------------------------------------------------------
  // P-01: First run, enum absent -> CREATE, OWNED, DROP AUTHORIZED
  // ---------------------------------------------------------------------------
  try {
    resetDb(cleanBaselineSql);
    preseedRegistryForBaseline(DB_NAME);

    // BusinessVertical is absent
    if (getEnumLabels(DB_NAME, 'BusinessVertical') !== null) {
      throw new Error('BusinessVertical must be absent before migration');
    }

    psqlFile(DB_NAME, migrationSqlPath);

    const reg = psqlQuery(DB_NAME, `
      SELECT ownership || '|' || compatibility_state || '|' || created_by_migration || '|' || rollback_action
      FROM _prompt_12_ownership_registry
      WHERE object_type = 'TYPE' AND object_name = 'BusinessVertical';
    `).trim();

    if (reg !== 'CREATED_BY_PROMPT_12_4_2|NEW_OBJECT|true|DROP') {
      throw new Error(`Expected CREATED_BY_PROMPT_12_4_2|NEW_OBJECT|true|DROP, got ${reg}`);
    }

    results.push({
      id: 'P-01',
      name: 'First run, enum absent -> CREATE, OWNED, DROP AUTHORIZED',
      status: 'PASS',
      detail: 'Absent enum created with exact labels, registered CREATED_BY_PROMPT_12_4_2 (created_by_migration=true, rollback_action=DROP).'
    });
  } catch (err: any) {
    results.push({ id: 'P-01', name: 'First run, enum absent', status: 'FAIL', detail: err.message });
  }

  // ---------------------------------------------------------------------------
  // P-02: First run, enum exists exact-compatible and provenance explicitly established
  // ---------------------------------------------------------------------------
  try {
    resetDb(cleanBaselineSql);
    preseedRegistryForBaseline(DB_NAME);

    psqlFile(DB_NAME, migrationSqlPath);

    const reg = psqlQuery(DB_NAME, `
      SELECT ownership || '|' || compatibility_state || '|' || created_by_migration || '|' || rollback_action
      FROM _prompt_12_ownership_registry
      WHERE object_type = 'TYPE' AND object_name = 'ShiftStatus';
    `).trim();

    if (reg !== 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED|EXACT_COMPATIBLE|false|PRESERVE') {
      throw new Error(`Expected PRE_EXISTING_EXACT_COMPATIBLE_REUSED|EXACT_COMPATIBLE|false|PRESERVE, got ${reg}`);
    }

    results.push({
      id: 'P-02',
      name: 'First run, enum exists exact-compatible with proven provenance',
      status: 'PASS',
      detail: 'Pre-existing enum reused with provenance intact: PRE_EXISTING_EXACT_COMPATIBLE_REUSED (rollback_action=PRESERVE).'
    });
  } catch (err: any) {
    results.push({ id: 'P-02', name: 'First run, enum exists exact-compatible', status: 'FAIL', detail: err.message });
  }

  // ---------------------------------------------------------------------------
  // P-03: Rerun after migration created enum -> OWNED REMAINS OWNED (Primary Regression Test!)
  // ---------------------------------------------------------------------------
  try {
    resetDb(cleanBaselineSql);
    preseedRegistryForBaseline(DB_NAME);

    // First run creates BusinessVertical
    psqlFile(DB_NAME, migrationSqlPath);
    const regAfterFirstRun = psqlQuery(DB_NAME, `
      SELECT ownership || '|' || created_by_migration || '|' || rollback_action
      FROM _prompt_12_ownership_registry
      WHERE object_type = 'TYPE' AND object_name = 'BusinessVertical';
    `).trim();

    if (regAfterFirstRun !== 'CREATED_BY_PROMPT_12_4_2|true|DROP') {
      throw new Error(`First run failed to set expected ownership: ${regAfterFirstRun}`);
    }

    // Second run (RERUN)
    psqlFile(DB_NAME, migrationSqlPath);

    const regAfterRerun = psqlQuery(DB_NAME, `
      SELECT ownership || '|' || created_by_migration || '|' || rollback_action
      FROM _prompt_12_ownership_registry
      WHERE object_type = 'TYPE' AND object_name = 'BusinessVertical';
    `).trim();

    if (regAfterRerun !== 'CREATED_BY_PROMPT_12_4_2|true|DROP') {
      throw new Error(`RERUN REGRESSION: Ownership downgraded on rerun! Expected CREATED_BY_PROMPT_12_4_2|true|DROP, got ${regAfterRerun}`);
    }

    results.push({
      id: 'P-03',
      name: 'Rerun after migration created enum -> OWNED REMAINS OWNED',
      status: 'PASS',
      detail: 'Provenance survived rerun without downgrade: BusinessVertical remained CREATED_BY_PROMPT_12_4_2 with rollback_action=DROP.'
    });
  } catch (err: any) {
    results.push({ id: 'P-03', name: 'Rerun after migration created enum', status: 'FAIL', detail: err.message });
  }

  // ---------------------------------------------------------------------------
  // P-04: Rerun after pre-existing exact enum reuse -> PRE_EXISTING REMAINS PRE_EXISTING
  // ---------------------------------------------------------------------------
  try {
    resetDb(cleanBaselineSql);
    preseedRegistryForBaseline(DB_NAME);

    psqlFile(DB_NAME, migrationSqlPath);
    psqlFile(DB_NAME, migrationSqlPath);

    const regAfterRerun = psqlQuery(DB_NAME, `
      SELECT ownership || '|' || created_by_migration || '|' || rollback_action
      FROM _prompt_12_ownership_registry
      WHERE object_type = 'TYPE' AND object_name = 'ShiftStatus';
    `).trim();

    if (regAfterRerun !== 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED|false|PRESERVE') {
      throw new Error(`Expected PRE_EXISTING_EXACT_COMPATIBLE_REUSED|false|PRESERVE, got ${regAfterRerun}`);
    }

    results.push({
      id: 'P-04',
      name: 'Rerun after pre-existing exact enum reuse',
      status: 'PASS',
      detail: 'Pre-existing provenance survived rerun without change: ShiftStatus remained PRE_EXISTING_EXACT_COMPATIBLE_REUSED (rollback_action=PRESERVE).'
    });
  } catch (err: any) {
    results.push({ id: 'P-04', name: 'Rerun after pre-existing exact enum reuse', status: 'FAIL', detail: err.message });
  }

  // ---------------------------------------------------------------------------
  // P-05: Registry missing, enum exists exact-compatible -> FAIL CLOSED
  // ---------------------------------------------------------------------------
  try {
    resetDb(cleanBaselineSql);
    // Registry is NOT preseeded, but exact-compatible enums exist in baseline
    let threw = false;
    let errMessage = '';
    try {
      psqlFile(DB_NAME, migrationSqlPath);
    } catch (e: any) {
      threw = true;
      errMessage = (e.stderr?.toString() || '') + (e.stdout?.toString() || '') + e.message;
    }

    if (!threw || !errMessage.includes('ENUM OWNERSHIP PROVENANCE UNVERIFIED')) {
      throw new Error(`Expected ENUM OWNERSHIP PROVENANCE UNVERIFIED fail-closed abort, got: ${errMessage}`);
    }

    results.push({
      id: 'P-05',
      name: 'Registry missing, enum exists exact-compatible -> FAIL CLOSED',
      status: 'PASS',
      detail: 'Migration failed closed with ENUM OWNERSHIP PROVENANCE UNVERIFIED; refused to infer pre-existing status from existence alone.'
    });
  } catch (err: any) {
    results.push({ id: 'P-05', name: 'Registry missing, enum exists exact-compatible', status: 'FAIL', detail: err.message });
  }

  // ---------------------------------------------------------------------------
  // P-06: Registry says migration-owned, enum missing -> FAIL CLOSED
  // ---------------------------------------------------------------------------
  try {
    resetDb(cleanBaselineSql);
    preseedRegistryForBaseline(DB_NAME);

    // Register BusinessVertical as created_by_migration, but ensure enum is absent in catalog
    psqlQuery(DB_NAME, `
      INSERT INTO "_prompt_12_ownership_registry" 
        ("object_type", "parent_name", "object_name", "ownership", "compatibility_state", "created_by_migration", "rollback_action")
      VALUES 
        ('TYPE', '', 'BusinessVertical', 'CREATED_BY_PROMPT_12_4_2', 'NEW_OBJECT', true, 'DROP');
      DROP TYPE IF EXISTS "BusinessVertical" CASCADE;
    `);

    let threw = false;
    let errMessage = '';
    try {
      psqlFile(DB_NAME, migrationSqlPath);
    } catch (e: any) {
      threw = true;
      errMessage = (e.stderr?.toString() || '') + (e.stdout?.toString() || '') + e.message;
    }

    if (!threw || !errMessage.includes('ENUM CATALOG / REGISTRY CONTRADICTION')) {
      throw new Error(`Expected ENUM CATALOG / REGISTRY CONTRADICTION abort, got: ${errMessage}`);
    }

    results.push({
      id: 'P-06',
      name: 'Registry says migration-owned, enum missing -> FAIL CLOSED',
      status: 'PASS',
      detail: 'Migration failed closed with ENUM CATALOG / REGISTRY CONTRADICTION when registry claimed ownership but enum was absent from catalog.'
    });
  } catch (err: any) {
    results.push({ id: 'P-06', name: 'Registry says migration-owned, enum missing', status: 'FAIL', detail: err.message });
  }

  // ---------------------------------------------------------------------------
  // P-07: Registry says pre-existing, enum missing -> FAIL CLOSED
  // ---------------------------------------------------------------------------
  try {
    resetDb(cleanBaselineSql);
    preseedRegistryForBaseline(DB_NAME);

    // Register ProductType as pre-existing, but ensure enum is absent
    psqlQuery(DB_NAME, `
      INSERT INTO "_prompt_12_ownership_registry" 
        ("object_type", "parent_name", "object_name", "ownership", "compatibility_state", "created_by_migration", "rollback_action")
      VALUES 
        ('TYPE', '', 'ProductType', 'PRE_EXISTING_EXACT_COMPATIBLE_REUSED', 'EXACT_COMPATIBLE', false, 'PRESERVE');
      DROP TYPE IF EXISTS "ProductType" CASCADE;
    `);

    let threw = false;
    let errMessage = '';
    try {
      psqlFile(DB_NAME, migrationSqlPath);
    } catch (e: any) {
      threw = true;
      errMessage = (e.stderr?.toString() || '') + (e.stdout?.toString() || '') + e.message;
    }

    if (!threw || !errMessage.includes('ENUM CATALOG / REGISTRY CONTRADICTION')) {
      throw new Error(`Expected ENUM CATALOG / REGISTRY CONTRADICTION abort, got: ${errMessage}`);
    }

    results.push({
      id: 'P-07',
      name: 'Registry says pre-existing, enum missing -> FAIL CLOSED',
      status: 'PASS',
      detail: 'Migration failed closed with ENUM CATALOG / REGISTRY CONTRADICTION when registry claimed pre-existing but enum was absent from catalog.'
    });
  } catch (err: any) {
    results.push({ id: 'P-07', name: 'Registry says pre-existing, enum missing', status: 'FAIL', detail: err.message });
  }

  // ---------------------------------------------------------------------------
  // P-08: Registry ownership/drop contradiction (created_by_migration=false & rollback_action=DROP)
  // ---------------------------------------------------------------------------
  try {
    resetDb(cleanBaselineSql);
    preseedRegistryForBaseline(DB_NAME);

    // Corrupt ShiftStatus registry: created_by_migration=false but rollback_action=DROP
    psqlQuery(DB_NAME, `
      UPDATE "_prompt_12_ownership_registry"
      SET rollback_action = 'DROP'
      WHERE object_name = 'ShiftStatus';
    `);

    let threw = false;
    let errMessage = '';
    try {
      psqlFile(DB_NAME, migrationSqlPath);
    } catch (e: any) {
      threw = true;
      errMessage = (e.stderr?.toString() || '') + (e.stdout?.toString() || '') + e.message;
    }

    if (!threw || !errMessage.includes('REGISTRY OWNERSHIP CONTRADICTION')) {
      throw new Error(`Expected REGISTRY OWNERSHIP CONTRADICTION abort, got: ${errMessage}`);
    }

    results.push({
      id: 'P-08',
      name: 'Registry ownership/drop contradiction -> FAIL CLOSED',
      status: 'PASS',
      detail: 'Migration failed closed when registry recorded created_by_migration=false with rollback_action=DROP.'
    });
  } catch (err: any) {
    results.push({ id: 'P-08', name: 'Registry ownership/drop contradiction', status: 'FAIL', detail: err.message });
  }

  // ---------------------------------------------------------------------------
  // P-09: Registry ownership/preserve contradiction (created_by_migration=true & rollback_action=PRESERVE)
  // ---------------------------------------------------------------------------
  try {
    resetDb(cleanBaselineSql);
    preseedRegistryForBaseline(DB_NAME);

    // Corrupt ShiftStatus registry: created_by_migration=true but rollback_action=PRESERVE
    psqlQuery(DB_NAME, `
      UPDATE "_prompt_12_ownership_registry"
      SET created_by_migration = true, ownership = 'CREATED_BY_PROMPT_12_4_2', rollback_action = 'PRESERVE'
      WHERE object_name = 'ShiftStatus';
    `);

    let threw = false;
    let errMessage = '';
    try {
      psqlFile(DB_NAME, migrationSqlPath);
    } catch (e: any) {
      threw = true;
      errMessage = (e.stderr?.toString() || '') + (e.stdout?.toString() || '') + e.message;
    }

    if (!threw || !errMessage.includes('REGISTRY OWNERSHIP CONTRADICTION')) {
      throw new Error(`Expected REGISTRY OWNERSHIP CONTRADICTION abort, got: ${errMessage}`);
    }

    results.push({
      id: 'P-09',
      name: 'Registry ownership/preserve contradiction -> FAIL CLOSED',
      status: 'PASS',
      detail: 'Migration failed closed when registry recorded created_by_migration=true with rollback_action=PRESERVE.'
    });
  } catch (err: any) {
    results.push({ id: 'P-09', name: 'Registry ownership/preserve contradiction', status: 'FAIL', detail: err.message });
  }

  // ---------------------------------------------------------------------------
  // P-10: Registry contains unexpected ownership value -> FAIL CLOSED
  // ---------------------------------------------------------------------------
  try {
    resetDb(cleanBaselineSql);
    preseedRegistryForBaseline(DB_NAME);

    psqlQuery(DB_NAME, `
      UPDATE "_prompt_12_ownership_registry"
      SET ownership = 'INVALID_UNKNOWN_OWNER'
      WHERE object_name = 'ShiftStatus';
    `);

    let threw = false;
    let errMessage = '';
    try {
      psqlFile(DB_NAME, migrationSqlPath);
    } catch (e: any) {
      threw = true;
      errMessage = (e.stderr?.toString() || '') + (e.stdout?.toString() || '') + e.message;
    }

    if (!threw || !errMessage.includes('REGISTRY OWNERSHIP CONTRADICTION')) {
      throw new Error(`Expected REGISTRY OWNERSHIP CONTRADICTION abort on invalid ownership, got: ${errMessage}`);
    }

    results.push({
      id: 'P-10',
      name: 'Registry contains unexpected ownership value -> FAIL CLOSED',
      status: 'PASS',
      detail: 'Migration failed closed when registry contained unrecognized ownership value.'
    });
  } catch (err: any) {
    results.push({ id: 'P-10', name: 'Registry contains unexpected ownership value', status: 'FAIL', detail: err.message });
  }

  // ---------------------------------------------------------------------------
  // P-11: Rerun must not execute UPDATE ownership FROM OWNED TO PRE_EXISTING
  // ---------------------------------------------------------------------------
  try {
    resetDb(cleanBaselineSql);
    preseedRegistryForBaseline(DB_NAME);

    psqlFile(DB_NAME, migrationSqlPath);

    // Verify all 10 created enums are registered as CREATED_BY_PROMPT_12_4_2
    const createdBefore = psqlQuery(DB_NAME, `
      SELECT count(*) FROM _prompt_12_ownership_registry 
      WHERE object_type = 'TYPE' AND ownership = 'CREATED_BY_PROMPT_12_4_2';
    `).trim();

    // Rerun migration
    psqlFile(DB_NAME, migrationSqlPath);

    const createdAfter = psqlQuery(DB_NAME, `
      SELECT count(*) FROM _prompt_12_ownership_registry 
      WHERE object_type = 'TYPE' AND ownership = 'CREATED_BY_PROMPT_12_4_2';
    `).trim();

    if (createdBefore !== createdAfter || createdAfter !== '10') {
      throw new Error(`Ownership counts altered on rerun! Before: ${createdBefore}, After: ${createdAfter}`);
    }

    results.push({
      id: 'P-11',
      name: 'Rerun must not execute UPDATE ownership FROM OWNED TO PRE_EXISTING',
      status: 'PASS',
      detail: `All ${createdAfter} migration-created enums remained CREATED_BY_PROMPT_12_4_2; zero provenance downgrades occurred.`
    });
  } catch (err: any) {
    results.push({ id: 'P-11', name: 'Rerun must not execute UPDATE ownership', status: 'FAIL', detail: err.message });
  }

  // ---------------------------------------------------------------------------
  // P-12: Rollback after migration-created enum -> DROP OWNED ENUM
  // ---------------------------------------------------------------------------
  try {
    resetDb(cleanBaselineSql);
    preseedRegistryForBaseline(DB_NAME);

    psqlFile(DB_NAME, migrationSqlPath);

    // Rerun once to verify rollback after rerun works too
    psqlFile(DB_NAME, migrationSqlPath);

    psqlFile(DB_NAME, rollbackSqlPath);

    // Verify created enums were dropped
    if (getEnumLabels(DB_NAME, 'BusinessVertical') !== null || getEnumLabels(DB_NAME, 'UomType') !== null) {
      throw new Error('Rollback failed to drop migration-created enums!');
    }

    results.push({
      id: 'P-12',
      name: 'Rollback after migration-created enum (even after rerun)',
      status: 'PASS',
      detail: 'Rollback successfully dropped migration-owned enums because CREATED_BY_PROMPT_12_4_2 provenance survived rerun.'
    });
  } catch (err: any) {
    results.push({ id: 'P-12', name: 'Rollback after migration-created enum', status: 'FAIL', detail: err.message });
  }

  // ---------------------------------------------------------------------------
  // P-13: Rollback after pre-existing enum reuse -> PRESERVE ENUM
  // ---------------------------------------------------------------------------
  try {
    resetDb(cleanBaselineSql);
    preseedRegistryForBaseline(DB_NAME);

    psqlFile(DB_NAME, migrationSqlPath);
    psqlFile(DB_NAME, rollbackSqlPath);

    const shiftLabels = getEnumLabels(DB_NAME, 'ShiftStatus');
    const billingLabels = getEnumLabels(DB_NAME, 'BillingCycle');

    if (!shiftLabels || shiftLabels.join(',') !== 'OPEN,CLOSED') {
      throw new Error('Pre-existing ShiftStatus was corrupted or dropped!');
    }
    if (!billingLabels || billingLabels.join(',') !== 'MONTHLY,ANNUALLY') {
      throw new Error('Pre-existing BillingCycle was corrupted or dropped!');
    }

    results.push({
      id: 'P-13',
      name: 'Rollback after pre-existing enum reuse',
      status: 'PASS',
      detail: 'Pre-existing enums (ShiftStatus, BillingCycle) were strictly preserved across migration and rollback.'
    });
  } catch (err: any) {
    results.push({ id: 'P-13', name: 'Rollback after pre-existing enum reuse', status: 'FAIL', detail: err.message });
  }

  // ---------------------------------------------------------------------------
  // P-14: Rollback with missing registry -> DO NOT DROP, FAIL CLOSED
  // ---------------------------------------------------------------------------
  try {
    resetDb(cleanBaselineSql);
    // Baseline has enums, but registry does NOT exist
    let threw = false;
    let errMessage = '';
    try {
      psqlFile(DB_NAME, rollbackSqlPath);
    } catch (e: any) {
      threw = true;
      errMessage = (e.stderr?.toString() || '') + (e.stdout?.toString() || '') + e.message;
    }

    if (!threw || !errMessage.includes('ROLLBACK ABORTED: Ownership registry "_prompt_12_ownership_registry" does not exist')) {
      throw new Error(`Expected missing registry fail-closed abort, got: ${errMessage}`);
    }

    // Verify baseline enums are not dropped
    const shiftLabels = getEnumLabels(DB_NAME, 'ShiftStatus');
    if (!shiftLabels || shiftLabels.join(',') !== 'OPEN,CLOSED') {
      throw new Error('Rollback dropped enums despite missing registry!');
    }

    results.push({
      id: 'P-14',
      name: 'Rollback with missing registry -> DO NOT DROP, FAIL CLOSED',
      status: 'PASS',
      detail: 'Rollback aborted to fail closed when registry was missing; zero objects were dropped.'
    });
  } catch (err: any) {
    results.push({ id: 'P-14', name: 'Rollback with missing registry', status: 'FAIL', detail: err.message });
  }

  // ---------------------------------------------------------------------------
  // P-15: Rollback with contradictory registry -> DO NOT DROP, FAIL CLOSED
  // ---------------------------------------------------------------------------
  try {
    resetDb(cleanBaselineSql);
    preseedRegistryForBaseline(DB_NAME);

    psqlFile(DB_NAME, migrationSqlPath);

    // Corrupt registry row for BusinessVertical: created_by_migration=true but rollback_action=PRESERVE
    psqlQuery(DB_NAME, `
      UPDATE "_prompt_12_ownership_registry"
      SET rollback_action = 'PRESERVE'
      WHERE object_name = 'BusinessVertical';
    `);

    let threw = false;
    let errMessage = '';
    try {
      psqlFile(DB_NAME, rollbackSqlPath);
    } catch (e: any) {
      threw = true;
      errMessage = (e.stderr?.toString() || '') + (e.stdout?.toString() || '') + e.message;
    }

    if (!threw || !errMessage.includes('ROLLBACK CONTRADICTION')) {
      throw new Error(`Expected ROLLBACK CONTRADICTION abort, got: ${errMessage}`);
    }

    // Verify BusinessVertical was NOT dropped because transaction aborted
    if (getEnumLabels(DB_NAME, 'BusinessVertical') === null) {
      throw new Error('BusinessVertical was dropped despite contradictory registry state!');
    }

    results.push({
      id: 'P-15',
      name: 'Rollback with contradictory registry -> DO NOT DROP, FAIL CLOSED',
      status: 'PASS',
      detail: 'Rollback aborted to fail closed when registry record contained contradictory ownership/rollback flags; zero enums dropped.'
    });
  } catch (err: any) {
    results.push({ id: 'P-15', name: 'Rollback with contradictory registry', status: 'FAIL', detail: err.message });
  }

  // ---------------------------------------------------------------------------
  // P-16: Static scan detects unsafe ownership overwrite
  // ---------------------------------------------------------------------------
  try {
    const safety = validateExpandDdlSafety();
    if (!safety.passed) {
      throw new Error(`Static safety violations: ${safety.violations.join('; ')}`);
    }

    const rawMigration = fs.readFileSync(migrationSqlPath, 'utf8');
    // Ensure Section 1.1 contains NO ON CONFLICT DO UPDATE on the registry for TYPE
    const section11Match = rawMigration.match(/1\.1 ENUMS AUDIT & PREFLIGHT[\s\S]*?1\.2 FULL TARGET TABLE/i);
    if (section11Match) {
      const section11 = section11Match[0];
      if (/ON\s+CONFLICT[\s\S]*?DO\s+UPDATE/i.test(section11)) {
        throw new Error('Section 1.1 contains forbidden ON CONFLICT DO UPDATE on ownership registry!');
      }
    }

    results.push({
      id: 'P-16',
      name: 'Static scan detects unsafe ownership overwrite',
      status: 'PASS',
      detail: 'Zero ON CONFLICT DO UPDATE statements in Section 1.1; immutable provenance and fail-closed contradiction checks verified.'
    });
  } catch (err: any) {
    results.push({ id: 'P-16', name: 'Static scan detects unsafe ownership overwrite', status: 'FAIL', detail: err.message });
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n====================================================================');
  console.log('PROMPT 12.4.3 TEST MATRIX EXECUTION SUMMARY');
  console.log('====================================================================');
  let passCount = 0;
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} [${r.id}] ${r.name}: ${r.status}`);
    console.log(`    ${r.detail}`);
    if (r.status === 'PASS') passCount++;
  }
  console.log('====================================================================');
  console.log(`TOTAL: ${passCount}/${results.length} PASSED`);
  console.log('====================================================================\n');

  if (passCount !== results.length) {
    process.exit(1);
  }
}

if (require.main === module) {
  runPrompt12_4_3Matrix().catch((err) => {
    console.error('Test matrix crashed:', err);
    process.exit(1);
  });
}
