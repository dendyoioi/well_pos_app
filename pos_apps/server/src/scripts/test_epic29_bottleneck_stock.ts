import prisma from '../config/prisma';
import { catalogReadAdapter } from '../services/read_adapters/catalog.read_adapter';

async function runBottleneckStockTest() {
  console.log('========================================================================');
  console.log('🧪 PENGUJIAN OTOMATIS: DYNAMIC BOTTLENECK STOCK LIMIT ENGINE (EPIC-29)');
  console.log('========================================================================');

  const tenantId = 'da6b3c5e-44c5-4d54-a5df-f678ceb99299'; // Ura Coffee & Roastery
  const outlet = await prisma.outlet.findFirst({ where: { tenantId } });
  if (!outlet) throw new Error('Outlet tidak ditemukan');

  const storageLoc = await prisma.storageLocation.findFirst({
    where: { tenantId, outletId: outlet.id, isDefault: true },
  });
  if (!storageLoc) throw new Error('Storage location default tidak ditemukan');

  const category = await prisma.category.findFirst({ where: { tenantId } });
  if (!category) throw new Error('Kategori tidak ditemukan');

  console.log(`[TEST 1/4] Outlet Uji: "${outlet.name}" (Lokasi: "${storageLoc.name}")`);

  // Buat Inventory Items Fisik
  const invA = await prisma.inventoryItem.create({
    data: {
      tenantId,
      itemCode: 'INV-TST-A',
      name: 'Barang Ritel A',
      canonicalUom: 'Kotak',
      averageCost: 3000,
      balances: {
        create: {
          tenantId,
          storageLocationId: storageLoc.id,
          quantityOnHand: 20,
        },
      },
    },
  });

  const invB = await prisma.inventoryItem.create({
    data: {
      tenantId,
      itemCode: 'INV-TST-B',
      name: 'Barang Ritel B',
      canonicalUom: 'Bks',
      averageCost: 4000,
      balances: {
        create: {
          tenantId,
          storageLocationId: storageLoc.id,
          quantityOnHand: 6,
        },
      },
    },
  });

  // Siapkan 2 Produk Ritel dan 1 Produk Resep
  // Produk Ritel 1 (Item A): 20 Kotak
  const itemA = await prisma.product.create({
    data: {
      tenantId,
      categoryId: category.id,
      name: 'Uji Bottleneck Ritel A',
      unit: 'Kotak',
      type: 'STANDARD',
      isActive: true,
      variants: {
        create: {
          tenantId,
          sku: 'TST-BTL-A',
          name: 'Standar',
          price: 5000,
          inventoryItemId: invA.id,
        },
      },
      outletProducts: {
        create: {
          tenantId,
          outletId: outlet.id,
          isAvailable: true,
        },
      },
    },
    include: { variants: true },
  });

  // Produk Ritel 2 (Item B - Bottleneck): 6 Bks
  const itemB = await prisma.product.create({
    data: {
      tenantId,
      categoryId: category.id,
      name: 'Uji Bottleneck Ritel B (Bottleneck)',
      unit: 'Bks',
      type: 'STANDARD',
      isActive: true,
      variants: {
        create: {
          tenantId,
          sku: 'TST-BTL-B',
          name: 'Standar',
          price: 7000,
          inventoryItemId: invB.id,
        },
      },
      outletProducts: {
        create: {
          tenantId,
          outletId: outlet.id,
          isAvailable: true,
        },
      },
    },
    include: { variants: true },
  });

  // Ambil produk resep eksisting
  const recipeProd = await prisma.product.findFirst({
    where: { tenantId, name: 'Kopi Susu Aren Ura' },
    include: { variants: true },
  });
  if (!recipeProd) throw new Error('Produk resep Kopi Susu Aren Ura tidak ditemukan');

  console.log('[TEST 2/4] Komponen Uji Berhasil Didaftarkan:');
  console.log(`            • Item A: Stok 20 Kotak, Rasio Paket: 2 Kotak  -> Kapasitas: 20 / 2 = 10 paket`);
  console.log(`            • Item B: Stok 6 Bks, Rasio Paket: 2 Bks      -> Kapasitas: 6 / 2 = 3 paket (BOTTLENECK)`);
  console.log(`            • Resep C: Kopi Susu Aren (Resep Dapur)       -> Kapasitas: ∞ (99999 paket)`);

  // Buat Paket Komposit Uji
  const bundle = await prisma.product.create({
    data: {
      tenantId,
      categoryId: category.id,
      name: 'Paket Uji Bottleneck Tri-Item',
      unit: 'Paket',
      type: 'COMPOSITE',
      isActive: true,
      variants: {
        create: {
          tenantId,
          sku: 'TST-BND-TRI',
          name: 'Standar',
          price: 25000,
        },
      },
      outletProducts: {
        create: {
          tenantId,
          outletId: outlet.id,
          isAvailable: true,
        },
      },
      bundleItemsAsParent: {
        create: [
          {
            tenantId,
            childProductId: itemA.id,
            childVariantId: itemA.variants[0].id,
            quantity: 2,
          },
          {
            tenantId,
            childProductId: itemB.id,
            childVariantId: itemB.variants[0].id,
            quantity: 2,
          },
          {
            tenantId,
            childProductId: recipeProd.id,
            childVariantId: recipeProd.variants[0].id,
            quantity: 1,
          },
        ],
      },
    },
  });

  // Eksekusi Query Catalog Read Adapter
  console.log('[TEST 3/4] Mengevaluasi Pembacaan Katalog Kasir via catalogReadAdapter...');
  const catRes = await catalogReadAdapter.getProducts({ tenantId, outletId: outlet.id });
  const bndData = catRes.data.find((p) => p.id === bundle.id);

  if (!bndData) throw new Error('Paket tidak ditemukan di catalogReadAdapter');

  console.log(`            • Stok Terhitung Paket : ${bndData.stock} (Target: 3)`);
  console.log(`            • Limit Stok           : ${bndData.bundleLimitStock} (Target: 3)`);
  console.log(`            • Komponen Pembatas    : "${bndData.bundleBottleneckItem}" (Target: "${itemB.name}")`);
  console.log(`            • Status Out of Stock  : ${bndData.isOutOfStock} (Target: false)`);

  if (bndData.stock !== 3 || bndData.bundleLimitStock !== 3) {
    throw new Error(`Kalkulasi stok salah! Diharapkan 3, didapat ${bndData.stock}`);
  }
  if (bndData.bundleBottleneckItem !== itemB.name) {
    throw new Error(`Bottleneck salah! Diharapkan ${itemB.name}, didapat ${bndData.bundleBottleneckItem}`);
  }
  console.log('✅ SUKSES: Bottleneck terdeteksi akurat!');

  // Simulasi Stok Item B Habis (0 Bks)
  console.log('[TEST 4/4] Menguji Kasus Komponen Habis (Stok Item B = 0)...');
  await prisma.inventoryBalance.updateMany({
    where: { inventoryItemId: invB.id, storageLocationId: storageLoc.id },
    data: { quantityOnHand: 0 },
  });

  const catResAfterZero = await catalogReadAdapter.getProducts({ tenantId, outletId: outlet.id });
  const bndDataZero = catResAfterZero.data.find((p) => p.id === bundle.id);

  console.log(`            • Stok Terhitung Paket Setelah Stok B Habis : ${bndDataZero?.stock} (Target: 0)`);
  console.log(`            • Status Out of Stock                       : ${bndDataZero?.isOutOfStock} (Target: true)`);
  console.log(`            • Pembatas                                  : "${bndDataZero?.bundleBottleneckItem}"`);

  if (bndDataZero?.stock !== 0 || !bndDataZero?.isOutOfStock) {
    throw new Error('Gagal menandai paket habis saat salah satu komponen bernilai 0!');
  }
  console.log('✅ SUKSES: Paket otomatis ditandai Habis (0) saat komponen pembatas habis!');

  // Cleanup Data Uji
  console.log('🧹 Membersihkan seluruh data pengujian...');
  await prisma.productBundleItem.deleteMany({ where: { bundleProductId: bundle.id } });
  await prisma.outletProduct.deleteMany({ where: { productId: { in: [bundle.id, itemA.id, itemB.id] } } });
  await prisma.productVariant.deleteMany({ where: { productId: { in: [bundle.id, itemA.id, itemB.id] } } });
  await prisma.inventoryBalance.deleteMany({ where: { inventoryItemId: { in: [invA.id, invB.id] } } });
  await prisma.inventoryItem.deleteMany({ where: { id: { in: [invA.id, invB.id] } } });
  await prisma.product.deleteMany({ where: { id: { in: [bundle.id, itemA.id, itemB.id] } } });

  console.log('========================================================================');
  console.log('🎉 PENGUJIAN DYNAMIC BOTTLENECK STOCK LIMIT ENGINE LULUS 100%!');
  console.log('========================================================================');
}

runBottleneckStockTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ GAGAL PENGUJIAN:', err);
    process.exit(1);
  });
