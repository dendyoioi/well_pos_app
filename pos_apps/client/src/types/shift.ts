export type ShiftStatus = 'OPEN' | 'CLOSED';

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
    expectedCash: number;
  };
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
    expectedCashInDrawer: number;
  };
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
    expectedCash: number;
    actualCash: number;
    difference: number;
    differenceLabel: string;
  };
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
  notes?: string | null;
}
