import { PrismaClient } from '@prisma/client';
import { BackfillContext, BackfillResult } from './types';
import { executeWriteRaw } from '../helpers/sql_safety';

/**
 * Worker 10: Stock Movement Archival
 * Safely archives legacy stock_movements into the dedicated read-only legacy_stock_movements table.
 * Governed by ODR-05 (Archive-only, zero rows merged into inventory_ledgers).
 * Uses parameterized raw SQL.
 */
export async function runArchiveStockMovements(
  prisma: any,
  context: BackfillContext
): Promise<BackfillResult> {
  const result: BackfillResult = {
    workerName: '10_archive_stock_movements',
    processedCount: 0,
    createdCount: 0,
    skippedCount: 0,
    errorCount: 0,
    exceptions: [],
    plannedIds: [],
  };

  context.logger.info(`Starting Worker: ${result.workerName} (DryRun: ${context.isDryRun})`);

  if (context.failureInjectionWorker === result.workerName) {
    throw new Error(`FAILURE_INJECTION_TRIGGERED: Injected fatal mutation error in worker ${result.workerName}`);
  }

  try {
    const query = context.tenantId
      ? `SELECT sm.id, sm.outlet_id, sm.product_id, sm.type, sm.quantity, sm.notes, sm.created_at 
         FROM "stock_movements" sm
         JOIN "outlets" o ON o.id = sm.outlet_id
         WHERE o.tenant_id = $1;`
      : `SELECT sm.id, sm.outlet_id, sm.product_id, sm.type, sm.quantity, sm.notes, sm.created_at 
         FROM "stock_movements" sm;`;

    const movements: any[] = context.tenantId
      ? await prisma.$queryRawUnsafe(query, context.tenantId)
      : await prisma.$queryRawUnsafe(query);

    result.processedCount = movements.length;

    for (const mov of movements) {
      const existing: any[] = await prisma.$queryRawUnsafe(
        `SELECT id FROM "legacy_stock_movements" WHERE id = $1 LIMIT 1;`,
        mov.id
      );

      if (existing.length > 0) {
        result.skippedCount++;
        continue;
      }

      if (!context.isDryRun) {
        await executeWriteRaw(
          prisma,
          context,
          `INSERT INTO "legacy_stock_movements" ("id", "outlet_id", "product_id", "type", "quantity", "notes", "created_at", "archived_at")
           VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
           ON CONFLICT ("id") DO NOTHING;`,
          mov.id,
          mov.outlet_id,
          mov.product_id,
          mov.type,
          mov.quantity,
          mov.notes,
          mov.created_at
        );
      }
      result.plannedIds!.push(mov.id);
      result.createdCount++;
    }
  } catch (err: any) {
    context.logger.error(`Error archiving stock movements`, err);
    result.errorCount++;
    result.exceptions.push({
      recordId: 'ALL',
      reason: err.message,
    });
    if (!context.isDryRun) {
      throw err;
    }
  }

  context.logger.info(
    `Finished ${result.workerName}: Archived=${result.createdCount}, Skipped=${result.skippedCount}, Errors=${result.errorCount}`
  );
  return result;
}
