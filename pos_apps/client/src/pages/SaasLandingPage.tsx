import React, { useState, useEffect } from 'react';
import {
  Store,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Zap,
  Printer,
  Boxes,
  CreditCard,
  BarChart3,
  Users,
  Check,
  X,
  Lock,
  Mail,
  Phone,
  AlertCircle,
  MessageSquare,
  Building2,
  ShieldCheck,
  Headphones,
  Laptop,
  CheckCircle,
} from 'lucide-react';
import { api } from '../services/api';
import { formatIndonesianWhatsApp, isValidIndonesianWhatsApp } from '../utils/phone';

interface SaasLandingPageProps {
  onOpenPos: () => void;
  onOpenSuperadmin?: () => void;
}

export const SaasLandingPage: React.FC<SaasLandingPageProps> = ({
  onOpenPos,
}) => {
  // Modal Registration State
  const [registerModalOpen, setRegisterModalOpen] = useState(() => {
    return window.location.hash.toLowerCase() === '#register';
  });
  const [regBusinessName, setRegBusinessName] = useState('');
  const [regOwnerName, setRegOwnerName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [registerSuccessData, setRegisterSuccessData] = useState<{
    businessName: string;
    ownerName: string;
    email: string;
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

    const formattedPhone = formatIndonesianWhatsApp(regPhone);
    if (!isValidIndonesianWhatsApp(formattedPhone)) {
      setError('Nomor WhatsApp tidak valid. Format harus diawali +628... dan maksimal 13 digit.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.saasRegister({
        businessName: regBusinessName.trim(),
        ownerName: regOwnerName.trim(),
        email: regEmail.trim(),
        phone: regPhone.trim(),
        password: regPassword,
      });

      if (res.status === 'success') {
        setRegisterSuccessData({
          businessName: regBusinessName.trim(),
          ownerName: regOwnerName.trim(),
          email: regEmail.trim(),
        });
      } else {
        setError(res.message || 'Pendaftaran bisnis gagal. Mohon periksa kembali isian Anda.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem saat menghubungi server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-900 selection:text-white">
      {/* =========================================================================
          TOP NAVIGATION BAR (Clean, Professional & uncluttered)
      ========================================================================= */}
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between">
          {/* Logo & Brand Identity */}
          <a href="#" className="flex items-center gap-3.5 group">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-blue-950 via-blue-900 to-indigo-800 text-white flex items-center justify-center shadow-md shadow-blue-950/20 group-hover:scale-105 transition-transform">
              <Store className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-blue-950">
                  Well POS
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-200/80">
                  Cloud Suite
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Sistem Kasir & Manajemen Bisnis Multi-Cabang
              </p>
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center gap-8 text-sm font-bold text-slate-600">
            <a href="#fitur" className="hover:text-blue-950 transition-colors">
              Fitur Unggulan
            </a>
            <a href="#solusi" className="hover:text-blue-950 transition-colors">
              Solusi Bisnis
            </a>
            <a href="#harga" className="hover:text-blue-950 transition-colors">
              Konsultasi & Harga
            </a>
            <a href="#faq" className="hover:text-blue-950 transition-colors">
              FAQ
            </a>
          </div>

          {/* Right Action CTAs */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onOpenPos}
              className="px-4 py-2.5 text-xs sm:text-sm font-extrabold text-blue-950 hover:bg-slate-100 border border-slate-300/80 rounded-xl transition-all shadow-xs flex items-center gap-2"
              title="Buka Mesin Kasir POS / Login Toko"
            >
              <Store className="w-4 h-4 text-blue-900" />
              <span>Masuk Kasir</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRegisterSuccessData(null);
                setRegisterModalOpen(true);
              }}
              className="px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-md shadow-emerald-600/25 transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Daftar Akun Baru</span>
            </button>
          </div>
        </div>
      </nav>

      {/* =========================================================================
          HERO SECTION
      ========================================================================= */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 bg-gradient-to-b from-white via-blue-50/30 to-slate-50 border-b border-slate-200/80">
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-3/4 h-80 bg-blue-200/30 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Tagline Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-100/80 border border-blue-200 text-blue-950 text-xs sm:text-sm font-bold mb-6 shadow-xs">
            <Sparkles className="w-4 h-4 text-blue-800" />
            <span>Well POS v2.2 &bull; Generasi Baru POS Multi-Tenant Indonesia</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-blue-950 tracking-tight leading-[1.15] max-w-4xl mx-auto">
            Satu Platform Kasir Cerdas untuk Semua Cabang Bisnis Anda.
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-sm sm:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed font-normal">
            Didesain khusus untuk F&B, Kafe, Retail, dan Minimarket. Lengkap dengan Barcode Scanner,
            Split Payment, Cetak Struk 58/80mm, Struk WhatsApp, Manajemen Shift Kasir, hingga
            Laporan Finansial Multi-Cabang secara terpusat.
          </p>

          {/* CTA Buttons */}
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => {
                setRegisterSuccessData(null);
                setRegisterModalOpen(true);
              }}
              className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl shadow-xl shadow-emerald-600/25 transition-all text-base flex items-center justify-center gap-2.5 active:scale-95"
            >
              <Sparkles className="w-5 h-5 text-amber-300" />
              <span>Daftar Akun Baru &mdash; Coba Gratis 14 Hari</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onOpenPos}
              className="w-full sm:w-auto px-7 py-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold rounded-2xl shadow-sm transition-all text-base flex items-center justify-center gap-2"
            >
              <Store className="w-5 h-5 text-blue-900" />
              <span>Sudah Punya Akun? Masuk Kasir</span>
            </button>
          </div>

          {/* Trust Value Badges */}
          <div className="mt-14 pt-8 border-t border-slate-200/90 max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-slate-900">Tanpa Kartu Kredit</p>
                <p className="text-slate-500">Uji coba langsung aktif</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-slate-900">Setup Cepat 2 Menit</p>
                <p className="text-slate-500">Wizard onboarding otomatis</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-slate-900">Multi-Perangkat</p>
                <p className="text-slate-500">Tablet, Laptop & Desktop</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-slate-900">Cloud Sync Real-Time</p>
                <p className="text-slate-500">99.9% Uptime terjamin</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FITUR UNGGULAN SHOWCASE
      ========================================================================= */}
      <section id="fitur" className="py-16 sm:py-24 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-blue-900 mb-2">
              Fitur Lengkap Kasir & Bisnis
            </h2>
            <p className="text-3xl sm:text-4xl font-black text-blue-950">
              Dibangun untuk Kecepatan Transaksi dan Akurasi Bisnis
            </p>
            <p className="mt-3 text-slate-600 text-sm sm:text-base">
              Setiap fitur dirancang secara ergonomis untuk meminimalkan antrean di kasir dan
              memudahkan pemilik memantau keuntungan secara real-time.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Feature 1 */}
            <div className="p-7 bg-slate-50 border border-slate-200/90 rounded-3xl hover:border-blue-900/30 hover:shadow-lg transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-900 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h3 className="text-lg font-bold text-slate-950 mb-2">
                Kasir Cepat & Barcode Scanner
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Scan barcode langsung dari scanner USB/Bluetooth, input instan tanpa jeda,
                fitur Hold Order (Simpan Pesanan Meja / Antrean), dan mode tombol cepat.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-7 bg-slate-50 border border-slate-200/90 rounded-3xl hover:border-blue-900/30 hover:shadow-lg transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-900 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <CreditCard className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h3 className="text-lg font-bold text-slate-950 mb-2">
                Multi & Split Payment Fleksibel
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Dukungan pembayaran tunai, QRIS dinamis/statis, transfer bank, dan kartu debit/kredit.
                Pelanggan bisa membayar patungan (split bill) dalam satu transaksi tunggal.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-7 bg-slate-50 border border-slate-200/90 rounded-3xl hover:border-blue-900/30 hover:shadow-lg transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-900 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Printer className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h3 className="text-lg font-bold text-slate-950 mb-2">
                Struk Thermal 58/80mm & WhatsApp
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Kompatibel dengan printer thermal Bluetooth/USB ukuran 58mm atau 80mm ESC/POS. Dilengkapi
                fitur kirim struk digital instan via WhatsApp resmi tanpa boros kertas.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-7 bg-slate-50 border border-slate-200/90 rounded-3xl hover:border-blue-900/30 hover:shadow-lg transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Boxes className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h3 className="text-lg font-bold text-slate-950 mb-2">
                Multi-Gudang & Stok Real-Time
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Pemisahan tegas antara Stok Gudang Pusat dan Stok Etalase Toko. Mendukung transfer stok
                antarcabang, notifikasi stok kritis, dan kartu mutasi audit lengkap.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-7 bg-slate-50 border border-slate-200/90 rounded-3xl hover:border-blue-900/30 hover:shadow-lg transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-violet-100 text-violet-900 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h3 className="text-lg font-bold text-slate-950 mb-2">
                Shift Kasir (X/Z-Report) & Laba Rugi
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Buka & tutup kasir dengan perhitungan uang kas laci akurat. Cetak laporan shift harian
                (X-Report & Z-Report) dan pantau margin laba kotor per kategori produk secara riil.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-7 bg-slate-50 border border-slate-200/90 rounded-3xl hover:border-blue-900/30 hover:shadow-lg transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-900 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 stroke-[2.5]" />
              </div>
              <h3 className="text-lg font-bold text-slate-950 mb-2">
                Pairing Perangkat & PIN Kasir Cepat
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Keamanan tingkat lanjut dengan otorisasi ID Toko + PIN Pemilik. Kasir login via Touch
                Numpad 6-digit dan dapat dikunci (Lock Screen) instan setiap pergantian giliran.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SOLUSI BISNIS SECTION
      ========================================================================= */}
      <section id="solusi" className="py-16 sm:py-24 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-blue-900 mb-2">
              Solusi Industri
            </h2>
            <p className="text-3xl sm:text-4xl font-black text-blue-950">
              Menjawab Tantangan Operasional di Berbagai Model Usaha
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-3xl mb-4 block">☕</span>
                <h3 className="text-xl font-bold text-blue-950 mb-2">Kafe & Coffee Shop</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
                  Manajemen nomor meja, cetak struk pesanan ke dapur/bar, kustomisasi varian (dingin/panas, level gula), dan kecepatan transaksi antrean tinggi.
                </p>
              </div>
              <ul className="space-y-2 text-xs font-semibold text-slate-700 border-t pt-4">
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> Cetak pesanan tiket bar</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> Hold order nomor meja</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> Modifikasi varian produk</li>
              </ul>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-3xl mb-4 block">🛒</span>
                <h3 className="text-xl font-bold text-blue-950 mb-2">Retail & Minimarket</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
                  Input ribuan SKU produk via barcode scanner kilat, pelacakan stok minimum, dan audit selisih kas fisik vs pencatatan komputer.
                </p>
              </div>
              <ul className="space-y-2 text-xs font-semibold text-slate-700 border-t pt-4">
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> Integrasi barcode scanner USB</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> Notifikasi stok gudang menipis</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> Audit kartu mutasi barang</li>
              </ul>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-3xl mb-4 block">🏢</span>
                <h3 className="text-xl font-bold text-blue-950 mb-2">Waralaba & Multi-Cabang</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
                  Pantau performa penjualan seluruh gerai cabang dalam 1 akun pemilik. Distribusi stok dari gudang pusat ke gerai secara transparan.
                </p>
              </div>
              <ul className="space-y-2 text-xs font-semibold text-slate-700 border-t pt-4">
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> Dashboard omzet terpusat</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> Alur transfer stok pusat ke cabang</li>
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> Akses terisolasi per kasir cabang</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          KONSULTASI SOLUSI & PENAWARAN HARGA (Hubungi Kami - Professional Enterprise)
      ========================================================================= */}
      <section id="harga" className="py-16 sm:py-24 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-blue-900 mb-2">
              Investasi & Layanan
            </h2>
            <p className="text-3xl sm:text-4xl font-black text-blue-950">
              Paket & Penawaran Terbaik yang Disesuaikan untuk Bisnis Anda
            </p>
            <p className="mt-4 text-slate-600 text-sm sm:text-base leading-relaxed">
              Setiap usaha memiliki kebutuhan unik—mulai dari kedai mandiri hingga jaringan ritel berskala besar.
              Konsultasikan kebutuhan operasional Anda langsung dengan tim spesialis kami untuk skema harga paling efisien.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left Column: 4 Value Pillars */}
            <div className="lg:col-span-7 space-y-4 flex flex-col justify-center">
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl flex items-start gap-4">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-900 flex items-center justify-center shrink-0 mt-0.5">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-blue-950 mb-1">
                    Skalabilitas Multi-Cabang & Multi-Perangkat
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    Sistem dapat berkembang seiring pertumbuhan bisnis Anda. Tambah gerai baru, hubungkan mesin kasir baru, atau buka gudang tambahan tanpa kendala teknis.
                  </p>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl flex items-start gap-4">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-900 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-blue-950 mb-1">
                    Tanpa Biaya Tersembunyi & Bebas Biaya Setup
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    Harga transparan dan terencana. Didampingi panduan onboarding otomatis sehingga Anda bisa langsung berjualan tanpa biaya instalasi mahal.
                  </p>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl flex items-start gap-4">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-900 flex items-center justify-center shrink-0 mt-0.5">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-blue-950 mb-1">
                    Uji Coba Penuh 14 Hari Tanpa Risiko
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    Rasakan seluruh fitur unggulan Well POS di mesin kasir Anda secara gratis selama 14 hari penuh sebelum Anda mengambil keputusan.
                  </p>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border border-slate-200 rounded-3xl flex items-start gap-4">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0 mt-0.5">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-blue-950 mb-1">
                    Layanan Bantuan Teknis Prioritas
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    Didukung tim teknis responsif yang siap membantu kendala operasional kasir, printer, dan sinkronisasi laporan Anda.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: High Conversion Contact Card */}
            <div className="lg:col-span-5 bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-indigo-500/20 flex flex-col justify-between relative overflow-hidden">
              <div className="relative z-10">
                <span className="px-3.5 py-1 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-black rounded-full uppercase tracking-wider inline-block mb-4">
                  Hubungi Konsultan Kami
                </span>

                <h3 className="text-2xl sm:text-3xl font-black tracking-tight mb-3">
                  Konsultasikan Kebutuhan & Dapatkan Penawaran Khusus
                </h3>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-8">
                  Diskusikan spesifikasi outlet, jenis printer, dan kebutuhan cabang Anda. Tim spesialis kami siap memberikan demo sistem live dan penawaran investasi terbaik.
                </p>

                <div className="space-y-4 mb-8">
                  <a
                    href="https://wa.me/6281234567890?text=Halo%20Tim%20Well%20POS,%20saya%20tertarik%20konsultasi%20paket%20sistem%20kasir%20dan%20penawaran%20harga%20untuk%20usaha%20saya"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-4 px-6 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-3 text-sm active:scale-95 group"
                  >
                    <MessageSquare className="w-5 h-5 text-slate-950" />
                    <span>Konsultasi Cepat via WhatsApp</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      setRegisterSuccessData(null);
                      setRegisterModalOpen(true);
                    }}
                    className="w-full py-4 px-6 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2.5 text-sm"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Daftarkan Bisnis & Coba 14 Hari</span>
                  </button>
                </div>
              </div>

              <div className="pt-6 border-t border-white/10 relative z-10 text-xs text-slate-400 space-y-2">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-400" />
                  <span>Email Konsultasi: <strong>sales@wellpos.id</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-blue-400" />
                  <span>Hotline Bisnis: <strong>+62 21 5088 9000</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>Layanan Konsultasi: Senin &ndash; Sabtu, 08:00 &ndash; 20:00 WIB</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FAQ SECTION
      ========================================================================= */}
      <section id="faq" className="py-16 sm:py-24 bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-blue-900 mb-2">
              Pertanyaan Umum (FAQ)
            </h2>
            <p className="text-3xl font-black text-blue-950">
              Hal yang Sering Ditanyakan Mengenai Well POS
            </p>
          </div>

          <div className="space-y-4">
            <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <h4 className="text-base font-bold text-blue-950 mb-2">
                Apakah saya bisa mencoba sistem ini terlebih dahulu?
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Ya, tentu saja. Anda dapat mendaftarkan usaha Anda dan langsung menikmati uji coba gratis selama 14 hari dengan akses seluruh fitur PRO tanpa memerlukan kartu kredit.
              </p>
            </div>

            <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <h4 className="text-base font-bold text-blue-950 mb-2">
                Perangkat keras (hardware) apa saja yang didukung?
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Well POS dapat diakses melalui web browser modern di Tablet (Android/iPad), Laptop, Komputer Desktop, maupun smartphone. Sistem kompatibel dengan printer thermal ESC/POS (koneksi USB atau Bluetooth ukuran 58mm/80mm) dan barcode scanner USB standard.
              </p>
            </div>

            <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <h4 className="text-base font-bold text-blue-950 mb-2">
                Bagaimana cara menghubungkan mesin kasir di toko fisik saya?
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Sangat mudah! Di perangkat toko Anda, buka menu Mesin Kasir, lalu hubungkan dengan memasukkan ID Unik Toko dan PIN Pemilik sekali saja. Centang opsi "Kenali Perangkat Ini", dan selanjutnya kasir cukup login cepat menggunakan 6-digit PIN pada Numpad layar sentuh.
              </p>
            </div>

            <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <h4 className="text-base font-bold text-blue-950 mb-2">
                Apakah data penjualan dan stok antar cabang terjamin aman?
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Tentu. Well POS menerapkan arsitektur isolasi multi-tenant yang ketat. Data setiap klien dan setiap cabang terisolasi secara independen dan diamankan menggunakan enkripsi SSL/TLS tingkat tinggi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          ENTERPRISE FOOTER (Professional, No Superadmin links)
      ========================================================================= */}
      <footer className="bg-slate-950 text-slate-300 pt-16 pb-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-slate-800">
            {/* Col 1: Brand & Security (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/30">
                  <Store className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-xl font-black text-white tracking-tight">Well POS</span>
                  <p className="text-xs text-blue-400 font-semibold">PT Well Digital Solusindo</p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm">
                Platform Point of Sale (POS) cerdas dan manajemen bisnis multi-cabang berbasis Cloud. Solusi terpadu kasir cepat, manajemen gudang, struk digital WhatsApp, dan pelaporan keuangan real-time.
              </p>
              <div className="pt-2 flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Enkripsi SSL 256-Bit</span>
                <span>&bull;</span>
                <span>SLA Uptime 99.9%</span>
              </div>
            </div>

            {/* Col 2: Fitur & Produk (2 cols) */}
            <div className="lg:col-span-2 space-y-3">
              <p className="text-xs font-black uppercase tracking-wider text-white">Produk</p>
              <ul className="space-y-2 text-xs text-slate-400">
                <li><a href="#fitur" className="hover:text-white transition-colors">Mesin Kasir POS</a></li>
                <li><a href="#fitur" className="hover:text-white transition-colors">Manajemen Gudang & Stok</a></li>
                <li><a href="#fitur" className="hover:text-white transition-colors">Multi-Outlet Terpusat</a></li>
                <li><a href="#fitur" className="hover:text-white transition-colors">Struk WhatsApp</a></li>
                <li><a href="#fitur" className="hover:text-white transition-colors">Rekonsiliasi Shift Kasir</a></li>
              </ul>
            </div>

            {/* Col 3: Solusi Industri (2 cols) */}
            <div className="lg:col-span-2 space-y-3">
              <p className="text-xs font-black uppercase tracking-wider text-white">Solusi</p>
              <ul className="space-y-2 text-xs text-slate-400">
                <li><a href="#solusi" className="hover:text-white transition-colors">Kafe & Coffee Shop</a></li>
                <li><a href="#solusi" className="hover:text-white transition-colors">Restoran & Rumah Makan</a></li>
                <li><a href="#solusi" className="hover:text-white transition-colors">Retail & Minimarket</a></li>
                <li><a href="#solusi" className="hover:text-white transition-colors">Waralaba & Franchise</a></li>
              </ul>
            </div>

            {/* Col 4: Kontak & Kantor (3 cols) */}
            <div className="lg:col-span-3 space-y-3">
              <p className="text-xs font-black uppercase tracking-wider text-white">Kantor & Kontak</p>
              <div className="space-y-2 text-xs text-slate-400">
                <p><strong>Gedung Well Tower</strong> Lt. 12</p>
                <p>Jl. Jenderal Sudirman Kav. 28, Jakarta Selatan 12920</p>
                <p className="pt-2 text-slate-300">Hotline: +62 21 5088 9000</p>
                <p className="text-slate-300">Email: support@wellpos.id</p>
              </div>
            </div>
          </div>

          {/* Bottom Copyright Bar */}
          <div className="pt-8 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-4">
            <p>&copy; {new Date().getFullYear()} PT Well Digital Solusindo. Seluruh Hak Cipta Dilindungi.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-slate-300 transition-colors">Kebijakan Privasi</a>
              <a href="#" className="hover:text-slate-300 transition-colors">Syarat & Ketentuan</a>
              <button
                type="button"
                onClick={onOpenPos}
                className="hover:text-blue-400 font-semibold transition-colors"
              >
                Akses Kasir Toko &rarr;
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* =========================================================================
          MODAL PENDAFTARAN BISNIS (CALON KLIEN)
      ========================================================================= */}
      {registerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                setRegisterModalOpen(false);
                setRegisterSuccessData(null);
              }}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            {registerSuccessData ? (
              /* =========================================================================
                 SUKSES PENDAFTARAN: PESAN FORMAL KEPADA KLIEN (Clean, Enterprise)
              ========================================================================= */
              <div className="text-center py-4 space-y-5 animate-in fade-in">
                <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 className="w-9 h-9" />
                </div>

                <div>
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-900 border border-blue-200 inline-block mb-2">
                    PENDAFTARAN BERHASIL DITERIMA
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-blue-950">
                    Selamat Datang di Well POS!
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-md mx-auto leading-relaxed">
                    Data pendaftaran bisnis <strong>{registerSuccessData.businessName}</strong> atas nama{' '}
                    <strong>{registerSuccessData.ownerName}</strong> telah berhasil kami terima.
                  </p>
                </div>

                <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-3 text-xs text-slate-700">
                  <div className="font-extrabold text-blue-950 flex items-center gap-2 text-xs sm:text-sm">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Langkah Selanjutnya:</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    Tim aktivasi kami sedang memverifikasi data usaha Anda (estimasi waktu maksimal 1x24 jam kerja).
                    Konfirmasi persetujuan dan tautan setup awal akan dikirimkan langsung ke email{' '}
                    <strong>{registerSuccessData.email}</strong> dan nomor WhatsApp Anda.
                  </p>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setRegisterModalOpen(false);
                      setRegisterSuccessData(null);
                      onOpenPos();
                    }}
                    className="w-full sm:flex-1 py-3 px-4 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-blue-900/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Store className="w-4 h-4" />
                    <span>Masuk ke Halaman Login Kasir &rarr;</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRegisterModalOpen(false);
                      setRegisterSuccessData(null);
                    }}
                    className="w-full sm:w-auto py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            ) : (
              /* =========================================================================
                 FORMULIR PENDAFTARAN CALON KLIEN BARU
              ========================================================================= */
              <>
                {/* Modal Header */}
                <div className="text-center mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto mb-3">
                    <Store className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-blue-950">
                    Pendaftaran Akun Bisnis Baru
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                    Daftarkan bisnis Anda ke platform Well POS Cloud SaaS untuk menikmati uji coba gratis 14 hari penuh.
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Registration Form */}
                <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Bisnis / Toko <span className="text-rose-500">*</span>:
                    </label>
                    <div className="relative">
                      <Store className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={regBusinessName}
                        onChange={(e) => setRegBusinessName(e.target.value)}
                        placeholder="Contoh: Kopi Nusantara Sejahtera"
                        className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl pl-9 pr-3 py-2 text-xs outline-none font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Lengkap Pemilik <span className="text-rose-500">*</span>:
                    </label>
                    <div className="relative">
                      <Users className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={regOwnerName}
                        onChange={(e) => setRegOwnerName(e.target.value)}
                        placeholder="Contoh: Rian Pratama"
                        className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl pl-9 pr-3 py-2 text-xs outline-none font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Email Pemilik <span className="text-rose-500">*</span>:
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="email"
                          required
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="rian@kopinusantara.id"
                          className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl pl-9 pr-3 py-2 text-xs outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                        <span>Nomor WhatsApp <span className="text-rose-500">*</span></span>
                        <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">Format +62 (Maks 13 Digit)</span>
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="tel"
                          required
                          value={regPhone}
                          onChange={(e) => setRegPhone(formatIndonesianWhatsApp(e.target.value))}
                          placeholder="+6281234567890"
                          maxLength={14}
                          className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl pl-9 pr-3 py-2 text-xs outline-none font-medium"
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Diawali 0 / 8 otomatis diformat ke <span className="font-semibold text-slate-700">+62</span> untuk pengiriman kode & notifikasi.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Kata Sandi Akun <span className="text-rose-500">*</span>:
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Minimal 6 karakter"
                        className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl pl-9 pr-3 py-2 text-xs outline-none"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-xl text-[11px] text-blue-900 leading-relaxed">
                    💡 <em>Catatan:</em> Detail konfigurasi nama cabang, gudang, dan PIN mesin kasir akan Anda atur di <strong>Setup Wizard Onboarding</strong> setelah akun aktif.
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-3 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 text-white font-extrabold rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm"
                  >
                    {loading ? (
                      'Mengirim Pengajuan...'
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>Daftarkan Bisnis & Coba Gratis 14 Hari &rarr;</span>
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
