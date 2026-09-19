import { chromium } from 'playwright';

async function testFixes() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // 1. Periksa Halaman Mesin Kasir (#login)
    await page.goto('http://localhost:5173/#login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'scratch/fix1_login_header_cleaned.png' });
    console.log('✓ Screenshot fix1_login_header_cleaned.png captured');

    // 2. Periksa Halaman Superadmin (#superadmin)
    await page.goto('http://localhost:5173/#superadmin', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Login jika belum
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible()) {
      await emailInput.fill('superadmin@wellpos.id');
      await page.fill('input[type="password"]', 'superadmin123');
      await page.click('button:has-text("Masuk ke Portal Platform")');
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: 'scratch/fix2_superadmin_tenant_list.png' });
    console.log('✓ Screenshot fix2_superadmin_tenant_list.png captured');

    // 3. Uji Device Pairing dengan EMAIL (rudra@uracoffee.com)
    await page.goto('http://localhost:5173/#login', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    await page.fill('input[placeholder*="kopi-nusantara"]', 'rudra@uracoffee.com');
    await page.fill('input[placeholder*="••••••"]', '111111');
    await page.screenshot({ path: 'scratch/fix3_pairing_with_email.png' });

    await page.click('button:has-text("Hubungkan Mesin Kasir")');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'scratch/fix3_paired_success.png' });
    console.log('✓ Screenshot fix3_paired_success.png captured');

  } catch (err) {
    console.error('Error in testFixes:', err);
  } finally {
    await browser.close();
  }
}

testFixes();
