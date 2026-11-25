import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// 1. Muat environment configuration SEBELUM StorageService diinisialisasi
const serverDir = path.resolve(__dirname, '../..');
const envPath = path.join(serverDir, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

import { StorageService } from '../services/storage.service';

interface MigrationItem {
  table: 'products' | 'outlets';
  id: string;
  name: string;
  tenantId: string;
  column: string;
  fieldPath?: string;
  mimeType: string;
  ext: string;
  isValidMime: boolean;
  sizeBytes: number;
  sizeKb: number;
  originalDataUrl: string;
  plannedUrl?: string;
  targetUrl?: string;
  status: 'PLANNED' | 'MIGRATED' | 'FAILED' | 'SKIPPED_INVALID';
  errorMessage?: string;
}

interface TableToastSize {
  relname: string;
  totalSize: string;
  tableSize: string;
  toastSize: string;
}

// Helper untuk inspeksi dan validasi data URL Base64
function inspectBase64(dataUrl: string): {
  mimeType: string;
  ext: string;
  isValid: boolean;
  error?: string;
  byteLength: number;
  kb: number;
} {
  const byteLength = Buffer.byteLength(dataUrl, 'utf8');
  const kb = parseFloat((byteLength / 1024).toFixed(2));

  const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!matches) {
    return {
      mimeType: 'unknown',
      ext: 'bin',
      isValid: false,
      error: 'Format Data URL Base64 tidak valid',
      byteLength,
      kb,
    };
  }

  const rawSubtype = matches[1].toLowerCase();
  if (rawSubtype === 'svg+xml' || rawSubtype === 'svg') {
    return {
      mimeType: `image/${rawSubtype}`,
      ext: 'svg',
      isValid: false,
      error: 'Format SVG dilarang demi keamanan anti-XSS',
      byteLength,
      kb,
    };
  }

  const ALLOWED_MIME_EXTS: Record<string, string> = {
    jpeg: 'jpg',
    jpg: 'jpg',
    png: 'png',
    webp: 'webp',
  };

  const ext = ALLOWED_MIME_EXTS[rawSubtype];
  if (!ext) {
    return {
      mimeType: `image/${rawSubtype}`,
      ext: rawSubtype,
      isValid: false,
      error: `Format image/${rawSubtype} tidak didukung (hanya JPEG, PNG, WebP)`,
      byteLength,
      kb,
    };
  }

  return {
    mimeType: `image/${rawSubtype}`,
    ext,
    isValid: true,
    byteLength,
    kb,
  };
}

// Helper untuk mengukur ukuran tabel dan TOAST
async function getTableAndToastSizes(client: Client, tables: string[]): Promise<TableToastSize[]> {
  try {
    const res = await client.query(
      `
      SELECT 
        c.relname,
        pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
        pg_size_pretty(pg_table_size(c.oid)) AS table_size,
        pg_size_pretty(pg_total_relation_size(c.reltoastrelid)) AS toast_size
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])
      ORDER BY c.relname;
      `,
      [tables]
    );

    return res.rows.map((r) => ({
      relname: r.relname,
      totalSize: r.total_size,
      tableSize: r.table_size,
      toastSize: r.toast_size,
    }));
  } catch (err) {
    return [];
  }
}

export async function runBase64ToR2Migration(): Promise<void> {
  // 1. Parsing argumen CLI
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');
  const isDryRun = !isExecute; // Default adalah dry-run (read-only)

  let customDb: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--db=')) {
      customDb = arg.slice(5).replace(/^['"]|['"]$/g, '');
    } else if (arg === '--db' && args[i + 1]) {
      customDb = args[i + 1].replace(/^['"]|['"]$/g, '');
    }
  }

  const targetDb =
    customDb ||
    process.env.LOCAL_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres123@localhost:5432/pos_backup_live';

  const maskedDb = targetDb.replace(/:([^:@]+)@/, ':****@');

  // Inisialisasi StorageService setelah dotenv dimuat
  const storageService = new StorageService();
  const currentProvider = storageService.getProvider();

  console.log('======================================================================');
  console.log('🚀 WELL POS — BASE64 TO CLOUDFLARE R2 OBJECT STORAGE MIGRATION');
  console.log('======================================================================');
  console.log(`📌 Mode Operasi    : ${isExecute ? '🔴 LIVE EXECUTE (R2 UPLOAD & DB UPDATE)' : '🟢 DRY-RUN (READ-ONLY SIMULATION)'}`);
  console.log(`🔌 Target Database : ${maskedDb}`);
  console.log(`☁️ Storage Provider: ${currentProvider.toUpperCase()}`);
  console.log(`📁 Bucket Prefix   : ${storageService.getEnvPrefix()}`);
  console.log('======================================================================\n');

  // 2. GUARD WAJIB SAAT --execute:
  if (isExecute) {
    if (currentProvider !== 'r2') {
      console.error('❌ [ABORT GUARD] Cloudflare R2 belum terkonfigurasi dengan lengkap di .env!');
      console.error(`   Current Provider terdeteksi: "${currentProvider}"`);
      console.error('   Operasi --execute DIBATALKAN untuk mencegah penulisan path lokal (/uploads/...) ke database.');
      console.error('   Harap pastikan variabel R2 berikut terpasang di pos_apps/server/.env:');
      console.error('     - R2_ACCOUNT_ID');
      console.error('     - R2_ACCESS_KEY_ID');
      console.error('     - R2_SECRET_ACCESS_KEY');
      console.error('     - R2_BUCKET_NAME');
      console.error('     - R2_PUBLIC_URL\n');
      process.exit(1);
    }
  }

  const client = new Client({ connectionString: targetDb });
  await client.connect();

  const migrationItems: MigrationItem[] = [];
  const initialSizes = await getTableAndToastSizes(client, ['products', 'outlets']);

  try {
    // -------------------------------------------------------------------------
    // TAHAP 1: PINDAI & AUDIT TABEL "products" (image_url)
    // -------------------------------------------------------------------------
    console.log('📦 Memindai tabel "products" untuk kolom image_url LIKE \'data:image/%\'...');
    const productQuery = await client.query(`
      SELECT 
        id, 
        name, 
        tenant_id, 
        image_url,
        OCTET_LENGTH(image_url) AS size_bytes
      FROM products
      WHERE image_url LIKE 'data:image/%'
      ORDER BY name ASC;
    `);

    for (const row of productQuery.rows) {
      const meta = inspectBase64(row.image_url);
      const now = new Date();
      const dateFolder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const envPrefix = storageService.getEnvPrefix();
      const publicBase = (process.env.R2_PUBLIC_URL || 'https://pub-r2.wellpos.id').replace(/\/$/, '');
      const plannedUrl = `${publicBase}/${envPrefix}/tenants/${row.tenant_id}/products/${dateFolder}/<uuid>.${meta.ext}`;

      migrationItems.push({
        table: 'products',
        id: row.id,
        name: row.name || 'Produk Tanpa Nama',
        tenantId: row.tenant_id,
        column: 'image_url',
        mimeType: meta.mimeType,
        ext: meta.ext,
        isValidMime: meta.isValid,
        sizeBytes: meta.byteLength,
        sizeKb: meta.kb,
        originalDataUrl: row.image_url,
        plannedUrl,
        status: meta.isValid ? 'PLANNED' : 'SKIPPED_INVALID',
        errorMessage: meta.error,
      });
    }
    console.log(`   Ditemukan: ${productQuery.rows.length} produk dengan Base64 image.\n`);

    // -------------------------------------------------------------------------
    // TAHAP 2: PINDAI & AUDIT TABEL "outlets" (receipt_config & payment_config)
    // -------------------------------------------------------------------------
    console.log('🏪 Memindai tabel "outlets" untuk kolom receipt_config & payment_config...');
    const outletQuery = await client.query(`
      SELECT 
        id, 
        name, 
        tenant_id, 
        receipt_config,
        payment_config
      FROM outlets
      WHERE receipt_config::text LIKE '%data:image/%'
         OR payment_config::text LIKE '%data:image/%'
      ORDER BY name ASC;
    `);

    for (const row of outletQuery.rows) {
      // Helper untuk ekstraksi rekursif Base64 dari konfigurasi JSON
      const extractBase64Fields = (obj: any, parentColumn: string, currentPath = ''): void => {
        if (!obj || typeof obj !== 'object') return;
        for (const [k, v] of Object.entries(obj)) {
          const fieldPath = currentPath ? `${currentPath}.${k}` : k;
          if (typeof v === 'string' && v.startsWith('data:image/')) {
            const meta = inspectBase64(v);
            const now = new Date();
            const dateFolder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const envPrefix = storageService.getEnvPrefix();
            const publicBase = (process.env.R2_PUBLIC_URL || 'https://pub-r2.wellpos.id').replace(/\/$/, '');
            const plannedUrl = `${publicBase}/${envPrefix}/tenants/${row.tenant_id}/outlets/${dateFolder}/<uuid>.${meta.ext}`;

            migrationItems.push({
              table: 'outlets',
              id: row.id,
              name: row.name || 'Outlet Tanpa Nama',
              tenantId: row.tenant_id,
              column: parentColumn,
              fieldPath,
              mimeType: meta.mimeType,
              ext: meta.ext,
              isValidMime: meta.isValid,
              sizeBytes: meta.byteLength,
              sizeKb: meta.kb,
              originalDataUrl: v,
              plannedUrl,
              status: meta.isValid ? 'PLANNED' : 'SKIPPED_INVALID',
              errorMessage: meta.error,
            });
          } else if (typeof v === 'object' && v !== null) {
            extractBase64Fields(v, parentColumn, fieldPath);
          }
        }
      };

      if (row.receipt_config) {
        extractBase64Fields(row.receipt_config, 'receipt_config');
      }
      if (row.payment_config) {
        extractBase64Fields(row.payment_config, 'payment_config');
      }
    }
    console.log(`   Ditemukan: ${outletQuery.rows.length} outlet dengan Base64 image.\n`);

    // -------------------------------------------------------------------------
    // TAHAP 3: EKSEKUSI MIGRASI (Hanya jika mode --execute aktif)
    // -------------------------------------------------------------------------
    let totalUpdated = 0;
    const failedRows: { id: string; target: string; error: string }[] = [];

    if (isExecute) {
      console.log('⚡ Memulai proses migrasi data ke Cloudflare R2...');

      // 3a. Migrasi Products
      const productItems = migrationItems.filter((i) => i.table === 'products' && i.isValidMime);
      for (const item of productItems) {
        try {
          process.stdout.write(`   Mengunggah produk "${item.name}" (${item.sizeKb} KB)... `);
          const newUrl = await storageService.resolveDataUrlToStorage({
            input: item.originalDataUrl,
            tenantId: item.tenantId,
            module: 'products',
            maxBytes: 5 * 1024 * 1024,
          });

          if (!newUrl) {
            throw new Error('StorageService mengembalikan URL kosong');
          }

          await client.query(
            `UPDATE products SET image_url = $1, updated_at = NOW() WHERE id = $2;`,
            [newUrl, item.id]
          );

          item.targetUrl = newUrl;
          item.status = 'MIGRATED';
          totalUpdated++;
          console.log(`✅ OK -> ${newUrl}`);
        } catch (err: any) {
          item.status = 'FAILED';
          item.errorMessage = err.message || String(err);
          failedRows.push({ id: item.id, target: `products.image_url (${item.name})`, error: item.errorMessage });
          console.log(`❌ GAGAL: ${item.errorMessage}`);
        }
      }

      // 3b. Migrasi Outlets (receipt_config & payment_config)
      const outletRowsToProcess = outletQuery.rows;
      for (const row of outletRowsToProcess) {
        let receiptConfigChanged = false;
        let paymentConfigChanged = false;
        let updatedRc = row.receipt_config ? JSON.parse(JSON.stringify(row.receipt_config)) : null;
        let updatedPc = row.payment_config ? JSON.parse(JSON.stringify(row.payment_config)) : null;

        const outletItems = migrationItems.filter((i) => i.table === 'outlets' && i.id === row.id && i.isValidMime);

        for (const item of outletItems) {
          try {
            process.stdout.write(`   Mengunggah outlet "${item.name}" [${item.column}.${item.fieldPath}] (${item.sizeKb} KB)... `);
            const newUrl = await storageService.resolveDataUrlToStorage({
              input: item.originalDataUrl,
              tenantId: item.tenantId,
              module: 'outlets',
              maxBytes: 5 * 1024 * 1024,
            });

            if (!newUrl) {
              throw new Error('StorageService mengembalikan URL kosong');
            }

            // Ganti nilai pada objek konfigurasi yang sesuai
            const applyDeepUrl = (obj: any, pathArr: string[]): boolean => {
              if (!obj || pathArr.length === 0) return false;
              const [head, ...rest] = pathArr;
              if (rest.length === 0) {
                if (typeof obj[head] === 'string') {
                  obj[head] = newUrl;
                  return true;
                }
                return false;
              }
              return applyDeepUrl(obj[head], rest);
            };

            const pathParts = (item.fieldPath || '').split('.');
            if (item.column === 'receipt_config' && updatedRc) {
              const changed = applyDeepUrl(updatedRc, pathParts);
              if (changed) receiptConfigChanged = true;
            } else if (item.column === 'payment_config' && updatedPc) {
              const changed = applyDeepUrl(updatedPc, pathParts);
              if (changed) paymentConfigChanged = true;
            }

            item.targetUrl = newUrl;
            item.status = 'MIGRATED';
            console.log(`✅ OK -> ${newUrl}`);
          } catch (err: any) {
            item.status = 'FAILED';
            item.errorMessage = err.message || String(err);
            failedRows.push({ id: item.id, target: `outlets.${item.column}.${item.fieldPath} (${item.name})`, error: item.errorMessage });
            console.log(`❌ GAGAL: ${item.errorMessage}`);
          }
        }

        // Simpan pembaruan JSON ke database jika ada field yang bermutasi
        if (receiptConfigChanged && updatedRc) {
          await client.query(`UPDATE outlets SET receipt_config = $1, updated_at = NOW() WHERE id = $2;`, [updatedRc, row.id]);
          totalUpdated++;
        }
        if (paymentConfigChanged && updatedPc) {
          await client.query(`UPDATE outlets SET payment_config = $1, updated_at = NOW() WHERE id = $2;`, [updatedPc, row.id]);
          totalUpdated++;
        }
      }

      // 3c. Pembersihan Dead Tuples & Pengecilan Disk TOAST
      if (totalUpdated > 0) {
        console.log('\n🧹 Menjalankan VACUUM ANALYZE pada tabel products & outlets...');
        await client.query('VACUUM ANALYZE products;');
        await client.query('VACUUM ANALYZE outlets;');
        console.log('✅ VACUUM ANALYZE selesai membersihkan dead tuples dan mereclaim ruang TOAST.');
      }
    }

    // -------------------------------------------------------------------------
    // TAHAP 4: TAMPILKAN DAFTAR RINCIAN HASIL / RENCANA MIGRASI
    // -------------------------------------------------------------------------
    console.log('\n========================================================================================================');
    console.log('📋 DAFTAR RINCIAN ITEM BASE64 YANG TERDETEKSI');
    console.log('========================================================================================================');
    console.log(
      `${'TIPE'.padEnd(10)} | ${'NAMA ENTITAS'.padEnd(30)} | ${'KOLOM / FIELD'.padEnd(25)} | ${'MIME'.padEnd(12)} | ${'UKURAN'.padEnd(10)} | STATUS / RENCANA TARGET`
    );
    console.log('--------------------------------------------------------------------------------------------------------');

    for (const item of migrationItems) {
      const fieldDisplay = item.fieldPath ? `${item.column}.${item.fieldPath}` : item.column;
      const targetDisplay =
        item.status === 'MIGRATED'
          ? item.targetUrl || ''
          : item.status === 'FAILED'
          ? `GAGAL: ${item.errorMessage}`
          : item.status === 'SKIPPED_INVALID'
          ? `DITOLAK: ${item.errorMessage}`
          : `[PLANNED] -> ${item.plannedUrl}`;

      const shortName = item.name.length > 28 ? item.name.slice(0, 27) + '…' : item.name;
      const shortField = fieldDisplay.length > 23 ? fieldDisplay.slice(0, 22) + '…' : fieldDisplay;

      console.log(
        `${item.table.padEnd(10)} | ${shortName.padEnd(30)} | ${shortField.padEnd(25)} | ${item.mimeType.padEnd(12)} | ${(item.sizeKb.toString() + ' KB').padEnd(10)} | ${targetDisplay}`
      );
    }
    console.log('========================================================================================================\n');

    // -------------------------------------------------------------------------
    // TAHAP 5: RINGKASAN METRIK & DAMPAK EFISIENSI TOAST
    // -------------------------------------------------------------------------
    const totalEntities = migrationItems.length;
    const validCount = migrationItems.filter((i) => i.isValidMime).length;
    const invalidCount = migrationItems.filter((i) => !i.isValidMime).length;
    const migratedCount = migrationItems.filter((i) => i.status === 'MIGRATED').length;
    const failedCount = migrationItems.filter((i) => i.status === 'FAILED').length;

    const totalRawBytes = migrationItems.reduce((acc, i) => acc + i.sizeBytes, 0);
    const totalRawKb = parseFloat((totalRawBytes / 1024).toFixed(2));
    const totalRawMb = parseFloat((totalRawBytes / (1024 * 1024)).toFixed(2));

    const finalSizes = isExecute && totalUpdated > 0 ? await getTableAndToastSizes(client, ['products', 'outlets']) : initialSizes;

    console.log('📊 RINGKASAN METRIK MIGRASI:');
    console.log(`   • Total Entitas Base64 Terdeteksi  : ${totalEntities}`);
    console.log(`     - Format Valid (Siap Migrasi)    : ${validCount}`);
    console.log(`     - Format Tidak Valid / Ditolak   : ${invalidCount}`);
    if (isExecute) {
      console.log(`   • Berhasil Dimigrasi ke R2 & DB    : ${migratedCount}`);
      console.log(`   • Gagal Dimigrasi                  : ${failedCount}`);
      console.log(`   • Total Baris Database Di-UPDATE   : ${totalUpdated}`);
    } else {
      console.log(`   • Status Simulasi                  : SEMUA ${validCount} ITEM VALID SIAP DIEKSEKUSI`);
    }
    console.log(`   • Total Ukuran Residu Base64       : ${totalRawKb.toLocaleString()} KB (~${totalRawMb} MB)`);

    console.log('\n💾 ESTIMASI / UKURAN RELASI TABEL & TOAST DI POSTGRESQL:');
    console.log('   Tabel      | Total Size | Table Size | TOAST Size');
    console.log('   -----------+------------+------------+-----------');
    for (const s of finalSizes) {
      console.log(`   ${s.relname.padEnd(10)} | ${s.totalSize.padEnd(10)} | ${s.tableSize.padEnd(10)} | ${s.toastSize}`);
    }

    if (isDryRun) {
      console.log('\n💡 CATATAN DRY-RUN:');
      console.log('   Tidak ada berkas yang diunggah ke Cloudflare R2 dan tidak ada modifikasi data di database.');
      console.log('   Untuk menjalankan migrasi riil secara live, pastikan kredensial R2 di .env telah terisi,');
      console.log('   lalu jalankan dengan flag: --execute\n');
    }

    if (failedRows.length > 0) {
      console.warn(`⚠️ Perhatian: Ada ${failedRows.length} baris yang mengalami kegagalan proses:`);
      for (const f of failedRows) {
        console.warn(`   - [${f.id}] ${f.target}: ${f.error}`);
      }
    }
  } catch (err: any) {
    console.error('\n❌ Terjadi kesalahan fatal saat menjalankan migrasi:', err);
    throw err;
  } finally {
    await client.end();
  }
}

// Eksekusi jika dijalankan langsung via CLI
if (require.main === module) {
  runBase64ToR2Migration()
    .then(() => {
      console.log('🏁 Selesai.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('💥 Script berhenti dengan error:', err);
      process.exit(1);
    });
}
