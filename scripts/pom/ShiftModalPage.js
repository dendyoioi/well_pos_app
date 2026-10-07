// scripts/pom/ShiftModalPage.js
// Page Object Model untuk Pengelolaan Shift Kasir, Mutasi Kas, Kalkulator Denominasi & Rekonsiliasi Z-Report

class ShiftModalPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;

    // Tombol Header POS
    this.openStartShiftBtn = page.getByRole('button', { name: /^Buka Shift$/i }).first();
    this.openCloseShiftBtn = page.getByRole('button', { name: /^Tutup Shift$/i }).first();
    this.openCashExpenseBtn = page.getByRole('button', { name: /^Kas Keluar$/i }).first();

    // Modal Buka Shift
    this.startShiftModalTitle = page.locator('text=Buka Shift Kasir Baru').first();
    this.startShiftSubmitBtn = page.getByRole('button', { name: /Buka Shift Sekarang|Mulai Buka Shift|Mulai Sesi Shift/i }).first();

    // Modal Kas Masuk / Keluar (Cash Movement)
    this.cashMovementModalTitle = page.locator('text=Pengeluaran Kasir').first();
    this.cashOutTabBtn = page.getByRole('button', { name: /^Kas Keluar$/i }).first();
    this.cashInTabBtn = page.getByRole('button', { name: /^Kas Masuk$/i }).first();
    this.saveCashMovementBtn = page.getByRole('button', { name: /Simpan Pengeluaran Kas|Simpan Kas Masuk|Simpan Mutasi Kas/i }).first();

    // Modal Tutup Shift & Kalkulator Pecahan Uang
    this.closeShiftModalTitle = page.locator('text=Rekap Kas Fisik di Laci').first();
    this.toggleDenomCalcBtn = page.locator('[data-testid="toggle-denom-calc-btn"]').first();
    this.denomCalcContainer = page.locator('[data-testid="denom-calc-container"]').first();
    this.resetDenomBtn = page.locator('[data-testid="reset-denom-btn"]').first();
    this.closeShiftNotesInput = page.locator('input[placeholder*="Contoh: Ada uang kembalian"]').or(page.locator('input[placeholder*="Catatan"]').first()).first();
    this.submitCloseShiftBtn = page.getByRole('button', { name: /Kunci & Tutup Shift|Tutup Shift & Buat Z-Report/i }).first();

    // Z-Report Result View
    this.zReportTitle = page.locator('text=Rekapitulasi Kas Akhir (Z-Report)').first();
    this.finishCloseShiftBtn = page.getByRole('button', { name: /Selesai|Tutup/i }).first();
  }

  /**
   * Membuka modal Buka Shift jika belum dibuka
   */
  async openStartShiftModal() {
    // Tunggu tombol Buka Shift di header POS aktif
    await this.openStartShiftBtn.waitFor({ state: 'visible', timeout: 8000 });
    await this.openStartShiftBtn.click();
    await this.startShiftModalTitle.waitFor({ state: 'visible', timeout: 5000 });
    await this.page.waitForTimeout(400);
  }

  /**
   * Mengisi modal awal dan submit buka shift
   * @param {number} startingCash
   * @param {string} notes
   */
  async submitStartShift(startingCash = 200000, notes = 'Modal awal kasir operasional') {
    await this.openStartShiftModal();
    // Currency input di StartShiftModal dengan form scope terisolasi
    const startForm = this.page.locator('form').filter({ hasText: /Modal Awal|Buka Shift/i }).first();
    const cashInput = startForm.locator('input[placeholder="0"]').first();
    await cashInput.click();
    await this.page.keyboard.press('Meta+A').catch(() => {});
    await this.page.keyboard.press('Control+A').catch(() => {});
    await cashInput.fill(String(startingCash));
    await this.page.waitForTimeout(300);

    const notesInput = startForm.locator('input[placeholder*="keterangan"]').or(startForm.locator('input[value*="Modal awal"]')).first();
    if (await notesInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await notesInput.fill(notes);
    }

    const submitBtn = startForm.getByRole('button', { name: /Mulai Sesi Shift|Buka Shift/i }).first();
    await submitBtn.click();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Membuka modal mutasi kas (Kas Masuk / Kas Keluar)
   */
  async openCashMovementModal() {
    await this.openCashExpenseBtn.waitFor({ state: 'visible', timeout: 5000 });
    await this.openCashExpenseBtn.click();
    await this.cashMovementModalTitle.waitFor({ state: 'visible', timeout: 5000 });
    await this.page.waitForTimeout(400);
  }

  /**
   * Mencatat mutasi kas (CASH_IN atau CASH_OUT)
   * @param {'CASH_IN' | 'CASH_OUT'} type
   * @param {number} amount
   * @param {string} notes
   */
  async recordCashMovement(type = 'CASH_OUT', amount = 20000, notes = 'Pengeluaran es batu') {
    await this.openCashMovementModal();

    const modal = this.page.locator('div.fixed.inset-0').filter({ hasText: /Pengeluaran Kasir|Petty Cash/i }).first();

    if (type === 'CASH_IN') {
      const inTab = modal.getByRole('button', { name: /Kas Masuk/i }).first();
      await inTab.click();
    } else {
      const outTab = modal.getByRole('button', { name: /Kas Keluar/i }).first();
      await outTab.click();
    }
    await this.page.waitForTimeout(300);

    // Isi nominal mutasi kas di dalam form modal
    const amountInput = modal.locator('input[placeholder*="Rp 0"], input[placeholder="0"]').first();
    await amountInput.click();
    await this.page.keyboard.press('Meta+A').catch(() => {});
    await this.page.keyboard.press('Control+A').catch(() => {});
    await amountInput.fill(String(amount));
    await this.page.waitForTimeout(300);

    // Isi keterangan
    const notesIn = modal.locator('input[placeholder*="Iuran sampah"], input[placeholder*="keterangan"]').first();
    if (await notesIn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await notesIn.fill(notes);
      await this.page.waitForTimeout(300);
    }

    // Simpan
    const saveBtn = modal.getByRole('button', { name: /Simpan Pengeluaran Kas|Simpan Kas Masuk/i }).first();
    await saveBtn.click();
    await this.page.waitForTimeout(1000);

    // Tutup modal mutasi kas (klik tombol Tutup di footer atau tombol X)
    const closeBtn = modal.getByRole('button', { name: /^Tutup$/i }).first();
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click();
    } else {
      const closeX = modal.locator('button:has(svg.lucide-x)').first();
      if (await closeX.isVisible({ timeout: 1500 }).catch(() => false)) {
        await closeX.click();
      }
    }
    await this.cashMovementModalTitle.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    await this.page.waitForTimeout(500);
  }

  /**
   * Membuka modal Tutup Shift
   */
  async openCloseShiftModal() {
    await this.openCloseShiftBtn.waitFor({ state: 'visible', timeout: 5000 });
    await this.openCloseShiftBtn.click();
    await this.closeShiftModalTitle.waitFor({ state: 'visible', timeout: 5000 });
    await this.page.waitForTimeout(500);
  }

  /**
   * Membuka / menutup accordion kalkulator denominasi lembar pecahan
   */
  async toggleDenomCalculator() {
    await this.toggleDenomCalcBtn.waitFor({ state: 'visible', timeout: 5000 });
    await this.toggleDenomCalcBtn.click();
    await this.page.waitForTimeout(400);
  }

  /**
   * Mengisi pecahan lembar uang di kalkulator
   * @param {number} denomValue e.g. 100000
   * @param {number} count e.g. 2
   */
  async fillDenomination(denomValue, count) {
    const input = this.page.locator(`[data-testid="denom-input-${denomValue}"]`);
    await input.waitFor({ state: 'visible', timeout: 3000 });
    await input.click();
    await input.fill(String(count));
    await this.page.waitForTimeout(200);
  }

  /**
   * Mengisi manual actual cash
   * @param {number} amount
   */
  async fillActualCash(amount) {
    // Cari CurrencyInput untuk Hitungan Fisik Uang Tunai di Laci dengan form scope terisolasi
    const closeForm = this.page.locator('form').filter({ hasText: /Hitungan Fisik Uang Tunai|Actual Cash/i }).first();
    const actualCashInput = closeForm.locator('input[placeholder="0"]').first();
    await actualCashInput.click();
    await this.page.keyboard.press('Meta+A').catch(() => {});
    await this.page.keyboard.press('Control+A').catch(() => {});
    await actualCashInput.fill(String(amount));
    await this.page.waitForTimeout(300);
  }

  /**
   * Mendapatkan teks status rekonsiliasi kas
   */
  async getReconciliationStatusText() {
    const statusBadge = this.page.locator('text=Status Kas:').first();
    await statusBadge.waitFor({ state: 'visible', timeout: 3000 });
    return await statusBadge.innerText();
  }

  /**
   * Mengisi catatan serah terima tutup shift
   * @param {string} notes
   */
  async fillNotes(notes) {
    if (await this.closeShiftNotesInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await this.closeShiftNotesInput.fill(notes);
      await this.page.waitForTimeout(200);
    }
  }

  /**
   * Mengklik tombol Tutup Shift & Buat Z-Report
   */
  async submitCloseShift() {
    await this.submitCloseShiftBtn.waitFor({ state: 'visible', timeout: 5000 });
    await this.submitCloseShiftBtn.click();
    await this.page.waitForTimeout(1500);
  }

  /**
   * Verifikasi tampilan Z-Report berhasil
   */
  async verifyZReportDisplayed() {
    await this.zReportTitle.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Menutup Z-Report dan menyelesaikan shift
   */
  async finishCloseShift() {
    const finishBtn = this.page.getByRole('button', { name: /^Selesai$/i }).or(this.page.getByRole('button', { name: /Selesai & Keluar/i })).first();
    if (await finishBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await finishBtn.click();
      await this.page.waitForTimeout(1000);
    } else {
      const closeX = this.page.locator('button:has(svg.lucide-x)').first();
      if (await closeX.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeX.click();
        await this.page.waitForTimeout(1000);
      }
    }
  }
}

module.exports = { ShiftModalPage };
