import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  ChevronDown,
  Package,
  Boxes,
  Store,
  User,
  Download,
  AlertTriangle,
  RotateCcw,
  ChefHat,
  SlidersHorizontal,
} from 'lucide-react';
import { api } from '../services/api';
import { TablePagination } from '../components/TablePagination';
import { EmptyState, TableSkeleton } from '../components/ui';
import type { StockMovement } from '../types/product';
import type { Outlet } from '../types/outlet';

interface StockMovementsViewProps {
  activeOutlet?: Outlet | null;
}

const formatNumber = (val?: number | null) => {
  if (val === undefined || val === null || isNaN(Number(val))) return '0';
  return Number(val).toLocaleString('id-ID', { maximumFractionDigits: 2 });
};

export const StockMovementsView: React.FC<StockMovementsViewProps> = ({ activeOutlet }) => {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [selectedOutletId, setSelectedOutletId] = useState<string>(activeOutlet?.id || 'ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | '7D' | '30D' | 'THIS_MONTH'>('ALL');
  const [itemTypeTab, setItemTypeTab] = useState<'ALL' | 'INGREDIENTS' | 'PRODUCTS'>('ALL');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Sync activeOutlet if changed from parent header
  useEffect(() => {
    if (activeOutlet?.id && selectedOutletId === 'ALL') {
      setSelectedOutletId(activeOutlet.id);
    }
  }, [activeOutlet?.id]);

  // Fetch Outlets & Warehouses for Location Filter
  useEffect(() => {
    const fetchOutlets = async () => {
      try {
        const res = await api.getOutlets();
        if (res.status === 'success' && res.data) {
          setOutlets(res.data);
        }
      } catch (err) {
        console.error('Gagal mengambil daftar toko & gudang:', err);
      }
    };
    fetchOutlets();
  }, []);

  // Compute Date Boundaries based on dateFilter
  const { startDate, endDate } = useMemo(() => {
    if (dateFilter === 'ALL') return { startDate: undefined, endDate: undefined };

    const now = new Date();
    if (dateFilter === 'TODAY') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      return { startDate: start, endDate: now.toISOString() };
    }
    if (dateFilter === '7D') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      return { startDate: start, endDate: now.toISOString() };
    }
    if (dateFilter === '30D') {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      return { startDate: start, endDate: now.toISOString() };
    }
    if (dateFilter === 'THIS_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      return { startDate: start, endDate: now.toISOString() };
    }
    return { startDate: undefined, endDate: undefined };
  }, [dateFilter]);

  // Fetch Movements from Backend
  const fetchMovements = async () => {
    setLoading(true);
    try {
      const res = await api.getStockMovements({
        outletId: selectedOutletId !== 'ALL' ? selectedOutletId : undefined,
        type: typeFilter !== 'ALL' ? typeFilter : undefined,
        search: searchQuery.trim() || undefined,
        startDate,
        endDate,
        limit: 500,
      });

      if (res.status === 'success' && res.data) {
        setMovements(res.data);
      } else {
        setMovements([]);
      }
    } catch (err) {
      console.error('Gagal mengambil riwayat mutasi stok:', err);
      setMovements([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
    setCurrentPage(1);
  }, [selectedOutletId, typeFilter, dateFilter, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMovements();
    setCurrentPage(1);
  };

  // Client-side Filter by Item Type (Bahan Mentah vs Produk Jadi)
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (itemTypeTab === 'ALL') return true;
      const itemName = m.product?.name || '';
      const unit = m.product?.unit?.toLowerCase() || '';

      // Item bahan baku resep dapur biasanya memiliki unit gram/kg/ml/liter atau tidak memiliki SKU ritel
      const isLikelyIngredient =
        unit.includes('gram') ||
        unit.includes('kg') ||
        unit.includes('ml') ||
        unit.includes('liter') ||
        unit.includes('gr') ||
        itemName.toLowerCase().includes('bahan') ||
        itemName.toLowerCase().includes('bubuk') ||
        itemName.toLowerCase().includes('syrup') ||
        itemName.toLowerCase().includes('sirup') ||
        itemName.toLowerCase().includes('susu');

      if (itemTypeTab === 'INGREDIENTS') {
        return isLikelyIngredient;
      }
      if (itemTypeTab === 'PRODUCTS') {
        return !isLikelyIngredient;
      }
      return true;
    });
  }, [movements, itemTypeTab]);

  // Reset pagination when local item type changes
  useEffect(() => {
    setCurrentPage(1);
  }, [itemTypeTab]);

  // Metric Calculations
  const metrics = useMemo(() => {
    let totalInflow = 0;
    let totalOutflow = 0;
    let totalAdjustments = 0;

    filteredMovements.forEach((m) => {
      const qty = Number(m.quantity) || 0;
      if (qty > 0) {
        totalInflow += qty;
      } else {
        totalOutflow += Math.abs(qty);
      }

      const t = String(m.type).toUpperCase();
      if (t.includes('ADJUST') || t.includes('OPNAME')) {
        totalAdjustments += 1;
      }
    });

    return {
      totalRecords: filteredMovements.length,
      totalInflow,
      totalOutflow,
      totalAdjustments,
    };
  }, [filteredMovements]);

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(filteredMovements.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedMovements = useMemo(() => {
    const startIdx = (safeCurrentPage - 1) * pageSize;
    return filteredMovements.slice(startIdx, startIdx + pageSize);
  }, [filteredMovements, safeCurrentPage, pageSize]);

  // Semantic Movement Badge Mapping
  const getBadgeType = (type: string) => {
    const t = String(type).toUpperCase();
    if (t === 'PURCHASE_IN' || t === 'PURCHASE') {
      return {
        label: 'Stok Masuk (PO)',
        color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        icon: <ArrowDownRight className="w-3 h-3 shrink-0" />,
      };
    }
    if (t === 'SALE_OUT' || t === 'SALE') {
      return {
        label: 'Penjualan Kasir',
        color: 'bg-blue-50 text-blue-900 border-blue-200',
        icon: <ArrowUpRight className="w-3 h-3 shrink-0" />,
      };
    }
    if (t === 'TRANSFER_IN') {
      return {
        label: 'Mutasi Masuk Toko',
        color: 'bg-teal-50 text-teal-800 border-teal-200',
        icon: <ArrowDownRight className="w-3 h-3 shrink-0" />,
      };
    }
    if (t === 'TRANSFER_OUT') {
      return {
        label: 'Mutasi Keluar Toko',
        color: 'bg-indigo-50 text-indigo-800 border-indigo-200',
        icon: <ArrowLeftRight className="w-3 h-3 shrink-0" />,
      };
    }
    if (t.includes('ADJUST') || t.includes('OPNAME')) {
      return {
        label: 'Stock Opname',
        color: 'bg-amber-50 text-amber-800 border-amber-200',
        icon: <SlidersHorizontal className="w-3 h-3 shrink-0" />,
      };
    }
    if (t.includes('DAMAGE') || t.includes('WASTE')) {
      return {
        label: 'Barang Rusak / Waste',
        color: 'bg-rose-50 text-rose-700 border-rose-200',
        icon: <AlertTriangle className="w-3 h-3 shrink-0" />,
      };
    }
    if (t.includes('PRODUCTION') || t.includes('RECIPE')) {
      return {
        label: 'Resep Dapur (BOM)',
        color: 'bg-purple-50 text-purple-800 border-purple-200',
        icon: <ChefHat className="w-3 h-3 shrink-0" />,
      };
    }
    if (t.includes('VOID') || t.includes('RETURN')) {
      return {
        label: 'Retur / Batal Kasir',
        color: 'bg-orange-50 text-orange-800 border-orange-200',
        icon: <RotateCcw className="w-3 h-3 shrink-0" />,
      };
    }
    return {
      label: type,
      color: 'bg-slate-50 text-slate-700 border-slate-200',
      icon: <ArrowLeftRight className="w-3 h-3 shrink-0" />,
    };
  };

  // CSV Export Utility
  const handleExportCSV = () => {
    if (filteredMovements.length === 0) return;

    const headers = [
      'Waktu Transaksi',
      'Nama Item',
      'SKU / Kode',
      'Lokasi / Toko / Gudang',
      'Tipe Mutasi',
      'Perubahan Qty',
      'Satuan (UOM)',
      'Stok Sebelum',
      'Stok Sesudah',
      'Petugas (PIC)',
      'Keterangan / Catatan',
    ];

    const rows = filteredMovements.map((m) => {
      const badge = getBadgeType(m.type);
      const dateStr = new Date(m.createdAt).toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const outletName = m.outlet?.name || outlets.find((o) => o.id === m.outletId)?.name || '-';

      return [
        `"${dateStr}"`,
        `"${m.product?.name || 'Item Dihapus'}"`,
        `"${m.product?.sku || '-'}"`,
        `"${outletName}"`,
        `"${badge.label}"`,
        m.quantity,
        `"${m.product?.unit || 'PCS'}"`,
        m.stockBefore ?? '-',
        m.stockAfter ?? '-',
        `"${m.user?.name || 'Sistem'}"`,
        `"${(m.notes || '-').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `kartu_mutasi_stok_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner: Audit Trail & Kartu Stok */}
      <div className="p-6 sm:p-7 bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white rounded-3xl shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-blue-400/20 text-blue-300 text-xs font-extrabold flex items-center gap-1.5 border border-blue-400/30 shrink-0">
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                Audit Trail Persediaan &amp; Logistik
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white truncate">
              Riwayat &amp; Kartu Mutasi Stok
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Jejak riwayat transaksi keluar-masuk barang, pemotongan otomatis bahan baku resep dapur F&amp;B, penerimaan PO dari vendor, penyesuaian opname, dan retur penjualan kasir.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto shrink-0">
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={filteredMovements.length === 0}
              className="h-10 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-bold border border-white/15 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
              title="Unduh data mutasi format Excel/CSV"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Ekspor CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Mutasi */}
        <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-3xl shadow-xs min-w-0">
          <div className="flex items-center justify-between text-slate-500 mb-2 gap-2">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
              Total Mutasi
            </span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-blue-50 text-blue-900 flex items-center justify-center border border-blue-100 shrink-0">
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black font-mono text-slate-900 truncate">
            {metrics.totalRecords.toLocaleString('id-ID')}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5 truncate">
            Catatan pergerakan stok aktif
          </p>
        </div>

        {/* Total Item Masuk (Inflow) */}
        <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-3xl shadow-xs min-w-0">
          <div className="flex items-center justify-between text-slate-500 mb-2 gap-2">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
              Stok Masuk
            </span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shrink-0">
              <ArrowDownRight className="w-4 h-4 shrink-0" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black font-mono text-emerald-700 truncate">
            +{metrics.totalInflow.toLocaleString('id-ID')}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5 truncate">
            PO pembelian &amp; transfer masuk
          </p>
        </div>

        {/* Total Item Keluar (Outflow) */}
        <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-3xl shadow-xs min-w-0">
          <div className="flex items-center justify-between text-slate-500 mb-2 gap-2">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
              Stok Keluar
            </span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-100 shrink-0">
              <ArrowUpRight className="w-4 h-4 shrink-0" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black font-mono text-rose-600 truncate">
            -{metrics.totalOutflow.toLocaleString('id-ID')}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5 truncate">
            Penjualan kasir &amp; resep dapur
          </p>
        </div>

        {/* Penyesuaian Opname */}
        <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-3xl shadow-xs min-w-0">
          <div className="flex items-center justify-between text-slate-500 mb-2 gap-2">
            <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
              Opname &amp; Koreksi
            </span>
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100 shrink-0">
              <SlidersHorizontal className="w-4 h-4 shrink-0" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black font-mono text-amber-800 truncate">
            {metrics.totalAdjustments.toLocaleString('id-ID')} Kali
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5 truncate">
            Koreksi selisih fisik opname
          </p>
        </div>
      </div>

      {/* Segmented Item Type Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -mx-1 px-1 sm:mx-0 sm:px-0 flex-nowrap border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setItemTypeTab('ALL')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            itemTypeTab === 'ALL'
              ? 'bg-blue-900 text-white shadow-md shadow-blue-950/20'
              : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 shrink-0" />
          <span>Semua Mutasi</span>
          <span
            className={`px-2 py-0.5 text-[10px] font-black rounded-full shrink-0 ${
              itemTypeTab === 'ALL' ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {movements.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setItemTypeTab('INGREDIENTS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            itemTypeTab === 'INGREDIENTS'
              ? 'bg-blue-900 text-white shadow-md shadow-blue-950/20'
              : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Package className="w-4 h-4 shrink-0" />
          <span>Bahan Baku Mentah (Resep F&amp;B)</span>
        </button>

        <button
          type="button"
          onClick={() => setItemTypeTab('PRODUCTS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
            itemTypeTab === 'PRODUCTS'
              ? 'bg-blue-900 text-white shadow-md shadow-blue-950/20'
              : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Boxes className="w-4 h-4 shrink-0" />
          <span>Produk Jadi (Retail)</span>
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari item, SKU, kode bahan, petugas, atau catatan mutasi..."
            className="w-full h-10 pl-10 pr-4 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-blue-900 font-medium text-slate-800 transition-colors"
          />
        </form>

        {/* Dropdown Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Lokasi / Toko / Gudang */}
          <div className="relative">
            <select
              value={selectedOutletId}
              onChange={(e) => setSelectedOutletId(e.target.value)}
              className="appearance-none h-10 pr-8 pl-3.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-none focus:bg-white focus:border-blue-900 cursor-pointer"
            >
              <option value="ALL">Semua Lokasi &amp; Gudang</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} {o.isWarehouse ? '(Gudang)' : '(Toko)'}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
          </div>

          {/* Tipe Mutasi */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="appearance-none h-10 pr-8 pl-3.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-none focus:bg-white focus:border-blue-900 cursor-pointer"
            >
              <option value="ALL">Semua Jenis Mutasi</option>
              <option value="SALE_OUT">Penjualan Kasir</option>
              <option value="PURCHASE_IN">Stok Masuk (PO)</option>
              <option value="TRANSFER_IN">Mutasi Masuk Toko</option>
              <option value="TRANSFER_OUT">Mutasi Keluar Toko</option>
              <option value="ADJUSTMENT">Stock Opname / Koreksi</option>
              <option value="DAMAGE_OUT">Barang Rusak / Kadaluarsa</option>
              <option value="PRODUCTION_OUTPUT">Resep Dapur (BOM)</option>
              <option value="SALE_VOID">Retur / Batal Kasir</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
          </div>

          {/* Filter Periode Waktu */}
          <div className="relative">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="appearance-none h-10 pr-8 pl-3.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-none focus:bg-white focus:border-blue-900 cursor-pointer"
            >
              <option value="ALL">Semua Periode</option>
              <option value="TODAY">Hari Ini</option>
              <option value="7D">7 Hari Terakhir</option>
              <option value="30D">30 Hari Terakhir</option>
              <option value="THIS_MONTH">Bulan Ini</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none shrink-0" />
          </div>
        </div>
      </div>

      {/* Tabel Riwayat Kartu Stok */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[1050px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                <th className="py-3.5 px-4 pl-6 whitespace-nowrap">Waktu Transaksi</th>
                <th className="py-3.5 px-4 min-w-[200px]">Nama Item &amp; SKU</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Lokasi (Toko / Gudang)</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Tipe Mutasi</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Perubahan Qty</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">Saldo (Sebelum ➔ Sesudah)</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Petugas (PIC)</th>
                <th className="py-3.5 px-4 pr-6 whitespace-nowrap">Keterangan / Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
              {loading ? (
                <TableSkeleton rows={6} columns={8} />
              ) : filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <EmptyState
                      icon={<FileSpreadsheet className="w-8 h-8 text-blue-900 shrink-0" />}
                      title="Belum Ada Riwayat Mutasi Stok"
                      description="Pergerakan stok dari transaksi kasir, penerimaan PO, transfer antar outlet, atau penyesuaian opname akan tercatat di sini secara otomatis."
                    />
                  </td>
                </tr>
              ) : (
                paginatedMovements.map((m) => {
                  const badge = getBadgeType(m.type);
                  const isPositive = m.quantity > 0;
                  const outletName = m.outlet?.name || outlets.find((o) => o.id === m.outletId)?.name || 'Outlet Aktif';

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Waktu */}
                      <td className="py-3.5 px-4 pl-6 text-xs text-slate-600 whitespace-nowrap font-medium">
                        <div className="font-bold text-slate-900">
                          {new Date(m.createdAt).toLocaleDateString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {new Date(m.createdAt).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      {/* Produk */}
                      <td className="py-3.5 px-4 min-w-[180px]">
                        <div className="font-extrabold text-slate-900 text-xs sm:text-sm">
                          {m.product?.name || 'Item Terhapus / Bahan Baku'}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400 font-semibold mt-0.5">
                          {m.product?.sku || 'RAW-BOM'}
                        </div>
                      </td>

                      {/* Lokasi Toko / Gudang */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                          <Store className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{outletName}</span>
                        </span>
                      </td>

                      {/* Tipe Mutasi */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${badge.color}`}>
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      {/* Qty Perubahan */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span
                          className={`font-mono font-black text-sm ${
                            isPositive ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {isPositive ? `+${formatNumber(m.quantity)}` : formatNumber(m.quantity)} {m.product?.unit || 'PCS'}
                        </span>
                      </td>

                      {/* Saldo Sebelum ➔ Sesudah */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap font-mono text-xs">
                        {m.stockBefore !== undefined && m.stockAfter !== undefined ? (
                          <div className="inline-flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 font-bold text-slate-700">
                            <span>{formatNumber(m.stockBefore)}</span>
                            <span className="text-slate-400 font-normal">➔</span>
                            <span className={m.stockAfter < 5 ? 'text-rose-600 font-black' : 'text-slate-900'}>
                              {formatNumber(m.stockAfter)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Petugas */}
                      <td className="py-3.5 px-4 text-xs font-bold text-slate-700 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{m.user?.name || 'Sistem / Otomatis'}</span>
                        </div>
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

        {/* Kanonikal TablePagination per Rule 7 */}
        {!loading && filteredMovements.length > 0 && (
          <TablePagination
            currentPage={safeCurrentPage}
            pageSize={pageSize}
            totalItems={filteredMovements.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            itemLabel="mutasi stok"
          />
        )}
      </div>
    </div>
  );
};
