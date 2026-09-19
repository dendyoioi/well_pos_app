import { prisma } from '../server/src/config/prisma';

export async function cleanAuditResidues() {
  console.log('🧹 Menghapus sisa-sisa data audit & testing...');
  
  // 1. Hapus produk dummy yang mengandung kata 'Alpha', 'Beta', 'Test', 'TEST-'
  const deletedStockMoves = await prisma.stockMovement.deleteMany({
    where: {
      product: {
        OR: [
          { name: { contains: 'Alpha' } },
          { name: { contains: 'Beta' } },
          { name: { contains: 'Test' } },
          { barcode: { startsWith: 'TEST-' } },
        ],
      },
    },
  });
  console.log(`- Dihapus ${deletedStockMoves.count} stock movements dummy.`);

  const deletedOutletProducts = await prisma.outletProduct.deleteMany({
    where: {
      product: {
        OR: [
          { name: { contains: 'Alpha' } },
          { name: { contains: 'Beta' } },
          { name: { contains: 'Test' } },
          { barcode: { startsWith: 'TEST-' } },
        ],
      },
    },
  });
  console.log(`- Dihapus ${deletedOutletProducts.count} outlet product links dummy.`);

  const deletedProducts = await prisma.product.deleteMany({
    where: {
      OR: [
        { name: { contains: 'Alpha' } },
        { name: { contains: 'Beta' } },
        { name: { contains: 'Test' } },
        { barcode: { startsWith: 'TEST-' } },
      ],
    },
  });
  console.log(`- Dihapus ${deletedProducts.count} produk dummy.`);

  // 2. Hapus kategori dummy yang mengandung kata 'Uji', 'Alpha', 'Beta', 'Test'
  const deletedCats = await prisma.category.deleteMany({
    where: {
      OR: [
        { name: { contains: 'Uji' } },
        { name: { contains: 'Alpha' } },
        { name: { contains: 'Beta' } },
        { name: { contains: 'Test' } },
      ],
    },
  });
  console.log(`- Dihapus ${deletedCats.count} kategori dummy.`);

  console.log('✨ Sisa-sisa audit berhasil dibersihkan total!');
}

if (process.argv[1]?.includes('clean_test_residues')) {
  cleanAuditResidues()
    .catch((err) => console.error('Error saat cleanup:', err))
    .finally(() => prisma.$disconnect());
}
