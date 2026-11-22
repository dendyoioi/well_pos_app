// scripts/capture_fase9_screenshots.js
const { chromium } = require('../pos_apps/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const targetDir = '/Users/dendyaditya/.gemini/antigravity/brain/f71f8083-0c2f-48e9-b583-29b630ca4a01';
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

async function captureFase9Screenshots() {
  console.log('🚀 Starting Playwright capture for FASE 9 UoM & BoM Laundry...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  });
  const page = await context.newPage();

  try {
    // 1. LOGIN AS LAUNDRY OWNER
    console.log('1. Logging in as Laundry Merchant Owner (owner.laundry@wellpos.id)...');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Check if login form is visible
    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"], button:has-text("Masuk"), button:has-text("Login")').first();

    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill('owner.laundry@wellpos.id');
      await passwordInput.fill('pastiwell789');
      await submitBtn.click();
      await page.waitForTimeout(2000);
    }

    console.log('   ✅ User logged in / state checked.');
    await page.waitForTimeout(1000);

    // 2. SCREENSHOT 1: INVENTORY UOM VIEW
    console.log('2. Navigating to Inventory / Raw Materials view...');
    // Try clicking sidebar menu "Bahan Baku" or "Inventori" or direct hash
    const invMenu = page.locator('button, a').filter({ hasText: /Inventori|Bahan Baku|Stok/i }).first();
    if (await invMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
      await invMenu.click();
      await page.waitForTimeout(1000);
    } else {
      // Set hash or evaluate
      await page.evaluate(() => {
        window.location.hash = '#inventory';
      });
      await page.waitForTimeout(1000);
    }

    // Ensure raw materials tab is selected if there are tabs
    const rawTab = page.locator('button').filter({ hasText: /Bahan Baku|Resep/i }).first();
    if (await rawTab.isVisible({ timeout: 1500 }).catch(() => false)) {
      await rawTab.click();
      await page.waitForTimeout(1000);
    }

    await page.waitForTimeout(1500);
    const shot1Path = path.join(targetDir, 'screenshot_fase9_inventory_uom_view.png');
    await page.screenshot({ path: shot1Path, fullPage: false });
    console.log(`   📸 Saved screenshot 1: ${shot1Path}`);

    // 3. SCREENSHOT 2: CREATE / EDIT INGREDIENT MODAL WITH UOM CONVERTER
    console.log('3. Opening Edit / Create Ingredient Modal...');
    // Look for edit button (pencil) or "+ Tambah Bahan"
    const editBtn = page.locator('button[title*="Edit"], button:has-text("Edit"), table tbody tr button:has(.lucide-pencil)').first();
    const addIngBtn = page.locator('button').filter({ hasText: /Tambah Bahan|Bahan Baru/i }).first();

    if (await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await editBtn.click();
    } else if (await addIngBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addIngBtn.click();
    }
    await page.waitForTimeout(1500);

    const shot2Path = path.join(targetDir, 'screenshot_fase9_create_ingredient_modal.png');
    await page.screenshot({ path: shot2Path, fullPage: false });
    console.log(`   📸 Saved screenshot 2: ${shot2Path}`);

    // Close modal
    const cancelBtn = page.locator('button:has-text("Batal"), button:has-text("Tutup")').first();
    if (await cancelBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await cancelBtn.click();
      await page.waitForTimeout(1000);
    }

    // 4. SCREENSHOT 3: LAUNDRY SERVICES WITH BOM BADGE
    console.log('4. Navigating to Laundry Services view...');
    const svcMenu = page.locator('button, a').filter({ hasText: /Layanan Laundry|Katalog Layanan/i }).first();
    if (await svcMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
      await svcMenu.click();
      await page.waitForTimeout(1500);
    } else {
      await page.evaluate(() => {
        window.location.hash = '#laundry-services';
      });
      await page.waitForTimeout(1500);
    }

    const shot3Path = path.join(targetDir, 'screenshot_fase9_laundry_services_bom_badge.png');
    await page.screenshot({ path: shot3Path, fullPage: false });
    console.log(`   📸 Saved screenshot 3: ${shot3Path}`);

    // 5. SCREENSHOT 4: LAUNDRY SERVICE BOM MODAL
    console.log('5. Opening Laundry Service BoM Modal...');
    const bomBtn = page.locator('button').filter({ hasText: /Takaran BoM/i }).first();
    if (await bomBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await bomBtn.click();
      await page.waitForTimeout(1500);
    }

    const shot4Path = path.join(targetDir, 'screenshot_fase9_laundry_bom_modal.png');
    await page.screenshot({ path: shot4Path, fullPage: false });
    console.log(`   📸 Saved screenshot 4: ${shot4Path}`);

    console.log('🎉 All FASE 9 screenshots captured successfully!');
  } catch (err) {
    console.error('❌ Error during capture:', err);
  } finally {
    await browser.close();
  }
}

captureFase9Screenshots();
