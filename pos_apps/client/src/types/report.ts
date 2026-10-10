export interface FinancialSummary {
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
}

export interface CashFlowDetail {
  amount: number;
  count: number;
  percentage: number;
}

export interface NonCashSubCategory {
  id: string;
  label: string;
  amount: number;
  count: number;
  color?: string;
  percentage: number;
}

export interface NonCashDetail extends CashFlowDetail {
  subCategories: NonCashSubCategory[];
}

export interface CashFlowReport {
  cash: CashFlowDetail;
  qris: CashFlowDetail;
  nonCash?: NonCashDetail;
}

export interface TopProductItem {
  id: string;
  name: string;
  sku: string;
  categoryName: string;
  qtySold: number;
  revenue: number;
  cost: number;
  profit: number;
  profitMargin: number;
}

export interface CategorySalesItem {
  id: string;
  name: string;
  qtySold: number;
  revenue: number;
  percentage: number;
}

export interface DailyTrendItem {
  date: string;
  ordersCount: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  cashRevenue: number;
  qrisRevenue: number;
}

export interface SlowMovingProductItem {
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
}

export interface ChannelSalesItem {
  channel: string;
  name: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface HourlyDistributionItem {
  hour: number;
  label: string;
  ordersCount: number;
  revenue: number;
}

export interface SmartInsights {
  peakHour: string;
  peakHourOrdersCount: number;
  averageBasketSize: number;
  highMarginChampion?: string;
  marginKiller?: string;
  profitHealthStatus: 'SEHAT' | 'WASPADA' | 'KRITIS';
}

export interface FinancialReportData {
  filter: {
    startDate: string;
    endDate: string;
    outletId: string;
  };
  financialSummary: FinancialSummary;
  cashFlow: CashFlowReport;
  topProducts: TopProductItem[];
  slowMovingProducts?: SlowMovingProductItem[];
  salesByCategory: CategorySalesItem[];
  dailyTrends: DailyTrendItem[];
  channelSales?: ChannelSalesItem[];
  hourlyDistribution?: HourlyDistributionItem[];
  insights?: SmartInsights;
}
