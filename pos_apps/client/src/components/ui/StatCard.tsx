import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive?: boolean;
    label?: string;
  };
  icon?: React.ReactNode;
  iconBgColor?: string;
  badge?: React.ReactNode;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  icon,
  iconBgColor = 'bg-blue-50 text-blue-900',
  badge,
  className = '',
}) => {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
            {title}
          </p>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{value}</p>
        </div>
        {icon && (
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${iconBgColor}`}
          >
            {icon}
          </div>
        )}
      </div>

      {(subtitle || trend || badge) && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          {trend && (
            <div
              className={`flex items-center gap-1 font-bold ${
                trend.isPositive
                  ? 'text-emerald-600'
                  : trend.isPositive === false
                  ? 'text-rose-600'
                  : 'text-slate-500'
              }`}
            >
              {trend.isPositive ? (
                <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              ) : trend.isPositive === false ? (
                <TrendingDown className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Minus className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{trend.value > 0 ? `+${trend.value}%` : `${trend.value}%`}</span>
              {trend.label && <span className="text-slate-500 font-normal">{trend.label}</span>}
            </div>
          )}
          {subtitle && !trend && <span className="text-slate-500 font-medium">{subtitle}</span>}
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
      )}
    </div>
  );
};
