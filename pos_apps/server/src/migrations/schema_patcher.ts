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
  {
    id: '20261005_01_saas_promos_scope',
    description: 'Menambahkan kolom scope pada tabel saas_promos untuk pembedaan voucher promo pendaftaran vs top-up (EPIC-23 / Onboarding Pricing)',
    sql: 'ALTER TABLE "saas_promos" ADD COLUMN IF NOT EXISTS "scope" VARCHAR(50) DEFAULT \'ALL\';',
  },
  {
    id: '20261006_02_customer_debts_and_payments',
    description: 'Menambahkan model customer_debts dan customer_debt_payments untuk pencatatan kasbon piutang pelanggan dan pelunasan (Fase 2)',
    sql: `
      ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CUSTOMER_DEBT';

      CREATE TYPE "CustomerDebtStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'CANCELLED');

      CREATE TABLE IF NOT EXISTS "customer_debts" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
        "outlet_id" TEXT NOT NULL REFERENCES "outlets"("id") ON DELETE RESTRICT,
        "customer_id" TEXT NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT,
        "order_id" TEXT NOT NULL REFERENCES "orders"("id") ON DELETE RESTRICT,
        "total_amount" DECIMAL(15, 2) NOT NULL,
        "paid_amount" DECIMAL(15, 2) NOT NULL DEFAULT 0,
        "remaining_amount" DECIMAL(15, 2) NOT NULL,
        "due_date" TIMESTAMP(3),
        "status" "CustomerDebtStatus" NOT NULL DEFAULT 'UNPAID',
        "notes" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS "customer_debts_tenant_id_customer_id_idx" ON "customer_debts"("tenant_id", "customer_id");
      CREATE INDEX IF NOT EXISTS "customer_debts_tenant_id_outlet_id_idx" ON "customer_debts"("tenant_id", "outlet_id");
      CREATE INDEX IF NOT EXISTS "customer_debts_tenant_id_order_id_idx" ON "customer_debts"("tenant_id", "order_id");
      CREATE INDEX IF NOT EXISTS "customer_debts_tenant_id_status_idx" ON "customer_debts"("tenant_id", "status");

      CREATE TABLE IF NOT EXISTS "customer_debt_payments" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
        "debt_id" TEXT NOT NULL REFERENCES "customer_debts"("id") ON DELETE RESTRICT,
        "outlet_id" TEXT NOT NULL REFERENCES "outlets"("id") ON DELETE RESTRICT,
        "cashier_id" TEXT REFERENCES "users"("id") ON DELETE RESTRICT,
        "shift_id" TEXT REFERENCES "shifts"("id") ON DELETE RESTRICT,
        "amount" DECIMAL(15, 2) NOT NULL,
        "payment_method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
        "reference_number" TEXT,
        "notes" TEXT,
        "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS "customer_debt_payments_tenant_id_debt_id_idx" ON "customer_debt_payments"("tenant_id", "debt_id");
      CREATE INDEX IF NOT EXISTS "customer_debt_payments_tenant_id_outlet_id_idx" ON "customer_debt_payments"("tenant_id", "outlet_id");
      CREATE INDEX IF NOT EXISTS "customer_debt_payments_tenant_id_shift_id_idx" ON "customer_debt_payments"("tenant_id", "shift_id");
    `,
  },
  {
    id: '20261006_03_staff_attendance_and_multi_timezone',
    description: 'Menambahkan kolom timezone, attendance_config pada outlets dan model attendances untuk absensi staf mandiri & toleransi kehadiran (Fase 3)',
    sql: `
      CREATE TYPE "AttendanceStatus" AS ENUM ('ON_TIME', 'LATE', 'EARLY_LEAVE');

      ALTER TABLE "outlets" ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(50) DEFAULT 'Asia/Jakarta';
      ALTER TABLE "outlets" ADD COLUMN IF NOT EXISTS "attendance_config" JSONB;

      CREATE TABLE IF NOT EXISTS "attendances" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
        "outlet_id" TEXT NOT NULL REFERENCES "outlets"("id") ON DELETE RESTRICT,
        "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "work_date" VARCHAR(20) NOT NULL,
        "clock_in" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "clock_out" TIMESTAMP(3),
        "duration_minutes" INTEGER,
        "late_minutes" INTEGER DEFAULT 0,
        "status" "AttendanceStatus" NOT NULL DEFAULT 'ON_TIME',
        "notes" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS "attendances_tenant_id_outlet_id_work_date_idx" ON "attendances"("tenant_id", "outlet_id", "work_date");
      CREATE INDEX IF NOT EXISTS "attendances_tenant_id_user_id_work_date_idx" ON "attendances"("tenant_id", "user_id", "work_date");
    `,
  },
  {
    id: '20261007_01_saas_promos_is_published',
    description: 'Menambahkan kolom is_published dan description pada tabel saas_promos untuk halaman promo publik website dan manajemen superadmin',
    sql: `
      ALTER TABLE "saas_promos" ADD COLUMN IF NOT EXISTS "is_published" BOOLEAN NOT NULL DEFAULT true;
      ALTER TABLE "saas_promos" ADD COLUMN IF NOT EXISTS "description" TEXT;
    `,
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
          try {
            await prisma.$executeRawUnsafe(stmt);
          } catch (stmtErr: any) {
            if (
              stmtErr?.message?.includes('already exists') ||
              stmtErr?.code === '42710' ||
              stmtErr?.code === '42P07'
            ) {
              continue;
            }
            throw stmtErr;
          }
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
