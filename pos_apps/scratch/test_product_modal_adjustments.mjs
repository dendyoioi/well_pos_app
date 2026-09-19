import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = '/Users/dendyaditya/.gemini/antigravity-ide/brain/dd774e89-db9f-45b0-9d8e-9cbed874cecb';

async function run() {
  console.log('🚀 Launching Playwright browser to test ProductModal adjustments...');
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await context.newPage();

  // 1. Navigate to POS / Dashboard
  console.log('Navigating to http://localhost:5173/#pos ...');
  await page.goto('http://localhost:5173/#pos');
  await page.waitForTimeout(1500);

  const ownerBtn = page.locator('button:has-text("Owner PRO")');
  try {
    if (await ownerBtn.isVisible({ timeout: 2000 })) {
      console.log('Logging in as Owner PRO...');
      await ownerBtn.click();
      await page.waitForTimeout(400);
      const submitBtn = page.locator('button[type="submit"]');
      await submitBtn.click();
      await page.waitForTimeout(2000);
    }
  } catch (e) {
    console.log('Skipping login form...');
  }
  console.log('✅ In Dashboard / POS!');

  // 2. Navigate to Produk
  await page.click('button:has-text("Produk")');
  await page.waitForTimeout(1000);

  // 3. Open Tambah Produk Modal
  await page.click('button:has-text("Tambah Produk")');
  await page.waitForTimeout(1000);
  console.log('✅ ProductModal opened!');

  // 4. Test Satuan Unit (Search existing & Add Custom)
  // Click unit button
  await page.click('#product-unit-btn');
  await page.waitForTimeout(500);

  // Screenshot unit dropdown open
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'test_unit_dropdown_open.png') });

  // Type existing unit 'Mangkok' and select it
  const unitSearchInput = page.locator('input[placeholder="Cari atau ketik satuan baru..."]');
  await unitSearchInput.fill('Mangkok');
  await page.waitForTimeout(500);
  await page.locator('div[ref="unitDropdownRef"] button:has-text("Mangkok"), div.max-h-44 button:has-text("Mangkok")').first().click();
  await page.waitForTimeout(500);
  console.log('✅ Existing unit Mangkok selected!');

  // Open unit dropdown again and type truly custom unit 'Cangkir'
  await page.click('#product-unit-btn');
  await page.waitForTimeout(500);
  const unitSearchInput2 = page.locator('input[placeholder="Cari atau ketik satuan baru..."]');
  await unitSearchInput2.fill('Cangkir');
  await page.waitForTimeout(500);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'test_unit_custom_search.png') });

  // Click '+ Gunakan "Cangkir" sebagai satuan baru'
  await page.click('button:has-text("Gunakan \\"Cangkir\\" sebagai satuan baru")');
  await page.waitForTimeout(500);
  console.log('✅ Custom unit Cangkir added and selected!');

  // 5. Test Kategori Search
  await page.click('#product-category-btn');
  await page.waitForTimeout(500);

  const catSearchInput = page.locator('input[placeholder="Ketik untuk mencari kategori..."]');
  await catSearchInput.fill('Minum');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'test_category_search.png') });

  // Select the matching category if exists
  const catOption = page.locator('div.max-h-44 button').first();
  if (await catOption.isVisible()) {
    await catOption.click();
    await page.waitForTimeout(500);
    console.log('✅ Category selected from search!');
  }

  // 6. Test HPP and HPJ Auto Format
  // HPP input
  const hppInput = page.locator('#product-cost-price');
  await hppInput.fill('18500');
  await page.waitForTimeout(300);
  const hppValue = await hppInput.inputValue();
  console.log('HPP formatted value:', hppValue);

  // HPJ input
  const hpjInput = page.locator('#product-base-price');
  await hpjInput.fill('35000');
  await page.waitForTimeout(300);
  const hpjValue = await hpjInput.inputValue();
  console.log('HPJ formatted value:', hpjValue);

  // 7. Test Opsi Tanpa Stok
  // Default is "Ada Stok"
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'test_stock_ada_stok_default.png') });

  // Click "Tanpa Stok"
  await page.click('button:has-text("Tanpa Stok")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'test_stock_tanpa_stok_active.png') });
  console.log('✅ Tanpa Stok option toggled!');

  // 8. Test Modifiers Segmented Controls & PriceDelta Rupiah Auto-Format
  // Add Pedas template
  await page.click('button:has-text("+ Level Pedas")');
  await page.waitForTimeout(500);

  // Check modifier group controls
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'test_modifiers_segmented_controls.png') });

  // Click "Checkbox (Boleh Multi)"
  await page.click('button:has-text("Checkbox (Boleh Multi)")');
  await page.waitForTimeout(300);

  // Click "Opsional"
  await page.click('button:has-text("Opsional")');
  await page.waitForTimeout(300);

  // Test modifier option priceDelta auto format
  const priceDeltaInput = page.locator('div.w-40 input[type="text"]').last();
  await priceDeltaInput.fill('4500');
  await page.waitForTimeout(300);
  const deltaValue = await priceDeltaInput.inputValue();
  console.log('Modifier priceDelta formatted value:', deltaValue);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'test_product_modal_full_visual.png') });
  console.log('✅ All visual tests completed!');

  await browser.close();
}

run().catch((err) => {
  console.error('Error during test:', err);
  process.exit(1);
});
