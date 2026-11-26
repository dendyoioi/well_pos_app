import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { prisma } from '../config/prisma';
import { toOutletDateStr, toOutletTimeStr } from '../utils/date.utils';

export interface AttendanceConfigDto {
  standardClockIn?: string; // e.g. "08:00"
  standardClockOut?: string; // e.g. "17:00"
  lateToleranceMinutes?: number; // e.g. 15 (menit)
}

/**
 * Helper menghitung status keterlambatan & menit keterlambatan
 * berdasarkan jam sekarang di timezone outlet vs jadwal masuk + toleransi.
 */
function calculateLateStatus(
  now: Date,
  timezone: string,
  config?: AttendanceConfigDto | null
): { status: 'ON_TIME' | 'LATE'; lateMinutes: number } {
  if (!config || !config.standardClockIn) {
    return { status: 'ON_TIME', lateMinutes: 0 };
  }

  const [stdHourStr, stdMinStr] = config.standardClockIn.split(':');
  const stdHour = parseInt(stdHourStr, 10);
  const stdMin = parseInt(stdMinStr, 10);

  if (isNaN(stdHour) || isNaN(stdMin)) {
    return { status: 'ON_TIME', lateMinutes: 0 };
  }

  // Jam lokal saat ini di zona waktu outlet
  const localTimeStr = toOutletTimeStr(now, timezone); // e.g. "08:25:10"
  const [curHourStr, curMinStr] = localTimeStr.split(':');
  const curHour = parseInt(curHourStr, 10);
  const curMin = parseInt(curMinStr, 10);

  const stdMinutesTotal = stdHour * 60 + stdMin;
  const curMinutesTotal = curHour * 60 + curMin;
  const tolerance = config.lateToleranceMinutes ?? 15;

  const diffMinutes = curMinutesTotal - stdMinutesTotal;

  if (diffMinutes > tolerance) {
    return {
      status: 'LATE',
      lateMinutes: diffMinutes,
    };
  }

  return {
    status: 'ON_TIME',
    lateMinutes: 0,
  };
}

/**
 * 1. Ambil daftar staf outlet & status absensi hari ini
 * GET /api/attendance/today?outletId=...
 */
export async function getTodayAttendance(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Tenant context tidak valid' });
    }

    const outletId = (req.query.outletId as string) || req.user?.outletId;
    if (!outletId) {
      return res.status(400).json({ status: 'error', message: 'outletId diperlukan' });
    }

    // Ambil data outlet (termasuk timezone dan config)
    const outlet = await prisma.outlet.findFirst({
      where: { id: outletId, tenantId },
      select: {
        id: true,
        name: true,
        timezone: true,
        attendanceConfig: true,
      },
    });

    if (!outlet) {
      return res.status(404).json({ status: 'error', message: 'Outlet tidak ditemukan' });
    }

    const timezone = outlet.timezone || 'Asia/Jakarta';
    const todayStr = toOutletDateStr(new Date(), timezone);

    // Ambil semua staf aktif di tenant yang ditugaskan ke outlet ini (atau floating staff)
    const staffMembers = await prisma.user.findMany({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { outletId },
          { outletId: null },
        ],
      },
      select: {
        id: true,
        name: true,
        role: true,
        userCode: true,
        pinHash: true,
      },
      orderBy: { name: 'asc' },
    });

    // Ambil data absensi outlet hari ini
    const todayAttendances = await prisma.attendance.findMany({
      where: {
        tenantId,
        outletId,
        workDate: todayStr,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            userCode: true,
          },
        },
      },
      orderBy: { clockIn: 'desc' },
    });

    const attendanceMap = new Map<string, any>();
    for (const att of todayAttendances) {
      // Petakan yang paling mutakhir per user
      if (!attendanceMap.has(att.userId)) {
        attendanceMap.set(att.userId, att);
      }
    }

    const staffList = staffMembers.map((staff) => {
      const activeAtt = attendanceMap.get(staff.id) || null;
      return {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        userCode: staff.userCode,
        hasPin: staff.pinHash !== null,
        currentAttendance: activeAtt
          ? {
              id: activeAtt.id,
              clockIn: activeAtt.clockIn,
              clockOut: activeAtt.clockOut,
              durationMinutes: activeAtt.durationMinutes,
              lateMinutes: activeAtt.lateMinutes,
              status: activeAtt.status,
              notes: activeAtt.notes,
              isClockedIn: activeAtt.clockOut === null,
            }
          : null,
      };
    });

    return res.json({
      status: 'success',
      data: {
        workDate: todayStr,
        timezone,
        attendanceConfig: outlet.attendanceConfig,
        staff: staffList,
        attendances: todayAttendances,
      },
    });
  } catch (err: any) {
    console.error('[Attendance] getTodayAttendance error:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Gagal mengambil data absensi hari ini' });
  }
}

/**
 * 2. Catat Absen Masuk (Clock In)
 * POST /api/attendance/clock-in
 */
export async function clockIn(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Tenant context tidak valid' });
    }

    const { outletId, userId, pin, notes } = req.body;
    if (!outletId || !userId) {
      return res.status(400).json({ status: 'error', message: 'outletId dan userId wajib diisi' });
    }

    const outlet = await prisma.outlet.findFirst({
      where: { id: outletId, tenantId },
      select: { id: true, name: true, timezone: true, attendanceConfig: true },
    });
    if (!outlet) {
      return res.status(404).json({ status: 'error', message: 'Outlet tidak ditemukan' });
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId, isActive: true },
      select: { id: true, name: true, role: true, pinHash: true },
    });
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'Staf tidak ditemukan atau nonaktif' });
    }

    // Verifikasi PIN staf jika user memiliki PIN
    if (user.pinHash) {
      if (!pin || typeof pin !== 'string') {
        return res.status(401).json({ status: 'error', message: 'PIN 6-digit wajib dimasukkan' });
      }
      const isPinValid = await bcrypt.compare(pin.trim(), user.pinHash);
      if (!isPinValid) {
        return res.status(401).json({ status: 'error', message: 'PIN salah. Akses absensi ditolak.' });
      }
    }

    const timezone = outlet.timezone || 'Asia/Jakarta';
    const now = new Date();
    const workDate = toOutletDateStr(now, timezone);

    // Cek apakah staf sudah memiliki absen masuk aktif (tanpa clockOut) pada tanggal ini
    const activeAtt = await prisma.attendance.findFirst({
      where: {
        tenantId,
        outletId,
        userId,
        workDate,
        clockOut: null,
      },
    });

    if (activeAtt) {
      const inTimeStr = toOutletTimeStr(activeAtt.clockIn, timezone);
      return res.status(400).json({
        status: 'error',
        message: `Staf ${user.name} sudah melakukan absen masuk hari ini pukul ${inTimeStr}. Silakan lakukan absen pulang terlebih dahulu jika ingin berganti sesi.`,
      });
    }

    // Hitung status ketepatan waktu berdasarkan jadwal & toleransi
    let effectiveConfig = (outlet.attendanceConfig as AttendanceConfigDto) || null;

    // Cek apakah ada jadwal shift kerja di StaffWorkSchedule hari ini (workDate)
    const staffSchedule = await prisma.staffWorkSchedule.findUnique({
      where: {
        outletId_userId_scheduleDate: {
          outletId,
          userId,
          scheduleDate: workDate,
        },
      },
      include: {
        shiftTemplate: true,
      },
    });

    if (staffSchedule && !staffSchedule.isOffDay && staffSchedule.shiftTemplate && staffSchedule.shiftTemplate.isActive) {
      effectiveConfig = {
        standardClockIn: staffSchedule.shiftTemplate.startTime,
        standardClockOut: staffSchedule.shiftTemplate.endTime,
        lateToleranceMinutes: staffSchedule.shiftTemplate.graceMinutes,
      };
    }

    const { status, lateMinutes } = calculateLateStatus(now, timezone, effectiveConfig);

    const newAttendance = await prisma.attendance.create({
      data: {
        tenantId,
        outletId,
        userId,
        workDate,
        clockIn: now,
        status,
        lateMinutes,
        notes: notes ? String(notes).trim() : null,
      },
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    const clockInFormatted = toOutletTimeStr(now, timezone);
    const feedbackMsg =
      status === 'LATE'
        ? `Absen masuk berhasil (${clockInFormatted}). Terlambat ${lateMinutes} menit.`
        : `Absen masuk berhasil (${clockInFormatted}). Tepat waktu!`;

    return res.status(201).json({
      status: 'success',
      message: feedbackMsg,
      data: newAttendance,
    });
  } catch (err: any) {
    console.error('[Attendance] clockIn error:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Gagal mencatat absen masuk' });
  }
}

/**
 * 3. Catat Absen Pulang (Clock Out)
 * POST /api/attendance/clock-out
 */
export async function clockOut(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Tenant context tidak valid' });
    }

    const { outletId, userId, pin, notes } = req.body;
    if (!outletId || !userId) {
      return res.status(400).json({ status: 'error', message: 'outletId dan userId wajib diisi' });
    }

    const outlet = await prisma.outlet.findFirst({
      where: { id: outletId, tenantId },
      select: { id: true, name: true, timezone: true, attendanceConfig: true },
    });
    if (!outlet) {
      return res.status(404).json({ status: 'error', message: 'Outlet tidak ditemukan' });
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId, isActive: true },
      select: { id: true, name: true, role: true, pinHash: true },
    });
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'Staf tidak ditemukan atau nonaktif' });
    }

    // Verifikasi PIN
    if (user.pinHash) {
      if (!pin || typeof pin !== 'string') {
        return res.status(401).json({ status: 'error', message: 'PIN 6-digit wajib dimasukkan' });
      }
      const isPinValid = await bcrypt.compare(pin.trim(), user.pinHash);
      if (!isPinValid) {
        return res.status(401).json({ status: 'error', message: 'PIN salah. Akses absensi ditolak.' });
      }
    }

    const timezone = outlet.timezone || 'Asia/Jakarta';
    const now = new Date();
    const workDate = toOutletDateStr(now, timezone);

    // Cari absensi aktif yang belum clockOut (diutamakan hari ini, atau sesi sebelumnya dalam 24 jam)
    let activeAttendance = await prisma.attendance.findFirst({
      where: {
        tenantId,
        outletId,
        userId,
        workDate,
        clockOut: null,
      },
      orderBy: { clockIn: 'desc' },
    });

    if (!activeAttendance) {
      // Cari sesi terbuka dalam 24 jam terakhir (misal shift malam melewati jam 00:00)
      activeAttendance = await prisma.attendance.findFirst({
        where: {
          tenantId,
          outletId,
          userId,
          clockOut: null,
          clockIn: {
            gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { clockIn: 'desc' },
      });
    }

    if (!activeAttendance) {
      return res.status(400).json({
        status: 'error',
        message: `Tidak ditemukan riwayat absen masuk aktif untuk ${user.name}. Silakan absen masuk terlebih dahulu.`,
      });
    }

    // Hitung durasi kerja dalam menit
    const durationMinutes = Math.max(
      1,
      Math.round((now.getTime() - new Date(activeAttendance.clockIn).getTime()) / 60000)
    );

    // Periksa apakah pulang lebih awal (early leave) jika standardClockOut dikonfigurasi
    let newStatus = activeAttendance.status;
    const config = (outlet.attendanceConfig as AttendanceConfigDto) || null;
    if (config?.standardClockOut && newStatus === 'ON_TIME') {
      const [outHourStr, outMinStr] = config.standardClockOut.split(':');
      const outHour = parseInt(outHourStr, 10);
      const outMin = parseInt(outMinStr, 10);
      if (!isNaN(outHour) && !isNaN(outMin)) {
        const localTimeStr = toOutletTimeStr(now, timezone);
        const [curHourStr, curMinStr] = localTimeStr.split(':');
        const curMinutesTotal = parseInt(curHourStr, 10) * 60 + parseInt(curMinStr, 10);
        const stdOutMinutesTotal = outHour * 60 + outMin;
        if (curMinutesTotal < stdOutMinutesTotal) {
          newStatus = 'EARLY_LEAVE';
        }
      }
    }

    const updated = await prisma.attendance.update({
      where: { id: activeAttendance.id },
      data: {
        clockOut: now,
        durationMinutes,
        status: newStatus,
        notes: notes
          ? activeAttendance.notes
            ? `${activeAttendance.notes} | Pulang: ${notes}`
            : `Pulang: ${notes}`
          : activeAttendance.notes,
      },
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    const durStr = hours > 0 ? `${hours} jam ${mins} menit` : `${mins} menit`;
    const clockOutFormatted = toOutletTimeStr(now, timezone);

    return res.json({
      status: 'success',
      message: `Absen pulang berhasil (${clockOutFormatted}). Durasi kerja: ${durStr}.`,
      data: updated,
    });
  } catch (err: any) {
    console.error('[Attendance] clockOut error:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Gagal mencatat absen pulang' });
  }
}

/**
 * 4. Rekapitulasi Laporan Absensi Staf (Backoffice Merchant)
 * GET /api/attendance/report?outletId=...&startDate=...&endDate=...&page=1&limit=10
 */
export async function getAttendanceReport(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Tenant context tidak valid' });
    }

    const outletId = (req.query.outletId as string) || undefined;
    const userId = (req.query.userId as string) || undefined;
    const startDate = (req.query.startDate as string) || undefined;
    const endDate = (req.query.endDate as string) || undefined;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const skip = (page - 1) * limit;

    // Filter outlet
    let timezone = 'Asia/Jakarta';
    if (outletId) {
      const outlet = await prisma.outlet.findFirst({
        where: { id: outletId, tenantId },
        select: { timezone: true },
      });
      if (outlet?.timezone) timezone = outlet.timezone;
    }

    const where: any = { tenantId };
    if (outletId) where.outletId = outletId;
    if (userId) where.userId = userId;

    if (startDate && endDate) {
      where.workDate = {
        gte: startDate,
        lte: endDate,
      };
    } else if (startDate) {
      where.workDate = { gte: startDate };
    } else if (endDate) {
      where.workDate = { lte: endDate };
    }

    const [total, records, allMatchingForKpi] = await Promise.all([
      prisma.attendance.count({ where }),
      prisma.attendance.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, role: true, userCode: true },
          },
          outlet: {
            select: { id: true, name: true, timezone: true },
          },
        },
        orderBy: [{ workDate: 'desc' }, { clockIn: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.attendance.findMany({
        where,
        select: {
          status: true,
          lateMinutes: true,
          durationMinutes: true,
        },
      }),
    ]);

    // Hitung KPI ringkasan
    let onTimeCount = 0;
    let lateCount = 0;
    let earlyLeaveCount = 0;
    let totalDurationMinutes = 0;
    let totalLateMinutes = 0;

    for (const r of allMatchingForKpi) {
      if (r.status === 'ON_TIME') onTimeCount++;
      else if (r.status === 'LATE') lateCount++;
      else if (r.status === 'EARLY_LEAVE') earlyLeaveCount++;

      if (r.durationMinutes) totalDurationMinutes += r.durationMinutes;
      if (r.lateMinutes) totalLateMinutes += r.lateMinutes;
    }

    const avgLateMinutes = lateCount > 0 ? Math.round(totalLateMinutes / lateCount) : 0;
    const totalWorkingHours = Math.round((totalDurationMinutes / 60) * 10) / 10;

    return res.json({
      status: 'success',
      data: records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalRecords: total,
        onTimeCount,
        lateCount,
        earlyLeaveCount,
        totalWorkingHours,
        avgLateMinutes,
      },
    });
  } catch (err: any) {
    console.error('[Attendance] getAttendanceReport error:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Gagal mengambil rekapitulasi absensi' });
  }
}

/**
 * 5. Update Pengaturan Jadwal & Toleransi Kehadiran Outlet
 * PUT /api/attendance/config
 */
export async function updateAttendanceConfig(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Tenant context tidak valid' });
    }

    const { outletId, timezone, standardClockIn, standardClockOut, lateToleranceMinutes } = req.body;
    if (!outletId) {
      return res.status(400).json({ status: 'error', message: 'outletId wajib diisi' });
    }

    const outlet = await prisma.outlet.findFirst({
      where: { id: outletId, tenantId },
    });
    if (!outlet) {
      return res.status(404).json({ status: 'error', message: 'Outlet tidak ditemukan' });
    }

    const newConfig: AttendanceConfigDto = {
      standardClockIn: standardClockIn || undefined,
      standardClockOut: standardClockOut || undefined,
      lateToleranceMinutes:
        lateToleranceMinutes !== undefined ? Math.max(0, parseInt(lateToleranceMinutes, 10)) : 15,
    };

    const updateData: any = {
      attendanceConfig: newConfig as any,
    };

    if (timezone && typeof timezone === 'string' && timezone.trim()) {
      updateData.timezone = timezone.trim();
    }

    const updated = await prisma.outlet.update({
      where: { id: outletId },
      data: updateData,
      select: {
        id: true,
        name: true,
        timezone: true,
        attendanceConfig: true,
      },
    });

    return res.json({
      status: 'success',
      message: 'Pengaturan toleransi kehadiran berhasil diperbarui',
      data: updated,
    });
  } catch (err: any) {
    console.error('[Attendance] updateAttendanceConfig error:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Gagal memperbarui pengaturan absensi' });
  }
}

/**
 * 6. Sinkronisasi Zona Waktu Otomatis Tanpa Ribet (Zero Configuration)
 * POST /api/attendance/sync-timezone
 * Dipanggil otomatis oleh frontend POS saat inisialisasi / buka kasir.
 */
export async function autoSyncTimezone(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Tenant context tidak valid' });
    }

    const { outletId, clientTimezone } = req.body;
    if (!outletId || !clientTimezone) {
      return res.status(400).json({ status: 'error', message: 'outletId dan clientTimezone wajib diisi' });
    }

    // Validasi nama IANA timezone
    try {
      Intl.DateTimeFormat(undefined, { timeZone: clientTimezone });
    } catch {
      return res.status(400).json({ status: 'error', message: 'Format clientTimezone tidak valid' });
    }

    const outlet = await prisma.outlet.findFirst({
      where: { id: outletId, tenantId },
      select: { id: true, timezone: true },
    });

    if (!outlet) {
      return res.status(404).json({ status: 'error', message: 'Outlet tidak ditemukan' });
    }

    // Jika timezone outlet belum diset atau berbeda, perbarui secara mulus
    if (outlet.timezone !== clientTimezone) {
      await prisma.outlet.update({
        where: { id: outletId },
        data: { timezone: clientTimezone },
      });

      return res.json({
        status: 'success',
        synced: true,
        timezone: clientTimezone,
        message: `Zona waktu outlet disinkronkan otomatis ke ${clientTimezone}`,
      });
    }

    return res.json({
      status: 'success',
      synced: false,
      timezone: outlet.timezone,
      message: 'Zona waktu sudah sesuai',
    });
  } catch (err: any) {
    console.error('[Attendance] autoSyncTimezone error:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Gagal sinkronisasi zona waktu' });
  }
}

// ==========================================
// 6. MANAJEMEN MASTER TEMPLATE SHIFT KERJA (FASE B)
// ==========================================

export async function getWorkShiftTemplates(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Tenant context tidak valid' });
    }

    const outletId = (req.query.outletId as string) || req.user?.outletId;
    if (!outletId) {
      return res.status(400).json({ status: 'error', message: 'outletId diperlukan' });
    }

    let templates = await prisma.workShiftTemplate.findMany({
      where: { tenantId, outletId, isActive: true },
      orderBy: { startTime: 'asc' },
    });

    // Auto-seed 3 template default jika outlet belum memiliki template
    if (templates.length === 0) {
      const defaultTemplates = [
        {
          tenantId,
          outletId,
          name: 'Shift Pagi',
          startTime: '07:00',
          endTime: '15:00',
          isOffDay: false,
          colorHex: '#2563EB',
          graceMinutes: 10,
          isActive: true,
        },
        {
          tenantId,
          outletId,
          name: 'Shift Siang',
          startTime: '14:00',
          endTime: '22:00',
          isOffDay: false,
          colorHex: '#D97706',
          graceMinutes: 10,
          isActive: true,
        },
        {
          tenantId,
          outletId,
          name: 'Full Day',
          startTime: '08:00',
          endTime: '17:00',
          isOffDay: false,
          colorHex: '#059669',
          graceMinutes: 15,
          isActive: true,
        },
      ];

      await prisma.workShiftTemplate.createMany({
        data: defaultTemplates,
      });

      templates = await prisma.workShiftTemplate.findMany({
        where: { tenantId, outletId, isActive: true },
        orderBy: { startTime: 'asc' },
      });
    }

    return res.status(200).json({ status: 'success', data: templates });
  } catch (err: any) {
    console.error('[Attendance] getWorkShiftTemplates error:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Gagal mengambil template shift' });
  }
}

export async function createWorkShiftTemplate(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    const userRole = req.user?.role;
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Tenant context tidak valid' });
    }

    if (userRole !== Role.OWNER && userRole !== Role.ADMIN && userRole !== Role.SUPERVISOR) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak: Hanya Owner, Admin, atau Supervisor yang dapat membuat template shift',
      });
    }

    const { outletId, name, startTime, endTime, isOffDay, colorHex, graceMinutes } = req.body;
    if (!outletId || !name || !startTime || !endTime) {
      return res.status(400).json({
        status: 'error',
        message: 'outletId, name, startTime, dan endTime wajib diisi',
      });
    }

    if (graceMinutes !== undefined && graceMinutes !== null && (isNaN(Number(graceMinutes)) || Number(graceMinutes) < 0)) {
      return res.status(400).json({ status: 'error', message: 'Toleransi keterlambatan tidak boleh negatif' });
    }

    const template = await prisma.workShiftTemplate.create({
      data: {
        tenantId,
        outletId,
        name: String(name).trim(),
        startTime: String(startTime).trim(),
        endTime: String(endTime).trim(),
        isOffDay: !!isOffDay,
        colorHex: colorHex ? String(colorHex).trim() : '#1E3A8A',
        graceMinutes: graceMinutes !== undefined ? Number(graceMinutes) : 10,
        isActive: true,
      },
    });

    return res.status(201).json({
      status: 'success',
      message: 'Template shift berhasil dibuat',
      data: template,
    });
  } catch (err: any) {
    console.error('[Attendance] createWorkShiftTemplate error:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Gagal membuat template shift' });
  }
}

export async function updateWorkShiftTemplate(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    const userRole = req.user?.role;
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Tenant context tidak valid' });
    }

    if (userRole !== Role.OWNER && userRole !== Role.ADMIN && userRole !== Role.SUPERVISOR) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak: Hanya Owner, Admin, atau Supervisor yang dapat memperbarui template shift',
      });
    }

    const { id } = req.params;
    const { name, startTime, endTime, isOffDay, colorHex, graceMinutes, isActive } = req.body;

    if (graceMinutes !== undefined && graceMinutes !== null && (isNaN(Number(graceMinutes)) || Number(graceMinutes) < 0)) {
      return res.status(400).json({ status: 'error', message: 'Toleransi keterlambatan tidak boleh negatif' });
    }

    const existing = await prisma.workShiftTemplate.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Template shift tidak ditemukan' });
    }

    const updateData: any = {};
    if (name) updateData.name = String(name).trim();
    if (startTime) updateData.startTime = String(startTime).trim();
    if (endTime) updateData.endTime = String(endTime).trim();
    if (isOffDay !== undefined) updateData.isOffDay = !!isOffDay;
    if (colorHex) updateData.colorHex = String(colorHex).trim();
    if (graceMinutes !== undefined) updateData.graceMinutes = Number(graceMinutes);
    if (isActive !== undefined) updateData.isActive = !!isActive;

    const updated = await prisma.workShiftTemplate.update({
      where: { id },
      data: updateData,
    });

    return res.status(200).json({
      status: 'success',
      message: 'Template shift berhasil diperbarui',
      data: updated,
    });
  } catch (err: any) {
    console.error('[Attendance] updateWorkShiftTemplate error:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Gagal memperbarui template shift' });
  }
}

export async function deleteWorkShiftTemplate(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    const userRole = req.user?.role;
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Tenant context tidak valid' });
    }

    if (userRole !== Role.OWNER && userRole !== Role.ADMIN && userRole !== Role.SUPERVISOR) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak: Hanya Owner, Admin, atau Supervisor yang dapat menghapus template shift',
      });
    }

    const { id } = req.params;

    const existing = await prisma.workShiftTemplate.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      return res.status(404).json({ status: 'error', message: 'Template shift tidak ditemukan' });
    }

    // Cek apakah template sudah dipakai di StaffWorkSchedule
    const usageCount = await prisma.staffWorkSchedule.count({
      where: { shiftTemplateId: id },
    });

    if (usageCount > 0) {
      // Soft-deactivate agar tidak merusak data histori
      await prisma.workShiftTemplate.update({
        where: { id },
        data: { isActive: false },
      });
      return res.status(200).json({
        status: 'success',
        message: 'Template dinonaktifkan karena telah terhubung dengan jadwal karyawan',
      });
    } else {
      await prisma.workShiftTemplate.delete({
        where: { id },
      });
      return res.status(200).json({
        status: 'success',
        message: 'Template shift berhasil dihapus permanen',
      });
    }
  } catch (err: any) {
    console.error('[Attendance] deleteWorkShiftTemplate error:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Gagal menghapus template shift' });
  }
}

// ==========================================
// 7. MANAJEMEN ROSTER JADWAL KERJA KARYAWAN (FASE B)
// ==========================================

export async function getStaffWorkSchedules(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    const userRole = req.user?.role;
    const userId = req.user?.id;
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Tenant context tidak valid' });
    }

    const { outletId, startDate, endDate } = req.query;
    if (!outletId || !startDate || !endDate) {
      return res.status(400).json({
        status: 'error',
        message: 'outletId, startDate, dan endDate wajib diisi (format YYYY-MM-DD)',
      });
    }

    const where: any = {
      tenantId,
      outletId: String(outletId),
      scheduleDate: {
        gte: String(startDate).slice(0, 10),
        lte: String(endDate).slice(0, 10),
      },
    };

    // Role Isolation: CASHIER & PRODUCTION/KITCHEN hanya melihat jadwal miliknya sendiri
    if (userRole === Role.CASHIER || userRole === Role.KITCHEN || (userRole as any) === 'PRODUCTION') {
      where.userId = userId;
    } else if (req.query.userId && typeof req.query.userId === 'string') {
      where.userId = req.query.userId;
    }

    const schedules = await prisma.staffWorkSchedule.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, role: true, userCode: true },
        },
        shiftTemplate: true,
      },
      orderBy: [{ scheduleDate: 'asc' }, { userId: 'asc' }],
    });

    return res.status(200).json({
      status: 'success',
      data: schedules,
    });
  } catch (err: any) {
    console.error('[Attendance] getStaffWorkSchedules error:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Gagal mengambil jadwal kerja staf' });
  }
}

export async function bulkUpsertStaffWorkSchedules(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    const userRole = req.user?.role;
    const createdById = req.user?.id;
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Tenant context tidak valid' });
    }

    if (userRole !== Role.OWNER && userRole !== Role.ADMIN && userRole !== Role.SUPERVISOR) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak: Hanya Owner, Admin, atau Supervisor yang dapat mengatur jadwal kerja',
      });
    }

    const { outletId, schedules } = req.body;
    if (!outletId || !Array.isArray(schedules)) {
      return res.status(400).json({
        status: 'error',
        message: 'outletId dan schedules array wajib diisi',
      });
    }

    const results = await Promise.all(
      schedules.map(async (s: any) => {
        const scheduleDate = String(s.scheduleDate).slice(0, 10);
        return prisma.staffWorkSchedule.upsert({
          where: {
            outletId_userId_scheduleDate: {
              outletId,
              userId: s.userId,
              scheduleDate,
            },
          },
          create: {
            tenantId,
            outletId,
            userId: s.userId,
            scheduleDate,
            shiftTemplateId: s.shiftTemplateId || null,
            isOffDay: !!s.isOffDay,
            notes: s.notes ? String(s.notes).trim() : null,
            createdById,
          },
          update: {
            shiftTemplateId: s.shiftTemplateId || null,
            isOffDay: !!s.isOffDay,
            notes: s.notes ? String(s.notes).trim() : null,
          },
          include: {
            user: { select: { id: true, name: true, role: true } },
            shiftTemplate: true,
          },
        });
      })
    );

    return res.status(200).json({
      status: 'success',
      message: `Berhasil menyimpan ${results.length} jadwal kerja`,
      data: results,
    });
  } catch (err: any) {
    console.error('[Attendance] bulkUpsertStaffWorkSchedules error:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Gagal menyimpan jadwal kerja' });
  }
}

export async function autoGenerateStaffWorkSchedules(req: Request, res: Response) {
  try {
    const tenantId = req.user?.tenantId;
    const userRole = req.user?.role;
    const createdById = req.user?.id;
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Tenant context tidak valid' });
    }

    if (userRole !== Role.OWNER && userRole !== Role.ADMIN && userRole !== Role.SUPERVISOR) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak: Hanya Owner, Admin, atau Supervisor yang dapat melakukan auto-penjadwalan',
      });
    }

    const {
      outletId,
      startDate,
      endDate,
      shiftTemplateIds,
      minStaffPerShift = 1,
      offDaysPerWeek = 1,
      staffIds,
      userIds,
      overwriteExisting = false,
    } = req.body;

    if (!outletId || !startDate || !endDate) {
      return res.status(400).json({
        status: 'error',
        message: 'outletId, startDate, dan endDate wajib diisi',
      });
    }

    const targetStaffIds = Array.isArray(staffIds)
      ? staffIds
      : Array.isArray(userIds)
      ? userIds
      : null;

    // 1. Ambil staf aktif
    const staffWhere: any = {
      tenantId,
      isActive: true,
      OR: [{ outletId }, { outletId: null }],
    };
    if (targetStaffIds && targetStaffIds.length > 0) {
      staffWhere.id = { in: targetStaffIds };
    }
    const staffMembers = await prisma.user.findMany({
      where: staffWhere,
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });

    if (staffMembers.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Tidak ada staf aktif yang ditemukan untuk dijadwalkan di outlet ini',
      });
    }

    // 2. Ambil template shift
    const templateWhere: any = {
      tenantId,
      outletId,
      isActive: true,
    };
    if (Array.isArray(shiftTemplateIds) && shiftTemplateIds.length > 0) {
      templateWhere.id = { in: shiftTemplateIds };
    }
    const templates = await prisma.workShiftTemplate.findMany({
      where: templateWhere,
      orderBy: { startTime: 'asc' },
    });

    if (templates.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Tidak ada template shift aktif yang dipilih',
      });
    }

    // 3. Bangun array tanggal YYYY-MM-DD
    const start = new Date(`${String(startDate).slice(0, 10)}T00:00:00Z`);
    const end = new Date(`${String(endDate).slice(0, 10)}T00:00:00Z`);
    if (start > end) {
      return res.status(400).json({ status: 'error', message: 'startDate tidak boleh lebih besar dari endDate' });
    }

    const dateList: string[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      dateList.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    // 4. Cek jadwal eksisting jika overwriteExisting === false
    const existingMap = new Set<string>();
    if (!overwriteExisting) {
      const existing = await prisma.staffWorkSchedule.findMany({
        where: {
          tenantId,
          outletId,
          scheduleDate: { gte: dateList[0], lte: dateList[dateList.length - 1] },
        },
        select: { userId: true, scheduleDate: true },
      });
      existing.forEach((e) => existingMap.add(`${e.userId}_${e.scheduleDate}`));
    }

    // 5. Algoritma Penjadwalan Adil
    const numTemplates = templates.length;
    const targetOffDays = Math.max(0, Math.min(6, Number(offDaysPerWeek) || 1));

    // Lacak shift terakhir per staf untuk mencegah penugasan shift pagi tepat setelah shift sore/malam
    const lastAssignedTemplate = new Map<string, any>();
    const staffShiftCount = new Map<string, number>();
    const staffOffCount = new Map<string, number>();
    staffMembers.forEach((s) => {
      staffShiftCount.set(s.id, 0);
      staffOffCount.set(s.id, 0);
    });

    const generatedItems: any[] = [];

    // Pecah rentang tanggal ke dalam blok mingguan (7 hari)
    for (let w = 0; w < dateList.length; w += 7) {
      const weekDates = dateList.slice(w, w + 7);

      // Tentukan hari libur bergilir untuk tiap staf pada blok 7 hari ini
      const staffOffDaysInWeek = new Map<string, Set<number>>();
      staffMembers.forEach((staff, staffIdx) => {
        const offDaysSet = new Set<number>();
        for (let o = 0; o < targetOffDays; o++) {
          const dayIdx = (staffIdx * 2 + o * 3 + Math.floor(w / 7)) % weekDates.length;
          offDaysSet.add(dayIdx);
        }
        staffOffDaysInWeek.set(staff.id, offDaysSet);
      });

      for (let dayIdx = 0; dayIdx < weekDates.length; dayIdx++) {
        const dateStr = weekDates[dayIdx];

        // Pisahkan staf yang libur dan yang kerja hari ini
        const workingStaff: typeof staffMembers = [];
        staffMembers.forEach((staff) => {
          const isOff = staffOffDaysInWeek.get(staff.id)?.has(dayIdx);
          if (isOff) {
            if (overwriteExisting || !existingMap.has(`${staff.id}_${dateStr}`)) {
              generatedItems.push({
                tenantId,
                outletId,
                userId: staff.id,
                scheduleDate: dateStr,
                shiftTemplateId: null,
                isOffDay: true,
                notes: 'Libur Rutin Mingguan',
                createdById,
              });
              staffOffCount.set(staff.id, (staffOffCount.get(staff.id) || 0) + 1);
            }
          } else {
            workingStaff.push(staff);
          }
        });

        // Distribusikan shift secara merata di antara workingStaff
        workingStaff.sort((a, b) => (staffShiftCount.get(a.id) || 0) - (staffShiftCount.get(b.id) || 0));

        let templateIdx = (dayIdx + Math.floor(w / 7)) % numTemplates;

        for (const staff of workingStaff) {
          if (!overwriteExisting && existingMap.has(`${staff.id}_${dateStr}`)) {
            continue;
          }

          let chosenTemplate = templates[templateIdx % numTemplates];

          // Hindari shift pagi (e.g. startTime <= 08:00) jika kemarin shift malam (e.g. endTime >= 21:00)
          const prevTemplate = lastAssignedTemplate.get(staff.id);
          if (prevTemplate && prevTemplate.endTime >= '21:00' && chosenTemplate.startTime <= '08:00' && numTemplates > 1) {
            chosenTemplate = templates[(templateIdx + 1) % numTemplates];
          }

          generatedItems.push({
            tenantId,
            outletId,
            userId: staff.id,
            scheduleDate: dateStr,
            shiftTemplateId: chosenTemplate.id,
            isOffDay: false,
            notes: null,
            createdById,
          });

          lastAssignedTemplate.set(staff.id, chosenTemplate);
          staffShiftCount.set(staff.id, (staffShiftCount.get(staff.id) || 0) + 1);
          templateIdx++;
        }
      }
    }

    // 6. Eksekusi penyimpanan ke database via upsert
    const savedSchedules = await Promise.all(
      generatedItems.map(async (item) => {
        return prisma.staffWorkSchedule.upsert({
          where: {
            outletId_userId_scheduleDate: {
              outletId: item.outletId,
              userId: item.userId,
              scheduleDate: item.scheduleDate,
            },
          },
          create: item,
          update: {
            shiftTemplateId: item.shiftTemplateId,
            isOffDay: item.isOffDay,
            notes: item.notes,
          },
          include: {
            user: { select: { id: true, name: true, role: true } },
            shiftTemplate: true,
          },
        });
      })
    );

    const summary = staffMembers.map((staff) => ({
      userId: staff.id,
      name: staff.name,
      role: staff.role,
      totalShifts: staffShiftCount.get(staff.id) || 0,
      totalOffDays: staffOffCount.get(staff.id) || 0,
    }));

    return res.status(200).json({
      status: 'success',
      message: `Berhasil membuat ${savedSchedules.length} jadwal kerja otomatis`,
      data: {
        summary,
        count: savedSchedules.length,
        createdCount: savedSchedules.length,
        schedules: savedSchedules,
      },
    });
  } catch (err: any) {
    console.error('[Attendance] autoGenerateStaffWorkSchedules error:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Gagal generate jadwal kerja otomatis' });
  }
}
