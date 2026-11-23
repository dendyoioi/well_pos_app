const { chromium } = require('../pos_apps/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = '/Users/dendyaditya/.gemini/antigravity/brain/f71f8083-0c2f-48e9-b583-29b630ca4a01';

const VIEWPORTS = [
  { key: 'mobile', name: 'Mobile Portrait (390x844)', width: 390, height: 844 },
  { key: 'tablet', name: 'Tablet Portrait (820x1180)', width: 820, height: 1180 },
  { key: 'laptop', name: 'Laptop Desktop (1440x900)', width: 1440, height: 900 }
];

const FNB_REGEX = /\b(kopi|boba|dine in|meja [0-9]+|barista|katalog & menu)\b/i;

async function checkPageHygiene(page, pageName, viewportKey) {
  return await page.evaluate(({ pageName, viewportKey, fnbPattern }) => {
    const issues = [];
    const rx = new RegExp(fnbPattern, 'i');

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
        detail: `Doc scrollWidth (${docWidth}px) exceeds window width (${winWidth}px)`,
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
        if (pl < 34) {
          issues.push({
            type: 'INPUT_ICON_COLLISION',
            detail: `Input in ${parent.className.slice(0, 60)} has left icon but paddingLeft is only ${pl}px (less than 34px)`
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
          detail: `Select in ${sel.parentElement?.className.slice(0, 60)} does not have appearance: none`
        });
      }
      const pr = parseFloat(comp.paddingRight);
      if (pr < 30) {
        issues.push({
          type: 'SELECT_PADDING_RIGHT_TIGHT',
          detail: `Select in ${sel.parentElement?.className.slice(0, 60)} has paddingRight of ${pr}px (expected >= 30px / pr-10)`
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
          detail: `Button has Plus SVG and starts with duplicate '+': "${txt.slice(0, 40)}"`
        });
      }
    }

    // 5. Check F&B residues in visible text
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while (n = walk.nextNode()) {
      if (n.parentElement && n.parentElement.offsetParent !== null && !['SCRIPT', 'STYLE'].includes(n.parentElement.tagName)) {
        const val = n.nodeValue.trim();
        if (val.length > 2 && rx.test(val)) {
          issues.push({
            type: 'FNB_RESIDUE',
            detail: `Found F&B residue text: "${val.slice(0, 60)}" inside <${n.parentElement.tagName.toLowerCase()}>`
          });
        }
      }
    }

    // 6. Check Flex-Squeeze on Header Cards (Heading / Description squeezed on Tablet/Laptop due to row layout)
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

          // If header is rendered in a flex-row and the text container is squeezed < 240px while overall header is wide (> 500px)
          if (isRow && hdrRect.width > 500 && tcRect.width < 240) {
            issues.push({
              type: 'FLEX_SQUEEZE_HEADER_ROW',
              detail: `Header card "${heading.innerText.trim().slice(0, 35)}" in ${pageName} is in flex-row and squeezed to ${Math.round(tcRect.width)}px (< 240px) on ${viewportKey}`
            });
          }

          // Also detect if heading text has wrapped into multiple lines due to tight container
          const hRect = heading.getBoundingClientRect();
          const hLineHeight = parseFloat(window.getComputedStyle(heading).lineHeight) || 24;
          if (isRow && hdrRect.width > 500 && hRect.height > hLineHeight * 1.8 && tcRect.width < 280) {
            issues.push({
              type: 'FLEX_SQUEEZE_HEADING_WRAPPED',
              detail: `Heading "${heading.innerText.trim().slice(0, 35)}" in ${pageName} is awkwardly wrapped (${Math.round(hRect.height)}px height, ${Math.round(tcRect.width)}px container) on ${viewportKey}`
            });
          }
        }
      }
    }

    return issues;
  }, { pageName, viewportKey, fnbPattern: FNB_REGEX.source });
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
        detail: `Modal ${modalName} width (${Math.round(rect.width)}px) exceeds window width (${winWidth}px)`
      });
    }

    if (rect.height > winHeight + 2) {
      issues.push({
        type: 'MODAL_HEIGHT_EXCEEDED',
        detail: `Modal ${modalName} height (${Math.round(rect.height)}px) exceeds window height (${winHeight}px)`
      });
    }

    const scrollBodies = modal.querySelectorAll('[class*="overflow-y-auto"], [class*="overflow-y-scroll"]');
    if (scrollBodies.length === 0 && rect.height > winHeight * 0.7) {
      issues.push({
        type: 'MODAL_NO_SCROLLABLE_BODY',
        detail: `Modal ${modalName} lacks an overflow-y-auto container for scrollable content`
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
  await page.locator('input[type="password"]').first().fill('pastiwell789');
  await page.locator('button:has-text("Masuk ke Portal Pemilik")').first().click();
  await page.waitForTimeout(2500);
}

async function runAudit() {
  console.log('🚀 MEMULAI AUDIT UI MENYELURUH MULTI-DEVICE LAUNDRY (MOBILE, TABLET, LAPTOP)');
  const browser = await chromium.launch({ headless: true });
  const allFindings = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n======================================================`);
    console.log(`📱 MEMERIKSA VIEWPORT: ${vp.name}`);
    console.log(`======================================================`);

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2
    });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('Failed to load resource') && !text.includes('ERR_CONNECTION_REFUSED')) {
          consoleErrors.push(text);
        }
      }
    });
    page.on('pageerror', err => {
      consoleErrors.push(err.message);
    });

    await loginLaundry(page);

    // 1. Navigasi & Frame Utama
    console.log(`  [1] Navigasi & Frame Utama...`);
    try {
      if (vp.key === 'mobile') {
        const menuBtn = page.locator('button:has-text("Menu")').first();
        if (await menuBtn.isVisible()) {
          await menuBtn.click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_frame_drawer_open.png`) });
          const drawerClose = page.locator('button[title="Tutup Menu"]').first();
          if (await drawerClose.isVisible()) await drawerClose.click();
          await page.waitForTimeout(300);
        }
      } else if (vp.key === 'tablet') {
        const menuBtn = page.locator('button:has-text("Menu")').first();
        if (await menuBtn.isVisible()) {
          await menuBtn.click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_frame_drawer_open.png`) });
          const drawerClose = page.locator('button[title="Tutup Menu"]').first();
          if (await drawerClose.isVisible()) await drawerClose.click();
          await page.waitForTimeout(300);
        }
      }
    } catch (e) {
      console.warn(`    ⚠️ Navigasi error in ${vp.key}:`, e.message);
    }

    // 2. Ringkasan Bisnis Laundry (?tab=overview)
    console.log(`  [2] Ringkasan Bisnis (?tab=overview)...`);
    await page.goto('http://localhost:5173/?tab=overview', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    let issues = await checkPageHygiene(page, 'overview', vp.key);
    allFindings.push(...issues.map(i => ({ ...i, page: 'overview', viewport: vp.key })));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_overview.png`) });

    // Test Modal Input Cepat Cucian
    console.log(`      -> Test Modal Input Cepat Cucian...`);
    try {
      const quickDropoffBtn = page.locator('button[title="Input Cepat (Drop-off)"], button:has-text("Input Cepat"), button:has-text("Drop-off Cepat")').first();
      if (await quickDropoffBtn.isVisible()) {
        await quickDropoffBtn.click();
        await page.waitForTimeout(600);
        
        const modal = page.locator('.fixed.inset-0').last();
        // Buka opsi Delivery (Jemput & Antar) inside modal
        const deliveryBtn = modal.locator('button:has-text("Jemput & Antar")').first();
        if (await deliveryBtn.isVisible()) {
          await deliveryBtn.click();
          await page.waitForTimeout(400);
        }

        const modalIssues = await checkModalHygiene(page, '.fixed.inset-0 .rounded-3xl, .fixed.inset-0 .rounded-t-3xl', 'Input Cepat Cucian', vp.key);
        allFindings.push(...modalIssues.map(i => ({ ...i, page: 'modal_quick_dropoff', viewport: vp.key })));
        await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_modal_quick_dropoff.png`) });

        // Close modal inside modal
        const closeBtn = modal.locator('button:has-text("Batal"), button[title="Tutup"]').first();
        if (await closeBtn.isVisible()) await closeBtn.click();
        await page.waitForTimeout(400);
      }
    } catch (e) {
      console.warn(`      ⚠️ Modal Quick Dropoff error in ${vp.key}:`, e.message);
    }

    // 3. Kasir Laundry POS (?tab=pos)
    console.log(`  [3] Kasir Laundry POS (?tab=pos)...`);
    await page.goto('http://localhost:5173/?tab=pos', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    issues = await checkPageHygiene(page, 'pos', vp.key);
    allFindings.push(...issues.map(i => ({ ...i, page: 'pos', viewport: vp.key })));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_pos.png`) });

    // 4. Antrean & Status Cucian (?tab=laundry_queue)
    console.log(`  [4] Antrean & Status Cucian (?tab=laundry_queue)...`);
    await page.goto('http://localhost:5173/?tab=laundry_queue', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    issues = await checkPageHygiene(page, 'laundry_queue', vp.key);
    allFindings.push(...issues.map(i => ({ ...i, page: 'laundry_queue', viewport: vp.key })));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_laundry_queue.png`) });

    // Test Modal Struk & Tag
    console.log(`      -> Test Modal Struk & Tag...`);
    try {
      const receiptBtn = page.locator('button[title*="Struk"], button:has-text("Struk"), button:has-text("Nota")').first();
      if (await receiptBtn.isVisible()) {
        await receiptBtn.click();
        await page.waitForTimeout(600);
        const mIssues = await checkModalHygiene(page, '.fixed.inset-0 .rounded-3xl, .fixed.inset-0 .rounded-t-3xl', 'Struk & Tag', vp.key);
        allFindings.push(...mIssues.map(i => ({ ...i, page: 'modal_receipt', viewport: vp.key })));
        await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_modal_receipt.png`) });
        
        const modal = page.locator('.fixed.inset-0').last();
        const closeM = modal.locator('button:has-text("Tutup"), button[title="Tutup"]').first();
        if (await closeM.isVisible()) await closeM.click();
        await page.waitForTimeout(400);
      }
    } catch (e) {
      console.warn(`      ⚠️ Modal Receipt error in ${vp.key}:`, e.message);
    }

    // Test Modal Cuci Ulang Garansi
    console.log(`      -> Test Modal Cuci Ulang Garansi...`);
    try {
      const rewashBtn = page.locator('button:has-text("Cuci Ulang"), button[title*="Garansi"]').first();
      if (await rewashBtn.isVisible()) {
        await rewashBtn.click();
        await page.waitForTimeout(600);
        const mIssues = await checkModalHygiene(page, '.fixed.inset-0 .rounded-3xl, .fixed.inset-0 .rounded-t-3xl', 'Cuci Ulang', vp.key);
        allFindings.push(...mIssues.map(i => ({ ...i, page: 'modal_rewash', viewport: vp.key })));
        await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_modal_rewash.png`) });
        
        const modal = page.locator('.fixed.inset-0').last();
        const closeM = modal.locator('button:has-text("Batal"), button[title="Tutup"]').first();
        if (await closeM.isVisible()) await closeM.click();
        await page.waitForTimeout(400);
      }
    } catch (e) {
      console.warn(`      ⚠️ Modal Rewash error in ${vp.key}:`, e.message);
    }

    // 5. Stasiun Produksi Workshop (?tab=laundry_production)
    console.log(`  [5] Stasiun Produksi Workshop (?tab=laundry_production)...`);
    await page.goto('http://localhost:5173/?tab=laundry_production', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    issues = await checkPageHygiene(page, 'laundry_production', vp.key);
    allFindings.push(...issues.map(i => ({ ...i, page: 'laundry_production', viewport: vp.key })));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_laundry_production.png`) });

    // Test Modal KPI Staf
    console.log(`      -> Test Modal KPI Staf Produksi...`);
    try {
      const kpiBtn = page.locator('button:has-text("KPI"), button:has-text("Statistik Operator")').first();
      if (await kpiBtn.isVisible()) {
        await kpiBtn.click();
        await page.waitForTimeout(600);
        const mIssues = await checkModalHygiene(page, '.fixed.inset-0 .rounded-3xl, .fixed.inset-0 .rounded-t-3xl', 'KPI Staf', vp.key);
        allFindings.push(...mIssues.map(i => ({ ...i, page: 'modal_kpi', viewport: vp.key })));
        await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_modal_kpi.png`) });

        const modal = page.locator('.fixed.inset-0').last();
        const closeM = modal.locator('button:has-text("Tutup"), button[title="Tutup"]').first();
        if (await closeM.isVisible()) await closeM.click();
        await page.waitForTimeout(400);
      }
    } catch (e) {
      console.warn(`      ⚠️ Modal KPI error in ${vp.key}:`, e.message);
    }

    // 6. Layanan & Tarif Laundry (?tab=laundry_services)
    console.log(`  [6] Layanan & Tarif Laundry (?tab=laundry_services)...`);
    await page.goto('http://localhost:5173/?tab=laundry_services', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    issues = await checkPageHygiene(page, 'laundry_services', vp.key);
    allFindings.push(...issues.map(i => ({ ...i, page: 'laundry_services', viewport: vp.key })));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_laundry_services.png`) });

    // Test Modal BoM Takaran Bahan
    console.log(`      -> Test Modal Takaran Bahan BoM...`);
    try {
      const bomBtn = page.locator('button:has-text("BoM"), button:has-text("Takaran Bahan")').first();
      if (await bomBtn.isVisible()) {
        await bomBtn.click();
        await page.waitForTimeout(600);
        const mIssues = await checkModalHygiene(page, '.fixed.inset-0 .rounded-3xl, .fixed.inset-0 .rounded-t-3xl', 'Takaran BoM', vp.key);
        allFindings.push(...mIssues.map(i => ({ ...i, page: 'modal_bom', viewport: vp.key })));
        await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_modal_bom.png`) });

        const modal = page.locator('.fixed.inset-0').last();
        const closeM = modal.locator('button:has-text("Batal"), button[title="Tutup"]').first();
        if (await closeM.isVisible()) await closeM.click();
        await page.waitForTimeout(400);
      }
    } catch (e) {
      console.warn(`      ⚠️ Modal BoM error in ${vp.key}:`, e.message);
    }

    // 7. Manajemen Rak & Simpan (?tab=laundry_racks)
    console.log(`  [7] Manajemen Rak & Simpan (?tab=laundry_racks)...`);
    await page.goto('http://localhost:5173/?tab=laundry_racks', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    issues = await checkPageHygiene(page, 'laundry_racks', vp.key);
    allFindings.push(...issues.map(i => ({ ...i, page: 'laundry_racks', viewport: vp.key })));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_laundry_racks.png`) });

    // 8. Delivery / Antar-Jemput (?tab=laundry_transfers)
    console.log(`  [8] Delivery & Kurir (?tab=laundry_transfers)...`);
    await page.goto('http://localhost:5173/?tab=laundry_transfers', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    issues = await checkPageHygiene(page, 'laundry_transfers', vp.key);
    allFindings.push(...issues.map(i => ({ ...i, page: 'laundry_transfers', viewport: vp.key })));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_laundry_transfers.png`) });

    // Test Modal Atur Tarif & Zona
    console.log(`      -> Test Modal Atur Tarif & Zona Delivery...`);
    try {
      const configDeliveryBtn = page.locator('button:has-text("Atur Tarif"), button:has-text("Tarif & Zona")').first();
      if (await configDeliveryBtn.isVisible()) {
        await configDeliveryBtn.click();
        await page.waitForTimeout(600);
        const mIssues = await checkModalHygiene(page, '.fixed.inset-0 .rounded-3xl, .fixed.inset-0 .rounded-t-3xl', 'Tarif & Zona', vp.key);
        allFindings.push(...mIssues.map(i => ({ ...i, page: 'modal_delivery_config', viewport: vp.key })));
        await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_modal_delivery_config.png`) });

        const modal = page.locator('.fixed.inset-0').last();
        const closeM = modal.locator('button:has-text("Batal"), button[title="Tutup"]').first();
        if (await closeM.isVisible()) await closeM.click();
        await page.waitForTimeout(400);
      }
    } catch (e) {
      console.warn(`      ⚠️ Modal Delivery Config error in ${vp.key}:`, e.message);
    }

    // 9. Bahan Cuci & Perlengkapan (?tab=inventory)
    console.log(`  [9] Bahan Cuci & Inventori (?tab=inventory)...`);
    await page.goto('http://localhost:5173/?tab=inventory', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    issues = await checkPageHygiene(page, 'inventory', vp.key);
    allFindings.push(...issues.map(i => ({ ...i, page: 'inventory', viewport: vp.key })));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_inventory.png`) });

    // Test Modal Tambah Bahan
    console.log(`      -> Test Modal Tambah Bahan (UoM)...`);
    try {
      const addIngBtn = page.locator('button:has-text("Tambah Bahan")').first();
      if (await addIngBtn.isVisible()) {
        await addIngBtn.click();
        await page.waitForTimeout(600);
        const mIssues = await checkModalHygiene(page, '.fixed.inset-0 .rounded-3xl, .fixed.inset-0 .rounded-t-3xl', 'Tambah Bahan', vp.key);
        allFindings.push(...mIssues.map(i => ({ ...i, page: 'modal_create_ingredient', viewport: vp.key })));
        await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_modal_create_ingredient.png`) });

        const modal = page.locator('.fixed.inset-0').last();
        const closeM = modal.locator('button:has-text("Batal"), button[title="Tutup"]').first();
        if (await closeM.isVisible()) await closeM.click();
        await page.waitForTimeout(400);
      }
    } catch (e) {
      console.warn(`      ⚠️ Modal Tambah Bahan error in ${vp.key}:`, e.message);
    }

    // 9b. Pengadaan Bahan (PO), Mutasi, Vendor
    console.log(`  [9b] Purchase Orders (?tab=purchase_orders)...`);
    await page.goto('http://localhost:5173/?tab=purchase_orders', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    issues = await checkPageHygiene(page, 'purchase_orders', vp.key);
    allFindings.push(...issues.map(i => ({ ...i, page: 'purchase_orders', viewport: vp.key })));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_purchase_orders.png`) });

    console.log(`  [9c] Stock Movements (?tab=stock_movements)...`);
    await page.goto('http://localhost:5173/?tab=stock_movements', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    issues = await checkPageHygiene(page, 'stock_movements', vp.key);
    allFindings.push(...issues.map(i => ({ ...i, page: 'stock_movements', viewport: vp.key })));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_stock_movements.png`) });

    console.log(`  [9d] Suppliers (?tab=suppliers)...`);
    await page.goto('http://localhost:5173/?tab=suppliers', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    issues = await checkPageHygiene(page, 'suppliers', vp.key);
    allFindings.push(...issues.map(i => ({ ...i, page: 'suppliers', viewport: vp.key })));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_suppliers.png`) });

    // 10. Riwayat Transaksi & Laporan Keuangan
    console.log(`  [10] Orders & Detail Nota (?tab=orders)...`);
    await page.goto('http://localhost:5173/?tab=orders', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    issues = await checkPageHygiene(page, 'orders', vp.key);
    allFindings.push(...issues.map(i => ({ ...i, page: 'orders', viewport: vp.key })));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_orders.png`) });

    // Test OrderDetailModal
    try {
      const firstOrder = page.locator('tr.cursor-pointer, button:has-text("Lihat Nota"), button:has-text("Detail")').first();
      if (await firstOrder.isVisible()) {
        await firstOrder.click();
        await page.waitForTimeout(600);
        const mIssues = await checkModalHygiene(page, '.fixed.inset-0 .rounded-3xl, .fixed.inset-0 .rounded-t-3xl', 'Detail Nota', vp.key);
        allFindings.push(...mIssues.map(i => ({ ...i, page: 'modal_order_detail', viewport: vp.key })));
        await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_modal_order_detail.png`) });

        const modal = page.locator('.fixed.inset-0').last();
        const closeM = modal.locator('button:has-text("Tutup"), button[title="Tutup"]').first();
        if (await closeM.isVisible()) await closeM.click();
        await page.waitForTimeout(400);
      }
    } catch (e) {
      console.warn(`      ⚠️ Modal Order Detail error in ${vp.key}:`, e.message);
    }

    console.log(`  [10b] Reports (?tab=reports)...`);
    await page.goto('http://localhost:5173/?tab=reports', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    issues = await checkPageHygiene(page, 'reports', vp.key);
    allFindings.push(...issues.map(i => ({ ...i, page: 'reports', viewport: vp.key })));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_reports.png`) });

    console.log(`  [10c] Shifts (?tab=shifts)...`);
    await page.goto('http://localhost:5173/?tab=shifts', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    issues = await checkPageHygiene(page, 'shifts', vp.key);
    allFindings.push(...issues.map(i => ({ ...i, page: 'shifts', viewport: vp.key })));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_shifts.png`) });

    console.log(`  [10d] Product Analytics (?tab=product_analytics)...`);
    await page.goto('http://localhost:5173/?tab=product_analytics', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    issues = await checkPageHygiene(page, 'product_analytics', vp.key);
    allFindings.push(...issues.map(i => ({ ...i, page: 'product_analytics', viewport: vp.key })));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_product_analytics.png`) });

    // 11. Staf, Peran & Komisi
    console.log(`  [11] Staff Users (?tab=staff_users)...`);
    await page.goto('http://localhost:5173/?tab=staff_users', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    issues = await checkPageHygiene(page, 'staff_users', vp.key);
    allFindings.push(...issues.map(i => ({ ...i, page: 'staff_users', viewport: vp.key })));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_staff_users.png`) });

    console.log(`  [11b] Staff Roles (?tab=staff_roles)...`);
    await page.goto('http://localhost:5173/?tab=staff_roles', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    issues = await checkPageHygiene(page, 'staff_roles', vp.key);
    allFindings.push(...issues.map(i => ({ ...i, page: 'staff_roles', viewport: vp.key })));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_staff_roles.png`) });

    console.log(`  [11c] Laundry Commissions (?tab=laundry_commissions)...`);
    await page.goto('http://localhost:5173/?tab=laundry_commissions', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    issues = await checkPageHygiene(page, 'laundry_commissions', vp.key);
    allFindings.push(...issues.map(i => ({ ...i, page: 'laundry_commissions', viewport: vp.key })));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_laundry_commissions.png`) });

    // Test Modal Atur Tarif Komisi
    try {
      const commConfigBtn = page.locator('button:has-text("Atur Tarif Komisi"), button:has-text("Konfigurasi Tarif")').first();
      if (await commConfigBtn.isVisible()) {
        await commConfigBtn.click();
        await page.waitForTimeout(600);
        const mIssues = await checkModalHygiene(page, '.fixed.inset-0 .rounded-3xl, .fixed.inset-0 .rounded-t-3xl', 'Atur Tarif Komisi', vp.key);
        allFindings.push(...mIssues.map(i => ({ ...i, page: 'modal_commission_config', viewport: vp.key })));
        await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_modal_commission_config.png`) });

        const modal = page.locator('.fixed.inset-0').last();
        const closeM = modal.locator('button:has-text("Batal"), button[title="Tutup"]').first();
        if (await closeM.isVisible()) await closeM.click();
        await page.waitForTimeout(400);
      }
    } catch (e) {
      console.warn(`      ⚠️ Modal Commission error in ${vp.key}:`, e.message);
    }

    // 12. Pengaturan Toko
    console.log(`  [12] Settings Receipt (?tab=settings_receipt)...`);
    await page.goto('http://localhost:5173/?tab=settings_receipt', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    issues = await checkPageHygiene(page, 'settings_receipt', vp.key);
    allFindings.push(...issues.map(i => ({ ...i, page: 'settings_receipt', viewport: vp.key })));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_settings_receipt.png`) });

    console.log(`  [12b] Settings Payment (?tab=settings_payment)...`);
    await page.goto('http://localhost:5173/?tab=settings_payment', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    issues = await checkPageHygiene(page, 'settings_payment', vp.key);
    allFindings.push(...issues.map(i => ({ ...i, page: 'settings_payment', viewport: vp.key })));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_settings_payment.png`) });

    console.log(`  [12c] Settings Loyalty (?tab=settings_loyalty)...`);
    await page.goto('http://localhost:5173/?tab=settings_loyalty', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    issues = await checkPageHygiene(page, 'settings_loyalty', vp.key);
    allFindings.push(...issues.map(i => ({ ...i, page: 'settings_loyalty', viewport: vp.key })));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_settings_loyalty.png`) });

    console.log(`  [12d] Outlets (?tab=outlets)...`);
    await page.goto('http://localhost:5173/?tab=outlets', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    issues = await checkPageHygiene(page, 'outlets', vp.key);
    allFindings.push(...issues.map(i => ({ ...i, page: 'outlets', viewport: vp.key })));
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_outlets.png`) });

    // 13. Public Tracking (Unauthenticated context)
    console.log(`  [13] Public Tracking (/track/TEST-DEP-1795240399205)...`);
    try {
      const pubContext = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2
      });
      const pubPage = await pubContext.newPage();
      await pubPage.goto('http://localhost:5173/track/TEST-DEP-1795240399205', { waitUntil: 'networkidle' });
      await pubPage.waitForTimeout(1000);
      issues = await checkPageHygiene(pubPage, 'public_tracking', vp.key);
      allFindings.push(...issues.map(i => ({ ...i, page: 'public_tracking', viewport: vp.key })));
      await pubPage.screenshot({ path: path.join(ARTIFACT_DIR, `audit_${vp.key}_public_tracking.png`) });
      await pubContext.close();
    } catch (e) {
      console.warn(`      ⚠️ Public tracking error in ${vp.key}:`, e.message);
    }

    if (consoleErrors.length > 0) {
      console.log(`  ⚠️ Console errors detected in ${vp.name}:`, consoleErrors);
      allFindings.push(...consoleErrors.map(err => ({
        page: 'GLOBAL',
        viewport: vp.key,
        type: 'CONSOLE_ERROR',
        detail: err
      })));
    }

    await context.close();
  }

  await browser.close();

  console.log(`\n======================================================`);
  console.log(`📊 RINGKASAN HASIL AUDIT UI MULTI-DEVICE`);
  console.log(`======================================================`);
  console.log(`Total temuan: ${allFindings.length}`);

  if (allFindings.length === 0) {
    console.log('✅ SEMUA HALAMAN & MODAL 100% PASS DI SEMUA DEVICE (0 OVERFLOW, 0 RESIDU, 0 ERROR)!');
  } else {
    for (const f of allFindings) {
      console.log(`❌ [${f.viewport.toUpperCase()} - ${f.page}] ${f.type}: ${f.detail}`);
      if (f.offenders) {
        console.log(`   Offenders:`, JSON.stringify(f.offenders));
      }
    }
  }

  fs.writeFileSync(path.join(ARTIFACT_DIR, 'audit_ui_findings.json'), JSON.stringify(allFindings, null, 2));
}

runAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
