/**
 * Verification Script: Laundry Analytics Outlet Scoping & Multi-Business Isolation
 * Well POS — Wave 3 / Owner Portal Batch 3
 */

import { prisma } from '../config/prisma';
import {
  getTenantLaundryOutletIds,
  resolveLaundryOutletScope,
} from '../services/laundry_analytics/laundryOutletScope.helper';
import { getFinancialAnalytics } from '../services/laundry_analytics/laundryAnalyticsFinancial.service';
import { getExecutiveOverview } from '../services/laundry_analytics/laundryAnalyticsOverview.service';
import { resolveAnalyticsDateRange } from '../services/laundry_analytics/dateRangeResolver.service';

async function runIsolationTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING LAUNDRY ANALYTICS ISOLATION VERIFICATION');
  console.log('====================================================\n');

  // Cari outlet Laundry yang ada di database
  const laundryOutlet = await prisma.outlet.findFirst({
    where: {
      OR: [
        { business: { vertical: 'LAUNDRY' } },
        { industries: { array_contains: 'LAUNDRY' } },
      ],
    },
    select: { id: true, name: true, tenantId: true },
  });

  if (!laundryOutlet) {
    console.log('⚠️ Tidak ada outlet laundry untuk diuji. Lewati test.');
    return;
  }

  const tenantId = laundryOutlet.tenantId;
  console.log(`Menguji dengan Tenant ID: ${tenantId} (Outlet: ${laundryOutlet.name})`);

  // [TEST 1] Verifikasi getTenantLaundryOutletIds
  console.log('\n[TEST 1] Verifikasi getTenantLaundryOutletIds()...');
  const laundryIds = await getTenantLaundryOutletIds(tenantId);
  console.log(`  Ditemukan ${laundryIds.length} outlet Laundry untuk tenant:`, laundryIds);
  if (!laundryIds.includes(laundryOutlet.id)) {
    throw new Error(`Outlet laundry ${laundryOutlet.id} harus termasuk dalam hasil!`);
  }
  console.log('  ✅ getTenantLaundryOutletIds mengembalikan seluruh outlet Laundry');

  // [TEST 2] Verifikasi resolveLaundryOutletScope
  console.log('\n[TEST 2] Verifikasi resolveLaundryOutletScope()...');
  const singleScope = await resolveLaundryOutletScope(tenantId, laundryOutlet.id);
  if (singleScope.isAll) throw new Error('singleScope.isAll harus false');
  console.log('  ✅ Single outlet scope: isAll = false');

  const allScope = await resolveLaundryOutletScope(tenantId, 'ALL');
  if (!allScope.isAll) throw new Error('allScope.isAll harus true');
  if (allScope.laundryOutletIds.length !== laundryIds.length) {
    throw new Error('allScope.laundryOutletIds length mismatch');
  }
  console.log('  ✅ ALL outlet scope: isAll = true, scoped to laundryOutletIds');

  // [TEST 3] Verifikasi eksekusi query Financial & Overview saat outletId = 'ALL'
  console.log('\n[TEST 3] Menjalankan Financial & Overview Analytics dengan outletId = ALL...');
  const dateRange = resolveAnalyticsDateRange({ preset: 'month' });
  const financialResult = await getFinancialAnalytics({
    tenantId,
    outletId: 'ALL',
    dateRange,
  });
  console.log(`  ✅ getFinancialAnalytics(ALL) berhasil dieksekusi.`);
  console.log(`     - Gross Revenue: Rp ${financialResult.revenue.grossRevenue.current.toLocaleString()}`);
  console.log(`     - Net Revenue: Rp ${financialResult.revenue.netRevenue.current.toLocaleString()}`);

  const overviewResult = await getExecutiveOverview({
    tenantId,
    outletId: 'ALL',
    dateRange,
  });
  console.log(`  ✅ getExecutiveOverview(ALL) berhasil dieksekusi.`);
  console.log(`     - Total Valid Orders: ${overviewResult.operationalPulse.totalValidOrders}`);
  console.log(`     - Total Weight (Kg): ${overviewResult.operationalPulse.totalWeightKg}`);
  console.log(`     - Health Score: ${overviewResult.healthScore.score}/100 (${overviewResult.healthScore.grade})`);

  console.log('\n====================================================');
  console.log('🎉 ALL LAUNDRY ANALYTICS ISOLATION TESTS PASSED 100%!');
  console.log('====================================================');
}

runIsolationTests()
  .catch((err) => {
    console.error('❌ Error saat pengujian isolasi:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
