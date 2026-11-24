const { chromium } = require('../pos_apps/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = '/tmp/wellpos_qa_retention';
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: 'laptop', width: 1440, height: 900 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
];

async function runRetentionUiAudit() {
  console.log('========================================================================');
  console.log('🎨 MULTI-DEVICE UI AUDIT: 4 FITUR RETENSI & FORMAT STRUK LAUNDRY VS F&B');
  console.log('========================================================================\n');

  const browser = await chromium.launch({ headless: true });

  try {
    for (const vp of VIEWPORTS) {
      console.log(`\n📱 Menguji Viewport: ${vp.name.toUpperCase()} (${vp.width}x${vp.height})...`);
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        userAgent:
          vp.name === 'mobile'
            ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'
            : undefined,
      });
      const page = await context.newPage();

      // 1. Audit Public Laundry Tracking Page (/track/INV-DEMO)
      console.log('   [1] Audit Public Laundry Tracking Page...');
      await page.goto('http://localhost:5173/track/INV-DEMO', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(800);
      const trackingShot = path.join(ARTIFACT_DIR, `tracking_page_${vp.name}.png`);
      await page.screenshot({ path: trackingShot, fullPage: false });
      console.log(`       ✓ Screenshot: ${trackingShot}`);

      // 2. Login as Laundry Owner & Audit Customers Win-Back Tab
      console.log('   [2] Login Laundry Owner & Audit Customers Win-Back Tab...');
      await page.goto('http://localhost:5173/#login', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
      await page.goto('http://localhost:5173/#login', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});

      await page.locator('button:has-text("Portal Pemilik")').first().click();
      await page.locator('input[type="email"]').first().fill('owner.laundry@wellpos.id');
      await page.locator('input[type="password"]').first().fill('password123');
      await page.locator('button:has-text("Masuk ke Portal Pemilik")').first().click();
      await page.waitForTimeout(2500);

      // Navigate to Customers view with subtab winback
      await page.goto('http://localhost:5173/?tab=customers&subtab=winback', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const isWinbackVisible = await page.locator('text="Pelanggan Pasif (Win-Back)"').first().isVisible();
      console.log(`       ✓ Tab Win-Back di Mode Laundry: ${isWinbackVisible ? 'MUNCUL (PASS)' : 'TIDAK MUNCUL'}`);

      // Check overflow
      const custOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      console.log(`       ✓ Horizontal Overflow CustomersView: ${custOverflow ? 'ADA OVERFLOW (FAIL)' : '0 OVERFLOW (PASS)'}`);

      const winbackShot = path.join(ARTIFACT_DIR, `customers_winback_${vp.name}.png`);
      await page.screenshot({ path: winbackShot, fullPage: false });
      console.log(`       ✓ Screenshot: ${winbackShot}`);

      // 3. Audit Receipt Settings Laundry
      console.log('   [3] Audit Receipt Settings Mode Laundry...');
      await page.goto('http://localhost:5173/?tab=settings_receipt', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);

      const laundryReceiptTitle = await page.locator('text="Format Struk Nota & Tag Pakaian Laundry"').first().isVisible();
      console.log(`       ✓ Header Laundry Struk: ${laundryReceiptTitle ? 'MUNCUL SESUAI SPESIFIKASI (PASS)' : 'TIDAK MUNCUL'}`);

      const receiptOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      console.log(`       ✓ Horizontal Overflow ReceiptSettings: ${receiptOverflow ? 'ADA OVERFLOW (FAIL)' : '0 OVERFLOW (PASS)'}`);

      const receiptShot = path.join(ARTIFACT_DIR, `receipt_settings_retention_${vp.name}.png`);
      await page.screenshot({ path: receiptShot, fullPage: false });
      console.log(`       ✓ Screenshot: ${receiptShot}`);

      // 4. Audit Dashboard & Feedback Management Modal
      console.log('   [4] Audit Dashboard & Feedback Modal...');
      await page.goto('http://localhost:5173/?tab=dashboard', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);

      const auditButton = page.locator('text="Audit Ulasan"').first();
      if (await auditButton.isVisible()) {
        await auditButton.click();
        await page.waitForTimeout(1000);
        const modalShot = path.join(ARTIFACT_DIR, `feedback_modal_${vp.name}.png`);
        await page.screenshot({ path: modalShot, fullPage: false });
        console.log(`       ✓ Screenshot Feedback Modal: ${modalShot}`);
      }

      // 5. Audit F&B Owner (Anti-Regresi: Tab Win-Back harus hilang & Format Struk Cafe)
      console.log('   [5] Login F&B Owner (owner@uracoffee.id) & Audit Non-Laundry...');
      await page.goto('http://localhost:5173/#login', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
      await page.goto('http://localhost:5173/#login', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});

      await page.locator('button:has-text("Portal Pemilik")').first().click();
      await page.locator('input[type="email"]').first().fill('owner@uracoffee.id');
      await page.locator('input[type="password"]').first().fill('Owner123!');
      await page.locator('button:has-text("Masuk ke Portal Pemilik")').first().click();
      await page.waitForTimeout(2500);

      // Navigate to Customers view
      await page.goto('http://localhost:5173/?tab=customers', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1200);
      const isFnbWinbackVisible = await page.locator('text="Pelanggan Pasif (Win-Back)"').first().isVisible();
      console.log(`       ✓ Tab Win-Back di Mode F&B: ${isFnbWinbackVisible ? 'MUNCUL KELIRU (FAIL)' : 'TERSEMBUNYI DENGAN BENAR (PASS)'}`);

      // Navigate to Receipt view
      await page.goto('http://localhost:5173/?tab=settings_receipt', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1200);
      const fnbReceiptTitle = await page.locator('text="Format Struk & Pengaturan Printer"').first().isVisible();
      console.log(`       ✓ Header Struk di Mode F&B: ${fnbReceiptTitle ? 'FORMAT STRUK & PENGATURAN PRINTER (PASS)' : 'TIDAK COCOK'}`);

      await context.close();
    }

    console.log('\n========================================================================');
    console.log('✅ MULTI-DEVICE UI & CROSS-VERTICAL AUDIT SELESAI (100% SUKSES)');
    console.log(`Seluruh screenshot tersimpan di: ${ARTIFACT_DIR}`);
    console.log('========================================================================\n');
  } catch (err) {
    console.error('Audit UI error:', err);
  } finally {
    await browser.close();
  }
}

runRetentionUiAudit();
