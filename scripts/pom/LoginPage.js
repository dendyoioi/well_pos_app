// scripts/pom/LoginPage.js
class LoginPage {
  constructor(page) {
    this.page = page;
    this.ownerTabBtn = page.getByRole('button', { name: /Portal Pemilik/i });
    this.posTabBtn = page.getByRole('button', { name: /Mesin Kasir/i });
    this.emailInput = page.locator('input[type="email"]');
    this.passwordInput = page.locator('input[type="password"]');
    this.submitOwnerBtn = page.getByRole('button', { name: /Masuk ke Portal Pemilik/i });
  }

  async goto() {
    await this.page.goto('http://localhost:5173/#login', { waitUntil: 'networkidle' });
    await this.page.waitForTimeout(600);
  }

  async loginOwner(email, password) {
    await this.ownerTabBtn.click();
    await this.page.waitForTimeout(300);

    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitOwnerBtn.click();
    await this.page.waitForTimeout(1500);
  }

  async attemptInvalidLogin(email, wrongPassword) {
    await this.ownerTabBtn.click();
    await this.page.waitForTimeout(300);

    await this.emailInput.fill(email);
    await this.passwordInput.fill(wrongPassword);
    await this.submitOwnerBtn.click();
    await this.page.waitForTimeout(1000);
  }

  async isErrorAlertVisible() {
    const errorAlert = this.page.locator('div').filter({ hasText: /Login Gagal|tidak sesuai|Password salah/i }).first();
    return await errorAlert.isVisible({ timeout: 3000 }).catch(() => false);
  }

  async dismissAlertModal() {
    const okBtn = this.page.getByRole('button', { name: /^Mengerti$|^OK$|^Tutup$/i }).first();
    if (await okBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await okBtn.click();
      await this.page.waitForTimeout(300);
    }
  }
}

module.exports = { LoginPage };
