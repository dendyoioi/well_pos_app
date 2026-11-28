import React from 'react';
import { Store, ArrowLeft, X, Check, Copy, MessageCircle } from 'lucide-react';
import type { Order } from '../../types/order';
import { WhatsAppInput } from '../ui/WhatsAppInput';

interface WhatsAppReceiptViewProps {
  order: Order;
  onBack: () => void;
  onClose: () => void;
  waRecipientPhone: string;
  setWaRecipientPhone: (val: string) => void;
  hasGatewayActive?: boolean;
  sendingWa?: boolean;
  copiedWhatsApp: boolean;
  getWhatsAppText: () => string;
  handleSendWhatsAppGateway?: () => void;
  handleOpenWhatsAppReal: () => void;
  handleCopyWhatsAppText: () => void;
}

export const WhatsAppReceiptView: React.FC<WhatsAppReceiptViewProps> = ({
  order,
  onBack,
  onClose,
  waRecipientPhone,
  setWaRecipientPhone,
  copiedWhatsApp,
  getWhatsAppText,
  handleOpenWhatsAppReal,
  handleCopyWhatsAppText,
}) => {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white">
      {/* Header WhatsApp Bar */}
      <div className="shrink-0 px-4 py-3 bg-[#075E54] text-white flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 -ml-1 rounded-full text-emerald-100 hover:text-white hover:bg-white/10 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
            title="Kembali ke Struk"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#075E54] flex items-center justify-center font-black text-xs shrink-0">
            <Store className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-black tracking-wide truncate">
              {order.outlet?.name || 'Well POS Store'}
            </h4>
            <p className="text-[10px] text-emerald-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span className="truncate">Struk Digital WhatsApp</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-full text-emerald-100 hover:text-white hover:bg-white/10 active:scale-95 transition-colors cursor-pointer"
          title="Tutup Modal"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Chat Screen Mockup */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 bg-[#E5DDD5] space-y-3">
        <div className="text-center">
          <span className="px-2.5 py-0.5 rounded-full bg-white/80 text-[10px] font-semibold text-slate-600 shadow-2xs">
            HARI INI
          </span>
        </div>

        {/* Chat Bubble Struk */}
        <div className="max-w-[94%] ml-auto bg-[#DCF8C6] border border-[#C2E7A9] rounded-2xl rounded-tr-xs p-3.5 shadow-sm text-slate-800 space-y-2">
          <div className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed select-text">
            {getWhatsAppText()}
          </div>
          <div className="text-[9px] text-slate-400 text-right flex items-center justify-end gap-1">
            <span>{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="text-blue-500 font-bold">✓✓</span>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="shrink-0 p-3.5 sm:p-4 bg-white border-t border-slate-200 space-y-2.5 max-h-[46dvh] overflow-y-auto">
        <WhatsAppInput
          label="Nomor WhatsApp Pelanggan"
          value={waRecipientPhone}
          onChange={setWaRecipientPhone}
          placeholder="81234567890"
        />

        {/* Sementara nonaktifkan mode Gateway — arahkan selalu ke mode manual WA (wa.me) */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleOpenWhatsAppReal}
              className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Kirim via WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={handleCopyWhatsAppText}
              className="py-2.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
            >
              {copiedWhatsApp ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
              <span>{copiedWhatsApp ? 'Tersalin!' : 'Salin Teks'}</span>
            </button>
          </div>
          <p className="text-[11px] text-center text-slate-500">
            Membuka chat WhatsApp langsung ke nomor pelanggan dengan nota belanja otomatis.
          </p>
        </div>
      </div>
    </div>
  );
};
