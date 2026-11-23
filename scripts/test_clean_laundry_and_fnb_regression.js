const { chromium } = require('../pos_apps/node_modules/playwright');
const path = require('path');

async function run() {
  console.log('========================================================================');
  console.log('🧪 VERIFIKASI AKHIR: ELIMINASI FITUR YATIM & ZERO REGRESSION F&B/RETAIL');
  console.log('========================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // -------------------------------------------------------------------------
  // 1. LAUNDRY INVENTORY: VERIFIKASI HANYA BAHAN CUCI & PARFUM
  // -------------------------------------------------------------------------
  console.log('▶️ 1. Memeriksa Inventori Mode Laundry (owner.laundry@wellpos.id)...');
  await page.goto('http://localhost:5173/#login', { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto('http://localhost:5173/#login', { waitUntil: 'networkidle' });

  await page.locator('button:has-text("Portal Pemilik")').first().click();
  await page.locator('input[type="email"]').first().fill('owner.laundry@wellpos.id');
  await page.locator('input[type="password"]').first().fill('pastiwell789');
  await page.locator('button:has-text("Masuk ke Portal Pemilik")').first().click();
  await page.waitForTimeout(3000);

  await page.goto('http://localhost:5173/?tab=inventory', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const laundryBody = await page.locator('body').innerText();
  const hasBahanCuci = laundryBody.includes('Bahan Cuci & Parfum');
  const retailTabCount = await page.locator('button:has-text("Produk Retail")').count();
  const addProductCount = await page.locator('button:has-text("Tambah Produk Baru")').count();
  const addIngredientCount = await page.locator('button:has-text("Tambah Bahan Cuci Baru")').count();

  console.log('   • Tab Bahan Cuci & Parfum tampil     :', hasBahanCuci ? 'YA (PASS)' : 'TIDAK (FAIL)');
  console.log('   • Tab Produk Retail tersembunyi      :', retailTabCount === 0 ? 'YA (PASS - 0 tab)' : 'FAIL');
  console.log('   • Tombol Tambah Produk Baru disembunyikan:', addProductCount === 0 ? 'YA (PASS - 0 button)' : 'FAIL');
  console.log('   • Tombol Tambah Bahan Cuci Baru tampil :', addIngredientCount > 0 ? 'YA (PASS)' : 'FAIL');

  if (!hasBahanCuci || retailTabCount !== 0 || addProductCount !== 0 || addIngredientCount === 0) {
    throw new Error('Verifikasi Inventori Laundry GAGAL: Masih ada tab/tombol produk retail!');
  }

  const ssLaundryInv = path.resolve(process.env.HOME, '.gemini/antigravity/brain/f71f8083-0c2f-48e9-b583-29b630ca4a01/screenshot_laundry_clean_inventory.png');
  await page.screenshot({ path: ssLaundryInv, fullPage: false });
  console.log('   📸 Screenshot tersimpan di screenshot_laundry_clean_inventory.png');
  console.log('   ✅ [PASS 1] Inventori Mode Laundry Bersih 100% dari Residu Retail/F&B\n');

  // -------------------------------------------------------------------------
  // 2. LAUNDRY RECEIPT SETTINGS: TAG PRODUKSI KERANJANG
  // -------------------------------------------------------------------------
  console.log('▶️ 2. Memeriksa Pratinjau Tag Produksi di Pengaturan Struk Laundry...');
  await page.goto('http://localhost:5173/?tab=settings_receipt', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const checkboxes = page.locator('input[type="checkbox"]');
  const count = await checkboxes.count();
  await checkboxes.nth(count - 1).check({ force: true });
  await page.waitForTimeout(1200);

  const receiptBody = await page.locator('body').innerText();
  const hasTagKeranjang = receiptBody.includes('Tag Keranjang') || receiptBody.includes('TAG KERANJANG');
  const hasCuciKeringSetrika = receiptBody.includes('CUCI KERING SETRIKA');
  const hasEspressoResidue = receiptBody.includes('Espresso') || receiptBody.includes('Boba') || receiptBody.includes('Gelas kertas');

  console.log('   • Pratinjau Tag Keranjang aktif      :', hasTagKeranjang ? 'YA (PASS)' : 'FAIL');
  console.log('   • Menampilkan CUCI KERING SETRIKA    :', hasCuciKeringSetrika ? 'YA (PASS)' : 'FAIL');
  console.log('   • Bebas dari residu kopi/espresso    :', !hasEspressoResidue ? 'YA (PASS - 0 residu)' : 'FAIL');

  if (!hasTagKeranjang || !hasCuciKeringSetrika || hasEspressoResidue) {
    throw new Error('Verifikasi Tag Produksi Laundry GAGAL: Masih ada residu F&B!');
  }

  const ssLaundryReceipt = path.resolve(process.env.HOME, '.gemini/antigravity/brain/f71f8083-0c2f-48e9-b583-29b630ca4a01/screenshot_laundry_clean_receipt_tag.png');
  await page.screenshot({ path: ssLaundryReceipt, fullPage: false });
  console.log('   📸 Screenshot tersimpan di screenshot_laundry_clean_receipt_tag.png');
  console.log('   ✅ [PASS 2] Tag Produksi Laundry Bersih 100% dari Residu F&B\n');

  // -------------------------------------------------------------------------
  // 3. F&B MODE ANTI-REGRESSION: SEMUA FITUR F&B TETAP UTUH
  // -------------------------------------------------------------------------
  console.log('▶️ 3. Memeriksa Mode F&B / Retail (Anti-Regresi: owner@uracoffee.id)...');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto('http://localhost:5173/#login', { waitUntil: 'networkidle' });

  await page.locator('button:has-text("Portal Pemilik")').first().click();
  await page.locator('input[type="email"]').first().fill('owner@uracoffee.id');
  await page.locator('input[type="password"]').first().fill('Owner123!');
  await page.locator('button:has-text("Masuk ke Portal Pemilik")').first().click();
  await page.waitForTimeout(3000);

  await page.goto('http://localhost:5173/?tab=inventory', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const fnbBody = await page.locator('body').innerText();
  const fnbHasBahanBaku = fnbBody.includes('Bahan Baku Mentah');
  const fnbHasProdukJadi = fnbBody.includes('Produk Jadi (Retail)');

  console.log('   • F&B Tab Bahan Baku Mentah tampil   :', fnbHasBahanBaku ? 'YA (PASS)' : 'FAIL');
  console.log('   • F&B Tab Produk Jadi (Retail) tampil:', fnbHasProdukJadi ? 'YA (PASS)' : 'FAIL');

  // Klik tab Produk Jadi (Retail)
  await page.locator('button:has-text("Produk Jadi (Retail)")').first().click();
  await page.waitForTimeout(1000);

  const fnbAddProductBtn = page.locator('button:has-text("Tambah Produk Baru")').first();
  const fnbHasTambahProduk = await fnbAddProductBtn.count();
  console.log('   • F&B Tombol Tambah Produk Baru aktif:', fnbHasTambahProduk > 0 ? 'YA (PASS)' : 'FAIL');

  // Buka Modal Tambah Produk Baru di F&B
  await fnbAddProductBtn.click();
  await page.waitForTimeout(1000);

  // Pastikan Tab Varian & Bundling tampil di F&B Modal
  const modalBody = await page.locator('.fixed.inset-0').innerText();
  const hasBundlingTab = modalBody.includes('Varian & Bundling');
  const hasFnbRecipeTab = modalBody.includes('Resep & Topping');

  console.log('   • Modal Produk F&B: Tab Varian & Bundling tampil:', hasBundlingTab ? 'YA (PASS)' : 'FAIL');
  console.log('   • Modal Produk F&B: Tab Resep & Topping tampil  :', hasFnbRecipeTab ? 'YA (PASS)' : 'FAIL');

  // Cek Tab Foto Produk Preset Chips
  await page.locator('.fixed.inset-0 button:has-text("Foto Produk")').first().click();
  await page.waitForTimeout(800);
  const photoTabBody = await page.locator('.fixed.inset-0').innerText();
  const hasPresetCoffee = photoTabBody.includes('Kopi') || photoTabBody.includes('Boba');
  console.log('   • Modal Produk F&B: Preset Foto Makanan/Minuman tampil:', hasPresetCoffee ? 'YA (PASS)' : 'FAIL');

  if (!fnbHasBahanBaku || !fnbHasProdukJadi || fnbHasTambahProduk === 0 || !hasBundlingTab || !hasFnbRecipeTab || !hasPresetCoffee) {
    throw new Error('Anti-Regresi F&B GAGAL: Ada fitur F&B yang terpengaruh!');
  }

  const ssFnbInv = path.resolve(process.env.HOME, '.gemini/antigravity/brain/f71f8083-0c2f-48e9-b583-29b630ca4a01/screenshot_fnb_intact_inventory.png');
  await page.screenshot({ path: ssFnbInv, fullPage: false });
  console.log('   📸 Screenshot tersimpan di screenshot_fnb_intact_inventory.png');
  console.log('   ✅ [PASS 3] Mode F&B / Retail 100% Normal & Berfungsi Utuh (Zero Regression)\n');

  await browser.close();
  console.log('========================================================================');
  console.log('🎉 SEMUA PENGUJIAN LULUS 100% (CLEAN LAUNDRY & ZERO REGRESSION F&B)');
  console.log('========================================================================\n');
}

run().catch(err => {
  console.error('\n❌ PENGUJIAN GAGAL:', err);
  process.exit(1);
});
