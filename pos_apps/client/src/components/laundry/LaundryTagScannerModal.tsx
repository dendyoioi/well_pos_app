import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Scan,
  Search,
  Tag,
  Check,
  AlertTriangle,
  Shirt,
  MapPin,
  Camera,
  RefreshCw,
  Flashlight,
} from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
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

  // Camera Scanner State (ZXing)
  const [useCamera, setUseCamera] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<any>(null);
  const lastScanTimestampRef = useRef<number>(0);

  const performTagLookup = useCallback(async (rawCode: string) => {
    const cleanTag = rawCode.trim();
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
  }, []);

  const stopScanner = useCallback(() => {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch (e) {
        console.warn('[LaundryTagScanner] Error stopping controls:', e);
      }
      controlsRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      try {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      } catch (e) {
        console.warn('[LaundryTagScanner] Error stopping media tracks:', e);
      }
    }
    setIsTorchOn(false);
    setHasTorch(false);
  }, []);

  const handleCameraDetected = useCallback(
    (rawText: string) => {
      const cleaned = rawText.trim();
      if (!cleaned) return;
      const now = Date.now();
      if (now - lastScanTimestampRef.current < 1200) {
        return;
      }
      lastScanTimestampRef.current = now;
      setTagInput(cleaned);
      performTagLookup(cleaned);
    },
    [performTagLookup]
  );

  const startScanner = useCallback(async () => {
    stopScanner();
    setCameraError(null);

    if (!readerRef.current) {
      readerRef.current = new BrowserMultiFormatReader();
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      if (!videoRef.current) return;

      const controls = await readerRef.current.decodeFromConstraints(
        constraints,
        videoRef.current,
        (result) => {
          if (result) {
            handleCameraDetected(result.getText());
          }
        }
      );

      controlsRef.current = controls;

      setTimeout(() => {
        try {
          if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
              const capabilities =
                (videoTrack.getCapabilities && videoTrack.getCapabilities()) || {};
              if ((capabilities as any).torch) {
                setHasTorch(true);
              }
            }
          }
        } catch {
          // Abaikan bila perangkat tidak mendukung capabilities torch
        }
      }, 500);
    } catch (err: any) {
      console.error('[LaundryTagScanner] Error accessing camera:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Izin kamera ditolak. Silakan izinkan akses kamera pada browser Anda.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('Kamera tidak ditemukan pada perangkat ini.');
      } else {
        setCameraError('Gagal membuka kamera: ' + (err.message || 'Kesalahan perangkat'));
      }
    }
  }, [facingMode, handleCameraDetected, stopScanner]);

  useEffect(() => {
    if (isOpen && useCamera) {
      startScanner();
    } else {
      stopScanner();
    }
    return () => {
      stopScanner();
    };
  }, [isOpen, useCamera, startScanner, stopScanner]);

  useEffect(() => {
    if (isOpen) {
      setTagInput('');
      setItem(null);
      setErrorMsg(null);
      setSuccessMsg(null);
      setCameraError(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setUseCamera(false);
      stopScanner();
    }
  }, [isOpen, stopScanner]);

  const toggleTorch = async () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    try {
      const stream = videoRef.current.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      if (track) {
        const nextTorch = !isTorchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextTorch } as any],
        });
        setIsTorchOn(nextTorch);
      }
    } catch (e) {
      console.warn('Gagal menyalakan senter kamera:', e);
    }
  };

  const handleScan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await performTagLookup(tagInput);
  };

  const handleQuickUpdateStage = async (newStage: TrackedItemStage) => {
    if (!item) return;

    try {
      setUpdating(true);
      setErrorMsg(null);
      const res = await laundryCore2Api.updateItem(item.id, { currentStage: newStage });
      if (res.status === 'success') {
        setItem((prev) => (prev ? { ...prev, currentStage: newStage } : prev));
        setSuccessMsg(`Tahap berhasil diperbarui menjadi ${newStage}`);
        onStageChanged?.();
        setTimeout(() => setSuccessMsg(null), 2000);
      } else {
        setErrorMsg(res.message || 'Gagal memperbarui tahap');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Terjadi kesalahan sistem saat memperbarui tahap');
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
      setErrorMsg(err?.message || 'Gagal memperbarui lokasi rak pakaian');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
      <div className="bg-white w-full sm:max-w-xl sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col min-h-0 max-h-[92dvh] sm:max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-md shadow-blue-900/20 shrink-0">
              <Scan className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                Pindai Tag Pakaian (Quick Tag Scan)
              </h2>
              <p className="text-xs text-slate-500 break-words">
                Scanner barcode USB, kamera ponsel, atau ketik kode tag (misal: TAG-INV-01)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input Barcode / Tag Bar + Tombol Buka Kamera */}
        <div className="p-4 sm:p-5 border-b border-slate-100 shrink-0 bg-white space-y-3">
          <form onSubmit={handleScan} className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <input
                ref={inputRef}
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Ketik atau scan tag (misal: TAG-001-01)..."
                className="w-full h-11 sm:h-10 pl-9 pr-3 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 placeholder:font-sans placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 bg-slate-50 focus:bg-white transition-all uppercase"
              />
              <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
            <button
              type="submit"
              disabled={scanning || !tagInput.trim()}
              className="h-11 sm:h-10 px-4 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-900/20 disabled:opacity-50 flex items-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
            >
              <Search className="w-3.5 h-3.5 shrink-0" />
              <span>{scanning ? 'Mencari...' : 'Cari'}</span>
            </button>
          </form>

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs font-bold text-slate-600">Pindai Label Tag via Kamera</span>
            <button
              type="button"
              onClick={() => setUseCamera((prev) => !prev)}
              className={`h-10 sm:h-9 px-3.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                useCamera
                  ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                  : 'bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5 shrink-0" />
              <span>{useCamera ? 'Tutup Kamera' : 'Buka Kamera'}</span>
            </button>
          </div>

          {useCamera && (
            <div className="relative aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Overlay Garis Bidik Scan */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-52 h-32 border-2 border-dashed border-sky-400/90 rounded-2xl relative">
                  <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,1)] animate-pulse" />
                </div>
              </div>

              {/* Camera Controls Overlay (Switch Facing & Torch) */}
              <div className="absolute bottom-2.5 inset-x-2.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900/80 text-white text-[11px] font-bold flex items-center gap-1.5 border border-white/20 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{facingMode === 'environment' ? 'Kamera Belakang' : 'Kamera Depan'}</span>
                </button>

                {hasTorch && (
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 border cursor-pointer ${
                      isTorchOn
                        ? 'bg-amber-400 text-slate-950 border-amber-300'
                        : 'bg-slate-900/80 text-white border-white/20'
                    }`}
                  >
                    <Flashlight className="w-3.5 h-3.5" />
                    <span>{isTorchOn ? 'Senter On' : 'Senter'}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {cameraError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span className="break-words">{cameraError}</span>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto overscroll-contain flex-1 min-h-0 p-4 sm:p-5 space-y-4">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span className="break-words min-w-0">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center gap-2.5">
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="break-words min-w-0">{successMsg}</span>
            </div>
          )}

          {item ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Card Pakaian Ditemukan */}
              <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/30 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <span className="font-mono text-sm font-extrabold text-blue-950 bg-blue-100 px-2.5 py-0.5 rounded-lg border border-blue-200">
                      {item.tagCode}
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 mt-2 flex items-center gap-1.5">
                      <Shirt className="w-4 h-4 text-blue-900 shrink-0" />
                      <span className="break-words">{item.garmentName}</span>
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5 break-words">
                      {item.category && `${item.category} • `}
                      {item.color && `Warna: ${item.color} • `}
                      {item.brand && `Merek: ${item.brand}`}
                    </p>
                  </div>

                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${
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
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-medium break-words">
                    ⚠️ <strong>Perlakuan Khusus:</strong> {item.specialTreatment}
                  </div>
                )}

                {/* Nota Induk & Pelanggan */}
                {item.order && (
                  <div className="pt-2 border-t border-blue-100 grid grid-cols-2 gap-2 text-xs">
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-400 block font-bold">NOTA PESANAN</span>
                      <span className="font-mono font-bold text-slate-900 break-all">
                        #{item.order.invoiceNumber}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-400 block font-bold">PELANGGAN</span>
                      <span className="font-bold text-slate-800 truncate block">
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
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    defaultValue={item.rackCode || ''}
                    placeholder="Contoh: RAK-A-01, HANGER-02"
                    onBlur={(e) => handleQuickUpdateRack(e.target.value)}
                    className="flex-1 h-10 sm:h-9 px-3 rounded-xl border border-slate-200 text-xs font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 bg-slate-50 focus:bg-white"
                  />
                  <span className="text-[11px] text-slate-400 self-start sm:self-center">
                    Otomatis tersimpan
                  </span>
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
                      className={`h-11 sm:h-9 px-2.5 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
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
            <div className="py-10 text-center text-slate-400">
              <Scan className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
              <p className="text-xs font-bold text-slate-600">Arahkan Scanner / Kamera atau Masukkan Tag</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                Sistem akan langsung menampilkan info pakaian, nota pesanan, dan tombol cepat untuk mengubah tahap kanban.
              </p>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3.5 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between text-xs text-slate-500 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          <span>Barcode &amp; QR Tag Scanner</span>
          <button
            type="button"
            onClick={onClose}
            className="h-10 sm:h-8 px-4 font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-200/70 rounded-xl transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
