import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { ConfirmModal } from '../components/ConfirmModal';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ConfirmDialogOptions {
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
}

export interface AlertDialogOptions {
  title?: string;
  message: React.ReactNode;
  confirmText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
}

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface DialogContextValue {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  alert: (options: AlertDialogOptions | string) => Promise<void>;
  toast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant: 'danger' | 'warning' | 'info' | 'success';
    isAlert: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'info',
    isAlert: false,
  });

  const resolverRef = useRef<((value: any) => void) | null>(null);

  // Toast State
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const confirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setModalConfig({
        isOpen: true,
        title: options.title,
        message: options.message,
        confirmText: options.confirmText,
        cancelText: options.cancelText,
        variant: options.variant || 'warning',
        isAlert: false,
      });
    });
  }, []);

  const alert = useCallback((options: AlertDialogOptions | string): Promise<void> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      const title = typeof options === 'string' ? 'Pemberitahuan' : options.title || 'Pemberitahuan';
      const message = typeof options === 'string' ? options : options.message;
      const variant = typeof options === 'string' ? 'warning' : options.variant || 'info';
      const confirmText = typeof options === 'string' ? 'Mengerti' : options.confirmText;

      setModalConfig({
        isOpen: true,
        title,
        message,
        confirmText,
        variant,
        isAlert: true,
      });
    });
  }, []);

  const handleClose = () => {
    setModalConfig((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  };

  const handleConfirm = () => {
    setModalConfig((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  };

  // Global browser pop-up interceptor (fallback safety net)
  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (msg?: any) => {
      alert(String(msg || ''));
    };

    return () => {
      window.alert = originalAlert;
    };
  }, [alert]);

  return (
    <DialogContext.Provider value={{ confirm, alert, toast }}>
      {children}

      {/* Global Elegant Dialog */}
      <ConfirmModal
        isOpen={modalConfig.isOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
        variant={modalConfig.variant}
        isAlert={modalConfig.isAlert}
      />

      {/* Global Floating Non-Blocking Toasts (Top-Center Eye-Level) */}
      {toasts.length > 0 && (
        <div className="fixed top-4 inset-x-0 mx-auto z-[99999] flex flex-col items-center gap-2 max-w-md w-full pointer-events-none px-4">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`w-full p-3 sm:p-3.5 rounded-2xl shadow-2xl border flex items-center justify-between gap-3 text-xs sm:text-sm font-bold pointer-events-auto backdrop-blur-md transition-all duration-300 animate-in slide-in-from-top-4 fade-in ${
                t.type === 'success'
                  ? 'bg-slate-900/95 text-white border-emerald-500/40 shadow-emerald-950/20'
                  : t.type === 'error'
                  ? 'bg-slate-900/95 text-white border-rose-500/40 shadow-rose-950/20'
                  : 'bg-slate-900/95 text-white border-blue-500/40 shadow-blue-950/20'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                    t.type === 'success'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : t.type === 'error'
                      ? 'bg-rose-500/20 text-rose-400'
                      : 'bg-blue-500/20 text-blue-400'
                  }`}
                >
                  {t.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : t.type === 'error' ? (
                    <AlertCircle className="w-4 h-4" />
                  ) : (
                    <Info className="w-4 h-4" />
                  )}
                </div>
                <span className="leading-snug truncate">{t.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </DialogContext.Provider>
  );
};

export const useDialog = (): DialogContextValue => {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return ctx;
};
