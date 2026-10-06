import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkProductAction,
  bulkImportProducts,
  getProductDeleteInfo,
  getAvailableProductsForOutlet,
  assignProductsToOutlet,
} from '../controllers/product.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

export const productRouter = Router();

// Read-only catalog (Diperlukan oleh Kasir, Barista, dan seluruh staf untuk POS checkout)
productRouter.get('/', authenticate, getProducts);
productRouter.get('/available-for-outlet', authenticate, getAvailableProductsForOutlet);
productRouter.get('/:id/delete-info', authenticate, getProductDeleteInfo);
productRouter.get('/:id', authenticate, getProductById);

// Mutasi Katalog & Produk (Khusus Owner, Admin, Supervisor, dan Staf Gudang)
productRouter.post('/bulk-action', authenticate, authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE), bulkProductAction);
productRouter.post('/bulk-import', authenticate, authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE), bulkImportProducts);
productRouter.post('/assign-to-outlet', authenticate, authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE), assignProductsToOutlet);
productRouter.post('/', authenticate, authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE), createProduct);
productRouter.put('/:id', authenticate, authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE), updateProduct);
productRouter.delete('/:id', authenticate, authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE), deleteProduct);

