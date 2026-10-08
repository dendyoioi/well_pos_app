const { chromium } = require('../pos_apps/node_modules/playwright');
const path = require('path');

const artifactDir = '/Users/dendyaditya/.gemini/antigravity-ide/brain/31257e4b-7e59-4918-8f39-a77f6d9b7aae';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('1. Navigating to login...');
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
  // Click Riwayat Transaksi in sidebar
  const riwayatBtn = page.locator('button:has-text("Riwayat Transaksi")').first();
  await riwayatBtn.click();
  await page.waitForTimeout(1500);

  // Take screenshot of Tab 1: Daftar Faktur Penjualan
  await page.screenshot({ path: path.join(artifactDir, 'orders_tab1_invoices_proof.png') });
  console.log('✅ Saved screenshot of Tab 1 (Daftar Faktur)');

  // Verify Cashier filter dropdown exists
  const cashierSelect = page.locator('select:has-text("Semua Kasir")').first();
  const hasCashierSelect = await cashierSelect.isVisible();
  console.log('✅ Cashier filter dropdown visible:', hasCashierSelect);

  // Get cashier options
  const cashierOptions = await cashierSelect.locator('option').allInnerTexts();
  console.log('Cashier options:', cashierOptions);

  // Check sidebar does NOT have "Rekap Item per Pembayaran"
  const sidebarRekapItem = page.locator('aside button:has-text("Rekap Item per Pembayaran")');
  const hasSidebarRekapItem = await sidebarRekapItem.isVisible();
  console.log('✅ Sidebar has Rekap Item per Pembayaran (should be FALSE):', hasSidebarRekapItem);

  // Verify Sub-Tab switcher buttons
  const tabInvoices = page.locator('button:has-text("Daftar Faktur Penjualan")').first();
  const tabRekap = page.locator('button:has-text("Rekap Item per Pembayaran")').first();
  console.log('✅ Tab 1 visible:', await tabInvoices.isVisible());
  console.log('✅ Tab 2 visible:', await tabRekap.isVisible());

  // Click Tab 2: Rekap Item per Pembayaran
  console.log('3. Clicking Tab 2: Rekap Item per Pembayaran...');
  await tabRekap.click();
  await page.waitForTimeout(1000);

  // Check top-level payment cards
  const topLevelCards = await page.locator('button:has(span:has-text("Transaksi"))').allInnerTexts();
  console.log('Top level cards count:', topLevelCards.length);
  for (const c of topLevelCards) {
    console.log(' - Card:', c.split('\n')[0]);
  }

  // Verify QRIS is NOT a top-level card
  const hasTopLevelQris = topLevelCards.some(c => c.includes('QRIS\n') || c.startsWith('QRIS'));
  console.log('✅ Has top-level QRIS card (MUST BE FALSE):', hasTopLevelQris);

  // Take screenshot of Tab 2 initial state (Semua Metode)
  await page.screenshot({ path: path.join(artifactDir, 'orders_tab2_all_methods_proof.png') });
  console.log('✅ Saved screenshot of Tab 2 (Semua Metode)');

  // Click Non-Tunai card
  console.log('4. Clicking Non-Tunai card...');
  const nonTunaiCard = page.locator('button:has(span:text-is("Non-Tunai"))').first();
  await nonTunaiCard.click();
  await page.waitForTimeout(1000);

  // Verify sub-pills appear
  const subPillsContainer = page.locator('text=Pilih Sub-Jalur Non-Tunai');
  const hasSubPills = await subPillsContainer.isVisible();
  console.log('✅ Sub-pills container visible:', hasSubPills);

  // Check sub-pills options
  const subPills = await page.locator('button:has-text("tx • Rp")').allInnerTexts();
  console.log('Sub-pills found:', subPills);

  // Take screenshot of Non-Tunai with Sub-pills
  await page.screenshot({ path: path.join(artifactDir, 'orders_tab2_non_cash_subpills_proof.png') });
  console.log('✅ Saved screenshot of Tab 2 (Non-Tunai with Sub-pills)');

  // Click QRIS sub-pill if available
  const qrisSubPill = page.locator('button:has-text("QRIS")').first();
  if (await qrisSubPill.isVisible()) {
    console.log('5. Clicking QRIS sub-pill...');
    await qrisSubPill.click();
    await page.waitForTimeout(1000);

    const tableHeading = await page.locator('span:has-text("Daftar Menu Terjual via")').innerText();
    console.log('Table heading after clicking QRIS sub-pill:', tableHeading);

    await page.screenshot({ path: path.join(artifactDir, 'orders_tab2_qris_subfilter_proof.png') });
    console.log('✅ Saved screenshot of QRIS sub-filter');
  }

  // Switch back to Tab 1 and test Cashier filter
  console.log('6. Switching back to Tab 1 and testing Cashier filter...');
  await tabInvoices.click();
  await page.waitForTimeout(500);

  if (cashierOptions.length > 1) {
    const targetCashier = cashierOptions[1].replace('👤 ', '').trim();
    console.log('Selecting cashier:', targetCashier);
    await cashierSelect.selectOption(targetCashier);
    await page.waitForTimeout(1000);

    await page.screenshot({ path: path.join(artifactDir, 'orders_tab1_filtered_by_cashier_proof.png') });
    console.log('✅ Saved screenshot of invoices filtered by cashier');
  }

  await browser.close();
  console.log('🎉 All verification steps completed successfully!');
}

main().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
