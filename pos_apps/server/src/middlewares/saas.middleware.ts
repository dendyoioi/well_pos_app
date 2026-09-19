import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';

let cachedDefaultTenantId: string | null = null;

/**
 * Helper untuk mendapatkan Default Tenant ID (Toko Maju Jaya)
 */
export const getDefaultTenantId = async (): Promise<string> => {
  if (cachedDefaultTenantId) return cachedDefaultTenantId;
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'toko-maju-jaya' },
    select: { id: true },
  });
  if (tenant) {
    cachedDefaultTenantId = tenant.id;
    return tenant.id;
  }
  const firstTenant = await prisma.tenant.findFirst({ select: { id: true } });
  if (firstTenant) {
    cachedDefaultTenantId = firstTenant.id;
    return firstTenant.id;
  }
  throw new Error('Default tenant tidak ditemukan di database');
};

/**
 * Middleware: tenantContext
 * Menentukan tenantId untuk request saat ini.
 * Sumber prioritas:
 * 1. req.user.tenantId (dari JWT token)
 * 2. Header 'x-tenant-id' atau query 'tenantId'
 * 3. Fallback otomatis ke Default Tenant (ramah pengujian lokal dan non-breaking)
 */
export const tenantContext = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    let resolvedTenantId =
      req.user?.tenantId ||
      (req.headers['x-tenant-id'] as string) ||
      (req.query.tenantId as string);

    if (!resolvedTenantId) {
      resolvedTenantId = await getDefaultTenantId();
    }

    req.tenantId = resolvedTenantId;
    next();
  } catch (error) {
    console.error('Error saat menentukan konteks tenant:', error);
    next();
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
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return next();
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        status: true,
        businessName: true,
        trialEndsAt: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({
        status: 'error',
        message: 'Data tenant tidak ditemukan dalam sistem Well POS',
      });
    }

    // Blokir hanya jika secara eksplisit SUSPENDED
    if (tenant.status === 'SUSPENDED') {
      return res.status(403).json({
        status: 'error',
        code: 'SUBSCRIPTION_LOCKED',
        message: `Masa aktif Well POS untuk "${tenant.businessName}" telah berakhir atau dibekukan. Silakan lakukan pembayaran tagihan untuk membuka akses operasional kasir.`,
      });
    }

    next();
  } catch (error) {
    console.error('Error saat verifikasi lisensi tenant:', error);
    next();
  }
};
