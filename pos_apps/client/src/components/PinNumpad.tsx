import React from 'react';
import { Delete, KeyRound } from 'lucide-react';

interface PinNumpadProps {
  pin: string;
  onPinChange: (newPin: string) => void;
  onSubmit: (submittedPin?: string) => void;
  loading: boolean;
}

export const PinNumpad: React.FC<PinNumpadProps> = ({
  pin,
  onPinChange,
  onSubmit,
  loading,
}) => {
  const handleNumberClick = (num: number) => {
    if (pin.length < 6) {
      const newPin = pin + num;
      onPinChange(newPin);
      if (newPin.length === 6) {
        setTimeout(() => onSubmit(newPin), 150);
      }
    }
  };

  const handleDelete = () => {
    onPinChange(pin.slice(0, -1));
  };

  const handleClear = () => {
    onPinChange('');
  };

  return (
    <div className="flex flex-col items-center w-full max-w-xs mx-auto">
      {/* 6-Digit PIN Indicators */}
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

      {/* Numeric Keypad Grid */}
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

        {/* Clear (C) */}
        <button
          type="button"
          disabled={loading || pin.length === 0}
          onClick={handleClear}
          className="h-15 py-3.5 rounded-2xl bg-rose-50/70 hover:bg-rose-100 active:scale-95 text-xs font-bold text-rose-600 border border-rose-200 transition-all flex items-center justify-center select-none disabled:opacity-40"
        >
          RESET
        </button>

        {/* Zero (0) */}
        <button
          key={0}
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
          disabled={loading || pin.length === 0}
          onClick={handleDelete}
          className="h-15 py-3.5 rounded-2xl bg-slate-100/80 hover:bg-slate-200/80 active:scale-95 text-slate-700 border border-slate-200 transition-all flex items-center justify-center select-none disabled:opacity-40"
        >
          <Delete className="w-5 h-5" />
        </button>
      </div>

      {/* Manual Submit Button */}
      <button
        type="button"
        disabled={loading || pin.length < 6}
        onClick={() => onSubmit()}
        className="w-full mt-5 py-3.5 px-4 bg-blue-900 hover:bg-blue-800 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 text-sm tracking-wide"
      >
        <KeyRound className="w-4 h-4" />
        {loading ? 'Memverifikasi...' : 'Masuk Kasir'}
      </button>
    </div>
  );
};
