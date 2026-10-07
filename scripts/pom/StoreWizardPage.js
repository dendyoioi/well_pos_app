// scripts/pom/StoreWizardPage.js
class StoreWizardPage {
  constructor(page) {
    this.page = page;
    this.merchantInput = page.getByPlaceholder(/Senja Group/i);
    this.storeInput = page.getByPlaceholder(/Kopi Senja - Tebet/i);
    this.addressInput = page.getByPlaceholder(/Tebet Barat/i);
    this.submitBtn = page.getByRole('button', { name: /Buka Dashboard Operasional|Membuat Toko/i });
  }

  async isWizardVisible() {
    const header = this.page.getByText(/Setup Wizard|Belum Punya Toko/i);
    return await header.first().isVisible().catch(() => false);
  }

  async fillStoreDetails({ merchantName, storeName, phone, address, industryName = 'Kedai Kopi / Coffee Shop' }) {
    await this.merchantInput.fill(merchantName);
    await this.storeInput.fill(storeName);

    // WhatsApp Input
    const waInput = this.page.locator('input[type="tel"]').or(this.page.getByPlaceholder(/812345/i)).first();
    await waInput.fill(phone);

    await this.addressInput.fill(address);

    // Pilih industri chip
    const industryChip = this.page.getByRole('button', { name: new RegExp(industryName, 'i') }).first();
    if (await industryChip.isVisible()) {
      await industryChip.click();
    } else {
      // Fallback click any available industry chip
      const firstChip = this.page.locator('button').filter({ hasText: /\[F&B\]|\[RIT\]|\[LAY\]/i }).first();
      if (await firstChip.isVisible()) {
        await firstChip.click();
      }
    }
    await this.page.waitForTimeout(400);
  }

  async submit() {
    await this.submitBtn.click();
    await this.page.waitForTimeout(2000);
  }

  // Aliases
  async fillStoreWizard(options) {
    return this.fillStoreDetails(options);
  }

  async submitWizard() {
    return this.submit();
  }
}

module.exports = { StoreWizardPage };
