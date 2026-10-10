import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Wifi,
  WifiOff,
  Clock,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Store,
  Info,
  ExternalLink,
  Smartphone,
  Sparkles,
  Eye,
  EyeOff,
  Key,
} from 'lucide-react';
import { api } from '../services/api';
import type { Outlet } from '../types/outlet';

interface QrMenuSettingsViewProps {
  activeOutlet: Outlet | null;
}

export const QrMenuSettingsView: React.FC<QrMenuSettingsViewProps> = ({ activeOutlet }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form State
  const [selfOrderingEnabled, setSelfOrderingEnabled] = useState(true);
  const [welcomeTitle, setWelcomeTitle] = useState('');
  const [welcomeSubtitle, setWelcomeSubtitle] = useState('');
  
  // Wi-Fi Facility State
  const [wifiEnabled, setWifiEnabled] = useState(true);
  const [wifiName, setWifiName] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);

  // Kitchen Prep Time State
  const [showEstimatedTime, setShowEstimatedTime] = useState(true);
  const [estimatedPrepMinutes, setEstimatedPrepMinutes] = useState(15);

  const fetchSettings = async () => {
    if (!activeOutlet) return;
    setLoading(true);
    try {
      const res = await api.getQrMenuSettings(activeOutlet.id);
      if (res.status === 'success' && res.data) {
        setSelfOrderingEnabled(res.data.selfOrderingEnabled);
        setWelcomeTitle(res.data.welcomeTitle || 'Selamat Datang di Buku Menu Digital!');
        setWelcomeSubtitle(res.data.welcomeSubtitle || 'Pesan makanan & minuman langsung dari meja Anda tanpa perlu antri.');
        setWifiEnabled(res.data.wifiEnabled !== undefined ? res.data.wifiEnabled : Boolean(res.data.wifiName));
        setWifiName(res.data.wifiName || '');
        setWifiPassword(res.data.wifiPassword || '');
        setShowEstimatedTime(res.data.showEstimatedTime ?? true);
        setEstimatedPrepMinutes(res.data.estimatedPrepMinutes || 15);
      }
    } catch (err) {
      console.error('Gagal mengambil pengaturan menu QR:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [activeOutlet?.id]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOutlet) return;
    setSaving(true);
    setFeedback(null);

    try {
      const res = await api.updateQrMenuSettings({
        outletId: activeOutlet.id,
        selfOrderingEnabled,
        welcomeTitle,
        welcomeSubtitle,
        wifiEnabled,
        wifiName: wifiEnabled ? wifiName : '',
        wifiPassword: wifiEnabled ? wifiPassword : '',
        showEstimatedTime,
        estimatedPrepMinutes: Number(estimatedPrepMinutes) || 15,
      });

      if (res.status === 'success') {
        setFeedback({ type: 'success', message: 'Pengaturan Buku Menu QR berhasil diperbarui!' });
        setTimeout(() => setFeedback(null), 3500);
      } else {
        setFeedback({ type: 'error', message: res.message || 'Gagal menyimpan pengaturan' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Terjadi kesalahan sistem' });
    } finally {
      setSaving(false);
    }
  };

  if (!activeOutlet) {
    return (
      <div className="p-12 bg-white rounded-3xl border border-slate-200 text-center space-y-4 shadow-xs">
        <Store className="w-14 h-14 text-slate-300 mx-auto" />
        <h3 className="text-lg font-black text-blue-950">Pilih Outlet Toko Terlebih Dahulu</h3>
        <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
          Silakan pilih outlet toko pada bilah navigasi atas untuk mengonfigurasi buku menu QR khusus untuk toko tersebut.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 shadow-xs">
        <div className="inline-block w-7 h-7 border-3 border-blue-900 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="font-bold text-xs sm:text-sm text-slate-700">Memuat pengaturan buku menu...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-28 sm:pb-16">
      {/* Top Header Card */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-900 text-xs font-black mb-2.5">
            <Sliders className="w-3.5 h-3.5" />
            <span>Konfigurasi Buku Menu Digital &bull; {activeOutlet.name}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Pengaturan Buku Menu Tamu (QR)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Sesuaikan pesan sambutan, izin pemesanan mandiri, fasilitas Wi-Fi, dan perkiraan waktu saji yang tampil di ponsel pelanggan saat scan QR meja.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-start md:self-auto">
          <button
            type="button"
            onClick={() => window.open(`/#menu?outletId=${activeOutlet.id}&table=01`, '_blank')}
            className="h-10 px-4 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold transition-all inline-flex items-center gap-2 shadow-2xs hover:shadow-xs cursor-pointer active:scale-95"
            title="Buka tampilan tamu di tab baru"
          >
            <Smartphone className="w-4 h-4 text-blue-900" />
            <span>Pratinjau Layar Tamu</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-3 border shadow-xs transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* LIVE SIMULATOR: PRATINJAU BILAH ATAS BUKU MENU TAMU */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-950 to-slate-900 rounded-3xl p-6 sm:p-7 text-white shadow-md relative overflow-hidden border border-blue-800">
        <div className="absolute right-0 top-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span className="text-xs font-black uppercase tracking-wider text-blue-200">
              Pratinjau Langsung Bilah Tamu (Mobile Viewport)
            </span>
          </div>
          <span className="text-[11px] font-bold text-slate-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
            Pratinjau Meja 01
          </span>
        </div>

        {/* Mock Mobile Top Card */}
        <div className="bg-white text-slate-900 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                {activeOutlet.name}
              </p>
              <h3 className="text-sm sm:text-base font-black text-slate-900 leading-snug">
                {welcomeTitle || 'Selamat Datang di Buku Menu Digital!'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                {welcomeSubtitle || 'Pesan menu favorit Anda langsung dari meja.'}
              </p>
            </div>

            <span className="px-3 py-1.5 rounded-xl bg-blue-900 text-white font-black text-xs shrink-0 shadow-xs">
              📍 Meja 01
            </span>
          </div>

          {/* Simulated Facility Strip */}
          {(wifiEnabled || showEstimatedTime) ? (
            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-3 text-xs overflow-x-auto">
              {wifiEnabled ? (
                <div className="flex items-center gap-1.5 font-medium text-slate-700 shrink-0">
                  <Wifi className="w-3.5 h-3.5 text-blue-900 shrink-0" />
                  <span>
                    Wi-Fi: <strong className="text-slate-900 font-black">{wifiName || 'Belum Diatur'}</strong>
                  </span>
                  {wifiPassword && (
                    <>
                      <span className="text-slate-300">|</span>
                      <span>
                        Sandi: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-950 font-mono font-bold">{wifiPassword}</code>
                      </span>
                    </>
                  )}
                </div>
              ) : (
                <div />
              )}

              {showEstimatedTime && (
                <div className="flex items-center gap-1 text-slate-600 shrink-0 ml-auto bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded-lg text-[11px]">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span className="font-bold">~{estimatedPrepMinutes}m saji</span>
                </div>
              )}
            </div>
          ) : (
            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 italic">
              ✨ Mode Minimalis Aktif: Bilah fasilitas Wi-Fi &amp; Waktu Saji disembunyikan dari buku menu tamu.
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* CARD 1: STATUS PEMESANAN MANDIRI & SAMBUTAN */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900">
                  Pemesanan Mandiri dari Meja (Self-Ordering)
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                    selfOrderingEnabled
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {selfOrderingEnabled ? 'Pemesanan Aktif' : 'Mode Katalog Saja (View-Only)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                Bila dinonaktifkan, tamu hanya dapat melihat katalog menu dan harga tanpa tombol keranjang dan checkout.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSelfOrderingEnabled(!selfOrderingEnabled)}
              className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                selfOrderingEnabled ? 'bg-blue-900' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  selfOrderingEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Judul Sambutan Toko
              </label>
              <input
                type="text"
                value={welcomeTitle}
                onChange={(e) => setWelcomeTitle(e.target.value)}
                placeholder="Contoh: Selamat Datang di Kopi Senja!"
                className="w-full h-10 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 transition-all shadow-2xs"
              />
              <p className="text-[11px] text-slate-400">
                Teks sapaan ramah utama yang menyapa tamu di bagian atas layar.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Sub-Judul / Keterangan Singkat
              </label>
              <input
                type="text"
                value={welcomeSubtitle}
                onChange={(e) => setWelcomeSubtitle(e.target.value)}
                placeholder="Contoh: Pilih menu favorit Anda dan nikmati racikan terbaik kami."
                className="w-full h-10 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 transition-all shadow-2xs"
              />
              <p className="text-[11px] text-slate-400">
                Penjelasan singkat cara pemesanan atau promo spesial restoran.
              </p>
            </div>
          </div>
        </div>

        {/* CARD 2: FASILITAS WI-FI RESTORAN (OPSI AKTIF / NONAKTIF) */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-start gap-3.5">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black border transition-all ${
                wifiEnabled 
                  ? 'bg-blue-50 border-blue-200 text-blue-900' 
                  : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}>
                {wifiEnabled ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-slate-900">
                    Fasilitas Jaringan Wi-Fi Tamu
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                      wifiEnabled
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {wifiEnabled ? 'Aktif di Buku Menu' : 'Nonaktif (Disembunyikan)'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-xl">
                  Aktifkan jika resto menyediakan Wi-Fi gratis untuk pelanggan agar mereka tidak perlu bertanya kata sandi ke kasir.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setWifiEnabled(!wifiEnabled)}
              className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden self-start sm:self-auto ${
                wifiEnabled ? 'bg-blue-900' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  wifiEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {wifiEnabled ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Nama Jaringan Wi-Fi (SSID)
                  </label>
                  <div className="relative">
                    <Wifi className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required={wifiEnabled}
                      value={wifiName}
                      onChange={(e) => setWifiName(e.target.value)}
                      placeholder="Contoh: KopiSenja_Guest"
                      className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 transition-all shadow-2xs"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Nama SSID jaringan yang harus dipilih tamu di HP mereka.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Kata Sandi Wi-Fi
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPasswordText ? 'text' : 'password'}
                      value={wifiPassword}
                      onChange={(e) => setWifiPassword(e.target.value)}
                      placeholder="Kosongkan jika Wi-Fi tanpa sandi"
                      className="w-full h-10 pl-10 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 font-mono transition-all shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordText(!showPasswordText)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                      title={showPasswordText ? 'Sembunyikan Sandi' : 'Tampilkan Sandi'}
                    >
                      {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Sandi akan ditampilkan dengan format rapi dan mudah disalin oleh tamu.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-100 text-xs text-blue-950 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-900 shrink-0 mt-0.5" />
                <span>
                  <strong>Tips Operasional:</strong> Gunakan kata sandi yang mudah dibaca tanpa simbol rumit agar pelanggan tidak kesulitan saat mengetikkan di ponsel.
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>
                Fasilitas Wi-Fi saat ini <strong>dinonaktifkan</strong>. Info jaringan dan sandi tidak akan tampil di buku menu tamu. Sangat sesuai untuk resto berkonsep <em>dine-and-go</em> atau outlet tanpa hotspot umum.
              </span>
            </div>
          )}
        </div>

        {/* CARD 3: ESTIMASI WAKTU PENYAJIAN DAPUR (OPSI AKTIF / NONAKTIF) */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-start gap-3.5">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black border transition-all ${
                showEstimatedTime 
                  ? 'bg-amber-50 border-amber-200 text-amber-900' 
                  : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}>
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-slate-900">
                    Estimasi Waktu Penyajian Dapur
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                      showEstimatedTime
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {showEstimatedTime ? 'Aktif di Buku Menu' : 'Nonaktif (Disembunyikan)'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 max-w-xl">
                  Tampilkan perkiraan durasi pembuatan pesanan agar tamu memiliki ekspektasi waktu tunggu yang jelas.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowEstimatedTime(!showEstimatedTime)}
              className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden self-start sm:self-auto ${
                showEstimatedTime ? 'bg-blue-900' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  showEstimatedTime ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {showEstimatedTime ? (
            <div className="space-y-4">
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">
                  Pilih Preset Waktu atau Masukkan Durasi (Menit)
                </label>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-2">
                  {[10, 15, 20, 30, 45].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setEstimatedPrepMinutes(preset)}
                      className={`h-9 px-3.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        estimatedPrepMinutes === preset
                          ? 'bg-blue-900 text-white border-blue-900 shadow-sm shadow-blue-950/20'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {preset} Menit {preset === 15 ? '(Standar F&B)' : ''}
                    </button>
                  ))}
                </div>

                {/* Custom Number Input */}
                <div className="flex items-center gap-3 pt-2">
                  <div className="relative w-32">
                    <input
                      type="number"
                      min={5}
                      max={120}
                      required={showEstimatedTime}
                      value={estimatedPrepMinutes}
                      onChange={(e) => setEstimatedPrepMinutes(Number(e.target.value))}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-black text-center text-blue-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 transition-all shadow-2xs"
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-600">Menit Perkiraan Saji</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-100 text-xs text-amber-950 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
                <span>
                  <strong>Rekomendasi F&B:</strong> Rentang waktu 10 s.d 20 menit adalah angka optimal untuk coffee shop dan casual dining agar tidak memicu kekhawatiran waktu tunggu yang terlalu lama bagi pelanggan baru.
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>
                Estimasi waktu saji saat ini <strong>dinonaktifkan</strong>. Tamu tidak akan melihat ikon jam atau estimasi menit pada buku menu. Sangat cocok untuk restoran <em>fine dining</em>, pesanan katering, atau dapur dengan fluktuasi waktu yang tinggi.
              </span>
            </div>
          )}
        </div>

        {/* CARD 4: KEBIJAKAN METODE PEMBAYARAN */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-900" />
              <span>Kebijakan Pembayaran Tamu</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Atur bagaimana tamu menyelesaikan pembayaran setelah mengirimkan pesanan dari meja.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Opsi 1: Bayar di Kasir (Aktif) */}
            <div className="p-5 rounded-2xl border-2 border-blue-900 bg-blue-50/40 relative shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <div className="inline-flex items-center gap-1.5 text-xs font-black text-blue-900">
                  <CheckCircle2 className="w-4 h-4 text-blue-900" />
                  <span>METODE AKTIF (DEFAULT)</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 font-extrabold text-[10px]">
                  F&B Standard
                </span>
              </div>
              <h3 className="font-black text-slate-900 text-sm">Bayar di Kasir (Pay at Cashier)</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Tamu leluasa memilih menu dari meja, pesanan otomatis masuk ke terminal kasir dengan status belum lunas (UNPAID). Tamu menyelesaikan pembayaran ke kasir sebelum pulang.
              </p>
            </div>

            {/* Opsi 2: QRIS Otomatis (Segera Hadir) */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 relative opacity-75">
              <div className="flex items-center justify-between mb-2">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>INTEGRASI OTOMATIS</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-extrabold text-[10px]">
                  Segera Hadir
                </span>
              </div>
              <h3 className="font-bold text-slate-700 text-sm">QRIS Dinamis &amp; E-Wallet Mandiri</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Tamu langsung membayar dari HP melalui QRIS otomatis atau e-wallet sebelum tiket pesanan dicetak ke dapur.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-900 shrink-0 mt-0.5" />
            <span>
              Sistem telah terhubung dengan terminal kasir POS. Setiap kali pelanggan mengirimkan pesanan dari meja, kasir akan menerima notifikasi tiket meja baru untuk diproses dan dicetak.
            </span>
          </div>
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
          <p className="text-xs text-slate-400">
            Perubahan konfigurasi akan langsung aktif pada saat tamu memuat buku menu di meja.
          </p>

          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto h-11 sm:h-10 px-6 sm:px-8 bg-blue-900 hover:bg-blue-950 disabled:bg-slate-400 text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-blue-950/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Menyimpan Pengaturan...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Simpan Pengaturan Buku Menu</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
