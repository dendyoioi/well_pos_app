import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Receipt,
  CreditCard,
  Banknote,
  Download,
  Calendar,
  Printer,
  Percent,
  Lock,
  Sparkles,
  Zap,
  Globe,
  Store,
  Coins,
  Boxes,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../services/api';
import type { FinancialReportData } from '../types/report';
import type { Outlet } from '../types/outlet';
import { usePlan } from '../hooks/usePlan';
import { UpgradeModal } from '../components/UpgradeModal';
import { computePresetDateRange } from '../utils/date';
import { TablePagination } from '../components/TablePagination';
import { SalesProfitTrendChart } from '../components/SalesProfitTrendChart';
import { TableSkeleton } from '../components/ui';
import { CashFlowReportTab } from '../components/CashFlowReportTab';

interface FinancialReportViewProps {
  activeOutlet?: Outlet | null;
}

export const FinancialReportView: React.FC<FinancialReportViewProps> = ({ activeOutlet }) => {
  const { isFree } = usePlan();
  const [activeReportSubTab, setActiveReportSubTab] = useState<'pnl' | 'cashflow'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('subtab') === 'cashflow') return 'cashflow';
    }
    return 'pnl';
  });

  const handleSubTabChange = (tab: 'pnl' | 'cashflow') => {
    setActiveReportSubTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (tab === 'cashflow') {
        url.searchParams.set('subtab', 'cashflow');
      } else {
        url.searchParams.delete('subtab');
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  const [data, setData] = useState<FinancialReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLockedByApi, setIsLockedByApi] = useState<boolean>(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState<boolean>(false);
  const [periodPreset, setPeriodPreset] = useState<'today' | '7days' | '30days' | 'thisMonth' | 'custom'>('today');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // Pagination for Daily Trends Table (Standar Kanonikal 10/25/50/100)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Auto-reset page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
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
      console.error('Error fetching financial report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (periodPreset !== 'custom') {
      fetchReport();
    }
  }, [periodPreset, activeOutlet?.id]);

  // Ekspor Data Laporan Finansial ke CSV (Standar UTF-8 BOM untuk Excel)
  const handleExportCSV = () => {
    if (!data) return;

    const summaryRows = [
      ['LAPORAN AKUNTANSI & KEUANGAN PENJUALAN POS'],
      ['Toko / Outlet', activeOutlet && !activeOutlet.isWarehouse ? activeOutlet.name : 'Seluruh Toko'],
      ['Rentang Waktu', `${data.filter.startDate.slice(0, 10)} s/d ${data.filter.endDate.slice(0, 10)}`],
      ['Tanggal Cetak', new Date().toLocaleString('id-ID')],
      [''],
      ['RINGKASAN FINANSIAL UTAMA'],
      ['Total Omset Bersih (Net Revenue)', `Rp ${data.financialSummary.totalNetRevenue}`],
      ['Total Modal Barang Terjual (COGS / HPP)', `Rp ${data.financialSummary.totalCOGS}`],
      ['Laba Kotor Penjualan (Gross Profit)', `Rp ${data.financialSummary.grossProfit}`],
      ['Margin Laba Kotor (Gross Margin %)', `${data.financialSummary.grossProfitMargin}%`],
      ['Total Faktur Penjualan', `${data.financialSummary.totalTransactions}`],
      ['Rata-rata Nilai Belanja (AOV)', `Rp ${data.financialSummary.averageOrderValue}`],
      ['Total Diskon Promosi', `Rp ${data.financialSummary.totalDiscounts}`],
      ['Titipan PPN (11%)', `Rp ${data.financialSummary.totalTax}`],
      ['Service Charge', `Rp ${data.financialSummary.totalService}`],
      ['Arus Kas Tunai (Cash)', `Rp ${data.cashFlow.cash.amount} (${data.cashFlow.cash.percentage}%)`],
      ['Arus Kas QRIS / Non-Tunai', `Rp ${data.cashFlow.qris.amount} (${data.cashFlow.qris.percentage}%)`],
      [''],
      ['RINCIAN TREN PENJUALAN & HPP HARIAN'],
      ['Tanggal', 'Jumlah Faktur', 'Total Omset Bersih', 'Total HPP', 'Laba Kotor', 'Tunai (Cash)', 'Non-Tunai (QRIS)'],
      ...(data.dailyTrends || []).map((d) => [
        d.date,
        d.ordersCount,
        d.revenue,
        d.cogs || 0,
        d.grossProfit || 0,
        d.cashRevenue,
        d.qrisRevenue,
      ]),
      [''],
      ['KONTRIBUSI OMSET PER KANAL PENJUALAN'],
      ['Kanal / Mitra', 'Total Transaksi', 'Total Omset', 'Kontribusi (%)'],
      ...(data.channelSales || []).map((ch) => [
        `"${ch.name}"`,
        ch.count,
        ch.amount,
        `${ch.percentage}%`,
      ]),
      [''],
      ['PENJUALAN BERDASARKAN KATEGORI'],
      ['Nama Kategori', 'Total Qty', 'Total Omset', 'Persentase'],
      ...data.salesByCategory.map((c) => [
        `"${c.name}"`,
        c.qtySold,
        c.revenue,
        `${c.percentage}%`,
      ]),
    ];

    const csvContent = '\uFEFF' + summaryRows.map((e) => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Laporan_Finansial_Penjualan_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const fs = data?.financialSummary;

  return (
    <div className="space-y-6 pb-28 sm:pb-16 font-sans">
      {/* Subtab Navigation: Laba Rugi vs Arus Kas */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 no-print w-full sm:w-fit">
        <button
          type="button"
          onClick={() => handleSubTabChange('pnl')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 h-9 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeReportSubTab === 'pnl'
              ? 'bg-blue-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Laba Rugi &amp; Finansial (P&amp;L)</span>
        </button>
        <button
          type="button"
          onClick={() => handleSubTabChange('cashflow')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 h-9 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            activeReportSubTab === 'cashflow'
              ? 'bg-blue-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Banknote className="w-4 h-4" />
          <span>Arus Kas Riil &amp; Performa Toko</span>
        </button>
      </div>

      {activeReportSubTab === 'cashflow' ? (
        <CashFlowReportTab activeOutlet={activeOutlet} />
      ) : (
        <>
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm no-print">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-blue-900 text-white flex items-center justify-center shadow-md shadow-blue-900/20 shrink-0">
                <TrendingUp className="w-6 h-6 stroke-[2.5] shrink-0" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    Laporan Penjualan &amp; Finansial
                  </h2>
                  {activeOutlet && !activeOutlet.isWarehouse && (
                    <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-900 font-bold text-[10px]">
                      <Store className="w-3 h-3 shrink-0" />
                      <span>{activeOutlet.name}</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Rekapitulasi pendapatan omset (*Net Revenue*), arus kas pembayaran kasir, pajak PPN, dan kontribusi kanal penjualan.
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
                className={`flex-1 sm:flex-initial justify-center h-10 px-4 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                  isLocked
                    ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {isLocked ? <Lock className="w-4 h-4 text-amber-600" /> : <Printer className="w-4 h-4" />}
                <span>Cetak</span>
                {isLocked && <span className="px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded text-[9px] font-black">PRO</span>}
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
                className={`flex-1 sm:flex-initial justify-center h-10 px-4 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer ${
                  isLocked
                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                    : 'bg-blue-900 hover:bg-blue-950 text-white shadow-blue-900/20'
                }`}
              >
                {isLocked ? <Lock className="w-4 h-4" /> : <Download className="w-4 h-4 stroke-[2.5]" />}
                <span>Ekspor CSV</span>
                {isLocked && <span className="px-1.5 py-0.5 bg-white/20 text-white rounded text-[9px] font-black">PRO</span>}
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
                  className={`h-10 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
                  className="h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                />
                <span className="text-xs text-slate-400 font-bold">s/d</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                />
                <button
                  onClick={fetchReport}
                  className="h-10 px-4 bg-blue-900 text-white rounded-xl text-xs font-bold hover:bg-blue-950 transition-all shadow-xs cursor-pointer"
                >
                  Terapkan
                </button>
              </div>
            )}
          </div>

      {/* Konten Laporan: Jika akun FREE, tampilkan Teaser Banner Gembok */}
      {isLocked ? (
        <div className="space-y-6 animate-fadeIn">
          {/* Paywall Hero Banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 p-6 sm:p-8 text-white border border-indigo-700/50 shadow-2xl">
            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-black tracking-wider uppercase mb-4">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Fitur Eksklusif Paket PRO</span>
              </div>
              
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Buka Visibilitas Finansial &amp; Rekapitulasi Kas Kasir
              </h3>
              
              <p className="text-slate-300 text-xs sm:text-sm mt-3 leading-relaxed">
                Fitur ini secara otomatis merekapitulasi <strong>Omset Penjualan Bersih (*Net Revenue*)</strong>, <strong>Arus Kas Masuk (Tunai vs QRIS)</strong>, pajak PPN &amp; service charge, serta rincian penjualan per kanal.
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
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white p-5 rounded-3xl border border-slate-200 animate-pulse h-28 space-y-3">
                <div className="h-4 bg-slate-200 rounded w-1/2" />
                <div className="h-6 bg-slate-200 rounded w-3/4" />
              </div>
            ))}
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
            <table className="w-full">
              <tbody>
                <TableSkeleton rows={5} columns={8} />
              </tbody>
            </table>
          </div>
        </div>
      ) : fs ? (
        <>
          {/* Smart Business Intelligence (BI) Insights & Executive Highlights */}
          {data?.insights && (
            <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 p-5 sm:p-6 rounded-3xl text-white shadow-md border border-blue-800/40 relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[10px] font-black tracking-wider uppercase">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Executive BI Smart Insights</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                    Ringkasan Kinerja &amp; Pola Transaksi Toko
                  </h3>
                  <p className="text-xs text-slate-300">
                    Analisis pintar otomatis berdasarkan seluruh arus transaksi dan marjin operasional aktif.
                  </p>
                </div>

                {/* 4 Quick Stat Pills */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10 space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-300 uppercase block flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-300" /> Jam Tersibuk
                    </span>
                    <strong className="text-xs sm:text-sm font-black text-amber-300 font-mono block truncate">
                      {data.insights.peakHour}
                    </strong>
                    <span className="text-[9px] text-slate-300 block">
                      {data.insights.peakHourOrdersCount} transaksi puncak
                    </span>
                  </div>

                  <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10 space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-300 uppercase block flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-blue-300" /> Rata-Rata Nota
                    </span>
                    <strong className="text-xs sm:text-sm font-black text-white font-mono block truncate">
                      Rp {fs.averageOrderValue.toLocaleString('id-ID')}
                    </strong>
                    <span className="text-[9px] text-slate-300 block">
                      per keranjang belanja
                    </span>
                  </div>

                  <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10 space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-300 uppercase block flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-300" /> Kesehatan Marjin
                    </span>
                    <div className="pt-0.5">
                      <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded-full ${
                        data.insights.profitHealthStatus === 'SEHAT'
                          ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                          : data.insights.profitHealthStatus === 'WASPADA'
                          ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                          : 'bg-rose-400/20 text-rose-300 border border-rose-400/30'
                      }`}>
                        MARJIN {data.insights.profitHealthStatus} ({fs.grossProfitMargin}%)
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-300 block">
                      Benchmark &gt;40% Prima
                    </span>
                  </div>

                  <div className="bg-white/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10 space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-300 uppercase block truncate">
                      🏆 Menu Unggulan
                    </span>
                    <strong className="text-xs sm:text-sm font-black text-white block truncate" title={data.insights.highMarginChampion || 'Belum Ada'}>
                      {data.insights.highMarginChampion || 'Stabil'}
                    </strong>
                    <span className="text-[9px] text-emerald-300 block">
                      Kontributor laba utama
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Financial KPI Cards (7 Cards: Net Revenue, COGS, Gross Profit, Net Operating Profit, Transactions, Tax/Service, Discounts) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Omset Penjualan Bersih */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
                  Total Omset Bersih
                </span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5 stroke-[2.5] shrink-0" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight font-mono">
                  Rp {fs.totalNetRevenue.toLocaleString('id-ID')}
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
                  <span>Gross: <span className="font-mono">Rp {fs.totalGrossSales.toLocaleString('id-ID')}</span></span>
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Rata-rata Belanja (AOV):</span>
                <strong className="text-slate-800 font-mono">
                  Rp {fs.averageOrderValue.toLocaleString('id-ID')}
                </strong>
              </div>
            </div>

            {/* Card 2: Total HPP / Modal Bahan Baku (COGS) */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
                  Total Modal / HPP (COGS)
                </span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center shrink-0">
                  <Boxes className="w-5 h-5 stroke-[2.5] shrink-0" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-black text-amber-900 tracking-tight font-mono">
                  Rp {fs.totalCOGS.toLocaleString('id-ID')}
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 font-medium">
                  Beban modal pokok produk terjual
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Rasio Beban HPP:</span>
                <strong className="text-amber-800 font-bold font-mono">
                  {fs.totalNetRevenue > 0
                    ? ((fs.totalCOGS / fs.totalNetRevenue) * 100).toFixed(1)
                    : 0}
                  % dari omset bersih
                </strong>
              </div>
            </div>

            {/* Card 3: Laba Kotor (Gross Profit & Margin %) */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
                  Laba Kotor (Gross Profit)
                </span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
                  <Coins className="w-5 h-5 stroke-[2.5] shrink-0" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-black text-emerald-800 tracking-tight font-mono">
                  Rp {fs.grossProfit.toLocaleString('id-ID')}
                </h3>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono">
                    Margin: {fs.grossProfitMargin}%
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">(Net - Pajak - HPP)</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Status Profitabilitas:</span>
                <strong className={fs.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                  {fs.grossProfit >= 0 ? 'Surplus Laba Positif' : 'Defisit Margin'}
                </strong>
              </div>
            </div>

            {/* Card 3B: Laba Bersih Operasional (Net Operating Profit) */}
            <div className="bg-white p-5 rounded-3xl border border-indigo-200 shadow-sm relative overflow-hidden bg-gradient-to-b from-indigo-50/30 to-white">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider truncate">
                  Laba Bersih Operasional
                </span>
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-900 flex items-center justify-center shadow-xs shrink-0">
                  <TrendingUp className="w-5 h-5 stroke-[2.5] shrink-0" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-black text-indigo-950 tracking-tight font-mono">
                  Rp {((fs.netOperatingProfit !== undefined ? fs.netOperatingProfit : fs.grossProfit) || 0).toLocaleString('id-ID')}
                </h3>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-200 font-mono">
                    Net Margin: {fs.netOperatingProfitMargin !== undefined ? fs.netOperatingProfitMargin : fs.grossProfitMargin}%
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">(Laba Kotor - Kas OPEX)</span>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-indigo-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Biaya Kasir Keluar:</span>
                <strong className="text-rose-600 font-bold font-mono">
                  -Rp {(fs.totalOperatingExpenses || 0).toLocaleString('id-ID')}
                </strong>
              </div>
            </div>

            {/* Card 4: Total Transaksi Berhasil */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
                  Faktur Transaksi
                </span>
                <div className="w-9 h-9 rounded-xl bg-slate-50 text-slate-800 flex items-center justify-center shrink-0">
                  <Receipt className="w-5 h-5 stroke-[2.5] shrink-0" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight font-mono">
                  {fs.totalTransactions.toLocaleString('id-ID')} Faktur
                </h3>
                <p className="text-[11px] text-emerald-700 mt-1 font-medium">
                  Transaksi kasir berstatus lunas
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Rata-rata Harian:</span>
                <strong className="text-slate-800 font-mono">
                  {data?.dailyTrends && data.dailyTrends.length > 0
                    ? Math.round(fs.totalTransactions / data.dailyTrends.length)
                    : fs.totalTransactions}{' '}
                  trx / hari
                </strong>
              </div>
            </div>

            {/* Card 5: PPN & Service Charge */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
                  PPN &amp; Service Charge
                </span>
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-800 flex items-center justify-center shrink-0">
                  <Percent className="w-5 h-5 stroke-[2.5] shrink-0" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight font-mono">
                  Rp {(fs.totalTax + fs.totalService).toLocaleString('id-ID')}
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 font-medium">
                  PPN: <span className="font-mono">Rp {fs.totalTax.toLocaleString('id-ID')}</span>
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Service Charge:</span>
                <strong className="text-slate-800 font-mono">
                  Rp {fs.totalService.toLocaleString('id-ID')}
                </strong>
              </div>
            </div>

            {/* Card 6: Diskon & Promosi Terpakai */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
                  Total Diskon Promosi
                </span>
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-800 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5 stroke-[2.5] shrink-0" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-black text-rose-700 tracking-tight font-mono">
                  Rp {fs.totalDiscounts.toLocaleString('id-ID')}
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 font-medium">
                  Voucher &amp; diskon kasir yang dimanfaatkan
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Rasio Diskon:</span>
                <strong className="text-rose-600 font-mono">
                  {fs.totalGrossSales > 0
                    ? ((fs.totalDiscounts / fs.totalGrossSales) * 100).toFixed(1)
                    : 0}
                  % dari omset kotor
                </strong>
              </div>
            </div>
          </div>

          {/* Grid 2: Arus Kas & Analisis Kategori */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Arus Kas (Payment Breakdown) */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                  Rekap Arus Kas (Metode Bayar)
                </h3>
                <span className="text-xs text-slate-400 font-bold">100% Realtime</span>
              </div>

              <div className="space-y-4">
                {/* Cash */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Banknote className="w-4 h-4 text-emerald-600" /> Uang Tunai (Cash)
                    </span>
                    <span className="font-black text-slate-900">
                      Rp {data?.cashFlow.cash.amount.toLocaleString('id-ID')} ({data?.cashFlow.cash.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${data?.cashFlow.cash.percentage || 0}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 block text-right">
                    {data?.cashFlow.cash.count} transaksi di laci kasir
                  </span>
                </div>

                {/* QRIS */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-blue-600" /> Non-Tunai (QRIS)
                    </span>
                    <span className="font-black text-slate-900">
                      Rp {data?.cashFlow.qris.amount.toLocaleString('id-ID')} ({data?.cashFlow.qris.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${data?.cashFlow.qris.percentage || 0}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 block text-right">
                    {data?.cashFlow.qris.count} transaksi via dompet digital / m-banking
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-blue-50/70 border border-blue-200/60 rounded-2xl text-[11px] text-blue-950 space-y-1">
                <span className="font-bold block">💡 Rekonsiliasi Kas:</span>
                <p className="text-blue-900/80 leading-relaxed">
                  Total arus kas masuk sama dengan nilai grand total seluruh faktur belanjaan yang lunas.
                </p>
              </div>
            </div>

            {/* Penjualan per Kategori */}
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                  Distribusi Pendapatan per Kategori
                </h3>
                <span className="text-xs text-slate-400 font-bold">
                  {data?.salesByCategory.length} Kategori
                </span>
              </div>

              <div className="space-y-3">
                {data?.salesByCategory.map((cat) => (
                  <div key={cat.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-slate-800">{cat.name}</span>
                      <span className="font-black text-slate-900">
                        Rp {cat.revenue.toLocaleString('id-ID')} ({cat.percentage}%) •{' '}
                        <span className="text-slate-500 font-normal">{cat.qtySold} pcs</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-900 h-full rounded-full transition-all duration-500"
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Distribusi Penjualan per Kanal & Mitra Online */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center font-bold">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                    Kontribusi Omset per Kanal Penjualan &amp; Mitra Online
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Evaluasi saluran penjualan (Dine In vs Takeaway vs GoFood vs GrabFood vs ShopeeFood vs Kurir)
                  </p>
                </div>
              </div>
              <span className="text-xs text-slate-400 font-bold self-start sm:self-auto">
                {data?.channelSales?.length || 0} Kanal Teridentifikasi
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(data?.channelSales || []).length === 0 ? (
                <div className="col-span-full py-8 text-center text-slate-400 text-xs font-medium">
                  Belum ada data transaksi kanal pada periode ini
                </div>
              ) : (
                data?.channelSales?.map((ch) => (
                  <div
                    key={ch.channel}
                    className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-900 shrink-0" />
                        <span>{ch.name}</span>
                      </span>
                      <span className="text-xs font-black text-blue-900 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                        {ch.percentage}%
                      </span>
                    </div>

                    <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-900 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, ch.percentage)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>{ch.count} transaksi</span>
                      <strong className="text-slate-900 font-black">
                        Rp {ch.amount.toLocaleString('id-ID')}
                      </strong>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Visual Trendline Chart: Omzet vs HPP vs Laba Kotor (Native SVG) */}
          {data?.dailyTrends && data.dailyTrends.length > 0 && (
            <SalesProfitTrendChart dailyTrends={data.dailyTrends} />
          )}

          {/* Daily Trends Breakdown Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-5 h-5 text-blue-900 shrink-0" />
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                    Rincian Penjualan &amp; Arus Kas Harian
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Rekapitulasi volume transaksi, perolehan omset bersih, serta perbandingan kas tunai dan QRIS per tanggal
                  </p>
                </div>
              </div>
              <span className="text-xs text-slate-400 font-bold self-start sm:self-auto">
                {(data?.dailyTrends || []).length} Hari Tercatat
              </span>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Tanggal</th>
                    <th className="px-5 py-3 text-right">Faktur</th>
                    <th className="px-5 py-3 text-right">Omset Bersih</th>
                    <th className="px-5 py-3 text-right text-amber-900">Total HPP</th>
                    <th className="px-5 py-3 text-right text-emerald-800">Laba Kotor</th>
                    <th className="px-5 py-3 text-right">Tunai (Cash)</th>
                    <th className="px-5 py-3 text-right">Non-Tunai (QRIS)</th>
                    <th className="px-5 py-3 text-right">AOV Belanja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <TableSkeleton rows={5} columns={8} />
                  ) : (!data?.dailyTrends || data.dailyTrends.length === 0) ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                        Belum ada catatan penjualan harian pada periode ini
                      </td>
                    </tr>
                  ) : (() => {
                    const dailyTrendsList = data.dailyTrends;
                    const totalPages = Math.max(1, Math.ceil(dailyTrendsList.length / pageSize));
                    const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
                    const paginatedTrends = dailyTrendsList.slice(
                      (safeCurrentPage - 1) * pageSize,
                      safeCurrentPage * pageSize
                    );

                    return paginatedTrends.map((d) => (
                      <tr key={d.date} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-slate-900">
                          {new Date(d.date).toLocaleDateString('id-ID', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="px-5 py-3.5 text-right font-black font-mono text-slate-900">
                          {d.ordersCount} faktur
                        </td>
                        <td className="px-5 py-3.5 text-right font-black font-mono text-blue-900">
                          Rp {d.revenue.toLocaleString('id-ID')}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold font-mono text-amber-800">
                          Rp {(d.cogs || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="px-5 py-3.5 text-right font-black font-mono text-emerald-700">
                          Rp {(d.grossProfit || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold font-mono text-emerald-700">
                          Rp {d.cashRevenue.toLocaleString('id-ID')}
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold font-mono text-blue-700">
                          Rp {d.qrisRevenue.toLocaleString('id-ID')}
                        </td>
                        <td className="px-5 py-3.5 text-right text-slate-500 font-medium font-mono">
                          Rp {d.ordersCount > 0 ? Math.round(d.revenue / d.ordersCount).toLocaleString('id-ID') : 0}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>

            {/* Mobile Daily Trend Card List */}
            <div className="block md:hidden divide-y divide-slate-100">
              {(!data?.dailyTrends || data.dailyTrends.length === 0) ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Belum ada catatan penjualan harian pada periode ini
                </div>
              ) : (() => {
                const dailyTrendsList = data.dailyTrends;
                const totalPages = Math.max(1, Math.ceil(dailyTrendsList.length / pageSize));
                const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
                const paginatedTrends = dailyTrendsList.slice(
                  (safeCurrentPage - 1) * pageSize,
                  safeCurrentPage * pageSize
                );

                return paginatedTrends.map((d) => (
                  <div key={d.date} className="p-4 space-y-2.5 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {new Date(d.date).toLocaleDateString('id-ID', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                        {d.ordersCount} Faktur
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between pt-1">
                      <span className="text-[11px] text-slate-400 font-medium">Omset Bersih</span>
                      <span className="text-base font-black font-mono text-blue-900">
                        Rp {d.revenue.toLocaleString('id-ID')}
                      </span>
                    </div>

                    {/* HPP & Laba Kotor Mobile Summary */}
                    <div className="grid grid-cols-2 gap-2 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/60 text-center">
                      <div>
                        <span className="text-[10px] text-amber-800 block font-medium">Modal / HPP</span>
                        <span className="text-xs font-bold font-mono text-amber-900">
                          Rp {(d.cogs || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-800 block font-medium">Laba Kotor</span>
                        <span className="text-xs font-bold font-mono text-emerald-800">
                          Rp {(d.grossProfit || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    {/* Breakdown Kas Tunai vs QRIS */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">Uang Tunai</span>
                        <span className="text-xs font-bold font-mono text-emerald-700">
                          Rp {d.cashRevenue.toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">QRIS / Non-Tunai</span>
                        <span className="text-xs font-bold font-mono text-blue-700">
                          Rp {d.qrisRevenue.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                      <span>Rata-rata Nilai Belanja (AOV):</span>
                      <strong className="text-slate-800 font-mono">
                        Rp {d.ordersCount > 0 ? Math.round(d.revenue / d.ordersCount).toLocaleString('id-ID') : 0}
                      </strong>
                    </div>
                  </div>
                ));
              })()}
            </div>

            {data?.dailyTrends && data.dailyTrends.length > 0 && (
              <TablePagination
                currentPage={Math.min(Math.max(1, currentPage), Math.max(1, Math.ceil(data.dailyTrends.length / pageSize)))}
                pageSize={pageSize}
                totalItems={data.dailyTrends.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
                itemLabel="hari"
              />
            )}
          </div>
        </>
      ) : null}
        </>
      )}

      {/* Modal Edukasi Upgrade PRO */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        title="Buka Laporan Penjualan & Finansial dengan Paket PRO"
        message="Fitur Laporan Finansial & Arus Kas Kasir hanya tersedia pada Paket PRO. Upgrade sekarang untuk mengaktifkan!"
        featureHighlight="Laporan Penjualan & Finansial"
      />
    </div>
  );
};
