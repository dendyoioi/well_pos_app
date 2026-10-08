const { chromium } = require('../pos_apps/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const artifactDir = '/Users/dendyaditya/.gemini/antigravity-ide/brain/31257e4b-7e59-4918-8f39-a77f6d9b7aae';

async function testAllRolesVisualRegression() {
  console.log('🚀 Starting Comprehensive Multi-Role Visual Regression Test...');
  const browser = await chromium.launch({ headless: true });

  const testResults = {
    owner: {},
    supervisor: {},
    cashierRian: {},
    cashierFajar: {},
    warehouse: {},
  };

  try {
    // 0. Login as Owner to get valid backend token and outlet info
    console.log('\n--- 0. Authenticating Session ---');
    const authContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const authPage = await authContext.newPage();
    await authPage.goto('http://localhost:5173/#login', { waitUntil: 'networkidle' });
    await authPage.waitForTimeout(500);

    const ownerPortalBtn = authPage.getByRole('button', { name: /Portal Pemilik/i });
    if (await ownerPortalBtn.isVisible()) {
      await ownerPortalBtn.click();
      await authPage.waitForTimeout(300);
    }

    await authPage.locator('input[type="email"]').fill('owner@uracoffee.id');
    await authPage.locator('input[type="password"]').fill('Admin123!');
    await authPage.getByRole('button', { name: /Masuk ke Portal Pemilik/i }).click();
    await authPage.waitForTimeout(2000);

    const sessionData = await authPage.evaluate(() => {
      return {
        token: localStorage.getItem('pos_auth_token'),
        user: JSON.parse(localStorage.getItem('pos_auth_user') || '{}'),
      };
    });
    console.log('🔑 Logged in successfully. Token acquired. Tenant ID:', sessionData.user?.tenantId);
    await authContext.close();

    const validToken = sessionData.token;
    const tenantId = sessionData.user?.tenantId || 'd8ea88b6-e85c-4c9b-8bfd-2414b591d5ec';
    const kemangOutletId = 'd135ef0a-6d68-4b98-87ea-56eb73e672e0';

    // ==========================================
    // 1. ROLE: OWNER (Dimas Prabowo)
    // ==========================================
    console.log('\n--- 1. Testing Role: OWNER (Dimas Prabowo) ---');
    const ownerContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const ownerPage = await ownerContext.newPage();

    await ownerPage.goto('http://localhost:5173/#dashboard', { waitUntil: 'networkidle' });
    await ownerPage.evaluate(({ validToken, sessionData }) => {
      localStorage.setItem('pos_auth_token', validToken);
      localStorage.setItem('pos_auth_user', JSON.stringify(sessionData.user));
    }, { validToken, sessionData });

    await ownerPage.goto('http://localhost:5173/?tab=orders#dashboard', { waitUntil: 'networkidle' });
    await ownerPage.waitForTimeout(1500);

    // Set filter "Semua Periode"
    const dateBtn = ownerPage.locator('button:has-text("Hari Ini")').first();
    if (await dateBtn.isVisible()) {
      await dateBtn.click();
      await ownerPage.waitForTimeout(400);
      const allPeriodBtn = ownerPage.locator('button:has-text("Semua Periode")').first();
      await allPeriodBtn.click();
      await ownerPage.waitForTimeout(1200);
    }

    const cashierSelectOwner = ownerPage.locator('select:has(option:has-text("Semua Kasir di Toko Ini"))').first();
    const ownerOptions = await cashierSelectOwner.evaluate((sel) => Array.from(sel.options).map((o) => o.text));
    console.log('📋 Owner Dropdown Options:', ownerOptions);

    testResults.owner.options = ownerOptions;
    testResults.owner.hasCashiersOnly =
      ownerOptions.some((o) => o.includes('Rian')) &&
      ownerOptions.some((o) => o.includes('Fajar')) &&
      ownerOptions.some((o) => o.includes('Siti')) &&
      !ownerOptions.some((o) => o.toLowerCase().includes('dimas') || o.toLowerCase().includes('owner')) &&
      !ownerOptions.some((o) => o.toLowerCase().includes('sarah') || o.toLowerCase().includes('supervisor')) &&
      !ownerOptions.some((o) => o.toLowerCase().includes('bambang') || o.toLowerCase().includes('gudang'));

    console.log('✅ Owner view has CASHIER only:', testResults.owner.hasCashiersOnly);

    // Screenshot Sub-tab 1 & Sub-tab 2
    const ownerSubtab1Path = path.join(artifactDir, 'visual_role_owner_tab1_faktur.png');
    await ownerPage.screenshot({ path: ownerSubtab1Path });
    console.log('📸 Saved visual_role_owner_tab1_faktur.png');

    const rekapTabBtn = ownerPage.locator('button:has-text("Rekap Item per Pembayaran")').first();
    await rekapTabBtn.click();
    await ownerPage.waitForTimeout(1000);

    const ownerSubtab2Path = path.join(artifactDir, 'visual_role_owner_tab2_rekap.png');
    await ownerPage.screenshot({ path: ownerSubtab2Path });
    console.log('📸 Saved visual_role_owner_tab2_rekap.png');

    await ownerContext.close();

    // ==========================================
    // 2. ROLE: SUPERVISOR (Sarah Supervisor Toko)
    // ==========================================
    console.log('\n--- 2. Testing Role: SUPERVISOR (Sarah) ---');
    const spvContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const spvPage = await spvContext.newPage();

    await spvContext.route('**/*api/auth/me*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: {
            id: 'spv-sarah-kemang-01',
            name: 'Sarah Supervisor Toko',
            role: 'SUPERVISOR',
            email: 'supervisor@uracoffee.id',
            tenantId,
            outletId: kemangOutletId,
            outlet: { id: kemangOutletId, name: 'Ura Coffee - Flagship Kemang' },
          },
        }),
      });
    });

    await spvPage.goto('http://localhost:5173/#dashboard', { waitUntil: 'networkidle' });
    await spvPage.evaluate(({ validToken, tenantId, kemangOutletId }) => {
      const u = {
        id: 'spv-sarah-kemang-01',
        name: 'Sarah Supervisor Toko',
        role: 'SUPERVISOR',
        email: 'supervisor@uracoffee.id',
        tenantId,
        outletId: kemangOutletId,
        outlet: { id: kemangOutletId, name: 'Ura Coffee - Flagship Kemang' },
      };
      localStorage.setItem('pos_auth_token', validToken);
      localStorage.setItem('pos_auth_user', JSON.stringify(u));
    }, { validToken, tenantId, kemangOutletId });

    await spvPage.goto('http://localhost:5173/?tab=orders#dashboard', { waitUntil: 'networkidle' });
    await spvPage.waitForTimeout(1500);

    const spvDateBtn = spvPage.locator('button:has-text("Hari Ini")').first();
    if (await spvDateBtn.isVisible()) {
      await spvDateBtn.click();
      await spvPage.waitForTimeout(400);
      const allPeriodBtn = spvPage.locator('button:has-text("Semua Periode")').first();
      await allPeriodBtn.click();
      await spvPage.waitForTimeout(1200);
    }

    const cashierSelectSpv = spvPage.locator('select:has(option:has-text("Semua Kasir di Toko Ini"))').first();
    const spvOptions = await cashierSelectSpv.evaluate((sel) => Array.from(sel.options).map((o) => o.text));
    console.log('📋 Supervisor Dropdown Options:', spvOptions);

    testResults.supervisor.options = spvOptions;
    testResults.supervisor.hasCashiersOnly =
      spvOptions.some((o) => o.includes('Rian')) &&
      spvOptions.some((o) => o.includes('Fajar')) &&
      spvOptions.some((o) => o.includes('Siti')) &&
      !spvOptions.some((o) => o.toLowerCase().includes('sarah') || o.toLowerCase().includes('supervisor')) &&
      !spvOptions.some((o) => o.toLowerCase().includes('dimas') || o.toLowerCase().includes('owner'));

    console.log('✅ Supervisor view has CASHIER only:', testResults.supervisor.hasCashiersOnly);

    const spvDesktopPath = path.join(artifactDir, 'visual_role_supervisor_desktop.png');
    await spvPage.screenshot({ path: spvDesktopPath });
    console.log('📸 Saved visual_role_supervisor_desktop.png');

    // Mobile Viewport for Supervisor (390x844)
    await spvPage.setViewportSize({ width: 390, height: 844 });
    await spvPage.waitForTimeout(800);
    const spvMobilePath = path.join(artifactDir, 'visual_role_supervisor_mobile.png');
    await spvPage.screenshot({ path: spvMobilePath });
    console.log('📸 Saved visual_role_supervisor_mobile.png');

    await spvContext.close();

    // ==========================================
    // 3. ROLE: CASHIER 1 (Rian Kasir Kemang)
    // ==========================================
    console.log('\n--- 3. Testing Role: CASHIER (Rian Kasir Kemang) ---');
    const rianContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const rianPage = await rianContext.newPage();

    await rianContext.route('**/*api/auth/me*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: {
            id: 'bcff77cf-789b-4c81-8e52-d6661125c5a4',
            name: 'Rian Kasir Kemang',
            role: 'CASHIER',
            email: 'kasir@uracoffee.id',
            tenantId,
            outletId: kemangOutletId,
            outlet: { id: kemangOutletId, name: 'Ura Coffee - Flagship Kemang' },
          },
        }),
      });
    });

    await rianPage.goto('http://localhost:5173/#pos', { waitUntil: 'networkidle' });
    await rianPage.evaluate(({ validToken, tenantId, kemangOutletId }) => {
      const u = {
        id: 'bcff77cf-789b-4c81-8e52-d6661125c5a4',
        name: 'Rian Kasir Kemang',
        role: 'CASHIER',
        email: 'kasir@uracoffee.id',
        tenantId,
        outletId: kemangOutletId,
        outlet: { id: kemangOutletId, name: 'Ura Coffee - Flagship Kemang' },
      };
      localStorage.setItem('pos_auth_token', validToken);
      localStorage.setItem('pos_auth_user', JSON.stringify(u));
    }, { validToken, tenantId, kemangOutletId });

    await rianPage.goto('http://localhost:5173/?tab=orders#pos', { waitUntil: 'networkidle' });
    await rianPage.waitForTimeout(1500);

    const rianDateBtn = rianPage.locator('button:has-text("Hari Ini")').first();
    if (await rianDateBtn.isVisible()) {
      await rianDateBtn.click();
      await rianPage.waitForTimeout(400);
      const allPeriodBtn = rianPage.locator('button:has-text("Semua Periode")').first();
      await allPeriodBtn.click();
      await rianPage.waitForTimeout(1200);
    }

    const cashierSelectRian = rianPage.locator('select:has(option:has-text("Semua Kasir di Toko Ini"))').first();
    const rianOptions = await cashierSelectRian.evaluate((sel) => Array.from(sel.options).map((o) => o.text));
    const selectedValRian = await cashierSelectRian.inputValue();
    console.log('📋 Cashier Rian Dropdown Options:', rianOptions);
    console.log('🎯 Rian Smart Default Selected Value:', selectedValRian);

    const hasRianSelfTag = rianOptions.some((o) => o.includes('Rian Kasir Kemang') && o.includes('(Akun Saya)'));
    const hasAkunAndaBadge = await rianPage.locator('span:has-text("Akun Anda")').isVisible();
    const hasPeerCashiers = rianOptions.some((o) => o.includes('Fajar')) && rianOptions.some((o) => o.includes('Siti'));

    testResults.cashierRian = {
      options: rianOptions,
      selectedVal: selectedValRian,
      hasRianSelfTag,
      hasAkunAndaBadge,
      hasPeerCashiers,
    };

    console.log('✅ Rian sees "(Akun Saya)" in option:', hasRianSelfTag);
    console.log('✅ Rian sees "Akun Anda" badge:', hasAkunAndaBadge);
    console.log('✅ Rian sees fellow Kemang cashiers (Fajar & Siti):', hasPeerCashiers);

    const rianDesktopPath = path.join(artifactDir, 'visual_role_cashier_rian_desktop.png');
    await rianPage.screenshot({ path: rianDesktopPath });
    console.log('📸 Saved visual_role_cashier_rian_desktop.png');

    // Mobile Viewport for Cashier Rian Handheld POS (390x844)
    await rianPage.setViewportSize({ width: 390, height: 844 });
    await rianPage.waitForTimeout(800);
    const rianMobilePath = path.join(artifactDir, 'visual_role_cashier_rian_mobile.png');
    await rianPage.screenshot({ path: rianMobilePath });
    console.log('📸 Saved visual_role_cashier_rian_mobile.png');

    await rianContext.close();

    // ==========================================
    // 4. ROLE: CASHIER 2 (Fajar Kasir Kemang)
    // ==========================================
    console.log('\n--- 4. Testing Role: CASHIER (Fajar Kasir Kemang) ---');
    const fajarContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const fajarPage = await fajarContext.newPage();

    await fajarContext.route('**/*api/auth/me*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: {
            id: 'c45b8fb3-f724-4ab2-84e1-255d6eb0b892',
            name: 'Fajar Kasir Kemang',
            role: 'CASHIER',
            email: 'fajar@uracoffee.id',
            tenantId,
            outletId: kemangOutletId,
            outlet: { id: kemangOutletId, name: 'Ura Coffee - Flagship Kemang' },
          },
        }),
      });
    });

    await fajarPage.goto('http://localhost:5173/#pos', { waitUntil: 'networkidle' });
    await fajarPage.evaluate(({ validToken, tenantId, kemangOutletId }) => {
      const u = {
        id: 'c45b8fb3-f724-4ab2-84e1-255d6eb0b892',
        name: 'Fajar Kasir Kemang',
        role: 'CASHIER',
        email: 'fajar@uracoffee.id',
        tenantId,
        outletId: kemangOutletId,
        outlet: { id: kemangOutletId, name: 'Ura Coffee - Flagship Kemang' },
      };
      localStorage.setItem('pos_auth_token', validToken);
      localStorage.setItem('pos_auth_user', JSON.stringify(u));
    }, { validToken, tenantId, kemangOutletId });

    await fajarPage.goto('http://localhost:5173/?tab=orders#pos', { waitUntil: 'networkidle' });
    await fajarPage.waitForTimeout(1500);

    const fajarDateBtn = fajarPage.locator('button:has-text("Hari Ini")').first();
    if (await fajarDateBtn.isVisible()) {
      await fajarDateBtn.click();
      await fajarPage.waitForTimeout(400);
      const allPeriodBtn = fajarPage.locator('button:has-text("Semua Periode")').first();
      await allPeriodBtn.click();
      await fajarPage.waitForTimeout(1200);
    }

    const cashierSelectFajar = fajarPage.locator('select:has(option:has-text("Semua Kasir di Toko Ini"))').first();
    const fajarOptions = await cashierSelectFajar.evaluate((sel) => Array.from(sel.options).map((o) => o.text));
    const selectedValFajar = await cashierSelectFajar.inputValue();
    console.log('📋 Cashier Fajar Dropdown Options:', fajarOptions);
    console.log('🎯 Fajar Smart Default Selected Value:', selectedValFajar);

    const hasFajarSelfTag = fajarOptions.some((o) => o.includes('Fajar Kasir Kemang') && o.includes('(Akun Saya)'));
    const hasFajarBadge = await fajarPage.locator('span:has-text("Akun Anda")').isVisible();
    const hasFajarPeers = fajarOptions.some((o) => o.includes('Rian')) && fajarOptions.some((o) => o.includes('Siti'));

    testResults.cashierFajar = {
      options: fajarOptions,
      selectedVal: selectedValFajar,
      hasFajarSelfTag,
      hasFajarBadge,
      hasFajarPeers,
    };

    console.log('✅ Fajar sees "(Akun Saya)" in option:', hasFajarSelfTag);
    console.log('✅ Fajar sees "Akun Anda" badge:', hasFajarBadge);
    console.log('✅ Fajar sees fellow Kemang cashiers (Rian & Siti):', hasFajarPeers);

    const fajarDesktopPath = path.join(artifactDir, 'visual_role_cashier_fajar_desktop.png');
    await fajarPage.screenshot({ path: fajarDesktopPath });
    console.log('📸 Saved visual_role_cashier_fajar_desktop.png');

    await fajarContext.close();

    // ==========================================
    // 5. ROLE: WAREHOUSE (Kepala Gudang Bambang)
    // ==========================================
    console.log('\n--- 5. Testing Role: WAREHOUSE (Bambang Logistik) ---');
    const whContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const whPage = await whContext.newPage();

    await whContext.route('**/*api/auth/me*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: {
            id: 'wh-bambang-01',
            name: 'Bambang Logistik Gudang',
            role: 'WAREHOUSE',
            email: 'gudang@uracoffee.id',
            tenantId,
            outletId: 'wh-central-outlet-id',
            outlet: { id: 'wh-central-outlet-id', name: 'Central Warehouse', isWarehouse: true },
          },
        }),
      });
    });

    await whPage.goto('http://localhost:5173/#dashboard', { waitUntil: 'networkidle' });
    await whPage.evaluate(({ validToken, tenantId }) => {
      const u = {
        id: 'wh-bambang-01',
        name: 'Bambang Logistik Gudang',
        role: 'WAREHOUSE',
        email: 'gudang@uracoffee.id',
        tenantId,
        outletId: 'wh-central-outlet-id',
        outlet: { id: 'wh-central-outlet-id', name: 'Central Warehouse', isWarehouse: true },
      };
      localStorage.setItem('pos_auth_token', validToken);
      localStorage.setItem('pos_auth_user', JSON.stringify(u));
    }, { validToken, tenantId });

    await whPage.goto('http://localhost:5173/#dashboard', { waitUntil: 'networkidle' });
    await whPage.waitForTimeout(1500);

    const whDesktopPath = path.join(artifactDir, 'visual_role_warehouse_desktop.png');
    await whPage.screenshot({ path: whDesktopPath });
    console.log('📸 Saved visual_role_warehouse_desktop.png');

    await whContext.close();

    console.log('\n==========================================');
    console.log('🎉 ALL ROLES VISUAL REGRESSION COMPLETED SUCCESSFULLY!');
    console.log('==========================================');
    console.log('Summary Results:');
    console.log(JSON.stringify(testResults, null, 2));

  } catch (err) {
    console.error('❌ Error during visual regression test:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testAllRolesVisualRegression();
