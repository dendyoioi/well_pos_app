import { Router } from 'express';
import {
  getOutlets,
  getOutletById,
  createOutlet,
  updateOutlet,
  updateOutletFees,
  updateOutletChannels,
  updateOutletPaymentConfig,
} from '../controllers/outlet.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Seluruh rute outlet memerlukan autentikasi login
router.use(authenticate);

router.get('/', getOutlets);
router.get('/:id', getOutletById);
router.post('/', createOutlet);
router.put('/:id', updateOutlet);
router.put('/:id/fees', updateOutletFees);
router.put('/:id/channels', updateOutletChannels);
router.put('/:id/payment-config', updateOutletPaymentConfig);

export default router;
