const { chromium } = require('../pos_apps/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = '/Users/dendyaditya/.gemini/antigravity/brain/f71f8083-0c2f-48e9-b583-29b630ca4a01';
const BASE_URL = 'http://127.0.0.1:5173';

const VIEWPORTS = {
  mobile: { width: 390, height: 844, name: 'Mobile Portrait (390x844)' },
  tablet: { width: 820, height: 1180, name: 'Tablet Portrait (820x1180)' },
  laptop: { width: 1440, height: 900, name: 'Laptop Desktop (1440x900)' },
};

async function loginOwner(page) {
  await page.goto(`${BASE_URL}/#login`, { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(`${BASE_URL}/#login`, { waitUntil: 'networkidle' });
  await page.locator('button:has-text("Portal Pemilik")').first().click();
  await page.locator('input[type="email"]').first().fill('owner.laundry@wellpos.id');
  await page.locator('input[type="password"]').first().fill('pastiwell789');
  await page.locator('button:has-text("Masuk ke Portal Pemilik")').first().click();
  await page.waitForTimeout(3000);
}

async function runAudit() {
  console.log('🚀 Memulai UAT UI Visual Multi-Device...');
  const browser = await chromium.launch({ headless: true });
  const results = {};

  // 1. MOBILE AUDIT (390x844)
  console.log('\n--- 1. MOBILE PORTRAIT (390x844) ---');
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobileContext.newPage();
  await loginOwner(mobilePage);

  // A. POS Terminal View
  await mobilePage.goto(`${BASE_URL}/?tab=pos`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(2000);

  // Verifikasi tombol header "Delivery"
  const deliveryBtnCount = await mobilePage.locator('button:has-text("Delivery")').count();
  console.log(`[Mobile POS] Tombol header "Delivery" ditemukan: ${deliveryBtnCount > 0 ? 'PASS' : 'FAIL'}`);

  // Verifikasi banner Input Pelanggan
  const guardrailText = await mobilePage.locator('text=Tentukan Nama Pelanggan Sebelum Memilih Layanan').first().isVisible();
  console.log(`[Mobile POS] Guardrail banner "Input Pelanggan" terlihat: ${guardrailText ? 'PASS' : 'FAIL'}`);

  // Screenshot POS Mobile
  const posMobilePath = path.join(ARTIFACT_DIR, 'uat_mobile_laundry_pos_terminal.png');
  await mobilePage.screenshot({ path: posMobilePath, fullPage: false });
  console.log(`[Mobile POS] Screenshot tersimpan di: ${posMobilePath}`);

  // B. Quick Dropoff Modal
  console.log('\n[Mobile Modal] Membuka Quick Dropoff Modal...');
  await mobilePage.evaluate(() => {
    window.dispatchEvent(new CustomEvent('wellpos:open_quick_dropoff'));
  });
  await mobilePage.waitForTimeout(1500);

  // Cek Modal Footer dan 2x2 delivery grid
  const modalScope = mobilePage.locator('.fixed.inset-0').last();
  const deliverySegmentCols = await modalScope.locator('.grid-cols-2').count();
  console.log(`[Mobile Modal] Moda Antar-Jemput menggunakan grid 2x2: ${deliverySegmentCols > 0 ? 'PASS' : 'FAIL'}`);

  const simpanBtnVisible = await modalScope.locator('button:has-text("Simpan & Cetak Tag")').isVisible();
  console.log(`[Mobile Modal] Tombol "Simpan & Cetak Tag" di sticky footer terlihat: ${simpanBtnVisible ? 'PASS' : 'FAIL'}`);

  const modalMobilePath = path.join(ARTIFACT_DIR, 'uat_mobile_quick_dropoff_modal.png');
  await mobilePage.screenshot({ path: modalMobilePath, fullPage: false });
  console.log(`[Mobile Modal] Screenshot tersimpan di: ${modalMobilePath}`);

  // Tutup modal
  await modalScope.locator('button:has-text("Batal")').click();
  await mobilePage.waitForTimeout(1000);

  // C. Production View Mobile
  console.log('\n[Mobile Production] Navigasi ke Stasiun Produksi...');
  await mobilePage.goto(`${BASE_URL}/?tab=laundry_production`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(2000);

  const prodHeaderVisible = await mobilePage.locator('text=Stasiun Produksi & Pabrikasi').isVisible();
  const operatorBadgeVisible = await mobilePage.locator('text=Mode Operator Stasiun').isVisible();
  console.log(`[Mobile Production] Header & Badge terlihat: ${prodHeaderVisible && operatorBadgeVisible ? 'PASS' : 'FAIL'}`);

  const prodMobilePath = path.join(ARTIFACT_DIR, 'uat_mobile_laundry_production.png');
  await mobilePage.screenshot({ path: prodMobilePath, fullPage: false });
  console.log(`[Mobile Production] Screenshot tersimpan di: ${prodMobilePath}`);

  // D. Public Tracking Page Mobile
  console.log('\n[Mobile Tracking] Navigasi ke Public Laundry Tracking Page...');
  await mobilePage.goto(`${BASE_URL}/#track?invoice=TEST-DEP-1795240399205`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(2000);

  const trackingMobilePath = path.join(ARTIFACT_DIR, 'uat_mobile_public_tracking.png');
  await mobilePage.screenshot({ path: trackingMobilePath, fullPage: false });
  console.log(`[Mobile Tracking] Screenshot tersimpan di: ${trackingMobilePath}`);

  await mobileContext.close();

  // 2. TABLET AUDIT (820x1180)
  console.log('\n--- 2. TABLET PORTRAIT (820x1180) ---');
  const tabletContext = await browser.newContext({ viewport: { width: 820, height: 1180 } });
  const tabletPage = await tabletContext.newPage();
  await loginOwner(tabletPage);

  await tabletPage.goto(`${BASE_URL}/?tab=pos`, { waitUntil: 'networkidle' });
  await tabletPage.waitForTimeout(2000);
  const posTabletPath = path.join(ARTIFACT_DIR, 'uat_tablet_laundry_pos_terminal.png');
  await tabletPage.screenshot({ path: posTabletPath, fullPage: false });

  await tabletPage.goto(`${BASE_URL}/?tab=laundry_production`, { waitUntil: 'networkidle' });
  await tabletPage.waitForTimeout(2000);
  const prodTabletPath = path.join(ARTIFACT_DIR, 'uat_tablet_laundry_production.png');
  await tabletPage.screenshot({ path: prodTabletPath, fullPage: false });

  await tabletContext.close();

  // 3. LAPTOP AUDIT (1440x900)
  console.log('\n--- 3. LAPTOP DESKTOP (1440x900) ---');
  const laptopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const laptopPage = await laptopContext.newPage();
  await loginOwner(laptopPage);

  await laptopPage.goto(`${BASE_URL}/?tab=pos`, { waitUntil: 'networkidle' });
  await laptopPage.waitForTimeout(2000);
  const posLaptopPath = path.join(ARTIFACT_DIR, 'uat_laptop_laundry_pos_terminal.png');
  await laptopPage.screenshot({ path: posLaptopPath, fullPage: false });

  await laptopPage.goto(`${BASE_URL}/?tab=laundry_production`, { waitUntil: 'networkidle' });
  await laptopPage.waitForTimeout(2000);
  const prodLaptopPath = path.join(ARTIFACT_DIR, 'uat_laptop_laundry_production.png');
  await laptopPage.screenshot({ path: prodLaptopPath, fullPage: false });

  await laptopContext.close();

  await browser.close();
  console.log('\n✅ Seluruh UAT Visual Multi-Device SELESAI!');
}

runAudit().catch(console.error);
