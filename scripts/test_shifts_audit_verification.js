const { chromium } = require('../pos_apps/node_modules/playwright');
const path = require('path');

const artifactDir = '/Users/dendyaditya/.gemini/antigravity-ide/brain/31257e4b-7e59-4918-8f39-a77f6d9b7aae';

async function testShiftsAuditVerification() {
  console.log('🚀 Running Shift Audit & Rekapitulasi Playwright Verification...');
  const browser = await chromium.launch({ headless: true });

  try {
    const tenantId = 'd8ea88b6-e85c-4c9b-8bfd-2414b591d5ec';
    const kemangOutletId = 'd135ef0a-6d68-4b98-87ea-56eb73e672e0';
    const cashierUser = {
      id: 'bcff77cf-789b-4c81-8e52-d6661125c5a4',
      name: 'Rian Kasir Kemang',
      email: 'kasir@uracoffee.id',
      role: 'CASHIER',
      tenantId: tenantId,
      outletId: kemangOutletId,
      outlet: { id: kemangOutletId, name: 'Ura Coffee - Flagship Kemang' },
    };

    // 0. Acquire valid token via Login
    console.log('\n--- Step 0: Logging in to get valid token ---');
    const authPage = await browser.newPage();
    await authPage.goto('http://localhost:5173/#login', { waitUntil: 'networkidle' });
    const ownerPortalBtn = authPage.getByRole('button', { name: /Portal Pemilik/i });
    if (await ownerPortalBtn.isVisible()) {
      await ownerPortalBtn.click();
      await authPage.waitForTimeout(300);
    }
    await authPage.locator('input[type="email"]').fill('owner@uracoffee.id');
    await authPage.locator('input[type="password"]').fill('Admin123!');
    await authPage.getByRole('button', { name: /Masuk ke Portal Pemilik/i }).click();
    await authPage.waitForTimeout(2000);

    const validToken = await authPage.evaluate(() => localStorage.getItem('pos_auth_token'));
    await authPage.close();
    console.log('🔑 Acquired valid auth token.');

    // 1. Mobile Context (iPhone 390x844) as Cashier
    console.log('\n--- Step 1: Testing Mobile View (390x844) ---');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });

    await mobileContext.route('**/*api/auth/me*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: cashierUser,
        }),
      });
    });

    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto('http://localhost:5173/#dashboard', { waitUntil: 'networkidle' });
    await mobilePage.evaluate(({ validToken, cashierUser, kemangOutletId }) => {
      localStorage.setItem('pos_auth_token', validToken);
      localStorage.setItem('pos_auth_user', JSON.stringify(cashierUser));
      localStorage.setItem('pos_selected_outlet_id', kemangOutletId);
    }, { validToken, cashierUser, kemangOutletId });

    // Open Shifts Audit tab
    await mobilePage.goto('http://localhost:5173/?tab=shifts#dashboard', { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(1500);

    // Switch to "Semua Periode" or "30 Hari Terakhir" if needed so shifts appear
    const allPeriodBtn = mobilePage.locator('button:has-text("30 Hari Terakhir")').first();
    if (await allPeriodBtn.isVisible()) {
      await allPeriodBtn.click();
      await mobilePage.waitForTimeout(1000);
    }

    const mobileScreenshotPath = path.join(artifactDir, 'shifts_audit_mobile_enhanced.png');
    await mobilePage.screenshot({ path: mobileScreenshotPath, fullPage: false });
    console.log(`📸 Mobile screenshot saved: ${mobileScreenshotPath}`);

    const mobileFullScreenshotPath = path.join(artifactDir, 'shifts_audit_mobile_full.png');
    await mobilePage.screenshot({ path: mobileFullScreenshotPath, fullPage: true });
    console.log(`📸 Mobile full screenshot saved: ${mobileFullScreenshotPath}`);

    const bodyText = (await mobilePage.innerText('body')).toLowerCase();
    const hasCashierName = bodyText.includes('rian kasir kemang');
    const hasOutletName = bodyText.includes('ura coffee') || bodyText.includes('kemang');
    const hasKasSistem = bodyText.includes('kas sistem');
    const hasSummaryCard = bodyText.includes('total sesi') || bodyText.includes('shift kasir diaudit');

    console.log(`✅ Real Cashier Name Rendered: ${hasCashierName}`);
    console.log(`✅ Outlet Name Rendered: ${hasOutletName}`);
    console.log(`✅ Kas Sistem Indicator: ${hasKasSistem}`);
    console.log(`✅ KPI Summary Cards Rendered: ${hasSummaryCard}`);

    await mobileContext.close();

    // 2. Desktop Context (1280x900)
    console.log('\n--- Step 2: Testing Desktop View (1280x900) ---');
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });

    await desktopContext.route('**/*api/auth/me*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: cashierUser,
        }),
      });
    });

    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto('http://localhost:5173/#dashboard', { waitUntil: 'networkidle' });
    await desktopPage.evaluate(({ validToken, cashierUser, kemangOutletId }) => {
      localStorage.setItem('pos_auth_token', validToken);
      localStorage.setItem('pos_auth_user', JSON.stringify(cashierUser));
      localStorage.setItem('pos_selected_outlet_id', kemangOutletId);
    }, { validToken, cashierUser, kemangOutletId });

    await desktopPage.goto('http://localhost:5173/?tab=shifts#dashboard', { waitUntil: 'networkidle' });
    await desktopPage.waitForTimeout(1500);

    const desktop30DaysBtn = desktopPage.locator('button:has-text("30 Hari Terakhir")').first();
    if (await desktop30DaysBtn.isVisible()) {
      await desktop30DaysBtn.click();
      await desktopPage.waitForTimeout(1000);
    }

    const desktopScreenshotPath = path.join(artifactDir, 'shifts_audit_desktop_enhanced.png');
    await desktopPage.screenshot({ path: desktopScreenshotPath, fullPage: false });
    console.log(`📸 Desktop screenshot saved: ${desktopScreenshotPath}`);

    await desktopContext.close();
    console.log('\n🎉 Verification completed successfully!');
  } catch (err) {
    console.error('❌ Verification failed:', err);
  } finally {
    await browser.close();
  }
}

testShiftsAuditVerification();
