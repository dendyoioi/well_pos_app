/**
 * Laundry Financial Analytics Service
 * Laundry Outlet Performance Intelligence (Well POS)
 * 
 * Mengimplementasikan kueri agregasi keuangan akrual vs kas riil masuk,
 * HPP bahan cuci (BoM), pengeluaran kas kecil shift, dan liabilitas dompet pelanggan
 * tanpa double counting sesuai prinsip akuntansi standar Wave 1.
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../config/prisma';
import {
  ResolvedDateRange,
  calculatePercentChange,
} from './dateRangeResolver.service';

export interface FinancialAnalyticsParams {
  tenantId: string;
  outletId: string | 'ALL';
  dateRange: ResolvedDateRange;
  timezone?: string;
}

export interface FinancialMetricComparison {
  current: number;
  previous: number;
  diff: number;
  percentChange: number;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
}

export interface FinancialAnalyticsResult {
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
  revenue: {
    grossRevenue: FinancialMetricComparison;
    discountTotal: FinancialMetricComparison;
    accrualOrderTotal: FinancialMetricComparison;
    refundTotal: FinancialMetricComparison;
    netRevenue: FinancialMetricComparison;
  };
  cashFlow: {
    realCashIn: FinancialMetricComparison;
    components: {
      directOrderPayments: FinancialMetricComparison;
      debtRepayments: FinancialMetricComparison;
      walletBalanceTopup: FinancialMetricComparison;
      quotaTopupCash: FinancialMetricComparison;
    };
    netCashFlow: {
      current: number;
      previous: number;
      diff: number;
      percentChange: number;
      direction: 'UP' | 'DOWN' | 'NEUTRAL';
      availability: 'READY' | 'PARTIAL';
    };
  };
  cogsAndProfit: {
    cogsBom: FinancialMetricComparison;
    grossProfit: FinancialMetricComparison;
    grossProfitMarginPercent: {
      current: number;
      previous: number;
      diff: number;
      percentChange: number;
      direction: 'UP' | 'DOWN' | 'NEUTRAL';
    };
  };
  opex: {
    pettyCashOut: FinancialMetricComparison;
    pettyCashByCategory: Array<{ category: string; amount: number }>;
    incidentExpense: FinancialMetricComparison;
    fixedOpex: {
      current: number;
      previous: number;
      diff: number;
      percentChange: number;
      direction: 'UP' | 'DOWN' | 'NEUTRAL';
      availability: 'READY';
    };
    fixedOpexByCategory: Array<{ category: string; amount: number }>;
    recordedOpex: {
      current: number;
      previous: number;
      diff: number;
      percentChange: number;
      direction: 'UP' | 'DOWN' | 'NEUTRAL';
      availability: 'READY' | 'PARTIAL';
    };
  };
  profitability: {
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
  };
  balanceSheetSummary: {
    outstandingReceivables: number;
    walletLiability: {
      balanceAmount: number;
      quotaKg: number;
    };
  };
  paymentBreakdown: Array<{
    paymentMethod: string;
    txCount: number;
    totalAmount: number;
    percentage: number;
  }>;
  revenueSeries: Array<{
    date: string;
    accrualRevenue: number;
    realCashIn: number;
    recordedOpex: number;
  }>;
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

/**
 * Mengambil agregasi finansial untuk satu rentang waktu (current / previous)
 */
async function fetchPeriodFinancialTotals(
  db: PrismaClient,
  tenantId: string,
  outletId: string | 'ALL',
  start: Date,
  end: Date
) {
  const outletOrderFilter =
    outletId !== 'ALL' ? Prisma.sql`AND o.outlet_id = ${outletId}` : Prisma.empty;
  const outletPtFilter =
    outletId !== 'ALL' ? Prisma.sql`AND pt.outlet_id = ${outletId}` : Prisma.empty;
  const outletCdpFilter =
    outletId !== 'ALL' ? Prisma.sql`AND cdp.outlet_id = ${outletId}` : Prisma.empty;
  const outletClwlFilter =
    outletId !== 'ALL' ? Prisma.sql`AND clwl.outlet_id = ${outletId}` : Prisma.empty;
  const outletCmFilter =
    outletId !== 'ALL' ? Prisma.sql`AND cm.outlet_id = ${outletId}` : Prisma.empty;
  const outletLiFilter =
    outletId !== 'ALL' ? Prisma.sql`AND li.outlet_id = ${outletId}` : Prisma.empty;
  const outletStorageFilter =
    outletId !== 'ALL'
      ? Prisma.sql`JOIN storage_locations sl ON il.storage_location_id = sl.id AND sl.outlet_id = ${outletId}`
      : Prisma.empty;

  // 1. Accrual Orders
  const orderSummaryRows = await db.$queryRaw<any[]>`
    SELECT 
      COALESCE(SUM(o.subtotal + o.tax_amount + COALESCE(o.service_total, 0)), 0) as gross_revenue,
      COALESCE(SUM(o.discount_amount + o.point_discount_amount), 0) as discount_total,
      COALESCE(SUM(o.grand_total), 0) as accrual_order_total
    FROM orders o
    WHERE o.tenant_id = ${tenantId}
      ${outletOrderFilter}
      AND o.created_at >= ${start}
      AND o.created_at <= ${end}
      AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'));
  `;
  const grossRevenue = toNum(orderSummaryRows[0]?.gross_revenue);
  const discountTotal = toNum(orderSummaryRows[0]?.discount_total);
  const accrualOrderTotal = toNum(orderSummaryRows[0]?.accrual_order_total);

  // 1b. Refunds
  const refundRows = await db.$queryRaw<any[]>`
    SELECT COALESCE(SUM(r.amount), 0) as refund_total
    FROM refunds r
    JOIN orders o ON r.order_id = o.id
    WHERE o.tenant_id = ${tenantId}
      ${outletOrderFilter}
      AND r.created_at >= ${start}
      AND r.created_at <= ${end};
  `;
  const refundTotal = toNum(refundRows[0]?.refund_total);
  const netRevenue = accrualOrderTotal - refundTotal;

  // 2. Real Cash In (Anti-Double Counting 4 Komponen)
  // 2a. Direct Order Payments
  const ptRows = await db.$queryRaw<any[]>`
    SELECT COALESCE(SUM(pt.amount), 0) as direct_order_payments
    FROM payment_transactions pt
    WHERE pt.tenant_id = ${tenantId}
      ${outletPtFilter}
      AND pt.status = 'CAPTURED'
      AND pt.payment_method NOT IN ('CUSTOMER_DEPOSIT', 'LAUNDRY_QUOTA', 'CUSTOMER_DEBT')
      AND pt.created_at >= ${start}
      AND pt.created_at <= ${end};
  `;
  const directOrderPayments = toNum(ptRows[0]?.direct_order_payments);

  // 2b. Debt Repayments (paid_at)
  const cdpRows = await db.$queryRaw<any[]>`
    SELECT COALESCE(SUM(cdp.amount), 0) as debt_repayments
    FROM customer_debt_payments cdp
    WHERE cdp.tenant_id = ${tenantId}
      ${outletCdpFilter}
      AND cdp.paid_at >= ${start}
      AND cdp.paid_at <= ${end};
  `;
  const debtRepayments = toNum(cdpRows[0]?.debt_repayments);

  // 2c. Wallet Balance Top-Up (delta_amount)
  const clwlRows = await db.$queryRaw<any[]>`
    SELECT COALESCE(SUM(clwl.delta_amount), 0) as wallet_balance_topup
    FROM customer_laundry_wallet_ledgers clwl
    WHERE clwl.tenant_id = ${tenantId}
      ${outletClwlFilter}
      AND clwl.ledger_type = 'TOPUP_BALANCE'
      AND clwl.delta_amount > 0
      AND clwl.created_at >= ${start}
      AND clwl.created_at <= ${end};
  `;
  const walletBalanceTopup = toNum(clwlRows[0]?.wallet_balance_topup);

  // 2d. Quota Top-Up Cash
  const cmQuotaRows = await db.$queryRaw<any[]>`
    SELECT COALESCE(SUM(cm.amount), 0) as quota_topup_cash
    FROM cash_movements cm
    WHERE cm.tenant_id = ${tenantId}
      ${outletCmFilter}
      AND cm.type = 'CASH_IN'
      AND cm.category = 'WALLET_TOPUP'
      AND LOWER(cm.notes) LIKE '%kuota%'
      AND cm.created_at >= ${start}
      AND cm.created_at <= ${end};
  `;
  const quotaTopupCash = toNum(cmQuotaRows[0]?.quota_topup_cash);

  const realCashIn = directOrderPayments + debtRepayments + walletBalanceTopup + quotaTopupCash;

  // 3. COGS BoM
  const cogsRows = await db.$queryRaw<any[]>`
    SELECT COALESCE(SUM(ABS(il.quantity_delta) * COALESCE(NULLIF(il.unit_cost, 0), ii.average_cost, 0)), 0) as cogs_bom
    FROM inventory_ledgers il
    JOIN inventory_items ii ON il.inventory_item_id = ii.id
    ${outletStorageFilter}
    WHERE il.tenant_id = ${tenantId}
      AND il.movement_type = 'PRODUCTION_CONSUMPTION'
      AND il.created_at >= ${start}
      AND il.created_at <= ${end};
  `;
  const cogsBom = toNum(cogsRows[0]?.cogs_bom);
  const grossProfit = netRevenue - cogsBom;

  // 4. OPEX
  // 4a. Petty Cash Out
  const pettyCashRows = await db.$queryRaw<any[]>`
    SELECT 
      COALESCE(SUM(cm.amount), 0) as total_petty_cash,
      cm.category
    FROM cash_movements cm
    WHERE cm.tenant_id = ${tenantId}
      ${outletCmFilter}
      AND cm.type = 'CASH_OUT'
      AND cm.created_at >= ${start}
      AND cm.created_at <= ${end}
    GROUP BY cm.category;
  `;
  let pettyCashOut = 0;
  const pettyCashByCategory: Array<{ category: string; amount: number }> = [];
  for (const row of pettyCashRows) {
    const amt = toNum(row.total_petty_cash);
    pettyCashOut += amt;
    pettyCashByCategory.push({ category: row.category, amount: amt });
  }

  // 4b. Incident Expense
  const incidentRows = await db.$queryRaw<any[]>`
    SELECT COALESCE(SUM(li.approved_compensation), 0) as incident_expense
    FROM laundry_incidents li
    WHERE li.tenant_id = ${tenantId}
      ${outletLiFilter}
      AND li.status = 'COMPENSATED'
      AND li.created_at >= ${start}
      AND li.created_at <= ${end};
  `;
  const incidentExpense = toNum(incidentRows[0]?.incident_expense);

  // 4c. Fixed OPEX (operational_expenses)
  const outletOeFilter =
    outletId !== 'ALL' ? Prisma.sql`AND oe.outlet_id = ${outletId}` : Prisma.empty;

  const fixedOpexRows = await db.$queryRaw<any[]>`
    SELECT 
      COALESCE(SUM(oe.amount), 0) as total_fixed_opex,
      oe.category
    FROM operational_expenses oe
    WHERE oe.tenant_id = ${tenantId}
      ${outletOeFilter}
      AND oe.expense_date >= ${start}
      AND oe.expense_date <= ${end}
    GROUP BY oe.category;
  `;

  let fixedOpexTotal = 0;
  const fixedOpexByCategory: Array<{ category: string; amount: number }> = [];
  for (const row of fixedOpexRows) {
    const amt = toNum(row.total_fixed_opex);
    fixedOpexTotal += amt;
    fixedOpexByCategory.push({ category: row.category, amount: amt });
  }

  const recordedOpex = pettyCashOut + incidentExpense + fixedOpexTotal;
  const operatingProfit = netRevenue - cogsBom - recordedOpex;
  const profitMarginPercent = netRevenue > 0 ? Number(((operatingProfit / netRevenue) * 100).toFixed(2)) : 0;
  const netCashFlow = realCashIn - recordedOpex;

  return {
    grossRevenue,
    discountTotal,
    accrualOrderTotal,
    refundTotal,
    netRevenue,
    directOrderPayments,
    debtRepayments,
    walletBalanceTopup,
    quotaTopupCash,
    realCashIn,
    cogsBom,
    grossProfit,
    pettyCashOut,
    pettyCashByCategory,
    incidentExpense,
    fixedOpexTotal,
    fixedOpexByCategory,
    recordedOpex,
    operatingProfit,
    profitMarginPercent,
    netCashFlow,
  };
}

/**
 * Service Utama: getFinancialAnalytics
 */
export async function getFinancialAnalytics(
  params: FinancialAnalyticsParams
): Promise<FinancialAnalyticsResult> {
  const { tenantId, outletId, dateRange } = params;
  const timezone = params.timezone || dateRange.timezone || 'Asia/Jakarta';

  const outletPtFilter =
    outletId !== 'ALL' ? Prisma.sql`AND pt.outlet_id = ${outletId}` : Prisma.empty;
  const outletCdFilter =
    outletId !== 'ALL' ? Prisma.sql`AND cd.outlet_id = ${outletId}` : Prisma.empty;

  // Jalankan kueri periode berjalan dan periode sebelumnya secara paralel
  const [curr, prev] = await Promise.all([
    fetchPeriodFinancialTotals(prisma, tenantId, outletId, dateRange.startDate, dateRange.endDate),
    fetchPeriodFinancialTotals(
      prisma,
      tenantId,
      outletId,
      dateRange.prevStartDate,
      dateRange.prevEndDate
    ),
  ]);

  // 5. Neraca Ringkas: Piutang Kasbon & Liabilitas Saldo/Kuota Pelanggan
  const receivablesRows = await prisma.$queryRaw<any[]>`
    SELECT COALESCE(SUM(cd.remaining_amount), 0) as outstanding_receivables
    FROM customer_debts cd
    WHERE cd.tenant_id = ${tenantId}
      ${outletCdFilter}
      AND cd.status IN ('UNPAID', 'PARTIAL');
  `;
  const outstandingReceivables = toNum(receivablesRows[0]?.outstanding_receivables);

  const walletLiabilityRows = await prisma.$queryRaw<any[]>`
    SELECT 
      COALESCE(SUM(clw.balance_amount), 0) as total_balance_amount,
      COALESCE(SUM(clw.quota_kg), 0) as total_quota_kg
    FROM customer_laundry_wallets clw
    WHERE clw.tenant_id = ${tenantId};
  `;
  const walletLiability = {
    balanceAmount: toNum(walletLiabilityRows[0]?.total_balance_amount),
    quotaKg: toNum(walletLiabilityRows[0]?.total_quota_kg),
  };

  // 6. Payment Breakdown (Periode Berjalan)
  const paymentBreakdownRows = await prisma.$queryRaw<any[]>`
    SELECT 
      pt.payment_method,
      COUNT(pt.id) as tx_count,
      COALESCE(SUM(pt.amount), 0) as total_amount
    FROM payment_transactions pt
    WHERE pt.tenant_id = ${tenantId}
      ${outletPtFilter}
      AND pt.status = 'CAPTURED'
      AND pt.created_at >= ${dateRange.startDate}
      AND pt.created_at <= ${dateRange.endDate}
    GROUP BY pt.payment_method
    ORDER BY total_amount DESC;
  `;

  let totalPaymentAmount = 0;
  for (const row of paymentBreakdownRows) {
    totalPaymentAmount += toNum(row.total_amount);
  }

  const paymentBreakdown = paymentBreakdownRows.map((row) => {
    const totalAmount = toNum(row.total_amount);
    return {
      paymentMethod: row.payment_method,
      txCount: Number(row.tx_count),
      totalAmount,
      percentage: totalPaymentAmount > 0 ? Number(((totalAmount / totalPaymentAmount) * 100).toFixed(2)) : 0,
    };
  });

  // 7. Revenue Series (Tren Harian Periode Berjalan)
  const dailyOrdersRows = await prisma.$queryRaw<any[]>`
    SELECT 
      TO_CHAR(o.created_at AT TIME ZONE ${timezone}, 'YYYY-MM-DD') as tx_date,
      COALESCE(SUM(o.grand_total), 0) as daily_accrual
    FROM orders o
    WHERE o.tenant_id = ${tenantId}
      ${outletId !== 'ALL' ? Prisma.sql`AND o.outlet_id = ${outletId}` : Prisma.empty}
      AND o.created_at >= ${dateRange.startDate}
      AND o.created_at <= ${dateRange.endDate}
      AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'))
    GROUP BY tx_date;
  `;

  const dailyCashInRows = await prisma.$queryRaw<any[]>`
    SELECT 
      TO_CHAR(pt.created_at AT TIME ZONE ${timezone}, 'YYYY-MM-DD') as tx_date,
      COALESCE(SUM(pt.amount), 0) as daily_cash_in
    FROM payment_transactions pt
    WHERE pt.tenant_id = ${tenantId}
      ${outletPtFilter}
      AND pt.status = 'CAPTURED'
      AND pt.payment_method NOT IN ('CUSTOMER_DEPOSIT', 'LAUNDRY_QUOTA', 'CUSTOMER_DEBT')
      AND pt.created_at >= ${dateRange.startDate}
      AND pt.created_at <= ${dateRange.endDate}
    GROUP BY tx_date;
  `;

  const dailyOpexRows = await prisma.$queryRaw<any[]>`
    SELECT 
      TO_CHAR(cm.created_at AT TIME ZONE ${timezone}, 'YYYY-MM-DD') as tx_date,
      COALESCE(SUM(cm.amount), 0) as daily_opex
    FROM cash_movements cm
    WHERE cm.tenant_id = ${tenantId}
      ${outletId !== 'ALL' ? Prisma.sql`AND cm.outlet_id = ${outletId}` : Prisma.empty}
      AND cm.type = 'CASH_OUT'
      AND cm.created_at >= ${dateRange.startDate}
      AND cm.created_at <= ${dateRange.endDate}
    GROUP BY tx_date;
  `;

  // Gabungkan operational_expenses harian ke dalam dailyOpexMap (Petty Cash + Fixed OPEX)
  const dailyFixedOpexRows = await prisma.$queryRaw<any[]>`
    SELECT 
      TO_CHAR(oe.expense_date AT TIME ZONE ${timezone}, 'YYYY-MM-DD') as tx_date,
      COALESCE(SUM(oe.amount), 0) as daily_fixed_opex
    FROM operational_expenses oe
    WHERE oe.tenant_id = ${tenantId}
      ${outletId !== 'ALL' ? Prisma.sql`AND oe.outlet_id = ${outletId}` : Prisma.empty}
      AND oe.expense_date >= ${dateRange.startDate}
      AND oe.expense_date <= ${dateRange.endDate}
    GROUP BY tx_date;
  `;

  const dailyAccrualMap = new Map<string, number>();
  for (const r of dailyOrdersRows) {
    if (r.tx_date) dailyAccrualMap.set(r.tx_date, toNum(r.daily_accrual));
  }

  const dailyCashInMap = new Map<string, number>();
  for (const r of dailyCashInRows) {
    if (r.tx_date) dailyCashInMap.set(r.tx_date, toNum(r.daily_cash_in));
  }

  const dailyOpexMap = new Map<string, number>();
  for (const r of dailyOpexRows) {
    if (r.tx_date) dailyOpexMap.set(r.tx_date, toNum(r.daily_opex));
  }
  for (const r of dailyFixedOpexRows) {
    if (r.tx_date) {
      const currentVal = dailyOpexMap.get(r.tx_date) || 0;
      dailyOpexMap.set(r.tx_date, currentVal + toNum(r.daily_fixed_opex));
    }
  }

  // Buat array tanggal kontinu dari start s/d end
  const revenueSeries: Array<{
    date: string;
    accrualRevenue: number;
    realCashIn: number;
    recordedOpex: number;
  }> = [];

  const startDay = new Date(`${dateRange.formattedRange.start}T00:00:00.000Z`);
  const endDay = new Date(`${dateRange.formattedRange.end}T00:00:00.000Z`);

  for (let d = new Date(startDay); d <= endDay; d.setUTCDate(d.getUTCDate() + 1)) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${day}`;

    revenueSeries.push({
      date: dateStr,
      accrualRevenue: dailyAccrualMap.get(dateStr) || 0,
      realCashIn: dailyCashInMap.get(dateStr) || 0,
      recordedOpex: dailyOpexMap.get(dateStr) || 0,
    });
  }

  // Rasio Margin Laba Kotor
  const currGrossMargin =
    curr.netRevenue > 0 ? Number(((curr.grossProfit / curr.netRevenue) * 100).toFixed(2)) : 0;
  const prevGrossMargin =
    prev.netRevenue > 0 ? Number(((prev.grossProfit / prev.netRevenue) * 100).toFixed(2)) : 0;
  const grossMarginChange = calculatePercentChange(currGrossMargin, prevGrossMargin);

  // Perubahan Operating Profit & Recorded OPEX
  const opProfitChange = calculatePercentChange(curr.operatingProfit, prev.operatingProfit);
  const profitMarginChange = calculatePercentChange(curr.profitMarginPercent, prev.profitMarginPercent);
  const opexChange = calculatePercentChange(curr.recordedOpex, prev.recordedOpex);
  const netCashFlowChange = calculatePercentChange(curr.netCashFlow, prev.netCashFlow);

  return {
    meta: {
      tenantId,
      outletId,
      preset: dateRange.preset,
      formattedRange: dateRange.formattedRange,
      timezone,
    },
    revenue: {
      grossRevenue: buildMetricComparison(curr.grossRevenue, prev.grossRevenue),
      discountTotal: buildMetricComparison(curr.discountTotal, prev.discountTotal),
      accrualOrderTotal: buildMetricComparison(curr.accrualOrderTotal, prev.accrualOrderTotal),
      refundTotal: buildMetricComparison(curr.refundTotal, prev.refundTotal),
      netRevenue: buildMetricComparison(curr.netRevenue, prev.netRevenue),
    },
    cashFlow: {
      realCashIn: buildMetricComparison(curr.realCashIn, prev.realCashIn),
      components: {
        directOrderPayments: buildMetricComparison(curr.directOrderPayments, prev.directOrderPayments),
        debtRepayments: buildMetricComparison(curr.debtRepayments, prev.debtRepayments),
        walletBalanceTopup: buildMetricComparison(curr.walletBalanceTopup, prev.walletBalanceTopup),
        quotaTopupCash: buildMetricComparison(curr.quotaTopupCash, prev.quotaTopupCash),
      },
      netCashFlow: {
        current: Number(curr.netCashFlow.toFixed(2)),
        previous: Number(prev.netCashFlow.toFixed(2)),
        diff: netCashFlowChange.diff,
        percentChange: netCashFlowChange.percent,
        direction: netCashFlowChange.direction,
        availability: 'READY',
      },
    },
    cogsAndProfit: {
      cogsBom: buildMetricComparison(curr.cogsBom, prev.cogsBom),
      grossProfit: buildMetricComparison(curr.grossProfit, prev.grossProfit),
      grossProfitMarginPercent: {
        current: currGrossMargin,
        previous: prevGrossMargin,
        diff: grossMarginChange.diff,
        percentChange: grossMarginChange.percent,
        direction: grossMarginChange.direction,
      },
    },
    opex: {
      pettyCashOut: buildMetricComparison(curr.pettyCashOut, prev.pettyCashOut),
      pettyCashByCategory: curr.pettyCashByCategory,
      incidentExpense: buildMetricComparison(curr.incidentExpense, prev.incidentExpense),
      fixedOpex: {
        ...buildMetricComparison(curr.fixedOpexTotal, prev.fixedOpexTotal),
        availability: 'READY',
      },
      fixedOpexByCategory: curr.fixedOpexByCategory,
      recordedOpex: {
        current: Number(curr.recordedOpex.toFixed(2)),
        previous: Number(prev.recordedOpex.toFixed(2)),
        diff: opexChange.diff,
        percentChange: opexChange.percent,
        direction: opexChange.direction,
        availability: 'READY',
      },
    },
    profitability: {
      operatingProfit: {
        current: Number(curr.operatingProfit.toFixed(2)),
        previous: Number(prev.operatingProfit.toFixed(2)),
        diff: opProfitChange.diff,
        percentChange: opProfitChange.percent,
        direction: opProfitChange.direction,
        availability: 'READY',
      },
      profitMarginPercent: {
        current: curr.profitMarginPercent,
        previous: prev.profitMarginPercent,
        diff: profitMarginChange.diff,
        percentChange: profitMarginChange.percent,
        direction: profitMarginChange.direction,
        availability: 'READY',
      },
    },
    balanceSheetSummary: {
      outstandingReceivables,
      walletLiability,
    },
    paymentBreakdown,
    revenueSeries,
  };
}
