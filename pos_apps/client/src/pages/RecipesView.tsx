import React, { useState, useEffect } from 'react';
import {
  ChefHat,
  Plus,
  Search,
  Trash2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  Package,
} from 'lucide-react';
import { api } from '../services/api';
import type { Recipe, RecipeInventoryItem, UpsertRecipeInput } from '../types/recipe';
import type { Product } from '../types/product';
import { formatRupiah } from '../utils/currency';
import { TablePagination } from '../components/TablePagination';
import { useDialog } from '../context/DialogContext';

interface RecipesViewProps {
  outletId?: string;
}

interface ProductVariantOption {
  variantId: string;
  variantName: string;
  productId: string;
  productName: string;
  categoryName?: string;
  price: number;
  existingRecipe?: Recipe;
}

export const RecipesView: React.FC<RecipesViewProps> = ({ outletId }) => {
  const dialog = useDialog();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryItems, setInventoryItems] = useState<RecipeInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'has_recipe' | 'no_recipe'>('all');
  const [ingredientScope, setIngredientScope] = useState<'outlet' | 'all'>('outlet');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Form State (In-Page Form, Zero Stacked Modals)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariantOption | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [yieldQuantity, setYieldQuantity] = useState<number>(1);
  const [recipeRows, setRecipeRows] = useState<
    Array<{
      inventoryItemId: string;
      quantity: number;
      costRatio: number;
    }>
  >([]);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [recRes, prodRes, invRes] = await Promise.all([
        api.getRecipes(outletId),
        api.getProducts({ outletId }),
        api.getRecipeInventoryItems(outletId, ingredientScope),
      ]);

      if (recRes.status === 'success') {
        setRecipes(recRes.data || []);
      }
      if (prodRes.status === 'success') {
        setProducts(prodRes.data || []);
      }
      if (invRes.status === 'success') {
        setInventoryItems(invRes.data || []);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Gagal memuat data resep & bahan baku' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [outletId, ingredientScope]);

  // Flatten products into variant options
  const allVariantOptions: ProductVariantOption[] = [];
  products.forEach((prod) => {
    if (prod.variants && prod.variants.length > 0) {
      prod.variants.forEach((v) => {
        const matchingRecipe = recipes.find((r) => r.productVariantId === v.id);
        allVariantOptions.push({
          variantId: v.id,
          variantName: v.name,
          productId: prod.id,
          productName: prod.name,
          categoryName: prod.category?.name,
          price: Number(v.price) || 0,
          existingRecipe: matchingRecipe,
        });
      });
    } else {
      // Fallback jika tidak ada tabel variant eksplisit
      const matchingRecipe = recipes.find(
        (r) => r.productVariantId === prod.id || (r as any).productVariant?.product?.id === prod.id
      );
      allVariantOptions.push({
        variantId: matchingRecipe?.productVariantId || prod.id,
        variantName: (matchingRecipe?.productVariant as any)?.name || 'Standar',
        productId: prod.id,
        productName: prod.name,
        categoryName: prod.category?.name,
        price: Number((matchingRecipe?.productVariant as any)?.price || prod.price || prod.basePrice || 0),
        existingRecipe: matchingRecipe,
      });
    }
  });

  const handleOpenForm = (option: ProductVariantOption) => {
    setSelectedVariant(option);
    if (option.existingRecipe) {
      setInstructions(option.existingRecipe.instructions || '');
      setYieldQuantity(Number(option.existingRecipe.yieldQuantity) || 1);
      setRecipeRows(
        option.existingRecipe.items.map((it) => ({
          inventoryItemId: it.inventoryItemId,
          quantity: Number(it.quantity) || 0,
          costRatio: Number(it.costRatio) || 1.0,
        }))
      );
    } else {
      setInstructions('');
      setYieldQuantity(1);
      // Default: 1 row kosong jika ada bahan baku
      if (inventoryItems.length > 0) {
        setRecipeRows([
          {
            inventoryItemId: inventoryItems[0].id,
            quantity: 1,
            costRatio: 1.0,
          },
        ]);
      } else {
        setRecipeRows([]);
      }
    }
    setIsFormOpen(true);
    setFeedback(null);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedVariant(null);
    setRecipeRows([]);
    setInstructions('');
  };

  const handleAddRow = () => {
    const defaultItem = inventoryItems[0]?.id || '';
    setRecipeRows((prev) => [
      ...prev,
      {
        inventoryItemId: defaultItem,
        quantity: 1,
        costRatio: 1.0,
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    setRecipeRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, field: string, value: any) => {
    setRecipeRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Kalkulasi HPP Resep Form Aktif
  const calculatedRecipeCogs = recipeRows.reduce((sum, row) => {
    const inv = inventoryItems.find((item) => item.id === row.inventoryItemId);
    const avgCost = Number(inv?.averageCost) || 0;
    return sum + avgCost * Number(row.quantity);
  }, 0);

  const variantPrice = selectedVariant?.price || 0;
  const estimatedProfit = variantPrice - calculatedRecipeCogs;
  const profitMarginPercent = variantPrice > 0 ? (estimatedProfit / variantPrice) * 100 : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVariant) return;

    if (recipeRows.length === 0) {
      setFeedback({ type: 'error', message: 'Resep harus memiliki minimal 1 bahan baku mentah' });
      return;
    }

    // Validasi kuantitas bahan
    for (const r of recipeRows) {
      if (!r.inventoryItemId) {
        setFeedback({ type: 'error', message: 'Pilih bahan baku untuk setiap baris' });
        return;
      }
      if (r.quantity <= 0) {
        setFeedback({ type: 'error', message: 'Kuantitas takaran bahan harus lebih besar dari 0' });
        return;
      }
    }

    setFormSubmitting(true);
    try {
      const payload: UpsertRecipeInput = {
        productVariantId: selectedVariant.variantId,
        instructions: instructions.trim() || null,
        yieldQuantity: Number(yieldQuantity) || 1,
        items: recipeRows.map((r) => ({
          inventoryItemId: r.inventoryItemId,
          quantity: Number(r.quantity),
          costRatio: 1.0,
        })),
      };

      const res = await api.upsertRecipe(payload);
      if (res.status === 'success') {
        setFeedback({
          type: 'success',
          message: `Resep untuk "${selectedVariant.productName} (${selectedVariant.variantName})" berhasil disimpan!`,
        });
        handleCloseForm();
        fetchData();
      } else {
        setFeedback({ type: 'error', message: res.message || 'Gagal menyimpan resep' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Terjadi kesalahan sistem' });
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (recipeId: string, name: string) => {
    const ok = await dialog.confirm({
      title: 'Hapus Resep Menu',
      message: `Yakin ingin menghapus resep untuk menu "${name}"? Pengurangan bahan baku otomatis saat transaksi untuk menu ini akan dinonaktifkan.`,
      variant: 'danger',
      confirmText: 'Ya, Hapus Resep',
      cancelText: 'Batal',
    });
    if (!ok) return;

    setDeletingId(recipeId);
    try {
      const res = await api.deleteRecipe(recipeId);
      if (res.status === 'success') {
        setFeedback({ type: 'success', message: `Resep "${name}" berhasil dihapus` });
        fetchData();
      } else {
        setFeedback({ type: 'error', message: res.message || 'Gagal menghapus resep' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Gagal menghapus resep' });
    } finally {
      setDeletingId(null);
    }
  };

  // Helper untuk menghitung estimasi HPP resep yang ada di list
  const getRecipeCost = (recipe: Recipe): number => {
    if (!recipe.items || recipe.items.length === 0) return 0;
    return recipe.items.reduce((sum, it) => {
      const avgCost = Number(it.inventoryItem?.averageCost) || 0;
      return sum + avgCost * Number(it.quantity);
    }, 0);
  };

  // Filter daftar menu
  const filteredVariants = allVariantOptions.filter((opt) => {
    const matchSearch =
      opt.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opt.variantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (opt.categoryName && opt.categoryName.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchSearch) return false;

    if (statusFilter === 'has_recipe') return !!opt.existingRecipe;
    if (statusFilter === 'no_recipe') return !opt.existingRecipe;
    return true;
  });

  // Reset pagination ke halaman 1 saat filter atau pencarian berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredVariants.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedVariants = filteredVariants.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  const totalRecipesCount = allVariantOptions.filter((opt) => !!opt.existingRecipe).length;

  // VIEW: IN-PAGE FORM MODE
  if (isFormOpen && selectedVariant) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto pb-16">
        {/* Header Breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleCloseForm}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Menu &amp; Produk / Resep &amp; Bahan Baku (BOM)
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              Racik Resep: {selectedVariant.productName} ({selectedVariant.variantName})
            </h1>
          </div>
        </div>

        {feedback && (
          <div
            className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
              feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Live Financial Summary Card */}
        <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl p-6 shadow-lg border border-blue-800/40 grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <span className="text-xs text-blue-300 font-semibold uppercase tracking-wider block">Harga Jual Kasir</span>
            <span className="text-2xl font-bold text-white">{formatRupiah(variantPrice)}</span>
            <span className="text-[11px] text-blue-200 block mt-0.5">Per {yieldQuantity} porsi / cup</span>
          </div>

          <div>
            <span className="text-xs text-blue-300 font-semibold uppercase tracking-wider block">Estimasi HPP Bahan</span>
            <span className="text-2xl font-bold text-amber-400">{formatRupiah(calculatedRecipeCogs)}</span>
            <span className="text-[11px] text-blue-200 block mt-0.5">Total {recipeRows.length} takaran bahan</span>
          </div>

          <div>
            <span className="text-xs text-blue-300 font-semibold uppercase tracking-wider block">Estimasi Laba Kotor</span>
            <span className={`text-2xl font-bold ${estimatedProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatRupiah(estimatedProfit)}
            </span>
            <span className="text-[11px] text-blue-200 block mt-0.5">Gross profit per sajian</span>
          </div>

          <div>
            <span className="text-xs text-blue-300 font-semibold uppercase tracking-wider block">Margin Keuntungan</span>
            <span
              className={`text-2xl font-bold ${
                profitMarginPercent >= 50
                  ? 'text-emerald-400'
                  : profitMarginPercent >= 30
                  ? 'text-blue-400'
                  : 'text-amber-400'
              }`}
            >
              {profitMarginPercent.toFixed(1)}%
            </span>
            <span className="text-[11px] text-blue-200 block mt-0.5">
              {profitMarginPercent >= 50 ? '🌟 Sangat Sehat' : profitMarginPercent >= 30 ? '✅ Standar F&B' : '⚠️ Perlu Perhatian'}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Card 1: Komposisi Bahan Baku (BOM) */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">1. Komposisi Bahan Baku Mentah</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Setiap kali menu ini terjual di kasir atau dipesan via QR meja, stok bahan baku akan otomatis terpotong sesuai takaran di bawah.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddRow}
                className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Bahan</span>
              </button>
            </div>

            {recipeRows.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <ChefHat className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">Belum Ada Bahan Baku Ditambahkan</p>
                <p className="text-xs text-slate-500 mt-1">
                  Klik tombol <em>"Tambah Bahan"</em> untuk memasukkan bahan baku mentah (misal: Biji Kopi, Susu, Cup).
                </p>
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="mt-3 px-3 py-1.5 bg-blue-900 hover:bg-blue-800 active:scale-95 text-white font-extrabold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-md shadow-blue-900/20 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Bahan Baku Pertama</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {recipeRows.map((row, index) => {
                  const inv = inventoryItems.find((i) => i.id === row.inventoryItemId);
                  const itemAvgCost = Number(inv?.averageCost) || 0;
                  const rowCost = itemAvgCost * Number(row.quantity);

                  return (
                    <div
                      key={index}
                      className="p-4 bg-slate-50/90 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                    >
                      {/* Dropdown Bahan Baku */}
                      <div className="sm:col-span-5">
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          Bahan Baku Mentah #{index + 1}
                        </label>
                        <select
                          value={row.inventoryItemId}
                          onChange={(e) => handleRowChange(index, 'inventoryItemId', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        >
                          {inventoryItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} ({item.canonicalUom})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Kuantitas Takaran */}
                      <div className="sm:col-span-3">
                        <label className="block text-xs font-bold text-slate-600 mb-1">
                          Takaran Per Porsi ({inv?.canonicalUom || 'Satuan'})
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="any"
                            min="0.001"
                            value={row.quantity}
                            onChange={(e) => handleRowChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-right"
                            required
                          />
                          <span className="text-xs font-mono text-slate-500 bg-slate-200 px-2 py-2 rounded-lg font-bold flex-shrink-0">
                            {inv?.canonicalUom || '-'}
                          </span>
                        </div>
                      </div>

                      {/* Subtotal Biaya HPP */}
                      <div className="sm:col-span-3">
                        <span className="block text-xs font-bold text-slate-600 mb-1">Subtotal HPP</span>
                        <div className="py-2 px-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
                          <span className="text-xs text-slate-400">@{formatRupiah(itemAvgCost)}</span>
                          <span className="text-sm font-bold text-slate-900">{formatRupiah(rowCost)}</span>
                        </div>
                      </div>

                      {/* Delete Action */}
                      <div className="sm:col-span-1 flex items-center justify-end sm:pt-5">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(index)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Hapus Bahan Baku"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Card 2: Instruksi Pembuatan & Porsi */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              2. Porsi Saji &amp; Instruksi Barista / Koki
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Hasil Porsi Sajian (Yield Quantity)
                </label>
                <input
                  type="number"
                  min="1"
                  value={yieldQuantity}
                  onChange={(e) => setYieldQuantity(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">Standar sajian kafe = 1 cup/piring</p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Catatan SOP Racikan (Instruksi Dapur / Bar)
                </label>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Contoh: Espresso double shot 36ml di-extract 25 detik. Campur gula aren 25ml, tuang fresh milk dingin 120ml, beri es batu kristal penuh."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleCloseForm}
              disabled={formSubmitting}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-colors text-sm"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="px-6 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 active:scale-95 text-white font-extrabold transition-all shadow-md shadow-blue-900/20 text-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {formSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Menyimpan Resep...</span>
                </>
              ) : (
                <span>Simpan Resep &amp; Kalkulasi HPP</span>
              )}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // VIEW: LIST / TABLE MODE
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Menu &amp; Produk</span>
            <span>•</span>
            <span className="text-blue-600">Bill of Materials (BOM)</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Resep &amp; Bahan Baku (BOM)</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Kelola resep racikan menu F&amp;B Anda untuk pemotongan persediaan bahan mentah otomatis dan kalkulasi HPP riil per porsi.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Muat Ulang"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
            feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm min-w-0">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
            <ChefHat className="w-6 h-6 shrink-0" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">Total Resep F&amp;B Aktif</div>
            <div className="text-2xl font-bold text-slate-900">
              {totalRecipesCount} dari {allVariantOptions.length} Menu
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm min-w-0">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
            <Package className="w-6 h-6 shrink-0" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">Bahan Baku Terdaftar</div>
            <div className="text-2xl font-bold text-slate-900">{inventoryItems.length} Bahan Mentah</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm min-w-0">
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0">
            <TrendingUp className="w-6 h-6 shrink-0" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate">Otomasi Inventori</div>
            <div className="text-sm font-bold text-slate-800">Auto Deduct Penjualan Kasir</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari menu makanan / minuman..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'all' ? 'bg-blue-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({allVariantOptions.length})
          </button>
          <button
            onClick={() => setStatusFilter('has_recipe')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'has_recipe' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Ada Resep ({totalRecipesCount})
          </button>
          <button
            onClick={() => setStatusFilter('no_recipe')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === 'no_recipe' ? 'bg-amber-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Belum Ada ({allVariantOptions.length - totalRecipesCount})
          </button>

          {outletId && (
            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 ml-1">
              <span className="text-[11px] font-semibold text-slate-500 hidden md:inline">Bahan:</span>
              <button
                type="button"
                onClick={() => setIngredientScope('outlet')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  ingredientScope === 'outlet'
                    ? 'bg-blue-100 text-blue-800 border border-blue-300 shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="Hanya menampilkan bahan baku yang relevan dengan toko ini"
              >
                Bahan Toko
              </button>
              <button
                type="button"
                onClick={() => setIngredientScope('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  ingredientScope === 'all'
                    ? 'bg-blue-100 text-blue-800 border border-blue-300 shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="Tampilkan seluruh katalog bahan baku master tenant"
              >
                Semua Master
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grid / Table Menu & Resep */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
          <p className="text-sm font-medium">Memuat katalog resep F&amp;B...</p>
        </div>
      ) : filteredVariants.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl">
          <ChefHat className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">Tidak Ada Menu Ditemukan</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Pastikan Anda telah memiliki produk di menu atau sesuaikan kata kunci pencarian Anda.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Menu &amp; Varian</th>
                  <th className="py-3.5 px-4">Kategori</th>
                  <th className="py-3.5 px-4">Status Resep</th>
                  <th className="py-3.5 px-4 text-right">Harga Jual</th>
                  <th className="py-3.5 px-4 text-right">Estimasi HPP</th>
                  <th className="py-3.5 px-4 text-right">Margin Kotor</th>
                  <th className="py-3.5 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {paginatedVariants.map((opt) => {
                  const rec = opt.existingRecipe;
                  const cogs = rec ? getRecipeCost(rec) : 0;
                  const marginRp = opt.price - cogs;
                  const marginPct = opt.price > 0 && rec ? (marginRp / opt.price) * 100 : 0;

                  return (
                    <tr key={opt.variantId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{opt.productName}</div>
                        <div className="text-xs text-slate-500">Varian: {opt.variantName}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md">
                          {opt.categoryName || 'Tanpa Kategori'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {rec ? (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-xs font-bold text-emerald-700">
                              {rec.items?.length || 0} Bahan Baku
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-slate-300" />
                            <span className="text-xs text-slate-400 font-medium">Belum Dikonfigurasi</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        {formatRupiah(opt.price)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-slate-700">
                        {rec ? formatRupiah(cogs) : <span className="text-slate-300">-</span>}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {rec ? (
                          <div>
                            <span
                              className={`font-bold text-xs ${
                                marginPct >= 50
                                  ? 'text-emerald-600'
                                  : marginPct >= 30
                                  ? 'text-blue-600'
                                  : 'text-amber-600'
                              }`}
                            >
                              {marginPct.toFixed(1)}%
                            </span>
                            <span className="text-[11px] text-slate-400 block">
                              +{formatRupiah(marginRp)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenForm(opt)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                              rec
                                ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {rec ? 'Kelola Resep' : '+ Racik Resep'}
                          </button>

                          {rec && (
                            <button
                              onClick={() => handleDelete(rec.id, opt.productName)}
                              disabled={deletingId === rec.id}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Hapus Resep"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Resep & Menu */}
          {!loading && filteredVariants.length > 0 && (
            <TablePagination
              currentPage={safeCurrentPage}
              pageSize={pageSize}
              totalItems={filteredVariants.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 25, 50, 100]}
              itemLabel="menu"
            />
          )}
        </div>
      )}
    </div>
  );
};
