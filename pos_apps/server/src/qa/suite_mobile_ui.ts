/**
 * SUITE 4: RESPONSIVE MOBILE, TABLET & UI HYGIENE
 * File: pos_apps/server/src/qa/suite_mobile_ui.ts
 *
 * Menguji Playwright headless:
 * - 3 Viewports: Mobile (390x844), Tablet (820x1180), Desktop (1440x900)
 * - 7 Key Views:
 *   1. Halaman Login (/login)
 *   2. Overview / Dashboard Utama (overview)
 *   3. Katalog Layanan Laundry (laundry_services)
 *   4. Antrian Workshop & Pelacakan (laundry_queue)
 *   5. Kasir POS Laundry (pos)
 *   6. Manajemen Rak (laundry_racks)
 *   7. Manajemen Pengguna / Karyawan (users)
 * - Asersi UI:
 *   * Zero Horizontal Overflow (scrollWidth <= innerWidth + 1)
 *   * Anti-Overlap Bottom Nav & Sticky Footers
 *   * Absence of "Paket & Kuota" in sidebar
 *   * Functional UI: 5-digit numeric staff input constraint on login
 *   * Functional UI: Staff Create/Auto-Generate 5-digit ID persistence on reload (Zero Silent Drop)
 */

import path from 'path';

declare const window: any;
declare const document: any;
declare const CustomEvent: any;

import {
  createIsolatedQATenant,
  seedSubscriptionForTenant,
  cleanupQATenant,
  assert,
  printSuiteSummary,
  TestScenarioResult,
} from './qa_helpers';

// Helper pemuat Playwright yang tahan banting (resolves dari pos_apps/node_modules)
function getPlaywright() {
  try {
    return require('playwright');
  } catch {
    const candidatePaths = [
      path.resolve(__dirname, '../../../node_modules'),
      path.resolve(__dirname, '../../../../node_modules'),
      path.resolve(process.cwd(), '../node_modules'),
      path.resolve(process.cwd(), 'node_modules'),
    ];
    const resolved = require.resolve('playwright', { paths: candidatePaths });
    return require(resolved);
  }
}

const { chromium } = getPlaywright();

const BASE_FRONTEND = process.env.BASE_FRONTEND || 'http://localhost:5173';
const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 },
  desktop: { width: 1440, height: 900 },
};

async function navigateToTab(page: any, tab: string) {
  await page.evaluate((t: string) => {
    window.dispatchEvent(new CustomEvent('wellpos:navigate_tab', { detail: t }));
  }, tab);
  await page.waitForTimeout(600);
}

async function checkZeroOverflow(page: any, viewName: string, viewportName: string) {
  const result = await page.evaluate(() => {
    const scrollW = document.documentElement.scrollWidth;
    const innerW = window.innerWidth;
    return { scrollW, innerW, noOverflow: scrollW <= innerW + 1 };
  });
  assert(
    result.noOverflow,
    `[OVERFLOW DETECTED] View "${viewName}" pada viewport "${viewportName}" memiliki scrollWidth (${result.scrollW}px) > innerWidth (${result.innerW}px)`
  );
}

export async function runMobileUISuite(): Promise<boolean> {
  console.log('================================================================================');
  console.log('📱 QA CONTINUOUS SUITE 4: RESPONSIVE MOBILE, TABLET & UI HYGIENE');
  console.log('   Target Frontend: ', BASE_FRONTEND);
  console.log('   Browser Engine :  Playwright Chromium (Headless)');
  console.log('   Viewports      :  Mobile (390x844), Tablet (820x1180), Desktop (1440x900)');
  console.log('================================================================================\n');

  const results: TestScenarioResult[] = [];
  let tenantData: any = null;
  let browser: any = null;
  let page: any = null;

  try {
    // 0. Setup isolated test tenant with active subscription
    tenantData = await createIsolatedQATenant('QA_UI');
    await seedSubscriptionForTenant(tenantData.tenantId, 500);

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      viewport: VIEWPORTS.desktop,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 QA-Automation/1.0',
    });
    page = await context.newPage();

    // =========================================================================
    // SKENARIO 1: RESPONSIVE LOGIN PAGE & 5-DIGIT STAFF ID CONSTRAINT
    // =========================================================================
    const t1 = Date.now();
    try {
      console.log('▶️ [SKENARIO 1] Responsive Login Page (3 Viewports) & Validasi ID Staf 5-Digit...');

      // 1.1 Mobile Viewport (390x844)
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto(`${BASE_FRONTEND}/#pos`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      await checkZeroOverflow(page, 'Login Page', 'Mobile 390x844');

      // 1.2 Tablet Viewport (820x1180)
      await page.setViewportSize(VIEWPORTS.tablet);
      await page.waitForTimeout(300);
      await checkZeroOverflow(page, 'Login Page', 'Tablet 820x1180');

      // 1.3 Desktop Viewport (1440x900)
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.waitForTimeout(300);
      await checkZeroOverflow(page, 'Login Page', 'Desktop 1440x900');

      // 1.4 Validasi Fungsional: Input ID Staf hanya menerima digit dan maksimal 5 digit
      const staffCodeInput = page.locator('input[placeholder*="00001"]');
      await staffCodeInput.waitFor({ state: 'visible', timeout: 8000 });

      // Verifikasi atribut input
      const inputMode = await staffCodeInput.getAttribute('inputMode');
      const maxLength = await staffCodeInput.getAttribute('maxLength');
      assert(inputMode === 'numeric', `ID Staf inputMode harus 'numeric', didapat: ${inputMode}`);
      assert(maxLength === '5', `ID Staf maxLength harus '5', didapat: ${maxLength}`);

      // Uji input lebih dari 5 digit
      await staffCodeInput.fill('123456');
      const valOver = await staffCodeInput.inputValue();
      assert(valOver.length <= 5, `ID Staf tidak boleh melebihi 5 digit, didapat: "${valOver}"`);

      // Uji input karakter non-digit
      await staffCodeInput.fill('ABC');
      const valLetters = await staffCodeInput.inputValue();
      assert(!/[a-zA-Z]/.test(valLetters), `ID Staf tidak boleh menerima huruf, didapat: "${valLetters}"`);

      results.push({
        name: 'Responsive Login Page (3 Viewports) & Input ID Staf 5-Digit Constraint',
        status: 'PASS',
        durationMs: Date.now() - t1,
      });
      console.log('   ✅ PASS: Halaman Login responsif tanpa overflow & input ID staf patuh 5 digit angka.');
    } catch (err: any) {
      results.push({
        name: 'Responsive Login Page (3 Viewports) & Input ID Staf 5-Digit Constraint',
        status: 'FAIL',
        durationMs: Date.now() - t1,
        error: err.message,
      });
      console.error('   ❌ FAIL:', err.message);
    }

    // =========================================================================
    // SKENARIO 2: OWNER LOGIN, OVERVIEW DASHBOARD & ABSENCE OF "PAKET & KUOTA"
    // =========================================================================
    const t2 = Date.now();
    try {
      console.log('\n▶️ [SKENARIO 2] Owner Login, Overview Dashboard & Eliminasi Menu "Paket & Kuota"...');

      // Switch ke form login email owner
      await page.setViewportSize(VIEWPORTS.desktop);
      const emailBtn = page.locator('button:has-text("Portal Pemilik (Email)")');
      await emailBtn.click();

      await page.fill('input[type="email"]', tenantData.ownerEmail);
      await page.fill('input[type="password"]', 'Password123!');
      await page.click('button:has-text("Masuk ke Portal Pemilik")');

      // Tunggu hingga masuk ke dashboard
      await page.waitForSelector('button[title="Buka Owner Portal & Kelola Bisnis"]', { timeout: 15000 });
      await page.waitForTimeout(1000);

      // Verifikasi Overview Dashboard pada 3 ukuran layar
      await navigateToTab(page, 'overview');

      // Desktop
      await checkZeroOverflow(page, 'Overview Dashboard', 'Desktop 1440x900');

      // Tablet
      await page.setViewportSize(VIEWPORTS.tablet);
      await page.waitForTimeout(500);
      await checkZeroOverflow(page, 'Overview Dashboard', 'Tablet 820x1180');

      // Mobile
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.waitForTimeout(500);
      await checkZeroOverflow(page, 'Overview Dashboard', 'Mobile 390x844');

      // Verifikasi Eliminasi Menu "Paket & Kuota" di Sidebar
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.waitForTimeout(400);
      const hasOldMenu = await page.evaluate(() => {
        const textElements = Array.from(document.querySelectorAll('nav a, nav button, aside a, aside button'));
        return textElements.some((el: any) => {
          const txt = (el.textContent || '').trim();
          return txt === 'Paket & Kuota' || txt.includes('Paket & Kuota');
        });
      });
      assert(!hasOldMenu, 'Menu duplikat "Paket & Kuota" wajib telah dihapus dari navigasi sidebar');

      results.push({
        name: 'Owner Login, Overview Dashboard (3 Viewports) & Eliminasi "Paket & Kuota"',
        status: 'PASS',
        durationMs: Date.now() - t2,
      });
      console.log('   ✅ PASS: Overview Dashboard bebas overflow & menu Paket & Kuota tereliminasi bersih.');
    } catch (err: any) {
      results.push({
        name: 'Owner Login, Overview Dashboard (3 Viewports) & Eliminasi "Paket & Kuota"',
        status: 'FAIL',
        durationMs: Date.now() - t2,
        error: err.message,
      });
      console.error('   ❌ FAIL:', err.message);
    }

    // =========================================================================
    // SKENARIO 3: RESPONSIVE CORE LAUNDRY VIEWS & ANTI-OVERLAP BOTTOM NAV
    // =========================================================================
    const t3 = Date.now();
    try {
      console.log('\n▶️ [SKENARIO 3] Responsive Core Laundry Views & Mobile Anti-Overlap Bottom Nav...');

      // 3.1 Katalog Layanan (laundry_services)
      await navigateToTab(page, 'laundry_services');
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.waitForTimeout(400);
      await checkZeroOverflow(page, 'Katalog Layanan', 'Desktop 1440x900');
      await page.setViewportSize(VIEWPORTS.tablet);
      await page.waitForTimeout(300);
      await checkZeroOverflow(page, 'Katalog Layanan', 'Tablet 820x1180');
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.waitForTimeout(300);
      await checkZeroOverflow(page, 'Katalog Layanan', 'Mobile 390x844');

      // 3.2 Antrian Workshop (laundry_queue)
      await navigateToTab(page, 'laundry_queue');
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.waitForTimeout(400);
      await checkZeroOverflow(page, 'Antrian Workshop', 'Desktop 1440x900');
      await page.setViewportSize(VIEWPORTS.tablet);
      await page.waitForTimeout(300);
      await checkZeroOverflow(page, 'Antrian Workshop', 'Tablet 820x1180');
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.waitForTimeout(300);
      await checkZeroOverflow(page, 'Antrian Workshop', 'Mobile 390x844');

      // 3.3 Kasir POS Laundry (pos)
      await navigateToTab(page, 'pos');
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.waitForTimeout(400);
      await checkZeroOverflow(page, 'Kasir POS Laundry', 'Desktop 1440x900');
      await page.setViewportSize(VIEWPORTS.tablet);
      await page.waitForTimeout(300);
      await checkZeroOverflow(page, 'Kasir POS Laundry', 'Tablet 820x1180');
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.waitForTimeout(300);
      await checkZeroOverflow(page, 'Kasir POS Laundry', 'Mobile 390x844');

      // 3.4 Asersi Mobile Anti-Overlap: Bottom Bar Kasir di Mobile
      const bottomBarVisible = await page.evaluate(() => {
        const bottomBar = document.querySelector('[class*="fixed bottom-0"]');
        if (!bottomBar) return false;
        const rect = bottomBar.getBoundingClientRect();
        return rect.bottom <= window.innerHeight + 5 && rect.height > 20;
      });
      assert(bottomBarVisible, 'Mobile Kasir Bottom Bar wajib tampil sticky di viewport bawah');

      // 3.5 Manajemen Rak (laundry_racks)
      await navigateToTab(page, 'laundry_racks');
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.waitForTimeout(400);
      await checkZeroOverflow(page, 'Manajemen Rak', 'Desktop 1440x900');
      await page.setViewportSize(VIEWPORTS.tablet);
      await page.waitForTimeout(300);
      await checkZeroOverflow(page, 'Manajemen Rak', 'Tablet 820x1180');
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.waitForTimeout(300);
      await checkZeroOverflow(page, 'Manajemen Rak', 'Mobile 390x844');

      results.push({
        name: 'Responsive Core Laundry Views (Services, Queue, POS, Racks) & Anti-Overlap Nav',
        status: 'PASS',
        durationMs: Date.now() - t3,
      });
      console.log('   ✅ PASS: Seluruh view laundry lolos 3 viewports & bottom nav anti-overlap.');
    } catch (err: any) {
      results.push({
        name: 'Responsive Core Laundry Views (Services, Queue, POS, Racks) & Anti-Overlap Nav',
        status: 'FAIL',
        durationMs: Date.now() - t3,
        error: err.message,
      });
      console.error('   ❌ FAIL:', err.message);
    }

    // =========================================================================
    // SKENARIO 4: USERS VIEW & BROWSER-LEVEL CRUD PERSISTENCE (ZERO SILENT DROP)
    // =========================================================================
    const t4 = Date.now();
    try {
      console.log('\n▶️ [SKENARIO 4] Responsive UsersView & Browser-Level CRUD Persistence...');

      // 4.1 Buka Tab Users
      await navigateToTab(page, 'users');
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.waitForTimeout(800);
      await checkZeroOverflow(page, 'Users Management', 'Desktop 1440x900');

      await page.setViewportSize(VIEWPORTS.tablet);
      await page.waitForTimeout(300);
      await checkZeroOverflow(page, 'Users Management', 'Tablet 820x1180');

      await page.setViewportSize(VIEWPORTS.mobile);
      await page.waitForTimeout(300);
      await checkZeroOverflow(page, 'Users Management', 'Mobile 390x844');

      // 4.2 Kembali ke Desktop untuk pengujian form interaktif
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.waitForTimeout(400);

      // 4.3 Klik Tambah Staf Baru
      const addStaffBtn = page.locator('button:has-text("Tambah Staf Baru"), button:has-text("Tambah Staf")').first();
      await addStaffBtn.waitFor({ state: 'visible', timeout: 8000 });
      await addStaffBtn.click();
      await page.waitForTimeout(600);

      // 4.4 Isi Nama Staf
      const uniqueName = `Staf QA Browser ${Date.now().toString().slice(-4)}`;
      const nameInput = page.locator('input[placeholder="Masukkan nama staf"]');
      await nameInput.waitFor({ state: 'visible', timeout: 5000 });
      await nameInput.fill(uniqueName);

      // 4.5 Uji Tombol "Acak" untuk Auto-Generate ID Staf 5-Digit
      const randomBtn = page.locator('button:has-text("Acak")');
      await randomBtn.click();
      await page.waitForTimeout(500);

      const userCodeInput = page.locator('input[placeholder*="Contoh: 10001"]');
      const generatedCode = await userCodeInput.inputValue();
      assert(/^\d{5}$/.test(generatedCode), `ID Staf auto-generate harus 5-digit angka, didapat: "${generatedCode}"`);

      // 4.6 Isi Email & Kredensial
      const emailInput = page.locator('input[placeholder*="kasir@"]');
      const testEmail = `staf.qa.${Date.now().toString().slice(-6)}@wellpos.qa`;
      await emailInput.fill(testEmail);

      const passwordInput = page.locator('input[placeholder="Minimal 6 karakter"]');
      await passwordInput.fill('Password123!');

      // 4.7 Submit Form
      const submitBtn = page.locator('button:has-text("Tambah Staf")').first();
      await submitBtn.click();

      // Tunggu hingga form tertutup dan kembali ke daftar user
      await page.waitForSelector('input[placeholder="Masukkan nama staf"]', { state: 'hidden', timeout: 10000 });
      await page.waitForTimeout(1000);

      // 4.8 Browser-Level Zero Silent Drop: Reload Halaman & Verifikasi Persistensi
      console.log('   🔄 Me-reload halaman browser untuk menguji persistensi data di tabel...');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('button[title="Buka Owner Portal & Kelola Bisnis"]', { timeout: 15000 });
      await navigateToTab(page, 'users');
      await page.waitForTimeout(1500);

      // Verifikasi nama dan ID Staf 5-digit muncul di tabel browser
      const pageContent = await page.content();
      assert(pageContent.includes(uniqueName), `Nama staf "${uniqueName}" harus tetap tampil di tabel setelah reload`);
      assert(
        pageContent.includes(generatedCode),
        `ID Staf 5-digit "${generatedCode}" harus tetap tampil di tabel setelah reload (Zero Silent Drop)`
      );

      results.push({
        name: 'Responsive UsersView & Browser-Level CRUD Persistence (Zero Silent Drop)',
        status: 'PASS',
        durationMs: Date.now() - t4,
      });
      console.log(`   ✅ PASS: Staf "${uniqueName}" dengan ID "${generatedCode}" persisten 100% setelah reload browser.`);
    } catch (err: any) {
      results.push({
        name: 'Responsive UsersView & Browser-Level CRUD Persistence (Zero Silent Drop)',
        status: 'FAIL',
        durationMs: Date.now() - t4,
        error: err.message,
      });
      console.error('   ❌ FAIL:', err.message);
    }
  } catch (fatalErr: any) {
    console.error('🔥 Fatal error in UI suite execution:', fatalErr);
    results.push({
      name: 'Mobile UI Test Suite Initialization',
      status: 'FAIL',
      durationMs: 0,
      error: fatalErr.message,
    });
  } finally {
    // Teardown: tutup browser & hapus data DB
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    if (tenantData?.tenantId) {
      console.log('🧹 Menjalankan Teardown Bersih Data QA Tenant di DB...');
      await cleanupQATenant(tenantData.tenantId);
    }
  }

  return printSuiteSummary('Suite 4: Responsive Mobile, Tablet & UI Hygiene', results);
}

// Runnable langsung via CLI: tsx src/qa/suite_mobile_ui.ts
if (require.main === module) {
  runMobileUISuite()
    .then((success) => process.exit(success ? 0 : 1))
    .catch((err) => {
      console.error('Suite error:', err);
      process.exit(1);
    });
}
