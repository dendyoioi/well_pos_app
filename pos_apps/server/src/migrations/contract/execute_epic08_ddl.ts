import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Applying EPIC-08 CRM, Loyalty & Promotions DDL ---');

  const ddlStatements = [
    `DO $$ BEGIN
      CREATE TYPE "CustomerTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    `DO $$ BEGIN
      CREATE TYPE "PointTxType" AS ENUM ('EARNED_PURCHASE', 'REDEEMED_DISCOUNT', 'TIER_BONUS', 'MANUAL_ADJUSTMENT', 'REFUND_DEDUCT');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    `DO $$ BEGIN
      CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    `ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "tier" "CustomerTier" NOT NULL DEFAULT 'BRONZE';`,
    `ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "notes" TEXT;`,

    `CREATE TABLE IF NOT EXISTS "customer_point_ledgers" (
      "id" TEXT PRIMARY KEY,
      "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
      "customer_id" TEXT NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
      "order_id" TEXT REFERENCES "orders"("id") ON DELETE SET NULL,
      "delta_points" INTEGER NOT NULL,
      "balance_before" INTEGER NOT NULL,
      "balance_after" INTEGER NOT NULL,
      "type" "PointTxType" NOT NULL,
      "notes" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE INDEX IF NOT EXISTS "customer_point_ledgers_tenant_id_customer_id_idx" ON "customer_point_ledgers"("tenant_id", "customer_id");`,
    `CREATE INDEX IF NOT EXISTS "customer_point_ledgers_tenant_id_order_id_idx" ON "customer_point_ledgers"("tenant_id", "order_id");`,

    `CREATE TABLE IF NOT EXISTS "promotions" (
      "id" TEXT PRIMARY KEY,
      "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
      "code" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "discount_type" "DiscountType" NOT NULL,
      "discount_value" DECIMAL(15, 2) NOT NULL,
      "min_order_amount" DECIMAL(15, 2) NOT NULL DEFAULT 0,
      "max_discount_amount" DECIMAL(15, 2),
      "usage_limit" INTEGER,
      "usage_count" INTEGER NOT NULL DEFAULT 0,
      "per_customer_limit" INTEGER NOT NULL DEFAULT 1,
      "start_date" TIMESTAMP(3) NOT NULL,
      "end_date" TIMESTAMP(3) NOT NULL,
      "is_active" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE UNIQUE INDEX IF NOT EXISTS "promotions_tenant_id_code_key" ON "promotions"("tenant_id", "code");`,
    `CREATE INDEX IF NOT EXISTS "promotions_tenant_id_is_active_idx" ON "promotions"("tenant_id", "is_active");`,

    `CREATE TABLE IF NOT EXISTS "promotion_usages" (
      "id" TEXT PRIMARY KEY,
      "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
      "promotion_id" TEXT NOT NULL REFERENCES "promotions"("id") ON DELETE CASCADE,
      "customer_id" TEXT REFERENCES "customers"("id") ON DELETE SET NULL,
      "order_id" TEXT NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
      "discount_applied" DECIMAL(15, 2) NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE INDEX IF NOT EXISTS "promotion_usages_tenant_id_promotion_id_idx" ON "promotion_usages"("tenant_id", "promotion_id");`,
    `CREATE INDEX IF NOT EXISTS "promotion_usages_tenant_id_customer_id_idx" ON "promotion_usages"("tenant_id", "customer_id");`,
    `CREATE INDEX IF NOT EXISTS "promotion_usages_tenant_id_order_id_idx" ON "promotion_usages"("tenant_id", "order_id");`,

    `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "promotion_id" TEXT REFERENCES "promotions"("id") ON DELETE SET NULL;`,
    `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "points_earned" INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "points_redeemed" INTEGER NOT NULL DEFAULT 0;`,
    `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "point_discount_amount" DECIMAL(15, 2) NOT NULL DEFAULT 0;`
  ];

  for (const sql of ddlStatements) {
    await prisma.$executeRawUnsafe(sql);
  }

  console.log('✅ EPIC-08 DDL applied successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
