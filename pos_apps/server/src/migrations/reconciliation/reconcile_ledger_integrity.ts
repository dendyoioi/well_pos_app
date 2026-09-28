import { PrismaClient } from '@prisma/client';
import { ParityCheckResult } from './reconcile_tenant_integrity';

/**
 * Reconciles Immutable Ledger Integrity
 * Verifies that InventoryBalance.quantityOnHand equals the exact sum of all InventoryLedger deltas.
 * Fully parameterized SQL: zero string interpolation.
 */
export async function reconcileLedgerIntegrity(
  prisma: PrismaClient,
  tenantId?: string
): Promise<ParityCheckResult[]> {
  const results: ParityCheckResult[] = [];

  const queryDriftScoped = `
    SELECT 
      ib.tenant_id,
      ib.inventory_item_id,
      ib.storage_location_id,
      ib.inventory_batch_id,
      ib.quantity_on_hand,
      COALESCE(SUM(il.quantity_delta), 0) AS total_ledger_deltas,
      (ib.quantity_on_hand - COALESCE(SUM(il.quantity_delta), 0)) AS drift
    FROM "inventory_balances" ib
    LEFT JOIN "inventory_ledgers" il 
      ON il.inventory_item_id = ib.inventory_item_id 
      AND il.storage_location_id = ib.storage_location_id 
      AND (il.inventory_batch_id = ib.inventory_batch_id OR (il.inventory_batch_id IS NULL AND ib.inventory_batch_id IS NULL))
      AND il.tenant_id = ib.tenant_id
    WHERE ib.tenant_id = $1
    GROUP BY ib.tenant_id, ib.inventory_item_id, ib.storage_location_id, ib.inventory_batch_id, ib.quantity_on_hand
    HAVING ib.quantity_on_hand != COALESCE(SUM(il.quantity_delta), 0);
  `;

  const queryDriftGlobal = `
    SELECT 
      ib.tenant_id,
      ib.inventory_item_id,
      ib.storage_location_id,
      ib.inventory_batch_id,
      ib.quantity_on_hand,
      COALESCE(SUM(il.quantity_delta), 0) AS total_ledger_deltas,
      (ib.quantity_on_hand - COALESCE(SUM(il.quantity_delta), 0)) AS drift
    FROM "inventory_balances" ib
    LEFT JOIN "inventory_ledgers" il 
      ON il.inventory_item_id = ib.inventory_item_id 
      AND il.storage_location_id = ib.storage_location_id 
      AND (il.inventory_batch_id = ib.inventory_batch_id OR (il.inventory_batch_id IS NULL AND ib.inventory_batch_id IS NULL))
      AND il.tenant_id = ib.tenant_id
    GROUP BY ib.tenant_id, ib.inventory_item_id, ib.storage_location_id, ib.inventory_batch_id, ib.quantity_on_hand
    HAVING ib.quantity_on_hand != COALESCE(SUM(il.quantity_delta), 0);
  `;

  const drifts: any[] = tenantId
    ? await prisma.$queryRawUnsafe(queryDriftScoped, tenantId)
    : await prisma.$queryRawUnsafe(queryDriftGlobal);

  results.push({
    suiteName: 'Inventory: Ledger Audit Equality (quantityOnHand = sum(ledger_deltas))',
    passed: drifts.length === 0,
    discrepancyCount: drifts.length,
    details: drifts.length === 0
      ? '100% mathematical equality between current balances and ledger event streams.'
      : `${drifts.length} inventory balance dimensions show drift against ledger history!`,
  });

  return results;
}
