import { prisma } from '../config/prisma';
import { purchasingService } from '../services/purchasing.service';
import { OrderStatus, PaymentStatus, ShiftStatus, PurchaseOrderStatus } from '@prisma/client';

const API_BASE = 'http://localhost:5001/api';

async function main() {
  console.log('========================================================================');
  console.log('🧪 UAT END-TO-END MENYELURUH: FULL LIFECYCLE LAUNDRY FASE 1 - 10');
  console.log('========================================================================\n');

  let passedSteps = 0;
  const totalSteps = 8;
  const reportTable: Array<{ step: string; name: string; status: 'PASS' | 'FAIL'; notes: string }> = [];

  function record(step: string, name: string, isOk: boolean, notes: string) {
    if (isOk) {
      passedSteps++;
      console.log(`✅ [${step}] ${name} -> PASS: ${notes}`);
      reportTable.push({ step, name, status: 'PASS', notes });
    } else {
      console.error(`❌ [${step}] ${name} -> FAIL: ${notes}`);
      reportTable.push({ step, name, status: 'FAIL', notes });
      throw new Error(`UAT Failed at [${step}] ${name}: ${notes}`);
    }
  }

  // 0. Autentikasi ke API Server
  console.log('🔑 Mengambil token autentikasi kasir & owner laundry...');
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner.laundry@wellpos.id', password: 'pastiwell789' }),
  });
  const loginData: any = await loginRes.json();
  if (!loginData.data?.token) {
    throw new Error(`Gagal login ke API: ${JSON.stringify(loginData)}`);
  }
  const token = loginData.data.token;
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // Resolusi Tenant & Outlet Laundry
  const user = await prisma.user.findFirst({
    where: { email: 'owner.laundry@wellpos.id' },
    include: { tenant: { include: { outlets: true } } },
  });
  if (!user || !user.tenant) throw new Error('Laundry user/tenant tidak ditemukan di DB');

  const tenantId = user.tenantId;
  const outlet = user.tenant.outlets.find((o) => {
    const ind = Array.isArray(o.industries) ? o.industries : [];
    return ind.some((i: any) => String(i).toLowerCase().includes('laundry')) || o.name.toLowerCase().includes('laundry');
  }) || user.tenant.outlets[0];

  console.log(`🏢 Tenant: ${user.tenant.name} (${tenantId})`);
  console.log(`🏪 Outlet: ${outlet.name} (${outlet.id})\n`);

  // Pastikan Storage Location dan Supplier tersedia
  let storageLoc = await prisma.storageLocation.findFirst({
    where: { tenantId, outletId: outlet.id, isActive: true },
  });
  if (!storageLoc) {
    storageLoc = await prisma.storageLocation.create({
      data: { tenantId, outletId: outlet.id, name: '[UAT] Gudang Bahan Laundry', isDefault: true },
    });
  }

  let supplier = await prisma.supplier.findFirst({ where: { tenantId } });
  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: { tenantId, code: 'SUP-UAT', name: '[UAT] Supplier Kimia Laundry', phone: '+6281234567890' },
    });
  }

  const uatSuffix = Date.now().toString().slice(-5);
  let createdItemId = '';
  let createdPoId = '';
  let createdServiceId = '';
  let createdOrderId = '';
  let createdInvoiceNumber = '';
  let shiftIdForTest8 = '';

  try {
    // =========================================================================
    // 1. Konversi UoM & Penerimaan PO
    // =========================================================================
    console.log('--- 1. UAT Konversi UoM & Penerimaan PO ---');
    const detergentItem = await prisma.inventoryItem.create({
      data: {
        tenantId,
        itemCode: `UAT-DET-${uatSuffix}`,
        name: `[UAT] Deterjen Cair Matic ${uatSuffix}`,
        canonicalUom: 'ML',
        purchaseUom: 'JERIGEN',
        purchaseConversionFactor: 4500, // 1 Jerigen = 4.500 ML
        averageCost: 0,
        reorderPoint: 500,
        isActive: true,
      },
    });
    createdItemId = detergentItem.id;

    // Buat & Terima PO 1 Jerigen @ Rp 90.000
    const po = await purchasingService.createPurchaseOrder({
      tenantId,
      outletId: outlet.id,
      supplierId: supplier.id,
      storageLocationId: storageLoc.id,
      createdById: user.id,
      items: [
        {
          inventoryItemId: detergentItem.id,
          quantityOrdered: 1, // 1 Jerigen
          unitCost: 90000,
        },
      ],
    });
    createdPoId = po.id;

    // Terima PO
    const poItem = po.items[0];
    await purchasingService.receivePurchaseOrder({
      tenantId,
      purchaseOrderId: po.id,
      receivedById: user.id,
      items: [
        {
          purchaseOrderItemId: poItem.id,
          quantityReceived: 1, // 1 Jerigen diterima
          unitCost: 90000,
        },
      ],
    });

    // Verifikasi saldo stok bertambah +4.500 ML
    const balance = await prisma.inventoryBalance.findFirst({
      where: { tenantId, storageLocationId: storageLoc.id, inventoryItemId: detergentItem.id },
    });
    const updatedItem = await prisma.inventoryItem.findUnique({ where: { id: detergentItem.id } });
    const ledger = await prisma.inventoryLedger.findFirst({
      where: { tenantId, inventoryItemId: detergentItem.id, referenceId: po.id },
      orderBy: { createdAt: 'desc' },
    });

    const isBalanceOk = Number(balance?.quantityOnHand) === 4500;
    const isCostOk = Math.round(Number(updatedItem?.averageCost)) === 20; // 90000 / 4500 = 20
    const isLedgerOk = ledger?.notes?.includes('JERIGEN') && ledger?.notes?.includes('4.500 ML');

    record(
      'A1',
      'Konversi UoM & Penerimaan PO',
      isBalanceOk && isCostOk && !!isLedgerOk,
      `Stok: ${balance?.quantityOnHand} ML, AvgCost: Rp ${updatedItem?.averageCost}/ML, Ledger: "${ledger?.notes}"`
    );

    // =========================================================================
    // 2. Pengaturan BoM Layanan Laundry
    // =========================================================================
    console.log('\n--- 2. UAT Pengaturan BoM Layanan Laundry ---');
    // Buat master layanan laundry kiloan uji
    const service = await prisma.laundryService.create({
      data: {
        tenantId,
        name: `[UAT] Cuci Kiloan Reguler ${uatSuffix}`,
        category: 'KILOAN',
        unit: 'KG',
        price: 10000, // Rp 10.000 / Kg
        durationHours: 24,
        isActive: true,
      },
    });
    createdServiceId = service.id;

    // Simpan konfigurasi BoM via API PUT /api/laundry/services/:id/bom
    const saveBomRes = await fetch(`${API_BASE}/laundry/services/${service.id}/bom`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        bomItems: [
          {
            inventoryItemId: detergentItem.id,
            quantityPerUnit: 25, // 25 ML per Kg
            consumptionBasis: 'PER_UNIT',
            notes: 'Dosis standar mesin cuci',
          },
        ],
      }),
    });
    const saveBomData: any = await saveBomRes.json();
    if (saveBomRes.status !== 200) {
      throw new Error(`Gagal menyimpan BoM: ${JSON.stringify(saveBomData)}`);
    }

    // Panggil GET /api/laundry/services/:id/bom
    const getBomRes = await fetch(`${API_BASE}/laundry/services/${service.id}/bom`, {
      headers: authHeaders,
    });
    const getBomData: any = await getBomRes.json();
    const bomRes = getBomData.data;

    // 25 ML * Rp 20 = Rp 500 HPP
    const expectedBomCost = 500;
    const expectedGrossMargin = 10000 - 500; // 9500
    const expectedMarginPercent = 95;

    const isBomOk =
      bomRes.totalBomCost === expectedBomCost &&
      bomRes.grossMargin === expectedGrossMargin &&
      bomRes.marginPercent === expectedMarginPercent;

    record(
      'A2',
      'Pengaturan BoM Layanan Laundry',
      isBomOk,
      `HPP: Rp ${bomRes.totalBomCost}/Kg, Gross Margin: Rp ${bomRes.grossMargin} (${bomRes.marginPercent}%)`
    );

    // =========================================================================
    // 3. Transaksi Order + Delivery + DP (Piutang)
    // =========================================================================
    console.log('\n--- 3. UAT Transaksi Order + Delivery + DP (Piutang) ---');
    // Order 4 Kg: 4 * 10000 = 40.000 + Ongkir 10.000 = Total 50.000. DP = 15.000. Sisa = 35.000.
    const orderPayload = {
      outletId: outlet.id,
      customerName: `[UAT] Ibu Anita Wijaya ${uatSuffix}`,
      customerPhone: '+6281299887766',
      customerAddress: 'Jl. Melati No. 12, Kebayoran Baru',
      deliveryType: 'PICKUP_AND_DELIVERY',
      deliveryFee: 10000,
      deliveryAddress: 'Jl. Melati No. 12, Kebayoran Baru',
      deliveryNotes: 'Pagar warna hitam, titip satpam jika tidak ada orang',
      items: [
        {
          serviceId: service.id,
          name: service.name,
          category: 'KILOAN',
          quantity: 4, // 4 Kg
          unit: 'KG',
          unitPrice: 10000,
        },
      ],
      totalPieces: 10,
      perfumeVariant: 'Lavender',
      depositAmount: 15000, // DP Rp 15.000
      paymentMethod: 'CASH',
    };

    const orderRes = await fetch(`${API_BASE}/laundry/orders`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(orderPayload),
    });
    const orderData: any = await orderRes.json();
    if (orderRes.status !== 201) {
      throw new Error(`Gagal membuat order laundry: ${JSON.stringify(orderData)}`);
    }

    createdOrderId = orderData.data.id;
    createdInvoiceNumber = orderData.data.invoiceNumber;

    const orderDb = await prisma.order.findUnique({
      where: { id: createdOrderId },
      include: { laundryDetail: true, customerDebts: true },
    });

    const deliveriesRes = await fetch(`${API_BASE}/laundry/deliveries?outletId=${outlet.id}`, {
      headers: authHeaders,
    });
    const deliveriesData: any = await deliveriesRes.json();
    const deliveryList = Array.isArray(deliveriesData.data) ? deliveriesData.data : (deliveriesData.data?.deliveries || []);
    const deliveryOrderFound = deliveryList.some(
      (d: any) => d.id === createdOrderId || d.orderId === createdOrderId
    );

    const isTotalOk = Number(orderDb?.totalAmount) === 50000; // 40.000 + 10.000
    const isPaidOk = Number(orderDb?.paidAmount) === 15000;
    const isDebtOk =
      orderDb?.customerDebts.length === 1 &&
      Number(orderDb.customerDebts[0].remainingAmount) === 35000 &&
      ['PARTIAL', 'UNPAID'].includes(orderDb.customerDebts[0].status);

    record(
      'A3',
      'Transaksi Order + Delivery + DP (Piutang)',
      isTotalOk && isPaidOk && isDebtOk && !!deliveryOrderFound,
      `Total: Rp ${orderDb?.totalAmount} (incl. ongkir), DP: Rp ${orderDb?.paidAmount}, Piutang: Rp ${orderDb?.customerDebts[0]?.remainingAmount}, Delivery Listed: ${deliveryOrderFound}`
    );

    // =========================================================================
    // 4. Produksi & Auto-Potong BoM Anti-Dobel (Idempotent)
    // =========================================================================
    console.log('\n--- 4. UAT Produksi & Auto-Potong BoM Anti-Dobel ---');
    // Majukan ke CUCI (WASHING_DRYING)
    const advanceCuciRes = await fetch(`${API_BASE}/laundry/orders/${createdOrderId}/advance-stage`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        nextStage: 'CUCI',
        operatorName: 'Operator Cuci UAT',
        notes: 'Mulai proses cuci deterjen matic',
      }),
    });
    const advanceCuciData: any = await advanceCuciRes.json();
    if (advanceCuciRes.status !== 200) {
      throw new Error(`Gagal memajukan ke CUCI: ${JSON.stringify(advanceCuciData)}`);
    }

    // Verifikasi stok berkurang 4 Kg * 25 ML = 100 ML -> Sisa 4.500 - 100 = 4.400 ML
    const balanceAfterCuci = await prisma.inventoryBalance.findFirst({
      where: { tenantId, storageLocationId: storageLoc.id, inventoryItemId: detergentItem.id },
    });
    const detailAfterCuci = await prisma.laundryOrderDetail.findFirst({
      where: { orderId: createdOrderId },
    });
    const bomLedger = await prisma.inventoryLedger.findFirst({
      where: { tenantId, inventoryItemId: detergentItem.id, movementType: 'PRODUCTION_CONSUMPTION' },
    });

    const isDeductionOk = Number(balanceAfterCuci?.quantityOnHand) === 4400;
    const isBomFlagOk = detailAfterCuci?.isBomDeducted === true;
    const isLedgerTypeOk = bomLedger?.movementType === 'PRODUCTION_CONSUMPTION';

    // Majukan ke KERING lalu RACK_STORAGE
    await fetch(`${API_BASE}/laundry/orders/${createdOrderId}/advance-stage`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ nextStage: 'KERING', operatorName: 'Operator Pengering UAT' }),
    });

    const advanceRackRes = await fetch(`${API_BASE}/laundry/orders/${createdOrderId}/advance-stage`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        nextStage: 'RACK_STORAGE',
        rackCode: 'RAK-A1',
        operatorName: 'Operator Rak UAT',
      }),
    });
    const advanceRackData: any = await advanceRackRes.json();
    if (advanceRackRes.status !== 200) {
      throw new Error(`Gagal memajukan ke RACK_STORAGE: ${JSON.stringify(advanceRackData)}`);
    }

    // Verifikasi stok TIDAK terpotong ulang (tetap 4.400 ML) dan deliveryStatus menjadi READY_TO_DELIVER
    const balanceAfterRack = await prisma.inventoryBalance.findFirst({
      where: { tenantId, storageLocationId: storageLoc.id, inventoryItemId: detergentItem.id },
    });
    const detailAfterRack = await prisma.laundryOrderDetail.findFirst({
      where: { orderId: createdOrderId },
    });

    const isNoDoubleDeduct = Number(balanceAfterRack?.quantityOnHand) === 4400;
    const isDeliveryReady = detailAfterRack?.deliveryStatus === 'READY_TO_DELIVER';
    const isRackSet = detailAfterRack?.rackCode === 'RAK-A1';

    record(
      'A4',
      'Produksi & Auto-Potong BoM Anti-Dobel (Idempotent)',
      isDeductionOk && isBomFlagOk && isLedgerTypeOk && isNoDoubleDeduct && isDeliveryReady && isRackSet,
      `Stok Cuci: ${balanceAfterCuci?.quantityOnHand} ML (-100 ML), Stok Rak: ${balanceAfterRack?.quantityOnHand} ML (No Dobel), Rack: ${detailAfterRack?.rackCode}, DeliveryStatus: ${detailAfterRack?.deliveryStatus}`
    );

    // =========================================================================
    // 5. Live Public QR Tracking (Tanpa Login)
    // =========================================================================
    console.log('\n--- 5. UAT Live Public QR Tracking (Tanpa Login) ---');
    const publicRes = await fetch(`${API_BASE}/laundry/public/track/${createdInvoiceNumber}`);
    const publicData: any = await publicRes.json();
    if (publicRes.status !== 200) {
      throw new Error(`Public tracking gagal: ${JSON.stringify(publicData)}`);
    }

    const track = publicData.data;
    const isTrackingOk =
      track.status === 'READY_FOR_PICKUP' &&
      track.rackCode === 'RAK-A1' &&
      track.deliveryStatus === 'READY_TO_DELIVER' &&
      track.customerName?.includes('***') && // Masked
      Array.isArray(track.stageLogs) &&
      track.stageLogs.length >= 3;

    record(
      'A5',
      'Live Public QR Tracking (Tanpa Login)',
      isTrackingOk,
      `Status: ${track.status}, Rak: ${track.rackCode}, Delivery: ${track.deliveryStatus}, Masked Customer: ${track.customerName}, StageLogs: ${track.stageLogs?.length} tahap`
    );

    // =========================================================================
    // 6. Garansi Cuci Ulang (Rewash Rp 0)
    // =========================================================================
    console.log('\n--- 6. UAT Garansi Cuci Ulang (Rewash Rp 0) ---');
    const rewashRes = await fetch(`${API_BASE}/laundry/orders/${createdOrderId}/rewash`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        reason: 'Noda Belum Hilang',
        notes: 'Noda kecap di bagian lengan kiri',
      }),
    });
    const rewashData: any = await rewashRes.json();
    if (rewashRes.status !== 200) {
      throw new Error(`Rewash gagal: ${JSON.stringify(rewashData)}`);
    }

    const detailAfterRewash = await prisma.laundryOrderDetail.findFirst({
      where: { orderId: createdOrderId },
    });
    const orderAfterRewash = await prisma.order.findUnique({
      where: { id: createdOrderId },
    });
    const balanceAfterRewash = await prisma.inventoryBalance.findFirst({
      where: { tenantId, storageLocationId: storageLoc.id, inventoryItemId: detergentItem.id },
    });

    const isRewashStatusOk = detailAfterRewash?.status === 'WASHING_DRYING';
    const isRackCleared = detailAfterRewash?.rackCode === null;
    const isNotesTagged = detailAfterRewash?.defectNotes?.includes('[REWASH/GARANSI: Noda Belum Hilang]');
    const isTotalUnchanged = Number(orderAfterRewash?.totalAmount) === 50000;
    const isStockUntouched = Number(balanceAfterRewash?.quantityOnHand) === 4400;

    record(
      'A6',
      'Garansi Cuci Ulang (Rewash Rp 0)',
      isRewashStatusOk && isRackCleared && !!isNotesTagged && isTotalUnchanged && isStockUntouched,
      `Status: ${detailAfterRewash?.status}, Rak: ${detailAfterRewash?.rackCode}, Tag: "${detailAfterRewash?.defectNotes}", Total Tetap: Rp ${orderAfterRewash?.totalAmount}, Stok: ${balanceAfterRewash?.quantityOnHand} ML`
    );

    // Kembalikan ke siap antar untuk melanjutkan ke pengantaran
    await fetch(`${API_BASE}/laundry/orders/${createdOrderId}/advance-stage`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        nextStage: 'RACK_STORAGE',
        rackCode: 'RAK-A1',
        operatorName: 'Operator QC Selesai',
      }),
    });

    // =========================================================================
    // 7. Delivery Selesai + Pelunasan COD
    // =========================================================================
    console.log('\n--- 7. UAT Delivery Selesai + Pelunasan COD ---');
    const deliveryPatchRes = await fetch(`${API_BASE}/laundry/deliveries/${createdOrderId}/status`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        deliveryStatus: 'DELIVERED',
        courierName: 'Doni Kurir Express',
        courierPhone: '+6281399881122',
        collectCodPayment: true,
        codPaymentMethod: 'CASH',
        deliveryNotes: 'Diterima oleh pemilik rumah langsung',
      }),
    });
    const deliveryPatchData: any = await deliveryPatchRes.json();
    if (deliveryPatchRes.status !== 200) {
      throw new Error(`Delivery patch gagal: ${JSON.stringify(deliveryPatchData)}`);
    }

    const orderAfterCod = await prisma.order.findUnique({
      where: { id: createdOrderId },
      include: {
        customerDebts: true,
        payments: true,
      },
    });

    const isOrderPaid = orderAfterCod?.paymentStatus === PaymentStatus.PAID;
    const isOrderCompleted = orderAfterCod?.orderStatus === OrderStatus.COMPLETED;
    const isDebtPaid = orderAfterCod?.customerDebts[0]?.status === 'PAID';
    const isDebtZero = Number(orderAfterCod?.customerDebts[0]?.remainingAmount) === 0;
    const codTx = orderAfterCod?.payments.find((pt) => Number(pt.amount) === 35000);
    const isTxCaptured = codTx?.status === 'CAPTURED';

    record(
      'A7',
      'Delivery Selesai + Pelunasan COD',
      isOrderPaid && isOrderCompleted && isDebtPaid && isDebtZero && !!isTxCaptured,
      `PaymentStatus: ${orderAfterCod?.paymentStatus}, OrderStatus: ${orderAfterCod?.orderStatus}, DebtStatus: ${orderAfterCod?.customerDebts[0]?.status}, COD Tx Captured: Rp ${codTx?.amount}`
    );

    // =========================================================================
    // 8. Tutup Shift Laundry (Pengecualian Unpaid Orders)
    // =========================================================================
    console.log('\n--- 8. UAT Tutup Shift Laundry (Pengecualian Unpaid) ---');
    // Buka shift baru untuk kasir ini jika belum ada yang terbuka
    let activeShift = await prisma.shift.findFirst({
      where: { userId: user.id, status: ShiftStatus.OPEN },
    });

    if (!activeShift) {
      const startShiftRes = await fetch(`${API_BASE}/shifts/start`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          outletId: outlet.id,
          startingCash: 100000,
        }),
      });
      const startShiftData: any = await startShiftRes.json();
      if (startShiftRes.status !== 200 && startShiftRes.status !== 201) {
        throw new Error(`Gagal membuka shift: ${JSON.stringify(startShiftData)}`);
      }
      activeShift = startShiftData.data;
    }
    shiftIdForTest8 = activeShift?.id || '';

    // Buat 1 pesanan laundry UNPAID yang sengaja belum lunas di shift ini
    const unpaidOrderRes = await fetch(`${API_BASE}/laundry/orders`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        outletId: outlet.id,
        customerName: `[UAT] Pelanggan Belum Bayar ${uatSuffix}`,
        items: [
          {
            serviceId: service.id,
            name: service.name,
            category: 'KILOAN',
            quantity: 2,
            unit: 'KG',
            unitPrice: 10000,
          },
        ],
        totalPieces: 4,
        depositAmount: 0, // Belum bayar sama sekali (UNPAID)
      }),
    });
    const unpaidOrderData: any = await unpaidOrderRes.json();
    const unpaidOrderId = unpaidOrderData.data?.id || unpaidOrderData.data?.order?.id;

    // Tutup shift
    const closeShiftRes = await fetch(`${API_BASE}/shifts/close`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        actualCash: 100000,
        notes: 'UAT Penutupan Shift Outlet Laundry dengan Order Belum Bayar',
      }),
    });
    const closeShiftData: any = await closeShiftRes.json();

    const isShiftCloseOk = closeShiftRes.status === 200 && closeShiftData.status === 'success';

    // Bersihkan order unpaid ini
    if (unpaidOrderId) {
      await prisma.laundryStageLog.deleteMany({ where: { orderId: unpaidOrderId } });
      await prisma.laundryOrderDetail.deleteMany({ where: { orderId: unpaidOrderId } });
      await prisma.orderItem.deleteMany({ where: { orderId: unpaidOrderId } });
      await prisma.customerDebt.deleteMany({ where: { orderId: unpaidOrderId } });
      await prisma.order.delete({ where: { id: unpaidOrderId } }).catch(() => {});
    }

    record(
      'A8',
      'Tutup Shift Laundry dengan Order Unpaid',
      isShiftCloseOk,
      `Status: ${closeShiftRes.status} (Diizinkan untuk vertikal Laundry), Response: "${closeShiftData.message || 'Shift ditutup'}"`
    );
  } finally {
    // =========================================================================
    // CLEANUP / PEMBERSIHAN DATA UAT DARI DB LOKAL
    // =========================================================================
    console.log('\n🧹 Membersihkan data uji [UAT] dari DB lokal...');
    try {
      if (createdOrderId) {
        await prisma.laundryStageLog.deleteMany({ where: { orderId: createdOrderId } });
        await prisma.customerDebtPayment.deleteMany({
          where: { debt: { orderId: createdOrderId } },
        });
        await prisma.customerDebt.deleteMany({ where: { orderId: createdOrderId } });
        await prisma.paymentTransaction.deleteMany({ where: { orderId: createdOrderId } });
        await prisma.laundryOrderDetail.deleteMany({ where: { orderId: createdOrderId } });
        await prisma.orderItem.deleteMany({ where: { orderId: createdOrderId } });
        await prisma.order.delete({ where: { id: createdOrderId } }).catch(() => {});
      }

      if (createdServiceId) {
        await prisma.laundryServiceBomItem.deleteMany({ where: { laundryServiceId: createdServiceId } });
        await prisma.laundryService.delete({ where: { id: createdServiceId } }).catch(() => {});
      }

      if (createdPoId) {
        await prisma.inventoryLedger.deleteMany({ where: { referenceId: createdPoId } });
        await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: createdPoId } });
        await prisma.purchaseOrder.delete({ where: { id: createdPoId } }).catch(() => {});
      }

      if (createdItemId) {
        await prisma.inventoryLedger.deleteMany({ where: { inventoryItemId: createdItemId } });
        await prisma.inventoryBalance.deleteMany({ where: { inventoryItemId: createdItemId } });
        await prisma.laundryServiceBomItem.deleteMany({ where: { inventoryItemId: createdItemId } });
        await prisma.inventoryItem.delete({ where: { id: createdItemId } }).catch(() => {});
      }

      // Bersihkan hutang pelanggan UAT dulu sebelum menghapus customer
      const uatCustomers = await prisma.customer.findMany({
        where: { tenantId, name: { contains: '[UAT]' } },
        select: { id: true },
      });
      const uatCustIds = uatCustomers.map((c) => c.id);
      if (uatCustIds.length > 0) {
        await prisma.customerDebtPayment.deleteMany({
          where: { debt: { customerId: { in: uatCustIds } } },
        });
        await prisma.customerDebt.deleteMany({
          where: { customerId: { in: uatCustIds } },
        });
      }
      await prisma.customer.deleteMany({
        where: { tenantId, name: { contains: '[UAT]' } },
      });

      console.log('✅ Pembersihan data uji [UAT] selesai 100% (DB lokal kembali bersih).\n');
    } catch (cleanupErr) {
      console.warn('⚠️ Peringatan saat pembersihan UAT:', cleanupErr);
    }
  }

  console.log('========================================================================');
  console.log(`🎉 HASIL UAT FULL LIFECYCLE LAUNDRY: ${passedSteps}/${totalSteps} SKENARIO LULUS (100%)`);
  console.log('========================================================================\n');
  console.table(reportTable);
}

main()
  .catch((e) => {
    console.error('Fatal Error UAT:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
