import { Request, Response, NextFunction } from 'express';

/**
 * Middleware: Enterprise HTTP Security Headers (OWASP Recommended)
 */
export const securityHeaders = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  next();
};

interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

interface ClientRecord {
  count: number;
  resetTime: number;
}

/**
 * In-Memory Sliding Window Rate Limiter Factory
 */
export const createRateLimiter = (options: RateLimiterOptions) => {
  const { windowMs, maxRequests, message = 'Terlalu banyak permintaan dari alamat IP ini. Silakan coba beberapa saat lagi.' } = options;
  const clientStore: Map<string, ClientRecord> = new Map();

  // Periodic sweep setiap 5 menit untuk membersihkan record kedaluwarsa (anti memory-leak pada RAM 512MB)
  const sweepInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of clientStore.entries()) {
      if (now > record.resetTime) {
        clientStore.delete(ip);
      }
    }
  }, 5 * 60 * 1000);
  sweepInterval.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();

    let record = clientStore.get(clientIp);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      clientStore.set(clientIp, record);
    } else {
      record.count++;
    }

    const remaining = Math.max(0, maxRequests - record.count);
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > maxRequests) {
      return res.status(429).json({
        status: 'error',
        code: 'TOO_MANY_REQUESTS',
        message,
        retryAfterSeconds: Math.ceil((record.resetTime - now) / 1000),
      });
    }

    next();
  };
};

// Rate limiter khusus endpoint autentikasi publik (brute force protection)
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 Menit
  maxRequests: 60,      // Maksimal 60 request per IP per menit
  message: 'Batas percobaan autentikasi terlampaui. Silakan tunggu 1 menit.',
});

// Rate limiter khusus endpoint pelaporan client error crash telemetry (anti-flooding)
export const clientErrorRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 Menit
  maxRequests: 20,      // Maksimal 20 request per IP per menit
  message: 'Batas pengiriman laporan error terlampaui. Silakan tunggu 1 menit.',
});

// Fix S1: Rate limiter khusus endpoint QR self-order publik (anti-spam pesanan)
export const qrOrderRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 Menit
  maxRequests: 10,      // Maksimal 10 pesanan per IP per menit
  message: 'Terlalu banyak pesanan dikirim. Silakan tunggu sebentar sebelum memesan kembali.',
});

// Rate limiter endpoint publik Customer Portal (Read: info outlet & profil/order)
export const publicPortalReadRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 Menit
  maxRequests: 60,      // Maksimal 60 request per IP per menit
  message: 'Terlalu banyak permintaan akses portal pelanggan. Silakan tunggu beberapa saat.',
});

// Rate limiter endpoint publik Customer Portal (Write: buat sesi & permintaan antar-jemput)
export const publicPortalWriteRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 Menit
  maxRequests: 15,      // Maksimal 15 permintaan per IP per menit
  message: 'Terlalu banyak permintaan pengiriman portal pelanggan. Silakan tunggu beberapa saat.',
});

