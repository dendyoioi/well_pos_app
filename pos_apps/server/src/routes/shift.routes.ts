import { Router } from 'express';
import {
  startShift,
  getCurrentShift,
  getXReport,
  closeShift,
  getShiftHistory,
  getShiftById,
  recordCashMovement,
  getCashMovements,
  createShiftCashDeposit,
  getShiftCashDeposits,
  verifyShiftCashDeposit,
} from '../controllers/shift.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { tenantContext, verifyTenantLicense } from '../middlewares/saas.middleware';

export const shiftRouter = Router();

// Seluruh rute shift kasir membutuhkan autentikasi dan validasi lisensi
shiftRouter.use(authenticate);
shiftRouter.use(tenantContext);
shiftRouter.use(verifyTenantLicense);

shiftRouter.post('/start', startShift);
shiftRouter.get('/current', getCurrentShift);
shiftRouter.get('/x-report', getXReport);
shiftRouter.post('/close', closeShift);
shiftRouter.post('/cash-movement', recordCashMovement);
shiftRouter.get('/cash-movements', getCashMovements);
shiftRouter.post('/deposits', createShiftCashDeposit);
shiftRouter.get('/deposits', getShiftCashDeposits);
shiftRouter.patch('/deposits/:id/verify', verifyShiftCashDeposit);
shiftRouter.get('/', getShiftHistory);
shiftRouter.get('/:id', getShiftById);
