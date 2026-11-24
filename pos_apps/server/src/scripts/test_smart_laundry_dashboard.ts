import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

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

async function runSmartDashboardE2ETest() {
  console.log('========================================================================');
  console.log('🧪 FINAL PRE-PILOT QA: E2E SMART ROLE-BASED DASHBOARD & LATERAL JOIN');
  console.log(`Target Backend: ${API_BASE}`);
  console.log('========================================================================\n');

  // Track created entities for 100% clean teardown
  const createdOrderIds: string[] = [];
  const createdServiceIds: string[] = [];
  const createdCustomerIds: string[] = [];
  const createdUserIds: string[] = [];

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

    // Snapshot konfigurasi outlet
    initialReceiptConfig = outlet.receiptConfig;
    initialDepositConfig = outlet.laundryDepositConfig;
    initialCommissionConfig = outlet.laundryCommissionConfig;

    // A. Pastikan User OWNER / ADMIN
    let ownerUser = await prisma.user.findFirst({
      where: { tenantId, role: { in: [Role.OWNER, Role.ADMIN] }, isActive: true },
    });
    if (!ownerUser) {
      const pwHash = await bcrypt.hash('password123', 10);
      ownerUser = await prisma.user.create({
        data: {
          tenantId,
          outletId,
          userCode: 'OWN_QA',
          name: 'Owner QA Laundry',
          email: 'qa.owner.smart@wellpos-test.com',
          passwordHash: pwHash,
          role: Role.OWNER,
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

    // B. Buat / Ambil User CASHIER
    let cashierUser = await prisma.user.findFirst({
      where: { tenantId, role: Role.CASHIER, isActive: true },
    });
    if (!cashierUser) {
      const pwHash = await bcrypt.hash('password123', 10);
      cashierUser = await prisma.user.create({
        data: {
          tenantId,
          outletId,
          userCode: 'CSH_QA',
          name: 'Kasir QA Smart',
          email: 'qa.cashier.smart@wellpos-test.com',
          passwordHash: pwHash,
          role: Role.CASHIER,
          isActive: true,
          tokenVersion: 1,
        },
      });
      createdUserIds.push(cashierUser.id);
    }

    const cashierToken = jwt.sign(
      {
        userId: cashierUser.id,
        role: Role.CASHIER,
        outletId,
        tenantId,
        tokenVersion: cashierUser.tokenVersion,
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );
    const cashierAuth = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cashierToken}`,
    };

    // C. Buat / Ambil User WAREHOUSE (PRODUCTION)
    let warehouseUser = await prisma.user.findFirst({
      where: { tenantId, role: Role.WAREHOUSE, isActive: true },
    });
    if (!warehouseUser) {
      const pwHash = await bcrypt.hash('password123', 10);
      warehouseUser = await prisma.user.create({
        data: {
          tenantId,
          outletId,
          userCode: 'WRH_QA',
          name: 'Operator Produksi QA',
          email: 'qa.warehouse.smart@wellpos-test.com',
          passwordHash: pwHash,
          role: Role.WAREHOUSE,
          isActive: true,
          tokenVersion: 1,
        },
      });
      createdUserIds.push(warehouseUser.id);
    }

    const warehouseToken = jwt.sign(
      {
        userId: warehouseUser.id,
        role: Role.WAREHOUSE,
        outletId,
        tenantId,
        tokenVersion: warehouseUser.tokenVersion,
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );
    const warehouseAuth = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${warehouseToken}`,
    };

    // Pastikan ada shift terbuka
    let activeShift = await prisma.shift.findFirst({
      where: { outletId, status: 'OPEN' },
    });
    if (!activeShift) {
      activeShift = await prisma.shift.create({
        data: {
          tenantId,
          outletId,
          userId: cashierUser.id,
          startTime: new Date(),
          startingCash: 100000,
          status: 'OPEN',
        },
      });
    }

    // =========================================================================
    // 1. SKENARIO A: SNAPSHOT KILOAN VS SATUAN (NOTA CAMPURAN)
    // =========================================================================
    console.log('▶️ [1] Menguji Snapshot Kiloan vs Satuan di Nota Campuran...');
    const testPhone = `0812999${Date.now().toString().slice(-5)}`;
    const testCustName = `Pelanggan QA Campuran ${Date.now()}`;
    const testCustomer = await prisma.customer.create({
      data: {
        tenantId,
        name: testCustName,
        phone: testPhone,
      },
    });
    createdCustomerIds.push(testCustomer.id);

    // Kirim order campuran: 1 item bersatuan 'Kg' Rp 30.000 + 1 item bersatuan 'Pcs' Rp 25.000
    const orderPayload = {
      outletId,
      customerId: testCustomer.id,
      customerName: testCustName,
      customerPhone: testPhone,
      paymentMethod: 'CASH',
      depositAmount: 55000,
      totalPieces: 5,
      items: [
        {
          name: 'Cuci Kering Lipat Reguler QA',
          category: 'KILOAN',
          quantity: 3,
          unit: 'Kg', // Title Case
          unitPrice: 10000,
        },
        {
          name: 'Kemeja Katun Satuan QA',
          category: 'SATUAN',
          quantity: 1,
          unit: 'Pcs', // Mixed Case
          unitPrice: 25000,
        },
      ],
    };

    const createOrderRes = await fetch(`${API_BASE}/api/laundry/orders`, {
      method: 'POST',
      headers: ownerAuth,
      body: JSON.stringify(orderPayload),
    });
    const createOrderData: any = await createOrderRes.json();
    assert(
      createOrderRes.status === 201 || createOrderRes.status === 200,
      `Gagal membuat order campuran laundry: ${createOrderData?.message || JSON.stringify(createOrderData)}`
    );
    const mixedOrderId = createOrderData.data?.id || createOrderData.data?.order?.id;
    assert(!!mixedOrderId, 'Order ID hasil checkout laundry tidak valid');
    createdOrderIds.push(mixedOrderId);

    // Verifikasi DB: order_items harus menyimpan unit normalisasi dan pricingBasis yang akurat
    const orderItemsDb = await prisma.orderItem.findMany({
      where: { orderId: mixedOrderId },
      orderBy: { subtotal: 'asc' },
    });
    assertEq(orderItemsDb.length, 2, 'Harus ada tepat 2 order_items tersimpan');

    const itemSatuan = orderItemsDb.find((it) => it.productName === 'Kemeja Katun Satuan QA');
    const itemKiloan = orderItemsDb.find((it) => it.productName === 'Cuci Kering Lipat Reguler QA');

    assert(!!itemKiloan, 'Item kiloan tidak ditemukan di DB');
    assert(!!itemSatuan, 'Item satuan tidak ditemukan di DB');

    assertEq(itemKiloan?.unit, 'KG', 'Item kiloan wajib dinormalisasi uppercase KG');
    assertEq(itemKiloan?.pricingBasis, 'KILOAN', 'Item kiloan wajib memiliki pricingBasis KILOAN');
    assertEq(Number(itemKiloan?.subtotal), 30000, 'Subtotal item kiloan harus Rp 30.000');

    assertEq(itemSatuan?.unit, 'PCS', 'Item satuan wajib dinormalisasi uppercase PCS');
    assertEq(itemSatuan?.pricingBasis, 'SATUAN', 'Item satuan wajib memiliki pricingBasis SATUAN');
    assertEq(Number(itemSatuan?.subtotal), 25000, 'Subtotal item satuan harus Rp 25.000');

    console.log('   ✅ [PASS A] DB Snapshot Kiloan (unit: KG, pricingBasis: KILOAN) & Satuan (unit: PCS, pricingBasis: SATUAN) valid 100%.\n');

    // =========================================================================
    // 2. SKENARIO B: ANTI-DUPLIKASI LEFT JOIN LATERAL DI DASHBOARD SUMMARY
    // =========================================================================
    console.log('▶️ [2] Menguji Anti-Duplikasi LEFT JOIN LATERAL pada Layanan Ganda (Active & Inactive)...');

    const serviceName = 'Cuci Boneka Super QA Lateral';

    // Buat 2 layanan dengan nama sama persis (1 inactive, 1 active)
    const serviceInactive = await prisma.laundryService.create({
      data: {
        tenantId,
        name: serviceName,
        category: 'SATUAN',
        unit: 'PCS',
        price: 20000,
        isActive: false,
      },
    });
    createdServiceIds.push(serviceInactive.id);

    const serviceActive = await prisma.laundryService.create({
      data: {
        tenantId,
        name: serviceName,
        category: 'SATUAN',
        unit: 'PCS',
        price: 25000,
        isActive: true,
      },
    });
    createdServiceIds.push(serviceActive.id);

    // Buat 1 nota transaksi historis lama dengan unit=NULL & pricingBasis=NULL
    const legacyOrder = await prisma.order.create({
      data: {
        tenant: { connect: { id: tenantId } },
        outlet: { connect: { id: outletId } },
        cashier: { connect: { id: ownerUser.id } },
        invoiceNumber: `LD-LEGACY-${Date.now()}`,
        orderStatus: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        orderType: 'SERVICES',
        channel: 'DIRECT_STORE',
        subtotal: 50000,
        serviceTotal: 0,
        discountTotal: 0,
        totalAmount: 50000,
        paidAmount: 50000,
        changeAmount: 0,
        items: {
          create: [
            {
              tenant: { connect: { id: tenantId } },
              productName: serviceName,
              quantity: 2,
              unitPrice: 25000,
              costPrice: 0,
              discountAmount: 0,
              subtotal: 50000,
              unit: null,
              pricingBasis: null, // Simulasi legacy row
            },
          ],
        },
        laundryDetail: {
          create: {
            tenant: { connect: { id: tenantId } },
            outlet: { connect: { id: outletId } },
            currentStage: 'READY',
            totalPieces: 2,
            totalWeightKg: 1.0,
          },
        },
      },
    });
    createdOrderIds.push(legacyOrder.id);

    // Panggil GET /api/laundry/dashboard-summary sebagai OWNER
    const dashOwnerRes = await fetch(`${API_BASE}/api/laundry/dashboard-summary?outletId=${outletId}`, {
      headers: ownerAuth,
    });
    assertEq(dashOwnerRes.status, 200, 'GET /api/laundry/dashboard-summary harus sukses HTTP 200');
    const dashOwnerData: any = await dashOwnerRes.json();
    assert(dashOwnerData.status === 'success', 'Status response harus success');

    // Uji langsung query SQL LEFT JOIN LATERAL vs normal LEFT JOIN untuk order legacy
    const lateralCheck: any = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(oi.id) AS "matchCount",
        SUM(oi.subtotal) AS "sumSubtotal"
      FROM "order_items" oi
      JOIN "orders" o ON o.id = oi.order_id
      LEFT JOIN LATERAL (
        SELECT unit
        FROM "laundry_services"
        WHERE tenant_id = o.tenant_id AND LOWER(name) = LOWER(oi.product_name)
        ORDER BY is_active DESC, updated_at DESC
        LIMIT 1
      ) ls ON true
      WHERE o.id = $1
    `, legacyOrder.id);

    const matchCount = Number(lateralCheck[0]?.matchCount || 0);
    const sumSubtotal = Number(lateralCheck[0]?.sumSubtotal || 0);

    assertEq(matchCount, 1, 'LEFT JOIN LATERAL harus menghasilkan tepat 1 baris match untuk 1 order_item');
    assertEq(sumSubtotal, 50000, 'Subtotal tidak boleh berlipat ganda (wajib tepat Rp 50.000, bukan Rp 100.000)');

    // Pastikan totalOmzetKiloan + totalOmzetSatuan sinkron dengan total omzet yang tercatat
    const highlights = dashOwnerData.data?.highlights;
    assert(!!highlights, 'Highlights finansial owner wajib ada');
    assert(highlights.totalOmzetSatuan >= 75000, 'totalOmzetSatuan harus mengakumulasi item satuan baru & legacy');
    assert(highlights.totalOmzetKiloan >= 30000, 'totalOmzetKiloan harus mengakumulasi item kiloan baru');

    console.log('   ✅ [PASS B] Anti-duplikasi LEFT JOIN LATERAL terbukti aman. Tepat 1 match row & subtotal Rp 50.000.\n');

    // =========================================================================
    // 3. SKENARIO C: FILTER PERIODE & GRANULARITAS (DAY vs MONTH)
    // =========================================================================
    console.log('▶️ [3] Menguji Filter Periode & Granularitas (7 Hari vs 1 Tahun Penuh)...');

    // 7 Hari: harus granularity DAY
    const nowUtc = new Date();
    const endStr = nowUtc.toISOString().split('T')[0];
    const start7DaysAgo = new Date(nowUtc.getTime() - 6 * 24 * 3600_000).toISOString().split('T')[0];

    const res7Days = await fetch(
      `${API_BASE}/api/laundry/dashboard-summary?outletId=${outletId}&startDate=${start7DaysAgo}&endDate=${endStr}`,
      { headers: ownerAuth }
    );
    assertEq(res7Days.status, 200, 'Filter 7 hari harus sukses HTTP 200');
    const data7Days: any = await res7Days.json();
    assertEq(data7Days.data.period.granularity, 'DAY', 'Rentang 7 hari harus menghasilkan granularity DAY');
    assert(Array.isArray(data7Days.data.revenueSeries), 'revenueSeries harus berupa array');
    assert(data7Days.data.revenueSeries.length >= 7, 'revenueSeries 7 hari minimal memuat 7 bucket hari');

    // 1 Tahun: 2026-01-01 s.d. 2026-12-31 -> harus granularity MONTH (12 bucket Jan-Des)
    const res1Year = await fetch(
      `${API_BASE}/api/laundry/dashboard-summary?outletId=${outletId}&startDate=2026-01-01&endDate=2026-12-31`,
      { headers: ownerAuth }
    );
    assertEq(res1Year.status, 200, 'Filter 1 tahun harus sukses HTTP 200');
    const data1Year: any = await res1Year.json();
    assertEq(data1Year.data.period.granularity, 'MONTH', 'Rentang 1 tahun harus menghasilkan granularity MONTH');
    assertEq(data1Year.data.revenueSeries.length, 12, 'revenueSeries 1 tahun harus memuat tepat 12 bucket bulan');

    const expectedMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    for (let m = 0; m < 12; m++) {
      const bucket = data1Year.data.revenueSeries[m];
      const mStr = String(m + 1).padStart(2, '0');
      assertEq(bucket.key, `2026-${mStr}`, `Bucket key ke-${m} harus 2026-${mStr}`);
      assertEq(bucket.label, expectedMonths[m], `Bucket label ke-${m} harus ${expectedMonths[m]}`);
    }

    // Pastikan seluruh field indikator finansial valid
    const h1Year = data1Year.data.highlights;
    assert(typeof h1Year.totalOmzet === 'number', 'totalOmzet harus bertipe number');
    assert(typeof h1Year.estimatedOperatingProfit === 'number', 'estimatedOperatingProfit harus bertipe number');
    assert(typeof h1Year.totalTransactions === 'number', 'totalTransactions harus bertipe number');
    assert(typeof h1Year.activeCustomers === 'object', 'activeCustomers harus bertipe object');
    assert(typeof h1Year.activeCustomers.total === 'number', 'activeCustomers.total harus bertipe number');

    console.log('   ✅ [PASS C] Granularity 7 hari (DAY, >=7 bucket) dan 1 tahun (MONTH, 12 bucket Jan-Des) valid 100%.\n');

    // =========================================================================
    // 4. SKENARIO D: ISOLASI KETAT ROLE CASHIER
    // =========================================================================
    console.log('▶️ [4] Menguji Isolasi Ketat Role CASHIER (Front-Desk)...');

    const resCashier = await fetch(`${API_BASE}/api/laundry/dashboard-summary?outletId=${outletId}`, {
      headers: cashierAuth,
    });
    assertEq(resCashier.status, 200, 'Dashboard kasir harus sukses HTTP 200');
    const dataCashier: any = await resCashier.json();

    assertEq(dataCashier.data.roleMode, 'CASHIER', 'roleMode harus bernilai CASHIER');

    // Assert ketiadaan data laba & omzet owner
    assert(dataCashier.data.highlights === undefined, 'Kasir DILARANG menerima objek highlights');
    assert(dataCashier.data.estimatedOperatingProfit === undefined, 'Kasir DILARANG menerima estimatedOperatingProfit');
    assert(dataCashier.data.estimatedBomCost === undefined, 'Kasir DILARANG menerima estimatedBomCost');
    assert(dataCashier.data.totalOmzet === undefined, 'Kasir DILARANG menerima totalOmzet');
    assert(dataCashier.data.revenueSeries === undefined, 'Kasir DILARANG menerima grafik garis revenueSeries');

    // Assert ketersediaan widget operasional kasir
    assert(Array.isArray(dataCashier.data.readyForPickupOrders), 'Kasir WAJIB menerima array readyForPickupOrders');
    assert(typeof dataCashier.data.todayDeliveriesCount === 'number', 'Kasir WAJIB menerima todayDeliveriesCount');
    assert(Array.isArray(dataCashier.data.staleRackOrders), 'Kasir WAJIB menerima array staleRackOrders');

    console.log('   ✅ [PASS D] Isolasi Kasir terkonfirmasi: 0 bocoran laba/omzet/grafik & widget front-desk lengkap.\n');

    // =========================================================================
    // 5. SKENARIO E: ISOLASI KETAT ROLE PRODUCTION (WAREHOUSE)
    // =========================================================================
    console.log('▶️ [5] Menguji Isolasi Ketat Role PRODUCTION (Workshop / Tanpa Uang)...');

    const resProd = await fetch(`${API_BASE}/api/laundry/dashboard-summary?outletId=${outletId}`, {
      headers: warehouseAuth,
    });
    assertEq(resProd.status, 200, 'Dashboard produksi harus sukses HTTP 200');
    const dataProd: any = await resProd.json();

    assertEq(dataProd.data.roleMode, 'PRODUCTION', 'roleMode harus bernilai PRODUCTION');

    // Assert ketersediaan widget produksi
    assert(!!dataProd.data.pipelineCounts, 'Produksi WAJIB menerima pipelineCounts');
    assert(typeof dataProd.data.pipelineCounts.sorting?.orderCount === 'number', 'Sorting count harus ada');
    assert(!!dataProd.data.myOutputToday, 'Produksi WAJIB menerima myOutputToday');
    assert(typeof dataProd.data.myOutputToday.orderCount === 'number', 'myOutputToday.orderCount harus ada');
    assert(typeof dataProd.data.myOutputToday.totalKg === 'number', 'myOutputToday.totalKg harus ada');

    // Assert DILARANG ada field nominal uang di seluruh payload JSON
    const jsonStrProd = JSON.stringify(dataProd.data).toLowerCase();
    const forbiddenMoneyKeys = [
      '"grandtotal"',
      '"totalamount"',
      '"paidamount"',
      '"totalomzet"',
      '"estimatedoperatingprofit"',
      '"bomcost"',
      '"highlights"',
    ];

    for (const key of forbiddenMoneyKeys) {
      assert(!jsonStrProd.includes(key), `Payload produksi DILARANG memuat key nominal uang: ${key}`);
    }

    console.log('   ✅ [PASS E] Isolasi Produksi terkonfirmasi: 0 field nominal rupiah & widget beban kerja lengkap.\n');

    console.log('========================================================================');
    console.log('🎉 SELURUH SKENARIO TEST E2E SMART LAUNDRY DASHBOARD LULUS 100%!');
    console.log('========================================================================\n');
  } finally {
    // Clean-up Data Dummy Uji Coba Secara Bersih
    console.log('🧹 Membersihkan data dummy uji coba dari database...');
    try {
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
      if (createdServiceIds.length > 0) {
        await prisma.laundryServiceBomItem.deleteMany({ where: { laundryServiceId: { in: createdServiceIds } } });
        await prisma.laundryService.deleteMany({ where: { id: { in: createdServiceIds } } });
      }
      if (createdCustomerIds.length > 0) {
        await prisma.customer.deleteMany({ where: { id: { in: createdCustomerIds } } });
      }
      if (createdUserIds.length > 0) {
        await prisma.cashMovement.deleteMany({ where: { userId: { in: createdUserIds } } });
        await prisma.shift.deleteMany({ where: { userId: { in: createdUserIds } } });
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
      console.log('✨ Clean-up & restore selesai. Database lokal tetap bersih.');
    } catch (cleanErr) {
      console.error('Peringatan clean-up:', cleanErr);
    } finally {
      await prisma.$disconnect();
    }
  }
}

runSmartDashboardE2ETest().catch((err) => {
  console.error('\n❌ E2E SMART LAUNDRY DASHBOARD TEST GAGAL:', err.message);
  process.exit(1);
});
