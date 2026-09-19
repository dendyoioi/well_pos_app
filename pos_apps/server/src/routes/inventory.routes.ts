import { Router } from 'express';
import {
  recordStockIn,
  recordStockOut,
  recordStockAdjustment,
  transferStock,
  getStockMovements,
  getLowStockProducts,
} from '../controllers/inventory.controller';
import { authenticate } from '../middlewares/auth.middleware';

export const inventoryRouter = Router();

// Semua operasi stok memerlukan autentikasi user
inventoryRouter.use(authenticate);

inventoryRouter.post('/stock-in', recordStockIn);
inventoryRouter.post('/stock-out', recordStockOut);
inventoryRouter.post('/adjustment', recordStockAdjustment);
inventoryRouter.post('/transfer', transferStock);
inventoryRouter.get('/movements', getStockMovements);
inventoryRouter.get('/low-stock', getLowStockProducts);

