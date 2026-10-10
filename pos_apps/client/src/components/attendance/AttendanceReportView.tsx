import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  Download,
  Save,
  Settings2,
  Search,
  Store,
  X,
  ChevronDown,
  Calendar,
} from 'lucide-react';
import { attendanceApi, api } from '../../services/api';
import { TablePagination } from '../TablePagination';
import type { AttendanceRecord, AttendanceReportSummary, AttendanceConfig } from '../../types/attendance';
import type { Outlet } from '../../types/outlet';
import { useDialog } from '../../context/DialogContext';

export const AttendanceReportView: React.FC = () => {
  const dialog = useDialog();

  // Filter state
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [searchStaff, setSearchStaff] = useState<string>('');

  // Data state
  const [loading, setLoading] = useState<boolean>(true);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceReportSummary>({
    totalRecords: 0,
    onTimeCount: 0,
    lateCount: 0,
    earlyLeaveCount: 0,
    totalWorkingHours: 0,
    avgLateMinutes: 0,
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalRecords, setTotalRecords] = useState<number>(0);

  // Config Modal State
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [configOutletId, setConfigOutletId] = useState<string>('');
  const [standardClockIn, setStandardClockIn] = useState<string>('08:00');
  const [standardClockOut, setStandardClockOut] = useState<string>('17:00');
  const [lateToleranceMinutes, setLateToleranceMinutes] = useState<number>(15);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [outletTimezone, setOutletTimezone] = useState<string>('Asia/Jakarta');

  // Load Outlets
  useEffect(() => {
    const fetchOutlets = async () => {
      try {
        const res = await api.getOutlets();
        if (res.status === 'success' && Array.isArray(res.data)) {
          setOutlets(res.data);
          if (res.data.length > 0 && !selectedOutletId) {
            setSelectedOutletId(res.data[0].id);
            setConfigOutletId(res.data[0].id);
            if (res.data[0].timezone) setOutletTimezone(res.data[0].timezone);
            const cfg = res.data[0].attendanceConfig as AttendanceConfig | undefined;
            if (cfg) {
              if (cfg.standardClockIn) setStandardClockIn(cfg.standardClockIn);
              if (cfg.standardClockOut) setStandardClockOut(cfg.standardClockOut);
              if (cfg.lateToleranceMinutes !== undefined) setLateToleranceMinutes(cfg.lateToleranceMinutes);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch outlets:', err);
      }
    };
    fetchOutlets();
  }, []);

  // Sync selected outlet config when outlet dropdown changes
  const handleOutletChange = (outletId: string) => {
    setSelectedOutletId(outletId);
    setConfigOutletId(outletId);
    setCurrentPage(1);
    const found = outlets.find((o) => o.id === outletId);
    if (found) {
      if (found.timezone) setOutletTimezone(found.timezone);
      const cfg = found.attendanceConfig as AttendanceConfig | undefined;
      if (cfg) {
        setStandardClockIn(cfg.standardClockIn || '08:00');
        setStandardClockOut(cfg.standardClockOut || '17:00');
        setLateToleranceMinutes(cfg.lateToleranceMinutes ?? 15);
      }
    }
  };

  const handleOpenConfigModal = () => {
    const targetId = selectedOutletId || (outlets.length > 0 ? outlets[0].id : '');
    setConfigOutletId(targetId);
    const found = outlets.find((o) => o.id === targetId);
    if (found) {
      if (found.timezone) setOutletTimezone(found.timezone);
      const cfg = found.attendanceConfig as AttendanceConfig | undefined;
      if (cfg) {
        setStandardClockIn(cfg.standardClockIn || '08:00');
        setStandardClockOut(cfg.standardClockOut || '17:00');
        setLateToleranceMinutes(cfg.lateToleranceMinutes ?? 15);
      }
    }
    setIsConfigOpen(true);
  };

  const handleConfigOutletSelect = (outletId: string) => {
    setConfigOutletId(outletId);
    const found = outlets.find((o) => o.id === outletId);
    if (found) {
      if (found.timezone) setOutletTimezone(found.timezone);
      const cfg = found.attendanceConfig as AttendanceConfig | undefined;
      if (cfg) {
        setStandardClockIn(cfg.standardClockIn || '08:00');
        setStandardClockOut(cfg.standardClockOut || '17:00');
        setLateToleranceMinutes(cfg.lateToleranceMinutes ?? 15);
      }
    }
  };

  // Fetch Attendance Report
  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await attendanceApi.getAttendanceReport({
        outletId: selectedOutletId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: currentPage,
        limit: pageSize,
      });

      if (res.status === 'success') {
        setRecords(res.data || []);
        setTotalRecords(res.pagination?.total || 0);
        if (res.summary) {
          setSummary(res.summary);
        }
      }
    } catch (err) {
      console.error('Failed to fetch attendance report:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedOutletId, startDate, endDate, currentPage, pageSize]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Save Attendance Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetOutletId = configOutletId || selectedOutletId;
    if (!targetOutletId) {
      dialog.alert({
        title: 'Pilih Toko',
        message: 'Silakan pilih toko / outlet yang akan dikonfigurasi.',
        variant: 'warning',
      });
      return;
    }

    setSavingConfig(true);
    try {
      const res = await attendanceApi.updateAttendanceConfig({
        outletId: targetOutletId,
        timezone: outletTimezone,
        standardClockIn,
        standardClockOut,
        lateToleranceMinutes: Number(lateToleranceMinutes),
      });

      if (res.status === 'success') {
        dialog.alert({
          title: 'Pengaturan Disimpan',
          message: 'Jadwal kerja dan toleransi keterlambatan kehadiran staf berhasil diperbarui.',
          variant: 'success',
        });
        setIsConfigOpen(false);
        // Perbarui state outlets lokal
        setOutlets((prev) =>
          prev.map((o) => (o.id === targetOutletId ? { ...o, ...res.data } : o))
        );
        fetchReport();
      } else {
        dialog.alert({
          title: 'Gagal Menyimpan',
          message: res.message || 'Terjadi kesalahan saat menyimpan pengaturan.',
          variant: 'danger',
        });
      }
    } catch (err: any) {
      dialog.alert({
        title: 'Kesalahan Sistem',
        message: err.message || 'Koneksi server terputus.',
        variant: 'danger',
      });
    } finally {
      setSavingConfig(false);
    }
  };

  // Export to CSV with UTF-8 BOM
  const handleExportCsv = () => {
    if (records.length === 0) {
      dialog.alert({
        title: 'Data Kosong',
        message: 'Tidak ada data absensi untuk diekspor pada rentang tanggal ini.',
        variant: 'info',
      });
      return;
    }

    const headers = [
      'Tanggal Kerja',
      'Nama Staf',
      'Peran (Role)',
      'ID Staf',
      'Toko / Outlet',
      'Jam Masuk',
      'Jam Pulang',
      'Durasi (Menit)',
      'Status Kehadiran',
      'Keterlambatan (Menit)',
      'Catatan / Alasan',
    ];

    const rows = records.map((r) => [
      r.workDate,
      `"${r.user?.name || '-'}"`,
      r.user?.role || '-',
      r.user?.userCode || '-',
      `"${r.outlet?.name || '-'}"`,
      new Date(r.clockIn).toLocaleTimeString('id-ID'),
      r.clockOut ? new Date(r.clockOut).toLocaleTimeString('id-ID') : 'Masih Bekerja',
      r.durationMinutes ?? '-',
      r.status === 'LATE' ? 'TERLAMBAT' : r.status === 'EARLY_LEAVE' ? 'PULANG AWAL' : 'TEPAT WAKTU',
      r.lateMinutes ?? 0,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `rekap-absensi-staf-${startDate}-sd-${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter records by search query
  const filteredRecords = records.filter((r) => {
    if (!searchStaff.trim()) return true;
    const q = searchStaff.toLowerCase();
    return (
      r.user?.name.toLowerCase().includes(q) ||
      (r.user?.userCode && r.user.userCode.toLowerCase().includes(q)) ||
      r.user?.role.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-28 sm:pb-16 font-sans">
      {/* Header & Controls */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-blue-950 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-900" />
              <span>Rekapitulasi Kehadiran &amp; Absensi Staf</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Pantau kepatuhan jam masuk, toleransi keterlambatan, dan total durasi kerja staf (kasir &amp; non-kasir).
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleOpenConfigModal}
              className="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Settings2 className="w-4 h-4 text-slate-600" />
              <span>Atur Jam &amp; Toleransi</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="h-10 px-4 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Ekspor CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 text-xs">
          {/* Toko / Outlet Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Toko / Outlet:
            </label>
            <div className="relative">
              <Store className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={selectedOutletId}
                onChange={(e) => handleOutletChange(e.target.value)}
                className="w-full h-10 pl-9 pr-9 appearance-none bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 font-bold text-xs text-slate-800 cursor-pointer"
              >
                <option value="">Semua Toko</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Tanggal Mulai */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Tanggal Mulai:
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-10 pl-9 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 font-semibold text-xs text-slate-800 font-mono"
              />
            </div>
          </div>

          {/* Tanggal Akhir */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Tanggal Akhir:
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-10 pl-9 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 font-semibold text-xs text-slate-800 font-mono"
              />
            </div>
          </div>

          {/* Cari Nama / ID */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Cari Nama / ID Staf:
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchStaff}
                onChange={(e) => setSearchStaff(e.target.value)}
                placeholder="Cari nama atau ID staf..."
                className="w-full h-10 pl-9 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 font-semibold text-xs text-slate-800"
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Kehadiran</span>
          <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 mt-1">{summary.totalRecords}</div>
          <span className="text-[11px] text-slate-400 mt-0.5 block font-medium">Sesi Tercatat</span>
        </div>

        <div className="p-4 sm:p-5 bg-white rounded-2xl border border-emerald-200/80 shadow-2xs bg-emerald-50/20">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Tepat Waktu</span>
          <div className="text-xl sm:text-2xl font-black font-mono text-emerald-700 mt-1">{summary.onTimeCount}</div>
          <span className="text-[11px] text-emerald-600 mt-0.5 block font-medium">
            {summary.totalRecords > 0 ? `${Math.round((summary.onTimeCount / summary.totalRecords) * 100)}% kepatuhan` : '0% kepatuhan'}
          </span>
        </div>

        <div className="p-4 sm:p-5 bg-white rounded-2xl border border-amber-200/80 shadow-2xs bg-amber-50/20">
          <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">Terlambat</span>
          <div className="text-xl sm:text-2xl font-black font-mono text-amber-700 mt-1">{summary.lateCount}</div>
          <span className="text-[11px] text-amber-600 mt-0.5 block font-medium">
            Rata-rata: {summary.avgLateMinutes} menit
          </span>
        </div>

        <div className="p-4 sm:p-5 bg-white rounded-2xl border border-rose-200/80 shadow-2xs bg-rose-50/20">
          <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block">Pulang Lebih Awal</span>
          <div className="text-xl sm:text-2xl font-black font-mono text-rose-700 mt-1">{summary.earlyLeaveCount}</div>
          <span className="text-[11px] text-rose-600 mt-0.5 block font-medium">Sebelum jam pulang</span>
        </div>

        <div className="p-4 sm:p-5 bg-white rounded-2xl border border-blue-200/80 shadow-2xs bg-blue-50/20 col-span-2 lg:col-span-1">
          <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider block">Total Jam Kerja</span>
          <div className="text-xl sm:text-2xl font-black font-mono text-blue-950 mt-1">
            {summary.totalWorkingHours} <span className="text-xs font-normal">Jam</span>
          </div>
          <span className="text-[11px] text-blue-700 mt-0.5 block font-medium">Akumulasi durasi</span>
        </div>
      </div>

      {/* Attendance Table & Mobile Hybrid Card List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">
                <th className="py-3.5 px-5">Tanggal Kerja</th>
                <th className="py-3.5 px-5">Nama Petugas</th>
                <th className="py-3.5 px-5">Peran &amp; Toko</th>
                <th className="py-3.5 px-5">Jam Masuk / Pulang</th>
                <th className="py-3.5 px-5">Durasi Kerja</th>
                <th className="py-3.5 px-5">Status Kehadiran</th>
                <th className="py-3.5 px-5">Catatan / Alasan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-medium">
                    <div className="inline-block w-6 h-6 border-2 border-blue-900 border-t-transparent rounded-full animate-spin mb-2" />
                    <p className="font-semibold text-xs">Memuat data absensi staf...</p>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-xs text-slate-600">Tidak ada catatan absensi</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Sesuaikan filter toko atau rentang tanggal untuk melihat data lainnya.</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const tz = r.outlet?.timezone || 'Asia/Jakarta';
                  const inTime = new Date(r.clockIn).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: tz,
                  });
                  const outTime = r.clockOut
                    ? new Date(r.clockOut).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: tz,
                      })
                    : null;

                  const durHrs = r.durationMinutes ? Math.floor(r.durationMinutes / 60) : 0;
                  const durMins = r.durationMinutes ? r.durationMinutes % 60 : 0;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Tanggal Kerja */}
                      <td className="py-3.5 px-5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {r.workDate}
                      </td>

                      {/* Nama Petugas */}
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-blue-950">{r.user?.name || '-'}</div>
                        {r.user?.userCode && (
                          <span className="font-mono text-[10px] text-blue-950 font-bold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 mt-0.5 inline-block">
                            #{r.user.userCode}
                          </span>
                        )}
                      </td>

                      {/* Peran & Toko */}
                      <td className="py-3.5 px-5">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {r.user?.role || '-'}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                            <Store className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{r.outlet?.name || '-'}</span>
                          </span>
                        </div>
                      </td>

                      {/* Jam Masuk / Pulang */}
                      <td className="py-3.5 px-5 font-mono">
                        <div>
                          Masuk: <span className="font-bold text-slate-900">{inTime}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Pulang:{' '}
                          {outTime ? (
                            <span className="font-bold text-slate-800">{outTime}</span>
                          ) : (
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                              Sedang Kerja
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Durasi Kerja */}
                      <td className="py-3.5 px-5 font-mono font-bold text-slate-800">
                        {r.durationMinutes ? `${durHrs}j ${durMins}m` : '—'}
                      </td>

                      {/* Status Kehadiran */}
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${
                            r.status === 'LATE'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : r.status === 'EARLY_LEAVE'
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {r.status === 'LATE' ? (
                            <>
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>Terlambat {r.lateMinutes}m</span>
                            </>
                          ) : r.status === 'EARLY_LEAVE' ? (
                            <>
                              <Clock className="w-3 h-3 text-rose-600" />
                              <span>Pulang Awal</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Tepat Waktu</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Catatan */}
                      <td className="py-3.5 px-5 text-slate-600 italic">
                        {r.notes || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Attendance Card List View (Ergonomis Layar Smartphone 6,8" Portrait) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="py-12 text-center text-slate-500 font-medium">
              <div className="inline-block w-6 h-6 border-2 border-blue-900 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="font-semibold text-xs">Memuat data absensi staf...</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-medium px-4">
              <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-xs text-slate-600">Tidak ada catatan absensi</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Sesuaikan filter toko atau rentang tanggal untuk melihat data lainnya.</p>
            </div>
          ) : (
            filteredRecords.map((r) => {
              const tz = r.outlet?.timezone || 'Asia/Jakarta';
              const inTime = new Date(r.clockIn).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: tz,
              });
              const outTime = r.clockOut
                ? new Date(r.clockOut).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: tz,
                  })
                : null;

              const durHrs = r.durationMinutes ? Math.floor(r.durationMinutes / 60) : 0;
              const durMins = r.durationMinutes ? r.durationMinutes % 60 : 0;

              return (
                <div key={r.id} className="p-4 space-y-3">
                  {/* Top Bar: Nama Petugas + Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-blue-950 text-sm">{r.user?.name || '-'}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {r.user?.userCode && (
                          <span className="font-mono text-[10px] font-bold text-blue-950 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            #{r.user.userCode}
                          </span>
                        )}
                        <span className="text-[10px] font-bold uppercase text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          {r.user?.role || '-'}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                        r.status === 'LATE'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : r.status === 'EARLY_LEAVE'
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}
                    >
                      {r.status === 'LATE' ? (
                        <>
                          <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                          <span>Terlambat {r.lateMinutes}m</span>
                        </>
                      ) : r.status === 'EARLY_LEAVE' ? (
                        <>
                          <Clock className="w-2.5 h-2.5 text-rose-600" />
                          <span>Pulang Awal</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                          <span>Tepat Waktu</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Middle Box: Detail Jam, Durasi, Toko */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-[11px] text-slate-500 font-sans font-medium">Tanggal:</span>
                      <span className="font-bold text-slate-900">{r.workDate}</span>
                    </div>

                    <div className="flex items-center justify-between font-mono pt-1 border-t border-slate-200/60">
                      <span className="text-[11px] text-slate-500 font-sans font-medium">Jam Masuk / Pulang:</span>
                      <span className="font-bold text-slate-900">
                        {inTime} - {outTime || 'Sedang Kerja'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between font-mono pt-1 border-t border-slate-200/60">
                      <span className="text-[11px] text-slate-500 font-sans font-medium">Durasi Kerja:</span>
                      <span className="font-bold text-blue-950">
                        {r.durationMinutes ? `${durHrs}j ${durMins}m` : '—'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                      <span className="text-[11px] text-slate-500 font-medium">Toko:</span>
                      <span className="font-bold text-slate-700 flex items-center gap-1">
                        <Store className="w-3 h-3 text-slate-400" />
                        <span>{r.outlet?.name || '-'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Catatan / Alasan jika ada */}
                  {r.notes && (
                    <div className="text-[11px] italic text-slate-600 bg-amber-50/60 p-2 rounded-xl border border-amber-200/60">
                      Catatan: {r.notes}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Canonial Table Pagination */}
        <TablePagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={totalRecords}
          onPageChange={(p) => setCurrentPage(p)}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setCurrentPage(1);
          }}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      </div>

      {/* Modal Responsif PWA: Pengaturan Jam Kerja & Toleransi (Rule 10 AGENTS.md) */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-h-[92dvh] sm:max-h-[90vh] w-full max-w-lg flex flex-col shadow-2xl overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:px-6 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center">
                  <Settings2 className="w-5 h-5 text-blue-900" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-blue-950">
                    Jadwal Operasional &amp; Toleransi
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Konfigurasi jam masuk, jam pulang, dan toleransi keterlambatan.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Scrollable */}
            <form onSubmit={handleSaveConfig} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="overflow-y-auto overscroll-contain flex-1 p-5 sm:p-6 space-y-4">
                {/* Pilih Toko untuk Konfigurasi */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Toko / Outlet yang Dikonfigurasi:
                  </label>
                  <div className="relative">
                    <Store className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select
                      value={configOutletId}
                      onChange={(e) => handleConfigOutletSelect(e.target.value)}
                      className="w-full h-11 pl-9 pr-9 appearance-none bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 font-bold text-xs text-slate-800 cursor-pointer"
                    >
                      {outlets.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Jam Masuk Standar */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Jam Masuk Standar:
                    </label>
                    <input
                      type="time"
                      value={standardClockIn}
                      onChange={(e) => setStandardClockIn(e.target.value)}
                      className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                      required
                    />
                  </div>

                  {/* Jam Pulang Standar */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Jam Pulang Standar:
                    </label>
                    <input
                      type="time"
                      value={standardClockOut}
                      onChange={(e) => setStandardClockOut(e.target.value)}
                      className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                      required
                    />
                  </div>
                </div>

                {/* Toleransi Keterlambatan */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Toleransi Keterlambatan (Menit):
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={lateToleranceMinutes}
                    onChange={(e) => setLateToleranceMinutes(parseInt(e.target.value, 10) || 0)}
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                    required
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Dispensasi keterlambatan (misal 15 menit). Absensi setelah batas ini otomatis ditandai Terlambat.
                  </p>
                </div>

                {/* Zona Waktu Toko */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Zona Waktu Toko:
                  </label>
                  <div className="relative">
                    <select
                      value={outletTimezone}
                      onChange={(e) => setOutletTimezone(e.target.value)}
                      className="w-full h-11 pl-4 pr-9 appearance-none bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 cursor-pointer"
                    >
                      <option value="Asia/Jakarta">WIB — Asia/Jakarta (UTC+7)</option>
                      <option value="Asia/Makassar">WITA — Asia/Makassar (UTC+8)</option>
                      <option value="Asia/Jayapura">WIT — Asia/Jayapura (UTC+9)</option>
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  <span className="text-[10px] text-emerald-600 font-semibold block mt-1">
                    ✓ Digunakan untuk pencatatan timestamp clock-in/out akurat di seluruh outlet
                  </span>
                </div>
              </div>

              {/* Sticky Action Footer (Rule 10 AGENTS.md) */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(false)}
                  className="h-10 px-4 rounded-xl border border-slate-200 font-bold text-xs bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="h-10 px-5 rounded-xl font-bold text-xs bg-blue-900 hover:bg-blue-950 text-white flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingConfig ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
