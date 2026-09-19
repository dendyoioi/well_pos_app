import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Package,
  CreditCard,
  Banknote,
  Download,
  Calendar,
  RefreshCw,
  Printer,
  Award,
  Percent,
  Lock,
  Sparkles,
  Zap,
  AlertOctagon,
} from 'lucide-react';
import { api } from '../services/api';
import type { FinancialReportData } from '../types/report';
import { usePlan } from '../hooks/usePlan';
import { UpgradeModal } from '../components/UpgradeModal';

export const FinancialReportView: React.FC = () => {
  const { isFree } = usePlan();
  const [data, setData] = useState<FinancialReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLockedByApi, setIsLockedByApi] = useState<boolean>(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState<boolean>(false);
  const [periodPreset, setPeriodPreset] = useState<'today' | '7days' | '30days' | 'thisMonth' | 'custom'>('30days');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const isLocked = isFree || isLockedByApi;

  const computeDates = (preset: string) => {
    const now = new Date();
    const endStr = now.toISOString().slice(0, 10);
    let startStr = endStr;

    if (preset === 'today') {
      startStr = endStr;
    } else if (preset === '7days') {
      const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startStr = d.toISOString().slice(0, 10);
    } else if (preset === '30days') {
      const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startStr = d.toISOString().slice(0, 10);
    } else if (preset === 'thisMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      startStr = firstDay.toISOString().slice(0, 10);
    }

    return { startStr, endStr };
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

      const res = await api.getFinancialReport({ startDate, endDate });
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
  }, [periodPreset]);

  // Ekspor Data ke File CSV
  const handleExportCSV = () => {
    if (!data) return;

    const summaryRows = [
      ['LAPORAN AKUNTANSI & KEUANGAN POS'],
      ['Rentang Waktu', `${data.filter.startDate.slice(0, 10)} s/d ${data.filter.endDate.slice(0, 10)}`],
      ['Tanggal Cetak', new Date().toLocaleString('id-ID')],
      [''],
      ['RINGKASAN FINANSIAL UTAMA'],
      ['Total Omset Bersih (Net Revenue)', `Rp ${data.financialSummary.totalNetRevenue}`],
      ['Total Modal Barang Terjual (COGS / HPP)', `Rp ${data.financialSummary.totalCOGS}`],
      ['Laba Kotor (Gross Profit)', `Rp ${data.financialSummary.grossProfit}`],
      ['Margin Laba Kotor', `${data.financialSummary.grossProfitMargin}%`],
      ['Total Faktur Penjualan', `${data.financialSummary.totalTransactions}`],
      ['Rata-rata Nilai Belanja (AOV)', `Rp ${data.financialSummary.averageOrderValue}`],
      ['Arus Kas Tunai (Cash)', `Rp ${data.cashFlow.cash.amount} (${data.cashFlow.cash.percentage}%)`],
      ['Arus Kas QRIS', `Rp ${data.cashFlow.qris.amount} (${data.cashFlow.qris.percentage}%)`],
      [''],
      ['TOP 10 PRODUK TERLARIS'],
      ['Peringkat', 'SKU', 'Nama Produk', 'Kategori', 'Qty Terjual', 'Omset Penjualan', 'HPP Modal', 'Laba Bersih Produk'],
      ...data.topProducts.map((p, idx) => [
        idx + 1,
        p.sku,
        `"${p.name}"`,
        `"${p.categoryName}"`,
        p.qtySold,
        p.revenue,
        p.cost,
        p.profit,
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
      [''],
      ['ANALISIS SLOW-MOVING & POTENSI DEAD STOCK'],
      ['SKU', 'Nama Produk', 'Kategori', 'Sisa Stok', 'HPP Modal', 'Harga Jual', 'Qty Terjual', 'Nilai Modal Mengendap'],
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
    link.setAttribute('download', `Laporan_Keuangan_POS_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fs = data?.financialSummary;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm no-print">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-900 text-white flex items-center justify-center shadow-md shadow-blue-900/20">
            <TrendingUp className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Laporan Akuntansi & Finansial
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Analisis pendapatan omset (*Net Revenue*), modal barang (*COGS/HPP*), laba kotor, dan arus kas kasir.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => {
              if (isLocked) {
                setUpgradeModalOpen(true);
                return;
              }
              window.print();
            }}
            disabled={!data && !isLocked}
            className={`px-4 py-2.5 font-bold rounded-xl text-xs flex items-center gap-2 transition-all ${
              isLocked
                ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {isLocked ? <Lock className="w-4 h-4 text-amber-600" /> : <Printer className="w-4 h-4" />}
            <span>Cetak Laporan</span>
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
            className={`px-4 py-2.5 font-bold rounded-xl text-xs flex items-center gap-2 shadow-md transition-all ${
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
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
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

      {/* Konten Laporan: Jika akun FREE, tampilkan Teaser Banner Gembok */}
      {isLocked ? (
        <div className="space-y-6 animate-fadeIn">
          {/* Paywall Hero Banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 p-6 sm:p-8 text-white border border-indigo-700/50 shadow-2xl">
            <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-black tracking-wider uppercase mb-4">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Fitur Eksklusif Paket PRO</span>
              </div>
              
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Buka Visibilitas Keuntungan Bisnis dengan Laporan HPP & Laba Bersih
              </h3>
              
              <p className="text-slate-300 text-xs sm:text-sm mt-3 leading-relaxed">
                Fitur ini secara otomatis mengkalkulasi <strong>Modal Pokok Barang (COGS / HPP)</strong>, <strong>Laba Kotor (*Gross Profit*)</strong>, margin keuntungan per kategori, serta arus kas harian dari setiap transaksi kasir.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs mb-1">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Lacak Modal HPP</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Ketahui nilai modal barang per produk yang terjual secara real-time.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs mb-1">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Laba Bersih & Margin</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Evaluasi persentase margin keuntungan kotor per kategori toko.</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs mb-1">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Multi-Outlet & Staf</span>
                  </div>
                  <p className="text-[11px] text-slate-400">Ekspansi hingga 5 cabang dan 99 kasir tanpa batasan.</p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setUpgradeModalOpen(true)}
                  className="px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm rounded-2xl shadow-xl shadow-blue-900/30 transition-all flex items-center gap-2"
                >
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>Tingkatkan ke Paket PRO Sekarang (Rp 129.000 / bln)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Teaser Mockup Kartu & Tabel yang di-blur dengan Overlay Gembok */}
          <div className="relative rounded-3xl overflow-hidden border border-slate-200 bg-white p-6 shadow-sm select-none">
            {/* Overlay Gembok Center */}
            <div className="absolute inset-0 z-20 backdrop-blur-xs bg-slate-900/30 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white text-blue-950 shadow-2xl flex items-center justify-center mb-3">
                <Lock className="w-7 h-7 text-blue-900" />
              </div>
              <h4 className="text-base sm:text-lg font-black text-white drop-shadow-md">
                Data Finansial & HPP Terkunci
              </h4>
              <p className="text-xs text-slate-200 mt-1 max-w-sm drop-shadow-sm">
                Grafik omset, laba kotor, dan analisis HPP disembunyikan untuk paket FREE. Beralihlah ke paket PRO untuk membuka seluruh data.
              </p>
              <button
                type="button"
                onClick={() => setUpgradeModalOpen(true)}
                className="mt-4 px-5 py-2.5 bg-white hover:bg-slate-100 text-blue-950 font-black text-xs rounded-xl shadow-lg transition-all"
              >
                Buka Akses Laporan PRO
              </button>
            </div>

            {/* Mockup visual blurred */}
            <div className="filter blur-xs opacity-50 pointer-events-none space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-400">Total Omset Bersih</span>
                  <p className="text-2xl font-black text-slate-700 mt-2">Rp 45.850.000</p>
                </div>
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-400">Modal HPP (COGS)</span>
                  <p className="text-2xl font-black text-slate-700 mt-2">Rp 23.400.000</p>
                </div>
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-400">Laba Kotor (*Gross Profit*)</span>
                  <p className="text-2xl font-black text-emerald-700 mt-2">Rp 22.450.000</p>
                </div>
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-400">Margin Laba Kotor</span>
                  <p className="text-2xl font-black text-emerald-700 mt-2">48.9%</p>
                </div>
              </div>

              <div className="h-44 bg-slate-50 rounded-2xl border border-slate-200 p-4 flex items-center justify-center">
                <span className="text-xs font-bold text-slate-400">Tabel Analisis Top Produk & Kategori...</span>
              </div>
            </div>
          </div>
        </div>
      ) : loading && !data ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-900" />
          <span className="text-xs font-semibold">Mengkalkulasi metrik finansial & HPP...</span>
        </div>
      ) : fs ? (
        <>
          {/* Main Financial KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Omset Penjualan */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total Omset Bersih
                </span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 stroke-[2.5]" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  Rp {fs.totalNetRevenue.toLocaleString('id-ID')}
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
                  <span>Dari {fs.totalTransactions} faktur berhasil</span>
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Rata-rata Order (AOV):</span>
                <strong className="text-slate-800">
                  Rp {fs.averageOrderValue.toLocaleString('id-ID')}
                </strong>
              </div>
            </div>

            {/* Card 2: HPP / Modal Barang */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Total HPP (COGS)
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
                  Modal harga beli produk yang terjual
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Rasio HPP thdp Omset:</span>
                <strong className="text-slate-800">
                  {fs.totalNetRevenue > 0
                    ? ((fs.totalCOGS / fs.totalNetRevenue) * 100).toFixed(1)
                    : 0}
                  %
                </strong>
              </div>
            </div>

            {/* Card 3: Laba Kotor */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Laba Kotor (Gross Profit)
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
                  <span>Margin: {fs.grossProfitMargin}%</span>
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

            {/* Card 4: Titipan PPN & Biaya */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  PPN & Service Charge
                </span>
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-800 flex items-center justify-center">
                  <Percent className="w-5 h-5 stroke-[2.5]" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                  Rp {(fs.totalTax + fs.totalService).toLocaleString('id-ID')}
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 font-medium">
                  PPN 11%: Rp {fs.totalTax.toLocaleString('id-ID')}
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Diskon Terpakai:</span>
                <strong className="text-rose-600">
                  Rp {fs.totalDiscounts.toLocaleString('id-ID')}
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

          {/* Top 10 Best Sellers Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Award className="w-5 h-5 text-amber-500" />
                <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                  10 Produk Terlaris & Kontribusi Laba (*Leaderboard*)
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-bold">Berdasarkan Kuantitas Terjual</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3 text-center w-12">Rank</th>
                    <th className="px-5 py-3">Produk</th>
                    <th className="px-5 py-3">Kategori</th>
                    <th className="px-5 py-3 text-right">Qty Terjual</th>
                    <th className="px-5 py-3 text-right">Total Omset</th>
                    <th className="px-5 py-3 text-right">Total Modal (HPP)</th>
                    <th className="px-5 py-3 text-right">Laba Bersih</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.topProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                        Belum ada data penjualan produk
                      </td>
                    </tr>
                  ) : (
                    data?.topProducts.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5 text-center font-bold">
                          {idx === 0 ? (
                            <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 inline-flex items-center justify-center font-black text-xs">
                              1
                            </span>
                          ) : idx === 1 ? (
                            <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 inline-flex items-center justify-center font-black text-xs">
                              2
                            </span>
                          ) : idx === 2 ? (
                            <span className="w-6 h-6 rounded-full bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center justify-center font-black text-xs">
                              3
                            </span>
                          ) : (
                            <span className="text-slate-400">{idx + 1}</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-slate-900">{p.name}</div>
                          <span className="text-[10px] text-slate-400 font-mono">{p.sku}</span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-slate-500">
                          {p.categoryName}
                        </td>
                        <td className="px-5 py-3.5 text-right font-black text-slate-900">
                          {p.qtySold.toLocaleString('id-ID')}
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-slate-800">
                          Rp {p.revenue.toLocaleString('id-ID')}
                        </td>
                        <td className="px-5 py-3.5 text-right text-slate-500">
                          Rp {p.cost.toLocaleString('id-ID')}
                        </td>
                        <td className="px-5 py-3.5 text-right font-black text-emerald-700">
                          Rp {p.profit.toLocaleString('id-ID')}{' '}
                          <span className="text-[10px] text-emerald-600 font-normal">
                            ({p.profitMargin}%)
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Slow-Moving Products Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50/40">
              <div className="flex items-center gap-2.5">
                <AlertOctagon className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                    Analisis Slow-Moving & Potensi Dead Stock (Cuci Gudang)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Produk dengan penjualan rendah (≤ 2 pcs) namun masih memiliki stok mengendap di gudang toko
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-xl">
                {data?.slowMovingProducts?.length || 0} Produk Terdeteksi
              </span>
            </div>

            <div className="overflow-x-auto">
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
                  ) : (
                    data.slowMovingProducts.map((p) => (
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {/* Modal Edukasi Upgrade PRO */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        title="Buka Laporan HPP & Laba Bersih dengan Paket PRO"
        message="Fitur Laporan Laba Kotor & Analisis HPP hanya tersedia pada Paket PRO. Upgrade sekarang untuk mengaktifkan!"
        featureHighlight="Laporan HPP & Laba Bersih"
      />
    </div>
  );
};
