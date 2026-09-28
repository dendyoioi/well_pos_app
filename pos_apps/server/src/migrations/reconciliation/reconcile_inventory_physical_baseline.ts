import { PrismaClient } from '@prisma/client';
import { ParityCheckResult } from './reconcile_tenant_integrity';

/**
 * Reconciles Canonical Physical Inventory Baseline (C-04)
 * Strictly verifies legacy outlet_products.stock = InventoryBalance.quantityOnHand
 * across exact dimensions. Multiplier is tested separately as a transaction multiplier.
 * Resolves tenant_id by joining outlets (outlet_products does not store tenant_id directly).
 * Fully parameterized SQL: zero string interpolation.
 */
export async function reconcileInventoryPhysicalBaseline(
  prisma: PrismaClient,
  tenantId?: string
): Promise<ParityCheckResult[]> {
  const results: ParityCheckResult[] = [];

  // Check 1: Opening Stock Equality across exact dimensions
  const queryDiscrepanciesScoped = `
    SELECT 
      o.tenant_id,
      op.outlet_id,
      op.product_id,
      op.stock AS legacy_stock,
      ib.quantity_on_hand AS target_quantity_on_hand,
      (op.stock - ib.quantity_on_hand) AS diff
    FROM "outlet_products" op
    JOIN "outlets" o ON o.id = op.outlet_id
    JOIN "products" p ON p.id = op.product_id
    JOIN "product_variants" pv ON pv.product_id = p.id AND pv.tenant_id = o.tenant_id
    JOIN "inventory_items" ii ON ii.id = pv.inventory_item_id AND ii.tenant_id = o.tenant_id
    JOIN "storage_locations" sl ON sl.outlet_id = op.outlet_id AND sl.is_default = true AND sl.tenant_id = o.tenant_id
    LEFT JOIN "inventory_balances" ib 
      ON ib.inventory_item_id = ii.id 
      AND ib.storage_location_id = sl.id 
      AND ib.tenant_id = o.tenant_id
      AND ib.inventory_batch_id IS NULL
    WHERE (ib.id IS NULL OR op.stock != ib.quantity_on_hand)
      AND o.tenant_id = $1;
  `;

  const queryDiscrepanciesGlobal = `
    SELECT 
      o.tenant_id,
      op.outlet_id,
      op.product_id,
      op.stock AS legacy_stock,
      ib.quantity_on_hand AS target_quantity_on_hand,
      (op.stock - ib.quantity_on_hand) AS diff
    FROM "outlet_products" op
    JOIN "outlets" o ON o.id = op.outlet_id
    JOIN "products" p ON p.id = op.product_id
    JOIN "product_variants" pv ON pv.product_id = p.id AND pv.tenant_id = o.tenant_id
    JOIN "inventory_items" ii ON ii.id = pv.inventory_item_id AND ii.tenant_id = o.tenant_id
    JOIN "storage_locations" sl ON sl.outlet_id = op.outlet_id AND sl.is_default = true AND sl.tenant_id = o.tenant_id
    LEFT JOIN "inventory_balances" ib 
      ON ib.inventory_item_id = ii.id 
      AND ib.storage_location_id = sl.id 
      AND ib.tenant_id = o.tenant_id
      AND ib.inventory_batch_id IS NULL
    WHERE (ib.id IS NULL OR op.stock != ib.quantity_on_hand);
  `;

  const discrepancies: any[] = tenantId
    ? await prisma.$queryRawUnsafe(queryDiscrepanciesScoped, tenantId)
    : await prisma.$queryRawUnsafe(queryDiscrepanciesGlobal);

  results.push({
    suiteName: 'Inventory: Physical Stock Parity (outlet_products.stock = quantityOnHand)',
    passed: discrepancies.length === 0,
    discrepancyCount: discrepancies.length,
    details: discrepancies.length === 0
      ? '100% exact physical stock equality across all outlets and items.'
      : `${discrepancies.length} dimensional discrepancies found between legacy and target stock!`,
  });

  // Check 2: Transaction Conversion Multiplier Sanity Check (strictly > 0)
  const invalidMultipliersQuery = tenantId
    ? `SELECT count(*)::int as count 
       FROM "product_variants" 
       WHERE inventory_quantity_multiplier <= 0 AND tenant_id = $1;`
    : `SELECT count(*)::int as count 
       FROM "product_variants" 
       WHERE inventory_quantity_multiplier <= 0;`;

  const invalidMultipliers: any[] = tenantId
    ? await prisma.$queryRawUnsafe(invalidMultipliersQuery, tenantId)
    : await prisma.$queryRawUnsafe(invalidMultipliersQuery);

  const invalidCount = invalidMultipliers[0]?.count || 0;

  results.push({
    suiteName: 'Inventory: Transaction Multiplier Sanity (multiplier > 0)',
    passed: invalidCount === 0,
    discrepancyCount: invalidCount,
    details: invalidCount === 0
      ? 'All inventoryQuantityMultiplier values are strictly positive (> 0).'
      : `${invalidCount} variants have non-positive inventory multiplier!`,
  });

  return results;
}
