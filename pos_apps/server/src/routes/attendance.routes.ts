import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  getTodayAttendance,
  clockIn,
  clockOut,
  getAttendanceReport,
  updateAttendanceConfig,
  autoSyncTimezone,
  getWorkShiftTemplates,
  createWorkShiftTemplate,
  updateWorkShiftTemplate,
  deleteWorkShiftTemplate,
  getStaffWorkSchedules,
  bulkUpsertStaffWorkSchedules,
  autoGenerateStaffWorkSchedules,
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

// --- Modul Master Template Shift Kerja (Fase B) ---
attendanceRouter.get('/shift-templates', getWorkShiftTemplates);
attendanceRouter.post('/shift-templates', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), createWorkShiftTemplate);
attendanceRouter.patch('/shift-templates/:id', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), updateWorkShiftTemplate);
attendanceRouter.put('/shift-templates/:id', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), updateWorkShiftTemplate);
attendanceRouter.delete('/shift-templates/:id', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), deleteWorkShiftTemplate);

// --- Modul Roster Jadwal Kerja & Auto-Penjadwalan (Fase B) ---
attendanceRouter.get('/schedules', getStaffWorkSchedules);
attendanceRouter.post('/schedules/bulk-upsert', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), bulkUpsertStaffWorkSchedules);
attendanceRouter.post('/schedules/auto-generate', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), autoGenerateStaffWorkSchedules);
