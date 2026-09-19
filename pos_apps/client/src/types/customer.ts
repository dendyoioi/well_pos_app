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

export interface Customer {
  id: string;
  tenantId?: string | null;
  code?: string | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  totalSpent: number;
  visitCount: number;
  createdAt: string;
  updatedAt: string;
  orders?: CustomerOrderSummary[];
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
