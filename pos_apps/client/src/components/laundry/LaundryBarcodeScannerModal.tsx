import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera,
  X,
  RefreshCw,
  Flashlight,
  AlertCircle,
  CheckCircle2,
  Barcode,
  Search,
} from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { LaundryQueueOrder } from '../../types/laundry';

interface LaundryBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: LaundryQueueOrder[];
  onOrderFound: (order: LaundryQueueOrder) => void;
}

export const LaundryBarcodeScannerModal: React.FC<LaundryBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  orders,
  onOrderFound,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<any>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  const [manualCode, setManualCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastScannedResult, setLastScannedResult] = useState<{
    code: string;
    order?: LaundryQueueOrder;
    success: boolean;
  } | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [useCamera, setUseCamera] = useState(false);

  const ordersRef = useRef(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const onOrderFoundRef = useRef(onOrderFound);
  useEffect(() => {
    onOrderFoundRef.current = onOrderFound;
  }, [onOrderFound]);

  const lastScanTimestampRef = useRef<number>(0);

  const handleProcessCode = useCallback((rawCode: string) => {
    const cleaned = rawCode.trim();
    if (!cleaned) return false;

    const now = Date.now();
    if (now - lastScanTimestampRef.current < 1200) {
      return false;
    }
    lastScanTimestampRef.current = now;

    const lower = cleaned.toLowerCase();
    const found = ordersRef.current.find(
      (o) =>
        o.invoiceNumber.toLowerCase() === lower ||
        o.id.toLowerCase() === lower ||
        (o.orderId && o.orderId.toLowerCase() === lower) ||
        o.invoiceNumber.toLowerCase().includes(lower)
    );

    if (found) {
      setLastScannedResult({
        code: cleaned,
        order: found,
        success: true,
      });
      onOrderFoundRef.current(found);
      return true;
    } else {
      setLastScannedResult({
        code: cleaned,
        success: false,
      });
      return false;
    }
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const ok = handleProcessCode(manualCode);
    if (ok) {
      setManualCode('');
    }
  };

  const stopScanner = useCallback(() => {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch (e) {
        console.warn('[LaundryBarcodeScanner] Error stopping controls:', e);
      }
      controlsRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      try {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      } catch (e) {
        console.warn('[LaundryBarcodeScanner] Error stopping media tracks:', e);
      }
    }
    setIsTorchOn(false);
    setHasTorch(false);
  }, []);

  const startScanner = useCallback(async () => {
    stopScanner();
    setErrorMessage(null);

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
            const text = result.getText();
            handleProcessCode(text);
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
              const capabilities = (videoTrack.getCapabilities && videoTrack.getCapabilities()) || {};
              if ((capabilities as any).torch) {
                setHasTorch(true);
              }
            }
          }
        } catch {
          // Abaikan
        }
      }, 500);
    } catch (err: any) {
      console.error('[LaundryBarcodeScanner] Error accessing camera:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Izin kamera ditolak. Silakan izinkan akses kamera di browser Anda.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage('Kamera tidak ditemukan pada perangkat ini.');
      } else {
        setErrorMessage('Gagal membuka kamera: ' + (err.message || 'Kesalahan sistem'));
      }
    }
  }, [facingMode, handleProcessCode, stopScanner]);

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
      setLastScannedResult(null);
      setManualCode('');
      setTimeout(() => {
        manualInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh] text-white">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-900/60 border border-blue-700/50 flex items-center justify-center text-blue-300">
              <Barcode className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">Pindai Barcode / QR Nota</h3>
              <p className="text-[11px] text-slate-400">Scanner USB atau Kamera Ponsel</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Quick Input Barcode / Invoice Manual / USB Gun */}
          <form onSubmit={handleManualSubmit} className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">
              Input No. Nota / Scan via Barcode Gun
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={manualInputRef}
                  type="text"
                  placeholder="Contoh: INV-20261121-0001..."
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-800/90 border border-slate-700 focus:border-blue-500 focus:bg-slate-800 rounded-xl text-xs font-mono text-white outline-none transition-all placeholder:text-slate-500"
                />
              </div>
              <button
                type="submit"
                className="h-10 px-4 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer"
              >
                Cari Nota
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              Tips: Jika menggunakan barcode scanner fisik (USB/Bluetooth), letakkan kursor di input atas lalu tembak barcode nota.
            </p>
          </form>

          {/* Toggle Camera Option */}
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300">Pindai dengan Kamera</span>
              <button
                type="button"
                onClick={() => setUseCamera(!useCamera)}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                  useCamera
                    ? 'bg-rose-900/60 text-rose-200 border border-rose-700/50'
                    : 'bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{useCamera ? 'Tutup Kamera' : 'Buka Kamera'}</span>
              </button>
            </div>

            {useCamera && (
              <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-inner">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Laser scan line overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-48 h-36 border-2 border-dashed border-blue-400/80 rounded-2xl relative">
                    <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,1)] animate-pulse" />
                  </div>
                </div>

                {/* Controls overlay */}
                <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                  {hasTorch && (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      className={`p-2 rounded-xl backdrop-blur-md transition-all cursor-pointer ${
                        isTorchOn ? 'bg-amber-500 text-slate-900' : 'bg-slate-900/70 text-white'
                      }`}
                    >
                      <Flashlight className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setFacingMode((p) => (p === 'environment' ? 'user' : 'environment'))}
                    className="p-2 rounded-xl bg-slate-900/70 hover:bg-slate-800 text-white backdrop-blur-md transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {errorMessage && (
                  <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-4 text-center space-y-2 z-10">
                    <AlertCircle className="w-8 h-8 text-rose-500" />
                    <p className="text-xs text-rose-200">{errorMessage}</p>
                    <button
                      type="button"
                      onClick={startScanner}
                      className="px-3 py-1.5 bg-blue-600 rounded-lg text-xs font-bold"
                    >
                      Coba Lagi
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Feedback Hasil Scan Terakhir */}
          {lastScannedResult && (
            <div
              className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 animate-in fade-in duration-150 ${
                lastScannedResult.success
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-500/50 text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {lastScannedResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="font-extrabold truncate">
                    {lastScannedResult.success
                      ? `Nota Ditemukan: ${lastScannedResult.order?.invoiceNumber}`
                      : 'Nota Tidak Ditemukan'}
                  </div>
                  <div className="text-[10px] opacity-75 font-mono">
                    {lastScannedResult.success
                      ? `${lastScannedResult.order?.customerName} • ${lastScannedResult.order?.serviceName}`
                      : `Kode: ${lastScannedResult.code}`}
                  </div>
                </div>
              </div>
              {lastScannedResult.success && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-extrabold text-[11px] shadow-sm hover:bg-emerald-500 transition-colors shrink-0 cursor-pointer"
                >
                  Buka Nota
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer text-center"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
