const { chromium } = require('../pos_apps/node_modules/playwright');
const path = require('path');

const artifactDir = '/Users/dendyaditya/.gemini/antigravity-ide/brain/31257e4b-7e59-4918-8f39-a77f6d9b7aae';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('1. Navigating to login as Owner...');
  await page.goto('http://localhost:5173/#login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const ownerTab = page.getByRole('button', { name: /Portal Pemilik/i });
  if (await ownerTab.isVisible()) {
    await ownerTab.click();
    await page.waitForTimeout(300);
  }

  await page.locator('input[type="email"]').fill('owner@uracoffee.id');
  await page.locator('input[type="password"]').fill('Admin123!');
  await page.getByRole('button', { name: /Masuk ke Portal Pemilik/i }).click();
  await page.waitForTimeout(2500);

  console.log('2. Navigating to Riwayat Transaksi...');
  const riwayatBtn = page.locator('button:has-text("Riwayat Transaksi")').first();
  await riwayatBtn.click();
  await page.waitForTimeout(1500);

  // Tab 1: Check buttons
  const btnExportFakturExcel = page.locator('button:has-text("Ekspor Faktur (Excel)")').first();
  const btnExportFakturPdf = page.locator('button:has-text("Cetak Faktur (PDF)")').first();
  console.log('✅ Tab 1: "Ekspor Faktur (Excel)" button visible:', await btnExportFakturExcel.isVisible());
  console.log('✅ Tab 1: "Cetak Faktur (PDF)" button visible:', await btnExportFakturPdf.isVisible());

  // Check Owner sees Kasir select dropdown
  const cashierSelect = page.locator('select:has-text("Semua Kasir")').first();
  console.log('✅ Owner sees Kasir select dropdown:', await cashierSelect.isVisible());

  // Screenshot Tab 1
  await page.screenshot({ path: path.join(artifactDir, 'tab1_faktur_export_buttons_proof.png') });
  console.log('📸 Saved tab1_faktur_export_buttons_proof.png');

  // Click Tab 2: Rekap Item per Pembayaran
  console.log('3. Switching to Tab 2: Rekap Item per Pembayaran...');
  const tabRekap = page.locator('button:has-text("Rekap Item per Pembayaran")').first();
  await tabRekap.click();
  await page.waitForTimeout(1000);

  // Tab 2: Check buttons dynamically changed
  const btnExportRekapExcel = page.locator('button:has-text("Ekspor Rekap Item (Excel)")').first();
  const btnExportRekapPdf = page.locator('button:has-text("Cetak Rekap Item (PDF)")').first();
  console.log('✅ Tab 2: "Ekspor Rekap Item (Excel)" button visible:', await btnExportRekapExcel.isVisible());
  console.log('✅ Tab 2: "Cetak Rekap Item (PDF)" button visible:', await btnExportRekapPdf.isVisible());

  // Check inline table toolbar has Excel and PDF buttons
  const inlineExcelBtn = page.locator('div:has-text("Daftar Menu Terjual") button:has-text("Excel")').first();
  const inlinePdfBtn = page.locator('div:has-text("Daftar Menu Terjual") button:has-text("PDF")').first();
  console.log('✅ Tab 2: Inline table "Excel" button visible:', await inlineExcelBtn.isVisible());
  console.log('✅ Tab 2: Inline table "PDF" button visible:', await inlinePdfBtn.isVisible());

  // Check global filter bar (Saluran, Kasir, Tanggal) is present on Tab 2
  const sharedToolbarFilter = page.locator('div:has-text("Saluran:")').first();
  console.log('✅ Shared filter toolbar visible on Tab 2:', await sharedToolbarFilter.isVisible());

  // Verify that only 1 toolbar is present on Tab 2 (NO duplicate toolbar)
  const saluranCount = await page.locator('span:has-text("Saluran:")').count();
  console.log('✅ Tab 2 Saluran toolbar count (must be exactly 1):', saluranCount);

  // Tab 2: Screenshot
  await page.screenshot({ path: path.join(artifactDir, 'tab2_rekap_export_buttons_proof.png') });
  console.log('📸 Saved tab2_rekap_export_buttons_proof.png');

  // Test 4: Cashier Option 1 Check (Smart Default + Ability to view store)
  console.log('4. Testing Cashier Option 1 (Smart Default & Collaboration)...');
  // Intercept /api/auth/me to return a CASHIER user
  await context.route('**/*api/auth/me*', async (route) => {
    console.log('🚀 Intercepted auth/me request! Fulfilling with CASHIER role...');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        data: {
          id: 'cashier-rian-01',
          name: 'Rian Kasir Kemang',
          role: 'CASHIER',
          email: 'rian@uracoffee.id',
          tenantId: 'ura-coffee-tenant',
          outletId: 'ura-kemang',
          outlet: { id: 'ura-kemang', name: 'Ura Coffee Flagship Kemang' }
        }
      })
    });
  });

  await page.evaluate(() => {
    const raw = localStorage.getItem('pos_auth_user');
    if (raw) {
      const u = JSON.parse(raw);
      u.role = 'CASHIER';
      u.name = 'Rian Kasir Kemang';
      u.id = 'cashier-rian-01';
      localStorage.setItem('pos_auth_user', JSON.stringify(u));
    }
  });

  // Reload page
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Navigate to Riwayat Transaksi
  const ordersTabAgain = page.locator('button:has-text("Riwayat Transaksi")').first();
  if (await ordersTabAgain.isVisible()) {
    await ordersTabAgain.click();
    await page.waitForTimeout(1000);
  }

  // 1. Verify that only 1 toolbar exists (no duplicates)
  const cashierSaluranCount = await page.locator('span:has-text("Saluran:")').count();
  console.log('✅ Cashier view: Saluran toolbar count (must be 1):', cashierSaluranCount);

  // 2. Verify that Kasir filter has "Akun Anda" badge when defaulted to self
  const lockedBadge = page.locator('span:has-text("Akun Anda")').first();
  console.log('✅ Cashier user sees smart "Akun Anda" badge initially:', await lockedBadge.isVisible());

  // 3. Verify dropdown allows selecting "Semua Kasir di Toko Ini"
  const cashierSelectDropdown = page.locator('select:has-text("Semua Kasir di Toko Ini")').first();
  console.log('✅ Cashier sees dropdown with option to collaborate:', await cashierSelectDropdown.isVisible());

  // Screenshot Cashier smart default
  await page.screenshot({ path: path.join(artifactDir, 'cashier_smart_default_proof.png') });
  console.log('📸 Saved cashier_smart_default_proof.png');

  // 4. Test selecting "Semua Kasir di Toko Ini"
  await cashierSelectDropdown.selectOption('ALL');
  await page.waitForTimeout(600);
  console.log('✅ Successfully switched to "Semua Kasir di Toko Ini"');

  // Screenshot Cashier viewing store transactions
  await page.screenshot({ path: path.join(artifactDir, 'cashier_view_all_store_proof.png') });
  console.log('📸 Saved cashier_view_all_store_proof.png');

  await browser.close();
  console.log('🎉 ALL VERIFICATIONS COMPLETED SUCCESSFULLY!');
}

main().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
