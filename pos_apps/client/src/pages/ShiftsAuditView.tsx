import React, { useState, useEffect } from 'react';
import {
  Clock,
  RefreshCw,
  Search,
  User,
  Calendar,
  Eye,
  X,
  Download,
  CheckCircle2,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Store,
} from 'lucide-react';
import { api } from '../services/api';
import type { Outlet } from '../types/outlet';
import { TablePagination } from '../components/TablePagination';
import { computePresetDateRange } from '../utils/date';

export interface ShiftsAuditViewProps {
  activeOutlet?: Outlet | null;
}

export interface ShiftDiscrepancySummary {
  totalShiftsAudited: number;
  matchCount: number;
  overCount: number;
  shortCount: number;
  totalOverAmount: number;
  totalShortAmount: number;
  netDifference: number;
  discrepancyRatePercent: number;
}

export const ShiftsAuditView: React.FC<ShiftsAuditViewProps> = ({ activeOutlet }) => {
  const [shifts, setShifts] = useState<any[]>([]);
  const [summary, setSummary] = useState<ShiftDiscrepancySummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState<any | null>(null);

  // Period Preset Filter
  const [periodPreset, setPeriodPreset] = useState<'today' | '7days' | '30days' | 'thisMonth' | 'custom'>('thisMonth');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // Pagination State (Standar Kanonikal 10/25/50/100)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const fetchShifts = async () => {
    setLoading(true);
    try {
      let startDate = customStart;
      let endDate = customEnd;

      if (periodPreset !== 'custom') {
        const { startStr, endStr } = computePresetDateRange(periodPreset as any);
        startDate = startStr;
        endDate = endStr;
      }

      const outletIdParam = activeOutlet && !activeOutlet.isWarehouse ? activeOutlet.id : undefined;

      // Prioritas 1: Ambil data agregat analitik selisih kas shift
      const res = await api.getShiftDiscrepanciesReport({
        startDate,
        endDate,
        outletId: outletIdParam,
      });

      if (res.status === 'success' && res.data) {
        setSummary(res.data.summary);
        setShifts(res.data.shifts || []);
      } else {
        // Fallback jika mode standar
        const fallbackRes = await api.getShiftHistory(outletIdParam);
        if (fallbackRes.status === 'success') {
          setShifts(fallbackRes.data || []);
        }
      }
    } catch (err) {
      console.error('Error fetching shift audit report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (periodPreset !== 'custom') {
      fetchShifts();
    }
  }, [periodPreset, activeOutlet?.id]);

  const handleViewDetail = async (shiftId: string) => {
    try {
      const res = await api.getShiftById(shiftId);
      if (res.status === 'success') {
        setSelectedShift(res.data);
      }
    } catch (err) {
      console.error('Error fetching shift detail:', err);
    }
  };

  // Ekspor Data Rekapitulasi Shift Kasir ke File CSV (UTF-8 BOM)
  const handleExportCSV = () => {
    if (shifts.length === 0) return;

    const summaryRows = [
      ['LAPORAN AUDIT SHIFT KASIR & REKAPITULASI SELISIH KAS (Z-REPORT)'],
      ['Toko / Outlet', activeOutlet && !activeOutlet.isWarehouse ? activeOutlet.name : 'Seluruh Toko'],
      ['Tanggal Cetak', new Date().toLocaleString('id-ID')],
      [''],
      ['RINGKASAN AUDIT SELISIH KAS'],
      ['Total Shift Diaudit', summary?.totalShiftsAudited ?? shifts.length],
      ['Shift Seimbang / Sesuai (Match)', summary?.matchCount ?? 0],
      ['Shift Selisih Kurang (Shortage)', summary?.shortCount ?? 0],
      ['Total Nominal Selisih Kurang', `Rp ${summary?.totalShortAmount ?? 0}`],
      ['Shift Selisih Lebih (Surplus)', summary?.overCount ?? 0],
      ['Total Nominal Selisih Lebih', `Rp ${summary?.totalOverAmount ?? 0}`],
      ['Net Selisih Kas (Net Variance)', `Rp ${summary?.netDifference ?? 0}`],
      [''],
      ['DAFTAR SESI SHIFT KASIR'],
      ['ID Shift', 'Kasir', 'Toko', 'Waktu Mulai', 'Waktu Selesai', 'Modal Awal', 'Kas Diharapkan', 'Kas Fisik Aktual', 'Selisih Kas', 'Status'],
      ...shifts.map((s) => [
        s.id.slice(0, 8),
        `"${s.cashierName || s.cashier?.name || 'Kasir'}"`,
        `"${s.outletName || s.outlet?.name || '-'}"`,
        new Date(s.startTime).toLocaleString('id-ID'),
        s.endTime ? new Date(s.endTime).toLocaleString('id-ID') : 'Aktif',
        s.startingCash,
        s.expectedEnding ?? s.expectedCash ?? 0,
        s.actualEnding ?? s.actualCash ?? 0,
        s.cashDifference ?? s.difference ?? 0,
        s.status || (s.cashDifference === 0 ? 'MATCH' : (s.cashDifference > 0 ? 'OVER' : 'SHORT')),
      ]),
    ];

    const csvContent = '\uFEFF' + summaryRows.map((e) => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Audit_Shift_Kasir_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredShifts = shifts.filter((s) => {
    const q = search.toLowerCase();
    const cashier = (s.cashierName || s.cashier?.name || '').toLowerCase();
    const outlet = (s.outletName || s.outlet?.name || '').toLowerCase();
    const notes = (s.notes || '').toLowerCase();
    return cashier.includes(q) || outlet.includes(q) || notes.includes(q);
  });

  // Reset pagination ke halaman 1 saat pencarian berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [search, periodPreset, customStart, customEnd, activeOutlet?.id]);

  const totalPages = Math.max(1, Math.ceil(filteredShifts.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedShifts = filteredShifts.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm no-print">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-900 text-white flex items-center justify-center shadow-md shadow-blue-900/20">
            <Clock className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Audit &amp; Rekapitulasi Shift Kasir
              </h2>
              {activeOutlet && !activeOutlet.isWarehouse && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-900 font-bold text-[10px]">
                  <Store className="w-3 h-3" />
                  <span>{activeOutlet.name}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitoring kepatuhan uang fisik laci kasir vs pencatatan sistem (*Z-Report*), deteksi selisih kas (*Over/Short*), dan riwayat sesi kasir.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleExportCSV}
            disabled={shifts.length === 0}
            className="px-4 py-2.5 bg-blue-900 hover:bg-blue-950 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-blue-900/20 transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>Ekspor CSV</span>
          </button>

          <button
            onClick={fetchShifts}
            disabled={loading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-2 transition-all"
            title="Segarkan Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-900' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Controls Toolbar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 no-print">
        {/* Preset Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Periode:
          </span>
          {[
            { key: 'today', label: 'Hari Ini' },
            { key: '7days', label: '7 Hari Terakhir' },
            { key: '30days', label: '30 Hari Terakhir' },
            { key: 'thisMonth', label: 'Bulan Ini' },
            { key: 'custom', label: 'Kustom' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setPeriodPreset(item.key as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                periodPreset === item.key
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Custom Range Inputs if custom selected */}
        {periodPreset === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none"
            />
            <span className="text-xs text-slate-400">s/d</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none"
            />
            <button
              onClick={fetchShifts}
              className="px-3.5 py-1.5 bg-blue-900 text-white rounded-xl text-xs font-bold hover:bg-blue-950 transition-all"
            >
              Terapkan
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards: Shift Discrepancy Overview */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Sesi Diaudit */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Shift Kasir Diaudit
              </span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5 stroke-[2.5]" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                {summary.totalShiftsAudited} Sesi
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                Rekapitulasi tutup kasir (Z-Report)
              </p>
            </div>
          </div>

          {/* Card 2: Shift Seimbang (Match) */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Kas Seimbang (Sesuai)
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-black text-emerald-800 tracking-tight">
                {summary.matchCount} Shift
              </h3>
              <p className="text-[11px] text-emerald-700 mt-1 font-medium">
                {summary.totalShiftsAudited > 0
                  ? ((summary.matchCount / summary.totalShiftsAudited) * 100).toFixed(1)
                  : 100}% akurasi uang laci fisik
              </p>
            </div>
          </div>

          {/* Card 3: Selisih Kurang (Shortage) */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Selisih Kurang (Minus)
              </span>
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-800 flex items-center justify-center font-bold">
                <TrendingDown className="w-5 h-5 stroke-[2.5]" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-black text-rose-700 tracking-tight">
                -Rp {summary.totalShortAmount.toLocaleString('id-ID')}
              </h3>
              <p className="text-[11px] text-rose-600 mt-1 font-medium">
                Terjadi pada {summary.shortCount} sesi shift
              </p>
            </div>
          </div>

          {/* Card 4: Net Variance */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Net Selisih Kasir
              </span>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                summary.netDifference >= 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
              }`}>
                {summary.netDifference >= 0 ? (
                  <TrendingUp className="w-5 h-5 stroke-[2.5]" />
                ) : (
                  <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
                )}
              </div>
            </div>
            <div className="mt-3">
              <h3 className={`text-2xl font-black tracking-tight ${
                summary.netDifference >= 0 ? 'text-emerald-800' : 'text-rose-600'
              }`}>
                {summary.netDifference >= 0 ? '+' : ''}Rp {summary.netDifference.toLocaleString('id-ID')}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                Akumulasi selisih kas fisik
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter Toolbar & Search */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari kasir, outlet, atau catatan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-900 shadow-xs"
          />
        </div>

        <span className="text-xs font-bold text-slate-500">
          Total: <strong className="text-slate-900">{filteredShifts.length}</strong> sesi shift
        </span>
      </div>

      {/* Shifts Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Kasir</th>
                <th className="px-5 py-3.5">Waktu Shift</th>
                <th className="px-5 py-3.5 text-right">Modal Awal</th>
                <th className="px-5 py-3.5 text-right">Uang Fisik</th>
                <th className="px-5 py-3.5 text-right">Selisih Kas</th>
                <th className="px-5 py-3.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-900" />
                    <span>Memuat riwayat shift...</span>
                  </td>
                </tr>
              ) : filteredShifts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    Tidak ada riwayat shift yang sesuai
                  </td>
                </tr>
              ) : (
                paginatedShifts.map((shift) => {
                  const cashierName = shift.cashierName || shift.cashier?.name || 'Kasir';
                  const outletName = shift.outletName || shift.outlet?.name || '-';
                  const startingCash = Number(shift.startingCash || 0);
                  const actualCash = shift.actualEnding != null ? Number(shift.actualEnding) : (shift.actualCash != null ? Number(shift.actualCash) : null);
                  const expectedCash = shift.expectedEnding != null ? Number(shift.expectedEnding) : (shift.expectedCash != null ? Number(shift.expectedCash) : null);
                  const diff = shift.cashDifference != null ? Number(shift.cashDifference) : (shift.difference != null ? Number(shift.difference) : null);
                  const isDiffZero = diff === 0;
                  const isDiffPositive = (diff || 0) > 0;
                  const isClosed = shift.status === 'CLOSED' || shift.status === 'MATCH' || shift.status === 'OVER' || shift.status === 'SHORT';

                  return (
                    <tr key={shift.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Status */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {!isClosed && shift.status === 'OPEN' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>AKTIF (OPEN)</span>
                          </span>
                        ) : isDiffZero ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                            <span>SEIMBANG (Rp 0)</span>
                          </span>
                        ) : isDiffPositive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-bold">
                            <span>LEBIH (OVER)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold">
                            <span>KURANG (SHORT)</span>
                          </span>
                        )}
                      </td>

                      {/* Cashier */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{cashierName}</span>
                        </div>
                        <span className="text-[11px] text-slate-400">{outletName}</span>
                      </td>

                      {/* Waktu */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-medium text-slate-800 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{new Date(shift.startTime).toLocaleDateString('id-ID')}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {new Date(shift.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          {' - '}
                          {shift.endTime
                            ? new Date(shift.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                            : 'Sekarang'}
                        </div>
                      </td>

                      {/* Modal Awal */}
                      <td className="px-5 py-4 text-right whitespace-nowrap font-medium text-slate-700">
                        Rp {startingCash.toLocaleString('id-ID')}
                      </td>

                      {/* Uang Fisik */}
                      <td className="px-5 py-4 text-right whitespace-nowrap font-semibold text-slate-900">
                        {actualCash != null
                          ? `Rp ${actualCash.toLocaleString('id-ID')}`
                          : expectedCash != null
                          ? `Rp ${expectedCash.toLocaleString('id-ID')} (Sistem)`
                          : '-'}
                      </td>

                      {/* Selisih */}
                      <td className="px-5 py-4 text-right whitespace-nowrap font-black">
                        {diff != null ? (
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[11px] ${
                              isDiffZero
                                ? 'bg-emerald-50 text-emerald-700'
                                : isDiffPositive
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {isDiffPositive ? '+' : ''}Rp {diff.toLocaleString('id-ID')}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs font-normal">Berjalan</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleViewDetail(shift.id)}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-900 text-blue-900 hover:text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Detail</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List View */}
        <div className="block md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="p-8 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-900" />
              <span className="text-xs">Memuat riwayat shift...</span>
            </div>
          ) : filteredShifts.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Tidak ada riwayat shift yang sesuai
            </div>
          ) : (
            paginatedShifts.map((shift) => {
              const cashierName = shift.cashierName || shift.cashier?.name || 'Kasir';
              const outletName = shift.outletName || shift.outlet?.name || '-';
              const startingCash = Number(shift.startingCash || 0);
              const actualCash = shift.actualEnding != null ? Number(shift.actualEnding) : (shift.actualCash != null ? Number(shift.actualCash) : null);
              const diff = shift.cashDifference != null ? Number(shift.cashDifference) : (shift.difference != null ? Number(shift.difference) : null);
              const isDiffZero = diff === 0;
              const isDiffPositive = (diff || 0) > 0;
              const isClosed = shift.status === 'CLOSED' || shift.status === 'MATCH' || shift.status === 'OVER' || shift.status === 'SHORT';

              return (
                <div key={shift.id} className="p-4 space-y-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <User className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{cashierName}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 pl-5.5 block">{outletName}</span>
                    </div>

                    {!isClosed && shift.status === 'OPEN' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-black uppercase shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>AKTIF</span>
                      </span>
                    ) : isDiffZero ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase shrink-0">
                        SEIMBANG
                      </span>
                    ) : isDiffPositive ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold uppercase shrink-0">
                        LEBIH
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold uppercase shrink-0">
                        KURANG
                      </span>
                    )}
                  </div>

                  {/* Waktu Shift */}
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5 bg-slate-50 p-2 rounded-xl">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      {new Date(shift.startTime).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} •{' '}
                      {new Date(shift.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} -{' '}
                      {shift.endTime
                        ? new Date(shift.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                        : 'Sekarang'}
                    </span>
                  </div>

                  {/* Financial Metrics Mini Cards */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50/70 p-2.5 rounded-2xl border border-slate-100 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Modal Awal</span>
                      <span className="text-xs font-bold text-slate-700">
                        Rp {startingCash.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Uang Fisik</span>
                      <span className="text-xs font-bold text-slate-900">
                        {actualCash != null ? `Rp ${actualCash.toLocaleString('id-ID')}` : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Selisih</span>
                      {diff != null ? (
                        <span
                          className={`text-xs font-black ${
                            isDiffZero
                              ? 'text-emerald-700'
                              : isDiffPositive
                              ? 'text-blue-700'
                              : 'text-rose-700'
                          }`}
                        >
                          {isDiffPositive ? '+' : ''}Rp {diff.toLocaleString('id-ID')}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-normal">Berjalan</span>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => handleViewDetail(shift.id)}
                    className="w-full py-2.5 bg-blue-50 hover:bg-blue-900 text-blue-900 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Lihat Rincian Audit</span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Shift */}
        {!loading && filteredShifts.length > 0 && (
          <TablePagination
            currentPage={safeCurrentPage}
            pageSize={pageSize}
            totalItems={filteredShifts.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            itemLabel="shift"
          />
        )}
      </div>

      {/* Detail Shift Modal */}
      {selectedShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-blue-950 to-blue-900 text-white p-5 flex items-center justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-800 text-[10px] font-bold text-blue-200 uppercase mb-1">
                  Detail Shift #{selectedShift.id.slice(0, 8)}
                </div>
                <h3 className="font-extrabold text-base text-white">
                  Rekap Shift: {selectedShift.cashier?.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedShift(null)}
                className="p-1.5 rounded-xl text-blue-200 hover:text-white hover:bg-blue-800/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Modal Awal</span>
                  <span className="text-xs font-black text-slate-900">
                    Rp {selectedShift.startingCash?.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Penjualan Tunai</span>
                  <span className="text-xs font-black text-emerald-700">
                    Rp {selectedShift.stats?.cashSales?.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Penjualan QRIS</span>
                  <span className="text-xs font-black text-blue-700">
                    Rp {selectedShift.stats?.qrisSales?.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Selisih Kas</span>
                  <span className="text-xs font-black text-slate-900">
                    {selectedShift.difference !== null
                      ? `Rp ${selectedShift.difference.toLocaleString('id-ID')}`
                      : 'Shift Aktif'}
                  </span>
                </div>
              </div>

              {/* Orders List in this shift */}
              <div>
                <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider mb-2.5">
                  Daftar Transaksi Selama Shift ({selectedShift.orders?.length || 0})
                </h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase">
                      <tr>
                        <th className="px-3 py-2">No. Faktur</th>
                        <th className="px-3 py-2">Waktu</th>
                        <th className="px-3 py-2">Metode</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(!selectedShift.orders || selectedShift.orders.length === 0) ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-6 text-center text-slate-400 text-xs">
                            Belum ada transaksi di shift ini
                          </td>
                        </tr>
                      ) : (
                        selectedShift.orders.map((ord: any) => (
                          <tr key={ord.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-bold text-slate-800">{ord.invoiceNumber}</td>
                            <td className="px-3 py-2 text-slate-500">
                              {new Date(ord.createdAt).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="px-3 py-2">
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-700">
                                {ord.paymentMethod || ord.payments?.[0]?.method || 'CASH'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-black text-blue-900">
                              Rp {Number(ord.grandTotal).toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pelunasan Kasbon Tunai jika ada */}
              {selectedShift.debtPayments && selectedShift.debtPayments.length > 0 && (
                <div>
                  <h4 className="font-extrabold text-xs text-emerald-800 uppercase tracking-wider mb-2.5">
                    Pelunasan Kasbon Tunai ({selectedShift.debtPayments.length})
                  </h4>
                  <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase">
                        <tr>
                          <th className="px-3 py-2">Pelanggan</th>
                          <th className="px-3 py-2">Waktu</th>
                          <th className="px-3 py-2 text-right">Nominal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedShift.debtPayments.map((dp: any) => (
                          <tr key={dp.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-bold text-slate-800">{dp.customerName}</td>
                            <td className="px-3 py-2 text-slate-500">
                              {new Date(dp.createdAt).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="px-3 py-2 text-right font-black text-emerald-700">
                              Rp {Number(dp.amount).toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedShift(null)}
                className="px-5 py-2 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
