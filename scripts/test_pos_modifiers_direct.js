const { chromium } = require('playwright');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function run() {
  // 1. Get cashier or owner user and active outlet
  const user = await prisma.user.findFirst({
    where: { email: 'owner@uracoffee.id' },
    include: { outlet: true, tenant: true }
  });

  const outlet = await prisma.outlet.findFirst({
    where: { tenantId: user.tenantId }
  });

  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      outletId: outlet.id,
    },
    process.env.JWT_SECRET || 'wellpos_development_jwt_secret_key_12345',
    { expiresIn: '1d' }
  );

  const authUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    outletId: outlet.id,
    outlet: outlet,
    tenant: user.tenant
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Pre-seed localStorage before navigation
  await page.addInitScript(({ token, authUser, outlet }) => {
    localStorage.setItem('pos_auth_token', token);
    localStorage.setItem('pos_auth_user', JSON.stringify(authUser));
    localStorage.setItem('active_outlet_id', outlet.id);
  }, { token, authUser, outlet });

  console.log('Navigating directly to POS (?tab=pos#pos)...');
  await page.goto('http://localhost:5173/?tab=pos#pos', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // If Start Shift modal is open, open shift
  const startShiftBtn = page.locator('button:has-text("Buka Shift Sekarang"), button:has-text("Mulai Shift")');
  if (await startShiftBtn.count() > 0 && await startShiftBtn.isVisible()) {
    console.log('Opening shift...');
    const startCash = page.locator('input[type="number"], input[placeholder*="kas"], input[placeholder*="Kas"]').first();
    if (await startCash.count() > 0) {
      await startCash.fill('100000');
    }
    await startShiftBtn.click();
    await page.waitForTimeout(1500);
  }

  // Take screenshot of POS grid
  await page.screenshot({
    path: '/Users/dendyaditya/.gemini/antigravity-ide/brain/17dcc08e-4d93-40b6-83d5-be249665885d/.tempmediaStorage/pos_grid_before_click.png',
    fullPage: true
  });
  console.log('POS grid screenshot captured.');

  console.log('Searching for product with modifier...');
  const cardLocator = page.locator('div, button').filter({ hasText: 'Kopi Susu Aren Ura' }).last();
  await cardLocator.waitFor({ timeout: 5000 });

  console.log('Clicking product card...');
  await cardLocator.click();
  await page.waitForTimeout(1500);

  // Take screenshot of modifier modal
  const modalScreenshotPath = '/Users/dendyaditya/.gemini/antigravity-ide/brain/17dcc08e-4d93-40b6-83d5-be249665885d/.tempmediaStorage/pos_modifier_modal_open.png';
  await page.screenshot({ path: modalScreenshotPath, fullPage: true });
  console.log('Modal screenshot saved to:', modalScreenshotPath);

  const modalTitle = page.locator('text=Pilihan Ekstra & Susu, text=Kustomisasi');
  console.log('Modal elements found:', await modalTitle.count());

  await browser.close();
  await prisma.$disconnect();
}

run().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
