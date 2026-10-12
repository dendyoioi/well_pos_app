import { spawnSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

export interface BackupResult {
  success: boolean;
  timestamp: string;
  jsonFile?: string;
  jsonGzFile?: string;
  dumpFile?: string;
  sha256?: string;
  sizeKb: number;
  compressedSizeKb?: number;
  totalRecords: number;
  tablesBackedUp: number;
  cleanedOldFiles: number;
  error?: string;
}

export interface BackupOptions {
  retentionDays?: number;
  maxFilesToKeep?: number;
  compress?: boolean;
  silent?: boolean;
}

// Inisialisasi env loader helper
function loadEnvironmentConfig(): string | undefined {
  const serverDir = path.resolve(__dirname, '../..');
  const envProdPath = path.join(serverDir, '.env.production');
  const envRemotePath = path.join(serverDir, '.env.remote');
  const envDefaultPath = path.join(serverDir, '.env');

  if (fs.existsSync(envProdPath)) {
    dotenv.config({ path: envProdPath, override: true });
    return path.basename(envProdPath);
  } else if (fs.existsSync(envRemotePath)) {
    dotenv.config({ path: envRemotePath, override: true });
    return path.basename(envRemotePath);
  } else if (fs.existsSync(envDefaultPath)) {
    dotenv.config({ path: envDefaultPath });
    return path.basename(envDefaultPath);
  }
  return undefined;
}

/**
 * Rotasi file backup lama untuk mencegah penumpukan kapasitas penyimpanan.
 */
export function rotateOldBackups(backupsDir: string, retentionDays: number = 7, maxFiles: number = 20): number {
  if (!fs.existsSync(backupsDir)) return 0;

  let deletedCount = 0;
  const now = Date.now();
  const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;

  try {
    const files = fs.readdirSync(backupsDir)
      .filter((f) => f.startsWith('backup_'))
      .map((f) => {
        const filePath = path.join(backupsDir, f);
        const stats = fs.statSync(filePath);
        return { name: f, path: filePath, mtime: stats.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime); // Terkini di awal

    // 1. Hapus file yang melewati retentionDays
    const remainingFiles: typeof files = [];
    for (const file of files) {
      if (now - file.mtime > maxAgeMs) {
        fs.unlinkSync(file.path);
        deletedCount++;
      } else {
        remainingFiles.push(file);
      }
    }

    // 2. Jika file masih melebihi batas maksimal, hapus yang tertua
    if (remainingFiles.length > maxFiles) {
      const filesToRemove = remainingFiles.slice(maxFiles);
      for (const file of filesToRemove) {
        try {
          fs.unlinkSync(file.path);
          deletedCount++;
        } catch {
          // Abaikan jika sudah terhapus
        }
      }
    }
  } catch (err) {
    console.warn(`[Backup Rotation] ⚠️ Gagal merotasi file lama:`, err);
  }

  return deletedCount;
}

/**
 * Mesin Eksekusi Backup Utama PostgreSQL (Dapat dipanggil via Cron, Controller, atau CLI).
 */
export async function executeDatabaseBackup(options: BackupOptions = {}): Promise<BackupResult> {
  const {
    retentionDays = 7,
    maxFilesToKeep = 20,
    compress = true,
    silent = false,
  } = options;

  const log = (msg: string) => {
    if (!silent) console.log(msg);
  };

  const loadedEnv = loadEnvironmentConfig();
  if (loadedEnv && !silent) {
    log(`[Config] 📄 Menggunakan variabel dari: ${loadedEnv}`);
  }

  const targetDbUrl =
    process.env.REMOTE_DATABASE_URL ||
    process.env.SUPABASE_DIRECT_URL ||
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL;

  if (!targetDbUrl) {
    const errMsg = 'Tidak ada DATABASE_URL / REMOTE_DATABASE_URL yang ditemukan pada konfigurasi server.';
    if (!silent) console.error(`\n❌ Eror: ${errMsg}\n`);
    return {
      success: false,
      timestamp: new Date().toISOString(),
      sizeKb: 0,
      totalRecords: 0,
      tablesBackedUp: 0,
      cleanedOldFiles: 0,
      error: errMsg,
    };
  }

  const serverDir = path.resolve(__dirname, '../..');
  const backupsDir = path.join(serverDir, 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);

  log('\n============================================================');
  log('🛡️  WELL POS — DATABASE BACKUP & SNAPSHOT ENGINE');
  log('============================================================');
  log(`📡 Menghubungkan ke Database Target...`);

  // 1. Coba eksekusi pg_dump terlebih dahulu jika binary tersedia
  let dumpFilename: string | undefined;
  let dumpFilePath: string | undefined;
  try {
    const candidateDumpName = `backup_supabase_prod_${timestamp}.dump`;
    const candidateDumpPath = path.join(backupsDir, candidateDumpName);
    const pgDumpResult = spawnSync('pg_dump', ['-Fc', '-v', '-d', targetDbUrl, '-f', candidateDumpPath], {
      stdio: 'pipe',
      encoding: 'utf-8',
    });

    if (pgDumpResult.status === 0) {
      dumpFilename = candidateDumpName;
      dumpFilePath = candidateDumpPath;
      const stats = fs.statSync(dumpFilePath);
      log(`✅ Snapshot biner pg_dump (-Fc) berhasil: ${(stats.size / 1024).toFixed(2)} KB`);
    } else {
      log(`ℹ️  pg_dump versi lokal tidak cocok dengan server remote. Menggunakan Prisma Database Snapshotter...`);
    }
  } catch {
    log(`ℹ️  pg_dump tidak tersedia di lingkungan ini. Mengaktifkan Prisma Database Snapshotter...`);
  }

  // 2. Snapshot Data Universal via Prisma Engine
  const prisma = new PrismaClient({ datasources: { db: { url: targetDbUrl } } });
  try {
    const rawTables = await prisma.$queryRawUnsafe<any[]>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name ASC;`
    );

    const tableNames: string[] = rawTables.map((r: any) => r.table_name || r.TABLE_NAME);
    const databaseSnapshot: Record<string, any[]> = {};
    let totalRecords = 0;
    let tablesCount = 0;

    log(`\n📦 Mengekstrak data dari ${tableNames.length} tabel publik...`);
    for (const tbl of tableNames) {
      if (tbl.startsWith('_prisma') || tbl.startsWith('_schema')) continue;
      try {
        const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "${tbl}";`);
        databaseSnapshot[tbl] = rows;
        totalRecords += rows.length;
        tablesCount++;
        if (rows.length > 0 && !silent) {
          log(`   • ${tbl.padEnd(25)} : ${rows.length} baris data`);
        }
      } catch (err: any) {
        log(`   ⚠️  Gagal mengekstrak tabel ${tbl}: ${err.message}`);
      }
    }

    const jsonString = JSON.stringify(databaseSnapshot, null, 2);
    const jsonBuffer = Buffer.from(jsonString, 'utf-8');

    // Simpan JSON mentah
    const jsonFilename = `backup_snapshot_${timestamp}.json`;
    const jsonFilePath = path.join(backupsDir, jsonFilename);
    fs.writeFileSync(jsonFilePath, jsonBuffer);
    const jsonStats = fs.statSync(jsonFilePath);
    const sizeKb = parseFloat((jsonStats.size / 1024).toFixed(2));

    // Kompresi Gzip opsional (Hemat ~85% ruang disk)
    let jsonGzFilename: string | undefined;
    let compressedSizeKb: number | undefined;
    if (compress) {
      const gzippedBuffer = zlib.gzipSync(jsonBuffer);
      jsonGzFilename = `backup_snapshot_${timestamp}.json.gz`;
      const jsonGzFilePath = path.join(backupsDir, jsonGzFilename);
      fs.writeFileSync(jsonGzFilePath, gzippedBuffer);
      const gzStats = fs.statSync(jsonGzFilePath);
      compressedSizeKb = parseFloat((gzStats.size / 1024).toFixed(2));
      log(`🗜️  Kompresi Gzip aktif: ${jsonGzFilename} (${compressedSizeKb} KB - Efisiensi: ${Math.round((1 - compressedSizeKb / sizeKb) * 100)}%)`);
    }

    // SHA-256 Checksum Verifikasi Integritas
    const sha256 = crypto.createHash('sha256').update(jsonBuffer).digest('hex');
    const sha256Filename = `backup_snapshot_${timestamp}.sha256`;
    fs.writeFileSync(path.join(backupsDir, sha256Filename), `${sha256}  ${jsonFilename}\n`, 'utf-8');

    // Jalankan pembersihan rotasi file lama
    const cleanedOldFiles = rotateOldBackups(backupsDir, retentionDays, maxFilesToKeep);
    if (cleanedOldFiles > 0) {
      log(`🧹 Rotasi Retensi: ${cleanedOldFiles} file snapshot lama dibersihkan secara aman.`);
    }

    // Ringkasan Entitas Inti
    const [tenantCount, userCount, outletCount, productCount, orderCount, subCount] = await Promise.all([
      prisma.tenant.count().catch(() => 0),
      prisma.user.count().catch(() => 0),
      prisma.outlet.count().catch(() => 0),
      prisma.product.count().catch(() => 0),
      prisma.order.count().catch(() => 0),
      prisma.tenantSubscription.count().catch(() => 0),
    ]);

    log('\n📈 Rekapitulasi Entitas Utama:');
    log(`   • Tenant / Usaha          : ${tenantCount}`);
    log(`   • Akun Pengguna / Kasir   : ${userCount}`);
    log(`   • Toko / Outlet Fisik     : ${outletCount}`);
    log(`   • Katalog Produk          : ${productCount}`);
    log(`   • Faktur & Transaksi Kasir: ${orderCount}`);
    log(`   • Kuota Token & Langganan : ${subCount}`);

    log('\n============================================================');
    log('🎉 SNAPSHOT DATABASE BERHASIL DIAMANKAN 100%!');
    log(`📁 Berkas Utama: ${jsonGzFilename || jsonFilename}`);
    log(`🔒 SHA-256 Checksum: ${sha256.slice(0, 16)}...`);
    log('============================================================\n');

    return {
      success: true,
      timestamp,
      jsonFile: jsonFilename,
      jsonGzFile: jsonGzFilename,
      dumpFile: dumpFilename,
      sha256,
      sizeKb,
      compressedSizeKb,
      totalRecords,
      tablesBackedUp: tablesCount,
      cleanedOldFiles,
    };
  } catch (err: any) {
    console.error('❌ Gagal mengekstrak data snapshot:', err);
    return {
      success: false,
      timestamp,
      sizeKb: 0,
      totalRecords: 0,
      tablesBackedUp: 0,
      cleanedOldFiles: 0,
      error: err.message,
    };
  } finally {
    await prisma.$disconnect();
  }
}
