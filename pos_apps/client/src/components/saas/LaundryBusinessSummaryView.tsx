import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Truck,
  Package,
  BarChart3,
  Lock,
  Unlock,
  Clock,
  Waves,
  AlertTriangle,
  ArrowRight,
  MessageSquare,
  Loader2,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import { api } from '../../services/api';
import type { Outlet } from '../../types/outlet';
import type { User } from '../../types/auth';
import { formatRupiah } from '../../utils/currency';
import { toLocalDateStr, getLocalStartOfDay, getLocalEndOfDay } from '../../utils/date';

interface LaundryBusinessSummaryViewProps {
  activeOutlet: Outlet | null;
  currentUser?: User;
  onOpenPos?: () => void;
  onNavigateTab?: (tab: string) => void;
}

type DatePreset = 'today' | 'yesterday' | '7days' | 'thismonth' | 'lastmonth' | 'custom';
const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Hari ini',
  yesterday: 'Kemarin',
  '7days': '7 hari',
  thismonth: 'Bulan ini',
  lastmonth: 'Bulan lalu',
  custom: 'Kustom',
};

function getPresetRange(preset: DatePreset): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { start: getLocalStartOfDay(now), end: getLocalEndOfDay(now) };
    case 'yesterday': {
      const y = new Date(now.getTime() - 86400_000);
      return { start: getLocalStartOfDay(y), end: getLocalEndOfDay(y) };
    }
    case '7days':
      return { start: getLocalStartOfDay(new Date(now.getTime() - 6 * 86400_000)), end: getLocalEndOfDay(now) };
    case 'thismonth':
      return {
        start: getLocalStartOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
        end: getLocalEndOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)),
      };
    case 'lastmonth':
      return {
        start: getLocalStartOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        end: getLocalEndOfDay(new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)),
      };
    default:
      return { start: getLocalStartOfDay(now), end: getLocalEndOfDay(now) };
  }
}

function getGreetingWib(): string {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 11) return 'Selamat pagi';
  if (hour >= 11 && hour < 15) return 'Selamat siang';
  if (hour >= 15 && hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

function formatDayName(date: Date): string {
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  return days[date.getDay()];
}

export const LaundryBusinessSummaryView: React.FC<LaundryBusinessSummaryViewProps> = ({
  activeOutlet,
  currentUser,
  onOpenPos,
  onNavigateTab,
}) => {
  // Preset tanggal
  const [preset, setPreset] = useState<DatePreset>('today');
  const [customStart, setCustomStart] = useState(toLocalDateStr(new Date()));
  const [customEnd, setCustomEnd] = useState(toLocalDateStr(new Date()));
  const [showDateDrop, setShowDateDrop] = useState(false);

  // Data state
  const [laundryOrders, setLaundryOrders] = useState<any[]>([]);
  const [activeShift, setActiveShift] = useState<any | null>(null);
  const [cashFlowData, setCashFlowData] = useState<{ totalCashOut: number }>({ totalCashOut: 0 });
  const [loading, setLoading] = useState(false);

  const dateRange = useMemo(() => {
    if (preset === 'custom') {
      return {
        start: getLocalStartOfDay(new Date(customStart + 'T00:00:00')),
        end: getLocalEndOfDay(new Date(customEnd + 'T23:59:59')),
      };
    }
    return getPresetRange(preset);
  }, [preset, customStart, customEnd]);

  // Load Data dari API
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const outletIdParam = activeOutlet && !activeOutlet.isWarehouse ? activeOutlet.id : undefined;
      const startStr = toLocalDateStr(dateRange.start);
      const endStr = toLocalDateStr(dateRange.end);

      const [resOrders, resShift, resCashFlow] = await Promise.all([
        api.getLaundryOrders(outletIdParam).catch((err) => {
          console.warn('getLaundryOrders warning:', err);
          return { status: 'error', data: [] };
        }),
        api.getCurrentShift().catch((err) => {
          console.warn('getCurrentShift warning:', err);
          return null;
        }),
        api.getCashFlowReport({ startDate: startStr, endDate: endStr, outletId: outletIdParam }).catch((err) => {
          console.warn('getCashFlowReport warning:', err);
          return null;
        }),
      ]);

      if (resOrders?.status === 'success' && Array.isArray(resOrders.data)) {
        setLaundryOrders(resOrders.data);
      }
      if (resShift?.status === 'success' && resShift.data) {
        setActiveShift(resShift.data);
      } else {
        setActiveShift(null);
      }
      if (resCashFlow?.status === 'success' && resCashFlow.data?.summary) {
        setCashFlowData({
          totalCashOut: Number(resCashFlow.data.summary.totalCashOut || 0),
        });
      }
    } catch (err) {
      console.error('Error fetching laundry dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [activeOutlet?.id, activeOutlet?.isWarehouse, dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter pesanan dalam rentang tanggal terpilih
  const filteredOrders = useMemo(() => {
    return laundryOrders.filter((o) => {
      const at = new Date(o.createdAt);
      return at >= dateRange.start && at <= dateRange.end;
    });
  }, [laundryOrders, dateRange]);

  // Perhitungan Omzet & Metrik Finansial
  const summaryMetrics = useMemo(() => {
    let omzetTotal = 0;
    let kasMasukTotal = 0;
    let belumDibayarTotal = 0;
    let totalKg = 0;
    let totalPcs = 0;

    filteredOrders.forEach((o) => {
      const grandTotal = Number(o.grandTotal || 0);
      const paid = Number(o.paidAmount || 0);
      const unpaid = Math.max(0, grandTotal - paid);

      omzetTotal += grandTotal;
      kasMasukTotal += paid;
      belumDibayarTotal += unpaid;

      totalKg += Number(o.totalWeightKg || 0);
      totalPcs += Number(o.totalPieces || 0);
    });

    return {
      omzetTotal,
      kasMasukTotal,
      belumDibayarTotal,
      totalKg,
      totalPcs,
      orderCount: filteredOrders.length,
      pengeluaran: cashFlowData.totalCashOut,
    };
  }, [filteredOrders, cashFlowData.totalCashOut]);

  // Status Cucian Saat Ini (Antrian, Dicuci, Siap Diambil)
  const pipelineStatus = useMemo(() => {
    let antrian = 0;
    let dicuci = 0;
    let siapDiambil = 0;
    let jadwalAntarJemput = 0;
    let overdueCount = 0;
    const nowTime = Date.now();
    const attentionOrders: any[] = [];

    laundryOrders.forEach((o) => {
      const st = o.status;
      const stage = (o.currentStage || '').toUpperCase();
      const isCompleted = st === 'COMPLETED';

      if (!isCompleted) {
        if (st === 'QUEUED' || ['DROP_OFF', 'LABEL', 'TAGGING', 'SORTIR', 'SORTING'].includes(stage)) {
          antrian++;
        } else if (st === 'PROCESSING' || ['CUCI', 'WASHING', 'KERING', 'DRYING', 'SETRIKA', 'IRONING', 'LIPAT', 'FOLDING', 'PACKING'].includes(stage)) {
          dicuci++;
        } else if (st === 'READY' || stage === 'RACK_STORAGE' || stage === 'PENGEMASAN') {
          siapDiambil++;
        }
      }

      // Deteksi layanan antar jemput
      const notes = (o.customerNotes || '').toLowerCase();
      const sName = (o.serviceName || '').toLowerCase();
      if (notes.includes('antar') || notes.includes('jemput') || sName.includes('delivery') || sName.includes('pickup')) {
        jadwalAntarJemput++;
      }

      // Deteksi terlambat (Overdue SLA)
      if (o.estimatedReadyAt && !isCompleted) {
        const estTime = new Date(o.estimatedReadyAt).getTime();
        const isOverdue = nowTime > estTime;
        if (isOverdue) {
          overdueCount++;
          attentionOrders.push({
            ...o,
            isOverdue: true,
            estReady: new Date(o.estimatedReadyAt),
          });
        }
      } else if (st === 'READY' && !isCompleted) {
        // Siap diambil tapi belum diambil > 2 hari
        const readyTime = new Date(o.completedAt || o.createdAt).getTime();
        const days = Math.floor((nowTime - readyTime) / 86400_000);
        if (days >= 2) {
          attentionOrders.push({
            ...o,
            isOverdue: false,
            daysInRack: days,
          });
        }
      }
    });

    return {
      antrian,
      dicuci,
      siapDiambil,
      jadwalAntarJemput,
      overdueCount,
      attentionOrders,
    };
  }, [laundryOrders]);

  // Kas Masuk 7 Hari Terakhir untuk Mini Bar Chart
  const last7DaysChart = useMemo(() => {
    const days: { date: Date; label: string; amount: number; isToday: boolean }[] = [];
    const now = new Date();
    let total7Days = 0;

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const start = getLocalStartOfDay(d).getTime();
      const end = getLocalEndOfDay(d).getTime();
      const isToday = i === 0;

      let dayTotal = 0;
      laundryOrders.forEach((o) => {
        const orderTime = new Date(o.createdAt).getTime();
        if (orderTime >= start && orderTime <= end) {
          dayTotal += Number(o.paidAmount || 0);
        }
      });

      total7Days += dayTotal;
      days.push({
        date: d,
        label: isToday ? 'Hari ini' : formatDayName(d),
        amount: dayTotal,
        isToday,
      });
    }

    const maxAmount = Math.max(...days.map((d) => d.amount), 1);

    return {
      days,
      total7Days,
      maxAmount,
    };
  }, [laundryOrders]);

  const todayFormatted = useMemo(() => {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
  }, []);

  return (
    <div className="space-y-4 pb-24 sm:pb-16 font-sans max-w-2xl mx-auto">
      {/* ── 1. HEADER ORANGE WARM (GREETING & FILTER PILLS) ────────────────── */}
      <div className="bg-gradient-to-b from-orange-500 via-orange-500 to-orange-600 rounded-3xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
        {/* Subtle decorative circles */}
        <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-white/10 blur-xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 w-36 h-36 rounded-full bg-orange-700/30 blur-lg pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-orange-100">
                {getGreetingWib()},
              </p>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-1.5 mt-0.5">
                <span>{currentUser?.name ? currentUser.name.split(' ')[0] : 'Pemilik'}</span>
                <span>👋</span>
              </h1>
              <p className="text-xs text-orange-100/90 mt-1 font-medium">
                {todayFormatted}
              </p>
            </div>

            {loading && (
              <div className="flex items-center gap-1 text-[11px] font-bold bg-white/20 backdrop-blur-xs px-2.5 py-1 rounded-full text-white">
                <Loader2 size={12} className="animate-spin" />
                <span>Memuat</span>
              </div>
            )}
          </div>

          {/* Time Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
            {(['today', 'yesterday', '7days', 'thismonth', 'lastmonth', 'custom'] as DatePreset[]).map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPreset(p);
                  if (p === 'custom') setShowDateDrop(true);
                }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  preset === p
                    ? 'bg-white text-orange-600 shadow-sm'
                    : 'bg-orange-600/70 text-white hover:bg-orange-600 border border-orange-400/40'
                }`}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Custom Date Modal Dropdown */}
          {showDateDrop && preset === 'custom' && (
            <div className="bg-white text-slate-800 p-3 rounded-2xl shadow-xl border border-slate-200 text-xs space-y-2 mt-2">
              <div className="flex items-center gap-2">
                <Calendar size={13} className="text-slate-400" />
                <span className="font-bold text-[11px] text-slate-600">Pilih Rentang Tanggal</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold">Dari:</span>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-1.5 bg-slate-50 font-medium"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold">Sampai:</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-1.5 bg-slate-50 font-medium"
                  />
                </div>
              </div>
              <button
                onClick={() => setShowDateDrop(false)}
                className="w-full py-1.5 bg-orange-600 text-white font-bold rounded-xl text-xs hover:bg-orange-700"
              >
                Terapkan Tanggal
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. HERO OMZET CARD ────────────────────────────────────────────── */}
      <div className="-mt-6 mx-2 bg-white rounded-3xl border border-slate-100 shadow-md p-5 relative z-20 space-y-3.5">
        <div>
          <span className="text-xs font-semibold text-slate-500">
            Omzet • {PRESET_LABELS[preset].toLowerCase()}
          </span>
          <div className="text-3xl sm:text-4xl font-black font-mono text-slate-900 tracking-tight mt-0.5">
            {formatRupiah(summaryMetrics.omzetTotal)}
          </div>
          <div className="text-xs font-medium text-slate-500 mt-1">
            {summaryMetrics.orderCount} nota • {summaryMetrics.totalKg.toFixed(1)} kg
            {summaryMetrics.totalPcs > 0 ? ` • ${summaryMetrics.totalPcs} pcs` : ''}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100 pt-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="text-[11px] font-medium text-slate-400 block">Kas masuk</span>
              <span className="text-sm font-extrabold font-mono text-emerald-600 block mt-0.5">
                {formatRupiah(summaryMetrics.kasMasukTotal)}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-400 block">Belum dibayar</span>
              <span className="text-sm font-extrabold font-mono text-rose-500 block mt-0.5">
                {formatRupiah(summaryMetrics.belumDibayarTotal)}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-400 block">Pengeluaran</span>
              <span className="text-sm font-extrabold font-mono text-slate-800 block mt-0.5">
                {formatRupiah(summaryMetrics.pengeluaran)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. 4 TOMBOL AKSI CEPAT (QUICK ACTIONS) ─────────────────────────── */}
      <div className="grid grid-cols-4 gap-2 px-2 pt-1">
        {/* Nota Baru */}
        <button
          onClick={onOpenPos}
          className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-50 transition-colors group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-orange-50 border border-slate-200/80 group-hover:border-orange-200 flex items-center justify-center text-slate-700 group-hover:text-orange-600 transition-colors shadow-2xs">
            <Plus size={20} strokeWidth={2.5} />
          </div>
          <span className="text-[11.5px] font-bold text-slate-700 text-center leading-tight">
            Nota baru
          </span>
        </button>

        {/* Antar Jemput */}
        <button
          onClick={() => onNavigateTab?.('laundry_queue')}
          className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-50 transition-colors group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-emerald-50 border border-slate-200/80 group-hover:border-emerald-200 flex items-center justify-center text-slate-700 group-hover:text-emerald-600 transition-colors shadow-2xs">
            <Truck size={20} />
          </div>
          <span className="text-[11.5px] font-bold text-slate-700 text-center leading-tight">
            Antar jemput
          </span>
        </button>

        {/* Siap Diambil */}
        <button
          onClick={() => onNavigateTab?.('laundry_racks')}
          className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-50 transition-colors group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-amber-50 border border-slate-200/80 group-hover:border-amber-200 flex items-center justify-center text-slate-700 group-hover:text-amber-600 transition-colors shadow-2xs">
            <Package size={20} />
          </div>
          <span className="text-[11.5px] font-bold text-slate-700 text-center leading-tight">
            Siap diambil
          </span>
        </button>

        {/* Laporan */}
        <button
          onClick={() => onNavigateTab?.('reports')}
          className="flex flex-col items-center gap-1.5 p-2 rounded-2xl hover:bg-slate-50 transition-colors group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-blue-50 border border-slate-200/80 group-hover:border-blue-200 flex items-center justify-center text-slate-700 group-hover:text-blue-600 transition-colors shadow-2xs">
            <BarChart3 size={20} />
          </div>
          <span className="text-[11.5px] font-bold text-slate-700 text-center leading-tight">
            Laporan
          </span>
        </button>
      </div>

      {/* ── 4. BANNER STATUS KASIR ─────────────────────────────────────────── */}
      <div className="px-2">
        {activeShift ? (
          <div className="p-4 rounded-3xl bg-emerald-50/80 border border-emerald-200/90 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Unlock size={18} />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-extrabold text-slate-900">
                  Kasir Sedang Buka
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Petugas: {activeShift.cashier?.name || 'Kasir'} • Modal: {formatRupiah(activeShift.startingCash || 0)}
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab?.('shifts')}
              className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-emerald-200 text-emerald-800 text-xs font-bold transition-all shrink-0 cursor-pointer shadow-2xs"
            >
              Cek Shift
            </button>
          </div>
        ) : (
          <div className="p-4 rounded-3xl bg-amber-50/80 border border-amber-200/90 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Lock size={18} />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-extrabold text-slate-900">
                  Kasir belum dibuka
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Buka kasir sebelum menerima transaksi
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab?.('shifts')}
              className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs active:scale-98"
            >
              Buka kasir
            </button>
          </div>
        )}
      </div>

      {/* ── 5. STATUS CUCIAN SAAT INI (3 CARDS + NOTIF PILLS) ─────────────── */}
      <div className="px-2 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900">Status cucian saat ini</h2>
          <button
            onClick={() => onNavigateTab?.('laundry_queue')}
            className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-0.5 cursor-pointer"
          >
            <span>Lihat semua</span>
            <ChevronDown size={14} className="-rotate-90" />
          </button>
        </div>

        {/* 3 Pipeline Counter Cards */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* Antrian */}
          <div
            onClick={() => onNavigateTab?.('laundry_queue')}
            className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 mb-2">
              <Clock size={15} />
            </div>
            <div>
              <p className="text-2xl font-black font-mono text-slate-900">
                {pipelineStatus.antrian}
              </p>
              <span className="text-xs font-bold text-slate-500 mt-0.5 block">
                Antrian
              </span>
            </div>
          </div>

          {/* Dicuci */}
          <div
            onClick={() => onNavigateTab?.('laundry_production')}
            className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="w-7 h-7 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-2">
              <Waves size={15} />
            </div>
            <div>
              <p className="text-2xl font-black font-mono text-slate-900">
                {pipelineStatus.dicuci}
              </p>
              <span className="text-xs font-bold text-slate-500 mt-0.5 block">
                Dicuci
              </span>
            </div>
          </div>

          {/* Siap diambil */}
          <div
            onClick={() => onNavigateTab?.('laundry_racks')}
            className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all cursor-pointer flex flex-col justify-between"
          >
            <div className="w-7 h-7 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 mb-2">
              <Package size={15} />
            </div>
            <div>
              <p className="text-2xl font-black font-mono text-slate-900">
                {pipelineStatus.siapDiambil}
              </p>
              <span className="text-xs font-bold text-slate-500 mt-0.5 block">
                Siap diambil
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Notification Pills */}
        <div className="space-y-2">
          {/* Antar Jemput Pill */}
          {pipelineStatus.jadwalAntarJemput > 0 && (
            <div
              onClick={() => onNavigateTab?.('laundry_queue')}
              className="p-3 rounded-2xl bg-blue-50/90 border border-blue-200/80 text-blue-900 text-xs font-bold flex items-center gap-2 cursor-pointer hover:bg-blue-100/70 transition-colors"
            >
              <Truck size={15} className="text-blue-600 shrink-0" />
              <span>{pipelineStatus.jadwalAntarJemput} jadwal antar/jemput hari ini</span>
            </div>
          )}

          {/* Overdue SLA Pill */}
          {pipelineStatus.overdueCount > 0 && (
            <div
              onClick={() => onNavigateTab?.('laundry_queue')}
              className="p-3 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-800 text-xs font-bold flex items-center justify-between gap-2 cursor-pointer hover:bg-rose-100/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                <span>
                  {pipelineStatus.overdueCount} cucian lewat jadwal selesai. Ketuk untuk melihat.
                </span>
              </div>
              <ArrowRight size={13} className="text-rose-600 shrink-0" />
            </div>
          )}
        </div>
      </div>

      {/* ── 6. KAS MASUK 7 HARI TERAKHIR (MINI VERTICAL BAR CHART) ─────────── */}
      <div className="px-2">
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-900">Kas masuk 7 hari terakhir</h2>
            <span className="text-xs font-mono font-bold text-slate-600">
              {formatRupiah(last7DaysChart.total7Days)}
            </span>
          </div>

          {/* Bar Chart Container */}
          <div className="pt-6 pb-2">
            <div className="flex items-end justify-between gap-2 h-28">
              {last7DaysChart.days.map((item, idx) => {
                const heightPct = Math.max(8, (item.amount / last7DaysChart.maxAmount) * 100);
                const isPositive = item.amount > 0;

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    {/* Value on top of bar */}
                    {isPositive ? (
                      <span className="text-[10px] font-bold font-mono text-slate-600">
                        {item.amount >= 1_000_000
                          ? `${(item.amount / 1_000_000).toFixed(1)}jt`
                          : item.amount >= 1000
                          ? `${Math.round(item.amount / 1000)}rb`
                          : item.amount}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-300">-</span>
                    )}

                    {/* The Bar */}
                    <div className="w-full max-w-[28px] h-full flex items-end">
                      <div
                        className={`w-full rounded-t-lg transition-all ${
                          item.isToday
                            ? 'bg-orange-500'
                            : isPositive
                            ? 'bg-orange-200 hover:bg-orange-300'
                            : 'bg-slate-100'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>

                    {/* Day Label */}
                    <div className="text-center pt-1">
                      <span
                        className={`text-[11px] block ${
                          item.isToday
                            ? 'font-black text-orange-600 border-b-2 border-orange-500 pb-0.5'
                            : 'font-semibold text-slate-400'
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── 7. DAFTAR PERLU PERHATIAN (TICKET-STUB CARDS) ───────────────────── */}
      <div className="px-2 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900">Perlu perhatian</h2>
          <span className="text-xs font-bold text-slate-500">
            Siap diambil ({pipelineStatus.siapDiambil})
          </span>
        </div>

        {pipelineStatus.attentionOrders.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 text-center text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-700">Semua cucian aman!</p>
            <p>Tidak ada cucian yang terlambat atau mengendap melebihi jadwal.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {pipelineStatus.attentionOrders.slice(0, 5).map((order) => {
              const orderDate = new Date(order.createdAt);
              const dayNum = String(orderDate.getDate()).padStart(2, '0');
              const monthStr = orderDate.toLocaleDateString('id-ID', { month: 'short' });
              const shortInv = (order.invoiceNumber || '001').slice(-3);
              const isPaid = order.paymentStatus === 'PAID';
              const cleanPhone = (order.customerPhone || '').replace(/[^0-9]/g, '');
              const waLink = cleanPhone
                ? `https://wa.me/${cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone}?text=${encodeURIComponent(
                    `Halo Kak ${order.customerName || 'Pelanggan'}, cucian Anda di ${activeOutlet?.name || 'Laundry'} dengan nomor nota ${order.invoiceNumber} sedang kami tangani ya. Terima kasih!`
                  )}`
                : null;

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex overflow-hidden hover:border-slate-300 transition-all"
                >
                  {/* Left Ticket Stub */}
                  <div className="bg-rose-50/80 border-r border-dashed border-rose-200 px-3 py-3 flex flex-col justify-center items-center text-center shrink-0 min-w-[72px]">
                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">
                      No.
                    </span>
                    <span className="text-base font-black font-mono text-rose-700 leading-tight">
                      {shortInv}
                    </span>
                    <span className="text-[10px] font-semibold text-rose-500/90 mt-0.5">
                      {dayNum} {monthStr}
                    </span>
                  </div>

                  {/* Right Ticket Body */}
                  <div className="p-3 flex-1 flex flex-col justify-between gap-1.5 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-xs font-black text-slate-900 truncate block">
                          {order.customerName || 'Pelanggan Walk-In'}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {/* Status Badge */}
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80">
                            {order.status === 'READY' ? 'Siap di Rak' : 'Dicuci'}
                          </span>

                          {/* Payment Badge */}
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              isPaid
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                                : 'bg-rose-50 text-rose-700 border border-rose-200/80'
                            }`}
                          >
                            {isPaid ? 'Lunas' : 'Belum Lunas'}
                          </span>

                          {/* Terlambat Badge */}
                          {order.isOverdue && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 flex items-center gap-0.5">
                              <AlertTriangle size={10} />
                              <span>Terlambat</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-black font-mono text-slate-900 block">
                          {formatRupiah(order.grandTotal || 0)}
                        </span>
                        {waLink && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-600 hover:text-emerald-700 mt-1"
                          >
                            <MessageSquare size={11} />
                            <span>WA</span>
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                      <span>{order.totalWeightKg ? `${order.totalWeightKg} kg` : `${order.totalPieces || 1} pcs`}</span>
                      <span className="text-slate-400">
                        Selesai: {order.estimatedReadyAt ? new Date(order.estimatedReadyAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
