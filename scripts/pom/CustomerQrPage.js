// scripts/pom/CustomerQrPage.js
class CustomerQrPage {
  constructor(page) {
    this.page = page;
  }

  async goto(outletId, tableCode = 'T-01') {
    await this.page.goto(`http://localhost:5173/#qr-menu?outletId=${outletId}&table=${tableCode}`, { waitUntil: 'networkidle' });
    await this.page.waitForTimeout(800);
  }

  async isMenuVisible() {
    const heading = this.page.getByText(/Buku Menu|Meja|Daftar Menu/i);
    return await heading.first().isVisible().catch(() => false);
  }

  async addFirstItemToCart() {
    const addBtn = this.page.getByRole('button', { name: /Tambah|\+/i }).first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await this.page.waitForTimeout(400);
    }
  }
}

module.exports = { CustomerQrPage };
