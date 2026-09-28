import { PrismaClient, PaymentMethod, PaymentTxStatus, OrderStatus, PaymentStatus, ShiftStatus, StockMovementType, InventoryRefType, ActorType } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Parse CLI arguments
const isCleanOnly = process.argv.includes('--clean') || process.argv.includes('--rollback');
const daysArg = process.argv.find((a) => a.startsWith('--days='));
const TOTAL_DAYS = daysArg ? parseInt(daysArg.split('=')[1], 10) : 3; // Default 3 hari untuk preflight

async function main() {
  console.log('================================================================');
  console.log('🚀 SIMULATOR TRANSAKSI OPERASIONAL HARIAN (SEPTEMBER 2026)');
  console.log('================================================================');

  // 1. Dapatkan tenant Ura Corporation
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'ura-corporation' },
    include: {
      outlets: {
        where: { isActive: true },
        include: {
          storageLocations: true,
          outletProducts: {
            where: { isAvailable: true },
            include: {
              product: {
                include: {
                  category: true,
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
          },
        },
      },
      users: {
        where: { isActive: true },
      },
    },
  });

  if (!tenant) {
    console.error('❌ Tenant "ura-corporation" tidak ditemukan! Jalankan seed Ura Corp terlebih dahulu.');
    process.exit(1);
  }

  console.log(`🏢 Tenant: ${tenant.name} (${tenant.id})`);

  // Cari Gudang Pusat
  const warehouse = tenant.outlets.find((o) => o.isWarehouse);
  const stores = tenant.outlets.filter((o) => !o.isWarehouse);

  console.log(`🏭 Gudang Pasokan: ${warehouse ? warehouse.name : 'Tidak Ada'}`);
  console.log(`🏪 Unit Toko Cabang: ${stores.length} toko (${stores.map((s) => s.name).join(', ')})`);

  // ============================================================================
  // BAGIAN A: FUNGSI ROLLBACK / PEMBERSIHAN (CLEANUP)
  // ============================================================================
  console.log('\n🧹 Memeriksa & Membersihkan Dummy Transaksi September Sebelumnya...');

  // Hapus payment transactions September
  const deletedPayments = await prisma.paymentTransaction.deleteMany({
    where: {
      tenantId: tenant.id,
      order: {
        invoiceNumber: { startsWith: 'INV-URA-202609' },
      },
    },
  });

  // Hapus order items September
  const deletedOrderItems = await prisma.orderItem.deleteMany({
    where: {
      tenantId: tenant.id,
      order: {
        invoiceNumber: { startsWith: 'INV-URA-202609' },
      },
    },
  });

  // Hapus orders September
  const deletedOrders = await prisma.order.deleteMany({
    where: {
      tenantId: tenant.id,
      invoiceNumber: { startsWith: 'INV-URA-202609' },
    },
  });

  // Hapus shifts September
  const deletedShifts = await prisma.shift.deleteMany({
    where: {
      tenantId: tenant.id,
      notes: { contains: '[DUMMY-SEPTEMBER-2026]' },
    },
  });

  // Hapus inventory ledgers dari order September
  const deletedLedgers = await prisma.inventoryLedger.deleteMany({
    where: {
      tenantId: tenant.id,
      referenceType: InventoryRefType.ORDER,
      notes: { contains: 'INV-URA-202609' },
    },
  });

  console.log(`   ✅ Selesai Dihapus: ${deletedOrders.count} order, ${deletedOrderItems.count} items, ${deletedPayments.count} payments, ${deletedShifts.count} shifts, ${deletedLedgers.count} ledgers.`);

  if (isCleanOnly) {
    console.log('\n✨ Database kembali bersih (Zero Dirty State). Rollback berhasil.');
    return;
  }

  // ============================================================================
  // BAGIAN B: GENERATOR DUMMY TRANSAKSI REALISTIS
  // ============================================================================
  console.log(`\n📦 Memulai Pembuatan Transaksi untuk ${TOTAL_DAYS} Hari (1 s.d ${TOTAL_DAYS} September 2026)...`);

  // Siapkan Data Pelanggan CRM jika belum ada
  const existingCustomers = await prisma.customer.findMany({ where: { tenantId: tenant.id } });
  let customers = existingCustomers;
  if (customers.length === 0) {
    console.log('   👤 Membuat 4 Profil Pelanggan Demo (CRM Member)...');
    const demoCustomers = [
      { name: 'Dimas Pratama', phone: '+6281288880001', email: 'dimas.pratama@gmail.com' },
      { name: 'Anisa Rahmawati', phone: '+6281288880002', email: 'anisa.rahma@gmail.com' },
      { name: 'Bayu Wicaksono', phone: '+6281288880003', email: 'bayu.wicaksono@gmail.com' },
      { name: 'Citra Kirana', phone: '+6281288880004', email: 'citra.kirana@gmail.com' },
    ];
    for (const c of demoCustomers) {
      const created = await prisma.customer.create({
        data: {
          tenantId: tenant.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
        },
      });
      customers.push(created);
    }
  }

  let totalOrdersCreated = 0;
  let totalOrderItemsCreated = 0;
  let totalShiftsCreated = 0;
  let sumGrossSales = 0;
  let sumDiscount = 0;
  let sumNetSales = 0;
  let sumTax = 0;
  let sumService = 0;
  let sumPayments = 0;

  // Loop setiap hari
  for (let day = 1; day <= TOTAL_DAYS; day++) {
    const dayStr = day.toString().padStart(2, '0');
    const datePrefix = `2026-09-${dayStr}`;

    for (const store of stores) {
      // Tentukan kasir bertugas
      const cashier = tenant.users.find((u) => u.outletId === store.id && u.role === 'CASHIER') || tenant.users[0];
      const defaultLoc = store.storageLocations[0];
      const whLoc = warehouse?.storageLocations[0] || defaultLoc;

      // Ambil katalog produk aktif yang dialokasikan ke toko ini
      const storeProducts = store.outletProducts.map((op) => op.product).filter(Boolean);
      if (storeProducts.length === 0) continue;

      // Buat 2 Sesi Shift Kasir per hari: Pagi (08:00 - 15:00) & Sore (15:00 - 22:00)
      const shiftsConfig = [
        { name: 'Shift Pagi', startHour: 8, endHour: 15, ordersCount: Math.floor(6 + (day % 3) * 2) },
        { name: 'Shift Sore', startHour: 15, endHour: 22, ordersCount: Math.floor(7 + (day % 4) * 2) },
      ];

      for (const sc of shiftsConfig) {
        const shiftStartTime = new Date(`${datePrefix}T${sc.startHour.toString().padStart(2, '0')}:00:00.000+07:00`);
        const shiftEndTime = new Date(`${datePrefix}T${sc.endHour.toString().padStart(2, '0')}:00:00.000+07:00`);
        const startingCash = 200000; // Modal kasir awal Rp 200.000

        // Buat record shift
        const shift = await prisma.shift.create({
          data: {
            tenantId: tenant.id,
            outletId: store.id,
            userId: cashier.id,
            startTime: shiftStartTime,
            endTime: shiftEndTime,
            startingCash,
            status: ShiftStatus.CLOSED,
            notes: `Sesi Kasir ${sc.name} [DUMMY-SEPTEMBER-2026]`,
            createdAt: shiftStartTime,
            updatedAt: shiftEndTime,
          },
        });
        totalShiftsCreated++;

        let shiftCashReceived = 0;

        // Buat pesanan-pesanan dalam shift ini
        for (let oIdx = 1; oIdx <= sc.ordersCount; oIdx++) {
          const minuteOffset = Math.floor((oIdx / (sc.ordersCount + 1)) * (sc.endHour - sc.startHour) * 60);
          const orderTime = new Date(shiftStartTime.getTime() + minuteOffset * 60 * 1000);

          const invSequence = (day * 1000 + totalOrdersCreated + 1).toString().padStart(5, '0');
          const invoiceNumber = `INV-URA-202609${dayStr}-${invSequence}`;

          // Tentukan kanal penjualan:
          // 40% Dine In, 25% Takeaway, 10% Delivery Internal, 12% GoFood, 8% GrabFood, 5% ShopeeFood
          const randChannel = Math.random();
          let channel = 'DINE_IN';
          let orderType = 'DINE_IN';
          let tableNumber = `Meja ${Math.floor(1 + Math.random() * 12).toString().padStart(2, '0')}`;

          if (randChannel < 0.40) {
            channel = 'DINE_IN';
            orderType = 'DINE_IN';
            tableNumber = `Meja ${Math.floor(1 + Math.random() * 12).toString().padStart(2, '0')}`;
          } else if (randChannel < 0.65) {
            channel = 'TAKEAWAY';
            orderType = 'TAKEAWAY';
            tableNumber = 'Bawa Pulang (Takeaway)';
          } else if (randChannel < 0.75) {
            channel = 'DELIVERY';
            orderType = 'DELIVERY';
            tableNumber = 'Kurir Toko (Internal)';
          } else if (randChannel < 0.87) {
            channel = 'GOFOOD';
            orderType = 'DELIVERY';
            tableNumber = `GoFood #${Math.floor(1000 + Math.random() * 9000)}`;
          } else if (randChannel < 0.95) {
            channel = 'GRABFOOD';
            orderType = 'DELIVERY';
            tableNumber = `GrabFood #${Math.floor(1000 + Math.random() * 9000)}`;
          } else {
            channel = 'SHOPEEFOOD';
            orderType = 'DELIVERY';
            tableNumber = `ShopeeFood #${Math.floor(1000 + Math.random() * 9000)}`;
          }

          // Pilih 1 s.d 3 produk berdasarkan distribusi Pareto (Best Seller / Menu Terlaris)
          const itemsToPick: typeof storeProducts = [];
          const pickCount = Math.random() < 0.50 ? 1 : Math.random() < 0.85 ? 2 : 3;

          const getWeightedProduct = () => {
            const r = Math.random();
            if (r < 0.38) return storeProducts[0]; // 38% Hero / Best Seller
            if (r < 0.62 && storeProducts.length > 1) return storeProducts[1]; // 24% Runner-up
            if (r < 0.78 && storeProducts.length > 2) return storeProducts[2]; // 16% Favorite
            if (r < 0.88 && storeProducts.length > 3) return storeProducts[3]; // 10% Mid
            if (r < 0.95 && storeProducts.length > 4) return storeProducts[4]; // 7% Niche
            return storeProducts[storeProducts.length - 1]; // 5% Long tail
          };

          const pickedIds = new Set<string>();
          for (let pIdx = 0; pIdx < pickCount; pIdx++) {
            const candidate = getWeightedProduct();
            if (!pickedIds.has(candidate.id)) {
              pickedIds.add(candidate.id);
              itemsToPick.push(candidate);
            }
          }
          if (itemsToPick.length === 0) itemsToPick.push(storeProducts[0]);

          let subtotal = 0;
          let totalCost = 0;
          const orderItemsData: any[] = [];

          for (const prod of itemsToPick) {
            const variant = prod.variants[0];
            const qty = Math.floor(1 + Math.random() * 2);
            const unitPrice = Number(variant.price);
            const itemSubtotal = unitPrice * qty;

            // Hitung estimasi HPP dari bahan baku resep BOM atau margin standar 42%
            let itemCostPrice = 0;
            if (variant.recipe && variant.recipe.items.length > 0) {
              for (const ri of variant.recipe.items) {
                itemCostPrice += Number(ri.quantity) * Number(ri.inventoryItem?.averageCost || 0);
              }
            }
            if (itemCostPrice <= 0) {
              itemCostPrice = Math.round(unitPrice * 0.42); // Default HPP 42%
            }

            subtotal += itemSubtotal;
            totalCost += itemCostPrice * qty;

            orderItemsData.push({
              tenantId: tenant.id,
              productVariantId: variant.id,
              productName: prod.name,
              variantName: variant.name,
              sku: variant.sku,
              quantity: qty,
              unitPrice,
              costPrice: itemCostPrice,
              discountAmount: 0,
              subtotal: itemSubtotal,
              createdAt: orderTime,
              // Backflush metadata
              rawIngredients: variant.recipe?.items || [],
            });
          }

          // Diskon & Promosi (Sekitar 20% order mendapat diskon)
          let discountAmount = 0;
          if (Math.random() < 0.20) {
            discountAmount = Math.floor((subtotal * 0.10) / 1000) * 1000; // Diskon 10% dibulatkan ke ribuan
          }

          const taxableBase = Math.max(0, subtotal - discountAmount);

          // Pajak Restoran PB1 (10%)
          const taxAmount = Math.round(taxableBase * 0.10);

          // Service Charge (5% hanya jika Dine In)
          const serviceCharge = channel === 'DINE_IN' ? Math.round(taxableBase * 0.05) : 0;

          const grandTotal = taxableBase + taxAmount + serviceCharge;

          // Pelanggan (opsional)
          const assignedCustomer = Math.random() > 0.5 ? customers[Math.floor(Math.random() * customers.length)] : null;

          // Buat Order
          const order = await prisma.order.create({
            data: {
              tenantId: tenant.id,
              outletId: store.id,
              shiftId: shift.id,
              userId: cashier.id,
              customerId: assignedCustomer ? assignedCustomer.id : null,
              notes: assignedCustomer ? `Pelanggan: ${assignedCustomer.name} (${assignedCustomer.phone})` : null,
              invoiceNumber,
              orderStatus: OrderStatus.COMPLETED,
              paymentStatus: PaymentStatus.PAID,
              orderType,
              channel,
              tableNumber,
              subtotal,
              discountTotal: discountAmount,
              taxTotal: taxAmount,
              serviceTotal: serviceCharge,
              totalAmount: grandTotal,
              paidAmount: grandTotal,
              changeAmount: 0,
              createdAt: orderTime,
              updatedAt: orderTime,
            },
          });

          totalOrdersCreated++;
          sumGrossSales += subtotal;
          sumDiscount += discountAmount;
          sumNetSales += (subtotal - discountAmount);
          sumTax += taxAmount;
          sumService += serviceCharge;

          // Simpan Order Items
          for (const oi of orderItemsData) {
            await prisma.orderItem.create({
              data: {
                tenantId: tenant.id,
                orderId: order.id,
                productVariantId: oi.productVariantId,
                productName: oi.productName,
                variantName: oi.variantName,
                sku: oi.sku,
                quantity: oi.quantity,
                unitPrice: oi.unitPrice,
                costPrice: oi.costPrice,
                discountAmount: oi.discountAmount,
                subtotal: oi.subtotal,
              },
            });
            totalOrderItemsCreated++;

            // Backflush pemotongan bahan baku BOM ke inventory_ledgers
            for (const ing of oi.rawIngredients) {
              const rawQtyNeeded = Number(ing.quantity) * oi.quantity;
              const targetStorageLoc = whLoc.id; // Gudang Pusat

              // Catat ledger mutasi stok SALE/ORDER
              await prisma.inventoryLedger.create({
                data: {
                  tenantId: tenant.id,
                  inventoryItemId: ing.inventoryItemId,
                  storageLocationId: targetStorageLoc,
                  quantityDelta: -rawQtyNeeded,
                  balanceBefore: 5000,
                  balanceAfter: 5000 - rawQtyNeeded,
                  unitCost: Number(ing.inventoryItem.averageCost || 0),
                  movementType: StockMovementType.SALE,
                  referenceType: InventoryRefType.ORDER,
                  referenceId: order.id,
                  actorType: ActorType.USER,
                  actorUserId: cashier.id,
                  notes: `BOM Resep: ${oi.productName} (${oi.quantity}x) [${invoiceNumber}]`,
                  createdAt: orderTime,
                },
              });
            }
          }

          // Simpan Pembayaran (Payment Transaction)
          // Murni CASH & QRIS (Nol EDC/Bank Transfer sesuai operasional aktif gerai)
          // 48% CASH, 52% QRIS
          const pRand = Math.random();
          const method = pRand < 0.48 ? PaymentMethod.CASH : PaymentMethod.QRIS;

          if (method === PaymentMethod.CASH) {
            shiftCashReceived += grandTotal;
          }

          await prisma.paymentTransaction.create({
            data: {
              tenantId: tenant.id,
              orderId: order.id,
              paymentMethod: method,
              amount: grandTotal,
              referenceNumber: method === PaymentMethod.QRIS 
                ? `QRIS-BCA-${dayStr}${invSequence}` 
                : null,
              status: PaymentTxStatus.CAPTURED,
              paidAt: orderTime,
              createdAt: orderTime,
            },
          });
          sumPayments += grandTotal;
        }

        // Tutup Shift: Update Rekonsiliasi Kas Kasir
        const expectedCash = startingCash + shiftCashReceived;
        // Variasi selisih kas kecil untuk menguji modul audit shift (misal hari ke-2 ada selisih -Rp5.000)
        let actualCash = expectedCash;
        let difference = 0;
        if (day === 2 && sc.name === 'Shift Sore') {
          actualCash = expectedCash - 5000;
          difference = -5000; // Kasir kurang setor Rp 5.000
        } else if (day === 3 && sc.name === 'Shift Pagi') {
          actualCash = expectedCash + 2000;
          difference = 2000; // Kasir lebih setor Rp 2.000
        }

        await prisma.shift.update({
          where: { id: shift.id },
          data: {
            expectedEnding: expectedCash,
            actualEnding: actualCash,
            cashDifference: difference,
          },
        });
      }
    }
  }

  // ============================================================================
  // BAGIAN C: PRE-COMMIT INTEGRITY AUDIT (ASSERTION CHECK)
  // ============================================================================
  console.log('\n🔍 Menjalankan Audit Integritas Data Mandiri (Pre-Commit Check)...');

  const expectedPaymentSum = sumNetSales + sumTax + sumService;
  const isMatch = Math.abs(expectedPaymentSum - sumPayments) < 1;

  console.log('----------------------------------------------------------------');
  console.log(`📊 TOTAL PESANAN SELESAI  : ${totalOrdersCreated} pesanan`);
  console.log(`📦 TOTAL BARANG TERJUAL   : ${totalOrderItemsCreated} item`);
  console.log(`⏱️ TOTAL SESI SHIFT KASIR : ${totalShiftsCreated} shift`);
  console.log(`💰 TOTAL OMSET KOTOR      : Rp ${sumGrossSales.toLocaleString('id-ID')}`);
  console.log(`🏷️ TOTAL DISKON PROMOSI   : Rp ${sumDiscount.toLocaleString('id-ID')}`);
  console.log(`💵 TOTAL OMSET BERSIH     : Rp ${sumNetSales.toLocaleString('id-ID')}`);
  console.log(`🏛️ TOTAL PAJAK DAERAH PB1 : Rp ${sumTax.toLocaleString('id-ID')}`);
  console.log(`🛎️ TOTAL SERVICE CHARGE   : Rp ${sumService.toLocaleString('id-ID')}`);
  console.log(`💳 TOTAL ARUS KAS DITERIMA: Rp ${sumPayments.toLocaleString('id-ID')}`);
  console.log('----------------------------------------------------------------');

  if (!isMatch) {
    console.error(`❌ KONTRADIKSI DATA TERDETEKSI: Total Arus Kas (${sumPayments}) != NetSales + Pajak + Service (${expectedPaymentSum})`);
    console.error('⚠️ Proses dihentikan karena ditemukan bug logika perhitungan!');
    process.exit(1);
  } else {
    console.log('✅ AUDIT INTEGRITAS 100% LOLOS (NetSales + PB1 + Service == Total Arus Kas Pembayaran).');
  }

  console.log('\n🎉 SIMULASI SELESAI DENGAN SUKSES! Silakan refresh halaman Laporan di Backoffice.');
}

main()
  .catch((e) => {
    console.error('❌ Terjadi kesalahan fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
