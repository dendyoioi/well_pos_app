import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { analyticsService } from '../services/analytics.service';
import { reportReadAdapter } from '../services/read_adapters/report.read_adapter';
import { resolveDateRange, toWibDateStr } from '../utils/date.utils';

/**
 * Helper: Cek hak akses fitur Pro untuk modul analitik & finansial
 */
const checkProSubscription = async (tenantId: string): Promise<boolean> => {
  const activeSubs: any[] = await prisma.$queryRawUnsafe(
    `SELECT ts.id, ts.is_active, sp.code as plan_code
     FROM "tenant_subscriptions" ts
     JOIN "subscription_plans" sp ON sp.id = ts.plan_id
     WHERE ts.tenant_id = $1 AND ts.is_active = true
     ORDER BY ts.created_at DESC
     LIMIT 1;`,
    tenantId
  );

  if (activeSubs.length > 0 && activeSubs[0].plan_code === 'FREE') {
    return false;
  }
  return true;
};

/**
 * Helper: Resolusi tenantId dari JWT token saja — tidak menggunakan fallback berbahaya
 * Fix K3: Hapus prisma.tenant.findFirst() fallback yang bisa mengakibatkan cross-tenant leak
 */
const resolveAuthenticatedTenantId = (req: Request): string | null => {
  return (req as any).user?.tenantId || (req as any).tenantId || null;
};

/**
 * Controller: Laporan Finansial & Laba Rugi (P&L) Real-Time
 * @route GET /api/reports/financial
 */
export const getFinancialSummary = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    // Fix K3: Gunakan tenantId dari JWT token saja — tidak ada fallback ke findFirst()
    const tenantId = resolveAuthenticatedTenantId(req);

    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan. Pastikan Anda sudah login.' });
    }

    const hasAccess = await checkProSubscription(tenantId);
    if (!hasAccess) {
      return res.status(403).json({
        status: 'error',
        code: 'PRO_FEATURE_REQUIRED',
        isLocked: true,
        message: 'Fitur Laporan Laba Rugi & HPP hanya tersedia pada Paket Pro. Silakan upgrade paket bisnis Anda!',
      });
    }

    const { startDate, endDate, outletId } = req.query;
    let targetOutletId = (outletId as string) || user?.outletId;
    if (outletId === 'ALL') {
      targetOutletId = undefined;
    }

    const summary = await reportReadAdapter.getFinancialSummary(tenantId, {
      startDate: startDate as string,
      endDate: endDate as string,
      outletId: targetOutletId,
    });

    return res.status(200).json({
      status: 'success',
      data: summary,
    });
  } catch (error: any) {
    console.error('Error saat memuat laporan finansial:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat laporan finansial' });
  }
};

/**
 * Controller: Audit Rekapitulasi Shift & Selisih Kas Kasir (Over / Short)
 * @route GET /api/reports/shifts
 */
export const getShiftDiscrepancies = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    // Fix K3: Gunakan tenantId dari JWT token saja
    const tenantId = resolveAuthenticatedTenantId(req);

    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan. Pastikan Anda sudah login.' });
    }

    const { startDate, endDate, outletId } = req.query;
    let targetOutletId = (outletId as string) || user?.outletId;
    if (outletId === 'ALL') {
      targetOutletId = undefined;
    }

    const discrepancies = await analyticsService.getShiftDiscrepancies(tenantId, {
      startDate: startDate as string,
      endDate: endDate as string,
      outletId: targetOutletId,
    });

    return res.status(200).json({
      status: 'success',
      data: discrepancies,
    });
  } catch (error: any) {
    console.error('Error saat memuat audit selisih kas shift:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat audit selisih kas shift' });
  }
};

/**
 * Controller: Analisis Performa Penjualan & Matriks Produk (Pareto 80/20)
 * @route GET /api/reports/product-performance
 */
export const getProductPerformance = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    // Fix K3: Gunakan tenantId dari JWT token saja
    const tenantId = resolveAuthenticatedTenantId(req);

    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan. Pastikan Anda sudah login.' });
    }

    const { startDate, endDate, outletId, limit } = req.query;
    let targetOutletId = (outletId as string) || user?.outletId;
    if (outletId === 'ALL') {
      targetOutletId = undefined;
    }

    const performance = await analyticsService.getProductPerformance(tenantId, {
      startDate: startDate as string,
      endDate: endDate as string,
      outletId: targetOutletId,
      limit: limit ? parseInt(limit as string, 10) : 10,
    });

    return res.status(200).json({
      status: 'success',
      data: performance,
    });
  } catch (error: any) {
    console.error('Error saat memuat performa produk:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat analitik performa produk' });
  }
};

/**
 * Controller: Laporan Dead Stock & Modal Kerja Tertahan
 * @route GET /api/reports/dead-stock
 */
export const getDeadStockReport = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    // Fix K3: Gunakan tenantId dari JWT token saja
    const tenantId = resolveAuthenticatedTenantId(req);

    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan. Pastikan Anda sudah login.' });
    }

    const { daysThreshold, outletId } = req.query;
    let targetOutletId = (outletId as string) || user?.outletId;
    if (outletId === 'ALL') {
      targetOutletId = undefined;
    }

    const deadStock = await analyticsService.getDeadStock(tenantId, {
      daysThreshold: daysThreshold ? parseInt(daysThreshold as string, 10) : 30,
      outletId: targetOutletId,
    });

    return res.status(200).json({
      status: 'success',
      data: deadStock,
    });
  } catch (error: any) {
    console.error('Error saat memuat laporan dead stock:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat laporan dead stock' });
  }
};

/**
 * Controller: Ekspor Laporan Finansial / Produk / Shift ke Format CSV (Excel Compatible)
 * @route GET /api/reports/export
 */
export const exportReport = async (req: Request, res: Response) => {
  try {
    // Fix K3: Gunakan tenantId dari JWT token saja
    const tenantId = resolveAuthenticatedTenantId(req);

    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan. Pastikan Anda sudah login.' });
    }

    const { type, startDate, endDate, outletId, daysThreshold } = req.query;

    const validTypes = ['financial', 'products', 'shifts', 'dead-stock'];
    const exportType = (type as string) || 'financial';

    if (!validTypes.includes(exportType)) {
      return res.status(400).json({
        status: 'error',
        message: `Tipe ekspor tidak valid. Pilihan: ${validTypes.join(', ')}`,
      });
    }

    const { filename, csvContent } = await analyticsService.exportCsv(
      exportType as any,
      tenantId,
      {
        startDate: startDate as string,
        endDate: endDate as string,
        outletId: outletId as string,
        daysThreshold: daysThreshold ? parseInt(daysThreshold as string, 10) : 30,
      }
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (error: any) {
    console.error('Error saat mengekspor laporan:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal mengekspor laporan' });
  }
};

/**
 * Controller: Laporan Arus Kas (Cash Flow Summary) Real-Time
 * @route GET /api/reports/cash-flow
 */
export const getCashFlowSummary = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = resolveAuthenticatedTenantId(req);

    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan. Pastikan Anda sudah login.' });
    }

    const { startDate, endDate, outletId } = req.query;
    let targetOutletId = (outletId as string) || user?.outletId;
    if (outletId === 'ALL') {
      targetOutletId = undefined;
    }

    const { start, end } = resolveDateRange(startDate as string, endDate as string);

    // 1. Kas Masuk dari Penjualan Tunai Kasir
    const cashSalesRows = await prisma.paymentTransaction.findMany({
      where: {
        tenantId,
        paymentMethod: 'CASH',
        status: 'CAPTURED',
        createdAt: { gte: start, lte: end },
        ...(targetOutletId ? { order: { outletId: targetOutletId } } : {}),
      },
      select: {
        id: true,
        amount: true,
        createdAt: true,
        order: { select: { id: true, invoiceNumber: true, outletId: true } },
      },
    });

    const totalCashSales = cashSalesRows.reduce((sum, r) => sum + Number(r.amount), 0);

    // 2. Kas Masuk dari Pelunasan Piutang Kasbon
    const debtRepaymentsRows = await prisma.customerDebtPayment.findMany({
      where: {
        tenantId,
        paymentMethod: 'CASH',
        paidAt: { gte: start, lte: end },
        ...(targetOutletId ? { outletId: targetOutletId } : {}),
      },
      include: {
        debt: {
          select: {
            id: true,
            customer: { select: { id: true, name: true } },
            order: { select: { id: true, invoiceNumber: true } },
          },
        },
        cashier: { select: { id: true, name: true } },
      },
    });

    const totalDebtRepayments = debtRepaymentsRows.reduce((sum, r) => sum + Number(r.amount), 0);

    // 3. Mutasi Kas Masuk & Kas Keluar Kasir (cash_movements: CASH_IN vs CASH_OUT)
    const cashMovements = await prisma.cashMovement.findMany({
      where: {
        tenantId,
        createdAt: { gte: start, lte: end },
        ...(targetOutletId ? { outletId: targetOutletId } : {}),
      },
      include: {
        user: { select: { id: true, name: true } },
        outlet: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalManualCashIn = 0;
    let totalCashOut = 0;
    for (const mov of cashMovements) {
      const amt = Number(mov.amount);
      if (mov.type === 'CASH_IN') {
        if (mov.category !== 'DEBT_REPAYMENT') {
          totalManualCashIn += amt;
        }
      } else if (mov.type === 'CASH_OUT') {
        totalCashOut += amt;
      }
    }

    // 4. Kas Keluar dari Refund Tunai
    const refundRows = await prisma.refund.findMany({
      where: {
        tenantId,
        createdAt: { gte: start, lte: end },
        ...(targetOutletId ? { order: { outletId: targetOutletId } } : {}),
      },
      select: { id: true, amount: true, createdAt: true },
    });
    const totalRefunds = refundRows.reduce((sum, r) => sum + Number(r.amount), 0);

    // 5. Total Inflow, Outflow, dan Net Cash Flow
    const totalCashInflow = totalCashSales + totalDebtRepayments + totalManualCashIn;
    const totalCashOutflow = totalCashOut + totalRefunds;
    const netCashFlow = totalCashInflow - totalCashOutflow;

    // 6. Ringkasan Piutang Aktif (Customer Debts Outstanding)
    const outstandingDebtsAgg = await prisma.customerDebt.aggregate({
      where: {
        tenantId,
        ...(targetOutletId ? { outletId: targetOutletId } : {}),
        status: { in: ['UNPAID', 'PARTIAL'] },
      },
      _sum: { remainingAmount: true },
      _count: { id: true },
    });

    // 7. Agregasi Harian (Daily Cash Flow Breakdown)
    const dailyMap = new Map<string, { date: string; cashSales: number; debtRepayments: number; manualCashIn: number; cashOut: number; refunds: number; netFlow: number }>();

    const getDaily = (dateStr: string) => {
      if (!dailyMap.has(dateStr)) {
        dailyMap.set(dateStr, {
          date: dateStr,
          cashSales: 0,
          debtRepayments: 0,
          manualCashIn: 0,
          cashOut: 0,
          refunds: 0,
          netFlow: 0,
        });
      }
      return dailyMap.get(dateStr)!;
    };

    for (const cs of cashSalesRows) {
      const d = toWibDateStr(new Date(cs.createdAt));
      const entry = getDaily(d);
      entry.cashSales += Number(cs.amount);
      entry.netFlow += Number(cs.amount);
    }

    for (const dr of debtRepaymentsRows) {
      const d = toWibDateStr(new Date(dr.paidAt));
      const entry = getDaily(d);
      entry.debtRepayments += Number(dr.amount);
      entry.netFlow += Number(dr.amount);
    }

    for (const cm of cashMovements) {
      const d = toWibDateStr(new Date(cm.createdAt));
      const entry = getDaily(d);
      const amt = Number(cm.amount);
      if (cm.type === 'CASH_IN' && cm.category !== 'DEBT_REPAYMENT') {
        entry.manualCashIn += amt;
        entry.netFlow += amt;
      } else if (cm.type === 'CASH_OUT') {
        entry.cashOut += amt;
        entry.netFlow -= amt;
      }
    }

    for (const rf of refundRows) {
      const d = toWibDateStr(new Date(rf.createdAt));
      const entry = getDaily(d);
      const amt = Number(rf.amount);
      entry.refunds += amt;
      entry.netFlow -= amt;
    }

    const dailyBreakdown = Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date));

    return res.status(200).json({
      status: 'success',
      data: {
        summary: {
          totalCashSales,
          totalDebtRepayments,
          totalManualCashIn,
          totalCashInflow,
          totalCashOut,
          totalRefunds,
          totalCashOutflow,
          netCashFlow,
          outstandingReceivables: Number(outstandingDebtsAgg._sum.remainingAmount || 0),
          unpaidReceivablesCount: outstandingDebtsAgg._count.id || 0,
        },
        dailyBreakdown,
        recentMovements: cashMovements.slice(0, 30),
      },
    });
  } catch (error: any) {
    console.error('Error in getCashFlowSummary:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat laporan arus kas', error: error.message });
  }
};

/**
 * Controller: Grafik & Tren Performa Toko (Omset Harian & Bulanan)
 * @route GET /api/reports/sales-performance
 */
export const getSalesPerformanceTrend = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const tenantId = resolveAuthenticatedTenantId(req);

    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Konteks tenant tidak ditemukan. Pastikan Anda sudah login.' });
    }

    const { startDate, endDate, outletId } = req.query;
    let targetOutletId = (outletId as string) || user?.outletId;
    if (outletId === 'ALL') {
      targetOutletId = undefined;
    }

    const { start, end } = resolveDateRange(startDate as string, endDate as string);

    // Ambil seluruh order dalam rentang tanggal
    const orders = await prisma.order.findMany({
      where: {
        tenantId,
        paymentStatus: { in: ['PAID', 'PARTIALLY_PAID'] },
        createdAt: { gte: start, lte: end },
        ...(targetOutletId ? { outletId: targetOutletId } : {}),
      },
      select: {
        id: true,
        totalAmount: true,
        subtotal: true,
        discountTotal: true,
        createdAt: true,
        channel: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // 1. Agregasi Omset Harian
    const dailyMap = new Map<string, { date: string; revenue: number; orderCount: number }>();
    for (const o of orders) {
      const d = toWibDateStr(new Date(o.createdAt));
      if (!dailyMap.has(d)) {
        dailyMap.set(d, { date: d, revenue: 0, orderCount: 0 });
      }
      const entry = dailyMap.get(d)!;
      entry.revenue += Number(o.totalAmount);
      entry.orderCount += 1;
    }
    const dailyTrend = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // 2. Agregasi Omset Bulanan (12 Bulan Terakhir)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const yearOrders = await prisma.order.findMany({
      where: {
        tenantId,
        paymentStatus: { in: ['PAID', 'PARTIALLY_PAID'] },
        createdAt: { gte: twelveMonthsAgo },
        ...(targetOutletId ? { outletId: targetOutletId } : {}),
      },
      select: {
        id: true,
        totalAmount: true,
        createdAt: true,
      },
    });

    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    const monthlyMap = new Map<string, { monthKey: string; monthLabel: string; revenue: number; orderCount: number }>();
    for (const o of yearOrders) {
      const d = new Date(o.createdAt);
      const year = d.getFullYear();
      const monthIdx = d.getMonth();
      const monthKey = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
      const monthLabel = `${monthNames[monthIdx]} ${year}`;

      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, { monthKey, monthLabel, revenue: 0, orderCount: 0 });
      }
      const entry = monthlyMap.get(monthKey)!;
      entry.revenue += Number(o.totalAmount);
      entry.orderCount += 1;
    }

    const monthlyTrend = Array.from(monthlyMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    // 3. Ringkasan KPI
    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    let bestDay = { date: '-', revenue: 0 };
    for (const d of dailyTrend) {
      if (d.revenue > bestDay.revenue) {
        bestDay = { date: d.date, revenue: d.revenue };
      }
    }

    return res.status(200).json({
      status: 'success',
      data: {
        summary: {
          totalRevenue,
          totalOrders,
          avgOrderValue,
          bestDay,
        },
        dailyTrend,
        monthlyTrend,
      },
    });
  } catch (error: any) {
    console.error('Error in getSalesPerformanceTrend:', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memuat tren performa toko', error: error.message });
  }
};

