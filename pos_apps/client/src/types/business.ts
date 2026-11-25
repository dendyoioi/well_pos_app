export type BusinessVerticalMode = 'FNB' | 'RETAIL' | 'LAUNDRY';

export interface BusinessOutletSummary {
  id: string;
  tenantId: string;
  businessId?: string | null;
  code?: string | null;
  name: string;
  merchantName?: string | null;
  address?: string | null;
  phone?: string | null;
  industries?: string[] | null;
  isWarehouse?: boolean | null;
  isWorkshop?: boolean | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    users: number;
    orders: number;
  };
}

export interface BusinessItem {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  vertical: BusinessVerticalMode;
  subCategory?: string | null;
  logoUrl?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  outlets: BusinessOutletSummary[];
  totalActiveOutlets: number;
  totalValidOrders: number;
}

export interface CreateBusinessPayload {
  name: string;
  vertical: BusinessVerticalMode;
  subCategory?: string | null;
  logoUrl?: string | null;
  initialOutlet: {
    name: string;
    address?: string | null;
    phone?: string | null;
    isWorkshop?: boolean;
  };
}

export interface UpdateBusinessPayload {
  name?: string;
  vertical?: BusinessVerticalMode;
  subCategory?: string | null;
  logoUrl?: string | null;
  isActive?: boolean;
}

export interface TokenUsageByBusiness {
  businessId: string;
  businessName: string;
  vertical: BusinessVerticalMode;
  totalOrders: number;
  ordersLast30d: number;
}

export interface OwnerTokenSummary {
  totalPurchasedTokens: number;
  totalUsedTokens: number;
  remainingTokens: number;
  ordersLast30d: number;
  dailyBurnRate: number;
  estimatedDaysLeft: number | null;
  usageByBusiness: TokenUsageByBusiness[];
  recentInvoices: Array<{
    id: string;
    invoiceNumber: string;
    status: string;
    amount: number;
    tokenAmount: number | null;
    createdAt: string;
    paidAt: string | null;
  }>;
}
