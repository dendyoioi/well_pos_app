import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Scan,
  Search,
  Tag,
  Check,
  AlertTriangle,
  Shirt,
  MapPin,
} from 'lucide-react';
import { laundryCore2Api } from '../../services/api';
import type { LaundryTrackedItem, TrackedItemStage } from '../../types/laundry_core2';

interface LaundryTagScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStageChanged?: () => void;
}

export const LaundryTagScannerModal: React.FC<LaundryTagScannerModalProps> = ({
  isOpen,
  onClose,
  onStageChanged,
}) => {
  const [tagInput, setTagInput] = useState<string>('');
  const [scanning, setScanning] = useState<boolean>(false);
  const [item, setItem] = useState<LaundryTrackedItem | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [updating, setUpdating] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTagInput('');
      setItem(null);
      setErrorMsg(null);
      setSuccessMsg(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleScan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanTag = tagInput.trim();
    if (!cleanTag) return;

    try {
      setScanning(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      const res = await laundryCore2Api.scanItemByTag(cleanTag);
      if (res.status === 'success' && res.data) {
        setItem(res.data);
      } else {
        setItem(null);
        setErrorMsg(res.message || `Tag "${cleanTag}" tidak ditemukan pada outlet ini`);
      }
    } catch (err: any) {
      setItem(null);
      setErrorMsg(err?.message || 'Gagal memindai kode tag pakaian');
    } finally {
      setScanning(false);
    }
  };

  const handleQuickUpdateStage = async (newStage: TrackedItemStage) => {
    if (!item) return;

    try {
      setUpdating(true);
      const res = await laundryCore2Api.updateItem(item.id, { currentStage: newStage });
      if (res.status === 'success') {
        setItem((prev) => (prev ? { ...prev, currentStage: newStage } : prev));
        setSuccessMsg(`Tahap berhasil diperbarui menjadi ${newStage}`);
        onStageChanged?.();
        setTimeout(() => setSuccessMsg(null), 2000);
      } else {
        alert(res.message || 'Gagal memperbarui tahap');
      }
    } catch (err: any) {
      alert(err?.message || 'Terjadi kesalahan sistem saat memperbarui tahap');
    } finally {
      setUpdating(false);
    }
  };

  const handleQuickUpdateRack = async (newRack: string) => {
    if (!item) return;
    try {
      await laundryCore2Api.updateItem(item.id, { rackCode: newRack.trim() || null });
      setItem((prev) => (prev ? { ...prev, rackCode: newRack.trim() || null } : prev));
      onStageChanged?.();
    } catch (err: any) {
      console.error('Failed to update rack:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
      <div className="bg-white w-full sm:max-w-xl sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-md shadow-blue-900/20">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Pindai Tag Pakaian (Quick Tag Scan)
              </h2>
              <p className="text-xs text-slate-500">
                Gunakan scanner barcode USB atau ketik kode tag pakaian (e.g. TAG-INV-01)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input Barcode / Tag Bar */}
        <div className="p-5 border-b border-slate-100 shrink-0 bg-white">
          <form onSubmit={handleScan} className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Ketik atau scan tag (misal: TAG-001-01)..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 placeholder:font-sans placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 bg-slate-50 focus:bg-white transition-all uppercase"
              />
              <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
            <button
              type="submit"
              disabled={scanning || !tagInput.trim()}
              className="px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-900/20 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{scanning ? 'Mencari...' : 'Cari'}</span>
            </button>
          </form>
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto overscroll-contain flex-1 p-5 space-y-4">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center gap-2.5">
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {item ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Card Pakaian Ditemukan */}
              <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/30 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-mono text-sm font-extrabold text-blue-950 bg-blue-100 px-2.5 py-0.5 rounded-lg border border-blue-200">
                      {item.tagCode}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 mt-2 flex items-center gap-1.5">
                      <Shirt className="w-4 h-4 text-blue-900" />
                      <span>{item.garmentName}</span>
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {item.category && `${item.category} • `}
                      {item.color && `Warna: ${item.color} • `}
                      {item.brand && `Merek: ${item.brand}`}
                    </p>
                  </div>

                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      item.currentStage === 'HANDED_OVER'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.currentStage === 'READY'
                        ? 'bg-sky-100 text-sky-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {item.currentStage}
                  </span>
                </div>

                {item.specialTreatment && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-medium">
                    ⚠️ <strong>Perlakuan Khusus:</strong> {item.specialTreatment}
                  </div>
                )}

                {/* Nota Induk & Pelanggan */}
                {item.order && (
                  <div className="pt-2 border-t border-blue-100 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">NOTA PESANAN</span>
                      <span className="font-mono font-bold text-slate-900">
                        #{item.order.invoiceNumber}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-bold">PELANGGAN</span>
                      <span className="font-bold text-slate-800">
                        {item.order.customer?.name || 'Pelanggan'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Lokasi Rak Penyimpanan */}
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-white space-y-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-900" />
                  <span>Lokasi Rak Pakaian</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    defaultValue={item.rackCode || ''}
                    placeholder="Contoh: RAK-A-01, HANGER-02"
                    onBlur={(e) => handleQuickUpdateRack(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 bg-slate-50 focus:bg-white"
                  />
                  <span className="text-[11px] text-slate-400 self-center">Otomatis tersimpan</span>
                </div>
              </div>

              {/* Tombol Aksi Cepat Stage */}
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-white space-y-2">
                <label className="text-xs font-bold text-slate-800 block">
                  Aksi Cepat Majukan Tahap Pakaian
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['WASHING', 'DRYING', 'IRONING', 'READY'] as TrackedItemStage[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      disabled={updating || item.currentStage === st}
                      onClick={() => handleQuickUpdateStage(st)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center ${
                        item.currentStage === st
                          ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {st === 'WASHING'
                        ? 'Cuci'
                        : st === 'DRYING'
                        ? 'Kering'
                        : st === 'IRONING'
                        ? 'Setrika'
                        : 'Siap Rak'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400">
              <Scan className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
              <p className="text-xs font-bold text-slate-600">Arahkan Scanner atau Masukkan Tag</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                Sistem akan langsung menampilkan info pakaian, nota pesanan, dan tombol cepat untuk mengubah tahap kanban.
              </p>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between text-xs text-slate-500 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <span>Barcode &amp; QR Tag Scanner</span>
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
