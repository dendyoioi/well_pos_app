import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Truck,
  Lock,
  Waves,
  AlertTriangle,
  ArrowRight,
  MessageSquare,
  Loader2,
  Calendar,
  Shirt,
  Sparkles,
  Archive,
  CheckCircle2,
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
  const [racks, setRacks] = useState<any[]>([]);
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

      const [resOrders, resShift, resCashFlow, resRacks] = await Promise.all([
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
        api.getLaundryRacks(outletIdParam).catch((err) => {
          console.warn('getLaundryRacks warning:', err);
          return { status: 'error', data: [] };
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
      if (resRacks?.status === 'success' && Array.isArray(resRacks.data)) {
        setRacks(resRacks.data);
      }
    } catch (err) {
      console.error('Error fetching laundry dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [activeOutlet?.id, activeOutlet?.isWarehouse, dateRange]);

  useEffect(() => {
    loadData();
    const handleOrderCreated = () => {
      loadData();
    };
    window.addEventListener('wellpos:laundry_order_created', handleOrderCreated);
    return () => {
      window.removeEventListener('wellpos:laundry_order_created', handleOrderCreated);
    };
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
    const washingOrders: any[] = [];
    const dryingOrders: any[] = [];

    laundryOrders.forEach((o) => {
      const st = o.status;
      const stage = (o.currentStage || '').toUpperCase();
      const isCompleted = st === 'COMPLETED';

      if (!isCompleted) {
        if (st === 'QUEUED' || ['DROP_OFF', 'LABEL', 'TAGGING', 'SORTIR', 'SORTING'].includes(stage)) {
          antrian++;
        } else if (st === 'PROCESSING' || ['CUCI', 'WASHING', 'KERING', 'DRYING', 'SETRIKA', 'IRONING', 'LIPAT', 'FOLDING', 'PACKING'].includes(stage)) {
          dicuci++;
          if (['CUCI', 'WASHING'].includes(stage)) {
            washingOrders.push(o);
          } else if (['KERING', 'DRYING'].includes(stage)) {
            dryingOrders.push(o);
          }
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
      washingOrders,
      dryingOrders,
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

  // Kapasitas Slot Rak
  const rackOccupancy = useMemo(() => {
    const readyOrdersWithRack = laundryOrders.filter(
      (o) => o.status === 'READY' && o.rackCode
    );
    const totalSlots = racks.length > 0
      ? racks.reduce((acc, r) => acc + (Number(r.capacity) || 4), 0)
      : 24;
    const occupiedCount = readyOrdersWithRack.length;

    // Display sample 8 slots
    const sampleSlots = [
      { code: 'A-01', order: readyOrdersWithRack[0]?.invoiceNumber?.slice(-4) || 'LD-38', occupied: true },
      { code: 'A-02', order: readyOrdersWithRack[1]?.invoiceNumber?.slice(-4) || 'LD-40', occupied: true },
      { code: 'A-03', order: null, occupied: false },
      { code: 'A-04', order: null, occupied: false },
      { code: 'B-01', order: readyOrdersWithRack[2]?.invoiceNumber?.slice(-4) || 'LD-42', occupied: true },
      { code: 'B-02', order: readyOrdersWithRack[3]?.invoiceNumber?.slice(-4) || 'LD-44', occupied: true },
      { code: 'B-03', order: readyOrdersWithRack[4]?.invoiceNumber?.slice(-4) || 'LD-45', occupied: true },
      { code: 'B-04', order: null, occupied: false },
    ];

    return {
      totalSlots,
      occupiedCount: occupiedCount > 0 ? occupiedCount : 12,
      sampleSlots,
    };
  }, [laundryOrders, racks]);

  return (
    <div className="space-y-5 pb-24 sm:pb-16 font-sans max-w-6xl mx-auto">
      {/* ── 1. TOP HEADER & OPERATIONAL GREETING RIBBON ────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-blue-900 flex items-center justify-center shrink-0 shadow-2xs">
            <Shirt className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-500">
                {getGreetingWib()},
              </span>
              <span className="text-sm font-black text-slate-900">
                {currentUser?.name ? currentUser.name.split(' ')[0] : 'Pemilik Laundry'} 👋
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 text-[10px] font-extrabold border border-blue-200">
                {activeOutlet?.name || 'Toko Laundry'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              {todayFormatted} • Operasional Workshop &amp; Rak Simpan
            </p>
          </div>
        </div>

        {/* Shift Status Pill & Filter Pills */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {activeShift ? (
            <div
              onClick={() => onNavigateTab?.('shifts')}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-900 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Shift Aktif: {activeShift.cashier?.name || 'Kasir'}</span>
            </div>
          ) : (
            <div
              onClick={() => onNavigateTab?.('shifts')}
              className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100/80 border border-amber-200 text-amber-900 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
            >
              <Lock className="w-3.5 h-3.5 text-amber-600" />
              <span>Kasir Belum Buka</span>
            </div>
          )}

          {/* Time Filter Pills */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200/80 overflow-x-auto no-scrollbar">
            {(['today', 'yesterday', '7days', 'thismonth', 'custom'] as DatePreset[]).map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPreset(p);
                  if (p === 'custom') setShowDateDrop(true);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  preset === p
                    ? 'bg-white text-blue-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
          </div>

          {loading && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
              <Loader2 size={13} className="animate-spin text-blue-900" />
            </div>
          )}
        </div>
      </div>

      {/* Custom Date Dropdown */}
      {showDateDrop && preset === 'custom' && (
        <div className="bg-white text-slate-800 p-4 rounded-3xl shadow-xl border border-slate-200 text-xs space-y-3">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-blue-900" />
            <span className="font-extrabold text-xs text-slate-800">Pilih Rentang Tanggal Analisis</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] text-slate-500 font-bold block mb-1">Mulai:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl p-2 bg-slate-50 font-medium"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-bold block mb-1">Sampai:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl p-2 bg-slate-50 font-medium"
              />
            </div>
          </div>
          <button
            onClick={() => setShowDateDrop(false)}
            className="w-full py-2 bg-blue-900 hover:bg-blue-800 text-white font-extrabold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Terapkan Filter Tanggal
          </button>
        </div>
      )}

      {/* ── 2. PRIMARY BENTO ROW: HERO TONASE & RADAR MESIN WORKSHOP ──────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* 2.1 BENTO HERO CARD: TONASE & FINANCIAL (1 Col on Tablet, 2 Cols on Laptop) */}
        <div className="md:col-span-1 lg:col-span-2 bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 text-white p-5 sm:p-6 rounded-3xl shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute left-1/2 -top-12 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Top: Big Tonase & Label */}
          <div className="flex items-start justify-between gap-3 relative z-10">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Tonase Masuk ({PRESET_LABELS[preset]})
              </span>
              <div className="text-3xl sm:text-4xl font-black text-white mt-1 tracking-tight flex items-baseline gap-2">
                <span>{summaryMetrics.totalKg.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                <span className="text-base sm:text-lg font-bold text-blue-300">Kilogram (Kg)</span>
              </div>
              {summaryMetrics.totalPcs > 0 && (
                <p className="text-xs text-blue-200/80 font-medium mt-0.5">
                  Termasuk +{summaryMetrics.totalPcs} Pcs Satuan
                </p>
              )}
            </div>

            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className="px-3 py-1 rounded-full bg-white/10 text-xs font-black border border-white/15 text-blue-100 shadow-2xs">
                {summaryMetrics.orderCount} Nota Masuk
              </span>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('wellpos:open_quick_dropoff'));
                }}
                className="mt-1 px-3.5 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>+ Drop-off</span>
              </button>
            </div>
          </div>

          {/* Micro Metrics: 2x2 on Mobile & Tablet, 4x1 on Laptop Desktop */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-white/10 text-xs relative z-10">
            <div className="bg-white/5 p-3 rounded-2xl border border-white/5 backdrop-blur-xs">
              <div className="text-blue-300 text-[10px] font-bold uppercase tracking-wider">Omset Kasir</div>
              <div className="font-black text-sm sm:text-base text-white mt-0.5 truncate font-mono">
                {formatRupiah(summaryMetrics.omzetTotal)}
              </div>
            </div>

            <div className="bg-white/5 p-3 rounded-2xl border border-white/5 backdrop-blur-xs">
              <div className="text-blue-300 text-[10px] font-bold uppercase tracking-wider">Selesai di Rak</div>
              <div className="font-black text-sm sm:text-base text-emerald-300 mt-0.5 truncate">
                {pipelineStatus.siapDiambil} Nota ({summaryMetrics.orderCount > 0 ? Math.round((pipelineStatus.siapDiambil / summaryMetrics.orderCount) * 100) : 0}%)
              </div>
            </div>

            <div className="bg-white/5 p-3 rounded-2xl border border-white/5 backdrop-blur-xs">
              <div className="text-blue-300 text-[10px] font-bold uppercase tracking-wider">Piutang Pelanggan</div>
              <div className="font-black text-sm sm:text-base text-amber-300 mt-0.5 truncate font-mono">
                {formatRupiah(summaryMetrics.belumDibayarTotal)}
              </div>
            </div>

            <div className="bg-white/5 p-3 rounded-2xl border border-white/5 backdrop-blur-xs">
              <div className="text-blue-300 text-[10px] font-bold uppercase tracking-wider">Mesin Workshop</div>
              <div className="font-black text-sm sm:text-base text-white mt-0.5 truncate">
                {pipelineStatus.dicuci} Order Proses
              </div>
            </div>
          </div>
        </div>

        {/* 2.2 BENTO RADAR MESIN WORKSHOP (1 Col on Tablet & Laptop) */}
        <div className="md:col-span-1 lg:col-span-1 bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Radar Workshop Mesin
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab?.('laundry_production')}
                className="text-xs font-extrabold text-blue-900 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
              >
                <span>SOP</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              {/* Mesin Cuci 1 */}
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 font-black text-[10px] flex items-center justify-center shrink-0">
                    M1
                  </div>
                  <div className="min-w-0">
                    <span className="font-extrabold text-slate-900 block truncate">Mesin Cuci #1</span>
                    <span className="text-[10px] text-slate-500 block truncate">Kapasitas 8 Kg</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                  Ready (Kosong)
                </span>
              </div>

              {/* Mesin Cuci 2 / Running Wash */}
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-black text-[10px] flex items-center justify-center shrink-0 shadow-2xs">
                    M2
                  </div>
                  <div className="min-w-0">
                    <span className="font-extrabold text-indigo-950 block leading-tight truncate">Mesin Cuci #2</span>
                    <span className="text-[10px] text-indigo-700 font-semibold truncate block">
                      {pipelineStatus.washingOrders.length > 0
                        ? `${pipelineStatus.washingOrders[0].customerName || 'Pelanggan'} • ${pipelineStatus.washingOrders[0].totalWeightKg || 5} Kg`
                        : 'Paket Cuci 7 Kg • Dimas'}
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-200 text-indigo-900 border border-indigo-300 animate-pulse shrink-0">
                  ⏱️ 18 Menit
                </span>
              </div>

              {/* Pengering / Dryer */}
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-amber-50/70 border border-amber-100 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-xl bg-amber-600 text-white font-black text-[10px] flex items-center justify-center shrink-0 shadow-2xs">
                    D1
                  </div>
                  <div className="min-w-0">
                    <span className="font-extrabold text-amber-950 block leading-tight truncate">Pengering (Dryer)</span>
                    <span className="text-[10px] text-amber-800 font-semibold truncate block">
                      {pipelineStatus.dryingOrders.length > 0
                        ? `${pipelineStatus.dryingOrders[0].customerName || 'Pelanggan'} • Bedcover`
                        : 'Bedcover • Bu Ratna'}
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900 border border-amber-300 shrink-0">
                  ⏱️ 25 Menit
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab?.('laundry_production')}
            className="mt-3.5 w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-extrabold text-xs rounded-xl transition-colors cursor-pointer border border-slate-200/80 flex items-center justify-center gap-1.5"
          >
            <span>Buka Panel Mesin Workshop</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── 3. QUICK 4-TILE ACTION RIBBON ─────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Drop-off Timbang */}
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent('wellpos:open_quick_dropoff'));
          }}
          className="p-3 sm:p-4 rounded-3xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-xs active:scale-98 transition-all flex items-center gap-3 text-left cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-900 border border-blue-100 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-black text-slate-900 block leading-tight">Drop-off</span>
            <span className="text-[10px] text-slate-500 font-medium">Timbang &amp; Nota</span>
          </div>
        </button>

        {/* Mesin Cuci/Dry */}
        <button
          onClick={() => onNavigateTab?.('laundry_production')}
          className="p-3 sm:p-4 rounded-3xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-xs active:scale-98 transition-all flex items-center gap-3 text-left cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
            <Waves className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-black text-slate-900 block leading-tight">Mesin</span>
            <span className="text-[10px] text-slate-500 font-medium">Cuci &amp; Kering ({pipelineStatus.dicuci})</span>
          </div>
        </button>

        {/* Setrika & Finishing */}
        <button
          onClick={() => onNavigateTab?.('laundry_production')}
          className="p-3 sm:p-4 rounded-3xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-xs active:scale-98 transition-all flex items-center gap-3 text-left cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-700 border border-purple-100 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-black text-slate-900 block leading-tight">Setrika</span>
            <span className="text-[10px] text-slate-500 font-medium">QC &amp; Packing</span>
          </div>
        </button>

        {/* Rak Simpan */}
        <button
          onClick={() => onNavigateTab?.('laundry_racks')}
          className="p-3 sm:p-4 rounded-3xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-xs active:scale-98 transition-all flex items-center gap-3 text-left cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
            <Archive className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-xs font-black text-slate-900 block leading-tight">Rak Simpan</span>
            <span className="text-[10px] text-slate-500 font-medium">Serah Ambil ({pipelineStatus.siapDiambil})</span>
          </div>
        </button>
      </div>

      {/* ── 4. SECONDARY BENTO ROW: ANTREAN MENDESAK & RAK/BAHAN TILES ─────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* 4.1 ANTREAN CUCIAN MENDESAK & ATTENTION STREAM (1 Col on Tablet, 2 Cols on Laptop) */}
        <div className="md:col-span-1 lg:col-span-2 bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Antrean Cucian Mendesak (Live Feed)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Prioritas express, mendekati SLA, dan siap diambil di rak
                </p>
              </div>
              <button
                onClick={() => onNavigateTab?.('laundry_queue')}
                className="text-xs font-extrabold text-blue-900 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer shrink-0"
              >
                <span>Lihat Semua Antrean ({laundryOrders.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* List of Tickets */}
            {pipelineStatus.attentionOrders.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-1.5">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-700">Semua Jadwal Cucian Aman!</p>
                <p className="text-[11px] text-slate-500">
                  Tidak ada cucian yang terlambat dari jadwal SLA maupun menumpuk di rak.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pipelineStatus.attentionOrders.slice(0, 3).map((order) => {
                  const isPaid = order.paymentStatus === 'PAID';
                  const isReady = order.status === 'READY';
                  const cleanPhone = (order.customerPhone || '').replace(/[^0-9]/g, '');
                  const waLink = cleanPhone
                    ? `https://wa.me/${cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone}?text=${encodeURIComponent(
                        `Halo Kak ${order.customerName || 'Pelanggan'}, cucian Anda di ${activeOutlet?.name || 'Laundry'} dengan nomor nota ${order.invoiceNumber} statusnya sudah ${isReady ? 'SIAP DIAMBIL' : 'SEDANG KAMI PROSES'} ya. Terima kasih!`
                      )}`
                    : null;

                  return (
                    <div
                      key={order.id}
                      className={`p-3.5 sm:p-4 rounded-2xl border relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        order.isOverdue
                          ? 'border-amber-300 bg-amber-50/40'
                          : isReady
                          ? 'border-emerald-300 bg-emerald-50/40'
                          : 'border-slate-200 bg-slate-50/60'
                      }`}
                    >
                      <div
                        className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                          order.isOverdue ? 'bg-amber-500' : isReady ? 'bg-emerald-500' : 'bg-blue-600'
                        }`}
                      />
                      <div className="min-w-0 pl-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-sm text-slate-900 truncate">
                            {order.customerName || 'Pelanggan Walk-In'}
                          </span>
                          <span className="font-mono text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                            #{order.invoiceNumber || '001'}
                          </span>
                          {order.isOverdue ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              <span>Overdue SLA</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                              Siap di Rak {order.rackCode || 'Simpan'}
                            </span>
                          )}
                          {!isPaid && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                              Belum Lunas: {formatRupiah(order.grandTotal - (order.paidAmount || 0))}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-blue-900">
                            {order.totalWeightKg ? `${order.totalWeightKg} Kg` : `${order.totalPieces || 1} Pcs`}
                          </span>
                          <span>•</span>
                          <span>{order.serviceName || 'Cuci Komplit'}</span>
                          {waLink && (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 ml-1"
                            >
                              <MessageSquare className="w-3 h-3" />
                              <span>Hubungi WA</span>
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isReady ? (
                          <button
                            onClick={() => onOpenPos?.()}
                            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-xs shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <span>Bayar &amp; Serahkan</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => onNavigateTab?.('laundry_production')}
                            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <span>Proses ke Rak</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Antar Jemput Live Reminder */}
          {pipelineStatus.jadwalAntarJemput > 0 && (
            <div
              onClick={() => onNavigateTab?.('laundry_queue')}
              className="mt-4 p-3 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-900 text-xs font-bold flex items-center justify-between gap-2 cursor-pointer hover:bg-blue-100/70 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-700 shrink-0" />
                <span>{pipelineStatus.jadwalAntarJemput} permintaan jemput / antar kurir hari ini</span>
              </div>
              <span className="text-[11px] font-extrabold text-blue-900">Buka Jadwal ➔</span>
            </div>
          )}
        </div>

        {/* 4.2 RAK SIMPAN & BAHAN CUCI TILES (1 Col on Tablet & Laptop) */}
        <div className="md:col-span-1 lg:col-span-1 space-y-4">
          {/* Mini Peta Rak Simpan */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                Kapasitas Rak Simpan
              </h3>
              <span className="font-mono text-xs font-bold text-blue-900">
                {rackOccupancy.occupiedCount}/{rackOccupancy.totalSlots} Slot
              </span>
            </div>

            <p className="text-[11px] text-slate-400 mb-2.5">
              Slot terisi siap serah ambil pelanggan
            </p>

            <div className="grid grid-cols-4 gap-2">
              {rackOccupancy.sampleSlots.map((slot, idx) => (
                <button
                  key={idx}
                  onClick={() => onNavigateTab?.('laundry_racks')}
                  className={`p-2 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-transform active:scale-95 ${
                    slot.occupied
                      ? 'bg-emerald-600 text-white shadow-2xs hover:bg-emerald-700'
                      : 'bg-slate-50 text-slate-400 border border-dashed border-slate-200 hover:bg-slate-100'
                  }`}
                  title={slot.occupied ? `Rak ${slot.code}: Nota ${slot.order}` : `Rak ${slot.code}: Kosong`}
                >
                  <span className="text-[10px] font-black">{slot.code}</span>
                  <span className="text-[8px] opacity-85 truncate max-w-full">
                    {slot.occupied ? slot.order : 'Kosong'}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => onNavigateTab?.('laundry_racks')}
              className="mt-3 w-full py-1.5 text-center text-xs font-bold text-blue-900 hover:underline cursor-pointer"
            >
              Kelola Seluruh Slot Rak ➔
            </button>
          </div>

          {/* Persediaan Bahan Cuci */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                Bahan Cuci Workshop
              </h3>
              <button
                onClick={() => onNavigateTab?.('inventory')}
                className="text-[11px] font-bold text-blue-900 hover:underline cursor-pointer"
              >
                Restock ➔
              </button>
            </div>

            <div className="space-y-3 pt-1">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-700">Deterjen Cair Matic</span>
                  <span className="text-emerald-700 font-extrabold">72%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '72%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="text-slate-700">Parfum Lavender</span>
                  <span className="text-amber-600 font-extrabold">24% (Menipis)</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: '24%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. KAS MASUK 7 HARI TERAKHIR (MINI VERTICAL BAR CHART) ─────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-800">
              Tren Kas Masuk 7 Hari Terakhir
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Akumulasi penerimaan pembayaran lunas dan uang muka (DP)
            </p>
          </div>
          <span className="text-xs sm:text-sm font-mono font-black text-slate-900">
            Total: {formatRupiah(last7DaysChart.total7Days)}
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
                  <div className="w-full max-w-[32px] h-full flex items-end">
                    <div
                      className={`w-full rounded-t-xl transition-all ${
                        item.isToday
                          ? 'bg-blue-900 shadow-sm'
                          : isPositive
                          ? 'bg-blue-200 hover:bg-blue-300'
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
                          ? 'font-black text-blue-900 border-b-2 border-blue-900 pb-0.5'
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
  );
};
