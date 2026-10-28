import React from 'react';
import { Clock, ShieldAlert, LogIn, Sparkles } from 'lucide-react';

export interface SessionExpiredModalProps {
  isOpen: boolean;
  reason?: 'expired' | 'revoked';
  type?: 'merchant' | 'platform';
  message?: string;
  onConfirm: () => void;
}

export const SessionExpiredModal: React.FC<SessionExpiredModalProps> = ({
  isOpen,
  reason = 'expired',
  type = 'merchant',
  message,
  onConfirm,
}) => {
  if (!isOpen) return null;

  const isRevoked = reason === 'revoked';
  const isPlatform = type === 'platform';

  const defaultTitle = isRevoked
    ? 'Sesi Perangkat Dicabut'
    : isPlatform
      ? 'Sesi Superadmin Berakhir'
      : 'Sesi Login Berakhir';

  const defaultMessage = isRevoked
    ? (message || 'Sesi login perangkat Anda telah dicabut oleh pemilik toko demi keamanan akun. Silakan login kembali.')
    : (message || (isPlatform 
        ? 'Masa aktif login Superadmin telah selesai demi menjaga keamanan data platform. Silakan login kembali untuk melanjutkan.'
        : 'Masa aktif login Anda telah selesai demi menjaga keamanan transaksi toko. Silakan masuk kembali untuk melanjutkan.'));

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto animate-in fade-in duration-200">
      {/* Backdrop Gelap Tidak Bisa Diklik Sembarangan */}
      <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm" />

      {/* Dialog Bottom-Sheet di Mobile, Centered Modal di Desktop */}
      <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4 text-center">
        <div className="w-full max-w-md transform overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white text-left align-middle shadow-2xl transition-all border border-slate-200 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 flex flex-col">
          
          {/* Header Visual */}
          <div className="p-6 pb-4 sm:p-7 sm:pb-5 text-center flex flex-col items-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-inner ${
              isRevoked ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-blue-50 text-blue-900 border border-blue-100'
            }`}>
              {isRevoked ? (
                <ShieldAlert className="w-8 h-8 animate-pulse" />
              ) : (
                <Clock className="w-8 h-8 animate-pulse text-blue-900" />
              )}
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2.5 bg-slate-100 text-slate-700 border border-slate-200">
              <Sparkles className="w-3 h-3 text-amber-500" />
              {isRevoked ? 'Keamanan Akun' : 'Perlindungan Sesi Aktif'}
            </div>

            <h3 className="text-xl font-black text-slate-900 tracking-tight text-center">
              {defaultTitle}
            </h3>

            <p className="text-sm text-slate-600 mt-2 text-center leading-relaxed">
              {defaultMessage}
            </p>
          </div>

          {/* Sticky Safe Footer */}
          <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-2 shrink-0 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={onConfirm}
              className="w-full py-3.5 px-5 rounded-xl font-bold text-white bg-blue-900 hover:bg-blue-800 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Masuk Kembali Sekarang</span>
            </button>
            <p className="text-[11px] text-center text-slate-400 mt-1">
              Data transaksi yang telah tersimpan di cloud tetap aman
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};
