import React, { useState, useEffect } from 'react';
import {
  Award,
  Package,
  TrendingUp,
  Percent,
  AlertOctagon,
  Download,
  Calendar,
  RefreshCw,
  Printer,
  Lock,
  Sparkles,
  Zap,
  Store,
} from 'lucide-react';
import { api } from '../services/api';
import type { FinancialReportData } from '../types/report';
import type { Outlet } from '../types/outlet';
import { usePlan } from '../hooks/usePlan';
import { UpgradeModal } from '../components/UpgradeModal';
import { computePresetDateRange } from '../utils/date';
import { TablePagination } from '../components/TablePagination';

interface ProductAnalyticsViewProps {
  activeOutlet?: Outlet | null;
}

export const ProductAnalyticsView: React.FC<ProductAnalyticsViewProps> = ({ activeOutlet }) => {
  const { isFree } = usePlan();
  const [data, setData] = useState<FinancialReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLockedByApi, setIsLockedByApi] = useState<boolean>(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState<boolean>(false);
  const [periodPreset, setPeriodPreset] = useState<'today' | '7days' | '30days' | 'thisMonth' | 'custom'>('30days');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // Pagination states for Top Products and Slow-Moving Products (Standar Kanonikal 10/25/50/100)
  const [topPage, setTopPage] = useState<number>(1);
  const [topPageSize, setTopPageSize] = useState<number>(10);

  const [slowPage, setSlowPage] = useState<number>(1);
  const [slowPageSize, setSlowPageSize] = useState<number>(10);

  // Auto-reset page 1 when filter changes
  useEffect(() => {
    setTopPage(1);
    setSlowPage(1);
  }, [periodPreset, customStart, customEnd, activeOutlet?.id]);

  const isLocked = isFree || isLockedByApi;

  const computeDates = (preset: string) => {
    return computePresetDateRange(preset as any);
  };

  const fetchReport = async () => {
    if (isFree) {
      setIsLockedByApi(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let startDate = customStart;
      let endDate = customEnd;

      if (periodPreset !== 'custom') {
        const { startStr, endStr } = computeDates(periodPreset);
        startDate = startStr;
        endDate = endStr;
      }

      const outletIdParam = activeOutlet && !activeOutlet.isWarehouse ? activeOutlet.id : undefined;

      const res = await api.getFinancialReport({
        startDate,
        endDate,
        outletId: outletIdParam,
      });

      if (res.code === 'PRO_FEATURE_REQUIRED' || res.isLocked) {
        setIsLockedByApi(true);
        setData(null);
      } else if (res.status === 'success') {
        setData(res.data);
        setIsLockedByApi(false);
      }
    } catch (err) {
      console.error('Error fetching product analytics report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (periodPreset !== 'custom') {
      fetchReport();
    }
  }, [periodPreset, activeOutlet?.id]);

  // Ekspor Data Analisis Produk & HPP ke File CSV
  const handleExportCSV = () => {
    if (!data) return;

    const summaryRows = [
      ['LAPORAN ANALISIS MENU, HPP & PROFITABILITAS PRODUK'],
      ['Toko / Outlet', activeOutlet && !activeOutlet.isWarehouse ? activeOutlet.name : 'Seluruh Toko'],
      ['Rentang Waktu', `${data.filter.startDate.slice(0, 10)} s/d ${data.filter.endDate.slice(0, 10)}`],
      ['Tanggal Cetak', new Date().toLocaleString('id-ID')],
      [''],
      ['METRIK PRODUK & HPP'],
      ['Total Modal Barang Terjual (COGS / HPP)', `Rp ${data.financialSummary.totalCOGS}`],
      ['Laba Kotor Produk (Gross Profit)', `Rp ${data.financialSummary.grossProfit}`],
      ['Margin Laba Kotor Rata-rata', `${data.financialSummary.grossProfitMargin}%`],
      ['Total Faktur Penjualan', `${data.financialSummary.totalTransactions}`],
      [''],
      ['TOP PRODUK TERLARIS (LEADERBOARD)'],
      ['Peringkat', 'SKU', 'Nama Produk', 'Kategori', 'Qty Terjual', 'Omset Penjualan', 'Total HPP', 'Laba Bersih', 'Margin (%)'],
      ...data.topProducts.map((p, idx) => [
        idx + 1,
        p.sku,
        `"${p.name}"`,
        `"${p.categoryName}"`,
        p.qtySold,
        p.revenue,
        p.cost,
        p.profit,
        `${p.profitMargin}%`,
      ]),
      [''],
      ['ANALISIS SLOW-MOVING & POTENSI DEAD STOCK'],
      ['SKU', 'Nama Produk', 'Kategori', 'Sisa Stok', 'HPP Modal Beli', 'Harga Jual', 'Qty Terjual', 'Nilai Modal Mengendap'],
      ...(data.slowMovingProducts || []).map((p) => [
        p.sku,
        `"${p.name}"`,
        `"${p.categoryName}"`,
        p.currentStock,
        p.costPrice,
        p.basePrice,
        p.qtySold,
        p.currentStock * p.costPrice,
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + summaryRows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Analisis_Menu_HPP_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fs = data?.financialSummary;
  const totalDeadStockValue = (data?.slowMovingProducts || []).reduce(
    (sum, p) => sum + (p.currentStock * p.costPrice),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm no-print">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
            <Award className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Analisis Menu, HPP &amp; Profitabilitas
              </h2>
              {activeOutlet && !activeOutlet.isWarehouse && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-900 font-bold text-[10px]">
                  <Store className="w-3 h-3" />
                  <span>{activeOutlet.name}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Evaluasi performa menu terlaris, modal bahan baku (*COGS/HPP*), kontribusi laba per produk, dan deteksi barang *slow-moving*.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              if (isLocked) {
                setUpgradeModalOpen(true);
                return;
              }
              window.print();
            }}
            disabled={!data && !isLocked}
            className={`flex-1 sm:flex-initial justify-center px-3.5 py-2.5 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all ${
              isLocked
                ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {isLocked ? <Lock className="w-4 h-4 text-amber-600" /> : <Printer className="w-4 h-4" />}
            <span>Cetak</span>
            {isLocked && <span className="px-1 py-0.2 bg-amber-200 text-amber-900 rounded text-[9px] font-black">PRO</span>}
          </button>

          <button
            onClick={() => {
              if (isLocked) {
                setUpgradeModalOpen(true);
                return;
              }
              handleExportCSV();
            }}
            disabled={!data && !isLocked}
            className={`flex-1 sm:flex-initial justify-center px-4 py-2.5 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all ${
              isLocked
                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                : 'bg-blue-900 hover:bg-blue-950 text-white shadow-blue-900/20'
            }`}
          >
            {isLocked ? <Lock className="w-4 h-4" /> : <Download className="w-4 h-4 stroke-[2.5]" />}
            <span>Ekspor CSV</span>
            {isLocked && <span className="px-1 py-0.2 bg-white/20 text-white rounded text-[9px] font-black">PRO</span>}
          </button>
        </div>
      </div>

      {/* Filter Controls Toolbar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 no-print">
        {/* Preset Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Periode:
          </span>
          {[
            { key: 'today', label: 'Hari Ini' },
            { key: '7days', label: '7 Hari Terakhir' },
            { key: '30days', label: '30 Hari Terakhir' },
            { key: 'thisMonth', label: 'Bulan Ini' },
            { key: 'custom', label: 'Kustom' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setPeriodPreset(item.key as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                periodPreset === item.key
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Custom Range Inputs if custom selected */}
        {periodPreset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none"
            />
            <span className="text-xs text-slate-400">s/d</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none"
            />
            <button
              onClick={fetchReport}
              className="px-3.5 py-1.5 bg-blue-900 text-white rounded-xl text-xs font-bold hover:bg-blue-950 transition-all"
            >
              Terapkan
            </button>
          </div>
        )}

        <button
          onClick={fetchReport}
          disabled={loading}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors self-end md:self-auto"
          title="Segarkan data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-900' : ''}`} />
        </button>
      </div>

      {/* Konten Laporan: Paywall jika FREE */}
      {isLocked ? (
        <div className="space-y-6 animate-fadeIn">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 p-6 sm:p-8 text-white border border-indigo-700/50 shadow-2xl">
            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-black tracking-wider uppercase mb-4">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Fitur Eksklusif Paket PRO</span>
              </div>
              
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Buka Analisis HPP, Menu Terlaris &amp; Efisiensi Dapur
              </h3>
              
              <p className="text-slate-300 text-xs sm:text-sm mt-3 leading-relaxed">
                Ketahui secara presisi resep menu mana yang memberikan keuntungan tertinggi, rasio food cost bahan baku, dan identifikasi bahan makanan yang berisiko kadaluarsa/mengendap.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setUpgradeModalOpen(true)}
                  className="px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm rounded-2xl shadow-xl shadow-blue-900/30 transition-all flex items-center gap-2"
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>Tingkatkan ke Paket PRO Sekarang</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : loading && !data ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
          <span className="text-xs font-semibold">Menganalisis performa menu &amp; HPP produk...</span>
        </div>
      ) : fs ? (
        <>
          {/* Product & COGS KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total HPP */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total Modal HPP (COGS)
                </span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
                  <Package className="w-5 h-5 stroke-[2.5]" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  Rp {fs.totalCOGS.toLocaleString('id-ID')}
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 font-medium">
                  Total modal bahan baku dari produk terjual
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Rasio HPP Modal:</span>
                <strong className="text-slate-800">
                  {fs.totalNetRevenue > 0
                    ? ((fs.totalCOGS / fs.totalNetRevenue) * 100).toFixed(1)
                    : 0}
                  %
                </strong>
              </div>
            </div>

            {/* Card 2: Laba Kotor Produk */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Laba Kotor (*Gross Profit*)
                </span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 stroke-[2.5]" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-black text-emerald-800 tracking-tight">
                  Rp {fs.grossProfit.toLocaleString('id-ID')}
                </h3>
                <p className="text-[11px] text-emerald-700 mt-1 font-bold flex items-center gap-1">
                  <span>Margin Rata-rata: {fs.grossProfitMargin}%</span>
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Laba per Transaksi:</span>
                <strong className="text-slate-800">
                  Rp{' '}
                  {fs.totalTransactions > 0
                    ? Math.round(fs.grossProfit / fs.totalTransactions).toLocaleString('id-ID')
                    : 0}
                </strong>
              </div>
            </div>

            {/* Card 3: Efisiensi Margin Menu */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Rata-rata Margin Menu
                </span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center">
                  <Percent className="w-5 h-5 stroke-[2.5]" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  {fs.grossProfitMargin}%
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 font-medium">
                  {fs.grossProfitMargin >= 50
                    ? 'Margin Sangat Sehat (>50%)'
                    : fs.grossProfitMargin >= 30
                    ? 'Margin Standar F&B (30-50%)'
                    : 'Perlu Optimasi Harga (<30%)'}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Menu Bintang Terlaris:</span>
                <strong className="text-slate-800 truncate max-w-[120px]">
                  {data?.topProducts[0]?.name || '-'}
                </strong>
              </div>
            </div>

            {/* Card 4: Modal Mengendap (Dead Stock) */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Modal Mengendap (Dead Stock)
                </span>
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-800 flex items-center justify-center">
                  <AlertOctagon className="w-5 h-5 stroke-[2.5]" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-black text-rose-700 tracking-tight">
                  Rp {totalDeadStockValue.toLocaleString('id-ID')}
                </h3>
                <p className="text-[11px] text-rose-600 mt-1 font-medium">
                  Dari {(data?.slowMovingProducts || []).length} produk slow-moving
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Rekomendasi:</span>
                <strong className="text-amber-700 font-bold">
                  {totalDeadStockValue > 0 ? 'Promo Cuci Gudang' : 'Stok Optimal'}
                </strong>
              </div>
            </div>
          </div>

          {/* Top 10 Best Sellers Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Award className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                    Peringkat Menu Terlaris &amp; Kontribusi Laba (*Leaderboard*)
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Diurutkan berdasarkan kuantitas produk yang paling banyak dipesan konsumen
                  </p>
                </div>
              </div>
              <span className="text-xs text-slate-400 font-bold self-start sm:self-auto">
                {data?.topProducts.length || 0} Menu Terpantau
              </span>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3 text-center w-12">Rank</th>
                    <th className="px-5 py-3">Menu / Produk</th>
                    <th className="px-5 py-3">Kategori</th>
                    <th className="px-5 py-3 text-right">Qty Terjual</th>
                    <th className="px-5 py-3 text-right">Total Omset</th>
                    <th className="px-5 py-3 text-right">Total Modal (HPP)</th>
                    <th className="px-5 py-3 text-right">Laba Bersih &amp; Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(!data?.topProducts || data.topProducts.length === 0) ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                        Belum ada data penjualan produk pada periode ini
                      </td>
                    </tr>
                  ) : (() => {
                    const topProductsList = data.topProducts;
                    const topTotalPages = Math.max(1, Math.ceil(topProductsList.length / topPageSize));
                    const safeTopPage = Math.min(Math.max(1, topPage), topTotalPages);
                    const paginatedTopProducts = topProductsList.slice(
                      (safeTopPage - 1) * topPageSize,
                      safeTopPage * topPageSize
                    );

                    return paginatedTopProducts.map((p, idx) => {
                      const rankNum = (safeTopPage - 1) * topPageSize + idx + 1;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-3.5 text-center font-bold">
                            {rankNum === 1 ? (
                              <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 inline-flex items-center justify-center font-black text-xs shadow-xs">
                                1
                              </span>
                            ) : rankNum === 2 ? (
                              <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 inline-flex items-center justify-center font-black text-xs">
                                2
                              </span>
                            ) : rankNum === 3 ? (
                              <span className="w-6 h-6 rounded-full bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center justify-center font-black text-xs">
                                3
                              </span>
                            ) : (
                              <span className="text-slate-400">{rankNum}</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-slate-900">{p.name}</div>
                            <span className="text-[10px] text-slate-400 font-mono">{p.sku}</span>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-slate-500 font-medium">
                            {p.categoryName}
                          </td>
                          <td className="px-5 py-3.5 text-right font-black text-slate-900">
                            {p.qtySold.toLocaleString('id-ID')}
                          </td>
                          <td className="px-5 py-3.5 text-right font-semibold text-slate-800">
                            Rp {p.revenue.toLocaleString('id-ID')}
                          </td>
                          <td className="px-5 py-3.5 text-right text-slate-500 font-medium">
                            Rp {p.cost.toLocaleString('id-ID')}
                          </td>
                          <td className="px-5 py-3.5 text-right font-black text-emerald-700">
                            Rp {p.profit.toLocaleString('id-ID')}{' '}
                            <span className="text-[10px] text-emerald-600 font-normal ml-1">
                              ({p.profitMargin}%)
                            </span>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {/* Mobile Top Products Card List */}
            <div className="block md:hidden divide-y divide-slate-100">
              {(!data?.topProducts || data.topProducts.length === 0) ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Belum ada data penjualan produk pada periode ini
                </div>
              ) : (() => {
                const topProductsList = data.topProducts;
                const topTotalPages = Math.max(1, Math.ceil(topProductsList.length / topPageSize));
                const safeTopPage = Math.min(Math.max(1, topPage), topTotalPages);
                const paginatedTopProducts = topProductsList.slice(
                  (safeTopPage - 1) * topPageSize,
                  safeTopPage * topPageSize
                );

                return paginatedTopProducts.map((p, idx) => {
                  const rankNum = (safeTopPage - 1) * topPageSize + idx + 1;
                  return (
                    <div key={p.id} className="p-4 space-y-2.5 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          {rankNum === 1 ? (
                            <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 inline-flex items-center justify-center font-black text-xs shrink-0 shadow-xs mt-0.5">
                              🥇
                            </span>
                          ) : rankNum === 2 ? (
                            <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 inline-flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                              🥈
                            </span>
                          ) : rankNum === 3 ? (
                            <span className="w-6 h-6 rounded-full bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                              🥉
                            </span>
                          ) : (
                            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 inline-flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                              #{rankNum}
                            </span>
                          )}
                          <div>
                            <div className="font-bold text-slate-900 text-sm leading-snug">{p.name}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-slate-400 font-mono">{p.sku}</span>
                              <span className="text-slate-300">•</span>
                              <span className="text-[10px] text-slate-500 font-medium">{p.categoryName}</span>
                            </div>
                          </div>
                        </div>

                        <span className="text-xs font-black text-slate-800 bg-slate-100 px-2.5 py-1 rounded-full shrink-0">
                          {p.qtySold.toLocaleString('id-ID')} Terjual
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between pt-1">
                        <span className="text-[11px] text-slate-400 font-medium">Total Omset</span>
                        <span className="text-base font-black text-slate-900">
                          Rp {p.revenue.toLocaleString('id-ID')}
                        </span>
                      </div>

                      {/* Mini Financial Comparison Grid */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">Modal (HPP)</span>
                          <span className="text-xs font-bold text-slate-600">
                            Rp {p.cost.toLocaleString('id-ID')}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">Laba Bersih &amp; Margin</span>
                          <span className="text-xs font-black text-emerald-700">
                            Rp {p.profit.toLocaleString('id-ID')} ({p.profitMargin}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {data?.topProducts && data.topProducts.length > 0 && (
              <TablePagination
                currentPage={Math.min(Math.max(1, topPage), Math.max(1, Math.ceil(data.topProducts.length / topPageSize)))}
                pageSize={topPageSize}
                totalItems={data.topProducts.length}
                onPageChange={setTopPage}
                onPageSizeChange={setTopPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
                itemLabel="menu"
              />
            )}
          </div>

          {/* Slow-Moving Products Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-amber-50/40">
              <div className="flex items-center gap-2.5">
                <AlertOctagon className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                    Analisis Slow-Moving &amp; Potensi Dead Stock (Cuci Gudang)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Produk dengan penjualan rendah (≤ 2 pcs) namun masih memiliki stok fisik mengendap di toko
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-xl self-start sm:self-auto">
                {data?.slowMovingProducts?.length || 0} Produk Terdeteksi
              </span>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Produk</th>
                    <th className="px-5 py-3">Kategori</th>
                    <th className="px-5 py-3 text-right">Sisa Stok Fisik</th>
                    <th className="px-5 py-3 text-right">HPP Modal Beli</th>
                    <th className="px-5 py-3 text-right">Harga Jual</th>
                    <th className="px-5 py-3 text-right">Terjual (Periode Ini)</th>
                    <th className="px-5 py-3 text-right">Nilai Modal Mengendap</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(!data?.slowMovingProducts || data.slowMovingProducts.length === 0) ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                        Tidak ada barang slow-moving. Perputaran stok barang Anda sangat sehat! 🎉
                      </td>
                    </tr>
                  ) : (() => {
                    const slowList = data.slowMovingProducts;
                    const slowTotalPages = Math.max(1, Math.ceil(slowList.length / slowPageSize));
                    const safeSlowPage = Math.min(Math.max(1, slowPage), slowTotalPages);
                    const paginatedSlow = slowList.slice(
                      (safeSlowPage - 1) * slowPageSize,
                      safeSlowPage * slowPageSize
                    );

                    return paginatedSlow.map((p) => (
                      <tr key={p.id} className="hover:bg-amber-50/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-slate-900">{p.name}</div>
                          <span className="text-[10px] text-slate-400 font-mono">{p.sku}</span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-slate-500">
                          {p.categoryName}
                        </td>
                        <td className="px-5 py-3.5 text-right font-black text-slate-900">
                          {p.currentStock.toLocaleString('id-ID')} unit
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-slate-600">
                          Rp {p.costPrice.toLocaleString('id-ID')}
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-slate-800">
                          Rp {p.basePrice.toLocaleString('id-ID')}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-amber-700">
                          {p.qtySold} unit
                        </td>
                        <td className="px-5 py-3.5 text-right font-black text-rose-600">
                          Rp {(p.currentStock * p.costPrice).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>

            {/* Mobile Slow-Moving Card List */}
            <div className="block md:hidden divide-y divide-slate-100">
              {(!data?.slowMovingProducts || data.slowMovingProducts.length === 0) ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Tidak ada barang slow-moving. Perputaran stok barang Anda sangat sehat! 🎉
                </div>
              ) : (() => {
                const slowList = data.slowMovingProducts;
                const slowTotalPages = Math.max(1, Math.ceil(slowList.length / slowPageSize));
                const safeSlowPage = Math.min(Math.max(1, slowPage), slowTotalPages);
                const paginatedSlow = slowList.slice(
                  (safeSlowPage - 1) * slowPageSize,
                  safeSlowPage * slowPageSize
                );

                return paginatedSlow.map((p) => (
                  <div key={p.id} className="p-4 space-y-2.5 hover:bg-amber-50/20 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900 text-sm leading-snug">{p.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-slate-400 font-mono">{p.sku}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-[10px] text-slate-500 font-medium">{p.categoryName}</span>
                        </div>
                      </div>

                      <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
                        {p.qtySold} Terjual
                      </span>
                    </div>

                    {/* Stock & Idle Capital Comparison */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">Sisa Stok Fisik</span>
                        <span className="text-xs font-bold text-slate-900">
                          {p.currentStock.toLocaleString('id-ID')} unit
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">Modal Mengendap</span>
                        <span className="text-xs font-black text-rose-600">
                          Rp {(p.currentStock * p.costPrice).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                      <span>Harga Beli (HPP): <strong className="text-slate-700">Rp {p.costPrice.toLocaleString('id-ID')}</strong></span>
                      <span>Harga Jual: <strong className="text-slate-800">Rp {p.basePrice.toLocaleString('id-ID')}</strong></span>
                    </div>
                  </div>
                ));
              })()}
            </div>

            {data?.slowMovingProducts && data.slowMovingProducts.length > 0 && (
              <TablePagination
                currentPage={Math.min(Math.max(1, slowPage), Math.max(1, Math.ceil(data.slowMovingProducts.length / slowPageSize)))}
                pageSize={slowPageSize}
                totalItems={data.slowMovingProducts.length}
                onPageChange={setSlowPage}
                onPageSizeChange={setSlowPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
                itemLabel="produk"
              />
            )}
          </div>
        </>
      ) : null}

      {/* Modal Edukasi Upgrade PRO */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        title="Buka Analisis Menu & HPP dengan Paket PRO"
        message="Fitur Laporan HPP & Analisis Menu hanya tersedia pada Paket PRO. Upgrade sekarang untuk mengaktifkan!"
        featureHighlight="Analisis Menu & HPP"
      />
    </div>
  );
};
