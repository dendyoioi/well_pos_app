import { prisma } from '../config/prisma';
import { purchasingService } from '../services/purchasing.service';
import { deductLaundryOrderBom } from '../controllers/laundry.controller';
import { OrderStatus, PaymentStatus } from '@prisma/client';

async function runTest() {
  console.log('================================================================');
  console.log('🧪 TESTING FASE 9: KONVERSI UOM BELI & AUTO-BOM SYSTEM LAUNDRY');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  // 1. Ambil atau buat tenant uji
  let tenant = await prisma.tenant.findFirst({
    where: { status: 'ACTIVE' },
    include: { outlets: true },
  });
  if (!tenant) throw new Error('Tenant tidak ditemukan');
  const outlet = tenant.outlets[0] || (await prisma.outlet.create({
    data: { tenantId: tenant.id, name: 'Outlet Uji BoM', code: 'OUT-TEST-BOM' },
  }));

  console.log(`🏢 Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`🏪 Outlet: ${outlet.name} (${outlet.id})\n`);

  let user = await prisma.user.findFirst({ where: { tenantId: tenant.id } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `cashier-${Math.random().toString(36).substring(2, 7)}@wellpos.test`,
        name: 'Kasir Uji BoM',
        role: 'CASHIER',
        passwordHash: 'dummyhash',
      },
    });
  }

  // Sesi unik
  const testSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();

  // -------------------------------------------------------------------------
  // TEST 1: Pendaftaran Master Bahan Baku dengan Konversi UoM
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Pendaftaran Master Bahan Baku & Konversi UoM ---');
  const detergentItem = await prisma.inventoryItem.create({
    data: {
      tenantId: tenant.id,
      itemCode: `RAW-DET-${testSuffix}`,
      name: `Deterjen Cair Matic Test ${testSuffix}`,
      canonicalUom: 'ML',
      purchaseUom: 'JERIGEN',
      purchaseConversionFactor: 4500, // 1 Jerigen = 4.500 ML
      averageCost: 20, // Rp 20 / ML
      reorderPoint: 1000,
      isActive: true,
    },
  });

  assert(detergentItem.canonicalUom === 'ML', 'Canonical UoM tersimpan sebagai ML');
  assert(detergentItem.purchaseUom === 'JERIGEN', 'Purchase UoM tersimpan sebagai JERIGEN');
  assert(Number(detergentItem.purchaseConversionFactor) === 4500, 'Faktor konversi tersimpan 4500');

  // -------------------------------------------------------------------------
  // TEST 2: Penerimaan PO dengan Konversi Satuan Beli ke Base Unit
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Penerimaan PO & Konversi Stok Masuk Otomatis ---');
  // Buat supplier & PO
  let supplier = await prisma.supplier.findFirst({ where: { tenantId: tenant.id } });
  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: { tenantId: tenant.id, code: `SUP-${testSuffix}`, name: 'Supplier Kimia Laundry' },
    });
  }

  // Resolusi storage location
  let storageLoc = await prisma.storageLocation.findFirst({
    where: { tenantId: tenant.id, outletId: outlet.id, isActive: true },
  });
  if (!storageLoc) {
    storageLoc = await prisma.storageLocation.create({
      data: { tenantId: tenant.id, outletId: outlet.id, name: 'Gudang Utama & Dapur', isDefault: true },
    });
  }

  // Buat PO untuk 2 Jerigen @ Rp 90.000 / Jerigen
  const po = await purchasingService.createPurchaseOrder({
    tenantId: tenant.id,
    outletId: outlet.id,
    storageLocationId: storageLoc.id,
    supplierId: supplier.id,
    items: [
      {
        inventoryItemId: detergentItem.id,
        quantityOrdered: 2, // 2 Jerigen
        unitCost: 90000, // Rp 90.000 per Jerigen
      },
    ],
  });

  // Terima PO penuh (2 Jerigen)
  const receivedPo = await purchasingService.receivePurchaseOrder({
    tenantId: tenant.id,
    purchaseOrderId: po.id,
    items: [
      {
        purchaseOrderItemId: po.items[0].id,
        quantityReceived: 2,
        unitCost: 90000,
      },
    ],
  });

  assert(receivedPo.status === 'RECEIVED', 'PO berstatus RECEIVED penuh');

  // Cek saldo stok di gudang: harus bertambah 2 * 4500 = 9000 ML
  const balance = await prisma.inventoryBalance.findFirst({
    where: { tenantId: tenant.id, storageLocationId: storageLoc.id, inventoryItemId: detergentItem.id },
  });
  assert(Number(balance?.quantityOnHand) === 9000, `Saldo stok gudang bertambah menjadi 9.000 ML (aktual: ${balance?.quantityOnHand})`);

  // Cek moving average cost: 90000 / 4500 = Rp 20 / ML
  const updatedInv = await prisma.inventoryItem.findUnique({ where: { id: detergentItem.id } });
  assert(Number(updatedInv?.averageCost) === 20, `Average cost per ML terkonversi menjadi Rp 20 (aktual: ${updatedInv?.averageCost})`);

  // Cek kartu stok ledger
  const ledger = await prisma.inventoryLedger.findFirst({
    where: { tenantId: tenant.id, inventoryItemId: detergentItem.id, referenceId: po.id },
  });
  assert(Number(ledger?.quantityDelta) === 9000, `Ledger quantityDelta adalah 9000 ML (aktual: ${ledger?.quantityDelta})`);
  assert(Number(ledger?.unitCost) === 20, `Ledger unitCost adalah Rp 20 (aktual: ${ledger?.unitCost})`);

  // -------------------------------------------------------------------------
  // TEST 3: Pemetaan BoM pada Layanan Laundry
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Pemetaan BoM Layanan Laundry ---');
  let laundryService = await prisma.laundryService.create({
    data: {
      tenantId: tenant.id,
      name: `Cuci Setrika BoM ${testSuffix}`,
      category: 'KILOAN',
      unit: 'KG',
      price: 8000,
      minOrderQty: 3,
      durationHours: 24,
      expressMultiplier: 1.0,
      isActive: true,
    },
  });

  // Hubungkan BoM: 25 ML Deterjen per Kg
  const bomItem = await prisma.laundryServiceBomItem.create({
    data: {
      tenantId: tenant.id,
      laundryServiceId: laundryService.id,
      inventoryItemId: detergentItem.id,
      quantityPerUnit: 25, // 25 ML per Kg
      consumptionBasis: 'PER_UNIT',
      notes: 'Takaran deterjen matic',
    },
  });

  assert(bomItem.id !== undefined, 'BoM item berhasil dibuat');
  assert(Number(bomItem.quantityPerUnit) === 25, 'Takaran per unit adalah 25 ML');

  // -------------------------------------------------------------------------
  // TEST 4: Auto-BoM Deduction saat Order Masuk Tahap Cuci
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Pemotongan Stok BoM Otomatis saat Masuk Tahap Cuci ---');
  // Buat order laundry seberat 4 Kg
  const invoiceNumber = `LD-TEST-${testSuffix}`;
  const order = await prisma.order.create({
    data: {
      tenantId: tenant.id,
      outletId: outlet.id,
      userId: user.id,
      invoiceNumber,
      orderStatus: OrderStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
      orderType: 'SERVICES',
      subtotal: 32000,
      totalAmount: 32000,
      paidAmount: 32000,
      changeAmount: 0,
      items: {
        create: [
          {
            tenantId: tenant.id,
            productName: laundryService.name,
            quantity: 4,
            unitPrice: 8000,
            costPrice: 0,
            discountAmount: 0,
            subtotal: 32000,
          },
        ],
      },
    },
  });

  const laundryDetail = await prisma.laundryOrderDetail.create({
    data: {
      orderId: order.id,
      tenantId: tenant.id,
      outletId: outlet.id,
      status: 'RECEIVED',
      currentStage: 'DROP_OFF',
      totalWeightKg: 4, // 4 Kg
      totalPieces: 10,
      estimatedReadyAt: new Date(Date.now() + 24 * 3600 * 1000),
    },
  });

  assert(laundryDetail.isBomDeducted === false, 'isBomDeducted awal bernilai false');

  // Eksekusi auto-BoM saat pengerjaan masuk tahap cuci (CUCI / WASHING)
  // Expected consumption: 4 Kg * 25 ML = 100 ML
  await prisma.$transaction(async (tx) => {
    await deductLaundryOrderBom(tx, laundryDetail, tenant.id);
  });

  // Verifikasi saldo stok berkurang dari 9000 ML menjadi 8900 ML
  const balanceAfterWash = await prisma.inventoryBalance.findFirst({
    where: { tenantId: tenant.id, storageLocationId: storageLoc.id, inventoryItemId: detergentItem.id },
  });
  assert(
    Number(balanceAfterWash?.quantityOnHand) === 8900,
    `Stok gudang berkurang 100 ML menjadi 8.900 ML (aktual: ${balanceAfterWash?.quantityOnHand})`
  );

  // Verifikasi flag isBomDeducted berubah menjadi true
  const refetchedDetail = await prisma.laundryOrderDetail.findUnique({ where: { id: laundryDetail.id } });
  assert(refetchedDetail?.isBomDeducted === true, 'isBomDeducted berubah menjadi true');
  assert(refetchedDetail?.bomDeductedAt !== null, 'bomDeductedAt terisi timestamp');

  // Verifikasi kartu stok ledger PRODUCTION_CONSUMPTION
  const bomLedger = await prisma.inventoryLedger.findFirst({
    where: {
      tenantId: tenant.id,
      inventoryItemId: detergentItem.id,
      movementType: 'PRODUCTION_CONSUMPTION',
      referenceId: order.id,
    },
  });
  assert(bomLedger !== null, 'Kartu stok ledger PRODUCTION_CONSUMPTION berhasil tercatat');
  assert(Number(bomLedger?.quantityDelta) === -100, `Delta ledger adalah -100 ML (aktual: ${bomLedger?.quantityDelta})`);

  // -------------------------------------------------------------------------
  // TEST 5: Uji Idempotensi (Anti Double-Deduct)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Uji Idempotensi (Anti Pemotongan Ganda) ---');
  // Panggil ulang deductLaundryOrderBom pada detail yang sudah dipotong
  await prisma.$transaction(async (tx) => {
    const res = await deductLaundryOrderBom(tx, refetchedDetail, tenant.id);
    assert(res.deducted === false, 'Pemotongan ulang ditolak (idempotent, return deducted: false)');
  });

  const balanceAfterSecondCall = await prisma.inventoryBalance.findFirst({
    where: { tenantId: tenant.id, storageLocationId: storageLoc.id, inventoryItemId: detergentItem.id },
  });
  assert(
    Number(balanceAfterSecondCall?.quantityOnHand) === 8900,
    `Stok tetap 8.900 ML tanpa pemotongan ganda (aktual: ${balanceAfterSecondCall?.quantityOnHand})`
  );

  // -------------------------------------------------------------------------
  // CLEANUP UJI
  // -------------------------------------------------------------------------
  console.log('\n--- Pembersihan Data Uji ---');
  await prisma.inventoryLedger.deleteMany({ where: { inventoryItemId: detergentItem.id } });
  await prisma.inventoryBalance.deleteMany({ where: { inventoryItemId: detergentItem.id } });
  await prisma.laundryServiceBomItem.deleteMany({ where: { laundryServiceId: laundryService.id } });
  await prisma.laundryOrderDetail.deleteMany({ where: { orderId: order.id } });
  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
  await prisma.order.delete({ where: { id: order.id } });
  await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: po.id } });
  await prisma.purchaseOrder.delete({ where: { id: po.id } });
  await prisma.laundryService.delete({ where: { id: laundryService.id } });
  await prisma.inventoryItem.delete({ where: { id: detergentItem.id } });
  console.log('🧹 Data uji berhasil dibersihkan.');

  console.log('\n================================================================');
  console.log(`🎉 SELURUH SKENARIO UJI FASE 9 SUKSES: ${passed}/${total} PASS (100%)`);
  console.log('================================================================');
}

runTest()
  .catch((e) => {
    console.error('Test execution error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
