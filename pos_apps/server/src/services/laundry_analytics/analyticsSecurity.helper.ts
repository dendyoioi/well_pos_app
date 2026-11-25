/**
 * Analytics Security & Caching Helper
 * Laundry Outlet Performance Intelligence (Well POS)
 * 
 * Mengamankan akses analitik berbasis peran (OWNER, ADMIN, SUPERVISOR),
 * mengunci outlet-scoping untuk ADMIN/SUPERVISOR, menyaring field finansial
 * sensitif untuk SUPERVISOR, serta menyediakan in-memory short-TTL cache (60 detik).
 */

import { Role } from '@prisma/client';

export interface ReqUserContext {
  id?: string;
  role: Role | string;
  outletId?: string | null;
  tenantId?: string | null;
}

/**
 * Menyelesaikan outlet ID efektif untuk kueri analitik.
 * - OWNER: bebas memilih outlet tertentu atau 'ALL' (seluruh outlet). Default: 'ALL'.
 * - ADMIN: terkunci secara ketat ke reqUser.outletId. Menolak upaya melihat outlet lain atau 'ALL' (HTTP 403).
 * - SUPERVISOR: terkunci secara ketat ke reqUser.outletId.
 * - Role lain: tolak akses (HTTP 403).
 */
export function resolveEffectiveOutlet(
  reqUser: ReqUserContext,
  requestedOutletId?: string
): string | 'ALL' {
  const role = reqUser.role;

  if (role === Role.OWNER) {
    if (!requestedOutletId || requestedOutletId.trim() === '' || requestedOutletId.toUpperCase() === 'ALL') {
      return 'ALL';
    }
    return requestedOutletId.trim();
  }

  if (role === Role.ADMIN) {
    // 1. Branch-restricted Admin (outletId ADA / Non-NULL)
    if (reqUser.outletId) {
      if (
        requestedOutletId &&
        requestedOutletId.toUpperCase() === 'ALL'
      ) {
        const err: any = new Error('Akses ditolak: Admin hanya diizinkan melihat data outlet yang ditugaskan');
        err.statusCode = 403;
        throw err;
      }
      if (
        requestedOutletId &&
        requestedOutletId !== 'ALL' &&
        requestedOutletId !== reqUser.outletId
      ) {
        const err: any = new Error('Akses ditolak: Admin tidak memiliki izin mengakses data outlet lain');
        err.statusCode = 403;
        throw err;
      }
      return reqUser.outletId;
    }

    // 2. Tenant-wide Admin (outletId NULL / kosong)
    if (!requestedOutletId || requestedOutletId.trim() === '' || requestedOutletId.toUpperCase() === 'ALL') {
      return 'ALL';
    }
    return requestedOutletId.trim();
  }

  if (role === Role.SUPERVISOR) {
    // 1. Branch-restricted Supervisor (outletId ADA / Non-NULL)
    if (reqUser.outletId) {
      if (
        requestedOutletId &&
        requestedOutletId.toUpperCase() === 'ALL'
      ) {
        const err: any = new Error('Akses ditolak: Supervisor hanya diizinkan melihat data outlet yang ditugaskan');
        err.statusCode = 403;
        throw err;
      }
      if (
        requestedOutletId &&
        requestedOutletId !== 'ALL' &&
        requestedOutletId !== reqUser.outletId
      ) {
        const err: any = new Error('Akses ditolak: Supervisor tidak memiliki izin mengakses data outlet lain');
        err.statusCode = 403;
        throw err;
      }
      return reqUser.outletId;
    }

    // 2. Tenant-wide Supervisor (outletId NULL / kosong)
    if (!requestedOutletId || requestedOutletId.trim() === '' || requestedOutletId.toUpperCase() === 'ALL') {
      return 'ALL';
    }
    return requestedOutletId.trim();
  }

  const err: any = new Error(`Akses ditolak: Role '${role}' tidak diizinkan mengakses analitik bisnis`);
  err.statusCode = 403;
  throw err;
}

/**
 * Daftar key sensitif finansial yang wajib disanitasi dari payload
 * jika pengakses memiliki peran SUPERVISOR.
 */
const SENSITIVE_FINANCIAL_KEYS = new Set([
  // Phase 4 & Financial Analytics Keys
  'financialpulse',
  'pnl',
  'revenueseries',
  'cogsbreakdown',
  'opexbreakdown',
  'profitmarginscore',
  'operatingprofit',
  'grossrevenue',
  'averageordervalue',
  'revenueperemployee',
  'clv',
  'outstandingreceivables',
  'profitmargin',
  'opex',
  'netcashflow',
  'incidentexpense',
  'pettycash',
  'walletliability',
  'paymentbreakdown',
  'discounttotal',
  'refundtotal',
  'cogsbom',
  'pettycashout',
  'fixedopex',
  'recordedopex',
  'accrualordertotal',
  'directorderpayments',
  'debtrepayments',
  'walletbalancetopup',
  'quotatopupcash',
  // Standard Financial Terms
  'netrevenue',
  'grossprofit',
  'cogs',
  'expense',
  'expenses',
  'cashbalance',
  'ebitda',
  'totalexpense',
  'realcashin',
  'accrualrevenue',
  'operatingexpense',
  'cogsamount',
  'profitmarginpercent',
  'debtreceivables',
  'walletliabilities',
  'totalrevenue',
  'netprofit',
  'unpaidreceivables',
  'liabilities',
  'dailyrevenue',
  'pnlsummary',
  'incomestatement',
  'revenuekiloan',
  'revenuesatuan',
  'totalapprovedcompensation',
  'totalcompensation',
  'inventoryvaluation',
  'shrinkagevalue',
  'purchaseordervalue',
  'costperkg',
  'chemicalcostperkg',
  'packagingcostperorder',
  'grandtotal',
  'remainingamount',
  'totalspent',
  'cost',
  'maintenancecost',
  'maintenance_cost',
  'totalmaintenancecost',
  'total_maintenance_cost',
  'costpercycle',
  'cost_per_cycle',
  'targetsummary',
  'targetrevenue',
  'actualrevenue',
  'utilityopex',
  'totalmachineexpense',
]);

const SENSITIVE_ALERT_PREFIXES = [
  'PROFIT_MARGIN_',
  'GROSS_MARGIN_',
  'HIGH_RECEIVABLES_',
  'CASH_DISCREPANCY_',
];

/**
 * Membersihkan objek atau array dari field sensitif finansial untuk peran SUPERVISOR.
 * OWNER dan ADMIN menerima data utuh tanpa modifikasi.
 */
export function sanitizeAnalyticsPayloadForRole(payload: any, role: string): any {
  if (role === Role.OWNER || role === Role.ADMIN) {
    return payload;
  }

  if (role === Role.SUPERVISOR) {
    return stripFinancialFields(payload);
  }

  return payload;
}

function stripFinancialFields(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => stripFinancialFields(item));
  }

  if (typeof data === 'object' && !(data instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z]/g, '');
      if (SENSITIVE_FINANCIAL_KEYS.has(normalizedKey)) {
        // Redact key finansial sensitif
        continue;
      }

      // Filter alert finansial sensitif untuk supervisor
      if (key === 'alerts' && Array.isArray(value)) {
        cleaned[key] = value
          .filter((alert: any) => {
            const rk = alert?.ruleKey
              ? String(alert.ruleKey).toUpperCase()
              : alert?.ruleId
              ? String(alert.ruleId).toUpperCase()
              : '';
            return !SENSITIVE_ALERT_PREFIXES.some((prefix) => rk.startsWith(prefix));
          })
          .map((alert: any) => stripFinancialFields(alert));
        continue;
      }

      cleaned[key] = stripFinancialFields(value);
    }
    return cleaned;
  }

  return data;
}

/**
 * In-memory short-TTL LRU Cache (60 detik)
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class AnalyticsCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly maxEntries: number;

  constructor(maxEntries = 200) {
    this.maxEntries = maxEntries;
  }

  get<T = any>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Refresh urutan LRU
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set<T = any>(key: string, value: T, ttlMs = 60_000): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      // Evict entri tertua (first key in Map)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  clearTenant(tenantId: string): void {
    const marker = `:${tenantId}:`;
    const prefix = `${tenantId}:`;
    for (const key of this.cache.keys()) {
      if (key.includes(marker) || key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clearAll(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  buildKey(
    endpoint: string,
    tenantId: string,
    effectiveOutletId: string,
    preset: string,
    startDate = '',
    endDate = '',
    role = '',
    extraSuffix = ''
  ): string {
    const base = `${endpoint}:${tenantId}:${effectiveOutletId}:${preset}:${startDate}:${endDate}:${role}`;
    return extraSuffix ? `${base}:${extraSuffix}` : base;
  }
}

export const analyticsCache = new AnalyticsCache(200);

export * from './laundryOutletScope.helper';
