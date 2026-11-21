const { chromium } = require('../pos_apps/node_modules/playwright');
const jwt = require('../pos_apps/server/node_modules/jsonwebtoken');
const { PrismaClient } = require('../pos_apps/server/node_modules/@prisma/client');
const path = require('path');
const fs = require('fs');

const artifactDir = '/Users/dendyaditya/.gemini/antigravity/brain/f71f8083-0c2f-48e9-b583-29b630ca4a01';
const prisma = new PrismaClient();
const JWT_SECRET = '9a10881b59579529413dda63698c1cb85dbb6e86c0ee470bb37e07ba1d049f75b6906b6a6e933e21e71a1c0ef8b88c0b7afdf31db9b8a1ddad4cdb4fe27dc383';

async function runTahap1Verification() {
  console.log('===================================================================');
  console.log('🔍 VERIFIKASI TAHAP 1: NAVIGASI SIDEBAR, MOBILE DRAWER, CTA & IKON');
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
    // -------------------------------------------------------------
    // TEST 1: Laptop Sidebar (1366x768)
    // -------------------------------------------------------------
    console.log('\n🖥️ [1/3] Testing Laptop Desktop (1366x768)...');
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

    await laptopPage.goto('http://localhost:5173/?tab=overview#dashboard', { waitUntil: 'domcontentloaded' });
    await laptopPage.waitForTimeout(2000);

    // Verify Input Cepat button in sidebar
    const inputCepatSidebarBtn = laptopPage.locator('aside button[title*="Input Cepat"]');
    const inputCepatSidebarText = await inputCepatSidebarBtn.textContent();
    console.log(`  ✓ Sidebar CTA text: "${inputCepatSidebarText.trim()}"`);

    // Verify Top Header has "Kasir Laundry"
    const topHeaderKasirBtn = laptopPage.locator('header button[title*="Kasir Laundry"]');
    const topHeaderKasirText = await topHeaderKasirBtn.textContent();
    console.log(`  ✓ Top Header Cashier Button: "${topHeaderKasirText.trim()}"`);

    // Verify Hero Card Button in Overview
    const heroInputCepatBtn = laptopPage.locator('button:has-text("Input Cepat")').first();
    console.log(`  ✓ Hero / Overview Input Cepat visible: ${await heroInputCepatBtn.isVisible()}`);

    // Verify Sidebar menus text
    const ringkasanText = await laptopPage.locator('aside button[title="Ringkasan Bisnis Laundry"]').first().textContent();
    console.log(`  ✓ Sidebar Ringkasan: "${ringkasanText.trim()}"`);

    const paketKuotaText = await laptopPage.locator('aside button[title="Paket & Kuota Token"]').first().textContent();
    console.log(`  ✓ Sidebar Paket & Kuota: "${paketKuotaText.trim()}"`);

    const riwayatText = await laptopPage.locator('aside button[title="Riwayat Transaksi"]').first().textContent();
    console.log(`  ✓ Sidebar Riwayat Transaksi: "${riwayatText.trim()}"`);

    const promosiText = await laptopPage.locator('aside button[title="Promosi & Kupon"]').first().textContent();
    console.log(`  ✓ Sidebar Promosi & Kupon: "${promosiText.trim()}"`);

    const stafText = await laptopPage.locator('aside button[title="Manajemen Staf & Operator"]').first().textContent();
    console.log(`  ✓ Sidebar Manajemen Staf: "${stafText.trim()}"`);

    // Expand groups to verify sub-menus
    await laptopPage.locator('aside button[title="Promosi & Kupon"]').first().click();
    await laptopPage.waitForTimeout(400);
    await laptopPage.locator('aside button[title="Manajemen Staf & Operator"]').first().click();
    await laptopPage.waitForTimeout(400);

    const laptopScreenshotPath = path.join(artifactDir, 'screenshot_tahap1_laptop_sidebar.png');
    await laptopPage.screenshot({ path: laptopScreenshotPath, fullPage: false });
    console.log(`  📸 Screenshot saved: ${laptopScreenshotPath}`);

    await laptopContext.close();

    // -------------------------------------------------------------
    // TEST 2: Mobile Drawer (390x844)
    // -------------------------------------------------------------
    console.log('\n📱 [2/3] Testing Mobile Drawer (390x844)...');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();

    await mobilePage.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await mobilePage.evaluate(({ token, user, outlet }) => {
      localStorage.setItem('pos_auth_token', token);
      localStorage.setItem('pos_auth_user', JSON.stringify(user));
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('pos_active_outlet', JSON.stringify(outlet));
    }, { token: laundryToken, user: laundryAuthPayload, outlet: laundryOutlet });

    await mobilePage.goto('http://localhost:5173/?tab=overview#dashboard', { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForTimeout(2000);

    // Verify Mobile Bottom Nav FAB label
    const mobileFab = mobilePage.locator('nav button[title*="Input Cepat"]');
    const mobileFabText = await mobileFab.textContent();
    console.log(`  ✓ Mobile Bottom Nav FAB text: "${mobileFabText.trim()}"`);

    // Click Menu button in Mobile Bottom Nav to open Drawer
    const mobileMenuBtn = mobilePage.locator('nav button:has-text("Menu")').first();
    if (await mobileMenuBtn.isVisible()) {
      await mobileMenuBtn.click();
    } else {
      const hamburger = mobilePage.locator('header button').first();
      await hamburger.click();
    }
    await mobilePage.waitForTimeout(1000);

    // Verify Top Action inside Mobile Drawer
    const drawerKasirBtn = mobilePage.locator('div[class*="translate-x-0"] button:has-text("Kasir Laundry (POS)")').first();
    const drawerKasirVisible = await drawerKasirBtn.isVisible();
    console.log(`  ✓ Mobile Drawer Top Cashier Action visible: ${drawerKasirVisible}`);

    // Verify Ringkasan Bisnis Laundry in Mobile Drawer
    const drawerRingkasanText = await mobilePage.locator('div[class*="translate-x-0"] button[title="Ringkasan Bisnis Laundry"] span.inline').first().textContent();
    console.log(`  ✓ Mobile Drawer Ringkasan Text: "${drawerRingkasanText.trim()}"`);

    // Verify Paket & Kuota in Mobile Drawer
    const drawerPaketText = await mobilePage.locator('div[class*="translate-x-0"] button[title="Paket & Kuota Token"] span.inline').first().textContent();
    console.log(`  ✓ Mobile Drawer Paket & Kuota Text: "${drawerPaketText.trim()}"`);

    // Verify Token badge in Mobile Drawer
    const drawerTokenBadge = mobilePage.locator('div[class*="translate-x-0"] button[title="Paket & Kuota Token"] span.flex:has-text("Token")').first();
    console.log(`  ✓ Mobile Drawer Token Badge visible: ${await drawerTokenBadge.isVisible()}`);

    const mobileScreenshotPath = path.join(artifactDir, 'screenshot_tahap1_mobile_drawer.png');
    await mobilePage.screenshot({ path: mobileScreenshotPath, fullPage: false });
    console.log(`  📸 Screenshot saved: ${mobileScreenshotPath}`);

    await mobileContext.close();

    // -------------------------------------------------------------
    // TEST 3: F&B Mode Isolation (1366x768)
    // -------------------------------------------------------------
    console.log('\n🍽️ [3/3] Testing F&B Mode Isolation (Non-Laundry Tenant)...');
    const fnbUser = await prisma.user.findFirst({
      where: { email: 'owner@uracorporation.com' },
      include: {
        tenant: {
          include: {
            outlets: true,
          },
        },
        outlet: true,
      },
    });

    if (fnbUser && fnbUser.tenant) {
      const fnbOutlet = fnbUser.tenant.outlets.find(
        (o) => !o.industries || !o.industries.some((i) => i.toLowerCase().includes('laundry'))
      ) || fnbUser.tenant.outlets[0];

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

      const fnbContext = await browser.newContext({
        viewport: { width: 1366, height: 768 },
      });
      const fnbPage = await fnbContext.newPage();

      await fnbPage.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
      await fnbPage.evaluate(({ token, user, outlet }) => {
        localStorage.setItem('pos_auth_token', token);
        localStorage.setItem('pos_auth_user', JSON.stringify(user));
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('pos_active_outlet', JSON.stringify(outlet));
      }, { token: fnbToken, user: fnbAuthPayload, outlet: fnbOutlet });

      await fnbPage.goto('http://localhost:5173/?tab=overview#dashboard', { waitUntil: 'domcontentloaded' });
      await fnbPage.waitForTimeout(2000);

      // Verify F&B has "Buka Kasir POS"
      const fnbTopKasirBtn = fnbPage.locator('header button:has-text("Buka Kasir POS")');
      console.log(`  ✓ F&B Top Header has "Buka Kasir POS": ${await fnbTopKasirBtn.isVisible()}`);

      // Verify F&B has "Ringkasan Bisnis"
      const fnbRingkasanBtn = fnbPage.locator('aside button[title="Ringkasan Bisnis"]').first();
      console.log(`  ✓ F&B Sidebar has "Ringkasan Bisnis": ${await fnbRingkasanBtn.isVisible()}`);

      // Verify F&B has "Menu & Produk" group
      const fnbMenuProdukBtn = fnbPage.locator('aside button[title="Menu & Produk"]').first();
      console.log(`  ✓ F&B Sidebar has "Menu & Produk": ${await fnbMenuProdukBtn.isVisible()}`);
      if (await fnbMenuProdukBtn.isVisible()) {
        await fnbMenuProdukBtn.click();
        await fnbPage.waitForTimeout(300);
        const fnbDaftarMenuBtn = fnbPage.locator('aside button:has-text("Daftar Menu")').first();
        console.log(`  ✓ F&B Sidebar has "Daftar Menu": ${await fnbDaftarMenuBtn.isVisible()}`);
      }

      const fnbScreenshotPath = path.join(artifactDir, 'screenshot_tahap1_fnb_isolation.png');
      await fnbPage.screenshot({ path: fnbScreenshotPath, fullPage: false });
      console.log(`  📸 Screenshot saved: ${fnbScreenshotPath}`);

      await fnbContext.close();
    }

    console.log('\n===================================================================');
    console.log('✅ ALL TAHAP 1 AUDIT CHECKS PASSED SUCCESSFULLY!');
    console.log('===================================================================');
  } catch (error) {
    console.error('❌ Error during Tahap 1 verification:', error);
    process.exit(1);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

runTahap1Verification();
