import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';

let cachedDefaultTenantId: string | null = null;

/**
 * Helper untuk mendapatkan Default Tenant ID (DEPRECATED: Dimatikan per R-09)
 * Jangan digunakan dalam alur request runtime - setiap request wajib memiliki konteks tenant eksplisit.
 */
export const getDefaultTenantId = async (): Promise<string> => {
  throw new Error('DEPRECATED (R-09): Automatic fallback ke default tenant telah dinonaktifkan. Sediakan tenantId eksplisit.');
};

/**
 * Middleware: tenantContext
 * Menentukan tenantId untuk request saat ini.
 * Sumber prioritas:
 * 1. req.user.tenantId (dari JWT token)
 * 2. Header 'x-tenant-id' atau query 'tenantId'
 * 
 * Sesuai Mandat R-09: Fallback otomatis ke default tenant telah DIHAPUS.
 * Request tanpa identitas tenant valid ditolak dengan HTTP 401 Unauthorized.
 */
export const tenantContext = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = (req as any).user;
    const resolvedTenantId =
      user?.tenantId ||
      (req.headers['x-tenant-id'] as string) ||
      (req.query.tenantId as string);

    if (!resolvedTenantId) {
      return res.status(401).json({
        status: 'error',
        code: 'TENANT_IDENTIFIER_REQUIRED',
        message: 'Akses ditolak: Identitas tenant wajib disertakan (via token otentikasi, header x-tenant-id, atau query tenantId)',
      });
    }

    (req as any).tenantId = resolvedTenantId;
    next();
  } catch (error) {
    console.error('Error saat menentukan konteks tenant:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan saat memvalidasi konteks tenant',
    });
  }
};

/**
 * Middleware: verifyTenantLicense
 * Memeriksa apakah status langganan tenant aktif.
 * Memblokir request transaksi jika status tenant secara eksplisit adalah SUSPENDED.
 */
export const verifyTenantLicense = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = (req as any).user;
    const tenantId = (req as any).tenantId || user?.tenantId;
    if (!tenantId) {
      return next();
    }

    const tenants = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, status, business_name FROM "tenants" WHERE id = $1 LIMIT 1;`,
      tenantId
    );

    if (!tenants || tenants.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Data tenant tidak ditemukan dalam sistem Well POS',
      });
    }

    const tenant = tenants[0];

    // Blokir hanya jika secara eksplisit SUSPENDED
    if (tenant.status === 'SUSPENDED') {
      return res.status(403).json({
        status: 'error',
        code: 'SUBSCRIPTION_LOCKED',
        message: `Masa aktif Well POS untuk "${tenant.business_name || 'Tenant'}" telah berakhir atau dibekukan. Silakan lakukan pembayaran tagihan untuk membuka akses operasional kasir.`,
      });
    }

    next();
  } catch (error) {
    console.error('Error saat verifikasi lisensi tenant:', error);
    next();
  }
};

export const GRACE_TOKEN_BUFFER = 25;

/**
 * Middleware: checkTokenQuotaWithGrace
 * Menjaga ketersediaan kuota token transaksi tenant.
 * Memberikan buffer darurat (GRACE_TOKEN_BUFFER = 25 pesanan) saat token habis
 * agar kasir tidak terblokir seketika di tengah jam sibuk / antrean kasir.
 */
export const checkTokenQuotaWithGrace = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = (req as any).user;
    const tenantId = (req as any).tenantId || user?.tenantId;
    if (!tenantId) {
      return next();
    }

    // Bypass jika SuperAdmin Platform
    if (user?.role === 'SUPER_ADMIN') {
      return next();
    }

    // 1. Hitung total token dari faktur berbayar (PAID invoices)
    const paidInvoices = await prisma.saaSInvoice.findMany({
      where: {
        tenantId,
        status: 'PAID',
        tokenAmount: { gt: 0 },
      },
      select: { tokenAmount: true },
    });
    const sumTokens = paidInvoices.reduce((acc, inv) => acc + (inv.tokenAmount || 0), 0);

    // 2. Ambil kuota bawaan paket / trial jika belum ada faktur top-up
    let baseQuota = sumTokens;
    if (baseQuota === 0) {
      const sub = await prisma.tenantSubscription.findFirst({
        where: { tenantId, isActive: true },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      });
      let planQuota = 500;
      if (sub?.plan?.code === 'ENTERPRISE') planQuota = 5000;
      else if (sub?.plan?.code === 'PRO') planQuota = 2000;
      else if (sub?.plan?.code === 'STARTER') planQuota = 1000;
      else if ((sub?.plan?.features as any)?.tokenQuota) {
        planQuota = Number((sub?.plan?.features as any).tokenQuota) || 500;
      }
      baseQuota = planQuota;
    }

    // 3. Hitung jumlah order aktif non-void
    const activeOrdersCount = await prisma.order.count({
      where: {
        tenantId,
        orderStatus: { notIn: ['CANCELLED', 'VOIDED'] },
      },
    });

    const maxAllowedWithGrace = baseQuota + GRACE_TOKEN_BUFFER;

    // Skenario A: Kuota Masih Aman
    if (activeOrdersCount < baseQuota) {
      const remainingTokens = baseQuota - activeOrdersCount;
      (req as any).graceQuota = {
        inGrace: false,
        remainingTokens,
        baseQuota,
        usedOrders: activeOrdersCount,
        graceBuffer: GRACE_TOKEN_BUFFER,
      };
      return next();
    }

    // Skenario B: Kuota Habis, Tetapi Masih Dalam Batas Grace Period
    if (activeOrdersCount < maxAllowedWithGrace) {
      const remainingGrace = maxAllowedWithGrace - activeOrdersCount;
      (req as any).graceQuota = {
        inGrace: true,
        remainingGrace,
        baseQuota,
        usedOrders: activeOrdersCount,
        graceBuffer: GRACE_TOKEN_BUFFER,
        usedGrace: activeOrdersCount - baseQuota + 1,
      };
      res.setHeader('X-Grace-Quota', 'true');
      res.setHeader('X-Grace-Remaining', String(remainingGrace));
      return next();
    }

    // Skenario C: Kuota Habis Dan Grace Buffer Juga Habis
    return res.status(403).json({
      status: 'error',
      code: 'TOKEN_QUOTA_EXHAUSTED',
      message: `Batas kuota token transaksi dan kuota darurat (${GRACE_TOKEN_BUFFER} pesanan) telah habis. Silakan lakukan isi ulang (top-up) token di menu Billing Backoffice untuk melanjutkan transaksi kasir.`,
      data: {
        baseQuota,
        usedOrders: activeOrdersCount,
        graceBuffer: GRACE_TOKEN_BUFFER,
        isGraceExhausted: true,
      },
    });
  } catch (error) {
    console.error('Error saat verifikasi kuota token & grace buffer:', error);
    // Fail-open secara defensif agar kesalahan query kuota tidak mengunci kasir operasional
    next();
  }
};
