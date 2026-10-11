import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { systemConfigService } from '../services/system_config.service';

/**
 * Middleware: maintenanceMiddleware
 * Memeriksa status Mode Pemeliharaan (Maintenance Mode) global.
 * Jika aktif:
 * - Mengizinkan /api/health (agar monitoring & pinger tetap aktif)
 * - Mengizinkan seluruh rute /api/platform/* (akses portal Superadmin)
 * - Mengizinkan request yang membawa token JWT Superadmin valid
 * - Memblokir seluruh request transaksi, kasir POS, QR menu, dan merchant dengan HTTP 503
 */
export const maintenanceMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // 1. Jika mode pemeliharaan tidak aktif, lanjutkan normal
  if (!systemConfigService.isMaintenanceActive()) {
    return next();
  }

  // 2. Izinkan selalu endpoint health check & rute platform/superadmin
  if (
    req.path.startsWith('/api/health') ||
    req.path.startsWith('/api/platform') ||
    req.path === '/'
  ) {
    return next();
  }

  // 3. Izinkan request jika berasal dari Superadmin Platform (Token valid dengan isPlatformAdmin)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    if (secret) {
      try {
        const decoded = jwt.verify(token, secret) as any;
        if (decoded && (decoded.isPlatformAdmin || decoded.role === 'SUPER_ADMIN' || decoded.role === 'SUPPORT')) {
          return next();
        }
      } catch {
        // Abaikan error verifikasi token di sini, biarkan jatuh ke blokade 503
      }
    }
  }

  // 4. Blokir seluruh akses publik, kasir, dan merchant
  const config = systemConfigService.getConfig();
  return res.status(503).json({
    status: 'maintenance',
    code: 'MAINTENANCE_MODE_ACTIVE',
    message: config.maintenanceMessage,
    estimatedEndTime: config.estimatedEndTime,
    activatedAt: config.activatedAt,
  });
};
