import { chromium } from 'playwright';

async function run() {
  console.log('Launching browser with Chrome...');
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

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
      await page.waitForTimeout(2500);
    }
  } catch (e) {
    console.log('Already logged in, skipping login form...');
  }

  const artifactDir = '/Users/dendyaditya/.gemini/antigravity-ide/brain/dd774e89-db9f-45b0-9d8e-9cbed874cecb';

  // 1. Check Outlets View (Only retail stores, no warehouses)
  console.log('Navigating to Kelola Cabang...');
  const cabangNav = page.locator('button:has-text("Kelola Cabang"), button:has-text("Cabang")').first();
  if (await cabangNav.isVisible()) {
    await cabangNav.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${artifactDir}/outlets_view_retail_stores_only.png`, fullPage: false });
    console.log('Saved outlets_view_retail_stores_only.png');
  }

  // 2. Navigate to Inventori / Stok
  console.log('Navigating to Stok & Inventori...');
  const inventoryNav = page.locator('button:has-text("Stok"), button:has-text("Inventori")').first();
  if (await inventoryNav.isVisible()) {
    await inventoryNav.click();
    await page.waitForTimeout(1500);

    // Tab 1: Ringkasan & Kartu Stok
    await page.screenshot({ path: `${artifactDir}/inventory_tab_overview.png`, fullPage: false });
    console.log('Saved inventory_tab_overview.png');

    // Click Tab 2: Kelola Gudang & Lokasi Stok
    const warehouseTab = page.locator('button:has-text("Kelola Gudang & Lokasi Stok")');
    if (await warehouseTab.isVisible()) {
      console.log('Clicking Kelola Gudang & Lokasi Stok tab...');
      await warehouseTab.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${artifactDir}/inventory_tab_warehouses.png`, fullPage: false });
      console.log('Saved inventory_tab_warehouses.png');

      // Test Direct Action 1: + Terima PO Supplier
      const terimaPoBtn = page.locator('button:has-text("Terima PO Supplier")').first();
      if (await terimaPoBtn.isVisible()) {
        console.log('Clicking + Terima PO Supplier button on warehouse card...');
        await terimaPoBtn.click();
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${artifactDir}/warehouse_action_terima_po_modal.png`, fullPage: false });
        console.log('Saved warehouse_action_terima_po_modal.png');

        // Close modal
        const closeBtn = page.locator('button:has-text("Batal")').first();
        if (await closeBtn.isVisible()) await closeBtn.click();
        await page.waitForTimeout(500);
      }

      // Test Direct Action 2: ⇄ Kirim ke Cabang
      const kirimCabangBtn = page.locator('button:has-text("Kirim ke Cabang")').first();
      if (await kirimCabangBtn.isVisible()) {
        console.log('Clicking ⇄ Kirim ke Cabang button on warehouse card...');
        await kirimCabangBtn.click();
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${artifactDir}/warehouse_action_kirim_cabang_modal.png`, fullPage: false });
        console.log('Saved warehouse_action_kirim_cabang_modal.png');

        // Close modal
        const closeBtn2 = page.locator('button:has-text("Batal")').first();
        if (await closeBtn2.isVisible()) await closeBtn2.click();
        await page.waitForTimeout(500);
      }

      // Test "+ Tambah Gudang Baru" modal
      const tambahGudangBtn = page.locator('button:has-text("Tambah Gudang Baru")').first();
      if (await tambahGudangBtn.isVisible()) {
        console.log('Clicking + Tambah Gudang Baru button...');
        await tambahGudangBtn.click();
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${artifactDir}/warehouse_create_modal.png`, fullPage: false });
        console.log('Saved warehouse_create_modal.png');
      }
    }
  }

  await browser.close();
  console.log('Browser test completed successfully.');
}

run().catch(console.error);
