import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ShieldCheck,
  X,
  KeyRound,
  FileText,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import type { Order } from '../types/order';
import { api, authStorage } from '../services/api';

interface VoidOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onSuccess: (orderId: string, invoiceNumber: string) => void;
}

const COMMON_REASONS = [
  'Salah Input Item / Menu',
  'Pelanggan Batal Beli',
  'Salah Pilih Metode Bayar',
  'Input Transaksi Ganda (Duplikat)',
  'Komplain Kualitas / Barang Rusak',
];

export const VoidOrderModal: React.FC<VoidOrderModalProps> = ({
  isOpen,
  onClose,
  order,
  onSuccess,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>(COMMON_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [isOtherReason, setIsOtherReason] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentUser = authStorage.getUser();
  const isPrivileged = currentUser && ['OWNER', 'ADMIN', 'SUPERVISOR'].includes(currentUser.role);

  useEffect(() => {
    if (isOpen) {
      setSelectedReason(COMMON_REASONS[0]);
      setCustomReason('');
      setIsOtherReason(false);
      setNotes('');
      setPin('');
      setErrorMsg(null);
      setLoading(false);
    }
  }, [isOpen, order?.id]);

  if (!isOpen || !order) return null;

  const finalReason = isOtherReason ? customReason.trim() : selectedReason;
  const isPinRequired = !isPrivileged;
  const isFormValid = finalReason.length > 0 && (!isPinRequired || pin.trim().length >= 4);

  const handleConfirmVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || loading) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await api.voidOrder(order.id, {
        pin: pin.trim() || undefined,
        reason: finalReason,
        notes: notes.trim() || undefined,
      });

      if (res.status === 'success') {
        onSuccess(order.id, order.invoiceNumber);
        onClose();
      } else {
        setErrorMsg(res.message || 'Gagal membatalkan transaksi');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem saat memproses void');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-rose-100 flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
        {/* Modal Header - Sticky */}
        <div className="bg-rose-50/80 px-6 py-4 border-b border-rose-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shadow-xs">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="font-extrabold text-rose-950 text-base leading-tight">
                Batalkan Transaksi (VOID)
              </h3>
              <p className="text-xs text-rose-700 font-medium">
                Persetujuan Supervisor / Owner Diperlukan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleConfirmVoid} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
          {/* Order Summary Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Nomor Faktur:</span>
              <span className="font-mono font-bold text-slate-900">{order.invoiceNumber}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Pelanggan:</span>
              <span className="font-semibold text-slate-800">
                {order.customerName || 'Pelanggan Umum'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Total Tagihan:</span>
              <span className="font-black text-rose-700 text-sm">
                Rp {Number(order.grandTotal).toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Warning Banner */}
          <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl flex items-start gap-2.5 text-amber-900 text-xs leading-relaxed">
            <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <span>
              Tindakan ini akan <strong>mengembalikan stok produk/bahan</strong> secara otomatis,
              mencabut omzet dari laporan shift kasir, dan mencatat audit resmi ke sistem.
            </span>
          </div>

          {/* Reason Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              Alasan Pembatalan (VOID) <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {COMMON_REASONS.map((reason) => {
                const isSelected = !isOtherReason && selectedReason === reason;
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => {
                      setIsOtherReason(false);
                      setSelectedReason(reason);
                    }}
                    className={`text-left px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{reason}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-rose-600" />}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setIsOtherReason(true)}
                className={`text-left px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center justify-between cursor-pointer ${
                  isOtherReason
                    ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>Alasan Lainnya...</span>
                {isOtherReason && <CheckCircle2 className="w-4 h-4 text-rose-600" />}
              </button>
            </div>

            {isOtherReason && (
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Ketik alasan pembatalan spesifik..."
                className="w-full mt-2 px-3.5 py-2 text-xs border border-rose-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                autoFocus
              />
            )}
          </div>

          {/* Optional Notes */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700">
              Catatan Tambahan (Opsional)
            </label>
            <div className="relative">
              <FileText className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Misal: Nomor bukti transfer retur atau nama supervisor yang menyetujui di tempat..."
                rows={2}
                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Supervisor / Owner Approval PIN */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-rose-600" />
                <span>PIN Persetujuan Supervisor / Owner</span>
                {isPinRequired && <span className="text-rose-500">*</span>}
              </label>
              {isPrivileged && (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>{currentUser.role} Login</span>
                </span>
              )}
            </div>

            {isPrivileged ? (
              <p className="text-[11px] text-slate-500">
                Anda sedang login sebagai <strong>{currentUser?.name || currentUser?.role}</strong>. PIN opsional (bisa langsung diproses atau masukkan PIN supervisor lain).
              </p>
            ) : (
              <p className="text-[11px] text-slate-500">
                Kasir wajib meminta Supervisor atau Owner untuk memasukkan 6-digit PIN otorisasi mereka di bawah ini.
              </p>
            )}

            <div className="relative">
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder={isPrivileged ? 'PIN Otorisasi (Opsional)' : 'Masukkan 6 Digit PIN Supervisor'}
                className="w-full px-4 py-2.5 text-center font-mono text-base tracking-[0.3em] font-black border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-600 transition-all bg-slate-50 focus:bg-white"
                autoComplete="off"
              />
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          </div>

          {/* Modal Actions - Sticky Bottom with Safe Area */}
          <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Kembali
            </button>
            <button
              type="submit"
              disabled={!isFormValid || loading}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memproses VOID...</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Konfirmasi VOID</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
