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
  QrCode,
  RefreshCw,
  Sparkles,
  ShieldCheck,
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

  // Konfigurasi dinamis biaya pendaftaran & bonus token dari platform
  const [platformConfig, setPlatformConfig] = useState({
    registrationFee: 99000,
    registrationBonusTokens: 100,
  });

  // State Voucher Promo Pendaftaran
  const [showPromoField, setShowPromoField] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any | null>(null);
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  const [registerSuccessData, setRegisterSuccessData] = useState<{
    ownerName: string;
    email: string;
    phone: string;
    finalAmount?: number;
    bonusTokens?: number;
    promoCode?: string;
    payment?: {
      invoiceNumber: string;
      amount: number;
      discountAmount: number;
      bonusTokens: number;
      isFree: boolean;
      qrString?: string;
      paymentUrl?: string;
      expiredAt?: string;
      isSandbox?: boolean;
    };
  } | null>(null);

  const [paymentPaid, setPaymentPaid] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [simulatingPayment, setSimulatingPayment] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Polling status pembayaran Pakasir jika transaksi UNPAID
  useEffect(() => {
    if (!registerSuccessData?.payment || registerSuccessData.payment.isFree || paymentPaid) {
      return;
    }

    const invoiceNum = registerSuccessData.payment.invoiceNumber;
    let isMounted = true;

    const interval = setInterval(async () => {
      try {
        const res = await api.checkPakasirInvoiceStatus(invoiceNum);
        if (res.status === 'success' && res.data?.status === 'PAID') {
          if (isMounted) {
            setPaymentPaid(true);
          }
        }
      } catch (e) {
        // Silently catch polling error
      }
    }, 3500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [registerSuccessData, paymentPaid]);

  const handleCheckPaymentStatus = async () => {
    if (!registerSuccessData?.payment?.invoiceNumber) return;
    setCheckingPayment(true);
    try {
      const res = await api.checkPakasirInvoiceStatus(registerSuccessData.payment.invoiceNumber);
      if (res.status === 'success' && res.data?.status === 'PAID') {
        setPaymentPaid(true);
      }
    } catch (err: any) {
      console.error('Gagal mengecek status pembayaran:', err);
    } finally {
      setCheckingPayment(false);
    }
  };

  const handleSimulateSandboxPayment = async () => {
    if (!registerSuccessData?.payment?.invoiceNumber) return;
    setSimulatingPayment(true);
    try {
      const res = await api.simulatePakasirSandboxPayment(registerSuccessData.payment.invoiceNumber);
      if (res.status === 'success') {
        setPaymentPaid(true);
      }
    } catch (err: any) {
      console.error('Gagal simulasi sandbox:', err);
    } finally {
      setSimulatingPayment(false);
    }
  };

  // Fetch konfigurasi publik platform saat halaman dimuat
  useEffect(() => {
    api.getPublicPlatformConfig().then((res) => {
      if (res.status === 'success' && res.data) {
        setPlatformConfig({
          registrationFee: typeof res.data.registrationFee === 'number' ? res.data.registrationFee : 99000,
          registrationBonusTokens: typeof res.data.registrationBonusTokens === 'number' ? res.data.registrationBonusTokens : 100,
        });
      }
    }).catch((err) => console.error('Gagal mengambil info konfigurasi platform:', err));
  }, []);

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

  const handleApplyRegistrationPromo = async () => {
    if (!promoInput.trim()) return;
    setPromoError(null);
    setValidatingPromo(true);
    try {
      const res = await api.validateRegistrationPromo(promoInput.trim());
      if (res.status === 'success' && res.data) {
        setAppliedPromo(res.data);
      } else {
        setPromoError(res.message || 'Kupon promo tidak dapat digunakan');
        setAppliedPromo(null);
      }
    } catch (err: any) {
      setPromoError(err.message || 'Gagal memeriksa kupon promo');
      setAppliedPromo(null);
    } finally {
      setValidatingPromo(false);
    }
  };

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
        promoCode: appliedPromo?.code,
      });

      if (res.status === 'success') {
        const paymentInfo = res.data?.payment;
        const isFree = paymentInfo ? paymentInfo.isFree : (appliedPromo ? appliedPromo.isFree : false);
        setRegisterSuccessData({
          ownerName: `${regFirstName.trim()} ${regLastName.trim()}`.trim(),
          email: regEmail.trim(),
          phone: formattedPhone,
          finalAmount: paymentInfo ? paymentInfo.amount : (appliedPromo ? appliedPromo.finalAmount : platformConfig.registrationFee),
          bonusTokens: paymentInfo ? paymentInfo.bonusTokens : (appliedPromo ? appliedPromo.totalBonusTokens : platformConfig.registrationBonusTokens),
          promoCode: appliedPromo?.code,
          payment: paymentInfo,
        });
        setPaymentPaid(Boolean(isFree));
        setRegisterModalOpen(true);
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
    <div className="min-h-screen w-full max-w-full overflow-x-hidden flex flex-col font-sans bg-gradient-to-b from-[#090d16] via-[#10244c] via-45% to-white text-slate-900 selection:bg-blue-600 selection:text-white">
      {/* =========================================================================
          TOP NAVIGATION BAR
      ========================================================================= */}
      <nav className="sticky top-0 z-40 w-full bg-[#090d16]/85 backdrop-blur-md border-b border-white/10 text-white">
        <div className="max-w-6xl mx-auto px-3.5 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2">
          {/* Logo & Brand Identity */}
          <a href="#" className="flex items-center gap-2.5 sm:gap-3 group min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30 group-hover:scale-105 transition-transform shrink-0">
              <Store className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <span className="text-base sm:text-xl font-black tracking-tight text-white block leading-tight truncate">
                Well POS
              </span>
              <span className="text-[10px] sm:text-[11px] text-slate-300 font-medium hidden sm:block truncate">
                Aplikasi Kasir &amp; Manajemen Toko
              </span>
            </div>
          </a>

          {/* Action CTAs (Uniform Buttons) */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              onClick={onOpenPos}
              className="inline-flex items-center justify-center gap-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-bold text-xs sm:text-sm bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-all active:scale-[0.98] cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-200" />
              <span>Masuk</span>
            </button>
            <button
              onClick={() => {
                setRegisterSuccessData(null);
                setRegisterModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-1 px-3 sm:px-5 py-1.5 sm:py-2 rounded-xl font-bold text-xs sm:text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all active:scale-[0.98] cursor-pointer"
            >
              <span>Daftar Gratis</span>
            </button>
          </div>
        </div>
      </nav>

      {/* =========================================================================
          HERO SECTION (Gradasi Hitam -> Biru)
      ========================================================================= */}
      <main className="flex-1 w-full max-w-full overflow-x-hidden flex flex-col justify-center relative pt-10 pb-16 sm:pt-20 sm:pb-24">
        <div className="max-w-5xl mx-auto px-3.5 sm:px-6 lg:px-8 text-center w-full">
          {/* Badge Pengantar */}
          <div className="inline-flex items-center gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-white/10 border border-white/15 text-blue-200 text-xs sm:text-sm font-semibold mb-5 sm:mb-6 max-w-full truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="truncate">Sistem Kasir Praktis &bull; Siap Pakai untuk Semua Usaha</span>
          </div>

          {/* Headline Utama */}
          <h1 className="text-2xl xs:text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.2] max-w-4xl mx-auto">
            Kelola Penjualan, Stok, dan Laporan Usaha Jadi Lebih Rapi.
          </h1>

          {/* Subtitle Sederhana & Tidak Berbelit */}
          <p className="mt-4 sm:mt-6 text-xs xs:text-sm sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
            Aplikasi kasir yang dirancang praktis untuk operasional harian toko Anda — mulai dari transaksi penjualan cepat, kontrol stok bahan &amp; barang, hingga pencatatan keuntungan yang jelas.
          </p>

          {/* CTA Buttons (Uniform) */}
          <div className="mt-7 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-4 max-w-md sm:max-w-none mx-auto w-full">
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
          <div className="mt-12 sm:mt-20 max-w-6xl mx-auto w-full">
            {/* Toggle Segmented Control (Uniform Styling, 100% Mobile Safe) */}
            <div className="w-full max-w-xs sm:max-w-md mx-auto p-1 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 grid grid-cols-2 lg:inline-flex lg:w-auto gap-1 mb-6 sm:mb-8 shadow-xl">
              <button
                type="button"
                onClick={() => setActiveDevice('laptop')}
                className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeDevice === 'laptop'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Laptop className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">Portal Pemilik</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveDevice('phone')}
                className={`flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeDevice === 'phone'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">Halaman Kasir</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveDevice('both')}
                className={`hidden lg:flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
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

                    <div className="bg-white rounded-xl border border-slate-200/80 p-2.5 sm:p-3 shadow-xs">
                      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 text-xs font-bold text-slate-800">
                        <span>Aktivitas Transaksi (Real-Time)</span>
                        <span className="text-[10px] text-blue-600 font-semibold">Live Feed</span>
                      </div>
                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between gap-1.5 p-1.5 rounded-lg bg-slate-50/80">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="font-mono font-bold text-slate-700 shrink-0 text-[10px] sm:text-[11px]">INV-1054</span>
                            <span className="text-slate-500 truncate text-[10px] sm:text-[11px]">Meja 04 &bull; Kopi Aren Ori</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-bold text-slate-900 text-[10px] sm:text-[11px]">Rp 48.000</span>
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">QRIS</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-1.5 p-1.5 rounded-lg bg-slate-50/80">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="font-mono font-bold text-slate-700 shrink-0 text-[10px] sm:text-[11px]">INV-1053</span>
                            <span className="text-slate-500 truncate text-[10px] sm:text-[11px]">Take Away &bull; Caffe Latte</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="font-bold text-slate-900 text-[10px] sm:text-[11px]">Rp 36.000</span>
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
        onClose={() => {
          setRegisterModalOpen(false);
          if (paymentPaid) {
            setRegisterSuccessData(null);
            setPaymentPaid(false);
          }
        }}
        title={
          registerSuccessData
            ? paymentPaid || registerSuccessData.finalAmount === 0
              ? 'Aktivasi Akun Berhasil!'
              : 'Selesaikan Pembayaran QRIS'
            : 'Daftar Akun Pemilik (Owner)'
        }
        subtitle={
          registerSuccessData
            ? paymentPaid || registerSuccessData.finalAmount === 0
              ? 'Akun pemilik bisnis dan kuota token transaksi Anda telah aktif.'
              : 'Pindai kode QRIS di bawah ini untuk menyelesaikan aktivasi pendaftaran akun Anda.'
            : 'Buat akun pemilik bisnis. Toko/outlet Anda akan dikonfigurasi setelah akun disetujui.'
        }
        size={registerSuccessData && !paymentPaid && (registerSuccessData.finalAmount ?? 0) > 0 ? 'lg' : 'md'}
      >
        {registerSuccessData ? (
          paymentPaid || registerSuccessData.finalAmount === 0 ? (
            /* =========================================================
               TAMPILAN 1: SUKSES AKTIVASI (LUNAS / GRATIS)
               ========================================================= */
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-900">
                  Selamat Datang, {registerSuccessData.ownerName}!
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {registerSuccessData.finalAmount === 0
                    ? 'Pendaftaran akun gratis Anda telah aktif dan siap digunakan.'
                    : 'Pembayaran berhasil dikonfirmasi via QRIS Pakasir. Akun pemilik dan kuota token Anda telah aktif.'}
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left text-xs space-y-2.5">
                <div className="flex justify-between items-center text-slate-500">
                  <span>Email Akun:</span>
                  <strong className="text-slate-900 font-mono">{registerSuccessData.email}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>Nomor WhatsApp:</span>
                  <strong className="text-slate-900">{registerSuccessData.phone}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>Biaya Aktivasi:</span>
                  <strong className={registerSuccessData.finalAmount === 0 ? 'text-emerald-600 font-bold' : 'text-slate-900'}>
                    {registerSuccessData.finalAmount === 0 ? 'GRATIS (Rp 0)' : `Rp ${registerSuccessData.finalAmount?.toLocaleString('id-ID')}`}
                  </strong>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>Status Pembayaran:</span>
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Lunas (PAID)
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>Bonus Token Transaksi:</span>
                  <strong className="text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200 font-bold">
                    +{registerSuccessData.bonusTokens || 100} Token Aktif
                  </strong>
                </div>
                {registerSuccessData.promoCode && (
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Kupon Promo:</span>
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {registerSuccessData.promoCode}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-slate-500">
                  <span>Status Akun:</span>
                  <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Aktif &amp; Terverifikasi
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Anda sekarang dapat langsung masuk ke aplikasi untuk mulai mengatur toko, outlet, dan katalog menu Anda.
              </p>
              <button
                onClick={() => {
                  setRegisterModalOpen(false);
                  setRegisterSuccessData(null);
                  setPaymentPaid(false);
                  onOpenPos();
                }}
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all cursor-pointer"
              >
                <span>Masuk ke Backoffice / Kasir</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* =========================================================
               TAMPILAN 2: QRIS PAKASIR UNTUK PEMBAYARAN REGISTRASI
               ========================================================= */
            <div className="py-2 space-y-4 text-center">
              {/* Header Box Total Bayar */}
              <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-2xl p-4 text-center shadow-sm">
                <div className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full text-[11px] font-semibold text-blue-200 mb-2">
                  <QrCode className="w-3.5 h-3.5" />
                  <span>QRIS Otomatis Pakasir</span>
                </div>
                <div className="text-xs text-blue-200 font-medium">Total Biaya Aktivasi Akun</div>
                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5">
                  Rp {registerSuccessData.finalAmount?.toLocaleString('id-ID')}
                </div>
                {registerSuccessData.payment?.invoiceNumber && (
                  <div className="text-[11px] text-blue-300 font-mono mt-1">
                    Invoice: {registerSuccessData.payment.invoiceNumber}
                  </div>
                )}
              </div>

              {/* Dynamic QR Code Card */}
              <div className="flex flex-col items-center justify-center p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
                {registerSuccessData.payment?.qrString ? (
                  <div className="p-3 bg-white border-2 border-slate-900 rounded-2xl shadow-sm inline-block">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(registerSuccessData.payment.qrString)}`}
                      alt="QRIS Pembayaran Pakasir"
                      className="w-48 h-48 sm:w-52 sm:h-52 object-contain mx-auto"
                    />
                  </div>
                ) : (
                  <div className="w-48 h-48 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-xs">
                    Membuat kode QRIS...
                  </div>
                )}

                {/* Real-time Waiting Pulse */}
                <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  <span>Menunggu pembayaran via QRIS...</span>
                </div>

                <p className="text-[11px] text-slate-500 mt-2 max-w-xs leading-relaxed">
                  Pindai QR di atas menggunakan aplikasi <strong>BCA, Mandiri, BRI, BNI, GoPay, OVO, Dana, ShopeePay</strong>, atau mobile banking lainnya.
                </p>
              </div>

              {/* Rincian Singkat Akun */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left text-xs space-y-1.5">
                <div className="flex justify-between items-center text-slate-500">
                  <span>Nama Pemilik:</span>
                  <strong className="text-slate-900">{registerSuccessData.ownerName}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>Email Login:</span>
                  <strong className="text-slate-900 font-mono">{registerSuccessData.email}</strong>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>Bonus Token Setelah Lunas:</span>
                  <strong className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-bold">
                    +{registerSuccessData.bonusTokens || 100} Token Transaksi
                  </strong>
                </div>
                {registerSuccessData.promoCode && (
                  <div className="flex justify-between items-center text-slate-500">
                    <span>Kupon Terpasang:</span>
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {registerSuccessData.promoCode}
                    </span>
                  </div>
                )}
              </div>

              {/* Tombol Aksi: Cek Status & Sandbox Pay */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleCheckPaymentStatus}
                  disabled={checkingPayment}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white shadow transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checkingPayment ? 'animate-spin' : ''}`} />
                  <span>{checkingPayment ? 'Mengecek Status Pembayaran...' : 'Cek Status Pembayaran Sekarang'}</span>
                </button>

                {registerSuccessData.payment?.isSandbox && (
                  <button
                    type="button"
                    onClick={handleSimulateSandboxPayment}
                    disabled={simulatingPayment}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 transition-all cursor-pointer border border-amber-400 shadow-sm disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{simulatingPayment ? 'Memproses Simulasi...' : '⚡ Simulasikan Pembayaran Berhasil (Uji Coba Sandbox)'}</span>
                  </button>
                )}
              </div>
            </div>
          )
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

            {/* 6. Ringkasan Biaya Registrasi & Kupon Promo */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Biaya Aktivasi Pendaftaran:</span>
                <span className="font-bold text-slate-900">
                  {appliedPromo ? (
                    <span className="flex items-center gap-1.5">
                      <span className="line-through text-slate-400">
                        {platformConfig.registrationFee === 0 ? 'Gratis' : `Rp ${platformConfig.registrationFee.toLocaleString('id-ID')}`}
                      </span>
                      <span className="text-emerald-600 font-black">
                        {appliedPromo.finalAmount === 0 ? 'GRATIS (Rp 0)' : `Rp ${appliedPromo.finalAmount.toLocaleString('id-ID')}`}
                      </span>
                    </span>
                  ) : platformConfig.registrationFee === 0 ? (
                    <span className="text-emerald-600 font-black">GRATIS (Rp 0)</span>
                  ) : (
                    `Rp ${platformConfig.registrationFee.toLocaleString('id-ID')}`
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Bonus Kuota Transaksi Awal:</span>
                <span className="font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                  +{appliedPromo ? appliedPromo.totalBonusTokens : platformConfig.registrationBonusTokens} Token Siap Pakai
                </span>
              </div>

              {/* Input Kupon Promo */}
              <div className="pt-2 border-t border-slate-200/80">
                {!showPromoField && !appliedPromo ? (
                  <button
                    type="button"
                    onClick={() => setShowPromoField(true)}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>+ Punya Kode Voucher Promo?</span>
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-extrabold text-slate-700">
                      Kode Voucher Promo Pendaftaran
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Contoh: MERDEKA100"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                        disabled={Boolean(appliedPromo)}
                        className="flex-1 uppercase font-mono text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100 disabled:text-slate-500"
                      />
                      {appliedPromo ? (
                        <button
                          type="button"
                          onClick={() => {
                            setAppliedPromo(null);
                            setPromoInput('');
                            setPromoError(null);
                          }}
                          className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                        >
                          Hapus
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={validatingPromo || !promoInput.trim()}
                          onClick={handleApplyRegistrationPromo}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {validatingPromo ? 'Cek...' : 'Terapkan'}
                        </button>
                      )}
                    </div>
                    {appliedPromo && (
                      <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Kupon &quot;{appliedPromo.code}&quot; aktif: {appliedPromo.name}</span>
                      </p>
                    )}
                    {promoError && (
                      <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{promoError}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

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
