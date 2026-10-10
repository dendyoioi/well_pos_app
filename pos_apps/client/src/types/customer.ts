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
  totalAmount?: number;
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
  firstOutlet?: { id?: string; name: string } | null;
  firstOrderAt?: string | null;
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

export type CustomerDebtStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'CANCELLED';

export interface CustomerDebtPayment {
  id: string;
  tenantId: string;
  debtId: string;
  outletId: string;
  cashierId?: string | null;
  shiftId?: string | null;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string | null;
  notes?: string | null;
  paidAt: string;
  createdAt: string;
  cashier?: {
    id: string;
    name: string;
  };
}

export interface CustomerDebt {
  id: string;
  tenantId: string;
  outletId: string;
  customerId: string;
  orderId: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate?: string | null;
  status: CustomerDebtStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    name: string;
    phone?: string | null;
    code?: string | null;
  };
  outlet?: {
    id: string;
    name: string;
  };
  order?: {
    id: string;
    invoiceNumber: string;
    totalAmount?: number;
    createdAt: string;
  };
  payments?: CustomerDebtPayment[];
}

export interface CustomerDebtSummaryStats {
  totalDebt: number;
  totalPaid: number;
  totalRemaining: number;
  unpaidCount: number;
}

