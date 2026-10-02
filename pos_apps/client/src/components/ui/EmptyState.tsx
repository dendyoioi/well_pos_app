import React from 'react';
import { PackageOpen } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className = '',
  compact = false,
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center mx-auto ${
        compact ? 'py-6 px-4' : 'py-10 sm:py-14 px-6'
      } ${className}`}
    >
      <div
        className={`rounded-3xl flex items-center justify-center text-blue-900 shadow-xs mb-3.5 transition-transform duration-300 hover:scale-105 ${
          compact ? 'w-11 h-11 bg-blue-50/80 text-xl' : 'w-14 h-14 bg-blue-50 text-2xl border border-blue-100/60'
        }`}
      >
        {icon || <PackageOpen className={compact ? 'w-5 h-5' : 'w-7 h-7 text-blue-900'} />}
      </div>

      <h3 className={`font-black text-blue-950 ${compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'}`}>
        {title}
      </h3>

      {description && (
        <p
          className={`text-slate-500 max-w-sm mt-1 leading-relaxed ${
            compact ? 'text-[11px]' : 'text-xs sm:text-sm'
          }`}
        >
          {description}
        </p>
      )}

      {(actionLabel || secondaryActionLabel) && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-900 hover:bg-blue-950 active:scale-95 text-white font-extrabold text-xs shadow-xs transition-all cursor-pointer"
            >
              {actionLabel}
            </button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs transition-all cursor-pointer"
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
