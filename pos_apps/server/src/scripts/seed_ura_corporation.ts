import { PrismaClient, BusinessVertical, TenantStatus, Role, StorageLocationType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedUraCorporation() {
  console.log('🚀 Menyiapkan Tenant Baru: Ura Corporation (Fase 2 - Multi-Outlet & Warehouse BOM)...');

  try {
    const salt = await bcrypt.genSalt(10);
    const defaultPinHash = await bcrypt.hash('123456', salt);
    const ownerPassHash = await bcrypt.hash('Owner123!', salt);
    const cashierPassHash = await bcrypt.hash('Kasir123!', salt);
    const spvPassHash = await bcrypt.hash('Spv123!', salt);

    // 1. Ambil atau buat Plan PRO
    let proPlan = await prisma.subscriptionPlan.findUnique({ where: { code: 'PRO' } });
    if (!proPlan) {
      proPlan = await prisma.subscriptionPlan.create({
        data: {
          code: 'PRO',
          name: 'Pro Enterprise',
          price: 150000,
          maxOutlets: 10,
          maxCashiers: 20,
          features: ['ALL_FEATURES', 'SPLIT_PAYMENT', 'HOLD_ORDER', 'HPP_REPORT', 'MULTI_OUTLET'],
        },
      });
    }

    // 2. Buat Tenant Ura Corporation (Status: ACTIVE / sudah diapprove)
    const tenantSlug = 'ura-corporation';
    let tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (tenant) {
      console.log('⚠️  Tenant "ura-corporation" sudah ada, membersihkan terlebih dahulu...');
      await prisma.user.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.outletProduct.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.recipeItem.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.recipe.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.inventoryBalance.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.storageLocation.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.outlet.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.tenantSubscription.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.productVariant.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.product.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.inventoryItem.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.category.deleteMany({ where: { tenantId: tenant.id } });
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }

    tenant = await prisma.tenant.create({
      data: {
        name: 'Ura Corporation',
        slug: tenantSlug,
        businessVertical: BusinessVertical.FNB,
        businessType: 'Holding Multi-Concept F&B',
        status: TenantStatus.ACTIVE,
        phone: '081299990001',
        allowNegativeStock: false,
        enableRecipeTracking: true,
        enableBatchTracking: true,
      },
    });
    console.log(`✅ Tenant Berhasil Dibuat: ${tenant.name} (ID Toko: ${tenant.slug})`);

    // 3. Pasang Langganan PRO Aktif
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 tahun
    await prisma.tenantSubscription.create({
      data: {
        tenantId: tenant.id,
        planId: proPlan.id,
        isActive: true,
        startedAt: new Date(),
        expiresAt,
      },
    });
    console.log('✅ Langganan Paket PRO Aktif.');

    // 4. Buat Akun Tenant Owner (Role ADMIN, outletId: null = akses seluruh toko)
    const owner = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        outletId: null,
        userCode: '00001',
        name: 'Baskoro Ura',
        firstName: 'Baskoro',
        lastName: 'Ura',
        email: 'owner@uracorporation.com',
        phone: '081299990001',
        role: Role.ADMIN,
        passwordHash: ownerPassHash,
        pinHash: defaultPinHash,
        isActive: true,
      },
    });
    console.log(`✅ Tenant Owner Dibuat: ${owner.name} (${owner.email})`);

    // 5. Buat Gudang Logistik Pusat Ura (Master Warehouse)
    console.log('\n🏭 Menyiapkan Gudang Logistik Pusat:');
    const warehousePusat = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        code: 'WH-01',
        name: 'Gudang Logistik Pusat Ura',
        merchantName: 'Ura Corporation Logistik',
        address: 'Kawasan Pergudangan Cilandak No. 10, Jakarta Selatan',
        phone: '081299990900',
        industries: ['Logistik & Supply Chain'],
        isWarehouse: true,
        isActive: true,
      },
    });
    const slWarehouse = await prisma.storageLocation.create({
      data: {
        tenantId: tenant.id,
        outletId: warehousePusat.id,
        name: 'Main Storage Rack A-B',
        type: StorageLocationType.WAREHOUSE,
        isDefault: true,
        isActive: true,
      },
    });
    console.log(`   • [${warehousePusat.name}] (Kode: ${warehousePusat.code}) -> Storage: ${slWarehouse.name}`);

    // 6. Buat 3 Outlet Toko dengan Pointer warehouseId ke Gudang Pusat
    console.log('\n🏪 Menyiapkan 3 Outlet Toko (Disuplai oleh Gudang Logistik Pusat):');

    // Toko 1: Ura Coffee - Kemang
    const outletCoffee = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        code: 'OUT-01',
        name: 'Ura Coffee - Kemang',
        merchantName: 'Ura Corporation',
        address: 'Jl. Kemang Raya No. 12, Bangka, Mampang Prapatan, Jakarta Selatan',
        phone: '081299990101',
        industries: ['Coffee Shop', 'Cafe & Eatery'],
        warehouseId: warehousePusat.id,
        isActive: true,
      },
    });
    const slCoffee = await prisma.storageLocation.create({
      data: {
        tenantId: tenant.id,
        outletId: outletCoffee.id,
        name: 'Bar & Storage Kemang',
        type: StorageLocationType.STOREFRONT,
        isDefault: true,
        isActive: true,
      },
    });
    console.log(`   1. Outlet Toko: ${outletCoffee.name} (Kode: ${outletCoffee.code}) -> Suplai: ${warehousePusat.name}`);

    // Toko 2: Ura Bakery - Tebet
    const outletBakery = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        code: 'OUT-02',
        name: 'Ura Bakery - Tebet',
        merchantName: 'Ura Corporation',
        address: 'Jl. Tebet Barat Dalam Raya No. 45, Tebet, Jakarta Selatan',
        phone: '081299990102',
        industries: ['Bakery & Pastry', 'Cake Shop'],
        warehouseId: warehousePusat.id,
        isActive: true,
      },
    });
    const slBakery = await prisma.storageLocation.create({
      data: {
        tenantId: tenant.id,
        outletId: outletBakery.id,
        name: 'Display & Kitchen Tebet',
        type: StorageLocationType.STOREFRONT,
        isDefault: true,
        isActive: true,
      },
    });
    console.log(`   2. Outlet Toko: ${outletBakery.name} (Kode: ${outletBakery.code}) -> Suplai: ${warehousePusat.name}`);

    // Toko 3: Ura Fried Chicken - Pancoran
    const outletChicken = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        code: 'OUT-03',
        name: 'Ura Fried Chicken - Pancoran',
        merchantName: 'Ura Corporation',
        address: 'Jl. Raya Pasar Minggu No. 88, Pancoran, Jakarta Selatan',
        phone: '081299990103',
        industries: ['Fast Food & Fried Chicken', 'Resto & Kuliner'],
        warehouseId: warehousePusat.id,
        isActive: true,
      },
    });
    const slChicken = await prisma.storageLocation.create({
      data: {
        tenantId: tenant.id,
        outletId: outletChicken.id,
        name: 'Kitchen & Counter Pancoran',
        type: StorageLocationType.STOREFRONT,
        isDefault: true,
        isActive: true,
      },
    });
    console.log(`   3. Outlet Toko: ${outletChicken.name} (Kode: ${outletChicken.code}) -> Suplai: ${warehousePusat.name}`);

    // 7. Buat Kasir & Supervisor untuk Masing-Masing Outlet Toko
    console.log('\n👥 Menyiapkan Staf Kasir & Supervisor per Outlet Toko:');

    // Toko 1: Kemang
    const cashierKemang = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        outletId: outletCoffee.id,
        userCode: '10001',
        name: 'Rian Kasir Kemang',
        firstName: 'Rian',
        lastName: 'Kemang',
        email: 'kasir.kemang@uracorporation.com',
        phone: '081299991001',
        role: Role.CASHIER,
        passwordHash: cashierPassHash,
        pinHash: defaultPinHash,
        isActive: true,
      },
    });
    const spvKemang = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        outletId: outletCoffee.id,
        userCode: '20001',
        name: 'Budi SPV Kemang',
        firstName: 'Budi',
        lastName: 'Kemang',
        email: 'spv.kemang@uracorporation.com',
        phone: '081299992001',
        role: Role.SUPERVISOR,
        passwordHash: spvPassHash,
        pinHash: defaultPinHash,
        isActive: true,
      },
    });

    // Toko 2: Tebet
    const cashierTebet = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        outletId: outletBakery.id,
        userCode: '10002',
        name: 'Siti Kasir Tebet',
        firstName: 'Siti',
        lastName: 'Tebet',
        email: 'kasir.tebet@uracorporation.com',
        phone: '081299991002',
        role: Role.CASHIER,
        passwordHash: cashierPassHash,
        pinHash: defaultPinHash,
        isActive: true,
      },
    });
    const spvTebet = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        outletId: outletBakery.id,
        userCode: '20002',
        name: 'Dedi SPV Tebet',
        firstName: 'Dedi',
        lastName: 'Tebet',
        email: 'spv.tebet@uracorporation.com',
        phone: '081299992002',
        role: Role.SUPERVISOR,
        passwordHash: spvPassHash,
        pinHash: defaultPinHash,
        isActive: true,
      },
    });

    // Toko 3: Pancoran
    const cashierPancoran = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        outletId: outletChicken.id,
        userCode: '10003',
        name: 'Agus Kasir Pancoran',
        firstName: 'Agus',
        lastName: 'Pancoran',
        email: 'kasir.pancoran@uracorporation.com',
        phone: '081299991003',
        role: Role.CASHIER,
        passwordHash: cashierPassHash,
        pinHash: defaultPinHash,
        isActive: true,
      },
    });
    const spvPancoran = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        outletId: outletChicken.id,
        userCode: '20003',
        name: 'Maya SPV Pancoran',
        firstName: 'Maya',
        lastName: 'Pancoran',
        email: 'spv.pancoran@uracorporation.com',
        phone: '081299992003',
        role: Role.SUPERVISOR,
        passwordHash: spvPassHash,
        pinHash: defaultPinHash,
        isActive: true,
      },
    });

    // 8. Siapkan Katalog Produk & Kategori Awal
    console.log('\n📦 Menyiapkan Katalog Produk Demo untuk 3 Toko:');
    const catCoffee = await prisma.category.create({
      data: { tenantId: tenant.id, name: 'Coffee & Beverages', slug: 'coffee-beverages' },
    });
    const catBakery = await prisma.category.create({
      data: { tenantId: tenant.id, name: 'Bakery & Pastry', slug: 'bakery-pastry' },
    });
    const catChicken = await prisma.category.create({
      data: { tenantId: tenant.id, name: 'Fried Chicken & Meals', slug: 'fried-chicken-meals' },
    });

    // Produk 1: Kopi Susu Aren Ura
    const prodKopi = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: catCoffee.id,
        name: 'Kopi Susu Aren Ura',
        sku: 'URA-KPS-01',
        variants: {
          create: {
            tenantId: tenant.id,
            sku: 'URA-KPS-REG',
            name: 'Regular 16oz',
            price: 22000,
          },
        },
      },
      include: { variants: true },
    });

    // Produk 2: Butter Croissant Warm
    const prodCroissant = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: catBakery.id,
        name: 'Butter Croissant Warm',
        sku: 'URA-CRS-01',
        variants: {
          create: {
            tenantId: tenant.id,
            sku: 'URA-CRS-PCS',
            name: 'Pcs',
            price: 25000,
          },
        },
      },
      include: { variants: true },
    });

    // Produk 3: Paket Ayam Fried Chicken
    const prodAyam = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: catChicken.id,
        name: 'Paket Ura Fried Chicken 1 (Nasi + Dada + Es Teh)',
        sku: 'URA-CHX-01',
        variants: {
          create: {
            tenantId: tenant.id,
            sku: 'URA-CHX-PKT1',
            name: 'Paket Lengkap',
            price: 32000,
          },
        },
      },
      include: { variants: true },
    });

    // 9. Alokasikan Menu Master ke Masing-Masing Outlet Toko
    await prisma.outletProduct.createMany({
      data: [
        {
          tenantId: tenant.id,
          outletId: outletCoffee.id,
          productId: prodKopi.id,
          isAvailable: true,
        },
        {
          tenantId: tenant.id,
          outletId: outletBakery.id,
          productId: prodCroissant.id,
          isAvailable: true,
        },
        {
          tenantId: tenant.id,
          outletId: outletChicken.id,
          productId: prodAyam.id,
          isAvailable: true,
        },
      ],
      skipDuplicates: true,
    });

    // 10. Master Bahan Baku Mentah (Inventory Items) & Resep BOM (Fase 2)
    console.log('\n🧪 Menyiapkan Master Bahan Baku Mentah & Resep BOM:');

    // Group 1: Bahan Baku Kopi & Minuman
    const rawCoffee = await prisma.inventoryItem.create({
      data: {
        tenantId: tenant.id,
        itemCode: 'RAW-COFFEE-01',
        name: 'Biji Kopi Espresso Blend (House Blend)',
        canonicalUom: 'GRAM',
        averageCost: 220,
        reorderPoint: 500,
        isActive: true,
      },
    });
    const rawMilk = await prisma.inventoryItem.create({
      data: {
        tenantId: tenant.id,
        itemCode: 'RAW-MILK-01',
        name: 'Susu Sapi Segar Pasteurised (Fresh Milk)',
        canonicalUom: 'ML',
        averageCost: 20,
        reorderPoint: 2000,
        isActive: true,
      },
    });
    const rawAren = await prisma.inventoryItem.create({
      data: {
        tenantId: tenant.id,
        itemCode: 'RAW-SYRUP-01',
        name: 'Sirup Gula Aren Organik',
        canonicalUom: 'ML',
        averageCost: 35,
        reorderPoint: 1000,
        isActive: true,
      },
    });
    const pkgCup = await prisma.inventoryItem.create({
      data: {
        tenantId: tenant.id,
        itemCode: 'PKG-CUP-16',
        name: 'Cup Plastik 16oz + Tutup Lid',
        canonicalUom: 'PCS',
        averageCost: 650,
        reorderPoint: 100,
        isActive: true,
      },
    });
    const pkgStraw = await prisma.inventoryItem.create({
      data: {
        tenantId: tenant.id,
        itemCode: 'PKG-STRAW-01',
        name: 'Sedotan Higienis Ramah Lingkungan',
        canonicalUom: 'PCS',
        averageCost: 150,
        reorderPoint: 100,
        isActive: true,
      },
    });

    // Group 2: Bahan Baku Bakery & Pastry
    const rawFlour = await prisma.inventoryItem.create({
      data: {
        tenantId: tenant.id,
        itemCode: 'RAW-FLOUR-01',
        name: 'Tepung Terigu Protein Tinggi (Japan Grade)',
        canonicalUom: 'GRAM',
        averageCost: 18,
        reorderPoint: 5000,
        isActive: true,
      },
    });
    const rawButter = await prisma.inventoryItem.create({
      data: {
        tenantId: tenant.id,
        itemCode: 'RAW-BUTTER-01',
        name: 'French Unsalted Butter Premium',
        canonicalUom: 'GRAM',
        averageCost: 160,
        reorderPoint: 1000,
        isActive: true,
      },
    });
    const rawYeast = await prisma.inventoryItem.create({
      data: {
        tenantId: tenant.id,
        itemCode: 'RAW-YEAST-01',
        name: 'Ragi Instan & Gula Halus Baker',
        canonicalUom: 'GRAM',
        averageCost: 25,
        reorderPoint: 500,
        isActive: true,
      },
    });
    const pkgBag = await prisma.inventoryItem.create({
      data: {
        tenantId: tenant.id,
        itemCode: 'PKG-BAG-01',
        name: 'Kantong Kertas Pastry Brown Kraft',
        canonicalUom: 'PCS',
        averageCost: 400,
        reorderPoint: 100,
        isActive: true,
      },
    });

    // Group 3: Bahan Baku Fried Chicken & Resto
    const rawChicken = await prisma.inventoryItem.create({
      data: {
        tenantId: tenant.id,
        itemCode: 'RAW-CHICKEN-01',
        name: 'Daging Ayam Potong Marinasi (Dada/Paha)',
        canonicalUom: 'PCS',
        averageCost: 9500,
        reorderPoint: 50,
        isActive: true,
      },
    });
    const rawChxFlour = await prisma.inventoryItem.create({
      data: {
        tenantId: tenant.id,
        itemCode: 'RAW-FLOUR-CHX',
        name: 'Tepung Bumbu Crispy Rahasia Ura',
        canonicalUom: 'GRAM',
        averageCost: 30,
        reorderPoint: 2000,
        isActive: true,
      },
    });
    const rawOil = await prisma.inventoryItem.create({
      data: {
        tenantId: tenant.id,
        itemCode: 'RAW-OIL-01',
        name: 'Minyak Goreng Kelapa Sawit Super',
        canonicalUom: 'ML',
        averageCost: 18,
        reorderPoint: 5000,
        isActive: true,
      },
    });
    const rawRice = await prisma.inventoryItem.create({
      data: {
        tenantId: tenant.id,
        itemCode: 'RAW-RICE-01',
        name: 'Beras Pulen Cianjur (Porsi Nasi)',
        canonicalUom: 'GRAM',
        averageCost: 15,
        reorderPoint: 5000,
        isActive: true,
      },
    });
    const pkgBox = await prisma.inventoryItem.create({
      data: {
        tenantId: tenant.id,
        itemCode: 'PKG-BOX-01',
        name: 'Kotak Box Makanan Fried Chicken Ura',
        canonicalUom: 'PCS',
        averageCost: 800,
        reorderPoint: 100,
        isActive: true,
      },
    });

    // 11. Buat Resep BOM Resmi untuk Masing-Masing Menu
    // Resep Kopi Susu Aren Ura (Kemang)
    const kopiVariant = prodKopi.variants[0];
    await prisma.recipe.create({
      data: {
        tenantId: tenant.id,
        productVariantId: kopiVariant.id,
        instructions: 'Grind 18g espresso blend, extract 36ml espresso. Pour 25ml aren syrup, 150ml fresh milk, add ice in 16oz cup.',
        yieldQuantity: 1.0,
        items: {
          create: [
            { tenantId: tenant.id, inventoryItemId: rawCoffee.id, quantity: 18 },
            { tenantId: tenant.id, inventoryItemId: rawMilk.id, quantity: 150 },
            { tenantId: tenant.id, inventoryItemId: rawAren.id, quantity: 25 },
            { tenantId: tenant.id, inventoryItemId: pkgCup.id, quantity: 1 },
            { tenantId: tenant.id, inventoryItemId: pkgStraw.id, quantity: 1 },
          ],
        },
      },
    });
    console.log(`   ✅ Resep BOM Dibuat: ${prodKopi.name} (5 Komponen Bahan)`);

    // Resep Butter Croissant (Tebet)
    const croissantVariant = prodCroissant.variants[0];
    await prisma.recipe.create({
      data: {
        tenantId: tenant.id,
        productVariantId: croissantVariant.id,
        instructions: 'Laminasi adonan tepung dengan French Butter, fermentasi ragi, panggang suhu 190C selama 18 menit.',
        yieldQuantity: 1.0,
        items: {
          create: [
            { tenantId: tenant.id, inventoryItemId: rawFlour.id, quantity: 80 },
            { tenantId: tenant.id, inventoryItemId: rawButter.id, quantity: 45 },
            { tenantId: tenant.id, inventoryItemId: rawYeast.id, quantity: 10 },
            { tenantId: tenant.id, inventoryItemId: pkgBag.id, quantity: 1 },
          ],
        },
      },
    });
    console.log(`   ✅ Resep BOM Dibuat: ${prodCroissant.name} (4 Komponen Bahan)`);

    // Resep Paket Ayam Fried Chicken (Pancoran)
    const ayamVariant = prodAyam.variants[0];
    await prisma.recipe.create({
      data: {
        tenantId: tenant.id,
        productVariantId: ayamVariant.id,
        instructions: 'Balut ayam marinasi dengan tepung bumbu, deep fry 12 menit suhu 165C, sajikan dengan 150g nasi hangat dalam box.',
        yieldQuantity: 1.0,
        items: {
          create: [
            { tenantId: tenant.id, inventoryItemId: rawChicken.id, quantity: 1 },
            { tenantId: tenant.id, inventoryItemId: rawChxFlour.id, quantity: 50 },
            { tenantId: tenant.id, inventoryItemId: rawOil.id, quantity: 40 },
            { tenantId: tenant.id, inventoryItemId: rawRice.id, quantity: 150 },
            { tenantId: tenant.id, inventoryItemId: pkgBox.id, quantity: 1 },
          ],
        },
      },
    });
    console.log(`   ✅ Resep BOM Dibuat: ${prodAyam.name} (5 Komponen Bahan)`);

    // 12. Isi Saldo Fisik Bahan Baku:
    // A. Di Gudang Logistik Pusat Ura (Stok Besar Master Pasokan)
    const warehouseBalances = [
      { itemId: rawCoffee.id, qty: 50000 }, // 50 kg
      { itemId: rawMilk.id, qty: 100000 },   // 100 liter
      { itemId: rawAren.id, qty: 50000 },    // 50 liter
      { itemId: pkgCup.id, qty: 2500 },      // 2500 pcs
      { itemId: pkgStraw.id, qty: 5000 },    // 5000 pcs
      { itemId: rawFlour.id, qty: 150000 },  // 150 kg
      { itemId: rawButter.id, qty: 40000 },  // 40 kg
      { itemId: rawYeast.id, qty: 10000 },   // 10 kg
      { itemId: pkgBag.id, qty: 3000 },      // 3000 pcs
      { itemId: rawChicken.id, qty: 1000 },  // 1000 pcs
      { itemId: rawChxFlour.id, qty: 80000 },// 80 kg
      { itemId: rawOil.id, qty: 100000 },    // 100 liter
      { itemId: rawRice.id, qty: 120000 },   // 120 kg
      { itemId: pkgBox.id, qty: 2000 },      // 2000 pcs
    ];

    for (const b of warehouseBalances) {
      await prisma.inventoryBalance.create({
        data: {
          tenantId: tenant.id,
          storageLocationId: slWarehouse.id,
          inventoryItemId: b.itemId,
          quantityOnHand: b.qty,
        },
      });
    }
    console.log(`   📦 Saldo Gudang Logistik Pusat: 14 Item Bahan Baku terisi stok melimpah.`);

    // B. Di Masing-Masing Outlet Toko (Stok Operasional Lokal)
    // Toko Kemang (Hanya bahan kopi)
    const kemangBalances = [
      { itemId: rawCoffee.id, qty: 2500 },
      { itemId: rawMilk.id, qty: 8000 },
      { itemId: rawAren.id, qty: 3000 },
      { itemId: pkgCup.id, qty: 250 },
      { itemId: pkgStraw.id, qty: 500 },
    ];
    for (const b of kemangBalances) {
      await prisma.inventoryBalance.create({
        data: {
          tenantId: tenant.id,
          storageLocationId: slCoffee.id,
          inventoryItemId: b.itemId,
          quantityOnHand: b.qty,
        },
      });
    }

    // Toko Tebet (Hanya bahan bakery)
    const tebetBalances = [
      { itemId: rawFlour.id, qty: 15000 },
      { itemId: rawButter.id, qty: 4000 },
      { itemId: rawYeast.id, qty: 1000 },
      { itemId: pkgBag.id, qty: 200 },
    ];
    for (const b of tebetBalances) {
      await prisma.inventoryBalance.create({
        data: {
          tenantId: tenant.id,
          storageLocationId: slBakery.id,
          inventoryItemId: b.itemId,
          quantityOnHand: b.qty,
        },
      });
    }

    // Toko Pancoran (Hanya bahan fried chicken)
    const pancoranBalances = [
      { itemId: rawChicken.id, qty: 120 },
      { itemId: rawChxFlour.id, qty: 8000 },
      { itemId: rawOil.id, qty: 10000 },
      { itemId: rawRice.id, qty: 15000 },
      { itemId: pkgBox.id, qty: 150 },
    ];
    for (const b of pancoranBalances) {
      await prisma.inventoryBalance.create({
        data: {
          tenantId: tenant.id,
          storageLocationId: slChicken.id,
          inventoryItemId: b.itemId,
          quantityOnHand: b.qty,
        },
      });
    }

    console.log(`   🏪 Saldo Operasional Toko: Terisi presisi per spesialisasi gerai masing-masing.`);
    console.log('\n🎉 PENYIAPAN TENANT URA CORPORATION (FASE 2) SELESAI DENGAN SUKSES!\n');
  } catch (err) {
    console.error('❌ Gagal menyiapkan Ura Corporation:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedUraCorporation();
