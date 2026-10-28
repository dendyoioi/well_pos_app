import { PrismaClient, Prisma, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Memulai pembuatan Dummy Modifier & Transaksi General F&B Ura Coffee Kemang (BSK-4305001)...');

  // 1. Ambil Tenant BSK-4305001
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'BSK-4305001' },
    include: { outlets: true, users: true }
  });

  if (!tenant) {
    throw new Error('Tenant dengan slug BSK-4305001 tidak ditemukan!');
  }
  const tenantId = tenant.id;
  console.log(`✅ Tenant Ditemukan: ${tenant.name} (${tenant.slug}) - ID: ${tenantId}`);

  // 2. Ambil Outlet Ura Coffee Kemang
  const kemangOutlet = tenant.outlets.find(o => o.name.toLowerCase().includes('kemang'));
  if (!kemangOutlet) {
    throw new Error('Outlet Ura Coffee Kemang tidak ditemukan di tenant ini!');
  }
  const outletId = kemangOutlet.id;
  console.log(`✅ Outlet Ditemukan: ${kemangOutlet.name} - ID: ${outletId}`);

  // 3. Ambil Kasir Kemang
  let cashier = tenant.users.find(u => u.outletId === outletId && u.role === Role.CASHIER);
  if (!cashier) {
    cashier = tenant.users.find(u => u.role === Role.CASHIER) || tenant.users[0];
  }
  const cashierId = cashier.id;
  console.log(`✅ Kasir Ditemukan: ${cashier.name} (${cashier.email}) - ID: ${cashierId}`);

  // 4. Siapkan Modifier Groups & Items Lengkap untuk General F&B (Makanan, Pastry & Minuman)
  console.log('📦 Menyiapkan Modifier Groups & Items General F&B...');

  const modifierDefinitions = [
    // ── 1. MODIFIER MAKANAN (MEALS, CHICKEN, RICE & KITCHEN) ────────────
    {
      name: 'Level Pedas',
      minSelection: 0,
      maxSelection: 1,
      targetCategory: 'MEALS',
      items: [
        { name: 'Level 0 (Original Gurih)', priceAdjustment: 0, isDefault: true },
        { name: 'Level 1 (Pedas Sedang)', priceAdjustment: 0, isDefault: false },
        { name: 'Level 3 (Pedas Nampol)', priceAdjustment: 0, isDefault: false },
        { name: 'Level 5 (Super Pedas Extra Cabai)', priceAdjustment: 3000, isDefault: false },
      ]
    },
    {
      name: 'Pilihan Karbo & Nasi',
      minSelection: 0,
      maxSelection: 1,
      targetCategory: 'MEALS',
      items: [
        { name: 'Nasi Putih Pulen', priceAdjustment: 0, isDefault: true },
        { name: 'Nasi Daun Jeruk Gurih', priceAdjustment: 3000, isDefault: false },
        { name: 'French Fries Kentang', priceAdjustment: 5000, isDefault: false },
      ]
    },
    {
      name: 'Pilihan Saus & Sambal',
      minSelection: 0,
      maxSelection: 1,
      targetCategory: 'MEALS',
      items: [
        { name: 'Sambal Bawang Korek', priceAdjustment: 0, isDefault: true },
        { name: 'Sambal Matah Bali', priceAdjustment: 2000, isDefault: false },
        { name: 'Saus BBQ Gurih', priceAdjustment: 2000, isDefault: false },
        { name: 'Saus Keju Melted', priceAdjustment: 4000, isDefault: false },
      ]
    },
    {
      name: 'Topping & Ekstra Makanan',
      minSelection: 0,
      maxSelection: 4,
      targetCategory: 'MEALS',
      items: [
        { name: 'Extra Telur Ceplok', priceAdjustment: 4000, isDefault: false },
        { name: 'Extra Keju Mozzarella', priceAdjustment: 5000, isDefault: false },
        { name: 'Kerupuk Putih Gurih', priceAdjustment: 2000, isDefault: false },
        { name: 'Extra Sambal Cup', priceAdjustment: 2000, isDefault: false },
      ]
    },

    // ── 2. MODIFIER BAKERY & PASTRY ────────────────────────────────────
    {
      name: 'Sajian Pastry & Olesan',
      minSelection: 0,
      maxSelection: 3,
      targetCategory: 'PASTRY',
      items: [
        { name: 'Hangat / Di-toast Panas', priceAdjustment: 0, isDefault: true },
        { name: 'Suhu Ruang (Fresh)', priceAdjustment: 0, isDefault: false },
        { name: 'French Butter Anchor', priceAdjustment: 3000, isDefault: false },
        { name: 'Selai Strawberry', priceAdjustment: 2500, isDefault: false },
        { name: 'Nutella Spread Melted', priceAdjustment: 4000, isDefault: false },
      ]
    },

    // ── 3. MODIFIER MINUMAN (BEVERAGES & COFFEE) ──────────────────────
    {
      name: 'Level Gula',
      minSelection: 0,
      maxSelection: 1,
      targetCategory: 'BEVERAGE',
      items: [
        { name: 'Normal Sugar (100%)', priceAdjustment: 0, isDefault: true },
        { name: 'Less Sugar (50%)', priceAdjustment: 0, isDefault: false },
        { name: 'Slight Sugar (25%)', priceAdjustment: 0, isDefault: false },
        { name: 'No Sugar (0%)', priceAdjustment: 0, isDefault: false },
        { name: 'Extra Sugar', priceAdjustment: 2000, isDefault: false },
      ]
    },
    {
      name: 'Pilihan Susu',
      minSelection: 0,
      maxSelection: 1,
      targetCategory: 'BEVERAGE',
      items: [
        { name: 'Fresh Milk Sapi', priceAdjustment: 0, isDefault: true },
        { name: 'Oatmilk Premium (Oatside)', priceAdjustment: 6000, isDefault: false },
        { name: 'Almond Milk Barista', priceAdjustment: 8000, isDefault: false },
        { name: 'Soy Milk Kedelai', priceAdjustment: 5000, isDefault: false },
      ]
    },
    {
      name: 'Topping Minuman',
      minSelection: 0,
      maxSelection: 4,
      targetCategory: 'BEVERAGE',
      items: [
        { name: 'Boba Brown Sugar', priceAdjustment: 4000, isDefault: false },
        { name: 'Grass Jelly (Cincau)', priceAdjustment: 3500, isDefault: false },
        { name: 'Coffee Jelly', priceAdjustment: 4000, isDefault: false },
        { name: 'Cheese Foam Macchiato', priceAdjustment: 6000, isDefault: false },
        { name: 'Extra Espresso Shot', priceAdjustment: 5000, isDefault: false },
      ]
    },
    {
      name: 'Level Es & Suhu',
      minSelection: 0,
      maxSelection: 1,
      targetCategory: 'BEVERAGE',
      items: [
        { name: 'Normal Ice', priceAdjustment: 0, isDefault: true },
        { name: 'Less Ice', priceAdjustment: 0, isDefault: false },
        { name: 'No Ice', priceAdjustment: 0, isDefault: false },
        { name: 'Hot / Hangat', priceAdjustment: 0, isDefault: false },
      ]
    }
  ];

  const createdGroups: Array<{
    id: string;
    name: string;
    targetCategory: string;
    items: Array<{ id: string; name: string; priceAdjustment: number; groupName: string }>;
  }> = [];

  for (const def of modifierDefinitions) {
    let group = await prisma.modifierGroup.findFirst({
      where: { tenantId, name: def.name }
    });

    if (!group) {
      group = await prisma.modifierGroup.create({
        data: {
          tenantId,
          name: def.name,
          minSelection: def.minSelection,
          maxSelection: def.maxSelection
        }
      });
    }

    const groupItems: Array<{ id: string; name: string; priceAdjustment: number; groupName: string }> = [];

    for (const itemDef of def.items) {
      let mItem = await prisma.modifierItem.findFirst({
        where: { tenantId, modifierGroupId: group.id, name: itemDef.name }
      });

      if (!mItem) {
        mItem = await prisma.modifierItem.create({
          data: {
            tenantId,
            modifierGroupId: group.id,
            name: itemDef.name,
            priceAdjustment: new Prisma.Decimal(itemDef.priceAdjustment),
            isDefault: itemDef.isDefault
          }
        });
      }

      groupItems.push({
        id: mItem.id,
        name: mItem.name,
        priceAdjustment: itemDef.priceAdjustment,
        groupName: def.name
      });
    }

    createdGroups.push({
      id: group.id,
      name: group.name,
      targetCategory: def.targetCategory,
      items: groupItems
    });
  }

  console.log(`✅ ${createdGroups.length} Modifier Groups siap dengan total ${createdGroups.reduce((acc, g) => acc + g.items.length, 0)} items.`);

  // 5. Ambil Seluruh Produk di Tenant & Tambahkan Varian General F&B yang Lengkap
  const products = await prisma.product.findMany({
    where: { tenantId },
    include: { variants: true, category: true }
  });

  const mealsProducts = products.filter(p => {
    const n = p.name.toLowerCase();
    const c = (p.category?.name || '').toLowerCase();
    return c.includes('fried') || c.includes('meals') || n.includes('chicken') || n.includes('geprek') || n.includes('fries');
  });

  const bakeryProducts = products.filter(p => {
    const n = p.name.toLowerCase();
    const c = (p.category?.name || '').toLowerCase();
    return c.includes('bakery') || c.includes('pastry') || n.includes('croissant') || n.includes('chocolat') || n.includes('roll') || n.includes('bun') || n.includes('sourdough');
  });

  const beverageProducts = products.filter(p => {
    const n = p.name.toLowerCase();
    const c = (p.category?.name || '').toLowerCase();
    return c.includes('coffee') || c.includes('beverage') || n.includes('kopi') || n.includes('americano') || n.includes('macchiato') || n.includes('tea') || n.includes('latte') || n.includes('chocolate');
  });

  console.log(`📊 Terdeteksi: ${mealsProducts.length} Makanan, ${bakeryProducts.length} Pastry/Bakery, ${beverageProducts.length} Minuman.`);

  // Tambahkan varian porsi/tipe olahan pada makanan jika belum ada
  const fc1 = mealsProducts.find(p => p.name.includes('Fried Chicken 1'));
  if (fc1) {
    if (fc1.variants[0] && (fc1.variants[0].name === 'Regular' || fc1.variants[0].name === 'Default')) {
      await prisma.productVariant.update({
        where: { id: fc1.variants[0].id },
        data: { name: 'Porsi Regular (1 Ayam)' }
      });
      fc1.variants[0].name = 'Porsi Regular (1 Ayam)';
    }
    const hasJumbo = fc1.variants.some(v => v.name.toLowerCase().includes('jumbo'));
    if (!hasJumbo) {
      const jmb = await prisma.productVariant.create({
        data: {
          tenantId,
          productId: fc1.id,
          name: 'Porsi Jumbo (2 Ayam)',
          sku: `${fc1.variants[0]?.sku || 'URA-FC1'}-JMB`,
          price: new Prisma.Decimal(45000),
          inventoryQuantityMultiplier: new Prisma.Decimal(1.8)
        }
      });
      fc1.variants.push(jmb);
      console.log('   ✨ Ditambahkan varian Porsi Jumbo pada Paket Ura Fried Chicken 1');
    }
  }

  const geprek = mealsProducts.find(p => p.name.includes('Geprek'));
  if (geprek) {
    if (geprek.variants[0] && (geprek.variants[0].name === 'Regular' || geprek.variants[0].name === 'Default')) {
      await prisma.productVariant.update({
        where: { id: geprek.variants[0].id },
        data: { name: 'Paket Komplit (Nasi + Teh)' }
      });
      geprek.variants[0].name = 'Paket Komplit (Nasi + Teh)';
    }
    const hasAlaCarte = geprek.variants.some(v => v.name.toLowerCase().includes('ala carte'));
    if (!hasAlaCarte) {
      const alc = await prisma.productVariant.create({
        data: {
          tenantId,
          productId: geprek.id,
          name: 'Ala Carte (Ayam Saja)',
          sku: `${geprek.variants[0]?.sku || 'URA-GPK'}-ALC`,
          price: new Prisma.Decimal(20000),
          inventoryQuantityMultiplier: new Prisma.Decimal(0.75)
        }
      });
      geprek.variants.push(alc);
      console.log('   ✨ Ditambahkan varian Ala Carte pada Paket Spicy Geprek Ura');
    }
  }

  const fries = mealsProducts.find(p => p.name.includes('French Fries'));
  if (fries) {
    if (fries.variants[0] && (fries.variants[0].name === 'Regular' || fries.variants[0].name === 'Default')) {
      await prisma.productVariant.update({
        where: { id: fries.variants[0].id },
        data: { name: 'Medium 150g' }
      });
      fries.variants[0].name = 'Medium 150g';
    }
    const hasJumbo = fries.variants.some(v => v.name.toLowerCase().includes('jumbo'));
    if (!hasJumbo) {
      const jmb = await prisma.productVariant.create({
        data: {
          tenantId,
          productId: fries.id,
          name: 'Large Jumbo 250g',
          sku: `${fries.variants[0]?.sku || 'URA-FF'}-LRG`,
          price: new Prisma.Decimal(26000),
          inventoryQuantityMultiplier: new Prisma.Decimal(1.6)
        }
      });
      fries.variants.push(jmb);
      console.log('   ✨ Ditambahkan varian Large Jumbo 250g pada French Fries');
    }
  }

  // Tambahkan varian kemasan/porsi pada Bakery & Pastry jika belum ada
  const croissant = bakeryProducts.find(p => p.name.includes('Butter Croissant'));
  if (croissant) {
    if (croissant.variants[0] && (croissant.variants[0].name === 'Regular' || croissant.variants[0].name === 'Default')) {
      await prisma.productVariant.update({
        where: { id: croissant.variants[0].id },
        data: { name: 'Satuan (1 Pcs)' }
      });
      croissant.variants[0].name = 'Satuan (1 Pcs)';
    }
    const hasBox = croissant.variants.some(v => v.name.toLowerCase().includes('box'));
    if (!hasBox) {
      const box = await prisma.productVariant.create({
        data: {
          tenantId,
          productId: croissant.id,
          name: 'Box Hemat (Isi 3 Pcs)',
          sku: `${croissant.variants[0]?.sku || 'URA-BC'}-BOX3`,
          price: new Prisma.Decimal(65000),
          inventoryQuantityMultiplier: new Prisma.Decimal(3.0)
        }
      });
      croissant.variants.push(box);
      console.log('   ✨ Ditambahkan varian Box Hemat (Isi 3 Pcs) pada Butter Croissant');
    }
  }

  const cinnamon = bakeryProducts.find(p => p.name.includes('Cinnamon'));
  if (cinnamon) {
    if (cinnamon.variants[0] && (cinnamon.variants[0].name === 'Regular' || cinnamon.variants[0].name === 'Default')) {
      await prisma.productVariant.update({
        where: { id: cinnamon.variants[0].id },
        data: { name: 'Satuan (1 Pcs)' }
      });
      cinnamon.variants[0].name = 'Satuan (1 Pcs)';
    }
    const hasBox = cinnamon.variants.some(v => v.name.toLowerCase().includes('box'));
    if (!hasBox) {
      const box = await prisma.productVariant.create({
        data: {
          tenantId,
          productId: cinnamon.id,
          name: 'Box Party (Isi 4 Pcs)',
          sku: `${cinnamon.variants[0]?.sku || 'URA-CR'}-BOX4`,
          price: new Prisma.Decimal(80000),
          inventoryQuantityMultiplier: new Prisma.Decimal(4.0)
        }
      });
      cinnamon.variants.push(box);
      console.log('   ✨ Ditambahkan varian Box Party (Isi 4 Pcs) pada Cinnamon Roll');
    }
  }

  // Tambahkan varian ukuran pada minuman jika belum ada
  const kopiSusu = beverageProducts.find(p => p.name.toLowerCase().includes('kopi susu aren'));
  if (kopiSusu) {
    const hasLarge = kopiSusu.variants.some(v => v.name.toLowerCase().includes('large'));
    if (!hasLarge) {
      const lrg = await prisma.productVariant.create({
        data: {
          tenantId,
          productId: kopiSusu.id,
          name: 'Large 22oz',
          sku: `${kopiSusu.variants[0]?.sku || 'URA-KPS'}-LRG`,
          price: new Prisma.Decimal(28000),
          inventoryQuantityMultiplier: new Prisma.Decimal(1.35)
        }
      });
      kopiSusu.variants.push(lrg);
      console.log('   ✨ Ditambahkan varian Large 22oz pada Kopi Susu Aren Ura');
    }
  }

  // Tautkan Modifier Groups secara kontekstual:
  // Makanan -> Level Pedas, Karbo, Saus/Sambal, Topping Makanan
  const mealGroups = createdGroups.filter(g => g.targetCategory === 'MEALS');
  for (const prod of mealsProducts) {
    for (const grp of mealGroups) {
      await prisma.productModifierGroup.upsert({
        where: { productId_modifierGroupId: { productId: prod.id, modifierGroupId: grp.id } },
        update: {},
        create: { tenantId, productId: prod.id, modifierGroupId: grp.id }
      });
    }
  }

  // Pastry -> Sajian Pastry & Olesan
  const pastryGroups = createdGroups.filter(g => g.targetCategory === 'PASTRY');
  for (const prod of bakeryProducts) {
    for (const grp of pastryGroups) {
      await prisma.productModifierGroup.upsert({
        where: { productId_modifierGroupId: { productId: prod.id, modifierGroupId: grp.id } },
        update: {},
        create: { tenantId, productId: prod.id, modifierGroupId: grp.id }
      });
    }
  }

  // Minuman -> Gula, Es, Susu, Topping Minuman
  const beverageGroups = createdGroups.filter(g => g.targetCategory === 'BEVERAGE');
  for (const prod of beverageProducts) {
    for (const grp of beverageGroups) {
      await prisma.productModifierGroup.upsert({
        where: { productId_modifierGroupId: { productId: prod.id, modifierGroupId: grp.id } },
        update: {},
        create: { tenantId, productId: prod.id, modifierGroupId: grp.id }
      });
    }
  }
  console.log('🔗 Seluruh relasi Product Modifier Groups General F&B berhasil ditautkan.');

  // 6. Buat Transaksi Dummy dari 1 Okt 2026 sampai 26 Okt 2026
  console.log('📅 Memulai pembuatan Transaksi General F&B dari 1 Oktober 2026 s.d 26 Oktober 2026...');

  // Hapus transaksi lama di Kemang khusus rentang 1 Okt - 26 Okt agar bersih
  const existingOrders = await prisma.order.findMany({
    where: {
      tenantId,
      outletId,
      createdAt: {
        gte: new Date('2026-10-01T00:00:00+07:00'),
        lte: new Date('2026-10-26T23:59:59+07:00')
      }
    },
    select: { id: true }
  });

  if (existingOrders.length > 0) {
    console.log(`🧹 Membersihkan ${existingOrders.length} order dummy lama pada periode 1 - 26 Okt 2026...`);
    const ids = existingOrders.map(o => o.id);
    await prisma.paymentTransaction.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
  }

  // Ambil referensi grup modifier untuk penyusunan pesanan
  const pedasGroup = createdGroups.find(g => g.name === 'Level Pedas')!;
  const karboGroup = createdGroups.find(g => g.name === 'Pilihan Karbo & Nasi')!;
  const sausGroup = createdGroups.find(g => g.name === 'Pilihan Saus & Sambal')!;
  const topMakananGroup = createdGroups.find(g => g.name === 'Topping & Ekstra Makanan')!;

  const pastryOpsiGroup = createdGroups.find(g => g.name === 'Sajian Pastry & Olesan')!;

  const sugarGroup = createdGroups.find(g => g.name === 'Level Gula')!;
  const milkGroup = createdGroups.find(g => g.name === 'Pilihan Susu')!;
  const toppingMinumanGroup = createdGroups.find(g => g.name === 'Topping Minuman')!;
  const iceGroup = createdGroups.find(g => g.name === 'Level Es & Suhu')!;

  // Refresh produk dengan relasi variants terbaru
  const freshMeals = await prisma.product.findMany({
    where: { id: { in: mealsProducts.map(p => p.id) } },
    include: { variants: true }
  });
  const freshBeverages = await prisma.product.findMany({
    where: { id: { in: beverageProducts.map(p => p.id) } },
    include: { variants: true }
  });
  const freshPastries = await prisma.product.findMany({
    where: { id: { in: bakeryProducts.map(p => p.id) } },
    include: { variants: true }
  });

  let totalOrdersCreated = 0;
  let totalItemsCreated = 0;

  // Loop setiap hari: 1 Okt s.d 26 Okt 2026
  for (let day = 1; day <= 26; day++) {
    const dateStr = `2026-10-${day < 10 ? '0' + day : day}`;

    // Buat Shift kasir harian
    const shift = await prisma.shift.create({
      data: {
        tenantId,
        outletId,
        userId: cashierId,
        startTime: new Date(`${dateStr}T07:30:00+07:00`),
        endTime: new Date(`${dateStr}T21:30:00+07:00`),
        startingCash: new Prisma.Decimal(300000),
        status: 'CLOSED',
        notes: `Shift Kasir Kemang ${dateStr}`
      }
    });

    // Jumlah order per hari: 5 s.d 8 order
    const ordersCountForDay = 5 + (day % 4);

    for (let ordIdx = 1; ordIdx <= ordersCountForDay; ordIdx++) {
      const hour = 9 + Math.floor((ordIdx - 1) * 1.5); // 9 to 20 WIB
      const minute = (day * 9 + ordIdx * 13) % 60;
      const orderTime = new Date(`${dateStr}T${hour < 10 ? '0' + hour : hour}:${minute < 10 ? '0' + minute : minute}:00+07:00`);
      const invNum = `INV/202610${day < 10 ? '0' + day : day}/KMG/${ordIdx < 10 ? '0' + ordIdx : ordIdx}`;

      // Variasi metode pembayaran
      let payMethod: 'CASH' | 'QRIS' | 'DEBIT_CARD' | 'BANK_TRANSFER' = 'CASH';
      const mPick = (day + ordIdx) % 10;
      if (mPick < 4) payMethod = 'CASH';
      else if (mPick < 8) payMethod = 'QRIS';
      else if (mPick === 8) payMethod = 'DEBIT_CARD';
      else payMethod = 'BANK_TRANSFER';

      const itemsData: Array<{
        productName: string;
        variantName: string;
        variantId: string;
        sku: string;
        unitPrice: number;
        quantity: number;
        notes?: string;
        modifiers: Array<{ id: string; name: string; price_adjustment: number; group_name: string }>;
      }> = [];

      // ── KOMPONEN 1: ORDER MAKANAN UTAMA (65% Pesanan Membeli Makanan) ──
      if ((day + ordIdx) % 3 !== 0 && freshMeals.length > 0) {
        const mealProd = freshMeals[(day + ordIdx) % freshMeals.length];
        const isJumbo = (ordIdx + day) % 2 === 0 && mealProd.variants.length > 1;
        const mealVar = isJumbo ? mealProd.variants[1] : mealProd.variants[0];

        const mealMods: Array<{ id: string; name: string; price_adjustment: number; group_name: string }> = [];

        // Level Pedas
        const pedasPick = pedasGroup.items[(day + ordIdx) % pedasGroup.items.length];
        mealMods.push({
          id: pedasPick.id,
          name: pedasPick.name,
          price_adjustment: pedasPick.priceAdjustment,
          group_name: pedasGroup.name
        });

        // Pilihan Saus / Sambal
        const sausPick = sausGroup.items[(day * 2 + ordIdx) % sausGroup.items.length];
        mealMods.push({
          id: sausPick.id,
          name: sausPick.name,
          price_adjustment: sausPick.priceAdjustment,
          group_name: sausGroup.name
        });

        // Topping Makanan Ekstra (Extra Telur / Keju Mozzarella)
        if ((ordIdx + day) % 2 === 1) {
          const topMknPick = topMakananGroup.items[(day + ordIdx) % topMakananGroup.items.length];
          mealMods.push({
            id: topMknPick.id,
            name: topMknPick.name,
            price_adjustment: topMknPick.priceAdjustment,
            group_name: topMakananGroup.name
          });
        }

        // Pilihan Karbo (Khusus paket ayam)
        if (mealProd.name.includes('Paket')) {
          const karboPick = karboGroup.items[ordIdx % karboGroup.items.length];
          mealMods.push({
            id: karboPick.id,
            name: karboPick.name,
            price_adjustment: karboPick.priceAdjustment,
            group_name: karboGroup.name
          });
        }

        const basePrice = Number(mealVar.price);
        const modAdjustments = mealMods.reduce((sum, m) => sum + m.price_adjustment, 0);

        itemsData.push({
          productName: mealProd.name,
          variantName: mealVar.name,
          variantId: mealVar.id,
          sku: mealVar.sku || 'MEAL-001',
          unitPrice: basePrice + modAdjustments,
          quantity: 1 + (ordIdx % 2),
          notes: (ordIdx % 3 === 0) ? 'Tolong ayamnya bagian dada garing' : undefined,
          modifiers: mealMods
        });
      }

      // ── KOMPONEN 2: ORDER MINUMAN (85% Pesanan Membeli Minuman) ───────
      if (freshBeverages.length > 0) {
        const bevProd = freshBeverages[(day * 3 + ordIdx) % freshBeverages.length];
        const isLarge = (ordIdx + day) % 2 === 1 && bevProd.variants.length > 1;
        const bevVar = isLarge ? bevProd.variants[1] : bevProd.variants[0];

        const bevMods: Array<{ id: string; name: string; price_adjustment: number; group_name: string }> = [];

        // Level Gula
        const sugarPick = sugarGroup.items[(ordIdx + day) % sugarGroup.items.length];
        bevMods.push({
          id: sugarPick.id,
          name: sugarPick.name,
          price_adjustment: sugarPick.priceAdjustment,
          group_name: sugarGroup.name
        });

        // Level Es & Suhu
        const icePick = iceGroup.items[(day + ordIdx) % iceGroup.items.length];
        bevMods.push({
          id: icePick.id,
          name: icePick.name,
          price_adjustment: icePick.priceAdjustment,
          group_name: iceGroup.name
        });

        // Pilihan Susu (untuk kopi/latte)
        if (bevProd.name.toLowerCase().includes('kopi') || bevProd.name.toLowerCase().includes('latte')) {
          if ((day + ordIdx) % 2 === 0) {
            const milkPick = milkGroup.items[(day + ordIdx) % milkGroup.items.length];
            bevMods.push({
              id: milkPick.id,
              name: milkPick.name,
              price_adjustment: milkPick.priceAdjustment,
              group_name: milkGroup.name
            });
          }
        }

        // Topping Minuman (Boba, Grass Jelly, Cheese Foam)
        if ((ordIdx + day) % 2 === 0) {
          const topBevPick = toppingMinumanGroup.items[(day * 2 + ordIdx) % toppingMinumanGroup.items.length];
          bevMods.push({
            id: topBevPick.id,
            name: topBevPick.name,
            price_adjustment: topBevPick.priceAdjustment,
            group_name: toppingMinumanGroup.name
          });
        }

        const basePrice = Number(bevVar.price);
        const modAdjustments = bevMods.reduce((sum, m) => sum + m.price_adjustment, 0);

        itemsData.push({
          productName: bevProd.name,
          variantName: bevVar.name,
          variantId: bevVar.id,
          sku: bevVar.sku || 'BEV-001',
          unitPrice: basePrice + modAdjustments,
          quantity: 1 + ((ordIdx + day) % 2),
          notes: (ordIdx % 4 === 0) ? 'Takeaway cup terpisah es' : undefined,
          modifiers: bevMods
        });
      }

      // ── KOMPONEN 3: ORDER PASTRY / DESSERT (40% Pesanan Membeli Pastry) ─
      if ((day + ordIdx) % 2 === 0 && freshPastries.length > 0) {
        const pastProd = freshPastries[(day + ordIdx) % freshPastries.length];
        const isBox = (day + ordIdx) % 3 === 0 && pastProd.variants.length > 1;
        const pastVar = isBox ? pastProd.variants[1] : pastProd.variants[0];

        const pastMods: Array<{ id: string; name: string; price_adjustment: number; group_name: string }> = [];

        // Sajian Hangat / Di-toast & Olesan Selai/Butter
        const pModPick1 = pastryOpsiGroup.items[(day + ordIdx) % 2]; // Hangat / Suhu Ruang
        pastMods.push({
          id: pModPick1.id,
          name: pModPick1.name,
          price_adjustment: pModPick1.priceAdjustment,
          group_name: pastryOpsiGroup.name
        });

        if (ordIdx % 2 === 1) {
          const pModPick2 = pastryOpsiGroup.items[2 + (day % 3)]; // Butter / Selai / Nutella
          pastMods.push({
            id: pModPick2.id,
            name: pModPick2.name,
            price_adjustment: pModPick2.priceAdjustment,
            group_name: pastryOpsiGroup.name
          });
        }

        const basePrice = Number(pastVar.price);
        const modAdjustments = pastMods.reduce((sum, m) => sum + m.price_adjustment, 0);

        itemsData.push({
          productName: pastProd.name,
          variantName: pastVar.name,
          variantId: pastVar.id,
          sku: pastVar.sku || 'BAK-001',
          unitPrice: basePrice + modAdjustments,
          quantity: 1,
          notes: 'Tolong dihangatkan crispy',
          modifiers: pastMods
        });
      }

      // Hitung subtotal & total order
      const subtotal = itemsData.reduce((sum, it) => sum + (it.unitPrice * it.quantity), 0);
      const totalAmount = subtotal;

      // Buat Order
      const createdOrder = await prisma.order.create({
        data: {
          tenantId,
          outletId,
          shiftId: shift.id,
          userId: cashierId,
          invoiceNumber: invNum,
          orderStatus: 'COMPLETED',
          paymentStatus: 'PAID',
          orderType: 'DINE_IN',
          channel: 'DINE_IN',
          tableNumber: `Meja 0${1 + (ordIdx % 8)}`,
          queueNumber: ordIdx,
          subtotal: new Prisma.Decimal(subtotal),
          totalAmount: new Prisma.Decimal(totalAmount),
          paidAmount: new Prisma.Decimal(totalAmount),
          changeAmount: new Prisma.Decimal(0),
          createdAt: orderTime,
          updatedAt: orderTime
        }
      });

      // Buat Order Items
      for (const it of itemsData) {
        await prisma.orderItem.create({
          data: {
            tenantId,
            orderId: createdOrder.id,
            productVariantId: it.variantId || undefined,
            productName: it.productName,
            variantName: it.variantName,
            sku: it.sku,
            quantity: it.quantity,
            unitPrice: new Prisma.Decimal(it.unitPrice),
            subtotal: new Prisma.Decimal(it.unitPrice * it.quantity),
            notes: it.notes || null,
            modifiersSnapshot: it.modifiers.length > 0 ? (it.modifiers as any) : Prisma.JsonNull
          }
        });
        totalItemsCreated += it.quantity;
      }

      // Buat Payment Transaction
      const isSplit = ordIdx === 3 && day % 3 === 0;
      if (isSplit) {
        const half1 = Math.floor(totalAmount / 2);
        const half2 = totalAmount - half1;
        await prisma.paymentTransaction.create({
          data: {
            tenantId,
            orderId: createdOrder.id,
            paymentMethod: 'CASH',
            amount: new Prisma.Decimal(half1),
            status: 'CAPTURED',
            paidAt: orderTime,
            createdAt: orderTime
          }
        });
        await prisma.paymentTransaction.create({
          data: {
            tenantId,
            orderId: createdOrder.id,
            paymentMethod: 'QRIS',
            amount: new Prisma.Decimal(half2),
            status: 'CAPTURED',
            paidAt: orderTime,
            createdAt: orderTime
          }
        });
      } else {
        await prisma.paymentTransaction.create({
          data: {
            tenantId,
            orderId: createdOrder.id,
            paymentMethod: payMethod,
            amount: new Prisma.Decimal(totalAmount),
            status: 'CAPTURED',
            paidAt: orderTime,
            createdAt: orderTime
          }
        });
      }

      totalOrdersCreated++;
    }
  }

  console.log(`🎉 SUKSES BESAR! Berhasil membuat ${totalOrdersCreated} order General F&B dengan total ${totalItemsCreated} item terjual.`);
  console.log('📊 Mencakup: Makanan Utama (Pedas, Karbo, Saus, Telur/Keju), Pastry (Toast, Butter, Selai), dan Minuman (Gula, Es, Susu, Topping).');
  console.log('📍 Lokasi: Ura Coffee - Kemang (Tenant Slug: BSK-4305001)');
}

main()
  .catch((e) => {
    console.error('❌ Gagal menjalankan seeder dummy modifier & transaksi:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
