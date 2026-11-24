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
