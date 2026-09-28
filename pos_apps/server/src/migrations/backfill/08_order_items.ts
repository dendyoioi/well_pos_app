import { PrismaClient } from '@prisma/client';
import { BackfillContext, BackfillResult } from './types';
import { generateDeterministicUuid } from '../helpers/deterministic_uuid';
import { executeWriteRaw } from '../helpers/sql_safety';

/**
 * Worker 08: OrderItem to ProductVariant Remapping
 * Remaps order_items to product_variant_id and backfills historical snapshot fields.
 * Uses parameterized raw SQL (no target Prisma delegates).
 */
export async function runOrderItemsBackfill(
  prisma: any,
  context: BackfillContext
): Promise<BackfillResult> {
  const result: BackfillResult = {
    workerName: '08_order_items',
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

  // Query order_items that lack product_variant_id
  const query = context.tenantId
    ? `SELECT oi.id, oi.product_id, oi.product_variant_id, p.name as product_name, p.sku as product_sku, p.cost_price 
       FROM "order_items" oi 
       JOIN "orders" o ON o.id = oi.order_id 
       JOIN "products" p ON p.id = oi.product_id 
       WHERE o.tenant_id = $1 AND oi.product_variant_id IS NULL;`
    : `SELECT oi.id, oi.product_id, oi.product_variant_id, p.name as product_name, p.sku as product_sku, p.cost_price 
       FROM "order_items" oi 
       JOIN "products" p ON p.id = oi.product_id 
       WHERE oi.product_variant_id IS NULL;`;

  const items: any[] = context.tenantId
    ? await prisma.$queryRawUnsafe(query, context.tenantId)
    : await prisma.$queryRawUnsafe(query);

  result.processedCount = items.length;

  for (const item of items) {
    try {
      const variantId = generateDeterministicUuid(`${item.product_id}:variant`);

      if (!context.isDryRun) {
        await executeWriteRaw(
          prisma,
          context,
          `UPDATE "order_items" 
           SET "product_variant_id" = $1, 
               "product_name" = $2, 
               "variant_name" = 'Default', 
               "sku" = $3, 
               "cost_price" = $4 
           WHERE "id" = $5;`,
          variantId,
          item.product_name,
          item.product_sku || '',
          item.cost_price || 0,
          item.id
        );
      }

      result.plannedIds!.push(`${item.id}:${variantId}`);
      result.createdCount++;
    } catch (err: any) {
      context.logger.error(`Error remapping order_item ${item.id}`, err);
      result.errorCount++;
      result.exceptions.push({
        recordId: item.id,
        reason: err.message,
      });
      if (!context.isDryRun) {
        throw err;
      }
    }
  }

  context.logger.info(
    `Finished ${result.workerName}: Remapped=${result.createdCount}, Errors=${result.errorCount}`
  );
  return result;
}
