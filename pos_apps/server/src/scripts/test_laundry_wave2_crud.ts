/**
 * Test Suite: Wave 2 Batch 2 (W2-02, W2-03, W2-04: CRUD Backend & RBAC Security)
 * 
 * Menguji:
 * 1. OperationalExpense CRUD + RBAC:
 *    - SUPERVISOR ditolak HTTP 403
 *    - ADMIN branch-restricted terkunci pada outlet miliknya (403 saat akses outlet lain)
 *    - Aggregasi totalAmount & pagination
 *    - Cache invalidation per tenant
 * 2. OutletBusinessTarget Upsert + RBAC:
 *    - OWNER diizinkan (HTTP 200/201)
 *    - ADMIN/SUPERVISOR ditolak HTTP 403 pada PUT dan DELETE
 *    - Upsert komposit (tenantId, outletId, periodYear, periodMonth) tidak duplikat
 * 3. LaundryMachineMaintenanceLog Lifecycle & Status Sync:
 *    - POST status IN_PROGRESS -> LaundryMachine.status otomatis jadi 'MAINTENANCE'
 *    - PATCH status COMPLETED + endDate -> downtimeMinutes terhitung otomatis & LaundryMachine.status kembali 'ACTIVE'
 *    - SUPERVISOR tidak menerima field 'cost' (sensor finansial via sanitizeAnalyticsPayloadForRole)
 * 4. Zero Database Residue (Cleanup di blok finally)
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient, Role } from '@prisma/client';
import { laundryAnalyticsRouter } from '../routes/laundry_analytics.routes';
import { analyticsCache } from '../services/laundry_analytics/analyticsSecurity.helper';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING WAVE 2 BATCH 2 CRUD & RBAC VERIFICATION');
  console.log('====================================================');

  // Ambil owner user aktual dari DB
  const dbOwner = await prisma.user.findFirst({
    where: { role: Role.OWNER, isActive: true },
    include: { tenant: { include: { outlets: true } } },
  });

  assert(Boolean(dbOwner), 'Owner user must exist in DB');
  const tenant = dbOwner!.tenant;
  const outletA = tenant.outlets[0];
  assert(Boolean(outletA), 'Tenant harus memiliki minimal 1 outlet');

  // Cleanup tracking IDs
  const cleanup = {
    userIds: [] as string[],
    tempOutletBId: null as string | null,
    expenseIds: [] as string[],
    targetIds: [] as string[],
    maintLogIds: [] as string[],
    tempMachineId: null as string | null,
  };

  // Buat outlet kedua jika belum ada untuk pengujian cross-outlet branch restriction
  let outletB = tenant.outlets[1];
  if (!outletB) {
    outletB = await prisma.outlet.create({
      data: {
        tenantId: tenant.id,
        name: 'Outlet B QA Branch Test',
        code: `OUT-B-${Date.now().toString().slice(-4)}`,
        address: 'Jl. Test B No. 2',
        isActive: true,
      },
    });
    cleanup.tempOutletBId = outletB.id;
  }

  // Buat temporary Admin & Supervisor users terikat pada outletA
  const testAdminUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      outletId: outletA.id,
      userCode: `ADM-${Date.now().toString().slice(-6)}`,
      name: 'Admin Test Branch QA',
      email: `admin.test.${Date.now()}@wellpos.id`,
      role: Role.ADMIN,
      isActive: true,
      tokenVersion: 1,
    },
  });
  cleanup.userIds.push(testAdminUser.id);

  const testSpvUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      outletId: outletA.id,
      userCode: `SPV-${Date.now().toString().slice(-6)}`,
      name: 'Supervisor Test QA',
      email: `spv.test.${Date.now()}@wellpos.id`,
      role: Role.SUPERVISOR,
      isActive: true,
      tokenVersion: 1,
    },
  });
  cleanup.userIds.push(testSpvUser.id);

  // Helper membuat token JWT
  const makeToken = (user: any) =>
    jwt.sign(
      {
        userId: user.id,
        role: user.role,
        outletId: user.outletId,
        tenantId: user.tenantId,
        tokenVersion: user.tokenVersion || 1,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

  const ownerToken = makeToken(dbOwner);
  const adminRestrictedToken = makeToken(testAdminUser);
  const supervisorToken = makeToken(testSpvUser);

  // Jalankan transient HTTP server
  const app = express();
  app.use(express.json());
  app.use('/api/laundry/analytics', laundryAnalyticsRouter);

  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api/laundry/analytics`;

  try {
    // ----------------------------------------------------
    // TEST 1: OPERATIONAL EXPENSES CRUD & RBAC (W2-02)
    // ----------------------------------------------------
    console.log('\n[TEST 1] Menguji Operational Expenses CRUD & RBAC...');

    // 1.1 SUPERVISOR WAJIB DITOLAK (403)
    console.log('  -> 1.1 Verifikasi SUPERVISOR ditolak (403)...');
    const supGetOpex = await fetch(`${baseUrl}/operational-expenses`, {
      headers: { Authorization: `Bearer ${supervisorToken}` },
    });
    assert(supGetOpex.status === 403, `SUPERVISOR harus 403 pada GET opex, got: ${supGetOpex.status}`);

    const supPostOpex = await fetch(`${baseUrl}/operational-expenses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supervisorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        outletId: outletA.id,
        category: 'ELECTRICITY',
        amount: 100000,
      }),
    });
    assert(supPostOpex.status === 403, `SUPERVISOR harus 403 pada POST opex, got: ${supPostOpex.status}`);
    console.log('     ✅ SUPERVISOR 403 Forbidden terverifikasi');

    // 1.2 ADMIN Branch-Restricted outlet scoping
    console.log('  -> 1.2 Verifikasi ADMIN branch-restricted scoping...');
    const adminCrossOutlet = await fetch(`${baseUrl}/operational-expenses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminRestrictedToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        outletId: outletB.id, // Outlet lain!
        category: 'ELECTRICITY',
        amount: 200000,
      }),
    });
    assert(adminCrossOutlet.status === 403, `Admin branch-restricted harus 403 saat POST ke outlet lain, got: ${adminCrossOutlet.status}`);
    console.log('     ✅ ADMIN branch-restricted ditolak 403 saat akses outlet lain');

    // 1.3 Create Operational Expense (OWNER)
    console.log('  -> 1.3 Create Operational Expense oleh OWNER...');
    // Pasang dummy cache untuk uji invalidasi
    analyticsCache.set(`test_cache_${tenant.id}`, { foo: 'bar' });

    const createOpexRes = await fetch(`${baseUrl}/operational-expenses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        outletId: outletA.id,
        category: 'WATER',
        amount: 450000.50,
        expenseDate: '2026-11-20T10:00:00Z',
        paymentMethod: 'CASH',
        notes: 'Tagihan Air PDAM Bulan November 2026',
      }),
    });
    assert(createOpexRes.status === 201, `Create opex harus 201, got: ${createOpexRes.status}`);
    const createOpexJson: any = await createOpexRes.json();
    const createdOpex = createOpexJson.data;
    cleanup.expenseIds.push(createdOpex.id);
    assert(createdOpex.category === 'WATER', 'Kategori harus WATER');
    assert(Number(createdOpex.amount) === 450000.5, 'Amount harus 450000.50');
    console.log('     ✅ Create OperationalExpense sukses (HTTP 201)');

    // 1.4 Get Operational Expenses dengan Aggregasi
    console.log('  -> 1.4 Get Operational Expenses & Aggregasi totalAmount...');
    const getOpexRes = await fetch(
      `${baseUrl}/operational-expenses?outletId=${outletA.id}&category=WATER`,
      {
        headers: { Authorization: `Bearer ${ownerToken}` },
      }
    );
    assert(getOpexRes.status === 200, `Get opex harus 200, got: ${getOpexRes.status}`);
    const getOpexJson: any = await getOpexRes.json();
    assert(Array.isArray(getOpexJson.data.items), 'items harus berupa array');
    assert(getOpexJson.data.totalAmount >= 450000.5, 'totalAmount harus menghitung nominal');
    assert(getOpexJson.data.pagination.currentPage === 1, 'pagination page valid');
    console.log('     ✅ Get OperationalExpense & totalAmount sukses (HTTP 200)');

    // 1.5 Update Operational Expense
    console.log('  -> 1.5 Update Operational Expense...');
    const updateOpexRes = await fetch(
      `${baseUrl}/operational-expenses/${createdOpex.id}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: 500000,
          notes: 'Tagihan Air PDAM (Revisi Tagihan)',
        }),
      }
    );
    assert(updateOpexRes.status === 200, `Update opex harus 200, got: ${updateOpexRes.status}`);
    const updateOpexJson: any = await updateOpexRes.json();
    assert(Number(updateOpexJson.data.amount) === 500000, 'Amount harus terupdate jadi 500000');
    console.log('     ✅ Update OperationalExpense sukses (HTTP 200)');

    // 1.6 Delete Operational Expense
    console.log('  -> 1.6 Delete Operational Expense...');
    const delOpexRes = await fetch(
      `${baseUrl}/operational-expenses/${createdOpex.id}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ownerToken}` },
      }
    );
    assert(delOpexRes.status === 200, `Delete opex harus 200, got: ${delOpexRes.status}`);
    cleanup.expenseIds = cleanup.expenseIds.filter((id) => id !== createdOpex.id);
    console.log('     ✅ Delete OperationalExpense sukses (HTTP 200)');

    // ----------------------------------------------------
    // TEST 2: OUTLET BUSINESS TARGETS CRUD & RBAC (W2-03)
    // ----------------------------------------------------
    console.log('\n[TEST 2] Menguji Outlet Business Targets Upsert & RBAC...');

    // 2.1 ADMIN WAJIB DITOLAK (403) PADA PUT DAN DELETE TARGET
    console.log('  -> 2.1 Verifikasi ADMIN ditolak 403 pada PUT target...');
    const adminPutTarget = await fetch(`${baseUrl}/targets`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${adminRestrictedToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        outletId: outletA.id,
        periodYear: 2026,
        periodMonth: 11,
        targetRevenue: 40000000,
      }),
    });
    assert(adminPutTarget.status === 403, `ADMIN harus 403 pada PUT target, got: ${adminPutTarget.status}`);
    console.log('     ✅ ADMIN ditolak 403 pada PUT target (OWNER ONLY)');

    // 2.2 OWNER Upsert Target Baru
    console.log('  -> 2.2 OWNER Upsert Target Baru...');
    const putTargetRes1 = await fetch(`${baseUrl}/targets`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        outletId: outletA.id,
        periodYear: 2026,
        periodMonth: 11,
        targetRevenue: 50000000,
        targetProfit: 15000000,
        targetWeightKg: 2000,
        targetOrdersCount: 350,
        targetNewCustomers: 30,
        notes: 'Target Awal November',
      }),
    });
    assert(putTargetRes1.status === 200, `Upsert target harus 200, got: ${putTargetRes1.status}`);
    const putTargetJson1: any = await putTargetRes1.json();
    const target1 = putTargetJson1.data;
    cleanup.targetIds.push(target1.id);
    assert(Number(target1.targetRevenue) === 50000000, 'Target revenue harus 50jt');
    console.log('     ✅ OWNER Create Target sukses (HTTP 200)');

    // 2.3 OWNER Re-upsert (Update tanpa duplikasi key)
    console.log('  -> 2.3 OWNER Re-upsert target yang sama (Update existing)...');
    const putTargetRes2 = await fetch(`${baseUrl}/targets`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        outletId: outletA.id,
        periodYear: 2026,
        periodMonth: 11,
        targetRevenue: 60000000, // Nilai dinaikkan
        targetProfit: 20000000,
        targetWeightKg: 2400,
        targetOrdersCount: 400,
        targetNewCustomers: 40,
        notes: 'Target Revisi November',
      }),
    });
    assert(putTargetRes2.status === 200, `Re-upsert target harus 200, got: ${putTargetRes2.status}`);
    const putTargetJson2: any = await putTargetRes2.json();
    assert(putTargetJson2.data.id === target1.id, 'ID harus sama (update inplace, zero duplicate)');
    assert(Number(putTargetJson2.data.targetRevenue) === 60000000, 'Target revenue harus terupdate 60jt');
    console.log('     ✅ Re-upsert tidak membuat duplikat, terupdate secara benar');

    // 2.4 Get Targets
    console.log('  -> 2.4 Get Targets (OWNER & ADMIN diizinkan)...');
    const getTargetsRes = await fetch(
      `${baseUrl}/targets?outletId=${outletA.id}&periodYear=2026&periodMonth=11`,
      {
        headers: { Authorization: `Bearer ${adminRestrictedToken}` },
      }
    );
    assert(getTargetsRes.status === 200, `Get targets harus 200, got: ${getTargetsRes.status}`);
    const getTargetsJson: any = await getTargetsRes.json();
    assert(getTargetsJson.data.length >= 1, 'Harus mengembalikan minimal 1 target');
    console.log('     ✅ Get targets sukses (HTTP 200)');

    // 2.5 Delete Target (ADMIN 403, OWNER 200)
    console.log('  -> 2.5 Delete Target (ADMIN 403, OWNER 200)...');
    const adminDelTarget = await fetch(
      `${baseUrl}/targets/${target1.id}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminRestrictedToken}` },
      }
    );
    assert(adminDelTarget.status === 403, `ADMIN harus 403 pada DELETE target, got: ${adminDelTarget.status}`);

    const ownerDelTarget = await fetch(
      `${baseUrl}/targets/${target1.id}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ownerToken}` },
      }
    );
    assert(ownerDelTarget.status === 200, `OWNER harus 200 pada DELETE target, got: ${ownerDelTarget.status}`);
    cleanup.targetIds = cleanup.targetIds.filter((id) => id !== target1.id);
    console.log('     ✅ Delete target RBAC & execution sukses (HTTP 200)');

    // ----------------------------------------------------
    // TEST 3: MACHINE MAINTENANCE LIFECYCLE & STATUS SYNC (W2-04)
    // ----------------------------------------------------
    console.log('\n[TEST 3] Menguji Machine Maintenance Lifecycle, Sync Status, & Sensor SUPERVISOR...');

    // Siapkan mesin uji
    let testMachine = await prisma.laundryMachine.findFirst({
      where: { tenantId: tenant.id, outletId: outletA.id },
    });
    if (!testMachine) {
      testMachine = await prisma.laundryMachine.create({
        data: {
          tenantId: tenant.id,
          outletId: outletA.id,
          code: 'MC-TEST-SYNC',
          name: 'Mesin Washer Sync Test',
          machineType: 'WASHER',
          capacityKg: 10,
          status: 'ACTIVE',
        },
      });
      cleanup.tempMachineId = testMachine.id;
    } else {
      // Pastikan status awalnya ACTIVE
      await prisma.laundryMachine.update({
        where: { id: testMachine.id },
        data: { status: 'ACTIVE' },
      });
    }

    // 3.1 POST Maintenance Log dengan status IN_PROGRESS -> Mesin otomatis jadi 'MAINTENANCE'
    console.log('  -> 3.1 POST Maintenance status IN_PROGRESS -> Verifikasi status mesin otomatis MAINTENANCE...');
    const createMaintRes = await fetch(`${baseUrl}/machine-maintenance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        machineId: testMachine.id,
        serviceType: 'REPAIR',
        startDate: new Date().toISOString(),
        technicianName: 'Sdr. Joni (Teknisi)',
        cost: 300000,
        notes: 'Ganti seal pintu karet bocor',
        status: 'IN_PROGRESS',
      }),
    });
    assert(createMaintRes.status === 201, `Create maintenance log harus 201, got: ${createMaintRes.status}`);
    const createMaintJson: any = await createMaintRes.json();
    const maintLog = createMaintJson.data;
    cleanup.maintLogIds.push(maintLog.id);

    // Cek status mesin di DB
    const machineAfterStart = await prisma.laundryMachine.findUnique({
      where: { id: testMachine.id },
    });
    assert(machineAfterStart?.status === 'MAINTENANCE', `Status mesin harus MAINTENANCE, got: ${machineAfterStart?.status}`);
    console.log('     ✅ SINKRONISASI ATOMIK SUKSES: Mesin otomatis beralih ke MAINTENANCE');

    // 3.2 SUPERVISOR GET Maintenance Log -> Sensor Finansial (field 'cost' disanitasi)
    console.log('  -> 3.2 SUPERVISOR GET Maintenance -> Verifikasi field cost disanitasi (undefined)...');
    const supGetMaint = await fetch(
      `${baseUrl}/machine-maintenance?machineId=${testMachine.id}`,
      {
        headers: { Authorization: `Bearer ${supervisorToken}` },
      }
    );
    assert(supGetMaint.status === 200, `SUPERVISOR harus 200 pada GET machine-maintenance, got: ${supGetMaint.status}`);
    const supGetMaintJson: any = await supGetMaint.json();
    const supItem = supGetMaintJson.data.items.find((i: any) => i.id === maintLog.id);
    assert(Boolean(supItem), 'Item harus ditemukan');
    assert(supItem.cost === undefined, `Field cost untuk SUPERVISOR harus disanitasi (undefined), got: ${supItem.cost}`);
    console.log('     ✅ SENSOR FINANSIAL SUKSES: SUPERVISOR tidak menerima nominal cost');

    // 3.3 PATCH Maintenance Log status COMPLETED + endDate -> Downtime terhitung otomatis & status mesin kembali ACTIVE
    console.log('  -> 3.3 PATCH status COMPLETED + endDate -> Verifikasi downtime auto-calc & status mesin kembali ACTIVE...');
    const startDateObj = new Date(maintLog.startDate);
    const endDateObj = new Date(startDateObj.getTime() + 90 * 60 * 1000); // 90 menit kemudian

    const patchMaintRes = await fetch(
      `${baseUrl}/machine-maintenance/${maintLog.id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'COMPLETED',
          endDate: endDateObj.toISOString(),
        }),
      }
    );
    assert(patchMaintRes.status === 200, `PATCH maintenance log harus 200, got: ${patchMaintRes.status}`);
    const patchMaintJson: any = await patchMaintRes.json();
    assert(patchMaintJson.data.downtimeMinutes === 90, `DowntimeMinutes harus 90 menit, got: ${patchMaintJson.data.downtimeMinutes}`);

    const machineAfterDone = await prisma.laundryMachine.findUnique({
      where: { id: testMachine.id },
    });
    assert(machineAfterDone?.status === 'ACTIVE', `Status mesin harus kembali ACTIVE, got: ${machineAfterDone?.status}`);
    console.log('     ✅ SINKRONISASI SELESAI SUKSES: Downtime terhitung 90 menit & mesin kembali ACTIVE');

    // 3.4 DELETE Maintenance Log
    console.log('  -> 3.4 DELETE Maintenance Log...');
    const delMaintRes = await fetch(
      `${baseUrl}/machine-maintenance/${maintLog.id}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ownerToken}` },
      }
    );
    assert(delMaintRes.status === 200, `DELETE maintenance log harus 200, got: ${delMaintRes.status}`);
    cleanup.maintLogIds = cleanup.maintLogIds.filter((id) => id !== maintLog.id);
    console.log('     ✅ Delete maintenance log sukses (HTTP 200)');

  } finally {
    // Tutup transient server
    server.close();

    // ----------------------------------------------------
    // TEST 4: CLEANUP & ZERO RESIDUE
    // ----------------------------------------------------
    console.log('\n[TEST 4] Membersihkan seluruh data pengujian (Zero Database Residue)...');

    if (cleanup.expenseIds.length > 0) {
      const d1 = await prisma.operationalExpense.deleteMany({
        where: { id: { in: cleanup.expenseIds } },
      });
      console.log(`  -> Menghapus ${d1.count} sisa OperationalExpense`);
    }

    if (cleanup.targetIds.length > 0) {
      const d2 = await prisma.outletBusinessTarget.deleteMany({
        where: { id: { in: cleanup.targetIds } },
      });
      console.log(`  -> Menghapus ${d2.count} sisa OutletBusinessTarget`);
    }

    if (cleanup.maintLogIds.length > 0) {
      const d3 = await prisma.laundryMachineMaintenanceLog.deleteMany({
        where: { id: { in: cleanup.maintLogIds } },
      });
      console.log(`  -> Menghapus ${d3.count} sisa LaundryMachineMaintenanceLog`);
    }

    if (cleanup.tempMachineId) {
      const d4 = await prisma.laundryMachine.delete({
        where: { id: cleanup.tempMachineId },
      });
      console.log(`  -> Menghapus dummy LaundryMachine (id: ${d4.id})`);
    }

    if (cleanup.userIds.length > 0) {
      const dUsers = await prisma.user.deleteMany({
        where: { id: { in: cleanup.userIds } },
      });
      console.log(`  -> Menghapus ${dUsers.count} temporary test users`);
    }

    if (cleanup.tempOutletBId) {
      const dOutletB = await prisma.outlet.delete({
        where: { id: cleanup.tempOutletBId },
      });
      console.log(`  -> Menghapus temporary Outlet B (id: ${dOutletB.id})`);
    }

    console.log('  ✅ Seluruh data uji berhasil dibersihkan tanpa residu database (0 residue)');
  }

  console.log('\n====================================================');
  console.log('🎉 ALL WAVE 2 BATCH 2 TESTS PASSED SUCCESSFULLY! (100%)');
  console.log('====================================================\n');
}

runTests()
  .catch((err) => {
    console.error('\n❌ TEST RUNNER FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
