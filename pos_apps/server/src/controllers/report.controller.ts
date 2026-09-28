import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { analyticsService } from '../services/analytics.service';
import { reportReadAdapter } from '../services/read_adapters/report.read_adapter';

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
