/**
 * Laundry Operations & 11-Stage Bottleneck Analytics Service
 * Laundry Outlet Performance Intelligence (Well POS)
 * 
 * Mengimplementasikan pemantauan 11 tahapan alur pipa produksi kanonikal,
 * deteksi otomatis titik hambat (bottleneck stage), durasi turnaround time,
 * penanganan insiden komplain (rusak/hilang), serta lag transfer antar-outlet (workshop).
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { FinancialAnalyticsParams } from './laundryAnalyticsFinancial.service';
import { resolveLaundryOutletScope } from './laundryOutletScope.helper';

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

export const INCIDENT_TYPES = ['DAMAGED', 'LOST', 'STAIN_REMAINING', 'MIXED_UP'] as const;
export type CanonicalIncidentType = (typeof INCIDENT_TYPES)[number];

export interface StagePipelineItem {
  stage: CanonicalStage;
  activeOrderCount: number;
  activeWeightKg: number;
  completedLogsCount: number;
  avgDurationMinutes: number;
}

export interface IncidentTypeSummary {
  incidentType: CanonicalIncidentType;
  count: number;
  totalCompensation: number;
}

export interface OperationsAnalyticsResult {
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
  };
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
    totalApprovedCompensation: number;
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

const toNum = (val: any): number => {
  if (val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

export async function getOperationsAnalytics(
  params: FinancialAnalyticsParams
): Promise<OperationsAnalyticsResult> {
  const { tenantId, outletId, dateRange } = params;
  const timezone = params.timezone || dateRange.timezone || 'Asia/Jakarta';

  const scope = await resolveLaundryOutletScope(tenantId, outletId);
  const outletOrderFilter = scope.sqlFilter('o.outlet_id');
  const outletLodFilter = scope.sqlFilter('lod.outlet_id');
  const outletLiFilter = scope.sqlFilter('li.outlet_id');
  const outletLslFilter = scope.sqlFilter('o.outlet_id');
  const outletManifestFilter =
    !scope.isAll && outletId
      ? Prisma.sql`AND (ltm.source_outlet_id = ${outletId} OR ltm.target_outlet_id = ${outletId})`
      : scope.laundryOutletIds.length > 0
      ? Prisma.sql`AND (ltm.source_outlet_id IN (${Prisma.join(scope.laundryOutletIds)}) OR ltm.target_outlet_id IN (${Prisma.join(scope.laundryOutletIds)}))`
      : Prisma.sql`AND 1 = 0`;

  // 1. Ringkasan Produksi (Total Orders, Weight, Pieces)
  const prodSummaryRows = await prisma.$queryRaw<any[]>`
    SELECT 
      COUNT(o.id) as total_orders_processed,
      COALESCE(SUM(lod.total_weight_kg), 0) as total_weight_processed,
      COALESCE(SUM(lod.total_pieces), 0) as total_pieces_processed
    FROM orders o
    JOIN laundry_order_details lod ON o.id = lod.order_id
    WHERE o.tenant_id = ${tenantId}
      ${outletOrderFilter}
      AND o.created_at >= ${dateRange.startDate}
      AND o.created_at <= ${dateRange.endDate}
      AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'));
  `;
  const totalOrdersProcessed = Number(prodSummaryRows[0]?.total_orders_processed || 0);
  const totalWeightProcessed = toNum(prodSummaryRows[0]?.total_weight_processed);
  const totalPiecesProcessed = Number(prodSummaryRows[0]?.total_pieces_processed || 0);

  // 1b. Work In Progress (Pesanan aktif yang belum selesai/diserahkan)
  const wipRows = await prisma.$queryRaw<any[]>`
    SELECT COUNT(lod.id) as wip_count
    FROM laundry_order_details lod
    JOIN orders o ON lod.order_id = o.id
    WHERE lod.tenant_id = ${tenantId}
      ${outletLodFilter}
      AND (lod.current_stage IS NULL OR lod.current_stage NOT IN ('HANDOVER', 'COMPLETED'))
      AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'));
  `;
  const workInProgressCount = Number(wipRows[0]?.wip_count || 0);

  // 1c. Rata-Rata Waktu Selesai Produksi (Turnaround Time dalam Jam)
  const turnaroundRows = await prisma.$queryRaw<any[]>`
    SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (lod.completed_at - o.created_at)) / 3600), 0) as avg_turnaround_hours
    FROM laundry_order_details lod
    JOIN orders o ON lod.order_id = o.id
    WHERE lod.tenant_id = ${tenantId}
      ${outletLodFilter}
      AND lod.completed_at IS NOT NULL
      AND lod.completed_at >= ${dateRange.startDate}
      AND lod.completed_at <= ${dateRange.endDate}
      AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'));
  `;
  const averageTurnaroundHours = Number(
    toNum(turnaroundRows[0]?.avg_turnaround_hours).toFixed(1)
  );

  // 1d. SLA On-Time Completion Rate (Order jatuh tempo di periode aktif)
  const slaRows = await prisma.$queryRaw<any[]>`
    SELECT 
      COUNT(lod.id) as due_orders_count,
      COUNT(CASE WHEN lod.completed_at IS NOT NULL AND lod.completed_at <= lod.estimated_ready_at THEN 1 END) as on_time_orders_count
    FROM laundry_order_details lod
    JOIN orders o ON lod.order_id = o.id
    WHERE lod.tenant_id = ${tenantId}
      ${outletLodFilter}
      AND lod.estimated_ready_at >= ${dateRange.startDate}
      AND lod.estimated_ready_at <= ${dateRange.endDate}
      AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'));
  `;
  const dueOrdersCount = Number(slaRows[0]?.due_orders_count || 0);
  const onTimeOrdersCount = Number(slaRows[0]?.on_time_orders_count || 0);
  const onTimeCompletionRate =
    dueOrdersCount > 0
      ? Number(((onTimeOrdersCount / dueOrdersCount) * 100).toFixed(2))
      : 100;

  // 1e. Overdue Orders (Saat ini melewati batas estimasi dan belum selesai)
  const overdueRows = await prisma.$queryRaw<any[]>`
    SELECT COUNT(lod.id) as overdue_orders_count
    FROM laundry_order_details lod
    JOIN orders o ON lod.order_id = o.id
    WHERE lod.tenant_id = ${tenantId}
      ${outletLodFilter}
      AND lod.completed_at IS NULL
      AND lod.estimated_ready_at < NOW()
      AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'));
  `;
  const overdueOrdersCount = Number(overdueRows[0]?.overdue_orders_count || 0);

  // 1f. Rewash Rate (Order cuci ulang)
  const rewashRows = await prisma.$queryRaw<any[]>`
    SELECT COUNT(DISTINCT o.id) as rewash_count
    FROM orders o
    JOIN laundry_order_details lod ON o.id = lod.order_id
    LEFT JOIN laundry_stage_logs lsl ON o.id = lsl.order_id
    WHERE o.tenant_id = ${tenantId}
      ${outletOrderFilter}
      AND o.created_at >= ${dateRange.startDate}
      AND o.created_at <= ${dateRange.endDate}
      AND (
        UPPER(COALESCE(lsl.stage, '')) = 'REWASH' 
        OR UPPER(COALESCE(lod.defect_notes, '')) LIKE '%REWASH%'
      )
      AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'));
  `;
  const rewashCount = Number(rewashRows[0]?.rewash_count || 0);
  const rewashRate =
    totalOrdersProcessed > 0
      ? Number(((rewashCount / totalOrdersProcessed) * 100).toFixed(2))
      : 0;

  // 2. Alur Pipa 11 Tahapan Kanonikal (stagePipeline) & Bottleneck Detection
  // 2a. Antrean Aktif per Tahap (dari laundry_order_details.current_stage)
  const activeStageRows = await prisma.$queryRaw<any[]>`
    SELECT 
      stage,
      COUNT(id) as active_order_count,
      COALESCE(SUM(total_weight_kg), 0) as active_weight_kg
    FROM (
      SELECT 
        lod.id,
        lod.total_weight_kg,
        UPPER(COALESCE(lod.current_stage, 'DROP_OFF')) as stage
      FROM laundry_order_details lod
      JOIN orders o ON lod.order_id = o.id
      WHERE lod.tenant_id = ${tenantId}
        ${outletLodFilter}
        AND (lod.current_stage IS NULL OR lod.current_stage NOT IN ('COMPLETED'))
        AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'))
    ) sub
    GROUP BY stage;
  `;
  const activeStageMap = new Map<string, { count: number; weight: number }>();
  for (const r of activeStageRows) {
    activeStageMap.set(String(r.stage).toUpperCase(), {
      count: Number(r.active_order_count || 0),
      weight: toNum(r.active_weight_kg),
    });
  }

  // 2b. Durasi rata-rata & log selesai per tahap (dari laundry_stage_logs)
  const stageLogRows = await prisma.$queryRaw<any[]>`
    SELECT 
      UPPER(lsl.stage) as stage,
      COUNT(lsl.id) as completed_logs_count,
      COALESCE(AVG(lsl.duration_minutes), 0) as avg_duration_minutes
    FROM laundry_stage_logs lsl
    JOIN orders o ON lsl.order_id = o.id
    WHERE lsl.tenant_id = ${tenantId}
      ${outletLslFilter}
      AND lsl.completed_at IS NOT NULL
      AND lsl.completed_at >= ${dateRange.startDate}
      AND lsl.completed_at <= ${dateRange.endDate}
    GROUP BY UPPER(lsl.stage);
  `;
  const stageLogMap = new Map<string, { count: number; avgDuration: number }>();
  for (const r of stageLogRows) {
    stageLogMap.set(String(r.stage).toUpperCase(), {
      count: Number(r.completed_logs_count || 0),
      avgDuration: Number(toNum(r.avg_duration_minutes).toFixed(1)),
    });
  }

  // Bangun 11 tahapan berurutan lengkap
  const stagePipeline: StagePipelineItem[] = CANONICAL_STAGES.map((stg) => {
    const act = activeStageMap.get(stg) || { count: 0, weight: 0 };
    const log = stageLogMap.get(stg) || { count: 0, avgDuration: 0 };
    return {
      stage: stg,
      activeOrderCount: act.count,
      activeWeightKg: Number(act.weight.toFixed(2)),
      completedLogsCount: log.count,
      avgDurationMinutes: log.avgDuration,
    };
  });

  // Deteksi Otomatis Bottleneck Stage (Tahap produksi aktif 1..9 selain RACK_STORAGE & HANDOVER)
  const productionStages = stagePipeline.filter(
    (s) => s.stage !== 'RACK_STORAGE' && s.stage !== 'HANDOVER'
  );
  productionStages.sort((a, b) => {
    if (b.activeWeightKg !== a.activeWeightKg) return b.activeWeightKg - a.activeWeightKg;
    if (b.activeOrderCount !== a.activeOrderCount) return b.activeOrderCount - a.activeOrderCount;
    return b.avgDurationMinutes - a.avgDurationMinutes;
  });

  const bottleneckStage: CanonicalStage | null =
    productionStages.length > 0 && productionStages[0].activeOrderCount > 0
      ? productionStages[0].stage
      : null;

  // 3. Insiden Produksi (laundry_incidents)
  const incidentTotalRows = await prisma.$queryRaw<any[]>`
    SELECT 
      COUNT(li.id) as total_incidents,
      COALESCE(SUM(li.approved_compensation), 0) as total_compensation,
      COALESCE(AVG(CASE WHEN li.resolved_at IS NOT NULL THEN EXTRACT(EPOCH FROM (li.resolved_at - li.created_at)) / 3600 END), 0) as mttr_hours
    FROM laundry_incidents li
    WHERE li.tenant_id = ${tenantId}
      ${outletLiFilter}
      AND li.created_at >= ${dateRange.startDate}
      AND li.created_at <= ${dateRange.endDate};
  `;
  const totalIncidents = Number(incidentTotalRows[0]?.total_incidents || 0);
  const totalApprovedCompensation = toNum(incidentTotalRows[0]?.total_compensation);
  const meanTimeToResolveHours = Number(
    toNum(incidentTotalRows[0]?.mttr_hours).toFixed(1)
  );
  const incidentRate =
    totalOrdersProcessed > 0
      ? Number(((totalIncidents / totalOrdersProcessed) * 100).toFixed(2))
      : 0;

  // 3b. Breakdown Insiden per Tipe (4 Kategori Kanonikal)
  const incidentTypeRows = await prisma.$queryRaw<any[]>`
    SELECT 
      UPPER(li.incident_type) as incident_type,
      COUNT(li.id) as count,
      COALESCE(SUM(li.approved_compensation), 0) as total_compensation
    FROM laundry_incidents li
    WHERE li.tenant_id = ${tenantId}
      ${outletLiFilter}
      AND li.created_at >= ${dateRange.startDate}
      AND li.created_at <= ${dateRange.endDate}
    GROUP BY UPPER(li.incident_type);
  `;
  const incidentTypeMap = new Map<string, { count: number; compensation: number }>();
  for (const r of incidentTypeRows) {
    incidentTypeMap.set(String(r.incident_type).toUpperCase(), {
      count: Number(r.count || 0),
      compensation: toNum(r.total_compensation),
    });
  }

  const byType: IncidentTypeSummary[] = INCIDENT_TYPES.map((type) => {
    const data = incidentTypeMap.get(type) || { count: 0, compensation: 0 };
    return {
      incidentType: type,
      count: data.count,
      totalCompensation: data.compensation,
    };
  });

  // 3c. Breakdown Insiden per Status
  const incidentStatusRows = await prisma.$queryRaw<any[]>`
    SELECT 
      UPPER(li.status) as status,
      COUNT(li.id) as count
    FROM laundry_incidents li
    WHERE li.tenant_id = ${tenantId}
      ${outletLiFilter}
      AND li.created_at >= ${dateRange.startDate}
      AND li.created_at <= ${dateRange.endDate}
    GROUP BY UPPER(li.status);
  `;
  const byStatus = incidentStatusRows.map((r) => ({
    status: String(r.status),
    count: Number(r.count || 0),
  }));

  // 4. Hub-and-Spoke Workshop Transfer Lag
  const manifestRows = await prisma.$queryRaw<any[]>`
    SELECT 
      COUNT(ltm.id) as total_manifests,
      COUNT(CASE WHEN UPPER(ltm.status) = 'DISPATCHED' THEN 1 END) as in_transit_count,
      COUNT(CASE WHEN UPPER(ltm.status) = 'RECEIVED' THEN 1 END) as received_count,
      COALESCE(AVG(CASE WHEN UPPER(ltm.status) = 'RECEIVED' AND ltm.received_at IS NOT NULL AND ltm.dispatched_at IS NOT NULL THEN EXTRACT(EPOCH FROM (ltm.received_at - ltm.dispatched_at)) / 3600 END), 0) as avg_transfer_lag_hours
    FROM laundry_transfer_manifests ltm
    WHERE ltm.tenant_id = ${tenantId}
      ${outletManifestFilter}
      AND ltm.created_at >= ${dateRange.startDate}
      AND ltm.created_at <= ${dateRange.endDate};
  `;
  const totalManifests = Number(manifestRows[0]?.total_manifests || 0);
  const inTransitCount = Number(manifestRows[0]?.in_transit_count || 0);
  const receivedCount = Number(manifestRows[0]?.received_count || 0);
  const avgTransferLagHours = Number(
    toNum(manifestRows[0]?.avg_transfer_lag_hours).toFixed(1)
  );

  return {
    meta: {
      tenantId,
      outletId,
      preset: dateRange.preset,
      formattedRange: dateRange.formattedRange,
      timezone,
    },
    summary: {
      totalOrdersProcessed,
      totalWeightProcessed,
      totalPiecesProcessed,
      workInProgressCount,
      averageTurnaroundHours,
      onTimeCompletionRate,
      dueOrdersCount,
      onTimeOrdersCount,
      overdueOrdersCount,
      rewashCount,
      rewashRate,
    },
    stagePipeline,
    bottleneckStage,
    incidents: {
      totalIncidents,
      incidentRate,
      totalApprovedCompensation,
      meanTimeToResolveHours,
      byType,
      byStatus,
    },
    workshopTransfer: {
      totalManifests,
      inTransitCount,
      receivedCount,
      avgTransferLagHours,
    },
  };
}
