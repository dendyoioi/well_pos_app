import * as dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { runAllBackfills } from './backfill/index';
import { BackfillResult } from './backfill/types';
import { reconcileTenantIntegrity } from './reconciliation/reconcile_tenant_integrity';
import { reconcileProductVariantCoverage } from './reconciliation/reconcile_product_variant_coverage';
import { reconcileInventoryPhysicalBaseline } from './reconciliation/reconcile_inventory_physical_baseline';
import { reconcileLedgerIntegrity } from './reconciliation/reconcile_ledger_integrity';
import { reconcileUserCredentials } from './reconciliation/reconcile_user_credentials';
import { reconcileOrderPaymentParity } from './reconciliation/reconcile_order_payment_parity';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(name: string, condition: boolean, details: string) {
  results.push({ name, passed: condition, details });
  if (!condition) {
    console.error(`❌ [FAIL] ${name}: ${details}`);
  } else {
    console.log(`✅ [PASS] ${name}: ${details}`);
  }
}

function maskDbUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    if (url.password) {
      url.password = '****';
    }
    return url.toString();
  } catch {
    return rawUrl.replace(/:([^:@/]+)@/, ':****@');
  }
}

export async function runPrompt133CFailureInjectionTest() {
  console.log('===============================================================');
  console.log('PROMPT 13.3C-CORRECTION — FAILURE-INJECTION & ACID TRANSACTION TEST');
  console.log('===============================================================\n');

  // -------------------------------------------------------------
  // TEST 0: STATIC SECURITY REDACTION SCAN
  // -------------------------------------------------------------
  console.log('--- TEST 0: STATIC SECURITY REDACTION SCAN (NO PLAINTEXT PIN EXPOSURE) ---');
  const filesToScan: string[] = [
    path.resolve(__dirname, '../../docs/validation/18_PROMPT_13_3C_DRY_RUN_VALIDATION_AND_OWNER_AUTHORIZATION_PACKAGE.md'),
    path.resolve(__dirname, 'test_prompt_13_3c_failure_injection.ts'),
    path.resolve(__dirname, 'test_prompt_13_3b_verification.ts'),
  ];

  // Also include all backfill and reconciliation files
  const backfillDir = path.resolve(__dirname, 'backfill');
  for (const f of fs.readdirSync(backfillDir)) {
    if (f.endsWith('.ts')) filesToScan.push(path.join(backfillDir, f));
  }
  const reconDir = path.resolve(__dirname, 'reconciliation');
  for (const f of fs.readdirSync(reconDir)) {
    if (f.endsWith('.ts')) filesToScan.push(path.join(reconDir, f));
  }

  // Construct search pattern dynamically to avoid static self-match
  const targetSecretLiteral = ['1', '1', '1', '1', '1', '1'].join('');
  const forbiddenPatterns = [
    new RegExp(`['"\`]${targetSecretLiteral}['"\`]`),
    /pin\s*=\s*\$\{/i,
    /pin\s*:\s*\$\{/i,
    /pin=['"`]\$\{/i,
    /console\.log\(.*\.pin[,\s\)]/i,
    /logger\..*\(.*\.pin[,\s\)]/i,
  ];

  let scanViolations = 0;
  for (const filePath of filesToScan) {
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      // Exclude definition of targetSecretLiteral in self scanner
      if (filePath.endsWith('test_prompt_13_3c_failure_injection.ts') && line.includes('targetSecretLiteral')) {
        return;
      }
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(line)) {
          scanViolations++;
          console.error(`❌ Security Violation in ${path.basename(filePath)}:${idx + 1}: ${line.trim()}`);
        }
      }
    });
  }

  assert(
    'Security Scan: Zero Plaintext PINs or Direct PIN Logging in New Artifacts',
    scanViolations === 0,
    scanViolations === 0
      ? `0 violations detected across ${filesToScan.length} artifacts.`
      : `${scanViolations} security violations detected!`
  );

  const disposableDbUrl = process.env.DISPOSABLE_DATABASE_URL;
  if (!disposableDbUrl) {
    console.error('CRITICAL: DISPOSABLE_DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  // Safety guard: validate that disposableDbUrl does NOT target pos_db
  try {
    const parsed = new URL(disposableDbUrl);
    if (parsed.pathname.includes('pos_db') || disposableDbUrl.includes('/pos_db')) {
      console.error(`FATAL SECURITY GUARD: DISPOSABLE_DATABASE_URL points to pos_db! Aborting immediately.`);
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Invalid DISPOSABLE_DATABASE_URL format:', err.message);
    process.exit(1);
  }

  const auditDbUrl = process.env.READONLY_AUDIT_DATABASE_URL || process.env.DATABASE_URL;
  if (!auditDbUrl) {
    console.error('CRITICAL: READONLY_AUDIT_DATABASE_URL or DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  console.log(`Disposable Target Database : ${maskDbUrl(disposableDbUrl)}`);
  console.log(`Read-Only Live Audit Database: ${maskDbUrl(auditDbUrl)}\n`);

  const disposablePrisma = new PrismaClient({
    datasources: { db: { url: disposableDbUrl } },
  });

  const auditPrisma = new PrismaClient({
    datasources: { db: { url: auditDbUrl } },
  });

  try {
    // -------------------------------------------------------------
    // TEST 1: Baseline Disposable DB is Clean
    // -------------------------------------------------------------
    console.log('--- TEST 1: BASELINE DISPOSABLE DB STATE CHECK ---');
    const targetTables = [
      'storage_locations',
      'inventory_items',
      'product_variants',
      'inventory_balances',
      'inventory_ledgers',
      'payment_transactions',
      'legacy_stock_movements',
    ];

    for (const table of targetTables) {
      const countRes: any[] = await disposablePrisma.$queryRawUnsafe(
        `SELECT count(*)::int as count FROM "${table}";`
      );
      const count = countRes[0]?.count || 0;
      assert(
        `Baseline Table "${table}" Empty`,
        count === 0,
        `Expected 0 rows in "${table}", found ${count}`
      );
    }

    // -------------------------------------------------------------
    // TEST 2: Intentional Failure Injection in Worker 03 (Live Run)
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: INTENTIONAL FAILURE INJECTION & TRANSACTION ROLLBACK ---');
    console.log('Injecting intentional fatal error into Worker 03 (03_inventory_items)...');
    console.log('Worker 02 (02_storage_locations) will run first and execute INSERTs.');
    console.log('Worker 03 will trigger injected failure.');
    console.log('ACID transaction boundary must fail closed, rollback transaction, and rethrow.');

    let didThrow = false;
    let thrownErrorMsg = '';

    try {
      await runAllBackfills({
        isDryRun: false, // LIVE EXECUTION IN DISPOSABLE DB
        prismaClient: disposablePrisma,
        failureInjectionWorker: '03_inventory_items',
      });
    } catch (err: any) {
      didThrow = true;
      thrownErrorMsg = err.message;
      console.log(`Caught expected live mutation failure: ${err.message}`);
    }

    assert(
      'Orchestrator Fails Closed on Mutation Error',
      didThrow && thrownErrorMsg.includes('FAILURE_INJECTION_TRIGGERED'),
      `Orchestrator threw expected failure-injection error: ${thrownErrorMsg}`
    );

    // -------------------------------------------------------------
    // TEST 3: Verification of Zero Partial Rows (Transaction Rollback)
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: VERIFY ZERO PARTIAL ROWS PERSIST (ATOMIC ROLLBACK) ---');
    for (const table of targetTables) {
      const countRes: any[] = await disposablePrisma.$queryRawUnsafe(
        `SELECT count(*)::int as count FROM "${table}";`
      );
      const count = countRes[0]?.count || 0;
      assert(
        `Post-Rollback Table "${table}" has 0 rows`,
        count === 0,
        `Expected 0 rows in "${table}" after rollback, found ${count}`
      );
    }

    // Verify users were not updated
    const updatedUsers: any[] = await disposablePrisma.$queryRawUnsafe(
      `SELECT count(*)::int as count FROM "users" WHERE user_code IS NOT NULL OR pin_hash IS NOT NULL;`
    );
    const userMutatedCount = updatedUsers[0]?.count || 0;
    assert(
      'Post-Rollback Users Completely Unmutated',
      userMutatedCount === 0,
      `Expected 0 mutated users after rollback, found ${userMutatedCount}`
    );

    // -------------------------------------------------------------
    // TEST 4: OD-13.3-03 Invariant Proof (PIN-less users retain pin_hash = NULL)
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: OD-13.3-03 INVARIANT PROOF ON DISPOSABLE DB ---');
    // Check actual baseline users in disposable DB
    const baselineUsers: any[] = await disposablePrisma.$queryRawUnsafe(
      `SELECT id, tenant_id, name, pin, role FROM "users";`
    );
    console.log(`Found ${baselineUsers.length} baseline users in fixture.`);
    for (const u of baselineUsers) {
      const pinStatus = (u.pin !== null && u.pin !== undefined && u.pin.trim() !== '')
        ? 'LEGACY_PIN_PRESENT'
        : 'LEGACY_PIN_NULL';
      console.log(` - User ${u.id} (${u.name}, role=${u.role}): classification=${pinStatus}`);
    }

    // In disposable DB, temporarily create a test user with pin = NULL to test OD-13.3-03 handling:
    await disposablePrisma.$executeRawUnsafe(
      `INSERT INTO "users" (id, tenant_id, name, email, password_hash, role, pin, is_active, created_at, updated_at)
       VALUES ('test_pinless_user', $1, 'Test PIN-less User', 'pinless@test.pos', 'dummy_hash', 'CASHIER'::"Role", NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO NOTHING;`,
      baselineUsers[0].tenant_id
    );

    // Run backfill live without failure injection for this tenant batch
    await runAllBackfills({
      isDryRun: false,
      prismaClient: disposablePrisma,
      tenantId: baselineUsers[0].tenant_id,
    });

    // Check PIN-less user state
    const pinlessCheck: any[] = await disposablePrisma.$queryRawUnsafe(
      `SELECT id, user_code, pin, pin_hash FROM "users" WHERE id = 'test_pinless_user';`
    );
    const pinless = pinlessCheck[0];
    assert(
      'OD-13.3-03: PIN-less User Allocated Valid user_code',
      pinless?.user_code !== null && pinless?.user_code !== undefined,
      `User code allocated: yes (${pinless?.user_code})`
    );
    assert(
      'OD-13.3-03: PIN-less User Retains pin_hash = NULL',
      pinless?.pin_hash === null,
      'pin_hash remains NULL = yes'
    );

    // Check PIN-holding users
    const pinHoldingUsers: any[] = await disposablePrisma.$queryRawUnsafe(
      `SELECT id, user_code, pin, pin_hash FROM "users" WHERE id <> 'test_pinless_user';`
    );
    let allHashed = true;
    for (const ph of pinHoldingUsers) {
      if (!ph.pin_hash || !ph.pin_hash.startsWith('$2')) {
        allHashed = false;
      }
    }
    assert(
      'Legacy PIN Users Receive Valid Bcrypt Hashes',
      allHashed,
      `All ${pinHoldingUsers.length} legacy PIN users received Bcrypt hashes (hash generated = yes, bcrypt format valid = yes).`
    );

    // Run user credentials reconciliation on disposable DB
    const userRecon = await reconcileUserCredentials(disposablePrisma, baselineUsers[0].tenant_id);
    for (const r of userRecon) {
      assert(
        `Reconciliation: ${r.suiteName}`,
        r.passed,
        r.details
      );
    }

    // -------------------------------------------------------------
    // TEST 5: Pristine Audit of pos_db (Zero Mutations, Read-Only Guard)
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: READ-ONLY AUDIT OF PRODUCTION DATABASE (pos_db) ---');
    for (const table of targetTables) {
      const countRes: any[] = await auditPrisma.$queryRawUnsafe(
        `SELECT count(*)::int as count FROM "${table}";`
      );
      const count = countRes[0]?.count || 0;
      assert(
        `pos_db Table "${table}" Strictly Pristine (0 rows)`,
        count === 0,
        `Expected 0 rows in "${table}" in pos_db, found ${count}`
      );
    }

    const posDbUsers: any[] = await auditPrisma.$queryRawUnsafe(
      `SELECT count(*)::int as count FROM "users" WHERE user_code IS NOT NULL OR pin_hash IS NOT NULL;`
    );
    const posDbUserMutations = posDbUsers[0]?.count || 0;
    assert(
      'pos_db Users Table Strictly Unmutated (0 migrated rows)',
      posDbUserMutations === 0,
      `pos_db user mutations: ${posDbUserMutations}`
    );

    console.log('\n===============================================================');
    const passedCount = results.filter((r) => r.passed).length;
    const failedCount = results.filter((r) => !r.passed).length;
    console.log(`TOTAL TESTS : ${results.length}`);
    console.log(`PASSED      : ${passedCount}`);
    console.log(`FAILED      : ${failedCount}`);
    console.log('===============================================================\n');

    if (failedCount > 0) {
      process.exit(1);
    }
  } finally {
    await disposablePrisma.$disconnect();
    await auditPrisma.$disconnect();
  }
}

if (require.main === module) {
  runPrompt133CFailureInjectionTest().catch((err) => {
    console.error('Fatal unhandled error in test runner:', err);
    process.exit(1);
  });
}
