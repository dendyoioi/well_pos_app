/**
 * Laundry Analytics Controller
 * Laundry Outlet Performance Intelligence (Well POS)
 * 
 * Menangani parsing query params, validasi keamanan RBAC & outlet-scoping,
 * integrasi in-memory short-TTL cache (60 detik), serta routing ke modular analytics services.
 */

import { Request, Response } from 'express';
import {
  resolveEffectiveOutlet,
  sanitizeAnalyticsPayloadForRole,
  analyticsCache,
} from '../services/laundry_analytics/analyticsSecurity.helper';
import {
  resolveAnalyticsDateRange,
} from '../services/laundry_analytics/dateRangeResolver.service';
import {
  getFinancialAnalytics,
} from '../services/laundry_analytics/laundryAnalyticsFinancial.service';
import {
  getExecutiveOverview,
} from '../services/laundry_analytics/laundryAnalyticsOverview.service';
import {
  getSalesAnalytics,
} from '../services/laundry_analytics/laundryAnalyticsSales.service';
import {
  getCustomerAnalytics,
} from '../services/laundry_analytics/laundryAnalyticsCustomer.service';
import {
  getOperationsAnalytics,
} from '../services/laundry_analytics/laundryAnalyticsOperations.service';
import {
  getEmployeesAnalytics,
} from '../services/laundry_analytics/laundryAnalyticsEmployees.service';
import {
  getMachinesAnalytics,
} from '../services/laundry_analytics/laundryAnalyticsMachines.service';
import {
  getInventoryAnalytics,
} from '../services/laundry_analytics/laundryAnalyticsInventory.service';
import {
  getBenchmarkAnalytics,
} from '../services/laundry_analytics/laundryAnalyticsBenchmark.service';
import {
  getDrilldownAnalytics,
} from '../services/laundry_analytics/laundryAnalyticsDrilldown.service';
import {
  getAiSummary as getAiSummaryService,
  getAiForecast as getAiForecastService,
  postAiQuery as postAiQueryService,
} from '../services/laundry_analytics/laundryAnalyticsAi.service';

/**
 * Diagnostic Meta Endpoint (Batch 1 Core Verification)
 * GET /api/laundry/analytics/meta
 */
export const getMeta = async (req: Request, res: Response) => {
  try {
    const reqUser = req.user!;
    const requestedOutletId = req.query.outletId as string | undefined;
    const effectiveOutletId = resolveEffectiveOutlet(reqUser, requestedOutletId);

    const preset = req.query.preset as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const timezone = (req.query.timezone as string) || 'Asia/Jakarta';

    const dateRange = resolveAnalyticsDateRange({ preset, startDate, endDate, timezone });

    const payload = {
      router: 'laundry_analytics',
      version: '1.0.0',
      tenantId: reqUser.tenantId || req.tenantId || null,
      user: {
        id: reqUser.id,
        role: reqUser.role,
        assignedOutletId: reqUser.outletId,
      },
      effectiveOutletId,
      dateRange,
      cached: false,
    };

    const sanitizedData = sanitizeAnalyticsPayloadForRole(payload, reqUser.role);

    return res.status(200).json({
      status: 'success',
      data: sanitizedData,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'Gagal memproses metadata analitik laundry',
    });
  }
};

/**
 * Executive Overview Endpoint (L1 Pulse, Health Score, Alerts)
 * GET /api/laundry/analytics/overview
 */
export const getOverview = async (req: Request, res: Response) => {
  try {
    const reqUser = req.user!;
    const tenantId = reqUser.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(403).json({ status: 'error', message: 'Tenant ID tidak ditemukan pada sesi pengguna' });
    }

    const requestedOutletId = req.query.outletId as string | undefined;
    const effectiveOutletId = resolveEffectiveOutlet(reqUser, requestedOutletId);

    const preset = req.query.preset as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const timezone = (req.query.timezone as string) || 'Asia/Jakarta';

    const dateRange = resolveAnalyticsDateRange({ preset, startDate, endDate, timezone });

    // Cache lookup dengan buildKey terisolasi per endpoint
    const cacheKey = analyticsCache.buildKey(
      'overview',
      tenantId,
      effectiveOutletId,
      dateRange.preset,
      dateRange.formattedRange.start,
      dateRange.formattedRange.end,
      reqUser.role
    );

    const cachedData = analyticsCache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        status: 'success',
        data: cachedData,
        cached: true,
      });
    }

    const overviewData = await getExecutiveOverview({
      tenantId,
      outletId: effectiveOutletId,
      dateRange,
      timezone,
    });

    // Sanitasi data: SUPERVISOR tidak menerima data finansial sensitif
    const sanitizedData = sanitizeAnalyticsPayloadForRole(overviewData, reqUser.role);

    analyticsCache.set(cacheKey, sanitizedData, 60_000);

    return res.status(200).json({
      status: 'success',
      data: sanitizedData,
      cached: false,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'Gagal memproses ringkasan eksekutif laundry',
    });
  }
};

/**
 * Financial Analytics Endpoint (Accrual vs Real Cash In, BoM, PnL)
 * GET /api/laundry/analytics/financial
 */
export const getFinancial = async (req: Request, res: Response) => {
  try {
    const reqUser = req.user!;
    const tenantId = reqUser.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(403).json({ status: 'error', message: 'Tenant ID tidak ditemukan pada sesi pengguna' });
    }

    const requestedOutletId = req.query.outletId as string | undefined;
    const effectiveOutletId = resolveEffectiveOutlet(reqUser, requestedOutletId);

    const preset = req.query.preset as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const timezone = (req.query.timezone as string) || 'Asia/Jakarta';

    const dateRange = resolveAnalyticsDateRange({ preset, startDate, endDate, timezone });

    // Cache lookup dengan buildKey terisolasi per endpoint
    const cacheKey = analyticsCache.buildKey(
      'financial',
      tenantId,
      effectiveOutletId,
      dateRange.preset,
      dateRange.formattedRange.start,
      dateRange.formattedRange.end,
      reqUser.role
    );

    const cachedData = analyticsCache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        status: 'success',
        data: cachedData,
        cached: true,
      });
    }

    const financialData = await getFinancialAnalytics({
      tenantId,
      outletId: effectiveOutletId,
      dateRange,
      timezone,
    });

    const sanitizedData = sanitizeAnalyticsPayloadForRole(financialData, reqUser.role);

    analyticsCache.set(cacheKey, sanitizedData, 60_000);

    return res.status(200).json({
      status: 'success',
      data: sanitizedData,
      cached: false,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'Gagal memproses data analitik finansial',
    });
  }
};


/**
 * Sales Analytics Endpoint (Kiloan vs Satuan, Top 10 Services, Cashier, Heatmap, Perfumes, Addons)
 * GET /api/laundry/analytics/sales
 */
export const getSales = async (req: Request, res: Response) => {
  try {
    const reqUser = req.user!;
    const tenantId = reqUser.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(403).json({ status: 'error', message: 'Tenant ID tidak ditemukan pada sesi pengguna' });
    }

    const requestedOutletId = req.query.outletId as string | undefined;
    const effectiveOutletId = resolveEffectiveOutlet(reqUser, requestedOutletId);

    const preset = req.query.preset as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const timezone = (req.query.timezone as string) || 'Asia/Jakarta';

    const dateRange = resolveAnalyticsDateRange({ preset, startDate, endDate, timezone });

    const cacheKey = analyticsCache.buildKey(
      'sales',
      tenantId,
      effectiveOutletId,
      dateRange.preset,
      dateRange.formattedRange.start,
      dateRange.formattedRange.end,
      reqUser.role
    );

    const cachedData = analyticsCache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        status: 'success',
        data: cachedData,
        cached: true,
      });
    }

    const salesData = await getSalesAnalytics({
      tenantId,
      outletId: effectiveOutletId,
      dateRange,
      timezone,
    });

    const sanitizedData = sanitizeAnalyticsPayloadForRole(salesData, reqUser.role);
    analyticsCache.set(cacheKey, sanitizedData, 60_000);

    return res.status(200).json({
      status: 'success',
      data: sanitizedData,
      cached: false,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'Gagal memproses data analitik penjualan laundry',
    });
  }
};

/**
 * Customer Analytics Endpoint (Retention, Segments, Dormant List, Win-Back, Feedback, Breakage)
 * GET /api/laundry/analytics/customers
 */
export const getCustomers = async (req: Request, res: Response) => {
  try {
    const reqUser = req.user!;
    const tenantId = reqUser.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(403).json({ status: 'error', message: 'Tenant ID tidak ditemukan pada sesi pengguna' });
    }

    const requestedOutletId = req.query.outletId as string | undefined;
    const effectiveOutletId = resolveEffectiveOutlet(reqUser, requestedOutletId);

    const preset = req.query.preset as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const timezone = (req.query.timezone as string) || 'Asia/Jakarta';

    const rawDormant = req.query.dormantDays ? Number(req.query.dormantDays) : 30;
    const dormantDays = Number.isFinite(rawDormant) && rawDormant >= 7 && rawDormant <= 365 ? Math.floor(rawDormant) : 30;

    const dateRange = resolveAnalyticsDateRange({ preset, startDate, endDate, timezone });

    const cacheKey = analyticsCache.buildKey(
      'customers',
      tenantId,
      effectiveOutletId,
      dateRange.preset,
      dateRange.formattedRange.start,
      dateRange.formattedRange.end,
      reqUser.role,
      `d=${dormantDays}`
    );

    const cachedData = analyticsCache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        status: 'success',
        data: cachedData,
        cached: true,
      });
    }

    const customerData = await getCustomerAnalytics({
      tenantId,
      outletId: effectiveOutletId,
      dateRange,
      timezone,
      dormantDays,
    });

    const sanitizedData = sanitizeAnalyticsPayloadForRole(customerData, reqUser.role);
    analyticsCache.set(cacheKey, sanitizedData, 60_000);

    return res.status(200).json({
      status: 'success',
      data: sanitizedData,
      cached: false,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'Gagal memproses data analitik pelanggan laundry',
    });
  }
};

/**
 * Operations Analytics Endpoint (11 Stages, Bottlenecks, Incidents, Workshop Lag)
 * GET /api/laundry/analytics/operations
 */
export const getOperations = async (req: Request, res: Response) => {
  try {
    const reqUser = req.user!;
    const tenantId = reqUser.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(403).json({ status: 'error', message: 'Tenant ID tidak ditemukan pada sesi pengguna' });
    }

    const requestedOutletId = req.query.outletId as string | undefined;
    const effectiveOutletId = resolveEffectiveOutlet(reqUser, requestedOutletId);

    const preset = req.query.preset as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const timezone = (req.query.timezone as string) || 'Asia/Jakarta';

    const dateRange = resolveAnalyticsDateRange({ preset, startDate, endDate, timezone });

    const cacheKey = analyticsCache.buildKey(
      'operations',
      tenantId,
      effectiveOutletId,
      dateRange.preset,
      dateRange.formattedRange.start,
      dateRange.formattedRange.end,
      reqUser.role
    );

    const cachedData = analyticsCache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        status: 'success',
        data: cachedData,
        cached: true,
      });
    }

    const operationsData = await getOperationsAnalytics({
      tenantId,
      outletId: effectiveOutletId,
      dateRange,
      timezone,
    });

    const sanitizedData = sanitizeAnalyticsPayloadForRole(operationsData, reqUser.role);
    analyticsCache.set(cacheKey, sanitizedData, 60_000);

    return res.status(200).json({
      status: 'success',
      data: sanitizedData,
      cached: false,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'Gagal memproses data analitik operasional laundry',
    });
  }
};

/**
 * Employees Analytics Endpoint (Attendance, Leaderboard 4 Pilar, Shift Summary)
 * GET /api/laundry/analytics/employees
 */
export const getEmployees = async (req: Request, res: Response) => {
  try {
    const reqUser = req.user!;
    const tenantId = reqUser.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(403).json({ status: 'error', message: 'Tenant ID tidak ditemukan pada sesi pengguna' });
    }

    const requestedOutletId = req.query.outletId as string | undefined;
    const effectiveOutletId = resolveEffectiveOutlet(reqUser, requestedOutletId);

    const preset = req.query.preset as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const timezone = (req.query.timezone as string) || 'Asia/Jakarta';

    const dateRange = resolveAnalyticsDateRange({ preset, startDate, endDate, timezone });

    const cacheKey = analyticsCache.buildKey(
      'employees',
      tenantId,
      effectiveOutletId,
      dateRange.preset,
      dateRange.formattedRange.start,
      dateRange.formattedRange.end,
      reqUser.role
    );

    const cachedData = analyticsCache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        status: 'success',
        data: cachedData,
        cached: true,
      });
    }

    const employeesData = await getEmployeesAnalytics({
      tenantId,
      outletId: effectiveOutletId,
      dateRange,
      timezone,
    });

    const sanitizedData = sanitizeAnalyticsPayloadForRole(employeesData, reqUser.role);
    analyticsCache.set(cacheKey, sanitizedData, 60_000);

    return res.status(200).json({
      status: 'success',
      data: sanitizedData,
      cached: false,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'Gagal memproses data analitik staf dan kehadiran laundry',
    });
  }
};

/**
 * Machines Analytics Endpoint (Utilization, Cycles, Hours, Non-IoT Metadata)
 * GET /api/laundry/analytics/machines
 */
export const getMachines = async (req: Request, res: Response) => {
  try {
    const reqUser = req.user!;
    const tenantId = reqUser.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(403).json({ status: 'error', message: 'Tenant ID tidak ditemukan pada sesi pengguna' });
    }

    const requestedOutletId = req.query.outletId as string | undefined;
    const effectiveOutletId = resolveEffectiveOutlet(reqUser, requestedOutletId);

    const preset = req.query.preset as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const timezone = (req.query.timezone as string) || 'Asia/Jakarta';

    const dateRange = resolveAnalyticsDateRange({ preset, startDate, endDate, timezone });

    const cacheKey = analyticsCache.buildKey(
      'machines',
      tenantId,
      effectiveOutletId,
      dateRange.preset,
      dateRange.formattedRange.start,
      dateRange.formattedRange.end,
      reqUser.role
    );

    const cachedData = analyticsCache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        status: 'success',
        data: cachedData,
        cached: true,
      });
    }

    const machinesData = await getMachinesAnalytics({
      tenantId,
      outletId: effectiveOutletId,
      dateRange,
      timezone,
    });

    const sanitizedData = sanitizeAnalyticsPayloadForRole(machinesData, reqUser.role);
    analyticsCache.set(cacheKey, sanitizedData, 60_000);

    return res.status(200).json({
      status: 'success',
      data: sanitizedData,
      cached: false,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'Gagal memproses data analitik mesin laundry',
    });
  }
};

/**
 * Inventory Analytics Endpoint (Valuation, Chemical Cost/Kg, Low Stock, Shrinkage, POs)
 * GET /api/laundry/analytics/inventory
 */
export const getInventory = async (req: Request, res: Response) => {
  try {
    const reqUser = req.user!;
    const tenantId = reqUser.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(403).json({ status: 'error', message: 'Tenant ID tidak ditemukan pada sesi pengguna' });
    }

    const requestedOutletId = req.query.outletId as string | undefined;
    const effectiveOutletId = resolveEffectiveOutlet(reqUser, requestedOutletId);

    const preset = req.query.preset as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const timezone = (req.query.timezone as string) || 'Asia/Jakarta';

    const dateRange = resolveAnalyticsDateRange({ preset, startDate, endDate, timezone });

    const cacheKey = analyticsCache.buildKey(
      'inventory',
      tenantId,
      effectiveOutletId,
      dateRange.preset,
      dateRange.formattedRange.start,
      dateRange.formattedRange.end,
      reqUser.role
    );

    const cachedData = analyticsCache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        status: 'success',
        data: cachedData,
        cached: true,
      });
    }

    const inventoryData = await getInventoryAnalytics({
      tenantId,
      outletId: effectiveOutletId,
      dateRange,
      timezone,
    });

    const sanitizedData = sanitizeAnalyticsPayloadForRole(inventoryData, reqUser.role);
    analyticsCache.set(cacheKey, sanitizedData, 60_000);

    return res.status(200).json({
      status: 'success',
      data: sanitizedData,
      cached: false,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'Gagal memproses data analitik persediaan laundry',
    });
  }
};

/**
 * Multi-Outlet Benchmark Endpoint (Komparasi Lintas Cabang - Khusus OWNER)
 * GET /api/laundry/analytics/benchmark
 */
export const getBenchmark = async (req: Request, res: Response) => {
  try {
    const reqUser = req.user!;
    const tenantId = reqUser.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(403).json({ status: 'error', message: 'Tenant ID tidak ditemukan pada sesi pengguna' });
    }

    const preset = req.query.preset as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const timezone = (req.query.timezone as string) || 'Asia/Jakarta';

    const dateRange = resolveAnalyticsDateRange({ preset, startDate, endDate, timezone });

    const cacheKey = analyticsCache.buildKey(
      'benchmark',
      tenantId,
      'ALL',
      dateRange.preset,
      dateRange.formattedRange.start,
      dateRange.formattedRange.end,
      reqUser.role
    );

    const cachedData = analyticsCache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        status: 'success',
        data: cachedData,
        cached: true,
      });
    }

    const benchmarkData = await getBenchmarkAnalytics({
      tenantId,
      outletId: 'ALL',
      dateRange,
      timezone,
    });

    const sanitizedData = sanitizeAnalyticsPayloadForRole(benchmarkData, reqUser.role);
    analyticsCache.set(cacheKey, sanitizedData, 60_000);

    return res.status(200).json({
      status: 'success',
      data: sanitizedData,
      cached: false,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'Gagal memproses data benchmark multi-cabang',
    });
  }
};

/**
 * Parameterized Drill-Down Inspection Endpoint
 * GET /api/laundry/analytics/drilldown
 */
export const getDrilldown = async (req: Request, res: Response) => {
  try {
    const reqUser = req.user!;
    const tenantId = reqUser.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(403).json({ status: 'error', message: 'Tenant ID tidak ditemukan pada sesi pengguna' });
    }

    const requestedOutletId = req.query.outletId as string | undefined;
    const effectiveOutletId = resolveEffectiveOutlet(reqUser, requestedOutletId);

    const type = req.query.type as string;
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const targetDate = req.query.targetDate as string | undefined;
    const stage = req.query.stage as string | undefined;
    const paymentMethod = req.query.paymentMethod as string | undefined;
    const dayOfWeek = req.query.dayOfWeek !== undefined && req.query.dayOfWeek !== '' ? Number(req.query.dayOfWeek) : undefined;
    const hour = req.query.hour !== undefined && req.query.hour !== '' ? Number(req.query.hour) : undefined;
    const dormantDays = req.query.dormantDays !== undefined && req.query.dormantDays !== '' ? Number(req.query.dormantDays) : undefined;

    const preset = req.query.preset as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const timezone = (req.query.timezone as string) || 'Asia/Jakarta';

    const dateRange = resolveAnalyticsDateRange({ preset, startDate, endDate, timezone });

    const extraSuffix = `t=${type}:p=${page}:l=${limit}:td=${targetDate || ''}:st=${stage || ''}:pm=${paymentMethod || ''}:dow=${dayOfWeek ?? ''}:hr=${hour ?? ''}:d=${dormantDays ?? ''}`;

    const cacheKey = analyticsCache.buildKey(
      'drilldown',
      tenantId,
      effectiveOutletId,
      dateRange.preset,
      dateRange.formattedRange.start,
      dateRange.formattedRange.end,
      reqUser.role,
      extraSuffix
    );

    const cachedData = analyticsCache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        status: 'success',
        data: cachedData,
        cached: true,
      });
    }

    const drilldownData = await getDrilldownAnalytics({
      tenantId,
      outletId: effectiveOutletId,
      dateRange,
      timezone,
      type,
      role: reqUser.role,
      page,
      limit,
      targetDate,
      stage,
      paymentMethod,
      dayOfWeek,
      hour,
      dormantDays,
    });

    const sanitizedData = sanitizeAnalyticsPayloadForRole(drilldownData, reqUser.role);
    analyticsCache.set(cacheKey, sanitizedData, 60_000);

    return res.status(200).json({
      status: 'success',
      data: sanitizedData,
      cached: false,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'Gagal memproses data drill-down inspeksi',
    });
  }
};

/**
 * AI Summary Endpoint (Descriptive narrative, Diagnostics, Prescriptions, Anomalies)
 * GET /api/laundry/analytics/ai/summary
 */
export const getAiSummary = async (req: Request, res: Response) => {
  try {
    const reqUser = req.user!;
    const tenantId = reqUser.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(403).json({ status: 'error', message: 'Tenant ID tidak ditemukan pada sesi pengguna' });
    }

    const requestedOutletId = req.query.outletId as string | undefined;
    const effectiveOutletId = resolveEffectiveOutlet(reqUser, requestedOutletId);

    const preset = req.query.preset as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const timezone = (req.query.timezone as string) || 'Asia/Jakarta';

    const dateRange = resolveAnalyticsDateRange({ preset, startDate, endDate, timezone });

    const cacheKey = analyticsCache.buildKey(
      'ai_summary',
      tenantId,
      effectiveOutletId,
      dateRange.preset,
      dateRange.formattedRange.start,
      dateRange.formattedRange.end,
      reqUser.role
    );

    const cachedData = analyticsCache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        status: 'success',
        data: cachedData,
        cached: true,
      });
    }

    const aiSummaryData = await getAiSummaryService({
      tenantId,
      outletId: effectiveOutletId,
      dateRange,
      timezone,
    });

    const sanitizedData = sanitizeAnalyticsPayloadForRole(aiSummaryData, reqUser.role);
    analyticsCache.set(cacheKey, sanitizedData, 60_000);

    return res.status(200).json({
      status: 'success',
      data: sanitizedData,
      cached: false,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'Gagal memproses ringkasan cerdas AI laundry',
    });
  }
};

/**
 * AI Forecast Endpoint (Month-to-Date + 7-Day Linear Moving Average Projection)
 * GET /api/laundry/analytics/ai/forecast
 */
export const getAiForecast = async (req: Request, res: Response) => {
  try {
    const reqUser = req.user!;
    const tenantId = reqUser.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(403).json({ status: 'error', message: 'Tenant ID tidak ditemukan pada sesi pengguna' });
    }

    const requestedOutletId = req.query.outletId as string | undefined;
    const effectiveOutletId = resolveEffectiveOutlet(reqUser, requestedOutletId);

    const preset = req.query.preset as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const timezone = (req.query.timezone as string) || 'Asia/Jakarta';

    const dateRange = resolveAnalyticsDateRange({ preset, startDate, endDate, timezone });

    const cacheKey = analyticsCache.buildKey(
      'ai_forecast',
      tenantId,
      effectiveOutletId,
      dateRange.preset,
      dateRange.formattedRange.start,
      dateRange.formattedRange.end,
      reqUser.role
    );

    const cachedData = analyticsCache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        status: 'success',
        data: cachedData,
        cached: true,
      });
    }

    const aiForecastData = await getAiForecastService({
      tenantId,
      outletId: effectiveOutletId,
      dateRange,
      timezone,
    });

    const sanitizedData = sanitizeAnalyticsPayloadForRole(aiForecastData, reqUser.role);
    analyticsCache.set(cacheKey, sanitizedData, 60_000);

    return res.status(200).json({
      status: 'success',
      data: sanitizedData,
      cached: false,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'Gagal memproses proyeksi cerdas AI laundry',
    });
  }
};

/**
 * AI Query Endpoint (Natural Language Question Parser & Metric Answerer)
 * POST /api/laundry/analytics/ai/query
 */
export const postAiQuery = async (req: Request, res: Response) => {
  try {
    const reqUser = req.user!;
    const tenantId = reqUser.tenantId || req.tenantId;
    if (!tenantId) {
      return res.status(403).json({ status: 'error', message: 'Tenant ID tidak ditemukan pada sesi pengguna' });
    }

    const requestedOutletId = (req.body?.outletId || req.query.outletId) as string | undefined;
    const effectiveOutletId = resolveEffectiveOutlet(reqUser, requestedOutletId);

    const question = req.body?.question as string;

    const preset = (req.body?.preset || req.query.preset) as string | undefined;
    const startDate = (req.body?.startDate || req.query.startDate) as string | undefined;
    const endDate = (req.body?.endDate || req.query.endDate) as string | undefined;
    const timezone = ((req.body?.timezone || req.query.timezone) as string) || 'Asia/Jakarta';

    const dateRange = resolveAnalyticsDateRange({ preset, startDate, endDate, timezone });

    const aiQueryResult = await postAiQueryService(
      {
        tenantId,
        outletId: effectiveOutletId,
        dateRange,
        timezone,
      },
      question
    );

    const sanitizedData = sanitizeAnalyticsPayloadForRole(aiQueryResult, reqUser.role);

    return res.status(200).json({
      status: 'success',
      data: sanitizedData,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      status: 'error',
      message: error.message || 'Gagal memproses pertanyaan cerdas AI laundry',
    });
  }
};
