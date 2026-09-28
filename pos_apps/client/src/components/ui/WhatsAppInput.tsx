import React from 'react';

export interface WhatsAppInputProps {
  label?: string;
  value: string;
  onChange: (formattedValue: string) => void;
  error?: string | null;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  placeholder?: string;
}

/**
 * Komponen Standar Input Nomor WhatsApp Indonesia di seluruh platform POS
 * Format Output: +628...
 * Tampilan UI: Fixed badge 🇮🇩 +62 dengan input numerik khusus digit lokal (8...)
 */
export const WhatsAppInput: React.FC<WhatsAppInputProps> = ({
  label = 'Nomor WhatsApp (Indonesia)',
  value,
  onChange,
  error,
  helperText,
  required,
  disabled,
  id,
  className = '',
  placeholder = '81234567890',
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : 'whatsapp-input');

  // Ekstrak digit angka lokal setelah kode negara +62 untuk ditampilkan di field
  const getDisplayDigits = (val: string): string => {
    if (!val) return '';
    let digits = val.replace(/\D/g, '');
    if (digits.startsWith('62')) {
      digits = digits.slice(2);
    }
    digits = digits.replace(/^0+/, '');
    return digits.slice(0, 13);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '');
    if (raw.startsWith('62')) {
      raw = raw.slice(2);
    }
    raw = raw.replace(/^0+/, '');
    if (raw.length > 13) {
      raw = raw.slice(0, 13);
    }
    const formatted = raw ? `+62${raw}` : '';
    onChange(formatted);
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
        <span className="absolute left-3 flex items-center font-bold text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-md border border-slate-200 select-none z-10">
          🇮🇩 +62
        </span>
        <input
          id={inputId}
          type="tel"
          inputMode="numeric"
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          maxLength={13}
          value={getDisplayDigits(value)}
          onChange={handleChange}
          className={`w-full rounded-xl border bg-white text-slate-900 pl-20 pr-3.5 py-2.5 text-sm font-medium transition-all outline-none placeholder:text-slate-400 ${
            error
              ? 'border-rose-400 bg-rose-50/30 text-rose-900 focus:border-rose-500 focus:ring-4 focus:ring-rose-100'
              : 'border-slate-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-100'
          } disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed`}
        />
      </div>
      {error ? (
        <p className="text-xs text-rose-600 font-semibold">{error}</p>
      ) : (
        <p className="text-xs text-slate-500 font-medium">
          {helperText || 'Ketik angka setelah +62 (diawali angka 8, maksimal 13 digit).'}
        </p>
      )}
    </div>
  );
};
