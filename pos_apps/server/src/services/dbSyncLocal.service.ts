import { Client } from 'pg';
import path from 'path';
import fs from 'fs';
import { spawnSync } from 'child_process';
import { executeDatabaseBackup, BackupResult } from './dbBackup.service';

export interface SyncLocalResult {
  success: boolean;
  backupResult?: BackupResult;
  targetDb: string;
  tablesSynced: number;
  rowsSynced: number;
  durationMs: number;
  stats?: {
    tenants: number;
    users: number;
    outlets: number;
    products: number;
    orders: number;
    orderItems: number;
    payments: number;
  };
  error?: string;
}

export interface SyncLocalOptions {
  localDbUrl?: string;
  silent?: boolean;
}

/**
 * Memastikan skema tabel di pos_backup_live telah terpasang.
 * Jika database lokal masih kosong, salin struktur DDL dari database pos_db lokal.
 */
async function ensureLocalSchema(client: Client, localDbUrl: string, silent: boolean = false): Promise<void> {
  const tableCheck = await client.query(
    `SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';`
  );

  const tableCount = tableCheck.rows[0]?.count || 0;
  if (tableCount > 0) {
    return;
  }

  if (!silent) {
    console.log('📦 Database pos_backup_live belum memiliki skema DDL. Menyalin skema dari pos_db...');
  }

  // Gunakan pg_dump skema dari pos_db lokal
  const serverDir = path.resolve(__dirname, '../..');
  const envPath = path.join(serverDir, '.env');
  let sourceDbUrl = 'postgresql://postgres:postgres123@localhost:5432/pos_db';
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/DATABASE_URL=["']?([^"'\n]+)["']?/);
    if (match && match[1]) {
      sourceDbUrl = match[1].replace(/\?schema=.*$/, '');
    }
  }

  const dumpProcess = spawnSync('pg_dump', ['-s', sourceDbUrl], { encoding: 'utf8' });
  if (dumpProcess.status === 0 && dumpProcess.stdout) {
    await client.query(dumpProcess.stdout);
    if (!silent) {
      console.log('✅ Skema tabel berhasil diinisialisasi di pos_backup_live.');
    }
  } else {
    throw new Error(`Gagal menginisialisasi skema tabel lokal: ${dumpProcess.stderr}`);
  }
}

/**
 * Menyedot data dari Live Remote Database (Supabase) dan menyalinnya langsung ke database lokal pos_backup_live.
 */
export async function syncRemoteToLocalDatabase(options: SyncLocalOptions = {}): Promise<SyncLocalResult> {
  const startTime = Date.now();
  const {
    localDbUrl = process.env.LOCAL_BACKUP_DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/pos_backup_live',
    silent = false,
  } = options;

  const log = (msg: string) => {
    if (!silent) console.log(msg);
  };

  log('\n============================================================');
  log('🔄  WELL POS — LIVE-TO-LOCAL DATABASE SYNC & REPLICA');
  log('============================================================');
  log(`🎯 Target Lokal: ${localDbUrl.replace(/:[^:@]+@/, ':***@')}`);

  // 1. Eksekusi snapshot data live dari server remote
  log('📡 Mengambil snapshot data terbaru dari Live Server...');
  const backupResult = await executeDatabaseBackup({ silent: true, compress: true });
  if (!backupResult.success || !backupResult.jsonFile) {
    const err = backupResult.error || 'Gagal mengekstrak snapshot dari server remote.';
    log(`❌ ${err}`);
    return {
      success: false,
      targetDb: localDbUrl,
      tablesSynced: 0,
      rowsSynced: 0,
      durationMs: Date.now() - startTime,
      error: err,
    };
  }

  // 2. Baca file snapshot JSON
  const serverDir = path.resolve(__dirname, '../..');
  const jsonPath = path.join(serverDir, 'backups', backupResult.jsonFile);
  if (!fs.existsSync(jsonPath)) {
    const err = `File snapshot tidak ditemukan di: ${jsonPath}`;
    log(`❌ ${err}`);
    return {
      success: false,
      backupResult,
      targetDb: localDbUrl,
      tablesSynced: 0,
      rowsSynced: 0,
      durationMs: Date.now() - startTime,
      error: err,
    };
  }

  const rawJson = fs.readFileSync(jsonPath, 'utf8');
  const snapshotData: Record<string, any[]> = JSON.parse(rawJson);

  // 3. Hubungkan ke database lokal pos_backup_live
  const client = new Client({ connectionString: localDbUrl });
  try {
    await client.connect();
    await ensureLocalSchema(client, localDbUrl, silent);

    log('🚀 Menyinkronkan data ke tabel pos_backup_live...');
    await client.query('BEGIN;');
    await client.query("SET session_replication_role = 'replica';");

    const existingTablesRes = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';`
    );
    const existingTableNames = new Set(existingTablesRes.rows.map((r) => r.table_name));

    // 4. Truncate semua tabel yang ada terlebih dahulu
    const tablesToTruncate = Object.keys(snapshotData).filter((t) => existingTableNames.has(t));
    if (tablesToTruncate.length > 0) {
      await client.query(`TRUNCATE TABLE ${tablesToTruncate.map((t) => `"${t}"`).join(', ')} CASCADE;`);
    }

    let insertedTables = 0;
    let insertedRows = 0;

    // 5. Masukkan data ke setiap tabel
    for (const [tbl, rows] of Object.entries(snapshotData)) {
      if (!existingTableNames.has(tbl) || !Array.isArray(rows) || rows.length === 0) continue;

      for (const row of rows) {
        const keys = Object.keys(row);
        const cols = keys.map((k) => `"${k}"`).join(', ');
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const values = keys.map((k) => {
          const val = row[k];
          if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
            return JSON.stringify(val);
          }
          return val;
        });

        await client.query(`INSERT INTO "${tbl}" (${cols}) VALUES (${placeholders});`, values);
        insertedRows++;
      }
      insertedTables++;
    }

    await client.query("SET session_replication_role = 'origin';");
    await client.query('COMMIT;');

    // 6. Ambil ringkasan statistik entitas
    const statsRes = await client.query(`
      SELECT 'tenants' AS entity, count(*)::int AS count FROM tenants
      UNION ALL SELECT 'users', count(*)::int FROM users
      UNION ALL SELECT 'outlets', count(*)::int FROM outlets
      UNION ALL SELECT 'products', count(*)::int FROM products
      UNION ALL SELECT 'orders', count(*)::int FROM orders
      UNION ALL SELECT 'order_items', count(*)::int FROM order_items
      UNION ALL SELECT 'payments', count(*)::int FROM payment_transactions;
    `);

    const statsMap: Record<string, number> = {};
    for (const row of statsRes.rows) {
      statsMap[row.entity] = row.count;
    }

    const duration = Date.now() - startTime;
    log(`\n📊 Statistik Sinkronisasi Database Lokal:`);
    log(`   • Usaha / Tenant         : ${statsMap['tenants'] ?? 0}`);
    log(`   • Pengguna & Kasir       : ${statsMap['users'] ?? 0}`);
    log(`   • Toko & Outlet          : ${statsMap['outlets'] ?? 0}`);
    log(`   • Katalog Produk         : ${statsMap['products'] ?? 0}`);
    log(`   • Transaksi & Nota       : ${statsMap['orders'] ?? 0}`);
    log(`   • Rincian Item Order     : ${statsMap['order_items'] ?? 0}`);
    log(`   • Transaksi Pembayaran   : ${statsMap['payments'] ?? 0}`);

    log('\n============================================================');
    log(`✅ SINKRONISASI DATABASE LIVE KE LOKAL SUKSES 100%!`);
    log(`⏱️  Durasi: ${(duration / 1000).toFixed(2)} detik`);
    log(`📁 File Snapshot Cadangan: ${backupResult.jsonGzFile || backupResult.jsonFile}`);
    log(`💾 Database Lokal: pos_backup_live (Port 5432)`);
    log('============================================================\n');

    return {
      success: true,
      backupResult,
      targetDb: localDbUrl,
      tablesSynced: insertedTables,
      rowsSynced: insertedRows,
      durationMs: duration,
      stats: {
        tenants: statsMap['tenants'] ?? 0,
        users: statsMap['users'] ?? 0,
        outlets: statsMap['outlets'] ?? 0,
        products: statsMap['products'] ?? 0,
        orders: statsMap['orders'] ?? 0,
        orderItems: statsMap['order_items'] ?? 0,
        payments: statsMap['payments'] ?? 0,
      },
    };
  } catch (err: any) {
    try {
      await client.query('ROLLBACK;');
    } catch {
      // ignore
    }
    log(`❌ Eror sinkronisasi database lokal: ${err.message}`);
    return {
      success: false,
      backupResult,
      targetDb: localDbUrl,
      tablesSynced: 0,
      rowsSynced: 0,
      durationMs: Date.now() - startTime,
      error: err.message,
    };
  } finally {
    await client.end().catch(() => {});
  }
}
