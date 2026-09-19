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
  Filter,
  Warehouse,
  Store,
  Plus,
  Truck,
  MapPin,
  Phone,
  Edit3,
  X,
  Info,
} from 'lucide-react';
import type { Product, StockMovement, LowStockProduct } from '../types/product';
import type { Outlet } from '../types/outlet';
import { StockMovementModal } from '../components/StockMovementModal';
import { StockTransferModal } from '../components/StockTransferModal';
import { api } from '../services/api';

interface InventoryViewProps {
  activeOutlet?: Outlet | null;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ activeOutlet }) => {
  // Tab State: 'OVERVIEW' (Ringkasan & Kartu Stok) | 'WAREHOUSES' (Kelola Gudang & Lokasi Stok)
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'WAREHOUSES'>('OVERVIEW');

  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search State for Card Stok
  const [movementSearch, setMovementSearch] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('ALL');

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

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const [prodRes, movRes, lowRes] = await Promise.all([
        api.getProducts({ outletId: activeOutlet?.id }),
        api.getStockMovements({
          outletId: activeOutlet?.id,
          limit: 100,
          search: movementSearch.trim() || undefined,
          type: movementTypeFilter !== 'ALL' ? movementTypeFilter : undefined,
        }),
        api.getLowStockProducts(),
      ]);

      if (prodRes.status === 'success') setProducts(prodRes.data);
      if (movRes.status === 'success') setMovements(movRes.data);
      if (lowRes.status === 'success') setLowStockItems(lowRes.data);
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
        const whList = res.data.filter((o: Outlet) => o.isWarehouse);
        setWarehouses(whList);

        // Ambil data statistik per gudang secara paralel
        const statsMap: Record<string, { totalSku: number; totalUnits: number; totalAssetValue: number }> = {};
        await Promise.all(
          whList.map(async (wh: Outlet) => {
            try {
              const pRes = await api.getProducts({ outletId: wh.id });
              if (pRes.status === 'success' && pRes.data) {
                const activeWithStock = pRes.data.filter((p) => p.stock > 0);
                const totalUnits = pRes.data.reduce((sum, p) => sum + p.stock, 0);
                const totalAssetValue = pRes.data.reduce((sum, p) => sum + p.costPrice * p.stock, 0);
                statsMap[wh.id] = {
                  totalSku: activeWithStock.length,
                  totalUnits,
                  totalAssetValue,
                };
              }
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

  useEffect(() => {
    fetchInventory();
    fetchWarehouses();
  }, [movementTypeFilter, activeOutlet?.id]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchInventory();
  };

  const openModal = (type: 'IN' | 'OUT' | 'ADJUST', product?: Product, customOutletId?: string) => {
    setModalType(type);
    setSelectedProduct(product || null);
    setTargetModalOutletId(customOutletId || activeOutlet?.id);
    setModalOpen(true);
  };

  const openTransferModal = (customSourceOutletId?: string) => {
    setTransferSourceOutletId(customSourceOutletId || activeOutlet?.id);
    setTransferModalOpen(true);
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
  const totalStockUnits = products.reduce((acc, p) => acc + p.stock, 0);
  const totalAssetValue = products.reduce((acc, p) => acc + p.costPrice * p.stock, 0);

  const getBadgeType = (type: string) => {
    switch (type) {
      case 'PURCHASE_IN':
        return { label: 'Stok Masuk (PO)', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'TRANSFER_IN':
        return { label: 'Mutasi Masuk Cabang', color: 'bg-teal-50 text-teal-800 border-teal-200' };
      case 'TRANSFER_OUT':
        return { label: 'Mutasi Keluar Cabang', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
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
      {/* Tab Navigation Header (Opsi 1: Terintegrasi dalam Stok & Inventori) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all ${
              activeTab === 'OVERVIEW'
                ? 'bg-blue-900 text-white shadow-md shadow-blue-950/20'
                : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Ringkasan & Kartu Stok</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('WAREHOUSES');
              fetchWarehouses();
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all relative ${
              activeTab === 'WAREHOUSES'
                ? 'bg-blue-900 text-white shadow-md shadow-blue-950/20'
                : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Warehouse className="w-4 h-4" />
            <span>Kelola Gudang & Lokasi Stok</span>
            {warehouses.length > 0 && (
              <span
                className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
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
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 border border-slate-200/80 text-[11px] font-semibold text-slate-600">
          <Truck className="w-3.5 h-3.5 text-blue-900" />
          <span>Alur Distribusi:</span>
          <span className="font-bold text-slate-800">Supplier</span>
          <span>➔</span>
          <span className="font-extrabold text-blue-900">Gudang Utama</span>
          <span>➔</span>
          <span className="font-bold text-emerald-700">Toko Cabang</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: RINGKASAN & KARTU STOK */}
      {/* ========================================================================= */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Action Header & Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Stat 1 */}
            <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Total Jenis SKU</span>
                <Boxes className="w-4 h-4 text-blue-900" />
              </div>
              <div className="text-2xl font-black text-blue-950">{products.length} SKU</div>
              <p className="text-xs text-slate-500 mt-1">Katalog aktif di toko</p>
            </div>

            {/* Stat 2 */}
            <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Total Fisik Barang</span>
                <FileSpreadsheet className="w-4 h-4 text-blue-900" />
              </div>
              <div className="text-2xl font-black text-blue-950">
                {totalStockUnits.toLocaleString('id-ID')} Unit
              </div>
              <p className="text-xs text-slate-500 mt-1">Akumulasi seluruh rak</p>
            </div>

            {/* Stat 3 */}
            <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Nilai Aset Stok (HPP)</span>
                <ArrowDownRight className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-black text-blue-950 truncate">
                Rp {totalAssetValue.toLocaleString('id-ID')}
              </div>
              <p className="text-xs text-slate-500 mt-1">Modal barang di gudang</p>
            </div>

            {/* Stat 4 */}
            <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-bold uppercase tracking-wider">Stok Menipis</span>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-amber-600">
                {lowStockItems.length} Produk
              </div>
              <p className="text-xs text-slate-500 mt-1">Perlu segera di-restock</p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="text-base font-extrabold text-blue-950">
                  Aksi Transaksi Mutasi Stok
                </h3>
                {activeOutlet?.isWarehouse ? (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                    <Warehouse className="w-3 h-3 text-indigo-600" />
                    Gudang Pusat: {activeOutlet.name}
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-200 flex items-center gap-1">
                    <Store className="w-3 h-3 text-blue-800" />
                    Cabang: {activeOutlet?.name || 'Utama'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {activeOutlet?.isWarehouse
                  ? 'Input stok masuk dari supplier ke Gudang Pusat, catat pemindahan ke cabang, atau lakukan opname fisik.'
                  : 'Input stok masuk dari supplier, pembuangan barang rusak, atau penyesuaian opname fisik di cabang ini.'}
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={() => openModal('IN')}
                className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-700/20 transition-all flex items-center gap-1.5 active:scale-95"
              >
                <ArrowDownRight className="w-4 h-4" />
                <span>+ Stok Masuk (PO)</span>
              </button>

              <button
                onClick={() => openTransferModal()}
                className="px-4 py-2.5 rounded-xl bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold shadow-md shadow-teal-800/20 transition-all flex items-center gap-1.5 active:scale-95"
                title="Mutasi pemindahan stok antar cabang / gudang"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>⇄ Transfer Cabang</span>
              </button>

              <button
                onClick={() => openModal('OUT')}
                className="px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold shadow-md shadow-rose-700/20 transition-all flex items-center gap-1.5 active:scale-95"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>- Stok Keluar (Rusak)</span>
              </button>

              <button
                onClick={() => openModal('ADJUST')}
                className="px-4 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold shadow-md shadow-blue-900/20 transition-all flex items-center gap-1.5 active:scale-95"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Stock Opname</span>
              </button>

              <button
                onClick={fetchInventory}
                title="Refresh Riwayat"
                className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Stock Movement History Table */}
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/70">
              <div>
                <h4 className="font-extrabold text-blue-950 text-base">
                  Riwayat Kartu Stok (Mutasi Terakhir)
                </h4>
                <p className="text-xs text-slate-500">
                  Setiap penambahan atau pengurangan stok tercatat otomatis untuk audit
                </p>
              </div>

              {/* Search & Filter Toolbar */}
              <div className="flex items-center gap-2 flex-wrap">
                <form onSubmit={handleSearchSubmit} className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={movementSearch}
                    onChange={(e) => setMovementSearch(e.target.value)}
                    placeholder="Cari SKU, produk, PO..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-900 w-44 sm:w-56"
                  />
                </form>

                <div className="flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={movementTypeFilter}
                    onChange={(e) => setMovementTypeFilter(e.target.value)}
                    className="py-1.5 px-2.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-semibold focus:outline-none focus:border-blue-900 cursor-pointer"
                  >
                    <option value="ALL">Semua Mutasi</option>
                    <option value="PURCHASE_IN">Stok Masuk (PO)</option>
                    <option value="TRANSFER_IN">Mutasi Masuk Cabang</option>
                    <option value="TRANSFER_OUT">Mutasi Keluar Cabang</option>
                    <option value="SALE_OUT">Penjualan Kasir</option>
                    <option value="DAMAGE_OUT">Barang Rusak</option>
                    <option value="ADJUSTMENT">Stock Opname</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-bold text-xs uppercase tracking-wider">
                    <th className="py-3 px-4 pl-6">Waktu</th>
                    <th className="py-3 px-4">Nama Produk</th>
                    <th className="py-3 px-4">Tipe Mutasi</th>
                    <th className="py-3 px-4 text-right">Perubahan Qty</th>
                    <th className="py-3 px-4">Petugas (PIC)</th>
                    <th className="py-3 px-4 pr-6">Keterangan / Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="w-6 h-6 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
                          <span>Memuat riwayat kartu stok...</span>
                        </div>
                      </td>
                    </tr>
                  ) : movements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        Belum ada riwayat mutasi stok.
                      </td>
                    </tr>
                  ) : (
                    movements.map((m) => {
                      const badge = getBadgeType(m.type);
                      const isPositive = m.quantity > 0;

                      return (
                        <tr key={m.id} className="hover:bg-blue-50/30 transition-colors">
                          {/* Waktu */}
                          <td className="py-3.5 px-4 pl-6 text-xs text-slate-500 whitespace-nowrap">
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
                            <div className="font-bold text-blue-950 text-xs sm:text-sm">
                              {m.product.name}
                            </div>
                            <div className="font-mono text-[11px] text-slate-400">{m.product.sku}</div>
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
                              {isPositive ? `+${m.quantity}` : m.quantity} {m.product.unit}
                            </span>
                          </td>

                          {/* Petugas */}
                          <td className="py-3.5 px-4 text-xs font-semibold text-slate-700">
                            {m.user.name}
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
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: KELOLA GUDANG & LOKASI STOK */}
      {/* ========================================================================= */}
      {activeTab === 'WAREHOUSES' && (
        <div className="space-y-6">
          {/* Header Banner & Penjelasan Arsitektur Logistik */}
          <div className="p-6 bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white rounded-3xl shadow-md relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-3 py-1 rounded-full bg-indigo-400/20 text-indigo-300 text-xs font-extrabold flex items-center gap-1.5 border border-indigo-400/30">
                    <Warehouse className="w-3.5 h-3.5" />
                    Manajemen Gudang Terpusat
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black tracking-tight">
                  Pusat Distribusi & Gudang Logistik
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  Semua pasokan barang dari <strong>Supplier / Vendor</strong> masuk ke <strong>Gudang Utama</strong> terlebih dahulu, kemudian didistribusikan ke masing-masing <strong>Toko Cabang</strong> melalui transfer mutasi.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={openCreateWarehouseModal}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Tambah Gudang Baru</span>
                </button>

                <button
                  onClick={fetchWarehouses}
                  title="Refresh Data Gudang"
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingWarehouses ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Logistics Concept Summary Card */}
          <div className="p-4 bg-blue-50/60 border border-blue-200/80 rounded-2xl flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-900 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-950 leading-relaxed">
              <strong className="font-extrabold">Alur Pasokan Standar:</strong> Supplier ➔ Gudang Utama ➔ Toko Cabang.
              Toko cabang fisik yang terdaftar di menu <em>Cabang Toko</em> difokuskan hanya untuk transaksi kasir (POS). Seluruh penerimaan barang dari vendor ditangani di gudang ini agar pembukuan dan kartu stok tidak tumpang tindih.
            </div>
          </div>

          {/* Warehouse Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {loadingWarehouses ? (
              <div className="col-span-2 py-16 text-center text-slate-400 bg-white border border-slate-200 rounded-3xl">
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-7 h-7 border-2 border-blue-900 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-semibold">Memuat daftar gudang dan stok fisik...</span>
                </div>
              </div>
            ) : warehouses.length === 0 ? (
              <div className="col-span-2 py-16 text-center text-slate-400 bg-white border border-slate-200 rounded-3xl">
                <Warehouse className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h5 className="font-bold text-slate-700 text-base">Belum Ada Gudang Terdaftar</h5>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Buat gudang utama untuk mulai menerima stok pasokan dari supplier dan mendistribusikannya ke cabang toko.
                </p>
                <button
                  onClick={openCreateWarehouseModal}
                  className="mt-4 px-4 py-2 bg-blue-900 text-white rounded-xl text-xs font-bold shadow-md hover:bg-blue-800"
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
                    className={`bg-white border rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                      isPrimary
                        ? 'border-indigo-300 ring-2 ring-indigo-600/10'
                        : 'border-slate-200'
                    }`}
                  >
                    <div>
                      {/* Top Header Row */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-2xl ${isPrimary ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
                            <Warehouse className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-black text-blue-950 text-base sm:text-lg">
                                {wh.name}
                              </h4>
                              {isPrimary && (
                                <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                                  ⭐ Gudang Utama Pusat
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 inline-block mt-0.5">
                              ● Status Aktif Beroperasi
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => openEditWarehouseModal(wh)}
                          className="p-2 text-slate-400 hover:text-blue-900 hover:bg-slate-50 rounded-xl transition-colors"
                          title="Edit Info Gudang"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Info Alamat & Kontak */}
                      <div className="space-y-1.5 text-xs text-slate-600 mb-5 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{wh.address || 'Alamat belum diatur'}</span>
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
                            SKU Tersedia
                          </span>
                          <span className="text-base font-black text-blue-950">
                            {stats.totalSku} SKU
                          </span>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60 text-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Fisik Barang
                          </span>
                          <span className="text-base font-black text-blue-950">
                            {stats.totalUnits.toLocaleString('id-ID')}
                          </span>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60 text-center">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Nilai Aset
                          </span>
                          <span className="text-xs font-black text-emerald-700 block truncate" title={`Rp ${stats.totalAssetValue.toLocaleString('id-ID')}`}>
                            Rp {stats.totalAssetValue > 1000000 ? `${(stats.totalAssetValue / 1000000).toFixed(1)} jt` : stats.totalAssetValue.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Direct Action Buttons on Warehouse */}
                    <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-2">
                      <button
                        onClick={() => openModal('IN', undefined, wh.id)}
                        className="w-full sm:flex-1 py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-700/20 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <ArrowDownRight className="w-3.5 h-3.5" />
                        <span>+ Terima PO Supplier</span>
                      </button>

                      <button
                        onClick={() => openTransferModal(wh.id)}
                        className="w-full sm:flex-1 py-2.5 px-3 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold shadow-sm shadow-teal-800/20 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        <span>⇄ Kirim ke Cabang</span>
                      </button>
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
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          fetchInventory();
          fetchWarehouses();
        }}
        products={products}
        defaultProduct={selectedProduct}
        defaultType={modalType}
        outletId={targetModalOutletId || activeOutlet?.id}
      />

      {/* ========================================================================= */}
      {/* MODAL: TRANSFER STOK ANTAR CABANG / GUDANG */}
      {/* ========================================================================= */}
      <StockTransferModal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        onSuccess={() => {
          fetchInventory();
          fetchWarehouses();
        }}
        activeOutlet={activeOutlet}
        defaultSourceOutletId={transferSourceOutletId}
        products={products}
      />
    </div>
  );
};
