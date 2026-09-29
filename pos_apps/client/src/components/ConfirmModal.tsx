import React from 'react';
import { AlertTriangle, Trash2, Info, X, CheckCircle2 } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  loading?: boolean;
  isAlert?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText = 'Batal',
  variant = 'danger',
  loading = false,
  isAlert = false,
}) => {
  if (!isOpen) return null;

  const effectiveConfirmText = confirmText || (isAlert ? 'Mengerti' : 'Ya, Lanjutkan');

  const variantStyles = {
    danger: {
      bgIcon: 'bg-rose-100 text-rose-600 border-rose-200',
      icon: <Trash2 className="w-6 h-6 stroke-[2.5]" />,
      btnConfirm: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20',
    },
    warning: {
      bgIcon: 'bg-amber-100 text-amber-600 border-amber-200',
      icon: <AlertTriangle className="w-6 h-6 stroke-[2.5]" />,
      btnConfirm: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20',
    },
    info: {
      bgIcon: 'bg-blue-100 text-blue-900 border-blue-200',
      icon: <Info className="w-6 h-6 stroke-[2.5]" />,
      btnConfirm: 'bg-blue-900 hover:bg-blue-800 text-white shadow-blue-900/20',
    },
    success: {
      bgIcon: 'bg-emerald-100 text-emerald-600 border-emerald-200',
      icon: <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />,
      btnConfirm: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20',
    },
  }[variant];

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-scaleUp">
        {/* Header with Icon */}
        <div className="p-4 sm:p-6 pb-3 sm:pb-4 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 shadow-xs ${variantStyles.bgIcon}`}
            >
              {variantStyles.icon}
            </div>
            <div>
              <h3 className="font-black text-blue-950 text-base sm:text-lg leading-snug">{title}</h3>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {isAlert ? 'Pemberitahuan Sistem' : 'Konfirmasi Tindakan'}
              </span>
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Body */}
        <div className="px-6 py-2">
          <div className="text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 p-4 rounded-2xl">
            {message}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-6 pt-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-end gap-2.5">
          {!isAlert && (
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`px-5 py-2.5 text-xs font-extrabold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer ${variantStyles.btnConfirm} disabled:opacity-50`}
          >
            {loading && (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            <span>{effectiveConfirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
