import { chromium } from 'playwright';

async function run() {
  console.log('Launching browser to verify Catalog Counts and Category Pills...');
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
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

  // Switch outlet to "Outlet Eskepyu - Cabang Tebet"
  console.log('Selecting Outlet Eskepyu - Cabang Tebet...');
  const outletSelect = page.locator('select').first();
  if (await outletSelect.isVisible()) {
    await outletSelect.selectOption({ label: '📍 Outlet Eskepyu - Cabang Tebet' });
    await page.waitForTimeout(1500);
  }

  // Click on "Katalog Produk" tab
  console.log('Navigating to Katalog Produk tab...');
  const katalogTab = page.locator('button:has-text("Katalog Produk")').first();
  if (await katalogTab.isVisible()) {
    await katalogTab.click();
    await page.waitForTimeout(1500);
  }

  // Get navbar badge text
  const navbarTabContent = await katalogTab.innerText();
  console.log('Navbar Tab Content:', navbarTabContent);

  // Take screenshot of Katalog Produk
  const screenshotPath = `${artifactDir}/catalog_counts_verified.png`;
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log('Saved screenshot to:', screenshotPath);

  // Check category buttons text
  const categoryPills = await page.locator('.flex.items-center.gap-2.overflow-x-auto button').allInnerTexts();
  console.log('Category Pills:', categoryPills);

  // Switch status filter to "Hanya Nonaktif"
  const nonaktifBtn = page.locator('button:has-text("Hanya Nonaktif")').first();
  if (await nonaktifBtn.isVisible()) {
    await nonaktifBtn.click();
    await page.waitForTimeout(1000);
    const nonaktifPills = await page.locator('.flex.items-center.gap-2.overflow-x-auto button').allInnerTexts();
    console.log('Category Pills on "Hanya Nonaktif":', nonaktifPills);
  }

  // Switch status filter to "Hanya Aktif"
  const aktifBtn = page.locator('button:has-text("Hanya Aktif")').first();
  if (await aktifBtn.isVisible()) {
    await aktifBtn.click();
    await page.waitForTimeout(1000);
    const aktifPills = await page.locator('.flex.items-center.gap-2.overflow-x-auto button').allInnerTexts();
    console.log('Category Pills on "Hanya Aktif":', aktifPills);
  }

  // Switch back to "Semua Status"
  const semuaStatusBtn = page.locator('button:has-text("Semua Status")').first();
  if (await semuaStatusBtn.isVisible()) {
    await semuaStatusBtn.click();
    await page.waitForTimeout(1000);
  }

  await browser.close();
  console.log('Visual test completed!');
}

run().catch((err) => {
  console.error('Visual verification error:', err);
  process.exit(1);
});
