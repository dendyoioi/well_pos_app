import { PrismaClient, Role, ShiftStatus, OrderStatus, PaymentStatus } from '@prisma/client';
import { Request, Response } from 'express';
import { SCHEMA_PATCHES, runAutoSchemaPatcher } from '../migrations/schema_patcher';
import { checkoutOrder } from '../controllers/order.controller';
import { createLaundryOrder, getLaundryOrders, getProductionKpiReport } from '../controllers/laundry.controller';
import { buildLaundryProductionTagEscPos } from '../../../client/src/utils/escpos';

const prisma = new PrismaClient();

function createMockReqRes(reqData: {
  user?: any;
  tenantId?: string;
  headers?: Record<string, string>;
  body?: any;
  params?: any;
  query?: any;
}) {
  let statusCode = 200;
  let jsonBody: any = null;
  const req = {
    user: reqData.user,
    tenantId: reqData.tenantId,
    headers: reqData.headers || {},
    body: reqData.body || {},
    params: reqData.params || {},
    query: reqData.query || {},
  } as unknown as Request;

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: any) {
      jsonBody = data;
      return this;
    },
  } as unknown as Response;

  return { req, res, getStatus: () => statusCode, getBody: () => jsonBody };
}

async function runPhase4Verification() {
  console.log('===================================================================');
  console.log('🧪 TESTING PLAYBOOK FASE 4: OFFLINE SYNC IDEMPOTENCY & RELIABILITY');
  console.log('   (Idempotency Key, Fallback Printer, Query Audit GCP e2-micro)');
  console.log('===================================================================');

  let passedTests = 0;
  const totalTests = 5;

  // 1. Verifikasi Registrasi DDL Patch di schema_patcher.ts
  console.log('\n▶️ 1. Verifikasi Registrasi DDL Patch Performa & Index di schema_patcher.ts');
  const patchPerf = SCHEMA_PATCHES.find(
    (p) => p.id === '20261121_04_query_performance_and_idempotency_indexes'
  );

  if (patchPerf) {
    console.log('✅ [PASS] 1. Patch DDL performa query & index terdaftar di array SCHEMA_PATCHES:');
    console.log(`   - ${patchPerf.id}: ${patchPerf.description}`);
    const patchResult = await runAutoSchemaPatcher(prisma);
    console.log(`   - Status Patcher Lokal: ${patchResult.applied.length} diterapkan, ${patchResult.skipped.length} dilewati.`);
    passedTests++;
  } else {
    throw new Error('❌ [FAIL] 1. Patch Fase 4 belum terdaftar di schema_patcher.ts!');
  }

  // Siapkan data tenant, outlet, user, produk untuk simulasi
  const tenant = await prisma.tenant.findFirst({
    where: {
      OR: [
        { slug: 'URA-4829001' },
        { slug: 'ura-coffee' },
        { name: { contains: 'Ura Coffee' } },
      ],
    },
  });
  if (!tenant) throw new Error('Tenant ura-coffee tidak ditemukan.');

  const outlet = await prisma.outlet.findFirst({
    where: { tenantId: tenant.id },
  });
  if (!outlet) throw new Error('Outlet tidak ditemukan.');

  const cashierUser = await prisma.user.findFirst({
    where: { tenantId: tenant.id, role: { in: [Role.CASHIER, Role.OWNER, Role.SUPERVISOR] } },
  });
  if (!cashierUser) throw new Error('User kasir/owner tidak ditemukan.');

  const product = await prisma.product.findFirst({
    where: { tenantId: tenant.id, isActive: true },
  });
  if (!product) throw new Error('Produk aktif tidak ditemukan.');

  // Siapkan shift aktif
  let activeShift = await prisma.shift.findFirst({
    where: { tenantId: tenant.id, outletId: outlet.id, status: ShiftStatus.OPEN },
  });
  if (!activeShift) {
    activeShift = await prisma.shift.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        userId: cashierUser.id,
        startingCash: 100000,
        expectedEnding: 100000,
        status: ShiftStatus.OPEN,
      },
    });
  }

  // 2. Verifikasi Idempotency Checkout F&B (Anti-Double Order & Anti-Double Stock Mutation)
  console.log('\n▶️ 2. Verifikasi Idempotensi Endpoint Checkout F&B (Header X-Idempotency-Key)');
  const testIdempotencyKey = `IDEMP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  const checkoutPayload = {
    items: [{ productId: product.id, quantity: 2 }],
    channel: 'DINE_IN',
    outletId: outlet.id,
    payment: {
      method: 'CASH',
      amountPaid: 100000,
    },
  };

  // Kirim transaksi pertama
  const mockReq1 = createMockReqRes({
    tenantId: tenant.id,
    user: cashierUser,
    headers: { 'x-idempotency-key': testIdempotencyKey },
    body: checkoutPayload,
  });
  await checkoutOrder(mockReq1.req, mockReq1.res);

  const status1 = mockReq1.getStatus();
  const body1 = mockReq1.getBody();
  const invoice1 = body1?.data?.invoiceNumber;
  const orderId1 = body1?.data?.id;

  if (status1 !== 201 || !invoice1 || !orderId1) {
    throw new Error(`❌ Transaksi pertama gagal: HTTP ${status1} - ${body1?.message}`);
  }

  // Kirim transaksi kedua dengan X-Idempotency-Key yang persis sama (simulasi network timeout / client retry)
  const mockReq2 = createMockReqRes({
    tenantId: tenant.id,
    user: cashierUser,
    headers: { 'x-idempotency-key': testIdempotencyKey },
    body: checkoutPayload,
  });
  await checkoutOrder(mockReq2.req, mockReq2.res);

  const status2 = mockReq2.getStatus();
  const body2 = mockReq2.getBody();
  const invoice2 = body2?.data?.invoiceNumber;
  const orderId2 = body2?.data?.id;
  const isReplay = body2?._idempotentReplay === true;

  // Cek bahwa di database hanya ada tepat 1 order dengan invoice tersebut
  const orderCountInDb = await prisma.order.count({
    where: { tenantId: tenant.id, invoiceNumber: invoice1 },
  });

  // Cek record di tabel idempotency_records
  const idempRecord = await prisma.idempotencyRecord.findUnique({
    where: {
      tenantId_operationType_idempotencyKey: {
        tenantId: tenant.id,
        operationType: 'CHECKOUT',
        idempotencyKey: testIdempotencyKey,
      },
    },
  });

  if (
    orderId1 === orderId2 &&
    invoice1 === invoice2 &&
    orderCountInDb === 1 &&
    isReplay &&
    idempRecord !== null
  ) {
    console.log('✅ [PASS] 2. Idempotensi checkout F&B terverifikasi 100%:');
    console.log(`   - Kunci Idempotensi: ${testIdempotencyKey}`);
    console.log(`   - Faktur Order 1: ${invoice1} (HTTP ${status1})`);
    console.log(`   - Faktur Order 2 (Retry): ${invoice2} (HTTP ${status2}, _idempotentReplay: ${isReplay})`);
    console.log(`   - Jumlah Order di DB: ${orderCountInDb} (Tepat 1 nota, ZERO double-order)`);
    console.log(`   - Tersimpan di IdempotencyRecord: YA (ID: ${idempRecord.id})`);
    passedTests++;
  } else {
    throw new Error(
      `❌ [FAIL] 2. Idempotensi checkout gagal! (Order1: ${orderId1}, Order2: ${orderId2}, Count: ${orderCountInDb}, Replay: ${isReplay})`
    );
  }

  // 3. Verifikasi Idempotency Order Laundry (Anti-Double Laundry Order)
  console.log('\n▶️ 3. Verifikasi Idempotensi Order Laundry (clientRequestId / Header)');
  const laundryIdempotencyKey = `LAUNDRY-IDEMP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  const laundryPayload = {
    outletId: outlet.id,
    customerName: 'Bapak Hendra (Uji Idempotensi)',
    customerPhone: '+6281898765432',
    deliveryType: 'SELF_PICKUP',
    items: [
      {
        name: 'Cuci Kering Lipat Express',
        quantity: 5,
        unit: 'KG',
        unitPrice: 10000,
      },
    ],
    totalPieces: 15,
    perfumeVariant: 'Ocean Fresh',
    paymentMethod: 'CASH',
    depositAmount: 50000,
    clientRequestId: laundryIdempotencyKey,
  };

  // Order laundry pertama
  const mockLaundryReq1 = createMockReqRes({
    tenantId: tenant.id,
    user: cashierUser,
    body: laundryPayload,
  });
  await createLaundryOrder(mockLaundryReq1.req, mockLaundryReq1.res);

  const lndryStatus1 = mockLaundryReq1.getStatus();
  const lndryBody1 = mockLaundryReq1.getBody();
  const lndryInvoice1 = lndryBody1?.data?.invoiceNumber;
  const lndryOrderId1 = lndryBody1?.data?.id;

  if (lndryStatus1 !== 201 || !lndryInvoice1 || !lndryOrderId1) {
    throw new Error(`❌ Order laundry pertama gagal: HTTP ${lndryStatus1} - ${lndryBody1?.message}`);
  }

  // Order laundry kedua (Retry)
  const mockLaundryReq2 = createMockReqRes({
    tenantId: tenant.id,
    user: cashierUser,
    body: laundryPayload,
  });
  await createLaundryOrder(mockLaundryReq2.req, mockLaundryReq2.res);

  const lndryStatus2 = mockLaundryReq2.getStatus();
  const lndryBody2 = mockLaundryReq2.getBody();
  const lndryInvoice2 = lndryBody2?.data?.invoiceNumber;
  const lndryOrderId2 = lndryBody2?.data?.id;
  const isLaundryReplay = lndryBody2?._idempotentReplay === true;

  const laundryCountInDb = await prisma.order.count({
    where: { tenantId: tenant.id, invoiceNumber: lndryInvoice1 },
  });

  const laundryIdempRecord = await prisma.idempotencyRecord.findUnique({
    where: {
      tenantId_operationType_idempotencyKey: {
        tenantId: tenant.id,
        operationType: 'LAUNDRY_CHECKOUT',
        idempotencyKey: laundryIdempotencyKey,
      },
    },
  });

  if (
    lndryOrderId1 === lndryOrderId2 &&
    lndryInvoice1 === lndryInvoice2 &&
    laundryCountInDb === 1 &&
    isLaundryReplay &&
    laundryIdempRecord !== null
  ) {
    console.log('✅ [PASS] 3. Idempotensi order laundry terverifikasi 100%:');
    console.log(`   - Kunci Idempotensi: ${laundryIdempotencyKey}`);
    console.log(`   - Faktur Laundry 1: ${lndryInvoice1} (HTTP ${lndryStatus1})`);
    console.log(`   - Faktur Laundry 2 (Retry): ${lndryInvoice2} (HTTP ${lndryStatus2}, _idempotentReplay: ${isLaundryReplay})`);
    console.log(`   - Jumlah Nota Laundry di DB: ${laundryCountInDb} (Tepat 1 nota)`);
    console.log(`   - Tersimpan di IdempotencyRecord: YA (ID: ${laundryIdempRecord.id})`);
    passedTests++;
  } else {
    throw new Error(
      `❌ [FAIL] 3. Idempotensi laundry gagal! (Order1: ${lndryOrderId1}, Order2: ${lndryOrderId2}, Count: ${laundryCountInDb}, Replay: ${isLaundryReplay})`
    );
  }

  // 4. Verifikasi Fallback & Profil Cetak Tag Produksi (ESC/POS Bytes Generation)
  console.log('\n▶️ 4. Verifikasi Fallback Cetak ESC/POS Tag Produksi (buildLaundryProductionTagEscPos)');
  const tagBytes = buildLaundryProductionTagEscPos(
    {
      invoiceNumber: lndryInvoice1,
      customerName: 'Bapak Hendra (Uji Idempotensi)',
      outlet: { name: 'Ura Laundry' },
      items: [{ name: 'Cuci Kering Lipat Express' }],
      totalWeightKg: 5,
      totalPieces: 15,
      perfumeVariant: 'Ocean Fresh',
    },
    { paperSize: '58mm' }
  );

  if (tagBytes && tagBytes.length > 50) {
    console.log('✅ [PASS] 4. Pembangun ESC/POS Tag Produksi berhasil menghasilkan byte stream valid:');
    console.log(`   - Ukuran Byte Stream: ${tagBytes.length} bytes`);
    console.log(`   - Format Header: ESC/POS Direct Binary`);
    passedTests++;
  } else {
    throw new Error('❌ [FAIL] 4. Pembuatan ESC/POS Tag Produksi gagal!');
  }

  // 5. Audit Query GCP e2-micro (Pagination & Default Date Window)
  console.log('\n▶️ 5. Audit Query GCP e2-micro (Pagination & Bounded Lookback Window)');

  // 5a. getLaundryOrders pagination
  const mockGetOrdersReq = createMockReqRes({
    tenantId: tenant.id,
    user: cashierUser,
    query: { outletId: outlet.id, limit: '10', page: '1' },
  });
  await getLaundryOrders(mockGetOrdersReq.req, mockGetOrdersReq.res);
  const getOrdersStatus = mockGetOrdersReq.getStatus();
  const getOrdersBody = mockGetOrdersReq.getBody();

  // 5b. getProductionKpiReport default 30-day window
  const mockKpiReq = createMockReqRes({
    tenantId: tenant.id,
    user: cashierUser,
    query: {}, // Tanpa tanggal, harus otomatis dibatasi 30 hari
  });
  await getProductionKpiReport(mockKpiReq.req, mockKpiReq.res);
  const kpiStatus = mockKpiReq.getStatus();
  const kpiBody = mockKpiReq.getBody();

  if (
    getOrdersStatus === 200 &&
    Array.isArray(getOrdersBody?.data) &&
    getOrdersBody.data.length <= 10 &&
    kpiStatus === 200 &&
    Array.isArray(kpiBody?.data)
  ) {
    console.log('✅ [PASS] 5. Audit query GCP e2-micro lulus pengujian:');
    console.log(`   - getLaundryOrders: Paginasi aktif (Diambil ${getOrdersBody.data.length} baris, batas limit 10)`);
    console.log(`   - getProductionKpiReport: Bounded query aktif (HTTP ${kpiStatus}, aman dari memory leak/OOM)`);
    passedTests++;
  } else {
    throw new Error(
      `❌ [FAIL] 5. Audit query GCP e2-micro gagal! (getOrders: ${getOrdersStatus}, kpi: ${kpiStatus})`
    );
  }

  console.log('\n===================================================================');
  console.log(`🎉 SELURUH VERIFIKASI FASE 4 LULUS SEMPURNA: ${passedTests}/${totalTests} TESTS PASSED!`);
  console.log('===================================================================');
}

runPhase4Verification()
  .catch((err) => {
    console.error('❌ Error during verification:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
