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
import * as opexController from '../controllers/operational_expense.controller';
import * as targetController from '../controllers/outlet_target.controller';
import * as maintController from '../controllers/machine_maintenance.controller';
import * as alertController from '../controllers/persistent_alert.controller';

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

// =========================================================================
// WAVE 2: CRUD DATA RIIL (OPERATIONAL EXPENSES, BUSINESS TARGETS, MAINTENANCE)
// =========================================================================

// 1. Operational Expenses (Khusus OWNER & ADMIN)
router.get('/operational-expenses', authorize(Role.OWNER, Role.ADMIN), opexController.getOperationalExpenses);
router.post('/operational-expenses', authorize(Role.OWNER, Role.ADMIN), opexController.createOperationalExpense);
router.put('/operational-expenses/:id', authorize(Role.OWNER, Role.ADMIN), opexController.updateOperationalExpense);
router.delete('/operational-expenses/:id', authorize(Role.OWNER, Role.ADMIN), opexController.deleteOperationalExpense);

// 2. Outlet Business Targets (GET: OWNER & ADMIN; PUT/DELETE: Khusus OWNER)
router.get('/targets', authorize(Role.OWNER, Role.ADMIN), targetController.getOutletTargets);
router.put('/targets', authorize(Role.OWNER), targetController.upsertOutletTarget);
router.delete('/targets/:id', authorize(Role.OWNER), targetController.deleteOutletTarget);

// 3. Machine Maintenance Logs (GET/POST/PATCH: OWNER, ADMIN, SUPERVISOR; DELETE: OWNER & ADMIN)
router.get('/machine-maintenance', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), maintController.getMachineMaintenanceLogs);
router.post('/machine-maintenance', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), maintController.createMachineMaintenanceLog);
router.patch('/machine-maintenance/:id', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), maintController.updateMachineMaintenanceLog);
router.delete('/machine-maintenance/:id', authorize(Role.OWNER, Role.ADMIN), maintController.deleteMachineMaintenanceLog);

// =========================================================================
// WAVE 3A: PERSISTENT ALERTING & RULES ENGINE
// =========================================================================

// 1. Persistent Alerts (GET/PATCH: OWNER, ADMIN, SUPERVISOR; EVALUATE: OWNER & ADMIN)
router.get('/alerts', alertController.getPersistentAlerts);
router.post('/alerts/evaluate', authorize(Role.OWNER, Role.ADMIN), alertController.evaluateAlerts);
router.patch('/alerts/:id/status', alertController.updateAlertStatus);

// 2. Alert Rules Configuration (GET: OWNER & ADMIN; PUT: Khusus OWNER)
router.get('/alert-rules', authorize(Role.OWNER, Role.ADMIN), alertController.getAlertRules);
router.put('/alert-rules', authorize(Role.OWNER), alertController.upsertAlertRule);

export { router as laundryAnalyticsRouter };
export default router;
