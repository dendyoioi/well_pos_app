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
 * Mengonversi tanggal input (string 'YYYY-MM-DD' atau ISO) ke objek Date
 * dengan batas waktu awal hari (00:00:00.000+07:00) atau akhir hari (23:59:59.999+07:00).
 */
export function parseDateBoundary(dateStr?: string, isEnd: boolean = false): Date {
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
    const timeSuffix = isEnd ? '23:59:59.999+07:00' : '00:00:00.000+07:00';
    return new Date(`${trimmed}T${timeSuffix}`);
  }

  // Jika format sudah memiliki jam / ISO string
  return new Date(trimmed);
}

/**
 * Menyelesaikan rentang awal (start) dan akhir (end) secara komprehensif.
 * Semua default fallback menggunakan zona waktu WIB (+07:00).
 */
export function resolveDateRange(startDate?: string, endDate?: string): { start: Date; end: Date } {
  const now = new Date();
  let start: Date;
  let end: Date;

  if (startDate && startDate.trim() !== '') {
    start = parseDateBoundary(startDate, false);
  } else {
    // Fix Timezone: Gunakan toWibDateStr() bukan toISOString() agar tidak off-by-1 hari
    // saat server berjalan di UTC (00:00-06:59 WIB = 17:00-23:59 UTC hari sebelumnya)
    const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    start = new Date(`${toWibDateStr(d)}T00:00:00.000+07:00`);
  }

  if (endDate && endDate.trim() !== '') {
    end = parseDateBoundary(endDate, true);
  } else {
    // Fix Timezone: Gunakan toWibDateStr() bukan toISOString()
    end = new Date(`${toWibDateStr(now)}T23:59:59.999+07:00`);
  }

  return { start, end };
}
