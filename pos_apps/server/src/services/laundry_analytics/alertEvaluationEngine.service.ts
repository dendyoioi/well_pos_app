/**
 * Laundry Alert Evaluation Engine Service
 * Laundry Outlet Performance Intelligence (Well POS)
 * 
 * Bertanggung jawab mengevaluasi 10 aturan peringatan dini kanonikal (finansial & operasional),
 * menerapkan deduplikasi cerdas (mencegah duplikasi alert OPEN/IN_PROGRESS),
 * dan memicu notifikasi WhatsApp Owner untuk anomali berkategori CRITICAL.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { whatsAppService } from '../whatsapp.service';
import {
  resolveAnalyticsDateRange,
  AnalyticsDatePreset,
} from './dateRangeResolver.service';
import { getExecutiveOverview } from './laundryAnalyticsOverview.service';
import { getFinancialAnalytics } from './laundryAnalyticsFinancial.service';
import { getOperationsAnalytics } from './laundryAnalyticsOperations.service';
import { getMachinesAnalytics } from './laundryAnalyticsMachines.service';
import { getCustomerAnalytics } from './laundryAnalyticsCustomer.service';
import { getInventoryAnalytics } from './laundryAnalyticsInventory.service';

export interface AlertRuleDefinition {
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

export const FINANCIAL_ALERT_RULE_KEYS = [
  'PROFIT_MARGIN',
  'HIGH_RECEIVABLES',
  'CASH_DISCREPANCY',
] as const;

export const DEFAULT_ALERT_RULES: AlertRuleDefinition[] = [
  {
    ruleKey: 'PROFIT_MARGIN',
    label: 'Margin Laba Bersih Operasional',
    unit: '%',
    operator: 'LT',
    isFinancial: true,
    warningThreshold: 40,
    criticalThreshold: 25,
    isEnabled: true,
    notificationChannels: ['IN_APP'],
  },
  {
    ruleKey: 'SLA_ON_TIME',
    label: 'Ketepatan Waktu SLA Selesai',
    unit: '%',
    operator: 'LT',
    isFinancial: false,
    warningThreshold: 90,
    criticalThreshold: 80,
    isEnabled: true,
    notificationChannels: ['IN_APP'],
  },
  {
    ruleKey: 'REWASH_RATE',
    label: 'Tingkat Cuci Ulang (Rewash)',
    unit: '%',
    operator: 'GT',
    isFinancial: false,
    warningThreshold: 3,
    criticalThreshold: 5,
    isEnabled: true,
    notificationChannels: ['IN_APP'],
  },
  {
    ruleKey: 'INCIDENT_RATE',
    label: 'Tingkat Insiden (Luntur/Rusak/Hilang)',
    unit: '%',
    operator: 'GT',
    isFinancial: false,
    warningThreshold: 1,
    criticalThreshold: 2,
    isEnabled: true,
    notificationChannels: ['IN_APP'],
  },
  {
    ruleKey: 'MACHINE_UTILIZATION',
    label: 'Utilisasi Mesin Cuci/Kering',
    unit: '%',
    operator: 'GT',
    isFinancial: false,
    warningThreshold: 85,
    criticalThreshold: 95,
    isEnabled: true,
    notificationChannels: ['IN_APP'],
  },
  {
    ruleKey: 'CUSTOMER_RATING',
    label: 'Rating Kepuasan Pelanggan',
    unit: 'Bintang',
    operator: 'LT',
    isFinancial: false,
    warningThreshold: 4.5,
    criticalThreshold: 4.0,
    isEnabled: true,
    notificationChannels: ['IN_APP'],
  },
  {
    ruleKey: 'DORMANT_SURGE',
    label: 'Lonjakan Pelanggan Tidak Aktif (Dormant)',
    unit: '%',
    operator: 'GT',
    isFinancial: false,
    warningThreshold: 20,
    criticalThreshold: 35,
    isEnabled: true,
    notificationChannels: ['IN_APP'],
  },
  {
    ruleKey: 'LOW_STOCK',
    label: 'Bahan Baku Menipis / Kritis',
    unit: 'Item',
    operator: 'GTE',
    isFinancial: false,
    warningThreshold: 1,
    criticalThreshold: 5,
    isEnabled: true,
    notificationChannels: ['IN_APP'],
  },
  {
    ruleKey: 'HIGH_RECEIVABLES',
    label: 'Rasio Piutang Belum Lunas terhadap Omset',
    unit: '%',
    operator: 'GT',
    isFinancial: true,
    warningThreshold: 15,
    criticalThreshold: 25,
    isEnabled: true,
    notificationChannels: ['IN_APP'],
  },
  {
    ruleKey: 'CASH_DISCREPANCY',
    label: 'Total Selisih Kas Tutup Shift',
    unit: 'Rp',
    operator: 'GT',
    isFinancial: true,
    warningThreshold: 50000,
    criticalThreshold: 200000,
    isEnabled: true,
    notificationChannels: ['IN_APP'],
  },
];

export interface EffectiveAlertRule extends AlertRuleDefinition {
  id?: string;
  tenantId?: string;
  outletId?: string | null;
}

/**
 * Mengambil daftar 10 aturan peringatan efektif dengan hierarki prioritas:
 * 1. Aturan spesifik outlet (outlet_id = targetOutletId)
 * 2. Aturan global tenant (outlet_id IS NULL)
 * 3. Default sistem kanonikal (DEFAULT_ALERT_RULES)
 */
export async function getEffectiveAlertRules(
  tenantId: string,
  outletId?: string | null
): Promise<EffectiveAlertRule[]> {
  const customConfigs = await prisma.alertRuleConfig.findMany({
    where: {
      tenantId,
      OR: [
        { outletId: null },
        ...(outletId && outletId !== 'ALL' ? [{ outletId }] : []),
      ],
    },
  });

  return DEFAULT_ALERT_RULES.map((def) => {
    // 1. Cek global tenant config (outletId === null)
    const globalCfg = customConfigs.find(
      (c) => c.ruleKey === def.ruleKey && c.outletId === null
    );

    // 2. Cek outlet specific config (outletId === targetOutletId)
    const outletCfg =
      outletId && outletId !== 'ALL'
        ? customConfigs.find(
            (c) => c.ruleKey === def.ruleKey && c.outletId === outletId
          )
        : null;

    const activeCfg = outletCfg || globalCfg;

    if (!activeCfg) {
      return {
        ...def,
        tenantId,
        outletId: outletId && outletId !== 'ALL' ? outletId : null,
      };
    }

    const channels = Array.isArray(activeCfg.notificationChannels)
      ? (activeCfg.notificationChannels as string[])
      : ['IN_APP'];

    return {
      ...def,
      id: activeCfg.id,
      tenantId: activeCfg.tenantId,
      outletId: activeCfg.outletId,
      warningThreshold: Number(activeCfg.warningThreshold),
      criticalThreshold: Number(activeCfg.criticalThreshold),
      isEnabled: activeCfg.isEnabled,
      notificationChannels: channels,
    };
  });
}

function checkViolation(
  metricValue: number,
  operator: 'LT' | 'GT' | 'GTE',
  warningThreshold: number,
  criticalThreshold: number
): { isViolated: boolean; severity: 'WARNING' | 'CRITICAL'; threshold: number } | null {
  if (operator === 'LT') {
    if (metricValue < criticalThreshold) {
      return { isViolated: true, severity: 'CRITICAL', threshold: criticalThreshold };
    }
    if (metricValue < warningThreshold) {
      return { isViolated: true, severity: 'WARNING', threshold: warningThreshold };
    }
  } else if (operator === 'GT') {
    if (metricValue > criticalThreshold) {
      return { isViolated: true, severity: 'CRITICAL', threshold: criticalThreshold };
    }
    if (metricValue > warningThreshold) {
      return { isViolated: true, severity: 'WARNING', threshold: warningThreshold };
    }
  } else if (operator === 'GTE') {
    if (metricValue >= criticalThreshold) {
      return { isViolated: true, severity: 'CRITICAL', threshold: criticalThreshold };
    }
    if (metricValue >= warningThreshold) {
      return { isViolated: true, severity: 'WARNING', threshold: warningThreshold };
    }
  }
  return null;
}

export interface EvaluateOutletAlertsParams {
  tenantId: string;
  outletId: string;
  preset?: AnalyticsDatePreset;
  triggerWa?: boolean;
}

export interface EvaluateOutletAlertsResult {
  evaluatedRulesCount: number;
  createdCount: number;
  updatedCount: number;
  waSentCount: number;
  alerts: any[];
}

/**
 * Mengevaluasi seluruh metrik operasional & finansial aktual pada outlet tertentu,
 * membandingkannya terhadap ambang batas, menduplikasi alert secara aman,
 * dan memicu pesan WhatsApp ke Owner jika terdeteksi kondisi CRITICAL.
 */
export async function evaluateOutletAlerts(
  params: EvaluateOutletAlertsParams
): Promise<EvaluateOutletAlertsResult> {
  const { tenantId, outletId, preset = 'month', triggerWa = true } = params;

  if (!outletId || outletId === 'ALL') {
    throw new Error('Evaluasi alert wajib menargetkan outletId spesifik (bukan ALL)');
  }

  const outlet = await prisma.outlet.findFirst({
    where: { id: outletId, tenantId },
    select: { id: true, name: true, phone: true },
  });

  if (!outlet) {
    throw new Error(`Outlet dengan ID ${outletId} tidak ditemukan pada tenant ini`);
  }

  const dateRange = resolveAnalyticsDateRange({ preset });
  const effectiveRules = await getEffectiveAlertRules(tenantId, outletId);

  // Ambil seluruh data metrik aktual secara paralel
  const [
    overview,
    financial,
    operations,
    machines,
    customer,
    inventory,
    shiftDiscrepancyRaw,
  ] = await Promise.all([
    getExecutiveOverview({ tenantId, outletId, dateRange }),
    getFinancialAnalytics({ tenantId, outletId, dateRange }),
    getOperationsAnalytics({ tenantId, outletId, dateRange }),
    getMachinesAnalytics({ tenantId, outletId, dateRange }),
    getCustomerAnalytics({ tenantId, outletId, dateRange }),
    getInventoryAnalytics({ tenantId, outletId, dateRange }),
    prisma.$queryRaw<Array<{ total_discrepancy: number | string | null; shift_count: number | string | null }>>`
      SELECT 
        COALESCE(SUM(ABS(COALESCE(difference, 0))), 0) AS total_discrepancy,
        COUNT(*) AS shift_count
      FROM shifts
      WHERE tenant_id = ${tenantId}
        AND outlet_id = ${outletId}
        AND status = 'CLOSED'
        AND start_time >= ${dateRange.startDate}
        AND start_time <= ${dateRange.endDate}
    `,
  ]);

  const cashDiscrepancy = Number(shiftDiscrepancyRaw[0]?.total_discrepancy || 0);
  const closedShiftCount = Number(shiftDiscrepancyRaw[0]?.shift_count || 0);

  let evaluatedRulesCount = 0;
  let createdCount = 0;
  let updatedCount = 0;
  let waSentCount = 0;
  const persistedAlerts: any[] = [];

  for (const rule of effectiveRules) {
    if (!rule.isEnabled) {
      continue;
    }

    let metricValue: number | null = null;
    let isApplicable = true;
    let defaultTitle = '';
    let defaultMessage = '';

    switch (rule.ruleKey) {
      case 'PROFIT_MARGIN': {
        const totalOrders = overview.operationalPulse.totalValidOrders || 0;
        if (totalOrders === 0) {
          isApplicable = false;
        } else {
          metricValue = overview.financialPulse.profitMarginPercent.current || 0;
          defaultTitle = 'Margin Laba Bersih di Bawah Target';
          defaultMessage = `Margin laba bersih operasional berada di angka ${metricValue.toFixed(1)}%`;
        }
        break;
      }
      case 'SLA_ON_TIME': {
        const dueOrders = operations.summary.dueOrdersCount || 0;
        if (dueOrders === 0) {
          isApplicable = false;
        } else {
          metricValue = operations.summary.onTimeCompletionRate || 0;
          defaultTitle = 'Ketepatan Waktu SLA Menurun';
          defaultMessage = `Tingkat ketepatan waktu pengerjaan cucian sebesar ${metricValue.toFixed(1)}%`;
        }
        break;
      }
      case 'REWASH_RATE': {
        const totalProcessed = operations.summary.totalOrdersProcessed || 0;
        if (totalProcessed === 0) {
          isApplicable = false;
        } else {
          metricValue = operations.summary.rewashRate || 0;
          defaultTitle = 'Tingkat Cuci Ulang (Rewash) Tinggi';
          defaultMessage = `Persentase cuci ulang cucian mencapai ${metricValue.toFixed(1)}%`;
        }
        break;
      }
      case 'INCIDENT_RATE': {
        const totalProcessed = operations.summary.totalOrdersProcessed || 0;
        if (totalProcessed === 0) {
          isApplicable = false;
        } else {
          metricValue = operations.incidents.incidentRate || 0;
          defaultTitle = 'Tingkat Insiden Operasional Meningkat';
          defaultMessage = `Rasio komplain dan insiden cucian mencapai ${metricValue.toFixed(1)}%`;
        }
        break;
      }
      case 'MACHINE_UTILIZATION': {
        const totalMachines = machines.summary.totalMachines || 0;
        if (totalMachines === 0) {
          isApplicable = false;
        } else {
          metricValue = machines.summary.overallUtilizationPercent || 0;
          defaultTitle = 'Beban Utilisasi Mesin Sangat Tinggi';
          defaultMessage = `Tingkat utilisasi mesin mencapai ${metricValue.toFixed(1)}%, berisiko menyebabkan antrean dan keausan`;
        }
        break;
      }
      case 'CUSTOMER_RATING': {
        const totalFeedbacks = customer.feedbackSummary.totalFeedbacks || 0;
        if (totalFeedbacks < 3) {
          isApplicable = false;
        } else {
          metricValue = customer.feedbackSummary.avgRating || 0;
          defaultTitle = 'Rating Kepuasan Pelanggan Menurun';
          defaultMessage = `Rata-rata rating kepuasan pelanggan berada di angka ${metricValue.toFixed(1)} bintang`;
        }
        break;
      }
      case 'DORMANT_SURGE': {
        const totalCustomers = customer.overview.totalCustomers || 0;
        if (totalCustomers === 0) {
          isApplicable = false;
        } else {
          metricValue = (customer.overview.dormantCustomersCount / Math.max(totalCustomers, 1)) * 100;
          defaultTitle = 'Lonjakan Pelanggan Tidak Aktif (Dormant)';
          defaultMessage = `Sebanyak ${metricValue.toFixed(1)}% pelanggan belum kembali bertransaksi`;
        }
        break;
      }
      case 'LOW_STOCK': {
        const lowStockCount = inventory.summary.lowStockCount || 0;
        const totalItems = (inventory.lowStockItems?.length || 0) + (inventory.summary.inventoryValuation > 0 ? 1 : 0);
        if (totalItems === 0 && lowStockCount === 0) {
          isApplicable = false;
        } else {
          metricValue = lowStockCount;
          defaultTitle = 'Stok Bahan Baku Menipis / Kritis';
          defaultMessage = `Terdapat ${metricValue} item bahan baku / deterjen yang menipis atau di bawah batas aman`;
        }
        break;
      }
      case 'HIGH_RECEIVABLES': {
        const grossRev = financial.revenue.grossRevenue.current || 0;
        if (grossRev === 0) {
          isApplicable = false;
        } else {
          const outstanding = financial.balanceSheetSummary.outstandingReceivables || 0;
          metricValue = (outstanding / Math.max(grossRev, 1)) * 100;
          defaultTitle = 'Rasio Piutang Belum Lunas Tinggi';
          defaultMessage = `Piutang belum tertagih mencapai ${metricValue.toFixed(1)}% dari total omset`;
        }
        break;
      }
      case 'CASH_DISCREPANCY': {
        if (closedShiftCount === 0) {
          isApplicable = false;
        } else {
          metricValue = cashDiscrepancy;
          defaultTitle = 'Selisih Kas Tutup Shift Melebihi Batas';
          defaultMessage = `Total akumulasi selisih kas fisik shift kasir mencapai Rp ${metricValue.toLocaleString('id-ID')}`;
        }
        break;
      }
      default:
        isApplicable = false;
        break;
    }

    if (!isApplicable || metricValue === null) {
      continue;
    }

    evaluatedRulesCount++;

    const violation = checkViolation(
      metricValue,
      rule.operator,
      rule.warningThreshold,
      rule.criticalThreshold
    );

    if (violation && violation.isViolated) {
      const { severity, threshold } = violation;
      const fullMessage = `${defaultMessage} (batas ambang: ${threshold} ${rule.unit}).`;

      // DEDUPLIKASI: Cek apakah sudah ada alert berstatus OPEN atau IN_PROGRESS
      const existingAlert = await prisma.persistentAlert.findFirst({
        where: {
          tenantId,
          outletId,
          ruleKey: rule.ruleKey,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      });

      let savedAlert: any;

      if (existingAlert) {
        savedAlert = await prisma.persistentAlert.update({
          where: { id: existingAlert.id },
          data: {
            severity,
            title: defaultTitle,
            message: fullMessage,
            metricValue: new Prisma.Decimal(metricValue),
            thresholdValue: new Prisma.Decimal(threshold),
            updatedAt: new Date(),
          },
          include: {
            outlet: { select: { id: true, name: true } },
            resolvedBy: { select: { id: true, name: true } },
          },
        });
        updatedCount++;
      } else {
        savedAlert = await prisma.persistentAlert.create({
          data: {
            tenantId,
            outletId,
            ruleKey: rule.ruleKey,
            severity,
            title: defaultTitle,
            message: fullMessage,
            metricValue: new Prisma.Decimal(metricValue),
            thresholdValue: new Prisma.Decimal(threshold),
            status: 'OPEN',
          },
          include: {
            outlet: { select: { id: true, name: true } },
            resolvedBy: { select: { id: true, name: true } },
          },
        });
        createdCount++;
      }

      persistedAlerts.push(savedAlert);

      // Pemicu Notifikasi WhatsApp Owner untuk anomali CRITICAL
      const channels = Array.isArray(rule.notificationChannels)
        ? (rule.notificationChannels as string[])
        : ['IN_APP'];

      if (
        severity === 'CRITICAL' &&
        channels.includes('WHATSAPP') &&
        !savedAlert.waNotifiedAt &&
        triggerWa
      ) {
        try {
          const ownerUser = await prisma.user.findFirst({
            where: { tenantId, role: 'OWNER', phone: { not: null } },
            select: { phone: true },
          });

          const tenantRecord = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { phone: true },
          });

          const ownerPhone = ownerUser?.phone || tenantRecord?.phone;

          if (ownerPhone && ownerPhone.trim()) {
            const waRes = await whatsAppService.sendOwnerAlertNotification({
              tenantId,
              outletId,
              ownerPhone,
              outletName: outlet.name,
              severity,
              title: defaultTitle,
              message: fullMessage,
              metricValue,
              thresholdValue: threshold,
            });

            if ((waRes.success || waRes.status === 'success') && !waRes.isMock) {
              const updatedWa = await prisma.persistentAlert.update({
                where: { id: savedAlert.id },
                data: { waNotifiedAt: new Date() },
              });
              savedAlert.waNotifiedAt = updatedWa.waNotifiedAt;
              waSentCount++;
            }
          }
        } catch (waErr) {
          console.warn('[ALERT EVALUATION WA ERROR]', waErr);
        }
      }
    }
  }

  return {
    evaluatedRulesCount,
    createdCount,
    updatedCount,
    waSentCount,
    alerts: persistedAlerts,
  };
}
