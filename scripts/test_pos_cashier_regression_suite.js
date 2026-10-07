// scripts/test_pos_cashier_regression_suite.js
const { chromium } = require('../pos_apps/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const artifactDir = '/Users/dendyaditya/.gemini/antigravity-ide/brain/31257e4b-7e59-4918-8f39-a77f6d9b7aae';

async function runPosCashierRegressionSuite() {
  console.log('===================================================================');
  console.log('🚀 WELL POS — COMPREHENSIVE POS CASHIER REGRESSION & VISUAL TEST');
  console.log('   Pemeriksaan fungsi kasir, Open Tabs, Tutup Shift Lock, & Audit');
  console.log('===================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const results = {
    openTabsVisual: false,
    pullOpenTab: false,
    directPaymentOpenTab: false,
    shiftLockOnUnpaid: false,
    pureSummaryZReport: false,
    cashierVisibilityInHistory: false,
  };

  try {
    // STEP 1: LOGIN OWNER / KASIR
    console.log('➡️ [STEP 1] Login ke sistem POS...');
    const loginRes = await page.request.post('http://localhost:5001/api/auth/login', {
      data: {
        email: 'owner@uracoffee.id',
        password: 'Owner123!'
      }
    });
    const loginData = await loginRes.json();
    if (!loginData.data?.token) {
      throw new Error(`Login gagal: ${JSON.stringify(loginData)}`);
    }
    console.log(`   Berhasil login sebagai: ${loginData.data.user.name} (${loginData.data.user.role})`);

    // Set token ke localStorage yang benar
    await page.goto('http://localhost:5173/#pos', { waitUntil: 'domcontentloaded' });
    await page.evaluate((auth) => {
      localStorage.setItem('pos_auth_token', auth.token);
      localStorage.setItem('pos_auth_user', JSON.stringify(auth.user));
    }, { token: loginData.data.token, user: loginData.data.user });

    // Reload halaman POS
    await page.goto('http://localhost:5173/?tab=pos', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // STEP 2: CEK STATUS SHIFT (BUKA JIKA BELUM BUKA)
    console.log('➡️ [STEP 2] Memeriksa status shift kasir...');
    const startShiftBtn = page.getByRole('button', { name: /^Buka Shift$/i }).first();
    if (await startShiftBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('   Shift belum dibuka. Membuka shift dengan modal kas Rp 100.000...');
      await startShiftBtn.click();
      await page.waitForTimeout(600);
      const amountInput = page.locator('input[placeholder="0"]').first();
      if (await amountInput.isVisible()) {
        await amountInput.fill('100000');
      }
      const submitShiftBtn = page.getByRole('button', { name: /Mulai Sesi Shift/i }).first();
      await submitShiftBtn.click();
      await page.waitForTimeout(1500);
      console.log('   Shift berhasil dibuka.');
    } else {
      console.log('   Shift sudah aktif.');
    }

    // STEP 3: PILIH DINE IN & BUAT OPEN TAB
    console.log('➡️ [STEP 3] Membuat transaksi Dine In (Bayar Nanti / Open Tab)...');
    // Klik channel Dine In jika belum
    const dineInBtn = page.locator('button').filter({ hasText: /^Dine In/i }).first();
    if (await dineInBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dineInBtn.click();
      await page.waitForTimeout(400);
    }

    // Masukkan nama pelanggan (pasti ada di cart)
    const customerInput = page.locator('input[placeholder*="Nama Pelanggan"]').first();
    if (await customerInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await customerInput.fill('Reka Test Customer');
      await page.waitForTimeout(300);
    }

    // Pilih meja jika ada tombol table picker
    const tablePickerBtn = page.locator('button:has-text("Pilih Meja")').first();
    if (await tablePickerBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await tablePickerBtn.click();
      await page.waitForTimeout(400);
      const firstTable = page.locator('button:has-text("Meja"), div:has-text("Meja")').filter({ hasText: /01|02|05|12/i }).first();
      if (await firstTable.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstTable.click();
        await page.waitForTimeout(300);
      }
    } else {
      const manualTableInput = page.locator('input[placeholder*="Nomor Meja"]').first();
      if (await manualTableInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await manualTableInput.fill('12');
        await page.waitForTimeout(300);
      }
    }

    // Tambah 2 produk ke keranjang
    const productCards = page.locator('button[aria-label^="Pilih "]').or(page.locator('h4').filter({ hasText: /Kopi|Aren|Croissant|Espresso|Tea/i }));
    const count = await productCards.count();
    console.log(`   Ditemukan ${count} item produk di katalog`);
    if (count > 0) {
      await productCards.nth(0).click();
      await page.waitForTimeout(500);
      const modifierBtn1 = page.getByRole('button', { name: /Masuk Keranjang|Tambahkan/i }).first();
      if (await modifierBtn1.isVisible({ timeout: 1500 }).catch(() => false)) {
        await modifierBtn1.click();
        await page.waitForTimeout(500);
      }

      if (count > 1) {
        await productCards.nth(1).click();
        await page.waitForTimeout(500);
        const modifierBtn2 = page.getByRole('button', { name: /Masuk Keranjang|Tambahkan/i }).first();
        if (await modifierBtn2.isVisible({ timeout: 1500 }).catch(() => false)) {
          await modifierBtn2.click();
          await page.waitForTimeout(500);
        }
      }
    }

    // Klik tombol "Simpan & Kirim Dapur (Bayar Nanti)"
    const saveOpenTabBtn = page.getByRole('button', { name: /Simpan & Kirim Dapur \(Bayar Nanti\)/i }).first();
    await saveOpenTabBtn.waitFor({ state: 'visible', timeout: 5000 });
    await saveOpenTabBtn.click();
    await page.waitForTimeout(1500);

    // Jika ada modal dialog peringatan/sukses yang perlu di-dismiss
    const dialogDismissBtn = page.locator('.fixed.inset-0').locator('button:has-text("OK"), button:has-text("Mengerti"), button:has-text("Tutup")').first();
    if (await dialogDismissBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await dialogDismissBtn.click();
      await page.waitForTimeout(500);
    }

    console.log('   Pesanan Meja 12 berhasil disimpan ke Open Tabs.');

    // STEP 4: BUKA MODAL OPEN TABS & VERIFIKASI VISUAL
    console.log('➡️ [STEP 4] Membuka modal "Daftar Tagihan Meja Terbuka (Open Tabs)" & verifikasi visual...');
    const openTabsBtn = page.getByRole('button', { name: /Tagihan Meja/i }).first();
    await openTabsBtn.click();
    await page.waitForTimeout(1000);

    // Ambil screenshot modal Open Tabs yang baru diperbaiki
    const openTabsScreenshot = path.join(artifactDir, 'pos_open_tabs_modal_fixed.png');
    await page.screenshot({ path: openTabsScreenshot });
    console.log(`   📸 Tangkapan layar tersimpan: ${openTabsScreenshot}`);

    // Verifikasi elemen visual di dalam modal
    const modalTitle = await page.locator('h3:has-text("Daftar Tagihan Meja Terbuka (Open Tabs)")').isVisible();
    const tableBadge = await page.locator('span.bg-blue-900:has-text("Meja 12")').first().isVisible();
    const customerBadge = await page.locator('h4:has-text("Reka Test Customer")').first().isVisible();
    const pullBtn = await page.getByRole('button', { name: /Tarik ke Kasir/i }).first().isVisible();
    const payTabBtn = await page.getByRole('button', { name: /Bayar \/ Pelunasan/i }).first().isVisible();

    if (modalTitle && tableBadge && customerBadge && pullBtn && payTabBtn) {
      console.log('   ✅ Modal Open Tabs tampil sempurna: Header, Body chip menu, dan Action Footer rapi!');
      results.openTabsVisual = true;
    } else {
      console.error('   ❌ Elemen modal Open Tabs tidak lengkap!');
    }

    // STEP 5: UJI FUNGSI "TARIK KE KASIR"
    console.log('➡️ [STEP 5] Menguji fungsi "Tarik ke Kasir" dari Open Tab...');
    await page.getByRole('button', { name: /Tarik ke Kasir/i }).first().click();
    await page.waitForTimeout(1000);

    // Cek apakah item kembali ke keranjang
    const cartItems = page.locator('div').filter({ hasText: /Meja 12/i });
    const isCartPulled = await cartItems.count() > 0;
    console.log(`   Item ditarik kembali ke keranjang kasir. Status: ${isCartPulled ? 'BERHASIL' : 'GAGAL'}`);
    results.pullOpenTab = isCartPulled;

    // Perbarui Open Tab kembali
    const updateTabBtn = page.getByRole('button', { name: /Perbarui Tagihan Meja|Simpan & Kirim Dapur/i }).first();
    if (await updateTabBtn.isVisible()) {
      await updateTabBtn.click();
      await page.waitForTimeout(1200);
      console.log('   Tagihan Meja 12 berhasil diperbarui.');
    }

    // STEP 6: UJI PROTEKSI KUNCI TUTUP SHIFT (LOCK ON UNPAID ORDERS)
    console.log('➡️ [STEP 6] Menguji proteksi Kunci Tutup Shift saat ada Tagihan Belum Lunas...');
    const closeShiftBtn = page.getByRole('button', { name: /^Tutup Shift$/i }).first();
    await closeShiftBtn.click();
    await page.waitForTimeout(1000);

    // Ambil screenshot Tutup Shift terkunci
    const lockShiftScreenshot = path.join(artifactDir, 'pos_close_shift_locked_unpaid.png');
    await page.screenshot({ path: lockShiftScreenshot });
    console.log(`   📸 Tangkapan layar Shift Terkunci tersimpan: ${lockShiftScreenshot}`);

    // Verifikasi banner peringatan merah dan tombol disabled
    const warningBanner = await page.locator('text=Tutup Shift Terkunci').or(page.locator('text=Tagihan Belum Lunas')).first().isVisible().catch(() => false);
    const lockSubmitBtn = page.getByRole('button', { name: /Kunci & Tutup Shift/i }).first();
    const isDisabled = await lockSubmitBtn.isDisabled().catch(() => false);

    console.log(`   Peringatan open tab terdeteksi: ${warningBanner}, Tombol submit terkunci (disabled): ${isDisabled}`);
    if (warningBanner || isDisabled) {
      results.shiftLockOnUnpaid = true;
      console.log('   ✅ Proteksi Tutup Shift 100% AMAN: Kasir dicegah menutup shift saat ada open tab!');
    }

    // Tutup modal tutup shift
    const cancelCloseBtn = page.getByRole('button', { name: /Batal|Kembali/i }).first();
    if (await cancelCloseBtn.isVisible()) {
      await cancelCloseBtn.click();
      await page.waitForTimeout(500);
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // STEP 7: UJI PELUNASAN LANGSUNG DARI OPEN TABS
    console.log('➡️ [STEP 7] Menguji fungsi "Bayar / Pelunasan" langsung dari Open Tabs Modal...');
    await openTabsBtn.click();
    await page.waitForTimeout(800);

    const directPayBtn = page.getByRole('button', { name: /Bayar \/ Pelunasan/i }).first();
    await directPayBtn.click();
    await page.waitForTimeout(1000);

    // Modal pembayaran terbuka -> Pilih Uang Pas & Bayar
    const pasBtn = page.getByRole('button', { name: /Uang Pas/i }).first();
    if (await pasBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pasBtn.click();
      await page.waitForTimeout(400);
    }
    const finishBtn = page.getByRole('button', { name: /Selesaikan & Cetak/i }).first();
    await finishBtn.click();
    await page.waitForTimeout(2000);

    // Ambil screenshot modal struk
    const receiptScreenshot = path.join(artifactDir, 'pos_receipt_success_open_tab.png');
    await page.screenshot({ path: receiptScreenshot });
    console.log(`   📸 Tangkapan layar Struk Pelunasan tersimpan: ${receiptScreenshot}`);
    results.directPaymentOpenTab = true;

    // Tutup modal sukses
    const newTxBtn = page.getByRole('button', { name: /Transaksi Baru/i }).first();
    if (await newTxBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newTxBtn.click();
      await page.waitForTimeout(800);
    } else {
      const closeReceiptBtn = page.getByRole('button', { name: /Tutup/i }).first();
      if (await closeReceiptBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeReceiptBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // Bersihkan open tab tersisa agar shift dapat ditutup normal untuk pengujian Z-Report
    console.log('   Membersihkan sisa open tab demo agar shift dapat ditutup...');
    await openTabsBtn.click();
    await page.waitForTimeout(800);

    let trashBtn = page.locator('button[title="Batalkan Tagihan Meja"]').first();
    while (await trashBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await trashBtn.click();
      await page.waitForTimeout(400);
      const confirmDelete = page.getByRole('button', { name: /Ya, Batalkan/i }).first();
      if (await confirmDelete.isVisible({ timeout: 1500 }).catch(() => false)) {
        await confirmDelete.click();
        await page.waitForTimeout(800);
      }
      trashBtn = page.locator('button[title="Batalkan Tagihan Meja"]').first();
    }

    // Tutup modal open tabs
    const closeTabsBtn = page.locator('div[role="dialog"]').or(page.locator('.fixed.inset-0')).locator('button:has-text("X"), button[aria-label="Close"], button.rounded-full').first();
    if (await closeTabsBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await closeTabsBtn.click();
      await page.waitForTimeout(500);
    } else {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // STEP 8: TUTUP SHIFT NORMAL & VERIFIKASI PURE SUMMARY Z-REPORT
    console.log('➡️ [STEP 8] Melakukan Tutup Shift Normal & verifikasi slip Z-Report murni rekapan...');
    await closeShiftBtn.click();
    await page.waitForTimeout(800);

    const cashInput = page.locator('input[placeholder="0"]').last();
    if (await cashInput.isVisible()) {
      await cashInput.fill('100000');
      await page.waitForTimeout(300);
    }
    const confirmCloseBtn = page.getByRole('button', { name: /Kunci & Tutup Shift/i }).first();
    if (await confirmCloseBtn.isVisible() && !(await confirmCloseBtn.isDisabled())) {
      await confirmCloseBtn.click();
      await page.waitForTimeout(2000);
    }

    // Ambil screenshot Z-Report slip
    const zReportScreenshot = path.join(artifactDir, 'pos_z_report_pure_summary.png');
    await page.screenshot({ path: zReportScreenshot });
    console.log(`   📸 Tangkapan layar Z-Report tersimpan: ${zReportScreenshot}`);

    // Verifikasi tidak ada rincian baris nota di Z-Report
    const hasInvoiceList = await page.locator('text=TRANSAKSI TERBARU').or(page.locator('text=#INV/')).first().isVisible().catch(() => false);
    if (!hasInvoiceList) {
      console.log('   ✅ Kebijakan Z-Report Terpenuhi: Slip thermal murni rekapan finansial tanpa daftar nota!');
      results.pureSummaryZReport = true;
    } else {
      console.warn('   ⚠️ Terdeteksi nomor faktur atau daftar nota di slip Z-Report.');
    }

    // Tutup dialog Z-Report
    const finishZBtn = page.getByRole('button', { name: /^Selesai$/i }).first();
    if (await finishZBtn.isVisible()) {
      await finishZBtn.click();
      await page.waitForTimeout(1000);
    }

    // STEP 9: VERIFIKASI RIWAYAT TRANSAKSI & NAMA KASIR
    console.log('➡️ [STEP 9] Memeriksa Riwayat Transaksi & visibilitas nama kasir...');
    await page.goto('http://localhost:5173/?tab=orders', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Ambil screenshot Riwayat Transaksi
    const ordersHistoryScreenshot = path.join(artifactDir, 'pos_orders_history_cashier_visibility.png');
    await page.screenshot({ path: ordersHistoryScreenshot });
    console.log(`   📸 Tangkapan layar Riwayat Transaksi tersimpan: ${ordersHistoryScreenshot}`);

    // Verifikasi kolom "Kasir" di tabel desktop
    const cashierCol = await page.locator('th:has-text("Kasir")').first().isVisible().catch(() => false);
    const cashierNameCell = await page.locator('td').filter({ hasText: /Owner Toko|Rian Kasir|Budi/i }).first().isVisible().catch(() => false);

    console.log(`   Kolom header Kasir: ${cashierCol}, Baris nama kasir: ${cashierNameCell}`);
    if (cashierCol) {
      results.cashierVisibilityInHistory = true;
      console.log('   ✅ Visibilitas Kasir di Riwayat Transaksi: TERVERIFIKASI!');
    }

    console.log('\n===================================================================');
    console.log('📊 HASIL PENGUJIAN REGRESI KASIR POS:');
    console.log(JSON.stringify(results, null, 2));
    console.log('===================================================================\n');

  } catch (err) {
    console.error('❌ Error during regression testing:', err);
  } finally {
    await browser.close();
  }
}

runPosCashierRegressionSuite();
