import { Router } from 'express';
import {
  loginWithPassword,
  loginWithPin,
  getProfile,
  pairDevice,
  getPairedOutletCashiers,
} from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';

export const authRouter = Router();

/**
 * @route POST /api/auth/login
 * @desc Login user menggunakan Email dan Password (Portal Pemilik/Backoffice)
 */
authRouter.post('/login', loginWithPassword);

/**
 * @route POST /api/auth/pin-login
 * @desc Login cepat kasir / supervisor menggunakan PIN 6 digit
 */
authRouter.post('/pin-login', loginWithPin);

/**
 * @route POST /api/auth/pair-device
 * @desc Menghubungkan (Pairing) perangkat tablet/PC kasir ke Toko menggunakan ID Unik + PIN Owner/SPV
 */
authRouter.post('/pair-device', pairDevice);

/**
 * @route GET /api/auth/paired-cashiers
 * @desc Mengambil daftar staf kasir aktif pada outlet yang terpasang di perangkat ini
 */
authRouter.get('/paired-cashiers', getPairedOutletCashiers);

/**
 * @route GET /api/auth/me
 * @desc Mendapatkan data profil akun yang sedang login (membutuhkan Bearer Token)
 */
authRouter.get('/me', authenticate, getProfile);

