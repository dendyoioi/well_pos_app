// scripts/capture_order_success_cup_label.js
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

  console.log('1. Navigating to POS Terminal (?tab=pos#dashboard)...');
  await page.goto('http://localhost:5173/?tab=pos#dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // If "Buka Shift" is present, open shift
  const bukaShiftBtn = page.getByRole('button', { name: /Buka Shift/i });
  if (await bukaShiftBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('Opening shift...');
    await bukaShiftBtn.click();
    await page.waitForTimeout(800);
    const submitBtn = page.getByRole('button', { name: /Konfirmasi Buka Shift/i });
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(1500);
    }
  }

  // Wait until "Shift Aktif" badge is visible
  await page.waitForSelector('text=Shift Aktif', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);

  // Click on Americano Signature or Caramel Macchiato
  console.log('2. Adding coffee (beverage) to cart...');
  const coffeeItem = page.locator('div, button').filter({ hasText: /Americano Signature|Caramel Macchiato/i }).first();
  await coffeeItem.scrollIntoViewIfNeeded();
  await coffeeItem.click();
  await page.waitForTimeout(800);
  await coffeeItem.click().catch(() => {});
  await page.waitForTimeout(800);

  // Wait for the Bayar button to become enabled
  console.log('3. Waiting for Bayar Langsung button to be enabled...');
  await page.waitForFunction(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Bayar Langsung'));
    return btn && !btn.disabled;
  }, { timeout: 8000 });

  const bayarBtn = page.locator('button:has-text("Bayar Langsung")');
  console.log('4. Clicking Bayar Langsung...');
  await bayarBtn.click();
  await page.waitForTimeout(1200);

  // Select Cash / Tunai
  console.log('5. Selecting Tunai & Uang Pas...');
  const tunaiBtn = page.locator('button').filter({ hasText: /Tunai/i }).first();
  if (await tunaiBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await tunaiBtn.click();
    await page.waitForTimeout(500);
  }

  const uangPasBtn = page.locator('button').filter({ hasText: /Uang Pas/i }).first();
  if (await uangPasBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await uangPasBtn.click();
    await page.waitForTimeout(500);
  }

  // Submit payment
  console.log('6. Submitting payment (Selesaikan & Cetak)...');
  const prosesBtn = page.locator('button').filter({ hasText: /Selesaikan & Cetak/i }).first();
  await prosesBtn.click();
  await page.waitForTimeout(2500);

  // Wait for OrderSuccessModal
  console.log('7. Waiting for OrderSuccessModal with cup label button...');
  await page.waitForSelector('.has-receipt-modal, #thermal-receipt-content', { timeout: 8000 });
  await page.waitForTimeout(1500);

  await page.screenshot({
    path: path.join(targetDir, '04_order_success_cup_label_button.png'),
  });
  console.log('✅ Captured 04_order_success_cup_label_button.png successfully!');

  await browser.close();
}

run().catch(console.error);
