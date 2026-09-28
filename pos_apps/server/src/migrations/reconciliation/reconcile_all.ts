import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
import { ParityCheckResult } from './reconcile_tenant_integrity';
import { reconcileTenantIntegrity } from './reconcile_tenant_integrity';
import { reconcileProductVariantCoverage } from './reconcile_product_variant_coverage';
import { reconcileInventoryPhysicalBaseline } from './reconcile_inventory_physical_baseline';
import { reconcileLedgerIntegrity } from './reconcile_ledger_integrity';
import { reconcileUserCredentials } from './reconcile_user_credentials';
import { reconcileOrderPaymentParity } from './reconcile_order_payment_parity';

/**
 * Unified Reconciliation Test Runner
 * Executes all dimensional parity suites and emits a formatted gate assessment.
 */
export async function runAllReconciliations(
  tenantId?: string,
  prismaClient?: PrismaClient
): Promise<{
  allPassed: boolean;
  results: ParityCheckResult[];
}> {
  const prisma = prismaClient || new PrismaClient();
  const shouldDisconnect = !prismaClient;
  const allResults: ParityCheckResult[] = [];

  console.log('================================================================');
  console.log('Starting Well POS Dimensional Reconciliation Parity Test Suite');
  if (tenantId) console.log(`Target Tenant Scope: ${tenantId}`);
  console.log('================================================================');

  try {
    // Suite 1: Tenant Boundary
    allResults.push(...(await reconcileTenantIntegrity(prisma, tenantId)));

    // Suite 2: Catalog & Variant Coverage
    allResults.push(...(await reconcileProductVariantCoverage(prisma, tenantId)));

    // Suite 3: Canonical Physical Inventory Parity (C-04)
    allResults.push(...(await reconcileInventoryPhysicalBaseline(prisma, tenantId)));

    // Suite 4: Ledger Audit Equality
    allResults.push(...(await reconcileLedgerIntegrity(prisma, tenantId)));

    // Suite 5: User Model B Identity & Credentials (C-02)
    allResults.push(...(await reconcileUserCredentials(prisma, tenantId)));

    // Suite 6: Sales & Multi-Tender Payment Parity
    allResults.push(...(await reconcileOrderPaymentParity(prisma, tenantId)));
  } catch (err: any) {
    console.error('[ERROR] Failure during reconciliation execution', err);
  } finally {
    if (shouldDisconnect) {
      await prisma.$disconnect();
    }
  }

  const allPassed = allResults.every((r) => r.passed);

  console.log('\n--- RECONCILIATION TEST RESULTS MATRIX ---');
  console.table(
    allResults.map((r) => ({
      'Parity Test Suite': r.suiteName,
      Status: r.passed ? 'PASSED (0 Discrepancy)' : 'FAILED',
      Discrepancies: r.discrepancyCount,
      Details: r.details,
    }))
  );

  console.log('================================================================');
  if (allPassed) {
    console.log('VERDICT: 100% PARITY ACHIEVED — READY FOR POST-BACKFILL RECONCILIATION REVIEW & DUAL-WRITE AUTHORIZATION PLANNING');
  } else {
    console.log('VERDICT: RECONCILIATION VARIANCE DETECTED — DUAL-WRITE AUTHORIZATION BLOCKED');
  }
  console.log('================================================================\n');

  return { allPassed, results: allResults };
}

// CLI entrypoint
if (require.main === module) {
  const args = process.argv.slice(2);
  const tenantArg = args.find((a) => a.startsWith('--tenant='));
  const tenantId = tenantArg ? tenantArg.split('=')[1] : undefined;

  runAllReconciliations(tenantId).then(({ allPassed }) => {
    process.exit(allPassed ? 0 : 1);
  });
}
