// scripts/pom/PaymentModalPage.js
class PaymentModalPage {
  constructor(page) {
    this.page = page;
    this.modal = page.locator('div.fixed.inset-0').filter({ hasText: 'Pembayaran Kasir' });
    this.cashMethodBtn = this.modal.getByRole('button', { name: 'Tunai', exact: true });
    this.qrisMethodBtn = this.modal.getByRole('button', { name: 'QRIS', exact: true });
    this.splitMethodBtn = this.modal.getByRole('button', { name: 'Split', exact: true });
    this.debtMethodBtn = this.modal.getByRole('button', { name: 'Kasbon', exact: true });
    this.finishBtn = this.modal.getByRole('button', { name: /Selesaikan & Cetak|Catat Kasbon Pelanggan/i });
    this.cancelBtn = this.modal.getByRole('button', { name: /Batal/i });
  }

  async waitForOpen() {
    await this.modal.waitFor({ state: 'visible', timeout: 8000 });
  }

  async selectMethod(method) {
    if (method === 'CASH') {
      await this.cashMethodBtn.click();
    } else if (method === 'QRIS') {
      await this.qrisMethodBtn.click();
    } else if (method === 'SPLIT') {
      await this.splitMethodBtn.click();
    } else if (method === 'DEBT') {
      await this.debtMethodBtn.click();
    }
    await this.page.waitForTimeout(400);
  }

  async fillSplitBill({ cashPortion, cashTendered }) {
    // 1. Porsi Tunai
    const cashPortionBox = this.modal.locator('div').filter({ hasText: /^Porsi Tunai/i }).first();
    const cashPortionInput = cashPortionBox.locator('input').first();
    if (await cashPortionInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cashPortionInput.fill(String(cashPortion));
      await this.page.waitForTimeout(300);
    }

    // 2. Uang Fisik Tunai Diterima Pelanggan
    const tenderedBox = this.modal.locator('label').filter({ hasText: /Uang Fisik Tunai Diterima/i }).first().locator('..');
    const tenderedInput = tenderedBox.locator('input').first();
    if (await tenderedInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tenderedInput.fill(String(cashTendered !== undefined ? cashTendered : cashPortion));
      await this.page.waitForTimeout(300);
    }
  }

  async confirmSplitQris() {
    const confirmBtn = this.modal.getByRole('button', { name: /Konfirmasi QRIS/i }).first();
    if (await confirmBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await confirmBtn.click();
      await this.page.waitForTimeout(400);
    }
  }

  async selectDebtDueDate(days = 7) {
    const dueBtn = this.modal.getByRole('button', { name: new RegExp(`\\+${days} Hari`, 'i') }).first();
    if (await dueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dueBtn.click();
      await this.page.waitForTimeout(300);
    }
  }

  async fillDebtNotes(notes) {
    const notesArea = this.modal.locator('textarea[placeholder*="keperluan"]').first();
    if (await notesArea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await notesArea.fill(notes);
      await this.page.waitForTimeout(200);
    }
  }

  async submitPayment() {
    await this.finishBtn.waitFor({ state: 'visible', timeout: 5000 });
    await this.finishBtn.click();
    await this.page.waitForTimeout(1500);

    // Tunggu modal pembayaran menghilang
    await this.modal.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
  }

  async close() {
    if (await this.cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.cancelBtn.click();
      await this.modal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    }
  }
}

module.exports = { PaymentModalPage };
