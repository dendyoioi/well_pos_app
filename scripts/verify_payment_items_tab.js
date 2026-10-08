// scripts/verify_payment_items_tab.js
const { chromium } = require('../pos_apps/node_modules/playwright');
const path = require('path');

const artifactDir = '/Users/dendyaditya/.gemini/antigravity-ide/brain/31257e4b-7e59-4918-8f39-a77f6d9b7aae';

async function testTab() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

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

  // Buka accordion Laporan & Keuangan
  console.log('Membuka Laporan & Keuangan...');
  const laporanBtn = page.locator('button:has-text("Laporan & Keuangan")').first();
  await laporanBtn.click();
  await page.waitForTimeout(600);

  // Cari tombol Rekap Item per Pembayaran
  console.log('Mencari tombol Rekap Item per Pembayaran...');
  const tabBtn = page.locator('button:has-text("Rekap Item per Pembayaran")').first();
  console.log('tabBtn isVisible:', await tabBtn.isVisible());

  if (await tabBtn.isVisible()) {
    await tabBtn.click();
    await page.waitForTimeout(2000);

    // Ambil screenshot awal tab
    await page.screenshot({ path: path.join(artifactDir, 'payment_items_audit_initial.png') });
    console.log('✅ Screenshot initial tab disimpan');

    // Pilih preset "Semua Periode"
    const dateDropBtn = page.locator('button:has-text("Bulan Ini"), button:has-text("Hari Ini")').first();
    if (await dateDropBtn.isVisible()) {
      await dateDropBtn.click();
      await page.waitForTimeout(500);
      const allOpt = page.locator('button:has-text("Semua Periode")').first();
      if (await allOpt.isVisible()) {
        await allOpt.click();
        await page.waitForTimeout(2000);
      }
    }

    // Klik Card Tunai (Cash)
    console.log('Mengklik card Tunai...');
    const cashCard = page.locator('button:has-text("Tunai (Cash)")').first();
    if (await cashCard.isVisible()) {
      await cashCard.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(artifactDir, 'payment_items_audit_tunai_proof.png') });
      console.log('✅ Screenshot Rekap Item Tunai disimpan di payment_items_audit_tunai_proof.png');
    }

    // Klik Card QRIS
    console.log('Mengklik card QRIS...');
    const qrisCard = page.locator('button:has-text("QRIS")').first();
    if (await qrisCard.isVisible()) {
      await qrisCard.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(artifactDir, 'payment_items_audit_qris_proof.png') });
      console.log('✅ Screenshot Rekap Item QRIS disimpan di payment_items_audit_qris_proof.png');
    }
  }

  await browser.close();
}

testTab().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
