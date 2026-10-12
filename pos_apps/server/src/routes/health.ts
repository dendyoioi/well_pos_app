import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';

export const healthRouter = Router();

/**
 * @route GET /api/health
 * @desc Memeriksa status kesehatan server dan konektivitas database
 */
healthRouter.get('/', async (_req: Request, res: Response) => {
  try {
    // Uji koneksi ringan ke database
    await prisma.$queryRaw`SELECT 1`;

    return res.status(200).json({
      status: 'ok',
      message: 'POS API Server & Database berjalan normal',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    return res.status(503).json({
      status: 'error',
      message: 'Gagal terhubung ke database PostgreSQL',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * @route POST /api/health/client-error
 * @desc Menerima log crash runtime / unhandled rejection dari klien browser (P0-1 Monitoring)
 */
healthRouter.post('/client-error', (req: Request, res: Response) => {
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

