import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Waves,
  AlertTriangle,
  ArrowRight,
  MessageSquare,
  Loader2,
  Calendar,
  Shirt,
  ShieldAlert,
  Wallet,
  Users,
  ChevronDown,
  Camera,
  Star,
} from 'lucide-react';
import { api } from '../../services/api';
import type { Outlet } from '../../types/outlet';
import type { User } from '../../types/auth';
import { formatRupiah } from '../../utils/currency';
import { toLocalDateStr } from '../../utils/date';
import { LaundryFeedbackManagementModal } from '../laundry/LaundryFeedbackManagementModal';
import { PerformanceAnalyticsContainer } from '../laundry/analytics/PerformanceAnalyticsContainer';

interface LaundryBusinessSummaryViewProps {
  activeOutlet: Outlet | null;
  currentUser?: User;
  onOpenPos?: () => void;
  onNavigateTab?: (tab: string) => void;
}

type PeriodPreset = 'today' | '7days' | 'month' | 'year' | 'custom';

interface HoverPoint {
  x: number;
  y: number;
  label: string;
  kiloan: number;
  satuan: number;
  total: number;
  orderCount: number;
}

export const LaundryBusinessSummaryView: React.FC<LaundryBusinessSummaryViewProps> = ({
  activeOutlet,
  currentUser,
  onOpenPos,
  onNavigateTab,
}) => {
  // --- State Filter Periode ---
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('month');
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [customStart, setCustomStart] = useState<string>(toLocalDateStr(new Date(now.getTime() - 6 * 86400_000)));
  const [customEnd, setCustomEnd] = useState<string>(toLocalDateStr(now));

  // --- State Data Dashboard ---
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<HoverPoint | null>(null);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);

  // Hitung Tanggal Start & End berdasarkan Preset Terpilih
  const dateParams = useMemo(() => {
    if (periodPreset === 'today') {
      const todayStr = toLocalDateStr(now);
      return { startDate: todayStr, endDate: todayStr, granularity: 'DAY' as const, label: 'Hari Ini' };
    }
    if (periodPreset === '7days') {
      const start = new Date(now.getTime() - 6 * 86400_000);
      return {
        startDate: toLocalDateStr(start),
        endDate: toLocalDateStr(now),
        granularity: 'DAY' as const,
        label: '7 Hari Terakhir',
      };
    }
    if (periodPreset === 'month') {
      const mStr = String(selectedMonth).padStart(2, '0');
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      return {
        startDate: `${selectedYear}-${mStr}-01`,
        endDate: `${selectedYear}-${mStr}-${String(lastDay).padStart(2, '0')}`,
        granularity: 'DAY' as const,
        label: `${monthNames[selectedMonth - 1]} ${selectedYear}`,
      };
    }
    if (periodPreset === 'year') {
      return {
        startDate: `${selectedYear}-01-01`,
        endDate: `${selectedYear}-12-31`,
        granularity: 'MONTH' as const,
        label: `Tahun ${selectedYear}`,
      };
    }
    return {
      startDate: customStart,
      endDate: customEnd,
      granularity: 'DAY' as const,
      label: `${customStart} s/d ${customEnd}`,
    };
  }, [periodPreset, selectedYear, selectedMonth, customStart, customEnd]);

  // Load Data dari API getLaundryDashboardSummary
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const outletIdParam = activeOutlet && !activeOutlet.isWarehouse ? activeOutlet.id : undefined;
      const res = await api.getLaundryDashboardSummary({
        outletId: outletIdParam,
        startDate: dateParams.startDate,
        endDate: dateParams.endDate,
        granularity: dateParams.granularity,
      });

      if (res?.status === 'success' && res.data) {
        setDashboardData(res.data);
      }
    } catch (err) {
      console.error('Gagal memuat dashboard summary:', err);
    } finally {
      setLoading(false);
    }
  }, [activeOutlet?.id, activeOutlet?.isWarehouse, dateParams]);

  // Deteksi role performance intelligence (Owner, Admin, Supervisor)
  const isPerformanceRole = useMemo(() => {
    const r = (currentUser?.role || '').toUpperCase();
    return ['OWNER', 'ADMIN', 'SUPERVISOR'].includes(r);
  }, [currentUser?.role]);

  useEffect(() => {
    if (isPerformanceRole) return; // Role Owner/Admin/Supervisor menggunakan modul PerformanceAnalyticsContainer (Zero Double-Fetch)
    loadDashboard();
    const handleOrderEvent = () => loadDashboard();
    window.addEventListener('wellpos:laundry_order_created', handleOrderEvent);
    return () => window.removeEventListener('wellpos:laundry_order_created', handleOrderEvent);
  }, [loadDashboard, isPerformanceRole]);

  // Role Mode: Dari respon backend atau fallback dari context user
  const effectiveRole = useMemo((): 'OWNER' | 'CASHIER' | 'PRODUCTION' => {
    if (dashboardData?.roleMode) return dashboardData.roleMode;
    const r = (currentUser?.role || '').toUpperCase();
    if (r === 'CASHIER') return 'CASHIER';
    if (['WAREHOUSE', 'KITCHEN', 'WAITER'].includes(r)) return 'PRODUCTION';
    return 'OWNER';
  }, [dashboardData?.roleMode, currentUser?.role]);

  // Render Skeleton saat loading awal (khusus role non-performance seperti CASHIER & PRODUCTION)
  if (!isPerformanceRole && loading && !dashboardData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] p-8 text-slate-500 space-y-3">
        <Loader2 className="w-9 h-9 animate-spin text-blue-900" />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Memuat Dashboard Laundry...</span>
        <span className="text-[11px] text-slate-400">Menghubungkan metrik real-time & analisis operasional</span>
      </div>
    );
  }

  // =========================================================================
  // SUB-KOMPONEN: GRAFIK GARIS DUAL SERIES SVG (KILOAN VS SATUAN)
  // =========================================================================
  const renderLineChart = () => {
    const series: Array<{ key: string; label: string; kiloanOmzet: number; satuanOmzet: number; totalOmzet: number; orderCount: number }> =
      dashboardData?.revenueSeries || [];

    if (series.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-xs">
          <Calendar className="w-8 h-8 mb-2 text-slate-300" />
          <span>Belum ada data transaksi pada periode ini</span>
        </div>
      );
    }

    const W = 700;
    const H = 220;
    const padL = 54;
    const padR = 24;
    const padT = 24;
    const padB = 38;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const maxVal = Math.max(...series.flatMap((p) => [p.kiloanOmzet, p.satuanOmzet]), 1000) * 1.15;
    const stepX = series.length > 1 ? plotW / (series.length - 1) : plotW;

    const ptK = series.map((p, i) => ({
      x: padL + i * stepX,
      y: padT + plotH - (p.kiloanOmzet / maxVal) * plotH,
      val: p.kiloanOmzet,
      raw: p,
    }));

    const ptS = series.map((p, i) => ({
      x: padL + i * stepX,
      y: padT + plotH - (p.satuanOmzet / maxVal) * plotH,
      val: p.satuanOmzet,
      raw: p,
    }));

    const linePath = (pts: typeof ptK) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaPath = (pts: typeof ptK) =>
      `${linePath(pts)} L ${pts[pts.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;

    // 4 Garis Grid Horizontal
    const gridFractions = [0, 0.33, 0.66, 1];
    const gridLines = gridFractions.map((f) => {
      const y = padT + plotH - f * plotH;
      const v = Math.round(maxVal * f);
      const vStr = v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}jt` : v >= 1000 ? `${Math.round(v / 1000)}rb` : String(v);
      return { y, label: vStr };
    });

    // Sampel Label X-Axis agar tidak menumpuk di Mobile / Periode Panjang
    const sampleRate = series.length > 18 ? Math.ceil(series.length / 8) : series.length > 10 ? 2 : 1;

    return (
      <div className="relative w-full">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible select-none">
          <defs>
            <linearGradient id="gradKiloan" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.01" />
            </linearGradient>
            <linearGradient id="gradSatuan" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Grid Lines & Y-Labels */}
          {gridLines.map((gl, idx) => (
            <g key={idx}>
              <line
                x1={padL}
                y1={gl.y.toFixed(1)}
                x2={(W - padR).toFixed(1)}
                y2={gl.y.toFixed(1)}
                stroke="#e2e8f0"
                strokeDasharray="3 4"
                strokeWidth="1"
              />
              <text
                x={padL - 8}
                y={(gl.y + 3.5).toFixed(1)}
                textAnchor="end"
                fontSize="10"
                fontWeight="700"
                fill="#64748b"
              >
                {gl.label}
              </text>
            </g>
          ))}

          {/* Area Fills */}
          <path d={areaPath(ptK)} fill="url(#gradKiloan)" />
          <path d={areaPath(ptS)} fill="url(#gradSatuan)" />

          {/* Lines */}
          <path
            d={linePath(ptK)}
            fill="none"
            stroke="#1e3a8a"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={linePath(ptS)}
            fill="none"
            stroke="#059669"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Titik Kiloan (Navy) */}
          {ptK.map((p, i) => (
            <circle
              key={`k-${i}`}
              cx={p.x.toFixed(1)}
              cy={p.y.toFixed(1)}
              r="4"
              fill="#1e3a8a"
              stroke="#ffffff"
              strokeWidth="2"
              className="cursor-pointer transition-all hover:r-6"
              onMouseEnter={() =>
                setHoveredPoint({
                  x: p.x,
                  y: Math.min(p.y, ptS[i].y),
                  label: p.raw.label,
                  kiloan: p.raw.kiloanOmzet,
                  satuan: p.raw.satuanOmzet,
                  total: p.raw.totalOmzet,
                  orderCount: p.raw.orderCount,
                })
              }
              onMouseLeave={() => setHoveredPoint(null)}
            />
          ))}

          {/* Titik Satuan (Emerald) */}
          {ptS.map((p, i) => (
            <circle
              key={`s-${i}`}
              cx={p.x.toFixed(1)}
              cy={p.y.toFixed(1)}
              r="4"
              fill="#059669"
              stroke="#ffffff"
              strokeWidth="2"
              className="cursor-pointer transition-all hover:r-6"
              onMouseEnter={() =>
                setHoveredPoint({
                  x: p.x,
                  y: Math.min(ptK[i].y, p.y),
                  label: p.raw.label,
                  kiloan: p.raw.kiloanOmzet,
                  satuan: p.raw.satuanOmzet,
                  total: p.raw.totalOmzet,
                  orderCount: p.raw.orderCount,
                })
              }
              onMouseLeave={() => setHoveredPoint(null)}
            />
          ))}

          {/* X-Axis Labels */}
          {series.map((p, i) => {
            if (i % sampleRate !== 0 && i !== series.length - 1) return null;
            const x = padL + i * stepX;
            return (
              <text
                key={`x-${i}`}
                x={x.toFixed(1)}
                y={(H - 12).toFixed(1)}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill="#64748b"
              >
                {p.label}
              </text>
            );
          })}
        </svg>

        {/* Hover Tooltip Popup */}
        {hoveredPoint && (
          <div
            className="absolute z-20 pointer-events-none bg-slate-900/95 backdrop-blur-xs text-white text-xs rounded-xl p-3 shadow-xl border border-slate-700/60 transform -translate-x-1/2 -translate-y-full mb-3 min-w-[190px]"
            style={{
              left: `${(hoveredPoint.x / W) * 100}%`,
              top: `${(hoveredPoint.y / H) * 100}%`,
            }}
          >
            <div className="font-extrabold text-[11px] text-slate-300 pb-1.5 border-b border-slate-800 flex justify-between items-center">
              <span>{hoveredPoint.label}</span>
              <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
                {hoveredPoint.orderCount} Nota
              </span>
            </div>
            <div className="space-y-1.5 pt-2 text-[11px]">
              <div className="flex justify-between items-center text-blue-300">
                <span className="font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Kiloan (Kg):
                </span>
                <span className="font-bold font-mono">{formatRupiah(hoveredPoint.kiloan)}</span>
              </div>
              <div className="flex justify-between items-center text-emerald-300">
                <span className="font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Satuan (Pcs):
                </span>
                <span className="font-bold font-mono">{formatRupiah(hoveredPoint.satuan)}</span>
              </div>
              <div className="flex justify-between items-center text-white pt-1 border-t border-slate-800 font-extrabold">
                <span>Total Omzet:</span>
                <span className="font-mono text-amber-300">{formatRupiah(hoveredPoint.total)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // VIEW A: DASHBOARD OWNER (MODE LENGKAP)
  // =========================================================================
  const renderOwnerDashboard = () => {
    const hl = dashboardData?.highlights || {
      totalOmzet: 0,
      prevOmzet: 0,
      omzetGrowthPercent: 0,
      totalOmzetKiloan: 0,
      totalOmzetSatuan: 0,
      cashIn: 0,
      outstandingReceivables: 0,
      estimatedBomCost: 0,
      shiftCashOut: 0,
      estimatedCommissions: 0,
      estimatedOperatingProfit: 0,
      operatingMarginPercent: 0,
      totalTransactions: 0,
      totalWeightKg: 0,
      totalPieces: 0,
      avgOrderValue: 0,
      activeCustomers: { total: 0, newCustomers: 0, repeatCustomers: 0 },
    };

    const ops = dashboardData?.operations || {};
    const pipeline = ops.pipelineCounts || {
      sorting: 0,
      washingDrying: 0,
      ironingFolding: 0,
      readyForPickup: 0,
      overdueCount: 0,
      dueTodayCount: 0,
    };

    const deposits = ops.pendingDeposits || { count: 0, totalAmount: 0, items: [] };
    const shift = ops.activeShift;
    const stale = ops.staleRack || { over3DaysCount: 0, over7DaysCount: 0 };
    const machines = ops.activeMachines || [];
    const lowStock = ops.lowStockSupplies || [];

    return (
      <div className="space-y-4">
        {/* HEADER DENGAN FILTER PERIODE */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Ringkasan Bisnis & Operasional
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-black uppercase tracking-wider bg-blue-100 text-blue-900">
                👑 Mode Pemilik (Lengkap)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Periode aktif: <strong className="text-slate-700">{dateParams.label}</strong> • Data agregasi real-time kasir & workshop
            </p>
          </div>

          {/* Period Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1 overflow-x-auto max-w-full">
              {(['today', '7days', 'month', 'year', 'custom'] as PeriodPreset[]).map((p) => {
                const label = p === 'today' ? 'Hari Ini' : p === '7days' ? '7 Hari' : p === 'month' ? 'Bulan Ini' : p === 'year' ? 'Tahun Ini' : 'Kustom';
                const isActive = periodPreset === p;
                return (
                  <button
                    key={p}
                    onClick={() => setPeriodPreset(p)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                      isActive ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Input Rentang Tanggal Kustom */}
            {periodPreset === 'custom' && (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-700 shadow-xs focus:outline-hidden focus:border-blue-900"
                />
                <span className="text-slate-400 text-xs font-bold">-</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-700 shadow-xs focus:outline-hidden focus:border-blue-900"
                />
              </div>
            )}

            {/* Dropdown Bulan (Aktif jika preset month) */}
            {periodPreset === 'month' && (
              <div className="relative">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="appearance-none bg-white border border-slate-200 rounded-xl px-3 pr-8 py-1.5 text-xs font-bold text-slate-700 cursor-pointer shadow-xs focus:outline-hidden focus:border-blue-900"
                >
                  {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((m, idx) => (
                    <option key={idx} value={idx + 1}>{m}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
              </div>
            )}

            {/* Dropdown Tahun */}
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="appearance-none bg-white border border-slate-200 rounded-xl px-3 pr-8 py-1.5 text-xs font-bold text-slate-700 cursor-pointer shadow-xs focus:outline-hidden focus:border-blue-900"
              >
                {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        </div>

        {/* 4 TOP HIGHLIGHT KPI CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Total Omzet (Hero Navy) */}
          <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-3xl p-4 sm:p-5 text-white shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-blue-200">Total Omzet</span>
              {hl.omzetGrowthPercent !== 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300">
                  {hl.omzetGrowthPercent > 0 ? `+${hl.omzetGrowthPercent}%` : `${hl.omzetGrowthPercent}%`}
                </span>
              )}
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono tracking-tight my-2">
              {formatRupiah(hl.totalOmzet)}
            </div>
            <div className="text-[11px] text-slate-300 leading-relaxed border-t border-blue-800/60 pt-2 space-y-0.5">
              <div>Kas Masuk: <strong>{formatRupiah(hl.cashIn)}</strong></div>
              <div>Piutang Aktif: <span className="text-amber-300 font-bold">{formatRupiah(hl.outstandingReceivables)}</span></div>
            </div>
          </div>

          {/* Card 2: Estimasi Laba Operasional */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Estimasi Laba Ops</span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {hl.operatingMarginPercent}% margin
              </span>
            </div>
            <div className={`text-xl sm:text-2xl font-black font-mono tracking-tight my-2 ${hl.estimatedOperatingProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              {formatRupiah(hl.estimatedOperatingProfit)}
            </div>
            <div className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-100 pt-2 line-clamp-2">
              BoM {formatRupiah(hl.estimatedBomCost)} • Kas Out {formatRupiah(hl.shiftCashOut)} • Komisi {formatRupiah(hl.estimatedCommissions)}
            </div>
          </div>

          {/* Card 3: Total Transaksi & Tonase */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Total Transaksi</span>
              <Shirt className="w-4 h-4 text-blue-900" />
            </div>
            <div className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 my-2">
              {hl.totalTransactions} Nota
            </div>
            <div className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-100 pt-2 space-y-0.5">
              <div className="font-bold text-slate-700">{hl.totalWeightKg} Kg • {hl.totalPieces} Pcs Satuan</div>
              <div>Rata-rata {formatRupiah(hl.avgOrderValue)} / nota</div>
            </div>
          </div>

          {/* Card 4: Pelanggan Aktif */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Pelanggan Aktif</span>
              <Users className="w-4 h-4 text-blue-900" />
            </div>
            <div className="text-xl sm:text-2xl font-black tracking-tight text-blue-900 my-2">
              {hl.activeCustomers?.total || 0} Pelanggan
            </div>
            <div className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-100 pt-2 space-y-0.5">
              <div>{hl.activeCustomers?.newCustomers || 0} Baru • {hl.activeCustomers?.repeatCustomers || 0} Repeat</div>
              <div className="text-emerald-700 font-bold">
                {hl.activeCustomers?.total > 0
                  ? `${Math.round(((hl.activeCustomers.repeatCustomers || 0) / hl.activeCustomers.total) * 100)}% Retensi Pelanggan`
                  : '0% Retensi'}
              </div>
            </div>
          </div>
        </div>

        {/* GRAFIK GARIS KILOAN VS SATUAN + SIDE PANEL KAS & PERSETUJUAN */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Grafik Garis (2 Kolom) */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs flex flex-col justify-between space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Grafik Garis Omzet Kiloan vs Satuan ({dateParams.label})
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Garis biru: basis per Kg (Kiloan) • Garis hijau: basis per Item/Pcs/Stel (Satuan)
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-900 border border-blue-200">
                  <span className="w-2 h-2 rounded-full bg-blue-900" /> Kiloan: {formatRupiah(hl.totalOmzetKiloan)}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" /> Satuan: {formatRupiah(hl.totalOmzetSatuan)}
                </span>
              </div>
            </div>

            <div className="pt-2">
              {renderLineChart()}
            </div>
          </div>

          {/* Panel Persetujuan & Kas Kasir (1 Kolom) */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs flex flex-col justify-between space-y-3">
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                Persetujuan & Kas Kasir
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Monitoring lantai kasir & setoran shift
              </p>
            </div>

            <div className="space-y-2.5">
              {/* Item 1: Setoran Kas Shift */}
              <div
                onClick={() => onNavigateTab?.('shifts')}
                className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-slate-900">Setoran Kas Menunggu</div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    {deposits.count > 0
                      ? `${deposits.count} pengajuan • Total ${formatRupiah(deposits.totalAmount)}`
                      : 'Semua setoran telah diverifikasi'}
                  </div>
                </div>
                <span className={`text-[10.5px] font-black px-2 py-1 rounded-full shrink-0 ${
                  deposits.count > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {deposits.count > 0 ? `${deposits.count} Pending` : 'Nihil'}
                </span>
              </div>

              {/* Item 2: Shift Aktif Berjalan */}
              <div
                onClick={() => onNavigateTab?.('shifts')}
                className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-slate-900">Shift Kasir Aktif</div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    {shift
                      ? `${shift.cashierName} • Kas Drawer: ${formatRupiah(shift.cashInDrawer)}`
                      : 'Belum ada kasir yang membuka shift hari ini'}
                  </div>
                </div>
                <span className={`text-[10.5px] font-black px-2 py-1 rounded-full shrink-0 ${
                  shift ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {shift ? 'OPEN' : 'TUTUP'}
                </span>
              </div>

              {/* Item 3: Cucian Mengendap di Rak */}
              <div
                onClick={() => onNavigateTab?.('laundry_racks')}
                className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-slate-900">Cucian Mengendap di Rak</div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    {stale.over3DaysCount > 0
                      ? `${stale.over3DaysCount} nota > 3 hari • ${stale.over7DaysCount} nota > 7 hari`
                      : 'Semua cucian di rak bergerak lancar'}
                  </div>
                </div>
                <span className={`text-[10.5px] font-black px-2 py-1 rounded-full shrink-0 ${
                  stale.over3DaysCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {stale.over3DaysCount > 0 ? 'Perlu WA' : 'Lancar'}
                </span>
              </div>

              {/* Item 4: Audit Rating & Komplain Pelanggan */}
              <div
                onClick={() => setFeedbackModalOpen(true)}
                className="p-3 rounded-2xl bg-amber-50/60 hover:bg-amber-100/60 border border-amber-200 transition-all cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>Rating &amp; Komplain Pelanggan</span>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    Pantau kepuasan ulasan pelanggan &amp; selesaikan komplain live
                  </div>
                </div>
                <span className="text-[10.5px] font-black px-2 py-1 rounded-full shrink-0 bg-amber-200 text-amber-900">
                  Audit Ulasan
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => onNavigateTab?.('shifts')}
                className="w-full py-2 px-3 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Buka Rekap Shift & Keuangan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* OPERASIONAL PRODUKSI & STOK BAHAN */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Monitor Lantai Produksi */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Monitor Lantai Produksi (Live)
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Status antrean cucian aktif di stasiun kerja
                </p>
              </div>
              {pipeline.overdueCount > 0 && (
                <span className="text-[10.5px] font-black px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                  {pipeline.overdueCount} Overdue SLA
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
              <div
                onClick={() => onNavigateTab?.('laundry_production')}
                className="bg-slate-50 hover:bg-slate-100 p-3 rounded-2xl border border-slate-200 transition-all cursor-pointer"
              >
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">1. Sortir</div>
                <div className="text-lg font-black text-slate-900 my-0.5">{pipeline.sorting} Nota</div>
                <div className="text-[10px] text-slate-400">Menunggu QC</div>
              </div>

              <div
                onClick={() => onNavigateTab?.('laundry_production')}
                className="bg-blue-50 hover:bg-blue-100/70 p-3 rounded-2xl border border-blue-200 transition-all cursor-pointer"
              >
                <div className="text-[10px] font-black uppercase tracking-wider text-blue-900">2. Cuci/Kering</div>
                <div className="text-lg font-black text-blue-900 my-0.5">{pipeline.washingDrying} Nota</div>
                <div className="text-[10px] text-blue-600">Mesin aktif</div>
              </div>

              <div
                onClick={() => onNavigateTab?.('laundry_production')}
                className="bg-amber-50 hover:bg-amber-100/70 p-3 rounded-2xl border border-amber-200 transition-all cursor-pointer"
              >
                <div className="text-[10px] font-black uppercase tracking-wider text-amber-800">3. Setrika</div>
                <div className="text-lg font-black text-amber-900 my-0.5">{pipeline.ironingFolding} Nota</div>
                <div className="text-[10px] text-amber-600">Finishing</div>
              </div>

              <div
                onClick={() => onNavigateTab?.('laundry_racks')}
                className="bg-emerald-50 hover:bg-emerald-100/70 p-3 rounded-2xl border border-emerald-200 transition-all cursor-pointer"
              >
                <div className="text-[10px] font-black uppercase tracking-wider text-emerald-800">4. Siap di Rak</div>
                <div className="text-lg font-black text-emerald-900 my-0.5">{pipeline.readyForPickup} Nota</div>
                <div className="text-[10px] text-emerald-600">Siap serah</div>
              </div>
            </div>

            {/* Mesin Berjalan */}
            {machines.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <div className="text-[11px] font-bold text-slate-600 mb-1.5">Mesin Sedang Berjalan:</div>
                <div className="flex flex-wrap gap-1.5">
                  {machines.map((m: any, idx: number) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-100/80 text-blue-900 text-[10.5px] font-extrabold">
                      <Waves className="w-3 h-3 text-blue-700" />
                      {m.machineName} ({m.invoiceNumber || 'Aktif'})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bahan Cuci Menipis */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Bahan Cuci Menipis (Inventori BoM)
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Dihitung otomatis dari stok nyata gudang & outlet
                </p>
              </div>
              <button
                onClick={() => onNavigateTab?.('inventory')}
                className="text-xs text-blue-900 font-bold hover:underline cursor-pointer"
              >
                Kelola Stok →
              </button>
            </div>

            <div className="space-y-2 pt-1">
              {lowStock.length > 0 ? (
                lowStock.map((it: any, idx: number) => {
                  const pct = it.reorderPoint > 0 ? Math.min(100, Math.round((it.quantityOnHand / (it.reorderPoint * 2)) * 100)) : 50;
                  return (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-2xl border transition-all ${
                        it.isLow ? 'bg-rose-50/70 border-rose-200' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-slate-900">{it.name}</span>
                        <span className={it.isLow ? 'text-rose-700 font-black' : 'text-slate-600'}>
                          Sisa {it.quantityOnHand} {it.uom} {it.isLow ? '(Menipis)' : ''}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden mt-1.5">
                        <div
                          className={`h-full rounded-full ${it.isLow ? 'bg-rose-500' : 'bg-blue-600'}`}
                          style={{ width: `${Math.max(5, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-6 text-center text-slate-400 text-xs">
                  Semua stok deterjen, softener & parfum dalam batas aman.
                </div>
              )}
            </div>
          </div>

          {/* Shortcut Win-Back CRM Pelanggan Pasif */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Users className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Pelanggan Pasif (Win-Back CRM)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Sapa kembali pelanggan yang &gt; 30 hari tidak mencuci via WhatsApp resmi toko
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    url.searchParams.set('tab', 'customers');
                    url.searchParams.set('subtab', 'winback');
                    window.history.replaceState({}, '', url.toString());
                    window.dispatchEvent(new CustomEvent('customers-subtab', { detail: 'winback' }));
                    window.dispatchEvent(new CustomEvent('wellpos:subtab_change', { detail: 'winback' }));
                  }
                  onNavigateTab?.('customers');
                }}
                className="py-2 px-3.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs self-start sm:self-auto"
              >
                <span>Buka Win-Back</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // VIEW B: DASHBOARD KASIR (FRONT-DESK)
  // =========================================================================
  const renderCashierDashboard = () => {
    const shift = dashboardData?.activeShift;
    const readyOrders: any[] = dashboardData?.readyForPickupOrders || [];
    const staleOrders: any[] = dashboardData?.staleRackOrders || [];
    const todayDeliveriesCount: number = dashboardData?.todayDeliveriesCount || 0;

    return (
      <div className="space-y-4">
        {/* Banner Isolasi Kasir */}
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-900 text-xs font-semibold flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>
            <strong>Mode Kasir (Front-Desk):</strong> Fokus layanan pelanggan & kas shift berjalan. Estimasi laba operasional & total omzet bulanan/tahunan bisnis disembunyikan.
          </span>
        </div>

        {/* Header Shift Aktif */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Halo, {shift?.cashierName || currentUser?.name || 'Kasir'}
              </h1>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-black uppercase tracking-wider ${
                shift ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
              }`}>
                {shift ? '● Shift Aktif Berjalan' : '○ Belum Buka Shift'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Modal Awal Laci: <strong className="text-slate-700">{formatRupiah(shift?.startingCash || 0)}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onNavigateTab?.('shifts')}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              🏦 Ajukan Setoran Kas
            </button>
            <button
              onClick={() => onNavigateTab?.('shifts')}
              className="px-4 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              🔒 Kelola / Tutup Shift
            </button>
          </div>
        </div>

        {/* 4 KPI Kasir Shift Ini */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Kas Tunai di Laci</span>
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-700 my-1">
              {formatRupiah(shift?.totalCashDrawer || 0)}
            </div>
            <div className="text-[11px] text-slate-400">Modal + Tunai Masuk</div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Non-Tunai Shift Ini</span>
            <div className="text-xl sm:text-2xl font-black font-mono text-blue-900 my-1">
              {formatRupiah(shift?.nonTunaiAmount || 0)}
            </div>
            <div className="text-[11px] text-slate-400">QRIS & Transfer Masuk</div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Siap Diambil di Rak</span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 my-1">
              {readyOrders.length} Nota
            </div>
            <div className="text-[11px] text-slate-400">
              {readyOrders.filter((o) => !o.isPaid).length} nota ada sisa tagihan
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Pengiriman Hari Ini</span>
            <div className="text-xl sm:text-2xl font-black text-amber-700 my-1">
              {todayDeliveriesCount} Order
            </div>
            <div className="text-[11px] text-slate-400">Antar-jemput kurir</div>
          </div>
        </div>

        {/* 4 Aksi Cepat Kasir */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div
            onClick={() => onOpenPos ? onOpenPos() : onNavigateTab?.('pos')}
            className="bg-white hover:bg-blue-50/50 p-4 rounded-3xl border border-slate-200/90 transition-all cursor-pointer flex items-center gap-3 shadow-xs"
          >
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-900 font-extrabold flex items-center justify-center shrink-0">
              <Plus className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black text-slate-900">Input Cucian</div>
              <div className="text-[11px] text-slate-400 truncate">Timbang & nota baru</div>
            </div>
          </div>

          <div
            onClick={() => onNavigateTab?.('laundry_queue')}
            className="bg-white hover:bg-emerald-50/50 p-4 rounded-3xl border border-slate-200/90 transition-all cursor-pointer flex items-center gap-3 shadow-xs"
          >
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black text-slate-900">Serah Ambil</div>
              <div className="text-[11px] text-slate-400 truncate">Pelunasan & serahkan</div>
            </div>
          </div>

          <div
            onClick={() => onNavigateTab?.('customers')}
            className="bg-white hover:bg-amber-50/50 p-4 rounded-3xl border border-slate-200/90 transition-all cursor-pointer flex items-center gap-3 shadow-xs"
          >
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 font-extrabold flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black text-slate-900">Top-Up Deposit</div>
              <div className="text-[11px] text-slate-400 truncate">Paket saldo / kiloan</div>
            </div>
          </div>

          <div
            onClick={() => onNavigateTab?.('laundry_racks')}
            className="bg-white hover:bg-rose-50/50 p-4 rounded-3xl border border-slate-200/90 transition-all cursor-pointer flex items-center gap-3 shadow-xs"
          >
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-800 font-extrabold flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black text-slate-900">Reminder Rak</div>
              <div className="text-[11px] text-slate-400 truncate">Kirim WA pengingat</div>
            </div>
          </div>
        </div>

        {/* 2 Prioritas Meja Depan: Siap Serah Terima & Mengendap di Rak */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Siap Serah Terima */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Siap Serah Terima & Pelunasan
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Cucian sudah di rak simpan
                </p>
              </div>
              <span className="text-[10.5px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                {readyOrders.length} di Rak
              </span>
            </div>

            <div className="space-y-2 pt-1 max-h-80 overflow-y-auto">
              {readyOrders.length > 0 ? (
                readyOrders.slice(0, 8).map((o: any) => (
                  <div
                    key={o.id}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
                        <span>{o.customerName}</span>
                        <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 text-[10px] font-extrabold">
                          {o.rackCode}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {o.invoiceNumber} • {o.weightKg ? `${o.weightKg} Kg` : `${o.totalPieces} Pcs`} •{' '}
                        {o.isPaid ? (
                          <span className="text-emerald-700 font-black">LUNAS</span>
                        ) : (
                          <span className="text-rose-600 font-black">Sisa: {formatRupiah(o.remainingAmount)}</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => onNavigateTab?.('laundry_queue')}
                      className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto ${
                        o.isPaid
                          ? 'bg-blue-900 hover:bg-blue-800 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {o.isPaid ? 'Serahkan Pakaian' : 'Lunasi & Serahkan'}
                    </button>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-slate-400 text-xs">
                  Tidak ada cucian yang sedang menunggu serah ambil di rak.
                </div>
              )}
            </div>
          </div>

          {/* Cucian Mengendap di Rak (> 3 Hari) */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Cucian Mengendap di Rak (&gt; 3 Hari)
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Kirim pengingat WhatsApp 1-klik agar rak tetap lega
                </p>
              </div>
              <span className="text-[10.5px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                {staleOrders.length} Nota
              </span>
            </div>

            <div className="space-y-2 pt-1 max-h-80 overflow-y-auto">
              {staleOrders.length > 0 ? (
                staleOrders.map((o: any) => (
                  <div
                    key={o.id}
                    className="p-3 rounded-2xl bg-rose-50/50 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
                        <span>{o.customerName}</span>
                        <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-extrabold">
                          {o.daysOnRack} Hari di Rak
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {o.invoiceNumber} • {o.rackCode} • {o.isPaid ? 'Lunas' : `Sisa ${formatRupiah(o.remainingAmount)}`}
                      </div>
                    </div>

                    <button
                      onClick={() => onNavigateTab?.('laundry_racks')}
                      className="py-1.5 px-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer whitespace-nowrap self-start sm:self-auto"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Kirim WA</span>
                    </button>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-slate-400 text-xs">
                  Semua cucian di rak masih baru (&lt; 3 hari).
                </div>
              )}
            </div>
          </div>

          {/* Shortcut Win-Back CRM Pelanggan Pasif */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Users className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Pelanggan Pasif (Win-Back CRM)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Sapa kembali pelanggan yang &gt; 30 hari tidak mencuci via WhatsApp resmi toko
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    url.searchParams.set('tab', 'customers');
                    url.searchParams.set('subtab', 'winback');
                    window.history.replaceState({}, '', url.toString());
                    window.dispatchEvent(new CustomEvent('customers-subtab', { detail: 'winback' }));
                    window.dispatchEvent(new CustomEvent('wellpos:subtab_change', { detail: 'winback' }));
                  }
                  onNavigateTab?.('customers');
                }}
                className="py-2 px-3.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs self-start sm:self-auto"
              >
                <span>Buka Win-Back</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // VIEW C: DASHBOARD OPERATOR PRODUKSI (WORKSHOP — 100% ZERO RUPIAH)
  // =========================================================================
  const renderProductionDashboard = () => {
    const pipeline = dashboardData?.pipelineCounts || {
      sorting: { orderCount: 0, totalKg: 0 },
      washingDrying: { orderCount: 0, totalKg: 0 },
      ironingFolding: { orderCount: 0, totalKg: 0 },
      readyForPickup: { orderCount: 0, totalKg: 0 },
      overdueCount: 0,
      dueTodayCount: 0,
    };

    const urgentQueue: any[] = dashboardData?.urgentQueue || [];
    const activeMachines: any[] = dashboardData?.activeMachines || [];
    const lowStock: any[] = dashboardData?.lowStockSupplies || [];
    const myOutput = dashboardData?.myOutputToday || { orderCount: 0, totalKg: 0, stageActionsCount: 0 };

    return (
      <div className="space-y-4">
        {/* Banner Isolasi Workshop */}
        <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200/80 text-purple-900 text-xs font-semibold flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-purple-700 shrink-0" />
          <span>
            <strong>Mode Operator Produksi (Workshop):</strong> 100% terisolasi dari nominal uang, omzet, harga layanan, dan kas laci. Fokus penuh ke SLA, antrean cucian, & kualitas pengerjaan.
          </span>
        </div>

        {/* Header Operator Workshop */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Stasiun Kerja — {currentUser?.name || 'Operator Workshop'}
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-black uppercase tracking-wider bg-purple-100 text-purple-900">
                🫧 Mode Produksi
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Target hari ini: selesaikan <strong className="text-rose-600">{pipeline.overdueCount} nota Overdue</strong> & <strong className="text-amber-700">{pipeline.dueTodayCount} nota Jatuh Tempo Hari Ini</strong>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onNavigateTab?.('laundry_production')}
              className="px-4 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Scan QR / Barcode Nota</span>
            </button>
          </div>
        </div>

        {/* 4 Beban Kerja Stasiun (ZERO RUPIAH) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div
            onClick={() => onNavigateTab?.('laundry_production')}
            className="bg-white hover:bg-slate-50 p-4 sm:p-5 rounded-3xl border border-slate-200/90 transition-all cursor-pointer flex flex-col justify-between shadow-xs"
          >
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">1. Sortir & QC</span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 my-1">
              {pipeline.sorting.orderCount} Nota
            </div>
            <div className="text-[11px] text-slate-400">{pipeline.sorting.totalKg} Kg menunggu hitung</div>
          </div>

          <div
            onClick={() => onNavigateTab?.('laundry_production')}
            className="bg-blue-50/60 hover:bg-blue-50 p-4 sm:p-5 rounded-3xl border border-blue-200 transition-all cursor-pointer flex flex-col justify-between shadow-xs"
          >
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-900">2. Cuci & Kering</span>
            <div className="text-xl sm:text-2xl font-black text-blue-900 my-1">
              {pipeline.washingDrying.orderCount} Nota
            </div>
            <div className="text-[11px] text-blue-600">{pipeline.washingDrying.totalKg} Kg • Mesin cuci/dryer</div>
          </div>

          <div
            onClick={() => onNavigateTab?.('laundry_production')}
            className="bg-white hover:bg-slate-50 p-4 sm:p-5 rounded-3xl border border-slate-200/90 transition-all cursor-pointer flex flex-col justify-between shadow-xs"
          >
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-800">3. Setrika & Lipat</span>
            <div className="text-xl sm:text-2xl font-black text-amber-900 my-1">
              {pipeline.ironingFolding.orderCount} Nota
            </div>
            <div className="text-[11px] text-amber-600">{pipeline.ironingFolding.totalKg} Kg menunggu boiler</div>
          </div>

          <div className="bg-emerald-50/60 p-4 sm:p-5 rounded-3xl border border-emerald-200 flex flex-col justify-between shadow-xs">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800">Output Saya Hari Ini</span>
            <div className="text-xl sm:text-2xl font-black text-emerald-800 my-1">
              {myOutput.totalKg} Kg
            </div>
            <div className="text-[11px] text-emerald-600">{myOutput.orderCount} nota selesai dikerjakan</div>
          </div>
        </div>

        {/* Antrean Prioritas SLA & Status Mesin */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Antrean Prioritas SLA (2 Kolom) */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Antrean Prioritas SLA (Kerjakan Duluan)
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Diurutkan dari nota terlambat & jatuh tempo paling dekat
                </p>
              </div>
              {pipeline.overdueCount > 0 && (
                <span className="text-[10.5px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                  {pipeline.overdueCount} Terlambat
                </span>
              )}
            </div>

            <div className="space-y-2 pt-1 max-h-96 overflow-y-auto">
              {urgentQueue.length > 0 ? (
                urgentQueue.map((o: any) => (
                  <div
                    key={o.id}
                    className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                      o.isOverdue
                        ? 'bg-rose-50/70 border-rose-200'
                        : o.isRewash
                        ? 'bg-purple-50/70 border-purple-200'
                        : 'bg-amber-50/60 border-amber-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
                        <span>{o.invoiceNumber} — {o.customerName}</span>
                        {o.isOverdue && (
                          <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-black">
                            OVERDUE
                          </span>
                        )}
                        {o.isRewash && (
                          <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-black">
                            GARANSI REWASH
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {o.serviceName} • {o.weightKg ? `${o.weightKg} Kg` : `${o.totalPieces} Pcs`} • Tahap: {o.currentStage}
                      </div>
                    </div>

                    <button
                      onClick={() => onNavigateTab?.('laundry_production')}
                      className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto ${
                        o.isOverdue
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-blue-900 hover:bg-blue-800 text-white'
                      }`}
                    >
                      {o.isRewash ? 'Mulai Cuci Ulang' : 'Buka Stasiun →'}
                    </button>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Semua cucian berjalan sesuai jadwal SLA. Tidak ada antrean kritis.
                </div>
              )}
            </div>
          </div>

          {/* Status Mesin & Stok Bahan (1 Kolom) */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
                Status Mesin Aktif (Log Riil)
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Mesin yang sedang berjalan di workshop
              </p>
            </div>

            <div className="space-y-2">
              {activeMachines.length > 0 ? (
                activeMachines.map((m: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-900">{m.machineName}</div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {m.invoiceNumber} • {m.weightKg ? `${m.weightKg} Kg` : ''} • Op: {m.operatorName}
                      </div>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 shrink-0">
                      BERJALAN
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-4 text-center text-slate-400 text-xs">
                  Belum ada mesin yang ditag aktif saat ini.
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-3">
              <div className="text-xs font-black uppercase tracking-wider text-slate-800 mb-2">
                Stok Bahan Menipis
              </div>
              <div className="space-y-1.5">
                {lowStock.length > 0 ? (
                  lowStock.map((it: any, idx: number) => (
                    <div key={idx} className="p-2 rounded-xl bg-rose-50 border border-rose-200 flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-800">{it.name}</span>
                      <span className="font-black text-rose-700">Sisa {it.quantityOnHand} {it.uom}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400 text-[11px]">Semua bahan cuci aman.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // RENDER UTAMA BERDASARKAN ROLE
  // =========================================================================
  if (isPerformanceRole) {
    return (
      <div className="space-y-4">
        <PerformanceAnalyticsContainer
          activeOutlet={activeOutlet}
          currentUser={currentUser}
          onOpenPos={onOpenPos}
          onNavigateTab={onNavigateTab}
          onOpenFeedbackModal={() => setFeedbackModalOpen(true)}
        />
        <LaundryFeedbackManagementModal
          isOpen={feedbackModalOpen}
          onClose={() => setFeedbackModalOpen(false)}
          activeOutlet={activeOutlet}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {effectiveRole === 'OWNER' && renderOwnerDashboard()}
      {effectiveRole === 'CASHIER' && renderCashierDashboard()}
      {effectiveRole === 'PRODUCTION' && renderProductionDashboard()}

      <LaundryFeedbackManagementModal
        isOpen={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        activeOutlet={activeOutlet}
      />
    </div>
  );
};
