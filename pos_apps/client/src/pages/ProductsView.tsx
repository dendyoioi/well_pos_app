import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Barcode,
  Edit2,
  Trash2,
  AlertTriangle,
  Layers,
  RefreshCw,
  CheckSquare,
  Square,
  CheckCircle2,
  AlertCircle,
  FolderSync,
  Power,
  X,
  ShoppingBag,
  Infinity as InfinityIcon,
  Warehouse,
} from 'lucide-react';
import type { Product, Category } from '../types/product';
import { ProductModal } from '../components/ProductModal';
import { CategoryModal } from '../components/CategoryModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { AssignCatalogProductModal } from '../components/AssignCatalogProductModal';
import { api } from '../services/api';

interface ProductsViewProps {
  userRole?: string;
  outletId?: string;
  onProductCountChange?: (count: number) => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  userRole = 'ADMIN',
  outletId,
  onProductCountChange,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Multi-Select State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Feedback Notification Banner
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [bulkCategoryModalOpen, setBulkCategoryModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedTargetCategoryId, setSelectedTargetCategoryId] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);

  // Confirm Modal State
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    onConfirm: () => Promise<void> | void;
    variant?: 'danger' | 'warning' | 'info';
    confirmText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const activeParam = statusFilter === 'all' ? 'all' : statusFilter === 'active' ? 'true' : 'false';
      const [prodRes, catRes] = await Promise.all([
        api.getProducts({
          search: searchTerm || undefined,
          categoryId: selectedCategory === 'all' ? undefined : selectedCategory,
          outletId: outletId || undefined,
          isActive: activeParam,
        }),
        api.getCategories(outletId || undefined, activeParam),
      ]);

      if (prodRes.status === 'success') {
        setProducts(prodRes.data);
      }
      if (catRes.status === 'success') {
        setCategories(catRes.data);
      }

      // Synchronize overall outlet product count to parent navbar badge
      if (onProductCountChange) {
        if (statusFilter === 'all' && selectedCategory === 'all' && !searchTerm && prodRes.status === 'success') {
          onProductCountChange(prodRes.data.length);
        } else {
          api.getProducts({ outletId: outletId || undefined, isActive: 'all' }).then((r) => {
            if (r.status === 'success') onProductCountChange(r.data.length);
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Gagal mengambil data katalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm, selectedCategory, statusFilter, outletId]);

  // Reset selected IDs when filter or list changes
  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => products.some((p) => p.id === id)));
  }, [products]);

  // Clear feedback after 4 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Select All Checkbox
  const isAllSelected = products.length > 0 && selectedIds.length === products.length;
  const isIndeterminate = selectedIds.length > 0 && selectedIds.length < products.length;

  // Multi-Select Handlers
  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map((p) => p.id));
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Single Product Delete (Smart Delete & Unlink with ConfirmModal)
  const handleDeleteSingle = async (product: Product) => {
    let deleteInfo: any = null;
    try {
      const infoRes = await api.getProductDeleteInfo(product.id, outletId);
      if (infoRes.status === 'success' && infoRes.data) {
        deleteInfo = infoRes.data;
      }
    } catch (e) {
      console.error('Gagal mengambil info delete:', e);
    }

    const txCount = deleteInfo?.transactionCount ?? 0;
    const currentStock = deleteInfo?.currentStock ?? product.stock ?? 0;
    const outletLabel = deleteInfo?.outletName || 'cabang aktif';

    setConfirmModalConfig({
      isOpen: true,
      title: outletId ? 'Lepas Produk dari Cabang?' : 'Hapus Produk?',
      variant: 'danger',
      confirmText: outletId ? 'Ya, Lepas dari Cabang' : 'Ya, Hapus Produk',
      message: (
        <div className="space-y-3 text-left">
          <p className="text-slate-700">
            Apakah Anda yakin ingin melepas produk{' '}
            <strong className="text-blue-950">"{product.name}"</strong> dari{' '}
            <span className="font-semibold text-blue-900">{outletLabel}</span>?
          </p>

          {txCount > 0 ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Terkait dengan {txCount} Riwayat Transaksi Penjualan</span>
              </div>
              <p className="text-amber-800 text-[11px] leading-relaxed">
                Produk ini akan <strong>langsung lenyap dari katalog dan kasir cabang ini</strong>. Seluruh riwayat nota, laporan HPP, dan laporan laba rugi masa lalu <strong>tetap tersimpan utuh dan aman</strong>.
              </p>
            </div>
          ) : (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800">
              Produk ini belum pernah ditransaksikan di cabang ini. Produk akan langsung dihapus dari katalog cabang.
            </div>
          )}

          {currentStock > 0 && (
            <div className="text-[11px] text-slate-500 flex items-center gap-1">
              <span>Sisa stok fisik di toko: <strong>{currentStock} {product.unit || 'Pcs'}</strong>.</span>
            </div>
          )}
        </div>
      ),
      onConfirm: async () => {
        setActionLoading(true);
        try {
          const res = await api.deleteProduct(product.id, outletId);
          if (res.status === 'success') {
            setFeedback({
              type: 'success',
              message: res.message || `Produk "${product.name}" berhasil dilepas dari cabang.`,
            });
            fetchData();
          } else {
            setFeedback({
              type: 'error',
              message: res.message || 'Gagal melepas produk.',
            });
          }
        } catch (err: any) {
          setFeedback({ type: 'error', message: err.message || 'Terjadi kesalahan sistem' });
        } finally {
          setActionLoading(false);
          setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Single Product Toggle Status (Aktifkan / Nonaktifkan)
  const handleToggleStatusSingle = async (product: Product) => {
    const nextStatus = !product.isActive;
    setActionLoading(true);
    try {
      const res = await api.updateProduct(product.id, { isActive: nextStatus });
      if (res.status === 'success') {
        setFeedback({
          type: 'success',
          message: `Status produk "${product.name}" diubah menjadi ${nextStatus ? 'Aktif' : 'Nonaktif'}.`,
        });
        fetchData();
      } else {
        setFeedback({ type: 'error', message: res.message || 'Gagal mengubah status produk.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Terjadi kesalahan sistem' });
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk Actions
  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;

    setConfirmModalConfig({
      isOpen: true,
      title: outletId ? `Lepas ${selectedIds.length} Produk dari Cabang?` : `Hapus ${selectedIds.length} Produk?`,
      variant: 'danger',
      confirmText: outletId ? `Ya, Lepas ${selectedIds.length} Produk` : `Hapus ${selectedIds.length} Produk`,
      message: (
        <div className="space-y-2 text-left">
          <p className="text-slate-700">
            Anda akan melepas{' '}
            <strong className="text-blue-950">{selectedIds.length} produk terpilih</strong> dari cabang ini.
          </p>
          <p className="text-[11px] text-slate-500">
            Produk terpilih akan langsung lenyap dari katalog dan kasir cabang ini. Seluruh riwayat transaksi nota dan audit masa lalu tetap aman.
          </p>
        </div>
      ),
      onConfirm: async () => {
        setActionLoading(true);
        try {
          const res = await api.bulkProductAction({
            action: 'DELETE',
            productIds: selectedIds,
            outletId,
          });
          if (res.status === 'success') {
            setFeedback({ type: 'success', message: res.message });
            setSelectedIds([]);
            fetchData();
          } else {
            setFeedback({ type: 'error', message: res.message || 'Gagal melepas massal.' });
          }
        } catch (err: any) {
          setFeedback({ type: 'error', message: err.message || 'Terjadi kesalahan sistem' });
        } finally {
          setActionLoading(false);
          setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleBulkSetStatus = async (isActive: boolean) => {
    if (selectedIds.length === 0) return;

    setActionLoading(true);
    try {
      const res = await api.bulkProductAction({
        action: 'SET_STATUS',
        productIds: selectedIds,
        isActive,
      });
      if (res.status === 'success') {
        setFeedback({ type: 'success', message: res.message });
        setSelectedIds([]);
        fetchData();
      } else {
        setFeedback({ type: 'error', message: res.message || 'Gagal memperbarui status massal.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Terjadi kesalahan sistem' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkChangeCategory = async () => {
    if (selectedIds.length === 0 || !selectedTargetCategoryId) return;

    setActionLoading(true);
    try {
      const res = await api.bulkProductAction({
        action: 'CHANGE_CATEGORY',
        productIds: selectedIds,
        categoryId: selectedTargetCategoryId,
      });
      if (res.status === 'success') {
        setFeedback({ type: 'success', message: res.message });
        setBulkCategoryModalOpen(false);
        setSelectedIds([]);
        fetchData();
      } else {
        setFeedback({ type: 'error', message: res.message || 'Gagal memindahkan kategori.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Terjadi kesalahan sistem' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = (product: Product) => {
    setProductToEdit(product);
    setModalOpen(true);
  };

  const handleAddNew = () => {
    setProductToEdit(null);
    setModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm animate-fadeIn ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-bold">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 rounded-lg hover:bg-black/5 cursor-pointer text-slate-500"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Action & Search Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search Input */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama, SKU, atau scan barcode..."
            className="w-full bg-slate-50 border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 rounded-xl pl-10 pr-4 py-2.5 text-sm transition-all outline-none"
          />
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={() => fetchData()}
            title="Muat Ulang"
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-sm cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {userRole === 'ADMIN' && (
            <>
              <button
                type="button"
                onClick={() => setCategoryModalOpen(true)}
                className="px-3.5 py-2.5 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Layers className="w-4 h-4 text-blue-900" />
                <span>Kategori Produk</span>
              </button>

              {outletId && (
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(true)}
                  className="px-3.5 py-2.5 rounded-xl border border-blue-200 hover:border-blue-400 bg-blue-50/80 hover:bg-blue-100 text-blue-900 text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Hubungkan produk dari katalog pusat yang belum ada di cabang ini"
                >
                  <ShoppingBag className="w-4 h-4 text-blue-900" />
                  <span>Ambil dari Katalog</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleAddNew}
                className="px-4 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-900/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Produk</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter Tabs: Kategori & Status Aktif/Nonaktif */}
      <div className="space-y-3">
        {/* Status Filter Tabs (Semua / Aktif / Nonaktif) */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-blue-950 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Status
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Hanya Aktif</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('inactive')}
              className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'inactive'
                  ? 'bg-slate-800 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              <span>Hanya Nonaktif</span>
            </button>
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Menampilkan <strong>{products.length}</strong> produk
            {outletId ? ' pada cabang aktif' : ''}
          </div>
        </div>

        {/* Category Pills Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-blue-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Semua Kategori ({categories.reduce((acc, c) => acc + (c.productCount || 0), 0)})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {cat.name} {cat.productCount !== undefined && `(${cat.productCount})`}
            </button>
          ))}

          {userRole === 'ADMIN' && (
            <button
              type="button"
              onClick={() => setCategoryModalOpen(true)}
              className="px-3 py-1 rounded-xl text-xs font-bold border border-dashed border-blue-900/40 text-blue-900 hover:bg-blue-50 transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Kategori
            </button>
          )}
        </div>
      </div>

      {/* Products Table Card */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-bold text-xs uppercase tracking-wider">
                {userRole === 'ADMIN' && (
                  <th className="py-3.5 pl-5 pr-2 w-10 text-center">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="text-slate-600 hover:text-blue-900 cursor-pointer flex items-center justify-center"
                      title={isAllSelected ? 'Batalkan Semua' : 'Pilih Semua'}
                    >
                      {isAllSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-900" />
                      ) : isIndeterminate ? (
                        <div className="w-4 h-4 rounded border-2 border-blue-900 bg-blue-100 flex items-center justify-center">
                          <span className="w-2 h-0.5 bg-blue-900 rounded" />
                        </div>
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </th>
                )}
                <th className="py-3.5 px-4 pl-2">Produk</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Barcode / SKU</th>
                <th className="py-3.5 px-4">Kategori</th>
                <th className="py-3.5 px-4 text-right">Modal (HPP)</th>
                <th className="py-3.5 px-4 text-right">Harga Jual</th>
                <th className="py-3.5 px-4 text-center">Stok Toko</th>
                <th className="py-3.5 px-4 pr-6 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={userRole === 'ADMIN' ? 9 : 8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
                      <span>Memuat katalog produk...</span>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={userRole === 'ADMIN' ? 9 : 8} className="py-12 text-center text-slate-400">
                    <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold">Tidak ada produk ditemukan</p>
                    <p className="text-xs text-slate-500">
                      Coba sesuaikan filter status, kategori, atau tambah produk baru.
                    </p>
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isSelected = selectedIds.includes(p.id);
                  const marginRp = p.basePrice - p.costPrice;
                  const marginPercent = Math.round((marginRp / (p.basePrice || 1)) * 100);

                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50/60'
                      } ${!p.isActive ? 'opacity-70 bg-slate-50/30' : ''}`}
                    >
                      {/* Checkbox */}
                      {userRole === 'ADMIN' && (
                        <td className="py-4 pl-5 pr-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleSelectOne(p.id)}
                            className="text-slate-600 hover:text-blue-900 cursor-pointer flex items-center justify-center"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-900" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300 hover:text-slate-400" />
                            )}
                          </button>
                        </td>
                      )}

                      {/* Nama & Foto & Deskripsi */}
                      <td className="py-4 px-4 pl-2">
                        <div className="flex items-center gap-3">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-sm flex-shrink-0 bg-slate-100"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 font-bold text-xs flex-shrink-0">
                              {p.name.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-blue-950 text-sm flex items-center gap-1.5 flex-wrap">
                              <span className={!p.isActive ? 'line-through text-slate-500' : ''}>
                                {p.name}
                              </span>
                              {p.modifiers && p.modifiers.length > 0 && (
                                <span className="text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
                                  ✨ {p.modifiers.length} Custom Opsi
                                </span>
                              )}
                            </div>
                            {p.description && (
                              <div className="text-xs text-slate-400 truncate max-w-xs">
                                {p.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status Aktif / Nonaktif */}
                      <td className="py-4 px-4">
                        {p.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Aktif</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-500 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            <span>Nonaktif</span>
                          </span>
                        )}
                      </td>

                      {/* Barcode / SKU */}
                      <td className="py-4 px-4">
                        <div className="font-mono text-xs font-semibold text-slate-700 flex items-center gap-1">
                          <Barcode className="w-3.5 h-3.5 text-blue-900" />
                          <span>{p.barcode}</span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">{p.sku}</div>
                      </td>

                      {/* Kategori */}
                      <td className="py-4 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
                          {p.category.name}
                        </span>
                      </td>

                      {/* Modal HPP */}
                      <td className="py-4 px-4 text-right font-medium text-slate-600">
                        Rp {p.costPrice.toLocaleString('id-ID')}
                      </td>

                      {/* Harga Jual & Margin */}
                      <td className="py-4 px-4 text-right">
                        <div className="font-extrabold text-blue-950">
                          Rp {p.basePrice.toLocaleString('id-ID')}
                        </div>
                        <div className="text-[11px] text-emerald-600 font-semibold">
                          Margin: {marginPercent}%
                        </div>
                      </td>

                      {/* Stok & Status Alert */}
                      <td className="py-4 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border">
                          {p.stock >= 99999 ? (
                            <span className="flex items-center gap-1 text-amber-800 bg-amber-50 border-amber-200 px-2 py-0.5 rounded-full">
                              <InfinityIcon className="w-3 h-3 text-amber-600" />
                              Tanpa Stok
                            </span>
                          ) : p.isLowStock ? (
                            <span className="flex items-center gap-1 text-amber-700 bg-amber-50 border-amber-200 px-2 py-0.5 rounded-full">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              {p.stock} {p.unit} (Menipis)
                            </span>
                          ) : (
                            <span className="text-blue-900 bg-blue-50 border-blue-200 px-2 py-0.5 rounded-full">
                              {p.stock} {p.unit}
                            </span>
                          )}
                        </div>
                        {p.warehouseStock !== undefined && p.warehouseStock !== null && p.stock < 99999 && (
                          <div className="mt-1 flex items-center justify-center">
                            <span
                              className="text-[10px] text-amber-800 bg-amber-50/90 border border-amber-200/80 px-2 py-0.5 rounded-md font-medium flex items-center gap-1"
                              title="Stok cadangan yang tersimpan di Gudang Utama"
                            >
                              <Warehouse className="w-3 h-3 text-amber-700" />
                              <span>{p.warehouseStock} di Gudang</span>
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Tombol Aksi */}
                      <td className="py-4 px-4 pr-6 text-center">
                        {userRole === 'ADMIN' ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleStatusSingle(p)}
                              title={p.isActive ? 'Nonaktifkan Produk' : 'Aktifkan Kembali Produk'}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                p.isActive
                                  ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                  : 'border-slate-300 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleEdit(p)}
                              title="Edit Produk"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-900 hover:bg-blue-50 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteSingle(p)}
                              title="Hapus / Nonaktifkan Produk"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                            Lihat Saja
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-5 py-3.5 rounded-3xl shadow-2xl border border-slate-700 flex items-center gap-3 sm:gap-4 animate-scaleUp max-w-[95vw] sm:max-w-xl">
          <div className="flex items-center gap-2 shrink-0 border-r border-slate-700 pr-3 sm:pr-4">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-xs sm:text-sm font-black whitespace-nowrap">
              {selectedIds.length} Dipilih
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-0.5">
            {/* Ubah Kategori Massal */}
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => {
                setSelectedTargetCategoryId(categories[0]?.id || '');
                setBulkCategoryModalOpen(true);
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
            >
              <FolderSync className="w-3.5 h-3.5 text-blue-400" />
              <span>Ubah Kategori</span>
            </button>

            {/* Set Aktif Massal */}
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => handleBulkSetStatus(true)}
              className="px-3 py-1.5 bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Aktifkan</span>
            </button>

            {/* Set Nonaktif Massal */}
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => handleBulkSetStatus(false)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
            >
              <Power className="w-3.5 h-3.5 text-amber-400" />
              <span>Nonaktifkan</span>
            </button>

            {/* Hapus Terpilih */}
            <button
              type="button"
              disabled={actionLoading}
              onClick={handleBulkDelete}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 ml-auto shrink-0 cursor-pointer"
            title="Batalkan Pilihan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modal Dialog: Ubah Kategori Massal */}
      {bulkCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center">
                  <FolderSync className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-blue-950 text-base">Ubah Kategori Massal</h3>
                  <p className="text-xs text-slate-500">
                    Pindahkan {selectedIds.length} produk terpilih
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBulkCategoryModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700">Pilih Kategori Tujuan</label>
              <select
                value={selectedTargetCategoryId}
                onChange={(e) => setSelectedTargetCategoryId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900/10 cursor-pointer"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    📁 {cat.name} ({cat.productCount ?? 0} Produk)
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkCategoryModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={actionLoading || !selectedTargetCategoryId}
                onClick={handleBulkChangeCategory}
                className="px-5 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {actionLoading && (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>Pindahkan Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog: Tambah / Edit Produk */}
      <ProductModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchData}
        productToEdit={productToEdit}
        categories={categories}
        outletId={outletId}
      />

      {/* Modal Kelola Kategori */}
      <CategoryModal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        categories={categories}
        onRefresh={fetchData}
      />

      {/* Reusable Confirm Modal (Hapus / Konfirmasi Tindakan Penting) */}
      <ConfirmModal
        isOpen={confirmModalConfig.isOpen}
        onClose={() => setConfirmModalConfig((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModalConfig.onConfirm}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        variant={confirmModalConfig.variant}
        confirmText={confirmModalConfig.confirmText}
        loading={actionLoading}
      />

      {/* Modal Ambil Produk dari Master Katalog */}
      <AssignCatalogProductModal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        outletId={outletId}
        onSuccess={() => {
          fetchData();
          setFeedback({
            type: 'success',
            message: 'Produk dari katalog berhasil dihubungkan ke cabang ini.',
          });
        }}
      />
    </div>
  );
};
