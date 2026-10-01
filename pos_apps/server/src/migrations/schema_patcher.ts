import { PrismaClient } from '@prisma/client';

export interface SchemaPatch {
  id: string;
  description: string;
  sql: string;
}

/**
 * Daftar patch DDL skema database yang dieksekusi secara idempotent dan berurutan.
 * Setiap kali ada penambahan model, enum, atau kolom baru di Prisma schema,
 * daftarkan DDL patch di sini agar otomatis teraplikasi saat server Render boot
 * atau dijalankan via CLI remote migration.
 */
export const SCHEMA_PATCHES: SchemaPatch[] = [
  {
    id: '20260930_01_orders_queue_number',
    description: 'Menambahkan kolom queue_number pada tabel orders untuk nomor antrean kasir (EPIC-22)',
    sql: 'ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "queue_number" INTEGER;',
  },
  {
    id: '20260930_02_saas_invoices_pakasir',
    description: 'Menambahkan kolom qr_string, external_txn_id, dan payment_gateway pada saas_invoices untuk integrasi Pakasir (EPIC-23)',
    sql: 'ALTER TABLE "saas_invoices" ADD COLUMN IF NOT EXISTS "qr_string" TEXT, ADD COLUMN IF NOT EXISTS "external_txn_id" VARCHAR(255), ADD COLUMN IF NOT EXISTS "payment_gateway" VARCHAR(50) DEFAULT \'PAKASIR\';',
  },
  {
    id: '20260930_03_saas_invoices_standardize_setup_fee_99k',
    description: 'Standardisasi setup fee awal pendaftaran menjadi Rp 99.000 dan bonus token 100 per tenant',
    sql: 'UPDATE "saas_invoices" SET "amount" = 99000, "token_amount" = 100 WHERE ("invoice_number" LIKE \'INV-SETUP%\' OR "invoice_number" LIKE \'INV-REG%\') AND ("token_amount" = 500 OR "amount" = 199000);',
  },
  {
    id: '20260930_04_tenant_subscriptions_expires_at_nullable',
    description: 'Mengizinkan nilai null pada expires_at untuk langganan tanpa masa hangus (pay-as-you-go)',
    sql: 'ALTER TABLE "tenant_subscriptions" ALTER COLUMN "expires_at" DROP NOT NULL;',
  },
  {
    id: '20261002_01_outlets_loyalty_config',
    description: 'Menambahkan kolom loyalty_config pada tabel outlets untuk pengaturan program poin loyalitas per cabang (CRM)',
    sql: 'ALTER TABLE "outlets" ADD COLUMN IF NOT EXISTS "loyalty_config" JSONB;',
  },
  {
    id: '20261002_02_modifier_recipe_effects_table',
    description: 'Memastikan tabel modifier_recipe_effects dan indeks unik tersedia untuk menghubungkan pilihan modifier ke pemotongan stok bahan baku',
    sql: `CREATE TABLE IF NOT EXISTS "modifier_recipe_effects" (
      "id" TEXT PRIMARY KEY,
      "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
      "modifier_item_id" TEXT NOT NULL REFERENCES "modifier_items"("id") ON DELETE CASCADE,
      "inventory_item_id" TEXT NOT NULL REFERENCES "inventory_items"("id") ON DELETE RESTRICT,
      "quantity_delta" DECIMAL(12, 3) NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "modifier_recipe_effects_modifier_item_id_inventory_item_id_key" UNIQUE ("modifier_item_id", "inventory_item_id")
    );
    CREATE INDEX IF NOT EXISTS "modifier_recipe_effects_tenant_id_inventory_item_id_idx" ON "modifier_recipe_effects"("tenant_id", "inventory_item_id");`,
  },
  {
    id: '20261002_03_users_token_version',
    description: 'Menambahkan kolom token_version pada tabel users untuk pencabutan sesi perangkat instan (force logout / session revocation)',
    sql: 'ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "token_version" INTEGER NOT NULL DEFAULT 1;',
  },
  {
    id: '20261002_04_outlets_channels_config',
    description: 'Menambahkan kolom channels_config JSONB pada tabel outlets untuk kustomisasi kanal penjualan & mitra online (EPIC-20)',
    sql: 'ALTER TABLE "outlets" ADD COLUMN IF NOT EXISTS "channels_config" JSONB DEFAULT \'[]\'::jsonb;',
  },
];

/**
 * Menjalankan auto-patcher skema secara non-blocking dan idempotent.
 * Memastikan tabel pelacak `_schema_patches` tersedia sebelum mengeksekusi patch yang belum pernah dijalankan.
 */
export async function runAutoSchemaPatcher(prisma: PrismaClient): Promise<{
  applied: string[];
  skipped: string[];
  failed: { id: string; error: string }[];
}> {
  const result = {
    applied: [] as string[],
    skipped: [] as string[],
    failed: [] as { id: string; error: string }[],
  };

  try {
    // 1. Buat tabel pelacak patch jika belum ada
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_schema_patches" (
        "id" VARCHAR(255) PRIMARY KEY,
        "description" TEXT,
        "applied_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Ambil seluruh patch yang sudah pernah sukses dijalankan
    const appliedRows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT "id" FROM "_schema_patches";`
    );
    const appliedIds = new Set(appliedRows.map((r) => r.id));

    // 3. Eksekusi patch yang belum pernah diterapkan secara berurutan
    for (const patch of SCHEMA_PATCHES) {
      if (appliedIds.has(patch.id)) {
        result.skipped.push(patch.id);
        continue;
      }

      console.log(`[SchemaPatcher] ⏳ Menerapkan patch ${patch.id}: ${patch.description}`);
      try {
        // Eksekusi DDL patch (dukung multi-statement dipisah titik koma)
        const statements = patch.sql
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        for (const stmt of statements) {
          await prisma.$executeRawUnsafe(stmt);
        }

        // Catat ke tabel pelacak
        await prisma.$executeRawUnsafe(
          `INSERT INTO "_schema_patches" ("id", "description") VALUES ($1, $2) ON CONFLICT ("id") DO NOTHING;`,
          patch.id,
          patch.description
        );

        result.applied.push(patch.id);
        console.log(`[SchemaPatcher] ✅ Sukses menerapkan patch: ${patch.id}`);
      } catch (err: any) {
        console.warn(`[SchemaPatcher] ⚠️ Gagal menerapkan patch ${patch.id}:`, err.message);
        result.failed.push({ id: patch.id, error: err.message });
      }
    }
  } catch (err: any) {
    console.warn('[SchemaPatcher] ⚠️ Tidak dapat memeriksa tabel _schema_patches:', err.message);
  }

  return result;
}
