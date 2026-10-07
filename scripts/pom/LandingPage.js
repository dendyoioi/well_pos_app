// scripts/pom/LandingPage.js
class LandingPage {
  constructor(page) {
    this.page = page;
    this.registerBtnHero = page.getByRole('button', { name: /Daftar Akun Toko Sekarang|Daftar Sekarang/i });
    this.registerBtnNav = page.getByRole('button', { name: /^Daftar$/i });
    this.firstNameInput = page.getByPlaceholder('Nama Depan');
    this.lastNameInput = page.getByPlaceholder('Nama Belakang');
    this.emailInput = page.getByPlaceholder('owner@bisnis.id');
    this.passwordInput = page.getByPlaceholder('Minimal 6 karakter');
    this.confirmPasswordInput = page.getByPlaceholder('Ulangi kata sandi');
    this.submitBtn = page.getByRole('button', { name: /Daftar Akun Pemilik/i });
  }

  async goto() {
    await this.page.goto('http://localhost:5173/#landing', { waitUntil: 'networkidle' });
    await this.page.waitForTimeout(500);
  }

  async openRegisterModal() {
    const isHeroVisible = await this.registerBtnHero.first().isVisible().catch(() => false);
    if (isHeroVisible) {
      await this.registerBtnHero.first().click();
    } else {
      await this.registerBtnNav.first().click();
    }
    await this.page.waitForTimeout(600);
  }

  async fillRegistration({ firstName, lastName, phone, email, password }) {
    await this.firstNameInput.fill(firstName);
    if (lastName) {
      await this.lastNameInput.fill(lastName);
    }
    // WhatsApp input with semantic label or placeholder
    const waInput = this.page.locator('input[type="tel"]').or(this.page.getByPlaceholder(/812345/i)).first();
    await waInput.fill(phone);

    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(password);
  }

  async submitRegistration() {
    await this.submitBtn.click();
    await this.page.waitForTimeout(1500);
  }

  async isSuccessOrPendingVisible() {
    const successHeader = this.page.getByText(/Aktivasi Akun Berhasil|Selesaikan Pembayaran QRIS|Menunggu Verifikasi/i);
    return await successHeader.first().isVisible().catch(() => false);
  }

  async isWarningAlertVisible() {
    const alertModal = this.page.locator('div').filter({ hasText: /Email sudah terdaftar|Pendaftaran Gagal/i }).first();
    return await alertModal.isVisible({ timeout: 3000 }).catch(() => false);
  }

  async dismissAlertModal() {
    const okBtn = this.page.getByRole('button', { name: /^Mengerti$|^OK$|^Tutup$/i }).first();
    if (await okBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await okBtn.click();
      await this.page.waitForTimeout(300);
    }
  }
}

module.exports = { LandingPage };
