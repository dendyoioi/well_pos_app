import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ShieldCheck,
  X,
  KeyRound,
  Lock,
  PackageX,
} from 'lucide-react';
import type { Order } from '../types/order';
import { api, authStorage } from '../services/api';

interface VoidOrderItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  orderItem: any | null;
  onSuccess: (orderId: string, invoiceNumber: string, itemName: string) => void;
}

const COMMON_ITEM_REASONS = [
  'Salah Input Menu oleh Kasir',
  'Pelanggan Batal Memesan Menu Ini',
  'Stok / Bahan Baku Menu Habis',
  'Komplain Kualitas / Masakan Rusak',
  'Menu Terganti dengan Item Lain',
];

export const VoidOrderItemModal: React.FC<VoidOrderItemModalProps> = ({
  isOpen,
  onClose,
  order,
  orderItem,
  onSuccess,
}) => {
  const [voidQty, setVoidQty] = useState<number>(1);
  const [selectedReason, setSelectedReason] = useState<string>(COMMON_ITEM_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [isOtherReason, setIsOtherReason] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentUser = authStorage.getUser();
  const isPrivileged = currentUser && ['OWNER', 'ADMIN', 'SUPERVISOR'].includes(currentUser.role);

  useEffect(() => {
    if (isOpen && orderItem) {
      setVoidQty(Math.min(1, Number(orderItem.quantity || 1)));
      setSelectedReason(COMMON_ITEM_REASONS[0]);
      setCustomReason('');
      setIsOtherReason(false);
      setNotes('');
      setPin('');
      setErrorMsg(null);
      setLoading(false);
    }
  }, [isOpen, orderItem]);

  if (!isOpen || !order || !orderItem) return null;

  const currentMaxQty = Number(orderItem.quantity || 1);
  const finalReason = isOtherReason ? customReason.trim() : selectedReason;
  const isPinRequired = !isPrivileged;
  const isFormValid =
    voidQty > 0 &&
    voidQty <= currentMaxQty &&
    finalReason.length > 0 &&
    (!isPinRequired || pin.trim().length >= 4);

  const prodName =
    orderItem.product?.name || orderItem.productName || orderItem.name || 'Produk';
  const variantName = orderItem.variantName || orderItem.productVariant?.name;
  const unitPrice = Number(orderItem.unitPrice || 0);
  const estimatedRefund = unitPrice * voidQty;

  const handleConfirmVoidItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || loading) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await api.voidOrderItem(order.id, {
        orderItemId: orderItem.id,
        quantityToVoid: voidQty,
        pin: pin.trim() || undefined,
        reason: finalReason,
        notes: notes.trim() || undefined,
      });

      if (res.status === 'success') {
        onSuccess(order.id, order.invoiceNumber, prodName);
        onClose();
      } else {
        setErrorMsg(res.message || 'Gagal membatalkan item pesanan');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem saat memproses void item');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-amber-200 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-amber-50/80 px-6 py-4 border-b border-amber-200/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shadow-xs">
              <PackageX className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Pembatalan (Void) Item Pesanan</h3>
              <p className="text-xs text-slate-500 font-mono">Faktur: {order.invoiceNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleConfirmVoidItem} className="p-6 space-y-4 overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 font-medium animate-in fade-in duration-150">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Item Info Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 text-sm">{prodName}</span>
                {variantName && (
                  <span className="ml-2 inline-block text-[10px] text-blue-900 font-semibold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                    {variantName}
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-500 font-mono">
                Total di Order: <strong className="text-slate-800">{currentMaxQty}x</strong>
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-600 pt-1 border-t border-slate-200/60">
              <span>Harga Satuan: Rp {unitPrice.toLocaleString('id-ID')}</span>
              <span className="font-bold text-slate-900">
                Subtotal Item: Rp {Number(orderItem.subtotal || 0).toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Jumlah Qty yang Di-void */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Jumlah Item yang Dibatalkan (Qty)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={currentMaxQty}
                value={voidQty}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (isNaN(val)) setVoidQty(1);
                  else setVoidQty(Math.max(1, Math.min(val, currentMaxQty)));
                }}
                disabled={loading}
                className="w-24 px-3 py-2 border border-slate-300 rounded-xl text-center font-bold text-slate-900 text-base focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
              <span className="text-xs text-slate-500">
                dari total <strong className="text-slate-800">{currentMaxQty}</strong> porsi
              </span>
              <div className="ml-auto text-right">
                <span className="text-[11px] text-slate-400 block">Potongan Nilai:</span>
                <span className="text-sm font-bold text-rose-600 font-mono">
                  -Rp {estimatedRefund.toLocaleString('id-ID')}
                </span>
              </div>
            </div>
            {voidQty === currentMaxQty && (
              <p className="mt-1 text-[11px] text-amber-700 font-medium">
                Catatan: Membatalkan seluruh qty akan menghapus item ini dari faktur secara permanen.
              </p>
            )}
          </div>

          {/* Pilihan Alasan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Alasan Pembatalan Item <span className="text-rose-500">*</span>
            </label>
            <select
              value={isOtherReason ? 'OTHER' : selectedReason}
              onChange={(e) => {
                if (e.target.value === 'OTHER') {
                  setIsOtherReason(true);
                } else {
                  setIsOtherReason(false);
                  setSelectedReason(e.target.value);
                }
              }}
              disabled={loading}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden bg-white"
            >
              {COMMON_ITEM_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
              <option value="OTHER">Lainnya (Ketik Manual)...</option>
            </select>

            {isOtherReason && (
              <input
                type="text"
                placeholder="Tuliskan alasan pembatalan item..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                disabled={loading}
                required
                className="mt-2 w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            )}
          </div>

          {/* Catatan Tambahan (Opsional) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Catatan Internal / Keterangan (Opsional)
            </label>
            <textarea
              rows={2}
              placeholder="Catatan tambahan untuk audit supervisor..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden resize-none"
            />
          </div>

          {/* Otorisasi PIN Supervisor / Owner */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                <span>Otorisasi PIN Supervisor / Owner</span>
                {isPinRequired && <span className="text-rose-500">*</span>}
              </label>
              {isPrivileged && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Mode {currentUser?.role} Aktif
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="password"
                maxLength={6}
                placeholder={isPrivileged ? 'Opsional: Masukkan PIN Supervisor lain jika didelegasikan' : 'Masukkan PIN 6 Digit Supervisor'}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                disabled={loading}
                className="w-full px-3.5 py-2.5 pr-10 border border-slate-300 rounded-xl text-xs font-mono tracking-widest text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
              <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none">
                <Lock className="w-4 h-4" />
              </div>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {isPrivileged
                ? 'Sebagai Supervisor/Owner, Anda dapat langsung mengesahkan tanpa PIN, atau masukkan PIN rekan pengawas.'
                : 'Kasir wajib memanggil Supervisor/Owner untuk memasukkan PIN persetujuan sebelum item dapat dibatalkan.'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Kembali
            </button>
            <button
              type="submit"
              disabled={!isFormValid || loading}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              {loading ? (
                <span>Memproses...</span>
              ) : (
                <>
                  <PackageX className="w-4 h-4" />
                  <span>Sahkan Batal Item</span>
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
