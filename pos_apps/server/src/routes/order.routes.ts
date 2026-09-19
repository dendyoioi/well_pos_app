import { Router } from 'express';
import {
  checkoutOrder,
  getOrders,
  getOrderById,
  sendOrderEmail,
  holdOrder,
  getHoldOrders,
  deleteHoldOrder,
} from '../controllers/order.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { tenantContext, verifyTenantLicense } from '../middlewares/saas.middleware';

export const orderRouter = Router();

// Semua rute transaksi order membutuhkan autentikasi kasir & verifikasi lisensi tenant
orderRouter.use(authenticate);
orderRouter.use(tenantContext);
orderRouter.use(verifyTenantLicense);

// Fitur Tahan / Simpan Pesanan (Hold Order) - Didaftarkan sebelum /:id
orderRouter.post('/hold', holdOrder);
orderRouter.get('/hold', getHoldOrders);
orderRouter.delete('/hold/:id', deleteHoldOrder);

// Fitur Checkout Penjualan & Riwayat
orderRouter.post('/checkout', checkoutOrder);
orderRouter.get('/', getOrders);
orderRouter.get('/:id', getOrderById);
orderRouter.post('/:id/send-email', sendOrderEmail);

export default orderRouter;
