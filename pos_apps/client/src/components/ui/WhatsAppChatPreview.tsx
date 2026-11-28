import React, { useMemo, useState } from 'react';
import { Check, Copy, Store } from 'lucide-react';

export interface WhatsAppChatPreviewProps {
  senderName: string;
  recipientLabel?: string;
  recipientPhone?: string;
  message: string;
  timestamp?: string;
  statusLabel?: string;
  compact?: boolean;
}

function renderFormattedLine(line: string, lineIdx: number): React.ReactNode {
  if (!line) {
    return <br key={`br-${lineIdx}`} />;
  }

  const tokenRegex = /(https?:\/\/[^\s]+|\*[^*\n]+\*|_[^_\n]+_)/g;
  const parts = line.split(tokenRegex);

  return (
    <React.Fragment key={`line-${lineIdx}`}>
      {parts.map((part, partIdx) => {
        if (!part) return null;

        if (/^https?:\/\/[^\s]+$/.test(part)) {
          return (
            <span
              key={`tok-${lineIdx}-${partIdx}`}
              className="text-sky-700 underline break-all"
            >
              {part}
            </span>
          );
        }

        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          const inner = part.slice(1, -1);
          return (
            <strong
              key={`tok-${lineIdx}-${partIdx}`}
              className="font-bold text-slate-900"
            >
              {inner}
            </strong>
          );
        }

        if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
          const inner = part.slice(1, -1);
          return (
            <em
              key={`tok-${lineIdx}-${partIdx}`}
              className="italic text-slate-700"
            >
              {inner}
            </em>
          );
        }

        return <React.Fragment key={`tok-${lineIdx}-${partIdx}`}>{part}</React.Fragment>;
      })}
    </React.Fragment>
  );
}

export const WhatsAppChatPreview: React.FC<WhatsAppChatPreviewProps> = ({
  senderName,
  recipientLabel,
  recipientPhone,
  message,
  timestamp,
  statusLabel = 'Akun Bisnis • Online',
  compact = false,
}) => {
  const [copied, setCopied] = useState(false);

  const displayTime = useMemo(() => {
    if (timestamp) return timestamp;
    return new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [timestamp]);

  const lines = useMemo(() => String(message || '').split('\n'), [message]);

  const handleCopyText = async () => {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Abaikan jika clipboard ditolak browser
    }
  };

  const recipientPill = [recipientLabel?.trim(), recipientPhone?.trim()]
    .filter(Boolean)
    .join(' • ');

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
      {/* Header Bar WhatsApp */}
      <div className="bg-[#075E54] text-white px-3.5 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#075E54] flex items-center justify-center font-black text-xs shrink-0">
            <Store className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-extrabold tracking-wide truncate">
              {senderName || 'Well POS Laundry'}
            </div>
            <div className="text-[10px] text-emerald-100 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span className="truncate">{statusLabel}</span>
            </div>
          </div>
        </div>

        {recipientPill && (
          <span className="px-2.5 py-0.5 rounded-full bg-white/15 border border-white/20 text-[10px] font-semibold text-emerald-50 truncate max-w-[48%] shrink-0">
            {recipientPill}
          </span>
        )}
      </div>

      {/* Area Chat Wallpaper */}
      <div
        className={`bg-[#EFEAE2] ${compact ? 'p-3 space-y-2' : 'p-3.5 sm:p-4 space-y-2.5'}`}
        style={{
          backgroundImage: 'radial-gradient(rgba(11, 20, 26, 0.06) 1px, transparent 0)',
          backgroundSize: '16px 16px',
        }}
      >
        <div className="text-center">
          <span className="inline-block bg-white/90 text-slate-600 text-[10px] font-semibold px-2.5 py-0.5 rounded-full shadow-2xs">
            HARI INI
          </span>
        </div>

        {/* Bubble Chat Keluar */}
        <div className="ml-auto max-w-[92%] bg-[#D9FDD3] border border-[#BDE9B6] rounded-2xl rounded-tr-xs px-3.5 py-2.5 shadow-2xs text-slate-800 space-y-1.5">
          <div className="text-xs leading-relaxed break-words select-text space-y-0.5">
            {message ? (
              lines.map((line, idx) => (
                <div key={idx} className="min-h-[1em]">
                  {renderFormattedLine(line, idx)}
                </div>
              ))
            ) : (
              <span className="italic text-slate-500">(Template pesan kosong)</span>
            )}
          </div>
          <div className="text-[10px] text-slate-500 text-right flex items-center justify-end gap-1 pt-0.5">
            <span>{displayTime}</span>
            <span className="text-[#53BDEB] font-bold">✓✓</span>
          </div>
        </div>
      </div>

      {/* Footer Bar Dekoratif WA */}
      <div className="bg-[#F0F2F5] px-3 py-2 border-t border-slate-200/80 flex items-center justify-between gap-2 text-[11px] text-slate-500">
        <span className="truncate">Pratinjau pesan siap kirim via WhatsApp</span>
        <button
          type="button"
          onClick={handleCopyText}
          className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-[11px] flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-600 shrink-0" />
              <span className="text-emerald-700">Tersalin!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 text-slate-500 shrink-0" />
              <span>Salin Teks</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
