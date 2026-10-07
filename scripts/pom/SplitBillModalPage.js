// scripts/pom/SplitBillModalPage.js
class SplitBillModalPage {
  constructor(page) {
    this.page = page;
    this.modal = page.locator('div.fixed.inset-0').filter({ hasText: 'Pecah Tagihan (Split Bill)' });
    this.equalTabBtn = this.modal.getByRole('button', { name: /Bagi Sama Rata/i });
    this.byItemTabBtn = this.modal.getByRole('button', { name: /Pilih per Menu \/ Item/i });
    this.closeBtn = this.modal.getByRole('button', { name: /Tutup/i });
  }

  async waitForOpen() {
    await this.modal.waitFor({ state: 'visible', timeout: 8000 });
  }

  async selectPeopleCount(count) {
    const btn = this.modal.getByRole('button', { name: `${count} Orang` });
    await btn.waitFor({ state: 'visible', timeout: 5000 });
    await btn.click();
    await this.page.waitForTimeout(300);
  }

  async switchToByItemTab() {
    await this.byItemTabBtn.click();
    await this.page.waitForTimeout(400);
  }

  async switchToEqualTab() {
    await this.equalTabBtn.click();
    await this.page.waitForTimeout(400);
  }

  async selectItemByIndex(index = 0) {
    const itemRows = this.modal.locator('div.cursor-pointer');
    await itemRows.nth(index).click();
    await this.page.waitForTimeout(300);
  }

  async payEqualFirstPerson() {
    const payBtn = this.modal.getByRole('button', { name: /Bayar \(Rp/i }).first();
    await payBtn.waitFor({ state: 'visible', timeout: 5000 });
    await payBtn.click();
    await this.modal.waitFor({ state: 'hidden', timeout: 6000 });
  }

  async close() {
    if (await this.closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.closeBtn.click();
      await this.modal.waitFor({ state: 'hidden', timeout: 5000 });
    }
  }
}

module.exports = { SplitBillModalPage };
