import { Router } from 'express';
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
import { authenticate } from '../middlewares/auth.middleware';

export const inventoryRouter = Router();

// Semua operasi stok memerlukan autentikasi user
inventoryRouter.use(authenticate);

inventoryRouter.post('/stock-in', recordStockIn);
inventoryRouter.post('/bulk-stock-in', recordBulkStockIn);
inventoryRouter.post('/stock-out', recordStockOut);
inventoryRouter.post('/bulk-stock-out', recordBulkStockOut);
inventoryRouter.post('/adjustment', recordStockAdjustment);
inventoryRouter.post('/bulk-adjustment', recordBulkStockAdjustment);
inventoryRouter.post('/transfer', transferStock);
inventoryRouter.post('/bulk-transfer', recordBulkTransfer);
inventoryRouter.get('/movements', getStockMovements);
inventoryRouter.get('/low-stock', getLowStockProducts);
inventoryRouter.get('/expiry-alerts', getExpiryAlerts);


