const { chromium } = require('../pos_apps/node_modules/playwright');
const path = require('path');

const artifactDir = '/Users/dendyaditya/.gemini/antigravity-ide/brain/31257e4b-7e59-4918-8f39-a77f6d9b7aae';

async function testResponsiveAkunSaya() {
  console.log('📱 Testing Mobile Responsive View for Akun Saya & Toolbar Filters...');
  const browser = await chromium.launch({ headless: true });

  try {
    // 1. Authenticate as Cashier Rian (to replicate exact user scenario)
    console.log('\n--- Step 1: Testing Cashier Mobile View (390x844 iPhone) ---');
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

    // Mobile Context (iPhone 12/13/14: 390 x 844)
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
    await mobilePage.evaluate(({ cashierUser, kemangOutletId }) => {
      localStorage.setItem('pos_auth_token', 'mock-token-cashier');
      localStorage.setItem('pos_auth_user', JSON.stringify(cashierUser));
      localStorage.setItem('pos_selected_outlet_id', kemangOutletId);
    }, { cashierUser, kemangOutletId });

    // Open Orders View in Dashboard
    await mobilePage.goto('http://localhost:5173/?tab=orders#dashboard', { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(1500);

    // Switch to Subtab: Rekap Item per Pembayaran (same as user screenshot)
    const rekapBtn = mobilePage.getByRole('button', { name: /Rekap Item per Pembayaran/i });
    if (await rekapBtn.isVisible()) {
      await rekapBtn.click();
      await mobilePage.waitForTimeout(1000);
    }

    // Capture Mobile Screenshot (iPhone 390px)
    const mobileScreenshotPath = path.join(artifactDir, 'responsive_akun_saya_mobile_fixed.png');
    await mobilePage.screenshot({ path: mobileScreenshotPath, fullPage: false });
    console.log(`📸 Mobile screenshot saved: ${mobileScreenshotPath}`);

    // Verify DOM: Check that Akun Saya badge is visible and NOT overflowing
    const akunBadge = mobilePage.locator('text=Akun Saya').first();
    const isBadgeVisible = await akunBadge.isVisible();
    console.log(`✅ Badge "Akun Saya" visible on mobile: ${isBadgeVisible}`);

    const badgeBox = await akunBadge.boundingBox();
    console.log('📍 Badge bounding box:', badgeBox);
    if (badgeBox) {
      console.log(`✅ Badge right boundary (${badgeBox.x + badgeBox.width}px) is within screen width (390px): ${badgeBox.x + badgeBox.width < 390}`);
    }

    await mobileContext.close();

    // 2. Desktop Context Verification
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
    await desktopPage.evaluate(({ cashierUser, kemangOutletId }) => {
      localStorage.setItem('pos_auth_token', 'mock-token-cashier');
      localStorage.setItem('pos_auth_user', JSON.stringify(cashierUser));
      localStorage.setItem('pos_selected_outlet_id', kemangOutletId);
    }, { cashierUser, kemangOutletId });

    await desktopPage.goto('http://localhost:5173/?tab=orders#dashboard', { waitUntil: 'networkidle' });
    await desktopPage.waitForTimeout(1500);

    const desktopRekapBtn = desktopPage.getByRole('button', { name: /Rekap Item per Pembayaran/i });
    if (await desktopRekapBtn.isVisible()) {
      await desktopRekapBtn.click();
      await desktopPage.waitForTimeout(1000);
    }

    const desktopScreenshotPath = path.join(artifactDir, 'responsive_akun_saya_desktop_fixed.png');
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

testResponsiveAkunSaya();
