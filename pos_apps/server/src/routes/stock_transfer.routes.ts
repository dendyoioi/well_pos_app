import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  getTransfers,
  getTransferById,
  createTransfer,
  dispatchTransfer,
  receiveTransfer,
} from '../controllers/stock_transfer.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

export const stockTransferRouter = Router();

// Modul Mutasi & Transfer Stok Antar Toko (Owner, Admin, Supervisor, dan Staf Gudang)
stockTransferRouter.use(authenticate);
stockTransferRouter.use(authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE));

stockTransferRouter.get('/', getTransfers);
stockTransferRouter.get('/:id', getTransferById);
stockTransferRouter.post('/', createTransfer);
stockTransferRouter.post('/:id/dispatch', dispatchTransfer);
stockTransferRouter.post('/:id/receive', receiveTransfer);
