// Well POS - OperationalAnalyticsTab Component
// Sub-Tab Analitik Operasional Produksi Laundry (11 Stase Kanonikal, Bottleneck, SLA, Insiden Mutu, Transfer Workshop)

import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  Clock,
  RotateCcw,
  AlertCircle,
  Truck,
  CheckCircle,
  Flame,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import type { OperationsAnalyticsResult, DrilldownType, CanonicalStage, CanonicalIncidentType } from '../../../../types/laundryAnalytics';
import { fetchLaundryOperations } from '../../../../services/laundryAnalyticsApi';
import { formatRupiah } from '../../../../utils/currency';

interface OperationalAnalyticsTabProps {
  preset: string;
  startDate?: string;
  endDate?: string;
  outletId: string;
  userRole?: string;
  onOpenDrilldown: (type: DrilldownType, context?: any) => void;
}

const STAGE_LABELS: Record<CanonicalStage | string, string> = {
  DROP_OFF: '1. Terima Cucian',
  SORTING: '2. Pemilahan',
  WASHING: '3. Pencucian',
  DRYING: '4. Pengeringan',
  IRONING: '5. Setrika / Uap',
  QUALITY_CHECK: '6. Cek Mutu (QC)',
  PACKING: '7. Pengemasan',
  RACKED: '8. Masuk Rak Simpan',
  READY_FOR_DELIVERY: '9. Siap Kirim',
  OUT_FOR_DELIVERY: '10. Kurir Jalan',
  HANDOVER: '11. Selesai / Serah',
};

const INCIDENT_LABELS: Record<CanonicalIncidentType | string, string> = {
  DAMAGED: 'Pakaian Rusak / Luntur',
  LOST: 'Pakaian Hilang',
  STAIN_REMAINING: 'Noda Masih Tersisa',
  MIXED_UP: 'Pakaian Tertukar',
};

export const OperationalAnalyticsTab: React.FC<OperationalAnalyticsTabProps> = ({
  preset,
  startDate,
  endDate,
  outletId,
  userRole,
  onOpenDrilldown,
}) => {
  const [data, setData] = useState<OperationsAnalyticsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSupervisor = userRole === 'SUPERVISOR';
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadData = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;

    setLoading(true);
    setError(null);

    fetchLaundryOperations(
      {
        preset,
        startDate,
        endDate,
        outletId,
      },
      ac.signal
    )
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Gagal memuat analitik operasional');
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
  }, [preset, startDate, endDate, outletId]);

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
        <h4 className="font-bold text-rose-900 text-base">Gagal Memuat Laporan Operasional</h4>
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

  const { summary, stagePipeline = [], incidents, workshopTransfer } = data;

  return (
    <div className="space-y-6">
      {/* 1. Baris Kartu Metrik SLA & Mutu Produksi */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: On-Time Completion Rate */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Ketepatan SLA
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                <CheckCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
              {summary?.onTimeCompletionRate ?? 0}%
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {summary?.onTimeOrdersCount ?? 0} dari {summary?.dueOrdersCount ?? 0} nota tepat waktu
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-400">
            Target operasional: &gt;= 95%
          </div>
        </div>

        {/* Card 2: Overdue Orders (Nota Terlambat) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-800">
                Pesanan Terlambat
              </span>
              <div className="p-2 rounded-xl bg-rose-50 text-rose-700">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 tabular-nums">
              {summary?.overdueOrdersCount ?? 0}
              <span className="text-sm font-semibold text-slate-500 ml-1">Nota</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Rata-rata selesai: {summary?.averageTurnaroundHours ?? 0} jam
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-right">
            <button
              type="button"
              onClick={() => onOpenDrilldown('OVERDUE_ORDERS')}
              className="text-xs font-bold text-rose-700 hover:underline inline-flex items-center gap-1"
            >
              Lihat Nota Terlambat <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 3: Tingkat Insiden Mutu */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Insiden Mutu
              </span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
              {incidents?.totalIncidents ?? 0}
              <span className="text-sm font-semibold text-slate-500 ml-1">Kasus</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Rasio insiden: {incidents?.incidentRate ?? 0}% dari order valid
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
            {!isSupervisor && incidents?.totalApprovedCompensation !== undefined ? (
              <span>Kompensasi: {formatRupiah(incidents.totalApprovedCompensation)}</span>
            ) : (
              <span>Rewash: {summary?.rewashCount ?? 0} ({summary?.rewashRate ?? 0}%)</span>
            )}
          </div>
        </div>

        {/* Card 4: Transfer Lag Workshop */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Logistik Workshop
              </span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-900">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
              {workshopTransfer?.inTransitCount ?? 0}
              <span className="text-sm font-semibold text-slate-500 ml-1">Dalam Kirim</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Rata-rata jeda transfer: {workshopTransfer?.avgTransferLagHours ?? 0} jam
            </p>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-400">
            Total manifest: {workshopTransfer?.totalManifests ?? 0}
          </div>
        </div>
      </div>

      {/* 2. Visualisasi Pipeline 11 Tahapan Produksi Kanonikal */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-900" />
              Pipa Produksi (11 Tahapan Kanonikal) & Deteksi Titik Hambat
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Klik pada stasiun mana pun untuk memeriksa daftar nota cucian yang sedang berada di stase tersebut.
            </p>
          </div>
        </div>

        {/* Pipeline Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {stagePipeline.map((stg) => {
            const isBottle = stg.isBottleneck;
            const stageName = STAGE_LABELS[stg.stage] || stg.stage;

            return (
              <button
                key={stg.stage}
                type="button"
                onClick={() => onOpenDrilldown('ORDERS_BY_STAGE', { stage: stg.stage })}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                  isBottle
                    ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-500/20 shadow-xs'
                    : 'bg-slate-50/70 border-slate-200/80 hover:bg-white hover:border-blue-900/30 shadow-2xs'
                }`}
              >
                {/* Bottleneck Badge */}
                {isBottle && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                    <Flame className="w-3 h-3 text-rose-600 animate-pulse" />
                    Bottleneck
                  </div>
                )}

                <span className="font-bold text-xs text-slate-800 block truncate pr-16 mb-2">
                  {stageName}
                </span>

                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-xl font-extrabold text-slate-900 tabular-nums">
                    {stg.activeOrderCount}{' '}
                    <span className="text-xs font-normal text-slate-500">Nota</span>
                  </span>
                  <span className="text-xs font-semibold text-slate-600 tabular-nums">
                    {stg.activeWeightKg} Kg
                  </span>
                </div>

                <div className="text-[11px] text-slate-500 flex justify-between items-center pt-2 border-t border-slate-200/50">
                  <span>Rata-rata: {stg.avgDurationMinutes} mnt</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Baris Audit Insiden Mutu 4 Kategori */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-sm">
        <h4 className="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          Audit Klaim & Insiden Mutu Laundry (4 Kategori)
        </h4>

        {!incidents?.byType || incidents.byType.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            Nol insiden mutu dilaporkan pada periode ini. Kualitas cucian terjaga sempurna!
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {incidents.byType.map((inc) => (
              <div
                key={inc.incidentType}
                className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl"
              >
                <span className="font-bold text-slate-800 block mb-1">
                  {INCIDENT_LABELS[inc.incidentType] || inc.incidentType}
                </span>
                <div className="text-lg font-extrabold text-slate-900 tabular-nums">
                  {inc.count} Kasus
                </div>
                {!isSupervisor && (
                  <div className="text-[11px] text-rose-600 font-semibold mt-1 tabular-nums">
                    Kompensasi: {formatRupiah(inc.totalCompensation)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
