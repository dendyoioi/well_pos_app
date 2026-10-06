import { Router } from 'express';
import {
  checkoutOrder,
  getOrders,
  getOrderById,
  sendOrderEmail,
  holdOrder,
  getHoldOrders,
  deleteHoldOrder,
  createOpenTabOrder,
  getOpenTabs,
  cancelOpenTab,
  getKitchenTicket,
  getDigitalReceipt,
  sendDigitalReceipt,
  voidOrder,
  voidOrderItem,
  sendOrderWhatsApp,
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

// Fitur Tagihan Meja Terbuka (Open Tab / Bayar Nanti)
orderRouter.post('/open-tab', createOpenTabOrder);
orderRouter.get('/open-tabs', getOpenTabs);
orderRouter.post('/:id/cancel-tab', cancelOpenTab);

// Fitur Kitchen Order Ticket (KOT)
orderRouter.get('/:id/kitchen-ticket', getKitchenTicket);

// Fitur Struk Digital & Pengiriman (EPIC-08)
orderRouter.get('/:id/digital-receipt', getDigitalReceipt);
orderRouter.post('/:id/send-receipt', sendDigitalReceipt);

// Fitur Checkout Penjualan & Riwayat
orderRouter.post('/checkout', checkoutOrder);
orderRouter.get('/', getOrders);
orderRouter.get('/:id', getOrderById);
orderRouter.post('/:id/send-email', sendOrderEmail);
orderRouter.post('/:id/send-whatsapp', sendOrderWhatsApp);

// Fitur Pembatalan Transaksi (Void Order) dengan Approval Supervisor/Owner
orderRouter.post('/:id/void', voidOrder);
orderRouter.post('/:id/void-item', voidOrderItem);

export default orderRouter;

