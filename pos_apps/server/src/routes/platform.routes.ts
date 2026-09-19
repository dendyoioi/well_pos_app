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
platformRouter.post('/tenants/:id/reset-password', authenticatePlatform, resetTenantOwnerPassword);
platformRouter.get('/plans', authenticatePlatform, getPlatformPlans);

export default platformRouter;
