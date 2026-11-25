import React from 'react';
import { AlertCircle, Sparkles, Shirt, Droplets, Zap, ShieldAlert, FileText } from 'lucide-react';
import type { CustomerLaundryPreferences } from '../../types/laundry_core';

interface CustomerPreferenceBadgesProps {
  preferences?: CustomerLaundryPreferences | null;
  className?: string;
  showTitle?: boolean;
}

export const CustomerPreferenceBadges: React.FC<CustomerPreferenceBadgesProps> = ({
  preferences,
  className = '',
  showTitle = false,
}) => {
  if (!preferences) return null;

  const hasAllergies = Array.isArray(preferences.allergies) && preferences.allergies.length > 0;
  const hasPreferences =
    hasAllergies ||
    preferences.separateColors ||
    preferences.preferFoldOrHang ||
    preferences.preferPerfume ||
    preferences.avoidSoftener ||
    preferences.alwaysExpress ||
    Boolean(preferences.customNotes);

  if (!hasPreferences) return null;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {showTitle && (
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
          <span>Preferensi Perawatan Pakaian Pelanggan</span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {hasAllergies && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-rose-100 text-rose-900 border border-rose-300 shadow-2xs">
            <ShieldAlert className="w-3 h-3 text-rose-600 shrink-0" />
            <span>Alergi: {preferences.allergies!.join(', ')}</span>
          </span>
        )}

        {preferences.separateColors && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-200">
            <Sparkles className="w-3 h-3 text-purple-600 shrink-0" />
            <span>Pisah Warna</span>
          </span>
        )}

        {preferences.preferFoldOrHang === 'HANG' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
            <Shirt className="w-3 h-3 text-blue-600 shrink-0" />
            <span>Gantung (Hanger)</span>
          </span>
        )}

        {preferences.preferFoldOrHang === 'FOLD' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-sky-100 text-sky-900 border border-sky-200">
            <Shirt className="w-3 h-3 text-sky-600 shrink-0" />
            <span>Lipat Rapi</span>
          </span>
        )}

        {preferences.preferFoldOrHang === 'MIXED' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
            <Shirt className="w-3 h-3 text-slate-600 shrink-0" />
            <span>Gantung + Lipat</span>
          </span>
        )}

        {preferences.preferPerfume && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-pink-100 text-pink-900 border border-pink-200">
            <Droplets className="w-3 h-3 text-pink-600 shrink-0" />
            <span>Parfum: {preferences.preferPerfume}</span>
          </span>
        )}

        {preferences.avoidSoftener && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
            <Droplets className="w-3 h-3 text-amber-600 shrink-0" />
            <span>Tanpa Pelembut</span>
          </span>
        )}

        {preferences.alwaysExpress && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-500 text-slate-950 border border-amber-600">
            <Zap className="w-3 h-3 text-slate-950 shrink-0" />
            <span>Prioritas Kilat</span>
          </span>
        )}

        {preferences.customNotes && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 max-w-xs truncate"
            title={preferences.customNotes}
          >
            <FileText className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="truncate">{preferences.customNotes}</span>
          </span>
        )}
      </div>
    </div>
  );
};
