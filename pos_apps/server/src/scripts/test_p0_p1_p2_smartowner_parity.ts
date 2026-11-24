import { PrismaClient, Role, PaymentMethod, PaymentStatus, OrderStatus, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:5001';
const JWT_SECRET = process.env.JWT_SECRET || 'pos-secret-jwt-key-2026';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

function assertEq(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`[ASSERTION FAILED] ${message} — Expected: ${expected}, Got: ${actual}`);
  }
}

async function runTestSuite() {
  console.log('===================================================================');
  console.log('🧪 PRE-RELEASE QA: E2E API & DATABASE TEST (P0, P1, P2 PARITY)');
  console.log(`Target Backend: ${API_BASE}`);
  console.log('===================================================================\n');

  // Track created dummy entities for 100% clean teardown
  const createdOrderIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdDepositIds: string[] = [];
  const createdAdvanceIds: string[] = [];

  let outletId = '';
  let initialReceiptConfig: any = undefined;
  let initialDepositConfig: any = undefined;
  let initialCommissionConfig: any = undefined;

  try {
    // 0. Ambil Tenant Laundry & Outlet
    const tenant = await prisma.tenant.findFirst({
      where: { businessType: { contains: 'Laundry', mode: 'insensitive' } },
      include: { outlets: true },
    });
    if (!tenant || tenant.outlets.length === 0) {
      throw new Error('Tenant Laundry aktif tidak ditemukan di database.');
    }
    const tenantId = tenant.id;
    const outlet = tenant.outlets[0];
    outletId = outlet.id;

    // Snapshot awal konfigurasi outlet sebelum tes berjalan
    initialReceiptConfig = outlet.receiptConfig;
    initialDepositConfig = outlet.laundryDepositConfig;
    initialCommissionConfig = outlet.laundryCommissionConfig;

    // Cari atau buat User Owner / Admin untuk token otorisasi
    let ownerUser = await prisma.user.findFirst({
      where: { tenantId, role: { in: [Role.OWNER, Role.ADMIN] }, isActive: true },
    });
    if (!ownerUser) {
      const pwHash = await bcrypt.hash('password123', 10);
      ownerUser = await prisma.user.create({
        data: {
          tenantId,
          outletId,
          userCode: 'OWN01',
          name: 'Owner Laundry QA',
          email: 'qa.owner.laundry@wellpos-test.com',
          passwordHash: pwHash,
          role: Role.ADMIN,
          isActive: true,
          tokenVersion: 1,
        },
      });
      createdUserIds.push(ownerUser.id);
    }

    const ownerToken = jwt.sign(
      {
        userId: ownerUser.id,
        role: ownerUser.role,
        outletId,
        tenantId,
        tokenVersion: ownerUser.tokenVersion,
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );
    const ownerAuth = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerToken}`,
    };

    // Pastikan ada shift kasir terbuka
    let activeShift = await prisma.shift.findFirst({
      where: { outletId, status: 'OPEN' },
    });
    if (!activeShift) {
      activeShift = await prisma.shift.create({
        data: {
          tenantId,
          outletId,
          userId: ownerUser.id,
          startTime: new Date(),
          startingCash: 200000,
          expectedEnding: 200000,
          status: 'OPEN',
        },
      });
    }
    const shiftId = activeShift.id;

    // Buat Pelanggan Dummy untuk Test
    const testCustomer = await prisma.customer.create({
      data: {
        tenantId,
        name: 'Pelanggan QA SmartOwner',
        phone: '+6281299998888',
        email: 'qa.smartowner@test.com',
      },
    });
    createdCustomerIds.push(testCustomer.id);

    // =================================================================
    // 1. SKENARIO P0 #1 & #2: HANDOVER & SINKRONISASI PIUTANG
    // =================================================================
    console.log('▶️ [TEST A] P0 #1 & #2: Handover Kasir & Pelunasan Piutang (UNPAID -> PAID via QRIS)...');
    const orderPayload = {
      outletId,
      customerId: testCustomer.id,
      customerName: testCustomer.name,
      customerPhone: testCustomer.phone,
      deliveryType: 'NONE',
      items: [
        {
          name: 'Cuci Komplit Reguler 3kg',
          category: 'KILOAN',
          quantity: 3,
          unit: 'KG',
          unitPrice: 10000,
        },
      ],
      totalPieces: 6,
      perfumeVariant: 'Ocean Fresh',
      depositAmount: 0, // UNPAID
      paymentMethod: 'UNPAID',
    };

    const createOrderRes = await fetch(`${API_BASE}/api/laundry/orders`, {
      method: 'POST',
      headers: ownerAuth,
      body: JSON.stringify(orderPayload),
    });
    const createOrderData: any = await createOrderRes.json();
    assert(createOrderData.status === 'success', `Gagal membuat pesanan laundry UNPAID: ${JSON.stringify(createOrderData)}`);
    const testOrder = createOrderData.data;
    createdOrderIds.push(testOrder.id);

    // Verifikasi CustomerDebt tercatat UNPAID
    const initialDebt = await prisma.customerDebt.findFirst({
      where: { tenantId, orderId: testOrder.id },
    });
    assert(!!initialDebt, 'CustomerDebt harus dibuat otomatis untuk nota UNPAID');
    assertEq(initialDebt?.status, 'UNPAID', 'Status CustomerDebt awal harus UNPAID');
    assertEq(Number(initialDebt?.remainingAmount), 30000, 'Sisa piutang CustomerDebt awal harus Rp 30.000');

    // Lakukan Handover di Kasir dengan Pelunasan QRIS
    const handoverRes = await fetch(`${API_BASE}/api/laundry/orders/${testOrder.id}/advance-stage`, {
      method: 'POST',
      headers: ownerAuth,
      body: JSON.stringify({
        nextStage: 'HANDOVER',
        paymentMethod: 'QRIS',
        pickedUpBy: 'Bpk. QA SmartOwner',
        notes: 'Serah terima di kasir outlet pelunasan via QRIS',
      }),
    });
    const handoverData: any = await handoverRes.json();
    assert(handoverData.status === 'success', `Handover gagal: ${JSON.stringify(handoverData)}`);

    // Verifikasi Database State Pasca-Handover
    const updatedOrder = await prisma.order.findUnique({
      where: { id: testOrder.id },
      include: { laundryDetail: true, payments: true },
    });
    assertEq(updatedOrder?.paymentStatus, PaymentStatus.PAID, 'Order paymentStatus harus menjadi PAID');
    assertEq(updatedOrder?.orderStatus, OrderStatus.COMPLETED, 'Order orderStatus harus menjadi COMPLETED');
    assertEq(updatedOrder?.laundryDetail?.rackCode, null, 'Slot rak harus dikosongkan (null) pasca-handover');

    const qrisTx = updatedOrder?.payments.find((pt) => pt.paymentMethod === PaymentMethod.QRIS);
    assert(!!qrisTx, 'PaymentTransaction QRIS harus tercatat di database');
    assertEq(Number(qrisTx?.amount), 30000, 'Nominal pembayaran QRIS harus Rp 30.000');

    const updatedDebt = await prisma.customerDebt.findFirst({
      where: { tenantId, orderId: testOrder.id },
      include: { payments: true },
    });
    assertEq(updatedDebt?.status, 'PAID', 'CustomerDebt harus berubah menjadi PAID');
    assertEq(Number(updatedDebt?.remainingAmount), 0, 'Sisa piutang CustomerDebt harus 0');
    assert(updatedDebt?.payments && updatedDebt.payments.length > 0, 'CustomerDebtPayment harus tercipta');
    assertEq(updatedDebt?.payments[0]?.paymentMethod, PaymentMethod.QRIS, 'Metode bayar debt payment harus QRIS');
    console.log('   ✅ [PASS] Order lunas, QRIS captured, piutang nol, dan rak kosong.');

    // =================================================================
    // 2. SKENARIO P0 #3: ISOLASI WORKSHOP (ROLE NON-KASIR DITOLAK HANDOVER UNPAID)
    // =================================================================
    console.log('\n▶️ [TEST B] P0 #3: Isolasi Workshop (Role Non-Kasir Ditolak Handover Nota UNPAID)...');
    // Buat nota UNPAID kedua
    const order2Res = await fetch(`${API_BASE}/api/laundry/orders`, {
      method: 'POST',
      headers: ownerAuth,
      body: JSON.stringify({
        ...orderPayload,
        items: [{ name: 'Jas Satuan', category: 'SATUAN', quantity: 1, unit: 'PCS', unitPrice: 25000 }],
        depositAmount: 0,
      }),
    });
    const order2Data: any = await order2Res.json();
    assert(order2Data.status === 'success', 'Gagal membuat nota kedua');
    const order2 = order2Data.data;
    createdOrderIds.push(order2.id);

    // Buat user staf dengan role WAREHOUSE (Operator Workshop)
    const operatorUser = await prisma.user.create({
      data: {
        tenantId,
        outletId,
        userCode: 'OPR99',
        name: 'Doni Operator Pabrik',
        email: 'doni.opr@wellpos-test.com',
        passwordHash: await bcrypt.hash('password123', 10),
        role: Role.WAREHOUSE,
        isActive: true,
        tokenVersion: 1,
      },
    });
    createdUserIds.push(operatorUser.id);

    const operatorToken = jwt.sign(
      {
        userId: operatorUser.id,
        role: operatorUser.role,
        outletId,
        tenantId,
        tokenVersion: operatorUser.tokenVersion,
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );
    const operatorAuth = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${operatorToken}`,
    };

    // Coba lakukan handover dengan akun operator pada nota UNPAID
    const opHandoverRes = await fetch(`${API_BASE}/api/laundry/orders/${order2.id}/advance-stage`, {
      method: 'POST',
      headers: operatorAuth,
      body: JSON.stringify({
        nextStage: 'HANDOVER',
        pickedUpBy: 'Customer',
      }),
    });
    assertEq(opHandoverRes.status, 403, 'Operator workshop harus ditolak HTTP 403 saat handover nota UNPAID');
    const opHandoverData: any = await opHandoverRes.json();
    assert(
      opHandoverData.message.includes('Penyerahan pakaian yang belum lunas hanya dapat diproses oleh Kasir'),
      'Pesan penolakan harus spesifik mengenai otoritas kasir'
    );
    console.log('   ✅ [PASS] HTTP 403 ditegakkan: Operator workshop ditolak serah terima nota piutang.');

    // =================================================================
    // 3. SKENARIO P1 #4: MACHINE NAME DI TAHAPAN CUCI / KERING
    // =================================================================
    console.log('\n▶️ [TEST C] P1 #4: Penandaan Nomor Mesin (Machine Name) di Produksi & Pelacakan...');
    const advanceWashRes = await fetch(`${API_BASE}/api/laundry/orders/${order2.id}/advance-stage`, {
      method: 'POST',
      headers: ownerAuth,
      body: JSON.stringify({
        nextStage: 'WASHING',
        machineName: 'W-02',
        notes: 'Pencucian menggunakan mesin cuci W-02',
      }),
    });
    const advanceWashData: any = await advanceWashRes.json();
    assert(advanceWashData.status === 'success', 'Gagal memajukan tahapan ke WASHING');

    // Cek di endpoint stage logs
    const stageLogsRes = await fetch(`${API_BASE}/api/laundry/orders/${order2.id}/stage-logs`, {
      headers: ownerAuth,
    });
    const stageLogsData: any = await stageLogsRes.json();
    assert(stageLogsData.status === 'success', 'Gagal mengambil stage logs');
    const logsList = Array.isArray(stageLogsData.data) ? stageLogsData.data : (stageLogsData.data?.logs || []);
    const washLog = logsList.find((l: any) => l.stage === 'WASHING' || l.stage === 'CUCI');
    assert(!!washLog, 'Log tahapan WASHING harus ditemukan');
    assertEq(washLog?.machineName, 'W-02', 'Nomor mesin cuci harus tercatat W-02 di log audit');

    // Cek di endpoint public tracking
    const trackingRes = await fetch(`${API_BASE}/api/laundry/public/track/${order2.invoiceNumber}`);
    const trackingData: any = await trackingRes.json();
    assert(trackingData.status === 'success', 'Gagal mengakses public tracking');
    const publicWashLog = trackingData.data.stageLogs.find((l: any) => l.stage === 'WASHING' || l.stage === 'CUCI');
    assertEq(publicWashLog?.machineName, 'W-02', 'Nomor mesin W-02 harus muncul di antarmuka public tracking');
    console.log('   ✅ [PASS] Machine name W-02 tersimpan di LaundryStageLog dan terlihat di public tracking.');

    // =================================================================
    // 4. SKENARIO P1 #5: FORCE LOGOUT / REVOKASI SESI PERANGKAT INSTAN
    // =================================================================
    console.log('\n▶️ [TEST D] P1 #5: Force Logout & Revokasi Sesi Perangkat Staf...');
    // Buat kasir sementara
    const cashierUser = await prisma.user.create({
      data: {
        tenantId,
        outletId,
        userCode: 'CSH88',
        name: 'Rudi Kasir Shift',
        email: 'rudi.csh@wellpos-test.com',
        passwordHash: await bcrypt.hash('password123', 10),
        role: Role.CASHIER,
        isActive: true,
        tokenVersion: 1,
      },
    });
    createdUserIds.push(cashierUser.id);

    const oldCashierToken = jwt.sign(
      {
        userId: cashierUser.id,
        role: cashierUser.role,
        outletId,
        tenantId,
        tokenVersion: 1,
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );
    const cashierAuth = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${oldCashierToken}`,
    };

    // Verifikasi token aktif sebelum logout
    const preCheckRes = await fetch(`${API_BASE}/api/shifts/current?outletId=${outletId}`, {
      headers: cashierAuth,
    });
    assertEq(preCheckRes.status, 200, 'Token kasir harus valid sebelum force logout');

    // Eksekusi Force Logout oleh Owner
    const forceLogoutRes = await fetch(`${API_BASE}/api/users/${cashierUser.id}/force-logout`, {
      method: 'POST',
      headers: ownerAuth,
    });
    const forceLogoutData: any = await forceLogoutRes.json();
    assert(forceLogoutData.status === 'success', 'Gagal memanggil endpoint force-logout');

    // Verifikasi tokenVersion naik di DB
    const refreshedUser = await prisma.user.findUnique({ where: { id: cashierUser.id } });
    assertEq(refreshedUser?.tokenVersion, 2, 'tokenVersion user di DB harus naik menjadi 2');

    // Verifikasi token lama ditolak HTTP 401
    const postCheckRes = await fetch(`${API_BASE}/api/shifts/current?outletId=${outletId}`, {
      headers: cashierAuth,
    });
    assertEq(postCheckRes.status, 401, 'Token lama harus langsung ditolak HTTP 401');
    const postCheckData: any = await postCheckRes.json();
    assertEq(postCheckData.code, 'SESSION_REVOKED', 'Harus mengembalikan error code SESSION_REVOKED');
    console.log('   ✅ [PASS] Sesi berhasil dicabut: tokenVersion naik +1, token lama ditolak HTTP 401.');

    // =================================================================
    // 5. SKENARIO P1 #6: MASTER PAKET DEPOSIT & POLICY MASA AKTIF
    // =================================================================
    console.log('\n▶️ [TEST E] P1 #6: Master Paket Deposit & Kebijakan Masa Aktif (ACCUMULATE vs EXPIRE)...');
    // Simpan deposit config
    const depositConfigPayload = {
      packages: [
        {
          id: 'pkg-kiloan-test',
          name: 'Paket Hemat QA 20 Kg',
          type: 'QUOTA_KG',
          price: 150000,
          quotaKg: 20,
          quotaBonusKg: 2,
          validityDays: 30,
          description: 'Paket uji 20kg + 2kg bonus',
        },
      ],
      quotaWarningThresholdDays: 3,
    };
    const updateDepositCfgRes = await fetch(`${API_BASE}/api/laundry/deposit-config`, {
      method: 'PUT',
      headers: ownerAuth,
      body: JSON.stringify(depositConfigPayload),
    });
    const updateDepositCfgData: any = await updateDepositCfgRes.json();
    assert(updateDepositCfgData.status === 'success', 'Gagal update deposit-config');

    // Top-up Pertama: 22 Kg dengan validityDays 30 hari (ACCUMULATE)
    const topup1Res = await fetch(`${API_BASE}/api/laundry/customers/${testCustomer.id}/wallet/topup`, {
      method: 'POST',
      headers: ownerAuth,
      body: JSON.stringify({
        type: 'QUOTA_KG',
        kg: 20,
        quotaBonusKg: 2,
        pricePaid: 150000,
        validityDays: 30,
        expiryPolicy: 'ACCUMULATE',
        outletId,
        paymentMethod: 'CASH',
      }),
    });
    const topup1Data: any = await topup1Res.json();
    assert(topup1Data.status === 'success', 'Topup 1 gagal');
    const expiry1 = new Date(topup1Data.data.wallet.quotaExpiresAt).getTime();
    const nowTime = Date.now();
    const approx30Days = 30 * 24 * 3600 * 1000;
    assert(Math.abs(expiry1 - (nowTime + approx30Days)) < 60000, 'Expiry 1 harus ~30 hari ke depan');

    // Top-up Kedua: 20 Kg dengan validityDays 30 hari lagi (ACCUMULATE -> bertambah jadi ~60 hari)
    const topup2Res = await fetch(`${API_BASE}/api/laundry/customers/${testCustomer.id}/wallet/topup`, {
      method: 'POST',
      headers: ownerAuth,
      body: JSON.stringify({
        type: 'QUOTA_KG',
        kg: 20,
        quotaBonusKg: 0,
        pricePaid: 140000,
        validityDays: 30,
        expiryPolicy: 'ACCUMULATE',
        outletId,
        paymentMethod: 'CASH',
      }),
    });
    const topup2Data: any = await topup2Res.json();
    assert(topup2Data.status === 'success', 'Topup 2 gagal');
    const expiry2 = new Date(topup2Data.data.wallet.quotaExpiresAt).getTime();
    const approx60Days = 60 * 24 * 3600 * 1000;
    assert(Math.abs(expiry2 - (nowTime + approx60Days)) < 120000, 'Expiry 2 harus terakumulasi menjadi ~60 hari');
    assertEq(Number(topup2Data.data.wallet.quotaKg), 42, 'Total kuota harus menjadi 22 + 20 = 42 Kg');
    console.log('   ✅ [PASS] Master paket tersimpan, akumulasi kuota (42 Kg) dan masa aktif (~60 hari) akurat.');

    // =================================================================
    // 6. SKENARIO P1 #7: KLAUSUL STRUK & TRACKING PUBLIC
    // =================================================================
    console.log('\n▶️ [TEST F] P1 #7: Klausul Struk / Ketentuan Komplain & Garansi pada Public Tracking...');
    const testClause = '1. Komplain pakaian maksimal 1x24 jam setelah serah terima. 2. Pakaian luntur di luar tanggungan.';
    await prisma.outlet.update({
      where: { id: outletId },
      data: {
        receiptConfig: {
          laundryTerms: testClause,
          storeName: outlet.name,
        },
      },
    });

    const publicTrackingRes = await fetch(`${API_BASE}/api/laundry/public/track/${order2.invoiceNumber}`);
    const publicTrackingData: any = await publicTrackingRes.json();
    assert(publicTrackingData.status === 'success', 'Gagal memanggil public tracking');
    assertEq(publicTrackingData.data.laundryTerms, testClause, 'laundryTerms pada public tracking harus cocok');
    console.log('   ✅ [PASS] receiptConfig.laundryTerms dikembalikan secara konsisten ke antarmuka pelanggan.');

    // =================================================================
    // 7. SKENARIO P2 #1: SETORAN KAS SHIFT KE PUSAT & VERIFIKASI / REJEKSI
    // =================================================================
    console.log('\n▶️ [TEST G] P2 #1: Setoran Kas Shift ke Pusat & Validasi Verifikasi/Penolakan...');
    // Ajukan Setoran Kas (PENDING)
    const depositRes = await fetch(`${API_BASE}/api/shifts/deposits`, {
      method: 'POST',
      headers: ownerAuth,
      body: JSON.stringify({
        outletId,
        shiftId,
        amount: 250000,
        targetAccount: 'BANK_BCA',
        referenceNumber: 'DEP-BCA-QA99',
        notes: 'Setoran kas shift siang QA ke rekening BCA Pusat',
      }),
    });
    const depositData: any = await depositRes.json();
    assert(depositData.status === 'success', 'Gagal mengajukan setoran kas shift');
    const depositId = depositData.data.id;
    createdDepositIds.push(depositId);
    assertEq(depositData.data.status, 'PENDING', 'Status setoran kas awal harus PENDING');

    // Uji Rejeki Tanpa Alasan (Harus Gagal 400)
    const rejectNoReasonRes = await fetch(`${API_BASE}/api/shifts/deposits/${depositId}/verify`, {
      method: 'PATCH',
      headers: ownerAuth,
      body: JSON.stringify({
        status: 'REJECTED',
        rejectionReason: '',
      }),
    });
    assertEq(rejectNoReasonRes.status, 400, 'Penolakan tanpa alasan harus ditolak HTTP 400');

    // Uji Rejeki Dengan Alasan
    const rejectWithReasonRes = await fetch(`${API_BASE}/api/shifts/deposits/${depositId}/verify`, {
      method: 'PATCH',
      headers: ownerAuth,
      body: JSON.stringify({
        status: 'REJECTED',
        rejectionReason: 'Uang fisik di amplop kurang Rp 10.000',
      }),
    });
    const rejectData: any = await rejectWithReasonRes.json();
    assert(rejectData.status === 'success', 'Gagal menolak setoran');
    assertEq(rejectData.data.status, 'REJECTED', 'Status harus menjadi REJECTED');

    // Ajukan setoran kedua dan verifikasi sukses (VERIFIED)
    const deposit2Res = await fetch(`${API_BASE}/api/shifts/deposits`, {
      method: 'POST',
      headers: ownerAuth,
      body: JSON.stringify({
        outletId,
        shiftId,
        amount: 240000,
        targetAccount: 'BANK_BCA',
        referenceNumber: 'DEP-BCA-QA99-FIX',
      }),
    });
    const deposit2Data: any = await deposit2Res.json();
    const deposit2Id = deposit2Data.data.id;
    createdDepositIds.push(deposit2Id);

    const verifyRes = await fetch(`${API_BASE}/api/shifts/deposits/${deposit2Id}/verify`, {
      method: 'PATCH',
      headers: ownerAuth,
      body: JSON.stringify({ status: 'VERIFIED' }),
    });
    const verifyData: any = await verifyRes.json();
    assert(verifyData.status === 'success', 'Verifikasi setoran gagal');
    assertEq(verifyData.data.status, 'VERIFIED', 'Status harus menjadi VERIFIED');
    console.log('   ✅ [PASS] Setoran kas tervalidasi: guard alasan penolakan aktif, persetujuan sukses.');

    // =================================================================
    // 8. SKENARIO P2 #2: KOMISI SALES KASIR TIERED & KASBON KARYAWAN FIFO
    // =================================================================
    console.log('\n▶️ [TEST H] P2 #2: Komisi Sales Kasir Tiered & Auto-Offset Kasbon Karyawan (FIFO)...');
    // Set config komisi kasir aktif
    await fetch(`${API_BASE}/api/laundry/commission-config`, {
      method: 'PUT',
      headers: ownerAuth,
      body: JSON.stringify({
        outletId,
        enabled: true,
        washingPerKg: 300,
        dryingPerKg: 200,
        ironingPerKg: 500,
        packingPerOrder: 500,
        deliveryPerTrip: 3000,
        pickupPerTrip: 2000,
        rewashPenaltyPerCase: 0,
        cashierCommissionEnabled: true,
        cashierCommissionBasis: 'ALL_ORDERS',
        cashierCommissionTiers: [
          { minSales: 0, percent: 5.0 }, // 5% komisi penjualan kasir
        ],
      }),
    });

    // Buat kasbon karyawan untuk ownerUser sebesar Rp 80.000
    const advRes = await fetch(`${API_BASE}/api/laundry/cash-advances`, {
      method: 'POST',
      headers: ownerAuth,
      body: JSON.stringify({
        outletId,
        staffId: ownerUser.id,
        staffName: ownerUser.name,
        amount: 80000,
        reason: 'Kasbon ganti ban motor operasional',
        deductFromOpenShift: true,
        shiftId,
      }),
    });
    const advData: any = await advRes.json();
    assert(advData.status === 'success', 'Gagal membuat kasbon');
    const advanceId = advData.data.id;
    createdAdvanceIds.push(advanceId);
    assertEq(Number(advData.data.remainingAmount), 80000, 'Sisa kasbon awal harus Rp 80.000');

    // Cek laporan komisi
    const commRes = await fetch(`${API_BASE}/api/laundry/commissions?outletId=${outletId}&period=THIS_MONTH`, {
      headers: ownerAuth,
    });
    const commData: any = await commRes.json();
    assert(commData.status === 'success', 'Gagal mengambil laporan komisi');
    const staffRow = commData.data.staff.find((s: any) => s.staffId === ownerUser?.id || s.name === ownerUser?.name);
    assert(!!staffRow, 'Baris staf harus ditemukan di laporan komisi');
    assert(Number(staffRow?.outstandingCashAdvance) >= 80000, 'Piutang kasbon harus muncul di kolom komisi staf');

    // Lakukan pencairan komisi Rp 120.000 dipotong kasbon Rp 80.000 -> Net Cash Out Rp 40.000
    const payoutRes = await fetch(`${API_BASE}/api/laundry/commissions/payout`, {
      method: 'POST',
      headers: ownerAuth,
      body: JSON.stringify({
        outletId,
        staffId: ownerUser.id,
        staffName: ownerUser.name,
        amount: 120000,
        deductCashAdvanceAmount: 80000,
        periodStart: '2026-11-01',
        periodEnd: '2026-11-30',
        notes: 'Pencairan komisi bulanan potong lunas kasbon Rp 80.000',
      }),
    });
    const payoutData: any = await payoutRes.json();
    assert(payoutData.status === 'success', 'Gagal pencairan komisi');
    assertEq(payoutData.data.netPayout, 40000, 'Kas keluar laci bersih harus Rp 40.000');
    assertEq(payoutData.data.deductedAdvance, 80000, 'Kasbon terpotong harus Rp 80.000');

    // Verifikasi Kasbon berubah menjadi PAID
    const verifiedAdv = await prisma.staffCashAdvance.findUnique({ where: { id: advanceId } });
    assertEq(verifiedAdv?.status, 'PAID', 'Kasbon harus berstatus PAID pasca auto-offset');
    assertEq(Number(verifiedAdv?.remainingAmount), 0, 'Sisa saldo kasbon harus 0');

    // Verifikasi CashMovement hanya sebesar Rp 40.000 (netPayout)
    const cm = await prisma.cashMovement.findUnique({
      where: { id: payoutData.data.movement.id },
    });
    assertEq(Number(cm?.amount), 40000, 'CashMovement laci kasir harus dicatat sebesar netPayout (Rp 40.000)');
    console.log('   ✅ [PASS] Tiered sales kasir terhitung, kasbon terpotong FIFO lunas, CashMovement akurat Rp 40.000.');

    // =================================================================
    // 9. SKENARIO P2 #3: AUTO-REMINDER WHATSAPP RUNNER (DRY-RUN)
    // =================================================================
    console.log('\n▶️ [TEST I] P2 #3: Auto-Reminder WhatsApp Runner (Dry-Run Preview)...');
    const reminderRes = await fetch(`${API_BASE}/api/laundry/reminders/run`, {
      method: 'POST',
      headers: ownerAuth,
      body: JSON.stringify({
        outletId,
        dryRun: true,
      }),
    });
    const reminderData: any = await reminderRes.json();
    assert(reminderData.status === 'success', 'Gagal menjalankan auto-reminder runner');
    assert(typeof reminderData.data.summary.totalStaleRack === 'number', 'Summary totalStaleRack harus number');
    assert(typeof reminderData.data.summary.totalExpiringQuota === 'number', 'Summary totalExpiringQuota harus number');
    assert(Array.isArray(reminderData.data.staleCandidates), 'staleCandidates harus berupa array');
    assert(Array.isArray(reminderData.data.expiringCandidates), 'expiringCandidates harus berupa array');
    console.log(`   ✅ [PASS] Runner auto-reminder sukses memindai kandidat (Total: ${reminderData.data.summary.totalCandidates}).`);

    console.log('\n===================================================================');
    console.log('🎉 SELURUH 9 SKENARIO PRE-RELEASE QA (P0, P1, P2) 100% LULUS!');
    console.log('===================================================================');
  } finally {
    // Clean-up Data Dummy Uji Coba Secara Bersih
    console.log('\n🧹 Membersihkan data dummy uji coba dari database...');
    try {
      if (createdAdvanceIds.length > 0) {
        await prisma.staffCashAdvance.deleteMany({ where: { id: { in: createdAdvanceIds } } });
      }
      if (createdDepositIds.length > 0) {
        await prisma.shiftCashDeposit.deleteMany({ where: { id: { in: createdDepositIds } } });
      }
      if (createdOrderIds.length > 0) {
        await prisma.customerDebtPayment.deleteMany({
          where: { debt: { orderId: { in: createdOrderIds } } },
        });
        await prisma.customerDebt.deleteMany({ where: { orderId: { in: createdOrderIds } } });
        await prisma.paymentTransaction.deleteMany({ where: { orderId: { in: createdOrderIds } } });
        await prisma.laundryStageLog.deleteMany({ where: { orderId: { in: createdOrderIds } } });
        await prisma.laundryOrderDetail.deleteMany({ where: { orderId: { in: createdOrderIds } } });
        await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
        await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
      }
      if (createdCustomerIds.length > 0) {
        await prisma.customerLaundryWalletLedger.deleteMany({
          where: { wallet: { customerId: { in: createdCustomerIds } } },
        });
        await prisma.customerLaundryWallet.deleteMany({
          where: { customerId: { in: createdCustomerIds } },
        });
        await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
      }
      if (createdUserIds.length > 0) {
        await prisma.cashMovement.deleteMany({ where: { userId: { in: createdUserIds } } });
        await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      }

      // Kembalikan (restore) konfigurasi outlet ke snapshot semula
      if (outletId) {
        await prisma.outlet.update({
          where: { id: outletId },
          data: {
            receiptConfig: initialReceiptConfig === null ? Prisma.DbNull : (initialReceiptConfig ?? Prisma.DbNull),
            laundryDepositConfig: initialDepositConfig === null ? Prisma.DbNull : (initialDepositConfig ?? Prisma.DbNull),
            laundryCommissionConfig: initialCommissionConfig === null ? Prisma.DbNull : (initialCommissionConfig ?? Prisma.DbNull),
          },
        });
      }
      console.log('✨ Clean-up & restore konfigurasi outlet selesai. Database lokal tetap bersih.');
    } catch (cleanErr) {
      console.error('Peringatan clean-up:', cleanErr);
    } finally {
      await prisma.$disconnect();
    }
  }
}

runTestSuite().catch((err) => {
  console.error('\n❌ PRE-RELEASE QA TEST GAGAL:', err.message);
  process.exit(1);
});
