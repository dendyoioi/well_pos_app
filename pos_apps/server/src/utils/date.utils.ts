/**
 * Date & Timezone Utilities
 * Standarisasi parsing rentang tanggal dan zona waktu Indonesia (WIB / Asia/Jakarta UTC+7)
 * untuk menjamin paritas 100% konsisten antara SQL query backend dan antarmuka frontend.
 */

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7

/**
 * Mengonversi objek Date ke string YYYY-MM-DD dalam zona waktu WIB (UTC+7).
 * WAJIB digunakan sebagai pengganti `d.toISOString().slice(0, 10)` pada server
 * yang berjalan di UTC agar tidak terjadi pergeseran tanggal pada 17:00-23:59 UTC
 * (setara 00:00-06:59 WIB hari berikutnya).
 */
export function toWibDateStr(d: Date = new Date()): string {
  const wib = new Date(d.getTime() + WIB_OFFSET_MS);
  return wib.toISOString().slice(0, 10);
}

/**
 * Mengonversi objek Date ke string 'YYYY-MM-DD' sesuai zona waktu outlet spesifik
 * (e.g. 'Asia/Jakarta' [WIB], 'Asia/Makassar' [WITA], 'Asia/Jayapura' [WIT]).
 */
export function toOutletDateStr(d: Date = new Date(), timeZone: string = 'Asia/Jakarta'): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return toWibDateStr(d);
  }
}

/**
 * Mengonversi objek Date ke string jam 'HH:mm' atau 'HH:mm:ss' sesuai zona waktu outlet.
 */
export function toOutletTimeStr(d: Date = new Date(), timeZone: string = 'Asia/Jakarta', withSeconds = false): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: withSeconds ? '2-digit' : undefined,
      hour12: false,
    }).format(d);
  } catch {
    return d.toTimeString().slice(0, withSeconds ? 8 : 5);
  }
}

/**
 * Mendapatkan ISO offset string (misal: '+07:00', '+08:00', '+09:00') dari IANA timezone.
 */
export function getTimezoneOffsetStr(timeZone: string = 'Asia/Jakarta'): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'longOffset',
    }).formatToParts(new Date());
    const offsetPart = parts.find((p) => p.type === 'timeZoneName');
    if (offsetPart && offsetPart.value.startsWith('GMT')) {
      const val = offsetPart.value.replace('GMT', '');
      return val === '' ? '+00:00' : val;
    }
  } catch {
    // default WIB
  }
  return '+07:00';
}

/**
 * Mengonversi tanggal input (string 'YYYY-MM-DD' atau ISO) ke objek Date
 * dengan batas waktu awal hari (00:00:00.000) atau akhir hari (23:59:59.999) sesuai zona waktu.
 */
export function parseDateBoundary(dateStr?: string, isEnd: boolean = false, timeZone: string = 'Asia/Jakarta'): Date {
  const offset = getTimezoneOffsetStr(timeZone);
  if (!dateStr || dateStr.trim() === '') {
    const now = new Date();
    if (isEnd) {
      return now;
    } else {
      // Default 30 hari yang lalu
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  const trimmed = dateStr.trim();
  // Jika format tanggal sederhana YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const timeSuffix = isEnd ? `23:59:59.999${offset}` : `00:00:00.000${offset}`;
    return new Date(`${trimmed}T${timeSuffix}`);
  }

  // Jika format sudah memiliki jam / ISO string
  return new Date(trimmed);
}

/**
 * Menyelesaikan rentang awal (start) dan akhir (end) secara komprehensif.
 * Mendukung zona waktu outlet spesifik.
 */
export function resolveDateRange(startDate?: string, endDate?: string, timeZone: string = 'Asia/Jakarta'): { start: Date; end: Date } {
  const now = new Date();
  const offset = getTimezoneOffsetStr(timeZone);
  let start: Date;
  let end: Date;

  if (startDate && startDate.trim() !== '') {
    start = parseDateBoundary(startDate, false, timeZone);
  } else {
    const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    start = new Date(`${toOutletDateStr(d, timeZone)}T00:00:00.000${offset}`);
  }

  if (endDate && endDate.trim() !== '') {
    end = parseDateBoundary(endDate, true, timeZone);
  } else {
    end = new Date(`${toOutletDateStr(now, timeZone)}T23:59:59.999${offset}`);
  }

  return { start, end };
}
