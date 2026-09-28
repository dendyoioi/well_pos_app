import React from 'react';
import { Delete, KeyRound, ArrowRight, User } from 'lucide-react';

interface PinNumpadProps {
  pin: string;
  onPinChange: (newPin: string) => void;
  onSubmit: (submittedPin?: string) => void;
  loading: boolean;
  // Props opsional untuk mode two-step: ID Staff → PIN
  staffCode?: string;                          // undefined = single-step (PIN only)
  onStaffCodeChange?: (code: string) => void;  // undefined = single-step
  onConfirmStaffCode?: () => void;             // dipanggil saat tombol "Lanjut ke PIN" diklik
  maxStaffCodeLength?: number;                 // default 5
  isStaffConfirmed?: boolean;                  // true = sudah confirmed, numpad di mode PIN
}

export const PinNumpad: React.FC<PinNumpadProps> = ({
  pin,
  onPinChange,
  onSubmit,
  loading,
  staffCode,
  onStaffCodeChange,
  onConfirmStaffCode,
  maxStaffCodeLength = 5,
  isStaffConfirmed = false,
}) => {
  // Deteksi two-step mode
  const isTwoStep = typeof onStaffCodeChange === 'function';

  // Apakah sekarang sedang di step ID Staff?
  // True jika: two-step mode, staff belum confirmed, dan onConfirmStaffCode ada
  const isOnStaffStep = isTwoStep && !isStaffConfirmed;

  // Apakah sekarang di step PIN?
  const isOnPinStep = !isTwoStep || isStaffConfirmed;

  const handleNumberClick = (num: number) => {
    if (isOnStaffStep && staffCode !== undefined) {
      // Step 1: input digit ID Staff
      if (staffCode.length < maxStaffCodeLength) {
        onStaffCodeChange!(staffCode + num);
      }
    } else {
      // Step 2: input digit PIN
      if (pin.length < 6) {
        const newPin = pin + num;
        onPinChange(newPin);
        if (newPin.length === 6) {
          setTimeout(() => onSubmit(newPin), 150);
        }
      }
    }
  };

  const handleDelete = () => {
    if (isOnStaffStep && staffCode !== undefined) {
      onStaffCodeChange!(staffCode.slice(0, -1));
    } else {
      onPinChange(pin.slice(0, -1));
    }
  };

  const handleClear = () => {
    if (isOnStaffStep && staffCode !== undefined) {
      onStaffCodeChange!('');
    } else {
      onPinChange('');
    }
  };

  const currentValueLength = isOnStaffStep ? (staffCode?.length ?? 0) : pin.length;

  return (
    <div className="flex flex-col items-center w-full max-w-xs mx-auto">

      {/* === Two-Step Display (ID Staff → PIN) === */}
      {isTwoStep ? (
        <div className="w-full mb-4">
          {/* Step indicators */}
          <div className="flex items-center w-full gap-2 mb-3">
            {/* Step 1: ID Staff */}
            <div className={`flex-1 flex flex-col items-center px-2 py-2.5 rounded-xl border transition-all duration-200 ${
              isOnPinStep
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-blue-900 border-blue-900 shadow-md shadow-blue-900/20'
            }`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                isOnPinStep ? 'text-emerald-700' : 'text-blue-200'
              }`}>
                ID Staff
              </span>
              <span className={`font-mono font-extrabold tracking-[0.2em] text-base leading-none ${
                isOnPinStep ? 'text-emerald-800' : 'text-white'
              }`}>
                {staffCode && staffCode.length > 0
                  ? staffCode.padEnd(maxStaffCodeLength, '·')
                  : '·····'}
              </span>
            </div>

            {/* Arrow divider */}
            <ArrowRight className={`w-4 h-4 shrink-0 transition-colors ${
              isOnPinStep ? 'text-emerald-400' : 'text-slate-300'
            }`} />

            {/* Step 2: PIN dots */}
            <div className={`flex-1 flex flex-col items-center px-2 py-2.5 rounded-xl border transition-all duration-200 ${
              isOnPinStep
                ? 'bg-blue-900 border-blue-900 shadow-md shadow-blue-900/20'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${
                isOnPinStep ? 'text-blue-200' : 'text-slate-400'
              }`}>
                PIN
              </span>
              <div className="flex gap-2 items-center h-3">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-full transition-all duration-150 ${
                      isOnPinStep
                        ? i < pin.length
                          ? 'w-2.5 h-2.5 bg-white shadow-sm scale-110'
                          : 'w-2 h-2 bg-blue-700/50'
                        : 'w-2 h-2 bg-slate-200'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Context hint */}
          <p className="text-center text-xs text-slate-500 font-medium">
            {isOnPinStep
              ? 'Masukkan 6-digit PIN:'
              : `Masukkan ID Staff (${staffCode?.length ?? 0}/${maxStaffCodeLength} digit):`}
          </p>
        </div>
      ) : (
        /* === Single-Step PIN Dots === */
        <div className="flex items-center justify-center gap-3.5 my-5">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-all duration-200 ${
                i < pin.length
                  ? 'bg-blue-900 shadow-md shadow-blue-900/30 scale-110'
                  : 'border-2 border-slate-300 bg-white shadow-inner'
              }`}
            />
          ))}
        </div>
      )}

      {/* === Numeric Keypad Grid === */}
      <div className="grid grid-cols-3 gap-2.5 w-full">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            data-key={num}
            type="button"
            disabled={loading}
            onClick={() => handleNumberClick(num)}
            className="h-15 py-3.5 rounded-2xl bg-white hover:bg-blue-50/80 active:scale-95 active:bg-blue-100 text-2xl font-bold text-slate-800 border border-slate-200/90 shadow-sm transition-all flex items-center justify-center select-none disabled:opacity-50"
          >
            {num}
          </button>
        ))}

        {/* RESET */}
        <button
          type="button"
          disabled={loading || currentValueLength === 0}
          onClick={handleClear}
          className="h-15 py-3.5 rounded-2xl bg-rose-50/70 hover:bg-rose-100 active:scale-95 text-[11px] font-bold text-rose-600 border border-rose-200 transition-all flex items-center justify-center select-none disabled:opacity-40"
        >
          RESET
        </button>

        {/* 0 */}
        <button
          data-key={0}
          type="button"
          disabled={loading}
          onClick={() => handleNumberClick(0)}
          className="h-15 py-3.5 rounded-2xl bg-white hover:bg-blue-50/80 active:scale-95 active:bg-blue-100 text-2xl font-bold text-slate-800 border border-slate-200/90 shadow-sm transition-all flex items-center justify-center select-none disabled:opacity-50"
        >
          0
        </button>

        {/* Backspace */}
        <button
          type="button"
          disabled={loading || currentValueLength === 0}
          onClick={handleDelete}
          className="h-15 py-3.5 rounded-2xl bg-slate-100/80 hover:bg-slate-200/80 active:scale-95 text-slate-700 border border-slate-200 transition-all flex items-center justify-center select-none disabled:opacity-40"
        >
          <Delete className="w-5 h-5" />
        </button>
      </div>

      {/* === Action Button === */}
      {isTwoStep && isOnStaffStep ? (
        // Tombol Lanjut ke PIN (step 1 → step 2)
        <button
          type="button"
          disabled={loading || !staffCode || staffCode.length === 0}
          onClick={onConfirmStaffCode}
          className="w-full mt-5 py-3.5 px-4 bg-blue-900 hover:bg-blue-800 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 text-sm tracking-wide"
        >
          <User className="w-4 h-4" />
          Lanjut Masukkan PIN
          <ArrowRight className="w-4 h-4" />
        </button>
      ) : (
        // Tombol Submit (step 2 atau single-step)
        <button
          type="button"
          disabled={loading || pin.length < 6}
          onClick={() => onSubmit()}
          className="w-full mt-5 py-3.5 px-4 bg-blue-900 hover:bg-blue-800 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 text-sm tracking-wide"
        >
          <KeyRound className="w-4 h-4" />
          {loading ? 'Memverifikasi...' : 'Masuk Kasir'}
        </button>
      )}
    </div>
  );
};
