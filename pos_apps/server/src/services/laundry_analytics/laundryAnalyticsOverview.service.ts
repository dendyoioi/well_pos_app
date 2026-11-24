/**
 * Laundry Executive Overview & Deterministic Health Score Service
 * Laundry Outlet Performance Intelligence (Well POS)
 * 
 * Mengagregasi data ringkasan eksekutif L1 (Pulse Finansial, Operasional, Pelanggan),
 * menghitung skor kesehatan outlet deterministik (0 - 100), dan mengevaluasi
 * Top 5 Alert Rules peringatan dini secara aman tanpa error division-by-zero.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import {
  getFinancialAnalytics,
  FinancialAnalyticsParams,
  FinancialAnalyticsResult,
  FinancialMetricComparison,
} from './laundryAnalyticsFinancial.service';

export interface AlertItem {
  ruleKey: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  message: string;
  actionLabel: string;
  actionTarget: string;
}

export interface ExecutiveOverviewResult {
  meta: FinancialAnalyticsResult['meta'];
  healthScore: {
    score: number;
    grade: 'SANGAT_SEHAT' | 'SEHAT' | 'WASPADA' | 'KRITIS' | 'BELUM_ADA_DATA';
    availability: 'CALCULATED' | 'EMPTY';
    pillars: {
      profitMarginScore: number;
      slaOnTimeScore: number;
      retentionScore: number;
      satisfactionScore: number;
    };
  };
  financialPulse: {
    netRevenue: FinancialMetricComparison;
    realCashIn: FinancialMetricComparison;
    operatingProfit: {
      current: number;
      previous: number;
      diff: number;
      percentChange: number;
      direction: 'UP' | 'DOWN' | 'NEUTRAL';
      availability: 'READY' | 'PARTIAL';
    };
    profitMarginPercent: {
      current: number;
      previous: number;
      diff: number;
      percentChange: number;
      direction: 'UP' | 'DOWN' | 'NEUTRAL';
      availability: 'READY' | 'PARTIAL';
    };
    netCashFlow: {
      current: number;
      previous: number;
      diff: number;
      percentChange: number;
      direction: 'UP' | 'DOWN' | 'NEUTRAL';
      availability: 'READY' | 'PARTIAL';
    };
    cogsBom: FinancialMetricComparison;
    recordedOpex: {
      current: number;
      previous: number;
      diff: number;
      percentChange: number;
      direction: 'UP' | 'DOWN' | 'NEUTRAL';
      availability: 'READY' | 'PARTIAL';
    };
  };
  targetSummary?: {
    targetRevenue: number;
    actualRevenue: number;
    revenueAchievementPercent: number;
    availability: 'READY' | 'EMPTY';
  };
  operationalPulse: {
    totalValidOrders: number;
    totalWeightKg: number;
    totalPieces: number;
    averageOrderValue: number;
    onTimeCompletionRate: number;
    overdueOrdersCount: number;
    activeQueueCount: number;
    incidentCount: number;
    incidentRate: number;
  };
  customerPulse: {
    activeCustomersCount: number;
    newCustomersCount: number;
    returningCustomersCount: number;
    repeatCustomerRate: number;
    avgRating: number;
    ratingCount: number;
  };
  alerts: AlertItem[];
  revenueSeries: FinancialAnalyticsResult['revenueSeries'];
}

const toNum = (val: any): number => {
  if (val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

export function calculateHealthScore(params: {
  totalValidOrders: number;
  profitMargin: number;
  onTimeCompletionRate: number;
  repeatCustomerRate?: number;
  avgRating?: number;
  incidentRate?: number;
  hasRatingData?: boolean;
}): ExecutiveOverviewResult['healthScore'] {
  const {
    totalValidOrders,
    profitMargin,
    onTimeCompletionRate,
    repeatCustomerRate = 0,
    avgRating = 0,
    incidentRate = 0,
  } = params;

  if (totalValidOrders === 0) {
    return {
      score: 0,
      grade: 'BELUM_ADA_DATA',
      availability: 'EMPTY',
      pillars: {
        profitMarginScore: 0,
        slaOnTimeScore: 0,
        retentionScore: 0,
        satisfactionScore: 0,
      },
    };
  }

  const profitMarginScore = Math.min(100, Math.max(0, profitMargin * 2));
  const slaOnTimeScore = Math.min(100, Math.max(0, onTimeCompletionRate));
  const retentionScore = Math.min(100, Math.max(0, repeatCustomerRate * 2));
  const satisfactionScore =
    avgRating > 0
      ? Math.max(0, Math.min(100, (avgRating / 5) * 100 - incidentRate * 20))
      : Math.max(0, 100 - incidentRate * 20);

  const score = Math.round(
    0.30 * profitMarginScore +
    0.30 * slaOnTimeScore +
    0.20 * retentionScore +
    0.20 * satisfactionScore
  );

  let grade: 'SANGAT_SEHAT' | 'SEHAT' | 'WASPADA' | 'KRITIS' = 'KRITIS';
  if (score >= 85) grade = 'SANGAT_SEHAT';
  else if (score >= 70) grade = 'SEHAT';
  else if (score >= 55) grade = 'WASPADA';
  else grade = 'KRITIS';

  return {
    score,
    grade,
    availability: 'CALCULATED',
    pillars: {
      profitMarginScore: Number(profitMarginScore.toFixed(1)),
      slaOnTimeScore: Number(slaOnTimeScore.toFixed(1)),
      retentionScore: Number(retentionScore.toFixed(1)),
      satisfactionScore: Number(satisfactionScore.toFixed(1)),
    },
  };
}

export async function getExecutiveOverview(
  params: FinancialAnalyticsParams
): Promise<ExecutiveOverviewResult> {
  const { tenantId, outletId, dateRange } = params;

  // 1. Ambil data finansial melalui getFinancialAnalytics agar angka 100% konsisten
  const financial = await getFinancialAnalytics(params);

  const outletOrderFilter =
    outletId !== 'ALL' ? Prisma.sql`AND o.outlet_id = ${outletId}` : Prisma.empty;
  const outletLiFilter =
    outletId !== 'ALL' ? Prisma.sql`AND li.outlet_id = ${outletId}` : Prisma.empty;
  const outletLcfFilter =
    outletId !== 'ALL' ? Prisma.sql`AND lcf.outlet_id = ${outletId}` : Prisma.empty;
  const outletLodFilter =
    outletId !== 'ALL' ? Prisma.sql`AND lod.outlet_id = ${outletId}` : Prisma.empty;
  const outletStorageFilter =
    outletId !== 'ALL'
      ? Prisma.sql`JOIN storage_locations sl ON ib.storage_location_id = sl.id AND sl.outlet_id = ${outletId}`
      : Prisma.empty;

  // 2. Kueri Operasional Periode Berjalan
  const orderOpRows = await prisma.$queryRaw<any[]>`
    SELECT 
      COUNT(o.id) as total_valid_orders,
      COALESCE(SUM(lod.total_weight_kg), 0) as total_weight_kg,
      COALESCE(SUM(lod.total_pieces), 0) as total_pieces
    FROM orders o
    LEFT JOIN laundry_order_details lod ON o.id = lod.order_id
    WHERE o.tenant_id = ${tenantId}
      ${outletOrderFilter}
      AND o.created_at >= ${dateRange.startDate}
      AND o.created_at <= ${dateRange.endDate}
      AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'));
  `;
  const totalValidOrders = Number(orderOpRows[0]?.total_valid_orders || 0);
  const totalWeightKg = toNum(orderOpRows[0]?.total_weight_kg);
  const totalPieces = Number(orderOpRows[0]?.total_pieces || 0);

  const averageOrderValue =
    totalValidOrders > 0
      ? Math.round(financial.revenue.netRevenue.current / totalValidOrders)
      : 0;

  // SLA On-Time Completion Rate (Order yang jatuh tempo pada periode berjalan)
  const slaRows = await prisma.$queryRaw<any[]>`
    SELECT 
      COUNT(lod.id) as due_orders_count,
      COUNT(CASE WHEN lod.completed_at IS NOT NULL AND lod.completed_at <= lod.estimated_ready_at THEN 1 END) as on_time_orders_count
    FROM laundry_order_details lod
    JOIN orders o ON lod.order_id = o.id
    WHERE lod.tenant_id = ${tenantId}
      ${outletLodFilter}
      AND lod.estimated_ready_at >= ${dateRange.startDate}
      AND lod.estimated_ready_at <= ${dateRange.endDate}
      AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'));
  `;
  const dueOrdersCount = Number(slaRows[0]?.due_orders_count || 0);
  const onTimeOrdersCount = Number(slaRows[0]?.on_time_orders_count || 0);
  const onTimeCompletionRate =
    dueOrdersCount > 0
      ? Number(((onTimeOrdersCount / dueOrdersCount) * 100).toFixed(2))
      : 100;

  // Overdue Orders (Saat ini masih belum selesai dan sudah melewati estimated_ready_at)
  const overdueRows = await prisma.$queryRaw<any[]>`
    SELECT COUNT(lod.id) as overdue_orders_count
    FROM laundry_order_details lod
    JOIN orders o ON lod.order_id = o.id
    WHERE lod.tenant_id = ${tenantId}
      ${outletLodFilter}
      AND lod.completed_at IS NULL
      AND lod.estimated_ready_at < NOW()
      AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'));
  `;
  const overdueOrdersCount = Number(overdueRows[0]?.overdue_orders_count || 0);

  // Active Queue Count (Pesanan aktif belum diserahkan ke pelanggan)
  const queueRows = await prisma.$queryRaw<any[]>`
    SELECT COUNT(lod.id) as active_queue_count
    FROM laundry_order_details lod
    JOIN orders o ON lod.order_id = o.id
    WHERE lod.tenant_id = ${tenantId}
      ${outletLodFilter}
      AND (lod.current_stage IS NULL OR lod.current_stage NOT IN ('HANDOVER', 'COMPLETED'))
      AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'));
  `;
  const activeQueueCount = Number(queueRows[0]?.active_queue_count || 0);

  // Incidents
  const incidentRows = await prisma.$queryRaw<any[]>`
    SELECT COUNT(li.id) as incident_count
    FROM laundry_incidents li
    WHERE li.tenant_id = ${tenantId}
      ${outletLiFilter}
      AND li.created_at >= ${dateRange.startDate}
      AND li.created_at <= ${dateRange.endDate};
  `;
  const incidentCount = Number(incidentRows[0]?.incident_count || 0);
  const incidentRate =
    totalValidOrders > 0
      ? Number(((incidentCount / totalValidOrders) * 100).toFixed(2))
      : 0;

  // 3. Kueri Pelanggan
  // 3a. Active Customers (Transaksi dalam 30 hari terakhir)
  const activeCustRows = await prisma.$queryRaw<any[]>`
    SELECT COUNT(DISTINCT o.customer_id) as active_customers_count
    FROM orders o
    WHERE o.tenant_id = ${tenantId}
      ${outletOrderFilter}
      AND o.customer_id IS NOT NULL
      AND o.created_at >= NOW() - INTERVAL '30 days'
      AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'));
  `;
  const activeCustomersCount = Number(activeCustRows[0]?.active_customers_count || 0);

  // 3b. Pelanggan unik yang bertransaksi dalam rentang tanggal aktif
  const periodCustRows = await prisma.$queryRaw<any[]>`
    SELECT COUNT(DISTINCT o.customer_id) as distinct_customers_in_period
    FROM orders o
    WHERE o.tenant_id = ${tenantId}
      ${outletOrderFilter}
      AND o.customer_id IS NOT NULL
      AND o.created_at >= ${dateRange.startDate}
      AND o.created_at <= ${dateRange.endDate}
      AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'));
  `;
  const distinctCustomersInPeriod = Number(periodCustRows[0]?.distinct_customers_in_period || 0);

  // New Customers (Transaksi pertama kalinya terjadi dalam periode berjalan)
  const newCustRows = await prisma.$queryRaw<any[]>`
    SELECT COUNT(*) as new_customers_count
    FROM (
      SELECT o.customer_id, MIN(o.created_at) as first_order_at
      FROM orders o
      WHERE o.tenant_id = ${tenantId}
        ${outletOrderFilter}
        AND o.customer_id IS NOT NULL
        AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'))
      GROUP BY o.customer_id
      HAVING MIN(o.created_at) >= ${dateRange.startDate} AND MIN(o.created_at) <= ${dateRange.endDate}
    ) first_orders;
  `;
  const newCustomersCount = Number(newCustRows[0]?.new_customers_count || 0);
  const returningCustomersCount = Math.max(0, distinctCustomersInPeriod - newCustomersCount);

  // 3c. Repeat Customer Rate (% pelanggan dengan >= 2 pesanan)
  const repeatCustRows = await prisma.$queryRaw<any[]>`
    SELECT 
      COUNT(DISTINCT CASE WHEN order_count >= 2 THEN customer_id END) as repeat_customers,
      COUNT(DISTINCT customer_id) as total_customers
    FROM (
      SELECT o.customer_id, COUNT(o.id) as order_count
      FROM orders o
      WHERE o.tenant_id = ${tenantId}
        ${outletOrderFilter}
        AND o.customer_id IS NOT NULL
        AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'))
      GROUP BY o.customer_id
    ) c_orders;
  `;
  const repeatCustomers = Number(repeatCustRows[0]?.repeat_customers || 0);
  const totalCustomers = Number(repeatCustRows[0]?.total_customers || 0);
  const repeatCustomerRate =
    totalCustomers > 0
      ? Number(((repeatCustomers / totalCustomers) * 100).toFixed(2))
      : 0;

  // 3d. Feedback & Rating
  const feedbackRows = await prisma.$queryRaw<any[]>`
    SELECT 
      COALESCE(AVG(lcf.rating), 0) as avg_rating,
      COUNT(lcf.id) as rating_count
    FROM laundry_customer_feedbacks lcf
    WHERE lcf.tenant_id = ${tenantId}
      ${outletLcfFilter}
      AND lcf.created_at >= ${dateRange.startDate}
      AND lcf.created_at <= ${dateRange.endDate};
  `;
  const avgRating = Number(toNum(feedbackRows[0]?.avg_rating).toFixed(2));
  const ratingCount = Number(feedbackRows[0]?.rating_count || 0);

  // 3e. Low Stock Items (untuk evaluasi early warnings)
  const lowStockRows = await prisma.$queryRaw<any[]>`
    SELECT COUNT(DISTINCT ib.id) as low_stock_count
    FROM inventory_balances ib
    JOIN inventory_items ii ON ib.inventory_item_id = ii.id
    ${outletStorageFilter}
    WHERE ib.tenant_id = ${tenantId}
      AND ib.quantity_on_hand <= ii.reorder_point;
  `;
  const lowStockCount = Number(lowStockRows[0]?.low_stock_count || 0);

  // 4. Perhitungan Deterministik Outlet Health Score (0 - 100)
  const healthScore = calculateHealthScore({
    totalValidOrders,
    profitMargin: financial.profitability.profitMarginPercent.current,
    onTimeCompletionRate,
    repeatCustomerRate,
    avgRating,
    incidentRate,
    hasRatingData: ratingCount > 0,
  });

  // 5. Evaluasi Deterministik Top 5 Active Alerts
  const alerts: AlertItem[] = [];

  // Rule 1: Margin Keuntungan
  if (totalValidOrders > 0) {
    const margin = financial.profitability.profitMarginPercent.current;
    if (margin < 25) {
      alerts.push({
        ruleKey: 'PROFIT_MARGIN_CRITICAL',
        severity: 'CRITICAL',
        title: 'Margin Keuntungan Kritis (< 25%)',
        message: `Margin keuntungan saat ini berada di level ${margin}%. Evaluasi HPP bahan dan pengeluaran shift segera.`,
        actionLabel: 'Audit Finansial',
        actionTarget: '/laundry/business-summary?tab=financial',
      });
    } else if (margin < 40) {
      alerts.push({
        ruleKey: 'PROFIT_MARGIN_WARNING',
        severity: 'WARNING',
        title: 'Margin Keuntungan Menurun (< 40%)',
        message: `Margin keuntungan saat ini tercatat ${margin}%, di bawah ambang sehat 40%.`,
        actionLabel: 'Review Beban',
        actionTarget: '/laundry/business-summary?tab=financial',
      });
    }
  }

  // Rule 2: Ketepatan Waktu SLA
  if (dueOrdersCount > 0) {
    if (onTimeCompletionRate < 80) {
      alerts.push({
        ruleKey: 'SLA_ON_TIME_CRITICAL',
        severity: 'CRITICAL',
        title: 'Ketepatan Waktu SLA Kritis (< 80%)',
        message: `Hanya ${onTimeCompletionRate}% order selesai tepat waktu dari ${dueOrdersCount} pesanan jatuh tempo.`,
        actionLabel: 'Cek Antrean Mesin',
        actionTarget: '/laundry/business-summary?tab=operations',
      });
    } else if (onTimeCompletionRate < 90) {
      alerts.push({
        ruleKey: 'SLA_ON_TIME_WARNING',
        severity: 'WARNING',
        title: 'SLA Produksi di Bawah Target (< 90%)',
        message: `Pencapaian SLA tepat waktu sebesar ${onTimeCompletionRate}%. Periksa bottleneck di tahapan setrika/lipat.`,
        actionLabel: 'Audit Alur Kerja',
        actionTarget: '/laundry/business-summary?tab=operations',
      });
    }
  }

  // Rule 3: Pesanan Melewati Estimasi (Overdue)
  if (overdueOrdersCount > 0) {
    alerts.push({
      ruleKey: 'OVERDUE_ORDERS_ALERT',
      severity: overdueOrdersCount > 5 ? 'CRITICAL' : 'WARNING',
      title: `${overdueOrdersCount} Pesanan Melewati Batas Waktu`,
      message: `Terdapat ${overdueOrdersCount} nota aktif yang melewati estimasi selesai tanpa status selesai.`,
      actionLabel: 'Buka Antrean',
      actionTarget: '/laundry/orders?status=PROCESSING',
    });
  }

  // Rule 4: Stok Bahan Menipis
  if (lowStockCount > 0) {
    alerts.push({
      ruleKey: 'LOW_STOCK_ALERT',
      severity: 'WARNING',
      title: `${lowStockCount} Bahan Baku di Bawah Reorder Point`,
      message: `Terdapat ${lowStockCount} item persediaan yang mencapai batas minimum pemesanan ulang.`,
      actionLabel: 'Restock Bahan',
      actionTarget: '/laundry/business-summary?tab=inventory',
    });
  }

  // Rule 5: Tingkat Insiden / Komplain
  if (totalValidOrders > 0) {
    if (incidentRate > 2) {
      alerts.push({
        ruleKey: 'INCIDENT_RATE_CRITICAL',
        severity: 'CRITICAL',
        title: 'Tingkat Kerusakan/Komplain Kritis (> 2%)',
        message: `${incidentCount} insiden pakaian rusak/hilang terjadi dari ${totalValidOrders} pesanan (${incidentRate}%).`,
        actionLabel: 'Investigasi SOP',
        actionTarget: '/laundry/business-summary?tab=operations',
      });
    } else if (incidentRate > 1) {
      alerts.push({
        ruleKey: 'INCIDENT_RATE_WARNING',
        severity: 'WARNING',
        title: 'Peningkatan Komplain Produksi (> 1%)',
        message: `Tingkat insiden saat ini tercatat ${incidentRate}%. Lakukan evaluasi penanganan pakaian.`,
        actionLabel: 'Review Insiden',
        actionTarget: '/laundry/business-summary?tab=operations',
      });
    }
  }

  // Rule 6: Piutang Kasbon Tinggi
  const netRev = financial.revenue.netRevenue.current;
  const receivables = financial.balanceSheetSummary.outstandingReceivables;
  if (netRev > 0 && receivables > 0.15 * netRev) {
    alerts.push({
      ruleKey: 'HIGH_RECEIVABLES_WARNING',
      severity: 'WARNING',
      title: 'Piutang Kasbon Tinggi (> 15% Omset)',
      message: `Total piutang kasbon aktif Rp ${receivables.toLocaleString('id-ID')} melebihi 15% omset periode ini.`,
      actionLabel: 'Follow-up Kasbon',
      actionTarget: '/customers?tab=debts',
    });
  }

  // Rule 7: Rating Pelanggan
  if (ratingCount >= 3) {
    if (avgRating < 4.0) {
      alerts.push({
        ruleKey: 'CUSTOMER_RATING_CRITICAL',
        severity: 'CRITICAL',
        title: 'Rating Pelanggan Kritis (< 4.0)',
        message: `Rata-rata ulasan pelanggan adalah ⭐ ${avgRating} dari ${ratingCount} ulasan.`,
        actionLabel: 'Review Ulasan',
        actionTarget: '/laundry/business-summary?tab=customers',
      });
    } else if (avgRating < 4.5) {
      alerts.push({
        ruleKey: 'CUSTOMER_RATING_WARNING',
        severity: 'WARNING',
        title: 'Rating Pelanggan Menurun (< 4.5)',
        message: `Rata-rata ulasan pelanggan tercatat ⭐ ${avgRating}. Pantau feedback negatif.`,
        actionLabel: 'Cek Feedback',
        actionTarget: '/laundry/business-summary?tab=customers',
      });
    }
  }

  // Target Bisnis Bulanan untuk targetSummary
  const [yearStr, monthStr] = dateRange.formattedRange.start.split('-');
  const periodYear = Number(yearStr);
  const periodMonth = Number(monthStr);
  const targetOutletFilter =
    outletId !== 'ALL' ? Prisma.sql`AND obt.outlet_id = ${outletId}` : Prisma.empty;

  const targetRows = await prisma.$queryRaw<any[]>`
    SELECT 
      COALESCE(SUM(obt.target_revenue), 0) as total_target_revenue
    FROM outlet_business_targets obt
    WHERE obt.tenant_id = ${tenantId}
      ${targetOutletFilter}
      AND obt.period_year = ${periodYear}
      AND obt.period_month = ${periodMonth};
  `;
  const targetRevenueVal = toNum(targetRows[0]?.total_target_revenue);
  const targetSummary =
    targetRevenueVal > 0
      ? {
          targetRevenue: targetRevenueVal,
          actualRevenue: financial.revenue.netRevenue.current,
          revenueAchievementPercent: Number(
            ((financial.revenue.netRevenue.current / targetRevenueVal) * 100).toFixed(1)
          ),
          availability: 'READY' as const,
        }
      : undefined;

  // Ambil maksimal 5 alert teratas (urutkan CRITICAL sebelum WARNING)
  const severityWeight = { CRITICAL: 1, WARNING: 2, INFO: 3 };
  alerts.sort((a, b) => severityWeight[a.severity] - severityWeight[b.severity]);
  const topAlerts = alerts.slice(0, 5);

  return {
    meta: financial.meta,
    healthScore,
    targetSummary,
    financialPulse: {
      netRevenue: financial.revenue.netRevenue,
      realCashIn: financial.cashFlow.realCashIn,
      operatingProfit: financial.profitability.operatingProfit,
      profitMarginPercent: financial.profitability.profitMarginPercent,
      netCashFlow: financial.cashFlow.netCashFlow,
      cogsBom: financial.cogsAndProfit.cogsBom,
      recordedOpex: financial.opex.recordedOpex,
    },
    operationalPulse: {
      totalValidOrders,
      totalWeightKg,
      totalPieces,
      averageOrderValue,
      onTimeCompletionRate,
      overdueOrdersCount,
      activeQueueCount,
      incidentCount,
      incidentRate,
    },
    customerPulse: {
      activeCustomersCount,
      newCustomersCount,
      returningCustomersCount,
      repeatCustomerRate,
      avgRating,
      ratingCount,
    },
    alerts: topAlerts,
    revenueSeries: financial.revenueSeries,
  };
}
