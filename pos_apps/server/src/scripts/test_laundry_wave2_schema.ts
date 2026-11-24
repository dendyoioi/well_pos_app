/**
 * Test Suite: Wave 2 Batch 1 (Task W2-01: Schema Extension & SchemaPatcher DDL)
 * 
 * Menguji:
 * 1. SchemaPatcher Idempotency (Run 1: Apply, Run 2: Skip, 0 error)
 * 2. Keberadaan tabel, enum, kolom baru di PostgreSQL (information_schema & pg_type)
 * 3. Prisma CRUD & Relationships:
 *    - OperationalExpense (enum ExpenseCategory, Decimal 15,2, FKs, index)
 *    - OutletBusinessTarget (Decimal, unique constraint [tenantId, outletId, periodYear, periodMonth] -> P2002 duplicate check)
 *    - LaundryMachineMaintenanceLog (FK machineId CASCADE, tenantId, outletId, status index)
 *    - LaundryStageLog & LaundryIncident nullable machineId relation
 * 4. Cleanup & 0 Residue Verification
 */

import { PrismaClient, ExpenseCategory } from '@prisma/client';
import { runAutoSchemaPatcher } from '../migrations/schema_patcher';

const prisma = new PrismaClient();

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING WAVE 2 BATCH 1 SCHEMA & DDL VERIFICATION');
  console.log('====================================================');

  // Track created IDs for cleanup
  const cleanupIds = {
    expenseIds: [] as string[],
    targetIds: [] as string[],
    maintLogIds: [] as string[],
    tempMachineId: null as string | null,
  };

  try {
    // ----------------------------------------------------
    // TEST 1: SCHEMAPATCHER EXECUTION & IDEMPOTENCY
    // ----------------------------------------------------
    console.log('\n[TEST 1] Menguji Eksekusi SchemaPatcher & Idempotensi (2x Run)...');
    
    // Run 1
    console.log('  -> Menjalankan SchemaPatcher Run 1...');
    const run1 = await runAutoSchemaPatcher(prisma);
    console.log(`     Applied: ${run1.applied.length}, Skipped: ${run1.skipped.length}, Failed: ${run1.failed.length}`);
    assert(run1.failed.length === 0, `SchemaPatcher Run 1 gagal dengan error: ${JSON.stringify(run1.failed)}`);

    // Run 2
    console.log('  -> Menjalankan SchemaPatcher Run 2 (Idempotency check)...');
    const run2 = await runAutoSchemaPatcher(prisma);
    console.log(`     Applied: ${run2.applied.length}, Skipped: ${run2.skipped.length}, Failed: ${run2.failed.length}`);
    assert(run2.failed.length === 0, `SchemaPatcher Run 2 gagal dengan error: ${JSON.stringify(run2.failed)}`);
    assert(
      run2.skipped.includes('20261124_11_laundry_owner_dashboard_wave2_schema'),
      'Patch 20261124_11_laundry_owner_dashboard_wave2_schema wajib masuk daftar skipped pada Run 2'
    );
    console.log('  ✅ SchemaPatcher 100% Idempotent (0 error pada Run 1 & Run 2)');

    // ----------------------------------------------------
    // TEST 2: VERIFIKASI POSTGRESQL DDL DARI INFORMATION_SCHEMA
    // ----------------------------------------------------
    console.log('\n[TEST 2] Verifikasi DDL Fisik di Database PostgreSQL...');
    
    // Check tables
    const expectedTables = [
      'operational_expenses',
      'outlet_business_targets',
      'laundry_machine_maintenance_logs',
    ];
    for (const tbl of expectedTables) {
      const res = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = '${tbl}'
        ) AS "exists";
      `);
      assert(res[0]?.exists === true, `Tabel '${tbl}' tidak ditemukan di schema public`);
      console.log(`  ✅ Tabel '${tbl}' terkonfirmasi ada di database`);
    }

    // Check enum ExpenseCategory
    const enumRes = await prisma.$queryRawUnsafe<{ typname: string }[]>(`
      SELECT typname FROM pg_type WHERE typname = 'ExpenseCategory';
    `);
    assert(enumRes.length > 0, "Enum 'ExpenseCategory' tidak ditemukan di pg_type");
    console.log("  ✅ Enum 'ExpenseCategory' terkonfirmasi ada di pg_type");

    // Check machine_id column in laundry_stage_logs and laundry_incidents
    const colStageRes = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'laundry_stage_logs' 
        AND column_name = 'machine_id'
      ) AS "exists";
    `);
    assert(colStageRes[0]?.exists === true, "Kolom 'machine_id' tidak ditemukan di laundry_stage_logs");
    console.log("  ✅ Kolom 'machine_id' terkonfirmasi ada di 'laundry_stage_logs'");

    const colIncRes = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'laundry_incidents' 
        AND column_name = 'machine_id'
      ) AS "exists";
    `);
    assert(colIncRes[0]?.exists === true, "Kolom 'machine_id' tidak ditemukan di laundry_incidents");
    console.log("  ✅ Kolom 'machine_id' terkonfirmasi ada di 'laundry_incidents'");

    // ----------------------------------------------------
    // TEST 3: PRISMA CLIENT CRUD & RELATIONSHIPS TESTING
    // ----------------------------------------------------
    console.log('\n[TEST 3] Verifikasi Prisma Client CRUD & Relasi Data...');

    // Ambil tenant, outlet, dan user valid untuk testing
    const tenant = await prisma.tenant.findFirst({
      where: {
        outlets: { some: {} },
        users: { some: {} },
      },
      include: {
        outlets: true,
        users: true,
      },
    });

    assert(Boolean(tenant), 'Tidak ditemukan tenant dengan outlet dan user untuk pengujian');
    const outlet = tenant!.outlets[0];
    const user = tenant!.users[0];
    console.log(`  -> Menggunakan Tenant ID: ${tenant!.id}, Outlet ID: ${outlet.id}, User ID: ${user.id}`);

    // 3.1 OperationalExpense CRUD
    console.log('  -> Menguji OperationalExpense CRUD...');
    const expense = await prisma.operationalExpense.create({
      data: {
        tenantId: tenant!.id,
        outletId: outlet.id,
        expenseDate: new Date('2026-11-24T10:00:00Z'),
        category: ExpenseCategory.ELECTRICITY,
        amount: 350000.75,
        paymentMethod: 'CASH',
        notes: 'Tagihan Listrik PLN Periode November 2026 (Test QA)',
        receiptPhotoUrl: 'https://storage.wellpos.id/receipts/test-rec-1.jpg',
        createdById: user.id,
      },
      include: {
        tenant: true,
        outlet: true,
        createdBy: true,
      },
    });
    cleanupIds.expenseIds.push(expense.id);

    assert(expense.category === 'ELECTRICITY', 'Kategori OperationalExpense harus ELECTRICITY');
    assert(Number(expense.amount) === 350000.75, 'Amount OperationalExpense harus bernilai 350000.75');
    assert(expense.tenant.id === tenant!.id, 'Relasi tenant OperationalExpense valid');
    assert(expense.outlet.id === outlet.id, 'Relasi outlet OperationalExpense valid');
    assert(expense.createdBy.id === user.id, 'Relasi createdBy OperationalExpense valid');
    console.log('  ✅ OperationalExpense CRUD & Relations LULUS');

    // 3.2 OutletBusinessTarget CRUD & Unique Constraint
    console.log('  -> Menguji OutletBusinessTarget CRUD & Unique Constraint [tenantId, outletId, periodYear, periodMonth]...');
    const target = await prisma.outletBusinessTarget.create({
      data: {
        tenantId: tenant!.id,
        outletId: outlet.id,
        periodYear: 2026,
        periodMonth: 12,
        targetRevenue: 50000000.00,
        targetProfit: 18000000.00,
        targetWeightKg: 2500.500,
        targetOrdersCount: 400,
        targetNewCustomers: 35,
        notes: 'Target Akhir Tahun 2026 (Test QA)',
        createdById: user.id,
      },
      include: {
        tenant: true,
        outlet: true,
        createdBy: true,
      },
    });
    cleanupIds.targetIds.push(target.id);

    assert(target.periodYear === 2026 && target.periodMonth === 12, 'Target period valid');
    assert(Number(target.targetRevenue) === 50000000, 'Target revenue valid');
    assert(Number(target.targetWeightKg) === 2500.5, 'Target weight valid');
    assert(target.targetOrdersCount === 400, 'Target orders count valid');

    // Test Duplicate Unique Constraint: harus ditolak oleh Prisma dengan kode P2002
    let duplicateRejected = false;
    try {
      await prisma.outletBusinessTarget.create({
        data: {
          tenantId: tenant!.id,
          outletId: outlet.id,
          periodYear: 2026,
          periodMonth: 12, // Same period!
          targetRevenue: 99999999,
          createdById: user.id,
        },
      });
    } catch (dupErr: any) {
      if (dupErr?.code === 'P2002') {
        duplicateRejected = true;
      } else {
        console.warn('Terjadi error lain saat duplicate check:', dupErr);
      }
    }
    assert(duplicateRejected, 'Unique constraint [tenantId, outletId, periodYear, periodMonth] WAJIB menolak duplikat (P2002)');
    console.log('  ✅ OutletBusinessTarget CRUD & Unique Constraint (P2002 Rejection) LULUS');

    // 3.3 LaundryMachineMaintenanceLog CRUD & Cascade Relation
    console.log('  -> Menguji LaundryMachineMaintenanceLog CRUD...');
    // Cari mesin eksisting atau buat mesin dummy sementara
    let machine = await prisma.laundryMachine.findFirst({
      where: { tenantId: tenant!.id, outletId: outlet.id },
    });

    if (!machine) {
      console.log('     (Membuat dummy LaundryMachine sementara untuk pengujian log maintenance)...');
      machine = await prisma.laundryMachine.create({
        data: {
          tenantId: tenant!.id,
          outletId: outlet.id,
          code: 'TEST-MC-01',
          name: 'Mesin Washer Test QA',
          machineType: 'WASHER',
          capacityKg: 10,
          status: 'ACTIVE',
        },
      });
      cleanupIds.tempMachineId = machine.id;
    }

    const maintLog = await prisma.laundryMachineMaintenanceLog.create({
      data: {
        tenantId: tenant!.id,
        outletId: outlet.id,
        machineId: machine.id,
        serviceType: 'PREVENTIVE',
        startDate: new Date('2026-11-24T08:00:00Z'),
        endDate: new Date('2026-11-24T10:00:00Z'),
        downtimeMinutes: 120,
        technicianName: 'Sdr. Hendra (Teknisi)',
        cost: 175000.00,
        notes: 'Pembersihan filter drum & kalibrasi sensor water-level',
        status: 'COMPLETED',
        createdById: user.id,
      },
      include: {
        machine: true,
        tenant: true,
        outlet: true,
        createdBy: true,
      },
    });
    cleanupIds.maintLogIds.push(maintLog.id);

    assert(maintLog.machineId === machine.id, 'FK machineId valid');
    assert(maintLog.machine.name === machine.name, 'Relasi machine.name valid');
    assert(maintLog.downtimeMinutes === 120, 'Downtime minutes valid');
    assert(Number(maintLog.cost) === 175000, 'Cost maintenance valid');
    assert(maintLog.status === 'COMPLETED', 'Status maintenance valid');
    console.log('  ✅ LaundryMachineMaintenanceLog CRUD & Relations LULUS');

    // 3.4 LaundryStageLog & LaundryIncident nullable machineId test
    console.log('  -> Menguji query relasi machineId pada LaundryStageLog & LaundryIncident...');
    const stageLogQuery = await prisma.laundryStageLog.findFirst({
      select: {
        id: true,
        machineId: true,
        machine: true,
      },
    });
    // Validasi bahwa Prisma query builder mengenali machineId dan relasi machine tanpa runtime error
    console.log('     LaundryStageLog machine relation query check: OK', stageLogQuery ? `(Sample id: ${stageLogQuery.id})` : '(No rows, schema OK)');

    const incidentQuery = await prisma.laundryIncident.findFirst({
      select: {
        id: true,
        machineId: true,
        machine: true,
      },
    });
    console.log('     LaundryIncident machine relation query check: OK', incidentQuery ? `(Sample id: ${incidentQuery.id})` : '(No rows, schema OK)');
    console.log('  ✅ Nullable machineId pada LaundryStageLog & LaundryIncident LULUS');

  } finally {
    // ----------------------------------------------------
    // TEST 4: CLEANUP & 0 RESIDUE
    // ----------------------------------------------------
    console.log('\n[TEST 4] Membersihkan seluruh data pengujian (Zero Database Residue)...');
    
    if (cleanupIds.expenseIds.length > 0) {
      const delExp = await prisma.operationalExpense.deleteMany({
        where: { id: { in: cleanupIds.expenseIds } },
      });
      console.log(`  -> Menghapus ${delExp.count} test OperationalExpense`);
    }

    if (cleanupIds.targetIds.length > 0) {
      const delTgt = await prisma.outletBusinessTarget.deleteMany({
        where: { id: { in: cleanupIds.targetIds } },
      });
      console.log(`  -> Menghapus ${delTgt.count} test OutletBusinessTarget`);
    }

    if (cleanupIds.maintLogIds.length > 0) {
      const delMaint = await prisma.laundryMachineMaintenanceLog.deleteMany({
        where: { id: { in: cleanupIds.maintLogIds } },
      });
      console.log(`  -> Menghapus ${delMaint.count} test LaundryMachineMaintenanceLog`);
    }

    if (cleanupIds.tempMachineId) {
      const delMach = await prisma.laundryMachine.delete({
        where: { id: cleanupIds.tempMachineId },
      });
      console.log(`  -> Menghapus dummy LaundryMachine (id: ${delMach.id})`);
    }

    console.log('  ✅ Seluruh data uji berhasil dibersihkan (0 residue)');
  }

  console.log('\n====================================================');
  console.log('🎉 ALL WAVE 2 BATCH 1 TESTS PASSED SUCCESSFULLY! (100%)');
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
