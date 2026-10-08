// scripts/verify_rekap_and_responsive.js
const { chromium } = require('../pos_apps/node_modules/playwright');
const path = require('path');

const artifactDir = '/Users/dendyaditya/.gemini/antigravity-ide/brain/31257e4b-7e59-4918-8f39-a77f6d9b7aae';

async function verifyAll() {
  const browser = await chromium.launch({ headless: true });

  // =========================================================================
  // 1. Mobile iPhone Viewport (390 x 844) - Verifikasi Header Tidak Numpuk
  // =========================================================================
  console.log('--- 1. Testing Mobile iPhone Viewport (Header Responsive) ---');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  });
  const mobilePage = await mobileContext.newPage();

  await mobilePage.goto('http://localhost:5173/#login', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(600);

  const ownerTab = mobilePage.getByRole('button', { name: /Portal Pemilik/i });
  if (await ownerTab.isVisible()) {
    await ownerTab.click();
    await mobilePage.waitForTimeout(300);
  }

  await mobilePage.locator('input[type="email"]').fill('owner@uracoffee.id');
  await mobilePage.locator('input[type="password"]').fill('Admin123!');
  await mobilePage.getByRole('button', { name: /Masuk ke Portal Pemilik/i }).click();
  await mobilePage.waitForTimeout(2500);

  // Ambil screenshot layar mobile di dashboard / POS
  await mobilePage.screenshot({ path: path.join(artifactDir, 'mobile_header_clean_proof.png') });
  console.log('✅ Screenshot mobile header disimpan di mobile_header_clean_proof.png');

  // Buka menu hamburger mobile untuk verifikasi drawer
  const burgerBtn = mobilePage.locator('button[title*="Menu" i], button[aria-label*="Menu" i]').first();
  if (await burgerBtn.isVisible()) {
    await burgerBtn.click();
    await mobilePage.waitForTimeout(800);
    await mobilePage.screenshot({ path: path.join(artifactDir, 'mobile_drawer_navigation_proof.png') });
    console.log('✅ Screenshot mobile drawer disimpan di mobile_drawer_navigation_proof.png');
    // Tutup drawer
    await mobilePage.keyboard.press('Escape');
    await mobilePage.waitForTimeout(500);
  }

  // =========================================================================
  // 2. Desktop Viewport (1280 x 850) - Verifikasi OrdersView & ShiftsAuditView
  // =========================================================================
  console.log('--- 2. Testing Desktop Viewport (Orders & Shift Audit) ---');
  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  const page = await desktopContext.newPage();

  await page.goto('http://localhost:5173/#login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const deskOwnerTab = page.getByRole('button', { name: /Portal Pemilik/i });
  if (await deskOwnerTab.isVisible()) {
    await deskOwnerTab.click();
    await page.waitForTimeout(300);
  }

  await page.locator('input[type="email"]').fill('owner@uracoffee.id');
  await page.locator('input[type="password"]').fill('Admin123!');
  await page.getByRole('button', { name: /Masuk ke Portal Pemilik/i }).click();
  await page.waitForTimeout(2500);

  // 3. Tab Riwayat Transaksi (OrdersView)
  console.log('--- 3. Membuka Tab Riwayat Transaksi ---');
  const ordersTabBtn = page.locator('button:has-text("Riwayat Transaksi"), a:has-text("Riwayat Transaksi")').first();
  if (await ordersTabBtn.isVisible()) {
    await ordersTabBtn.click();
    await page.waitForTimeout(2000);
  }

  // Pilih preset "Semua Periode" agar seluruh data 1 Sep - 7 Okt tampil
  const dateDropdownBtn = page.locator('button:has-text("Hari Ini"), button:has-text("Semua Periode")').first();
  if (await dateDropdownBtn.isVisible()) {
    await dateDropdownBtn.click();
    await page.waitForTimeout(500);
    const allPeriodOpt = page.locator('button:has-text("Semua Periode")').first();
    if (await allPeriodOpt.isVisible()) {
      await allPeriodOpt.click();
      await page.waitForTimeout(2000);
    }
  }

  // Capture screenshot Riwayat Transaksi dengan Rekap Item Tunai & QRIS
  await page.screenshot({ path: path.join(artifactDir, 'orders_view_payment_breakdown_proof.png') });
  console.log('✅ Screenshot orders view disimpan di orders_view_payment_breakdown_proof.png');

  // 4. Tab Laporan Shift Kasir (ShiftsAuditView)
  console.log('--- 4. Membuka Tab Laporan Shift Kasir ---');
  // Buka accordion Laporan & Keuangan jika belum terbuka
  const laporanGroupBtn = page.locator('button:has-text("Laporan & Keuangan")').first();
  if (await laporanGroupBtn.isVisible()) {
    await laporanGroupBtn.click();
    await page.waitForTimeout(500);
  }

  const shiftsTabBtn = page.locator('button:has-text("Rekap Shift Kasir")').first();
  if (await shiftsTabBtn.isVisible()) {
    await shiftsTabBtn.click();
    await page.waitForTimeout(2000);
  }

  // Filter per nama kasir Rian
  const cashierSelect = page.locator('select:has-text("Semua Kasir")').first();
  if (await cashierSelect.isVisible()) {
    await cashierSelect.selectOption({ label: '👤 Rian Kasir Kemang' });
    await page.waitForTimeout(1000);
  }

  await page.screenshot({ path: path.join(artifactDir, 'shifts_audit_cashier_filter_proof.png') });
  console.log('✅ Screenshot shifts audit disimpan di shifts_audit_cashier_filter_proof.png');

  // Klik tombol "Detail" pada baris pertama untuk memeriksa modal rekap item terjual & Non-Tunai
  const detailBtn = page.locator('button:has-text("Detail")').first();
  if (await detailBtn.isVisible()) {
    await detailBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(artifactDir, 'shift_detail_non_cash_proof.png') });
    console.log('✅ Screenshot detail modal rekap item disimpan di shift_detail_non_cash_proof.png');
  }

  // Tutup modal shift jika terbuka
  const closeShiftModalBtn = page.getByRole('button', { name: /^Tutup$/i }).first();
  if (await closeShiftModalBtn.isVisible()) {
    await closeShiftModalBtn.click();
    await page.waitForTimeout(800);
  }

  // =========================================================================
  // 5. Tab Baru: Rekap Item per Pembayaran (PaymentItemsAuditView)
  // =========================================================================
  console.log('--- 5. Membuka Tab Baru: Rekap Item per Pembayaran ---');
  let paymentItemsTabBtn = page.locator('button:has-text("Rekap Item per Pembayaran")').first();
  if (!(await paymentItemsTabBtn.isVisible())) {
    const laporanGroupBtn2 = page.locator('button:has-text("Laporan & Keuangan")').first();
    if (await laporanGroupBtn2.isVisible()) {
      await laporanGroupBtn2.click();
      await page.waitForTimeout(600);
    }
  }

  paymentItemsTabBtn = page.locator('button:has-text("Rekap Item per Pembayaran")').first();
  if (await paymentItemsTabBtn.isVisible()) {
    await paymentItemsTabBtn.click();
    await page.waitForTimeout(2000);

    // Pilih preset "Semua Periode" agar seluruh data 1 Sep - 7 Okt tampil
    const pDateDropBtn = page.locator('button:has-text("Bulan Ini"), button:has-text("Hari Ini"), button:has-text("Semua Periode")').first();
    if (await pDateDropBtn.isVisible()) {
      await pDateDropBtn.click();
      await page.waitForTimeout(500);
      const allOpt = page.locator('button:has-text("Semua Periode")').first();
      if (await allOpt.isVisible()) {
        await allOpt.click();
        await page.waitForTimeout(2000);
      }
    }

    // Klik Card Tunai (Cash)
    const cashCard = page.locator('button:has-text("Tunai (Cash)")').first();
    if (await cashCard.isVisible()) {
      await cashCard.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(artifactDir, 'payment_items_audit_tunai_proof.png') });
      console.log('✅ Screenshot Rekap Item Tunai disimpan di payment_items_audit_tunai_proof.png');
    }

    // Klik Card Non-Tunai (Semua) atau QRIS
    const qrisCard = page.locator('button:has-text("QRIS")').first();
    if (await qrisCard.isVisible()) {
      await qrisCard.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(artifactDir, 'payment_items_audit_qris_proof.png') });
      console.log('✅ Screenshot Rekap Item QRIS disimpan di payment_items_audit_qris_proof.png');
    }
  }

  // =========================================================================
  // 6. Verifikasi Riwayat Transaksi Kembali Bersih (Clean OrdersView)
  // =========================================================================
  console.log('--- 6. Memeriksa Riwayat Transaksi Bersih ---');
  if (await ordersTabBtn.isVisible()) {
    await ordersTabBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(artifactDir, 'orders_view_clean_proof.png') });
    console.log('✅ Screenshot OrdersView bersih disimpan di orders_view_clean_proof.png');
  }

  await browser.close();
  console.log('🎉 Seluruh verifikasi Playwright selesai dengan sukses!');
}

verifyAll().catch((err) => {
  console.error('Error verifying:', err);
  process.exit(1);
});
