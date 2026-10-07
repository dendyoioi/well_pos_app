// scripts/pom/SuperadminPage.js
class SuperadminPage {
  constructor(page) {
    this.page = page;
    this.defaultAccountBtn = page.getByRole('button', { name: /Gunakan Akun Default Superadmin/i });
    this.loginPlatformBtn = page.getByRole('button', { name: /Masuk ke Portal Platform/i });
    this.emailInput = page.locator('input[type="email"]');
    this.pendingFilterBtn = page.getByRole('button', { name: /Menunggu Approval|Pending/i });
  }

  async goto() {
    await this.page.goto('http://localhost:5173/#superadmin', { waitUntil: 'networkidle' });
    await this.page.waitForTimeout(600);
  }

  async loginDefault() {
    const isLoginVisible = await this.emailInput.isVisible().catch(() => false);
    if (isLoginVisible) {
      if (await this.defaultAccountBtn.isVisible()) {
        await this.defaultAccountBtn.click();
        await this.page.waitForTimeout(300);
      }
      await this.loginPlatformBtn.click();
      await this.page.waitForTimeout(1500);
    }
  }

  async approveTenant(email) {
    // Pastikan berada di tab Manajemen Merchant
    const merchantTab = this.page.getByRole('button', { name: /Manajemen Merchant/i }).first();
    if (await merchantTab.isVisible()) {
      await merchantTab.click();
      await this.page.waitForTimeout(500);
    }

    // Klik filter 'Menunggu Approval' jika ada
    if (await this.pendingFilterBtn.first().isVisible()) {
      await this.pendingFilterBtn.first().click();
      await this.page.waitForTimeout(500);
    }

    // Cari baris dengan teks email pendaftar
    const tenantRow = this.page.locator('tr').filter({ hasText: email });
    const isRowFound = await tenantRow.count();

    if (isRowFound > 0) {
      const approveBtn = tenantRow.getByRole('button', { name: /Setujui/i }).first();
      await approveBtn.click();
      await this.page.waitForTimeout(500);

      // Konfirmasi modal persetujuan
      const modal = this.page.locator('div.fixed.inset-0').last();
      const confirmApproveBtn = modal.getByRole('button', { name: /Ya, Setujui Akun Owner/i });
      if (await confirmApproveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmApproveBtn.click();
        await this.page.waitForTimeout(1500);
      }

      // Tutup alert dialog sukses jika muncul
      const mengertiBtn = this.page.getByRole('button', { name: /^Mengerti$/i });
      if (await mengertiBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await mengertiBtn.click();
        await this.page.waitForTimeout(500);
      }
      return true;
    }
    return false;
  }

  async rejectTenant(email) {
    const merchantTab = this.page.getByRole('button', { name: /Manajemen Merchant/i }).first();
    if (await merchantTab.isVisible()) {
      await merchantTab.click();
      await this.page.waitForTimeout(500);
    }

    if (await this.pendingFilterBtn.first().isVisible()) {
      await this.pendingFilterBtn.first().click();
      await this.page.waitForTimeout(500);
    }

    const tenantRow = this.page.locator('tr').filter({ hasText: email });
    const isRowFound = await tenantRow.count();

    if (isRowFound > 0) {
      const rejectBtn = tenantRow.getByRole('button', { name: /Tolak/i }).first();
      await rejectBtn.click();
      await this.page.waitForTimeout(500);

      const modal = this.page.locator('div.fixed.inset-0').last();
      const confirmRejectBtn = modal.getByRole('button', { name: /Ya, Tolak Pendaftaran/i });
      if (await confirmRejectBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmRejectBtn.click();
        await this.page.waitForTimeout(1500);
      }

      const mengertiBtn = this.page.getByRole('button', { name: /^Mengerti$/i });
      if (await mengertiBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await mengertiBtn.click();
        await this.page.waitForTimeout(500);
      }
      return true;
    }
    return false;
  }
}

module.exports = { SuperadminPage };
