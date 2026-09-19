import React, { useState } from 'react';
import { Clock, AlertCircle, X, Check, Store } from 'lucide-react';
import { api } from '../services/api';
import type { Shift } from '../types/shift';

interface StartShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShiftStarted: (shift: Shift) => void;
  outletName?: string;
}

export const StartShiftModal: React.FC<StartShiftModalProps> = ({
  isOpen,
  onClose,
  onShiftStarted,
  outletName,
}) => {
  const [startingCash, setStartingCash] = useState<number>(200000);
  const [notes, setNotes] = useState<string>('Modal awal kasir');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const quickAmounts = [100000, 200000, 300000, 500000, 1000000];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (startingCash < 0) {
      setErrorMsg('Modal awal tidak boleh kurang dari 0');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await api.startShift({ startingCash, notes });
      if (res.status === 'success') {
        onShiftStarted(res.data);
        onClose();
      } else {
        setErrorMsg(res.message || 'Gagal membuka shift kasir');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-950 to-blue-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-800 flex items-center justify-center text-blue-200">
              <Clock className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight text-white">Buka Shift Kasir Baru</h3>
              <p className="text-xs text-blue-200 flex items-center gap-1">
                <Store className="w-3.5 h-3.5" />
                {outletName || 'Cabang Utama'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-blue-200 hover:text-white hover:bg-blue-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Modal Awal di Laci Kasir (Cash Float)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-extrabold text-slate-400">
                Rp
              </span>
              <input
                type="number"
                min="0"
                step="1000"
                value={startingCash || ''}
                onChange={(e) => setStartingCash(Number(e.target.value))}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-slate-200 focus:border-blue-900 focus:bg-white rounded-2xl text-lg font-black text-slate-900 outline-none transition-all text-right tracking-tight"
                placeholder="0"
                autoFocus
                required
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Uang tunai fisik pecahan kecil untuk uang kembalian pembeli.
            </p>
          </div>

          {/* Tombol Pecahan Cepat */}
          <div>
            <span className="text-[11px] font-bold text-slate-500 block mb-2">Pilihan Cepat:</span>
            <div className="grid grid-cols-3 gap-2">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setStartingCash(amt)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    startingCash === amt
                      ? 'bg-blue-900 text-white border-blue-900 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  Rp {(amt / 1000).toLocaleString('id-ID')}k
                </button>
              ))}
            </div>
          </div>

          {/* Catatan / Keterangan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Catatan Pembukaan Shift (Opsional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Buka shift pagi, uang laci pas"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-900 focus:bg-white rounded-xl text-xs text-slate-800 outline-none transition-all"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-black shadow-md shadow-blue-900/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{loading ? 'Membuka...' : 'Mulai Sesi Shift'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
