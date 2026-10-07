/**
 * ShiftsAuditPage.js
 * Page Object Model untuk halaman Backoffice Audit Shift Kasir & Rekonsiliasi Laci Kas
 */
class ShiftsAuditPage {
  constructor(page) {
    this.page = page;
    this.container = page.locator('main, div.p-4.sm\\:p-6').first();
    this.periodSelect = page.locator('select').first();
    this.shiftRows = page.locator('table tbody tr');
    this.summaryCards = page.locator('div.grid div.rounded-2xl');
  }

  async navigate() {
    // Navigasi langsung via URL hash atau parameter query
    await this.page.goto('http://localhost:5173/?tab=shifts');
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1000);
  }

  async getLatestShiftRow() {
    await this.page.waitForSelector('table tbody tr', { timeout: 8000 });
    return this.shiftRows.first();
  }

  async getLatestShiftStatus() {
    const row = await this.getLatestShiftRow();
    const statusBadge = row.locator('span:has-text("SEIMBANG"), span:has-text("KURANG"), span:has-text("LEBIH"), span:has-text("AKTIF")').first();
    return (await statusBadge.textContent()).trim();
  }

  async getLatestShiftCashier() {
    const row = await this.getLatestShiftRow();
    return (await row.locator('td').nth(1).textContent()).trim();
  }
}

module.exports = { ShiftsAuditPage };
