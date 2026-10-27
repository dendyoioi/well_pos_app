import { PrismaClient, Prisma, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Memulai pembuatan Dummy Modifier & Transaksi Ura Coffee Kemang (BSK-4305001)...');

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

  // 4. Siapkan Modifier Groups & Items
  console.log('📦 Menyiapkan Modifier Groups & Items...');

  const modifierDefinitions = [
    {
      name: 'Level Gula',
      minSelection: 0,
      maxSelection: 1,
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
      items: [
        { name: 'Fresh Milk Sapi', priceAdjustment: 0, isDefault: true },
        { name: 'Oatmilk Premium (Oatside)', priceAdjustment: 6000, isDefault: false },
        { name: 'Almond Milk Barista', priceAdjustment: 8000, isDefault: false },
        { name: 'Soy Milk Kedelai', priceAdjustment: 5000, isDefault: false },
      ]
    },
    {
      name: 'Topping & Ekstra',
      minSelection: 0,
      maxSelection: 5,
      items: [
        { name: 'Extra Espresso Shot', priceAdjustment: 5000, isDefault: false },
        { name: 'Boba Brown Sugar', priceAdjustment: 4000, isDefault: false },
        { name: 'Grass Jelly (Cincau)', priceAdjustment: 3500, isDefault: false },
        { name: 'Coffee Jelly', priceAdjustment: 4000, isDefault: false },
        { name: 'Cheese Foam Macchiato', priceAdjustment: 6000, isDefault: false },
        { name: 'Caramel Drizzle Sauce', priceAdjustment: 3000, isDefault: false },
      ]
    },
    {
      name: 'Level Es & Suhu',
      minSelection: 0,
      maxSelection: 1,
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
      items: groupItems
    });
  }

  console.log(`✅ ${createdGroups.length} Modifier Groups siap dengan total ${createdGroups.reduce((acc, g) => acc + g.items.length, 0)} items.`);

  // 5. Ambil Produk Minuman di Tenant dan Tautkan Modifier Groups
  const products = await prisma.product.findMany({
    where: { tenantId },
    include: { variants: true }
  });

  const beverageProducts = products.filter(p => {
    const n = p.name.toLowerCase();
    return n.includes('kopi') || n.includes('coffee') || n.includes('americano') || 
           n.includes('macchiato') || n.includes('tea') || n.includes('latte') || 
           n.includes('chocolate') || n.includes('lemon');
  });

  console.log(`🔗 Menautkan modifier ke ${beverageProducts.length} produk minuman...`);
  for (const prod of beverageProducts) {
    for (const grp of createdGroups) {
      const existing = await prisma.productModifierGroup.findUnique({
        where: {
          productId_modifierGroupId: {
            productId: prod.id,
            modifierGroupId: grp.id
          }
        }
      });
      if (!existing) {
        await prisma.productModifierGroup.create({
          data: {
            tenantId,
            productId: prod.id,
            modifierGroupId: grp.id
          }
        });
      }
    }

    // Tambahkan varian Large jika belum ada di Kopi Susu Aren Ura
    if (prod.name.toLowerCase().includes('kopi susu aren')) {
      const hasLarge = prod.variants.some(v => v.name.toLowerCase().includes('large'));
      if (!hasLarge) {
        const baseVariant = prod.variants[0];
        const largeSku = `${baseVariant.sku || 'URA-KPS'}-LRG`;
        const existingSku = await prisma.productVariant.findFirst({
          where: { tenantId, sku: largeSku }
        });
        if (!existingSku) {
          const lrg = await prisma.productVariant.create({
            data: {
              tenantId,
              productId: prod.id,
              name: 'Large 22oz',
              sku: largeSku,
              price: new Prisma.Decimal(28000),
              inventoryQuantityMultiplier: new Prisma.Decimal(1.35)
            }
          });
          prod.variants.push(lrg);
          console.log(`   ✨ Ditambahkan varian Large 22oz pada ${prod.name}`);
        }
      }
    }
  }

  // 6. Buat Transaksi Dummy dari 1 Okt 2026 sampai 26 Okt 2026
  console.log('📅 Memulai pembuatan Transaksi dari 1 Oktober 2026 s.d 26 Oktober 2026...');

  // Hapus transaksi lama di Kemang khusus rentang 1 Okt - 26 Okt agar tidak duplikat jika re-run
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
    console.log(`🧹 Membersihkan ${existingOrders.length} order dummy sebelumnya pada periode 1 - 26 Okt 2026...`);
    const ids = existingOrders.map(o => o.id);
    await prisma.paymentTransaction.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
  }

  // Siapkan data katalog lengkap untuk di-order
  const updatedBeverages = await prisma.product.findMany({
    where: { tenantId, id: { in: beverageProducts.map(p => p.id) } },
    include: { variants: true }
  });

  const bakeryProducts = products.filter(p => {
    const n = p.name.toLowerCase();
    return n.includes('croissant') || n.includes('chocolat') || n.includes('roll') || n.includes('bun');
  });

  const sugarGroup = createdGroups.find(g => g.name === 'Level Gula')!;
  const milkGroup = createdGroups.find(g => g.name === 'Pilihan Susu')!;
  const toppingGroup = createdGroups.find(g => g.name === 'Topping & Ekstra')!;
  const iceGroup = createdGroups.find(g => g.name === 'Level Es & Suhu')!;

  let totalOrdersCreated = 0;
  let totalItemsCreated = 0;

  // Loop setiap hari: 1 Okt s.d 26 Okt 2026
  for (let day = 1; day <= 26; day++) {
    const dateStr = `2026-10-${day < 10 ? '0' + day : day}`;
    const dayDate = new Date(`${dateStr}T08:00:00+07:00`);

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

    // Jumlah order per hari: 4 s.d 7 order
    const ordersCountForDay = 4 + (day % 4);

    for (let ordIdx = 1; ordIdx <= ordersCountForDay; ordIdx++) {
      const hour = 8 + (ordIdx * 2); // 10:00, 12:00, 14:00, 16:00, 18:00, 20:00 WIB
      const minute = (day * 7 + ordIdx * 11) % 60;
      const orderTime = new Date(`${dateStr}T${hour < 10 ? '0' + hour : hour}:${minute < 10 ? '0' + minute : minute}:00+07:00`);
      const invNum = `INV/202610${day < 10 ? '0' + day : day}/KMG/${ordIdx < 10 ? '0' + ordIdx : ordIdx}`;

      // Variasi metode pembayaran
      let payMethod: 'CASH' | 'QRIS' | 'DEBIT_CARD' | 'BANK_TRANSFER' = 'CASH';
      const mPick = (day + ordIdx) % 10;
      if (mPick < 4) payMethod = 'CASH';
      else if (mPick < 8) payMethod = 'QRIS';
      else if (mPick === 8) payMethod = 'DEBIT_CARD';
      else payMethod = 'BANK_TRANSFER';

      // Buat items untuk order ini (1 sampai 3 items)
      const itemCount = 1 + ((day + ordIdx) % 3);
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

      for (let i = 0; i < itemCount; i++) {
        // Ambil produk minuman
        const prod = updatedBeverages[(day + ordIdx + i) % updatedBeverages.length];
        const isLarge = (ordIdx + i) % 3 === 0 && prod.variants.length > 1;
        const variant = isLarge ? prod.variants[1] : prod.variants[0];

        // Tentukan modifiers
        const itemMods: Array<{ id: string; name: string; price_adjustment: number; group_name: string }> = [];

        // Sugar mod
        const sugarPick = sugarGroup.items[(ordIdx + i) % sugarGroup.items.length];
        itemMods.push({
          id: sugarPick.id,
          name: sugarPick.name,
          price_adjustment: sugarPick.priceAdjustment,
          group_name: sugarGroup.name
        });

        // Ice mod
        const icePick = iceGroup.items[(day + i) % iceGroup.items.length];
        itemMods.push({
          id: icePick.id,
          name: icePick.name,
          price_adjustment: icePick.priceAdjustment,
          group_name: iceGroup.name
        });

        // Susu / Dairy mod (opsional)
        if ((day + ordIdx + i) % 2 === 0) {
          const milkPick = milkGroup.items[(day + ordIdx) % milkGroup.items.length];
          itemMods.push({
            id: milkPick.id,
            name: milkPick.name,
            price_adjustment: milkPick.priceAdjustment,
            group_name: milkGroup.name
          });
        }

        // Topping mod (opsional)
        if ((ordIdx + i) % 2 === 1) {
          const topPick = toppingGroup.items[(day * 2 + i) % toppingGroup.items.length];
          itemMods.push({
            id: topPick.id,
            name: topPick.name,
            price_adjustment: topPick.priceAdjustment,
            group_name: toppingGroup.name
          });
        }

        // Hitung total unit price (base variant price + sum modifier adjustments)
        const basePrice = Number(variant.price);
        const modAdjustments = itemMods.reduce((sum, m) => sum + m.price_adjustment, 0);
        const finalUnitPrice = basePrice + modAdjustments;

        // Catatan pesanan opsional
        let itemNote: string | undefined = undefined;
        if ((ordIdx + i) % 4 === 0) itemNote = 'Less sweet ya kak';
        else if ((ordIdx + i) % 5 === 0) itemNote = 'Take away pisah es';
        else if ((ordIdx + i) % 7 === 0) itemNote = 'Extra panas / hot';

        itemsData.push({
          productName: prod.name,
          variantName: variant.name,
          variantId: variant.id,
          sku: variant.sku || 'SKU-001',
          unitPrice: finalUnitPrice,
          quantity: 1 + ((ordIdx + i) % 2), // 1 atau 2 cup
          notes: itemNote,
          modifiers: itemMods
        });
      }

      // Tambahkan item bakery sekali-kali
      if (bakeryProducts.length > 0 && ordIdx % 2 === 0) {
        const bakery = bakeryProducts[day % bakeryProducts.length];
        const v = bakery.variants[0];
        itemsData.push({
          productName: bakery.name,
          variantName: v?.name || 'Standard',
          variantId: v?.id || '',
          sku: v?.sku || 'BAK-001',
          unitPrice: Number(v?.price || 25000),
          quantity: 1,
          notes: 'Tolong dihangatkan crispy',
          modifiers: []
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
          tableNumber: `Meja 0${1 + (ordIdx % 6)}`,
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
      // Cek apakah split payment
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

  console.log(`🎉 SUKSES! Berhasil membuat ${totalOrdersCreated} order dengan total ${totalItemsCreated} item terjual.`);
  console.log('📊 Periode Transaksi: 01 Oktober 2026 s.d 26 Oktober 2026');
  console.log('📍 Lokasi: Ura Coffee - Kemang (Tenant Slug: BSK-4305001)');
}

main()
  .catch((e) => {
    console.error('❌ Gagal menjalankan seeder dummy modifier & transaksi:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
