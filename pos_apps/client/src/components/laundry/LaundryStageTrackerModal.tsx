import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  User,
  Archive,
  Coins,
  Send,
  Sparkles,
  FileText,
  AlertCircle,
  Tag,
  Filter,
  Flame,
  Waves,
  Wind,
  Layers,
  Package,
  Scale,
} from 'lucide-react';
import type { LaundryQueueOrder, LaundryStageLog, LaundryProductionStageKey } from '../../types/laundry';
import { LAUNDRY_11_STAGES } from '../../types/laundry';
import { api } from '../../services/api';

interface LaundryStageTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: LaundryQueueOrder | null;
  onStageUpdated: () => void;
}

export const LaundryStageTrackerModal: React.FC<LaundryStageTrackerModalProps> = ({
  isOpen,
  onClose,
  order,
  onStageUpdated,
}) => {
  const [logs, setLogs] = useState<LaundryStageLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [operatorName, setOperatorName] = useState('');
  const [stageNotes, setStageNotes] = useState('');
  const [targetRackCode, setTargetRackCode] = useState('RAK-A1');
  const [pickedUpByName, setPickedUpByName] = useState('');
  const [advancing, setAdvancing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchStageLogs = async () => {
    if (!order) return;
    try {
      setLoadingLogs(true);
      setErrorMsg(null);
      const res = await api.getLaundryStageLogs(order.orderId);
      if (res.status === 'success' && res.data?.logs) {
        setLogs(res.data.logs);
      }
    } catch {
      setErrorMsg('Gagal memuat riwayat log tahapan');
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (isOpen && order) {
      setTargetRackCode(order.rackCode || 'RAK-A1');
      setPickedUpByName(order.customerName || '');
      fetchStageLogs();
    }
  }, [isOpen, order?.orderId]);

  if (!isOpen || !order) return null;

  // Tentukan tahapan aktif saat ini
  const currentStageKey = (order.currentStage || 'DROP_OFF') as LaundryProductionStageKey;
  const currentStageIndex = LAUNDRY_11_STAGES.findIndex((s) => s.key === currentStageKey);
  const nextStage =
    currentStageIndex >= 0 && currentStageIndex < LAUNDRY_11_STAGES.length - 1
      ? LAUNDRY_11_STAGES[currentStageIndex + 1]
      : null;

  const isCompleted = currentStageKey === 'HANDOVER';
  const remainingAmount = Math.max(0, order.grandTotal - (order.paidAmount || 0));
  const needPayment = remainingAmount > 0;

  const handleAdvanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nextStage) return;

    try {
      setAdvancing(true);
      setErrorMsg(null);

      const payload: any = {
        nextStage: nextStage.key,
        operatorName: operatorName.trim() || undefined,
        notes: stageNotes.trim() || undefined,
      };

      if (nextStage.key === 'RACK_STORAGE') {
        payload.rackCode = targetRackCode.trim() || 'RAK-A1';
      }

      if (nextStage.key === 'HANDOVER') {
        payload.pickedUpBy = pickedUpByName.trim() || order.customerName;
      }

      const res = await api.advanceLaundryStage(order.orderId, payload);
      if (res.status === 'success') {
        setOperatorName('');
        setStageNotes('');
        onStageUpdated();
        fetchStageLogs();
        if (nextStage.key === 'HANDOVER') {
          onClose();
        }
      } else {
        setErrorMsg(res.message || 'Gagal memajukan tahapan produksi');
      }
    } catch {
      setErrorMsg('Terjadi gangguan jaringan saat memproses tahapan');
    } finally {
      setAdvancing(false);
    }
  };

  const getStageIcon = (key: LaundryProductionStageKey) => {
    switch (key) {
      case 'DROP_OFF':
        return <Scale className="w-3.5 h-3.5" />;
      case 'TAGGING':
        return <Tag className="w-3.5 h-3.5" />;
      case 'SORTING':
        return <Filter className="w-3.5 h-3.5" />;
      case 'SPOTTING':
        return <Sparkles className="w-3.5 h-3.5" />;
      case 'WASHING':
        return <Waves className="w-3.5 h-3.5" />;
      case 'DRYING':
        return <Wind className="w-3.5 h-3.5" />;
      case 'IRONING':
        return <Flame className="w-3.5 h-3.5" />;
      case 'FOLDING':
        return <Layers className="w-3.5 h-3.5" />;
      case 'PACKING':
        return <Package className="w-3.5 h-3.5" />;
      case 'RACK_STORAGE':
        return <Archive className="w-3.5 h-3.5" />;
      case 'HANDOVER':
        return <CheckCircle2 className="w-3.5 h-3.5" />;
      default:
        return <CheckCircle2 className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn">
      <div className="w-full sm:max-w-3xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[94dvh] sm:max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm">Alur 11 Tahapan Produksi &amp; Quality Control</h3>
                <span className="font-mono text-xs font-bold text-blue-900 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200">
                  #{order.invoiceNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {order.customerName} • {order.serviceName} ({order.totalWeightKg ? `${order.totalWeightKg} Kg` : `${order.totalPieces} Pcs`}) • Aroma: {order.perfumeVariant}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Konten Scrollable */}
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-6">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Stepper Visual 11 Tahapan Produksi */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase tracking-wider text-slate-600">
                Tracking 11 Tahapan Produksi (Baku &amp; Terkunci)
              </span>
              <span className="text-[11px] font-bold text-blue-900">
                Tahap {currentStageIndex + 1} dari 11
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {LAUNDRY_11_STAGES.map((stg, idx) => {
                const logForStage = logs.find((l) => l.stage === stg.key);
                const isPassed = idx < currentStageIndex || (idx === currentStageIndex && isCompleted);
                const isCurrent = idx === currentStageIndex && !isCompleted;

                return (
                  <div
                    key={stg.key}
                    className={`p-2.5 rounded-xl border transition-all text-xs flex flex-col justify-between ${
                      isCurrent
                        ? 'border-blue-900 bg-blue-900 text-white shadow-xs'
                        : isPassed
                        ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
                        : 'border-slate-200 bg-white text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <span className={isCurrent ? 'text-white' : isPassed ? 'text-emerald-700' : 'text-slate-400'}>
                          {getStageIcon(stg.key)}
                        </span>
                        <span className="truncate">{stg.shortLabel}</span>
                      </div>
                      {isPassed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      {isCurrent && <Clock className="w-3.5 h-3.5 text-sky-300 animate-spin shrink-0" />}
                    </div>

                    <div className="text-[10px] leading-tight">
                      {logForStage ? (
                        <div className={isCurrent ? 'text-blue-100' : 'text-slate-500'}>
                          <div className="font-semibold truncate">{logForStage.operatorName || 'Staf'}</div>
                          {logForStage.durationMinutes !== null && logForStage.durationMinutes !== undefined && logForStage.durationMinutes > 0 && (
                            <div className="text-[9px] opacity-80">{logForStage.durationMinutes} menit</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] opacity-60">Menunggu</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form Check-in Tahap Berikutnya untuk Operator */}
          {!isCompleted && nextStage && (
            <form onSubmit={handleAdvanceSubmit} className="bg-blue-50/60 p-4 sm:p-5 rounded-2xl border border-blue-200/80 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-900 text-white flex items-center justify-center font-bold text-xs">
                    {nextStage.sequence}
                  </div>
                  <div>
                    <h4 className="font-black text-blue-950 text-xs">
                      Check-in Selesai: {nextStage.label}
                    </h4>
                    <p className="text-[11px] text-blue-900/80">{nextStage.description}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Input Nama Operator / Staf yang Mengerjakan */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Operator Staf (KPI &amp; Borongan) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Pak Joko (Setrika)"
                      value={operatorName}
                      onChange={(e) => setOperatorName(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900 font-medium"
                    />
                  </div>
                </div>

                {/* Khusus Tahap Masuk Rak (Stage 10): Alokasi Nomor Rak */}
                {nextStage.key === 'RACK_STORAGE' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nomor Slot Rak Penyimpanan <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Archive className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        placeholder="Contoh: RAK-A1 atau HGR-02"
                        value={targetRackCode}
                        onChange={(e) => setTargetRackCode(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900 font-mono font-bold uppercase"
                      />
                    </div>
                  </div>
                )}

                {/* Khusus Tahap Penyerahan (Stage 11): Nama Pengambil */}
                {nextStage.key === 'HANDOVER' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Orang yang Mengambil Pakaian <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={pickedUpByName}
                      onChange={(e) => setPickedUpByName(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900 font-medium"
                    />
                  </div>
                )}

                {/* Catatan Operator */}
                <div className={nextStage.key === 'RACK_STORAGE' || nextStage.key === 'HANDOVER' ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Catatan QC / Kendala Tahapan (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Pakaian kancing lepas dari awal / noda kerah bersih sempurna"
                    value={stageNotes}
                    onChange={(e) => setStageNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900 font-medium"
                  />
                </div>
              </div>

              {/* Notifikasi Khusus Handover: Sisa Tagihan Kasir */}
              {nextStage.key === 'HANDOVER' && needPayment && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-700" />
                    <span className="font-bold text-amber-950">
                      Sisa Tagihan yang Wajib Dilunasi: Rp {remainingAmount.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-amber-800">
                    Otomatis lunas &amp; tercatat di kas saat diserahkan
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end pt-2">
                <button
                  type="submit"
                  disabled={advancing}
                  className="px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {advancing
                      ? 'Menyimpan Log...'
                      : `Selesaikan ${nextStage.label}`}
                  </span>
                </button>
              </div>
            </form>
          )}

          {/* Tabel Log Audit Trail Riil 11 Tahapan */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-900" />
                <span>Audit Trail Riwayat Pengerjaan Operator</span>
              </span>
              <span className="text-[10px] text-slate-400">{logs.length} Log Tercatat</span>
            </div>

            {loadingLogs ? (
              <div className="p-6 text-center text-xs text-slate-400">Memuat log pengerjaan...</div>
            ) : logs.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                Belum ada log pengerjaan yang tercatat.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-[10.5px] font-bold text-slate-600 border-b border-slate-100">
                    <tr>
                      <th className="py-2.5 px-3">Tahapan</th>
                      <th className="py-2.5 px-3">Operator Staf</th>
                      <th className="py-2.5 px-3">Waktu Selesai</th>
                      <th className="py-2.5 px-3">Durasi</th>
                      <th className="py-2.5 px-3">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px] text-slate-700">
                    {logs.map((lg) => {
                      const stg = LAUNDRY_11_STAGES.find((s) => s.key === lg.stage);
                      return (
                        <tr key={lg.id} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-bold text-slate-900">
                            {stg ? stg.label : lg.stage}
                          </td>
                          <td className="py-2 px-3 font-semibold text-blue-950">
                            {lg.operatorName || 'Staf Kasir'}
                          </td>
                          <td className="py-2 px-3 text-slate-500">
                            {lg.completedAt ? new Date(lg.completedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-600">
                            {lg.durationMinutes ? `${lg.durationMinutes} menit` : '-'}
                          </td>
                          <td className="py-2 px-3 text-slate-500 italic">
                            {lg.notes || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer Modal */}
        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
