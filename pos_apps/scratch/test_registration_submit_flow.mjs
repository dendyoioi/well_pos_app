import { chromium } from 'playwright';
import path from 'path';

const outDir = '/Users/dendyaditya/.gemini/antigravity-ide/brain/dd774e89-db9f-45b0-9d8e-9cbed874cecb';

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173/#register...');
  await page.goto('http://localhost:5173/#register', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Fill in form with a unique email for testing
  const testEmail = `rian.test${Date.now()}@kopinusantara.id`;
  await page.fill('input[placeholder="Contoh: Kopi Nusantara Sejahtera"]', 'Kopi Nusantara Sejahtera');
  await page.fill('input[placeholder="Contoh: Rian Pratama"]', 'Rian Pratama');
  await page.fill('input[placeholder="rian@kopinusantara.id"]', testEmail);
  await page.fill('input[placeholder="081298765432"]', '081298765432');
  await page.fill('input[placeholder="Minimal 6 karakter"]', 'admin123');

  // Click Submit
  await page.click('button:has-text("Daftar & Ajukan Akun Klien Baru")');
  await page.waitForTimeout(1500);

  // Screenshot Pending Approval Confirmation Card
  await page.screenshot({ path: path.join(outDir, 'registration_success_pending_card.png'), fullPage: false });
  console.log('Captured registration_success_pending_card.png');

  // Now navigate to Super Admin to see the Pending Applicant!
  await page.goto('http://localhost:5173/#superadmin', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Login as superadmin
  await page.fill('input[type="email"]', 'superadmin@wellpos.id');
  await page.fill('input[type="password"]', 'superadmin123');
  await page.click('button:has-text("Masuk ke Portal Platform")');
  await page.waitForTimeout(1500);

  // Screenshot Super Admin Dashboard showing the Pending Approval count and table row
  await page.screenshot({ path: path.join(outDir, 'superadmin_pending_approval_table.png'), fullPage: false });
  console.log('Captured superadmin_pending_approval_table.png');

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
