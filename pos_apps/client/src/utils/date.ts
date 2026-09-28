/**
 * Date Utilities for Client App
 * Menangani konversi dan kalkulasi tanggal berbasis waktu lokal pengguna (WIB UTC+7)
 * untuk menghindari pergeseran tanggal saat menggunakan toISOString().
 */

export function toLocalDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getLocalStartOfDay(d: Date = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function getLocalEndOfDay(d: Date = new Date()): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export type CommonDatePreset = 'today' | '7days' | '30days' | 'thismonth' | 'thisMonth' | 'all' | 'custom';

export function computePresetDateRange(preset: CommonDatePreset): { startStr: string; endStr: string } {
  const now = new Date();
  const endStr = toLocalDateStr(now);
  let startStr = endStr;

  switch (preset) {
    case 'today':
      startStr = endStr;
      break;
    case '7days': {
      const d = new Date(now.getTime() - 6 * 86400_000);
      startStr = toLocalDateStr(d);
      break;
    }
    case '30days': {
      const d = new Date(now.getTime() - 29 * 86400_000);
      startStr = toLocalDateStr(d);
      break;
    }
    case 'thismonth':
    case 'thisMonth': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      startStr = toLocalDateStr(firstDay);
      break;
    }
    default:
      startStr = endStr;
  }

  return { startStr, endStr };
}
