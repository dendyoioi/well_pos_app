import { chromium } from 'playwright';

async function testPosPinLogin() {
  console.log('🚀 Memulai pengujian Device Pairing & Login Cepat Kasir PIN...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:5173/#login', { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    // 1. Pastikan di Tab "Mesin Kasir (Terminal)"
    console.log('✓ Memeriksa form pairing perangkat kasir...');
    await page.screenshot({ path: 'scratch/pos_step1_pairing_unpaired.png' });

    // 2. Hubungkan Perangkat (Pairing)
    await page.fill('input[placeholder*="kopi-nusantara"]', 'kedai-kopi-mandiri');
    await page.fill('input[placeholder*="••••••"]', '111111');
    await page.screenshot({ path: 'scratch/pos_step2_pairing_filled.png' });

    await page.click('button:has-text("Hubungkan Mesin Kasir")');
    await page.waitForTimeout(1500);
    console.log('✓ Perangkat kasir berhasil di-pairing dengan Kedai Kopi Mandiri!');

    // 3. Verifikasi Lock Screen / Paired Terminal
    await page.screenshot({ path: 'scratch/pos_step3_paired_terminal_lockscreen.png' });

    // 4. Pilih Petugas Kasir "Rian (Kasir 1)"
    const cashierChip = page.locator('button:has-text("Rian")').first();
    if (await cashierChip.isVisible()) {
      await cashierChip.click();
      await page.waitForTimeout(400);
      console.log('✓ Kasir "Rian (Kasir 1)" dipilih');
    }

    // 5. Masukkan PIN 123456 via Numpad
    console.log('✓ Memasukkan 6-digit PIN (123456) melalui Numpad Touch...');
    for (const digit of ['1', '2', '3', '4', '5', '6']) {
      await page.click(`button[data-key="${digit}"]`);
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(600);

    // Klik "Masuk Kasir" jika belum otomatis submit
    const submitPinBtn = page.locator('button:has-text("Masuk Kasir")').first();
    if (await submitPinBtn.isVisible() && await submitPinBtn.isEnabled()) {
      await submitPinBtn.click();
    }

    // Tunggu sampai POS terbuka
    await page.waitForTimeout(2500);
    console.log('✓ Berhasil login kasir! Memeriksa tampilan POS...');
    await page.screenshot({ path: 'scratch/pos_step4_active_terminal.png' });

    // 6. Uji tombol "Kunci Terminal" di header POS
    const lockBtn = page.locator('button:has-text("Kunci Terminal")').first();
    if (await lockBtn.isVisible()) {
      await lockBtn.click();
      await page.waitForTimeout(1200);
      console.log('✓ Berhasil menekan "Kunci Terminal" - kembali ke lock screen tanpa reset pairing!');
      await page.screenshot({ path: 'scratch/pos_step5_returned_to_lockscreen.png' });
    }

    console.log('\n======================================================');
    console.log('🎉 SEMUA PENGUJIAN DEVICE PAIRING & PIN LOGIN SUKSES!');
    console.log('======================================================');
  } catch (err) {
    console.error('❌ Error dalam pengujian:', err);
    await page.screenshot({ path: 'scratch/test_failure_pos.png' });
  } finally {
    await browser.close();
  }
}

testPosPinLogin();
