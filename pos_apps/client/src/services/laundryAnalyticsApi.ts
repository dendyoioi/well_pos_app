// Well POS - Modular Laundry Analytics API Client
// Menggunakan AbortSignal, authHeader dari authStorage, dan base resolver apiBase.ts

import { authStorage } from './api';
import { API_BASE_URL } from './apiBase';
import type {
  AnalyticsQueryParams,
  ExecutiveOverviewResult,
  FinancialAnalyticsResult,
  SalesAnalyticsResult,
  CustomerAnalyticsResult,
  OperationsAnalyticsResult,
  EmployeesAnalyticsResult,
  MachinesAnalyticsResult,
  InventoryAnalyticsResult,
  BenchmarkAnalyticsResult,
  DrilldownResult,
  AiSummaryResult,
  AiForecastResult,
  AiQueryResult,
  OperationalExpenseItem,
  OperationalExpensesResult,
  CreateOperationalExpensePayload,
  UpdateOperationalExpensePayload,
  OutletBusinessTargetItem,
  UpsertOutletTargetPayload,
  LaundryMachineMaintenanceLogItem,
  MachineMaintenanceResult,
  CreateMachineMaintenancePayload,
  UpdateMachineMaintenancePayload,
} from '../types/laundryAnalytics';

const BASE_PATH = `${API_BASE_URL}/api/laundry/analytics`;

const getHeaders = (): Record<string, string> => {
  const token = authStorage.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

function buildQueryString(params?: Record<string, any>): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      searchParams.append(key, String(val));
    }
  }
  const str = searchParams.toString();
  return str ? `?${str}` : '';
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg =
      body?.message || body?.error || `Request failed with HTTP status ${res.status}`;
    const err = new Error(errorMsg);
    (err as any).statusCode = res.status;
    (err as any).body = body;
    throw err;
  }

  // Response kanonikal Well POS: { status: 'success', data: T, meta: any }
  return body.data !== undefined ? body.data : body;
}

// 1. Overview
export async function fetchLaundryOverview(
  params?: AnalyticsQueryParams,
  signal?: AbortSignal
): Promise<ExecutiveOverviewResult> {
  const qs = buildQueryString({
    preset: params?.preset,
    startDate: params?.startDate,
    endDate: params?.endDate,
    outletId: params?.outletId,
    timezone: params?.timezone,
  });
  return request<ExecutiveOverviewResult>(`${BASE_PATH}/overview${qs}`, {
    method: 'GET',
    signal: signal || params?.signal,
  });
}

// 2. Financial
export async function fetchLaundryFinancial(
  params?: AnalyticsQueryParams,
  signal?: AbortSignal
): Promise<FinancialAnalyticsResult> {
  const qs = buildQueryString({
    preset: params?.preset,
    startDate: params?.startDate,
    endDate: params?.endDate,
    outletId: params?.outletId,
    timezone: params?.timezone,
  });
  return request<FinancialAnalyticsResult>(`${BASE_PATH}/financial${qs}`, {
    method: 'GET',
    signal: signal || params?.signal,
  });
}

// 3. Sales
export async function fetchLaundrySales(
  params?: AnalyticsQueryParams,
  signal?: AbortSignal
): Promise<SalesAnalyticsResult> {
  const qs = buildQueryString({
    preset: params?.preset,
    startDate: params?.startDate,
    endDate: params?.endDate,
    outletId: params?.outletId,
    timezone: params?.timezone,
  });
  return request<SalesAnalyticsResult>(`${BASE_PATH}/sales${qs}`, {
    method: 'GET',
    signal: signal || params?.signal,
  });
}

// 4. Customers
export async function fetchLaundryCustomers(
  params?: AnalyticsQueryParams & { dormantDays?: number },
  signal?: AbortSignal
): Promise<CustomerAnalyticsResult> {
  const qs = buildQueryString({
    preset: params?.preset,
    startDate: params?.startDate,
    endDate: params?.endDate,
    outletId: params?.outletId,
    timezone: params?.timezone,
    dormantDays: params?.dormantDays,
  });
  return request<CustomerAnalyticsResult>(`${BASE_PATH}/customers${qs}`, {
    method: 'GET',
    signal: signal || params?.signal,
  });
}

// 5. Operations
export async function fetchLaundryOperations(
  params?: AnalyticsQueryParams,
  signal?: AbortSignal
): Promise<OperationsAnalyticsResult> {
  const qs = buildQueryString({
    preset: params?.preset,
    startDate: params?.startDate,
    endDate: params?.endDate,
    outletId: params?.outletId,
    timezone: params?.timezone,
  });
  return request<OperationsAnalyticsResult>(`${BASE_PATH}/operations${qs}`, {
    method: 'GET',
    signal: signal || params?.signal,
  });
}

// 6. Employees
export async function fetchLaundryEmployees(
  params?: AnalyticsQueryParams,
  signal?: AbortSignal
): Promise<EmployeesAnalyticsResult> {
  const qs = buildQueryString({
    preset: params?.preset,
    startDate: params?.startDate,
    endDate: params?.endDate,
    outletId: params?.outletId,
    timezone: params?.timezone,
  });
  return request<EmployeesAnalyticsResult>(`${BASE_PATH}/employees${qs}`, {
    method: 'GET',
    signal: signal || params?.signal,
  });
}

// 7. Machines
export async function fetchLaundryMachines(
  params?: AnalyticsQueryParams,
  signal?: AbortSignal
): Promise<MachinesAnalyticsResult> {
  const qs = buildQueryString({
    preset: params?.preset,
    startDate: params?.startDate,
    endDate: params?.endDate,
    outletId: params?.outletId,
    timezone: params?.timezone,
  });
  return request<MachinesAnalyticsResult>(`${BASE_PATH}/machines${qs}`, {
    method: 'GET',
    signal: signal || params?.signal,
  });
}

// 8. Inventory
export async function fetchLaundryInventory(
  params?: AnalyticsQueryParams,
  signal?: AbortSignal
): Promise<InventoryAnalyticsResult> {
  const qs = buildQueryString({
    preset: params?.preset,
    startDate: params?.startDate,
    endDate: params?.endDate,
    outletId: params?.outletId,
    timezone: params?.timezone,
  });
  return request<InventoryAnalyticsResult>(`${BASE_PATH}/inventory${qs}`, {
    method: 'GET',
    signal: signal || params?.signal,
  });
}

// 9. Benchmark (Owner Only)
export async function fetchLaundryBenchmark(
  params?: AnalyticsQueryParams,
  signal?: AbortSignal
): Promise<BenchmarkAnalyticsResult> {
  const qs = buildQueryString({
    preset: params?.preset,
    startDate: params?.startDate,
    endDate: params?.endDate,
    timezone: params?.timezone,
  });
  return request<BenchmarkAnalyticsResult>(`${BASE_PATH}/benchmark${qs}`, {
    method: 'GET',
    signal: signal || params?.signal,
  });
}

// 10. Drilldown
export async function fetchLaundryDrilldown(
  params: AnalyticsQueryParams & {
    type: string;
    page?: number;
    limit?: number;
    targetDate?: string;
    stage?: string;
    paymentMethod?: string;
    dayOfWeek?: number;
    hour?: number;
    dormantDays?: number;
  },
  signal?: AbortSignal
): Promise<DrilldownResult> {
  const qs = buildQueryString({
    type: params.type,
    preset: params.preset,
    startDate: params.startDate,
    endDate: params.endDate,
    outletId: params.outletId,
    page: params.page,
    limit: params.limit,
    targetDate: params.targetDate,
    stage: params.stage,
    paymentMethod: params.paymentMethod,
    dayOfWeek: params.dayOfWeek,
    hour: params.hour,
    dormantDays: params.dormantDays,
    timezone: params.timezone,
  });
  return request<DrilldownResult>(`${BASE_PATH}/drilldown${qs}`, {
    method: 'GET',
    signal: signal || params.signal,
  });
}

// 11. AI Summary
export async function fetchLaundryAiSummary(
  params?: AnalyticsQueryParams,
  signal?: AbortSignal
): Promise<AiSummaryResult> {
  const qs = buildQueryString({
    preset: params?.preset,
    startDate: params?.startDate,
    endDate: params?.endDate,
    outletId: params?.outletId,
    timezone: params?.timezone,
  });
  return request<AiSummaryResult>(`${BASE_PATH}/ai/summary${qs}`, {
    method: 'GET',
    signal: signal || params?.signal,
  });
}

// 12. AI Forecast
export async function fetchLaundryAiForecast(
  params?: AnalyticsQueryParams,
  signal?: AbortSignal
): Promise<AiForecastResult> {
  const qs = buildQueryString({
    preset: params?.preset,
    startDate: params?.startDate,
    endDate: params?.endDate,
    outletId: params?.outletId,
    timezone: params?.timezone,
  });
  return request<AiForecastResult>(`${BASE_PATH}/ai/forecast${qs}`, {
    method: 'GET',
    signal: signal || params?.signal,
  });
}

// 13. AI Query
export async function postLaundryAiQuery(
  question: string,
  params?: AnalyticsQueryParams,
  signal?: AbortSignal
): Promise<AiQueryResult> {
  const qs = buildQueryString({
    preset: params?.preset,
    startDate: params?.startDate,
    endDate: params?.endDate,
    outletId: params?.outletId,
    timezone: params?.timezone,
  });
  return request<AiQueryResult>(`${BASE_PATH}/ai/query${qs}`, {
    method: 'POST',
    body: JSON.stringify({ question }),
    signal: signal || params?.signal,
  });
}

// =========================================================================
// WAVE 2: CRUD API FUNCTIONS (OPERATIONAL EXPENSES, TARGETS, MAINTENANCE)
// =========================================================================

// 14. Operational Expenses CRUD
export async function fetchOperationalExpenses(
  params?: {
    outletId?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  },
  signal?: AbortSignal
): Promise<OperationalExpensesResult> {
  const qs = buildQueryString(params);
  return request<OperationalExpensesResult>(`${BASE_PATH}/operational-expenses${qs}`, {
    method: 'GET',
    signal,
  });
}

export async function createOperationalExpense(
  payload: CreateOperationalExpensePayload
): Promise<OperationalExpenseItem> {
  return request<OperationalExpenseItem>(`${BASE_PATH}/operational-expenses`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateOperationalExpense(
  id: string,
  payload: UpdateOperationalExpensePayload
): Promise<OperationalExpenseItem> {
  return request<OperationalExpenseItem>(`${BASE_PATH}/operational-expenses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteOperationalExpense(
  id: string
): Promise<{ status: string; message: string }> {
  return request<{ status: string; message: string }>(`${BASE_PATH}/operational-expenses/${id}`, {
    method: 'DELETE',
  });
}

// 15. Outlet Business Targets CRUD
export async function fetchOutletTargets(
  params?: {
    outletId?: string;
    periodYear?: number;
    periodMonth?: number;
  },
  signal?: AbortSignal
): Promise<OutletBusinessTargetItem[]> {
  const qs = buildQueryString(params);
  return request<OutletBusinessTargetItem[]>(`${BASE_PATH}/targets${qs}`, {
    method: 'GET',
    signal,
  });
}

export async function upsertOutletTarget(
  payload: UpsertOutletTargetPayload
): Promise<OutletBusinessTargetItem> {
  return request<OutletBusinessTargetItem>(`${BASE_PATH}/targets`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteOutletTarget(
  id: string
): Promise<{ status: string; message: string }> {
  return request<{ status: string; message: string }>(`${BASE_PATH}/targets/${id}`, {
    method: 'DELETE',
  });
}

// 16. Machine Maintenance Logs CRUD
export async function fetchMachineMaintenanceLogs(
  params?: {
    outletId?: string;
    machineId?: string;
    status?: string;
    page?: number;
    limit?: number;
  },
  signal?: AbortSignal
): Promise<MachineMaintenanceResult> {
  const qs = buildQueryString(params);
  return request<MachineMaintenanceResult>(`${BASE_PATH}/machine-maintenance${qs}`, {
    method: 'GET',
    signal,
  });
}

export async function createMachineMaintenanceLog(
  payload: CreateMachineMaintenancePayload
): Promise<LaundryMachineMaintenanceLogItem> {
  return request<LaundryMachineMaintenanceLogItem>(`${BASE_PATH}/machine-maintenance`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateMachineMaintenanceLog(
  id: string,
  payload: UpdateMachineMaintenancePayload
): Promise<LaundryMachineMaintenanceLogItem> {
  return request<LaundryMachineMaintenanceLogItem>(`${BASE_PATH}/machine-maintenance/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteMachineMaintenanceLog(
  id: string
): Promise<{ status: string; message: string }> {
  return request<{ status: string; message: string }>(`${BASE_PATH}/machine-maintenance/${id}`, {
    method: 'DELETE',
  });
}
