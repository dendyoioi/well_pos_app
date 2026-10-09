import { PrismaClient, ProductType, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Menyelaraskan Resep BOM & Bahan Baku untuk 15 Menu F&B Ura Corporation...');

  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'ura-corporation' },
    include: {
      outlets: {
        include: {
          storageLocations: true,
        },
      },
    },
  });

  if (!tenant) {
    console.error('❌ Tenant Ura Corporation tidak ditemukan!');
    process.exit(1);
  }

  // Cari outlet utama
  const gudangPusat = tenant.outlets.find((o) => o.name.includes('Gudang Logistik Pusat')) || tenant.outlets[0];
  const outletKemang = tenant.outlets.find((o) => o.name.includes('Kemang')) || tenant.outlets[0];
  const outletTebet = tenant.outlets.find((o) => o.name.includes('Tebet')) || tenant.outlets[0];
  const outletPancoran = tenant.outlets.find((o) => o.name.includes('Pancoran')) || tenant.outlets[0];

  const locGudang = gudangPusat.storageLocations.find((l) => l.isDefault) || gudangPusat.storageLocations[0];
  const locKemang = outletKemang.storageLocations.find((l) => l.isDefault) || outletKemang.storageLocations[0];
  const locTebet = outletTebet.storageLocations.find((l) => l.isDefault) || outletTebet.storageLocations[0];
  const locPancoran = outletPancoran.storageLocations.find((l) => l.isDefault) || outletPancoran.storageLocations[0];

  console.log(`📍 Lokasi Terdeteksi:
  - Gudang: ${locGudang.name} (${locGudang.id})
  - Kemang: ${locKemang.name} (${locKemang.id})
  - Tebet: ${locTebet.name} (${locTebet.id})
  - Pancoran: ${locPancoran.name} (${locPancoran.id})`);

  // ========================================================
  // 1. MASTER BAHAN BAKU (Lengkap untuk Coffee, Bakery & Resto)
  // ========================================================
  const ingredientsData = [
    // Existing Ingredients (update/ensure)
    { itemCode: 'RAW-COFFEE-01', name: 'Biji Kopi Espresso Blend (House Blend)', uom: 'GRAM', cost: 220, reorder: 500, outlets: ['kemang', 'gudang'] },
    { itemCode: 'RAW-MILK-01', name: 'Susu Sapi Segar Pasteurised (Fresh Milk)', uom: 'ML', cost: 20, reorder: 2000, outlets: ['kemang', 'tebet', 'gudang'] },
    { itemCode: 'RAW-SYRUP-01', name: 'Sirup Gula Aren Organik', uom: 'ML', cost: 35, reorder: 1000, outlets: ['kemang', 'pancoran', 'gudang'] },
    { itemCode: 'PKG-CUP-16', name: 'Cup Plastik 16oz + Tutup Lid', uom: 'PCS', cost: 650, reorder: 100, outlets: ['kemang', 'pancoran', 'gudang'] },
    { itemCode: 'PKG-STRAW-01', name: 'Sedotan Higienis Ramah Lingkungan', uom: 'PCS', cost: 150, reorder: 200, outlets: ['kemang', 'pancoran', 'gudang'] },
    { itemCode: 'RAW-FLOUR-01', name: 'Tepung Terigu Protein Tinggi (Japan Grade)', uom: 'GRAM', cost: 18, reorder: 2000, outlets: ['tebet', 'gudang'] },
    { itemCode: 'RAW-BUTTER-01', name: 'French Unsalted Butter Premium', uom: 'GRAM', cost: 160, reorder: 1000, outlets: ['tebet', 'gudang'] },
    { itemCode: 'RAW-YEAST-01', name: 'Ragi Instan & Gula Halus Baker', uom: 'GRAM', cost: 25, reorder: 500, outlets: ['tebet', 'gudang'] },
    { itemCode: 'PKG-BAG-01', name: 'Kantong Kertas Pastry Brown Kraft', uom: 'PCS', cost: 400, reorder: 100, outlets: ['tebet', 'pancoran', 'gudang'] },
    { itemCode: 'RAW-CHICKEN-01', name: 'Daging Ayam Potong Marinasi (Dada/Paha)', uom: 'PCS', cost: 9500, reorder: 50, outlets: ['pancoran', 'gudang'] },
    { itemCode: 'RAW-FLOUR-CHX', name: 'Tepung Bumbu Crispy Rahasia Ura', uom: 'GRAM', cost: 30, reorder: 2000, outlets: ['pancoran', 'gudang'] },
    { itemCode: 'RAW-OIL-01', name: 'Minyak Goreng Kelapa Sawit Super', uom: 'ML', cost: 18, reorder: 5000, outlets: ['pancoran', 'gudang'] },
    { itemCode: 'RAW-RICE-01', name: 'Beras Pulen Cianjur (Porsi Nasi)', uom: 'GRAM', cost: 15, reorder: 5000, outlets: ['pancoran', 'gudang'] },
    { itemCode: 'PKG-BOX-01', name: 'Kotak Box Makanan Fried Chicken Ura', uom: 'PCS', cost: 800, reorder: 100, outlets: ['pancoran', 'gudang'] },

    // Additional Ingredients for the 15 F&B menus
    { itemCode: 'RAW-CARAMEL-01', name: 'Sirup Karamel Vanila Artisan', uom: 'ML', cost: 45, reorder: 1000, outlets: ['kemang', 'gudang'] },
    { itemCode: 'RAW-MATCHA-01', name: 'Bubuk Matcha Murni Uji Kyoto', uom: 'GRAM', cost: 180, reorder: 500, outlets: ['kemang', 'gudang'] },
    { itemCode: 'RAW-EARL-01', name: 'Daun Teh Hitam Earl Grey Bergamot', uom: 'GRAM', cost: 80, reorder: 500, outlets: ['kemang', 'pancoran', 'gudang'] },
    { itemCode: 'RAW-CHOC-01', name: 'Bubuk Kakao Dark Chocolate Belgia', uom: 'GRAM', cost: 120, reorder: 1000, outlets: ['kemang', 'tebet', 'gudang'] },
    { itemCode: 'RAW-LEMON-01', name: 'Sari Jeruk Lemon Segar Alami', uom: 'ML', cost: 30, reorder: 1000, outlets: ['kemang', 'pancoran', 'gudang'] },
    { itemCode: 'RAW-CHOC-BAR', name: 'Dark Chocolate Couverture Batons 65%', uom: 'GRAM', cost: 150, reorder: 1000, outlets: ['tebet', 'gudang'] },
    { itemCode: 'RAW-ALMOND-01', name: 'Irisan Almond Panggang Gurih', uom: 'GRAM', cost: 200, reorder: 500, outlets: ['tebet', 'gudang'] },
    { itemCode: 'RAW-CINNAMON-01', name: 'Bubuk Kayu Manis Ceylan & Brown Sugar', uom: 'GRAM', cost: 75, reorder: 500, outlets: ['tebet', 'gudang'] },
    { itemCode: 'RAW-CHEESE-01', name: 'Cream Cheese & Racikan Bawang Putih', uom: 'GRAM', cost: 110, reorder: 1000, outlets: ['tebet', 'gudang'] },
    { itemCode: 'RAW-CHILLI-01', name: 'Cabe Rawit Merah & Bumbu Sambal Ura', uom: 'GRAM', cost: 65, reorder: 1000, outlets: ['pancoran', 'gudang'] },
    { itemCode: 'RAW-WINGS-01', name: 'Sayap Ayam Potong Segar Marinasi', uom: 'PCS', cost: 2500, reorder: 100, outlets: ['pancoran', 'gudang'] },
    { itemCode: 'RAW-FRIES-01', name: 'Kentang Beku Shoestring Impor Renyah', uom: 'GRAM', cost: 35, reorder: 5000, outlets: ['pancoran', 'gudang'] },
  ];

  const ingredientMap = new Map<string, string>(); // code -> id

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

    // Pastikan saldo fisik (InventoryBalance) tersedia di lokasi terkait
    const targetLocations: Array<{ locId: string; initialQty: number }> = [];

    // Gudang selalu dapat stok besar (5x - 10x)
    targetLocations.push({ locId: locGudang.id, initialQty: ing.uom === 'PCS' ? 1000 : 25000 });

    if (ing.outlets.includes('kemang')) {
      targetLocations.push({ locId: locKemang.id, initialQty: ing.uom === 'PCS' ? 500 : 5000 });
    }
    if (ing.outlets.includes('tebet')) {
      targetLocations.push({ locId: locTebet.id, initialQty: ing.uom === 'PCS' ? 500 : 10000 });
    }
    if (ing.outlets.includes('pancoran')) {
      targetLocations.push({ locId: locPancoran.id, initialQty: ing.uom === 'PCS' ? 500 : 15000 });
    }

    for (const tl of targetLocations) {
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
        tl.locId,
        tl.initialQty
      );
    }
  }

  console.log(`✅ Berhasil menyelaraskan ${ingredientMap.size} Master Bahan Baku & Stok Fisik Dapur.`);

  // ========================================================
  // 2. SPESIFIKASI FORMULA RESEP (BOM) 15 MENU F&B
  // ========================================================
  const fnbRecipes: Record<string, {
    instructions: string;
    items: Array<{ code: string; qty: number; ratio?: number }>;
  }> = {
    // --- URA COFFEE (Kemang) ---
    'FNB-COF-002': { // Americano Iced Double Shot
      instructions: 'Grind 20g biji espresso house blend, ekstraksi 40ml double shot espresso, tambahkan air dingin dan es batu di cup 16oz.',
      items: [
        { code: 'RAW-COFFEE-01', qty: 20 },
        { code: 'PKG-CUP-16', qty: 1 },
        { code: 'PKG-STRAW-01', qty: 1 },
      ],
    },
    'FNB-COF-003': { // Caramel Macchiato Creamy
      instructions: 'Ekstraksi 18g espresso, tuangkan 25ml sirup karamel, 150ml susu segar steam dingin, tutup dengan caramel drizzle.',
      items: [
        { code: 'RAW-COFFEE-01', qty: 18 },
        { code: 'RAW-MILK-01', qty: 150 },
        { code: 'RAW-CARAMEL-01', qty: 25 },
        { code: 'PKG-CUP-16', qty: 1 },
        { code: 'PKG-STRAW-01', qty: 1 },
      ],
    },
    'FNB-COF-004': { // Matcha Latte Uji Kyoto
      instructions: 'Larutkan 20g bubuk matcha Uji Kyoto dengan 30ml air hangat, campur 160ml fresh milk dan 15ml aren syrup, sajikan dengan es.',
      items: [
        { code: 'RAW-MATCHA-01', qty: 20 },
        { code: 'RAW-MILK-01', qty: 160 },
        { code: 'RAW-SYRUP-01', qty: 15 },
        { code: 'PKG-CUP-16', qty: 1 },
        { code: 'PKG-STRAW-01', qty: 1 },
      ],
    },
    'FNB-COF-005': { // Earl Grey Milk Tea
      instructions: 'Seduh 10g daun teh Earl Grey pekat, campurkan 140ml fresh milk dan 20ml sirup aren, kocok dengan es batu.',
      items: [
        { code: 'RAW-EARL-01', qty: 10 },
        { code: 'RAW-MILK-01', qty: 140 },
        { code: 'RAW-SYRUP-01', qty: 20 },
        { code: 'PKG-CUP-16', qty: 1 },
        { code: 'PKG-STRAW-01', qty: 1 },
      ],
    },
    'FNB-COF-006': { // Chocolate Signature Ice
      instructions: 'Larutkan 30g bubuk cokelat Belgia murni, padukan dengan 150ml fresh milk creamy dan 15ml aren syrup.',
      items: [
        { code: 'RAW-CHOC-01', qty: 30 },
        { code: 'RAW-MILK-01', qty: 150 },
        { code: 'RAW-SYRUP-01', qty: 15 },
        { code: 'PKG-CUP-16', qty: 1 },
        { code: 'PKG-STRAW-01', qty: 1 },
      ],
    },

    // --- URA BAKERY (Tebet) ---
    'FNB-BAK-002': { // Pain Au Chocolat French
      instructions: 'Laminasi adonan croissant dengan mentega Prancis, masukkan 2 batang dark chocolate batons, panggang 180C 20 menit.',
      items: [
        { code: 'RAW-FLOUR-01', qty: 75 },
        { code: 'RAW-BUTTER-01', qty: 40 },
        { code: 'RAW-YEAST-01', qty: 10 },
        { code: 'RAW-CHOC-BAR', qty: 25 },
        { code: 'PKG-BAG-01', qty: 1 },
      ],
    },
    'FNB-BAK-003': { // Almond Croissant Deluxe
      instructions: 'Belah croissant matang, oleskan krim almond lembut, taburkan 20g irisan almond panggang di atasnya, bakar ulang.',
      items: [
        { code: 'RAW-FLOUR-01', qty: 80 },
        { code: 'RAW-BUTTER-01', qty: 45 },
        { code: 'RAW-YEAST-01', qty: 10 },
        { code: 'RAW-ALMOND-01', qty: 20 },
        { code: 'PKG-BAG-01', qty: 1 },
      ],
    },
    'FNB-BAK-004': { // Cinnamon Roll Glaze
      instructions: 'Gulung adonan roti dengan campuran gula aren dan bubuk kayu manis, panggang hingga harum, beri vanila glaze.',
      items: [
        { code: 'RAW-FLOUR-01', qty: 85 },
        { code: 'RAW-BUTTER-01', qty: 35 },
        { code: 'RAW-YEAST-01', qty: 15 },
        { code: 'RAW-CINNAMON-01', qty: 15 },
        { code: 'PKG-BAG-01', qty: 1 },
      ],
    },
    'FNB-BAK-005': { // Sourdough Loaf Artisanal
      instructions: 'Fermentasi lambat 24 jam tepung gandum dan ragi alami, bentuk bulat loaf berkerak renyah, panggang dalam oven batu.',
      items: [
        { code: 'RAW-FLOUR-01', qty: 250 },
        { code: 'RAW-YEAST-01', qty: 15 },
        { code: 'PKG-BAG-01', qty: 1 },
      ],
    },
    'FNB-BAK-006': { // Garlic Cream Cheese Bun
      instructions: 'Roti bun lembut dibelah enam bintang, diisi cream cheese manis gurih, dicelup mentega bawang putih harum.',
      items: [
        { code: 'RAW-FLOUR-01', qty: 90 },
        { code: 'RAW-BUTTER-01', qty: 30 },
        { code: 'RAW-CHEESE-01', qty: 45 },
        { code: 'PKG-BAG-01', qty: 1 },
      ],
    },

    // --- URA FRIED CHICKEN (Pancoran) ---
    'FNB-CHK-002': { // Paket Ura Fried Chicken 2
      instructions: 'Paha atas ayam marinasi dibalut tepung bumbu krispi, goreng 12 menit 165C, sajikan dengan 150g nasi putih hangat dan es teh.',
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
    'FNB-CHK-003': { // Paket Spicy Geprek Ura
      instructions: 'Ayam krispi digeprek bersama 30g sambal cabe rawit merah segar, sajikan dengan 150g nasi hangat dalam box ramah lingkungan.',
      items: [
        { code: 'RAW-CHICKEN-01', qty: 1 },
        { code: 'RAW-FLOUR-CHX', qty: 50 },
        { code: 'RAW-OIL-01', qty: 45 },
        { code: 'RAW-RICE-01', qty: 150 },
        { code: 'RAW-CHILLI-01', qty: 30 },
        { code: 'PKG-BOX-01', qty: 1 },
      ],
    },
    'FNB-CHK-004': { // Ura Crispy Chicken Wings
      instructions: '6 potong sayap ayam renyah digoreng keemasan, disajikan bersama taburan 25g sambal matah rempah wangi.',
      items: [
        { code: 'RAW-WINGS-01', qty: 6 },
        { code: 'RAW-FLOUR-CHX', qty: 60 },
        { code: 'RAW-OIL-01', qty: 50 },
        { code: 'RAW-CHILLI-01', qty: 25 },
        { code: 'PKG-BOX-01', qty: 1 },
      ],
    },
    'FNB-CHK-005': { // French Fries Large Crispy
      instructions: 'Goreng 200g kentang beku shoestring selama 3.5 menit suhu 175C, tiriskan dan taburi sea salt gurih, masukkan kantong.',
      items: [
        { code: 'RAW-FRIES-01', qty: 200 },
        { code: 'RAW-OIL-01', qty: 50 },
        { code: 'PKG-BAG-01', qty: 1 },
      ],
    },
    'FNB-CHK-006': { // Es Lemon Tea Segar Jumbo
      instructions: 'Seduh 8g teh hitam berkualitas, tambahkan 35ml perasan lemon segar dan 25ml sirup gula aren di cup 16oz berisi es batu penuh.',
      items: [
        { code: 'RAW-EARL-01', qty: 8 },
        { code: 'RAW-LEMON-01', qty: 35 },
        { code: 'RAW-SYRUP-01', qty: 25 },
        { code: 'PKG-CUP-16', qty: 1 },
        { code: 'PKG-STRAW-01', qty: 1 },
      ],
    },
  };

  // ========================================================
  // 3. ATTACH RESEP BOM KE VARIANT PRODUK TERKAIT
  // ========================================================
  let attachedCount = 0;

  for (const [sku, formula] of Object.entries(fnbRecipes)) {
    const variant = await prisma.productVariant.findUnique({
      where: {
        tenantId_sku: {
          tenantId: tenant.id,
          sku,
        },
      },
      include: {
        product: true,
      },
    });

    if (!variant) {
      console.warn(`⚠️ Variant dengan SKU ${sku} tidak ditemukan! Lewati.`);
      continue;
    }

    // Pastikan produk bertipe COMPOSITE dan variant tidak punya inventoryItemId sintesis
    await prisma.product.update({
      where: { id: variant.productId },
      data: { type: ProductType.COMPOSITE },
    });

    await prisma.productVariant.update({
      where: { id: variant.id },
      data: { inventoryItemId: null },
    });

    // Buat atau update Recipe
    const recipe = await prisma.recipe.upsert({
      where: { productVariantId: variant.id },
      update: {
        instructions: formula.instructions,
        yieldQuantity: new Prisma.Decimal(1.0),
      },
      create: {
        tenantId: tenant.id,
        productVariantId: variant.id,
        instructions: formula.instructions,
        yieldQuantity: new Prisma.Decimal(1.0),
      },
    });

    // Hapus recipe items lama agar bersih
    await prisma.recipeItem.deleteMany({
      where: { recipeId: recipe.id },
    });

    // Masukkan recipe items baru
    for (const it of formula.items) {
      const invItemId = ingredientMap.get(it.code);
      if (!invItemId) {
        console.error(`❌ Bahan baku ${it.code} tidak ditemukan di map!`);
        continue;
      }

      await prisma.recipeItem.create({
        data: {
          tenantId: tenant.id,
          recipeId: recipe.id,
          inventoryItemId: invItemId,
          quantity: new Prisma.Decimal(it.qty),
          costRatio: new Prisma.Decimal(it.ratio || 1.0),
        },
      });
    }

    attachedCount++;
    console.log(`   ✨ Resep Berhasil Dipasang: [${sku}] ${variant.product.name} (${formula.items.length} Komponen Bahan)`);
  }

  console.log(`\n🎉 Selesai! Sebanyak ${attachedCount} menu F&B kini memiliki Resep BOM resmi, terhubung ke Bahan Baku Dapur, dan siap dipotong otomatis saat transaksi kasir!`);
}

main()
  .catch((e) => {
    console.error('❌ Gagal menjalankan perbaikan resep:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
