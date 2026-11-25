import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { clientErrorRateLimiter } from '../middlewares/security.middleware';

export const healthRouter = Router();

/**
 * @route GET /api/health
 * @desc Memeriksa status kesehatan server Express (Liveness).
 * Jika query param ?db=true disertakan, lakukan uji konektivitas database eksplisit.
 */
healthRouter.get('/', async (req: Request, res: Response) => {
  const checkDb = req.query.db === 'true';

  if (!checkDb) {
    // Mode Liveness Cepat: Menghemat kuota egress & mencegah Neon terbangun dari auto-suspend
    return res.status(200).json({
      status: 'ok',
      message: 'POS API Server berjalan normal',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  }

  try {
    // Uji koneksi database eksplisit
    await prisma.$queryRaw`SELECT 1`;

    return res.status(200).json({
      status: 'ok',
      database: 'connected',
      message: 'POS API Server & Database berjalan normal',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    console.error('[HealthCheck] Database error:', error);
    return res.status(503).json({
      status: 'error',
      database: 'disconnected',
      message: 'Gagal terhubung ke database PostgreSQL',
      error: process.env.NODE_ENV === 'development'
        ? (error instanceof Error ? error.message : 'Unknown error')
        : undefined,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @route GET /api/health/db
 * @desc Endpoint khusus untuk deep healthcheck konektivitas database
 */
healthRouter.get('/db', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return res.status(200).json({
      status: 'ok',
      database: 'connected',
      message: 'POS API Server & Database berjalan normal',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    console.error('[HealthCheck] Database error:', error);
    return res.status(503).json({
      status: 'error',
      database: 'disconnected',
      message: 'Gagal terhubung ke database PostgreSQL',
      error: process.env.NODE_ENV === 'development'
        ? (error instanceof Error ? error.message : 'Unknown error')
        : undefined,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @route POST /api/health/client-error
 * @desc Menerima log crash runtime / unhandled rejection dari klien browser (P0-1 Monitoring)
 */
healthRouter.post('/client-error', clientErrorRateLimiter, (req: Request, res: Response) => {
  const { id, message, stack, route, source, userAgent, viewport } = req.body || {};

  console.warn(`[CLIENT_CRASH_REPORT] ID: ${id || 'N/A'} | Route: ${route || '#'} | Source: ${source || 'client'}`);
  console.warn(`  Message: ${message}`);
  if (stack) {
    console.warn(`  Stack:\n${String(stack).split('\n').slice(0, 4).map(l => `    ${l}`).join('\n')}`);
  }
  console.warn(`  Device: ${userAgent || 'Unknown'} (Screen: ${viewport || 'N/A'})`);

  return res.status(200).json({
    status: 'ok',
    message: 'Client error telemetry recorded',
    receivedId: id,
  });
});

