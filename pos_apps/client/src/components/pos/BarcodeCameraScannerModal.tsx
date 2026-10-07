import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, X, RefreshCw, Zap, Flashlight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';

interface BarcodeCameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => { success: boolean; productName?: string };
}

export const BarcodeCameraScannerModal: React.FC<BarcodeCameraScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<any>(null);

  // Simpan onScan dalam Ref agar tidak memicu re-render atau re-initialization kamera (Anti-Blink)
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  // Anti-Spam / Throttling scan cooldown
  const lastScanTimestampRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string>('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastScannedResult, setLastScannedResult] = useState<{
    code: string;
    productName?: string;
    success: boolean;
  } | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  // Inisialisasi Web Audio Context untuk Synthetic Beep Sound
  useEffect(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        setAudioContext(new AudioCtx());
      }
    } catch {
      // AudioContext opsional
    }
  }, []);

  const playBeep = useCallback((isSuccess: boolean) => {
    if (!audioContext) return;
    try {
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isSuccess ? 1200 : 400, audioContext.currentTime);
      gain.gain.setValueAtTime(0.15, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + (isSuccess ? 0.12 : 0.25));
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start();
      osc.stop(audioContext.currentTime + (isSuccess ? 0.12 : 0.25));
    } catch {
      // Ignore audio error
    }
  }, [audioContext]);

  const triggerVibrate = useCallback((isSuccess: boolean) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(isSuccess ? 25 : [50, 50, 50]);
      } catch {
        // Ignore vibrate error
      }
    }
  }, []);

  // Hentikan Stream Kamera & ZXing Reader secara Bersih
  const stopScanner = useCallback(() => {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch (e) {
        console.warn('[BarcodeScanner] Error stopping controls:', e);
      }
      controlsRef.current = null;
    }

    if (videoRef.current && videoRef.current.srcObject) {
      try {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {
            // Ignore track stop error
          }
        });
        videoRef.current.srcObject = null;
      } catch (e) {
        console.warn('[BarcodeScanner] Error stopping media tracks:', e);
      }
    }

    setIsTorchOn(false);
    setHasTorch(false);
  }, []);

  // Mulai Scanning Kamera dengan Proteksi Orientasi iOS Safari & Anti-Blink
  const startScanner = useCallback(async () => {
    if (!videoRef.current) return;
    setErrorMessage(null);

    // Hentikan stream lama terlebih dahulu sebelum membuka stream baru
    stopScanner();

    try {
      if (!readerRef.current) {
        readerRef.current = new BrowserMultiFormatReader();
      }

      // Deteksi orientasi mobile (Portrait vs Landscape) agar iPhone tidak flip orientation terus menerus
      const isPortrait =
        typeof window !== 'undefined' && window.innerHeight >= window.innerWidth;

      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          facingMode: facingMode === 'environment' ? { ideal: 'environment' } : 'user',
          // Fleksibel adaptif: portrait mengutamakan tinggi > lebar, landscape mengutamakan lebar > tinggi
          width: { min: 480, ideal: isPortrait ? 720 : 1280, max: 1920 },
          height: { min: 480, ideal: isPortrait ? 1280 : 720, max: 1920 },
        },
      };

      const controls = await readerRef.current.decodeFromConstraints(
        constraints,
        videoRef.current,
        (result, _error) => {
          if (result) {
            const rawCode = result.getText().trim();
            if (rawCode) {
              const now = Date.now();
              // Anti-Spam: Beri jeda 1500ms untuk kode yang sama, atau 600ms untuk kode berbeda
              if (
                rawCode === lastScannedCodeRef.current &&
                now - lastScanTimestampRef.current < 1500
              ) {
                return;
              }
              if (now - lastScanTimestampRef.current < 600) {
                return;
              }

              lastScanTimestampRef.current = now;
              lastScannedCodeRef.current = rawCode;

              // Panggil handler dari Ref tanpa merusak lifecycle scanner
              const scanOutcome = onScanRef.current(rawCode);
              playBeep(scanOutcome.success);
              triggerVibrate(scanOutcome.success);

              setLastScannedResult({
                code: rawCode,
                productName: scanOutcome.productName,
                success: scanOutcome.success,
              });
            }
          }
        }
      );

      controlsRef.current = controls;

      // Cek apakah kamera memiliki kapabilitas Senter (Torch) di Safari iOS / Android
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        const track = stream.getVideoTracks()[0];
        if (track) {
          const capabilities = (track.getCapabilities?.() as any) || {};
          setHasTorch(Boolean(capabilities.torch));
        }
      }
    } catch (err: any) {
      console.error('[BarcodeScanner] Error accessing camera:', err);
      setErrorMessage(
        err.name === 'NotAllowedError'
          ? 'Izin kamera ditolak. Silakan izinkan akses kamera di Pengaturan Browser iPhone Anda (Safari -> Akses Kamera: Izinkan).'
          : 'Gagal mengakses kamera perangkat. Pastikan kamera tidak sedang digunakan oleh aplikasi lain.'
      );
    }
  }, [facingMode, playBeep, triggerVibrate, stopScanner]);

  // Toggle Senter (Flash/Torch)
  const toggleTorch = async () => {
    if (!videoRef.current || !videoRef.current.srcObject) return;
    try {
      const stream = videoRef.current.srcObject as MediaStream;
      const track = stream.getVideoTracks()[0];
      if (track) {
        const nextState = !isTorchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setIsTorchOn(nextState);
      }
    } catch (err) {
      console.warn('Gagal mengubah mode senter:', err);
    }
  };

  // Efek Lifecycle Kamera: HANYA aktif saat modal buka/tutup atau ganti kamera depan/belakang
  useEffect(() => {
    if (isOpen) {
      startScanner();
    } else {
      stopScanner();
      setLastScannedResult(null);
    }

    return () => {
      stopScanner();
    };
  }, [isOpen, facingMode, startScanner, stopScanner]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150 p-0 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 text-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[85vh]">
        {/* Header Modal */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/30 text-blue-400 border border-blue-500/40 flex items-center justify-center shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white leading-tight">
                Pemindai Barcode Kamera
              </h3>
              <p className="text-[11px] text-slate-400">
                Arahkan kamera ke barcode 1D atau QR Code produk
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewfinder Kamera Live dengan Dimensi Stabil (Anti-Blink & Anti-Flip) */}
        <div className="relative bg-black flex items-center justify-center h-[340px] sm:h-[380px] overflow-hidden select-none">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover select-none pointer-events-none"
            style={{
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
            }}
          />

          {/* Overlay Bingkai Kotak Bidik (Target Box) */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[75%] max-w-[280px] aspect-[4/3] border-2 border-blue-400/80 rounded-2xl relative shadow-2xl shadow-blue-500/20 overflow-hidden">
              {/* Garis Laser Animasi Pemindai */}
              <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-xs shadow-rose-500 animate-[bounce_2s_infinite]" />

              {/* Siku-Siku Sudut Bidik */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-blue-400 rounded-tl-sm" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-blue-400 rounded-tr-sm" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-blue-400 rounded-bl-sm" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-blue-400 rounded-br-sm" />
            </div>
          </div>

          {/* Quick Floating Controls (Senter & Balik Kamera) */}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-2 rounded-xl backdrop-blur-md transition-all cursor-pointer ${
                  isTorchOn
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30'
                    : 'bg-slate-900/70 text-white hover:bg-slate-800'
                }`}
                title={isTorchOn ? 'Matikan Senter' : 'Nyalakan Senter'}
              >
                <Flashlight className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
              }
              className="p-2 rounded-xl bg-slate-900/70 hover:bg-slate-800 text-white backdrop-blur-md transition-all cursor-pointer"
              title="Balik Kamera Depan / Belakang"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Pesan Kesalahan Akses Kamera */}
          {errorMessage && (
            <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center space-y-3 z-10">
              <AlertCircle className="w-10 h-10 text-rose-500" />
              <p className="text-xs text-rose-200 font-semibold max-w-[280px]">
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={startScanner}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                Coba Lagi
              </button>
            </div>
          )}
        </div>

        {/* Status Hasil Pemindaian Terakhir (Live Toast Card) */}
        <div className="p-3.5 bg-slate-900 border-t border-slate-800 shrink-0">
          {lastScannedResult ? (
            <div
              className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-3 animate-in fade-in duration-150 ${
                lastScannedResult.success
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
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
                      ? `+1 ${lastScannedResult.productName || 'Produk'}`
                      : 'Produk Tidak Ditemukan'}
                  </div>
                  <div className="text-[10px] opacity-75 font-mono">
                    Barcode: {lastScannedResult.code}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/10 shrink-0">
                {lastScannedResult.success ? 'Masuk Keranjang' : 'Cek SKU'}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-slate-400 text-xs py-1">
              <Zap className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
              <span>Kamera aktif. Siap memindai produk berikutnya...</span>
            </div>
          )}
        </div>

        {/* Footer Tombol Selesai */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-end shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer text-center"
          >
            Selesai Memindai
          </button>
        </div>
      </div>
    </div>
  );
};
