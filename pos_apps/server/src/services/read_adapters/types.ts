/**
 * Target Read Adapters DTO Interfaces & Query Options (PROMPT 15.2)
 * Ensures 100% contract fidelity with existing controller responses.
 */

export interface GetProductsQueryOptions {
  tenantId: string;
  outletId?: string;
  categoryId?: string;
  search?: string;
  isActive?: string | boolean;
}

export interface FormattedProductDTO {
  id: string;
  name: string;
  description: string | null;
  sku: string;
  barcode: string | null;
  unit: string;
  basePrice: number;
  price?: number;
  costPrice: number;
  imageUrl: string | null;
  isActive: boolean;
  category: { id: string; name: string } | null;
  stock: number;
  warehouseStock: number | null;
  minStockAlert: number;
  isLowStock: boolean;
  productType?: string;
  hasStock?: boolean;
  variants?: {
    id: string;
    sku?: string;
    name: string;
    price: number;
    costPrice?: number;
  }[];
  modifiers?: {
    id: string;
    name: string;
    type: string;
    required: boolean;
    options: {
      id: string;
      name: string;
      priceDelta: number;
      isDefault?: boolean;
    }[];
  }[];
  createdAt: Date;
}

export interface FormattedCategoryDTO {
  id: string;
  name: string;
  productCount: number;
}

export interface LowStockItemDTO {
  productId: string;
  name: string;
  sku: string;
  barcode: string | null;
  unit: string;
  stock: number;
  minStockAlert: number;
}

export interface StockMovementDTO {
  id: string;
  productId: string;
  outletId: string;
  userId: string | null;
  type: string;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  notes: string | null;
  createdAt: Date;
  product: {
    id: string;
    name: string;
    sku: string;
    unit: string;
    costPrice: number;
    basePrice: number;
  };
  user: {
    id: string;
    name: string;
    role: string;
  } | null;
  outlet: {
    id: string;
    name: string;
  };
}

export interface GetOrdersQueryOptions {
  tenantId: string;
  outletId?: string;
  cashierId?: string;
  channel?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  page?: number;
}

export interface OrderListItemDTO {
  id: string;
  tenantId: string;
  outletId: string;
  userId: string;
  customerId: string | null;
  invoiceNumber: string;
  queueNumber?: number | null;
  orderStatus: string;
  paymentStatus: string;
  orderType: string;
  channel?: string;
  subtotal: number;
  discountTotal: number;
  discountAmount?: number;
  taxTotal: number;
  taxAmount?: number;
  serviceTotal: number;
  serviceCharge?: number;
  totalAmount: number;
  grandTotal?: number;
  paidAmount: number;
  changeAmount: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  orderItems: Array<{
    id: string;
    productName: string;
    variantName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    categoryName?: string;
    product: {
      name: string;
      unit: string;
      category?: {
        name: string;
      };
    };
  }>;
  items?: Array<{
    id: string;
    productName: string;
    variantName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    categoryName?: string;
    product: {
      name: string;
      unit: string;
      category?: {
        name: string;
      };
    };
  }>;
  payments: Array<{
    id: string;
    paymentMethod: string;
    amount: number;
    status: string;
    referenceNumber: string | null;
  }>;
  cashier: {
    id: string;
    name: string;
    role?: string;
  };
  outlet: {
    id: string;
    name: string;
  };
  customer: {
    id: string;
    name: string;
    phone: string | null;
    code: string | null;
  } | null;
}

export interface FinancialReportDTO {
  filter: {
    startDate: string;
    endDate: string;
    outletId?: string;
  };
  financialSummary: {
    totalGrossSales: number;
    totalDiscounts: number;
    totalService: number;
    totalTax: number;
    totalNetRevenue: number;
    totalCOGS: number;
    netSalesExTax: number;
    grossProfit: number;
    grossProfitMargin: number;
    totalTransactions: number;
    averageOrderValue: number;
    totalOperatingExpenses?: number;
    netOperatingProfit?: number;
    netOperatingProfitMargin?: number;
  };
  cashFlow: {
    cash: { amount: number; count: number; percentage: number };
    qris: { amount: number; count: number; percentage: number };
  };
  topProducts: Array<{
    id: string;
    name: string;
    sku: string;
    categoryName: string;
    qtySold: number;
    revenue: number;
    cost: number;
    profit: number;
    profitMargin: number;
  }>;
  slowMovingProducts: Array<{
    id: string;
    name: string;
    sku: string;
    categoryName: string;
    currentStock: number;
    costPrice: number;
    basePrice: number;
    qtySold: number;
    revenue: number;
    deadStockValue: number;
  }>;
  salesByCategory: Array<{
    id: string;
    name: string;
    qtySold: number;
    revenue: number;
    percentage: number;
  }>;
  dailyTrends: Array<{
    date: string;
    ordersCount: number;
    revenue: number;
    cogs: number;
    grossProfit: number;
    cashRevenue: number;
    qrisRevenue: number;
  }>;
  channelSales?: Array<{
    channel: string;
    name: string;
    amount: number;
    count: number;
    percentage: number;
  }>;
  hourlyDistribution?: Array<{
    hour: number;
    label: string;
    ordersCount: number;
    revenue: number;
  }>;
  insights?: {
    peakHour: string;
    peakHourOrdersCount: number;
    averageBasketSize: number;
    highMarginChampion?: string;
    marginKiller?: string;
    profitHealthStatus: 'SEHAT' | 'WASPADA' | 'KRITIS';
  };
}
