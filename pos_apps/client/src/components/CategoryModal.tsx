import React, { useState } from 'react';
import { X, Layers, Plus, Edit2, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { Category } from '../types/product';
import { api } from '../services/api';
import { ConfirmModal } from './ConfirmModal';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  onRefresh: () => void;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  categories,
  onRefresh,
}) => {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.createCategory(newCategoryName.trim());
      if (res.status === 'success') {
        setSuccessMsg(`Kategori "${newCategoryName.trim()}" berhasil dibuat!`);
        setNewCategoryName('');
        onRefresh();
      } else {
        setError(res.message || 'Gagal membuat kategori');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (cat: Category) => {
    setEditingCategory(cat);
    setEditName(cat.name);
    setError(null);
    setSuccessMsg(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editName.trim()) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.updateCategory(editingCategory.id, editName.trim());
      if (res.status === 'success') {
        setSuccessMsg(`Kategori diperbarui menjadi "${editName.trim()}"!`);
        setEditingCategory(null);
        setEditName('');
        onRefresh();
      } else {
        setError(res.message || 'Gagal mengubah kategori');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  };

  const executeDeleteCategory = async () => {
    if (!categoryToDelete) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.deleteCategory(categoryToDelete.id);
      if (res.status === 'success') {
        setSuccessMsg(`Kategori "${categoryToDelete.name}" berhasil dihapus.`);
        setCategoryToDelete(null);
        onRefresh();
      } else {
        setError(res.message || 'Gagal menghapus kategori');
        setCategoryToDelete(null);
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem');
      setCategoryToDelete(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center">
              <Layers className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-extrabold text-blue-950 text-base">Kelola Kategori Produk</h3>
              <p className="text-xs text-slate-500">Tambah, ubah, atau hapus kategori menu toko Anda</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form Tambah Kategori Baru */}
          <form onSubmit={handleCreate} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <label className="block text-xs font-extrabold text-slate-700">
              + Tambah Kategori Baru
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="misal: Makanan Penutup, Kopi Dingin, Paket Hemat"
                className="flex-1 px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
              />
              <button
                type="submit"
                disabled={loading || !newCategoryName.trim()}
                className="px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Simpan</span>
              </button>
            </div>
          </form>

          {/* Daftar Kategori Saat Ini */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Daftar Kategori Aktif ({categories.length})
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
              {categories.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Belum ada kategori yang dibuat.
                </div>
              ) : (
                categories.map((cat) => {
                  const isEditingThis = editingCategory?.id === cat.id;

                  return (
                    <div key={cat.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                      {isEditingThis ? (
                        <form onSubmit={handleSaveEdit} className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            required
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="flex-1 px-3 py-1.5 bg-white border border-blue-400 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-900/20"
                          />
                          <button
                            type="submit"
                            disabled={loading}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs"
                          >
                            Simpan
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCategory(null)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                          >
                            Batal
                          </button>
                        </form>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-blue-900 shrink-0" />
                            <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                              {cat.name}
                            </span>
                            {cat.productCount !== undefined && (
                              <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full shrink-0">
                                {cat.productCount} Produk
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(cat)}
                              className="p-1.5 text-slate-500 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Ubah Nama Kategori"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setCategoryToDelete(cat)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus Kategori"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer Modal */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            Selesai
          </button>
        </div>
      </div>

      {/* Modal Konfirmasi Hapus Kategori */}
      <ConfirmModal
        isOpen={categoryToDelete !== null}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={executeDeleteCategory}
        title="Hapus Kategori Produk?"
        message={
          <div className="space-y-2">
            <p>
              Apakah Anda yakin ingin menghapus kategori{' '}
              <strong className="text-blue-950">"{categoryToDelete?.name}"</strong>?
            </p>
            {categoryToDelete?.productCount !== undefined && categoryToDelete.productCount > 0 ? (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold">
                ⚠️ Peringatan: Kategori ini masih terhubung dengan{' '}
                <strong>{categoryToDelete.productCount} produk aktif</strong>. Kategori tidak dapat dihapus sebelum produk dipindahkan ke kategori lain menggunakan fitur <strong>Ubah Kategori</strong>.
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">
                Kategori ini tidak memiliki produk aktif dan aman untuk dihapus.
              </p>
            )}
          </div>
        }
        confirmText="Hapus Kategori"
        variant="danger"
        loading={loading}
      />
    </div>
  );
};
