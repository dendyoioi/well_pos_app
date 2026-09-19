import React from 'react';
import { Lock, Sparkles, Check, X, Zap } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  featureHighlight?: string;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  title = 'Tingkatkan ke Paket Pro',
  message = 'Fitur Split Bill & Tahan Antrean tersedia di Paket Pro. Upgrade sekarang untuk mengaktifkan!',
  featureHighlight = 'Split Payment & Hold Order',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Banner Header dengan gradien modern */}
        <div className="bg-gradient-to-br from-indigo-900 via-blue-900 to-indigo-950 text-white p-6 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-black tracking-wide uppercase mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Fitur Eksklusif PRO</span>
          </div>

          <h3 className="text-xl font-black tracking-tight">{title}</h3>
          <p className="text-xs text-blue-100/80 mt-1 leading-relaxed">{message}</p>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3.5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-black text-amber-950">{featureHighlight} Terkunci</p>
              <p className="text-[11px] text-amber-800/90 mt-0.5 leading-normal">
                Akun Anda saat ini menggunakan paket <strong>FREE</strong>. Untuk operasional kasir multi-cabang tanpa batasan, beralihlah ke paket <strong>PRO</strong>.
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <p className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Keunggulan Paket PRO (Rp 129.000 / bln):
            </p>
            <ul className="space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
                <span><strong>Split Payment:</strong> Terima pembayaran campuran (Tunai + QRIS).</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
                <span><strong>Tahan Antrean:</strong> Simpan pesanan tertahan saat jam sibuk.</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
                <span><strong>Laporan HPP & Laba Rugi:</strong> Analisis profit kotor & margin real-time.</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
                <span><strong>Struk Bersih:</strong> Tanpa watermark / branding tambahan.</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
                <span>Hingga 5 Cabang Toko & 99 Kasir.</span>
              </li>
            </ul>
          </div>

          {/* Action Button */}
          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                alert('Silakan hubungi WhatsApp Support Well POS (0812-3456-7890) atau hubungi tim administrator untuk mengaktifkan paket PRO!');
                onClose();
              }}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-900 to-indigo-800 hover:from-blue-800 hover:to-indigo-700 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>Upgrade ke Paket PRO Sekarang</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
            >
              Lanjutkan dengan Paket FREE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
