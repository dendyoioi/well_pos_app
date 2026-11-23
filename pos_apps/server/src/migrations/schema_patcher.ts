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
  {
    id: '20261007_02_saas_promos_clean_non_percent_max_discount',
    description: 'Membersihkan kolom max_discount menjadi NULL untuk promo yang bertipe nominal tetap (DISCOUNT_FIXED) atau token bonus (BONUS_TOKENS)',
    sql: `
      UPDATE "saas_promos" SET "max_discount" = NULL WHERE "type" != 'DISCOUNT_PERCENT';
    `,
  },
  {
    id: '20261010_01_sync_customer_lifetime_stats',
    description: 'Sinkronisasi total_spent, visit_count, tier, dan loyalty_points pelanggan dari transaksi riil orders (CRM)',
    sql: `UPDATE "customers" c
SET 
  "total_spent" = sub.total_spent,
  "visit_count" = sub.visit_count,
  "tier" = CASE
    WHEN sub.total_spent >= 15000000 THEN 'PLATINUM'::"CustomerTier"
    WHEN sub.total_spent >= 5000000 THEN 'GOLD'::"CustomerTier"
    WHEN sub.total_spent >= 1000000 THEN 'SILVER'::"CustomerTier"
    ELSE 'BRONZE'::"CustomerTier"
  END,
  "loyalty_points" = CASE 
    WHEN c.loyalty_points = 0 THEN FLOOR(sub.total_spent / 10000)
    ELSE c.loyalty_points 
  END
FROM (
  SELECT 
    customer_id, 
    SUM(grand_total) as total_spent, 
    COUNT(id) as visit_count 
  FROM "orders" 
  WHERE customer_id IS NOT NULL AND payment_status = 'PAID'
  GROUP BY customer_id
) sub
WHERE c.id = sub.customer_id AND (c.total_spent = 0 OR c.visit_count = 0 OR c.loyalty_points = 0);`,
  },
  {
    id: '20261011_02_promotion_items_and_scope',
    description: 'Menambahkan kolom scope pada tabel promotions dan tabel promotion_items untuk katalog diskon produk/item terkelola',
    sql: `
      ALTER TABLE "promotions" ADD COLUMN IF NOT EXISTS "scope" VARCHAR(50) DEFAULT 'ORDER';
      CREATE INDEX IF NOT EXISTS "promotions_tenant_id_scope_idx" ON "promotions"("tenant_id", "scope");

      CREATE TABLE IF NOT EXISTS "promotion_items" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
        "promotion_id" TEXT NOT NULL REFERENCES "promotions"("id") ON DELETE CASCADE,
        "product_id" TEXT NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
        "variant_id" TEXT REFERENCES "product_variants"("id") ON DELETE CASCADE,
        "discount_type" "DiscountType",
        "discount_value" DECIMAL(15, 2),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS "promotion_items_tenant_id_promotion_id_idx" ON "promotion_items"("tenant_id", "promotion_id");
      CREATE INDEX IF NOT EXISTS "promotion_items_tenant_id_product_id_idx" ON "promotion_items"("tenant_id", "product_id");
      CREATE INDEX IF NOT EXISTS "promotion_items_tenant_id_variant_id_idx" ON "promotion_items"("tenant_id", "variant_id");
    `,
  },
  {
    id: '20261013_01_email_verifications',
    description: 'Menambahkan tabel email_verifications untuk verifikasi kode OTP email dan proteksi pendaftaran anti-dummy email',
    sql: `
      CREATE TABLE IF NOT EXISTS "email_verifications" (
        "id" TEXT PRIMARY KEY,
        "email" VARCHAR(255) NOT NULL,
        "otp_hash" TEXT NOT NULL,
        "expires_at" TIMESTAMP(3) NOT NULL,
        "is_verified" BOOLEAN NOT NULL DEFAULT false,
        "verified_at" TIMESTAMP(3),
        "attempts" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS "email_verifications_email_is_verified_idx" ON "email_verifications"("email", "is_verified");
    `,
  },
  {
    id: '20261013_02_email_verifications_purpose',
    description: 'Menambahkan kolom purpose pada tabel email_verifications untuk mendukung reset kata sandi akun',
    sql: `
      ALTER TABLE "email_verifications" ADD COLUMN IF NOT EXISTS "purpose" VARCHAR(50) NOT NULL DEFAULT 'REGISTRATION';
      CREATE INDEX IF NOT EXISTS "email_verifications_email_purpose_is_verified_idx" ON "email_verifications"("email", "purpose", "is_verified");
    `,
  },
  {
    id: '20261029_01_product_bundles_and_price_tiers',
    description: 'Menambahkan tabel product_bundle_items dan product_price_tiers untuk paket komposit dan harga grosir bertingkat',
    sql: `
      CREATE TYPE "ProductType" AS ENUM ('STANDARD', 'COMPOSITE', 'SERVICE_LABOR');

      ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "type" "ProductType" DEFAULT 'STANDARD';

      CREATE TABLE IF NOT EXISTS "product_bundle_items" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
        "bundle_product_id" TEXT NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
        "bundle_variant_id" TEXT REFERENCES "product_variants"("id") ON DELETE CASCADE,
        "child_product_id" TEXT NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
        "child_variant_id" TEXT REFERENCES "product_variants"("id") ON DELETE RESTRICT,
        "quantity" DECIMAL(12, 4) NOT NULL DEFAULT 1.0000,
        "cost_allocation_percent" DECIMAL(5, 2),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS "product_bundle_items_tenant_id_bundle_product_id_idx" ON "product_bundle_items"("tenant_id", "bundle_product_id");
      CREATE INDEX IF NOT EXISTS "product_bundle_items_tenant_id_child_product_id_idx" ON "product_bundle_items"("tenant_id", "child_product_id");

      CREATE TABLE IF NOT EXISTS "product_price_tiers" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
        "product_id" TEXT NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
        "variant_id" TEXT REFERENCES "product_variants"("id") ON DELETE CASCADE,
        "min_quantity" INTEGER NOT NULL,
        "tier_price" DECIMAL(15, 2) NOT NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "product_price_tiers_tenant_id_product_id_variant_id_min_quant_key" UNIQUE ("tenant_id", "product_id", "variant_id", "min_quantity")
      );

      CREATE INDEX IF NOT EXISTS "product_price_tiers_tenant_id_product_id_idx" ON "product_price_tiers"("tenant_id", "product_id");
    `,
  },
  {
    id: '20261108_01_product_bundle_combo_slots',
    description: 'Menambahkan kolom slot_name, price_adjustment, dan is_default pada product_bundle_items untuk mendukung paket kombo dinamis berpilihan (mix & match)',
    sql: `
      ALTER TABLE "product_bundle_items" ADD COLUMN IF NOT EXISTS "slot_name" VARCHAR(100);
      ALTER TABLE "product_bundle_items" ADD COLUMN IF NOT EXISTS "price_adjustment" DECIMAL(15, 2) DEFAULT 0;
      ALTER TABLE "product_bundle_items" ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN DEFAULT FALSE;
    `,
  },
  {
    id: '20261119_01_laundry_services_and_racks',
    description: 'Menambahkan tabel laundry_services, laundry_racks, dan laundry_order_details untuk vertikal operasional POS Laundry & Dry Clean (EPIC-30)',
    sql: `
      CREATE TABLE IF NOT EXISTS "laundry_services" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
        "name" VARCHAR(255) NOT NULL,
        "category" VARCHAR(50) NOT NULL DEFAULT 'KILOAN',
        "unit" VARCHAR(20) NOT NULL DEFAULT 'KG',
        "price" DECIMAL(15, 2) NOT NULL DEFAULT 0,
        "min_order_qty" DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
        "duration_hours" INTEGER NOT NULL DEFAULT 48,
        "express_multiplier" DECIMAL(5, 2) NOT NULL DEFAULT 1.00,
        "description" TEXT,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "laundry_services_tenant_id_category_is_active_idx" ON "laundry_services"("tenant_id", "category", "is_active");

      CREATE TABLE IF NOT EXISTS "laundry_racks" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
        "outlet_id" TEXT NOT NULL REFERENCES "outlets"("id") ON DELETE RESTRICT,
        "code" VARCHAR(50) NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "category" VARCHAR(50) NOT NULL DEFAULT 'KILOAN',
        "capacity" INTEGER NOT NULL DEFAULT 10,
        "location_note" TEXT,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "laundry_racks_tenant_id_outlet_id_code_key" UNIQUE ("tenant_id", "outlet_id", "code")
      );
      CREATE INDEX IF NOT EXISTS "laundry_racks_tenant_id_outlet_id_is_active_idx" ON "laundry_racks"("tenant_id", "outlet_id", "is_active");

      CREATE TABLE IF NOT EXISTS "laundry_order_details" (
        "id" TEXT PRIMARY KEY,
        "order_id" TEXT NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
        "outlet_id" TEXT NOT NULL REFERENCES "outlets"("id") ON DELETE RESTRICT,
        "status" VARCHAR(50) NOT NULL DEFAULT 'RECEIVED',
        "rack_code" VARCHAR(50),
        "total_weight_kg" DECIMAL(10, 3),
        "total_pieces" INTEGER DEFAULT 0,
        "perfume_variant" VARCHAR(100),
        "estimated_ready_at" TIMESTAMP(3),
        "completed_at" TIMESTAMP(3),
        "picked_up_at" TIMESTAMP(3),
        "picked_up_by" VARCHAR(100),
        "customer_notes" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "laundry_order_details_order_id_key" UNIQUE ("order_id")
      );
      CREATE INDEX IF NOT EXISTS "laundry_order_details_tenant_id_outlet_id_status_idx" ON "laundry_order_details"("tenant_id", "outlet_id", "status");
      CREATE INDEX IF NOT EXISTS "laundry_order_details_tenant_id_rack_code_idx" ON "laundry_order_details"("tenant_id", "rack_code");
    `,
  },
  {
    id: '20261119_02_laundry_multi_branch_and_manifests',
    description: 'Menambahkan kolom is_workshop, transfer_status, dan tabel laundry_transfer_manifests serta laundry_transfer_items untuk mode workshop & mutasi cucian antar-cabang',
    sql: `
      ALTER TABLE "outlets" ADD COLUMN IF NOT EXISTS "is_workshop" BOOLEAN DEFAULT false;
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "transfer_status" VARCHAR(50) DEFAULT 'AT_OUTLET';
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "workshop_outlet_id" TEXT;

      CREATE INDEX IF NOT EXISTS "laundry_order_details_tenant_id_transfer_status_idx" ON "laundry_order_details"("tenant_id", "transfer_status");

      CREATE TABLE IF NOT EXISTS "laundry_transfer_manifests" (
        "id" TEXT PRIMARY KEY,
        "manifest_number" TEXT NOT NULL,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
        "source_outlet_id" TEXT NOT NULL REFERENCES "outlets"("id") ON DELETE RESTRICT,
        "target_outlet_id" TEXT NOT NULL REFERENCES "outlets"("id") ON DELETE RESTRICT,
        "status" VARCHAR(50) NOT NULL DEFAULT 'DISPATCHED',
        "direction" VARCHAR(50) NOT NULL DEFAULT 'TO_WORKSHOP',
        "driver_name" TEXT,
        "vehicle_plate" TEXT,
        "total_orders_count" INTEGER NOT NULL DEFAULT 0,
        "total_weight_kg" DECIMAL(10, 3),
        "notes" TEXT,
        "dispatched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "received_at" TIMESTAMP(3),
        "received_by" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "laundry_transfer_manifests_tenant_manifest_key" UNIQUE ("tenant_id", "manifest_number")
      );

      CREATE INDEX IF NOT EXISTS "laundry_transfer_manifests_source_idx" ON "laundry_transfer_manifests"("tenant_id", "source_outlet_id", "status");
      CREATE INDEX IF NOT EXISTS "laundry_transfer_manifests_target_idx" ON "laundry_transfer_manifests"("tenant_id", "target_outlet_id", "status");

      CREATE TABLE IF NOT EXISTS "laundry_transfer_items" (
        "id" TEXT PRIMARY KEY,
        "manifest_id" TEXT NOT NULL REFERENCES "laundry_transfer_manifests"("id") ON DELETE CASCADE,
        "order_id" TEXT NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        "notes" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "laundry_transfer_items_manifest_order_key" UNIQUE ("manifest_id", "order_id")
      );

      CREATE INDEX IF NOT EXISTS "laundry_transfer_items_order_idx" ON "laundry_transfer_items"("order_id");
    `,
  },
  {
    id: '20261119_03_laundry_11_production_stages_and_logs',
    description: 'Menambahkan kolom current_stage dan tabel laundry_stage_logs untuk audit trail 11 tahapan workflow produksi dan penilaian kinerja staf',
    sql: `
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "current_stage" VARCHAR(50) DEFAULT 'DROP_OFF';
      CREATE INDEX IF NOT EXISTS "laundry_order_details_tenant_id_current_stage_idx" ON "laundry_order_details"("tenant_id", "current_stage");

      CREATE TABLE IF NOT EXISTS "laundry_stage_logs" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
        "order_id" TEXT NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        "laundry_detail_id" TEXT NOT NULL REFERENCES "laundry_order_details"("id") ON DELETE CASCADE,
        "stage" VARCHAR(50) NOT NULL,
        "operator_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
        "operator_name" TEXT,
        "weight_kg" DECIMAL(10, 3),
        "pieces_count" INTEGER DEFAULT 0,
        "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "completed_at" TIMESTAMP(3),
        "duration_minutes" INTEGER,
        "notes" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS "laundry_stage_logs_tenant_order_idx" ON "laundry_stage_logs"("tenant_id", "order_id");
      CREATE INDEX IF NOT EXISTS "laundry_stage_logs_tenant_operator_stage_idx" ON "laundry_stage_logs"("tenant_id", "operator_id", "stage");
      CREATE INDEX IF NOT EXISTS "laundry_stage_logs_tenant_stage_completed_idx" ON "laundry_stage_logs"("tenant_id", "stage", "completed_at");
    `,
  },
  {
    id: '20261120_01_laundry_custom_stages_and_sorting',
    description: 'Menambahkan kolom laundry_stages pada tenants dan outlets, stages pada laundry_services, serta garment_counts, defects, defect_notes, is_sorted pada laundry_order_details untuk tahapan kustom dan formulir sortir pabrikasi binatu',
    sql: `
      ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "laundry_stages" JSONB;
      ALTER TABLE "outlets" ADD COLUMN IF NOT EXISTS "laundry_stages" JSONB;
      ALTER TABLE "laundry_services" ADD COLUMN IF NOT EXISTS "stages" JSONB;
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "garment_counts" JSONB;
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "defects" JSONB;
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "defect_notes" TEXT;
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "is_sorted" BOOLEAN DEFAULT FALSE;
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "sorted_at" TIMESTAMP(3);
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "sorted_by" TEXT;
    `,
  },
  {
    id: '20261121_01_payment_transactions_shift_tracking',
    description: 'Menambahkan kolom shift_id, outlet_id, dan cashier_id pada payment_transactions untuk pelacakan akuntansi kas laci lintas-shift dan pembayaran DP/pelunasan laundry',
    sql: `
      ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "shift_id" TEXT;
      ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "outlet_id" TEXT;
      ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "cashier_id" TEXT;

      ALTER TABLE "payment_transactions" DROP CONSTRAINT IF EXISTS "payment_transactions_shift_id_fkey";
      ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL;

      ALTER TABLE "payment_transactions" DROP CONSTRAINT IF EXISTS "payment_transactions_outlet_id_fkey";
      ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE SET NULL;

      ALTER TABLE "payment_transactions" DROP CONSTRAINT IF EXISTS "payment_transactions_cashier_id_fkey";
      ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE SET NULL;

      CREATE INDEX IF NOT EXISTS "payment_transactions_tenant_shift_status_idx" ON "payment_transactions"("tenant_id", "shift_id", "status");
      CREATE INDEX IF NOT EXISTS "payment_transactions_tenant_outlet_idx" ON "payment_transactions"("tenant_id", "outlet_id");
    `,
  },
  {
    id: '20261121_02_laundry_condition_photos_and_sla_index',
    description: 'Menambahkan kolom condition_photos (JSONB) pada laundry_order_details untuk foto dokumentasi anti-komplain sortir awal dan indeks komposit tenant_id, outlet_id, estimated_ready_at untuk filter instan SLA',
    sql: `
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "condition_photos" JSONB;
      CREATE INDEX IF NOT EXISTS "idx_laundry_details_tenant_outlet_sla" ON "laundry_order_details"("tenant_id", "outlet_id", "estimated_ready_at");
    `,
  },
  {
    id: '20261121_03_laundry_customer_wallet_and_quota',
    description: 'Menambahkan enum PaymentMethod CUSTOMER_DEPOSIT & LAUNDRY_QUOTA, tabel customer_laundry_wallets dan customer_laundry_wallet_ledgers untuk paket saldo deposit dan kuota kiloan pelanggan',
    sql: `
      ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CUSTOMER_DEPOSIT';
      ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'LAUNDRY_QUOTA';

      CREATE TABLE IF NOT EXISTS "customer_laundry_wallets" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
        "customer_id" TEXT NOT NULL UNIQUE REFERENCES "customers"("id") ON DELETE CASCADE,
        "balance_amount" DECIMAL(15, 2) NOT NULL DEFAULT 0,
        "quota_kg" DECIMAL(12, 3) NOT NULL DEFAULT 0,
        "quota_expires_at" TIMESTAMP(3),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "customer_laundry_wallets_tenant_customer_idx" ON "customer_laundry_wallets"("tenant_id", "customer_id");
      CREATE INDEX IF NOT EXISTS "customer_laundry_wallets_tenant_id_idx" ON "customer_laundry_wallets"("tenant_id");

      CREATE TABLE IF NOT EXISTS "customer_laundry_wallet_ledgers" (
        "id" TEXT PRIMARY KEY,
        "wallet_id" TEXT NOT NULL REFERENCES "customer_laundry_wallets"("id") ON DELETE CASCADE,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
        "outlet_id" TEXT NOT NULL REFERENCES "outlets"("id") ON DELETE RESTRICT,
        "order_id" TEXT REFERENCES "orders"("id") ON DELETE SET NULL,
        "shift_id" TEXT REFERENCES "shifts"("id") ON DELETE SET NULL,
        "cashier_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
        "ledger_type" VARCHAR(50) NOT NULL,
        "delta_amount" DECIMAL(15, 2) NOT NULL DEFAULT 0,
        "balance_before" DECIMAL(15, 2) NOT NULL DEFAULT 0,
        "balance_after" DECIMAL(15, 2) NOT NULL DEFAULT 0,
        "delta_kg" DECIMAL(12, 3) NOT NULL DEFAULT 0,
        "kg_before" DECIMAL(12, 3) NOT NULL DEFAULT 0,
        "kg_after" DECIMAL(12, 3) NOT NULL DEFAULT 0,
        "payment_method" VARCHAR(50),
        "notes" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS "customer_laundry_wallet_ledgers_tenant_wallet_idx" ON "customer_laundry_wallet_ledgers"("tenant_id", "wallet_id");
      CREATE INDEX IF NOT EXISTS "customer_laundry_wallet_ledgers_tenant_order_idx" ON "customer_laundry_wallet_ledgers"("tenant_id", "order_id");
      CREATE INDEX IF NOT EXISTS "customer_laundry_wallet_ledgers_tenant_shift_idx" ON "customer_laundry_wallet_ledgers"("tenant_id", "shift_id");
      CREATE INDEX IF NOT EXISTS "customer_laundry_wallet_ledgers_tenant_created_idx" ON "customer_laundry_wallet_ledgers"("tenant_id", "created_at");
    `,
  },
  {
    id: '20261121_04_query_performance_and_idempotency_indexes',
    description: 'Menambahkan index performa query orders cashier, laundry order details created_at & status untuk optimasi GCP e2-micro',
    sql: `
      -- 1. Index untuk riwayat order berdasarkan kasir dan waktu (optimasi audit shift & filter kasir)
      CREATE INDEX IF NOT EXISTS "orders_tenant_cashier_created_idx" ON "orders"("tenant_id", "cashier_id", "created_at" DESC);

      -- 2. Index untuk antrean laundry order details berdasarkan outlet dan waktu (optimasi getLaundryOrders)
      CREATE INDEX IF NOT EXISTS "laundry_order_details_tenant_outlet_created_idx" ON "laundry_order_details"("tenant_id", "outlet_id", "created_at" DESC);

      -- 3. Index untuk antrean laundry order details berdasarkan status dan waktu (optimasi filter status kanban)
      CREATE INDEX IF NOT EXISTS "laundry_order_details_tenant_status_created_idx" ON "laundry_order_details"("tenant_id", "status", "created_at" DESC);
    `,
  },
  {
    id: '20261122_01_laundry_delivery_and_ongkir_module',
    description: 'Menambahkan kolom delivery_config pada outlets dan kolom delivery_type, delivery_status, delivery_fee, dll pada laundry_order_details',
    sql: `
      -- 1. Tambah laundry_delivery_config ke outlets
      ALTER TABLE "outlets" ADD COLUMN IF NOT EXISTS "laundry_delivery_config" JSONB;

      -- 2. Tambah kolom delivery ke laundry_order_details
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "delivery_type" VARCHAR(50) NOT NULL DEFAULT 'NONE';
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "delivery_status" VARCHAR(50);
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "delivery_fee" DECIMAL(15, 2) NOT NULL DEFAULT 0;
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "delivery_zone_name" VARCHAR(100);
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "delivery_address" TEXT;
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "delivery_notes" TEXT;
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "delivery_scheduled_at" TIMESTAMP(3);
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "courier_name" VARCHAR(100);
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "courier_phone" VARCHAR(50);
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMP(3);
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "delivery_proof_photo_url" TEXT;

      -- 3. Tambah index delivery
      CREATE INDEX IF NOT EXISTS "laundry_order_details_tenant_outlet_delivery_idx" ON "laundry_order_details"("tenant_id", "outlet_id", "delivery_type", "delivery_status");
    `,
  },
  {
    id: '20261122_02_laundry_uom_conversion_and_bom_system',
    description: 'Menambahkan purchase_conversion_factor pada inventory_items, is_bom_deducted & bom_deducted_at pada laundry_order_details, dan tabel laundry_service_bom_items',
    sql: `
      ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "purchase_conversion_factor" DECIMAL(12, 4) NOT NULL DEFAULT 1;
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "is_bom_deducted" BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "bom_deducted_at" TIMESTAMP(3);

      CREATE TABLE IF NOT EXISTS "laundry_service_bom_items" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
        "laundry_service_id" TEXT NOT NULL REFERENCES "laundry_services"("id") ON DELETE CASCADE,
        "inventory_item_id" TEXT NOT NULL REFERENCES "inventory_items"("id") ON DELETE RESTRICT,
        "quantity_per_unit" DECIMAL(12, 3) NOT NULL,
        "consumption_basis" VARCHAR(20) NOT NULL DEFAULT 'PER_UNIT',
        "notes" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "laundry_service_bom_items_service_item_idx" ON "laundry_service_bom_items"("laundry_service_id", "inventory_item_id");
      CREATE INDEX IF NOT EXISTS "laundry_service_bom_items_tenant_service_idx" ON "laundry_service_bom_items"("tenant_id", "laundry_service_id");
    `,
  },
  {
    id: '20261122_03_laundry_commission_config',
    description: 'Menambahkan kolom laundry_commission_config pada tabel outlets untuk komisi staf & kurir laundry',
    sql: `
      ALTER TABLE "outlets" ADD COLUMN IF NOT EXISTS "laundry_commission_config" JSONB;
    `,
  },
];

const SCHEMA_PATCHER_LOCK_KEY = 88442211;

/**
 * Menjalankan auto-patcher skema secara non-blocking, idempotent, dan aman dari race condition multi-instance.
 * Menggunakan PostgreSQL advisory lock untuk memastikan hanya satu instance yang mengeksekusi DDL saat startup.
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

  let hasLock = false;

  try {
    // 0. Ambil PostgreSQL advisory lock agar instance lain tidak mengeksekusi patch bersamaan (zero-downtime deploy)
    try {
      const lockRows = await prisma.$queryRawUnsafe<{ locked: boolean }[]>(
        `SELECT pg_try_advisory_lock(${SCHEMA_PATCHER_LOCK_KEY}) AS locked;`
      );
      hasLock = Boolean(lockRows?.[0]?.locked);
      if (!hasLock) {
        console.log('[SchemaPatcher] ℹ️ Instance lain sedang menjalankan migrasi skema, melewati siklus ini.');
        return result;
      }
    } catch (lockErr: any) {
      console.warn('[SchemaPatcher] ⚠️ Gagal memperoleh advisory lock, melanjutkan dengan fallback:', lockErr?.message);
    }

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
  } finally {
    if (hasLock) {
      try {
        await prisma.$executeRawUnsafe(`SELECT pg_advisory_unlock(${SCHEMA_PATCHER_LOCK_KEY});`);
      } catch (unlockErr: any) {
        console.warn('[SchemaPatcher] ⚠️ Gagal melepaskan advisory lock:', unlockErr?.message);
      }
    }
  }

  return result;
}

/**
 * Menjalankan auto-patcher skema menggunakan DIRECT_URL (Port 5432) jika tersedia,
 * agar eksekusi DDL dan advisory lock tidak terblokir oleh PgBouncer Transaction Pooler (Port 6543).
 * Jika DIRECT_URL tidak diset, fallback menggunakan instance Prisma yang diberikan.
 */
export async function runAutoSchemaPatcherWithDirectUrl(fallbackPrisma: PrismaClient): Promise<{
  applied: string[];
  skipped: string[];
  failed: { id: string; error: string }[];
}> {
  const directUrl = process.env.DIRECT_URL?.trim();

  if (directUrl) {
    const directPrisma = new PrismaClient({
      datasources: {
        db: {
          url: directUrl,
        },
      },
      log: ['error'],
    });

    try {
      console.log('[SchemaPatcher] 🔌 Menjalankan migrasi skema via DIRECT_URL (Direct Port 5432)');
      return await runAutoSchemaPatcher(directPrisma);
    } finally {
      try {
        await directPrisma.$disconnect();
      } catch (discErr: any) {
        console.warn('[SchemaPatcher] ⚠️ Gagal disconnect direct Prisma instance:', discErr?.message);
      }
    }
  }

  return runAutoSchemaPatcher(fallbackPrisma);
}
