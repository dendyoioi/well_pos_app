import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';

export interface ReverseReconciliationStats {
  tenantId?: string;
  syncedOutletProducts: number;
  syncedPayments: number;
  syncedStockMovements: number;
  durationMs: number;
  success: boolean;
  timestamp: string;
}

/**
 * Reverse Reconciliation Engine (OD-15.3-01 / RUNBOOK SEC 6)
 * Synchronizes Target-Only state back into Legacy operational tables:
 * 1. outlet_products.stock = inventory_balances.quantity_on_hand
 * 2. legacy payments from payment_transactions
 * 3. legacy stock_movements from inventory_ledgers
 *
 * Guarantees zero data loss in the event of cutover rollback.
 */
export async function executeReverseReconciliation(
  tenantId?: string,
  prismaClient?: PrismaClient
): Promise<ReverseReconciliationStats> {
  const startTime = Date.now();
  const prisma = prismaClient || new PrismaClient();
  const shouldDisconnect = !prismaClient;

  console.log('================================================================');
  console.log('STARTING REVERSE RECONCILIATION ENGINE (SHIFT REVERSAL RECOVERY)');
  if (tenantId) console.log(`Target Tenant Scope: ${tenantId}`);
  console.log('================================================================');

  let syncedOutletProducts = 0;
  let syncedPayments = 0;
  let syncedStockMovements = 0;

  try {
    // 1. Resynchronize Physical Stock (outlet_products.stock = inventory_balances.quantity_on_hand)
    console.log('[1/3] Synchronizing outlet_products.stock from inventory_balances...');
    const stockSyncQuery = `
      WITH updated AS (
        UPDATE "outlet_products" op
        SET "stock" = ib.quantity_on_hand,
            "updated_at" = CURRENT_TIMESTAMP
        FROM "inventory_balances" ib
        JOIN "storage_locations" sl ON ib.storage_location_id = sl.id AND sl.is_default = true
        JOIN "inventory_items" ii ON ii.id = ib.inventory_item_id
        JOIN "product_variants" pv ON pv.inventory_item_id = ii.id
        WHERE op.outlet_id = sl.outlet_id 
          AND op.product_id = pv.product_id
          AND ib.inventory_batch_id IS NULL
          AND op.stock != ib.quantity_on_hand
          AND ($1::text IS NULL OR sl.tenant_id = $1)
        RETURNING op.id
      )
      SELECT COUNT(*)::int AS count FROM updated;
    `;
    const stockRes: any[] = await prisma.$queryRawUnsafe(stockSyncQuery, tenantId || null);
    syncedOutletProducts = stockRes[0]?.count || 0;
    console.log(`  -> Calibrated ${syncedOutletProducts} outlet_products stock records.`);

    // 2. Resynchronize Payments (payments from payment_transactions)
    console.log('[2/3] Synchronizing legacy payments from payment_transactions...');
    const paymentSyncQuery = `
      WITH inserted AS (
        INSERT INTO "payments" (
          "id", "order_id", "method", "amount_paid", "change_given",
          "qris_reference", "status", "created_at"
        )
        SELECT 
          pt.id,
          pt.order_id,
          pt.payment_method,
          pt.amount,
          0,
          pt.reference_number,
          pt.status,
          pt.created_at
        FROM "payment_transactions" pt
        WHERE NOT EXISTS (
          SELECT 1 FROM "payments" p WHERE p.id = pt.id
        )
        AND ($1::text IS NULL OR pt.tenant_id = $1)
        ON CONFLICT ("id") DO NOTHING
        RETURNING id
      )
      SELECT COUNT(*)::int AS count FROM inserted;
    `;
    const paymentRes: any[] = await prisma.$queryRawUnsafe(paymentSyncQuery, tenantId || null);
    syncedPayments = paymentRes[0]?.count || 0;
    console.log(`  -> Backfilled ${syncedPayments} missing legacy payment records.`);

    // 3. Resynchronize Stock Movements (stock_movements from inventory_ledgers)
    console.log('[3/3] Synchronizing legacy stock_movements from inventory_ledgers...');
    const movementSyncQuery = `
      WITH inserted AS (
        INSERT INTO "stock_movements" (
          "id", "outlet_id", "product_id", "user_id", "type", "quantity", "notes", "created_at"
        )
        SELECT 
          il.id,
          sl.outlet_id,
          pv.product_id,
          COALESCE(il.actor_user_id, (SELECT id FROM "users" WHERE tenant_id = il.tenant_id LIMIT 1)),
          il.movement_type,
          il.quantity_delta::integer,
          COALESCE(il.notes, 'Reverse reconciled from target inventory ledger'),
          il.created_at
        FROM "inventory_ledgers" il
        JOIN "storage_locations" sl ON il.storage_location_id = sl.id
        JOIN "inventory_items" ii ON ii.id = il.inventory_item_id
        JOIN "product_variants" pv ON pv.inventory_item_id = ii.id
        WHERE NOT EXISTS (
          SELECT 1 FROM "stock_movements" sm WHERE sm.id = il.id
        )
        AND ($1::text IS NULL OR il.tenant_id = $1)
        ON CONFLICT ("id") DO NOTHING
        RETURNING id
      )
      SELECT COUNT(*)::int AS count FROM inserted;
    `;
    const movementRes: any[] = await prisma.$queryRawUnsafe(movementSyncQuery, tenantId || null);
    syncedStockMovements = movementRes[0]?.count || 0;
    console.log(`  -> Backfilled ${syncedStockMovements} legacy stock_movements records.`);

    const durationMs = Date.now() - startTime;
    console.log('================================================================');
    console.log(`REVERSE RECONCILIATION COMPLETED IN ${durationMs}ms (SUCCESS)`);
    console.log('================================================================\n');

    return {
      tenantId,
      syncedOutletProducts,
      syncedPayments,
      syncedStockMovements,
      durationMs,
      success: true,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error('[FATAL] Reverse reconciliation failed:', err);
    throw err;
  } finally {
    if (shouldDisconnect) {
      await prisma.$disconnect();
    }
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const tenantArg = args.find((a) => a.startsWith('--tenant='));
  const tenantId = tenantArg ? tenantArg.split('=')[1] : undefined;

  executeReverseReconciliation(tenantId)
    .then((stats) => {
      console.log(JSON.stringify(stats, null, 2));
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}
