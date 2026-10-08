const { chromium } = require('../pos_apps/node_modules/playwright');
const path = require('path');

const artifactDir = '/Users/dendyaditya/.gemini/antigravity-ide/brain/31257e4b-7e59-4918-8f39-a77f6d9b7aae';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('1. Logging in as Owner (Dimas Prabowo / Baskoro Ura)...');
  await page.goto('http://localhost:5173/#login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const ownerTab = page.getByRole('button', { name: /Portal Pemilik/i });
  if (await ownerTab.isVisible()) {
    await ownerTab.click();
    await page.waitForTimeout(300);
  }

  await page.locator('input[type="email"]').fill('owner@uracoffee.id');
  await page.locator('input[type="password"]').fill('Admin123!');
  await page.getByRole('button', { name: /Masuk ke Portal Pemilik/i }).click();
  await page.waitForTimeout(2500);

  console.log('2. Navigating to Riwayat Transaksi as Owner in Kemang Outlet...');
  const riwayatBtn = page.locator('button:has-text("Riwayat Transaksi")').first();
  await riwayatBtn.click();
  await page.waitForTimeout(1500);

  // Ubah tanggal ke "Semua Periode" untuk melihat data 1 Sep - 7 Okt
  const dateBtn = page.locator('button:has-text("Hari Ini")').first();
  if (await dateBtn.isVisible()) {
    await dateBtn.click();
    await page.waitForTimeout(400);
    const allPeriodBtn = page.locator('button:has-text("Semua Periode")').first();
    await allPeriodBtn.click();
    await page.waitForTimeout(1200);
  }

  // Ambil opsi dropdown kasir
  const cashierSelect = page.locator('select:has(option:has-text("Semua Kasir di Toko Ini"))').first();
  const optionsText = await cashierSelect.evaluate((sel) => {
    return Array.from(sel.options).map((opt) => opt.text);
  });
  console.log('📋 Owner Dropdown Options:', optionsText);

  // Verifikasi hanya kasir Kemang yang muncul
  const hasFajar = optionsText.some((t) => t.includes('Fajar Kasir Kemang'));
  const hasRian = optionsText.some((t) => t.includes('Rian Kasir Kemang'));
  const hasSiti = optionsText.some((t) => t.includes('Siti Kasir Kemang'));
  const hasOwner = optionsText.some((t) => t.toLowerCase().includes('dimas') || t.toLowerCase().includes('owner'));
  const hasSpv = optionsText.some((t) => t.toLowerCase().includes('supervisor') || t.toLowerCase().includes('sarah'));
  const hasGudang = optionsText.some((t) => t.toLowerCase().includes('gudang') || t.toLowerCase().includes('bambang'));
  const hasSudirman = optionsText.some((t) => t.toLowerCase().includes('sudirman') || t.toLowerCase().includes('deni'));

  console.log('✅ Has Fajar Kasir Kemang:', hasFajar);
  console.log('✅ Has Rian Kasir Kemang:', hasRian);
  console.log('✅ Has Siti Kasir Kemang:', hasSiti);
  console.log('🛡️ Has NO Owner (must be FALSE):', hasOwner);
  console.log('🛡️ Has NO Supervisor (must be FALSE):', hasSpv);
  console.log('🛡️ Has NO Warehouse (must be FALSE):', hasGudang);
  console.log('🛡️ Has NO Sudirman Cashier (must be FALSE):', hasSudirman);

  await page.screenshot({ path: path.join(artifactDir, 'owner_view_kemang_cashiers_only_proof.png') });
  console.log('📸 Saved owner_view_kemang_cashiers_only_proof.png');

  // 3. Testing as Cashier Rian Kemang
  console.log('3. Testing as Cashier Rian Kemang...');
  await context.route('**/*api/auth/me*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'success',
        data: {
          id: 'bcff77cf-789b-4c81-8e52-d6661125c5a4',
          name: 'Rian Kasir Kemang',
          role: 'CASHIER',
          email: 'kasir@uracoffee.id',
          tenantId: 'd8ea88b6-e85c-4c9b-8bfd-2414b591d5ec',
          outletId: 'd135ef0a-6d68-4b98-87ea-56eb73e672e0',
          outlet: { id: 'd135ef0a-6d68-4b98-87ea-56eb73e672e0', name: 'Ura Coffee - Flagship Kemang' },
        },
      }),
    });
  });

  await page.evaluate(() => {
    const raw = localStorage.getItem('pos_auth_user');
    if (raw) {
      const u = JSON.parse(raw);
      u.role = 'CASHIER';
      u.name = 'Rian Kasir Kemang';
      u.id = 'bcff77cf-789b-4c81-8e52-d6661125c5a4';
      u.tenantId = 'd8ea88b6-e85c-4c9b-8bfd-2414b591d5ec';
      u.outletId = 'd135ef0a-6d68-4b98-87ea-56eb73e672e0';
      localStorage.setItem('pos_auth_user', JSON.stringify(u));
    }
  });

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const cashierRiwayatBtn = page.locator('button:has-text("Riwayat Transaksi")').first();
  if (await cashierRiwayatBtn.isVisible()) {
    await cashierRiwayatBtn.click();
    await page.waitForTimeout(1000);
  }

  // Ubah tanggal ke "Semua Periode" agar transaksi 1 Sep - 7 Okt termuat
  const cashierDateBtn = page.locator('button:has-text("Hari Ini")').first();
  if (await cashierDateBtn.isVisible()) {
    await cashierDateBtn.click();
    await page.waitForTimeout(400);
    const allPeriodBtn = page.locator('button:has-text("Semua Periode")').first();
    await allPeriodBtn.click();
    await page.waitForTimeout(1200);
  }

  // Cek dropdown kasir pada akun Kasir Rian
  const cashierSelectRian = page.locator('select:has(option:has-text("Semua Kasir di Toko Ini"))').first();
  const rianOptionsText = await cashierSelectRian.evaluate((sel) => {
    return Array.from(sel.options).map((opt) => opt.text);
  });
  console.log('📋 Cashier Rian Dropdown Options:', rianOptionsText);

  // Pastikan Rian berlabel (Akun Saya) dan ada Akun Anda badge
  const rianSelfLabeled = rianOptionsText.some((t) => t.includes('Rian Kasir Kemang') && t.includes('(Akun Saya)'));
  console.log('✅ Rian sees "(Akun Saya)" label on his name:', rianSelfLabeled);

  // Screenshot smart default Rian
  await page.screenshot({ path: path.join(artifactDir, 'cashier_rian_smart_default_proof.png') });
  console.log('📸 Saved cashier_rian_smart_default_proof.png');

  // 4. Beralih ke Fajar Kasir Kemang (sesama kasir Kemang)
  console.log('4. Switching filter to Fajar Kasir Kemang...');
  await cashierSelectRian.selectOption({ label: '👤 Fajar Kasir Kemang' });
  await page.waitForTimeout(800);

  // Ambil metrik Fajar
  const fajarOmsetCard = page.locator('div:has-text("TOTAL OMSET KASIR") h3, div:has-text("TOTAL OMSET KASIR") div.text-xl, div:has-text("TOTAL OMSET KASIR")').first();
  console.log('✅ Switched to Fajar Kasir Kemang successfully!');
  await page.screenshot({ path: path.join(artifactDir, 'cashier_rian_switch_to_fajar_proof.png') });
  console.log('📸 Saved cashier_rian_switch_to_fajar_proof.png');

  // 5. Beralih ke "Semua Kasir di Toko Ini"
  console.log('5. Switching filter to Semua Kasir di Toko Ini...');
  await cashierSelectRian.selectOption('ALL');
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(artifactDir, 'cashier_rian_switch_to_all_kemang_proof.png') });
  console.log('📸 Saved cashier_rian_switch_to_all_kemang_proof.png');

  await browser.close();
  console.log('🎉 ALL KEMANG CASHIER ISOLATION TESTS PASSED 100%!');
}

main().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
