import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  Play,
  Check,
  AlertTriangle,
  RotateCcw,
  Plus,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { api, laundryCore2Api } from '../../services/api';
import type { LaundryMachine } from '../../types/laundry';
import type {
  LaundryBatchRecord,
  LaundryBatchStage,
  LaundryColorGroup,
  SmartProductionQueueOrder,
} from '../../types/laundry_core2';

interface LaundryBatchBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeOutletId: string;
  preselectedOrderIds?: string[];
  onBatchUpdated?: () => void;
}

export const LaundryBatchBoardModal: React.FC<LaundryBatchBoardModalProps> = ({
  isOpen,
  onClose,
  activeOutletId,
  preselectedOrderIds = [],
  onBatchUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'create'>(
    preselectedOrderIds.length > 0 ? 'create' : 'list'
  );

  // Data State
  const [batches, setBatches] = useState<LaundryBatchRecord[]>([]);
  const [machines, setMachines] = useState<LaundryMachine[]>([]);
  const [availableOrders, setAvailableOrders] = useState<SmartProductionQueueOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Form State
  const [stage, setStage] = useState<LaundryBatchStage>('WASHING');
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [colorGroup, setColorGroup] = useState<LaundryColorGroup>('CAMPUR');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>(preselectedOrderIds);
  const [autoStart, setAutoStart] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (isOpen) {
      if (preselectedOrderIds.length > 0) {
        setSelectedOrderIds(preselectedOrderIds);
        setActiveTab('create');
      }
      loadBatches();
      loadMachines();
      loadAvailableOrders();
    }
  }, [isOpen, activeOutletId, preselectedOrderIds]);

  const loadBatches = async () => {
    try {
      setLoading(true);
      const res = await laundryCore2Api.getBatches({
        outletId: activeOutletId,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
      if (res.status === 'success' && Array.isArray(res.data)) {
        setBatches(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load batches:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMachines = async () => {
    try {
      const res = await api.getLaundryMachines(activeOutletId);
      if (res.status === 'success' && Array.isArray(res.data)) {
        setMachines(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load machines:', err);
    }
  };

  const loadAvailableOrders = async () => {
    try {
      const res = await laundryCore2Api.getProductionQueue({ outletId: activeOutletId });
      if (res.status === 'success' && Array.isArray(res.data)) {
        setAvailableOrders(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load available orders:', err);
    }
  };

  const handleToggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  // Kalkulasi total bobot order terpilih
  const selectedOrdersData = availableOrders.filter((o) => selectedOrderIds.includes(o.id));
  const calculatedWeight =
    Math.round(selectedOrdersData.reduce((sum, o) => sum + (o.totalWeightKg || 0), 0) * 1000) / 1000;

  // Mesin terpilih & kapasitas
  const selectedMachine = machines.find((m) => m.id === selectedMachineId);
  const machineCapacity = selectedMachine?.capacityKg ? Number(selectedMachine.capacityKg) : 0;
  const isOverCapacity = machineCapacity > 0 && calculatedWeight > machineCapacity;

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOrderIds.length === 0) {
      setFeedbackMsg({ type: 'error', text: 'Pilih minimal 1 pesanan untuk dimasukkan ke dalam batch' });
      return;
    }

    try {
      setSubmitting(true);
      setFeedbackMsg(null);

      const res = await laundryCore2Api.createBatch({
        outletId: activeOutletId,
        stage,
        machineId: selectedMachineId || null,
        colorGroup,
        orderIds: selectedOrderIds,
        autoStart,
        notes: notes.trim() || null,
      });

      if (res.status === 'success') {
        setFeedbackMsg({
          type: 'success',
          text: `Batch ${res.data.batchCode} berhasil dibuat!`,
        });
        setSelectedOrderIds([]);
        setNotes('');
        await loadBatches();
        await loadAvailableOrders();
        onBatchUpdated?.();
        setTimeout(() => {
          setActiveTab('list');
          setFeedbackMsg(null);
        }, 1200);
      } else {
        setFeedbackMsg({
          type: 'error',
          text: res.message || 'Gagal membuat batch mesin',
        });
      }
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err?.message || 'Terjadi kesalahan sistem saat membuat batch',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (
    batchId: string,
    status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  ) => {
    try {
      setSubmitting(true);
      const res = await laundryCore2Api.updateBatchStatus(batchId, {
        status,
        notes: status === 'COMPLETED' ? 'Selesai siklus mesin' : undefined,
      });

      if (res.status === 'success') {
        await loadBatches();
        await loadAvailableOrders();
        onBatchUpdated?.();
      } else {
        alert(res.message || 'Gagal memperbarui status batch');
      }
    } catch (err: any) {
      alert(err?.message || 'Terjadi kesalahan saat memperbarui batch');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
      <div className="bg-white w-full sm:max-w-3xl sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-md shadow-blue-900/20 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                Manajemen Batch Mesin Cuci &amp; Dryer
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-1 sm:line-clamp-none">
                Gabung beberapa order kiloan sejenis ke 1 siklus mesin tanpa kehilangan traceability
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-white px-4 sm:px-5 shrink-0 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'list'
                ? 'border-blue-900 text-blue-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>Daftar Batch Mesin ({batches.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`py-3 px-3 sm:px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'create'
                ? 'border-blue-900 text-blue-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Buat Batch Baru {selectedOrderIds.length > 0 && `(${selectedOrderIds.length} Order)`}</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto overscroll-contain flex-1 p-5 space-y-4">
          {feedbackMsg && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                feedbackMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {feedbackMsg.type === 'success' ? (
                <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <span>{feedbackMsg.text}</span>
            </div>
          )}

          {activeTab === 'list' ? (
            <div className="space-y-4">
              {/* Filter Status */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {['ALL', 'IN_PROGRESS', 'OPEN', 'COMPLETED'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      setStatusFilter(st);
                      setTimeout(() => loadBatches(), 50);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      statusFilter === st
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st === 'ALL'
                      ? 'Semua'
                      : st === 'IN_PROGRESS'
                      ? 'Sedang Berjalan'
                      : st === 'OPEN'
                      ? 'Terbuka'
                      : 'Selesai'}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Memuat daftar batch mesin...
                </div>
              ) : batches.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                  <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">Belum Ada Batch Mesin</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Buat batch baru untuk menggabungkan beberapa order cucian sejenis ke satu siklus mesin.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('create')}
                    className="mt-3 px-4 py-2 bg-blue-900 text-white rounded-xl text-xs font-bold hover:bg-blue-800 transition-colors"
                  >
                    + Buat Batch Sekarang
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {batches.map((batch) => {
                    const isRunning = batch.status === 'IN_PROGRESS';
                    const isCompleted = batch.status === 'COMPLETED';

                    return (
                      <div
                        key={batch.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          isRunning
                            ? 'bg-blue-50/40 border-blue-200 shadow-sm'
                            : isCompleted
                            ? 'bg-slate-50 border-slate-200'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono text-xs font-extrabold text-blue-950 bg-blue-100/70 px-2 py-0.5 rounded-md">
                              {batch.batchCode}
                            </span>
                            <span
                              className={`ml-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                batch.stage === 'WASHING'
                                  ? 'bg-sky-100 text-sky-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {batch.stage === 'WASHING' ? 'Cuci (Wash)' : 'Kering (Dry)'}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              batch.status === 'IN_PROGRESS'
                                ? 'bg-blue-600 text-white animate-pulse'
                                : batch.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : batch.status === 'CANCELLED'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {batch.status === 'IN_PROGRESS'
                              ? 'BERJALAN'
                              : batch.status === 'COMPLETED'
                              ? 'SELESAI'
                              : batch.status}
                          </span>
                        </div>

                        {/* Machine & Color group */}
                        <div className="mt-3 text-xs text-slate-700 space-y-1">
                          <p className="flex items-center justify-between">
                            <span className="text-slate-500">Mesin:</span>
                            <span className="font-bold text-slate-900">
                              {batch.machineName || 'Mesin Bebas / Manual'}
                            </span>
                          </p>
                          <p className="flex items-center justify-between">
                            <span className="text-slate-500">Warna / Bahan:</span>
                            <span className="font-semibold text-slate-800">
                              {batch.colorGroup || 'Campur'}
                            </span>
                          </p>
                          <p className="flex items-center justify-between">
                            <span className="text-slate-500">Total Muatan:</span>
                            <span className="font-bold text-blue-950">
                              {Number(batch.totalWeightKg)} kg ({batch.items?.length || 0} nota)
                            </span>
                          </p>
                        </div>

                        {/* Order Items Preview */}
                        <div className="mt-2.5 pt-2 border-t border-slate-100">
                          <p className="text-[11px] font-bold text-slate-500 mb-1">Daftar Nota:</p>
                          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                            {batch.items?.map((item) => (
                              <span
                                key={item.id}
                                className="text-[10px] font-mono font-medium bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-700"
                              >
                                {item.order?.invoiceNumber} ({Number(item.weightKg)}kg)
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-end gap-2">
                          {batch.status === 'OPEN' && (
                            <>
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => handleUpdateStatus(batch.id, 'CANCELLED')}
                                className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              >
                                Batalkan
                              </button>
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => handleUpdateStatus(batch.id, 'IN_PROGRESS')}
                                className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-xs"
                              >
                                <Play className="w-3 h-3" />
                                <span>Mulai Siklus</span>
                              </button>
                            </>
                          )}

                          {batch.status === 'IN_PROGRESS' && (
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => handleUpdateStatus(batch.id, 'COMPLETED')}
                              className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-700/20"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Selesaikan Siklus Mesin</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreateBatch} className="space-y-4">
              {/* Pilihan Tahap */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Tahap Siklus Mesin <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setStage('WASHING')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 min-h-[52px] text-center cursor-pointer ${
                      stage === 'WASHING'
                        ? 'bg-blue-900 text-white border-blue-900 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span className="flex flex-col sm:flex-row items-center sm:gap-1 leading-tight">
                      <span>Mesin Cuci</span>
                      <span
                        className={`text-[10.5px] sm:text-xs font-semibold ${
                          stage === 'WASHING' ? 'text-blue-100' : 'text-slate-500'
                        }`}
                      >
                        (Washing)
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStage('DRYING')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 min-h-[52px] text-center cursor-pointer ${
                      stage === 'DRYING'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <RotateCcw className="w-4 h-4 shrink-0" />
                    <span className="flex flex-col sm:flex-row items-center sm:gap-1 leading-tight">
                      <span>Mesin Pengering</span>
                      <span
                        className={`text-[10.5px] sm:text-xs font-semibold ${
                          stage === 'DRYING' ? 'text-amber-100' : 'text-slate-500'
                        }`}
                      >
                        (Drying)
                      </span>
                    </span>
                  </button>
                </div>
              </div>

              {/* Pilihan Mesin & Kelompok Warna */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Pilih Mesin Laundry
                  </label>
                  <div className="relative">
                    <select
                      value={selectedMachineId}
                      onChange={(e) => setSelectedMachineId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 bg-white"
                    >
                      <option value="">-- Pilih Mesin (Opsional) --</option>
                      {machines
                        .filter((m) =>
                          stage === 'WASHING'
                            ? m.machineType?.toUpperCase().includes('WASH') || m.machineType === 'WASHER'
                            : m.machineType?.toUpperCase().includes('DRY') || m.machineType === 'DRYER'
                        )
                        .map((m) => (
                          <option
                            key={m.id}
                            value={m.id}
                            disabled={m.status === 'MAINTENANCE'}
                          >
                            {m.name} ({m.code}) - Kapasitas: {m.capacityKg ? `${m.capacityKg} kg` : 'N/A'}{' '}
                            {m.status === 'MAINTENANCE' ? '[PERBAIKAN]' : ''}
                          </option>
                        ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Kelompok Warna Pakaian
                  </label>
                  <div className="relative">
                    <select
                      value={colorGroup}
                      onChange={(e) => setColorGroup(e.target.value as LaundryColorGroup)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 bg-white"
                    >
                      <option value="CAMPUR">CAMPUR (Warna Netral / Standar)</option>
                      <option value="PUTIH">PUTIH (Seragam / Pakaian Putih Bersih)</option>
                      <option value="WARNA">WARNA (Warna Terang)</option>
                      <option value="GELAP">GELAP (Hitam, Denim, Navy)</option>
                      <option value="DELICATE">DELICATE (Bahan Halus / Sutra)</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              {/* Indikator Kapasitas Mesin */}
              {selectedMachine && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center justify-between border ${
                    isOverCapacity
                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isOverCapacity && <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
                    <span>
                      Kapasitas Mesin: <strong>{machineCapacity} kg</strong> | Total Berat Terpilih:{' '}
                      <strong className={isOverCapacity ? 'text-amber-800' : 'text-blue-900'}>
                        {calculatedWeight} kg
                      </strong>
                    </span>
                  </div>
                  {isOverCapacity && (
                    <span className="text-[11px] font-extrabold text-amber-800">
                      Muatan Melebihi Rekomendasi
                    </span>
                  )}
                </div>
              )}

              {/* Pemilihan Pesanan Aktif */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 mb-1.5">
                  <label className="text-xs font-bold text-slate-800">
                    Pilih Nota Pesanan ({selectedOrderIds.length} dipilih - {calculatedWeight} kg)
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Hanya pesanan yang sedang aktif di workshop
                  </span>
                </div>

                <div className="border border-slate-200 rounded-2xl max-h-52 overflow-y-auto divide-y divide-slate-100 bg-white">
                  {availableOrders.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Tidak ada pesanan antrean yang tersedia di outlet ini
                    </div>
                  ) : (
                    availableOrders.map((order) => {
                      const isSelected = selectedOrderIds.includes(order.id);
                      return (
                        <label
                          key={order.id}
                          className={`flex items-center justify-between p-3 hover:bg-slate-50 cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/50' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleOrderSelection(order.id)}
                              className="w-4 h-4 rounded text-blue-900 focus:ring-blue-900 border-slate-300"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-slate-900">
                                  {order.invoiceNumber}
                                </span>
                                {order.priorityTier === 'CRITICAL' && (
                                  <span className="text-[10px] font-extrabold px-1.5 py-0.2 bg-rose-100 text-rose-800 rounded">
                                    OVERDUE
                                  </span>
                                )}
                                {order.isExpress && (
                                  <span className="text-[10px] font-extrabold px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded">
                                    EXPRESS
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500">
                                {order.customer?.name || 'Pelanggan'} • Tahap: {order.currentStage}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-bold text-blue-950">
                              {order.totalWeightKg ? `${order.totalWeightKg} kg` : '-'}
                            </span>
                            {order.activeBatch && (
                              <span className="block text-[10px] text-slate-400">
                                Di batch {order.activeBatch.batchCode}
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Opsi Auto Start & Catatan */}
              <div className="space-y-3 pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoStart}
                    onChange={(e) => setAutoStart(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-900 focus:ring-blue-900 border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Mulai Siklus Mesin Sekarang (Langsung berstatus IN_PROGRESS &amp; majukan pesanan)
                  </span>
                </label>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Catatan Batch (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Contoh: Gabung sprei & selimut, deterjen hipoalergenik..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 resize-none"
                  />
                </div>
              </div>

              {/* Submit Action */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting || selectedOrderIds.length === 0}
                  className="px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-900/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Layers className="w-4 h-4" />
                  <span>Buat &amp; Jalankan Batch</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between text-xs text-slate-500 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <span>Workshop Machine Batch Engine</span>
          <button
            type="button"
            onClick={onClose}
            className="font-bold text-slate-700 hover:text-slate-900 underline"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
