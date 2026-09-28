import { Router } from 'express';
import {
  getPromotions,
  getPromotionById,
  createPromotion,
  updatePromotion,
  deletePromotion,
  validatePromotion,
} from '../controllers/promotion.controller';
import { authenticate } from '../middlewares/auth.middleware';

export const promotionRouter = Router();

promotionRouter.get('/', authenticate, getPromotions);
promotionRouter.get('/:id', authenticate, getPromotionById);
promotionRouter.post('/', authenticate, createPromotion);
promotionRouter.put('/:id', authenticate, updatePromotion);
promotionRouter.delete('/:id', authenticate, deletePromotion);
promotionRouter.post('/validate', authenticate, validatePromotion);
