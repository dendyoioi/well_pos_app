import { PrismaClient } from '@prisma/client';
import { BackfillContext, BackfillResult } from './types';
import { generateDeterministicUuid } from '../helpers/deterministic_uuid';
import { executeWriteRaw } from '../helpers/sql_safety';

/**
 * Worker 05: InventoryBalance Calibration
 * Calibrates physical stock from legacy outlet_products into InventoryBalance.
 * (Safety Invariant: InventoryBalance has NO isNegativeBalance column!)
 * Uses parameterized raw SQL (no target Prisma delegates).
 */
export async function runInventoryBalancesBackfill(
  prisma: any,
  context: BackfillContext
): Promise<BackfillResult> {
  const result: BackfillResult = {
    workerName: '05_inventory_balances',
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

  // Query legacy outlet_products joined with outlets to get tenant_id
  const query = context.tenantId
    ? `SELECT op.id, op.outlet_id, op.product_id, op.stock, o.tenant_id 
       FROM "outlet_products" op 
       JOIN "outlets" o ON o.id = op.outlet_id 
       WHERE o.tenant_id = $1;`
    : `SELECT op.id, op.outlet_id, op.product_id, op.stock, o.tenant_id 
       FROM "outlet_products" op 
       JOIN "outlets" o ON o.id = op.outlet_id;`;

  const rows: any[] = context.tenantId
    ? await prisma.$queryRawUnsafe(query, context.tenantId)
    : await prisma.$queryRawUnsafe(query);

  result.processedCount = rows.length;

  for (const row of rows) {
    try {
      const inventoryItemId = generateDeterministicUuid(`${row.product_id}:inventory_item`);
      const storageLocationId = generateDeterministicUuid(`${row.outlet_id}:default_location`);
      const balanceId = generateDeterministicUuid(`${inventoryItemId}:${storageLocationId}:unbatched_balance`);

      const existing: any[] = await prisma.$queryRawUnsafe(
        `SELECT id FROM "inventory_balances" WHERE id = $1 LIMIT 1;`,
        balanceId
      );

      if (existing.length > 0) {
        result.skippedCount++;
        continue;
      }

      const stockNum = Number(row.stock || 0);

      // Evaluate Negative Stock (H-05: ADR-002 Hierarchy: InventoryItem -> StorageLocation -> Tenant)
      if (stockNum < 0) {
        const itemRows: any[] = await prisma.$queryRawUnsafe(
          `SELECT allow_negative_stock FROM "inventory_items" WHERE id = $1;`,
          inventoryItemId
        );
        const locRows: any[] = await prisma.$queryRawUnsafe(
          `SELECT allow_negative_stock FROM "storage_locations" WHERE id = $1;`,
          storageLocationId
        );
        const tenantRows: any[] = await prisma.$queryRawUnsafe(
          `SELECT allow_negative_stock FROM "tenants" WHERE id = $1;`,
          row.tenant_id
        );

        // Hierarchical inheritance: Item override ?? Location override ?? Tenant base policy
        const allowNegative =
          itemRows[0]?.allow_negative_stock ??
          locRows[0]?.allow_negative_stock ??
          tenantRows[0]?.allow_negative_stock ??
          false;

        if (!allowNegative) {
          // Case B: Negative stock not permitted by policy -> Migration Exception
          context.logger.warn(
            `Negative stock encountered for product ${row.product_id} at outlet ${row.outlet_id} (stock=${stockNum}) but allowNegativeStock is false. Flagging as migration exception.`
          );
          result.exceptions.push({
            recordId: row.id,
            reason: `Negative stock (${stockNum}) not permitted by ADR-002 policy. Manual reconciliation required.`,
          });
          continue;
        }
      }

      if (!context.isDryRun) {
        await executeWriteRaw(
          prisma,
          context,
          `INSERT INTO "inventory_balances" (
            "id", "tenant_id", "inventory_item_id", "storage_location_id", "inventory_batch_id",
            "quantity_on_hand", "quantity_reserved", "updated_at"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
          ON CONFLICT ("id") DO NOTHING;`,
          balanceId,
          row.tenant_id,
          inventoryItemId,
          storageLocationId,
          null, // B-01: Explicit unbatched stock dimension
          stockNum,
          0 // quantityReserved
        );
      }

      result.plannedIds!.push(balanceId);
      result.createdCount++;
    } catch (err: any) {
      context.logger.error(`Error calibrating InventoryBalance for outlet_product ${row.id}`, err);
      result.errorCount++;
      result.exceptions.push({
        recordId: row.id,
        reason: err.message,
      });
      if (!context.isDryRun) {
        throw err;
      }
    }
  }

  context.logger.info(
    `Finished ${result.workerName}: Created=${result.createdCount}, Skipped=${result.skippedCount}, Exceptions=${result.exceptions.length}`
  );
  return result;
}
