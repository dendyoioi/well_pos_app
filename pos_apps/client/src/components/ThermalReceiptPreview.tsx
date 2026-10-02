import React from 'react';
import { Smartphone, Monitor, QrCode } from 'lucide-react';
import { formatRupiah } from '../utils/currency';

export interface ThermalReceiptItem {
  name: string;
  quantity: number;
  price: number;
  modifiers?: string[];
}

export interface ThermalReceiptPreviewProps {
  paperSize?: '58mm' | '80mm';
  onPaperSizeChange?: (size: '58mm' | '80mm') => void;
  brandName?: string;
  storeName?: string;
  address?: string;
  phone?: string;
  queueNumber?: string | null;
  showQueueNumber?: boolean;
  invoiceNumber?: string;
  cashierName?: string;
  tableNumber?: string | null;
  timestamp?: string;
  items?: ThermalReceiptItem[];
  subtotal?: number;
  taxAmount?: number;
  serviceCharge?: number;
  grandTotal?: number;
  paymentMethod?: string;
  footerText?: string;
  showControls?: boolean;
}

export const ThermalReceiptPreview: React.FC<ThermalReceiptPreviewProps> = ({
  paperSize = '58mm',
  onPaperSizeChange,
  brandName = 'WELL POS CAFE',
  storeName = 'Outlet Kemang Raya',
  address = 'Jl. Kemang Raya No. 10, Jakarta Selatan',
  phone = '0812-3456-7890',
  queueNumber = '#05',
  showQueueNumber = true,
  invoiceNumber = 'INV-20261002-0042',
  cashierName = 'Rian Kasir',
  tableNumber = 'Meja 05',
  timestamp = '02 Okt 2026, 14:32',
  items,
  subtotal,
  taxAmount,
  serviceCharge,
  grandTotal,
  paymentMethod = 'QRIS STATIS LUNAS',
  footerText = 'Terima kasih atas kunjungan Anda!\nFollow IG kami: @wellpos.id',
  showControls = true,
}) => {
  // Sample default items if not provided
  const sampleItems: ThermalReceiptItem[] = items || [
    {
      name: 'Kopi Susu Aren Spesial',
      quantity: 2,
      price: 22000,
      modifiers: ['Less Sugar (50%)', 'Extra Shot Espresso (+Rp 5.000)'],
    },
    {
      name: 'Croissant Butter Almond',
      quantity: 1,
      price: 28000,
    },
  ];

  const calculatedSubtotal = subtotal !== undefined ? subtotal : 72000;
  const calculatedTax = taxAmount !== undefined ? taxAmount : Math.round(calculatedSubtotal * 0.1);
  const calculatedService = serviceCharge !== undefined ? serviceCharge : 3500;
  const calculatedGrandTotal =
    grandTotal !== undefined
      ? grandTotal
      : calculatedSubtotal + calculatedTax + calculatedService;

  const is58mm = paperSize === '58mm';

  return (
    <div className="flex flex-col items-center w-full">
      {/* Width Control Selector Tabs */}
      {showControls && onPaperSizeChange && (
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-2xl border border-slate-200/80 mb-4 shadow-2xs">
          <button
            type="button"
            onClick={() => onPaperSizeChange('58mm')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              is58mm
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>58mm (Mobile/EDC)</span>
          </button>
          <button
            type="button"
            onClick={() => onPaperSizeChange('80mm')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              !is58mm
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>80mm (Desktop/Resto)</span>
          </button>
        </div>
      )}

      {/* Realistic Thermal Paper Roll Canvas */}
      <div className="relative group transition-all duration-300">
        {/* Jagged / Sawtooth Top Edge */}
        <div className="w-full h-3 flex overflow-hidden opacity-40">
          {Array.from({ length: is58mm ? 18 : 24 }).map((_, i) => (
            <div
              key={i}
              className="w-3 h-3 bg-amber-50/70 border-t border-l border-slate-300/80 rotate-45 transform origin-bottom -translate-y-1.5 shrink-0"
            />
          ))}
        </div>

        {/* Paper Body */}
        <div
          className={`bg-[#fffdfa] border-x border-slate-300/80 p-5 sm:p-6 shadow-xl text-slate-900 font-mono text-[11px] leading-tight space-y-3 transition-all duration-300 ${
            is58mm ? 'w-64 max-w-full text-[10px]' : 'w-80 max-w-full text-[11px]'
          }`}
          style={{
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
          }}
        >
          {/* Header Toko */}
          <div className="text-center space-y-1">
            <div className="font-black text-sm uppercase tracking-wide text-blue-950">
              {brandName}
            </div>
            <div className="font-extrabold text-[10px] text-slate-800">
              {storeName}
            </div>
            {address && (
              <div className="text-[9px] text-slate-600 leading-snug px-2">
                {address}
              </div>
            )}
            {phone && (
              <div className="text-[9px] text-slate-600">
                Telp: {phone}
              </div>
            )}
          </div>

          {/* Dotted Divider */}
          <div className="border-b border-dashed border-slate-400 my-2" />

          {/* Nomor Antrean Panggilan Box (Jika diaktifkan) */}
          {showQueueNumber && queueNumber && (
            <div className="border-2 border-dashed border-slate-900 p-2 my-2 rounded-sm text-center bg-white/80 shadow-2xs">
              <div className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-600">
                NOMOR ANTRIAN
              </div>
              <div className="text-lg sm:text-xl font-black text-blue-950 tracking-wider">
                {queueNumber}
              </div>
            </div>
          )}

          {/* Order Meta Header */}
          <div className="space-y-0.5 text-[9px] text-slate-600">
            <div className="flex justify-between">
              <span>No: {invoiceNumber}</span>
              <span>{timestamp}</span>
            </div>
            <div className="flex justify-between">
              <span>Kasir: {cashierName}</span>
              {tableNumber && <span>{tableNumber}</span>}
            </div>
          </div>

          {/* Dotted Divider */}
          <div className="border-b border-dashed border-slate-400 my-2" />

          {/* Order Items */}
          <div className="space-y-2">
            {sampleItems.map((item, idx) => (
              <div key={idx}>
                <div className="font-bold text-slate-900">{item.name}</div>
                <div className="flex justify-between text-slate-600">
                  <span>
                    {item.quantity} x {formatRupiah(item.price)}
                  </span>
                  <span className="font-bold text-slate-900">
                    {formatRupiah(item.quantity * item.price)}
                  </span>
                </div>
                {item.modifiers && item.modifiers.length > 0 && (
                  <div className="text-[9px] text-slate-500 pl-2 space-y-0.5 mt-0.5">
                    {item.modifiers.map((mod, mIdx) => (
                      <div key={mIdx}>+ {mod}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Dotted Divider */}
          <div className="border-b border-dashed border-slate-400 my-2" />

          {/* Ringkasan Biaya & Total */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span>{formatRupiah(calculatedSubtotal)}</span>
            </div>
            {calculatedTax > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Pajak (PB1):</span>
                <span>{formatRupiah(calculatedTax)}</span>
              </div>
            )}
            {calculatedService > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Biaya Layanan:</span>
                <span>{formatRupiah(calculatedService)}</span>
              </div>
            )}

            <div className="flex justify-between font-black text-xs pt-1 border-t border-slate-300 text-blue-950">
              <span>TOTAL TAGIHAN:</span>
              <span>{formatRupiah(calculatedGrandTotal)}</span>
            </div>

            <div className="flex justify-between text-[10px] text-slate-600 pt-0.5">
              <span>{paymentMethod}:</span>
              <span>{formatRupiah(calculatedGrandTotal)}</span>
            </div>
          </div>

          {/* Dotted Divider */}
          <div className="border-b border-dashed border-slate-400 my-2" />

          {/* Footer Text Note */}
          {footerText && (
            <div className="text-center text-[9px] text-slate-600 whitespace-pre-line leading-relaxed px-1">
              {footerText}
            </div>
          )}

          {/* Simulated QR Code Stamp */}
          <div className="flex flex-col items-center justify-center pt-1 text-slate-400">
            <QrCode className="w-8 h-8 opacity-60" />
            <span className="text-[8px] mt-0.5 tracking-widest uppercase">E-Receipt Verified</span>
          </div>

          {/* Signature */}
          <div className="text-center text-[8px] text-slate-400 pt-1">
            Powered by Well POS
          </div>
        </div>

        {/* Jagged / Sawtooth Bottom Edge */}
        <div className="w-full h-3 flex overflow-hidden opacity-40">
          {Array.from({ length: is58mm ? 18 : 24 }).map((_, i) => (
            <div
              key={i}
              className="w-3 h-3 bg-amber-50/70 border-b border-r border-slate-300/80 rotate-45 transform origin-top translate-y-1.5 shrink-0"
            />
          ))}
        </div>
      </div>
    </div>
  );
};
