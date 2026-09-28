import { Router } from 'express';
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../controllers/supplier.controller';
import { authenticate } from '../middlewares/auth.middleware';

export const supplierRouter = Router();

supplierRouter.get('/', authenticate, getSuppliers);
supplierRouter.get('/:id', authenticate, getSupplierById);
supplierRouter.post('/', authenticate, createSupplier);
supplierRouter.put('/:id', authenticate, updateSupplier);
supplierRouter.delete('/:id', authenticate, deleteSupplier);
