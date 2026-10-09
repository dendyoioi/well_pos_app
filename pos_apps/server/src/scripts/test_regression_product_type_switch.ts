import { PrismaClient } from '@prisma/client';
import { catalogDualWriteService } from '../services/dual_write';
import { catalogReadAdapter } from '../services/read_adapters/catalog.read_adapter';

const prisma = new PrismaClient();

async function runRegressionProductTypeSwitch() {
  console.log('===================================================================');
  console.log('🧪 REGRESSION TEST: Konversi Tipe Produk (F&B Composite <-> Ritel Fisik)');
  console.log('===================================================================');

  // 1. Ambil kategori yang ada beserta outlet dari tenant terkait
  const category = await prisma.category.findFirst({
    include: {
      tenant: {
        include: {
          outlets: {
            where: { isActive: true },
          },
        },
      },
    },
  });

  if (!category || !category.tenant?.outlets?.[0]) {
    console.error('❌ Tidak ada kategori dan outlet yang cocok ditemukan di database');
    process.exit(1);
  }

  const outlet = category.tenant.outlets[0];

  const testSuffix = Date.now().toString().slice(-5);
  const testName = `Menu Test Kopi ${testSuffix}`;
  const testSku = `KOP-${testSuffix}`;
  const testBarcode = `899${Math.floor(1000000000 + Math.random() * 9000000000)}`;

  console.log(`\n▶️ STEP 1: Buat Produk Baru bertipe Olahan F&B (Made-to-Order / COMPOSITE)`);
  console.log(`   Nama: ${testName}, SKU: ${testSku}`);

  const createResult = await prisma.$transaction(async (tx) => {
    return await catalogDualWriteService.createProduct(
      {
        name: testName,
        sku: testSku,
        barcode: testBarcode,
        categoryId: category.id,
        costPrice: 5000,
        basePrice: 18000,
        unit: 'Cup',
        description: JSON.stringify({ text: 'Kopi susu gula aren racikan barista', hasStock: false }),
        initialStock: 0,
        minStockAlert: 5,
        outletId: outlet.id,
        productType: 'COMPOSITE',
        hasStock: false,
      },
      { tx, tenantId: outlet.tenantId }
    );
  });

  const productId = createResult.legacyData.id;
  console.log(`   ✅ Produk berhasil dibuat dengan ID: ${productId}`);

  // Verifikasi Step 1 via catalogReadAdapter
  const read1 = await catalogReadAdapter.getProductById(outlet.tenantId, productId, outlet.id);
  if (!read1) {
    console.error('❌ Gagal membaca produk dari read adapter');
    process.exit(1);
  }

  console.log(`   🔍 Verifikasi Step 1 DTO:`);
  console.log(`      productType: ${read1.productType}`);
  console.log(`      hasStock: ${read1.hasStock}`);
  console.log(`      stock (read adapter display): ${read1.stock}`);

  if (read1.productType !== 'COMPOSITE') {
    throw new Error(`Expected productType to be COMPOSITE, got: ${read1.productType}`);
  }
  if (read1.hasStock !== false) {
    throw new Error(`Expected hasStock to be false, got: ${read1.hasStock}`);
  }
  console.log('   ✅ STEP 1 LULUS: Produk terdaftar sebagai COMPOSITE / Olahan F&B (hasStock: false)');

  // 2. Transisi: Edit dari Olahan F&B ke Barang Ritel Fisik
  console.log(`\n▶️ STEP 2: Edit Produk beralih dari Olahan F&B ke Barang Ritel Fisik (STANDARD)`);
  console.log(`   Menetapkan stok fisik riil toko: 35 Unit`);

  await prisma.$transaction(async (tx) => {
    await catalogDualWriteService.updateProduct(
      productId,
      {
        name: `${testName} (Kemasan Botol)`,
        basePrice: 22000,
        description: 'Kopi susu kemasan botol siap minum di etalase',
        productType: 'STANDARD',
        hasStock: true,
        currentStock: 35,
        outletId: outlet.id,
      },
      { tx, tenantId: outlet.tenantId }
    );
  });

  // Verifikasi Step 2 via DB langsung
  const dbProd = await prisma.product.findUnique({
    where: { id: productId },
    select: { type: true },
  });
  console.log(`   🔍 Kolom products.type di Database: ${dbProd?.type}`);
  if (dbProd?.type !== 'STANDARD') {
    throw new Error(`Expected DB products.type to be STANDARD, got: ${dbProd?.type}`);
  }

  // Verifikasi Step 2 via read adapter
  const read2 = await catalogReadAdapter.getProductById(outlet.tenantId, productId, outlet.id);
  if (!read2) {
    console.error('❌ Gagal membaca produk setelah update Step 2');
    process.exit(1);
  }

  console.log(`   🔍 Verifikasi Step 2 DTO:`);
  console.log(`      productType: ${read2.productType}`);
  console.log(`      hasStock: ${read2.hasStock}`);
  console.log(`      outlet_stock fisik: ${read2.stock}`);

  if (read2.productType !== 'STANDARD') {
    throw new Error(`Expected productType to be STANDARD, got: ${read2.productType}`);
  }
  if (read2.hasStock !== true) {
    throw new Error(`Expected hasStock to be true, got: ${read2.hasStock}`);
  }
  if (read2.stock !== 35) {
    throw new Error(`Expected real stock to be 35, got: ${read2.stock}`);
  }
  console.log('   ✅ STEP 2 LULUS: Produk berhasil beralih ke Ritel Fisik dengan stok riil 35 Unit (bukan 999.999)!');

  // 3. Transisi Balik: Edit dari Ritel Fisik kembali ke Olahan F&B
  console.log(`\n▶️ STEP 3: Edit Produk beralih kembali dari Ritel Fisik ke Olahan F&B (COMPOSITE)`);

  await prisma.$transaction(async (tx) => {
    await catalogDualWriteService.updateProduct(
      productId,
      {
        productType: 'COMPOSITE',
        hasStock: false,
        description: JSON.stringify({ text: 'Kembali menjadi menu olahan dapur barista', hasStock: false }),
        outletId: outlet.id,
      },
      { tx, tenantId: outlet.tenantId }
    );
  });

  const read3 = await catalogReadAdapter.getProductById(outlet.tenantId, productId, outlet.id);
  if (!read3) {
    console.error('❌ Gagal membaca produk setelah update Step 3');
    process.exit(1);
  }

  console.log(`   🔍 Verifikasi Step 3 DTO:`);
  console.log(`      productType: ${read3.productType}`);
  console.log(`      hasStock: ${read3.hasStock}`);

  if (read3.productType !== 'COMPOSITE') {
    throw new Error(`Expected productType to be COMPOSITE, got: ${read3.productType}`);
  }
  if (read3.hasStock !== false) {
    throw new Error(`Expected hasStock to be false, got: ${read3.hasStock}`);
  }
  console.log('   ✅ STEP 3 LULUS: Produk berhasil beralih kembali ke Olahan F&B (hasStock: false)');

  // Cleanup produk test
  await prisma.outletProduct.deleteMany({ where: { productId } });
  await prisma.productVariant.deleteMany({ where: { productId } });
  await prisma.product.delete({ where: { id: productId } });
  console.log(`\n🧹 Cleanup data uji selesai.`);

  console.log('\n===================================================================');
  console.log('🎉 REGRESSION TEST SELESAI: 100% SUKSES!');
  console.log('===================================================================');
}

runRegressionProductTypeSwitch()
  .catch((err) => {
    console.error('\n❌ REGRESSION TEST GAGAL:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
