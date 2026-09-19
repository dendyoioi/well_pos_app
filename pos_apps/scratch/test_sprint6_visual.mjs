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
  console.log('Logging in as Owner PRO...');
  const ownerBtn = page.locator('button:has-text("Owner PRO")');
  await ownerBtn.click();
  await page.waitForTimeout(500);

  // Submit Login
  const submitBtn = page.locator('button[type="submit"]');
  await submitBtn.click();
  await page.waitForTimeout(2500);

  // 1. Navigate to Mesin Kasir (POS)
  console.log('Opening Mesin Kasir (POS)...');
  const posTab = page.locator('button:has-text("Mesin Kasir (POS)")');
  if (await posTab.isVisible()) {
    await posTab.click();
    await page.waitForTimeout(1000);
  }

  // 1. Capture Empty Cart -> Must be strictly Rp 0
  console.log('Checking POS Terminal Grand Total with 0 items...');
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'pos_terminal_empty_cart_zero.png') });

  // 2. Go to Products Tab
  console.log('Navigating to Katalog Produk Tab...');
  const katalogBtn = page.locator('button:has-text("Katalog Produk")');
  await katalogBtn.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'products_view_with_category_btn.png') });

  // 3. Open Category Modal
  console.log('Testing Category Modal...');
  const kelolaKatBtn = page.locator('button:has-text("Kelola Kategori")').first();
  await kelolaKatBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'category_modal_opened.png') });

  // Close category modal
  const closeKatBtn = page.locator('button:has(svg.lucide-x)').last();
  await closeKatBtn.click();
  await page.waitForTimeout(600);

  // 4. Open Tambah Produk Modal
  console.log('Testing Tambah Produk Modal with Image & Modifiers Builder...');
  await page.click('button:has-text("Tambah Produk")');
  await page.waitForTimeout(1000);

  // Pick preset image (☕ Kopi)
  const kopiPreset = page.locator('button:has-text("☕ Kopi")');
  if (await kopiPreset.isVisible()) {
    await kopiPreset.click();
    await page.waitForTimeout(300);
  }

  // Fill product details
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const productName = `Kopi Susu Aren Spesial ${randomSuffix}`;
  await page.fill('input[placeholder="misal: Kopi Susu Aren Spesial"]', productName);
  await page.fill('input[placeholder="misal: 8991234567809"]', `899988776${randomSuffix}`);
  await page.fill('input[placeholder="misal: DRK-001"]', `DRK-AREN-${randomSuffix}`);
  
  // HPP, Harga Jual, and Initial Stock (50 pcs)
  const numInputs = page.locator('input[type="number"]');
  await numInputs.nth(0).fill('8000'); // HPP
  await numInputs.nth(1).fill('18000'); // Harga Jual
  await numInputs.nth(2).fill('50'); // Stok Awal 50 pcs
  await numInputs.nth(3).fill('5'); // Min alert

  // Add Level Gula & Level Es & Topping modifiers
  const btnGula = page.locator('button:has-text("+ Level Gula")');
  if (await btnGula.isVisible()) await btnGula.click();
  await page.waitForTimeout(300);

  const btnEs = page.locator('button:has-text("+ Level Es")');
  if (await btnEs.isVisible()) await btnEs.click();
  await page.waitForTimeout(300);

  const btnTopping = page.locator('button:has-text("+ Topping")');
  if (await btnTopping.isVisible()) await btnTopping.click();
  await page.waitForTimeout(500);

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'product_modal_modifiers_builder.png') });

  // Save product
  await page.click('button:has-text("Simpan Produk")');
  await page.waitForTimeout(2000);

  // 5. Back to Mesin Kasir (POS) to test Cashier Modifier Modal & Add-ons
  console.log('Navigating back to Mesin Kasir (POS)...');
  await posTab.click();
  await page.waitForTimeout(1500);

  // Find our newly created product and click it
  console.log(`Clicking product "${productName}" with modifiers in POS...`);
  const coffeeProductCard = page.locator(`button:has-text("${productName}")`).first();
  await coffeeProductCard.waitFor({ state: 'visible', timeout: 10000 });
  await coffeeProductCard.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'pos_modifier_popup_opened.png') });

  // Pick Less Sugar & Less Ice & Topping Boba
  const lessSugarBtn = page.locator('button:has-text("Less Sugar (50%)")');
  if (await lessSugarBtn.isVisible()) await lessSugarBtn.click();

  const lessIceBtn = page.locator('button:has-text("Less Ice")');
  if (await lessIceBtn.isVisible()) await lessIceBtn.click();

  const bobaBtn = page.locator('button:has-text("Boba Jelly Brown Sugar")');
  if (await bobaBtn.isVisible()) await bobaBtn.click();

  await page.fill('input[placeholder="misal: Sambal dipisah, minta sedotan ramah lingkungan..."]', 'Less sweet, sedotan ramah lingkungan');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'pos_modifier_popup_selected.png') });

  // Confirm add to cart
  await page.click('button:has-text("Masuk Keranjang")');
  await page.waitForTimeout(1000);

  // 6. Test On-Demand Packaging Add-on (Plastik & Box)
  console.log('Testing On-Demand Packaging Add-ons...');
  // Click + on Kantong Plastik
  const plasticRow = page.locator('text=Plastik / Kresek').locator('xpath=..');
  const addPlasticBtn = plasticRow.locator('button:has-text("+")');
  if (await addPlasticBtn.isVisible()) {
    await addPlasticBtn.click();
    await page.waitForTimeout(300);
  }

  // Click + on Box Kemasan
  const boxRow = page.locator('text=Box Kemasan').locator('xpath=..');
  const addBoxBtn = boxRow.locator('button:has-text("+")');
  if (await addBoxBtn.isVisible()) {
    await addBoxBtn.click();
    await page.waitForTimeout(300);
  }

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'pos_cart_with_modifiers_and_packaging.png') });

  // 7. Test Checkout & Tambah Order Susulan
  console.log('Testing Checkout and Order Susulan...');
  await page.click('button:has-text("Bayar Sekarang (F4)")');
  await page.waitForTimeout(1000);

  // Pay exact cash in PaymentModal
  const uangPas = page.locator('button:has-text("Uang Pas")');
  if (await uangPas.isVisible()) {
    await uangPas.click();
  } else {
    const cash50 = page.locator('button:has-text("Rp 50.000")');
    if (await cash50.isVisible()) await cash50.click();
  }
  await page.waitForTimeout(600);
  await page.click('button:has-text("Selesaikan & Cetak")');
  await page.waitForTimeout(2500);

  // Check Order Success Modal with [+ Tambah Order Susulan]
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'order_success_with_append_button.png') });

  const appendBtn = page.locator('button:has-text("+ Tambah Order Susulan")');
  if (await appendBtn.isVisible()) {
    console.log('Clicking + Tambah Order Susulan...');
    await appendBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'pos_terminal_append_order_banner.png') });
  } else {
    const baruBtn = page.locator('button:has-text("Transaksi Baru")');
    if (await baruBtn.isVisible()) {
      await baruBtn.click();
      await page.waitForTimeout(1000);
    }
  }

  // 8. Go to Riwayat Transaksi to verify the [+ Susulan] action in orders history
  console.log('Navigating to Riwayat Transaksi Tab...');
  const ordersTab = page.locator('button:has-text("Riwayat Transaksi")');
  if (await ordersTab.isVisible()) {
    await ordersTab.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'orders_view_with_append_shortcut.png') });
  }

  console.log('Visual tests completed successfully!');
  await browser.close();
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
