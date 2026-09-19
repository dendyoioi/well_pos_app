import { prisma } from '../src/config/prisma';

async function purgeTenantData() {
  console.log('🚀 Memulai proses pembersihan (purge) seluruh data operasional tenant...');

  try {
    // 1. Transaksi & Item Penjualan
    const delHoldOrders = await prisma.holdOrder.deleteMany();
    console.log(`- Dihapus: ${delHoldOrders.count} pesanan tertunda (Hold Orders)`);

    const delPayments = await prisma.payment.deleteMany();
    console.log(`- Dihapus: ${delPayments.count} catatan pembayaran (Payments)`);

    const delOrderItems = await prisma.orderItem.deleteMany();
    console.log(`- Dihapus: ${delOrderItems.count} rincian item pesanan (Order Items)`);

    const delOrders = await prisma.order.deleteMany();
    console.log(`- Dihapus: ${delOrders.count} transaksi penjualan (Orders)`);

    // 2. Inventori, Stok & Mutasi
    const delStockMovements = await prisma.stockMovement.deleteMany();
    console.log(`- Dihapus: ${delStockMovements.count} mutasi kartu stok (Stock Movements)`);

    const delOutletProducts = await prisma.outletProduct.deleteMany();
    console.log(`- Dihapus: ${delOutletProducts.count} alokasi stok cabang (Outlet Products)`);

    // 3. Sesi Shift Kasir & Pelanggan
    const delShifts = await prisma.shift.deleteMany();
    console.log(`- Dihapus: ${delShifts.count} sesi shift kasir (Shifts)`);

    const delCustomers = await prisma.customer.deleteMany();
    console.log(`- Dihapus: ${delCustomers.count} data pelanggan (Customers)`);

    // 4. Katalog Produk & Kategori
    const delProducts = await prisma.product.deleteMany();
    console.log(`- Dihapus: ${delProducts.count} master produk (Products)`);

    const delCategories = await prisma.category.deleteMany();
    console.log(`- Dihapus: ${delCategories.count} master kategori (Categories)`);

    // 5. Billing & Invoice SaaS Tenant
    const delSaaSPayments = await prisma.saaSPayment.deleteMany();
    console.log(`- Dihapus: ${delSaaSPayments.count} bukti bayar SaaS (SaaS Payments)`);

    const delSaaSInvoices = await prisma.saaSInvoice.deleteMany();
    console.log(`- Dihapus: ${delSaaSInvoices.count} tagihan SaaS (SaaS Invoices)`);

    const delTenantSubscriptions = await prisma.tenantSubscription.deleteMany();
    console.log(`- Dihapus: ${delTenantSubscriptions.count} langganan tenant (Tenant Subscriptions)`);

    // 6. Pengguna Tenant & Cabang Toko
    const delUsers = await prisma.user.deleteMany();
    console.log(`- Dihapus: ${delUsers.count} pengguna/staf tenant (Tenant Users)`);

    const delOutlets = await prisma.outlet.deleteMany();
    console.log(`- Dihapus: ${delOutlets.count} cabang toko & gudang (Outlets & Warehouses)`);

    // 7. Tenant Utama
    const delTenants = await prisma.tenant.deleteMany();
    console.log(`- Dihapus: ${delTenants.count} data tenant perusahaan (Tenants)`);

    // Verifikasi kelestarian platform users & plans
    const platformUsersCount = await prisma.platformUser.count();
    const plansCount = await prisma.subscriptionPlan.count();

    console.log('\n=============================================');
    console.log('✅ PEMBERSIHAN SELESAI DENGAN SUKSES!');
    console.log(`🛡️  Platform Users (Superadmin): ${platformUsersCount} akun (AMAN)`);
    console.log(`🛡️  Master Subscription Plans: ${plansCount} paket (AMAN)`);
    console.log('=============================================');
  } catch (error) {
    console.error('❌ Gagal melakukan pembersihan data tenant:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

purgeTenantData();
