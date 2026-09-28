export type UserRole = 'OWNER' | 'ADMIN' | 'SUPERVISOR' | 'WAREHOUSE' | 'CASHIER';

export interface Outlet {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
}

export interface TenantSubscriptionInfo {
  planCode: 'FREE' | 'PRO' | string;
  planName?: string;
  features: string[];
  isPro: boolean;
  isFree: boolean;
  expiresAt?: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  userCode?: string | null;
  role: UserRole;
  pin?: string | null;
  hasPin?: boolean;
  tenantId?: string | null;
  outletId?: string | null;
  canCashOut?: boolean;
  outlet?: Outlet | null;
  tenant?: { id: string; name: string; phone?: string | null; slug?: string } | null;
  subscription?: TenantSubscriptionInfo | null;
}

export interface AuthResponse {
  status: 'success' | 'error';
  message: string;
  code?: string;
  tenantName?: string;
  data?: {
    token: string;
    user: User;
  };
}

export type PermissionCategory =
  | 'REGISTER_SALES'
  | 'CATALOG_RECIPES'
  | 'INVENTORY_STOCK'
  | 'REPORTS_FINANCIAL'
  | 'SETTINGS_GOVERNANCE';

export interface PermissionDefinition {
  id: string;
  label: string;
  description: string;
  category: PermissionCategory;
}

export interface RolePermissions {
  id: string;
  name: string;
  description?: string;
  status: boolean;
  isDefault?: boolean;
  staffCount?: number;
  permissions?: string[];
  functionalPermissions?: {
    WEB: string[];
    POS: string[];
    HANDHELD: string[];
    IOS: string[];
  };
  businessPermissions?: {
    orderDiscount?: {
      maxPercent: number;
      maxAmount: number;
    };
    productDiscount?: {
      maxPercent: number;
      maxAmount: number;
    };
  };
}

