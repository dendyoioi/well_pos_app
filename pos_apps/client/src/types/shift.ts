export type ShiftStatus = 'OPEN' | 'CLOSED';

export interface ShiftOrder {
  id: string;
  invoiceNumber: string;
  orderType?: string | null;
  channel?: string | null;
  orderStatus?: string | null;
  paymentStatus?: string | null;
  grandTotal: number;
  subtotal?: number;
  discountAmount?: number;
  taxAmount?: number;
  createdAt: string;
  customerName?: string | null;
  tableNumber?: string | null;
  paymentMethod: string;
  payments?: Array<{ method: string; amount: number }>;
}

export interface ShiftDebtPayment {
  id: string;
  amount: number;
  customerName: string;
  notes?: string | null;
  createdAt: string;
}

export interface Shift {
  id: string;
  outletId: string;
  cashierId: string;
  startTime: string;
  endTime?: string | null;
  startingCash: number;
  expectedCash?: number | null;
  actualCash?: number | null;
  difference?: number | null;
  status: ShiftStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  outlet?: {
    name: string;
    address?: string | null;
    phone?: string | null;
  };
  cashier?: {
    name: string;
    email?: string | null;
  };
  stats?: {
    totalOrders: number;
    cashSalesTotal: number;
    cashSalesCount: number;
    qrisSalesTotal: number;
    qrisSalesCount: number;
    totalRevenue: number;
    totalCashOut?: number;
    totalCashIn?: number;
    totalDebtCashIn?: number;
    expectedCash: number;
  };
  orders?: ShiftOrder[];
  debtPayments?: ShiftDebtPayment[];
  totalDebtCashIn?: number;
  cashMovements?: any[];
}

export interface XReportData {
  reportType: string;
  shiftId: string;
  status: ShiftStatus;
  startTime: string;
  generatedAt: string;
  outlet: {
    name: string;
    address?: string | null;
  };
  cashier: string;
  cashDrawer: {
    startingCash: number;
    cashSales: number;
    totalCashOut?: number;
    totalCashIn?: number;
    totalDebtCashIn?: number;
    expectedCashInDrawer: number;
  };
  debtPayments?: ShiftDebtPayment[];
  totalDebtCashIn?: number;
  cashMovements?: any[];
  paymentSummary: {
    cashSales: number;
    qrisSales: number;
    netRevenue: number;
  };
  transactionSummary: {
    totalOrders: number;
    totalGrossSales: number;
    totalDiscounts: number;
    totalTax: number;
    totalService: number;
  };
  recentOrders: Array<{
    invoiceNumber: string;
    createdAt: string;
    grandTotal: number;
    paymentMethod: string;
  }>;
  allOrders?: ShiftOrder[];
}

export interface ZReportData {
  reportType: string;
  shiftId: string;
  startTime: string;
  endTime: string;
  outlet: string;
  cashier: string;
  cashDrawer: {
    startingCash: number;
    totalCashSales: number;
    totalCashOut?: number;
    totalCashIn?: number;
    totalDebtCashIn?: number;
    expectedCash: number;
    actualCash: number;
    difference: number;
    differenceLabel: string;
  };
  debtPayments?: ShiftDebtPayment[];
  totalDebtCashIn?: number;
  cashMovements?: any[];
  nonCashSummary: {
    totalQrisSales: number;
    totalRevenue: number;
    avgOrderValue?: number;
  };
  /** Breakdown omset per kanal penjualan (DINE_IN, TAKEAWAY, DELIVERY, dll) */
  channelBreakdown?: Array<{
    channel: string;
    count: number;
    revenue: number;
  }>;
  totalTransactions: number;
  orders?: ShiftOrder[];
  notes?: string | null;
}
