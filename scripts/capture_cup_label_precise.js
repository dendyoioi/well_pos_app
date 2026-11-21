// scripts/capture_cup_label_precise.js
const { chromium } = require('../pos_apps/node_modules/playwright');
const path = require('path');

const targetDir = '/Users/dendyaditya/.gemini/antigravity/brain/bb1bff60-bee3-4061-a1ce-b7ba5801a3f8';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  });
  const page = await context.newPage();

  const { LoginPage } = require('./pom/LoginPage');
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.loginOwner('owner@uracoffee.id', 'Owner123!');
  await page.waitForURL(/.*#(dashboard|pos|overview).*/, { timeout: 15000 });

  // 1. CAPTURE BACKOFFICE SECTION 8 & SIMULATOR
  console.log('1. Navigating to Format Struk & Printer (?tab=settings_receipt#dashboard)...');
  await page.goto('http://localhost:5173/?tab=settings_receipt#dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Scroll down to section 8
  await page.evaluate(() => {
    window.scrollTo(0, 700);
  });
  await page.waitForTimeout(600);

  const checkboxes = page.locator('input[type="checkbox"]');
  const count = await checkboxes.count();
  console.log(`Found ${count} checkboxes on page.`);
  if (count >= 4) {
    const cupToggle = checkboxes.nth(3);
    const isChecked = await cupToggle.isChecked();
    console.log(`Checkbox 4 isChecked: ${isChecked}`);
    if (!isChecked) {
      await cupToggle.click({ force: true });
      await page.waitForTimeout(800);
    }
  }

  // Switch right simulator to "Stiker Cup" tab if available
  const stikerCupTabBtn = page.locator('button').filter({ hasText: /Stiker Cup/i }).first();
  if (await stikerCupTabBtn.isVisible().catch(() => false)) {
    await stikerCupTabBtn.click();
    await page.waitForTimeout(600);
  }

  // Save changes
  const saveBtn = page.getByRole('button', { name: /Simpan Format Struk/i }).first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    await page.waitForTimeout(1500);
  }

  await page.screenshot({
    path: path.join(targetDir, '01_backoffice_cup_label_settings.png'),
  });
  console.log('✅ Captured 01_backoffice_cup_label_settings.png');

  // 2. OPEN POS TERMINAL
  console.log('2. Opening POS Terminal via top header button...');
  const bukaKasirBtn = page.locator('a, button').filter({ hasText: /Buka Kasir POS/i }).first();
  if (await bukaKasirBtn.isVisible().catch(() => false)) {
    await bukaKasirBtn.click();
    await page.waitForTimeout(2000);
  }

  // Check if we need to start shift
  const confirmShiftBtn = page.getByRole('button', { name: /Konfirmasi Buka Shift|Buka Shift/i });
  if (await confirmShiftBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await confirmShiftBtn.click();
    await page.waitForTimeout(1000);
  }

  // 3. CAPTURE POS CART WITH COFFEE ITEM
  console.log('3. Adding coffee item to cart in POS...');
  const coffeeItem = page.locator('button, div').filter({ hasText: /Kopi Susu Aren/i }).first();
  if (await coffeeItem.isVisible({ timeout: 3000 }).catch(() => false)) {
    await coffeeItem.click();
    await page.waitForTimeout(600);
    await coffeeItem.click().catch(() => {});
    await page.waitForTimeout(600);
  }

  await page.screenshot({
    path: path.join(targetDir, '03_pos_cashier_order_cart.png'),
  });
  console.log('✅ Captured 03_pos_cashier_order_cart.png');

  // 4. CHECKOUT AND CAPTURE ORDER SUCCESS MODAL
  console.log('4. Checking out order in POS...');
  const bayarBtn = page.locator('button').filter({ hasText: /Bayar \(Rp/i }).first();
  if (await bayarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await bayarBtn.click();
    await page.waitForTimeout(1000);

    const cashBtn = page.getByRole('button', { name: /Tunai|CASH/i }).first();
    if (await cashBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cashBtn.click();
      await page.waitForTimeout(500);
    }

    const uangPasBtn = page.getByRole('button', { name: /Uang Pas/i }).first();
    if (await uangPasBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await uangPasBtn.click();
      await page.waitForTimeout(500);
    }

    const submitPayBtn = page.getByRole('button', { name: /Proses Bayar|Selesaikan/i }).first();
    if (await submitPayBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitPayBtn.click();
      await page.waitForTimeout(2000);
    }

    // Modal success is now open
    await page.waitForSelector('.has-receipt-modal, text=Cetak Stiker Label', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1200);

    await page.screenshot({
      path: path.join(targetDir, '04_order_success_cup_label_button.png'),
    });
    console.log('✅ Captured 04_order_success_cup_label_button.png');
  }

  await browser.close();
  console.log('🎉 Capture complete!');
}

run().catch(console.error);
