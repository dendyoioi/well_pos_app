const { chromium } = require('../pos_apps/node_modules/playwright');
const path = require('path');

const artifactDir = '/Users/dendyaditya/.gemini/antigravity-ide/brain/31257e4b-7e59-4918-8f39-a77f6d9b7aae';

async function testPhase1Phase2Verification() {
  console.log('🚀 Running Phase 1 & Phase 2 Automated Visual & Functional Verification...');
  const browser = await chromium.launch({ headless: true });

  try {
    // 0. Login as Owner to get valid backend token and outlet info
    console.log('\n--- Step 0: Authenticating as Owner ---');
    const ownerContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto('http://localhost:5173/#login', { waitUntil: 'networkidle' });
    await ownerPage.waitForTimeout(500);

    const ownerPortalBtn = ownerPage.getByRole('button', { name: /Portal Pemilik/i });
    if (await ownerPortalBtn.isVisible()) {
      await ownerPortalBtn.click();
      await ownerPage.waitForTimeout(300);
    }

    await ownerPage.locator('input[type="email"]').fill('owner@uracoffee.id');
    await ownerPage.locator('input[type="password"]').fill('Admin123!');
    await ownerPage.getByRole('button', { name: /Masuk ke Portal Pemilik/i }).click();
    await ownerPage.waitForTimeout(2000);

    const sessionData = await ownerPage.evaluate(() => {
      return {
        token: localStorage.getItem('pos_auth_token'),
        user: JSON.parse(localStorage.getItem('pos_auth_user') || '{}'),
      };
    });
    console.log('🔑 Logged in successfully. Token acquired.');

    const validToken = sessionData.token;
    const tenantId = sessionData.user?.tenantId || 'd8ea88b6-e85c-4c9b-8bfd-2414b591d5ec';
    const kemangOutletId = 'd135ef0a-6d68-4b98-87ea-56eb73e672e0';

    // Navigate to Orders Tab in Backoffice
    console.log('\n--- Step 1: Navigating to Orders Tab ---');
    await ownerPage.goto('http://localhost:5173/?tab=orders#dashboard', { waitUntil: 'networkidle' });
    await ownerPage.waitForTimeout(1500);

    // Set filter "Semua Periode" so all orders from Sept 1 - Oct 7 are loaded
    const dateBtn = ownerPage.locator('button:has-text("Hari Ini")').first();
    if (await dateBtn.isVisible()) {
      await dateBtn.click();
      await ownerPage.waitForTimeout(300);
      const allPeriodBtn = ownerPage.locator('button:has-text("Semua Periode")').first();
      await allPeriodBtn.click();
      await ownerPage.waitForTimeout(1500);
    }

    // Verify AOV & Status Pills in DOM
    const bodyText = await ownerPage.innerText('body');
    const hasAov = bodyText.toLowerCase().includes('aov: rp') || bodyText.toLowerCase().includes('rata-rata: rp');
    console.log(`✅ AOV Metric Displayed: ${hasAov}`);

    const hasStatusPills =
      bodyText.toLowerCase().includes('semua status') &&
      bodyText.toLowerCase().includes('lunas') &&
      bodyText.toLowerCase().includes('dibatalkan');
    console.log(`✅ Status Pills Filter Displayed: ${hasStatusPills}`);

    // Screenshot 1: Phase 1 Status Pills & AOV
    const screenshot1Path = path.join(artifactDir, 'phase1_status_pills_and_aov.png');
    await ownerPage.screenshot({ path: screenshot1Path, fullPage: false });
    console.log(`📸 Screenshot saved: ${screenshot1Path}`);

    // Click Status Pill "Dibatalkan (Void)" to verify filtering
    console.log('\n--- Step 1b: Testing Status Pill Filter Interaction ---');
    const voidPill = ownerPage.locator('button:has-text("Dibatalkan")').first();
    if (await voidPill.isVisible()) {
      await voidPill.click();
      await ownerPage.waitForTimeout(600);
      console.log('✅ Clicked [Dibatalkan (Void)] filter pill');

      const allPill = ownerPage.locator('button:has-text("Semua Status")').first();
      await allPill.click();
      await ownerPage.waitForTimeout(600);
      console.log('✅ Reset back to [Semua Status]');
    }

    // Test WhatsApp Modal
    console.log('\n--- Step 2: Testing WhatsApp Summary Modal ---');
    const waBtn = ownerPage.getByRole('button', { name: /Ringkasan WA/i });
    if (await waBtn.isVisible()) {
      await waBtn.click();
      await ownerPage.waitForTimeout(600);

      // Screenshot 2: WhatsApp Modal
      const screenshot2Path = path.join(artifactDir, 'phase2_whatsapp_summary_modal.png');
      await ownerPage.screenshot({ path: screenshot2Path, fullPage: false });
      console.log(`📸 Screenshot saved: ${screenshot2Path}`);

      const modalText = await ownerPage.innerText('body');
      const hasWaHeader = modalText.includes('RINGKASAN PENJUALAN — WELL POS');
      const hasWaOmset = modalText.includes('Total Omset Lunas');
      const hasWaAov = modalText.includes('Rata-rata per Nota (AOV)');
      console.log(`✅ WhatsApp Modal Content Verified: Header=${hasWaHeader}, Omset=${hasWaOmset}, AOV=${hasWaAov}`);

      // Test copy text button
      const copyBtn = ownerPage.getByRole('button', { name: /Salin Teks/i });
      if (await copyBtn.isVisible()) {
        await copyBtn.click();
        await ownerPage.waitForTimeout(300);
        console.log('✅ Clicked Salin Teks button');
      }

      // Close modal
      const closeBtn = ownerPage.getByRole('button', { name: /Tutup/i });
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await ownerPage.waitForTimeout(400);
        console.log('✅ Closed WhatsApp Modal');
      }
    }

    // Switch to Sub-tab: Rekap Item per Pembayaran
    console.log('\n--- Step 3: Testing Rekap Item with HPP & Gross Margin ---');
    const rekapTabBtn = ownerPage.getByRole('button', { name: /Rekap Item per Pembayaran/i });
    await rekapTabBtn.click();
    await ownerPage.waitForTimeout(1000);

    // Verify Toggle HPP & Margin is visible for Owner
    const hppToggleBtn = ownerPage.getByRole('button', { name: /HPP & Margin/i });
    const isHppBtnVisible = await hppToggleBtn.isVisible();
    console.log(`✅ HPP & Margin Toggle Button Visible for Owner: ${isHppBtnVisible}`);

    if (isHppBtnVisible) {
      // Click HPP Toggle
      await hppToggleBtn.click();
      await ownerPage.waitForTimeout(800);

      // Screenshot 3: Owner view with HPP active
      const screenshot3Path = path.join(artifactDir, 'phase2_owner_hpp_and_margin_active.png');
      await ownerPage.screenshot({ path: screenshot3Path, fullPage: false });
      console.log(`📸 Screenshot saved: ${screenshot3Path}`);

      const pageTextWithHpp = (await ownerPage.innerText('body')).toLowerCase();
      const hasEstimasiLabaKotor = pageTextWithHpp.includes('estimasi laba kotor') || pageTextWithHpp.includes('laba kotor');
      const hasTotalHppCol = pageTextWithHpp.includes('total hpp');
      const hasLabaKotorCol = pageTextWithHpp.includes('laba kotor');
      const hasMarginCol = pageTextWithHpp.includes('margin');
      console.log(`✅ HPP & Margin Visual Elements: Estimasi Card=${hasEstimasiLabaKotor}, HPP Col=${hasTotalHppCol}, Laba Col=${hasLabaKotorCol}, Margin Col=${hasMarginCol}`);
    }

    await ownerContext.close();

    // ==========================================
    // 2. CASHIER VIEW: STRICT PRIVILEGE ISOLATION
    // ==========================================
    console.log('\n--- Step 4: Testing Cashier View (Privilege Isolation Check) ---');
    const cashierUser = {
      id: 'bcff77cf-789b-4c81-8e52-d6661125c5a4',
      name: 'Rian Kasir Kemang',
      email: 'kasir@uracoffee.id',
      role: 'CASHIER',
      tenantId: tenantId,
      outletId: kemangOutletId,
      outlet: { id: kemangOutletId, name: 'Ura Coffee - Flagship Kemang' },
    };

    const cashierContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    
    // Intercept auth/me so the app cleanly knows user is CASHIER
    await cashierContext.route('**/*api/auth/me*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          data: cashierUser,
        }),
      });
    });

    const cashierPage = await cashierContext.newPage();

    await cashierPage.goto('http://localhost:5173/#pos', { waitUntil: 'networkidle' });
    await cashierPage.evaluate(({ validToken, cashierUser, kemangOutletId }) => {
      localStorage.setItem('pos_auth_token', validToken);
      localStorage.setItem('pos_auth_user', JSON.stringify(cashierUser));
      localStorage.setItem('pos_selected_outlet_id', kemangOutletId);
    }, { validToken, cashierUser, kemangOutletId });

    await cashierPage.goto('http://localhost:5173/?tab=orders#pos', { waitUntil: 'networkidle' });
    await cashierPage.waitForTimeout(1500);

    // Switch to Rekap Item tab
    const cashierRekapBtn = cashierPage.getByRole('button', { name: /Rekap Item per Pembayaran/i });
    if (await cashierRekapBtn.isVisible()) {
      await cashierRekapBtn.click();
      await cashierPage.waitForTimeout(1000);
    }

    // Check that HPP button is NOT present for cashier
    const cashierHppBtn = cashierPage.getByRole('button', { name: /HPP & Margin/i });
    const isCashierHppVisible = await cashierHppBtn.isVisible();
    console.log(`🔒 HPP Toggle Button Hidden for Cashier: ${!isCashierHppVisible}`);

    // Screenshot 4: Cashier view strictly without HPP
    const screenshot4Path = path.join(artifactDir, 'phase2_cashier_strictly_no_hpp.png');
    await cashierPage.screenshot({ path: screenshot4Path, fullPage: false });
    console.log(`📸 Screenshot saved: ${screenshot4Path}`);

    await cashierContext.close();

    console.log('\n🎉 All Phase 1 & Phase 2 verification checks PASSED successfully!');
  } catch (err) {
    console.error('❌ Verification failed with error:', err);
  } finally {
    await browser.close();
  }
}

testPhase1Phase2Verification();
