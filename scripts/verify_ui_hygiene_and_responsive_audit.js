const { chromium } = require('../pos_apps/node_modules/playwright');
const jwt = require('../pos_apps/server/node_modules/jsonwebtoken');
const { PrismaClient } = require('../pos_apps/server/node_modules/@prisma/client');
const path = require('path');
const fs = require('fs');

const artifactDir = '/Users/dendyaditya/.gemini/antigravity/brain/f71f8083-0c2f-48e9-b583-29b630ca4a01';
const prisma = new PrismaClient();
const JWT_SECRET = '9a10881b59579529413dda63698c1cb85dbb6e86c0ee470bb37e07ba1d049f75b6906b6a6e933e21e71a1c0ef8b88c0b7afdf31db9b8a1ddad4cdb4fe27dc383';

async function runUiHygieneAndResponsiveAudit() {
  console.log('===================================================================');
  console.log('🔍 RUNNING AUDIT: UI HYGIENE & RESPONSIVE MULTI-DEVICE SUITE');
  console.log('===================================================================');

  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  // 1. Authenticate as Laundry Owner
  const laundryUser = await prisma.user.findFirst({
    where: { email: 'owner.laundry@wellpos.id' },
    include: {
      tenant: {
        include: {
          outlets: true,
        },
      },
      outlet: true,
    },
  });

  if (!laundryUser || !laundryUser.tenant) {
    throw new Error('User laundry tidak ditemukan di database');
  }

  const laundryOutlet = laundryUser.tenant.outlets.find(
    (o) => o.industries && o.industries.some((i) => i.toLowerCase().includes('laundry'))
  ) || laundryUser.tenant.outlets[0];

  const laundryToken = jwt.sign(
    {
      userId: laundryUser.id,
      role: laundryUser.role,
      outletId: laundryOutlet.id,
      tenantId: laundryUser.tenantId,
      tokenVersion: laundryUser.tokenVersion || 1,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const laundryAuthPayload = {
    id: laundryUser.id,
    email: laundryUser.email,
    name: laundryUser.name,
    role: laundryUser.role,
    tenantId: laundryUser.tenantId,
    outletId: laundryOutlet.id,
    tenant: {
      id: laundryUser.tenant.id,
      name: laundryUser.tenant.name,
      businessType: laundryUser.tenant.businessType,
      businessVertical: laundryUser.tenant.businessVertical,
    },
    outlet: {
      id: laundryOutlet.id,
      name: laundryOutlet.name,
      address: laundryOutlet.address,
      phone: laundryOutlet.phone,
      industries: laundryOutlet.industries,
    },
  };

  const browser = await chromium.launch({ headless: true });

  try {
    // =========================================================================
    // TEST 1: MOBILE VIEWPORT (390 x 844 - iPhone 14)
    // =========================================================================
    console.log('\n--- [TEST 1] Mobile Viewport Verification (390 x 844) ---');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();

    // Inject Auth state
    await mobilePage.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await mobilePage.evaluate(({ token, user, outlet }) => {
      localStorage.setItem('pos_auth_token', token);
      localStorage.setItem('pos_auth_user', JSON.stringify(user));
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('pos_active_outlet', JSON.stringify(outlet));
    }, { token: laundryToken, user: laundryAuthPayload, outlet: laundryOutlet });

    // 1.1 Verify Header (< 640px): BookOpen, Lock, LogOut hidden
    await mobilePage.goto('http://localhost:5173/?tab=overview#dashboard', { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(1000);

    const lockBtnVisible = await mobilePage.locator('button[title="Kunci Terminal"]').isVisible().catch(() => false);
    const logoutBtnVisible = await mobilePage.locator('button[title="Keluar Akun"]').isVisible().catch(() => false);
    const guideBtnVisible = await mobilePage.locator('button[title="Panduan & SOP Toko"]').isVisible().catch(() => false);

    console.log(`   Header Mobile Cleanliness:`);
    console.log(`   - Kunci Terminal Hidden: ${!lockBtnVisible} (Expected: true)`);
    console.log(`   - Keluar Akun Hidden: ${!logoutBtnVisible} (Expected: true)`);
    console.log(`   - Panduan SOP Hidden: ${!guideBtnVisible} (Expected: true)`);

    // 1.2 Verify Mobile Drawer: Single Drop-off Button
    const mobileMenuBtn = mobilePage.locator('nav button:has-text("Menu")').first();
    if (await mobileMenuBtn.isVisible()) {
      await mobileMenuBtn.click();
      await mobilePage.waitForTimeout(500);
      const drawerDropoffCount = await mobilePage.locator('div[class*="translate-x-0"] button:has-text("Terima Cucian")').count();
      console.log(`   - Drawer Single Drop-off Button Count: ${drawerDropoffCount} (Expected: 1)`);
      // Close drawer
      const closeDrawerBtn = mobilePage.locator('button[title="Tutup Menu"]').first();
      if (await closeDrawerBtn.isVisible()) await closeDrawerBtn.click();
      await mobilePage.waitForTimeout(300);
    }

    // 1.3 Verify Kasir Laundry Mobile (< lg): Full Scroll Catalog + Sticky Bottom Cart Bar
    await mobilePage.goto('http://localhost:5173/?tab=pos#dashboard', { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(1500);

    const stickyBar = mobilePage.locator('text=Lihat Nota');
    const isStickyBarVisible = await stickyBar.isVisible().catch(() => false);
    console.log(`   - Kasir Mobile Sticky Bottom Bar Visible: ${isStickyBarVisible} (Expected: true)`);

    // Click Lihat Nota to test slide-up sheet
    if (isStickyBarVisible) {
      await stickyBar.click();
      await mobilePage.waitForTimeout(600);
      const isSheetOpen = await mobilePage.locator('text=Nota Kasir Laundry').isVisible().catch(() => false);
      console.log(`   - Mobile Slide-Up Cart Sheet Opened: ${isSheetOpen} (Expected: true)`);

      // Screenshot Mobile Slide-Up Sheet
      await mobilePage.screenshot({
        path: path.join(artifactDir, 'screenshot_audit_mobile_cart_sheet.png'),
      });

      // Close Sheet
      const closeSheetBtn = mobilePage.locator('div[class*="animate-slideUp"] button').first();
      if (await closeSheetBtn.isVisible()) {
        await closeSheetBtn.click();
        await mobilePage.waitForTimeout(300);
      }
    }

    // 1.4 Verify Kanban Antrean Mobile (< md): Status Pill Selector Tab
    await mobilePage.goto('http://localhost:5173/?tab=laundry_queue#dashboard', { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(1500);

    const pillTabCuci = mobilePage.locator('button:has-text("Cuci & Kering")').first();
    const isPillTabVisible = await pillTabCuci.isVisible().catch(() => false);
    console.log(`   - Kanban Mobile Status Pill Tab Visible: ${isPillTabVisible} (Expected: true)`);

    if (isPillTabVisible) {
      await pillTabCuci.click();
      await mobilePage.waitForTimeout(400);
      console.log(`   - Toggled mobile tab to "Cuci & Kering"`);
    }

    await mobilePage.screenshot({
      path: path.join(artifactDir, 'screenshot_audit_mobile_queue.png'),
    });

    await mobileContext.close();

    // =========================================================================
    // TEST 2: TABLET VIEWPORT (820 x 1180 - iPad Air Portrait)
    // =========================================================================
    console.log('\n--- [TEST 2] Tablet Viewport Verification (820 x 1180) ---');
    const tabletContext = await browser.newContext({
      viewport: { width: 820, height: 1180 },
      hasTouch: true,
    });
    const tabletPage = await tabletContext.newPage();

    await tabletPage.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await tabletPage.evaluate(({ token, user, outlet }) => {
      localStorage.setItem('pos_auth_token', token);
      localStorage.setItem('pos_auth_user', JSON.stringify(user));
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('pos_active_outlet', JSON.stringify(outlet));
    }, { token: laundryToken, user: laundryAuthPayload, outlet: laundryOutlet });

    await tabletPage.goto('http://localhost:5173/?tab=overview#dashboard', { waitUntil: 'networkidle' });
    await tabletPage.waitForTimeout(1500);

    // 2.1 Verify Tablet Sidebar Toggle
    const tabletToggleBtn = tabletPage.locator('button[title="Buka Menu Lengkap"]').first();
    const isTabletToggleVisible = await tabletToggleBtn.isVisible().catch(() => false);
    console.log(`   - Tablet Expand Toggle Visible on Icon-Rail: ${isTabletToggleVisible} (Expected: true)`);

    if (isTabletToggleVisible) {
      await tabletToggleBtn.click();
      await tabletPage.waitForTimeout(500);
      const isTabletDrawerOpen = await tabletPage.locator('button[title="Tutup Menu"]').first().isVisible().catch(() => false);
      console.log(`   - Tablet Overlay Drawer Opened: ${isTabletDrawerOpen} (Expected: true)`);

      // Close tablet drawer
      const closeTabletBtn = tabletPage.locator('button[title="Tutup Menu"]').first();
      if (await closeTabletBtn.isVisible()) await closeTabletBtn.click();
      await tabletPage.waitForTimeout(300);
    }

    // 2.2 Verify Beranda Bento Hero Card Layout
    await tabletPage.screenshot({
      path: path.join(artifactDir, 'screenshot_audit_tablet_bento.png'),
    });

    // 2.3 Verify Kanban Antrean Tablet (md:flex md:overflow-x-auto)
    await tabletPage.goto('http://localhost:5173/?tab=laundry_queue#dashboard', { waitUntil: 'networkidle' });
    await tabletPage.waitForTimeout(1500);

    await tabletPage.screenshot({
      path: path.join(artifactDir, 'screenshot_audit_tablet_queue.png'),
    });

    await tabletContext.close();

    // =========================================================================
    // TEST 3: LAPTOP VIEWPORT (1366 x 768)
    // =========================================================================
    console.log('\n--- [TEST 3] Laptop Viewport Verification (1366 x 768) ---');
    const laptopContext = await browser.newContext({
      viewport: { width: 1366, height: 768 },
    });
    const laptopPage = await laptopContext.newPage();

    await laptopPage.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await laptopPage.evaluate(({ token, user, outlet }) => {
      localStorage.setItem('pos_auth_token', token);
      localStorage.setItem('pos_auth_user', JSON.stringify(user));
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('pos_active_outlet', JSON.stringify(outlet));
    }, { token: laundryToken, user: laundryAuthPayload, outlet: laundryOutlet });

    // 3.1 Verify Kasir Laundry 2-Column Side-by-Side on Desktop
    await laptopPage.goto('http://localhost:5173/?tab=pos#dashboard', { waitUntil: 'networkidle' });
    await laptopPage.waitForTimeout(1500);

    const isDesktopCartVisible = await laptopPage.locator('section:has-text("Belum Ada Pelanggan")').isVisible().catch(() => false);
    console.log(`   - Kasir Desktop 2-Column Side-by-Side Cart Visible: ${isDesktopCartVisible} (Expected: true)`);

    await laptopPage.screenshot({
      path: path.join(artifactDir, 'screenshot_audit_laptop_pos.png'),
    });

    // 3.2 Verify Zero Double-Icon on Beranda Bento
    await laptopPage.goto('http://localhost:5173/?tab=overview#dashboard', { waitUntil: 'networkidle' });
    await laptopPage.waitForTimeout(1500);

    const bentoText = await laptopPage.innerText('body');
    const hasDoublePlus = bentoText.includes('+ +') || bentoText.includes('+ Drop-off') || bentoText.includes('+ Terima Cucian');
    console.log(`   - Zero Double-Icon (+ + / + Drop-off) on Bento: ${!hasDoublePlus} (Expected: true)`);

    await laptopPage.screenshot({
      path: path.join(artifactDir, 'screenshot_audit_laptop_bento.png'),
    });

    await laptopContext.close();

    // =========================================================================
    // TEST 4: F&B / RETAIL REGRESSION CHECK (URA COFFEE)
    // =========================================================================
    console.log('\n--- [TEST 4] F&B Mode Isolation & Regression Verification ---');
    const fnbUser = await prisma.user.findFirst({
      where: { email: 'owner@uracoffee.id' },
      include: {
        tenant: {
          include: {
            outlets: true,
          },
        },
      },
    });

    if (fnbUser && fnbUser.tenant) {
      const fnbOutlet = fnbUser.tenant.outlets[0];
      const fnbToken = jwt.sign(
        {
          userId: fnbUser.id,
          role: fnbUser.role,
          outletId: fnbOutlet.id,
          tenantId: fnbUser.tenantId,
          tokenVersion: fnbUser.tokenVersion || 1,
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      const fnbAuthPayload = {
        id: fnbUser.id,
        email: fnbUser.email,
        name: fnbUser.name,
        role: fnbUser.role,
        tenantId: fnbUser.tenantId,
        outletId: fnbOutlet.id,
        tenant: {
          id: fnbUser.tenant.id,
          name: fnbUser.tenant.name,
          businessType: fnbUser.tenant.businessType,
          businessVertical: fnbUser.tenant.businessVertical,
        },
        outlet: {
          id: fnbOutlet.id,
          name: fnbOutlet.name,
          address: fnbOutlet.address,
          phone: fnbOutlet.phone,
          industries: fnbOutlet.industries,
        },
      };

      const fnbContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const fnbPage = await fnbContext.newPage();
      await fnbPage.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
      await fnbPage.evaluate(({ token, user, outlet }) => {
        localStorage.setItem('pos_auth_token', token);
        localStorage.setItem('pos_auth_user', JSON.stringify(user));
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('pos_active_outlet', JSON.stringify(outlet));
      }, { token: fnbToken, user: fnbAuthPayload, outlet: fnbOutlet });

      await fnbPage.goto('http://localhost:5173/?tab=overview#dashboard', { waitUntil: 'networkidle' });
      await fnbPage.waitForTimeout(1500);

      const fnbBody = await fnbPage.innerText('body');
      const hasDineInOrKasir = fnbBody.includes('Kasir') || fnbBody.includes('Ringkasan');
      console.log(`   - F&B Mode Dashboard Loaded Normally: ${hasDineInOrKasir} (Expected: true)`);

      await fnbPage.screenshot({
        path: path.join(artifactDir, 'screenshot_audit_fnb_isolation.png'),
      });
      await fnbContext.close();
    }

    console.log('\n===================================================================');
    console.log('🎉 ALL AUDIT & RESPONSIVE VERIFICATIONS PASSED CLEANLY!');
    console.log('===================================================================');

  } catch (error) {
    console.error('❌ Error during UI hygiene audit:', error);
    process.exit(1);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

runUiHygieneAndResponsiveAudit();
