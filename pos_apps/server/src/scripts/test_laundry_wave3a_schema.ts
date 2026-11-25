/**
 * Test Suite: Wave 3A Batch 1 (Task W3-01: Schema Prisma & SchemaPatcher DDL untuk Persistent Alerting)
 * 
 * Menguji:
 * 1. SchemaPatcher Idempotency (Run 1: Apply patch, Run 2: Skip patch, 0 error)
 * 2. Keberadaan tabel fisik & kolom di PostgreSQL (information_schema & pg_indexes)
 * 3. Partial Unique Index:
 *    - 1 AlertRuleConfig global (outletId: null) + 1 AlertRuleConfig outlet-spesifik
 *    - Percobaan membuat AlertRuleConfig global ke-2 dengan ruleKey sama wajib ditolak PostgreSQL
 * 4. PersistentAlert Lifecycle & Relasi:
 *    - Membuat PersistentAlert status OPEN
 *    - Resolving alert dengan resolvedById & resolutionNotes
 *    - Verifikasi relasi balik pada Tenant, Outlet, dan User
 * 5. Zero Database Residue (Pembersihan di blok finally)
 */

import { PrismaClient, Prisma, Role } from '@prisma/client';
import { runAutoSchemaPatcher } from '../migrations/schema_patcher';

const prisma = new PrismaClient();

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING WAVE 3A BATCH 1 SCHEMA & DDL VERIFICATION');
  console.log('====================================================');

  const cleanupIds = {
    ruleConfigIds: [] as string[],
    alertIds: [] as string[],
  };

  try {
    // -------------------------------------------------------------------------
    // TEST 1: SCHEMAPATCHER EXECUTION & IDEMPOTENCY (2x Run)
    // -------------------------------------------------------------------------
    console.log('\n[TEST 1] Menguji Eksekusi SchemaPatcher & Idempotensi (2x Run)...');

    console.log('  -> Menjalankan SchemaPatcher Run 1...');
    const run1 = await runAutoSchemaPatcher(prisma);
    console.log(`     Applied: ${run1.applied.length}, Skipped: ${run1.skipped.length}, Failed: ${run1.failed.length}`);
    assert(run1.failed.length === 0, `SchemaPatcher Run 1 gagal: ${JSON.stringify(run1.failed)}`);

    console.log('  -> Menjalankan SchemaPatcher Run 2 (Idempotency check)...');
    const run2 = await runAutoSchemaPatcher(prisma);
    console.log(`     Applied: ${run2.applied.length}, Skipped: ${run2.skipped.length}, Failed: ${run2.failed.length}`);
    assert(run2.failed.length === 0, `SchemaPatcher Run 2 gagal: ${JSON.stringify(run2.failed)}`);
    assert(
      run2.skipped.includes('20261124_12_laundry_owner_dashboard_wave3a_alerting'),
      'Patch 20261124_12_laundry_owner_dashboard_wave3a_alerting wajib masuk daftar skipped pada Run 2'
    );
    console.log('  ✅ SchemaPatcher 100% Idempotent (0 error pada Run 1 & Run 2)');

    // -------------------------------------------------------------------------
    // TEST 2: VERIFIKASI POSTGRESQL DDL DARI INFORMATION_SCHEMA & PG_INDEXES
    // -------------------------------------------------------------------------
    console.log('\n[TEST 2] Verifikasi Fisik Tabel & Indeks di PostgreSQL...');

    const expectedTables = ['alert_rule_configs', 'persistent_alerts'];
    for (const tbl of expectedTables) {
      const res = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = '${tbl}'
        ) AS "exists";
      `);
      assert(res[0]?.exists === true, `Tabel '${tbl}' harus ada di database PostgreSQL`);
      console.log(`  ✅ Tabel '${tbl}' terverifikasi ada`);
    }

    // Verifikasi kolom alert_rule_configs
    const ruleCols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'alert_rule_configs';
    `);
    const ruleColNames = ruleCols.map((c) => c.column_name);
    ['tenant_id', 'outlet_id', 'rule_key', 'warning_threshold', 'critical_threshold', 'is_enabled', 'notification_channels'].forEach((col) => {
      assert(ruleColNames.includes(col), `Kolom '${col}' wajib ada pada alert_rule_configs`);
    });
    console.log('  ✅ Seluruh kolom alert_rule_configs terverifikasi lengkap');

    // Verifikasi kolom persistent_alerts
    const alertCols = await prisma.$queryRawUnsafe<{ column_name: string }[]>(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'persistent_alerts';
    `);
    const alertColNames = alertCols.map((c) => c.column_name);
    ['tenant_id', 'outlet_id', 'rule_key', 'severity', 'title', 'message', 'metric_value', 'threshold_value', 'status', 'wa_notified_at', 'resolved_at', 'resolved_by_id', 'resolution_notes'].forEach((col) => {
      assert(alertColNames.includes(col), `Kolom '${col}' wajib ada pada persistent_alerts`);
    });
    console.log('  ✅ Seluruh kolom persistent_alerts terverifikasi lengkap');

    // Verifikasi partial unique index alert_rule_configs_tenant_global_rule_key
    const partialIdx = await prisma.$queryRawUnsafe<{ indexname: string; indexdef: string }[]>(`
      SELECT indexname, indexdef FROM pg_indexes 
      WHERE tablename = 'alert_rule_configs' 
      AND indexname = 'alert_rule_configs_tenant_global_rule_key';
    `);
    assert(partialIdx.length > 0, 'Partial unique index alert_rule_configs_tenant_global_rule_key wajib ada');
    assert(
      partialIdx[0].indexdef.toLowerCase().includes('where (outlet_id is null)'),
      'Partial unique index wajib memiliki klausa WHERE outlet_id IS NULL'
    );
    console.log('  ✅ Partial unique index (WHERE outlet_id IS NULL) terverifikasi ada di PostgreSQL');

    // -------------------------------------------------------------------------
    // TEST 3: PRISMA CRUD & PARTIAL UNIQUE CONSTRAINT CHECK
    // -------------------------------------------------------------------------
    console.log('\n[TEST 3] Menguji Prisma CRUD & Partial Unique Constraint...');

    const dbOwner = await prisma.user.findFirst({
      where: { role: Role.OWNER, isActive: true },
      include: { tenant: { include: { outlets: true } } },
    });
    assert(Boolean(dbOwner), 'Owner user harus ada di database');
    const tenant = dbOwner!.tenant;
    const outlet = tenant.outlets[0];
    assert(Boolean(outlet), 'Tenant harus memiliki minimal 1 outlet');

    // 3.1 Buat AlertRuleConfig global (outletId: null)
    console.log('  -> 3.1 Membuat AlertRuleConfig Global (outletId: null)...');
    const globalRule = await prisma.alertRuleConfig.create({
      data: {
        tenantId: tenant.id,
        outletId: null,
        ruleKey: 'PROFIT_MARGIN',
        warningThreshold: new Prisma.Decimal('20.00'),
        criticalThreshold: new Prisma.Decimal('15.00'),
        isEnabled: true,
        notificationChannels: ['IN_APP'],
      },
    });
    cleanupIds.ruleConfigIds.push(globalRule.id);
    assert(globalRule.outletId === null, 'Global rule outletId harus null');
    console.log('     ✅ Global AlertRuleConfig berhasil dibuat (ID:', globalRule.id, ')');

    // 3.2 Buat AlertRuleConfig spesifik outlet dengan ruleKey yang sama
    console.log('  -> 3.2 Membuat AlertRuleConfig Outlet-Spesifik dengan ruleKey sama...');
    const outletRule = await prisma.alertRuleConfig.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        ruleKey: 'PROFIT_MARGIN',
        warningThreshold: new Prisma.Decimal('25.00'),
        criticalThreshold: new Prisma.Decimal('18.00'),
        isEnabled: true,
        notificationChannels: ['IN_APP', 'WHATSAPP'],
      },
    });
    cleanupIds.ruleConfigIds.push(outletRule.id);
    assert(outletRule.outletId === outlet.id, 'Outlet rule outletId harus sesuai outlet');
    console.log('     ✅ Outlet-Spesifik AlertRuleConfig berhasil dibuat (ID:', outletRule.id, ')');

    // 3.3 Verifikasi pencegahan duplikasi aturan global (Partial Unique Index)
    console.log('  -> 3.3 Verifikasi Partial Unique Index menolak duplikasi aturan global...');
    let duplicateRejected = false;
    try {
      await prisma.alertRuleConfig.create({
        data: {
          tenantId: tenant.id,
          outletId: null,
          ruleKey: 'PROFIT_MARGIN', // Duplikat global ruleKey
          warningThreshold: new Prisma.Decimal('22.00'),
          criticalThreshold: new Prisma.Decimal('16.00'),
        },
      });
    } catch (err: any) {
      duplicateRejected = true;
      const isUniqueError =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        (err.code === 'P2002' || err.message.includes('unique'));
      assert(isUniqueError || err.message.includes('unique constraint'), 'Error harus berupa unique constraint violation');
      console.log('     ✅ Percobaan duplikasi global ruleKey berhasil ditolak PostgreSQL (Unique Constraint Violation)');
    }
    assert(duplicateRejected, 'PostgreSQL wajib menolak pembuatan 2 rule global dengan ruleKey sama!');

    // -------------------------------------------------------------------------
    // TEST 4: PERSISTENT ALERT LIFECYCLE & USER RESOLUTION RELATION
    // -------------------------------------------------------------------------
    console.log('\n[TEST 4] Menguji PersistentAlert Lifecycle & Relasi User Resolution...');

    // 4.1 Buat PersistentAlert OPEN
    console.log('  -> 4.1 Membuat PersistentAlert berstatus OPEN...');
    const newAlert = await prisma.persistentAlert.create({
      data: {
        tenantId: tenant.id,
        outletId: outlet.id,
        ruleKey: 'PROFIT_MARGIN',
        severity: 'CRITICAL',
        title: 'Margin Laba Toko Berada di Bawah Batas Kritis',
        message: 'Margin tercatat 12.50%, di bawah batas kritis 15.00%. Evaluasi efisiensi pengeluaran.',
        metricValue: new Prisma.Decimal('12.50'),
        thresholdValue: new Prisma.Decimal('15.00'),
        status: 'OPEN',
      },
    });
    cleanupIds.alertIds.push(newAlert.id);
    assert(newAlert.status === 'OPEN', 'Status awal alert harus OPEN');
    console.log('     ✅ PersistentAlert OPEN berhasil dibuat (ID:', newAlert.id, ')');

    // 4.2 Update status ke RESOLVED dengan resolver user & resolution notes
    console.log('  -> 4.2 Mengupdate status alert ke RESOLVED dengan user resolution...');
    const resolvedTime = new Date();
    const resolvedAlert = await prisma.persistentAlert.update({
      where: { id: newAlert.id },
      data: {
        status: 'RESOLVED',
        resolvedAt: resolvedTime,
        resolvedById: dbOwner!.id,
        resolutionNotes: 'Sudah disesuaikan tarif layanan kiloan ekspres dan negosiasi ulang harga bahan baku deterjen.',
      },
      include: {
        resolvedBy: true,
        tenant: true,
        outlet: true,
      },
    });

    assert(resolvedAlert.status === 'RESOLVED', 'Status alert harus RESOLVED');
    assert(resolvedAlert.resolvedById === dbOwner!.id, 'resolvedById harus sesuai ID User resolver');
    assert(Boolean(resolvedAlert.resolvedBy), 'Relasi resolvedBy harus terisi');
    assert(resolvedAlert.resolvedBy!.id === dbOwner!.id, 'User resolver ID harus cocok');
    assert(Boolean(resolvedAlert.resolutionNotes), 'Catatan penyelesaian harus tersimpan');
    console.log('     ✅ PersistentAlert berhasil di-resolve oleh User:', resolvedAlert.resolvedBy?.name);

    // 4.3 Verifikasi relasi balik pada User
    console.log('  -> 4.3 Verifikasi relasi balik resolvedPersistentAlerts pada model User...');
    const userWithAlerts = await prisma.user.findUnique({
      where: { id: dbOwner!.id },
      include: {
        resolvedPersistentAlerts: {
          where: { id: newAlert.id },
        },
      },
    });
    assert(
      (userWithAlerts?.resolvedPersistentAlerts.length ?? 0) > 0,
      'User harus memiliki relasi balik resolvedPersistentAlerts yang memuat alert yang baru diselesaikan'
    );
    console.log('     ✅ Relasi balik User.resolvedPersistentAlerts terverifikasi bekerja');

    console.log('\n====================================================');
    console.log('🎉 ALL WAVE 3A BATCH 1 SCHEMA TESTS PASSED 100%!');
    console.log('====================================================');
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP: Zero Database Residue
    // -------------------------------------------------------------------------
    console.log('\n🧹 Membersihkan Seluruh Data Pengujian (Zero Residue)...');
    if (cleanupIds.alertIds.length > 0) {
      await prisma.persistentAlert.deleteMany({
        where: { id: { in: cleanupIds.alertIds } },
      });
      console.log(`  - Dihapus ${cleanupIds.alertIds.length} data PersistentAlert uji`);
    }
    if (cleanupIds.ruleConfigIds.length > 0) {
      await prisma.alertRuleConfig.deleteMany({
        where: { id: { in: cleanupIds.ruleConfigIds } },
      });
      console.log(`  - Dihapus ${cleanupIds.ruleConfigIds.length} data AlertRuleConfig uji`);
    }
    await prisma.$disconnect();
    console.log('✅ Pembersihan selesai bersih. 0 residu database tersisa.');
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
