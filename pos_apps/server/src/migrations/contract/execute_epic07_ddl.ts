import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Applying EPIC-07 Supply Chain & Purchasing DDL ---');

  const ddlStatements = [
    `DO $$ BEGIN
      CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    `DO $$ BEGIN
      CREATE TYPE "StockTransferStatus" AS ENUM ('DRAFT', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`,

    `CREATE TABLE IF NOT EXISTS "suppliers" (
      "id" TEXT PRIMARY KEY,
      "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
      "code" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "contact_name" TEXT,
      "phone" TEXT,
      "email" TEXT,
      "address" TEXT,
      "tax_id" TEXT,
      "payment_terms_days" INTEGER NOT NULL DEFAULT 0,
      "is_active" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_tenant_id_code_key" ON "suppliers"("tenant_id", "code");`,
    `CREATE INDEX IF NOT EXISTS "suppliers_tenant_id_is_active_idx" ON "suppliers"("tenant_id", "is_active");`,

    `CREATE TABLE IF NOT EXISTS "purchase_orders" (
      "id" TEXT PRIMARY KEY,
      "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
      "outlet_id" TEXT NOT NULL REFERENCES "outlets"("id") ON DELETE RESTRICT,
      "storage_location_id" TEXT NOT NULL REFERENCES "storage_locations"("id") ON DELETE RESTRICT,
      "supplier_id" TEXT NOT NULL REFERENCES "suppliers"("id") ON DELETE RESTRICT,
      "po_number" TEXT NOT NULL,
      "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
      "order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expected_delivery_date" TIMESTAMP(3),
      "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
      "tax_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
      "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
      "notes" TEXT,
      "created_by_user_id" TEXT REFERENCES "users"("id") ON DELETE RESTRICT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_tenant_id_po_number_key" ON "purchase_orders"("tenant_id", "po_number");`,
    `CREATE INDEX IF NOT EXISTS "purchase_orders_tenant_id_outlet_id_status_idx" ON "purchase_orders"("tenant_id", "outlet_id", "status");`,

    `CREATE TABLE IF NOT EXISTS "purchase_order_items" (
      "id" TEXT PRIMARY KEY,
      "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
      "purchase_order_id" TEXT NOT NULL REFERENCES "purchase_orders"("id") ON DELETE CASCADE,
      "inventory_item_id" TEXT NOT NULL REFERENCES "inventory_items"("id") ON DELETE RESTRICT,
      "quantity_ordered" DECIMAL(12,3) NOT NULL,
      "quantity_received" DECIMAL(12,3) NOT NULL DEFAULT 0,
      "unit_cost" DECIMAL(15,4) NOT NULL,
      "subtotal" DECIMAL(15,2) NOT NULL,
      "notes" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE INDEX IF NOT EXISTS "purchase_order_items_tenant_id_purchase_order_id_idx" ON "purchase_order_items"("tenant_id", "purchase_order_id");`,

    `CREATE TABLE IF NOT EXISTS "stock_transfers" (
      "id" TEXT PRIMARY KEY,
      "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
      "transfer_number" TEXT NOT NULL,
      "source_outlet_id" TEXT NOT NULL REFERENCES "outlets"("id") ON DELETE RESTRICT,
      "source_location_id" TEXT NOT NULL REFERENCES "storage_locations"("id") ON DELETE RESTRICT,
      "target_outlet_id" TEXT NOT NULL REFERENCES "outlets"("id") ON DELETE RESTRICT,
      "target_location_id" TEXT NOT NULL REFERENCES "storage_locations"("id") ON DELETE RESTRICT,
      "status" "StockTransferStatus" NOT NULL DEFAULT 'DRAFT',
      "dispatched_at" TIMESTAMP(3),
      "received_at" TIMESTAMP(3),
      "dispatched_by_user_id" TEXT REFERENCES "users"("id") ON DELETE RESTRICT,
      "received_by_user_id" TEXT REFERENCES "users"("id") ON DELETE RESTRICT,
      "notes" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE UNIQUE INDEX IF NOT EXISTS "stock_transfers_tenant_id_transfer_number_key" ON "stock_transfers"("tenant_id", "transfer_number");`,
    `CREATE INDEX IF NOT EXISTS "stock_transfers_tenant_id_source_outlet_id_target_outlet_id_idx" ON "stock_transfers"("tenant_id", "source_outlet_id", "target_outlet_id", "status");`,

    `CREATE TABLE IF NOT EXISTS "stock_transfer_items" (
      "id" TEXT PRIMARY KEY,
      "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
      "stock_transfer_id" TEXT NOT NULL REFERENCES "stock_transfers"("id") ON DELETE CASCADE,
      "inventory_item_id" TEXT NOT NULL REFERENCES "inventory_items"("id") ON DELETE RESTRICT,
      "inventory_batch_id" TEXT REFERENCES "inventory_batches"("id") ON DELETE RESTRICT,
      "quantity_dispatched" DECIMAL(12,3) NOT NULL,
      "quantity_received" DECIMAL(12,3) NOT NULL DEFAULT 0,
      "unit_cost" DECIMAL(15,4) NOT NULL DEFAULT 0,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE INDEX IF NOT EXISTS "stock_transfer_items_tenant_id_stock_transfer_id_idx" ON "stock_transfer_items"("tenant_id", "stock_transfer_id");`
  ];

  for (const sql of ddlStatements) {
    await prisma.$executeRawUnsafe(sql);
  }

  console.log('✅ EPIC-07 DDL applied successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
