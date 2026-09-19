import { chromium } from 'playwright';
import path from 'path';

const outDir = '/Users/dendyaditya/.gemini/antigravity-ide/brain/dd774e89-db9f-45b0-9d8e-9cbed874cecb';

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173/#superadmin...');
  await page.goto('http://localhost:5173/#superadmin', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Check if we are on the login form or already logged in
  const isLoginForm = await page.locator('input[type="email"]').count();
  if (isLoginForm > 0) {
    await page.fill('input[type="email"]', 'superadmin@wellpos.id');
    await page.fill('input[type="password"]', 'superadmin123');
    await page.click('button:has-text("Masuk ke Portal Platform")');
    await page.waitForTimeout(1500);
  }

  // 1. Click "Setujui (Approve)" on the pending tenant
  const approveBtn = page.locator('button:has-text("Setujui (Approve)")').first();
  await approveBtn.click();
  await page.waitForTimeout(500);

  // Screenshot Custom Confirm Modal!
  await page.screenshot({ path: path.join(outDir, 'superadmin_custom_confirm_modal.png'), fullPage: false });
  console.log('Captured superadmin_custom_confirm_modal.png');

  // 2. Click "Ya, Setujui & Aktifkan PRO" inside the custom modal
  await page.click('button:has-text("Ya, Setujui & Aktifkan PRO")');
  await page.waitForTimeout(2000);

  // Screenshot After Approval (showing TRIAL 14H and success feedback banner)
  await page.screenshot({ path: path.join(outDir, 'superadmin_after_approval_success.png'), fullPage: false });
  console.log('Captured superadmin_after_approval_success.png');

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
