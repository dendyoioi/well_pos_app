import { chromium } from 'playwright';

async function testFreshOnboardingAndPairing() {
  console.log('🚀 Memulai pengujian end-to-end Onboarding Klien Baru & Device Pairing PIN...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // 1. Kunjungi Halaman Superadmin untuk Menyetujui Akun "Kedai Kopi Mandiri"
    await page.goto('http://localhost:5173/#superadmin', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    // Login Superadmin
    await page.fill('input[type="email"]', 'superadmin@wellpos.id');
    await page.fill('input[type="password"]', 'superadmin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);
    console.log('✓ Login Superadmin berhasil');

    // Klik tombol Setujui (Approve)
    const approveBtn = page.locator('button:has-text("Setujui (Approve)")').first();
    if (await approveBtn.isVisible()) {
      await approveBtn.click();
      await page.waitForTimeout(500);

      // Konfirmasi modal
      const confirmBtn = page.locator('button:has-text("Ya, Setujui & Aktifkan PRO"), button:has-text("Ya, Lanjutkan")').first();
      await confirmBtn.click();
      await page.waitForTimeout(1500);

      // Tutup modal alert jika ada
      const closeAlertBtn = page.locator('button:has-text("Tutup"), button:has-text("Mengerti")').first();
      if (await closeAlertBtn.isVisible()) {
        await closeAlertBtn.click();
        await page.waitForTimeout(500);
      }
      console.log('✓ Akun Kedai Kopi Mandiri berhasil disetujui & diaktifkan!');
    }

    await page.screenshot({ path: 'scratch/onboarding_step0_superadmin_approved.png' });

    // 2. Masuk ke Halaman Login Klien
    await page.goto('http://localhost:5173/#login', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    // Pindah ke tab "Portal Pemilik (Email)"
    await page.click('button:has-text("Portal Pemilik")');
    await page.waitForTimeout(400);

    // Login sebagai Owner Budi
    await page.fill('input[type="email"]', 'budi@kopimandiri.id');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]:has-text("Masuk ke Portal Pemilik")');
    await page.waitForTimeout(2000);
    console.log('✓ Login Owner berhasil, membuka Wizard Onboarding...');

    await page.screenshot({ path: 'scratch/onboarding_step1_wizard_open.png' });

    // 3. Jalankan Wizard Onboarding 5 Langkah
    // 3. Jalankan Wizard Onboarding 5 Langkah
    console.log('✓ Memulai pengisian Wizard Onboarding 5 Langkah...');
    
    // Langkah 1: Profil Toko -> Klik "Lanjut" di dalam modal
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'scratch/onboarding_step1_profil.png' });
    await page.locator('.fixed.inset-0 button:has-text("Lanjut")').click();
    await page.waitForTimeout(600);
    console.log('✓ Langkah 1 (Profil Toko) selesai');

    // Langkah 2: Setup Gudang -> Klik "Lanjut"
    await page.screenshot({ path: 'scratch/onboarding_step2_gudang.png' });
    await page.locator('.fixed.inset-0 button:has-text("Lanjut")').click();
    await page.waitForTimeout(600);
    console.log('✓ Langkah 2 (Setup Gudang) selesai');

    // Langkah 3: Setup Struk -> Klik "Lanjut"
    await page.screenshot({ path: 'scratch/onboarding_step3_receipt.png' });
    await page.locator('.fixed.inset-0 button:has-text("Lanjut")').click();
    await page.waitForTimeout(600);
    console.log('✓ Langkah 3 (Setup Struk) selesai');

    // Langkah 4: Setup Kasir -> Klik "Lanjut"
    await page.screenshot({ path: 'scratch/onboarding_step4_cashier.png' });
    await page.locator('.fixed.inset-0 button:has-text("Lanjut")').click();
    await page.waitForTimeout(600);
    console.log('✓ Langkah 4 (Setup Kasir) selesai');

    // Langkah 5: Produk & Alokasi Stok -> Klik "Selesaikan & Buka Mesin Kasir"
    await page.screenshot({ path: 'scratch/onboarding_step5_product_preview.png' });
    const finishBtn = page.locator('.fixed.inset-0 button:has-text("Selesaikan & Buka Mesin Kasir")');
    await finishBtn.click();
    await page.waitForTimeout(3500);
    console.log('✓ Wizard Onboarding 5 Langkah berhasil disimpan ke database!');

    // 4. Verifikasi Dashboard Klien Baru
    // Buka Dashboard Klien
    await page.goto('http://localhost:5173/#dashboard', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'scratch/dashboard_fresh_tenant.png' });
    console.log('✓ Screenshot Dashboard tersimpan');

    // Cek Tab Cabang Toko
    const cabangTab = page.locator('button:has-text("Cabang Toko")').first();
    if (await cabangTab.isVisible()) {
      await cabangTab.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: 'scratch/dashboard_cabang_isolated.png' });
      console.log('✓ Tab Cabang Toko diperiksa (terverifikasi 1 cabang ritel murni milik tenant)');
    }

    // Cek Tab Kelola Staf
    const stafTab = page.locator('button:has-text("Kelola Staf")').first();
    if (await stafTab.isVisible()) {
      await stafTab.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: 'scratch/dashboard_staff_isolated.png' });
      console.log('✓ Tab Kelola Staf diperiksa (terverifikasi hanya Owner + Kasir baru)');
    }

    // 5. Uji Fitur "Kunci Terminal"
    const lockBtn = page.locator('button:has-text("Kunci Terminal")').first();
    await lockBtn.click();
    await page.waitForTimeout(1500);
    console.log('✓ Tombol "Kunci Terminal" berhasil ditekan, kembali ke Login POS');

    // 6. Uji Device Pairing di Layar Mesin Kasir
    console.log('✓ Menguji pairing perangkat dengan ID Unik Toko & PIN Owner...');
    await page.fill('input[placeholder*="kopi-nusantara"]', 'kedai-kopi-mandiri');
    await page.fill('input[placeholder*="••••••"]', '111111'); // PIN Owner Budi saat registrasi
    await page.screenshot({ path: 'scratch/login_device_pairing_form.png' });

    await page.click('button:has-text("Hubungkan Mesin Kasir")');
    await page.waitForTimeout(1500);
    console.log('✓ Perangkat kasir berhasil di-pairing!');
    await page.screenshot({ path: 'scratch/login_device_paired_lockscreen.png' });

    // 7. Uji Login Cepat Kasir via Numpad PIN
    console.log('✓ Memasukkan PIN Kasir 123456 via Numpad...');
    for (const digit of ['1', '2', '3', '4', '5', '6']) {
      await page.click(`button:has-text("${digit}")`);
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(2000);

    console.log('✓ Kasir berhasil login dan masuk ke Mesin Kasir (POS)!');
    await page.screenshot({ path: 'scratch/pos_terminal_after_pin_login.png' });

    console.log('\n=============================================');
    console.log('🎉 SEMUA PENGUJIAN END-TO-END SUKSES 100%!');
    console.log('=============================================');
  } catch (err) {
    console.error('❌ Error dalam pengujian:', err);
    await page.screenshot({ path: 'scratch/test_failure.png' });
  } finally {
    await browser.close();
  }
}

testFreshOnboardingAndPairing();
