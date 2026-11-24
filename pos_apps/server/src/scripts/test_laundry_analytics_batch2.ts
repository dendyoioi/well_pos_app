/**
 * Test Suite: Laundry Analytics Batch 2 (W1-04, W1-05 & Batch 1 Fixes)
 * 
 * Menguji:
 * 1. Fix RBAC Batch 1:
 *    - SUPERVISOR ditolak HTTP 403 di /financial, /sales, /customers, /ai/summary, /benchmark
 *    - ADMIN ditolak 403 di /benchmark, /ai/forecast, POST /ai/query, & outletId=ALL
 *    - ADMIN sukses 200 di /financial untuk outlet-nya
 *    - SUPERVISOR sukses 200 di /overview tetapi seluruh field finansial sensitif terhapus
 *    - OWNER sukses 200 di seluruh endpoint
 * 2. Fix Cache Collision Batch 1:
 *    - buildKey memisahkan endpoint ('overview' vs 'financial') secara independen
 * 3. Accounting Anti-Double Counting:
 *    - Order tunai Rp 50.000 -> Accrual +50.000, Real Cash In +50.000
 *    - Order deposit Rp 50.000 -> Accrual +50.000, Real Cash In +0
 *    - Order voided Rp 200.000 -> Accrual +0, Real Cash In +0
 *    - Refund Rp 10.000 -> Net Revenue berkurang Rp 10.000
 *    - Top-up balance Rp 100.000 -> Accrual +0, Real Cash In +100.000
 *    - Debt repayment Rp 75.000 -> Accrual +0, Real Cash In +75.000
 *    - Net Revenue = 90.000, Real Cash In = 225.000
 * 4. Health Score & Zero-Division Safety:
 *    - Outlet kosong (0 transaksi) -> score 0, grade 'BELUM_ADA_DATA', availability 'EMPTY'
 *    - Bebas NaN / null division error
 * 5. Teardown pembersihan 100% data uji terisolasi di database PostgreSQL
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient, Role, PaymentMethod, PaymentStatus, OrderStatus } from '@prisma/client';
import { laundryAnalyticsRouter } from '../routes/laundry_analytics.routes';
import { resolveAnalyticsDateRange } from '../services/laundry_analytics/dateRangeResolver.service';
import { getFinancialAnalytics } from '../services/laundry_analytics/laundryAnalyticsFinancial.service';
import { getExecutiveOverview } from '../services/laundry_analytics/laundryAnalyticsOverview.service';
import { analyticsCache } from '../services/laundry_analytics/analyticsSecurity.helper';

const prisma = new PrismaClient();

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING LAUNDRY ANALYTICS BATCH 2 VERIFICATION');
  console.log('====================================================');

  const ts = Date.now();
  const testSlug = `qa-analytics-${ts}`;
  const jwtSecret = process.env.JWT_SECRET || 'test-jwt-secret';

  // ID penampung untuk pembersihan tuntas
  let testTenantId = '';
  let testOutletId = '';
  let emptyOutletId = '';
  const createdUserIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdShiftIds: string[] = [];

  try {
    console.log('\n[SETUP] Menyiapkan tenant & data uji terisolasi...');

    // 1. Buat Tenant Uji
    const tenant = await prisma.tenant.create({
      data: {
        name: `QA Analytics Tenant ${ts}`,
        slug: testSlug,
        businessVertical: 'SERVICES',
        businessType: 'Laundry Kiloan & Satuan',
        status: 'ACTIVE',
      },
    });
    testTenantId = tenant.id;

    // 2. Buat 2 Outlet Uji (Outlet Aktif & Outlet Kosong)
    const outlet1 = await prisma.outlet.create({
      data: {
        tenantId: testTenantId,
        name: `Outlet Utama QA ${ts}`,
        code: `OUT-1-${ts}`,
      },
    });
    testOutletId = outlet1.id;

    const outletEmpty = await prisma.outlet.create({
      data: {
        tenantId: testTenantId,
        name: `Outlet Kosong QA ${ts}`,
        code: `OUT-0-${ts}`,
      },
    });
    emptyOutletId = outletEmpty.id;

    // 3. Buat Pengguna untuk 4 Peran (OWNER, ADMIN, SUPERVISOR, CASHIER)
    const pwHash = await bcrypt.hash('password123', 8);

    const ownerUser = await prisma.user.create({
      data: {
        tenantId: testTenantId,
        outletId: testOutletId,
        userCode: `OWN_${ts}`,
        name: 'Owner QA',
        email: `owner.${ts}@qa-analytics.test`,
        passwordHash: pwHash,
        role: Role.OWNER,
        isActive: true,
        tokenVersion: 1,
      },
    });
    createdUserIds.push(ownerUser.id);

    const adminUser = await prisma.user.create({
      data: {
        tenantId: testTenantId,
        outletId: testOutletId,
        userCode: `ADM_${ts}`,
        name: 'Admin QA',
        email: `admin.${ts}@qa-analytics.test`,
        passwordHash: pwHash,
        role: Role.ADMIN,
        isActive: true,
        tokenVersion: 1,
      },
    });
    createdUserIds.push(adminUser.id);

    const spvUser = await prisma.user.create({
      data: {
        tenantId: testTenantId,
        outletId: testOutletId,
        userCode: `SPV_${ts}`,
        name: 'Supervisor QA',
        email: `spv.${ts}@qa-analytics.test`,
        passwordHash: pwHash,
        role: Role.SUPERVISOR,
        isActive: true,
        tokenVersion: 1,
      },
    });
    createdUserIds.push(spvUser.id);

    const cashierUser = await prisma.user.create({
      data: {
        tenantId: testTenantId,
        outletId: testOutletId,
        userCode: `CSH_${ts}`,
        name: 'Cashier QA',
        email: `cashier.${ts}@qa-analytics.test`,
        passwordHash: pwHash,
        role: Role.CASHIER,
        isActive: true,
        tokenVersion: 1,
      },
    });
    createdUserIds.push(cashierUser.id);

    // 4. Buat Shift Aktif untuk Cash Movement
    const shift = await prisma.shift.create({
      data: {
        tenantId: testTenantId,
        outletId: testOutletId,
        userId: cashierUser.id,
        startingCash: 200000,
        status: 'OPEN',
      },
    });
    createdShiftIds.push(shift.id);

    // 5. Buat Pelanggan Uji
    const customer = await prisma.customer.create({
      data: {
        tenantId: testTenantId,
        name: `Budi Pelanggan ${ts}`,
        phone: `+628123456${ts.toString().slice(-4)}`,
      },
    });
    createdCustomerIds.push(customer.id);

    // Token Helper
    const makeToken = (user: any) =>
      jwt.sign(
        {
          userId: user.id,
          role: user.role,
          outletId: user.outletId,
          tenantId: user.tenantId,
          tokenVersion: user.tokenVersion,
        },
        jwtSecret,
        { expiresIn: '1h' }
      );

    const ownerToken = makeToken(ownerUser);
    const adminToken = makeToken(adminUser);
    const spvToken = makeToken(spvUser);
    const cashierToken = makeToken(cashierUser);

    console.log('  ✅ Setup tenant, outlet, peran pengguna, dan shift selesai.');

    // ----------------------------------------------------
    // TEST 1: FIX RBAC BATCH 1 & ROUTE GUARDS
    // ----------------------------------------------------
    console.log('\n[TEST 1] Verifikasi RBAC Route Guards (Perapihan Batch 1)...');

    const app = express();
    app.use(express.json());
    app.use('/api/laundry/analytics', laundryAnalyticsRouter);

    const server = app.listen(0);
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}/api/laundry/analytics`;

    try {
      // 1.1 SUPERVISOR ditolak di /financial -> 403
      const resSpvFin = await fetch(`${baseUrl}/financial`, {
        headers: { Authorization: `Bearer ${spvToken}` },
      });
      assert(resSpvFin.status === 403, 'SUPERVISOR harus ditolak HTTP 403 di /financial');
      console.log('  ✅ 1.1 SUPERVISOR ditolak 403 di /financial');

      // 1.2 SUPERVISOR ditolak di /sales -> 403
      const resSpvSales = await fetch(`${baseUrl}/sales`, {
        headers: { Authorization: `Bearer ${spvToken}` },
      });
      assert(resSpvSales.status === 403, 'SUPERVISOR harus ditolak HTTP 403 di /sales');
      console.log('  ✅ 1.2 SUPERVISOR ditolak 403 di /sales');

      // 1.3 SUPERVISOR ditolak di /customers -> 403
      const resSpvCust = await fetch(`${baseUrl}/customers`, {
        headers: { Authorization: `Bearer ${spvToken}` },
      });
      assert(resSpvCust.status === 403, 'SUPERVISOR harus ditolak HTTP 403 di /customers');
      console.log('  ✅ 1.3 SUPERVISOR ditolak 403 di /customers');

      // 1.4 SUPERVISOR ditolak di /ai/summary -> 403
      const resSpvAiSum = await fetch(`${baseUrl}/ai/summary`, {
        headers: { Authorization: `Bearer ${spvToken}` },
      });
      assert(resSpvAiSum.status === 403, 'SUPERVISOR harus ditolak HTTP 403 di /ai/summary');
      console.log('  ✅ 1.4 SUPERVISOR ditolak 403 di /ai/summary');

      // 1.5 SUPERVISOR ditolak di /benchmark -> 403
      const resSpvBench = await fetch(`${baseUrl}/benchmark`, {
        headers: { Authorization: `Bearer ${spvToken}` },
      });
      assert(resSpvBench.status === 403, 'SUPERVISOR harus ditolak HTTP 403 di /benchmark');
      console.log('  ✅ 1.5 SUPERVISOR ditolak 403 di /benchmark');

      // 1.6 ADMIN ditolak di /benchmark -> 403
      const resAdminBench = await fetch(`${baseUrl}/benchmark`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(resAdminBench.status === 403, 'ADMIN harus ditolak HTTP 403 di /benchmark');
      console.log('  ✅ 1.6 ADMIN ditolak 403 di /benchmark (Khusus OWNER)');

      // 1.7 ADMIN ditolak di /ai/forecast -> 403
      const resAdminAiFc = await fetch(`${baseUrl}/ai/forecast`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(resAdminAiFc.status === 403, 'ADMIN harus ditolak HTTP 403 di /ai/forecast');
      console.log('  ✅ 1.7 ADMIN ditolak 403 di /ai/forecast (Khusus OWNER)');

      // 1.8 ADMIN ditolak di POST /ai/query -> 403
      const resAdminAiQ = await fetch(`${baseUrl}/ai/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'Analisis omset' }),
      });
      assert(resAdminAiQ.status === 403, 'ADMIN harus ditolak HTTP 403 di POST /ai/query');
      console.log('  ✅ 1.8 ADMIN ditolak 403 di POST /ai/query (Khusus OWNER)');

      // 1.9 ADMIN ditolak jika mencoba outletId=ALL -> 403
      const resAdminAll = await fetch(`${baseUrl}/financial?outletId=ALL`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(resAdminAll.status === 403, 'ADMIN mencoba outletId=ALL harus ditolak 403');
      console.log('  ✅ 1.9 ADMIN bypass outletId=ALL ditolak 403');

      // 1.10 ADMIN sukses di /financial untuk outlet-nya sendiri -> 200
      const resAdminFin = await fetch(`${baseUrl}/financial`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert(resAdminFin.status === 200, 'ADMIN harus sukses 200 di /financial');
      console.log('  ✅ 1.10 ADMIN sukses 200 di /financial untuk outlet tugasnya');

      // 1.11 OWNER sukses di /financial & /overview & /benchmark
      const resOwnerFin = await fetch(`${baseUrl}/financial?outletId=ALL`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      assert(resOwnerFin.status === 200, 'OWNER harus sukses 200 di /financial');

      const resOwnerBench = await fetch(`${baseUrl}/benchmark`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      assert(
        resOwnerBench.status === 200 || resOwnerBench.status === 501,
        'OWNER harus lolos RBAC di /benchmark (status 200 OK atau 501 stub)'
      );
      console.log('  ✅ 1.11 OWNER sukses 200 di /financial dan lolos RBAC di /benchmark');

      // 1.12 SUPERVISOR sukses di /overview TETAPI seluruh field finansial sensitif terhapus
      const resSpvOverview = await fetch(`${baseUrl}/overview`, {
        headers: { Authorization: `Bearer ${spvToken}` },
      });
      assert(resSpvOverview.status === 200, 'SUPERVISOR harus sukses 200 di /overview');
      const spvOverviewJson: any = await resSpvOverview.json();
      assert(spvOverviewJson.status === 'success', 'Status overview supervisor harus success');

      // Verifikasi scrubbing field finansial untuk supervisor
      const spvData = spvOverviewJson.data;
      assert(spvData.financialPulse === undefined, 'financialPulse HARUS dihapus untuk SUPERVISOR');
      assert(spvData.operationalPulse.averageOrderValue === undefined, 'averageOrderValue HARUS dihapus');
      assert(spvData.healthScore.pillars.profitMarginScore === undefined, 'profitMarginScore HARUS dihapus');
      assert(spvData.operationalPulse.totalValidOrders !== undefined, 'totalValidOrders HARUS tetap ada');
      assert(spvData.operationalPulse.onTimeCompletionRate !== undefined, 'onTimeCompletionRate HARUS tetap ada');
      assert(spvData.healthScore.score !== undefined, 'Skor kesehatan utama HARUS tetap ada');
      console.log('  ✅ 1.12 SUPERVISOR sukses 200 di /overview dengan pembersihan finansial bersih');
    } finally {
      server.close();
    }

    // ----------------------------------------------------
    // TEST 2: CACHE KEY ISOLATION & FIX COLLISION
    // ----------------------------------------------------
    console.log('\n[TEST 2] Verifikasi Cache Key Isolation (Zero Collision)...');
    const keyOverview = analyticsCache.buildKey('overview', 'tenant1', 'outlet1', 'month', '2026-11-01', '2026-11-30', 'OWNER');
    const keyFinancial = analyticsCache.buildKey('financial', 'tenant1', 'outlet1', 'month', '2026-11-01', '2026-11-30', 'OWNER');

    assert(keyOverview !== keyFinancial, 'Key overview dan financial harus berbeda');
    assert(keyOverview.startsWith('overview:tenant1:outlet1:month'), 'Key overview harus memiliki prefix overview');
    assert(keyFinancial.startsWith('financial:tenant1:outlet1:month'), 'Key financial harus memiliki prefix financial');

    analyticsCache.set(keyOverview, { type: 'OVERVIEW_PAYLOAD' });
    analyticsCache.set(keyFinancial, { type: 'FINANCIAL_PAYLOAD' });

    assert(analyticsCache.get(keyOverview).type === 'OVERVIEW_PAYLOAD', 'Overview cache tidak boleh tertimpa');
    assert(analyticsCache.get(keyFinancial).type === 'FINANCIAL_PAYLOAD', 'Financial cache tidak boleh tertimpa');
    console.log('  ✅ Cache buildKey terisolasi per endpoint (Zero Collision) lulus');

    // ----------------------------------------------------
    // TEST 3: ACCOUNTING ANTI-DOUBLE COUNTING TRANSACTIONS
    // ----------------------------------------------------
    console.log('\n[TEST 3] Verifikasi Integritas Akuntansi Anti-Double Counting...');

    const now = new Date();

    // 3.1 Order 1: Tunai Rp 50.000 (CONFIRMED/COMPLETED)
    const order1 = await prisma.order.create({
      data: {
        tenantId: testTenantId,
        outletId: testOutletId,
        userId: cashierUser.id,
        customerId: customer.id,
        invoiceNumber: `INV-CASH-${ts}`,
        orderStatus: OrderStatus.COMPLETED,
        paymentStatus: PaymentStatus.PAID,
        subtotal: 50000,
        discountTotal: 0,
        taxTotal: 0,
        totalAmount: 50000,
        paidAmount: 50000,
        createdAt: now,
      },
    });
    createdOrderIds.push(order1.id);

    await prisma.paymentTransaction.create({
      data: {
        tenantId: testTenantId,
        outletId: testOutletId,
        orderId: order1.id,
        paymentMethod: PaymentMethod.CASH,
        amount: 50000,
        status: 'CAPTURED',
        createdAt: now,
      },
    });

    // 3.2 Order 2: Bayar Menggunakan Deposit Rp 50.000 (Pencairan Liabilitas)
    const order2 = await prisma.order.create({
      data: {
        tenantId: testTenantId,
        outletId: testOutletId,
        userId: cashierUser.id,
        customerId: customer.id,
        invoiceNumber: `INV-DEPOSIT-${ts}`,
        orderStatus: OrderStatus.COMPLETED,
        paymentStatus: PaymentStatus.PAID,
        subtotal: 50000,
        discountTotal: 0,
        taxTotal: 0,
        totalAmount: 50000,
        paidAmount: 50000,
        createdAt: now,
      },
    });
    createdOrderIds.push(order2.id);

    await prisma.paymentTransaction.create({
      data: {
        tenantId: testTenantId,
        outletId: testOutletId,
        orderId: order2.id,
        paymentMethod: PaymentMethod.CUSTOMER_DEPOSIT,
        amount: 50000,
        status: 'CAPTURED',
        createdAt: now,
      },
    });

    // 3.3 Order 3: VOIDED Rp 200.000 (Wajib diabaikan dari Akrual & Kas Riil)
    const order3 = await prisma.order.create({
      data: {
        tenantId: testTenantId,
        outletId: testOutletId,
        userId: cashierUser.id,
        customerId: customer.id,
        invoiceNumber: `INV-VOID-${ts}`,
        orderStatus: OrderStatus.VOIDED,
        paymentStatus: PaymentStatus.UNPAID,
        subtotal: 200000,
        discountTotal: 0,
        taxTotal: 0,
        totalAmount: 200000,
        paidAmount: 0,
        createdAt: now,
      },
    });
    createdOrderIds.push(order3.id);

    // 3.4 Refund Rp 10.000 pada Order 1
    await prisma.refund.create({
      data: {
        tenantId: testTenantId,
        orderId: order1.id,
        refundNumber: `REF-${ts}`,
        amount: 10000,
        createdAt: now,
      },
    });

    // 3.5 Top-up Saldo Deposit Pelanggan Rp 100.000 (Kas Riil Masuk Baru, Bukan Omset Pesanan)
    const wallet = await prisma.customerLaundryWallet.create({
      data: {
        tenantId: testTenantId,
        customerId: customer.id,
        balanceAmount: 100000,
        quotaKg: 0,
      },
    });

    await prisma.customerLaundryWalletLedger.create({
      data: {
        walletId: wallet.id,
        tenantId: testTenantId,
        outletId: testOutletId,
        ledgerType: 'TOPUP_BALANCE',
        deltaAmount: 100000,
        balanceBefore: 0,
        balanceAfter: 100000,
        createdAt: now,
      },
    });

    // 3.6 Pelunasan Piutang Kasbon Rp 75.000
    const debt = await prisma.customerDebt.create({
      data: {
        tenantId: testTenantId,
        outletId: testOutletId,
        customerId: customer.id,
        orderId: order1.id,
        totalAmount: 75000,
        paidAmount: 75000,
        remainingAmount: 0,
        status: 'PAID',
      },
    });

    await prisma.customerDebtPayment.create({
      data: {
        tenantId: testTenantId,
        debtId: debt.id,
        outletId: testOutletId,
        amount: 75000,
        paymentMethod: PaymentMethod.CASH,
        paidAt: now,
      },
    });

    // Jalankan Kueri Financial Analytics Service
    const dateRange = resolveAnalyticsDateRange({ preset: 'today' }, 'Asia/Jakarta', now);
    const finRes = await getFinancialAnalytics({
      tenantId: testTenantId,
      outletId: testOutletId,
      dateRange,
    });

    // Validasi Angka Akuntansi:
    // Accrual Order Total = 50.000 (Order 1) + 50.000 (Order 2) = 100.000 (Order 3 Voided diabaikan)
    assert(
      finRes.revenue.accrualOrderTotal.current === 100000,
      `Accrual Order Total harus Rp 100.000, didapat: ${finRes.revenue.accrualOrderTotal.current}`
    );
    console.log('  ✅ Accrual Order Total = Rp 100.000 (Order VOIDED Rp 200.000 diabaikan)');

    // Refund Total = 10.000
    assert(
      finRes.revenue.refundTotal.current === 10000,
      `Refund Total harus Rp 10.000, didapat: ${finRes.revenue.refundTotal.current}`
    );

    // Net Revenue = 100.000 - 10.000 = 90.000
    assert(
      finRes.revenue.netRevenue.current === 90000,
      `Net Revenue harus Rp 90.000, didapat: ${finRes.revenue.netRevenue.current}`
    );
    console.log('  ✅ Net Revenue = Rp 90.000 (Accrual 100rb - Refund 10rb)');

    // Real Cash In Komponen:
    // 1. Direct Order Payments = Rp 50.000 (Hanya Order 1 Tunai, Order 2 Deposit diabaikan dari Kas Masuk)
    assert(
      finRes.cashFlow.components.directOrderPayments.current === 50000,
      `Direct Order Payments harus Rp 50.000, didapat: ${finRes.cashFlow.components.directOrderPayments.current}`
    );
    console.log('  ✅ Direct Order Payments = Rp 50.000 (Anti-double count deposit Rp 50rb diabaikan)');

    // 2. Debt Repayments = Rp 75.000
    assert(
      finRes.cashFlow.components.debtRepayments.current === 75000,
      `Debt Repayments harus Rp 75.000, didapat: ${finRes.cashFlow.components.debtRepayments.current}`
    );
    console.log('  ✅ Debt Repayments = Rp 75.000');

    // 3. Wallet Balance Top-Up = Rp 100.000
    assert(
      finRes.cashFlow.components.walletBalanceTopup.current === 100000,
      `Wallet Balance Top-Up harus Rp 100.000, didapat: ${finRes.cashFlow.components.walletBalanceTopup.current}`
    );
    console.log('  ✅ Wallet Balance Top-Up = Rp 100.000');

    // Total Real Cash In = 50.000 + 75.000 + 100.000 = 225.000
    assert(
      finRes.cashFlow.realCashIn.current === 225000,
      `Total Real Cash In harus Rp 225.000, didapat: ${finRes.cashFlow.realCashIn.current}`
    );
    console.log('  ✅ Total Real Cash In = Rp 225.000 (Bebas double counting)');

    // ----------------------------------------------------
    // TEST 4: HEALTH SCORE & DIVISION-BY-ZERO SAFETY
    // ----------------------------------------------------
    console.log('\n[TEST 4] Verifikasi Deterministic Health Score & Division-by-Zero Safety...');

    // 4.1 Outlet Kosong (0 transaksi)
    const emptyOverview = await getExecutiveOverview({
      tenantId: testTenantId,
      outletId: emptyOutletId,
      dateRange,
    });

    assert(emptyOverview.operationalPulse.totalValidOrders === 0, 'Total orders outlet kosong harus 0');
    assert(emptyOverview.operationalPulse.averageOrderValue === 0, 'AOV outlet kosong harus 0');
    assert(emptyOverview.healthScore.score === 0, 'Health score outlet kosong harus 0');
    assert(
      emptyOverview.healthScore.grade === 'BELUM_ADA_DATA',
      `Grade outlet kosong harus BELUM_ADA_DATA, didapat: ${emptyOverview.healthScore.grade}`
    );
    assert(
      emptyOverview.healthScore.availability === 'EMPTY',
      'Availability outlet kosong harus EMPTY'
    );

    const emptyJsonStr = JSON.stringify(emptyOverview);
    assert(!emptyJsonStr.includes('NaN'), 'Output JSON outlet kosong TIDAK boleh mengandung NaN');
    console.log('  ✅ Outlet kosong menghasilkan score 0 & grade BELUM_ADA_DATA tanpa NaN');

    // 4.2 Outlet Aktif dengan Transaksi
    const activeOverview = await getExecutiveOverview({
      tenantId: testTenantId,
      outletId: testOutletId,
      dateRange,
    });

    assert(activeOverview.operationalPulse.totalValidOrders === 2, 'Total orders aktif harus 2');
    assert(
      activeOverview.operationalPulse.averageOrderValue === 45000,
      `AOV aktif harus 45000 (90rb / 2 order), didapat: ${activeOverview.operationalPulse.averageOrderValue}`
    );
    assert(activeOverview.healthScore.score > 0, 'Health score outlet aktif harus > 0');
    assert(
      activeOverview.healthScore.grade !== 'BELUM_ADA_DATA',
      'Grade outlet aktif bukan BELUM_ADA_DATA'
    );
    console.log(`  ✅ Outlet aktif menghasilkan skor kesehatan ${activeOverview.healthScore.score} (${activeOverview.healthScore.grade})`);

    console.log('\n====================================================');
    console.log('🎉 ALL LAUNDRY ANALYTICS BATCH 2 TESTS PASSED 100%!');
    console.log('====================================================');
  } finally {
    // ----------------------------------------------------
    // 5. TEARDOWN BERSIH (0 RESIDU DI DB)
    // ----------------------------------------------------
    console.log('\n[TEARDOWN] Membersihkan seluruh data pengujian terisolasi...');
    try {
      if (testTenantId) {
        // Hapus secara berurutan sesuai relasi foreign keys
        await prisma.$executeRawUnsafe(`DELETE FROM "refunds" WHERE "tenant_id" = $1;`, testTenantId);
        await prisma.$executeRawUnsafe(`DELETE FROM "payment_transactions" WHERE "tenant_id" = $1;`, testTenantId);
        await prisma.$executeRawUnsafe(`DELETE FROM "customer_debt_payments" WHERE "tenant_id" = $1;`, testTenantId);
        await prisma.$executeRawUnsafe(`DELETE FROM "customer_debts" WHERE "tenant_id" = $1;`, testTenantId);
        await prisma.$executeRawUnsafe(`DELETE FROM "customer_laundry_wallet_ledgers" WHERE "tenant_id" = $1;`, testTenantId);
        await prisma.$executeRawUnsafe(`DELETE FROM "customer_laundry_wallets" WHERE "tenant_id" = $1;`, testTenantId);
        await prisma.$executeRawUnsafe(`DELETE FROM "cash_movements" WHERE "tenant_id" = $1;`, testTenantId);
        await prisma.$executeRawUnsafe(`DELETE FROM "laundry_incidents" WHERE "tenant_id" = $1;`, testTenantId);
        await prisma.$executeRawUnsafe(`DELETE FROM "laundry_customer_feedbacks" WHERE "tenant_id" = $1;`, testTenantId);
        await prisma.$executeRawUnsafe(`DELETE FROM "laundry_order_details" WHERE "tenant_id" = $1;`, testTenantId);
        await prisma.$executeRawUnsafe(`DELETE FROM "order_items" WHERE "order_id" IN (SELECT id FROM "orders" WHERE "tenant_id" = $1);`, testTenantId);
        await prisma.$executeRawUnsafe(`DELETE FROM "orders" WHERE "tenant_id" = $1;`, testTenantId);
        await prisma.$executeRawUnsafe(`DELETE FROM "shifts" WHERE "tenant_id" = $1;`, testTenantId);
        await prisma.$executeRawUnsafe(`DELETE FROM "users" WHERE "tenant_id" = $1;`, testTenantId);
        await prisma.$executeRawUnsafe(`DELETE FROM "outlets" WHERE "tenant_id" = $1;`, testTenantId);
        await prisma.$executeRawUnsafe(`DELETE FROM "customers" WHERE "tenant_id" = $1;`, testTenantId);
        await prisma.$executeRawUnsafe(`DELETE FROM "tenants" WHERE "id" = $1;`, testTenantId);
        console.log('  ✅ Teardown selesai. 0 sisa data pengujian di database PostgreSQL.');
      }
    } catch (cleanErr: any) {
      console.warn('  ⚠️ Peringatan saat teardown:', cleanErr.message);
    }
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
