import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  issuePurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
} from '../controllers/purchase_order.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

export const purchaseOrderRouter = Router();

// Modul Purchase Order & Pengadaan Barang Supplier (Owner, Admin, Supervisor, dan Staf Gudang)
purchaseOrderRouter.use(authenticate);
purchaseOrderRouter.use(authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE));

purchaseOrderRouter.get('/', getPurchaseOrders);
purchaseOrderRouter.get('/:id', getPurchaseOrderById);
purchaseOrderRouter.post('/', createPurchaseOrder);
purchaseOrderRouter.post('/:id/issue', issuePurchaseOrder);
purchaseOrderRouter.post('/:id/receive', receivePurchaseOrder);
purchaseOrderRouter.post('/:id/cancel', cancelPurchaseOrder);
