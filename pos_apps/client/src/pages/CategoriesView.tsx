import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ShoppingBag,
  ExternalLink,
  RefreshCw,
  Info,
} from 'lucide-react';
import { api } from '../services/api';
import type { Category } from '../types/product';
import type { Outlet } from '../types/outlet';
import { TablePagination } from '../components/TablePagination';
import { useDialog } from '../context/DialogContext';

interface CategoriesViewProps {
  activeOutlet?: Outlet | null;
  onNavigateToProductsWithCategory?: (categoryId: string) => void;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  activeOutlet,
  onNavigateToProductsWithCategory,
}) => {
  const dialog = useDialog();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Scoping Mode: 'outlet' (hanya menu gerai ini) atau 'all' (semua kategori tenant)
  const [scopeMode, setScopeMode] = useState<'outlet' | 'all'>(activeOutlet ? 'outlet' : 'all');

  // Form State (In-Page Form, Zero Stacked Modals)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ name: '' });
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCategories = async (overrideScope?: 'outlet' | 'all') => {
    setLoading(true);
    try {
      const mode = overrideScope !== undefined ? overrideScope : scopeMode;
      const targetOutletId = mode === 'outlet' && activeOutlet ? activeOutlet.id : undefined;
      const res = await api.getCategories(targetOutletId);
      if (res.status === 'success') {
        setCategories(res.data);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Gagal memuat daftar kategori' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [activeOutlet?.id, scopeMode]);

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setFormData({ name: '' });
    setIsFormOpen(true);
    setFeedback(null);
  };

  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat);
    setFormData({ name: cat.name });
    setIsFormOpen(true);
    setFeedback(null);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingCategory(null);
    setFormData({ name: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFeedback({ type: 'error', message: 'Nama kategori wajib diisi' });
      return;
    }

    setFormSubmitting(true);
    try {
      if (editingCategory) {
        const res = await api.updateCategory(editingCategory.id, formData.name.trim());
        if (res.status === 'success') {
          setFeedback({ type: 'success', message: `Kategori "${formData.name}" berhasil diperbarui` });
          handleCloseForm();
          fetchCategories();
        } else {
          setFeedback({ type: 'error', message: res.message || 'Gagal memperbarui kategori' });
        }
      } else {
        const res = await api.createCategory(formData.name.trim());
        if (res.status === 'success') {
          setFeedback({ type: 'success', message: `Kategori "${formData.name}" berhasil ditambahkan` });
          handleCloseForm();
          fetchCategories();
        } else {
          setFeedback({ type: 'error', message: res.message || 'Gagal menambahkan kategori' });
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Terjadi kesalahan sistem' });
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    if (cat._count && cat._count.products > 0) {
      dialog.alert({
        title: 'Kategori Masih Digunakan',
        message: `Kategori "${cat.name}" memiliki ${cat._count.products} menu aktif. Silakan pindahkan atau hapus produk terlebih dahulu.`,
        variant: 'warning',
      });
      return;
    }

    const ok = await dialog.confirm({
      title: 'Hapus Kategori',
      message: `Yakin ingin menghapus kategori "${cat.name}"?`,
      variant: 'danger',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
    });
    if (!ok) return;

    setDeletingId(cat.id);
    try {
      const res = await api.deleteCategory(cat.id);
      if (res.status === 'success') {
        setFeedback({ type: 'success', message: `Kategori "${cat.name}" berhasil dihapus` });
        fetchCategories();
      } else {
        setFeedback({ type: 'error', message: res.message || 'Gagal menghapus kategori' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Gagal menghapus kategori' });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Reset pagination ke halaman 1 saat filter atau pencarian berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, scopeMode]);

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedCategories = filteredCategories.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  const totalProducts = categories.reduce(
    (sum, c) => sum + (c.productCount ?? c._count?.products ?? 0),
    0
  );

  // VIEW: IN-PAGE FORM MODE
  if (isFormOpen) {
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
              Menu &amp; Produk / Kategori Menu
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              {editingCategory ? `Ubah Kategori: ${editingCategory.name}` : 'Tambah Kategori Menu Baru'}
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

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Nama Kategori <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ name: e.target.value })}
                placeholder="Contoh: Signature Coffee, Non-Coffee, Makanan Utama, Pastry"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900 font-medium text-sm transition-all"
                required
              />
              <p className="text-xs text-slate-500 mt-1.5">
                Nama ini akan tampil sebagai tab kategori di layar kasir POS dan filter pada buku menu digital tamu.
              </p>
            </div>

            {formData.name.trim() && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Slug URL (Otomatis)</span>
                  <span className="text-sm font-mono text-blue-700 font-bold">
                    {formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
                  </span>
                </div>
                <div className="text-xs text-slate-400">Digunakan untuk SEO &amp; katalog digital</div>
              </div>
            )}

            <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-xl flex gap-3 text-xs text-blue-800">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-0.5">Tips Tata Letak Kategori F&B:</p>
                <p>
                  Urutkan penamaan sesuai alur santap pelanggan (misal: <em>Minuman Pembuka ➔ Makanan Berat ➔ Snack &amp; Cemilan ➔ Penutup</em>) agar kasir dapat memesankan menu dengan lebih cepat.
                </p>
              </div>
            </div>

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
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>{editingCategory ? 'Simpan Perubahan' : 'Tambah Kategori'}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // VIEW: LIST / GRID MODE
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Menu &amp; Produk</span>
            <span>•</span>
            <span className="text-blue-600">Katalog F&amp;B</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Kategori Menu</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Kelompokkan sajian makanan &amp; minuman agar kasir POS dan tamu pemesan QR meja dapat menemukan hidangan dengan instan.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => fetchCategories()}
            className="w-10 h-10 sm:w-auto sm:h-auto p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center shrink-0"
            title="Muat Ulang"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex-1 sm:flex-initial justify-center px-4 py-2.5 bg-blue-900 hover:bg-blue-800 active:scale-95 text-white font-extrabold rounded-xl flex items-center gap-2 transition-all shadow-md shadow-blue-900/20 text-xs sm:text-sm cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Kategori</span>
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
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Kategori</div>
            <div className="text-2xl font-bold text-slate-900">{categories.length} Kategori</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Menu Terpetakan</div>
            <div className="text-2xl font-bold text-slate-900">{totalProducts} Menu</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Info className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rata-Rata Per Kategori</div>
            <div className="text-2xl font-bold text-slate-900">
              {categories.length > 0 ? (totalProducts / categories.length).toFixed(1) : 0} Item
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar & Scope Switcher */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari kategori menu..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          />
        </div>

        {activeOutlet && (
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-stretch sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => {
                setScopeMode('outlet');
                fetchCategories('outlet');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                scopeMode === 'outlet'
                  ? 'bg-white text-blue-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🏪 Gerai Ini ({activeOutlet.name})
            </button>
            <button
              type="button"
              onClick={() => {
                setScopeMode('all');
                fetchCategories('all');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                scopeMode === 'all'
                  ? 'bg-white text-blue-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🌐 Semua Master Kategori
            </button>
          </div>
        )}
      </div>

      {/* Grid Kategori */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
          <p className="text-sm font-medium">Memuat kategori menu...</p>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl">
          <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">
            {searchTerm ? 'Kategori tidak ditemukan' : 'Belum Ada Kategori Menu'}
          </h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? `Tidak ada kategori yang cocok dengan pencarian "${searchTerm}".`
              : 'Mulai buat kategori pertama Anda seperti Minuman Kopi, Makanan Utama, atau Aneka Snack.'}
          </p>
          {!searchTerm && (
            <button
              onClick={handleOpenCreate}
              className="mt-4 px-4 py-2 bg-blue-900 hover:bg-blue-800 active:scale-95 text-white font-extrabold rounded-xl text-xs sm:text-sm inline-flex items-center gap-2 shadow-md shadow-blue-900/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Kategori Pertama</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedCategories.map((cat) => (
            <div
              key={cat.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold flex-shrink-0">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{cat.name}</h3>
                      <span className="text-xs font-mono text-slate-400">/{cat.slug || cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}</span>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-100">
                    {cat.productCount ?? cat._count?.products ?? 0} Menu
                  </span>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                {onNavigateToProductsWithCategory ? (
                  <button
                    onClick={() => onNavigateToProductsWithCategory(cat.id)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                  >
                    <span>Lihat Menu</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 font-medium">Tersinkronisasi Kasir &amp; QR</span>
                )}

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(cat)}
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Ubah Kategori"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(cat)}
                    disabled={deletingId === cat.id}
                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Hapus Kategori"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          </div>

          {/* Pagination Kategori */}
          {!loading && filteredCategories.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <TablePagination
                currentPage={safeCurrentPage}
                pageSize={pageSize}
                totalItems={filteredCategories.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
                itemLabel="kategori"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
