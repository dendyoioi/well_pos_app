import React, { useRef } from 'react';
import { X, Printer, ChefHat, Clock } from 'lucide-react';
import type { CartItem } from '../types/order';

export interface KitchenTicketData {
  /** Nomor meja atau nama pelanggan */
  tableNumber?: string;
  customerName?: string;
  /** Nomor invoice / referensi antrean */
  invoiceNumber?: string;
  /** Nama outlet */
  outletName?: string;
  /** Nama kasir yang mengirim */
  cashierName?: string;
  /** Waktu kirim */
  sentAt?: string;
  /** Daftar item yang dipesan */
  items: Array<{
    name: string;
    quantity: number;
    itemNote?: string;
    modifiers?: string;
  }>;
  /** Catatan tambahan pesanan */
  notes?: string;
  /** Apakah ini pesanan susulan */
  isAddOn?: boolean;
  /** Referensi invoice asal (jika susulan) */
  originalInvoiceNumber?: string;
}

interface KitchenTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: KitchenTicketData | null;
}

export const KitchenTicketModal: React.FC<KitchenTicketModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !data) return null;

  const sentAtStr = data.sentAt
    ? new Date(data.sentAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const handlePrint = () => {
    const content = printAreaRef.current;
    if (!content) return;
    const printWindow = window.open('', '_blank', 'width=420,height=600');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Tiket Dapur — ${data.tableNumber ? `Meja ${data.tableNumber}` : data.customerName || 'Pesanan'}</title>
        <style>
          @page { margin: 0; size: 80mm auto; }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 13px;
            margin: 0;
            padding: 10px 12px;
            color: #000;
            background: #fff;
          }
          h1 { font-size: 15px; font-weight: bold; text-align: center; text-transform: uppercase; margin: 0 0 4px; }
          .center { text-align: center; }
          .divider { border-top: 1px dashed #666; margin: 6px 0; }
          .bold { font-weight: bold; }
          .row { display: flex; justify-content: space-between; }
          .qty { font-weight: bold; font-size: 18px; min-width: 30px; }
          .item-name { flex: 1; padding-left: 8px; font-weight: bold; font-size: 14px; }
          .note { font-size: 11px; color: #444; padding-left: 38px; font-style: italic; }
          .modifiers { font-size: 11px; color: #555; padding-left: 38px; }
          .add-on-badge { background: #000; color: #fff; text-align: center; padding: 3px 0; font-weight: bold; font-size: 12px; margin-bottom: 6px; }
          .timestamp { font-size: 11px; color: #555; }
        </style>
      </head>
      <body>
        ${content.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[88vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-700 to-orange-600 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-600/70 flex items-center justify-center">
              <ChefHat className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-tight">Tiket Dapur (KDS)</h3>
              <p className="text-[11px] text-orange-200 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {sentAtStr} · {data.outletName || 'Dapur'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-orange-200 hover:text-white hover:bg-orange-600/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scroll area: print-preview ticket */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-100 flex flex-col items-center gap-3">
          <p className="text-[11px] text-slate-500 font-semibold text-center">
            Preview struk dapur · Harga tersembunyi (kitchen only)
          </p>

          {/* Printable area */}
          <div
            ref={printAreaRef}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 w-full max-w-[300px] font-mono text-slate-900 text-xs space-y-3"
            style={{ fontFamily: "'Courier New', Courier, monospace" }}
          >
            {/* Badge susulan */}
            {data.isAddOn && (
              <div className="bg-slate-900 text-white text-center font-bold text-[11px] rounded-lg py-1 px-2">
                *** TAMBAHAN / SUSULAN ***
              </div>
            )}
            {data.isAddOn && data.originalInvoiceNumber && (
              <div className="text-center text-[10px] text-slate-500">
                Ref: #{data.originalInvoiceNumber}
              </div>
            )}

            {/* Header */}
            <div className="text-center border-b border-dashed border-slate-300 pb-3">
              <div className="font-extrabold text-sm uppercase tracking-tight">{data.outletName || 'DAPUR'}</div>
              <div className="mt-1.5 bg-slate-900 text-white rounded-md text-[10px] font-bold tracking-wider py-0.5 px-2">
                *** TIKET DAPUR (KITCHEN) ***
              </div>
            </div>

            {/* Meta */}
            <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3">
              {(data.tableNumber || data.customerName) && (
                <div className="flex justify-between font-bold text-base">
                  <span>
                    {data.tableNumber ? `MEJA ${data.tableNumber}` : data.customerName?.toUpperCase() || ''}
                  </span>
                </div>
              )}
              {data.cashierName && (
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Kasir:</span>
                  <span>{data.cashierName}</span>
                </div>
              )}
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Waktu Kirim:</span>
                <span>{sentAtStr}</span>
              </div>
              {data.invoiceNumber && (
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>No. Order:</span>
                  <span className="font-bold">#{data.invoiceNumber}</span>
                </div>
              )}
            </div>

            {/* Items — TANPA HARGA, hanya nama & qty */}
            <div className="space-y-3 border-b border-dashed border-slate-300 pb-3">
              {data.items.map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="flex items-start gap-2">
                    <span className="font-black text-base min-w-[28px] text-center leading-tight">
                      {item.quantity}x
                    </span>
                    <span className="font-bold text-sm leading-tight">{item.name}</span>
                  </div>
                  {item.modifiers && (
                    <div className="text-[10px] text-slate-500 pl-9 italic">{item.modifiers}</div>
                  )}
                  {item.itemNote && (
                    <div className="text-[11px] text-slate-700 pl-9 font-semibold">
                      📝 {item.itemNote}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Catatan */}
            {data.notes && (
              <div className="text-[10px] text-slate-600 italic">
                Catatan: {data.notes}
              </div>
            )}

            <div className="text-center text-[10px] text-slate-400 pt-1">
              — Harap segera diproses —
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 border-t border-slate-200 bg-white p-4 sm:p-5 flex items-center gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Tutup
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black shadow-md shadow-orange-600/20 transition-all flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak ke Dapur</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Helper: Ubah CartItem[] menjadi KitchenTicketData
 */
export function buildKitchenTicketData(params: {
  cart: CartItem[];
  tableNumber?: string;
  customerName?: string;
  invoiceNumber?: string;
  outletName?: string;
  cashierName?: string;
  notes?: string;
  isAddOn?: boolean;
  originalInvoiceNumber?: string;
}): KitchenTicketData {
  return {
    tableNumber: params.tableNumber,
    customerName: params.customerName,
    invoiceNumber: params.invoiceNumber,
    outletName: params.outletName,
    cashierName: params.cashierName,
    sentAt: new Date().toISOString(),
    notes: params.notes,
    isAddOn: params.isAddOn,
    originalInvoiceNumber: params.originalInvoiceNumber,
    items: params.cart.map((item) => ({
      name: item.product.name,
      quantity: item.quantity,
      itemNote: item.itemNote,
      modifiers: item.selectedModifiers
        ? item.selectedModifiers.map((m) => `${m.groupName}: ${m.option?.name || m.option}`).join(', ')
        : undefined,
    })),
  };
}
