import React, { useState } from 'react';
import { RotateCcw, X, AlertTriangle, ChevronDown, Check } from 'lucide-react';
import type { LaundryQueueOrder } from '../../types/laundry';
import { api } from '../../services/api';

interface LaundryRewashModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: LaundryQueueOrder | null;
  onSuccess: () => void;
}

const REWASH_REASONS = [
  'Noda Belum Hilang',
  'Bau Kurang Wangi',
  'Kurang Rapi / Kusut',
  'Lainnya',
];

export const LaundryRewashModal: React.FC<LaundryRewashModalProps> = ({
  isOpen,
  onClose,
  order,
  onSuccess,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('Noda Belum Hilang');
  const [customReason, setCustomReason] = useState<string>('');
  const [targetStage, setTargetStage] = useState<string>('SPOTTING');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = selectedReason === 'Lainnya' ? customReason.trim() : selectedReason;
    if (!finalReason) {
      setErrorMsg('Harap tentukan alasan klaim garansi cuci ulang');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);
      const res = await api.rewashLaundryOrder(order.id, {
        reason: finalReason,
        notes: notes.trim() || undefined,
        targetStage,
      });

      if (res.status === 'success') {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.message || 'Gagal memproses klaim cuci ulang');
      }
    } catch {
      setErrorMsg('Terjadi kesalahan sambungan saat memproses klaim');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn">
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Klaim Garansi Cuci Ulang (Rewash)</h3>
              <p className="text-xs text-slate-500">
                Nota {order.invoiceNumber} — {order.customerName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1 text-xs">
            {/* Alert Banner Rp 0 */}
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold">Garansi Pelanggan Rp 0 (Bebas Biaya)</p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Cucian akan dikembalikan langsung ke antrean produksi workshop dan slot rak akan dikosongkan. Omset dan status pembayaran transaksi tetap utuh.
                </p>
              </div>
            </div>

            {/* Pilihan Alasan Komplain */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-2">
                Alasan Garansi / Komplain Pelanggan <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {REWASH_REASONS.map((reason) => {
                  const isSelected = selectedReason === reason;
                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setSelectedReason(reason)}
                      className={`p-2.5 rounded-xl border text-left font-bold transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'border-blue-900 bg-blue-50/70 text-blue-900 ring-1 ring-blue-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-xs">{reason}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-900 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedReason === 'Lainnya' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Keterangan Alasan Lain <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Warna pudar, wangi tidak sesuai pilihan, dll"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>
            )}

            {/* Target Stasiun Kerja Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Kembalikan ke Stasiun Kerja (Tahapan)
              </label>
              <div className="relative">
                <select
                  value={targetStage}
                  onChange={(e) => setTargetStage(e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900 appearance-none font-semibold text-slate-800"
                >
                  <option value="SPOTTING">Stasiun 4: Treatment Noda Khusus (Spotting)</option>
                  <option value="WASHING">Stasiun 5: Pencucian Ulang (Washing)</option>
                  <option value="DRYING">Stasiun 6: Pengeringan (Drying)</option>
                  <option value="IRONING">Stasiun 7: Penyetrikaan Ulang (Ironing)</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Pilih stasiun kerja awal penanganan ulang di workshop.
              </p>
            </div>

            {/* Catatan Tambahan Operator */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Catatan Petunjuk untuk Operator Workshop
              </label>
              <textarea
                rows={3}
                placeholder="Contoh: Fokus bersihkan noda kecap di kerah kemeja putih, jangan gunakan pemutih keras..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-900"
              />
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-bold text-xs">
                {errorMsg}
              </div>
            )}
          </div>

          {/* Sticky Action Footer */}
          <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold bg-blue-900 hover:bg-blue-800 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{submitting ? 'Memproses...' : 'Proses Cuci Ulang'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
