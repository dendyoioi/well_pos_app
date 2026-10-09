import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  Barcode,
  Edit2,
  Trash2,
  AlertTriangle,
  Layers,
  CheckSquare,
  Square,
  CheckCircle2,
  AlertCircle,
  FolderSync,
  Power,
  X,
  Infinity as InfinityIcon,
  ShoppingBag,
  Download,
  FileSpreadsheet,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Package,
  UtensilsCrossed,
  Boxes,
} from 'lucide-react';
import type { Product, Category } from '../types/product';
import { ProductModal } from '../components/ProductModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { AssignCatalogProductModal } from '../components/AssignCatalogProductModal';
import { FullScreenProductImportModal } from '../components/FullScreenProductImportModal';
import { ProductBarcodeLabelsModal } from '../components/ProductBarcodeLabelsModal';
import { TablePagination } from '../components/TablePagination';
import { exportProductsToCsv } from '../utils/productExportCsv';
import { ActionBar, Button } from '../components/ui';
import { api } from '../services/api';

interface ProductsViewProps {
  userRole?: string;
  outletId?: string;
  onProductCountChange?: (count: number) => void;
  onNavigateToCategories?: () => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  userRole = 'ADMIN',
  outletId,
  onProductCountChange,
  onNavigateToCategories,
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'FNB' | 'RETAIL'>('all');

  // Multi-Select State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Feedback Notification Banner
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [barcodeLabelsModalOpen, setBarcodeLabelsModalOpen] = useState(false);
  const [productsForLabels, setProductsForLabels] = useState<Product[]>([]);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [bulkCategoryModalOpen, setBulkCategoryModalOpen] = useState(false);
  const [selectedTargetCategoryId, setSelectedTargetCategoryId] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false);
  const toolsDropdownRef = useRef<HTMLDivElement>(null);

  // Close tools dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolsDropdownRef.current && !toolsDropdownRef.current.contains(event.target as Node)) {
        setToolsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Category Scroll Controller untuk Banyak Kategori
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkCategoryScroll = () => {
    const el = categoryScrollRef.current;
    if (el) {
      setCanScrollLeft(el.scrollLeft > 6);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 6);
    }
  };

  useEffect(() => {
    checkCategoryScroll();
    window.addEventListener('resize', checkCategoryScroll);
    return () => window.removeEventListener('resize', checkCategoryScroll);
  }, [categories]);

  const handleScrollCategory = (direction: 'LEFT' | 'RIGHT') => {
    if (categoryScrollRef.current) {
      categoryScrollRef.current.scrollBy({
        left: direction === 'LEFT' ? -240 : 240,
        behavior: 'smooth',
      });
      setTimeout(checkCategoryScroll, 300);
    }
  };

  const stats = useMemo(() => {
    const total = products.length;
    const activeCount = products.filter((p) => p.isActive).length;
    const fnbCount = products.filter(
      (p) => p.productType === 'COMPOSITE' || p.hasStock === false || (p.stock !== undefined && p.stock >= 999000)
    ).length;
    const retailCount = products.filter(
      (p) => (p.productType === 'STANDARD' || !p.productType) && p.hasStock !== false && (!p.stock || p.stock < 999000)
    ).length;
    return { total, activeCount, fnbCount, retailCount };
  }, [products]);

  const existingSkusSet = useMemo(() => {
    return new Set(products.map((p) => p.sku || p.variants?.[0]?.sku || '').filter(Boolean));
  }, [products]);

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

  const canManage = userRole === 'ADMIN' || userRole === 'OWNER';

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

  // Reset pagination ke halaman 1 saat filter atau pencarian berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, statusFilter, typeFilter]);

  // Client-side filtering untuk tipe produk F&B vs Ritel Fisik
  const filteredProducts = useMemo(() => {
    if (typeFilter === 'all') return products;
    if (typeFilter === 'FNB') {
      return products.filter(
        (p) => p.productType === 'COMPOSITE' || p.hasStock === false || (p.stock !== undefined && p.stock >= 999000)
      );
    }
    return products.filter(
      (p) => (p.productType === 'STANDARD' || !p.productType) && p.hasStock !== false && (!p.stock || p.stock < 999000)
    );
  }, [products, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedProducts = filteredProducts.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  // Reset selected IDs when filter or list changes
  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => filteredProducts.some((p) => p.id === id)));
  }, [filteredProducts]);

  // Clear feedback after 4 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Select All Checkbox
  const isAllSelected = filteredProducts.length > 0 && selectedIds.length === filteredProducts.length;
  const isIndeterminate = selectedIds.length > 0 && selectedIds.length < filteredProducts.length;

  // Multi-Select Handlers
  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProducts.map((p) => p.id));
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
    const outletLabel = deleteInfo?.outletName || 'toko aktif';

    setConfirmModalConfig({
      isOpen: true,
      title: outletId ? 'Lepas Produk dari Toko?' : 'Hapus Produk?',
      variant: 'danger',
      confirmText: outletId ? 'Ya, Lepas dari Toko' : 'Ya, Hapus Produk',
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
                Produk ini akan <strong>langsung lenyap dari katalog dan kasir toko ini</strong>. Seluruh riwayat nota, laporan HPP, dan laporan laba rugi masa lalu <strong>tetap tersimpan utuh dan aman</strong>.
              </p>
            </div>
          ) : (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800">
              Produk ini belum pernah ditransaksikan di toko ini. Produk akan langsung dihapus dari katalog toko.
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
              message: res.message || `Produk "${product.name}" berhasil dilepas dari toko.`,
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
      title: outletId ? `Lepas ${selectedIds.length} Produk dari Toko?` : `Hapus ${selectedIds.length} Produk?`,
      variant: 'danger',
      confirmText: outletId ? `Ya, Lepas ${selectedIds.length} Produk` : `Hapus ${selectedIds.length} Produk`,
      message: (
        <div className="space-y-2 text-left">
          <p className="text-slate-700">
            Anda akan melepas{' '}
            <strong className="text-blue-950">{selectedIds.length} produk terpilih</strong> dari toko ini.
          </p>
          <p className="text-[11px] text-slate-500">
            Produk terpilih akan langsung lenyap dari katalog dan kasir toko ini. Seluruh riwayat transaksi nota dan audit masa lalu tetap aman.
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

      {/* Hero Banner & KPI Summary Cards */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-blue-900 rounded-2xl sm:rounded-3xl p-4 sm:p-7 text-white shadow-xl shadow-blue-950/10 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -top-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
          <div className="space-y-1 sm:space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-[11px] sm:text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-blue-300" />
              <span>Katalog &amp; Manajemen Menu Toko</span>
            </div>
            <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white">
              Daftar Menu &amp; Produk
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed line-clamp-2 sm:line-clamp-none">
              Kelola menu F&amp;B racikan dapur/barista, varian harga, formula HPP resep, serta stok produk kemasan ritel fisik toko.
            </p>
          </div>
        </div>

        {/* 4 KPI Cards Ringkasan Katalog */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mt-3 sm:mt-6 pt-3 sm:pt-6 border-t border-white/10 relative z-10">
          <div
            onClick={() => {
              setStatusFilter('all');
              setSelectedCategory('all');
              setTypeFilter('all');
              setSearchTerm('');
            }}
            className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer backdrop-blur-xs ${
              statusFilter === 'all' && selectedCategory === 'all' && typeFilter === 'all' && !searchTerm
                ? 'bg-white/15 border-white/40 ring-2 ring-white/20'
                : 'bg-white/5 hover:bg-white/10 border-white/10'
            }`}
            title="Klik untuk melihat semua produk"
          >
            <div className="flex items-center justify-between text-slate-300 mb-0.5 sm:mb-1">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Total Menu</span>
              <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-300" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-white">{stats.total}</div>
            <p className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 truncate">Semua produk terdaftar</p>
          </div>

          <div
            onClick={() => setStatusFilter((prev) => (prev === 'active' ? 'all' : 'active'))}
            className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer backdrop-blur-xs ${
              statusFilter === 'active'
                ? 'bg-emerald-500/20 border-emerald-400/50 ring-2 ring-emerald-400/30'
                : 'bg-white/5 hover:bg-white/10 border-white/10'
            }`}
            title="Klik untuk memfilter menu aktif kasir"
          >
            <div className="flex items-center justify-between text-emerald-300 mb-0.5 sm:mb-1">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Menu Aktif Kasir</span>
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-400">{stats.activeCount}</div>
            <p className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 truncate">Tayang di mesin kasir</p>
          </div>

          <div
            onClick={() => setTypeFilter((prev) => (prev === 'FNB' ? 'all' : 'FNB'))}
            className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer backdrop-blur-xs ${
              typeFilter === 'FNB'
                ? 'bg-teal-500/20 border-teal-400/50 ring-2 ring-teal-400/30'
                : 'bg-white/5 hover:bg-white/10 border-white/10'
            }`}
            title="Klik untuk memfilter hidangan olahan F&B (BOM resep)"
          >
            <div className="flex items-center justify-between text-teal-300 mb-0.5 sm:mb-1">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Olahan F&amp;B</span>
              <UtensilsCrossed className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-300" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-teal-300">{stats.fnbCount}</div>
            <p className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 truncate">Potong bahan baku via BOM</p>
          </div>

          <div
            onClick={() => setTypeFilter((prev) => (prev === 'RETAIL' ? 'all' : 'RETAIL'))}
            className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer backdrop-blur-xs ${
              typeFilter === 'RETAIL'
                ? 'bg-indigo-500/20 border-indigo-400/50 ring-2 ring-indigo-400/30'
                : 'bg-white/5 hover:bg-white/10 border-white/10'
            }`}
            title="Klik untuk memfilter produk kemasan ritel fisik"
          >
            <div className="flex items-center justify-between text-indigo-300 mb-0.5 sm:mb-1">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Ritel Fisik</span>
              <Boxes className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-300" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-indigo-300">{stats.retailCount}</div>
            <p className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 truncate">Produk berstok unit fisik</p>
          </div>
        </div>
      </div>

      {/* Toolbar Pencarian & Aksi Katalog Kanonikal (Option B) */}
      <ActionBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Cari nama menu, varian, kategori, SKU, barcode..."
        secondaryAction={
          <div className="relative w-full sm:w-auto" ref={toolsDropdownRef}>
            <button
              type="button"
              onClick={() => setToolsDropdownOpen(!toolsDropdownOpen)}
              className="w-full sm:w-auto h-10 px-3.5 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              title="Opsi Alat, Berkas, dan Pengaturan Menu"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-600 shrink-0" />
              <span>Alat &amp; Berkas</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                  toolsDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {toolsDropdownOpen && (
              <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 z-30 animate-fadeIn space-y-1">
                {/* Ambil dari Master Katalog (jika outlet mode) */}
                {canManage && outletId && (
                  <button
                    type="button"
                    onClick={() => {
                      setToolsDropdownOpen(false);
                      setAssignModalOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-blue-900 hover:bg-blue-50 flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <ShoppingBag className="w-4 h-4 text-blue-800 shrink-0" />
                    <div>
                      <div>Ambil dari Master</div>
                      <div className="text-[10px] text-slate-400 font-normal">Salin katalog pusat ke outlet ini</div>
                    </div>
                  </button>
                )}

                {/* Kelola Kategori */}
                {canManage && onNavigateToCategories && (
                  <button
                    type="button"
                    onClick={() => {
                      setToolsDropdownOpen(false);
                      onNavigateToCategories();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <Layers className="w-4 h-4 text-slate-600 shrink-0" />
                    <div>
                      <div>Kelola Kategori Menu</div>
                      <div className="text-[10px] text-slate-400 font-normal">Atur pengelompokan produk</div>
                    </div>
                  </button>
                )}

                {canManage && (
                  <button
                    type="button"
                    onClick={() => {
                      setToolsDropdownOpen(false);
                      setImportModalOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-950 flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-blue-900 shrink-0" />
                    <div>
                      <div>Impor Spreadsheet</div>
                      <div className="text-[10px] text-slate-400 font-normal">Format CSV / Excel</div>
                    </div>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setToolsDropdownOpen(false);
                    const ok = exportProductsToCsv(products, 'katalog_produk_wellpos', (err) => {
                      setFeedback({ type: 'error', message: err });
                    });
                    if (ok) {
                      setFeedback({
                        type: 'success',
                        message: `Berhasil mengunduh berkas CSV (${products.length} produk). Berkas siap dibuka di Microsoft Excel.`,
                      });
                    }
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-950 flex items-center gap-2.5 cursor-pointer transition-colors"
                >
                  <Download className="w-4 h-4 text-emerald-700 shrink-0" />
                  <div>
                    <div>Ekspor Katalog CSV</div>
                    <div className="text-[10px] text-slate-400 font-normal">Unduh data aktif</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setToolsDropdownOpen(false);
                    setProductsForLabels(products);
                    setBarcodeLabelsModalOpen(true);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-950 flex items-center gap-2.5 cursor-pointer transition-colors"
                >
                  <Barcode className="w-4 h-4 text-blue-900 shrink-0" />
                  <div>
                    <div>Cetak Label Barcode</div>
                    <div className="text-[10px] text-slate-400 font-normal">Stiker rak &amp; kemasan</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        }
        primaryAction={
          canManage && (
            <Button
              variant="primary"
              size="md"
              icon={<Plus className="w-4 h-4 stroke-[2.5]" />}
              onClick={handleAddNew}
              fullWidthOnMobile
            >
              Tambah Produk
            </Button>
          )
        }
      />

      {/* Active Search & Filter Information Bar (Feedback Detail Pencarian) */}
      {(searchTerm || selectedCategory !== 'all' || statusFilter !== 'all' || typeFilter !== 'all') && (
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-3 sm:px-4 sm:py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-blue-950 animate-fadeIn">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="font-bold text-slate-500">Filter Aktif:</span>
            {searchTerm && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-blue-200 font-bold text-blue-900 shadow-2xs">
                Kata kunci: &ldquo;{searchTerm}&rdquo;
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="hover:text-rose-600 cursor-pointer p-0.5 rounded-full"
                  title="Hapus filter kata kunci"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedCategory !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-blue-200 font-bold text-blue-900 shadow-2xs">
                Kategori: {categories.find((c) => c.id === selectedCategory)?.name || selectedCategory}
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className="hover:text-rose-600 cursor-pointer p-0.5 rounded-full"
                  title="Hapus filter kategori"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-blue-200 font-bold text-blue-900 shadow-2xs">
                Status: {statusFilter === 'active' ? 'Aktif Kasir' : 'Nonaktif'}
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className="hover:text-rose-600 cursor-pointer p-0.5 rounded-full"
                  title="Hapus filter status"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {typeFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-blue-200 font-bold text-blue-900 shadow-2xs">
                Tipe: {typeFilter === 'FNB' ? 'Olahan F&B' : 'Ritel Fisik'}
                <button
                  type="button"
                  onClick={() => setTypeFilter('all')}
                  className="hover:text-rose-600 cursor-pointer p-0.5 rounded-full"
                  title="Hapus filter tipe"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <span className="text-slate-500 font-semibold ml-1">
              (Ditemukan <strong>{filteredProducts.length}</strong> dari {stats.total} produk)
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('all');
              setStatusFilter('all');
              setTypeFilter('all');
            }}
            className="text-xs font-bold text-blue-800 hover:text-rose-600 underline cursor-pointer ml-auto"
          >
            Reset Semua Filter
          </button>
        </div>
      )}

      {/* Filter Bar Terpadu: Status & Kategori */}
      <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Status Filter Pills */}
        <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200/80 text-xs font-bold shrink-0 self-start">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-white text-blue-950 shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua Status ({stats.total})
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
            <span>Hanya Aktif ({stats.activeCount})</span>
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
            <span>Hanya Nonaktif ({stats.total - stats.activeCount})</span>
          </button>
        </div>

        {/* Category Pills Horizontal Scroll - Terproteksi jika Kategori Banyak */}
        <div className="relative group/catbar">
          {/* Tombol Geser Kiri */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => handleScrollCategory('LEFT')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white/95 border border-slate-200 shadow-md text-slate-700 hover:text-blue-900 hover:bg-slate-50 flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs"
              title="Geser kategori ke kiri"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          {/* Track Kategori Horizontal dengan Dukungan Mouse Wheel */}
          <div
            ref={categoryScrollRef}
            onScroll={checkCategoryScroll}
            onWheel={(e) => {
              if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && categoryScrollRef.current) {
                categoryScrollRef.current.scrollLeft += e.deltaY;
              }
            }}
            className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar scroll-smooth px-1"
          >
            <button
              type="button"
              onClick={(e) => {
                setSelectedCategory('all');
                e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                selectedCategory === 'all'
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Semua Kategori ({categories.reduce((acc, c) => acc + (c.productCount || 0), 0)})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={(e) => {
                  setSelectedCategory(cat.id);
                  e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  selectedCategory === cat.id
                    ? 'bg-blue-900 text-white shadow-sm'
                    : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {cat.name} {cat.productCount !== undefined && `(${cat.productCount})`}
              </button>
            ))}
          </div>

          {/* Tombol Geser Kanan */}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => handleScrollCategory('RIGHT')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white/95 border border-slate-200 shadow-md text-slate-700 hover:text-blue-900 hover:bg-slate-50 flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs"
              title="Geser kategori ke kanan"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Products Table Card */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        {/* Desktop Table View (Hidden on Mobile) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm table-fixed">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-bold text-xs uppercase tracking-wider">
                {canManage && (
                  <th className="py-3.5 pl-3 pr-1 w-[36px] text-center">
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
                <th className="py-3.5 px-3 min-w-[210px]">Produk</th>
                <th className="py-3.5 px-1 w-[76px] text-center whitespace-nowrap">Status</th>
                <th className="py-3.5 px-2 w-[108px] whitespace-nowrap">Barcode / SKU</th>
                <th className="py-3.5 px-2 w-[108px] whitespace-nowrap">Kategori</th>
                <th className="py-3.5 px-2.5 w-[132px] text-right whitespace-nowrap">Modal (HPP)</th>
                <th className="py-3.5 px-2.5 w-[132px] text-right whitespace-nowrap">Harga Jual</th>
                <th className="py-3.5 px-2 w-[140px] text-center whitespace-nowrap">Stok Toko</th>
                <th className="py-3.5 px-2 pr-5 w-[166px] text-center whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={canManage ? 9 : 8} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
                      <span>Memuat katalog produk...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 9 : 8} className="py-12 text-center text-slate-400">
                    <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold">Tidak ada produk ditemukan</p>
                    <p className="text-xs text-slate-500">
                      Coba sesuaikan filter status, kategori, atau tambah produk baru.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p) => {
                  const isSelected = selectedIds.includes(p.id);
                  const marginRp = p.basePrice - p.costPrice;
                  const marginPercent = p.basePrice > 0 ? Math.round((marginRp / p.basePrice) * 100) : 0;
                  const isFnbComposite =
                    p.productType === 'COMPOSITE' ||
                    p.hasStock === false ||
                    (p.stock !== undefined && p.stock >= 999000);

                  return (
                    <tr
                      key={p.id}
                      className={`group transition-colors ${
                        isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50/70'
                      } ${!p.isActive ? 'opacity-70 bg-slate-50/30' : ''}`}
                    >
                      {/* Checkbox */}
                      {canManage && (
                        <td className="py-3.5 pl-3 pr-1 text-center">
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
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="w-10 h-10 rounded-xl object-cover border border-slate-200/90 shadow-2xs shrink-0 bg-slate-100"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0 shadow-2xs">
                              {p.name.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                              <span className={`font-bold ${!p.isActive ? 'line-through text-slate-500' : ''}`} title={p.name}>
                                {p.name}
                              </span>
                              {p.modifiers && p.modifiers.length > 0 && (
                                <span className="text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full shadow-2xs shrink-0">
                                  ✨ {p.modifiers.length} Custom Opsi
                                </span>
                              )}
                            </div>
                            {p.description && (
                              <div className="text-xs text-slate-400 line-clamp-1 max-w-xs sm:max-w-md mt-0.5" title={p.description}>
                                {p.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status Aktif / Nonaktif */}
                      <td className="py-3.5 px-1 text-center whitespace-nowrap">
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
                      <td className="py-3.5 px-2">
                        <div className="font-mono text-xs font-semibold text-slate-700 flex items-center gap-1">
                          <Barcode className="w-3.5 h-3.5 text-blue-900 shrink-0" />
                          <span className="truncate">{p.barcode || '-'}</span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-400 truncate">{p.sku}</div>
                      </td>

                      {/* Kategori */}
                      <td className="py-3.5 px-2">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold inline-block truncate max-w-[92px]" title={p.category?.name}>
                          {p.category?.name || 'Tanpa Kategori'}
                        </span>
                      </td>

                      {/* Modal HPP */}
                      <td className="py-3.5 px-2.5 text-right whitespace-nowrap">
                        {p.costPrice > 0 ? (
                          <div className="flex flex-col items-end">
                            <span className="font-semibold text-slate-800 text-xs sm:text-sm whitespace-nowrap">
                              Rp {p.costPrice.toLocaleString('id-ID')}
                            </span>
                            {isFnbComposite && (
                              <span className="text-[10px] text-slate-500 font-semibold px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 inline-block mt-0.5 whitespace-nowrap">
                                HPP BOM
                              </span>
                            )}
                          </div>
                        ) : isFnbComposite ? (
                          <div className="flex flex-col items-end" title="Formula resep belum diracik di modul Resep & HPP">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md whitespace-nowrap">
                              Belum Ada Resep
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium block mt-0.5 whitespace-nowrap">
                              HPP: Rp 0
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      {/* Harga Jual & Margin */}
                      <td className="py-3.5 px-2.5 text-right whitespace-nowrap">
                        <div className="flex flex-col items-end">
                          <div className="font-extrabold text-blue-950 text-xs sm:text-sm whitespace-nowrap">
                            Rp {p.basePrice.toLocaleString('id-ID')}
                          </div>
                          {p.costPrice > 0 ? (
                            <div className="text-[11px] text-emerald-600 font-bold mt-0.5 whitespace-nowrap">
                              Margin: {marginPercent}%
                            </div>
                          ) : isFnbComposite ? (
                            <div
                              className="text-[10px] text-slate-400 font-medium mt-0.5 whitespace-nowrap"
                              title="Margin HPP belum dapat dihitung karena resep belum dirawat"
                            >
                              Margin: -
                            </div>
                          ) : null}
                        </div>
                      </td>

                      {/* Stok Toko */}
                      <td className="py-3.5 px-2 text-center whitespace-nowrap">
                        {isFnbComposite ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 shadow-2xs whitespace-nowrap">
                            <InfinityIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Olahan F&amp;B</span>
                          </span>
                        ) : p.isLowStock ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 shadow-2xs whitespace-nowrap">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="whitespace-nowrap">
                              {Number(p.stock || 0).toLocaleString('id-ID')} {p.unit || 'Pcs'}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-blue-950 bg-blue-50 border border-blue-200/80 shadow-2xs whitespace-nowrap">
                            <span className="whitespace-nowrap">
                              {Number(p.stock || 0).toLocaleString('id-ID')} {p.unit || 'Pcs'}
                            </span>
                          </span>
                        )}
                      </td>

                      {/* Tombol Aksi */}
                      <td className="py-3.5 px-2 pr-5 text-center whitespace-nowrap">
                        {canManage ? (
                          <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                            {/* Toggle Aktif / Nonaktif */}
                            <div className="relative group/btn flex items-center">
                              <button
                                type="button"
                                onClick={() => handleToggleStatusSingle(p)}
                                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                  p.isActive
                                    ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                    : 'border-slate-300 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50'
                                }`}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover/btn:flex flex-col items-center pointer-events-none z-30">
                                <span className="px-2 py-1 rounded bg-slate-900 text-[10px] font-bold text-white whitespace-nowrap shadow-xl border border-slate-700">
                                  {p.isActive ? 'Nonaktifkan Menu' : 'Aktifkan Kembali'}
                                </span>
                                <div className="w-1.5 h-1 border-solid border-t-slate-900 border-t-4 border-x-transparent border-x-4 border-b-0" />
                              </div>
                            </div>

                            {/* Cetak Label Barcode Produk */}
                            <div className="relative group/btn flex items-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setProductsForLabels([p]);
                                  setBarcodeLabelsModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-900 hover:bg-blue-50 transition-colors cursor-pointer"
                              >
                                <Barcode className="w-3.5 h-3.5" />
                              </button>
                              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover/btn:flex flex-col items-center pointer-events-none z-30">
                                <span className="px-2 py-1 rounded bg-slate-900 text-[10px] font-bold text-white whitespace-nowrap shadow-xl border border-slate-700">
                                  Cetak Label Barcode
                                </span>
                                <div className="w-1.5 h-1 border-solid border-t-slate-900 border-t-4 border-x-transparent border-x-4 border-b-0" />
                              </div>
                            </div>

                            {/* Edit Menu */}
                            <div className="relative group/btn flex items-center">
                              <button
                                type="button"
                                onClick={() => handleEdit(p)}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-900 hover:bg-blue-50 transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover/btn:flex flex-col items-center pointer-events-none z-30">
                                <span className="px-2 py-1 rounded bg-slate-900 text-[10px] font-bold text-white whitespace-nowrap shadow-xl border border-slate-700">
                                  Edit Produk
                                </span>
                                <div className="w-1.5 h-1 border-solid border-t-slate-900 border-t-4 border-x-transparent border-x-4 border-b-0" />
                              </div>
                            </div>

                            {/* Hapus / Nonaktifkan */}
                            <div className="relative group/btn flex items-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteSingle(p)}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <div className="absolute bottom-full mb-2 right-0 hidden group-hover/btn:flex flex-col items-end pointer-events-none z-30">
                                <span className="px-2 py-1 rounded bg-slate-900 text-[10px] font-bold text-white whitespace-nowrap shadow-xl border border-slate-700">
                                  Hapus / Nonaktifkan
                                </span>
                                <div className="w-1.5 h-1 mr-2 border-solid border-t-slate-900 border-t-4 border-x-transparent border-x-4 border-b-0" />
                              </div>
                            </div>
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

        {/* Mobile Product Card List (Visible on Smartphone 6.8") */}
        <div className="block md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <div className="w-6 h-6 border-2 border-blue-900 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <span className="text-xs">Memuat katalog produk...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-slate-400 px-4">
              <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-xs text-slate-700">Tidak ada produk ditemukan</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Coba sesuaikan filter status, kategori, atau tambah produk baru.
              </p>
            </div>
          ) : (
            paginatedProducts.map((p) => {
              const isSelected = selectedIds.includes(p.id);
              const marginRp = p.basePrice - p.costPrice;
              const marginPercent = p.basePrice > 0 ? Math.round((marginRp / p.basePrice) * 100) : 0;

              return (
                <div
                  key={p.id}
                  className={`p-3.5 space-y-2.5 transition-colors ${
                    isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50/70'
                  } ${!p.isActive ? 'opacity-70 bg-slate-50/40' : ''}`}
                >
                  {/* Top Bar: Checkbox + Image + Name + Status Pill */}
                  <div className="flex items-start gap-2.5">
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleToggleSelectOne(p.id)}
                        className="text-slate-600 hover:text-blue-900 cursor-pointer flex items-center justify-center pt-0.5 shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-900" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 hover:text-slate-400" />
                        )}
                      </button>
                    )}

                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="w-11 h-11 rounded-xl object-cover border border-slate-200 shadow-2xs shrink-0 bg-slate-100"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0 shadow-2xs">
                        {p.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <h4 className={`font-bold text-xs sm:text-sm text-slate-900 truncate leading-snug ${!p.isActive ? 'line-through text-slate-500' : ''}`}>
                          {p.name}
                        </h4>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${
                            p.isActive
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              p.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                          <span>{p.isActive ? 'Aktif' : 'Nonaktif'}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className="text-[10px] text-slate-500 font-semibold">
                          {p.category?.name || 'Tanpa Kategori'}
                        </span>
                        {p.sku && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-[10px] font-mono text-slate-400 font-bold">
                              {p.sku}
                            </span>
                          </>
                        )}
                        {p.modifiers && p.modifiers.length > 0 && (
                          <span className="text-[9px] font-bold bg-violet-50 text-violet-700 border border-violet-200 px-1.5 py-0.2 rounded-full">
                            ✨ {p.modifiers.length} Opsi
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle Info: Harga Jual & HPP & Stok */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-medium block">Harga Jual</span>
                      <span className="font-black text-blue-950 text-sm">
                        Rp {p.basePrice.toLocaleString('id-ID')}
                      </span>
                      {p.costPrice > 0 ? (
                        <span className="text-[10px] text-emerald-600 font-bold block">
                          Margin: {marginPercent}%
                        </span>
                      ) : null}
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-medium block">Stok Toko</span>
                      <div className="inline-flex items-center gap-1 font-bold text-xs mt-0.5">
                        {p.productType === 'COMPOSITE' ||
                        p.hasStock === false ||
                        (p.stock !== undefined && p.stock >= 999000) ? (
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-[10px] font-bold">
                            Olahan F&amp;B (∞)
                          </span>
                        ) : p.isLowStock ? (
                          <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-0.5">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            {Number(p.stock || 0).toLocaleString('id-ID')} {p.unit || 'Pcs'}
                          </span>
                        ) : (
                          <span className="text-blue-900 bg-blue-50 px-2 py-0.5 rounded-md text-[10px] font-bold">
                            {Number(p.stock || 0).toLocaleString('id-ID')} {p.unit || 'Pcs'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons Row */}
                  {canManage && (
                    <div className="flex items-center justify-between gap-1.5 pt-0.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleStatusSingle(p)}
                          className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                            p.isActive
                              ? 'border-slate-200 text-slate-600 hover:bg-slate-100'
                              : 'border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                          <span>{p.isActive ? 'Nonaktifkan' : 'Aktifkan'}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setProductsForLabels([p]);
                            setBarcodeLabelsModalOpen(true);
                          }}
                          className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:text-blue-900 hover:bg-blue-50 transition-all shadow-2xs flex items-center justify-center cursor-pointer min-h-[32px] min-w-[32px]"
                          title="Cetak Label Barcode"
                        >
                          <Barcode className="w-3.5 h-3.5 text-blue-900" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleEdit(p)}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:text-blue-900 hover:bg-blue-50 text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer min-h-[32px]"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-blue-900" />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteSingle(p)}
                          className="p-1.5 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
                          title="Hapus / Nonaktifkan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Produk */}
        {!loading && filteredProducts.length > 0 && (
          <TablePagination
            currentPage={safeCurrentPage}
            pageSize={pageSize}
            totalItems={filteredProducts.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            itemLabel="produk"
          />
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-4 sm:px-5 py-3 sm:py-3.5 rounded-3xl shadow-2xl border border-slate-700 flex items-center gap-3 sm:gap-4 animate-scaleUp max-w-[95vw] sm:max-w-xl">
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

            {/* Cetak Label Terpilih Massal */}
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => {
                const selected = products.filter((p) => selectedIds.includes(p.id));
                setProductsForLabels(selected);
                setBarcodeLabelsModalOpen(true);
              }}
              className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
              title="Cetak label barcode / stiker rak untuk produk terpilih"
            >
              <Barcode className="w-3.5 h-3.5 text-blue-200" />
              <span>Cetak Label</span>
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

      {/* Modal Dialog: Hubungkan Menu dari Master Katalog */}
      <AssignCatalogProductModal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        outletId={outletId}
        onSuccess={fetchData}
      />

      {/* Modal Layar Penuh: Impor Massal Produk dari Spreadsheet CSV */}
      <FullScreenProductImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        outletId={outletId}
        existingSkus={existingSkusSet}
        onSuccess={() => {
          fetchData();
        }}
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

      {/* Modal Cetak Label Barcode / Stiker Rak Produk (EPIC-26) */}
      <ProductBarcodeLabelsModal
        isOpen={barcodeLabelsModalOpen}
        onClose={() => setBarcodeLabelsModalOpen(false)}
        products={productsForLabels.length > 0 ? productsForLabels : products}
      />
    </div>
  );
};
