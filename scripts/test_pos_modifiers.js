const { chromium } = require('playwright');

async function testPosModifier() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('1. Navigating to login...');
  await page.goto('http://localhost:5173/#login');
  await page.waitForLoadState('networkidle');

  console.log('2. Switching to Portal Pemilik tab...');
  const ownerTabBtn = page.locator('button:has-text("Portal Pemilik")');
  await ownerTabBtn.waitFor({ timeout: 5000 });
  await ownerTabBtn.click();
  await page.waitForTimeout(500);

  console.log('3. Logging in as owner@uracoffee.id...');
  await page.locator('input[type="email"], input[placeholder*="email"]').fill('owner@uracoffee.id');
  await page.locator('input[type="password"]').fill('Owner123!');
  await page.locator('button:has-text("Masuk ke Portal Pemilik")').click();
  await page.waitForTimeout(2000);

  console.log('4. Waiting for dashboard navigation...');
  await page.waitForFunction(() => window.location.hash.includes('dashboard'), { timeout: 10000 });
  await page.waitForTimeout(1500);

  console.log('4. Clicking Buka Kasir POS in header...');
  const openPosBtn = page.locator('button:has-text("Buka Kasir POS"), a:has-text("Buka Kasir POS")');
  await openPosBtn.waitFor({ timeout: 5000 });
  await openPosBtn.click();
  await page.waitForTimeout(2000);

  // Check if start shift modal is open
  const startShiftBtn = page.locator('button:has-text("Buka Shift Sekarang"), button:has-text("Mulai Shift")');
  if (await startShiftBtn.count() > 0 && await startShiftBtn.isVisible()) {
    console.log('Opening shift...');
    const startCash = page.locator('input[type="number"], input[placeholder*="kas"], input[placeholder*="Kas"]').first();
    if (await startCash.count() > 0) {
      await startCash.fill('100000');
    }
    await startShiftBtn.click();
    await page.waitForTimeout(1000);
  }

  console.log('5. Waiting for product grid...');
  await page.screenshot({ path: '/Users/dendyaditya/.gemini/antigravity-ide/brain/17dcc08e-4d93-40b6-83d5-be249665885d/.tempmediaStorage/pos_terminal_ready.png', fullPage: true });

  const prodCard = page.locator('text=Kopi Susu Aren Ura, text=Americano Signature').first();
  await prodCard.waitFor({ timeout: 5000 });
  console.log('6. Clicking product with modifier...');
  await prodCard.click();
  await page.waitForTimeout(1000);

  const screenshotPath = '/Users/dendyaditya/.gemini/antigravity-ide/brain/17dcc08e-4d93-40b6-83d5-be249665885d/.tempmediaStorage/pos_modifier_modal_open.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Screenshot saved to:', screenshotPath);

  const modifierOption = page.locator('text=Extra Espresso Shot, text=Ganti Oat Milk, text=Pilihan Ekstra & Susu');
  console.log('Modifier options visible count:', await modifierOption.count());
  await page.waitForTimeout(1000);



  // Check if modal modifier is visible
  const modalHeader = page.locator('text=Pilihan Ekstra & Susu, text=Kustomisasi, text=Tambahan');
  const modalVisible = await modalHeader.count() > 0;
  console.log('Modifier modal visible count:', await modalHeader.count());

  await browser.close();
}

testPosModifier().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
