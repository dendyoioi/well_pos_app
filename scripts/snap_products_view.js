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

  console.log('2. Membuka halaman Daftar Menu melalui sidebar...');
  await page.waitForSelector('text=Menu & Produk', { timeout: 5000 });
  const daftarMenuBtn = page.getByRole('button', { name: /^Daftar Menu$/i }).first();
  if (await daftarMenuBtn.isVisible()) {
    await daftarMenuBtn.click();
  } else {
    const menuGroup = page.locator('button', { hasText: /Menu & Produk/i }).first();
    await menuGroup.click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /^Daftar Menu$/i }).first().click();
  }
  await page.waitForTimeout(1500);

  const artifactDir = path.join(__dirname, 'docs/artifacts');
  if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });

  const artifactPath = path.join(artifactDir, 'products_view_polished.png');
  await page.screenshot({ path: artifactPath, fullPage: false });
  console.log('Screenshot tersimpan:', artifactPath);

  // Buka dropdown Alat & Berkas
  const dropdownBtn = page.getByRole('button', { name: /Alat & Berkas/i });
  if (await dropdownBtn.isVisible()) {
    await dropdownBtn.click();
    await page.waitForTimeout(400);
    const dropdownArtifact = path.join(artifactDir, 'products_view_dropdown.png');
    await page.screenshot({ path: dropdownArtifact, fullPage: false });
    console.log('Screenshot dropdown tersimpan:', dropdownArtifact);
  }

  await browser.close();
}

main().catch(console.error);
