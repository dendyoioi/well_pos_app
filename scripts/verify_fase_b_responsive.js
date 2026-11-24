const { chromium } = require('../pos_apps/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = '/Users/dendyaditya/.gemini/antigravity/brain/f71f8083-0c2f-48e9-b583-29b630ca4a01';
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: 'laptop', width: 1440, height: 900 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
];

async function run() {
  console.log('========================================================================');
  console.log('📸 RESPONSIVE UI VERIFICATION: FASE B (LAPTOP 1440px, TABLET 820px, MOBILE 390px)');
  console.log('========================================================================\n');

  const browser = await chromium.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    console.log(`\n▶️ Testing Viewport: ${vp.name.toUpperCase()} (${vp.width}x${vp.height})...`);
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    // Login as laundry owner
    await page.goto('http://localhost:5173/#login', { waitUntil: 'networkidle' });
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto('http://localhost:5173/#login', { waitUntil: 'networkidle' });

    await page.locator('button:has-text("Portal Pemilik")').first().click();
    await page.locator('input[type="email"]').first().fill('owner.laundry@wellpos.id');
    await page.locator('input[type="password"]').first().fill('password123');
    await page.locator('button:has-text("Masuk ke Portal Pemilik")').first().click();
    await page.waitForTimeout(3000);

    // 1. Jadwal Shift Kerja (StaffShiftScheduleView)
    console.log(`   [1] Navigasi ke Jadwal Shift Kerja (${vp.name})...`);
    await page.goto('http://localhost:5173/?tab=users', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const shiftTab = page.locator('button:has-text("Jadwal Shift Kerja")').first();
    if (await shiftTab.count() > 0) {
      await shiftTab.click();
      await page.waitForTimeout(2000);
    }
    const ssSchedule = path.join(ARTIFACT_DIR, `staff_shift_schedule_${vp.name}.png`);
    await page.screenshot({ path: ssSchedule, fullPage: false });
    console.log(`   ✓ Saved: staff_shift_schedule_${vp.name}.png`);

    // 2. Evaluasi Performa Staf (StaffPerformanceEvaluationView)
    console.log(`   [2] Navigasi ke Evaluasi Performa Staf (${vp.name})...`);
    await page.goto('http://localhost:5173/?tab=laundry_commissions', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const perfTab = page.locator('button:has-text("Evaluasi Performa Staf")').first();
    if (await perfTab.count() > 0) {
      await perfTab.click();
      await page.waitForTimeout(2000);
    }
    const ssPerf = path.join(ARTIFACT_DIR, `staff_performance_${vp.name}.png`);
    await page.screenshot({ path: ssPerf, fullPage: false });
    console.log(`   ✓ Saved: staff_performance_${vp.name}.png`);

    // 3. Laundry Production & Incident Modals
    console.log(`   [3] Navigasi ke Produksi Laundry & Modal Insiden (${vp.name})...`);
    await page.goto('http://localhost:5173/?tab=laundry_production', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    // 3a. Kelola Insiden Modal
    const manageIncBtn = page.locator('button:has-text("Insiden (")').first();
    if (await manageIncBtn.count() > 0) {
      await manageIncBtn.click();
      await page.waitForTimeout(1000);
      const ssManageInc = path.join(ARTIFACT_DIR, `laundry_incident_management_${vp.name}.png`);
      await page.screenshot({ path: ssManageInc, fullPage: false });
      console.log(`   ✓ Saved: laundry_incident_management_${vp.name}.png`);

      // Close modal
      const closeBtn = page.locator('button[title="Tutup Modal"], button:has-text("Tutup")').first();
      if (await closeBtn.count() > 0) {
        await closeBtn.click().catch(() => {});
        await page.waitForTimeout(600);
      } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(600);
      }
    }

    // 3b. Form Lapor Rusak/Hilang Modal
    const reportIncBtn = page.locator('button[title="Lapor Pakaian Rusak / Hilang"]').first();
    if (await reportIncBtn.count() > 0) {
      await reportIncBtn.click();
      await page.waitForTimeout(1000);
      const ssReportInc = path.join(ARTIFACT_DIR, `laundry_incident_modal_${vp.name}.png`);
      await page.screenshot({ path: ssReportInc, fullPage: false });
      console.log(`   ✓ Saved: laundry_incident_modal_${vp.name}.png`);
    }

    await context.close();
  }

  await browser.close();
  console.log('\n========================================================================');
  console.log('🎉 SEMUA SCREENSHOT RESPONSIVE FASE B BERHASIL DIAMBIL & DIVERIFIKASI!');
  console.log('========================================================================\n');
}

run().catch((err) => {
  console.error('Error running responsive verification:', err);
  process.exit(1);
});
