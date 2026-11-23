import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Search,
  Filter,
  Waves,
  Flame,
  Package,
  CheckCircle2,
  AlertTriangle,
  Check,
  Shield,
  Clock,
  QrCode,
  AlertOctagon,
  RotateCcw,
  Archive,
} from 'lucide-react';
import type { Outlet } from '../types/outlet';
import { api } from '../services/api';
import type { LaundryQueueOrder, ProductionStageDefinition } from '../types/laundry';
import { DEFAULT_PRODUCTION_STAGES } from '../types/laundry';
import { LaundrySortingModal } from '../components/LaundrySortingModal';
import { LaundryBarcodeScannerModal } from '../components/laundry/LaundryBarcodeScannerModal';
import { LaundryRewashModal } from '../components/laundry/LaundryRewashModal';

interface LaundryProductionViewProps {
  activeOutlet: Outlet | null;
}

type StationFilter = 'ALL' | 'SORTING' | 'WASHING_DRYING' | 'IRONING_FOLDING' | 'PACKING_RACK';
type SlaFilter = 'ALL' | 'DUE_TODAY' | 'OVERDUE';

export const LaundryProductionView: React.FC<LaundryProductionViewProps> = ({ activeOutlet }) => {
  const [orders, setOrders] = useState<LaundryQueueOrder[]>([]);
  const [stages, setStages] = useState<ProductionStageDefinition[]>(DEFAULT_PRODUCTION_STAGES);
  const [loading, setLoading] = useState(true);
  const [activeStation, setActiveStation] = useState<StationFilter>('ALL');
  const [slaFilter, setSlaFilter] = useState<SlaFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderForSorting, setSelectedOrderForSorting] = useState<LaundryQueueOrder | null>(null);
  const [selectedOrderForRewash, setSelectedOrderForRewash] = useState<LaundryQueueOrder | null>(null);
  const [rewashModalOpen, setRewashModalOpen] = useState(false);
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ordersRes, stagesRes] = await Promise.all([
        api.getLaundryOrders(activeOutlet?.id),
        api.getLaundryStageSettings ? api.getLaundryStageSettings().catch(() => null) : Promise.resolve(null),
      ]);

      if (ordersRes.status === 'success' && Array.isArray(ordersRes.data)) {
        setOrders(ordersRes.data);
      }
      if (stagesRes && stagesRes.status === 'success' && Array.isArray(stagesRes.data)) {
        setStages(stagesRes.data);
      }
    } catch (err: any) {
      console.error('Error fetching production data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeOutlet?.id]);

  // Evaluasi Status SLA Pesanan
  const getSlaStatus = (order: LaundryQueueOrder): 'OVERDUE' | 'DUE_TODAY' | 'NORMAL' => {
    if (!order.estimatedReadyAt || order.status === 'COMPLETED') return 'NORMAL';
    const now = new Date();
    const est = new Date(order.estimatedReadyAt);
    if (est.getTime() < now.getTime()) return 'OVERDUE';
    if (
      est.getDate() === now.getDate() &&
      est.getMonth() === now.getMonth() &&
      est.getFullYear() === now.getFullYear()
    ) {
      return 'DUE_TODAY';
    }
    return 'NORMAL';
  };

  // Statistik SLA
  const slaStats = useMemo(() => {
    let dueTodayCount = 0;
    let overdueCount = 0;
    orders.forEach((o) => {
      if (o.status === 'COMPLETED') return;
      const sla = getSlaStatus(o);
      if (sla === 'OVERDUE') overdueCount++;
      else if (sla === 'DUE_TODAY') dueTodayCount++;
    });
    return { dueTodayCount, overdueCount };
  }, [orders]);

  // Filter Antrean Berdasarkan Stasiun Kerja, SLA & Pencarian
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (order.status === 'COMPLETED') return false;

      // Filter SLA
      if (slaFilter !== 'ALL') {
        const sla = getSlaStatus(order);
        if (slaFilter === 'OVERDUE' && sla !== 'OVERDUE') return false;
        if (slaFilter === 'DUE_TODAY' && sla !== 'DUE_TODAY') return false;
      }

      // Filter Pencarian
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesInv = order.invoiceNumber.toLowerCase().includes(q);
        const matchesCust = order.customerName.toLowerCase().includes(q);
        const matchesSrv = order.serviceName.toLowerCase().includes(q);
        if (!matchesInv && !matchesCust && !matchesSrv) return false;
      }

      const stage = (order.currentStage || 'DROP_OFF').toUpperCase();

      if (activeStation === 'SORTING') {
        return stage === 'DROP_OFF' || stage === 'TAGGING' || stage === 'LABEL' || stage === 'SORTING' || stage === 'SORTIR';
      }
      if (activeStation === 'WASHING_DRYING') {
        return stage === 'WASHING' || stage === 'CUCI' || stage === 'DRYING' || stage === 'KERING' || stage === 'CLEANING' || stage === 'SPOTTING';
      }
      if (activeStation === 'IRONING_FOLDING') {
        return stage === 'IRONING' || stage === 'SETRIKA' || stage === 'EXTRA_SETRIKA' || stage === 'FOLDING' || stage === 'LIPAT' || stage === 'DETAILING';
      }
      if (activeStation === 'PACKING_RACK') {
        return stage === 'PACKING' || stage === 'PENGEMASAN' || stage === 'RACK_STORAGE';
      }

      return true;
    });
  }, [orders, activeStation, slaFilter, searchQuery]);

  // Statistik Cepat Stasiun
  const stats = useMemo(() => {
    let sortingCount = 0;
    let washDryCount = 0;
    let ironFoldCount = 0;
    let packRackCount = 0;

    orders.forEach((o) => {
      if (o.status === 'COMPLETED') return;
      const s = (o.currentStage || 'DROP_OFF').toUpperCase();
      if (s === 'DROP_OFF' || s === 'TAGGING' || s === 'LABEL' || s === 'SORTING' || s === 'SORTIR') sortingCount++;
      else if (s === 'WASHING' || s === 'CUCI' || s === 'DRYING' || s === 'KERING' || s === 'CLEANING' || s === 'SPOTTING') washDryCount++;
      else if (s === 'IRONING' || s === 'SETRIKA' || s === 'EXTRA_SETRIKA' || s === 'FOLDING' || s === 'LIPAT' || s === 'DETAILING') ironFoldCount++;
      else if (s === 'PACKING' || s === 'PENGEMASAN' || s === 'RACK_STORAGE') packRackCount++;
    });

    return {
      total: sortingCount + washDryCount + ironFoldCount + packRackCount,
      sortingCount,
      washDryCount,
      ironFoldCount,
      packRackCount,
    };
  }, [orders]);

  // Fungsi Cepat Maju ke Tahap Berikutnya
  const handleQuickAdvance = async (order: LaundryQueueOrder) => {
    const current = (order.currentStage || 'DROP_OFF').toUpperCase();
    if (current === 'RACK_STORAGE' || order.status === 'READY_FOR_PICKUP' || order.status === 'COMPLETED') {
      showToast('Cucian sudah siap di rak kasir outlet dan tidak dapat dimajukan lagi dari workshop', 'error');
      return;
    }

    let nextStage = 'WASHING';

    if (current === 'DROP_OFF' || current === 'TAGGING' || current === 'LABEL') nextStage = 'SORTING';
    else if (current === 'SORTING' || current === 'SORTIR') nextStage = 'WASHING';
    else if (current === 'WASHING' || current === 'CUCI') nextStage = 'DRYING';
    else if (current === 'DRYING' || current === 'KERING') nextStage = 'IRONING';
    else if (current === 'IRONING' || current === 'SETRIKA') nextStage = 'FOLDING';
    else if (current === 'FOLDING' || current === 'LIPAT') nextStage = 'PACKING';
    else if (current === 'PACKING' || current === 'PENGEMASAN') nextStage = 'RACK_STORAGE';
    else return;

    try {
      setAdvancingId(order.id);
      const res = await api.advanceLaundryStage(order.id, {
        nextStage,
        notes: `Pengerjaan stasiun selesai -> lanjut ke ${nextStage}`,
      });
      if (res.status === 'success') {
        showToast(`Nota ${order.invoiceNumber} berhasil dimajukan ke tahap ${nextStage}`);
        fetchData();
      } else {
        showToast(res.message || 'Gagal memajukan tahapan', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setAdvancingId(null);
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header View */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <div className="w-12 h-12 rounded-2xl bg-blue-900 text-white flex items-center justify-center shadow-md shadow-blue-900/20 shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-slate-900">Stasiun Produksi &amp; Pabrikasi</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-900 border border-blue-200 whitespace-nowrap self-start shrink-0">
                Mode Operator Stasiun
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Antarmuka khusus tim pengerjaan cuci, kering, setrika, sortir, dan pengemasan (terisolasi dari transaksi uang kasir)
            </p>
          </div>
        </div>

        {/* Action Controls in Header: Fast Scan & Search */}
        <div className="flex items-center gap-2.5 w-full xl:w-auto flex-wrap sm:flex-nowrap shrink-0">
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-black shadow-md shadow-blue-900/20 transition-all cursor-pointer shrink-0 active:scale-95 whitespace-nowrap"
            title="Pindai QR / Barcode Nota dengan Scanner USB atau Kamera"
          >
            <QrCode className="w-4 h-4 text-blue-200" />
            <span>Scan QR / Barcode Nota</span>
          </button>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nota, pelanggan, layanan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 h-10 text-[13px] sm:text-sm font-semibold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-900 focus:outline-none transition-all shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* Ringkasan Beban Kerja Antrean */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setActiveStation('SORTING')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            activeStation === 'SORTING'
              ? 'bg-blue-900 text-white border-blue-900 shadow-md shadow-blue-900/20'
              : 'bg-white border-slate-200 hover:border-blue-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <Filter className={`w-5 h-5 ${activeStation === 'SORTING' ? 'text-blue-200' : 'text-blue-900'}`} />
            <span className={`font-mono text-xl font-black ${activeStation === 'SORTING' ? 'text-white' : 'text-slate-900'}`}>
              {stats.sortingCount}
            </span>
          </div>
          <div className="font-extrabold text-xs">Stasiun Sortir &amp; QC</div>
          <div className={`text-[10px] ${activeStation === 'SORTING' ? 'text-blue-200' : 'text-slate-400'}`}>
            Hitung helai &amp; cek kendala
          </div>
        </div>

        <div
          onClick={() => setActiveStation('WASHING_DRYING')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            activeStation === 'WASHING_DRYING'
              ? 'bg-blue-900 text-white border-blue-900 shadow-md shadow-blue-900/20'
              : 'bg-white border-slate-200 hover:border-blue-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <Waves className={`w-5 h-5 ${activeStation === 'WASHING_DRYING' ? 'text-indigo-200' : 'text-indigo-600'}`} />
            <span className={`font-mono text-xl font-black ${activeStation === 'WASHING_DRYING' ? 'text-white' : 'text-slate-900'}`}>
              {stats.washDryCount}
            </span>
          </div>
          <div className="font-extrabold text-xs">Stasiun Cuci &amp; Kering</div>
          <div className={`text-[10px] ${activeStation === 'WASHING_DRYING' ? 'text-indigo-200' : 'text-slate-400'}`}>
            Mesin washer &amp; dryer
          </div>
        </div>

        <div
          onClick={() => setActiveStation('IRONING_FOLDING')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            activeStation === 'IRONING_FOLDING'
              ? 'bg-blue-900 text-white border-blue-900 shadow-md shadow-blue-900/20'
              : 'bg-white border-slate-200 hover:border-blue-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <Flame className={`w-5 h-5 ${activeStation === 'IRONING_FOLDING' ? 'text-amber-200' : 'text-amber-600'}`} />
            <span className={`font-mono text-xl font-black ${activeStation === 'IRONING_FOLDING' ? 'text-white' : 'text-slate-900'}`}>
              {stats.ironFoldCount}
            </span>
          </div>
          <div className="font-extrabold text-xs">Stasiun Setrika &amp; Lipat</div>
          <div className={`text-[10px] ${activeStation === 'IRONING_FOLDING' ? 'text-amber-200' : 'text-slate-400'}`}>
            Boiler uap &amp; folding
          </div>
        </div>

        <div
          onClick={() => setActiveStation('PACKING_RACK')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            activeStation === 'PACKING_RACK'
              ? 'bg-blue-900 text-white border-blue-900 shadow-md shadow-blue-900/20'
              : 'bg-white border-slate-200 hover:border-blue-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <Package className={`w-5 h-5 ${activeStation === 'PACKING_RACK' ? 'text-emerald-200' : 'text-emerald-600'}`} />
            <span className={`font-mono text-xl font-black ${activeStation === 'PACKING_RACK' ? 'text-white' : 'text-slate-900'}`}>
              {stats.packRackCount}
            </span>
          </div>
          <div className="font-extrabold text-xs">Stasiun Packing &amp; Rak</div>
          <div className={`text-[10px] ${activeStation === 'PACKING_RACK' ? 'text-emerald-200' : 'text-slate-400'}`}>
            Parfum, segel &amp; simpan rak
          </div>
        </div>
      </div>

      {/* Tabs Filter Bar & SLA Instant Filter */}
      <div className="space-y-3 border-b border-slate-200 pb-3">
        {/* Row 1: Station Tabs */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 max-w-full">
            {[
              { key: 'ALL', label: 'Semua Stasiun', count: stats.total },
              { key: 'SORTING', label: '1. Sortir & QC', count: stats.sortingCount },
              { key: 'WASHING_DRYING', label: '2. Cuci & Kering', count: stats.washDryCount },
              { key: 'IRONING_FOLDING', label: '3. Setrika & Lipat', count: stats.ironFoldCount },
              { key: 'PACKING_RACK', label: '4. Packing & Rak', count: stats.packRackCount },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveStation(tab.key as any)}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  activeStation === tab.key
                    ? 'bg-blue-900 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    activeStation === tab.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-400 font-semibold">
            Menampilkan {filteredOrders.length} nota cucian aktif
          </span>
        </div>

        {/* Row 2: SLA Instant Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 pb-1">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1 shrink-0">
            <Clock className="w-3.5 h-3.5" />
            <span>Filter SLA:</span>
          </span>

          <button
            type="button"
            onClick={() => setSlaFilter('ALL')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              slaFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>Semua Jadwal</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/20">
              {stats.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSlaFilter('DUE_TODAY')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              slaFilter === 'DUE_TODAY'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>Jatuh Tempo Hari Ini</span>
            <span
              className={`text-[10px] font-mono font-black px-1.5 py-0.2 rounded-full ${
                slaFilter === 'DUE_TODAY' ? 'bg-black/20 text-white' : 'bg-amber-200 text-amber-900'
              }`}
            >
              {slaStats.dueTodayCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSlaFilter('OVERDUE')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              slaFilter === 'OVERDUE'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            <AlertOctagon className="w-3 h-3" />
            <span>Terlambat (Overdue SLA)</span>
            <span
              className={`text-[10px] font-mono font-black px-1.5 py-0.2 rounded-full ${
                slaFilter === 'OVERDUE' ? 'bg-black/20 text-white' : 'bg-rose-200 text-rose-900'
              }`}
            >
              {slaStats.overdueCount}
            </span>
          </button>
        </div>
      </div>

      {/* Grid Kartu Pengerjaan Stasiun */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
          <div className="inline-block w-8 h-8 border-3 border-blue-900 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="font-bold text-sm">Memuat antrean stasiun produksi...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-16 text-center bg-white border border-slate-200 rounded-3xl space-y-2 shadow-xs">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="font-black text-slate-800 text-base">Tidak Ada Antrean di Stasiun Ini</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {slaFilter !== 'ALL'
              ? 'Tidak ada pesanan cucian yang sesuai dengan filter SLA yang dipilih.'
              : 'Seluruh cucian pada stasiun ini sudah selesai dikerjakan atau berpindah ke stasiun berikutnya.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((order) => {
            const currentStage = (order.currentStage || 'DROP_OFF').toUpperCase();
            const isAtSorting =
              currentStage === 'DROP_OFF' || currentStage === 'TAGGING' || currentStage === 'LABEL' || currentStage === 'SORTING' || currentStage === 'SORTIR';
            const isAdvancing = advancingId === order.id;
            const slaStatus = getSlaStatus(order);

            return (
              <div
                key={order.id}
                className={`bg-white rounded-3xl border p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3 sm:space-y-4 ${
                  slaStatus === 'OVERDUE'
                    ? 'border-rose-300 ring-1 ring-rose-200'
                    : slaStatus === 'DUE_TODAY'
                    ? 'border-amber-300'
                    : 'border-slate-200'
                }`}
              >
                {/* Header Kartu */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-xs font-black text-blue-900 block truncate">
                        {order.invoiceNumber}
                      </span>
                      <h4 className="font-black text-slate-900 text-sm truncate">{order.customerName}</h4>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {Boolean(order.defectNotes && order.defectNotes.includes('[REWASH/GARANSI:')) && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-600 text-white border border-rose-700 flex items-center gap-1 shadow-2xs">
                          <RotateCcw className="w-2.5 h-2.5" />
                          <span>GARANSI / REWASH</span>
                        </span>
                      )}

                      {/* Badge Tahapan Aktif */}
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-900 border border-blue-200">
                        {stages.find((st) => st.key === currentStage || st.id === currentStage)?.name || order.currentStage || 'Drop-off'}
                      </span>

                      {/* SLA Alert Badge */}
                      {slaStatus === 'OVERDUE' ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-300 flex items-center gap-1">
                          <AlertOctagon className="w-2.5 h-2.5 text-rose-600" />
                          <span>Terlambat SLA</span>
                        </span>
                      ) : slaStatus === 'DUE_TODAY' ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 text-amber-600" />
                          <span>Hari Ini</span>
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Info Layanan & Timbangan */}
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold text-slate-700">
                      <span className="truncate max-w-[170px]">{order.serviceName}</span>
                      <span className="font-mono text-blue-950 font-black shrink-0">
                        {order.totalWeightKg ? `${order.totalWeightKg} Kg` : `${order.totalPieces} Pcs`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Aroma Parfum:</span>
                      <span className="font-semibold text-purple-900">{order.perfumeVariant || 'Reguler'}</span>
                    </div>
                    {order.rackCode && (
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Slot Rak Simpan:</span>
                        <span className="font-mono font-black text-emerald-800">{order.rackCode}</span>
                      </div>
                    )}
                    {order.estimatedReadyAt && (
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5 border-t border-slate-200/60">
                        <span>Target Selesai:</span>
                        <span className={`font-mono font-bold ${
                          slaStatus === 'OVERDUE' ? 'text-rose-700' : slaStatus === 'DUE_TODAY' ? 'text-amber-800' : 'text-slate-700'
                        }`}>
                          {new Date(order.estimatedReadyAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Status Sortir & QC Alert */}
                  {order.isSorted ? (
                    <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-[11px] text-emerald-900 flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Sortir Selesai ({order.totalPieces} Helai)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedOrderForSorting(order)}
                        className="text-[10px] font-extrabold text-blue-900 underline hover:text-blue-950 cursor-pointer p-1"
                      >
                        Lihat Helai
                      </button>
                    </div>
                  ) : isAtSorting ? (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Belum dihitung sortir helai pakaian</span>
                    </div>
                  ) : null}

                  {/* Warning jika ada defect */}
                  {Array.isArray(order.defects) && order.defects.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-900 space-y-1">
                      <div className="font-extrabold flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5 text-rose-600" />
                        <span>Catatan QC Kendala:</span>
                      </div>
                      <div className="text-[10px] text-rose-800 italic">
                        {order.defectNotes || order.defects.join(', ')}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Action Buttons with Mobile-Ergonomic Touch Targets (>= 44px) */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  {(order.status === 'READY_FOR_PICKUP' || order.status === 'COMPLETED') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrderForRewash(order);
                        setRewashModalOpen(true);
                      }}
                      className="h-11 sm:h-10 min-h-[44px] px-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-800 font-extrabold text-xs flex items-center justify-center gap-1.5 border border-rose-200 cursor-pointer active:scale-95 transition-all shrink-0"
                      title="Klaim Garansi Cuci Ulang (Rp 0)"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                      <span>Cuci Ulang</span>
                    </button>
                  )}
                  {isAtSorting ? (
                    <button
                      type="button"
                      onClick={() => setSelectedOrderForSorting(order)}
                      className="w-full h-11 sm:h-10 min-h-[44px] rounded-2xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs shadow-md shadow-blue-900/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Filter className="w-4 h-4" />
                      <span>Buka Form Sortir &amp; QC</span>
                    </button>
                  ) : order.currentStage === 'RACK_STORAGE' || order.status === 'READY_FOR_PICKUP' ? (
                    <div className="w-full h-11 sm:h-10 min-h-[44px] rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 px-3">
                      <Archive className="w-4 h-4 text-blue-900" />
                      <span>Siap Diambil di Kasir (Rak: {order.rackCode || 'RAK-A1'})</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleQuickAdvance(order)}
                      disabled={isAdvancing}
                      className="w-full h-11 sm:h-10 min-h-[44px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      <span>{isAdvancing ? 'Memproses...' : 'Selesai & Lanjut Tahap'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Form Sortir Pakaian */}
      {selectedOrderForSorting && (
        <LaundrySortingModal
          isOpen={!!selectedOrderForSorting}
          onClose={() => setSelectedOrderForSorting(null)}
          order={selectedOrderForSorting}
          storeName={activeOutlet?.name || 'Well POS Laundry'}
          storeAddress={activeOutlet?.address || ''}
          storePhone={activeOutlet?.phone || ''}
          onSorted={() => {
            fetchData();
            setSelectedOrderForSorting(null);
          }}
        />
      )}

      {/* Modal Barcode Scanner */}
      {scannerOpen && (
        <LaundryBarcodeScannerModal
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          orders={orders}
          onOrderFound={(order) => {
            setSearchQuery(order.invoiceNumber);
            setScannerOpen(false);
            showToast(`Nota ${order.invoiceNumber} berhasil ditemukan`);
          }}
        />
      )}

      {/* Modal Klaim Garansi Cuci Ulang (Rewash Rp 0) */}
      {rewashModalOpen && selectedOrderForRewash && (
        <LaundryRewashModal
          isOpen={rewashModalOpen}
          onClose={() => {
            setRewashModalOpen(false);
            setSelectedOrderForRewash(null);
          }}
          order={selectedOrderForRewash}
          onSuccess={() => {
            fetchData();
            showToast(`Garansi cuci ulang Nota ${selectedOrderForRewash.invoiceNumber} berhasil diaktifkan!`);
          }}
        />
      )}

      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`fixed bottom-24 md:bottom-6 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold animate-fadeIn transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-950 text-emerald-100 border-emerald-700'
              : 'bg-rose-950 text-rose-100 border-rose-700'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}
    </div>
  );
};
