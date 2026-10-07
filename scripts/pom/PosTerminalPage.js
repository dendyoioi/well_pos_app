// scripts/pom/PosTerminalPage.js
class PosTerminalPage {
  constructor(page) {
    this.page = page;
    this.startShiftBtn = page.getByRole('button', { name: /Buka Shift/i });
    this.closeShiftBtn = page.getByRole('button', { name: /Tutup Shift/i });
    this.confirmStartShiftBtn = page.getByRole('button', { name: /Mulai Shift Kasir|Buka Shift Sekarang/i });
    this.payBtn = page.getByRole('button', { name: /Bayar|Checkout/i });
    this.cashOptionBtn = page.getByRole('button', { name: /Tunai|Uang Pas/i });
    this.finishAndPrintBtn = page.getByRole('button', { name: /Selesaikan & Cetak/i });
    this.newTransactionBtn = page.getByRole('button', { name: /Transaksi Baru/i });
    this.closeModalBtn = page.getByRole('button', { name: /Tutup/i });
    this.actualCashInput = page.getByLabel(/Hitungan Fisik Uang Tunai di Laci/i).or(page.getByPlaceholder('0'));
    this.confirmCloseShiftBtn = page.getByRole('button', { name: /Konfirmasi & Tutup Shift/i });
  }

  async goto() {
    await this.page.goto('http://localhost:5173/?tab=pos', { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(1000);
    const openPosBtn = this.page.getByRole('button', { name: /Buka Kasir POS/i }).first();
    if (await openPosBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await openPosBtn.click();
      await this.page.waitForTimeout(1000);
    }
  }

  async openShiftIfClosed(cashAmount = 100000) {
    const isStartShiftVisible = await this.page.getByRole('button', { name: /^Buka Shift$/i }).first().isVisible().catch(() => false);
    if (isStartShiftVisible) {
      await this.page.getByRole('button', { name: /^Buka Shift$/i }).first().click();
      await this.page.waitForTimeout(600);

      // Cari input modal kasir di dalam form start shift
      const shiftModalForm = this.page.locator('form').filter({ hasText: /Mulai Sesi Shift/i }).first();
      const amountInput = shiftModalForm.locator('input[placeholder="0"]').first();
      if (await amountInput.isVisible().catch(() => false)) {
        await amountInput.fill(String(cashAmount));
      }

      const submitShiftBtn = this.page.getByRole('button', { name: /Mulai Sesi Shift/i }).first();
      await submitShiftBtn.click();
      await this.page.waitForTimeout(1000);
    }
  }

  async addFirstProductToCart() {
    // Cari tombol plus atau judul produk di katalog
    const plusBtn = this.page.locator('button[aria-label^="Pilih "]').first();
    if (await plusBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await plusBtn.click();
      await this.page.waitForTimeout(500);
      return;
    }
    const productH4 = this.page.locator('h4').filter({ hasText: /Kopi|Aren|Spesial/i }).first();
    if (await productH4.isVisible({ timeout: 3000 }).catch(() => false)) {
      await productH4.click();
      await this.page.waitForTimeout(500);
    }
  }

  async addProductByName(productName, quantity = 1) {
    // Cari kartu produk spesifik berdasarkan nama di dalam katalog produk
    const card = this.page.locator('h4').filter({ hasText: productName }).first();
    if (await card.isVisible({ timeout: 5000 }).catch(() => false)) {
      for (let i = 0; i < quantity; i++) {
        await card.click();
        await this.page.waitForTimeout(400);

        // Jika muncul modal opsi modifier, klik Masuk Keranjang
        const modifierAddBtn = this.page.getByRole('button', { name: /Masuk Keranjang/i }).first();
        if (await modifierAddBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await modifierAddBtn.click();
          await this.page.waitForTimeout(400);
        }
      }
    } else {
      await this.addFirstProductToCart();
    }
  }

  async selectCustomer(customerName) {
    // Klik tombol Member di sidebar order cart
    const memberBtn = this.page.getByRole('button', { name: /Member/i }).first();
    if (await memberBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await memberBtn.click();
      await this.page.waitForTimeout(400);

      // Isi pencarian member
      const searchInput = this.page.locator('input[placeholder*="Cari nama atau nomor HP"]').first();
      if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchInput.fill(customerName);
        await this.page.waitForTimeout(400);
      }

      // Pilih item member yang cocok (berupa div dengan class cursor-pointer yang memuat customerName)
      const memberItem = this.page.locator('div.cursor-pointer').filter({ hasText: customerName }).first();
      if (await memberItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        await memberItem.click();
        await this.page.waitForTimeout(500);
      }
    }
  }

  async checkoutCash() {
    // 1. Klik tombol bayar di order cart sidebar
    const payBtn = this.page.getByRole('button', { name: /Bayar \(/i }).or(this.page.getByRole('button', { name: /^Bayar/i })).first();
    await payBtn.waitFor({ state: 'visible', timeout: 5000 });
    await payBtn.click();
    await this.page.waitForTimeout(800);

    // 2. Pilih opsi Tunai / Uang Pas di Payment Modal
    const pasBtn = this.page.getByRole('button', { name: /Uang Pas/i }).first();
    if (await pasBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pasBtn.click();
      await this.page.waitForTimeout(400);
    }

    // 3. Selesaikan pembayaran
    const finishBtn = this.page.getByRole('button', { name: /Selesaikan & Cetak/i }).first();
    await finishBtn.waitFor({ state: 'visible', timeout: 5000 });
    await finishBtn.click();
    await this.page.waitForTimeout(2000);

    // 4. Verifikasi Order Success Modal muncul, lalu tutup / klik Transaksi Baru
    const nextTxBtn = this.page.getByRole('button', { name: /Transaksi Baru/i }).first();
    if (await nextTxBtn.isVisible({ timeout: 6000 }).catch(() => false)) {
      await nextTxBtn.click();
      await nextTxBtn.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      await this.page.waitForTimeout(500);
    } else {
      const closeBtn = this.page.getByRole('button', { name: /^Tutup$/i }).first();
      if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await closeBtn.click();
        await closeBtn.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
        await this.page.waitForTimeout(500);
      }
    }
  }

  async dismissSuccessModal() {
    const nextTxBtn = this.page.getByRole('button', { name: /Transaksi Baru/i }).first();
    const closeBtn = this.page.getByRole('button', { name: /^Tutup$/i }).first();
    if (await nextTxBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nextTxBtn.click();
      await nextTxBtn.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      await this.page.waitForTimeout(500);
    } else if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await closeBtn.click();
      await closeBtn.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      await this.page.waitForTimeout(500);
    }
  }

  async closeShift() {
    if (await this.closeShiftBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.closeShiftBtn.first().click();
      await this.page.waitForTimeout(600);

      // Masukkan hitungan uang tunai
      const cashInput = this.page.locator('input[placeholder="0"]').last();
      if (await cashInput.isVisible()) {
        await cashInput.fill('100000');
        await this.page.waitForTimeout(300);
      }

      const lockShiftBtn = this.page.getByRole('button', { name: /Kunci & Tutup Shift/i }).first();
      if (await lockShiftBtn.isVisible()) {
        await lockShiftBtn.click();
        await this.page.waitForTimeout(1500);
      }

      // Tutup struk Z-Report jika muncul
      const finishBtn = this.page.getByRole('button', { name: /^Selesai$/i }).first();
      if (await finishBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await finishBtn.click();
        await this.page.waitForTimeout(500);
      }
    }
  }

  // --- SAD PATH & ERROR CHECKS ---
  async attemptSelectProductWhenShiftClosed() {
    const productCard = this.page.locator('div').filter({ hasText: /Kopi Susu|Rp\s*[0-9]/i }).last();
    if (await productCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await productCard.click();
      await this.page.waitForTimeout(500);
    }
  }

  async attemptEmptyCartCheckout() {
    const payBtn = this.page.getByRole('button', { name: /Bayar/i }).first();
    if (await payBtn.isVisible()) {
      await payBtn.click();
      await this.page.waitForTimeout(500);
    }
  }

  async openPaymentModal() {
    const payBtn = this.page.getByRole('button', { name: /Bayar/i }).first();
    if (await payBtn.isVisible()) {
      await payBtn.click();
      await this.page.waitForTimeout(600);
    }
  }

  async setInsufficientCash(amount) {
    const cashInput = this.page.locator('input[placeholder="0"]').or(this.page.locator('input[type="text"]')).first();
    if (await cashInput.isVisible()) {
      await cashInput.fill(String(amount));
      await this.page.waitForTimeout(300);
    }
  }

  async closeShiftWithDiscrepancy(actualCash = 85000, notes = 'Uang kembalian tercecer saat transaksi jam sibuk') {
    if (await this.closeShiftBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.closeShiftBtn.first().click();
      await this.page.waitForTimeout(600);

      const cashInput = this.page.locator('input[placeholder="0"]').last();
      if (await cashInput.isVisible()) {
        await cashInput.fill(String(actualCash));
        await this.page.waitForTimeout(500);
      }

      const notesInput = this.page.locator('textarea[placeholder*="catatan" i]').or(this.page.getByPlaceholder(/catatan/i)).first();
      if (await notesInput.isVisible().catch(() => false)) {
        await notesInput.fill(notes);
        await this.page.waitForTimeout(300);
      }

      const lockShiftBtn = this.page.getByRole('button', { name: /Kunci & Tutup Shift/i }).first();
      if (await lockShiftBtn.isVisible()) {
        await lockShiftBtn.click();
        await this.page.waitForTimeout(1500);
      }

      const finishBtn = this.page.getByRole('button', { name: /^Selesai$/i }).first();
      if (await finishBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await finishBtn.click();
        await this.page.waitForTimeout(500);
      }
    }
  }

  async openCloseShiftModal() {
    await this.page.getByRole('button', { name: /^Tutup Shift$/i }).first().click();
    await this.page.waitForTimeout(600);
  }

  async clearCart() {
    const trashBtn = this.page.locator('button[title*="Hapus keranjang"], button:has-text("Kosongkan")').first();
    if (await trashBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await trashBtn.click();
      await this.page.waitForTimeout(400);
    }
  }
}

module.exports = { PosTerminalPage };
