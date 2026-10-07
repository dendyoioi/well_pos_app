// scripts/pom/BackofficePage.js
class BackofficePage {
  constructor(page) {
    this.page = page;
    this.openPosBtn = page.getByRole('button', { name: /Buka Kasir POS/i });
  }

  async goto() {
    await this.page.goto('http://localhost:5173/#dashboard', { waitUntil: 'networkidle' });
    await this.page.waitForTimeout(600);
  }

  async navigateTab(tabName) {
    // Cari tombol tab atau accordion group
    const tabBtn = this.page.getByRole('button', { name: new RegExp(tabName, 'i') }).first();
    if (await tabBtn.isVisible()) {
      await tabBtn.click();
      await this.page.waitForTimeout(500);
    }
  }

  async openPosTerminal() {
    await this.openPosBtn.first().click();
    await this.page.waitForTimeout(1000);
  }

  async isDashboardVisible() {
    const title = this.page.getByText(/Ringkasan Bisnis|Katalog Produk|Bahan Baku/i);
    return await title.first().isVisible().catch(() => false);
  }

  async navigateToReports() {
    // Navigasi ke menu Laporan Penjualan atau Laporan Keuangan
    const reportBtn = this.page.getByRole('button', { name: /Laporan Penjualan|Laporan Finansial|Ringkasan Laporan/i }).first();
    if (await reportBtn.isVisible().catch(() => false)) {
      await reportBtn.click();
      await this.page.waitForTimeout(800);
    } else {
      await this.page.goto('http://localhost:5173/#reports', { waitUntil: 'networkidle' });
      await this.page.waitForTimeout(800);
    }
  }
}

module.exports = { BackofficePage };
