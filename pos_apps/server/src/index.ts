import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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
import { prisma } from './config/prisma';

// Muat environment variables dari .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware global
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routing API
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/saas', saasRouter);
app.use('/api/platform', platformRouter);
app.use('/api/outlets', outletRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/products', productRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/orders', orderRouter);
app.use('/api/customers', customerRouter);
app.use('/api/shifts', shiftRouter);
app.use('/api/reports', reportRouter);
app.use('/api/users', userRouter);

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
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    status: 'error',
    message: 'Terjadi kesalahan internal pada server',
    detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Jalankan Server
const server = app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 POS Server aktif di http://localhost:${PORT}`);
  console.log(`🩺 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🏢 SaaS Onboarding:`);
  console.log(`   - POST /api/saas/register (Registrasi Mandiri Klien)`);
  console.log(`   - POST /api/saas/onboarding (Setup Profil & 5 Produk Sampel)`);
  console.log(`   - GET  /api/saas/subscription (Status Lisensi & Sisa Hari)`);
  console.log(`=========================================`);
});

// Penanganan Graceful Shutdown
const shutdown = async () => {
  console.log('\nMematikan server secara aman...');
  server.close(async () => {
    await prisma.$disconnect();
    console.log('Koneksi database terputus. Server selesai dimatikan.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default app;
