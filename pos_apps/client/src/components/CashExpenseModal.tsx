import React, { useState, useEffect } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  X,
  AlertCircle,
  CheckCircle2,
  Clock,
  Tag,
  FileText,
  Wallet,
  Receipt,
} from 'lucide-react';
import { api } from '../services/api';
import type { Shift } from '../types/shift';
import { CurrencyInput } from './ui/CurrencyInput';

interface CashExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExpenseRecorded: () => void;
  currentShift: Shift | null;
}

const PRESET_CATEGORIES = [
  'Iuran Lingkungan & Sampah',
  'Belanja Toko Mendesak',
  'Operasional (Listrik/Air/Gas)',
  'Konsumsi Karyawan',
  'Ongkos Kurir & Ekspedisi',
  'Lain-lain',
];

export const CashExpenseModal: React.FC<CashExpenseModalProps> = ({
  isOpen,
  onClose,
  onExpenseRecorded,
  currentShift,
}) => {
  const [movementType, setMovementType] = useState<'CASH_OUT' | 'CASH_IN'>('CASH_OUT');
  const [category, setCategory] = useState<string>(PRESET_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Riwayat mutasi kas shift aktif
  const [movements, setMovements] = useState<any[]>([]);
  const [totalCashOut, setTotalCashOut] = useState<number>(0);
  const [totalCashIn, setTotalCashIn] = useState<number>(0);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  const fetchMovements = async () => {
    if (!currentShift?.id) return;
    setLoadingHistory(true);
    try {
      const res = await api.getCashMovements(currentShift.id);
      if (res.status === 'success') {
        setMovements(res.data?.movements || []);
        setTotalCashOut(res.data?.totalCashOut || 0);
        setTotalCashIn(res.data?.totalCashIn || 0);
      }
    } catch (err: any) {
      console.error('Gagal mengambil riwayat mutasi kas:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setAmount(0);
      setNotes('');
      setErrorMsg(null);
      setSuccessMsg(null);
      setMovementType('CASH_OUT');
      setCategory(PRESET_CATEGORIES[0]);
      setCustomCategory('');
      fetchMovements();
    }
  }, [isOpen, currentShift?.id]);

  if (!isOpen) return null;

  const effectiveCategory = category === 'Lain-lain' && customCategory.trim() ? customCategory.trim() : category;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (amount <= 0) {
      setErrorMsg('Nominal mutasi kas harus lebih besar dari 0');
      return;
    }

    if (!notes.trim() || notes.trim().length < 3) {
      setErrorMsg('Keterangan pengeluaran minimal 3 karakter (wajib diisi agar ada bukti audit)');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.recordCashMovement({
        type: movementType,
        category: effectiveCategory,
        amount,
        notes: notes.trim(),
      });

      if (res.status === 'success') {
        setSuccessMsg(res.message || 'Mutasi kas berhasil disimpan');
        setAmount(0);
        setNotes('');
        await fetchMovements();
        onExpenseRecorded();
      } else {
        setErrorMsg(res.message || 'Gagal menyimpan mutasi kas');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem saat menghubungi server');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-blue-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-800/80 border border-blue-700/60 flex items-center justify-center text-blue-200 shadow-xs">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                <span>Pengeluaran Kasir (Kas Keluar)</span>
                <span className="px-2.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30 rounded-full">
                  Petty Cash
                </span>
              </h2>
              <p className="text-xs text-blue-200/80 mt-0.5">
                Catat pengeluaran tunai dari laci kasir untuk iuran, belanja darurat, atau operasional toko.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Scrollable */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Status Message Alerts */}
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Gagal Mencatat Mutasi</div>
                <div>{errorMsg}</div>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-800 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <div>
                <div className="font-bold">Berhasil</div>
                <div>{successMsg}</div>
              </div>
            </div>
          )}

          {/* Form Input Mutasi */}
          <form onSubmit={handleSubmit} className="space-y-5 bg-slate-50/80 p-5 rounded-3xl border border-slate-200">
            {/* Tab Tipe Mutasi: CASH_OUT vs CASH_IN */}
            <div className="flex p-1 bg-slate-200/70 rounded-2xl">
              <button
                type="button"
                onClick={() => setMovementType('CASH_OUT')}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  movementType === 'CASH_OUT'
                    ? 'bg-white text-rose-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowDownCircle className="w-4 h-4 text-rose-600" />
                <span>Kas Keluar (Pengeluaran Kasir)</span>
              </button>
              <button
                type="button"
                onClick={() => setMovementType('CASH_IN')}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                  movementType === 'CASH_IN'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowUpCircle className="w-4 h-4 text-emerald-600" />
                <span>Kas Masuk (Tambah Modal Kasir)</span>
              </button>
            </div>

            {/* Nominal Pengeluaran */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nominal {movementType === 'CASH_OUT' ? 'Pengeluaran Uang' : 'Kas Masuk'} <span className="text-rose-500">*</span>
              </label>
              <CurrencyInput
                value={amount}
                onChange={setAmount}
                placeholder="Rp 0"
                className="w-full text-base sm:text-lg font-black text-slate-900 bg-white border border-slate-200 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                {movementType === 'CASH_OUT'
                  ? 'Nominal ini otomatis memotong perhitungan uang fisik di laci saat Tutup Shift (Z-Report).'
                  : 'Nominal ini otomatis menambah perhitungan uang fisik di laci saat Tutup Shift (Z-Report).'}
              </p>
            </div>

            {/* Pilihan Kategori */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-500" />
                <span>Kategori Keperluan</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PRESET_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-2 text-xs font-bold rounded-xl border text-left transition-all ${
                      category === cat
                        ? 'bg-blue-950 text-white border-blue-950 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {category === 'Lain-lain' && (
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Ketik kategori pengeluaran kustom..."
                  className="w-full mt-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                />
              )}
            </div>

            {/* Keterangan / Alasan Wajib */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>Keterangan / Catatan Bukti <span className="text-rose-500">*</span></span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Iuran sampah RT bulan September, beli es batu kristal 2 pack, dll."
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                required
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={submitting || amount <= 0}
                className="w-full sm:w-auto px-6 py-3 bg-blue-950 hover:bg-blue-900 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menyimpan Pengeluaran...</span>
                  </>
                ) : (
                  <>
                    <Receipt className="w-4 h-4 text-blue-200" />
                    <span>{movementType === 'CASH_OUT' ? 'Simpan Pengeluaran Kas' : 'Simpan Kas Masuk'}</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Riwayat Mutasi Kas Pada Shift Ini */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Riwayat Pengeluaran Shift Ini
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-500">
                  Total Keluar:{' '}
                  <strong className="text-rose-600 font-extrabold font-mono">
                    Rp {totalCashOut.toLocaleString('id-ID')}
                  </strong>
                </span>
                {totalCashIn > 0 && (
                  <span className="text-slate-500">
                    Total Masuk:{' '}
                    <strong className="text-emerald-600 font-extrabold font-mono">
                      Rp {totalCashIn.toLocaleString('id-ID')}
                    </strong>
                  </span>
                )}
              </div>
            </div>

            {loadingHistory ? (
              <div className="py-8 text-center text-slate-400 text-xs font-medium">
                Memuat riwayat pengeluaran shift...
              </div>
            ) : movements.length === 0 ? (
              <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs">
                Belum ada pengeluaran uang kas yang dicatat pada sesi shift ini.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
                {movements.map((m) => (
                  <div key={m.id} className="p-3.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/80 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        m.type === 'CASH_OUT' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      }`}>
                        {m.type === 'CASH_OUT' ? (
                          <ArrowDownCircle className="w-4 h-4" />
                        ) : (
                          <ArrowUpCircle className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>{m.category}</span>
                          <span className="text-[10px] font-normal text-slate-400">
                            {new Date(m.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {m.notes}
                        </div>
                        {m.user && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Oleh: {m.user.name} ({m.user.userCode || 'Staf'})
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-mono font-extrabold text-xs sm:text-sm ${
                        m.type === 'CASH_OUT' ? 'text-rose-600' : 'text-emerald-600'
                      }`}>
                        {m.type === 'CASH_OUT' ? '-' : '+'} Rp {Number(m.amount).toLocaleString('id-ID')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            Sesi shift: <strong className="font-mono text-slate-800">#{currentShift?.id?.slice(0, 8)}</strong>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl transition-colors shadow-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
