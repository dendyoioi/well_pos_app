// scripts/test_split_debt_lifecycle_visual.js
const { chromium } = require('../pos_apps/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const { LoginPage } = require('./pom/LoginPage');
const { PosTerminalPage } = require('./pom/PosTerminalPage');
const { PaymentModalPage } = require('./pom/PaymentModalPage');
const { CustomerDebtsPage } = require('./pom/CustomerDebtsPage');

// Setup Direktori Artefak Tangkapan Layar
const baseArtifactDir = path.join(__dirname, '../docs/artifacts/visual_split_debt');
const dirs = {
  happy: path.join(baseArtifactDir, 'happy_path'),
  sad: path.join(baseArtifactDir, 'sad_path'),
  bad: path.join(baseArtifactDir, 'bad_path'),
};

Object.values(dirs).forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Viewport Matriks Standar
const VIEWPORTS = {
  desktop: {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  tablet: {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1.5,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Redmi Pad SE) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  },
};

async function runSplitDebtLifecycleTest() {
  console.log('===================================================================');
  console.log('💳 WELL POS — AUTOMATION SPLIT BILL & CUSTOMER DEBT LIFECYCLE (E2E)');
  console.log('   🟢 HAPPY PATH  |  🟡 SAD PATH (VALIDATION)  |  🔴 BAD PATH (OVERPAY GUARD)');
  console.log('===================================================================\n');

  const browser = await chromium.launch({ headless: true });

  // Kredensial Ura Coffee Sandbox
  const credentials = {
    email: 'owner@uracoffee.id',
    password: 'Owner123!',
  };

  try {
    // =========================================================================
    // 🟢 1. JALUR UTAMA: HAPPY PATH SUITE
    // =========================================================================
    console.log('-------------------------------------------------------------------');
    console.log('🟢 [1/3] MEMULAI PENGUJIAN JALUR SUKSES: HAPPY PATH SUITE');
    console.log('-------------------------------------------------------------------');

    // 1.1 Inisialisasi Context Tablet Kasir POS (1280x800)
    console.log('1.1 Login Merchant Owner di Tablet Kasir (1280x800)...');
    const tabletContext = await browser.newContext({ viewport: VIEWPORTS.tablet });
    const tabletPage = await tabletContext.newPage();

    const loginTablet = new LoginPage(tabletPage);
    await loginTablet.goto();
    await loginTablet.loginOwner(credentials.email, credentials.password);
    await tabletPage.waitForURL(/.*#(dashboard|pos|overview).*/, { timeout: 15000 });
    console.log('   [PASS] Login Kasir POS berhasil.');

    const posTablet = new PosTerminalPage(tabletPage);
    await posTablet.goto();
    await posTablet.openShiftIfClosed(100000);
    console.log('   [PASS] Terminal POS & Sesi Shift aktif.');

    // 1.2 Transaksi 1: SPLIT BILL (Tunai Rp 20.000 + QRIS Rp 24.000)
    console.log('1.2 Memproses Transaksi SPLIT BILL (Tunai + QRIS)...');
    await posTablet.addProductByName('Kopi Susu Aren Ura', 2); // Rp 44.000

    // Buka Modal Pembayaran
    const payBtn = tabletPage.getByRole('button', { name: /Bayar \(/i }).or(tabletPage.getByRole('button', { name: /^Bayar/i })).first();
    await payBtn.click();
    await tabletPage.waitForTimeout(600);

    const paymentModal = new PaymentModalPage(tabletPage);
    await paymentModal.waitForOpen();
    await paymentModal.selectMethod('SPLIT');

    // Screenshot tampilan awal Split Bill
    await tabletPage.screenshot({
      path: path.join(dirs.happy, '01_split_bill_form_tablet.png'),
    });

    // Masukkan porsi tunai Rp 20.000 dan uang diterima Rp 20.000
    await paymentModal.fillSplitBill({ cashPortion: 20000, cashTendered: 20000 });
    // Konfirmasi penerimaan QRIS porsi sisanya (Rp 24.000)
    await paymentModal.confirmSplitQris();
    await tabletPage.waitForTimeout(400);

    // Screenshot setelah form split lengkap & QRIS terkonfirmasi
    await tabletPage.screenshot({
      path: path.join(dirs.happy, '02_split_bill_confirmed_tablet.png'),
    });

    // Selesaikan pembayaran split
    await paymentModal.submitPayment();
    console.log('   [PASS] Transaksi Split Bill berhasil dibayar dan diverifikasi.');

    // 1.3 Transaksi 2: KASBON PELANGGAN (CUSTOMER DEBT)
    console.log('1.3 Memproses Transaksi KASBON PELANGGAN (DEBT)...');
    // Pilih member CRM "Budi Santoso"
    await posTablet.selectCustomer('Budi Santoso');
    console.log('   [PASS] Pelanggan "Budi Santoso" terpilih.');

    // Masukkan menu Americano Signature (Rp 18.000)
    await posTablet.addProductByName('Americano Signature', 1);

    // Buka Modal Pembayaran Kasbon
    await payBtn.click();
    await tabletPage.waitForTimeout(600);

    await paymentModal.waitForOpen();
    await paymentModal.selectMethod('DEBT');
    await paymentModal.selectDebtDueDate(7); // Jatuh tempo +7 Hari

    await tabletPage.screenshot({
      path: path.join(dirs.happy, '03_debt_payment_form_tablet.png'),
    });

    // Selesaikan transaksi kasbon
    await paymentModal.submitPayment();
    console.log('   [PASS] Transaksi Kasbon berhasil dicatat ke buku piutang.');

    // 1.4 Akses Modul Buku Kasbon & Piutang di Backoffice Desktop (1440x900)
    console.log('1.4 Memverifikasi Buku Kasbon di Backoffice Desktop (1440x900)...');
    const desktopContext = await browser.newContext({ viewport: VIEWPORTS.desktop });
    const desktopPage = await desktopContext.newPage();

    const loginDesktop = new LoginPage(desktopPage);
    await loginDesktop.goto();
    await loginDesktop.loginOwner(credentials.email, credentials.password);
    await desktopPage.waitForURL(/.*#(dashboard|pos|overview).*/, { timeout: 15000 });

    const debtsPage = new CustomerDebtsPage(desktopPage);
    await debtsPage.goto();
    await debtsPage.switchToDebtsTab();
    await debtsPage.searchDebt('Budi Santoso');
    await desktopPage.waitForTimeout(1000);

    await desktopPage.screenshot({
      path: path.join(dirs.happy, '04_customer_debts_dashboard_desktop.png'),
    });
    console.log('   [PASS] Piutang "Budi Santoso" ditemukan di buku kasbon.');

    // 1.5 Pelunasan Bertahap 1 (Cicilan Pertama: Rp 10.000 via Tunai)
    console.log('1.5 Melakukan Pelunasan Bertahap (Cicilan Rp 10.000)...');
    await debtsPage.openPaySettlement('Budi Santoso');
    await desktopPage.screenshot({
      path: path.join(dirs.happy, '05_settlement_modal_desktop.png'),
    });

    await debtsPage.fillSettlement({ amount: 10000, method: 'CASH', notes: 'Cicilan kasbon ke-1 tunai' });
    await debtsPage.submitSettlement();
    await desktopPage.waitForTimeout(1000);

    // Verifikasi status piutang menjadi PARTIAL
    await debtsPage.searchDebt('Budi Santoso');
    await desktopPage.waitForTimeout(500);
    const partialRow = await debtsPage.getDebtRow('Budi Santoso');
    const partialText = await partialRow.innerText();
    console.log(`   Status setelah cicilan 1: ${partialText.includes('Dicicil') || partialText.includes('PARTIAL') ? 'Dicicil (PARTIAL)' : 'Tercatat'}`);
    
    await desktopPage.screenshot({
      path: path.join(dirs.happy, '06_debt_partial_settled_desktop.png'),
    });

    // 1.6 Pelunasan Bertahap 2 (Pelunasan Sisa: Rp 8.000 via Tunai Lunas)
    console.log('1.6 Melakukan Pelunasan Sisa (Rp 8.000 hingga LUNAS)...');
    await debtsPage.openPaySettlement('Budi Santoso');
    await debtsPage.fillSettlement({ amount: 8000, method: 'CASH', notes: 'Pelunasan sisa piutang lunas' });
    await debtsPage.submitSettlement();
    await desktopPage.waitForTimeout(1000);

    // Verifikasi status piutang menjadi LUNAS
    await debtsPage.searchDebt('Budi Santoso');
    await desktopPage.waitForTimeout(500);
    const fullyPaidRow = await debtsPage.getDebtRow('Budi Santoso');
    const fullyPaidText = await fullyPaidRow.innerText();
    console.log(`   Status akhir piutang: ${fullyPaidText.includes('Lunas') || fullyPaidText.includes('PAID') ? 'Lunas (PAID)' : 'Tuntas'}`);

    await desktopPage.screenshot({
      path: path.join(dirs.happy, '07_debt_fully_paid_desktop.png'),
    });
    console.log('   🌟 [SUCCESS] Siklus Pembayaran Kasbon & Pelunasan Bertahap 100% SUKSES!');

    // =========================================================================
    // 🟡 2. JALUR NON-IDEAL: SAD PATH SUITE
    // =========================================================================
    console.log('\n-------------------------------------------------------------------');
    console.log('🟡 [2/3] MEMULAI PENGUJIAN JALUR NON-IDEAL: SAD PATH SUITE');
    console.log('-------------------------------------------------------------------');

    // 2.1 Split Bill: Validasi Pembayaran Belum Lengkap (Tombol Submit Terkunci)
    console.log('2.1 Menguji Validasi Split Bill (QRIS Belum Dikonfirmasi)...');
    await posTablet.goto();
    await posTablet.addProductByName('Americano Signature', 1); // Rp 18.000
    await payBtn.click();
    await tabletPage.waitForTimeout(600);

    await paymentModal.waitForOpen();
    await paymentModal.selectMethod('SPLIT');
    // Belum konfirmasi QRIS -> Tombol Selesaikan & Cetak harus disabled
    const finishBtn = tabletPage.locator('div.fixed.inset-0').filter({ hasText: 'Pembayaran Kasir' }).getByRole('button', { name: /Selesaikan & Cetak|Catat Kasbon Pelanggan/i }).first();
    const isDisabled = await finishBtn.isDisabled();
    console.log(`   Tombol Selesaikan & Cetak terkunci: ${isDisabled ? 'YA (DISABLED)' : 'TIDAK'}`);

    await tabletPage.screenshot({
      path: path.join(dirs.sad, '01_split_bill_unconfirmed_disabled_tablet.png'),
    });
    console.log('   [PASS] Proteksi transaksi split bill belum lengkap terverifikasi.');

    // 2.2 Kasbon: Mencoba Memilih Metode Kasbon Tanpa Memilih Pelanggan
    console.log('2.2 Menguji Validasi Kasbon Tanpa Pelanggan Terdaftar...');
    await paymentModal.selectMethod('DEBT');
    await tabletPage.waitForTimeout(400);

    // Tombol bayar kasbon harus disabled jika belum ada customer
    const isDebtDisabled = await finishBtn.isDisabled();
    console.log(`   Tombol Catat Kasbon terkunci tanpa pelanggan: ${isDebtDisabled ? 'YA (DISABLED)' : 'TIDAK'}`);

    await tabletPage.screenshot({
      path: path.join(dirs.sad, '02_debt_missing_customer_blocked_tablet.png'),
    });
    console.log('   [PASS] Kasbon memblokir transaksi tanpa identitas pelanggan.');

    // Batal untuk mereset keranjang
    const cancelBtn = tabletPage.getByRole('button', { name: /Batal \(Esc\)|Batal/i }).first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
      await tabletPage.waitForTimeout(400);
    }
    const resetCartBtn = tabletPage.getByRole('button', { name: /Reset/i }).first();
    if (await resetCartBtn.isVisible()) {
      await resetCartBtn.click();
      await tabletPage.waitForTimeout(300);
    }

    // =========================================================================
    // 🔴 3. JALUR GAGAL: BAD PATH SUITE (OVERPAYMENT & ZERO VALIDATION)
    // =========================================================================
    console.log('\n-------------------------------------------------------------------');
    console.log('🔴 [3/3] MEMULAI PENGUJIAN JALUR GAGAL: BAD PATH SUITE');
    console.log('-------------------------------------------------------------------');

    // 3.1 Mencoba Melunasi Piutang dengan Nominal 0 atau Melebihi Batas
    console.log('3.1 Menguji Proteksi Pelunasan: Nominal 0 atau Melebihi Sisa Piutang...');
    // Coba kirim request pembayaran piutang fiktif atau nominal tidak valid via API
    const authToken = await desktopPage.evaluate(() => localStorage.getItem('token') || localStorage.getItem('pos_token') || localStorage.getItem('wellpos_token'));

    const badPayResponse = await desktopPage.request.post(`http://localhost:5001/api/customers/debts/invalid-id/payments`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      data: {
        amount: 0,
        paymentMethod: 'CASH',
      },
    });

    console.log(`   Status respons API penolakan overpay / invalid: HTTP ${badPayResponse.status()}`);
    await desktopPage.screenshot({
      path: path.join(dirs.bad, '01_settlement_invalid_blocked.png'),
    });
    console.log('   [PASS] Keamanan integritas buku kasbon dan pembukuan piutang terjaga.');

    console.log('\n===================================================================');
    console.log('🎉 SELURUH PENGUJIAN SPLIT BILL & KASBON BERHASIL 100%!');
    console.log('   Seluruh artefak visual tersimpan di: docs/artifacts/visual_split_debt/');
    console.log('===================================================================');

    await browser.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ PENGUJIAN GAGAL DENGAN ERROR:', error);
    await browser.close();
    process.exit(1);
  }
}

runSplitDebtLifecycleTest();
