import React, { useState } from 'react';
import {
  X,
  Coffee,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Building2,
  Store,
  Info,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import type { BusinessItem, BusinessVerticalMode } from '../../types/business';
import { businessApi } from '../../services/api';
import { WhatsAppInput } from '../ui/WhatsAppInput';
import { useDialog } from '../../context/DialogContext';

export interface CreateBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (result: { business: BusinessItem; outlet: any }) => void;
}

interface VerticalOption {
  key: BusinessVerticalMode;
  title: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  features: string[];
  theme: {
    activeBorder: string;
    activeBg: string;
    badgeBg: string;
    badgeText: string;
    iconBg: string;
    iconText: string;
  };
}

const VERTICAL_OPTIONS: VerticalOption[] = [
  {
    key: 'FNB',
    title: 'F&B / Kafe & Restoran',
    badge: 'Food & Beverage',
    description: 'Menu kuliner, modifier/topping, manajemen meja & QR Self-Order, resep bahan baku dapur.',
    icon: Coffee,
    features: ['Meja Dine-in & QR Menu', 'Resep HPP Dapur', 'Tiket Bar & Dapur'],
    theme: {
      activeBorder: 'border-amber-500 ring-2 ring-amber-500/20',
      activeBg: 'bg-amber-50/40',
      badgeBg: 'bg-amber-100',
      badgeText: 'text-amber-800',
      iconBg: 'bg-amber-500 text-white',
      iconText: 'text-amber-600',
    },
  },
  {
    key: 'RETAIL',
    title: 'Retail / Minimarket & Toko',
    badge: 'Retail & Toko',
    description: 'Katalog produk SKU/Barcode, harga grosir multi-tier, mode gudang induk & mutasi stok.',
    icon: ShoppingBag,
    features: ['Scan Barcode Kasir', 'Harga Grosir / Tier', 'Multi-Gudang & Transfer'],
    theme: {
      activeBorder: 'border-emerald-600 ring-2 ring-emerald-600/20',
      activeBg: 'bg-emerald-50/40',
      badgeBg: 'bg-emerald-100',
      badgeText: 'text-emerald-800',
      iconBg: 'bg-emerald-600 text-white',
      iconText: 'text-emerald-600',
    },
  },
  {
    key: 'LAUNDRY',
    title: 'Laundry & Dry Clean',
    badge: 'Binatu & Wet Clean',
    description: 'Layanan kiloan & satuan, 11 tahap produksi, rak simpan, tracking mesin, kuota & deposit.',
    icon: Sparkles,
    features: ['11 Tahap Alur Cuci-Setrika', 'Pelacakan Mesin Cuci', 'Deposit & Saldo Member'],
    theme: {
      activeBorder: 'border-blue-600 ring-2 ring-blue-600/20',
      activeBg: 'bg-blue-50/40',
      badgeBg: 'bg-blue-100',
      badgeText: 'text-blue-800',
      iconBg: 'bg-blue-600 text-white',
      iconText: 'text-blue-600',
    },
  },
];

export const CreateBusinessModal: React.FC<CreateBusinessModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { toast } = useDialog();

  // Wizard Step State
  const [step, setStep] = useState<1 | 2>(1);

  // Form State - Step 1
  const [vertical, setVertical] = useState<BusinessVerticalMode>('FNB');
  const [businessName, setBusinessName] = useState('');
  const [subCategory, setSubCategory] = useState('');

  // Form State - Step 2
  const [outletName, setOutletName] = useState('');
  const [outletPhone, setOutletPhone] = useState('');
  const [outletAddress, setOutletAddress] = useState('');
  const [isWorkshop, setIsWorkshop] = useState(true);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleNextToStep2 = () => {
    if (!businessName.trim() || businessName.trim().length < 2) {
      setErrorText('Nama bisnis minimal 2 karakter.');
      return;
    }
    setErrorText(null);
    if (!outletName.trim()) {
      setOutletName(`Outlet ${businessName.trim()} 1`);
    }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outletName.trim() || outletName.trim().length < 2) {
      setErrorText('Nama cabang / toko pertama minimal 2 karakter.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorText(null);

      const res = await businessApi.createBusiness({
        name: businessName.trim(),
        vertical,
        subCategory: subCategory.trim() || null,
        initialOutlet: {
          name: outletName.trim(),
          address: outletAddress.trim() || null,
          phone: outletPhone.trim() || null,
          isWorkshop: vertical === 'LAUNDRY' ? isWorkshop : false,
        },
      });

      if (res.status === 'success' && res.data) {
        toast(`Bisnis "${res.data.business.name}" berhasil dibuat!`, 'success');
        onCreated(res.data);
        handleClose();
      } else {
        setErrorText(res.message || 'Gagal membuat bisnis baru');
      }
    } catch (err: any) {
      console.error('Error saat submit buat bisnis:', err);
      setErrorText(err?.message || 'Terjadi kesalahan sistem saat membuat bisnis baru');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setStep(1);
    setBusinessName('');
    setSubCategory('');
    setOutletName('');
    setOutletPhone('');
    setOutletAddress('');
    setIsWorkshop(true);
    setErrorText(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden border border-slate-100"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-900 text-white flex items-center justify-center shadow-md shadow-blue-900/10">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-snug">
                {step === 1 ? 'Buat Entitas Bisnis Baru' : 'Atur Toko / Cabang Pertama'}
              </h3>
              <p className="text-xs text-slate-500">
                Langkah {step} dari 2 — {step === 1 ? 'Pilih Vertikal & Identitas Brand' : 'Pengaturan Operasional Cabang'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 transition-colors"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="px-6 pt-3 pb-1 bg-slate-50/40 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                step >= 1 ? 'bg-blue-900' : 'bg-slate-200'
              }`}
            />
            <div
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                step >= 2 ? 'bg-blue-900' : 'bg-slate-200'
              }`}
            />
          </div>
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-6 overflow-y-auto overscroll-contain flex-1 space-y-5">
            {errorText && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5 animate-shake">
                <Info className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{errorText}</span>
              </div>
            )}

            {/* ======================================================== */}
            {/* STEP 1: PILIH VERTIKAL & IDENTITAS BRAND */}
            {/* ======================================================== */}
            {step === 1 && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    1. Pilih Jenis Vertikal Usaha <span className="text-rose-500">*</span>
                  </label>
                  <p className="text-xs text-slate-500 mb-3">
                    Setiap jenis usaha memiliki alur kasir, modul stok, dan dashboard yang dirancang khusus:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {VERTICAL_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = vertical === opt.key;
                      return (
                        <div
                          key={opt.key}
                          onClick={() => setVertical(opt.key)}
                          className={`relative cursor-pointer p-4 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between text-left ${
                            isSelected
                              ? `${opt.theme.activeBorder} ${opt.theme.activeBg} shadow-md`
                              : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                                  isSelected ? opt.theme.iconBg : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                <Icon className="w-5 h-5" />
                              </div>
                              {isSelected ? (
                                <div className="w-5 h-5 rounded-full bg-blue-900 text-white flex items-center justify-center">
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full border border-slate-300" />
                              )}
                            </div>
                            <span
                              className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md inline-block mb-1 ${opt.theme.badgeBg} ${opt.theme.badgeText}`}
                            >
                              {opt.badge}
                            </span>
                            <h4 className="text-sm font-bold text-slate-900 mb-1.5 leading-tight">{opt.title}</h4>
                            <p className="text-[11px] text-slate-500 line-clamp-3 leading-relaxed">
                              {opt.description}
                            </p>
                          </div>

                          <div className="mt-3 pt-3 border-t border-slate-100/80 space-y-1">
                            {opt.features.map((feat, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 text-[10px] text-slate-600">
                                <CheckCircle2 className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{feat}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Input Nama Bisnis */}
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      2. Nama Bisnis / Brand <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder={
                        vertical === 'LAUNDRY'
                          ? 'contoh: Berkah Laundry Express'
                          : vertical === 'FNB'
                          ? 'contoh: Kopi Kenangan Nusantara'
                          : 'contoh: Toko Sinar Jaya Makmur'
                      }
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Nama brand utama bisnis ini. Dapat diubah sewaktu-waktu di pengaturan portal.
                    </p>
                  </div>

                  {/* Input Sub-Kategori */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      3. Sub-Kategori / Model Usaha <span className="text-slate-400 font-normal">(Opsional)</span>
                    </label>
                    <input
                      type="text"
                      value={subCategory}
                      onChange={(e) => setSubCategory(e.target.value)}
                      placeholder={
                        vertical === 'LAUNDRY'
                          ? 'contoh: Kiloan, Satuan & Sepatu'
                          : vertical === 'FNB'
                          ? 'contoh: Kedai Kopi & Bakery'
                          : 'contoh: Minimarket & Toko Kelontong'
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 text-sm text-slate-900 placeholder:text-slate-400 transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* STEP 2: DATA OUTLET / CABANG PERTAMA */}
            {/* ======================================================== */}
            {step === 2 && (
              <div className="space-y-4 animate-fade-in">
                <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-900 text-white flex items-center justify-center shrink-0">
                    <Store className="w-4 h-4" />
                  </div>
                  <div className="text-xs text-blue-950">
                    <p className="font-bold mb-0.5">Setup Cabang / Toko Pertama</p>
                    <p className="text-blue-800/80 leading-relaxed">
                      Bisnis <span className="font-semibold text-blue-900">"{businessName}"</span> membutuhkan minimal
                      1 toko fisik/operasional untuk mulai melayani transaksi kasir.
                    </p>
                  </div>
                </div>

                {/* Nama Outlet */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nama Toko / Outlet Pertama <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={outletName}
                    onChange={(e) => setOutletName(e.target.value)}
                    placeholder="contoh: Cabang Tebet / Pusat"
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all"
                  />
                </div>

                {/* Nomor WhatsApp Outlet */}
                <div>
                  <WhatsAppInput
                    label="Nomor WhatsApp Toko"
                    value={outletPhone}
                    onChange={setOutletPhone}
                    placeholder="81234567890"
                    helperText="Digunakan untuk pengiriman struk digital & notifikasi pesanan ke pelanggan."
                  />
                </div>

                {/* Alamat Lengkap */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Alamat Lengkap Toko <span className="text-slate-400 font-normal">(Opsional)</span>
                  </label>
                  <textarea
                    value={outletAddress}
                    onChange={(e) => setOutletAddress(e.target.value)}
                    placeholder="contoh: Jl. Tebet Barat Dalam No. 12, Jakarta Selatan"
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 text-sm text-slate-900 placeholder:text-slate-400 transition-all resize-none"
                  />
                </div>

                {/* Toggle Khusus Workshop Laundry */}
                {vertical === 'LAUNDRY' && (
                  <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">Berfungsi sebagai Workshop Pusat</h5>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Outlet ini memiliki fasilitas mesin cuci/pengering aktif dan dapat memproses cucian kiriman dari cabang satelit.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                      <input
                        type="checkbox"
                        checked={isWorkshop}
                        onChange={(e) => setIsWorkshop(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-900" />
                    </label>
                  </div>
                )}

                {/* Banner Token Info */}
                <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-[11px] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Pembuatan Gratis</strong>: Membuat bisnis dan outlet baru tidak memotong token. Token
                    Pay-As-You-Go hanya terpotong saat terjadi transaksi kasir.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Sticky Action Footer */}
          <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {step === 1 ? (
              <>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleNextToStep2}
                  disabled={!businessName.trim() || businessName.trim().length < 2}
                  className="px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-all"
                >
                  <span>Lanjut ke Outlet</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Kembali</span>
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !outletName.trim()}
                  className="px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs flex items-center gap-2 shadow-md shadow-blue-900/10 transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Membuat Bisnis...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Buat Bisnis Sekarang</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
