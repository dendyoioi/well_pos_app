import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import compression from 'compression';
import cors from 'cors';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth.routes';
import { categoryRouter } from './routes/category.routes';
import { productRouter } from './routes/product.routes';
import { inventoryRouter } from './routes/inventory.routes';
import { orderRouter } from './routes/order.routes';
import { shiftRouter } from './routes/shift.routes';
import { reportRouter } from './routes/report.routes';
import userRouter from './routes/user.routes';
import { saasRouter } from './routes/saas.routes';
import { platformRouter } from './routes/platform.routes';
import { customerRouter } from './routes/customer.routes';
import outletRouter from './routes/outlet.routes';
import { recipeRouter } from './routes/recipe.routes';
import { modifierRouter } from './routes/modifier.routes';
import { supplierRouter } from './routes/supplier.routes';
import { purchaseOrderRouter } from './routes/purchase_order.routes';
import { stockTransferRouter } from './routes/stock_transfer.routes';
import { promotionRouter } from './routes/promotion.routes';
import qrMenuRouter from './routes/qr_menu.routes';
import { attendanceRouter } from './routes/attendance.routes';
import { laundryRouter } from './routes/laundry.routes';
import { prisma } from './config/prisma';

import { securityHeaders, authRateLimiter } from './middlewares/security.middleware';
import { maintenanceMiddleware } from './middlewares/maintenance.middleware';

const app = express();

// Trust proxy layer (Render reverse proxy) untuk akurasi pembacaan req.ip
app.set('trust proxy', 1);

const PORT = process.env.PORT || 5001;

// Middleware global
app.use(securityHeaders);
// Kompresi HTTP (Gzip/Deflate) untuk menghemat outbound bandwidth hingga 70-85%
app.use(compression({
  threshold: 1024, // Hanya kompres payload >= 1 KB
  level: 6,        // Rasio kompresi optimal tanpa membebani CPU
}));

// CORS dengan validasi ketat (exact match domain resmi, regex preview Vercel proyek, dan dev lokal)
const rawOrigins = process.env.CLIENT_ORIGIN || '';
const clientEnvOrigins = rawOrigins.split(',').map(s => s.trim()).filter(Boolean);
const staticAllowedOrigins = [
  'https://wellpos.id',
  'https://beta.wellpos.id',
  'https://well-pos-app.vercel.app',
];
const vercelPreviewRegex = /^https:\/\/well-pos-app(?:-[a-z0-9-]+)?\.vercel\.app$/;
const localDevRegex = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;

app.use(cors({
  origin: (origin, callback) => {
    // 1. Izinkan request tanpa origin (contoh: curl, Postman, cron/server-to-server)
    if (!origin) {
      return callback(null, true);
    }
    // 2. Exact match: CLIENT_ORIGIN env, domain resmi, dan domain Vercel production
    if (
      clientEnvOrigins.includes('*') ||
      clientEnvOrigins.includes(origin) ||
      staticAllowedOrigins.includes(origin)
    ) {
      return callback(null, true);
    }
    // 3. Dev lokal (http://localhost:* atau http://127.0.0.1:*)
    if (localDevRegex.test(origin)) {
      return callback(null, true);
    }
    // 4. Regex khusus branch preview Vercel resmi proyek Well POS
    if (vercelPreviewRegex.test(origin)) {
      return callback(null, true);
    }
    // 5. Tolak jika origin tidak diizinkan
    return callback(new Error(`CORS: Origin '${origin}' tidak diizinkan`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads directory (untuk bukti foto kondisi laundry, profil produk, dsb)
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Mode Pemeliharaan Global Interceptor (Bypass /api/health dan /api/platform)
app.use(maintenanceMiddleware);

// Routing API
app.use('/api/health', healthRouter);
app.use('/api/auth', authRateLimiter, authRouter);
app.use('/api/saas', saasRouter);
app.use('/api/platform', platformRouter);
app.use('/api/outlets', outletRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/products', productRouter);
app.use('/api/recipes', recipeRouter);
app.use('/api/modifiers', modifierRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/suppliers', supplierRouter);
app.use('/api/purchasing/orders', purchaseOrderRouter);
app.use('/api/transfers', stockTransferRouter);
app.use('/api/promotions', promotionRouter);
app.use('/api/orders', orderRouter);
app.use('/api/customers', customerRouter);
app.use('/api/shifts', shiftRouter);
app.use('/api/reports', reportRouter);
app.use('/api/users', userRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/qr-menu', qrMenuRouter);
app.use('/api/laundry', laundryRouter);

// Root endpoint info
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'POS Backend API Service',
    version: '1.0.0',
    description: 'REST API untuk Point of Sale Multi-Outlet',
    endpoints: {
      health: '/api/health',
    },
  });
});

// Middleware penanganan 404 (Not Found)
app.use((req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan`,
  });
});

// Middleware penanganan Error Global
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err.message && err.message.startsWith('CORS:')) {
    res.status(403).json({
      status: 'error',
      message: err.message,
    });
    return;
  }
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    status: 'error',
    message: 'Terjadi kesalahan internal pada server',
    detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

import { runAutoSchemaPatcher } from './migrations/schema_patcher';
import { initBackupScheduler } from './services/backupScheduler';

// Jalankan Server jika dieksekusi secara langsung (bukan di-import oleh test suite)
let server: any = null;
if (process.env.NODE_ENV !== 'test' && require.main === module) {
  // Non-blocking auto-schema patcher pada saat server boot
  runAutoSchemaPatcher(prisma)
    .then((res) => {
      if (res.applied.length > 0) {
        console.log(`[Boot] ✅ Schema patches diterapkan: ${res.applied.join(', ')}`);
      }
    })
    .catch((err) => console.warn('[Boot] ⚠️ Auto-schema patcher warning:', err.message));

  // Inisialisasi scheduler backup otomatis harian
  initBackupScheduler();

  server = app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 POS Server aktif di http://localhost:${PORT}`);
    console.log(`🩺 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`🏢 SaaS Onboarding:`);
    console.log(`   - POST /api/saas/register (Registrasi Mandiri Klien)`);
    console.log(`   - POST /api/saas/onboarding (Setup Profil & 5 Produk Sampel)`);
    console.log(`   - GET  /api/saas/subscription (Status Lisensi & Sisa Hari)`);
    console.log(`=========================================`);
  });
}

// Penanganan Graceful Shutdown
const shutdown = async () => {
  console.log('\nMematikan server secara aman...');
  if (server) {
    server.close(async () => {
      await prisma.$disconnect();
      console.log('Koneksi database terputus. Server selesai dimatikan.');
      process.exit(0);
    });
  } else {
    await prisma.$disconnect();
    console.log('Koneksi database terputus. Server selesai dimatikan.');
    process.exit(0);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { app };
export default app;
