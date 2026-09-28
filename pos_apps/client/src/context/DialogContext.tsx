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

      {/* Global Toasts */}
      {toasts.length > 0 && (
        <div className="fixed top-5 right-5 z-[99999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`p-3.5 rounded-2xl shadow-xl border flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold pointer-events-auto animate-scaleUp ${
                t.type === 'success'
                  ? 'bg-emerald-900 text-white border-emerald-700/80'
                  : t.type === 'error'
                  ? 'bg-rose-900 text-white border-rose-700/80'
                  : 'bg-slate-900 text-white border-slate-700/80'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {t.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                ) : t.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
                ) : (
                  <Info className="w-4 h-4 text-blue-300 shrink-0" />
                )}
                <span>{t.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                className="p-1 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors shrink-0"
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
