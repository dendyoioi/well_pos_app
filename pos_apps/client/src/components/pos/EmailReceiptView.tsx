import React from 'react';
import { Mail, ArrowLeft, X, Send, ExternalLink } from 'lucide-react';
import type { Order } from '../../types/order';

interface EmailReceiptViewProps {
  order: Order;
  onBack: () => void;
  onClose: () => void;
  recipientEmail: string;
  setRecipientEmail: (val: string) => void;
  sendingEmail: boolean;
  emailStatus: {
    type: 'success' | 'error';
    message: string;
    previewUrl?: string;
  } | null;
  handleSendEmail: (e: React.FormEvent) => void;
}

export const EmailReceiptView: React.FC<EmailReceiptViewProps> = ({
  order,
  onBack,
  onClose,
  recipientEmail,
  setRecipientEmail,
  sendingEmail,
  emailStatus,
  handleSendEmail,
}) => {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white">
      {/* Header Email Client */}
      <div className="shrink-0 px-4 py-3 bg-slate-900 text-white flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 -ml-1 rounded-full text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
            title="Kembali ke Struk"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-400/30 flex items-center justify-center shrink-0">
            <Mail className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold truncate">Struk Digital Email</h4>
            <p className="text-[10px] text-slate-400 truncate">Pratinjau HTML &amp; Pengiriman Email</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 transition-colors cursor-pointer"
          title="Tutup Modal"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Email Meta Bar */}
      <div className="shrink-0 px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs space-y-1 text-slate-600">
        <div className="flex justify-between">
          <span className="font-semibold text-slate-500">Subjek:</span>
          <span className="font-bold text-blue-950 truncate ml-2">Bukti Transaksi Faktur #{order.invoiceNumber}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-slate-500">Kepada:</span>
          <span className="font-mono text-slate-800 truncate ml-2">{recipientEmail || order.customerEmail || 'pelanggan@email.com'}</span>
        </div>
      </div>

      {/* Rendered HTML Email Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-slate-100">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 max-w-sm mx-auto text-xs text-slate-700">
          <div className="text-center border-b border-slate-100 pb-2.5">
            <h2 className="text-sm font-black text-blue-950 uppercase tracking-tight">
              {order.outlet?.name || 'WELL POS TOKO'}
            </h2>
            <p className="text-[10px] text-slate-500 mt-0.5">Bukti Transaksi Resmi</p>
            <p className="text-[9px] text-slate-400 font-mono mt-0.5">Faktur #{order.invoiceNumber}</p>
          </div>

          <div className="space-y-1 border-b border-slate-100 pb-2.5 font-mono text-[11px]">
            {order.orderItems?.map((it, idx) => (
              <div key={idx} className="flex justify-between">
                <span>{it.product?.name} x{it.quantity}</span>
                <span className="font-bold">Rp {Number(it.subtotal).toLocaleString('id-ID')}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1 font-mono text-right text-[11px]">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal:</span>
              <span>Rp {Number(order.subtotal).toLocaleString('id-ID')}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Diskon Promo:</span>
                <span>-Rp {Number(order.discountAmount).toLocaleString('id-ID')}</span>
              </div>
            )}
            {order.taxAmount > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>PPN (11%):</span>
                <span>+Rp {Number(order.taxAmount).toLocaleString('id-ID')}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-xs text-blue-950 pt-1 border-t border-slate-100">
              <span>TOTAL:</span>
              <span>Rp {Number(order.grandTotal).toLocaleString('id-ID')}</span>
            </div>
          </div>

          <div className="text-center pt-2 text-[9px] text-slate-400 border-t border-slate-100">
            Terima kasih telah berbelanja! Email ini dikirim otomatis oleh sistem kasir Well POS.
          </div>
        </div>
      </div>

      {/* Email Actions Bar */}
      <div className="shrink-0 p-3.5 sm:p-4 bg-white border-t border-slate-200 space-y-2.5">
        <form onSubmit={handleSendEmail} className="flex gap-2">
          <input
            type="email"
            required
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="Ketik email penerima asli..."
            className="flex-1 bg-slate-50 border border-slate-300 focus:border-blue-900 rounded-xl px-3 py-2 text-xs font-semibold outline-hidden"
          />
          <button
            type="submit"
            disabled={sendingEmail}
            className="px-4 py-2 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
          >
            {sendingEmail ? (
              <span>Mengirim...</span>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Kirim Email</span>
              </>
            )}
          </button>
        </form>

        {emailStatus && (
          <div
            className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between ${
              emailStatus.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <span>{emailStatus.message}</span>
            {emailStatus.previewUrl && (
              <a
                href={emailStatus.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="underline font-bold text-blue-900 flex items-center gap-1 ml-2 shrink-0"
              >
                <span>Lihat Web Mail</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onBack}
          className="w-full py-2 text-center text-xs font-bold text-slate-500 hover:text-slate-800 border-t border-slate-100 flex items-center justify-center gap-1 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Kembali ke Struk Kasir</span>
        </button>
      </div>
    </div>
  );
};
