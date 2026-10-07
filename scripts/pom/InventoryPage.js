// scripts/pom/InventoryPage.js
class InventoryPage {
  constructor(page) {
    this.page = page;
    this.rawTabBtn = page.getByRole('button', { name: /Bahan Baku Mentah/i });
    this.productTabBtn = page.getByRole('button', { name: /Produk Jadi/i });
    this.warehouseTabBtn = page.getByRole('button', { name: /Kelola Gudang/i });
    this.createIngredientBtn = page.getByRole('button', { name: /Tambah Bahan Baku Baru/i });
    this.searchInput = page.getByPlaceholder(/Cari nama bahan, kode SKU/i);
  }

  async goto() {
    await this.page.goto('http://localhost:5173/?tab=inventory', { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(800);
  }

  async waitForLoaded() {
    await this.page.waitForSelector('table, p:has-text("Tidak ada bahan baku")', { timeout: 10000 });
  }

  async switchToRawMaterials() {
    if (await this.rawTabBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.rawTabBtn.click();
      await this.page.waitForTimeout(500);
    }
  }

  async openCreateIngredientModal() {
    const btn = this.page.getByRole('button', { name: /Tambah Bahan Baku Baru/i }).first();
    await btn.click();
    await this.page.waitForTimeout(600);
    await this.page.waitForSelector('input[placeholder*="Bubuk Cokelat"]', { timeout: 8000 });
  }

  async fillIngredientForm({ name, itemCode, canonicalUom = 'GRAM', averageCost = 0, initialStock = 0, reorderPoint = 100 }) {
    // Nama
    const nameInput = this.page.locator('input[placeholder*="Bubuk Cokelat"]').first();
    await nameInput.fill(name);

    // Kode SKU (opsional)
    if (itemCode) {
      const codeInput = this.page.locator('input[placeholder*="Auto jika kosong"]').first();
      await codeInput.fill(itemCode);
    }

    // UOM
    const uomSelect = this.page.locator('select').filter({ hasText: /GRAM/i }).first();
    await uomSelect.selectOption(canonicalUom);

    // Estimasi HPP per UOM
    if (averageCost > 0) {
      const costInput = this.page.locator('input[placeholder="0"]').first();
      await costInput.fill(String(averageCost));
    }

    // Peringatan stok minimum
    if (reorderPoint !== undefined) {
      const reorderInput = this.page.locator('input[type="number"]').first();
      await reorderInput.fill(String(reorderPoint));
    }

    // Saldo Stok Awal
    if (initialStock > 0) {
      const stockInput = this.page.locator('input[placeholder*="0 jika belum ada fisik"]').first();
      await stockInput.fill(String(initialStock));
    }

    await this.page.waitForTimeout(300);
  }

  async submitIngredientForm() {
    const saveBtn = this.page.getByRole('button', { name: /Simpan Bahan Baku/i }).first();
    await saveBtn.click();
    await this.page.waitForTimeout(1000);
    await this.page.locator('input[placeholder*="Bubuk Cokelat"]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
  }

  async searchIngredient(keyword) {
    if (await this.searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.searchInput.fill(keyword);
      await this.page.waitForTimeout(500);
    }
  }

  async getIngredientRow(ingredientName) {
    const row = this.page.locator('tr').filter({ hasText: ingredientName }).first();
    await row.waitFor({ state: 'visible', timeout: 5000 });
    return row;
  }

  async getIngredientStock(ingredientName) {
    const row = await this.getIngredientRow(ingredientName);
    // Kolom kedua adalah Stok Fisik Toko
    const stockCell = row.locator('td').nth(1);
    const text = await stockCell.innerText();
    return text;
  }
}

module.exports = { InventoryPage };
