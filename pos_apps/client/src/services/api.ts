import type { AuthResponse, User } from '../types/auth';
import type { Category, Product, StockMovement, LowStockProduct } from '../types/product';
import type { CheckoutPayload, Order, HoldOrder, OpenTabOrder, OpenTabPayload } from '../types/order';
import type { Customer, CustomerFormData, CustomerSummaryStats, CustomerPointLedger } from '../types/customer';
import type { Outlet, OutletFee, SalesChannelConfig, PaymentConfig, OutletLoyaltyConfig } from '../types/outlet';
import type { QrTable, QrMenuSettings, QrLiveOrder, PublicMenuResponse } from '../types/qr_menu';
import type { ModifierGroup, UpsertModifierGroupInput } from '../types/modifier';
import type { Recipe, UpsertRecipeInput, RecipeInventoryItem } from '../types/recipe';
import type { Supplier, SupplierFormData } from '../types/supplier';
import type { Promotion, PromotionFormData } from '../types/promotion';
import type {
  PurchaseOrder,
  CreatePurchaseOrderInput,
  ReceivePOInput,
  StockTransfer,
  CreateStockTransferInput,
  ExpiryAlertBatch,
} from '../types/purchasing';

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

// Intersepsi otomatis jika sesi perangkat dicabut oleh pemilik toko (Force Logout)
if (typeof window !== 'undefined' && window.fetch) {
  const nativeFetch = window.fetch;
  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    if (response.status === 401) {
      try {
        const clone = response.clone();
        clone.json().then((body) => {
          if (body?.code === 'SESSION_REVOKED') {
            authStorage.clearSession();
            window.dispatchEvent(
              new CustomEvent('auth:session_revoked', {
                detail: {
                  message:
                    body.message ||
                    'Sesi login perangkat Anda telah dicabut oleh pemilik toko. Silakan login kembali.',
                },
              })
            );
          }
        }).catch(() => {});
      } catch {
        // Abaikan clone error
      }
    }
    return response;
  };
}

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

export interface PlatformNotification {
  id: string;
  title: string;
  message: string;
  type: 'MAINTENANCE' | 'INFO' | 'WARNING' | 'UPDATE';
  target: 'ALL' | 'SPECIFIC';
  targetTenantId?: string | null;
  targetTenantName?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  createdBy?: string;
  isActive: boolean;
}

const authHeader = (): Record<string, string> => {
  const token = authStorage.getToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const user = authStorage.getUser();
  const paired = pairedDeviceStorage.get();
  const tenantId = user?.tenantId || paired?.tenantId;
  if (tenantId) {
    headers['x-tenant-id'] = tenantId;
  }
  const outletId = user?.outletId || paired?.outletId;
  if (outletId) {
    headers['x-outlet-id'] = outletId;
  }
  return headers;
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
    userCode?: string,   // ID Staff kasir (5 digit, misal: 10001)
    email?: string,
    outletId?: string,
    tenantId?: string
  ): Promise<AuthResponse> => {
    const res = await fetch('/api/auth/pin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, userCode, email, outletId, tenantId }),
    });
    return res.json();
  },

  pairDevice: async (tenantSlug: string, staffCode: string, authPin: string): Promise<{
    status: string;
    message: string;
    data?: {
      tenant: { id: string; businessName: string; slug: string; phone?: string };
      outlets: Array<{ id: string; name: string; address?: string; phone?: string }>;
      authorizedBy: string;
      token?: string;
      user?: any;
    };
  }> => {
    const res = await fetch('/api/auth/pair-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantSlug, staffCode, authPin }),
    });
    return res.json();
  },

  getPairedOutletCashiers: async (
    tenantId: string,
    outletId?: string
  ): Promise<{
    status: string;
    data: Array<{ id: string; name: string; role: string; email: string; userCode?: string }>;
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
  getCategories: async (outletId?: string, isActive?: string, hasProductsOnly?: boolean): Promise<{ status: string; data: Category[] }> => {
    const query = new URLSearchParams();
    if (outletId) query.append('outletId', outletId);
    if (isActive) query.append('isActive', isActive);
    if (hasProductsOnly) query.append('hasProductsOnly', 'true');
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

  bulkImportProducts: async (data: {
    items: Array<{
      name: string;
      sku: string;
      barcode?: string | null;
      categoryName?: string | null;
      costPrice: number;
      basePrice: number;
      unit?: string;
      description?: string | null;
      initialStock?: number;
      minStockAlert?: number;
    }>;
    outletId?: string;
  }): Promise<{
    status: string;
    message: string;
    data?: {
      total: number;
      created: number;
      updated: number;
      failed: number;
      errors: Array<{ sku: string; name: string; error: string }>;
    };
  }> => {
    const res = await fetch('/api/products/bulk-import', {
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
    productId?: string;
    inventoryItemId?: string;
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
    productId?: string;
    inventoryItemId?: string;
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

  recordBulkStockAdjustment: async (data: {
    outletId?: string;
    generalNotes?: string;
    items: Array<{
      productId?: string;
      inventoryItemId?: string;
      actualStock: number;
      notes?: string;
    }>;
  }): Promise<{ status: string; message: string; data?: any }> => {
    const res = await fetch('/api/inventory/bulk-adjustment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  recordBulkStockIn: async (data: {
    outletId?: string;
    supplierName?: string;
    poNumber?: string;
    generalNotes?: string;
    items: Array<{
      productId?: string;
      inventoryItemId?: string;
      quantity: number;
      newCostPrice?: number;
      notes?: string;
    }>;
  }): Promise<{ status: string; message: string; data?: any }> => {
    const res = await fetch('/api/inventory/bulk-stock-in', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  recordBulkStockOut: async (data: {
    outletId?: string;
    generalReason?: string;
    generalNotes?: string;
    items: Array<{
      productId?: string;
      inventoryItemId?: string;
      quantity: number;
      reason?: string;
      notes?: string;
    }>;
  }): Promise<{ status: string; message: string; data?: any }> => {
    const res = await fetch('/api/inventory/bulk-stock-out', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  recordBulkTransfer: async (data: {
    sourceOutletId: string;
    targetOutletId: string;
    transferNumber?: string;
    generalNotes?: string;
    items: Array<{
      productId?: string;
      inventoryItemId?: string;
      quantity: number;
      notes?: string;
    }>;
  }): Promise<{ status: string; message: string; data?: any }> => {
    const res = await fetch('/api/inventory/bulk-transfer', {
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
    productId?: string;
    inventoryItemId?: string;
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

  getOrders: async (params?: { search?: string; channel?: string; outletId?: string; startDate?: string; endDate?: string; limit?: number; page?: number }): Promise<{ status: string; data: Order[]; meta?: any }> => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.channel && params.channel !== 'ALL') query.append('channel', params.channel);
    if (params?.outletId) query.append('outletId', params.outletId);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
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

  voidOrder: async (
    orderId: string,
    payload: { pin?: string; reason: string; notes?: string }
  ): Promise<{ status: string; message: string; data?: any }> => {
    const res = await fetch(`/api/orders/${orderId}/void`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  voidOrderItem: async (
    orderId: string,
    payload: { orderItemId: string; quantityToVoid?: number; pin?: string; reason: string; notes?: string }
  ): Promise<{ status: string; message: string; data?: any }> => {
    const res = await fetch(`/api/orders/${orderId}/void-item`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  // Fitur Tahan Pesanan Kasir (Hold Orders)
  holdOrder: async (data: {
    outletId?: string;
    customerName?: string;
    channel?: string;
    tableNumber?: string;
    note?: string;
    items: any[];
    onDemandQuantities?: Record<string, number>;
    appliedPromotion?: any;
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

  // Fitur Tagihan Meja Terbuka (Open Tab / Bayar Nanti)
  createOpenTab: async (data: OpenTabPayload): Promise<{ status: string; data?: OpenTabOrder; message?: string }> => {
    const res = await fetch('/api/orders/open-tab', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  getOpenTabs: async (outletId?: string): Promise<{ status: string; data: OpenTabOrder[]; message?: string }> => {
    const query = new URLSearchParams();
    if (outletId) query.append('outletId', outletId);

    const res = await fetch(`/api/orders/open-tabs?${query.toString()}`, {
      headers: authHeader(),
    });
    return res.json();
  },

  cancelOpenTab: async (id: string, reason?: string): Promise<{ status: string; message?: string }> => {
    const res = await fetch(`/api/orders/${id}/cancel-tab`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify({ reason }),
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

  recordCashMovement: async (data: { type?: 'CASH_OUT' | 'CASH_IN'; category: string; amount: number; notes: string }): Promise<any> => {
    const res = await fetch('/api/shifts/cash-movement', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  getCashMovements: async (shiftId?: string): Promise<any> => {
    const query = new URLSearchParams();
    if (shiftId) query.append('shiftId', shiftId);
    const res = await fetch(`/api/shifts/cash-movements?${query.toString()}`, {
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

  getShiftDiscrepanciesReport: async (params?: { startDate?: string; endDate?: string; outletId?: string }): Promise<any> => {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.outletId) query.append('outletId', params.outletId);

    const res = await fetch(`/api/reports/shifts?${query.toString()}`, {
      headers: authHeader(),
    });
    return res.json();
  },

  getProductPerformanceReport: async (params?: {
    startDate?: string;
    endDate?: string;
    outletId?: string;
    sortBy?: 'volume' | 'revenue' | 'profit';
    limit?: number;
  }): Promise<any> => {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.outletId) query.append('outletId', params.outletId);
    if (params?.sortBy) query.append('sortBy', params.sortBy);
    if (params?.limit) query.append('limit', String(params.limit));

    const res = await fetch(`/api/reports/product-performance?${query.toString()}`, {
      headers: authHeader(),
    });
    return res.json();
  },

  getDeadStockReport: async (params?: { days?: number; outletId?: string }): Promise<any> => {
    const query = new URLSearchParams();
    if (params?.days) query.append('days', String(params.days));
    if (params?.outletId) query.append('outletId', params.outletId);

    const res = await fetch(`/api/reports/dead-stock?${query.toString()}`, {
      headers: authHeader(),
    });
    return res.json();
  },

  exportAnalyticsReport: async (
    type: 'pnl' | 'products' | 'shifts' | 'deadstock',
    params?: { startDate?: string; endDate?: string }
  ): Promise<Blob> => {
    const query = new URLSearchParams();
    query.append('type', type);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);

    const res = await fetch(`/api/reports/export?${query.toString()}`, {
      headers: authHeader(),
    });
    if (!res.ok) {
      throw new Error('Gagal mengunduh file ekspor laporan');
    }
    return res.blob();
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
    password?: string;
    userCode?: string;
    pin: string;
    role: string;
    outletId?: string | null;
    canCashOut?: boolean;
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
      userCode?: string;
      pin?: string | null;
      role?: string;
      isActive?: boolean;
      outletId?: string | null;
      canCashOut?: boolean;
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

  revokeUserSession: async (userId: string): Promise<{ status: string; message: string; data?: any }> => {
    const res = await fetch(`/api/users/${userId}/revoke-session`, {
      method: 'POST',
      headers: authHeader(),
    });
    return res.json();
  },

  revokeAllSessions: async (excludeCurrent: boolean = true): Promise<{ status: string; message: string; data?: any }> => {
    const res = await fetch('/api/users/revoke-all-sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify({ excludeCurrent }),
    });
    return res.json();
  },

  // ----------------------------------------------------
  // MANAJEMEN AKSES & PERAN (RBAC)
  // ----------------------------------------------------
  getSystemPermissions: async (): Promise<{ status: string; data?: any[]; message?: string }> => {
    const res = await fetch('/api/users/roles/permissions', {
      headers: authHeader(),
    });
    return res.json();
  },

  getRoles: async (): Promise<{ status: string; data?: any[]; message?: string }> => {
    const res = await fetch('/api/users/roles', {
      headers: authHeader(),
    });
    return res.json();
  },

  createRole: async (data: any): Promise<any> => {
    const res = await fetch('/api/users/roles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  updateRole: async (id: string, data: any): Promise<any> => {
    const res = await fetch(`/api/users/roles/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteRole: async (id: string): Promise<any> => {
    const res = await fetch(`/api/users/roles/${id}`, {
      method: 'DELETE',
      headers: authHeader(),
    });
    return res.json();
  },

  // ----------------------------------------------------
  // SAAS MULTI-TENANT & ONBOARDING KLIEN
  // ----------------------------------------------------
  saasRegister: async (data: {
    firstName: string;
    lastName?: string;
    phone: string;
    email: string;
    password: string;
    confirmPassword?: string;
    businessName?: string;
    ownerName?: string;
  }): Promise<{ status: string; data?: any; message?: string; errors?: any }> => {
    const res = await fetch('/api/saas/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  createInitialStore: async (data: {
    merchantName: string;
    storeName: string;
    address: string;
    phone?: string;
    industries: string[];
  }): Promise<{ status: string; data?: any; message?: string; errors?: any }> => {
    const res = await fetch('/api/saas/stores/create-initial', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
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
    spvName?: string;
    spvPin?: string;
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

  getMySubscription: async (): Promise<{ status: string; data?: any; message?: string }> => {
    const res = await fetch('/api/saas/subscription', {
      headers: authHeader(),
    });
    return res.json();
  },

  getMyInvoices: async (): Promise<{ status: string; data?: any[]; message?: string }> => {
    const res = await fetch('/api/saas/invoices', {
      headers: authHeader(),
    });
    return res.json();
  },

  topUpTokens: async (data: {
    tokenAmount: number;
    promoCode?: string;
    paymentMethod?: string;
  }): Promise<{ status: string; data?: any; message?: string }> => {
    const res = await fetch('/api/saas/subscription/top-up', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  validateTenantPromo: async (params: {
    code: string;
    tokenAmount?: number;
  }): Promise<{ status: string; data?: any; message?: string }> => {
    const query = new URLSearchParams();
    query.append('code', params.code);
    if (params.tokenAmount) query.append('tokenAmount', params.tokenAmount.toString());

    const res = await fetch(`/api/saas/promos/validate?${query.toString()}`, {
      headers: authHeader(),
    });
    return res.json();
  },

  getPlatformPaymentConfigForOwner: async (): Promise<{ status: string; data?: any; message?: string }> => {
    const res = await fetch('/api/saas/payment-config', {
      headers: authHeader(),
    });
    return res.json();
  },

  getTenantNotifications: async (): Promise<{ status: string; data?: PlatformNotification[]; message?: string }> => {
    const res = await fetch('/api/saas/notifications', {
      headers: authHeader(),
    });
    return res.json();
  },

  checkPakasirInvoiceStatus: async (invoiceNumber: string): Promise<{ status: string; data?: any; message?: string }> => {
    const res = await fetch(`/api/saas/pakasir/status/${encodeURIComponent(invoiceNumber)}`);
    return res.json();
  },

  simulatePakasirSandboxPayment: async (invoiceNumber: string): Promise<{ status: string; data?: any; message?: string }> => {
    const res = await fetch('/api/saas/pakasir/simulate-sandbox-pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceNumber }),
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
    durationDays?: number | null,
    planCode?: string,
    extraOptions?: {
      neverExpires?: boolean;
      tokenAmount?: number;
      notes?: string;
      paymentMethod?: string;
      promoCode?: string;
      discountAmount?: number;
      amount?: number;
    }
  ): Promise<{ status: string; data?: any; message?: string }> => {
    const res = await fetch(`/api/platform/tenants/${id}/subscription`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...platformAuthHeader(),
      },
      body: JSON.stringify({
        planId,
        durationDays: durationDays ?? undefined,
        planCode,
        neverExpires: extraOptions?.neverExpires ?? true,
        tokenAmount: extraOptions?.tokenAmount,
        notes: extraOptions?.notes,
        paymentMethod: extraOptions?.paymentMethod,
        promoCode: extraOptions?.promoCode,
        discountAmount: extraOptions?.discountAmount,
        amount: extraOptions?.amount,
      }),
    });
    return res.json();
  },

  impersonateTenant: async (id: string, outletId?: string): Promise<{ status: string; data?: any; message?: string }> => {
    const res = await fetch(`/api/platform/tenants/${id}/impersonate`, {
      method: 'POST',
      headers: { ...platformAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ outletId }),
    });
    return res.json();
  },

  togglePlatformOutletStatus: async (outletId: string, isActive?: boolean): Promise<{ status: string; data?: any; message?: string }> => {
    const res = await fetch(`/api/platform/outlets/${outletId}/status`, {
      method: 'PATCH',
      headers: { ...platformAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
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
  // PLATFORM SAAS BILLING, INVOICE & MUTASI TOKEN
  // ----------------------------------------------------
  getPlatformInvoices: async (params?: { search?: string; status?: string }): Promise<{ status: string; data?: any[]; message?: string }> => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.status) query.append('status', params.status);
    const res = await fetch(`/api/platform/invoices?${query.toString()}`, {
      headers: platformAuthHeader(),
    });
    return res.json();
  },

  verifyPlatformInvoicePayment: async (id: string, paymentChannel?: string, paymentProofUrl?: string): Promise<{ status: string; data?: any; message?: string }> => {
    const res = await fetch(`/api/platform/invoices/${id}/verify-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...platformAuthHeader() },
      body: JSON.stringify({ paymentChannel, paymentProofUrl }),
    });
    return res.json();
  },

  // ----------------------------------------------------
  // PLATFORM SAAS STAFF & RBAC MANAGEMENT
  // ----------------------------------------------------
  getPlatformUsers: async (): Promise<{ status: string; data?: any[]; message?: string }> => {
    const res = await fetch('/api/platform/users', { headers: platformAuthHeader() });
    return res.json();
  },

  createPlatformUser: async (data: { name: string; email: string; password: string; role: string }): Promise<{ status: string; data?: any; message?: string }> => {
    const res = await fetch('/api/platform/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...platformAuthHeader() },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  updatePlatformUser: async (id: string, data: { name?: string; role?: string; password?: string }): Promise<{ status: string; data?: any; message?: string }> => {
    const res = await fetch(`/api/platform/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...platformAuthHeader() },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deletePlatformUser: async (id: string): Promise<{ status: string; message?: string }> => {
    const res = await fetch(`/api/platform/users/${id}`, {
      method: 'DELETE',
      headers: platformAuthHeader(),
    });
    return res.json();
  },

  // ----------------------------------------------------
  // PLATFORM SAAS B2B PROMO VOUCHERS
  // ----------------------------------------------------
  getPlatformPromos: async (): Promise<{ status: string; data?: any[]; message?: string }> => {
    const res = await fetch('/api/platform/promos', { headers: platformAuthHeader() });
    return res.json();
  },

  createPlatformPromo: async (data: {
    code: string;
    name: string;
    type: 'DISCOUNT_PERCENT' | 'DISCOUNT_FIXED' | 'BONUS_TOKENS';
    value: number;
    minSpend?: number;
    maxDiscount?: number | null;
    usageLimit?: number | null;
    validUntil?: string | null;
  }): Promise<{ status: string; data?: any; message?: string }> => {
    const res = await fetch('/api/platform/promos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...platformAuthHeader() },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  togglePlatformPromo: async (id: string): Promise<{ status: string; data?: any; message?: string }> => {
    const res = await fetch(`/api/platform/promos/${id}/toggle`, {
      method: 'PATCH',
      headers: platformAuthHeader(),
    });
    return res.json();
  },

  deletePlatformPromo: async (id: string): Promise<{ status: string; message?: string }> => {
    const res = await fetch(`/api/platform/promos/${id}`, {
      method: 'DELETE',
      headers: platformAuthHeader(),
    });
    return res.json();
  },

  getPlatformPaymentSettings: async (): Promise<{ status: string; data?: any; message?: string }> => {
    const res = await fetch('/api/platform/payment-config', {
      headers: platformAuthHeader(),
    });
    return res.json();
  },

  updatePlatformPaymentSettings: async (data: any): Promise<{ status: string; data?: any; message?: string }> => {
    const res = await fetch('/api/platform/payment-config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...platformAuthHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // ----------------------------------------------------
  // PENGELOLAAN NOTIFIKASI & PENGUMUMAN SUPERADMIN
  // ----------------------------------------------------
  getPlatformNotifications: async (): Promise<{ status: string; data?: PlatformNotification[]; message?: string }> => {
    const res = await fetch('/api/platform/notifications', {
      headers: platformAuthHeader(),
    });
    return res.json();
  },

  createPlatformNotification: async (data: {
    title: string;
    message: string;
    type: 'MAINTENANCE' | 'INFO' | 'WARNING' | 'UPDATE';
    target: 'ALL' | 'SPECIFIC';
    targetTenantId?: string | null;
    targetTenantName?: string | null;
    expiresAt?: string | null;
  }): Promise<{ status: string; data?: PlatformNotification; message?: string }> => {
    const res = await fetch('/api/platform/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...platformAuthHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deletePlatformNotification: async (id: string): Promise<{ status: string; message?: string }> => {
    const res = await fetch(`/api/platform/notifications/${id}`, {
      method: 'DELETE',
      headers: platformAuthHeader(),
    });
    return res.json();
  },

  // ----------------------------------------------------
  // OUTLET TOKO (OUTLETS) & BIAYA DINAMIS
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
      receiptConfig?: { paperSize: '58mm' | '80mm'; footerText?: string; showQueueNumber?: boolean };
      loyaltyConfig?: OutletLoyaltyConfig;
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

  updateOutletChannels: async (
    id: string,
    channelsConfig: SalesChannelConfig[],
    supervisorPin?: string
  ): Promise<{ status: string; data?: SalesChannelConfig[]; message?: string }> => {
    const res = await fetch(`/api/outlets/${id}/channels`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify({ channelsConfig, supervisorPin }),
    });
    return res.json();
  },

  updateOutletPaymentConfig: async (
    id: string,
    paymentConfig: PaymentConfig
  ): Promise<{ status: string; data?: PaymentConfig; message?: string }> => {
    const res = await fetch(`/api/outlets/${id}/payment-config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify({ paymentConfig }),
    });
    return res.json();
  },

  // ==========================================
  // BUKU MENU QR & SELF-ORDERING API
  // ==========================================
  getQrTables: async (outletId?: string): Promise<{ status: string; data?: QrTable[]; message?: string }> => {
    const url = outletId ? `/api/qr-menu/tables?outletId=${outletId}` : '/api/qr-menu/tables';
    const res = await fetch(url, { headers: authHeader() });
    return res.json();
  },

  createQrTable: async (data: {
    outletId: string;
    tableNumber: string;
    name?: string;
    section?: string;
    capacity?: number;
  }): Promise<{ status: string; data?: QrTable; message?: string }> => {
    const res = await fetch('/api/qr-menu/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  updateQrTable: async (
    id: string,
    data: {
      tableNumber?: string;
      name?: string;
      section?: string;
      capacity?: number;
      status?: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
    }
  ): Promise<{ status: string; data?: QrTable; message?: string }> => {
    const res = await fetch(`/api/qr-menu/tables/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteQrTable: async (id: string): Promise<{ status: string; message?: string }> => {
    const res = await fetch(`/api/qr-menu/tables/${id}`, {
      method: 'DELETE',
      headers: authHeader(),
    });
    return res.json();
  },

  getQrMenuSettings: async (outletId: string): Promise<{ status: string; data?: QrMenuSettings; message?: string }> => {
    const res = await fetch(`/api/qr-menu/settings?outletId=${outletId}`, { headers: authHeader() });
    return res.json();
  },

  updateQrMenuSettings: async (
    data: Partial<QrMenuSettings> & { outletId: string }
  ): Promise<{ status: string; data?: QrMenuSettings; message?: string }> => {
    const res = await fetch('/api/qr-menu/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  getQrLiveOrders: async (outletId?: string): Promise<{ status: string; data?: QrLiveOrder[]; message?: string }> => {
    const url = outletId ? `/api/qr-menu/orders?outletId=${outletId}` : '/api/qr-menu/orders';
    const res = await fetch(url, { headers: authHeader() });
    return res.json();
  },

  updateQrOrderStatus: async (orderId: string, status: string): Promise<{ status: string; data?: any; message?: string }> => {
    const res = await fetch(`/api/qr-menu/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ status }),
    });
    return res.json();
  },

  getPublicQrMenu: async (outletId: string, tableCode?: string): Promise<{ status: string; data?: PublicMenuResponse; message?: string }> => {
    const url = tableCode ? `/api/qr-menu/public/${outletId}?table=${tableCode}` : `/api/qr-menu/public/${outletId}`;
    const res = await fetch(url);
    return res.json();
  },

  submitPublicQrOrder: async (data: {
    outletId: string;
    tableNumber: string;
    customerName: string;
    customerPhone?: string;
    notes?: string;
    items: Array<{
      productId: string;
      variantId?: string;
      productName: string;
      variantName?: string;
      quantity: number;
      unitPrice: number;
      notes?: string;
      modifiers?: Array<{
        groupName: string;
        option: {
          id: string;
          name: string;
          priceDelta: number;
        };
      }>;
    }>;
  }): Promise<{ status: string; data?: any; message?: string }> => {
    const res = await fetch('/api/qr-menu/public/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // ----------------------------------------------------
  // MODIFIERS & TOPPING (F&B)
  // ----------------------------------------------------
  getModifierGroups: async (): Promise<{ status: string; data: ModifierGroup[]; message?: string }> => {
    const res = await fetch('/api/modifiers', { headers: authHeader() });
    return res.json();
  },

  upsertModifierGroup: async (
    data: UpsertModifierGroupInput
  ): Promise<{ status: string; data?: ModifierGroup; message?: string }> => {
    const res = await fetch('/api/modifiers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteModifierGroup: async (id: string): Promise<{ status: string; message?: string }> => {
    const res = await fetch(`/api/modifiers/${id}`, {
      method: 'DELETE',
      headers: authHeader(),
    });
    return res.json();
  },

  linkProductModifiers: async (
    productId: string,
    modifierGroupIds: string[]
  ): Promise<{ status: string; message?: string }> => {
    const res = await fetch('/api/modifiers/link-product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ productId, modifierGroupIds }),
    });
    return res.json();
  },

  // ----------------------------------------------------
  // RECIPES / BILL OF MATERIALS (BOM)
  // ----------------------------------------------------
  getRecipes: async (outletId?: string): Promise<{ status: string; data: Recipe[]; message?: string }> => {
    const url = outletId ? `/api/recipes?outletId=${outletId}` : '/api/recipes';
    const res = await fetch(url, { headers: authHeader() });
    return res.json();
  },

  getRecipeInventoryItems: async (
    outletId?: string,
    scope?: 'outlet' | 'all'
  ): Promise<{ status: string; data: RecipeInventoryItem[]; message?: string; meta?: any }> => {
    const params = new URLSearchParams();
    if (outletId) params.append('outletId', outletId);
    if (scope) params.append('scope', scope);
    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`/api/recipes/inventory-items${queryStr}`, { headers: authHeader() });
    return res.json();
  },

  createInventoryItem: async (data: {
    name: string;
    itemCode?: string;
    canonicalUom: string;
    averageCost?: number;
    reorderPoint?: number;
    initialStock?: number;
    outletId?: string;
  }): Promise<{ status: string; data?: RecipeInventoryItem; message?: string }> => {
    const res = await fetch('/api/recipes/inventory-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  getRecipeByVariantId: async (variantId: string): Promise<{ status: string; data?: Recipe; message?: string }> => {
    const res = await fetch(`/api/recipes/variant/${variantId}`, { headers: authHeader() });
    return res.json();
  },

  upsertRecipe: async (
    data: UpsertRecipeInput
  ): Promise<{ status: string; data?: Recipe; message?: string }> => {
    const res = await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteRecipe: async (id: string): Promise<{ status: string; message?: string }> => {
    const res = await fetch(`/api/recipes/${id}`, {
      method: 'DELETE',
      headers: authHeader(),
    });
    return res.json();
  },

  // ==========================================
  // SUPPLIERS
  // ==========================================
  getSuppliers: async (params?: { search?: string; isActive?: boolean }): Promise<{ status: string; data?: Supplier[]; message?: string }> => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.isActive !== undefined) query.append('isActive', String(params.isActive));
    const res = await fetch(`/api/suppliers?${query.toString()}`, {
      headers: authHeader(),
    });
    return res.json();
  },

  createSupplier: async (data: SupplierFormData): Promise<{ status: string; data?: Supplier; message?: string }> => {
    const res = await fetch('/api/suppliers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  updateSupplier: async (id: string, data: Partial<SupplierFormData>): Promise<{ status: string; data?: Supplier; message?: string }> => {
    const res = await fetch(`/api/suppliers/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteSupplier: async (id: string): Promise<{ status: string; message?: string }> => {
    const res = await fetch(`/api/suppliers/${id}`, {
      method: 'DELETE',
      headers: authHeader(),
    });
    return res.json();
  },

  // ==========================================
  // PROMOTIONS & VOUCHERS
  // ==========================================
  getPromotions: async (params?: { search?: string; isActive?: boolean }): Promise<{ status: string; data?: { promotions: Promotion[]; total: number } | Promotion[]; message?: string }> => {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.isActive !== undefined) query.append('isActive', String(params.isActive));
    const res = await fetch(`/api/promotions?${query.toString()}`, {
      headers: authHeader(),
    });
    return res.json();
  },

  createPromotion: async (data: PromotionFormData): Promise<{ status: string; data?: Promotion; message?: string }> => {
    const res = await fetch('/api/promotions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  updatePromotion: async (id: string, data: Partial<PromotionFormData>): Promise<{ status: string; data?: Promotion; message?: string }> => {
    const res = await fetch(`/api/promotions/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deletePromotion: async (id: string): Promise<{ status: string; message?: string }> => {
    const res = await fetch(`/api/promotions/${id}`, {
      method: 'DELETE',
      headers: authHeader(),
    });
    return res.json();
  },

  getPromotionById: async (id: string): Promise<{ status: string; data?: Promotion & { usages?: any[] }; message?: string }> => {
    const res = await fetch(`/api/promotions/${id}`, {
      headers: authHeader(),
    });
    return res.json();
  },

  // ==========================================
  // PURCHASE ORDERS (PENGADAAN)
  // ==========================================
  getPurchaseOrders: async (params?: {
    outletId?: string;
    supplierId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    status: string;
    data?: PurchaseOrder[];
    pagination?: { total: number; page: number; limit: number; totalPages: number };
    message?: string;
  }> => {
    const query = new URLSearchParams();
    if (params?.outletId) query.append('outletId', params.outletId);
    if (params?.supplierId) query.append('supplierId', params.supplierId);
    if (params?.status) query.append('status', params.status);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));
    const res = await fetch(`/api/purchasing/orders?${query.toString()}`, {
      headers: authHeader(),
    });
    return res.json();
  },

  getPurchaseOrderById: async (id: string): Promise<{ status: string; data?: PurchaseOrder; message?: string }> => {
    const res = await fetch(`/api/purchasing/orders/${id}`, {
      headers: authHeader(),
    });
    return res.json();
  },

  createPurchaseOrder: async (data: CreatePurchaseOrderInput): Promise<{ status: string; data?: PurchaseOrder; message?: string }> => {
    const res = await fetch('/api/purchasing/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  issuePurchaseOrder: async (id: string): Promise<{ status: string; data?: PurchaseOrder; message?: string }> => {
    const res = await fetch(`/api/purchasing/orders/${id}/issue`, {
      method: 'POST',
      headers: authHeader(),
    });
    return res.json();
  },

  receivePurchaseOrder: async (id: string, data: ReceivePOInput): Promise<{ status: string; data?: PurchaseOrder; message?: string }> => {
    const res = await fetch(`/api/purchasing/orders/${id}/receive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  cancelPurchaseOrder: async (id: string): Promise<{ status: string; data?: PurchaseOrder; message?: string }> => {
    const res = await fetch(`/api/purchasing/orders/${id}/cancel`, {
      method: 'POST',
      headers: authHeader(),
    });
    return res.json();
  },

  // ==========================================
  // STOCK TRANSFERS (TRANSFER ANTAR CABANG)
  // ==========================================
  getStockTransfers: async (params?: {
    sourceOutletId?: string;
    targetOutletId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    status: string;
    data?: StockTransfer[];
    pagination?: { total: number; page: number; limit: number; totalPages: number };
    message?: string;
  }> => {
    const query = new URLSearchParams();
    if (params?.sourceOutletId) query.append('sourceOutletId', params.sourceOutletId);
    if (params?.targetOutletId) query.append('targetOutletId', params.targetOutletId);
    if (params?.status) query.append('status', params.status);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));
    const res = await fetch(`/api/transfers?${query.toString()}`, {
      headers: authHeader(),
    });
    return res.json();
  },

  getStockTransferById: async (id: string): Promise<{ status: string; data?: StockTransfer; message?: string }> => {
    const res = await fetch(`/api/transfers/${id}`, {
      headers: authHeader(),
    });
    return res.json();
  },

  createStockTransfer: async (data: CreateStockTransferInput): Promise<{ status: string; data?: StockTransfer; message?: string }> => {
    const res = await fetch('/api/transfers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  dispatchStockTransfer: async (id: string): Promise<{ status: string; data?: StockTransfer; message?: string }> => {
    const res = await fetch(`/api/transfers/${id}/dispatch`, {
      method: 'POST',
      headers: authHeader(),
    });
    return res.json();
  },

  receiveStockTransfer: async (id: string): Promise<{ status: string; data?: StockTransfer; message?: string }> => {
    const res = await fetch(`/api/transfers/${id}/receive`, {
      method: 'POST',
      headers: authHeader(),
    });
    return res.json();
  },

  // ==========================================
  // EXPIRY ALERTS
  // ==========================================
  getExpiryAlerts: async (params?: { days?: number; outletId?: string }): Promise<{
    status: string;
    data?: ExpiryAlertBatch[];
    message?: string;
  }> => {
    const query = new URLSearchParams();
    if (params?.days) query.append('days', String(params.days));
    if (params?.outletId) query.append('outletId', params.outletId);
    const res = await fetch(`/api/inventory/expiry-alerts?${query.toString()}`, {
      headers: authHeader(),
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

  getPointsHistory: async (id: string): Promise<{ status: string; customer?: any; data?: CustomerPointLedger[]; message?: string }> => {
    const res = await fetch(`/api/customers/${id}/points-history`, {
      headers: authHeader(),
    });
    return res.json();
  },

  adjustPoints: async (
    id: string,
    data: { deltaPoints: number; notes: string; type?: string }
  ): Promise<{ status: string; message?: string; data?: any }> => {
    const res = await fetch(`/api/customers/${id}/adjust-points`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: JSON.stringify(data),
    });
    return res.json();
  },
};

export const supplierApi = {
  getSuppliers: api.getSuppliers,
  createSupplier: api.createSupplier,
  updateSupplier: api.updateSupplier,
  deleteSupplier: api.deleteSupplier,
};

export const promotionApi = {
  getPromotions: api.getPromotions,
  getPromotionById: api.getPromotionById,
  createPromotion: api.createPromotion,
  updatePromotion: api.updatePromotion,
  deletePromotion: api.deletePromotion,
};

export const purchasingApi = {
  getPurchaseOrders: api.getPurchaseOrders,
  getPurchaseOrderById: api.getPurchaseOrderById,
  createPurchaseOrder: api.createPurchaseOrder,
  issuePurchaseOrder: api.issuePurchaseOrder,
  receivePurchaseOrder: api.receivePurchaseOrder,
  cancelPurchaseOrder: api.cancelPurchaseOrder,
};

export const stockTransferApi = {
  getStockTransfers: api.getStockTransfers,
  getStockTransferById: api.getStockTransferById,
  createStockTransfer: api.createStockTransfer,
  dispatchStockTransfer: api.dispatchStockTransfer,
  receiveStockTransfer: api.receiveStockTransfer,
};

