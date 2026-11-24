// Well POS - OutletHealthScoreCard Component
// Kartu Hero Health Score Eksekutif (Skor 0-100, Badge Grade, dan Progress 4 Pilar)

import React, { useState } from 'react';
import { Activity, Info, ShieldCheck, CheckCircle2, AlertTriangle, XCircle, HelpCircle, X } from 'lucide-react';
import type { HealthScoreResult } from '../../../types/laundryAnalytics';

interface OutletHealthScoreCardProps {
  healthScore?: HealthScoreResult;
  userRole?: string;
  outletName?: string;
  periodLabel?: string;
}

export const OutletHealthScoreCard: React.FC<OutletHealthScoreCardProps> = ({
  healthScore,
  userRole,
  outletName = 'Outlet Aktif',
  periodLabel,
}) => {
  const [showFormulaModal, setShowFormulaModal] = useState(false);
  const isSupervisor = userRole === 'SUPERVISOR';

  if (!healthScore) {
    return null;
  }

  const { score, grade, availability, pillars } = healthScore;

  // Grade color badges
  const getGradeBadge = () => {
    switch (grade) {
      case 'SANGAT_SEHAT':
        return {
          label: 'Sangat Sehat',
          className: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
        };
      case 'SEHAT':
        return {
          label: 'Sehat',
          className: 'bg-blue-500/20 text-blue-300 border-blue-400/50',
          icon: <ShieldCheck className="w-4 h-4 text-blue-400" />,
        };
      case 'WASPADA':
        return {
          label: 'Waspada',
          className: 'bg-amber-500/20 text-amber-300 border-amber-400/50',
          icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
        };
      case 'KRITIS':
        return {
          label: 'Kritis',
          className: 'bg-rose-500/20 text-rose-300 border-rose-400/50',
          icon: <XCircle className="w-4 h-4 text-rose-400" />,
        };
      default:
        return {
          label: 'Belum Ada Data',
          className: 'bg-slate-500/20 text-slate-300 border-slate-400/50',
          icon: <Info className="w-4 h-4 text-slate-400" />,
        };
    }
  };

  const badgeInfo = getGradeBadge();

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-950 text-white p-5 sm:p-7 shadow-lg mb-6 border border-blue-800/60">
        {/* Subtle Decorative Background Glow */}
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Overall Health Score */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-6">
            <div className="relative flex items-center justify-center shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 shadow-inner">
              <div className="text-center">
                <span className="text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums text-white">
                  {score}
                </span>
                <span className="block text-[11px] font-medium text-blue-200/80 -mt-0.5">
                  / 100
                </span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-sm shadow-sm tracking-wide ${badgeInfo.className}`}>
                  {badgeInfo.icon}
                  {badgeInfo.label}
                </span>
                <button
                  type="button"
                  onClick={() => setShowFormulaModal(true)}
                  className="p-1 rounded-full text-blue-300 hover:text-white hover:bg-white/10 transition-colors"
                  title="Lihat formula penilaian Health Score"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </div>

              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                Skor Kesehatan Bisnis & Operasional
              </h2>
              <p className="text-xs sm:text-sm text-blue-200/80 mt-0.5">
                {outletName} • {periodLabel || 'Periode Terpilih'}
              </p>

              {availability === 'EMPTY' && (
                <p className="mt-2 text-xs text-amber-200/90 bg-amber-500/15 border border-amber-400/30 rounded-lg px-2.5 py-1">
                  Belum ada transaksi operasional valid pada periode ini.
                </p>
              )}
            </div>
          </div>

          {/* Right: Pillars Breakdown */}
          <div className="flex-1 max-w-xl w-full grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 lg:pt-0 border-t lg:border-t-0 border-white/10">
            {/* Pilar 1: Margin Laba (Disembunyikan jika role SUPERVISOR) */}
            {!isSupervisor && pillars.profitMarginScore !== undefined && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur-sm">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="text-blue-200 font-medium">Margin Laba (30%)</span>
                  <span className="font-bold text-white tabular-nums">
                    {pillars.profitMarginScore} / 100
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-400 h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(0, pillars.profitMarginScore))}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Pilar 2: SLA Tepat Waktu */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur-sm">
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-blue-200 font-medium">SLA Tepat Waktu (30%)</span>
                <span className="font-bold text-white tabular-nums">
                  {pillars.slaOnTimeScore} / 100
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-400 h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.max(0, pillars.slaOnTimeScore))}%`,
                  }}
                />
              </div>
            </div>

            {/* Pilar 3: Retensi Pelanggan */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur-sm">
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-blue-200 font-medium">Retensi Pelanggan (20%)</span>
                <span className="font-bold text-white tabular-nums">
                  {pillars.retentionScore} / 100
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-indigo-400 h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.max(0, pillars.retentionScore))}%`,
                  }}
                />
              </div>
            </div>

            {/* Pilar 4: Kepuasan / Rating / Bebas Insiden */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 backdrop-blur-sm">
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-blue-200 font-medium">Kepuasan & Mutu (20%)</span>
                <span className="font-bold text-white tabular-nums">
                  {pillars.satisfactionScore} / 100
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-amber-400 h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.max(0, pillars.satisfactionScore))}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Modal Penjelasan Rumus Health Score */}
      {showFormulaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-900" />
                <h3 className="font-bold text-base text-slate-900">
                  Formula Evaluasi Health Score
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFormulaModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 text-xs sm:text-sm text-slate-600 space-y-3">
              <p>
                <strong>Health Score (Skor 0-100)</strong> adalah metrik komposit holistik
                Well POS untuk mengukur kesehatan finansial dan keandalan operasional outlet
                laundry secara objektif.
              </p>

              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 space-y-2">
                <div className="flex justify-between font-semibold text-slate-800">
                  <span>1. Margin Laba Operasional (30%)</span>
                  <span>Maks 30 Poin</span>
                </div>
                <p className="text-slate-500 text-xs">
                  Mengukur rasio laba operasi terhadap omzet bersih. Margin &gt;40% meraih poin penuh.
                  <em>(Khusus Owner & Admin)</em>.
                </p>

                <div className="flex justify-between font-semibold text-slate-800 pt-1 border-t border-slate-200/60">
                  <span>2. Ketepatan Waktu SLA (30%)</span>
                  <span>Maks 30 Poin</span>
                </div>
                <p className="text-slate-500 text-xs">
                  Persentase cucian yang selesai sebelum atau tepat waktu janji SLA.
                </p>

                <div className="flex justify-between font-semibold text-slate-800 pt-1 border-t border-slate-200/60">
                  <span>3. Retensi Pelanggan (20%)</span>
                  <span>Maks 20 Poin</span>
                </div>
                <p className="text-slate-500 text-xs">
                  Tingkat repeat customer dan pelanggan aktif yang rutin mencuci kembali.
                </p>

                <div className="flex justify-between font-semibold text-slate-800 pt-1 border-t border-slate-200/60">
                  <span>4. Kepuasan & Mutu Bebas Insiden (20%)</span>
                  <span>Maks 20 Poin</span>
                </div>
                <p className="text-slate-500 text-xs">
                  Berdasarkan rating pelanggan dan minimnya klaim kompensasi kerusakan/luntur.
                </p>
              </div>

              <p className="text-xs text-slate-500">
                Tingkatan Grade: <strong>Sangat Sehat (&gt;=85)</strong>, <strong>Sehat (70-84)</strong>, <strong>Waspada (50-69)</strong>, dan <strong>Kritis (&lt;50)</strong>.
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 text-right">
              <button
                type="button"
                onClick={() => setShowFormulaModal(false)}
                className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
