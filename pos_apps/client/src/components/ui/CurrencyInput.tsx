import React from 'react';
import { formatThousands } from '../../utils/currency';

export interface CurrencyInputProps {
  label?: string;
  value: number | string;
  onChange: (numericValue: number, formattedValue: string) => void;
  error?: string | null;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
  className?: string;
  inputClassName?: string;
  prefixClassName?: string;
  placeholder?: string;
  prefix?: string;
  max?: number;
  min?: number;
}

/**
 * Komponen Standar Input Mata Uang (IDR) Otomatis Berpemisah Ribuan
 * Contoh: saat user mengetik '1000' otomatis tampil '1.000'
 */
export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  label,
  value,
  onChange,
  error,
  helperText,
  required,
  disabled,
  autoFocus,
  id,
  className = '',
  inputClassName = '',
  prefixClassName = '',
  placeholder = '0',
  prefix = 'Rp',
  max,
  min = 0,
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : 'currency-input');

  const displayValue = value === '' || value === undefined || value === null
    ? ''
    : (Number(value) === 0 && placeholder ? '' : formatThousands(value));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/\D/g, '');
    let numericValue = rawDigits ? parseInt(rawDigits, 10) : 0;
    if (min !== undefined && numericValue < min) {
      numericValue = min;
    }
    if (max !== undefined && numericValue > max) {
      numericValue = max;
    }
    const formatted = formatThousands(numericValue);
    onChange(numericValue, formatted);
  };

  return (
    <div className={`w-full space-y-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span
            className={`absolute left-3 flex items-center font-bold text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-md border border-slate-200 select-none z-10 pointer-events-none ${prefixClassName}`}
          >
            {prefix}
          </span>
        )}
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          disabled={disabled}
          required={required}
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={displayValue}
          onChange={handleChange}
          className={`w-full rounded-xl border bg-white text-slate-900 ${
            prefix ? 'pl-16' : 'pl-3.5'
          } pr-3.5 py-2.5 text-sm font-semibold transition-all outline-none placeholder:text-slate-400 ${
            error
              ? 'border-rose-400 bg-rose-50/30 text-rose-900 focus:border-rose-500 focus:ring-4 focus:ring-rose-100'
              : 'border-slate-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-100'
          } disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${inputClassName}`}
        />
      </div>
      {error ? (
        <p className="text-xs text-rose-600 font-semibold">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-slate-500 font-medium">{helperText}</p>
      ) : null}
    </div>
  );
};

