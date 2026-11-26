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
  {
    id: '20261124_01_laundry_stage_logs_machine_name',
    description: 'Menambahkan kolom machine_name pada tabel laundry_stage_logs untuk pencatatan nomor mesin cuci/kering fisik',
    sql: `
      ALTER TABLE "laundry_stage_logs" ADD COLUMN IF NOT EXISTS "machine_name" VARCHAR(100);
    `,
  },
  {
    id: '20261124_02_outlets_laundry_deposit_config',
    description: 'Menambahkan kolom laundry_deposit_config pada tabel outlets untuk Master Paket Deposit & Aturan Expired',
    sql: `
      ALTER TABLE "outlets" ADD COLUMN IF NOT EXISTS "laundry_deposit_config" JSONB;
    `,
  },
  {
    id: '20261124_03_create_shift_cash_deposits',
    description: 'Membuat tabel shift_cash_deposits untuk pelacakan setoran kas shift ke bank/kas pusat beserta verifikasi owner',
    sql: `
      CREATE TABLE IF NOT EXISTS "shift_cash_deposits" (
        "id" VARCHAR(36) PRIMARY KEY,
        "tenant_id" VARCHAR(36) NOT NULL,
        "outlet_id" VARCHAR(36) NOT NULL,
        "shift_id" VARCHAR(36) NOT NULL,
        "cashier_id" VARCHAR(36) NOT NULL,
        "amount" DECIMAL(15, 2) NOT NULL,
        "target_account" VARCHAR(100) NOT NULL,
        "reference_number" VARCHAR(100),
        "proof_photo_url" TEXT,
        "notes" TEXT,
        "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        "verified_by_id" VARCHAR(36),
        "verified_at" TIMESTAMP(3),
        "rejection_reason" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "shift_cash_deposits_tenant_id_outlet_id_status_idx" ON "shift_cash_deposits"("tenant_id", "outlet_id", "status");
      CREATE INDEX IF NOT EXISTS "shift_cash_deposits_tenant_id_shift_id_idx" ON "shift_cash_deposits"("tenant_id", "shift_id");
    `,
  },
  {
    id: '20261124_04_create_staff_cash_advances',
    description: 'Membuat tabel staff_cash_advances untuk pencatatan kasbon karyawan dan pemotongan otomatis saat payout komisi',
    sql: `
      CREATE TABLE IF NOT EXISTS "staff_cash_advances" (
        "id" VARCHAR(36) PRIMARY KEY,
        "tenant_id" VARCHAR(36) NOT NULL,
        "outlet_id" VARCHAR(36) NOT NULL,
        "staff_id" VARCHAR(36),
        "staff_name" VARCHAR(200) NOT NULL,
        "amount" DECIMAL(15, 2) NOT NULL,
        "remaining_amount" DECIMAL(15, 2) NOT NULL,
        "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
        "reason" TEXT,
        "shift_id" VARCHAR(36),
        "created_by_id" VARCHAR(36),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "staff_cash_advances_tenant_id_outlet_id_status_idx" ON "staff_cash_advances"("tenant_id", "outlet_id", "status");
    `,
  },
  {
    id: '20261124_05_add_laundry_reminder_timestamps',
    description: 'Menambahkan kolom timestamp last_reminder_sent_at pada laundry_order_details dan last_expiry_reminder_sent_at pada customer_laundry_wallets',
    sql: `
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "last_reminder_sent_at" TIMESTAMP(3);
      ALTER TABLE "customer_laundry_wallets" ADD COLUMN IF NOT EXISTS "last_expiry_reminder_sent_at" TIMESTAMP(3);
    `,
  },
  {
    id: '20261124_06_add_order_items_unit_pricing_basis',
    description: 'Menambahkan kolom unit dan pricing_basis pada tabel order_items untuk snapshot klasifikasi kiloan vs satuan',
    sql: `
      ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "unit" VARCHAR(20);
      ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "pricing_basis" VARCHAR(20);
    `,
  },
  {
    id: '20261124_07_laundry_customer_feedback_and_retention',
    description: 'Menambahkan kolom google_review_url pada outlets, last_winback_sent_at pada customers, perfume_variant pada order_items, dan tabel laundry_customer_feedbacks untuk retensi & kepuasan pelanggan',
    sql: `
      ALTER TABLE "outlets" ADD COLUMN IF NOT EXISTS "google_review_url" TEXT;
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "last_winback_sent_at" TIMESTAMP(3);
      ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "perfume_variant" VARCHAR(100);

      CREATE TABLE IF NOT EXISTS "laundry_customer_feedbacks" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "outlet_id" TEXT NOT NULL REFERENCES "outlets"("id") ON DELETE CASCADE,
        "order_id" TEXT NOT NULL UNIQUE REFERENCES "orders"("id") ON DELETE CASCADE,
        "customer_id" TEXT REFERENCES "customers"("id") ON DELETE SET NULL,
        "rating" INTEGER NOT NULL,
        "category" VARCHAR(50),
        "comment" TEXT,
        "photo_url" TEXT,
        "is_complaint" BOOLEAN NOT NULL DEFAULT FALSE,
        "redirected_to_google" BOOLEAN NOT NULL DEFAULT FALSE,
        "status" VARCHAR(50) NOT NULL DEFAULT 'OPEN',
        "resolution_notes" TEXT,
        "handled_by_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
        "resolved_at" TIMESTAMP(3),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS "laundry_customer_feedbacks_outlet_status_created_idx" ON "laundry_customer_feedbacks"("outlet_id", "status", "created_at");
      CREATE INDEX IF NOT EXISTS "laundry_customer_feedbacks_tenant_outlet_rating_idx" ON "laundry_customer_feedbacks"("tenant_id", "outlet_id", "rating");
    `,
  },
  {
    id: '20261124_08_laundry_perfume_machine_service_addons_wallet',
    description: 'Menambahkan tabel laundry_perfumes, laundry_machines, kolom laundry_service_id & addons_snapshot pada order_items, dan balance_expires_at pada customer_laundry_wallets',
    sql: `
      CREATE TABLE IF NOT EXISTS "laundry_perfumes" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "outlet_id" TEXT REFERENCES "outlets"("id") ON DELETE SET NULL,
        "name" VARCHAR(100) NOT NULL,
        "extra_price" DECIMAL(15, 2) NOT NULL DEFAULT 0,
        "inventory_item_id" TEXT REFERENCES "inventory_items"("id") ON DELETE SET NULL,
        "usage_qty_per_unit" DECIMAL(12, 4) NOT NULL DEFAULT 0,
        "usage_basis" VARCHAR(20) NOT NULL DEFAULT 'PER_KG',
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "is_default" BOOLEAN NOT NULL DEFAULT FALSE,
        "sort_order" INTEGER NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "laundry_perfumes_tenant_active_sort_idx" ON "laundry_perfumes"("tenant_id", "is_active", "sort_order");

      ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "laundry_service_id" TEXT;
      ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "addons_snapshot" JSONB;

      CREATE TABLE IF NOT EXISTS "laundry_machines" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "outlet_id" TEXT NOT NULL REFERENCES "outlets"("id") ON DELETE CASCADE,
        "code" VARCHAR(50) NOT NULL,
        "name" VARCHAR(100) NOT NULL,
        "machine_type" VARCHAR(20) NOT NULL,
        "capacity_kg" DECIMAL(10, 2),
        "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "laundry_machines_outlet_code_key" UNIQUE ("outlet_id", "code")
      );
      CREATE INDEX IF NOT EXISTS "laundry_machines_tenant_outlet_idx" ON "laundry_machines"("tenant_id", "outlet_id");

      ALTER TABLE "customer_laundry_wallets" ADD COLUMN IF NOT EXISTS "balance_expires_at" TIMESTAMP(3);
    `,
  },
  {
    id: '20261124_09_laundry_incident_work_shift_performance_review',
    description: 'Menambahkan tabel laundry_incidents, work_shift_templates, staff_work_schedules, dan staff_performance_reviews',
    sql: `
      CREATE TABLE IF NOT EXISTS "laundry_incidents" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "outlet_id" TEXT NOT NULL REFERENCES "outlets"("id") ON DELETE CASCADE,
        "order_id" TEXT NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        "incident_type" VARCHAR(50) NOT NULL,
        "item_description" TEXT NOT NULL,
        "stage" VARCHAR(50),
        "machine_name" VARCHAR(50),
        "responsible_staff_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
        "reported_by_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "notes" TEXT NOT NULL,
        "photo_urls" JSONB,
        "estimated_compensation" DECIMAL(15, 2) NOT NULL DEFAULT 0,
        "approved_compensation" DECIMAL(15, 2) NOT NULL DEFAULT 0,
        "status" VARCHAR(30) NOT NULL DEFAULT 'OPEN',
        "resolution_notes" TEXT,
        "approved_by_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
        "resolved_at" TIMESTAMP(3),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "laundry_incidents_outlet_status_created_idx" ON "laundry_incidents"("outlet_id", "status", "created_at");
      CREATE INDEX IF NOT EXISTS "laundry_incidents_order_id_idx" ON "laundry_incidents"("order_id");

      CREATE TABLE IF NOT EXISTS "work_shift_templates" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "outlet_id" TEXT NOT NULL REFERENCES "outlets"("id") ON DELETE CASCADE,
        "name" VARCHAR(100) NOT NULL,
        "start_time" VARCHAR(10) NOT NULL,
        "end_time" VARCHAR(10) NOT NULL,
        "is_off_day" BOOLEAN NOT NULL DEFAULT FALSE,
        "color_hex" VARCHAR(20) NOT NULL DEFAULT '#1E3A8A',
        "grace_minutes" INTEGER NOT NULL DEFAULT 10,
        "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "work_shift_templates_tenant_outlet_active_idx" ON "work_shift_templates"("tenant_id", "outlet_id", "is_active");

      CREATE TABLE IF NOT EXISTS "staff_work_schedules" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "outlet_id" TEXT NOT NULL REFERENCES "outlets"("id") ON DELETE CASCADE,
        "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "shift_template_id" TEXT REFERENCES "work_shift_templates"("id") ON DELETE SET NULL,
        "schedule_date" VARCHAR(20) NOT NULL,
        "is_off_day" BOOLEAN NOT NULL DEFAULT FALSE,
        "notes" TEXT,
        "created_by_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "staff_work_schedules_outlet_user_date_key" UNIQUE ("outlet_id", "user_id", "schedule_date")
      );
      CREATE INDEX IF NOT EXISTS "staff_work_schedules_outlet_date_idx" ON "staff_work_schedules"("outlet_id", "schedule_date");
      CREATE INDEX IF NOT EXISTS "staff_work_schedules_user_date_idx" ON "staff_work_schedules"("user_id", "schedule_date");

      CREATE TABLE IF NOT EXISTS "staff_performance_reviews" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "outlet_id" TEXT NOT NULL REFERENCES "outlets"("id") ON DELETE CASCADE,
        "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "period_start" VARCHAR(20) NOT NULL,
        "period_end" VARCHAR(20) NOT NULL,
        "discipline_score" DOUBLE PRECISION NOT NULL,
        "productivity_score" DOUBLE PRECISION NOT NULL,
        "quality_score" DOUBLE PRECISION NOT NULL,
        "customer_score" DOUBLE PRECISION NOT NULL,
        "overall_score" DOUBLE PRECISION NOT NULL,
        "grade" VARCHAR(10) NOT NULL,
        "reviewer_notes" TEXT,
        "reviewed_by_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "staff_performance_reviews_outlet_user_period_idx" ON "staff_performance_reviews"("outlet_id", "user_id", "period_start", "period_end");
    `,
  },
  {
    id: '20261124_10_laundry_analytics_composite_indexes',
    description: 'Menambahkan 6 composite indexes untuk query performa analitik laundry dashboard (Wave 1)',
    sql: `
      CREATE INDEX IF NOT EXISTS "idx_orders_analytics_perf" ON "orders"("tenant_id", "outlet_id", "created_at", "order_status");
      CREATE INDEX IF NOT EXISTS "idx_order_items_pricing_basis" ON "order_items"("order_id", "pricing_basis", "laundry_service_id");
      CREATE INDEX IF NOT EXISTS "idx_payment_tx_cash_in" ON "payment_transactions"("tenant_id", "outlet_id", "status", "payment_method", "created_at");
      CREATE INDEX IF NOT EXISTS "idx_laundry_details_sla_stage" ON "laundry_order_details"("order_id", "current_stage", "estimated_ready_at", "completed_at");
      CREATE INDEX IF NOT EXISTS "idx_stage_logs_machine_perf" ON "laundry_stage_logs"("order_id", "stage", "machine_name", "completed_at");
      CREATE INDEX IF NOT EXISTS "idx_inventory_ledgers_consumption" ON "inventory_ledgers"("tenant_id", "movement_type", "created_at");
    `,
  },
  {
    id: '20261124_11_laundry_owner_dashboard_wave2_schema',
    description: 'Menambahkan model operational_expenses, outlet_business_targets, laundry_machine_maintenance_logs, dan relasi machine_id (Wave 2 Batch 1)',
    sql: `
      DO $$ BEGIN
        CREATE TYPE "ExpenseCategory" AS ENUM ('ELECTRICITY', 'WATER', 'RENT', 'SALARY', 'MARKETING', 'MAINTENANCE', 'SUPPLIES', 'OTHER');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS "operational_expenses" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
        "outlet_id" TEXT NOT NULL REFERENCES "outlets"("id") ON DELETE RESTRICT,
        "expense_date" TIMESTAMP(3) NOT NULL,
        "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
        "amount" DECIMAL(15, 2) NOT NULL,
        "payment_method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
        "notes" TEXT,
        "receipt_photo_url" TEXT,
        "created_by_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "operational_expenses_tenant_id_outlet_id_expense_date_idx" ON "operational_expenses"("tenant_id", "outlet_id", "expense_date");
      CREATE INDEX IF NOT EXISTS "operational_expenses_tenant_id_category_idx" ON "operational_expenses"("tenant_id", "category");

      CREATE TABLE IF NOT EXISTS "outlet_business_targets" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
        "outlet_id" TEXT NOT NULL REFERENCES "outlets"("id") ON DELETE RESTRICT,
        "period_year" INTEGER NOT NULL,
        "period_month" INTEGER NOT NULL,
        "target_revenue" DECIMAL(15, 2) NOT NULL DEFAULT 0,
        "target_profit" DECIMAL(15, 2) NOT NULL DEFAULT 0,
        "target_weight_kg" DECIMAL(10, 3) NOT NULL DEFAULT 0,
        "target_orders_count" INTEGER NOT NULL DEFAULT 0,
        "target_new_customers" INTEGER NOT NULL DEFAULT 0,
        "notes" TEXT,
        "created_by_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "outlet_business_targets_tenant_id_outlet_id_period_year_period_month_key" UNIQUE ("tenant_id", "outlet_id", "period_year", "period_month")
      );
      CREATE INDEX IF NOT EXISTS "outlet_business_targets_tenant_id_period_year_period_month_idx" ON "outlet_business_targets"("tenant_id", "period_year", "period_month");

      CREATE TABLE IF NOT EXISTS "laundry_machine_maintenance_logs" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
        "outlet_id" TEXT NOT NULL REFERENCES "outlets"("id") ON DELETE RESTRICT,
        "machine_id" TEXT NOT NULL REFERENCES "laundry_machines"("id") ON DELETE CASCADE,
        "service_type" TEXT NOT NULL DEFAULT 'ROUTINE',
        "start_date" TIMESTAMP(3) NOT NULL,
        "end_date" TIMESTAMP(3),
        "downtime_minutes" INTEGER NOT NULL DEFAULT 0,
        "technician_name" TEXT,
        "cost" DECIMAL(15, 2) NOT NULL DEFAULT 0,
        "notes" TEXT,
        "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
        "created_by_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "laundry_machine_maintenance_logs_tenant_id_outlet_id_machine_id_start_date_idx" ON "laundry_machine_maintenance_logs"("tenant_id", "outlet_id", "machine_id", "start_date");
      CREATE INDEX IF NOT EXISTS "laundry_machine_maintenance_logs_tenant_id_status_idx" ON "laundry_machine_maintenance_logs"("tenant_id", "status");

      ALTER TABLE "laundry_stage_logs" ADD COLUMN IF NOT EXISTS "machine_id" TEXT;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'laundry_stage_logs_machine_id_fkey') THEN
          ALTER TABLE "laundry_stage_logs" ADD CONSTRAINT "laundry_stage_logs_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "laundry_machines"("id") ON DELETE SET NULL;
        END IF;
      END $$;
      CREATE INDEX IF NOT EXISTS "laundry_stage_logs_tenant_id_machine_id_idx" ON "laundry_stage_logs"("tenant_id", "machine_id");

      ALTER TABLE "laundry_incidents" ADD COLUMN IF NOT EXISTS "machine_id" TEXT;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'laundry_incidents_machine_id_fkey') THEN
          ALTER TABLE "laundry_incidents" ADD CONSTRAINT "laundry_incidents_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "laundry_machines"("id") ON DELETE SET NULL;
        END IF;
      END $$;
      CREATE INDEX IF NOT EXISTS "laundry_incidents_tenant_id_machine_id_idx" ON "laundry_incidents"("tenant_id", "machine_id");
    `,
  },
  {
    id: '20261124_12_laundry_owner_dashboard_wave3a_alerting',
    description: 'Menambahkan tabel alert_rule_configs dan persistent_alerts untuk sistem peringatan dini persisten (Wave 3A)',
    sql: `
      CREATE TABLE IF NOT EXISTS "alert_rule_configs" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "outlet_id" TEXT REFERENCES "outlets"("id") ON DELETE CASCADE,
        "rule_key" TEXT NOT NULL,
        "warning_threshold" DECIMAL(12, 2) NOT NULL,
        "critical_threshold" DECIMAL(12, 2) NOT NULL,
        "is_enabled" BOOLEAN NOT NULL DEFAULT true,
        "notification_channels" JSONB,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "alert_rule_configs_tenant_id_outlet_id_rule_key_key" ON "alert_rule_configs"("tenant_id", "outlet_id", "rule_key") WHERE "outlet_id" IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS "alert_rule_configs_tenant_global_rule_key" ON "alert_rule_configs"("tenant_id", "rule_key") WHERE "outlet_id" IS NULL;
      CREATE INDEX IF NOT EXISTS "alert_rule_configs_tenant_id_is_enabled_idx" ON "alert_rule_configs"("tenant_id", "is_enabled");

      CREATE TABLE IF NOT EXISTS "persistent_alerts" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "outlet_id" TEXT NOT NULL REFERENCES "outlets"("id") ON DELETE CASCADE,
        "rule_key" TEXT NOT NULL,
        "severity" TEXT NOT NULL DEFAULT 'WARNING',
        "title" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "metric_value" DECIMAL(15, 2) NOT NULL,
        "threshold_value" DECIMAL(15, 2) NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'OPEN',
        "wa_notified_at" TIMESTAMP(3),
        "resolved_at" TIMESTAMP(3),
        "resolved_by_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
        "resolution_notes" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS "persistent_alerts_tenant_id_outlet_id_status_created_at_idx" ON "persistent_alerts"("tenant_id", "outlet_id", "status", "created_at");
      CREATE INDEX IF NOT EXISTS "persistent_alerts_tenant_id_rule_key_status_idx" ON "persistent_alerts"("tenant_id", "rule_key", "status");
    `,
  },
  {
    id: '20261125_01_owner_portal_business_entity',
    description: 'Menambahkan tabel businesses, kolom outlets.business_id, dan idempotent backfill untuk pemisahan multi-bisnis (Owner Portal Batch 1)',
    sql: `
      DO $$ BEGIN
        CREATE TYPE "BusinessVerticalMode" AS ENUM ('FNB', 'RETAIL', 'LAUNDRY');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS "businesses" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "name" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "vertical" "BusinessVerticalMode" NOT NULL DEFAULT 'FNB',
        "sub_category" TEXT,
        "logo_url" TEXT,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "businesses_tenant_id_slug_key" ON "businesses"("tenant_id", "slug");
      CREATE INDEX IF NOT EXISTS "businesses_tenant_id_vertical_is_active_idx" ON "businesses"("tenant_id", "vertical", "is_active");

      ALTER TABLE "outlets" ADD COLUMN IF NOT EXISTS "business_id" TEXT;

      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'outlets_business_id_fkey'
        ) THEN
          ALTER TABLE "outlets" ADD CONSTRAINT "outlets_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS "outlets_tenant_id_business_id_idx" ON "outlets"("tenant_id", "business_id");

      DO $$
      DECLARE
        rec RECORD;
        v_business_id TEXT;
        v_vertical "BusinessVerticalMode";
        v_name TEXT;
        v_slug TEXT;
      BEGIN
        FOR rec IN
          SELECT DISTINCT
            o.tenant_id,
            COALESCE(t.business_name, 'Bisnis Utama') AS tenant_name,
            COALESCE(t.slug, 'main') AS tenant_slug,
            CASE
              WHEN (o.industries::text ILIKE '%LAUNDRY%' OR o.name ILIKE '%Laundry%') THEN 'LAUNDRY'::"BusinessVerticalMode"
              WHEN t.business_vertical = 'RETAIL' THEN 'RETAIL'::"BusinessVerticalMode"
              WHEN t.business_vertical = 'FNB' THEN 'FNB'::"BusinessVerticalMode"
              WHEN t.business_vertical = 'SERVICES' THEN 'RETAIL'::"BusinessVerticalMode"
              ELSE 'FNB'::"BusinessVerticalMode"
            END AS computed_vertical
          FROM outlets o
          JOIN tenants t ON o.tenant_id = t.id
          WHERE o.business_id IS NULL
        LOOP
          v_vertical := rec.computed_vertical;
          
          IF v_vertical = 'LAUNDRY' THEN
            v_name := rec.tenant_name || ' Laundry';
            v_slug := rec.tenant_slug || '-laundry';
          ELSIF v_vertical = 'RETAIL' THEN
            v_name := rec.tenant_name || ' Retail';
            v_slug := rec.tenant_slug || '-retail';
          ELSE
            v_name := rec.tenant_name;
            v_slug := rec.tenant_slug || '-fnb';
          END IF;

          SELECT id INTO v_business_id
          FROM businesses
          WHERE tenant_id = rec.tenant_id AND slug = v_slug
          LIMIT 1;

          IF v_business_id IS NULL THEN
            v_business_id := gen_random_uuid()::text;
            INSERT INTO businesses (id, tenant_id, name, slug, vertical, is_active, created_at, updated_at)
            VALUES (v_business_id, rec.tenant_id, v_name, v_slug, v_vertical, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (tenant_id, slug) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
            RETURNING id INTO v_business_id;
          END IF;

          UPDATE outlets
          SET business_id = v_business_id
          WHERE tenant_id = rec.tenant_id
            AND business_id IS NULL
            AND (
              (v_vertical = 'LAUNDRY' AND (industries::text ILIKE '%LAUNDRY%' OR name ILIKE '%Laundry%'))
              OR
              (v_vertical <> 'LAUNDRY' AND NOT (industries::text ILIKE '%LAUNDRY%' OR name ILIKE '%Laundry%'))
            );
        END LOOP;
      END $$;

      DO $$
      DECLARE
        rec RECORD;
        v_bus_id TEXT;
      BEGIN
        FOR rec IN
          SELECT o.id, o.tenant_id, COALESCE(t.business_name, 'Bisnis Utama') AS bname, COALESCE(t.slug, 'main') AS bslug
          FROM outlets o
          LEFT JOIN tenants t ON o.tenant_id = t.id
          WHERE o.business_id IS NULL
        LOOP
          SELECT id INTO v_bus_id FROM businesses WHERE tenant_id = rec.tenant_id LIMIT 1;
          IF v_bus_id IS NULL THEN
            v_bus_id := gen_random_uuid()::text;
            INSERT INTO businesses (id, tenant_id, name, slug, vertical, is_active, created_at, updated_at)
            VALUES (v_bus_id, rec.tenant_id, rec.bname, rec.bslug || '-default', 'FNB', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (tenant_id, slug) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
            RETURNING id INTO v_bus_id;
          END IF;
          UPDATE outlets SET business_id = v_bus_id WHERE id = rec.id;
        END LOOP;
      END $$;
    `,
  },
  {
    id: '20261126_01_laundry_core_phase1_precision',
    description: 'Menambahkan customer laundry_preferences & secondary_phones, initial & final weight, QC checklist, laundry_lost_and_found, laundry_service_outlet_prices, dan laundry_service_price_histories (Laundry Core Phase 1)',
    sql: `
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "laundry_preferences" JSONB;
      ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "secondary_phones" JSONB;

      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "initial_weight_kg" NUMERIC(10,3);
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "final_weight_kg" NUMERIC(10,3);
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "weight_diff_reason" TEXT;
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "qc_checklist" JSONB;
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "qc_after_photos" JSONB;
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "qc_status" TEXT;
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "qc_checked_at" TIMESTAMPTZ;
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "qc_checked_by_id" TEXT;
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "qc_checked_by_name" TEXT;

      UPDATE "laundry_order_details"
      SET "initial_weight_kg" = "total_weight_kg"
      WHERE "initial_weight_kg" IS NULL AND "total_weight_kg" IS NOT NULL;

      CREATE TABLE IF NOT EXISTS "laundry_lost_and_found" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
        "outlet_id" TEXT NOT NULL REFERENCES "outlets"("id") ON DELETE RESTRICT,
        "order_id" TEXT REFERENCES "orders"("id") ON DELETE SET NULL,
        "customer_id" TEXT REFERENCES "customers"("id") ON DELETE SET NULL,
        "item_category" TEXT NOT NULL DEFAULT 'POCKET_ITEM',
        "item_name" TEXT NOT NULL,
        "description" TEXT,
        "photo_url" TEXT,
        "storage_location" TEXT,
        "status" TEXT NOT NULL DEFAULT 'FOUND',
        "found_by_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
        "found_by_name" TEXT,
        "claimed_by_name" TEXT,
        "returned_by_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
        "returned_at" TIMESTAMPTZ,
        "notes" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS "laundry_lost_and_found_tenant_id_outlet_id_status_created_at_idx"
        ON "laundry_lost_and_found"("tenant_id", "outlet_id", "status", "created_at");
      CREATE INDEX IF NOT EXISTS "laundry_lost_and_found_tenant_id_order_id_idx"
        ON "laundry_lost_and_found"("tenant_id", "order_id");

      CREATE TABLE IF NOT EXISTS "laundry_service_outlet_prices" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
        "outlet_id" TEXT NOT NULL REFERENCES "outlets"("id") ON DELETE RESTRICT,
        "laundry_service_id" TEXT NOT NULL REFERENCES "laundry_services"("id") ON DELETE CASCADE,
        "price_override" NUMERIC(15,2),
        "express_multiplier_override" NUMERIC(5,2),
        "is_available" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "laundry_service_outlet_prices_outlet_id_laundry_service_id_key"
        ON "laundry_service_outlet_prices"("outlet_id", "laundry_service_id");
      CREATE INDEX IF NOT EXISTS "laundry_service_outlet_prices_tenant_id_outlet_id_idx"
        ON "laundry_service_outlet_prices"("tenant_id", "outlet_id");

      CREATE TABLE IF NOT EXISTS "laundry_service_price_histories" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
        "laundry_service_id" TEXT NOT NULL REFERENCES "laundry_services"("id") ON DELETE CASCADE,
        "outlet_id" TEXT REFERENCES "outlets"("id") ON DELETE SET NULL,
        "old_price" NUMERIC(15,2) NOT NULL,
        "new_price" NUMERIC(15,2) NOT NULL,
        "reason" TEXT,
        "changed_by_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
        "changed_by_name" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS "laundry_service_price_histories_tenant_id_laundry_service_id_created_at_idx"
        ON "laundry_service_price_histories"("tenant_id", "laundry_service_id", "created_at");
      CREATE INDEX IF NOT EXISTS "laundry_service_price_histories_tenant_id_outlet_id_idx"
        ON "laundry_service_price_histories"("tenant_id", "outlet_id");
    `,
  },
  {
    id: '20261126_02_laundry_core_phase2_workshop',
    description: 'Menambahkan laundry_batches, laundry_batch_items, dan laundry_order_item_tracks (Laundry Core Phase 2 Workshop Efficiency & Traceability)',
    sql: `
      CREATE TABLE IF NOT EXISTS "laundry_batches" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "outlet_id" TEXT NOT NULL REFERENCES "outlets"("id") ON DELETE CASCADE,
        "batch_code" TEXT NOT NULL,
        "stage" TEXT NOT NULL DEFAULT 'WASHING',
        "machine_id" TEXT REFERENCES "laundry_machines"("id") ON DELETE SET NULL,
        "machine_name" TEXT,
        "color_group" TEXT,
        "total_weight_kg" NUMERIC(10,3) NOT NULL DEFAULT 0,
        "status" TEXT NOT NULL DEFAULT 'OPEN',
        "operator_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
        "operator_name" TEXT,
        "started_at" TIMESTAMPTZ,
        "completed_at" TIMESTAMPTZ,
        "notes" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "laundry_batches_tenant_id_batch_code_key"
        ON "laundry_batches"("tenant_id", "batch_code");
      CREATE INDEX IF NOT EXISTS "laundry_batches_tenant_id_outlet_id_status_created_at_idx"
        ON "laundry_batches"("tenant_id", "outlet_id", "status", "created_at");
      CREATE INDEX IF NOT EXISTS "laundry_batches_tenant_id_machine_id_idx"
        ON "laundry_batches"("tenant_id", "machine_id");

      CREATE TABLE IF NOT EXISTS "laundry_batch_items" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "batch_id" TEXT NOT NULL REFERENCES "laundry_batches"("id") ON DELETE CASCADE,
        "order_id" TEXT NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        "weight_kg" NUMERIC(10,3) NOT NULL DEFAULT 0,
        "notes" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "laundry_batch_items_batch_id_order_id_key"
        ON "laundry_batch_items"("batch_id", "order_id");
      CREATE INDEX IF NOT EXISTS "laundry_batch_items_tenant_id_order_id_idx"
        ON "laundry_batch_items"("tenant_id", "order_id");

      CREATE TABLE IF NOT EXISTS "laundry_order_item_tracks" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "outlet_id" TEXT NOT NULL REFERENCES "outlets"("id") ON DELETE CASCADE,
        "order_id" TEXT NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
        "tag_code" TEXT NOT NULL,
        "garment_name" TEXT NOT NULL,
        "category" TEXT,
        "color" TEXT,
        "brand" TEXT,
        "special_treatment" TEXT,
        "current_stage" TEXT NOT NULL DEFAULT 'TAGGED',
        "rack_code" TEXT,
        "photo_url" TEXT,
        "notes" TEXT,
        "handed_over_at" TIMESTAMPTZ,
        "handed_over_by_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
        "handed_over_by_name" TEXT,
        "received_by_name" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "laundry_order_item_tracks_tenant_id_tag_code_key"
        ON "laundry_order_item_tracks"("tenant_id", "tag_code");
      CREATE INDEX IF NOT EXISTS "laundry_order_item_tracks_tenant_id_order_id_idx"
        ON "laundry_order_item_tracks"("tenant_id", "order_id");
      CREATE INDEX IF NOT EXISTS "laundry_order_item_tracks_tenant_id_outlet_id_current_stage_idx"
        ON "laundry_order_item_tracks"("tenant_id", "outlet_id", "current_stage");
    `,
  },
  {
    id: '20261126_03_laundry_core_phase3_growth_automation',
    description: 'Menambahkan laundry_pickup_requests, notification_automation_rules, notification_dispatch_logs, dan kolom delivery failure di laundry_order_details (Laundry Core Phase 3 Growth, Self-Service & Automation)',
    sql: `
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "delivery_attempt_count" INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "delivery_last_failure_reason" TEXT;
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "delivery_rescheduled_at" TIMESTAMP(3);
      ALTER TABLE "laundry_order_details" ADD COLUMN IF NOT EXISTS "delivery_route_order" INTEGER;

      CREATE TABLE IF NOT EXISTS "laundry_pickup_requests" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "outlet_id" TEXT NOT NULL REFERENCES "outlets"("id") ON DELETE CASCADE,
        "customer_id" TEXT REFERENCES "customers"("id") ON DELETE SET NULL,
        "request_code" TEXT NOT NULL,
        "customer_name" TEXT NOT NULL,
        "customer_phone" TEXT NOT NULL,
        "pickup_address" TEXT NOT NULL,
        "pickup_notes" TEXT,
        "preferred_pickup_at" TIMESTAMP(3),
        "estimated_weight_kg" DECIMAL(10, 3),
        "service_category" TEXT,
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "courier_name" TEXT,
        "courier_phone" TEXT,
        "assigned_driver_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
        "route_order" INTEGER,
        "attempt_count" INTEGER NOT NULL DEFAULT 0,
        "last_failure_reason" TEXT,
        "rescheduled_at" TIMESTAMP(3),
        "picked_up_at" TIMESTAMP(3),
        "converted_order_id" TEXT REFERENCES "orders"("id") ON DELETE SET NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "laundry_pickup_requests_tenant_id_request_code_key"
        ON "laundry_pickup_requests"("tenant_id", "request_code");
      CREATE INDEX IF NOT EXISTS "laundry_pickup_requests_tenant_id_outlet_id_status_created_at_idx"
        ON "laundry_pickup_requests"("tenant_id", "outlet_id", "status", "created_at");
      CREATE INDEX IF NOT EXISTS "laundry_pickup_requests_tenant_id_customer_phone_idx"
        ON "laundry_pickup_requests"("tenant_id", "customer_phone");

      CREATE TABLE IF NOT EXISTS "notification_automation_rules" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "outlet_id" TEXT REFERENCES "outlets"("id") ON DELETE CASCADE,
        "event_key" TEXT NOT NULL,
        "is_enabled" BOOLEAN NOT NULL DEFAULT true,
        "channels" JSONB NOT NULL DEFAULT '["IN_APP", "WHATSAPP"]'::jsonb,
        "message_template" TEXT NOT NULL,
        "updated_by_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "notification_automation_rules_tenant_id_outlet_id_event_key_key"
        ON "notification_automation_rules"("tenant_id", "outlet_id", "event_key");
      CREATE INDEX IF NOT EXISTS "notification_automation_rules_tenant_id_event_key_is_enabled_idx"
        ON "notification_automation_rules"("tenant_id", "event_key", "is_enabled");

      CREATE TABLE IF NOT EXISTS "notification_dispatch_logs" (
        "id" TEXT PRIMARY KEY,
        "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "outlet_id" TEXT REFERENCES "outlets"("id") ON DELETE SET NULL,
        "event_key" TEXT NOT NULL,
        "channel" TEXT NOT NULL,
        "recipient_name" TEXT,
        "recipient_phone" TEXT,
        "recipient_email" TEXT,
        "reference_type" TEXT,
        "reference_id" TEXT,
        "message_body" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'SENT',
        "retry_count" INTEGER NOT NULL DEFAULT 0,
        "error_message" TEXT,
        "sent_at" TIMESTAMP(3),
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS "notification_dispatch_logs_tenant_id_event_key_status_created_at_idx"
        ON "notification_dispatch_logs"("tenant_id", "event_key", "status", "created_at");
      CREATE INDEX IF NOT EXISTS "notification_dispatch_logs_tenant_id_outlet_id_created_at_idx"
        ON "notification_dispatch_logs"("tenant_id", "outlet_id", "created_at");
    `,
  },
];

const SCHEMA_PATCHER_LOCK_KEY = 88442211;

/**
 * Memecah string DDL SQL menjadi pernyataan-pernyataan individual dengan memperhitungkan
 * blok dollar-quote PostgreSQL (DO $$ BEGIN ... END $$;) agar tidak terpotong oleh semicolon internal.
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarQuote = false;

  for (let i = 0; i < sql.length; i++) {
    if (sql.startsWith('$$', i)) {
      inDollarQuote = !inDollarQuote;
      current += '$$';
      i++;
      continue;
    }

    if (sql[i] === ';' && !inDollarQuote) {
      if (current.trim().length > 0) {
        statements.push(current.trim());
      }
      current = '';
    } else {
      current += sql[i];
    }
  }

  if (current.trim().length > 0) {
    statements.push(current.trim());
  }

  return statements;
}

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
        // Eksekusi DDL patch (dukung multi-statement dipisah titik koma dengan dollar-quoting safety)
        const statements = splitSqlStatements(patch.sql);
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
