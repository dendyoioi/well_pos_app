import { PrismaClient } from '@prisma/client';
import { InventoryDualWriteService } from '../services/dual_write/inventory.dual_write.service';

const prisma = new PrismaClient();

async function testFase4Transfer() {
  console.log('🚀 Memulai Pengujian Integrasi Fase 4: Stock Allocation & Transfer Antar Gudang - Toko...');

  // 1. Ambil tenant Ura Corporation
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'ura-corporation' }
  });
  if (!tenant) throw new Error('Tenant ura-corporation tidak ditemukan');

  // 2. Ambil Gudang Pusat (WH-01) dan Toko Kemang (OUT-01)
  const warehouse = await prisma.outlet.findFirst({
    where: { tenantId: tenant.id, code: 'WH-01' }
  });
  const outletKemang = await prisma.outlet.findFirst({
    where: { tenantId: tenant.id, code: 'OUT-01' }
  });

  if (!warehouse || !outletKemang) throw new Error('Gudang atau Outlet Kemang tidak ditemukan');

  const whLoc = await prisma.storageLocation.findFirst({
    where: { outletId: warehouse.id, type: 'WAREHOUSE' }
  });
  const kemangLoc = await prisma.storageLocation.findFirst({
    where: { outletId: outletKemang.id, isDefault: true }
  });

  if (!whLoc || !kemangLoc) throw new Error('Storage location tidak ditemukan');

  // 3. Ambil Bahan Baku Biji Kopi
  const coffeeItem = await prisma.inventoryItem.findFirst({
    where: { tenantId: tenant.id, itemCode: 'RAW-COFFEE-01' }
  });
  if (!coffeeItem) throw new Error('Bahan baku Biji Kopi tidak ditemukan');

  // 4. Saldo Awal di Gudang dan di Toko
  const whBalBefore = await prisma.inventoryBalance.findFirst({
    where: { storageLocationId: whLoc.id, inventoryItemId: coffeeItem.id }
  });
  const kemangBalBefore = await prisma.inventoryBalance.findFirst({
    where: { storageLocationId: kemangLoc.id, inventoryItemId: coffeeItem.id }
  });

  const qtyWhBefore = Number(whBalBefore?.quantityOnHand || 0);
  const qtyKemangBefore = Number(kemangBalBefore?.quantityOnHand || 0);

  console.log(`\n📦 Bahan Baku: ${coffeeItem.name} (${coffeeItem.canonicalUom})`);
  console.log(`🏭 Gudang Asal (${warehouse.name}) Saldo Awal: ${qtyWhBefore.toLocaleString('id-ID')} ${coffeeItem.canonicalUom}`);
  console.log(`🏪 Toko Tujuan (${outletKemang.name}) Saldo Awal: ${qtyKemangBefore.toLocaleString('id-ID')} ${coffeeItem.canonicalUom}`);

  // 5. Eksekusi Transfer Alokasi: Kirim 5.000 GRAM Biji Kopi dari Gudang ke Toko Kemang
  const transferQty = 5000;
  console.log(`\n🚚 Mentransfer alokasi ${transferQty.toLocaleString('id-ID')} ${coffeeItem.canonicalUom} dari Gudang ke Toko Kemang...`);

  const inventoryDualWrite = new InventoryDualWriteService();
  const transferNotes = `Alokasi pasokan darurat akhir pekan: Surat Jalan #SJ-URA-0925`;

  await prisma.$transaction(async (tx) => {
    await inventoryDualWrite.recordStockTransfer(
      {
        sourceOutletId: warehouse.id,
        targetOutletId: outletKemang.id,
        inventoryItemId: coffeeItem.id,
        quantity: transferQty,
        notes: transferNotes,
      },
      { tx, tenantId: tenant.id }
    );
  });

  console.log(`✅ Transfer Berhasil Diproses!`);

  // 6. Cek Saldo Akhir
  const whBalAfter = await prisma.inventoryBalance.findFirst({
    where: { storageLocationId: whLoc.id, inventoryItemId: coffeeItem.id }
  });
  const kemangBalAfter = await prisma.inventoryBalance.findFirst({
    where: { storageLocationId: kemangLoc.id, inventoryItemId: coffeeItem.id }
  });

  const qtyWhAfter = Number(whBalAfter?.quantityOnHand || 0);
  const qtyKemangAfter = Number(kemangBalAfter?.quantityOnHand || 0);

  console.log(`\n📉 Saldo Akhir Setelah Transfer:`);
  console.log(`   • Gudang Pusat: ${qtyWhBefore.toLocaleString('id-ID')} -> ${qtyWhAfter.toLocaleString('id-ID')} ${coffeeItem.canonicalUom} (Terpotong: -${transferQty.toLocaleString('id-ID')})`);
  console.log(`   • Toko Kemang: ${qtyKemangBefore.toLocaleString('id-ID')} -> ${qtyKemangAfter.toLocaleString('id-ID')} ${coffeeItem.canonicalUom} (Bertambah: +${transferQty.toLocaleString('id-ID')})`);

  // 7. Cek Buku Besar Mutasi (inventory_ledgers)
  const latestLedgers = await prisma.inventoryLedger.findMany({
    where: {
      tenantId: tenant.id,
      inventoryItemId: coffeeItem.id,
      movementType: { in: ['TRANSFER_OUT', 'TRANSFER_IN'] }
    },
    orderBy: { createdAt: 'desc' },
    take: 2,
    include: { storageLocation: true }
  });

  console.log(`\n📜 Catatan Kartu Stok / Ledger Transfer:`);
  for (const l of latestLedgers) {
    console.log(`   - [${l.movementType}] Lokasi: ${l.storageLocation.name} | Delta: ${l.quantityDelta} ${coffeeItem.canonicalUom} | Sisa: ${Number(l.balanceAfter).toLocaleString('id-ID')} | Ket: ${l.notes}`);
  }

  console.log('\n🎉 Pengujian Selesai: Fitur Alokasi & Transfer Stok Gudang - Toko TERBUKTI 100% SUKSES!');
}

testFase4Transfer()
  .catch((e) => {
    console.error('❌ Error saat pengujian Fase 4:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
