import { BaseReadAdapter } from './base.read_adapter';
import { LowStockItemDTO, StockMovementDTO } from './types';
import { parseDateBoundary } from '../../utils/date.utils';

/**
 * InventoryReadAdapter
 * Target read adapter for inventory queries reading directly from:
 * - inventory_balances
 * - inventory_ledgers
 * - inventory_items
 * - product_variants
 * - products
 * - storage_locations
 */
export class InventoryReadAdapter extends BaseReadAdapter {
  /**
   * Retrieves products with low stock (quantity_on_hand <= reorder_point).
   */
  public async getLowStock(tenantId: string, outletId?: string): Promise<LowStockItemDTO[]> {
    let storageLocationId: string | null = null;
    if (outletId) {
      storageLocationId = await this.resolveDefaultStorageLocation(tenantId, outletId);
    }

    const params: any[] = [tenantId];
    let locCondition = '';
    if (storageLocationId) {
      params.push(storageLocationId);
      locCondition = `AND ib.storage_location_id = $${params.length}`;
    }

    const sql = `
      SELECT 
        p.id as product_id,
        p.name,
        pv.sku,
        pv.barcode,
        p.unit,
        ib.quantity_on_hand as stock,
        COALESCE(ii.reorder_point, 5) as min_stock_alert
      FROM "inventory_balances" ib
      JOIN "inventory_items" ii ON ii.id = ib.inventory_item_id
      JOIN "product_variants" pv ON pv.inventory_item_id = ii.id AND pv.is_active = true
      JOIN "products" p ON p.id = pv.product_id
      WHERE ib.tenant_id = $1 
        ${locCondition}
        AND ib.quantity_on_hand <= COALESCE(ii.reorder_point, 5)
      ORDER BY ib.quantity_on_hand ASC;
    `;

    const rows = await this.queryRaw<any>(sql, ...params);
    return rows.map((r) => ({
      productId: r.product_id,
      name: r.name,
      sku: r.sku,
      barcode: r.barcode || null,
      unit: r.unit || 'PCS',
      stock: Number(r.stock || 0),
      minStockAlert: Number(r.min_stock_alert || 5),
    }));
  }

  /**
   * Retrieves immutable stock movements ledger stream.
   */
  public async getStockMovements(
    tenantId: string,
    options: {
      productId?: string;
      outletId?: string;
      type?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    }
  ): Promise<StockMovementDTO[]> {
    const { productId, outletId, type, startDate, endDate, limit = 100 } = options;

    const params: any[] = [tenantId];
    const whereClauses: string[] = [`il.tenant_id = $1`];

    if (productId) {
      params.push(productId);
      whereClauses.push(`(p.id = $${params.length} OR ii.id = $${params.length})`);
    }

    if (outletId) {
      params.push(outletId);
      whereClauses.push(`sl.outlet_id = $${params.length}`);
    }

    if (type && type !== 'ALL') {
      params.push(type);
      whereClauses.push(`il.movement_type::text = $${params.length}`);
    }

    if (startDate) {
      params.push(parseDateBoundary(startDate, false));
      whereClauses.push(`il.created_at >= ($${params.length} AT TIME ZONE 'UTC')`);
    }

    if (endDate) {
      params.push(parseDateBoundary(endDate, true));
      whereClauses.push(`il.created_at <= ($${params.length} AT TIME ZONE 'UTC')`);
    }

    params.push(limit);
    const limitIdx = params.length;

    const sql = `
      SELECT 
        il.id,
        COALESCE(p.id, ii.id) as product_id,
        sl.outlet_id,
        il.actor_user_id as user_id,
        il.movement_type::text as type,
        il.quantity_delta as quantity,
        il.balance_before as stock_before,
        il.balance_after as stock_after,
        il.notes,
        il.created_at,
        COALESCE(p.name, ii.name) as product_name,
        COALESCE(pv.sku, ii.item_code) as sku,
        COALESCE(p.unit, ii.canonical_uom) as unit,
        COALESCE(il.unit_cost, ii.average_cost, 0) as cost_price,
        COALESCE(pv.price, 0) as base_price,
        u.name as user_name,
        u.role as user_role,
        o.name as outlet_name
      FROM "inventory_ledgers" il
      JOIN "inventory_items" ii ON ii.id = il.inventory_item_id
      LEFT JOIN "product_variants" pv ON pv.inventory_item_id = ii.id
      LEFT JOIN "products" p ON p.id = pv.product_id
      JOIN "storage_locations" sl ON sl.id = il.storage_location_id
      JOIN "outlets" o ON o.id = sl.outlet_id
      LEFT JOIN "users" u ON u.id = il.actor_user_id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY il.created_at DESC
      LIMIT $${limitIdx};
    `;

    const rows = await this.queryRaw<any>(sql, ...params);
    return rows.map((r) => ({
      id: r.id,
      productId: r.product_id,
      outletId: r.outlet_id,
      userId: r.user_id || null,
      type: r.type,
      quantity: Number(r.quantity || 0),
      stockBefore: Number(r.stock_before || 0),
      stockAfter: Number(r.stock_after || 0),
      notes: r.notes || null,
      createdAt: new Date(r.created_at),
      product: {
        id: r.product_id,
        name: r.product_name,
        sku: r.sku,
        unit: r.unit || 'PCS',
        costPrice: Number(r.cost_price || 0),
        basePrice: Number(r.base_price || 0),
      },
      user: r.user_id
        ? {
            id: r.user_id,
            name: r.user_name || 'Staff',
            role: r.user_role || 'CASHIER',
          }
        : null,
      outlet: {
        id: r.outlet_id,
        name: r.outlet_name || 'Outlet',
      },
    }));
  }
}

export const inventoryReadAdapter = new InventoryReadAdapter();
