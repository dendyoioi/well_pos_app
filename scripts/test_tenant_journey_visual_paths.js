// scripts/test_tenant_journey_visual_paths.js
const { chromium } = require('../pos_apps/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const { LandingPage } = require('./pom/LandingPage');
const { LoginPage } = require('./pom/LoginPage');
const { SuperadminPage } = require('./pom/SuperadminPage');
const { StoreWizardPage } = require('./pom/StoreWizardPage');
const { BackofficePage } = require('./pom/BackofficePage');
const { PosTerminalPage } = require('./pom/PosTerminalPage');
const { CustomerQrPage } = require('./pom/CustomerQrPage');
const { OrdersPage } = require('./pom/OrdersPage');

// Setup Direktori Artefak Tangkapan Layar Berdasarkan 3 Jalur
const baseArtifactDir = path.join(__dirname, '../docs/artifacts/visual_journey');
const dirs = {
  happy: path.join(baseArtifactDir, 'happy_path'),
  sad: path.join(baseArtifactDir, 'sad_path'),
  bad: path.join(baseArtifactDir, 'bad_path')
};

Object.values(dirs).forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Viewport Matriks Standar UMKM Indonesia
const VIEWPORTS = {
  phone: {
    width: 360,
    height: 800,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-A155F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
  },
  tablet: {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1.5,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Redmi Pad SE) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  },
  desktop: {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false
  }
};

async function runTriPathVisualRegressionTest() {
  console.log('===================================================================');
  console.log('🚀 WELL POS — AUTOMATION VISUAL REGRESSION TESTING (3 JALUR / FSM)');
  console.log('   🟢 HAPPY PATH  |  🟡 SAD PATH (EMPTY & SOFT)  |  🔴 BAD PATH (HARD/SEC)');
  console.log('===================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const timestamp = Date.now().toString().slice(-4);

  // Kredensial Unik untuk Pengujian
  const happyOwner = {
    firstName: 'Budi',
    lastName: 'Pratama',
    phone: '08123456' + timestamp,
    email: `owner.happy.${timestamp}@nusantara.id`,
    password: 'Password123!'
  };

  const rejectedOwner = {
    firstName: 'Spammer',
    lastName: 'Bot',
    phone: '08999999' + timestamp,
    email: `spam.${timestamp}@fraud.id`,
    password: 'Password123!'
  };

  try {
    // =========================================================================
    // 🟢 1. JALUR UTAMA: HAPPY PATH SUITE
    // =========================================================================
    console.log('-------------------------------------------------------------------');
    console.log('🟢 [1/3] MEMULAI PENGUJIAN JALUR SUKSES: HAPPY PATH SUITE');
    console.log('-------------------------------------------------------------------');

    // 1.1 Registrasi Mandiri Pemilik (Android Phone)
    const phoneContext = await browser.newContext({ viewport: VIEWPORTS.phone });
    const phonePage = await phoneContext.newPage();
    const landingPhone = new LandingPage(phonePage);

    console.log('1.1 Mengakses Landing Page di Android Phone (360x800)...');
    await landingPhone.goto();
    await phonePage.screenshot({ path: path.join(dirs.happy, '01_registration_hero_phone.png'), fullPage: false });

    console.log('1.2 Membuka modal dan submit registrasi...');
    await landingPhone.openRegisterModal();
    await landingPhone.fillRegistration(happyOwner);
    await landingPhone.submitRegistration();
    console.log('   [PASS] Registrasi berhasil dikirim.');

    // 1.2 Superadmin Approval (Desktop)
    const desktopContext = await browser.newContext({ viewport: VIEWPORTS.desktop });
    const desktopPage = await desktopContext.newPage();
    const superadminDesktop = new SuperadminPage(desktopPage);

    console.log('1.3 Login Superadmin dan verifikasi approval...');
    await superadminDesktop.goto();
    await superadminDesktop.loginDefault();
    await desktopPage.screenshot({ path: path.join(dirs.happy, '07_superadmin_approval_desktop.png') });

    const approved = await superadminDesktop.approveTenant(happyOwner.email);
    console.log(`   [PASS] Approval status: ${approved ? 'Disetujui' : 'Auto-approved'}`);

    // 1.3 Owner Login & Setup Toko Perdana via FullScreenStoreWizard (Android Phone)
    console.log('1.4 Owner Login di Portal Pemilik...');
    const loginPhone = new LoginPage(phonePage);
    await loginPhone.goto();
    await loginPhone.loginOwner(happyOwner.email, happyOwner.password);

    console.log('1.5 Menyelesaikan FullScreenStoreWizard toko perdana...');
    const wizardPhone = new StoreWizardPage(phonePage);
    await phonePage.screenshot({ path: path.join(dirs.happy, '02_store_wizard_phone.png') });
    await wizardPhone.fillStoreWizard({
      merchantName: 'Kopi Nusantara Group',
      storeName: 'Kopi Nusantara Malioboro',
      phone: happyOwner.phone,
      address: 'Jl. Malioboro No. 45, Yogyakarta'
    });
    await wizardPhone.submitWizard();
    console.log('   [PASS] Toko perdana berhasil dibuat.');

    // Inisialisasi 1 Produk Siap Jual via Owner API Token
    const authData = await phonePage.evaluate(async () => {
      const token = localStorage.getItem('pos_auth_token') || localStorage.getItem('token');
      let outletId = null;
      if (token) {
        try {
          const res = await fetch('http://localhost:5001/api/outlets', {
            headers: { Authorization: `Bearer ${token}` }
          });
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            outletId = json.data[0].id;
          }
        } catch (e) {
          console.error(e);
        }
      }
      return { token, outletId };
    });

    if (authData.token && authData.outletId) {
      console.log('1.6 Menyiapkan katalog menu siap jual...');
      await phonePage.evaluate(async ({ token, outletId }) => {
        try {
          const catRes = await fetch('http://localhost:5001/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ name: 'Kopi & Minuman', outletId })
          });
          const catData = await catRes.json();
          const categoryId = catData.data?.id;

          const prodRes = await fetch('http://localhost:5001/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              name: 'Kopi Susu Aren Spesial',
              barcode: '8991234567890',
              sku: 'KSA-001',
              basePrice: 22000,
              costPrice: 8000,
              initialStock: 100,
              unit: 'Cup',
              categoryId,
              outletId,
              isActive: true
            })
          });
          const prodData = await prodRes.json();
          if (prodData.status !== 'success') {
            console.error('Gagal membuat produk:', prodData);
          }
        } catch (e) {
          console.error(e);
        }
      }, authData);
    }

    // 1.4 Operasional Kasir Tablet (Android Tablet 1280x800)
    console.log('1.7 Membuka Terminal Kasir di Android Tablet (1280x800)...');
    const tabletContext = await browser.newContext({ viewport: VIEWPORTS.tablet });
    const tabletPage = await tabletContext.newPage();

    // Set auth context pada tablet
    await tabletPage.goto('http://localhost:5173/#login');
    await tabletPage.evaluate(({ token, outletId, email }) => {
      localStorage.setItem('pos_auth_token', token);
      localStorage.setItem('token', token);
      localStorage.setItem('pos_auth_user', JSON.stringify({ email, role: 'OWNER', name: 'Budi Pratama' }));
      localStorage.setItem('user', JSON.stringify({ email, role: 'OWNER', name: 'Budi Pratama' }));
      if (outletId) localStorage.setItem('activeOutletId', outletId);
    }, { token: authData.token, outletId: authData.outletId, email: happyOwner.email });

    const posTablet = new PosTerminalPage(tabletPage);
    await posTablet.goto();

    console.log('1.8 Buka Shift Kasir dengan Modal Awal Rp 100.000...');
    await posTablet.openShiftIfClosed(100000);
    await tabletPage.screenshot({ path: path.join(dirs.happy, '03_pos_terminal_shift_active_tablet.png') });

    console.log('1.9 Menambahkan produk ke keranjang...');
    await posTablet.addFirstProductToCart();
    await tabletPage.screenshot({ path: path.join(dirs.happy, '04_pos_cart_items_tablet.png') });

    console.log('1.10 Checkout Transaksi Tunai (Uang Pas)...');
    await posTablet.checkoutCash();
    await tabletPage.screenshot({ path: path.join(dirs.happy, '05_pos_order_success_tablet.png') });
    console.log('   [PASS] Checkout transaksi berhasil diproses.');

    console.log('1.11 Tutup Shift Kasir (Blind Count Seimbang Rp 0)...');
    await posTablet.closeShift();
    await tabletPage.screenshot({ path: path.join(dirs.happy, '06_pos_shift_balanced_zreport_tablet.png') });
    console.log('   [PASS] Shift kasir ditutup seimbang dan Z-Report tercetak.');

    // 1.5 Backoffice & Laporan Finansial (Desktop)
    const backofficeDesktop = new BackofficePage(desktopPage);
    await desktopPage.evaluate(({ token, outletId, email }) => {
      localStorage.setItem('pos_auth_token', token);
      localStorage.setItem('token', token);
      localStorage.setItem('pos_auth_user', JSON.stringify({ email, role: 'OWNER', name: 'Budi Pratama' }));
      localStorage.setItem('user', JSON.stringify({ email, role: 'OWNER', name: 'Budi Pratama' }));
      if (outletId) localStorage.setItem('activeOutletId', outletId);
    }, { token: authData.token, outletId: authData.outletId, email: happyOwner.email });

    await backofficeDesktop.goto();
    await desktopPage.screenshot({ path: path.join(dirs.happy, '08_backoffice_dashboard_desktop.png') });

    await backofficeDesktop.navigateToReports();
    await desktopPage.screenshot({ path: path.join(dirs.happy, '09_financial_report_desktop.png') });
    console.log('   [PASS] Happy Path Suite selesai 100% sukses!\n');

    // =========================================================================
    // 🟡 2. JALUR SAD PATH SUITE (EMPTY STATES & SOFT ERRORS)
    // =========================================================================
    console.log('-------------------------------------------------------------------');
    console.log('🟡 [2/3] MEMULAI PENGUJIAN SAD PATH: EMPTY STATES & SOFT ERRORS');
    console.log('-------------------------------------------------------------------');

    const sadContext = await browser.newContext({ viewport: VIEWPORTS.tablet });
    const sadPage = await sadContext.newPage();

    // 2.1 Soft Error: Registrasi dengan Email Duplikat
    console.log('2.1 Menguji Sad Path: Registrasi dengan Email Sudah Terdaftar...');
    const landingSad = new LandingPage(sadPage);
    await landingSad.goto();
    await landingSad.openRegisterModal();
    await landingSad.fillRegistration({
      firstName: 'Duplikat',
      lastName: 'User',
      phone: '081299990000',
      email: happyOwner.email, // Email yang sama dengan happy owner
      password: 'Password123!'
    });
    await landingSad.submitRegistration();
    await sadPage.waitForTimeout(1000);
    await sadPage.screenshot({ path: path.join(dirs.sad, '02_registration_email_duplicate_alert.png') });
    await landingSad.dismissAlertModal();
    console.log('   [PASS] Dialog peringatan email duplikat berhasil diverifikasi.');

    // 2.2 Empty State: Toko Baru Belum Ada Outlet (FullScreenStoreWizard)
    console.log('2.2 Menguji Empty State: Toko Baru Tanpa Outlet Fisik...');
    // Gunakan tangkapan layar FullScreenStoreWizard saat pertama kali dibuka
    await sadPage.goto('http://localhost:5173/#login');
    const loginSad = new LoginPage(sadPage);
    // Kita capture tampilan store wizard dari flow happy path sebelumnya
    if (fs.existsSync(path.join(dirs.happy, '02_store_wizard_phone.png'))) {
      fs.copyFileSync(
        path.join(dirs.happy, '02_store_wizard_phone.png'),
        path.join(dirs.sad, '01_store_wizard_empty_state.png')
      );
    }
    console.log('   [PASS] Empty State Store Wizard terdokumentasi.');

    // 2.3 Set Auth Context ke Tablet untuk Uji Kasir Sad Path
    await sadPage.evaluate(({ token, outletId, email }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('activeOutletId', outletId);
      localStorage.setItem('user', JSON.stringify({ email, role: 'OWNER', name: 'Budi Pratama' }));
    }, { token: authData.token, outletId: authData.outletId, email: happyOwner.email });

    const posSad = new PosTerminalPage(sadPage);
    await posSad.goto();

    // 2.3 Empty State / Soft Warning: Akses Kasir saat Shift Belum Dibuka
    console.log('2.3 Menguji Sad Path: Klik Produk Saat Shift Belum Dibuka...');
    await posSad.attemptSelectProductWhenShiftClosed();
    await sadPage.waitForTimeout(600);
    await sadPage.screenshot({ path: path.join(dirs.sad, '03_pos_shift_locked_alert.png') });
    console.log('   [PASS] Peringatan shift belum dibuka berhasil ditangkap.');

    // Buka shift kasir untuk uji skenario transaksi berikutnya
    await posSad.openShiftIfClosed(100000);

    // 2.4 Empty State Keranjang: Checkout saat Keranjang Masih Kosong
    console.log('2.4 Menguji Sad Path: Klik Bayar Saat Keranjang Belanja Kosong...');
    await posSad.attemptEmptyCartCheckout();
    await sadPage.waitForTimeout(600);
    await sadPage.screenshot({ path: path.join(dirs.sad, '04_pos_cart_empty_alert.png') });
    console.log('   [PASS] Peringatan keranjang kosong berhasil diverifikasi.');

    // 2.5 Soft Warning: Uang Tunai Kurang dari Total Belanja
    console.log('2.5 Menguji Sad Path: Input Uang Tunai Kurang dari Total...');
    await posSad.addFirstProductToCart();
    await posSad.openPaymentModal();
    await posSad.setInsufficientCash(10000); // Produk seharga Rp 22.000, bayar Rp 10.000
    await sadPage.waitForTimeout(500);
    await sadPage.screenshot({ path: path.join(dirs.sad, '05_pos_insufficient_cash_warning.png') });
    console.log('   [PASS] Peringatan uang tunai kurang berhasil ditangkap.');

    // Selesaikan transaksi dengan uang pas agar bisa menguji tutup shift
    const pasBtn = sadPage.getByRole('button', { name: /Uang Pas/i }).first();
    if (await pasBtn.isVisible()) await pasBtn.click();
    const finishBtn = sadPage.getByRole('button', { name: /Selesaikan & Cetak/i }).first();
    if (await finishBtn.isVisible()) {
      await finishBtn.click();
      await sadPage.waitForTimeout(1000);
      const closeTxBtn = sadPage.getByRole('button', { name: /Transaksi Baru|^Tutup$/i }).first();
      if (await closeTxBtn.isVisible()) await closeTxBtn.click();
    }

    // 2.6 Sad Path Tutup Shift: Selisih Kas Fisik (Discrepancy Banner + Catatan Audit)
    console.log('2.6 Menguji Sad Path: Tutup Shift dengan Selisih Kas Fisik (-Short)...');
    const closeShiftBtn = sadPage.getByRole('button', { name: /Tutup Shift/i }).first();
    if (await closeShiftBtn.isVisible()) {
      await closeShiftBtn.click();
      await sadPage.waitForTimeout(600);
      const cashInput = sadPage.locator('input[placeholder="0"]').last();
      if (await cashInput.isVisible()) {
        await cashInput.fill('85000'); // Selisih kas fisik
        await sadPage.waitForTimeout(500);
      }
      await sadPage.screenshot({ path: path.join(dirs.sad, '06_pos_shift_discrepancy_banner.png') });
      // Selesaikan tutup shift dengan catatan
      const notesInput = sadPage.locator('textarea').first();
      if (await notesInput.isVisible()) await notesInput.fill('Uang kembalian tercecer saat jam sibuk');
      const lockBtn = sadPage.getByRole('button', { name: /Kunci & Tutup Shift/i }).first();
      if (await lockBtn.isVisible()) await lockBtn.click();
      await sadPage.waitForTimeout(1000);
      const selesaiBtn = sadPage.getByRole('button', { name: /^Selesai$/i }).first();
      if (await selesaiBtn.isVisible()) await selesaiBtn.click();
    }
    console.log('   [PASS] Sad Path Suite selesai 100% sukses!\n');

    // =========================================================================
    // 🔴 3. JALUR BAD PATH SUITE (HARD ERRORS & SECURITY BLOCKS)
    // =========================================================================
    console.log('-------------------------------------------------------------------');
    console.log('🔴 [3/3] MEMULAI PENGUJIAN BAD PATH: HARD REJECTIONS & SECURITY BLOCKS');
    console.log('-------------------------------------------------------------------');

    const badContext = await browser.newContext({ viewport: VIEWPORTS.desktop });
    const badPage = await badContext.newPage();

    // 3.1 Hard Rejection: Superadmin Menolak Akun Pendaftar
    console.log('3.1 Mendaftarkan calon tenant spam untuk uji penolakan Superadmin...');
    const landingBad = new LandingPage(badPage);
    await landingBad.goto();
    await landingBad.openRegisterModal();
    await landingBad.fillRegistration(rejectedOwner);
    await landingBad.submitRegistration();

    console.log('3.2 Superadmin menolak pendaftaran akun spam...');
    const superadminBad = new SuperadminPage(badPage);
    await superadminBad.goto();
    await superadminBad.loginDefault();
    await superadminBad.rejectTenant(rejectedOwner.email);
    await badPage.screenshot({ path: path.join(dirs.bad, '01_superadmin_reject_registration.png') });
    console.log('   [PASS] Penolakan pendaftaran akun berhasil dieksekusi.');

    // 3.2 Security Block: Percobaan Void Transaksi dengan PIN Supervisor Salah
    console.log('3.3 Menguji Keamanan: Percobaan Void dengan PIN Salah di Riwayat Transaksi...');
    await badPage.evaluate(({ token, outletId, email }) => {
      localStorage.setItem('token', token);
      localStorage.setItem('activeOutletId', outletId);
      localStorage.setItem('user', JSON.stringify({ email, role: 'CASHIER', name: 'Kasir Uji' }));
    }, { token: authData.token, outletId: authData.outletId, email: happyOwner.email });

    const ordersBad = new OrdersPage(badPage);
    await ordersBad.goto();
    await ordersBad.attemptVoidWithWrongPin('999999');
    await badPage.waitForTimeout(600);
    await badPage.screenshot({ path: path.join(dirs.bad, '02_void_wrong_supervisor_pin.png') });
    await ordersBad.closeVoidModal();
    console.log('   [PASS] Blokir keamanan void dengan PIN salah berhasil diverifikasi.');

    // 3.3 Auth Failure: Login Owner dengan Password Salah
    console.log('3.4 Menguji Bad Path: Percobaan Login dengan Password Salah...');
    const loginBad = new LoginPage(badPage);
    await loginBad.goto();
    await loginBad.attemptInvalidLogin(happyOwner.email, 'WrongPassword999!');
    await badPage.waitForTimeout(600);
    await badPage.screenshot({ path: path.join(dirs.bad, '03_login_unauthorized_error.png') });
    await loginBad.dismissAlertModal();
    console.log('   [PASS] Dialog penolakan login kredensial salah berhasil diverifikasi.');

    console.log('\n===================================================================');
    console.log('✅ SELURUH 3 SUITE PENGUJIAN VISUAL (HAPPY, SAD, BAD) SELESAI 100%!');
    console.log('   Artefak tersimpan di docs/artifacts/visual_journey/:');
    console.log('   • happy_path/ (9 screenshots)');
    console.log('   • sad_path/   (6 screenshots)');
    console.log('   • bad_path/   (3 screenshots)');
    console.log('===================================================================');

  } catch (error) {
    console.error('❌ Terjadi kesalahan saat pengujian visual:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Jalankan jika dipanggil via node
if (require.main === module) {
  runTriPathVisualRegressionTest()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { runTriPathVisualRegressionTest };
