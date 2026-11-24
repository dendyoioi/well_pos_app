// Well POS - ExecutiveOverviewLevel1 Component
// Level 1 Overview Eksekutif: Hero Health Score, Alert Center Dinamis, dan 3 Kartu Metrik Utama

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  Info,
  DollarSign,
  Wallet,
  Scale,
  Clock,
  CheckCircle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import type { ExecutiveOverviewResult, AlertItem } from '../../../types/laundryAnalytics';
import { OutletHealthScoreCard } from './OutletHealthScoreCard';
import { formatRupiah } from '../../../utils/currency';

interface ExecutiveOverviewLevel1Props {
  data?: ExecutiveOverviewResult | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  userRole?: string;
  onNavigateSubTab?: (targetSubTab: string) => void;
  onOpenDrilldown?: (type: string) => void;
}

export const ExecutiveOverviewLevel1: React.FC<ExecutiveOverviewLevel1Props> = ({
  data,
  loading = false,
  error = null,
  onRetry,
  userRole,
  onNavigateSubTab,
  onOpenDrilldown,
}) => {
  const isSupervisor = userRole === 'SUPERVISOR';

  // 1. Loading Skeleton
  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Hero Card Skeleton */}
        <div className="h-44 sm:h-48 rounded-3xl bg-slate-200/80 w-full" />

        {/* 3 Metrics Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-36 rounded-2xl bg-slate-200/80" />
          <div className="h-36 rounded-2xl bg-slate-200/80" />
          <div className="h-36 rounded-2xl bg-slate-200/80" />
        </div>

        {/* Alerts Skeleton */}
        <div className="h-28 rounded-2xl bg-slate-200/80" />
      </div>
    );
  }

  // 2. Error State
  if (error && !data) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 text-center my-6">
        <AlertCircle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
        <h3 className="text-base font-bold text-rose-900">Gagal Memuat Data Analitik</h3>
        <p className="text-xs sm:text-sm text-rose-700 mt-1 max-w-md mx-auto">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors shadow-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Coba Lagi
          </button>
        )}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { healthScore, financialPulse, operationalPulse, alerts } = data;

  const renderTrendBadge = (percentChange: number, direction: 'UP' | 'DOWN' | 'NEUTRAL') => {
    if (direction === 'NEUTRAL' || percentChange === 0) {
      return (
        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
          0%
        </span>
      );
    }
    const isUp = direction === 'UP';
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
          isUp
            ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/80'
            : 'text-rose-700 bg-rose-50 border border-rose-200/80'
        }`}
      >
        {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {percentChange > 0 ? `+${percentChange}%` : `${percentChange}%`}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Hero Health Score Card */}
      <OutletHealthScoreCard
        healthScore={healthScore}
        userRole={userRole}
        periodLabel={data.meta.preset}
      />

      {/* 2. Top Active Alerts Center Banner */}
      {alerts && alerts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Pusat Perhatian & Peringatan Aktif ({alerts.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alerts.slice(0, 4).map((alert: AlertItem, idx: number) => {
              const isCrit = alert.severity === 'CRITICAL';
              const isWarn = alert.severity === 'WARNING';
              return (
                <div
                  key={`${alert.ruleKey}-${idx}`}
                  className={`flex items-start justify-between gap-3 p-3.5 sm:p-4 rounded-2xl border transition-all ${
                    isCrit
                      ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                      : isWarn
                      ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                      : 'bg-blue-50/70 border-blue-200 text-blue-900'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    {isCrit ? (
                      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    ) : isWarn ? (
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    ) : (
                      <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold truncate">{alert.title}</h4>
                      <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                        {alert.message}
                      </p>
                    </div>
                  </div>

                  {alert.actionLabel && onNavigateSubTab && (
                    <button
                      type="button"
                      onClick={() => onNavigateSubTab(alert.actionTarget)}
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-white border border-slate-200/80 shadow-2xs hover:bg-slate-50 transition-colors"
                    >
                      <span>{alert.actionLabel}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. 3 Core Metric Cards (Role-Aware) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* OWNER & ADMIN VIEW: FINANCIAL PULSE CARDS */}
        {!isSupervisor && financialPulse ? (
          <>
            {/* Card 1: Omzet Bersih Akrual */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Omzet Bersih Akrual
                  </span>
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-900">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>

                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                  {formatRupiah(financialPulse.netRevenue.current)}
                </div>

                <div className="flex items-center gap-2 mt-2">
                  {renderTrendBadge(
                    financialPulse.netRevenue.percentChange,
                    financialPulse.netRevenue.direction
                  )}
                  <span className="text-xs text-slate-400">vs periode lalu</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  AOV:{' '}
                  <strong className="text-slate-800 tabular-nums">
                    {formatRupiah(operationalPulse.averageOrderValue || 0)}
                  </strong>
                </span>
                {onOpenDrilldown && (
                  <button
                    type="button"
                    onClick={() => onOpenDrilldown('ORDERS_BY_DATE')}
                    className="text-blue-900 font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    Rincian <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Card 2: Kas Masuk Riil */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Kas Masuk Riil
                  </span>
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                    <Wallet className="w-4 h-4" />
                  </div>
                </div>

                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                  {formatRupiah(financialPulse.realCashIn.current)}
                </div>

                <div className="flex items-center gap-2 mt-2">
                  {renderTrendBadge(
                    financialPulse.realCashIn.percentChange,
                    financialPulse.realCashIn.direction
                  )}
                  <span className="text-xs text-slate-400">vs periode lalu</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Bebas double counting</span>
                {onOpenDrilldown && (
                  <button
                    type="button"
                    onClick={() => onOpenDrilldown('UNPAID_DEBTS')}
                    className="text-emerald-700 font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    Buku Piutang <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Card 3: Tonase & Volume Cucian */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Tonase & Volume
                  </span>
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-900">
                    <Scale className="w-4 h-4" />
                  </div>
                </div>

                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
                  {operationalPulse.totalWeightKg.toLocaleString('id-ID')}
                  <span className="text-base sm:text-lg font-semibold text-slate-500 ml-1">
                    Kg
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-2 text-xs text-slate-600 font-medium">
                  <span className="bg-slate-100 px-2 py-0.5 rounded-full tabular-nums">
                    {operationalPulse.totalPieces.toLocaleString('id-ID')} Pcs
                  </span>
                  <span>dari {operationalPulse.totalValidOrders} pesanan</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Pipeline produksi</span>
                {onOpenDrilldown && (
                  <button
                    type="button"
                    onClick={() => onOpenDrilldown('ORDERS_BY_STAGE')}
                    className="text-blue-900 font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    Stase Kerja <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          /* SUPERVISOR VIEW: PURE OPERATIONAL CARDS (ZERO FINANCIAL DISCLOSURE) */
          <>
            {/* Card 1: Antrean Aktif Workshop */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Antrean Aktif Produksi
                  </span>
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-900">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>

                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                  {operationalPulse.activeQueueCount}
                  <span className="text-base sm:text-lg font-semibold text-slate-500 ml-1">
                    Nota
                  </span>
                </div>

                <p className="text-xs text-slate-500 mt-2">
                  {operationalPulse.totalWeightKg.toLocaleString('id-ID')} Kg beban cucian
                  sedang diproses
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-right text-xs">
                {onOpenDrilldown && (
                  <button
                    type="button"
                    onClick={() => onOpenDrilldown('ORDERS_BY_STAGE')}
                    className="text-blue-900 font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    Periksa Stase <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Card 2: SLA On-Time Rate */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Tingkat Tepat Waktu SLA
                  </span>
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                </div>

                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                  {operationalPulse.onTimeCompletionRate}%
                </div>

                <p className="text-xs text-slate-500 mt-2">
                  Target operasional: <strong>&gt;= 95%</strong> tepat waktu
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
                Keandalan janji serah cucian
              </div>
            </div>

            {/* Card 3: Pesanan Terlambat & Insiden */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Pesanan Terlambat (Overdue)
                  </span>
                  <div className="p-2 rounded-xl bg-rose-50 text-rose-700">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                </div>

                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
                  {operationalPulse.overdueOrdersCount}
                  <span className="text-base sm:text-lg font-semibold text-slate-500 ml-1">
                    Nota
                  </span>
                </div>

                <p className="text-xs text-slate-500 mt-2">
                  Total insiden mutu: {operationalPulse.incidentCount} laporan
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-right text-xs">
                {onOpenDrilldown && (
                  <button
                    type="button"
                    onClick={() => onOpenDrilldown('OVERDUE_ORDERS')}
                    className="text-rose-700 font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    Buka Nota Terlambat <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
