import { Router } from 'express';
import {
  getFinancialSummary,
  getShiftDiscrepancies,
  getProductPerformance,
  getDeadStockReport,
  exportReport,
} from '../controllers/report.controller';
import { authenticate } from '../middlewares/auth.middleware';

export const reportRouter = Router();

// Seluruh endpoint analitik & laporan membutuhkan autentikasi
reportRouter.use(authenticate);

reportRouter.get('/financial', getFinancialSummary);
reportRouter.get('/shifts', getShiftDiscrepancies);
reportRouter.get('/product-performance', getProductPerformance);
reportRouter.get('/dead-stock', getDeadStockReport);
reportRouter.get('/export', exportReport);
