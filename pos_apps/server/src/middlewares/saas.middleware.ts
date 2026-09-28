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
