// Well POS - MachineAnalyticsTab Component
// Sub-Tab Analitik Utilisasi & Pemeliharaan Mesin Laundry (Non-IoT Stage Log Estimation, Washer vs Dryer, Maintenance Alert)

import React, { useState, useEffect, useRef } from 'react';
import {
  Cpu,
  RotateCcw,
  AlertCircle,
  Wrench,
  CheckCircle,
  Layers,
  Info,
  ShieldAlert,
} from 'lucide-react';
import type { MachinesAnalyticsResult } from '../../../../types/laundryAnalytics';
import { fetchLaundryMachines } from '../../../../services/laundryAnalyticsApi';

interface MachineAnalyticsTabProps {
  preset: string;
  startDate?: string;
  endDate?: string;
  outletId: string;
}

export const MachineAnalyticsTab: React.FC<MachineAnalyticsTabProps> = ({
  preset,
  startDate,
  endDate,
  outletId,
}) => {
  const [data, setData] = useState<MachinesAnalyticsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadData = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;

    setLoading(true);
    setError(null);

    fetchLaundryMachines(
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
        setError(err.message || 'Gagal memuat analitik mesin');
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
        <div className="h-64 bg-slate-200/80 rounded-2xl" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-3xl">
        <AlertCircle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
        <h4 className="font-bold text-rose-900 text-base">Gagal Memuat Kinerja Mesin</h4>
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

  const { summary, byType = [], machines = [] } = data;
  const maintenanceDueCount = machines.filter((m) => m.maintenanceDue).length;

  return (
    <div className="space-y-6">
      {/* 1. Banner Transparansi Wajib (Non-IoT) */}
      <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-900 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-950">
          <strong className="font-bold block text-sm mb-0.5">
            Estimasi Berbasis Pencatatan Log Tahapan Manual (Non-IoT)
          </strong>
          Sistem memperkirakan siklus dan utilisasi mesin berdasarkan pencatatan stase kerja
          operator cuci/kering. Data downtime log otomatis dan biaya daya per siklus belum
          tersedia (tersedia pada integrasi smart plug IoT Wave 3).
        </div>
      </div>

      {/* 2. Baris Kartu Metrik Ringkasan Mesin */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Unit Mesin */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Total Unit Mesin
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-900">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
            {summary?.totalMachines ?? 0}
            <span className="text-sm font-normal text-slate-500 ml-1">Unit</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {summary?.activeMachines ?? 0} aktif beroperasi
          </p>
        </div>

        {/* Card 2: Total Siklus Operasi */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Siklus Operasi
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
            {summary?.totalCycles ?? 0}
            <span className="text-sm font-normal text-slate-500 ml-1">Siklus</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Akumulasi cuci & kering dalam periode
          </p>
        </div>

        {/* Card 3: Peringatan Jadwal Servis */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
              Perlu Servis
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-700 tabular-nums">
            {maintenanceDueCount}
            <span className="text-sm font-semibold text-slate-500 ml-1">Mesin</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Mencapai batas ambang batas pemeliharaan
          </p>
        </div>

        {/* Card 4: Unit Dalam Perbaikan */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Dalam Perbaikan
            </span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-700">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
            {summary?.maintenanceMachines ?? 0}
            <span className="text-sm font-normal text-slate-500 ml-1">Unit</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Status pemeliharaan aktif
          </p>
        </div>
      </div>

      {/* 3. Breakdown WASHER vs DRYER */}
      {byType.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <h4 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-900" />
            Komparasi Utilisasi: Mesin Cuci (Washer) vs Pengering (Dryer)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {byType.map((t) => (
              <div
                key={t.machineType}
                className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-sm text-slate-900 uppercase">
                    {t.machineType === 'WASHER' ? 'Mesin Cuci (Washer)' : 'Pengering (Dryer)'}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">
                    {t.unitCount} Unit
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-extrabold text-blue-900 tabular-nums">
                    {t.totalCycles} Siklus
                  </span>
                  <span className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-lg tabular-nums">
                    Rata-rata: {t.avgUtilizationPercent}% ({t.totalOperatingHours} jam)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Daftar Unit Mesin & Status Pemeliharaan */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70">
          <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-900" />
            Daftar Aset Mesin & Beban Kerja
          </h4>
        </div>

        {machines.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">
            Belum ada data mesin laundry yang terdaftar di outlet ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Nama Mesin</th>
                  <th className="py-3 px-4">Tipe & Kapasitas</th>
                  <th className="py-3 px-4">Total Siklus</th>
                  <th className="py-3 px-4">Estimasi Jam Kerja</th>
                  <th className="py-3 px-4">Utilisasi</th>
                  <th className="py-3 px-4 text-right">Status Servis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {machines.map((m) => (
                  <tr key={m.machineId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {m.name}
                      <span className="block text-[11px] text-slate-400 font-normal">
                        Kode: {m.code}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                        {m.machineType} ({m.capacityKg} Kg)
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 tabular-nums">
                      {m.cycleCount} Siklus
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-600">
                      {m.operatingHours} Jam
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-blue-900 h-1.5 rounded-full"
                            style={{
                              width: `${Math.min(100, m.utilizationPercent)}%`,
                            }}
                          />
                        </div>
                        <span className="font-semibold text-slate-800">
                          {m.utilizationPercent}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {m.maintenanceDue ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px] border border-rose-300">
                          <Wrench className="w-3 h-3 text-rose-600" />
                          Perlu Servis
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[10px] border border-emerald-200">
                          <CheckCircle className="w-3 h-3" />
                          Prima
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
