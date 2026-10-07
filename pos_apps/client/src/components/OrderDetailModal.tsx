import React from 'react';
import {
  X,
  Receipt,
  Banknote,
  QrCode,
  Printer,
  Ban,
  UtensilsCrossed,
  CheckCircle2,
  Copy,
  AlertTriangle,
  PackageX,
  Clock,
} from 'lucide-react';
import type { Order, OrderChannel } from '../types/order';
import { ORDER_CHANNEL_LABELS } from '../types/order';

interface OrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onViewReceipt: (order: Order) => void;
  onAppendOrder?: (order: Order) => void;
  onVoidOrder?: (order: Order) => void;
  onVoidItem?: (order: Order, item: any) => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  isOpen,
  onClose,
  order,
  onViewReceipt,
  onAppendOrder,
  onVoidOrder,
  onVoidItem,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !order) return null;

  const isVoided = order.orderStatus === 'VOIDED';
  const isDineIn = order.channel === 'DINE_IN';
  const isSusulan =
    order.notes?.includes('SUSULAN') ||
    order.notes?.includes('TAMBAHAN') ||
    order.customerName?.includes('Susulan');

  const channelKey = (order.channel || 'DINE_IN') as OrderChannel;
  const channelInfo = ORDER_CHANNEL_LABELS[channelKey] || {
    label: order.channel || 'Dine In',
    color: '#1e3a8a',
    bg: '#dbeafe',
  };

  const isUnpaid = order.paymentStatus === 'UNPAID' || !order.payments || order.payments.length === 0;
  const payment = order.payments?.[0];
  const paymentMethod = isUnpaid ? 'BELUM BAYAR' : (payment?.method || (payment as any)?.paymentMethod || 'CASH');

  const handleCopyInvoice = () => {
    if (order.invoiceNumber) {
      navigator.clipboard.writeText(order.invoiceNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formattedDate = new Date(order.createdAt).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const formattedTime = new Date(order.createdAt).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-2xl max-h-[92dvh] sm:max-h-[88vh] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-900 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-blue-950 font-mono tracking-tight truncate">
                  {order.invoiceNumber}
                </h3>
                <button
                  type="button"
                  onClick={handleCopyInvoice}
                  title="Salin Nomor Faktur"
                  className="p-1 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-md transition-colors cursor-pointer"
                >
                  {copied ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>

                {isVoided ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                    VOID / DIBATALKAN
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    LUNAS (PAID)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <span>{formattedDate}</span>
                <span>•</span>
                <span>{formattedTime} WIB</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-200/80 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4 text-xs sm:text-sm">
          {/* VOID Banner Alert */}
          {isVoided && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-900">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <div className="font-black text-rose-800 uppercase tracking-wide">
                  Transaksi Ini Telah Dibatalkan (VOID)
                </div>
                <div className="text-rose-700 leading-relaxed">
                  {order.notes || 'Transaksi telah dibatalkan oleh kasir dengan persetujuan supervisor.'}
                </div>
              </div>
            </div>
          )}

          {/* Susulan / Menu Tambahan Banner */}
          {isSusulan && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-amber-900">
              <UtensilsCrossed className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <div className="font-black text-amber-800">
                  PESANAN SUSULAN / MENU TAMBAHAN
                </div>
                <div className="text-amber-700 font-medium">
                  {order.notes || 'Pesanan tambahan untuk tagihan meja yang telah diproses.'}
                </div>
              </div>
            </div>
          )}

          {/* Meta Info Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Saluran Penjualan
              </div>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-black"
                style={{ color: channelInfo.color, backgroundColor: channelInfo.bg }}
              >
                {channelInfo.label}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Meja / Antrean
              </div>
              <div className="font-black text-slate-900">
                {order.tableNumber ? `Meja ${order.tableNumber}` : order.queueNumber ? `Antrean #${order.queueNumber}` : '-'}
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Pelanggan
              </div>
              <div className="font-bold text-slate-900 truncate">
                {order.customerName || order.customer?.name || 'Umum (Walk-in)'}
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Kasir
              </div>
              <div className="font-bold text-slate-900 truncate">
                {order.cashier?.name || 'Kasir Toko'}
              </div>
            </div>
          </div>

          {/* Items Detail Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
              <span>Daftar Menu / Produk ({order.orderItems?.length || 0} Item)</span>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Produk</th>
                      <th className="py-2.5 px-2 text-right">Harga Satuan</th>
                      <th className="py-2.5 px-2 text-center">Qty</th>
                      <th className="py-2.5 px-2 text-right">Diskon</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                      {!isVoided && onVoidItem && (
                        <th className="py-2.5 px-2 text-center">Aksi</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {order.orderItems?.map((item: any, idx) => {
                      const itemDisc = Number(item.discountAmount || 0);
                      const unitPrice = Number(item.unitPrice || 0);
                      const subtotal = Number(item.subtotal || 0);
                      const prodName = item.product?.name || item.productName || item.name || 'Produk';
                      const variantName = item.variantName || item.productVariant?.name;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            <div>{prodName}</div>
                            {variantName && (
                              <span className="inline-block mt-0.5 text-[10px] text-blue-900 font-semibold bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                                {variantName}
                              </span>
                            )}
                            {item.sku && (
                              <div className="text-[10px] text-slate-400 font-mono">{item.sku}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-2 text-right text-slate-600">
                            Rp {unitPrice.toLocaleString('id-ID')}
                          </td>
                          <td className="py-2.5 px-2 text-center font-bold text-slate-900">
                            {item.quantity}
                          </td>
                          <td className="py-2.5 px-2 text-right">
                            {itemDisc > 0 ? (
                              <span className="text-rose-600 font-semibold">
                                -Rp {(itemDisc * item.quantity).toLocaleString('id-ID')}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-900">
                            Rp {subtotal.toLocaleString('id-ID')}
                          </td>
                          {!isVoided && onVoidItem && (
                            <td className="py-2.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => onVoidItem(order, item)}
                                title="Batalkan item ini (Otorisasi Supervisor)"
                                className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[10px] font-bold transition-all active:scale-95 cursor-pointer"
                              >
                                <PackageX className="w-3 h-3 text-amber-700" />
                                <span>Batal</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Rincian Finansial & Pembayaran */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Payment Method Details */}
            <div className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-2">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                {isUnpaid ? (
                  <Clock className="w-4 h-4 text-amber-600" />
                ) : paymentMethod === 'CASH' ? (
                  <Banknote className="w-4 h-4 text-emerald-600" />
                ) : (
                  <QrCode className="w-4 h-4 text-indigo-600" />
                )}
                <span>Informasi Pembayaran</span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Metode:</span>
                  <span className={`font-bold uppercase ${isUnpaid ? 'text-amber-700' : 'text-slate-900'}`}>{paymentMethod}</span>
                </div>
                {isUnpaid && (
                  <div className="text-[11px] font-semibold text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200 mt-1">
                    Pesanan ini belum diselesaikan pembayarannya (Meja Aktif / Open Bill).
                  </div>
                )}

                {order.payments?.map((p: any, idx) => {
                  const m = p.method || p.paymentMethod || 'CASH';
                  const amtPaid = Number(p.amountPaid || p.amount || order.grandTotal);
                  const chgGiven = Number(p.changeGiven || (order as any).changeAmount || 0);

                  return (
                    <div key={idx} className="space-y-1 pt-1 border-t border-slate-200/60">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Nominal Bayar ({m}):</span>
                        <span className="font-bold text-slate-900">
                          Rp {amtPaid.toLocaleString('id-ID')}
                        </span>
                      </div>
                      {m === 'CASH' && chgGiven > 0 && (
                        <div className="flex justify-between text-emerald-700 font-bold">
                          <span>Kembalian:</span>
                          <span>Rp {chgGiven.toLocaleString('id-ID')}</span>
                        </div>
                      )}
                      {p.referenceNumber && (
                        <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                          <span>Ref QRIS:</span>
                          <span>{p.referenceNumber}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-1.5 text-xs">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider pb-1 border-b border-slate-200/60">
                Ringkasan Biaya
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span>Rp {Number(order.subtotal || 0).toLocaleString('id-ID')}</span>
              </div>

              {Number(order.discountAmount || 0) > 0 && (
                <div className="flex justify-between text-rose-600 font-semibold">
                  <span>Diskon Promo:</span>
                  <span>-Rp {Number(order.discountAmount).toLocaleString('id-ID')}</span>
                </div>
              )}

              {Number(order.serviceCharge || 0) > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Biaya Layanan:</span>
                  <span>+Rp {Number(order.serviceCharge).toLocaleString('id-ID')}</span>
                </div>
              )}

              {Number(order.taxAmount || 0) > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Pajak (PB1):</span>
                  <span>+Rp {Number(order.taxAmount).toLocaleString('id-ID')}</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline font-black">
                <span className="text-slate-800 text-xs uppercase">Grand Total:</span>
                <span className="text-base sm:text-lg text-blue-950 font-mono">
                  Rp {Number(order.grandTotal || 0).toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>

          {/* Notes / Catatan Tambahan (jika ada dan bukan void) */}
          {order.notes && !isVoided && !isSusulan && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-0.5">
              <span className="font-bold text-slate-500 uppercase text-[10px]">Catatan Faktur:</span>
              <p className="text-slate-700 italic">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Footer Quick Actions */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-white flex items-center justify-between gap-2 flex-wrap shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Cetak Struk */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onViewReceipt(order);
              }}
              className="px-3.5 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
              title="Lihat Pratinjau Struk Termal"
            >
              <Printer className="w-4 h-4" />
              <span>Lihat Struk</span>
            </button>

            {/* Order Susulan (HANYA jika DINE IN & TIDAK VOIDED & BELUM BAYAR / UNPAID) */}
            {onAppendOrder && isDineIn && !isVoided && order.paymentStatus === 'UNPAID' && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onAppendOrder(order);
                }}
                className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
                title="Buat Pesanan Susulan untuk Meja Ini (Khusus Belum Bayar)"
              >
                <UtensilsCrossed className="w-4 h-4 text-amber-700" />
                <span>+ Susulan</span>
              </button>
            )}

            {/* Void Order (HANYA jika TIDAK VOIDED) */}
            {onVoidOrder && !isVoided && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onVoidOrder(order);
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
                title="Batalkan Transaksi (Approval Supervisor)"
              >
                <Ban className="w-4 h-4" />
                <span>Void</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
