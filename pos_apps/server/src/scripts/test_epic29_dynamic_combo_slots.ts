import prisma from '../config/prisma';
import { catalogReadAdapter } from '../services/read_adapters/catalog.read_adapter';
import { salesDualWriteService } from '../services/dual_write';
import crypto from 'crypto';

async function runTest() {
  console.log('\n======================================================');
  console.log('🧪 TEST SUITE: EPIC-29 OPTION 2 (SLOT-BASED DYNAMIC COMBO)');
  console.log('======================================================\n');

  // 1. Ambil tenant dan outlet aktif
  const tenantId = 'da6b3c5e-44c5-4d54-a5df-f678ceb99299'; // Ura Coffee
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
  });

  const outlet = await prisma.outlet.findFirst({
    where: { tenantId },
    include: { storageLocations: true },
  });

  if (!tenant || !outlet || outlet.storageLocations.length === 0) {
    throw new Error('Tenant atau outlet tidak ditemukan di database!');
  }

  const storageLoc = outlet.storageLocations[0];
  const outletId = outlet.id;
  const storageLocId = storageLoc.id;

  const category = await prisma.category.findFirst({ where: { tenantId } });
  if (!category) throw new Error('Kategori tidak ditemukan!');

  const cashier = await prisma.user.findFirst({ where: { tenantId } });
  if (!cashier) throw new Error('Kasir tidak ditemukan!');

  console.log(`📍 Tenant: ${tenant.businessName || tenant.id} | Outlet: ${outlet.name} (${outletId})`);

  // Helper untuk membuat produk ritel berstok
  const createPhysicalProduct = async (name: string, stockQty: number, cost: number, price: number) => {
    const sku = `SKU-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const invItem = await prisma.inventoryItem.create({
      data: {
        tenantId,
        itemCode: sku,
        name,
        canonicalUom: 'Pcs',
        averageCost: cost,
      },
    });

    await prisma.inventoryBalance.create({
      data: {
        tenantId,
        inventoryItemId: invItem.id,
        storageLocationId: storageLocId,
        quantityOnHand: stockQty,
        quantityReserved: 0,
      },
    });

    const prod = await prisma.product.create({
      data: {
        tenantId,
        categoryId: category.id,
        name,
        sku,
        unit: 'Pcs',
        type: 'STANDARD',
        isActive: true,
        variants: {
          create: {
            tenantId,
            name: 'Standar',
            sku: `${sku}-VAR`,
            price,
            isActive: true,
            inventoryItemId: invItem.id,
          },
        },
      },
      include: {
        variants: true,
      },
    });

    return { product: prod, variant: prod.variants[0], invItem };
  };

  try {
    console.log('\n📦 1. Menyiapkan Produk Komponen untuk Uji Coba Kombo...');
    const fixedComp = await createPhysicalProduct('Komponen Nasi Pulen (Tetap)', 50, 2000, 4000);
    const mainOptA = await createPhysicalProduct('Ayam Teriyaki (Slot 1 Default)', 30, 8000, 15000);
    const mainOptB = await createPhysicalProduct('Beef Yakiniku (Slot 1 Premium +Rp 5rb)', 20, 14000, 22000);
    const drinkOptA = await createPhysicalProduct('Ocha Dingin (Slot 2 Default)', 40, 2500, 6000);
    const drinkOptB = await createPhysicalProduct('Lemon Tea Segar (Slot 2 +Rp 3rb)', 25, 4000, 9000);

    console.log(`   ✓ Nasi Pulen: Stok 50`);
    console.log(`   ✓ Ayam Teriyaki: Stok 30`);
    console.log(`   ✓ Beef Yakiniku: Stok 20`);
    console.log(`   ✓ Ocha Dingin: Stok 40`);
    console.log(`   ✓ Lemon Tea Segar: Stok 25`);

    console.log('\n🎁 2. Membuat Produk Induk Komposit: "Paket Bento Kombo Uji Coba"...');
    const baseBundlePrice = 25000;
    const bundleProduct = await prisma.product.create({
      data: {
        tenantId,
        categoryId: category.id,
        name: 'Paket Bento Kombo Uji Coba',
        sku: `BUNDLE-COMBO-${Date.now()}`,
        unit: 'Porsi',
        type: 'COMPOSITE',
        isActive: true,
        variants: {
          create: {
            tenantId,
            name: 'Standar',
            sku: `BUNDLE-COMBO-VAR-${Date.now()}`,
            price: baseBundlePrice,
            isActive: true,
          },
        },
      },
      include: { variants: true },
    });

    // Pasang 5 bundle items (1 fixed, 2 di Slot Lauk, 2 di Slot Minuman)
    const bundleItemsData = [
      // Fixed mandatory item
      {
        tenantId,
        bundleProductId: bundleProduct.id,
        childProductId: fixedComp.product.id,
        childVariantId: fixedComp.variant.id,
        quantity: 1,
        slotName: null,
        priceAdjustment: 0,
        isDefault: false,
      },
      // Slot 1: Lauk Utama
      {
        tenantId,
        bundleProductId: bundleProduct.id,
        childProductId: mainOptA.product.id,
        childVariantId: mainOptA.variant.id,
        quantity: 1,
        slotName: 'Pilih Lauk Utama',
        priceAdjustment: 0,
        isDefault: true,
      },
      {
        tenantId,
        bundleProductId: bundleProduct.id,
        childProductId: mainOptB.product.id,
        childVariantId: mainOptB.variant.id,
        quantity: 1,
        slotName: 'Pilih Lauk Utama',
        priceAdjustment: 5000,
        isDefault: false,
      },
      // Slot 2: Minuman
      {
        tenantId,
        bundleProductId: bundleProduct.id,
        childProductId: drinkOptA.product.id,
        childVariantId: drinkOptA.variant.id,
        quantity: 1,
        slotName: 'Pilih Minuman',
        priceAdjustment: 0,
        isDefault: true,
      },
      {
        tenantId,
        bundleProductId: bundleProduct.id,
        childProductId: drinkOptB.product.id,
        childVariantId: drinkOptB.variant.id,
        quantity: 1,
        slotName: 'Pilih Minuman',
        priceAdjustment: 3000,
        isDefault: false,
      },
    ];

    const createdBundleItems = await prisma.productBundleItem.createManyAndReturn({
      data: bundleItemsData,
    });
    console.log(`   ✓ 5 Komponen terpasang (1 Tetap + 2 Slot Lauk + 2 Slot Minuman)`);

    const slot1Chosen = createdBundleItems.find((b) => b.childProductId === mainOptB.product.id)!;
    const slot2Chosen = createdBundleItems.find((b) => b.childProductId === drinkOptB.product.id)!;

    console.log('\n🔍 3. Menguji Catalog Read Adapter getProductById...');
    const catalogDetail = await catalogReadAdapter.getProductById(tenantId, bundleProduct.id, outletId);
    if (!catalogDetail) throw new Error('Catalog read adapter gagal membaca produk detail!');

    console.log(`   ✓ isBundle: ${catalogDetail.isBundle}`);
    console.log(`   ✓ bundleSlotsCount: ${catalogDetail.bundleSlotsCount}`);
    console.log(`   ✓ bundleSlots: ${catalogDetail.bundleSlots?.map((s) => `"${s.slotName}" (${s.items.length} opsi)`).join(', ')}`);

    if (catalogDetail.bundleSlotsCount !== 2) {
      throw new Error(`Ekspektasi 2 slots pilihan, didapat: ${catalogDetail.bundleSlotsCount}`);
    }

    console.log('\n💳 4. Menguji Checkout POS dengan Pilihan Premium (Beef Yakiniku + Lemon Tea)...');
    console.log(`   • Slot 1 Dipilih: Beef Yakiniku (+Rp 5.000)`);
    console.log(`   • Slot 2 Dipilih: Lemon Tea (+Rp 3.000)`);
    const expectedFinalPrice = baseBundlePrice + 5000 + 3000; // 25.000 + 8.000 = 33.000
    console.log(`   • Ekspektasi Total Bayar: Rp ${expectedFinalPrice.toLocaleString('id-ID')}`);

    const invoiceNum = `INV-TEST-COMBO-${Date.now()}`;
    const checkoutResult = await prisma.$transaction(async (tx) => {
      return await salesDualWriteService.processCheckout(
        {
          targetOutletId: outletId,
          cashierId: cashier.id,
          invoiceNumber: invoiceNum,
          channel: 'DINE_IN',
          orderType: 'DINE_IN',
          items: [
            {
              productId: bundleProduct.id,
              variantId: bundleProduct.variants[0].id,
              quantity: 2, // Beli 2 paket kombo!
              costPrice: 15000,
              unitPrice: expectedFinalPrice,
              discountAmount: 0,
              subtotal: expectedFinalPrice * 2,
              selectedBundleItemIds: [slot1Chosen.id, slot2Chosen.id],
            },
          ],
          payments: [
            {
              method: 'CASH' as any,
              amountPaid: expectedFinalPrice * 2,
              changeGiven: 0,
              status: 'CAPTURED' as any,
            },
          ],
          subtotal: expectedFinalPrice * 2,
          grandTotal: expectedFinalPrice * 2,
          totalCost: 30000,
        },
        { tx, tenantId }
      );
    });

    const createdOrderId = checkoutResult.targetDetails?.orderId || (checkoutResult as any).legacyData?.id;
    console.log(`   ✓ Checkout Sukses! Order ID: ${createdOrderId}`);

    console.log('\n🧾 5. Verifikasi modifiers_snapshot di tabel order_items...');
    const orderItemsInDb = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, product_name, unit_price, quantity, subtotal, modifiers_snapshot 
       FROM "order_items" 
       WHERE order_id = $1;`,
      createdOrderId
    );

    const savedOrderItem = orderItemsInDb[0];
    console.log(`   ✓ Unit Price: Rp ${Number(savedOrderItem.unit_price).toLocaleString('id-ID')}`);
    console.log(`   ✓ Quantity: ${savedOrderItem.quantity}x`);
    console.log(`   ✓ Subtotal: Rp ${Number(savedOrderItem.subtotal).toLocaleString('id-ID')}`);
    console.log(`   ✓ modifiers_snapshot: ${JSON.stringify(savedOrderItem.modifiers_snapshot, null, 2)}`);

    const snapshot = savedOrderItem.modifiers_snapshot;
    if (!Array.isArray(snapshot) || snapshot.length !== 2) {
      throw new Error(`Ekspektasi 2 entri snapshot pilihan di struk, ditemukan: ${snapshot?.length}`);
    }

    const hasSlot1Name = snapshot.some((s: any) => s.group_name === 'Pilih Lauk Utama' && s.name.includes('Beef Yakiniku'));
    const hasSlot2Name = snapshot.some((s: any) => s.group_name === 'Pilih Minuman' && s.name.includes('Lemon Tea'));
    if (!hasSlot1Name || !hasSlot2Name) {
      throw new Error('Opsi pilihan kombo tidak terekam secara tepat di modifiers_snapshot!');
    }
    console.log(`   ✅ modifiers_snapshot tervalidasi 100% cocok untuk struk kasir & KDS!`);

    console.log('\n📊 6. Verifikasi Pemotongan Stok Atomik (Selective Stock Deduction)...');
    const getStock = async (invItemId: string) => {
      const b = await prisma.inventoryBalance.findFirst({
        where: { tenantId, inventoryItemId: invItemId, storageLocationId: storageLocId },
      });
      return Number(b?.quantityOnHand || 0);
    };

    const stockFixed = await getStock(fixedComp.invItem.id);
    const stockMainA = await getStock(mainOptA.invItem.id);
    const stockMainB = await getStock(mainOptB.invItem.id);
    const stockDrinkA = await getStock(drinkOptA.invItem.id);
    const stockDrinkB = await getStock(drinkOptB.invItem.id);

    console.log(`   • Nasi Pulen (Tetap): 50 -> ${stockFixed} (Ekspektasi: 48, berkurang 2x)`);
    console.log(`   • Ayam Teriyaki (TIDAK DIPILIH): 30 -> ${stockMainA} (Ekspektasi: 30, TIDAK BOLEH BERKURANG)`);
    console.log(`   • Beef Yakiniku (DIPILIH): 20 -> ${stockMainB} (Ekspektasi: 18, berkurang 2x)`);
    console.log(`   • Ocha Dingin (TIDAK DIPILIH): 40 -> ${stockDrinkA} (Ekspektasi: 40, TIDAK BOLEH BERKURANG)`);
    console.log(`   • Lemon Tea (DIPILIH): 25 -> ${stockDrinkB} (Ekspektasi: 23, berkurang 2x)`);

    if (stockFixed !== 48) throw new Error(`Stok komponen tetap salah! Diharapkan 48, didapat ${stockFixed}`);
    if (stockMainA !== 30) throw new Error(`Opsi tidak dipilih terpotong! Diharapkan 30, didapat ${stockMainA}`);
    if (stockMainB !== 18) throw new Error(`Opsi terpilih tidak terpotong! Diharapkan 18, didapat ${stockMainB}`);
    if (stockDrinkA !== 40) throw new Error(`Opsi tidak dipilih terpotong! Diharapkan 40, didapat ${stockDrinkA}`);
    if (stockDrinkB !== 23) throw new Error(`Opsi terpilih tidak terpotong! Diharapkan 23, didapat ${stockDrinkB}`);

    console.log('\n   🎉 SEMUA ASERSI STOK DEDUKSI 100% LULUS!');

    // Cleanup data pengujian
    console.log('\n🧹 7. Membersihkan data pengujian...');
    await prisma.paymentTransaction.deleteMany({ where: { orderId: createdOrderId } });
    await prisma.inventoryLedger.deleteMany({ where: { referenceId: createdOrderId } });
    await prisma.orderItem.deleteMany({ where: { orderId: createdOrderId } });
    await prisma.order.deleteMany({ where: { id: createdOrderId } });
    await prisma.productBundleItem.deleteMany({ where: { bundleProductId: bundleProduct.id } });
    await prisma.productVariant.deleteMany({ where: { productId: bundleProduct.id } });
    await prisma.product.deleteMany({ where: { id: bundleProduct.id } });

    for (const item of [fixedComp, mainOptA, mainOptB, drinkOptA, drinkOptB]) {
      await prisma.productVariant.deleteMany({ where: { productId: item.product.id } });
      await prisma.product.deleteMany({ where: { id: item.product.id } });
      await prisma.inventoryBalance.deleteMany({ where: { inventoryItemId: item.invItem.id } });
      await prisma.inventoryItem.deleteMany({ where: { id: item.invItem.id } });
    }
    console.log('   ✓ Pembersihan tuntas.');

    console.log('\n======================================================');
    console.log('🌟 HASIL: OPTION 2 DYNAMIC COMBO SLOTS 100% SUKSES!');
    console.log('======================================================\n');
  } catch (err: any) {
    console.error('\n❌ ERROR DALAM TEST RUNNER:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
