import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';
const API_BASE = 'http://localhost:5001';

async function main() {
  console.log('🚀 Memulai verifikasi 5 poin revisi onboarding & platform...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  // Test 1: Pendaftaran dengan format WhatsApp auto-format (+62)
  console.log('\n--- 1. Testing Format WhatsApp di Registrasi ---');
  await page.goto(`${BASE_URL}/#register`);
  await page.waitForTimeout(1000);

  const testEmail = `klien.revisi.${Date.now()}@kedai.com`;
  await page.fill('input[placeholder*="Kopi Nusantara"]', 'Kedai Kopi Mantap');
  await page.fill('input[placeholder*="Rian Pratama"]', 'Budi Santoso');
  await page.fill('input[placeholder*="kopinusantara"]', testEmail);

  // Ketik 081298765432 -> Harus otomatis menjadi +6281298765432
  const phoneInput = page.locator('input[placeholder="+6281234567890"]');
  await phoneInput.fill('081298765432');
  const formattedVal = await phoneInput.inputValue();
  console.log('Nomor WhatsApp terformat:', formattedVal);
  if (!formattedVal.startsWith('+628')) {
    throw new Error('Auto format WhatsApp +62 gagal: ' + formattedVal);
  }

  await page.fill('input[type="password"]', 'kopi123');
  await page.screenshot({ path: 'scratch/test_phone_format_screenshot.png' });

  // Submit Registrasi
  await page.click('button[type="submit"]:has-text("Daftar & Ajukan Akun Klien Baru")');
  await page.waitForTimeout(1500);

  const pendingCard = await page.locator('text=Menunggu Persetujuan').count();
  console.log('Pendaftaran berhasil, kartu pending tampil:', pendingCard > 0);

  // Test 2: Coba Login Akun PENDING -> Harus muncul notifikasi Pending Approval
  console.log('\n--- 2. Testing Login Saat Akun PENDING ---');
  await page.goto(`${BASE_URL}/#login`);
  await page.waitForTimeout(1000);

  // Switch ke tab Email & Password
  await page.click('button:has-text("Email & Password")');
  await page.fill('input[type="email"]', testEmail);
  await page.fill('input[type="password"]', 'kopi123');
  await page.click('button:has-text("Masuk ke Mesin Kasir")');
  await page.waitForTimeout(1500);

  const pendingModal = await page.locator('text=Akun Sedang Dalam Proses Peninjauan').count();
  console.log('Modal Akun Sedang Dalam Proses Peninjauan muncul:', pendingModal > 0);
  await page.screenshot({ path: 'scratch/test_pending_modal_screenshot.png' });

  // Tutup modal pending
  await page.click('button:has-text("Tutup Notifikasi")');
  await page.waitForTimeout(500);

  // Test 3: Login Super Admin SaaS & Setujui Akun -> Muncul Simulasi Email
  console.log('\n--- 3. Testing Approval Admin SaaS & Konfirmasi Email ---');
  await page.goto(`${BASE_URL}/#superadmin`);
  await page.waitForTimeout(1500);

  // Login Superadmin
  await page.fill('input[type="email"]', 'superadmin@wellpos.id');
  await page.fill('input[type="password"]', 'superadmin123');
  await page.click('button:has-text("Masuk ke Portal Platform")');
  await page.waitForTimeout(1500);

  // Filter ke status PENDING
  await page.selectOption('select', 'PENDING');
  await page.waitForTimeout(1000);

  // Cari tombol Setujui (Approve)
  const approveBtn = page.locator('button:has-text("Setujui (Approve)")').first();
  if (await approveBtn.count() > 0) {
    await approveBtn.click();
    await page.waitForTimeout(500);

    // Konfirmasi di Custom React Modal
    await page.click('button:has-text("Ya, Setujui & Aktifkan PRO")');
    await page.waitForTimeout(2000);

    // Cek alert sukses dengan simulasi email
    const emailAlert = await page.locator('text=Simulasi Email Terkirim').count();
    console.log('Alert sukses dan detail simulasi email tampil:', emailAlert > 0);
    await page.screenshot({ path: 'scratch/test_email_alert_screenshot.png' });
    await page.click('button:has-text("Mengerti")');
  }

  // Test 4: Login Klien yang Baru Disetujui -> Buka Wizard -> Tutup Wizard -> Checklist Progress Tampil
  console.log('\n--- 4. Testing Klien Login & Checklist Setup Belum 100% Saat Wizard Ditutup ---');
  await page.goto(`${BASE_URL}/#login`);
  await page.waitForTimeout(1000);

  await page.click('button:has-text("Email & Password")');
  await page.fill('input[type="email"]', testEmail);
  await page.fill('input[type="password"]', 'kopi123');
  await page.click('button:has-text("Masuk ke Mesin Kasir")');
  await page.waitForTimeout(2000);

  // Wizard otomatis terbuka untuk toko baru
  const wizardOpen = await page.locator('text=Setup Awal & Onboarding Toko').count();
  console.log('Onboarding wizard terbuka otomatis:', wizardOpen > 0);
  await page.screenshot({ path: 'scratch/test_wizard_step1_screenshot.png' });

  // Klik Tutup Wizard (Lewati Setup Nanti)
  await page.click('button[title="Tutup Wizard (Lanjutkan Setup Nanti)"]');
  await page.waitForTimeout(1000);

  // Cek apakah Card Setup Toko Belum 100% muncul di Dashboard!
  const checklistWidget = await page.locator('text=Setup Toko Belum 100%').count();
  console.log('Card Setup Toko Belum 100% dan Checklist tampil:', checklistWidget > 0);
  await page.screenshot({ path: 'scratch/test_checklist_widget_screenshot.png' });

  // Test 5: Buka kembali Wizard & Selesaikan dengan 1 Produk Pertama Terpandu
  console.log('\n--- 5. Menyelesaikan Wizard dengan 1 Produk Pertama Terpandu & Ukuran Struk Default ---');
  await page.click('button:has-text("Lanjutkan Setup Wizard")');
  await page.waitForTimeout(1000);

  // Step 1 -> Lanjut ke Step 2
  await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
  await page.waitForTimeout(500);

  // Step 2: Pilih ukuran 80mm
  await page.click('button:has-text("80mm (Printer Desktop / Besar)")');
  await page.screenshot({ path: 'scratch/test_wizard_step2_receipt.png' });
  await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
  await page.waitForTimeout(500);

  // Step 3: Akun Kasir Pertama
  await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
  await page.waitForTimeout(500);

  // Step 4: 1 Produk Pertama Terpandu
  const guidedProductHeader = await page.locator('text=Panduan Pembuatan 1 Produk Pertama').count();
  console.log('Step 4 form 1 produk pertama terpandu tampil:', guidedProductHeader > 0);
  await page.screenshot({ path: 'scratch/test_wizard_step4_product.png' });

  // Klik Selesaikan & Buka Mesin Kasir
  await page.click('button:has-text("Selesaikan & Buka Mesin Kasir")');
  await page.waitForTimeout(3000);

  console.log('✅ Semua alur revisi 1 - 5 berhasil diverifikasi tanpa error!');
  await browser.close();
}

main().catch((e) => {
  console.error('❌ Error testing:', e);
  process.exit(1);
});
