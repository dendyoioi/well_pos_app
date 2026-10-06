import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  getOutlets,
  getOutletById,
  createOutlet,
  updateOutlet,
  updateOutletFees,
  updateOutletChannels,
  updateOutletPaymentConfig,
} from '../controllers/outlet.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

// Seluruh rute outlet memerlukan autentikasi login
router.use(authenticate);

// Read-only (Kasir & seluruh staf perlu membaca info cabang)
router.get('/', getOutlets);
router.get('/:id', getOutletById);

// Modifikasi Pengaturan Toko & Pajak (Khusus Owner, Admin, dan Supervisor)
router.post('/', authorize(Role.OWNER, Role.ADMIN), createOutlet);
router.put('/:id', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), updateOutlet);
router.put('/:id/fees', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), updateOutletFees);
router.put('/:id/channels', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), updateOutletChannels);
router.put('/:id/payment-config', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), updateOutletPaymentConfig);

export default router;
