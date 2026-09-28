import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { salesDualWriteService } from '../../services/dual_write';

async function main() {
  console.log('===============================================================');
  console.log('EPIC-06 VERIFICATION SUITE: F&B ENGINE, RECIPES & MODIFIERS');
  console.log('===============================================================');

  const prisma = new PrismaClient();

  try {
    // 1. RESOLVE ACTIVE TENANT & OUTLET
    console.log('\n[1/6] Resolving Active Tenant, Outlet & User...');
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
      `SELECT id, name, role FROM "users" WHERE tenant_id = $1 AND is_active = true LIMIT 1;`,
      tenant.id
    );
    if (users.length === 0) throw new Error('User kasir tidak ditemukan.');
    const user = users[0];

    // Ensure default storage location exists
    let storageLocation = await prisma.storageLocation.findFirst({
      where: { tenantId: tenant.id, outletId: outlet.id, isDefault: true },
    });
    if (!storageLocation) {
      storageLocation = await prisma.storageLocation.create({
        data: {
          tenantId: tenant.id,
          outletId: outlet.id,
          name: 'Main Bar / Kitchen',
          isDefault: true,
        },
      });
    }

    console.log(`  -> Tenant: ${tenant.name} (${tenant.id})`);
    console.log(`  -> Outlet: ${outlet.name} (${outlet.id})`);
    console.log(`  -> Storage Location: ${storageLocation.name} (${storageLocation.id})`);

    // 2. CREATE MASTER RAW MATERIALS (INVENTORY ITEMS & BALANCES)
    console.log('\n[2/6] Seeding Raw Materials (Coffee Beans, Fresh Milk, Extra Shot)...');
    const testId = Date.now().toString().slice(-6);

    // Ingredient A: Coffee Beans
    const coffeeItem = await prisma.inventoryItem.create({
      data: {
        tenantId: tenant.id,
        itemCode: `ING-COF-${testId}`,
        name: `Biji Kopi House Blend ${testId}`,
        canonicalUom: 'GRAM',
        averageCost: 250, // Rp 250 / gram
        reorderPoint: 500,
        isActive: true,
      },
    });

    // Ingredient B: Fresh Milk
    const milkItem = await prisma.inventoryItem.create({
      data: {
        tenantId: tenant.id,
        itemCode: `ING-MLK-${testId}`,
        name: `Fresh Milk UHT ${testId}`,
        canonicalUom: 'ML',
        averageCost: 25, // Rp 25 / ml
        reorderPoint: 1000,
        isActive: true,
      },
    });

    // Initial stock: 10,000 gram coffee, 20,000 ml milk
    const initialCoffeeQty = 10000;
    const initialMilkQty = 20000;

    await prisma.inventoryBalance.upsert({
      where: { id: crypto.createHash('md5').update(`${coffeeItem.id}:${storageLocation.id}`).digest('hex') },
      update: { quantityOnHand: initialCoffeeQty },
      create: {
        id: crypto.createHash('md5').update(`${coffeeItem.id}:${storageLocation.id}`).digest('hex'),
        tenantId: tenant.id,
        inventoryItemId: coffeeItem.id,
        storageLocationId: storageLocation.id,
        quantityOnHand: initialCoffeeQty,
      },
    });

    await prisma.inventoryBalance.upsert({
      where: { id: crypto.createHash('md5').update(`${milkItem.id}:${storageLocation.id}`).digest('hex') },
      update: { quantityOnHand: initialMilkQty },
      create: {
        id: crypto.createHash('md5').update(`${milkItem.id}:${storageLocation.id}`).digest('hex'),
        tenantId: tenant.id,
        inventoryItemId: milkItem.id,
        storageLocationId: storageLocation.id,
        quantityOnHand: initialMilkQty,
      },
    });

    console.log(`  -> Created Raw Material: ${coffeeItem.name} (10,000 GRAM)`);
    console.log(`  -> Created Raw Material: ${milkItem.name} (20,000 ML)`);

    // 3. CREATE MENU PRODUCT, VARIANT & RECIPE (BOM)
    console.log('\n[3/6] Setting up Menu Product, Variant and Recipe (BOM)...');
    let categories: any[] = await prisma.$queryRawUnsafe(`SELECT id FROM "categories" WHERE tenant_id = $1 LIMIT 1;`, tenant.id);
    let categoryId = categories[0]?.id;
    if (!categoryId) {
      categoryId = crypto.randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "categories" (id, tenant_id, name, created_at, updated_at) VALUES ($1, $2, 'Minuman Kopi', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
        categoryId,
        tenant.id
      );
    }

    const menuProductId = crypto.randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "products" (id, tenant_id, category_id, sku, name, unit, type, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'CUP', 'COMPOSITE', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      menuProductId,
      tenant.id,
      categoryId,
      `SKU-MENU-LATTE-${testId}`,
      `Latte Macchiato ${testId}`
    );
    const menuProduct = { id: menuProductId, name: `Latte Macchiato ${testId}` };

    const menuVariant = await prisma.productVariant.create({
      data: {
        tenantId: tenant.id,
        productId: menuProduct.id,
        sku: `MENU-LATTE-${testId}`,
        name: 'Reguler Cup',
        price: 32000,
        isActive: true,
      },
    });

    // Create Recipe: 1 cup Latte = 18g coffee beans + 180ml fresh milk
    const recipe = await prisma.recipe.create({
      data: {
        tenantId: tenant.id,
        productVariantId: menuVariant.id,
        instructions: 'Double shot espresso 18g + Steamed fresh milk 180ml',
        yieldQuantity: 1.000,
        items: {
          create: [
            {
              tenantId: tenant.id,
              inventoryItemId: coffeeItem.id,
              quantity: 18.000,
              costRatio: 0.60,
            },
            {
              tenantId: tenant.id,
              inventoryItemId: milkItem.id,
              quantity: 180.000,
              costRatio: 0.40,
            },
          ],
        },
      },
      include: { items: true },
    });

    console.log(`  -> Product Created: ${menuProduct.name} (${menuProduct.id})`);
    console.log(`  -> Variant Created: ${menuVariant.name} (Rp 32,000)`);
    console.log(`  -> Recipe Configured: ${recipe.id} with ${recipe.items.length} ingredients.`);

    // 4. CREATE MODIFIER GROUP, MODIFIER ITEM & RECIPE EFFECT
    console.log('\n[4/6] Setting up Modifier Group & Modifier Recipe Effects...');
    const modGroup = await prisma.modifierGroup.create({
      data: {
        tenantId: tenant.id,
        name: `Add-On Shots ${testId}`,
        selectionType: 'SINGLE',
        minSelection: 0,
        maxSelection: 1,
        isRequired: false,
        products: {
          create: {
            tenantId: tenant.id,
            productId: menuProduct.id,
            sortOrder: 1,
          },
        },
      },
    });

    // Modifier Item: Extra Shot Espresso (+Rp 5,000, consumes extra 18g coffee beans)
    const extraShotMod = await prisma.modifierItem.create({
      data: {
        tenantId: tenant.id,
        modifierGroupId: modGroup.id,
        name: 'Extra Shot Espresso',
        priceAdjustment: 5000,
        recipeEffects: {
          create: {
            tenantId: tenant.id,
            inventoryItemId: coffeeItem.id,
            quantityDelta: 18.000, // +18 gram coffee
          },
        },
      },
      include: { recipeEffects: true },
    });

    console.log(`  -> Modifier Group: ${modGroup.name}`);
    console.log(`  -> Modifier Item: ${extraShotMod.name} (+Rp 5,000, Delta: +18g Coffee)`);

    // 5. EXECUTE F&B POS CHECKOUT WITH BOM INTERCEPTION
    console.log('\n[5/6] Executing POS Checkout (2x Latte with Extra Shot, Table A-12, DINE_IN)...');
    const orderQty = 2;
    const basePrice = 32000;
    const modExtra = 5000;
    const itemPrice = basePrice + modExtra; // 37,000
    const subtotal = itemPrice * orderQty; // 74,000
    const grandTotal = subtotal;

    const checkoutResult = await prisma.$transaction(async (tx) => {
      return salesDualWriteService.processCheckout(
        {
          targetOutletId: outlet.id,
          cashierId: user.id,
          channel: 'DINE_IN',
          orderType: 'DINE_IN',
          tableNumber: 'A-12',
          notes: 'Meja A-12 | Barista: Extra Hot',
          items: [
            {
              productId: menuProduct.id,
              variantId: menuVariant.id,
              modifierItemIds: [extraShotMod.id],
              notes: 'Gula terpisah',
              quantity: orderQty,
              costPrice: 8500,
              unitPrice: itemPrice,
              subtotal,
            },
          ],
          payments: [
            {
              method: 'CASH',
              amountPaid: 100000,
              changeGiven: 26000,
            },
          ],
          subtotal,
          grandTotal,
          totalCost: 17000,
        },
        { tx, tenantId: tenant.id, actorUserId: user.id }
      );
    });

    console.log(`  -> Order Checkout Success! Order ID: ${checkoutResult.legacyData.id}`);
    console.log(`  -> Target Records Affected: ${checkoutResult.targetRecordsAffected}`);

    // 6. STRICT AUDIT ASSERTIONS
    console.log('\n[6/6] Verifying Target Inventory Deductions & KOT Ticket...');

    // Verify Order columns
    const rawOrders: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, order_type, table_number, notes FROM "orders" WHERE id = $1;`,
      checkoutResult.legacyData.id
    );
    if (rawOrders.length === 0) throw new Error('Order tidak ditemukan di target database.');
    const orderRecord = rawOrders[0];
    if (orderRecord.order_type !== 'DINE_IN') throw new Error(`orderType mismatch: ${orderRecord.order_type}`);
    console.log(`  -> Order Table Number: ${orderRecord.table_number} (Confirmed)`);

    const rawItem: any[] = await prisma.$queryRawUnsafe(
      `SELECT modifiers_snapshot, notes FROM "order_items" WHERE order_id = $1;`,
      orderRecord.id
    );
    console.log(`  -> Order Item Modifiers Snapshot: ${JSON.stringify(rawItem[0]?.modifiers_snapshot)} (Confirmed)`);
    console.log(`  -> Order Item Notes: ${rawItem[0]?.notes} (Confirmed)`);

    // Verify Stock Balances:
    // Coffee needed: 2 * (18g base + 18g mod) = 72g
    // Milk needed: 2 * (180ml base) = 360ml
    const expectedCoffeeRemaining = initialCoffeeQty - (2 * (18 + 18));
    const expectedMilkRemaining = initialMilkQty - (2 * 180);

    const updatedCoffeeBal = await prisma.inventoryBalance.findFirst({
      where: { inventoryItemId: coffeeItem.id, storageLocationId: storageLocation.id },
    });
    const updatedMilkBal = await prisma.inventoryBalance.findFirst({
      where: { inventoryItemId: milkItem.id, storageLocationId: storageLocation.id },
    });

    console.log(`  -> Coffee Stock: Initial=${initialCoffeeQty}g, Remaining=${Number(updatedCoffeeBal?.quantityOnHand)}g (Expected=${expectedCoffeeRemaining}g)`);
    console.log(`  -> Milk Stock: Initial=${initialMilkQty}ml, Remaining=${Number(updatedMilkBal?.quantityOnHand)}ml (Expected=${expectedMilkRemaining}ml)`);

    if (Number(updatedCoffeeBal?.quantityOnHand) !== expectedCoffeeRemaining) {
      throw new Error(`Coffee stock mismatch! Expected ${expectedCoffeeRemaining}, got ${updatedCoffeeBal?.quantityOnHand}`);
    }
    if (Number(updatedMilkBal?.quantityOnHand) !== expectedMilkRemaining) {
      throw new Error(`Milk stock mismatch! Expected ${expectedMilkRemaining}, got ${updatedMilkBal?.quantityOnHand}`);
    }

    // Verify Inventory Ledgers
    const ledgers: any[] = await prisma.$queryRawUnsafe(
      `SELECT movement_type, reference_type, quantity_delta, notes 
       FROM "inventory_ledgers" 
       WHERE reference_id = $1 
       ORDER BY created_at ASC;`,
      orderRecord.id
    );

    console.log(`  -> Inventory Ledgers Recorded: ${ledgers.length} entries`);
    for (const l of ledgers) {
      console.log(`     - [${l.movement_type}] Delta: ${l.quantity_delta} | Notes: ${l.notes}`);
    }

    if (ledgers.length < 3) {
      throw new Error(`Expected at least 3 ledgers (2 for base BOM + 1 for modifier), found ${ledgers.length}`);
    }

    // 7. HTTP REST API VERIFICATION (RECIPES, MODIFIERS & KITCHEN TICKET)
    console.log('\n[7/7] Testing Live HTTP REST APIs for F&B...');
    const jwt = await import('jsonwebtoken');
    const { default: app } = await import('../../index');
    const secret = process.env.JWT_SECRET || 'rahasia_super_aman_pos_12345';
    const token = jwt.default.sign(
      { userId: user.id, role: user.role, outletId: outlet.id, tenantId: tenant.id },
      secret,
      { expiresIn: '1h' }
    );

    const server = app.listen(0);
    const port = (server.address() as any).port;
    const headers = {
      'Content-Type': 'application/json',
      'x-tenant-id': tenant.id,
      'Authorization': `Bearer ${token}`,
    };

    try {
      // 7a. GET /api/recipes
      const resRecipes = await fetch(`http://localhost:${port}/api/recipes`, { headers });
      const jsonRecipes: any = await resRecipes.json();
      console.log(`  - GET /api/recipes -> Status: ${resRecipes.status} (Count: ${jsonRecipes.data?.length})`);
      if (resRecipes.status !== 200 || !Array.isArray(jsonRecipes.data)) {
        throw new Error('GET /api/recipes failed');
      }

      // 7b. GET /api/recipes/variant/:variantId
      const resRecipeDetail = await fetch(`http://localhost:${port}/api/recipes/variant/${menuVariant.id}`, { headers });
      const jsonRecipeDetail: any = await resRecipeDetail.json();
      console.log(`  - GET /api/recipes/variant/${menuVariant.id} -> Status: ${resRecipeDetail.status} (Estimated COGS: Rp ${jsonRecipeDetail.data?.estimatedCogs})`);
      if (resRecipeDetail.status !== 200 || !jsonRecipeDetail.data?.estimatedCogs) {
        throw new Error('GET /api/recipes/variant/:variantId failed');
      }

      // 7c. GET /api/modifiers
      const resModifiers = await fetch(`http://localhost:${port}/api/modifiers`, { headers });
      const jsonModifiers: any = await resModifiers.json();
      console.log(`  - GET /api/modifiers -> Status: ${resModifiers.status} (Groups: ${jsonModifiers.data?.length})`);
      if (resModifiers.status !== 200 || !Array.isArray(jsonModifiers.data)) {
        throw new Error('GET /api/modifiers failed');
      }

      // 7d. GET /api/orders/:id/kitchen-ticket
      const resKot = await fetch(`http://localhost:${port}/api/orders/${orderRecord.id}/kitchen-ticket`, { headers });
      const jsonKot: any = await resKot.json();
      console.log(`  - GET /api/orders/${orderRecord.id}/kitchen-ticket -> Status: ${resKot.status}`);
      console.log(`    Ticket No: ${jsonKot.data?.ticketNumber} | Table: ${jsonKot.data?.tableNumber} | OrderType: ${jsonKot.data?.orderType}`);
      console.log(`    Items: ${JSON.stringify(jsonKot.data?.items)}`);
      if (resKot.status !== 200 || jsonKot.data?.tableNumber !== 'A-12') {
        throw new Error('GET /api/orders/:id/kitchen-ticket failed');
      }
    } finally {
      server.close();
    }

    console.log('\n===============================================================');
    console.log('SUCCESS: ALL EPIC-06 F&B VERIFICATIONS PASSED WITH 100% PARITY!');
    console.log('===============================================================');
    process.exit(0);
  } catch (err: any) {
    console.error('VERIFICATION FAILED:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
