/**
 * Laundry Employee 4-Pillar Performance & Shift Attendance Analytics Service
 * Laundry Outlet Performance Intelligence (Well POS)
 * 
 * Mengimplementasikan analisis produktivitas karyawan, absensi shift terjadwal,
 * leaderboard 4 pilar kinerja (Disiplin, Produktivitas, Kualitas, Kepuasan),
 * serta distribusi evaluasi berkala sesuai spesifikasi Task W1-09.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { FinancialAnalyticsParams } from './laundryAnalyticsFinancial.service';
import { getFinancialAnalytics } from './laundryAnalyticsFinancial.service';

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
    activeStaffCount: number;
    scheduledShiftsCount: number;
    attendedShiftsCount: number;
    attendanceRate: number;
    totalLateCount: number;
    totalLateMinutes: number;
    revenuePerEmployee: number;
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

const toNum = (val: any): number => {
  if (val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

export async function getEmployeesAnalytics(
  params: FinancialAnalyticsParams
): Promise<EmployeesAnalyticsResult> {
  const { tenantId, outletId, dateRange } = params;
  const timezone = params.timezone || dateRange.timezone || 'Asia/Jakarta';

  const outletUserFilter =
    outletId !== 'ALL' ? Prisma.sql`AND u.outlet_id = ${outletId}` : Prisma.empty;
  const outletAttFilter =
    outletId !== 'ALL' ? Prisma.sql`AND a.outlet_id = ${outletId}` : Prisma.empty;
  const outletSchedFilter =
    outletId !== 'ALL' ? Prisma.sql`AND sws.outlet_id = ${outletId}` : Prisma.empty;
  const outletRevFilter =
    outletId !== 'ALL' ? Prisma.sql`AND spr.outlet_id = ${outletId}` : Prisma.empty;
  const outletLslFilter =
    outletId !== 'ALL' ? Prisma.sql`AND o.outlet_id = ${outletId}` : Prisma.empty;
  const outletLiFilter =
    outletId !== 'ALL' ? Prisma.sql`AND li.outlet_id = ${outletId}` : Prisma.empty;
  const outletOrderFilter =
    outletId !== 'ALL' ? Prisma.sql`AND o.outlet_id = ${outletId}` : Prisma.empty;

  // Tanggal dalam format YYYY-MM-DD (WIB aman tanpa pergeseran hari UTC)
  const startDateStr = dateRange.formattedRange.start;
  const endDateStr = dateRange.formattedRange.end;

  // 1. Ambil data staf aktif (User yang punya aktivitas kehadiran, order, atau stage log dalam periode)
  const activeStaffRows = await prisma.$queryRaw<any[]>`
    SELECT DISTINCT u.id as user_id, u.name, u.role
    FROM users u
    WHERE u.tenant_id = ${tenantId}
      ${outletUserFilter}
      AND u.is_active = true
      AND (
        EXISTS (
          SELECT 1 FROM attendances a
          WHERE a.user_id = u.id
            AND a.work_date >= ${startDateStr}
            AND a.work_date <= ${endDateStr}
        )
        OR EXISTS (
          SELECT 1 FROM staff_work_schedules sws
          WHERE sws.user_id = u.id
            AND sws.schedule_date >= ${startDateStr}
            AND sws.schedule_date <= ${endDateStr}
        )
        OR EXISTS (
          SELECT 1 FROM orders o
          WHERE o.cashier_id = u.id
            AND o.created_at >= ${dateRange.startDate}
            AND o.created_at <= ${dateRange.endDate}
        )
        OR EXISTS (
          SELECT 1 FROM laundry_stage_logs lsl
          WHERE lsl.operator_id = u.id
            AND lsl.created_at >= ${dateRange.startDate}
            AND lsl.created_at <= ${dateRange.endDate}
        )
      );
  `;

  // Fallback: jika belum ada transaksi aktivitas, ambil seluruh staff aktif di outlet/tenant
  let staffList = activeStaffRows;
  if (staffList.length === 0) {
    staffList = await prisma.$queryRaw<any[]>`
      SELECT u.id as user_id, u.name, u.role
      FROM users u
      WHERE u.tenant_id = ${tenantId}
        ${outletUserFilter}
        AND u.is_active = true
      LIMIT 50;
    `;
  }

  const activeStaffCount = staffList.length;

  // 2. Scheduled Shifts & Attended Shifts
  const scheduleRows = await prisma.$queryRaw<any[]>`
    SELECT 
      COUNT(sws.id)::int as scheduled_shifts_count
    FROM staff_work_schedules sws
    WHERE sws.tenant_id = ${tenantId}
      ${outletSchedFilter}
      AND sws.schedule_date >= ${startDateStr}
      AND sws.schedule_date <= ${endDateStr}
      AND sws.is_off_day = false;
  `;
  const scheduledShiftsCount = Number(scheduleRows[0]?.scheduled_shifts_count || 0);

  const attendanceSummaryRows = await prisma.$queryRaw<any[]>`
    SELECT 
      COUNT(a.id)::int as attended_shifts_count,
      COUNT(CASE WHEN a.status = 'LATE' OR a.late_minutes > 0 THEN 1 END)::int as total_late_count,
      COALESCE(SUM(a.late_minutes), 0)::int as total_late_minutes
    FROM attendances a
    WHERE a.tenant_id = ${tenantId}
      ${outletAttFilter}
      AND a.work_date >= ${startDateStr}
      AND a.work_date <= ${endDateStr}
      AND a.clock_in IS NOT NULL;
  `;
  const attendedShiftsCount = Number(attendanceSummaryRows[0]?.attended_shifts_count || 0);
  const totalLateCount = Number(attendanceSummaryRows[0]?.total_late_count || 0);
  const totalLateMinutes = Number(attendanceSummaryRows[0]?.total_late_minutes || 0);

  const attendanceRate =
    scheduledShiftsCount > 0
      ? Number(((attendedShiftsCount / scheduledShiftsCount) * 100).toFixed(2))
      : attendedShiftsCount > 0
      ? 100
      : 0;

  // 3. Revenue per Employee (Pencegahan division-by-zero & integrasi finansial netRevenue)
  let revenuePerEmployee = 0;
  try {
    const fin = await getFinancialAnalytics(params);
    const netRev = fin.revenue.netRevenue.current;
    if (activeStaffCount > 0 && netRev > 0) {
      revenuePerEmployee = Number((netRev / activeStaffCount).toFixed(2));
    }
  } catch (err) {
    revenuePerEmployee = 0;
  }

  // 4. Grade Distribution (Review Kinerja Terbaru per Karyawan)
  const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, UNREVIEWED: 0 };
  const latestReviewRows = await prisma.$queryRaw<any[]>`
    SELECT DISTINCT ON (spr.user_id)
      spr.user_id,
      spr.grade,
      spr.overall_score,
      spr.discipline_score,
      spr.productivity_score,
      spr.quality_score,
      spr.customer_score
    FROM staff_performance_reviews spr
    WHERE spr.tenant_id = ${tenantId}
      ${outletRevFilter}
    ORDER BY spr.user_id, spr.period_end DESC, spr.created_at DESC;
  `;

  const reviewMap = new Map<string, any>();
  for (const r of latestReviewRows) {
    reviewMap.set(String(r.user_id), r);
    const g = String(r.grade).toUpperCase();
    if (g === 'A') gradeDistribution.A++;
    else if (g === 'B') gradeDistribution.B++;
    else if (g === 'C') gradeDistribution.C++;
    else if (g === 'D') gradeDistribution.D++;
  }

  // 5. Agregasi Order Kasir per Staf
  const cashierStatRows = await prisma.$queryRaw<any[]>`
    SELECT 
      o.cashier_id as user_id,
      COUNT(o.id)::int as orders_count,
      COALESCE(SUM(o.grand_total), 0) as total_amount
    FROM orders o
    WHERE o.tenant_id = ${tenantId}
      ${outletOrderFilter}
      AND o.created_at >= ${dateRange.startDate}
      AND o.created_at <= ${dateRange.endDate}
      AND (o.order_status IS NULL OR o.order_status NOT IN ('VOIDED', 'CANCELLED'))
    GROUP BY o.cashier_id;
  `;
  const cashierStatMap = new Map<string, { orders: number; amount: number }>();
  for (const c of cashierStatRows) {
    cashierStatMap.set(String(c.user_id), {
      orders: Number(c.orders_count || 0),
      amount: toNum(c.total_amount),
    });
  }

  // 6. Agregasi Stage Logs (Pengerjaan Produksi) per Staf
  const stageLogRows = await prisma.$queryRaw<any[]>`
    SELECT 
      lsl.operator_id as user_id,
      COUNT(lsl.id)::int as stages_completed,
      COALESCE(SUM(lsl.weight_kg), 0) as weight_processed_kg,
      COALESCE(SUM(lsl.duration_minutes), 0)::int as duration_minutes
    FROM laundry_stage_logs lsl
    JOIN orders o ON lsl.order_id = o.id
    WHERE lsl.tenant_id = ${tenantId}
      ${outletLslFilter}
      AND lsl.created_at >= ${dateRange.startDate}
      AND lsl.created_at <= ${dateRange.endDate}
      AND lsl.operator_id IS NOT NULL
    GROUP BY lsl.operator_id;
  `;
  const stageLogMap = new Map<string, { stages: number; weight: number; durationMin: number }>();
  for (const s of stageLogRows) {
    stageLogMap.set(String(s.user_id), {
      stages: Number(s.stages_completed || 0),
      weight: toNum(s.weight_processed_kg),
      durationMin: Number(s.duration_minutes || 0),
    });
  }

  // 7. Absensi & Durasi Kerja per Staf
  const staffAttRows = await prisma.$queryRaw<any[]>`
    SELECT 
      a.user_id,
      COUNT(a.id)::int as attended_shifts,
      COUNT(CASE WHEN a.status = 'LATE' OR a.late_minutes > 0 THEN 1 END)::int as late_count,
      COALESCE(SUM(a.late_minutes), 0)::int as late_minutes,
      COALESCE(SUM(a.duration_minutes), 0)::int as work_minutes
    FROM attendances a
    WHERE a.tenant_id = ${tenantId}
      ${outletAttFilter}
      AND a.work_date >= ${startDateStr}
      AND a.work_date <= ${endDateStr}
      AND a.clock_in IS NOT NULL
    GROUP BY a.user_id;
  `;
  const staffAttMap = new Map<string, { shifts: number; lateCount: number; lateMinutes: number; workMin: number }>();
  for (const a of staffAttRows) {
    staffAttMap.set(String(a.user_id), {
      shifts: Number(a.attended_shifts || 0),
      lateCount: Number(a.late_count || 0),
      lateMinutes: Number(a.late_minutes || 0),
      workMin: Number(a.work_minutes || 0),
    });
  }

  // 8. Insiden Bertanggung Jawab per Staf
  const incidentRows = await prisma.$queryRaw<any[]>`
    SELECT 
      li.responsible_staff_id as user_id,
      COUNT(li.id)::int as incident_count
    FROM laundry_incidents li
    WHERE li.tenant_id = ${tenantId}
      ${outletLiFilter}
      AND li.created_at >= ${dateRange.startDate}
      AND li.created_at <= ${dateRange.endDate}
      AND li.responsible_staff_id IS NOT NULL
    GROUP BY li.responsible_staff_id;
  `;
  const incidentMap = new Map<string, number>();
  for (const i of incidentRows) {
    incidentMap.set(String(i.user_id), Number(i.incident_count || 0));
  }

  // 9. Susun Leaderboard Staf
  const leaderboard: EmployeeLeaderboardItem[] = [];

  for (const staff of staffList) {
    const uid = String(staff.user_id);
    const cStat = cashierStatMap.get(uid) || { orders: 0, amount: 0 };
    const sStat = stageLogMap.get(uid) || { stages: 0, weight: 0, durationMin: 0 };
    const aStat = staffAttMap.get(uid) || { shifts: 0, lateCount: 0, lateMinutes: 0, workMin: 0 };
    const incCount = incidentMap.get(uid) || 0;
    const rev = reviewMap.get(uid);

    if (!rev) {
      gradeDistribution.UNREVIEWED++;
    }

    const workHours = Number((aStat.workMin / 60).toFixed(2));
    const effectiveHours = workHours > 0 ? workHours : 1; // pembagi metrik kecepatan
    const kgPerHour = Number((sStat.weight / effectiveHours).toFixed(2));
    const ordersPerHour = Number((cStat.orders / effectiveHours).toFixed(2));

    leaderboard.push({
      userId: uid,
      name: String(staff.name || 'Staf'),
      role: String(staff.role || 'STAFF'),
      ordersHandled: cStat.orders,
      weightProcessedKg: Number(sStat.weight.toFixed(2)),
      stagesCompleted: sStat.stages,
      workHours,
      kgPerHour,
      ordersPerHour,
      lateCount: aStat.lateCount,
      lateMinutes: aStat.lateMinutes,
      incidentCount: incCount,
      latestOverallScore: rev ? Number(toNum(rev.overall_score).toFixed(1)) : null,
      latestGrade: rev ? String(rev.grade) : null,
      disciplineScore: rev ? Number(toNum(rev.discipline_score).toFixed(1)) : null,
      productivityScore: rev ? Number(toNum(rev.productivity_score).toFixed(1)) : null,
      qualityScore: rev ? Number(toNum(rev.quality_score).toFixed(1)) : null,
      customerScore: rev ? Number(toNum(rev.customer_score).toFixed(1)) : null,
    });
  }

  // Urutkan leaderboard berdasarkan ordersHandled DESC, weightProcessedKg DESC
  leaderboard.sort((a, b) => b.ordersHandled - a.ordersHandled || b.weightProcessedKg - a.weightProcessedKg);

  // 10. By Shift: Ringkasan per Template Shift Kerja
  const byShiftRows = await prisma.$queryRaw<any[]>`
    SELECT 
      wst.id as shift_template_id,
      wst.name as shift_name,
      wst.start_time,
      wst.end_time,
      COUNT(DISTINCT sws.id)::int as scheduled_count,
      COUNT(DISTINCT a.id)::int as attended_count,
      COUNT(DISTINCT CASE WHEN a.status = 'LATE' OR a.late_minutes > 0 THEN a.id END)::int as late_count
    FROM work_shift_templates wst
    LEFT JOIN staff_work_schedules sws ON wst.id = sws.shift_template_id
      AND sws.schedule_date >= ${startDateStr}
      AND sws.schedule_date <= ${endDateStr}
      AND sws.is_off_day = false
    LEFT JOIN attendances a ON sws.user_id = a.user_id 
      AND a.work_date = sws.schedule_date
      AND a.clock_in IS NOT NULL
    WHERE wst.tenant_id = ${tenantId}
      ${outletId !== 'ALL' ? Prisma.sql`AND wst.outlet_id = ${outletId}` : Prisma.empty}
      AND wst.is_active = true
    GROUP BY wst.id, wst.name, wst.start_time, wst.end_time
    ORDER BY wst.start_time ASC;
  `;

  const byShift: ShiftPerformanceItem[] = byShiftRows.map((r) => ({
    shiftTemplateId: r.shift_template_id ? String(r.shift_template_id) : null,
    shiftName: String(r.shift_name || 'Shift'),
    startTime: r.start_time ? String(r.start_time) : null,
    endTime: r.end_time ? String(r.end_time) : null,
    scheduledCount: Number(r.scheduled_count || 0),
    attendedCount: Number(r.attended_count || 0),
    lateCount: Number(r.late_count || 0),
  }));

  return {
    meta: {
      tenantId,
      outletId,
      preset: dateRange.preset,
      formattedRange: dateRange.formattedRange,
      timezone,
    },
    summary: {
      activeStaffCount,
      scheduledShiftsCount,
      attendedShiftsCount,
      attendanceRate,
      totalLateCount,
      totalLateMinutes,
      revenuePerEmployee,
    },
    gradeDistribution,
    leaderboard,
    byShift,
  };
}
