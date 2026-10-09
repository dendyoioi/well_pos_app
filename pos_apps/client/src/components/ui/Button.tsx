import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'primary'
    | 'secondary'
    | 'outline'
    | 'ghost'
    | 'danger'
    | 'danger-outline'
    | 'success'
    | 'amber'
    | 'excel'
    | 'whatsapp';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  fullWidthOnMobile?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  fullWidthOnMobile = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-bold transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none focus:outline-none focus:ring-2 focus:ring-offset-1 shrink-0 whitespace-nowrap cursor-pointer';

  const sizeStyles = {
    sm: 'h-[34px] text-xs px-3 py-1.5 gap-1.5 rounded-lg',
    md: 'h-10 text-xs sm:text-sm px-4 py-2.5 gap-2 rounded-xl',
    lg: 'h-12 text-sm sm:text-base px-5 py-3 gap-2.5 rounded-2xl font-black',
  };

  const variantStyles = {
    primary:
      'bg-blue-900 hover:bg-blue-800 active:bg-blue-950 text-white shadow-sm shadow-blue-900/20 focus:ring-blue-900 border border-blue-800',
    secondary:
      'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 focus:ring-slate-400 border border-slate-200',
    outline:
      'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-300 hover:border-slate-400 focus:ring-blue-900 shadow-2xs',
    ghost:
      'bg-transparent hover:bg-slate-100 active:bg-slate-200 text-slate-600 hover:text-slate-900 focus:ring-slate-300',
    danger:
      'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-sm shadow-rose-600/20 focus:ring-rose-600 border border-rose-700',
    'danger-outline':
      'bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200 focus:ring-rose-400 shadow-2xs',
    success:
      'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm shadow-emerald-600/20 focus:ring-emerald-600 border border-emerald-700',
    amber:
      'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black shadow-sm shadow-amber-500/20 focus:ring-amber-500 border border-amber-400',
    excel:
      'bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 border border-emerald-200 focus:ring-emerald-500 shadow-2xs',
    whatsapp:
      'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm shadow-emerald-600/20 focus:ring-emerald-600 border border-emerald-700',
  };

  const widthStyle = fullWidth
    ? 'w-full'
    : fullWidthOnMobile
    ? 'w-full sm:w-auto'
    : '';

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${widthStyle} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>{children}</span>
        </>
      ) : (
        <>
          {icon && iconPosition === 'left' && <span className="shrink-0 flex items-center">{icon}</span>}
          {children && <span>{children}</span>}
          {icon && iconPosition === 'right' && <span className="shrink-0 flex items-center">{icon}</span>}
        </>
      )}
    </button>
  );
};
