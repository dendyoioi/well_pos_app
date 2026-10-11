import React, { useState, useEffect } from 'react';
import { ShieldAlert, Wrench, Clock, RefreshCw, Sparkles } from 'lucide-react';
import { api } from '../services/api';

export interface MaintenanceInfo {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  estimatedEndTime: string | null;
  activatedAt?: string | null;
}

interface MaintenancePageProps {
  maintenanceInfo?: MaintenanceInfo | null;
  onMaintenanceResolved?: () => void;
}

export const MaintenancePage: React.FC<MaintenancePageProps> = ({
  maintenanceInfo,
  onMaintenanceResolved,
}) => {
  const [checking, setChecking] = useState(false);
  const [currentInfo, setCurrentInfo] = useState<MaintenanceInfo | null>(maintenanceInfo || null);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const checkStatus = async () => {
    setChecking(true);
    try {
      const res = await api.getSystemStatus();
      setLastChecked(new Date());
      if (res.status === 'success' && res.data) {
        if (!res.data.maintenanceMode) {
          if (onMaintenanceResolved) {
            onMaintenanceResolved();
          } else {
            window.location.reload();
          }
          return;
        }
        setCurrentInfo(res.data);
      }
    } catch {
      // Abaikan error jaringan saat polling
    } finally {
      setChecking(false);
    }
  };

  // Polling status pemeliharaan setiap 15 detik
  useEffect(() => {
    const interval = setInterval(() => {
      checkStatus();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const message =
    currentInfo?.maintenanceMessage ||
    'Sistem Well POS sedang dalam peningkatan dan pemeliharaan berkala untuk meningkatkan stabilitas serta performa layanan. Seluruh operasional kasir dan halaman publik ditangguhkan sementara.';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between items-center p-4 sm:p-8 relative overflow-hidden font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Glow Ambient Lights */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Logo */}
      <header className="w-full max-w-5xl flex items-center justify-between z-10 pt-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-900 border border-blue-700/50 flex items-center justify-center font-black text-white text-base shadow-sm">
            W
          </div>
          <span className="font-black text-lg tracking-tight text-white">Well POS</span>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-bold text-slate-400">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>Sistem Sedang Dirawat</span>
        </div>
      </header>

      {/* Main Content Hero */}
      <main className="w-full max-w-lg my-auto py-10 text-center z-10 space-y-6">
        {/* Animated Icon Box */}
        <div className="relative inline-block mx-auto">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center shadow-xl shadow-amber-500/20 mx-auto">
            <Wrench className="w-12 h-12 stroke-[2.2] animate-bounce" style={{ animationDuration: '2.5s' }} />
          </div>
          <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-slate-900 border-2 border-slate-950 text-amber-400 flex items-center justify-center shadow-md">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>

        {/* Title & Badge */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-extrabold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Mode Pemeliharaan Rutin Aktif</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
            Kami Sedang Melakukan Peningkatan Sistem
          </h1>

          <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
            {message}
          </p>
        </div>

        {/* Info Box Cards */}
        <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 p-4 space-y-3 shadow-lg text-left">
          {currentInfo?.estimatedEndTime && (
            <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-800">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Estimasi Waktu Selesai:</span>
              </span>
              <span className="font-black text-amber-300 font-mono">
                {currentInfo.estimatedEndTime}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Pemeriksaan Otomatis Aktif (15 detik)</span>
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Cek: {lastChecked.toLocaleTimeString('id-ID')}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={checkStatus}
            disabled={checking}
            className="w-full sm:w-auto h-11 px-6 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:bg-slate-800"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Memeriksa Server...' : 'Periksa Status Sekarang'}</span>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 border-t border-slate-900 pt-6 z-10">
        <div>&copy; {new Date().getFullYear()} Well POS Platform. Hak Cipta Dilindungi.</div>
      </footer>
    </div>
  );
};
