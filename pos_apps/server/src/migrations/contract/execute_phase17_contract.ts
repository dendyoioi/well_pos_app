import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== PHASE 17 CONTRACT DDL EXECUTION ===');

  // 1. Pre-DDL Inspection
  const tablesBefore: any[] = await prisma.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('outlet_products', 'stock_movements', 'payments');
  `);
  console.log('Tables to drop detected:', tablesBefore.map((t: any) => t.table_name));

  const colsBefore: any[] = await prisma.$queryRawUnsafe(`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND (
      (table_name = 'order_items' AND column_name = 'product_id') OR
      (table_name = 'products' AND column_name IN ('stock', 'min_stock_alert', 'cost_price', 'barcode', 'base_price'))
    );
  `);
  console.log('Columns to drop detected:', colsBefore);

  // 2. Drop Legacy Tables
  console.log('\nDropping legacy tables...');
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "outlet_products" CASCADE;`);
  console.log('  -> DROP TABLE "outlet_products" CASCADE: SUCCESS');

  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "stock_movements" CASCADE;`);
  console.log('  -> DROP TABLE "stock_movements" CASCADE: SUCCESS');

  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "payments" CASCADE;`);
  console.log('  -> DROP TABLE "payments" CASCADE: SUCCESS');

  // 3. Drop Legacy Columns
  console.log('\nDropping legacy columns on order_items...');
  await prisma.$executeRawUnsafe(`ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "order_items_product_id_fkey";`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "order_items" DROP COLUMN IF EXISTS "product_id";`);
  console.log('  -> DROP COLUMN "product_id" from "order_items": SUCCESS');

  console.log('\nDropping legacy columns on products...');
  await prisma.$executeRawUnsafe(`ALTER TABLE "products" DROP COLUMN IF EXISTS "stock";`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "products" DROP COLUMN IF EXISTS "min_stock_alert";`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "products" DROP COLUMN IF EXISTS "cost_price";`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "products" DROP COLUMN IF EXISTS "barcode";`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "products" DROP COLUMN IF EXISTS "base_price";`);
  console.log('  -> DROP COLUMNS (stock, min_stock_alert, cost_price, barcode, base_price) from "products": SUCCESS');

  // 4. Post-DDL Verification
  const tablesAfter: any[] = await prisma.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('outlet_products', 'stock_movements', 'payments');
  `);
  console.log('\nPost-DDL verification:');
  console.log('  Remaining legacy tables count:', tablesAfter.length);
  if (tablesAfter.length > 0) {
    throw new Error(`Failed: Legacy tables still exist: ${JSON.stringify(tablesAfter)}`);
  }

  const colsAfter: any[] = await prisma.$queryRawUnsafe(`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND (
      (table_name = 'order_items' AND column_name = 'product_id') OR
      (table_name = 'products' AND column_name IN ('stock', 'min_stock_alert', 'cost_price', 'barcode', 'base_price'))
    );
  `);
  console.log('  Remaining legacy columns count:', colsAfter.length);
  if (colsAfter.length > 0) {
    throw new Error(`Failed: Legacy columns still exist: ${JSON.stringify(colsAfter)}`);
  }

  console.log('\n=== CONTRACT DDL SUCCESSFULLY EXECUTED AND VERIFIED ===');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
