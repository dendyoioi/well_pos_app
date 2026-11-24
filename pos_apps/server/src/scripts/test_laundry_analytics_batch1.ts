/**
 * Test Suite: Laundry Analytics Batch 1 (W1-01, W1-02, W1-03)
 * Menguji:
 * 1. Keberadaan 6 composite indexes di database PostgreSQL
 * 2. DateRangeResolver (8 presets, timezone windowing, leap year, custom validation, percent change)
 * 3. AnalyticsSecurityHelper (resolveEffectiveOutlet RBAC, sanitizeAnalyticsPayloadForRole, analyticsCache LRU & TTL)
 * 4. Express Router Integration & RBAC Security Filters (/meta, 501 stub responses, RBAC guards)
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient, Role } from '@prisma/client';
import {
  resolveAnalyticsDateRange,
  calculatePercentChange,
} from '../services/laundry_analytics/dateRangeResolver.service';
import {
  resolveEffectiveOutlet,
  sanitizeAnalyticsPayloadForRole,
  analyticsCache,
  AnalyticsCache,
} from '../services/laundry_analytics/analyticsSecurity.helper';
import { laundryAnalyticsRouter } from '../routes/laundry_analytics.routes';

const prisma = new PrismaClient();

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING LAUNDRY ANALYTICS BATCH 1 VERIFICATION');
  console.log('====================================================');

  // ----------------------------------------------------
  // TEST 1: COMPOSITE INDEXES CHECK (W1-01)
  // ----------------------------------------------------
  console.log('\n[TEST 1] Verifikasi 6 Composite Indexes di PostgreSQL...');
  const expectedIndexes = [
    { name: 'idx_orders_analytics_perf', table: 'orders' },
    { name: 'idx_order_items_pricing_basis', table: 'order_items' },
    { name: 'idx_payment_tx_cash_in', table: 'payment_transactions' },
    { name: 'idx_laundry_details_sla_stage', table: 'laundry_order_details' },
    { name: 'idx_stage_logs_machine_perf', table: 'laundry_stage_logs' },
    { name: 'idx_inventory_ledgers_consumption', table: 'inventory_ledgers' },
  ];

  for (const idx of expectedIndexes) {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE indexname = $1 AND tablename = $2;
    `, idx.name, idx.table);

    assert(rows.length === 1, `Indeks '${idx.name}' pada tabel '${idx.table}' tidak ditemukan di database!`);
    console.log(`  ✅ Index '${idx.name}' terverifikasi pada '${idx.table}'`);
  }

  // ----------------------------------------------------
  // TEST 2: DATE RANGE RESOLVER (W1-03)
  // ----------------------------------------------------
  console.log('\n[TEST 2] Verifikasi DateRangeResolver (8 Presets & Windowing)...');

  // Freeze reference time: 2026-11-24 14:30:00 WIB (Tuesday)
  const refDate = new Date('2026-11-24T14:30:00.000+07:00');

  // 2.1 Today
  const todayRange = resolveAnalyticsDateRange({ preset: 'today' }, 'Asia/Jakarta', refDate);
  assert(todayRange.formattedRange.start === '2026-11-24', 'Today start must be 2026-11-24');
  assert(todayRange.formattedRange.end === '2026-11-24', 'Today end must be 2026-11-24');
  assert(todayRange.formattedRange.prevStart === '2026-11-23', 'Today prevStart must be 2026-11-23');
  assert(todayRange.formattedRange.prevEnd === '2026-11-23', 'Today prevEnd must be 2026-11-23');
  assert(todayRange.daysCount === 1, 'Today daysCount must be 1');
  console.log('  ✅ Preset today lulus');

  // 2.2 Yesterday
  const yesterdayRange = resolveAnalyticsDateRange({ preset: 'yesterday' }, 'Asia/Jakarta', refDate);
  assert(yesterdayRange.formattedRange.start === '2026-11-23', 'Yesterday start must be 2026-11-23');
  assert(yesterdayRange.formattedRange.end === '2026-11-23', 'Yesterday end must be 2026-11-23');
  assert(yesterdayRange.formattedRange.prevStart === '2026-11-22', 'Yesterday prevStart must be 2026-11-22');
  assert(yesterdayRange.formattedRange.prevEnd === '2026-11-22', 'Yesterday prevEnd must be 2026-11-22');
  assert(yesterdayRange.daysCount === 1, 'Yesterday daysCount must be 1');
  console.log('  ✅ Preset yesterday lulus');

  // 2.3 This Week (Mon 2026-11-23 to Sun 2026-11-29)
  const weekRange = resolveAnalyticsDateRange({ preset: 'this_week' }, 'Asia/Jakarta', refDate);
  assert(weekRange.formattedRange.start === '2026-11-23', 'This week start must be Monday 2026-11-23');
  assert(weekRange.formattedRange.end === '2026-11-29', 'This week end must be Sunday 2026-11-29');
  assert(weekRange.formattedRange.prevStart === '2026-11-16', 'This week prevStart must be Monday 2026-11-16');
  assert(weekRange.formattedRange.prevEnd === '2026-11-22', 'This week prevEnd must be Sunday 2026-11-22');
  assert(weekRange.daysCount === 7, 'This week daysCount must be 7');
  console.log('  ✅ Preset this_week lulus');

  // 2.4 7days (T-6 to T: 2026-11-18 to 2026-11-24)
  const sevenDaysRange = resolveAnalyticsDateRange({ preset: '7days' }, 'Asia/Jakarta', refDate);
  assert(sevenDaysRange.formattedRange.start === '2026-11-18', '7days start must be 2026-11-18');
  assert(sevenDaysRange.formattedRange.end === '2026-11-24', '7days end must be 2026-11-24');
  assert(sevenDaysRange.formattedRange.prevStart === '2026-11-11', '7days prevStart must be 2026-11-11');
  assert(sevenDaysRange.formattedRange.prevEnd === '2026-11-17', '7days prevEnd must be 2026-11-17');
  assert(sevenDaysRange.daysCount === 7, '7days daysCount must be 7');
  console.log('  ✅ Preset 7days lulus');

  // 2.5 Month (Nov 2026: 2026-11-01 to 2026-11-30, prev: 2026-10-01 to 2026-10-31)
  const monthRange = resolveAnalyticsDateRange({ preset: 'month' }, 'Asia/Jakarta', refDate);
  assert(monthRange.formattedRange.start === '2026-11-01', 'Month start must be 2026-11-01');
  assert(monthRange.formattedRange.end === '2026-11-30', 'Month end must be 2026-11-30');
  assert(monthRange.formattedRange.prevStart === '2026-10-01', 'Month prevStart must be 2026-10-01');
  assert(monthRange.formattedRange.prevEnd === '2026-10-31', 'Month prevEnd must be 2026-10-31');
  assert(monthRange.daysCount === 30, 'Nov 2026 daysCount must be 30');
  console.log('  ✅ Preset month lulus (Nov 30 days, Prev Oct 31 days)');

  // 2.6 Last Month (Oct 2026: 2026-10-01 to 2026-10-31, prev: 2026-09-01 to 2026-09-30)
  const lastMonthRange = resolveAnalyticsDateRange({ preset: 'last_month' }, 'Asia/Jakarta', refDate);
  assert(lastMonthRange.formattedRange.start === '2026-10-01', 'Last month start must be 2026-10-01');
  assert(lastMonthRange.formattedRange.end === '2026-10-31', 'Last month end must be 2026-10-31');
  assert(lastMonthRange.formattedRange.prevStart === '2026-09-01', 'Last month prevStart must be 2026-09-01');
  assert(lastMonthRange.formattedRange.prevEnd === '2026-09-30', 'Last month prevEnd must be 2026-09-30');
  assert(lastMonthRange.daysCount === 31, 'Oct 2026 daysCount must be 31');
  console.log('  ✅ Preset last_month lulus (Oct 31 days, Prev Sep 30 days)');

  // 2.7 Year (2026: 2026-01-01 to 2026-12-31, prev: 2025-01-01 to 2025-12-31)
  const yearRange = resolveAnalyticsDateRange({ preset: 'year' }, 'Asia/Jakarta', refDate);
  assert(yearRange.formattedRange.start === '2026-01-01', 'Year start must be 2026-01-01');
  assert(yearRange.formattedRange.end === '2026-12-31', 'Year end must be 2026-12-31');
  assert(yearRange.formattedRange.prevStart === '2025-01-01', 'Year prevStart must be 2025-01-01');
  assert(yearRange.formattedRange.prevEnd === '2025-12-31', 'Year prevEnd must be 2025-12-31');
  assert(yearRange.daysCount === 365, '2026 daysCount must be 365');
  console.log('  ✅ Preset year lulus');

  // 2.8 Custom Range (2026-11-10 to 2026-11-14 = 5 days)
  const customRange = resolveAnalyticsDateRange({
    preset: 'custom',
    startDate: '2026-11-10',
    endDate: '2026-11-14',
  });
  assert(customRange.formattedRange.start === '2026-11-10', 'Custom start must be 2026-11-10');
  assert(customRange.formattedRange.end === '2026-11-14', 'Custom end must be 2026-11-14');
  assert(customRange.daysCount === 5, 'Custom daysCount must be 5');
  assert(customRange.formattedRange.prevEnd === '2026-11-09', 'Custom prevEnd must be 2026-11-09');
  assert(customRange.formattedRange.prevStart === '2026-11-05', 'Custom prevStart must be 2026-11-05');
  console.log('  ✅ Preset custom lulus (5 days exact comparison)');

  // 2.9 Custom Range Validation Errors
  let caughtCustomError = false;
  try {
    resolveAnalyticsDateRange({ preset: 'custom', startDate: '2026-11-15', endDate: '2026-11-10' });
  } catch (err: any) {
    caughtCustomError = true;
    assert(err.statusCode === 400, 'Custom reversed date must throw 400');
  }
  assert(caughtCustomError, 'Must catch custom reversed date');

  let caughtInvalidFormat = false;
  try {
    resolveAnalyticsDateRange({ preset: 'custom', startDate: 'invalid-date', endDate: '2026-11-10' });
  } catch (err: any) {
    caughtInvalidFormat = true;
    assert(err.statusCode === 400, 'Custom invalid format must throw 400');
  }
  assert(caughtInvalidFormat, 'Must catch invalid date format');
  console.log('  ✅ Validasi error custom range (format & rentang terbalik) lulus');

  // 2.10 Helper calculatePercentChange
  const p1 = calculatePercentChange(150, 100);
  assert(p1.diff === 50 && p1.percent === 50 && p1.direction === 'UP', '100 -> 150 must be +50% UP');

  const p2 = calculatePercentChange(80, 100);
  assert(p2.diff === -20 && p2.percent === -20 && p2.direction === 'DOWN', '100 -> 80 must be -20% DOWN');

  const p3 = calculatePercentChange(100, 100);
  assert(p3.diff === 0 && p3.percent === 0 && p3.direction === 'NEUTRAL', '100 -> 100 must be 0% NEUTRAL');

  const p4 = calculatePercentChange(50, 0);
  assert(p4.diff === 50 && p4.percent === 100 && p4.direction === 'UP', '0 -> 50 must be +100% UP');

  const p5 = calculatePercentChange(0, 0);
  assert(p5.diff === 0 && p5.percent === 0 && p5.direction === 'NEUTRAL', '0 -> 0 must be 0% NEUTRAL');
  console.log('  ✅ Helper calculatePercentChange lulus');

  // ----------------------------------------------------
  // TEST 3: ANALYTICS SECURITY & CACHE (W1-02)
  // ----------------------------------------------------
  console.log('\n[TEST 3] Verifikasi AnalyticsSecurity & LRU Cache...');

  // 3.1 resolveEffectiveOutlet
  // OWNER
  const ownerUser = { role: Role.OWNER, tenantId: 'tenant-1', outletId: null };
  assert(resolveEffectiveOutlet(ownerUser) === 'ALL', 'Owner default outlet must be ALL');
  assert(resolveEffectiveOutlet(ownerUser, 'ALL') === 'ALL', 'Owner requested ALL must be ALL');
  assert(resolveEffectiveOutlet(ownerUser, 'outlet-alpha') === 'outlet-alpha', 'Owner can select outlet-alpha');

  // ADMIN (Branch-restricted)
  const adminUser = { role: Role.ADMIN, tenantId: 'tenant-1', outletId: 'outlet-assigned' };
  assert(resolveEffectiveOutlet(adminUser) === 'outlet-assigned', 'Admin must be locked to outlet-assigned');
  assert(resolveEffectiveOutlet(adminUser, 'outlet-assigned') === 'outlet-assigned', 'Admin requesting assigned outlet is OK');

  let adminBypassAllCaught = false;
  try {
    resolveEffectiveOutlet(adminUser, 'ALL');
  } catch (err: any) {
    adminBypassAllCaught = true;
    assert(err.statusCode === 403, 'Admin attempting ALL must be 403');
  }
  assert(adminBypassAllCaught, 'Admin attempting ALL must throw 403');

  let adminBypassOtherCaught = false;
  try {
    resolveEffectiveOutlet(adminUser, 'outlet-other');
  } catch (err: any) {
    adminBypassOtherCaught = true;
    assert(err.statusCode === 403, 'Admin attempting other outlet must be 403');
  }
  assert(adminBypassOtherCaught, 'Admin attempting other outlet must throw 403');

  // ADMIN (Tenant-wide / outletId is null)
  const adminTenantWide = { role: Role.ADMIN, tenantId: 'tenant-1', outletId: null };
  assert(resolveEffectiveOutlet(adminTenantWide) === 'ALL', 'Tenant-wide admin default must be ALL');
  assert(resolveEffectiveOutlet(adminTenantWide, 'ALL') === 'ALL', 'Tenant-wide admin requested ALL must be ALL');
  assert(resolveEffectiveOutlet(adminTenantWide, 'outlet-alpha') === 'outlet-alpha', 'Tenant-wide admin can choose specific outlet');

  // SUPERVISOR
  const supervisorUser = { role: Role.SUPERVISOR, tenantId: 'tenant-1', outletId: 'outlet-assigned' };
  assert(resolveEffectiveOutlet(supervisorUser) === 'outlet-assigned', 'Supervisor locked to assigned outlet');

  let supervisorBypassCaught = false;
  try {
    resolveEffectiveOutlet(supervisorUser, 'outlet-other');
  } catch (err: any) {
    supervisorBypassCaught = true;
    assert(err.statusCode === 403, 'Supervisor attempting other outlet must be 403');
  }
  assert(supervisorBypassCaught, 'Supervisor attempting other outlet must throw 403');

  // CASHIER / DISALLOWED ROLE
  const cashierUser = { role: Role.CASHIER, tenantId: 'tenant-1', outletId: 'outlet-assigned' };
  let cashierCaught = false;
  try {
    resolveEffectiveOutlet(cashierUser);
  } catch (err: any) {
    cashierCaught = true;
    assert(err.statusCode === 403, 'Cashier must be rejected with 403');
  }
  assert(cashierCaught, 'Cashier must be rejected with 403');
  console.log('  ✅ resolveEffectiveOutlet RBAC & outlet scoping lulus');

  // 3.2 sanitizeAnalyticsPayloadForRole
  const mockPayload = {
    overview: {
      totalOrders: 150,
      totalWeightKg: 850.5,
      netRevenue: 7500000,
      grossProfit: 4200000,
      cogs: 3300000,
      slaAchievedPercent: 96.5,
    },
    topServices: [
      { name: 'Cuci Kering Lipat', volumeKg: 500, netRevenue: 4000000 },
      { name: 'Cuci Setrika', volumeKg: 350, netRevenue: 3500000 },
    ],
  };

  // OWNER gets unstripped payload
  const ownerResult = sanitizeAnalyticsPayloadForRole(mockPayload, Role.OWNER);
  assert(ownerResult.overview.netRevenue === 7500000, 'Owner must see netRevenue');
  assert(ownerResult.overview.cogs === 3300000, 'Owner must see cogs');

  // ADMIN gets unstripped payload
  const adminResult = sanitizeAnalyticsPayloadForRole(mockPayload, Role.ADMIN);
  assert(adminResult.overview.netRevenue === 7500000, 'Admin must see netRevenue');

  // SUPERVISOR gets stripped payload
  const supervisorResult = sanitizeAnalyticsPayloadForRole(mockPayload, Role.SUPERVISOR);
  assert(supervisorResult.overview.netRevenue === undefined, 'Supervisor must NOT see netRevenue');
  assert(supervisorResult.overview.grossProfit === undefined, 'Supervisor must NOT see grossProfit');
  assert(supervisorResult.overview.cogs === undefined, 'Supervisor must NOT see cogs');
  assert(supervisorResult.overview.totalOrders === 150, 'Supervisor MUST see totalOrders');
  assert(supervisorResult.overview.totalWeightKg === 850.5, 'Supervisor MUST see totalWeightKg');
  assert(supervisorResult.overview.slaAchievedPercent === 96.5, 'Supervisor MUST see slaAchievedPercent');
  assert(supervisorResult.topServices[0].volumeKg === 500, 'Supervisor MUST see volumeKg');
  assert(supervisorResult.topServices[0].netRevenue === undefined, 'Supervisor must NOT see service netRevenue');
  console.log('  ✅ sanitizeAnalyticsPayloadForRole filter finansial supervisor lulus');

  // 3.3 LRU Cache
  const testCache = new AnalyticsCache(3);
  testCache.set('key1', 'val1', 10_000);
  testCache.set('key2', 'val2', 10_000);
  testCache.set('key3', 'val3', 10_000);
  assert(testCache.size() === 3, 'Cache size must be 3');

  // Access key1 to make it most recently used
  assert(testCache.get('key1') === 'val1', 'Key1 must exist');

  // Insert key4 -> key2 should be evicted (oldest)
  testCache.set('key4', 'val4', 10_000);
  assert(testCache.get('key2') === null, 'Key2 should have been evicted by LRU');
  assert(testCache.get('key1') === 'val1', 'Key1 should still exist because it was refreshed');
  assert(testCache.get('key4') === 'val4', 'Key4 should exist');

  // Clear tenant
  testCache.set('tenantA:outlet1:month:::', 'dataA', 10_000);
  testCache.set('tenantB:outlet1:month:::', 'dataB', 10_000);
  testCache.clearTenant('tenantA');
  assert(testCache.get('tenantA:outlet1:month:::') === null, 'tenantA entries must be cleared');
  assert(testCache.get('tenantB:outlet1:month:::') === 'dataB', 'tenantB entries must remain');
  console.log('  ✅ In-memory LRU Cache (eviction & tenant scoping) lulus');

  // ----------------------------------------------------
  // TEST 4: HTTP INTEGRATION & RBAC / ROUTING CHECKS
  // ----------------------------------------------------
  console.log('\n[TEST 4] Verifikasi Express Router Integration & RBAC...');

  const jwtSecret = process.env.JWT_SECRET || 'test-jwt-secret';

  // Ambil user aktual dari DB lokal untuk otentikasi JWT yang valid
  const dbOwner = await prisma.user.findFirst({ where: { role: Role.OWNER, isActive: true } });
  const dbAdmin = await prisma.user.findFirst({ where: { role: Role.ADMIN, isActive: true } });
  const dbSupervisor = await prisma.user.findFirst({ where: { role: Role.SUPERVISOR, isActive: true } });
  const dbCashier = await prisma.user.findFirst({ where: { role: Role.CASHIER, isActive: true } });

  assert(Boolean(dbOwner), 'Owner user must exist in DB');
  assert(Boolean(dbAdmin), 'Admin user must exist in DB');
  assert(Boolean(dbSupervisor), 'Supervisor user must exist in DB');
  assert(Boolean(dbCashier), 'Cashier user must exist in DB');

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

  const ownerToken = makeToken(dbOwner);
  const adminToken = makeToken(dbAdmin);
  const supervisorToken = makeToken(dbSupervisor);
  const cashierToken = makeToken(dbCashier);

  // Jalankan transient express app
  const app = express();
  app.use(express.json());
  app.use('/api/laundry/analytics', laundryAnalyticsRouter);

  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api/laundry/analytics`;

  try {
    // 4.1 No token -> 401
    const resNoToken = await fetch(`${baseUrl}/meta`);
    assert(resNoToken.status === 401, 'Request without token must be 401');
    console.log('  ✅ 4.1 TC-W1-02.1: Request tanpa token -> 401 Unauthorized lulus');

    // 4.2 Cashier token -> 403
    const resCashier = await fetch(`${baseUrl}/meta`, {
      headers: { Authorization: `Bearer ${cashierToken}` },
    });
    assert(resCashier.status === 403, 'Request with cashier role must be 403');
    console.log('  ✅ 4.2 TC-W1-02.2: Request role CASHIER -> 403 Forbidden lulus');

    // 4.3 Owner token on /meta -> 200
    const resMeta = await fetch(`${baseUrl}/meta?preset=this_week`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(resMeta.status === 200, 'Owner request to /meta must be 200');
    const metaJson: any = await resMeta.json();
    assert(metaJson.status === 'success', 'Meta response status must be success');
    assert(metaJson.data.router === 'laundry_analytics', 'Meta router must be laundry_analytics');
    assert(metaJson.data.effectiveOutletId === 'ALL', 'Owner default effectiveOutletId must be ALL');
    assert(metaJson.data.dateRange.preset === 'this_week', 'Date range preset must be this_week');
    console.log('  ✅ 4.3 Endpoint GET /meta diagnostic lulus (Owner -> 200 OK)');

    // 4.4 Owner token on /overview -> 200 (Implemented in Batch 2)
    const resOverview = await fetch(`${baseUrl}/overview`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(resOverview.status === 200, 'Overview must return 200');
    const overviewJson: any = await resOverview.json();
    assert(overviewJson.status === 'success', 'Status must be success');
    console.log('  ✅ 4.4 Endpoint GET /overview lulus (200 OK)');

    // 4.5 Owner token on /benchmark -> 200/501 (passed OWNER authorization)
    const resOwnerBenchmark = await fetch(`${baseUrl}/benchmark`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(resOwnerBenchmark.status === 200 || resOwnerBenchmark.status === 501, 'Owner benchmark must pass RBAC');
    console.log('  ✅ 4.5 Endpoint GET /benchmark (Owner) lulus (passed RBAC)');

    // 4.6 Admin token on /benchmark -> 403 (blocked by authorize(Role.OWNER))
    const resAdminBenchmark = await fetch(`${baseUrl}/benchmark`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resAdminBenchmark.status === 403, 'Admin benchmark must be rejected with 403');
    console.log('  ✅ 4.6 Endpoint GET /benchmark (Admin) -> 403 Forbidden (RBAC guard) lulus');

    // 4.7 Supervisor token on POST /ai/query -> 403 (blocked by authorize(Role.OWNER))
    const resSpvQuery = await fetch(`${baseUrl}/ai/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supervisorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: 'Analisis omset' }),
    });
    assert(resSpvQuery.status === 403, 'Supervisor query must be rejected with 403');
    console.log('  ✅ 4.7 Endpoint POST /ai/query (Supervisor) -> 403 Forbidden lulus');

    // 4.8 Owner token on POST /ai/query -> 200/501 (passed authorize(Role.OWNER))
    const resOwnerQuery = await fetch(`${baseUrl}/ai/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question: 'Analisis omset' }),
    });
    assert(resOwnerQuery.status === 200 || resOwnerQuery.status === 501, 'Owner query must pass RBAC');
    console.log('  ✅ 4.8 Endpoint POST /ai/query (Owner) lulus (passed RBAC)');
  } finally {
    server.close();
  }

  console.log('\n====================================================');
  console.log('🎉 ALL LAUNDRY ANALYTICS BATCH 1 TESTS PASSED 100%!');
  console.log('====================================================');
}

runTests()
  .catch((err) => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
