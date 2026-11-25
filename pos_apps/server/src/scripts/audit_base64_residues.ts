import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Muat urutan konfigurasi environment
const serverDir = path.resolve(__dirname, '../..');
const envPath = path.join(serverDir, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

interface Base64AuditFinding {
  table: string;
  id: string;
  name?: string;
  tenantId?: string;
  column: string;
  fieldPath?: string;
  preview: string;
  sizeBytes: number;
  sizeKb: number;
}

export async function runBase64ResidueAudit(dbUrl?: string): Promise<{
  targetDb: string;
  findings: Base64AuditFinding[];
  totalSizeBytes: number;
  totalSizeKb: number;
}> {
  const targetDb =
    dbUrl ||
    process.env.LOCAL_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres123@localhost:5432/pos_db';

  const maskedDb = targetDb.replace(/:([^:@]+)@/, ':****@');
  console.log('\n============================================================');
  console.log('🔍 WELL POS — BASE64 IMAGE RESIDUE AUDIT (READ-ONLY DRY-RUN)');
  console.log('============================================================');
  console.log(`🔌 Target Database: ${maskedDb}`);

  const client = new Client({ connectionString: targetDb });
  await client.connect();

  const findings: Base64AuditFinding[] = [];

  try {
    // 1. Audit Tabel Products (Kolom image_url)
    console.log('\n📦 Memeriksa tabel "products" (kolom image_url)...');
    const productRes = await client.query(`
      SELECT 
        id, 
        name, 
        tenant_id, 
        image_url,
        OCTET_LENGTH(image_url) AS size_bytes
      FROM products
      WHERE image_url LIKE 'data:image/%';
    `);

    for (const row of productRes.rows) {
      const sizeBytes = Number(row.size_bytes || (row.image_url ? Buffer.byteLength(row.image_url, 'utf8') : 0));
      findings.push({
        table: 'products',
        id: row.id,
        name: row.name,
        tenantId: row.tenant_id,
        column: 'image_url',
        preview: String(row.image_url).slice(0, 45) + '...',
        sizeBytes,
        sizeKb: parseFloat((sizeBytes / 1024).toFixed(2)),
      });
    }
    console.log(`   Ditemukan: ${productRes.rows.length} produk dengan gambar Base64.`);

    // 2. Audit Tabel Outlets (receipt_config & payment_config)
    console.log('\n🏪 Memeriksa tabel "outlets" (kolom receipt_config & payment_config)...');
    const outletRes = await client.query(`
      SELECT 
        id, 
        name, 
        tenant_id, 
        receipt_config,
        payment_config
      FROM outlets
      WHERE receipt_config::text LIKE '%data:image/%'
         OR payment_config::text LIKE '%data:image/%';
    `);

    for (const row of outletRes.rows) {
      // Periksa receipt_config
      if (row.receipt_config) {
        const rcStr = JSON.stringify(row.receipt_config);
        if (rcStr.includes('data:image/')) {
          // Cari properti spesifik yang memuat data:image/
          const findDeep = (obj: any, pathStr = ''): void => {
            if (!obj || typeof obj !== 'object') return;
            for (const [k, v] of Object.entries(obj)) {
              const currentPath = pathStr ? `${pathStr}.${k}` : k;
              if (typeof v === 'string' && v.startsWith('data:image/')) {
                const bLen = Buffer.byteLength(v, 'utf8');
                findings.push({
                  table: 'outlets',
                  id: row.id,
                  name: row.name,
                  tenantId: row.tenant_id,
                  column: 'receipt_config',
                  fieldPath: currentPath,
                  preview: v.slice(0, 45) + '...',
                  sizeBytes: bLen,
                  sizeKb: parseFloat((bLen / 1024).toFixed(2)),
                });
              } else if (typeof v === 'object') {
                findDeep(v, currentPath);
              }
            }
          };
          findDeep(row.receipt_config);
        }
      }

      // Periksa payment_config
      if (row.payment_config) {
        const pcStr = JSON.stringify(row.payment_config);
        if (pcStr.includes('data:image/')) {
          const findDeep = (obj: any, pathStr = ''): void => {
            if (!obj || typeof obj !== 'object') return;
            for (const [k, v] of Object.entries(obj)) {
              const currentPath = pathStr ? `${pathStr}.${k}` : k;
              if (typeof v === 'string' && v.startsWith('data:image/')) {
                const bLen = Buffer.byteLength(v, 'utf8');
                findings.push({
                  table: 'outlets',
                  id: row.id,
                  name: row.name,
                  tenantId: row.tenant_id,
                  column: 'payment_config',
                  fieldPath: currentPath,
                  preview: v.slice(0, 45) + '...',
                  sizeBytes: bLen,
                  sizeKb: parseFloat((bLen / 1024).toFixed(2)),
                });
              } else if (typeof v === 'object') {
                findDeep(v, currentPath);
              }
            }
          };
          findDeep(row.payment_config);
        }
      }
    }
    console.log(`   Ditemukan: ${outletRes.rows.length} outlet dengan konfigurasi Base64.`);

    // 3. Audit Seluruh Tabel Publik Lainnya (Pemeriksaan Menyeluruh)
    console.log('\n🔎 Memindai seluruh tabel publik lainnya untuk string "data:image/"...');
    const allTextColsRes = await client.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name NOT IN ('products', 'outlets', '_schema_patches', '_prisma_migrations')
        AND (data_type IN ('text', 'jsonb', 'character varying') OR data_type LIKE '%text%');
    `);

    let otherFoundCount = 0;
    for (const col of allTextColsRes.rows) {
      try {
        const queryStr = col.data_type === 'jsonb'
          ? `SELECT id, "${col.column_name}"::text AS val FROM "${col.table_name}" WHERE "${col.column_name}"::text LIKE '%data:image/%' LIMIT 10;`
          : `SELECT id, "${col.column_name}" AS val FROM "${col.table_name}" WHERE "${col.column_name}" LIKE '%data:image/%' LIMIT 10;`;
        
        const res = await client.query(queryStr);
        for (const r of res.rows) {
          const valStr = String(r.val || '');
          const bLen = Buffer.byteLength(valStr, 'utf8');
          findings.push({
            table: col.table_name,
            id: r.id,
            column: col.column_name,
            preview: valStr.slice(0, 45) + '...',
            sizeBytes: bLen,
            sizeKb: parseFloat((bLen / 1024).toFixed(2)),
          });
          otherFoundCount++;
        }
      } catch {
        // ignore missing id or type mismatches
      }
    }
    console.log(`   Tabel lainnya memuat: ${otherFoundCount} entri Base64.`);

  } finally {
    await client.end();
  }

  const totalSizeBytes = findings.reduce((sum, f) => sum + f.sizeBytes, 0);
  const totalSizeKb = parseFloat((totalSizeBytes / 1024).toFixed(2));

  console.log('\n============================================================');
  console.log(`📊 RINGKASAN HASIL AUDIT BASE64:`);
  console.log(`   • Total Temuan Baris / Field : ${findings.length}`);
  console.log(`   • Total Estimasi Ukuran      : ${totalSizeKb} KB (${(totalSizeKb / 1024).toFixed(2)} MB)`);
  console.log('============================================================\n');

  if (findings.length > 0) {
    console.log('📋 DAFTAR DETAIL TEMUAN BASE64:');
    findings.forEach((f, idx) => {
      console.log(
        ` [${idx + 1}] ${f.table}.${f.column}${f.fieldPath ? ` (${f.fieldPath})` : ''} | ID: ${f.id} | Nama: "${f.name || '-'}" | Ukuran: ${f.sizeKb} KB`
      );
    });
    console.log('\n');
  } else {
    console.log('✅ Tidak ditemukan residu Base64 pada database target.\n');
  }

  return {
    targetDb,
    findings,
    totalSizeBytes,
    totalSizeKb,
  };
}

// Eksekusi CLI jika dipanggil langsung
if (require.main === module) {
  const customDbUrl = process.argv[2];
  runBase64ResidueAudit(customDbUrl).catch((err) => {
    console.error('Fatal audit error:', err);
    process.exit(1);
  });
}
