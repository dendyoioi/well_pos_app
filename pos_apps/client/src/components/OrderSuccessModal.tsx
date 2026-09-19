import React, { useState } from 'react';
import {
  CheckCircle2,
  Printer,
  PlusCircle,
  Store,
  Download,
  Mail,
  Send,
  ExternalLink,
  X,
  FileText,
  MessageCircle,
} from 'lucide-react';
import type { Order } from '../types/order';
import { generateReceiptPdf } from '../utils/receiptPdf';
import { usePlan } from '../hooks/usePlan';
import { api } from '../services/api';

interface OrderSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onAppendOrder?: (order: Order) => void;
}

export const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({
  isOpen,
  onClose,
  order,
  onAppendOrder,
}) => {
  const { isFree } = usePlan();
  
  // Ambil ukuran default dari konfigurasi outlet (atau fallback ke 58mm)
  const defaultOutletPaperSize = (order?.outlet?.receiptConfig?.paperSize as '58mm' | '80mm') || '58mm';
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm'>(defaultOutletPaperSize);
  const [savedDefaultSize, setSavedDefaultSize] = useState<'58mm' | '80mm'>(defaultOutletPaperSize);
  const [savingDefault, setSavingDefault] = useState(false);
  const [defaultSavedSuccess, setDefaultSavedSuccess] = useState(false);

  // Sinkronisasi ukuran jika order berubah
  React.useEffect(() => {
    if (order?.outlet?.receiptConfig?.paperSize) {
      const size = order.outlet.receiptConfig.paperSize as '58mm' | '80mm';
      setPaperSize(size);
      setSavedDefaultSize(size);
    }
  }, [order?.id]);

  const [showEmailInput, setShowEmailInput] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState(order?.customerEmail || '');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{
    type: 'success' | 'error';
    message: string;
    previewUrl?: string;
  } | null>(null);

  const handleSaveAsDefault = async () => {
    if (!order?.outletId) return;
    setSavingDefault(true);
    try {
      await api.updateOutlet(order.outletId, {
        receiptConfig: {
          paperSize,
          footerText: order.outlet?.receiptConfig?.footerText || undefined,
        },
      });
      setSavedDefaultSize(paperSize);
      setDefaultSavedSuccess(true);
      setTimeout(() => setDefaultSavedSuccess(false), 3000);
    } catch (e) {
      console.error('Gagal menyimpan ukuran default toko:', e);
    } finally {
      setSavingDefault(false);
    }
  };

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    generateReceiptPdf(order, paperSize, isFree);
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail.trim()) return;

    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const res = await api.sendOrderEmail(order.id, recipientEmail.trim());
      if (res.status === 'success') {
        setEmailStatus({
          type: 'success',
          message: res.message || 'Struk berhasil dikirim!',
          previewUrl: res.previewUrl,
        });
      } else {
        setEmailStatus({
          type: 'error',
          message: res.message || 'Gagal mengirim email struk',
        });
      }
    } catch (err: any) {
      setEmailStatus({
        type: 'error',
        message: err.message || 'Terjadi kesalahan sistem saat mengirim email',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSendWhatsApp = () => {
    const outletName = order.outlet?.name || 'Well POS Toko';
    const timeStr = new Date(order.createdAt).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const itemsText = order.orderItems?.map(item => {
      const disc = Number(item.discountAmount) || 0;
      const discStr = disc > 0 ? ` (Disc: -Rp ${(disc * item.quantity).toLocaleString('id-ID')})` : '';
      return `• ${item.product?.name} x${item.quantity} = Rp ${Number(item.subtotal).toLocaleString('id-ID')}${discStr}`;
    }).join('\n') || '';

    const paymentsText = order.payments?.map(p => {
      let str = `${p.method}: Rp ${Number(p.amountPaid).toLocaleString('id-ID')}`;
      if (p.method === 'CASH' && Number(p.changeGiven) > 0) {
        str += ` (Kembalian: Rp ${Number(p.changeGiven).toLocaleString('id-ID')})`;
      }
      return str;
    }).join('\n') || '';

    const text = `*${outletName.toUpperCase()}*\n` +
      `Bukti Pembayaran Digital (Well POS)\n` +
      `--------------------------------\n` +
      `No. Faktur : #${order.invoiceNumber}\n` +
      `Waktu      : ${timeStr}\n` +
      `Kasir      : ${order.cashier?.name || 'Kasir Toko'}\n` +
      (order.customerName ? `Pelanggan  : ${order.customerName}\n` : '') +
      `--------------------------------\n` +
      `DAFTAR BELANJA:\n${itemsText}\n` +
      `--------------------------------\n` +
      `Subtotal   : Rp ${Number(order.subtotal).toLocaleString('id-ID')}\n` +
      (order.discountAmount > 0 ? `Diskon     : -Rp ${Number(order.discountAmount).toLocaleString('id-ID')}\n` : '') +
      (order.taxAmount > 0 ? `PPN (11%)  : +Rp ${Number(order.taxAmount).toLocaleString('id-ID')}\n` : '') +
      `TOTAL      : Rp ${Number(order.grandTotal).toLocaleString('id-ID')}\n` +
      `--------------------------------\n` +
      `PEMBAYARAN:\n${paymentsText}\n` +
      `--------------------------------\n` +
      `Terima kasih telah berbelanja di ${outletName}! Simpan struk ini sebagai bukti transaksi resmi.` +
      (isFree ? `\n\n_Powered by Well POS (Aplikasi Kasir Gratis)_` : '');

    const cleanPhone = (order.customerPhone || '').replace(/\D/g, '');
    let waUrl = '';
    if (cleanPhone) {
      const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
      waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`;
    } else {
      waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    }
    window.open(waUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn receipt-print-wrapper overflow-y-auto">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh] receipt-printable">
        {/* Banner Sukses (No Print) */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-950 to-blue-900 text-white text-center flex flex-col items-center justify-center no-print relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full text-blue-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mb-2 shadow-sm">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black tracking-tight">Transaksi Berhasil</h3>
          <p className="text-xs text-blue-200/80 mt-0.5">Faktur #{order.invoiceNumber}</p>
        </div>

        {/* Paper Size Selector (No Print) & Default Setting */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 no-print">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-900" />
              <span>Format Struk:</span>
            </span>
            <div className="flex p-0.5 bg-slate-200/80 rounded-xl">
              <button
                type="button"
                onClick={() => setPaperSize('58mm')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  paperSize === '58mm'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-blue-950'
                }`}
              >
                58mm
              </button>
              <button
                type="button"
                onClick={() => setPaperSize('80mm')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  paperSize === '80mm'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-blue-950'
                }`}
              >
                80mm
              </button>
            </div>
          </div>

          {/* Action to persist/change default store paper size */}
          <div className="flex items-center gap-2">
            {defaultSavedSuccess ? (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md animate-in fade-in">
                ✓ Default Tersimpan
              </span>
            ) : paperSize !== savedDefaultSize ? (
              <button
                type="button"
                onClick={handleSaveAsDefault}
                disabled={savingDefault}
                className="text-[10px] font-bold text-blue-900 hover:text-blue-950 bg-blue-100/70 hover:bg-blue-200/80 px-2.5 py-1 rounded-md transition-colors border border-blue-200 flex items-center gap-1 shadow-2xs"
                title="Jadikan ukuran ini sebagai standar default outlet toko Anda seterusnya"
              >
                <span>⭐ Jadikan Default Toko</span>
              </button>
            ) : (
              <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                Ukuran Default ({savedDefaultSize})
              </span>
            )}
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div
          className={`p-6 overflow-y-auto space-y-3.5 font-mono text-slate-800 bg-white mx-auto w-full transition-all ${
            paperSize === '58mm'
              ? 'max-w-[240px] text-[11px] paper-58mm'
              : 'max-w-[340px] text-xs paper-80mm'
          }`}
        >
          {/* Header Toko */}
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-slate-900 font-bold text-sm sm:text-base">
              <Store className="w-4 h-4 no-print text-blue-900" />
              <span>{order.outlet?.name || 'POS Toko Utama'}</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 leading-tight">
              {order.outlet?.address || 'Menteng, Jakarta Pusat'}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-500">
              Telp: {order.outlet?.phone || '081234567890'}
            </p>
          </div>

          <div className="border-b border-dashed border-slate-300 my-2" />

          {/* Info Invoice */}
          <div className="space-y-1 text-[11px] text-slate-600">
            <div className="flex justify-between">
              <span>No. Faktur:</span>
              <span className="font-bold text-slate-900">{order.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Waktu:</span>
              <span>
                {new Date(order.createdAt).toLocaleString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Kasir:</span>
              <span>{order.cashier?.name || 'Kasir Toko'}</span>
            </div>
            {order.customerName && (
              <div className="flex justify-between">
                <span>Pelanggan:</span>
                <span className="font-semibold text-slate-900">{order.customerName}</span>
              </div>
            )}
          </div>

          <div className="border-b border-dashed border-slate-300 my-2" />

          {/* Line Items */}
          <div className="space-y-2">
            {order.orderItems?.map((item, idx) => {
              const itemDisc = Number(item.discountAmount) || 0;
              return (
                <div key={idx} className="space-y-0.5">
                  <div className="font-bold text-slate-900">{item.product?.name}</div>
                  <div className="flex justify-between text-[10px] sm:text-[11px] text-slate-500">
                    <span>
                      {item.quantity} x Rp {Number(item.unitPrice).toLocaleString('id-ID')}
                      {itemDisc > 0 && (
                        <span className="text-rose-600 ml-1">
                          (Disc: -Rp {(itemDisc * item.quantity).toLocaleString('id-ID')})
                        </span>
                      )}
                    </span>
                    <span className="font-semibold text-slate-900">
                      Rp {Number(item.subtotal).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-b border-dashed border-slate-300 my-2" />

          {/* Kalkulasi Total */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>Rp {Number(order.subtotal).toLocaleString('id-ID')}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Diskon Transaksi:</span>
                <span>- Rp {Number(order.discountAmount).toLocaleString('id-ID')}</span>
              </div>
            )}
            {order.serviceCharge > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Biaya Layanan:</span>
                <span>+ Rp {Number(order.serviceCharge).toLocaleString('id-ID')}</span>
              </div>
            )}
            {order.taxAmount > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>PPN (11%):</span>
                <span>+ Rp {Number(order.taxAmount).toLocaleString('id-ID')}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-sm sm:text-base text-blue-950 pt-1.5 border-t border-slate-200">
              <span>TOTAL:</span>
              <span>Rp {Number(order.grandTotal).toLocaleString('id-ID')}</span>
            </div>
          </div>

          <div className="border-b border-dashed border-slate-300 my-2" />

          {/* Pembayaran & Kembalian (Multi-Payment Support) */}
          {order.payments && order.payments.length > 0 && (
            <div className="space-y-1">
              {order.payments.length === 1 ? (
                <>
                  <div className="flex justify-between">
                    <span>Metode Bayar:</span>
                    <span className="font-bold">{order.payments[0].method}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Jumlah Diterima:</span>
                    <span>Rp {Number(order.payments[0].amountPaid).toLocaleString('id-ID')}</span>
                  </div>
                  {order.payments[0].method === 'CASH' && (
                    <div className="flex justify-between font-bold text-emerald-700">
                      <span>Kembalian:</span>
                      <span>Rp {Number(order.payments[0].changeGiven).toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  {order.payments[0].qrisReference && (
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Ref QRIS:</span>
                      <span>{order.payments[0].qrisReference}</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex justify-between font-bold text-blue-950">
                    <span>Metode:</span>
                    <span>SPLIT (CAMPURAN)</span>
                  </div>
                  {order.payments.map((p, idx) => (
                    <div key={idx} className="pl-2 border-l-2 border-slate-200 space-y-0.5 text-[10px]">
                      <div className="flex justify-between">
                        <span className="font-bold text-slate-700">{p.method}:</span>
                        <span>Rp {Number(p.amountPaid).toLocaleString('id-ID')}</span>
                      </div>
                      {p.method === 'CASH' && Number(p.changeGiven) > 0 && (
                        <div className="flex justify-between text-emerald-700 font-bold">
                          <span>Kembalian:</span>
                          <span>Rp {Number(p.changeGiven).toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      {p.qrisReference && (
                        <div className="flex justify-between text-slate-400">
                          <span>Ref:</span>
                          <span>{p.qrisReference}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          <div className="text-center text-[10px] text-slate-500 pt-2 border-t border-dashed border-slate-300 space-y-0.5">
            <div>Terima kasih telah berbelanja! Bukti pembayaran yang sah.</div>
            {isFree && (
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide pt-1">
                Powered by Well POS (Aplikasi Kasir Gratis)
              </div>
            )}
          </div>
        </div>

        {/* Send Email Section (No Print) */}
        {showEmailInput && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2 no-print animate-fadeIn">
            <form onSubmit={handleSendEmail} className="flex gap-2">
              <input
                type="email"
                required
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="Alamat email pelanggan..."
                className="flex-1 bg-white border border-slate-300 focus:border-blue-900 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
              />
              <button
                type="submit"
                disabled={sendingEmail}
                className="px-4 py-2 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
              >
                {sendingEmail ? (
                  <span>Mengirim...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Kirim</span>
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
                    <span>Buka Preview</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions Grid (Screen only) */}
        <div className="p-4 border-t border-slate-200 bg-white space-y-2.5 no-print">
          <div className="grid grid-cols-4 gap-1.5">
            {/* Tombol Cetak Thermal */}
            <button
              type="button"
              onClick={handlePrint}
              className="py-2.5 px-2 rounded-xl border border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50/50 text-slate-800 text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-1 shadow-xs"
            >
              <Printer className="w-4 h-4 text-blue-900" />
              <span>Cetak ({paperSize})</span>
            </button>

            {/* Tombol Unduh PDF */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="py-2.5 px-2 rounded-xl border border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50/50 text-slate-800 text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-1 shadow-xs"
            >
              <Download className="w-4 h-4 text-blue-900" />
              <span>PDF</span>
            </button>

            {/* Tombol Kirim WhatsApp */}
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="py-2.5 px-2 rounded-xl border border-emerald-200 hover:border-emerald-400 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-1 shadow-xs"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>WhatsApp</span>
            </button>

            {/* Tombol Kirim Email */}
            <button
              type="button"
              onClick={() => setShowEmailInput(!showEmailInput)}
              className={`py-2.5 px-2 rounded-xl border text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-1 shadow-xs ${
                showEmailInput
                  ? 'bg-blue-900 text-white border-blue-900'
                  : 'border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50/50 text-slate-800'
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>Email</span>
            </button>
          </div>

          {/* Tombol Aksi Akhir: Transaksi Baru & Tambah Order Susulan */}
          <div className="flex flex-col sm:flex-row gap-2">
            {onAppendOrder && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onAppendOrder(order);
                }}
                className="flex-1 py-3 px-4 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 shadow-xs active:scale-[0.99]"
              >
                <PlusCircle className="w-4 h-4 text-amber-700" />
                <span>+ Tambah Order Susulan</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-900/20 active:scale-[0.99]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Transaksi Baru</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
