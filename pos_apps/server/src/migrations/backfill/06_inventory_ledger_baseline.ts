import { PrismaClient } from '@prisma/client';
import { BackfillContext, BackfillResult } from './types';
import { generateDeterministicUuid } from '../helpers/deterministic_uuid';
import { executeWriteRaw } from '../helpers/sql_safety';

/**
 * Worker 06: InventoryLedger Opening Baseline Initialization
 * Inserts the initial opening movement calibration record in the immutable ledger.
 * Governed by OD-13.3-01 Option A & ODR-05 (Opening calibration only; 0 prototype movements).
 * Uses parameterized raw SQL (no target Prisma delegates).
 */
export async function runInventoryLedgerBaseline(
  prisma: any,
  context: BackfillContext
): Promise<BackfillResult> {
  const result: BackfillResult = {
    workerName: '06_inventory_ledger_baseline',
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

  // Query populated inventory balances via raw SQL
  const balancesQuery = context.tenantId
    ? `SELECT ib.id, ib.tenant_id, ib.inventory_item_id, ib.storage_location_id, ib.inventory_batch_id,
              ib.quantity_on_hand, COALESCE(ii.average_cost, 0) as average_cost
       FROM "inventory_balances" ib
       LEFT JOIN "inventory_items" ii ON ii.id = ib.inventory_item_id
       WHERE ib.tenant_id = $1;`
    : `SELECT ib.id, ib.tenant_id, ib.inventory_item_id, ib.storage_location_id, ib.inventory_batch_id,
              ib.quantity_on_hand, COALESCE(ii.average_cost, 0) as average_cost
       FROM "inventory_balances" ib
       LEFT JOIN "inventory_items" ii ON ii.id = ib.inventory_item_id;`;

  let balances: any[] = context.tenantId
    ? await prisma.$queryRawUnsafe(balancesQuery, context.tenantId)
    : await prisma.$queryRawUnsafe(balancesQuery);

  // In dry-run mode, if inventory_balances has not yet been populated by Worker 05,
  // derive intended baseline balances directly from legacy outlet_products to simulate dry-run ledger calibration:
  if (context.isDryRun && balances.length === 0) {
    const fallbackQuery = context.tenantId
      ? `SELECT op.id as op_id, op.outlet_id, op.product_id, op.stock, o.tenant_id, COALESCE(p.cost_price, 0) as average_cost
         FROM "outlet_products" op
         JOIN "outlets" o ON o.id = op.outlet_id
         LEFT JOIN "products" p ON p.id = op.product_id
         WHERE o.tenant_id = $1;`
      : `SELECT op.id as op_id, op.outlet_id, op.product_id, op.stock, o.tenant_id, COALESCE(p.cost_price, 0) as average_cost
         FROM "outlet_products" op
         JOIN "outlets" o ON o.id = op.outlet_id
         LEFT JOIN "products" p ON p.id = op.product_id;`;

    const fallbackRows: any[] = context.tenantId
      ? await prisma.$queryRawUnsafe(fallbackQuery, context.tenantId)
      : await prisma.$queryRawUnsafe(fallbackQuery);

    balances = fallbackRows.map((r) => {
      const inventoryItemId = generateDeterministicUuid(`${r.product_id}:inventory_item`);
      const storageLocationId = generateDeterministicUuid(`${r.outlet_id}:default_location`);
      const balanceId = generateDeterministicUuid(`${inventoryItemId}:${storageLocationId}:unbatched_balance`);
      return {
        id: balanceId,
        tenant_id: r.tenant_id,
        inventory_item_id: inventoryItemId,
        storage_location_id: storageLocationId,
        inventory_batch_id: null,
        quantity_on_hand: Number(r.stock || 0),
        average_cost: Number(r.average_cost || 0),
      };
    });
  }

  result.processedCount = balances.length;

  for (const balance of balances) {
    try {
      const ledgerId = generateDeterministicUuid(`${balance.id}:opening_ledger`);

      const existing: any[] = await prisma.$queryRawUnsafe(
        `SELECT id FROM "inventory_ledgers" WHERE id = $1 LIMIT 1;`,
        ledgerId
      );

      if (existing.length > 0) {
        result.skippedCount++;
        continue;
      }

      const qty = Number(balance.quantity_on_hand || 0);
      const isNegative = qty < 0;
      const unitCost = Number(balance.average_cost || 0);

      if (!context.isDryRun) {
        await executeWriteRaw(
          prisma,
          context,
          `INSERT INTO "inventory_ledgers" (
            "id", "tenant_id", "inventory_item_id", "storage_location_id", "inventory_batch_id",
            "quantity_delta", "balance_before", "balance_after", "unit_cost",
            "movement_type", "reference_type", "reference_id",
            "actor_type", "actor_user_id", "is_negative_balance", "notes", "created_at"
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10::"StockMovementType", $11::"InventoryRefType", $12,
            $13::"ActorType", $14, $15, $16, CURRENT_TIMESTAMP
          )
          ON CONFLICT ("id") DO NOTHING;`,
          ledgerId,
          balance.tenant_id,
          balance.inventory_item_id,
          balance.storage_location_id,
          balance.inventory_batch_id ?? null,
          qty,
          0,
          qty,
          unitCost,
          'OPNAME_ADJUSTMENT',
          'STOCK_OPNAME',
          'MIGRATION_OPENING_BALANCE',
          'SYSTEM',
          null,
          isNegative,
          'Migrasi saldo awal dari legacy outlet_products'
        );
      }

      result.plannedIds!.push(ledgerId);
      result.createdCount++;
    } catch (err: any) {
      context.logger.error(`Error writing opening ledger for balance ${balance.id}`, err);
      result.errorCount++;
      result.exceptions.push({
        recordId: balance.id,
        reason: err.message,
      });
      if (!context.isDryRun) {
        throw err;
      }
    }
  }

  context.logger.info(
    `Finished ${result.workerName}: Created=${result.createdCount}, Skipped=${result.skippedCount}`
  );
  return result;
}
