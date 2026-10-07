// scripts/pom/OrdersPage.js
class OrdersPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('http://localhost:5173/#orders', { waitUntil: 'networkidle' });
    await this.page.waitForTimeout(600);
  }

  async attemptVoidWithWrongPin(wrongPin = '999999') {
    // Cari tombol void pertama (tombol dengan icon Ban warna merah)
    const voidBtn = this.page.locator('button[title*="Batalkan Transaksi" i]').first();
    if (await voidBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await voidBtn.click();
      await this.page.waitForTimeout(600);

      // Cari input PIN di VoidOrderModal
      const pinInput = this.page.locator('input[type="password"]').or(this.page.locator('input[placeholder*="PIN" i]')).first();
      if (await pinInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await pinInput.fill(wrongPin);
        await this.page.waitForTimeout(300);
      }

      // Klik konfirmasi void
      const confirmVoidBtn = this.page.getByRole('button', { name: /Konfirmasi VOID|Konfirmasi Pembatalan/i }).first();
      if (await confirmVoidBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmVoidBtn.click();
        await this.page.waitForTimeout(1000);
      }
    }
  }

  async isVoidSecurityErrorVisible() {
    const errorMsg = this.page.locator('div').filter({ hasText: /PIN Salah|tidak memiliki hak akses|Gagal membatalkan/i }).first();
    return await errorMsg.isVisible({ timeout: 3000 }).catch(() => false);
  }

  async closeVoidModal() {
    const closeBtn = this.page.getByRole('button', { name: /^Kembali$|^Batal$|^Tutup$/i }).first();
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click();
      await this.page.waitForTimeout(300);
    }
  }

  async getMetricStats() {
    // Ambil teks dari 4 kartu metrik utama
    const cards = this.page.locator('.grid.grid-cols-2.lg\\:grid-cols-4 > div');
    const totalTransactionsText = await cards.nth(0).locator('.text-2xl').innerText().catch(() => '0');
    const totalOmsetText = await cards.nth(1).locator('.text-2xl').innerText().catch(() => '0');
    const cashTransactionsText = await cards.nth(2).locator('.text-2xl').innerText().catch(() => '0');
    const qrisTransactionsText = await cards.nth(3).locator('.text-2xl').innerText().catch(() => '0');

    return {
      total: parseInt(totalTransactionsText) || 0,
      omset: totalOmsetText,
      cash: parseInt(cashTransactionsText) || 0,
      qris: parseInt(qrisTransactionsText) || 0,
    };
  }

  async verifyMetricConsistency() {
    const stats = await this.getMetricStats();
    // Hitung badge di tabel
    const cashBadges = await this.page.locator('tbody tr').filter({ hasText: 'Tunai' }).count();
    const qrisBadges = await this.page.locator('tbody tr').filter({ hasText: 'QRIS' }).count();
    const unpaidBadges = await this.page.locator('tbody tr').filter({ hasText: 'Belum Bayar' }).count();

    const isQrisMatched = stats.qris === qrisBadges;
    const isCashMatched = stats.cash === cashBadges;

    return {
      stats,
      badges: { cashBadges, qrisBadges, unpaidBadges },
      isConsistent: isQrisMatched && isCashMatched,
    };
  }
}

module.exports = { OrdersPage };
