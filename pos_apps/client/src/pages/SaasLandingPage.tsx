import React, { useState, useEffect } from 'react';
import {
  Store,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  LogIn,
  Receipt,
  Boxes,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Tablet,
  QrCode,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  CreditCard,
  MessageCircle,
  Coins,
  Percent,
  Gift,
  UserCheck,
  Printer,
  Check,
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
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

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
              <span>Daftar Sekarang</span>
            </button>
          </div>
        </div>
      </nav>

      {/* =========================================================================
          HERO SECTION (Gradasi Hitam -> Biru)
      ========================================================================= */}
      <main className="flex-1 w-full max-w-full overflow-x-hidden flex flex-col justify-center relative pt-10 pb-16 sm:pt-20 sm:pb-24">
        {/* =========================================================================
            HERO SECTION
        ========================================================================= */}
        <div className="max-w-5xl mx-auto px-3.5 sm:px-6 lg:px-8 text-center w-full">
          {/* Badge Pengantar */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-blue-200 text-xs sm:text-sm font-semibold mb-5 sm:mb-6 max-w-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="truncate">Solusi Kasir Praktis &bull; Tanpa Beban Langganan Bulanan</span>
          </div>

          {/* Headline Utama */}
          <h1 className="text-2xl xs:text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.2] max-w-4xl mx-auto">
            Kelola Penjualan, Stok, dan Laporan Usaha Jadi Jauh Lebih Rapi.
          </h1>

          {/* Subtitle Membumi */}
          <p className="mt-4 sm:mt-6 text-xs xs:text-sm sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal">
            Aplikasi kasir praktis untuk toko kelontong, kafe, warung, dan retail. Fleksibel di tablet kasir meja maupun smartphone genggam staf toko. Cukup bayar token per transaksi sukses—tanpa biaya bulanan yang memberatkan saat toko sepi!
          </p>

          {/* CTA Buttons */}
          <div className="mt-7 sm:mt-9 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md sm:max-w-none mx-auto w-full">
            <button
              onClick={() => {
                setRegisterSuccessData(null);
                setRegisterModalOpen(true);
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/35 transition-all active:scale-[0.98] cursor-pointer"
            >
              <span>Daftar Akun Toko</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenPos}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 rounded-xl font-bold text-sm bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-all active:scale-[0.98] cursor-pointer"
            >
              <LogIn className="w-4 h-4 text-slate-200" />
              <span>Masuk ke Kasir</span>
            </button>
          </div>

          {/* Micro-Trust Badges */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] sm:text-xs text-slate-300 font-medium">
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
              <span>Bonus 100 Token Pertama</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
              <span>Token Tidak Pernah Hangus</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
              <span>Bebas Pakai HP &amp; Tablet yang Ada</span>
            </div>
          </div>

          {/* =========================================================================
              SHOWCASE VISUAL: TABLET LANDSCAPE & SMARTPHONE HANDHELD
              (Terinspirasi dari layout kasir modern tablet + handheld overlay)
          ========================================================================= */}
          <div className="mt-12 sm:mt-18 max-w-6xl mx-auto w-full">
            <div className="text-center mb-6 sm:mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-semibold">
                <Tablet className="w-3.5 h-3.5 text-blue-300" />
                <span>+</span>
                <Smartphone className="w-3.5 h-3.5 text-blue-300" />
                <span>Cocok Dipakai di Tablet Maupun Smartphone Handheld</span>
              </div>
            </div>

            {/* Mockup Frame Container */}
            <div className="relative mx-auto max-w-5xl">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                {/* TABLET MOCKUP (Landscape - Meja Kasir Depan) */}
                <div className="lg:col-span-8 relative z-10 text-left">
                  <div className="bg-slate-200/90 p-2.5 sm:p-3.5 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl border border-white/20 backdrop-blur-xs">
                    {/* Tablet Screen Container */}
                    <div className="bg-slate-900 rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden border border-slate-700/60 shadow-inner">
                      {/* Tablet Header Kasir */}
                      <div className="bg-slate-950 px-3.5 sm:px-5 py-2.5 sm:py-3 border-b border-slate-800 flex items-center justify-between text-white">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                            <Store className="w-4 h-4 text-white" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-xs sm:text-sm truncate">Ura Coffee - Flagship</span>
                              <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-bold">Shift Pagi</span>
                            </div>
                            <span className="text-[10px] text-slate-400 block truncate">Kasir Budi &bull; Meja 04 (Dine In)</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">10:24 WIB</span>
                          <span className="px-2 py-0.5 rounded-md bg-blue-900/60 text-blue-200 border border-blue-700/50 text-[10px] font-bold">
                            Mode Kasir Tablet
                          </span>
                        </div>
                      </div>

                      {/* Tablet Split Screen: Menu Kiri & Keranjang Kanan */}
                      <div className="bg-slate-100 p-2.5 sm:p-3 grid grid-cols-12 gap-2.5 sm:gap-3 text-slate-800">
                        {/* Kiri: Katalog Produk (7 Kolom) */}
                        <div className="col-span-7 flex flex-col gap-2">
                          {/* Filter Kategori */}
                          <div className="flex items-center gap-1.5 overflow-x-auto text-[10px] pb-1 no-scrollbar">
                            <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold shrink-0 shadow-xs">Semua (16)</span>
                            <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold shrink-0">Kopi (8)</span>
                            <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold shrink-0">Pastry (4)</span>
                          </div>

                          {/* Grid Produk Tablet */}
                          <div className="grid grid-cols-2 gap-2 h-64 sm:h-72 overflow-y-auto pr-0.5">
                            <div className="bg-white rounded-xl p-2 border border-slate-200 shadow-2xs flex flex-col justify-between">
                              <img src="/images/products/kopi-susu.jpg" alt="Kopi Aren Ori" className="w-full h-16 sm:h-20 object-cover rounded-lg mb-1" />
                              <div>
                                <p className="font-bold text-[11px] text-slate-900 leading-tight">Kopi Aren Ori</p>
                                <p className="text-[9px] text-slate-500">Coffee Signature</p>
                              </div>
                              <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100">
                                <span className="font-extrabold text-[11px] text-slate-900">Rp 18.000</span>
                                <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs">+</span>
                              </div>
                            </div>

                            <div className="bg-white rounded-xl p-2 border border-slate-200 shadow-2xs flex flex-col justify-between">
                              <img src="/images/products/latte.jpg" alt="Caffe Latte" className="w-full h-16 sm:h-20 object-cover rounded-lg mb-1" />
                              <div>
                                <p className="font-bold text-[11px] text-slate-900 leading-tight">Caffe Latte</p>
                                <p className="text-[9px] text-slate-500">Coffee Signature</p>
                              </div>
                              <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100">
                                <span className="font-extrabold text-[11px] text-slate-900">Rp 22.000</span>
                                <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs">+</span>
                              </div>
                            </div>

                            <div className="bg-white rounded-xl p-2 border border-slate-200 shadow-2xs flex flex-col justify-between">
                              <img src="/images/products/croissant.jpg" alt="Butter Croissant" className="w-full h-16 sm:h-20 object-cover rounded-lg mb-1" />
                              <div>
                                <p className="font-bold text-[11px] text-slate-900 leading-tight">Croissant</p>
                                <p className="text-[9px] text-slate-500">Fresh Baked</p>
                              </div>
                              <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100">
                                <span className="font-extrabold text-[11px] text-slate-900">Rp 18.000</span>
                                <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs">+</span>
                              </div>
                            </div>

                            <div className="bg-white rounded-xl p-2 border border-slate-200 shadow-2xs flex flex-col justify-between">
                              <img src="/images/products/matcha.jpg" alt="Matcha Ice" className="w-full h-16 sm:h-20 object-cover rounded-lg mb-1" />
                              <div>
                                <p className="font-bold text-[11px] text-slate-900 leading-tight">Matcha Ice</p>
                                <p className="text-[9px] text-slate-500">Non-Coffee</p>
                              </div>
                              <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100">
                                <span className="font-extrabold text-[11px] text-slate-900">Rp 20.000</span>
                                <span className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs">+</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Kanan: Keranjang Pesanan Kasir (5 Kolom) */}
                        <div className="col-span-5 bg-white rounded-xl border border-slate-200 p-2.5 flex flex-col justify-between shadow-xs">
                          <div>
                            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100">
                              <span className="font-extrabold text-[11px] text-slate-900">Pesanan Aktif (3)</span>
                              <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Meja 04</span>
                            </div>

                            <div className="space-y-1.5 text-[10px]">
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="font-bold text-slate-800">2x Kopi Aren Ori</span>
                                  <span className="text-[9px] text-slate-400 block">Less sugar, oat</span>
                                </div>
                                <span className="font-extrabold text-slate-900">36.000</span>
                              </div>
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="font-bold text-slate-800">1x Croissant</span>
                                </div>
                                <span className="font-extrabold text-slate-900">18.000</span>
                              </div>
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="font-bold text-slate-800">1x Matcha Ice</span>
                                </div>
                                <span className="font-extrabold text-slate-900">20.000</span>
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-100">
                            <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                              <span>Subtotal</span>
                              <span>Rp 74.000</span>
                            </div>
                            <div className="flex justify-between text-[10px] text-emerald-600 font-bold mb-1">
                              <span>Diskon Member</span>
                              <span>-Rp 5.000</span>
                            </div>
                            <div className="flex justify-between text-xs font-black text-slate-950 mb-2">
                              <span>Total Bayar</span>
                              <span>Rp 69.000</span>
                            </div>

                            <div className="w-full py-2 rounded-lg bg-blue-600 text-white font-extrabold text-[11px] text-center shadow-xs flex items-center justify-center gap-1.5">
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Bayar &amp; Cetak Struk</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SMARTPHONE HANDHELD MOCKUP (Portrait - Staf Kasir Keliling) */}
                <div className="lg:col-span-4 flex justify-center text-left relative z-20 mt-4 lg:mt-0">
                  <div className="w-full max-w-[290px] sm:max-w-[310px] bg-slate-950 rounded-[2.5rem] border-[7px] border-slate-800 shadow-2xl overflow-hidden relative">
                    {/* Status Bar HP */}
                    <div className="bg-slate-950 pt-2 pb-1 px-5 flex items-center justify-between text-white text-[11px] font-semibold">
                      <span>09:41</span>
                      <div className="w-16 h-3 bg-black rounded-full mx-auto" />
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <span className="text-[9px] font-bold">5G</span>
                      </div>
                    </div>

                    {/* Header Kasir Handheld */}
                    <div className="bg-blue-950 text-white p-3 flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-black leading-tight">Ura Coffee - Flagship</h4>
                        <div className="flex items-center gap-1.5 text-[10px] text-blue-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span>Kasir Handheld &bull; Meja 04</span>
                        </div>
                      </div>
                      <span className="text-[10px] bg-blue-900 text-blue-100 px-2 py-0.5 rounded font-bold border border-blue-800">
                        Order Keliling
                      </span>
                    </div>

                    {/* Quick Catalog / Cart HP */}
                    <div className="bg-slate-100 p-2.5 flex flex-col gap-2 h-72 overflow-y-auto">
                      <div className="bg-white rounded-xl p-2 border border-slate-200 flex items-center gap-2 shadow-2xs">
                        <img src="/images/products/kopi-susu.jpg" alt="Kopi Aren" className="w-12 h-12 rounded-lg object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[11px] text-slate-800 truncate">2x Kopi Aren Ori</p>
                          <p className="text-[9px] text-slate-400">Rp 18.000 / item</p>
                        </div>
                        <span className="font-extrabold text-[11px] text-slate-900">36.000</span>
                      </div>

                      <div className="bg-white rounded-xl p-2 border border-slate-200 flex items-center gap-2 shadow-2xs">
                        <img src="/images/products/croissant.jpg" alt="Croissant" className="w-12 h-12 rounded-lg object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[11px] text-slate-800 truncate">1x Butter Croissant</p>
                          <p className="text-[9px] text-slate-400">Rp 18.000 / item</p>
                        </div>
                        <span className="font-extrabold text-[11px] text-slate-900">18.000</span>
                      </div>

                      <div className="bg-white rounded-xl p-2 border border-slate-200 flex items-center gap-2 shadow-2xs">
                        <img src="/images/products/matcha.jpg" alt="Matcha" className="w-12 h-12 rounded-lg object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[11px] text-slate-800 truncate">1x Matcha Ice</p>
                          <p className="text-[9px] text-slate-400">Rp 20.000 / item</p>
                        </div>
                        <span className="font-extrabold text-[11px] text-slate-900">20.000</span>
                      </div>
                    </div>

                    {/* Bottom Action HP */}
                    <div className="bg-white border-t border-slate-200 p-2.5 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] text-slate-400 block font-semibold">Total (3 Item)</span>
                        <span className="text-xs font-black text-slate-900">Rp 69.000</span>
                      </div>
                      <div className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm">
                        <span>Bayar Cepat &rarr;</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3 Keunggulan Perangkat di Bawah Visual Showcase */}
              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 text-white">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <Smartphone className="w-4 h-4 text-blue-300" />
                    <h4 className="font-bold text-xs sm:text-sm">Praktis di HP Handheld</h4>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Staf kasir bisa membawa HP ke meja pengunjung untuk input pesanan langsung tanpa bolak-balik.
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 text-white">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <Tablet className="w-4 h-4 text-blue-300" />
                    <h4 className="font-bold text-xs sm:text-sm">Lega di Layar Tablet</h4>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Layar lebar menampilkan katalog dan keranjang berdampingan untuk melayani antrean kasir depan.
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 text-white">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <Printer className="w-4 h-4 text-blue-300" />
                    <h4 className="font-bold text-xs sm:text-sm">Printer &amp; Barcode Ready</h4>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Terhubung ke printer struk thermal Bluetooth biasa dan scan barcode produk langsung via kamera HP.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            6 MANFAAT NYATA UNTUK TENANT / PEDAGANG (BAHASA MEMBUMI)
        ========================================================================= */}
        <section className="mt-16 sm:mt-24 pt-12 sm:pt-16 pb-16 bg-white text-slate-900">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
              <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wider block mb-1">
                Fokus Pada Kemudahan Operasional
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                6 Manfaat Nyata untuk Usaha &amp; Toko Anda
              </h2>
              <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
                Dirancang khusus menjawab kendala sehari-hari pemilik usaha UMKM: dari hemat modal awal, mencegah kebocoran kas, hingga kontrol stok yang jelas.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 text-left">
              {/* Manfaat 1 */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 sm:p-6 flex flex-col justify-between hover:border-blue-300 hover:shadow-md transition-all">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-4">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">
                    Hemat Modal, Bebas Beli Mesin Kasir Mahal
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Tidak perlu mengeluarkan uang jutaan rupiah untuk komputer POS besar. Cukup gunakan HP atau tablet yang sudah ada. Kamera HP otomatis menjadi scanner barcode barang, dan Anda bisa cetak barcode label rak sendiri.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200/80 text-[11px] font-bold text-blue-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Nol Biaya Sewa Perangkat</span>
                </div>
              </div>

              {/* Manfaat 2 */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 sm:p-6 flex flex-col justify-between hover:border-blue-300 hover:shadow-md transition-all">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-4">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">
                    Catat Kasbon Rapi &amp; Tagih Santun via WA
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Pelanggan sering bayar nanti? Catat utang pelanggan dengan tertib, atur batas maksimal kasbon agar tidak kebablasan, dan kirim rincian nota tagihan ke WhatsApp pelanggan secara santun dalam 1-klik tanpa rasa canggung.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200/80 text-[11px] font-bold text-blue-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Uang Kas &amp; Piutang Selalu Klop</span>
                </div>
              </div>

              {/* Manfaat 3 */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 sm:p-6 flex flex-col justify-between hover:border-blue-300 hover:shadow-md transition-all">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-4">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">
                    Bahan Baku Otomatis Terpotong (Anti-Bocor)
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Saat segelas kopi atau seporsi makanan terjual, stok bahan baku (biji kopi, susu, gula, cup) otomatis berkurang sesuai takaran resep. Ada peringatan dini saat bahan mulai menipis sebelum kehabisan di jam ramai.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200/80 text-[11px] font-bold text-blue-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Cocok untuk Kafe &amp; Kuliner</span>
                </div>
              </div>

              {/* Manfaat 4 */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 sm:p-6 flex flex-col justify-between hover:border-blue-300 hover:shadow-md transition-all">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-4">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">
                    Struk Digital Hemat Kertas ke WhatsApp
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Selain mencetak struk lewat printer thermal biasa, bukti pembayaran bisa langsung otomatis dikirimkan ke nomor WhatsApp pelanggan. Hemat anggaran roll kertas struk kasir, ramah lingkungan, dan nomor WA pelanggan tersimpan aman.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200/80 text-[11px] font-bold text-blue-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Kirim Nota Otomatis 1-Klik</span>
                </div>
              </div>

              {/* Manfaat 5 */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 sm:p-6 flex flex-col justify-between hover:border-blue-300 hover:shadow-md transition-all">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-4">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">
                    Karyawan Disiplin &amp; Kas Laci Bebas Bocor
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Absensi mandiri staf toko dengan verifikasi PIN dan jam kerja terdata rapi. Setiap pembatalan nota (void) atau hapus pesanan wajib persetujuan PIN supervisor sehingga terhindar dari kecurangan nota liar kasir.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200/80 text-[11px] font-bold text-blue-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Kunci Pembatalan Nota (Anti-Void)</span>
                </div>
              </div>

              {/* Manfaat 6 */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 sm:p-6 flex flex-col justify-between hover:border-blue-300 hover:shadow-md transition-all">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-4">
                    <Store className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">
                    Buka Cabang Baru &amp; Gudang Tanpa Repot
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Ingin buka cabang ke-2 atau gudang pasokan? Anda bisa menyalin ratusan master produk tanpa perlu mengetik ulang dari awal. Mutasi pengiriman stok barang dari gudang ke cabang tercatat rapi secara real-time.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200/80 text-[11px] font-bold text-blue-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Multi-Outlet &amp; Manajemen Gudang</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SKEMA PRICING & EDUKASI TOKEN MEMBUMI (+ PROMO BULANAN)
        ========================================================================= */}
        <section className="pt-12 sm:pt-16 pb-16 bg-slate-50 border-t border-slate-200 text-slate-900">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
              <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wider block mb-1">
                Transparan &amp; Sangat Hemat
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                Skema Biaya yang Adil: Tanpa Beban Langganan Bulanan
              </h2>
              <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
                Anda hanya membayar saat kasir Anda benar-benar menghasilkan penjualan. Toko sepi atau libur mudik? Anda tidak rugi, token tidak pernah hangus!
              </p>
            </div>

            {/* KOTAK EDUKASI TOKEN MEMBUMI */}
            <div className="mb-10 bg-gradient-to-br from-blue-900 to-indigo-950 rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/30 border border-blue-400/30 text-blue-200 text-xs font-bold mb-3">
                    <Coins className="w-3.5 h-3.5 text-amber-300" />
                    <span>Edukasi Sistem Token Well POS</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black mb-2 leading-tight">
                    Apa itu Token Kuota Transaksi?
                  </h3>
                  <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed">
                    Sama persis seperti <strong>pulsa telepon</strong> atau <strong>token listrik prabayar</strong>: Anda membeli kuota token, dan kuota tersebut <strong>HANYA berkurang 1 token</strong> ketika kasir Anda sukses menyelesaikan 1 transaksi penjualan dan mencetak struk.
                  </p>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                      <span className="font-extrabold text-amber-300 block mb-0.5">Kenapa Bukan Langganan Bulanan?</span>
                      <span className="text-slate-200 text-[11px] leading-relaxed">
                        Aplikasi lain memotong Rp 150rb - Rp 300rb tiap bulan walau toko Anda sepi atau tutup libur. Di Well POS, <strong>token Anda TIDAK PERNAH HANGUS</strong>.
                      </span>
                    </div>
                    <div className="bg-white/10 rounded-xl p-3 border border-white/10">
                      <span className="font-extrabold text-emerald-300 block mb-0.5">Biaya Super Murah Per Struk</span>
                      <span className="text-slate-200 text-[11px] leading-relaxed">
                        Biaya rata-rata hanya <strong>Rp 60 s/d Rp 100 per transaksi</strong>. Jualan kopi Rp 20.000 hanya keluar biaya kasir Rp 75!
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/10 border border-white/15 rounded-2xl p-5 text-center shrink-0 w-full md:w-auto">
                  <span className="text-[11px] font-bold text-blue-200 block">Daftar Sekarang Dapat</span>
                  <span className="text-3xl font-black text-amber-300 block my-1">100 Token</span>
                  <span className="text-[10px] text-slate-300 block">Bonus Kuota Transaksi Awal</span>
                  <button
                    onClick={() => {
                      setRegisterSuccessData(null);
                      setRegisterModalOpen(true);
                    }}
                    className="mt-4 w-full px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    Klaim 100 Token &rarr;
                  </button>
                </div>
              </div>
            </div>

            {/* DUA PILIHAN BIAYA TRANSPARAN */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 items-stretch">
              {/* KARTU 1: PENDAFTARAN AKUN TOKO */}
              <div className="bg-white rounded-2xl sm:rounded-3xl border-2 border-blue-500/30 p-6 sm:p-8 flex flex-col justify-between shadow-lg relative">
                <div className="absolute -top-3.5 left-6 bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                  Aktivasi Sekali Seumur Hidup
                </div>

                <div>
                  <h3 className="text-xl font-black text-slate-900 mt-2">Pendaftaran Akun Toko</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Cukup bayar satu kali saat awal pendaftaran, toko aktif selamanya tanpa perpanjangan tahunan.
                  </p>

                  <div className="my-5 flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-black text-slate-950">
                      Rp {platformConfig.registrationFee.toLocaleString('id-ID')}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">/ toko (sekali bayar)</span>
                  </div>

                  {/* Highlight Promo Diskon Pendaftaran */}
                  <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl mb-5 flex items-start gap-2.5">
                    <Percent className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-amber-900 leading-relaxed">
                      <strong className="block font-bold">Banyak Promo Potongan Biaya Pendaftaran!</strong>
                      Gunakan kode voucher promo pendaftaran dari program promo bulanan kami untuk mendapatkan potongan harga spesial biaya aktivasi.
                    </div>
                  </div>

                  <ul className="space-y-2.5 text-xs text-slate-700">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Akun Pemilik Toko aktif selamanya</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Akses penuh seluruh fitur (Kasir, Stok Bahan, Absensi, Laporan)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-bold text-slate-900">Bonus 100 Token Transaksi Perdana</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Termasuk seluruh pembaruan sistem berkala</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-8 pt-5 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setRegisterSuccessData(null);
                      setRegisterModalOpen(true);
                    }}
                    className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/25 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    Daftar Akun Toko Sekarang
                  </button>
                </div>
              </div>

              {/* KARTU 2: PAKET TOP-UP TOKEN KUOTA TRANSAKSI */}
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-6 sm:p-8 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-slate-900">Pilihan Paket Token Transaksi</h3>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      Tidak Pernah Hangus
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Isi ulang kuota transaksi saat token Anda menipis. Bebas pilih paket yang sesuai perputaran toko Anda.
                  </p>

                  <div className="mt-5 space-y-3">
                    {/* Paket 1 */}
                    <div className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-400 bg-slate-50/70 transition-all flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">Paket Pemula</span>
                          <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold">500 Struk</span>
                        </div>
                        <span className="text-[11px] text-slate-500">Hanya ~Rp 100 per transaksi</span>
                      </div>
                      <span className="font-black text-sm text-slate-900">Rp 50.000</span>
                    </div>

                    {/* Paket 2 - Populer */}
                    <div className="p-3.5 rounded-xl border-2 border-blue-600 bg-blue-50/50 shadow-xs flex items-center justify-between relative">
                      <div className="absolute -top-2.5 right-4 bg-blue-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                        Paling Dipilih
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">Paket Laris Manis</span>
                          <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-bold">2.000 Struk</span>
                        </div>
                        <span className="text-[11px] text-blue-700 font-medium">Hanya ~Rp 75 per transaksi</span>
                      </div>
                      <span className="font-black text-base text-blue-950">Rp 150.000</span>
                    </div>

                    {/* Paket 3 */}
                    <div className="p-3.5 rounded-xl border border-slate-200 hover:border-blue-400 bg-slate-50/70 transition-all flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">Paket Grosir Rame</span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold">5.000 Struk</span>
                        </div>
                        <span className="text-[11px] text-emerald-700 font-medium">Hanya ~Rp 60 per transaksi (Super Hemat)</span>
                      </div>
                      <span className="font-black text-sm text-slate-900">Rp 300.000</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-500 leading-relaxed">
                  💡 <em>Top-up token dapat dilakukan kapan saja langsung di menu Profil Toko pemilik melalui pembayaran QRIS instan otomatis.</em>
                </div>
              </div>
            </div>

            {/* BANNER PROMO MENARIK SETIAP BULAN */}
            <div className="mt-8 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-2xl p-4 sm:p-6 text-white shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 text-left">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Gift className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-black text-sm sm:text-base leading-tight">
                    Banjir Promo Menarik Setiap Bulan!
                  </h4>
                  <p className="text-xs text-amber-100 mt-0.5 leading-relaxed">
                    Dapatkan diskon biaya pendaftaran toko dan diskon kuota token di awal bulan (Payday Promo). Pantau kode kupon promo berkala di dashboard pemilik toko Anda!
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setRegisterSuccessData(null);
                  setRegisterModalOpen(true);
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white text-orange-700 hover:bg-amber-50 font-black text-xs shadow-sm transition-all active:scale-95 shrink-0 cursor-pointer"
              >
                Cek Promo Pendaftaran &rarr;
              </button>
            </div>
          </div>
        </section>

        {/* =========================================================================
            F&Q (FREQUENTLY ASKED QUESTIONS / TANYA JAWAB PEDAGANG)
        ========================================================================= */}
        <section className="pt-14 sm:pt-20 pb-16 bg-white text-slate-900 border-t border-slate-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
              <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wider block mb-1">
                Tanya Jawab (F&amp;Q)
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                Pertanyaan yang Sering Ditanyakan
              </h2>
              <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
                Jawaban jelas untuk hal-hal yang sering menjadi keraguan pemilik usaha sebelum mulai menggunakan Well POS.
              </p>
            </div>

            <div className="space-y-3.5 text-left">
              {[
                {
                  q: 'Apakah saya harus membeli mesin kasir khusus atau komputer mahal?',
                  a: 'Sama sekali tidak perlu! Anda bisa langsung memakai HP Android, iPhone, tablet, ataupun laptop yang sudah ada. Well POS berjalan lancar di browser tanpa memerlukan spesifikasi perangkat khusus. Jika butuh cetak struk kertas, cukup hubungkan dengan printer thermal Bluetooth murah yang banyak dijual di marketplace mulai harga 100 ribuan.',
                },
                {
                  q: 'Bagaimana jika internet toko sedang mati atau sinyal jelek?',
                  a: 'Tenang saja. Kasir Well POS tetap bisa digunakan mencatat pesanan pelanggan dan menerima pembayaran tunai secara offline lokal tanpa macet. Begitu koneksi internet tersambung kembali, seluruh data transaksi akan otomatis tersinkronisasi ke server pusat.',
                },
                {
                  q: 'Bagaimana sistem Token bekerja jika toko saya tutup saat hari libur atau sepi?',
                  a: 'Token Anda tetap 100% utuh dan aman! Berbeda dari aplikasi kasir konvensional yang tetap memotong biaya langganan bulanan meski toko Anda sepi atau tutup libur panjang, Token Well POS TIDAK PERNAH HANGUS dan TIDAK ADA MASA KADALUWARSA. Kuota token hanya berkurang saat ada transaksi sukses.',
                },
                {
                  q: 'Bisa disambungkan ke printer struk thermal dan laci kasir (cash drawer)?',
                  a: 'Ya, sangat bisa. Well POS mendukung hampir seluruh printer struk Bluetooth thermal ukuran 58mm maupun 80mm, printer kabel USB/LAN, serta laci kasir otomatis (cash drawer) yang terhubung ke printer struk.',
                },
                {
                  q: 'Apakah saya bisa mengelola lebih dari satu cabang toko atau gudang pasokan?',
                  a: 'Tentu saja. Anda dapat menambah cabang baru kapan saja dari dashboard pemilik. Pengaturan menu dan harga bisa disamakan atau dibedakan antar cabang, serta mutasi stok bahan/barang dari gudang pusat ke cabang tercatat rapi secara real-time.',
                },
                {
                  q: 'Bagaimana jika kasir salah input transaksi atau ada pelanggan yang membatalkan pesanan?',
                  a: 'Well POS dilengkapi fitur keamanan PIN Supervisor. Setiap pembatalan nota (void) atau hapus pesanan wajib memasukkan PIN otorisasi pemilik/supervisor, sehingga kasir tidak bisa sembarangan memanipulasi nota dan uang kas di laci selalu klop.',
                },
              ].map((item, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div
                    key={idx}
                    className="border border-slate-200 rounded-2xl overflow-hidden transition-all bg-slate-50/50"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full p-4 sm:p-5 flex items-center justify-between gap-4 text-left font-bold text-xs sm:text-sm text-slate-900 hover:text-blue-600 transition-colors cursor-pointer"
                    >
                      <span>{item.q}</span>
                      <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-600">
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                        <p className="mt-2.5">{item.a}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* =========================================================================
            BANNER PENUTUP (CTA FOOTER)
        ========================================================================= */}
        <section className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 py-14 sm:py-18 text-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-4xl font-black mb-3 tracking-tight">
              Siap Merapikan Pencatatan Usaha Anda?
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed mb-8">
              Daftar akun toko hanya dalam 2 menit, nikmati bonus 100 token transaksi perdana, dan rasakan kemudahan mengelola kasir serta stok langsung dari HP maupun tablet Anda.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
              <button
                onClick={() => {
                  setRegisterSuccessData(null);
                  setRegisterModalOpen(true);
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/35 transition-all active:scale-[0.98] cursor-pointer"
              >
                <span>Daftar Akun Toko Sekarang</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={onOpenPos}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 rounded-xl font-bold text-sm bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-all active:scale-[0.98] cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-slate-200" />
                <span>Masuk ke Kasir</span>
              </button>
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
               TAMPILAN 1: SUKSES AKTIVASI (LUNAS / BEBAS BIAYA PROMO)
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
                    ? 'Pendaftaran akun toko Anda telah berhasil aktif dan siap digunakan.'
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
                    {registerSuccessData.finalAmount === 0 ? 'Rp 0 (Voucher 100%)' : `Rp ${registerSuccessData.finalAmount?.toLocaleString('id-ID')}`}
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
                        {platformConfig.registrationFee === 0 ? 'Rp 0' : `Rp ${platformConfig.registrationFee.toLocaleString('id-ID')}`}
                      </span>
                      <span className="text-emerald-600 font-black">
                        {appliedPromo.finalAmount === 0 ? 'Rp 0 (Voucher 100%)' : `Rp ${appliedPromo.finalAmount.toLocaleString('id-ID')}`}
                      </span>
                    </span>
                  ) : platformConfig.registrationFee === 0 ? (
                    <span className="text-emerald-600 font-black">Rp 0 (Bebas Biaya)</span>
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
