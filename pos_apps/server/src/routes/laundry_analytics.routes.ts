/**
 * Laundry Analytics Routes
 * Laundry Outlet Performance Intelligence (Well POS)
 * 
 * Mendefinisikan seluruh endpoint analitik dengan proteksi autentikasi JWT
 * dan Role-Based Access Control (RBAC) resmi (OWNER, ADMIN, SUPERVISOR).
 */

import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import * as laundryAnalyticsController from '../controllers/laundry_analytics.controller';

const router = Router();

// Proteksi global untuk seluruh rute analitik: wajib token valid & role minimal SUPERVISOR
router.use(authenticate);
router.use(authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR));

// Diagnostic Meta Route (Sanity check & resolver verification)
router.get('/meta', laundryAnalyticsController.getMeta);

// Executive Overview Route (Tersedia untuk OWNER, ADMIN, SUPERVISOR; field finansial disanitasi untuk SUPERVISOR)
router.get('/overview', laundryAnalyticsController.getOverview);

// Restricted to OWNER & ADMIN (SUPERVISOR langsung ditolak dengan HTTP 403 Forbidden)
router.get('/financial', authorize(Role.OWNER, Role.ADMIN), laundryAnalyticsController.getFinancial);
router.get('/sales', authorize(Role.OWNER, Role.ADMIN), laundryAnalyticsController.getSales);
router.get('/customers', authorize(Role.OWNER, Role.ADMIN), laundryAnalyticsController.getCustomers);
router.get('/ai/summary', authorize(Role.OWNER, Role.ADMIN), laundryAnalyticsController.getAiSummary);

// Operational Routes (Tersedia untuk OWNER, ADMIN, SUPERVISOR dengan outlet scoping)
router.get('/operations', laundryAnalyticsController.getOperations);
router.get('/employees', laundryAnalyticsController.getEmployees);
router.get('/machines', laundryAnalyticsController.getMachines);
router.get('/inventory', laundryAnalyticsController.getInventory);
router.get('/drilldown', laundryAnalyticsController.getDrilldown);

// Cross-Outlet Benchmark & AI Forecast/Query: Khusus OWNER saja (Kerahasiaan komparasi multi-cabang & query strategis)
router.get('/benchmark', authorize(Role.OWNER), laundryAnalyticsController.getBenchmark);
router.get('/ai/forecast', authorize(Role.OWNER), laundryAnalyticsController.getAiForecast);
router.post('/ai/query', authorize(Role.OWNER), laundryAnalyticsController.postAiQuery);

export { router as laundryAnalyticsRouter };
export default router;
