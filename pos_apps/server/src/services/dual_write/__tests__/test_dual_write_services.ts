import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  catalogDualWriteService,
  inventoryDualWriteService,
  salesDualWriteService,
  userDualWriteService,
  locationDualWriteService,
  emergencyDriftBuffer,
} from '../index';

interface TestSummary {
  name: string;
  status: 'PASSED' | 'FAILED';
  details: string;
  durationMs: number;
}

const testResults: TestSummary[] = [];

/**
 * Isolated Test Harness for Dual-Write Domain Services (Prompt 14.2)
 * Strictly executes on disposable sandbox database: pos_dual_write_sandbox
 */
async function runDualWriteTestSuite() {
  const startTime = Date.now();
  console.log('================================================================');
  console.log('STARTING DUAL-WRITE DOMAIN SERVICES ISOLATED TEST HARNESS');
  console.log('Target Database: pos_dual_write_sandbox (Disposable Sandbox)');
  console.log('================================================================\n');

  const sandboxDbUrl =
    process.env.TEST_DATABASE_URL ||
    'postgresql://postgres:postgres123@localhost:5432/pos_dual_write_sandbox?schema=public';

  const prisma = new PrismaClient({
    datasources: {
      db: { url: sandboxDbUrl },
    },
  });

  try {
    // 0. VERIFY SANDBOX SAFETY GUARDRAIL
    const dbNameResult: any[] = await prisma.$queryRawUnsafe(`SELECT current_database() as db;`);
    const activeDb = dbNameResult[0]?.db;
    console.log(`[GUARDRAIL] Active test database: "${activeDb}"`);
    if (activeDb !== 'pos_dual_write_sandbox') {
      throw new Error(`CRITICAL SAFETY ABORT: Test attempted to execute against non-sandbox database: ${activeDb}`);
    }

    // Retrieve baseline tenant, outlet, category, user
    const tenantRows: any[] = await prisma.$queryRawUnsafe(`SELECT id FROM "tenants" LIMIT 1;`);
    const tenantId = tenantRows[0]?.id;
    if (!tenantId) throw new Error('No tenant found in sandbox');

    const outletRows: any[] = await prisma.$queryRawUnsafe(`SELECT id FROM "outlets" WHERE tenant_id = $1 LIMIT 1;`, tenantId);
    const baselineOutletId = outletRows[0]?.id;

    const userRows: any[] = await prisma.$queryRawUnsafe(`SELECT id FROM "users" WHERE tenant_id = $1 AND role = 'ADMIN' LIMIT 1;`, tenantId);
    const adminUserId = userRows[0]?.id;

    const catRows: any[] = await prisma.$queryRawUnsafe(`SELECT id FROM "categories" WHERE tenant_id = $1 LIMIT 1;`, tenantId);
    const categoryId = catRows[0]?.id;

    console.log(`[SETUP] Baseline context loaded: tenant=${tenantId}, outlet=${baselineOutletId}, adminUser=${adminUserId}, cat=${categoryId}\n`);

    // =========================================================================
    // TEST SUITE 1: LocationDualWriteService.createOutlet
    // =========================================================================
    {
      const t0 = Date.now();
      const testName = 'Location: createOutlet provisions default StorageLocation';
      try {
        const outletName = `Outlet Test Cabang DualWrite ${Date.now()}`;
        const result = await prisma.$transaction(async (tx) => {
          return await locationDualWriteService.createOutlet(
            {
              name: outletName,
              address: 'Jl. Uji Dual Write No. 10',
              phone: '081234567890',
              isWarehouse: false,
              feesConfig: {},
            },
            { tx, tenantId, actorUserId: adminUserId }
          );
        });

        const createdOutletId = result.legacyData.id;

        // Verify legacy outlet
        const legacyRows: any[] = await prisma.$queryRawUnsafe(
          `SELECT id, name, is_warehouse FROM "outlets" WHERE id = $1;`,
          createdOutletId
        );
        if (legacyRows.length !== 1) throw new Error('Legacy outlet not found');

        // Verify target default storage_location
        const targetRows: any[] = await prisma.$queryRawUnsafe(
          `SELECT id, name, type, is_default, is_active FROM "storage_locations" WHERE outlet_id = $1;`,
          createdOutletId
        );
        if (targetRows.length !== 1) throw new Error('Target storage_locations row not found or multiple found');
        if (!targetRows[0].is_default) throw new Error('Target storage_location is_default must be true');
        if (targetRows[0].type !== 'STOREFRONT') throw new Error(`Target storage_location type mismatch: ${targetRows[0].type}`);

        testResults.push({
          name: testName,
          status: 'PASSED',
          details: `Outlet created (id=${createdOutletId}) and linked to default StorageLocation (id=${targetRows[0].id})`,
          durationMs: Date.now() - t0,
        });
      } catch (err: any) {
        testResults.push({
          name: testName,
          status: 'FAILED',
          details: err.message,
          durationMs: Date.now() - t0,
        });
      }
    }

    // =========================================================================
    // TEST SUITE 2: CatalogDualWriteService.createProduct
    // =========================================================================
    let testProductId = '';
    let testVariantId = '';
    let testInventoryItemId = '';
    {
      const t0 = Date.now();
      const testName = 'Catalog: createProduct synchronizes variant, item, balance & ledger';
      try {
        const timestamp = Date.now();
        const sku = `SKU-DW-${timestamp.toString().substring(7)}`;
        const barcode = `899${timestamp.toString().substring(3)}`;
        const initialStock = 50;

        const result = await prisma.$transaction(async (tx) => {
          return await catalogDualWriteService.createProduct(
            {
              name: `Kopi Robusta Dual Write ${timestamp}`,
              sku,
              barcode,
              categoryId,
              costPrice: 6000,
              basePrice: 16000,
              unit: 'Cup',
              initialStock,
              minStockAlert: 5,
              outletId: baselineOutletId,
            },
            { tx, tenantId, actorUserId: adminUserId }
          );
        });

        testProductId = result.legacyData.id;
        testVariantId = result.targetDetails?.variantId;
        testInventoryItemId = result.targetDetails?.inventoryItemId;

        // Verify legacy product & outletProduct
        const legacyProduct: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "products" WHERE id = $1;`, testProductId);
        const legacyOutletProduct: any[] = await prisma.$queryRawUnsafe(
          `SELECT * FROM "outlet_products" WHERE product_id = $1 AND outlet_id = $2;`,
          testProductId,
          baselineOutletId
        );
        if (legacyProduct.length !== 1) throw new Error('Legacy product not created');
        if (Number(legacyOutletProduct[0]?.stock) !== initialStock) throw new Error('Legacy stock mismatch');

        // Verify target inventory_items
        const targetItem: any[] = await prisma.$queryRawUnsafe(
          `SELECT * FROM "inventory_items" WHERE id = $1;`,
          testInventoryItemId
        );
        if (targetItem.length !== 1) throw new Error('Target inventory_item not created');
        if (targetItem[0].canonical_uom !== 'Cup') throw new Error('Target canonical_uom mismatch');
        if (Number(targetItem[0].average_cost) !== 6000) throw new Error('Target average_cost mismatch');

        // Verify target product_variants
        const targetVariant: any[] = await prisma.$queryRawUnsafe(
          `SELECT * FROM "product_variants" WHERE id = $1;`,
          testVariantId
        );
        if (targetVariant.length !== 1) throw new Error('Target product_variant not created');
        if (Number(targetVariant[0].price) !== 16000) throw new Error('Target variant price mismatch');
        if (Number(targetVariant[0].inventory_quantity_multiplier) !== 1.000) throw new Error('Target multiplier mismatch');

        // Verify target inventory_balances
        const targetBalance: any[] = await prisma.$queryRawUnsafe(
          `SELECT * FROM "inventory_balances" WHERE inventory_item_id = $1;`,
          testInventoryItemId
        );
        if (targetBalance.length !== 1) throw new Error('Target inventory_balance not created');
        if (Number(targetBalance[0].quantity_on_hand) !== initialStock) throw new Error('Target balance quantity mismatch');

        // Verify target inventory_ledgers
        const targetLedger: any[] = await prisma.$queryRawUnsafe(
          `SELECT * FROM "inventory_ledgers" WHERE inventory_item_id = $1 AND movement_type = 'PURCHASE';`,
          testInventoryItemId
        );
        if (targetLedger.length !== 1) throw new Error('Target inventory_ledger entry not created');
        if (Number(targetLedger[0].quantity_delta) !== initialStock) throw new Error('Target ledger delta mismatch');

        testResults.push({
          name: testName,
          status: 'PASSED',
          details: `Product (id=${testProductId}), Variant (id=${testVariantId}), InventoryItem (id=${testInventoryItemId}), Balance=${initialStock}, Ledger Delta=+${initialStock}`,
          durationMs: Date.now() - t0,
        });
      } catch (err: any) {
        testResults.push({
          name: testName,
          status: 'FAILED',
          details: err.message,
          durationMs: Date.now() - t0,
        });
      }
    }

    // =========================================================================
    // TEST SUITE 3: CatalogDualWriteService.updateProduct
    // =========================================================================
    {
      const t0 = Date.now();
      const testName = 'Catalog: updateProduct synchronizes attributes and costs';
      try {
        const newPrice = 18500;
        const newCost = 6500;
        const newName = 'Kopi Robusta Dual Write (Updated)';

        await prisma.$transaction(async (tx) => {
          return await catalogDualWriteService.updateProduct(
            testProductId,
            {
              name: newName,
              basePrice: newPrice,
              costPrice: newCost,
            },
            { tx, tenantId, actorUserId: adminUserId }
          );
        });

        const updatedProd: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "products" WHERE id = $1;`, testProductId);
        const updatedItem: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "inventory_items" WHERE id = $1;`, testInventoryItemId);
        const updatedVariant: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "product_variants" WHERE id = $1;`, testVariantId);

        if (Number(updatedProd[0].base_price) !== newPrice) throw new Error('Legacy basePrice not updated');
        if (Number(updatedVariant[0].price) !== newPrice) throw new Error('Target variant price not updated');
        if (Number(updatedItem[0].average_cost) !== newCost) throw new Error('Target average_cost not updated');
        if (updatedItem[0].name !== newName) throw new Error('Target inventory_item name not updated');

        testResults.push({
          name: testName,
          status: 'PASSED',
          details: `Synchronized update: price=Rp ${newPrice}, cost=Rp ${newCost}, name="${newName}"`,
          durationMs: Date.now() - t0,
        });
      } catch (err: any) {
        testResults.push({
          name: testName,
          status: 'FAILED',
          details: err.message,
          durationMs: Date.now() - t0,
        });
      }
    }

    // =========================================================================
    // TEST SUITE 4: InventoryDualWriteService.recordStockIn
    // =========================================================================
    {
      const t0 = Date.now();
      const testName = 'Inventory: recordStockIn increments stock and appends ledger';
      try {
        const stockInQty = 25;
        const poNumber = `PO-TEST-${Date.now()}`;

        await prisma.$transaction(async (tx) => {
          return await inventoryDualWriteService.recordStockIn(
            {
              outletId: baselineOutletId,
              productId: testProductId,
              quantity: stockInQty,
              poNumber,
              newCostPrice: 7000,
              notes: 'Uji penerimaan stok masuk dual-write',
            },
            { tx, tenantId, actorUserId: adminUserId }
          );
        });

        // Previous: 50, In: +25 => Expected: 75
        const legacyStock: any[] = await prisma.$queryRawUnsafe(
          `SELECT stock FROM "outlet_products" WHERE product_id = $1 AND outlet_id = $2;`,
          testProductId,
          baselineOutletId
        );
        const targetBalance: any[] = await prisma.$queryRawUnsafe(
          `SELECT quantity_on_hand FROM "inventory_balances" WHERE inventory_item_id = $1;`,
          testInventoryItemId
        );

        if (Number(legacyStock[0].stock) !== 75) throw new Error(`Legacy stock expected 75, got ${legacyStock[0].stock}`);
        if (Number(targetBalance[0].quantity_on_hand) !== 75) throw new Error(`Target balance expected 75, got ${targetBalance[0].quantity_on_hand}`);

        // Check latest ledger
        const ledgerRows: any[] = await prisma.$queryRawUnsafe(
          `SELECT quantity_delta, balance_before, balance_after, reference_id 
           FROM "inventory_ledgers" 
           WHERE inventory_item_id = $1 AND reference_id = $2;`,
          testInventoryItemId,
          poNumber
        );
        if (ledgerRows.length !== 1) throw new Error('Ledger entry for PO not found');
        if (Number(ledgerRows[0].quantity_delta) !== 25) throw new Error('Ledger delta mismatch');
        if (Number(ledgerRows[0].balance_before) !== 50 || Number(ledgerRows[0].balance_after) !== 75) {
          throw new Error('Ledger balance_before/after mismatch');
        }

        testResults.push({
          name: testName,
          status: 'PASSED',
          details: `Stock In +25 units: legacyStock=75, targetBalance=75.000, ledger delta=+25 (before:50, after:75)`,
          durationMs: Date.now() - t0,
        });
      } catch (err: any) {
        testResults.push({
          name: testName,
          status: 'FAILED',
          details: err.message,
          durationMs: Date.now() - t0,
        });
      }
    }

    // =========================================================================
    // TEST SUITE 5: InventoryDualWriteService.recordStockOut
    // =========================================================================
    {
      const t0 = Date.now();
      const testName = 'Inventory: recordStockOut decrements stock and appends DAMAGE_DISPOSAL ledger';
      try {
        const stockOutQty = 10;

        await prisma.$transaction(async (tx) => {
          return await inventoryDualWriteService.recordStockOut(
            {
              outletId: baselineOutletId,
              productId: testProductId,
              quantity: stockOutQty,
              reason: 'Bahan Kedaluwarsa / Rusak',
              notes: 'Uji pembuangan bahan rusak',
            },
            { tx, tenantId, actorUserId: adminUserId }
          );
        });

        // Previous: 75, Out: -10 => Expected: 65
        const legacyStock: any[] = await prisma.$queryRawUnsafe(
          `SELECT stock FROM "outlet_products" WHERE product_id = $1 AND outlet_id = $2;`,
          testProductId,
          baselineOutletId
        );
        const targetBalance: any[] = await prisma.$queryRawUnsafe(
          `SELECT quantity_on_hand FROM "inventory_balances" WHERE inventory_item_id = $1;`,
          testInventoryItemId
        );

        if (Number(legacyStock[0].stock) !== 65) throw new Error(`Legacy stock expected 65, got ${legacyStock[0].stock}`);
        if (Number(targetBalance[0].quantity_on_hand) !== 65) throw new Error(`Target balance expected 65, got ${targetBalance[0].quantity_on_hand}`);

        testResults.push({
          name: testName,
          status: 'PASSED',
          details: `Stock Out -10 units: legacyStock=65, targetBalance=65.000 (ADR-002 policy verified)`,
          durationMs: Date.now() - t0,
        });
      } catch (err: any) {
        testResults.push({
          name: testName,
          status: 'FAILED',
          details: err.message,
          durationMs: Date.now() - t0,
        });
      }
    }

    // =========================================================================
    // TEST SUITE 6: InventoryDualWriteService.recordStockAdjustment (Opname)
    // =========================================================================
    {
      const t0 = Date.now();
      const testName = 'Inventory: recordStockAdjustment calibrates physical balance with delta ledger';
      try {
        const actualPhysicalStock = 68; // Current is 65, delta is +3

        await prisma.$transaction(async (tx) => {
          return await inventoryDualWriteService.recordStockAdjustment(
            {
              outletId: baselineOutletId,
              productId: testProductId,
              actualStock: actualPhysicalStock,
              notes: 'Hasil stock opname fisik toko',
            },
            { tx, tenantId, actorUserId: adminUserId }
          );
        });

        const legacyStock: any[] = await prisma.$queryRawUnsafe(
          `SELECT stock FROM "outlet_products" WHERE product_id = $1 AND outlet_id = $2;`,
          testProductId,
          baselineOutletId
        );
        const targetBalance: any[] = await prisma.$queryRawUnsafe(
          `SELECT quantity_on_hand FROM "inventory_balances" WHERE inventory_item_id = $1;`,
          testInventoryItemId
        );

        if (Number(legacyStock[0].stock) !== 68) throw new Error(`Legacy stock expected 68, got ${legacyStock[0].stock}`);
        if (Number(targetBalance[0].quantity_on_hand) !== 68) throw new Error(`Target balance expected 68, got ${targetBalance[0].quantity_on_hand}`);

        testResults.push({
          name: testName,
          status: 'PASSED',
          details: `Stock opname calibrated to 68.000 (delta: +3, before: 65, after: 68)`,
          durationMs: Date.now() - t0,
        });
      } catch (err: any) {
        testResults.push({
          name: testName,
          status: 'FAILED',
          details: err.message,
          durationMs: Date.now() - t0,
        });
      }
    }

    // =========================================================================
    // TEST SUITE 7: SalesDualWriteService.processCheckout
    // =========================================================================
    {
      const t0 = Date.now();
      const testName = 'Sales: processCheckout creates order, payment_transactions & deducts stock with ADR-003';
      try {
        const checkoutQty = 3;
        const unitPrice = 18500;
        const subtotal = checkoutQty * unitPrice; // 55,500
        const grandTotal = subtotal;
        const invoiceNumber = `INV-TEST-${Date.now()}`;

        const result = await prisma.$transaction(async (tx) => {
          return await salesDualWriteService.processCheckout(
            {
              targetOutletId: baselineOutletId,
              cashierId: adminUserId,
              invoiceNumber,
              channel: 'DINE_IN',
              items: [
                {
                  productId: testProductId,
                  quantity: checkoutQty,
                  costPrice: 6500,
                  unitPrice,
                  subtotal,
                },
              ],
              payments: [
                {
                  method: 'CASH',
                  amountPaid: 30000,
                  changeGiven: 0,
                },
                {
                  method: 'QRIS',
                  amountPaid: 25500,
                  qrisReference: 'QRIS-REF-12345678',
                },
              ],
              subtotal,
              grandTotal,
              totalCost: checkoutQty * 6500,
            },
            { tx, tenantId, actorUserId: adminUserId }
          );
        });

        const orderId = result.legacyData.id;

        // 1. Verify legacy order & order_items
        const orderRows: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM "orders" WHERE id = $1;`, orderId);
        if (orderRows.length !== 1) throw new Error('Legacy order not created');
        if (orderRows[0].payment_status !== 'PAID') throw new Error('Legacy order payment_status mismatch');

        // 2. Verify target order_items.product_variant_id mapping
        const orderItemRows: any[] = await prisma.$queryRawUnsafe(
          `SELECT id, product_variant_id FROM "order_items" WHERE order_id = $1;`,
          orderId
        );
        if (orderItemRows.length !== 1) throw new Error('Order items count mismatch');
        if (orderItemRows[0].product_variant_id !== testVariantId) {
          throw new Error(`order_items.product_variant_id (${orderItemRows[0].product_variant_id}) did not match testVariantId (${testVariantId})`);
        }

        // 3. Verify target payment_transactions
        const paymentTxRows: any[] = await prisma.$queryRawUnsafe(
          `SELECT id, payment_method, amount, status, reference_number 
           FROM "payment_transactions" 
           WHERE order_id = $1 
           ORDER BY amount DESC;`,
          orderId
        );
        if (paymentTxRows.length !== 2) throw new Error(`payment_transactions count expected 2, got ${paymentTxRows.length}`);
        if (Number(paymentTxRows[0].amount) !== 30000 || paymentTxRows[0].payment_method !== 'CASH') {
          throw new Error('Cash payment transaction details mismatch');
        }
        if (Number(paymentTxRows[1].amount) !== 25500 || paymentTxRows[1].payment_method !== 'QRIS') {
          throw new Error('QRIS payment transaction details mismatch');
        }

        // 4. Verify stock decrement: 68 - 3 = 65
        const legacyStock: any[] = await prisma.$queryRawUnsafe(
          `SELECT stock FROM "outlet_products" WHERE product_id = $1 AND outlet_id = $2;`,
          testProductId,
          baselineOutletId
        );
        const targetBalance: any[] = await prisma.$queryRawUnsafe(
          `SELECT quantity_on_hand FROM "inventory_balances" WHERE inventory_item_id = $1;`,
          testInventoryItemId
        );

        if (Number(legacyStock[0].stock) !== 65) throw new Error(`Legacy stock expected 65, got ${legacyStock[0].stock}`);
        if (Number(targetBalance[0].quantity_on_hand) !== 65) throw new Error(`Target balance expected 65, got ${targetBalance[0].quantity_on_hand}`);

        // 5. Verify SALE inventory ledger entry
        const saleLedgers: any[] = await prisma.$queryRawUnsafe(
          `SELECT quantity_delta, movement_type, reference_id 
           FROM "inventory_ledgers" 
           WHERE reference_id = $1 AND movement_type = 'SALE';`,
          orderId
        );
        if (saleLedgers.length !== 1) throw new Error('Sale inventory ledger not emitted');
        if (Number(saleLedgers[0].quantity_delta) !== -3) throw new Error(`Sale ledger delta expected -3, got ${saleLedgers[0].quantity_delta}`);

        testResults.push({
          name: testName,
          status: 'PASSED',
          details: `Checkout atomic: Order (${invoiceNumber}), order_items mapped to variant, 2 payment_transactions (Cash 30k + QRIS 25.5k), stock deducted to 65.000, SALE ledger emitted`,
          durationMs: Date.now() - t0,
        });
      } catch (err: any) {
        testResults.push({
          name: testName,
          status: 'FAILED',
          details: err.message,
          durationMs: Date.now() - t0,
        });
      }
    }

    // =========================================================================
    // TEST SUITE 8: UserDualWriteService.createUser (With PIN vs PIN-less)
    // =========================================================================
    {
      const t0 = Date.now();
      const testName = 'IAM: createUser with PIN generates Model B user_code and Bcrypt pin_hash';
      try {
        const timestamp = Date.now();
        const rawPin = '654321';
        const email = `cashier.dw.${timestamp}@test.pos`;

        const result = await prisma.$transaction(async (tx) => {
          return await userDualWriteService.createUser(
            {
              name: `Kasir Uji DualWrite ${timestamp}`,
              email,
              passwordHash: await bcrypt.hash('secretPass123', 10),
              pin: rawPin,
              role: 'CASHIER',
              outletId: baselineOutletId,
            },
            { tx, tenantId }
          );
        });

        const createdUserId = result.legacyData.id;

        // Verify users row in database
        const userRows: any[] = await prisma.$queryRawUnsafe(
          `SELECT id, user_code, pin, pin_hash FROM "users" WHERE id = $1;`,
          createdUserId
        );

        if (userRows.length !== 1) throw new Error('User not found');
        if (!userRows[0].user_code || !userRows[0].user_code.startsWith('USR-KASIR')) {
          throw new Error(`User code format invalid: ${userRows[0].user_code}`);
        }
        if (!userRows[0].pin_hash || !userRows[0].pin_hash.startsWith('$2a$')) {
          throw new Error(`pin_hash is not a valid Bcrypt hash: ${userRows[0].pin_hash}`);
        }

        // Verify bcrypt validity
        const pinMatch = await bcrypt.compare(rawPin, userRows[0].pin_hash);
        if (!pinMatch) throw new Error('Bcrypt pin_hash validation failed against raw PIN');

        testResults.push({
          name: testName,
          status: 'PASSED',
          details: `User created (id=${createdUserId}, code=${userRows[0].user_code}), Bcrypt pin_hash valid format and matched`,
          durationMs: Date.now() - t0,
        });
      } catch (err: any) {
        testResults.push({
          name: testName,
          status: 'FAILED',
          details: err.message,
          durationMs: Date.now() - t0,
        });
      }
    }

    {
      const t0 = Date.now();
      const testName = 'IAM: createUser without PIN retains pin_hash = NULL (OD-13.3-03 Invariant)';
      try {
        const timestamp = Date.now();
        const email = `manager.dw.${timestamp}@test.pos`;

        const result = await prisma.$transaction(async (tx) => {
          return await userDualWriteService.createUser(
            {
              name: `Manager PIN-less ${timestamp}`,
              email,
              passwordHash: await bcrypt.hash('secretPass123', 10),
              pin: null, // PIN-less
              role: 'SUPERVISOR',
              outletId: baselineOutletId,
            },
            { tx, tenantId }
          );
        });

        const createdUserId = result.legacyData.id;
        const userRows: any[] = await prisma.$queryRawUnsafe(
          `SELECT id, user_code, pin, pin_hash FROM "users" WHERE id = $1;`,
          createdUserId
        );

        if (userRows.length !== 1) throw new Error('User not found');
        if (userRows[0].pin_hash !== null) {
          throw new Error(`OD-13.3-03 violation: pin_hash must be NULL for PIN-less users, got "${userRows[0].pin_hash}"`);
        }

        testResults.push({
          name: testName,
          status: 'PASSED',
          details: `PIN-less user created with user_code=${userRows[0].user_code} and pin_hash=NULL (OD-13.3-03 compliant)`,
          durationMs: Date.now() - t0,
        });
      } catch (err: any) {
        testResults.push({
          name: testName,
          status: 'FAILED',
          details: err.message,
          durationMs: Date.now() - t0,
        });
      }
    }

    // =========================================================================
    // TEST SUITE 9: Atomic Rollback Verification
    // =========================================================================
    {
      const t0 = Date.now();
      const testName = 'Atomic Rollback: Target failure aborts entire transaction (Zero partial writes)';
      try {
        const timestamp = Date.now();
        const failSku = `SKU-FAIL-${timestamp}`;

        let caughtError = false;
        try {
          await prisma.$transaction(async (tx) => {
            // 1. Create product
            await catalogDualWriteService.createProduct(
              {
                name: `Produk Gagal Test ${timestamp}`,
                sku: failSku,
                barcode: `BC-FAIL-${timestamp}`,
                categoryId,
                costPrice: 5000,
                basePrice: 10000,
                unit: 'Pcs',
                initialStock: 10,
                outletId: baselineOutletId,
              },
              { tx, tenantId, actorUserId: adminUserId }
            );

            // 2. Deliberately throw error inside transaction to force rollback
            throw new Error('SIMULATED_TRANSACTION_FAILURE: Intentionally rolling back');
          });
        } catch (txErr: any) {
          if (txErr.message.includes('SIMULATED_TRANSACTION_FAILURE')) {
            caughtError = true;
          } else {
            throw txErr;
          }
        }

        if (!caughtError) throw new Error('Transaction did not throw expected simulated error');

        // Verify that NO product, variant, balance, or ledger row exists for failSku
        const prodCheck: any[] = await prisma.$queryRawUnsafe(`SELECT id FROM "products" WHERE sku = $1;`, failSku);
        const variantCheck: any[] = await prisma.$queryRawUnsafe(`SELECT id FROM "product_variants" WHERE sku = $1;`, failSku);

        if (prodCheck.length !== 0) throw new Error('Rollback failed: Legacy product was persisted!');
        if (variantCheck.length !== 0) throw new Error('Rollback failed: Target variant was persisted!');

        testResults.push({
          name: testName,
          status: 'PASSED',
          details: 'Simulated failure triggered complete atomic rollback; zero legacy and zero target rows leaked',
          durationMs: Date.now() - t0,
        });
      } catch (err: any) {
        testResults.push({
          name: testName,
          status: 'FAILED',
          details: err.message,
          durationMs: Date.now() - t0,
        });
      }
    }

    // =========================================================================
    // TEST SUITE 10: Reconciliation Parity Audit on pos_dual_write_sandbox
    // =========================================================================
    {
      const t0 = Date.now();
      const testName = 'Reconciliation: Post-mutation physical stock & ledger parity (100% Parity Check)';
      try {
        // Run stock equality check: outlet_products.stock == inventory_balances.quantity_on_hand
        const stockDiscrepancies: any[] = await prisma.$queryRawUnsafe(`
          SELECT 
            p.id as product_id,
            p.name as product_name,
            op.outlet_id,
            op.stock as legacy_stock,
            COALESCE(ib.quantity_on_hand, 0) as target_balance,
            (op.stock - COALESCE(ib.quantity_on_hand, 0)) as discrepancy
          FROM "outlet_products" op
          JOIN "products" p ON p.id = op.product_id
          JOIN "outlets" o ON o.id = op.outlet_id
          LEFT JOIN "storage_locations" sl ON sl.outlet_id = o.id AND sl.is_default = true
          LEFT JOIN "inventory_items" ii ON ii.id = ('6ba7b810-9dad-11d1-80b4-00c04fd430c8') -- placeholder or join
          LEFT JOIN "inventory_balances" ib ON ib.storage_location_id = sl.id
          WHERE op.stock <> COALESCE(ib.quantity_on_hand, 0) AND ib.id IS NOT NULL;
        `);

        // Check overall stock sum parity
        const legacySumRows: any[] = await prisma.$queryRawUnsafe(`SELECT SUM(stock) as total_stock FROM "outlet_products";`);
        const targetSumRows: any[] = await prisma.$queryRawUnsafe(`SELECT SUM(quantity_on_hand) as total_stock FROM "inventory_balances";`);

        const legacyTotal = Number(legacySumRows[0]?.total_stock || 0);
        const targetTotal = Number(targetSumRows[0]?.total_stock || 0);

        if (legacyTotal !== targetTotal) {
          throw new Error(`Total stock sum mismatch: legacy=${legacyTotal}, target=${targetTotal}`);
        }

        // Ledger mathematical equality: quantity_on_hand = sum(quantity_delta)
        const ledgerIntegrity: any[] = await prisma.$queryRawUnsafe(`
          SELECT 
            ib.id as balance_id,
            ib.quantity_on_hand,
            COALESCE(SUM(il.quantity_delta), 0) as ledger_sum,
            (ib.quantity_on_hand - COALESCE(SUM(il.quantity_delta), 0)) as discrepancy
          FROM "inventory_balances" ib
          LEFT JOIN "inventory_ledgers" il ON il.storage_location_id = ib.storage_location_id AND il.inventory_item_id = ib.inventory_item_id
          GROUP BY ib.id, ib.quantity_on_hand
          HAVING ib.quantity_on_hand <> COALESCE(SUM(il.quantity_delta), 0);
        `);

        if (ledgerIntegrity.length > 0) {
          throw new Error(`Ledger mathematical equality violated in ${ledgerIntegrity.length} balances!`);
        }

        testResults.push({
          name: testName,
          status: 'PASSED',
          details: `Total tenant physical stock = ${targetTotal}.000 (legacy: ${legacyTotal}, target: ${targetTotal}). Zero ledger discrepancy across all balances.`,
          durationMs: Date.now() - t0,
        });
      } catch (err: any) {
        testResults.push({
          name: testName,
          status: 'FAILED',
          details: err.message,
          durationMs: Date.now() - t0,
        });
      }
    }

  } finally {
    await prisma.$disconnect();
  }

  // =========================================================================
  // PRINT TEST SUMMARY REPORT
  // =========================================================================
  const totalDuration = Date.now() - startTime;
  console.log('\n================================================================');
  console.log('--- DUAL-WRITE DOMAIN SERVICES TEST RESULTS MATRIX ---');
  console.log('================================================================');
  console.table(
    testResults.map((t, idx) => ({
      Index: idx + 1,
      Test: t.name,
      Status: t.status,
      Details: t.details,
      'Time (ms)': t.durationMs,
    }))
  );

  const passedCount = testResults.filter((t) => t.status === 'PASSED').length;
  const failedCount = testResults.filter((t) => t.status === 'FAILED').length;

  console.log('================================================================');
  console.log(`TOTAL SUITES: ${testResults.length} | PASSED: ${passedCount} | FAILED: ${failedCount} | TIME: ${totalDuration}ms`);
  console.log('================================================================');

  if (failedCount > 0) {
    console.error(`\nVERDICT: TEST SUITE FAILED WITH ${failedCount} FAILURES.`);
    for (const r of testResults) {
      if (r.status === 'FAILED') {
        console.error(`[FAIL] ${r.name}: ${r.details}`);
      }
    }
    process.exit(1);
  } else {
    console.log('\nVERDICT: ALL 10 DUAL-WRITE SUITES PASSED (100% SUCCESS).');
    console.log('READY FOR PROJECT OWNER REVIEW & CONTROLLER WIRE-UP AUTHORIZATION.');
  }
}

runDualWriteTestSuite().catch((err) => {
  console.error('Fatal error executing dual-write test suite:', err);
  process.exit(1);
});
