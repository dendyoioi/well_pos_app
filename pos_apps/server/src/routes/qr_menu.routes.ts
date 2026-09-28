import { Router } from 'express';
import { qrMenuController } from '../controllers/qr_menu.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { qrOrderRateLimiter } from '../middlewares/security.middleware';

const router = Router();

// ==========================================
// 1. RUTE PUBLIK (Tamu & Pelanggan Tanpa Login)
// ==========================================
router.get('/public/:outletId', qrMenuController.getPublicMenu);
// Fix S1: Rate limiter mencegah spam pesanan dari bot atau pengguna nakal (maks 10 req/menit per IP)
router.post('/public/order', qrOrderRateLimiter, qrMenuController.submitPublicOrder);

// ==========================================
// 2. RUTE TERPROTEKSI (Backoffice Owner & Kasir)
// ==========================================
router.use(authenticate);

// Meja Restoran
router.get('/tables', qrMenuController.getTables);
router.post('/tables', qrMenuController.createTable);
router.put('/tables/:id', qrMenuController.updateTable);
router.delete('/tables/:id', qrMenuController.deleteTable);

// Pengaturan Buku Menu QR
router.get('/settings', qrMenuController.getSettings);
router.put('/settings', qrMenuController.updateSettings);

// Pesanan Masuk (Live QR Orders Feed)
router.get('/orders', qrMenuController.getQrOrders);
router.patch('/orders/:id/status', qrMenuController.updateOrderStatus);

export default router;
