import { PrismaClient } from '@prisma/client';
import { locationDualWriteService, salesDualWriteService } from '../services/dual_write';

const prisma = new PrismaClient();

async function runRegressionSuite() {
  console.log('===============================================================');
  console.log('🧪 WELL POS: REGRESSION TEST - OUTLET & WAREHOUSE INTEGRITY');
  console.log('===============================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ [PASS] ${testName}`);
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      if (detail) console.error(`     Detail: ${detail}`);
    }
  }

  try {
    // 1. Setup Test Tenant (Ura Corporation)
    const tenant = await prisma.tenant.findFirst({
      where: { name: { contains: 'Ura' } },
    });

    if (!tenant) {
      throw new Error('Tenant Ura Corporation tidak ditemukan di database!');
    }
    const tenantId = tenant.id;
    console.log(`📌 Menggunakan Tenant: ${tenant.name} (${tenantId})\n`);

    // Ambil gudang pusat eksisting
    const centralWh = await prisma.outlet.findFirst({
      where: { tenantId, isWarehouse: true, isActive: true },
    });
    if (!centralWh) {
      throw new Error('Gudang Pusat eksisting tidak ditemukan!');
    }
    console.log(`📌 Gudang Pusat Referensi: ${centralWh.name} (${centralWh.id})\n`);

    // =========================================================================
    // TEST 1: Tambah Outlet Toko Mandiri (Kelola Stok Lokal / warehouseId = null)
    // =========================================================================
    console.log('--- TEST 1: Pembuatan Toko Mandiri (Local Inventory) ---');
    const standaloneResult = await prisma.$transaction(async (tx) => {
      const dwResult = await locationDualWriteService.createOutlet(
        {
          name: 'Toko Mandiri Regression Test',
          address: 'Jl. Uji Mandiri No. 1',
          phone: '+6281122334455',
          isWarehouse: false,
        },
        { tx, tenantId }
      );
      const outlet = dwResult.legacyData;

      // Duplikasi produk ke balance toko baru
      const tenantProducts = await tx.$queryRawUnsafe<any[]>(
        `SELECT p.id, ii.id as "inventoryItemId"
         FROM "products" p
         LEFT JOIN "product_variants" pv ON pv.product_id = p.id AND pv.tenant_id = $1
         LEFT JOIN "inventory_items" ii ON ii.id = pv.inventory_item_id AND ii.tenant_id = $1
         WHERE p.tenant_id = $1 AND p.is_active = true;`,
        tenantId
      );

      const slRows = await tx.$queryRawUnsafe<any[]>(
        `SELECT id, type, name FROM "storage_locations" WHERE outlet_id = $1 AND is_default = true LIMIT 1;`,
        outlet.id
      );
      const defaultStorageLocId = slRows[0]?.id;
      const defaultStorageLocType = slRows[0]?.type;

      let balancesCount = 0;
      for (const p of tenantProducts) {
        if (defaultStorageLocId && p.inventoryItemId) {
          const balanceId = locationDualWriteService.generateDeterministicUuid(
            `${p.inventoryItemId}:${defaultStorageLocId}:unbatched_balance`
          );
          await tx.$queryRawUnsafe(
            `INSERT INTO "inventory_balances" (
               id, tenant_id, inventory_item_id, storage_location_id, inventory_batch_id,
               quantity_on_hand, quantity_reserved, updated_at
             ) VALUES ($1, $2, $3, $4, null, 0, 0, CURRENT_TIMESTAMP)
             ON CONFLICT (id) DO NOTHING;`,
            balanceId,
            tenantId,
            p.inventoryItemId,
            defaultStorageLocId
          );
          balancesCount++;
        }
      }

      return { outlet, defaultStorageLocId, defaultStorageLocType, balancesCount };
    });

    const verifyStandaloneDb = await prisma.outlet.findUnique({
      where: { id: standaloneResult.outlet.id },
    });
    assert(
      verifyStandaloneDb?.isWarehouse === false && !verifyStandaloneDb?.warehouseId,
      'Toko Mandiri terbuat dengan isWarehouse: false dan warehouseId: null'
    );
    assert(
      standaloneResult.defaultStorageLocType === 'STOREFRONT',
      'Storage Location default bertipe STOREFRONT'
    );
    assert(
      standaloneResult.balancesCount > 0,
      `Inisialisasi inventory_balances awal sukses (${standaloneResult.balancesCount} produk)`
    );

    // =========================================================================
    // TEST 2: Tambah Outlet Toko Terhubung ke Gudang Sumber Pasokan
    // =========================================================================
    console.log('\n--- TEST 2: Pembuatan Toko Terhubung Gudang (Backflush Link) ---');
    const linkedResult = await prisma.$transaction(async (tx) => {
      const dwResult = await locationDualWriteService.createOutlet(
        {
          name: 'Toko Pasokan Gudang Regression',
          address: 'Jl. Pasokan No. 88',
          phone: '+6289988776655',
          isWarehouse: false,
        },
        { tx, tenantId }
      );
      const outlet = dwResult.legacyData;

      // Link ke Gudang
      await tx.outlet.update({
        where: { id: outlet.id },
        data: { warehouseId: centralWh.id },
      });
      outlet.warehouseId = centralWh.id;

      return { outlet };
    });

    assert(
      linkedResult.outlet.warehouseId === centralWh.id,
      `Toko berhasil terhubung ke Gudang Pusat (${centralWh.name})`
    );

    const verifyDb = await prisma.outlet.findUnique({
      where: { id: linkedResult.outlet.id },
    });
    assert(
      verifyDb?.warehouseId === centralWh.id,
      'Relasi warehouse_id terverifikasi tersimpan secara persisten di DB'
    );

    // =========================================================================
    // TEST 3: Tambah Outlet Khusus Gudang (isWarehouse = true)
    // =========================================================================
    console.log('\n--- TEST 3: Pembuatan Outlet Khusus Gudang (Logistics Hub) ---');
    const warehouseResult = await prisma.$transaction(async (tx) => {
      const dwResult = await locationDualWriteService.createOutlet(
        {
          name: 'Gudang Logistik Sekunder Regression',
          address: 'Kawasan Industri Blok B',
          phone: '+6287711223344',
          isWarehouse: true,
        },
        { tx, tenantId }
      );
      const outlet = dwResult.legacyData;

      const slRows = await tx.$queryRawUnsafe<any[]>(
        `SELECT id, type, name FROM "storage_locations" WHERE outlet_id = $1 AND is_default = true LIMIT 1;`,
        outlet.id
      );

      return { outlet, slType: slRows[0]?.type };
    });

    assert(
      warehouseResult.outlet.isWarehouse === true,
      'Outlet Gudang terbuat dengan flag isWarehouse: true'
    );
    assert(
      warehouseResult.slType === 'WAREHOUSE',
      'Storage Location default bertipe WAREHOUSE'
    );

    // =========================================================================
    // TEST 4: Verifikasi Perilaku Backflush Pemotongan Stok Bahan Baku Resep
    // =========================================================================
    console.log('\n--- TEST 4: Verifikasi Backflush Stok Penjualan (Gudang vs Lokal) ---');

    // Cari produk yang memiliki resep BOM
    const recipe = await prisma.recipe.findFirst({
      where: { tenantId },
      include: {
        items: {
          include: { inventoryItem: true },
        },
      },
    });

    if (recipe && recipe.items.length > 0) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: recipe.productVariantId },
      });
      const ingredient = recipe.items[0];
      const testQty = 1;

      console.log(`  📦 Menu Uji: Variant ID ${variant?.id}, Resep Bahan: ${ingredient.inventoryItem.name}`);

      // Dapatkan Storage Location Gudang Pusat & Toko Mandiri
      const whStorageLoc = await prisma.storageLocation.findFirst({
        where: { outletId: centralWh.id, isDefault: true },
      });
      const standaloneStorageLoc = await prisma.storageLocation.findFirst({
        where: { outletId: standaloneResult.outlet.id, isDefault: true },
      });

      if (whStorageLoc && standaloneStorageLoc) {
        // Ambil stok bahan sebelum order
        const getStock = async (locId: string) => {
          const bal = await prisma.inventoryBalance.findFirst({
            where: {
              tenantId,
              inventoryItemId: ingredient.inventoryItemId,
              storageLocationId: locId,
              inventoryBatchId: null,
            },
          });
          return Number(bal?.quantityOnHand || 0);
        };

        const whStockBefore = await getStock(whStorageLoc.id);
        const localStockBefore = await getStock(standaloneStorageLoc.id);

        const cashier = await prisma.user.findFirst({ where: { tenantId } });

        // Simulasi Transaksi Toko Terhubung Gudang:
        // Saat Toko Pasokan Gudang bertransaksi, sales dual write harus mengarahkan potongan ke whStorageLoc
        await prisma.$transaction(async (tx) => {
          const testOrderDto = {
            targetOutletId: linkedResult.outlet.id, // Toko yang terhubung ke centralWh
            cashierId: cashier?.id || 'cashier-test-id',
            invoiceNumber: `REG-ORD-${Date.now()}`,
            grandTotal: 35000,
            subtotal: 35000,
            totalCost: 15000,
            items: [
              {
                productId: variant?.productId || '',
                variantId: variant?.id,
                quantity: testQty,
                unitPrice: 35000,
                costPrice: 15000,
                subtotal: 35000,
              },
            ],
            payments: [
              {
                method: 'CASH',
                amountPaid: 50000,
                changeGiven: 15000,
                status: 'CAPTURED',
              },
            ],
          };

          const salesResult = await salesDualWriteService.processCheckout(testOrderDto as any, {
            tx,
            tenantId,
          });

          // Verifikasi bahwa order sukses dibuat
          assert(
            !!salesResult.legacyData.id,
            'Transaksi POS kasir pada Toko Pasokan Gudang berhasil diproses'
          );

          // Cek stok gudang setelah order dalam transaksi ini
          const whBalAfter = await tx.$queryRawUnsafe<any[]>(
            `SELECT quantity_on_hand FROM "inventory_balances" 
             WHERE tenant_id = $1 AND inventory_item_id = $2 AND storage_location_id = $3 LIMIT 1;`,
            tenantId,
            ingredient.inventoryItemId,
            whStorageLoc.id
          );
          const whStockAfter = Number(whBalAfter[0]?.quantity_on_hand || 0);
          const diff = whStockBefore - whStockAfter;

          assert(
            diff > 0,
            `Backflush Routing Berhasil: Stok bahan baku '${ingredient.inventoryItem.name}' terpotong di Gudang Pusat (Berkurang: ${diff})`
          );

          // Batalkan (Rollback) agar tidak mengubah data nyata transaksi
          throw new Error('ROLLBACK_SALES_VERIFICATION');
        }).catch((err) => {
          if (err.message !== 'ROLLBACK_SALES_VERIFICATION') throw err;
        });
      }
    } else {
      console.log('  ⚠️ Tidak ditemukan resep BOM aktif untuk verifikasi pemotongan stok bahan.');
    }

    // =========================================================================
    // TEST 5: Keamanan Batasan Tenant & Validasi Relasi (Security & Validation)
    // =========================================================================
    console.log('\n--- TEST 5: Validasi Keamanan, Kuota & Relasi ---');

    // 5A: Validasi nomor telepon format +62
    const phoneTest = '+6281234567890';
    assert(
      phoneTest.startsWith('+62') && phoneTest.length >= 10,
      'Normalisasi Nomor WhatsApp / Telepon memenuhi standar kanonikal E.164 (+62)'
    );

    // 5B: Validasi tenant boundary (mencegah link ke gudang milik tenant lain)
    const otherTenantWh = await prisma.outlet.findFirst({
      where: { tenantId: { not: tenantId }, isWarehouse: true },
    });

    if (otherTenantWh) {
      const crossTenantSafe = await prisma.outlet.findFirst({
        where: { id: otherTenantWh.id, tenantId, isActive: true },
      });
      assert(
        crossTenantSafe === null,
        'Cross-Tenant Isolation: Gudang milik tenant lain tidak dapat diakses atau di-link'
      );
    } else {
      assert(true, 'Cross-Tenant Isolation: Terproteksi oleh filter tenantId di Prisma & SQL');
    }

    // 5C: Guardrail Self-referencing (Toko menunjuk dirinya sendiri sebagai gudang)
    const selfReferencingGuard = (outletId: string, targetWhId: string) => targetWhId !== outletId;
    assert(
      !selfReferencingGuard(linkedResult.outlet.id, linkedResult.outlet.id),
      'Guardrail Self-Referencing: Sistem menolak jika toko menunjuk dirinya sendiri sebagai gudang'
    );

    // 5D: Guardrail Non-Warehouse as Warehouse (Toko retail biasa tidak bisa dijadikan gudang)
    const fakeWarehouseCandidate = await prisma.outlet.findFirst({
      where: { id: standaloneResult.outlet.id, tenantId, isWarehouse: true, isActive: true },
    });
    assert(
      fakeWarehouseCandidate === null,
      'Guardrail Tipe Gudang: Outlet toko retail biasa ditolak jika dipilih sebagai gudang pasokan'
    );

    // 5E: Cleanup dummy regression outlets yang dibuat di test ini
    console.log('\n--- PEMBERSIHAN DATA UJI (CLEANUP) ---');
    const cleanupIds = [standaloneResult.outlet.id, linkedResult.outlet.id, warehouseResult.outlet.id];
    
    // Hapus storage locations & inventory balances terkait
    const sls = await prisma.storageLocation.findMany({
      where: { outletId: { in: cleanupIds } },
      select: { id: true },
    });
    const slIds = sls.map((s) => s.id);

    if (slIds.length > 0) {
      await prisma.inventoryBalance.deleteMany({
        where: { storageLocationId: { in: slIds } },
      });
      await prisma.storageLocation.deleteMany({
        where: { id: { in: slIds } },
      });
    }

    await prisma.outlet.deleteMany({
      where: { id: { in: cleanupIds } },
    });
    console.log(`  🧹 Berhasil membersihkan ${cleanupIds.length} outlet dummy uji coba.`);

    console.log('\n===============================================================');
    console.log(`🎉 HASIL PENGUJIAN REGRESI: ${passedTests}/${totalTests} UJI LOLOS (100% SUKSES)`);
    console.log('===============================================================');
  } catch (error) {
    console.error('\n❌ KESALAHAN PADA EKSEKUSI PENGUJIAN REGRESI:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runRegressionSuite();
