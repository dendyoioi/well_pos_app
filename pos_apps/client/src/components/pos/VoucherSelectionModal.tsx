import React, { useState, useEffect } from 'react';
import {
  X,
  Ticket,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Search,
} from 'lucide-react';
import type { Promotion } from '../../types/promotion';
import { api } from '../../services/api';

export interface VoucherSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtotal: number;
  appliedPromotion: Promotion | null;
  onApplyPromotion: (promo: Promotion) => void;
  onRemovePromotion: () => void;
}

export const VoucherSelectionModal: React.FC<VoucherSelectionModalProps> = ({
  isOpen,
  onClose,
  subtotal,
  appliedPromotion,
  onApplyPromotion,
  onRemovePromotion,
}) => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [couponCodeInput, setCouponCodeInput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPromotions();
      setCouponCodeInput('');
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen]);

  const loadPromotions = async () => {
    try {
      setLoading(true);
      const res = await api.getPromotions({ isActive: true });
      if (res.status === 'success' && res.data) {
        const list = Array.isArray(res.data) ? res.data : (res.data as any).promotions || [];
        setPromotions(list.filter((p: Promotion) => p.isActive));
      }
    } catch (err: any) {
      console.error('Gagal memuat promosi:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleApplyCustomCode = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const code = couponCodeInput.trim().toUpperCase();
    if (!code) {
      setErrorMessage('Silakan ketik kode kupon promo terlebih dahulu.');
      return;
    }

    const matched = promotions.find((p) => p.code.toUpperCase() === code);
    if (!matched) {
      setErrorMessage(`Kupon promo "${code}" tidak ditemukan atau sudah tidak aktif.`);
      return;
    }

    const minAmount = Number(matched.minOrderAmount) || 0;
    if (subtotal < minAmount) {
      const shortage = minAmount - subtotal;
      setErrorMessage(
        `Pesanan belum memenuhi syarat kupon "${matched.code}". Tambah belanja Rp ${shortage.toLocaleString('id-ID')} lagi.`
      );
      return;
    }

    onApplyPromotion(matched);
    setSuccessMessage(`Kupon "${matched.code}" berhasil diterapkan!`);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleSelectPromo = (promo: Promotion) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const minAmount = Number(promo.minOrderAmount) || 0;
    if (subtotal < minAmount) {
      const shortage = minAmount - subtotal;
      setErrorMessage(
        `Subtotal belanja belum mencukupi. Tambahkan pesanan Rp ${shortage.toLocaleString('id-ID')} lagi untuk mengaktifkan promo ini.`
      );
      return;
    }

    onApplyPromotion(promo);
    setSuccessMessage(`Voucher "${promo.code}" berhasil dipasang!`);
    setTimeout(() => {
      onClose();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-xs">
              <Ticket className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Voucher &amp; Promo Kasir</h3>
              <p className="text-[11px] text-slate-500">Pilih voucher atau masukkan kupon promosi</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input Manual Kode Kupon */}
        <div className="p-4 border-b border-slate-100 bg-white">
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Punya Kode Promo / Kupon?
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Contoh: KOPIASIK10 atau HEMAT5RB..."
                value={couponCodeInput}
                onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyCustomCode()}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-900 focus:bg-white uppercase tracking-wider transition-all"
              />
            </div>
            <button
              type="button"
              onClick={handleApplyCustomCode}
              className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs active:scale-95 shrink-0"
            >
              Terapkan
            </button>
          </div>

          {/* Feedback messages */}
          {errorMessage && (
            <div className="mt-2.5 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}
        </div>

        {/* Voucher Sedang Aktif */}
        {appliedPromotion && (
          <div className="p-3 bg-blue-50/70 border-b border-blue-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-900" />
              <div>
                <p className="text-xs font-black text-blue-950">
                  {appliedPromotion.code} — {appliedPromotion.name}
                </p>
                <p className="text-[10px] text-blue-700">
                  {appliedPromotion.discountType === 'PERCENTAGE'
                    ? `Diskon ${appliedPromotion.discountValue}%`
                    : `Potongan Langsung Rp ${Number(appliedPromotion.discountValue).toLocaleString('id-ID')}`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onRemovePromotion}
              className="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-white border border-rose-200 hover:bg-rose-50 rounded-lg transition-colors"
            >
              Lepas Kupon
            </button>
          </div>
        )}

        {/* List Voucher Aktif Tersedia */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Voucher Tersedia untuk Toko Ini</span>
            <span className="text-[11px] text-slate-400">Subtotal: Rp {subtotal.toLocaleString('id-ID')}</span>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs font-medium text-slate-400">
              Memuat daftar promo...
            </div>
          ) : promotions.length === 0 ? (
            <div className="py-8 text-center bg-slate-50 rounded-xl border border-slate-200">
              <Ticket className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
              <p className="text-xs font-bold text-slate-600">Belum ada promo yang aktif</p>
              <p className="text-[11px] text-slate-400">Owner dapat menambah promo di menu Promosi &amp; Kupon</p>
            </div>
          ) : (
            promotions.map((promo) => {
              const isApplied = appliedPromotion?.id === promo.id;
              const minAmount = Number(promo.minOrderAmount) || 0;
              const isEligible = subtotal >= minAmount;
              const shortage = minAmount - subtotal;

              return (
                <div
                  key={promo.id}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isApplied
                      ? 'bg-blue-50/50 border-blue-900 ring-1 ring-blue-900'
                      : isEligible
                      ? 'bg-white border-slate-200 hover:border-blue-900/40 hover:shadow-xs'
                      : 'bg-slate-50 border-slate-200/80 opacity-75'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 font-mono font-black text-xs">
                        {promo.code}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-bold text-[10px]">
                        {promo.discountType === 'PERCENTAGE'
                          ? `Diskon ${promo.discountValue}%`
                          : `Hemat Rp ${Number(promo.discountValue).toLocaleString('id-ID')}`}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-900">{promo.name}</h4>
                    {promo.description && (
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{promo.description}</p>
                    )}

                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                      <span>Min. Belanja: Rp {minAmount.toLocaleString('id-ID')}</span>
                      {promo.discountType === 'PERCENTAGE' && promo.maxDiscountAmount && Number(promo.maxDiscountAmount) > 0 && (
                        <span>Maks. Potongan: Rp {Number(promo.maxDiscountAmount).toLocaleString('id-ID')}</span>
                      )}
                    </div>

                    {!isEligible && (
                      <p className="text-[10px] text-amber-700 font-bold mt-1">
                        ⚠️ Belanja Rp {shortage.toLocaleString('id-ID')} lagi untuk mengaktifkan voucher ini.
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center justify-end">
                    {isApplied ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs shadow-2xs">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Terpasang
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={!isEligible}
                        onClick={() => handleSelectPromo(promo)}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1 ${
                          isEligible
                            ? 'bg-blue-900 hover:bg-blue-800 text-white shadow-xs active:scale-95'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <span>Gunakan</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-400">Promo dipotong otomatis dari subtotal pesanan</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition-colors shadow-2xs"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
