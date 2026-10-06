import { Router } from 'express';
import {
  getTodayAttendance,
  clockIn,
  clockOut,
  getAttendanceReport,
  updateAttendanceConfig,
  autoSyncTimezone,
} from '../controllers/attendance.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { tenantContext, verifyTenantLicense } from '../middlewares/saas.middleware';

export const attendanceRouter = Router();

// Seluruh rute absensi membutuhkan autentikasi dan validasi lisensi tenant
attendanceRouter.use(authenticate);
attendanceRouter.use(tenantContext);
attendanceRouter.use(verifyTenantLicense);

// Operasional Kasir & Staf Terminal
attendanceRouter.get('/today', getTodayAttendance);
attendanceRouter.post('/clock-in', clockIn);
attendanceRouter.post('/clock-out', clockOut);
attendanceRouter.post('/sync-timezone', autoSyncTimezone);

// Pengaturan & Laporan Backoffice Owner
attendanceRouter.get('/report', getAttendanceReport);
attendanceRouter.put('/config', updateAttendanceConfig);
