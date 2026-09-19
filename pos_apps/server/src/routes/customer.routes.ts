import { Router } from 'express';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../controllers/customer.controller';
import { authenticate } from '../middlewares/auth.middleware';

export const customerRouter = Router();

// Seluruh endpoint pelanggan memerlukan autentikasi login (baik kasir maupun admin dapat mengakses)
customerRouter.get('/', authenticate, getCustomers);
customerRouter.get('/:id', authenticate, getCustomerById);
customerRouter.post('/', authenticate, createCustomer);
customerRouter.put('/:id', authenticate, updateCustomer);
customerRouter.delete('/:id', authenticate, deleteCustomer);
