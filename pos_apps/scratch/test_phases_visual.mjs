import { chromium } from 'playwright';

async function run() {
  console.log('Launching browser with Chrome for Phases 1-4 Visual Screenshots...');
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
    await page.waitForTimeout(1000);
  }

  // Switch to Toko PRO and Owner PRO
  const tokoProToggle = page.locator('button:has-text("Toko PRO")').first();
  if (await tokoProToggle.isVisible()) {
    await tokoProToggle.click();
    await page.waitForTimeout(500);
  }

  const ownerProBtn = page.locator('button:has-text("Owner PRO")').first();
  if (await ownerProBtn.isVisible()) {
    await ownerProBtn.click();
    await page.waitForTimeout(500);

    const masukBtn = page.locator('button:has-text("Masuk ke Mesin Kasir")').first();
    if (await masukBtn.isVisible()) {
      await masukBtn.click();
    }
  }

  await page.waitForTimeout(3000);

  // 1. Screenshot POS Terminal View with Product Images & Channel Selector
  const posTab = page.locator('button:has-text("Mesin Kasir (POS)")').first();
  if (await posTab.isVisible()) {
    await posTab.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${artifactDir}/pos_terminal_visual.png`, fullPage: false });
    console.log('Saved pos_terminal_visual.png');
  }

  // 2. Screenshot Orders View with Channel Badge & Export Buttons
  const ordersTab = page.locator('button:has-text("Riwayat Transaksi")').first();
  if (await ordersTab.isVisible()) {
    await ordersTab.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${artifactDir}/orders_view_visual.png`, fullPage: false });
    console.log('Saved orders_view_visual.png');
  }

  // 3. Screenshot Inventory View with Transfer Antar Cabang
  const inventoryTab = page.locator('button:has-text("Stok & Kartu Mutasi")').first();
  if (await inventoryTab.isVisible()) {
    await inventoryTab.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${artifactDir}/inventory_view_visual.png`, fullPage: false });
    console.log('Saved inventory_view_visual.png');

    // Open Transfer Modal
    const transferBtn = page.locator('button:has-text("Transfer Cabang")').first();
    if (await transferBtn.isVisible()) {
      await transferBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${artifactDir}/stock_transfer_modal.png`, fullPage: false });
      console.log('Saved stock_transfer_modal.png');
    }
  }

  await browser.close();
  console.log('All visual screenshots captured successfully!');
}

run().catch((err) => {
  console.error('Visual capture error:', err);
  process.exit(1);
});
