const { chromium } = require('../pos_apps/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const { LoginPage } = require('./pom/LoginPage');

async function runE2eMatrix() {
  console.log('===============================================================');
  console.log('🚀 WELL POS E2E TEST: ISOLASI DOMAIN MENU vs BOM BAHAN BAKU');
  console.log('===============================================================');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();

  // 1. LOGIN
  console.log('\n[LANGKAH 1] Melakukan login sebagai Merchant Owner...');
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.loginOwner('owner@uracoffee.id', 'Owner123!');
  await page.waitForTimeout(1500);

  // 2. NAVIGASI KE MODIFIERS VIEW
  console.log('\n[LANGKAH 2] Memeriksa isolasi dropdown pada Modifier & Topping...');
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

  // Buka Form Tambah Modifier
  const addModBtn = page.getByRole('button', { name: /Tambah Grup Modifier/i });
  await addModBtn.click();
  await page.waitForTimeout(1000);

  // Periksa Dropdown Bahan Baku di Modifier
  const modSelect = page.locator('select').filter({ hasText: /-- Tanpa Efek Bahan Baku/i }).first();
  await modSelect.waitFor({ state: 'visible', timeout: 5000 });
  const modOptions = await modSelect.locator('option').allInnerTexts();

  console.log(`-> Ditemukan ${modOptions.length} opsi pada dropdown Modifier.`);

  const leakedInModifier = modOptions.filter(opt =>
    opt.includes('Kopi Susu Aren') ||
    opt.includes('Americano') ||
    opt.includes('Meals 1') ||
    opt.includes('Meals 2')
  );

  const rawMaterialsInModifier = modOptions.filter(opt =>
    opt.includes('Biji Kopi') ||
    opt.includes('Susu') ||
    opt.includes('Sirup') ||
    opt.includes('Cup')
  );

  console.log(`-> Bahan baku mentah valid ditemukan: ${rawMaterialsInModifier.length} item`);
  console.log(`-> Produk menu yang bocor ke modifier : ${leakedInModifier.length} item`);

  if (leakedInModifier.length > 0) {
    throw new Error(`TEST GAGAL: Terdeteksi kebocoran produk menu ke Modifier dropdown: ${leakedInModifier.join(', ')}`);
  }
  console.log('✅ ModifiersView: 100% BERSIH dari produk menu!');

  // 3. NAVIGASI KE RECIPES VIEW (BOM)
  console.log('\n[LANGKAH 3] Memeriksa isolasi dropdown pada Resep & Bahan (BOM)...');
  const recipeNavBtn = page.getByRole('button', { name: /Resep & Bahan/i }).first();
  await recipeNavBtn.click();
  await page.waitForTimeout(1500);

  // Klik tombol "Kelola Resep" atau "+ Racik Resep" pada baris menu pertama
  const manageRecipeBtn = page.getByRole('button', { name: /Kelola Resep|\+ Racik Resep/i }).first();
  await manageRecipeBtn.waitFor({ state: 'visible', timeout: 5000 });
  await manageRecipeBtn.click();
  await page.waitForTimeout(1000);

  // Cari select bahan baku di form resep
  const recipeSelect = page.locator('select').first();
  await recipeSelect.waitFor({ state: 'visible', timeout: 5000 });
  const recipeOptions = await recipeSelect.locator('option').allInnerTexts();

  console.log(`-> Ditemukan ${recipeOptions.length} opsi bahan baku pada Resep BOM.`);

  const leakedInRecipe = recipeOptions.filter(opt =>
    opt.includes('Kopi Susu Aren') ||
    opt.includes('Americano') ||
    opt.includes('Meals 1') ||
    opt.includes('Meals 2')
  );

  const rawMaterialsInRecipe = recipeOptions.filter(opt =>
    opt.includes('Biji Kopi') ||
    opt.includes('Susu') ||
    opt.includes('Sirup') ||
    opt.includes('Cup')
  );

  console.log(`-> Bahan baku mentah valid di Resep BOM: ${rawMaterialsInRecipe.length} item`);
  console.log(`-> Produk menu yang bocor ke Resep BOM  : ${leakedInRecipe.length} item`);

  if (leakedInRecipe.length > 0) {
    throw new Error(`TEST GAGAL: Terdeteksi kebocoran produk menu ke Resep BOM: ${leakedInRecipe.join(', ')}`);
  }
  console.log('✅ RecipesView: 100% BERSIH dari produk menu!');

  // Ambil screenshot bukti visual Resep BOM
  const artifactDir = path.join(__dirname, 'docs/artifacts');
  if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });
  const snapPath = path.join(artifactDir, 'recipes_bom_dropdown_clean.png');
  await page.screenshot({ path: snapPath, fullPage: false });
  console.log('Screenshot tersimpan:', snapPath);

  await browser.close();

  console.log('\n===============================================================');
  console.log('🎉 SELURUH SUITE TEST E2E MATRIX MENU VS BOM BERHASIL 100%!');
  console.log('===============================================================');
}

runE2eMatrix().catch(err => {
  console.error('\n❌ ERROR RUNNING E2E MATRIX:', err);
  process.exit(1);
});
