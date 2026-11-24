// Well POS - GlobalAnalyticsFilterBar Component
// Filter Bar Global Analitik Laundry (Preset Tanggal, Custom Range, dan Outlet Selector)

import React, { useState, useEffect } from 'react';
import { Calendar, Store, ChevronDown, Lock, AlertCircle } from 'lucide-react';
import type { AnalyticsDatePreset } from './useAnalyticsFilter';
import type { Outlet } from '../../../types/outlet';
import { api } from '../../../services/api';

const PRESET_OPTIONS: Array<{ value: AnalyticsDatePreset; label: string }> = [
  { value: 'today', label: 'Hari Ini' },
  { value: 'yesterday', label: 'Kemarin' },
  { value: 'this_week', label: 'Minggu Ini' },
  { value: '7days', label: '7 Hari Terakhir' },
  { value: 'month', label: 'Bulan Ini' },
  { value: 'last_month', label: 'Bulan Lalu' },
  { value: 'year', label: 'Tahun Ini' },
  { value: 'custom', label: 'Kustom Tanggal' },
];

interface GlobalAnalyticsFilterBarProps {
  preset: AnalyticsDatePreset;
  startDate: string;
  endDate: string;
  outletId: string;
  isOwner: boolean;
  canSwitchOutlet?: boolean;
  activeOutletName?: string;
  userRole?: string;
  dateError?: string | null;
  onPresetChange: (preset: AnalyticsDatePreset) => void;
  onCustomDateChange: (start: string, end: string) => boolean;
  onOutletChange: (outletId: string) => void;
}

export const GlobalAnalyticsFilterBar: React.FC<GlobalAnalyticsFilterBarProps> = ({
  preset,
  startDate,
  endDate,
  outletId,
  isOwner,
  canSwitchOutlet,
  activeOutletName,
  userRole,
  dateError,
  onPresetChange,
  onCustomDateChange,
  onOutletChange,
}) => {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loadingOutlets, setLoadingOutlets] = useState(false);

  // Local state untuk inline custom date input
  const [localStart, setLocalStart] = useState(startDate);
  const [localEnd, setLocalEnd] = useState(endDate);

  useEffect(() => {
    setLocalStart(startDate);
    setLocalEnd(endDate);
  }, [startDate, endDate]);

  useEffect(() => {
    let mounted = true;
    setLoadingOutlets(true);
    api
      .getOutlets()
      .then((res) => {
        if (mounted && res?.data) {
          setOutlets(res.data);
        }
      })
      .catch(() => {
        // Fallback jika gagal ambil outlet
      })
      .finally(() => {
        if (mounted) setLoadingOutlets(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (localStart && localEnd) {
      onCustomDateChange(localStart, localEnd);
    }
  };

  const currentOutletName =
    outlets.find((o) => o.id === outletId)?.name || 'Outlet Aktif';

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 shadow-sm mb-5 transition-all">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
        {/* Left: Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
          {/* Preset Selector */}
          <div className="relative flex-1 sm:flex-none min-w-[140px] sm:min-w-[170px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Calendar className="w-4 h-4 text-blue-900" />
            </div>
            <select
              value={preset}
              onChange={(e) => onPresetChange(e.target.value as AnalyticsDatePreset)}
              className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 appearance-none hover:bg-slate-100/70 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-colors cursor-pointer"
            >
              {PRESET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
          </div>

          {/* Outlet Selector (Interactive for OWNER or canSwitchOutlet, locked for branch-restricted) */}
          <div className="relative flex-1 sm:flex-none min-w-[160px] sm:min-w-[210px]">
            {isOwner || canSwitchOutlet ? (
              <>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Store className="w-4 h-4 text-blue-900" />
                </div>
                <select
                  value={outletId}
                  disabled={loadingOutlets}
                  onChange={(e) => onOutletChange(e.target.value)}
                  className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 appearance-none hover:bg-slate-100/70 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-colors cursor-pointer disabled:opacity-60"
                >
                  <option value="ALL">Semua Outlet (Konsolidasi)</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
              </>
            ) : (
              <div
                title="Akses terkunci sesuai tugas outlet"
                className="flex items-center gap-2 px-3 py-2 bg-slate-100/80 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-600 font-medium select-none"
              >
                <Store className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="truncate max-w-[140px] sm:max-w-[180px]">
                  {activeOutletName || currentOutletName}
                </span>
                <span className="inline-flex items-center gap-1 ml-auto text-[10px] uppercase font-semibold text-slate-500 bg-slate-200/80 px-1.5 py-0.5 rounded">
                  <Lock className="w-2.5 h-2.5" />
                  {userRole || 'Staf'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Custom Date Pickers (Rendered inline if preset === 'custom') */}
        {preset === 'custom' && (
          <form
            onSubmit={handleApplyCustom}
            className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100"
          >
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={localStart}
                onChange={(e) => setLocalStart(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                required
              />
              <span className="text-slate-400 text-xs">s/d</span>
              <input
                type="date"
                value={localEnd}
                onChange={(e) => setLocalEnd(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                required
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-sm"
            >
              Terapkan
            </button>
          </form>
        )}
      </div>

      {/* Date Validation Error Feedback */}
      {dateError && (
        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-200/80 rounded-xl px-3 py-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{dateError}</span>
        </div>
      )}
    </div>
  );
};
