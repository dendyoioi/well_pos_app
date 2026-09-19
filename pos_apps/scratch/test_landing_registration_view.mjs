import { chromium } from 'playwright';
import path from 'path';

const outDir = '/Users/dendyaditya/.gemini/antigravity-ide/brain/dd774e89-db9f-45b0-9d8e-9cbed874cecb';

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Screenshot Landing Page Navbar & Hero
  await page.screenshot({ path: path.join(outDir, 'landing_page_updated_navbar.png'), fullPage: false });
  console.log('Captured landing_page_updated_navbar.png');

  // 2. Click "Daftar Akun Baru" button
  const daftarBtn = page.locator('button:has-text("Daftar Akun Baru")').first();
  await daftarBtn.click();
  await page.waitForTimeout(500);

  // Screenshot Registration Modal
  await page.screenshot({ path: path.join(outDir, 'registration_modal_clean_flow.png'), fullPage: false });
  console.log('Captured registration_modal_clean_flow.png');

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
