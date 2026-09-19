import { chromium } from 'playwright';

async function run() {
  console.log('Capturing Smart Delete confirmation with transaction history...');
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const artifactDir = '/Users/dendyaditya/.gemini/antigravity-ide/brain/dd774e89-db9f-45b0-9d8e-9cbed874cecb';

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

  const bukaMesinKasirBtn = page.locator('text=Buka Mesin Kasir').first();
  if (await bukaMesinKasirBtn.isVisible()) {
    await bukaMesinKasirBtn.click();
    await page.waitForTimeout(500);
  }

  // Switch to Toko PRO and Owner PRO
  const tokoProToggle = page.locator('button:has-text("Toko PRO")').first();
  if (await tokoProToggle.isVisible()) {
    await tokoProToggle.click();
    await page.waitForTimeout(300);
  }

  const ownerProBtn = page.locator('button:has-text("Owner PRO")').first();
  if (await ownerProBtn.isVisible()) {
    await ownerProBtn.click();
    await page.waitForTimeout(300);

    const masukBtn = page.locator('button:has-text("Masuk ke Mesin Kasir")').first();
    if (await masukBtn.isVisible()) {
      await masukBtn.click();
    }
  }

  await page.waitForTimeout(2000);

  // Default outlet is Menteng (Minimarket Maju Jaya - Cabang Pusat (Menteng))
  // Open Katalog Produk
  console.log('Navigating to Katalog Produk...');
  const katalogTab = page.locator('button:has-text("Katalog Produk")').first();
  await katalogTab.click();
  await page.waitForTimeout(1500);

  // Click delete on Air Mineral 600ml
  console.log('Clicking delete on Air Mineral 600ml in Menteng...');
  const airMineralRow = page.locator('tr:has-text("Air Mineral 600ml")');
  const deleteBtn = airMineralRow.locator('button[title="Hapus / Nonaktifkan Produk"]').first();
  await deleteBtn.click();
  await page.waitForTimeout(1000);

  // Screenshot modal with transaction history warning
  const modalScreenshot = `${artifactDir}/smart_delete_with_tx_warning_modal.png`;
  await page.screenshot({ path: modalScreenshot, fullPage: false });
  console.log('📸 Modal screenshot with transaction warning saved to:', modalScreenshot);

  // Click Batal so Menteng data remains untouched
  const batalBtn = page.locator('button:has-text("Batal")').first();
  await batalBtn.click();
  await page.waitForTimeout(500);

  // Open "Ambil dari Katalog" modal in Cabang Tebet
  const outletSelect = page.locator('select').first();
  if (await outletSelect.isVisible()) {
    await outletSelect.selectOption({ label: '📍 Outlet Eskepyu - Cabang Tebet' });
    await page.waitForTimeout(1500);
  }

  const ambilKatalogBtn = page.locator('button:has-text("Ambil dari Katalog")').first();
  if (await ambilKatalogBtn.isVisible()) {
    await ambilKatalogBtn.click();
    await page.waitForTimeout(1000);

    const assignModalScreenshot = `${artifactDir}/assign_catalog_modal_populated.png`;
    await page.screenshot({ path: assignModalScreenshot, fullPage: false });
    console.log('📸 Populated Assign Catalog Modal saved to:', assignModalScreenshot);
  }

  await browser.close();
  console.log('Done!');
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
