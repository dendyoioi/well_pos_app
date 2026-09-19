import type { AuthResponse, User } from '../types/auth';
import type { Category, Product, StockMovement, LowStockProduct } from '../types/product';
import type { CheckoutPayload, Order, HoldOrder } from '../types/order';
import type { Customer, CustomerFormData, CustomerSummaryStats } from '../types/customer';
import type { Outlet, OutletFee } from '../types/outlet';

const TOKEN_KEY = 'pos_auth_token';
const USER_KEY = 'pos_auth_user';
const PLATFORM_TOKEN_KEY = 'platform_auth_token';
const PLATFORM_USER_KEY = 'platform_auth_user';

export const authStorage = {
  getToken: (): string | null => localStorage.getItem(TOKEN_KEY),
  getUser: (): User | null => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  saveSession: (token: string, user: User) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clearSession: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

const PAIRED_DEVICE_KEY = 'wellpos_paired_device';

export interface PairedDeviceContext {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  outletId: string;
  outletName: string;
  pairedAt: string;
}

export const pairedDeviceStorage = {
  get: (): PairedDeviceContext | null => {
    const raw = localStorage.getItem(PAIRED_DEVICE_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  set: (data: PairedDeviceContext) => {
    localStorage.setItem(PAIRED_DEVICE_KEY, JSON.stringify(data));
  },
  clear: () => {
    localStorage.removeItem(PAIRED_DEVICE_KEY);
  },
};

export const platformStorage = {
  getToken: (): string | null => localStorage.getItem(PLATFORM_TOKEN_KEY),
  getUser: (): any | null => {
    const raw = localStorage.getItem(PLATFORM_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  saveSession: (token: string, user: any) => {
    localStorage.setItem(PLATFORM_TOKEN_KEY, token);
    localStorage.setItem(PLATFORM_USER_KEY, JSON.stringify(user));
  },
  clearSession: () => {
    localStorage.removeItem(PLATFORM_TOKEN_KEY);
    localStorage.removeItem(PLATFORM_USER_KEY);
  },
};

const authHeader = (): Record<string, string> => {
  const token = authStorage.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const platformAuthHeader = (): Record<string, string> => {
  const token = platformStorage.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const api = {
  // ----------------------------------------------------
  // AUTENTIKASI
  // ----------------------------------------------------
  loginWithPassword: async (email: string, password: string): Promise<AuthResponse> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  loginWithPin: async (
    pin: string,
    email?: string,
    outletId?: string,
    tenantId?: string
  ): Promise<AuthResponse> => {
    const res = await fetch('/api/auth/pin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, email, outletId, tenantId }),
    });
    return res.json();
  },

  pairDevice: async (storeIdentifier: string, authPin: string): Promise<{
    status: string;
    message: string;
    data?: {
      tenant: { id: string; businessName: string; slug: string; phone?: string };
      outlets: Array<{ id: string; name: string; address?: string; phone?: string }>;
      authorizedBy: string;
    };
  }> => {
    const res = await fetch('/api/auth/pair-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeIdentifier, authPin }),
    });
    return res.json();
  },

  getPairedOutletCashiers: async (
    tenantId: string,
    outletId?: string
  ): Promise<{
    status: string;
    data: Array<{ id: string; name: string; role: string; email: string }>;
  }> => {
    const query = new URLSearchParams({ tenantId });
    if (outletId) query.append('outletId', outletId);
    const res = await fetch(`/api/auth/paired-cashiers?${query.toString()}`);
    return res.json();
  },

  getProfile: async (): Promise<{ status: string; data?: User; message?: string }> => {
    const res = await fetch('/api/auth/me', {
      headers: authHeader(),
    });
    return res.json();
  },

  checkHealth: async (): Promise<{ status: string; message: string }> => {
    const res = await fetch('/api/health');
    return res.json();
  },

  // ----------------------------------------------------
  // KATEGORI
  // ----------------------------------------------------
  getCategories: async (outletId?: string, isActive?: string): Promise<{ status: string; data: Category[] }> => {
    const query = new URLSearchParams();
    if (outletId) query.append('outletId', outletId);
    if (isActive) query.append('isActive', isActive);
    const url = `/api/categories${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await fetch(url, {
      headers: authHeader(),
    });
    return res.json();
  },

  createCategory: async (name: string): Promise<{ status: string; data?: Category; message?: string }> => {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify({ name }),
    });
    return res.json();
  },

  updateCategory: async (id: string, name: string): Promise<{ status: string; data?: Category; message?: string }> => {
    const res = await fetch(`/api/categories/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify({ name }),
    });
    return res.json();
  },

  deleteCategory: async (id: string): Promise<{ status: string; message?: string }> => {
    const res = await fetch(`/api/categories/${id}`, {
      method: 'DELETE',
      headers: authHeader(),
    });
    return res.json();
  },

  // ----------------------------------------------------
  // PRODUK
  // ----------------------------------------------------
  getProducts: async (params?: { search?: string; categoryId?: string; outletId?: string; isActive?: string }): Promise<{ status: string; data: Product[] }> => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.categoryId) query.append('categoryId', params.categoryId);
    if (params?.outletId) query.append('outletId', params.outletId);
    if (params?.isActive) query.append('isActive', params.isActive);

    const res = await fetch(`/api/products?${query.toString()}`, {
      headers: authHeader(),
    });
    const result = await res.json();
    if (result.status === 'success' && Array.isArray(result.data)) {
      result.data = result.data.map((p: Product) => {
        if (p.description && typeof p.description === 'string' && p.description.startsWith('{')) {
          try {
            const parsed = JSON.parse(p.description);
            if (parsed && typeof parsed === 'object') {
              return {
                ...p,
                description: parsed.text !== undefined ? parsed.text : p.description,
                modifiers: Array.isArray(parsed.modifiers) ? parsed.modifiers : undefined,
              };
            }
          } catch (e) {
            // fallback plain description
          }
        }
        return p;
      });
    }
    return result;
  },

  createProduct: async (data: any): Promise<{ status: string; data?: Product; message?: string; errors?: any }> => {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  updateProduct: async (id: string, data: any): Promise<{ status: string; data?: Product; message?: string }> => {
    const res = await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  getProductDeleteInfo: async (
    id: string,
    outletId?: string
  ): Promise<{
    status: string;
    data?: {
      id: string;
      name: string;
      categoryName?: string;
      outletName: string;
      currentStock: number;
      transactionCount: number;
      hasTransactions: boolean;
    };
    message?: string;
  }> => {
    const url = outletId ? `/api/products/${id}/delete-info?outletId=${outletId}` : `/api/products/${id}/delete-info`;
    const res = await fetch(url, {
      headers: authHeader(),
    });
    return res.json();
  },

  deleteProduct: async (id: string, outletId?: string): Promise<{ status: string; message?: string }> => {
    const url = outletId ? `/api/products/${id}?outletId=${outletId}` : `/api/products/${id}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: authHeader(),
    });
    return res.json();
  },

  bulkProductAction: async (data: {
    action: 'DELETE' | 'SET_STATUS' | 'CHANGE_CATEGORY';
    productIds: string[];
    isActive?: boolean;
    categoryId?: string;
    outletId?: string;
  }): Promise<{ status: string; message: string }> => {
    const res = await fetch('/api/products/bulk-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  getAvailableProductsForOutlet: async (
    outletId: string,
    search?: string
  ): Promise<{ status: string; data: any[]; message?: string }> => {
    const query = new URLSearchParams({ outletId });
    if (search) query.append('search', search);
    const res = await fetch(`/api/products/available-for-outlet?${query.toString()}`, {
      headers: authHeader(),
    });
    return res.json();
  },

  assignProductsToOutlet: async (data: {
    outletId: string;
    assignments: { productId: string; initialStock: number; customPrice?: number }[];
  }): Promise<{ status: string; message?: string }> => {
    const res = await fetch('/api/products/assign-to-outlet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // ----------------------------------------------------
  // INVENTORI & MUTASI KARTU STOK
  // ----------------------------------------------------
  recordStockIn: async (data: {
    productId: string;
    quantity: number;
    notes?: string;
    poNumber?: string;
    supplierName?: string;
    newCostPrice?: number;
    outletId?: string;
  }): Promise<any> => {
    const res = await fetch('/api/inventory/stock-in', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  recordStockOut: async (data: {
    productId: string;
    quantity: number;
    notes?: string;
    outletId?: string;
  }): Promise<any> => {
    const res = await fetch('/api/inventory/stock-out', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  recordStockAdjustment: async (data: {
    productId: string;
    actualStock: number;
    notes: string;
    outletId?: string;
  }): Promise<any> => {
    const res = await fetch('/api/inventory/adjustment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  transferStock: async (data: {
    productId: string;
    sourceOutletId: string;
    targetOutletId: string;
    quantity: number;
    notes?: string;
  }): Promise<{ status: string; message: string; data?: any }> => {
    const res = await fetch('/api/inventory/transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  getStockMovements: async (params?: {
    productId?: string;
    outletId?: string;
    type?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<{ status: string; data: StockMovement[] }> => {
    const query = new URLSearchParams();
    if (params?.productId) query.append('productId', params.productId);
    if (params?.outletId) query.append('outletId', params.outletId);
    if (params?.type) query.append('type', params.type);
    if (params?.search) query.append('search', params.search);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.limit) query.append('limit', params.limit.toString());

    const res = await fetch(`/api/inventory/movements?${query.toString()}`, {
      headers: authHeader(),
    });
    return res.json();
  },

  getLowStockProducts: async (): Promise<{ status: string; data: LowStockProduct[] }> => {
    const res = await fetch('/api/inventory/low-stock', {
      headers: authHeader(),
    });
    return res.json();
  },

  // ----------------------------------------------------
  // TRANSAKSI PENJUALAN KASIR (CHECKOUT & ORDERS)
  // ----------------------------------------------------
  checkoutOrder: async (payload: CheckoutPayload): Promise<{ status: string; data?: Order; message?: string }> => {
    const res = await fetch('/api/orders/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  getOrders: async (params?: { search?: string; channel?: string; outletId?: string; limit?: number; page?: number }): Promise<{ status: string; data: Order[]; meta?: any }> => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.channel && params.channel !== 'ALL') query.append('channel', params.channel);
    if (params?.outletId) query.append('outletId', params.outletId);
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.page) query.append('page', params.page.toString());

    const res = await fetch(`/api/orders?${query.toString()}`, {
      headers: authHeader(),
    });
    return res.json();
  },

  getOrderById: async (id: string): Promise<{ status: string; data?: Order; message?: string }> => {
    const res = await fetch(`/api/orders/${id}`, {
      headers: authHeader(),
    });
    return res.json();
  },

  sendOrderEmail: async (orderId: string, email: string): Promise<{ status: string; message: string; previewUrl?: string }> => {
    const res = await fetch(`/api/orders/${orderId}/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify({ email }),
    });
    return res.json();
  },

  // Fitur Tahan Pesanan Kasir (Hold Orders)
  holdOrder: async (data: {
    outletId?: string;
    customerName?: string;
    note?: string;
    items: any[];
    totalAmount: number;
  }): Promise<{ status: string; data?: HoldOrder; message?: string }> => {
    const res = await fetch('/api/orders/hold', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  getHoldOrders: async (outletId?: string): Promise<{ status: string; data: HoldOrder[]; message?: string }> => {
    const query = new URLSearchParams();
    if (outletId) query.append('outletId', outletId);

    const res = await fetch(`/api/orders/hold?${query.toString()}`, {
      headers: authHeader(),
    });
    return res.json();
  },

  deleteHoldOrder: async (id: string): Promise<{ status: string; message?: string }> => {
    const res = await fetch(`/api/orders/hold/${id}`, {
      method: 'DELETE',
      headers: authHeader(),
    });
    return res.json();
  },

  // ----------------------------------------------------
  // MANAJEMEN SHIFT KASIR (X/Z REPORT)
  // ----------------------------------------------------
  startShift: async (data: { startingCash: number; notes?: string; outletId?: string }): Promise<any> => {
    const res = await fetch('/api/shifts/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  getCurrentShift: async (): Promise<any> => {
    const res = await fetch('/api/shifts/current', {
      headers: authHeader(),
    });
    return res.json();
  },

  getXReport: async (): Promise<any> => {
    const res = await fetch('/api/shifts/x-report', {
      headers: authHeader(),
    });
    return res.json();
  },

  closeShift: async (data: { actualCash: number; notes?: string }): Promise<any> => {
    const res = await fetch('/api/shifts/close', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  getShiftHistory: async (outletId?: string): Promise<any> => {
    const query = new URLSearchParams();
    if (outletId) query.append('outletId', outletId);

    const res = await fetch(`/api/shifts?${query.toString()}`, {
      headers: authHeader(),
    });
    return res.json();
  },

  getShiftById: async (id: string): Promise<any> => {
    const res = await fetch(`/api/shifts/${id}`, {
      headers: authHeader(),
    });
    return res.json();
  },

  // ----------------------------------------------------
  // LAPORAN FINANSIAL & AKUNTANSI SEDERHANA
  // ----------------------------------------------------
  getFinancialReport: async (params?: { startDate?: string; endDate?: string; outletId?: string }): Promise<any> => {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.outletId) query.append('outletId', params.outletId);

    const res = await fetch(`/api/reports/financial?${query.toString()}`, {
      headers: authHeader(),
    });
    return res.json();
  },

  // ----------------------------------------------------
  // MANAJEMEN PENGGUNA & STAF
  // ----------------------------------------------------
  getUsers: async (): Promise<{ status: string; data?: any[]; message?: string }> => {
    const res = await fetch('/api/users', {
      headers: authHeader(),
    });
    return res.json();
  },

  createUser: async (data: {
    name: string;
    email: string;
    password: string;
    pin: string;
    role: string;
    outletId?: string | null;
  }): Promise<any> => {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  updateUser: async (
    id: string,
    data: {
      name?: string;
      email?: string;
      password?: string;
      pin?: string | null;
      role?: string;
      isActive?: boolean;
      outletId?: string | null;
    }
  ): Promise<any> => {
    const res = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteUser: async (id: string): Promise<any> => {
    const res = await fetch(`/api/users/${id}`, {
      method: 'DELETE',
      headers: authHeader(),
    });
    return res.json();
  },

  // ----------------------------------------------------
  // SAAS MULTI-TENANT & ONBOARDING KLIEN
  // ----------------------------------------------------
  saasRegister: async (data: {
    businessName: string;
    businessType?: string;
    ownerName: string;
    email: string;
    phone: string;
    password: string;
    pin?: string;
  }): Promise<{ status: string; data?: any; message?: string; errors?: any }> => {
    const res = await fetch('/api/saas/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  saasOnboard: async (data: {
    outletId: string;
    address?: string;
    phone?: string;
    warehouse?: {
      name: string;
      address?: string;
      phone?: string;
    };
    receiptSize?: string;
    receiptFooter?: string;
    cashierName?: string;
    cashierPin?: string;
    initialProduct?: {
      name: string;
      categoryName: string;
      unit: string;
      costPrice: number;
      basePrice: number;
      storeStock?: number;
      warehouseStock?: number;
      initialStock?: number;
      isUnlimited: boolean;
    };
    seedSampleProducts?: boolean;
  }): Promise<{ status: string; data?: any; message?: string; errors?: any }> => {
    const res = await fetch('/api/saas/onboarding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  saasSubscription: async (): Promise<{ status: string; data?: any; message?: string }> => {
    const res = await fetch('/api/saas/subscription', {
      headers: authHeader(),
    });
    return res.json();
  },

  // ----------------------------------------------------
  // LEVEL 1: SAAS PLATFORM (INTERNAL WELL POS)
  // ----------------------------------------------------
  platformLogin: async (email: string, password: string): Promise<{ status: string; data?: any; message?: string }> => {
    const res = await fetch('/api/platform/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  getPlatformDashboard: async (): Promise<{ status: string; data?: any; message?: string }> => {
    const res = await fetch('/api/platform/dashboard', {
      headers: platformAuthHeader(),
    });
    return res.json();
  },

  getPlatformTenants: async (params?: { search?: string; status?: string }): Promise<{ status: string; data?: any[]; message?: string }> => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.status) query.append('status', params.status);

    const res = await fetch(`/api/platform/tenants?${query.toString()}`, {
      headers: platformAuthHeader(),
    });
    return res.json();
  },

  updateTenantStatus: async (id: string, status: string, notes?: string): Promise<{ status: string; data?: any; message?: string }> => {
    const res = await fetch(`/api/platform/tenants/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...platformAuthHeader(),
      },
      body: JSON.stringify({ status, notes }),
    });
    return res.json();
  },

  getPlatformPlans: async (): Promise<{ status: string; data?: any[]; message?: string }> => {
    const res = await fetch('/api/platform/plans', {
      headers: platformAuthHeader(),
    });
    return res.json();
  },

  getPlatformTenantDetail: async (id: string): Promise<{ status: string; data?: any; message?: string }> => {
    const res = await fetch(`/api/platform/tenants/${id}`, {
      headers: platformAuthHeader(),
    });
    return res.json();
  },

  updateTenantSubscription: async (
    id: string,
    planId?: string,
    durationDays: number = 30,
    planCode?: string
  ): Promise<{ status: string; data?: any; message?: string }> => {
    const res = await fetch(`/api/platform/tenants/${id}/subscription`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...platformAuthHeader(),
      },
      body: JSON.stringify({ planId, durationDays, planCode }),
    });
    return res.json();
  },

  impersonateTenant: async (id: string): Promise<{ status: string; data?: any; message?: string }> => {
    const res = await fetch(`/api/platform/tenants/${id}/impersonate`, {
      method: 'POST',
      headers: platformAuthHeader(),
    });
    return res.json();
  },

  resetTenantOwnerPassword: async (id: string): Promise<{ status: string; data?: any; message?: string }> => {
    const res = await fetch(`/api/platform/tenants/${id}/reset-password`, {
      method: 'POST',
      headers: platformAuthHeader(),
    });
    return res.json();
  },

  // ----------------------------------------------------
  // CABANG (OUTLETS) & BIAYA DINAMIS
  // ----------------------------------------------------
  getOutlets: async (): Promise<{ status: string; data: Outlet[]; message?: string }> => {
    const res = await fetch('/api/outlets', {
      headers: authHeader(),
    });
    return res.json();
  },

  getOutletById: async (id: string): Promise<{ status: string; data?: Outlet; message?: string }> => {
    const res = await fetch(`/api/outlets/${id}`, {
      headers: authHeader(),
    });
    return res.json();
  },

  createOutlet: async (data: {
    name: string;
    address?: string;
    phone?: string;
    isWarehouse?: boolean;
    feesConfig?: OutletFee[];
  }): Promise<{ status: string; data?: Outlet; message?: string }> => {
    const res = await fetch('/api/outlets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  updateOutlet: async (
    id: string,
    data: {
      name?: string;
      address?: string;
      phone?: string;
      isWarehouse?: boolean;
      isActive?: boolean;
      receiptConfig?: { paperSize: '58mm' | '80mm'; footerText?: string };
    }
  ): Promise<{ status: string; data?: Outlet; message?: string }> => {
    const res = await fetch(`/api/outlets/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  updateOutletFees: async (
    id: string,
    feesConfig: OutletFee[],
    supervisorPin?: string
  ): Promise<{ status: string; data?: OutletFee[]; message?: string }> => {
    const res = await fetch(`/api/outlets/${id}/fees`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify({ feesConfig, supervisorPin }),
    });
    return res.json();
  },
};

// ----------------------------------------------------
// MANAJEMEN PELANGGAN (CUSTOMER / MEMBER CRM)
// ----------------------------------------------------
export const customerApi = {
  getCustomers: async (params?: {
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    status: string;
    data: Customer[];
    summary: CustomerSummaryStats;
    pagination: { page: number; limit: number; totalRecords: number; totalPages: number };
    message?: string;
  }> => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.sortBy) query.append('sortBy', params.sortBy);
    if (params?.sortOrder) query.append('sortOrder', params.sortOrder);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());

    const res = await fetch(`/api/customers?${query.toString()}`, {
      headers: authHeader(),
    });
    return res.json();
  },

  getCustomerById: async (id: string): Promise<{ status: string; data?: Customer; message?: string }> => {
    const res = await fetch(`/api/customers/${id}`, {
      headers: authHeader(),
    });
    return res.json();
  },

  createCustomer: async (data: CustomerFormData): Promise<{ status: string; data?: Customer; message?: string }> => {
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  updateCustomer: async (id: string, data: CustomerFormData): Promise<{ status: string; data?: Customer; message?: string }> => {
    const res = await fetch(`/api/customers/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteCustomer: async (id: string): Promise<{ status: string; message?: string }> => {
    const res = await fetch(`/api/customers/${id}`, {
      method: 'DELETE',
      headers: authHeader(),
    });
    return res.json();
  },
};

