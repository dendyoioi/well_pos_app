/**
 * Laundry Machine Utilization Analytics Service (Non-IoT Stage Log-based)
 * Laundry Outlet Performance Intelligence (Well POS)
 * 
 * Mengimplementasikan pemantauan utilisasi mesin cuci (Washer) dan pengering (Dryer),
 * estimasi jam operasional berbasis catatan stage log, deteksi jadwal servis berkala,
 * serta metadata transparansi non-IoT sesuai spesifikasi Task W1-10.
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
    availability: 'PARTIAL';
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
      current: null;
      availability: 'MISSING';
      note: string;
    };
    costPerCycle: {
      current: null;
      availability: 'MISSING';
      note: string;
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

  // 2. Ambil catatan siklus (cycle) dari laundry_stage_logs yang mencatat machine_name
  const stageLogRows = await prisma.$queryRaw<any[]>`
    SELECT 
      TRIM(LOWER(lsl.machine_name)) as machine_name_key,
      COUNT(lsl.id)::int as cycle_count,
      COALESCE(SUM(lsl.duration_minutes), 0)::int as total_duration_minutes
    FROM laundry_stage_logs lsl
    JOIN orders o ON lsl.order_id = o.id
    WHERE lsl.tenant_id = ${tenantId}
      ${outletLslFilter}
      AND lsl.created_at >= ${dateRange.startDate}
      AND lsl.created_at <= ${dateRange.endDate}
      AND lsl.machine_name IS NOT NULL
      AND TRIM(lsl.machine_name) != ''
    GROUP BY TRIM(LOWER(lsl.machine_name));
  `;

  const logMap = new Map<string, { cycles: number; durationMin: number }>();
  for (const r of stageLogRows) {
    logMap.set(String(r.machine_name_key), {
      cycles: Number(r.cycle_count || 0),
      durationMin: Number(r.total_duration_minutes || 0),
    });
  }

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

    // Pencocokan fleksibel case-insensitive terhadap name atau code
    const nameKey = mName.trim().toLowerCase();
    const codeKey = mCode.trim().toLowerCase();
    const matchedLog = logMap.get(nameKey) || logMap.get(codeKey) || { cycles: 0, durationMin: 0 };

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
      ? Number(Math.min(100, (totalOperatingMinutes / totalAvailableOperatingMinutes) * 100).toFixed(2))
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
      availability: 'PARTIAL',
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
        current: null,
        availability: 'MISSING',
        note: 'Data Belum Tersedia (Roadmap Wave 2: Log Servis & Downtime Mesin)',
      },
      costPerCycle: {
        current: null,
        availability: 'MISSING',
        note: 'Data Belum Tersedia (Roadmap Wave 2: Beban Utilitas Non-Shift)',
      },
    },
    byType,
    machines,
  };
}
