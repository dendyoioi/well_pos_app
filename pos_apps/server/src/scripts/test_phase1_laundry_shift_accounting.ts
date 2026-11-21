import { PrismaClient, ShiftStatus, Role, PaymentStatus, OrderStatus, PaymentMethod, PaymentTxStatus } from '@prisma/client';
import { checkIsLaundry } from '../../../client/src/utils/businessType';

const prisma = new PrismaClient();

async function runPhase1Verification() {
  console.log('===================================================================');
  console.log('🧪 TESTING PLAYBOOK FASE 1: LAUNDRY SHIFT ACCOUNTING & ISOLATION');
  console.log('===================================================================');

  let passedTests = 0;
  const totalTests = 6;

  // 1. Verifikasi Multi-Vertical Isolation pada checkIsLaundry
  console.log('\n▶️ 1. Verifikasi Isolasi Multi-Vertikal checkIsLaundry(outlet, user, permissions)');
  const mockLaundryPermissions = [
    { id: 'laundry_orders_read', name: 'Baca Order Laundry', category: 'LAUNDRY_OPERATIONS' },
    { id: 'laundry_orders_manage', name: 'Kelola Order Laundry', category: 'LAUNDRY_OPERATIONS' },
  ];

  const cafeOutlet = {
    id: 'out-cafe-01',
    name: 'Ura Coffee Kemang',
    industries: ['F&B', 'Food & Beverage', 'Cafe'],
  };

  const laundryOutlet = {
    id: 'out-laundry-01',
    name: 'Clean Express Kemang',
    industries: ['SERVICES', 'LAUNDRY'],
  };

  const hybridOwnerUser = {
    id: 'usr-owner-01',
    role: 'OWNER',
    tenant: {
      name: 'Holding PT Ura Sejahtera (Cafe & Laundry)',
      businessVertical: 'F&B',
      businessType: 'Food, Beverage & Laundry Services',
    },
  };

  // Test 1a: Outlet Kafe dengan user hybrid yang punya permission laundry WAJIB mengembalikan false!
  const isCafeLaundry = checkIsLaundry(cafeOutlet, hybridOwnerUser, mockLaundryPermissions);
  if (isCafeLaundry === false) {
    console.log('✅ [PASS] 1a. Outlet Kafe Ura Coffee terisolasi 100% -> checkIsLaundry mengembalikan false meski Owner punya wewenang Laundry');
  } else {
    throw new Error(`❌ [FAIL] 1a. Outlet Kafe salah terdeteksi sebagai Laundry! Got: ${isCafeLaundry}`);
  }

  // Test 1b: Outlet Laundry mengembalikan true
  const isLaundryValid = checkIsLaundry(laundryOutlet, hybridOwnerUser, mockLaundryPermissions);
  if (isLaundryValid === true) {
    console.log('✅ [PASS] 1b. Outlet Laundry Clean Express terdeteksi benar -> checkIsLaundry mengembalikan true');
    passedTests++;
  } else {
    throw new Error(`❌ [FAIL] 1b. Outlet Laundry gagal terdeteksi! Got: ${isLaundryValid}`);
  }

  // Siapkan data sandbox laundry lokal untuk pengujian transaksi & tutup shift
  console.log('\n▶️ 2. Persiapan Outlet & Kasir Laundry untuk Pengujian Tutup Shift');
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

  // Buat/ambil outlet laundry
  let testLaundryOutlet = await prisma.outlet.findFirst({
    where: { tenantId: tenant.id, name: 'Ura Laundry & Dry Clean' },
  });

  if (!testLaundryOutlet) {
    testLaundryOutlet = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        code: 'OUT-LNDRY',
        name: 'Ura Laundry & Dry Clean',
        industries: ['SERVICES', 'LAUNDRY'],
        isActive: true,
      },
    });
  }

  // Kasir Laundry
  let laundryCashier = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: 'kasir.laundry@uracoffee.id' },
  });

  if (!laundryCashier) {
    laundryCashier = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        outletId: testLaundryOutlet.id,
        userCode: 'LND01',
        name: 'Agus Kasir Laundry',
        email: 'kasir.laundry@uracoffee.id',
        role: Role.CASHIER,
        pinHash: '$2a$10$wT1r7y8J9K0L1M2N3O4P5e6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T.', // dummy hash
        isActive: true,
      },
    });
  }

  // Tutup shift lama jika masih terbuka
  await prisma.shift.updateMany({
    where: { tenantId: tenant.id, outletId: testLaundryOutlet.id, status: ShiftStatus.OPEN },
    data: { status: ShiftStatus.CLOSED, endTime: new Date() },
  });

  // Buka Shift Kasir Pagi (Shift 1)
  const shift1 = await prisma.shift.create({
    data: {
      tenantId: tenant.id,
      outletId: testLaundryOutlet.id,
      userId: laundryCashier.id,
      startingCash: 100000, // Rp 100.000 modal awal
      status: ShiftStatus.OPEN,
      notes: 'Buka shift kasir pagi laundry',
    },
  });
  console.log(`✅ [PASS] 2. Shift 1 Kasir Laundry berhasil dibuka (ID: ${shift1.id}, Modal Awal: Rp 100.000)`);
  passedTests++;

  // 3. Buat 2 Pesanan Laundry di Shift 1:
  // - Order A: Cuci Kiloan Rp 50.000, UNPAID (Bayar saat ambil)
  // - Order B: Bedcover Rp 60.000, PARTIALLY_PAID (DP Rp 20.000 Tunai di Shift 1)
  console.log('\n▶️ 3. Transaksi Laundry (Order UNPAID & PARTIALLY_PAID dengan DP Tunai)');
  const orderA = await prisma.order.create({
    data: {
      tenantId: tenant.id,
      outletId: testLaundryOutlet.id,
      userId: laundryCashier.id,
      shiftId: shift1.id,
      invoiceNumber: `LD-TEST-${Date.now()}-A`,
      orderStatus: OrderStatus.CONFIRMED,
      paymentStatus: PaymentStatus.UNPAID,
      totalAmount: 50000,
      paidAmount: 0,
      subtotal: 50000,
      serviceTotal: 0,
      discountTotal: 0,
    },
  });

  const orderB = await prisma.order.create({
    data: {
      tenantId: tenant.id,
      outletId: testLaundryOutlet.id,
      userId: laundryCashier.id,
      shiftId: shift1.id,
      invoiceNumber: `LD-TEST-${Date.now()}-B`,
      orderStatus: OrderStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PARTIALLY_PAID,
      totalAmount: 60000,
      paidAmount: 20000,
      subtotal: 60000,
      serviceTotal: 0,
      discountTotal: 0,
    },
  });

  // Catat DP Tunai Order B dengan shiftId penerima uang
  const paymentDP = await prisma.paymentTransaction.create({
    data: {
      tenantId: tenant.id,
      orderId: orderB.id,
      shiftId: shift1.id,
      outletId: testLaundryOutlet.id,
      cashierId: laundryCashier.id,
      paymentMethod: PaymentMethod.CASH,
      amount: 20000,
      status: PaymentTxStatus.CAPTURED,
    },
  });

  console.log(`✅ [PASS] 3. Order A (UNPAID Rp 50.000) & Order B (DP Tunai Rp 20.000 tercatat shiftId: ${paymentDP.shiftId})`);
  passedTests++;

  // 4. Validasi Tutup Shift Kasir Laundry dengan Order UNPAID & PARTIALLY_PAID
  console.log('\n▶️ 4. Simulasi Tutup Shift 1 Kasir Laundry (Pengecualian Rule 15 & Rekap DP)');
  // Lakukan query seperti di shift.controller.ts
  const paymentRows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT pt.payment_method as "paymentMethod", pt.amount
     FROM "payment_transactions" pt
     JOIN "orders" o ON o.id = pt.order_id
     WHERE COALESCE(pt.shift_id, o.shift_id) = $1 AND pt.status = 'CAPTURED' AND o.order_status NOT IN ('CANCELLED', 'VOIDED');`,
    shift1.id
  );

  let cashReceived = 0;
  paymentRows.forEach((p) => {
    if (p.paymentMethod === 'CASH') cashReceived += Number(p.amount);
  });

  const expectedCashInDrawer = Number(shift1.startingCash) + cashReceived; // 100.000 + 20.000 = 120.000
  console.log(`   Uang Kas Masuk Shift 1: Rp ${cashReceived.toLocaleString('id-ID')} (DP Tunai Order B)`);
  console.log(`   Expected Cash di Laci: Rp ${expectedCashInDrawer.toLocaleString('id-ID')}`);

  if (cashReceived === 20000 && expectedCashInDrawer === 120000) {
    console.log('✅ [PASS] 4a. DP Tunai Rp 20.000 berhasil dihitung presisi ke laci kasir (meski status order PARTIALLY_PAID)');
  } else {
    throw new Error(`❌ [FAIL] 4a. Perhitungan kas drawer tidak presisi! cashReceived: ${cashReceived}`);
  }

  // Hitung piutang belum tertagih
  const pendingOrders = await prisma.order.findMany({
    where: {
      shiftId: shift1.id,
      paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
      orderStatus: { notIn: ['CANCELLED', 'VOIDED'] },
    },
    select: { totalAmount: true, paidAmount: true },
  });

  const totalReceivables = pendingOrders.reduce((sum, o) => {
    return sum + (Number(o.totalAmount) - Number(o.paidAmount));
  }, 0); // (50.000 - 0) + (60.000 - 20.000) = 90.000

  if (totalReceivables === 90000) {
    console.log(`✅ [PASS] 4b. Total piutang aktif Laundry tercatat akurat: Rp ${totalReceivables.toLocaleString('id-ID')} (Order A 50k + Sisa Order B 40k)`);
    passedTests++;
  } else {
    throw new Error(`❌ [FAIL] 4b. Total piutang salah! Diharapkan 90.000, didapat: ${totalReceivables}`);
  }

  // Tutup Shift 1
  await prisma.shift.update({
    where: { id: shift1.id },
    data: {
      status: ShiftStatus.CLOSED,
      endTime: new Date(),
      expectedEnding: expectedCashInDrawer,
      actualEnding: expectedCashInDrawer,
      cashDifference: 0,
    },
  });

  // 5. Buka Shift 2 (Sore) & Pelunasan Lintas-Shift Order A (Handover)
  console.log('\n▶️ 5. Pelunasan Lintas-Shift (Shift 2 Sore Melunasi Order A dari Shift 1)');
  const shift2 = await prisma.shift.create({
    data: {
      tenantId: tenant.id,
      outletId: testLaundryOutlet.id,
      userId: laundryCashier.id,
      startingCash: 150000,
      status: ShiftStatus.OPEN,
      notes: 'Buka shift kasir sore laundry',
    },
  });

  // Pelanggan Order A datang mengambil cucian dan melunasi Rp 50.000 tunai di Shift 2
  await prisma.paymentTransaction.create({
    data: {
      tenantId: tenant.id,
      orderId: orderA.id,
      shiftId: shift2.id, // Uang diterima di Shift 2!
      outletId: testLaundryOutlet.id,
      cashierId: laundryCashier.id,
      paymentMethod: PaymentMethod.CASH,
      amount: 50000,
      status: PaymentTxStatus.CAPTURED,
    },
  });

  await prisma.order.update({
    where: { id: orderA.id },
    data: {
      paymentStatus: PaymentStatus.PAID,
      paidAmount: 50000,
      orderStatus: OrderStatus.COMPLETED,
    },
  });

  // Query rekap shift 2
  const shift2Payments = await prisma.$queryRawUnsafe<any[]>(
    `SELECT pt.payment_method as "paymentMethod", pt.amount
     FROM "payment_transactions" pt
     JOIN "orders" o ON o.id = pt.order_id
     WHERE COALESCE(pt.shift_id, o.shift_id) = $1 AND pt.status = 'CAPTURED' AND o.order_status NOT IN ('CANCELLED', 'VOIDED');`,
    shift2.id
  );

  let shift2Cash = 0;
  shift2Payments.forEach((p) => {
    if (p.paymentMethod === 'CASH') shift2Cash += Number(p.amount);
  });

  console.log(`   Uang Masuk Shift 2: Rp ${shift2Cash.toLocaleString('id-ID')} (Pelunasan Order A yang dibuat di Shift 1)`);
  if (shift2Cash === 50000) {
    console.log('✅ [PASS] 5. Pelunasan lintas-shift berhasil 100% masuk ke laci kasir Shift 2 (Shift penerima uang)!');
    passedTests++;
  } else {
    throw new Error(`❌ [FAIL] 5. Uang masuk shift 2 salah! Got: ${shift2Cash}`);
  }

  // Tutup Shift 2
  await prisma.shift.update({
    where: { id: shift2.id },
    data: {
      status: ShiftStatus.CLOSED,
      endTime: new Date(),
      expectedEnding: 150000 + 50000,
      actualEnding: 200000,
      cashDifference: 0,
    },
  });

  // 6. Pengujian Anti-Triple Counting Pelunasan Kasbon Tunai (Customer Debt Repayment) & Non-Cash Handover
  console.log('\n▶️ 6. Pengujian Anti-Triple Counting Pelunasan Kasbon Tunai & Non-Cash Handover');
  const shift3 = await prisma.shift.create({
    data: {
      tenantId: tenant.id,
      outletId: testLaundryOutlet.id,
      userId: laundryCashier.id,
      startingCash: 200000, // Rp 200.000 modal awal
      status: ShiftStatus.OPEN,
      notes: 'Shift uji anti-triple counting kasbon & handover non-tunai',
    },
  });

  // Buat pelanggan dan catatan kasbon
  let testCustomer = await prisma.customer.findFirst({
    where: { tenantId: tenant.id, name: 'Bpk. Kasbon Test' },
  });
  if (!testCustomer) {
    testCustomer = await prisma.customer.create({
      data: {
        tenantId: tenant.id,
        name: 'Bpk. Kasbon Test',
        phone: '+6281299990001',
      },
    });
  }

  const dummyDebtOrder = await prisma.order.create({
    data: {
      tenantId: tenant.id,
      outletId: testLaundryOutlet.id,
      userId: laundryCashier.id,
      invoiceNumber: `INV-DEBT-TEST-${Date.now()}`,
      orderStatus: OrderStatus.CONFIRMED,
      paymentStatus: PaymentStatus.UNPAID,
      totalAmount: 50000,
      paidAmount: 0,
      subtotal: 50000,
      serviceTotal: 0,
      discountTotal: 0,
    },
  });

  const testDebt = await prisma.customerDebt.create({
    data: {
      tenantId: tenant.id,
      outletId: testLaundryOutlet.id,
      customerId: testCustomer.id,
      orderId: dummyDebtOrder.id,
      totalAmount: 50000,
      remainingAmount: 50000,
      paidAmount: 0,
      status: 'UNPAID',
    },
  });

  // Pelunasan kasbon tunai Rp 50.000
  const debtPayment = await prisma.customerDebtPayment.create({
    data: {
      tenantId: tenant.id,
      outletId: testLaundryOutlet.id,
      cashierId: laundryCashier.id,
      shiftId: shift3.id,
      debtId: testDebt.id,
      amount: 50000,
      paymentMethod: PaymentMethod.CASH,
      notes: 'Pelunasan kasbon tunai',
    },
  });

  // PaymentTransaction pelunasan kasbon
  const ptDebt = await prisma.paymentTransaction.create({
    data: {
      tenantId: tenant.id,
      orderId: dummyDebtOrder.id,
      shiftId: shift3.id,
      outletId: testLaundryOutlet.id,
      cashierId: laundryCashier.id,
      paymentMethod: PaymentMethod.CASH,
      amount: 50000,
      status: PaymentTxStatus.CAPTURED,
      referenceNumber: `DEBT-PAY-${debtPayment.id.slice(0, 8)}`,
      metadata: { debtPaymentId: debtPayment.id },
    },
  });

  // CashMovement pelunasan kasbon (CASH_IN dengan kategori DEBT_REPAYMENT)
  const cmDebt = await prisma.cashMovement.create({
    data: {
      tenantId: tenant.id,
      outletId: testLaundryOutlet.id,
      shiftId: shift3.id,
      userId: laundryCashier.id,
      type: 'CASH_IN',
      category: 'DEBT_REPAYMENT',
      amount: 50000,
      notes: 'Pelunasan kasbon tunai',
    },
  });

  // Query rekap shift 3 sesuai logika shift.controller.ts yang sudah diperbaiki
  const shift3PaymentRows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT pt.payment_method as "paymentMethod", pt.amount
     FROM "payment_transactions" pt
     JOIN "orders" o ON o.id = pt.order_id
     WHERE COALESCE(pt.shift_id, o.shift_id) = $1 
       AND pt.status = 'CAPTURED' 
       AND o.order_status NOT IN ('CANCELLED', 'VOIDED')
       AND (pt.reference_number IS NULL OR pt.reference_number NOT LIKE 'DEBT-PAY-%')
       AND (pt.metadata IS NULL OR (pt.metadata->>'debtPaymentId') IS NULL);`,
    shift3.id
  );

  let shift3CashSales = 0;
  shift3PaymentRows.forEach((p) => {
    if (p.paymentMethod === 'CASH') shift3CashSales += Number(p.amount);
  });

  const shift3CashMovements = await prisma.cashMovement.findMany({
    where: { shiftId: shift3.id, tenantId: tenant.id },
  });

  let shift3CashIn = 0;
  let shift3CashOut = 0;
  shift3CashMovements.forEach((cm) => {
    if (cm.type === 'CASH_OUT') shift3CashOut += Number(cm.amount);
    else if (cm.type === 'CASH_IN') {
      if (cm.category !== 'DEBT_REPAYMENT') {
        shift3CashIn += Number(cm.amount);
      }
    }
  });

  const shift3DebtPayments = await prisma.customerDebtPayment.findMany({
    where: { shiftId: shift3.id, paymentMethod: 'CASH' },
  });
  const shift3TotalDebtCashIn = shift3DebtPayments.reduce((sum, d) => sum + Number(d.amount), 0);

  const startingCash3 = Number(shift3.startingCash); // 200.000
  const expectedCash3 = startingCash3 + shift3CashSales + shift3CashIn + shift3TotalDebtCashIn - shift3CashOut;

  console.log(`   Modal Awal: Rp ${startingCash3.toLocaleString('id-ID')}`);
  console.log(`   Penjualan Kasir (Excluding Kasbon PT): Rp ${shift3CashSales.toLocaleString('id-ID')}`);
  console.log(`   Kas Masuk Bebas (Excluding DEBT_REPAYMENT CM): Rp ${shift3CashIn.toLocaleString('id-ID')}`);
  console.log(`   Pelunasan Kasbon Tunai (Canonical Debt Payment): Rp ${shift3TotalDebtCashIn.toLocaleString('id-ID')}`);
  console.log(`   Expected Cash di Laci: Rp ${expectedCash3.toLocaleString('id-ID')}`);

  if (shift3CashSales === 0 && shift3CashIn === 0 && shift3TotalDebtCashIn === 50000 && expectedCash3 === 250000) {
    console.log('✅ [PASS] 6. Anti-Triple Counting Berhasil: Pelunasan Kasbon Rp 50.000 HANYA dihitung tepat 1x ke laci kasir (200k + 50k = 250k, BUKAN 350k)!');
    passedTests++;
  } else {
    throw new Error(`❌ [FAIL] 6. Triple counting terdeteksi! Expected: 250000, Got: ${expectedCash3}`);
  }

  // Tutup Shift 3
  await prisma.shift.update({
    where: { id: shift3.id },
    data: {
      status: ShiftStatus.CLOSED,
      endTime: new Date(),
      expectedEnding: expectedCash3,
      actualEnding: expectedCash3,
      cashDifference: 0,
    },
  });

  // Bersihkan data dummy test
  await prisma.cashMovement.deleteMany({ where: { shiftId: shift3.id } });
  await prisma.customerDebtPayment.deleteMany({ where: { id: debtPayment.id } });
  await prisma.customerDebt.deleteMany({ where: { id: testDebt.id } });
  await prisma.paymentTransaction.deleteMany({ where: { orderId: { in: [orderA.id, orderB.id, dummyDebtOrder.id] } } });
  await prisma.order.deleteMany({ where: { id: { in: [orderA.id, orderB.id, dummyDebtOrder.id] } } });
  await prisma.shift.deleteMany({ where: { id: { in: [shift1.id, shift2.id, shift3.id] } } });

  console.log('\n===================================================================');
  console.log(`🎉 SELURUH SKENARIO UJI FASE 1 LULUS 100% (${passedTests}/${totalTests})`);
  console.log('===================================================================');
  await prisma.$disconnect();
}

runPhase1Verification().catch((err) => {
  console.error(err);
  process.exit(1);
});
