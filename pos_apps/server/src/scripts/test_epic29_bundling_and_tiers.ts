import { PrismaClient, ProductType, Role } from '@prisma/client';
import { SalesDualWriteService } from '../services/dual_write/sales.dual_write.service';

const prisma = new PrismaClient();

async function runEpic29IntegrationTest() {
  console.log('===============================================================');
  console.log('🧪 PENGUJIAN INTEGRASI EPIC-29: MULTI-PRODUCT BUNDLING & TIERS');
  console.log('===============================================================');

  // 1. Ambil tenant aktif
  const tenant = await prisma.tenant.findFirst({
    where: { status: 'ACTIVE' },
    include: { outlets: true },
  });

  if (!tenant || tenant.outlets.length === 0) {
    throw new Error('Tenant aktif tidak ditemukan untuk pengujian!');
  }

  const outlet = tenant.outlets[0];
  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id },
  });

  if (!user) {
    throw new Error('Pengguna tidak ditemukan untuk pengujian!');
  }

  console.log(`[1/5] Menggunakan Tenant: "${tenant.name}" (${tenant.id}) | Outlet: "${outlet.name}"`);

  // Pastikan category ada
  let category = await prisma.category.findFirst({
    where: { tenantId: tenant.id },
  });
  if (!category) {
    category = await prisma.category.create({
      data: {
        tenantId: tenant.id,
        name: 'Umum',
        slug: `umum-${Date.now()}`,
      },
    });
  }

  // 2. Siapkan 2 Produk Anak (Retail Standard)
  const child1Name = `Item Anak A (${Date.now().toString().slice(-4)})`;
  const child2Name = `Item Anak B (${Date.now().toString().slice(-4)})`;

  const childProduct1 = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: category.id,
      name: child1Name,
      sku: `SKU-C1-${Date.now().toString().slice(-4)}`,
      unit: 'Btl',
      type: ProductType.STANDARD,
      variants: {
        create: {
          tenantId: tenant.id,
          name: 'Default',
          sku: `SKU-C1-V-${Date.now().toString().slice(-4)}`,
          barcode: `BC-C1-${Date.now().toString().slice(-4)}`,
          price: 15000,
        },
      },
    },
    include: { variants: true },
  });

  const childProduct2 = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: category.id,
      name: child2Name,
      sku: `SKU-C2-${Date.now().toString().slice(-4)}`,
      unit: 'Pcs',
      type: ProductType.STANDARD,
      variants: {
        create: {
          tenantId: tenant.id,
          name: 'Default',
          sku: `SKU-C2-V-${Date.now().toString().slice(-4)}`,
          barcode: `BC-C2-${Date.now().toString().slice(-4)}`,
          price: 10000,
        },
      },
    },
    include: { variants: true },
  });

  console.log(`[2/5] Produk Anak berhasil dibuat:`);
  console.log(`      • ${child1Name} (ID: ${childProduct1.id})`);
  console.log(`      • ${child2Name} (ID: ${childProduct2.id})`);

  // Pastikan storage location ada
  let storageLocation = await prisma.storageLocation.findFirst({
    where: { tenantId: tenant.id, outletId: outlet.id },
  });

  if (!storageLocation) {
    storageLocation = await prisma.storageLocation.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        name: 'Toko Utama',
        type: 'STORE',
      },
    });
  }

  // Isi stok awal produk anak: Child 1 = 50 Btl, Child 2 = 50 Pcs
  const invItem1 = await prisma.inventoryItem.create({
    data: {
      tenantId: tenant.id,
      itemCode: `INV-${childProduct1.sku}`,
      name: child1Name,
      canonicalUom: 'Btl',
      averageCost: 10000,
    },
  });
  await prisma.productVariant.update({
    where: { id: childProduct1.variants[0].id },
    data: { inventoryItemId: invItem1.id },
  });
  await prisma.inventoryBalance.create({
    data: {
      tenantId: tenant.id,
      inventoryItemId: invItem1.id,
      storageLocationId: storageLocation.id,
      quantityOnHand: 50,
    },
  });

  const invItem2 = await prisma.inventoryItem.create({
    data: {
      tenantId: tenant.id,
      itemCode: `INV-${childProduct2.sku}`,
      name: child2Name,
      canonicalUom: 'Pcs',
      averageCost: 6000,
    },
  });
  await prisma.productVariant.update({
    where: { id: childProduct2.variants[0].id },
    data: { inventoryItemId: invItem2.id },
  });
  await prisma.inventoryBalance.create({
    data: {
      tenantId: tenant.id,
      inventoryItemId: invItem2.id,
      storageLocationId: storageLocation.id,
      quantityOnHand: 50,
    },
  });

  console.log(`      ✅ Stok Awal Anak di ${storageLocation.name}: ${child1Name} = 50, ${child2Name} = 50`);

  // 3. Buat Produk Paket Komposit (Bundling)
  const bundleName = `Paket Hemat Duo (${Date.now().toString().slice(-4)})`;
  const bundleProduct = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: category.id,
      name: bundleName,
      sku: `SKU-BNDL-${Date.now().toString().slice(-4)}`,
      unit: 'Paket',
      type: ProductType.COMPOSITE,
      variants: {
        create: {
          tenantId: tenant.id,
          name: 'Default',
          sku: `SKU-BNDL-V-${Date.now().toString().slice(-4)}`,
          barcode: `BC-BNDL-${Date.now().toString().slice(-4)}`,
          price: 22000, // Harga hemat (normal: 15k + 10k = 25k)
        },
      },
    },
    include: { variants: true },
  });

  // Pasang relasi bundle: 1 Paket = 1x Child 1 + 2x Child 2
  await prisma.productBundleItem.createMany({
    data: [
      {
        tenantId: tenant.id,
        bundleProductId: bundleProduct.id,
        childProductId: childProduct1.id,
        childVariantId: childProduct1.variants[0].id,
        quantity: 1.0,
      },
      {
        tenantId: tenant.id,
        bundleProductId: bundleProduct.id,
        childProductId: childProduct2.id,
        childVariantId: childProduct2.variants[0].id,
        quantity: 2.0,
      },
    ],
  });

  // Pasang harga grosir: Beli >= 5 paket harga jadi Rp 20.000
  await prisma.productPriceTier.create({
    data: {
      tenantId: tenant.id,
      productId: bundleProduct.id,
      minQuantity: 5,
      tierPrice: 20000,
    },
  });

  console.log(`[3/5] Produk Komposit siap: "${bundleName}" (Rp 22.000)`);
  console.log(`      • Isi: 1x "${child1Name}" & 2x "${child2Name}"`);
  console.log(`      • Tier Grosir: Beli >= 5 pcs seharga Rp 20.000/paket`);

  // 4. Eksekusi Penjualan Kasir (Checkout 3 unit Paket Hemat Duo)
  console.log(`[4/5] Menjalankan Transaksi Kasir: Beli 3x "${bundleName}"...`);
  const salesService = new SalesDualWriteService(prisma);
  const invoiceNumber = `INV-BNDL-${Date.now().toString().slice(-6)}`;

  const checkoutResult = await prisma.$transaction(async (tx) => {
    return await salesService.processCheckout(
      {
        targetOutletId: outlet.id,
        cashierId: user.id,
        invoiceNumber,
        channel: 'DINE_IN',
        orderType: 'DINE_IN',
        items: [
          {
            productId: bundleProduct.id,
            quantity: 3,
            unitPrice: 22000,
            costPrice: 0,
            subtotal: 66000,
          },
        ],
        payments: [
          {
            method: 'CASH',
            amountPaid: 70000,
            changeGiven: 4000,
          },
        ],
        subtotal: 66000,
        grandTotal: 66000,
        totalCost: 0,
        notes: 'Testing Checkout Bundle Komposit',
      },
      { tx, tenantId: tenant.id }
    );
  });

  const createdOrderId = checkoutResult.targetDetails?.orderId || checkoutResult.data?.order?.id;
  console.log(`      ✅ Order Sukses: Invoice ${invoiceNumber} (ID: ${createdOrderId})`);

  // Verifikasi Pemotongan Stok Item Anak
  // Paket dibeli 3 unit:
  // Child 1 (rasio 1): 50 - (3 * 1) = 47
  // Child 2 (rasio 2): 50 - (3 * 2) = 44
  const balChild1After = await prisma.inventoryBalance.findFirst({
    where: { tenantId: tenant.id, inventoryItemId: invItem1.id, storageLocationId: storageLocation.id },
  });
  const balChild2After = await prisma.inventoryBalance.findFirst({
    where: { tenantId: tenant.id, inventoryItemId: invItem2.id, storageLocationId: storageLocation.id },
  });

  const qty1 = Number(balChild1After?.quantityOnHand || 0);
  const qty2 = Number(balChild2After?.quantityOnHand || 0);

  console.log(`      📊 Verifikasi Saldo Stok:`);
  console.log(`         • ${child1Name}: Sisa ${qty1} (Target: 47)`);
  console.log(`         • ${child2Name}: Sisa ${qty2} (Target: 44)`);

  if (qty1 !== 47 || qty2 !== 44) {
    throw new Error(`Kalkulasi pengurangan stok paket tidak cocok! Diharapkan (47, 44), didapatkan (${qty1}, ${qty2})`);
  }
  console.log(`      ✅ 100% Cocok: Pemotongan stok komposit bekerja akurat!`);

  // 5. Verifikasi Inventory Ledger
  const ledgers = await prisma.inventoryLedger.findMany({
    where: { referenceId: createdOrderId },
  });
  console.log(`[5/5] Memeriksa Jejak Kartu Stok (InventoryLedger):`);
  for (const l of ledgers) {
    console.log(`      • [${l.movementType}] Delta: ${l.quantityDelta} | Saldo: ${l.balanceAfter} | Catatan: "${l.notes}"`);
  }

  if (ledgers.length < 2) {
    throw new Error(`Diharapkan minimal 2 ledger mutasi paket, didapatkan ${ledgers.length}`);
  }

  console.log('\n===============================================================');
  console.log('🎉 SELURUH PENGUJIAN INTEGRASI FASE 1 EPIC-29 BERHASIL 100%!');
  console.log('===============================================================\n');

  // Bersihkan data dummy pengujian
  await prisma.orderItem.deleteMany({ where: { orderId: createdOrderId } });
  await prisma.paymentTransaction.deleteMany({ where: { orderId: createdOrderId } });
  await prisma.inventoryLedger.deleteMany({ where: { referenceId: createdOrderId } });
  await prisma.order.delete({ where: { id: createdOrderId } });
  await prisma.productBundleItem.deleteMany({ where: { bundleProductId: bundleProduct.id } });
  await prisma.productPriceTier.deleteMany({ where: { productId: bundleProduct.id } });
  await prisma.productVariant.deleteMany({ where: { productId: bundleProduct.id } });
  await prisma.product.delete({ where: { id: bundleProduct.id } });
  await prisma.inventoryBalance.deleteMany({ where: { inventoryItemId: { in: [invItem1.id, invItem2.id] } } });
  await prisma.productVariant.deleteMany({ where: { productId: { in: [childProduct1.id, childProduct2.id] } } });
  await prisma.product.deleteMany({ where: { id: { in: [childProduct1.id, childProduct2.id] } } });
  await prisma.inventoryItem.deleteMany({ where: { id: { in: [invItem1.id, invItem2.id] } } });

  console.log('🧹 Data dummy pengujian dibersihkan.');
}

runEpic29IntegrationTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ GAGAL:', err);
    process.exit(1);
  });
