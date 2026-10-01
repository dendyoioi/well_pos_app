import React, { useState, useEffect } from 'react';
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
  MapPin,
  Phone,
  Edit3,
  X,
  Info,
  Package,
  CheckCircle2,
  ClipboardCheck,
  ChevronDown,
  Barcode,
} from 'lucide-react';
import type { Product, StockMovement } from '../types/product';
import type { Outlet } from '../types/outlet';
import type { RecipeInventoryItem } from '../types/recipe';
import type { ExpiryAlertBatch } from '../types/purchasing';
import { StockMovementModal } from '../components/StockMovementModal';
import { StockTransferModal } from '../components/StockTransferModal';
import { CreateIngredientModal } from '../components/modals/CreateIngredientModal';
import { FullScreenBulkOpnameModal, type BulkOperationType } from '../components/FullScreenBulkOpnameModal';
import { TablePagination } from '../components/TablePagination';
import { formatRupiah } from '../utils/currency';
import { api } from '../services/api';

interface InventoryViewProps {
  activeOutlet?: Outlet | null;
  initialTab?: 'INGREDIENTS' | 'PRODUCTS' | 'WAREHOUSES';
  initialSubView?: 'INVENTORY' | 'MOVEMENTS';
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  activeOutlet,
  initialTab = 'INGREDIENTS',
  initialSubView = 'INVENTORY',
}) => {
  // Tab State: 'INGREDIENTS' (Bahan Baku Mentah F&B) | 'PRODUCTS' (Produk Jadi Retail) | 'WAREHOUSES' (Kelola Gudang)
  const [activeTab, setActiveTab] = useState<'INGREDIENTS' | 'PRODUCTS' | 'WAREHOUSES'>(initialTab);

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

  // Warehouses State
  const [warehouses, setWarehouses] = useState<Outlet[]>([]);
  const [warehouseStats, setWarehouseStats] = useState<
    Record<string, { totalSku: number; totalUnits: number; totalAssetValue: number }>
  >({});
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);

  // Warehouse Modal State
  const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Outlet | null>(null);
  const [warehouseForm, setWarehouseForm] = useState({ name: '', address: '', phone: '' });
  const [savingWarehouse, setSavingWarehouse] = useState(false);

  // Stock Movement & Transfer Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'IN' | 'OUT' | 'ADJUST'>('IN');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [targetModalOutletId, setTargetModalOutletId] = useState<string | undefined>(undefined);
  const [transferSourceOutletId, setTransferSourceOutletId] = useState<string | undefined>(undefined);
  const [transferDefaultItemType, setTransferDefaultItemType] = useState<'RAW' | 'PRODUCT'>('RAW');
  const [transferDefaultItemId, setTransferDefaultItemId] = useState<string | undefined>(undefined);

  // Warehouse Raw Inventory Detail Modal
  const [viewingWarehouse, setViewingWarehouse] = useState<Outlet | null>(null);
  const [warehouseDetailItems, setWarehouseDetailItems] = useState<RecipeInventoryItem[]>([]);
  const [loadingWarehouseDetails, setLoadingWarehouseDetails] = useState<boolean>(false);
  const [warehouseDetailSearch, setWarehouseDetailSearch] = useState<string>('');

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const [prodRes, movRes] = await Promise.all([
        api.getProducts({ outletId: activeOutlet?.id }),
        api.getStockMovements({
          outletId: activeOutlet?.id,
          limit: 100,
          search: movementSearch.trim() || undefined,
          type: movementTypeFilter !== 'ALL' ? movementTypeFilter : undefined,
        }),
      ]);

      if (prodRes.status === 'success') setProducts(prodRes.data);
      if (movRes.status === 'success') setMovements(movRes.data);
    } catch (err) {
      console.error('Gagal mengambil data inventori:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    setLoadingWarehouses(true);
    try {
      const res = await api.getOutlets();
      if (res.status === 'success' && res.data) {
        setAllOutlets(res.data);
        const whList = res.data.filter((o: Outlet) => o.isWarehouse);
        setWarehouses(whList);

        // Ambil data statistik per gudang secara paralel (Bahan Baku & Produk Retail)
        const statsMap: Record<string, { totalSku: number; totalUnits: number; totalAssetValue: number }> = {};
        await Promise.all(
          whList.map(async (wh: Outlet) => {
            try {
              const [pRes, rawRes] = await Promise.all([
                api.getProducts({ outletId: wh.id }).catch(() => ({ status: 'error', data: [] as Product[] })),
                api.getRecipeInventoryItems(wh.id, 'all').catch(() => ({ status: 'error', data: [] as RecipeInventoryItem[] })),
              ]);

              let totalSku = 0;
              let totalUnits = 0;
              let totalAssetValue = 0;

              if (pRes.status === 'success' && pRes.data) {
                const activeWithStock = pRes.data.filter((p: Product) => p.stock > 0);
                totalSku += activeWithStock.length;
                totalUnits += pRes.data.reduce((sum: number, p: Product) => sum + p.stock, 0);
                totalAssetValue += pRes.data.reduce((sum: number, p: Product) => sum + p.costPrice * p.stock, 0);
              }

              if (rawRes.status === 'success' && rawRes.data) {
                const activeRaw = rawRes.data.filter((r: RecipeInventoryItem) => (r.stock ?? r.warehouseStock ?? 0) > 0);
                totalSku += activeRaw.length;
                totalUnits += rawRes.data.reduce((sum: number, r: RecipeInventoryItem) => sum + (r.stock ?? r.warehouseStock ?? 0), 0);
                totalAssetValue += rawRes.data.reduce((sum: number, r: RecipeInventoryItem) => sum + (r.averageCost || 0) * (r.stock ?? r.warehouseStock ?? 0), 0);
              }

              statsMap[wh.id] = {
                totalSku,
                totalUnits,
                totalAssetValue,
              };
            } catch (e) {
              console.error('Error fetching stats for warehouse', wh.id, e);
            }
          })
        );
        setWarehouseStats(statsMap);
      }
    } catch (err) {
      console.error('Gagal mengambil data gudang:', err);
    } finally {
      setLoadingWarehouses(false);
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
    fetchWarehouses();
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

  const openWarehouseDetail = async (wh: Outlet) => {
    setViewingWarehouse(wh);
    setWarehouseDetailSearch('');
    setLoadingWarehouseDetails(true);
    try {
      const res = await api.getRecipeInventoryItems(wh.id, 'all');
      if (res.status === 'success' && res.data) {
        setWarehouseDetailItems(res.data);
      } else {
        setWarehouseDetailItems([]);
      }
    } catch (err) {
      console.error('Gagal mengambil rincian bahan baku gudang:', err);
      setWarehouseDetailItems([]);
    } finally {
      setLoadingWarehouseDetails(false);
    }
  };

  const openCreateWarehouseModal = () => {
    setEditingWarehouse(null);
    setWarehouseForm({ name: '', address: '', phone: '' });
    setWarehouseModalOpen(true);
  };

  const openEditWarehouseModal = (wh: Outlet) => {
    setEditingWarehouse(wh);
    setWarehouseForm({
      name: wh.name,
      address: wh.address || '',
      phone: wh.phone || '',
    });
    setWarehouseModalOpen(true);
  };

  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseForm.name.trim()) return;
    setSavingWarehouse(true);
    try {
      if (editingWarehouse) {
        await api.updateOutlet(editingWarehouse.id, {
          name: warehouseForm.name,
          address: warehouseForm.address,
          phone: warehouseForm.phone,
        });
      } else {
        await api.createOutlet({
          name: warehouseForm.name,
          address: warehouseForm.address,
          phone: warehouseForm.phone,
          isWarehouse: true,
        });
      }
      setWarehouseModalOpen(false);
      setEditingWarehouse(null);
      setWarehouseForm({ name: '', address: '', phone: '' });
      await fetchWarehouses();
    } catch (err) {
      console.error('Gagal menyimpan gudang:', err);
    } finally {
      setSavingWarehouse(false);
    }
  };

  // Kalkulasi total statistik tab overview
  const totalStockUnits = products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
  const totalAssetValue = products.reduce(
    (acc, p) => acc + (Number(p.costPrice) || 0) * Math.max(0, Number(p.stock) || 0),
    0
  );

  const countAllProducts = products.length;
  const countOutProducts = products.filter((p) => Number(p.stock || 0) <= 0).length;
  const countLowProducts = products.filter((p) => {
    const s = Number(p.stock || 0);
    const minAlert = Number(p.minStockAlert || 5);
    return s > 0 && s <= minAlert;
  }).length;
  const countSafeProducts = products.filter((p) => {
    const s = Number(p.stock || 0);
    const minAlert = Number(p.minStockAlert || 5);
    return s > minAlert;
  }).length;

  // Kalkulasi total inventori gudang logistik
  const totalWarehouseUnits = Object.values(warehouseStats).reduce((sum, s) => sum + (s.totalUnits || 0), 0);
  const totalWarehouseAssets = Object.values(warehouseStats).reduce((sum, s) => sum + (s.totalAssetValue || 0), 0);
  const totalWarehouseSku = Object.values(warehouseStats).reduce((sum, s) => sum + (s.totalSku || 0), 0);

  // Kategori unik untuk filter produk jadi
  const uniqueCategories = Array.from(
    new Set(products.map((p) => p.category?.name).filter(Boolean))
  ) as string[];

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
      return p.stock <= 0;
    }
    if (productStockFilter === 'LOW') {
      return p.stock > 0 && p.stock <= (p.minStockAlert || 5);
    }
    if (productStockFilter === 'SAFE') {
      return p.stock > (p.minStockAlert || 5);
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

          <button
            onClick={() => {
              setActiveTab('WAREHOUSES');
              fetchWarehouses();
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer relative whitespace-nowrap shrink-0 ${
              activeTab === 'WAREHOUSES'
                ? 'bg-blue-900 text-white shadow-md shadow-blue-950/20'
                : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Warehouse className="w-4 h-4 shrink-0" />
            <span>Kelola Gudang &amp; Lokasi Stok</span>
            {warehouses.length > 0 && (
              <span
                className={`px-2 py-0.5 text-[10px] font-black rounded-full shrink-0 ${
                  activeTab === 'WAREHOUSES'
                    ? 'bg-white/25 text-white'
                    : 'bg-indigo-100 text-indigo-800'
                }`}
              >
                {warehouses.length}
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
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Bahan Terdaftar</span>
                <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-900 flex items-center justify-center border border-blue-100">
                  <Package className="w-4 h-4" />
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
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Stok Menipis &amp; Kritis</span>
                <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                  <AlertTriangle className="w-4 h-4" />
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
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Estimasi Nilai Aset Bahan</span>
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                  <Boxes className="w-4 h-4" />
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
                    <th className="px-5 py-3.5">Bahan Baku &amp; SKU</th>
                    <th className="px-5 py-3.5">Stok Fisik Toko</th>
                    <th className="px-5 py-3.5">Gudang Pasokan</th>
                    <th className="px-4 py-3.5">Batas Alert</th>
                    <th className="px-5 py-3.5">HPP Rata-rata</th>
                    <th className="px-5 py-3.5">Estimasi Nilai</th>
                    <th className="px-5 py-3.5 text-right">Aksi Cepat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {loadingIngredients ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                        <RefreshCw className="w-7 h-7 animate-spin mx-auto text-blue-900 mb-2" />
                        <span className="font-semibold text-slate-600">Memuat data inventori bahan baku...</span>
                      </td>
                    </tr>
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
                          <td className="px-5 py-3.5 font-bold text-slate-800">
                            {formatRupiah(ing.averageCost || 0)}
                          </td>

                          {/* Total Nilai Bahan */}
                          <td className="px-5 py-3.5 font-bold text-slate-900">
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

                    {/* Kategori Filter */}
                    {uniqueCategories.length > 0 && (
                      <div className="relative w-full sm:w-auto">
                        <select
                          value={productCategoryFilter}
                          onChange={(e) => setProductCategoryFilter(e.target.value)}
                          className="w-full sm:w-auto appearance-none pr-9 pl-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 hover:bg-slate-100/60 focus:bg-white focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 outline-none cursor-pointer transition-all"
                        >
                          <option value="ALL">Semua Kategori ({products.length})</option>
                          {uniqueCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
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
                        <th className="px-5 py-3.5 pl-6 min-w-[240px]">Produk &amp; SKU</th>
                        <th className="px-4 py-3.5 w-28 text-center">Kategori</th>
                        <th className="px-5 py-3.5 w-44 text-center">Stok Fisik Toko</th>
                        <th className="px-4 py-3.5 w-32 text-right">Harga Modal (HPP)</th>
                        <th className="px-4 py-3.5 w-32 text-right">Nilai Aset Stok</th>
                        <th className="px-4 py-3.5 w-32 text-right">Harga Jual</th>
                        <th className="px-4 py-3.5 pr-6 w-36 text-center">Aksi Mutasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <RefreshCw className="w-7 h-7 animate-spin mx-auto text-blue-900 mb-1" />
                              <span className="font-semibold text-slate-600">Memuat stok produk jadi...</span>
                            </div>
                          </td>
                        </tr>
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
                          const stockVal = Number(p.stock || 0);
                          const minAlert = Number(p.minStockAlert || 5);
                          const isZero = stockVal <= 0;
                          const isLow = stockVal > 0 && stockVal <= minAlert;
                          const totalVal = stockVal * Number(p.costPrice || 0);

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
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Kategori */}
                              <td className="px-4 py-3.5 text-center">
                                <span className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-900 font-bold text-[10px] border border-blue-200">
                                  {p.category?.name || 'Umum'}
                                </span>
                              </td>

                              {/* Stok Fisik & Status */}
                              <td className="px-5 py-3.5 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <span
                                    className={`w-2 h-2 rounded-full ${
                                      isZero
                                        ? 'bg-rose-500 ring-2 ring-rose-200'
                                        : isLow
                                        ? 'bg-amber-500 ring-2 ring-amber-200'
                                        : 'bg-emerald-500 ring-2 ring-emerald-200'
                                    }`}
                                  />
                                  <span
                                    className={`text-sm font-black ${
                                      isZero
                                        ? 'text-rose-600'
                                        : isLow
                                        ? 'text-amber-600'
                                        : 'text-slate-900'
                                    }`}
                                  >
                                    {stockVal.toLocaleString('id-ID')}
                                  </span>
                                  <span className="text-[11px] text-slate-400 font-semibold">
                                    {p.unit || 'Unit'}
                                  </span>
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

                              {/* Harga Modal HPP */}
                              <td className="px-4 py-3.5 text-right font-bold text-slate-700">
                                {formatRupiah(p.costPrice || 0)}
                              </td>

                              {/* Nilai Aset Stok */}
                              <td className="px-4 py-3.5 text-right font-black text-slate-900">
                                {formatRupiah(totalVal)}
                              </td>

                              {/* Harga Jual */}
                              <td className="px-4 py-3.5 text-right font-black text-blue-900">
                                {formatRupiah(p.basePrice || p.price || 0)}
                              </td>

                              {/* Aksi Mutasi */}
                              <td className="px-4 py-3.5 pr-6 text-center">
                                <div className="inline-flex items-center p-1 bg-slate-100/80 border border-slate-200/80 rounded-xl gap-1 justify-center">
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
                        <th className="py-3.5 px-4 pl-6">Waktu</th>
                        <th className="py-3.5 px-4">Nama Produk</th>
                        <th className="py-3.5 px-4">Tipe Mutasi</th>
                        <th className="py-3.5 px-4 text-right">Perubahan Qty</th>
                        <th className="py-3.5 px-4">Petugas (PIC)</th>
                        <th className="py-3.5 px-4 pr-6">Keterangan / Catatan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <RefreshCw className="w-7 h-7 animate-spin mx-auto text-blue-900 mb-1" />
                              <span className="font-semibold text-slate-600">Memuat riwayat kartu stok...</span>
                            </div>
                          </td>
                        </tr>
                      ) : movements.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-14 text-center text-slate-400">
                            <FileSpreadsheet className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                            <p className="text-sm font-bold text-slate-700">Belum ada riwayat mutasi stok</p>
                            <p className="text-xs text-slate-400 mt-1">Transaksi masuk, keluar, atau transfer stok akan otomatis tercatat di sini.</p>
                          </td>
                        </tr>
                      ) : (
                        paginatedMovements.map((m) => {
                          const badge = getBadgeType(m.type);
                          const isPositive = m.quantity > 0;

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
                              <td className="py-3.5 px-4 text-right">
                                <span
                                  className={`font-mono font-extrabold text-sm ${
                                    isPositive ? 'text-emerald-700' : 'text-rose-600'
                                  }`}
                                >
                                  {isPositive ? `+${m.quantity}` : m.quantity} {m.product?.unit || 'PCS'}
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
      {/* TAB 3: KELOLA GUDANG & LOKASI STOK */}
      {/* ========================================================================= */}
      {activeTab === 'WAREHOUSES' && (
        <div className="space-y-6">
          {/* Header Banner & Penjelasan Arsitektur Logistik */}
          <div className="p-6 sm:p-7 bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white rounded-3xl shadow-md relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-3 py-1 rounded-full bg-indigo-400/20 text-indigo-300 text-xs font-extrabold flex items-center gap-1.5 border border-indigo-400/30">
                    <Warehouse className="w-3.5 h-3.5" />
                    Manajemen Pergudangan &amp; Rantai Pasok
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black tracking-tight">
                  Pusat Distribusi &amp; Pergudangan Logistik
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  Semua pasokan barang dari <strong>Supplier / Vendor</strong> masuk ke <strong>Gudang Utama</strong> terlebih dahulu, kemudian didistribusikan ke masing-masing <strong>Outlet Toko</strong> melalui transfer mutasi.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
                <button
                  type="button"
                  onClick={openCreateWarehouseModal}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-2xl bg-blue-900 hover:bg-blue-800 text-white text-xs sm:text-sm font-extrabold shadow-md shadow-blue-900/20 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>Tambah Gudang Baru</span>
                </button>

                <button
                  type="button"
                  onClick={fetchWarehouses}
                  title="Muat Ulang Data Gudang"
                  className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10 cursor-pointer shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 shrink-0 ${loadingWarehouses ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* 3 Global Warehouse Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fasilitas Pergudangan</span>
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
                  <Warehouse className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900">{warehouses.length} Lokasi</p>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Gudang aktif siap menerima pasokan</p>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fisik Persediaan di Gudang</span>
                <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-900 flex items-center justify-center border border-blue-100">
                  <Boxes className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900">{totalWarehouseUnits.toLocaleString('id-ID')} Unit</p>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Akumulasi {totalWarehouseSku} varian bahan &amp; produk</p>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Nilai Aset Gudang</span>
                <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                  <ArrowDownRight className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900">{formatRupiah(totalWarehouseAssets)}</p>
              <p className="text-[11px] text-slate-500 font-medium mt-1">Estimasi nilai modal seluruh gudang</p>
            </div>
          </div>

          {/* Logistics Concept Summary Card */}
          <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-900 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-950 leading-relaxed font-medium">
              <strong className="font-extrabold">Alur Pasokan Standar:</strong> Vendor / Supplier ➔ Gudang Utama ➔ Outlet Toko Kasir.
              Toko fisik difokuskan untuk pelayanan kasir (POS). Seluruh penerimaan barang dari vendor ditangani di gudang ini agar pembukuan HPP dan kartu stok tetap rapi dan tidak tumpang tindih.
            </div>
          </div>

          {/* Warehouse Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {loadingWarehouses ? (
              <div className="col-span-2 py-16 text-center text-slate-400 bg-white border border-slate-200 rounded-3xl">
                <div className="flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-7 h-7 animate-spin mx-auto text-blue-900 mb-1" />
                  <span className="text-xs font-semibold text-slate-600">Memuat daftar gudang dan saldo stok fisik...</span>
                </div>
              </div>
            ) : warehouses.length === 0 ? (
              <div className="col-span-2 py-16 text-center text-slate-400 bg-white border border-slate-200 rounded-3xl">
                <Warehouse className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h5 className="font-bold text-slate-700 text-base">Belum Ada Fasilitas Gudang Terdaftar</h5>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Buat gudang utama untuk mulai menerima stok pasokan dari supplier dan mendistribusikannya ke outlet toko cabang.
                </p>
                <button
                  type="button"
                  onClick={openCreateWarehouseModal}
                  className="mt-4 px-4 py-2.5 bg-blue-900 text-white rounded-2xl text-xs font-bold shadow-md hover:bg-blue-800 transition-all cursor-pointer"
                >
                  + Buat Gudang Utama Sekarang
                </button>
              </div>
            ) : (
              warehouses.map((wh) => {
                const stats = warehouseStats[wh.id] || { totalSku: 0, totalUnits: 0, totalAssetValue: 0 };
                const isPrimary = wh.name.toLowerCase().includes('utama') || wh.name.toLowerCase().includes('pusat');

                return (
                  <div
                    key={wh.id}
                    className={`bg-white border rounded-3xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between ${
                      isPrimary
                        ? 'border-indigo-300 ring-2 ring-indigo-600/10'
                        : 'border-slate-200'
                    }`}
                  >
                    <div>
                      {/* Top Header Row */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-2xl ${isPrimary ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-100 text-slate-700'}`}>
                            <Warehouse className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-black text-slate-900 text-base sm:text-lg">
                                {wh.name}
                              </h4>
                              {isPrimary ? (
                                <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                                  ⭐ Gudang Utama Pusat
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 text-slate-600">
                                  Gudang Logistik
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 inline-block mt-0.5">
                              ● Beroperasi Aktif
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => openEditWarehouseModal(wh)}
                          className="p-2 text-slate-400 hover:text-blue-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                          title="Edit Info Gudang"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Info Alamat & Kontak */}
                      <div className="space-y-1.5 text-xs text-slate-600 mb-5 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{wh.address || 'Alamat gudang belum diatur'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{wh.phone || 'Nomor telepon belum diatur'}</span>
                        </div>
                      </div>

                      {/* Stock Statistics Grid */}
                      <div className="grid grid-cols-3 gap-2.5 mb-5">
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60 text-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            SKU Tersimpan
                          </span>
                          <span className="text-base font-black text-slate-900">
                            {stats.totalSku} SKU
                          </span>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60 text-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Fisik Barang
                          </span>
                          <span className="text-base font-black text-slate-900">
                            {stats.totalUnits.toLocaleString('id-ID')}
                          </span>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60 text-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Nilai Aset
                          </span>
                          <span className="text-xs font-black text-emerald-700 block truncate" title={formatRupiah(stats.totalAssetValue)}>
                            {formatRupiah(stats.totalAssetValue)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Direct Action Buttons on Warehouse */}
                    <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => openWarehouseDetail(wh)}
                        className="w-full py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded-2xl text-xs font-black border border-blue-200 transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shadow-2xs"
                      >
                        <Boxes className="w-3.5 h-3.5 text-blue-900" />
                        <span>📋 Pantau &amp; Alokasikan Stok Bahan Baku</span>
                      </button>

                      <div className="flex flex-col sm:flex-row items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openModal('IN', undefined, wh.id)}
                          className="w-full sm:flex-1 py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-700/20 transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                        >
                          <ArrowDownRight className="w-3.5 h-3.5" />
                          <span>Terima PO</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openTransferModal(wh.id, 'RAW')}
                          className="w-full sm:flex-1 py-2 px-3 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold shadow-sm shadow-teal-800/20 transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                          <span>⇄ Kirim ke Toko</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH / EDIT GUDANG BARU */}
      {/* ========================================================================= */}
      {warehouseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                  <Warehouse className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-blue-950 text-base">
                  {editingWarehouse ? 'Edit Data Gudang' : 'Tambah Gudang Baru'}
                </h3>
              </div>
              <button
                onClick={() => setWarehouseModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWarehouse} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nama Gudang <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Gudang Logistik Barat"
                  value={warehouseForm.name}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-900 focus:bg-white transition-all font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Alamat Gudang
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Kawasan Pergudangan Blok C No. 12"
                  value={warehouseForm.address}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-900 focus:bg-white transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nomor Telepon / Kontak PIC
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 0812-3456-7890"
                  value={warehouseForm.phone}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-900 focus:bg-white transition-all"
                />
              </div>

              <div className="p-3 bg-indigo-50/70 border border-indigo-200/70 rounded-xl text-[11px] text-indigo-950 leading-relaxed">
                Lokasi ini dikhususkan sebagai fasilitas penyimpanan persediaan barang (Warehouse) dan tidak akan muncul di opsi meja kasir POS toko retail.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setWarehouseModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingWarehouse}
                  className="px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold shadow-md shadow-blue-900/20 transition-all disabled:opacity-50"
                >
                  {savingWarehouse ? 'Menyimpan...' : 'Simpan Gudang'}
                </button>
              </div>
            </form>
          </div>
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
          fetchWarehouses();
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
        onSuccess={() => {
          fetchInventory();
          fetchIngredients();
          fetchWarehouses();
        }}
        activeOutlet={activeOutlet}
        initialMode={bulkOpnameMode}
        initialOperation={bulkOperation}
        products={products}
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
          fetchWarehouses();
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

      {/* ========================================================================= */}
      {/* MODAL: RINCIAN STOK BAHAN BAKU GUDANG (MULTI-WAREHOUSE VISIBILITY) */}
      {/* ========================================================================= */}
      {viewingWarehouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-50 text-blue-900 rounded-2xl border border-blue-100">
                  <Warehouse className="w-5 h-5 text-blue-900" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-blue-950 text-base">
                      {viewingWarehouse.name}
                    </h3>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200">
                      Gudang Pasokan
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    {viewingWarehouse.address || 'Alamat gudang belum diatur'} • {warehouseDetailItems.length} Bahan Baku Tersimpan
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingWarehouse(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Search */}
            <div className="px-6 py-3 border-b border-slate-100 bg-white flex items-center justify-between gap-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama atau kode bahan baku di gudang ini..."
                  value={warehouseDetailSearch}
                  onChange={(e) => setWarehouseDetailSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => {
                  const whId = viewingWarehouse.id;
                  setViewingWarehouse(null);
                  openTransferModal(whId, 'RAW');
                }}
                className="py-2 px-3.5 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shrink-0"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Alokasikan Semua ke Toko</span>
              </button>
            </div>

            {/* Table Content */}
            <div className="p-6 overflow-y-auto">
              {loadingWarehouseDetails ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  <div className="w-6 h-6 border-2 border-blue-900 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <span>Memuat saldo bahan baku gudang...</span>
                </div>
              ) : (
                (() => {
                  const filteredItems = warehouseDetailItems.filter((it) => {
                    const q = warehouseDetailSearch.toLowerCase();
                    return it.name.toLowerCase().includes(q) || (it.itemCode && it.itemCode.toLowerCase().includes(q));
                  });

                  if (filteredItems.length === 0) {
                    return (
                      <div className="py-12 text-center text-slate-400 text-xs">
                        Tidak ada bahan baku yang cocok dengan pencarian di gudang ini.
                      </div>
                    );
                  }

                  return (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="py-3 px-4">Bahan Baku</th>
                            <th className="py-3 px-4 text-center">Stok Fisik di Gudang</th>
                            <th className="py-3 px-4 text-right">Nilai Satuan / Aset</th>
                            <th className="py-3 px-4 text-center">Aksi Cepat</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredItems.map((item) => {
                            const rawStock = item.stock ?? item.warehouseStock ?? 0;
                            const assetValue = (item.averageCost || 0) * rawStock;
                            return (
                              <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="py-3 px-4">
                                  <span className="font-extrabold text-blue-950 block">
                                    {item.name}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-400 font-mono">
                                    {item.itemCode || 'RAW'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full font-black text-xs ${
                                    rawStock > 0 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                                  }`}>
                                    {rawStock.toLocaleString('id-ID')} {item.canonicalUom}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <span className="font-extrabold text-blue-950 block">
                                    Rp {assetValue.toLocaleString('id-ID')}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block">
                                    @ Rp {(item.averageCost || 0).toLocaleString('id-ID')} / {item.canonicalUom}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <button
                                    onClick={() => {
                                      const whId = viewingWarehouse.id;
                                      setViewingWarehouse(null);
                                      openTransferModal(whId, 'RAW', item.id);
                                    }}
                                    disabled={rawStock <= 0}
                                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl font-bold text-xs transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer inline-flex items-center gap-1"
                                    title="Alokasikan item ini ke toko"
                                  >
                                    <ArrowLeftRight className="w-3 h-3 text-blue-900" />
                                    <span>Alokasikan</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setViewingWarehouse(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
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
