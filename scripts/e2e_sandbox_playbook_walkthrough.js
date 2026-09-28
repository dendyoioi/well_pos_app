const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('===================================================================');
  console.log('🚀 WELL POS — FULL END-TO-END SANDBOX PLAYBOOK WALKTHROUGH');
  console.log('===================================================================');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const artifactDir = '/Users/dendyaditya/.gemini/antigravity-ide/brain/1ca03e93-2b75-45a8-a75b-cea5c4e38d27';

  try {
    // -------------------------------------------------------------
    // TAHAP 1: LANDING PAGE SAAS (PORTAL PUBLIK & PENDAFTARAN)
    // -------------------------------------------------------------
    console.log('\n[1/8] Mengakses Landing Page Publik Well POS SaaS...');
    await page.goto('http://localhost:5173/#landing', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const landingScreenshot = path.join(artifactDir, '30_walkthrough_landing_page.png');
    await page.screenshot({ path: landingScreenshot });
    console.log('✅ Screenshot Landing Page disimpan:', landingScreenshot);

    // -------------------------------------------------------------
    // TAHAP 2: SUPERADMIN CONTROL TOWER (AUDIT & GOVERNANCE)
    // -------------------------------------------------------------
    console.log('\n[2/8] Mengakses Superadmin Control Tower...');
    await page.goto('http://localhost:5173/#superadmin', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const isSuperadminLogin = await page.locator('input[type="email"]').count();
    if (isSuperadminLogin > 0) {
      await page.click('button:has-text("Gunakan Akun Default Superadmin")');
      await page.waitForTimeout(300);
      await page.click('button:has-text("Masuk ke Portal Platform")');
      await page.waitForTimeout(2000);
    }
    const superadminScreenshot = path.join(artifactDir, '31_walkthrough_superadmin_dashboard.png');
    await page.screenshot({ path: superadminScreenshot });
    console.log('✅ Screenshot SuperAdmin Control Tower disimpan:', superadminScreenshot);

    // -------------------------------------------------------------
    // TAHAP 3: LOGIN OWNER & KATALOG PRODUK RESEP BOM
    // -------------------------------------------------------------
    console.log('\n[3/8] Login Merchant Owner Ura Coffee & Buka Katalog Resep...');
    await page.evaluate(() => {
      localStorage.removeItem('wellpos_platform_auth_token');
      localStorage.removeItem('wellpos_platform_user');
    });

    const loginRes = await page.request.post('http://localhost:5001/api/auth/login', {
      data: {
        email: 'owner@uracoffee.id',
        password: 'Owner123!'
      }
    });
    const loginData = await loginRes.json();
    const ownerToken = loginData.data?.token;
    const ownerUser = loginData.data?.user;

    await page.evaluate(({ token, user }) => {
      localStorage.setItem('pos_auth_token', token);
      localStorage.setItem('pos_auth_user', JSON.stringify(user));
      window.location.hash = '';
    }, { token: ownerToken, user: ownerUser });

    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Buka menu Resep & Bahan (BOM)
    const recipeBtn = page.locator('aside button:has-text("Resep & Bahan")').first();
    if (await recipeBtn.count() > 0) {
      await recipeBtn.click();
      await page.waitForTimeout(1200);
    }
    const catalogScreenshot = path.join(artifactDir, '32_walkthrough_owner_backoffice_catalog.png');
    await page.screenshot({ path: catalogScreenshot });
    console.log('✅ Screenshot Katalog Produk & Resep BOM disimpan:', catalogScreenshot);

    // -------------------------------------------------------------
    // TAHAP 4: STOK BAHAN BAKU & CENTRAL WAREHOUSE
    // -------------------------------------------------------------
    console.log('\n[4/8] Memeriksa Stok Bahan Baku & Saldo Gudang...');
    // Buka accordion Bahan Baku & Stok jika tertutup
    const stockGroupBtn = page.locator('aside button:has-text("Bahan Baku & Stok")').first();
    if (await stockGroupBtn.count() > 0) {
      await stockGroupBtn.click();
      await page.waitForTimeout(500);
    }
    const stockBtn = page.locator('aside button:has-text("Stok Bahan Baku")').first();
    if (await stockBtn.count() > 0) {
      await stockBtn.click();
      await page.waitForTimeout(1200);
    }
    const stockScreenshot = path.join(artifactDir, '33_walkthrough_owner_inventory_raw.png');
    await page.screenshot({ path: stockScreenshot });
    console.log('✅ Screenshot Stok Bahan Baku & Gudang disimpan:', stockScreenshot);

    // -------------------------------------------------------------
    // TAHAP 5: TERMINAL KASIR POS (POINT OF SALE)
    // -------------------------------------------------------------
    console.log('\n[5/8] Membuka Terminal Kasir POS...');
    const bukaKasirBtn = page.locator('button:has-text("Buka Kasir POS")').first();
    if (await bukaKasirBtn.count() > 0) {
      await bukaKasirBtn.click();
      await page.waitForTimeout(2000);
    }
    const posScreenshot = path.join(artifactDir, '34_walkthrough_pos_terminal.png');
    await page.screenshot({ path: posScreenshot });
    console.log('✅ Screenshot Terminal Kasir POS disimpan:', posScreenshot);

    // -------------------------------------------------------------
    // TAHAP 6: PRATINJAU BUKU MENU QR MEJA & SELF-ORDERING
    // -------------------------------------------------------------
    console.log('\n[6/8] Memeriksa Simulator Self-Ordering QR Meja...');
    // Kembali ke backoffice
    const backofficeBtn = page.locator('button:has-text("Kembali ke Backoffice")').first();
    if (await backofficeBtn.count() > 0) {
      await backofficeBtn.click();
      await page.waitForTimeout(1500);
    }

    // Buka accordion Buku Menu QR
    const qrGroupBtn = page.locator('aside button:has-text("Buku Menu QR")').first();
    if (await qrGroupBtn.count() > 0) {
      await qrGroupBtn.click();
      await page.waitForTimeout(500);
      const guestMenuBtn = page.locator('aside button:has-text("Tampilan Menu Tamu")').first();
      if (await guestMenuBtn.count() > 0) {
        await guestMenuBtn.click();
        await page.waitForTimeout(1500);
      }
    }
    const qrScreenshot = path.join(artifactDir, '35_walkthrough_qr_menu_self_ordering.png');
    await page.screenshot({ path: qrScreenshot });
    console.log('✅ Screenshot QR Meja Self-Ordering disimpan:', qrScreenshot);

    // -------------------------------------------------------------
    // TAHAP 7: LAPORAN FINANSIAL & HPP REAL-TIME
    // -------------------------------------------------------------
    console.log('\n[7/8] Memeriksa Laporan Finansial & Laba Bersih...');
    const laporanGroupBtn = page.locator('aside button:has-text("Laporan & Keuangan")').first();
    if (await laporanGroupBtn.count() > 0) {
      await laporanGroupBtn.click();
      await page.waitForTimeout(500);
      const finBtn = page.locator('aside button:has-text("Laporan Penjualan & Finansial")').first();
      if (await finBtn.count() > 0) {
        await finBtn.click();
        await page.waitForTimeout(1500);
      }
    }
    const financialScreenshot = path.join(artifactDir, '36_walkthrough_financial_report.png');
    await page.screenshot({ path: financialScreenshot });
    console.log('✅ Screenshot Laporan Finansial disimpan:', financialScreenshot);

    // -------------------------------------------------------------
    // TAHAP 8: BILLING KUOTA TOKEN & TOP-UP QRIS STATIS
    // -------------------------------------------------------------
    console.log('\n[8/8] Memeriksa Billing Kuota Token & Top-up...');
    const billingBtn = page.locator('aside button:has-text("Paket & Kuota")').first();
    if (await billingBtn.count() > 0) {
      await billingBtn.click();
      await page.waitForTimeout(1500);
    }
    const billingScreenshot = path.join(artifactDir, '37_walkthrough_billing_token_and_qris.png');
    await page.screenshot({ path: billingScreenshot });
    console.log('✅ Screenshot Billing Kuota Token disimpan:', billingScreenshot);

    console.log('\n===================================================================');
    console.log('🎉 SELURUH 8 TAHAP WALKTHROUGH PLAYBOOK SELESAI DENGAN SUKSES!');
    console.log('===================================================================');
  } catch (err) {
    console.error('Error during walkthrough:', err);
  } finally {
    await browser.close();
  }
})();
