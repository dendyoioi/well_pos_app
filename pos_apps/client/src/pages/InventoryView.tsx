import React, { useState, useEffect, useMemo } from 'react';
import {
  Boxes,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  SlidersHorizontal,
  AlertTriangle,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Warehouse,
  Store,
  Plus,
  Truck,
  X,
  Package,
  CheckCircle2,
  ClipboardCheck,
  ChevronDown,
  Barcode,
  Sparkles,
} from 'lucide-react';
import type { Product, StockMovement, Category } from '../types/product';
import type { Outlet } from '../types/outlet';
import type { RecipeInventoryItem } from '../types/recipe';
import type { ExpiryAlertBatch } from '../types/purchasing';
import { StockMovementModal } from '../components/StockMovementModal';
import { StockTransferModal } from '../components/StockTransferModal';
import { CreateIngredientModal } from '../components/modals/CreateIngredientModal';
import { FullScreenBulkOpnameModal, type BulkOperationType } from '../components/FullScreenBulkOpnameModal';
import { TablePagination } from '../components/TablePagination';
import { EmptyState, TableSkeleton } from '../components/ui';
import { formatRupiah } from '../utils/currency';
import { api } from '../services/api';
import { useDialog } from '../context/DialogContext';

interface InventoryViewProps {
  activeOutlet?: Outlet | null;
  initialTab?: 'INGREDIENTS' | 'PRODUCTS';
  initialSubView?: 'INVENTORY' | 'MOVEMENTS';
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  activeOutlet,
  initialTab = 'INGREDIENTS',
  initialSubView = 'INVENTORY',
}) => {
  const dialog = useDialog();
  // Tab State: 'INGREDIENTS' (Bahan Baku Mentah F&B) | 'PRODUCTS' (Produk Jadi Retail)
  const [activeTab, setActiveTab] = useState<'INGREDIENTS' | 'PRODUCTS'>(initialTab);

  // Raw Materials State
  const [ingredients, setIngredients] = useState<RecipeInventoryItem[]>([]);
  const [loadingIngredients, setLoadingIngredients] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState('');
  const [ingredientStatusFilter, setIngredientStatusFilter] = useState<'ALL' | 'CRITICAL' | 'SAFE' | 'OUT'>('ALL');
  const [ingredientScope, setIngredientScope] = useState<'outlet' | 'all'>('outlet');
  const [createIngredientModalOpen, setCreateIngredientModalOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<RecipeInventoryItem | null>(null);

  // Pagination State for Raw Materials (Bahan Baku Mentah F&B)
  const [ingredientPage, setIngredientPage] = useState(1);
  const [ingredientPageSize, setIngredientPageSize] = useState(10);

  // Expiry Alerts State
  const [expiryAlerts, setExpiryAlerts] = useState<ExpiryAlertBatch[]>([]);
  const [showExpiryModal, setShowExpiryModal] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination State for Retail Products (Produk Jadi Retail)
  const [productPage, setProductPage] = useState(1);
  const [productPageSize, setProductPageSize] = useState(10);

  // Filter & Search State for Card Stok
  const [movementSearch, setMovementSearch] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('ALL');

  // Pagination State for Movements (Kartu Stok)
  const [movementPage, setMovementPage] = useState(1);
  const [movementPageSize, setMovementPageSize] = useState(10);

  // Filter & Sub-View State for Produk Jadi (Retail)
  const [productSubView, setProductSubView] = useState<'INVENTORY' | 'MOVEMENTS'>(initialSubView);
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('ALL');
  const [productStockFilter, setProductStockFilter] = useState<'ALL' | 'SAFE' | 'LOW' | 'OUT'>('ALL');

  // Full-Screen Bulk Stock Workspace State
  const [bulkOpnameOpen, setBulkOpnameOpen] = useState(false);
  const [bulkOpnameMode, setBulkOpnameMode] = useState<'PRODUCTS' | 'INGREDIENTS'>('PRODUCTS');
  const [bulkOperation, setBulkOperation] = useState<BulkOperationType>('OPNAME');
  const [allOutlets, setAllOutlets] = useState<Outlet[]>([]);

  // Stock Movement & Transfer Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'IN' | 'OUT' | 'ADJUST'>('IN');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [targetModalOutletId, setTargetModalOutletId] = useState<string | undefined>(undefined);
  const [transferSourceOutletId, setTransferSourceOutletId] = useState<string | undefined>(undefined);
  const [transferDefaultItemType, setTransferDefaultItemType] = useState<'RAW' | 'PRODUCT'>('RAW');
  const [transferDefaultItemId, setTransferDefaultItemId] = useState<string | undefined>(undefined);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const [prodRes, movRes, catRes] = await Promise.all([
        api.getProducts({ outletId: activeOutlet?.id }),
        api.getStockMovements({
          outletId: activeOutlet?.id,
          limit: 100,
          search: movementSearch.trim() || undefined,
          type: movementTypeFilter !== 'ALL' ? movementTypeFilter : undefined,
        }),
        api.getCategories(activeOutlet?.id),
      ]);

      if (prodRes.status === 'success') setProducts(prodRes.data);
      if (movRes.status === 'success') setMovements(movRes.data);
      if (catRes.status === 'success' && catRes.data) setCategories(catRes.data);
    } catch (err) {
      console.error('Gagal mengambil data inventori:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllOutlets = async () => {
    try {
      const res = await api.getOutlets();
      if (res.status === 'success' && res.data) {
        setAllOutlets(res.data);
      }
    } catch (err) {
      console.error('Gagal mengambil data toko/outlet:', err);
    }
  };

  const fetchIngredients = async () => {
    setLoadingIngredients(true);
    try {
      const res = await api.getRecipeInventoryItems(activeOutlet?.id, ingredientScope);
      if (res.status === 'success' && res.data) {
        setIngredients(res.data);
      }
    } catch (err) {
      console.error('Gagal mengambil data bahan baku:', err);
    } finally {
      setLoadingIngredients(false);
    }
  };

  const fetchExpiryAlerts = async () => {
    try {
      const res = await api.getExpiryAlerts({ days: 30, outletId: activeOutlet?.id });
      if (res.status === 'success' && res.data) {
        setExpiryAlerts(res.data);
      }
    } catch (err) {
      console.error('Gagal mengambil alert kadaluarsa:', err);
    }
  };

  useEffect(() => {
    fetchInventory();
    fetchIngredients();
    fetchAllOutlets();
    fetchExpiryAlerts();
  }, [movementTypeFilter, activeOutlet?.id, ingredientScope]);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
    if (initialSubView) setProductSubView(initialSubView);
  }, [initialTab, initialSubView]);

  const countAllIngredients = ingredients.length;
  const countCriticalIngredients = ingredients.filter((it) => {
    const s = Number(it.stock || 0);
    const r = Number(it.reorderPoint || 0);
    return s > 0 && s <= r;
  }).length;
  const countOutIngredients = ingredients.filter((it) => Number(it.stock || 0) <= 0).length;
  const countSafeIngredients = ingredients.filter((it) => {
    const s = Number(it.stock || 0);
    const r = Number(it.reorderPoint || 0);
    return s > r;
  }).length;

  const filteredIngredients = ingredients.filter((ing) => {
    const stockVal = Number(ing.stock || 0);
    const reorderVal = Number(ing.reorderPoint || 0);

    if (ingredientStatusFilter === 'CRITICAL') {
      if (stockVal <= 0 || stockVal > reorderVal) return false;
    } else if (ingredientStatusFilter === 'OUT') {
      if (stockVal > 0) return false;
    } else if (ingredientStatusFilter === 'SAFE') {
      if (stockVal <= reorderVal) return false;
    }

    if (!ingredientSearch.trim()) return true;
    const q = ingredientSearch.toLowerCase();
    return (
      ing.name.toLowerCase().includes(q) ||
      (ing.itemCode && ing.itemCode.toLowerCase().includes(q)) ||
      ing.canonicalUom.toLowerCase().includes(q)
    );
  });

  // Reset pagination ke halaman 1 saat filter atau pencarian bahan baku berubah
  useEffect(() => {
    setIngredientPage(1);
  }, [ingredientSearch, ingredientStatusFilter, ingredientScope]);

  const totalIngredientPages = Math.max(1, Math.ceil(filteredIngredients.length / ingredientPageSize));
  const safeIngredientPage = Math.min(Math.max(1, ingredientPage), totalIngredientPages);
  const startIngredientIndex = filteredIngredients.length === 0 ? 0 : (safeIngredientPage - 1) * ingredientPageSize + 1;
  const endIngredientIndex = Math.min(safeIngredientPage * ingredientPageSize, filteredIngredients.length);
  const paginatedIngredients = filteredIngredients.slice(
    (safeIngredientPage - 1) * ingredientPageSize,
    safeIngredientPage * ingredientPageSize
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchInventory();
  };

  const openModal = (type: 'IN' | 'OUT' | 'ADJUST', product?: Product, customOutletId?: string) => {
    setModalType(type);
    setSelectedProduct(product || null);
    setSelectedIngredient(null);
    setTargetModalOutletId(customOutletId || activeOutlet?.id);
    setModalOpen(true);
  };

  const openIngredientModal = (type: 'IN' | 'OUT' | 'ADJUST', ing: RecipeInventoryItem) => {
    setModalType(type);
    setSelectedIngredient(ing);
    setSelectedProduct(null);
    setTargetModalOutletId(activeOutlet?.id);
    setModalOpen(true);
  };

  const openTransferModal = (
    customSourceOutletId?: string,
    defaultItemType: 'RAW' | 'PRODUCT' = 'RAW',
    defaultItemId?: string
  ) => {
    setTransferSourceOutletId(customSourceOutletId || activeOutlet?.id);
    setTransferDefaultItemType(defaultItemType);
    setTransferDefaultItemId(defaultItemId);
    setTransferModalOpen(true);
  };


  // Kalkulasi total statistik tab overview
  const isCompositeProd = (p: Product) => p.productType === 'COMPOSITE' || p.hasStock === false;
  const standardProducts = products.filter((p) => !isCompositeProd(p));

  const totalStockUnits = standardProducts.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
  const totalAssetValue = standardProducts.reduce(
    (acc, p) => acc + (Number(p.costPrice) || 0) * Math.max(0, Number(p.stock) || 0),
    0
  );

  const countAllProducts = products.length;
  const countOutProducts = standardProducts.filter((p) => Number(p.stock || 0) <= 0).length;
  const countLowProducts = standardProducts.filter((p) => {
    const s = Number(p.stock || 0);
    const minAlert = Number(p.minStockAlert || 5);
    return s > 0 && s <= minAlert;
  }).length;
  const countSafeProducts = standardProducts.filter((p) => {
    const s = Number(p.stock || 0);
    const minAlert = Number(p.minStockAlert || 5);
    return s > minAlert;
  }).length;

  // Kategori unik & hitungan produk jadi untuk filter (selaras 100% dengan master Menu & Produk)
  const categoriesWithCounts = useMemo(() => {
    const map = new Map<string, { id?: string; name: string; count: number }>();

    // 1. Masukkan semua master kategori (termasuk yang 0 produk) agar jumlah kategori sama persis dengan Menu & Produk
    categories.forEach((c) => {
      map.set(c.name, {
        id: c.id,
        name: c.name,
        count: 0,
      });
    });

    // 2. Hitung jumlah produk per kategori (dan tampung jika ada nama kategori dari produk yang belum ada di master)
    products.forEach((p) => {
      const catName = p.category?.name;
      if (catName) {
        if (!map.has(catName)) {
          map.set(catName, { id: p.category?.id, name: catName, count: 0 });
        }
        const item = map.get(catName)!;
        item.count += 1;
      }
    });

    return Array.from(map.values());
  }, [categories, products]);

  // Filter produk jadi
  const filteredProducts = products.filter((p) => {
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchSku = p.sku && p.sku.toLowerCase().includes(q);
      const matchBarcode = p.barcode && p.barcode.toLowerCase().includes(q);
      const matchCategory = p.category?.name && p.category.name.toLowerCase().includes(q);
      if (!matchName && !matchSku && !matchBarcode && !matchCategory) return false;
    }

    if (productCategoryFilter !== 'ALL' && p.category?.name !== productCategoryFilter) {
      return false;
    }

    if (productStockFilter === 'OUT') {
      return !isCompositeProd(p) && (Number(p.stock) || 0) <= 0;
    }
    if (productStockFilter === 'LOW') {
      return !isCompositeProd(p) && (Number(p.stock) || 0) > 0 && (Number(p.stock) || 0) <= (p.minStockAlert || 5);
    }
    if (productStockFilter === 'SAFE') {
      return !isCompositeProd(p) && (Number(p.stock) || 0) > (p.minStockAlert || 5);
    }

    return true;
  });

  // Reset pagination ke halaman 1 saat filter atau pencarian produk berubah
  useEffect(() => {
    setProductPage(1);
  }, [productSearch, productCategoryFilter, productStockFilter]);

  const totalProductPages = Math.max(1, Math.ceil(filteredProducts.length / productPageSize));
  const safeProductPage = Math.min(Math.max(1, productPage), totalProductPages);
  const startProductIndex = filteredProducts.length === 0 ? 0 : (safeProductPage - 1) * productPageSize + 1;
  const endProductIndex = Math.min(safeProductPage * productPageSize, filteredProducts.length);
  const paginatedProducts = filteredProducts.slice(
    (safeProductPage - 1) * productPageSize,
    safeProductPage * productPageSize
  );

  // Reset pagination ke halaman 1 saat filter kartu stok berubah
  useEffect(() => {
    setMovementPage(1);
  }, [movementSearch, movementTypeFilter]);

  const totalMovementPages = Math.max(1, Math.ceil(movements.length / movementPageSize));
  const safeMovementPage = Math.min(Math.max(1, movementPage), totalMovementPages);
  const paginatedMovements = movements.slice(
    (safeMovementPage - 1) * movementPageSize,
    safeMovementPage * movementPageSize
  );

  const getBadgeType = (type: string) => {
    switch (type) {
      case 'PURCHASE_IN':
        return { label: 'Stok Masuk (PO)', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'TRANSFER_IN':
        return { label: 'Mutasi Masuk Toko', color: 'bg-teal-50 text-teal-800 border-teal-200' };
      case 'TRANSFER_OUT':
        return { label: 'Mutasi Keluar Toko', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
      case 'SALE_OUT':
        return { label: 'Penjualan Kasir', color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'DAMAGE_OUT':
        return { label: 'Barang Rusak', color: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'ADJUSTMENT':
        return { label: 'Stock Opname', color: 'bg-amber-50 text-amber-800 border-amber-200' };
      default:
        return { label: type, color: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation Header: Terintegrasi Bahan Baku F&B, Produk Jadi Retail, & Gudang */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -mx-1 px-1 sm:mx-0 sm:px-0 flex-nowrap">
          <button
            onClick={() => {
              setActiveTab('INGREDIENTS');
              fetchIngredients();
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'INGREDIENTS'
                ? 'bg-blue-900 text-white shadow-md shadow-blue-950/20'
                : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Package className="w-4 h-4 shrink-0" />
            <span>Bahan Baku Mentah (Resep F&amp;B)</span>
            {ingredients.length > 0 && (
              <span
                className={`px-2 py-0.5 text-[10px] font-black rounded-full shrink-0 ${
                  activeTab === 'INGREDIENTS'
                    ? 'bg-white/25 text-white'
                    : 'bg-blue-100 text-blue-900'
                }`}
              >
                {ingredients.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('PRODUCTS');
              fetchInventory();
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'PRODUCTS'
                ? 'bg-blue-900 text-white shadow-md shadow-blue-950/20'
                : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Boxes className="w-4 h-4 shrink-0" />
            <span>Produk Jadi (Retail)</span>
            {products.length > 0 && (
              <span
                className={`px-2 py-0.5 text-[10px] font-black rounded-full shrink-0 ${
                  activeTab === 'PRODUCTS'
                    ? 'bg-white/25 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {products.length}
              </span>
            )}
          </button>
        </div>

        {/* Global Logistics Architecture Indicator */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 border border-slate-200/80 text-[11px] font-semibold text-slate-600 shrink-0">
          <Truck className="w-3.5 h-3.5 text-blue-900 shrink-0" />
          <span>Alur Dapur F&amp;B:</span>
          <span className="font-bold text-slate-800">Bahan Mentah</span>
          <span>➔</span>
          <span className="font-extrabold text-blue-900">Resep (BOM)</span>
          <span>➔</span>
          <span className="font-bold text-emerald-700">Auto Deduct Kasir</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: BAHAN BAKU MENTAH (RESEP F&B) */}
      {/* ========================================================================= */}
      {activeTab === 'INGREDIENTS' && (
        <div className="space-y-6">
          {/* Action Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-900 shrink-0" />
                <span>Stok Bahan Baku Dapur &amp; Racikan</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Persediaan bahan mentah F&amp;B yang otomatis terpotong setiap kali kasir memproses pesanan menu resep.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto shrink-0">
              <button
                type="button"
                onClick={() => {
                  setBulkOpnameMode('INGREDIENTS');
                  setBulkOperation('OPNAME');
                  setBulkOpnameOpen(true);
                }}
                className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-95 text-slate-800 text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                title="Lembar kerja massal: Opname, Stok Masuk, Stok Keluar, & Transfer Bahan Baku"
              >
                <ClipboardCheck className="w-4 h-4 text-blue-900 shrink-0" />
                <span>Lembar Kerja Massal</span>
              </button>
              <button
                type="button"
                onClick={() => setCreateIngredientModalOpen(true)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-900/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Tambah Bahan Baku Baru</span>
              </button>
            </div>
          </div>

          {/* Expiry Alerts Banner if any batches <= 30 days */}
          {expiryAlerts.length > 0 && (
            <div className="p-4 rounded-3xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-2xl shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-extrabold text-amber-950 text-sm">
                      Peringatan Bahan Baku Mendekati Kadaluarsa
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-200 text-amber-900">
                      {expiryAlerts.length} Batch
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Terdapat batch bahan baku fisik dengan masa simpan kurang dari 30 hari atau telah kadaluarsa. Pastikan bahan segera digunakan (FIFO) atau dimusnahkan.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowExpiryModal(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
              >
                Lihat Detail Batch
              </button>
            </div>
          )}

          {/* 3 Ringkasan KPI Bahan Baku */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              onClick={() => setIngredientStatusFilter('ALL')}
              className={`p-5 bg-white border rounded-3xl shadow-xs transition-all cursor-pointer ${
                ingredientStatusFilter === 'ALL'
                  ? 'border-blue-500/50 ring-2 ring-blue-900/10'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-slate-500 mb-2 gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">Total Bahan Terdaftar</span>
                <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-900 flex items-center justify-center border border-blue-100 shrink-0">
                  <Package className="w-4 h-4 shrink-0" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900">{countAllIngredients}</p>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Item bahan mentah dapur terdaftar</p>
            </div>

            <div
              onClick={() => setIngredientStatusFilter('CRITICAL')}
              className={`p-5 bg-white border rounded-3xl shadow-xs transition-all cursor-pointer ${
                ingredientStatusFilter === 'CRITICAL'
                  ? 'border-amber-500/50 ring-2 ring-amber-500/10'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-slate-500 mb-2 gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">Stok Menipis &amp; Kritis</span>
                <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shrink-0">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-black text-amber-600">{countCriticalIngredients + countOutIngredients}</p>
                {countOutIngredients > 0 && (
                  <span className="text-xs font-bold text-rose-600">({countOutIngredients} habis)</span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Perlu belanja atau transfer stok segera</p>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2 gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">Estimasi Nilai Aset Bahan</span>
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shrink-0">
                  <Boxes className="w-4 h-4 shrink-0" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900">
                {formatRupiah(
                  ingredients.reduce((sum, it) => sum + Math.max(0, Number(it.stock || 0)) * Number(it.averageCost || 0), 0)
                )}
              </p>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Kalkulasi (Stok Fisik Toko × HPP Rata-rata)</p>
            </div>
          </div>

          {/* Filter, Search & Quick Chips Bar */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={ingredientSearch}
                  onChange={(e) => setIngredientSearch(e.target.value)}
                  placeholder="Cari nama bahan, kode SKU, atau satuan..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all outline-none"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-end">
                {activeOutlet && !activeOutlet.isWarehouse && (
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
                    <button
                      type="button"
                      onClick={() => setIngredientScope('outlet')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        ingredientScope === 'outlet'
                          ? 'bg-blue-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Bahan Toko Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => setIngredientScope('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        ingredientScope === 'all'
                          ? 'bg-blue-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Semua Master Bahan
                    </button>
                  </div>
                )}
                <div className="text-xs text-slate-500 font-bold px-2">
                  Menampilkan{' '}
                  <span className="text-blue-900 font-black">
                    {filteredIngredients.length === 0 ? '0' : `${startIngredientIndex}-${endIngredientIndex}`}
                  </span>{' '}
                  dari {ingredients.length} bahan
                </div>
              </div>
            </div>

            {/* Quick Status Chips */}
            <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">Status Stok:</span>
              <button
                type="button"
                onClick={() => setIngredientStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  ingredientStatusFilter === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>Semua Bahan</span>
                <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[10px]">{countAllIngredients}</span>
              </button>

              <button
                type="button"
                onClick={() => setIngredientStatusFilter('CRITICAL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  ingredientStatusFilter === 'CRITICAL'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Menipis</span>
                <span className="px-1.5 py-0.2 rounded-md bg-amber-900/20 text-[10px] font-extrabold">{countCriticalIngredients}</span>
              </button>

              <button
                type="button"
                onClick={() => setIngredientStatusFilter('OUT')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  ingredientStatusFilter === 'OUT'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                }`}
              >
                <span>Habis (0)</span>
                <span className="px-1.5 py-0.2 rounded-md bg-rose-900/20 text-[10px] font-extrabold">{countOutIngredients}</span>
              </button>

              <button
                type="button"
                onClick={() => setIngredientStatusFilter('SAFE')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  ingredientStatusFilter === 'SAFE'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Stok Aman</span>
                <span className="px-1.5 py-0.2 rounded-md bg-emerald-900/20 text-[10px] font-extrabold">{countSafeIngredients}</span>
              </button>
            </div>
          </div>

          {/* Tabel Bahan Baku Mentah */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/90 text-[11px] font-black uppercase text-slate-500 border-b border-slate-200 tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5 min-w-[200px] whitespace-nowrap">Bahan Baku &amp; SKU</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">Stok Fisik Toko</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">Gudang Pasokan</th>
                    <th className="px-4 py-3.5 whitespace-nowrap">Batas Alert</th>
                    <th className="px-4 py-3.5 text-right whitespace-nowrap">HPP Rata-rata</th>
                    <th className="px-4 py-3.5 text-right whitespace-nowrap">Estimasi Nilai</th>
                    <th className="px-5 py-3.5 text-right whitespace-nowrap">Aksi Cepat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {loadingIngredients ? (
                    <TableSkeleton rows={5} columns={7} actionCol />
                  ) : filteredIngredients.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-14 text-center text-slate-400">
                        <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <p className="text-sm font-bold text-slate-700">Tidak ada bahan baku yang cocok</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {ingredientSearch || ingredientStatusFilter !== 'ALL'
                            ? 'Coba sesuaikan kata kunci pencarian atau reset filter status stok.'
                            : 'Mulai dengan menambahkan item bahan baku dapur baru.'}
                        </p>
                        {(ingredientSearch || ingredientStatusFilter !== 'ALL') && (
                          <button
                            type="button"
                            onClick={() => {
                              setIngredientSearch('');
                              setIngredientStatusFilter('ALL');
                            }}
                            className="mt-3 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                          >
                            Reset Semua Filter
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    paginatedIngredients.map((ing) => {
                      const stockVal = Number(ing.stock || 0);
                      const reorderVal = Number(ing.reorderPoint || 0);
                      const isLow = stockVal <= reorderVal && stockVal > 0;
                      const isZero = stockVal <= 0;

                      return (
                        <tr key={ing.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Nama Bahan & SKU */}
                          <td className="px-5 py-3.5">
                            <div className="space-y-0.5">
                              <span className="font-extrabold text-slate-900 text-sm block">
                                {ing.name}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {ing.itemCode || 'RAW'}
                                </span>
                                <span className="text-[11px] font-extrabold text-blue-900 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                                  {ing.canonicalUom}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Stok Fisik Toko */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${isZero ? 'bg-rose-500 ring-2 ring-rose-200' : isLow ? 'bg-amber-500 ring-2 ring-amber-200' : 'bg-emerald-500 ring-2 ring-emerald-200'}`} />
                              <span className={`text-sm font-black ${isZero ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                                {stockVal.toLocaleString('id-ID')}
                              </span>
                              <span className="text-[11px] text-slate-400 font-semibold">{ing.canonicalUom}</span>
                              {isZero ? (
                                <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                                  Habis
                                </span>
                              ) : isLow ? (
                                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                                  Menipis
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                  Aman
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Gudang Pasokan */}
                          <td className="px-5 py-3.5">
                            {ing.warehouseName ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-extrabold text-indigo-950 text-xs">
                                    {Number(ing.warehouseStock || 0).toLocaleString('id-ID')}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-semibold">{ing.canonicalUom}</span>
                                </div>
                                <span
                                  className="inline-block text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 truncate max-w-[140px]"
                                  title={ing.warehouseName}
                                >
                                  🏭 {ing.warehouseName}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Mandiri (Tanpa Gudang)</span>
                            )}
                          </td>

                          {/* Batas Alert */}
                          <td className="px-4 py-3.5 text-slate-500 font-semibold">
                            <span className="text-xs font-bold text-slate-700">{reorderVal.toLocaleString('id-ID')}</span>{' '}
                            <span className="text-[11px] text-slate-400">{ing.canonicalUom}</span>
                          </td>

                          {/* HPP Satuan */}
                          <td className="px-4 py-3.5 text-right font-bold text-slate-800 whitespace-nowrap">
                            {formatRupiah(ing.averageCost || 0)}
                          </td>

                          {/* Total Nilai Bahan */}
                          <td className="px-4 py-3.5 text-right font-black text-slate-900 whitespace-nowrap">
                            {formatRupiah(Math.max(0, stockVal) * Number(ing.averageCost || 0))}
                          </td>

                          {/* Aksi Cepat */}
                          <td className="px-5 py-3.5 text-right">
                            <div className="inline-flex items-center p-1 bg-slate-100/80 border border-slate-200/80 rounded-xl gap-1 justify-end">
                              {/* Stok Masuk */}
                              <div className="relative group flex items-center">
                                <button
                                  type="button"
                                  onClick={() => openIngredientModal('IN', ing)}
                                  className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 transition-all cursor-pointer"
                                >
                                  <ArrowDownRight className="w-4 h-4" />
                                </button>
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                                  <span className="px-2 py-1 rounded bg-slate-900 text-[10px] font-bold text-white whitespace-nowrap shadow-xl border border-slate-700">
                                    Stok Masuk / Belanja
                                  </span>
                                  <div className="w-1.5 h-1 border-solid border-t-slate-900 border-t-4 border-x-transparent border-x-4 border-b-0" />
                                </div>
                              </div>

                              {/* Stok Keluar / Buang / Rusak */}
                              <div className="relative group flex items-center">
                                <button
                                  type="button"
                                  onClick={() => openIngredientModal('OUT', ing)}
                                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-all cursor-pointer"
                                >
                                  <ArrowUpRight className="w-4 h-4" />
                                </button>
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                                  <span className="px-2 py-1 rounded bg-slate-900 text-[10px] font-bold text-white whitespace-nowrap shadow-xl border border-slate-700">
                                    Stok Keluar / Rusak / Buang
                                  </span>
                                  <div className="w-1.5 h-1 border-solid border-t-slate-900 border-t-4 border-x-transparent border-x-4 border-b-0" />
                                </div>
                              </div>

                              {/* Opname */}
                              <div className="relative group flex items-center">
                                <button
                                  type="button"
                                  onClick={() => openIngredientModal('ADJUST', ing)}
                                  className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-50 hover:text-amber-800 transition-all cursor-pointer"
                                >
                                  <SlidersHorizontal className="w-4 h-4" />
                                </button>
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                                  <span className="px-2 py-1 rounded bg-slate-900 text-[10px] font-bold text-white whitespace-nowrap shadow-xl border border-slate-700">
                                    Stock Opname
                                  </span>
                                  <div className="w-1.5 h-1 border-solid border-t-slate-900 border-t-4 border-x-transparent border-x-4 border-b-0" />
                                </div>
                              </div>

                              {/* Transfer */}
                              {ing.warehouseName && (
                                <div className="relative group flex items-center">
                                  <button
                                    type="button"
                                    onClick={() => openTransferModal(undefined, 'RAW', ing.id)}
                                    className="p-1.5 rounded-lg text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 transition-all cursor-pointer"
                                  >
                                    <ArrowLeftRight className="w-4 h-4" />
                                  </button>
                                  <div className="absolute bottom-full mb-2 right-0 hidden group-hover:flex flex-col items-end pointer-events-none z-30">
                                    <span className="px-2 py-1 rounded bg-slate-900 text-[10px] font-bold text-white whitespace-nowrap shadow-xl border border-slate-700">
                                      Transfer dari {ing.warehouseName}
                                    </span>
                                    <div className="w-1.5 h-1 mr-2 border-solid border-t-slate-900 border-t-4 border-x-transparent border-x-4 border-b-0" />
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bahan Baku Mentah */}
            {!loadingIngredients && filteredIngredients.length > 0 && (
              <TablePagination
                currentPage={safeIngredientPage}
                pageSize={ingredientPageSize}
                totalItems={filteredIngredients.length}
                onPageChange={setIngredientPage}
                onPageSizeChange={setIngredientPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
                itemLabel="bahan"
              />
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PRODUK JADI (RETAIL & SIAP JUAL) */}
      {/* ========================================================================= */}
      {activeTab === 'PRODUCTS' && (
        <div className="space-y-6">
          {/* Action Header & Context */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-blue-900 shrink-0" />
                  <span>Stok Barang Jadi (Retail &amp; Siap Jual)</span>
                </h2>
                {activeOutlet?.isWarehouse ? (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 flex items-center gap-1 shrink-0">
                    <Warehouse className="w-3 h-3 text-indigo-600 shrink-0" />
                    Gudang Pusat: {activeOutlet?.name || 'Gudang Pusat'}
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-200 flex items-center gap-1 shrink-0">
                    <Store className="w-3 h-3 text-blue-800 shrink-0" />
                    Toko: {activeOutlet?.name || 'Utama'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Inventori barang siap jual (merchandise, biji kopi kemasan, minuman kemasan) yang stoknya dipotong otomatis per unit saat kasir memproses pesanan.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full xl:w-auto shrink-0">
              {/* Grouped Single Actions Toolbar */}
              <div className="grid grid-cols-2 sm:flex items-center p-1 bg-slate-100/90 border border-slate-200 rounded-2xl gap-1 w-full sm:w-auto">
                {/* Stok Masuk */}
                <div className="relative group flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => openModal('IN')}
                    className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-bold border border-slate-200/70 hover:border-emerald-200 shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Stok Masuk</span>
                  </button>
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                    <span className="px-2.5 py-1 rounded-md bg-slate-900 text-[10px] font-bold text-white whitespace-nowrap shadow-xl border border-slate-700">
                      Penerimaan stok masuk dari supplier (PO)
                    </span>
                    <div className="w-1.5 h-1 border-solid border-t-slate-900 border-t-4 border-x-transparent border-x-4 border-b-0" />
                  </div>
                </div>

                {/* Transfer */}
                <div className="relative group flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => openTransferModal(undefined, 'PRODUCT')}
                    className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-white hover:bg-teal-50 text-teal-800 text-xs font-bold border border-slate-200/70 hover:border-teal-200 shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span>Transfer</span>
                  </button>
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                    <span className="px-2.5 py-1 rounded-md bg-slate-900 text-[10px] font-bold text-white whitespace-nowrap shadow-xl border border-slate-700">
                      Mutasi transfer stok antar outlet / gudang
                    </span>
                    <div className="w-1.5 h-1 border-solid border-t-slate-900 border-t-4 border-x-transparent border-x-4 border-b-0" />
                  </div>
                </div>

                {/* Stok Rusak */}
                <div className="relative group flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => openModal('OUT')}
                    className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 text-xs font-bold border border-slate-200/70 hover:border-rose-200 shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Stok Rusak</span>
                  </button>
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                    <span className="px-2.5 py-1 rounded-md bg-slate-900 text-[10px] font-bold text-white whitespace-nowrap shadow-xl border border-slate-700">
                      Catat barang rusak, kadaluwarsa, atau sampel
                    </span>
                    <div className="w-1.5 h-1 border-solid border-t-slate-900 border-t-4 border-x-transparent border-x-4 border-b-0" />
                  </div>
                </div>

                {/* Stock Opname */}
                <div className="relative group flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => openModal('ADJUST')}
                    className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-white hover:bg-blue-50 text-slate-800 text-xs font-bold border border-slate-200/70 hover:border-blue-200 shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-blue-900 shrink-0" />
                    <span>Opname</span>
                  </button>
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                    <span className="px-2.5 py-1 rounded-md bg-slate-900 text-[10px] font-bold text-white whitespace-nowrap shadow-xl border border-slate-700">
                      Sesuaikan stok fisik satuan secara manual
                    </span>
                    <div className="w-1.5 h-1 border-solid border-t-slate-900 border-t-4 border-x-transparent border-x-4 border-b-0" />
                  </div>
                </div>
              </div>

              {/* Primary Workspace CTA */}
              <div className="relative group flex items-center w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setBulkOpnameMode('PRODUCTS');
                    setBulkOperation('OPNAME');
                    setBulkOpnameOpen(true);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 active:scale-95 text-white text-xs font-bold shadow-sm shadow-blue-900/25 transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <ClipboardCheck className="w-4 h-4 text-blue-200 shrink-0" />
                  <span>Lembar Kerja Massal</span>
                </button>
                <div className="absolute bottom-full mb-2 right-0 hidden group-hover:flex flex-col items-end pointer-events-none z-30">
                  <span className="px-2.5 py-1 rounded-md bg-slate-900 text-[10px] font-bold text-white whitespace-nowrap shadow-xl border border-slate-700">
                    Input massal Opname, Masuk, Keluar &amp; Transfer
                  </span>
                  <div className="w-1.5 h-1 mr-4 border-solid border-t-slate-900 border-t-4 border-x-transparent border-x-4 border-b-0" />
                </div>
              </div>
            </div>
          </div>

          {/* 4 Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={() => {
                setProductStockFilter('ALL');
                setProductCategoryFilter('ALL');
                setProductSubView('INVENTORY');
              }}
              className={`p-5 bg-white border rounded-3xl shadow-xs transition-all cursor-pointer ${
                productStockFilter === 'ALL' && productSubView === 'INVENTORY'
                  ? 'border-blue-500/50 ring-2 ring-blue-900/10'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Jenis SKU</span>
                <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-900 flex items-center justify-center border border-blue-100">
                  <Boxes className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900">{countAllProducts} SKU</div>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Katalog barang aktif di toko</p>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Fisik Barang</span>
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900">
                {totalStockUnits.toLocaleString('id-ID')} Unit
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Akumulasi seluruh rak display</p>
            </div>

            <div
              onClick={() => {
                setProductStockFilter('LOW');
                setProductSubView('INVENTORY');
              }}
              className={`p-5 bg-white border rounded-3xl shadow-xs transition-all cursor-pointer ${
                productStockFilter === 'LOW' && productSubView === 'INVENTORY'
                  ? 'border-amber-500/50 ring-2 ring-amber-500/10'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Stok Menipis &amp; Kritis</span>
                <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-600">
                  {countLowProducts + countOutProducts}
                </span>
                {countOutProducts > 0 && (
                  <span className="text-xs font-bold text-rose-600">({countOutProducts} habis)</span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Perlu restock atau transfer segera</p>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nilai Aset Stok (HPP)</span>
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                  <ArrowDownRight className="w-4 h-4" />
                </div>
              </div>
              <div className="text-xl font-black text-slate-900 truncate">
                {formatRupiah(totalAssetValue)}
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Modal persediaan toko saat ini</p>
            </div>
          </div>

          {/* Sub-View Switcher: Tab 1 (Daftar Stok Produk Jadi) vs Tab 2 (Riwayat Kartu Stok) */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1 sm:mx-0 sm:px-0 flex-nowrap">
            <button
              type="button"
              onClick={() => setProductSubView('INVENTORY')}
              className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-2 shrink-0 whitespace-nowrap ${
                productSubView === 'INVENTORY'
                  ? 'bg-blue-900 text-white shadow-md shadow-blue-950/20'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Package className="w-4 h-4 shrink-0" />
              <span>Daftar Stok Produk Jadi</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                  productSubView === 'INVENTORY' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {filteredProducts.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setProductSubView('MOVEMENTS')}
              className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-2 shrink-0 whitespace-nowrap ${
                productSubView === 'MOVEMENTS'
                  ? 'bg-blue-900 text-white shadow-md shadow-blue-950/20'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>Riwayat Kartu Stok (Audit Mutasi)</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                  productSubView === 'MOVEMENTS' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {movements.length}
              </span>
            </button>
          </div>

          {/* TAB CONTENT A: TABEL INVENTORI PRODUK JADI */}
          {productSubView === 'INVENTORY' && (
            <div className="space-y-4">
              {/* Filter, Search & Quick Chips Toolbar */}
              <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs space-y-3.5">
                <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                  <div className="flex flex-col sm:flex-row items-center gap-3 flex-1">
                    <div className="relative w-full sm:w-72">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Cari produk jadi (nama, SKU, barcode)..."
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all outline-none"
                      />
                    </div>

                    {/* Dropdown Kategori Murni (Menampilkan Semua Kategori Termasuk yang 0 Produk) */}
                    {categoriesWithCounts.length > 0 && (
                      <div className="relative w-full sm:w-auto">
                        <select
                          value={productCategoryFilter}
                          onChange={(e) => setProductCategoryFilter(e.target.value)}
                          className="w-full sm:w-auto appearance-none pr-9 pl-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 hover:bg-slate-100/60 focus:bg-white focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 outline-none cursor-pointer transition-all"
                        >
                          <option value="ALL">Semua Kategori ({products.length})</option>
                          {categoriesWithCounts.map((cat) => (
                            <option key={cat.name} value={cat.name}>
                              {cat.name} ({cat.count})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 font-bold px-2 self-end md:self-auto">
                    Menampilkan{' '}
                    <span className="text-blue-900 font-black">
                      {filteredProducts.length === 0 ? '0' : `${startProductIndex}-${endProductIndex}`}
                    </span>{' '}
                    dari {products.length} produk
                  </div>
                </div>

                {/* Quick Status Chips */}
                <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">Status Stok:</span>
                  <button
                    type="button"
                    onClick={() => setProductStockFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                      productStockFilter === 'ALL'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>Semua Produk</span>
                    <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[10px]">{countAllProducts}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProductStockFilter('LOW')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                      productStockFilter === 'LOW'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Menipis</span>
                    <span className="px-1.5 py-0.2 rounded-md bg-amber-900/20 text-[10px] font-extrabold">{countLowProducts}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProductStockFilter('OUT')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                      productStockFilter === 'OUT'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    <span>Habis (0)</span>
                    <span className="px-1.5 py-0.2 rounded-md bg-rose-900/20 text-[10px] font-extrabold">{countOutProducts}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProductStockFilter('SAFE')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                      productStockFilter === 'SAFE'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Stok Aman</span>
                    <span className="px-1.5 py-0.2 rounded-md bg-emerald-900/20 text-[10px] font-extrabold">{countSafeProducts}</span>
                  </button>
                </div>
              </div>

              {/* Tabel Daftar Produk Jadi */}
              <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50/90 text-[11px] font-black uppercase text-slate-500 border-b border-slate-200 tracking-wider">
                      <tr>
                        <th className="px-5 py-3.5 pl-6 min-w-[240px] whitespace-nowrap">Produk &amp; SKU</th>
                        <th className="px-4 py-3.5 w-36 text-center whitespace-nowrap">Kategori</th>
                        <th className="px-5 py-3.5 w-44 text-center whitespace-nowrap">Stok Fisik Toko</th>
                        <th className="px-4 py-3.5 w-36 text-right whitespace-nowrap">Harga Modal (HPP)</th>
                        <th className="px-4 py-3.5 w-36 text-right whitespace-nowrap">Nilai Aset Stok</th>
                        <th className="px-4 py-3.5 w-36 text-right whitespace-nowrap">Harga Jual</th>
                        <th className="px-4 py-3.5 pr-6 w-40 text-center whitespace-nowrap">Aksi Mutasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {loading ? (
                        <TableSkeleton rows={5} columns={7} actionCol />
                      ) : filteredProducts.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-14 text-center text-slate-400">
                            <Boxes className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                            <p className="text-sm font-bold text-slate-700">
                              {products.length === 0
                                ? 'Belum Ada Katalog Produk Terdaftar'
                                : 'Tidak Ada Produk Sesuai Filter'}
                            </p>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                              {products.length === 0
                                ? 'Silakan tambahkan produk baru melalui menu "Katalog & Menu" atau lakukan penerimaan stok masuk pertama.'
                                : 'Coba ubah kata kunci pencarian atau atur ulang filter status stok.'}
                            </p>
                            {products.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setProductSearch('');
                                  setProductCategoryFilter('ALL');
                                  setProductStockFilter('ALL');
                                }}
                                className="mt-3 px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Reset Semua Filter</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ) : (
                        paginatedProducts.map((p) => {
                          const isComposite = p.productType === 'COMPOSITE' || p.hasStock === false;
                          const stockVal = isComposite ? 0 : Number(p.stock || 0);
                          const minAlert = Number(p.minStockAlert || 5);
                          const isZero = stockVal <= 0;
                          const isLow = stockVal > 0 && stockVal <= minAlert;
                          const totalVal = isComposite ? 0 : stockVal * Number(p.costPrice || 0);

                          return (
                            <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                              {/* Produk & SKU */}
                              <td className="px-5 py-3.5 pl-6">
                                <div className="flex items-center gap-3">
                                  {p.imageUrl ? (
                                    <img
                                      src={p.imageUrl}
                                      alt={p.name}
                                      className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0 font-black text-xs">
                                      {p.name.slice(0, 2).toUpperCase()}
                                    </div>
                                  )}
                                  <div className="space-y-1 min-w-0">
                                    <span className="font-extrabold text-slate-900 text-sm block leading-tight">
                                      {p.name}
                                    </span>
                                    <div className="flex items-center flex-wrap gap-1.5">
                                      <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200/80 px-1.5 py-0.5 rounded-md">
                                        SKU: {p.sku || '-'}
                                      </span>
                                      {p.barcode && (
                                        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-500 bg-slate-50 border border-slate-200/70 px-1.5 py-0.5 rounded-md" title={`Barcode: ${p.barcode}`}>
                                          <Barcode className="w-3 h-3 text-slate-400" />
                                          <span>{p.barcode}</span>
                                        </span>
                                      )}
                                      <span className="text-[10px] font-extrabold text-blue-800 bg-blue-50 border border-blue-200/70 px-1.5 py-0.5 rounded-md">
                                        {p.unit || 'Pcs'}
                                      </span>
                                      {isComposite && (
                                        <span className="text-[10px] font-extrabold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                                          ✨ Olahan BOM
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Kategori */}
                              <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                <span className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-900 font-bold text-[10px] border border-blue-200 whitespace-nowrap inline-block">
                                  {p.category?.name || 'Umum'}
                                </span>
                              </td>

                              {/* Stok Fisik & Status */}
                              <td className="px-5 py-3.5 text-center whitespace-nowrap">
                                {isComposite ? (
                                  <div className="flex flex-col items-center justify-center gap-0.5 whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200/90 font-extrabold text-[11px] shadow-2xs whitespace-nowrap">
                                      <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                      <span>Olahan Dapur (BOM)</span>
                                    </span>
                                    <span className="text-[10px] text-amber-700/80 font-semibold whitespace-nowrap">
                                      Kalkulasi Resep
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                                    <span
                                      className={`w-2 h-2 rounded-full shrink-0 ${
                                        isZero
                                          ? 'bg-rose-500 ring-2 ring-rose-200'
                                          : isLow
                                          ? 'bg-amber-500 ring-2 ring-amber-200'
                                          : 'bg-emerald-500 ring-2 ring-emerald-200'
                                      }`}
                                    />
                                    <span
                                      className={`text-sm font-black whitespace-nowrap ${
                                        isZero
                                          ? 'text-rose-600'
                                          : isLow
                                          ? 'text-amber-600'
                                          : 'text-slate-900'
                                      }`}
                                    >
                                      {stockVal.toLocaleString('id-ID')}
                                    </span>
                                    <span className="text-[11px] text-slate-400 font-semibold whitespace-nowrap">
                                      {p.unit || 'Unit'}
                                    </span>
                                    {isZero ? (
                                      <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold whitespace-nowrap">
                                        Habis
                                      </span>
                                    ) : isLow ? (
                                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold whitespace-nowrap">
                                        Menipis
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold whitespace-nowrap">
                                        Aman
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* Harga Modal HPP */}
                              <td className="px-4 py-3.5 text-right font-bold text-slate-700 whitespace-nowrap">
                                {formatRupiah(p.costPrice || 0)}
                              </td>

                              {/* Nilai Aset Stok */}
                              <td className="px-4 py-3.5 text-right font-black text-slate-900 whitespace-nowrap">
                                {isComposite ? '-' : formatRupiah(totalVal)}
                              </td>

                              {/* Harga Jual */}
                              <td className="px-4 py-3.5 text-right font-black text-blue-900 whitespace-nowrap">
                                {formatRupiah(p.basePrice || p.price || 0)}
                              </td>

                              {/* Aksi Mutasi */}
                              <td className="px-4 py-3.5 pr-6 text-center whitespace-nowrap">
                                {isComposite ? (
                                  <div className="flex items-center justify-center whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveTab('INGREDIENTS');
                                        dialog.toast(`"${p.name}" adalah menu olahan dapur. Mutasi persediaan (kulakan/rusak/opname) dikelola melalui tab Bahan Baku.`, 'info');
                                      }}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50/80 hover:bg-amber-100 text-amber-900 border border-amber-200/90 font-bold text-xs transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 whitespace-nowrap"
                                      title="Menu olahan dapur dihitung dari bahan baku. Klik untuk beralih ke tab Bahan Baku."
                                    >
                                      <Boxes className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                      <span>Via Bahan Baku</span>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center p-1 bg-slate-100/80 border border-slate-200/80 rounded-xl gap-1 justify-center whitespace-nowrap">
                                    {/* Stok Masuk */}
                                    <div className="relative group flex items-center">
                                      <button
                                        type="button"
                                        onClick={() => openModal('IN', p)}
                                        className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 transition-all cursor-pointer"
                                      >
                                        <ArrowDownRight className="w-4 h-4" />
                                      </button>
                                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                                        <span className="px-2 py-1 rounded bg-slate-900 text-[10px] font-bold text-white whitespace-nowrap shadow-xl border border-slate-700">
                                          Stok Masuk (PO)
                                        </span>
                                        <div className="w-1.5 h-1 border-solid border-t-slate-900 border-t-4 border-x-transparent border-x-4 border-b-0" />
                                      </div>
                                    </div>

                                    {/* Transfer */}
                                    <div className="relative group flex items-center">
                                      <button
                                        type="button"
                                        onClick={() => openTransferModal(undefined, 'PRODUCT', p.id)}
                                        className="p-1.5 rounded-lg text-teal-700 hover:bg-teal-50 hover:text-teal-800 transition-all cursor-pointer"
                                      >
                                        <ArrowLeftRight className="w-4 h-4" />
                                      </button>
                                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                                        <span className="px-2 py-1 rounded bg-slate-900 text-[10px] font-bold text-white whitespace-nowrap shadow-xl border border-slate-700">
                                          Transfer Toko
                                        </span>
                                        <div className="w-1.5 h-1 border-solid border-t-slate-900 border-t-4 border-x-transparent border-x-4 border-b-0" />
                                      </div>
                                    </div>

                                    {/* Stok Rusak */}
                                    <div className="relative group flex items-center">
                                      <button
                                        type="button"
                                        onClick={() => openModal('OUT', p)}
                                        className="p-1.5 rounded-lg text-rose-700 hover:bg-rose-50 hover:text-rose-800 transition-all cursor-pointer"
                                      >
                                        <ArrowUpRight className="w-4 h-4" />
                                      </button>
                                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                                        <span className="px-2 py-1 rounded bg-slate-900 text-[10px] font-bold text-white whitespace-nowrap shadow-xl border border-slate-700">
                                          Stok Rusak
                                        </span>
                                        <div className="w-1.5 h-1 border-solid border-t-slate-900 border-t-4 border-x-transparent border-x-4 border-b-0" />
                                      </div>
                                    </div>

                                    {/* Stock Opname */}
                                    <div className="relative group flex items-center">
                                      <button
                                        type="button"
                                        onClick={() => openModal('ADJUST', p)}
                                        className="p-1.5 rounded-lg text-blue-900 hover:bg-blue-50 hover:text-blue-950 transition-all cursor-pointer"
                                      >
                                        <SlidersHorizontal className="w-4 h-4" />
                                      </button>
                                      <div className="absolute bottom-full mb-2 right-0 hidden group-hover:flex flex-col items-end pointer-events-none z-30">
                                        <span className="px-2 py-1 rounded bg-slate-900 text-[10px] font-bold text-white whitespace-nowrap shadow-xl border border-slate-700">
                                          Stock Opname
                                        </span>
                                        <div className="w-1.5 h-1 mr-2 border-solid border-t-slate-900 border-t-4 border-x-transparent border-x-4 border-b-0" />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Produk Jadi */}
                {!loading && filteredProducts.length > 0 && (
                  <TablePagination
                    currentPage={safeProductPage}
                    pageSize={productPageSize}
                    totalItems={filteredProducts.length}
                    onPageChange={setProductPage}
                    onPageSizeChange={setProductPageSize}
                    pageSizeOptions={[10, 25, 50, 100]}
                    itemLabel="produk"
                  />
                )}
              </div>
            </div>
          )}

          {/* TAB CONTENT B: RIWAYAT KARTU STOK (AUDIT MUTASI) */}
          {productSubView === 'MOVEMENTS' && (
            <div className="space-y-4">
              {/* Search & Filter Toolbar */}
              <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">
                    Audit Trail Mutasi Stok Produk
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">
                    Setiap penambahan atau pengurangan stok tercatat otomatis untuk keperluan verifikasi dan audit
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <form onSubmit={handleSearchSubmit} className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={movementSearch}
                      onChange={(e) => setMovementSearch(e.target.value)}
                      placeholder="Cari SKU, produk, PO..."
                      className="pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:bg-white focus:border-blue-900 w-44 sm:w-56 font-medium text-slate-800"
                    />
                  </form>

                  <div className="relative">
                    <select
                      value={movementTypeFilter}
                      onChange={(e) => setMovementTypeFilter(e.target.value)}
                      className="appearance-none py-2 pr-8 pl-3 text-xs bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 font-bold focus:outline-none focus:bg-white focus:border-blue-900 cursor-pointer"
                    >
                      <option value="ALL">Semua Mutasi</option>
                      <option value="PURCHASE_IN">Stok Masuk (PO)</option>
                      <option value="TRANSFER_IN">Mutasi Masuk Toko</option>
                      <option value="TRANSFER_OUT">Mutasi Keluar Toko</option>
                      <option value="SALE_OUT">Penjualan Kasir</option>
                      <option value="DAMAGE_OUT">Barang Rusak</option>
                      <option value="ADJUSTMENT">Stock Opname</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Tabel Riwayat Kartu Stok */}
              <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/90 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                        <th className="py-3.5 px-4 pl-6 whitespace-nowrap">Waktu</th>
                        <th className="py-3.5 px-4 min-w-[180px]">Nama Produk</th>
                        <th className="py-3.5 px-4 whitespace-nowrap">Tipe Mutasi</th>
                        <th className="py-3.5 px-4 text-right whitespace-nowrap">Perubahan Qty</th>
                        <th className="py-3.5 px-4 whitespace-nowrap">Petugas (PIC)</th>
                        <th className="py-3.5 px-4 pr-6 whitespace-nowrap">Keterangan / Catatan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                      {loading ? (
                        <TableSkeleton rows={5} columns={6} />
                      ) : movements.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            <EmptyState
                              icon={<FileSpreadsheet className="w-7 h-7 text-blue-900" />}
                              title="Belum Ada Riwayat Mutasi Stok"
                              description="Transaksi bahan baku masuk, penjualan di kasir, atau penyesuaian opname stok akan otomatis tercatat di sini."
                            />
                          </td>
                        </tr>
                      ) : (
                        paginatedMovements.map((m) => {
                          const badge = getBadgeType(m.type);
                          const isPositive = m.quantity > 0;
                          const formattedQty = Number(m.quantity || 0).toLocaleString('id-ID', { maximumFractionDigits: 2 });

                          return (
                            <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                              {/* Waktu */}
                              <td className="py-3.5 px-4 pl-6 text-xs text-slate-500 whitespace-nowrap font-medium">
                                {new Date(m.createdAt).toLocaleString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>

                              {/* Produk */}
                              <td className="py-3.5 px-4">
                                <div className="font-extrabold text-slate-900 text-xs sm:text-sm">
                                  {m.product?.name || 'Item Terhapus / Bahan Mentah'}
                                </div>
                                <div className="font-mono text-[11px] text-slate-400 font-semibold">{m.product?.sku || '-'}</div>
                              </td>

                              {/* Tipe Mutasi */}
                              <td className="py-3.5 px-4">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${badge.color}`}>
                                  {badge.label}
                                </span>
                              </td>

                              {/* Qty Perubahan */}
                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                <span
                                  className={`font-mono font-extrabold text-sm ${
                                    isPositive ? 'text-emerald-700' : 'text-rose-600'
                                  }`}
                                >
                                  {isPositive ? `+${formattedQty}` : formattedQty} {m.product?.unit || 'PCS'}
                                </span>
                              </td>

                              {/* Petugas */}
                              <td className="py-3.5 px-4 text-xs font-bold text-slate-700">
                                {m.user?.name || 'Sistem / Otomatis'}
                              </td>

                              {/* Catatan */}
                              <td className="py-3.5 px-4 pr-6 text-xs text-slate-600 max-w-xs truncate">
                                {m.notes || '-'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Kartu Stok */}
                {!loading && movements.length > 0 && (
                  <TablePagination
                    currentPage={safeMovementPage}
                    pageSize={movementPageSize}
                    totalItems={movements.length}
                    onPageChange={setMovementPage}
                    onPageSizeChange={setMovementPageSize}
                    pageSizeOptions={[10, 25, 50, 100]}
                    itemLabel="mutasi"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}





      {/* ========================================================================= */}
      {/* MODAL: TRANSAKSI MUTASI STOK (PO MASUK, RUSAK, OPNAME) */}
      {/* ========================================================================= */}
      <StockMovementModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedIngredient(null);
        }}
        onSuccess={() => {
          fetchInventory();
          fetchIngredients();
          fetchAllOutlets();
        }}
        products={products}
        defaultProduct={selectedProduct}
        defaultIngredient={selectedIngredient}
        defaultType={modalType}
        outletId={targetModalOutletId || activeOutlet?.id}
      />

      {/* ========================================================================= */}
      {/* LEMBAR KERJA KHUSUS: INVENTORI MASSAL (FULL SCREEN WORKSPACE) */}
      {/* ========================================================================= */}
      <FullScreenBulkOpnameModal
        isOpen={bulkOpnameOpen}
        onClose={() => setBulkOpnameOpen(false)}
        onSuccess={(msg) => {
          fetchInventory();
          fetchIngredients();
          fetchAllOutlets();
          dialog.toast(msg || 'Aktivitas inventori massal berhasil dicatat ke sistem!', 'success');
        }}
        activeOutlet={activeOutlet}
        initialMode={bulkOpnameMode}
        initialOperation={bulkOperation}
        products={products}
        categories={categories}
        ingredients={ingredients}
        outlets={allOutlets}
      />

      {/* ========================================================================= */}
      {/* MODAL: TRANSFER STOK ANTAR TOKO / GUDANG */}
      {/* ========================================================================= */}
      <StockTransferModal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        onSuccess={() => {
          fetchInventory();
          fetchAllOutlets();
          fetchIngredients();
        }}
        activeOutlet={activeOutlet}
        defaultSourceOutletId={transferSourceOutletId}
        defaultItemType={transferDefaultItemType}
        defaultInventoryItemId={transferDefaultItemId}
        products={products}
      />

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH MASTER BAHAN BAKU BARU */}
      {/* ========================================================================= */}
      <CreateIngredientModal
        isOpen={createIngredientModalOpen}
        onClose={() => setCreateIngredientModalOpen(false)}
        outletId={activeOutlet?.id}
        onSuccess={() => {
          fetchIngredients();
          fetchInventory();
        }}
      />


      {/* Modal: Detail Batch Kadaluarsa */}
      {showExpiryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 text-amber-700 rounded-2xl border border-amber-200">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Batch Bahan Baku Mendekati Kadaluarsa
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Daftar persediaan fisik dengan tanggal kedaluwarsa &le; 30 hari
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExpiryModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-extrabold text-slate-500 uppercase border-b border-slate-200">
                      <th className="py-2.5 px-3">Bahan Baku</th>
                      <th className="py-2.5 px-3">No. Batch</th>
                      <th className="py-2.5 px-3">Tgl Kadaluarsa</th>
                      <th className="py-2.5 px-3 text-right">Sisa Stok</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expiryAlerts.map((batch) => {
                      const expDate = new Date(batch.expirationDate);
                      const isExpired = expDate.getTime() < Date.now();
                      const totalStock = (batch.balances || []).reduce(
                        (sum, b) => sum + (b.quantityOnHand || 0),
                        0
                      );

                      return (
                        <tr key={batch.id} className="hover:bg-slate-50/60">
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-900 block">
                              {batch.inventoryItem?.name || 'Bahan Baku'}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {batch.inventoryItem?.itemCode || '-'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-slate-800">
                            {batch.batchNumber}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-700">
                            {expDate.toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-3 px-3 text-right font-extrabold text-slate-900">
                            {totalStock} {batch.inventoryItem?.canonicalUom || ''}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {isExpired ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                Sudah Lewat
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                Segera Habis
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowExpiryModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
