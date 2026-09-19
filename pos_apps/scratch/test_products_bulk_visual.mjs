import { chromium } from 'playwright';

async function run() {
  console.log('Launching browser with Chrome...');
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173/#pos ...');
  await page.goto('http://localhost:5173/#pos');
  await page.waitForTimeout(1500);

  const ownerBtn = page.locator('button:has-text("Owner PRO")');
  try {
    if (await ownerBtn.isVisible({ timeout: 2000 })) {
      console.log('Logging in as Owner PRO...');
      await ownerBtn.click();
      await page.waitForTimeout(300);
      const submitBtn = page.locator('button[type="submit"]');
      await submitBtn.click();
      await page.waitForTimeout(2500);
    }
  } catch (e) {
    console.log('Already logged in...');
  }

  const artifactDir = '/Users/dendyaditya/.gemini/antigravity-ide/brain/dd774e89-db9f-45b0-9d8e-9cbed874cecb';

  // 1. Klik tab Katalog Produk
  console.log('Navigating to Katalog Produk...');
  const productsTab = page.locator('button:has-text("Katalog Produk")').first();
  await productsTab.click();
  await page.waitForTimeout(1500);

  // Screenshot 1: Katalog Produk dengan Filter Status & Badges
  await page.screenshot({ path: `${artifactDir}/products_view_filters_and_status.png`, fullPage: false });
  console.log('Saved products_view_filters_and_status.png');

  // 2. Klik checkbox produk pertama
  console.log('Selecting products for bulk action...');
  const checkboxes = page.locator('tbody tr td button').filter({ has: page.locator('svg') });
  const count = await checkboxes.count();
  console.log('Found checkboxes count:', count);
  if (count > 0) {
    await checkboxes.first().click();
    await page.waitForTimeout(500);
  }

  // Screenshot 2: Floating Bulk Action Bar
  await page.screenshot({ path: `${artifactDir}/products_bulk_action_bar.png`, fullPage: false });
  console.log('Saved products_bulk_action_bar.png');

  // 3. Klik tombol Hapus di floating action bar -> Buka ConfirmModal
  console.log('Clicking Hapus in floating action bar...');
  const bulkDeleteBtn = page.locator('button:has-text("Hapus")').first();
  if (await bulkDeleteBtn.isVisible()) {
    await bulkDeleteBtn.click();
    await page.waitForTimeout(600);

    // Screenshot 3: Custom ConfirmModal Modern (Bukan Alert)
    await page.screenshot({ path: `${artifactDir}/products_custom_confirm_modal.png`, fullPage: false });
    console.log('Saved products_custom_confirm_modal.png');

    // Klik Batal
    const cancelBtn = page.locator('button:has-text("Batal")').last();
    await cancelBtn.click();
    await page.waitForTimeout(500);
  }

  // 4. Klik tombol Ubah Kategori di floating bar
  console.log('Clicking Ubah Kategori in floating bar...');
  const bulkCatBtn = page.locator('button:has-text("Ubah Kategori")').first();
  if (await bulkCatBtn.isVisible()) {
    await bulkCatBtn.click();
    await page.waitForTimeout(600);

    // Screenshot 4: Modal Ubah Kategori Massal
    await page.screenshot({ path: `${artifactDir}/products_bulk_change_category_modal.png`, fullPage: false });
    console.log('Saved products_bulk_change_category_modal.png');

    // Klik Batal
    const cancelModalBtn = page.locator('button:has-text("Batal")').last();
    await cancelModalBtn.click();
    await page.waitForTimeout(500);
  }

  // 5. Buka Modal Kategori Produk
  console.log('Opening Kategori Produk modal...');
  const catBtn = page.locator('button:has-text("Kategori Produk")').first();
  if (await catBtn.isVisible()) {
    await catBtn.click();
    await page.waitForTimeout(1000);

    // Screenshot 5: Category Modal dengan Accurate Count
    await page.screenshot({ path: `${artifactDir}/category_modal_accurate_counts.png`, fullPage: false });
    console.log('Saved category_modal_accurate_counts.png');

    // Klik icon trash pada salah satu kategori yang memiliki produk aktif
    const trashBtn = page.locator('button[title="Hapus Kategori"]').first();
    if (await trashBtn.isVisible()) {
      await trashBtn.click();
      await page.waitForTimeout(600);

      // Screenshot 6: ConfirmModal Hapus Kategori dengan Proteksi Produk Aktif
      await page.screenshot({ path: `${artifactDir}/category_delete_protection_confirm.png`, fullPage: false });
      console.log('Saved category_delete_protection_confirm.png');
    }
  }

  await browser.close();
  console.log('Visual test completed successfully!');
}

run().catch((err) => {
  console.error('Visual test failed:', err);
  process.exit(1);
});
