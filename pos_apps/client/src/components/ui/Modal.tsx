import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  closeOnBackdropClick?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  closeOnBackdropClick = true,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
    '2xl': 'max-w-4xl',
    full: 'max-w-[95vw] sm:max-w-[90vw] h-[90vh]',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={() => closeOnBackdropClick && onClose()}
      />

      {/* Modal Dialog */}
      <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4 text-center">
        <div
          className={`w-full ${sizeStyles[size]} transform overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white text-left align-middle shadow-2xl transition-all border border-slate-200/80 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 flex flex-col max-h-[92vh] overscroll-contain`}
        >
          {/* Modal Header */}
          {(title || subtitle) && (
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="pr-4">
                {title && (
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">{title}</h3>
                )}
                {subtitle && (
                  <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 font-medium">{subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Modal Body */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 overscroll-contain">{children}</div>

          {/* Modal Footer */}
          {footer && (
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5 sm:gap-3 shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
