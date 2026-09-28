const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const artifactDir = '/Users/dendyaditya/.gemini/antigravity-ide/brain/1ca03e93-2b75-45a8-a75b-cea5c4e38d27';

  console.log('--- STEP 1: VERIFIKASI INVOICE DI SUPERADMIN CONTROL TOWER ---');
  await page.goto('http://localhost:5173/#superadmin', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const isLoginForm = await page.locator('input[type="email"]').count();
  if (isLoginForm > 0) {
    await page.click('button:has-text("Gunakan Akun Default Superadmin")');
    await page.waitForTimeout(300);
    await page.click('button:has-text("Masuk ke Portal Platform")');
    await page.waitForTimeout(2000);
  }

  // Klik Tab Riwayat Billing & Invoicing
  await page.locator('button:has-text("Riwayat Billing")').click();
  await page.waitForTimeout(1000);

  // Klik tombol "Buka Faktur Digital" pada baris invoice pertama
  const viewInvoiceBtn = page.locator('button[title="Buka Faktur Digital"]').first();
  await viewInvoiceBtn.click();
  await page.waitForTimeout(1000);

  // Ambil screenshot Superadmin Invoice Modal setelah perbaikan
  const superadminScreenshot = path.join(artifactDir, '23_superadmin_invoice_audit_fixed.png');
  await page.screenshot({ path: superadminScreenshot });
  console.log('Saved superadmin fixed invoice screenshot to:', superadminScreenshot);

  // Tutup modal invoice
  await page.locator('button:has-text("Tutup")').click();
  await page.waitForTimeout(500);

  // Buka Modal Kelola QRIS Platform di Superadmin
  console.log('--- STEP 1.5: PENGATURAN QRIS STATIS PLATFORM DI SUPERADMIN ---');
  await page.locator('button:has-text("Kelola QRIS & Rekening Platform")').click();
  await page.waitForTimeout(1000);

  const superadminQrisScreenshot = path.join(artifactDir, '28_superadmin_manage_qris_modal.png');
  await page.screenshot({ path: superadminQrisScreenshot });
  console.log('Saved superadmin QRIS management screenshot to:', superadminQrisScreenshot);

  // Tutup modal QRIS
  await page.locator('button:has-text("Batal")').click();
  await page.waitForTimeout(500);

  console.log('--- STEP 2: VERIFIKASI MONITORING KUOTA & TOP-UP DI SISI OWNER ---');
  // Hapus session platform dan set session login Owner Toko Ura Coffee
  await page.evaluate(() => {
    localStorage.removeItem('wellpos_platform_auth_token');
    localStorage.removeItem('wellpos_platform_user');
  });

  // Login via API login toko
  const loginRes = await page.request.post('http://localhost:5001/api/auth/login', {
    data: {
      email: 'owner@uracoffee.id',
      password: 'Owner123!'
    }
  });
  const loginData = await loginRes.json();
  console.log('Owner login response:', loginData.status, loginData.data?.user?.name);

  const ownerToken = loginData.data?.token;
  const ownerUser = loginData.data?.user;

  await page.evaluate(({ token, user }) => {
    localStorage.setItem('pos_auth_token', token);
    localStorage.setItem('pos_auth_user', JSON.stringify(user));
    window.location.hash = '';
  }, { token: ownerToken, user: ownerUser });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Ambil screenshot Backoffice Overview dengan badge Paket & Kuota di Header & Sidebar
  const overviewScreenshot = path.join(artifactDir, '24_owner_backoffice_overview.png');
  await page.screenshot({ path: overviewScreenshot });
  console.log('Saved owner overview screenshot to:', overviewScreenshot);

  // Klik menu "Paket & Kuota" di sidebar
  await page.locator('aside button:has-text("Paket & Kuota")').click();
  await page.waitForTimeout(1500);

  // Ambil screenshot halaman Paket & Kuota Token milik Owner
  const ownerQuotaScreenshot = path.join(artifactDir, '25_owner_billing_and_quota_view.png');
  await page.screenshot({ path: ownerQuotaScreenshot });
  console.log('Saved owner quota view screenshot to:', ownerQuotaScreenshot);

  // Buka Modal Top-Up Kuota Token
  await page.locator('button:has-text("+ Top-Up Kuota Token")').first().click();
  await page.waitForTimeout(800);

  // Pilih Metode Pembayaran QRIS Statis HQ
  await page.locator('button:has-text("QRIS Statis HQ")').click();
  await page.waitForTimeout(500);

  // Ketik kode promo valid HEMAT50K (Diskon Rp 50.000)
  await page.fill('input[placeholder*="HEMAT20"]', 'HEMAT50K');
  await page.locator('button:has-text("Terapkan")').click();
  await page.waitForTimeout(1000);

  // Ambil screenshot Modal Top-Up dengan Kupon Promo & QRIS Statis Platform
  const topUpModalScreenshot = path.join(artifactDir, '26_owner_topup_modal_with_promo.png');
  await page.screenshot({ path: topUpModalScreenshot });
  console.log('Saved top-up modal screenshot to:', topUpModalScreenshot);

  // Klik tombol "Beli Kuota Sekarang"
  await page.locator('button:has-text("Beli Kuota Sekarang")').click();
  await page.waitForTimeout(2000);

  // Ambil screenshot Official Tax Invoice yang berlatar Putih-Biru Resmi
  const ownerInvoiceScreenshot = path.join(artifactDir, '27_owner_official_tax_invoice.png');
  await page.screenshot({ path: ownerInvoiceScreenshot });
  console.log('Saved owner invoice screenshot to:', ownerInvoiceScreenshot);

  await browser.close();
  console.log('=== SELURUH VERIFIKASI SELESAI DENGAN SUKSES! ===');
})();
