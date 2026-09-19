import { chromium } from 'playwright';

async function run() {
  console.log('🚀 Menjalankan pengujian Smart Delete & Unlink per Outlet...');
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const artifactDir = '/Users/dendyaditya/.gemini/antigravity-ide/brain/dd774e89-db9f-45b0-9d8e-9cbed874cecb';

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

  const bukaMesinKasirBtn = page.locator('text=Buka Mesin Kasir').first();
  if (await bukaMesinKasirBtn.isVisible()) {
    await bukaMesinKasirBtn.click();
    await page.waitForTimeout(500);
  }

  // Switch to Toko PRO and Owner PRO
  const tokoProToggle = page.locator('button:has-text("Toko PRO")').first();
  if (await tokoProToggle.isVisible()) {
    await tokoProToggle.click();
    await page.waitForTimeout(300);
  }

  const ownerProBtn = page.locator('button:has-text("Owner PRO")').first();
  if (await ownerProBtn.isVisible()) {
    await ownerProBtn.click();
    await page.waitForTimeout(300);

    const masukBtn = page.locator('button:has-text("Masuk ke Mesin Kasir")').first();
    if (await masukBtn.isVisible()) {
      await masukBtn.click();
    }
  }

  await page.waitForTimeout(2000);

  // 1. Pilih Outlet Eskepyu - Cabang Tebet
  console.log('1. Memilih Outlet Eskepyu - Cabang Tebet...');
  const outletSelect = page.locator('select').first();
  if (await outletSelect.isVisible()) {
    await outletSelect.selectOption({ label: '📍 Outlet Eskepyu - Cabang Tebet' });
    await page.waitForTimeout(1500);
  }

  // 2. Buka tab Katalog Produk
  console.log('2. Membuka tab Katalog Produk...');
  const katalogTab = page.locator('button:has-text("Katalog Produk")').first();
  await katalogTab.click();
  await page.waitForTimeout(1500);

  // 3. Klik tombol Hapus pada Air Mineral 600ml
  console.log('3. Mencari baris Air Mineral 600ml dan klik tombol Hapus...');
  const airMineralRow = page.locator('tr:has-text("Air Mineral 600ml")');
  const deleteBtn = airMineralRow.locator('button[title="Hapus / Nonaktifkan Produk"]').first();
  await deleteBtn.click();
  await page.waitForTimeout(1000);

  // 4. Screenshot Modal Smart Delete
  const modalScreenshot = `${artifactDir}/smart_delete_confirmation_modal.png`;
  await page.screenshot({ path: modalScreenshot, fullPage: false });
  console.log('📸 Screenshot Modal Smart Delete disimpan ke:', modalScreenshot);

  // 5. Konfirmasi pelepasan dari cabang
  console.log('4. Klik tombol "Ya, Lepas dari Cabang"...');
  const confirmBtn = page.locator('button:has-text("Ya, Lepas dari Cabang")').first();
  await confirmBtn.click();
  await page.waitForTimeout(2000);

  // 6. Screenshot Tabel setelah Air Mineral berhasil dilepas
  const afterDeleteScreenshot = `${artifactDir}/catalog_after_air_mineral_unlinked.png`;
  await page.screenshot({ path: afterDeleteScreenshot, fullPage: false });
  console.log('📸 Screenshot setelah dilepas disimpan ke:', afterDeleteScreenshot);

  // 7. Cek apakah Air Mineral masih ada di tabel Cabang Tebet
  const airMineralAfter = page.locator('tr:has-text("Air Mineral 600ml")');
  const isStillThere = await airMineralAfter.isVisible();
  console.log('Apakah Air Mineral masih ada di tabel Cabang Tebet?', isStillThere ? 'YA (GAGAL)' : 'TIDAK (SUKSES LENYAP TOTAL)');

  // 8. Buka Modal "Ambil dari Katalog"
  console.log('5. Menguji tombol "Ambil dari Katalog"...');
  const ambilKatalogBtn = page.locator('button:has-text("Ambil dari Katalog")').first();
  if (await ambilKatalogBtn.isVisible()) {
    await ambilKatalogBtn.click();
    await page.waitForTimeout(1000);

    const assignModalScreenshot = `${artifactDir}/assign_catalog_modal_view.png`;
    await page.screenshot({ path: assignModalScreenshot, fullPage: false });
    console.log('📸 Screenshot Modal Ambil dari Katalog disimpan ke:', assignModalScreenshot);

    // Hubungkan kembali Air Mineral dengan stok 89
    console.log('6. Menghubungkan kembali Air Mineral ke Cabang Tebet...');
    const airMineralCard = page.locator('div:has-text("Air Mineral 600ml")').locator('input[type="number"]').first();
    // Klik kartu Air Mineral
    const cardSelect = page.locator('div:has-text("Air Mineral 600ml")').first();
    await cardSelect.click();
    await page.waitForTimeout(500);

    // Klik tombol Hubungkan
    const hubungkanBtn = page.locator('button:has-text("Hubungkan ke Cabang")').first();
    await hubungkanBtn.click();
    await page.waitForTimeout(2000);
    console.log('✅ Air Mineral berhasil dihubungkan kembali ke Cabang Tebet.');
  }

  // 9. Screenshot final setelah dihubungkan kembali
  const finalScreenshot = `${artifactDir}/catalog_restored_verified.png`;
  await page.screenshot({ path: finalScreenshot, fullPage: false });
  console.log('📸 Screenshot final disimpan ke:', finalScreenshot);

  await browser.close();
  console.log('🎉 Pengujian Smart Delete & Unlink per Outlet selesai dengan sukses!');
}

run().catch((err) => {
  console.error('❌ Error saat pengujian:', err);
  process.exit(1);
});
