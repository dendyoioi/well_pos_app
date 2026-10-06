import { Router } from 'express';
import {
  loginPlatformUser,
  authenticatePlatform,
  getPlatformDashboard,
  getPlatformTenants,
  getPlatformTenantDetail,
  updateTenantStatus,
  updateTenantSubscription,
  impersonateTenant,
  resetTenantOwnerPassword,
  getPlatformPlans,
  toggleOutletStatus,
  getPlatformInvoices,
  verifyPlatformInvoicePayment,
  triggerLicenseLifecycleEvaluation,
  getPlatformUsers,
  createPlatformUser,
  updatePlatformUser,
  deletePlatformUser,
  getPlatformPromos,
  createPlatformPromo,
  updatePlatformPromo,
  togglePlatformPromo,
  togglePublishPlatformPromo,
  deletePlatformPromo,
  getPlatformPaymentSettings,
  updatePlatformPaymentSettings,
  getPlatformNotifications,
  createPlatformNotification,
  deletePlatformNotification,
  getPlatformWhatsAppSettings,
  updatePlatformWhatsAppSettings,
  testPlatformWhatsAppConnection,
} from '../controllers/platform.controller';

export const platformRouter = Router();

// Login Superadmin Platform
platformRouter.post('/auth/login', loginPlatformUser);

// Rute Terproteksi Khusus Superadmin Platform Level 1
platformRouter.get('/dashboard', authenticatePlatform, getPlatformDashboard);
platformRouter.get('/tenants', authenticatePlatform, getPlatformTenants);
platformRouter.get('/tenants/:id', authenticatePlatform, getPlatformTenantDetail);
platformRouter.put('/tenants/:id/status', authenticatePlatform, updateTenantStatus);
platformRouter.patch('/tenants/:id/status', authenticatePlatform, updateTenantStatus);
platformRouter.put('/tenants/:id/subscription', authenticatePlatform, updateTenantSubscription);
platformRouter.patch('/tenants/:id/subscription', authenticatePlatform, updateTenantSubscription);
platformRouter.post('/tenants/:id/impersonate', authenticatePlatform, impersonateTenant);
platformRouter.patch('/outlets/:id/status', authenticatePlatform, toggleOutletStatus);
platformRouter.post('/tenants/:id/reset-password', authenticatePlatform, resetTenantOwnerPassword);
platformRouter.get('/plans', authenticatePlatform, getPlatformPlans);

// Rute Invoice & Billing SaaS
platformRouter.get('/invoices', authenticatePlatform, getPlatformInvoices);
platformRouter.post('/invoices/:id/verify-payment', authenticatePlatform, verifyPlatformInvoicePayment);

// Rute Manajemen Tim Staff Platform (RBAC)
platformRouter.get('/users', authenticatePlatform, getPlatformUsers);
platformRouter.post('/users', authenticatePlatform, createPlatformUser);
platformRouter.patch('/users/:id', authenticatePlatform, updatePlatformUser);
platformRouter.delete('/users/:id', authenticatePlatform, deletePlatformUser);

// Rute Master Promo SaaS Platform (B2B)
platformRouter.get('/promos', authenticatePlatform, getPlatformPromos);
platformRouter.post('/promos', authenticatePlatform, createPlatformPromo);
platformRouter.put('/promos/:id', authenticatePlatform, updatePlatformPromo);
platformRouter.patch('/promos/:id', authenticatePlatform, updatePlatformPromo);
platformRouter.patch('/promos/:id/toggle', authenticatePlatform, togglePlatformPromo);
platformRouter.patch('/promos/:id/toggle-publish', authenticatePlatform, togglePublishPlatformPromo);
platformRouter.delete('/promos/:id', authenticatePlatform, deletePlatformPromo);

// Rute Konfigurasi Pembayaran & QRIS Statis Platform
platformRouter.get('/payment-config', authenticatePlatform, getPlatformPaymentSettings);
platformRouter.put('/payment-config', authenticatePlatform, updatePlatformPaymentSettings);

// Rute Konfigurasi WhatsApp Gateway Platform (Fonnte)
platformRouter.get('/whatsapp/settings', authenticatePlatform, getPlatformWhatsAppSettings);
platformRouter.put('/whatsapp/settings', authenticatePlatform, updatePlatformWhatsAppSettings);
platformRouter.post('/whatsapp/test', authenticatePlatform, testPlatformWhatsAppConnection);

// Rute Pengelolaan Notifikasi & Pengumuman Superadmin
platformRouter.get('/notifications', authenticatePlatform, getPlatformNotifications);
platformRouter.post('/notifications', authenticatePlatform, createPlatformNotification);
platformRouter.delete('/notifications/:id', authenticatePlatform, deletePlatformNotification);

// Rute Lifecycle Worker & Auto-Suspension Trigger
platformRouter.post('/subscriptions/evaluate-lifecycle', authenticatePlatform, triggerLicenseLifecycleEvaluation);

export default platformRouter;

