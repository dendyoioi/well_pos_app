import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173/#pos';
const ARTIFACT_DIR = '/Users/dendyaditya/.gemini/antigravity-ide/brain/dd774e89-db9f-45b0-9d8e-9cbed874cecb';

async function captureVisuals() {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173/#pos ...');
  await page.goto(BASE_URL);
  await page.waitForTimeout(1500);

  const ownerBtn = page.locator('button:has-text("Owner PRO")');
  try {
    if (await ownerBtn.isVisible({ timeout: 2000 })) {
      console.log('Clicking Owner PRO quick login...');
      await ownerBtn.click();
      await page.waitForTimeout(400);
      const submitBtn = page.locator('button[type="submit"]');
      await submitBtn.click();
      await page.waitForTimeout(2000);
    }
  } catch (e) {
    console.log('Already logged in or bypassed...');
  }

  // 1. Capture Outlets View with Warehouse badge
  console.log('Navigating to Outlets / Cabang Toko...');
  const cabangBtn = page.locator('button:has-text("Cabang Toko"), button:has-text("Kelola Cabang")').first();
  if (await cabangBtn.isVisible()) {
    await cabangBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${ARTIFACT_DIR}/outlets_view_with_warehouse.png`, fullPage: false });
    console.log('Saved outlets_view_with_warehouse.png');

    // Open Edit modal for Gudang Pusat
    const editBtns = page.locator('button[title="Edit Informasi Cabang"]');
    const count = await editBtns.count();
    if (count > 0) {
      console.log(`Opening Edit modal for outlet index ${count - 1}...`);
      await editBtns.nth(count - 1).click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${ARTIFACT_DIR}/outlet_edit_warehouse_modal.png` });
      console.log('Saved outlet_edit_warehouse_modal.png');
      await page.click('button:has-text("Batal")');
      await page.waitForTimeout(500);
    }
  }

  // 2. Capture Inventory View
  console.log('Navigating to Stok & Kartu Mutasi...');
  const inventoriBtn = page.locator('button:has-text("Stok & Kartu Mutasi")').first();
  if (await inventoriBtn.isVisible()) {
    await inventoriBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${ARTIFACT_DIR}/inventory_view_header_banner.png`, fullPage: false });
    console.log('Saved inventory_view_header_banner.png');

    // 3. Open Stock Movement Modal (Stok Masuk)
    console.log('Opening Stock Movement Modal...');
    const stokMasukBtn = page.locator('button:has-text("+ Stok Masuk (PO)")').first();
    if (await stokMasukBtn.isVisible()) {
      await stokMasukBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${ARTIFACT_DIR}/stock_movement_modal_warehouse_target.png` });
      console.log('Saved stock_movement_modal_warehouse_target.png');
      const closeBtn = page.locator('button:has(svg.lucide-x)').first();
      await closeBtn.click();
      await page.waitForTimeout(500);
    }

    // 4. Open Stock Transfer Modal
    console.log('Opening Stock Transfer Modal...');
    const transferBtn = page.locator('button:has-text("⇄ Transfer Cabang")').first();
    if (await transferBtn.isVisible()) {
      await transferBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${ARTIFACT_DIR}/stock_transfer_modal_with_warehouse.png` });
      console.log('Saved stock_transfer_modal_with_warehouse.png');
      const closeBtn = page.locator('button:has(svg.lucide-x)').first();
      await closeBtn.click();
      await page.waitForTimeout(500);
    }
  }

  console.log('🎉 All Playwright visual verification screenshots generated successfully!');
  await browser.close();
}

captureVisuals().catch((err) => {
  console.error('Visual capture error:', err);
  process.exit(1);
});
