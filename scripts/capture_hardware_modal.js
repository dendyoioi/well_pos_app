// scripts/capture_hardware_modal.js
const { chromium } = require('../pos_apps/node_modules/playwright');
const path = require('path');

const targetDir = '/Users/dendyaditya/.gemini/antigravity/brain/bb1bff60-bee3-4061-a1ce-b7ba5801a3f8';

async function capture() {
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

  console.log('Navigating directly to ?tab=settings_receipt#dashboard...');
  await page.goto('http://localhost:5173/?tab=settings_receipt#dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Click "Pengaturan Lengkap & Otomasi" button
  console.log('Clicking "Pengaturan Lengkap & Otomasi"...');
  const modalTrigger = page.locator('button').filter({ hasText: /Pengaturan Lengkap & Otomasi/i }).first();
  if (await modalTrigger.isVisible({ timeout: 5000 }).catch(() => false)) {
    await modalTrigger.click();
    await page.waitForTimeout(800);

    // Switch to Tab 2: Printer Stiker Cup
    console.log('Switching to Tab 2: Printer Stiker Cup...');
    const cupTabBtn = page.getByRole('button', { name: /Printer Stiker Cup/i });
    if (await cupTabBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cupTabBtn.click();
      await page.waitForTimeout(600);
    }

    await page.screenshot({
      path: path.join(targetDir, '02_hardware_modal_cup_label.png'),
    });
    console.log('✅ Successfully captured 02_hardware_modal_cup_label.png');
  } else {
    console.log('Modal trigger button not found!');
  }

  await browser.close();
}

capture().catch(console.error);
