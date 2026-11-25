// Well POS - Laundry Analytics Types
// 100% MATCH DENGAN RETURN KONTRAK BACKEND /api/laundry/analytics/*

export interface AnalyticsMeta {
  tenantId: string;
  outletId: string | 'ALL';
  preset: string;
  formattedRange: {
    start: string;
    end: string;
    prevStart: string;
    prevEnd: string;
  };
  timezone: string;
}

export interface FinancialMetricComparison {
  current: number;
  previous: number;
  diff: number;
  percentChange: number;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
}

export interface MetricWithAvailability {
  current: number;
  previous: number;
  diff: number;
  percentChange: number;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  availability: 'READY' | 'PARTIAL' | 'CALCULATED' | 'EMPTY';
}

export interface AlertItem {
  ruleKey: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  message: string;
  actionLabel: string;
  actionTarget: string;
}

export interface HealthScorePillars {
  profitMarginScore?: number; // Sanitize untuk SUPERVISOR
  slaOnTimeScore: number;
  retentionScore: number;
  satisfactionScore: number;
}

export interface HealthScoreResult {
  score: number;
  grade: 'SANGAT_SEHAT' | 'SEHAT' | 'WASPADA' | 'KRITIS' | 'BELUM_ADA_DATA';
  availability: 'CALCULATED' | 'EMPTY';
  pillars: HealthScorePillars;
}

// 1. Executive Overview Result
export interface ExecutiveOverviewResult {
  meta: AnalyticsMeta;
  healthScore: HealthScoreResult;
  targetSummary?: {
    targetRevenue: number;
    actualRevenue: number;
    revenueAchievementPercent: number;
    availability: 'READY' | 'EMPTY';
  };
  financialPulse?: {
    netRevenue: FinancialMetricComparison;
    realCashIn: FinancialMetricComparison;
    operatingProfit: MetricWithAvailability;
    profitMarginPercent: MetricWithAvailability;
    netCashFlow: MetricWithAvailability;
    cogsBom: FinancialMetricComparison;
    recordedOpex: MetricWithAvailability;
  };
  operationalPulse: {
    totalValidOrders: number;
    totalWeightKg: number;
    totalPieces: number;
    averageOrderValue?: number; // Dihapus untuk SUPERVISOR
    onTimeCompletionRate: number;
    overdueOrdersCount: number;
    activeQueueCount: number;
    incidentCount: number;
    incidentRate: number;
  };
  customerPulse: {
    activeCustomersCount: number;
    newCustomersCount: number;
    returningCustomersCount: number;
    repeatCustomerRate: number;
    avgRating: number;
    ratingCount: number;
  };
  alerts: AlertItem[];
  revenueSeries?: Array<{
    date: string;
    accrualRevenue: number;
    realCashIn: number;
    recordedOpex: number;
  }>;
}

// 2. Financial Analytics Result
export interface FinancialAnalyticsResult {
  meta: AnalyticsMeta;
  revenue: {
    grossRevenue: FinancialMetricComparison;
    discountTotal: FinancialMetricComparison;
    accrualOrderTotal: FinancialMetricComparison;
    refundTotal: FinancialMetricComparison;
    netRevenue: FinancialMetricComparison;
  };
  cashFlow: {
    realCashIn: FinancialMetricComparison;
    components: {
      directOrderPayments: FinancialMetricComparison;
      debtRepayments: FinancialMetricComparison;
      walletBalanceTopup: FinancialMetricComparison;
      quotaTopupCash: FinancialMetricComparison;
    };
    netCashFlow: MetricWithAvailability;
  };
  cogsAndProfit: {
    cogsBom: FinancialMetricComparison;
    grossProfit: FinancialMetricComparison;
    grossProfitMarginPercent: {
      current: number;
      previous: number;
      diff: number;
      percentChange: number;
      direction: 'UP' | 'DOWN' | 'NEUTRAL';
    };
  };
  opex: {
    pettyCashOut: FinancialMetricComparison;
    pettyCashByCategory: Array<{ category: string; amount: number }>;
    incidentExpense: FinancialMetricComparison;
    fixedOpex: FinancialMetricComparison & {
      availability: 'READY';
      note?: string;
    };
    fixedOpexByCategory: Array<{ category: string; amount: number }>;
    recordedOpex: MetricWithAvailability;
  };
  profitability: {
    operatingProfit: MetricWithAvailability;
    profitMarginPercent: MetricWithAvailability;
  };
  balanceSheetSummary: {
    outstandingReceivables: number;
    walletLiability: {
      balanceAmount: number;
      quotaKg: number;
    };
  };
  revenueSeries: Array<{
    date: string;
    accrualRevenue: number;
    realCashIn: number;
    recordedOpex: number;
  }>;
}

// 3. Sales Analytics Result
export interface SalesAnalyticsResult {
  meta: AnalyticsMeta;
  summary: {
    totalValidOrders: FinancialMetricComparison;
    totalWeightKg: FinancialMetricComparison;
    totalPieces: FinancialMetricComparison;
    netRevenue: FinancialMetricComparison;
    averageOrderValue: FinancialMetricComparison;
    discountTotal: FinancialMetricComparison;
    discountPercentage: FinancialMetricComparison;
    cancelledCount: FinancialMetricComparison;
    voidedCount: FinancialMetricComparison;
    cancellationRate: FinancialMetricComparison;
    refundCount: FinancialMetricComparison;
    refundAmount: FinancialMetricComparison;
  };
  kiloanVsSatuan: {
    kiloan: {
      revenue: number;
      itemCount: number;
      orderCount: number;
      sharePercent: number;
    };
    satuan: {
      revenue: number;
      itemCount: number;
      orderCount: number;
      sharePercent: number;
    };
  };
  topServices: Array<{
    serviceId: string;
    serviceName: string;
    category: string;
    revenue: number;
    quantity: number;
    orderCount: number;
    sharePercent: number;
  }>;
  byCashier: Array<{
    cashierId: string;
    cashierName: string;
    validOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    voidedOrders: number;
    voidRate: number;
  }>;
  heatmap: Array<{
    dayOfWeek: number; // 0=Sun..6=Sat
    hour: number;      // 0..23
    orderCount: number;
    revenue: number;
  }>;
  byDay: Array<{
    dayOfWeek: number;
    dayName: string;
    orderCount: number;
    revenue: number;
  }>;
  byHour: Array<{
    hour: number;
    orderCount: number;
    revenue: number;
  }>;
  topPerfumes: Array<{
    perfumeVariant: string;
    orderCount: number;
    totalWeightKg: number;
  }>;
  addonsSummary: {
    totalAddonsRevenue: number;
    totalAddonsUsageCount: number;
    topAddons: Array<{
      name: string;
      count: number;
      revenue: number;
    }>;
  };
}

// 4. Customer Analytics Result
export interface DormantCustomerItem {
  customerId: string;
  name: string;
  phone: string | null;
  lastOrderAt: string | null;
  daysSinceLastOrder: number;
  totalOrders: number;
  totalSpent: number;
  lastWinbackSentAt: string | null;
}

export interface CustomerAnalyticsResult {
  meta: AnalyticsMeta;
  overview: {
    totalCustomers: number;
    activeCustomersCount: number;
    newCustomersCount: number;
    returningCustomersCount: number;
    dormantCustomersCount: number;
    repeatCustomerRate: number;
    averageClv: number;
    averageVisitFrequencyDays: number;
    periodRetentionRate: number;
  };
  segments: {
    new: number;
    active: number;
    loyal: number;
    dormant: number;
    highValue: number;
  };
  config: {
    dormantDays: number;
    loyalMinOrders: number;
  };
  dormantList: DormantCustomerItem[];
  winbackStats: {
    contactedCount: number;
    returnedCount: number;
    conversionRate: number;
    availability: 'PARTIAL';
  };
  feedbackSummary: {
    avgRating: number;
    totalFeedbacks: number;
    complaintCount: number;
    complaintRate: number;
    fiveStarCount: number;
    googleRedirectCount: number;
    googleRedirectRate: number;
  };
  walletBreakage: {
    expiredAmount: number;
    expiredKg: number;
    totalTopupAmount: number;
    totalTopupKg: number;
  };
}

// 5. Operations Analytics Result
export const CANONICAL_STAGES = [
  'DROP_OFF',
  'TAGGING',
  'SORTING',
  'SPOTTING',
  'WASHING',
  'DRYING',
  'IRONING',
  'FOLDING',
  'PACKING',
  'RACK_STORAGE',
  'HANDOVER',
] as const;

export type CanonicalStage = (typeof CANONICAL_STAGES)[number];
export type CanonicalIncidentType = 'DAMAGED' | 'LOST' | 'STAIN_REMAINING' | 'MIXED_UP';

export interface StagePipelineItem {
  stage: CanonicalStage;
  activeOrderCount: number;
  activeWeightKg: number;
  avgDurationMinutes: number;
  isBottleneck: boolean;
}

export interface IncidentTypeSummary {
  incidentType: CanonicalIncidentType;
  count: number;
  totalCompensation: number;
}

export interface OperationsAnalyticsResult {
  meta: AnalyticsMeta;
  summary: {
    totalOrdersProcessed: number;
    totalWeightProcessed: number;
    totalPiecesProcessed: number;
    workInProgressCount: number;
    averageTurnaroundHours: number;
    onTimeCompletionRate: number;
    dueOrdersCount: number;
    onTimeOrdersCount: number;
    overdueOrdersCount: number;
    rewashCount: number;
    rewashRate: number;
  };
  stagePipeline: StagePipelineItem[];
  bottleneckStage: CanonicalStage | null;
  incidents: {
    totalIncidents: number;
    incidentRate: number;
    totalApprovedCompensation?: number; // Sanitize untuk SUPERVISOR
    meanTimeToResolveHours: number;
    byType: IncidentTypeSummary[];
    byStatus: Array<{
      status: string;
      count: number;
    }>;
  };
  workshopTransfer: {
    totalManifests: number;
    inTransitCount: number;
    receivedCount: number;
    avgTransferLagHours: number;
  };
}

// 6. Employees Analytics Result
export interface EmployeeLeaderboardItem {
  userId: string;
  name: string;
  role: string;
  ordersHandled: number;
  weightProcessedKg: number;
  stagesCompleted: number;
  workHours: number;
  kgPerHour: number;
  ordersPerHour: number;
  lateCount: number;
  lateMinutes: number;
  incidentCount: number;
  latestOverallScore: number | null;
  latestGrade: string | null;
  disciplineScore: number | null;
  productivityScore: number | null;
  qualityScore: number | null;
  customerScore: number | null;
}

export interface ShiftPerformanceItem {
  shiftTemplateId: string | null;
  shiftName: string;
  startTime: string | null;
  endTime: string | null;
  scheduledCount: number;
  attendedCount: number;
  lateCount: number;
}

export interface EmployeesAnalyticsResult {
  meta: AnalyticsMeta;
  summary: {
    activeStaffCount: number;
    scheduledShiftsCount: number;
    attendedShiftsCount: number;
    attendanceRate: number;
    totalLateCount: number;
    totalLateMinutes: number;
    revenuePerEmployee?: number; // Sanitize untuk SUPERVISOR
  };
  gradeDistribution: {
    A: number;
    B: number;
    C: number;
    D: number;
    UNREVIEWED: number;
  };
  leaderboard: EmployeeLeaderboardItem[];
  byShift: ShiftPerformanceItem[];
}

// 7. Machines Analytics Result
export interface MachineUtilizationItem {
  machineId: string;
  code: string;
  name: string;
  machineType: 'WASHER' | 'DRYER' | string;
  capacityKg: number;
  status: 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE' | string;
  cycleCount: number;
  operatingHours: number;
  utilizationPercent: number;
  maintenanceDue: boolean;
  downtimeMinutes: number;
  maintenanceCount: number;
  maintenanceCost: number;
  lastMaintenanceDate: string | null;
}

export interface MachineTypeAggregation {
  machineType: 'WASHER' | 'DRYER' | string;
  unitCount: number;
  totalCycles: number;
  totalOperatingHours: number;
  avgUtilizationPercent: number;
}

export interface MachinesAnalyticsResult {
  meta: AnalyticsMeta & {
    dataSourceNote: string;
    availability: 'READY' | 'PARTIAL';
  };
  summary: {
    totalMachines: number;
    activeMachines: number;
    maintenanceMachines: number;
    inactiveMachines: number;
    totalCycles: number;
    totalOperatingHours: number;
    overallUtilizationPercent: number;
    downtimeLogs: {
      totalLogs: number;
      totalDowntimeMinutes: number;
      totalDowntimeHours: number;
      totalMaintenanceCost?: number;
      availability: 'READY';
      note?: string;
    };
    costPerCycle: {
      current: number;
      totalCycles: number;
      totalMachineExpense?: number;
      utilityOpex?: number;
      maintenanceCost?: number;
      availability: 'READY' | 'EMPTY';
      note?: string;
    };
  };
  byType: MachineTypeAggregation[];
  machines: MachineUtilizationItem[];
}

// 8. Inventory Analytics Result
export interface LowStockItem {
  itemId: string;
  itemCode: string;
  name: string;
  uom: string;
  quantityOnHand: number;
  reorderPoint: number;
  averageCost: number;
  status: 'CRITICAL' | 'LOW';
}

export interface DeadStockItem {
  itemId: string;
  itemCode: string;
  name: string;
  uom: string;
  quantityOnHand: number;
  averageCost: number;
  totalValuation: number;
  daysWithoutMovement: number;
}

export interface SupplierPurchaseItem {
  supplierId: string;
  supplierName: string;
  poCount: number;
  totalAmount: number;
}

export interface InventoryAnalyticsResult {
  meta: AnalyticsMeta;
  summary: {
    chemicalCostPerKg: number;
    inventoryValuation?: number; // Sanitize untuk SUPERVISOR
    lowStockCount: number;
    shrinkageValue?: number;     // Sanitize untuk SUPERVISOR
    bomVariancePercent: number;
    purchaseOrderValue?: number; // Sanitize untuk SUPERVISOR
    packagingCostPerOrder: number;
  };
  lowStockItems: LowStockItem[];
  deadStockItems: DeadStockItem[];
  purchasesBySupplier: SupplierPurchaseItem[];
}

// 9. Benchmark Analytics Result
export interface BenchmarkOutletItem {
  outletId: string;
  outletCode: string;
  outletName: string;
  isWorkshop: boolean;
  netRevenue: number;
  revenueSharePercent: number;
  totalValidOrders: number;
  totalWeightKg: number;
  onTimeCompletionRate: number;
  avgRating: number;
  complaintRate: number;
  incidentRate: number;
  healthScore: number;
  healthGrade: string;
  target?: {
    targetRevenue: number;
    targetProfit: number;
    targetWeightKg: number;
    targetOrdersCount: number;
    targetNewCustomers: number;
    revenueAchievementPercent: number;
    weightAchievementPercent: number;
  } | null;
}

export interface BenchmarkAnalyticsResult {
  meta: {
    tenantId: string;
    preset: string;
    formattedRange: {
      start: string;
      end: string;
      prevStart: string;
      prevEnd: string;
    };
    timezone: string;
  };
  consolidatedSummary: {
    totalOutlets: number;
    totalNetRevenue: number;
    totalValidOrders: number;
    totalWeightKg: number;
    avgOnTimeRate: number;
    avgHealthScore: number;
  };
  workshopSummary: {
    workshopCount: number;
    satelliteCount: number;
    totalManifests: number;
    totalOrdersTransferred: number;
    avgTransferLagHours: number;
  };
  targets: {
    availability: 'READY' | 'EMPTY';
    periodYear: number;
    periodMonth: number;
    totalTargetRevenue: number;
    totalTargetWeightKg: number;
    revenueAchievementPercent: number;
    weightAchievementPercent: number;
    note?: string;
  };
  outlets: BenchmarkOutletItem[];
}

// 10. Drilldown Analytics Result
export type DrilldownType =
  | 'ORDERS_BY_DATE'
  | 'ORDERS_BY_STAGE'
  | 'ORDERS_BY_PAYMENT'
  | 'ORDERS_BY_HOUR'
  | 'UNPAID_DEBTS'
  | 'OVERDUE_ORDERS'
  | 'DORMANT_CUSTOMERS';

export interface DrilldownResult {
  type: DrilldownType;
  items: any[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
  filters?: {
    tenantId: string;
    outletId: string | 'ALL';
    targetDate?: string;
    date?: string;
    stage?: string;
    paymentMethod?: string;
    dayOfWeek?: number;
    hour?: number;
    dormantDays?: number;
  };
}

// 11. AI Analytics Results
export interface DataStamp {
  periodLabel: string;
  startDate: string;
  endDate: string;
  outletScope: string;
  dataSources?: string[];
  generatedAt: string;
}

export interface PrescriptionAction {
  title: string;
  reason: string;
  actionLabel: string;
  actionTarget: string;
}

export interface AiSummaryResult {
  meta: {
    tenantId: string;
    outletId: string | 'ALL';
    dataStamp: DataStamp;
  };
  descriptiveSummary: string;
  diagnostics: Array<{
    area: string;
    status: 'OPTIMAL' | 'WARNING' | 'CRITICAL';
    finding: string;
    rootCause: string;
  }>;
  prescriptions: PrescriptionAction[];
  anomalies: Array<{
    type: string;
    severity: 'WARNING' | 'CRITICAL';
    description: string;
  }>;
}

export interface AiForecastResult {
  meta: {
    tenantId: string;
    outletId: string | 'ALL';
    dataStamp: DataStamp;
  };
  method: string;
  mtd: {
    revenue: number;
    weightKg: number;
    daysElapsed: number;
  };
  recentRunRate: {
    last7DaysAvgRevenue: number;
    last7DaysAvgWeightKg: number;
  };
  projection: {
    remainingDaysInMonth: number;
    projectedMonthEndRevenue: number;
    projectedMonthEndWeightKg: number;
    projectedRevenueGrowthPercent: number;
  };
}

export interface AiQueryResult {
  meta: {
    tenantId: string;
    outletId: string | 'ALL';
    dataStamp: DataStamp;
  };
  intent: string;
  question: string;
  answer: string;
  supportingMetrics: Record<string, any>;
}

// Request Query Options
export interface AnalyticsQueryParams {
  preset?: string;
  startDate?: string;
  endDate?: string;
  outletId?: string;
  timezone?: string;
  signal?: AbortSignal;
}

// =========================================================================
// WAVE 2: OPERATIONAL EXPENSES, TARGETS & MACHINE MAINTENANCE TYPES
// =========================================================================

export type ExpenseCategory =
  | 'ELECTRICITY'
  | 'WATER'
  | 'RENT'
  | 'SALARY'
  | 'MARKETING'
  | 'MAINTENANCE'
  | 'SUPPLIES'
  | 'OTHER';

export interface OperationalExpenseItem {
  id: string;
  tenantId: string;
  outletId: string;
  expenseDate: string;
  category: ExpenseCategory;
  amount: number;
  paymentMethod: string;
  notes?: string | null;
  receiptPhotoUrl?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  outlet?: {
    id: string;
    name: string;
    code?: string;
  };
  createdBy?: {
    id: string;
    name: string;
    userCode?: string;
  };
}

export interface OperationalExpensesResult {
  items: OperationalExpenseItem[];
  totalAmount: number;
  pagination: {
    currentPage: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface CreateOperationalExpensePayload {
  outletId: string;
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
  paymentMethod?: string;
  notes?: string;
  receiptPhotoUrl?: string;
}

export interface UpdateOperationalExpensePayload {
  outletId?: string;
  category?: ExpenseCategory;
  amount?: number;
  expenseDate?: string;
  paymentMethod?: string;
  notes?: string;
  receiptPhotoUrl?: string;
}

export interface OutletBusinessTargetItem {
  id: string;
  tenantId: string;
  outletId: string;
  periodYear: number;
  periodMonth: number;
  targetRevenue: number;
  targetProfit: number;
  targetWeightKg: number;
  targetOrdersCount: number;
  targetNewCustomers: number;
  notes?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  outlet?: {
    id: string;
    name: string;
    code?: string;
  };
  createdBy?: {
    id: string;
    name: string;
    userCode?: string;
  };
}

export interface UpsertOutletTargetPayload {
  outletId: string;
  periodYear: number;
  periodMonth: number;
  targetRevenue: number;
  targetProfit: number;
  targetWeightKg: number;
  targetOrdersCount: number;
  targetNewCustomers: number;
  notes?: string;
}

export interface LaundryMachineMaintenanceLogItem {
  id: string;
  tenantId: string;
  outletId: string;
  machineId: string;
  serviceType: 'ROUTINE' | 'REPAIR' | 'EMERGENCY' | string;
  startDate: string;
  endDate?: string | null;
  downtimeMinutes: number;
  technicianName?: string | null;
  cost?: number; // Sembunyi/dihapus untuk SUPERVISOR
  notes?: string | null;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  machine?: {
    id: string;
    name: string;
    code: string;
    machineType: string;
    status: string;
  };
  outlet?: {
    id: string;
    name: string;
    code?: string;
  };
  createdBy?: {
    id: string;
    name: string;
    userCode?: string;
  };
}

export interface MachineMaintenanceResult {
  items: LaundryMachineMaintenanceLogItem[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface CreateMachineMaintenancePayload {
  outletId?: string;
  machineId: string;
  serviceType: 'ROUTINE' | 'REPAIR' | 'EMERGENCY' | string;
  startDate: string;
  endDate?: string | null;
  downtimeMinutes?: number;
  technicianName?: string;
  cost?: number;
  notes?: string;
  status?: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | string;
}

export interface UpdateMachineMaintenancePayload {
  serviceType?: 'ROUTINE' | 'REPAIR' | 'EMERGENCY' | string;
  startDate?: string;
  endDate?: string | null;
  downtimeMinutes?: number;
  technicianName?: string;
  cost?: number;
  notes?: string;
  status?: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | string;
}

// =========================================================================
// WAVE 3A: PERSISTENT ALERTING & RULES ENGINE TYPES
// =========================================================================

export interface PersistentAlertItem {
  id: string;
  tenantId: string;
  outletId: string;
  ruleKey: string;
  severity: 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  metricValue: number;
  thresholdValue: number;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'IGNORED';
  waNotifiedAt: string | null;
  resolvedAt: string | null;
  resolvedById: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
  outlet?: {
    id: string;
    name: string;
  };
  resolvedBy?: {
    id: string;
    name: string;
  };
}

export interface PersistentAlertsSummary {
  openCriticalCount: number;
  openWarningCount: number;
  inProgressCount: number;
  resolvedCount: number;
  totalOpen: number;
}

export interface PersistentAlertsResult {
  alerts: PersistentAlertItem[];
  summary: PersistentAlertsSummary;
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface AlertRuleConfigItem {
  id?: string;
  tenantId?: string;
  outletId?: string | null;
  ruleKey: string;
  label: string;
  unit: string;
  operator: 'LT' | 'GT' | 'GTE';
  isFinancial: boolean;
  warningThreshold: number;
  criticalThreshold: number;
  isEnabled: boolean;
  notificationChannels: string[];
}

export interface UpsertAlertRulePayload {
  outletId?: string | null;
  ruleKey: string;
  warningThreshold: number;
  criticalThreshold: number;
  isEnabled: boolean;
  notificationChannels: string[];
}

export interface EvaluateAlertsResult {
  evaluatedRulesCount: number;
  createdCount: number;
  updatedCount: number;
  waSentCount: number;
  alerts: any[];
}
