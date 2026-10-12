import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { generateCompanyId } from '../utils/companyId.util';

// Deteksi apakah target adalah remote production/Supabase
const isRemote = process.argv.includes('--remote');
const serverDir = path.resolve(__dirname, '../..');

if (isRemote) {
  const envProdPath = path.join(serverDir, '.env.production');
  if (fs.existsSync(envProdPath)) {
    dotenv.config({ path: envProdPath, override: true });
    console.log(`[Config] 📄 Menggunakan kredensial remote dari: ${path.basename(envProdPath)}`);
  }
} else {
  dotenv.config({ path: path.join(serverDir, '.env') });
}

const targetDbUrl = isRemote
  ? process.env.REMOTE_DATABASE_URL || process.env.DATABASE_URL
  : process.env.DATABASE_URL;

if (!targetDbUrl) {
  console.error('\n❌ Eror: Tidak ada DATABASE_URL yang ditemukan.');
  process.exit(1);
}

const maskedUrl = targetDbUrl.replace(/:([^:@]+)@/, ':****@');
console.log(`[DB] 🔌 Terhubung ke target database (${isRemote ? 'REMOTE SUPABASE' : 'LOCAL'}): ${maskedUrl}`);

const dbClient = new PrismaClient({
  datasources: {
    db: {
      url: targetDbUrl,
    },
  },
});

async function migrateTenantCompanyIds() {
  console.log('========================================================================');
  console.log(`🚀 MEMULAI MIGRASI MASSAL COMPANY ID TENANT KE FORMAT ALPHANUMERIC (${isRemote ? 'REMOTE SERVER' : 'LOCAL'})`);
  console.log('   Format Baku: [3 Huruf Inisial]-[4 Angka Acak][3 Digit Urutan]');
  console.log('   Contoh: DND-4829001');
  console.log('========================================================================\n');

  try {
    const tenants = await dbClient.tenant.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        users: {
          where: { role: 'ADMIN' },
          select: { id: true, name: true, email: true },
          take: 1,
        },
      },
    });

    console.log(`📊 Ditemukan total ${tenants.length} tenant di database.`);
    console.log('------------------------------------------------------------------------');
    console.log(
      'No.'.padEnd(4) +
      'Nama Tenant'.padEnd(26) +
      'ID Lama (Slug)'.padEnd(24) +
      'Company ID Baru (Alphanumeric)'.padEnd(20)
    );
    console.log('------------------------------------------------------------------------');

    const migrationSummary: Array<{
      no: number;
      tenantId: string;
      name: string;
      oldSlug: string;
      newSlug: string;
      ownerName: string;
    }> = [];

    const usedSlugs = new Set<string>();

    for (let i = 0; i < tenants.length; i++) {
      const tenant = tenants[i];
      const sequenceNumber = i + 1;

      // Prioritas nama: nama User Admin/Owner -> nama Tenant
      const ownerName = tenant.users[0]?.name || tenant.name || 'Owner';

      let newSlug = '';
      let attempts = 0;
      do {
        newSlug = generateCompanyId(ownerName, sequenceNumber);
        attempts++;
      } while (usedSlugs.has(newSlug) && attempts < 20);

      usedSlugs.add(newSlug);

      // Eksekusi update ke database
      await dbClient.tenant.update({
        where: { id: tenant.id },
        data: { slug: newSlug },
      });

      migrationSummary.push({
        no: sequenceNumber,
        tenantId: tenant.id,
        name: tenant.name,
        oldSlug: tenant.slug,
        newSlug,
        ownerName,
      });

      console.log(
        String(sequenceNumber).padEnd(4) +
        tenant.name.slice(0, 24).padEnd(26) +
        tenant.slug.slice(0, 22).padEnd(24) +
        newSlug.padEnd(20)
      );
    }

    console.log('------------------------------------------------------------------------');
    console.log(`✅ BERHASIL! Seluruh ${tenants.length} tenant telah dimigrasikan ke Company ID baru.`);
    console.log('========================================================================\n');

    return migrationSummary;
  } catch (error) {
    console.error('❌ Terjadi kesalahan saat migrasi:', error);
    throw error;
  } finally {
    await dbClient.$disconnect();
  }
}

// Eksekusi langsung jika dipanggil via CLI
if (require.main === module) {
  migrateTenantCompanyIds()
    .then(() => {
      console.log('✨ Skrip migrasi selesai dengan sukses (EXIT 0).');
      process.exit(0);
    })
    .catch((err) => {
      console.error('💥 Migrasi gagal:', err);
      process.exit(1);
    });
}

export { migrateTenantCompanyIds };
