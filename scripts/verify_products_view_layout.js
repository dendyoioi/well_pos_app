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

  console.log('2. Membuka halaman Daftar Menu...');
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
  await page.waitForTimeout(2000);

  console.log('3. Memeriksa jumlah tombol Tambah Produk...');
  const tambahBtns = await page.locator('button:has-text("Tambah Produk")').all();
  console.log(`Jumlah tombol Tambah Produk yang terdeteksi: ${tambahBtns.length}`);

  console.log('4. Memeriksa dimensi tabel desktop...');
  const tableMetrics = await page.evaluate(() => {
    const table = document.querySelector('table');
    const container = table ? table.parentElement : null;
    if (!table || !container) return null;

    const headers = Array.from(table.querySelectorAll('th')).map(th => ({
      text: th.innerText.trim(),
      width: th.getBoundingClientRect().width
    }));

    return {
      tableScrollWidth: table.scrollWidth,
      tableClientWidth: table.clientWidth,
      containerClientWidth: container.clientWidth,
      hasHScroll: table.scrollWidth > container.clientWidth,
      headers
    };
  });

  console.log('Hasil diagnostik tabel:', JSON.stringify(tableMetrics, null, 2));

  console.log('5. Memeriksa wrapping teks mata uang Rp...');
  const wrappedCurrencies = await page.evaluate(() => {
    const priceElements = Array.from(document.querySelectorAll('td span, td div')).filter(el => {
      return el.innerText && el.innerText.startsWith('Rp ') && el.children.length === 0;
    });

    return priceElements.map(el => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        text: el.innerText.trim(),
        width: rect.width,
        height: rect.height,
        whiteSpace: style.whiteSpace
      };
    }).slice(0, 8);
  });

  console.log('Sample elemen harga Rp:', JSON.stringify(wrappedCurrencies, null, 2));

  // Simpan screenshot ke artifacts dan local docs
  const artifactDir = '/Users/dendyaditya/.gemini/antigravity-ide/brain/17dcc08e-4d93-40b6-83d5-be249665885d/.tempmediaStorage';
  if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });

  const screenshotPath = path.join(artifactDir, 'daftar_menu_final_verified.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log('Screenshot tersimpan ke:', screenshotPath);

  await browser.close();
}

main().catch(err => {
  console.error('Error saat verifikasi layout:', err);
  process.exit(1);
});
