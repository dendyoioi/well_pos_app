import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import {
  getBatches,
  createBatch,
  updateBatchStatus,
  getOrderItems,
  createOrderItems,
  scanItemByTag,
  updateItem,
  partialHandover,
  getProductionQueue,
} from '../controllers/laundry_core_phase2.controller';

const router = Router();

// Seluruh route Laundry Core Phase 2 wajib terotentikasi
router.use(authenticate);

// ============================================================================
// A. LAUNDRY BATCH MANAGEMENT
// ============================================================================

router.get(
  '/batches',
  authorize(
    Role.OWNER,
    Role.ADMIN,
    Role.SUPERVISOR,
    Role.CASHIER,
    Role.KITCHEN,
    Role.WAREHOUSE
  ),
  getBatches
);

router.post(
  '/batches',
  authorize(
    Role.OWNER,
    Role.ADMIN,
    Role.SUPERVISOR,
    Role.KITCHEN,
    Role.WAREHOUSE,
    Role.CASHIER
  ),
  createBatch
);

router.patch(
  '/batches/:batchId/status',
  authorize(
    Role.OWNER,
    Role.ADMIN,
    Role.SUPERVISOR,
    Role.KITCHEN,
    Role.WAREHOUSE,
    Role.CASHIER
  ),
  updateBatchStatus
);

// ============================================================================
// B. ITEM-LEVEL TRACKING & QR/BARCODE SCAN
// ============================================================================

router.get(
  '/orders/:orderId/items',
  authorize(
    Role.OWNER,
    Role.ADMIN,
    Role.SUPERVISOR,
    Role.CASHIER,
    Role.KITCHEN,
    Role.WAREHOUSE
  ),
  getOrderItems
);

router.post(
  '/orders/:orderId/items',
  authorize(
    Role.OWNER,
    Role.ADMIN,
    Role.SUPERVISOR,
    Role.CASHIER,
    Role.KITCHEN,
    Role.WAREHOUSE
  ),
  createOrderItems
);

router.get(
  '/items/scan/:tagCode',
  authorize(
    Role.OWNER,
    Role.ADMIN,
    Role.SUPERVISOR,
    Role.CASHIER,
    Role.KITCHEN,
    Role.WAREHOUSE
  ),
  scanItemByTag
);

router.patch(
  '/items/:itemId',
  authorize(
    Role.OWNER,
    Role.ADMIN,
    Role.SUPERVISOR,
    Role.CASHIER,
    Role.KITCHEN,
    Role.WAREHOUSE
  ),
  updateItem
);

// ============================================================================
// C. SPLIT ORDER & PARTIAL HANDOVER
// ============================================================================

router.post(
  '/orders/:orderId/partial-handover',
  authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.CASHIER),
  partialHandover
);

// ============================================================================
// D. SMART PRODUCTION QUEUE
// ============================================================================

router.get(
  '/production-queue',
  authorize(
    Role.OWNER,
    Role.ADMIN,
    Role.SUPERVISOR,
    Role.CASHIER,
    Role.KITCHEN,
    Role.WAREHOUSE
  ),
  getProductionQueue
);

export default router;
