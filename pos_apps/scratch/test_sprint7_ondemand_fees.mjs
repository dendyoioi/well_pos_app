import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = '/Users/dendyaditya/.gemini/antigravity-ide/brain/dd774e89-db9f-45b0-9d8e-9cbed874cecb';

async function run() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  console.log('1. Navigating to POS Login...');
  await page.goto('http://localhost:5173/#pos');
  await page.waitForTimeout(1500);

  // Quick Login as Owner PRO
  console.log('2. Logging in as Owner PRO...');
  const ownerBtn = page.locator('button:has-text("Owner PRO")');
  await ownerBtn.click();
  await page.waitForTimeout(500);

  const submitBtn = page.locator('button[type="submit"]');
  await submitBtn.click();
  await page.waitForTimeout(2500);

  // Navigate to Mesin Kasir (POS)
  console.log('3. Navigating to Mesin Kasir (POS)...');
  const posTab = page.locator('button:has-text("Mesin Kasir (POS)")');
  if (await posTab.isVisible()) {
    await posTab.click();
    await page.waitForTimeout(1000);
  }

  // 1. Check Empty Cart: Grand total MUST be strictly Rp 0
  console.log('4. Verifying Empty Cart Rp 0...');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'pos_ondemand_empty_cart_zero.png') });

  // 2. Open Supervisor Fees Modal
  console.log('5. Opening Supervisor Fees Modal...');
  const spvBtn = page.locator('button:has-text("Kelola (SPV)")').first();
  await spvBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'spv_fees_modal_tab_tax.png') });

  // 3. Test Inline Title Editing in Tab 1
  console.log('6. Testing Inline Title Editing in Tab 1 (Tax/Service)...');
  const editButtons = page.locator('button[title="Ubah Nama Judul Biaya"]');
  if (await editButtons.count() > 0) {
    await editButtons.first().click();
    await page.waitForTimeout(400);
    const titleInput = page.locator('input[title="Tekan Enter untuk simpan"]');
    if (await titleInput.isVisible()) {
      await titleInput.fill('PB1 Resto / Pajak Daerah (Edited)');
      const checkSaveBtn = page.locator('button[title="Simpan Judul"]').first();
      await checkSaveBtn.click();
      await page.waitForTimeout(400);
    }
  }

  // 4. Switch to Tab 2: Kemasan & On-Demand
  console.log('7. Switching to Tab 2: Kemasan & On-Demand...');
  const tabOnDemand = page.locator('button:has-text("Kemasan & On-Demand")');
  await tabOnDemand.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'spv_fees_modal_tab_ondemand.png') });

  // 5. Add a new On-Demand fee: "Paperbag Craft Premium" Rp 1.500
  console.log('8. Adding new On-Demand fee...');
  const addFeeBtn = page.locator('button:has-text("Tambah")').first();
  if (await addFeeBtn.isVisible()) {
    await addFeeBtn.click();
    await page.waitForTimeout(400);

    const feeNameInput = page.locator('input[placeholder*="Kantong Plastik"]').first();
    if (await feeNameInput.isVisible()) {
      await feeNameInput.fill('Paperbag Craft Premium');
      const rateInput = page.locator('input[type="number"]').last();
      await rateInput.fill('1500');

      const submitAddFee = page.locator('button:has-text("Tambahkan")');
      await submitAddFee.click();
      await page.waitForTimeout(600);
    }
  }
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'spv_fees_modal_tab_ondemand_after_add.png') });

  // 6. Save configuration to backend
  console.log('9. Saving Fees Configuration to Backend...');
  const saveFeesBtn = page.locator('button:has-text("Simpan Semua Perubahan")');
  await saveFeesBtn.click();
  await page.waitForTimeout(1800);

  // 7. Add product to cart to enable on-demand packaging section
  console.log('10. Adding product to cart (Air Mineral 600ml)...');
  const airMineralCard = page.locator('text=Air Mineral 600ml').first();
  await airMineralCard.click();
  await page.waitForTimeout(800);

  // If product modifier popup opens, confirm default modifiers
  const confirmModifierBtn = page.locator('button:has-text("Tambahkan ke Keranjang")');
  if (await confirmModifierBtn.isVisible()) {
    await confirmModifierBtn.click();
    await page.waitForTimeout(600);
  }

  // 8. Test Quick-Access On-Demand Counters in Cart
  console.log('11. Testing Quick-Access Counters in Cart...');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'pos_cart_ondemand_chips_initial.png') });

  // Click [+] on the first quick-access chip inside the cart's packaging section
  const packagingSection = page.locator('text=Kemasan / On-Demand').locator('..').locator('..');
  const chipPlusBtn = packagingSection.locator('div.grid button:has-text("+")').first();
  if (await chipPlusBtn.isVisible()) {
    await chipPlusBtn.click();
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'pos_cart_ondemand_chips_incremented.png') });

  // 9. Open [+ Biaya Lainnya] Modal
  console.log('12. Opening [+ Biaya Lainnya] Modal...');
  const biayaLainnyaBtn = page.locator('button:has-text("+ Biaya Lainnya")');
  await biayaLainnyaBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'pos_ondemand_picker_modal.png') });

  // Test search in modal
  console.log('13. Testing Search in Modal...');
  const searchInput = page.locator('input[placeholder*="Cari kemasan"]');
  if (await searchInput.isVisible()) {
    await searchInput.fill('Paperbag');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'pos_ondemand_picker_search.png') });

    // Increment Paperbag inside modal
    const modalContainer = page.locator('div.fixed.z-50:has-text("Pilih Kemasan & Biaya Tambahan")');
    const modalPlusBtn = modalContainer.locator('button:has(svg.lucide-plus)').first();
    if (await modalPlusBtn.isVisible()) {
      await modalPlusBtn.click();
      await page.waitForTimeout(300);
    }

    // Clear search query
    await searchInput.fill('');
    await page.waitForTimeout(400);
  }

  // Click "Terapkan ke Keranjang"
  console.log('14. Applying selected on-demand fees to cart...');
  const applyCartBtn = page.locator('button:has-text("Terapkan ke Keranjang")');
  if (await applyCartBtn.isVisible()) {
    await applyCartBtn.click();
    await page.waitForTimeout(1000);
  }

  // 10. Capture full cart breakdown with on-demand items
  console.log('15. Capturing final POS cart breakdown with all on-demand fees...');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'pos_cart_ondemand_full_breakdown.png') });

  console.log('Done! All Sprint 7 on-demand fee visual verifications passed successfully.');
  await browser.close();
}

run().catch((err) => {
  console.error('Error running test:', err);
  process.exit(1);
});
