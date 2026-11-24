/**
 * Laundry Sales Analytics Service
 * Laundry Outlet Performance Intelligence (Well POS)
 * 
 * Mengimplementasikan analisis kontribusi Kiloan vs Satuan, layanan terlaris (Pareto),
 * performa kasir, dan heatmap jam/hari sibuk sesuai spesifikasi Task W1-06.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import {
  calculatePercentChange,
} from './dateRangeResolver.service';
import {
  FinancialAnalyticsParams,
  FinancialMetricComparison,
} from './laundryAnalyticsFinancial.service';

export interface SalesAnalyticsResult {
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
    totalValidOrders: FinancialMetricComparison;
    totalWeightKg: FinancialMetricComparison;
    totalPieces: FinancialMetricComparison;
    netRevenue: FinancialMetricComparison;
    averageOrderValue: FinancialMetricComparison;
    discountTotal: FinancialMetricComparison;
    discountPercentage: FinancialMetricComparison;
    cancelledCount: FinancialMetricComparison;
    voidedCount: FinancialMetricComparison;
    cancellationRate: FinancialMetricComparison;
    refundCount: FinancialMetricComparison;
    refundAmount: FinancialMetricComparison;
  };
  kiloanVsSatuan: {
    kiloan: {
      revenue: number;
      itemCount: number;
      orderCount: number;
      sharePercent: number;
    };
    satuan: {
      revenue: number;
      itemCount: number;
      orderCount: number;
      sharePercent: number;
    };
  };
  topServices: Array<{
    serviceId: string;
    serviceName: string;
    category: string;
    revenue: number;
    quantity: number;
    orderCount: number;
    sharePercent: number;
  }>;
  byCashier: Array<{
    cashierId: string;
    cashierName: string;
    validOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    voidedOrders: number;
    voidRate: number;
  }>;
  heatmap: Array<{
    dayOfWeek: number; // 0=Sun..6=Sat
    hour: number;      // 0..23
    orderCount: number;
    revenue: number;
  }>;
  byDay: Array<{
    dayOfWeek: number;
    dayName: string;
    orderCount: number;
    revenue: number;
  }>;
  byHour: Array<{
    hour: number;
    orderCount: number;
    revenue: number;
  }>;
  topPerfumes: Array<{
    perfumeVariant: string;
    orderCount: number;
    totalWeightKg: number;
  }>;
  addonsSummary: {
    totalAddonsRevenue: number;
    totalAddonsUsageCount: number;
    topAddons: Array<{
      name: string;
      count: number;
      revenue: number;
    }>;
  };
}

const toNum = (val: any): number => {
  if (val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

function buildMetricComparison(current: number, previous: number): FinancialMetricComparison {
  const p = calculatePercentChange(current, previous);
  return {
    current: Number(current.toFixed(2)),
    previous: Number(previous.toFixed(2)),
    diff: p.diff,
    percentChange: p.percent,
    direction: p.direction,
  };
}

async function fetchPeriodSalesTotals(
  tenantId: string,
  outletId: string | 'ALL',
  start: Date,
  end: Date
) {
  const outletOrderFilter =
    outletId !== 'ALL' ? Prisma.sql`AND o.outlet_id = ${outletId}` : Prisma.empty;

  // Orders summary (valid, cancelled, voided)
  const rows = await prisma.$queryRaw<any[]>`
    SELECT 
      COUNT(CASE WHEN (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED')) THEN o.id END) as valid_orders,
      COUNT(CASE WHEN o.order_status = 'CANCELLED' THEN o.id END) as cancelled_orders,
      COUNT(CASE WHEN o.order_status = 'VOIDED' THEN o.id END) as voided_orders,
      COUNT(o.id) as all_orders,
      COALESCE(SUM(CASE WHEN (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED')) THEN o.subtotal + o.tax_amount + COALESCE(o.service_total, 0) ELSE 0 END), 0) as gross_revenue,
      COALESCE(SUM(CASE WHEN (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED')) THEN o.discount_amount + o.point_discount_amount ELSE 0 END), 0) as discount_total,
      COALESCE(SUM(CASE WHEN (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED')) THEN o.grand_total ELSE 0 END), 0) as accrual_order_total,
      COALESCE(SUM(CASE WHEN (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED')) THEN lod.total_weight_kg ELSE 0 END), 0) as total_weight_kg,
      COALESCE(SUM(CASE WHEN (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED')) THEN lod.total_pieces ELSE 0 END), 0) as total_pieces
    FROM orders o
    LEFT JOIN laundry_order_details lod ON o.id = lod.order_id
    WHERE o.tenant_id = ${tenantId}
      ${outletOrderFilter}
      AND o.created_at >= ${start}
      AND o.created_at <= ${end};
  `;

  // Refunds
  const refundRows = await prisma.$queryRaw<any[]>`
    SELECT 
      COUNT(r.id) as refund_count,
      COALESCE(SUM(r.amount), 0) as refund_total
    FROM refunds r
    JOIN orders o ON r.order_id = o.id
    WHERE o.tenant_id = ${tenantId}
      ${outletOrderFilter}
      AND r.created_at >= ${start}
      AND r.created_at <= ${end};
  `;

  const validOrders = Number(rows[0]?.valid_orders || 0);
  const cancelledCount = Number(rows[0]?.cancelled_orders || 0);
  const voidedCount = Number(rows[0]?.voided_orders || 0);
  const allOrders = Number(rows[0]?.all_orders || 0);
  const grossRevenue = toNum(rows[0]?.gross_revenue);
  const discountTotal = toNum(rows[0]?.discount_total);
  const accrualOrderTotal = toNum(rows[0]?.accrual_order_total);
  const totalWeightKg = toNum(rows[0]?.total_weight_kg);
  const totalPieces = Number(rows[0]?.total_pieces || 0);

  const refundCount = Number(refundRows[0]?.refund_count || 0);
  const refundAmount = toNum(refundRows[0]?.refund_total);

  const netRevenue = accrualOrderTotal - refundAmount;
  const averageOrderValue = validOrders > 0 ? Math.round(netRevenue / validOrders) : 0;
  const discountPercentage = grossRevenue > 0 ? Number(((discountTotal / grossRevenue) * 100).toFixed(2)) : 0;
  const cancellationRate = allOrders > 0 ? Number((((cancelledCount + voidedCount) / allOrders) * 100).toFixed(2)) : 0;

  return {
    validOrders,
    cancelledCount,
    voidedCount,
    allOrders,
    grossRevenue,
    discountTotal,
    discountPercentage,
    totalWeightKg,
    totalPieces,
    netRevenue,
    averageOrderValue,
    cancellationRate,
    refundCount,
    refundAmount,
  };
}

export async function getSalesAnalytics(
  params: FinancialAnalyticsParams
): Promise<SalesAnalyticsResult> {
  const { tenantId, outletId, dateRange } = params;
  const timezone = params.timezone || dateRange.timezone || 'Asia/Jakarta';

  const outletOrderFilter =
    outletId !== 'ALL' ? Prisma.sql`AND o.outlet_id = ${outletId}` : Prisma.empty;
  const outletLodFilter =
    outletId !== 'ALL' ? Prisma.sql`AND lod.outlet_id = ${outletId}` : Prisma.empty;

  // 1. Kueri Ringkasan Penjualan Periode Berjalan vs Lalu
  const [curr, prev] = await Promise.all([
    fetchPeriodSalesTotals(tenantId, outletId, dateRange.startDate, dateRange.endDate),
    fetchPeriodSalesTotals(tenantId, outletId, dateRange.prevStartDate, dateRange.prevEndDate),
  ]);

  // 2. Split Omzet Kiloan vs Satuan
  const splitRows = await prisma.$queryRaw<any[]>`
    SELECT 
      resolved_basis,
      COALESCE(SUM(subtotal), 0) as total_revenue,
      COALESCE(SUM(quantity), 0) as total_quantity,
      COUNT(DISTINCT order_id) as total_orders
    FROM (
      SELECT 
        CASE 
          WHEN UPPER(COALESCE(oi.pricing_basis, '')) = 'KILOAN' THEN 'KILOAN'
          WHEN UPPER(COALESCE(oi.pricing_basis, '')) = 'SATUAN' THEN 'SATUAN'
          WHEN UPPER(COALESCE(oi.unit, '')) = 'KG' THEN 'KILOAN'
          ELSE 'SATUAN'
        END as resolved_basis,
        oi.subtotal,
        oi.quantity,
        oi.order_id
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.tenant_id = ${tenantId}
        ${outletOrderFilter}
        AND o.created_at >= ${dateRange.startDate}
        AND o.created_at <= ${dateRange.endDate}
        AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'))
    ) sub
    GROUP BY resolved_basis;
  `;

  let kiloanRev = 0, kiloanItems = 0, kiloanOrders = 0;
  let satuanRev = 0, satuanItems = 0, satuanOrders = 0;

  for (const row of splitRows) {
    if (row.resolved_basis === 'KILOAN') {
      kiloanRev = toNum(row.total_revenue);
      kiloanItems = toNum(row.total_quantity);
      kiloanOrders = Number(row.total_orders);
    } else {
      satuanRev = toNum(row.total_revenue);
      satuanItems = toNum(row.total_quantity);
      satuanOrders = Number(row.total_orders);
    }
  }

  const combinedItemRev = kiloanRev + satuanRev;
  const kiloanShare = combinedItemRev > 0 ? Number(((kiloanRev / combinedItemRev) * 100).toFixed(2)) : 0;
  const satuanShare = combinedItemRev > 0 ? Number(((satuanRev / combinedItemRev) * 100).toFixed(2)) : 0;

  // 3. Top 10 Layanan Terlaris (Pareto)
  const topServiceRows = await prisma.$queryRaw<any[]>`
    SELECT 
      service_id,
      service_name,
      category,
      COALESCE(SUM(subtotal), 0) as revenue,
      COALESCE(SUM(quantity), 0) as quantity,
      COUNT(DISTINCT order_id) as order_count
    FROM (
      SELECT 
        COALESCE(ls.id, oi.laundry_service_id, oi.product_variant_id, oi.id) as service_id,
        COALESCE(ls.name, oi.product_name, 'Layanan Tidak Diketahui') as service_name,
        COALESCE(ls.category, oi.pricing_basis, 'LAINNYA') as category,
        oi.subtotal,
        oi.quantity,
        oi.order_id
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN laundry_services ls ON oi.laundry_service_id = ls.id
      WHERE o.tenant_id = ${tenantId}
        ${outletOrderFilter}
        AND o.created_at >= ${dateRange.startDate}
        AND o.created_at <= ${dateRange.endDate}
        AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'))
    ) sub
    GROUP BY service_id, service_name, category
    ORDER BY revenue DESC
    LIMIT 10;
  `;

  const topServices = topServiceRows.map((r) => {
    const rev = toNum(r.revenue);
    return {
      serviceId: String(r.service_id),
      serviceName: String(r.service_name),
      category: String(r.category),
      revenue: rev,
      quantity: toNum(r.quantity),
      orderCount: Number(r.order_count),
      sharePercent: combinedItemRev > 0 ? Number(((rev / combinedItemRev) * 100).toFixed(2)) : 0,
    };
  });

  // 4. Performa Penjualan per Kasir
  const cashierRows = await prisma.$queryRaw<any[]>`
    SELECT 
      o.cashier_id,
      COALESCE(u.name, 'Kasir') as cashier_name,
      COUNT(CASE WHEN (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED')) THEN o.id END) as valid_orders,
      COALESCE(SUM(CASE WHEN (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED')) THEN o.grand_total ELSE 0 END), 0) as total_revenue,
      COUNT(CASE WHEN o.order_status = 'VOIDED' THEN o.id END) as voided_orders,
      COUNT(o.id) as total_orders
    FROM orders o
    LEFT JOIN users u ON o.cashier_id = u.id
    WHERE o.tenant_id = ${tenantId}
      ${outletOrderFilter}
      AND o.created_at >= ${dateRange.startDate}
      AND o.created_at <= ${dateRange.endDate}
    GROUP BY o.cashier_id, u.name
    ORDER BY total_revenue DESC;
  `;

  const byCashier = cashierRows.map((c) => {
    const validOrders = Number(c.valid_orders);
    const totalRev = toNum(c.total_revenue);
    const voided = Number(c.voided_orders);
    const total = Number(c.total_orders);
    return {
      cashierId: String(c.cashier_id),
      cashierName: String(c.cashier_name),
      validOrders,
      totalRevenue: totalRev,
      averageOrderValue: validOrders > 0 ? Math.round(totalRev / validOrders) : 0,
      voidedOrders: voided,
      voidRate: total > 0 ? Number(((voided / total) * 100).toFixed(2)) : 0,
    };
  });

  // 5. Heatmap Jam Sibuk & Hari Sibuk (WIB / outlet timezone)
  const heatmapRows = await prisma.$queryRaw<any[]>`
    SELECT 
      dow,
      hr,
      COUNT(id) as order_count,
      COALESCE(SUM(grand_total), 0) as revenue
    FROM (
      SELECT 
        o.id,
        o.grand_total,
        EXTRACT(DOW FROM o.created_at AT TIME ZONE ${timezone})::int as dow,
        EXTRACT(HOUR FROM o.created_at AT TIME ZONE ${timezone})::int as hr
      FROM orders o
      WHERE o.tenant_id = ${tenantId}
        ${outletOrderFilter}
        AND o.created_at >= ${dateRange.startDate}
        AND o.created_at <= ${dateRange.endDate}
        AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'))
    ) sub
    GROUP BY dow, hr;
  `;

  const heatmapGrid = new Map<string, { orderCount: number; revenue: number }>();
  const byDayMap = new Map<number, { orderCount: number; revenue: number }>();
  const byHourMap = new Map<number, { orderCount: number; revenue: number }>();

  for (let dow = 0; dow < 7; dow++) {
    byDayMap.set(dow, { orderCount: 0, revenue: 0 });
  }
  for (let hr = 0; hr < 24; hr++) {
    byHourMap.set(hr, { orderCount: 0, revenue: 0 });
  }

  for (const r of heatmapRows) {
    const dow = Number(r.dow);
    const hr = Number(r.hr);
    const cnt = Number(r.order_count);
    const rev = toNum(r.revenue);

    heatmapGrid.set(`${dow}:${hr}`, { orderCount: cnt, revenue: rev });

    const dayObj = byDayMap.get(dow)!;
    dayObj.orderCount += cnt;
    dayObj.revenue += rev;

    const hrObj = byHourMap.get(hr)!;
    hrObj.orderCount += cnt;
    hrObj.revenue += rev;
  }

  const heatmap: SalesAnalyticsResult['heatmap'] = [];
  for (let dow = 0; dow < 7; dow++) {
    for (let hr = 0; hr < 24; hr++) {
      const entry = heatmapGrid.get(`${dow}:${hr}`) || { orderCount: 0, revenue: 0 };
      heatmap.push({
        dayOfWeek: dow,
        hour: hr,
        orderCount: entry.orderCount,
        revenue: entry.revenue,
      });
    }
  }

  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const byDay = dayNames.map((dayName, dow) => {
    const entry = byDayMap.get(dow)!;
    return {
      dayOfWeek: dow,
      dayName,
      orderCount: entry.orderCount,
      revenue: entry.revenue,
    };
  });

  const byHour: SalesAnalyticsResult['byHour'] = [];
  for (let hr = 0; hr < 24; hr++) {
    const entry = byHourMap.get(hr)!;
    byHour.push({
      hour: hr,
      orderCount: entry.orderCount,
      revenue: entry.revenue,
    });
  }

  // 6. Top Parfums
  const perfumeRows = await prisma.$queryRaw<any[]>`
    SELECT 
      lod.perfume_variant,
      COUNT(o.id) as order_count,
      COALESCE(SUM(lod.total_weight_kg), 0) as total_weight_kg
    FROM laundry_order_details lod
    JOIN orders o ON lod.order_id = o.id
    WHERE lod.tenant_id = ${tenantId}
      ${outletLodFilter}
      AND o.created_at >= ${dateRange.startDate}
      AND o.created_at <= ${dateRange.endDate}
      AND lod.perfume_variant IS NOT NULL 
      AND TRIM(lod.perfume_variant) != ''
      AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'))
    GROUP BY lod.perfume_variant
    ORDER BY order_count DESC
    LIMIT 10;
  `;

  const topPerfumes = perfumeRows.map((p) => ({
    perfumeVariant: String(p.perfume_variant),
    orderCount: Number(p.order_count),
    totalWeightKg: toNum(p.total_weight_kg),
  }));

  // 7. Add-ons Summary (Ekstraksi aman dari JSON addons_snapshot)
  const addonsRows = await prisma.$queryRaw<any[]>`
    SELECT oi.addons_snapshot
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE o.tenant_id = ${tenantId}
      ${outletOrderFilter}
      AND o.created_at >= ${dateRange.startDate}
      AND o.created_at <= ${dateRange.endDate}
      AND oi.addons_snapshot IS NOT NULL
      AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'));
  `;

  let totalAddonsRevenue = 0;
  let totalAddonsUsageCount = 0;
  const addonMap = new Map<string, { count: number; revenue: number }>();

  for (const r of addonsRows) {
    let addonsArr: any[] = [];
    if (Array.isArray(r.addons_snapshot)) {
      addonsArr = r.addons_snapshot;
    } else if (typeof r.addons_snapshot === 'string') {
      try {
        const parsed = JSON.parse(r.addons_snapshot);
        if (Array.isArray(parsed)) addonsArr = parsed;
      } catch {
        // Abaikan format string tidak valid
      }
    }

    for (const addon of addonsArr) {
      if (!addon || typeof addon !== 'object') continue;
      const name = addon.name || addon.title || 'Add-on';
      const price = toNum(addon.price || addon.unitPrice || addon.amount || 0);
      const qty = toNum(addon.quantity || addon.qty || 1);
      const rev = price * qty;

      totalAddonsRevenue += rev;
      totalAddonsUsageCount += qty;

      const existing = addonMap.get(name) || { count: 0, revenue: 0 };
      existing.count += qty;
      existing.revenue += rev;
      addonMap.set(name, existing);
    }
  }

  const topAddons = Array.from(addonMap.entries())
    .map(([name, data]) => ({ name, count: data.count, revenue: data.revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  return {
    meta: {
      tenantId,
      outletId,
      preset: dateRange.preset,
      formattedRange: dateRange.formattedRange,
      timezone,
    },
    summary: {
      totalValidOrders: buildMetricComparison(curr.validOrders, prev.validOrders),
      totalWeightKg: buildMetricComparison(curr.totalWeightKg, prev.totalWeightKg),
      totalPieces: buildMetricComparison(curr.totalPieces, prev.totalPieces),
      netRevenue: buildMetricComparison(curr.netRevenue, prev.netRevenue),
      averageOrderValue: buildMetricComparison(curr.averageOrderValue, prev.averageOrderValue),
      discountTotal: buildMetricComparison(curr.discountTotal, prev.discountTotal),
      discountPercentage: buildMetricComparison(curr.discountPercentage, prev.discountPercentage),
      cancelledCount: buildMetricComparison(curr.cancelledCount, prev.cancelledCount),
      voidedCount: buildMetricComparison(curr.voidedCount, prev.voidedCount),
      cancellationRate: buildMetricComparison(curr.cancellationRate, prev.cancellationRate),
      refundCount: buildMetricComparison(curr.refundCount, prev.refundCount),
      refundAmount: buildMetricComparison(curr.refundAmount, prev.refundAmount),
    },
    kiloanVsSatuan: {
      kiloan: {
        revenue: kiloanRev,
        itemCount: kiloanItems,
        orderCount: kiloanOrders,
        sharePercent: kiloanShare,
      },
      satuan: {
        revenue: satuanRev,
        itemCount: satuanItems,
        orderCount: satuanOrders,
        sharePercent: satuanShare,
      },
    },
    topServices,
    byCashier,
    heatmap,
    byDay,
    byHour,
    topPerfumes,
    addonsSummary: {
      totalAddonsRevenue,
      totalAddonsUsageCount,
      topAddons,
    },
  };
}
