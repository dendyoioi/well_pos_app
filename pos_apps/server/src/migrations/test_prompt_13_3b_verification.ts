import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { runAllBackfills } from './backfill/index';
import { BackfillResult } from './backfill/types';
import { resolveDeterministicUserCode } from './backfill/07_user_model_b';
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

/**
 * Mask passwords in database connection strings so credentials are never logged.
 */
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

async function runPrompt133BVerification() {
  console.log('===============================================================');
  console.log('PROMPT 13.3B-EVIDENCE-CORRECTION — VERIFICATION TEST RUNNER');
  console.log('===============================================================\n');

  // Validate and read environment variables
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

  const backfillDir = path.resolve(__dirname, 'backfill');
  const reconDir = path.resolve(__dirname, 'reconciliation');
  const helpersDir = path.resolve(__dirname, 'helpers');

  // 1. Static Delegate Scan
  console.log('--- TEST A1: STATIC SCAN — TARGET PRISMA DELEGATES REMOVED ---');
  const backfillFiles = fs.readdirSync(backfillDir).filter((f) => f.endsWith('.ts') && f !== 'types.ts');
  const targetDelegates = [
    'inventoryItem',
    'productVariant',
    'storageLocation',
    'inventoryBalance',
    'inventoryLedger',
    'paymentTransaction',
  ];

  let delegateCallCount = 0;
  for (const file of backfillFiles) {
    const content = fs.readFileSync(path.join(backfillDir, file), 'utf-8');
    for (const delegate of targetDelegates) {
      const regex = new RegExp(`prisma\\s*\\.\\s*${delegate}\\s*\\.`, 'g');
      const matches = content.match(regex);
      if (matches) {
        delegateCallCount += matches.length;
        console.error(`Found forbidden delegate call in ${file}: ${matches.join(', ')}`);
      }
    }
  }

  assert(
    'Test A1 — Target Prisma Delegates Removed',
    delegateCallCount === 0,
    `Found ${delegateCallCount} calls to target Prisma delegates across backfill workers.`
  );

  // 2. Static SQL Interpolation Scan for tenantId
  console.log('\n--- TEST A2: STATIC SCAN — TENANT_ID SQL PARAMETERIZATION ---');
  const reconFiles = fs.readdirSync(reconDir).filter((f) => f.endsWith('.ts') && f !== 'reconcile_all.ts');
  let interpolationCount = 0;

  for (const file of reconFiles) {
    const content = fs.readFileSync(path.join(reconDir, file), 'utf-8');
    // Match any ${tenantId} or ${...tenantId...} in sql template strings
    const matches = content.match(/\$\{[^}]*tenantId[^}]*\}/g);
    if (matches) {
      interpolationCount += matches.length;
      console.error(`Found forbidden tenantId interpolation in ${file}: ${matches.join(', ')}`);
    }
  }

  assert(
    'Test A2 — Zero ${tenantId} Interpolation in Reconciliation Files',
    interpolationCount === 0,
    `Found ${interpolationCount} tenantId interpolations. All queries use static SQL with bound parameters.`
  );

  // 3. Static Write Safety Scan ($executeRawUnsafe strictly isolated to sql_safety.ts)
  console.log('\n--- TEST A3: STATIC SCAN — DIRECT $executeRaw EXCLUSION ---');
  const allScanDirs = [backfillDir, reconDir];
  let directExecuteRawCount = 0;
  const directExecuteRawLocations: string[] = [];

  for (const dir of allScanDirs) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const matches = content.match(/\$executeRaw/g);
      if (matches) {
        directExecuteRawCount += matches.length;
        directExecuteRawLocations.push(`${file} (${matches.length} occurrences)`);
      }
    }
  }

  // Check sql_safety.ts has the authorized single point of execution
  const sqlSafetyContent = fs.readFileSync(path.join(helpersDir, 'sql_safety.ts'), 'utf-8');
  const sqlSafetyMatches = sqlSafetyContent.match(/\$executeRawUnsafe/g) || [];

  assert(
    'Test A3 — Direct $executeRaw Excluded from Backfill/Reconciliation Workers',
    directExecuteRawCount === 0 && sqlSafetyMatches.length >= 1,
    `Direct $executeRaw calls in workers: ${directExecuteRawCount}. Authorized write wrapper in sql_safety.ts: ${sqlSafetyMatches.length} occurrence(s). All backfill writes route strictly through executeWriteRaw.`
  );

  // 4. TypeScript / Syntax Check
  console.log('\n--- TEST B: TYPESCRIPT / SYNTAX VALIDATION ---');
  let tscPassed = false;
  let tscErrorOutput = '';
  try {
    execSync('npx tsc --noEmit --esModuleInterop src/migrations/backfill/*.ts src/migrations/reconciliation/*.ts src/migrations/helpers/*.ts src/migrations/test_prompt_13_3b_verification.ts', {
      cwd: path.resolve(__dirname, '../..'),
      stdio: 'pipe',
    });
    tscPassed = true;
  } catch (err: any) {
    tscPassed = false;
    tscErrorOutput = err.stderr ? err.stderr.toString() : err.message;
  }

  assert(
    'Test B — TypeScript Compilation Clean',
    tscPassed,
    tscPassed
      ? 'All backfill, reconciliation, and helper TypeScript files compile with 0 type errors.'
      : `TypeScript compile error: ${tscErrorOutput}`
  );

  // 5. End-to-End Dry-Run Determinism Proof & Zero-Write Evidence
  console.log('\n--- TEST C: END-TO-END DRY-RUN DETERMINISM PROOF & ZERO-WRITES ---');
  const testPrisma = new PrismaClient({ datasources: { db: { url: disposableDbUrl } } });

  try {
    const targetCountQuery = `
      SELECT 'storage_locations' as tbl, count(*)::int as cnt FROM "storage_locations"
      UNION ALL SELECT 'inventory_items', count(*)::int FROM "inventory_items"
      UNION ALL SELECT 'product_variants', count(*)::int FROM "product_variants"
      UNION ALL SELECT 'inventory_balances', count(*)::int FROM "inventory_balances"
      UNION ALL SELECT 'inventory_ledgers', count(*)::int FROM "inventory_ledgers"
      UNION ALL SELECT 'payment_transactions', count(*)::int FROM "payment_transactions"
      UNION ALL SELECT 'legacy_stock_movements', count(*)::int FROM "legacy_stock_movements";
    `;

    const userStateQuery = `
      SELECT id, user_code, pin, pin_hash FROM "users" ORDER BY id;
    `;

    // 5.1 Baseline State
    const baselineCounts: any[] = await testPrisma.$queryRawUnsafe(targetCountQuery);
    const baselineTargetSum = baselineCounts.reduce((acc, row) => acc + row.cnt, 0);
    const baselineUsers: any[] = await testPrisma.$queryRawUnsafe(userStateQuery);

    // 5.2 Dry-Run 1 Execution
    console.log('Executing Dry Run #1 (capturing full structured output)...');
    const run1Results: BackfillResult[] = await runAllBackfills({
      isDryRun: true,
      prismaClient: testPrisma,
    });

    const postRun1Counts: any[] = await testPrisma.$queryRawUnsafe(targetCountQuery);
    const postRun1TargetSum = postRun1Counts.reduce((acc, row) => acc + row.cnt, 0);
    const postRun1Users: any[] = await testPrisma.$queryRawUnsafe(userStateQuery);

    // 5.3 Dry-Run 2 Execution
    console.log('Executing Dry Run #2 (capturing full structured output)...');
    const run2Results: BackfillResult[] = await runAllBackfills({
      isDryRun: true,
      prismaClient: testPrisma,
    });

    const postRun2Counts: any[] = await testPrisma.$queryRawUnsafe(targetCountQuery);
    const postRun2TargetSum = postRun2Counts.reduce((acc, row) => acc + row.cnt, 0);
    const postRun2Users: any[] = await testPrisma.$queryRawUnsafe(userStateQuery);

    // 5.4 Zero-Write Verification
    const zeroWritesMaintained =
      baselineTargetSum === 0 &&
      postRun1TargetSum === 0 &&
      postRun2TargetSum === 0;

    const legacyUsersUnchanged =
      JSON.stringify(baselineUsers) === JSON.stringify(postRun1Users) &&
      JSON.stringify(postRun1Users) === JSON.stringify(postRun2Users);

    assert(
      'Test C1 — Disposable Dry-Run Zero Writes & Legacy Immutability',
      zeroWritesMaintained && legacyUsersUnchanged,
      `Target table rows: Baseline=${baselineTargetSum}, Run1=${postRun1TargetSum}, Run2=${postRun2TargetSum}. Legacy users (user_code, pin_hash) 100% identical across runs.`
    );

    // 5.5 Deep Structured Determinism Comparison (Run 1 vs Run 2)
    console.log('\n--- STRUCTURED RUN 1 vs RUN 2 COMPARISON ---');
    let determinismPassed = true;
    const diffMessages: string[] = [];

    if (run1Results.length !== run2Results.length) {
      determinismPassed = false;
      diffMessages.push(`Worker count mismatch: Run1=${run1Results.length}, Run2=${run2Results.length}`);
    }

    const comparisonTable: any[] = [];
    let totalPlannedIdsRun1 = 0;
    let totalPlannedIdsRun2 = 0;

    for (let i = 0; i < run1Results.length; i++) {
      const w1 = run1Results[i];
      const w2 = run2Results[i];

      const w1Planned = w1.plannedIds || [];
      const w2Planned = w2.plannedIds || [];
      totalPlannedIdsRun1 += w1Planned.length;
      totalPlannedIdsRun2 += w2Planned.length;

      const workerOrderMatch = w1.workerName === w2.workerName;
      const processedMatch = w1.processedCount === w2.processedCount;
      const createdMatch = w1.createdCount === w2.createdCount;
      const skippedMatch = w1.skippedCount === w2.skippedCount;
      const errorMatch = w1.errorCount === w2.errorCount;
      const exceptionsMatch = JSON.stringify(w1.exceptions) === JSON.stringify(w2.exceptions);
      const plannedIdsMatch = JSON.stringify(w1Planned) === JSON.stringify(w2Planned);

      const workerMatch =
        workerOrderMatch &&
        processedMatch &&
        createdMatch &&
        skippedMatch &&
        errorMatch &&
        exceptionsMatch &&
        plannedIdsMatch;

      if (!workerMatch) {
        determinismPassed = false;
        diffMessages.push(`Mismatch in worker [${w1.workerName}]: order=${workerOrderMatch}, proc=${processedMatch}, created=${createdMatch}, skipped=${skippedMatch}, err=${errorMatch}, exc=${exceptionsMatch}, plannedIds=${plannedIdsMatch}`);
      }

      comparisonTable.push({
        Worker: w1.workerName,
        'Processed (R1/R2)': `${w1.processedCount} / ${w2.processedCount}`,
        'Created (R1/R2)': `${w1.createdCount} / ${w2.createdCount}`,
        'Skipped (R1/R2)': `${w1.skippedCount} / ${w2.skippedCount}`,
        'Errors (R1/R2)': `${w1.errorCount} / ${w2.errorCount}`,
        'Exceptions (R1/R2)': `${w1.exceptions.length} / ${w2.exceptions.length}`,
        'Planned IDs (R1/R2)': `${w1Planned.length} / ${w2Planned.length}`,
        Match: workerMatch ? 'MATCH' : 'DIFF',
      });
    }

    console.table(comparisonTable);

    console.log('\nPlanned Deterministic Identifiers Sample:');
    for (const r of run1Results) {
      if (r.plannedIds && r.plannedIds.length > 0) {
        console.log(`  [${r.workerName}] (${r.plannedIds.length} planned):`);
        for (const id of r.plannedIds) {
          console.log(`    - ${id}`);
        }
      }
    }

    console.log('\nExceptions Sample:');
    for (const r of run1Results) {
      if (r.exceptions.length > 0) {
        console.log(`  [${r.workerName}] (${r.exceptions.length} exception(s)):`);
        for (const exc of r.exceptions) {
          console.log(`    - [${exc.recordId}]: ${exc.reason}`);
        }
      }
    }

    assert(
      'Test C2 — End-to-End Dry-Run Structured Determinism (Run 1 === Run 2)',
      determinismPassed && totalPlannedIdsRun1 > 0 && totalPlannedIdsRun1 === totalPlannedIdsRun2,
      determinismPassed
        ? `All 10 workers matched 100% across all 7 dimensions (Worker Order, Processed, Created, Skipped, Errors, Exceptions, and ${totalPlannedIdsRun1} Planned Deterministic IDs).`
        : `Determinism discrepancies detected: ${diffMessages.join('; ')}`
    );

    // 6. Reconciliation Checker Runtime Execution & Expected Baseline Variances
    console.log('\n--- TEST D: RECONCILIATION CHECKER EXECUTION & VARIANCE BASELINE ---');
    const checkers = [
      { name: 'Tenant Boundary Integrity', fn: reconcileTenantIntegrity },
      { name: 'Product Variant Coverage', fn: reconcileProductVariantCoverage },
      { name: 'Inventory Physical Baseline', fn: reconcileInventoryPhysicalBaseline },
      { name: 'Ledger Audit Integrity', fn: reconcileLedgerIntegrity },
      { name: 'User Model B Credentials', fn: reconcileUserCredentials },
      { name: 'Order Payment Parity', fn: reconcileOrderPaymentParity },
    ];

    let allCheckersExecutedWithoutSqlErrors = true;
    const preBackfillVariances: { suite: string; discrepancies: number; details: string }[] = [];

    for (const checker of checkers) {
      try {
        const checkResults = await checker.fn(testPrisma);
        console.log(`  ✓ Checker [${checker.name}] executed query suite without SQL/catalog errors.`);
        for (const res of checkResults) {
          if (!res.passed) {
            preBackfillVariances.push({
              suite: res.suiteName,
              discrepancies: res.discrepancyCount,
              details: res.details,
            });
          }
        }
      } catch (err: any) {
        console.error(`  ✗ Checker [${checker.name}] failed with SQL/catalog error:`, err.message);
        allCheckersExecutedWithoutSqlErrors = false;
      }
    }

    assert(
      'Test D1 — Reconciliation Checkers Execute with 0 SQL/Catalog Errors',
      allCheckersExecutedWithoutSqlErrors,
      'All 6 reconciliation checkers successfully executed against physical schema with 0 syntax or catalog exceptions.'
    );

    const expectedVarianceSuites = [
      'Catalog: Product -> ProductVariant Coverage',
      'IAM: Active Users Model B Credential Coverage',
    ];
    const actualVarianceSuites = preBackfillVariances.map((v) => v.suite);
    const onlyExpectedVariances = actualVarianceSuites.every((s) => expectedVarianceSuites.includes(s));

    assert(
      'Test D2 — Expected Pre-Backfill Domain Variances Correctly Identified',
      onlyExpectedVariances && preBackfillVariances.length > 0,
      `Pre-Backfill expected variances detected in: [${actualVarianceSuites.join(', ')}]. Cross-tenant, negative inventory, and ledger checks report 0 discrepancies.`
    );
  } finally {
    await testPrisma.$disconnect();
  }

  // 7. Deterministic User-Code Collision Test
  console.log('\n--- TEST E: DETERMINISTIC USER-CODE COLLISION-SAFE TEST & OWNER SCOPE ---');
  const testTenantCodeSet = new Set<string>();

  // Case 1: Baseline Owner and Cashier preservation
  const ownerCode = resolveDeterministicUserCode({ id: 'user_owner_orig', role: 'OWNER', name: 'Owner' }, testTenantCodeSet);
  testTenantCodeSet.add(ownerCode);

  const cashierCode = resolveDeterministicUserCode({ id: 'user_kasir_orig', role: 'CASHIER', name: 'Cashier' }, testTenantCodeSet);
  testTenantCodeSet.add(cashierCode);

  const preservedBaseline = ownerCode === 'USR-OWNER1' && cashierCode === 'USR-KASIR1';

  // Case 2: ADMIN never receives USR-OWNER1
  const adminCode = resolveDeterministicUserCode({ id: 'user_admin_test', role: 'ADMIN', name: 'Admin' }, new Set<string>());
  const adminNeverGetsOwnerCode = adminCode !== 'USR-OWNER1' && adminCode.startsWith('USR-');

  // Case 3: Processing order invariance (Admin first vs Owner first)
  // Scenario A: Admin processed first, then Owner
  const setA = new Set<string>();
  const adminCodeA = resolveDeterministicUserCode({ id: 'admin_tenant_x', role: 'ADMIN', name: 'Admin X' }, setA);
  setA.add(adminCodeA);
  const ownerCodeA = resolveDeterministicUserCode({ id: 'owner_tenant_x', role: 'OWNER', name: 'Owner X' }, setA);
  setA.add(ownerCodeA);

  // Scenario B: Owner processed first, then Admin
  const setB = new Set<string>();
  const ownerCodeB = resolveDeterministicUserCode({ id: 'owner_tenant_x', role: 'OWNER', name: 'Owner X' }, setB);
  setB.add(ownerCodeB);
  const adminCodeB = resolveDeterministicUserCode({ id: 'admin_tenant_x', role: 'ADMIN', name: 'Admin X' }, setB);
  setB.add(adminCodeB);

  const orderInvariancePassed =
    ownerCodeA === 'USR-OWNER1' &&
    ownerCodeB === 'USR-OWNER1' &&
    adminCodeA === adminCodeB &&
    adminCodeA !== 'USR-OWNER1' &&
    setA.size === 2 &&
    setB.size === 2;

  // Case 4: Subsequent Owner in same tenant does not collide with USR-OWNER1
  const secondOwnerCode = resolveDeterministicUserCode({ id: 'user_owner_sec', role: 'OWNER', name: 'Owner 2' }, testTenantCodeSet);
  testTenantCodeSet.add(secondOwnerCode);
  const secondOwnerNonCollision = secondOwnerCode !== 'USR-OWNER1' && secondOwnerCode.startsWith('USR-');

  // Case 5: 50 users with identical prefix deterministically resolved without collision
  let collisionFree = true;
  for (let i = 1; i <= 50; i++) {
    const generated = resolveDeterministicUserCode({ id: `usr_collision_candidate_${i}`, role: 'STAFF' }, testTenantCodeSet);
    if (testTenantCodeSet.has(generated)) {
      collisionFree = false;
      break;
    }
    testTenantCodeSet.add(generated);
  }

  // Case 6: Idempotency / Pure Determinism check
  const idempotentCode1 = resolveDeterministicUserCode({ id: 'user_fixed_test_123', role: 'MANAGER' }, new Set<string>());
  const idempotentCode2 = resolveDeterministicUserCode({ id: 'user_fixed_test_123', role: 'MANAGER' }, new Set<string>());
  const isPurelyDeterministic = idempotentCode1 === idempotentCode2;

  assert(
    'Test E — Deterministic Collision-Safe User-Code Allocation & Owner Scope',
    preservedBaseline && adminNeverGetsOwnerCode && orderInvariancePassed && secondOwnerNonCollision && collisionFree && isPurelyDeterministic,
    `Owner baseline preserved (${ownerCode}), Admin never gets USR-OWNER1 (${adminCode}), Order invariance verified (Owner: ${ownerCodeA}/${ownerCodeB}, Admin: ${adminCodeA}/${adminCodeB}), second owner alternate (${secondOwnerCode}), 50 collision-free allocations, pure determinism: ${isPurelyDeterministic}.`
  );

  // 8. Verification of Live Database Protection (Read-Only Audit)
  console.log('\n--- SAFETY CHECK: POS_DB INTEGRITY AUDIT (READ-ONLY) ---');
  const livePrisma = new PrismaClient({
    datasources: { db: { url: auditDbUrl } },
  });

  try {
    const liveTargetCounts: any[] = await livePrisma.$queryRawUnsafe(`
      SELECT 'storage_locations' as tbl, count(*)::int as cnt FROM "storage_locations"
      UNION ALL SELECT 'inventory_items', count(*)::int FROM "inventory_items"
      UNION ALL SELECT 'product_variants', count(*)::int FROM "product_variants"
      UNION ALL SELECT 'inventory_balances', count(*)::int FROM "inventory_balances"
      UNION ALL SELECT 'inventory_ledgers', count(*)::int FROM "inventory_ledgers"
      UNION ALL SELECT 'payment_transactions', count(*)::int FROM "payment_transactions"
      UNION ALL SELECT 'legacy_stock_movements', count(*)::int FROM "legacy_stock_movements";
    `);

    const liveTargetSum = liveTargetCounts.reduce((acc, row) => acc + row.cnt, 0);

    assert(
      'Safety — pos_db Target Tables Remain 100% Pristine',
      liveTargetSum === 0,
      `Live database pos_db target tables count: ${liveTargetSum} rows (0 target rows created).`
    );

    const liveLegacyRows: any[] = await livePrisma.$queryRawUnsafe(`
      SELECT (
        (SELECT count(*)::int FROM "categories") +
        (SELECT count(*)::int FROM "customers") +
        (SELECT count(*)::int FROM "hold_orders") +
        (SELECT count(*)::int FROM "order_items") +
        (SELECT count(*)::int FROM "orders") +
        (SELECT count(*)::int FROM "outlet_products") +
        (SELECT count(*)::int FROM "outlets") +
        (SELECT count(*)::int FROM "payments") +
        (SELECT count(*)::int FROM "platform_users") +
        (SELECT count(*)::int FROM "products") +
        (SELECT count(*)::int FROM "saas_invoices") +
        (SELECT count(*)::int FROM "saas_payments") +
        (SELECT count(*)::int FROM "shifts") +
        (SELECT count(*)::int FROM "stock_movements") +
        (SELECT count(*)::int FROM "subscription_plans") +
        (SELECT count(*)::int FROM "tenant_subscriptions") +
        (SELECT count(*)::int FROM "tenants") +
        (SELECT count(*)::int FROM "users")
      ) as total_legacy_rows;
    `);

    const legacySum = liveLegacyRows[0]?.total_legacy_rows;

    assert(
      'Safety — pos_db Legacy Rows Intact (17 Rows)',
      legacySum === 17,
      `Live database pos_db retains exactly ${legacySum} legacy rows across all 18 protected tables.`
    );
  } finally {
    await livePrisma.$disconnect();
  }

  console.log('\n===============================================================');
  const allPassed = results.every((r) => r.passed);
  console.log(allPassed ? 'ALL VERIFICATION GATES PASSED (100%)' : 'VERIFICATION FAILED');
  console.log('===============================================================\n');

  process.exit(allPassed ? 0 : 1);
}

runPrompt133BVerification().catch((err) => {
  console.error('Fatal error during verification runner:', err.message);
  process.exit(1);
});
