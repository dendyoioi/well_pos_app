import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import {
  getCustomerPreferences,
  updateCustomerPreferences,
  updateOrderWeight,
  updateOrderQc,
  getLostAndFound,
  createLostAndFound,
  updateLostAndFound,
  getOutletServicesWithPricing,
  setOutletServicePrice,
  getServicePriceHistory,
} from '../controllers/laundry_core_phase1.controller';

const router = Router();

// Seluruh route memerlukan autentikasi
router.use(authenticate);

// ============================================================================
// A. CUSTOMER PREFERENCES & SECONDARY PHONES
// ============================================================================
router.get(
  '/customers/:customerId/preferences',
  authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.CASHIER, Role.KITCHEN),
  getCustomerPreferences
);

router.patch(
  '/customers/:customerId/preferences',
  authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.CASHIER),
  updateCustomerPreferences
);

router.put(
  '/customers/:customerId/preferences',
  authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.CASHIER),
  updateCustomerPreferences
);

// ============================================================================
// B. BERAT AWAL VS BERAT FINAL & QC CHECKLIST
// ============================================================================
router.patch(
  '/orders/:orderId/weight',
  authorize(
    Role.OWNER,
    Role.ADMIN,
    Role.SUPERVISOR,
    Role.CASHIER,
    Role.KITCHEN,
    Role.WAREHOUSE
  ),
  updateOrderWeight
);

router.patch(
  '/orders/:orderId/qc',
  authorize(
    Role.OWNER,
    Role.ADMIN,
    Role.SUPERVISOR,
    Role.CASHIER,
    Role.KITCHEN,
    Role.WAREHOUSE
  ),
  updateOrderQc
);

// ============================================================================
// C. LOST & FOUND (BARANG TERTINGGAL / PAKAIAN TAK BERTUAN)
// ============================================================================
router.get(
  '/lost-and-found',
  authorize(
    Role.OWNER,
    Role.ADMIN,
    Role.SUPERVISOR,
    Role.CASHIER,
    Role.KITCHEN,
    Role.WAREHOUSE
  ),
  getLostAndFound
);

router.post(
  '/lost-and-found',
  authorize(
    Role.OWNER,
    Role.ADMIN,
    Role.SUPERVISOR,
    Role.CASHIER,
    Role.KITCHEN,
    Role.WAREHOUSE
  ),
  createLostAndFound
);

router.patch(
  '/lost-and-found/:id',
  authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.CASHIER),
  updateLostAndFound
);

router.put(
  '/lost-and-found/:id',
  authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.CASHIER),
  updateLostAndFound
);

// ============================================================================
// D. OUTLET PRICING & PRICE HISTORY
// ============================================================================
router.get(
  '/services/outlet-prices',
  authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR, Role.CASHIER),
  getOutletServicesWithPricing
);

router.put(
  '/services/:serviceId/outlet-price',
  authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR),
  setOutletServicePrice
);

router.post(
  '/services/:serviceId/outlet-price',
  authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR),
  setOutletServicePrice
);

router.get(
  '/services/:serviceId/price-history',
  authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR),
  getServicePriceHistory
);

export default router;
