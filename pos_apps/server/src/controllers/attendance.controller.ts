import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
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
    const config = (outlet.attendanceConfig as AttendanceConfigDto) || null;
    const { status, lateMinutes } = calculateLateStatus(now, timezone, config);

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
