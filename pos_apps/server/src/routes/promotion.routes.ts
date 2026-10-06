import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  getPromotions,
  getPromotionById,
  createPromotion,
  updatePromotion,
  deletePromotion,
  validatePromotion,
} from '../controllers/promotion.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

export const promotionRouter = Router();

// Read-only promo & validasi kupon (Kasir memerlukan ini untuk checkout nota)
promotionRouter.get('/', authenticate, getPromotions);
promotionRouter.get('/:id', authenticate, getPromotionById);
promotionRouter.post('/validate', authenticate, validatePromotion);

// Mutasi Aturan Promosi & Diskon (Khusus Owner, Admin, dan Supervisor)
promotionRouter.post('/', authenticate, authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), createPromotion);
promotionRouter.put('/:id', authenticate, authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), updatePromotion);
promotionRouter.delete('/:id', authenticate, authorize(Role.OWNER, Role.ADMIN, Role.SUPERVISOR), deletePromotion);
