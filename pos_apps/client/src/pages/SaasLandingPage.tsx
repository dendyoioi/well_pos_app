import React, { useState, useEffect } from 'react';
import {
  Store,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  LogIn,
  Receipt,
  Boxes,
  BarChart3,
  ChevronRight,
  Laptop,
  Smartphone,
} from 'lucide-react';
import { api } from '../services/api';
import { formatIndonesianWhatsApp, validateIndonesianWhatsApp } from '../utils/phone';
import { Modal, Input, WhatsAppInput } from '../components/ui';

interface SaasLandingPageProps {
  onOpenPos: () => void;
  onOpenSuperadmin?: () => void;
}

export const SaasLandingPage: React.FC<SaasLandingPageProps> = ({
  onOpenPos,
}) => {
  const [activeDevice, setActiveDevice] = useState<'laptop' | 'phone' | 'both'>(() => {
    return typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'both' : 'laptop';
  });

  // Modal Registration State (5 Fields for Owner Account Only)
  const [registerModalOpen, setRegisterModalOpen] = useState(() => {
    return window.location.hash.toLowerCase() === '#register';
  });
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const [registerSuccessData, setRegisterSuccessData] = useState<{
    ownerName: string;
    email: string;
    phone: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Listen to hash change for #register deep-linking
  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash.toLowerCase() === '#register') {
        setRegisterSuccessData(null);
        setRegisterModalOpen(true);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!regFirstName.trim()) {
      setError('Nama depan wajib diisi.');
      return;
    }

    if (regPassword.length < 6) {
      setError('Kata sandi minimal 6 karakter.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    const phoneValidation = validateIndonesianWhatsApp(regPhone);
    if (!phoneValidation.isValid) {
      setError(phoneValidation.message || 'Nomor WhatsApp tidak valid. Masukkan nomor HP aktif diawali 08 atau 62 (contoh: 08123456789).');
      return;
    }

    const formattedPhone = formatIndonesianWhatsApp(regPhone);

    setLoading(true);

    try {
      const res = await api.saasRegister({
        firstName: regFirstName.trim(),
        lastName: regLastName.trim(),
        phone: formattedPhone,
        email: regEmail.trim(),
        password: regPassword,
        confirmPassword: regConfirmPassword,
      });

      if (res.status === 'success') {
        setRegisterSuccessData({
          ownerName: `${regFirstName.trim()} ${regLastName.trim()}`.trim(),
          email: regEmail.trim(),
          phone: formattedPhone,
        });
      } else {
        setError(res.message || 'Pendaftaran akun gagal. Mohon periksa kembali isian Anda.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem saat menghubungi server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gradient-to-b from-[#090d16] via-[#10244c] via-45% to-white text-slate-900 selection:bg-blue-600 selection:text-white">
      {/* =========================================================================
          TOP NAVIGATION BAR
      ========================================================================= */}
      <nav className="sticky top-0 z-40 bg-[#090d16]/85 backdrop-blur-md border-b border-white/10 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          {/* Logo & Brand Identity */}
          <a href="#" className="flex items-center gap-3 group">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30 group-hover:scale-105 transition-transform shrink-0">
              <Store className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-lg sm:text-xl font-black tracking-tight text-white block leading-tight">
                Well POS
              </span>
              <span className="text-[11px] text-slate-300 font-medium hidden sm:block">
                Aplikasi Kasir &amp; Manajemen Toko
              </span>
            </div>
          </a>

          {/* Action CTAs (Uniform Buttons) */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onOpenPos}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl font-bold text-xs sm:text-sm bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-all active:scale-[0.98] cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-200" />
              <span>Masuk</span>
            </button>
            <button
              onClick={() => {
                setRegisterSuccessData(null);
                setRegisterModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 rounded-xl font-bold text-xs sm:text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all active:scale-[0.98] cursor-pointer"
            >
              <span>Daftar Gratis</span>
            </button>
          </div>
        </div>
      </nav>

      {/* =========================================================================
          HERO SECTION (Gradasi Hitam -> Biru)
      ========================================================================= */}
      <main className="flex-1 flex flex-col justify-center relative pt-12 pb-16 sm:pt-20 sm:pb-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge Pengantar */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-blue-200 text-xs sm:text-sm font-semibold mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Sistem Kasir Praktis &bull; Siap Pakai untuk Semua Jenis Usaha</span>
          </div>

          {/* Headline Utama */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.2] max-w-4xl mx-auto">
            Kelola Penjualan, Stok, dan Laporan Usaha Jadi Lebih Rapi.
          </h1>

          {/* Subtitle Sederhana & Tidak Berbelit */}
          <p className="mt-5 sm:mt-6 text-sm sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
            Aplikasi kasir yang dirancang praktis untuk operasional harian toko Anda — mulai dari transaksi penjualan cepat, kontrol stok bahan &amp; barang, hingga pencatatan keuntungan yang jelas.
          </p>

          {/* CTA Buttons (Uniform) */}
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md sm:max-w-none mx-auto">
            <button
              onClick={() => {
                setRegisterSuccessData(null);
                setRegisterModalOpen(true);
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/35 transition-all active:scale-[0.98] cursor-pointer"
            >
              <span>Daftar Akun Baru</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenPos}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3 rounded-xl font-bold text-sm bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-all active:scale-[0.98] cursor-pointer"
            >
              <LogIn className="w-4 h-4 text-slate-200" />
              <span>Masuk ke Kasir</span>
            </button>
          </div>

          {/* =========================================================================
              SHOWCASE DEVICE PREVIEW (PORTAL PEMILIK LAPTOP & HALAMAN KASIR HP)
          ========================================================================= */}
          <div className="mt-14 sm:mt-20 max-w-6xl mx-auto">
            {/* Toggle Segmented Control (Uniform Styling) */}
            <div className="inline-flex p-1 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 gap-1 mb-8 shadow-xl">
              <button
                type="button"
                onClick={() => setActiveDevice('laptop')}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeDevice === 'laptop'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Laptop className="w-4 h-4" />
                <span>Portal Pemilik (Laptop)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveDevice('phone')}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeDevice === 'phone'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Halaman Kasir (HP)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveDevice('both')}
                className={`hidden lg:flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeDevice === 'both'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>Tampilkan Keduanya</span>
              </button>
            </div>

            {/* Display Containers */}
            {activeDevice === 'both' ? (
              <div className="hidden lg:grid grid-cols-12 gap-8 items-start text-left">
                <div className="col-span-7">
                  {/* Laptop Mockup */}
                  <div className="w-full bg-slate-900 rounded-3xl border border-slate-700/80 shadow-2xl overflow-hidden">
                    <div className="bg-slate-950/90 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-slate-900 border border-slate-800 text-[11px] text-slate-400 font-mono">
                        <span>🔒 app.wellpos.id/backoffice</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-semibold">Portal Pemilik</div>
                    </div>
                    <div className="bg-slate-50 p-4 sm:p-5 flex flex-col gap-3.5 text-slate-800">
                      <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-900 text-white flex items-center justify-center font-bold">
                            <Store className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-xs sm:text-sm text-blue-950">Ura Coffee - UMS</span>
                              <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded font-bold">Online</span>
                            </div>
                            <span className="text-[10px] text-slate-500">Cabang Sukoharjo &bull; Multi-Outlet</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-600 hidden sm:inline">Owner: Dendy</span>
                          <div className="w-7 h-7 rounded-full bg-blue-900 text-white text-[11px] font-bold flex items-center justify-center">DA</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                          <span className="text-[10px] font-semibold text-slate-500 block">Omzet Hari Ini</span>
                          <span className="text-sm sm:text-base font-black text-slate-900">Rp 4.250.000</span>
                          <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">&uarr; +18.5%</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                          <span className="text-[10px] font-semibold text-slate-500 block">Total Transaksi</span>
                          <span className="text-sm sm:text-base font-black text-slate-900">54 Struk</span>
                          <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Rata-rata 78rb/struk</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                          <span className="text-[10px] font-semibold text-slate-500 block">Laba Kotor (HPP)</span>
                          <span className="text-sm sm:text-base font-black text-slate-900">Rp 2.480.000</span>
                          <span className="text-[10px] text-blue-600 font-bold block mt-0.5">Margin 58%</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                          <span className="text-[10px] font-semibold text-slate-500 block">Status Stok</span>
                          <span className="text-sm sm:text-base font-black text-emerald-700">Aman</span>
                          <span className="text-[10px] text-slate-500 font-medium block mt-0.5">0 Bahan Kritis</span>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs">
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 text-xs font-bold text-slate-800">
                          <span>Aktivitas Transaksi Masuk (Real-Time)</span>
                          <span className="text-[10px] text-blue-600 font-semibold">Live Feed</span>
                        </div>
                        <div className="space-y-1.5 text-[11px]">
                          <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50/80">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-700">INV-1054</span>
                              <span className="text-slate-500">Meja 04 &bull; Kopi Aren Ori (2) + Croissant</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">Rp 48.000</span>
                              <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">QRIS</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50/80">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-700">INV-1053</span>
                              <span className="text-slate-500">Take Away &bull; Caffe Latte + Toast</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">Rp 36.000</span>
                              <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">TUNAI</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-span-5 flex justify-center">
                  {/* Phone Mockup */}
                  <div className="w-full max-w-[320px] bg-slate-950 rounded-[2.5rem] border-[7px] border-slate-800 shadow-2xl overflow-hidden text-left relative">
                    <div className="bg-slate-950 pt-2 pb-1 px-5 flex items-center justify-between text-white text-[11px] font-semibold">
                      <span>20:00</span>
                      <div className="w-16 h-3 bg-black rounded-full mx-auto" />
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <span className="text-[9px] font-bold">5G</span>
                      </div>
                    </div>

                    <div className="bg-blue-950 text-white p-3 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-black leading-tight">Ura Coffee - UMS</h4>
                        <div className="flex items-center gap-1.5 text-[10px] text-blue-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>Meja 04 &bull; Kasir Budi</span>
                        </div>
                      </div>
                      <span className="text-[10px] bg-blue-900 text-blue-100 px-2 py-0.5 rounded font-bold border border-blue-800">
                        Dine In
                      </span>
                    </div>

                    <div className="bg-slate-900 px-2.5 py-1.5 flex items-center gap-1.5 overflow-x-auto text-[10px] no-scrollbar">
                      <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white font-bold shrink-0">Semua (12)</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium shrink-0">Coffee (6)</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium shrink-0">Non-Coffee</span>
                    </div>

                    <div className="bg-slate-100 p-2.5 grid grid-cols-2 gap-2 h-72 overflow-y-auto">
                      <div className="bg-white rounded-xl p-2 border border-slate-200/80 flex flex-col justify-between shadow-2xs">
                        <img src="/images/products/kopi-susu.jpg" alt="Kopi Susu Aren" className="w-full h-16 object-cover rounded-lg mb-1" />
                        <div>
                          <p className="font-bold text-[11px] text-slate-800 leading-tight">Kopi Aren Ori</p>
                          <p className="text-[9px] text-slate-400">Coffee</p>
                        </div>
                        <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100">
                          <span className="font-black text-[11px] text-slate-900">13.000</span>
                          <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs">+</span>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl p-2 border border-slate-200/80 flex flex-col justify-between shadow-2xs">
                        <img src="/images/products/latte.jpg" alt="Caffe Latte" className="w-full h-16 object-cover rounded-lg mb-1" />
                        <div>
                          <p className="font-bold text-[11px] text-slate-800 leading-tight">Caffe Latte</p>
                          <p className="text-[9px] text-slate-400">Coffee</p>
                        </div>
                        <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100">
                          <span className="font-black text-[11px] text-slate-900">18.000</span>
                          <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs">+</span>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl p-2 border border-slate-200/80 flex flex-col justify-between shadow-2xs">
                        <img src="/images/products/croissant.jpg" alt="Butter Croissant" className="w-full h-16 object-cover rounded-lg mb-1" />
                        <div>
                          <p className="font-bold text-[11px] text-slate-800 leading-tight">Croissant</p>
                          <p className="text-[9px] text-slate-400">Pastry</p>
                        </div>
                        <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100">
                          <span className="font-black text-[11px] text-slate-900">15.000</span>
                          <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs">+</span>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl p-2 border border-slate-200/80 flex flex-col justify-between shadow-2xs">
                        <img src="/images/products/matcha.jpg" alt="Matcha Latte" className="w-full h-16 object-cover rounded-lg mb-1" />
                        <div>
                          <p className="font-bold text-[11px] text-slate-800 leading-tight">Matcha Ice</p>
                          <p className="text-[9px] text-slate-400">Non-Coffee</p>
                        </div>
                        <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100">
                          <span className="font-black text-[11px] text-slate-900">16.000</span>
                          <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs">+</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border-t border-slate-200 p-2.5 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] text-slate-400 block font-semibold">Keranjang (3 Item)</span>
                        <span className="text-xs font-black text-slate-900">Rp 46.000</span>
                      </div>
                      <div className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm">
                        <span>Bayar &rarr;</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Mode Laptop Only (or fallback on mobile) */}
            {activeDevice === 'laptop' || activeDevice === 'both' ? (
              <div className={activeDevice === 'both' ? 'block lg:hidden text-left' : 'block text-left'}>
                <div className="w-full bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-700/80 shadow-2xl overflow-hidden">
                  <div className="bg-slate-950/90 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-slate-900 border border-slate-800 text-[10px] sm:text-[11px] text-slate-400 font-mono">
                      <span>🔒 app.wellpos.id/backoffice</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-semibold hidden sm:block">Portal Pemilik (Laptop/PC)</div>
                  </div>

                  <div className="bg-slate-50 p-3 sm:p-5 flex flex-col gap-3.5 text-slate-800">
                    <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-900 text-white flex items-center justify-center font-bold shrink-0">
                          <Store className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-xs sm:text-sm text-blue-950">Ura Coffee - UMS</span>
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded font-bold">Online</span>
                          </div>
                          <span className="text-[10px] text-slate-500 block truncate">Cabang Utama Sukoharjo &bull; Multi-Outlet</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-bold text-slate-600 hidden sm:inline">Owner: Dendy</span>
                        <div className="w-7 h-7 rounded-full bg-blue-900 text-white text-[11px] font-bold flex items-center justify-center">DA</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                        <span className="text-[10px] font-semibold text-slate-500 block">Omzet Hari Ini</span>
                        <span className="text-sm sm:text-base font-black text-slate-900">Rp 4.250.000</span>
                        <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">&uarr; +18.5%</span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                        <span className="text-[10px] font-semibold text-slate-500 block">Total Transaksi</span>
                        <span className="text-sm sm:text-base font-black text-slate-900">54 Struk</span>
                        <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Rata-rata 78rb/struk</span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                        <span className="text-[10px] font-semibold text-slate-500 block">Laba Kotor (HPP)</span>
                        <span className="text-sm sm:text-base font-black text-slate-900">Rp 2.480.000</span>
                        <span className="text-[10px] text-blue-600 font-bold block mt-0.5">Margin 58%</span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                        <span className="text-[10px] font-semibold text-slate-500 block">Status Stok</span>
                        <span className="text-sm sm:text-base font-black text-emerald-700">Aman</span>
                        <span className="text-[10px] text-slate-500 font-medium block mt-0.5">0 Bahan Kritis</span>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-xs">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 text-xs font-bold text-slate-800">
                        <span>Aktivitas Transaksi Masuk (Real-Time)</span>
                        <span className="text-[10px] text-blue-600 font-semibold">Live Feed</span>
                      </div>
                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50/80">
                          <div className="flex items-center gap-2 truncate mr-2">
                            <span className="font-mono font-bold text-slate-700 shrink-0">INV-1054</span>
                            <span className="text-slate-500 truncate">Meja 04 &bull; Kopi Aren Ori (2) + Croissant</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-bold text-slate-900">Rp 48.000</span>
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">QRIS</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50/80">
                          <div className="flex items-center gap-2 truncate mr-2">
                            <span className="font-mono font-bold text-slate-700 shrink-0">INV-1053</span>
                            <span className="text-slate-500 truncate">Take Away &bull; Caffe Latte + Toast</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-bold text-slate-900">Rp 36.000</span>
                            <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">TUNAI</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Mode Phone Only */}
            {activeDevice === 'phone' ? (
              <div className="flex justify-center text-left">
                <div className="w-full max-w-[330px] sm:max-w-[350px] bg-slate-950 rounded-[2.5rem] border-[7px] border-slate-800 shadow-2xl overflow-hidden text-left relative">
                  <div className="bg-slate-950 pt-2 pb-1 px-5 flex items-center justify-between text-white text-[11px] font-semibold">
                    <span>20:00</span>
                    <div className="w-16 h-3 bg-black rounded-full mx-auto" />
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <span className="text-[9px] font-bold">5G</span>
                    </div>
                  </div>

                  <div className="bg-blue-950 text-white p-3 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black leading-tight">Ura Coffee - UMS</h4>
                      <div className="flex items-center gap-1.5 text-[10px] text-blue-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>Meja 04 &bull; Kasir Budi</span>
                      </div>
                    </div>
                    <span className="text-[10px] bg-blue-900 text-blue-100 px-2 py-0.5 rounded font-bold border border-blue-800">
                      Dine In
                    </span>
                  </div>

                  <div className="bg-slate-900 px-2.5 py-1.5 flex items-center gap-1.5 overflow-x-auto text-[10px] no-scrollbar">
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white font-bold shrink-0">Semua (12)</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium shrink-0">Coffee (6)</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium shrink-0">Non-Coffee</span>
                  </div>

                  <div className="bg-slate-100 p-2.5 grid grid-cols-2 gap-2 h-72 overflow-y-auto">
                    <div className="bg-white rounded-xl p-2 border border-slate-200/80 flex flex-col justify-between shadow-2xs">
                      <img src="/images/products/kopi-susu.jpg" alt="Kopi Susu Aren" className="w-full h-16 object-cover rounded-lg mb-1" />
                      <div>
                        <p className="font-bold text-[11px] text-slate-800 leading-tight">Kopi Aren Ori</p>
                        <p className="text-[9px] text-slate-400">Coffee</p>
                      </div>
                      <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100">
                        <span className="font-black text-[11px] text-slate-900">13.000</span>
                        <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs">+</span>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-2 border border-slate-200/80 flex flex-col justify-between shadow-2xs">
                      <img src="/images/products/latte.jpg" alt="Caffe Latte" className="w-full h-16 object-cover rounded-lg mb-1" />
                      <div>
                        <p className="font-bold text-[11px] text-slate-800 leading-tight">Caffe Latte</p>
                        <p className="text-[9px] text-slate-400">Coffee</p>
                      </div>
                      <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100">
                        <span className="font-black text-[11px] text-slate-900">18.000</span>
                        <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs">+</span>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-2 border border-slate-200/80 flex flex-col justify-between shadow-2xs">
                      <img src="/images/products/croissant.jpg" alt="Butter Croissant" className="w-full h-16 object-cover rounded-lg mb-1" />
                      <div>
                        <p className="font-bold text-[11px] text-slate-800 leading-tight">Croissant</p>
                        <p className="text-[9px] text-slate-400">Pastry</p>
                      </div>
                      <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100">
                        <span className="font-black text-[11px] text-slate-900">15.000</span>
                        <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs">+</span>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl p-2 border border-slate-200/80 flex flex-col justify-between shadow-2xs">
                      <img src="/images/products/matcha.jpg" alt="Matcha Latte" className="w-full h-16 object-cover rounded-lg mb-1" />
                      <div>
                        <p className="font-bold text-[11px] text-slate-800 leading-tight">Matcha Ice</p>
                        <p className="text-[9px] text-slate-400">Non-Coffee</p>
                      </div>
                      <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100">
                        <span className="font-black text-[11px] text-slate-900">16.000</span>
                        <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs">+</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border-t border-slate-200 p-2.5 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-slate-400 block font-semibold">Keranjang (3 Item)</span>
                      <span className="text-xs font-black text-slate-900">Rp 46.000</span>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm">
                      <span>Bayar &rarr;</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* =========================================================================
            FITUR UTAMA (Latar Belakang Putih Bersih)
        ========================================================================= */}
        <section className="mt-16 sm:mt-24 pt-12 sm:pt-16 pb-16 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                Fitur Lengkap yang Mudah Dijalankan
              </h2>
              <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
                Fokus melayani pelanggan dan mengembangkan bisnis. Biarkan sistem membantu pencatatan operasional Anda.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {/* Card 1 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-4">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-2">
                    Kasir Penjualan Cepat
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Input pesanan dengan cepat, hitung diskon &amp; pajak otomatis, serta cetak nota struk atau kirim bukti via WhatsApp.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-bold text-blue-600 flex items-center gap-1">
                  <span>Mendukung Printer Thermal</span>
                </div>
              </div>

              {/* Card 2 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-4">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-2">
                    Stok &amp; Resep Bahan Baku
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Stok berkurang otomatis saat menu terjual. Cocok untuk toko ritel barang jadi maupun usaha kuliner/F&amp;B berbasis resep.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-bold text-blue-600 flex items-center gap-1">
                  <span>Peringatan Stok Habis</span>
                </div>
              </div>

              {/* Card 3 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-4">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-2">
                    Laporan Usaha Lengkap
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Lihat ringkasan omzet harian, keuntungan kotor (HPP), rekap kas shift kasir, dan daftar produk terlaris tanpa hitung manual.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-bold text-blue-600 flex items-center gap-1">
                  <span>Unduh Format Excel &bull; CSV</span>
                </div>
              </div>

              {/* Card 4 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-4">
                    <Store className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-2">
                    Bisa Banyak Toko &bull; Cabang
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Kelola satu toko atau kembangkan ke banyak cabang dan gudang pasokan dalam satu dashboard akun pemilik yang terintegrasi.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-bold text-blue-600 flex items-center gap-1">
                  <span>Hak Akses Per Karyawan</span>
                </div>
              </div>
            </div>

            {/* 3 Langkah Mudah Memulai */}
            <div className="mt-14 sm:mt-20 pt-10 sm:pt-14 border-t border-slate-100">
              <div className="text-center max-w-xl mx-auto mb-10">
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block mb-1">Langkah Mudah</span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                  Mulai Gunakan dalam 3 Langkah
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 text-center">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-black text-sm flex items-center justify-center mx-auto mb-3">
                    1
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mb-1">Daftar Akun Pemilik</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Cukup masukkan nama, email, dan nomor WhatsApp usaha Anda.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 text-center">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-black text-sm flex items-center justify-center mx-auto mb-3">
                    2
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mb-1">Atur Toko &amp; Produk</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Masukkan nama produk, harga jual, dan stok awal dengan mudah.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 text-center">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-black text-sm flex items-center justify-center mx-auto mb-3">
                    3
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mb-1">Buka Kasir &amp; Mulai Jualan</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Aplikasi kasir langsung siap memproses pesanan dan mencetak struk.
                  </p>
                </div>
              </div>
            </div>

            {/* Banner Penutup Bawah */}
            <div className="mt-14 sm:mt-20 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-2xl sm:rounded-3xl p-6 sm:p-10 text-white text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
              <div>
                <h3 className="text-xl sm:text-2xl font-black mb-2">
                  Siap Merapikan Pencatatan Usaha Anda?
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 max-w-lg leading-relaxed">
                  Gunakan aplikasi kasir modern yang andal, tanpa ribet, dan nyaman dipakai staf toko.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto shrink-0">
                <button
                  onClick={() => {
                    setRegisterSuccessData(null);
                    setRegisterModalOpen(true);
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <span>Daftar Gratis</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={onOpenPos}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <LogIn className="w-4 h-4 text-slate-200" />
                  <span>Masuk Kasir</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* =========================================================================
          FOOTER
      ========================================================================= */}
      <footer className="border-t border-slate-200 bg-slate-50 py-8 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
              <Store className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-slate-800">Well POS</span>
            <span className="text-slate-400">&bull;</span>
            <span>Aplikasi Kasir &amp; Stok Toko</span>
          </div>
          <div>
            &copy; {new Date().getFullYear()} Well POS. Seluruh hak cipta dilindungi.
          </div>
        </div>
      </footer>

      {/* =========================================================================
          REGISTRATION MODAL
      ========================================================================= */}
      <Modal
        isOpen={registerModalOpen}
        onClose={() => setRegisterModalOpen(false)}
        title={registerSuccessData ? 'Pendaftaran Akun Berhasil!' : 'Daftar Akun Pemilik (Owner)'}
        subtitle={
          registerSuccessData
            ? 'Akun pemilik Anda telah tercatat dan sedang menunggu verifikasi Super Admin.'
            : 'Buat akun pemilik bisnis. Toko/outlet Anda akan dikonfigurasi setelah akun disetujui.'
        }
        size="md"
      >
        {registerSuccessData ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-base font-black text-slate-900">
                Pendaftaran Berhasil, {registerSuccessData.ownerName}!
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Akun pemilik bisnis Anda telah berhasil didaftarkan dan sedang menunggu persetujuan Super Admin.
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left text-xs space-y-1.5">
              <p className="text-slate-500">Email Akun: <strong className="text-slate-900">{registerSuccessData.email}</strong></p>
              <p className="text-slate-500">Nomor WhatsApp: <strong className="text-slate-900">{registerSuccessData.phone}</strong></p>
              <p className="text-slate-500">Status Akun: <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">Menunggu Approval Super Admin</span></p>
            </div>
            <p className="text-[11px] text-slate-400">
              Setelah disetujui Super Admin, Anda dapat masuk dan membuat toko/outlet pertama Anda langsung dari dashboard.
            </p>
            <button
              onClick={() => {
                setRegisterModalOpen(false);
                onOpenPos();
              }}
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all cursor-pointer"
            >
              <span>Lanjut ke Halaman Masuk</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* 1. Nama Pemilik (Nama Depan & Nama Belakang) */}
            <div>
              <label className="block text-xs font-extrabold text-slate-800 mb-1.5">
                Nama Pemilik (Owner) <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Nama Depan"
                  value={regFirstName}
                  onChange={(e) => setRegFirstName(e.target.value)}
                  required
                />
                <Input
                  placeholder="Nama Belakang"
                  value={regLastName}
                  onChange={(e) => setRegLastName(e.target.value)}
                />
              </div>
            </div>

            {/* 2. Nomor HP / WhatsApp */}
            <WhatsAppInput
              label="Nomor HP / WhatsApp"
              value={regPhone}
              onChange={(val) => {
                setRegPhone(val);
                setError(null);
              }}
              required
            />

            {/* 3. Email */}
            <Input
              label="Alamat Email"
              type="email"
              placeholder="owner@bisnis.id"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              required
            />

            {/* 4. Kata Sandi */}
            <Input
              label="Kata Sandi"
              type="password"
              placeholder="Minimal 6 karakter"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              required
            />

            {/* 5. Konfirmasi Kata Sandi */}
            <Input
              label="Konfirmasi Kata Sandi"
              type="password"
              placeholder="Ulangi kata sandi"
              value={regConfirmPassword}
              onChange={(e) => setRegConfirmPassword(e.target.value)}
              required
            />

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Memproses Pendaftaran...' : 'Daftar Akun Pemilik'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default SaasLandingPage;
