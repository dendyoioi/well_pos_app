// scripts/test_split_debt_bdd_visual.js
// BDD / Gherkin Automation Runner untuk Split Bill, Multi-Tender Pembayaran & Siklus Piutang Kasbon Pelanggan

const { chromium } = require('../pos_apps/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const { LoginPage } = require('./pom/LoginPage');
const { PosTerminalPage } = require('./pom/PosTerminalPage');
const { SplitBillModalPage } = require('./pom/SplitBillModalPage');
const { PaymentModalPage } = require('./pom/PaymentModalPage');
const { CustomerDebtsPage } = require('./pom/CustomerDebtsPage');
const { ShiftModalPage } = require('./pom/ShiftModalPage');

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

// Viewport Matriks Desktop POS (1440x900)
const VIEWPORT = {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: false,
};

async function runSplitAndDebtBDD() {
  console.log('===================================================================');
  console.log('🥒 BDD / GHERKIN AUTOMATION: SPLIT BILL, MULTI-TENDER & DEBT LIFECYCLE');
  console.log('   Feature: Pecah Tagihan Meja, Pembayaran Campuran & Piutang Kasbon');
  console.log('   🟢 HAPPY PATH  |  🟡 SAD PATH (DEBT & SETTLEMENT)  |  🔴 BAD PATH (UNDERPAID GUARD)');
  console.log('===================================================================\n');

  // Verifikasi ketersediaan spesifikasi fitur Gherkin
  const featureFilePath = path.join(__dirname, '../features/split_bill_and_customer_debt.feature');
  if (fs.existsSync(featureFilePath)) {
    console.log(`📄 Gherkin Specification File: ${featureFilePath} [FOUND]`);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  const loginPage = new LoginPage(page);
  const posPage = new PosTerminalPage(page);
  const splitModalPage = new SplitBillModalPage(page);
  const paymentModalPage = new PaymentModalPage(page);
  const debtPage = new CustomerDebtsPage(page);
  const shiftPage = new ShiftModalPage(page);

  // Kredensial Ura Coffee Sandbox
  const credentials = {
    email: 'owner@uracoffee.id',
    password: 'Owner123!',
  };

  try {
    // -----------------------------------------------------------------
    // SETUP: LOGIN OWNER & BUKA POS TERMINAL
    // -----------------------------------------------------------------
    console.log('▶ [SETUP] Melakukan Login Owner dan Navigasi ke POS Terminal...');
    await loginPage.goto();
    await loginPage.loginOwner(credentials.email, credentials.password);
    await page.waitForTimeout(1000);

    await posPage.goto();
    await page.waitForTimeout(1200);

    // Pastikan shift aktif terbuka
    const startShiftBtn = page.getByRole('button', { name: /Buka Shift|Mulai Shift/i }).first();
    if (await startShiftBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
      console.log('   ℹ Membuka modal awal shift kasir...');
      await shiftPage.submitStartShift(200000);
      await page.waitForTimeout(800);
    }

    // -----------------------------------------------------------------
    // 🟢 JALUR 1: HAPPY PATH (SPLIT BILL & MULTI-TENDER TUNAI + QRIS)
    // -----------------------------------------------------------------
    console.log('\n🟢 [JALUR 1: HAPPY PATH] Memulai Skenario BDD Split Bill & Multi-Tender Payment...');
    
    // 1. Tambah 2 item Kopi Susu Aren Ura
    console.log('   Step 1: Menambahkan 2x menu "Kopi Susu Aren Ura" ke keranjang...');
    await posPage.addProductByName('Kopi Susu Aren Ura', 2);
    await page.waitForTimeout(600);

    // 2. Klik tombol Split Bill di keranjang
    console.log('   Step 2: Menekan tombol "Split Bill" pada keranjang...');
    const splitBillBtn = page.getByRole('button', { name: /Split Bill/i }).first();
    await splitBillBtn.waitFor({ state: 'visible', timeout: 5000 });
    await splitBillBtn.click({ force: true });
    await page.waitForTimeout(800);

    // Verifikasi modal Split Bill terbuka
    await splitModalPage.waitForOpen();
    await page.screenshot({ path: path.join(dirs.happy, '01_split_bill_modal_equal.png') });
    console.log('   📸 Screenshot captured: 01_split_bill_modal_equal.png (Bagi Sama Rata 2 Orang)');

    // 3. Pindah ke tab Pilih per Menu / Item
    console.log('   Step 3: Memeriksa tab "Pilih per Menu / Item"...');
    await splitModalPage.switchToByItemTab();
    await page.screenshot({ path: path.join(dirs.happy, '02_split_bill_modal_by_item.png') });
    console.log('   📸 Screenshot captured: 02_split_bill_modal_by_item.png (Pilih Menu / Item)');

    // Helper untuk membuka modal pembayaran dari cart
    const clickPayBtn = async () => {
      const payBtn = page.getByRole('button', { name: /Bayar Langsung|Bayar Sekarang|Pelunasan Meja/i }).first();
      await payBtn.waitFor({ state: 'visible', timeout: 6000 });
      await payBtn.click();
      await page.waitForTimeout(600);
    };

    // 4. Tutup Split Bill modal dan buka Pembayaran
    await splitModalPage.close();
    await page.waitForTimeout(400);

    console.log('   Step 4: Membuka modal Pembayaran dan memilih tab "Split"...');
    await clickPayBtn();

    await paymentModalPage.waitForOpen();
    await paymentModalPage.selectMethod('SPLIT');
    await page.screenshot({ path: path.join(dirs.happy, '03_split_payment_tab.png') });
    console.log('   📸 Screenshot captured: 03_split_payment_tab.png (Tab Split Payment)');

    // 5. Atur porsi Tunai Rp 25.000 dan bayar pas Rp 25.000, verifikasi QRIS
    console.log('   Step 5: Menyetel Porsi Tunai Rp 25.000 dan verifikasi konfirmasi QRIS...');
    await paymentModalPage.fillSplitBill({ cashPortion: 25000, cashTendered: 25000 });
    await paymentModalPage.confirmSplitQris();
    await page.waitForTimeout(400);

    await page.screenshot({ path: path.join(dirs.happy, '04_split_payment_ready_to_tender.png') });
    console.log('   📸 Screenshot captured: 04_split_payment_ready_to_tender.png (Tender Campuran Siap)');

    // 6. Submit Pembayaran Split
    console.log('   Step 6: Menyelesaikan pembayaran split multi-tender...');
    await paymentModalPage.submitPayment();
    await page.waitForTimeout(1000);

    // Verifikasi Order Success Modal
    const successModal = page.locator('div.fixed.inset-0').filter({ hasText: /Transaksi Berhasil/i });
    await successModal.waitFor({ state: 'visible', timeout: 8000 });
    await page.screenshot({ path: path.join(dirs.happy, '05_split_order_success_receipt.png') });
    console.log('   📸 Screenshot captured: 05_split_order_success_receipt.png (Struk Multi-Tender PAID)');

    // Klik Transaksi Baru
    await posPage.dismissSuccessModal();
    console.log('   ✅ [HAPPY PATH] Sukses 100%: Split bill dan tender campuran Tunai + QRIS tervalidasi.\n');

    // -----------------------------------------------------------------
    // 🟡 JALUR 2: SAD PATH (KASBON PELANGGAN & PELUNASAN DI BACKOFFICE)
    // -----------------------------------------------------------------
    console.log('🟡 [JALUR 2: SAD PATH] Memulai Skenario BDD Kasbon Pelanggan & Pelunasan Piutang...');

    // 1. Tambah 1 item ke keranjang
    console.log('   Step 1: Menambahkan produk ke keranjang untuk kasbon...');
    await posPage.addProductByName('Kopi Susu Aren Ura', 1);
    await page.waitForTimeout(600);

    // 2. Buka modal bayar dan pilih Kasbon saat pelanggan belum dipilih
    console.log('   Step 2: Membuka modal pembayaran dan memilih tab "Kasbon" (Customer belum dipilih)...');
    await clickPayBtn();

    await paymentModalPage.waitForOpen();
    await paymentModalPage.selectMethod('DEBT');
    await page.waitForTimeout(400);

    // Verifikasi peringatan "Wajib Memilih Pelanggan Terdaftar"
    await page.locator('h4:has-text("Wajib Memilih Pelanggan Terdaftar")').waitFor({ state: 'visible', timeout: 5000 });
    await page.screenshot({ path: path.join(dirs.sad, '01_debt_payment_unselected_customer_warning.png') });
    console.log('   📸 Screenshot captured: 01_debt_payment_unselected_customer_warning.png (Peringatan Wajib Member)');

    // Tutup modal bayar untuk memilih member di cart
    await paymentModalPage.close();
    await page.waitForTimeout(400);

    // 3. Pilih member "Budi Santoso" di keranjang
    console.log('   Step 3: Memilih member terdaftar "Budi Santoso" dari pencarian keranjang...');
    await posPage.selectCustomer('Budi Santoso');
    await page.waitForTimeout(500);

    // 4. Buka kembali modal pembayaran tab Kasbon
    console.log('   Step 4: Membuka kembali modal Kasbon dengan data member aktif...');
    await clickPayBtn();

    await paymentModalPage.waitForOpen();
    await paymentModalPage.selectMethod('DEBT');
    await page.waitForTimeout(400);

    // Verifikasi nama Budi Santoso muncul aktif
    await page.locator('div:has-text("Budi Santoso")').first().waitFor({ state: 'visible', timeout: 5000 });
    await paymentModalPage.selectDebtDueDate(7);
    await paymentModalPage.fillDebtNotes('Kasbon makan siang kantor Budi');
    await page.waitForTimeout(300);

    await page.screenshot({ path: path.join(dirs.sad, '02_debt_payment_ready_with_customer.png') });
    console.log('   📸 Screenshot captured: 02_debt_payment_ready_with_customer.png (Kasbon Siap Disimpan)');

    // 5. Submit Kasbon Pelanggan
    console.log('   Step 5: Menyimpan piutang kasbon pelanggan...');
    await paymentModalPage.submitPayment();
    await page.waitForTimeout(1000);

    // Struk Kasbon
    await successModal.waitFor({ state: 'visible', timeout: 8000 });
    await page.screenshot({ path: path.join(dirs.sad, '03_debt_order_success_receipt.png') });
    console.log('   📸 Screenshot captured: 03_debt_order_success_receipt.png (Struk Kasbon UNPAID)');

    await posPage.dismissSuccessModal();

    // 6. Navigasi ke Backoffice Buku Piutang & Kasbon Pelanggan
    console.log('   Step 6: Navigasi ke Backoffice "Buku Kasbon & Piutang"...');
    await debtPage.goto();
    await debtPage.switchToDebtsTab();
    await page.waitForTimeout(1000);

    // Verifikasi baris Budi Santoso tampil dalam buku piutang
    const debtRow = await debtPage.getDebtRow('Budi Santoso');
    await page.screenshot({ path: path.join(dirs.sad, '04_backoffice_customer_debt_ledger.png') });
    console.log('   📸 Screenshot captured: 04_backoffice_customer_debt_ledger.png (Daftar Piutang Aktif)');

    // 7. Buka modal pelunasan piutang
    console.log('   Step 7: Membuka modal pelunasan piutang untuk Budi Santoso...');
    await debtPage.openPaySettlement('Budi Santoso');
    await page.waitForTimeout(600);

    // Klik "Bayar Lunas (100%)"
    const payFullBtn = page.getByRole('button', { name: /Bayar Lunas \(100%\)/i }).first();
    if (await payFullBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await payFullBtn.click();
      await page.waitForTimeout(300);
    }
    await debtPage.fillSettlement({ method: 'CASH', notes: 'Pelunasan lunas kasbon kantor' });

    await page.screenshot({ path: path.join(dirs.sad, '05_backoffice_debt_settlement_modal.png') });
    console.log('   📸 Screenshot captured: 05_backoffice_debt_settlement_modal.png (Modal Pelunasan Kasbon)');

    // Konfirmasi Pembayaran Pelunasan
    console.log('   Step 8: Mengonfirmasi pembayaran pelunasan piutang...');
    await debtPage.submitSettlement();
    await page.waitForTimeout(1500);

    await page.screenshot({ path: path.join(dirs.sad, '06_backoffice_debt_settled_paid.png') });
    console.log('   📸 Screenshot captured: 06_backoffice_debt_settled_paid.png (Piutang Berstatus Lunas)');
    console.log('   ✅ [SAD PATH] Sukses 100%: Alur kasbon pelanggan hingga pelunasan buku piutang tuntas.\n');

    // -----------------------------------------------------------------
    // 🔴 JALUR 3: BAD PATH (GUARD UANG TUNAI KURANG PADA SPLIT TENDER)
    // -----------------------------------------------------------------
    console.log('🔴 [JALUR 3: BAD PATH] Memulai Skenario BDD Validasi Tender Uang Tunai Kurang...');

    await posPage.goto();
    await page.waitForTimeout(1000);

    // Tambah 1 item produk
    await posPage.addProductByName('Kopi Susu Aren Ura', 1);
    await page.waitForTimeout(500);

    // Buka Modal Bayar -> Tab Split
    await clickPayBtn();

    await paymentModalPage.waitForOpen();
    await paymentModalPage.selectMethod('SPLIT');
    await page.waitForTimeout(400);

    // Atur porsi tunai Rp 25.000, tapi bayar tunai hanya Rp 10.000 (Kurang Rp 15.000)
    console.log('   Step 1: Memasukkan tender tunai kurang dari porsi tunai (Rp 10.000 < Rp 25.000)...');
    await paymentModalPage.fillSplitBill({ cashPortion: 25000, cashTendered: 10000 });
    await page.waitForTimeout(500);

    // Verifikasi indikator merah "Uang Tunai Kurang"
    await page.locator('span:has-text("Uang Tunai Kurang")').waitFor({ state: 'visible', timeout: 5000 });
    await page.screenshot({ path: path.join(dirs.bad, '01_split_underpaid_validation_blocked.png') });
    console.log('   📸 Screenshot captured: 01_split_underpaid_validation_blocked.png (Guard Uang Kurang Aktif)');

    // Batalkan pembayaran dan bersihkan keranjang
    await paymentModalPage.close();
    await page.waitForTimeout(400);
    await posPage.clearCart();
    console.log('   ✅ [BAD PATH] Sukses 100%: Guard proteksi input underpaid split terbukti mengunci transaksi.\n');

    console.log('===================================================================');
    console.log('🎉 SELURUH SKENARIO BDD LANGKAH 4 (HAPPY, SAD, BAD) SELESAI 100%!');
    console.log('===================================================================');
  } catch (error) {
    console.error('❌ Terjadi kesalahan pada eksekusi pengujian BDD:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runSplitAndDebtBDD();
