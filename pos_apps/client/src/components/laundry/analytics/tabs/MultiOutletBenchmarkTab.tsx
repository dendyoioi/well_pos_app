// Well POS - MultiOutletBenchmarkTab Component
// Sub-Tab Benchmark Komparasi Antar-Outlet Laundry (Khusus Role OWNER)
// Dilengkapi Integrasi Target Bisnis Bulanan Real-Time Wave 2

import React, { useState, useEffect, useRef } from 'react';
import {
  Store,
  Trophy,
  RotateCcw,
  AlertCircle,
  Layers,
  Target,
} from 'lucide-react';
import type { BenchmarkAnalyticsResult } from '../../../../types/laundryAnalytics';
import { fetchLaundryBenchmark } from '../../../../services/laundryAnalyticsApi';
import { formatRupiah } from '../../../../utils/currency';
import { OutletTargetModal } from '../modals/OutletTargetModal';

interface MultiOutletBenchmarkTabProps {
  preset: string;
  startDate?: string;
  endDate?: string;
  onSelectOutlet?: (outletId: string) => void;
  onDataMutated?: () => void;
}

export const MultiOutletBenchmarkTab: React.FC<MultiOutletBenchmarkTabProps> = ({
  preset,
  startDate,
  endDate,
  onSelectOutlet,
  onDataMutated,
}) => {
  const [data, setData] = useState<BenchmarkAnalyticsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadData = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;

    setLoading(true);
    setError(null);

    fetchLaundryBenchmark(
      {
        preset,
        startDate,
        endDate,
      },
      ac.signal
    )
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Gagal memuat benchmark komparasi antar-outlet');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [preset, startDate, endDate]);

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-slate-200/80 rounded-2xl" />
          ))}
        </div>
        <div className="h-72 bg-slate-200/80 rounded-2xl" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-3xl">
        <AlertCircle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
        <h4 className="font-bold text-rose-900 text-base">Gagal Memuat Benchmark Outlet</h4>
        <p className="text-xs sm:text-sm text-rose-700 mt-1">{error}</p>
        <button
          type="button"
          onClick={loadData}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-900 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-blue-800 transition-colors shadow-sm"
        >
          <RotateCcw className="w-4 h-4" />
          Muat Ulang
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { consolidatedSummary, workshopSummary, targets, outlets = [] } = data;
  const topPerformer = outlets.length > 0 ? outlets[0] : null;

  return (
    <div className="space-y-6">
      {/* 1. Baris Kartu Metrik Konsolidasi */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Omzet Konsolidasi */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
            Total Omzet Konsolidasi
          </span>
          <div className="text-xl sm:text-2xl font-extrabold text-blue-900 tabular-nums whitespace-nowrap">
            {formatRupiah(consolidatedSummary?.totalNetRevenue ?? 0)}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Dari {consolidatedSummary?.totalOutlets ?? 0} outlet aktif
          </p>
        </div>

        {/* Card 2: Total Beban Tonase */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
            Total Beban Cucian
          </span>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums whitespace-nowrap">
            {consolidatedSummary?.totalWeightKg ?? 0}
            <span className="text-sm font-normal text-slate-500 ml-1">Kg</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {consolidatedSummary?.totalValidOrders ?? 0} pesanan valid
          </p>
        </div>

        {/* Card 3: Rata-rata SLA On-Time */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
            Rata-rata SLA Ketepatan
          </span>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-700 tabular-nums">
            {consolidatedSummary?.avgOnTimeRate ?? 0}%
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Selesai sebelum estimasi siap
          </p>
        </div>

        {/* Card 4: Rata-rata Health Score */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-1">
            Rata-rata Skor Kesehatan
          </span>
          <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums">
            {consolidatedSummary?.avgHealthScore ?? 0}
            <span className="text-sm font-normal text-slate-400 ml-1">/ 100</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Indeks performa multi-cabang
          </p>
        </div>
      </div>

      {/* 2. Target Bulanan Bisnis (Wave 2 Live Data) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-900" />
            <div>
              <h4 className="font-bold text-slate-900 text-sm">
                Target Bulanan Bisnis & Realisasi KPI
              </h4>
              <p className="text-xs text-slate-500">
                Monitoring pencapaian target omzet & volume kiloan per outlet.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsTargetModalOpen(true)}
            className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 self-start sm:self-auto shadow-sm"
          >
            <Target className="w-3.5 h-3.5" />
            Atur Target Bulanan
          </button>
        </div>

        {targets?.availability === 'READY' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="text-xs font-semibold text-slate-600">Realisasi Omzet Konsolidasi</span>
                <span className="text-xs font-bold text-blue-900 tabular-nums">
                  {targets.revenueAchievementPercent}%
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-2">
                <div
                  className="bg-blue-900 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, targets.revenueAchievementPercent)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Realisasi: {formatRupiah(consolidatedSummary?.totalNetRevenue ?? 0)}</span>
                <span>Target: {formatRupiah(targets.totalTargetRevenue)}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl">
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="text-xs font-semibold text-slate-600">Realisasi Tonase Konsolidasi</span>
                <span className="text-xs font-bold text-emerald-700 tabular-nums">
                  {targets.weightAchievementPercent}%
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-2">
                <div
                  className="bg-emerald-600 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, targets.weightAchievementPercent)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Realisasi: {consolidatedSummary?.totalWeightKg ?? 0} Kg</span>
                <span>Target: {targets.totalTargetWeightKg} Kg</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500">
            <span>Belum ada target bulanan yang diset untuk periode ini. Klik tombol di atas untuk menentukan target omzet & tonase outlet.</span>
          </div>
        )}
      </div>

      {/* 3. Tabel Peringkat Outlet */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Store className="w-4 h-4 text-blue-900" />
            Matriks Peringkat Kinerja Outlet
          </h4>
          <span className="text-xs text-slate-500">
            {outlets.length} Toko / Outlet Terdaftar
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Outlet</th>
                <th className="py-3 px-4">Tipe</th>
                <th className="py-3 px-4">Omzet & Target</th>
                <th className="py-3 px-4">Pangsa Omzet</th>
                <th className="py-3 px-4">Beban Cucian</th>
                <th className="py-3 px-4">SLA On-Time</th>
                <th className="py-3 px-4 text-center">Health Score</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {outlets.map((out) => {
                const isTop = topPerformer && out.outletId === topPerformer.outletId;
                return (
                  <tr key={out.outletId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        {isTop && (
                          <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        )}
                        <span>{out.outletName}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono font-normal block">
                        Kode: {out.outletCode}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          out.isWorkshop
                            ? 'bg-blue-100 text-blue-900'
                            : 'bg-indigo-100 text-indigo-900'
                        }`}
                      >
                        {out.isWorkshop ? 'Workshop' : 'Satelit'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 tabular-nums">
                      <div>{formatRupiah(out.netRevenue)}</div>
                      {out.target && out.target.targetRevenue > 0 && (
                        <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                          Target: {formatRupiah(out.target.targetRevenue)} ({out.target.revenueAchievementPercent}%)
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 tabular-nums">
                      <span className="font-semibold text-slate-800">
                        {out.revenueSharePercent}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 tabular-nums">
                      <strong>{out.totalValidOrders} Nota</strong>
                      <span className="text-[11px] text-slate-400 block">
                        {out.totalWeightKg} Kg
                      </span>
                    </td>
                    <td className="py-3.5 px-4 tabular-nums">
                      <span
                        className={`font-bold ${
                          out.onTimeCompletionRate >= 95
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {out.onTimeCompletionRate}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-block px-2.5 py-1 rounded-xl bg-slate-100 text-slate-800 font-bold border border-slate-200">
                        {out.healthScore} ({out.healthGrade})
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {onSelectOutlet && (
                        <button
                          type="button"
                          onClick={() => onSelectOutlet(out.outletId)}
                          className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-blue-900 hover:bg-blue-50 transition-colors shadow-2xs"
                        >
                          Pilih Outlet
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Workshop Transfer Summary */}
      {workshopSummary && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <h4 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-900" />
            Distribusi Fasilitas & Logistik Antar-Workshop
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <span className="text-slate-500 block mb-1">Unit Fasilitas</span>
              <strong className="text-sm font-extrabold text-slate-900">
                {workshopSummary.workshopCount} Workshop • {workshopSummary.satelliteCount} Satelit
              </strong>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <span className="text-slate-500 block mb-1">Transfer Manifest</span>
              <strong className="text-sm font-extrabold text-blue-900">
                {workshopSummary.totalManifests} Manifest ({workshopSummary.totalOrdersTransferred} Nota)
              </strong>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <span className="text-slate-500 block mb-1">Rata-rata Jeda Transfer</span>
              <strong className="text-sm font-extrabold text-emerald-700">
                {workshopSummary.avgTransferLagHours} Jam
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Modal Target Bisnis Outlet Wave 2 */}
      <OutletTargetModal
        isOpen={isTargetModalOpen}
        onClose={() => setIsTargetModalOpen(false)}
        onSuccess={() => {
          loadData();
          onDataMutated?.();
        }}
      />
    </div>
  );
};
