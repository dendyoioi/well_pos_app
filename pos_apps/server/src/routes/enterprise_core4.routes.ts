import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';
import {
  getPurchaseRequests,
  createPurchaseRequest,
  reviewPurchaseRequest,
  convertToPurchaseOrder,
  getSupplierInvoices,
  createSupplierInvoice,
  paySupplierInvoice,
  getOvertimeRequests,
  createOvertimeRequest,
  reviewOvertimeRequest,
  getLeaveRequests,
  createLeaveRequest,
  reviewLeaveRequest,
  getPayrollSlips,
  generatePayrollSlip,
  updatePayrollSlipStatus,
  getGlobalAuditLogs,
} from '../controllers/enterprise_core4.controller';

const router = Router();

// Seluruh endpoint Core Phase 4 Enterprise Support memerlukan autentikasi
router.use(authenticate);

// ============================================================================
// A. PROCUREMENT 6-STAGE
// ============================================================================

// 1. Daftar Purchase Request
router.get(
  '/procurement/requests',
  authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE),
  getPurchaseRequests
);

// 2. Buat Purchase Request Baru
router.post(
  '/procurement/requests',
  authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE),
  createPurchaseRequest
);

// 3. Review Approval / Rejection Purchase Request (Khusus OWNER / ADMIN)
router.post(
  '/procurement/requests/:id/review',
  authorize(Role.OWNER, Role.ADMIN),
  reviewPurchaseRequest
);

// 4. Konversi PR Approved menjadi Purchase Order resmi
router.post(
  '/procurement/requests/:id/convert-to-po',
  authorize(Role.OWNER, Role.ADMIN, Role.WAREHOUSE),
  convertToPurchaseOrder
);

// 5. Daftar Invoice / Tagihan Supplier (AP)
router.get(
  '/procurement/invoices',
  authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.WAREHOUSE),
  getSupplierInvoices
);

// 6. Buat Tagihan Supplier Baru (AP)
router.post(
  '/procurement/invoices',
  authorize(Role.OWNER, Role.ADMIN, Role.WAREHOUSE),
  createSupplierInvoice
);

// 7. Pembayaran Tagihan Supplier (Khusus OWNER / ADMIN)
router.post(
  '/procurement/invoices/:id/payments',
  authorize(Role.OWNER, Role.ADMIN),
  paySupplierInvoice
);

// ============================================================================
// B. WORKFORCE ENTERPRISE — OVERTIME, LEAVE, & PAYROLL REKAP
// ============================================================================

// 8. Daftar Pengajuan Lembur
router.get(
  '/workforce/overtimes',
  getOvertimeRequests
);

// 9. Buat Pengajuan Lembur
router.post(
  '/workforce/overtimes',
  createOvertimeRequest
);

// 10. Review Persetujuan Lembur
router.post(
  '/workforce/overtimes/:id/review',
  authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR),
  reviewOvertimeRequest
);

// 11. Daftar Pengajuan Cuti / Izin
router.get(
  '/workforce/leaves',
  getLeaveRequests
);

// 12. Buat Pengajuan Cuti / Izin
router.post(
  '/workforce/leaves',
  createLeaveRequest
);

// 13. Review Persetujuan Cuti / Izin
router.post(
  '/workforce/leaves/:id/review',
  authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR),
  reviewLeaveRequest
);

// 14. Daftar Slip Gaji / Rekap Payroll
router.get(
  '/workforce/payroll',
  authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR),
  getPayrollSlips
);

// 15. Generate / Upsert Slip Gaji (Khusus OWNER / ADMIN)
router.post(
  '/workforce/payroll/generate',
  authorize(Role.OWNER, Role.ADMIN),
  generatePayrollSlip
);

// 16. Update Status Slip Gaji (FINALIZED / PAID)
router.post(
  '/workforce/payroll/:id/status',
  authorize(Role.OWNER, Role.ADMIN),
  updatePayrollSlipStatus
);

// ============================================================================
// C. GLOBAL AUDIT TRAIL
// ============================================================================

// 17. Daftar Audit Log Sistem
router.get(
  '/audit-logs',
  authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR),
  getGlobalAuditLogs
);

export default router;
