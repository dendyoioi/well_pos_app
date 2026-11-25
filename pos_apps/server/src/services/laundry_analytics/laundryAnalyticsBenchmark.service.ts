/**
 * Laundry Multi-Outlet Benchmark Analytics Service (Khusus OWNER)
 * Laundry Outlet Performance Intelligence (Well POS)
 * 
 * Mengimplementasikan komparasi performa multi-cabang (omzet, tonase, SLA, rating,
 * health score, alur transfer workshop ke satelit, fixed OPEX, dan pencapaian target bulanan)
 * sesuai spesifikasi Task W1-12 & W2-05.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { FinancialAnalyticsParams } from './laundryAnalyticsFinancial.service';
import { calculateHealthScore } from './laundryAnalyticsOverview.service';
import { resolveLaundryOutletScope } from './laundryOutletScope.helper';

export interface BenchmarkOutletItem {
  outletId: string;
  outletCode: string;
  outletName: string;
  isWorkshop: boolean;
  netRevenue: number;
  revenueSharePercent: number;
  totalValidOrders: number;
  totalWeightKg: number;
  onTimeCompletionRate: number;
  avgRating: number;
  complaintRate: number;
  incidentRate: number;
  healthScore: number;
  healthGrade: string;
  target?: {
    targetRevenue: number;
    targetProfit: number;
    targetWeightKg: number;
    targetOrdersCount: number;
    targetNewCustomers: number;
    revenueAchievementPercent: number;
    weightAchievementPercent: number;
  } | null;
}

export interface BenchmarkAnalyticsResult {
  meta: {
    tenantId: string;
    preset: string;
    formattedRange: {
      start: string;
      end: string;
      prevStart: string;
      prevEnd: string;
    };
    timezone: string;
  };
  consolidatedSummary: {
    totalOutlets: number;
    totalNetRevenue: number;
    totalValidOrders: number;
    totalWeightKg: number;
    avgOnTimeRate: number;
    avgHealthScore: number;
  };
  workshopSummary: {
    workshopCount: number;
    satelliteCount: number;
    totalManifests: number;
    totalOrdersTransferred: number;
    avgTransferLagHours: number;
  };
  targets: {
    availability: 'READY' | 'EMPTY';
    periodYear: number;
    periodMonth: number;
    totalTargetRevenue: number;
    totalTargetWeightKg: number;
    revenueAchievementPercent: number;
    weightAchievementPercent: number;
    note?: string;
  };
  outlets: BenchmarkOutletItem[];
}

const toNum = (val: any): number => {
  if (val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

export async function getBenchmarkAnalytics(
  params: FinancialAnalyticsParams
): Promise<BenchmarkAnalyticsResult> {
  const { tenantId, dateRange } = params;
  const timezone = params.timezone || dateRange.timezone || 'Asia/Jakarta';

  const scope = await resolveLaundryOutletScope(tenantId, 'ALL');

  // 1. Ambil seluruh outlet aktif milik tenant (khusus bertipe Laundry)
  const outletRows = await prisma.$queryRaw<any[]>`
    SELECT 
      o.id as outlet_id,
      COALESCE(o.code, 'OUTLET') as outlet_code,
      o.name as outlet_name,
      COALESCE(o.is_workshop, false) as is_workshop
    FROM outlets o
    LEFT JOIN businesses b ON o.business_id = b.id
    WHERE o.tenant_id = ${tenantId}
      AND o.is_active = true
      AND (
        b.vertical = 'LAUNDRY'
        OR o.industries::text ILIKE '%LAUNDRY%'
      )
    ORDER BY o.name ASC;
  `;

  // 2. Agregasi Penjualan & Tonase per Outlet
  const salesByOutletRows = await prisma.$queryRaw<any[]>`
    SELECT 
      o.outlet_id,
      COUNT(CASE WHEN (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED')) THEN o.id END)::int as valid_orders,
      COALESCE(SUM(CASE WHEN (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED')) THEN o.grand_total ELSE 0 END), 0) as accrual_total,
      COALESCE(SUM(CASE WHEN (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED')) THEN lod.total_weight_kg ELSE 0 END), 0) as total_weight_kg
    FROM orders o
    LEFT JOIN laundry_order_details lod ON o.id = lod.order_id
    WHERE o.tenant_id = ${tenantId}
      ${scope.sqlFilter('o.outlet_id')}
      AND o.created_at >= ${dateRange.startDate}
      AND o.created_at <= ${dateRange.endDate}
    GROUP BY o.outlet_id;
  `;

  // Refund per Outlet
  const refundByOutletRows = await prisma.$queryRaw<any[]>`
    SELECT 
      o.outlet_id,
      COALESCE(SUM(r.amount), 0) as refund_total
    FROM refunds r
    JOIN orders o ON r.order_id = o.id
    WHERE r.tenant_id = ${tenantId}
      ${scope.sqlFilter('o.outlet_id')}
      AND r.created_at >= ${dateRange.startDate}
      AND r.created_at <= ${dateRange.endDate}
    GROUP BY o.outlet_id;
  `;

  const refundMap = new Map<string, number>();
  for (const r of refundByOutletRows) {
    refundMap.set(String(r.outlet_id), toNum(r.refund_total));
  }

  const salesMap = new Map<string, { validOrders: number; netRevenue: number; weightKg: number }>();
  let totalConsolidatedRevenue = 0;
  let totalConsolidatedOrders = 0;
  let totalConsolidatedWeight = 0;

  for (const s of salesByOutletRows) {
    const oid = String(s.outlet_id);
    const accrual = toNum(s.accrual_total);
    const ref = refundMap.get(oid) || 0;
    const netRev = Math.max(0, accrual - ref);
    const vOrders = Number(s.valid_orders || 0);
    const wKg = toNum(s.total_weight_kg);

    salesMap.set(oid, {
      validOrders: vOrders,
      netRevenue: netRev,
      weightKg: wKg,
    });

    totalConsolidatedRevenue += netRev;
    totalConsolidatedOrders += vOrders;
    totalConsolidatedWeight += wKg;
  }

  // 3. SLA On-Time per Outlet
  const slaRows = await prisma.$queryRaw<any[]>`
    SELECT 
      lod.outlet_id,
      COUNT(lod.id)::int as due_orders,
      COUNT(CASE WHEN lod.completed_at IS NOT NULL AND lod.completed_at <= lod.estimated_ready_at THEN 1 END)::int as on_time_orders
    FROM laundry_order_details lod
    JOIN orders o ON lod.order_id = o.id
    WHERE lod.tenant_id = ${tenantId}
      ${scope.sqlFilter('lod.outlet_id')}
      AND lod.estimated_ready_at IS NOT NULL
      AND lod.estimated_ready_at >= ${dateRange.startDate}
      AND lod.estimated_ready_at <= ${dateRange.endDate}
      AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'))
    GROUP BY lod.outlet_id;
  `;
  const slaMap = new Map<string, { due: number; onTime: number }>();
  for (const sl of slaRows) {
    slaMap.set(String(sl.outlet_id), {
      due: Number(sl.due_orders || 0),
      onTime: Number(sl.on_time_orders || 0),
    });
  }

  // 4. Rating & Komplain per Outlet
  const feedbackRows = await prisma.$queryRaw<any[]>`
    SELECT 
      lcf.outlet_id,
      COALESCE(AVG(lcf.rating), 0) as avg_rating,
      COUNT(lcf.id)::int as total_feedbacks,
      COUNT(CASE WHEN lcf.is_complaint = true THEN 1 END)::int as complaint_count
    FROM laundry_customer_feedbacks lcf
    WHERE lcf.tenant_id = ${tenantId}
      ${scope.sqlFilter('lcf.outlet_id')}
      AND lcf.created_at >= ${dateRange.startDate}
      AND lcf.created_at <= ${dateRange.endDate}
    GROUP BY lcf.outlet_id;
  `;
  const feedbackMap = new Map<string, { avgRating: number; feedbacks: number; complaints: number }>();
  for (const f of feedbackRows) {
    feedbackMap.set(String(f.outlet_id), {
      avgRating: toNum(f.avg_rating),
      feedbacks: Number(f.total_feedbacks || 0),
      complaints: Number(f.complaint_count || 0),
    });
  }

  // 5. Insiden per Outlet
  const incidentRows = await prisma.$queryRaw<any[]>`
    SELECT 
      li.outlet_id,
      COUNT(li.id)::int as incident_count
    FROM laundry_incidents li
    WHERE li.tenant_id = ${tenantId}
      ${scope.sqlFilter('li.outlet_id')}
      AND li.created_at >= ${dateRange.startDate}
      AND li.created_at <= ${dateRange.endDate}
    GROUP BY li.outlet_id;
  `;
  const incidentMap = new Map<string, number>();
  for (const inc of incidentRows) {
    incidentMap.set(String(inc.outlet_id), Number(inc.incident_count || 0));
  }

  // 6. COGS BoM per Outlet (Penggunaan bahan baku produksi)
  const cogsRows = await prisma.$queryRaw<any[]>`
    SELECT 
      sl.outlet_id,
      COALESCE(SUM(ABS(il.quantity_delta) * COALESCE(NULLIF(il.unit_cost, 0), ii.average_cost, 0)), 0) as cogs_bom
    FROM inventory_ledgers il
    JOIN inventory_items ii ON il.inventory_item_id = ii.id
    JOIN storage_locations sl ON il.storage_location_id = sl.id
    WHERE il.tenant_id = ${tenantId}
      ${scope.sqlFilter('sl.outlet_id')}
      AND il.movement_type = 'PRODUCTION_CONSUMPTION'
      AND il.created_at >= ${dateRange.startDate}
      AND il.created_at <= ${dateRange.endDate}
    GROUP BY sl.outlet_id;
  `;
  const cogsMap = new Map<string, number>();
  for (const c of cogsRows) {
    cogsMap.set(String(c.outlet_id), toNum(c.cogs_bom));
  }

  // 7. Recorded OPEX per Outlet (Petty Cash Out + Incident Compensation + Fixed OPEX)
  const pettyCashRows = await prisma.$queryRaw<any[]>`
    SELECT 
      cm.outlet_id,
      COALESCE(SUM(cm.amount), 0) as petty_cash_out
    FROM cash_movements cm
    WHERE cm.tenant_id = ${tenantId}
      ${scope.sqlFilter('cm.outlet_id')}
      AND cm.type = 'CASH_OUT'
      AND cm.created_at >= ${dateRange.startDate}
      AND cm.created_at <= ${dateRange.endDate}
    GROUP BY cm.outlet_id;
  `;
  const pettyCashMap = new Map<string, number>();
  for (const pc of pettyCashRows) {
    pettyCashMap.set(String(pc.outlet_id), toNum(pc.petty_cash_out));
  }

  const incidentCompRows = await prisma.$queryRaw<any[]>`
    SELECT 
      li.outlet_id,
      COALESCE(SUM(li.approved_compensation), 0) as incident_compensation
    FROM laundry_incidents li
    WHERE li.tenant_id = ${tenantId}
      ${scope.sqlFilter('li.outlet_id')}
      AND li.created_at >= ${dateRange.startDate}
      AND li.created_at <= ${dateRange.endDate}
      AND li.status = 'COMPENSATED'
    GROUP BY li.outlet_id;
  `;
  const incidentCompMap = new Map<string, number>();
  for (const ic of incidentCompRows) {
    incidentCompMap.set(String(ic.outlet_id), toNum(ic.incident_compensation));
  }

  // Fixed OPEX per outlet dari operational_expenses
  const fixedOpexRows = await prisma.$queryRaw<any[]>`
    SELECT 
      oe.outlet_id,
      COALESCE(SUM(oe.amount), 0) as fixed_opex
    FROM operational_expenses oe
    WHERE oe.tenant_id = ${tenantId}
      ${scope.sqlFilter('oe.outlet_id')}
      AND oe.expense_date >= ${dateRange.startDate}
      AND oe.expense_date <= ${dateRange.endDate}
    GROUP BY oe.outlet_id;
  `;
  const fixedOpexMap = new Map<string, number>();
  for (const fo of fixedOpexRows) {
    fixedOpexMap.set(String(fo.outlet_id), toNum(fo.fixed_opex));
  }

  // 8. Query Target Bisnis Bulanan dari outlet_business_targets
  const [yearStr, monthStr] = dateRange.formattedRange.start.split('-');
  const periodYear = Number(yearStr);
  const periodMonth = Number(monthStr);

  const targetRows = await prisma.$queryRaw<any[]>`
    SELECT 
      obt.outlet_id,
      COALESCE(obt.target_revenue, 0) as target_revenue,
      COALESCE(obt.target_profit, 0) as target_profit,
      COALESCE(obt.target_weight_kg, 0) as target_weight_kg,
      COALESCE(obt.target_orders_count, 0) as target_orders_count,
      COALESCE(obt.target_new_customers, 0) as target_new_customers
    FROM outlet_business_targets obt
    WHERE obt.tenant_id = ${tenantId}
      ${scope.sqlFilter('obt.outlet_id')}
      AND obt.period_year = ${periodYear}
      AND obt.period_month = ${periodMonth};
  `;

  const targetMap = new Map<string, any>();
  let totalTargetRevenue = 0;
  let totalTargetWeightKg = 0;

  for (const t of targetRows) {
    targetMap.set(String(t.outlet_id), t);
    totalTargetRevenue += toNum(t.target_revenue);
    totalTargetWeightKg += toNum(t.target_weight_kg);
  }

  // 9. Susun Benchmark per Outlet
  const benchmarkOutlets: BenchmarkOutletItem[] = [];
  let sumOnTimeRates = 0;
  let sumHealthScores = 0;

  for (const out of outletRows) {
    const oid = String(out.outlet_id);
    const oCode = String(out.outlet_code);
    const oName = String(out.outlet_name);
    const isWks = Boolean(out.is_workshop);

    const s = salesMap.get(oid) || { validOrders: 0, netRevenue: 0, weightKg: 0 };
    const sla = slaMap.get(oid) || { due: 0, onTime: 0 };
    const fb = feedbackMap.get(oid) || { avgRating: 0, feedbacks: 0, complaints: 0 };
    const incCount = incidentMap.get(oid) || 0;

    const onTimeRate =
      sla.due > 0 ? Number(((sla.onTime / sla.due) * 100).toFixed(2)) : 100;
    const complaintRate =
      fb.feedbacks > 0 ? Number(((fb.complaints / fb.feedbacks) * 100).toFixed(2)) : 0;
    const incidentRate =
      s.validOrders > 0 ? Number(((incCount / s.validOrders) * 100).toFixed(2)) : 0;
    const revenueShare =
      totalConsolidatedRevenue > 0
        ? Number(((s.netRevenue / totalConsolidatedRevenue) * 100).toFixed(2))
        : 0;

    // Hitung margin laba aktual per outlet (netRevenue - COGS BoM - OPEX tercatat termasuk Fixed OPEX)
    const cogs = cogsMap.get(oid) || 0;
    const pettyOpex = pettyCashMap.get(oid) || 0;
    const incOpex = incidentCompMap.get(oid) || 0;
    const fixedOpex = fixedOpexMap.get(oid) || 0;
    const recordedOpex = pettyOpex + incOpex + fixedOpex;
    const operatingProfit = s.netRevenue - cogs - recordedOpex;
    const actualProfitMargin =
      s.netRevenue > 0 ? Number(((operatingProfit / s.netRevenue) * 100).toFixed(2)) : 0;

    // Kalkulasi Health Score untuk outlet ini
    const hs = calculateHealthScore({
      totalValidOrders: s.validOrders,
      profitMargin: actualProfitMargin,
      onTimeCompletionRate: onTimeRate,
      incidentRate,
      avgRating: fb.avgRating,
      hasRatingData: fb.feedbacks > 0,
    });

    sumOnTimeRates += onTimeRate;
    sumHealthScores += hs.score;

    // Target komparasi jika ada
    const t = targetMap.get(oid);
    const targetObj = t
      ? {
        targetRevenue: toNum(t.target_revenue),
        targetProfit: toNum(t.target_profit),
        targetWeightKg: toNum(t.target_weight_kg),
        targetOrdersCount: Number(t.target_orders_count || 0),
        targetNewCustomers: Number(t.target_new_customers || 0),
        revenueAchievementPercent:
          toNum(t.target_revenue) > 0
            ? Number(((s.netRevenue / toNum(t.target_revenue)) * 100).toFixed(1))
            : 0,
        weightAchievementPercent:
          toNum(t.target_weight_kg) > 0
            ? Number(((s.weightKg / toNum(t.target_weight_kg)) * 100).toFixed(1))
            : 0,
      }
      : null;

    benchmarkOutlets.push({
      outletId: oid,
      outletCode: oCode,
      outletName: oName,
      isWorkshop: isWks,
      netRevenue: s.netRevenue,
      revenueSharePercent: revenueShare,
      totalValidOrders: s.validOrders,
      totalWeightKg: Number(s.weightKg.toFixed(2)),
      onTimeCompletionRate: onTimeRate,
      avgRating: Number(fb.avgRating.toFixed(2)),
      complaintRate,
      incidentRate,
      healthScore: hs.score,
      healthGrade: hs.grade,
      target: targetObj,
    });
  }

  // Urutkan netRevenue DESC
  benchmarkOutlets.sort((a, b) => b.netRevenue - a.netRevenue);

  const totalOutlets = outletRows.length;
  const avgOnTimeRate =
    totalOutlets > 0 ? Number((sumOnTimeRates / totalOutlets).toFixed(2)) : 0;
  const avgHealthScore =
    totalOutlets > 0 ? Number((sumHealthScores / totalOutlets).toFixed(1)) : 0;

  // 10. Workshop vs Satellite Transfer Summary
  const workshopCount = outletRows.filter((o) => Boolean(o.is_workshop)).length;
  const satelliteCount = totalOutlets - workshopCount;

  const manifestRows = await prisma.$queryRaw<any[]>`
    SELECT 
      COUNT(ltm.id)::int as total_manifests,
      COALESCE(SUM(ltm.total_orders_count), 0)::int as total_orders_transferred,
      COALESCE(AVG(EXTRACT(EPOCH FROM (ltm.received_at - ltm.dispatched_at)) / 3600), 0) as avg_lag_hours
    FROM laundry_transfer_manifests ltm
    WHERE ltm.tenant_id = ${tenantId}
      AND ltm.dispatched_at >= ${dateRange.startDate}
      AND ltm.dispatched_at <= ${dateRange.endDate}
      AND ltm.status != 'CANCELLED';
  `;

  const totalManifests = Number(manifestRows[0]?.total_manifests || 0);
  const totalOrdersTransferred = Number(manifestRows[0]?.total_orders_transferred || 0);
  const avgTransferLagHours = Number(toNum(manifestRows[0]?.avg_lag_hours).toFixed(2));

  return {
    meta: {
      tenantId,
      preset: dateRange.preset,
      formattedRange: dateRange.formattedRange,
      timezone,
    },
    consolidatedSummary: {
      totalOutlets,
      totalNetRevenue: Number(totalConsolidatedRevenue.toFixed(2)),
      totalValidOrders: totalConsolidatedOrders,
      totalWeightKg: Number(totalConsolidatedWeight.toFixed(2)),
      avgOnTimeRate,
      avgHealthScore,
    },
    workshopSummary: {
      workshopCount,
      satelliteCount,
      totalManifests,
      totalOrdersTransferred,
      avgTransferLagHours,
    },
    targets: {
      availability: targetRows.length > 0 ? 'READY' : 'EMPTY',
      periodYear,
      periodMonth,
      totalTargetRevenue,
      totalTargetWeightKg,
      revenueAchievementPercent:
        totalTargetRevenue > 0
          ? Number(((totalConsolidatedRevenue / totalTargetRevenue) * 100).toFixed(1))
          : 0,
      weightAchievementPercent:
        totalTargetWeightKg > 0
          ? Number(((totalConsolidatedWeight / totalTargetWeightKg) * 100).toFixed(1))
          : 0,
      note:
        targetRows.length > 0
          ? undefined
          : 'Belum ada target bulanan yang diset untuk periode ini.',
    },
    outlets: benchmarkOutlets,
  };
}
