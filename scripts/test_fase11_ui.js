const { chromium } = require('../pos_apps/node_modules/playwright');

async function testFase11Ui() {
  console.log('========================================================================');
  console.log('🌐 TEST FASE 11 UI PLAYWRIGHT: KOMISI STAF & KURIR + F&B ISOLATION');
  console.log('========================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on('console', msg => console.log(`[Browser Console ${msg.type()}]:`, msg.text()));
  page.on('pageerror', err => console.error('[Browser PageError]:', err));

  try {
    // 1. Login Laundry Owner
    console.log('1. Autentikasi Laundry Owner...');
    await page.goto('http://127.0.0.1:5173/#login', { waitUntil: 'networkidle' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto('http://127.0.0.1:5173/#login', { waitUntil: 'networkidle' });
    await page.locator('button:has-text("Portal Pemilik")').first().click();
    await page.locator('input[type="email"]').first().fill('owner.laundry@wellpos.id');
    await page.locator('input[type="password"]').first().fill('pastiwell789');
    await page.locator('button:has-text("Masuk ke Portal Pemilik")').first().click();
    await page.waitForTimeout(2500);

    // 2. Cek Navigasi Sidebar Laundry
    console.log('2. Memeriksa Menu "Komisi Staf & Kurir" di Sidebar Laundry...');
    const commSubMenu = page.locator('button[title*="Komisi Staf"], button:has-text("Komisi Staf")').first();
    const isCommMenuVisible = await commSubMenu.isVisible().catch(() => false);
    console.log('Sub-menu Komisi Staf & Kurir terdaftar di sidebar:', isCommMenuVisible);

    // 3. Navigasi ke Halaman Komisi
    console.log('3. Navigasi ke Halaman Komisi Staf & Kurir...');
    await page.goto('http://127.0.0.1:5173/?tab=laundry_commissions', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const heading = page.locator('h1:has-text("Komisi Staf Produksi & Kurir")').first();
    const isHeadingVisible = await heading.isVisible().catch(() => false);
    console.log('Heading Halaman Komisi terlihat:', isHeadingVisible);
    if (!isHeadingVisible) {
      throw new Error('Halaman Komisi Staf & Kurir tidak termuat dengan benar');
    }

    // 4. Verifikasi 4 KPI Cards
    console.log('4. Memeriksa 4 KPI Cards...');
    const kpi1 = page.locator('span:has-text("Total Komisi Bersih")').first();
    const kpi2 = page.locator('span:has-text("Komisi Produksi")').first();
    const kpi3 = page.locator('span:has-text("Komisi Kurir Delivery")').first();
    const kpi4 = page.locator('span:has-text("Total Volume Kerja")').first();

    const kpisOk =
      (await kpi1.isVisible().catch(() => false)) &&
      (await kpi2.isVisible().catch(() => false)) &&
      (await kpi3.isVisible().catch(() => false)) &&
      (await kpi4.isVisible().catch(() => false));
    console.log('4 KPI Cards terlihat lengkap:', kpisOk);
    if (!kpisOk) {
      throw new Error('Satu atau lebih KPI Card tidak terlihat');
    }

    // 5. Cek Modal Atur Tarif Komisi
    console.log('5. Memeriksa Modal Atur Tarif Komisi...');
    const aturTarifBtn = page.locator('button:has-text("Atur Tarif Komisi")').first();
    await aturTarifBtn.click();
    await page.waitForTimeout(800);

    const modalTitle = page.locator('h3:has-text("Pengaturan Tarif Komisi Staf & Kurir")').first();
    const isModalVisible = await modalTitle.isVisible().catch(() => false);
    console.log('Modal Atur Tarif terbuka:', isModalVisible);
    if (!isModalVisible) {
      throw new Error('Modal Atur Tarif Komisi gagal dibuka');
    }

    // Tutup modal
    const cancelModalBtn = page.locator('button:has-text("Batal")').first();
    await cancelModalBtn.click().catch(() => {});
    await page.waitForTimeout(500);

    // Ambil screenshot halaman komisi laundry
    await page.screenshot({
      path: '/Users/dendyaditya/.gemini/antigravity/brain/f71f8083-0c2f-48e9-b583-29b630ca4a01/screenshot_fase11_laundry_commission_view.png',
      fullPage: false,
    });
    console.log('📸 Screenshot halaman komisi disimpan');

    // 6. Anti-Regresi F&B: Cek Owner F&B tidak memiliki menu Komisi
    console.log('\n6. Memeriksa Anti-Regresi Mode F&B (owner@uracorporation.com)...');
    await page.goto('http://127.0.0.1:5173/#login', { waitUntil: 'networkidle' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto('http://127.0.0.1:5173/#login', { waitUntil: 'networkidle' });
    await page.locator('button:has-text("Portal Pemilik")').first().click();
    await page.locator('input[type="email"]').first().fill('owner@uracorporation.com');
    await page.locator('input[type="password"]').first().fill('Owner123!');
    await page.locator('button:has-text("Masuk ke Portal Pemilik")').first().click();
    await page.waitForTimeout(2500);

    const fnbStafGroup = page.locator('button:has-text("Manajemen Staf")').first();
    if (await fnbStafGroup.isVisible().catch(() => false)) {
      await fnbStafGroup.click();
      await page.waitForTimeout(600);
    }

    const fnbCommMenu = page.locator('button:has-text("Komisi Staf & Kurir")').first();
    const isFnbCommVisible = await fnbCommMenu.isVisible().catch(() => false);
    console.log('Menu Komisi di F&B tersembunyi (Anti-Regresi):', !isFnbCommVisible);
    if (isFnbCommVisible) {
      throw new Error('Regresi F&B: Menu Komisi Staf & Kurir bocor ke akun F&B!');
    }

    console.log('\n========================================================================');
    console.log('🎉 TEST FASE 11 UI PLAYWRIGHT: 100% PASS (Zero Regression on F&B)');
    console.log('========================================================================');
  } finally {
    await browser.close();
  }
}

testFase11Ui().catch(err => {
  console.error('Fatal Error UI Test:', err);
  process.exit(1);
});
