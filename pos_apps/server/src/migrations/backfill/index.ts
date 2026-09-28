import { PrismaClient } from '@prisma/client';
import { BackfillContext, BackfillResult } from './types';
import { runTenantAudit } from './01_tenant_audit';
import { runStorageLocationProvisioning } from './02_storage_locations';
import { runInventoryItemsBackfill } from './03_inventory_items';
import { runProductVariantsBackfill } from './04_product_variants';
import { runInventoryBalancesBackfill } from './05_inventory_balances';
import { runInventoryLedgerBaseline } from './06_inventory_ledger_baseline';
import { runUserModelBBackfill } from './07_user_model_b';
import { runOrderItemsBackfill } from './08_order_items';
import { runPaymentTransactionsBackfill } from './09_payment_transactions';
import { runArchiveStockMovements } from './10_archive_stock_movements';

async function executeWorkerPipeline(
  client: any,
  context: BackfillContext
): Promise<BackfillResult[]> {
  const results: BackfillResult[] = [];
  results.push(await runTenantAudit(client, context));
  results.push(await runStorageLocationProvisioning(client, context));
  results.push(await runInventoryItemsBackfill(client, context));
  results.push(await runProductVariantsBackfill(client, context));
  results.push(await runInventoryBalancesBackfill(client, context));
  results.push(await runInventoryLedgerBaseline(client, context));
  results.push(await runUserModelBBackfill(client, context));
  results.push(await runOrderItemsBackfill(client, context));
  results.push(await runPaymentTransactionsBackfill(client, context));
  results.push(await runArchiveStockMovements(client, context));
  return results;
}

/**
 * Unified Backfill Orchestrator
 * Coordinates all 10 deterministic workers in dependency sequence.
 * In live mode (!isDryRun), wraps execution in an ACID transaction per tenant batch.
 */
export async function runAllBackfills(options: {
  isDryRun?: boolean;
  tenantId?: string;
  batchSize?: number;
  failureInjectionWorker?: string;
  prismaClient?: PrismaClient;
}): Promise<BackfillResult[]> {
  const prisma = options.prismaClient || new PrismaClient();
  const shouldDisconnect = !options.prismaClient;

  const context: BackfillContext = {
    isDryRun: options.isDryRun ?? true,
    tenantId: options.tenantId,
    batchSize: options.batchSize ?? 500,
    failureInjectionWorker: options.failureInjectionWorker,
    logger: {
      info: (msg) => console.log(`[INFO] ${msg}`),
      warn: (msg) => console.warn(`[WARN] ${msg}`),
      error: (msg, err) => console.error(`[ERROR] ${msg}`, err || ''),
    },
  };

  context.logger.info('====================================================');
  context.logger.info(`Starting Well POS Backfill Orchestrator (DryRun: ${context.isDryRun})`);
  context.logger.info('====================================================');

  const results: BackfillResult[] = [];

  try {
    if (context.isDryRun) {
      // Dry-run mode: read-only evaluation without transaction
      const dryRunResults = await executeWorkerPipeline(prisma, context);
      results.push(...dryRunResults);
    } else {
      // Live execution mode: ACID transaction boundary per tenant batch
      let tenantBatches: (string | undefined)[] = [];
      if (context.tenantId) {
        tenantBatches = [context.tenantId];
      } else {
        const tenantRows: any[] = await prisma.$queryRawUnsafe(
          `SELECT id FROM "tenants" ORDER BY id ASC;`
        );
        tenantBatches = tenantRows.length > 0 ? tenantRows.map((r: any) => r.id) : [undefined];
      }

      for (const currentTenantId of tenantBatches) {
        context.logger.info(`Beginning ACID transaction for tenant batch: ${currentTenantId || 'ALL'}`);
        const tenantContext: BackfillContext = {
          ...context,
          tenantId: currentTenantId,
        };

        await prisma.$transaction(
          async (tx) => {
            const batchResults = await executeWorkerPipeline(tx, tenantContext);
            results.push(...batchResults);
          },
          {
            timeout: 60000,
          }
        );
        context.logger.info(`Committed ACID transaction for tenant batch: ${currentTenantId || 'ALL'}`);
      }
    }

    context.logger.info('====================================================');
    context.logger.info('All Backfill Workers Completed Successfully.');
    context.logger.info('====================================================');
  } catch (fatalErr: any) {
    context.logger.error('Fatal error during backfill orchestration (aborted & rolled back)', fatalErr);
    if (!context.isDryRun) {
      // FAIL CLOSED: rethrow error so orchestrator halts and caller receives failure
      throw fatalErr;
    }
  } finally {
    if (shouldDisconnect) {
      await prisma.$disconnect();
    }
  }

  return results;
}

// CLI Execution entrypoint
if (require.main === module) {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes('--execute');
  const tenantArg = args.find((a) => a.startsWith('--tenant='));
  const tenantId = tenantArg ? tenantArg.split('=')[1] : undefined;

  runAllBackfills({ isDryRun, tenantId }).then((results) => {
    console.table(
      results.map((r) => ({
        Worker: r.workerName,
        Processed: r.processedCount,
        Created: r.createdCount,
        Skipped: r.skippedCount,
        Errors: r.errorCount,
        Exceptions: r.exceptions.length,
      }))
    );
  });
}
