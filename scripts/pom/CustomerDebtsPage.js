// scripts/pom/CustomerDebtsPage.js
class CustomerDebtsPage {
  constructor(page) {
    this.page = page;
    this.debtsTabBtn = page.getByRole('button', { name: /Buku Kasbon & Piutang/i });
    this.directoryTabBtn = page.getByRole('button', { name: /Direktori & Loyalitas/i });
    this.searchInput = page.locator('input[placeholder*="nomor faktur"]').first();
    this.allStatusBtn = page.getByRole('button', { name: 'Semua', exact: true });
    this.unpaidStatusBtn = page.getByRole('button', { name: 'Belum Lunas', exact: true });
    this.paidStatusBtn = page.getByRole('button', { name: 'Lunas', exact: true });
  }

  async goto() {
    await this.page.goto('http://localhost:5173/?tab=customers&subtab=debts', { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(1000);
  }

  async switchToDebtsTab() {
    const debtsBtn = this.page.getByRole('button', { name: /Buku Kasbon & Piutang/i });
    if (await debtsBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await debtsBtn.click();
      await this.page.waitForTimeout(800);
    }
    // Verifikasi input pencarian modul kasbon & piutang termuat
    await this.searchInput.waitFor({ state: 'visible', timeout: 10000 });
  }

  async searchDebt(query) {
    if (await this.searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.searchInput.fill(query);
      await this.page.waitForTimeout(500);
    }
  }

  async openPaySettlement(customerNameOrInvoice) {
    const row = this.page.locator('tr').filter({ hasText: customerNameOrInvoice }).first();
    await row.waitFor({ state: 'visible', timeout: 8000 });

    const payBtn = row.getByRole('button', { name: /Pelunasan/i }).first();
    await payBtn.click();
    await this.page.waitForTimeout(600);

    // Verifikasi modal pelunasan terbuka
    await this.page.locator('h3:has-text("Pelunasan Kasbon / Piutang")').waitFor({ state: 'visible', timeout: 6000 });
  }

  async fillSettlement({ amount, method = 'CASH', notes = '' }) {
    // 1. Nominal Bayar
    if (amount !== undefined && amount !== null) {
      const amountInput = this.page.locator('form').locator('input[placeholder="0"]').first();
      if (await amountInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await amountInput.fill(String(amount));
        await this.page.waitForTimeout(300);
      }
    }

    // 2. Metode Bayar
    if (method === 'CASH') {
      await this.page.locator('form').getByRole('button', { name: 'Tunai', exact: true }).click().catch(() => {});
    } else if (method === 'QRIS') {
      await this.page.locator('form').getByRole('button', { name: 'QRIS', exact: true }).click().catch(() => {});
    } else if (method === 'BANK_TRANSFER') {
      await this.page.locator('form').getByRole('button', { name: 'Transfer', exact: true }).click().catch(() => {});
    }
    await this.page.waitForTimeout(200);

    // 3. Catatan
    if (notes) {
      const notesArea = this.page.locator('form').locator('textarea').first();
      if (await notesArea.isVisible({ timeout: 2000 }).catch(() => false)) {
        await notesArea.fill(notes);
      }
    }
  }

  async submitSettlement() {
    const submitBtn = this.page.locator('button[type="submit"]').filter({ hasText: /Konfirmasi Pembayaran/i }).first();
    await submitBtn.waitFor({ state: 'visible', timeout: 5000 });
    await submitBtn.click();
    await this.page.waitForTimeout(1200);
  }

  async getDebtRow(customerNameOrInvoice) {
    const row = this.page.locator('tr').filter({ hasText: customerNameOrInvoice }).first();
    await row.waitFor({ state: 'visible', timeout: 6000 });
    return row;
  }
}

module.exports = { CustomerDebtsPage };
