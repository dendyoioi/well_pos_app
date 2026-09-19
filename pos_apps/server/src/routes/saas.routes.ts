import { Router } from 'express';
import {
  registerClient,
  onboardingClient,
  getSubscriptionStatus,
} from '../controllers/saas.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { tenantContext } from '../middlewares/saas.middleware';

export const saasRouter = Router();

// Endpoint Pendaftaran Mandiri (Public)
saasRouter.post('/register', registerClient);

// Endpoint Onboarding Toko (Memerlukan Login Owner)
saasRouter.post('/onboarding', authenticate, tenantContext, onboardingClient);

// Endpoint Informasi Status Langganan & Masa Aktif
saasRouter.get('/subscription', authenticate, tenantContext, getSubscriptionStatus);
saasRouter.get('/my-subscription', authenticate, tenantContext, getSubscriptionStatus);

export default saasRouter;
