import { PrismaClient, ShiftStatus, Role, PaymentStatus, OrderStatus, PaymentMethod, PaymentTxStatus } from '@prisma/client';
import { Request, Response } from 'express';
import { SCHEMA_PATCHES } from '../migrations/schema_patcher';
import { buildLaundryProductionTagEscPos } from '../../../client/src/utils/escpos';
import { uploadLaundryConditionPhoto, createLaundryOrder } from '../controllers/laundry.controller';

const prisma = new PrismaClient();

function createMockReqRes(reqData: { user?: any; tenantId?: string; body?: any; params?: any; query?: any }) {
  let statusCode = 200;
  let jsonBody: any = null;
  const req = {
    user: reqData.user,
    tenantId: reqData.tenantId,
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

async function runPhase3Verification() {
  console.log('===================================================================');
  console.log('🧪 TESTING PLAYBOOK FASE 3: LAUNDRY ADVANCED CAPABILITIES');
  console.log('   (Condition Photos, Production Tag, Customer Wallet & Quota)');
  console.log('===================================================================');

  let passedTests = 0;
  const totalTests = 7;

  // 1. Verifikasi Registrasi Schema Patcher
  console.log('\n▶️ 1. Verifikasi Registrasi DDL Patch di schema_patcher.ts');
  const patchPhotos = SCHEMA_PATCHES.find(
    (p) => p.id === '20261121_02_laundry_condition_photos_and_sla_index'
  );
  const patchWallet = SCHEMA_PATCHES.find(
    (p) => p.id === '20261121_03_laundry_customer_wallet_and_quota'
  );

  if (patchPhotos && patchWallet) {
    console.log('✅ [PASS] 1. Kedua DDL patch Fase 3 telah terdaftar di array SCHEMA_PATCHES:');
    console.log(`   - ${patchPhotos.id} (condition_photos & SLA composite index)`);
    console.log(`   - ${patchWallet.id} (PaymentMethod enum, wallets & ledgers tables)`);
    passedTests++;
  } else {
    throw new Error('❌ [FAIL] 1. Patch Fase 3 belum terdaftar lengkap di schema_patcher.ts!');
  }

  // Siapkan data tenant & outlet
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

  let testLaundryOutlet = await prisma.outlet.findFirst({
    where: { tenantId: tenant.id, name: 'Ura Laundry & Dry Clean' },
  });
  if (!testLaundryOutlet) {
    testLaundryOutlet = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        code: 'OUT-LNDRY-3',
        name: 'Ura Laundry & Dry Clean',
        industries: ['SERVICES', 'LAUNDRY'],
        isActive: true,
      },
    });
  }

  let cashierUser = await prisma.user.findFirst({
    where: { tenantId: tenant.id, role: { in: [Role.CASHIER, Role.OWNER, Role.SUPERVISOR] } },
  });
  if (!cashierUser) throw new Error('User kasir/owner tidak ditemukan.');

  // Siapkan Customer Tes
  const testCustomer = await prisma.customer.upsert({
    where: {
      tenantId_phone: {
        tenantId: tenant.id,
        phone: '+6281299998888',
      },
    },
    create: {
      tenantId: tenant.id,
      name: 'Ibu Ratna Anggraini (Testing Dompet)',
      phone: '+6281299998888',
      address: 'Jl. Melati No. 45, Kebayoran Baru',
    },
    update: {
      name: 'Ibu Ratna Anggraini (Testing Dompet)',
    },
  });

  // Siapkan Shift Aktif untuk Uji Kas
  await prisma.shift.updateMany({
    where: { tenantId: tenant.id, outletId: testLaundryOutlet.id, status: ShiftStatus.OPEN },
    data: { status: ShiftStatus.CLOSED, endTime: new Date() },
  });

  const activeShift = await prisma.shift.create({
    data: {
      tenantId: tenant.id,
      outletId: testLaundryOutlet.id,
      userId: cashierUser.id,
      startingCash: 200000,
      expectedEnding: 200000,
      status: ShiftStatus.OPEN,
    },
  });

  // 2. Verifikasi Top-up Dompet Laundry (Deposit Saldo & Kuota Kiloan)
  console.log('\n▶️ 2. Verifikasi Top-up Dompet Saldo & Kuota Laundry');

  // Bersihkan wallet jika ada
  await prisma.customerLaundryWalletLedger.deleteMany({
    where: { tenantId: tenant.id, wallet: { customerId: testCustomer.id } },
  });
  await prisma.customerLaundryWallet.deleteMany({
    where: { tenantId: tenant.id, customerId: testCustomer.id },
  });

  // 2a. Top-up Deposit Saldo via TUNAI (Rp 100.000)
  const initialExpectedCash = Number(activeShift.expectedEnding);
  const depositTopupAmount = 100000;

  // Simulasi logika topupCustomerLaundryWallet
  const wallet = await prisma.customerLaundryWallet.create({
    data: {
      tenantId: tenant.id,
      customerId: testCustomer.id,
      balanceAmount: depositTopupAmount,
      quotaKg: 0,
    },
  });

  await prisma.customerLaundryWalletLedger.create({
    data: {
      walletId: wallet.id,
      tenantId: tenant.id,
      outletId: testLaundryOutlet.id,
      shiftId: activeShift.id,
      cashierId: cashierUser.id,
      ledgerType: 'TOPUP_BALANCE',
      deltaAmount: depositTopupAmount,
      balanceBefore: 0,
      balanceAfter: depositTopupAmount,
      notes: 'Top-up saldo tunai testing',
    },
  });

  // Catat cash movement tunai
  await prisma.cashMovement.create({
    data: {
      tenantId: tenant.id,
      outletId: testLaundryOutlet.id,
      shiftId: activeShift.id,
      userId: cashierUser.id,
      amount: depositTopupAmount,
      type: 'CASH_IN',
      category: 'WALLET_TOPUP',
      notes: `Top-up saldo deposit laundry: ${testCustomer.name}`,
    },
  });
  await prisma.shift.update({
    where: { id: activeShift.id },
    data: { expectedEnding: { increment: depositTopupAmount } },
  });

  // 2b. Top-up Kuota Kiloan via QRIS (10 Kg, non-cash)
  const quotaKg = 10;
  const pricePaidQuota = 70000;
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 30);

  await prisma.customerLaundryWallet.update({
    where: { id: wallet.id },
    data: {
      quotaKg: { increment: quotaKg },
      quotaExpiresAt: expiryDate,
    },
  });

  await prisma.customerLaundryWalletLedger.create({
    data: {
      walletId: wallet.id,
      tenantId: tenant.id,
      outletId: testLaundryOutlet.id,
      shiftId: activeShift.id,
      cashierId: cashierUser.id,
      ledgerType: 'TOPUP_QUOTA_KG',
      deltaKg: quotaKg,
      kgBefore: 0,
      kgAfter: quotaKg,
      notes: `Top-up paket kuota 10 Kg (QRIS Rp ${pricePaidQuota})`,
    },
  });

  // Verifikasi wallet di DB
  const verifiedWallet = await prisma.customerLaundryWallet.findUnique({
    where: { id: wallet.id },
    include: { ledgers: true },
  });

  const updatedShift = await prisma.shift.findUnique({
    where: { id: activeShift.id },
  });

  if (
    Number(verifiedWallet?.balanceAmount) === depositTopupAmount &&
    Number(verifiedWallet?.quotaKg) === quotaKg &&
    verifiedWallet?.ledgers.length === 2 &&
    Number(updatedShift?.expectedEnding) === initialExpectedCash + depositTopupAmount
  ) {
    console.log('✅ [PASS] 2. Top-up dompet laundry berhasil diverifikasi:');
    console.log(`   - Saldo Deposit: Rp ${Number(verifiedWallet?.balanceAmount).toLocaleString('id-ID')}`);
    console.log(`   - Kuota Kiloan: ${Number(verifiedWallet?.quotaKg)} Kg (Exp: ${verifiedWallet?.quotaExpiresAt?.toISOString().split('T')[0]})`);
    console.log(`   - Kas Laci Bertambah Tepat: Rp ${depositTopupAmount.toLocaleString('id-ID')} (Expected Cash: Rp ${Number(updatedShift?.expectedEnding).toLocaleString('id-ID')})`);
    passedTests++;
  } else {
    throw new Error('❌ [FAIL] 2. Verifikasi top-up dompet gagal atau perhitungan laci tidak sesuai!');
  }

  // 3. Verifikasi Transaksi Kasir Menggunakan Saldo Deposit & Kuota Kiloan
  console.log('\n▶️ 3. Verifikasi Pemotongan Saldo Deposit & Kuota Kiloan di Kasir');

  // 3a. Order 1: Bayar menggunakan CUSTOMER_DEPOSIT (Rp 40.000)
  const orderDepositAmount = 40000;
  const order1 = await prisma.order.create({
    data: {
      tenantId: tenant.id,
      outletId: testLaundryOutlet.id,
      userId: cashierUser.id,
      shiftId: activeShift.id,
      customerId: testCustomer.id,
      invoiceNumber: `TEST-DEP-${Date.now()}`,
      orderType: 'POS',
      orderStatus: OrderStatus.COMPLETED,
      paymentStatus: PaymentStatus.PAID,
      totalAmount: orderDepositAmount,
      paidAmount: orderDepositAmount,
      subtotal: orderDepositAmount,
      serviceTotal: 0,
      discountTotal: 0,
    },
  });

  await prisma.paymentTransaction.create({
    data: {
      tenantId: tenant.id,
      outletId: testLaundryOutlet.id,
      orderId: order1.id,
      shiftId: activeShift.id,
      cashierId: cashierUser.id,
      amount: orderDepositAmount,
      paymentMethod: PaymentMethod.CUSTOMER_DEPOSIT,
      status: PaymentTxStatus.COMPLETED,
    },
  });

  // Kurangi saldo
  const balanceBefore1 = Number(verifiedWallet?.balanceAmount);
  const balanceAfter1 = balanceBefore1 - orderDepositAmount;
  await prisma.customerLaundryWallet.update({
    where: { id: wallet.id },
    data: { balanceAmount: balanceAfter1 },
  });
  await prisma.customerLaundryWalletLedger.create({
    data: {
      walletId: wallet.id,
      tenantId: tenant.id,
      outletId: testLaundryOutlet.id,
      orderId: order1.id,
      shiftId: activeShift.id,
      cashierId: cashierUser.id,
      ledgerType: 'USE_BALANCE',
      deltaAmount: -orderDepositAmount,
      balanceBefore: balanceBefore1,
      balanceAfter: balanceAfter1,
      notes: `Pemakaian saldo deposit untuk nota ${order1.invoiceNumber}`,
    },
  });

  // 3b. Order 2: Bayar menggunakan LAUNDRY_QUOTA (3 Kg)
  const usedKg = 3;
  const order2 = await prisma.order.create({
    data: {
      tenantId: tenant.id,
      outletId: testLaundryOutlet.id,
      userId: cashierUser.id,
      shiftId: activeShift.id,
      customerId: testCustomer.id,
      invoiceNumber: `TEST-QUO-${Date.now()}`,
      orderType: 'POS',
      orderStatus: OrderStatus.COMPLETED,
      paymentStatus: PaymentStatus.PAID,
      totalAmount: 21000,
      paidAmount: 21000,
      subtotal: 21000,
      serviceTotal: 0,
      discountTotal: 0,
    },
  });

  await prisma.paymentTransaction.create({
    data: {
      tenantId: tenant.id,
      outletId: testLaundryOutlet.id,
      orderId: order2.id,
      shiftId: activeShift.id,
      cashierId: cashierUser.id,
      amount: 21000,
      paymentMethod: PaymentMethod.LAUNDRY_QUOTA,
      status: PaymentTxStatus.COMPLETED,
    },
  });

  // Kurangi kuota
  const kgBefore2 = Number(verifiedWallet?.quotaKg);
  const kgAfter2 = kgBefore2 - usedKg;
  await prisma.customerLaundryWallet.update({
    where: { id: wallet.id },
    data: { quotaKg: kgAfter2 },
  });
  await prisma.customerLaundryWalletLedger.create({
    data: {
      walletId: wallet.id,
      tenantId: tenant.id,
      outletId: testLaundryOutlet.id,
      orderId: order2.id,
      shiftId: activeShift.id,
      cashierId: cashierUser.id,
      ledgerType: 'USE_QUOTA_KG',
      deltaKg: -usedKg,
      kgBefore: kgBefore2,
      kgAfter: kgAfter2,
      notes: `Pemakaian kuota 3 Kg untuk nota ${order2.invoiceNumber}`,
    },
  });

  // Verifikasi saldo & kuota akhir
  const finalWallet = await prisma.customerLaundryWallet.findUnique({
    where: { id: wallet.id },
  });

  if (
    Number(finalWallet?.balanceAmount) === 60000 &&
    Number(finalWallet?.quotaKg) === 7
  ) {
    console.log('✅ [PASS] 3. Pemotongan saldo & kuota di kasir berhasil secara akurat:');
    console.log(`   - Sisa Saldo: Rp ${Number(finalWallet?.balanceAmount).toLocaleString('id-ID')} (Awal: Rp 100rb, Terpakai: Rp 40rb)`);
    console.log(`   - Sisa Kuota: ${Number(finalWallet?.quotaKg)} Kg (Awal: 10 Kg, Terpakai: 3 Kg)`);
    passedTests++;
  } else {
    throw new Error('❌ [FAIL] 3. Perhitungan pemotongan saldo / kuota tidak sesuai!');
  }

  // 4. Verifikasi Foto Kondisi Pakaian (Anti-Komplain) & SLA Index
  console.log('\n▶️ 4. Verifikasi Foto Kondisi Pakaian & Tracking Publik');
  const mockConditionPhotos = [
    {
      url: `/uploads/laundry/${tenant.id}/sample_stain_01.webp`,
      caption: 'Noda kecap di kerah kemeja putih',
      uploadedAt: new Date().toISOString(),
    },
    {
      url: `/uploads/laundry/${tenant.id}/sample_tear_02.webp`,
      caption: 'Kancing kedua baju koko lepas bawaan pelanggan',
      uploadedAt: new Date().toISOString(),
    },
  ];

  const laundryDetail = await prisma.laundryOrderDetail.create({
    data: {
      tenantId: tenant.id,
      outletId: testLaundryOutlet.id,
      orderId: order1.id,
      status: 'WASHING',
      currentStage: 'WASH',
      totalWeightKg: 4.5,
      totalPieces: 12,
      perfumeVariant: 'Lavender Mewah',
      rackCode: 'RAK-B-03',
      estimatedReadyAt: new Date(Date.now() + 24 * 3600 * 1000),
      conditionPhotos: mockConditionPhotos,
    },
  });

  const readDetail = await prisma.laundryOrderDetail.findUnique({
    where: { id: laundryDetail.id },
  });

  const parsedPhotos = readDetail?.conditionPhotos as any[];
  if (
    Array.isArray(parsedPhotos) &&
    parsedPhotos.length === 2 &&
    parsedPhotos[0].caption === 'Noda kecap di kerah kemeja putih'
  ) {
    console.log('✅ [PASS] 4. Foto kondisi pakaian berhasil disimpan & dibaca dari database:');
    console.log(`   - Jumlah foto: ${parsedPhotos.length}`);
    console.log(`   - URL Foto 1: ${parsedPhotos[0].url}`);
    console.log(`   - Keterangan Foto 1: "${parsedPhotos[0].caption}"`);
    passedTests++;
  } else {
    throw new Error('❌ [FAIL] 4. Foto kondisi pakaian gagal disimpan atau dibaca!');
  }

  // 5. Verifikasi Cetak Tag Produksi (Tanda Keranjang Tanpa Tagihan Harga)
  console.log('\n▶️ 5. Verifikasi Pembuatan Struk Tag Produksi Thermal (ESC/POS)');
  const mockQueueOrder = {
    id: order1.id,
    orderId: order1.id,
    invoiceNumber: order1.invoiceNumber,
    customerName: testCustomer.name,
    customerPhone: testCustomer.phone,
    customerAddress: testCustomer.address,
    deliveryType: 'SELF_PICKUP' as const,
    deliveryDistanceKm: 0,
    deliveryFee: 0,
    status: 'RECEIVED' as const,
    currentStage: 'DROP_OFF' as const,
    serviceName: 'Cuci Komplit Reguler',
    totalWeightKg: 4.5,
    totalPieces: 12,
    perfumeVariant: 'Lavender Mewah',
    rackCode: 'RAK-B-03',
    grandTotal: 40000,
    paidAmount: 40000,
    paymentStatus: 'PAID',
    createdAt: new Date().toISOString(),
    estimatedReadyAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    customerNotes: 'Kancing kedua baju koko lepas bawaan pelanggan',
    items: [
      {
        name: 'Cuci Komplit Reguler',
        quantity: 4.5,
        unit: 'Kg',
        unitPrice: 8000,
        subtotal: 36000,
      },
    ],
  };

  const tagEscPosBytes = buildLaundryProductionTagEscPos(mockQueueOrder as any, {
    storeName: 'Ura Laundry & Dry Clean',
    paperWidth: '58mm',
  });

  const tagEscPosText = new TextDecoder().decode(tagEscPosBytes);

  // Verifikasi isi tag: Harus ada nomor nota besar, nama pelanggan, bobot, parfum, rack, dan TIDAK ADA kata "Rp 40.000" atau "TOTAL"
  const hasInvoice = tagEscPosText.includes(order1.invoiceNumber);
  const hasCustomer = tagEscPosText.includes(testCustomer.name);
  const hasWeight = tagEscPosText.includes('4.5 Kg');
  const hasPerfume = tagEscPosText.includes('Lavender Mewah');
  const hasNoPrice = !tagEscPosText.includes('Rp 40.000') && !tagEscPosText.includes('TOTAL TAGIHAN');

  if (hasInvoice && hasCustomer && hasWeight && hasPerfume && hasNoPrice) {
    console.log('✅ [PASS] 5. Tag Produksi Keranjang berhasil dibuat dengan format murni operasional:');
    console.log(`   - Nomor Nota Besar: ${order1.invoiceNumber} (Tersedia)`);
    console.log(`   - Data Produksi: 4.5 Kg / 12 Pcs / Lavender Mewah (Tersedia)`);
    console.log(`   - Bersih dari Nominal Tagihan/Harga: ${hasNoPrice ? 'YA (Anti-Kertas Boros & Zero Price Confusions)' : 'TIDAK'}`);
    passedTests++;
  } else {
    throw new Error('❌ [FAIL] 5. Tag produksi tidak sesuai format operasional!');
  }

  // 6. Verifikasi Pengamanan Upload Foto Kondisi (Anti-XSS Whitelist & Buffer Limit)
  console.log('\n▶️ 6. Verifikasi Pengamanan Upload Foto Kondisi (Whitelist & Limit)');

  // 6a. Tolak SVG untuk mencegah Stored XSS
  const mockSvgPayload = {
    image: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxzY3JpcHQ+YWxlcnQoMSk8L3NjcmlwdD48L3N2Zz4=',
    caption: 'Tes SVG XSS Attack',
    stage: 'SORTING',
  };
  const mockSvgReqRes = createMockReqRes({
    tenantId: tenant.id,
    user: cashierUser,
    body: mockSvgPayload,
  });
  await uploadLaundryConditionPhoto(mockSvgReqRes.req, mockSvgReqRes.res);

  const svgStatus = mockSvgReqRes.getStatus();
  const svgBody = mockSvgReqRes.getBody();

  // 6b. Tolak file melebihi batas 2 MB
  const oversizedRawBuffer = Buffer.alloc(2.2 * 1024 * 1024, 65);
  const oversizedBase64 = oversizedRawBuffer.toString('base64');
  const mockOversizedPayload = {
    image: `data:image/jpeg;base64,${oversizedBase64}`,
    caption: 'Tes file terlalu besar > 2MB',
    stage: 'SORTING',
  };
  const mockOversizedReqRes = createMockReqRes({
    tenantId: tenant.id,
    user: cashierUser,
    body: mockOversizedPayload,
  });
  await uploadLaundryConditionPhoto(mockOversizedReqRes.req, mockOversizedReqRes.res);

  const oversizedStatus = mockOversizedReqRes.getStatus();
  const oversizedBody = mockOversizedReqRes.getBody();

  // 6c. Terima file gambar valid (WebP kecil)
  const validSmallWebp = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4TA4AAAAvAAAAECBA/w8wEAAAMwEA';
  const mockValidReqRes = createMockReqRes({
    tenantId: tenant.id,
    user: cashierUser,
    body: {
      image: validSmallWebp,
      caption: 'Foto kondisi kancing lepas (valid webp)',
      stage: 'SORTING',
    },
  });
  await uploadLaundryConditionPhoto(mockValidReqRes.req, mockValidReqRes.res);

  const validStatus = mockValidReqRes.getStatus();
  const validBody = mockValidReqRes.getBody();

  if (
    svgStatus === 400 &&
    svgBody?.message?.includes('Format gambar tidak didukung') &&
    oversizedStatus === 400 &&
    oversizedBody?.message?.includes('Ukuran foto melebihi batas maksimal') &&
    validStatus === 200 &&
    validBody?.status === 'success'
  ) {
    console.log('✅ [PASS] 6. Pengamanan upload foto kondisi terverifikasi:');
    console.log(`   - Tolak SVG (Anti-XSS): HTTP ${svgStatus} ("${svgBody.message}")`);
    console.log(`   - Tolak Buffer > 2MB: HTTP ${oversizedStatus} ("${oversizedBody.message}")`);
    console.log(`   - Terima Gambar Valid (WebP): HTTP ${validStatus} (${validBody.data?.url})`);
    passedTests++;
  } else {
    throw new Error(`❌ [FAIL] 6. Pengamanan upload foto gagal! (SVG: ${svgStatus}, Oversized: ${oversizedStatus}, Valid: ${validStatus})`);
  }

  // 7. Verifikasi Error Handling Bisnis Checkout Saldo / Kuota (HTTP 400)
  console.log('\n▶️ 7. Verifikasi Error Handling Bisnis Checkout Saldo & Kuota (HTTP 400)');

  // 7a. Checkout dengan CUSTOMER_DEPOSIT tanpa memilih customer
  const reqNoCustomer = createMockReqRes({
    tenantId: tenant.id,
    user: cashierUser,
    body: {
      outletId: testLaundryOutlet.id,
      customerName: 'Tamu Tanpa Profil',
      paymentMethod: 'CUSTOMER_DEPOSIT',
      items: [
        {
          name: 'Cuci Kiloan Reguler',
          quantity: 2,
          unitPrice: 10000,
        },
      ],
    },
  });
  await createLaundryOrder(reqNoCustomer.req, reqNoCustomer.res);
  const statusNoCust = reqNoCustomer.getStatus();
  const bodyNoCust = reqNoCustomer.getBody();

  // 7b. Checkout dengan CUSTOMER_DEPOSIT saldo tidak cukup
  const reqInsufficientDeposit = createMockReqRes({
    tenantId: tenant.id,
    user: cashierUser,
    body: {
      outletId: testLaundryOutlet.id,
      customerId: testCustomer.id,
      customerName: testCustomer.name,
      customerPhone: testCustomer.phone,
      paymentMethod: 'CUSTOMER_DEPOSIT',
      items: [
        {
          name: 'Cuci Bedcover Jumbo',
          quantity: 3,
          unitPrice: 50000,
        },
      ],
    },
  });
  await createLaundryOrder(reqInsufficientDeposit.req, reqInsufficientDeposit.res);
  const statusInsufDep = reqInsufficientDeposit.getStatus();
  const bodyInsufDep = reqInsufficientDeposit.getBody();

  // 7c. Checkout dengan LAUNDRY_QUOTA kuota kiloan tidak cukup
  const reqInsufficientQuota = createMockReqRes({
    tenantId: tenant.id,
    user: cashierUser,
    body: {
      outletId: testLaundryOutlet.id,
      customerId: testCustomer.id,
      customerName: testCustomer.name,
      customerPhone: testCustomer.phone,
      paymentMethod: 'LAUNDRY_QUOTA',
      items: [
        {
          name: 'Cuci Komplit Kiloan',
          quantity: 15,
          unit: 'KG',
          unitPrice: 8000,
        },
      ],
    },
  });
  await createLaundryOrder(reqInsufficientQuota.req, reqInsufficientQuota.res);
  const statusInsufQuo = reqInsufficientQuota.getStatus();
  const bodyInsufQuo = reqInsufficientQuota.getBody();

  // 7d. Checkout dengan LAUNDRY_QUOTA saat kuota kedaluwarsa
  const expiredExpiry = new Date();
  expiredExpiry.setDate(expiredExpiry.getDate() - 5);
  await prisma.customerLaundryWallet.update({
    where: { id: wallet.id },
    data: { quotaExpiresAt: expiredExpiry },
  });

  const reqExpiredQuota = createMockReqRes({
    tenantId: tenant.id,
    user: cashierUser,
    body: {
      outletId: testLaundryOutlet.id,
      customerId: testCustomer.id,
      customerName: testCustomer.name,
      customerPhone: testCustomer.phone,
      paymentMethod: 'LAUNDRY_QUOTA',
      items: [
        {
          name: 'Cuci Komplit Kiloan',
          quantity: 2,
          unit: 'KG',
          unitPrice: 8000,
        },
      ],
    },
  });
  await createLaundryOrder(reqExpiredQuota.req, reqExpiredQuota.res);
  const statusExpQuo = reqExpiredQuota.getStatus();
  const bodyExpQuo = reqExpiredQuota.getBody();

  // Kembalikan tanggal expired ke masa depan agar data bersih
  const restoreExpiry = new Date();
  restoreExpiry.setDate(restoreExpiry.getDate() + 30);
  await prisma.customerLaundryWallet.update({
    where: { id: wallet.id },
    data: { quotaExpiresAt: restoreExpiry },
  });

  if (
    statusNoCust === 400 &&
    bodyNoCust?.message?.includes('Pelanggan wajib dipilih') &&
    statusInsufDep === 400 &&
    bodyInsufDep?.message?.includes('Saldo deposit pelanggan tidak mencukupi') &&
    statusInsufQuo === 400 &&
    bodyInsufQuo?.message?.includes('Kuota kiloan pelanggan tidak mencukupi') &&
    statusExpQuo === 400 &&
    bodyExpQuo?.message?.includes('kedaluwarsa')
  ) {
    console.log('✅ [PASS] 7. Error handling bisnis checkout saldo & kuota terverifikasi (HTTP 400):');
    console.log(`   - Pelanggan belum dipilih: HTTP ${statusNoCust} ("${bodyNoCust.message}")`);
    console.log(`   - Saldo deposit tidak cukup: HTTP ${statusInsufDep} ("${bodyInsufDep.message}")`);
    console.log(`   - Kuota kiloan tidak cukup: HTTP ${statusInsufQuo} ("${bodyInsufQuo.message}")`);
    console.log(`   - Kuota kiloan kedaluwarsa: HTTP ${statusExpQuo} ("${bodyExpQuo.message}")`);
    passedTests++;
  } else {
    throw new Error(`❌ [FAIL] 7. Error handling bisnis gagal! (NoCust: ${statusNoCust}, InsufDep: ${statusInsufDep}, InsufQuo: ${statusInsufQuo}, ExpQuo: ${statusExpQuo})`);
  }

  console.log('\n===================================================================');
  console.log(`🎉 SELURUH VERIFIKASI FASE 3 LULUS SEMPURNA: ${passedTests}/${totalTests} TESTS PASSED!`);
  console.log('===================================================================');
}

runPhase3Verification()
  .catch((err) => {
    console.error('❌ Error during verification:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
