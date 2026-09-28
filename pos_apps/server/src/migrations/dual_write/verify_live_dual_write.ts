import { PrismaClient } from '@prisma/client';
import {
  catalogDualWriteService,
  inventoryDualWriteService,
  salesDualWriteService,
  CreateProductDTO,
  CheckoutOrderDTO,
} from '../../services/dual_write';

/**
 * LIVE DUAL-WRITE VERIFICATION SUITE (PROMPT 14.4)
 * Controlled smoke verification script running against live target database (pos_db).
 */
export async function runLiveDualWriteVerification(): Promise<boolean> {
  const prisma = new PrismaClient();
  const dbUrl = process.env.DATABASE_URL || '';
  const isPosDb = dbUrl.includes('/pos_db');

  console.log('================================================================');
  console.log('--- PROMPT 14.4: LIVE DUAL-WRITE ACTIVATION & SMOKE TEST ---');
  console.log('Target Database URL:', dbUrl.replace(/:[^:@]+@/, ':****@'));
  console.log('Target Database Name:', isPosDb ? 'pos_db (PRODUCTION)' : 'OTHER');
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================================\n');

  try {
    // 0. Resolve Live Base Context (Tenant, Outlet, Category, Users)
    const tenants: any[] = await prisma.$queryRawUnsafe(`SELECT id, business_name FROM tenants LIMIT 1`);
    if (tenants.length === 0) {
      throw new Error('Pre-flight check failed: No tenant found in database.');
    }
    const tenantId = tenants[0].id;
    console.log(`[0. Context] Active Tenant: ${tenants[0].business_name} (${tenantId})`);

    const outlets: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, name FROM outlets WHERE tenant_id = $1 ORDER BY (CASE WHEN name NOT LIKE 'Gudang%' THEN 0 ELSE 1 END), name ASC LIMIT 1`,
      tenantId
    );
    if (outlets.length === 0) {
      throw new Error('Pre-flight check failed: No outlet found for tenant.');
    }
    const outletId = outlets[0].id;
    console.log(`[0. Context] Active Outlet: ${outlets[0].name} (${outletId})`);

    const categories: any[] = await prisma.$queryRawUnsafe(`SELECT id, name FROM categories WHERE tenant_id = $1 LIMIT 1`, tenantId);
    const categoryId = categories.length > 0 ? categories[0].id : null;
    console.log(`[0. Context] Category: ${categories[0]?.name || 'N/A'} (${categoryId})`);

    const users: any[] = await prisma.$queryRawUnsafe(`SELECT id, email, role FROM users WHERE tenant_id = $1`, tenantId);
    const adminUser = users.find((u) => u.role === 'ADMIN' || u.role === 'OWNER') || users[0];
    const cashierUser = users.find((u) => u.role === 'CASHIER') || adminUser;
    console.log(`[0. Context] Actor Admin: ${adminUser.email} (${adminUser.id})`);
    console.log(`[0. Context] Actor Cashier: ${cashierUser.email} (${cashierUser.id})\n`);

    // -------------------------------------------------------------------------
    // STEP 1: CATALOG DUAL-WRITE (Create Product)
    // -------------------------------------------------------------------------
    console.log('[STEP 1] Executing CatalogDualWriteService.createProduct...');
    const liveSku = `SKU-LIVE-${Date.now().toString().slice(-6)}`;
    const productDto: CreateProductDTO = {
      name: 'Kopi Susu Gula Aren Spesial Live',
      sku: liveSku,
      categoryId: categoryId || '',
      basePrice: 22000,
      costPrice: 8000,
      initialStock: 50,
      unit: 'Cup',
      outletId,
    };

    const productResult = await prisma.$transaction(async (tx) => {
      return await catalogDualWriteService.createProduct(productDto, {
        tx,
        tenantId,
        actorUserId: adminUser.id,
      });
    });

    const productId = productResult.legacyData.id;
    const variantId = productResult.targetDetails?.variantId;
    const itemId = productResult.targetDetails?.inventoryItemId;
    console.log(`  -> Product Created: "${productDto.name}" (ID: ${productId}, SKU: ${liveSku})`);
    console.log(`  -> Target ProductVariant: ${variantId} (Price: Rp 22.000)`);
    console.log(`  -> Target InventoryItem: ${itemId} (UoM: Cup, AvgCost: Rp 8.000)`);

    // Direct DB Assertion for Step 1
    const [pCheck]: any[] = await prisma.$queryRawUnsafe(`SELECT id, name, base_price FROM products WHERE id = $1`, productId);
    const [pvCheck]: any[] = await prisma.$queryRawUnsafe(`SELECT id, product_id, price FROM product_variants WHERE id = $1`, variantId);
    const [opCheck]: any[] = await prisma.$queryRawUnsafe(`SELECT stock FROM outlet_products WHERE product_id = $1 AND outlet_id = $2`, productId, outletId);
    const [ibCheck]: any[] = await prisma.$queryRawUnsafe(`SELECT quantity_on_hand FROM inventory_balances WHERE inventory_item_id = $1`, itemId);

    if (!pCheck || !pvCheck || Number(opCheck.stock) !== 50 || Number(ibCheck.quantity_on_hand) !== 50) {
      throw new Error(`Step 1 Assertion Failed: Parity mismatch on initial product creation.`);
    }
    console.log(`  [PASS] Step 1 DB Verification: Legacy stock = ${opCheck.stock}, Target balance = ${ibCheck.quantity_on_hand}\n`);

    // -------------------------------------------------------------------------
    // STEP 2: INVENTORY DUAL-WRITE (Stock In)
    // -------------------------------------------------------------------------
    console.log('[STEP 2] Executing InventoryDualWriteService.recordStockIn...');
    const stockInQty = 20;
    await prisma.$transaction(async (tx) => {
      return await inventoryDualWriteService.recordStockIn(
        {
          productId,
          outletId,
          quantity: stockInQty,
          notes: 'Live Dual-Write Inbound Batch Verified',
        },
        {
          tx,
          tenantId,
          actorUserId: adminUser.id,
        }
      );
    });

    // Direct DB Assertion for Step 2
    const [opAfterIn]: any[] = await prisma.$queryRawUnsafe(`SELECT stock FROM outlet_products WHERE product_id = $1 AND outlet_id = $2`, productId, outletId);
    const [ibAfterIn]: any[] = await prisma.$queryRawUnsafe(`SELECT quantity_on_hand FROM inventory_balances WHERE inventory_item_id = $1`, itemId);

    if (Number(opAfterIn.stock) !== 70 || Number(ibAfterIn.quantity_on_hand) !== 70) {
      throw new Error(`Step 2 Assertion Failed: Expected stock 70, got legacy=${opAfterIn.stock}, target=${ibAfterIn.quantity_on_hand}`);
    }
    console.log(`  -> Stock In Recorded: +${stockInQty} units`);
    console.log(`  [PASS] Step 2 DB Verification: Legacy stock = ${opAfterIn.stock}, Target balance = ${ibAfterIn.quantity_on_hand}\n`);

    // -------------------------------------------------------------------------
    // STEP 3: SALES DUAL-WRITE (Checkout Kasir)
    // -------------------------------------------------------------------------
    console.log('[STEP 3] Executing SalesDualWriteService.processCheckout...');
    const sellQty = 2;
    const itemPrice = 22000;
    const itemCost = 8000;
    const totalSales = sellQty * itemPrice; // 44000
    const totalCost = sellQty * itemCost;   // 16000
    const checkoutDto: CheckoutOrderDTO = {
      targetOutletId: outletId,
      cashierId: cashierUser.id,
      items: [
        {
          productId,
          quantity: sellQty,
          costPrice: itemCost,
          unitPrice: itemPrice,
          subtotal: totalSales,
        },
      ],
      totalCost,
      subtotal: totalSales,
      grandTotal: totalSales,
      payments: [
        {
          method: 'CASH',
          amountPaid: 20000,
          changeGiven: 0,
        },
        {
          method: 'QRIS',
          amountPaid: 24000,
          qrisReference: `QRIS-LIVE-${Date.now().toString().slice(-6)}`,
        },
      ],
    };

    const orderResult = await prisma.$transaction(async (tx) => {
      return await salesDualWriteService.processCheckout(checkoutDto, {
        tx,
        tenantId,
        actorUserId: cashierUser.id,
      });
    });

    const orderId = orderResult.legacyData.id || orderResult.legacyData.order?.id;
    const invoiceNumber = orderResult.legacyData.invoiceNumber || orderResult.legacyData.order?.invoiceNumber;
    console.log(`  -> Order Created: ${invoiceNumber} (ID: ${orderId}, Total: Rp ${totalSales.toLocaleString('id-ID')})`);
    console.log(`  -> Split Payment: Cash (Rp 20.000) + QRIS (Rp 24.000)`);

    // Direct DB Assertion for Step 3
    const [opAfterSale]: any[] = await prisma.$queryRawUnsafe(`SELECT stock FROM outlet_products WHERE product_id = $1 AND outlet_id = $2`, productId, outletId);
    const [ibAfterSale]: any[] = await prisma.$queryRawUnsafe(`SELECT quantity_on_hand FROM inventory_balances WHERE inventory_item_id = $1`, itemId);
    const paymentsCount: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as cnt FROM payments WHERE order_id = $1`, orderId);
    const targetTxCount: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as cnt FROM payment_transactions WHERE order_id = $1`, orderId);
    const orderItems: any[] = await prisma.$queryRawUnsafe(`SELECT product_variant_id FROM order_items WHERE order_id = $1`, orderId);

    if (
      Number(opAfterSale.stock) !== 68 ||
      Number(ibAfterSale.quantity_on_hand) !== 68 ||
      Number(paymentsCount[0].cnt) !== 2 ||
      Number(targetTxCount[0].cnt) !== 2 ||
      orderItems[0].product_variant_id !== variantId
    ) {
      throw new Error(`Step 3 Assertion Failed: Discrepancy detected after retail order checkout.`);
    }
    console.log(`  [PASS] Step 3 DB Verification: Stock legacy=${opAfterSale.stock}, Target balance=${ibAfterSale.quantity_on_hand}`);
    console.log(`  [PASS] Payments Verification: 2 legacy rows & 2 payment_transactions rows.`);
    console.log(`  [PASS] Variant Linkage: order_items.product_variant_id correctly mapped to ${variantId}.\n`);

    console.log('================================================================');
    console.log('VERDICT: LIVE DUAL-WRITE SMOKE TEST PASSED 100% WITHOUT ERROR');
    console.log('================================================================\n');

    return true;
  } catch (err: any) {
    console.error('\n[FATAL ERROR] Live Dual-Write Verification Encountered Error:', err);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// CLI Entrypoint
if (require.main === module) {
  runLiveDualWriteVerification().then((passed) => {
    process.exit(passed ? 0 : 1);
  });
}
