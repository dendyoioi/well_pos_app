import React, { useState } from 'react';
import {
  Store,
  Printer,
  UserCheck,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  X,
  Shield,
  Mail,
  Phone,
  User as UserIcon,
  ShieldCheck,
  KeyRound,
} from 'lucide-react';
import { api } from '../../services/api';
import { validateIndonesianWhatsApp } from '../../utils/phone';
import { WhatsAppInput } from '../ui';
import type { User } from '../../types/auth';

interface OnboardingWizardModalProps {
  isOpen: boolean;
  onClose?: () => void;
  outletId: string;
  businessName: string;
  currentUser?: User | null;
  onComplete: () => void;
}

export const OnboardingWizardModal: React.FC<OnboardingWizardModalProps> = ({
  isOpen,
  onClose,
  outletId,
  businessName,
  currentUser,
  onComplete,
}) => {
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 2: Profil Toko & Hotline (Kosong secara default, diisi oleh merchant)
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  // Step 2: Konfigurasi Struk Toko
  const [receiptSize, setReceiptSize] = useState<'58mm' | '80mm'>('58mm');
  const [receiptFooter, setReceiptFooter] = useState(
    `Terima kasih telah berbelanja di ${businessName}! Simpan struk ini sebagai bukti transaksi resmi.`
  );

  // Step 3: Akun Supervisor & Kasir
  const [spvName, setSpvName] = useState('Dimas (SPV)');
  const [spvPin, setSpvPin] = useState('654321');

  const [cashierName, setCashierName] = useState('Rian (Kasir 1)');
  const [cashierPin, setCashierPin] = useState('123456');

  if (!isOpen) return null;

  const handleFinishOnboarding = async () => {
    setError(null);

    if (!spvName.trim()) {
      setError('Harap isi nama supervisor (SPV)');
      return;
    }
    if (!/^\d{6}$/.test(spvPin)) {
      setError('PIN supervisor harus 6 digit angka');
      return;
    }
    if (!cashierName.trim()) {
      setError('Harap isi nama staf kasir');
      return;
    }
    if (!/^\d{6}$/.test(cashierPin)) {
      setError('PIN kasir harus 6 digit angka');
      return;
    }

    setLoading(true);

    try {
      const res = await api.saasOnboard({
        outletId,
        address: address.trim(),
        phone: phone.trim(),
        receiptSize,
        receiptFooter: receiptFooter.trim(),
        spvName: spvName.trim(),
        spvPin: spvPin.trim(),
        cashierName: cashierName.trim(),
        cashierPin: cashierPin.trim(),
      });

      if (res.status === 'success') {
        onComplete();
      } else {
        setError(res.message || 'Gagal menyimpan pengaturan onboarding');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat memproses onboarding');
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = () => {
    setError(null);

    if (step === 2) {
      if (!address.trim()) {
        setError('Alamat fisik toko / outlet wajib diisi');
        return;
      }
      if (!phone.trim()) {
        setError('Nomor WhatsApp hotline toko wajib diisi');
        return;
      }
      const valRes = validateIndonesianWhatsApp(phone);
      if (!valRes.isValid) {
        setError(valRes.message || 'Nomor WhatsApp hotline toko tidak valid');
        return;
      }
    }

    setStep((s) => s + 1);
  };

  const ownerPhone = currentUser?.tenant?.phone || (currentUser as any)?.phone || '-';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] relative">
        {/* Header Wizard (Layout Atas-Bawah yang Proporsional) */}
        <div className="p-6 bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 text-white relative">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-5 right-5 text-blue-300 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
              title="Tutup Wizard (Lanjutkan Setup Nanti)"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Baris Atas: Badge Nama Toko / Outlet */}
          <div className="mb-2.5 pr-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-800/80 border border-blue-400/30 text-xs font-bold text-blue-100 shadow-sm max-w-full">
              <Store className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span className="truncate">{businessName}</span>
            </span>
          </div>

          {/* Baris Bawah: Title & Step Counter */}
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-black tracking-wide">
              {step}/3
            </span>
            <h3 className="font-black text-lg sm:text-xl text-white tracking-tight">
              Setup Awal &amp; Onboarding Toko
            </h3>
          </div>

          <p className="text-xs text-blue-200/85 leading-relaxed">
            Selesaikan 3 langkah panduan mudah berikut untuk meninjau profil pemilik, melengkapi data toko, dan menyiapkan staf operasional.
          </p>

          {/* Stepper Progress Bar (3 Langkah) */}
          <div className="grid grid-cols-3 gap-2.5 mt-4">
            {[
              { num: 1, label: '1. Profil Owner' },
              { num: 2, label: '2. Profil Toko' },
              { num: 3, label: '3. Akun SPV & Kasir' },
            ].map((s) => (
              <div key={s.num} className="flex flex-col gap-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    step >= s.num ? 'bg-emerald-400' : 'bg-blue-800/60'
                  }`}
                />
                <span
                  className={`text-[11px] truncate font-bold ${
                    step === s.num ? 'text-white' : 'text-blue-300/70'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Wizard Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* STEP 1: PREVIEW PROFIL OWNER (READ-ONLY) */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
                  <ShieldCheck className="w-4 h-4 text-blue-900" />
                  <span>Langkah 1: Preview Profil Pemilik Usaha (Owner)</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  Terverifikasi &amp; Aktif
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                {/* Nama Pemilik */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center shrink-0 mt-0.5">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wide">
                      Nama Lengkap Pemilik (Owner)
                    </span>
                    <span className="text-sm font-black text-slate-900 block">
                      {currentUser?.name || 'Pemilik Usaha'}
                    </span>
                  </div>
                </div>

                {/* Email Akun */}
                <div className="flex items-start gap-3 pt-2 border-t border-slate-200/70">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-900 flex items-center justify-center shrink-0 mt-0.5">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wide">
                      Email Akun Owner
                    </span>
                    <span className="text-xs font-bold text-slate-800 font-mono block">
                      {currentUser?.email || '-'}
                    </span>
                  </div>
                </div>

                {/* WhatsApp Terdaftar */}
                <div className="flex items-start gap-3 pt-2 border-t border-slate-200/70">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wide">
                      Nomor WhatsApp Terdaftar
                    </span>
                    <span className="text-xs font-bold text-slate-900 font-mono block">
                      {ownerPhone}
                    </span>
                  </div>
                </div>

                {/* Hak Akses */}
                <div className="flex items-start gap-3 pt-2 border-t border-slate-200/70">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-900 flex items-center justify-center shrink-0 mt-0.5">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wide">
                      Peran &amp; Hak Akses
                    </span>
                    <span className="text-xs font-extrabold text-purple-950 block">
                      Pemilik Usaha (Owner / Akses Administrator Penuh)
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-start gap-2.5 text-xs text-blue-950">
                <Sparkles className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Data profil di atas diambil langsung saat pendaftaran dan <span className="font-bold">tidak dapat diedit</span> pada langkah ini. Nama usaha tercantum pada panel wizard di atas. Silakan lanjut untuk melengkapi profil operasional outlet toko utama.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: PROFIL TOKO & HOTLINE & STRUK */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm border-b pb-2">
                <Store className="w-4 h-4 text-blue-900" />
                <span>Langkah 2: Profil &amp; Kontak Operasional Toko</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alamat Fisik Toko / Outlet <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Contoh: Jl. Senopati No. 45, Kebayoran Baru, Jakarta Selatan"
                  className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl p-3 text-xs font-medium outline-none resize-none placeholder:text-slate-400"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Alamat fisik operasional ini akan otomatis tercetak di header struk kasir dan faktur penjualan.
                </p>
              </div>

              <WhatsAppInput
                label="Nomor WhatsApp / Hotline Toko"
                value={phone}
                onChange={(val) => {
                  setPhone(val);
                  if (error) setError(null);
                }}
                placeholder="81234567890"
                helperText="Nomor hotline operasional toko (tercetak di struk belanja untuk layanan pelanggan). Berbeda dari nomor kontak pribadi Owner."
                required
              />

              {/* Ukuran Struk Default */}
              <div className="pt-2 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Printer className="w-3.5 h-3.5 text-blue-900" />
                    <span>Pilih Ukuran Kertas Struk Default:</span>
                  </span>
                  <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full font-bold">
                    Otomatis Default di Kasir
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-3 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setReceiptSize('58mm')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      receiptSize === '58mm'
                        ? 'bg-blue-50/80 border-blue-900 text-blue-950 shadow-sm ring-1 ring-blue-900'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-extrabold text-xs flex items-center justify-between">
                      <span>58mm (Printer Portable)</span>
                      {receiptSize === '58mm' && <CheckCircle className="w-4 h-4 text-blue-900" />}
                    </div>
                    <p className="text-[10.5px] text-slate-500 mt-1 leading-snug">
                      Printer Bluetooth portable &amp; kasir mobile counter sempit.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReceiptSize('80mm')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      receiptSize === '80mm'
                        ? 'bg-blue-50/80 border-blue-900 text-blue-950 shadow-sm ring-1 ring-blue-900'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-extrabold text-xs flex items-center justify-between">
                      <span>80mm (Printer Desktop)</span>
                      {receiptSize === '80mm' && <CheckCircle className="w-4 h-4 text-blue-900" />}
                    </div>
                    <p className="text-[10.5px] text-slate-500 mt-1 leading-snug">
                      Standar meja kasir USB/LAN. Layout struk lebih lebar.
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pesan Kaki / Footer Struk:
                </label>
                <textarea
                  rows={2}
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                  placeholder="Pesan penutup atau ucapan terima kasih di bawah struk..."
                  className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl p-3 text-xs font-medium outline-none resize-none"
                />
              </div>
            </div>
          )}

          {/* STEP 3: KELOLA AKUN SPV & KASIR (1 FORM DENGAN 2 FUNGSI) */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm border-b pb-2">
                <UserCheck className="w-4 h-4 text-blue-900" />
                <span>Langkah 3: Kelola Akun Staf (Supervisor &amp; Kasir)</span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Siapkan 2 akun operasional toko dalam formulir ini untuk memisahkan wewenang otorisasi khusus dan transaksi kasir harian:
              </p>

              {/* FUNGSI 1: AKUN SUPERVISOR (SPV) */}
              <div className="bg-amber-50/50 border border-amber-200/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-950 font-black text-xs">
                    <Shield className="w-4 h-4 text-amber-600" />
                    <span>1. Akun Supervisor (SPV)</span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-200">
                    Otorisasi &amp; Supervisi
                  </span>
                </div>

                <p className="text-[11px] text-amber-900/80 leading-snug">
                  Wewenang SPV: Menyetujui diskon kasir, pembatalan/void nota transaksi, dan penutupan shift.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Supervisor <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={spvName}
                      onChange={(e) => {
                        setSpvName(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="misal: Dimas (SPV)"
                      className="w-full bg-white border border-slate-300 focus:border-amber-600 text-slate-900 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>PIN Cepat SPV (6 Digit) <span className="text-rose-500">*</span></span>
                      <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                    </label>
                    <input
                      type="password"
                      maxLength={6}
                      required
                      value={spvPin}
                      onChange={(e) => {
                        setSpvPin(e.target.value.replace(/\D/g, ''));
                        if (error) setError(null);
                      }}
                      placeholder="654321"
                      className="w-full bg-white border border-slate-300 focus:border-amber-600 text-slate-900 rounded-xl px-3 py-2 text-sm tracking-widest font-black outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* FUNGSI 2: AKUN KASIR (FRONTLINER) */}
              <div className="bg-blue-50/50 border border-blue-200/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-950 font-black text-xs">
                    <UserCheck className="w-4 h-4 text-blue-800" />
                    <span>2. Akun Staf Kasir (Frontliner)</span>
                  </div>
                  <span className="text-[10px] font-bold text-blue-800 bg-blue-100/80 px-2 py-0.5 rounded-full border border-blue-200">
                    Kasir &amp; POS
                  </span>
                </div>

                <p className="text-[11px] text-blue-900/80 leading-snug">
                  Wewenang Kasir: Melayani transaksi penjualan meja kasir, membuka shift &amp; laci uang, serta cetak struk.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Kasir <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={cashierName}
                      onChange={(e) => {
                        setCashierName(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="misal: Rian (Kasir 1)"
                      className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>PIN Cepat Kasir (6 Digit) <span className="text-rose-500">*</span></span>
                      <KeyRound className="w-3.5 h-3.5 text-blue-800" />
                    </label>
                    <input
                      type="password"
                      maxLength={6}
                      required
                      value={cashierPin}
                      onChange={(e) => {
                        setCashierPin(e.target.value.replace(/\D/g, ''));
                        if (error) setError(null);
                      }}
                      placeholder="123456"
                      className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl px-3 py-2 text-sm tracking-widest font-black outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Navigation Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-2 py-1"
            >
              Lewati Setup (Nanti)
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <span>Lanjut</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={handleFinishOnboarding}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
            >
              {loading ? (
                <span>Menyimpan Akun &amp; Toko...</span>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Simpan &amp; Buka Mesin Kasir</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
