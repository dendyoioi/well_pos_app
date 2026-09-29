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

          {/* Ringkasan Dashboard Pratinjau (Menjembatani Transisi Biru ke Putih) */}
          <div className="mt-14 sm:mt-20 max-w-4xl mx-auto">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-white/20 shadow-2xl p-4 sm:p-7 text-left text-slate-800">
              {/* Top Bar Preview */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-900 flex items-center justify-center font-bold">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">
                      Pratinjau Ringkasan Toko Harian
                    </h3>
                    <p className="text-[11px] text-slate-500">Data penjualan dan mutasi stok tercatat langsung secara otomatis</p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Sistem Siap Digunakan</span>
                </div>
              </div>

              {/* 4 Kartu Metrik Ringkas */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 sm:p-4">
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1">Total Penjualan</span>
                  <div className="text-sm sm:text-lg font-black text-slate-900">Rp 2.850.000</div>
                  <span className="text-[10px] text-emerald-600 font-bold mt-0.5 block">&uarr; Rapi &amp; Real-time</span>
                </div>
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 sm:p-4">
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1">Jumlah Transaksi</span>
                  <div className="text-sm sm:text-lg font-black text-slate-900">42 Pesanan</div>
                  <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">Tunai &amp; Nontunai</span>
                </div>
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 sm:p-4">
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1">Pengingat Stok</span>
                  <div className="text-sm sm:text-lg font-black text-slate-900">0 Stok Menipis</div>
                  <span className="text-[10px] text-blue-600 font-bold mt-0.5 block">Persediaan Aman</span>
                </div>
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 sm:p-4">
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1">Status Kasir</span>
                  <div className="text-sm sm:text-lg font-black text-slate-900">Shift Buka</div>
                  <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">Kas Awal Sesuai</span>
                </div>
              </div>
            </div>
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
