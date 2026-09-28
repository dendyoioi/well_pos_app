import { prisma } from '../../config/prisma';
import bcrypt from 'bcryptjs';
import { execSync } from 'child_process';
import path from 'path';

async function runEpic12SandboxValidation() {
  console.log('===================================================================');
  console.log('EPIC-12 CONTRACT TEST: LOCAL PRE-RELEASE SANDBOX VALIDATION');
  console.log('===================================================================\n');

  let passedTests = 0;
  const totalTests = 5;

  try {
    // -----------------------------------------------------------------
    // [1/5] Master Sandbox Seeder Re-run & Idempotency Check
    // -----------------------------------------------------------------
    console.log('[1/5] Menguji Re-run & Idempotensi Master Sandbox Seeder...');
    const serverRoot = path.resolve(__dirname, '../../..');
    execSync('npx tsx prisma/seed.sandbox.ts', { cwd: serverRoot, stdio: 'inherit' });

    const tenant = await prisma.tenant.findUnique({
      where: { slug: 'ura-coffee' },
      include: { subscriptions: { include: { plan: true } } },
    });

    if (!tenant) throw new Error('Tenant sandbox "ura-coffee" tidak ditemukan!');
    if (tenant.status !== 'ACTIVE') throw new Error('Status tenant bukan ACTIVE!');
    if (!tenant.enableRecipeTracking) throw new Error('Fitur recipe tracking tidak aktif!');

    const activeSub = tenant.subscriptions.find((s) => s.isActive);
    if (!activeSub || activeSub.plan.code !== 'PRO') {
      throw new Error('Tenant sandbox tidak memiliki paket PRO aktif!');
    }

    console.log(`   ✅ Tenant: "${tenant.name}" aktif dengan paket ${activeSub.plan.name}`);
    console.log('✅ Module [1/5] Sandbox Seeder & Tenant State LULUS (100%).\n');
    passedTests++;

    // -----------------------------------------------------------------
    // [2/5] IAM & Multi-Role Credential Integrity
    // -----------------------------------------------------------------
    console.log('[2/5] Menguji Integritas Kredensial Multi-Role Sandbox...');

    // 1. SuperAdmin Platform
    const sa = await prisma.platformUser.findUnique({
      where: { email: 'superadmin@wellpos.id' },
    });
    if (!sa) throw new Error('Platform SuperAdmin tidak ditemukan!');
    const isSaPassValid = await bcrypt.compare('SuperAdmin123!', sa.passwordHash);
    if (!isSaPassValid) throw new Error('Password SuperAdmin123! tidak cocok!');
    console.log(`   ✅ Platform SuperAdmin: ${sa.email} [Role: ${sa.role}]`);

    // 2. Merchant Owner
    const owner = await prisma.user.findFirst({
      where: { tenantId: tenant.id, email: 'owner@uracoffee.id' },
    });
    if (!owner || owner.role !== 'OWNER') throw new Error('Owner merchant tidak valid!');
    const isOwnerPassValid = await bcrypt.compare('Owner123!', owner.passwordHash || '');
    if (!isOwnerPassValid) throw new Error('Password Owner123! tidak cocok!');
    console.log(`   ✅ Merchant Owner: ${owner.email} [UserCode: ${owner.userCode}]`);

    // 3. Kasir Toko Kemang (PIN 123456)
    const cashier = await prisma.user.findFirst({
      where: { tenantId: tenant.id, email: 'kasir@uracoffee.id' },
      include: { outlet: true },
    });
    if (!cashier || cashier.role !== 'CASHIER') throw new Error('Kasir toko tidak valid!');
    const isCashierPinValid = await bcrypt.compare('123456', cashier.pinHash || '');
    if (!isCashierPinValid) throw new Error('PIN kasir 123456 tidak cocok!');
    if (!cashier.outlet || cashier.outlet.code !== 'OUT-01') {
      throw new Error('Kasir tidak terikat ke Outlet Kemang (OUT-01)!');
    }
    console.log(`   ✅ Kasir Toko: ${cashier.email} [PIN: 123456, Outlet: ${cashier.outlet.name}]`);

    // 4. Kepala Gudang Central Warehouse
    const warehouseStaff = await prisma.user.findFirst({
      where: { tenantId: tenant.id, email: 'gudang@uracoffee.id' },
      include: { outlet: true },
    });
    if (!warehouseStaff || warehouseStaff.role !== 'WAREHOUSE') throw new Error('Staff gudang tidak valid!');
    const isWhPassValid = await bcrypt.compare('Gudang123!', warehouseStaff.passwordHash || '');
    if (!isWhPassValid) throw new Error('Password Gudang123! tidak cocok!');
    console.log(`   ✅ Kepala Gudang: ${warehouseStaff.email} [Outlet: ${warehouseStaff.outlet?.name}]`);

    // 5. Supervisor Toko Kemang
    const spv = await prisma.user.findFirst({
      where: { tenantId: tenant.id, email: 'supervisor@uracoffee.id' },
      include: { outlet: true },
    });
    if (!spv || spv.role !== 'SUPERVISOR') throw new Error('Supervisor toko tidak valid!');
    const isSpvPassValid = await bcrypt.compare('Spv123!', spv.passwordHash || '');
    if (!isSpvPassValid) throw new Error('Password Spv123! tidak cocok!');
    console.log(`   ✅ Supervisor: ${spv.email} [Outlet: ${spv.outlet?.name}]`);

    console.log('✅ Module [2/5] IAM & Multi-Role Credentials LULUS (100%).\n');
    passedTests++;

    // -----------------------------------------------------------------
    // [3/5] Multi-Outlet Topology & Physical Stock Balances
    // -----------------------------------------------------------------
    console.log('[3/5] Menguji Topologi 2 Outlet + 1 Gudang & Saldo Persediaan...');

    const outlets = await prisma.outlet.findMany({
      where: { tenantId: tenant.id },
      include: { storageLocations: true },
    });
    if (outlets.length !== 3) throw new Error(`Diharapkan 3 outlet, ditemukan ${outlets.length}`);

    const kemang = outlets.find((o) => o.code === 'OUT-01');
    const sudirman = outlets.find((o) => o.code === 'OUT-02');
    const centralWh = outlets.find((o) => o.code === 'WH-01');

    if (!kemang || !sudirman || !centralWh) {
      throw new Error('Kode outlet OUT-01, OUT-02, atau WH-01 tidak lengkap!');
    }

    // Periksa saldo fisik di Gudang Pusat (Biji Kopi >= 50.000 gr)
    const whLoc = centralWh.storageLocations.find((l) => l.isDefault);
    if (!whLoc) throw new Error('Storage Location default Gudang Pusat tidak ditemukan!');

    const beansItem = await prisma.inventoryItem.findFirst({
      where: { tenantId: tenant.id, itemCode: 'RAW-BEANS' },
    });
    if (!beansItem) throw new Error('Inventory Item RAW-BEANS tidak ditemukan!');

    const whBeansBalance = await prisma.inventoryBalance.findFirst({
      where: {
        tenantId: tenant.id,
        storageLocationId: whLoc.id,
        inventoryItemId: beansItem.id,
      },
    });

    if (!whBeansBalance || Number(whBeansBalance.quantityOnHand) < 50000) {
      throw new Error('Saldo persediaan biji kopi di gudang pusat tidak mencukupi!');
    }

    // Periksa Ledger Mutasi
    const ledgersCount = await prisma.inventoryLedger.count({
      where: { tenantId: tenant.id, referenceId: 'SANDBOX-SEED' },
    });
    if (ledgersCount === 0) throw new Error('Tidak ada audit log inventory_ledgers untuk sandbox!');

    console.log(`   ✅ 3 Cabang terverifikasi: Kemang, Sudirman, Central Warehouse`);
    console.log(`   ✅ Saldo Kopi Gudang: ${Number(whBeansBalance.quantityOnHand)} ${beansItem.canonicalUom}`);
    console.log(`   ✅ Total Audit Record Ledgers: ${ledgersCount} baris`);
    console.log('✅ Module [3/5] Topologi Outlet & Saldo Persediaan LULUS (100%).\n');
    passedTests++;

    // -----------------------------------------------------------------
    // [4/5] F&B BOM Recipe & Modifier Deduction Verification
    // -----------------------------------------------------------------
    console.log('[4/5] Menguji Resep F&B BOM & Efek Modifiers...');

    const kopiSusuVar = await prisma.productVariant.findFirst({
      where: { tenantId: tenant.id, sku: 'FNB-KPS-001' },
      include: {
        recipe: { include: { items: { include: { inventoryItem: true } } } },
        product: {
          include: {
            modifierGroups: {
              include: {
                modifierGroup: {
                  include: {
                    items: { include: { recipeEffects: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!kopiSusuVar || !kopiSusuVar.recipe) {
      throw new Error('Menu Kopi Susu Aren atau resep BOM tidak ditemukan!');
    }

    if (kopiSusuVar.recipe.items.length !== 4) {
      throw new Error(`Diharapkan 4 bahan baku resep kopi susu, ditemukan ${kopiSusuVar.recipe.items.length}`);
    }

    const modGroups = kopiSusuVar.product.modifierGroups;
    if (modGroups.length === 0) throw new Error('Modifier groups tidak terpasang di Kopi Susu!');

    const modItems = modGroups[0].modifierGroup.items;
    const extraShot = modItems.find((m) => m.name.includes('Extra Espresso Shot'));
    if (!extraShot || extraShot.recipeEffects.length === 0) {
      throw new Error('Modifier Extra Shot tidak memiliki efek pemotongan bahan baku!');
    }

    console.log(`   ✅ Menu: ${kopiSusuVar.product.name} (Harga: Rp ${Number(kopiSusuVar.price).toLocaleString('id-ID')})`);
    console.log(`   ✅ Resep Bahan Baku: ${kopiSusuVar.recipe.items.map((i) => `${i.inventoryItem.name} (${Number(i.quantity)} ${i.inventoryItem.canonicalUom})`).join(', ')}`);
    console.log(`   ✅ Modifier Items: ${modItems.map((m) => `${m.name} (+Rp ${Number(m.priceAdjustment).toLocaleString('id-ID')})`).join(', ')}`);
    console.log('✅ Module [4/5] Resep F&B BOM & Modifiers LULUS (100%).\n');
    passedTests++;

    // -----------------------------------------------------------------
    // [5/5] Operational Readiness (Active Shift & Loyalty CRM)
    // -----------------------------------------------------------------
    console.log('[5/5] Menguji Kesiapan Operasional (Shift Kasir, Loyalty, & Promo)...');

    // 1. Shift Aktif
    const activeShift = await prisma.shift.findFirst({
      where: {
        tenantId: tenant.id,
        status: 'OPEN',
        user: { email: 'kasir@uracoffee.id' },
      },
      include: { outlet: true },
    });

    if (!activeShift) throw new Error('Tidak ada shift kasir OPEN yang aktif!');
    if (Number(activeShift.startingCash) !== 200000) {
      throw new Error('Modal awal shift kasir bukan Rp 200.000!');
    }
    console.log(`   ✅ Sesi Kasir Aktif: ID ${activeShift.id} [Status: OPEN, Modal: Rp 200.000, Outlet: ${activeShift.outlet.name}]`);

    // 2. Member Loyalty
    const budi = await prisma.customer.findFirst({
      where: { tenantId: tenant.id, phone: '081234567890' },
    });
    if (!budi || budi.tier !== 'GOLD' || budi.loyaltyPoints !== 250) {
      throw new Error('Data member loyalitas Budi Santoso tidak valid!');
    }
    console.log(`   ✅ Member Loyalitas: ${budi.name} [Tier: ${budi.tier}, Poin: ${budi.loyaltyPoints}]`);

    // 3. Voucher Promo
    const promo = await prisma.promotion.findFirst({
      where: { tenantId: tenant.id, code: 'KOPIASIK10' },
    });
    if (!promo || !promo.isActive) throw new Error('Voucher promo KOPIASIK10 tidak aktif!');
    console.log(`   ✅ Promo Voucher: ${promo.code} [Diskon: ${Number(promo.discountValue)}%, Min: Rp ${Number(promo.minOrderAmount).toLocaleString('id-ID')}]`);

    console.log('✅ Module [5/5] Kesiapan Operasional Kasir LULUS (100%).\n');
    passedTests++;

    // -----------------------------------------------------------------
    // SUMMARY
    // -----------------------------------------------------------------
    console.log('===================================================================');
    console.log(`🎉 SELURUH ${passedTests}/${totalTests} SUITE VERIFIKASI SANDBOX EPIC-12 LULUS 100%!`);
    console.log('Lingkungan Local Pre-Release Sandbox siap digunakan tanpa friksi.');
    console.log('===================================================================');
  } catch (error) {
    console.error('\n❌ KONTRAK TEST EPIC-12 GAGAL:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  runEpic12SandboxValidation();
}
