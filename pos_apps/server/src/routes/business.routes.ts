import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import {
  getBusinesses,
  createBusiness,
  updateBusiness,
  getTokenSummary,
} from '../controllers/business.controller';

const router = Router();

// Seluruh rute bisnis memerlukan autentikasi
router.use(authenticate);

// 1. List bisnis milik tenant
router.get('/', authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), getBusinesses);

// 2. Ringkasan saldo token bersama
router.get('/token-summary', authorize(Role.OWNER), getTokenSummary);

// 3. Buat bisnis baru beserta outlet pertama
router.post('/', authorize(Role.OWNER), createBusiness);

// 4. Perbarui bisnis
router.patch('/:id', authorize(Role.OWNER), updateBusiness);

export default router;
