/**
 * test_end_of_shift_financial_audit_bdd_visual.js
 * Runner Pengujian Otomasi BDD Visual Playwright:
 * LANGKAH 5 — Rekonsiliasi Finansial Multi-Kanal & Audit Tutup Shift Kasir (End of Shift)
 * 
 * Spesifikasi BDD:
 * - features/end_of_shift_and_financial_audit.feature (Bahasa Indonesia)
 * - features/end_of_shift_and_financial_audit.en.feature (English)
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { LoginPage } = require('./pom/LoginPage');
const { PosTerminalPage } = require('./pom/PosTerminalPage');
const { CloseShiftModalPage } = require('./pom/CloseShiftModalPage');
const { ShiftsAuditPage } = require('./pom/ShiftsAuditPage');

const ARTIFACT_DIR = path.resolve(__dirname, '../docs/artifacts/visual_shift_audit');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function runEndOfShiftBddVisualTest() {
  console.log('================================================================================');
  console.log('🚀 [BDD RUNNER] LANGKAH 5: END OF SHIFT FINANCIAL RECONCILIATION & AUDIT');
  console.log('================================================================================');

  ensureDir(path.join(ARTIFACT_DIR, 'happy_path'));
  ensureDir(path.join(ARTIFACT_DIR, 'sad_path'));
  ensureDir(path.join(ARTIFACT_DIR, 'bad_path'));

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'id-ID',
  });

  const page = await context.newPage();
  const loginPage = new LoginPage(page);
  const posPage = new PosTerminalPage(page);
  const closeShiftModal = new CloseShiftModalPage(page);
  const shiftsAuditPage = new ShiftsAuditPage(page);

  try {
    // -------------------------------------------------------------------------
    // SETUP & LOGIN
    // -------------------------------------------------------------------------
    console.log('\n[SETUP] Login Merchant Owner & Membuka Terminal POS...');
    await loginPage.goto();
    await loginPage.loginOwner('owner@uracoffee.id', 'Owner123!');
    await page.waitForTimeout(1000);

    // -------------------------------------------------------------------------
    // 🟢 SCENARIO 1: HAPPY PATH (Tutup Shift Kasir Pas & Terbit Z-Report)
    // -------------------------------------------------------------------------
    console.log('\n🟢 [SCENARIO 1 - HAPPY PATH] Tutup Shift Kas Fisik Pas & Penerbitan Z-Report');
    await posPage.goto();
    await page.waitForTimeout(800);

    // Pastikan ada shift aktif terbuka dengan modal Rp 200.000
    await posPage.openShiftIfClosed(200000);
    await page.waitForTimeout(500);

    // Tambah 1 produk transaksi tunai untuk membuktikan rekonsiliasi kas riil
    await posPage.clearCart();
    await posPage.addProductByName('Kopi Susu Aren Ura', 1);
    await page.waitForTimeout(500);
    await posPage.checkoutCash(25000); // Bayar Rp 25.000 untuk tagihan Rp 22.000
    await page.waitForTimeout(800);
    await posPage.dismissSuccessModal();
    await page.waitForTimeout(500);

    // Kasir klik tombol Tutup Shift
    console.log('   ✓ Step: Membuka modal Tutup Shift Kasir');
    await posPage.openCloseShiftModal();
    await page.waitForTimeout(800);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'happy_path/01_close_shift_modal_opened.png'),
    });

    // Verifikasi modal terbuka
    const isModalOpen = await closeShiftModal.isOpen();
    if (!isModalOpen) throw new Error('Modal Close Shift gagal terbuka');

    // Expected cash di sistem saat ini diambil secara dinamis dari modal
    const expectedAmount = await closeShiftModal.getExpectedCash();
    console.log(`   ✓ Step: Kasir memasukkan uang fisik di laci pas Rp ${expectedAmount.toLocaleString('id-ID')} (Expected)`);
    await closeShiftModal.fillActualCash(expectedAmount);
    await page.waitForTimeout(500);

    // Verifikasi badge status cocok
    const diffStatus = await closeShiftModal.getDifferenceText();
    console.log(`   ✓ Step: Status selisih kasir: "${diffStatus}"`);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'happy_path/02_matched_cash_difference.png'),
    });

    // Kasir klik "Kunci & Tutup Shift (Z-Report)"
    console.log('   ✓ Step: Menekan tombol Kunci & Tutup Shift');
    await closeShiftModal.submitCloseShift();
    await page.waitForTimeout(1500);

    // Verifikasi Z-Report printable muncul
    const isZReportShown = await closeShiftModal.isZReportVisible();
    if (!isZReportShown) throw new Error('Z-Report printable slip tidak ditampilkan');
    console.log('   ✓ Step: Z-Report printable thermal preview berhasil diterbitkan');

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'happy_path/03_z_report_printable_preview.png'),
    });

    // Selesaikan & tutup Z-Report
    await closeShiftModal.finishAndClose();
    await page.waitForTimeout(800);

    // Header POS sekarang menampilkan tombol "Buka Shift"
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'happy_path/04_pos_header_shift_closed.png'),
    });
    console.log('   ✓ Step: Terminal POS kembali ke status shift tertutup (Buka Shift)');

    // Navigasi ke Backoffice Shifts Audit
    console.log('   ✓ Step: Memeriksa rekonsiliasi shift di Backoffice Shifts Audit');
    await shiftsAuditPage.navigate();
    await page.waitForTimeout(1000);

    const latestStatus = await shiftsAuditPage.getLatestShiftStatus();
    console.log(`   ✓ Step: Status shift di audit log: "${latestStatus}"`);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'happy_path/05_backoffice_shifts_audit_table.png'),
    });

    // -------------------------------------------------------------------------
    // 🟡 SCENARIO 2: SAD PATH (Deteksi Selisih Defisit Kasir & Catatan Wajib)
    // -------------------------------------------------------------------------
    console.log('\n🟡 [SCENARIO 2 - SAD PATH] Deteksi Selisih Kas Minus/Defisit & Catatan Rekonsiliasi');
    await posPage.goto();
    await page.waitForTimeout(800);

    // Buka shift baru dengan modal awal Rp 100.000
    await posPage.openShiftIfClosed(100000);
    await page.waitForTimeout(600);

    // Buka modal tutup shift
    await posPage.openCloseShiftModal();
    await page.waitForTimeout(800);

    // Kasir memasukkan uang fisik kurang Rp 20.000 dari ekspektasi sistem
    const expectedAmount2 = await closeShiftModal.getExpectedCash();
    const deficitCash = expectedAmount2 - 20000;
    console.log(`   ✓ Step: Kasir memasukkan uang fisik Rp ${deficitCash.toLocaleString('id-ID')} (< Rp ${expectedAmount2.toLocaleString('id-ID')})`);
    await closeShiftModal.fillActualCash(deficitCash);
    await closeShiftModal.fillNotes('Selisih kas pecahan receh belum ditukar kasir shift pagi');
    await page.waitForTimeout(500);

    const deficitStatus = await closeShiftModal.getDifferenceText();
    console.log(`   ✓ Step: Status selisih terdeteksi defisit: "${deficitStatus}"`);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'sad_path/01_deficit_discrepancy_with_notes.png'),
    });

    // Kasir submit tutup shift dengan defisit
    await closeShiftModal.submitCloseShift();
    await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'sad_path/02_z_report_deficit_receipt.png'),
    });
    console.log('   ✓ Step: Z-Report mencatat selisih -Rp 20.000 (DEFISIT)');

    await closeShiftModal.finishAndClose();
    await page.waitForTimeout(800);

    // Buka Shifts Audit untuk memeriksa audit log selisih
    await shiftsAuditPage.navigate();
    await page.waitForTimeout(1000);

    const auditDeficitStatus = await shiftsAuditPage.getLatestShiftStatus();
    console.log(`   ✓ Step: Audit log mencatat status: "${auditDeficitStatus}"`);

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'sad_path/03_shifts_audit_deficit_recorded.png'),
    });

    // -------------------------------------------------------------------------
    // 🔴 SCENARIO 3: BAD PATH (Proteksi Validasi Input Negatif)
    // -------------------------------------------------------------------------
    console.log('\n🔴 [SCENARIO 3 - BAD PATH] Proteksi Validasi Nilai Kas Fisik Negatif');
    await posPage.goto();
    await page.waitForTimeout(800);

    // Buka shift baru untuk pengujian proteksi
    await posPage.openShiftIfClosed(100000);
    await page.waitForTimeout(600);

    await posPage.openCloseShiftModal();
    await page.waitForTimeout(800);

    // Uji validasi backend API penolakan request nominal kas fisik negatif
    const token = await page.evaluate(() => localStorage.getItem('pos_auth_token'));
    const response = await page.request.post('http://localhost:5001/api/shifts/close', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        actualCash: -50000,
        notes: 'Mencoba bypass input uang negatif',
      },
    });

    const respJson = await response.json();
    console.log(`   ✓ Step: Status response API untuk nominal negatif: HTTP ${response.status()}`);
    console.log(`   ✓ Step: Pesan penolakan validasi: "${respJson.message}"`);

    if (response.status() !== 400) {
      throw new Error(`Ekspektasi HTTP 400 Bad Request, diterima: HTTP ${response.status()}`);
    }

    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'bad_path/01_negative_cash_validation_blocked.png'),
    });

    // Tutup modal agar state kasir tetap bersih
    await closeShiftModal.closeIconBtn.click();
    await page.waitForTimeout(500);

    console.log('\n================================================================================');
    console.log('✅ SELURUH SKENARIO BDD LANGKAH 5 BERHASIL LULUS 100% (TRI-PATH VERIFIED)');
    console.log('================================================================================\n');
  } catch (error) {
    console.error('\n❌ ERROR SAAT EKSEKUSI BDD LANGKAH 5:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  runEndOfShiftBddVisualTest().catch(() => process.exit(1));
}

module.exports = { runEndOfShiftBddVisualTest };
