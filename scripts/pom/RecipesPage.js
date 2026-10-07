// scripts/pom/RecipesPage.js
class RecipesPage {
  constructor(page) {
    this.page = page;
    this.searchInput = page.getByPlaceholder(/Cari menu makanan/i);
    this.allFilterBtn = page.getByRole('button', { name: /^Semua \(/i });
    this.hasRecipeFilterBtn = page.getByRole('button', { name: /^Ada Resep \(/i });
    this.noRecipeFilterBtn = page.getByRole('button', { name: /^Belum Ada \(/i });
    this.addIngredientBtn = page.getByRole('button', { name: /Tambah Bahan/i });
    this.submitRecipeBtn = page.getByRole('button', { name: /Simpan Resep & Kalkulasi HPP/i });
    this.cancelBtn = page.getByRole('button', { name: /^Batal$/i });
  }

  async goto() {
    await this.page.goto('http://localhost:5173/?tab=recipes', { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(800);
  }

  async waitForLoaded() {
    await this.page.waitForSelector('table, h3:has-text("Tidak Ada Menu Ditemukan")', { timeout: 10000 });
  }

  async searchMenu(keyword) {
    if (await this.searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.searchInput.fill(keyword);
      await this.page.waitForTimeout(400);
    }
  }

  async filterByStatus(status) {
    if (status === 'has_recipe') {
      await this.hasRecipeFilterBtn.click();
    } else if (status === 'no_recipe') {
      await this.noRecipeFilterBtn.click();
    } else {
      await this.allFilterBtn.click();
    }
    await this.page.waitForTimeout(400);
  }

  async openRecipeForm(productName) {
    // Cari baris tabel yang mengandung productName
    const row = this.page.locator('tr').filter({ hasText: productName }).first();
    await row.waitFor({ state: 'visible', timeout: 8000 });
    
    const actionBtn = row.getByRole('button', { name: /\+ Racik Resep|Kelola Resep/i }).first();
    await actionBtn.click();
    await this.page.waitForTimeout(600);
    // Verifikasi form terbuka
    await this.page.waitForSelector('text=1. Komposisi Bahan Baku Mentah', { timeout: 8000 });
  }

  async addIngredientRow(ingredientName, quantity) {
    // Klik tombol tambah bahan
    const addBtn = this.page.getByRole('button', { name: /Tambah Bahan/i }).first();
    await addBtn.click();
    await this.page.waitForTimeout(400);

    // Ambil baris bahan terakhir
    const selects = this.page.locator('select').filter({ hasText: /GRAM|ML|PCS/i });
    const lastSelect = selects.last();
    
    // Pilih option yang mengandung nama ingredient
    const optionToSelect = await lastSelect.locator('option').filter({ hasText: ingredientName }).first();
    const value = await optionToSelect.getAttribute('value');
    if (value) {
      await lastSelect.selectOption(value);
    }

    // Isi kuantitas takaran
    const qtyInputs = this.page.locator('input[type="number"][step="any"]');
    const lastQtyInput = qtyInputs.last();
    await lastQtyInput.fill(String(quantity));
    await this.page.waitForTimeout(300);
  }

  async setInstructions(text) {
    const textarea = this.page.locator('textarea').first();
    if (await textarea.isVisible().catch(() => false)) {
      await textarea.fill(text);
      await this.page.waitForTimeout(200);
    }
  }

  async setYieldQuantity(quantity) {
    const yieldInput = this.page.locator('input[type="number"][min="1"]').first();
    if (await yieldInput.isVisible().catch(() => false)) {
      await yieldInput.fill(String(quantity));
      await this.page.waitForTimeout(200);
    }
  }

  async submitRecipe() {
    await this.submitRecipeBtn.click();
    await this.page.waitForTimeout(1000);
    // Verifikasi feedback atau kembali ke tabel
    await this.page.waitForSelector('text=Resep berhasil disimpan|Menu & Produk', { timeout: 8000 }).catch(() => {});
  }

  async cancelForm() {
    await this.cancelBtn.click();
    await this.page.waitForTimeout(500);
  }

  async deleteRecipe(productName) {
    const row = this.page.locator('tr').filter({ hasText: productName }).first();
    const deleteBtn = row.locator('button[title="Hapus Resep"]').first();
    if (await deleteBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await deleteBtn.click();
      await this.page.waitForTimeout(500);
      
      // Dialog konfirmasi (useDialog)
      const confirmBtn = this.page.getByRole('button', { name: /Ya, Hapus Resep|Hapus|Ya/i }).last();
      if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn.click();
        await this.page.waitForTimeout(1000);
      }
    }
  }

  async getRecipeRow(productName) {
    const row = this.page.locator('tr').filter({ hasText: productName }).first();
    await row.waitFor({ state: 'visible', timeout: 5000 });
    return row;
  }
}

module.exports = { RecipesPage };
