import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  Download,
  Save,
  Settings2,
  RefreshCw,
  Search,
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

  // Config State
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
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
    if (!selectedOutletId) return;
    setSavingConfig(true);
    try {
      const res = await attendanceApi.updateAttendanceConfig({
        outletId: selectedOutletId,
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
          prev.map((o) => (o.id === selectedOutletId ? { ...o, ...res.data } : o))
        );
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
      'Outlet',
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
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-900" />
              <span>Rekapitulasi Kehadiran &amp; Absensi Staf</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Pantau kepatuhan jam masuk, toleransi keterlambatan, dan total durasi kerja staf (kasir &amp; non-kasir).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors flex items-center gap-2"
            >
              <Settings2 className="w-4 h-4 text-slate-600" />
              <span>{isConfigOpen ? 'Tutup Pengaturan' : 'Atur Jam & Toleransi'}</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="px-4 py-2.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Ekspor CSV</span>
            </button>
          </div>
        </div>

        {/* Panel Pengaturan Jam Kerja & Toleransi (Collapsible) */}
        {isConfigOpen && (
          <form
            onSubmit={handleSaveConfig}
            className="p-5 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-4 animate-fade-in"
          >
            <div className="flex items-center gap-2 text-xs font-black text-blue-950">
              <Settings2 className="w-4 h-4 text-blue-900" />
              <span>Konfigurasi Jam Operasional &amp; Batas Toleransi ({selectedOutletId ? outlets.find(o => o.id === selectedOutletId)?.name : 'Semua Outlet'})</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Jam Masuk Standar (HH:mm):</label>
                <input
                  type="time"
                  value={standardClockIn}
                  onChange={(e) => setStandardClockIn(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-900"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Toleransi Keterlambatan (Menit):</label>
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={lateToleranceMinutes}
                  onChange={(e) => setLateToleranceMinutes(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-900"
                  required
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">Contoh: 15 menit grace period</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Jam Pulang Standar (HH:mm):</label>
                <input
                  type="time"
                  value={standardClockOut}
                  onChange={(e) => setStandardClockOut(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-900"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Zona Waktu Toko:</label>
                <select
                  value={outletTimezone}
                  onChange={(e) => setOutletTimezone(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-900"
                >
                  <option value="Asia/Jakarta">WIB - Asia/Jakarta (UTC+7)</option>
                  <option value="Asia/Makassar">WITA - Asia/Makassar (UTC+8)</option>
                  <option value="Asia/Jayapura">WIT - Asia/Jayapura (UTC+9)</option>
                </select>
                <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">
                  ✓ Otomatis terdeteksi dari tablet/laptop kasir
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={savingConfig}
                className="px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingConfig ? 'Menyimpan...' : 'Simpan Pengaturan Jadwal'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">Pilih Toko / Outlet:</label>
            <select
              value={selectedOutletId}
              onChange={(e) => handleOutletChange(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-900 font-medium"
            >
              <option value="">Semua Outlet</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.timezone || 'Asia/Jakarta'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Tanggal Mulai:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-900"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Tanggal Akhir:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-900"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">Cari Nama / ID Staf:</label>
            <div className="relative">
              <input
                type="text"
                value={searchStaff}
                onChange={(e) => setSearchStaff(e.target.value)}
                placeholder="Cari staf..."
                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-900"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Kehadiran</span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">{summary.totalRecords}</div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Sesi Tercatat</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-emerald-200 shadow-2xs bg-emerald-50/20">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">Tepat Waktu</span>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">{summary.onTimeCount}</div>
          <span className="text-[10px] text-emerald-600 mt-0.5 block">
            {summary.totalRecords > 0 ? `${Math.round((summary.onTimeCount / summary.totalRecords) * 100)}% kepatuhan` : '0%'}
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-amber-200 shadow-2xs bg-amber-50/20">
          <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">Terlambat</span>
          <div className="text-xl sm:text-2xl font-black text-amber-700 mt-1">{summary.lateCount}</div>
          <span className="text-[10px] text-amber-600 mt-0.5 block">
            Rata-rata: {summary.avgLateMinutes} menit
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-rose-200 shadow-2xs bg-rose-50/20">
          <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block">Pulang Lebih Awal</span>
          <div className="text-xl sm:text-2xl font-black text-rose-700 mt-1">{summary.earlyLeaveCount}</div>
          <span className="text-[10px] text-rose-600 mt-0.5 block">Sebelum jam pulang</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-blue-200 shadow-2xs bg-blue-50/20 col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider block">Total Jam Kerja</span>
          <div className="text-xl sm:text-2xl font-black text-blue-950 mt-1 font-mono">
            {summary.totalWorkingHours} <span className="text-xs font-normal">Jam</span>
          </div>
          <span className="text-[10px] text-blue-700 mt-0.5 block">Akumulasi durasi</span>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">
                <th className="py-3.5 px-4">Tanggal &amp; Waktu</th>
                <th className="py-3.5 px-4">Nama Staf</th>
                <th className="py-3.5 px-4">Peran &amp; Outlet</th>
                <th className="py-3.5 px-4">Jam Masuk / Pulang</th>
                <th className="py-3.5 px-4">Durasi Kerja</th>
                <th className="py-3.5 px-4">Status &amp; Keterlambatan</th>
                <th className="py-3.5 px-4">Catatan / Alasan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-900" />
                      <span>Memuat data absensi staf...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    Tidak ada catatan absensi pada rentang tanggal dan filter ini.
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
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {r.workDate}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-black text-slate-900">{r.user?.name || '-'}</div>
                        {r.user?.userCode && (
                          <div className="text-[10px] text-slate-400 font-mono">ID: {r.user.userCode}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          {r.user?.role || '-'}
                        </span>
                        <div className="text-[11px] text-slate-500 mt-0.5">{r.outlet?.name || '-'}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <div>
                          Masuk: <span className="font-bold text-slate-900">{inTime}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Pulang:{' '}
                          {outTime ? (
                            <span className="font-bold text-slate-800">{outTime}</span>
                          ) : (
                            <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded-full">
                              Sedang Kerja
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        {r.durationMinutes ? `${durHrs}j ${durMins}m` : '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            r.status === 'LATE'
                              ? 'bg-amber-100 text-amber-800'
                              : r.status === 'EARLY_LEAVE'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
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
                      <td className="py-3.5 px-4 text-slate-600 italic">
                        {r.notes || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
    </div>
  );
};
