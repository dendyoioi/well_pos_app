/**
 * Laundry Machine Utilization Analytics Service (Non-IoT Stage Log-based)
 * Laundry Outlet Performance Intelligence (Well POS)
 * 
 * Mengimplementasikan pemantauan utilisasi mesin cuci (Washer) dan pengering (Dryer),
 * estimasi jam operasional berbasis catatan stage log, deteksi jadwal servis berkala,
 * pencatatan downtime & servis riil dari laundry_machine_maintenance_logs,
 * serta kalkulasi biaya per siklus dari beban utilitas operational_expenses.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { FinancialAnalyticsParams } from './laundryAnalyticsFinancial.service';

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
  meta: {
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
      totalMaintenanceCost: number;
      availability: 'READY';
      note?: string;
    };
    costPerCycle: {
      current: number;
      totalCycles: number;
      totalMachineExpense: number;
      utilityOpex: number;
      maintenanceCost: number;
      availability: 'READY' | 'EMPTY';
      note?: string;
    };
  };
  byType: MachineTypeAggregation[];
  machines: MachineUtilizationItem[];
}

const toNum = (val: any): number => {
  if (val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

export async function getMachinesAnalytics(
  params: FinancialAnalyticsParams
): Promise<MachinesAnalyticsResult> {
  const { tenantId, outletId, dateRange } = params;
  const timezone = params.timezone || dateRange.timezone || 'Asia/Jakarta';

  const outletLmFilter =
    outletId !== 'ALL' ? Prisma.sql`AND lm.outlet_id = ${outletId}` : Prisma.empty;
  const outletLslFilter =
    outletId !== 'ALL' ? Prisma.sql`AND o.outlet_id = ${outletId}` : Prisma.empty;

  // 1. Ambil daftar seluruh unit mesin terdaftar
  const machineRows = await prisma.$queryRaw<any[]>`
    SELECT 
      lm.id as machine_id,
      lm.code,
      lm.name,
      UPPER(lm.machine_type) as machine_type,
      COALESCE(lm.capacity_kg, 0) as capacity_kg,
      UPPER(lm.status) as status
    FROM laundry_machines lm
    WHERE lm.tenant_id = ${tenantId}
      ${outletLmFilter}
    ORDER BY lm.machine_type ASC, lm.code ASC;
  `;

  // 2. Ambil catatan siklus (cycle) dari laundry_stage_logs yang mencatat machine_id atau machine_name
  const stageLogRows = await prisma.$queryRaw<any[]>`
    SELECT 
      lsl.machine_id,
      TRIM(LOWER(lsl.machine_name)) as machine_name_key,
      COUNT(lsl.id)::int as cycle_count,
      COALESCE(SUM(lsl.duration_minutes), 0)::int as total_duration_minutes
    FROM laundry_stage_logs lsl
    JOIN orders o ON lsl.order_id = o.id
    WHERE lsl.tenant_id = ${tenantId}
      ${outletLslFilter}
      AND lsl.created_at >= ${dateRange.startDate}
      AND lsl.created_at <= ${dateRange.endDate}
      AND (
        (lsl.machine_id IS NOT NULL AND TRIM(lsl.machine_id) != '')
        OR (lsl.machine_name IS NOT NULL AND TRIM(lsl.machine_name) != '')
      )
    GROUP BY lsl.machine_id, TRIM(LOWER(lsl.machine_name));
  `;

  const logByMachineIdMap = new Map<string, { cycles: number; durationMin: number }>();
  const logByNameMap = new Map<string, { cycles: number; durationMin: number }>();

  for (const r of stageLogRows) {
    const mid = r.machine_id ? String(r.machine_id).trim() : '';
    const nameKey = r.machine_name_key ? String(r.machine_name_key).trim() : '';
    const cycles = Number(r.cycle_count || 0);
    const durationMin = Number(r.total_duration_minutes || 0);

    if (mid) {
      const prevVal = logByMachineIdMap.get(mid) || { cycles: 0, durationMin: 0 };
      logByMachineIdMap.set(mid, {
        cycles: prevVal.cycles + cycles,
        durationMin: prevVal.durationMin + durationMin,
      });
    }
    if (nameKey) {
      const prevVal = logByNameMap.get(nameKey) || { cycles: 0, durationMin: 0 };
      logByNameMap.set(nameKey, {
        cycles: prevVal.cycles + cycles,
        durationMin: prevVal.durationMin + durationMin,
      });
    }
  }

  // 3. Query laundry_machine_maintenance_logs untuk downtime & biaya servis
  const maintenanceOutletFilter =
    outletId !== 'ALL' ? Prisma.sql`AND lmml.outlet_id = ${outletId}` : Prisma.empty;
  const maintenanceRows = await prisma.$queryRaw<any[]>`
    SELECT 
      lmml.machine_id,
      COUNT(lmml.id)::int as total_logs,
      COALESCE(SUM(lmml.downtime_minutes), 0)::int as total_downtime_minutes,
      COALESCE(SUM(lmml.cost), 0) as total_maintenance_cost,
      MAX(lmml.start_date) as last_maintenance_date
    FROM laundry_machine_maintenance_logs lmml
    WHERE lmml.tenant_id = ${tenantId}
      ${maintenanceOutletFilter}
      AND lmml.start_date >= ${dateRange.startDate}
      AND lmml.start_date <= ${dateRange.endDate}
      AND lmml.status != 'CANCELLED'
    GROUP BY lmml.machine_id;
  `;

  const maintMap = new Map<
    string,
    { totalLogs: number; downtimeMin: number; cost: number; lastDate: string | null }
  >();
  let summaryTotalDowntimeMinutes = 0;
  let summaryTotalMaintenanceCost = 0;
  let summaryTotalMaintenanceLogs = 0;

  for (const r of maintenanceRows) {
    const mid = String(r.machine_id);
    const logs = Number(r.total_logs || 0);
    const dtMin = Number(r.total_downtime_minutes || 0);
    const cost = toNum(r.total_maintenance_cost);
    const lastDate = r.last_maintenance_date
      ? new Date(r.last_maintenance_date).toISOString()
      : null;

    summaryTotalMaintenanceLogs += logs;
    summaryTotalDowntimeMinutes += dtMin;
    summaryTotalMaintenanceCost += cost;

    maintMap.set(mid, { totalLogs: logs, downtimeMin: dtMin, cost, lastDate });
  }

  // 4. Query operational_expenses untuk beban utilitas (ELECTRICITY, WATER, MAINTENANCE)
  const opexOutletFilter =
    outletId !== 'ALL' ? Prisma.sql`AND oe.outlet_id = ${outletId}` : Prisma.empty;
  const utilityOpexRows = await prisma.$queryRaw<any[]>`
    SELECT 
      COALESCE(SUM(oe.amount), 0) as total_utility_amount
    FROM operational_expenses oe
    WHERE oe.tenant_id = ${tenantId}
      ${opexOutletFilter}
      AND oe.expense_date >= ${dateRange.startDate}
      AND oe.expense_date <= ${dateRange.endDate}
      AND oe.category::text IN ('ELECTRICITY', 'WATER', 'MAINTENANCE');
  `;
  const totalUtilityOpex = toNum(utilityOpexRows[0]?.total_utility_amount);
  const totalMachineExpense = totalUtilityOpex + summaryTotalMaintenanceCost;

  // Hitung durasi hari periode untuk patokan utilisasi operasional (standar: 12 jam/hari)
  const diffDays = Math.max(
    1,
    Math.round((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (86400 * 1000))
  );
  const standardDailyCapacityHours = 12; // Standar jam operasional laundry per hari
  const maxAvailableHoursPerMachine = diffDays * standardDailyCapacityHours;

  let totalMachines = machineRows.length;
  let activeMachines = 0;
  let maintenanceMachines = 0;
  let inactiveMachines = 0;
  let totalCycles = 0;
  let totalOperatingMinutes = 0;

  const typeAggMap = new Map<
    string,
    { unitCount: number; totalCycles: number; totalMinutes: number }
  >();

  const machines: MachineUtilizationItem[] = [];

  for (const m of machineRows) {
    const mid = String(m.machine_id);
    const mCode = String(m.code);
    const mName = String(m.name);
    const mType = String(m.machine_type || 'WASHER');
    const mStatus = String(m.status || 'ACTIVE');

    if (mStatus === 'ACTIVE') activeMachines++;
    else if (mStatus === 'MAINTENANCE') maintenanceMachines++;
    else inactiveMachines++;

    // Pencocokan: machine_id -> machine_name -> machine_code
    const nameKey = mName.trim().toLowerCase();
    const codeKey = mCode.trim().toLowerCase();
    const byIdLog = logByMachineIdMap.get(mid);
    const byNameLog = logByNameMap.get(nameKey) || logByNameMap.get(codeKey);
    const matchedLog = byIdLog || byNameLog || { cycles: 0, durationMin: 0 };

    const cycles = matchedLog.cycles;
    const durationMin = matchedLog.durationMin;
    const opHours = Number((durationMin / 60).toFixed(2));

    totalCycles += cycles;
    totalOperatingMinutes += durationMin;

    const utilizationPercent =
      maxAvailableHoursPerMachine > 0
        ? Number(Math.min(100, (opHours / maxAvailableHoursPerMachine) * 100).toFixed(2))
        : 0;

    // Maintenance Due jika telah beroperasi >= 300 cycles
    const maintenanceDue = cycles >= 300;

    const mMaint = maintMap.get(mid) || {
      totalLogs: 0,
      downtimeMin: 0,
      cost: 0,
      lastDate: null,
    };

    machines.push({
      machineId: mid,
      code: mCode,
      name: mName,
      machineType: mType,
      capacityKg: toNum(m.capacity_kg),
      status: mStatus,
      cycleCount: cycles,
      operatingHours: opHours,
      utilizationPercent,
      maintenanceDue,
      downtimeMinutes: mMaint.downtimeMin,
      maintenanceCount: mMaint.totalLogs,
      maintenanceCost: mMaint.cost,
      lastMaintenanceDate: mMaint.lastDate,
    });

    // Agregasi per tipe
    const currType = typeAggMap.get(mType) || { unitCount: 0, totalCycles: 0, totalMinutes: 0 };
    currType.unitCount++;
    currType.totalCycles += cycles;
    currType.totalMinutes += durationMin;
    typeAggMap.set(mType, currType);
  }

  const totalOperatingHours = Number((totalOperatingMinutes / 60).toFixed(2));
  const totalAvailableOperatingMinutes = activeMachines * maxAvailableHoursPerMachine * 60;
  const overallUtilizationPercent =
    totalAvailableOperatingMinutes > 0
      ? Number(
          Math.min(100, (totalOperatingMinutes / totalAvailableOperatingMinutes) * 100).toFixed(2)
        )
      : 0;

  // Susun byType
  const byType: MachineTypeAggregation[] = [];
  for (const [mType, agg] of typeAggMap.entries()) {
    const opHrs = Number((agg.totalMinutes / 60).toFixed(2));
    const availHrs = agg.unitCount * maxAvailableHoursPerMachine;
    const avgUtil =
      availHrs > 0 ? Number(Math.min(100, (opHrs / availHrs) * 100).toFixed(2)) : 0;
    byType.push({
      machineType: mType,
      unitCount: agg.unitCount,
      totalCycles: agg.totalCycles,
      totalOperatingHours: opHrs,
      avgUtilizationPercent: avgUtil,
    });
  }

  return {
    meta: {
      tenantId,
      outletId,
      preset: dateRange.preset,
      formattedRange: dateRange.formattedRange,
      timezone,
      dataSourceNote: 'Estimasi berbasis pencatatan stage log manual (Non-IoT)',
      availability: 'READY',
    },
    summary: {
      totalMachines,
      activeMachines,
      maintenanceMachines,
      inactiveMachines,
      totalCycles,
      totalOperatingHours,
      overallUtilizationPercent,
      downtimeLogs: {
        totalLogs: summaryTotalMaintenanceLogs,
        totalDowntimeMinutes: summaryTotalDowntimeMinutes,
        totalDowntimeHours: Number((summaryTotalDowntimeMinutes / 60).toFixed(1)),
        totalMaintenanceCost: summaryTotalMaintenanceCost,
        availability: 'READY',
      },
      costPerCycle: {
        current: totalCycles > 0 ? Math.round(totalMachineExpense / totalCycles) : 0,
        totalCycles,
        totalMachineExpense,
        utilityOpex: totalUtilityOpex,
        maintenanceCost: summaryTotalMaintenanceCost,
        availability: totalCycles > 0 ? 'READY' : 'EMPTY',
      },
    },
    byType,
    machines,
  };
}
