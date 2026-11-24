const { chromium } = require('../pos_apps/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = '/tmp/wellpos_qa_ui';
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

const VIEWPORTS = [
  { key: 'mobile', name: 'Mobile Portrait (390x844)', width: 390, height: 844 },
  { key: 'tablet', name: 'Tablet Portrait (820x1180)', width: 820, height: 1180 },
  { key: 'laptop', name: 'Laptop Desktop (1440x900)', width: 1440, height: 900 }
];

async function checkHygiene(page, pageName, viewportKey) {
  return await page.evaluate(({ pageName, viewportKey }) => {
    const issues = [];

    // 1. Check Horizontal Overflow on document/body
    const docWidth = document.documentElement.scrollWidth;
    const winWidth = window.innerWidth;
    if (docWidth > winWidth + 1) {
      const offenders = [];
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        const rect = el.getBoundingClientRect();
        if (rect.right > winWidth + 2 && !el.closest('[class*="overflow-x-auto"], [class*="overflow-x-scroll"], pre, code')) {
          offenders.push({
            tag: el.tagName,
            cls: (el.className || '').toString().slice(0, 100),
            text: (el.innerText || '').slice(0, 40).trim(),
            right: Math.round(rect.right),
            scrollWidth: el.scrollWidth
          });
        }
      }
      issues.push({
        type: 'HORIZONTAL_OVERFLOW',
        detail: `[${pageName}] Doc scrollWidth (${docWidth}px) exceeds window width (${winWidth}px) on ${viewportKey}`,
        offenders: offenders.slice(0, 3)
      });
    }

    // 2. Check Input padding with left icons
    const iconInputs = document.querySelectorAll('div.relative > input, div.relative > textarea');
    for (const inp of iconInputs) {
      const parent = inp.parentElement;
      const svg = parent.querySelector('svg.absolute.left-2, svg.absolute.left-2\\.5, svg.absolute.left-3, svg.absolute.left-3\\.5');
      if (svg) {
        const style = window.getComputedStyle(inp);
        const pl = parseFloat(style.paddingLeft);
        if (pl < 28) {
          issues.push({
            type: 'INPUT_ICON_COLLISION',
            detail: `[${pageName}] Input in ${parent.className.slice(0, 60)} has left icon but paddingLeft is only ${pl}px on ${viewportKey}`
          });
        }
      }
    }

    // 3. Check Select Dropdown appearance and chevron
    const selects = document.querySelectorAll('select');
    for (const sel of selects) {
      if (sel.offsetParent === null) continue;
      const comp = window.getComputedStyle(sel);
      if (comp.appearance !== 'none' && comp.webkitAppearance !== 'none') {
        issues.push({
          type: 'SELECT_NATIVE_ARROW',
          detail: `[${pageName}] Select in ${sel.parentElement?.className.slice(0, 60)} lacks appearance: none on ${viewportKey}`
        });
      }
      const pr = parseFloat(comp.paddingRight);
      if (pr < 24) {
        issues.push({
          type: 'SELECT_PADDING_RIGHT_TIGHT',
          detail: `[${pageName}] Select in ${sel.parentElement?.className.slice(0, 60)} has paddingRight of ${pr}px on ${viewportKey}`
        });
      }
    }

    // 4. Check Double Icons / Symbols (e.g. "+ +")
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const txt = (btn.innerText || '').trim();
      const hasSvgPlus = btn.querySelector('svg.lucide-plus, svg.lucide-plus-circle');
      if (hasSvgPlus && /^\+\s*\+/.test(txt)) {
        issues.push({
          type: 'DOUBLE_ICON_PLUS',
          detail: `[${pageName}] Button has Plus SVG and starts with duplicate '+': "${txt.slice(0, 40)}" on ${viewportKey}`
        });
      }
    }

    // 5. Check Flex-Squeeze on Header Cards
    if (viewportKey !== 'mobile') {
      const allHeaders = document.querySelectorAll('header, [class*="rounded-3xl"], [class*="rounded-2xl"]');
      for (const hdr of allHeaders) {
        if (hdr.offsetParent === null) continue;
        const heading = hdr.querySelector('h1, h2');
        const desc = hdr.querySelector('p');
        const hasActions = hdr.querySelector('button, input, a[class*="button"], a[class*="btn"]');
        if (heading && desc && hasActions && heading.offsetParent !== null && desc.offsetParent !== null) {
          const hdrStyle = window.getComputedStyle(hdr);
          const isRow = hdrStyle.flexDirection === 'row';
          const textContainer = heading.closest('.min-w-0, [class*="flex-1"]') || heading.parentElement;
          const tcRect = textContainer.getBoundingClientRect();
          const hdrRect = hdr.getBoundingClientRect();

          if (isRow && hdrRect.width > 500 && tcRect.width < 220) {
            issues.push({
              type: 'FLEX_SQUEEZE_HEADER_ROW',
              detail: `[${pageName}] Header "${heading.innerText.trim().slice(0, 35)}" squeezed to ${Math.round(tcRect.width)}px on ${viewportKey}`
            });
          }
        }
      }
    }

    return issues;
  }, { pageName, viewportKey });
}

async function checkModalHygiene(page, modalSelector, modalName, viewportKey) {
  return await page.evaluate(({ modalSelector, modalName, viewportKey }) => {
    const issues = [];
    const modal = document.querySelector(modalSelector);
    if (!modal) {
      return [{ type: 'MODAL_NOT_FOUND', detail: `Modal ${modalName} could not be found with selector ${modalSelector}` }];
    }

    const rect = modal.getBoundingClientRect();
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    if (rect.width > winWidth + 2) {
      issues.push({
        type: 'MODAL_WIDTH_EXCEEDED',
        detail: `Modal ${modalName} width (${Math.round(rect.width)}px) exceeds window (${winWidth}px)`
      });
    }

    if (rect.height > winHeight + 2) {
      issues.push({
        type: 'MODAL_HEIGHT_EXCEEDED',
        detail: `Modal ${modalName} height (${Math.round(rect.height)}px) exceeds window (${winHeight}px)`
      });
    }

    const scrollBodies = modal.querySelectorAll('[class*="overflow-y-auto"], [class*="overflow-y-scroll"]');
    if (scrollBodies.length === 0 && rect.height > winHeight * 0.75) {
      issues.push({
        type: 'MODAL_NO_SCROLLABLE_BODY',
        detail: `Modal ${modalName} lacks an overflow-y-auto container`
      });
    }

    return issues;
  }, { modalSelector, modalName, viewportKey });
}

async function loginLaundry(page) {
  await page.goto('http://localhost:5173/#login', { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto('http://localhost:5173/#login', { waitUntil: 'networkidle' });
  await page.locator('button:has-text("Portal Pemilik")').first().click();
  await page.locator('input[type="email"]').first().fill('owner.laundry@wellpos.id');
  await page.locator('input[type="password"]').first().fill('password123');
  await page.locator('button:has-text("Masuk ke Portal Pemilik")').first().click();
  await page.waitForTimeout(2500);
}

async function runSmartOwnerParityAudit() {
  console.log('🚀 MEMULAI AUDIT UI SMARTOWNER PARITY P0, P1, P2 (3 VIEWPORTS)...');
  const browser = await chromium.launch({ headless: true });
  const allViolations = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n======================================================`);
    console.log(`📱 VIEWPORT: ${vp.name} (${vp.width}x${vp.height})`);
    console.log(`======================================================`);

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1
    });
    const page = await context.newPage();

    try {
      await loginLaundry(page);

      // ----------------------------------------------------------------------
      // 1. ShiftsAuditView: Tab Setoran Kas ke Pusat + Modal Ajukan Setoran
      // ----------------------------------------------------------------------
      console.log('  [1] ShiftsAuditView: Setoran Kas ke Pusat & Modal Ajukan Setoran...');
      await page.goto('http://localhost:5173/?tab=shifts#pos', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);

      const setoranTab = page.locator('button:has-text("Setoran Kas ke Pusat")').first();
      if (await setoranTab.isVisible()) {
        await setoranTab.click();
        await page.waitForTimeout(800);
      }

      let issues = await checkHygiene(page, 'ShiftsAuditView-SetoranKas', vp.key);
      if (issues.length) allViolations.push(...issues);

      // Open Modal Ajukan Setoran
      const btnAjukan = page.locator('button:has-text("Ajukan Setoran Kas")').first();
      if (await btnAjukan.isVisible()) {
        await btnAjukan.click();
        await page.waitForTimeout(600);

        const modalIssues = await checkModalHygiene(page, 'div.fixed.inset-0 div[class*="rounded-"]', 'Modal Ajukan Setoran Kas', vp.key);
        if (modalIssues.length) allViolations.push(...modalIssues);

        const shotPath = path.join(ARTIFACT_DIR, `audit_p2_shift_deposit_modal_${vp.key}.png`);
        await page.screenshot({ path: shotPath });
        console.log(`      📸 Screenshot saved: ${path.basename(shotPath)}`);

        // Close modal
        const btnBatal = page.locator('div.fixed.inset-0 button:has-text("Batal")').first();
        if (await btnBatal.isVisible()) {
          await btnBatal.click();
          await page.waitForTimeout(400);
        }
      } else {
        console.log('      ⚠️ Tombol "Ajukan Setoran Kas" tidak terlihat di DOM');
      }

      // ----------------------------------------------------------------------
      // 2. LaundryCommissionView: Tab Kasbon Karyawan + Modal Tarif + Modal Pencairan
      // ----------------------------------------------------------------------
      console.log('  [2] LaundryCommissionView: Kasbon Karyawan, Modal Tarif & Pencairan...');
      await page.goto('http://localhost:5173/?tab=laundry_commissions#pos', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);

      // Tab Kasbon Karyawan
      const kasbonTab = page.locator('button:has-text("Kasbon Karyawan")').first();
      if (await kasbonTab.isVisible()) {
        await kasbonTab.click();
        await page.waitForTimeout(600);
      }

      issues = await checkHygiene(page, 'LaundryCommissionView-Kasbon', vp.key);
      if (issues.length) allViolations.push(...issues);

      // Modal Atur Tarif Komisi
      const btnTarif = page.locator('button:has-text("Atur Tarif Komisi")').first();
      if (await btnTarif.isVisible()) {
        await btnTarif.click();
        await page.waitForTimeout(600);

        const modalIssues = await checkModalHygiene(page, 'div.fixed.inset-0 div[class*="rounded-"]', 'Modal Tarif Komisi', vp.key);
        if (modalIssues.length) allViolations.push(...modalIssues);

        const shotPath = path.join(ARTIFACT_DIR, `audit_p2_commission_rates_modal_${vp.key}.png`);
        await page.screenshot({ path: shotPath });
        console.log(`      📸 Screenshot saved: ${path.basename(shotPath)}`);

        // Close modal
        const btnBatalTarif = page.locator('div.fixed.inset-0 button:has-text("Batal")').first();
        if (await btnBatalTarif.isVisible()) await btnBatalTarif.click();
        await page.waitForTimeout(400);
      }

      // Modal Catat Kasbon Baru
      const btnCatatKasbon = page.locator('button:has-text("Catat Kasbon Baru")').first();
      if (await btnCatatKasbon.isVisible()) {
        await btnCatatKasbon.click();
        await page.waitForTimeout(600);

        const modalIssues = await checkModalHygiene(page, 'div.fixed.inset-0 div[class*="rounded-"]', 'Modal Catat Kasbon', vp.key);
        if (modalIssues.length) allViolations.push(...modalIssues);

        const shotPath = path.join(ARTIFACT_DIR, `audit_p2_kasbon_new_modal_${vp.key}.png`);
        await page.screenshot({ path: shotPath });
        console.log(`      📸 Screenshot saved: ${path.basename(shotPath)}`);

        // Close modal
        const btnBatalKasbon = page.locator('div.fixed.inset-0 button:has-text("Batal")').first();
        if (await btnBatalKasbon.isVisible()) await btnBatalKasbon.click();
        await page.waitForTimeout(400);
      }

      // Switch back to tab "Komisi Staf & Kurir" to test modal pencairan with kasbon offset
      const komisiTab = page.locator('button:has-text("Komisi Staf & Kurir")').first();
      if (await komisiTab.isVisible()) {
        await komisiTab.click();
        await page.waitForTimeout(600);

        const btnCairkan = page.locator('button[title*="Pencairan"], button:has-text("Cairkan")').first();
        if (await btnCairkan.isVisible()) {
          await btnCairkan.click();
          await page.waitForTimeout(600);

          const modalIssues = await checkModalHygiene(page, 'div.fixed.inset-0 div[class*="rounded-"]', 'Modal Pencairan Komisi', vp.key);
          if (modalIssues.length) allViolations.push(...modalIssues);

          const shotPath = path.join(ARTIFACT_DIR, `audit_p2_commission_payout_modal_${vp.key}.png`);
          await page.screenshot({ path: shotPath });
          console.log(`      📸 Screenshot saved: ${path.basename(shotPath)}`);

          const btnBatalCair = page.locator('div.fixed.inset-0 button:has-text("Batal")').first();
          if (await btnBatalCair.isVisible()) await btnBatalCair.click();
          await page.waitForTimeout(400);
        }
      }

      // ----------------------------------------------------------------------
      // 3. LaundryRacksView: Tombol & Modal Preview Auto-Reminder WA
      // ----------------------------------------------------------------------
      console.log('  [3] LaundryRacksView: Tombol & Modal Auto-Reminder WA...');
      await page.goto('http://localhost:5173/?tab=laundry_racks#pos', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);

      issues = await checkHygiene(page, 'LaundryRacksView', vp.key);
      if (issues.length) allViolations.push(...issues);

      const btnReminder = page.locator('button:has-text("Reminder Otomatis WA")').first();
      if (await btnReminder.isVisible()) {
        await btnReminder.click();
        await page.waitForTimeout(800);

        const modalIssues = await checkModalHygiene(page, 'div.fixed.inset-0 div[class*="rounded-"]', 'Modal Auto-Reminder WA', vp.key);
        if (modalIssues.length) allViolations.push(...modalIssues);

        const shotPath = path.join(ARTIFACT_DIR, `audit_p2_racks_reminder_modal_${vp.key}.png`);
        await page.screenshot({ path: shotPath });
        console.log(`      📸 Screenshot saved: ${path.basename(shotPath)}`);

        // Close modal
        const btnTutup = page.locator('div.fixed.inset-0 button:has-text("Tutup")').first();
        if (await btnTutup.isVisible()) await btnTutup.click();
        await page.waitForTimeout(400);
      }

      // ----------------------------------------------------------------------
      // 4. LaundryServicesView: Tab Paket Deposit & Kuota + Modal Tambah Paket
      // ----------------------------------------------------------------------
      console.log('  [4] LaundryServicesView: Tab Paket Deposit & Modal Tambah Paket...');
      await page.goto('http://localhost:5173/?tab=laundry_services#pos', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);

      const depositTab = page.locator('button:has-text("Paket Deposit & Kuota")').first();
      if (await depositTab.isVisible()) {
        await depositTab.click();
        await page.waitForTimeout(600);
      }

      issues = await checkHygiene(page, 'LaundryServicesView-DepositPackages', vp.key);
      if (issues.length) allViolations.push(...issues);

      const btnTambahPaket = page.locator('button:has-text("Tambah Paket Baru")').first();
      if (await btnTambahPaket.isVisible()) {
        await btnTambahPaket.click();
        await page.waitForTimeout(600);

        const modalIssues = await checkModalHygiene(page, 'div.fixed.inset-0 div[class*="rounded-"]', 'Modal Tambah Paket Deposit', vp.key);
        if (modalIssues.length) allViolations.push(...modalIssues);

        const shotPath = path.join(ARTIFACT_DIR, `audit_p1_services_deposit_package_modal_${vp.key}.png`);
        await page.screenshot({ path: shotPath });
        console.log(`      📸 Screenshot saved: ${path.basename(shotPath)}`);

        // Close modal
        const btnBatalPaket = page.locator('div.fixed.inset-0 button:has-text("Batal")').first();
        if (await btnBatalPaket.isVisible()) await btnBatalPaket.click();
        await page.waitForTimeout(400);
      }

      // ----------------------------------------------------------------------
      // 5. CustomersView: Modal Top-Up Wallet dengan Master Paket Chips
      // ----------------------------------------------------------------------
      console.log('  [5] CustomersView: Saldo & Kuota Laundry & Modal Top-Up...');
      await page.goto('http://localhost:5173/?tab=customers#pos', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);

      issues = await checkHygiene(page, 'CustomersView', vp.key);
      if (issues.length) allViolations.push(...issues);

      // In CustomersView, click customer row
      const custRow = page.locator('table tbody tr').first();
      if (await custRow.isVisible()) {
        await custRow.click();
        await page.waitForTimeout(800);

        // Click tab "Saldo & Kuota Laundry"
        const walletTab = page.locator('button:has-text("Saldo & Kuota Laundry")').first();
        if (await walletTab.isVisible()) {
          await walletTab.click();
          await page.waitForTimeout(600);

          // Click button "Top-Up Saldo / Kuota"
          const btnTopup = page.locator('button:has-text("Top-Up Saldo / Kuota")').first();
          if (await btnTopup.isVisible()) {
            await btnTopup.click();
            await page.waitForTimeout(600);

            const modalIssues = await checkModalHygiene(page, 'div.fixed.inset-0 div[class*="rounded-"]', 'Modal Top-Up Wallet Customer', vp.key);
            if (modalIssues.length) allViolations.push(...modalIssues);

            const shotPath = path.join(ARTIFACT_DIR, `audit_p1_customer_wallet_topup_modal_${vp.key}.png`);
            await page.screenshot({ path: shotPath });
            console.log(`      📸 Screenshot saved: ${path.basename(shotPath)}`);

            const btnBatalTopup = page.locator('div.fixed.inset-0 button:has-text("Batal")').first();
            if (await btnBatalTopup.isVisible()) await btnBatalTopup.click();
            await page.waitForTimeout(400);
          }
        }
      }

      // ----------------------------------------------------------------------
      // 6. LaundryProductionView: Machine Chips & Siap Diambil di Kasir
      // ----------------------------------------------------------------------
      console.log('  [6] LaundryProductionView: Machine Chips & Ready Pickup Badge...');
      await page.goto('http://localhost:5173/?tab=laundry_production#pos', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);

      issues = await checkHygiene(page, 'LaundryProductionView', vp.key);
      if (issues.length) allViolations.push(...issues);

      const shotPathProd = path.join(ARTIFACT_DIR, `audit_p0_production_stage_cards_${vp.key}.png`);
      await page.screenshot({ path: shotPathProd });
      console.log(`      📸 Screenshot saved: ${path.basename(shotPathProd)}`);

      // ----------------------------------------------------------------------
      // 7. ReceiptSettingsView: Klausul Komplain & Garansi + Live Preview
      // ----------------------------------------------------------------------
      console.log('  [7] ReceiptSettingsView: Klausul Komplain & Garansi + Live Preview...');
      await page.goto('http://localhost:5173/?tab=settings_receipt#pos', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);

      issues = await checkHygiene(page, 'ReceiptSettingsView', vp.key);
      if (issues.length) allViolations.push(...issues);

      const shotPathReceipt = path.join(ARTIFACT_DIR, `audit_p1_receipt_settings_${vp.key}.png`);
      await page.screenshot({ path: shotPathReceipt });
      console.log(`      📸 Screenshot saved: ${path.basename(shotPathReceipt)}`);

    } catch (err) {
      console.error(`❌ Error on viewport ${vp.name}:`, err);
    } finally {
      await context.close();
    }
  }

  await browser.close();

  console.log('\n======================================================');
  console.log(`📊 RINGKASAN HASIL AUDIT UI SMARTOWNER PARITY P0-P2:`);
  console.log(`======================================================`);
  if (allViolations.length === 0) {
    console.log(`✅ 100% PASS: Ditemukan 0 pelanggaran UI di seluruh viewport (Mobile, Tablet, Laptop)!`);
  } else {
    console.log(`⚠️ Ditemukan ${allViolations.length} potensi masalah UI:`);
    allViolations.forEach((v, idx) => {
      console.log(`  [${idx + 1}] [${v.type}] ${v.detail}`);
    });
  }

  return allViolations;
}

runSmartOwnerParityAudit().catch(err => {
  console.error('Fatal error during UI audit:', err);
  process.exit(1);
});
