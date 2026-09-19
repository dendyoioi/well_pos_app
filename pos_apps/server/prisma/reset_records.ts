import { PrismaClient, StockMovementType } from '@prisma/client';

const prisma = new PrismaClient();

async function resetRecords() {
  console.log('🧹 Membersihkan seluruh data transaksi audit & pengujian...');

  // 1. Hapus transaksi & pembayaran
  const deletedPayments = await prisma.payment.deleteMany({});
  console.log(`   ✅ Dihapus: ${deletedPayments.count} pembayaran`);

  const deletedOrderItems = await prisma.orderItem.deleteMany({});
  console.log(`   ✅ Dihapus: ${deletedOrderItems.count} item faktur`);

  const deletedOrders = await prisma.order.deleteMany({});
  console.log(`   ✅ Dihapus: ${deletedOrders.count} pesanan faktur`);

  // 2. Hapus shift kasir audit
  const deletedShifts = await prisma.shift.deleteMany({});
  console.log(`   ✅ Dihapus: ${deletedShifts.count} sesi shift kasir`);

  // 3. Hapus produk & kategori dummy audit jika ada
  const auditProds = await prisma.product.findMany({
    where: { OR: [{ name: { contains: 'Audit' } }, { sku: { startsWith: 'AUD' } }] },
  });
  if (auditProds.length > 0) {
    const prodIds = auditProds.map((p) => p.id);
    await prisma.stockMovement.deleteMany({ where: { productId: { in: prodIds } } });
    await prisma.outletProduct.deleteMany({ where: { productId: { in: prodIds } } });
    await prisma.product.deleteMany({ where: { id: { in: prodIds } } });
    console.log(`   ✅ Dihapus: ${auditProds.length} produk sisa audit`);
  }

  const deletedCats = await prisma.category.deleteMany({
    where: { name: { contains: 'Audit' } },
  });
  if (deletedCats.count > 0) {
    console.log(`   ✅ Dihapus: ${deletedCats.count} kategori sisa audit`);
  }

  // 4. Hapus mutasi stok transaksi (SALE_OUT, dll.) dan sisakan mutasi awal
  const deletedMovements = await prisma.stockMovement.deleteMany({
    where: {
      type: { not: StockMovementType.PURCHASE_IN },
    },
  });
  console.log(`   ✅ Dihapus: ${deletedMovements.count} mutasi stok pengujian`);

  // 4. Kembalikan stok cabang ke stok awal default
  const defaultStocks: Record<string, number> = {
    'DRK-KP-001': 50,
    'DRK-TEH-002': 100,
    'DRK-MTC-003': 40,
    'DRK-AIR-004': 120,
    'FOD-NASI-001': 30,
    'FOD-MIE-002': 35,
    'FOD-ROTI-003': 25,
    'SNK-KRP-001': 45,
  };

  const products = await prisma.product.findMany();
  for (const p of products) {
    const stockQty = defaultStocks[p.sku] ?? 50;
    await prisma.outletProduct.updateMany({
      where: { productId: p.id },
      data: { stock: stockQty },
    });
  }
  console.log('   ✅ Stok produk cabang telah dikembalikan ke saldo awal.');

  console.log('✨ Data transaksi audit berhasil dibersihkan total!\n');
}

resetRecords()
  .catch((e) => {
    console.error('❌ Gagal mereset data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
