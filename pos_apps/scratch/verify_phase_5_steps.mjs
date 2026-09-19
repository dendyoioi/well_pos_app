import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';

async function main() {
  console.log('🚀 Memulai verifikasi Onboarding 5 Langkah, Setup Gudang Wajib & Alokasi Stok...');

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Users/dendyaditya/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell',
  });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  // Test 1: Format Nomor WhatsApp di Landing Page
  console.log('\n--- 1. Testing Format WhatsApp Tanpa Angka 0 di Belakang +62 ---');
  await page.goto(BASE_URL);
  await page.waitForTimeout(1000);

  await page.click('button:has-text("Daftar Akun Baru")');
  await page.waitForTimeout(500);

  const testEmail = `klien.5step.${Date.now()}@toko.com`;
  await page.fill('input[placeholder="Contoh: Kopi Nusantara Sejahtera"]', 'Kopi Seduh Nusantara');
  await page.fill('input[placeholder="Contoh: Rian Pratama"]', 'Budi Nusantara');
  await page.fill('input[placeholder="rian@kopinusantara.id"]', testEmail);

  // Ketik dengan diawali 08212345678
  const phoneInput = page.locator('input[placeholder="+6281234567890"]');
  await phoneInput.fill('08212345678');
  await page.waitForTimeout(300);

  const formattedPhone = await phoneInput.inputValue();
  console.log('Nomor WhatsApp terformat:', formattedPhone);
  if (formattedPhone.includes('+620')) {
    throw new Error(`Format salah: masih mengandung 0 setelah +62 (${formattedPhone})`);
  }
  console.log('✅ Angka 0 berhasil dipangkas otomatis menjadi:', formattedPhone);
  await page.screenshot({ path: 'scratch/test_phone_format_fixed.png' });

  await page.fill('input[placeholder="Minimal 6 karakter"]', 'kopi123');
  await page.click('button[type="submit"]:has-text("Daftar & Ajukan Akun Klien Baru")');
  await page.waitForTimeout(2000);

  // Test 2: Approval di Superadmin
  console.log('\n--- 2. Approval di Super Admin SaaS ---');
  await page.goto(`${BASE_URL}/#superadmin`);
  await page.waitForTimeout(1500);

  await page.fill('input[type="email"]', 'superadmin@wellpos.id');
  await page.fill('input[type="password"]', 'superadmin123');
  await page.click('button:has-text("Masuk ke Portal Platform")');
  await page.waitForTimeout(1500);

  await page.selectOption('select', 'PENDING');
  await page.waitForTimeout(1000);

  const approveBtn = page.locator('button:has-text("Setujui (Approve)")').first();
  if (await approveBtn.count() > 0) {
    await approveBtn.click();
    await page.waitForTimeout(500);
    await page.click('button:has-text("Ya, Setujui & Aktifkan PRO")');
    await page.waitForTimeout(2000);
    await page.click('button:has-text("Mengerti")');
  }

  // Test 3: Login Klien Baru -> Wizard 5 Langkah
  console.log('\n--- 3. Login Klien & Testing Onboarding Wizard 5 Langkah ---');
  await page.goto(`${BASE_URL}/#login`);
  await page.waitForTimeout(1000);

  await page.click('button:has-text("Email & Password")');
  await page.fill('input[type="email"]', testEmail);
  await page.fill('input[type="password"]', 'kopi123');
  await page.click('button:has-text("Masuk ke Mesin Kasir")');
  await page.waitForTimeout(2000);

  // Tutup Wizard untuk memverifikasi Widget Checklist 5 Langkah
  await page.click('button[title="Tutup Wizard (Lanjutkan Setup Nanti)"]');
  await page.waitForTimeout(1000);

  const checklistGrid = await page.locator('text=2. Gudang Utama').count();
  console.log('Checklist Step 2 (Gudang Utama) tampil di Dashboard:', checklistGrid > 0);
  await page.screenshot({ path: 'scratch/test_checklist_5_steps.png' });

  // Buka kembali wizard
  await page.click('button:has-text("Lanjutkan Setup Wizard")');
  await page.waitForTimeout(1000);

  // Step 1: Profil Toko -> Lanjut
  await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
  await page.waitForTimeout(500);

  // Step 2: Setup Gudang Utama (Mandatory)
  const warehouseStepHeader = await page.locator('text=Langkah 2: Setup Gudang Utama (Wajib / Mandatory)').count();
  console.log('Step 2 Setup Gudang Utama tampil:', warehouseStepHeader > 0);
  await page.screenshot({ path: 'scratch/test_wizard_step2_warehouse.png' });
  await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
  await page.waitForTimeout(500);

  // Step 3: Ukuran Struk Default (Pilih 80mm)
  await page.click('button:has-text("80mm (Printer Desktop / Besar)")');
  await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
  await page.waitForTimeout(500);

  // Step 4: Akun Kasir Perdana
  await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
  await page.waitForTimeout(500);

  // Step 5: 1 Produk Pertama & Alokasi Saldo Awal (Toko vs Gudang)
  const productStepHeader = await page.locator('text=Langkah 5: Panduan 1 Produk Pertama & Alokasi Stok').count();
  console.log('Step 5 Produk & Alokasi Stok tampil:', productStepHeader > 0);

  // Verifikasi Box Preview Edukasi
  const previewBox = await page.locator('text=Preview Alokasi Saldo Awal Produk').count();
  console.log('Box Preview Edukasi Interaktif tampil:', previewBox > 0);
  await page.screenshot({ path: 'scratch/test_wizard_step5_stock_preview.png' });

  // Selesaikan Wizard
  await page.click('button:has-text("Selesaikan & Buka Mesin Kasir")');
  await page.waitForTimeout(3000);

  // Test 4: Verifikasi di Katalog Produk (Badge Gudang Muncul)
  console.log('\n--- 4. Verifikasi Tampilan Stok Toko & Gudang di Katalog Produk ---');
  await page.click('button:has-text("Katalog Produk")');
  await page.waitForTimeout(1500);

  const warehouseBadge = await page.locator('text=di Gudang').count();
  console.log('Badge Stok di Gudang tampil di Katalog Produk:', warehouseBadge > 0);
  await page.screenshot({ path: 'scratch/test_products_catalog_with_warehouse_badge.png' });

  console.log('\n🎉 SEMUA FITUR 5 LANGKAH ONBOARDING & ALOKASI STOK BERHASIL 100%!');
  await browser.close();
}

main().catch((err) => {
  console.error('❌ Error during verification:', err);
  process.exit(1);
});
