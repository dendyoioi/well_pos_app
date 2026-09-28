import { PrismaClient, ProductType, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('📦 Menambahkan 15 Menu Tambahan Ura Corporation (Total 18 Menu, 6 per Outlet)...');

  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'ura-corporation' },
    include: {
      outlets: true,
      categories: true,
    },
  });

  if (!tenant) {
    console.error('❌ Tenant Ura Corporation tidak ditemukan!');
    process.exit(1);
  }

  const catCoffee = tenant.categories.find((c) => c.slug === 'coffee-beverages') || tenant.categories[0];
  const catBakery = tenant.categories.find((c) => c.slug === 'bakery-pastry') || tenant.categories[1];
  const catChicken = tenant.categories.find((c) => c.slug === 'fried-chicken-meals') || tenant.categories[2];

  const outletCoffee = tenant.outlets.find((o) => o.name.includes('Coffee'))!;
  const outletBakery = tenant.outlets.find((o) => o.name.includes('Bakery'))!;
  const outletChicken = tenant.outlets.find((o) => o.name.includes('Fried Chicken'))!;

  const productsToSeed = [
    // --- URA COFFEE (5 Tambahan) ---
    {
      name: 'Americano Iced Double Shot',
      category: catCoffee,
      outlet: outletCoffee,
      desc: 'Double shot espresso Arabika pilihan dengan es batu segar dingin.',
      sku: 'FNB-COF-002',
      price: 18000,
      cost: 6000,
    },
    {
      name: 'Caramel Macchiato Creamy',
      category: catCoffee,
      outlet: outletCoffee,
      desc: 'Espresso dipadu steamed fresh milk dengan sirup karamel vanila artisan.',
      sku: 'FNB-COF-003',
      price: 28000,
      cost: 11000,
    },
    {
      name: 'Matcha Latte Uji Kyoto',
      category: catCoffee,
      outlet: outletCoffee,
      desc: 'Bubuk matcha murni asal Kyoto dipadukan dengan fresh milk lembut.',
      sku: 'FNB-COF-004',
      price: 26000,
      cost: 10000,
    },
    {
      name: 'Earl Grey Milk Tea',
      category: catCoffee,
      outlet: outletCoffee,
      desc: 'Teh hitam aromatik bergamot disajikan dengan susu segar gurih.',
      sku: 'FNB-COF-005',
      price: 20000,
      cost: 7000,
    },
    {
      name: 'Chocolate Signature Ice',
      category: catCoffee,
      outlet: outletCoffee,
      desc: 'Cokelat Belgia pekat dengan racikan susu creamy premium.',
      sku: 'FNB-COF-006',
      price: 24000,
      cost: 9000,
    },

    // --- URA BAKERY (5 Tambahan) ---
    {
      name: 'Pain Au Chocolat French',
      category: catBakery,
      outlet: outletBakery,
      desc: 'Pastry renyah berlapis dengan isian dark chocolate couverture leleh.',
      sku: 'FNB-BAK-002',
      price: 28000,
      cost: 12000,
    },
    {
      name: 'Almond Croissant Deluxe',
      category: catBakery,
      outlet: outletBakery,
      desc: 'Croissant panggang ganda dengan krim almond dan taburan irisan almond.',
      sku: 'FNB-BAK-003',
      price: 32000,
      cost: 14000,
    },
    {
      name: 'Cinnamon Roll Glaze',
      category: catBakery,
      outlet: outletBakery,
      desc: 'Roti gulung kayu manis harum dengan vanilla cream cheese glaze.',
      sku: 'FNB-BAK-004',
      price: 24000,
      cost: 9000,
    },
    {
      name: 'Sourdough Loaf Artisanal',
      category: catBakery,
      outlet: outletBakery,
      desc: 'Roti sourdough fermentasi lambat 24 jam dengan kerak renyah khas.',
      sku: 'FNB-BAK-005',
      price: 45000,
      cost: 18000,
    },
    {
      name: 'Garlic Cream Cheese Bun',
      category: catBakery,
      outlet: outletBakery,
      desc: 'Roti lembut berlumur mentega bawang putih dan isian cream cheese gurih.',
      sku: 'FNB-BAK-006',
      price: 26000,
      cost: 10500,
    },

    // --- URA FRIED CHICKEN (5 Tambahan) ---
    {
      name: 'Paket Ura Fried Chicken 2 (Nasi + Paha Atas + Es Teh)',
      category: catChicken,
      outlet: outletChicken,
      desc: 'Nasi pulen hangat, 1 pcs paha atas crispy bumbu rempah, dan es teh manis.',
      sku: 'FNB-CHK-002',
      price: 30000,
      cost: 14000,
    },
    {
      name: 'Paket Spicy Geprek Ura (Nasi + Ayam Geprek Level 3)',
      category: catChicken,
      outlet: outletChicken,
      desc: 'Ayam krispi digeprek sambal bawang pedas khas Ura dengan nasi putih.',
      sku: 'FNB-CHK-003',
      price: 28000,
      cost: 12500,
    },
    {
      name: 'Ura Crispy Chicken Wings (6 pcs Sambal Matah)',
      category: catChicken,
      outlet: outletChicken,
      desc: '6 potong sayap ayam renyah disajikan dengan topping sambal matah Bali segar.',
      sku: 'FNB-CHK-004',
      price: 35000,
      cost: 16000,
    },
    {
      name: 'French Fries Large Crispy',
      category: catChicken,
      outlet: outletChicken,
      desc: 'Kentang goreng impor potong tebal dengan taburan sea salt gurih.',
      sku: 'FNB-CHK-005',
      price: 18000,
      cost: 7000,
    },
    {
      name: 'Es Lemon Tea Segar Jumbo',
      category: catChicken,
      outlet: outletChicken,
      desc: 'Minuman teh segar dengan perasan lemon asli ukuran jumbo 22oz.',
      sku: 'FNB-CHK-006',
      price: 10000,
      cost: 3000,
    },
  ];

  for (const item of productsToSeed) {
    // Cari apakah produk sudah ada berdasarkan nama dan tenantId
    let product = await prisma.product.findFirst({
      where: {
        tenantId: tenant.id,
        name: item.name,
      },
    });

    if (!product) {
      product = await prisma.product.create({
        data: {
          tenantId: tenant.id,
          categoryId: item.category.id,
          name: item.name,
          description: item.desc,
          type: ProductType.STANDARD,
          unit: 'Pcs',
          isActive: true,
        },
      });
      console.log(`   + Dibuat: ${product.name}`);
    }

    // Buat atau perbarui variant
    const variant = await prisma.productVariant.upsert({
      where: {
        tenantId_sku: {
          tenantId: tenant.id,
          sku: item.sku,
        },
      },
      update: {
        price: new Prisma.Decimal(item.price),
        isActive: true,
      },
      create: {
        tenantId: tenant.id,
        productId: product.id,
        sku: item.sku,
        name: 'Regular',
        price: new Prisma.Decimal(item.price),
        isActive: true,
      },
    });

    // Hubungkan dengan outlet
    await prisma.outletProduct.upsert({
      where: {
        outletId_productId: {
          outletId: item.outlet.id,
          productId: product.id,
        },
      },
      update: {
        isAvailable: true,
      },
      create: {
        tenantId: tenant.id,
        outletId: item.outlet.id,
        productId: product.id,
        isAvailable: true,
      },
    });
  }

  console.log('✅ Berhasil menyelaraskan 18 master menu produk Ura Corporation!');
}

main()
  .catch((e) => {
    console.error('❌ Gagal seed produk:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
