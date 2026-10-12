import path from 'path';
import fs from 'fs';
import { executeDatabaseBackup, BackupResult } from './dbBackup.service';

interface BackupSchedulerState {
  enabled: boolean;
  scheduledHourWib: number;
  lastRun?: {
    timestamp: string;
    success: boolean;
    file?: string;
    sizeKb?: number;
    error?: string;
  };
  nextRunWib?: string;
  totalBackupsRun: number;
}

const state: BackupSchedulerState = {
  enabled: process.env.BACKUP_CRON_ENABLED !== 'false',
  scheduledHourWib: parseInt(process.env.BACKUP_CRON_HOUR || '3', 10), // Default pukul 03:00 WIB
  totalBackupsRun: 0,
};

let schedulerTimer: NodeJS.Timeout | null = null;

/**
 * Menghitung selisih milidetik menuju waktu target WIB berikutnya (misal: 03:00 WIB).
 */
function getMsUntilNextWibHour(targetHourWib: number): number {
  const now = new Date();
  
  // Hitung waktu saat ini dalam WIB (UTC+7)
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  const wibTime = new Date(utcTime + 7 * 3600000);

  const targetWib = new Date(wibTime);
  targetWib.setHours(targetHourWib, 0, 0, 0);

  // Jika jam target hari ini sudah terlewat, jadwalkan untuk besok
  if (targetWib.getTime() <= wibTime.getTime()) {
    targetWib.setDate(targetWib.getDate() + 1);
  }

  state.nextRunWib = targetWib.toISOString().replace('T', ' ').slice(0, 19) + ' WIB';
  return targetWib.getTime() - wibTime.getTime();
}

/**
 * Eksekutor tugas backup terjadwal dengan re-scheduling otomatis 24 jam.
 */
async function triggerScheduledBackup(): Promise<void> {
  console.log(`[BackupScheduler] ⏰ Memulai siklus backup otomatis database harian (${new Date().toISOString()})...`);
  try {
    const result: BackupResult = await executeDatabaseBackup({
      retentionDays: 7,
      maxFilesToKeep: 14,
      compress: true,
      silent: false,
    });

    state.lastRun = {
      timestamp: new Date().toISOString(),
      success: result.success,
      file: result.jsonGzFile || result.jsonFile,
      sizeKb: result.compressedSizeKb || result.sizeKb,
      error: result.error,
    };
    state.totalBackupsRun++;

    if (result.success) {
      console.log(`[BackupScheduler] ✅ Backup otomatis selesai dengan sukses. File: ${state.lastRun.file}`);
    } else {
      console.error(`[BackupScheduler] ❌ Backup otomatis gagal: ${result.error}`);
    }
  } catch (err: any) {
    console.error(`[BackupScheduler] ❌ Kesalahan sistem selama backup:`, err);
    state.lastRun = {
      timestamp: new Date().toISOString(),
      success: false,
      error: err.message,
    };
  } finally {
    // Jadwalkan siklus berikutnya untuk 24 jam ke depan
    scheduleNextRun();
  }
}

/**
 * Mengatur timer waktu menuju eksekusi jadwal berikutnya.
 */
function scheduleNextRun(): void {
  if (!state.enabled) {
    console.log('[BackupScheduler] ⏸️ Scheduler otomatis dinonaktifkan via environment.');
    return;
  }

  const delayMs = getMsUntilNextWibHour(state.scheduledHourWib);
  const hoursLeft = (delayMs / 3600000).toFixed(1);

  console.log(`[BackupScheduler] ⏳ Backup terjadwal berikutnya dalam ${hoursLeft} jam (Target: ${state.nextRunWib})`);

  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
  }

  schedulerTimer = setTimeout(() => {
    triggerScheduledBackup();
  }, delayMs);
}

/**
 * Inisialisasi scheduler saat server boot.
 */
export function initBackupScheduler(): void {
  if (!state.enabled) {
    console.log('[BackupScheduler] ℹ️ Backup otomatis dinonaktifkan (BACKUP_CRON_ENABLED=false).');
    return;
  }

  console.log(`[BackupScheduler] 🚀 Menginisialisasi scheduler backup harian (Target jam: ${state.scheduledHourWib}:00 WIB)...`);
  scheduleNextRun();
}

/**
 * Mengambil ringkasan status scheduler dan histori file snapshot.
 */
export function getBackupStatus(): {
  scheduler: BackupSchedulerState;
  files: Array<{ name: string; sizeKb: number; createdAt: string; isGz: boolean }>;
} {
  const backupsDir = path.resolve(__dirname, '../../backups');
  let files: Array<{ name: string; sizeKb: number; createdAt: string; isGz: boolean }> = [];

  if (fs.existsSync(backupsDir)) {
    try {
      files = fs.readdirSync(backupsDir)
        .filter((f) => f.startsWith('backup_') && !f.endsWith('.sha256'))
        .map((f) => {
          const stats = fs.statSync(path.join(backupsDir, f));
          return {
            name: f,
            sizeKb: parseFloat((stats.size / 1024).toFixed(2)),
            createdAt: stats.mtime.toISOString(),
            isGz: f.endsWith('.gz'),
          };
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
      files = [];
    }
  }

  return {
    scheduler: { ...state },
    files,
  };
}

/**
 * Pemicu manual snapshot backup instan oleh Admin.
 */
export async function triggerImmediateBackup(): Promise<BackupResult> {
  console.log('[BackupScheduler] ⚡ Memicu snapshot backup instan via Admin request...');
  const result = await executeDatabaseBackup({
    retentionDays: 7,
    maxFilesToKeep: 14,
    compress: true,
    silent: false,
  });

  state.lastRun = {
    timestamp: new Date().toISOString(),
    success: result.success,
    file: result.jsonGzFile || result.jsonFile,
    sizeKb: result.compressedSizeKb || result.sizeKb,
    error: result.error,
  };
  state.totalBackupsRun++;

  return result;
}
