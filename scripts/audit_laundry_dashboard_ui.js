const { chromium } = require('../pos_apps/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = '/tmp/wellpos_qa_dashboard';
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

const VIEWPORTS = [
  { key: 'laptop', name: 'Laptop Desktop (1440x900)', width: 1440, height: 900 },
  { key: 'tablet', name: 'Tablet Portrait (820x1180)', width: 820, height: 1180 },
  { key: 'mobile', name: 'Mobile Portrait (390x844)', width: 390, height: 844 },
];

const ROLES = [
  {
    key: 'owner',
    title: 'Owner / Pemilik',
    email: 'owner.laundry@wellpos.id',
    password: 'password123',
    expectedText: 'Mode Pemilik (Lengkap)',
  },
  {
    key: 'cashier',
    title: 'Kasir (Front-Desk)',
    email: 'cashier.laundry@wellpos.id',
    password: 'password123',
    expectedText: 'Mode Kasir (Front-Desk)',
  },
  {
    key: 'production',
    title: 'Produksi (Workshop)',
    email: 'prod.laundry@wellpos.id',
    password: 'password123',
    expectedText: 'Mode Operator Produksi (Workshop)',
  },
];

async function checkHygiene(page, roleKey, viewportKey) {
  return await page.evaluate(({ roleKey, viewportKey }) => {
    const issues = [];

    // 1. Horizontal overflow
    const docWidth = document.documentElement.scrollWidth;
    const winWidth = window.innerWidth;
    if (docWidth > winWidth + 2) {
      issues.push({
        type: 'HORIZONTAL_OVERFLOW',
        detail: `[Role: ${roleKey}] docWidth (${docWidth}px) exceeds winWidth (${winWidth}px) on ${viewportKey}`,
      });
    }

    // 2. Double icon symbols (e.g. "+ +")
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const txt = (btn.innerText || '').trim();
      const hasSvgPlus = btn.querySelector('svg.lucide-plus, svg.lucide-plus-circle');
      if (hasSvgPlus && /^\+\s*\+/.test(txt)) {
        issues.push({
          type: 'DOUBLE_ICON_PLUS',
          detail: `[Role: ${roleKey}] Button has Plus SVG and starts with '+': "${txt.slice(0, 30)}" on ${viewportKey}`,
        });
      }
    }

    return issues;
  }, { roleKey, viewportKey });
}

async function loginUser(page, email, password) {
  await page.goto('http://localhost:5173/#login', { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto('http://localhost:5173/#login', { waitUntil: 'networkidle' });
  await page.locator('button:has-text("Portal Pemilik")').first().click();
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button:has-text("Masuk ke Portal Pemilik")').first().click();
  await page.waitForTimeout(2000);
}

async function runDashboardAudit() {
  console.log('🚀 MEMULAI AUDIT UI SMART ROLE-BASED LAUNDRY DASHBOARD (3 ROLES x 3 VIEWPORTS)...');
  const browser = await chromium.launch({ headless: true });
  const allViolations = [];
  const capturedScreenshots = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n======================================================`);
    console.log(`📱 VIEWPORT: ${vp.name} (${vp.width}x${vp.height})`);
    console.log(`======================================================`);

    for (const r of ROLES) {
      console.log(`  [Role: ${r.title}]`);
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();

      try {
        await loginUser(page, r.email, r.password);

        // Buka Tab Overview
        await page.goto('http://localhost:5173/?tab=overview#pos', { waitUntil: 'networkidle' });
        await page.waitForTimeout(1800);

        // Verifikasi teks peran ada di dashboard
        const pageContent = await page.content();
        const hasExpected = pageContent.includes(r.expectedText) || pageContent.includes(r.title);
        console.log(`    Role badge text found: ${hasExpected ? 'PASS' : 'WARN'}`);

        // Verifikasi isolasi untuk Kasir dan Produksi (tidak boleh ada estimasi laba / omzet tahunan)
        if (r.key === 'cashier' || r.key === 'production') {
          const hasOwnerProfit = pageContent.includes('Estimasi Laba Ops') || pageContent.includes('margin laba');
          if (hasOwnerProfit) {
            allViolations.push({
              type: 'ROLE_ISOLATION_LEAK',
              detail: `[Role: ${r.key}] Owner profit / omzet metrics leaked into ${r.key} view!`,
            });
            console.log(`    ❌ ROLE_ISOLATION_LEAK detected on ${r.key}`);
          } else {
            console.log(`    ✅ Role data isolation PASS (Zero owner omzet/profit in ${r.key})`);
          }
        }

        // Cek UI Hygiene
        const issues = await checkHygiene(page, r.key, vp.key);
        if (issues.length) {
          allViolations.push(...issues);
          console.log(`    ⚠️ Hygiene issues:`, issues);
        } else {
          console.log(`    ✅ Hygiene PASS (0 horizontal overflow, 0 double icon)`);
        }

        // Screenshot
        const shotName = `dashboard_${r.key}_${vp.key}.png`;
        const shotPath = path.join(ARTIFACT_DIR, shotName);
        await page.screenshot({ path: shotPath, fullPage: false });
        capturedScreenshots.push({ role: r.key, vp: vp.key, path: shotPath });
        console.log(`    📸 Screenshot saved: ${shotName}`);

      } catch (err) {
        console.error(`    ❌ Error on role ${r.key} (${vp.key}):`, err.message);
        allViolations.push({
          type: 'EXECUTION_ERROR',
          detail: `[Role: ${r.key}] Error: ${err.message}`,
        });
      } finally {
        await context.close();
      }
    }
  }

  await browser.close();

  console.log(`\n======================================================`);
  console.log(`🎯 RINGKASAN AUDIT UI SMART ROLE-BASED DASHBOARD:`);
  console.log(`======================================================`);
  console.log(`Total Screenshots: ${capturedScreenshots.length}`);
  console.log(`Total Pelanggaran: ${allViolations.length}`);

  if (allViolations.length > 0) {
    console.log(`\nDAFTAR PELANGGARAN:`);
    allViolations.forEach((v, i) => {
      console.log(`${i + 1}. [${v.type}] ${v.detail}`);
    });
  } else {
    console.log(`\n🎉 SELURUH SKENARIO ROLE & MULTI-DEVICE DASHBOARD 100% PASS!`);
  }
}

runDashboardAudit().catch(err => {
  console.error('Fatal error in audit:', err);
  process.exit(1);
});
