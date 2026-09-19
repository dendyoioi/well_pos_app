export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'WAREHOUSE' | 'CASHIER';

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
  role: UserRole;
  pin?: string | null;
  tenantId?: string | null;
  outletId?: string | null;
  outlet?: Outlet | null;
  tenant?: { id: string; name: string } | null;
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
