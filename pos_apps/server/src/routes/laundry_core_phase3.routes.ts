import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { Role } from '@prisma/client';
import {
  getPickupRequests,
  assignPickupRequest,
  markPickupFailedAttempt,
  getDriverBoard,
  markOrderDeliveryFailed,
  getAutomationRules,
  updateAutomationRule,
  getNotificationLogs,
  retryNotificationLog,
  simulateNotification,
} from '../controllers/laundry_core_phase3.controller';

const router = Router();

// Seluruh endpoint Core 3 memerlukan autentikasi staf internal
router.use(authenticate);

// ============================================================================
// B. DRIVER ASSIGNMENT & PICKUP / DELIVERY TASK ENDPOINTS
// ============================================================================

// 1. Daftar Permintaan Jemput
router.get(
  '/pickup-requests',
  authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.CASHIER, Role.KITCHEN, Role.WAREHOUSE),
  getPickupRequests
);

// 2. Tugaskan Kurir / Konfirmasi Penjemputan
router.patch(
  '/pickup-requests/:id/assign',
  authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.CASHIER),
  assignPickupRequest
);

// 3. Catat Percobaan Jemput Gagal (Failed Attempt)
router.post(
  '/pickup-requests/:id/failed-attempt',
  authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.CASHIER, Role.WAREHOUSE),
  markPickupFailedAttempt
);

// 4. Papan Tugas Terpadu Driver (Pickups & Deliveries)
router.get(
  '/driver-board',
  authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.CASHIER, Role.WAREHOUSE),
  getDriverBoard
);

// 5. Catat Percobaan Antar Pesanan Gagal (Delivery Failed)
router.post(
  '/orders/:orderId/delivery-failed',
  authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.CASHIER, Role.WAREHOUSE),
  markOrderDeliveryFailed
);

// ============================================================================
// C. CENTRALIZED NOTIFICATION AUTOMATION ENDPOINTS
// ============================================================================

// 6. Ambil Aturan Otomasi Efektif
router.get(
  '/automation/rules',
  authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR),
  getAutomationRules
);

// 7. Simpan / Perbarui Aturan Otomasi Per Event Key
router.put(
  '/automation/rules/:eventKey',
  authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR),
  updateAutomationRule
);

// 8. Riwayat Log Notifikasi Terkirim / Gagal / Di-skip
router.get(
  '/automation/logs',
  authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR),
  getNotificationLogs
);

// 9. Retry Pengiriman Notifikasi yang Gagal
router.post(
  '/automation/logs/:logId/retry',
  authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR),
  retryNotificationLog
);

// 10. Simulasi Notifikasi Cepat
router.post(
  '/automation/simulate',
  authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR),
  simulateNotification
);

export default router;
