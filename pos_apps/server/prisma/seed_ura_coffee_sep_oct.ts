import { PrismaClient, PaymentMethod, ShiftStatus, OrderStatus, PaymentStatus, Role } from '@prisma/client';

const prisma = new PrismaClient();

const TENANT_ID = 'd8ea88b6-e85c-4c9b-8bfd-2414b591d5ec'; // Ura Coffee & Roastery
const OUTLET_KEMANG = 'd135ef0a-6d68-4b98-87ea-56eb73e672e0'; // Ura Coffee - Flagship Kemang
const OUTLET_SUDIRMAN = '06b5a388-b2cf-4cee-a55a-7514b33b578c'; // Ura Coffee - Express Sudirman

// Cashiers
const CASHIER_RIAN = 'bcff77cf-789b-4c81-8e52-d6661125c5a4'; // Rian Kasir Kemang
const CASHIER_SITI = '21691c57-2d9d-4758-a0f8-acebe05aaacf'; // Siti Kasir Kemang
const CASHIER_FAJAR = '33333333-4444-5555-6666-777777777777'; // Fajar Kasir Kemang (Kasir baru di Kemang!)
const CASHIER_DENI = 'fc7195ed-6909-4ede-bf32-968060b0d171'; // Deni Kasir Sudirman

async function main() {
  console.log('--- Mulai Seeding Transaksi & Shift Ura Coffee (1 Sep - 7 Okt 2026) ---');

  // 1. Pastikan seluruh kasir terdaftar secara resmi dengan role CASHIER di outlet masing-masing
  const defaultPassHash = '$2a$10$w0Bv4t5L8Yd3dE37c7h9jOJ46r2ZkVf9PzS7yA3M3K6bB8C8Q9Oqe'; // Password123!
  const defaultPinHash = '$2a$10$w0Bv4t5L8Yd3dE37c7h9jOJ46r2ZkVf9PzS7yA3M3K6bB8C8Q9Oqe'; // 123456

  await prisma.user.upsert({
    where: { id: CASHIER_RIAN },
    update: { name: 'Rian Kasir Kemang', role: Role.CASHIER, outletId: OUTLET_KEMANG, isActive: true },
    create: {
      id: CASHIER_RIAN,
      tenantId: TENANT_ID,
      outletId: OUTLET_KEMANG,
      userCode: '10001',
      name: 'Rian Kasir Kemang',
      email: 'kasir@uracoffee.id',
      passwordHash: defaultPassHash,
      pinHash: defaultPinHash,
      role: Role.CASHIER,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { id: CASHIER_SITI },
    update: { name: 'Siti Kasir Kemang', role: Role.CASHIER, outletId: OUTLET_KEMANG, isActive: true },
    create: {
      id: CASHIER_SITI,
      tenantId: TENANT_ID,
      outletId: OUTLET_KEMANG,
      userCode: '10002',
      name: 'Siti Kasir Kemang',
      email: 'siti.kasir@uracoffee.id',
      passwordHash: defaultPassHash,
      pinHash: defaultPinHash,
      role: Role.CASHIER,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { id: CASHIER_FAJAR },
    update: { name: 'Fajar Kasir Kemang', role: Role.CASHIER, outletId: OUTLET_KEMANG, isActive: true },
    create: {
      id: CASHIER_FAJAR,
      tenantId: TENANT_ID,
      outletId: OUTLET_KEMANG,
      userCode: '10005',
      name: 'Fajar Kasir Kemang',
      email: 'fajar.kasir@uracoffee.id',
      passwordHash: defaultPassHash,
      pinHash: defaultPinHash,
      role: Role.CASHIER,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { id: CASHIER_DENI },
    update: { name: 'Deni Kasir Sudirman', role: Role.CASHIER, outletId: OUTLET_SUDIRMAN, isActive: true },
    create: {
      id: CASHIER_DENI,
      tenantId: TENANT_ID,
      outletId: OUTLET_SUDIRMAN,
      userCode: '10003',
      name: 'Deni Kasir Sudirman',
      email: 'kasir.sudirman@uracoffee.id',
      passwordHash: defaultPassHash,
      pinHash: defaultPinHash,
      role: Role.CASHIER,
      isActive: true,
    },
  });

  console.log('✅ Akun Kasir Ura Coffee terverifikasi (Rian, Siti, Fajar di Kemang & Deni di Sudirman)');

  // 2. Pastikan kategori dan produk tersedia
  let catBeverage = await prisma.category.findFirst({
    where: { tenantId: TENANT_ID, name: 'Beverages' },
  });
  if (!catBeverage) {
    const existingCat = await prisma.category.findFirst({ where: { tenantId: TENANT_ID } });
    catBeverage = existingCat;
  }

  const categoryId = catBeverage
    ? catBeverage.id
    : (
        await prisma.category.create({
          data: {
            tenantId: TENANT_ID,
            name: 'Beverages',
            slug: 'beverages',
          },
        })
      ).id;

  const targetProducts = [
    { name: 'esteh', basePrice: 1000, sku: 'SKU-ESTEH' },
    { name: 'jeruk', basePrice: 1000, sku: 'SKU-JERUK' },
    { name: 'kopi', basePrice: 800, sku: 'SKU-KOPI' },
    { name: 'coklat', basePrice: 1500, sku: 'SKU-COKLAT' },
    { name: 'Kopi Susu Aren Ura', basePrice: 18000, sku: 'SKU-KOPISUSU' },
    { name: 'Americano Signature', basePrice: 15000, sku: 'SKU-AMERICANO' },
  ];

  const productMap: Record<string, { id: string; variantId: string }> = {};

  for (const tp of targetProducts) {
    let prod = await prisma.product.findFirst({
      where: { tenantId: TENANT_ID, name: { equals: tp.name, mode: 'insensitive' } },
      include: { variants: true },
    });

    if (!prod) {
      prod = await prisma.product.create({
        data: {
          tenantId: TENANT_ID,
          categoryId: categoryId,
          name: tp.name,
          sku: tp.sku,
          unit: 'CUP',
          variants: {
            create: {
              tenantId: TENANT_ID,
              name: 'Reguler',
              sku: `${tp.sku}-REG`,
              price: tp.basePrice,
            },
          },
        },
        include: { variants: true },
      });
    }

    let variantId = prod.variants[0]?.id;
    if (!variantId) {
      const v = await prisma.productVariant.create({
        data: {
          tenantId: TENANT_ID,
          productId: prod.id,
          name: 'Reguler',
          sku: `${tp.sku}-REG`,
          price: tp.basePrice,
        },
      });
      variantId = v.id;
    }

    productMap[tp.name.toLowerCase()] = { id: prod.id, variantId };

    for (const outId of [OUTLET_KEMANG, OUTLET_SUDIRMAN]) {
      const existingOutletProd = await prisma.outletProduct.findUnique({
        where: { outletId_productId: { outletId: outId, productId: prod.id } },
      });
      if (!existingOutletProd) {
        await prisma.outletProduct.create({
          data: {
            tenantId: TENANT_ID,
            outletId: outId,
            productId: prod.id,
            isAvailable: true,
          },
        });
      }
    }
  }

  // 3. Bersihkan transaksi lama di rentang 1 Sep - 7 Okt 2026 agar bersih dan tidak dobel
  console.log('🧹 Membersihkan transaksi lama periode 1 Sep - 7 Okt 2026...');
  const rangeStart = new Date(Date.UTC(2026, 8, 1, 0, 0, 0));
  const rangeEnd = new Date(Date.UTC(2026, 9, 7, 23, 59, 59));

  await prisma.paymentTransaction.deleteMany({
    where: {
      tenantId: TENANT_ID,
      createdAt: { gte: rangeStart, lte: rangeEnd },
    },
  });

  await prisma.orderItem.deleteMany({
    where: {
      tenantId: TENANT_ID,
      order: {
        tenantId: TENANT_ID,
        createdAt: { gte: rangeStart, lte: rangeEnd },
      },
    },
  });

  await prisma.order.deleteMany({
    where: {
      tenantId: TENANT_ID,
      createdAt: { gte: rangeStart, lte: rangeEnd },
    },
  });

  await prisma.shift.deleteMany({
    where: {
      tenantId: TENANT_ID,
      startTime: { gte: rangeStart, lte: rangeEnd },
    },
  });

  console.log('✅ Pembersihan selesai. Mulai generate data baru...');

  // 4. Generate shift dan transaksi untuk setiap hari (1 Sep 2026 s/d 7 Okt 2026 = 37 hari)
  let invoiceCounter = 1;
  let totalKemangOrders = 0;
  let totalSudirmanOrders = 0;

  for (let day = 1; day <= 37; day++) {
    let dateObj: Date;
    let isOct7 = false;

    if (day <= 30) {
      dateObj = new Date(Date.UTC(2026, 8, day)); // September 1-30
    } else {
      const octDay = day - 30;
      dateObj = new Date(Date.UTC(2026, 9, octDay)); // Oktober 1-7
      if (octDay === 7) isOct7 = true;
    }

    const y = dateObj.getUTCFullYear();
    const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getUTCDate()).padStart(2, '0');
    const dateStr = `${y}${m}${d}`;

    // Setiap hari di Outlet Kemang ada 2 kasir bertugas bergantian:
    // Shift 1: Rian Kasir Kemang (Pagi: 08:00 - 15:00)
    // Shift 2: Fajar Kasir Kemang (Sore: 15:00 - 22:00)
    // Shift 3 (opsional setiap 3 hari): Siti Kasir Kemang
    const kemangShifts = [
      { cashierId: CASHIER_RIAN, name: 'Rian Kasir Kemang', startHour: 8, endHour: 15, shiftType: 'Pagi' },
      { cashierId: CASHIER_FAJAR, name: 'Fajar Kasir Kemang', startHour: 15, endHour: 22, shiftType: 'Sore' },
    ];
    if (day % 3 === 0 || isOct7) {
      kemangShifts.push({ cashierId: CASHIER_SITI, name: 'Siti Kasir Kemang', startHour: 11, endHour: 19, shiftType: 'Middle' });
    }

    // Shift di Sudirman: Deni Kasir Sudirman
    const sudirmanShifts = [
      { cashierId: CASHIER_DENI, name: 'Deni Kasir Sudirman', startHour: 9, endHour: 17, shiftType: 'Pagi' },
    ];

    // Proses Outlet Kemang
    for (const s of kemangShifts) {
      const shiftStart = new Date(Date.UTC(y, dateObj.getUTCMonth(), dateObj.getUTCDate(), s.startHour, 0, 0));
      const shiftEnd = new Date(Date.UTC(y, dateObj.getUTCMonth(), dateObj.getUTCDate(), s.endHour, 0, 0));
      const startingCash = 200000;
      let expectedCash = startingCash;

      const shift = await prisma.shift.create({
        data: {
          tenantId: TENANT_ID,
          outletId: OUTLET_KEMANG,
          userId: s.cashierId,
          startTime: shiftStart,
          endTime: shiftEnd,
          startingCash,
          expectedEnding: startingCash,
          status: ShiftStatus.CLOSED,
          notes: `Shift ${s.shiftType} ${s.name} - ${dateStr}`,
        },
      });

      // Transaksi 7 Oktober Rian: Masukkan data audit khusus
      if (isOct7 && s.cashierId === CASHIER_RIAN) {
        // Cash order 115.000: esteh 17, jeruk 58, kopi 50
        const orderCashTime = new Date(Date.UTC(y, dateObj.getUTCMonth(), dateObj.getUTCDate(), 10, 15, 0));
        const cashInvoice = `INV/${dateStr}/KMG/${String(invoiceCounter++).padStart(4, '0')}`;
        await prisma.order.create({
          data: {
            tenantId: TENANT_ID,
            outletId: OUTLET_KEMANG,
            shiftId: shift.id,
            userId: s.cashierId,
            invoiceNumber: cashInvoice,
            orderStatus: OrderStatus.COMPLETED,
            paymentStatus: PaymentStatus.PAID,
            orderType: 'DINE_IN',
            channel: 'DINE_IN',
            subtotal: 115000,
            discountTotal: 0,
            taxTotal: 0,
            totalAmount: 115000,
            paidAmount: 115000,
            changeAmount: 0,
            createdAt: orderCashTime,
            items: {
              create: [
                {
                  tenantId: TENANT_ID,
                  productVariantId: productMap['esteh'].variantId,
                  productName: 'esteh',
                  quantity: 17,
                  unitPrice: 1000,
                  subtotal: 17000,
                },
                {
                  tenantId: TENANT_ID,
                  productVariantId: productMap['jeruk'].variantId,
                  productName: 'jeruk',
                  quantity: 58,
                  unitPrice: 1000,
                  subtotal: 58000,
                },
                {
                  tenantId: TENANT_ID,
                  productVariantId: productMap['kopi'].variantId,
                  productName: 'kopi',
                  quantity: 50,
                  unitPrice: 800,
                  subtotal: 40000,
                },
              ],
            },
            payments: {
              create: [
                {
                  tenantId: TENANT_ID,
                  paymentMethod: PaymentMethod.CASH,
                  amount: 115000,
                  status: 'CAPTURED',
                  paidAt: orderCashTime,
                  createdAt: orderCashTime,
                },
              ],
            },
          },
        });
        expectedCash += 115000;
        totalKemangOrders++;

        // QRIS order 59.000: jeruk 5, coklat 16, esteh 81
        const orderQrisTime = new Date(Date.UTC(y, dateObj.getUTCMonth(), dateObj.getUTCDate(), 11, 45, 0));
        const qrisInvoice = `INV/${dateStr}/KMG/${String(invoiceCounter++).padStart(4, '0')}`;
        await prisma.order.create({
          data: {
            tenantId: TENANT_ID,
            outletId: OUTLET_KEMANG,
            shiftId: shift.id,
            userId: s.cashierId,
            invoiceNumber: qrisInvoice,
            orderStatus: OrderStatus.COMPLETED,
            paymentStatus: PaymentStatus.PAID,
            orderType: 'TAKEAWAY',
            channel: 'TAKEAWAY',
            subtotal: 59000,
            discountTotal: 0,
            taxTotal: 0,
            totalAmount: 59000,
            paidAmount: 59000,
            changeAmount: 0,
            createdAt: orderQrisTime,
            items: {
              create: [
                {
                  tenantId: TENANT_ID,
                  productVariantId: productMap['jeruk'].variantId,
                  productName: 'jeruk',
                  quantity: 5,
                  unitPrice: 1000,
                  subtotal: 5000,
                },
                {
                  tenantId: TENANT_ID,
                  productVariantId: productMap['coklat'].variantId,
                  productName: 'coklat',
                  quantity: 16,
                  unitPrice: 1500,
                  subtotal: 24000,
                },
                {
                  tenantId: TENANT_ID,
                  productVariantId: productMap['esteh'].variantId,
                  productName: 'esteh',
                  quantity: 81,
                  unitPrice: 1000,
                  subtotal: 81000,
                },
              ],
            },
            payments: {
              create: [
                {
                  tenantId: TENANT_ID,
                  paymentMethod: PaymentMethod.QRIS,
                  amount: 59000,
                  status: 'CAPTURED',
                  paidAt: orderQrisTime,
                  createdAt: orderQrisTime,
                },
              ],
            },
          },
        });
        totalKemangOrders++;
      } else {
        // Transaksi reguler (2-4 pesanan per shift)
        const orderCount = 2 + (day % 3);
        for (let t = 0; t < orderCount; t++) {
          const isCash = (t + day) % 2 === 0;
          const txTime = new Date(Date.UTC(y, dateObj.getUTCMonth(), dateObj.getUTCDate(), s.startHour + 1 + t, 20, 0));
          const invoiceNo = `INV/${dateStr}/KMG/${String(invoiceCounter++).padStart(4, '0')}`;

          const qtyAmericano = 1 + (t % 3);
          const qtyKopiSusu = 2 + ((day + t) % 3);
          const subtotal = qtyAmericano * 15000 + qtyKopiSusu * 18000;

          await prisma.order.create({
            data: {
              tenantId: TENANT_ID,
              outletId: OUTLET_KEMANG,
              shiftId: shift.id,
              userId: s.cashierId,
              invoiceNumber: invoiceNo,
              orderStatus: OrderStatus.COMPLETED,
              paymentStatus: PaymentStatus.PAID,
              orderType: t % 2 === 0 ? 'DINE_IN' : 'TAKEAWAY',
              channel: t % 2 === 0 ? 'DINE_IN' : 'TAKEAWAY',
              subtotal,
              discountTotal: 0,
              taxTotal: 0,
              totalAmount: subtotal,
              paidAmount: subtotal,
              changeAmount: 0,
              createdAt: txTime,
              items: {
                create: [
                  {
                    tenantId: TENANT_ID,
                    productVariantId: productMap['americano signature'].variantId,
                    productName: 'Americano Signature',
                    quantity: qtyAmericano,
                    unitPrice: 15000,
                    subtotal: qtyAmericano * 15000,
                  },
                  {
                    tenantId: TENANT_ID,
                    productVariantId: productMap['kopi susu aren ura'].variantId,
                    productName: 'Kopi Susu Aren Ura',
                    quantity: qtyKopiSusu,
                    unitPrice: 18000,
                    subtotal: qtyKopiSusu * 18000,
                  },
                ],
              },
              payments: {
                create: [
                  {
                    tenantId: TENANT_ID,
                    paymentMethod: isCash ? PaymentMethod.CASH : PaymentMethod.QRIS,
                    amount: subtotal,
                    status: 'CAPTURED',
                    paidAt: txTime,
                    createdAt: txTime,
                  },
                ],
              },
            },
          });

          if (isCash) expectedCash += subtotal;
          totalKemangOrders++;
        }
      }

      await prisma.shift.update({
        where: { id: shift.id },
        data: {
          expectedEnding: expectedCash,
          actualEnding: expectedCash,
          cashDifference: 0,
        },
      });
    }

    // Proses Outlet Sudirman (Deni Kasir)
    for (const s of sudirmanShifts) {
      const shiftStart = new Date(Date.UTC(y, dateObj.getUTCMonth(), dateObj.getUTCDate(), s.startHour, 0, 0));
      const shiftEnd = new Date(Date.UTC(y, dateObj.getUTCMonth(), dateObj.getUTCDate(), s.endHour, 0, 0));
      const startingCash = 200000;
      let expectedCash = startingCash;

      const shift = await prisma.shift.create({
        data: {
          tenantId: TENANT_ID,
          outletId: OUTLET_SUDIRMAN,
          userId: s.cashierId,
          startTime: shiftStart,
          endTime: shiftEnd,
          startingCash,
          expectedEnding: startingCash,
          status: ShiftStatus.CLOSED,
          notes: `Shift ${s.shiftType} ${s.name} - ${dateStr}`,
        },
      });

      const orderCount = 2 + ((day + 1) % 2);
      for (let t = 0; t < orderCount; t++) {
        const isCash = t % 2 === 0;
        const txTime = new Date(Date.UTC(y, dateObj.getUTCMonth(), dateObj.getUTCDate(), s.startHour + 1 + t, 30, 0));
        const invoiceNo = `INV/${dateStr}/SDR/${String(invoiceCounter++).padStart(4, '0')}`;
        const qtyKopiSusu = 2 + (t % 2);
        const subtotal = qtyKopiSusu * 18000;

        await prisma.order.create({
          data: {
            tenantId: TENANT_ID,
            outletId: OUTLET_SUDIRMAN,
            shiftId: shift.id,
            userId: s.cashierId,
            invoiceNumber: invoiceNo,
            orderStatus: OrderStatus.COMPLETED,
            paymentStatus: PaymentStatus.PAID,
            orderType: 'TAKEAWAY',
            channel: 'TAKEAWAY',
            subtotal,
            discountTotal: 0,
            taxTotal: 0,
            totalAmount: subtotal,
            paidAmount: subtotal,
            changeAmount: 0,
            createdAt: txTime,
            items: {
              create: [
                {
                  tenantId: TENANT_ID,
                  productVariantId: productMap['kopi susu aren ura'].variantId,
                  productName: 'Kopi Susu Aren Ura',
                  quantity: qtyKopiSusu,
                  unitPrice: 18000,
                  subtotal,
                },
              ],
            },
            payments: {
              create: [
                {
                  tenantId: TENANT_ID,
                  paymentMethod: isCash ? PaymentMethod.CASH : PaymentMethod.QRIS,
                  amount: subtotal,
                  status: 'CAPTURED',
                  paidAt: txTime,
                  createdAt: txTime,
                },
              ],
            },
          },
        });

        if (isCash) expectedCash += subtotal;
        totalSudirmanOrders++;
      }

      await prisma.shift.update({
        where: { id: shift.id },
        data: {
          expectedEnding: expectedCash,
          actualEnding: expectedCash,
          cashDifference: 0,
        },
      });
    }
  }

  console.log('🎉 Seeding transaksi selesai sempurna!');
  console.log(`- Total Faktur Outlet Kemang (Rian, Siti, Fajar): ${totalKemangOrders}`);
  console.log(`- Total Faktur Outlet Sudirman (Deni): ${totalSudirmanOrders}`);
  console.log(`- Total Keseluruhan Faktur: ${invoiceCounter - 1}`);
}

main()
  .catch((e) => {
    console.error('Error seeding Ura Coffee:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
