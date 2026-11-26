import React, { useState, useEffect } from 'react';
import {
  Clock,
  AlertTriangle,
  Zap,
  Layers,
  Scale,
  Tag,
  CheckCircle2,
  Search,
} from 'lucide-react';
import { laundryCore2Api } from '../../services/api';
import type {
  SmartProductionQueueOrder,
  SmartProductionQueueSummary,
} from '../../types/laundry_core2';

interface SmartProductionQueuePanelProps {
  activeOutletId: string;
  onOpenBatchWithOrders?: (orderIds: string[]) => void;
  onOpenItemTracking?: (order: {
    id: string;
    invoiceNumber: string;
    customerName?: string;
  }) => void;
}

export const SmartProductionQueuePanel: React.FC<SmartProductionQueuePanelProps> = ({
  activeOutletId,
  onOpenBatchWithOrders,
  onOpenItemTracking,
}) => {
  const [queue, setQueue] = useState<SmartProductionQueueOrder[]>([]);
  const [summary, setSummary] = useState<SmartProductionQueueSummary>({
    totalActiveOrders: 0,
    overdueCount: 0,
    urgentCount: 0,
    totalPendingWeightKg: 0,
    activeBatchesCount: 0,
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [tierFilter, setTierFilter] = useState<string>('ALL');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  useEffect(() => {
    if (activeOutletId) {
      loadQueue();
      setSelectedOrderIds([]);
    }
  }, [activeOutletId]);

  const loadQueue = async () => {
    try {
      setLoading(true);
      const res = await laundryCore2Api.getProductionQueue({ outletId: activeOutletId });
      if (res.status === 'success' && res.data) {
        setQueue(res.data);
        if (res.summary) {
          setSummary(res.summary);
        }
      }
    } catch (err: any) {
      console.error('Failed to load production queue:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const handleSelectAllFiltered = (filteredOrders: SmartProductionQueueOrder[]) => {
    if (selectedOrderIds.length === filteredOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrders.map((o) => o.id));
    }
  };

  // Filter
  const filteredQueue = queue.filter((order) => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      order.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.customer?.name &&
        order.customer.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTier = tierFilter === 'ALL' || order.priorityTier === tierFilter;

    return matchesSearch && matchesTier;
  });

  return (
    <div className="space-y-4">
      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">TOTAL ANTREAN</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-extrabold text-slate-900">{summary.totalActiveOrders}</div>
          <span className="text-[10px] text-slate-400">Order belum selesai</span>
        </div>

        <div className="bg-rose-50/60 p-3.5 rounded-2xl border border-rose-200 shadow-xs">
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-[11px] font-bold">OVERDUE (KRITIS)</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-xl font-extrabold text-rose-800">{summary.overdueCount}</div>
          <span className="text-[10px] text-rose-600 font-semibold">SLA Terlewat</span>
        </div>

        <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-[11px] font-bold">URGENT / EXPRESS</span>
            <Zap className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-extrabold text-amber-800">{summary.urgentCount}</div>
          <span className="text-[10px] text-amber-600 font-semibold">SLA &le; 4 Jam / Kilat</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">TOTAL BOBOT</span>
            <Scale className="w-4 h-4 text-blue-900" />
          </div>
          <div className="text-xl font-extrabold text-blue-950">
            {summary.totalPendingWeightKg} kg
          </div>
          <span className="text-[10px] text-slate-400">Muatan cucian pending</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">BATCH MESIN</span>
            <Layers className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-xl font-extrabold text-sky-900">{summary.activeBatchesCount}</div>
          <span className="text-[10px] text-slate-400">Siklus berjalan/buka</span>
        </div>
      </div>

      {/* Toolbar Search & Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nota atau nama pelanggan..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 bg-slate-50 focus:bg-white transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          <div className="flex items-center gap-1">
            {['ALL', 'CRITICAL', 'URGENT', 'HIGH', 'NORMAL'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTierFilter(t)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  tierFilter === t
                    ? t === 'CRITICAL'
                      ? 'bg-rose-700 text-white shadow-xs'
                      : t === 'URGENT'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-blue-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t === 'ALL'
                  ? 'Semua'
                  : t === 'CRITICAL'
                  ? 'Kritis'
                  : t === 'URGENT'
                  ? 'Mendesak'
                  : t === 'HIGH'
                  ? 'Tinggi'
                  : 'Reguler'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Daftar Order Prioritas Cerdas */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={
                filteredQueue.length > 0 && selectedOrderIds.length === filteredQueue.length
              }
              onChange={() => handleSelectAllFiltered(filteredQueue)}
              className="w-4 h-4 rounded text-blue-900 focus:ring-blue-900 border-slate-300"
            />
            <span className="text-xs font-bold text-slate-800">
              Antrean Berdasarkan Prioritas SLA (Express &amp; Tenggat Terdekat)
            </span>
          </div>
          <span className="text-xs text-slate-500">
            Menampilkan <strong>{filteredQueue.length}</strong> pesanan
          </span>
        </div>

        {loading ? (
          <div className="py-14 text-center text-xs text-slate-400">
            Memuat antrean prioritas cerdas...
          </div>
        ) : filteredQueue.length === 0 ? (
          <div className="py-14 text-center text-slate-400">
            <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-600">Tidak Ada Antrean Tertunda</p>
            <p className="text-xs text-slate-400 mt-1">Semua pesanan di workshop telah tuntas diproses.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredQueue.map((order, idx) => {
              const isSelected = selectedOrderIds.includes(order.id);
              const isCritical = order.priorityTier === 'CRITICAL';
              const isUrgent = order.priorityTier === 'URGENT';
              const isHigh = order.priorityTier === 'HIGH';

              return (
                <div
                  key={order.id}
                  className={`p-4 transition-all flex items-start sm:items-center justify-between gap-3 flex-wrap sm:flex-nowrap ${
                    isSelected
                      ? 'bg-blue-50/40'
                      : isCritical
                      ? 'bg-rose-50/20 hover:bg-rose-50/30'
                      : 'hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelectOrder(order.id)}
                      className="w-4 h-4 rounded text-blue-900 focus:ring-blue-900 border-slate-300 mt-1"
                    />

                    <div>
                      {/* Urutan & Badge Prioritas */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-xs font-extrabold text-slate-400">
                          #{idx + 1}
                        </span>

                        <span className="font-mono text-xs font-extrabold text-blue-950 bg-blue-100/70 px-2 py-0.5 rounded">
                          {order.invoiceNumber}
                        </span>

                        {isCritical && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
                            TERLAMBAT {Math.abs(order.minutesLeft)}m (CRITICAL)
                          </span>
                        )}

                        {isUrgent && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500 text-white">
                            {order.isExpress ? 'EXPRESS KILAT' : `SISA ${order.minutesLeft}m`}
                          </span>
                        )}

                        {isHigh && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                            PRIORITAS TINGGI
                          </span>
                        )}

                        {order.priorityTier === 'NORMAL' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            REGULER
                          </span>
                        )}

                        {order.activeBatch && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-900 text-white">
                            Batch {order.activeBatch.batchCode} ({order.activeBatch.status})
                          </span>
                        )}
                      </div>

                      {/* Detail Pelanggan & Berat */}
                      <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                        <span className="font-bold text-slate-900">
                          {order.customer?.name || 'Pelanggan Walk-in'}
                        </span>
                        <span>•</span>
                        <span>
                          Muatan: <strong>{order.totalWeightKg ? `${order.totalWeightKg} kg` : '-'}</strong> (
                          {order.totalPieces || 0} potong)
                        </span>
                        <span>•</span>
                        <span>
                          Tahap: <strong className="text-blue-900">{order.currentStage}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Kanan: Tracking Item & Tombol Aksi */}
                  <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                    {/* Ringkasan Item Diserahkan */}
                    {order.trackedItemsSummary.total > 0 && (
                      <span className="text-[11px] font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-700">
                        {order.trackedItemsSummary.handedOver}/{order.trackedItemsSummary.total} Item Diserahkan
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        onOpenItemTracking?.({
                          id: order.id,
                          invoiceNumber: order.invoiceNumber,
                          customerName: order.customer?.name,
                        })
                      }
                      className="px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100 text-blue-900 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>Item &amp; Tag</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Bar jika ada order dipilih */}
      {selectedOrderIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-blue-950 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-extrabold flex items-center justify-center">
              {selectedOrderIds.length}
            </span>
            <span className="text-xs font-bold">Pesanan Terpilih</span>
          </div>

          <div className="h-4 w-px bg-blue-800" />

          <button
            type="button"
            onClick={() => onOpenBatchWithOrders?.(selectedOrderIds)}
            className="px-4 py-1.5 bg-white text-blue-950 hover:bg-blue-50 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md"
          >
            <Layers className="w-4 h-4 text-blue-900" />
            <span>Gabung ke Batch Mesin</span>
          </button>
        </div>
      )}
    </div>
  );
};
