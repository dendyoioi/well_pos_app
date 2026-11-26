import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  getPortalOutletInfo,
  createPortalSession,
  getPortalCustomerMe,
  createPortalPickupRequest,
} from '../controllers/laundry_core_phase3.controller';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'wellpos-default-jwt-secret';

/**
 * Middleware autentikasi khusus sesi portal pelanggan mandiri
 */
export const authenticatePortalCustomer = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'error',
      message: 'Token sesi portal pelanggan diperlukan',
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== 'CUSTOMER_PORTAL') {
      return res.status(403).json({
        status: 'error',
        message: 'Token otentikasi bukan sesi portal pelanggan',
      });
    }
    (req as any).portalUser = payload;
    next();
  } catch (err) {
    return res.status(401).json({
      status: 'error',
      message: 'Sesi portal telah kedaluwarsa atau tidak valid',
    });
  }
};

// 1. Info Publik Outlet & Katalog Layanan
router.get('/outlet/:outletId', getPortalOutletInfo);

// 2. Mulai / Verifikasi Sesi Portal via Nomor HP (Passwordless / Guest)
router.post('/session', createPortalSession);

// 3. Profil Pelanggan, Saldo/Kuota Laundry, & Order Aktif (Memerlukan Token Sesi Portal)
router.get('/me', authenticatePortalCustomer, getPortalCustomerMe);

// 4. Kirim Permintaan Jemput Cucian Mandiri (Memerlukan Token Sesi Portal)
router.post('/pickup-requests', authenticatePortalCustomer, createPortalPickupRequest);

export default router;
