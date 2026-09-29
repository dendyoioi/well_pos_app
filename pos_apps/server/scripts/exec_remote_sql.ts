import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { SCHEMA_PATCHES, runAutoSchemaPatcher } from '../src/migrations/schema_patcher';

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

// Deteksi URL target database
const targetDbUrl =
  process.env.REMOTE_DATABASE_URL ||
  process.env.SUPABASE_DIRECT_URL ||
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL;

if (!targetDbUrl) {
  console.error('\n❌ Eror: Tidak ada DATABASE_URL / DIRECT_URL yang ditemukan.');
  console.error('Harap set REMOTE_DATABASE_URL atau DIRECT_URL di pos_apps/server/.env.production\n');
  process.exit(1);
}

// Sensor password untuk keamanan log
const maskedUrl = targetDbUrl.replace(/:([^:@]+)@/, ':****@');
console.log(`[DB] 🔌 Terhubung ke target database: ${maskedUrl}`);

const client = new PrismaClient({
  datasources: {
    db: {
      url: targetDbUrl,
    },
  },
});

async function main() {
  const args = process.argv.slice(2);
  const flag = args[0];

  try {
    if (flag === '--patch') {
      console.log('\n=========================================');
      console.log('🚀 Menjalankan Auto-Schema Patcher...');
      console.log('=========================================');
      const res = await runAutoSchemaPatcher(client);
      console.log(`\n📋 Ringkasan:`);
      console.log(` - Patch Diterapkan : ${res.applied.length} (${res.applied.join(', ') || 'tidak ada'})`);
      console.log(` - Patch Dilewati   : ${res.skipped.length}`);
      if (res.failed.length > 0) {
        console.log(` - Patch Gagal      : ${res.failed.length}`);
        res.failed.forEach((f) => console.error(`   ❌ [${f.id}]: ${f.error}`));
      }
      console.log('=========================================\n');
    } else if (flag === '--sql') {
      const sqlQuery = args.slice(1).join(' ').trim();
      if (!sqlQuery) {
        console.error('❌ Eror: Harap sertakan query SQL setelah --sql. Contoh: npm run db:remote:sql -- "ALTER TABLE ..."');
        process.exit(1);
      }

      console.log('\n=========================================');
      console.log(`⚡ Menjalankan Custom SQL:`);
      console.log(sqlQuery);
      console.log('=========================================');

      const start = Date.now();
      const isSelect = sqlQuery.trim().toUpperCase().startsWith('SELECT');

      if (isSelect) {
        const rows = await client.$queryRawUnsafe(sqlQuery);
        const duration = Date.now() - start;
        console.log(`✅ Query SELECT sukses (${duration}ms):`);
        console.dir(rows, { depth: null, colors: true });
      } else {
        const affected = await client.$executeRawUnsafe(sqlQuery);
        const duration = Date.now() - start;
        console.log(`✅ Eksekusi DDL/DML sukses (${duration}ms). Baris terpengaruh: ${affected}`);
      }
      console.log('=========================================\n');
    } else {
      console.log(`
Penggunaan CLI:
  npm run db:remote:patch             -> Menjalankan seluruh patch yang belum terdaftar di _schema_patches
  npm run db:remote:sql -- "<SQL>"   -> Menjalankan query SQL bebas ke remote database

Contoh:
  npm run db:remote:sql -- "ALTER TABLE \"orders\" ADD COLUMN IF NOT EXISTS \"queue_number\" INTEGER;"
  npm run db:remote:sql -- "SELECT id, invoice_number, queue_number FROM \"orders\" LIMIT 5;"
      `);
    }
  } catch (err: any) {
    console.error('\n❌ Eksekusi Gagal:', err.message);
    process.exit(1);
  } finally {
    await client.$disconnect();
  }
}

main();
