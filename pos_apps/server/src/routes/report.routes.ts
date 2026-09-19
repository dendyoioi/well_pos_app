import { Router } from 'express';
import { getFinancialSummary } from '../controllers/report.controller';
import { authenticate } from '../middlewares/auth.middleware';

export const reportRouter = Router();

// Laporan finansial membutuhkan autentikasi
reportRouter.use(authenticate);

reportRouter.get('/financial', getFinancialSummary);
