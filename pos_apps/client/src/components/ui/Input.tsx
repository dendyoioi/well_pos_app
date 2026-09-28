import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  inputSize?: 'sm' | 'md' | 'lg';
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      icon,
      iconPosition = 'left',
      inputSize = 'md',
      className = '',
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const sizeStyles = {
      sm: 'py-1.5 text-xs',
      md: 'py-2.5 text-sm',
      lg: 'py-3.5 text-base',
    };

    const paddingLeft = icon && iconPosition === 'left' ? 'pl-10' : 'pl-3.5';
    const paddingRight = icon && iconPosition === 'right' ? 'pr-10' : 'pr-3.5';

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && iconPosition === 'left' && (
            <div className="absolute left-3 flex items-center pointer-events-none text-slate-400">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={`w-full rounded-xl border transition-all duration-150 font-medium ${
              error
                ? 'border-rose-400 bg-rose-50/30 text-rose-900 focus:border-rose-500 focus:ring-rose-200'
                : 'border-slate-300 bg-white text-slate-900 focus:border-blue-600 focus:ring-blue-100'
            } ${sizeStyles[inputSize]} ${paddingLeft} ${paddingRight} disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed focus:outline-none focus:ring-4 ${className}`}
            {...props}
          />
          {icon && iconPosition === 'right' && (
            <div className="absolute right-3 flex items-center pointer-events-none text-slate-400">
              {icon}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}
        {helperText && !error && (
          <p className="text-xs text-slate-500 font-medium">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
