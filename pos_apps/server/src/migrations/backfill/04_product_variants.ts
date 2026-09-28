import { PrismaClient } from '@prisma/client';
import { BackfillContext, BackfillResult } from './types';
import { generateDeterministicUuid } from '../helpers/deterministic_uuid';
import { executeWriteRaw } from '../helpers/sql_safety';

/**
 * Worker 04: ProductVariant Provisioning
 * Maps legacy Product to commercial ProductVariant (id = uuidv5(product.id, 'variant')).
 * Sets inventoryQuantityMultiplier = 1.000 for transaction deduction.
 * Uses parameterized raw SQL (no target Prisma delegates).
 */
export async function runProductVariantsBackfill(
  prisma: any,
  context: BackfillContext
): Promise<BackfillResult> {
  const result: BackfillResult = {
    workerName: '04_product_variants',
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

  const query = context.tenantId
    ? `SELECT id, tenant_id, name, sku, barcode, base_price, is_active FROM "products" WHERE tenant_id = $1;`
    : `SELECT id, tenant_id, name, sku, barcode, base_price, is_active FROM "products";`;

  const products: any[] = context.tenantId
    ? await prisma.$queryRawUnsafe(query, context.tenantId)
    : await prisma.$queryRawUnsafe(query);

  result.processedCount = products.length;

  for (const product of products) {
    try {
      const variantId = generateDeterministicUuid(`${product.id}:variant`);
      const inventoryItemId = generateDeterministicUuid(`${product.id}:inventory_item`);

      const existing: any[] = await prisma.$queryRawUnsafe(
        `SELECT id FROM "product_variants" WHERE id = $1 LIMIT 1;`,
        variantId
      );

      if (existing.length > 0) {
        result.skippedCount++;
        continue;
      }

      const sku = (product.sku && product.sku.trim() !== '')
        ? product.sku.trim()
        : `SKU-${product.id.substring(0, 8).toUpperCase()}`;

      const barcode = (product.barcode && product.barcode.trim() !== '')
        ? product.barcode.trim()
        : null;

      const price = product.base_price ? Number(product.base_price) : 0;

      if (!context.isDryRun) {
        await executeWriteRaw(
          prisma,
          context,
          `INSERT INTO "product_variants" (
            "id", "tenant_id", "product_id", "inventory_item_id", "sku", "barcode", "name",
            "price", "inventory_quantity_multiplier", "is_active", "created_at", "updated_at"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT ("id") DO NOTHING;`,
          variantId,
          product.tenant_id,
          product.id,
          inventoryItemId,
          sku,
          barcode,
          'Default',
          price,
          1.000,
          product.is_active ?? true
        );
      }

      result.plannedIds!.push(variantId);
      result.createdCount++;
    } catch (err: any) {
      context.logger.error(`Error creating ProductVariant for product ${product.id}`, err);
      result.errorCount++;
      result.exceptions.push({
        recordId: product.id,
        reason: err.message,
      });
      if (!context.isDryRun) {
        throw err;
      }
    }
  }

  context.logger.info(
    `Finished ${result.workerName}: Created=${result.createdCount}, Skipped=${result.skippedCount}, Errors=${result.errorCount}`
  );
  return result;
}
