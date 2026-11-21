// scripts/capture_cup_label_flow_screenshots.js
const { chromium } = require('../pos_apps/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const { LoginPage } = require('./pom/LoginPage');

// Target Screenshot Directory
const targetDir = '/Users/dendyaditya/.gemini/antigravity/brain/bb1bff60-bee3-4061-a1ce-b7ba5801a3f8';
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

async function captureCupLabelFlow() {
  console.log('🚀 Starting Playwright capture for Cup Label Printer Flow...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  });
  const page = await context.newPage();

  const credentials = {
    email: 'owner@uracoffee.id',
    password: 'Owner123!',
  };

  try {
    // 1. LOGIN AS OWNER
    console.log('1. Logging in as Merchant Owner...');
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginOwner(credentials.email, credentials.password);
    await page.waitForURL(/.*#(dashboard|pos|overview).*/, { timeout: 15000 });
    console.log('   ✅ Logged in successfully.');

    // 2. NAVIGATE TO RECEIPT & PRINTER SETTINGS
    console.log('2. Navigating to Receipt & Printer Settings...');
    await page.goto('http://localhost:5173/#dashboard', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Click on Pengaturan Struk / Settings Tab
    // Or set active tab to settings_receipt
    await page.evaluate(() => {
      // If there's an event or tab switch, click or hash change
      window.location.hash = '#dashboard';
    });
    await page.waitForTimeout(500);

    // Look for sidebar navigation "Format Struk" or similar
    const receiptMenuBtn = page.locator('button, a').filter({ hasText: /Format Struk|Pengaturan Printer/i }).first();
    if (await receiptMenuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await receiptMenuBtn.click();
      await page.waitForTimeout(1000);
    } else {
      // Try to find the button inside dropdown or direct click
      const storeSettingsBtn = page.locator('button').filter({ hasText: /Pengaturan Toko|Kelola Toko/i }).first();
      if (await storeSettingsBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await storeSettingsBtn.click();
        await page.waitForTimeout(500);
      }
      const formatStrukItem = page.locator('button, a, div').filter({ hasText: /Format Struk/i }).first();
      if (await formatStrukItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        await formatStrukItem.click();
        await page.waitForTimeout(1000);
      }
    }

    // Ensure we are on ReceiptSettingsView
    console.log('   Checking if ReceiptSettingsView is visible...');
    await page.waitForTimeout(1000);

    // Activate Cup Label toggle if not active
    const cupLabelToggle = page.locator('input[type="checkbox"]').nth(3); // or locate by section 8
    const section8Header = page.locator('text=8. Cetak Stiker Label Cup');
    if (await section8Header.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('   Section 8 header found!');
      await section8Header.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      // Check if toggle is checked
      const toggleParent = section8Header.locator('..').locator('..');
      const checkbox = toggleParent.locator('input[type="checkbox"]');
      const isChecked = await checkbox.isChecked().catch(() => false);
      if (!isChecked) {
        console.log('   Activating Cup Label toggle...');
        await checkbox.click({ force: true });
        await page.waitForTimeout(600);
      }
    }

    // Scroll to see both section 8 and simulator
    await page.screenshot({
      path: path.join(targetDir, '01_backoffice_cup_label_settings.png'),
      fullPage: false,
    });
    console.log('   ✅ Captured 01_backoffice_cup_label_settings.png');

    // Save settings if needed
    const saveBtn = page.getByRole('button', { name: /Simpan Format Struk/i }).first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(1500);
    }

    // 3. OPEN HARDWARE MODAL & SWITCH TO CUP LABEL TAB
    console.log('3. Opening Hardware Printer Modal...');
    // In ReceiptSettingsView there's a hardware modal trigger or connect buttons
    const pairBtLabelBtn = page.getByRole('button', { name: /Pair Bluetooth Label|Hubungkan USB Label/i }).first();
    const openHardwareModalBtn = page.getByRole('button', { name: /Pengaturan Perangkat & Laci/i }).first();

    if (await openHardwareModalBtn.isVisible().catch(() => false)) {
      await openHardwareModalBtn.click();
      await page.waitForTimeout(600);

      // Switch to Tab 2: Printer Stiker Cup
      const cupTabBtn = page.getByRole('button', { name: /Printer Stiker Cup/i });
      if (await cupTabBtn.isVisible().catch(() => false)) {
        await cupTabBtn.click();
        await page.waitForTimeout(600);
      }

      await page.screenshot({
        path: path.join(targetDir, '02_hardware_modal_cup_label.png'),
      });
      console.log('   ✅ Captured 02_hardware_modal_cup_label.png');

      // Close modal
      const closeBtn = page.getByRole('button', { name: /Selesai|Tutup/i }).last();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // 4. NAVIGATE TO POS TERMINAL (KASIR)
    console.log('4. Navigating to POS Terminal...');
    await page.goto('http://localhost:5173/#pos', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // If shift is closed or modal open, check
    const bukaShiftBtn = page.getByRole('button', { name: /Buka Shift/i });
    if (await bukaShiftBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await bukaShiftBtn.click();
      await page.waitForTimeout(800);
      const submitBukaShift = page.getByRole('button', { name: /Konfirmasi Buka Shift/i });
      if (await submitBukaShift.isVisible().catch(() => false)) {
        await submitBukaShift.click();
        await page.waitForTimeout(1000);
      }
    }

    // Add Beverage items to cart (e.g. Kopi Susu Aren)
    console.log('   Adding beverage to cart...');
    const coffeeCard = page.locator('div, button').filter({ hasText: /Kopi Susu|Americano|Caramel/i }).first();
    if (await coffeeCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await coffeeCard.click();
      await page.waitForTimeout(600);
      // Click again for quantity 2
      await coffeeCard.click().catch(() => {});
      await page.waitForTimeout(600);
    }

    await page.screenshot({
      path: path.join(targetDir, '03_pos_cashier_order_cart.png'),
    });
    console.log('   ✅ Captured 03_pos_cashier_order_cart.png');

    // Click checkout / bayar
    const bayarBtn = page.getByRole('button', { name: /Bayar|Checkout|Lanjut Bayar/i }).first();
    if (await bayarBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await bayarBtn.click();
      await page.waitForTimeout(800);

      // Select Cash payment
      const tunaiBtn = page.getByRole('button', { name: /Tunai|CASH/i }).first();
      if (await tunaiBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tunaiBtn.click();
        await page.waitForTimeout(500);
      }

      // Enter nominal or exact money (Uang Pas)
      const uangPasBtn = page.getByRole('button', { name: /Uang Pas/i }).first();
      if (await uangPasBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await uangPasBtn.click();
        await page.waitForTimeout(500);
      }

      // Selesaikan Transaksi
      const prosesBayarBtn = page.getByRole('button', { name: /Proses Bayar|Selesaikan Pembayaran|Bayar Sekarang/i }).first();
      if (await prosesBayarBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await prosesBayarBtn.click();
        await page.waitForTimeout(1500);
      }

      // 5. CAPTURE ORDER SUCCESS MODAL WITH CUP LABEL BUTTON
      console.log('5. Capturing Order Success Modal with Cup Label Button...');
      await page.waitForSelector('.has-receipt-modal, #thermal-receipt-content', { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: path.join(targetDir, '04_order_success_cup_label_button.png'),
      });
      console.log('   ✅ Captured 04_order_success_cup_label_button.png');
    }

    console.log('🎉 All screenshots captured successfully in artifact directory!');
  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    await browser.close();
  }
}

captureCupLabelFlow();

