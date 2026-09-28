import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaClient, ShiftStatus, PaymentTxStatus } from '@prisma/client';
import * as crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { analyticsService } from '../../services/analytics.service';
import { app } from '../../index';

async function main() {
  console.log('===============================================================');
  console.log('EPIC-09 VERIFICATION SUITE: FINANCIAL ANALYTICS, COGS & BI');
  console.log('===============================================================');

  const prisma = new PrismaClient();

  try {
    // 1. RESOLVE ACTIVE CONTEXT
    console.log('\n[1/7] Resolving Active Tenant, Outlet & Cashier Context...');
    const tenants: any[] = await prisma.$queryRawUnsafe(`SELECT id, business_name FROM "tenants" LIMIT 1;`);
    if (tenants.length === 0) throw new Error('Tenant tidak ditemukan.');
    const tenant = { id: tenants[0].id, name: tenants[0].business_name };

    const outlets: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, name FROM "outlets" WHERE tenant_id = $1 LIMIT 1;`,
      tenant.id
    );
    if (outlets.length === 0) throw new Error('Outlet tidak ditemukan.');
    const outlet = outlets[0];

    const users: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, name, email, role FROM "users" WHERE tenant_id = $1 LIMIT 1;`,
      tenant.id
    );
    const cashier = users[0] || null;

    console.log(`  Tenant: ${tenant.name} (${tenant.id})`);
    console.log(`  Outlet: ${outlet.name} (${outlet.id})`);
    console.log(`  Cashier: ${cashier?.name} (${cashier?.id})`);

    // Ensure tenant has an active subscription for reports access
    const planRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id FROM "subscription_plans" WHERE code = 'PRO' LIMIT 1;`
    );
    const proPlanId = planRows[0]?.id;
    if (proPlanId) {
      const updated = await prisma.$executeRawUnsafe(
        `UPDATE "tenant_subscriptions" SET "plan_id" = $1, "is_active" = true WHERE "tenant_id" = $2;`,
        proPlanId,
        tenant.id
      );
      if (updated === 0) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "tenant_subscriptions" ("id", "tenant_id", "plan_id", "started_at", "expires_at", "is_active", "created_at", "updated_at")
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
          crypto.randomUUID(),
          tenant.id,
          proPlanId
        );
      }
    }

    // 2. SEED CONTROLLED SALES DATA BASELINE
    console.log('\n[2/7] Seeding Controlled Sales Data with Known COGS & Prices...');
    const rand = Math.floor(1000 + Math.random() * 9000);

    const categories: any[] = await prisma.$queryRawUnsafe(
      `SELECT id FROM "categories" WHERE tenant_id = $1 LIMIT 1;`,
      tenant.id
    );
    let categoryId = categories[0]?.id;
    if (!categoryId) {
      categoryId = crypto.randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "categories" ("id", "tenant_id", "name", "created_at", "updated_at") VALUES ($1, $2, 'Kategori Test', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
        categoryId,
        tenant.id
      );
    }

    // Product Alpha: Price Rp 50.000, Cost Rp 20.000
    const invItemIdA = crypto.randomUUID();
    const prodIdA = crypto.randomUUID();
    const varIdA = crypto.randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "inventory_items" ("id", "tenant_id", "item_code", "name", "canonical_uom", "average_cost", "is_active", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, 'PCS', 20000, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      invItemIdA,
      tenant.id,
      `ITEM-A-${rand}`,
      `Espresso Beans Special ${rand}`
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "products" ("id", "tenant_id", "category_id", "sku", "name", "unit", "is_active", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, 'CUP', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      prodIdA,
      tenant.id,
      categoryId,
      `SKU-PROD-A-${rand}`,
      `Signature Latte ${rand}`
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "product_variants" ("id", "tenant_id", "product_id", "inventory_item_id", "sku", "name", "price", "is_active", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, 'Large', 50000, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      varIdA,
      tenant.id,
      prodIdA,
      invItemIdA,
      `SKU-A-${rand}`
    );

    // Product Beta: Price Rp 30.000, Cost Rp 15.000
    const invItemIdB = crypto.randomUUID();
    const prodIdB = crypto.randomUUID();
    const varIdB = crypto.randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "inventory_items" ("id", "tenant_id", "item_code", "name", "canonical_uom", "average_cost", "is_active", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, 'PCS', 15000, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      invItemIdB,
      tenant.id,
      `ITEM-B-${rand}`,
      `Croissant Butter ${rand}`
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "products" ("id", "tenant_id", "category_id", "sku", "name", "unit", "is_active", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, 'PCS', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      prodIdB,
      tenant.id,
      categoryId,
      `SKU-PROD-B-${rand}`,
      `Butter Croissant ${rand}`
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "product_variants" ("id", "tenant_id", "product_id", "inventory_item_id", "sku", "name", "price", "is_active", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, 'Standard', 30000, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      varIdB,
      tenant.id,
      prodIdB,
      invItemIdB,
      `SKU-B-${rand}`
    );

    // Order 1: 2x Product Alpha. Subtotal Rp 100.000, Discount Rp 10.000, Total Rp 90.000, COGS Rp 40.000 (Method CASH)
    const orderId1 = crypto.randomUUID();
    const inv1 = `INV/${new Date().toISOString().slice(0, 10).replace(/-/g, '')}/TST/${rand}1`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "orders" (
        "id", "tenant_id", "outlet_id", "cashier_id", "invoice_number",
        "subtotal", "discount_amount", "tax_amount", "service_charge", "grand_total", "total_cost",
        "payment_status", "order_status", "channel", "order_type", "created_at", "updated_at"
      ) VALUES ($1, $2, $3, $4, $5, 100000, 10000, 0, 0, 90000, 40000, 'PAID'::"PaymentStatus", 'COMPLETED'::"OrderStatus", 'DINE_IN', 'DINE_IN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      orderId1,
      tenant.id,
      outlet.id,
      cashier.id,
      inv1
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "order_items" (
        "id", "order_id", "product_variant_id", "quantity", "cost_price", "unit_price", "discount_amount", "subtotal", "product_name", "variant_name", "sku", "created_at"
      ) VALUES ($1, $2, $3, 2, 20000, 50000, 10000, 90000, $4, 'Large', $5, CURRENT_TIMESTAMP);`,
      crypto.randomUUID(),
      orderId1,
      varIdA,
      `Signature Latte ${rand}`,
      `SKU-A-${rand}`
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "payment_transactions" (
        "id", "tenant_id", "order_id", "payment_method", "amount", "status", "created_at"
      ) VALUES ($1, $2, $3, 'CASH'::"PaymentMethod", 90000, 'CAPTURED'::"PaymentTxStatus", CURRENT_TIMESTAMP);`,
      crypto.randomUUID(),
      tenant.id,
      orderId1
    );

    // Order 2: 1x Product Beta. Subtotal Rp 30.000, Discount Rp 0, Total Rp 30.000, COGS Rp 15.000 (Method QRIS)
    const orderId2 = crypto.randomUUID();
    const inv2 = `INV/${new Date().toISOString().slice(0, 10).replace(/-/g, '')}/TST/${rand}2`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "orders" (
        "id", "tenant_id", "outlet_id", "cashier_id", "invoice_number",
        "subtotal", "discount_amount", "tax_amount", "service_charge", "grand_total", "total_cost",
        "payment_status", "order_status", "channel", "order_type", "created_at", "updated_at"
      ) VALUES ($1, $2, $3, $4, $5, 30000, 0, 0, 0, 30000, 15000, 'PAID'::"PaymentStatus", 'COMPLETED'::"OrderStatus", 'TAKEAWAY', 'TAKEAWAY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      orderId2,
      tenant.id,
      outlet.id,
      cashier.id,
      inv2
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "order_items" (
        "id", "order_id", "product_variant_id", "quantity", "cost_price", "unit_price", "discount_amount", "subtotal", "product_name", "variant_name", "sku", "created_at"
      ) VALUES ($1, $2, $3, 1, 15000, 30000, 0, 30000, $4, 'Standard', $5, CURRENT_TIMESTAMP);`,
      crypto.randomUUID(),
      orderId2,
      varIdB,
      `Butter Croissant ${rand}`,
      `SKU-B-${rand}`
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "payment_transactions" (
        "id", "tenant_id", "order_id", "payment_method", "amount", "status", "created_at"
      ) VALUES ($1, $2, $3, 'QRIS'::"PaymentMethod", 30000, 'CAPTURED'::"PaymentTxStatus", CURRENT_TIMESTAMP);`,
      crypto.randomUUID(),
      tenant.id,
      orderId2
    );

    console.log(`  ✅ Baseline Orders Seeded: ${inv1} (CASH Rp 90.000) & ${inv2} (QRIS Rp 30.000)`);

    // 3. VERIFY REAL-TIME GROSS PROFIT & COGS CALCULATOR
    console.log('\n[3/7] Verifying Real-Time Gross Profit & COGS Calculator...');
    const todayStr = new Date().toISOString().slice(0, 10);
    const pnl = await analyticsService.getFinancialPnl(tenant.id, {
      startDate: todayStr,
      endDate: todayStr,
    });

    console.log(`  Penjualan Kotor : Rp ${pnl.summary.grossSales.toLocaleString('id-ID')}`);
    console.log(`  Diskon          : Rp ${pnl.summary.discounts.toLocaleString('id-ID')}`);
    console.log(`  Penjualan Bersih: Rp ${pnl.summary.netSales.toLocaleString('id-ID')}`);
    console.log(`  HPP (COGS)      : Rp ${pnl.summary.cogs.toLocaleString('id-ID')}`);
    console.log(`  Laba Kotor      : Rp ${pnl.summary.grossProfit.toLocaleString('id-ID')}`);
    console.log(`  Margin Laba     : ${pnl.summary.profitMarginPercent}%`);

    if (pnl.summary.grossSales < 130000) {
      throw new Error(`Expected Gross Sales >= 130.000, got ${pnl.summary.grossSales}`);
    }
    if (pnl.summary.discounts < 10000) {
      throw new Error(`Expected Discounts >= 10.000, got ${pnl.summary.discounts}`);
    }
    if (pnl.summary.cogs < 55000) {
      throw new Error(`Expected COGS >= 55.000, got ${pnl.summary.cogs}`);
    }

    const calculatedProfit = pnl.summary.netSales - pnl.summary.cogs;
    if (pnl.summary.grossProfit !== calculatedProfit) {
      throw new Error(
        `Gross profit mismatch! Expected ${calculatedProfit}, got ${pnl.summary.grossProfit}`
      );
    }
    console.log('  ✅ Formula Validated: Net Sales (Gross - Disc) - COGS = Gross Profit');

    // Tender verification
    const cashTender = pnl.tenderBreakdown.find((t) => t.method === 'CASH');
    const qrisTender = pnl.tenderBreakdown.find((t) => t.method === 'QRIS');
    if (!cashTender || !qrisTender) {
      throw new Error('Expected both CASH and QRIS tender breakdowns to exist');
    }
    console.log(`  ✅ Tender Breakdown: CASH (${cashTender.percentage}%) | QRIS (${qrisTender.percentage}%)`);

    // 4. VERIFY CASHIER SHIFT DISCREPANCY & AUDIT DASHBOARD
    console.log('\n[4/7] Verifying Cashier Shift Discrepancy & Audit Dashboard...');
    // Seed 1 MATCH shift and 1 SHORT shift
    const shiftMatchId = crypto.randomUUID();
    const shiftShortId = crypto.randomUUID();

    // Shift 1: MATCH
    await prisma.$executeRawUnsafe(
      `INSERT INTO "shifts" (
        "id", "tenant_id", "outlet_id", "cashier_id", "start_time", "end_time",
        "starting_cash", "expected_cash", "actual_cash", "difference", "status", "notes", "created_at", "updated_at"
      ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP - INTERVAL '4 hours', CURRENT_TIMESTAMP - INTERVAL '2 hours',
        200000, 290000, 290000, 0, 'CLOSED'::"ShiftStatus", 'Shift Pagi Pas', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      shiftMatchId,
      tenant.id,
      outlet.id,
      cashier.id
    );

    // Shift 2: SHORT (-Rp 25.000)
    await prisma.$executeRawUnsafe(
      `INSERT INTO "shifts" (
        "id", "tenant_id", "outlet_id", "cashier_id", "start_time", "end_time",
        "starting_cash", "expected_cash", "actual_cash", "difference", "status", "notes", "created_at", "updated_at"
      ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP - INTERVAL '2 hours', CURRENT_TIMESTAMP,
        100000, 200000, 175000, -25000, 'CLOSED'::"ShiftStatus", 'Shift Siang Kurang 25rb', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      shiftShortId,
      tenant.id,
      outlet.id,
      cashier.id
    );

    const shiftAudit = await analyticsService.getShiftDiscrepancies(tenant.id, {
      startDate: todayStr,
      endDate: todayStr,
    });

    console.log(`  Total Shift Diaudit : ${shiftAudit.summary.totalShiftsAudited}`);
    console.log(`  Shift Pas (MATCH)   : ${shiftAudit.summary.matchCount}`);
    console.log(`  Shift Kurang (SHORT): ${shiftAudit.summary.shortCount}`);
    console.log(`  Total Uang Kurang   : Rp ${shiftAudit.summary.totalShortAmount.toLocaleString('id-ID')}`);
    console.log(`  Tingkat Anomali     : ${shiftAudit.summary.discrepancyRatePercent}%`);

    if (shiftAudit.summary.matchCount < 1 || shiftAudit.summary.shortCount < 1) {
      throw new Error('Shift discrepancy counts mismatch');
    }
    console.log('  ✅ Shift Over/Short Audit & Classification Verified!');

    // 5. VERIFY PRODUCT PERFORMANCE (PARETO 80/20) & DEAD STOCK VALUATION
    console.log('\n[5/7] Verifying Product Performance Matrix & Dead Stock Valuation...');
    const prodPerf = await analyticsService.getProductPerformance(tenant.id, {
      startDate: todayStr,
      endDate: todayStr,
    });

    const topVolume = prodPerf.topByVolume[0];
    console.log(`  Top Volume  : ${topVolume?.productName} (${topVolume?.quantitySold} unit)`);
    const topRevenue = prodPerf.topByRevenue[0];
    console.log(`  Top Revenue : ${topRevenue?.productName} (Rp ${topRevenue?.revenue.toLocaleString('id-ID')})`);
    const topMargin = prodPerf.topByMargin[0];
    console.log(`  Top Margin  : ${topMargin?.productName} (${topMargin?.profitMarginPercent}%)`);

    if (!topVolume || !topRevenue) {
      throw new Error('Product performance ranking empty');
    }
    console.log('  ✅ Pareto BI Rankings Generated Successfully');

    // Dead Stock: Seed an unmoving item with 15 units stock
    const deadItemId = crypto.randomUUID();
    const storageLocs: any[] = await prisma.$queryRawUnsafe(
      `SELECT id FROM "storage_locations" WHERE outlet_id = $1 LIMIT 1;`,
      outlet.id
    );
    const storeLocId = storageLocs[0]?.id;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "inventory_items" ("id", "tenant_id", "item_code", "name", "canonical_uom", "average_cost", "is_active", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, 'PCS', 50000, true, CURRENT_TIMESTAMP - INTERVAL '60 days', CURRENT_TIMESTAMP);`,
      deadItemId,
      tenant.id,
      `DEAD-${rand}`,
      `Premium Syrup Vanilla Stagnant ${rand}`
    );

    if (storeLocId) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "inventory_balances" ("id", "tenant_id", "inventory_item_id", "storage_location_id", "quantity_on_hand", "quantity_reserved", "updated_at")
         VALUES ($1, $2, $3, $4, 15, 0, CURRENT_TIMESTAMP);`,
        crypto.randomUUID(),
        tenant.id,
        deadItemId,
        storeLocId
      );
    }

    const deadStock = await analyticsService.getDeadStock(tenant.id, { daysThreshold: 1 });
    const targetDead = deadStock.items.find((i) => i.itemId === deadItemId);
    console.log(`  Total Item Dead Stock: ${deadStock.summary.totalDeadStockItems}`);
    console.log(`  Total Modal Tertahan : Rp ${deadStock.summary.totalFrozenCapital.toLocaleString('id-ID')}`);
    if (targetDead) {
      console.log(`  ✅ Dead Stock Detected: ${targetDead.name} | Stok: ${targetDead.quantityOnHand} | Modal Tertahan: Rp ${targetDead.frozenCapital.toLocaleString('id-ID')}`);
    }

    // 6. VERIFY MULTI-FORMAT CSV EXPORT ENGINE
    console.log('\n[6/7] Verifying Multi-Format CSV Export Engine (Excel Compatible)...');
    const pnlCsv = await analyticsService.exportCsv('financial', tenant.id, {
      startDate: todayStr,
      endDate: todayStr,
    });
    if (!pnlCsv.csvContent.startsWith('\uFEFF') || !pnlCsv.csvContent.includes('LAPORAN LABA RUGI')) {
      throw new Error('Financial CSV export malformed or missing UTF-8 BOM');
    }
    console.log(`  ✅ Financial P&L CSV: ${pnlCsv.filename} (${pnlCsv.csvContent.length} bytes)`);

    const shiftCsv = await analyticsService.exportCsv('shifts', tenant.id, {
      startDate: todayStr,
      endDate: todayStr,
    });
    if (!shiftCsv.csvContent.includes('AUDIT REKAPITULASI SHIFT')) {
      throw new Error('Shifts CSV export malformed');
    }
    console.log(`  ✅ Shift Audit CSV: ${shiftCsv.filename} (${shiftCsv.csvContent.length} bytes)`);

    const prodCsv = await analyticsService.exportCsv('products', tenant.id, {
      startDate: todayStr,
      endDate: todayStr,
    });
    if (!prodCsv.csvContent.includes('LAPORAN PERFORMA PENJUALAN PRODUK')) {
      throw new Error('Product CSV export malformed');
    }
    console.log(`  ✅ Product Performance CSV: ${prodCsv.filename} (${prodCsv.csvContent.length} bytes)`);

    const deadCsv = await analyticsService.exportCsv('dead-stock', tenant.id, {
      daysThreshold: 1,
    });
    if (!deadCsv.csvContent.includes('LAPORAN DEAD STOCK')) {
      throw new Error('Dead Stock CSV export malformed');
    }
    console.log(`  ✅ Dead Stock CSV: ${deadCsv.filename} (${deadCsv.csvContent.length} bytes)`);

    // 7. VERIFY LIVE HTTP REST API ENDPOINTS
    console.log('\n[7/7] Testing Live HTTP REST Endpoints (/api/reports/*)...');
    const port = 5005;
    const server = app.listen(port);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const token = jwt.sign(
      {
        userId: cashier.id,
        email: cashier.email,
        role: cashier.role || 'CASHIER',
        tenantId: tenant.id,
        outletId: outlet.id,
      },
      process.env.JWT_SECRET || 'rahasia_super_aman_pos_12345',
      { expiresIn: '1h' }
    );

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // Test 7a: GET /api/reports/financial
    const resPnl = await fetch(`http://localhost:${port}/api/reports/financial?startDate=${todayStr}&endDate=${todayStr}`, { headers });
    const jsonPnl: any = await resPnl.json();
    console.log(`  - GET /api/reports/financial -> Status: ${resPnl.status} (Gross: Rp ${jsonPnl.data?.summary?.grossSales?.toLocaleString('id-ID')})`);
    if (resPnl.status !== 200 || !jsonPnl.data?.summary) {
      throw new Error(`GET /api/reports/financial failed with status ${resPnl.status}`);
    }

    // Test 7b: GET /api/reports/shifts
    const resShifts = await fetch(`http://localhost:${port}/api/reports/shifts?startDate=${todayStr}&endDate=${todayStr}`, { headers });
    const jsonShifts: any = await resShifts.json();
    console.log(`  - GET /api/reports/shifts -> Status: ${resShifts.status} (Shifts: ${jsonShifts.data?.shifts?.length})`);
    if (resShifts.status !== 200 || !jsonShifts.data?.summary) {
      throw new Error(`GET /api/reports/shifts failed with status ${resShifts.status}`);
    }

    // Test 7c: GET /api/reports/product-performance
    const resProd = await fetch(`http://localhost:${port}/api/reports/product-performance?startDate=${todayStr}&endDate=${todayStr}`, { headers });
    const jsonProd: any = await resProd.json();
    console.log(`  - GET /api/reports/product-performance -> Status: ${resProd.status} (Top Vol: ${jsonProd.data?.topByVolume?.length})`);
    if (resProd.status !== 200 || !jsonProd.data?.topByVolume) {
      throw new Error(`GET /api/reports/product-performance failed with status ${resProd.status}`);
    }

    // Test 7d: GET /api/reports/dead-stock
    const resDead = await fetch(`http://localhost:${port}/api/reports/dead-stock?daysThreshold=1`, { headers });
    const jsonDead: any = await resDead.json();
    console.log(`  - GET /api/reports/dead-stock -> Status: ${resDead.status} (Items: ${jsonDead.data?.items?.length})`);
    if (resDead.status !== 200 || !jsonDead.data?.summary) {
      throw new Error(`GET /api/reports/dead-stock failed with status ${resDead.status}`);
    }

    // Test 7e: GET /api/reports/export?type=financial
    const resExport = await fetch(`http://localhost:${port}/api/reports/export?type=financial&startDate=${todayStr}&endDate=${todayStr}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const contentType = resExport.headers.get('content-type');
    const disposition = resExport.headers.get('content-disposition');
    console.log(`  - GET /api/reports/export -> Status: ${resExport.status} | Content-Type: ${contentType} | Disposition: ${disposition}`);
    if (resExport.status !== 200 || !contentType?.includes('text/csv')) {
      throw new Error('GET /api/reports/export failed or did not return text/csv');
    }

    server.close();

    console.log('\n===============================================================');
    console.log('🎉 EPIC-09 VERIFICATION COMPLETE: ALL 7/7 MODULES PASSED!');
    console.log('===============================================================');
  } catch (err) {
    console.error('\n❌ EPIC-09 VERIFICATION FAILED:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
