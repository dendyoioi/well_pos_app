import React from 'react';
import { Store } from 'lucide-react';
import type { Order } from '../../types/order';

interface ReceiptPrintBodyProps {
  order: Order;
  paperSize: '58mm' | '80mm';
  showWatermark?: boolean;
}

export const ReceiptPrintBody: React.FC<ReceiptPrintBodyProps> = ({
  order,
  paperSize,
  showWatermark = true,
}) => {
  return (
    <div
      id="thermal-receipt-content"
      className={`p-4 sm:p-6 overflow-y-auto flex-1 space-y-3.5 font-mono text-slate-800 bg-white mx-auto w-full transition-all overscroll-contain ${
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
          {order.outlet?.address || 'Alamat Toko'}
        </p>
        <p className="text-[10px] sm:text-[11px] text-slate-500">
          Telp: {order.outlet?.phone || '-'}
        </p>
      </div>

      <div className="border-b border-dashed border-slate-300 my-2" />

      {/* Nomor Antrean Panggilan */}
      {order.queueNumber !== undefined && order.queueNumber !== null && (
        <div className="border-2 border-dashed border-slate-800 p-2 my-2 rounded text-center">
          <div className="text-[9px] font-black uppercase tracking-widest text-slate-600">
            NOMOR ANTRIAN
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-wider">
            #{String(order.queueNumber).padStart(2, '0')}
          </div>
        </div>
      )}

      {/* VOID Banner jika transaksi dibatalkan */}
      {order.orderStatus === 'VOIDED' && (
        <div className="border-2 border-rose-600 bg-rose-50 text-rose-800 p-2 my-2 rounded text-center">
          <div className="text-[10px] font-black tracking-widest uppercase">
            *** VOID / DIBATALKAN ***
          </div>
          <div className="text-[9px] text-rose-700 font-semibold mt-0.5">
            Transaksi ini telah dibatalkan
          </div>
        </div>
      )}

      {/* Label / Banner Menu Tambahan / Susulan */}
      {(order.notes?.includes('SUSULAN') || order.notes?.includes('TAMBAHAN') || order.customerName?.includes('Susulan')) && (
        <div className="border border-amber-500 bg-amber-50 text-amber-900 p-2 my-2 rounded text-center">
          <div className="text-[10px] font-black tracking-wider uppercase">
            *** MENU TAMBAHAN / SUSULAN ***
          </div>
          {order.notes && (
            <div className="text-[9px] text-amber-800 font-medium mt-0.5">
              {order.notes}
            </div>
          )}
        </div>
      )}

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
          const rawName = item.product?.name || item.productName || 'Produk';
          const variantName = item.variantName || item.variant?.name;
          const hasVariant = Boolean(variantName && variantName !== 'Default' && variantName !== 'Standar');
          const pName = hasVariant ? `${rawName} (${variantName})` : rawName;
          const mods = item.modifiers || item.modifiersSnapshot || item.selectedModifiers || [];
          const itemNotes = item.notes || item.itemNote;

          const totalModPerUnit = (Array.isArray(mods) ? mods : []).reduce((acc: number, m: any) => {
            const modPrice = typeof m === 'string' ? 0 : Number(m.option?.priceDelta || m.priceAdjustment || m.price_adjustment || 0);
            return acc + modPrice;
          }, 0);
          const rawUnitPrice = Number(item.unitPrice || 0);
          const basePriceEach = Math.max(0, rawUnitPrice - totalModPerUnit);

          return (
            <div key={idx} className="space-y-0.5">
              <div className="font-bold text-slate-900">{pName}</div>
              <div className="flex justify-between text-[10px] sm:text-[11px] text-slate-500">
                <span>
                  {item.quantity} x Rp {basePriceEach.toLocaleString('id-ID')}
                </span>
                <span className="font-semibold text-slate-900">
                  Rp {Number(item.subtotal).toLocaleString('id-ID')}
                </span>
              </div>
              {Array.isArray(mods) && mods.length > 0 && (
                <div className="text-[10px] text-slate-500 pl-2 space-y-0.5 mt-0.5">
                  {mods.map((m: any, mIdx: number) => {
                    const modName = typeof m === 'string' ? m : (m.option?.name || m.name || '');
                    const modPrice = typeof m === 'string' ? 0 : Number(m.option?.priceDelta || m.priceAdjustment || m.price_adjustment || 0);
                    if (!modName) return null;
                    const qtyModText = item.quantity > 1 ? ` (${item.quantity} x @Rp ${modPrice.toLocaleString('id-ID')} = +Rp ${(modPrice * item.quantity).toLocaleString('id-ID')})` : ` (+Rp ${modPrice.toLocaleString('id-ID')})`;
                    return (
                      <div key={mIdx} className="text-slate-600">
                        + {modName} {modPrice > 0 ? qtyModText : ''}
                      </div>
                    );
                  })}
                </div>
              )}
              {itemDisc > 0 && (() => {
                const discPercent = (basePriceEach || rawUnitPrice) > 0 ? Math.round((itemDisc / (basePriceEach || rawUnitPrice)) * 100) : 0;
                const percentTag = discPercent > 0 ? ` (${discPercent}%)` : '';
                return (
                  <div className="text-[10px] text-rose-600 pl-2 font-semibold">
                    Diskon Item{percentTag}: -Rp {(itemDisc * item.quantity).toLocaleString('id-ID')} {item.quantity > 1 ? `(@Rp ${itemDisc.toLocaleString('id-ID')})` : ''}
                  </div>
                );
              })()}
              {itemNotes && (
                <div className="text-[10px] text-amber-700 pl-2 italic">
                  Catatan: {itemNotes}
                </div>
              )}
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
        {Number(order.pointsRedeemed || 0) > 0 && (
          <div className="flex justify-between text-amber-800 font-bold">
            <span>Tukar Poin ({order.pointsRedeemed} Poin):</span>
            <span>- Rp {Number(order.pointDiscountAmount || (order.pointsRedeemed || 0) * 100).toLocaleString('id-ID')}</span>
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
        {Number(order.pointsEarned || 0) > 0 && (
          <div className="border border-dashed border-amber-300 bg-amber-50/80 p-1.5 rounded text-center my-1">
            <span className="text-[10px] font-bold text-amber-900">
              ★ Poin Loyalitas Diperoleh: +{order.pointsEarned} Poin
            </span>
          </div>
        )}
      </div>

      <div className="border-b border-dashed border-slate-300 my-2" />

      {/* Pembayaran & Kembalian */}
      {order.payments && order.payments.length > 0 && (
        <div className="space-y-1">
          {order.payments.length === 1 ? (
            (() => {
              const p = order.payments[0];
              const method = p.method || (p as any).paymentMethod || (p as any).payment_method || 'CASH';
              const amountPaid = Number(p.amountPaid ?? (p as any).amount ?? (p as any).cashReceived ?? order.grandTotal ?? 0);
              const changeGiven = Number(p.changeGiven ?? (p as any).cashChange ?? 0);
              return (
                <>
                  <div className="flex justify-between">
                    <span>Metode Bayar:</span>
                    <span className="font-bold">{method}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Jumlah Diterima:</span>
                    <span>Rp {amountPaid.toLocaleString('id-ID')}</span>
                  </div>
                  {method === 'CASH' && (
                    <div className="flex justify-between font-bold text-emerald-700">
                      <span>Kembalian:</span>
                      <span>Rp {changeGiven.toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  {p.qrisReference && (
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Ref QRIS:</span>
                      <span>{p.qrisReference}</span>
                    </div>
                  )}
                </>
              );
            })()
          ) : (
            <>
              <div className="flex justify-between font-bold text-blue-950">
                <span>Metode:</span>
                <span>SPLIT (CAMPURAN)</span>
              </div>
              {order.payments.map((p, idx) => {
                const method = p.method || (p as any).paymentMethod || (p as any).payment_method || 'CASH';
                const amountPaid = Number(p.amountPaid ?? (p as any).amount ?? (p as any).cashReceived ?? 0);
                const changeGiven = Number(p.changeGiven ?? (p as any).cashChange ?? 0);
                return (
                  <div key={idx} className="pl-2 border-l-2 border-slate-200 space-y-0.5 text-[10px]">
                    <div className="flex justify-between">
                      <span className="font-bold text-slate-700">{method}:</span>
                      <span>Rp {amountPaid.toLocaleString('id-ID')}</span>
                    </div>
                    {method === 'CASH' && changeGiven > 0 && (
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Kembalian:</span>
                        <span>Rp {changeGiven.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    {p.qrisReference && (
                      <div className="flex justify-between text-slate-400">
                        <span>Ref:</span>
                        <span>{p.qrisReference}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      <div className="text-center text-[10px] text-slate-500 pt-2 border-t border-dashed border-slate-300 space-y-0.5">
        <div>Terima kasih telah berbelanja! Bukti pembayaran yang sah.</div>
        {showWatermark && (
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide pt-1 space-y-0.5">
            <div>Powered by Well POS</div>
            <div>wellpos.id</div>
          </div>
        )}
      </div>
    </div>
  );
};
