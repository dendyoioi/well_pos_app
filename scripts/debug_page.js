const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:5173/#superadmin', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Click default superadmin and then submit
  await page.click('button:has-text("Gunakan Akun Default Superadmin")');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Masuk ke Portal Platform")');
  await page.waitForTimeout(2000);

  const screenshotPath = '/Users/dendyaditya/.gemini/antigravity-ide/brain/1ca03e93-2b75-45a8-a75b-cea5c4e38d27/debug_screen_after_login.png';
  await page.screenshot({ path: screenshotPath });
  console.log('Saved debug screenshot after login to:', screenshotPath);

  const buttons = await page.locator('button').allTextContents();
  console.log('Buttons on page after login:', buttons.slice(0, 15));

  await browser.close();
})();
