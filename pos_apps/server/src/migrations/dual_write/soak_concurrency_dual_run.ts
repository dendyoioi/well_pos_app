import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
import {
  catalogDualWriteService,
  inventoryDualWriteService,
  salesDualWriteService,
  CreateProductDTO,
  CheckoutOrderDTO,
} from '../../services/dual_write';
import { runAllReconciliations } from '../reconciliation/reconcile_all';

export interface SoakTestMetrics {
  totalOperations: number;
  successfulOperations: number;
  expectedRejections: number;
  unexpectedFailures: number;
  latenciesMs: number[];
  avgLatencyMs: number;
  p95LatencyMs: number;
  finalParityPassed: boolean;
}

/**
 * SOAK & CONCURRENCY DUAL-RUN STABILIZATION HARNESS (PROMPT 15.1)
 * Validates mutex row-locking, multi-cashier concurrency, complex multi-domain operations,
 * and continuous dimensional parity under sustained transaction load.
 */
export async function runSoakAndConcurrencyTest(): Promise<{
  passed: boolean;
  metrics: SoakTestMetrics;
}> {
  const prisma = new PrismaClient();
  const dbUrl = process.env.DATABASE_URL || '';
  const isPosDb = dbUrl.includes('/pos_db');
  const latencies: number[] = [];

  console.log('================================================================');
  console.log('--- PROMPT 15.1: DUAL-RUN SOAK TESTING & PARITY AUDIT ---');
  console.log('Target Database URL:', dbUrl.replace(/:[^:@]+@/, ':****@'));
  console.log('Target Database Name:', isPosDb ? 'pos_db (PRODUCTION)' : 'OTHER');
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================================\n');

  const metrics: SoakTestMetrics = {
    totalOperations: 0,
    successfulOperations: 0,
    expectedRejections: 0,
    unexpectedFailures: 0,
    latenciesMs: [],
    avgLatencyMs: 0,
    p95LatencyMs: 0,
    finalParityPassed: false,
  };

  const measure = async <T>(fn: () => Promise<T>): Promise<T> => {
    const start = performance.now();
    try {
      const res = await fn();
      const duration = performance.now() - start;
      latencies.push(duration);
      return res;
    } catch (err) {
      const duration = performance.now() - start;
      latencies.push(duration);
      throw err;
    }
  };

  try {
    // -------------------------------------------------------------------------
    // 0. CONTEXT DISCOVERY & BASELINE VERIFICATION
    // -------------------------------------------------------------------------
    console.log('[STEP 0] Discovering Multi-Tenant Baseline Context...');
    const tenants: any[] = await prisma.$queryRawUnsafe(`SELECT id, business_name FROM tenants LIMIT 1`);
    if (tenants.length === 0) {
      throw new Error('Pre-flight check failed: No tenant found in database.');
    }
    const tenantId = tenants[0].id;
    console.log(`  -> Tenant: ${tenants[0].business_name} (${tenantId})`);

    const outlets: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, name, is_warehouse FROM outlets WHERE tenant_id = $1 ORDER BY is_warehouse ASC, name ASC`,
      tenantId
    );
    if (outlets.length === 0) {
      throw new Error('Pre-flight check failed: No outlet found.');
    }
    const primaryOutlet = outlets[0];
    const secondaryOutlet = outlets.length > 1 ? outlets[1] : outlets[0];
    console.log(`  -> Primary Outlet: ${primaryOutlet.name} (${primaryOutlet.id})`);
    console.log(`  -> Secondary Outlet: ${secondaryOutlet.name} (${secondaryOutlet.id})`);

    const categories: any[] = await prisma.$queryRawUnsafe(`SELECT id, name FROM categories WHERE tenant_id = $1 LIMIT 1`, tenantId);
    const categoryId = categories.length > 0 ? categories[0].id : '';

    const users: any[] = await prisma.$queryRawUnsafe(`SELECT id, email, role FROM users WHERE tenant_id = $1`, tenantId);
    const adminUser = users.find((u) => u.role === 'ADMIN' || u.role === 'OWNER') || users[0];
    const cashierUser = users.find((u) => u.role === 'CASHIER') || adminUser;
    console.log(`  -> Admin User: ${adminUser.email}`);
    console.log(`  -> Cashier User: ${cashierUser.email}\n`);

    // -------------------------------------------------------------------------
    // 1. PRE-SOAK BASELINE RECONCILIATION AUDIT
    // -------------------------------------------------------------------------
    console.log('[STEP 1] Executing Pre-Soak Baseline Reconciliation Audit...');
    const preCheck = await runAllReconciliations(tenantId, prisma);
    if (!preCheck.allPassed) {
      throw new Error('Pre-soak reconciliation audit failed: Baseline is not at 100% parity!');
    }
    console.log('  [PASS] Baseline confirmed: 14/14 suites passed with 0 discrepancies.\n');

    // -------------------------------------------------------------------------
    // 2. SCENARIO A: HIGH-CONCURRENCY MUTEX & RACE CONDITION TEST
    // -------------------------------------------------------------------------
    console.log('[STEP 2] SCENARIO A: Concurrent Race Condition Stress Test (15 Parallel Checkouts on 10 Stock)...');
    const soakSku1 = `SOAK-RACE-${Date.now().toString().slice(-6)}`;
    const raceProductDto: CreateProductDTO = {
      name: 'Soak Concurrency Flash Sale Coffee',
      sku: soakSku1,
      categoryId,
      basePrice: 15000,
      costPrice: 5000,
      initialStock: 10,
      unit: 'Cup',
      outletId: primaryOutlet.id,
    };

    const raceProductResult = await measure(() =>
      prisma.$transaction((tx) =>
        catalogDualWriteService.createProduct(raceProductDto, {
          tx,
          tenantId,
          actorUserId: adminUser.id,
        })
      )
    );
    metrics.totalOperations++;
    metrics.successfulOperations++;

    const raceProductId = raceProductResult.legacyData.id;
    const raceVariantId = raceProductResult.targetDetails?.variantId;
    const raceItemId = raceProductResult.targetDetails?.inventoryItemId;
    console.log(`  -> Created Race Test Product: ID ${raceProductId}, Initial Stock: 10 units`);

    // Launch 15 parallel checkout workers competing for 10 units
    const concurrentWorkers = 15;
    console.log(`  -> Launching ${concurrentWorkers} simultaneous checkout requests in parallel...`);

    const checkoutPromises = Array.from({ length: concurrentWorkers }, (_, index) => {
      const invNum = `INV-SOAK-RACE-${index + 1}-${Date.now().toString().slice(-4)}`;
      const checkoutDto: CheckoutOrderDTO = {
        targetOutletId: primaryOutlet.id,
        cashierId: cashierUser.id,
        invoiceNumber: invNum,
        items: [
          {
            productId: raceProductId,
            quantity: 1,
            costPrice: 5000,
            unitPrice: 15000,
            subtotal: 15000,
          },
        ],
        totalCost: 5000,
        subtotal: 15000,
        grandTotal: 15000,
        payments: [
          {
            method: 'CASH',
            amountPaid: 15000,
            changeGiven: 0,
          },
        ],
      };

      return measure(() =>
        prisma.$transaction((tx) =>
          salesDualWriteService.processCheckout(checkoutDto, {
            tx,
            tenantId,
            actorUserId: cashierUser.id,
          })
        )
      );
    });

    const results = await Promise.allSettled(checkoutPromises);
    let raceSuccess = 0;
    let raceRejected = 0;

    results.forEach((r, idx) => {
      metrics.totalOperations++;
      if (r.status === 'fulfilled') {
        raceSuccess++;
        metrics.successfulOperations++;
      } else {
        raceRejected++;
        metrics.expectedRejections++;
      }
    });

    console.log(`  -> Concurrent Results: ${raceSuccess} Succeeded, ${raceRejected} Rejected`);

    // Direct Database Assertions for Scenario A
    const [opRace]: any[] = await prisma.$queryRawUnsafe(
      `SELECT stock FROM outlet_products WHERE product_id = $1 AND outlet_id = $2`,
      raceProductId,
      primaryOutlet.id
    );
    const [ibRace]: any[] = await prisma.$queryRawUnsafe(
      `SELECT quantity_on_hand FROM inventory_balances WHERE inventory_item_id = $1`,
      raceItemId
    );
    const [ledgerRaceCount]: any[] = await prisma.$queryRawUnsafe(
      `SELECT count(*) as cnt FROM inventory_ledgers WHERE inventory_item_id = $1`,
      raceItemId
    );

    const legacyStockFinal = Number(opRace.stock);
    const targetBalanceFinal = Number(ibRace.quantity_on_hand);
    const totalLedgers = Number(ledgerRaceCount.cnt);

    console.log(`  -> Legacy Stock Final: ${legacyStockFinal}`);
    console.log(`  -> Target Balance Final: ${targetBalanceFinal}`);
    console.log(`  -> Total Ledgers Emitted: ${totalLedgers} (1 Initial Opname + ${raceSuccess} Sales)`);

    // Invariant: Exactly 10 units were available. Exactly 10 should succeed, 5 should reject.
    // Stock must be exactly 0 in both legacy and target.
    if (raceSuccess !== 10 || raceRejected !== 5) {
      throw new Error(
        `Scenario A Mutex Failure: Expected exactly 10 successes and 5 rejections, but got ${raceSuccess} successes and ${raceRejected} rejections.`
      );
    }
    if (legacyStockFinal !== 0 || targetBalanceFinal !== 0) {
      throw new Error(
        `Scenario A Parity Failure: Final stock is non-zero (legacy=${legacyStockFinal}, target=${targetBalanceFinal}). Overselling detected!`
      );
    }
    if (totalLedgers !== 11) {
      throw new Error(
        `Scenario A Ledger Audit Failure: Expected 11 ledger rows (1 initial + 10 sales), found ${totalLedgers}.`
      );
    }
    console.log('  [PASS] Scenario A: Row-level locking prevented race condition, 0 overselling, exact parity (0 = 0).\n');

    // -------------------------------------------------------------------------
    // 3. SCENARIO B: COMPLEX MULTI-ITEM SALES WITH SPLIT PAYMENT & MULTIPLIER
    // -------------------------------------------------------------------------
    console.log('[STEP 3] SCENARIO B: Multi-Item Sales with Split Payment (Cash + QRIS) & Multipliers...');
    const soakSkuB1 = `SOAK-PKG-A-${Date.now().toString().slice(-6)}`;
    const soakSkuB2 = `SOAK-PKG-B-${Date.now().toString().slice(-6)}`;

    // Create Item 1: standard coffee
    const prodB1 = await measure(() =>
      prisma.$transaction((tx) =>
        catalogDualWriteService.createProduct(
          {
            name: 'Soak Multi-Item Arabica Blend',
            sku: soakSkuB1,
            categoryId,
            basePrice: 25000,
            costPrice: 10000,
            initialStock: 50,
            unit: 'Cup',
            outletId: primaryOutlet.id,
          },
          { tx, tenantId, actorUserId: adminUser.id }
        )
      )
    );

    // Create Item 2: pastry/snack
    const prodB2 = await measure(() =>
      prisma.$transaction((tx) =>
        catalogDualWriteService.createProduct(
          {
            name: 'Soak Multi-Item Butter Croissant',
            sku: soakSkuB2,
            categoryId,
            basePrice: 18000,
            costPrice: 7000,
            initialStock: 40,
            unit: 'Pcs',
            outletId: primaryOutlet.id,
          },
          { tx, tenantId, actorUserId: adminUser.id }
        )
      )
    );
    metrics.totalOperations += 2;
    metrics.successfulOperations += 2;

    const idB1 = prodB1.legacyData.id;
    const itemB1 = prodB1.targetDetails?.inventoryItemId;
    const idB2 = prodB2.legacyData.id;
    const itemB2 = prodB2.targetDetails?.inventoryItemId;

    // Execute 5 multi-item checkouts in succession
    for (let i = 1; i <= 5; i++) {
      const qty1 = 2; // 2 x 25000 = 50000
      const qty2 = 1; // 1 x 18000 = 18000
      const subtotal = qty1 * 25000 + qty2 * 18000; // 68000
      const totalCost = qty1 * 10000 + qty2 * 7000; // 27000

      const checkoutDto: CheckoutOrderDTO = {
        targetOutletId: primaryOutlet.id,
        cashierId: cashierUser.id,
        invoiceNumber: `INV-SOAK-SPLIT-${i}-${Date.now().toString().slice(-4)}`,
        items: [
          { productId: idB1, quantity: qty1, costPrice: 10000, unitPrice: 25000, subtotal: 50000 },
          { productId: idB2, quantity: qty2, costPrice: 7000, unitPrice: 18000, subtotal: 18000 },
        ],
        subtotal,
        grandTotal: subtotal,
        totalCost,
        payments: [
          { method: 'CASH', amountPaid: 30000, changeGiven: 0 },
          { method: 'QRIS', amountPaid: 38000, qrisReference: `QRIS-SOAK-${i}` },
        ],
      };

      await measure(() =>
        prisma.$transaction((tx) =>
          salesDualWriteService.processCheckout(checkoutDto, {
            tx,
            tenantId,
            actorUserId: cashierUser.id,
          })
        )
      );
      metrics.totalOperations++;
      metrics.successfulOperations++;
    }

    // Verify stock after 5 checkouts:
    // Item 1: 50 - (5 * 2) = 40
    // Item 2: 40 - (5 * 1) = 35
    const [opB1]: any[] = await prisma.$queryRawUnsafe(`SELECT stock FROM outlet_products WHERE product_id = $1`, idB1);
    const [ibB1]: any[] = await prisma.$queryRawUnsafe(`SELECT quantity_on_hand FROM inventory_balances WHERE inventory_item_id = $1`, itemB1);
    const [opB2]: any[] = await prisma.$queryRawUnsafe(`SELECT stock FROM outlet_products WHERE product_id = $1`, idB2);
    const [ibB2]: any[] = await prisma.$queryRawUnsafe(`SELECT quantity_on_hand FROM inventory_balances WHERE inventory_item_id = $1`, itemB2);

    if (Number(opB1.stock) !== 40 || Number(ibB1.quantity_on_hand) !== 40) {
      throw new Error(`Scenario B Parity Failure on Item 1: expected 40, got legacy=${opB1.stock}, target=${ibB1.quantity_on_hand}`);
    }
    if (Number(opB2.stock) !== 35 || Number(ibB2.quantity_on_hand) !== 35) {
      throw new Error(`Scenario B Parity Failure on Item 2: expected 35, got legacy=${opB2.stock}, target=${ibB2.quantity_on_hand}`);
    }
    console.log('  [PASS] Scenario B: 5 multi-item split payment checkouts processed with 100% stock & tender parity.\n');

    // -------------------------------------------------------------------------
    // 4. SCENARIO C: INTER-OUTLET INVENTORY TRANSFER (TRANSFERSTOCK)
    // -------------------------------------------------------------------------
    console.log('[STEP 4] SCENARIO C: Inter-Outlet Stock Transfer (Cross-Branch Movement)...');
    if (primaryOutlet.id !== secondaryOutlet.id) {
      const transferQty = 15;
      await measure(() =>
        prisma.$transaction((tx) =>
          inventoryDualWriteService.transferStock(
            {
              sourceOutletId: primaryOutlet.id,
              targetOutletId: secondaryOutlet.id,
              productId: idB1,
              quantity: transferQty,
              notes: 'Soak Test Branch Transfer Arabica Blend',
            },
            { tx, tenantId, actorUserId: adminUser.id }
          )
        )
      );
      metrics.totalOperations++;
      metrics.successfulOperations++;

      // Verify source outlet stock (40 - 15 = 25)
      const [srcOp]: any[] = await prisma.$queryRawUnsafe(
        `SELECT stock FROM outlet_products WHERE product_id = $1 AND outlet_id = $2`,
        idB1,
        primaryOutlet.id
      );
      const [srcLoc]: any[] = await prisma.$queryRawUnsafe(
        `SELECT id FROM storage_locations WHERE outlet_id = $1 AND is_default = true`,
        primaryOutlet.id
      );
      const [srcIb]: any[] = await prisma.$queryRawUnsafe(
        `SELECT quantity_on_hand FROM inventory_balances WHERE inventory_item_id = $1 AND storage_location_id = $2`,
        itemB1,
        srcLoc.id
      );

      // Verify destination outlet stock (0 + 15 = 15)
      const [dstOp]: any[] = await prisma.$queryRawUnsafe(
        `SELECT stock FROM outlet_products WHERE product_id = $1 AND outlet_id = $2`,
        idB1,
        secondaryOutlet.id
      );
      const [dstLoc]: any[] = await prisma.$queryRawUnsafe(
        `SELECT id FROM storage_locations WHERE outlet_id = $1 AND is_default = true`,
        secondaryOutlet.id
      );
      const [dstIb]: any[] = await prisma.$queryRawUnsafe(
        `SELECT quantity_on_hand FROM inventory_balances WHERE inventory_item_id = $1 AND storage_location_id = $2`,
        itemB1,
        dstLoc.id
      );

      if (Number(srcOp.stock) !== 25 || Number(srcIb.quantity_on_hand) !== 25) {
        throw new Error(`Scenario C Parity Failure at Source: expected 25, got legacy=${srcOp.stock}, target=${srcIb.quantity_on_hand}`);
      }
      if (Number(dstOp.stock) !== 15 || Number(dstIb.quantity_on_hand) !== 15) {
        throw new Error(`Scenario C Parity Failure at Target: expected 15, got legacy=${dstOp.stock}, target=${dstIb.quantity_on_hand}`);
      }
      console.log(`  [PASS] Scenario C: Inter-outlet transfer of ${transferQty} units verified with 100% parity across both branches.\n`);
    } else {
      console.log('  [SKIP] Only 1 outlet detected; skipping inter-outlet transfer test.\n');
    }

    // -------------------------------------------------------------------------
    // 5. SCENARIO D: INBOUND, OUTBOUND DISPOSAL & STOCK OPNAME ADJUSTMENT
    // -------------------------------------------------------------------------
    console.log('[STEP 5] SCENARIO D: Inventory Inbound, Damage Outbound, & Opname Adjustment...');
    // Inbound: +20 to item B2 (35 + 20 = 55)
    await measure(() =>
      prisma.$transaction((tx) =>
        inventoryDualWriteService.recordStockIn(
          {
            productId: idB2,
            outletId: primaryOutlet.id,
            quantity: 20,
            notes: 'Inbound shipment test',
          },
          { tx, tenantId, actorUserId: adminUser.id }
        )
      )
    );
    metrics.totalOperations++;
    metrics.successfulOperations++;

    // Outbound Damage: -5 to item B2 (55 - 5 = 50)
    await measure(() =>
      prisma.$transaction((tx) =>
        inventoryDualWriteService.recordStockOut(
          {
            productId: idB2,
            outletId: primaryOutlet.id,
            quantity: 5,
            notes: 'Damaged packaging disposal',
          },
          { tx, tenantId, actorUserId: adminUser.id }
        )
      )
    );
    metrics.totalOperations++;
    metrics.successfulOperations++;

    // Stock Opname: calibrate physical count to 48 (50 -> 48, delta -2)
    await measure(() =>
      prisma.$transaction((tx) =>
        inventoryDualWriteService.recordStockAdjustment(
          {
            productId: idB2,
            outletId: primaryOutlet.id,
            actualStock: 48,
            notes: 'Physical opname calibration',
          },
          { tx, tenantId, actorUserId: adminUser.id }
        )
      )
    );
    metrics.totalOperations++;
    metrics.successfulOperations++;

    const [opD]: any[] = await prisma.$queryRawUnsafe(`SELECT stock FROM outlet_products WHERE product_id = $1`, idB2);
    const [ibD]: any[] = await prisma.$queryRawUnsafe(`SELECT quantity_on_hand FROM inventory_balances WHERE inventory_item_id = $1`, itemB2);

    if (Number(opD.stock) !== 48 || Number(ibD.quantity_on_hand) !== 48) {
      throw new Error(`Scenario D Parity Failure: expected stock 48, got legacy=${opD.stock}, target=${ibD.quantity_on_hand}`);
    }
    console.log('  [PASS] Scenario D: Inbound (+20), Outbound (-5), and Opname (48) reconciled with zero discrepancy.\n');

    // -------------------------------------------------------------------------
    // 6. POST-SOAK FULL 14-SUITE DIMENSIONAL RECONCILIATION AUDIT
    // -------------------------------------------------------------------------
    console.log('[STEP 6] Executing Comprehensive Post-Soak 14-Suite Reconciliation Audit...');
    const postAudit = await runAllReconciliations(tenantId, prisma);
    metrics.finalParityPassed = postAudit.allPassed;

    if (!postAudit.allPassed) {
      throw new Error('Post-soak reconciliation audit FAILED! Discrepancy detected after load test.');
    }
    console.log('  [PASS] Post-soak audit: 14/14 suites PASSED with 0 discrepancies (100.00% parity)!\n');

    // -------------------------------------------------------------------------
    // 7. LATENCY & THROUGHPUT TELEMETRY
    // -------------------------------------------------------------------------
    latencies.sort((a, b) => a - b);
    const sum = latencies.reduce((acc, v) => acc + v, 0);
    metrics.latenciesMs = latencies;
    metrics.avgLatencyMs = Number((sum / latencies.length).toFixed(2));
    const p95Idx = Math.floor(latencies.length * 0.95);
    metrics.p95LatencyMs = Number(latencies[p95Idx].toFixed(2));

    console.log('================================================================');
    console.log('--- SOAK & CONCURRENCY TEST TELEMETRY SUMMARY ---');
    console.log(`Total Operations Executed:   ${metrics.totalOperations}`);
    console.log(`Successful Mutations:        ${metrics.successfulOperations}`);
    console.log(`Expected Concurrency Rejects:${metrics.expectedRejections}`);
    console.log(`Unexpected Failures:         ${metrics.unexpectedFailures}`);
    console.log(`Average Latency (Dual-Write):${metrics.avgLatencyMs} ms`);
    console.log(`p95 Latency:                 ${metrics.p95LatencyMs} ms`);
    console.log(`Final Reconciliation Parity: 100.00% (14/14 Suites Passed)`);
    console.log('================================================================\n');

    return { passed: true, metrics };
  } catch (err: any) {
    console.error('\n[FATAL ERROR] Soak & Concurrency Test Failed:', err);
    metrics.unexpectedFailures++;
    return { passed: false, metrics };
  } finally {
    await prisma.$disconnect();
  }
}

// CLI Entrypoint
if (require.main === module) {
  runSoakAndConcurrencyTest().then(({ passed }) => {
    process.exit(passed ? 0 : 1);
  });
}
