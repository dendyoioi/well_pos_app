import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  getFinancialSummary,
  getShiftDiscrepancies,
  getProductPerformance,
  getDeadStockReport,
  exportReport,
  getCashFlowSummary,
  getSalesPerformanceTrend,
} from '../controllers/report.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

export const reportRouter = Router();

// Seluruh endpoint analitik & laporan finansial membutuhkan autentikasi dan wewenang manajerial
reportRouter.use(authenticate);
reportRouter.use(authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR));

reportRouter.get('/financial', getFinancialSummary);
reportRouter.get('/cash-flow', getCashFlowSummary);
reportRouter.get('/sales-performance', getSalesPerformanceTrend);
reportRouter.get('/shifts', getShiftDiscrepancies);
reportRouter.get('/product-performance', getProductPerformance);
reportRouter.get('/dead-stock', getDeadStockReport);
reportRouter.get('/export', exportReport);
