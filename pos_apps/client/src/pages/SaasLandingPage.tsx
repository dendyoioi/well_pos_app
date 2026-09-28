import React, { useState, useEffect } from 'react';
import {
  Store,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  LogIn,
} from 'lucide-react';
import { api } from '../services/api';
import { formatIndonesianWhatsApp, validateIndonesianWhatsApp } from '../utils/phone';
import { Button, Badge, Modal, Input, WhatsAppInput } from '../components/ui';

interface SaasLandingPageProps {
  onOpenPos: () => void;
  onOpenSuperadmin?: () => void;
}

export const SaasLandingPage: React.FC<SaasLandingPageProps> = ({
  onOpenPos,
}) => {
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-900 selection:text-white">
      {/* =========================================================================
          TOP NAVIGATION BAR (SIMPLIFIED)
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
                <Badge variant="primary" size="sm">
                  v2.5 Cloud
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Sistem Kasir &amp; Supply Chain Multi-Outlet Modern
              </p>
            </div>
          </a>

          {/* Action CTAs: Hanya Login Merchant dan Daftar Gratis */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <Button
              variant="outline"
              size="md"
              icon={<LogIn className="w-4 h-4 text-blue-900" />}
              onClick={onOpenPos}
            >
              Login Merchant
            </Button>
            <Button
              variant="success"
              size="md"
              icon={<Sparkles className="w-4 h-4 text-amber-300" />}
              onClick={() => {
                setRegisterSuccessData(null);
                setRegisterModalOpen(true);
              }}
            >
              Daftar Gratis
            </Button>
          </div>
        </div>
      </nav>

      {/* =========================================================================
          HERO SECTION
      ========================================================================= */}
      <main className="flex-1 flex flex-col justify-center relative overflow-hidden py-16 sm:py-24 bg-gradient-to-b from-white via-blue-50/30 to-slate-50 border-b border-slate-200/80">
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-3/4 h-96 bg-blue-200/25 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Tagline Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-100/80 border border-blue-200 text-blue-950 text-xs sm:text-sm font-bold mb-6 shadow-xs">
            <Sparkles className="w-4 h-4 text-blue-800" />
            <span>Well POS &bull; Platform Kasir Cloud &amp; Logistik Resep Bahan Baku F&amp;B</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-blue-950 tracking-tight leading-[1.15] max-w-4xl mx-auto">
            Satu Platform Kasir Cerdas untuk Semua Toko &amp; Gudang Anda.
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-sm sm:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed font-normal">
            Solusi kasir tangguh berkecepatan tinggi dengan integrasi Resep Bahan Baku F&amp;B otomatis,
            Logistik Gudang Pusat, Kartu Mutasi Stok <em>Real-Time Ledger</em>, hingga Laporan Finansial HPP akurat
            tanpa jeda.
          </p>

          {/* CTA Buttons */}
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Button
              variant="success"
              size="lg"
              icon={<Sparkles className="w-5 h-5 text-amber-300" />}
              onClick={() => {
                setRegisterSuccessData(null);
                setRegisterModalOpen(true);
              }}
              className="w-full sm:w-auto shadow-xl shadow-emerald-600/25 px-8"
            >
              <span>Daftar Akun Baru &amp; Buka Toko</span>
              <ArrowRight className="w-5 h-5 ml-1" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              icon={<LogIn className="w-5 h-5 text-blue-900" />}
              onClick={onOpenPos}
              className="w-full sm:w-auto px-7"
            >
              Login Merchant
            </Button>
          </div>

          {/* Trust Highlights */}
          <div className="mt-14 pt-8 border-t border-slate-200/90 max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-slate-900">Akses Fitur Lengkap</p>
                <p className="text-slate-500">Multi-outlet &amp; gudang aktif</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-slate-900">Setup Cepat 2 Menit</p>
                <p className="text-slate-500">Wizard toko terpandu</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-slate-900">Resep Bahan Baku</p>
                <p className="text-slate-500">Potong stok otomatis</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-slate-900">Isolasi Keamanan RLS</p>
                <p className="text-slate-500">PostgreSQL Bank-Grade</p>
              </div>
            </div>
          </div>
        </div>
      </main>

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
                Akun pemilik bisnis Anda telah berhasil didaftarkan dan sedang menunggu persetujuan Super Admin SaaS.
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
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => {
                setRegisterModalOpen(false);
                onOpenPos();
              }}
            >
              Lanjut ke Halaman Masuk &rarr;
            </Button>
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
              <Button
                type="submit"
                variant="success"
                size="lg"
                loading={loading}
                className="w-full shadow-lg shadow-emerald-600/20 font-bold"
              >
                Daftar Akun Pemilik
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default SaasLandingPage;
