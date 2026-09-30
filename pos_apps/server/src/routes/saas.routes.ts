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
  handleBillingWebhook,
} from '../controllers/saas.controller';
import {
  handlePakasirWebhook,
  checkPakasirInvoiceStatus,
  simulateSandboxPayment,
} from '../controllers/pakasir.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { tenantContext } from '../middlewares/saas.middleware';

export const saasRouter = Router();

// Endpoint Pendaftaran Mandiri (Public)
saasRouter.post('/register', registerClient);

// Endpoint Pembuatan Toko Perdana dari Full-Screen Wizard (Memerlukan Login Owner)
saasRouter.post('/stores/create-initial', authenticate, tenantContext, createInitialStore);

// Endpoint Onboarding Toko (Memerlukan Login Owner)
saasRouter.post('/onboarding', authenticate, tenantContext, onboardingClient);

// Endpoint Informasi Status Langganan & Masa Aktif
saasRouter.get('/subscription', authenticate, tenantContext, getSubscriptionStatus);
saasRouter.get('/my-subscription', authenticate, tenantContext, getSubscriptionStatus);

// Endpoint Kuota Token & Top-Up Mandiri oleh Pemilik Toko
saasRouter.post('/subscription/top-up', authenticate, tenantContext, topUpSubscriptionTokens);
saasRouter.get('/promos/validate', authenticate, tenantContext, validateTenantPromoCode);
saasRouter.get('/payment-config', authenticate, tenantContext, getPublicPlatformPaymentConfig);

// Endpoint Tagihan & Invoice Langganan
saasRouter.post('/invoices', authenticate, tenantContext, createSubscriptionInvoice);
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

