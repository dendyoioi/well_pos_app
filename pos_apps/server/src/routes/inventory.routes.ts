import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  recordStockIn,
  recordStockOut,
  recordStockAdjustment,
  recordBulkStockAdjustment,
  recordBulkStockIn,
  recordBulkStockOut,
  recordBulkTransfer,
  transferStock,
  getStockMovements,
  getLowStockProducts,
  getExpiryAlerts,
} from '../controllers/inventory.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

export const inventoryRouter = Router();

// Semua operasi stok memerlukan autentikasi user
inventoryRouter.use(authenticate);

// Read-only pemantauan stok (Kasir & Barista bisa memeriksa stok tipis & mutasi dasar)
inventoryRouter.get('/movements', getStockMovements);
inventoryRouter.get('/low-stock', getLowStockProducts);
inventoryRouter.get('/expiry-alerts', getExpiryAlerts);

// Operasi Penyesuaian, Opname, dan Barang Masuk (Khusus Owner, Admin, Supervisor, dan Staf Gudang)
inventoryRouter.post('/stock-in', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE), recordStockIn);
inventoryRouter.post('/bulk-stock-in', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE), recordBulkStockIn);
inventoryRouter.post('/stock-out', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE), recordStockOut);
inventoryRouter.post('/bulk-stock-out', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE), recordBulkStockOut);
inventoryRouter.post('/adjustment', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE), recordStockAdjustment);
inventoryRouter.post('/bulk-adjustment', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE), recordBulkStockAdjustment);
inventoryRouter.post('/transfer', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE), transferStock);
inventoryRouter.post('/bulk-transfer', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE), recordBulkTransfer);


