import { chromium } from 'playwright';

async function run() {
  console.log('Launching browser with Chrome...');
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));
  page.on('response', (res) => {
    if (res.status() >= 400) console.log('HTTP ERROR:', res.status(), res.url());
  });

  console.log('Navigating to http://localhost:5173/#pos ...');
  await page.goto('http://localhost:5173/#pos');
  await page.waitForTimeout(1500);

  const ownerBtn = page.locator('button:has-text("Owner PRO")');
  try {
    if (await ownerBtn.isVisible({ timeout: 2000 })) {
      console.log('Logging in as Owner PRO...');
      await ownerBtn.click();
      await page.waitForTimeout(400);
      const submitBtn = page.locator('button[type="submit"]');
      await submitBtn.click();
      await page.waitForTimeout(2500);
    } else {
      console.log('Already logged in, skipping login form...');
    }
  } catch (e) {
    console.log('Already logged in, skipping login form...');
  }

  // Take screenshot of dashboard overview
  const artifactDir = '/Users/dendyaditya/.gemini/antigravity-ide/brain/dd774e89-db9f-45b0-9d8e-9cbed874cecb';
  await page.screenshot({ path: `${artifactDir}/dashboard_overview.png`, fullPage: false });
  console.log('Saved dashboard_overview.png');

  // Find and click 'Kelola Cabang' button
  const cabangBtn = page.locator('button:has-text("Kelola Cabang")').first();
  if (await cabangBtn.isVisible()) {
    console.log('Clicking Kelola Cabang button...');
    await cabangBtn.click();
    await page.waitForTimeout(1500);

    // Take screenshot showing only tax/service badges and on-demand button
    await page.screenshot({ path: `${artifactDir}/outlets_view_tax_only.png`, fullPage: false });
    console.log('Saved outlets_view_tax_only.png');

    const onDemandTooltipBtn = page.locator('button:has-text("On-Demand")').first();
    if (await onDemandTooltipBtn.isVisible()) {
      console.log('Clicking on-demand tooltip preview button...');
      await onDemandTooltipBtn.click();
      await page.waitForTimeout(500);
      const targetCard = page.locator('h3:has-text("Minimarket Maju Jaya - Cabang Pusat")').locator('xpath=ancestor::div[contains(@class, "rounded-3xl")][1]');
      await targetCard.screenshot({ path: `${artifactDir}/outlets_view_ondemand_tooltip.png` });
      console.log('Saved outlets_view_ondemand_tooltip.png');
    }
  } else {
    console.log('Kelola Cabang button not visible. Current URL:', page.url());
  }

  await browser.close();
  console.log('Test completed successfully!');
}

run().catch((err) => {
  console.error('Test script error:', err);
  process.exit(1);
});
