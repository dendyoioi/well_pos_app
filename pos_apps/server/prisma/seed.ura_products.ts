import { PrismaClient, ProductType, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('📦 Menyelaraskan 15 Menu F&B Tambahan & Formula Resep BOM Ura Corporation...');

  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'ura-corporation' },
    include: {
      outlets: {
        include: {
          storageLocations: true,
        },
      },
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

  const outletCoffee = tenant.outlets.find((o) => o.name.includes('Coffee')) || tenant.outlets[0];
  const outletBakery = tenant.outlets.find((o) => o.name.includes('Bakery')) || tenant.outlets[0];
  const outletChicken = tenant.outlets.find((o) => o.name.includes('Fried Chicken')) || tenant.outlets[0];
  const gudangPusat = tenant.outlets.find((o) => o.name.includes('Gudang Logistik Pusat')) || tenant.outlets[0];

  const locGudang = gudangPusat.storageLocations.find((l) => l.isDefault) || gudangPusat.storageLocations[0];
  const locCoffee = outletCoffee.storageLocations.find((l) => l.isDefault) || outletCoffee.storageLocations[0];
  const locBakery = outletBakery.storageLocations.find((l) => l.isDefault) || outletBakery.storageLocations[0];
  const locChicken = outletChicken.storageLocations.find((l) => l.isDefault) || outletChicken.storageLocations[0];

  // 1. Master Bahan Baku
  const ingredientsData = [
    { itemCode: 'RAW-COFFEE-01', name: 'Biji Kopi Espresso Blend (House Blend)', uom: 'GRAM', cost: 220, reorder: 500, locs: [locCoffee.id] },
    { itemCode: 'RAW-MILK-01', name: 'Susu Sapi Segar Pasteurised (Fresh Milk)', uom: 'ML', cost: 20, reorder: 2000, locs: [locCoffee.id, locBakery.id] },
    { itemCode: 'RAW-SYRUP-01', name: 'Sirup Gula Aren Organik', uom: 'ML', cost: 35, reorder: 1000, locs: [locCoffee.id, locChicken.id] },
    { itemCode: 'PKG-CUP-16', name: 'Cup Plastik 16oz + Tutup Lid', uom: 'PCS', cost: 650, reorder: 100, locs: [locCoffee.id, locChicken.id] },
    { itemCode: 'PKG-STRAW-01', name: 'Sedotan Higienis Ramah Lingkungan', uom: 'PCS', cost: 150, reorder: 200, locs: [locCoffee.id, locChicken.id] },
    { itemCode: 'RAW-FLOUR-01', name: 'Tepung Terigu Protein Tinggi (Japan Grade)', uom: 'GRAM', cost: 18, reorder: 2000, locs: [locBakery.id] },
    { itemCode: 'RAW-BUTTER-01', name: 'French Unsalted Butter Premium', uom: 'GRAM', cost: 160, reorder: 1000, locs: [locBakery.id] },
    { itemCode: 'RAW-YEAST-01', name: 'Ragi Instan & Gula Halus Baker', uom: 'GRAM', cost: 25, reorder: 500, locs: [locBakery.id] },
    { itemCode: 'PKG-BAG-01', name: 'Kantong Kertas Pastry Brown Kraft', uom: 'PCS', cost: 400, reorder: 100, locs: [locBakery.id, locChicken.id] },
    { itemCode: 'RAW-CHICKEN-01', name: 'Daging Ayam Potong Marinasi (Dada/Paha)', uom: 'PCS', cost: 9500, reorder: 50, locs: [locChicken.id] },
    { itemCode: 'RAW-FLOUR-CHX', name: 'Tepung Bumbu Crispy Rahasia Ura', uom: 'GRAM', cost: 30, reorder: 2000, locs: [locChicken.id] },
    { itemCode: 'RAW-OIL-01', name: 'Minyak Goreng Kelapa Sawit Super', uom: 'ML', cost: 18, reorder: 5000, locs: [locChicken.id] },
    { itemCode: 'RAW-RICE-01', name: 'Beras Pulen Cianjur (Porsi Nasi)', uom: 'GRAM', cost: 15, reorder: 5000, locs: [locChicken.id] },
    { itemCode: 'PKG-BOX-01', name: 'Kotak Box Makanan Fried Chicken Ura', uom: 'PCS', cost: 800, reorder: 100, locs: [locChicken.id] },
    { itemCode: 'RAW-CARAMEL-01', name: 'Sirup Karamel Vanila Artisan', uom: 'ML', cost: 45, reorder: 1000, locs: [locCoffee.id] },
    { itemCode: 'RAW-MATCHA-01', name: 'Bubuk Matcha Murni Uji Kyoto', uom: 'GRAM', cost: 180, reorder: 500, locs: [locCoffee.id] },
    { itemCode: 'RAW-EARL-01', name: 'Daun Teh Hitam Earl Grey Bergamot', uom: 'GRAM', cost: 80, reorder: 500, locs: [locCoffee.id, locChicken.id] },
    { itemCode: 'RAW-CHOC-01', name: 'Bubuk Kakao Dark Chocolate Belgia', uom: 'GRAM', cost: 120, reorder: 1000, locs: [locCoffee.id, locBakery.id] },
    { itemCode: 'RAW-LEMON-01', name: 'Sari Jeruk Lemon Segar Alami', uom: 'ML', cost: 30, reorder: 1000, locs: [locCoffee.id, locChicken.id] },
    { itemCode: 'RAW-CHOC-BAR', name: 'Dark Chocolate Couverture Batons 65%', uom: 'GRAM', cost: 150, reorder: 1000, locs: [locBakery.id] },
    { itemCode: 'RAW-ALMOND-01', name: 'Irisan Almond Panggang Gurih', uom: 'GRAM', cost: 200, reorder: 500, locs: [locBakery.id] },
    { itemCode: 'RAW-CINNAMON-01', name: 'Bubuk Kayu Manis Ceylan & Brown Sugar', uom: 'GRAM', cost: 75, reorder: 500, locs: [locBakery.id] },
    { itemCode: 'RAW-CHEESE-01', name: 'Cream Cheese & Racikan Bawang Putih', uom: 'GRAM', cost: 110, reorder: 1000, locs: [locBakery.id] },
    { itemCode: 'RAW-CHILLI-01', name: 'Cabe Rawit Merah & Bumbu Sambal Ura', uom: 'GRAM', cost: 65, reorder: 1000, locs: [locChicken.id] },
    { itemCode: 'RAW-WINGS-01', name: 'Sayap Ayam Potong Segar Marinasi', uom: 'PCS', cost: 2500, reorder: 100, locs: [locChicken.id] },
    { itemCode: 'RAW-FRIES-01', name: 'Kentang Beku Shoestring Impor Renyah', uom: 'GRAM', cost: 35, reorder: 5000, locs: [locChicken.id] },
  ];

  const ingredientMap = new Map<string, string>();
  for (const ing of ingredientsData) {
    const item = await prisma.inventoryItem.upsert({
      where: {
        tenantId_itemCode: {
          tenantId: tenant.id,
          itemCode: ing.itemCode,
        },
      },
      update: {
        name: ing.name,
        canonicalUom: ing.uom,
        averageCost: new Prisma.Decimal(ing.cost),
        reorderPoint: new Prisma.Decimal(ing.reorder),
        isActive: true,
      },
      create: {
        tenantId: tenant.id,
        itemCode: ing.itemCode,
        name: ing.name,
        canonicalUom: ing.uom,
        averageCost: new Prisma.Decimal(ing.cost),
        reorderPoint: new Prisma.Decimal(ing.reorder),
        isActive: true,
      },
    });

    ingredientMap.set(ing.itemCode, item.id);

    // Saldo fisik di gudang dan outlet
    const targetLocIds = [locGudang.id, ...ing.locs];
    for (const locId of targetLocIds) {
      const initialQty = ing.uom === 'PCS' ? 500 : 10000;
      await prisma.$executeRawUnsafe(
        `INSERT INTO "inventory_balances" (
          "id", "tenant_id", "inventory_item_id", "storage_location_id", "inventory_batch_id",
          "quantity_on_hand", "quantity_reserved", "updated_at"
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, null, $4, 0, CURRENT_TIMESTAMP
        )
        ON CONFLICT ("tenant_id", "inventory_item_id", "storage_location_id") 
        WHERE "inventory_batch_id" IS NULL
        DO UPDATE SET "quantity_on_hand" = CASE 
          WHEN "inventory_balances"."quantity_on_hand" < 50 THEN EXCLUDED."quantity_on_hand" 
          ELSE "inventory_balances"."quantity_on_hand" 
        END, "updated_at" = CURRENT_TIMESTAMP;`,
        tenant.id,
        item.id,
        locId,
        initialQty
      );
    }
  }

  const productsToSeed = [
    // --- URA COFFEE (5 Tambahan) ---
    {
      name: 'Americano Iced Double Shot',
      category: catCoffee,
      outlet: outletCoffee,
      desc: 'Double shot espresso Arabika pilihan dengan es batu segar dingin.',
      sku: 'FNB-COF-002',
      price: 18000,
      recipe: {
        instructions: 'Grind 20g espresso blend, extract 40ml double shot, add water & ice.',
        items: [
          { code: 'RAW-COFFEE-01', qty: 20 },
          { code: 'PKG-CUP-16', qty: 1 },
          { code: 'PKG-STRAW-01', qty: 1 },
        ],
      },
    },
    {
      name: 'Caramel Macchiato Creamy',
      category: catCoffee,
      outlet: outletCoffee,
      desc: 'Espresso dipadu steamed fresh milk dengan sirup karamel vanila artisan.',
      sku: 'FNB-COF-003',
      price: 28000,
      recipe: {
        instructions: 'Ekstraksi 18g espresso, 25ml sirup karamel, 150ml fresh milk, caramel drizzle.',
        items: [
          { code: 'RAW-COFFEE-01', qty: 18 },
          { code: 'RAW-MILK-01', qty: 150 },
          { code: 'RAW-CARAMEL-01', qty: 25 },
          { code: 'PKG-CUP-16', qty: 1 },
          { code: 'PKG-STRAW-01', qty: 1 },
        ],
      },
    },
    {
      name: 'Matcha Latte Uji Kyoto',
      category: catCoffee,
      outlet: outletCoffee,
      desc: 'Bubuk matcha murni asal Kyoto dipadukan dengan fresh milk lembut.',
      sku: 'FNB-COF-004',
      price: 26000,
      recipe: {
        instructions: 'Whisk 20g matcha Uji, 160ml fresh milk, 15ml aren syrup, serve with ice.',
        items: [
          { code: 'RAW-MATCHA-01', qty: 20 },
          { code: 'RAW-MILK-01', qty: 160 },
          { code: 'RAW-SYRUP-01', qty: 15 },
          { code: 'PKG-CUP-16', qty: 1 },
          { code: 'PKG-STRAW-01', qty: 1 },
        ],
      },
    },
    {
      name: 'Earl Grey Milk Tea',
      category: catCoffee,
      outlet: outletCoffee,
      desc: 'Teh hitam aromatik bergamot disajikan dengan susu segar gurih.',
      sku: 'FNB-COF-005',
      price: 20000,
      recipe: {
        instructions: 'Seduh 10g daun Earl Grey pekat, 140ml fresh milk, 20ml aren syrup, shake with ice.',
        items: [
          { code: 'RAW-EARL-01', qty: 10 },
          { code: 'RAW-MILK-01', qty: 140 },
          { code: 'RAW-SYRUP-01', qty: 20 },
          { code: 'PKG-CUP-16', qty: 1 },
          { code: 'PKG-STRAW-01', qty: 1 },
        ],
      },
    },
    {
      name: 'Chocolate Signature Ice',
      category: catCoffee,
      outlet: outletCoffee,
      desc: 'Cokelat Belgia pekat dengan racikan susu creamy premium.',
      sku: 'FNB-COF-006',
      price: 24000,
      recipe: {
        instructions: '30g bubuk cokelat Belgia, 150ml fresh milk, 15ml aren syrup, blend or shake with ice.',
        items: [
          { code: 'RAW-CHOC-01', qty: 30 },
          { code: 'RAW-MILK-01', qty: 150 },
          { code: 'RAW-SYRUP-01', qty: 15 },
          { code: 'PKG-CUP-16', qty: 1 },
          { code: 'PKG-STRAW-01', qty: 1 },
        ],
      },
    },

    // --- URA BAKERY (5 Tambahan) ---
    {
      name: 'Pain Au Chocolat French',
      category: catBakery,
      outlet: outletBakery,
      desc: 'Pastry renyah berlapis dengan isian dark chocolate couverture leleh.',
      sku: 'FNB-BAK-002',
      price: 28000,
      recipe: {
        instructions: 'Laminasi adonan tepung butter, 2 batons dark chocolate, bake 180C 20 min.',
        items: [
          { code: 'RAW-FLOUR-01', qty: 75 },
          { code: 'RAW-BUTTER-01', qty: 40 },
          { code: 'RAW-YEAST-01', qty: 10 },
          { code: 'RAW-CHOC-BAR', qty: 25 },
          { code: 'PKG-BAG-01', qty: 1 },
        ],
      },
    },
    {
      name: 'Almond Croissant Deluxe',
      category: catBakery,
      outlet: outletBakery,
      desc: 'Croissant panggang ganda dengan krim almond dan taburan irisan almond.',
      sku: 'FNB-BAK-003',
      price: 32000,
      recipe: {
        instructions: 'Belah croissant, almond cream spread, 20g toasted almond topping, bake.',
        items: [
          { code: 'RAW-FLOUR-01', qty: 80 },
          { code: 'RAW-BUTTER-01', qty: 45 },
          { code: 'RAW-YEAST-01', qty: 10 },
          { code: 'RAW-ALMOND-01', qty: 20 },
          { code: 'PKG-BAG-01', qty: 1 },
        ],
      },
    },
    {
      name: 'Cinnamon Roll Glaze',
      category: catBakery,
      outlet: outletBakery,
      desc: 'Roti gulung kayu manis harum dengan vanilla cream cheese glaze.',
      sku: 'FNB-BAK-004',
      price: 24000,
      recipe: {
        instructions: 'Roll with brown sugar and cinnamon, bake, drizzle vanilla cream cheese glaze.',
        items: [
          { code: 'RAW-FLOUR-01', qty: 85 },
          { code: 'RAW-BUTTER-01', qty: 35 },
          { code: 'RAW-YEAST-01', qty: 15 },
          { code: 'RAW-CINNAMON-01', qty: 15 },
          { code: 'PKG-BAG-01', qty: 1 },
        ],
      },
    },
    {
      name: 'Sourdough Loaf Artisanal',
      category: catBakery,
      outlet: outletBakery,
      desc: 'Roti sourdough fermentasi lambat 24 jam dengan kerak renyah khas.',
      sku: 'FNB-BAK-005',
      price: 45000,
      recipe: {
        instructions: 'Slow fermentation 24h sourdough, shape loaf, bake in stone oven.',
        items: [
          { code: 'RAW-FLOUR-01', qty: 250 },
          { code: 'RAW-YEAST-01', qty: 15 },
          { code: 'PKG-BAG-01', qty: 1 },
        ],
      },
    },
    {
      name: 'Garlic Cream Cheese Bun',
      category: catBakery,
      outlet: outletBakery,
      desc: 'Roti lembut berlumur mentega bawang putih dan isian cream cheese gurih.',
      sku: 'FNB-BAK-006',
      price: 26000,
      recipe: {
        instructions: 'Soft bun cut into 6 segments, filled with garlic cream cheese, dip in garlic butter.',
        items: [
          { code: 'RAW-FLOUR-01', qty: 90 },
          { code: 'RAW-BUTTER-01', qty: 30 },
          { code: 'RAW-CHEESE-01', qty: 45 },
          { code: 'PKG-BAG-01', qty: 1 },
        ],
      },
    },

    // --- URA FRIED CHICKEN (5 Tambahan) ---
    {
      name: 'Paket Ura Fried Chicken 2 (Nasi + Paha Atas + Es Teh)',
      category: catChicken,
      outlet: outletChicken,
      desc: 'Nasi pulen hangat, 1 pcs paha atas crispy bumbu rempah, dan es teh manis.',
      sku: 'FNB-CHK-002',
      price: 30000,
      recipe: {
        instructions: 'Fried chicken paha atas, 150g rice, es teh manis in 16oz cup.',
        items: [
          { code: 'RAW-CHICKEN-01', qty: 1 },
          { code: 'RAW-FLOUR-CHX', qty: 50 },
          { code: 'RAW-OIL-01', qty: 40 },
          { code: 'RAW-RICE-01', qty: 150 },
          { code: 'RAW-EARL-01', qty: 5 },
          { code: 'PKG-BOX-01', qty: 1 },
          { code: 'PKG-CUP-16', qty: 1 },
          { code: 'PKG-STRAW-01', qty: 1 },
        ],
      },
    },
    {
      name: 'Paket Spicy Geprek Ura (Nasi + Ayam Geprek Level 3)',
      category: catChicken,
      outlet: outletChicken,
      desc: 'Ayam krispi digeprek sambal bawang pedas khas Ura dengan nasi putih.',
      sku: 'FNB-CHK-003',
      price: 28000,
      recipe: {
        instructions: 'Crush fried chicken with 30g red chili sambal, 150g white rice in box.',
        items: [
          { code: 'RAW-CHICKEN-01', qty: 1 },
          { code: 'RAW-FLOUR-CHX', qty: 50 },
          { code: 'RAW-OIL-01', qty: 45 },
          { code: 'RAW-RICE-01', qty: 150 },
          { code: 'RAW-CHILLI-01', qty: 30 },
          { code: 'PKG-BOX-01', qty: 1 },
        ],
      },
    },
    {
      name: 'Ura Crispy Chicken Wings (6 pcs Sambal Matah)',
      category: catChicken,
      outlet: outletChicken,
      desc: '6 potong sayap ayam renyah disajikan dengan topping sambal matah Bali segar.',
      sku: 'FNB-CHK-004',
      price: 35000,
      recipe: {
        instructions: '6 pcs crispy wings deep fried, topped with 25g fresh sambal matah.',
        items: [
          { code: 'RAW-WINGS-01', qty: 6 },
          { code: 'RAW-FLOUR-CHX', qty: 60 },
          { code: 'RAW-OIL-01', qty: 50 },
          { code: 'RAW-CHILLI-01', qty: 25 },
          { code: 'PKG-BOX-01', qty: 1 },
        ],
      },
    },
    {
      name: 'French Fries Large Crispy',
      category: catChicken,
      outlet: outletChicken,
      desc: 'Kentang goreng impor potong tebal dengan taburan sea salt gurih.',
      sku: 'FNB-CHK-005',
      price: 18000,
      recipe: {
        instructions: 'Deep fry 200g shoestring fries 3.5 min, toss with sea salt.',
        items: [
          { code: 'RAW-FRIES-01', qty: 200 },
          { code: 'RAW-OIL-01', qty: 50 },
          { code: 'PKG-BAG-01', qty: 1 },
        ],
      },
    },
    {
      name: 'Es Lemon Tea Segar Jumbo',
      category: catChicken,
      outlet: outletChicken,
      desc: 'Minuman teh segar dengan perasan lemon asli ukuran jumbo 22oz.',
      sku: 'FNB-CHK-006',
      price: 10000,
      recipe: {
        instructions: 'Brew 8g black tea, 35ml fresh lemon juice, 25ml aren syrup in 16oz cup.',
        items: [
          { code: 'RAW-EARL-01', qty: 8 },
          { code: 'RAW-LEMON-01', qty: 35 },
          { code: 'RAW-SYRUP-01', qty: 25 },
          { code: 'PKG-CUP-16', qty: 1 },
          { code: 'PKG-STRAW-01', qty: 1 },
        ],
      },
    },
  ];

  for (const item of productsToSeed) {
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
          type: ProductType.COMPOSITE,
          unit: 'Pcs',
          isActive: true,
        },
      });
      console.log(`   + Dibuat: ${product.name}`);
    } else {
      await prisma.product.update({
        where: { id: product.id },
        data: { type: ProductType.COMPOSITE },
      });
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
        inventoryItemId: null,
        isActive: true,
      },
      create: {
        tenantId: tenant.id,
        productId: product.id,
        sku: item.sku,
        name: 'Regular',
        price: new Prisma.Decimal(item.price),
        inventoryItemId: null,
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

    // Buat/Update Recipe
    const recipe = await prisma.recipe.upsert({
      where: { productVariantId: variant.id },
      update: {
        instructions: item.recipe.instructions,
        yieldQuantity: new Prisma.Decimal(1.0),
      },
      create: {
        tenantId: tenant.id,
        productVariantId: variant.id,
        instructions: item.recipe.instructions,
        yieldQuantity: new Prisma.Decimal(1.0),
      },
    });

    await prisma.recipeItem.deleteMany({
      where: { recipeId: recipe.id },
    });

    for (const ri of item.recipe.items) {
      const invItemId = ingredientMap.get(ri.code);
      if (invItemId) {
        await prisma.recipeItem.create({
          data: {
            tenantId: tenant.id,
            recipeId: recipe.id,
            inventoryItemId: invItemId,
            quantity: new Prisma.Decimal(ri.qty),
            costRatio: new Prisma.Decimal(1.0),
          },
        });
      }
    }
  }

  console.log('✅ Berhasil menyelaraskan 15 master menu F&B produk & formula resep BOM Ura Corporation!');
}

main()
  .catch((e) => {
    console.error('❌ Gagal seed produk:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
