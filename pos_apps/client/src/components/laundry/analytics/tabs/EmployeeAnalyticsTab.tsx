// Well POS - EmployeeAnalyticsTab Component
// Sub-Tab Analitik Karyawan Laundry (Leaderboard 4 Pilar, Evaluasi Kehadiran, dan Kinerja per Shift)

import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Award,
  Clock,
  RotateCcw,
  AlertCircle,
  Calendar,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import type { EmployeesAnalyticsResult } from '../../../../types/laundryAnalytics';
import { fetchLaundryEmployees } from '../../../../services/laundryAnalyticsApi';

interface EmployeeAnalyticsTabProps {
  preset: string;
  startDate?: string;
  endDate?: string;
  outletId: string;
  userRole?: string;
  onNavigateTab?: (tabKey: string) => void;
}

export const EmployeeAnalyticsTab: React.FC<EmployeeAnalyticsTabProps> = ({
  preset,
  startDate,
  endDate,
  outletId,
  userRole: _userRole,
  onNavigateTab,
}) => {
  const [data, setData] = useState<EmployeesAnalyticsResult | null>(null);
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

    fetchLaundryEmployees(
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
        setError(err.message || 'Gagal memuat analitik karyawan');
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
        <h4 className="font-bold text-rose-900 text-base">Gagal Memuat Kinerja Karyawan</h4>
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

  const { summary, leaderboard = [], gradeDistribution, byShift = [] } = data;

  const getGradeBadge = (grade: string | null) => {
    switch (grade) {
      case 'A':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold';
      case 'B':
        return 'bg-blue-100 text-blue-800 border-blue-300 font-bold';
      case 'C':
        return 'bg-amber-100 text-amber-800 border-amber-300 font-bold';
      case 'D':
        return 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Baris Kartu Metrik Staf & Kedisiplinan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Staff Count */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Staf Bertugas
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-900">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
            {summary?.activeStaffCount ?? 0}
            <span className="text-sm font-normal text-slate-500 ml-1">Karyawan</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Memiliki aktivitas kerja dalam periode
          </p>
        </div>

        {/* Card 2: Tingkat Kehadiran Shift */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Kehadiran Shift
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
            {summary?.attendanceRate ?? 0}%
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {summary?.attendedShiftsCount ?? 0} dari {summary?.scheduledShiftsCount ?? 0} jadwal
          </p>
        </div>

        {/* Card 3: Total Keterlambatan */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
              Keterlambatan
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-700 tabular-nums">
            {summary?.totalLateMinutes ?? 0}
            <span className="text-sm font-semibold text-slate-500 ml-1">Menit</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Total {summary?.totalLateCount ?? 0} kejadian telat
          </p>
        </div>

        {/* Card 4: Distribusi Evaluasi Grade */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
              Distribusi Grade Karyawan
            </span>
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800">
                A: {gradeDistribution?.A ?? 0}
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800">
                B: {gradeDistribution?.B ?? 0}
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800">
                C: {gradeDistribution?.C ?? 0}
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800">
                D: {gradeDistribution?.D ?? 0}
              </span>
            </div>
          </div>
          {onNavigateTab && (
            <div className="mt-3 pt-2 border-t border-slate-100 text-right">
              <button
                type="button"
                onClick={() => onNavigateTab('staff_performance')}
                className="text-xs font-bold text-blue-900 hover:underline inline-flex items-center gap-0.5"
              >
                Evaluasi Staf <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Tabel Leaderboard Staf 4 Pilar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/70">
          <div>
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Award className="w-4 h-4 text-blue-900" />
              Leaderboard Kinerja Staf (Produktivitas, Throughput, Disiplin, & Mutu)
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Skor komposit dihitung dari volume cucian, kecepatan pengerjaan stase, minim insiden, dan ketepatan waktu hadir.
            </p>
          </div>
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('staff_shifts')}
              className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold shadow-2xs self-start sm:self-auto transition-colors"
            >
              Atur Jadwal Shift
            </button>
          )}
        </div>

        {leaderboard.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">
            Belum ada aktivitas penanganan pakaian oleh staf pada periode ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Nama Staf</th>
                  <th className="py-3 px-4">Peran</th>
                  <th className="py-3 px-4">Volume Cucian</th>
                  <th className="py-3 px-4">Tahapan Selesai</th>
                  <th className="py-3 px-4">Terlambat</th>
                  <th className="py-3 px-4">Insiden</th>
                  <th className="py-3 px-4 text-center">Skor & Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {leaderboard.map((staf, idx) => (
                  <tr key={staf.userId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <span className="text-slate-400 mr-2 font-normal">#{idx + 1}</span>
                      {staf.name}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                        {staf.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      <strong>{staf.ordersHandled} Nota</strong>
                      <span className="text-slate-400 block text-[11px]">
                        {staf.weightProcessedKg} Kg
                      </span>
                    </td>
                    <td className="py-3 px-4 tabular-nums text-slate-600">
                      {staf.stagesCompleted} stase ({staf.kgPerHour} kg/jam)
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {staf.lateMinutes > 0 ? (
                        <span className="text-amber-700 font-bold">{staf.lateMinutes} mnt ({staf.lateCount}x)</span>
                      ) : (
                        <span className="text-emerald-700 font-medium">Tepat Waktu</span>
                      )}
                    </td>
                    <td className="py-3 px-4 tabular-nums">
                      {staf.incidentCount > 0 ? (
                        <span className="text-rose-600 font-bold">{staf.incidentCount} Kasus</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-xl text-xs border ${getGradeBadge(
                          staf.latestGrade
                        )}`}
                      >
                        {staf.latestOverallScore ?? '-'} {staf.latestGrade ? `(Grade ${staf.latestGrade})` : ''}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Ringkasan Kinerja per Shift */}
      {byShift.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
          <h4 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-900" />
            Distribusi Pengerjaan per Shift
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {byShift.map((shf, idx) => (
              <div
                key={shf.shiftTemplateId || idx}
                className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-slate-900">{shf.shiftName}</span>
                  <span className="text-slate-400 text-[11px]">
                    {shf.startTime || '00:00'} - {shf.endTime || '00:00'}
                  </span>
                </div>
                <div className="text-slate-600 mt-2 space-y-0.5">
                  <div className="flex justify-between">
                    <span>Kehadiran:</span>
                    <strong>{shf.attendedCount} / {shf.scheduledCount} jadwal</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Terlambat:</span>
                    <strong className="text-amber-700">{shf.lateCount} shift</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
