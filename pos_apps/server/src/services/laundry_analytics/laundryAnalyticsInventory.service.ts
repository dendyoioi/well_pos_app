/**
 * Laundry Inventory & BoM Cost Control Analytics Service
 * Laundry Outlet Performance Intelligence (Well POS)
 * 
 * Mengimplementasikan kalkulasi valuasi persediaan deterjen/parfum/plastik,
 * biaya kimia per kg cucian (Chemical Cost per Kg), deteksi stok menipis (Low Stock),
 * barang lambat/mati (Dead Stock), nilai penyusutan (Shrinkage), serta rekap pembelian vendor.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { FinancialAnalyticsParams } from './laundryAnalyticsFinancial.service';
import { resolveLaundryOutletScope } from './laundryOutletScope.helper';

export interface LowStockItem {
  itemId: string;
  itemCode: string;
  name: string;
  uom: string;
  quantityOnHand: number;
  reorderPoint: number;
  averageCost: number;
  status: 'CRITICAL' | 'LOW';
}

export interface DeadStockItem {
  itemId: string;
  itemCode: string;
  name: string;
  uom: string;
  quantityOnHand: number;
  averageCost: number;
  totalValue: number;
  lastMovementAt: string | null;
  daysInactive: number;
}

export interface SupplierPurchaseItem {
  supplierId: string;
  supplierName: string;
  poCount: number;
  totalAmount: number;
}

export interface InventoryAnalyticsResult {
  meta: {
    tenantId: string;
    outletId: string | 'ALL';
    preset: string;
    formattedRange: {
      start: string;
      end: string;
      prevStart: string;
      prevEnd: string;
    };
    timezone: string;
  };
  summary: {
    chemicalCostPerKg: number;
    inventoryValuation: number;
    lowStockCount: number;
    shrinkageValue: number;
    bomVariancePercent: number;
    purchaseOrderValue: number;
    packagingCostPerOrder: number;
  };
  lowStockItems: LowStockItem[];
  deadStockItems: DeadStockItem[];
  purchasesBySupplier: SupplierPurchaseItem[];
}

const toNum = (val: any): number => {
  if (val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

export async function getInventoryAnalytics(
  params: FinancialAnalyticsParams
): Promise<InventoryAnalyticsResult> {
  const { tenantId, outletId, dateRange } = params;
  const timezone = params.timezone || dateRange.timezone || 'Asia/Jakarta';

  const scope = await resolveLaundryOutletScope(tenantId, outletId);
  const outletSlFilter = scope.sqlFilter('sl.outlet_id');
  const outletPoFilter = scope.sqlFilter('po.outlet_id');
  const outletLodFilter = scope.sqlFilter('lod.outlet_id');
  const outletOrderFilter = scope.sqlFilter('o.outlet_id');

  // 1. Total Berat Cucian (Tonnage) dan Valid Orders dalam Periode
  const tonnageRows = await prisma.$queryRaw<any[]>`
    SELECT 
      COALESCE(SUM(lod.total_weight_kg), 0) as total_weight_kg,
      COUNT(DISTINCT o.id)::int as valid_orders_count
    FROM laundry_order_details lod
    JOIN orders o ON lod.order_id = o.id
    WHERE lod.tenant_id = ${tenantId}
      ${outletLodFilter}
      AND lod.created_at >= ${dateRange.startDate}
      AND lod.created_at <= ${dateRange.endDate}
      AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'));
  `;
  const totalWeightKg = toNum(tonnageRows[0]?.total_weight_kg);
  const validOrdersCount = Number(tonnageRows[0]?.valid_orders_count || 0);

  // 2. Konsumsi Bahan Produksi (PRODUCTION_CONSUMPTION) & Penyusutan (Shrinkage)
  const ledgerRows = await prisma.$queryRaw<any[]>`
    SELECT 
      COALESCE(SUM(CASE WHEN il.movement_type = 'PRODUCTION_CONSUMPTION' THEN ABS(il.quantity_delta) * COALESCE(NULLIF(il.unit_cost, 0), ii.average_cost) ELSE 0 END), 0) as chemical_consumption_cost,
      COALESCE(SUM(CASE WHEN il.movement_type IN ('OPNAME_ADJUSTMENT', 'WASTE') AND il.quantity_delta < 0 THEN ABS(il.quantity_delta) * COALESCE(NULLIF(il.unit_cost, 0), ii.average_cost) ELSE 0 END), 0) as shrinkage_value
    FROM inventory_ledgers il
    JOIN inventory_items ii ON il.inventory_item_id = ii.id
    JOIN storage_locations sl ON il.storage_location_id = sl.id
    WHERE il.tenant_id = ${tenantId}
      ${outletSlFilter}
      AND il.created_at >= ${dateRange.startDate}
      AND il.created_at <= ${dateRange.endDate};
  `;
  const chemicalConsumptionCost = toNum(ledgerRows[0]?.chemical_consumption_cost);
  const shrinkageValue = Number(toNum(ledgerRows[0]?.shrinkage_value).toFixed(2));

  // Chemical Cost per Kg cucian
  const chemicalCostPerKg =
    totalWeightKg > 0
      ? Number((chemicalConsumptionCost / totalWeightKg).toFixed(2))
      : 0;

  // BoM Variance %: rasio penyusutan/pemborosan terhadap konsumsi
  const bomVariancePercent =
    chemicalConsumptionCost > 0
      ? Number(((shrinkageValue / chemicalConsumptionCost) * 100).toFixed(2))
      : 0;

  // 3. Valuasi Persediaan (Inventory Valuation) & Item Stok Kritis
  const balanceRows = await prisma.$queryRaw<any[]>`
    SELECT 
      ii.id as item_id,
      ii.item_code,
      ii.name,
      ii.canonical_uom,
      COALESCE(ii.average_cost, 0) as average_cost,
      COALESCE(ii.reorder_point, 0) as reorder_point,
      COALESCE(SUM(ib.quantity_on_hand), 0) as quantity_on_hand
    FROM inventory_items ii
    LEFT JOIN inventory_balances ib ON ii.id = ib.inventory_item_id
    LEFT JOIN storage_locations sl ON ib.storage_location_id = sl.id
    WHERE ii.tenant_id = ${tenantId}
      ${outletSlFilter}
      AND ii.is_active = true
    GROUP BY ii.id, ii.item_code, ii.name, ii.canonical_uom, ii.average_cost, ii.reorder_point;
  `;

  let inventoryValuation = 0;
  let lowStockCount = 0;
  const lowStockItems: LowStockItem[] = [];

  for (const b of balanceRows) {
    const qoh = toNum(b.quantity_on_hand);
    const avgCost = toNum(b.average_cost);
    const reorderPt = toNum(b.reorder_point);

    inventoryValuation += qoh * avgCost;

    if (reorderPt > 0 && qoh <= reorderPt) {
      lowStockCount++;
      const isCritical = qoh <= 0 || qoh <= reorderPt * 0.5;
      lowStockItems.push({
        itemId: String(b.item_id),
        itemCode: String(b.item_code),
        name: String(b.name),
        uom: String(b.canonical_uom),
        quantityOnHand: qoh,
        reorderPoint: reorderPt,
        averageCost: avgCost,
        status: isCritical ? 'CRITICAL' : 'LOW',
      });
    }
  }

  inventoryValuation = Number(inventoryValuation.toFixed(2));
  // Urutkan item stok menipis dari yang paling kritis
  lowStockItems.sort((a, b) => a.quantityOnHand - b.quantityOnHand);
  const topLowStock = lowStockItems.slice(0, 30);

  // 4. Dead Stock Items (Item dengan stok > 0 tetapi tidak ada mutasi dalam 60 hari terakhir)
  const deadStockCutoff = new Date(Date.now() - 60 * 86400 * 1000);
  const deadStockRows = await prisma.$queryRaw<any[]>`
    SELECT 
      ii.id as item_id,
      ii.item_code,
      ii.name,
      ii.canonical_uom,
      COALESCE(ii.average_cost, 0) as average_cost,
      COALESCE(SUM(ib.quantity_on_hand), 0) as quantity_on_hand,
      MAX(il.created_at) as last_movement_at
    FROM inventory_items ii
    JOIN inventory_balances ib ON ii.id = ib.inventory_item_id
    JOIN storage_locations sl ON ib.storage_location_id = sl.id
    LEFT JOIN inventory_ledgers il ON ii.id = il.inventory_item_id
    WHERE ii.tenant_id = ${tenantId}
      ${outletSlFilter}
      AND ii.is_active = true
    GROUP BY ii.id, ii.item_code, ii.name, ii.canonical_uom, ii.average_cost
    HAVING COALESCE(SUM(ib.quantity_on_hand), 0) > 0
      AND (MAX(il.created_at) IS NULL OR MAX(il.created_at) < ${deadStockCutoff})
    ORDER BY (COALESCE(SUM(ib.quantity_on_hand), 0) * COALESCE(ii.average_cost, 0)) DESC
    LIMIT 20;
  `;

  const deadStockItems: DeadStockItem[] = deadStockRows.map((d) => {
    const qoh = toNum(d.quantity_on_hand);
    const cost = toNum(d.average_cost);
    const lastDate = d.last_movement_at ? new Date(d.last_movement_at) : null;
    const daysInactive = lastDate
      ? Math.max(0, Math.floor((Date.now() - lastDate.getTime()) / (86400 * 1000)))
      : 999;
    return {
      itemId: String(d.item_id),
      itemCode: String(d.item_code),
      name: String(d.name),
      uom: String(d.canonical_uom),
      quantityOnHand: qoh,
      averageCost: cost,
      totalValue: Number((qoh * cost).toFixed(2)),
      lastMovementAt: lastDate ? lastDate.toISOString() : null,
      daysInactive,
    };
  });

  // 5. Pembelian per Supplier (Purchase Orders) dalam Periode
  const poRows = await prisma.$queryRaw<any[]>`
    SELECT 
      s.id as supplier_id,
      COALESCE(s.name, 'Supplier Langsung') as supplier_name,
      COUNT(po.id)::int as po_count,
      COALESCE(SUM(po.total_amount), 0) as total_amount
    FROM purchase_orders po
    JOIN suppliers s ON po.supplier_id = s.id
    WHERE po.tenant_id = ${tenantId}
      ${outletPoFilter}
      AND po.created_at >= ${dateRange.startDate}
      AND po.created_at <= ${dateRange.endDate}
      AND po.status != 'CANCELLED'
    GROUP BY s.id, s.name
    ORDER BY total_amount DESC;
  `;

  let purchaseOrderValue = 0;
  const purchasesBySupplier: SupplierPurchaseItem[] = poRows.map((p) => {
    const amt = toNum(p.total_amount);
    purchaseOrderValue += amt;
    return {
      supplierId: String(p.supplier_id),
      supplierName: String(p.supplier_name),
      poCount: Number(p.po_count || 0),
      totalAmount: amt,
    };
  });
  purchaseOrderValue = Number(purchaseOrderValue.toFixed(2));

  // 6. Packaging Cost per Order (Estimasi konsumsi item kemasan/plastik)
  const packagingRows = await prisma.$queryRaw<any[]>`
    SELECT 
      COALESCE(SUM(ABS(il.quantity_delta) * COALESCE(NULLIF(il.unit_cost, 0), ii.average_cost)), 0) as packaging_cost
    FROM inventory_ledgers il
    JOIN inventory_items ii ON il.inventory_item_id = ii.id
    JOIN storage_locations sl ON il.storage_location_id = sl.id
    WHERE il.tenant_id = ${tenantId}
      ${outletSlFilter}
      AND il.created_at >= ${dateRange.startDate}
      AND il.created_at <= ${dateRange.endDate}
      AND il.movement_type = 'PRODUCTION_CONSUMPTION'
      AND (
        LOWER(ii.name) LIKE '%plastik%'
        OR LOWER(ii.name) LIKE '%kresek%'
        OR LOWER(ii.name) LIKE '%kemasan%'
        OR LOWER(ii.canonical_uom) = 'pcs'
      );
  `;
  const packagingCost = toNum(packagingRows[0]?.packaging_cost);
  const packagingCostPerOrder =
    validOrdersCount > 0 ? Number((packagingCost / validOrdersCount).toFixed(2)) : 0;

  return {
    meta: {
      tenantId,
      outletId,
      preset: dateRange.preset,
      formattedRange: dateRange.formattedRange,
      timezone,
    },
    summary: {
      chemicalCostPerKg,
      inventoryValuation,
      lowStockCount,
      shrinkageValue,
      bomVariancePercent,
      purchaseOrderValue,
      packagingCostPerOrder,
    },
    lowStockItems: topLowStock,
    deadStockItems,
    purchasesBySupplier,
  };
}
