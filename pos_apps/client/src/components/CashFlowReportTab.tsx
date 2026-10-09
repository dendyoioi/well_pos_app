import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  RefreshCw,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
} from 'lucide-react';
import { api } from '../services/api';
import type { Outlet } from '../types/outlet';
import { computePresetDateRange } from '../utils/date';
import { TablePagination } from './TablePagination';

interface CashFlowReportTabProps {
  activeOutlet?: Outlet | null;
}

interface CashFlowSummary {
  totalCashSales: number;
  totalDebtRepayments: number;
  totalManualCashIn: number;
  totalCashInflow: number;
  totalCashOut: number;
  totalRefunds: number;
  totalCashOutflow: number;
  netCashFlow: number;
  outstandingReceivables: number;
  unpaidReceivablesCount: number;
}

interface DailyCashFlowRow {
  date: string;
  cashSales: number;
  debtRepayments: number;
  manualCashIn: number;
  cashOut: number;
  refunds: number;
  netFlow: number;
}

interface RecentMovementRow {
  id: string;
  type: string;
  category?: string | null;
  amount: number;
  notes?: string | null;
  createdAt: string;
  shift?: {
    id: string;
    cashier?: {
      name: string;
    };
  };
}

interface SalesPerformanceData {
  summary: {
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
    bestDay: {
      date: string;
      revenue: number;
    };
  };
  dailyTrend: Array<{
    date: string;
    revenue: number;
    orderCount: number;
  }>;
  monthlyTrend: Array<{
    monthKey: string;
    monthLabel: string;
    revenue: number;
    orderCount: number;
  }>;
}

export const CashFlowReportTab: React.FC<CashFlowReportTabProps> = ({ activeOutlet }) => {
  // Period Filter State
  const [periodPreset, setPeriodPreset] = useState<'today' | '7days' | '30days' | 'thisMonth' | 'custom'>('thisMonth');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // Data States
  const [summary, setSummary] = useState<CashFlowSummary | null>(null);
  const [dailyBreakdown, setDailyBreakdown] = useState<DailyCashFlowRow[]>([]);
  const [recentMovements, setRecentMovements] = useState<RecentMovementRow[]>([]);
  const [performanceData, setPerformanceData] = useState<SalesPerformanceData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Chart View State: Daily (30 days) vs Monthly (12 months)
  const [chartMode, setChartMode] = useState<'daily' | 'monthly'>('daily');
  const [hoveredPoint, setHoveredPoint] = useState<{ label: string; revenue: number; orderCount: number; x: number; y: number } | null>(null);

  // Pagination for Daily Table
  const [dailyPage, setDailyPage] = useState<number>(1);
  const [dailyPageSize, setDailyPageSize] = useState<number>(10);

  // Pagination for Recent Movements Table
  const [movementPage, setMovementPage] = useState<number>(1);
  const [movementPageSize, setMovementPageSize] = useState<number>(10);

  // Reset pagination on filter change
  useEffect(() => {
    setDailyPage(1);
    setMovementPage(1);
  }, [periodPreset, customStart, customEnd, activeOutlet?.id]);

  // Compute dates
  const getDateRange = () => {
    if (periodPreset === 'custom') {
      return { startStr: customStart, endStr: customEnd };
    }
    return computePresetDateRange(periodPreset as any);
  };

  // Fetch Cash Flow & Performance Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const { startStr, endStr } = getDateRange();
      const outletIdParam = activeOutlet && !activeOutlet.isWarehouse ? activeOutlet.id : undefined;

      const [resCashFlow, resPerf] = await Promise.all([
        api.getCashFlowReport({
          startDate: startStr,
          endDate: endStr,
          outletId: outletIdParam,
        }),
        api.getSalesPerformanceReport({
          startDate: startStr,
          endDate: endStr,
          outletId: outletIdParam,
        }),
      ]);

      if (resCashFlow.status === 'success' && resCashFlow.data) {
        setSummary(resCashFlow.data.summary);
        setDailyBreakdown(resCashFlow.data.dailyBreakdown || []);
        setRecentMovements(resCashFlow.data.recentMovements || []);
      }

      if (resPerf.status === 'success' && resPerf.data) {
        setPerformanceData(resPerf.data);
      }
    } catch (err) {
      console.error('Gagal mengambil laporan arus kas & performa:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (periodPreset !== 'custom' || (customStart && customEnd)) {
      fetchData();
    }
  }, [periodPreset, customStart, customEnd, activeOutlet?.id]);

  // Paginated daily breakdown
  const paginatedDaily = useMemo(() => {
    const start = (dailyPage - 1) * dailyPageSize;
    return dailyBreakdown.slice(start, start + dailyPageSize);
  }, [dailyBreakdown, dailyPage, dailyPageSize]);

  // Paginated movements
  const paginatedMovements = useMemo(() => {
    const start = (movementPage - 1) * movementPageSize;
    return recentMovements.slice(start, start + movementPageSize);
  }, [recentMovements, movementPage, movementPageSize]);

  // CSV Export
  const handleExportCSV = () => {
    if (!summary) return;
    const { startStr, endStr } = getDateRange();

    const rows = [
      ['LAPORAN ARUS KAS & MUTASI KAS POS'],
      ['Outlet', activeOutlet && !activeOutlet.isWarehouse ? activeOutlet.name : 'Seluruh Outlet Toko'],
      ['Periode', `${startStr || '-'} s/d ${endStr || '-'}`],
      ['Waktu Cetak', new Date().toLocaleString('id-ID')],
      [''],
      ['RINGKASAN ARUS KAS (CASH FLOW)'],
      ['Total Penjualan Tunai (Cash Sales)', `Rp ${summary.totalCashSales}`],
      ['Total Pelunasan Kasbon Tunai (Debt Repayments)', `Rp ${summary.totalDebtRepayments}`],
      ['Total Kas Masuk Laci Lainnya (Manual Cash-In)', `Rp ${summary.totalManualCashIn}`],
      ['TOTAL ARUS KAS MASUK (CASH INFLOW)', `Rp ${summary.totalCashInflow}`],
      [''],
      ['Total Pengeluaran Kas / Petty Cash', `Rp ${summary.totalCashOut}`],
      ['Total Pengembalian Dana Tunai (Refunds)', `Rp ${summary.totalRefunds}`],
      ['TOTAL ARUS KAS KELUAR (CASH OUTFLOW)', `Rp ${summary.totalCashOutflow}`],
      [''],
      ['ARUS KAS BERSIH (NET CASH FLOW)', `Rp ${summary.netCashFlow}`],
      ['Sisa Piutang Pelanggan Tertahan', `Rp ${summary.outstandingReceivables}`],
      ['Faktur Piutang Menunggak', `${summary.unpaidReceivablesCount} transaksi`],
      [''],
      ['REKAPITULASI ARUS KAS HARIAN'],
      ['Tanggal', 'Penjualan Tunai', 'Pelunasan Kasbon', 'Kas Masuk Laci', 'Pengeluaran Toko', 'Refund', 'Arus Kas Bersih'],
      ...dailyBreakdown.map((r) => [
        r.date,
        r.cashSales,
        r.debtRepayments,
        r.manualCashIn,
        r.cashOut,
        r.refunds,
        r.netFlow,
      ]),
      [''],
      ['MUTASI KAS TERKINI'],
      ['Waktu', 'Jenis Mutasi', 'Kategori', 'Nominal', 'Kasir / Shift', 'Keterangan'],
      ...recentMovements.map((m) => [
        m.createdAt,
        m.type,
        m.category || '-',
        m.amount,
        m.shift?.cashier?.name || '-',
        `"${(m.notes || '').replace(/"/g, '""')}"`,
      ]),
    ];

    const csvContent = '\uFEFF' + rows.map((e) => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Laporan_Arus_Kas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Chart preparation
  const chartPoints = useMemo(() => {
    if (!performanceData) return [];
    if (chartMode === 'daily') {
      return performanceData.dailyTrend.map((d) => ({
        label: new Date(d.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        fullLabel: d.date,
        revenue: d.revenue,
        orderCount: d.orderCount,
      }));
    } else {
      return performanceData.monthlyTrend.map((m) => ({
        label: m.monthLabel.split(' ')[0],
        fullLabel: m.monthLabel,
        revenue: m.revenue,
        orderCount: m.orderCount,
      }));
    }
  }, [performanceData, chartMode]);

  const maxRevenue = useMemo(() => {
    const max = Math.max(...chartPoints.map((p) => p.revenue), 100000);
    return Math.ceil(max / 100000) * 100000;
  }, [chartPoints]);

  return (
    <div className="space-y-6">
      {/* 1. Filter Period & Export Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        {/* Preset Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'today', label: 'Hari Ini' },
            { id: '7days', label: '7 Hari Terakhir' },
            { id: '30days', label: '30 Hari Terakhir' },
            { id: 'thisMonth', label: 'Bulan Ini' },
            { id: 'custom', label: 'Kustom' },
          ].map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => setPeriodPreset(btn.id as any)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                periodPreset === btn.id
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Custom Date Pickers & Actions */}
        <div className="flex items-center gap-2">
          {periodPreset === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
              />
              <span className="text-slate-400 text-xs">s/d</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
              />
            </div>
          )}

          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all cursor-pointer"
            title="Segarkan Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={!summary || loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* 2. 4 Kartu KPI Arus Kas Utama */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Kas Masuk */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-500 truncate">Total Arus Kas Masuk</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
              <ArrowDownRight className="w-4 h-4 shrink-0" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-emerald-600">
              Rp {(summary?.totalCashInflow ?? 0).toLocaleString('id-ID')}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-[11px] text-slate-500">
            <div className="flex justify-between">
              <span>Penjualan Tunai:</span>
              <span className="font-semibold text-slate-700">Rp {(summary?.totalCashSales ?? 0).toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between">
              <span>Pelunasan Kasbon:</span>
              <span className="font-semibold text-emerald-600">Rp {(summary?.totalDebtRepayments ?? 0).toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between">
              <span>Kas Masuk Laci:</span>
              <span className="font-semibold text-slate-700">Rp {(summary?.totalManualCashIn ?? 0).toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>

        {/* Total Kas Keluar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-500 truncate">Total Arus Kas Keluar</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold shrink-0">
              <ArrowUpRight className="w-4 h-4 shrink-0" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-rose-600">
              Rp {(summary?.totalCashOutflow ?? 0).toLocaleString('id-ID')}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-[11px] text-slate-500">
            <div className="flex justify-between">
              <span>Pengeluaran / Petty Cash:</span>
              <span className="font-semibold text-rose-600">Rp {(summary?.totalCashOut ?? 0).toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between">
              <span>Refund Tunai:</span>
              <span className="font-semibold text-slate-700">Rp {(summary?.totalRefunds ?? 0).toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>

        {/* Net Cash Flow */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-500 truncate">Arus Kas Bersih (Net Flow)</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold shrink-0 ${
              (summary?.netCashFlow ?? 0) >= 0 ? 'bg-blue-50 text-blue-900' : 'bg-rose-50 text-rose-600'
            }`}>
              <DollarSign className="w-4 h-4 shrink-0" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-black ${
              (summary?.netCashFlow ?? 0) >= 0 ? 'text-blue-900' : 'text-rose-600'
            }`}>
              Rp {(summary?.netCashFlow ?? 0).toLocaleString('id-ID')}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100">
            {(summary?.netCashFlow ?? 0) >= 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3 h-3" /> Surplus Kas Fisik
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
                <TrendingDown className="w-3 h-3" /> Defisit Kas Fisik
              </span>
            )}
            <p className="text-[11px] text-slate-400 mt-1">Kas Masuk dikurangi Kas Keluar</p>
          </div>
        </div>

        {/* Piutang Tertahan */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-500 truncate">Piutang Belum Tertagih</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
              <Clock className="w-4 h-4 shrink-0" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-amber-700">
              Rp {(summary?.outstandingReceivables ?? 0).toLocaleString('id-ID')}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Faktur Kasbon:</span>
            <span className="font-bold text-slate-800">{summary?.unpaidReceivablesCount ?? 0} Transaksi</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Potensi kas masuk saat dilunasi</p>
        </div>
      </div>

      {/* 3. Visualisasi Grafik Performa Penjualan & Omset Toko */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        {/* Header Grafik */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-900 flex items-center justify-center font-bold shrink-0">
                <BarChart3 className="w-4 h-4 shrink-0" />
              </div>
              <h3 className="font-black text-slate-900 text-base sm:text-lg">
                Tren Performa Penjualan &amp; Omset Toko
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Visualisasi dinamika pertumbuhan omset harian dan bulanan seluruh transaksi toko
            </p>
          </div>

          {/* Toggle Daily vs Monthly */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setChartMode('daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                chartMode === 'daily'
                  ? 'bg-white text-blue-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Harian (30 Hari)
            </button>
            <button
              type="button"
              onClick={() => setChartMode('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                chartMode === 'monthly'
                  ? 'bg-white text-blue-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bulanan (12 Bulan)
            </button>
          </div>
        </div>

        {/* Highlights Bar */}
        {performanceData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/60 text-xs">
            <div>
              <span className="text-slate-400 font-bold block text-[11px]">Total Omset Terkumpul</span>
              <span className="font-black text-slate-900 text-sm block mt-0.5">
                Rp {performanceData.summary.totalRevenue.toLocaleString('id-ID')}
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-bold block text-[11px]">Rata-rata Transaksi (AOV)</span>
              <span className="font-black text-blue-900 text-sm block mt-0.5">
                Rp {performanceData.summary.avgOrderValue.toLocaleString('id-ID')}
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-bold block text-[11px]">Total Transaksi</span>
              <span className="font-black text-slate-900 text-sm block mt-0.5">
                {performanceData.summary.totalOrders} Pesanan
              </span>
            </div>
            <div>
              <span className="text-slate-400 font-bold block text-[11px]">Rekor Penjualan Terbaik</span>
              <span className="font-black text-emerald-600 text-sm block mt-0.5">
                Rp {performanceData.summary.bestDay.revenue.toLocaleString('id-ID')}
              </span>
              <span className="text-[10px] text-slate-400 block">{performanceData.summary.bestDay.date}</span>
            </div>
          </div>
        )}

        {/* Interactive SVG Chart */}
        <div className="relative pt-4 pb-2">
          {chartPoints.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-xs font-semibold">
              Belum ada data transaksi penjualan pada periode ini.
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <div className="min-w-[600px] h-64 relative">
                <svg className="w-full h-full" viewBox="0 0 800 240" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="cashFlowGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                    const y = 200 - ratio * 180;
                    return (
                      <g key={idx}>
                        <line x1="50" y1={y} x2="780" y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
                        <text x="45" y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
                          {Math.round((maxRevenue * ratio) / 1000) >= 1000
                            ? `${((maxRevenue * ratio) / 1000000).toFixed(1)}jt`
                            : `${Math.round((maxRevenue * ratio) / 1000)}rb`}
                        </text>
                      </g>
                    );
                  })}

                  {/* Area fill */}
                  <polygon
                    points={`50,200 ${chartPoints
                      .map((p, idx) => {
                        const step = (780 - 50) / Math.max(1, chartPoints.length - 1);
                        const x = 50 + idx * step;
                        const y = 200 - (p.revenue / maxRevenue) * 180;
                        return `${x},${y}`;
                      })
                      .join(' ')} 780,200`}
                    fill="url(#cashFlowGradient)"
                  />

                  {/* Line stroke */}
                  <polyline
                    fill="none"
                    stroke="#1e3a8a"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={chartPoints
                      .map((p, idx) => {
                        const step = (780 - 50) / Math.max(1, chartPoints.length - 1);
                        const x = 50 + idx * step;
                        const y = 200 - (p.revenue / maxRevenue) * 180;
                        return `${x},${y}`;
                      })
                      .join(' ')}
                  />

                  {/* Data Points */}
                  {chartPoints.map((p, idx) => {
                    const step = (780 - 50) / Math.max(1, chartPoints.length - 1);
                    const x = 50 + idx * step;
                    const y = 200 - (p.revenue / maxRevenue) * 180;
                    return (
                      <g key={idx} className="cursor-pointer">
                        <circle
                          cx={x}
                          cy={y}
                          r="4"
                          fill="#ffffff"
                          stroke="#1e3a8a"
                          strokeWidth="2.5"
                          className="transition-transform hover:scale-150"
                          onMouseEnter={() =>
                            setHoveredPoint({
                              label: p.fullLabel,
                              revenue: p.revenue,
                              orderCount: p.orderCount,
                              x,
                              y,
                            })
                          }
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                        {/* X-axis labels (render every few points to avoid crowding) */}
                        {(chartPoints.length <= 12 || idx % Math.ceil(chartPoints.length / 8) === 0) && (
                          <text x={x} y="222" textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="600">
                            {p.label}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* Hover Tooltip */}
                {hoveredPoint && (
                  <div
                    className="absolute z-10 pointer-events-none bg-slate-900 text-white p-2.5 rounded-xl shadow-xl text-xs -translate-x-1/2 -translate-y-full -mt-2 border border-slate-700 min-w-[130px]"
                    style={{
                      left: `${(hoveredPoint.x / 800) * 100}%`,
                      top: `${(hoveredPoint.y / 240) * 100}%`,
                    }}
                  >
                    <span className="font-bold text-slate-300 block text-[11px]">{hoveredPoint.label}</span>
                    <span className="font-black text-sm text-emerald-400 block mt-0.5">
                      Rp {hoveredPoint.revenue.toLocaleString('id-ID')}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {hoveredPoint.orderCount} Transaksi
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Tabel Rekapitulasi Arus Kas Harian */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="font-black text-slate-900 text-sm sm:text-base">
              Rincian Rekapitulasi Arus Kas Harian
            </h4>
            <p className="text-xs text-slate-500 font-medium">
              Pencatatan harian arus kas masuk, keluar, dan saldo neto harian
            </p>
          </div>
          <span className="text-xs text-slate-500 font-bold bg-slate-100 px-3 py-1 rounded-lg">
            {dailyBreakdown.length} Hari
          </span>
        </div>

        {dailyBreakdown.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 font-semibold">
            Tidak ada transaksi kas pada periode yang dipilih.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4 text-right">Penjualan Tunai</th>
                  <th className="py-3 px-4 text-right">Pelunasan Kasbon</th>
                  <th className="py-3 px-4 text-right">Kas Masuk Laci</th>
                  <th className="py-3 px-4 text-right">Petty Cash Toko</th>
                  <th className="py-3 px-4 text-right">Refund Tunai</th>
                  <th className="py-3 px-4 text-right">Arus Kas Bersih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedDaily.map((row) => (
                  <tr key={row.date} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {new Date(row.date).toLocaleDateString('id-ID', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-700">
                      Rp {row.cashSales.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-emerald-600">
                      {row.debtRepayments > 0 ? `+Rp ${row.debtRepayments.toLocaleString('id-ID')}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-blue-700">
                      {row.manualCashIn > 0 ? `+Rp ${row.manualCashIn.toLocaleString('id-ID')}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-rose-600">
                      {row.cashOut > 0 ? `-Rp ${row.cashOut.toLocaleString('id-ID')}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-500">
                      {row.refunds > 0 ? `-Rp ${row.refunds.toLocaleString('id-ID')}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-black ${row.netFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {row.netFlow >= 0 ? '+' : ''}Rp {row.netFlow.toLocaleString('id-ID')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <TablePagination
          currentPage={dailyPage}
          pageSize={dailyPageSize}
          totalItems={dailyBreakdown.length}
          onPageChange={setDailyPage}
          onPageSizeChange={setDailyPageSize}
          itemLabel="hari"
        />
      </div>

      {/* 5. Tabel Mutasi Kas Terkini */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="font-black text-slate-900 text-sm sm:text-base">
              Riwayat Mutasi Pergerakan Kas Fisik Terkini
            </h4>
            <p className="text-xs text-slate-500 font-medium">
              Log aktivitas mutasi kas masuk, pelunasan kasbon, dan pengeluaran kasir
            </p>
          </div>
          <span className="text-xs text-slate-500 font-bold bg-slate-100 px-3 py-1 rounded-lg">
            {recentMovements.length} Catatan
          </span>
        </div>

        {recentMovements.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 font-semibold">
            Belum ada pergerakan mutasi kas tercatat.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Jenis &amp; Kategori</th>
                  <th className="py-3 px-4">Kasir / Shift</th>
                  <th className="py-3 px-4">Keterangan</th>
                  <th className="py-3 px-4 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedMovements.map((m) => {
                  const isCashIn = m.type === 'CASH_IN';
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(m.createdAt).toLocaleString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                          isCashIn
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {isCashIn ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          <span>{m.category === 'DEBT_REPAYMENT' ? 'Pelunasan Kasbon' : m.category || (isCashIn ? 'Kas Masuk' : 'Pengeluaran')}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-700">
                        {m.shift?.cashier?.name || '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {m.notes || '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-black">
                        <span className={isCashIn ? 'text-emerald-600' : 'text-rose-600'}>
                          {isCashIn ? '+' : '-'}Rp {m.amount.toLocaleString('id-ID')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <TablePagination
          currentPage={movementPage}
          pageSize={movementPageSize}
          totalItems={recentMovements.length}
          onPageChange={setMovementPage}
          onPageSizeChange={setMovementPageSize}
          itemLabel="mutasi"
        />
      </div>
    </div>
  );
};
