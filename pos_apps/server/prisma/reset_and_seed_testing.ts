import { PrismaClient, ProductType, StorageLocationType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Memulai proses reset data dummy testing & penambahan katalog produk...');

  // 1. Dapatkan tenant ura-coffee
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'ura-coffee' },
    include: {
      outlets: true,
      categories: true,
      storageLocations: true,
    },
  });

  if (!tenant) {
    throw new Error('Tenant ura-coffee tidak ditemukan!');
  }

  const tenantId = tenant.id;
  console.log(`🏢 Tenant: ${tenant.name} (${tenantId})`);

  // Outlet Kemang & Sudirman
  const outletKemang = tenant.outlets.find((o) => o.name.includes('Kemang')) || tenant.outlets[0];
  const outletSudirman = tenant.outlets.find((o) => o.name.includes('Sudirman')) || tenant.outlets[1];

  // Storage Location Bar & Kitchen Kemang & Express Bar Sudirman
  const locKemang = tenant.storageLocations.find(
    (l) => l.outletId === outletKemang.id && (l.name.includes('Kitchen') || l.name.includes('Bar'))
  ) || tenant.storageLocations[0];

  const locSudirman = tenant.storageLocations.find(
    (l) => l.outletId === (outletSudirman?.id || outletKemang.id)
  ) || locKemang;

  const locGudang = tenant.storageLocations.find(
    (l) => l.type === StorageLocationType.WAREHOUSE || l.name.includes('Gudang')
  ) || locKemang;

  // 2. Bersihkan Transaksi, Riwayat Shift, dan yang berkaitan
  console.log('🧹 Menghapus riwayat transaksi, pesanan, dan shift lama...');

  await prisma.refundItem.deleteMany({ where: { tenantId } });
  await prisma.refund.deleteMany({ where: { tenantId } });
  await prisma.paymentTransaction.deleteMany({ where: { tenantId } });
  await prisma.orderItem.deleteMany({ where: { tenantId } });
  await prisma.order.deleteMany({ where: { tenantId } });
  await prisma.shift.deleteMany({ where: { tenantId } });
  await prisma.promotionUsage.deleteMany({ where: { tenantId } });
  await prisma.customerPointLedger.deleteMany({ where: { tenantId } });
  await prisma.idempotencyRecord.deleteMany({ where: { tenantId } });
  await prisma.inventoryLedger.deleteMany({
    where: {
      tenantId,
      referenceType: { in: ['ORDER', 'REFUND'] },
    },
  });

  console.log('✅ Seluruh transaksi & riwayat shift berhasil direset bersih (0 transaksi).');

  // 3. Bersihkan Staff Dummy, pertahankan Rere (Kasir) & Dimas Prabowo (Owner)
  console.log('👥 Mengatur akun staf (hanya pertahankan Rere & Dimas Prabowo)...');

  // Pastikan akun Dimas Prabowo (Owner) aktif dan PIN 123456
  const salt = await bcrypt.genSalt(10);
  const defaultPinHash = await bcrypt.hash('123456', salt);
  const defaultPassHash = await bcrypt.hash('Admin123!', salt);

  let owner = await prisma.user.findFirst({
    where: { tenantId, email: 'owner@uracoffee.id' },
  });

  if (owner) {
    await prisma.user.update({
      where: { id: owner.id },
      data: {
        name: 'Dimas Prabowo (Owner)',
        userCode: '00001',
        pinHash: defaultPinHash,
        isActive: true,
      },
    });
  }

  let rere = await prisma.user.findFirst({
    where: { tenantId, email: 'rere@uracoffee.com' },
  });

  if (rere) {
    await prisma.user.update({
      where: { id: rere.id },
      data: {
        name: 'Rere',
        userCode: '42031',
        outletId: outletKemang.id,
        pinHash: defaultPinHash,
        isActive: true,
      },
    });
  } else {
    rere = await prisma.user.create({
      data: {
        tenantId,
        outletId: outletKemang.id,
        name: 'Rere',
        email: 'rere@uracoffee.com',
        userCode: '42031',
        role: 'CASHIER',
        passwordHash: defaultPassHash,
        pinHash: defaultPinHash,
        isActive: true,
      },
    });
  }

  // Hapus semua staf selain Dimas & Rere
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      tenantId,
      id: { notIn: [owner!.id, rere.id] },
    },
  });

  console.log(`✅ ${deletedUsers.count} akun staf dummy berhasil dihapus.`);
  console.log(`   • Owner : Dimas Prabowo (${owner!.email} / ID: 00001 / PIN: 123456)`);
  console.log(`   • Kasir : Rere (${rere.email} / ID: 42031 / PIN: 123456)`);

  // 4. Siapkan Bahan Baku Tambahan & Pastikan Stok Melimpah
  console.log('📦 Memperbarui bahan baku & stok inventori...');

  async function ensureInventoryItem(itemCode: string, name: string, uom: string) {
    let item = await prisma.inventoryItem.findUnique({
      where: { tenantId_itemCode: { tenantId, itemCode } },
    });
    if (!item) {
      item = await prisma.inventoryItem.create({
        data: {
          tenantId,
          itemCode,
          name,
          canonicalUom: uom,
          isActive: true,
        },
      });
    }
    return item;
  }

  const rawBeans = await ensureInventoryItem('RAW-BEANS-01', 'Biji Kopi Arabika House Blend', 'GRAM');
  const rawMilk = await ensureInventoryItem('RAW-MILK-01', 'Susu Fresh Milk Pasteurisasi', 'ML');
  const rawAren = await ensureInventoryItem('RAW-AREN-01', 'Sirup Gula Aren Organik', 'ML');
  const rawCaramel = await ensureInventoryItem('RAW-CARAMEL-01', 'Sirup Karamel Artisan', 'ML');
  const rawTea = await ensureInventoryItem('RAW-TEA-01', 'Daun Teh Earl Grey Premium', 'GRAM');
  const rawCroissant = await ensureInventoryItem('RAW-DOUGH-01', 'Dough Butter Croissant Ready-to-Bake', 'PCS');
  const rawCup = await ensureInventoryItem('RAW-CUP-01', 'Paper Cup 12oz Cold/Hot', 'PCS');
  const rawPastryBag = await ensureInventoryItem('RAW-PBAG-01', 'Kantong Kertas Pastry Bag', 'PCS');
  const rawMatcha = await ensureInventoryItem('RAW-MTC-01', 'Bubuk Matcha Uji Premium', 'GRAM');
  const rawChoco = await ensureInventoryItem('RAW-CHC-01', 'Bubuk Cokelat Belgia Premium', 'GRAM');
  const rawVanilla = await ensureInventoryItem('RAW-VAN-01', 'Sirup Vanilla Madagascar', 'ML');
  const rawJasmine = await ensureInventoryItem('RAW-JAS-01', 'Teh Melati Jasmine Organik', 'GRAM');

  // Isi saldo stok melimpah di Bar Kemang & Gudang
  const allRawItems = [
    rawBeans, rawMilk, rawAren, rawCaramel, rawTea,
    rawCroissant, rawCup, rawPastryBag, rawMatcha, rawChoco, rawVanilla, rawJasmine
  ];

  for (const item of allRawItems) {
    for (const loc of [locKemang, locSudirman, locGudang]) {
      if (!loc) continue;
      const existing = await prisma.inventoryBalance.findFirst({
        where: {
          tenantId,
          inventoryItemId: item.id,
          storageLocationId: loc.id,
        },
      });

      if (existing) {
        await prisma.inventoryBalance.update({
          where: { id: existing.id },
          data: { quantityOnHand: 50000 },
        });
      } else {
        await prisma.inventoryBalance.create({
          data: {
            tenantId,
            inventoryItemId: item.id,
            storageLocationId: loc.id,
            quantityOnHand: 50000,
          },
        });
      }
    }
  }

  console.log('✅ 12 bahan baku siap dengan stok melimpah di seluruh cabang.');

  // 5. Kategori Produk
  let catCoffee = tenant.categories.find((c) => c.slug === 'coffee-espresso');
  let catBakery = tenant.categories.find((c) => c.slug === 'tea-bakery');

  if (!catCoffee) {
    catCoffee = await prisma.category.create({
      data: {
        tenantId,
        name: 'Coffee & Espresso',
        slug: 'coffee-espresso',
        isActive: true,
      },
    });
  }

  if (!catBakery) {
    catBakery = await prisma.category.create({
      data: {
        tenantId,
        name: 'Tea & Bakery',
        slug: 'tea-bakery',
        isActive: true,
      },
    });
  }

  // 6. Tambah Produk baru sehingga masing-masing > 5 produk
  console.log('☕ Menambahkan variasi produk baru lengkap dengan resep & bahan baku...');

  interface NewProductDef {
    name: string;
    categoryId: string;
    description: string;
    sku: string;
    price: number;
    imageUrl: string;
    recipeItems: Array<{ item: any; qty: number }>;
  }

  const productsToAdd: NewProductDef[] = [
    // Kategori: Coffee & Espresso (Total existing 3 -> tambah 4 = 7 produk)
    {
      name: 'Cafe Latte Velvet',
      categoryId: catCoffee.id,
      description: 'Single shot espresso dipadu steamed fresh milk lembut nan creamy.',
      sku: 'FNB-LTT-001',
      price: 24000,
      imageUrl: '/images/products/latte.jpg',
      recipeItems: [
        { item: rawBeans, qty: 18 },
        { item: rawMilk, qty: 160 },
        { item: rawCup, qty: 1 },
      ],
    },
    {
      name: 'Vanilla Cold Brew Nitro',
      categoryId: catCoffee.id,
      description: 'Seduhan kopi dingin 16 jam dengan sirup vanilla madagascar aromatik.',
      sku: 'FNB-CBN-001',
      price: 26000,
      imageUrl: '/images/products/coldbrew.jpg',
      recipeItems: [
        { item: rawBeans, qty: 22 },
        { item: rawVanilla, qty: 15 },
        { item: rawCup, qty: 1 },
      ],
    },
    {
      name: 'Double Espresso On The Rocks',
      categoryId: catCoffee.id,
      description: 'Ekstraksi ganda arabika murni disajikan dingin dengan es batu kristal.',
      sku: 'FNB-ESP-001',
      price: 16000,
      imageUrl: '/images/products/espresso.jpg',
      recipeItems: [
        { item: rawBeans, qty: 18 },
        { item: rawCup, qty: 1 },
      ],
    },
    {
      name: 'Mocha Belgian Frappe',
      categoryId: catCoffee.id,
      description: 'Perpaduan kopi espresso kental dengan cokelat belgia premium & fresh milk.',
      sku: 'FNB-MCH-001',
      price: 28000,
      imageUrl: '/images/products/mocha.jpg',
      recipeItems: [
        { item: rawBeans, qty: 18 },
        { item: rawMilk, qty: 120 },
        { item: rawChoco, qty: 20 },
        { item: rawCup, qty: 1 },
      ],
    },

    // Kategori: Tea & Bakery (Total existing 2 -> tambah 5 = 7 produk)
    {
      name: 'Matcha Latte Kyoto',
      categoryId: catBakery.id,
      description: 'Matcha otentik Uji Kyoto dipadukan dengan fresh milk manis seimbang.',
      sku: 'FNB-MTC-001',
      price: 25000,
      imageUrl: '/images/products/matcha.jpg',
      recipeItems: [
        { item: rawMatcha, qty: 15 },
        { item: rawMilk, qty: 160 },
        { item: rawCup, qty: 1 },
      ],
    },
    {
      name: 'Peach Earl Grey Iced Tea',
      categoryId: catBakery.id,
      description: 'Teh Earl Grey dingin menyegarkan dengan sentuhan buah persik harum.',
      sku: 'FNB-PCH-001',
      price: 22000,
      imageUrl: '/images/products/peach-tea.jpg',
      recipeItems: [
        { item: rawTea, qty: 10 },
        { item: rawCup, qty: 1 },
      ],
    },
    {
      name: 'Pain Au Chocolat Paris',
      categoryId: catBakery.id,
      description: 'Pastry renyah berlapis khas Prancis berisi cokelat batang lumer.',
      sku: 'FNB-PAC-001',
      price: 28000,
      imageUrl: '/images/products/pain-au-chocolat.jpg',
      recipeItems: [
        { item: rawCroissant, qty: 1 },
        { item: rawChoco, qty: 15 },
        { item: rawPastryBag, qty: 1 },
      ],
    },
    {
      name: 'Cinnamon Roll Glazed',
      categoryId: catBakery.id,
      description: 'Roti gulung kayu manis harum berbalut gula aren karamel.',
      sku: 'FNB-CNR-001',
      price: 24000,
      imageUrl: '/images/products/cinnamon-roll.jpg',
      recipeItems: [
        { item: rawCroissant, qty: 1 },
        { item: rawAren, qty: 15 },
        { item: rawPastryBag, qty: 1 },
      ],
    },
    {
      name: 'Artisan Almond Croissant',
      categoryId: catBakery.id,
      description: 'Croissant panggang ganda dengan isian krim almond & taburan irisan almond.',
      sku: 'FNB-ALM-001',
      price: 32000,
      imageUrl: '/images/products/almond-croissant.jpg',
      recipeItems: [
        { item: rawCroissant, qty: 1 },
        { item: rawPastryBag, qty: 1 },
      ],
    },
  ];

  for (const def of productsToAdd) {
    let existingProd = await prisma.product.findFirst({
      where: { tenantId, name: def.name },
      include: { variants: true },
    });

    if (!existingProd) {
      existingProd = await prisma.product.create({
        data: {
          tenantId,
          categoryId: def.categoryId,
          name: def.name,
          description: def.description,
          type: ProductType.COMPOSITE,
          imageUrl: def.imageUrl,
          isActive: true,
          variants: {
            create: {
              tenantId,
              sku: def.sku,
              name: 'Regular',
              price: def.price,
              isActive: true,
            },
          },
        },
        include: { variants: true },
      });
    }

    const variant = existingProd.variants[0];

    // Buat resep jika belum ada
    let existingRecipe = await prisma.recipe.findUnique({
      where: { productVariantId: variant.id },
      include: { items: true },
    });

    if (!existingRecipe) {
      existingRecipe = await prisma.recipe.create({
        data: {
          tenantId,
          productVariantId: variant.id,
          instructions: `Resep standar untuk ${def.name}`,
          yieldQuantity: 1,
        },
        include: { items: true },
      });

      for (const rItem of def.recipeItems) {
        await prisma.recipeItem.create({
          data: {
            tenantId,
            recipeId: existingRecipe.id,
            inventoryItemId: rItem.item.id,
            quantity: rItem.qty,
          },
        });
      }
    }
  }

  // Ringkasan Akhir
  const finalSummary = await prisma.category.findMany({
    where: { tenantId },
    include: {
      products: {
        where: { isActive: true },
        include: {
          variants: {
            include: {
              recipe: {
                include: {
                  items: {
                    include: { inventoryItem: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  console.log('\n📊 RINGKASAN DATA TOKO URA COFFEE TERBARU:');
  finalSummary.forEach((cat) => {
    console.log(`\n📁 Kategori: ${cat.name} (${cat.products.length} Produk)`);
    cat.products.forEach((p, idx) => {
      const v = p.variants[0];
      const recipeDesc = v?.recipe?.items
        .map((it) => `${it.inventoryItem.name} (${it.quantity} ${it.inventoryItem.canonicalUom})`)
        .join(', ');
      console.log(`   ${idx + 1}. ${p.name} - Rp ${Number(v?.price || 0).toLocaleString('id-ID')}`);
      console.log(`      Bahan Baku: ${recipeDesc || 'Langsung'}`);
    });
  });

  console.log('\n✨ Selesai dengan sempurna! Data testing manual siap digunakan.');
}

main()
  .catch((e) => {
    console.error('❌ Error saat eksekusi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
