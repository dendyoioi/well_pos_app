import React, { useEffect, useState } from 'react';
import { Edit3, ExternalLink, MessageCircle, RotateCcw, Send, X } from 'lucide-react';
import { WhatsAppInput } from './WhatsAppInput';
import { WhatsAppChatPreview } from './WhatsAppChatPreview';
import { buildWhatsAppUrl } from '../../utils/phone';

export interface WhatsAppSendPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  senderName: string;
  recipientName?: string;
  initialPhone?: string | null;
  initialMessage: string;
  onSent?: () => void;
}

export const WhatsAppSendPreviewModal: React.FC<WhatsAppSendPreviewModalProps> = ({
  isOpen,
  onClose,
  title = 'Pratinjau Pesan WhatsApp',
  subtitle,
  senderName,
  recipientName,
  initialPhone,
  initialMessage,
  onSent,
}) => {
  const [phone, setPhone] = useState<string>(initialPhone || '');
  const [message, setMessage] = useState<string>(initialMessage || '');
  const [isEditingMessage, setIsEditingMessage] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setPhone(initialPhone || '');
      setMessage(initialMessage || '');
      setIsEditingMessage(false);
    }
  }, [isOpen, initialPhone, initialMessage]);

  if (!isOpen) return null;

  const handleConfirmSend = () => {
    const waUrl = buildWhatsAppUrl(phone, message);
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    onSent?.();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-900/65 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="px-4 py-3.5 sm:px-5 sm:py-4 border-b border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <MessageCircle className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">{title}</h3>
              {subtitle && <p className="text-[11px] text-slate-500 truncate">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pratinjau WhatsApp"
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-3.5">
          {/* Input Nomor Tujuan */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5">
            <WhatsAppInput
              label="Nomor WhatsApp Tujuan"
              value={phone}
              onChange={setPhone}
              placeholder="81234567890"
              helperText="Kasir dapat memeriksa atau mengubah nomor tujuan sebelum membuka WhatsApp."
            />
          </div>

          {/* Simulasi Tampilan Chat WhatsApp Asli */}
          <WhatsAppChatPreview
            senderName={senderName}
            recipientLabel={recipientName}
            recipientPhone={phone}
            message={message}
          />

          {/* Toggle Ringkas Edit Isi Pesan */}
          <div className="border border-slate-200 rounded-2xl bg-slate-50/70 overflow-hidden">
            <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsEditingMessage((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-900 hover:text-blue-700 transition-colors cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditingMessage ? 'Sembunyikan Editor Pesan' : 'Edit Isi Pesan'}</span>
              </button>
              {isEditingMessage && message !== initialMessage && (
                <button
                  type="button"
                  onClick={() => setMessage(initialMessage)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Teks</span>
                </button>
              )}
            </div>

            {isEditingMessage && (
              <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-200/80 bg-white">
                <textarea
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tulis isi pesan WhatsApp..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 leading-relaxed focus:border-blue-900 focus:ring-2 focus:ring-blue-900/15 outline-none resize-y"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Perubahan teks di sini langsung diperbarui pada simulasi chat WhatsApp di atas.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="p-4 sm:px-5 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={!message.trim()}
            onClick={handleConfirmSend}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-extrabold shadow-xs transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Buka &amp; Kirim di WhatsApp</span>
            <ExternalLink className="w-3 h-3 opacity-85" />
          </button>
        </div>
      </div>
    </div>
  );
};
