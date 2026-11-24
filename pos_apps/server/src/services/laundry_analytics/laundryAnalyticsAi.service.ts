/**
 * Laundry Deterministic AI Rule Engine, Forecast & Query Router Service
 * Laundry Outlet Performance Intelligence (Well POS)
 * 
 * Mengimplementasikan analitik preskriptif cerdas berbasis data aktual (0 halusinasi, 0 biaya LLM):
 * 1. AI Summary: ringkasan deskriptif, diagnostik akar masalah, rekomendasi aksi 1-klik, deteksi anomali.
 * 2. AI Forecast: proyeksi linier akhir bulan berbasis moving average 7 hari terakhir (MTD + Projection).
 * 3. AI Query Router: pemetaan pertanyaan natural bahasa Indonesia ke metrik aktual database.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { FinancialAnalyticsParams } from './laundryAnalyticsFinancial.service';
import { getFinancialAnalytics } from './laundryAnalyticsFinancial.service';
import { getExecutiveOverview } from './laundryAnalyticsOverview.service';
import { getOperationsAnalytics } from './laundryAnalyticsOperations.service';
import { getInventoryAnalytics } from './laundryAnalyticsInventory.service';
import { getSalesAnalytics } from './laundryAnalyticsSales.service';

export interface DataStamp {
  periodLabel: string;
  startDate: string;
  endDate: string;
  outletScope: string;
  dataSources: string[];
  generatedAt: string;
}

export interface PrescriptionAction {
  title: string;
  reason: string;
  actionLabel: string;
  actionTarget: string;
}

export interface AiSummaryResult {
  meta: {
    tenantId: string;
    outletId: string | 'ALL';
    dataStamp: DataStamp;
  };
  descriptiveSummary: string;
  diagnostics: Array<{
    area: string;
    status: 'OPTIMAL' | 'WARNING' | 'CRITICAL';
    finding: string;
    rootCause: string;
  }>;
  prescriptions: PrescriptionAction[];
  anomalies: Array<{
    type: string;
    severity: 'WARNING' | 'CRITICAL';
    description: string;
  }>;
}

export interface AiForecastResult {
  meta: {
    tenantId: string;
    outletId: string | 'ALL';
    dataStamp: DataStamp;
  };
  method: string;
  mtd: {
    revenue: number;
    weightKg: number;
    daysElapsed: number;
  };
  recentRunRate: {
    last7DaysAvgRevenue: number;
    last7DaysAvgWeightKg: number;
  };
  projection: {
    remainingDaysInMonth: number;
    projectedMonthEndRevenue: number;
    projectedMonthEndWeightKg: number;
    projectedRevenueGrowthPercent: number;
  };
}

export interface AiQueryResult {
  meta: {
    tenantId: string;
    outletId: string | 'ALL';
    dataStamp: DataStamp;
  };
  intent: string;
  question: string;
  answer: string;
  supportingMetrics: Record<string, any>;
}

const toNum = (val: any): number => {
  if (val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

const formatRupiah = (val: number): string =>
  `Rp ${Math.round(val).toLocaleString('id-ID')}`;

function buildDataStamp(
  params: FinancialAnalyticsParams,
  sources: string[] = ['orders', 'laundry_order_details']
): DataStamp {
  return {
    periodLabel: params.dateRange.preset,
    startDate: params.dateRange.formattedRange.start,
    endDate: params.dateRange.formattedRange.end,
    outletScope: params.outletId,
    dataSources: sources,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * 1. AI Summary: Ringkasan Eksekutif, Diagnostik & Rekomendasi Preskriptif
 */
export async function getAiSummary(
  params: FinancialAnalyticsParams
): Promise<AiSummaryResult> {
  const [overview, ops, inv] = await Promise.all([
    getExecutiveOverview(params),
    getOperationsAnalytics(params),
    getInventoryAnalytics(params),
  ]);

  const fp = overview.financialPulse;
  const op = overview.operationalPulse;
  const cp = overview.customerPulse;
  const netRev = fp.netRevenue.current;
  const netRevChange = fp.netRevenue.percentChange;
  const orders = op.totalValidOrders;
  const weight = op.totalWeightKg;
  const slaRate = op.onTimeCompletionRate;
  const avgRating = cp.avgRating;
  const ratingCount = cp.ratingCount;

  // Narasi Deskriptif Bahasa Indonesia Baku
  const changeRevText =
    netRevChange !== null && netRevChange !== undefined
      ? `${netRevChange >= 0 ? 'meningkat' : 'menurun'} sebesar ${Math.abs(netRevChange)}%`
      : 'belum memiliki pembanding periode lalu';

  const descriptiveSummary =
    orders > 0
      ? `Pada periode ${params.dateRange.preset.toUpperCase()}, outlet membukukan total pendapatan bersih ${formatRupiah(netRev)} (${changeRevText}) dari ${orders} transaksi dengan total muatan cucian ${weight.toLocaleString('id-ID')} kg. Ketepatan waktu SLA produksi tercatat di level ${slaRate}%, dan kepuasan pelanggan berada di rata-rata ⭐ ${avgRating} (${ratingCount} ulasan).`
      : `Pada periode ${params.dateRange.preset.toUpperCase()}, belum ada transaksi pesanan yang diselesaikan di outlet ini. Seluruh metrik operasional dan pendapatan siap dipantau begitu aktivitas kasir dimulai.`;

  // Diagnostik Akar Masalah (Root Causes)
  const diagnostics: AiSummaryResult['diagnostics'] = [];

  // Diagnostik Profit Margin
  const profitMarginScore = overview.healthScore.pillars.profitMarginScore;
  if (profitMarginScore < 40 && orders > 0) {
    diagnostics.push({
      area: 'PROFITABILITAS',
      status: 'CRITICAL',
      finding: 'Margin laba bersih berada di bawah ambang sehat.',
      rootCause:
        inv.summary.chemicalCostPerKg > 3000
          ? `Biaya kimia/deterjen relatif tinggi (${formatRupiah(inv.summary.chemicalCostPerKg)}/kg) atau terdapat pemborosan bahan baku (BOM variance ${inv.summary.bomVariancePercent}%).`
          : 'Tingginya alokasi biaya operasional tetap shift dibanding volume omzet yang dicapai.',
    });
  } else {
    diagnostics.push({
      area: 'PROFITABILITAS',
      status: 'OPTIMAL',
      finding: 'Margin laba dan perputaran kas berada dalam kisaran sehat.',
      rootCause: 'Kontribusi omzet layanan menutup HPP bahan kimia dan biaya tenaga kerja.',
    });
  }

  // Diagnostik SLA Produksi
  if (slaRate < 85 && orders > 0) {
    diagnostics.push({
      area: 'OPERASIONAL & SLA',
      status: 'CRITICAL',
      finding: `Ketepatan waktu SLA hanya mencapai ${slaRate}%.`,
      rootCause: `Titik hambat utama (bottleneck) terdeteksi pada tahapan ${ops.bottleneckStage || 'WASHING'}. Terdapat ${ops.summary.overdueOrdersCount} pesanan melewati estimasi selesai.`,
    });
  } else if (slaRate < 95 && orders > 0) {
    diagnostics.push({
      area: 'OPERASIONAL & SLA',
      status: 'WARNING',
      finding: `SLA produksi stabil di level ${slaRate}%.`,
      rootCause: `Sebagian kecil antrean menumpuk di tahapan ${ops.bottleneckStage || 'SETRIKA'}.`,
    });
  } else {
    diagnostics.push({
      area: 'OPERASIONAL & SLA',
      status: 'OPTIMAL',
      finding: 'SLA produksi sangat baik (di atas 95%).',
      rootCause: 'Alur kerja mesin dan penyerahan pakaian berjalan mulus tanpa backlog signifikan.',
    });
  }

  // Preskripsi Aksi Rekomendasi 1-Klik
  const prescriptions: PrescriptionAction[] = [];

  if (inv.summary.lowStockCount > 0) {
    prescriptions.push({
      title: `Pesan Ulang ${inv.summary.lowStockCount} Item Bahan Baku`,
      reason: 'Bahan deterjen/parfum utama telah mencapai batas Reorder Point.',
      actionLabel: 'Buka Pengadaan',
      actionTarget: '/inventory/purchase-orders?status=DRAFT',
    });
  }

  if (ops.summary.overdueOrdersCount > 0) {
    prescriptions.push({
      title: `Prioritaskan ${ops.summary.overdueOrdersCount} Pesanan Melewati SLA`,
      reason: 'Mencegah eskalasi komplain pelanggan dengan percepatan pengerjaan di antrean.',
      actionLabel: 'Buka Antrean Cucian',
      actionTarget: '/laundry/orders?status=OVERDUE',
    });
  }

  if (cp.returningCustomersCount === 0 && cp.activeCustomersCount > 0) {
    prescriptions.push({
      title: 'Kirim Penawaran WhatsApp Win-Back',
      reason: 'Tingkatkan retensi pelanggan pasif yang belum kembali dalam 30 hari.',
      actionLabel: 'Broadcast Win-Back',
      actionTarget: '/laundry/business-summary?tab=customers',
    });
  }

  if (prescriptions.length === 0) {
    prescriptions.push({
      title: 'Pertahankan Standar SOP Produksi',
      reason: 'Seluruh indikator kinerja utama berada pada status hijau dan optimal.',
      actionLabel: 'Lihat Detail Kinerja',
      actionTarget: '/laundry/business-summary?tab=operations',
    });
  }

  // Deteksi Anomali Deterministik
  const anomalies: AiSummaryResult['anomalies'] = [];

  if (ops.incidents.incidentRate > 2) {
    anomalies.push({
      type: 'TINGKAT_INSIDEN_TINGGI',
      severity: 'CRITICAL',
      description: `Rasio pakaian rusak/luntur tercatat ${ops.incidents.incidentRate}%, melebihi ambang batas toleransi 2%.`,
    });
  }

  if (inv.summary.bomVariancePercent > 10) {
    anomalies.push({
      type: 'PENYUSUTAN_BAHAN_SIGNIFIKAN',
      severity: 'WARNING',
      description: `Penyusutan dan penyesuaian opname bahan baku mencapai ${inv.summary.bomVariancePercent}% dari total konsumsi produksi.`,
    });
  }

  if (ops.summary.overdueOrdersCount > 5) {
    anomalies.push({
      type: 'PENUMPUKAN_NOTA_TERLAMBAT',
      severity: 'CRITICAL',
      description: `Terdapat ${ops.summary.overdueOrdersCount} pesanan aktif yang melewati estimasi selesai di outlet.`,
    });
  }

  return {
    meta: {
      tenantId: params.tenantId,
      outletId: params.outletId,
      dataStamp: buildDataStamp(params, [
        'orders',
        'laundry_order_details',
        'inventory_ledgers',
        'laundry_incidents',
        'laundry_customer_feedbacks',
      ]),
    },
    descriptiveSummary,
    diagnostics,
    prescriptions,
    anomalies,
  };
}

/**
 * 2. AI Forecast: Proyeksi Akhir Bulan Linear Moving Average 7 Hari
 */
export async function getAiForecast(
  params: FinancialAnalyticsParams
): Promise<AiForecastResult> {
  const { tenantId, outletId } = params;
  const timezone = params.timezone || 'Asia/Jakarta';

  const outletOrderFilter =
    outletId !== 'ALL' ? Prisma.sql`AND o.outlet_id = ${outletId}` : Prisma.empty;

  // Awal bulan kalender berjalan di zona waktu outlet
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const startOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const currentDay = Math.max(1, now.getDate());
  const remainingDaysInMonth = Math.max(0, daysInMonth - currentDay);

  // 1. Month-to-Date (MTD) Omzet & Tonase
  const mtdRows = await prisma.$queryRaw<any[]>`
    SELECT 
      COALESCE(SUM(CASE WHEN (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED')) THEN o.grand_total ELSE 0 END), 0) as mtd_revenue,
      COALESCE(SUM(CASE WHEN (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED')) THEN lod.total_weight_kg ELSE 0 END), 0) as mtd_weight_kg
    FROM orders o
    LEFT JOIN laundry_order_details lod ON o.id = lod.order_id
    WHERE o.tenant_id = ${tenantId}
      ${outletOrderFilter}
      AND o.created_at >= ${startOfMonth}
      AND o.created_at <= ${now};
  `;
  const mtdRevenue = toNum(mtdRows[0]?.mtd_revenue);
  const mtdWeightKg = toNum(mtdRows[0]?.mtd_weight_kg);

  // 2. 7-Day Moving Average
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400 * 1000);
  const last7Rows = await prisma.$queryRaw<any[]>`
    SELECT 
      COALESCE(SUM(CASE WHEN (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED')) THEN o.grand_total ELSE 0 END), 0) as last7_revenue,
      COALESCE(SUM(CASE WHEN (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED')) THEN lod.total_weight_kg ELSE 0 END), 0) as last7_weight_kg
    FROM orders o
    LEFT JOIN laundry_order_details lod ON o.id = lod.order_id
    WHERE o.tenant_id = ${tenantId}
      ${outletOrderFilter}
      AND o.created_at >= ${sevenDaysAgo}
      AND o.created_at <= ${now};
  `;
  const last7Revenue = toNum(last7Rows[0]?.last7_revenue);
  const last7Weight = toNum(last7Rows[0]?.last7_weight_kg);

  const last7DaysAvgRevenue = Number((last7Revenue / 7).toFixed(2));
  const last7DaysAvgWeightKg = Number((last7Weight / 7).toFixed(2));

  // 3. Proyeksi Akhir Bulan
  const projectedMonthEndRevenue = Number(
    (mtdRevenue + last7DaysAvgRevenue * remainingDaysInMonth).toFixed(2)
  );
  const projectedMonthEndWeightKg = Number(
    (mtdWeightKg + last7DaysAvgWeightKg * remainingDaysInMonth).toFixed(2)
  );

  // Perkiraan pertumbuhan dibanding laju hari kalender
  const expectedProratedMtd = (projectedMonthEndRevenue / daysInMonth) * currentDay;
  const projectedRevenueGrowthPercent =
    expectedProratedMtd > 0
      ? Number((((mtdRevenue - expectedProratedMtd) / expectedProratedMtd) * 100).toFixed(2))
      : 0;

  return {
    meta: {
      tenantId,
      outletId,
      dataStamp: buildDataStamp(params, ['orders', 'laundry_order_details']),
    },
    method: '7-Day Moving Average Linear Projection',
    mtd: {
      revenue: mtdRevenue,
      weightKg: Number(mtdWeightKg.toFixed(2)),
      daysElapsed: currentDay,
    },
    recentRunRate: {
      last7DaysAvgRevenue,
      last7DaysAvgWeightKg,
    },
    projection: {
      remainingDaysInMonth,
      projectedMonthEndRevenue,
      projectedMonthEndWeightKg,
      projectedRevenueGrowthPercent,
    },
  };
}

/**
 * 3. AI Query Router: Menjawab Pertanyaan Natural Bahasa Indonesia dengan Data Akurat
 */
export async function postAiQuery(
  params: FinancialAnalyticsParams,
  question: string
): Promise<AiQueryResult> {
  const qClean = String(question || '').trim();
  if (!qClean) {
    const error: any = new Error('Pertanyaan query tidak boleh kosong.');
    error.statusCode = 400;
    throw error;
  }

  const qLower = qClean.toLowerCase();
  const dataStamp = buildDataStamp(params);

  // Keyword Matching Intent Parser (Entity specific matches before generic aggregate keywords)
  let intent = 'UNKNOWN';
  if (/laba|untung|profit|margin/i.test(qLower)) {
    intent = 'PROFIT_MARGIN';
  } else if (/kasir|pegawai|karyawan|staf|staff/i.test(qLower)) {
    intent = 'TOP_CASHIER';
  } else if (/layanan|terlaris|paling laku/i.test(qLower)) {
    intent = 'TOP_SERVICE';
  } else if (/piutang|kasbon|belum bayar|utang/i.test(qLower)) {
    intent = 'RECEIVABLES';
  } else if (/stok|bahan|deterjen|parfum|habis/i.test(qLower)) {
    intent = 'INVENTORY_ALERT';
  } else if (/masalah|antrean|antrian|terlambat|bottleneck|prioritas|overdue/i.test(qLower)) {
    intent = 'BOTTLENECK_OPS';
  } else if (/prediksi|estimasi|proyeksi|akhir bulan/i.test(qLower)) {
    intent = 'FORECAST';
  } else if (/biaya|opex|pengeluaran|break-even|bep/i.test(qLower)) {
    intent = 'OPEX_BREAKEVEN';
  } else if (/omzet|omset|penjualan|pendapatan/i.test(qLower)) {
    intent = 'REVENUE';
  }

  switch (intent) {
    case 'REVENUE': {
      const fin = await getFinancialAnalytics(params);
      const netRev = fin.revenue.netRevenue.current;
      const grossRev = fin.revenue.grossRevenue.current;
      const cashIn = fin.cashFlow.realCashIn.current;
      return {
        meta: { tenantId: params.tenantId, outletId: params.outletId, dataStamp },
        intent,
        question: qClean,
        answer: `Pendapatan bersih (Net Revenue) outlet pada periode ini tercatat ${formatRupiah(netRev)} dari total omzet kotor ${formatRupiah(grossRev)}. Total kas masuk riil (Real Cash In) sebesar ${formatRupiah(cashIn)}.`,
        supportingMetrics: { netRevenue: netRev, grossRevenue: grossRev, realCashIn: cashIn },
      };
    }

    case 'PROFIT_MARGIN': {
      const fin = await getFinancialAnalytics(params);
      const margin = fin.profitability.profitMarginPercent.current;
      const netProfit = fin.profitability.operatingProfit.current;
      return {
        meta: { tenantId: params.tenantId, outletId: params.outletId, dataStamp },
        intent,
        question: qClean,
        answer: `Estimasi margin laba bersih outlet pada periode ini berada di level ${margin}% dengan laba operasional sebesar ${formatRupiah(netProfit)}.`,
        supportingMetrics: { profitMarginPercent: margin, netProfit },
      };
    }

    case 'TOP_SERVICE': {
      const sales = await getSalesAnalytics(params);
      const top = sales.topServices[0];
      if (top) {
        return {
          meta: { tenantId: params.tenantId, outletId: params.outletId, dataStamp },
          intent,
          question: qClean,
          answer: `Layanan terlaris nomor 1 pada periode ini adalah '${top.serviceName}' dengan perolehan omzet ${formatRupiah(top.revenue)} (${top.orderCount} nota pesanan, kontribusi ${top.sharePercent}% dari total omzet).`,
          supportingMetrics: { topService: top },
        };
      }
      return {
        meta: { tenantId: params.tenantId, outletId: params.outletId, dataStamp },
        intent,
        question: qClean,
        answer: 'Belum ada data penjualan layanan pada periode ini.',
        supportingMetrics: {},
      };
    }

    case 'TOP_CASHIER': {
      const sales = await getSalesAnalytics(params);
      const topCashier = sales.byCashier[0];
      if (topCashier) {
        return {
          meta: { tenantId: params.tenantId, outletId: params.outletId, dataStamp },
          intent,
          question: qClean,
          answer: `Kasir dengan pencapaian omzet tertinggi adalah '${topCashier.cashierName}' dengan total penjualan ${formatRupiah(topCashier.totalRevenue)} dari ${topCashier.validOrders} transaksi valid (rasio void ${topCashier.voidRate}%).`,
          supportingMetrics: { topCashier },
        };
      }
      return {
        meta: { tenantId: params.tenantId, outletId: params.outletId, dataStamp },
        intent,
        question: qClean,
        answer: 'Belum ada data transaksi kasir pada periode ini.',
        supportingMetrics: {},
      };
    }

    case 'RECEIVABLES': {
      const fin = await getFinancialAnalytics(params);
      const rec = fin.balanceSheetSummary.outstandingReceivables;
      return {
        meta: { tenantId: params.tenantId, outletId: params.outletId, dataStamp },
        intent,
        question: qClean,
        answer: `Total piutang kasbon aktif yang belum terbayar oleh pelanggan adalah ${formatRupiah(rec)}. Pelanggan dapat ditagihkan saat pengambilan cucian berikutnya.`,
        supportingMetrics: { outstandingReceivables: rec },
      };
    }

    case 'INVENTORY_ALERT': {
      const inv = await getInventoryAnalytics(params);
      const lowCount = inv.summary.lowStockCount;
      const topItem = inv.lowStockItems[0];
      return {
        meta: { tenantId: params.tenantId, outletId: params.outletId, dataStamp },
        intent,
        question: qClean,
        answer:
          lowCount > 0
            ? `Terdapat ${lowCount} bahan baku yang berada di bawah ambang batas Reorder Point. Item paling kritis adalah '${topItem?.name}' (Sisa: ${topItem?.quantityOnHand} ${topItem?.uom}).`
            : 'Persediaan bahan baku aman. Tidak ada item yang berada di bawah reorder point saat ini.',
        supportingMetrics: { lowStockCount: lowCount, criticalItem: topItem || null },
      };
    }

    case 'BOTTLENECK_OPS': {
      const ops = await getOperationsAnalytics(params);
      return {
        meta: { tenantId: params.tenantId, outletId: params.outletId, dataStamp },
        intent,
        question: qClean,
        answer: `Titik hambat produksi saat ini berada di tahapan '${ops.bottleneckStage || 'WASHING'}'. Terdapat ${ops.summary.overdueOrdersCount} pesanan melewati batas waktu SLA dan ${ops.incidents.totalIncidents} insiden komplain.`,
        supportingMetrics: {
          bottleneckStage: ops.bottleneckStage,
          overdueOrdersCount: ops.summary.overdueOrdersCount,
          onTimeCompletionRate: ops.summary.onTimeCompletionRate,
        },
      };
    }

    case 'FORECAST': {
      const fc = await getAiForecast(params);
      return {
        meta: { tenantId: params.tenantId, outletId: params.outletId, dataStamp },
        intent,
        question: qClean,
        answer: `Berdasarkan rata-rata laju harian 7 hari terakhir (${formatRupiah(fc.recentRunRate.last7DaysAvgRevenue)}/hari), omzet akhir bulan diproyeksikan mencapai ${formatRupiah(fc.projection.projectedMonthEndRevenue)} dengan total muatan cucian ${fc.projection.projectedMonthEndWeightKg.toLocaleString('id-ID')} kg.`,
        supportingMetrics: fc.projection,
      };
    }

    case 'OPEX_BREAKEVEN': {
      const fin = await getFinancialAnalytics(params);
      const opex = fin.opex.recordedOpex.current;
      const marginPct = fin.profitability.profitMarginPercent.current;
      const bep = marginPct > 0 ? Number((opex / (marginPct / 100)).toFixed(2)) : opex;
      return {
        meta: { tenantId: params.tenantId, outletId: params.outletId, dataStamp },
        intent,
        question: qClean,
        answer: `Total beban operasional (OPEX) periode ini tercatat ${formatRupiah(opex)}. Nilai Break-Even Point (BEP) penjualan yang harus dicapai adalah ${formatRupiah(bep)}.`,
        supportingMetrics: { totalOpex: opex, breakEvenRevenue: bep },
      };
    }

    default: {
      return {
        meta: { tenantId: params.tenantId, outletId: params.outletId, dataStamp },
        intent: 'OUT_OF_SCOPE',
        question: qClean,
        answer:
          'Mohon maaf, pertanyaan tersebut belum tercakup dalam metrik analitik laundry yang tersedia. Anda dapat menanyakan seputar omzet, laba margin, kasir terlaris, layanan favorit, piutang kasbon, stok bahan, atau kendala antrean produksi.',
        supportingMetrics: {},
      };
    }
  }
}
