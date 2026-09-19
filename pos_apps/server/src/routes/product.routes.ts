import { Router } from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkProductAction,
  getProductDeleteInfo,
  getAvailableProductsForOutlet,
  assignProductsToOutlet,
} from '../controllers/product.controller';
import { authenticate } from '../middlewares/auth.middleware';

export const productRouter = Router();

productRouter.get('/', getProducts);
productRouter.post('/bulk-action', authenticate, bulkProductAction);
productRouter.get('/available-for-outlet', authenticate, getAvailableProductsForOutlet);
productRouter.post('/assign-to-outlet', authenticate, assignProductsToOutlet);
productRouter.get('/:id/delete-info', authenticate, getProductDeleteInfo);
productRouter.get('/:id', getProductById);
productRouter.post('/', authenticate, createProduct);
productRouter.put('/:id', authenticate, updateProduct);
productRouter.delete('/:id', authenticate, deleteProduct);

