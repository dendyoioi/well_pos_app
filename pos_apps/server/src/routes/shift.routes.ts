import { Router } from 'express';
import {
  startShift,
  getCurrentShift,
  getXReport,
  closeShift,
  getShiftHistory,
  getShiftById,
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
shiftRouter.get('/', getShiftHistory);
shiftRouter.get('/:id', getShiftById);
