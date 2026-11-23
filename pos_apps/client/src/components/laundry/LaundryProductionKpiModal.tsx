import React, { useState, useEffect } from 'react';
import {
  Award,
  Waves,
  Flame,
  Package,
  Printer,
  TrendingUp,
} from 'lucide-react';
import type { LaundryOperatorKpi } from '../../types/laundry';
import { api } from '../../services/api';

interface LaundryProductionKpiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LaundryProductionKpiModal: React.FC<LaundryProductionKpiModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [kpis, setKpis] = useState<LaundryOperatorKpi[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'LAST_7' | 'THIS_MONTH'>('THIS_MONTH');

  const fetchKpiData = async () => {
    try {
      setLoading(true);
      const now = new Date();
      let startDate: string | undefined;

      if (dateFilter === 'TODAY') {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        startDate = todayStart.toISOString();
      } else if (dateFilter === 'LAST_7') {
        const last7 = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
        startDate = last7.toISOString();
      } else if (dateFilter === 'THIS_MONTH') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate = monthStart.toISOString();
      }

      const res = await api.getLaundryProductionKpi({ startDate });
      if (res.status === 'success' && Array.isArray(res.data)) {
        setKpis(res.data);
      }
    } catch {
      // Abaikan
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchKpiData();
    }
  }, [isOpen, dateFilter]);

  if (!isOpen) return null;

  const totalKgIronedAll = kpis.reduce((acc, curr) => acc + (curr.totalIroningKg || 0), 0);
  const totalKgWashedAll = kpis.reduce((acc, curr) => acc + (curr.totalWashingKg || 0), 0);
  const totalPackedAll = kpis.reduce((acc, curr) => acc + (curr.totalPackingOrders || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn">
      <div className="w-full sm:max-w-4xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[94dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Penilaian Kinerja Produksi &amp; Komisi Staf</h3>
              <p className="text-xs text-slate-500">
                Akumulasi output riil operator per tahapan (Cuci, Kering, Setrika, Packing)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter Rentang Tanggal */}
            <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setDateFilter('TODAY')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  dateFilter === 'TODAY' ? 'bg-blue-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('LAST_7')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  dateFilter === 'LAST_7' ? 'bg-blue-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                7 Hari Terakhir
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('THIS_MONTH')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  dateFilter === 'THIS_MONTH' ? 'bg-blue-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bulan Ini
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Konten Scrollable */}
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-6">
          {/* Kartu Ringkasan Metrik Output */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center shrink-0">
                <Waves className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase text-blue-700 tracking-wider">Total Output Cuci</div>
                <div className="text-lg font-black text-blue-950">{totalKgWashedAll.toFixed(1)} Kg</div>
              </div>
            </div>

            <div className="p-3.5 bg-orange-50/70 border border-orange-200/80 rounded-2xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center shrink-0">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase text-orange-700 tracking-wider">Total Output Setrika</div>
                <div className="text-lg font-black text-orange-950">{totalKgIronedAll.toFixed(1)} Kg</div>
              </div>
            </div>

            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">Total Nota Dipacking</div>
                <div className="text-lg font-black text-emerald-950">{totalPackedAll} Nota</div>
              </div>
            </div>
          </div>

          {/* Tabel Leaderboard Output per Operator */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-blue-900" />
                <span>Leaderboard Produktivitas Staf</span>
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {kpis.length} Staf Terdata
              </span>
            </div>

            {loading ? (
              <div className="p-10 text-center text-xs text-slate-400">Menghitung metrik performa staf...</div>
            ) : kpis.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400">
                Belum ada aktivitas produksi yang tercatat pada periode ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 text-[10.5px] font-bold text-slate-600 border-b border-slate-100">
                      <th className="py-2.5 px-3">Nama Operator</th>
                      <th className="py-2.5 px-3 text-right">Cuci (Kg)</th>
                      <th className="py-2.5 px-3 text-right">Kering (Kg)</th>
                      <th className="py-2.5 px-3 text-right">Setrika (Kg)</th>
                      <th className="py-2.5 px-3 text-right">Packing (Nota)</th>
                      <th className="py-2.5 px-3 text-right">Total Pekerjaan</th>
                      <th className="py-2.5 px-3 text-right">Durasi Kerja</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px] text-slate-700">
                    {kpis.map((op, idx) => (
                      <tr key={op.operatorId || idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{op.operatorName}</div>
                          <div className="text-[10px] text-slate-400">ID: {op.operatorId ? op.operatorId.slice(0, 8) : 'Manual'}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium">
                          {op.totalWashingKg > 0 ? `${op.totalWashingKg.toFixed(1)} Kg` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium">
                          {op.totalDryingKg > 0 ? `${op.totalDryingKg.toFixed(1)} Kg` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-orange-700">
                          {op.totalIroningKg > 0 ? `${op.totalIroningKg.toFixed(1)} Kg` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-emerald-700">
                          {op.totalPackingOrders > 0 ? `${op.totalPackingOrders} Nota` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-blue-950">
                          {op.totalJobs} Kali
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-500">
                          {op.totalDurationMinutes > 0 ? `${Math.round(op.totalDurationMinutes)} menit` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer Modal */}
        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-between">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 text-xs font-bold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Cetak Rekap Kinerja</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                if (typeof window !== 'undefined') {
                  const url = new URL(window.location.href);
                  url.searchParams.set('tab', 'laundry_commissions');
                  window.history.pushState({}, '', url.toString());
                  window.dispatchEvent(new Event('popstate'));
                }
              }}
              className="px-4 py-2 text-xs font-bold bg-blue-900 hover:bg-blue-800 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Buka Rekap Komisi Lengkap</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
