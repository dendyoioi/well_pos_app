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
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { prisma } from '../config/prisma';

declare const window: any;
declare const document: any;
declare const localStorage: any;
declare const sessionStorage: any;
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
    // 0. Setup isolated test tenant with active subscription (tanpa underscore agar cocok di input ID Toko)
    tenantData = await createIsolatedQATenant('QAUI');
    await seedSubscriptionForTenant(tenantData.tenantId, 500);
    const tenantRecord = await prisma.tenant.findUnique({ where: { id: tenantData.tenantId } });

    // Seed akun staf CASHIER 5-digit (10099 / PIN 123456) untuk uji Skenario 6
    const cashierPinHash = await bcrypt.hash('123456', 10);
    await prisma.user.create({
      data: {
        tenantId: tenantData.tenantId,
        outletId: tenantData.outletId,
        userCode: '10099',
        name: 'Kasir Mobile QA',
        firstName: 'Kasir',
        lastName: 'QA',
        email: `kasir.mobile.${tenantData.timestamp.slice(-6)}@wellpos.qa`,
        passwordHash: cashierPinHash,
        pinHash: cashierPinHash,
        role: Role.CASHIER,
        isActive: true,
      },
    });

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
    // =========================================================================
    // SKENARIO 5: TRANSAKSI BARU (F1) & MODA ANTAR-JEMPUT LAUNDRY — MOBILE 390x844
    // Memastikan: tombol F1 membuka modal Cari Pelanggan, Moda Antar-Jemput tidak
    // menggencet daftar Item Cucian (height >= 60px), serta Sticky Footer F2 tetap utuh.
    // =========================================================================
    const t5 = Date.now();
    try {
      console.log('\n▶️ [SKENARIO 5] Transaksi Baru (F1) & Moda Antar-Jemput Laundry pada Mobile 390x844...');

      // 5.0 Pastikan kita di halaman Kasir POS Laundry (pos)
      // Gunakan desktop dulu agar navigasi sidebar mudah, baru switch ke mobile
      await page.setViewportSize(VIEWPORTS.desktop);
      await navigateToTab(page, 'pos');
      // Tunggu lebih lama agar loadCurrentShift() async selesai fetch dari API
      await page.waitForTimeout(2000);
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.waitForTimeout(500);

      // --- 5.1 Klik Tombol "Transaksi Baru" (label F1 tersembunyi di mobile < lg) ---
      console.log('   5.1 Klik tombol "Transaksi Baru"...');
      const f1Btn = page.locator('button:has-text("Transaksi Baru")').first();
      await f1Btn.waitFor({ state: 'visible', timeout: 8000 });
      await f1Btn.click();
      await page.waitForTimeout(600);

      // 5.1b Handle kasus shift belum aktif: jika StartShiftModal muncul, buka shift dulu
      // (Terjadi jika backend QA tenant memiliki shift OPEN tapi getCurrentShift belum selesai load)
      const startShiftModalVisible = await page
        .locator('text=Buka Shift Kasir Baru')
        .isVisible()
        .catch(() => false);
      if (startShiftModalVisible) {
        console.log('   ℹ️ StartShiftModal muncul — membuka shift kasir otomatis untuk lanjut uji F1...');
        // Isi starting cash default (input number, kosongkan & isi 100000)
        const cashInput = page.locator('input[type="number"]').first();
        await cashInput.fill('100000');
        // Klik submit "Mulai Sesi Shift"
        const mulaiShiftBtn = page.locator('button:has-text("Mulai Sesi Shift")');
        await mulaiShiftBtn.waitFor({ state: 'visible', timeout: 5000 });
        await mulaiShiftBtn.click();
        // Tunggu StartShiftModal tertutup
        await page.waitForSelector('text=Buka Shift Kasir Baru', { state: 'hidden', timeout: 10000 });
        await page.waitForTimeout(800);
        // Klik F1 lagi setelah shift aktif
        await f1Btn.click();
        await page.waitForTimeout(600);
      }

      // 5.2 Verifikasi modal Cari Pelanggan terbuka
      // (handleNewTransaction membuka CustomerSearchModal setelah shift aktif & reset state)
      const customerModalVisible = await Promise.race([
        page
          .waitForSelector('text=Cari Pelanggan Terdaftar', { timeout: 7000 })
          .then(() => true)
          .catch(() => false),
        page
          .waitForSelector('input[placeholder*="Cari nama / nomor WhatsApp"]', { timeout: 7000 })
          .then(() => true)
          .catch(() => false),
      ]);

      // Debug: jika gagal, dump teks visible di halaman untuk diagnosa
      if (!customerModalVisible) {
        const pageText = await page.evaluate(() =>
          Array.from(document.querySelectorAll('h3, h2, [role="dialog"] *')).slice(0, 20).map((el: any) => el.textContent?.trim()).filter(Boolean).join(' | ')
        );
        console.log('   🔍 Debug DOM teks visible (h3/dialog):', pageText.slice(0, 300));
      }
      assert(customerModalVisible, 'Menekan F1 harus membuka modal "Cari Pelanggan Terdaftar"');
      console.log('   ✅ Modal Cari Pelanggan terbuka setelah klik F1.');

      // 5.3 Tutup modal Cari Pelanggan via Escape dan tunggu benar-benar hilang
      await page.keyboard.press('Escape');
      // Tunggu teks modal hilang dari DOM sebelum lanjut
      await page.waitForSelector('text=Cari Pelanggan Terdaftar', { state: 'hidden', timeout: 5000 }).catch(() => { });
      await page.waitForTimeout(400);

      // --- 5.4 Buka Bottom Sheet Nota Kasir ---
      console.log('   5.4 Buka bottom sheet "Lihat Nota"...');
      // "Lihat Nota" ada di Mobile Sticky Bottom Bar (lg:hidden). Pastikan kita di mobile viewport.
      const lihatNotaBtn = page.locator('button:has-text("Lihat Nota")');
      await lihatNotaBtn.waitFor({ state: 'visible', timeout: 8000 });
      await lihatNotaBtn.click();
      await page.waitForTimeout(600);

      // Verifikasi bottom sheet terbuka: cek keberadaan h3 "Nota Kasir Laundry"
      const bottomSheetVisible = await page
        .waitForSelector('text=Nota Kasir Laundry', { timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      assert(bottomSheetVisible, 'Bottom sheet Nota Kasir harus terbuka di mobile setelah klik "Lihat Nota"');

      // --- 5.5 Pilih Moda "Antar Saja" & verifikasi item tidak tergencet ---
      console.log('   5.5 Klik opsi "Antar Saja"...');
      // Scope ke dalam mobile bottom sheet (div rounded-t-3xl) agar tidak bentrok
      // dengan button "Antar Saja" di desktop cart panel yang ter-hidden via CSS
      const mobileSheet = page.locator('div[class*="rounded-t-3xl"]');
      const antarSajaBtn = mobileSheet.locator('button:has-text("Antar Saja")').first();
      await antarSajaBtn.waitFor({ state: 'visible', timeout: 6000 });
      await antarSajaBtn.click();
      await page.waitForTimeout(400);

      // Verifikasi item cucian container tidak ter-squash (height >= 60px)
      const itemHeightAntarSaja = await page.evaluate(() => {
        // Cari container item cucian: kemungkinan div dengan overflow-y-auto di dalam sheet
        const scrollables = Array.from(
          document.querySelectorAll('[class*="overflow-y-auto"], [class*="overflow-auto"]')
        );
        // Ambil yang paling dalam / paling besar
        let maxH = 0;
        scrollables.forEach((el: any) => {
          const rect = el.getBoundingClientRect();
          if (rect.height > maxH) maxH = rect.height;
        });
        return maxH;
      });
      assert(
        itemHeightAntarSaja >= 60,
        `Area scrollable nota (item cucian) wajib >= 60px saat moda "Antar Saja", didapat: ${itemHeightAntarSaja}px`
      );
      console.log(`   ✅ Moda "Antar Saja": area item cucian = ${itemHeightAntarSaja}px (tidak tergencet).`);

      // Periksa zero horizontal overflow di state Antar Saja
      await checkZeroOverflow(page, 'Nota Kasir Laundry — Antar Saja', 'Mobile 390x844');

      // --- 5.6 Pilih Moda "Jemput & Antar" & verifikasi ulang ---
      console.log('   5.6 Klik opsi "Jemput & Antar"...');
      const jemputAntarBtn = mobileSheet.locator('button:has-text("Jemput & Antar")').first();
      await jemputAntarBtn.waitFor({ state: 'visible', timeout: 6000 });
      await jemputAntarBtn.click();
      await page.waitForTimeout(400);

      const itemHeightJemputAntar = await page.evaluate(() => {
        const scrollables = Array.from(
          document.querySelectorAll('[class*="overflow-y-auto"], [class*="overflow-auto"]')
        );
        let maxH = 0;
        scrollables.forEach((el: any) => {
          const rect = el.getBoundingClientRect();
          if (rect.height > maxH) maxH = rect.height;
        });
        return maxH;
      });
      assert(
        itemHeightJemputAntar >= 60,
        `Area scrollable nota (item cucian) wajib >= 60px saat moda "Jemput & Antar", didapat: ${itemHeightJemputAntar}px`
      );
      console.log(`   ✅ Moda "Jemput & Antar": area item cucian = ${itemHeightJemputAntar}px (tidak tergencet).`);

      // Periksa zero horizontal overflow di state Jemput & Antar
      await checkZeroOverflow(page, 'Nota Kasir Laundry — Jemput & Antar', 'Mobile 390x844');

      // --- 5.7 Verifikasi Sticky Action Footer F2 tetap utuh di viewport bawah ---
      console.log('   5.7 Verifikasi sticky footer F2 tetap terlihat di viewport bawah...');
      const footerIntact = await page.evaluate(() => {
        // Footer harus memiliki teks "F2" atau "Terima Cucian"
        const allBtns = Array.from(document.querySelectorAll('button'));
        const f2Btn = allBtns.find(
          (b: any) => b.textContent?.includes('F2') || b.textContent?.includes('Terima Cucian')
        );
        if (!f2Btn) return { visible: false, reason: 'Tombol F2/Terima Cucian tidak ditemukan' };
        const rect = (f2Btn as any).getBoundingClientRect();
        // Tombol harus berada di separuh bawah viewport dan terlihat penuh
        const inView = rect.top < (window as any).innerHeight && rect.bottom <= (window as any).innerHeight + 10;
        return {
          visible: inView,
          reason: inView
            ? 'OK'
            : `rect.top=${rect.top.toFixed(0)}, rect.bottom=${rect.bottom.toFixed(0)}, vh=${(window as any).innerHeight}`,
        };
      });
      assert(
        (footerIntact as any).visible,
        `Sticky Footer F2 harus tetap terlihat di viewport bawah: ${(footerIntact as any).reason}`
      );
      console.log('   ✅ Sticky Footer F2 tetap utuh di viewport bawah.');

      results.push({
        name: 'Transaksi Baru F1 & Moda Antar-Jemput Laundry (Mobile 390x844)',
        status: 'PASS',
        durationMs: Date.now() - t5,
      });
      console.log(
        '   ✅ PASS: F1 membuka modal pelanggan, Moda Antar-Jemput tidak menggencet item cucian, Sticky Footer F2 aman.'
      );
    } catch (err: any) {
      results.push({
        name: 'Transaksi Baru F1 & Moda Antar-Jemput Laundry (Mobile 390x844)',
        status: 'FAIL',
        durationMs: Date.now() - t5,
        error: err.message,
      });
      console.error('   ❌ FAIL:', err.message);
    }

    // =========================================================================
    // SKENARIO 6: AUDIT MOBILE WORKSHOP & MODALS (390x844)
    // Prioritas SLA & Batch, Modal Batch Mesin, Modal Kelola Mesin, dan
    // Modal Pengaturan Tahapan Produksi — zero overflow, zero "+ +", zero "SmartOwner"
    // =========================================================================
    const t6_workshop = Date.now();
    try {
      console.log('\n▶️ [SKENARIO 6] Mobile Workshop, Prioritas SLA & Modals Hygiene (390x844)...');
      await page.setViewportSize(VIEWPORTS.mobile);

      // 6A. Navigasi ke Antrian Produksi Workshop (laundry_production)
      await navigateToTab(page, 'laundry_production');
      await page.waitForTimeout(900);
      await checkZeroOverflow(page, 'Workshop Produksi', 'Mobile 390x844');

      // Klik tab "Prioritas SLA & Batch"
      const slaTabBtn = page.locator('button:has-text("Prioritas SLA")').first();
      await slaTabBtn.waitFor({ state: 'visible', timeout: 8000 });
      await slaTabBtn.click();
      await page.waitForTimeout(700);
      await checkZeroOverflow(page, 'Prioritas SLA & Batch', 'Mobile 390x844');

      // Verifikasi container filter tier tidak jebol keluar card
      const filterCheck = await page.evaluate(() => {
        const regulerBtn = Array.from(document.querySelectorAll('button')).find(
          (b: any) => (b.textContent || '').trim() === 'Reguler'
        ) as any;
        if (!regulerBtn) return { ok: false, reason: 'Tombol filter "Reguler" tidak ditemukan' };
        const filterContainer = regulerBtn.parentElement;
        const cardContainer = filterContainer?.closest('.rounded-2xl');
        if (!filterContainer || !cardContainer) return { ok: false, reason: 'Container filter/card tidak ditemukan' };
        const cRect = cardContainer.getBoundingClientRect();
        const fRect = filterContainer.getBoundingClientRect();
        const ok = fRect.right <= cRect.right + 2;
        return { ok, reason: ok ? 'OK' : `Filter container right (${fRect.right}) > card right (${cRect.right})` };
      });
      assert((filterCheck as any).ok, (filterCheck as any).reason);
      console.log('   ✅ Prioritas SLA & Batch bebas overflow & filter Reguler aman di dalam card.');

      // 6B. Buka Modal "Batch Mesin"
      const batchBtn = page.locator('button:has-text("Batch Mesin")').first();
      await batchBtn.click();
      await page.waitForSelector('text=Manajemen Batch Mesin Cuci', { timeout: 6000 });
      await page.waitForTimeout(400);
      await checkZeroOverflow(page, 'Modal Batch Mesin', 'Mobile 390x844');

      // Verifikasi tab "Buat Batch Baru" bebas tanda "+" ganda dan klik
      const createBatchTab = page.locator('button:has-text("Buat Batch Baru")').first();
      const createBatchTxt = ((await createBatchTab.textContent()) || '').trim();
      assert(
        !createBatchTxt.startsWith('+') && !createBatchTxt.includes('++'),
        `Tab Buat Batch Baru tidak boleh memiliki tanda "+" ganda, didapat: "${createBatchTxt}"`
      );
      await createBatchTab.click();
      await page.waitForTimeout(400);
      await checkZeroOverflow(page, 'Modal Batch Mesin — Tab Buat Batch', 'Mobile 390x844');

      // Verifikasi tinggi 2 tombol Tahap Siklus Mesin simetris
      const cycleBtnCheck = await page.evaluate(() => {
        const washing = Array.from(document.querySelectorAll('button')).find((b: any) =>
          (b.textContent || '').includes('Mesin Cuci')
        ) as any;
        const drying = Array.from(document.querySelectorAll('button')).find((b: any) =>
          (b.textContent || '').includes('Mesin Pengering')
        ) as any;
        if (!washing || !drying) return { ok: false, reason: 'Tombol Mesin Cuci/Pengering tidak ditemukan' };
        const h1 = washing.getBoundingClientRect().height;
        const h2 = drying.getBoundingClientRect().height;
        const diff = Math.abs(h1 - h2);
        return { ok: diff <= 2 && h1 >= 48, h1, h2, reason: `h1=${h1}, h2=${h2}` };
      });
      assert((cycleBtnCheck as any).ok, `Tombol siklus mesin harus seragam: ${(cycleBtnCheck as any).reason}`);
      console.log(`   ✅ Modal Batch Mesin rapi: tombol siklus simetris (${(cycleBtnCheck as any).h1}px vs ${(cycleBtnCheck as any).h2}px).`);

      // Tutup Modal Batch Mesin
      await page.locator('div.fixed.inset-0.z-50 button').filter({ has: page.locator('svg') }).first().click();
      await page.waitForTimeout(300);

      // 6C. Buka Modal "Kelola Mesin"
      const manageMachineBtn = page.locator('button:has-text("Kelola Mesin")').first();
      await manageMachineBtn.click();
      await page.waitForSelector('text=Kelola Mesin Cuci & Pengering', { timeout: 6000 });
      await page.waitForTimeout(400);
      await checkZeroOverflow(page, 'Modal Kelola Mesin', 'Mobile 390x844');

      const addMachineBtnCheck = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b: any) => (b.textContent || '').trim() === 'Tambah Mesin'
        ) as any;
        if (!btn) return { ok: false, reason: 'Tombol "Tambah Mesin" tidak ditemukan' };
        const rect = btn.getBoundingClientRect();
        return { ok: rect.height >= 34 && rect.height <= 44, height: rect.height };
      });
      assert(
        (addMachineBtnCheck as any).ok,
        `Tombol Tambah Mesin harus proporsional 1 baris (34-44px), didapat: ${(addMachineBtnCheck as any).height}px`
      );
      console.log(`   ✅ Modal Kelola Mesin proporsional: tombol Tambah Mesin = ${(addMachineBtnCheck as any).height}px.`);

      // Tutup Modal Kelola Mesin
      await page.locator('div.fixed.inset-0.z-50 button').filter({ has: page.locator('svg') }).first().click();
      await page.waitForTimeout(300);

      // 6D. Navigasi ke Katalog Layanan & Buka Modal "Atur Tahapan Produksi"
      await navigateToTab(page, 'laundry_services');
      await page.waitForTimeout(800);
      const stageSettingsBtn = page.locator('button:has-text("Atur Tahapan Produksi")').first();
      await stageSettingsBtn.waitFor({ state: 'visible', timeout: 8000 });
      await stageSettingsBtn.click();
      await page.waitForSelector('text=Pengaturan Tahapan Produksi', { timeout: 6000 });
      await page.waitForTimeout(500);
      await checkZeroOverflow(page, 'Modal Pengaturan Tahapan Produksi', 'Mobile 390x844');

      const stageAudit = await page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        const hasSmartOwner = bodyText.includes('SmartOwner');
        const hasSmartKasir = bodyText.includes('SmartKasir');
        return { hasSmartOwner, hasSmartKasir };
      });
      assert(!stageAudit.hasSmartOwner, 'Teks "SmartOwner" masih muncul di UI!');
      assert(!stageAudit.hasSmartKasir, 'Teks "SmartKasir" masih muncul di UI!');
      console.log('   ✅ Modal Pengaturan Tahapan Produksi bebas overflow & bebas teks "SmartOwner"/"SmartKasir".');

      // Tutup Modal Pengaturan Tahapan Produksi
      await page.locator('button:has-text("Batal"):visible').first().click();
      await page.waitForTimeout(300);

      results.push({
        name: 'Mobile Workshop, SLA Queue & Modals Hygiene (390x844, Zero SmartOwner)',
        status: 'PASS',
        durationMs: Date.now() - t6_workshop,
      });
      console.log('   ✅ PASS: Seluruh modal workshop/layanan proporsional di 390x844 & bebas SmartOwner.');
    } catch (err: any) {
      results.push({
        name: 'Mobile Workshop, SLA Queue & Modals Hygiene (390x844, Zero SmartOwner)',
        status: 'FAIL',
        durationMs: Date.now() - t6_workshop,
        error: err.message,
      });
      console.error('   ❌ FAIL:', err.message);
    }

    // =========================================================================
    // SKENARIO 7: GELOMBANG 1 MOBILE UI AUDIT SWEEP (390x844)
    // Verifikasi: Owner Portal, Orders, Payment Items, Financial Report,
    // Product Analytics, Promotions, Staff Roles (+ Matrix), Outlets, & Settings
    // bebas horizontal overflow, bebas "+ +" ganda, bebas "SmartOwner",
    // & PwaInstallBanner (jika tampil) tidak menimpa Bottom Navigation.
    // =========================================================================
    const t7_wave1 = Date.now();
    try {
      console.log('\n▶️ [SKENARIO 7] Gelombang 1 Mobile UI Audit Sweep (12 Halaman di 390x844)...');
      await page.setViewportSize(VIEWPORTS.mobile);

      const wave1Tabs: Array<{ key: string; label: string }> = [
        { key: 'orders', label: 'OrdersView' },
        { key: 'payment_items', label: 'PaymentItemsAuditView' },
        { key: 'reports', label: 'FinancialReportView' },
        { key: 'product_analytics', label: 'ProductAnalyticsView' },
        { key: 'promotions', label: 'PromotionsView' },
        { key: 'staff_roles', label: 'StaffRolesView' },
        { key: 'outlets', label: 'OutletsView' },
        { key: 'settings_receipt', label: 'ReceiptSettingsView' },
        { key: 'settings_payment', label: 'PaymentSettingsView' },
        { key: 'settings_taxes', label: 'TaxesSettingsView' },
        { key: 'settings_loyalty', label: 'LoyaltySettingsView' },
      ];

      for (const tab of wave1Tabs) {
        await navigateToTab(page, tab.key);
        await page.waitForTimeout(550);
        await checkZeroOverflow(page, tab.label, 'Mobile 390x844');

        // Audit global per halaman: zero SmartOwner/SmartKasir, zero "+ +" ganda, PWA Banner non-overlap
        const hygiene = await page.evaluate(() => {
          const text = document.body.innerText || '';
          const hasSmartOwner = text.includes('SmartOwner');
          const hasSmartKasir = text.includes('SmartKasir');

          // Deteksi button dengan ikon SVG + teks yang masih diawali tanda "+ "
          const buttons = Array.from(document.querySelectorAll('button'));
          const doublePlusBtn = buttons.find((b: any) => {
            const hasSvg = Boolean(b.querySelector('svg'));
            const btnText = (b.innerText || '').trim();
            return hasSvg && (/^\+\s/.test(btnText) || btnText.includes('++'));
          }) as any;

          // Cek posisi PwaInstallBanner jika muncul
          const pwaEl = Array.from(document.querySelectorAll('div')).find((el: any) =>
            (el.innerText || '').includes('Pasang Aplikasi Well POS') &&
            (window as any).getComputedStyle(el).position === 'fixed'
          ) as any;
          let pwaOverlap = false;
          if (pwaEl) {
            const rect = pwaEl.getBoundingClientRect();
            // Bottom nav mobile umumnya tinggi ~56-64px di bagian paling bawah layar
            pwaOverlap = rect.bottom > (window as any).innerHeight - 52;
          }

          return {
            hasSmartOwner,
            hasSmartKasir,
            doublePlusText: doublePlusBtn ? (doublePlusBtn.innerText || '').trim() : null,
            pwaOverlap,
          };
        });

        assert(!hygiene.hasSmartOwner, `Teks "SmartOwner" ditemukan pada ${tab.label}`);
        assert(!hygiene.hasSmartKasir, `Teks "SmartKasir" ditemukan pada ${tab.label}`);
        assert(
          !hygiene.doublePlusText,
          `Tombol "+ ..." ganda dengan ikon ditemukan pada ${tab.label}: "${hygiene.doublePlusText}"`
        );
        assert(!hygiene.pwaOverlap, `PwaInstallBanner menimpa Bottom Nav pada ${tab.label}`);
      }
      console.log('   ✅ Seluruh 11 halaman Backoffice Gelombang 1 lolos 390x844 (0 overflow, 0 double +, 0 SmartOwner).');

      // Uji interaktif singkat pada StaffRolesView (Matriks Izin)
      await navigateToTab(page, 'staff_roles');
      await page.waitForTimeout(450);
      const addRoleBtn = page.locator('button:has-text("Tambah Peran Kustom")').first();
      await addRoleBtn.waitFor({ state: 'visible', timeout: 6000 });
      await addRoleBtn.click();
      await page.waitForTimeout(450);
      await checkZeroOverflow(page, 'StaffRolesView — Matrix Editor', 'Mobile 390x844');
      await page.locator('button:has-text("Batal"):visible').first().click();
      await page.waitForTimeout(300);
      console.log('   ✅ StaffRolesView Matrix Editor bebas overflow di 390x844.');

      // Uji OwnerPortalPage pada Mobile 390x844 (3 Tab: Bisnis Saya, Paket & Token, Invoice)
      const ownerPortalBtn = page.locator('button[title="Buka Owner Portal & Kelola Bisnis"]').first();
      await ownerPortalBtn.waitFor({ state: 'visible', timeout: 6000 });
      await ownerPortalBtn.click();
      await page.waitForSelector('text=Owner Portal', { timeout: 10000 });
      await page.waitForTimeout(700);
      await checkZeroOverflow(page, 'OwnerPortalPage — Bisnis Saya', 'Mobile 390x844');

      await page.locator('button:has-text("Paket & Beli Token")').first().click();
      await page.waitForTimeout(400);
      await checkZeroOverflow(page, 'OwnerPortalPage — Paket & Beli Token', 'Mobile 390x844');

      await page.locator('button:has-text("Invoice & Pemakaian Token")').first().click();
      await page.waitForTimeout(400);
      await checkZeroOverflow(page, 'OwnerPortalPage — Invoice & Token', 'Mobile 390x844');
      console.log('   ✅ OwnerPortalPage (3 tab) lolos zero overflow di 390x844.');

      results.push({
        name: 'Gelombang 1 Mobile UI Audit Sweep (Owner Portal, Orders, Reports, Promo, Roles & Settings)',
        status: 'PASS',
        durationMs: Date.now() - t7_wave1,
      });
      console.log('   ✅ PASS: Seluruh 12+ halaman & modal Gelombang 1 lolos standar anti-cacat mobile 390x844.');
    } catch (err: any) {
      results.push({
        name: 'Gelombang 1 Mobile UI Audit Sweep (Owner Portal, Orders, Reports, Promo, Roles & Settings)',
        status: 'FAIL',
        durationMs: Date.now() - t7_wave1,
        error: err.message,
      });
      console.error('   ❌ FAIL:', err.message);
    }

    // =========================================================================
    // SKENARIO 8: ROLE CASHIER MOBILE/PWA (LOGIN PIN 5-DIGIT, HAMBURGER MENU,
    // PRINTER MODAL, HEADER RINGKAS & FULL-WIDTH CTA TANPA SHORTCUT F2)
    // =========================================================================
    const t6 = Date.now();
    try {
      console.log('\n▶️ [SKENARIO 8] Role CASHIER Mobile/PWA (PIN Login, Hamburger, Printer Modal, CTA Full-Width)...');

      // 6.0 Reset session & buka halaman login pada viewport Mobile 390x844
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.goto(`${BASE_FRONTEND}/#pos`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);

      // 6.1 Login sebagai CASHIER via ID Toko + ID Staff 5-digit (10099) + PIN 6-digit (123456)
      const slugInput = page.locator('input[placeholder*="DND-4829001"]');
      await slugInput.waitFor({ state: 'visible', timeout: 8000 });
      await slugInput.fill((tenantRecord?.slug || '').toUpperCase());

      const staffCodeInput = page.locator('input[placeholder*="00001"]');
      await staffCodeInput.fill('10099');

      const pinInput = page.locator('input[placeholder="••••••"]');
      await pinInput.fill('123456');

      const pairBtn = page.locator('button:has-text("Hubungkan Mesin Kasir")');
      await pairBtn.click();

      // Tunggu sampai langsung masuk ke Kasir Laundry
      await page.waitForSelector('h1:has-text("Kasir Laundry")', { timeout: 15000 });
      await page.waitForTimeout(1000);

      // 6.2 Pastikan zero horizontal overflow di halaman Kasir Laundry CASHIER
      await checkZeroOverflow(page, 'Cashier Laundry POS', 'Mobile 390x844');

      // 6.3 Pastikan tinggi header + toolbar kasir di 390px terukur nyata & tetap ringkas (> 40px & <= 145px)
      const headerHeight = await page.evaluate(() => {
        const headers = Array.from(document.querySelectorAll('header'));
        const kasirHeader = headers.find((h: any) => (h.textContent || '').includes('Kasir Laundry')) as any;
        return kasirHeader ? kasirHeader.getBoundingClientRect().height : 0;
      });
      assert(
        headerHeight > 40 && headerHeight <= 145,
        `Tinggi header + toolbar Kasir Laundry pada mobile 390px wajib ringkas (40..145px), didapat: ${headerHeight.toFixed(1)}px`
      );
      console.log(`   ✅ Header + toolbar Kasir Laundry ringkas di 390px: ${headerHeight.toFixed(1)}px.`);

      // 6.4 Klik tombol Hamburger Menu di header Kasir Laundry & verifikasi Navigation Drawer
      const hamburgerBtn = page.locator('header button[aria-label="Buka Menu Navigasi"]').first();
      await hamburgerBtn.waitFor({ state: 'visible', timeout: 6000 });
      await hamburgerBtn.click();
      await page.waitForTimeout(400);

      const drawerContent = await page.evaluate(() => document.body.innerText || '');
      const requiredMenus = ['Riwayat Transaksi', 'Laporan Shift Kasir', 'Pelanggan', 'Kunci Terminal Kasir', 'Keluar Akun'];
      for (const menuLabel of requiredMenus) {
        assert(
          drawerContent.includes(menuLabel),
          `Navigation Drawer CASHIER wajib menampilkan menu "${menuLabel}"`
        );
      }
      console.log('   ✅ Hamburger Menu membuka Navigation Drawer lengkap (Riwayat, Shift, Pelanggan, Kunci Terminal, Keluar Akun).');

      // Tutup Navigation Drawer
      const drawerCloseBtn = page.locator('div.fixed.inset-0.z-50 button').filter({ has: page.locator('svg') }).first();
      await drawerCloseBtn.click();
      await page.waitForTimeout(300);

      // 6.5 Klik tombol ikon Printer di header & verifikasi ThermalPrinterModal terbuka (bukan mental diam)
      const printerBtn = page.locator('header button[title="Pengaturan Printer Thermal"]').first();
      await printerBtn.waitFor({ state: 'visible', timeout: 6000 });
      await printerBtn.click();
      await page.waitForTimeout(400);

      const printerModalVisible = await page
        .waitForSelector('text=Pusat Hardware Printer & Laci Kasir', { timeout: 6000 })
        .then(() => true)
        .catch(() => false);
      assert(printerModalVisible, 'Klik ikon Printer oleh CASHIER wajib membuka modal Pengaturan Printer Thermal');
      console.log('   ✅ Tombol ikon Printer membuka modal Pengaturan Printer Thermal.');

      // Tutup ThermalPrinterModal
      const closePrinterBtn = page.locator('button[title="Tutup Jendela"]').first();
      await closePrinterBtn.click();
      await page.waitForTimeout(300);

      // 6.6 Buka Bottom Sheet "Lihat Nota" & verifikasi CTA "Terima Cucian & Struk" full-width tanpa "Shortcut F2"
      const lihatNotaBtn = page.locator('button:has-text("Lihat Nota")').first();
      await lihatNotaBtn.waitFor({ state: 'visible', timeout: 6000 });
      await lihatNotaBtn.click();
      await page.waitForTimeout(500);

      const mobileSheet = page.locator('div[class*="rounded-t-3xl"]');
      await mobileSheet.waitFor({ state: 'visible', timeout: 6000 });

      const ctaCheck = await page.evaluate(() => {
        const sheet = document.querySelector('div[class*="rounded-t-3xl"]');
        if (!sheet) return { ok: false, reason: 'Bottom sheet tidak ditemukan' };

        const sheetText = (sheet as any).innerText || '';
        if (sheetText.includes('Shortcut F2')) {
          return { ok: false, reason: 'Label "Shortcut F2" masih terlihat di mobile' };
        }

        const ctaBtn = Array.from(sheet.querySelectorAll('button')).find((b: any) =>
          (b.innerText || '').includes('Terima Cucian & Struk')
        ) as any;
        if (!ctaBtn) {
          return { ok: false, reason: 'Tombol CTA "Terima Cucian & Struk" tidak ditemukan' };
        }

        const btnText = (ctaBtn.innerText || '').trim();
        if (btnText.includes('(F2)')) {
          return { ok: false, reason: `Label "(F2)" masih terlihat pada tombol CTA mobile: "${btnText}"` };
        }

        const btnRect = ctaBtn.getBoundingClientRect();
        const parentRect = ctaBtn.parentElement.getBoundingClientRect();
        const isFullWidth = btnRect.width >= parentRect.width * 0.85;
        if (!isFullWidth) {
          return {
            ok: false,
            reason: `Tombol CTA harus full-width di mobile (${btnRect.width.toFixed(0)}px vs container ${parentRect.width.toFixed(0)}px)`,
          };
        }

        return { ok: true, width: btnRect.width, containerWidth: parentRect.width };
      });
      assert((ctaCheck as any).ok, (ctaCheck as any).reason || 'CTA mobile tidak valid');
      console.log(
        `   ✅ CTA "Terima Cucian & Struk" full-width (${(ctaCheck as any).width.toFixed(0)}px/${(ctaCheck as any).containerWidth.toFixed(0)}px) & bebas "Shortcut F2".`
      );

      results.push({
        name: 'Role CASHIER Mobile/PWA (PIN Login, Hamburger, Printer Modal & Full-Width CTA)',
        status: 'PASS',
        durationMs: Date.now() - t6,
      });
      console.log('   ✅ PASS: Seluruh optimasi UI/UX Mobile/PWA Role CASHIER terverifikasi.');
    } catch (err: any) {
      results.push({
        name: 'Role CASHIER Mobile/PWA (PIN Login, Hamburger, Printer Modal & Full-Width CTA)',
        status: 'FAIL',
        durationMs: Date.now() - t6,
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
      } catch { }
    }
    if (tenantData?.tenantId) {
      console.log('🧹 Menjalankan Teardown Bersih Data QA Tenant di DB...');
      await cleanupQATenant(tenantData.tenantId);
    }
  }

  return printSuiteSummary('Suite 4: Responsive Mobile, Tablet, UI Hygiene & Laundry F1/Antar-Jemput', results);
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
