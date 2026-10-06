import { Router } from 'express';
import {
  registerClient,
  createInitialStore,
  onboardingClient,
  getSubscriptionStatus,
  createSubscriptionInvoice,
  getSubscriptionInvoices,
  topUpSubscriptionTokens,
  validateTenantPromoCode,
  getPublicPlatformPaymentConfig,
  getPublicPlatformConfig,
  validateRegistrationPromoCode,
  getPublicPublishedPromos,
  getTenantNotifications,
  handleBillingWebhook,
} from '../controllers/saas.controller';
import {
  handlePakasirWebhook,
  checkPakasirInvoiceStatus,
  simulateSandboxPayment,
} from '../controllers/pakasir.controller';
import { Role } from '@prisma/client';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { tenantContext } from '../middlewares/saas.middleware';

export const saasRouter = Router();

// Endpoint Pendaftaran Mandiri & Info Publik (Public)
saasRouter.post('/register', registerClient);
saasRouter.get('/public-config', getPublicPlatformConfig);
saasRouter.get('/promos/validate-registration', validateRegistrationPromoCode);
saasRouter.get('/promos/public', getPublicPublishedPromos);

// Endpoint Pembuatan Toko Perdana dari Full-Screen Wizard (Memerlukan Login Owner)
saasRouter.post('/stores/create-initial', authenticate, tenantContext, authorize(Role.OWNER, Role.ADMIN), createInitialStore);

// Endpoint Onboarding Toko (Memerlukan Login Owner)
saasRouter.post('/onboarding', authenticate, tenantContext, authorize(Role.OWNER, Role.ADMIN), onboardingClient);

// Endpoint Informasi Status Langganan & Masa Aktif
saasRouter.get('/subscription', authenticate, tenantContext, getSubscriptionStatus);
saasRouter.get('/my-subscription', authenticate, tenantContext, getSubscriptionStatus);

// Endpoint Kuota Token & Top-Up Mandiri oleh Pemilik Toko
saasRouter.post('/subscription/top-up', authenticate, tenantContext, authorize(Role.OWNER, Role.ADMIN), topUpSubscriptionTokens);
saasRouter.get('/promos/validate', authenticate, tenantContext, validateTenantPromoCode);
saasRouter.get('/payment-config', authenticate, tenantContext, getPublicPlatformPaymentConfig);
saasRouter.get('/notifications', authenticate, tenantContext, getTenantNotifications);

// Endpoint Tagihan & Invoice Langganan
saasRouter.post('/invoices', authenticate, tenantContext, authorize(Role.OWNER, Role.ADMIN), createSubscriptionInvoice);
saasRouter.get('/invoices', authenticate, tenantContext, getSubscriptionInvoices);

// Endpoint Callback Webhook Payment Gateway (Public)
saasRouter.post('/billing/webhook', handleBillingWebhook);

// =========================================================================
// PAKASIR.COM PAYMENT GATEWAY (API v2) — DIRECT QRIS & WEBHOOK
// =========================================================================
saasRouter.post('/pakasir/webhook', handlePakasirWebhook);
saasRouter.get('/pakasir/status/:invoiceNumber', checkPakasirInvoiceStatus);
saasRouter.post('/pakasir/simulate-sandbox-pay', simulateSandboxPayment);

export default saasRouter;

