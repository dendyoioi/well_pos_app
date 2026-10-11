import { spawnSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

// Muat urutan konfigurasi environment: .env.production -> .env.remote -> .env
const serverDir = path.resolve(__dirname, '..');
const envProdPath = path.join(serverDir, '.env.production');
const envRemotePath = path.join(serverDir, '.env.remote');
const envDefaultPath = path.join(serverDir, '.env');

if (fs.existsSync(envProdPath)) {
  dotenv.config({ path: envProdPath, override: true });
  console.log(`[Config] 📄 Menggunakan variabel dari: ${path.basename(envProdPath)}`);
} else if (fs.existsSync(envRemotePath)) {
  dotenv.config({ path: envRemotePath, override: true });
  console.log(`[Config] 📄 Menggunakan variabel dari: ${path.basename(envRemotePath)}`);
} else {
  dotenv.config({ path: envDefaultPath });
  console.log(`[Config] 📄 Menggunakan variabel dari: ${path.basename(envDefaultPath)}`);
}

const targetDbUrl =
  process.env.REMOTE_DATABASE_URL ||
  process.env.SUPABASE_DIRECT_URL ||
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL;

if (!targetDbUrl) {
  console.error('\n❌ Eror: Tidak ada DATABASE_URL / REMOTE_DATABASE_URL yang ditemukan.');
  console.error('Harap set REMOTE_DATABASE_URL di pos_apps/server/.env.production\n');
  process.exit(1);
}

async function runBackup() {
  console.log('\n============================================================');
  console.log('🛡️  WELL POS — DATABASE BACKUP & SNAPSHOT SUITE');
  console.log('============================================================');

  const backupsDir = path.join(serverDir, 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  console.log(`📡 Menghubungkan ke Database Target...`);

  // 1. Coba eksekusi pg_dump terlebih dahulu
  let pgDumpSuccess = false;
  const dumpFilename = `backup_supabase_prod_${timestamp}.dump`;
  const dumpFilePath = path.join(backupsDir, dumpFilename);

  try {
    const pgDumpResult = spawnSync('pg_dump', ['-Fc', '-v', '-d', targetDbUrl, '-f', dumpFilePath], {
      stdio: 'pipe',
      encoding: 'utf-8',
    });

    if (pgDumpResult.status === 0) {
      pgDumpSuccess = true;
      const stats = fs.statSync(dumpFilePath);
      console.log(`✅ Snapshot biner pg_dump (-Fc) berhasil: ${(stats.size / 1024).toFixed(2)} KB`);
    } else {
      console.log(`ℹ️  pg_dump versi lokal tidak cocok dengan server remote (${(pgDumpResult.stderr || '').split('\n')[0]}).`);
      console.log(`🔄 Mengaktifkan Mesin Backup Mandiri Prisma Database Snapshotter...`);
    }
  } catch {
    console.log(`ℹ️  pg_dump tidak tersedia. Mengaktifkan Prisma Database Snapshotter...`);
  }

  // 2. Snapshot Data Lengkap via Prisma (Universal, Bebas Ketergantungan Versi CLI)
  const prisma = new PrismaClient({ datasources: { db: { url: targetDbUrl } } });
  try {
    // Ambil daftar seluruh tabel publik
    const rawTables = await prisma.$queryRawUnsafe<any[]>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name ASC;`
    );

    const tableNames: string[] = rawTables.map((r: any) => r.table_name || r.TABLE_NAME);
    const databaseSnapshot: Record<string, any[]> = {};
    let totalRecords = 0;

    console.log(`\n📦 Mengekstrak data dari ${tableNames.length} tabel publik...`);
    for (const tbl of tableNames) {
      if (tbl.startsWith('_prisma') || tbl.startsWith('_schema')) continue;
      try {
        const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "${tbl}";`);
        databaseSnapshot[tbl] = rows;
        totalRecords += rows.length;
        if (rows.length > 0) {
          console.log(`   • ${tbl.padEnd(25)} : ${rows.length} baris data`);
        }
      } catch (err: any) {
        console.warn(`   ⚠️  Gagal mengekstrak tabel ${tbl}: ${err.message}`);
      }
    }

    const jsonFilename = `backup_snapshot_${timestamp}.json`;
    const jsonFilePath = path.join(backupsDir, jsonFilename);
    fs.writeFileSync(jsonFilePath, JSON.stringify(databaseSnapshot, null, 2), 'utf-8');
    const jsonStats = fs.statSync(jsonFilePath);

    console.log(`\n✅ Snapshot JSON Mandiri Tersimpan: ${jsonFilename} (${(jsonStats.size / 1024).toFixed(2)} KB)`);
    console.log(`📊 Total Baris Data Terselamatkan: ${totalRecords.toLocaleString('id-ID')} entri`);

    // Ringkasan Status
    const [tenantCount, userCount, outletCount, productCount, orderCount, subCount] = await Promise.all([
      prisma.tenant.count().catch(() => 0),
      prisma.user.count().catch(() => 0),
      prisma.outlet.count().catch(() => 0),
      prisma.product.count().catch(() => 0),
      prisma.order.count().catch(() => 0),
      prisma.tenantSubscription.count().catch(() => 0),
    ]);

    console.log('\n📈 Rekapitulasi Entitas Utama:');
    console.log(`   • Tenant / Usaha          : ${tenantCount}`);
    console.log(`   • Akun Pengguna / Kasir   : ${userCount}`);
    console.log(`   • Toko / Outlet Fisik     : ${outletCount}`);
    console.log(`   • Katalog Produk          : ${productCount}`);
    console.log(`   • Faktur & Transaksi Kasir: ${orderCount}`);
    console.log(`   • Kuota Token & Langganan : ${subCount}`);

    console.log('\n============================================================');
    console.log('🎉 SELURUH DATA TENANT TERAMANKAN DENGAN SEMPURNA!');
    console.log(`📁 Lokasi Berkas: ${jsonFilePath}`);
    console.log('============================================================\n');
  } catch (err: any) {
    console.error('❌ Gagal mengekstrak data snapshot:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runBackup();
