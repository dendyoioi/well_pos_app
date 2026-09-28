import { Router } from 'express';
import {
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  issuePurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
} from '../controllers/purchase_order.controller';
import { authenticate } from '../middlewares/auth.middleware';

export const purchaseOrderRouter = Router();

purchaseOrderRouter.get('/', authenticate, getPurchaseOrders);
purchaseOrderRouter.get('/:id', authenticate, getPurchaseOrderById);
purchaseOrderRouter.post('/', authenticate, createPurchaseOrder);
purchaseOrderRouter.post('/:id/issue', authenticate, issuePurchaseOrder);
purchaseOrderRouter.post('/:id/receive', authenticate, receivePurchaseOrder);
purchaseOrderRouter.post('/:id/cancel', authenticate, cancelPurchaseOrder);
