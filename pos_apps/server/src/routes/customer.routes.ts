import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerPointsHistory,
  adjustCustomerPoints,
  getCustomerDebts,
  getCustomerDebtDetail,
  payCustomerDebt,
} from '../controllers/customer.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

export const customerRouter = Router();

// Seluruh endpoint pelanggan memerlukan autentikasi login
// Penting: Daftarkan rute statis /debts SEBELUM rute parameter /:id agar tidak tertimpa
customerRouter.get('/debts', authenticate, getCustomerDebts);
customerRouter.get('/debts/:debtId', authenticate, getCustomerDebtDetail);
customerRouter.post('/debts/:debtId/payments', authenticate, payCustomerDebt);

customerRouter.get('/', authenticate, getCustomers);
customerRouter.get('/:id', authenticate, getCustomerById);
customerRouter.get('/:id/points-history', authenticate, getCustomerPointsHistory);
customerRouter.post('/:id/adjust-points', authenticate, authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), adjustCustomerPoints);
customerRouter.post('/', authenticate, createCustomer);
customerRouter.put('/:id', authenticate, updateCustomer);
customerRouter.delete('/:id', authenticate, authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), deleteCustomer);

