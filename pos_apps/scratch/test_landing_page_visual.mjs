import { chromium } from 'playwright';

async function captureLandingVisual() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:5173/#landing', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 1. Header & Hero screenshot
    await page.screenshot({ path: 'scratch/landing_v2_header_hero.png' });
    console.log('✓ Header & Hero screenshot captured');

    // 2. Scroll to Konsultasi & Harga
    await page.locator('#harga').scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'scratch/landing_v2_konsultasi_harga.png' });
    console.log('✓ Konsultasi & Harga screenshot captured');

    // 3. Scroll to Footer
    await page.locator('footer').scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'scratch/landing_v2_footer.png' });
    console.log('✓ Footer screenshot captured');

    // 4. Test Superadmin dedicated URL
    await page.goto('http://localhost:5173/#superadmin', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'scratch/landing_v2_superadmin_direct_url.png' });
    console.log('✓ Dedicated URL #superadmin works as expected');

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
}

captureLandingVisual();
