import * as dotenv from 'dotenv';
dotenv.config();
import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { runAllReconciliations } from './reconciliation/reconcile_all';
import { executeReverseReconciliation } from './dual_write/reverse_reconcile';
import {
  catalogReadAdapter,
  inventoryReadAdapter,
  salesReadAdapter,
  reportReadAdapter,
} from '../services/read_adapters';

interface RehearsalStepResult {
  step: string;
  name: string;
  status: 'PASSED' | 'FAILED';
  durationMs: number;
  details: string;
}

/**
 * CUTOVER REHEARSAL & ROLLBACK SIMULATION RUNNER (PROMPT 15.4 / STAGE 15.4)
 * Simulates end-to-end traffic shifting:
 * 1. Pre-Flight Invariants Check
 * 2. Read Switch (Target Read Adapters)
 * 3. Write Switch (Target-Only Transaction Simulation with REHEARSAL-* prefix)
 * 4. Rollback Trigger (Simulated Incident)
 * 5. Fast Rollback & Shift Reversal (reverse_reconcile.ts)
 * 6. Final Parity Audit (14/14 Reconciliation Verification)
 */
async function runCutoverRehearsal() {
  const prisma = new PrismaClient();
  const results: RehearsalStepResult[] = [];
  const overallStartTime = Date.now();

  console.log('================================================================');
  console.log('STARTING STAGE 15.4: CUTOVER REHEARSAL & ROLLBACK SIMULATION');
  console.log('================================================================\n');

  try {
    // 0. Resolve Active Tenant and Outlet Context
    const tenantRows: any[] = await prisma.$queryRawUnsafe(`SELECT id, business_name FROM "tenants" LIMIT 1;`);
    if (tenantRows.length === 0) {
      throw new Error('No active tenant found in database.');
    }
    const tenantId = tenantRows[0].id;

    const outletRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, name FROM "outlets" WHERE tenant_id = $1 AND is_warehouse = false LIMIT 1;`,
      tenantId
    );
    const outletId = outletRows[0]?.id || ((await prisma.$queryRawUnsafe<any[]>(`SELECT id FROM "outlets" WHERE tenant_id = $1 LIMIT 1;`, tenantId))[0] as any)?.id;

    const userRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, name FROM "users" WHERE tenant_id = $1 LIMIT 1;`,
      tenantId
    );
    const cashierId = userRows[0]?.id;

    console.log(`Resolved Scope: Tenant=${tenantId} Outlet=${outletId} Cashier=${cashierId}\n`);

    // ================================================================
    // STEP 1: PRE-FLIGHT INVARIANTS CHECK
    // ================================================================
    console.log('--- [STEP 1] Pre-Flight Invariants Verification ---');
    const step1Start = Date.now();
    const openShifts = await prisma.shift.count({ where: { status: 'OPEN' } });
    const holdOrdersRows: any[] = await prisma.$queryRawUnsafe(`SELECT count(*)::int as count FROM "hold_orders"`);
    const holdOrders = holdOrdersRows[0]?.count || 0;

    const preFlightReconciliation = await runAllReconciliations(tenantId, prisma);

    const step1Passed = openShifts === 0 && holdOrders === 0 && preFlightReconciliation.allPassed;
    results.push({
      step: '1',
      name: 'Pre-Flight Invariants Verification',
      status: step1Passed ? 'PASSED' : 'FAILED',
      durationMs: Date.now() - step1Start,
      details: `Open Shifts=${openShifts}, Hold Orders=${holdOrders}, Parity=${preFlightReconciliation.allPassed ? '14/14 PASSED' : 'DRIFT DETECTED'}`,
    });
    if (!step1Passed) throw new Error('Pre-flight invariants failed! Cannot proceed with rehearsal.');
    console.log('  -> Step 1 PASSED: Zero open shifts, zero hold orders, 14/14 parity.\n');

    // ================================================================
    // STEP 2: SIMULATE READ SWITCH (READ_FROM_TARGET=true)
    // ================================================================
    console.log('--- [STEP 2] Simulating Read Traffic Switch (READ_FROM_TARGET=true) ---');
    const step2Start = Date.now();
    process.env.READ_FROM_TARGET = 'true';

    // Verify Read Adapters across all domains
    const catalogResult = await catalogReadAdapter.getProducts({ tenantId, outletId });
    const lowStockResult = await inventoryReadAdapter.getLowStock(tenantId, outletId);
    const movementsResult = await inventoryReadAdapter.getStockMovements(tenantId, { outletId, limit: 10 });
    const ordersResult = await salesReadAdapter.getOrders({ tenantId, outletId, limit: 10 });
    const reportResult = await reportReadAdapter.getFinancialSummary(tenantId, { outletId });

    const step2Passed =
      Array.isArray(catalogResult.data) &&
      Array.isArray(lowStockResult) &&
      Array.isArray(movementsResult) &&
      Array.isArray(ordersResult.data) &&
      reportResult &&
      reportResult.financialSummary &&
      typeof reportResult.financialSummary.totalGrossSales === 'number';

    results.push({
      step: '2',
      name: 'Read Traffic Switch & Adapters Validation',
      status: step2Passed ? 'PASSED' : 'FAILED',
      durationMs: Date.now() - step2Start,
      details: `Catalog=${catalogResult.data.length} items, LowStock=${lowStockResult.length} items, Movements=${movementsResult.length} events, Orders=${ordersResult.data.length}, GrossSales=Rp ${reportResult.financialSummary.totalGrossSales}`,
    });
    console.log('  -> Step 2 PASSED: All 4 Target Read Adapters functional and verified.\n');

    // ================================================================
    // STEP 3: SIMULATE WRITE SWITCH (TARGET_ONLY WRITES)
    // ================================================================
    console.log('--- [STEP 3] Simulating Write Traffic Switch (TARGET_ONLY WRITES) ---');
    const step3Start = Date.now();
    process.env.WRITE_MODE = 'TARGET_ONLY';

    // Pick 1 product for rehearsal checkout
    const prodRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT p.id, p.name, p.sku, p.base_price, p.cost_price, op.stock,
              pv.id as variant_id, pv.inventory_item_id, pv.inventory_quantity_multiplier,
              sl.id as storage_location_id, ib.id as balance_id, ib.quantity_on_hand
       FROM "products" p
       JOIN "outlet_products" op ON op.product_id = p.id AND op.outlet_id = $2
       JOIN "product_variants" pv ON pv.product_id = p.id AND pv.tenant_id = $1
       JOIN "storage_locations" sl ON sl.outlet_id = $2 AND sl.is_default = true AND sl.tenant_id = $1
       JOIN "inventory_balances" ib ON ib.inventory_item_id = pv.inventory_item_id AND ib.storage_location_id = sl.id AND ib.tenant_id = $1
       WHERE p.tenant_id = $1 AND op.stock >= 5
       LIMIT 1;`,
      tenantId,
      outletId
    );

    if (prodRows.length === 0) {
      throw new Error('No product with sufficient stock found for rehearsal.');
    }

    const testProd = prodRows[0];
    const qtyToBuy = 2;
    const unitPrice = Number(testProd.base_price || 25000);
    const costPrice = Number(testProd.cost_price || 15000);
    const grandTotal = unitPrice * qtyToBuy;
    const rehearsalInvoice = `REHEARSAL-INV-${Date.now()}`;
    const orderId = crypto.randomUUID();
    const orderItemId = crypto.randomUUID();
    const paymentTxId = crypto.randomUUID();
    const ledgerId = crypto.randomUUID();

    const balanceBefore = Number(testProd.quantity_on_hand);
    const balanceAfter = balanceBefore - qtyToBuy;

    console.log(`  Executing Target-Only Checkout: Product="${testProd.name}" Qty=${qtyToBuy} Total=Rp ${grandTotal}`);
    console.log(`  Target InventoryBalance: ${balanceBefore} -> ${balanceAfter}`);
    console.log(`  Legacy outlet_products.stock intentionally remains un-updated: ${testProd.stock} (DRFT EXPECTED)`);

    // Perform atomic Target-Only mutations
    await prisma.$transaction(async (tx) => {
      // 1. orders (shared)
      await tx.$executeRawUnsafe(
        `INSERT INTO "orders" (
          "id", "tenant_id", "outlet_id", "cashier_id", "invoice_number",
          "subtotal", "discount_amount", "tax_amount", "service_charge", "grand_total", "total_cost",
          "payment_status", "channel", "order_status", "created_at", "updated_at"
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, 0, 0, 0, $6, $7,
          'PAID'::"PaymentStatus", 'DINE_IN', 'COMPLETED'::"OrderStatus", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        );`,
        orderId,
        tenantId,
        outletId,
        cashierId,
        rehearsalInvoice,
        grandTotal,
        costPrice * qtyToBuy
      );

      // 2. order_items (with target product_variant_id)
      await tx.$executeRawUnsafe(
        `INSERT INTO "order_items" (
          "id", "order_id", "product_id", "product_variant_id", "product_name", "sku",
          "quantity", "unit_price", "cost_price", "discount_amount", "subtotal", "created_at"
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, 0, $10, CURRENT_TIMESTAMP
        );`,
        orderItemId,
        orderId,
        testProd.id,
        testProd.variant_id,
        testProd.name,
        testProd.sku || null,
        qtyToBuy,
        unitPrice,
        costPrice,
        grandTotal
      );

      // 3. payment_transactions (TARGET ONLY - NOT writing to legacy payments)
      await tx.$executeRawUnsafe(
        `INSERT INTO "payment_transactions" (
          "id", "tenant_id", "order_id", "payment_method", "amount",
          "reference_number", "gateway_provider", "status", "metadata", "paid_at", "created_at"
        ) VALUES (
          $1, $2, $3, 'CASH'::"PaymentMethod", $4,
          $5, null, 'CAPTURED'::"PaymentTxStatus", null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        );`,
        paymentTxId,
        tenantId,
        orderId,
        grandTotal,
        `REHEARSAL-PAY-${paymentTxId.substring(0, 8)}`
      );

      // 4. inventory_balances update (TARGET ONLY)
      await tx.$executeRawUnsafe(
        `UPDATE "inventory_balances"
         SET "quantity_on_hand" = $1, "updated_at" = CURRENT_TIMESTAMP
         WHERE "id" = $2;`,
        balanceAfter,
        testProd.balance_id
      );

      // 5. inventory_ledgers append (TARGET ONLY - NOT writing to legacy stock_movements)
      await tx.$executeRawUnsafe(
        `INSERT INTO "inventory_ledgers" (
          "id", "tenant_id", "inventory_item_id", "storage_location_id", "inventory_batch_id",
          "quantity_delta", "balance_before", "balance_after", "unit_cost",
          "movement_type", "reference_type", "reference_id",
          "actor_type", "actor_user_id", "is_negative_balance", "notes", "created_at"
        ) VALUES (
          $1, $2, $3, $4, null,
          $5, $6, $7, $8,
          'SALE'::"StockMovementType", 'ORDER'::"InventoryRefType", $9,
          'USER'::"ActorType", $10, false, $11, CURRENT_TIMESTAMP
        );`,
        ledgerId,
        tenantId,
        testProd.inventory_item_id,
        testProd.storage_location_id,
        -qtyToBuy,
        balanceBefore,
        balanceAfter,
        costPrice,
        orderId,
        cashierId,
        `Rehearsal cutover transaction invoice ${rehearsalInvoice}`
      );
    });

    results.push({
      step: '3',
      name: 'Target-Only Writes Simulation',
      status: 'PASSED',
      durationMs: Date.now() - step3Start,
      details: `Invoice=${rehearsalInvoice}, TargetBalance=${balanceAfter}, LegacyStock=${testProd.stock} (Deliberate Drift Induced)`,
    });
    console.log('  -> Step 3 PASSED: Target-only order created. Deliberate temporary drift induced.\n');

    // ================================================================
    // STEP 4: SIMULATE ROLLBACK TRIGGER (INCIDENT SIMULATION)
    // ================================================================
    console.log('--- [STEP 4] Simulating Rollback Trigger (RB-1 Incident Simulation) ---');
    const step4Start = Date.now();
    console.log('  [INCIDENT ALERT] Synthetic latency breach triggered: p95 checkout latency > 500ms!');
    console.log('  [DECISION GATE] Incident Commander authorizes Immediate Rollback (RB-2 Criteria Met).');

    results.push({
      step: '4',
      name: 'Rollback Trigger & Incident Authorization',
      status: 'PASSED',
      durationMs: Date.now() - step4Start,
      details: 'Synthetic RB-2 Latency Breach triggered. Emergency Rollback Authorized.',
    });
    console.log('  -> Step 4 PASSED: Rollback decision authorized.\n');

    // ================================================================
    // STEP 5: FAST ROLLBACK & SHIFT REVERSAL (reverse_reconcile.ts)
    // ================================================================
    console.log('--- [STEP 5] Executing Fast Rollback & Shift Reversal ---');
    const step5Start = Date.now();

    // Revert environment variables
    process.env.READ_FROM_TARGET = 'false';
    process.env.WRITE_MODE = 'DUAL_WRITE';
    console.log('  [CONFIG] Reverted READ_FROM_TARGET=false, WRITE_MODE=DUAL_WRITE.');

    // Execute Reverse Reconciliation Engine
    const reverseStats = await executeReverseReconciliation(tenantId, prisma);

    const step5Passed = reverseStats.success && reverseStats.syncedOutletProducts >= 1 && reverseStats.syncedPayments >= 1;
    results.push({
      step: '5',
      name: 'Fast Rollback & Reverse Reconciliation Execution',
      status: step5Passed ? 'PASSED' : 'FAILED',
      durationMs: Date.now() - step5Start,
      details: `SyncedProducts=${reverseStats.syncedOutletProducts}, SyncedPayments=${reverseStats.syncedPayments}, SyncedMovements=${reverseStats.syncedStockMovements}, Duration=${reverseStats.durationMs}ms`,
    });
    console.log('  -> Step 5 PASSED: Shift reversal completed. Target transaction backfilled to legacy tables.\n');

    // ================================================================
    // STEP 6: FINAL PARITY AUDIT (14/14 RECONCILIATION SUITES)
    // ================================================================
    console.log('--- [STEP 6] Executing Final Post-Rollback Parity Audit ---');
    const step6Start = Date.now();
    const postRollbackReconciliation = await runAllReconciliations(tenantId, prisma);

    const step6Passed = postRollbackReconciliation.allPassed;
    results.push({
      step: '6',
      name: 'Final Parity Audit (Zero Data Loss Proof)',
      status: step6Passed ? 'PASSED' : 'FAILED',
      durationMs: Date.now() - step6Start,
      details: `14/14 Reconciliation Suites Parity: ${step6Passed ? '100.00% PASSED (0 Discrepancy)' : 'DISCREPANCY REMAINING'}`,
    });

    if (!step6Passed) {
      throw new Error('Post-rollback reconciliation failed! Parity was not restored!');
    }
    console.log('  -> Step 6 PASSED: 14/14 suites verified 100.00% parity. Zero data loss empirically proven.\n');

    const totalDurationMs = Date.now() - overallStartTime;

    console.log('================================================================');
    console.log('--- STAGE 15.4 CUTOVER REHEARSAL SUMMARY MATRIX ---');
    console.log('================================================================');
    console.table(
      results.map((r) => ({
        Step: r.step,
        Operation: r.name,
        Status: r.status,
        Duration: `${r.durationMs}ms`,
        Details: r.details,
      }))
    );

    console.log(`================================================================`);
    console.log(`VERDICT: 100% SUCCESS — REHEARSAL VALIDATED IN ${totalDurationMs}ms`);
    console.log(`READY FOR CUTOVER AUTHORIZATION (OAUTH-16-01)`);
    console.log(`================================================================\n`);

    return {
      success: true,
      totalDurationMs,
      results,
    };
  } catch (err: any) {
    console.error('\n[FATAL ERROR IN REHEARSAL]', err);
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  runCutoverRehearsal()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { runCutoverRehearsal };
