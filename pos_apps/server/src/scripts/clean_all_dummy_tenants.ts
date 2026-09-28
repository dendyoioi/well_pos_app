import { PrismaClient, PlatformRole, BillingCycle } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function cleanAllDummyTenants() {
  console.log('🚀 Memulai pembersihan seluruh data tenant / dummy toko...');

  try {
    // 1. Bersihkan transaksi dan relasi turunan
    console.log('🧹 Menghapus relasi promosi & poin customer...');
    await prisma.promotionUsage.deleteMany({});
    await prisma.customerPointLedger.deleteMany({});
    await prisma.promotion.deleteMany({});
    await prisma.customer.deleteMany({});

    console.log('🧹 Menghapus resep, modifiers, dan komposisi...');
    await prisma.modifierRecipeEffect.deleteMany({});
    await prisma.productModifierGroup.deleteMany({});
    await prisma.modifierItem.deleteMany({});
    await prisma.modifierGroup.deleteMany({});
    await prisma.recipeItem.deleteMany({});
    await prisma.recipe.deleteMany({});

    console.log('🧹 Menghapus transaksi kasir, refund, dan order...');
    await prisma.refundItem.deleteMany({});
    await prisma.refund.deleteMany({});
    await prisma.paymentTransaction.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});

    try {
      await prisma.$executeRawUnsafe(`DELETE FROM "hold_orders";`);
    } catch {
      // hold_orders might not exist or already empty
    }

    console.log('🧹 Menghapus shift kasir...');
    await prisma.shift.deleteMany({});

    console.log('🧹 Menghapus saldo & kartu stok inventaris...');
    await prisma.inventoryLedger.deleteMany({});
    await prisma.inventoryBalance.deleteMany({});

    console.log('🧹 Menghapus produk komersial & varian...');
    await prisma.productVariant.deleteMany({});
    await prisma.product.deleteMany({});

    console.log('🧹 Menghapus transfer stok & purchase order...');
    await prisma.stockTransferItem.deleteMany({});
    await prisma.stockTransfer.deleteMany({});
    await prisma.purchaseOrderItem.deleteMany({});
    await prisma.purchaseOrder.deleteMany({});
    await prisma.supplier.deleteMany({});

    console.log('🧹 Menghapus bahan baku fisik (Inventory Items)...');
    await prisma.inventoryBatch.deleteMany({});
    await prisma.inventoryItem.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.storageLocation.deleteMany({});

    console.log('🧹 Menghapus idempotency records...');
    await prisma.idempotencyRecord.deleteMany({});

    console.log('🧹 Menghapus invoice & payment SaaS tenant...');
    await prisma.saaSPayment.deleteMany({});
    await prisma.saaSInvoice.deleteMany({});
    await prisma.tenantSubscription.deleteMany({});

    console.log('🧹 Menghapus pengguna staf & outlet toko...');
    await prisma.user.deleteMany({});
    await prisma.outlet.deleteMany({});

    console.log('🧹 Menghapus seluruh entitas tenant...');
    const deletedTenants = await prisma.tenant.deleteMany({});
    console.log(`   ✅ Berhasil menghapus ${deletedTenants.count} tenant dummy.`);

    // 2. Pastikan Platform SuperAdmin siap
    console.log('\n👑 Memastikan Akun SuperAdmin Platform Aktif...');
    const salt = await bcrypt.genSalt(10);
    const superAdminPassHash = await bcrypt.hash('SuperAdmin123!', salt);

    const superAdmin = await prisma.platformUser.upsert({
      where: { email: 'superadmin@wellpos.id' },
      update: {
        name: 'SuperAdmin Well POS',
        role: PlatformRole.SUPER_ADMIN,
        passwordHash: superAdminPassHash,
      },
      create: {
        email: 'superadmin@wellpos.id',
        name: 'SuperAdmin Well POS',
        role: PlatformRole.SUPER_ADMIN,
        passwordHash: superAdminPassHash,
      },
    });
    console.log(`   ✅ SuperAdmin Siap: ${superAdmin.email} [Password: SuperAdmin123! atau superadmin123]`);

    // 3. Pastikan Paket Langganan FREE & PRO siap
    console.log('\n📦 Memastikan Paket Langganan SaaS Aktif (FREE & PRO)...');
    await prisma.subscriptionPlan.upsert({
      where: { code: 'FREE' },
      update: {
        name: 'Starter (Gratis)',
        price: 0,
        billingCycle: BillingCycle.MONTHLY,
        maxOutlets: 1,
        maxCashiers: 2,
        features: ['BASIC_POS', 'OFFLINE_MODE', 'SINGLE_OUTLET'],
      },
      create: {
        code: 'FREE',
        name: 'Starter (Gratis)',
        price: 0,
        billingCycle: BillingCycle.MONTHLY,
        maxOutlets: 1,
        maxCashiers: 2,
        features: ['BASIC_POS', 'OFFLINE_MODE', 'SINGLE_OUTLET'],
      },
    });

    await prisma.subscriptionPlan.upsert({
      where: { code: 'PRO' },
      update: {
        name: 'Pro Enterprise',
        price: 150000,
        billingCycle: BillingCycle.MONTHLY,
        maxOutlets: 10,
        maxCashiers: 20,
        features: ['ALL_FEATURES', 'SPLIT_PAYMENT', 'HOLD_ORDER', 'HPP_REPORT', 'CLEAN_RECEIPT', 'RECIPES_BOM', 'MULTI_OUTLET'],
      },
      create: {
        code: 'PRO',
        name: 'Pro Enterprise',
        price: 150000,
        billingCycle: BillingCycle.MONTHLY,
        maxOutlets: 10,
        maxCashiers: 20,
        features: ['ALL_FEATURES', 'SPLIT_PAYMENT', 'HOLD_ORDER', 'HPP_REPORT', 'CLEAN_RECEIPT', 'RECIPES_BOM', 'MULTI_OUTLET'],
      },
    });
    console.log('   ✅ Paket SaaS FREE & PRO Siap.');

    // 4. Verifikasi kondisi bersih
    const remainingTenants = await prisma.tenant.count();
    const remainingUsers = await prisma.user.count();
    const remainingOutlets = await prisma.outlet.count();
    const remainingOrders = await prisma.order.count();

    console.log('\n📊 Ringkasan Status Database Saat Ini:');
    console.log(`   - Tenants       : ${remainingTenants}`);
    console.log(`   - Outlets       : ${remainingOutlets}`);
    console.log(`   - Users/Staf    : ${remainingUsers}`);
    console.log(`   - Orders/Sales  : ${remainingOrders}`);
    console.log(`   - SuperAdmin    : 1 (Aktif)`);
    console.log(`   - SaaS Plans    : 2 (FREE & PRO Aktif)`);
    console.log('\n✨ DATABASE BERHASIL DIBERSIHKAN TOTAL! Siap untuk pengujian registrasi baru dari awal.\n');
  } catch (error) {
    console.error('❌ Gagal membersihkan data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanAllDummyTenants();
