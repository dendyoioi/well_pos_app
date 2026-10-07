/**
 * CloseShiftModalPage.js
 * Page Object Model untuk penutupan shift kasir (CloseShiftModal) dan penerbitan Z-Report
 */
class CloseShiftModalPage {
  constructor(page) {
    this.page = page;
    this.modal = page.locator('div.fixed:has-text("Tutup Shift Kasir"), div.fixed:has-text("Rekap Kas Fisik di Laci"), div.fixed:has-text("Z-Report Selesai")').first();
    this.modalTitle = this.modal.locator('h3');
    this.actualCashInput = this.modal.locator('input[placeholder="0"]').last();
    this.notesInput = this.modal.locator('input[placeholder*="Contoh: Ada uang"]').first();
    this.submitBtn = this.modal.locator('button:has-text("Kunci & Tutup Shift")');
    this.cancelBtn = this.modal.locator('button:has-text("Batal")');
    this.closeIconBtn = this.modal.locator('button:has(svg.lucide-x)').first();
    this.errorAlert = this.modal.locator('div.bg-rose-50').first();
    
    // Z-Report
    this.zReportContainer = page.locator('#z-report-printable');
    this.zReportTitle = this.zReportContainer.locator('text=LAPORAN TUTUP SHIFT');
    this.finishBtn = this.modal.locator('button:has(svg.lucide-x)').first(); // Tombol X pada modal Z-Report menyelesaikan modal
    
    // Denom Calculator
    this.toggleDenomBtn = this.modal.locator('button[data-testid="toggle-denom-calc-btn"]');
  }

  async isOpen() {
    return await this.modal.isVisible({ timeout: 5000 }).catch(() => false);
  }

  async getModalTitle() {
    return (await this.modalTitle.textContent()).trim();
  }

  async getExpectedCash() {
    const textNode = this.modal.locator('text=Total Seharusnya Ada di Laci:').locator('..');
    const text = await textNode.textContent();
    const match = text.match(/Rp\s*([\d\.]+)/);
    if (match) {
      return parseInt(match[1].replace(/\./g, ''), 10);
    }
    return 0;
  }

  async fillActualCash(amount) {
    await this.actualCashInput.waitFor({ state: 'visible', timeout: 5000 });
    await this.actualCashInput.click();
    await this.actualCashInput.fill(String(amount));
  }

  async fillNotes(notes) {
    await this.notesInput.waitFor({ state: 'visible', timeout: 5000 });
    await this.notesInput.fill(notes);
  }

  async getDifferenceText() {
    const badge = this.modal.locator('div:has-text("Status Kas:")').last();
    return (await badge.textContent()).trim();
  }

  async submitCloseShift() {
    await this.submitBtn.waitFor({ state: 'visible', timeout: 5000 });
    await this.submitBtn.click();
  }

  async isZReportVisible() {
    return await this.zReportContainer.isVisible({ timeout: 7000 }).catch(() => false);
  }

  async finishAndClose() {
    // Tombol X di header Z-Report memicu handleFinish
    const closeBtn = this.modal.locator('button:has(svg.lucide-x)').first();
    await closeBtn.click();
    await this.modal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }
}

module.exports = { CloseShiftModalPage };
