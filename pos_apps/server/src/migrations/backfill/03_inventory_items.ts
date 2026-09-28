import { PrismaClient } from '@prisma/client';
import { BackfillContext, BackfillResult } from './types';
import { generateDeterministicUuid } from '../helpers/deterministic_uuid';
import { executeWriteRaw } from '../helpers/sql_safety';

/**
 * Worker 03: InventoryItem Provisioning
 * Maps legacy Product to logistical InventoryItem (id = uuidv5(product.id, 'inventory_item')).
 * Uses parameterized raw SQL (no target Prisma delegates).
 */
export async function runInventoryItemsBackfill(
  prisma: any,
  context: BackfillContext
): Promise<BackfillResult> {
  const result: BackfillResult = {
    workerName: '03_inventory_items',
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
    ? `SELECT id, tenant_id, name, sku, unit, cost_price, is_active FROM "products" WHERE tenant_id = $1;`
    : `SELECT id, tenant_id, name, sku, unit, cost_price, is_active FROM "products";`;

  const products: any[] = context.tenantId
    ? await prisma.$queryRawUnsafe(query, context.tenantId)
    : await prisma.$queryRawUnsafe(query);

  result.processedCount = products.length;

  const tenantItemCodes = new Map<string, Set<string>>();

  for (const product of products) {
    try {
      const deterministicId = generateDeterministicUuid(`${product.id}:inventory_item`);

      const existing: any[] = await prisma.$queryRawUnsafe(
        `SELECT id FROM "inventory_items" WHERE id = $1 LIMIT 1;`,
        deterministicId
      );

      if (existing.length > 0) {
        result.skippedCount++;
        continue;
      }

      if (!tenantItemCodes.has(product.tenant_id)) {
        tenantItemCodes.set(product.tenant_id, new Set<string>());
      }
      const codeSet = tenantItemCodes.get(product.tenant_id)!;

      // H-04: Deterministic, collision-safe itemCode generation
      let itemCode = (product.sku && product.sku.trim() !== '')
        ? `${product.sku.trim()}-INV`
        : `ITEM-${product.id.substring(0, 8).toUpperCase()}`;

      if (codeSet.has(itemCode)) {
        itemCode = `ITEM-${product.id.substring(0, 8).toUpperCase()}`;
      }
      codeSet.add(itemCode);

      const canonicalUom = product.unit || 'Pcs';
      const averageCost = product.cost_price ? Number(product.cost_price) : 0;

      if (!context.isDryRun) {
        await executeWriteRaw(
          prisma,
          context,
          `INSERT INTO "inventory_items" (
            "id", "tenant_id", "item_code", "name", "description", "canonical_uom", "purchase_uom",
            "reorder_point", "target_level", "average_cost", "allow_negative_stock", "is_batched", "is_active",
            "created_at", "updated_at"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12, $13,
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          ON CONFLICT ("id") DO NOTHING;`,
          deterministicId,
          product.tenant_id,
          itemCode,
          product.name,
          null,
          canonicalUom,
          null,
          0,
          0,
          averageCost,
          null, // allow_negative_stock: null (inherits location/tenant per ADR-002)
          false, // is_batched: false
          product.is_active ?? true
        );
      }

      result.plannedIds!.push(deterministicId);
      result.createdCount++;
    } catch (err: any) {
      context.logger.error(`Error creating InventoryItem for product ${product.id}`, err);
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
