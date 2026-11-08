import { PrismaClient, ProductType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenantSlug = 'URA-4829001';
  console.log(`🚀 Menambahkan Dummy Data Produk Retail untuk Tenant [${tenantSlug}]...`);

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    include: {
      outlets: true,
      storageLocations: true,
      categories: true,
    },
  });

  if (!tenant) {
    throw new Error(`Tenant dengan slug ${tenantSlug} tidak ditemukan.`);
  }

  console.log(`✅ Tenant ditemukan: "${tenant.name}" (ID: ${tenant.id})`);
  console.log(`   Daftar Outlet: ${tenant.outlets.map((o) => `${o.name} (${o.code})`).join(', ')}`);

  // 1. Pastikan Kategori Retail Tersedia
  let catDrink = tenant.categories.find((c) => c.name === 'Minuman Kemasan (Retail)');
  if (!catDrink) {
    catDrink = await prisma.category.create({
      data: {
        tenantId: tenant.id,
        name: 'Minuman Kemasan (Retail)',
        slug: 'minuman-kemasan-retail',
      },
    });
    console.log(`   📁 Kategori baru dibuat: "Minuman Kemasan (Retail)"`);
  }

  let catSnack = tenant.categories.find((c) => c.name === 'Makanan & Camilan (Retail)');
  if (!catSnack) {
    catSnack = await prisma.category.create({
      data: {
        tenantId: tenant.id,
        name: 'Makanan & Camilan (Retail)',
        slug: 'makanan-camilan-retail',
      },
    });
    console.log(`   📁 Kategori baru dibuat: "Makanan & Camilan (Retail)"`);
  }

  // Identifikasi lokasi penyimpanan
  const locKemang = tenant.storageLocations.find((l) => l.name.includes('Kemang')) || tenant.storageLocations[0];
  const locSudirman = tenant.storageLocations.find((l) => l.name.includes('Sudirman'));
  const locGudang = tenant.storageLocations.find((l) => l.type === 'WAREHOUSE') || tenant.storageLocations[0];

  const retailProductsData = [
    {
      name: 'Teh Kotak Melati 250ml',
      sku: 'RET-TEH-250',
      barcode: '8992753210012',
      unit: 'Kotak',
      categoryId: catDrink.id,
      basePrice: 5000,
      costPrice: 3200,
      imageUrl: 'https://images.unsplash.com/photo-1556881286-fc6915169721?w=400&auto=format&fit=crop&q=80',
      stockKemang: 30,
      stockSudirman: 20,
      stockGudang: 100,
    },
    {
      name: 'Air Mineral Aqua 600ml',
      sku: 'RET-AQUA-600',
      barcode: '8992753210029',
      unit: 'Btl',
      categoryId: catDrink.id,
      basePrice: 4000,
      costPrice: 2400,
      imageUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?w=400&auto=format&fit=crop&q=80',
      stockKemang: 48,
      stockSudirman: 36,
      stockGudang: 200,
    },
    {
      name: 'Coca-Cola Can 330ml',
      sku: 'RET-COKE-330',
      barcode: '8992753210036',
      unit: 'Klg',
      categoryId: catDrink.id,
      basePrice: 9500,
      costPrice: 6200,
      imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&auto=format&fit=crop&q=80',
      stockKemang: 24,
      stockSudirman: 24,
      stockGudang: 120,
    },
    {
      name: 'Keripik Singkong Balado 150g',
      sku: 'RET-KRPK-150',
      barcode: '8992753210043',
      unit: 'Bks',
      categoryId: catSnack.id,
      basePrice: 12000,
      costPrice: 7500,
      imageUrl: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=400&auto=format&fit=crop&q=80',
      stockKemang: 25,
      stockSudirman: 15,
      stockGudang: 80,
    },
    {
      name: 'Kacang Kulit Sangrai 120g',
      sku: 'RET-KCNG-120',
      barcode: '8992753210050',
      unit: 'Bks',
      categoryId: catSnack.id,
      basePrice: 10000,
      costPrice: 6000,
      imageUrl: 'https://images.unsplash.com/photo-1525286102393-8686d03ca416?w=400&auto=format&fit=crop&q=80',
      stockKemang: 20,
      stockSudirman: 15,
      stockGudang: 60,
    },
    {
      name: 'Cookies Cokelat Chocochip 80g',
      sku: 'RET-CKIS-080',
      barcode: '8992753210067',
      unit: 'Bks',
      categoryId: catSnack.id,
      basePrice: 15000,
      costPrice: 9500,
      imageUrl: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&auto=format&fit=crop&q=80',
      stockKemang: 18,
      stockSudirman: 12,
      stockGudang: 50,
    },
  ];

  console.log(`\n📦 Menginjeksi 6 Produk Ritel Makanan & Minuman...`);

  for (const item of retailProductsData) {
    // 1. Cek atau Buat InventoryItem fisik
    let invItem = await prisma.inventoryItem.findFirst({
      where: { tenantId: tenant.id, itemCode: `INV-${item.sku}` },
    });
    if (!invItem) {
      invItem = await prisma.inventoryItem.create({
        data: {
          tenantId: tenant.id,
          itemCode: `INV-${item.sku}`,
          name: item.name,
          canonicalUom: item.unit,
          averageCost: item.costPrice,
          reorderPoint: 5,
        },
      });
    }

    // 2. Cek atau Buat Product dengan tipe STANDARD
    let product = await prisma.product.findFirst({
      where: { tenantId: tenant.id, sku: item.sku },
    });
    if (!product) {
      product = await prisma.product.create({
        data: {
          tenantId: tenant.id,
          name: item.name,
          sku: item.sku,
          unit: item.unit,
          type: ProductType.STANDARD, // RITEL FISIK
          categoryId: item.categoryId,
          imageUrl: item.imageUrl,
          isActive: true,
          description: null,
        },
      });
    }

    // 3. Cek atau Buat ProductVariant
    let variant = await prisma.productVariant.findFirst({
      where: { tenantId: tenant.id, productId: product.id },
    });
    if (!variant) {
      variant = await prisma.productVariant.create({
        data: {
          tenantId: tenant.id,
          productId: product.id,
          inventoryItemId: invItem.id,
          sku: item.sku,
          barcode: item.barcode,
          name: 'Standar',
          price: item.basePrice,
          inventoryQuantityMultiplier: 1.0,
          isActive: true,
        },
      });
    } else {
      await prisma.productVariant.update({
        where: { id: variant.id },
        data: {
          inventoryItemId: invItem.id,
          price: item.basePrice,
          barcode: item.barcode,
        },
      });
    }

    // 4. Daftarkan OutletProduct ke seluruh outlet
    for (const outlet of tenant.outlets) {
      await prisma.outletProduct.upsert({
        where: {
          outletId_productId: {
            outletId: outlet.id,
            productId: product.id,
          },
        },
        create: {
          tenantId: tenant.id,
          outletId: outlet.id,
          productId: product.id,
          isAvailable: true,
        },
        update: {
          isAvailable: true,
        },
      });
    }

    // 5. Masukkan Saldo Stok Fisik (InventoryBalance)
    const updateOrCreateBal = async (locId: string, qty: number) => {
      const existing = await prisma.inventoryBalance.findFirst({
        where: {
          tenantId: tenant.id,
          inventoryItemId: invItem.id,
          storageLocationId: locId,
          inventoryBatchId: null,
        },
      });
      if (existing) {
        await prisma.inventoryBalance.update({
          where: { id: existing.id },
          data: { quantityOnHand: qty },
        });
      } else {
        await prisma.inventoryBalance.create({
          data: {
            tenantId: tenant.id,
            inventoryItemId: invItem.id,
            storageLocationId: locId,
            quantityOnHand: qty,
            quantityReserved: 0,
          },
        });
      }
    };

    if (locKemang) {
      await updateOrCreateBal(locKemang.id, item.stockKemang);
    }
    if (locSudirman) {
      await updateOrCreateBal(locSudirman.id, item.stockSudirman);
    }
    if (locGudang && locGudang.id !== locKemang?.id) {
      await updateOrCreateBal(locGudang.id, item.stockGudang);
    }

    console.log(`   ✅ [RITEL] ${item.name} (${item.unit}) -> Rp ${item.basePrice.toLocaleString('id-ID')} | Stok Kemang: ${item.stockKemang}, Sudirman: ${item.stockSudirman}`);
  }

  console.log(`\n🎉 SELESAI! Seluruh dummy data produk retail tanpa resep berhasil diisi ke URA-4829001.`);
}

main()
  .catch((e) => {
    console.error('❌ Gagal menambahkan dummy retail:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
