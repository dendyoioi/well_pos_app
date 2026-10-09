const { chromium } = require('../pos_apps/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const { LoginPage } = require('./pom/LoginPage');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();

  console.log('1. Membuka login...');
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.loginOwner('owner@uracoffee.id', 'Owner123!');
  await page.waitForTimeout(1500);

  console.log('2. Membuka menu Modifier & Topping melalui sidebar...');
  const modifierBtn = page.getByRole('button', { name: /Modifier & Topping/i }).first();
  if (await modifierBtn.isVisible()) {
    await modifierBtn.click();
  } else {
    const menuGroup = page.locator('button', { hasText: /Menu & Produk/i }).first();
    await menuGroup.click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /Modifier & Topping/i }).first().click();
  }
  await page.waitForTimeout(1500);

  console.log('3. Membuka form Tambah Grup Modifier...');
  const addBtn = page.getByRole('button', { name: /Tambah Grup Modifier/i });
  await addBtn.click();
  await page.waitForTimeout(1000);

  console.log('4. Memeriksa opsi dalam dropdown Bahan Baku (BOM)...');
  // Cari select dropdown koneksi bahan baku
  const selectLocator = page.locator('select').filter({ hasText: /-- Tanpa Efek Bahan Baku/i }).first();
  await selectLocator.waitFor({ state: 'visible', timeout: 5000 });

  // Ambil semua teks opsi dalam dropdown
  const options = await selectLocator.locator('option').allInnerTexts();
  console.log('Daftar opsi dropdown bahan baku:');
  options.forEach((opt, idx) => {
    console.log(`  ${idx + 1}. ${opt}`);
  });

  // Validasi assertions
  const hasKopiSusuAren = options.some(opt => opt.includes('Kopi Susu Aren'));
  const hasMeals = options.some(opt => opt.includes('Meals 1') || opt.includes('Meals 2'));
  const hasAmericano = options.some(opt => opt.includes('Americano'));
  const hasBijiKopi = options.some(opt => opt.includes('Biji Kopi') || opt.includes('Espresso Blend'));
  const hasSusu = options.some(opt => opt.includes('Susu'));

  console.log('\n--- HASIL VALIDASI BOUNDARY ---');
  console.log('Biji Kopi mentah ada? :', hasBijiKopi ? 'YA (BENAR ✅)' : 'TIDAK ❌');
  console.log('Susu mentah ada?      :', hasSusu ? 'YA (BENAR ✅)' : 'TIDAK ❌');
  console.log('Kopi Susu Aren bocor? :', hasKopiSusuAren ? 'BOCOR ❌' : 'BERSIH 100% ✅');
  console.log('Meals 1 / 2 bocor?    :', hasMeals ? 'BOCOR ❌' : 'BERSIH 100% ✅');
  console.log('Americano bocor?      :', hasAmericano ? 'BOCOR ❌' : 'BERSIH 100% ✅');

  // Ambil screenshot modal dropdown untuk bukti visual
  const artifactDir = path.join(__dirname, 'docs/artifacts');
  if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });
  const snapPath = path.join(artifactDir, 'modifiers_bom_dropdown_clean.png');
  await page.screenshot({ path: snapPath, fullPage: false });
  console.log('Screenshot tersimpan:', snapPath);

  await browser.close();

  if (hasKopiSusuAren || hasMeals || hasAmericano) {
    throw new Error('TEST GAGAL: Menu produk masih bocor ke dropdown bahan baku!');
  }
  console.log('TEST SUKSES: Boundary domain bahan baku vs daftar menu 100% terisolasi!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
