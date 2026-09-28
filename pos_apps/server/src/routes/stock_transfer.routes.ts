import { Router } from 'express';
import {
  getTransfers,
  getTransferById,
  createTransfer,
  dispatchTransfer,
  receiveTransfer,
} from '../controllers/stock_transfer.controller';
import { authenticate } from '../middlewares/auth.middleware';

export const stockTransferRouter = Router();

stockTransferRouter.get('/', authenticate, getTransfers);
stockTransferRouter.get('/:id', authenticate, getTransferById);
stockTransferRouter.post('/', authenticate, createTransfer);
stockTransferRouter.post('/:id/dispatch', authenticate, dispatchTransfer);
stockTransferRouter.post('/:id/receive', authenticate, receiveTransfer);
