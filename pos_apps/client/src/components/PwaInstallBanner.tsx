import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';

export const PwaInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIos, installing, installApp } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    const isDismissed = sessionStorage.getItem('wellpos_pwa_banner_dismissed');
    if (isDismissed) {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('wellpos_pwa_banner_dismissed', 'true');
  };

  // Jika sudah terpasang atau ditutup di sesi ini, jangan tampilkan banner mengambang
  if (isInstalled || dismissed) {
    return null;
  }

  // Tampilkan banner jika browser mendukung native install prompt atau perangkat iOS
  if (!isInstallable && !isIos) {
    return null;
  }

  return (
    <>
      {/* Floating Bottom Installation Banner */}
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-40 animate-in slide-in-from-bottom duration-300">
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-4 shadow-2xl text-white flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black tracking-tight text-white flex items-center gap-1.5">
                  <span>Pasang Aplikasi Well POS</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    PWA
                  </span>
                </h4>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed font-medium">
                  Akses kasir langsung dari layar utama HP / Tablet Anda tanpa address bar.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Tutup Banner"
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
            {isIos ? (
              <button
                type="button"
                onClick={() => setShowIosGuide(true)}
                className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/30 cursor-pointer"
              >
                <Share className="w-3.5 h-3.5" />
                <span>Petunjuk Tambah ke Layar Utama</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={installApp}
                disabled={installing}
                className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/30 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{installing ? 'Memasang Aplikasi...' : 'Pasang ke Layar Utama (1-Klik)'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleDismiss}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-all shrink-0 cursor-pointer"
            >
              Nanti Saja
            </button>
          </div>
        </div>
      </div>

      {/* iOS Safari Guide Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl text-slate-900 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-blue-600" />
                <span>Pasang di iPhone / iPad (iOS)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                  1
                </span>
                <p>
                  Buka website ini menggunakan browser <strong>Safari</strong> di perangkat iOS Anda.
                </p>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                  2
                </span>
                <p>
                  Ketuk tombol <strong>Bagikan (Share)</strong> <Share className="w-3.5 h-3.5 inline mx-1 text-blue-600" /> di bagian bilah bawah Safari.
                </p>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                  3
                </span>
                <p>
                  Gulir ke bawah dan pilih <strong>"Tambah ke Layar Utama" (Add to Home Screen)</strong>.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
};

/**
 * Compact Header Button version for Topbars / POS Terminals
 */
export const PwaInstallButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isInstallable, isInstalled, isIos, installing, installApp } = usePwaInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showBrowserGuide, setShowBrowserGuide] = useState(false);

  // Jika sudah terpasang (berjalan di standalone PWA window), sembunyikan tombol
  if (isInstalled) {
    return null;
  }

  const handleClick = () => {
    if (isIos) {
      setShowIosGuide(true);
    } else if (isInstallable) {
      installApp();
    } else {
      setShowBrowserGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={installing}
        title="Pasang aplikasi Well POS ke layar utama perangkat Anda"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 transition-all active:scale-95 cursor-pointer shadow-2xs ${className}`}
      >
        <Smartphone className="w-3.5 h-3.5 text-blue-700" />
        <span>{installing ? 'Memasang...' : 'Pasang Aplikasi'}</span>
      </button>

      {/* iOS Modal if clicked */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl text-slate-900 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-extrabold text-xs">Pasang di iPhone / iPad</span>
              <button onClick={() => setShowIosGuide(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Ketuk tombol <strong>Share</strong> di Safari lalu pilih <strong>"Tambah ke Layar Utama"</strong>.
            </p>
            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Browser Desktop / Android Fallback Guide Modal */}
      {showBrowserGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl text-slate-900 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <span className="font-extrabold text-xs text-blue-950 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-blue-700" />
                <span>Petunjuk Pasang Aplikasi</span>
              </span>
              <button
                type="button"
                onClick={() => setShowBrowserGuide(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-100 space-y-1">
                <p className="font-bold text-blue-950">Komputer / Laptop (Chrome / Edge):</p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Klik ikon <strong>Pasang (Install)</strong> di ujung kanan bilah alamat (URL bar) atau menu titik tiga (⋮) &gt; pilih <strong>"Simpan dan Bagikan"</strong> &gt; <strong>"Pasang Well POS"</strong>.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                <p className="font-bold text-slate-900">HP / Tablet Android:</p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Ketuk menu titik tiga (⋮) di pojok kanan atas browser &gt; pilih <strong>"Tambahkan ke Layar Utama"</strong> atau <strong>"Pasang Aplikasi"</strong>.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowBrowserGuide(false)}
              className="w-full py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs transition-all"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
};
