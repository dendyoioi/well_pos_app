import {
  PrismaClient,
  Role,
  PlatformRole,
  TenantStatus,
  BusinessVertical,
  BillingCycle,
  ProductType,
  StorageLocationType,
  StockMovementType,
  InventoryRefType,
  ActorType,
  SelectionType,
  CustomerTier,
  PointTxType,
  DiscountType,
  ShiftStatus,
  PaymentStatus,
  OrderStatus,
  Prisma,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function runSandboxSeed() {
  console.log('===================================================================');
  console.log('🌱 MEMULAI SEEDER MASTER SANDBOX WELL POS (PRE-RELEASE ENVIRONMENT)');
  console.log('===================================================================\n');

  // Hash password & PIN standar
  const salt = await bcrypt.genSalt(10);
  const superAdminPassHash = await bcrypt.hash('SuperAdmin123!', salt);
  const ownerPassHash = await bcrypt.hash('Owner123!', salt);
  const cashierPinHash = await bcrypt.hash('123456', salt);
  const cashierPassHash = await bcrypt.hash('Kasir123!', salt);
  const gudangPassHash = await bcrypt.hash('Gudang123!', salt);
  const spvPassHash = await bcrypt.hash('Spv123!', salt);

  // ----------------------------------------------------
  // 1. Subscription Plans (FREE & PRO)
  // ----------------------------------------------------
  console.log('📦 1. Memastikan Master Paket Langganan SaaS...');
  const planFree = await prisma.subscriptionPlan.upsert({
    where: { code: 'FREE' },
    update: {},
    create: {
      code: 'FREE',
      name: 'Well POS Free (Selamanya)',
      price: new Prisma.Decimal(0),
      billingCycle: BillingCycle.MONTHLY,
      maxOutlets: 1,
      maxCashiers: 2,
      features: ['BASIC_POS', 'RECEIPT_WATERMARK'],
    },
  });

  const planPro = await prisma.subscriptionPlan.upsert({
    where: { code: 'PRO' },
    update: {},
    create: {
      code: 'PRO',
      name: 'Well POS Pro Bisnis',
      price: new Prisma.Decimal(129000),
      billingCycle: BillingCycle.MONTHLY,
      maxOutlets: 5,
      maxCashiers: 99,
      features: ['ALL_FEATURES', 'SPLIT_PAYMENT', 'HOLD_ORDER', 'HPP_REPORT', 'CLEAN_RECEIPT', 'RECIPES_BOM', 'MULTI_OUTLET'],
    },
  });
  console.log('   ✅ Paket SaaS siap (FREE & PRO).');

  // ----------------------------------------------------
  // 2. Platform SuperAdmin User
  // ----------------------------------------------------
  console.log('👑 2. Menyiapkan Akun Platform SuperAdmin...');
  const superAdmin = await prisma.platformUser.upsert({
    where: { email: 'superadmin@wellpos.id' },
    update: {
      name: 'SuperAdmin Well POS',
      role: PlatformRole.SUPER_ADMIN,
      passwordHash: superAdminPassHash,
    },
    create: {
      email: 'superadmin@wellpos.id',
      name: 'SuperAdmin Well POS',
      role: PlatformRole.SUPER_ADMIN,
      passwordHash: superAdminPassHash,
    },
  });
  console.log(`   ✅ SuperAdmin: ${superAdmin.email} [Password: SuperAdmin123!]`);

  // ----------------------------------------------------
  // 3. Bersihkan Data Sandbox Ura Coffee Lama jika ada
  // ----------------------------------------------------
  console.log('🧹 3. Mengatur ulang tenant sandbox "ura-coffee"...');
  const existingTenant = await prisma.tenant.findUnique({
    where: { slug: 'ura-coffee' },
    include: { outlets: true },
  });

  if (existingTenant) {
    console.log('   Menghapus data transaksi dan relasi sandbox sebelumnya...');
    const tId = existingTenant.id;
    await prisma.promotionUsage.deleteMany({ where: { tenantId: tId } });
    await prisma.customerPointLedger.deleteMany({ where: { tenantId: tId } });
    await prisma.promotion.deleteMany({ where: { tenantId: tId } });
    await prisma.customer.deleteMany({ where: { tenantId: tId } });
    await prisma.modifierRecipeEffect.deleteMany({ where: { tenantId: tId } });
    await prisma.productModifierGroup.deleteMany({ where: { tenantId: tId } });
    await prisma.modifierItem.deleteMany({ where: { tenantId: tId } });
    await prisma.modifierGroup.deleteMany({ where: { tenantId: tId } });
    await prisma.recipeItem.deleteMany({ where: { tenantId: tId } });
    await prisma.recipe.deleteMany({ where: { tenantId: tId } });
    await prisma.paymentTransaction.deleteMany({ where: { tenantId: tId } });
    await prisma.orderItem.deleteMany({ where: { tenantId: tId } });
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM "hold_orders" WHERE tenant_id = $1;`, tId);
    } catch {
      // Abaikan jika tabel belum dibuat
    }
    await prisma.cashMovement.deleteMany({ where: { tenantId: tId } });
    await prisma.order.deleteMany({ where: { tenantId: tId } });
    await prisma.shift.deleteMany({ where: { tenantId: tId } });
    await prisma.inventoryLedger.deleteMany({ where: { tenantId: tId } });
    await prisma.inventoryBalance.deleteMany({ where: { tenantId: tId } });
    await prisma.productVariant.deleteMany({ where: { tenantId: tId } });
    await prisma.product.deleteMany({ where: { tenantId: tId } });
    await prisma.stockTransferItem.deleteMany({ where: { tenantId: tId } });
    await prisma.stockTransfer.deleteMany({ where: { tenantId: tId } });
    await prisma.purchaseOrderItem.deleteMany({ where: { tenantId: tId } });
    await prisma.purchaseOrder.deleteMany({ where: { tenantId: tId } });
    await prisma.supplier.deleteMany({ where: { tenantId: tId } });
    await prisma.inventoryBatch.deleteMany({ where: { tenantId: tId } });
    await prisma.inventoryItem.deleteMany({ where: { tenantId: tId } });
    await prisma.category.deleteMany({ where: { tenantId: tId } });
    await prisma.storageLocation.deleteMany({ where: { tenantId: tId } });
    await prisma.user.deleteMany({ where: { tenantId: tId } });
    await prisma.tenantSubscription.deleteMany({ where: { tenantId: tId } });
    await prisma.outlet.deleteMany({ where: { tenantId: tId } });
    await prisma.tenant.delete({ where: { id: tId } });
    console.log('   ✅ Data sandbox lama berhasil dibersihkan.');
  }

  // ----------------------------------------------------
  // 4. Buat Tenant Demo: Ura Coffee & Roastery
  // ----------------------------------------------------
  console.log('☕ 4. Membuat Tenant Sandbox: Ura Coffee & Roastery...');
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Ura Coffee & Roastery',
      slug: 'ura-coffee',
      businessVertical: BusinessVertical.FNB,
      businessType: 'Coffee Shop & Eatery',
      status: TenantStatus.ACTIVE,
      phone: '081288889999',
      allowNegativeStock: false,
      enableRecipeTracking: true,
      enableBatchTracking: true,
    },
  });

  // Langganan PRO
  await prisma.tenantSubscription.create({
    data: {
      tenantId: tenant.id,
      planId: planPro.id,
      isActive: true,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 tahun
    },
  });
  console.log(`   ✅ Tenant "${tenant.name}" aktif dengan paket PRO.`);

  // ----------------------------------------------------
  // 5. Multi-Outlet: 2 Cabang Toko + 1 Gudang Pusat
  // ----------------------------------------------------
  console.log('🏪 5. Membuat Topologi 2 Cabang Toko + 1 Central Warehouse...');
  const kemangFeesConfig = [
    {
      id: 'fee_tax',
      name: 'PPN / PB1 Pajak Restoran',
      type: 'PERCENTAGE',
      rate: 10,
      channelScope: 'ALL',
      isActive: true,
      category: 'DEFAULT_TAX_SERVICE',
    },
    {
      id: 'fee_service',
      name: 'Biaya Layanan Meja',
      type: 'PERCENTAGE',
      rate: 5,
      channelScope: 'DINE_IN',
      isActive: true,
      category: 'DEFAULT_TAX_SERVICE',
    },
    {
      id: 'fee_delivery',
      name: 'Ongkir Kurir Toko',
      type: 'FIXED',
      rate: 10000,
      channelScope: 'DELIVERY',
      isActive: true,
      category: 'DEFAULT_TAX_SERVICE',
    },
    {
      id: 'fee_online',
      name: 'Biaya Platform Online',
      type: 'FIXED',
      rate: 3000,
      channelScope: 'ONLINE_DELIVERY',
      isActive: true,
      category: 'DEFAULT_TAX_SERVICE',
    },
    {
      id: 'fee_plastic_s',
      name: 'Plastik / Kresek Sedang',
      type: 'FIXED',
      rate: 500,
      channelScope: 'ALL',
      isActive: true,
      category: 'ON_DEMAND_PACKAGING',
      isQuickAccess: true,
    },
    {
      id: 'fee_box',
      name: 'Box Kemasan / Mika',
      type: 'FIXED',
      rate: 2000,
      channelScope: 'ALL',
      isActive: true,
      category: 'ON_DEMAND_PACKAGING',
      isQuickAccess: true,
    },
    {
      id: 'fee_paperbag',
      name: 'Paper Bag Kraft',
      type: 'FIXED',
      rate: 3000,
      channelScope: 'ALL',
      isActive: true,
      category: 'ON_DEMAND_PACKAGING',
      isQuickAccess: true,
    },
    {
      id: 'fee_cutlery',
      name: 'Set Sendok & Garpu Higienis',
      type: 'FIXED',
      rate: 1000,
      channelScope: 'ALL',
      isActive: true,
      category: 'ON_DEMAND_PACKAGING',
      isQuickAccess: true,
    },
  ];

  const outletKemang = await prisma.outlet.create({
    data: {
      tenantId: tenant.id,
      code: 'OUT-01',
      name: 'Ura Coffee - Flagship Kemang',
      address: 'Jl. Kemang Raya No. 45, Jakarta Selatan',
      phone: '021-7198888',
      isActive: true,
      feesConfig: kemangFeesConfig,
    },
  });

  const outletSudirman = await prisma.outlet.create({
    data: {
      tenantId: tenant.id,
      code: 'OUT-02',
      name: 'Ura Coffee - Express Sudirman',
      address: 'Gedung Bursa Efek Indonesia Tower 2, Jakarta Pusat',
      phone: '021-5159999',
      isActive: true,
    },
  });

  const outletWarehouse = await prisma.outlet.create({
    data: {
      tenantId: tenant.id,
      code: 'WH-01',
      name: 'Ura Coffee - Central Warehouse',
      address: 'Kawasan Pergudangan Pluit Blok C3, Jakarta Utara',
      phone: '021-6691111',
      isActive: true,
    },
  });

  // Storage Location Default untuk tiap outlet
  const locKemang = await prisma.storageLocation.create({
    data: {
      tenantId: tenant.id,
      outletId: outletKemang.id,
      name: 'Bar & Kitchen Kemang',
      type: StorageLocationType.STOREFRONT,
      isDefault: true,
      allowNegativeStock: false,
      isActive: true,
    },
  });

  const locSudirman = await prisma.storageLocation.create({
    data: {
      tenantId: tenant.id,
      outletId: outletSudirman.id,
      name: 'Express Bar Sudirman',
      type: StorageLocationType.STOREFRONT,
      isDefault: true,
      allowNegativeStock: false,
      isActive: true,
    },
  });

  const locWarehouse = await prisma.storageLocation.create({
    data: {
      tenantId: tenant.id,
      outletId: outletWarehouse.id,
      name: 'Gudang Utama Distribusi',
      type: StorageLocationType.WAREHOUSE,
      isDefault: true,
      allowNegativeStock: false,
      isActive: true,
    },
  });
  console.log('   ✅ 3 Outlet & Storage Location default berhasil dibuat.');

  // ----------------------------------------------------
  // 6. Akun Multi-Role Siap Pakai
  // ----------------------------------------------------
  console.log('👥 6. Menyiapkan Akun Multi-Role Siap Pakai...');

  // Owner Merchant
  const ownerUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      userCode: '00001',
      name: 'Dimas Prabowo (Owner)',
      email: 'owner@uracoffee.id',
      passwordHash: ownerPassHash,
      pinHash: cashierPinHash, // PIN 123456 untuk Otorisasi Pairing Kasir & Bypass
      role: Role.OWNER,
      isActive: true,
    },
  });

  // Kasir Toko Kemang (PIN 123456)
  const cashierUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      outletId: outletKemang.id,
      userCode: '10001',
      name: 'Rian Kasir Kemang',
      email: 'kasir@uracoffee.id',
      passwordHash: cashierPassHash,
      pinHash: cashierPinHash,
      role: Role.CASHIER,
      isActive: true,
    },
  });

  // Barista & Kasir 2 Kemang (PIN 123456)
  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      outletId: outletKemang.id,
      userCode: '10002',
      name: 'Siti Barista Kemang',
      email: 'siti.barista@uracoffee.id',
      passwordHash: cashierPassHash,
      pinHash: cashierPinHash,
      role: Role.CASHIER,
      isActive: true,
    },
  });

  // Kasir Cabang Express Sudirman (PIN 123456)
  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      outletId: outletSudirman.id,
      userCode: '10003',
      name: 'Deni Kasir Sudirman',
      email: 'kasir.sudirman@uracoffee.id',
      passwordHash: cashierPassHash,
      pinHash: cashierPinHash,
      role: Role.CASHIER,
      isActive: true,
    },
  });

  // Kepala Gudang Central Warehouse
  const warehouseUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      outletId: outletWarehouse.id,
      userCode: '20001',
      name: 'Bambang Kepala Gudang',
      email: 'gudang@uracoffee.id',
      passwordHash: gudangPassHash,
      role: Role.WAREHOUSE,
      isActive: true,
    },
  });

  // Supervisor Toko Kemang
  const spvUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      outletId: outletKemang.id,
      userCode: '30001',
      name: 'Sarah Supervisor Toko',
      email: 'supervisor@uracoffee.id',
      passwordHash: spvPassHash,
      pinHash: spvPassHash ? cashierPinHash : null,
      role: Role.SUPERVISOR,
      isActive: true,
    },
  });
  console.log('   ✅ User Roles Terdaftar:');
  console.log('      • Merchant Owner    : owner@uracoffee.id (Owner123! / PIN: 123456) [ID: 00001]');
  console.log('      • Kasir Kemang      : kasir@uracoffee.id (Kasir123! / PIN: 123456) [ID: 10001]');
  console.log('      • Barista Kemang    : siti.barista@uracoffee.id (Kasir123! / PIN: 123456) [ID: 10002]');
  console.log('      • Kasir Sudirman    : kasir.sudirman@uracoffee.id (Kasir123! / PIN: 123456) [ID: 10003]');
  console.log('      • Kepala Gudang     : gudang@uracoffee.id (Gudang123!) [ID: 20001]');
  console.log('      • Supervisor Toko   : supervisor@uracoffee.id (Spv123! / PIN: 123456) [ID: 30001]');

  // ----------------------------------------------------
  // 7. Master Bahan Baku (Inventory Items)
  // ----------------------------------------------------
  console.log('🌾 7. Menyiapkan Master Bahan Baku & Resep (BOM)...');

  // Bahan Baku
  const rawBeans = await prisma.inventoryItem.create({
    data: {
      tenantId: tenant.id,
      itemCode: 'RAW-BEANS',
      name: 'Biji Kopi Arabika House Blend',
      canonicalUom: 'GRAM',
      averageCost: new Prisma.Decimal(250), // Rp 250 / gram = Rp 250.000 / kg
      reorderPoint: new Prisma.Decimal(1000),
      targetLevel: new Prisma.Decimal(10000),
      isActive: true,
    },
  });

  const rawMilk = await prisma.inventoryItem.create({
    data: {
      tenantId: tenant.id,
      itemCode: 'RAW-MILK',
      name: 'Susu Fresh Milk Pasteurisasi',
      canonicalUom: 'ML',
      averageCost: new Prisma.Decimal(20), // Rp 20 / ml = Rp 20.000 / liter
      reorderPoint: new Prisma.Decimal(2000),
      targetLevel: new Prisma.Decimal(20000),
      isActive: true,
    },
  });

  const rawAren = await prisma.inventoryItem.create({
    data: {
      tenantId: tenant.id,
      itemCode: 'RAW-AREN',
      name: 'Sirup Gula Aren Organik',
      canonicalUom: 'ML',
      averageCost: new Prisma.Decimal(35), // Rp 35 / ml
      reorderPoint: new Prisma.Decimal(500),
      targetLevel: new Prisma.Decimal(5000),
      isActive: true,
    },
  });

  const rawCaramel = await prisma.inventoryItem.create({
    data: {
      tenantId: tenant.id,
      itemCode: 'RAW-CARAMEL',
      name: 'Sirup Karamel Artisan',
      canonicalUom: 'ML',
      averageCost: new Prisma.Decimal(45), // Rp 45 / ml
      reorderPoint: new Prisma.Decimal(500),
      targetLevel: new Prisma.Decimal(4000),
      isActive: true,
    },
  });

  const rawTea = await prisma.inventoryItem.create({
    data: {
      tenantId: tenant.id,
      itemCode: 'RAW-TEA',
      name: 'Daun Teh Earl Grey Premium',
      canonicalUom: 'GRAM',
      averageCost: new Prisma.Decimal(300), // Rp 300 / gr = Rp 300.000 / kg
      reorderPoint: new Prisma.Decimal(300),
      targetLevel: new Prisma.Decimal(3000),
      isActive: true,
    },
  });

  const rawCroissant = await prisma.inventoryItem.create({
    data: {
      tenantId: tenant.id,
      itemCode: 'RAW-CROISSANT',
      name: 'Dough Butter Croissant Ready-to-Bake',
      canonicalUom: 'PCS',
      averageCost: new Prisma.Decimal(12000), // Rp 12.000 / pcs
      reorderPoint: new Prisma.Decimal(15),
      targetLevel: new Prisma.Decimal(100),
      isActive: true,
    },
  });

  const rawCup = await prisma.inventoryItem.create({
    data: {
      tenantId: tenant.id,
      itemCode: 'RAW-CUP',
      name: 'Paper Cup 12oz Cold/Hot',
      canonicalUom: 'PCS',
      averageCost: new Prisma.Decimal(800), // Rp 800 / cup
      reorderPoint: new Prisma.Decimal(100),
      targetLevel: new Prisma.Decimal(1000),
      isActive: true,
    },
  });

  const rawBag = await prisma.inventoryItem.create({
    data: {
      tenantId: tenant.id,
      itemCode: 'RAW-BAG',
      name: 'Kantong Kertas Pastry Bag',
      canonicalUom: 'PCS',
      averageCost: new Prisma.Decimal(500), // Rp 500 / bag
      reorderPoint: new Prisma.Decimal(50),
      targetLevel: new Prisma.Decimal(500),
      isActive: true,
    },
  });

  const rawOat = await prisma.inventoryItem.create({
    data: {
      tenantId: tenant.id,
      itemCode: 'RAW-OAT',
      name: 'Oat Milk Barista Edition',
      canonicalUom: 'ML',
      averageCost: new Prisma.Decimal(45), // Rp 45 / ml
      reorderPoint: new Prisma.Decimal(1000),
      targetLevel: new Prisma.Decimal(8000),
      isActive: true,
    },
  });

  console.log('   ✅ 9 Master Bahan Baku F&B Terkait terdaftar.');

  // ----------------------------------------------------
  // 8. Saldo Persediaan Awal (Balances & Ledgers)
  // ----------------------------------------------------
  console.log('📊 8. Mengisi Saldo Persediaan Fisik di Gudang & Cabang Toko...');

  const initialStockData = [
    // Central Warehouse (WH-01)
    { loc: locWarehouse, item: rawBeans, qty: 50000 },      // 50 kg
    { loc: locWarehouse, item: rawMilk, qty: 100000 },      // 100 liter
    { loc: locWarehouse, item: rawAren, qty: 30000 },       // 30 liter
    { loc: locWarehouse, item: rawCaramel, qty: 15000 },    // 15 liter
    { loc: locWarehouse, item: rawTea, qty: 10000 },        // 10 kg
    { loc: locWarehouse, item: rawCroissant, qty: 300 },    // 300 pcs
    { loc: locWarehouse, item: rawCup, qty: 5000 },         // 5.000 pcs
    { loc: locWarehouse, item: rawBag, qty: 2000 },         // 2.000 pcs
    { loc: locWarehouse, item: rawOat, qty: 25000 },        // 25 liter

    // Outlet Flagship Kemang (OUT-01)
    { loc: locKemang, item: rawBeans, qty: 8000 },          // 8 kg
    { loc: locKemang, item: rawMilk, qty: 15000 },          // 15 liter
    { loc: locKemang, item: rawAren, qty: 5000 },           // 5 liter
    { loc: locKemang, item: rawCaramel, qty: 3000 },        // 3 liter
    { loc: locKemang, item: rawTea, qty: 3000 },            // 3 kg
    { loc: locKemang, item: rawCroissant, qty: 60 },        // 60 pcs
    { loc: locKemang, item: rawCup, qty: 1000 },            // 1.000 pcs
    { loc: locKemang, item: rawBag, qty: 500 },             // 500 pcs
    { loc: locKemang, item: rawOat, qty: 4000 },            // 4 liter

    // Outlet Express Sudirman (OUT-02)
    { loc: locSudirman, item: rawBeans, qty: 4000 },        // 4 kg
    { loc: locSudirman, item: rawMilk, qty: 8000 },         // 8 liter
    { loc: locSudirman, item: rawAren, qty: 2500 },         // 2.5 liter
    { loc: locSudirman, item: rawCaramel, qty: 1500 },      // 1.5 liter
    { loc: locSudirman, item: rawTea, qty: 1500 },          // 1.5 kg
    { loc: locSudirman, item: rawCroissant, qty: 30 },      // 30 pcs
    { loc: locSudirman, item: rawCup, qty: 500 },           // 500 pcs
    { loc: locSudirman, item: rawBag, qty: 250 },           // 250 pcs
    { loc: locSudirman, item: rawOat, qty: 2000 },          // 2 liter
  ];

  for (const s of initialStockData) {
    const qtyDecimal = new Prisma.Decimal(s.qty);
    await prisma.inventoryBalance.create({
      data: {
        tenantId: tenant.id,
        inventoryItemId: s.item.id,
        storageLocationId: s.loc.id,
        quantityOnHand: qtyDecimal,
        quantityReserved: new Prisma.Decimal(0),
      },
    });

    await prisma.inventoryLedger.create({
      data: {
        tenantId: tenant.id,
        inventoryItemId: s.item.id,
        storageLocationId: s.loc.id,
        quantityDelta: qtyDecimal,
        balanceBefore: new Prisma.Decimal(0),
        balanceAfter: qtyDecimal,
        unitCost: s.item.averageCost,
        movementType: StockMovementType.OPNAME_ADJUSTMENT,
        referenceType: InventoryRefType.MANUAL,
        referenceId: 'SANDBOX-SEED',
        actorType: ActorType.SYSTEM,
        notes: `Saldo awal persediaan bahan baku di ${s.loc.name}`,
      },
    });
  }
  console.log('   ✅ Saldo awal bahan baku tercatat di inventory_balances & inventory_ledgers.');

  // ----------------------------------------------------
  // 9. Master Kategori & Menu Produk (2 Kategori, 5 Menu F&B)
  // ----------------------------------------------------
  console.log('🍔 9. Menyiapkan Menu Komersial (2 Kategori, 5 Produk F&B)...');

  // Kategori 1: Coffee & Espresso
  const catCoffee = await prisma.category.create({
    data: {
      tenantId: tenant.id,
      name: 'Coffee & Espresso',
      slug: 'coffee-espresso',
      isActive: true,
    },
  });

  // Kategori 2: Tea & Bakery
  const catBakery = await prisma.category.create({
    data: {
      tenantId: tenant.id,
      name: 'Tea & Bakery',
      slug: 'tea-bakery',
      isActive: true,
    },
  });

  // ----------------------------------------------------
  // ITEM 1: Kopi Susu Aren Ura (Kategori: Coffee & Espresso)
  // ----------------------------------------------------
  const prodKopiSusu = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: catCoffee.id,
      name: 'Kopi Susu Aren Ura',
      description: 'Espresso blend Arabika dengan fresh milk dan sirup gula aren murni.',
      type: ProductType.COMPOSITE,
      imageUrl: '/images/products/kopi-susu.jpg',
      isActive: true,
    },
  });

  const varKopiSusu = await prisma.productVariant.create({
    data: {
      tenantId: tenant.id,
      productId: prodKopiSusu.id,
      sku: 'FNB-KPS-001',
      name: 'Regular Cup',
      price: new Prisma.Decimal(22000),
      inventoryQuantityMultiplier: new Prisma.Decimal(1),
      isActive: true,
    },
  });

  const recipeKopiSusu = await prisma.recipe.create({
    data: {
      tenantId: tenant.id,
      productVariantId: varKopiSusu.id,
      instructions: '1. Tarik double espresso 18g. 2. Tuang susu 120ml + aren 20ml ke cup. 3. Masukkan es & tuang espresso.',
      yieldQuantity: new Prisma.Decimal(1),
    },
  });

  await prisma.recipeItem.createMany({
    data: [
      { tenantId: tenant.id, recipeId: recipeKopiSusu.id, inventoryItemId: rawBeans.id, quantity: new Prisma.Decimal(18) }, // 18 gr
      { tenantId: tenant.id, recipeId: recipeKopiSusu.id, inventoryItemId: rawMilk.id, quantity: new Prisma.Decimal(120) }, // 120 ml
      { tenantId: tenant.id, recipeId: recipeKopiSusu.id, inventoryItemId: rawAren.id, quantity: new Prisma.Decimal(20) },  // 20 ml
      { tenantId: tenant.id, recipeId: recipeKopiSusu.id, inventoryItemId: rawCup.id, quantity: new Prisma.Decimal(1) },     // 1 pcs
    ],
  });

  // ----------------------------------------------------
  // ITEM 2: Caramel Macchiato (Kategori: Coffee & Espresso)
  // ----------------------------------------------------
  const prodCaramel = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: catCoffee.id,
      name: 'Caramel Macchiato',
      description: 'Espresso lembut dipadu steamed fresh milk dengan sentuhan sirup karamel vanila artisan.',
      type: ProductType.COMPOSITE,
      imageUrl: '/images/products/caramel-macchiato.jpg',
      isActive: true,
    },
  });

  const varCaramel = await prisma.productVariant.create({
    data: {
      tenantId: tenant.id,
      productId: prodCaramel.id,
      sku: 'FNB-CMM-001',
      name: 'Regular Cup',
      price: new Prisma.Decimal(26000),
      inventoryQuantityMultiplier: new Prisma.Decimal(1),
      isActive: true,
    },
  });

  const recipeCaramel = await prisma.recipe.create({
    data: {
      tenantId: tenant.id,
      productVariantId: varCaramel.id,
      instructions: '1. Masukkan sirup karamel 25ml. 2. Tuang steamed fresh milk 140ml. 3. Tuang espresso shot 18g di atasnya.',
      yieldQuantity: new Prisma.Decimal(1),
    },
  });

  await prisma.recipeItem.createMany({
    data: [
      { tenantId: tenant.id, recipeId: recipeCaramel.id, inventoryItemId: rawBeans.id, quantity: new Prisma.Decimal(18) },    // 18 gr
      { tenantId: tenant.id, recipeId: recipeCaramel.id, inventoryItemId: rawMilk.id, quantity: new Prisma.Decimal(140) },    // 140 ml
      { tenantId: tenant.id, recipeId: recipeCaramel.id, inventoryItemId: rawCaramel.id, quantity: new Prisma.Decimal(25) }, // 25 ml
      { tenantId: tenant.id, recipeId: recipeCaramel.id, inventoryItemId: rawCup.id, quantity: new Prisma.Decimal(1) },       // 1 pcs
    ],
  });

  // ----------------------------------------------------
  // ITEM 3: Americano Signature (Kategori: Coffee & Espresso)
  // ----------------------------------------------------
  const prodAmericano = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: catCoffee.id,
      name: 'Americano Signature',
      description: 'Double shot espresso arabika dengan mineral water segar.',
      type: ProductType.COMPOSITE,
      imageUrl: '/images/products/americano.jpg',
      isActive: true,
    },
  });

  const varAmericano = await prisma.productVariant.create({
    data: {
      tenantId: tenant.id,
      productId: prodAmericano.id,
      sku: 'FNB-AMC-001',
      name: 'Regular Cup',
      price: new Prisma.Decimal(18000),
      inventoryQuantityMultiplier: new Prisma.Decimal(1),
      isActive: true,
    },
  });

  const recipeAmericano = await prisma.recipe.create({
    data: {
      tenantId: tenant.id,
      productVariantId: varAmericano.id,
      instructions: '1. Tarik double espresso 18g. 2. Tuang air dingin/panas 180ml ke cup.',
      yieldQuantity: new Prisma.Decimal(1),
    },
  });

  await prisma.recipeItem.createMany({
    data: [
      { tenantId: tenant.id, recipeId: recipeAmericano.id, inventoryItemId: rawBeans.id, quantity: new Prisma.Decimal(18) },
      { tenantId: tenant.id, recipeId: recipeAmericano.id, inventoryItemId: rawCup.id, quantity: new Prisma.Decimal(1) },
    ],
  });

  // ----------------------------------------------------
  // ITEM 4: Earl Grey Milk Tea (Kategori: Tea & Bakery)
  // ----------------------------------------------------
  const prodMilkTea = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: catBakery.id,
      name: 'Earl Grey Milk Tea',
      description: 'Seduhan daun teh hitam Earl Grey wangi bergamot dipadu fresh milk gurih & aren organik.',
      type: ProductType.COMPOSITE,
      imageUrl: '/images/products/earl-grey.jpg',
      isActive: true,
    },
  });

  const varMilkTea = await prisma.productVariant.create({
    data: {
      tenantId: tenant.id,
      productId: prodMilkTea.id,
      sku: 'FNB-EGT-001',
      name: 'Regular Cup',
      price: new Prisma.Decimal(20000),
      inventoryQuantityMultiplier: new Prisma.Decimal(1),
      isActive: true,
    },
  });

  const recipeMilkTea = await prisma.recipe.create({
    data: {
      tenantId: tenant.id,
      productVariantId: varMilkTea.id,
      instructions: '1. Seduh 10g daun teh Earl Grey. 2. Larutkan sirup aren 15ml. 3. Tuang susu fresh milk 100ml & es.',
      yieldQuantity: new Prisma.Decimal(1),
    },
  });

  await prisma.recipeItem.createMany({
    data: [
      { tenantId: tenant.id, recipeId: recipeMilkTea.id, inventoryItemId: rawTea.id, quantity: new Prisma.Decimal(10) },     // 10 gr
      { tenantId: tenant.id, recipeId: recipeMilkTea.id, inventoryItemId: rawMilk.id, quantity: new Prisma.Decimal(100) },    // 100 ml
      { tenantId: tenant.id, recipeId: recipeMilkTea.id, inventoryItemId: rawAren.id, quantity: new Prisma.Decimal(15) },    // 15 ml
      { tenantId: tenant.id, recipeId: recipeMilkTea.id, inventoryItemId: rawCup.id, quantity: new Prisma.Decimal(1) },       // 1 pcs
    ],
  });

  // ----------------------------------------------------
  // ITEM 5: Butter Croissant Warm (Kategori: Tea & Bakery)
  // ----------------------------------------------------
  const prodCroissant = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: catBakery.id,
      name: 'Butter Croissant Warm',
      description: 'Pastry klasik Prancis berlapis renyah dengan aroma butter murni dipanggang hangat.',
      type: ProductType.COMPOSITE,
      imageUrl: '/images/products/croissant.jpg',
      isActive: true,
    },
  });

  const varCroissant = await prisma.productVariant.create({
    data: {
      tenantId: tenant.id,
      productId: prodCroissant.id,
      sku: 'FNB-CRS-001',
      name: 'Standard Piece',
      price: new Prisma.Decimal(25000),
      inventoryQuantityMultiplier: new Prisma.Decimal(1),
      isActive: true,
    },
  });

  const recipeCroissant = await prisma.recipe.create({
    data: {
      tenantId: tenant.id,
      productVariantId: varCroissant.id,
      instructions: '1. Panggang dough croissant pada suhu 180°C selama 12 menit hingga keemasan. 2. Masukkan ke kantong kertas pastry bag.',
      yieldQuantity: new Prisma.Decimal(1),
    },
  });

  await prisma.recipeItem.createMany({
    data: [
      { tenantId: tenant.id, recipeId: recipeCroissant.id, inventoryItemId: rawCroissant.id, quantity: new Prisma.Decimal(1) }, // 1 pcs
      { tenantId: tenant.id, recipeId: recipeCroissant.id, inventoryItemId: rawBag.id, quantity: new Prisma.Decimal(1) },       // 1 pcs
    ],
  });

  console.log('   ✅ 5 Menu Produk F&B dalam 2 Kategori siap operasional.');

  // Alokasi Katalog Produk ke Outlet Toko (EPIC-19 Multi-Outlet Catalog)
  const commercialProducts = [prodKopiSusu, prodCaramel, prodAmericano, prodMilkTea, prodCroissant];
  for (const prod of commercialProducts) {
    await prisma.outletProduct.createMany({
      data: [
        {
          tenantId: tenant.id,
          outletId: outletKemang.id,
          productId: prod.id,
          isAvailable: true,
        },
        {
          tenantId: tenant.id,
          outletId: outletSudirman.id,
          productId: prod.id,
          isAvailable: true,
        },
      ],
      skipDuplicates: true,
    });
  }
  console.log('   ✅ Alokasi katalog multi-outlet (Kemang & Sudirman) terpasang.');

  // ----------------------------------------------------
  // 10. Modifiers / Topping
  // ----------------------------------------------------
  console.log('✨ 10. Menyiapkan Pilihan Modifiers & Topping...');

  const modGroup = await prisma.modifierGroup.create({
    data: {
      tenantId: tenant.id,
      name: 'Pilihan Ekstra & Susu',
      selectionType: SelectionType.MULTIPLE,
      minSelection: 0,
      maxSelection: 3,
      isRequired: false,
    },
  });

  // Modifier Items
  const modExtraShot = await prisma.modifierItem.create({
    data: {
      tenantId: tenant.id,
      modifierGroupId: modGroup.id,
      name: 'Extra Espresso Shot',
      priceAdjustment: new Prisma.Decimal(5000),
      isDefault: false,
    },
  });

  const modOatmilk = await prisma.modifierItem.create({
    data: {
      tenantId: tenant.id,
      modifierGroupId: modGroup.id,
      name: 'Ganti Oat Milk',
      priceAdjustment: new Prisma.Decimal(7000),
      isDefault: false,
    },
  });

  const modExtraAren = await prisma.modifierItem.create({
    data: {
      tenantId: tenant.id,
      modifierGroupId: modGroup.id,
      name: 'Extra Sirup Aren',
      priceAdjustment: new Prisma.Decimal(3000),
      isDefault: false,
    },
  });

  // Tautkan Modifier Group ke Kopi Susu, Caramel Macchiato & Americano
  await prisma.productModifierGroup.createMany({
    data: [
      { tenantId: tenant.id, productId: prodKopiSusu.id, modifierGroupId: modGroup.id, sortOrder: 1 },
      { tenantId: tenant.id, productId: prodCaramel.id, modifierGroupId: modGroup.id, sortOrder: 1 },
      { tenantId: tenant.id, productId: prodAmericano.id, modifierGroupId: modGroup.id, sortOrder: 1 },
    ],
  });

  // Efek Bahan Baku dari Modifier
  await prisma.modifierRecipeEffect.createMany({
    data: [
      {
        tenantId: tenant.id,
        modifierItemId: modExtraShot.id,
        inventoryItemId: rawBeans.id,
        quantityDelta: new Prisma.Decimal(9), // Tambah 9 gram kopi
      },
      {
        tenantId: tenant.id,
        modifierItemId: modOatmilk.id,
        inventoryItemId: rawMilk.id,
        quantityDelta: new Prisma.Decimal(-120), // Kurangi fresh milk 120ml
      },
      {
        tenantId: tenant.id,
        modifierItemId: modOatmilk.id,
        inventoryItemId: rawOat.id,
        quantityDelta: new Prisma.Decimal(120), // Pakai oat milk 120ml
      },
      {
        tenantId: tenant.id,
        modifierItemId: modExtraAren.id,
        inventoryItemId: rawAren.id,
        quantityDelta: new Prisma.Decimal(15), // Tambah 15ml aren
      },
    ],
  });
  console.log('   ✅ Modifiers & efek resep bahan baku terpasang.');

  // ----------------------------------------------------
  // 11. Pelanggan Member Loyalty & Voucher Promo
  // ----------------------------------------------------
  console.log('💳 11. Menyiapkan Member Loyalty & Voucher Promo...');

  const custBudi = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      code: 'CUST-001',
      name: 'Budi Santoso',
      phone: '081234567890',
      email: 'budi.santoso@gmail.com',
      tier: CustomerTier.GOLD,
      loyaltyPoints: 250,
      totalSpent: new Prisma.Decimal(1250000),
      visitCount: 18,
    },
  });

  await prisma.customerPointLedger.create({
    data: {
      tenantId: tenant.id,
      customerId: custBudi.id,
      deltaPoints: 250,
      balanceBefore: 0,
      balanceAfter: 250,
      type: PointTxType.EARNED_PURCHASE,
      notes: 'Saldo reward poin member loyalitas sandbox',
    },
  });

  const custSiti = await prisma.customer.create({
    data: {
      tenantId: tenant.id,
      code: 'CUST-002',
      name: 'Siti Rahma',
      phone: '081987654321',
      email: 'siti.rahma@yahoo.com',
      tier: CustomerTier.SILVER,
      loyaltyPoints: 100,
      totalSpent: new Prisma.Decimal(450000),
      visitCount: 6,
    },
  });

  await prisma.customerPointLedger.create({
    data: {
      tenantId: tenant.id,
      customerId: custSiti.id,
      deltaPoints: 100,
      balanceBefore: 0,
      balanceAfter: 100,
      type: PointTxType.EARNED_PURCHASE,
      notes: 'Saldo reward poin member sandbox',
    },
  });

  // Voucher Promo Aktif
  const now = new Date();
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.promotion.create({
    data: {
      tenantId: tenant.id,
      code: 'KOPIASIK10',
      name: 'Promo Kopi Asik Diskon 10%',
      description: 'Potongan 10% untuk pesanan minimal Rp 30.000',
      discountType: DiscountType.PERCENTAGE,
      discountValue: new Prisma.Decimal(10),
      minOrderAmount: new Prisma.Decimal(30000),
      maxDiscountAmount: new Prisma.Decimal(20000),
      usageLimit: 500,
      startDate: now,
      endDate: nextMonth,
      isActive: true,
    },
  });

  await prisma.promotion.create({
    data: {
      tenantId: tenant.id,
      code: 'HEMAT5RB',
      name: 'Hemat Langsung Rp 5.000',
      description: 'Potongan tunai langsung Rp 5.000 untuk minimal belanja Rp 20.000',
      discountType: DiscountType.FIXED_AMOUNT,
      discountValue: new Prisma.Decimal(5000),
      minOrderAmount: new Prisma.Decimal(20000),
      usageLimit: 200,
      startDate: now,
      endDate: nextMonth,
      isActive: true,
    },
  });
  console.log('   ✅ 2 Member Pelanggan (Gold/Silver) & 2 Voucher Promo siap digunakan.');

  // ----------------------------------------------------
  // 12. Sesi Shift Kasir Aktif
  // ----------------------------------------------------
  console.log('⏰ 12. Membuka Sesi Shift Kasir Aktif Siap Transaksi...');

  const activeShift = await prisma.shift.create({
    data: {
      tenantId: tenant.id,
      outletId: outletKemang.id,
      userId: cashierUser.id,
      startTime: new Date(),
      startingCash: new Prisma.Decimal(200000), // Modal awal Rp 200.000
      expectedEnding: new Prisma.Decimal(200000),
      status: ShiftStatus.OPEN,
      notes: 'Shift Pagi Sandbox Kasir Kemang - Siap Checkout Langsung',
    },
  });
  console.log(`   ✅ Shift ID: ${activeShift.id} [Status: OPEN, Kasir: ${cashierUser.name}, Modal: Rp 200.000]`);

  // ----------------------------------------------------
  // 13. Data Simulasi Tagihan Meja (Open Tab) & Pesanan Masuk QR Meja
  // ----------------------------------------------------
  console.log('🍽️ 13. Menyiapkan Simulasi Tagihan Meja (Open Tab) & Pesanan QR Meja...');

  // 13.1 Tagihan Meja Terbuka: Meja 02 (Indoor) - Dimas & Sarah
  const tabMeja02Id = 'tab_meja02_' + Date.now();
  await prisma.order.create({
    data: {
      id: tabMeja02Id,
      tenantId: tenant.id,
      outletId: outletKemang.id,
      userId: cashierUser.id,
      shiftId: activeShift.id,
      invoiceNumber: 'INV/20260924/KMG/0088',
      tableNumber: '02',
      channel: 'DINE_IN',
      orderType: 'DINE_IN',
      paymentStatus: PaymentStatus.UNPAID,
      orderStatus: OrderStatus.IN_PROGRESS,
      subtotal: new Prisma.Decimal(69000),
      discountTotal: new Prisma.Decimal(0),
      taxTotal: new Prisma.Decimal(6900),
      totalAmount: new Prisma.Decimal(75900),
      notes: 'Meja 02 [Dine In] - Tamu: Dimas & Sarah',
    },
  });

  await prisma.orderItem.createMany({
    data: [
      {
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        orderId: tabMeja02Id,
        productVariantId: varKopiSusu.id,
        productName: 'Kopi Susu Aren Ura',
        variantName: 'Regular Cup',
        sku: 'FNB-KPS-001',
        quantity: 2,
        unitPrice: new Prisma.Decimal(22000),
        subtotal: new Prisma.Decimal(44000),
        notes: 'Less sugar, es sedikit',
      },
      {
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        orderId: tabMeja02Id,
        productVariantId: varCroissant.id,
        productName: 'Butter Croissant Warm',
        variantName: 'Standard Piece',
        sku: 'FNB-CRS-001',
        quantity: 1,
        unitPrice: new Prisma.Decimal(25000),
        subtotal: new Prisma.Decimal(25000),
        notes: 'Hangatkan 30 detik',
      },
    ],
  });

  // 13.2 Tagihan Meja Terbuka: Meja 05 (Outdoor) - Komunitas Sepeda
  const tabMeja05Id = 'tab_meja05_' + (Date.now() + 1);
  await prisma.order.create({
    data: {
      id: tabMeja05Id,
      tenantId: tenant.id,
      outletId: outletKemang.id,
      userId: cashierUser.id,
      shiftId: activeShift.id,
      invoiceNumber: 'INV/20260924/KMG/0089',
      tableNumber: '05',
      channel: 'DINE_IN',
      orderType: 'DINE_IN',
      paymentStatus: PaymentStatus.UNPAID,
      orderStatus: OrderStatus.IN_PROGRESS,
      subtotal: new Prisma.Decimal(72000),
      discountTotal: new Prisma.Decimal(0),
      taxTotal: new Prisma.Decimal(7200),
      totalAmount: new Prisma.Decimal(79200),
      notes: 'Meja 05 [Outdoor] - Komunitas Sepeda',
    },
  });

  await prisma.orderItem.createMany({
    data: [
      {
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        orderId: tabMeja05Id,
        productVariantId: varCaramel.id,
        productName: 'Caramel Macchiato',
        variantName: 'Hot Cup',
        sku: 'FNB-CMM-001',
        quantity: 2,
        unitPrice: new Prisma.Decimal(26000),
        subtotal: new Prisma.Decimal(52000),
      },
      {
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        orderId: tabMeja05Id,
        productVariantId: varMilkTea.id,
        productName: 'Earl Grey Milk Tea',
        variantName: 'Iced Cup',
        sku: 'FNB-EGT-001',
        quantity: 1,
        unitPrice: new Prisma.Decimal(20000),
        subtotal: new Prisma.Decimal(20000),
      },
    ],
  });

  // 13.3 Pesanan Masuk QR Meja (Customer Self-Ordering): Meja 01 (Indoor) - Andi Saputra
  const qrOrderMeja01Id = 'qr_meja01_' + (Date.now() + 2);
  await prisma.order.create({
    data: {
      id: qrOrderMeja01Id,
      tenantId: tenant.id,
      outletId: outletKemang.id,
      userId: cashierUser.id,
      shiftId: activeShift.id,
      invoiceNumber: 'INV/20260924/QR/0012',
      tableNumber: '01',
      channel: 'QR_MENU',
      orderType: 'DINE_IN',
      paymentStatus: PaymentStatus.UNPAID,
      orderStatus: OrderStatus.CONFIRMED,
      subtotal: new Prisma.Decimal(43000),
      discountTotal: new Prisma.Decimal(0),
      taxTotal: new Prisma.Decimal(4300),
      totalAmount: new Prisma.Decimal(47300),
      notes: '[QR Menu Meja 01] Tamu: Andi Saputra (081298765432)',
    },
  });

  await prisma.orderItem.createMany({
    data: [
      {
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        orderId: qrOrderMeja01Id,
        productVariantId: varAmericano.id,
        productName: 'Americano Signature',
        variantName: 'Hot Cup',
        sku: 'FNB-AMC-001',
        quantity: 1,
        unitPrice: new Prisma.Decimal(18000),
        subtotal: new Prisma.Decimal(18000),
        notes: 'Hot, no sugar',
      },
      {
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        orderId: qrOrderMeja01Id,
        productVariantId: varCroissant.id,
        productName: 'Butter Croissant Warm',
        variantName: 'Standard Piece',
        sku: 'FNB-CRS-001',
        quantity: 1,
        unitPrice: new Prisma.Decimal(25000),
        subtotal: new Prisma.Decimal(25000),
        notes: 'Hangatkan',
      },
    ],
  });

  console.log('   ✅ 2 Tagihan Meja Aktif (Meja 02 & Meja 05) dan 1 Pesanan QR Meja (Meja 01) berhasil disiapkan.');

  console.log('\n===================================================================');
  console.log('🎉 MASTER SANDBOX SEEDER BERHASIL DIEKSEKUSI 100%!');
  console.log('===================================================================');
  console.log('Kredensial Login Tersedia:');
  console.log('1. SuperAdmin Platform : superadmin@wellpos.id / SuperAdmin123!');
  console.log('2. Merchant Owner      : owner@uracoffee.id / Owner123!');
  console.log('3. Kasir Toko          : kasir@uracoffee.id / PIN: 123456');
  console.log('4. Kepala Gudang       : gudang@uracoffee.id / Gudang123!');
  console.log('5. Supervisor          : supervisor@uracoffee.id / Spv123!');
  console.log('===================================================================\n');
}

// Jalankan jika dieksekusi langsung
if (require.main === module) {
  runSandboxSeed()
    .catch((err) => {
      console.error('❌ Gagal menjalankan seeder sandbox:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
