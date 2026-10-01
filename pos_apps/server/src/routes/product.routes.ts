import { Router } from 'express';
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
import { authenticate } from '../middlewares/auth.middleware';

export const productRouter = Router();

productRouter.get('/', authenticate, getProducts);
productRouter.post('/bulk-action', authenticate, bulkProductAction);
productRouter.post('/bulk-import', authenticate, bulkImportProducts);
productRouter.get('/available-for-outlet', authenticate, getAvailableProductsForOutlet);
productRouter.post('/assign-to-outlet', authenticate, assignProductsToOutlet);
productRouter.get('/:id/delete-info', authenticate, getProductDeleteInfo);
productRouter.get('/:id', authenticate, getProductById);
productRouter.post('/', authenticate, createProduct);
productRouter.put('/:id', authenticate, updateProduct);
productRouter.delete('/:id', authenticate, deleteProduct);

