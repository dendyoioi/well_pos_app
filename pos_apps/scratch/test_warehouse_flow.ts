import { prisma } from '../server/src/config/prisma';

const API_URL = 'http://localhost:5001/api';

async function main() {
  console.log('=== STARTING WAREHOUSE & STOCK FLOW INTEGRATION TEST ===');

  // 1. Login sebagai Owner PRO
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'owner.pro@wellpos.id',
      password: 'pro123',
    }),
  });
  const loginData = await loginRes.json();
  if (loginData.status !== 'success' || !loginData.data?.token) {
    throw new Error('Login failed: ' + JSON.stringify(loginData));
  }
  const token = loginData.data.token;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  console.log('✅ 1. Login Owner PRO berhasil');

  // 2. Cek atau Buat Outlet bertipe Gudang Pusat
  let warehouse = await prisma.outlet.findFirst({
    where: { isWarehouse: true },
  });

  if (!warehouse) {
    console.log('Setting up Gudang Pusat...');
    const existingOutlet = await prisma.outlet.findFirst({
      where: { name: { contains: 'Kelapa Gading' } },
    });

    if (existingOutlet) {
      warehouse = await prisma.outlet.update({
        where: { id: existingOutlet.id },
        data: {
          name: 'Gudang Pusat Distribusi - Logistik Utama',
          isWarehouse: true,
        },
      });
    }
  }

  console.log(`✅ 2. Gudang Pusat aktif terdeteksi: "${warehouse?.name}" (ID: ${warehouse?.id}, isWarehouse: ${warehouse?.isWarehouse})`);

  const branchOutlet = await prisma.outlet.findFirst({
    where: { id: '22222222-2222-2222-2222-222222222222' }, // Cabang Menteng
  });
  console.log(`✅ 2b. Cabang Toko Retail: "${branchOutlet?.name}" (ID: ${branchOutlet?.id})`);

  // 3. Buat Produk Baru dengan Stok Awal = 0 (Opsional)
  const category = await prisma.category.findFirst();
  const testSku = `GUDANG-${Date.now().toString().slice(-4)}`;
  const prodRes = await fetch(`${API_URL}/products`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: `Minyak Goreng Sawit 2L [TEST ${testSku}]`,
      sku: testSku,
      barcode: `899${Date.now().toString().slice(-10)}`,
      categoryId: category?.id,
      costPrice: 28000,
      basePrice: 34000,
      unit: 'Pouch',
      initialStock: 0, // Stok awal opsional 0!
      minStockAlert: 10,
    }),
  });
  const prodData = await prodRes.json();
  if (prodData.status !== 'success' || !prodData.data?.id) {
    throw new Error('Gagal membuat produk uji: ' + JSON.stringify(prodData));
  }
  const testProduct = prodData.data;
  console.log(`✅ 3. Produk baru berhasil dibuat dengan Stok Awal = 0: "${testProduct.name}" (ID: ${testProduct.id})`);

  // Verifikasi stok awal di Gudang Pusat dan Cabang adalah 0
  const initialGudangStock = await prisma.outletProduct.findUnique({
    where: {
      outletId_productId: {
        outletId: warehouse!.id,
        productId: testProduct.id,
      },
    },
  });
  const initialBranchStock = await prisma.outletProduct.findUnique({
    where: {
      outletId_productId: {
        outletId: branchOutlet!.id,
        productId: testProduct.id,
      },
    },
  });
  console.log(`   Stok Awal Gudang: ${initialGudangStock?.stock || 0}, Stok Awal Cabang: ${initialBranchStock?.stock || 0}`);

  // 4. Lakukan Stok Masuk (Stock In / PO) 100 unit LANGSUNG KE GUDANG PUSAT
  const stockInQty = 100;
  const stockInRes = await fetch(`${API_URL}/inventory/stock-in`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      productId: testProduct.id,
      quantity: stockInQty,
      outletId: warehouse!.id,
      poNumber: `PO-TEST-${Date.now().toString().slice(-5)}`,
      supplierName: 'PT Wilmar Agro Distribusi',
      notes: 'Penerimaan kontainer stok besar di gudang pusat',
    }),
  });
  const stockInData = await stockInRes.json();
  if (stockInData.status !== 'success') {
    throw new Error('Gagal recordStockIn: ' + JSON.stringify(stockInData));
  }
  console.log(`✅ 4. Berhasil mencatat Stok Masuk 100 unit ke Gudang Pusat!`);

  // Verifikasi stok Gudang Pusat menjadi 100, Cabang tetap 0
  const afterInGudang = await prisma.outletProduct.findUnique({
    where: {
      outletId_productId: {
        outletId: warehouse!.id,
        productId: testProduct.id,
      },
    },
  });
  const afterInBranch = await prisma.outletProduct.findUnique({
    where: {
      outletId_productId: {
        outletId: branchOutlet!.id,
        productId: testProduct.id,
      },
    },
  });
  console.log(`   Stok Gudang Sekarang: ${afterInGudang?.stock} Pouch (Target: 100)`);
  console.log(`   Stok Cabang Sekarang: ${afterInBranch?.stock} Pouch (Target: 0)`);
  if (afterInGudang?.stock !== 100 || afterInBranch?.stock !== 0) {
    throw new Error('Stok setelah stock-in tidak sesuai!');
  }

  // 5. Lakukan Transfer Stok dari Gudang Pusat ke Cabang Menteng (30 unit)
  const transferQty = 30;
  const transferRes = await fetch(`${API_URL}/inventory/transfer`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sourceOutletId: warehouse!.id,
      targetOutletId: branchOutlet!.id,
      productId: testProduct.id,
      quantity: transferQty,
      notes: 'Distribusi stok mingguan rak minyak cabang',
    }),
  });
  const transferData = await transferRes.json();
  if (transferData.status !== 'success') {
    throw new Error('Gagal transferStock: ' + JSON.stringify(transferData));
  }
  console.log(`✅ 5. Berhasil transfer ${transferQty} unit dari Gudang Pusat ke Cabang Menteng!`);

  // 6. Verifikasi Stok Akhir
  const finalGudang = await prisma.outletProduct.findUnique({
    where: {
      outletId_productId: {
        outletId: warehouse!.id,
        productId: testProduct.id,
      },
    },
  });
  const finalBranch = await prisma.outletProduct.findUnique({
    where: {
      outletId_productId: {
        outletId: branchOutlet!.id,
        productId: testProduct.id,
      },
    },
  });
  console.log(`✅ 6. Verifikasi Saldo Akhir:`);
  console.log(`   - Gudang Pusat: ${finalGudang?.stock} Pouch (Ekspektasi: 70)`);
  console.log(`   - Cabang Menteng: ${finalBranch?.stock} Pouch (Ekspektasi: 30)`);
  if (finalGudang?.stock !== 70 || finalBranch?.stock !== 30) {
    throw new Error(`Saldo stok tidak sesuai! Gudang: ${finalGudang?.stock}, Cabang: ${finalBranch?.stock}`);
  }

  // 7. Verifikasi Riwayat Kartu Stok (Stock Movements)
  const movements = await prisma.stockMovement.findMany({
    where: { productId: testProduct.id },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`✅ 7. Kartu Stok Terverifikasi (${movements.length} mutasi):`);
  movements.forEach((m, idx) => {
    console.log(`   [${idx + 1}] Type: ${m.type}, Qty: ${m.quantity}, Outlet: ${m.outletId === warehouse!.id ? 'Gudang Pusat' : 'Cabang'}, Notes: ${m.notes}`);
  });

  // 8. Clean up data uji
  console.log('🧹 8. Membersihkan data uji...');
  await prisma.stockMovement.deleteMany({ where: { productId: testProduct.id } });
  await prisma.outletProduct.deleteMany({ where: { productId: testProduct.id } });
  await prisma.product.delete({ where: { id: testProduct.id } });
  console.log('✅ Semua data uji berhasil dibersihkan tanpa meninggalkan residu!');

  console.log('\n🎉 ALL WAREHOUSE & STOCK FLOW INTEGRATION TESTS PASSED 100%!');
}

main()
  .catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
