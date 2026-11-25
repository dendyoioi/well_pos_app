import React, { useState, useEffect } from 'react';
import { X, Scale, ShieldCheck, AlertTriangle, Check, RefreshCw, Camera } from 'lucide-react';
import type { QcChecklistData } from '../../types/laundry_core';
import { laundryCoreApi } from '../../services/api';

interface LaundryQcAndWeightModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  invoiceNumber: string;
  customerName?: string;
  initialWeightKg?: number | null;
  finalWeightKg?: number | null;
  weightDiffReason?: string | null;
  totalWeightKg?: number | null;
  currentQcStatus?: string | null;
  currentQcChecklist?: QcChecklistData | null;
  onSaved?: () => void;
}

export const LaundryQcAndWeightModal: React.FC<LaundryQcAndWeightModalProps> = ({
  isOpen,
  onClose,
  orderId,
  invoiceNumber,
  customerName,
  initialWeightKg,
  finalWeightKg,
  weightDiffReason,
  totalWeightKg,
  currentQcStatus,
  currentQcChecklist,
  onSaved,
}) => {
  const [activeTab, setActiveTab] = useState<'weight' | 'qc'>('weight');

  // State Berat
  const baseInitial = Number(initialWeightKg ?? totalWeightKg ?? 0);
  const [finalWeight, setFinalWeight] = useState<string>(
    finalWeightKg != null ? String(finalWeightKg) : totalWeightKg != null ? String(totalWeightKg) : ''
  );
  const [reason, setReason] = useState<string>(weightDiffReason || '');
  const [savingWeight, setSavingWeight] = useState<boolean>(false);
  const [weightSuccessMsg, setWeightSuccessMsg] = useState<string | null>(null);

  // State QC
  const [stainFree, setStainFree] = useState<boolean>(true);
  const [odorFresh, setOdorFresh] = useState<boolean>(true);
  const [ironedNeat, setIronedNeat] = useState<boolean>(true);
  const [pieceCountVerified, setPieceCountVerified] = useState<boolean>(true);
  const [verifiedPieces, setVerifiedPieces] = useState<string>('');
  const [qcNotes, setQcNotes] = useState<string>('');
  const [qcPhotoUrl, setQcPhotoUrl] = useState<string>('');
  const [savingQc, setSavingQc] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFinalWeight(
        finalWeightKg != null ? String(finalWeightKg) : totalWeightKg != null ? String(totalWeightKg) : ''
      );
      setReason(weightDiffReason || '');
      setWeightSuccessMsg(null);
      setErrorMsg(null);

      if (currentQcChecklist) {
        setStainFree(Boolean(currentQcChecklist.stainFree));
        setOdorFresh(Boolean(currentQcChecklist.odorFresh));
        setIronedNeat(Boolean(currentQcChecklist.ironedNeat));
        setPieceCountVerified(Boolean(currentQcChecklist.pieceCountVerified));
        setVerifiedPieces(
          currentQcChecklist.verifiedPieces != null ? String(currentQcChecklist.verifiedPieces) : ''
        );
        setQcNotes(currentQcChecklist.notes || '');
      } else {
        setStainFree(true);
        setOdorFresh(true);
        setIronedNeat(true);
        setPieceCountVerified(true);
        setVerifiedPieces('');
        setQcNotes('');
      }
    }
  }, [isOpen, finalWeightKg, totalWeightKg, weightDiffReason, currentQcChecklist]);

  if (!isOpen) return null;

  const numFinal = parseFloat(finalWeight) || 0;
  const diffKg = numFinal > 0 && baseInitial > 0 ? Number((numFinal - baseInitial).toFixed(3)) : 0;
  const diffPercent =
    baseInitial > 0 && numFinal > 0 ? Number(((diffKg / baseInitial) * 100).toFixed(1)) : 0;

  const handleSaveWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numFinal <= 0) {
      setErrorMsg('Masukkan berat final yang valid (> 0)');
      return;
    }

    try {
      setSavingWeight(true);
      setErrorMsg(null);
      setWeightSuccessMsg(null);

      const res = await laundryCoreApi.updateOrderWeight(orderId, {
        finalWeightKg: numFinal,
        weightDiffReason: reason.trim() || undefined,
        syncTotalWeight: true,
      });

      if (res.status === 'success') {
        setWeightSuccessMsg(`Berat final ${numFinal} kg berhasil dicatat.`);
        if (onSaved) onSaved();
      } else {
        setErrorMsg(res.message || 'Gagal menyimpan berat final');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan koneksi');
    } finally {
      setSavingWeight(false);
    }
  };

  const handleSaveQc = async (status: 'PASSED' | 'REWASH_REQUIRED') => {
    try {
      setSavingQc(true);
      setErrorMsg(null);

      const checklist: QcChecklistData = {
        stainFree,
        odorFresh,
        ironedNeat,
        pieceCountVerified,
        verifiedPieces: verifiedPieces ? parseInt(verifiedPieces) : undefined,
        notes: qcNotes.trim() || undefined,
      };

      const res = await laundryCoreApi.updateOrderQc(orderId, {
        qcStatus: status,
        qcChecklist: checklist,
        qcAfterPhotos: qcPhotoUrl.trim() ? [qcPhotoUrl.trim()] : undefined,
      });

      if (res.status === 'success') {
        if (onSaved) onSaved();
        onClose();
      } else {
        setErrorMsg(res.message || 'Gagal menyimpan status QC');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan koneksi');
    } finally {
      setSavingQc(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full sm:max-w-lg md:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden">
        {/* Header Modal */}
        <div className="p-4 sm:px-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-900">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                  Kontrol Kualitas &amp; Verifikasi Berat
                </h3>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Nota: <span className="font-mono font-bold text-slate-900">{invoiceNumber}</span>
                {customerName ? ` • ${customerName}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-4 sm:px-6 pt-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('weight')}
            className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'weight'
                ? 'border-blue-900 text-blue-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Timbang Berat Final</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('qc')}
            className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'qc'
                ? 'border-blue-900 text-blue-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Quality Control (QC)</span>
            {currentQcStatus === 'PASSED' && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
            {currentQcStatus === 'REWASH_REQUIRED' && (
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            )}
          </button>
        </div>

        {/* Error / Success Notifications */}
        {errorMsg && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800 font-medium shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {weightSuccessMsg && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-medium shrink-0">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{weightSuccessMsg}</span>
          </div>
        )}

        {/* Body Container */}
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1">
          {activeTab === 'weight' ? (
            /* TAB 1: VERIFIKASI BERAT */
            <form onSubmit={handleSaveWeight} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="text-[11px] font-bold text-slate-500">Berat Awal (Timbang Terima)</div>
                  <div className="text-xl font-black text-slate-900 mt-1">
                    {baseInitial > 0 ? `${baseInitial.toFixed(3)} Kg` : '-'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Tercatat saat nota dibuat</div>
                </div>

                <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-2xl">
                  <div className="text-[11px] font-bold text-blue-900">Selisih Berat</div>
                  <div
                    className={`text-xl font-black mt-1 ${
                      diffKg < 0 ? 'text-amber-700' : diffKg > 0 ? 'text-blue-900' : 'text-slate-900'
                    }`}
                  >
                    {diffKg > 0 ? `+${diffKg.toFixed(3)}` : diffKg.toFixed(3)} Kg
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {diffPercent !== 0 ? `(${diffPercent > 0 ? `+${diffPercent}` : diffPercent}%)` : 'Tepat sama'}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Berat Final Pasca-Proses (Kg) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0.01"
                    value={finalWeight}
                    onChange={(e) => setFinalWeight(e.target.value)}
                    placeholder="Contoh: 4.850"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    Kg
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Alasan Selisih Berat (Opsional jika wajar)
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Contoh: Penyusutan air pasca pengeringan mesin"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 mb-2"
                />

                {/* Quick Shortcuts */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Penyusutan air pasca pengeringan mesin',
                    'Pakaian sangat kotor saat timbang terima',
                    'Koreksi timbang awal',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setReason(preset)}
                      className="text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingWeight}
                  className="w-full py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold shadow-md shadow-blue-900/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Scale className="w-4 h-4" />
                  <span>{savingWeight ? 'Menyimpan...' : 'Simpan Verifikasi Berat'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* TAB 2: QUALITY CONTROL (QC) */
            <div className="space-y-4">
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed font-medium">
                Pemeriksaan fisik wajib sebelum pakaian diserahkan ke rak simpan atau pelanggan. Jika noda membandel belum terangkat, pilih <strong>Perlu Cuci Ulang</strong> agar otomatis dikembalikan ke antrean cuci tanpa biaya tambahan.
              </div>

              {/* 4 Checkbox Wajib */}
              <div className="space-y-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stainFree}
                    onChange={(e) => setStainFree(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-900 border-slate-300 focus:ring-blue-900"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">Bebas Noda &amp; Bercak</div>
                    <div className="text-[11px] text-slate-500">Kerah, ketiak, dan bagian sensitif bersih sempurna</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={odorFresh}
                    onChange={(e) => setOdorFresh(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-900 border-slate-300 focus:ring-blue-900"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">Aroma Segar &amp; Wangi</div>
                    <div className="text-[11px] text-slate-500">Parfum merata dan bebas bau apek sisa cucian</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ironedNeat}
                    onChange={(e) => setIronedNeat(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-900 border-slate-300 focus:ring-blue-900"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">Setrika Rapi &amp; Halus</div>
                    <div className="text-[11px] text-slate-500">Lipatan presisi atau gantung rapi tanpa kusut</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pieceCountVerified}
                    onChange={(e) => setPieceCountVerified(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-900 border-slate-300 focus:ring-blue-900"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">Jumlah Pcs Pakaian Cocok</div>
                    <div className="text-[11px] text-slate-500">Dihitung ulang cocok dengan rincian nota</div>
                  </div>
                </label>
              </div>

              {/* Jumlah Pcs Terverifikasi */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Jumlah Pcs Terverifikasi
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={verifiedPieces}
                    onChange={(e) => setVerifiedPieces(e.target.value)}
                    placeholder="Contoh: 12"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    URL Foto Hasil QC (Opsional)
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      value={qcPhotoUrl}
                      onChange={(e) => setQcPhotoUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                    />
                    <Camera className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              {/* Catatan QC */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Catatan Petugas QC
                </label>
                <textarea
                  rows={2}
                  value={qcNotes}
                  onChange={(e) => setQcNotes(e.target.value)}
                  placeholder="Tuliskan catatan pemeriksaan bila ada bagian yang perlu perhatian khusus..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 resize-none"
                />
              </div>

              {/* Tombol Aksi QC */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  disabled={savingQc}
                  onClick={() => handleSaveQc('REWASH_REQUIRED')}
                  className="py-2.5 px-3 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Perlu Cuci Ulang (Rewash)</span>
                </button>

                <button
                  type="button"
                  disabled={savingQc}
                  onClick={() => handleSaveQc('PASSED')}
                  className="py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>Lolos QC (Siap Rak)</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between text-xs text-slate-500 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <span>Well POS Laundry Precision Engine</span>
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
