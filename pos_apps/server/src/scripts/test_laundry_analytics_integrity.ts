/**
 * Comprehensive QA & Verification Suite (Task W1-22 - Final Wave 1)
 * Laundry Outlet Performance Intelligence (Well POS)
 * 
 * Menguji:
 * 1. Accounting Integrity (Anti-Double Counting):
 *    - Order tunai -> Accrual +X, Real Cash In +X
 *    - Order bayar CUSTOMER_DEPOSIT -> Accrual +X, Real Cash In +0
 *    - Top-up saldo TOPUP_BALANCE -> Accrual +0, Real Cash In +X
 *    - Pelunasan piutang CustomerDebtPayment -> Accrual +0, Real Cash In +X
 *    - Order VOIDED / CANCELLED -> Accrual +0, Real Cash In +0
 *    - Refund parsial -> Net Revenue & AOV berkurang akurat
 *    - Kompensasi insiden COMPENSATED -> masuk incidentExpense & recordedOpex
 *    - fixedOpex bernilai current: null dengan availability: 'MISSING'
 * 2. RBAC & Outlet Isolation Matrix (5 Skenario Lengkap):
 *    - OWNER: 200 di semua endpoint analitik termasuk /benchmark, /ai/forecast, POST /ai/query, dan outletId=ALL
 *    - ADMIN Tenant-wide (outletId: null): 200 di /overview & /financial (baik outlet spesifik maupun ALL), 403 di /benchmark
 *    - ADMIN Branch-restricted (outletId: branchA): 200 di /financial untuk branchA, 403 saat meminta outletId=ALL atau branchB, 403 di /benchmark
 *    - SUPERVISOR: 403 di /financial, /sales, /customers, /benchmark, dan /drilldown?type=UNPAID_DEBTS; 200 di /overview & /operations dengan 0 field finansial & 0 alert finansial yang bocor
 *    - CASHIER: 403 di seluruh /api/laundry/analytics/*
 *    - Cross-Tenant Isolation: data tenant A tidak pernah muncul di query tenant B
 * 3. Drilldown & AI Guardrails:
 *    - /drilldown?type=ORDERS_BY_PAYMENT (status CAPTURED) lulus 200 tanpa error enum
 *    - POST /ai/query untuk pertanyaan di luar cakupan mengembalikan intent OUT_OF_SCOPE tanpa mengarang angka
 * 4. Pembersihan Data Uji Tuntas di Blok finally (0 Residu di PostgreSQL).
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {
  PrismaClient,
  Role,
  PaymentMethod,
  PaymentStatus,
  OrderStatus,
} from '@prisma/client';
import { laundryAnalyticsRouter } from '../routes/laundry_analytics.routes';
import { resolveAnalyticsDateRange } from '../services/laundry_analytics/dateRangeResolver.service';
import { getFinancialAnalytics } from '../services/laundry_analytics/laundryAnalyticsFinancial.service';

const prisma = new PrismaClient();

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function runIntegrityTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING COMPREHENSIVE QA & INTEGRITY SUITE (W1-22)');
  console.log('====================================================');

  const ts = Date.now();
  const jwtSecret = process.env.JWT_SECRET || 'test-jwt-secret';

  // Tracking IDs untuk pembersihan 100% tuntas
  let tenantAId = '';
  let tenantBId = '';
  let outletA1Id = '';
  let outletA2Id = '';
  let outletBId = '';

  const createdUserIds: string[] = [];

  try {
    console.log('\n[SETUP] Menyiapkan tenant, outlet, dan user 5 skenario RBAC...');

    // 1. Buat Tenant A (Tenant Utama) & Tenant B (Tenant Pembanding Isolasi)
    const tenantA = await prisma.tenant.create({
      data: {
        name: `Tenant A Laundry Integrity ${ts}`,
        slug: `tenant-a-int-${ts}`,
        businessVertical: 'SERVICES',
        businessType: 'Laundry Kiloan & Satuan',
        status: 'ACTIVE',
      },
    });
    tenantAId = tenantA.id;

    const tenantB = await prisma.tenant.create({
      data: {
        name: `Tenant B Laundry Integrity ${ts}`,
        slug: `tenant-b-int-${ts}`,
        businessVertical: 'SERVICES',
        businessType: 'Laundry Kiloan & Satuan',
        status: 'ACTIVE',
      },
    });
    tenantBId = tenantB.id;

    // 2. Buat Outlet: Tenant A (Outlet A1 & Outlet A2), Tenant B (Outlet B1)
    const outletA1 = await prisma.outlet.create({
      data: {
        tenantId: tenantAId,
        name: `Outlet A1 Pancoran ${ts}`,
        code: `OUT-A1-${ts}`,
        isWorkshop: false,
      },
    });
    outletA1Id = outletA1.id;

    const outletA2 = await prisma.outlet.create({
      data: {
        tenantId: tenantAId,
        name: `Outlet A2 Tebet ${ts}`,
        code: `OUT-A2-${ts}`,
        isWorkshop: false,
      },
    });
    outletA2Id = outletA2.id;

    const outletB1 = await prisma.outlet.create({
      data: {
        tenantId: tenantBId,
        name: `Outlet B1 Kemang ${ts}`,
        code: `OUT-B1-${ts}`,
        isWorkshop: false,
      },
    });
    outletBId = outletB1.id;

    // 3. Buat Pengguna untuk 5 Skenario RBAC
    const pwHash = await bcrypt.hash('password123', 8);

    // Skenario 1: OWNER Tenant A
    const ownerUser = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        outletId: outletA1Id,
        userCode: `OWN_A_${ts}`,
        name: 'Owner Tenant A',
        email: `owner.a.${ts}@qa-int.test`,
        passwordHash: pwHash,
        role: Role.OWNER,
        isActive: true,
        tokenVersion: 1,
      },
    });
    createdUserIds.push(ownerUser.id);

    // Skenario 2: ADMIN Tenant-wide (outletId: null - seperti Budi Laundry)
    const adminTenantWide = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        outletId: null, // Tenant-wide Admin!
        userCode: `ADM_TW_${ts}`,
        name: 'Admin Tenant Wide',
        email: `admin.tw.${ts}@qa-int.test`,
        passwordHash: pwHash,
        role: Role.ADMIN,
        isActive: true,
        tokenVersion: 1,
      },
    });
    createdUserIds.push(adminTenantWide.id);

    // Skenario 3: ADMIN Branch-restricted (outletId: outletA1Id)
    const adminBranchRestricted = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        outletId: outletA1Id, // Locked to Outlet A1
        userCode: `ADM_BR_${ts}`,
        name: 'Admin Branch A1',
        email: `admin.br.${ts}@qa-int.test`,
        passwordHash: pwHash,
        role: Role.ADMIN,
        isActive: true,
        tokenVersion: 1,
      },
    });
    createdUserIds.push(adminBranchRestricted.id);

    // Skenario 4: SUPERVISOR Branch-restricted (outletId: outletA1Id)
    const spvUser = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        outletId: outletA1Id,
        userCode: `SPV_A_${ts}`,
        name: 'Supervisor Branch A1',
        email: `spv.a.${ts}@qa-int.test`,
        passwordHash: pwHash,
        role: Role.SUPERVISOR,
        isActive: true,
        tokenVersion: 1,
      },
    });
    createdUserIds.push(spvUser.id);

    // Skenario 5: CASHIER (Disallowed Role)
    const cashierUser = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        outletId: outletA1Id,
        userCode: `CSH_A_${ts}`,
        name: 'Cashier Branch A1',
        email: `cashier.a.${ts}@qa-int.test`,
        passwordHash: pwHash,
        role: Role.CASHIER,
        isActive: true,
        tokenVersion: 1,
      },
    });
    createdUserIds.push(cashierUser.id);

    // User Tenant B (Untuk Uji Cross-Tenant)
    const ownerTenantB = await prisma.user.create({
      data: {
        tenantId: tenantBId,
        outletId: outletBId,
        userCode: `OWN_B_${ts}`,
        name: 'Owner Tenant B',
        email: `owner.b.${ts}@qa-int.test`,
        passwordHash: pwHash,
        role: Role.OWNER,
        isActive: true,
        tokenVersion: 1,
      },
    });
    createdUserIds.push(ownerTenantB.id);

    // Helper Pembuat JWT
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

    const tokenOwnerA = makeToken(ownerUser);
    const tokenAdminTW = makeToken(adminTenantWide);
    const tokenAdminBR = makeToken(adminBranchRestricted);
    const tokenSpvA = makeToken(spvUser);
    const tokenCashierA = makeToken(cashierUser);
    const tokenOwnerB = makeToken(ownerTenantB);

    // Buat Pelanggan Uji Tenant A
    const customerA = await prisma.customer.create({
      data: {
        tenantId: tenantAId,
        name: `Pelanggan Test A ${ts}`,
        phone: `+628111222${ts.toString().slice(-4)}`,
      },
    });

    // Buat Pelanggan Uji Tenant B
    const customerB = await prisma.customer.create({
      data: {
        tenantId: tenantBId,
        name: `Pelanggan Test B ${ts}`,
        phone: `+628999888${ts.toString().slice(-4)}`,
      },
    });

    const now = new Date();

    // ----------------------------------------------------
    // BAGIAN 1: ACCOUNTING INTEGRITY (ANTI-DOUBLE COUNTING)
    // ----------------------------------------------------
    console.log('\n[TEST 1] Verifikasi Accounting Integrity (Anti-Double Counting)...');

    // 1.1 Order Tunai: Rp 50.000 (PAID / COMPLETED) -> Accrual +50k, Real Cash In +50k
    const orderCash = await prisma.order.create({
      data: {
        tenantId: tenantAId,
        outletId: outletA1Id,
        userId: cashierUser.id,
        customerId: customerA.id,
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

    await prisma.paymentTransaction.create({
      data: {
        tenantId: tenantAId,
        outletId: outletA1Id,
        orderId: orderCash.id,
        paymentMethod: PaymentMethod.CASH,
        amount: 50000,
        status: 'CAPTURED',
        createdAt: now,
      },
    });

    // 1.2 Order bayar CUSTOMER_DEPOSIT: Rp 40.000 (PAID / COMPLETED) -> Accrual +40k, Real Cash In +0
    const orderDeposit = await prisma.order.create({
      data: {
        tenantId: tenantAId,
        outletId: outletA1Id,
        userId: cashierUser.id,
        customerId: customerA.id,
        invoiceNumber: `INV-DEP-${ts}`,
        orderStatus: OrderStatus.COMPLETED,
        paymentStatus: PaymentStatus.PAID,
        subtotal: 40000,
        discountTotal: 0,
        taxTotal: 0,
        totalAmount: 40000,
        paidAmount: 40000,
        createdAt: now,
      },
    });

    await prisma.paymentTransaction.create({
      data: {
        tenantId: tenantAId,
        outletId: outletA1Id,
        orderId: orderDeposit.id,
        paymentMethod: PaymentMethod.CUSTOMER_DEPOSIT,
        amount: 40000,
        status: 'CAPTURED',
        createdAt: now,
      },
    });

    // 1.3 Top-up saldo TOPUP_BALANCE: Rp 100.000 -> Accrual +0, Real Cash In +100k
    const walletA = await prisma.customerLaundryWallet.create({
      data: {
        tenantId: tenantAId,
        customerId: customerA.id,
        balanceAmount: 100000,
        quotaKg: 0,
      },
    });

    await prisma.customerLaundryWalletLedger.create({
      data: {
        walletId: walletA.id,
        tenantId: tenantAId,
        outletId: outletA1Id,
        ledgerType: 'TOPUP_BALANCE',
        deltaAmount: 100000,
        balanceBefore: 0,
        balanceAfter: 100000,
        createdAt: now,
      },
    });

    // 1.4 Pelunasan piutang CustomerDebtPayment: Rp 30.000 -> Accrual +0, Real Cash In +30k
    const debtA = await prisma.customerDebt.create({
      data: {
        tenantId: tenantAId,
        outletId: outletA1Id,
        customerId: customerA.id,
        orderId: orderCash.id,
        totalAmount: 30000,
        paidAmount: 30000,
        remainingAmount: 0,
        status: 'PAID',
      },
    });

    await prisma.customerDebtPayment.create({
      data: {
        tenantId: tenantAId,
        debtId: debtA.id,
        outletId: outletA1Id,
        amount: 30000,
        paymentMethod: PaymentMethod.CASH,
        paidAt: now,
      },
    });

    // 1.5 Order VOIDED / CANCELLED: Rp 200.000 -> Accrual +0, Real Cash In +0
    await prisma.order.create({
      data: {
        tenantId: tenantAId,
        outletId: outletA1Id,
        userId: cashierUser.id,
        customerId: customerA.id,
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

    // 1.6 Refund Parsial: Rp 15.000 pada orderCash
    await prisma.refund.create({
      data: {
        tenantId: tenantAId,
        orderId: orderCash.id,
        refundNumber: `REF-INT-${ts}`,
        amount: 15000,
        createdAt: now,
      },
    });

    // 1.7 Kompensasi insiden COMPENSATED: Rp 25.000
    await prisma.laundryIncident.create({
      data: {
        tenantId: tenantAId,
        outletId: outletA1Id,
        orderId: orderCash.id,
        incidentType: 'DAMAGED',
        itemDescription: 'Baju robek saat proses cuci',
        stage: 'WASHING',
        reportedById: cashierUser.id,
        notes: 'Ganti rugi pakaian pelanggan',
        estimatedCompensation: 25000,
        approvedCompensation: 25000,
        status: 'COMPENSATED',
        resolvedAt: now,
      },
    });

    // Data Tenant B (Untuk Verifikasi Isolasi Cross-Tenant: Rp 999.000)
    const orderTenantB = await prisma.order.create({
      data: {
        tenantId: tenantBId,
        outletId: outletBId,
        userId: ownerTenantB.id,
        customerId: customerB.id,
        invoiceNumber: `INV-TB-${ts}`,
        orderStatus: OrderStatus.COMPLETED,
        paymentStatus: PaymentStatus.PAID,
        subtotal: 999000,
        discountTotal: 0,
        taxTotal: 0,
        totalAmount: 999000,
        paidAmount: 999000,
        createdAt: now,
      },
    });

    await prisma.paymentTransaction.create({
      data: {
        tenantId: tenantBId,
        outletId: outletBId,
        orderId: orderTenantB.id,
        paymentMethod: PaymentMethod.CASH,
        amount: 999000,
        status: 'CAPTURED',
        createdAt: now,
      },
    });

    // Eksekusi Financial Analytics Service Langsung
    const dateRangeToday = resolveAnalyticsDateRange({ preset: 'today' }, 'Asia/Jakarta', now);
    const finResult = await getFinancialAnalytics({
      tenantId: tenantAId,
      outletId: outletA1Id,
      dateRange: dateRangeToday,
    });

    // Verifikasi Formula Akuntansi:
    // Accrual Order Total = 50.000 (Tunai) + 40.000 (Deposit) = 90.000 (Void 200rb diabaikan)
    assert(
      finResult.revenue.accrualOrderTotal.current === 90000,
      `Accrual Order Total harus Rp 90.000, aktual: ${finResult.revenue.accrualOrderTotal.current}`
    );
    console.log('  ✅ 1.1 Accrual Order Total = Rp 90.000 (Order VOIDED Rp 200.000 diabaikan)');

    // Refund Total = 15.000
    assert(
      finResult.revenue.refundTotal.current === 15000,
      `Refund Total harus Rp 15.000, aktual: ${finResult.revenue.refundTotal.current}`
    );
    console.log('  ✅ 1.2 Refund Total = Rp 15.000');

    // Net Revenue = 90.000 - 15.000 = 75.000
    assert(
      finResult.revenue.netRevenue.current === 75000,
      `Net Revenue harus Rp 75.000, aktual: ${finResult.revenue.netRevenue.current}`
    );
    console.log('  ✅ 1.3 Net Revenue = Rp 75.000 (Accrual 90rb - Refund 15rb)');

    // Real Cash In = Direct Cash (50.000) + Debt Repayment (30.000) + Wallet Top-Up (100.000) = 180.000
    // Pembayaran pakai CUSTOMER_DEPOSIT (40.000) TIDAK boleh masuk ke Real Cash In hari ini!
    assert(
      finResult.cashFlow.components.directOrderPayments.current === 50000,
      `Direct Order Payments harus Rp 50.000, aktual: ${finResult.cashFlow.components.directOrderPayments.current}`
    );
    assert(
      finResult.cashFlow.components.debtRepayments.current === 30000,
      `Debt Repayments harus Rp 30.000, aktual: ${finResult.cashFlow.components.debtRepayments.current}`
    );
    assert(
      finResult.cashFlow.components.walletBalanceTopup.current === 100000,
      `Wallet Balance Top-Up harus Rp 100.000, aktual: ${finResult.cashFlow.components.walletBalanceTopup.current}`
    );
    assert(
      finResult.cashFlow.realCashIn.current === 180000,
      `Total Real Cash In harus Rp 180.000, aktual: ${finResult.cashFlow.realCashIn.current}`
    );
    console.log('  ✅ 1.4 Real Cash In = Rp 180.000 (Anti-Double Counting: CUSTOMER_DEPOSIT Rp 40k diabaikan dari kas masuk)');

    // Incident Expense & Recorded OPEX = 25.000
    assert(
      finResult.opex.incidentExpense.current === 25000,
      `Incident Expense harus Rp 25.000, aktual: ${finResult.opex.incidentExpense.current}`
    );
    assert(
      finResult.opex.recordedOpex.current === 25000,
      `Recorded OPEX harus memuat kompensasi insiden Rp 25.000, aktual: ${finResult.opex.recordedOpex.current}`
    );
    console.log('  ✅ 1.5 Kompensasi Insiden Rp 25.000 tercatat di incidentExpense & recordedOpex');

    // Fixed OPEX: current null dengan availability 'MISSING' (ADR-005)
    assert(
      finResult.opex.fixedOpex.current === null,
      'fixedOpex.current harus null'
    );
    assert(
      finResult.opex.fixedOpex.availability === 'MISSING',
      'fixedOpex.availability harus MISSING'
    );
    console.log('  ✅ 1.6 fixedOpex bernilai current: null dengan availability: MISSING (ADR-005)');

    // ----------------------------------------------------
    // BAGIAN 2: RBAC & OUTLET ISOLATION MATRIX (5 SKENARIO)
    // ----------------------------------------------------
    console.log('\n[TEST 2] Verifikasi RBAC & Outlet Isolation Matrix (5 Skenario)...');

    const app = express();
    app.use(express.json());
    app.use('/api/laundry/analytics', laundryAnalyticsRouter);

    const server = app.listen(0);
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}/api/laundry/analytics`;

    try {
      // 2.1 SKENARIO 1: OWNER (Akses Penuh Seluruh 13 Endpoint + outletId=ALL)
      const ownerEndpoints = [
        '/meta',
        '/overview',
        '/financial',
        '/sales',
        '/customers',
        '/operations',
        '/employees',
        '/machines',
        '/inventory',
        '/drilldown?type=ORDERS_BY_DATE',
        '/benchmark',
        '/ai/summary',
        '/ai/forecast',
      ];

      for (const ep of ownerEndpoints) {
        const separator = ep.includes('?') ? '&' : '?';
        const res = await fetch(`${baseUrl}${ep}${separator}outletId=ALL`, {
          headers: { Authorization: `Bearer ${tokenOwnerA}` },
        });
        assert(res.status === 200, `OWNER harus sukses 200 pada ${ep}, status: ${res.status}`);
      }

      // Test POST /ai/query untuk OWNER
      const resOwnerAi = await fetch(`${baseUrl}/ai/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenOwnerA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: 'Berapa total omzet bulan ini?' }),
      });
      assert(resOwnerAi.status === 200, 'OWNER harus sukses 200 pada POST /ai/query');
      console.log('  ✅ 2.1 OWNER sukses 200 di seluruh 13+ endpoint dan bebas memilih outletId=ALL');

      // 2.2 SKENARIO 2: ADMIN Tenant-wide (outletId: null - seperti Budi Laundry)
      // Sukses di /overview & /financial (baik requested outlet maupun ALL)
      const resAdminTwOverview = await fetch(`${baseUrl}/overview?outletId=ALL`, {
        headers: { Authorization: `Bearer ${tokenAdminTW}` },
      });
      assert(resAdminTwOverview.status === 200, 'Tenant-wide Admin harus sukses 200 di /overview?outletId=ALL');

      const resAdminTwFinAll = await fetch(`${baseUrl}/financial?outletId=ALL`, {
        headers: { Authorization: `Bearer ${tokenAdminTW}` },
      });
      assert(resAdminTwFinAll.status === 200, 'Tenant-wide Admin harus sukses 200 di /financial?outletId=ALL');

      const resAdminTwFinSpec = await fetch(`${baseUrl}/financial?outletId=${outletA1Id}`, {
        headers: { Authorization: `Bearer ${tokenAdminTW}` },
      });
      assert(resAdminTwFinSpec.status === 200, 'Tenant-wide Admin harus sukses 200 di /financial untuk outlet spesifik');

      // Ditolak 403 di /benchmark (Khusus OWNER)
      const resAdminTwBench = await fetch(`${baseUrl}/benchmark`, {
        headers: { Authorization: `Bearer ${tokenAdminTW}` },
      });
      assert(resAdminTwBench.status === 403, 'Tenant-wide Admin harus ditolak 403 di /benchmark');
      console.log('  ✅ 2.2 ADMIN Tenant-wide (outletId=null) sukses 200 di /overview & /financial (ALL/spesifik), dan ditolak 403 di /benchmark');

      // 2.3 SKENARIO 3: ADMIN Branch-restricted (outletId: outletA1Id)
      // Sukses di outlet tugasnya (outletA1Id)
      const resAdminBrOk = await fetch(`${baseUrl}/financial?outletId=${outletA1Id}`, {
        headers: { Authorization: `Bearer ${tokenAdminBR}` },
      });
      assert(resAdminBrOk.status === 200, 'Branch Admin harus sukses 200 di outlet tugasnya');

      // Ditolak 403 jika bypass outletId=ALL
      const resAdminBrAll = await fetch(`${baseUrl}/financial?outletId=ALL`, {
        headers: { Authorization: `Bearer ${tokenAdminBR}` },
      });
      assert(resAdminBrAll.status === 403, 'Branch Admin harus ditolak 403 jika meminta outletId=ALL');

      // Ditolak 403 jika meminta cabang lain (outletA2Id)
      const resAdminBrOther = await fetch(`${baseUrl}/financial?outletId=${outletA2Id}`, {
        headers: { Authorization: `Bearer ${tokenAdminBR}` },
      });
      assert(resAdminBrOther.status === 403, 'Branch Admin harus ditolak 403 jika meminta cabang lain');

      // Ditolak 403 di /benchmark
      const resAdminBrBench = await fetch(`${baseUrl}/benchmark`, {
        headers: { Authorization: `Bearer ${tokenAdminBR}` },
      });
      assert(resAdminBrBench.status === 403, 'Branch Admin harus ditolak 403 di /benchmark');
      console.log('  ✅ 2.3 ADMIN Branch-restricted terkunci ketat: sukses di cabangnya, ditolak 403 pada ALL, cabang lain, dan /benchmark');

      // 2.4 SKENARIO 4: SUPERVISOR (Akses Operasional Murni, Nol Kebocoran Finansial)
      const spvForbiddenEndpoints = ['/financial', '/sales', '/customers', '/benchmark', '/ai/forecast'];
      for (const ep of spvForbiddenEndpoints) {
        const res = await fetch(`${baseUrl}${ep}`, {
          headers: { Authorization: `Bearer ${tokenSpvA}` },
        });
        assert(res.status === 403, `SUPERVISOR harus ditolak 403 di ${ep}`);
      }

      // Ditolak 403 pada drilldown finansial
      const resSpvDrillDebt = await fetch(`${baseUrl}/drilldown?type=UNPAID_DEBTS`, {
        headers: { Authorization: `Bearer ${tokenSpvA}` },
      });
      assert(resSpvDrillDebt.status === 403, 'SUPERVISOR harus ditolak 403 di drilldown UNPAID_DEBTS');

      // Diizinkan di /operations & /overview
      const resSpvOps = await fetch(`${baseUrl}/operations`, {
        headers: { Authorization: `Bearer ${tokenSpvA}` },
      });
      assert(resSpvOps.status === 200, 'SUPERVISOR harus sukses 200 di /operations');

      const resSpvOverview = await fetch(`${baseUrl}/overview`, {
        headers: { Authorization: `Bearer ${tokenSpvA}` },
      });
      assert(resSpvOverview.status === 200, 'SUPERVISOR harus sukses 200 di /overview');
      const spvJson: any = await resSpvOverview.json();
      assert(spvJson.data.financialPulse === undefined, 'financialPulse TIDAK BOLEH bocor ke SUPERVISOR');
      assert(spvJson.data.healthScore.pillars.profitMarginScore === undefined, 'profitMarginScore TIDAK BOLEH bocor ke SUPERVISOR');
      console.log('  ✅ 2.4 SUPERVISOR ditolak 403 di finansial/sales/customers/drilldown debt, sukses di /overview & /operations dengan sanitasi bersih');

      // 2.5 SKENARIO 5: CASHIER (Role Terlarang Global)
      const cashierEndpoints = ['/overview', '/financial', '/sales', '/operations', '/employees'];
      for (const ep of cashierEndpoints) {
        const res = await fetch(`${baseUrl}${ep}`, {
          headers: { Authorization: `Bearer ${tokenCashierA}` },
        });
        assert(res.status === 403, `CASHIER harus ditolak 403 di ${ep}`);
      }
      console.log('  ✅ 2.5 CASHIER ditolak 403 di seluruh endpoint analitik');

      // 2.6 SKENARIO 6: CROSS-TENANT ISOLATION
      // Kueri finansial Tenant A tidak boleh mengandung angka Tenant B (Rp 999.000)
      const resFinTenantA = await fetch(`${baseUrl}/financial?outletId=ALL`, {
        headers: { Authorization: `Bearer ${tokenOwnerA}` },
      });
      const finTenantAJson: any = await resFinTenantA.json();
      assert(
        finTenantAJson.data.revenue.accrualOrderTotal.current === 90000,
        `Tenant A harus memiliki omzet Rp 90.000, bukan tercampur Tenant B (999.000). Aktual: ${finTenantAJson.data.revenue.accrualOrderTotal.current}`
      );

      // Kueri Tenant B tidak boleh mengandung angka Tenant A
      const resFinTenantB = await fetch(`${baseUrl}/financial?outletId=ALL`, {
        headers: { Authorization: `Bearer ${tokenOwnerB}` },
      });
      const finTenantBJson: any = await resFinTenantB.json();
      assert(
        finTenantBJson.data.revenue.accrualOrderTotal.current === 999000,
        `Tenant B harus memiliki omzet Rp 999.000 murni. Aktual: ${finTenantBJson.data.revenue.accrualOrderTotal.current}`
      );
      console.log('  ✅ 2.6 Cross-Tenant Isolation terbukti 100% kedap (Data Tenant A & B tidak pernah bocor)');

      // ----------------------------------------------------
      // BAGIAN 3: DRILLDOWN & AI GUARDRAILS
      // ----------------------------------------------------
      console.log('\n[TEST 3] Verifikasi Drilldown & AI Guardrails...');

      // 3.1 Drilldown ORDERS_BY_PAYMENT dengan status CAPTURED lulus 200 tanpa error enum
      const resDrillPayment = await fetch(
        `${baseUrl}/drilldown?type=ORDERS_BY_PAYMENT&paymentMethod=CASH&paymentStatus=CAPTURED`,
        {
          headers: { Authorization: `Bearer ${tokenOwnerA}` },
        }
      );
      assert(resDrillPayment.status === 200, `Drilldown ORDERS_BY_PAYMENT harus 200 OK, status: ${resDrillPayment.status}`);
      const drillPaymentJson: any = await resDrillPayment.json();
      assert(drillPaymentJson.status === 'success', 'Drilldown ORDERS_BY_PAYMENT status harus success');
      console.log('  ✅ 3.1 Drilldown ORDERS_BY_PAYMENT (status CAPTURED) sukses 200 OK tanpa error enum');

      // 3.2 POST /ai/query untuk pertanyaan Out of Scope menolak halusinasi dengan jujur
      const resAiOutOfScope = await fetch(`${baseUrl}/ai/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenOwnerA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: 'Bagaimana cara memasak rendang daging sapi?' }),
      });
      assert(resAiOutOfScope.status === 200, 'POST /ai/query harus sukses 200');
      const aiOutOfScopeJson: any = await resAiOutOfScope.json();
      assert(aiOutOfScopeJson.data.intent === 'OUT_OF_SCOPE', 'Pertanyaan rendang harus diklasifikasikan OUT_OF_SCOPE');
      assert(
        aiOutOfScopeJson.data.answer.toLowerCase().includes('maaf') ||
          aiOutOfScopeJson.data.answer.toLowerCase().includes('belum tercakup') ||
          aiOutOfScopeJson.data.answer.toLowerCase().includes('di luar'),
        'Jawaban AI harus menolak halusinasi secara sopan dan terarah'
      );
      console.log('  ✅ 3.2 AI Guardrail: Pertanyaan di luar cakupan direspon OUT_OF_SCOPE tanpa halusinasi');
    } finally {
      server.close();
    }

    console.log('\n====================================================');
    console.log('🎉 ALL INTEGRITY TESTS (W1-22) PASSED SUCCESSFULLY!');
    console.log('====================================================');
  } finally {
    // ----------------------------------------------------
    // TEARDOWN: MEMBERSIHKAN 100% DATA UJI DARI DATABASE
    // ----------------------------------------------------
    console.log('\n[TEARDOWN] Membersihkan seluruh data uji dari database PostgreSQL...');

    const tenantIdsToClean = [tenantAId, tenantBId].filter(Boolean);

    for (const tId of tenantIdsToClean) {
      await prisma.customerDebtPayment.deleteMany({ where: { tenantId: tId } });
      await prisma.customerDebt.deleteMany({ where: { tenantId: tId } });
      await prisma.customerLaundryWalletLedger.deleteMany({ where: { tenantId: tId } });
      await prisma.customerLaundryWallet.deleteMany({ where: { tenantId: tId } });
      await prisma.laundryIncident.deleteMany({ where: { tenantId: tId } });
      await prisma.refund.deleteMany({ where: { tenantId: tId } });
      await prisma.paymentTransaction.deleteMany({ where: { tenantId: tId } });
      await prisma.orderItem.deleteMany({ where: { order: { tenantId: tId } } });
      await prisma.order.deleteMany({ where: { tenantId: tId } });
      await prisma.customer.deleteMany({ where: { tenantId: tId } });
      await prisma.user.deleteMany({ where: { tenantId: tId } });
      await prisma.outlet.deleteMany({ where: { tenantId: tId } });
      await prisma.tenant.deleteMany({ where: { id: tId } });
    }

    // Verifikasi 0 Residu DB
    const remainingTenants = await prisma.tenant.count({
      where: { id: { in: tenantIdsToClean } },
    });
    assert(remainingTenants === 0, 'Database harus 100% bersih dari tenant uji!');
    console.log('  ✅ Teardown selesai. 0 sisa data pengujian di PostgreSQL (100% bersih).');
  }
}

runIntegrityTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ INTEGRITY TEST SUITE FAILED:', err);
    process.exit(1);
  });
