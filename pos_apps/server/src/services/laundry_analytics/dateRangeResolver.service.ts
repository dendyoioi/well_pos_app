/**
 * Date-Preset & Timezone Windowing Resolver Service
 * Laundry Outlet Performance Intelligence (Well POS)
 * 
 * Menerjemahkan 8 preset tanggal ('today', 'yesterday', 'this_week', '7days',
 * 'month', 'last_month', 'year', 'custom') ke window ISO/Date deterministik
 * dengan zona waktu outlet (default: 'Asia/Jakarta' / WIB UTC+7).
 */

export type AnalyticsDatePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | '7days'
  | 'month'
  | 'last_month'
  | 'year'
  | 'custom';

export interface ResolveDateRangeParams {
  preset?: string;
  startDate?: string;
  endDate?: string;
  timezone?: string;
}

export interface ResolvedDateRange {
  startDate: Date;         // UTC timestamp awal rentang
  endDate: Date;           // UTC timestamp akhir rentang
  prevStartDate: Date;     // UTC timestamp awal rentang komparasi
  prevEndDate: Date;       // UTC timestamp akhir rentang komparasi
  previousStartDate: Date; // Kompatibilitas alias
  previousEndDate: Date;   // Kompatibilitas alias
  daysCount: number;       // Jumlah hari efektif
  preset: AnalyticsDatePreset;
  timezone: string;
  label: string;
  formattedRange: {
    start: string;         // 'YYYY-MM-DD'
    end: string;           // 'YYYY-MM-DD'
    prevStart: string;     // 'YYYY-MM-DD'
    prevEnd: string;       // 'YYYY-MM-DD'
  };
}

export interface PercentChangeResult {
  diff: number;
  percent: number;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
}

const pad = (n: number): string => String(n).padStart(2, '0');

function formatDateStr(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function parseDateStr(str: string): { year: number; month: number; day: number } {
  const [y, m, d] = str.split('-').map(Number);
  return { year: y, month: m, day: d };
}

function addDaysToDateStr(dateStr: string, days: number): string {
  const { year, month, day } = parseDateStr(dateStr);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function getDaysBetween(startStr: string, endStr: string): number {
  const { year: y1, month: m1, day: d1 } = parseDateStr(startStr);
  const { year: y2, month: m2, day: d2 } = parseDateStr(endStr);
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24)) + 1;
}

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Mengambil komponen tanggal (tahun, bulan 1-12, hari 1-31, hari dlm minggu)
 * berdasarkan zona waktu target.
 */
function getZonedDateParts(date: Date, timezone: string): {
  year: number;
  month: number;
  day: number;
  dayOfWeek: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
  const parts = formatter.formatToParts(date);
  let year = 2026;
  let month = 1;
  let day = 1;
  let weekdayStr = 'Sun';
  for (const p of parts) {
    if (p.type === 'year') year = parseInt(p.value, 10);
    if (p.type === 'month') month = parseInt(p.value, 10);
    if (p.type === 'day') day = parseInt(p.value, 10);
    if (p.type === 'weekday') weekdayStr = p.value;
  }
  const weekdays: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return { year, month, day, dayOfWeek: weekdays[weekdayStr] ?? 0 };
}

/**
 * Menghasilkan string offset ISO seperti '+07:00' untuk timezone target
 */
function getTimeZoneOffset(timezone: string, refDate: Date = new Date()): string {
  if (timezone === 'Asia/Jakarta' || timezone === 'WIB') {
    return '+07:00';
  }
  try {
    const tzStr = refDate.toLocaleString('en-US', { timeZone: timezone, timeZoneName: 'shortOffset' });
    const match = tzStr.match(/GMT([+-]\d{1,2}(?::\d{2})?)/);
    if (match) {
      const gmtPart = match[1];
      const sign = gmtPart[0];
      const parts = gmtPart.slice(1).split(':');
      const hours = parts[0].padStart(2, '0');
      const mins = (parts[1] || '00').padStart(2, '0');
      return `${sign}${hours}:${mins}`;
    }
  } catch {
    // Fallback default Asia/Jakarta
  }
  return '+07:00';
}

/**
 * Resolver utama untuk menerjemahkan preset rentang tanggal ke objek rentang UTC
 */
export function resolveAnalyticsDateRange(
  params: ResolveDateRangeParams = {},
  defaultTimezone = 'Asia/Jakarta',
  referenceNow: Date = new Date()
): ResolvedDateRange {
  const timezone = params.timezone || defaultTimezone;
  const tzOffset = getTimeZoneOffset(timezone, referenceNow);

  const rawPreset = (params.preset || 'month').toLowerCase().trim();
  const validPresets: AnalyticsDatePreset[] = [
    'today',
    'yesterday',
    'this_week',
    '7days',
    'month',
    'last_month',
    'year',
    'custom',
  ];

  let preset: AnalyticsDatePreset = validPresets.includes(rawPreset as AnalyticsDatePreset)
    ? (rawPreset as AnalyticsDatePreset)
    : 'month';

  // Jika user menyertakan startDate & endDate tetapi preset bukan 'custom', otomatis set ke 'custom'
  if (params.startDate && params.endDate && (!params.preset || params.preset === 'custom')) {
    preset = 'custom';
  }

  const { year, month, day, dayOfWeek } = getZonedDateParts(referenceNow, timezone);
  const todayStr = formatDateStr(year, month, day);

  let startStr = '';
  let endStr = '';
  let prevStartStr = '';
  let prevEndStr = '';
  let daysCount = 1;
  let label = '';

  switch (preset) {
    case 'today': {
      startStr = todayStr;
      endStr = todayStr;
      daysCount = 1;
      prevEndStr = addDaysToDateStr(todayStr, -1);
      prevStartStr = prevEndStr;
      label = 'Hari Ini';
      break;
    }

    case 'yesterday': {
      const yesterdayStr = addDaysToDateStr(todayStr, -1);
      startStr = yesterdayStr;
      endStr = yesterdayStr;
      daysCount = 1;
      prevEndStr = addDaysToDateStr(yesterdayStr, -1);
      prevStartStr = prevEndStr;
      label = 'Kemarin';
      break;
    }

    case 'this_week': {
      // Senin (1) s.d. Minggu (7)
      const dayOfWeekNum = dayOfWeek === 0 ? 7 : dayOfWeek; // Konversi Minggu 0 -> 7
      const mondayStr = addDaysToDateStr(todayStr, 1 - dayOfWeekNum);
      const sundayStr = addDaysToDateStr(mondayStr, 6);

      startStr = mondayStr;
      endStr = sundayStr;
      daysCount = 7;
      prevStartStr = addDaysToDateStr(mondayStr, -7);
      prevEndStr = addDaysToDateStr(sundayStr, -7);
      label = 'Minggu Ini';
      break;
    }

    case '7days': {
      // 7 hari terakhir (T-6 s.d. T)
      startStr = addDaysToDateStr(todayStr, -6);
      endStr = todayStr;
      daysCount = 7;
      prevEndStr = addDaysToDateStr(startStr, -1);
      prevStartStr = addDaysToDateStr(prevEndStr, -6);
      label = '7 Hari Terakhir';
      break;
    }

    case 'month': {
      // 1 s.d. akhir bulan kalender berjalan
      const lastDay = getLastDayOfMonth(year, month);
      startStr = formatDateStr(year, month, 1);
      endStr = formatDateStr(year, month, lastDay);
      daysCount = lastDay;

      // Komparasi kalender bulan sebelumnya (misal 1-30 Nov -> 1-31 Okt)
      const prevYear = month === 1 ? year - 1 : year;
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevLastDay = getLastDayOfMonth(prevYear, prevMonth);

      prevStartStr = formatDateStr(prevYear, prevMonth, 1);
      prevEndStr = formatDateStr(prevYear, prevMonth, prevLastDay);
      label = 'Bulan Ini';
      break;
    }

    case 'last_month': {
      // 1 s.d. akhir bulan lalu
      const lastMonthYear = month === 1 ? year - 1 : year;
      const lastMonthMonth = month === 1 ? 12 : month - 1;
      const lastMonthLastDay = getLastDayOfMonth(lastMonthYear, lastMonthMonth);

      startStr = formatDateStr(lastMonthYear, lastMonthMonth, 1);
      endStr = formatDateStr(lastMonthYear, lastMonthMonth, lastMonthLastDay);
      daysCount = lastMonthLastDay;

      // Komparasi kalender 2 bulan lalu (misal 1-31 Okt -> 1-30 Sep)
      const twoMonthsAgoYear = lastMonthMonth === 1 ? lastMonthYear - 1 : lastMonthYear;
      const twoMonthsAgoMonth = lastMonthMonth === 1 ? 12 : lastMonthMonth - 1;
      const twoMonthsAgoLastDay = getLastDayOfMonth(twoMonthsAgoYear, twoMonthsAgoMonth);

      prevStartStr = formatDateStr(twoMonthsAgoYear, twoMonthsAgoMonth, 1);
      prevEndStr = formatDateStr(twoMonthsAgoYear, twoMonthsAgoMonth, twoMonthsAgoLastDay);
      label = 'Bulan Lalu';
      break;
    }

    case 'year': {
      // 1 Jan s.d. 31 Des tahun berjalan
      startStr = `${year}-01-01`;
      endStr = `${year}-12-31`;
      daysCount = isLeapYear(year) ? 366 : 365;

      // Komparasi tahun sebelumnya
      prevStartStr = `${year - 1}-01-01`;
      prevEndStr = `${year - 1}-12-31`;
      label = 'Tahun Ini';
      break;
    }

    case 'custom': {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!params.startDate || !dateRegex.test(params.startDate)) {
        const err: any = new Error('Format startDate custom tidak valid. Gunakan format YYYY-MM-DD');
        err.statusCode = 400;
        throw err;
      }
      if (!params.endDate || !dateRegex.test(params.endDate)) {
        const err: any = new Error('Format endDate custom tidak valid. Gunakan format YYYY-MM-DD');
        err.statusCode = 400;
        throw err;
      }

      // Validasi kalender
      const { year: sy, month: sm, day: sd } = parseDateStr(params.startDate);
      const { year: ey, month: em, day: ed } = parseDateStr(params.endDate);

      const isValidStartDate =
        sm >= 1 && sm <= 12 && sd >= 1 && sd <= getLastDayOfMonth(sy, sm);
      const isValidEndDate =
        em >= 1 && em <= 12 && ed >= 1 && ed <= getLastDayOfMonth(ey, em);

      if (!isValidStartDate || !isValidEndDate) {
        const err: any = new Error('Tanggal custom berada di luar batas kalender valid');
        err.statusCode = 400;
        throw err;
      }

      if (params.startDate > params.endDate) {
        const err: any = new Error('startDate tidak boleh lebih besar dari endDate');
        err.statusCode = 400;
        throw err;
      }

      startStr = params.startDate;
      endStr = params.endDate;
      daysCount = getDaysBetween(startStr, endStr);

      // Periode komparasi dengan panjang hari persis sama:
      // prevEndDate = startDate - 1 hari
      // prevStartDate = prevEndDate - (daysCount - 1) hari
      prevEndStr = addDaysToDateStr(startStr, -1);
      prevStartStr = addDaysToDateStr(prevEndStr, -(daysCount - 1));
      label = `Kustom (${startStr} s/d ${endStr})`;
      break;
    }
  }

  // Bangun Date object UTC yang merepresentasikan batas hari zona waktu lokal
  const startDate = new Date(`${startStr}T00:00:00.000${tzOffset}`);
  const endDate = new Date(`${endStr}T23:59:59.999${tzOffset}`);
  const prevStartDate = new Date(`${prevStartStr}T00:00:00.000${tzOffset}`);
  const prevEndDate = new Date(`${prevEndStr}T23:59:59.999${tzOffset}`);

  return {
    startDate,
    endDate,
    prevStartDate,
    prevEndDate,
    previousStartDate: prevStartDate,
    previousEndDate: prevEndDate,
    daysCount,
    preset,
    timezone,
    label,
    formattedRange: {
      start: startStr,
      end: endStr,
      prevStart: prevStartStr,
      prevEnd: prevEndStr,
    },
  };
}

/**
 * Menghitung selisih dan persentase perubahan antara periode berjalan dan komparasi
 */
export function calculatePercentChange(
  currentValue: number,
  previousValue: number
): PercentChangeResult {
  const curr = Number(currentValue) || 0;
  const prev = Number(previousValue) || 0;
  const diff = Number((curr - prev).toFixed(2));

  if (prev === 0) {
    if (curr > 0) {
      return { diff, percent: 100, direction: 'UP' };
    }
    if (curr < 0) {
      return { diff, percent: -100, direction: 'DOWN' };
    }
    return { diff: 0, percent: 0, direction: 'NEUTRAL' };
  }

  const percent = Number(((diff / Math.abs(prev)) * 100).toFixed(2));
  const direction: 'UP' | 'DOWN' | 'NEUTRAL' =
    percent > 0 ? 'UP' : percent < 0 ? 'DOWN' : 'NEUTRAL';

  return { diff, percent, direction };
}
