import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  getTodayAttendance,
  clockIn,
  clockOut,
  getAttendanceReport,
  updateAttendanceConfig,
  autoSyncTimezone,
} from '../controllers/attendance.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { tenantContext, verifyTenantLicense } from '../middlewares/saas.middleware';

export const attendanceRouter = Router();

// Seluruh rute absensi membutuhkan autentikasi dan validasi lisensi tenant
attendanceRouter.use(authenticate);
attendanceRouter.use(tenantContext);
attendanceRouter.use(verifyTenantLicense);

// Operasional Kasir & Staf Terminal (Absensi Mandiri via PIN)
attendanceRouter.get('/today', getTodayAttendance);
attendanceRouter.post('/clock-in', clockIn);
attendanceRouter.post('/clock-out', clockOut);

// Pengaturan & Laporan Backoffice (Khusus Owner, Admin, dan Supervisor)
attendanceRouter.post('/sync-timezone', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), autoSyncTimezone);
attendanceRouter.get('/report', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), getAttendanceReport);
attendanceRouter.put('/config', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), updateAttendanceConfig);
