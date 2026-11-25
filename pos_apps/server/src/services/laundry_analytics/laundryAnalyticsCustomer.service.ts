/**
 * Laundry Customer Retention & Win-Back Analytics Service
 * Laundry Outlet Performance Intelligence (Well POS)
 * 
 * Mengimplementasikan analisis retensi pelanggan, deteksi pelanggan pasif (dormant),
 * segmentasi RFM, efektivitas win-back WhatsApp, kepuasan rating & keluhan komplain,
 * serta wallet breakage sesuai spesifikasi Task W1-07.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { FinancialAnalyticsParams } from './laundryAnalyticsFinancial.service';
import { resolveLaundryOutletScope } from './laundryOutletScope.helper';

export interface CustomerAnalyticsParams extends FinancialAnalyticsParams {
  dormantDays?: number;
}

export interface DormantCustomerItem {
  customerId: string;
  name: string;
  phone: string | null;
  lastOrderAt: string | null;
  daysSinceLastOrder: number;
  totalOrders: number;
  totalSpent: number;
  lastWinbackSentAt: string | null;
}

export interface CustomerAnalyticsResult {
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
  overview: {
    totalCustomers: number;
    activeCustomersCount: number;
    newCustomersCount: number;
    returningCustomersCount: number;
    dormantCustomersCount: number;
    repeatCustomerRate: number;
    averageClv: number;
    averageVisitFrequencyDays: number;
    periodRetentionRate: number;
  };
  segments: {
    new: number;
    active: number;
    loyal: number;
    dormant: number;
    highValue: number;
  };
  config: {
    dormantDays: number;
    loyalMinOrders: number;
  };
  dormantList: DormantCustomerItem[];
  winbackStats: {
    contactedCount: number;
    returnedCount: number;
    conversionRate: number;
    availability: 'PARTIAL';
  };
  feedbackSummary: {
    avgRating: number;
    totalFeedbacks: number;
    complaintCount: number;
    complaintRate: number;
    fiveStarCount: number;
    googleRedirectCount: number;
    googleRedirectRate: number;
  };
  walletBreakage: {
    expiredAmount: number;
    expiredKg: number;
    totalTopupAmount: number;
    totalTopupKg: number;
  };
}

const toNum = (val: any): number => {
  if (val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

export async function getCustomerAnalytics(
  params: CustomerAnalyticsParams
): Promise<CustomerAnalyticsResult> {
  const { tenantId, outletId, dateRange } = params;
  const timezone = params.timezone || dateRange.timezone || 'Asia/Jakarta';

  // Validasi & clamp dormantDays (antara 7 dan 365 hari, default: 30)
  const rawDormant = Number(params.dormantDays);
  const dormantDays = isNaN(rawDormant)
    ? 30
    : Math.min(365, Math.max(7, Math.round(rawDormant)));

  const scope = await resolveLaundryOutletScope(tenantId, outletId);
  const outletOrderFilter = scope.sqlFilter('o.outlet_id');
  const outletLcfFilter = scope.sqlFilter('lcf.outlet_id');
  const outletClwlFilter = scope.sqlFilter('clwl.outlet_id');

  // 1. Total Pelanggan Terdaftar di Tenant
  const totalCustRow = await prisma.customer.count({
    where: { tenantId },
  });
  const totalCustomers = totalCustRow;

  // 2. Pelanggan Aktif dalam dormantDays Terakhir
  const activeCustRows = await prisma.$queryRaw<any[]>`
    SELECT COUNT(DISTINCT o.customer_id) as active_count
    FROM orders o
    WHERE o.tenant_id = ${tenantId}
      ${outletOrderFilter}
      AND o.customer_id IS NOT NULL
      AND o.created_at >= NOW() - (${dormantDays} * INTERVAL '1 day')
      AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'));
  `;
  const activeCustomersCount = Number(activeCustRows[0]?.active_count || 0);

  // 3. Pelanggan yang Bertransaksi dalam Periode Aktif
  const periodCustRows = await prisma.$queryRaw<any[]>`
    SELECT COUNT(DISTINCT o.customer_id) as period_customers
    FROM orders o
    WHERE o.tenant_id = ${tenantId}
      ${outletOrderFilter}
      AND o.customer_id IS NOT NULL
      AND o.created_at >= ${dateRange.startDate}
      AND o.created_at <= ${dateRange.endDate}
      AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'));
  `;
  const distinctCustomersInPeriod = Number(periodCustRows[0]?.period_customers || 0);

  // 4. New Customers (Transaksi pertama kalinya terjadi dalam rentang tanggal aktif)
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

  // 5. Dormant Customers (Pernah transaksi valid, tapi transaksi terakhir > dormantDays yang lalu)
  const dormantCountRows = await prisma.$queryRaw<any[]>`
    SELECT COUNT(*) as dormant_count
    FROM (
      SELECT o.customer_id, MAX(o.created_at) as last_order_at
      FROM orders o
      WHERE o.tenant_id = ${tenantId}
        ${outletOrderFilter}
        AND o.customer_id IS NOT NULL
        AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'))
      GROUP BY o.customer_id
      HAVING MAX(o.created_at) < NOW() - (${dormantDays} * INTERVAL '1 day')
    ) dormant_sub;
  `;
  const dormantCustomersCount = Number(dormantCountRows[0]?.dormant_count || 0);

  // 6. Repeat Customer Rate (% pelanggan dengan >= 2 pesanan seumur hidup)
  const repeatCustRows = await prisma.$queryRaw<any[]>`
    SELECT 
      COUNT(DISTINCT CASE WHEN order_count >= 2 THEN customer_id END) as repeat_customers,
      COUNT(DISTINCT customer_id) as total_distinct_customers
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
  const totalDistinctCustomers = Number(repeatCustRows[0]?.total_distinct_customers || 0);
  const repeatCustomerRate =
    totalDistinctCustomers > 0
      ? Number(((repeatCustomers / totalDistinctCustomers) * 100).toFixed(2))
      : 0;

  // 7. Average Customer Lifetime Value (CLV historis)
  const clvRows = await prisma.$queryRaw<any[]>`
    SELECT 
      COALESCE(SUM(o.grand_total), 0) as total_lifetime_spent,
      COUNT(DISTINCT o.customer_id) as unique_spending_customers
    FROM orders o
    WHERE o.tenant_id = ${tenantId}
      ${outletOrderFilter}
      AND o.customer_id IS NOT NULL
      AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'));
  `;
  const totalLifetimeSpent = toNum(clvRows[0]?.total_lifetime_spent);
  const uniqueSpendingCustomers = Number(clvRows[0]?.unique_spending_customers || 0);
  const averageClv =
    uniqueSpendingCustomers > 0
      ? Math.round(totalLifetimeSpent / uniqueSpendingCustomers)
      : 0;

  // 8. Rata-Rata Frekuensi Kunjungan (Jarak Hari Antar Order Berurutan)
  const frequencyRows = await prisma.$queryRaw<any[]>`
    WITH customer_intervals AS (
      SELECT 
        o.customer_id,
        o.created_at,
        LAG(o.created_at) OVER (PARTITION BY o.customer_id ORDER BY o.created_at) as prev_order_at
      FROM orders o
      WHERE o.tenant_id = ${tenantId}
        ${outletOrderFilter}
        AND o.customer_id IS NOT NULL
        AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'))
    )
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (created_at - prev_order_at)) / 86400), 0) as avg_frequency_days
    FROM customer_intervals
    WHERE prev_order_at IS NOT NULL;
  `;
  const averageVisitFrequencyDays = Number(
    toNum(frequencyRows[0]?.avg_frequency_days).toFixed(1)
  );

  // 9. Period Retention Rate (% pelanggan aktif di periode lalu yang kembali di periode aktif)
  const retentionRows = await prisma.$queryRaw<any[]>`
    WITH prev_customers AS (
      SELECT DISTINCT o.customer_id 
      FROM orders o
      WHERE o.tenant_id = ${tenantId}
        ${outletOrderFilter}
        AND o.customer_id IS NOT NULL
        AND o.created_at >= ${dateRange.prevStartDate}
        AND o.created_at <= ${dateRange.prevEndDate}
        AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'))
    ),
    curr_customers AS (
      SELECT DISTINCT o.customer_id 
      FROM orders o
      WHERE o.tenant_id = ${tenantId}
        ${outletOrderFilter}
        AND o.customer_id IS NOT NULL
        AND o.created_at >= ${dateRange.startDate}
        AND o.created_at <= ${dateRange.endDate}
        AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'))
    )
    SELECT 
      COUNT(p.customer_id) as prev_total,
      COUNT(c.customer_id) as retained_count
    FROM prev_customers p
    LEFT JOIN curr_customers c ON p.customer_id = c.customer_id;
  `;
  const prevCustTotal = Number(retentionRows[0]?.prev_total || 0);
  const retainedCount = Number(retentionRows[0]?.retained_count || 0);
  const periodRetentionRate =
    prevCustTotal > 0
      ? Number(((retainedCount / prevCustTotal) * 100).toFixed(2))
      : 0;

  // 10. Segmentasi Pelanggan (NEW, ACTIVE, LOYAL, DORMANT, HIGH_VALUE)
  const customerMetricsRows = await prisma.$queryRaw<any[]>`
    SELECT 
      o.customer_id,
      COUNT(o.id) as order_count,
      COALESCE(SUM(o.grand_total), 0) as total_spent,
      MIN(o.created_at) as first_order_at,
      MAX(o.created_at) as last_order_at
    FROM orders o
    WHERE o.tenant_id = ${tenantId}
      ${outletOrderFilter}
      AND o.customer_id IS NOT NULL
      AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'))
    GROUP BY o.customer_id;
  `;

  let segNew = 0, segActive = 0, segLoyal = 0, segDormant = 0;
  const spentList: number[] = [];
  const dormantCutoffTime = Date.now() - dormantDays * 86400 * 1000;
  const activePeriodStartTime = dateRange.startDate.getTime();
  const activePeriodEndTime = dateRange.endDate.getTime();

  for (const c of customerMetricsRows) {
    const totalSpent = toNum(c.total_spent);
    spentList.push(totalSpent);

    const firstTime = new Date(c.first_order_at).getTime();
    const lastTime = new Date(c.last_order_at).getTime();
    const orderCount = Number(c.order_count);

    if (firstTime >= activePeriodStartTime && firstTime <= activePeriodEndTime) {
      segNew++;
    }
    if (lastTime >= dormantCutoffTime) {
      segActive++;
    } else {
      segDormant++;
    }
    if (orderCount >= 5) {
      segLoyal++;
    }
  }

  // Hitung ambang batas 10% tertinggi untuk High Value
  spentList.sort((a, b) => b - a);
  const top10PercentIndex = Math.max(1, Math.floor(spentList.length * 0.10));
  const highValueThreshold = spentList[top10PercentIndex - 1] || 0;
  let segHighValue = 0;
  if (spentList.length > 0 && highValueThreshold > 0) {
    segHighValue = spentList.filter((s) => s >= highValueThreshold).length;
  }

  // 11. Daftar Pelanggan Pasif (Top 50 Dormant List)
  const dormantListRows = await prisma.$queryRaw<any[]>`
    SELECT 
      c.id as customer_id,
      c.name,
      c.phone,
      c.last_winback_sent_at,
      MAX(o.created_at) as last_order_at,
      ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(o.created_at))) / 86400)::int as days_since_last_order,
      COUNT(o.id)::int as total_orders,
      COALESCE(SUM(o.grand_total), 0) as total_spent
    FROM customers c
    JOIN orders o ON c.id = o.customer_id
    WHERE c.tenant_id = ${tenantId}
      ${outletOrderFilter}
      AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'))
    GROUP BY c.id, c.name, c.phone, c.last_winback_sent_at
    HAVING MAX(o.created_at) < NOW() - (${dormantDays} * INTERVAL '1 day')
    ORDER BY total_spent DESC, days_since_last_order DESC
    LIMIT 50;
  `;

  const dormantList: DormantCustomerItem[] = dormantListRows.map((r) => ({
    customerId: String(r.customer_id),
    name: String(r.name),
    phone: r.phone ? String(r.phone) : null,
    lastOrderAt: r.last_order_at ? new Date(r.last_order_at).toISOString() : null,
    daysSinceLastOrder: Number(r.days_since_last_order || 0),
    totalOrders: Number(r.total_orders || 0),
    totalSpent: toNum(r.total_spent),
    lastWinbackSentAt: r.last_winback_sent_at
      ? new Date(r.last_winback_sent_at).toISOString()
      : null,
  }));

  // 12. Konversi Win-Back
  const winbackRows = await prisma.$queryRaw<any[]>`
    SELECT 
      COUNT(DISTINCT c.id) as contacted_count,
      COUNT(DISTINCT CASE WHEN o.id IS NOT NULL THEN c.id END) as returned_count
    FROM customers c
    LEFT JOIN orders o ON c.id = o.customer_id 
      AND o.created_at > c.last_winback_sent_at
      AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'))
    WHERE c.tenant_id = ${tenantId}
      AND c.last_winback_sent_at IS NOT NULL;
  `;
  const contactedCount = Number(winbackRows[0]?.contacted_count || 0);
  const returnedCount = Number(winbackRows[0]?.returned_count || 0);
  const winbackConversionRate =
    contactedCount > 0
      ? Number(((returnedCount / contactedCount) * 100).toFixed(2))
      : 0;

  // 13. Feedback & Rating Summary
  const feedbackRows = await prisma.$queryRaw<any[]>`
    SELECT 
      COALESCE(AVG(lcf.rating), 0) as avg_rating,
      COUNT(lcf.id) as total_feedbacks,
      COUNT(CASE WHEN lcf.is_complaint = true THEN 1 END) as complaint_count,
      COUNT(CASE WHEN lcf.rating = 5 THEN 1 END) as five_star_count,
      COUNT(CASE WHEN lcf.redirected_to_google = true THEN 1 END) as google_redirect_count
    FROM laundry_customer_feedbacks lcf
    WHERE lcf.tenant_id = ${tenantId}
      ${outletLcfFilter}
      AND lcf.created_at >= ${dateRange.startDate}
      AND lcf.created_at <= ${dateRange.endDate};
  `;
  const avgRating = Number(toNum(feedbackRows[0]?.avg_rating).toFixed(2));
  const totalFeedbacks = Number(feedbackRows[0]?.total_feedbacks || 0);
  const complaintCount = Number(feedbackRows[0]?.complaint_count || 0);
  const fiveStarCount = Number(feedbackRows[0]?.five_star_count || 0);
  const googleRedirectCount = Number(feedbackRows[0]?.google_redirect_count || 0);
  const complaintRate =
    totalFeedbacks > 0
      ? Number(((complaintCount / totalFeedbacks) * 100).toFixed(2))
      : 0;
  const googleRedirectRate =
    fiveStarCount > 0
      ? Number(((googleRedirectCount / fiveStarCount) * 100).toFixed(2))
      : 0;

  // 14. Wallet Breakage & Expiration (dari customer_laundry_wallet_ledgers)
  const breakageRows = await prisma.$queryRaw<any[]>`
    SELECT 
      COALESCE(SUM(CASE WHEN clwl.ledger_type = 'EXPIRE' THEN clwl.delta_amount ELSE 0 END), 0) as expired_amount,
      COALESCE(SUM(CASE WHEN clwl.ledger_type = 'EXPIRE' THEN clwl.delta_kg ELSE 0 END), 0) as expired_kg,
      COALESCE(SUM(CASE WHEN clwl.ledger_type = 'TOPUP_BALANCE' THEN clwl.delta_amount ELSE 0 END), 0) as total_topup_amount,
      COALESCE(SUM(CASE WHEN clwl.ledger_type = 'TOPUP_QUOTA_KG' THEN clwl.delta_kg ELSE 0 END), 0) as total_topup_kg
    FROM customer_laundry_wallet_ledgers clwl
    WHERE clwl.tenant_id = ${tenantId}
      ${outletClwlFilter}
      AND clwl.created_at >= ${dateRange.startDate}
      AND clwl.created_at <= ${dateRange.endDate};
  `;
  const expiredAmount = toNum(breakageRows[0]?.expired_amount);
  const expiredKg = toNum(breakageRows[0]?.expired_kg);
  const totalTopupAmount = toNum(breakageRows[0]?.total_topup_amount);
  const totalTopupKg = toNum(breakageRows[0]?.total_topup_kg);

  return {
    meta: {
      tenantId,
      outletId,
      preset: dateRange.preset,
      formattedRange: dateRange.formattedRange,
      timezone,
    },
    overview: {
      totalCustomers,
      activeCustomersCount,
      newCustomersCount,
      returningCustomersCount,
      dormantCustomersCount,
      repeatCustomerRate,
      averageClv,
      averageVisitFrequencyDays,
      periodRetentionRate,
    },
    segments: {
      new: segNew,
      active: segActive,
      loyal: segLoyal,
      dormant: segDormant,
      highValue: segHighValue,
    },
    config: {
      dormantDays,
      loyalMinOrders: 5,
    },
    dormantList,
    winbackStats: {
      contactedCount,
      returnedCount,
      conversionRate: winbackConversionRate,
      availability: 'PARTIAL',
    },
    feedbackSummary: {
      avgRating,
      totalFeedbacks,
      complaintCount,
      complaintRate,
      fiveStarCount,
      googleRedirectCount,
      googleRedirectRate,
    },
    walletBreakage: {
      expiredAmount,
      expiredKg,
      totalTopupAmount,
      totalTopupKg,
    },
  };
}
