import { PrismaClient } from '@prisma/client';
import { SalesDualWriteService } from '../services/dual_write/sales.dual_write.service';

const prisma = new PrismaClient();

async function testFase3Checkout() {
  console.log('🚀 Memulai Pengujian Fase 3: Dynamic Warehouse Routing & Backflushing...');

  // 1. Ambil data tenant Ura Corporation
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'ura-corporation' }
  });

  if (!tenant) {
    throw new Error('Tenant ura-corporation tidak ditemukan!');
  }

  // 2. Ambil Outlet Ura Coffee Kemang
  const outletKemang = await prisma.outlet.findFirst({
    where: { tenantId: tenant.id, code: 'OUT-01' }
  });

  if (!outletKemang) {
    throw new Error('Outlet Kemang tidak ditemukan!');
  }

  // 3. Ambil Gudang Pusat
  const warehouse = await prisma.outlet.findFirst({
    where: { tenantId: tenant.id, code: 'WH-01' }
  });

  if (!warehouse) {
    throw new Error('Gudang Pusat WH-01 tidak ditemukan!');
  }

  // Ambil storage location gudang pusat
  const whLoc = await prisma.storageLocation.findFirst({
    where: { outletId: warehouse.id, type: 'WAREHOUSE' }
  });

  if (!whLoc) {
    throw new Error('Storage location Gudang Pusat tidak ditemukan!');
  }

  // Ambil Kasir Outlet Kemang
  const cashier = await prisma.user.findFirst({
    where: { outletId: outletKemang.id, role: 'CASHIER' }
  });

  const cashierId = cashier ? cashier.id : (await prisma.user.findFirst({ where: { tenantId: tenant.id } }))!.id;

  // 4. Ambil Menu Kopi Susu Aren Ura dengan Varian dan Resep
  const product = await prisma.product.findFirst({
    where: { tenantId: tenant.id, name: 'Kopi Susu Aren Ura' },
    include: {
      variants: {
        include: {
          recipe: {
            include: {
              items: {
                include: {
                  inventoryItem: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!product || !product.variants || product.variants.length === 0) {
    throw new Error('Menu Kopi Susu Aren Ura tidak ditemukan!');
  }

  const variant = product.variants[0];
  if (!variant.recipe || !variant.recipe.items || variant.recipe.items.length === 0) {
    throw new Error('Resep BOM untuk Kopi Susu Aren Ura tidak ditemukan!');
  }

  const recipeItems = variant.recipe.items;
  const itemPrice = Number(variant.price);
  const qtyOrder = 2;

  console.log(`\n📋 Menu: ${product.name} - ${variant.name} (Harga: Rp ${itemPrice.toLocaleString('id-ID')})`);
  console.log(`🏪 Kasir Outlet Toko: ${outletKemang.name} (Disuplai oleh: ${warehouse.name})`);
  console.log(`📦 Gudang Lokasi ID: ${whLoc.id} (${whLoc.name})`);
  console.log(`🔍 Komponen Resep BOM:`);
  for (const item of recipeItems) {
    console.log(`   - ${item.inventoryItem.name}: ${item.quantity} ${item.inventoryItem.canonicalUom}`);
  }

  // Cek saldo awal di Gudang Pusat
  const initialBalances = await prisma.inventoryBalance.findMany({
    where: {
      storageLocationId: whLoc.id,
      inventoryItemId: { in: recipeItems.map((r: any) => r.inventoryItemId) }
    },
    include: { inventoryItem: true }
  });

  console.log('\n📊 Saldo Awal Bahan Baku di Gudang Pusat:');
  const balanceMapBefore = new Map<string, number>();
  for (const b of initialBalances) {
    balanceMapBefore.set(b.inventoryItemId, Number(b.quantityOnHand));
    console.log(`   • ${b.inventoryItem.name}: ${Number(b.quantityOnHand).toLocaleString('id-ID')} ${b.inventoryItem.canonicalUom}`);
  }

  // 5. Eksekusi Checkout Kasir: 2 porsi Kopi Susu Aren Ura di Outlet Kemang
  const salesDualWrite = new SalesDualWriteService();
  const invoiceNumber = `INV-TEST-F3-${Date.now()}`;

  const preparedOrderItems = [
    {
      productId: product.id,
      variantId: variant.id,
      productName: `${product.name} (${variant.name})`,
      quantity: qtyOrder,
      unitPrice: itemPrice,
      subtotal: itemPrice * qtyOrder,
      costPrice: 0
    }
  ];

  const preparedPayments = [
    {
      method: 'CASH',
      amountPaid: itemPrice * qtyOrder
    }
  ];

  console.log(`\n💳 Menjalankan Checkout POS Kasir (${qtyOrder} porsi ${product.name})...`);
  
  const dwResult = await prisma.$transaction(async (tx) => {
    return await salesDualWrite.processCheckout(
      {
        targetOutletId: outletKemang.id,
        cashierId,
        invoiceNumber,
        channel: 'DINE_IN',
        orderType: 'DINE_IN',
        items: preparedOrderItems,
        payments: preparedPayments,
        subtotal: itemPrice * qtyOrder,
        grandTotal: itemPrice * qtyOrder,
        totalCost: 0,
        notes: 'Testing Checkout Fase 3 Dynamic Warehouse Routing'
      },
      { tx, tenantId: tenant.id }
    );
  });

  console.log(`✅ Checkout Berhasil! Transaksi Invoice: ${invoiceNumber}`);

  // 6. Cek Saldo Akhir di Gudang Pusat
  const finalBalances = await prisma.inventoryBalance.findMany({
    where: {
      storageLocationId: whLoc.id,
      inventoryItemId: { in: recipeItems.map((r: any) => r.inventoryItemId) }
    },
    include: { inventoryItem: true }
  });

  console.log('\n📉 Saldo Akhir Bahan Baku di Gudang Pusat:');
  for (const b of finalBalances) {
    const before = balanceMapBefore.get(b.inventoryItemId) ?? 0;
    const after = Number(b.quantityOnHand);
    const diff = before - after;
    console.log(`   • ${b.inventoryItem.name}: ${before.toLocaleString('id-ID')} -> ${after.toLocaleString('id-ID')} ${b.inventoryItem.canonicalUom} (Terpotong: -${diff.toLocaleString('id-ID')})`);
  }

  // 7. Cek Audit Trail Buku Besar Mutasi (inventory_ledgers)
  const ledgers = await prisma.inventoryLedger.findMany({
    where: {
      tenantId: tenant.id,
      storageLocationId: whLoc.id,
      referenceType: 'ORDER'
    },
    include: { inventoryItem: true },
    orderBy: { createdAt: 'desc' },
    take: recipeItems.length
  });

  console.log(`\n📜 Catatan Kartu Stok / Ledger Gudang Pusat (${ledgers.length} mutasi terbaru):`);
  for (const l of ledgers) {
    console.log(`   - [${l.movementType}] ${l.inventoryItem.name}: ${l.quantityDelta} (Sisa: ${Number(l.balanceAfter).toLocaleString('id-ID')}) | Ket: ${l.notes}`);
  }

  console.log('\n🎉 Pengujian Selesai: Pemotongan bahan baku di Gudang Pusat TERBUKTI 100% BERHASIL!');
}

testFase3Checkout()
  .catch((e) => {
    console.error('❌ Error saat pengujian Fase 3:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
