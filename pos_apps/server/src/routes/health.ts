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
