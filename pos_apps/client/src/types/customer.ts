export type CustomerTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export type PointTxType =
  | 'EARNED_PURCHASE'
  | 'REDEEMED_ORDER'
  | 'MANUAL_ADJUSTMENT'
  | 'REFUND_REVOCATION'
  | 'EXPIRY';

export interface CustomerOrderSummary {
  id: string;
  invoiceNumber: string;
  grandTotal: number;
  paymentStatus: string;
  createdAt: string;
  outlet?: {
    name: string;
  };
}

export interface CustomerPointLedger {
  id: string;
  tenantId: string;
  customerId: string;
  orderId?: string | null;
  type: PointTxType;
  deltaPoints: number;
  balanceAfter: number;
  notes?: string | null;
  createdAt: string;
  order?: {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
  } | null;
}

export interface Customer {
  id: string;
  tenantId?: string | null;
  code?: string | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  tier?: CustomerTier;
  loyaltyPoints?: number;
  totalSpent: number;
  visitCount: number;
  createdAt: string;
  updatedAt: string;
  orders?: CustomerOrderSummary[];
  pointLedgers?: CustomerPointLedger[];
}

export interface CustomerSummaryStats {
  totalCustomers: number;
  totalRevenueFromCustomers: number;
  totalVisits: number;
  activeRepeatMembers: number;
  avgSpendPerCustomer: number;
}

export interface CustomerFormData {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  code?: string;
}
